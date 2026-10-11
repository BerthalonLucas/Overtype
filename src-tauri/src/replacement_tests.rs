//! Native side of the real replacement bench (QA-03). Test builds only: this module is
//! `#[cfg(test)]` and its one test is `#[ignore]`d, so neither `cargo test` nor the shipped
//! application runs it. scripts/test-replacement-windows.mjs starts it, owns the synthetic
//! documents and the applications, and sends one JSON command per connection on a loopback
//! port. Every command calls the application's own capture, paste and undo; the faults it
//! injects (`capture::faults`, `host::faults`) exist in test builds only. The answers carry
//! lengths and yes/no comparisons with what the bench sent, never a text read from a window.
use crate::capture;
use crate::error::{AppError, ErrorKind};
use crate::host;
use crate::pasted;
use crate::types::{TargetCheck, TargetIdentity, UndoStrategy};
use serde_json::{json, Value};
use std::io::{BufRead, BufReader, Write};
use std::time::{Duration, Instant};

#[test]
#[ignore = "drives the real Windows desktop: npm run test:replacement"]
fn replacement_desktop_driver() {
    let port_file = std::env::var("FLOWTRANSLATE_REPLACEMENT_PORT_FILE")
        .expect("started by scripts/test-replacement-windows.mjs");
    // Physical pixels everywhere, as in the application (UI Automation answers physical ones).
    unsafe {
        use windows::Win32::UI::HiDpi::{
            SetProcessDpiAwarenessContext, DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2,
        };
        let _ = SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
    }
    let listener = std::net::TcpListener::bind("127.0.0.1:0").expect("loopback port");
    let port = listener.local_addr().expect("port").port();
    std::fs::write(&port_file, port.to_string()).expect("port file");
    let mut bench = Bench::default();
    for stream in listener.incoming() {
        let Ok(mut stream) = stream else { continue };
        let mut line = String::new();
        if BufReader::new(&stream).read_line(&mut line).is_err() {
            continue;
        }
        let command: Value = serde_json::from_str(&line).unwrap_or(Value::Null);
        let quit = command["op"] == "quit";
        let response = if quit {
            json!({"ok": true})
        } else {
            bench.run(&command)
        };
        let _ = writeln!(stream, "{response}");
        if quit {
            break;
        }
    }
    keys::release_all();
}

/// What a successful paste left for Undo, as `schedule_auto_delivery` keeps it in `Applied`.
struct Applied {
    window: isize,
    control: isize,
    runtime_id: Option<Vec<i32>>,
    located: pasted::Located,
    original: String,
    pasted: String,
}

#[derive(Default)]
struct Bench {
    /// The target of the last capture, when it may be pasted over (`can_replace`).
    target: Option<TargetIdentity>,
    applied: Option<Applied>,
}

fn refused(error: &AppError) -> Value {
    json!({"ok": false, "kind": error.kind, "reason": error.reason, "message": error.message})
}

fn text_arg<'a>(command: &'a Value, name: &str) -> &'a str {
    command[name].as_str().unwrap_or_default()
}

fn millis(command: &Value, name: &str, default: u64) -> Duration {
    Duration::from_millis(command[name].as_u64().unwrap_or(default))
}

