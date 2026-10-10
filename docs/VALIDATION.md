# Validation evidence

> Document historique (preuves 0.1.x, 10 septembre 2026) : ne décrit plus l’état actuel. État actuel : [README.md](../README.md) et [docs/BRIDGE.md](../docs/BRIDGE.md).

## Integrated 0.1.6 — glass rework, 2026-09-10

- NSIS installer `FlowTranslate_0.1.6_x64-setup.exe`, SHA-256 `594BAAED1F10D45BB75FE6E5598935C418CD5659D403243F08CECD7993643A70`, built from the 0.1.6 sources (commit recorded in the kit manifest). Packaged as `release/FlowTranslate-0.1.6-test-kit.zip` for another workstation: installer, `Mode-simule.cmd` (`--simulate-inference`), server files, trial guide, this file and the 0.1.5 measurements. Not signed.
- Integrated checks: 7 React tests, 47 Playwright tests (browser UI, IPC fixture, workbench, reported defects), 17 visual references (short, long and pending regenerated for the tighter shadow and the ring), 19 Rust unit tests, production build.
- Native WebView2 probe on the release executable (`release/ui-evidence/native-after-edges/result.json`): 3 cycles, overlay HWND without caption styles and **without window region**, `WindowFromPoint` returns the overlay on the glass and the window underneath in the halo, pass-through ex-styles set and cleared accordingly, after show and after `focus_overlay`; menus, DOM close, native windows hidden.
- The Windows session was locked during the probe (LogonUI): `SetCursorPos` and `GetCursorPos` were inert, so the hit tester was fed through the test-only `override_cursor` command (honoured only under `FLOWTRANSLATE_CDP_URL`). A manual spike on the live tab had shown the same pass-through with the real `WindowFromPoint`. Screen capture was unavailable for the same reason.
- Not declared accepted: anti-aliased corners and shadows on the real desktop, ring smoothness, click-through feel, 125/150 % DPI, and the overlay's rendering while it carries `WS_EX_LAYERED` at rest. These are the points of the 0.1.6 trial guide (`docs/ESSAIS-0.1.6.md`).

## Integrated 0.1.5 — real inference trial, 2026-09-09

- Tauri 2 Windows installer built and installed at `C:\Users\Lucas\Apps\FlowTranslate\FlowTranslate.exe`, file version 0.1.5. The desktop shortcut points to this exact executable with no demo arguments. The installed instance runs with `--settings`, without simulation. User confirmed that the settings window displays correctly.
- Installer SHA-256: `825FB9B944B3C7BA99E0B82196024F6567F2749A616A479C896A9B582E27A8FA`. Previous 0.1.4 installer and executable retained for rollback. Settings schema unchanged.
- Integrated checks: 7 React tests, 36 Playwright tests, 20 Rust unit tests, 6 server tests, production build and NSIS build pass. An additional opt-in Rust test discovers the real model, streams a complete translation, matches streamed chunks to the result, and cancels another live request after its first delta; it passes for both Fast and Quality. Its first attempt before server readiness failed at discovery and was rerun after startup.
- Astra medium frontend review preserves approved glass/animation geometry and adds active model readiness plus recoverable connection errors. Native review fixes protected-field fallback, source-window capture races, delayed focus, drag mutex reentrancy and repeated COM initialization. Browser glass inspected directly. Native accessibility exposes the installed settings and connection controls; the screenshot is black and attempted input fails with `GetCursorPos ... 0x80070005`. User confirmation covers settings display only. Native selection/drag/focus/Escape, acrylic animation and the full app/DPI matrix are not declared accepted from automated browser tests.
- Docker Desktop was recovered without reset/prune/deleting data. Broken runtime socket objects were preserved under `C:\Users\Lucas\AppData\Local\Docker\run.stale-20260909-2115`, `Docker\run\dockerInference.stale-2` and `docker-secrets-engine\engine.sock.stale-20260909`. Existing data volumes and other workloads were preserved.
- Exact pinned vLLM 0.28.0 image inspected: PyTorch 2.13.0+cu130, CUDA 13.0, both SM120 GPUs detected. Initial V2 startup failed with `UVA is not available`; using the alternative runner in the same image fixes WSL startup. Docker device IDs did not limit CUDA on WSL: explicit per-service `CUDA_VISIBLE_DEVICES` now exposes exactly one verified card to each service.
- Fast BF16 runs on RTX 5060 Ti; Quality FP8 runs on RTX 5070 Ti. Both report healthy, expose the configured model aliases, complete live streaming requests and pass the idempotent Windows startup script. The first script test found a PowerShell 5.1 parameter-default issue; default `.env` resolution was moved into the body and covered by a regression test. Documented commands use `-NoProfile`.
- **600/600 complete responses**: each model translated the same 100 balanced synthetic FR/EN excerpts at concurrency 1, 4 and 10. Timings are warmed HTTP API latency on short texts, not native UI latency or cold startup. First native requests warmed kernels for about 20 seconds; initial downloads/compilation take minutes. No human quality score or model-superiority claim is made. See [measured results](evaluation/0.1.5/README.md).
- Six scalar result summaries are versioned under `docs/evaluation/0.1.5/`. Raw synthetic outputs and review CSVs are included in the local test kit. They contain no user text. Live startup INFO was used to capture capacity; request logging remained disabled. The distributed Compose default is WARNING.

