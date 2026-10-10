// Whether Windows asks to reduce animations (Accessibility > Visual effects > « Effets
// d'animation », SPI_GETCLIENTAREAANIMATION) for the « Animations : suivre Windows » setting.
// Read here instead of trusting prefers-reduced-motion: in this app's WebView2
// prefers-color-scheme does not follow Windows (lot 1, system_theme.rs on da-ilot), and
// whether prefers-reduced-motion follows « Effets d'animation » has not been measured.
use tauri::{AppHandle, Emitter};

#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize)]
pub struct SystemMotion {
    pub reduced: bool,
}

#[cfg(windows)]
mod imp {
    use std::sync::OnceLock;
    use windows::core::{w, BOOL};
    use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
    use windows::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows::Win32::UI::WindowsAndMessaging::{
        CreateWindowExW, DefWindowProcW, DispatchMessageW, GetMessageW, RegisterClassW,
        SystemParametersInfoW, MSG, SPI_GETCLIENTAREAANIMATION,
        SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS, WM_SETTINGCHANGE, WNDCLASSW, WS_EX_TOOLWINDOW,
        WS_POPUP,
    };

    // None when Windows does not answer: the front keeps prefers-reduced-motion.
    pub fn animations_on() -> Option<bool> {
        let mut on = BOOL(1);
        unsafe {
            SystemParametersInfoW(
                SPI_GETCLIENTAREAANIMATION,
                0,
                Some(&mut on as *mut BOOL as *mut _),
                SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS(0),
            )
        }
        .ok()?;
        Some(on.as_bool())
    }

    static ON_CHANGE: OnceLock<Box<dyn Fn() + Send + Sync>> = OnceLock::new();

    unsafe extern "system" fn proc(
        hwnd: HWND,
        message: u32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        if message == WM_SETTINGCHANGE {
            if let Some(on_change) = ON_CHANGE.get() {
                on_change();
            }
        }
        unsafe { DefWindowProcW(hwnd, message, wparam, lparam) }
    }

    // Windows broadcasts WM_SETTINGCHANGE to top-level windows only, never to message-only ones,
    // so this is a hidden, never shown, top-level window on its own thread. Every broadcast
    // re-reads the value (the caller drops the ones that change nothing): the wParam the
    // Settings app sends for this switch has not been observed.
    pub fn watch(on_change: impl Fn() + Send + Sync + 'static) {
        if ON_CHANGE.set(Box::new(on_change)).is_err() {
            return;
        }
        let _ = std::thread::Builder::new()
            .name("system-motion".into())
            .spawn(|| unsafe {
                let Ok(module) = GetModuleHandleW(None) else {
                    return;
                };
                let class = WNDCLASSW {
                    lpfnWndProc: Some(proc),
                    hInstance: module.into(),
                    lpszClassName: w!("FlowTranslateSystemMotion"),
                    ..Default::default()
                };
                if RegisterClassW(&class) == 0 {
                    return;
                }
                let Ok(_window) = CreateWindowExW(
                    WS_EX_TOOLWINDOW,
                    w!("FlowTranslateSystemMotion"),
                    w!(""),
                    WS_POPUP,
                    0,
                    0,
                    0,
                    0,
                    None,
                    None,
                    Some(module.into()),
                    None,
                ) else {
                    return;
                };
                let mut message = MSG::default();
                while GetMessageW(&mut message, None, 0, 0).0 > 0 {
                    DispatchMessageW(&message);
                }
            });
    }
}

#[cfg(not(windows))]
mod imp {
    pub fn animations_on() -> Option<bool> {
        None
    }
    pub fn watch(_: impl Fn() + Send + Sync + 'static) {}
}

pub fn current() -> Option<SystemMotion> {
    imp::animations_on().map(|on| SystemMotion { reduced: !on })
}

// Emits `system-motion` to every window when « Effets d'animation » flips; the other settings
// that WM_SETTINGCHANGE announces change nothing.
pub fn watch(app: AppHandle) {
    let last = std::sync::Mutex::new(current());
    imp::watch(move || {
        let now = current();
        let Ok(mut last) = last.lock() else { return };
        if *last == now {
            return;
        }
        *last = now;
        if let Some(motion) = now {
            let _ = app.emit("system-motion", motion);
        }
    });
}

#[cfg(test)]
mod tests {
    // Read-only: the switch is never changed by a test.
    #[cfg(windows)]
    #[test]
    fn windows_answers_whether_animations_are_on() {
        assert!(super::current().is_some());
    }
}
