//! Short-lived clipboard transaction around a synthetic copy or paste (0.4.0, taken from
//! the multi-format guard of PR 6): every in-memory format is snapshotted before the
//! clipboard is touched, our own text is written with the monitoring/history opt-outs, and
//! the snapshot is put back unless somebody else wrote the clipboard in between, so a copy
//! the user makes is never overwritten. Nothing here logs any content.
//!
//! 0.6 (the field test of 0.5.1: the clipboard came back holding the selected text in
//! Notepad++, LibreOffice Writer and Win+R). The restoration used to be refused whenever the
//! sequence number was no longer the one sampled right after the copy. But a copy is not one
//! step: Scintilla empties the clipboard, then sets its text, then its own formats; an OLE
//! clipboard (LibreOffice) renders its text only when it is read. Each of these moves the
//! sequence after the sample, and the user's clipboard was then never put back. Now:
//!   - after a copy (`take_copy`): the counter must rest, then the text is read and the
//!     snapshot put back within one clipboard session, so nothing can come in between;
//!   - after our own write (`restore_ours`): the proof is the ownership of the clipboard,
//!     which only another writer takes away, never a counter;
//!   - a copy that lands after we stopped waiting is still undone (`watch_late`), as long as
//!     the session saw no input since (the user did nothing: that copy is ours).
use std::{ffi::c_void, ptr::null_mut, time::{Duration, Instant}};

type Handle = *mut c_void;
#[link(name = "user32")]
unsafe extern "system" {
    fn OpenClipboard(owner: Handle) -> i32;
    fn CloseClipboard() -> i32;
    fn EmptyClipboard() -> i32;
    fn EnumClipboardFormats(format: u32) -> u32;
    fn GetClipboardData(format: u32) -> Handle;
    fn SetClipboardData(format: u32, data: Handle) -> Handle;
    fn GetClipboardSequenceNumber() -> u32;
    fn GetClipboardOwner() -> Handle;
    fn RegisterClipboardFormatW(name: *const u16) -> u32;
    fn IsClipboardFormatAvailable(format: u32) -> i32;
}
#[link(name = "kernel32")]
unsafe extern "system" {
    fn GlobalSize(memory: Handle) -> usize;
    fn GlobalLock(memory: Handle) -> Handle;
    fn GlobalUnlock(memory: Handle) -> i32;
    fn GlobalAlloc(flags: u32, bytes: usize) -> Handle;
    fn GlobalFree(memory: Handle) -> Handle;
    fn SetLastError(error: u32);
    fn GetLastError() -> u32;
}
const CF_UNICODETEXT: u32 = 13;
const LIMIT: usize = 64 * 1024 * 1024;

struct Open;
impl Open {
    fn new(owner: Handle) -> Result<Self, String> { Self::within(owner, Duration::from_millis(250)) }
    /// Another application may hold the clipboard open for a moment (it is reading our paste,
    /// a clipboard manager looks at the copy): tried again until `patience` is spent.
    fn within(owner: Handle, patience: Duration) -> Result<Self, String> {
        let start = Instant::now();
        loop {
            if unsafe { OpenClipboard(owner) } != 0 { return Ok(Self); }
            if start.elapsed() >= patience { return Err("Le presse-papiers est occupé.".into()); }
            std::thread::sleep(Duration::from_millis(10));
        }
    }
}
impl Drop for Open { fn drop(&mut self) { unsafe { CloseClipboard(); } } }

struct Memory(Handle);
impl Memory {
    fn new(bytes: &[u8]) -> Result<Self, String> {
        let memory = Self(unsafe { GlobalAlloc(0x42, bytes.len().max(1)) }); // MOVEABLE | ZEROINIT
        if memory.0.is_null() { return Err("Mémoire du presse-papiers indisponible.".into()); }
        let pointer = unsafe { GlobalLock(memory.0) };
        if pointer.is_null() { return Err("Mémoire du presse-papiers indisponible.".into()); }
        unsafe { std::ptr::copy_nonoverlapping(bytes.as_ptr(), pointer.cast(), bytes.len()); GlobalUnlock(memory.0); }
        Ok(memory)
    }
    fn put(mut self, format: u32) -> Result<(), String> {
        if unsafe { SetClipboardData(format, self.0) }.is_null() { return Err("Écriture du presse-papiers indisponible.".into()); }
        self.0 = null_mut(); // ownership transferred to Windows
        Ok(())
    }
}
impl Drop for Memory { fn drop(&mut self) { if !self.0.is_null() { unsafe { GlobalFree(self.0); } } } }

