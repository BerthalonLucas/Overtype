//! Windows geometry only: UIA rectangles and Win32 placement stay physical.
use crate::types::{Rect, SurfaceRegion};
use std::sync::atomic::{AtomicBool, AtomicIsize, AtomicU32, AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, PhysicalPosition, PhysicalSize, WebviewWindow};
use tauri::window::{Color, Effect, EffectsBuilder};
use windows::core::{s, w, BOOL};
use windows::Win32::System::DataExchange::GetClipboardSequenceNumber;
use windows::Win32::System::LibraryLoader::{GetModuleHandleW, GetProcAddress};
use windows::Win32::{
    Foundation::{HWND, LPARAM, LRESULT, POINT, RECT, WPARAM},
    Graphics::Gdi::{ClientToScreen, GetMonitorInfoW, MonitorFromPoint, HMONITOR, MONITORINFO, MONITOR_DEFAULTTONEAREST},
    UI::{
        HiDpi::{GetDpiForMonitor, MDT_EFFECTIVE_DPI},
        Input::KeyboardAndMouse::{
            GetAsyncKeyState, GetKeyboardLayout, MapVirtualKeyExW, MapVirtualKeyW, SendInput, ToUnicodeEx, HKL, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT,
            KEYEVENTF_EXTENDEDKEY, KEYEVENTF_KEYUP, KEYEVENTF_SCANCODE, MAPVK_VK_TO_VSC, VIRTUAL_KEY, VK_CONTROL, VK_ESCAPE,
            VK_INSERT, VK_LBUTTON, VK_LCONTROL, VK_LMENU, VK_LSHIFT, VK_LWIN, VK_MENU, VK_RWIN, VK_SHIFT, VK_V,
        },
        Shell::{DefSubclassProc, SetWindowSubclass},
        WindowsAndMessaging::{
            GetClassNameW, GetCursorPos, GetForegroundWindow, GetGUIThreadInfo, GetWindowLongPtrW, GetWindowRect,
            GetWindowThreadProcessId, IsWindow, IsWindowVisible, GUITHREADINFO,
            SetForegroundWindow, SetWindowLongPtrW, ShowWindow, SW_HIDE,
            SetWindowPos, GWL_EXSTYLE, GWL_STYLE, HWND_TOPMOST, MA_NOACTIVATE, SWP_FRAMECHANGED, SWP_NOACTIVATE,
            SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER, SWP_SHOWWINDOW, WM_MOUSEACTIVATE, WM_NCACTIVATE, WM_NCPAINT,
            WS_CAPTION, WS_EX_APPWINDOW, WS_EX_LAYERED, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW, WS_EX_TRANSPARENT, WS_MAXIMIZEBOX, WS_MINIMIZEBOX,
            WS_SYSMENU, WS_THICKFRAME,
        },
    },
};

// Undocumented UxTheme requests to draw the caption or the frame (0x00AE / 0x00AF).
const WM_NCUAHDRAWCAPTION: u32 = 0x00AE;
const WM_NCUAHDRAWFRAME: u32 = 0x00AF;
const SILENT_FRAME_SUBCLASS: usize = 0x466C_6F77;

// Reproduced on 2026-09-13 (release/ui-evidence/band-repro): every activation change made
// DefWindowProc paint a basic title band over the top of the frameless overlay, caption
// styles or not, and nothing repainted it before the next resize. The same message with
// lParam = -1 (« do not repaint ») painted nothing. This subclass is installed after Tao's,
// so comctl32 calls it first: WM_NCACTIVATE still reaches Tao (activation bookkeeping,
// Focused events) but DefWindowProc receives -1; the non-client paint requests are dropped.
// Once an Îlot choice is made (lot 3), a click must never activate the overlay again:
// WM_MOUSEACTIVATE answers MA_NOACTIVATE while `set_no_activate` holds (the click itself
// still reaches the WebView).
unsafe extern "system" fn silent_frame_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
    _id: usize,
    _data: usize,
) -> LRESULT {
    unsafe {
        match msg {
            WM_NCACTIVATE => DefSubclassProc(hwnd, msg, wparam, LPARAM(-1)),
            WM_NCPAINT | WM_NCUAHDRAWCAPTION | WM_NCUAHDRAWFRAME => LRESULT(0),
            WM_MOUSEACTIVATE if no_activate_applies(hwnd.0 as isize) => LRESULT(MA_NOACTIVATE as isize),
            _ => DefSubclassProc(hwnd, msg, wparam, lparam),
        }
    }
}

/// Keeps Windows from ever painting a frame on this window. Call from the window's thread.
pub fn silence_frame(window: &WebviewWindow) -> Result<(), String> {
    let hwnd = HWND(window.hwnd().map_err(|_| "Fenêtre indisponible.".to_string())?.0);
    unsafe {
        SetWindowSubclass(hwnd, Some(silent_frame_proc), SILENT_FRAME_SUBCLASS, 0)
            .ok()
            .map_err(|_| "Cadre natif non neutralisé.".to_string())
    }
}

/// Material behind the glass. `DWMWA_SYSTEMBACKDROP_TYPE` (Tauri's `Effect::Acrylic`
/// on Windows 11) paints the material behind the *entire window bounds*, so the
/// window region never clips it: that was the grey frame around the bubble. Any
/// material also shows through DOM fades. The glass therefore paints itself (no
/// material); `FLOWTRANSLATE_GLASS=blur|acrylic|dwm` remains for experiments.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Glass { Blur, Acrylic, Dwm, None }

pub fn glass_mode() -> Glass {
    match std::env::var("FLOWTRANSLATE_GLASS").as_deref() {
        Ok("dwm") => Glass::Dwm,
        Ok("acrylic") => Glass::Acrylic,
        Ok("blur") => Glass::Blur,
        _ => Glass::None,
    }
}

#[repr(C)]
struct AccentPolicy { state: u32, flags: u32, gradient: u32, animation: u32 }
#[repr(C)]
struct CompositionAttribute { attribute: u32, data: *mut core::ffi::c_void, size: usize }

unsafe fn set_accent(hwnd: HWND, state: u32, flags: u32, gradient: u32) {
    type SetWindowCompositionAttribute = unsafe extern "system" fn(HWND, *mut CompositionAttribute) -> BOOL;
    unsafe {
        let Ok(user32) = GetModuleHandleW(w!("user32.dll")) else { return };
        let Some(entry) = GetProcAddress(user32, s!("SetWindowCompositionAttribute")) else { return };
        let set: SetWindowCompositionAttribute = std::mem::transmute(entry);
        let mut policy = AccentPolicy { state, flags, gradient, animation: 0 };
        let mut data = CompositionAttribute { attribute: 19, data: &mut policy as *mut _ as _, size: std::mem::size_of::<AccentPolicy>() };
        let _ = set(hwnd, &mut data);
    }
}

pub fn apply_glass(window: &WebviewWindow) {
    let hwnd = HWND(handle(window) as *mut _);
    // ABGR tint packed as r | g << 8 | b << 16 | a << 24 (graphite, light alpha).
    let tint = 29u32 | (31u32 << 8) | (36u32 << 16) | (48u32 << 24);
    match glass_mode() {
        Glass::Dwm => { let _ = window.set_effects(EffectsBuilder::new().effect(Effect::Acrylic).color(Color(29, 31, 36, 30)).build()); }
        Glass::Acrylic => unsafe { set_accent(hwnd, 4, 0, tint) },
        Glass::Blur => unsafe { set_accent(hwnd, 3, 2, tint) },
        Glass::None => {}
    }
}

/// The language Windows shows its own interface in, as far as the app speaks it: French, or
/// English for any other (a fresh install starts in it; docs/PLAN-0.6.md §1.1).
pub fn windows_language() -> crate::types::Language {
    #[link(name = "kernel32")]
    unsafe extern "system" {
        fn GetUserDefaultUILanguage() -> u16;
    }
    language_of(unsafe { GetUserDefaultUILanguage() })
}
/// A Windows LANGID: its ten low bits name the language (0x0C: French, whatever the country).
pub fn language_of(langid: u16) -> crate::types::Language {
    if langid & 0x3ff == 0x0c { crate::types::Language::Fr } else { crate::types::Language::En }
}

pub fn foreground() -> isize {
    unsafe { GetForegroundWindow().0 as isize }
}
/// The class name of a window (empty when it is gone).
pub fn window_class(handle: isize) -> String {
    let mut class = [0u16; 256];
    let len = unsafe { GetClassNameW(HWND(handle as *mut _), &mut class) };
    if len <= 0 { return String::new(); }
    String::from_utf16_lossy(&class[..len as usize])
}
/// Windows consoles: Ctrl+Insert copies a selection there but Ctrl+V never replaces one.
pub fn is_console_class(class: &str) -> bool {
    matches!(class, "ConsoleWindowClass" | "CASCADIA_HOSTING_WINDOW_CLASS")
}
/// The control that has the keyboard focus in the thread of `source`, with its class.
pub fn focused_control(source: isize) -> Option<(isize, String)> {
    let thread = unsafe { GetWindowThreadProcessId(HWND(source as *mut _), None) };
    if thread == 0 { return None; }
    let mut info = GUITHREADINFO { cbSize: std::mem::size_of::<GUITHREADINFO>() as u32, ..Default::default() };
    unsafe { GetGUIThreadInfo(thread, &mut info).ok()?; }
    if info.hwndFocus.0.is_null() { return None; }
    let handle = info.hwndFocus.0 as isize;
    Some((handle, window_class(handle)))
}
pub fn window_rect(handle: isize) -> Option<Rect> {
    let mut r = RECT::default();
    unsafe {
        GetWindowRect(HWND(handle as *mut _), &mut r).ok()?;
    }
    Some(Rect {
        x: r.left as f64,
        y: r.top as f64,
        width: (r.right - r.left) as f64,
        height: (r.bottom - r.top) as f64,
    })
}
pub fn escape_down() -> bool {
    unsafe { GetAsyncKeyState(VK_ESCAPE.0 as i32) < 0 }
}