impl Bench {
    fn run(&mut self, command: &Value) -> Value {
        match command["op"].as_str().unwrap_or_default() {
            "ping" => json!({"ok": true}),
            "focus" => windows_::focus(text_arg(command, "title")),
            "foreground" => windows_::describe(host::foreground()),
            "capture" => self.capture(command),
            "replace" => self.replace(command),
            "undo" => self.undo(),
            "clipboard-seed" => clip::seed(text_arg(command, "kind"), text_arg(command, "text")),
            "clipboard-state" => clip::state(text_arg(command, "text")),
            "keys" => {
                keys::chord(text_arg(command, "keys"));
                json!({"ok": true})
            }
            "key-state" => keys::state(),
            "release-keys" => {
                keys::release_all();
                json!({"ok": true})
            }
            "drag" => windows_::drag(command),
            "uia-selection" => uia_selection(),
            // NATIVE-012 where no installed editor shows a multiple selection to UI Automation:
            // the capture's own choice among the ranges of a simulated provider.
            "multi-range-sim" => json!({
                "ok": true,
                "single": capture::selected_range(vec!["bloc"]).is_ok(),
                "multipleRefused": capture::selected_range(vec!["premier bloc", "second bloc"]).is_err(),
            }),
            "text-rect" => text_rect(text_arg(command, "text")),
            "uia-silent" => {
                capture::faults::silence_uia(command["silent"].as_bool().unwrap_or(false));
                json!({"ok": true})
            }
            "copy-partial" => self.copy_partial(command),
            "paste-partial" => self.paste_partial(command),
            "close-during-paste" => self.close_during_paste(command),
            other => json!({"ok": false, "message": format!("unknown op {other}")}),
        }
    }

    /// The shortcut's capture of the window in front (`copy`: the synthetic-copy route only,
    /// as for an application without UI Automation). `expect`: the text the bench selected,
    /// compared here so that no text leaves the driver.
    fn capture(&mut self, command: &Value) -> Value {
        self.target = None;
        self.applied = None;
        let window = host::foreground();
        let class = host::window_class(window);
        let sequence = host::clipboard_sequence();
        // NATIVE-003: another application (a window of the driver's own, never the source's)
        // writes the clipboard `delayMs` after the capture starts, whatever the source copies.
        if let Some(text) = command["writer"]["text"].as_str() {
            clip::write_after(text.to_owned(), millis(&command["writer"], "delayMs", 120));
        }
        let captured = if command["copy"].as_bool().unwrap_or(false) {
            capture::clipboard_capture(window, &class)
        } else {
            capture::capture_current(false, window)
        };
        let clipboard_moved = host::clipboard_sequence() != sequence;
        let mut answer = match captured {
            Ok(stored) => {
                let text = capture::canonical(&stored.public.text);
                let expected = capture::canonical(text_arg(command, "expect"));
                let replaceable = stored.public.can_replace && stored.target.is_some();
                let route = stored.target.as_ref().map(|t| match t.check {
                    TargetCheck::Uia => "uia",
                    TargetCheck::Copy => "copy",
                });
                let answer = json!({
                    "ok": true,
                    "origin": stored.public.origin,
                    "replaceable": replaceable,
                    "route": route,
                    "selectedLength": text.chars().count(),
                    "matches": text == expected,
                    "matchesTrimmed": text.trim() == expected.trim(),
                });
                if replaceable {
                    self.target = stored.target;
                }
                answer
            }
            Err(error) => refused(&error),
        };
        answer["clipboardMoved"] = json!(clipboard_moved);
        answer
    }

    /// The automatic delivery of `schedule_auto_delivery`: nothing when another application
    /// is in front, else `capture::paste` (the source brought back if one of our windows held
    /// it), then the pasted text located for Undo. `race`: another application copies while our
    /// text is on the clipboard, right after the paste landed.
    fn replace(&mut self, command: &Value) -> Value {
        let value = text_arg(command, "value").to_owned();
        let Some(target) = self.target.take() else {
            return refused(
                &AppError::new(
                    ErrorKind::NotEditable,
                    "Aucune sélection à remplacer; le résultat reste dans la bulle.",
                )
                .because("nothing to write"),
            );
        };
        let fg = host::foreground();
        if fg != target.native_window && !host::is_surface(fg) {
            return refused(
                &AppError::new(
                    ErrorKind::TargetChanged,
                    "La fenêtre source a changé; remplacement refusé.",
                )
                .because("window at delivery"),
            );
        }
        let racer = command["race"]
            .as_bool()
            .unwrap_or(false)
            .then(|| clip::race_after_paste(value.clone(), target.native_window));
        let started = Instant::now();
        let outcome = capture::paste(&target, &value, true, capture::Ticket::current());
        let took = started.elapsed().as_millis() as u64;
        let raced = racer.map(|racer| racer.join().unwrap_or(false));
        match outcome {
            Ok(delivery) => {
                let located = crate::locate_pasted(&value, target.native_window);
                let undoable = located.is_some();
                self.applied = located.map(|located| Applied {
                    window: target.native_window,
                    control: target.control,
                    runtime_id: target.runtime_id.clone(),
                    located,
                    original: target.selected_text.clone(),
                    pasted: value,
                });
                json!({"ok": true, "confirmed": delivery.confirmed, "undoable": undoable,
                       "raced": raced, "ms": took})
            }
            Err(error) => {
                let mut answer = refused(&error);
                answer["raced"] = json!(raced);
                answer["ms"] = json!(took);
                answer
            }
        }
    }