/// Every in-memory format of the clipboard, and the sequence number it had.
pub struct Snapshot { formats: Vec<(u32, Vec<u8>)>, pub sequence: u32 }
impl Snapshot {
    pub fn capture() -> Result<Self, String> {
        let _open = Open::new(null_mut())?;
        let mut formats = Vec::new();
        let mut format = 0;
        let mut total = 0usize;
        let mut bitmap = false;
        loop {
            unsafe { SetLastError(0); }
            format = unsafe { EnumClipboardFormats(format) };
            if format == 0 {
                if unsafe { GetLastError() } != 0 { return Err("Inventaire du presse-papiers indisponible.".into()); }
                break;
            }
            // Windows synthesizes CF_BITMAP from DIB/DIBV5 (including its palette).
            if format == 2 || format == 9 { bitmap = true; continue; }
            // Metafiles, enhanced metafiles, GDI objects and private formats live with
            // their owner: they cannot be duplicated in memory.
            if matches!(format, 3 | 14 | 0x80..=0x8e | 0x200..=0x2ff) {
                return Err("Ce format du presse-papiers ne peut pas être conservé.".into());
            }
            let handle = unsafe { GetClipboardData(format) };
            if handle.is_null() { return Err("Un format du presse-papiers est indisponible.".into()); }
            let size = unsafe { GlobalSize(handle) };
            total = total.saturating_add(size);
            if size == 0 || total > LIMIT { return Err("Le presse-papiers ne peut pas être sauvegardé sans perte.".into()); }
            let pointer = unsafe { GlobalLock(handle) };
            if pointer.is_null() { return Err("Le presse-papiers ne peut pas être sauvegardé sans perte.".into()); }
            let bytes = unsafe { std::slice::from_raw_parts(pointer.cast::<u8>(), size).to_vec() };
            unsafe { GlobalUnlock(handle); }
            formats.push((format, bytes));
        }
        if bitmap && !formats.iter().any(|(f, _)| matches!(f, 8 | 17)) {
            return Err("L’image du presse-papiers ne peut pas être conservée.".into());
        }
        Ok(Self { formats, sequence: unsafe { GetClipboardSequenceNumber() } })
    }
}

/// What to put back after our own clipboard traffic: the whole snapshot when Windows
/// let us take one, else the previous text alone (an owner-rendered format, an Excel
/// range for instance, cannot be duplicated: the capture and the paste still work, only
/// the text is restored, as before 0.4.0).
pub enum Keeper { Full(Snapshot), TextOnly { text: Option<String>, sequence: u32 } }
impl Keeper {
    pub fn take(previous_text: impl FnOnce() -> Option<String>) -> Self {
        match Snapshot::capture() {
            Ok(snapshot) => Self::Full(snapshot),
            Err(_) => Self::TextOnly { text: previous_text(), sequence: unsafe { GetClipboardSequenceNumber() } },
        }
    }
    pub fn sequence(&self) -> u32 {
        match self { Self::Full(s) => s.sequence, Self::TextOnly { sequence, .. } => *sequence }
    }
    /// Writes our text, only while the clipboard is still the one this keeper saw.
    pub fn put_text(&self, text: &str) -> Result<u32, String> {
        write_formats(&[(CF_UNICODETEXT, utf16(text))], Proof::Sequence(self.sequence()))
    }
    /// What goes back on the clipboard (None: nothing could be kept, nothing is put back).
    fn formats(&self) -> Option<Vec<(u32, Vec<u8>)>> {
        match self {
            Self::Full(snapshot) => Some(snapshot.formats.clone()),
            Self::TextOnly { text: Some(text), .. } => Some(vec![(CF_UNICODETEXT, utf16(text))]),
            Self::TextOnly { text: None, .. } => None,
        }
    }
    /// After `put_text`: puts back what was there, as long as the clipboard is still ours
    /// (nobody wrote it since: a newer copy of the user's stays). Waits for a clipboard held
    /// open by the application that reads our paste.
    pub fn restore_ours(&self) -> Result<(), String> {
        let Some(formats) = self.formats() else { return Ok(()) };
        write_formats(&formats, Proof::Ours).map(|_| ())
    }
}