static ESCAPE_PENDING:AtomicBool=AtomicBool::new(false);
static OVERLAY_VISIBLE:AtomicBool=AtomicBool::new(false);
static SOURCE:AtomicIsize=AtomicIsize::new(0);
static OVERLAY:AtomicIsize=AtomicIsize::new(0);
/// The Îlot menu is open and waits for a choice (lot 3): its keys belong to the frontend.
static MENU_OPEN:AtomicBool=AtomicBool::new(false);
/// The overlay held the foreground for this menu (review of da-ilot, n°2 and n°6): the keys of
/// the source are then the user's again, the hook's fallback only serves a refused activation.
static MENU_FOCUSED:AtomicBool=AtomicBool::new(false);
/// Where the hook hands the menu keys it took from the source (a worker emits them).
static MENU_KEYS:OnceLock<std::sync::mpsc::SyncSender<MenuKey>>=OnceLock::new();
/// After a paste the Îlot can undo (lot 9): the source window whose keys end that offer. A
/// key that is not ours reaching it (the user types, or another tool does) is reported once.
static UNDO_WATCH:AtomicBool=AtomicBool::new(false);
static UNDO_SOURCE:AtomicIsize=AtomicIsize::new(0);
static TYPED:OnceLock<std::sync::mpsc::SyncSender<Typed>>=OnceLock::new();
/// Our own synthetic keys carry this in `dwExtraInfo`: the hook tells them from the user's.
pub const OUR_KEYS:usize=0x464C_5754;

/// A key that reached the source while Undo was offered: the user's own Ctrl+Z (the
/// application undoes the paste itself), or any other key.
#[derive(Clone,Copy,Debug,PartialEq,Eq)]
pub enum Typed{UndoKey,Other}
pub fn arm_undo_watch(source:isize){UNDO_SOURCE.store(source,Ordering::Relaxed);UNDO_WATCH.store(source!=0,Ordering::Release);}
pub fn disarm_undo_watch(){UNDO_WATCH.store(false,Ordering::Release);}

/// Whether a key down ends the Undo offer: not one of ours, not a lone modifier or lock
/// key, not Escape (it closes the pill; it writes nothing).
pub fn ends_undo(vk:u32,extra:usize)->bool{
    extra!=OUR_KEYS&&!matches!(vk,0x10..=0x12|0x14|0x1B|0x5B|0x5C|0x90|0x91|0xA0..=0xA5)
}

/// The marks of a paste (« mise en valeur », Lucas 25/09) last until the user's next action:
/// a key that is not ours, a click or the wheel anywhere but on our pill. Keys come through
/// the keyboard hook; clicks and the wheel through a mouse hook that only lives while the
/// marks show, on its own thread (a low-level mouse hook sees every move: none stays
/// installed for nothing). The action is reported once per arming.
static MARKS_WATCH:AtomicBool=AtomicBool::new(false);
static MARKS_OVERLAY:AtomicIsize=AtomicIsize::new(0);
static MARKS_ENDED:OnceLock<std::sync::mpsc::SyncSender<()>>=OnceLock::new();
/// The mouse hook's thread: its id while it pumps, `MOUSE_STARTING` while it starts or stops.
static MOUSE_THREAD:AtomicU32=AtomicU32::new(0);
const MOUSE_STARTING:u32=u32::MAX;

/// Whether a key down ends the marks: not one of ours, not a lone modifier or lock key.
/// Escape counts, unlike for Undo: the user acts in the text's window.
pub fn ends_marks(vk:u32,extra:usize)->bool{
    extra!=OUR_KEYS&&!matches!(vk,0x10..=0x12|0x14|0x5B|0x5C|0x90|0x91|0xA0..=0xA5)
}

/// Whether a low-level mouse message ends the marks: a button pressed, the wheel turned.
pub fn ends_marks_mouse(message:u32)->bool{
    use windows::Win32::UI::WindowsAndMessaging::{WM_LBUTTONDOWN,WM_MBUTTONDOWN,WM_MOUSEHWHEEL,WM_MOUSEWHEEL,WM_RBUTTONDOWN,WM_XBUTTONDOWN};
    [WM_LBUTTONDOWN,WM_RBUTTONDOWN,WM_MBUTTONDOWN,WM_XBUTTONDOWN,WM_MOUSEWHEEL,WM_MOUSEHWHEEL].contains(&message)
}

/// Where the marks' end is reported: `on_action` runs on its own thread.
pub fn install_marks_watch(on_action:impl Fn()+Send+'static)->Result<(),String>{
    let (sender,receiver)=std::sync::mpsc::sync_channel::<()>(1);
    let _=MARKS_ENDED.set(sender);
    std::thread::Builder::new().name("marks-watch".into()).spawn(move||{for ()in receiver{on_action();}})
        .map(|_|()).map_err(|_|"La fin des marques est indisponible.".to_string())
}

/// The marks show: their watch starts, the keys at once, the mouse once its thread runs.
/// `overlay`: our pill, whose clicks leave the marks alone.
pub fn arm_marks_watch(overlay:isize){
    MARKS_OVERLAY.store(overlay,Ordering::Relaxed);
    MARKS_WATCH.store(true,Ordering::Release);
    if MOUSE_THREAD.compare_exchange(0,MOUSE_STARTING,Ordering::AcqRel,Ordering::Acquire).is_ok()
        &&std::thread::Builder::new().name("marks-mouse".into()).spawn(watch_mouse).is_err(){
        MOUSE_THREAD.store(0,Ordering::Release);
    }
}

/// The marks left or hid: nothing is reported any more and the mouse hook goes away.
pub fn disarm_marks_watch(){
    use windows::Win32::UI::WindowsAndMessaging::{PostThreadMessageW,WM_QUIT};
    MARKS_WATCH.store(false,Ordering::Release);
    let thread=MOUSE_THREAD.load(Ordering::Acquire);
    if thread!=0&&thread!=MOUSE_STARTING{unsafe{let _=PostThreadMessageW(thread,WM_QUIT,WPARAM(0),LPARAM(0));}}
}

fn marks_action(){
    if MARKS_WATCH.swap(false,Ordering::AcqRel){if let Some(ended)=MARKS_ENDED.get(){let _=ended.try_send(());}}
}

/// The mouse hook's thread: installs the hook, pumps until `disarm_marks_watch` posts
/// WM_QUIT, removes it. Armed again meanwhile, it starts over rather than leave the marks
/// without their mouse. The hook itself stays minimal: one comparison, and for a press or
/// the wheel, the window under the pointer (our thread owns no window: nothing is sent).
fn watch_mouse(){
    use windows::Win32::{Foundation::HINSTANCE,System::Threading::GetCurrentThreadId,UI::WindowsAndMessaging::{CallNextHookEx,GetAncestor,GetMessageW,PeekMessageW,SetWindowsHookExW,UnhookWindowsHookEx,WindowFromPoint,GA_ROOT,MSG,MSLLHOOKSTRUCT,PM_NOREMOVE,WH_MOUSE_LL}};
    unsafe extern "system" fn mouse(code:i32,wparam:WPARAM,lparam:LPARAM)->LRESULT{
        if code>=0&&MARKS_WATCH.load(Ordering::Acquire)&&ends_marks_mouse(wparam.0 as u32){
            let point=unsafe{(*(lparam.0 as *const MSLLHOOKSTRUCT)).pt};
            let overlay=MARKS_OVERLAY.load(Ordering::Relaxed);
            if overlay==0||unsafe{GetAncestor(WindowFromPoint(point),GA_ROOT)}.0 as isize!=overlay{marks_action();}
        }
        unsafe{CallNextHookEx(None,code,wparam,lparam)}
    }
    unsafe{
        let thread=GetCurrentThreadId();
        let mut message=MSG::default();
        // The queue exists before the id is published: a WM_QUIT posted right then is kept.
        let _=PeekMessageW(&mut message,None,0,0,PM_NOREMOVE);
        let module=GetModuleHandleW(None).ok().map(|module|HINSTANCE(module.0));
        loop{
            let Ok(hook)=SetWindowsHookExW(WH_MOUSE_LL,Some(mouse),module,0) else{MOUSE_THREAD.store(0,Ordering::Release);return};
            MOUSE_THREAD.store(thread,Ordering::Release);
            if MARKS_WATCH.load(Ordering::Acquire){while GetMessageW(&mut message,None,0,0).0>0{}}
            let _=UnhookWindowsHookEx(hook);
            MOUSE_THREAD.store(MOUSE_STARTING,Ordering::Release);
            if MARKS_WATCH.load(Ordering::Acquire){continue;}
            MOUSE_THREAD.store(0,Ordering::Release);
            // Armed again right then: start over, unless that arming started a thread itself.
            if !(MARKS_WATCH.load(Ordering::Acquire)&&MOUSE_THREAD.compare_exchange(0,MOUSE_STARTING,Ordering::AcqRel,Ordering::Acquire).is_ok()){return;}
        }
    }
}

pub fn escape_scope(source:isize,overlay:isize){
    SOURCE.store(source,Ordering::Relaxed);OVERLAY.store(overlay,Ordering::Relaxed);OVERLAY_VISIBLE.store(true,Ordering::Release);
}
pub fn close_escape_scope(){OVERLAY_VISIBLE.store(false,Ordering::Release);ESCAPE_PENDING.store(false,Ordering::Release);}
/// Whether a scope (Escape, or the menu's) is open.
pub fn escape_open()->bool{OVERLAY_VISIBLE.load(Ordering::Acquire)}
pub fn take_escape()->bool{ESCAPE_PENDING.swap(false,Ordering::AcqRel)}
pub fn handle(window:&WebviewWindow)->isize{window.hwnd().map(|h|h.0 as isize).unwrap_or(0)}

