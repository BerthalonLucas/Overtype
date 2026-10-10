# Separate vLLM server

This server does not depend on the Windows UI. `model-lock.json` records public model revisions, byte sizes, licenses and the verified vLLM 0.28.0 Docker digest. Metadata is archived under `metadata/`; no weights are committed. The two checkpoints remain candidates until GPU and quality evaluation succeeds.

## Local trial (Windows Docker Desktop / Linux engine, or a Linux GPU server)

1. Optional: copy `server/.env.example` to `server/.env`, select GPU indices/UUIDs and ports. Default Quality uses GPU 0, Fast uses GPU 1.
2. Inspect resources: `python server/preflight.py`. It reads the effective configuration from `docker compose config --format json`, with the same `-f`, `--env-file` and `--profile` arguments as `start.ps1`, and keeps only each profile's GPU and published port (the resolved model is never printed). Without the Docker CLI it falls back to its own `.env` reader (comments, quotes, `${VAR:-default}`, empty values meaning the default, process environment first) and adds the warning « valeurs lues par un sous-ensemble des règles de Compose » to its report. A nonzero exit means the trial cannot safely start yet. This command does not start Docker or stop existing processes.
3. Validate configuration: `docker compose -f server/compose.yaml --profile fast --profile quality config --quiet`.
4. Start one profile first: `docker compose -f server/compose.yaml --profile fast up -d fast`. The first start downloads the pinned image plus about 4.08 GB of weights (engine image/cache overhead is additional). Quality downloads about 8.03 GB of weights. Do not launch while the selected GPU is occupied.
5. Inspect health, then trial Quality separately. Run both only after verifying each budget. No CPU offload or tensor-parallel multi-GPU assumptions are made.
6. Client profiles: `http://127.0.0.1:8001/v1`, model `flowtranslate-fast`; `http://127.0.0.1:8002/v1`, model `flowtranslate-quality`; `http://127.0.0.1:8003/v1`, model `flowtranslate-general` (profile `general`, below).

On Windows, `powershell -NoProfile -ExecutionPolicy Bypass -File server/start.ps1 -Profile fast -HealthDeadlineSeconds 900` validates Compose and reuses an already healthy selected service. For a missing or stopped selected service it performs preflight, starts only that service, and waits for health. It fails immediately if the container exits during startup. On timeout or failure it leaves containers unchanged for inspection and never stops other workloads. Repeat with `quality` only after the Fast trial.

Normal endpoint failure never falls back to a mock or a different model. The native app's explicit `--demo` option is separate and labelled.

## General profile (0.4.0): Gemma 4 12B QAT with speculative decoding

The Hy-MT2 checkpoints only translate. Since the client runs any instruction (correct, professionalize, custom actions), `compose.yaml` adds the `general` profile: `google/gemma-4-12B-it-qat-w4a16-ct` (revision `1d2c2d7f2466070e69d6fb3fd5ce9a7d75f2f6ee`, Apache-2.0, not gated, about 10.3 GB, compressed-tensors W4A16 read natively by vLLM 0.28.0) with the matching QAT MTP draft `google/gemma-4-12B-it-qat-q4_0-unquantized-assistant` (revision `18934064dd4c5c6cc3621f6381e7d377fc8cb7bd`, about 0.9 GB) through `--speculative-config` (`num_speculative_tokens` 4; the vLLM log shows `Draft model Gemma4MTP` when it is active). Port 8003, GPU 0 by default (`GENERAL_GPU`), `--max-model-len 8192`, `--max-num-seqs 4`, `--kv-cache-dtype fp8`, images and audio disabled (`--limit-mm-per-prompt`), `--gpu-memory-utilization 0.85` (`GENERAL_GPU_MEMORY`). Start it alone with `docker compose -f server/compose.yaml --profile general up -d general` or `server/start.ps1 -Profile general`; `preflight.py` knows the profile (12.5 GiB free required). The client sends the action instruction as the system message, the text as the user message and `chat_template_kwargs: {"enable_thinking": false}` (Gemma 4 has thinking off by default; the switch is harmless). Verified on 2026-09-15: a streamed correction request returns the corrected text alone, no thinking block, 28 tokens. No quality benchmark is claimed for this profile.

## Parameters and verification

Context 8192, TP=1, at most 10 sequences. Sampling follows the inference recommendation in both pinned model cards: temperature .7, top_p .6, top_k 20, repetition penalty 1.05, max_tokens 4096. Their pinned `generation_config.json` files still say top_p .8, so the model-card recommendation is recorded as the deliberate authority here. Benchmark seed 42 is recorded. Use a single user message with the target language's full English name and the official translation-only instruction. Quantization is detected from the quality checkpoint, not forced to a different format. `HunYuanDenseV1ForCausalLM` is present in the source registry at tag v0.28.0. The complete runtime/FP8 compatibility still requires loading.