    /// Undo as `undo_result` does it: Ctrl+Z (the default strategy) after the checks.
    fn undo(&mut self) -> Value {
        let Some(applied) = self.applied.take() else {
            return json!({"ok": false, "status": "not offered", "reason": "pasted text not located"});
        };
        let fg = host::foreground();
        if fg != applied.window && !host::is_surface(fg) {
            return json!({"ok": false, "status": "refused", "reason": "window"});
        }
        let target = pasted::UndoTarget {
            window: applied.window,
            control: applied.control,
            runtime_id: applied.runtime_id.as_deref(),
            located: &applied.located,
            original: &applied.original,
            pasted: &applied.pasted,
        };
        match pasted::undo(
            &target,
            UndoStrategy::Keystroke,
            true,
            capture::Ticket::current(),
        ) {
            Ok(confirmed) => json!({"ok": true, "confirmed": confirmed}),
            Err(pasted::UndoFailure::Refused(error)) => {
                let mut answer = refused(&error);
                answer["status"] = json!("refused");
                answer
            }
            Err(pasted::UndoFailure::Failed(error)) => {
                let mut answer = refused(&error);
                answer["status"] = json!("failed");
                answer
            }
        }
    }

    /// NATIVE-007: the copy chord of a capture is cut after `taken` inputs (SendInput stopped
    /// part-way). Answers which keys Windows still holds down afterwards, then releases them.
    fn copy_partial(&mut self, command: &Value) -> Value {
        self.target = None;
        let window = host::foreground();
        let class = host::window_class(window);
        host::faults::cut_next_chord(command["taken"].as_u64().unwrap_or(2) as usize);
        let captured = capture::clipboard_capture(window, &class);
        std::thread::sleep(Duration::from_millis(150));
        let mut answer = match captured {
            Ok(_) => json!({"ok": true}),
            Err(error) => refused(&error),
        };
        answer["held"] = keys::state()["held"].clone();
        keys::release_all();
        answer
    }

    /// The same cut on the paste chord of the captured target (the paste already releases).
    fn paste_partial(&mut self, command: &Value) -> Value {
        let Some(target) = self.target.take() else {
            return json!({"ok": false, "message": "no target"});
        };
        host::faults::cut_next_chord(command["taken"].as_u64().unwrap_or(1) as usize);
        let outcome = capture::paste(
            &target,
            text_arg(command, "value"),
            true,
            capture::Ticket::current(),
        );
        std::thread::sleep(Duration::from_millis(150));
        let mut answer = match outcome {
            Ok(delivery) => json!({"ok": true, "confirmed": delivery.confirmed}),
            Err(error) => refused(&error),
        };
        answer["held"] = keys::state()["held"].clone();
        keys::release_all();
        answer
    }

