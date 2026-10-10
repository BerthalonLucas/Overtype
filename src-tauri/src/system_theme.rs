// Windows app mode (light or dark) for the « follow Windows » theme. In this app's WebView2
// `prefers-color-scheme` stays light whatever Windows says (measured on 2026-09-24 in the
// packaged window: apps in dark mode, media query light), so Rust reads the value the
// Settings app writes and tells every window when it changes.
use tauri::{AppHandle, Emitter};

#[derive(Clone, serde::Serialize)]
pub struct SystemTheme {
    pub dark: bool,
}

#[cfg(windows)]
mod imp {
    use windows::core::{w, PCWSTR};
    use windows::Win32::System::Registry::{
        RegCloseKey, RegGetValueW, RegNotifyChangeKeyValue, RegOpenKeyExW, HKEY, HKEY_CURRENT_USER,
        KEY_NOTIFY, REG_NOTIFY_CHANGE_LAST_SET, RRF_RT_REG_DWORD,
    };

    const PERSONALIZE: PCWSTR =
        w!("Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize");

    // None when the value is missing (older Windows, policies): the front keeps its media query.
    pub fn dark() -> Option<bool> {
        let mut value = 0u32;
        let mut size = std::mem::size_of::<u32>() as u32;
        let status = unsafe {
            RegGetValueW(
                HKEY_CURRENT_USER,
                PERSONALIZE,
                w!("AppsUseLightTheme"),
                RRF_RT_REG_DWORD,
                None,
                Some(&mut value as *mut u32 as *mut _),
                Some(&mut size),
            )
        };
        status.is_ok().then_some(value == 0)
    }

    // Blocks on the key's change notification: no polling, one thread for the process.
    pub fn watch(on_change: impl Fn() + Send + 'static) {
        std::thread::spawn(move || unsafe {
            let mut key = HKEY::default();
            if RegOpenKeyExW(HKEY_CURRENT_USER, PERSONALIZE, None, KEY_NOTIFY, &mut key).is_err() {
                return;
            }
            while RegNotifyChangeKeyValue(key, false, REG_NOTIFY_CHANGE_LAST_SET, None, false)
                .is_ok()
            {
                on_change();
            }
            let _ = RegCloseKey(key);
        });
    }
}

#[cfg(not(windows))]
mod imp {
    pub fn dark() -> Option<bool> {
        None
    }
    pub fn watch(_: impl Fn() + Send + 'static) {}
}

pub fn current() -> Option<SystemTheme> {
    imp::dark().map(|dark| SystemTheme { dark })
}

// Emits `system-theme` to every window when the app mode flips; other values of the key
// (accent colour, transparency) change nothing.
pub fn watch(app: AppHandle) {
    let last = std::sync::Mutex::new(imp::dark());
    imp::watch(move || {
        let now = imp::dark();
        let Ok(mut last) = last.lock() else { return };
        if *last == now {
            return;
        }
        *last = now;
        if let Some(dark) = now {
            let _ = app.emit("system-theme", SystemTheme { dark });
        }
    });
}
