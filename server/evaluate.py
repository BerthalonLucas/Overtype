"""Reproducible OpenAI-streaming translation evaluation; no claimed human quality scores."""
from __future__ import annotations
import argparse
import concurrent.futures
import csv
import hashlib
import json
import math
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from eval_corpus import cases
from gpu_memory import LocalGpuMemory

ROOT = Path(__file__).resolve().parent


def prompt(text: str, language: str) -> str:
    target = {"fr": "French", "en": "English"}[language]
    return f"Translate the following text into {target}. Note that you should only output the translated result without any additional explanation:\n{text}"


def validate_endpoint(endpoint: str) -> str:
    parts = urllib.parse.urlsplit(endpoint)
    if parts.username or parts.password or parts.query or parts.fragment:
        raise ValueError("Endpoint must not contain credentials, query or fragment")
    if parts.scheme != "https" and not (parts.scheme == "http" and parts.hostname in {"localhost", "127.0.0.1", "::1"}):
        raise ValueError("Remote endpoints require HTTPS")
    return endpoint.rstrip("/")


def percentile(values: list[float], p: float) -> float | None:
    if not values:
        return None
    values = sorted(values)
    return values[max(0, math.ceil(len(values) * p) - 1)]


def profile_choices(lock: dict) -> list[str]:
    return [name for name in ("fast", "quality", "general") if name in lock["profiles"]]


def sse_events(lines):
    """Yield each SSE event's data: lines joined by newlines, dispatched on the blank line."""
    data: list[str] = []
    for raw_line in lines:
        line = raw_line.decode("utf-8").rstrip("\r\n")
        if not line:
            if data:
                yield "\n".join(data)
                data = []
            continue
        if line.startswith("data:"):
            value = line[5:]
            data.append(value[1:] if value.startswith(" ") else value)
    if data:
        yield "\n".join(data)


def parse_event(event):
    """Return [(content, finish_reason)], "error", or None for an invalid shape."""
    if not isinstance(event, dict):
        return None
    if event.get("error"):
        return "error"
    choices = event.get("choices", [])
    if not isinstance(choices, list):
        return None
    parsed = []
    for choice in choices:
        if not isinstance(choice, dict):
            return None
        delta = choice.get("delta", {})
        if not isinstance(delta, dict):
            return None
        content = delta.get("content")
        reason = choice.get("finish_reason")
        if content is not None and not isinstance(content, str):
            return None
        if reason is not None and not isinstance(reason, str):
            return None
        parsed.append((content, reason))
    return parsed


def translate(case: dict, endpoint: str, alias: str, generation: dict, api_key: str = "") -> dict:
    body = {"model": alias, "messages": [{"role": "user", "content": prompt(case["text"], case["targetLanguage"])}],
            "stream": True, **generation}
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    request = urllib.request.Request(endpoint + "/chat/completions", json.dumps(body).encode(), headers)
    started = time.perf_counter()
    first = None
    chunks: list[str] = []
    finish = None
    done = False
    error = None
    try:
        # Do not follow redirects with authorization credentials.
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, req, fp, code, msg, hdrs, newurl):
                return None
        with urllib.request.build_opener(NoRedirect).open(request, timeout=120) as response:
            for data in sse_events(response):
                if data == "[DONE]":
                    done = True
                    break
                parsed = parse_event(json.loads(data))
                if parsed is None:
                    error = "invalid-stream-event"
                    break
                if parsed == "error":
                    error = "stream-error"
                    break
                for delta, reason in parsed:
                    if delta:
                        if first is None:
                            first = time.perf_counter() - started
                        chunks.append(delta)
                    if reason:
                        finish = reason
    except urllib.error.HTTPError as exc:
        error = f"http-{exc.code}"  # never persist response bodies containing input/keys
    except (OSError, ValueError):
        error = "transport-or-stream-error"
    elapsed = time.perf_counter() - started
    output = "".join(chunks)
    ok = bool(done and finish == "stop" and output.strip() and error is None)
    return {"id": case["id"], "targetLanguage": case["targetLanguage"], "success": ok,
            "error": error or (None if ok else "incomplete-generation"), "finishReason": finish,
            "ttftSeconds": first, "totalSeconds": elapsed, "output": output,
            "missingPreservedTokens": [token for token in case["mustPreserve"] if token not in output]}