/// Opens or closes the menu's scope. A menu binding opens it at its press, before the capture
/// is even taken (review of da-ilot, n°4 and n°7): a key typed right after the shortcut never
/// lands in the source, Rust holds it until the capture has its id. The stored capture opens
/// it again for its own source. While it is open the hook never swallows Escape for itself:
/// the WebView owns it when the overlay has the foreground, the frontend receives it as a
/// `menu-key` otherwise.
pub fn set_menu_open(open:bool,source:isize,overlay:isize){
    if open{SOURCE.store(source,Ordering::Relaxed);OVERLAY.store(overlay,Ordering::Relaxed);OVERLAY_VISIBLE.store(true,Ordering::Release);ESCAPE_PENDING.store(false,Ordering::Release);}
    MENU_FOCUSED.store(false,Ordering::Release);
    MENU_OPEN.store(open,Ordering::Release);
}
pub fn menu_open()->bool{MENU_OPEN.load(Ordering::Acquire)}
/// The overlay took the foreground for the open menu (`focus_overlay`, or seen by the hook).
pub fn set_menu_focused(){if MENU_OPEN.load(Ordering::Acquire){MENU_FOCUSED.store(true,Ordering::Release);}}
pub fn menu_focused()->bool{MENU_FOCUSED.load(Ordering::Acquire)}
/// Whether the hook takes a menu key from the source: only while the menu waits over a source
/// that kept the foreground because the overlay never got it. Once the overlay had it, the
/// user coming back to the source (a click in the document) means he left the menu: his keys
/// are his (the context watcher then closes the menu).
pub fn takes_source_keys(fg:isize,source:isize,focused:bool)->bool{fg!=0&&fg==source&&!focused}

/// A menu key taken from the source window while the overlay could not hold the
/// foreground: `key` is written like `KeyboardEvent.key` (« Enter », « Tab », « ArrowDown »,
/// « 3 », « f »…), `shift` tells Shift+Tab from Tab. Never a text: one key at a time, and
/// only the keys the menu understands.
#[derive(Clone,Debug,PartialEq,Eq)]
pub struct MenuKey{pub key:String,pub shift:bool}

/// Which keys the menu takes from the source (the keyboard fallback of lot 3). `other`:
/// Ctrl, Alt or Windows is held, and then nothing is taken (shortcuts, Alt+Tab and AltGr
/// stay the user's). Digits are the physical keys 1 to 6 of the row or the keypad, so
/// AZERTY needs no Shift; letters are read through the active layout, without modifier,
/// and only when they are letters. `letter` is only called for the letter keys.
pub fn menu_key(vk:u32,shift:bool,other:bool,letter:impl FnOnce()->Option<char>)->Option<String>{
    if other{return None;}
    Some(match vk{
        0x0D=>"Enter".into(),
        0x1B=>"Escape".into(),
        0x09=>"Tab".into(),
        0x25=>"ArrowLeft".into(),
        0x26=>"ArrowUp".into(),
        0x27=>"ArrowRight".into(),
        0x28=>"ArrowDown".into(),
        0x31..=0x36=>char::from_u32(vk).map(String::from)?,
        0x61..=0x66=>char::from_u32(vk-0x30).map(String::from)?,
        0x41..=0x5A if !shift=>letter().filter(|c|c.is_alphabetic()).map(String::from)?,
        _=>return None,
    })
}

/// The character a key gives with the layout of the window `fg` (no modifier), read
/// without touching any keyboard state (ToUnicodeEx flag 4, Windows 10 1607+).
fn layout_letter(vk:u32,scan:u32,fg:isize)->Option<char>{
    unsafe{
        let thread=GetWindowThreadProcessId(HWND(fg as *mut _),None);
        character(vk,scan,&[0u8;256],GetKeyboardLayout(thread))
    }
}

unsafe fn character(vk:u32,scan:u32,state:&[u8;256],layout:HKL)->Option<char>{
    let mut buffer=[0u16;8];
    let count=unsafe{ToUnicodeEx(vk,scan,state,&mut buffer,4,Some(layout))};
    // A dead key answers -1 with its own character in the buffer.
    let length=match count{1=>1,-1=>1,_=>return None};
    char::decode_utf16(buffer[..length].iter().copied()).next()?.ok().filter(|c|!c.is_control())
}

fn held(key:VIRTUAL_KEY)->bool{unsafe{GetAsyncKeyState(key.0 as i32)<0}}

/// The character Ctrl+Alt (+Shift) + `vk` types with `layout` (lot 4): on a layout with
/// AltGr (AZERTY, QWERTZ…) Windows reads Ctrl+Alt as AltGr, so a global shortcut on that
/// chord steals a character (€, {, @…). None when the chord types nothing. A dead key
/// counts: it is a character the user types.
pub fn altgr_character_in(layout:HKL,vk:u32,shift:bool)->Option<char>{
    let mut state=[0u8;256];
    for key in [VK_CONTROL,VK_LCONTROL,VK_MENU,VK_LMENU]{state[key.0 as usize]=0x80;}
    if shift{for key in [VK_SHIFT,VK_LSHIFT]{state[key.0 as usize]=0x80;}}
    unsafe{
        let scan=MapVirtualKeyExW(vk,MAPVK_VK_TO_VSC,Some(layout));
        character(vk,scan,&state,layout)
    }
}

/// `altgr_character_in` with the layout of the foreground window's thread (the settings
/// window, whose recorder asks while the user types the chord).
pub fn altgr_character(vk:u32,shift:bool)->Option<char>{
    unsafe{
        let thread=GetWindowThreadProcessId(GetForegroundWindow(),None);
        altgr_character_in(GetKeyboardLayout(thread),vk,shift)
    }
}

/// The keyboard layouts loaded in this session (a test looks for a known one; nothing is
/// ever loaded for it).
#[cfg(test)]
fn keyboard_layouts()->Vec<HKL>{
    use windows::Win32::UI::Input::KeyboardAndMouse::GetKeyboardLayoutList;
    unsafe{
        let count=GetKeyboardLayoutList(None);
        if count<=0{return Vec::new();}
        let mut layouts=vec![HKL::default();count as usize];
        let filled=GetKeyboardLayoutList(Some(&mut layouts));
        layouts.truncate(filled.max(0) as usize);
        layouts
    }
}

/// The executable name of the process that owns a window, lowercase (« notepad.exe »):
/// the key of the Îlot's memory per application (lot 4). Never a path, never a title.
pub fn process_name(handle:isize)->Option<String>{
    use windows::Win32::{Foundation::CloseHandle,System::Threading::{OpenProcess,QueryFullProcessImageNameW,PROCESS_NAME_WIN32,PROCESS_QUERY_LIMITED_INFORMATION}};
    if handle==0{return None;}
    let mut pid=0u32;
    unsafe{GetWindowThreadProcessId(HWND(handle as *mut _),Some(&mut pid));}
    if pid==0{return None;}
    let mut path=[0u16;1024];
    let mut length=path.len() as u32;
    unsafe{
        let process=OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION,false,pid).ok()?;
        let read=QueryFullProcessImageNameW(process,PROCESS_NAME_WIN32,windows::core::PWSTR(path.as_mut_ptr()),&mut length);
        let _=CloseHandle(process);
        read.ok()?;
    }
    executable_name(&String::from_utf16_lossy(&path[..length as usize]))
}

/// The file name of an executable path, lowercase; None for anything implausible.
pub fn executable_name(path:&str)->Option<String>{
    let name=path.rsplit(['\\','/']).next()?.trim().to_lowercase();
    (!name.is_empty()&&name.len()<=260&&!name.chars().any(char::is_control)).then_some(name)
}