## Integrated 0.1.4 — 2026-09-09

- Refined glass by Astra high: 66% main tint, 68% accessories, shared static 32 px blur, asymmetric edge and inset depth. All approved dimensions and native region contracts preserved. Copy glyphs cross-fade within fixed bounds; menu/feedback use 140 ms fades.
- Browser visual review on light, dark and colored backgrounds succeeds. Background controls are preview-only. Integrated production build, 7 React tests and 32 Playwright tests pass. Native worktree runs 20 passing Rust tests for the exact one-function native change, which only removes unnecessary `SWP_FRAMECHANGED` calls.
- Fresh before/after Chromium rendering profile: no >50 ms tasks or >32 ms frame intervals; p95 16.7–16.8 ms after the change. See UI-PERFORMANCE.md for sample limits and raw report paths.
- NSIS build succeeds; installed executable reports 0.1.4 at `C:\Users\Lucas\Apps\FlowTranslate\FlowTranslate.exe`. Installer exits 0. SHA-256 of `release/FlowTranslate_0.1.4_x64-setup.exe`: `FE5BDBA13487406EF45BFA75C881CC99BFBDFE5B00C0F845C71FBA9974F5E8F3`. Previous installers retained.
- The pre-existing 0.1.3 demonstration instance was replaced and relaunched as 0.1.4. The installed process responds and accessibility exposes the completed translation and Copy/More controls. One demonstration instance is left running, matching the initial state.
- Actual native screenshots return a black surface, although accessibility returns text. Activation still fails with `GetCursorPos ... Accès refusé (0x80070005)`. Native visual smoothness/acrylic cannot be certified from this pass. No per-frame native alpha animation was added; DWM backdrop and WebView opacity remain distinct.
- Reproducible browser preview recording saved at `release/material-preview-0.1.4/transitions.webm`; synthetic text only. No new dependencies or inference activity.

## Integrated 0.1.3 — 2026-09-09