Request logs are explicitly disabled and the logging level is warning. No payload capture, access-log export or content tracing should be enabled. Only scalar timing/health metrics are appropriate. The Docker health check may take several minutes on a cold first launch.

Both profiles pass `--no-enable-flashinfer-autotune`. The negated CLI flag is documented in vLLM 0.28.0; disabling it is a local Blackwell stability workaround observed after repeated launches, not a model-card requirement or a quality/performance result.

The real WSL2 trial required `VLLM_USE_V2_MODEL_RUNNER=0`: the default V2 runner
failed with `RuntimeError: UVA is not available`. This selects the alternative
runner bundled in the same stable image. Docker/WSL also exposed both cards
despite `device_ids`; Compose therefore requests GPU access and restricts CUDA
with `CUDA_VISIBLE_DEVICES` for each service. Fast sees only the RTX 5060 Ti,
Quality only the RTX 5070 Ti on the trial host. Prefer GPU UUIDs in `.env` when
moving to another machine. CUDA visibility is allocation control, not a security
boundary between containers.

First measurements used an ignored Compose override setting startup logging to
INFO to record KV cache capacity. Request/content logging stayed disabled. The
distributed configuration keeps WARNING as its default.

Primary verification: [Fast model card at the pinned revision](https://huggingface.co/tencent/Hy-MT2-1.8B/blob/9a341cd1b679d3efd23b46e847b01745a71ed792/README.md), [Quality model card at the pinned revision](https://huggingface.co/tencent/Hy-MT2-7B-FP8/blob/883d09eb21d9be92058556cd0a4016d8a648c7db/README.md), [vLLM 0.28.0 serve flags](https://docs.vllm.ai/en/v0.28.0/cli/serve/), and [vLLM 0.28.0 model registry](https://github.com/vllm-project/vllm/blob/v0.28.0/vllm/model_executor/models/registry.py).

## Enterprise deployment

Move this configuration to a Linux GPU host; the client still uses the same OpenAI contract. Keep engine ports private. Expose only the required `/v1/models` and `/v1/chat/completions` routes through the company's HTTPS/authenticated reverse proxy, with per-user access control, request size limits and no body logging. Do not expose the entire vLLM API publicly or rely solely on its API-key switch. Configure the authenticated HTTPS endpoint/key under client advanced settings. Provision certificates/identity in the enterprise environment rather than committing private keys here.

## Stop and rollback

`docker compose -f server/compose.yaml --profile fast --profile quality down` stops only this Compose project. Do not use `-v`: retaining volumes preserves downloaded weights and compile caches. To roll back, check out the previous release tag and start its pinned configuration; no automatic latest/nightly upgrades occur. Update profiles only after a new validation report.

## Metadata archive (manual tool)

`python server/fetch_metadata.py` is run by hand, never by the app, `start.ps1` or CI. For every profile in `model-lock.json` it downloads `config.json`, `generation_config.json` and `LICENSE.txt` from Hugging Face at the pinned revision (1 MB limit per file, never weights), refuses a `LICENSE.txt` that does not contain the Apache License text, and writes them with a `checksums.json` (SHA-256) under `metadata/<profile>/`. It needs network access and overwrites the archived files; review the diff before committing.

## Evaluation

Use the synthetic 100-case corpus and `evaluate.py` after a server is healthy. Outputs stay in ignored `results/`; never substitute real confidential messages into the committed corpus. Human fidelity/fluency review remains necessary; preservation checks and latency are not a claim of translation superiority.

Run each profile at concurrency 1, 4 and 10, for example:

```powershell
python server/evaluate.py --profile fast --concurrency 1 --measure-local-gpu
python server/evaluate.py --profile fast --concurrency 4 --measure-local-gpu
python server/evaluate.py --profile fast --concurrency 10 --measure-local-gpu
```

Repeat with `--profile quality`, and `--profile general` (offered because it exists in `model-lock.json`; it uses that profile's own `generation` block). Streams are decoded per SSE event (multi-line `data:` fields are joined); a malformed event counts as a stream error. Use `--measure-local-gpu` only on the inference
host: it samples total device VRAM once per second, including other processes,
and reports baseline/peak MiB and availability. It is not a per-model allocation
measurement and may miss peaks shorter than the sample interval. Without the
flag or NVIDIA tooling, memory is explicitly unavailable, never reported as zero.