/// How long the counter must rest before a copy is taken as finished, and how long it gets.
const COPY_REST: Duration = Duration::from_millis(30);
const COPY_SETTLE_MAX: Duration = Duration::from_millis(400);

/// What a synthetic copy gave.
#[derive(Debug, PartialEq, Eq)]
pub enum Copied {
    /// The clipboard never changed: nothing was copied (yet: see `watch_late`).
    Nothing,
    /// The copy landed: its text (None when it holds none) and whether the clipboard holds
    /// again what the keeper kept.
    Taken { text: Option<String>, restored: bool },
}

/// After a copy chord sent while the counter was `before`: waits at most `timeout` for the
/// clipboard to change, lets the copy finish (the counter rests), then reads its text and puts
/// the kept clipboard back within the same clipboard session. Whatever the source wrote, in
/// however many steps, the user's clipboard comes back.
pub fn take_copy(keeper: &Keeper, before: u32, timeout: Duration) -> Copied {
    let deadline = Instant::now() + timeout;
    while unsafe { GetClipboardSequenceNumber() } == before {
        if Instant::now() >= deadline { return Copied::Nothing; }
        std::thread::sleep(Duration::from_millis(5));
    }
    settle_and_swap(keeper)
}

fn settle_and_swap(keeper: &Keeper) -> Copied {
    let started = Instant::now();
    // Allocated before anything is emptied: a failure leaves the copy where it is.
    let prepared = keeper.formats().map(|formats| prepare(&formats));
    let owner = owner_window().unwrap_or(null_mut());
    loop {
        let last_chance = started.elapsed() >= COPY_SETTLE_MAX;
        let rested = unsafe { GetClipboardSequenceNumber() };
        std::thread::sleep(COPY_REST);
        if unsafe { GetClipboardSequenceNumber() } != rested && !last_chance { continue; }
        let Ok(_open) = Open::within(owner, Duration::from_millis(if last_chance { 600 } else { 60 })) else {
            if last_chance { return Copied::Taken { text: None, restored: false }; }
            continue;
        };
        // Written again while we were opening it: the copy is not finished.
        if unsafe { GetClipboardSequenceNumber() } != rested && !last_chance { continue; }
        // The text is not there yet (emptied, to be set in a second session): wait for it.
        let has_text = unsafe { IsClipboardFormatAvailable(CF_UNICODETEXT) } != 0;
        if !has_text && !last_chance { continue; }
        // Our own traffic: the freshness watcher must not date it as a copy of the user's.
        crate::host::suppress_clipboard_tracking(Duration::from_millis(1_500));
        // Reading renders a delayed format (OLE): the source writes it now, under our session.
        let text = if has_text { read_text_locked() } else { None };
        let restored = match prepared {
            Some(Ok(memory)) => !owner.is_null() && put_locked(memory).is_ok(),
            _ => false,
        };
        return Copied::Taken { text, restored };
    }
}

/// CF_UNICODETEXT of the open clipboard (the caller holds it), up to its first NUL.
fn read_text_locked() -> Option<String> {
    let handle = unsafe { GetClipboardData(CF_UNICODETEXT) };
    if handle.is_null() { return None; }
    let size = unsafe { GlobalSize(handle) };
    let pointer = unsafe { GlobalLock(handle) };
    if pointer.is_null() || size < 2 { return None; }
    let units = unsafe { std::slice::from_raw_parts(pointer.cast::<u16>(), size / 2) };
    let length = units.iter().position(|unit| *unit == 0).unwrap_or(units.len());
    let text = String::from_utf16_lossy(&units[..length]);
    unsafe { GlobalUnlock(handle); }
    Some(text)
}

/// A copy that may still land after `take_copy` stopped waiting (a slow application): the
/// clipboard it would overwrite, the counter when the chord left and the session's last input
/// then. One at a time; a new transaction settles it first (`settle_late`).
struct Late { keeper: Keeper, before: u32, tick: u32, until: Instant }
static LATE: std::sync::Mutex<Option<Late>> = std::sync::Mutex::new(None);
const LATE_WINDOW: Duration = Duration::from_millis(2_500);

fn lock_late() -> std::sync::MutexGuard<'static, Option<Late>> {
    LATE.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}
