"""Read-only resource checks. Does not start Docker, download weights or stop workloads."""
from __future__ import annotations
import argparse
import csv
import io
import json
import os
import re
import shutil
import socket
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DEFAULTS = {
    "fast": {"gpu": "1", "port": 8001, "minimumFreeMiB": 7400},
    "quality": {"gpu": "0", "port": 8002, "minimumFreeMiB": 13200},
    "general": {"gpu": "0", "port": 8003, "minimumFreeMiB": 12500},
}


FALLBACK_WARNING = "valeurs lues par un sous-ensemble des règles de Compose"
_AUTO = object()
_INTERPOLATION = re.compile(r"\$(?:\{(?P<braced>[A-Za-z_][A-Za-z0-9_]*)(?:(?P<op>:?-)(?P<default>[^}]*))?\}"
                            r"|(?P<plain>[A-Za-z_][A-Za-z0-9_]*))")


def _interpolate(value: str, known: dict[str, str]) -> str:
    def replace(match: re.Match) -> str:
        name = match.group("braced") or match.group("plain")
        current = os.environ.get(name, known.get(name))
        op = match.group("op")
        if op == ":-" and not current:
            return match.group("default")
        if op == "-" and current is None:
            return match.group("default")
        return current or ""
    return _INTERPOLATION.sub(replace, value)