/// The low-level keyboard hook, on the main thread. It stays minimal (LowLevelHooksTimeout):
/// a few atomics, the async state of the modifiers and, for a letter while the menu is
/// open over the source, one ToUnicodeEx. `on_menu_key` runs on its own thread.
pub fn install_keyboard_hook(on_menu_key:impl Fn(MenuKey)+Send+'static,on_typed:impl Fn(Typed)+Send+'static)->Result<(),String>{
    use windows::Win32::{Foundation::{HINSTANCE,LRESULT,LPARAM,WPARAM},System::LibraryLoader::GetModuleHandleW,UI::WindowsAndMessaging::{CallNextHookEx,SetWindowsHookExW,KBDLLHOOKSTRUCT,WH_KEYBOARD_LL,WM_KEYDOWN,WM_SYSKEYDOWN,WM_KEYUP,WM_SYSKEYUP}};
    unsafe extern "system" fn keyboard(code:i32,wparam:WPARAM,lparam:LPARAM)->LRESULT{
        if code>=0&&MARKS_WATCH.load(Ordering::Acquire){
            let key=unsafe{&*(lparam.0 as *const KBDLLHOOKSTRUCT)};
            let message=wparam.0 as u32;
            if (message==WM_KEYDOWN||message==WM_SYSKEYDOWN)&&ends_marks(key.vkCode,key.dwExtraInfo){marks_action();}
        }
        if code>=0&&UNDO_WATCH.load(Ordering::Acquire){
            let key=unsafe{&*(lparam.0 as *const KBDLLHOOKSTRUCT)};
            let message=wparam.0 as u32;
            if (message==WM_KEYDOWN||message==WM_SYSKEYDOWN)&&ends_undo(key.vkCode,key.dwExtraInfo)&&foreground()==UNDO_SOURCE.load(Ordering::Relaxed){
                UNDO_WATCH.store(false,Ordering::Release);
                let undo=key.vkCode==0x5A&&held(VK_CONTROL)&&!held(VK_MENU)&&!held(VK_SHIFT)&&!held(VK_LWIN)&&!held(VK_RWIN);
                if let Some(typed)=TYPED.get(){let _=typed.try_send(if undo{Typed::UndoKey}else{Typed::Other});}
            }
        }
        if code>=0&&OVERLAY_VISIBLE.load(Ordering::Acquire){
            let key=unsafe{&*(lparam.0 as *const KBDLLHOOKSTRUCT)};
            let message=wparam.0 as u32;
            let fg=foreground();
            if MENU_OPEN.load(Ordering::Acquire){
                if fg!=0&&fg==OVERLAY.load(Ordering::Relaxed){MENU_FOCUSED.store(true,Ordering::Release);}
                // The source kept the foreground (the overlay could not take it, or not yet):
                // the menu keys go to the frontend, down and up, and never reach the source.
                if takes_source_keys(fg,SOURCE.load(Ordering::Relaxed),MENU_FOCUSED.load(Ordering::Acquire)){
                    let other=held(VK_CONTROL)||held(VK_MENU)||held(VK_LWIN)||held(VK_RWIN);
                    let shift=held(VK_SHIFT);
                    if let Some(name)=menu_key(key.vkCode,shift,other,||layout_letter(key.vkCode,key.scanCode,fg)){
                        if message==WM_KEYDOWN||message==WM_SYSKEYDOWN{
                            if let Some(keys)=MENU_KEYS.get(){let _=keys.try_send(MenuKey{key:name,shift});}
                        }
                        return LRESULT(1);
                    }
                }
                // With the overlay in front, every key (Escape included) belongs to the WebView.
            }else if key.vkCode==VK_ESCAPE.0 as u32&&fg!=0&&[SOURCE.load(Ordering::Relaxed),OVERLAY.load(Ordering::Relaxed)].contains(&fg){
                if [WM_KEYDOWN,WM_SYSKEYDOWN].contains(&message){ESCAPE_PENDING.store(true,Ordering::Release);return LRESULT(1);}
                if [WM_KEYUP,WM_SYSKEYUP].contains(&message){return LRESULT(1);}
            }
        }
        unsafe{CallNextHookEx(None,code,wparam,lparam)}
    }
    let (sender,receiver)=std::sync::mpsc::sync_channel::<MenuKey>(32);
    let _=MENU_KEYS.set(sender);
    std::thread::Builder::new().name("menu-keys".into()).spawn(move||{for key in receiver{on_menu_key(key);}})
        .map_err(|_|"La gestion du clavier est indisponible.".to_string())?;
    let (sender,receiver)=std::sync::mpsc::sync_channel::<Typed>(4);
    let _=TYPED.set(sender);
    std::thread::Builder::new().name("undo-watch".into()).spawn(move||{for typed in receiver{on_typed(typed);}})
        .map_err(|_|"La gestion du clavier est indisponible.".to_string())?;
    unsafe{
        let module=GetModuleHandleW(None).map_err(|_|"Module clavier indisponible.".to_string())?;
        SetWindowsHookExW(WH_KEYBOARD_LL,Some(keyboard),Some(HINSTANCE(module.0)),0).map_err(|_|"La gestion d’Échap est indisponible.".to_string())?;
    }
    Ok(())
}

// After an Îlot choice (lot 3) the overlay is a pill the user may click (Undo, later) and
// must never take the focus back from the source: WS_EX_NOACTIVATE on the window and
// MA_NOACTIVATE in `silent_frame_proc`. The hit tester rewrites the extended style every
// few milliseconds, so it re-applies the bit from these atomics (Tao may rebuild it too).
static NO_ACTIVATE:AtomicBool=AtomicBool::new(false);
static NO_ACTIVATE_WINDOW:AtomicIsize=AtomicIsize::new(0);

fn no_activate_applies(handle:isize)->bool{
    handle!=0&&NO_ACTIVATE.load(Ordering::Acquire)&&NO_ACTIVATE_WINDOW.load(Ordering::Relaxed)==handle
}

fn with_no_activate(handle:isize,style:isize)->isize{
    if handle==0||NO_ACTIVATE_WINDOW.load(Ordering::Relaxed)!=handle{return style;}
    let bit=WS_EX_NOACTIVATE.0 as isize;
    if NO_ACTIVATE.load(Ordering::Acquire){style|bit}else{style&!bit}
}

/// Raises (after a choice) or lowers (at the next capture) the overlay's no-activate state.
pub fn set_no_activate(handle:isize,on:bool){
    if handle==0{return;}
    NO_ACTIVATE_WINDOW.store(handle,Ordering::Relaxed);
    NO_ACTIVATE.store(on,Ordering::Release);
    let hwnd=HWND(handle as *mut _);
    unsafe{
        let current=GetWindowLongPtrW(hwnd,GWL_EXSTYLE);
        let next=with_no_activate(handle,current);
        if next!=current{SetWindowLongPtrW(hwnd,GWL_EXSTYLE,next);}
    }
}

/// Gives the foreground back to `target` (the source window). Allowed while this process
/// owns the foreground (the overlay has it); true when `target` holds it afterwards.
pub fn give_foreground(target:isize)->bool{
    if target==0{return false;}
    let hwnd=HWND(target as *mut _);
    unsafe{
        if !IsWindow(Some(hwnd)).as_bool(){return false;}
        if GetForegroundWindow()==hwnd{return true;}
        let _=SetForegroundWindow(hwnd);
        GetForegroundWindow()==hwnd
    }
}
pub fn belongs_to(window: &WebviewWindow, handle: isize) -> bool {
    window.hwnd().is_ok_and(|h| h.0 as isize == handle)
}

pub fn compensate_pointer_drag(
    window: &WebviewWindow,
    client_x: f64,
    client_y: f64,
) -> Result<bool, String> {
    if !client_x.is_finite() || !client_y.is_finite() {
        return Err("Position de déplacement invalide.".into());
    }
    let scale = window
        .scale_factor()
        .map_err(|_| "Fenêtre indisponible.".to_string())?;
    let client = window
        .inner_size()
        .map_err(|_| "Fenêtre indisponible.".to_string())?;
    let (x, y) = (client_x * scale, client_y * scale);
    if x < 0. || y < 0. || x >= client.width as f64 || y >= client.height as f64 {
        return Err("Position de déplacement invalide.".into());
    }
    let hwnd = HWND(
        window
            .hwnd()
            .map_err(|_| "Fenêtre indisponible.".to_string())?
            .0,
    );
    let mut client_origin = POINT::default();
    let mut cursor = POINT::default();
    unsafe {
        ClientToScreen(hwnd, &mut client_origin)
            .ok()
            .map_err(|_| "Fenêtre indisponible.".to_string())?;
        GetCursorPos(&mut cursor).map_err(|_| "Déplacement indisponible.".to_string())?;
    }
    let dx = cursor.x - (client_origin.x + x.round() as i32);
    let dy = cursor.y - (client_origin.y + y.round() as i32);
    if dx != 0 || dy != 0 {
        let rect = window_rect(hwnd.0 as isize)
            .ok_or_else(|| "Fenêtre indisponible.".to_string())?;
        unsafe {
            SetWindowPos(
                hwnd,
                None,
                rect.x.round() as i32 + dx,
                rect.y.round() as i32 + dy,
                0,
                0,
                SWP_NOACTIVATE | SWP_NOSIZE | SWP_NOZORDER,
            )
            .map_err(|_| "Déplacement indisponible.".to_string())?;
        }
    }
    Ok(unsafe { GetAsyncKeyState(VK_LBUTTON.0 as i32) < 0 })
}

/// Work area and scale of the monitor holding `location`; without one, the monitor
/// under the cursor (the bottom band opens on the screen the mouse is on).
pub fn monitor(location: Option<Rect>) -> (Rect, f64) {
    let (work, scale, _) = monitor_at(location);
    (work, scale)
}

/// The monitor under `location` (its centre), or under the cursor when None: work area
/// in physical pixels, DPI scale and the HMONITOR that identifies the screen.
pub fn monitor_at(location: Option<Rect>) -> (Rect, f64, isize) {
    let location = location
        .or_else(|| cursor_position().map(|p| Rect { x: p.x as f64, y: p.y as f64, width: 1., height: 1. }))
        .unwrap_or(Rect { x: 0., y: 0., width: 1., height: 1. });
    let handle = unsafe {
        MonitorFromPoint(
            POINT {
                x: (location.x + location.width / 2.) as i32,
                y: (location.y + location.height / 2.) as i32,
            },
            MONITOR_DEFAULTTONEAREST,
        )
    };
    let (work, scale) = monitor_info(handle.0 as isize);
    (work, scale, handle.0 as isize)
}

/// The screen under the cursor (test override honoured), as an HMONITOR value.
pub fn cursor_monitor() -> isize {
    let Some(p) = cursor_position() else { return 0 };
    unsafe { MonitorFromPoint(POINT { x: p.x, y: p.y }, MONITOR_DEFAULTTONEAREST).0 as isize }
}

/// Work area (physical) and DPI scale of a screen known by its HMONITOR.
pub fn monitor_info(handle: isize) -> (Rect, f64) {
    let m = HMONITOR(handle as *mut _);
    unsafe {
        let mut info = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };
        let (mut dx, mut dy) = (96, 96);
        let _ = GetDpiForMonitor(m, MDT_EFFECTIVE_DPI, &mut dx, &mut dy);
        let scale = (dx as f64 / 96.).clamp(1., 4.);
        if GetMonitorInfoW(m, &mut info).as_bool() {
            let r = info.rcWork;
            return (
                Rect {
                    x: r.left as f64,
                    y: r.top as f64,
                    width: (r.right - r.left) as f64,
                    height: (r.bottom - r.top) as f64,
                },
                scale,
            );
        }
    }
    (
        Rect {
            x: 0.,
            y: 0.,
            width: 1920.,
            height: 1080.,
        },
        1.,
    )
}