/// Whether a late copy is ours to undo: the clipboard changed, and the session saw no key and
/// no click since the chord (`tick` then, `now`): the user copied nothing himself.
pub fn late_copy_is_ours(before: u32, sequence: u32, tick: u32, now: u32) -> bool {
    sequence != before && tick != 0 && tick == now
}
fn settle(late: &Late, input_tick: impl Fn() -> u32) -> bool {
    let sequence = unsafe { GetClipboardSequenceNumber() };
    if sequence == late.before { return false; }
    if late_copy_is_ours(late.before, sequence, late.tick, input_tick()) { let _ = settle_and_swap(&late.keeper); }
    true
}
/// Keeps watching for the copy `take_copy` did not see: when it lands within 2.5 s and the
/// user did nothing meanwhile, the kept clipboard is put back. `tick`: the session's last
/// input when the wait ended; `input_tick` reads it again.
pub fn watch_late(keeper: Keeper, before: u32, tick: u32, input_tick: fn() -> u32) {
    *lock_late() = Some(Late { keeper, before, tick, until: Instant::now() + LATE_WINDOW });
    let _ = std::thread::Builder::new().name("clipboard-late".into()).spawn(move || loop {
        std::thread::sleep(Duration::from_millis(25));
        let mut late = lock_late();
        let Some(watch) = late.as_ref().filter(|watch| watch.before == before) else { return };
        if settle(watch, input_tick) || Instant::now() >= watch.until { *late = None; return; }
    });
}
/// Before any new clipboard transaction: the late copy still watched is settled now.
pub fn settle_late(input_tick: fn() -> u32) {
    if let Some(late) = lock_late().take() { settle(&late, input_tick); }
}

/// The formats applications put beside a copy to keep it out of clipboard monitors, of the
/// clipboard history (Win+V) and of the cloud clipboard: what password managers set on a
/// password (KeePass, 1Password, Bitwarden; documented by Microsoft as « Cloud Clipboard and
/// Clipboard History Formats »).
const EXCLUDE_MONITORING: &str = "ExcludeClipboardContentFromMonitorProcessing";
const CAN_INCLUDE_IN_HISTORY: &str = "CanIncludeInClipboardHistory";
const CAN_UPLOAD_TO_CLOUD: &str = "CanUploadToCloudClipboard";

/// What a clipboard says of itself. `history` and `cloud`: the DWORD of the format when it is
/// present (`Some(None)` when present but unreadable).
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Marks {
    pub exclude_monitoring: bool,
    pub history: Option<Option<u32>>,
    pub cloud: Option<Option<u32>>,
}
/// The sensitive-clipboard rule (decision B, 01/10): a copy is never taken as a source when its
/// owner excluded it from monitoring, from the history or from the cloud. A flag that is present
/// and cannot be read counts as a refusal; a flag set to 1 (allowed) is not one.
pub fn is_sensitive(marks: Marks) -> bool {
    let refused = |flag: Option<Option<u32>>| matches!(flag, Some(None) | Some(Some(0)));
    marks.exclude_monitoring || refused(marks.history) || refused(marks.cloud)
}
fn format_id(name: &str) -> u32 {
    let name = name.encode_utf16().chain(Some(0)).collect::<Vec<_>>();
    unsafe { RegisterClipboardFormatW(name.as_ptr()) }
}
fn read_marks() -> Marks {
    let present = |name: &str| { let format = format_id(name); (format != 0 && unsafe { IsClipboardFormatAvailable(format) } != 0).then_some(format) };
    let exclude_monitoring = present(EXCLUDE_MONITORING).is_some();
    let (history, cloud) = (present(CAN_INCLUDE_IN_HISTORY), present(CAN_UPLOAD_TO_CLOUD));
    if history.is_none() && cloud.is_none() { return Marks { exclude_monitoring, history: None, cloud: None }; }
    // The values are four bytes each; the content itself is never read here.
    let open = Open::new(null_mut());
    let value = |format: Option<u32>| format.map(|format| {
        open.as_ref().ok()?;
        let memory = unsafe { GetClipboardData(format) };
        if memory.is_null() || unsafe { GlobalSize(memory) } < 4 { return None; }
        let pointer = unsafe { GlobalLock(memory) };
        if pointer.is_null() { return None; }
        let value = unsafe { std::ptr::read_unaligned(pointer.cast::<u32>()) };
        unsafe { GlobalUnlock(memory); }
        Some(value)
    });
    Marks { exclude_monitoring, history: value(history), cloud: value(cloud) }
}
/// Whether the clipboard, as it is now, is marked sensitive by its owner.
pub fn sensitive() -> bool {
    is_sensitive(read_marks())
}

