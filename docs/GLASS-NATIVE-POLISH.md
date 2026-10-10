# Native glass polish audit

> Document historique (audit du verre natif 0.1.x, 9 septembre 2026) : ne décrit plus l’état actuel. État actuel : [README.md](../README.md) et [docs/BRIDGE.md](../docs/BRIDGE.md).

`host::show` previously sent `SWP_FRAMECHANGED` for every applied geometry. That flag asks Windows to recalculate the non-client area even when the window style is already frameless. The placement cache limits identical calls, but genuine content-size changes still took this unnecessary path. The flag is now included only when `strip_chrome_hwnd` actually removed caption-producing styles. Topmost placement, no-activation behavior, visibility and the HRGN union are unchanged.

The native acrylic and the translucent CSS surface are complementary layers rather than two blur operations. In `window-vibrancy 0.6.0`, `apply_acrylic` uses `DWMWA_SYSTEMBACKDROP_TYPE` on supported Windows 11 versions; its optional color is only passed to the older `SetWindowCompositionAttribute` fallback. Changing the current Tauri color therefore cannot reliably make modern Windows acrylic subtler, while removing the CSS surface would remove the controlled tint and contrast.

No native per-frame opacity animation was added. CSS opacity affects WebView content, while the DWM acrylic backdrop remains owned by the native window until it is hidden. Coordinated native alpha animation would need runtime visual validation and is outside this bounded change.
