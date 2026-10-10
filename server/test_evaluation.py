import json
import os
import shutil
import subprocess
import threading
import tempfile
import unittest
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from eval_corpus import cases
import preflight
from evaluate import percentile, profile_choices, prompt, translate, validate_endpoint
from preflight import FALLBACK_WARNING, effective_settings


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_POST(self):
        self.rfile.read(int(self.headers["Content-Length"]))
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.end_headers()
        raw = getattr(self.server, "raw", None)
        if raw is not None:
            self.wfile.write(raw)
            return
        events = [{"choices": [{"delta": {"content": "Bonjour é"}}]},
                  {"choices": [{"delta": {}, "finish_reason": "length" if self.server.truncated else "stop"}]}]
        for event in events:
            self.wfile.write(("data: " + json.dumps(event, ensure_ascii=False) + "\n\n").encode())
        self.wfile.write(b"data: [DONE]\n\n")


class EvaluationTests(unittest.TestCase):
    def test_corpus_balanced_unique_nonempty(self):
        corpus = cases()
        self.assertEqual(len(corpus), 100)
        self.assertEqual(len({c["id"] for c in corpus}), 100)
        self.assertEqual(sum(c["targetLanguage"] == "fr" for c in corpus), 50)
        self.assertTrue(all(c["text"] and c["reference"] and c["origin"] == "synthetic" for c in corpus))

    def test_remote_endpoint_policy(self):
        self.assertEqual(validate_endpoint("http://127.0.0.1:8001/v1/"), "http://127.0.0.1:8001/v1")
        for bad in ("http://example.com/v1", "https://user:secret@example.com/v1", "https://example.com/v1?key=secret"):
            with self.assertRaises(ValueError):
                validate_endpoint(bad)

    def test_prompt_and_percentiles(self):
        self.assertIn("into French", prompt("hello", "fr"))
        self.assertIsNone(percentile([], .95))
        self.assertEqual(percentile([3, 1, 2], .5), 2)

    def test_preflight_honors_env_file_and_process_override(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / ".env"
            path.write_text("FAST_GPU=GPU-test\nFAST_PORT=9011\n", encoding="utf-8")
            settings = effective_settings("fast", None, path, docker=None)
            self.assertEqual(settings["fast"]["gpu"], "GPU-test")
            self.assertEqual(settings["fast"]["port"], 9011)
            previous = os.environ.get("FAST_PORT")
            os.environ["FAST_PORT"] = "9012"
            try:
                self.assertEqual(effective_settings("fast", None, path, docker=None)["fast"]["port"], 9012)
            finally:
                if previous is None:
                    os.environ.pop("FAST_PORT", None)
                else:
                    os.environ["FAST_PORT"] = previous

    def test_preflight_fallback_handles_comments_interpolation_and_empty_values(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / ".env"
            path.write_text(
                "BASE_PORT=9020\n"
                "FAST_GPU=GPU-a # trailing comment\n"
                "FAST_PORT=${BASE_PORT:-9999}\n"
                "QUALITY_GPU=\n"
                "QUALITY_PORT=${UNSET_OVERTYPE_TEST_VAR:-9021}\n",
                encoding="utf-8")
            for key in ("FAST_GPU", "FAST_PORT", "QUALITY_GPU", "QUALITY_PORT", "UNSET_OVERTYPE_TEST_VAR"):
                self.assertNotIn(key, os.environ)
            warnings: list[str] = []
            settings = effective_settings("both", None, path, docker=None, warnings=warnings)
            self.assertEqual(settings["fast"]["gpu"], "GPU-a")
            self.assertEqual(settings["fast"]["port"], 9020)
            self.assertEqual(settings["quality"]["gpu"], "0")  # empty value -> Compose default
            self.assertEqual(settings["quality"]["port"], 9021)
            self.assertEqual(warnings, [FALLBACK_WARNING])

    def test_preflight_reads_effective_compose_config(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture = Path(directory)
            env_file = fixture / ".env"
            env_file.write_text("FAST_PORT=1\n", encoding="utf-8")
            config = {"name": "server", "services": {"fast": {
                "image": "secret-model-image",
                "command": ["--model", "secret/full-model"],
                "environment": {"CUDA_VISIBLE_DEVICES": "GPU-compose", "HF_TOKEN": "x"},
                "ports": [{"mode": "ingress", "host_ip": "127.0.0.1", "target": 8000,
                           "published": "9031", "protocol": "tcp"}]}}}
            (fixture / "config.json").write_text(json.dumps(config), encoding="utf-8")
            log = fixture / "calls.log"
            if os.name == "nt":
                docker = fixture / "docker.cmd"
                docker.write_text("@echo off\necho docker %*>>\"%OVERTYPE_FAKE_LOG%\"\n"
                                  "type \"%OVERTYPE_FAKE_CONFIG%\"\nexit /b 0\n", encoding="ascii")
            else:
                docker = fixture / "docker"
                docker.write_text("#!/bin/sh\necho docker \"$@\" >>\"$OVERTYPE_FAKE_LOG\"\n"
                                  "cat \"$OVERTYPE_FAKE_CONFIG\"\n", encoding="ascii")
                docker.chmod(0o755)
            previous = {key: os.environ.get(key) for key in ("OVERTYPE_FAKE_LOG", "OVERTYPE_FAKE_CONFIG")}
            os.environ["OVERTYPE_FAKE_LOG"] = str(log)
            os.environ["OVERTYPE_FAKE_CONFIG"] = str(fixture / "config.json")
            try:
                warnings: list[str] = []
                settings = effective_settings("fast", None, env_file, docker=str(docker), warnings=warnings)
            finally:
                for key, value in previous.items():
                    if value is None:
                        os.environ.pop(key, None)
                    else:
                        os.environ[key] = value
            self.assertEqual(settings, {"fast": {"gpu": "GPU-compose", "port": 9031, "minimumFreeMiB": 7400}})
            self.assertEqual(warnings, [])
            self.assertNotIn("secret", json.dumps(settings))
            call = log.read_text(encoding="utf-8").split()
            compose_file = str(Path(preflight.__file__).resolve().with_name("compose.yaml"))
            self.assertEqual(call, ["docker", "compose", "--env-file", str(env_file.resolve()), "-f", compose_file,
                                    "--profile", "fast", "config", "--format", "json"])

    def test_evaluate_profiles_follow_model_lock(self):
        self.assertEqual(profile_choices({"profiles": {"fast": {}, "quality": {}, "general": {}}}),
                         ["fast", "quality", "general"])
        self.assertEqual(profile_choices({"profiles": {"fast": {}, "quality": {}}}), ["fast", "quality"])

    def run_stream(self, raw: bytes) -> dict:
        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        server.raw = raw
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            case = {"id": "test", "text": "Hello", "targetLanguage": "fr", "mustPreserve": []}
            return translate(case, f"http://127.0.0.1:{server.server_port}", "test-fixture", {})
        finally:
            server.shutdown()
            server.server_close()

    def test_stream_event_split_over_two_data_lines(self):
        result = self.run_stream(
            b'data: {"choices": [{"delta": {"content": "Bonjour"},\n'
            b'data: "finish_reason": "stop"}]}\n\n'
            b"data: [DONE]\n\n")
        self.assertTrue(result["success"], result)
        self.assertEqual(result["output"], "Bonjour")

    def test_stream_invalid_shapes_are_stream_errors(self):
        for event in (b'{"choices": null}', b'{"choices": [{"delta": null}]}',
                      b'{"choices": [{"delta": {"content": 3}}]}', b'[1]', b'{"choices": ["x"]}'):
            result = self.run_stream(b"data: " + event + b"\n\ndata: [DONE]\n\n")
            self.assertFalse(result["success"])
            self.assertEqual(result["error"], "invalid-stream-event", event)

    @unittest.skipUnless(os.name == "nt" and shutil.which("powershell"), "Windows PowerShell test")
    def test_start_script_first_launch_and_stopped_service_are_selected_only(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture = Path(directory)
            log = fixture / "calls.log"
            docker = fixture / "docker.cmd"
            docker.write_text(
                "@echo off\n"
                "echo docker %*>>\"%FLOWTRANSLATE_FAKE_LOG%\"\n"
                "if \"%1\"==\"inspect\" (\n"
                "  if \"%FLOWTRANSLATE_FAKE_EXISTING%\"==\"1\" if not exist \"%FLOWTRANSLATE_FAKE_MARKER%\" (\n"
                "    echo seen>\"%FLOWTRANSLATE_FAKE_MARKER%\"\n"
                "    echo exited^|unhealthy\n"
                "    exit /b 0\n"
                "  )\n"
                "  echo running^|healthy\n"
                "  exit /b 0\n"
                ")\n"
                "echo %*| findstr /c:\" ps \" >nul\n"
                "if not errorlevel 1 (\n"
                "  echo %*| findstr /c:\"--all\" >nul\n"
                "  if not errorlevel 1 (\n"
                "    if \"%FLOWTRANSLATE_FAKE_EXISTING%\"==\"1\" echo fake-container\n"
                "    exit /b 0\n"
                "  )\n"
                "  echo fake-container\n"
                ")\n"
                "exit /b 0\n",
                encoding="ascii",
            )
            (fixture / "python.cmd").write_text(
                "@echo off\necho python %*>>\"%FLOWTRANSLATE_FAKE_LOG%\"\nexit /b 0\n",
                encoding="ascii",
            )
            env = os.environ.copy()
            env["PATH"] = str(fixture) + os.pathsep + env["PATH"]
            env["FLOWTRANSLATE_FAKE_LOG"] = str(log)
            command = ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
                       str(Path(__file__).with_name("start.ps1")), "-Profile", "fast",
                       "-HealthDeadlineSeconds", "30", "-EnvFile", str(fixture / "absent.env")]
            result = subprocess.run(command, capture_output=True, text=True, timeout=15, env=env)
            self.assertEqual(result.returncode, 0, result.stderr or result.stdout)
            calls = log.read_text(encoding="utf-8")
            self.assertIn("up -d fast", calls)
            self.assertIn("python ", calls)
            self.assertNotIn(" stop ", calls)

            log.unlink()
            env["FLOWTRANSLATE_FAKE_EXISTING"] = "1"
            env["FLOWTRANSLATE_FAKE_MARKER"] = str(fixture / "inspect.marker")
            # Also exercise the default .env path under Windows PowerShell 5.1.
            result = subprocess.run(command[:-2], capture_output=True, text=True, timeout=15, env=env)
            self.assertEqual(result.returncode, 0, result.stderr or result.stdout)
            calls = log.read_text(encoding="utf-8")
            self.assertIn("up -d fast", calls)
            self.assertIn("python ", calls)
            self.assertNotIn(" stop ", calls)

    def test_stream_unicode_and_truncation(self):
        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            case = {"id": "test", "text": "Hello", "targetLanguage": "fr", "mustPreserve": []}
            endpoint = f"http://127.0.0.1:{server.server_port}"
            server.truncated = False
            good = translate(case, endpoint, "test-fixture", {})
            self.assertTrue(good["success"])
            self.assertEqual(good["output"], "Bonjour é")
            server.truncated = True
            bad = translate(case, endpoint, "test-fixture", {})
            self.assertFalse(bad["success"])
            self.assertEqual(bad["error"], "incomplete-generation")
        finally:
            server.shutdown()
            server.server_close()


if __name__ == "__main__":
    unittest.main()