fn utf16(text: &str) -> Vec<u8> {
    text.encode_utf16().chain(Some(0)).flat_map(u16::to_le_bytes).collect()
}

// Clipboard ownership needs a pumping window even while the MTA worker is inside a slow
// UIA call: otherwise another application's copy blocks on WM_DESTROYCLIPBOARD.
static OWNER: std::sync::OnceLock<Result<isize, String>> = std::sync::OnceLock::new();
fn owner_window() -> Result<Handle, String> {
    OWNER.get_or_init(|| {
        let (send, receive) = std::sync::mpsc::sync_channel(1);
        std::thread::Builder::new().name("clipboard-owner".into()).spawn(move || {
            use windows::{core::w, Win32::UI::WindowsAndMessaging::{CreateWindowExW, DispatchMessageW, GetMessageW, HWND_MESSAGE, MSG, WINDOW_EX_STYLE, WINDOW_STYLE}};
            let hwnd = unsafe { CreateWindowExW(WINDOW_EX_STYLE::default(), w!("STATIC"), w!(""), WINDOW_STYLE::default(), 0, 0, 0, 0, Some(HWND_MESSAGE), None, None, None) };
            let Ok(hwnd) = hwnd else { let _ = send.send(Err("Presse-papiers temporaire indisponible.".to_string())); return; };
            if send.send(Ok(hwnd.0 as isize)).is_err() { return; }
            let mut message = MSG::default();
            while unsafe { GetMessageW(&mut message, None, 0, 0) }.0 > 0 {
                unsafe { DispatchMessageW(&message); }
            }
        }).map_err(|_| "Presse-papiers temporaire indisponible.".to_string())?;
        receive.recv().map_err(|_| "Presse-papiers temporaire indisponible.".to_string())?
    }).clone().map(|hwnd| hwnd as Handle)
}

/// What proves the clipboard may be written: its counter is still `Sequence`, or it still
/// holds our own write (`Ours`: we own it; any other writer takes the ownership away).
#[derive(Clone, Copy)]
enum Proof { Sequence(u32), Ours }

/// The blocks to put, the three opt-outs with them. Allocated before any EmptyClipboard so
/// an allocation failure leaves the clipboard intact.
fn prepare(formats: &[(u32, Vec<u8>)]) -> Result<Vec<(u32, Memory)>, String> {
    let mut memory = formats.iter().map(|(f, bytes)| Memory::new(bytes).map(|m| (*f, m))).collect::<Result<Vec<_>, _>>()?;
    for name in [EXCLUDE_MONITORING, CAN_INCLUDE_IN_HISTORY, CAN_UPLOAD_TO_CLOUD] {
        let format = format_id(name);
        if format == 0 { return Err("Protection du presse-papiers indisponible.".into()); }
        memory.retain(|(f, _)| *f != format);
        memory.push((format, Memory::new(&[0; 4])?));
    }
    Ok(memory)
}
/// Empties the open clipboard (opened with our owner window) and puts the blocks.
fn put_locked(memory: Vec<(u32, Memory)>) -> Result<(), String> {
    if unsafe { EmptyClipboard() } == 0 { return Err("Le presse-papiers est occupé.".into()); }
    for (format, block) in memory { block.put(format)?; }
    Ok(())
}

fn write_formats(formats: &[(u32, Vec<u8>)], proof: Proof) -> Result<u32, String> {
    let memory = prepare(formats)?;
    let owner = owner_window()?;
    {
        let _open = Open::within(owner, Duration::from_millis(match proof { Proof::Sequence(_) => 250, Proof::Ours => 1_200 }))?;
        let allowed = match proof {
            Proof::Sequence(expected) => (unsafe { GetClipboardSequenceNumber() }) == expected,
            Proof::Ours => (unsafe { GetClipboardOwner() }) == owner,
        };
        if !allowed { return Err("Le presse-papiers a changé; son nouveau contenu est conservé.".into()); }
        put_locked(memory)?;
    }
    // CloseClipboard materializes the synthesized formats and can advance the sequence:
    // read it under a new lock, once ownership is confirmed.
    let _open = Open::new(owner)?;
    if unsafe { GetClipboardOwner() } != owner { return Err("Le presse-papiers a changé; son nouveau contenu est conservé.".into()); }
    Ok(unsafe { GetClipboardSequenceNumber() })
}