- Approved design C implemented by Astra high, native integration by Sol, reviewed and integrated on `feat/glass-reader`.
- Production frontend build succeeds: main JavaScript 436.21 kB (140.80 kB gzip), CSS 13.00 kB. Dependencies remain pinned; Motion/Radix/Lucide reused.
- Integrated checks: 7 React unit tests, 30 Playwright tests and 20 Rust tests pass. Browser checks include 100/125/150/200% device scale, menu anchoring, full long text via wheel/keyboard, reduced motion, source-driven reader layout, 120 delta fragments without extra streaming resize, and new capture during dismissal/presentation transitions. Browser IPC fixtures do not execute Win32.
- Browser visual review at 1280×720: 280 px glass with overlapping pill, independent context menu, bottom reader and menu above it. Measured long reading region remains `{x:385,y:435,width:510,height:234}` before/after menu opening. Fixed a context-preview menu position jump and playground controls covering the glass.
- Bounded rendering measurements are recorded in [UI-PERFORMANCE.md](UI-PERFORMANCE.md): p95 frame intervals 16.7–16.8 ms, no >32 ms intervals and no >50 ms tasks in four synthetic Chromium runs. Not native Windows FPS or GPU evidence.
- NSIS release build succeeds. Silent installation returns 0; installed executable at `C:\Users\Lucas\Apps\FlowTranslate\FlowTranslate.exe` reports version 0.1.3.
- Installer: `release/FlowTranslate_0.1.3_x64-setup.exe`, SHA-256 `1507EE629B64DE773BD86E6AAC2D9068B20CD337E7166A32D0EEF5B5B32897D4`. The previous 0.1.2 installer is retained for rollback. No settings schema change.
- Actual installed `--demo-selection` and `--demo-long` instances both respond and expose completed translation text plus Copy/More through Windows accessibility. Only one test instance was running at a time; both were stopped after inspection, leaving no overlay behind.
- Native screenshot failed twice after fresh window selection: `IGraphicsCaptureItemInterop.CreateForMonitor ... 0x80070057`. Keyboard activation also failed: `GetCursorPos ... Accès refusé (0x80070005)`. No native visual, drag, click-through, focus or Escape acceptance is claimed from this pass. These checks remain pending; no stale coordinates were used.
- CSS opacity animates the WebView; the separate Win32 acrylic backdrop can remain visible until native hide. Native dimension/movement interpolation is not implemented. Mixed-DPI/native compositing smoothness remains unverified.
- No inference workload was started or interrupted in this frontend milestone.

## Integrated 0.1.2 — 2026-09-09

- Astra high owns the frontend; minimum medium routing is recorded in AGENTS.md.
- Motion, Radix DropdownMenu/Switch and Lucide are pinned, used in the app and
  distributed with third-party license notices.
- Production build, 6 reducer tests, 19 Playwright tests and 15 Rust tests pass
  in the integrated checkout. Browser menu opening and Close observed directly.
- NSIS installer built and installed successfully at
  `C:\Users\Lucas\Apps\FlowTranslate\FlowTranslate.exe`, file version 0.1.2.
- A startup deadlock in the focus/frame callback was reproduced and fixed by
  deferring Win32 work outside the runtime's locked listener dispatch. The
  rebuilt process responds and native accessibility exposes the complete demo
  translation, Copy and More actions.
- Final native screenshot fails with `CreateForMonitor (0x80070057)` even after
  fresh window selection; attempted accessibility click fails with
  `coordinate input geometry is unavailable`. Final native frame/drag/focus and
  animation acceptance remain pending. Demo process stopped afterward.
- Local installer SHA-256:
  `9209590dc364ef22ce1c2e24c630e6186516998b9ae60647ec9baadbb238d74f`.
- No native dimension/exit animation yet; browser device-scale tests do not
  validate mixed Windows DPI. No inference measurements added in this turn.

## Executed 2026-09-08

