//! Short-lived clipboard transaction around a synthetic copy or paste (0.4.0, taken from
//! the multi-format guard of PR 6): every in-memory format is snapshotted before the
//! clipboard is touched, our own text is written with the monitoring/history opt-outs,
//! and the snapshot is put back only while the sequence number is still ours, so a copy
//! the user makes in between is never overwritten. Nothing here logs any content.
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
    fn new(owner: Handle) -> Result<Self, String> {
        let start = Instant::now();
        loop {
            if unsafe { OpenClipboard(owner) } != 0 { return Ok(Self); }
            if start.elapsed() >= Duration::from_millis(250) { return Err("Le presse-papiers est occupé.".into()); }
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
    /// Puts the snapshot back, only while the clipboard still holds our write `expected`.
    pub fn restore(&self, expected: u32) -> Result<(), String> {
        write_formats(&self.formats, expected).map(|_| ())
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
    pub fn put_text(&self, text: &str) -> Result<u32, String> {
        write_formats(&[(CF_UNICODETEXT, utf16(text))], self.sequence())
    }
    pub fn restore(&self, expected: u32) -> Result<(), String> {
        match self {
            Self::Full(snapshot) => snapshot.restore(expected),
            Self::TextOnly { text: Some(text), .. } => write_formats(&[(CF_UNICODETEXT, utf16(text))], expected).map(|_| ()),
            Self::TextOnly { text: None, .. } => Ok(()),
        }
    }
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

fn write_formats(formats: &[(u32, Vec<u8>)], expected: u32) -> Result<u32, String> {
    // Allocate before EmptyClipboard so an allocation failure leaves the original intact.
    let mut memory = formats.iter().map(|(f, bytes)| Memory::new(bytes).map(|m| (*f, m))).collect::<Result<Vec<_>, _>>()?;
    for name in [EXCLUDE_MONITORING, CAN_INCLUDE_IN_HISTORY, CAN_UPLOAD_TO_CLOUD] {
        let format = format_id(name);
        if format == 0 { return Err("Protection du presse-papiers indisponible.".into()); }
        memory.retain(|(f, _)| *f != format);
        memory.push((format, Memory::new(&[0; 4])?));
    }
    let owner = owner_window()?;
    {
        let _open = Open::new(owner)?;
        if unsafe { GetClipboardSequenceNumber() } != expected { return Err("Le presse-papiers a changé; son nouveau contenu est conservé.".into()); }
        if unsafe { EmptyClipboard() } == 0 { return Err("Le presse-papiers est occupé.".into()); }
        for (format, block) in memory { block.put(format)?; }
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
        if unsafe { GetClipboardSequenceNumber() } == 0 {
            eprintln!("no clipboard sequence in this session: skipped");
            return;
        }
        let keeper = Keeper::take(|| None);
        let sequence = keeper.put_text("flowtranslate sentinel ✓").expect("put");
        assert_ne!(sequence, keeper.sequence());
        // Our own text travels with the three opt-outs: read back from the real clipboard, it is
        // sensitive, as a password manager's copy is.
        assert_eq!(read_marks(), Marks { exclude_monitoring: true, history: Some(Some(0)), cloud: Some(Some(0)) });
        assert!(sensitive());
        keeper.restore(sequence).expect("restore");
        // A second restore against the old sequence is refused: the clipboard moved on.
        assert!(keeper.restore(sequence).is_err() || matches!(keeper, Keeper::TextOnly { text: None, .. }));
    }
}