#[cfg(test)]
mod tests {
    use super::*;
    // Writes a synthetic sentinel, restores the snapshot, and checks the guard refuses to
    // overwrite a newer write. Skipped without a window station (CI runner).
    #[test]
    fn a_copy_marked_by_a_password_manager_is_sensitive() {
        let plain = Marks::default();
        assert!(!is_sensitive(plain), "an ordinary copy carries none of the formats");
        // KeePass and Bitwarden: the monitoring exclusion alone (whatever it contains).
        assert!(is_sensitive(Marks { exclude_monitoring: true, ..plain }));
        // 1Password and the Windows samples: history or cloud refused with a zero.
        assert!(is_sensitive(Marks { history: Some(Some(0)), ..plain }));
        assert!(is_sensitive(Marks { cloud: Some(Some(0)), ..plain }));
        assert!(is_sensitive(Marks { history: Some(Some(1)), cloud: Some(Some(0)), ..plain }));
        // Present and explicitly allowed: an application that says « yes, keep it ».
        assert!(!is_sensitive(Marks { history: Some(Some(1)), cloud: Some(Some(1)), ..plain }));
        // Present and unreadable (the clipboard was busy): refused rather than guessed.
        assert!(is_sensitive(Marks { history: Some(None), ..plain }));
        assert!(is_sensitive(Marks { cloud: Some(None), ..plain }));
    }
    #[test]
    fn our_text_is_put_and_the_previous_clipboard_comes_back_unless_it_changed() {
        let Some(_desktop) = desktop() else { return };
        let keeper = Keeper::take(|| None);
        let sequence = keeper.put_text("flowtranslate sentinel ✓").expect("put");
        assert_ne!(sequence, keeper.sequence());
        // Our own text travels with the three opt-outs: read back from the real clipboard, it is
        // sensitive, as a password manager's copy is.
        assert_eq!(read_marks(), Marks { exclude_monitoring: true, history: Some(Some(0)), cloud: Some(Some(0)) });
        assert!(sensitive());
        keeper.restore_ours().expect("restore");
    }

