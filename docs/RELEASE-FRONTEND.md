# Frontend readiness pass for 0.1.5

> Document historique (publication 0.1.5, 9 septembre 2026) : ne décrit plus l’état actuel. État actuel : [README.md](../README.md) et [docs/BRIDGE.md](../docs/BRIDGE.md).

The settings window shows the selected engine and model before advanced configuration is opened. Its explicit save-and-check action uses the existing check_connection command only; opening settings never probes the network and a connection check never requests translation. The result is associated with the checked profile and ceases to apply after editing that profile. Browser checks remain explicitly simulated. A failed check preserves the saved settings and explains how to start the server and inspect the address/model/key.

Settings loading failures now replace the loading message with a retry and close action. Translation failures keep Copy disabled and expose Retry plus Settings through the existing overlapping action menu. The browser Settings menu and close action now navigate to the settings/preview screens. Initialization error UI includes retry, settings, and close actions; its visibility in a native window before capture/geometry is not established by browser tests.

Validation: npm ci (0 audit vulnerabilities), npm run build, npm test (7 passed), and full Playwright on isolated port 5177 (36 passed). Added browser/IPC-fixture cases cover settings-load recovery, target-language and engine choice, failed then successful connection checks, invalidation after profile edits, save/close without translate, translation retry and settings menu, and browser simulated-check labeling. Existing compact bubble, 560px reader, pill geometry, focus, animations, scaling and history tests remain passing. Reviewed the generated settings screenshot.

These are browser component and mocked IPC checks, not native Windows or real inference verification. No native application was launched or closed; no user configuration or GPU process was touched. The Playwright-owned preview server exits after the run.