// The overlay and the halo never go through Tao's show()/hide(): show() uses
// SetWindowPos directly so the source keeps its focus, and any later Tao
// visibility diff rebuilds the styles with WS_CAPTION | WS_SYSMENU (Tao 0.35
// `WindowFlags::apply_diff`), which DWM then paints as a « FlowTranslate » title.
// Every visibility and focus change therefore stays at the HWND boundary, and
// `repair_handle` strips the caption whenever Tao or Windows touched the frame.
//
// The window carries no Win32 region (2026-09-10): a region is a 1-bit mask that DWM
// clips without anti-aliasing and that drops every shadow outside it (the jagged
// « cut with a cutter » edges Lucas reported). Chromium paints the silhouette with
// per-pixel alpha through Tao's DwmEnableBlurBehindWindow transparency; the tight
// regions the frontend publishes only feed the hit-test below.
#[derive(Clone)]
struct Surface {
    regions: Vec<SurfaceRegion>,
    scale: f64,
}

static SURFACES: Mutex<Vec<(isize, Surface)>> = Mutex::new(Vec::new());

fn remember_surface(handle: isize, surface: Surface) {
    if let Ok(mut surfaces) = SURFACES.lock() {
        match surfaces.iter_mut().find(|(known, _)| *known == handle) {
            Some(entry) => entry.1 = surface,
            None => surfaces.push((handle, surface)),
        }
    }
}

fn surfaces() -> Vec<(isize, Surface)> {
    SURFACES.lock().map(|surfaces| surfaces.clone()).unwrap_or_default()
}

/// Whether a client point (physical pixels) lies in one of the rounded surfaces.
pub fn contains(regions: &[SurfaceRegion], scale: f64, x: f64, y: f64) -> bool {
    regions.iter().any(|region| {
        let (left, top) = (region.x * scale, region.y * scale);
        let (width, height) = (region.width * scale, region.height * scale);
        if x < left || y < top || x > left + width || y > top + height {
            return false;
        }
        let radius = (region.radius * scale).min(width / 2.).min(height / 2.);
        let cx = x.clamp(left + radius, left + width - radius);
        let cy = y.clamp(top + radius, top + height - radius);
        (x - cx).powi(2) + (y - cy).powi(2) <= radius * radius
    })
}

static CURSOR_OVERRIDE: Mutex<Option<(i32, i32)>> = Mutex::new(None);

/// Test hook, honoured only under the WebView2 probe (`FLOWTRANSLATE_CDP_URL` set by
/// `scripts/test-native-ui.ps1`): a locked session neither moves nor reports the real
/// cursor, so the probe feeds the hit tester a screen point instead.
pub fn override_cursor(point: Option<(i32, i32)>) -> Result<(), String> {
    if std::env::var_os("FLOWTRANSLATE_CDP_URL").is_none() {
        return Err("Indisponible hors test.".into());
    }
    *CURSOR_OVERRIDE.lock().map_err(|_| "Verrou indisponible.".to_string())? = point;
    Ok(())
}

fn cursor_position() -> Option<POINT> {
    if let Some((x, y)) = CURSOR_OVERRIDE.lock().ok().and_then(|point| *point) {
        return Some(POINT { x, y });
    }
    let mut cursor = POINT::default();
    unsafe { GetCursorPos(&mut cursor).ok()? };
    Some(cursor)
}

/// Whether a client point lies within `margin` logical pixels of one of the surfaces
/// (their bounding boxes, inflated): the glass counts a pointer resting in its shadow as
/// still there, so leaving is judged on the silhouette rather than on the tight boxes.
pub fn near(regions: &[SurfaceRegion], scale: f64, x: f64, y: f64, margin: f64) -> bool {
    let m = margin * scale;
    regions.iter().any(|region| {
        x >= region.x * scale - m
            && y >= region.y * scale - m
            && x <= (region.x + region.width) * scale + m
            && y <= (region.y + region.height) * scale + m
    })
}

const NEAR_MARGIN: f64 = 32.;

/// Cursor in client coordinates (physical pixels, pixel centre).
unsafe fn cursor_client(hwnd: HWND) -> Option<(f64, f64)> {
    let cursor = cursor_position()?;
    let mut origin = POINT::default();
    if unsafe { !ClientToScreen(hwnd, &mut origin).as_bool() } {
        return None;
    }
    Some(((cursor.x - origin.x) as f64 + 0.5, (cursor.y - origin.y) as f64 + 0.5))
}

unsafe fn cursor_inside(hwnd: HWND, surface: &Surface) -> bool {
    unsafe { cursor_client(hwnd) }
        .is_some_and(|(x, y)| contains(&surface.regions, surface.scale, x, y))
}

#[derive(Clone, serde::Serialize)]
struct GlassNear {
    near: bool,
}

/// Windows routes the mouse under a layered window that carries WS_EX_TRANSPARENT;
/// both styles are set and cleared together, only when the state changes.
unsafe fn pass_through(hwnd: HWND, on: bool) {
    let mask = (WS_EX_TRANSPARENT | WS_EX_LAYERED).0 as isize;
    unsafe {
        let current = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        let next = if on { current | mask } else { current & !mask };
        // The same read-modify-write keeps the overlay's no-activate bit (lot 3) in step.
        let next = with_no_activate(hwnd.0 as isize, next);
        if next != current {
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, next);
        }
    }
}

/// Hit-testing without a region: while a surface window is visible, the real cursor is
/// compared with its rounded surfaces every 8 ms and the pass-through styles follow.
/// Nothing toggles while the primary button is down: a press inside the glass keeps
/// its window through the drag, a press outside never lands on it. The overlay also
/// learns, on change only, whether the cursor rests within 32 px of one of its surfaces
/// (`glass-near`): the frontend holds the glass open while it does. No point is logged.
/// `on_screen` is called from the poller's thread whenever the cursor changes screen
/// while a surface is visible (2026-09-14): the bottom forms follow the mouse.
pub fn start_hit_tester(app: AppHandle, overlay: isize, on_screen: impl Fn(&AppHandle, isize) + Send + 'static) {
    let _ = std::thread::Builder::new().name("hit-tester".into()).spawn(move || {
        let mut was_near: Option<bool> = None;
        let mut last_monitor = 0isize;
        loop {
            let mut any_visible = false;
            for (handle, surface) in surfaces() {
                let hwnd = HWND(handle as *mut _);
                unsafe {
                    if !IsWindowVisible(hwnd).as_bool() {
                        if handle == overlay {
                            was_near = None;
                        }
                        continue;
                    }
                    any_visible = true;
                    let client = cursor_client(hwnd);
                    if handle == overlay {
                        let near = client.is_some_and(|(x, y)| near(&surface.regions, surface.scale, x, y, NEAR_MARGIN));
                        if near { POINTER_NEAR_AT.store(now_ms(), Ordering::Release); }
                        if was_near != Some(near) {
                            was_near = Some(near);
                            let _ = app.emit_to("overlay", "glass-near", GlassNear { near });
                        }
                    }
                    if GetAsyncKeyState(VK_LBUTTON.0 as i32) < 0 {
                        continue;
                    }
                    let inside = client.is_some_and(|(x, y)| contains(&surface.regions, surface.scale, x, y));
                    pass_through(hwnd, !inside);
                }
            }
            if any_visible {
                let monitor = cursor_monitor();
                if monitor != 0 && monitor != last_monitor {
                    last_monitor = monitor;
                    on_screen(&app, monitor);
                }
            }
            std::thread::sleep(std::time::Duration::from_millis(if any_visible { 8 } else { 50 }));
        }
    });
}

pub fn is_visible(window: &WebviewWindow) -> bool {
    window.hwnd().is_ok_and(|hwnd| unsafe { IsWindowVisible(HWND(hwnd.0)).as_bool() })
}

pub fn hide(window: &WebviewWindow) -> Result<(), String> {
    let hwnd = window.hwnd().map_err(|_| "Fenêtre indisponible.".to_string())?;
    unsafe { let _ = ShowWindow(HWND(hwnd.0), SW_HIDE); }
    Ok(())
}

/// Brings the already visible overlay to the foreground so the WebView receives
/// the keyboard (the Îlot menu), then re-establishes the frameless silhouette. Returns
/// whether the overlay really holds the foreground afterwards: Windows may refuse the
/// switch (foreground lock) and SetForegroundWindow's own answer is no proof of it.
pub fn activate(window: &WebviewWindow) -> Result<bool, String> {
    let handle = window
        .hwnd()
        .map_err(|_| "Fenêtre indisponible.".to_string())?
        .0 as isize;
    let hwnd = HWND(handle as *mut _);
    unsafe {
        if !IsWindowVisible(hwnd).as_bool() {
            return Err("La capture n’est plus active.".into());
        }
        // The request follows the shortcut this process just received, so Windows
        // normally grants the switch; a refusal is reported, not raised.
        if GetForegroundWindow() != hwnd {
            let _ = SetForegroundWindow(hwnd);
        }
    }
    repair_handle(handle)?;
    let deadline = Instant::now() + Duration::from_millis(40);
    loop {
        if unsafe { GetForegroundWindow() } == hwnd { return Ok(true); }
        if Instant::now() >= deadline { return Ok(false); }
        std::thread::sleep(Duration::from_millis(5));
    }
}

