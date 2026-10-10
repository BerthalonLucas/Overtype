//! Until 0.5.1 the app was called FlowTranslate, and « launch at sign-in » is a value of the
//! `Run` key named after the app that holds the path of its executable. The installer of 0.6
//! carries it over (`windows/hooks.nsh`); this is the same repair for an executable that was
//! not installed that way: the stale value is removed, and the caller registers the new one
//! when the settings ask for autostart.
use windows::{
    core::HSTRING,
    Win32::{
        Foundation::ERROR_SUCCESS,
        System::Registry::{RegDeleteKeyValueW, RegGetValueW, HKEY_CURRENT_USER, RRF_RT_REG_SZ},
    },
};

const LEGACY_NAME: &str = "FlowTranslate";
const RUN: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
const APPROVED: &str = r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run";

/// Removes the autostart entry of the old name. `true` when there was one.
pub fn take() -> bool {
    let found = take_in(RUN, LEGACY_NAME);
    // The « Startup apps » switch of Windows for that entry, if any.
    unsafe {
        let _ = RegDeleteKeyValueW(
            HKEY_CURRENT_USER,
            &HSTRING::from(APPROVED),
            &HSTRING::from(LEGACY_NAME),
        );
    }
    found
}

fn take_in(key: &str, name: &str) -> bool {
    let (key, name) = (HSTRING::from(key), HSTRING::from(name));
    unsafe {
        let mut size = 0u32;
        if RegGetValueW(
            HKEY_CURRENT_USER,
            &key,
            &name,
            RRF_RT_REG_SZ,
            None,
            None,
            Some(&mut size),
        ) != ERROR_SUCCESS
        {
            return false;
        }
        RegDeleteKeyValueW(HKEY_CURRENT_USER, &key, &name) == ERROR_SUCCESS
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use windows::Win32::System::Registry::{RegDeleteTreeW, RegSetKeyValueW, REG_SZ};

    #[test]
    fn the_old_entry_is_removed_once_and_its_neighbours_are_kept() {
        let key = format!(r"Software\OvertypeTests\{}", uuid::Uuid::new_v4());
        let write = |name: &str| unsafe {
            let data: Vec<u16> = "C:\\old\\FlowTranslate.exe \0".encode_utf16().collect();
            let done = RegSetKeyValueW(
                HKEY_CURRENT_USER,
                &HSTRING::from(key.as_str()),
                &HSTRING::from(name),
                REG_SZ.0,
                Some(data.as_ptr().cast()),
                (data.len() * 2) as u32,
            );
            assert_eq!(done, ERROR_SUCCESS);
        };
        write(LEGACY_NAME);
        write("Other");
        assert!(take_in(&key, LEGACY_NAME));
        assert!(!take_in(&key, LEGACY_NAME), "nothing left the second time");
        assert!(
            take_in(&key, "Other"),
            "another app's entry was not touched"
        );
        assert!(!take_in(r"Software\OvertypeTests\absent", LEGACY_NAME));
        unsafe {
            let _ = RegDeleteTreeW(HKEY_CURRENT_USER, &HSTRING::from(key.as_str()));
            let _ = windows::Win32::System::Registry::RegDeleteKeyW(
                HKEY_CURRENT_USER,
                &HSTRING::from(r"Software\OvertypeTests"),
            );
        }
    }
}