    // The tests below write the real clipboard: one at a time.
    static CLIPBOARD_TEST: std::sync::Mutex<()> = std::sync::Mutex::new(());
    fn desktop() -> Option<std::sync::MutexGuard<'static, ()>> {
        if unsafe { GetClipboardSequenceNumber() } == 0 {
            eprintln!("no clipboard sequence in this session: skipped");
            return None;
        }
        Some(CLIPBOARD_TEST.lock().unwrap_or_else(|poisoned| poisoned.into_inner()))
    }
    /// The clipboard's text, read as any application would.
    fn text_now() -> Option<String> {
        let _open = Open::within(null_mut(), Duration::from_secs(2)).ok()?;
        if unsafe { IsClipboardFormatAvailable(CF_UNICODETEXT) } == 0 { return None; }
        read_text_locked()
    }
    /// Writes `text` as another application would: its own window owns the clipboard.
    fn foreign_write(steps: &[Option<&str>], pause: Duration) {
        use windows::{core::w, Win32::UI::WindowsAndMessaging::{CreateWindowExW, DestroyWindow, HWND_MESSAGE, WINDOW_EX_STYLE, WINDOW_STYLE}};
        let hwnd = unsafe { CreateWindowExW(WINDOW_EX_STYLE::default(), w!("STATIC"), w!(""), WINDOW_STYLE::default(), 0, 0, 0, 0, Some(HWND_MESSAGE), None, None, None) }.expect("window");
        for step in steps {
            {
                let _open = Open::within(hwnd.0 as Handle, Duration::from_secs(2)).expect("open");
                match step {
                    // A first session that only empties (Scintilla, then its text in the next).
                    None => unsafe { EmptyClipboard(); },
                    Some(text) => {
                        unsafe { EmptyClipboard(); }
                        Memory::new(&utf16(text)).unwrap().put(CF_UNICODETEXT).unwrap();
                        // A private format beside the text: one more step of the counter.
                        Memory::new(&[1, 0, 0, 0]).unwrap().put(format_id("FlowTranslateTestFormat")).unwrap();
                    }
                }
            }
            std::thread::sleep(pause);
        }
        unsafe { let _ = DestroyWindow(hwnd); }
    }
    fn user_copies(text: &str) { foreign_write(&[Some(text)], Duration::ZERO); }

    #[test]
    fn the_users_clipboard_comes_back_after_a_copy_made_in_several_steps() {
        let Some(_desktop) = desktop() else { return };
        user_copies("sentinelle de l'utilisateur");
        let keeper = Keeper::take(|| None);
        let before = keeper.sequence();
        // The source empties, sets a first text, then its final text 40 ms later: the sample
        // taken right after the first change is long outdated when the copy ends (0.5.1 then
        // refused to restore and the selected text stayed on the clipboard).
        let source = std::thread::spawn(|| foreign_write(&[None, Some("premier jet"), Some("texte sélectionné")], Duration::from_millis(20)));
        let copied = take_copy(&keeper, before, Duration::from_millis(800));
        source.join().unwrap();
        assert_eq!(copied, Copied::Taken { text: Some("texte sélectionné".into()), restored: true });
        assert_eq!(text_now().as_deref(), Some("sentinelle de l'utilisateur"));
        // Nothing copied in time: nothing is read, nothing is touched.
        let keeper = Keeper::take(|| None);
        assert_eq!(take_copy(&keeper, keeper.sequence(), Duration::from_millis(60)), Copied::Nothing);
        assert_eq!(text_now().as_deref(), Some("sentinelle de l'utilisateur"));
    }

    #[test]
    fn our_paste_is_undone_on_the_clipboard_unless_somebody_wrote_it_since() {
        let Some(_desktop) = desktop() else { return };
        user_copies("avant le collage");
        let keeper = Keeper::take(|| None);
        keeper.put_text("résultat collé").expect("put");
        assert_eq!(text_now().as_deref(), Some("résultat collé"));
        // The target read the clipboard (the counter may move with rendered formats): still ours.
        keeper.restore_ours().expect("restore");
        assert_eq!(text_now().as_deref(), Some("avant le collage"));
        // The user copies while our text is on the clipboard: his copy stays.
        let keeper = Keeper::take(|| None);
        keeper.put_text("résultat collé").expect("put");
        user_copies("copie plus récente");
        assert!(keeper.restore_ours().is_err());
        assert_eq!(text_now().as_deref(), Some("copie plus récente"));
        // A keeper taken before a change never writes over it.
        let stale = Keeper::take(|| None);
        user_copies("encore une copie");
        assert!(stale.put_text("résultat").is_err());
        assert_eq!(text_now().as_deref(), Some("encore une copie"));
    }

    #[test]
    fn a_copy_that_lands_late_is_undone_only_when_the_user_did_nothing() {
        // The rule alone: the clipboard changed and the session saw no input since the chord.
        assert!(late_copy_is_ours(10, 12, 5_000, 5_000));
        assert!(!late_copy_is_ours(10, 10, 5_000, 5_000), "nothing landed");
        assert!(!late_copy_is_ours(10, 12, 5_000, 5_016), "a key or a click since: it may be the user's own copy");
        assert!(!late_copy_is_ours(10, 12, 0, 0), "the input tick could not be read");
        let Some(_desktop) = desktop() else { return };
        // The source answers 150 ms after we stopped waiting: the user's clipboard comes back.
        user_copies("sentinelle tardive");
        let keeper = Keeper::take(|| None);
        let before = keeper.sequence();
        assert_eq!(take_copy(&keeper, before, Duration::from_millis(30)), Copied::Nothing);
        watch_late(keeper, before, 77, || 77);
        std::thread::sleep(Duration::from_millis(150));
        user_copies("copie lente de la source");
        std::thread::sleep(Duration::from_millis(400));
        assert_eq!(text_now().as_deref(), Some("sentinelle tardive"));
        // The same, but the user typed meanwhile: his clipboard is left alone.
        let keeper = Keeper::take(|| None);
        let before = keeper.sequence();
        watch_late(keeper, before, 77, || 78);
        user_copies("copie de l'utilisateur");
        std::thread::sleep(Duration::from_millis(300));
        assert_eq!(text_now().as_deref(), Some("copie de l'utilisateur"));
        // A new transaction settles the watch at once instead of racing with it.
        let keeper = Keeper::take(|| None);
        let before = keeper.sequence();
        watch_late(keeper, before, 77, || 77);
        user_copies("copie lente, encore");
        settle_late(|| 77);
        assert_eq!(text_now().as_deref(), Some("copie de l'utilisateur"));
        assert!(lock_late().is_none());
    }
}