/// Sizes, moves and shows the window (frameless, topmost, never activated). Only called
/// when the rectangle changes: the reserved window keeps its size through every fold,
/// unfold or menu, so those cost no `SetWindowPos` at all.
pub fn place(window: &WebviewWindow, rect: Rect) -> Result<(), String> {
    let width = rect.width.round().max(1.) as u32;
    let height = rect.height.round().max(1.) as u32;
    window
        .set_size(PhysicalSize::new(width, height))
        .and_then(|_| {
            window.set_position(PhysicalPosition::new(
                rect.x.round() as i32,
                rect.y.round() as i32,
            ))
        })
        .map_err(|_| "Placement indisponible.".to_string())?;
    unsafe {
        let hwnd = HWND(window.hwnd().map_err(|_| "Fenêtre indisponible.".to_string())?.0);
        let chrome_changed = strip_chrome_hwnd(hwnd);
        let mut flags = SWP_NOACTIVATE | SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW;
        if chrome_changed {
            flags |= SWP_FRAMECHANGED;
        }
        SetWindowPos(hwnd, Some(HWND_TOPMOST), 0, 0, 0, 0, flags)
            .map_err(|_| "Placement indisponible.".to_string())?;
    }
    Ok(())
}

/// The halo (lot 6) draws over other windows and never takes a click, the focus, a taskbar
/// button or an Alt+Tab entry (a tool window, without the WS_EX_APPWINDOW Tao gives every
/// top-level window). Its styles are set once and never touched by the hit tester (it
/// publishes no surface); `place_below` re-applies them should Tao have rebuilt them.
const HALO_EX_STYLE: isize = (WS_EX_TRANSPARENT.0 | WS_EX_LAYERED.0 | WS_EX_NOACTIVATE.0 | WS_EX_TOOLWINDOW.0) as isize;

unsafe fn halo_style_hwnd(hwnd: HWND) {
    unsafe {
        let current = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        let next = (current | HALO_EX_STYLE) & !(WS_EX_APPWINDOW.0 as isize);
        if next != current {
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, next);
        }
    }
}

pub fn halo_style(window: &WebviewWindow) -> Result<(), String> {
    let hwnd = HWND(window.hwnd().map_err(|_| "Fenêtre indisponible.".to_string())?.0);
    unsafe { halo_style_hwnd(hwnd) };
    Ok(())
}

/// Places the window at `rect` (physical) right under `above` in the z-order (the top of
/// the topmost band when `above` is 0) and shows it without activating it. It moves while
/// still hidden first: on a screen of another DPI, Tao resizes the window when
/// WM_DPICHANGED arrives, and the second call restores the exact rectangle.
pub fn place_below(window: &WebviewWindow, rect: Rect, above: isize) -> Result<(), String> {
    let hwnd = HWND(window.hwnd().map_err(|_| "Fenêtre indisponible.".to_string())?.0);
    let (x, y) = (rect.x.round() as i32, rect.y.round() as i32);
    let (width, height) = (rect.width.round().max(1.) as i32, rect.height.round().max(1.) as i32);
    unsafe {
        halo_style_hwnd(hwnd);
        let mut flags = SWP_NOACTIVATE | SWP_NOZORDER;
        if strip_chrome_hwnd(hwnd) {
            flags |= SWP_FRAMECHANGED;
        }
        SetWindowPos(hwnd, None, x, y, width, height, flags).map_err(|_| "Placement indisponible.".to_string())?;
        let after = if above != 0 { HWND(above as *mut _) } else { HWND_TOPMOST };
        SetWindowPos(hwnd, Some(after), x, y, width, height, SWP_NOACTIVATE | SWP_SHOWWINDOW)
            .map_err(|_| "Placement indisponible.".to_string())?;
    }
    Ok(())
}

/// Publishes the surfaces the hit tester reads. The pass-through state is set at once:
/// the cursor is almost always outside the glass when it appears, and a surface that
/// just vanished under the pointer must stop catching clicks before the next poll.
pub fn set_regions(window: &WebviewWindow, regions: &[SurfaceRegion], scale: f64) -> Result<(), String> {
    let h = window.hwnd().map_err(|_| "Fenêtre indisponible.".to_string())?;
    let hwnd = HWND(h.0);
    let surface = Surface { regions: regions.to_vec(), scale };
    unsafe { pass_through(hwnd, !cursor_inside(hwnd, &surface)) };
    remember_surface(h.0 as isize, surface);
    Ok(())
}

/// Strips any caption Tao rebuilt. Safe from any thread: both calls message the
/// window's thread.
pub fn repair_handle(handle: isize) -> Result<(), String> {
    let hwnd = HWND(handle as *mut _);
    unsafe {
        if strip_chrome_hwnd(hwnd) {
            SetWindowPos(
                hwnd,
                None,
                0,
                0,
                0,
                0,
                SWP_FRAMECHANGED | SWP_NOACTIVATE | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER,
            )
            .map_err(|_| "Fenêtre indisponible.".to_string())?;
        }
    }
    Ok(())
}

unsafe fn strip_chrome_hwnd(hwnd: HWND) -> bool {
    // Tao 0.35 rebuilds top-level styles from its window flags when visibility
    // changes. Strip every caption-producing style at the HWND boundary too.
    let style = unsafe { GetWindowLongPtrW(hwnd, GWL_STYLE) };
    let chrome = (WS_CAPTION | WS_THICKFRAME | WS_SYSMENU | WS_MINIMIZEBOX | WS_MAXIMIZEBOX).0;
    let frameless = style & !(chrome as isize);
    if style == frameless {
        return false;
    }
    unsafe { SetWindowLongPtrW(hwnd, GWL_STYLE, frameless) };
    true
}


// ---------------------------------------------------------------------------------
// Clipboard freshness and the synthetic copy (2026-09-14, direct capture)
//
// Without a UIA selection the shortcut used to read whatever the clipboard held,
// silently: hence Lucas's Ctrl+C reflex. The capture now copies for him with a
// synthetic Ctrl+Insert (the CUA copy chord: every Windows control, Chromium, Office,
// Qt, Java and both consoles honour it, and unlike Ctrl+C it never becomes SIGINT in a
// terminal), then reads and restores the clipboard. `GetClipboardSequenceNumber` tells
// whether the target actually copied; the context watcher samples the same counter so
// a copy the user made himself less than three seconds ago still counts as fresh.
// Nothing here logs or keeps any clipboard text.

static CLIPBOARD_SEEN: AtomicU32 = AtomicU32::new(0);
static CLIPBOARD_CHANGED_AT: AtomicU64 = AtomicU64::new(0);
static CLIPBOARD_SUPPRESSED_UNTIL: AtomicU64 = AtomicU64::new(0);
static CLOCK: OnceLock<Instant> = OnceLock::new();

/// Milliseconds since the first call: a monotonic clock shared by the watcher and the
/// capture, never 0 (0 means « never » in the atomics above).
pub fn now_ms() -> u64 {
    let start = CLOCK.get_or_init(Instant::now);
    start.elapsed().as_millis() as u64 + 1
}

pub fn clipboard_sequence() -> u32 {
    unsafe { GetClipboardSequenceNumber() }
}

/// Called by the context watcher every 35 ms: dates the last clipboard change that is
/// not one of ours (the synthetic copy and the restoration are suppressed).
pub fn track_clipboard() {
    let sequence = clipboard_sequence();
    let previous = CLIPBOARD_SEEN.swap(sequence, Ordering::AcqRel);
    if previous == 0 || previous == sequence {
        return;
    }
    let now = now_ms();
    if now >= CLIPBOARD_SUPPRESSED_UNTIL.load(Ordering::Acquire) {
        CLIPBOARD_CHANGED_AT.store(now, Ordering::Release);
    }
}

/// When the clipboard last changed by the user's hand, in `now_ms` time (None: never seen).
pub fn clipboard_changed_at() -> Option<u64> {
    match CLIPBOARD_CHANGED_AT.load(Ordering::Acquire) {
        0 => None,
        at => Some(at),
    }
}

/// The clipboard changes of the next `window` are ours: the watcher must not date them.
pub fn suppress_clipboard_tracking(window: Duration) {
    CLIPBOARD_SUPPRESSED_UNTIL.store(now_ms() + window.as_millis() as u64, Ordering::Release);
    // Resynchronise so the next sample compares against the current counter.
    CLIPBOARD_SEEN.store(clipboard_sequence(), Ordering::Release);
}

pub fn modifiers_down() -> bool {
    [VK_CONTROL, VK_MENU, VK_SHIFT, VK_LWIN, VK_RWIN]
        .iter()
        .any(|key| unsafe { GetAsyncKeyState(key.0 as i32) } < 0)
}

/// The shortcut chord is still physically held when its handler runs: an Insert sent
/// under Ctrl+Alt would be another chord. Waits, at most `timeout`, for every modifier
/// to be released; false when the user keeps them down.
pub fn wait_modifiers_released(timeout: Duration) -> bool {
    let deadline = Instant::now() + timeout;
    while modifiers_down() {
        if Instant::now() >= deadline {
            return false;
        }
        std::thread::sleep(Duration::from_millis(10));
    }
    true
}

/// `extended`: the navigation Insert is E0 52; without the flag the same scan code is
/// the numpad 0/Ins, which Chromium reads as Ctrl+Numpad0 (matrix of 2026-09-14).
fn key_input(key: VIRTUAL_KEY, extended: bool, up: bool) -> INPUT {
    let scan = unsafe { MapVirtualKeyW(key.0 as u32, MAPVK_VK_TO_VSC) } as u16;
    let mut flags = KEYEVENTF_SCANCODE;
    if extended { flags |= KEYEVENTF_EXTENDEDKEY; }
    if up { flags |= KEYEVENTF_KEYUP; }
    INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: key,
                wScan: scan,
                dwFlags: flags,
                time: 0,
                // Ours: the Undo watch of the hook never takes them for the user's.
                dwExtraInfo: OUR_KEYS,
            },
        },
    }
}