def load_env_file(path: Path | None) -> dict[str, str]:
    """Fallback reader for a subset of Compose .env rules (comments, quotes, ${VAR:-default})."""
    if path is None or not path.exists():
        return {}
    values: dict[str, str] = {}
    for number, raw in enumerate(path.read_text(encoding="utf-8-sig").splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export "):].lstrip()
        if "=" not in line:
            raise ValueError(f"Invalid env line {number} in {path}")
        key, value = line.split("=", 1)
        value = value.strip()
        if value[:1] in {"'", '"'} and value.find(value[0], 1) > 0:
            quote = value[0]
            value = value[1:value.index(quote, 1)]
            if quote == '"':
                value = _interpolate(value, values)
        else:
            comment = re.search(r"\s#", value)
            if comment:
                value = value[:comment.start()]
            value = _interpolate(value.strip(), values)
        values[key.strip()] = value
    return values


def compose_args(profiles: list[str], env_file: Path | None) -> list[str]:
    """Same -f, --env-file and --profile arguments as start.ps1."""
    args = ["compose"]
    if env_file is not None and env_file.exists():
        args += ["--env-file", str(env_file.resolve())]
    args += ["-f", str(ROOT / "compose.yaml")]
    for name in profiles:
        args += ["--profile", name]
    return args


def _compose_values(docker: str, profiles: list[str], env_file: Path | None) -> dict[str, dict[str, str]]:
    result = run([docker, *compose_args(profiles, env_file), "config", "--format", "json"])
    if result.returncode != 0:
        # Never echo the output: it may contain the whole resolved model.
        raise ValueError("docker compose config failed; check compose.yaml and the env file")
    try:
        services = json.loads(result.stdout)["services"]
        values = {}
        for name in profiles:
            service = services[name]
            gpu = service["environment"]["CUDA_VISIBLE_DEVICES"]
            port = service["ports"][0]["published"]
            if not isinstance(gpu, str) or not isinstance(port, (str, int)):
                raise TypeError
            values[name] = {"gpu": gpu, "port": str(port)}
        return values
    except (ValueError, KeyError, IndexError, TypeError) as exc:
        raise ValueError("docker compose config returned an unexpected shape (GPU or port missing)") from exc


def _fallback_values(profiles: list[str], env_file: Path | None) -> dict[str, dict[str, str]]:
    file_values = load_env_file(env_file)
    values = {}
    for name in profiles:
        prefix = name.upper()
        resolved = {}
        for field, key in (("gpu", f"{prefix}_GPU"), ("port", f"{prefix}_PORT")):
            # Compose precedence: process environment, then env file; ${VAR:-default} uses
            # the default when the variable is unset or empty.
            value = os.environ[key] if key in os.environ else file_values.get(key)
            resolved[field] = value if value else str(DEFAULTS[name][field])
        values[name] = resolved
    return values


def effective_settings(profile: str, gpu: str | None, env_file: Path | None, docker=_AUTO,
                       warnings: list[str] | None = None) -> dict[str, dict]:
    profiles = ["fast", "quality"] if profile == "both" else [profile]
    if docker is _AUTO:
        docker = shutil.which("docker")
    if docker:
        values = _compose_values(docker, profiles, env_file)
    else:
        values = _fallback_values(profiles, env_file)
        if warnings is not None:
            warnings.append(FALLBACK_WARNING)
    resolved = {}
    for name in profiles:
        prefix = name.upper()
        selected_gpu = gpu if gpu is not None else values[name]["gpu"]
        try:
            port = int(values[name]["port"])
        except ValueError as exc:
            raise ValueError(f"{prefix}_PORT must be an integer") from exc
        if not 1 <= port <= 65535:
            raise ValueError(f"{prefix}_PORT must be between 1 and 65535")
        resolved[name] = {"gpu": selected_gpu, "port": port,
                          "minimumFreeMiB": DEFAULTS[name]["minimumFreeMiB"]}
    return resolved


def run(args: list[str]) -> subprocess.CompletedProcess:
    try:
        return subprocess.run(args, capture_output=True, text=True, timeout=20)
    except subprocess.TimeoutExpired:
        return subprocess.CompletedProcess(args, 124, "", "timed out after 20 seconds")


def inspect(profile: str, gpu: str | None = None, env_file: Path | None = ROOT / ".env") -> tuple[dict, bool]:
    lock = json.loads((ROOT / "model-lock.json").read_text(encoding="utf-8"))
    warnings: list[str] = []
    settings = effective_settings(profile, gpu, env_file, warnings=warnings)
    report: dict = {"profile": profile, "image": lock["image"], "settings": settings, "checks": []}
    if warnings:
        report["warnings"] = warnings
    checks = report["checks"]
    if not shutil.which("docker"):
        checks.append({"check": "docker", "ok": False, "detail": "Docker CLI absent"})
    else:
        result = run(["docker", "info", "--format", "{{.ServerVersion}}"])
        checks.append({"check": "docker", "ok": result.returncode == 0,
                       "detail": result.stdout.strip() if result.returncode == 0 else "Docker engine unavailable; not started automatically"})
    gpu_rows = []
    if shutil.which("nvidia-smi"):
        result = run(["nvidia-smi", "--query-gpu=index,uuid,name,memory.total,memory.free", "--format=csv,noheader,nounits"])
        if result.returncode == 0:
            gpu_rows = [[part.strip() for part in row] for row in csv.reader(io.StringIO(result.stdout))]
    report["gpus"] = gpu_rows
    for name, selected in settings.items():
        wanted = selected["gpu"]
        row = next((row for row in gpu_rows if wanted in row[:2]), None)
        # Reservations, not a guarantee that a model and all runtime buffers fit.
        required = selected["minimumFreeMiB"]
        available = int(row[4]) if row else 0
        checks.append({"check": f"{name}-gpu", "ok": bool(row and available >= required),
                       "gpu": wanted, "freeMiB": available, "minimumFreeMiB": required,
                       "detail": "Reserve estimate only; real loading must still be tested"})
        port = selected["port"]
        with socket.socket() as probe:
            try:
                probe.bind(("127.0.0.1", port))
                free = True
            except OSError:
                free = False
        checks.append({"check": f"{name}-port", "port": port, "ok": free})
    report["readyForTrial"] = all(check["ok"] for check in checks)
    return report, report["readyForTrial"]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", choices=["fast", "quality", "general", "both"], default="both")
    parser.add_argument("--gpu", help="index or UUID, for a single profile")
    parser.add_argument("--env-file", type=Path, default=ROOT / ".env",
                        help="Compose env file to evaluate (default: server/.env when present)")
    args = parser.parse_args()
    if args.gpu and args.profile == "both":
        parser.error("--gpu needs a single --profile")
    try:
        report, ok = inspect(args.profile, args.gpu, args.env_file)
    except ValueError as exc:
        parser.error(str(exc))
    print(json.dumps(report, indent=2, ensure_ascii=False))
    raise SystemExit(0 if ok else 2)
