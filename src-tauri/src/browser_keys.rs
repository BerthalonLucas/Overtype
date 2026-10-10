//! The browser accelerators of our WebViews (review of da-ilot, front n°2). WebView2 keeps
//! them by default: with the Îlot focused, F5 or Ctrl+R reload the overlay page, which then
//! knows nothing of the capture on screen; Ctrl+P prints, Ctrl+F finds, Ctrl+Plus zooms.
//! wry can turn them off (`AreBrowserAcceleratorKeysEnabled`), Tauri 2.11 does not expose it,
//! and its WebView2 bindings live in a crate this one does not depend on. So the setting is
//! reached through COM with the `windows` crate already here: ICoreWebView2Settings3 asked
//! by its IID, its put method called at its place in the vtable. Editing keys (copy, paste,
//! undo, select all, arrows) stay; WebView2 applies the change from the next navigation.
use std::ffi::c_void;
use tauri::WebviewWindow;
use windows::core::{IUnknown, Interface, GUID, HRESULT};

/// IID_ICoreWebView2Settings3 (WebView2 1.0.864.35 and later).
const SETTINGS3: GUID = GUID::from_u128(0xfdb5ab74_af33_4854_84f0_0a631deb5eba);
/// put_AreBrowserAcceleratorKeysEnabled in the vtable of ICoreWebView2Settings3: IUnknown's
/// three methods, the 18 of ICoreWebView2Settings (9 properties), the 2 of Settings2
/// (UserAgent), then get (23) and put (24). A published COM interface never changes.
const PUT_BROWSER_KEYS: usize = 24;

/// Turns the browser accelerators of `window`'s WebView off (on the main thread, later).
pub fn disable(window: &WebviewWindow) {
    let _ = window.with_webview(|webview| {
        let controller = webview.controller();
        let Ok(core) = (unsafe { controller.CoreWebView2() }) else {
            return;
        };
        let Ok(settings) = (unsafe { core.Settings() }) else {
            return;
        };
        // `settings` holds its reference while its raw pointer is used.
        let _ = unsafe { set_enabled(com_pointer(&settings), false) };
    });
}

/// The COM pointer inside a windows-rs interface value of any version (a transparent,
/// non-null pointer); null for anything else.
fn com_pointer<T>(interface: &T) -> *mut c_void {
    if std::mem::size_of::<T>() != std::mem::size_of::<*mut c_void>() {
        return std::ptr::null_mut();
    }
    unsafe { std::mem::transmute_copy(interface) }
}

/// Sets AreBrowserAcceleratorKeysEnabled on the ICoreWebView2Settings at `settings`. False
/// when the runtime lacks ICoreWebView2Settings3 or refuses the value.
///
/// # Safety
/// `settings` is null or a live COM object implementing ICoreWebView2Settings.
unsafe fn set_enabled(settings: *mut c_void, enabled: bool) -> bool {
    let Some(unknown) = (unsafe { IUnknown::from_raw_borrowed(&settings) }) else {
        return false;
    };
    let mut raw = std::ptr::null_mut();
    if unsafe { unknown.query(&SETTINGS3, &mut raw) }.is_err() || raw.is_null() {
        return false;
    }
    // Released when dropped.
    let settings3 = unsafe { IUnknown::from_raw(raw) };
    type Put = unsafe extern "system" fn(*mut c_void, i32) -> HRESULT;
    let vtable = unsafe { *(settings3.as_raw() as *const *const Put) };
    let put = unsafe { *vtable.add(PUT_BROWSER_KEYS) };
    unsafe { put(settings3.as_raw(), i32::from(enabled)) }.is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::Cell;
    use windows::Win32::Foundation::{E_NOINTERFACE, S_OK};

    /// A stand-in for WebView2's settings object: answers IUnknown and, when `has3`,
    /// ICoreWebView2Settings3; its vtable records what reaches slot 24 and counts references.
    #[repr(C)]
    struct Fake {
        vtable: *const [usize; 25],
        has3: bool,
        refs: Cell<u32>,
        put: Cell<Option<i32>>,
    }
    unsafe extern "system" fn query(
        this: *mut c_void,
        iid: *const GUID,
        out: *mut *mut c_void,
    ) -> HRESULT {
        let fake = unsafe { &*(this as *const Fake) };
        let iid = unsafe { *iid };
        if iid == IUnknown::IID || (fake.has3 && iid == SETTINGS3) {
            fake.refs.set(fake.refs.get() + 1);
            unsafe { *out = this };
            S_OK
        } else {
            unsafe { *out = std::ptr::null_mut() };
            E_NOINTERFACE
        }
    }
    unsafe extern "system" fn add_ref(this: *mut c_void) -> u32 {
        let fake = unsafe { &*(this as *const Fake) };
        fake.refs.set(fake.refs.get() + 1);
        fake.refs.get()
    }
    unsafe extern "system" fn release(this: *mut c_void) -> u32 {
        let fake = unsafe { &*(this as *const Fake) };
        fake.refs.set(fake.refs.get() - 1);
        fake.refs.get()
    }
    unsafe extern "system" fn put(this: *mut c_void, value: i32) -> HRESULT {
        unsafe { &*(this as *const Fake) }.put.set(Some(value));
        S_OK
    }
    unsafe extern "system" fn other(_: *mut c_void) -> HRESULT {
        panic!("only IUnknown and slot 24 are called")
    }

    fn vtable() -> [usize; 25] {
        let mut slots = [other as *const () as usize; 25];
        slots[0] = query as *const () as usize;
        slots[1] = add_ref as *const () as usize;
        slots[2] = release as *const () as usize;
        slots[PUT_BROWSER_KEYS] = put as *const () as usize;
        slots
    }

    #[test]
    fn the_browser_keys_are_turned_off_through_settings3_slot_24_and_the_reference_released() {
        let slots = vtable();
        let fake = Fake {
            vtable: &slots,
            has3: true,
            refs: Cell::new(1),
            put: Cell::new(None),
        };
        assert!(unsafe { set_enabled(&fake as *const Fake as *mut c_void, false) });
        assert_eq!(
            fake.put.get(),
            Some(0),
            "FALSE reached put_AreBrowserAcceleratorKeysEnabled"
        );
        assert_eq!(fake.refs.get(), 1, "the queried interface is released");
        // An older runtime without ICoreWebView2Settings3: nothing is called.
        let old = Fake {
            vtable: &slots,
            has3: false,
            refs: Cell::new(1),
            put: Cell::new(None),
        };
        assert!(!unsafe { set_enabled(&old as *const Fake as *mut c_void, false) });
        assert_eq!((old.put.get(), old.refs.get()), (None, 1));
        assert!(!unsafe { set_enabled(std::ptr::null_mut(), false) });
        // The pointer inside an interface value, and nothing for a value of another size.
        let unknown =
            unsafe { IUnknown::from_raw_borrowed(&(&fake as *const Fake as *mut c_void)) }
                .unwrap()
                .clone();
        assert_eq!(com_pointer(&unknown), &fake as *const Fake as *mut c_void);
        drop(unknown);
        assert!(com_pointer(&(1u8, 2u64, 3u64)).is_null());
        assert_eq!(fake.refs.get(), 1);
    }
}