/// Sends Ctrl+Insert to the foreground window: the copy chord, never SIGINT.
pub fn send_copy_chord() -> Result<(), String> {
    let inputs = [
        key_input(VK_CONTROL, false, false),
        key_input(VK_INSERT, true, false),
        key_input(VK_INSERT, true, true),
        key_input(VK_CONTROL, false, true),
    ];
    let sent = unsafe { SendInput(&inputs, std::mem::size_of::<INPUT>() as i32) };
    if sent as usize != inputs.len() {
        return Err("La copie synthétique a été bloquée.".into());
    }
    Ok(())
}

/// Sends Ctrl+V to the foreground window: one chord, never Ctrl+A, never Enter; the
/// target editor handles its own paste and its undo. On a partial injection the keys
/// already pressed are released and the count sent is returned.
pub fn send_paste_chord() -> Result<(), u32> {
    let inputs = [
        key_input(VK_CONTROL, false, false),
        key_input(VK_V, false, false),
        key_input(VK_V, false, true),
        key_input(VK_CONTROL, false, true),
    ];
    let sent = unsafe { SendInput(&inputs, std::mem::size_of::<INPUT>() as i32) };
    if sent as usize != inputs.len() {
        if sent > 0 {
            let release = [key_input(VK_V, false, true), key_input(VK_CONTROL, false, true)];
            unsafe { SendInput(&release, std::mem::size_of::<INPUT>() as i32); }
        }
        return Err(sent);
    }
    Ok(())
}

/// Sends Ctrl+Z to the foreground window (Undo of lot 9, option A): one chord, the target
/// editor undoes its own paste. On a partial injection the keys already pressed are
/// released and the count sent is returned.
pub fn send_undo_chord() -> Result<(), u32> {
    use windows::Win32::UI::Input::KeyboardAndMouse::VK_Z;
    let inputs = [
        key_input(VK_CONTROL, false, false),
        key_input(VK_Z, false, false),
        key_input(VK_Z, false, true),
        key_input(VK_CONTROL, false, true),
    ];
    let sent = unsafe { SendInput(&inputs, std::mem::size_of::<INPUT>() as i32) };
    if sent as usize != inputs.len() {
        if sent > 0 {
            let release = [key_input(VK_Z, false, true), key_input(VK_CONTROL, false, true)];
            unsafe { SendInput(&release, std::mem::size_of::<INPUT>() as i32); }
        }
        return Err(sent);
    }
    Ok(())
}

// ---------------------------------------------------------------------------------
// Robustness (0.6): what the watchdog, the capture and the paste ask Windows without ever
// going through the main thread. A window getter of Tauri (`hwnd()`, `is_visible()`…) called
// off the main thread waits for it: called while the state lock is held, it deadlocks the
// whole application as soon as the main thread waits for that lock (a placement, a sync
// command). Our two surfaces never change: their handles are kept here once.

static SURFACE_HANDLES: [AtomicIsize; 2] = [AtomicIsize::new(0), AtomicIsize::new(0)];
/// Remembers the overlay and the halo (once, at startup, from the main thread).
pub fn remember_surfaces(overlay: isize, halo: isize) {
    SURFACE_HANDLES[0].store(overlay, Ordering::Release);
    SURFACE_HANDLES[1].store(halo, Ordering::Release);
}
/// The overlay's handle (0 before the startup remembered it).
pub fn overlay_handle() -> isize { SURFACE_HANDLES[0].load(Ordering::Acquire) }
/// Whether `handle` is the overlay or the halo. Never waits for any thread.
pub fn is_surface(handle: isize) -> bool {
    handle != 0 && SURFACE_HANDLES.iter().any(|known| known.load(Ordering::Acquire) == handle)
}
/// Hides a window by its handle, from any thread (`ShowWindowAsync` posts to the window's
/// thread and never waits for it, nor for our state).
pub fn hide_handle(handle: isize) {
    if handle != 0 { unsafe { let _ = windows::Win32::UI::WindowsAndMessaging::ShowWindowAsync(HWND(handle as *mut _), SW_HIDE); } }
}
/// Whether a window is shown, by its handle, from any thread.
pub fn handle_visible(handle: isize) -> bool {
    handle != 0 && unsafe { IsWindowVisible(HWND(handle as *mut _)).as_bool() }
}

/// The last time the pointer rested near the overlay's surfaces (`now_ms` time, 0: never):
/// the watchdog never closes a bubble the user is on.
static POINTER_NEAR_AT: AtomicU64 = AtomicU64::new(0);
pub fn pointer_near_at() -> u64 { POINTER_NEAR_AT.load(Ordering::Acquire) }

/// The tick of the session's last input (keyboard or mouse, ours included): two equal values
/// prove nobody typed or clicked in between.
pub fn last_input_tick() -> u32 {
    use windows::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};
    let mut info = LASTINPUTINFO { cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32, dwTime: 0 };
    if unsafe { GetLastInputInfo(&mut info) }.as_bool() { info.dwTime } else { 0 }
}

/// The integrity level of a process (its token's mandatory label RID: 0x2000 medium, 0x3000
/// high). `Err(())`: its token could not even be opened.
fn integrity_of(process: windows::Win32::Foundation::HANDLE) -> Result<u32, ()> {
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::Security::{GetSidSubAuthority, GetSidSubAuthorityCount, GetTokenInformation, TokenIntegrityLevel, TOKEN_MANDATORY_LABEL, TOKEN_QUERY};
    use windows::Win32::System::Threading::OpenProcessToken;
    unsafe {
        let mut token = windows::Win32::Foundation::HANDLE::default();
        OpenProcessToken(process, TOKEN_QUERY, &mut token).map_err(|_| ())?;
        let mut size = 0u32;
        let _ = GetTokenInformation(token, TokenIntegrityLevel, None, 0, &mut size);
        let mut buffer = vec![0u8; size.max(1) as usize];
        let read = GetTokenInformation(token, TokenIntegrityLevel, Some(buffer.as_mut_ptr().cast()), size, &mut size);
        let _ = CloseHandle(token);
        read.map_err(|_| ())?;
        let label = &*(buffer.as_ptr() as *const TOKEN_MANDATORY_LABEL);
        let count = *GetSidSubAuthorityCount(label.Label.Sid);
        if count == 0 { return Err(()); }
        Ok(*GetSidSubAuthority(label.Label.Sid, u32::from(count) - 1))
    }
}
/// Whether a window of integrity `theirs` (None: it could not be read) is out of reach of a
/// process of integrity `ours`: Windows (UIPI) then drops our keys and hides its text.
pub fn out_of_reach(ours: Option<u32>, theirs: Option<u32>) -> bool {
    match (ours, theirs) {
        (Some(ours), Some(theirs)) => theirs > ours,
        // Its token is closed to us while ours is readable: it runs above us.
        (Some(_), None) => true,
        (None, _) => false,
    }
}
/// Whether `handle` belongs to a process that runs above ours (an application started as
/// administrator while we are not): it can neither be read nor written.
pub fn window_protected(handle: isize) -> bool {
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Threading::{GetCurrentProcess, OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION};
    if handle == 0 { return false; }
    let mut pid = 0u32;
    unsafe { GetWindowThreadProcessId(HWND(handle as *mut _), Some(&mut pid)); }
    if pid == 0 { return false; }
    let ours = integrity_of(unsafe { GetCurrentProcess() }).ok();
    let theirs = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) }.ok().and_then(|process| {
        let level = integrity_of(process).ok();
        unsafe { let _ = CloseHandle(process); }
        level
    });
    out_of_reach(ours, theirs)
}

#[cfg(test)]
mod tests {
    #[test]
    fn a_fresh_install_speaks_french_on_a_french_windows_and_english_elsewhere() {
        use crate::types::Language;
        // fr-FR, fr-CA, fr-BE, fr-CH; then en-US, en-GB, de-DE, es-ES, ja-JP.
        for langid in [0x040c, 0x0c0c, 0x080c, 0x100c] { assert_eq!(super::language_of(langid), Language::Fr, "{langid:#06x}"); }
        for langid in [0x0409, 0x0809, 0x0407, 0x0c0a, 0x0411, 0] { assert_eq!(super::language_of(langid), Language::En, "{langid:#06x}"); }
    }
    use super::*;

    #[cfg(windows)]
    #[test]
    fn the_clipboard_sequence_is_readable_from_a_worker_thread() {
        // Zero means no access to the window station's clipboard: on a desktop the
        // freshness rule and the synthetic copy would both be blind, so a worker thread
        // must read it too. A CI runner without an interactive desktop reads zero from
        // every thread; there is nothing to check there.
        if clipboard_sequence() == 0 {
            eprintln!("no clipboard sequence in this session (no interactive window station): skipped");
            return;
        }
        let sequence = std::thread::spawn(clipboard_sequence).join().unwrap();
        assert_ne!(sequence, 0);
    }

    #[test]
    fn the_hook_takes_the_source_keys_only_while_the_overlay_never_had_the_foreground() {
        // Review n°2 and n°6: activation refused, the source kept the foreground: the fallback.
        assert!(takes_source_keys(10, 10, false));
        // The overlay had it and the user came back to his document: his keys are his.
        assert!(!takes_source_keys(10, 10, true));
        assert!(!takes_source_keys(20, 10, false), "another window in front");
        assert!(!takes_source_keys(0, 0, false), "no foreground");
    }