def main():
    lock = json.loads((ROOT / "model-lock.json").read_text(encoding="utf-8"))
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", choices=profile_choices(lock), required=True)
    parser.add_argument("--endpoint", help="OpenAI base URL ending in /v1")
    parser.add_argument("--concurrency", type=int, choices=[1, 4, 10], default=1)
    parser.add_argument("--limit", type=int, default=100)
    parser.add_argument("--output-dir", type=Path, default=ROOT / "results")
    parser.add_argument("--skip-warmup", action="store_true")
    parser.add_argument("--measure-local-gpu", action="store_true", help="Sample local GPU totals once/second; run on the inference host")
    args = parser.parse_args()
    if not 1 <= args.limit <= 100:
        parser.error("--limit must be between 1 and 100")
    profile = lock["profiles"][args.profile]
    endpoint = validate_endpoint(args.endpoint or f'http://127.0.0.1:{profile["port"]}/v1')
    generation = profile.get("generation", lock["generation"])
    corpus = cases()[:args.limit]
    api_key = os.environ.get("FLOWTRANSLATE_API_KEY", "")
    if not args.skip_warmup:
        warmup = translate(corpus[0], endpoint, profile["alias"], generation, api_key)
        if not warmup["success"]:
            print(json.dumps({"status": "blocked", "reason": warmup["error"], "benchmarkExecuted": False}))
            return 2
    memory = LocalGpuMemory(args.measure_local_gpu)
    memory.start()
    wall_started = time.perf_counter()
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.concurrency) as pool:
            results = list(pool.map(lambda case: translate(case, endpoint, profile["alias"], generation, api_key), corpus))
    finally:
        wall_seconds = time.perf_counter() - wall_started
        memory.stop()
    successful = [r for r in results if r["success"]]
    totals = [r["totalSeconds"] for r in successful]
    ttfts = [r["ttftSeconds"] for r in successful if r["ttftSeconds"] is not None]
    report = {"profile": args.profile, "model": profile["repository"], "revision": profile["revision"],
              "image": lock["image"], "generation": generation, "concurrency": args.concurrency,
              "cases": len(results), "successful": len(successful), "failed": len(results) - len(successful),
              "wallSeconds": wall_seconds, "requestsPerSecond": len(successful) / wall_seconds,
              "latencyP50Seconds": percentile(totals, .5), "latencyP95Seconds": percentile(totals, .95),
              "ttftP50Seconds": percentile(ttfts, .5), "ttftP95Seconds": percentile(ttfts, .95),
              "preservationFailures": sum(bool(r["missingPreservedTokens"]) for r in successful),
              "humanQualityReview": "pending", "localGpuMemory": memory.report(),
              "corpusSha256": hashlib.sha256(json.dumps(corpus, sort_keys=True).encode()).hexdigest()}
    args.output_dir.mkdir(parents=True, exist_ok=True)
    name = f'{args.profile}-c{args.concurrency}-{time.strftime("%Y%m%d-%H%M%S")}'
    (args.output_dir / f"{name}.jsonl").write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in results), encoding="utf-8")
    (args.output_dir / f"{name}-summary.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    with (args.output_dir / f"{name}-human-review.csv").open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.writer(handle)
        writer.writerow(["id", "source", "reference", "translation", "fidelity_1_5", "naturalness_1_5", "omission_or_addition", "format_issue", "notes"])
        for case, result in zip(corpus, results):
            writer.writerow([case["id"], case["text"], case["reference"], result["output"], "", "", "", "", ""])
    print(json.dumps(report, indent=2))
    return 0 if len(successful) == len(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