- Private GitHub repository created and initial specification/design commit pushed.
- Model revisions and their Apache-2.0 license files retrieved from the official pinned Hugging Face artifacts. No model weights downloaded.
- vLLM image digest resolved from Docker Hub registry. `docker compose ... config --quiet` succeeds without a daemon.
- Python evaluation tests: four passing (balanced 100-case corpus, endpoint policy, prompt/percentile, Unicode streaming and truncation rejection).
- Inference preflight: **not ready**. Docker Desktop Linux engine is stopped; free VRAM approximately 0.7 GiB on RTX5070Ti and 2.3 GiB on RTX5060Ti. Existing llama-server.exe PID5040 is active. It has not been interrupted.
- Two-case real benchmark attempt exits before benchmarking because the endpoint is unavailable. No model quality/latency result exists yet.
- React production build succeeds. Six reducer tests and twelve Playwright tests pass: confirmation text, partial/error copy guards, comparison, settings/history controls, reduced motion, capsule viewport and 420 px explicit enlargement.
- CSS/browser device scale checks at 100/125/150/200% pass. These are **not** Windows mixed-DPI evidence.
- Windows Rust host compiles; fourteen Rust tests pass (SSE fragmentation/CRLF/truncation, endpoint policy, request cancellation, placement, DPAPI retention and native text patching). The additional Win32 test creates an invisible Edit control, replaces `café 😀` with `équipe 🚀` via `EM_REPLACESEL`, verifies exact UTF-16/CRLF and destroys the test window. It never touches the clipboard or user applications.
- Real Tauri debug executable launched. Synthetic selection streaming, compact bubble, menu and actual Notepad UIA capture/anchor observed. Fixed startup race by initializing state before WebViews. Fixed native enlargement shrink via `flex: none`.
- A real Notepad insertion test exposed corruption with queued Unicode keystrokes. That implementation was removed completely. Replacement now uses bounded native Edit/RichEdit messages and verifies the resulting document; a new interactive Notepad pass is still pending.
- Very short synthetic Escape presses exposed polling gaps. A scoped keyboard hook replaced sole reliance on polling; interactive recheck is pending.
- Final NSIS package rebuilt after the native replacement/Escape corrections. Silent current-user installation succeeded (exit 0), version 0.1.0, at `%LOCALAPPDATA%/FlowTranslate/FlowTranslate.exe`. Installed executable differs from the build by only the expected three-byte Tauri bundle-type marker (`UNK` → `NSS`).
- Desktop automation became unavailable during the final interactive pass: `GetCursorPos failed: Accès refusé (0x80070005)`. No further app input was attempted after recovery failed; user was asked to make the desktop available.
- Final inference preflight still blocked: Docker engine unavailable, approximately 591 MiB free on GPU0 and 2253 MiB on GPU1. Existing workloads remain untouched.

## Pending actual runtime evidence

### Follow-up 2026-09-09 — 0.1.1

- Reproduced the user's overlapping Windows caption in a real 280 px native capture.
- Revised the text/action layout; all six React tests and twelve browser tests pass. The short reference translation now occupies two lines at 280×76 px. Astra reviewed the browser render against the approved mockup.
- Native patch strips caption/frame styles and adds manual drag placement retained across result resizing. Fifteen Rust tests pass, including work-area clamping with a negative monitor origin.
- Built the 0.1.1 NSIS installer and installed it successfully at `C:\Users\Lucas\Apps\FlowTranslate\FlowTranslate.exe` (file version 0.1.1). Computer Use identifies the running process at this exact path. The previous process was actually located under `AppData\Local\Packages\OpenAI.Codex_2p2nqsd0c76g0\LocalCache\Local\FlowTranslate`, explaining the mismatch with the user's ordinary PowerShell.
- Final capture returned a black 280×76 surface while UI Automation still exposed the translation/buttons. Activation failed with `GetCursorPos failed: Accès refusé (0x80070005)`. User was asked to make the desktop available; native visual/drag acceptance is pending, not assumed from successful compilation.

- Interactive recheck of focus, clipboard preservation, replacement, rapid Escape, desktop translucency/acrylic and resize transitions.
- Edge and Chrome selection + editable fields; Word paragraphs; Outlook classic/new; Teams web/desktop. Explicitly record version and capture/replacement support per app, never infer universal support from UI Automation availability.
- Multiple monitors/negative origins and mixed100/125/150/200% DPI.
- Real model loading, FP8 behavior, concurrent1/4/10 requests and resource usage.
- Human blind review of the100 synthetic translations; no synthetic or guessed quality score is acceptable.

This file is updated as checks actually execute. Mocked responses validate interaction/protocol behavior only.