    #[test]
    fn only_a_key_that_writes_and_is_not_ours_ends_the_undo_offer() {
        // Letters, digits, Enter, Backspace, arrows, Ctrl+Z's Z: the user acts in the source.
        for vk in [0x41, 0x5A, 0x31, 0x0D, 0x08, 0x2E, 0x25, 0x20] { assert!(ends_undo(vk, 0), "{vk:#x}"); }
        // Another tool's injected keys count too (dictation types into the source).
        assert!(ends_undo(0x41, 0x1234));
        // Our own chords, lone modifiers, lock keys and Escape never do.
        assert!(!ends_undo(0x56, OUR_KEYS));
        for vk in [0x10, 0x11, 0x12, 0xA0, 0xA1, 0xA2, 0xA3, 0xA4, 0xA5, 0x5B, 0x5C, 0x14, 0x90, 0x91, 0x1B] { assert!(!ends_undo(vk, 0), "{vk:#x}"); }
    }

    #[test]
    fn the_marks_end_at_the_users_next_key_click_or_wheel() {
        // Any key that writes or moves, Escape included, another tool's too.
        for vk in [0x41, 0x5A, 0x0D, 0x08, 0x25, 0x20, 0x1B, 0x21] { assert!(ends_marks(vk, 0), "{vk:#x}"); }
        assert!(ends_marks(0x41, 0x1234));
        // Our own paste, lone modifiers and lock keys never do.
        assert!(!ends_marks(0x56, OUR_KEYS));
        for vk in [0x10, 0x11, 0x12, 0xA0, 0xA1, 0xA2, 0xA3, 0xA4, 0xA5, 0x5B, 0x5C, 0x14, 0x90, 0x91] { assert!(!ends_marks(vk, 0), "{vk:#x}"); }
        // A press of any button and the wheel end them; a move or a release does not.
        for message in [0x0201, 0x0204, 0x0207, 0x020B, 0x020A, 0x020E] { assert!(ends_marks_mouse(message), "{message:#x}"); }
        for message in [0x0200, 0x0202, 0x0205, 0x0208, 0x020C] { assert!(!ends_marks_mouse(message), "{message:#x}"); }
    }

    #[test]
    fn the_keyboard_fallback_takes_only_the_menu_keys_and_never_a_chord() {
        let none = || -> Option<char> { panic!("only the letter keys read the layout") };
        assert_eq!(menu_key(0x0D, false, false, none).as_deref(), Some("Enter"));
        assert_eq!(menu_key(0x1B, false, false, none).as_deref(), Some("Escape"));
        assert_eq!(menu_key(0x09, true, false, none).as_deref(), Some("Tab"), "Shift+Tab is a Tab with shift");
        assert_eq!(menu_key(0x28, false, false, none).as_deref(), Some("ArrowDown"));
        assert_eq!(menu_key(0x25, false, false, none).as_deref(), Some("ArrowLeft"));
        // Digits 1 to 6 by key, row or keypad, Shift or not (AZERTY types « & » without it).
        assert_eq!(menu_key(0x31, false, false, none).as_deref(), Some("1"));
        assert_eq!(menu_key(0x36, true, false, none).as_deref(), Some("6"));
        assert_eq!(menu_key(0x63, false, false, none).as_deref(), Some("3"));
        assert_eq!(menu_key(0x37, false, false, none), None, "7 is not in the grid");
        assert_eq!(menu_key(0x30, false, false, none), None);
        // Letters come from the active layout, without any modifier, and must be letters.
        assert_eq!(menu_key(0x46, false, false, || Some('f')).as_deref(), Some("f"));
        assert_eq!(menu_key(0x51, false, false, || Some('a')).as_deref(), Some("a"), "AZERTY: the layout names the key");
        assert_eq!(menu_key(0x46, false, false, || Some('ф')).as_deref(), Some("ф"));
        assert_eq!(menu_key(0x46, true, false, || Some('F')), None, "Shift+letter stays the user's");
        assert_eq!(menu_key(0x46, false, false, || Some('1')), None);
        assert_eq!(menu_key(0x46, false, false, || None), None, "a dead key passes");
        // Space (the free field needs the real WebView), and any chord, are never taken.
        assert_eq!(menu_key(0x20, false, false, none), None);
        for vk in [0x0D, 0x1B, 0x09, 0x28, 0x31, 0x46] { assert_eq!(menu_key(vk, false, true, || Some('f')), None, "{vk:#x} with Ctrl/Alt/Win"); }
    }

    #[test]
    fn a_window_above_our_integrity_is_out_of_reach_and_our_own_is_not() {
        // Medium (0x2000) against high (0x3000): the administrator's window.
        assert!(out_of_reach(Some(0x2000), Some(0x3000)));
        assert!(out_of_reach(Some(0x2000), Some(0x4000)), "a system process");
        assert!(!out_of_reach(Some(0x2000), Some(0x2000)));
        assert!(!out_of_reach(Some(0x3000), Some(0x2000)), "we run as administrator: everything is in reach");
        assert!(!out_of_reach(Some(0x2000), Some(0x1000)), "a sandboxed (low) window");
        // Its token is closed to us: it runs above us. Ours unreadable: nothing is claimed.
        assert!(out_of_reach(Some(0x2000), None));
        assert!(!out_of_reach(None, Some(0x3000)));
        assert!(!out_of_reach(None, None));
        // No window at all is never protected, and our own process reads its own level.
        assert!(!window_protected(0));
        assert!(integrity_of(unsafe { windows::Win32::System::Threading::GetCurrentProcess() }).is_ok());
    }

    #[test]
    fn the_surfaces_are_known_by_their_handles_without_any_window_call() {
        assert!(!is_surface(0));
        remember_surfaces(41, 42);
        assert!(is_surface(41) && is_surface(42) && !is_surface(43) && !is_surface(0));
        assert_eq!(overlay_handle(), 41);
        remember_surfaces(0, 0);
        assert!(!is_surface(41));
        assert!(!handle_visible(0));
        hide_handle(0);
        // The session's last input is a tick that never goes backwards.
        let first = last_input_tick();
        assert!(last_input_tick().wrapping_sub(first) < 60_000);
    }

    #[test]
    fn the_memory_key_is_the_lowercase_executable_name_only() {
        assert_eq!(executable_name("C:\\Windows\\System32\\Notepad.exe").as_deref(), Some("notepad.exe"));
        assert_eq!(executable_name("C:/Program Files/Google/Chrome/Application/chrome.exe").as_deref(), Some("chrome.exe"));
        assert_eq!(executable_name("WINWORD.EXE").as_deref(), Some("winword.exe"));
        assert_eq!(executable_name("C:\\dir\\"), None);
        assert_eq!(executable_name(""), None);
    }

    /// Only on a layout this session already has (none is ever loaded for the test):
    /// French AZERTY types € with AltGr+E and @ with AltGr+0, US English has no AltGr.
    #[test]
    fn altgr_is_read_on_a_known_layout_when_the_session_has_one() {
        let layouts = keyboard_layouts();
        let find = |id: usize| layouts.iter().copied().find(|layout| layout.0 as usize & 0xFFFF_FFFF == id);
        let (french, us) = (find(0x040C_040C), find(0x0409_0409));
        if french.is_none() && us.is_none() {
            eprintln!("no French AZERTY nor US layout loaded in this session: skipped");
            return;
        }
        if let Some(french) = french {
            assert_eq!(altgr_character_in(french, 0x45, false), Some('€'));
            assert_eq!(altgr_character_in(french, 0x30, false), Some('@'));
            assert_eq!(altgr_character_in(french, 0x41, false), None, "AltGr+A types nothing");
        }
        if let Some(us) = us {
            assert_eq!(altgr_character_in(us, 0x45, false), None);
            assert_eq!(altgr_character_in(us, 0x20, false), None);
        }
    }

    #[test]
    fn the_pointer_counts_as_near_within_the_margin_around_any_surface() {
        let regions = [
            SurfaceRegion { x: 32., y: 34., width: 300., height: 120., radius: 28. },
            SurfaceRegion { x: 160., y: 200., width: 44., height: 20., radius: 10. },
        ];
        // Just outside the glass box, inside the margin; the corner is judged on the box.
        assert!(near(&regions, 1., 20., 40., 32.));
        assert!(near(&regions, 1., 32., 34., 32.));
        assert!(near(&regions, 1., 340., 160., 32.));
        // Beyond the margin, and in the gap between the two surfaces once the margin is spent.
        assert!(!near(&regions, 1., -1., 40., 32.));
        assert!(!near(&regions, 1., 500., 500., 32.));
        assert!(!near(&regions, 1., 100., 300., 32.));
        // The margin is logical: at 150 % it stretches with the surfaces.
        assert!(near(&regions, 1.5, 0., 51., 32.));
        assert!(!near(&regions, 1.5, 0., 0., 32.));
    }

    #[test]
    fn rounded_surfaces_take_the_cursor_and_the_gaps_let_it_through() {
        let regions = [
            SurfaceRegion { x: 0., y: 20., width: 280., height: 80., radius: 26. },
            SurfaceRegion { x: 210., y: 0., width: 60., height: 18., radius: 9. },
        ];
        assert!(contains(&regions, 1., 140.5, 50.5), "glass");
        assert!(contains(&regions, 1., 240.5, 9.5), "pill");
        assert!(!contains(&regions, 1., 100.5, 9.5), "gap above the glass");
        assert!(!contains(&regions, 1., 0.5, 20.5), "outside the corner arc");
        assert!(contains(&regions, 1., 26.5, 46.5), "corner centre");
        assert!(contains(&regions, 2., 280.5, 100.5), "scaled glass");
        assert!(!contains(&regions, 2., 140.5, 19.5), "scaled gap");
        assert!(!contains(&[], 1., 10., 10.), "no surface");
    }
}