    /// NATIVE-006, the order of `force_close` around a delivery: the delivery holds the state
    /// lock through `capture::paste` (as `schedule_auto_delivery` does, with the session's ticket
    /// taken before) while UI Automation hangs for `stallMs`; `closeAfterMs` later the emergency
    /// exit revokes the deliveries, then asks for the same lock and forgets the state
    /// (`Inner::close_now`). The bubble itself is hidden at once by handle in the application;
    /// there is none here. Answers when each step happened.
    fn close_during_paste(&mut self, command: &Value) -> Value {
        let Some(target) = self.target.take() else {
            return json!({"ok": false, "message": "no target"});
        };
        let value = text_arg(command, "value").to_owned();
        let stall = millis(command, "stallMs", 1_500);
        let close_after = millis(command, "closeAfterMs", 300);
        let inner = std::sync::Arc::new(std::sync::Mutex::new(crate::Inner::new(
            crate::types::Settings::default(),
        )));
        let ticket = capture::Ticket::current();
        let started = Instant::now();
        let delivery = {
            let inner = inner.clone();
            std::thread::spawn(move || {
                let _held = inner.lock().unwrap_or_else(|p| p.into_inner());
                capture::faults::stall_next_uia(stall);
                let outcome = capture::paste(&target, &value, true, ticket);
                (outcome, started.elapsed())
            })
        };
        std::thread::sleep(close_after);
        let requested = started.elapsed();
        // As `force_close`: revoked first, without the lock the delivery holds.
        capture::revoke_deliveries();
        let was = match inner.lock() {
            Ok(mut i) => i.close_now(),
            Err(_) => "state unavailable",
        };
        let closed = started.elapsed();
        let (outcome, returned) = delivery.join().unwrap_or((
            Err(AppError::internal("delivery panicked")),
            started.elapsed(),
        ));
        let mut answer = match outcome {
            Ok(delivery) => json!({"ok": true, "confirmed": delivery.confirmed}),
            Err(error) => refused(&error),
        };
        answer["closeRequestedMs"] = json!(requested.as_millis() as u64);
        answer["closeDoneMs"] = json!(closed.as_millis() as u64);
        answer["pasteReturnedMs"] = json!(returned.as_millis() as u64);
        answer["was"] = json!(was);
        answer
    }
}

/// How many ranges the focused element's selection has, and their lengths (never their text):
/// whether a multiple selection is visible to UI Automation (NATIVE-012).
fn uia_selection() -> Value {
    use uiautomation::patterns::UITextPattern;
    let Some(element) = capture::focused_element() else {
        return json!({"ok": false, "message": "no focused element"});
    };
    let class = element.get_classname().unwrap_or_default();
    let control = element
        .get_control_type()
        .map(|t| format!("{t:?}"))
        .unwrap_or_default();
    let Ok(pattern) = element.get_pattern::<UITextPattern>() else {
        return json!({"ok": false, "message": "no text pattern", "class": class, "control": control});
    };
    let ranges = pattern.get_selection().unwrap_or_default();
    let lengths: Vec<usize> = ranges
        .iter()
        .map(|range| range.get_text(-1).map_or(0, |t| t.chars().count()))
        .collect();
    json!({"ok": true, "ranges": ranges.len(), "lengths": lengths, "class": class, "control": control})
}

/// Where `text` shows in the focused element (physical pixels, the first visible run): the
/// bench drags over words it wrote itself.
fn text_rect(text: &str) -> Value {
    use uiautomation::patterns::UITextPattern;
    let found = capture::focused_element()
        .and_then(|element| element.get_pattern::<UITextPattern>().ok())
        .and_then(|pattern| pattern.get_document_range().ok())
        .and_then(|document| document.find_text(text, false, false).ok());
    let Some(range) = found else {
        return json!({"ok": false});
    };
    let rects = capture::range_rects(&range);
    match rects.first() {
        Some(r) => json!({"ok": true, "x": r.x, "y": r.y, "width": r.width, "height": r.height}),
        None => json!({"ok": false}),
    }
}

/// Keys pressed the way a user (or the bench) would, never marked as the application's own.
mod keys {
    use serde_json::{json, Value};
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        GetAsyncKeyState, SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYBD_EVENT_FLAGS,
        KEYEVENTF_EXTENDEDKEY, KEYEVENTF_KEYUP, VIRTUAL_KEY,
    };

    fn code(name: &str) -> Option<(u16, bool)> {
        Some(match name {
            "ctrl" => (0x11, false),
            "shift" => (0x10, false),
            "alt" => (0x12, false),
            "esc" => (0x1B, false),
            "enter" => (0x0D, false),
            "f8" => (0x77, false),
            "home" => (0x24, true),
            "end" => (0x23, true),
            "left" => (0x25, true),
            "up" => (0x26, true),
            "right" => (0x27, true),
            "down" => (0x28, true),
            "insert" => (0x2D, true),
            "delete" => (0x2E, true),
            key if key.len() == 1 && key.as_bytes()[0].is_ascii_alphanumeric() => {
                (u16::from(key.as_bytes()[0].to_ascii_uppercase()), false)
            }
            _ => return None,
        })
    }
    fn input(vk: u16, extended: bool, up: bool) -> INPUT {
        let mut flags = KEYBD_EVENT_FLAGS(0);
        if extended {
            flags |= KEYEVENTF_EXTENDEDKEY;
        }
        if up {
            flags |= KEYEVENTF_KEYUP;
        }
        INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: VIRTUAL_KEY(vk),
                    wScan: 0,
                    dwFlags: flags,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        }
    }
    fn send(inputs: &[INPUT]) {
        unsafe {
            SendInput(inputs, std::mem::size_of::<INPUT>() as i32);
        }
    }
    /// `ctrl+shift+z`: every key pressed in order, then released in reverse.
    pub fn chord(keys: &str) {
        let codes: Vec<(u16, bool)> = keys.split('+').filter_map(code).collect();
        let mut inputs: Vec<INPUT> = codes.iter().map(|&(vk, e)| input(vk, e, false)).collect();
        inputs.extend(codes.iter().rev().map(|&(vk, e)| input(vk, e, true)));
        send(&inputs);
        std::thread::sleep(std::time::Duration::from_millis(60));
    }
    pub fn press(name: &str, up: bool) {
        if let Some((vk, extended)) = code(name) {
            send(&[input(vk, extended, up)]);
        }
    }
    const WATCHED: [(&str, u16); 5] = [
        ("ctrl", 0x11),
        ("shift", 0x10),
        ("alt", 0x12),
        ("insert", 0x2D),
        ("v", 0x56),
    ];
    /// The keys Windows holds down now, by name.
    pub fn state() -> Value {
        let held: Vec<&str> = WATCHED
            .iter()
            .filter(|(_, vk)| unsafe { GetAsyncKeyState(i32::from(*vk)) } < 0)
            .map(|(name, _)| *name)
            .collect();
        json!({"ok": true, "held": held})
    }
    /// Every key the bench or a cut chord may have left down goes up.
    pub fn release_all() {
        let ups: Vec<INPUT> = [
            ("insert", true),
            ("v", false),
            ("ctrl", false),
            ("shift", false),
            ("alt", false),
        ]
        .iter()
        .filter_map(|(name, _)| code(name))
        .map(|(vk, extended)| input(vk, extended, true))
        .collect();
        send(&ups);
    }
}

/// Windows: found by title, brought to the front, described; the mouse for a drag.
mod windows_ {
    use serde_json::{json, Value};
    use windows::core::BOOL;
    use windows::Win32::Foundation::{HWND, LPARAM};
    use windows::Win32::System::Threading::{AttachThreadInput, GetCurrentThreadId};
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_0, INPUT_MOUSE, MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP,
        MOUSEINPUT, MOUSE_EVENT_FLAGS,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        BringWindowToTop, EnumWindows, GetForegroundWindow, GetWindowTextW,
        GetWindowThreadProcessId, IsIconic, IsWindowVisible, SetCursorPos, SetForegroundWindow,
        ShowWindow, SW_RESTORE,
    };

    fn title(hwnd: HWND) -> String {
        let mut buffer = [0u16; 512];
        let length = unsafe { GetWindowTextW(hwnd, &mut buffer) };
        String::from_utf16_lossy(&buffer[..length.max(0) as usize])
    }
    fn find(fragment: &str) -> Option<HWND> {
        struct Search<'a> {
            fragment: &'a str,
            found: Option<HWND>,
        }
        unsafe extern "system" fn visit(hwnd: HWND, lparam: LPARAM) -> BOOL {
            let search = unsafe { &mut *(lparam.0 as *mut Search) };
            if unsafe { IsWindowVisible(hwnd) }.as_bool() && title(hwnd).contains(search.fragment) {
                search.found = Some(hwnd);
                return BOOL(0);
            }
            BOOL(1)
        }
        let mut search = Search {
            fragment,
            found: None,
        };
        unsafe {
            let _ = EnumWindows(Some(visit), LPARAM(&mut search as *mut Search as isize));
        }
        search.found
    }
    pub fn describe(handle: isize) -> Value {
        json!({"ok": true, "hwnd": handle, "class": crate::host::window_class(handle),
               "title": title(HWND(handle as *mut _))})
    }
    /// Brings the first visible window whose title holds `fragment` to the front: the input of
    /// the bench is attached to the window in front for the moment of the switch, which Windows
    /// asks of a process that is not in front itself.
    pub fn focus(fragment: &str) -> Value {
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(15);
        let Some(hwnd) = (loop {
            if let Some(hwnd) = find(fragment) {
                break Some(hwnd);
            }
            if std::time::Instant::now() >= deadline {
                break None;
            }
            std::thread::sleep(std::time::Duration::from_millis(200));
        }) else {
            return json!({"ok": false, "message": "window not found"});
        };
        for _ in 0..10 {
            unsafe {
                let front = GetForegroundWindow();
                let theirs = GetWindowThreadProcessId(front, None);
                let ours = GetCurrentThreadId();
                let attached = theirs != 0
                    && theirs != ours
                    && AttachThreadInput(ours, theirs, true).as_bool();
                if IsIconic(hwnd).as_bool() {
                    let _ = ShowWindow(hwnd, SW_RESTORE);
                }
                let _ = BringWindowToTop(hwnd);
                let _ = SetForegroundWindow(hwnd);
                if attached {
                    let _ = AttachThreadInput(ours, theirs, false);
                }
            }
            std::thread::sleep(std::time::Duration::from_millis(150));
            if unsafe { GetForegroundWindow() } == hwnd {
                return describe(hwnd.0 as isize);
            }
        }
        json!({"ok": false, "message": "foreground refused"})
    }
    fn button(flags: MOUSE_EVENT_FLAGS) {
        let input = INPUT {
            r#type: INPUT_MOUSE,
            Anonymous: INPUT_0 {
                mi: MOUSEINPUT {
                    dx: 0,
                    dy: 0,
                    mouseData: 0,
                    dwFlags: flags,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        };
        unsafe {
            SendInput(&[input], std::mem::size_of::<INPUT>() as i32);
        }
    }
    /// A left-button drag from `from` to `to` (physical pixels), Ctrl held when `ctrl`.
    pub fn drag(command: &Value) -> Value {
        let point = |name: &str| {
            (
                command[name][0].as_f64().unwrap_or_default().round() as i32,
                command[name][1].as_f64().unwrap_or_default().round() as i32,
            )
        };
        let ((x1, y1), (x2, y2)) = (point("from"), point("to"));
        let ctrl = command["ctrl"].as_bool().unwrap_or(false);
        let pause = || std::thread::sleep(std::time::Duration::from_millis(40));
        unsafe {
            let _ = SetCursorPos(x1, y1);
        }
        pause();
        if ctrl {
            super::keys::press("ctrl", false);
            pause();
        }
        button(MOUSEEVENTF_LEFTDOWN);
        pause();
        for step in 1..=8 {
            let x = x1 + (x2 - x1) * step / 8;
            let y = y1 + (y2 - y1) * step / 8;
            unsafe {
                let _ = SetCursorPos(x, y);
            }
            pause();
        }
        button(MOUSEEVENTF_LEFTUP);
        pause();
        if ctrl {
            super::keys::press("ctrl", true);
        }
        std::thread::sleep(std::time::Duration::from_millis(200));
        json!({"ok": true})
    }
}

/// The clipboard as other applications write it: synthetic contents only.
mod clip {
    use serde_json::{json, Value};
    use std::ffi::c_void;
    use std::ptr::null_mut;
    use std::time::Duration;

    type Handle = *mut c_void;
    #[link(name = "user32")]
    unsafe extern "system" {
        fn OpenClipboard(owner: Handle) -> i32;
        fn CloseClipboard() -> i32;
        fn EmptyClipboard() -> i32;
        fn GetClipboardData(format: u32) -> Handle;
        fn SetClipboardData(format: u32, data: Handle) -> Handle;
        fn IsClipboardFormatAvailable(format: u32) -> i32;
        fn RegisterClipboardFormatW(name: *const u16) -> u32;
        fn CountClipboardFormats() -> i32;
    }
    #[link(name = "kernel32")]
    unsafe extern "system" {
        fn GlobalAlloc(flags: u32, bytes: usize) -> Handle;
        fn GlobalLock(memory: Handle) -> Handle;
        fn GlobalUnlock(memory: Handle) -> i32;
        fn GlobalSize(memory: Handle) -> usize;
    }
    #[link(name = "gdi32")]
    unsafe extern "system" {
        fn CreateEnhMetaFileW(
            reference: Handle,
            file: *const u16,
            frame: *const c_void,
            description: *const u16,
        ) -> Handle;
        fn Rectangle(dc: Handle, left: i32, top: i32, right: i32, bottom: i32) -> i32;
        fn CloseEnhMetaFile(dc: Handle) -> Handle;
    }
    const CF_UNICODETEXT: u32 = 13;
    const CF_ENHMETAFILE: u32 = 14;
    /// The private format the bench puts beside its text: a rich clipboard must come back whole.
    const BENCH_BYTES: [u8; 8] = [0x42, 0x45, 0x4e, 0x43, 0x48, 1, 2, 3];
    pub const NEWER: &str = "copie plus récente d’une autre application 📋";

    fn bench_format() -> u32 {
        let name: Vec<u16> = "ReplacementBenchFormat"
            .encode_utf16()
            .chain(Some(0))
            .collect();
        unsafe { RegisterClipboardFormatW(name.as_ptr()) }
    }
    fn utf16(text: &str) -> Vec<u8> {
        text.encode_utf16()
            .chain(Some(0))
            .flat_map(u16::to_le_bytes)
            .collect()
    }
    fn global(bytes: &[u8]) -> Handle {
        unsafe {
            let memory = GlobalAlloc(0x42, bytes.len().max(1));
            let pointer = GlobalLock(memory);
            std::ptr::copy_nonoverlapping(bytes.as_ptr(), pointer.cast(), bytes.len());
            GlobalUnlock(memory);
            memory
        }
    }
    /// A picture as Office puts one beside its text: an enhanced metafile, which lives with
    /// Windows and cannot be duplicated in memory (`Snapshot::capture` refuses it).
    fn metafile() -> Handle {
        unsafe {
            let dc = CreateEnhMetaFileW(null_mut(), null_mut(), null_mut(), null_mut());
            Rectangle(dc, 0, 0, 40, 20);
            CloseEnhMetaFile(dc)
        }
    }
    /// Opens the clipboard for another application's window (owned by it, as a real copy).
    struct Session(windows::Win32::Foundation::HWND);
    impl Session {
        fn open() -> Option<Self> {
            use windows::{
                core::w,
                Win32::UI::WindowsAndMessaging::{
                    CreateWindowExW, HWND_MESSAGE, WINDOW_EX_STYLE, WINDOW_STYLE,
                },
            };
            let hwnd = unsafe {
                CreateWindowExW(
                    WINDOW_EX_STYLE::default(),
                    w!("STATIC"),
                    w!(""),
                    WINDOW_STYLE::default(),
                    0,
                    0,
                    0,
                    0,
                    Some(HWND_MESSAGE),
                    None,
                    None,
                    None,
                )
            }
            .ok()?;
            for _ in 0..200 {
                if unsafe { OpenClipboard(hwnd.0) } != 0 {
                    return Some(Self(hwnd));
                }
                std::thread::sleep(Duration::from_millis(10));
            }
            None
        }
    }
    impl Drop for Session {
        fn drop(&mut self) {
            unsafe {
                CloseClipboard();
                let _ = windows::Win32::UI::WindowsAndMessaging::DestroyWindow(self.0);
            }
        }
    }
    fn write(text: &str, unkeepable: bool) -> bool {
        let Some(_session) = Session::open() else {
            return false;
        };
        unsafe {
            EmptyClipboard();
            SetClipboardData(CF_UNICODETEXT, global(&utf16(text)));
            if unkeepable {
                SetClipboardData(CF_ENHMETAFILE, metafile());
            } else {
                SetClipboardData(bench_format(), global(&BENCH_BYTES));
            }
        }
        true
    }
    /// An autonomous writer: another application copies `text` (and the bench's private format)
    /// `delay` from now, on its own thread.
    pub fn write_after(text: String, delay: Duration) {
        std::thread::spawn(move || {
            std::thread::sleep(delay);
            write(&text, false);
        });
    }
    /// `rich`: the text and a private format; `unkeepable`: the text and a metafile.
    pub fn seed(kind: &str, text: &str) -> Value {
        let written = write(text, kind == "unkeepable");
        std::thread::sleep(Duration::from_millis(50));
        json!({"ok": written, "sequence": crate::host::clipboard_sequence()})
    }
    fn read(format: u32) -> Option<Vec<u8>> {
        let handle = unsafe { GetClipboardData(format) };
        if handle.is_null() {
            return None;
        }
        unsafe {
            let size = GlobalSize(handle);
            let pointer = GlobalLock(handle);
            if pointer.is_null() {
                return None;
            }
            let bytes = std::slice::from_raw_parts(pointer.cast::<u8>(), size).to_vec();
            GlobalUnlock(handle);
            Some(bytes)
        }
    }
    fn text() -> Option<String> {
        let bytes = read(CF_UNICODETEXT)?;
        let units: Vec<u16> = bytes
            .as_chunks::<2>()
            .0
            .iter()
            .map(|pair| u16::from_le_bytes(*pair))
            .take_while(|unit| *unit != 0)
            .collect();
        Some(String::from_utf16_lossy(&units))
    }
    /// What the clipboard holds now, compared with what the bench wrote (`expected`).
    pub fn state(expected: &str) -> Value {
        let Some(_session) = Session::open() else {
            return json!({"ok": false, "message": "clipboard busy"});
        };
        let text = text();
        let bench = unsafe { IsClipboardFormatAvailable(bench_format()) } != 0
            && read(bench_format()).is_some_and(|bytes| bytes.starts_with(&BENCH_BYTES));
        json!({
            "ok": true,
            "textMatches": text.as_deref() == Some(expected),
            "newerCopy": text.as_deref() == Some(NEWER),
            "textLength": text.map(|t| t.chars().count()),
            "benchFormat": bench,
            "metafile": unsafe { IsClipboardFormatAvailable(CF_ENHMETAFILE) } != 0,
            "formats": unsafe { CountClipboardFormats() },
            "sequence": crate::host::clipboard_sequence(),
        })
    }
    /// Another application copies right after the paste of `value` landed in `window` (read
    /// back through UI Automation on this thread), while our text is still on the clipboard.
    pub fn race_after_paste(value: String, window: isize) -> std::thread::JoinHandle<bool> {
        std::thread::spawn(move || {
            let started = std::time::Instant::now();
            let wanted = crate::capture::canonical(&value);
            while started.elapsed() < Duration::from_secs(3) {
                if crate::capture::field_text(window)
                    .is_some_and(|text| crate::capture::canonical(&text).contains(&wanted))
                {
                    return write(NEWER, false);
                }
                std::thread::sleep(Duration::from_millis(15));
            }
            false
        })
    }
}
