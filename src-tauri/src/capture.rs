use crate::error::{AppError, ErrorKind};
use crate::selection_lines;
use crate::types::{
    Capture, CaptureOrigin, CaptureSource, HaloLevels, Rect, StoredCapture, TargetCheck,
    TargetIdentity,
};
use arboard::Clipboard;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};
use uiautomation::{
    patterns::UIValuePattern,
    types::{TextAttribute, TextPatternRangeEndpoint, TextUnit},
};
use uiautomation::{
    patterns::{UITextPattern, UITextRange},
    variants::SafeArray,
    UIAutomation, UIElement,
};
use uuid::Uuid;

/// A copy the user made himself counts as fresh this long (Lucas, 2026-09-14).
const FRESH_COPY_MS: u64 = 3_000;
/// The shortcut chord must be released before a synthetic chord is sent.
pub(crate) const CHORD_RELEASE: Duration = Duration::from_millis(600);
/// How long the target may take to serve the synthetic copy.
const COPY_SETTLE: Duration = Duration::from_millis(350);
/// Our own clipboard traffic (copy, restoration) is invisible to the freshness watcher.
const OWN_TRAFFIC: Duration = Duration::from_millis(1_500);
/// After the paste chord: how long a readable field gets to show the result, and the
/// least time the target keeps our clipboard when nothing can read it back.
const PASTE_CONFIRM: Duration = Duration::from_millis(800);
const PASTE_SETTLE: Duration = Duration::from_millis(300);
/// A field that still reads exactly as before the paste gets this much more before it is
/// called read-only (a slow editor pastes late; a PDF never does).
const READ_ONLY_CONFIRM: Duration = Duration::from_millis(400);
/// How far the last rectangle of a selection may drift without being a change (a sub-pixel
/// layout pass, our own window showing beside it); a scroll or a reflow moves it by a line.
const ANCHOR_DRIFT: f64 = 2.;
/// How much of a document UI Automation is asked for (UTF-16 units). A text that fills it was
/// cut there: what lies beyond was not read.
const FIELD_CAP: usize = 200_000;
/// The longest text sent (Lucas, 2026-10-08; 6,000 before): a translation spends the context
/// twice, the text then about as much again, so this fits a context of 131k tokens.
pub(crate) const MAX_CHARS: usize = 200_000;
/// UI Automation's refusal of a selection past MAX_CHARS (UTF-16 units there).
const UIA_TOO_LONG: &str =
    "La sélection dépasse 200 000 unités de texte et pourrait être tronquée.";

thread_local! {
    // uiautomation::UIAutomation::new initializes COM every time without balancing
    // that call. The context watcher validates several times per second, so retain
    // one automation client per MTA worker thread instead of growing that count.
    static UI_AUTOMATION: std::cell::OnceCell<UIAutomation> = const { std::cell::OnceCell::new() };
}

pub(crate) fn ui_automation() -> Result<UIAutomation, ()> {
    UI_AUTOMATION.with(|cell| {
        if let Some(automation) = cell.get() {
            return Ok(automation.clone());
        }
        let automation = UIAutomation::new().map_err(|_| ())?;
        let _ = cell.set(automation.clone());
        Ok(automation)
    })
}

/// The focused element as UI Automation answers it now (None: it does not answer).
pub(crate) fn focused_element() -> Option<UIElement> {
    #[cfg(test)]
    if faults::uia_unanswered() {
        return None;
    }
    ui_automation().ok()?.get_focused_element().ok()
}

/// NATIVE-006: the epoch of the deliveries. The emergency exit (`force_close`) bumps it before it
/// waits for the state lock, which a paste in flight may hold: every ticket taken before that is
/// dead, whoever holds the lock.
static DELIVERY_EPOCH: AtomicU64 = AtomicU64::new(0);

/// The right of a bubble's session to send keys into its source (a paste, an undo), taken when
/// its capture is stored. Read again by the paste and the undo right before each key they send,
/// without any lock: a revoked ticket sends nothing more.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Ticket(u64);

impl Ticket {
    pub fn current() -> Self {
        Self(DELIVERY_EPOCH.load(Ordering::SeqCst))
    }
    /// No emergency exit since it was taken.
    pub fn live(self) -> bool {
        DELIVERY_EPOCH.load(Ordering::SeqCst) == self.0
    }
}

/// Every ticket taken so far is dead (the emergency exit). Any thread, never a lock.
pub fn revoke_deliveries() {
    DELIVERY_EPOCH.fetch_add(1, Ordering::SeqCst);
}

/// Unit tests that take a ticket and the one that revokes run one at a time (the epoch is global).
#[cfg(test)]
pub(crate) static EPOCH_TESTS: std::sync::Mutex<()> = std::sync::Mutex::new(());

/// What a revoked ticket answers: the bubble was closed, nothing is sent.
pub(crate) fn revoked() -> AppError {
    AppError::new(
        ErrorKind::Cancelled,
        "La bulle a été fermée : rien n’a été collé.",
    )
    .because("delivery revoked")
}

/// Faults the real replacement bench injects (scripts/test-replacement-windows.mjs). Test
/// builds only, per thread: the shipped application has no such switch, and no environment
/// variable reaches it.
#[cfg(test)]
pub(crate) mod faults {
    use std::cell::Cell;
    use std::time::Duration;
    thread_local! {
        static SILENT: Cell<bool> = const { Cell::new(false) };
        static STALL: Cell<Option<Duration>> = const { Cell::new(None) };
    }
    /// From now on, on this thread, UI Automation gives no focused element (a provider that
    /// stopped answering).
    pub fn silence_uia(silent: bool) {
        SILENT.with(|s| s.set(silent));
    }
    /// The next focused-element request of this thread takes `delay` before it answers (a
    /// provider that hangs for a while).
    pub fn stall_next_uia(delay: Duration) {
        STALL.with(|s| s.set(Some(delay)));
    }
    pub(super) fn uia_unanswered() -> bool {
        if let Some(delay) = STALL.with(Cell::take) {
            std::thread::sleep(delay);
        }
        SILENT.with(Cell::get)
    }
}

/// What `selection` answers when the control is readable but holds no selection (none,
/// or collapsed to the caret by a click or an arrow key).
const NO_SELECTION: &str = "Aucune sélection active.";

/// Text, visible rectangles (physical, one per run as `GetBoundingRectangles` gives
/// them), length and editability of the current UIA selection.
pub(crate) fn selection(element: &UIElement) -> Result<(String, Vec<Rect>, usize, bool), String> {
    let pattern = element
        .get_pattern::<UITextPattern>()
        .map_err(|_| "La sélection n’est pas accessible par UI Automation.".to_string())?;
    let range = selected_range(
        pattern
            .get_selection()
            .map_err(|_| "La sélection n’est pas accessible par UI Automation.".to_string())?,
    )?;
    let text = range
        .get_text(MAX_CHARS as i32 + 1)
        .map_err(|_| "Impossible de lire la sélection.".to_string())?;
    if text.is_empty() {
        return Err(NO_SELECTION.into());
    }
    if text.encode_utf16().count() > MAX_CHARS {
        return Err(UIA_TOO_LONG.into());
    }
    let selection_len = text.chars().count();
    let range_editable = range
        .get_attribute_value(TextAttribute::IsReadOnly)
        .ok()
        .and_then(|v| <uiautomation::variants::Variant as TryInto<bool>>::try_into(v).ok())
        .is_some_and(|v| !v);
    let rects = range_rects(&range);
    Ok((text, rects, selection_len, range_editable))
}

/// What `selection` answers for a selection in several disjoint parts (Ctrl+drag in Word, the
/// Add mode of Writer): never replaced (NATIVE-012).
const MULTIPLE_SELECTION: &str = "La sélection compte plusieurs plages; remplacement impossible.";

/// The range a capture acts on, among those `GetSelection` gives (one per disjoint part of the
/// selection): the only one. A selection in several ranges is refused, at the capture and at the
/// revalidation (NATIVE-012: its first range used to be taken for the whole of it, and the paste
/// wrote over that part alone).
pub(crate) fn selected_range<R>(ranges: Vec<R>) -> Result<R, String> {
    let mut ranges = ranges.into_iter();
    let range = ranges.next().ok_or_else(|| NO_SELECTION.to_string())?;
    if ranges.next().is_some() {
        return Err(MULTIPLE_SELECTION.into());
    }
    Ok(range)
}

/// The visible runs of a range, physical, as `GetBoundingRectangles` gives them (none when
/// the provider answers nothing usable).
pub(crate) fn range_rects(range: &uiautomation::patterns::UITextRange) -> Vec<Rect> {
    let mut rects = unsafe { range.as_ref().GetBoundingRectangles() }
        .ok()
        .and_then(|raw| <SafeArray as TryInto<Vec<f64>>>::try_into(SafeArray::from(raw)).ok())
        .map(|values| selection_lines::from_flat(&values))
        .unwrap_or_default();
    trim_top_inset(range, &mut rects);
    rects
}

/// The first line of a document in Windows 11 Notepad (RichEdit) answers a rectangle that
/// starts at the top edge of the control, its inner margin included: 34 px for an 18 px line
/// (measured on 02/10). The halo's band and the marks of the changed words then sat a line
/// above the text. Such a rectangle (it touches the control's top and is far taller than its
/// text) is cut back to the height of a line, its bottom kept: the height of the other lines of
/// the same range when there are some, else what the font size says. Nothing else is touched.
fn trim_top_inset(range: &UITextRange, rects: &mut [Rect]) {
    let Some(top) = rects
        .iter()
        .filter(|r| selection_lines::drawable(r))
        .map(|r| r.y)
        .reduce(f64::min)
    else {
        return;
    };
    let others: Vec<f64> = rects
        .iter()
        .filter(|r| selection_lines::drawable(r) && r.y > top + 1.)
        .map(|r| r.height)
        .collect();
    let tallest = rects
        .iter()
        .filter(|r| r.y <= top + 1.)
        .map(|r| r.height)
        .fold(0., f64::max);
    // Cheap test first: nothing is asked of the provider for an ordinary line.
    let line = match others.iter().copied().reduce(f64::min) {
        Some(line) => line,
        None => {
            let Some(points) = range
                .get_attribute_value(TextAttribute::FontSize)
                .ok()
                .and_then(|v| <uiautomation::variants::Variant as TryInto<f64>>::try_into(v).ok())
                .filter(|p| p.is_finite() && *p > 0.)
            else {
                return;
            };
            let first = rects.iter().find(|r| r.y <= top + 1.).copied();
            let (_, scale, _) = crate::host::monitor_at(first);
            (points * 96. / 72. * scale * 1.25).round()
        }
    };
    if !inset_line(tallest, line) {
        return;
    }
    let box_top = range
        .get_enclosing_element()
        .ok()
        .and_then(|element| element.get_bounding_rectangle().ok())
        .map(|b| f64::from(b.get_top()));
    if box_top.is_none_or(|edge| (edge - top).abs() > 1.) {
        return;
    }
    trim_rows(rects, top, line);
}
/// Whether a first row `height` tall holds more than its line (`line`: the height of a line).
fn inset_line(height: f64, line: f64) -> bool {
    line >= 4. && height > line * 1.5
}
/// The rows that start at `top` keep their bottom and take the height of a line.
fn trim_rows(rects: &mut [Rect], top: f64, line: f64) {
    for rect in rects
        .iter_mut()
        .filter(|r| r.y <= top + 1. && r.height > line * 1.5)
    {
        rect.y += rect.height - line;
        rect.height = line;
    }
}

/// The halo's other two levels (Lucas, 25/09), physical: the text box (the focused element's
/// bounds, clipped to its window) and the whole lines the selection touches, from the start of
/// its first line to the end of its last, merged per line like the selection. Empty when the
/// provider cannot answer (no line unit, no bounds): the halo then draws the selection alone.
pub(crate) fn selection_levels(
    element: &UIElement,
    window: Option<Rect>,
) -> (Option<Rect>, Vec<Rect>) {
    let text_box = element
        .get_bounding_rectangle()
        .ok()
        .map(|r| Rect {
            x: f64::from(r.get_left()),
            y: f64::from(r.get_top()),
            width: f64::from(r.get_right() - r.get_left()),
            height: f64::from(r.get_bottom() - r.get_top()),
        })
        .filter(selection_lines::drawable)
        .and_then(|b| match window {
            Some(w) => selection_lines::clip(&b, &w),
            None => Some(b),
        });
    let full = (|| {
        let range = element
            .get_pattern::<UITextPattern>()
            .ok()?
            .get_selection()
            .ok()?
            .into_iter()
            .next()?;
        // Real copies (ITextRangeProvider::Clone): the derived Clone would share the range.
        let first = UITextRange::from(unsafe { range.as_ref().Clone() }.ok()?);
        let last = UITextRange::from(unsafe { range.as_ref().Clone() }.ok()?);
        first
            .move_endpoint_by_range(
                TextPatternRangeEndpoint::End,
                &range,
                TextPatternRangeEndpoint::Start,
            )
            .ok()?;
        last.move_endpoint_by_range(
            TextPatternRangeEndpoint::Start,
            &range,
            TextPatternRangeEndpoint::End,
        )
        .ok()?;
        first.expand_to_enclosing_unit(TextUnit::Line).ok()?;
        last.expand_to_enclosing_unit(TextUnit::Line).ok()?;
        first
            .move_endpoint_by_range(
                TextPatternRangeEndpoint::End,
                &last,
                TextPatternRangeEndpoint::End,
            )
            .ok()?;
        Some(selection_lines::lines(&range_rects(&first), window))
    })()
    .unwrap_or_default();
    (text_box, full)
}

/// The anchor of a capture: the last visible rectangle as UI Automation gives it (none
/// when that one is unusable). Physical; the placement and `validate_target` compare it.
pub(crate) fn anchor_of(rects: &[Rect]) -> Option<Rect> {
    rects.last().copied().filter(selection_lines::drawable)
}

fn ensure_source_unchanged(source_window: isize) -> Result<(), AppError> {
    if source_window == 0 || crate::host::foreground() != source_window {
        return Err(AppError::new(
            ErrorKind::TargetChanged,
            "La fenêtre source a changé pendant la capture. Réessayez.",
        ));
    }
    Ok(())
}

/// A password field is never read; a field UI Automation cannot tell apart is treated as one.
fn refuse_protected(password: Result<bool, ()>) -> Result<(), AppError> {
    match password {
        Ok(false) => Ok(()),
        Ok(true) => Err(AppError::new(
            ErrorKind::ProtectedField,
            "La capture est refusée dans un champ protégé.",
        )),
        Err(()) => Err(AppError::new(
            ErrorKind::ProtectedField,
            "Impossible de vérifier si le champ actif est protégé; capture refusée.",
        )),
    }
}

/// What a copy gave: nothing readable is nothing to act on; past MAX_CHARS characters it is
/// refused before anything is sent.
fn copied_text(text: Option<String>) -> Result<String, AppError> {
    let text = text.filter(|text| !text.trim().is_empty()).ok_or_else(|| {
        AppError::new(
            ErrorKind::NoSelection,
            "Rien à traduire dans la fenêtre active.",
        )
    })?;
    if text.chars().count() > MAX_CHARS {
        return Err(too_long());
    }
    Ok(text)
}
fn too_long() -> AppError {
    AppError::new(
        ErrorKind::TooLong,
        "Sélection trop longue (200 000 caractères).",
    )
}

/// Whether a paste can replace what was captured (0.4.0, decided at the capture): the
/// selection UI Automation gave in an editable control (`writable`), or a synthetic copy whose
/// selection UI Automation proved (`writable`: `copy_proved`). A copy alone proves nothing
/// (NATIVE-002, reproduced on VS Code: without a selection Ctrl+Insert copies the whole line,
/// and the paste then inserted at the caret); a copy the user made himself guarantees no
/// selection; a console never replaces its selection on Ctrl+V; a password field is never
/// written.
pub fn replaceable(
    origin: CaptureOrigin,
    writable: bool,
    window_class: &str,
    password: bool,
) -> bool {
    if password || crate::host::is_console_class(window_class) {
        return false;
    }
    match origin {
        CaptureOrigin::Uia | CaptureOrigin::Copy => writable,
        CaptureOrigin::Fresh | CaptureOrigin::Replay | CaptureOrigin::Demo => false,
    }
}

/// NATIVE-002 (Lucas, 10/10): whether UI Automation proves that a synthetic copy came from a
/// selection: the focused element's selection is one non-empty range that reads as the copied
/// text (line endings and editor spaces aside). Without that proof the copy is the source of the
/// action, never a selection to paste over: Copy only. No editor-specific proof is trusted.
fn copy_proved(copied: &str) -> bool {
    focused_element()
        .and_then(|element| selection(&element).ok())
        .is_some_and(|(selected, ..)| proves_copy(&selected, copied))
}
fn proves_copy(selected: &str, copied: &str) -> bool {
    !selected.is_empty() && canonical(selected) == canonical(copied)
}

pub fn capture_current(demo: bool, source_window: isize) -> Result<StoredCapture, AppError> {
    if demo {
        let public = Capture {
            id: Uuid::new_v4().to_string(),
            text: "Bonjour, ceci est une démonstration Overtype.".into(),
            source: CaptureSource::Selection,
            origin: CaptureOrigin::Demo,
            can_replace: false,
            screen: None,
            anchor: Some(Rect {
                x: 640.0,
                y: 420.0,
                width: 280.0,
                height: 24.0,
            }),
            // Two lines ending on the anchor: the halo is exercised without UI Automation.
            selection_rects: vec![
                Rect {
                    x: 640.0,
                    y: 396.0,
                    width: 360.0,
                    height: 24.0,
                },
                Rect {
                    x: 640.0,
                    y: 420.0,
                    width: 280.0,
                    height: 24.0,
                },
            ],
            replay: None,
            execution: None,
            menu: None,
        };
        // A text box around the two lines and their whole width: the three levels without
        // UI Automation. No ground: the halo follows the app's theme.
        let levels = HaloLevels {
            text_box: Some(Rect {
                x: 620.0,
                y: 380.0,
                width: 420.0,
                height: 84.0,
            }),
            full_lines: vec![
                Rect {
                    x: 640.0,
                    y: 396.0,
                    width: 380.0,
                    height: 24.0,
                },
                Rect {
                    x: 640.0,
                    y: 420.0,
                    width: 380.0,
                    height: 24.0,
                },
            ],
            ground: None,
        };
        return Ok(StoredCapture {
            public,
            target: None,
            invalidated: false,
            levels,
        });
    }
    let source_class = crate::host::window_class(source_window);
    // A window started as administrator (while we are not) can neither be read nor written:
    // Windows drops our keys, and UI Automation, blind to it, still answers with the element
    // that had the focus before, in another application (seen on 02/10: the menu opened over
    // an elevated Notepad++ with a selection of the browser behind it). Said first, as it is.
    if crate::host::window_protected(source_window) {
        return Err(protected_window());
    }
    if let Ok(automation) = ui_automation() {
        if let Ok(element) = automation.get_focused_element() {
            refuse_protected(element.is_password().map_err(|_| ()))?;
            match selection(&element) {
                Ok((text, rects, selection_len, range_editable)) => {
                    ensure_source_unchanged(source_window)?;
                    let anchor = anchor_of(&rects);
                    let window = crate::host::window_rect(source_window);
                    let selection_rects = selection_lines::lines(&rects, window);
                    // Before any of our windows shows over the text: its box, its whole lines
                    // and the colour under it (Lucas, 25/09).
                    let (text_box, full_lines) = selection_levels(&element, window);
                    let ground = crate::ground::under(&selection_rects, text_box, window);
                    let levels = HaloLevels {
                        text_box,
                        full_lines,
                        ground,
                    };
                    let runtime_id = element.get_runtime_id().map_err(|_| {
                        AppError::internal("Impossible d’identifier le contrôle source.")
                    })?;
                    let value_editable = element
                        .get_pattern::<UIValuePattern>()
                        .ok()
                        .and_then(|p| p.is_readonly().ok())
                        .is_some_and(|v| !v);
                    let editable = source_window != 0 && (value_editable || range_editable);
                    let control =
                        crate::host::focused_control(source_window).map_or(0, |(handle, _)| handle);
                    let can_replace =
                        replaceable(CaptureOrigin::Uia, editable, &source_class, false);
                    let public = Capture {
                        id: Uuid::new_v4().to_string(),
                        text: text.clone(),
                        source: CaptureSource::Selection,
                        origin: CaptureOrigin::Uia,
                        can_replace,
                        anchor,
                        selection_rects,
                        screen: None,
                        replay: None,
                        execution: None,
                        menu: None,
                    };
                    let target = Some(TargetIdentity {
                        runtime_id: Some(runtime_id),
                        native_window: source_window,
                        control,
                        selected_text: text,
                        anchor,
                        selection_len,
                        editable,
                        check: TargetCheck::Uia,
                    });
                    ensure_source_unchanged(source_window)?;
                    return Ok(StoredCapture {
                        public,
                        target,
                        invalidated: false,
                        levels,
                    });
                }
                Err(message) if message == UIA_TOO_LONG => {
                    return Err(AppError::new(ErrorKind::TooLong, message))
                }
                // NATIVE-012: a selection in several ranges is never replaced. The synthetic copy
                // may still give its text (Word copies every part), for Copy only: UI Automation
                // proves no single range there (`copy_proved`), never a replaceable copy.
                Err(_) => {}
            }
        }
    }
    clipboard_capture(source_window, &source_class)
}

/// The window in front runs above us (started as administrator): said as it is, instead of
/// « select some text first » after a copy chord Windows dropped.
fn protected_window() -> AppError {
    AppError::new(
        ErrorKind::ProtectedWindow,
        "Cette fenêtre s’exécute en administrateur : son texte ne peut pas être lu.",
    )
}

/// A copy made at `changed_at` is fresh at `now` when it is at most `limit` ms old.
pub fn fresh(changed_at: Option<u64>, now: u64, limit: u64) -> bool {
    changed_at.is_some_and(|at| at <= now && now - at <= limit)
}

fn read_clipboard() -> Option<String> {
    Clipboard::new().and_then(|mut c| c.get_text()).ok()
}

/// Without a UIA selection: copies for the user (synthetic Ctrl+Insert), else accepts a
/// copy he made himself in the last three seconds, else nothing to translate. A copy that
/// worked can be pasted over (origin `copy`) only when UI Automation proves its selection
/// (`copy_proved`, NATIVE-002); otherwise its result is for Copy only.
pub(crate) fn clipboard_capture(
    source_window: isize,
    source_class: &str,
) -> Result<StoredCapture, AppError> {
    let pressed_at = crate::host::now_ms();
    let changed_at = crate::host::clipboard_changed_at();
    // The user's own fresh copy may serve as the source (decision B, 01/10), never one a
    // password manager marked as sensitive: such a clipboard is neither read nor sent anywhere,
    // the shortcut then finds nothing to act on. Judged now, on the user's clipboard as it is
    // (our own restoration after the synthetic copy adds the same opt-out formats).
    let usable_copy =
        fresh(changed_at, pressed_at, FRESH_COPY_MS) && !crate::clipboard_guard::sensitive();
    let copied = synthetic_copy(source_window);
    let (text, origin) = match &copied {
        Ok(text) => (Some(text.clone()), CaptureOrigin::Copy),
        // Another application wrote the clipboard meanwhile: what it holds now is not the
        // user's own copy either (NATIVE-003).
        Err(FOREIGN_WRITE) => (None, CaptureOrigin::Fresh),
        Err(_) => (
            usable_copy.then(read_clipboard).flatten(),
            CaptureOrigin::Fresh,
        ),
    };
    let text = copied_text(text).map_err(|mut error| {
        // NATIVE-004: the copy was never sent, the user's clipboard could not be kept whole.
        if error.kind == ErrorKind::NoSelection
            && matches!(copied, Err(CLIPBOARD_UNKEEPABLE | CLIPBOARD_BUSY))
        {
            error = unkeepable_capture();
        }
        // For the real capture matrix only (FLOWTRANSLATE_CAPTURE_TRACE): which step of
        // the synthetic copy gave up and how old the user's last copy is. Never any text.
        if error.kind == ErrorKind::NoSelection
            && std::env::var_os("FLOWTRANSLATE_CAPTURE_TRACE").is_some()
        {
            let age = changed_at.map(|at| pressed_at.saturating_sub(at));
            error.message.push_str(&format!(
                " [copy: {}; last user copy: {:?} ms ago]",
                copied.as_ref().err().copied().unwrap_or("ok"),
                age
            ));
        }
        // The journal says which step of the copy gave up (a fixed word, never a text).
        error.because(copied.as_ref().err().copied().unwrap_or(""))
    })?;
    ensure_source_unchanged(source_window)?;
    let proved = origin == CaptureOrigin::Copy && copy_proved(&text);
    let can_replace = replaceable(origin, proved, source_class, false);
    let target = can_replace.then(|| TargetIdentity {
        runtime_id: ui_automation()
            .ok()
            .and_then(|a| a.get_focused_element().ok())
            .and_then(|e| e.get_runtime_id().ok()),
        native_window: source_window,
        control: crate::host::focused_control(source_window).map_or(0, |(handle, _)| handle),
        selected_text: text.clone(),
        anchor: None,
        selection_len: text.chars().count(),
        editable: true,
        check: TargetCheck::Copy,
    });
    let public = Capture {
        id: Uuid::new_v4().to_string(),
        text,
        source: CaptureSource::Clipboard,
        origin,
        can_replace,
        anchor: None,
        selection_rects: Vec::new(),
        screen: None,
        replay: None,
        execution: None,
        menu: None,
    };
    Ok(StoredCapture {
        public,
        target,
        invalidated: false,
        levels: HaloLevels::default(),
    })
}

/// The steps of a synthetic copy that give up before any key is sent (NATIVE-004): the user's
/// clipboard cannot be kept whole (a copy would lose the rest of it), or another application
/// holds it open.
const CLIPBOARD_UNKEEPABLE: &str = "clipboard unkeepable";
const CLIPBOARD_BUSY: &str = "clipboard busy";

/// The capture's notice when the clipboard cannot be kept whole: nothing was copied, nothing
/// lost; the user copies the text himself, then presses the shortcut again (Lucas, 10/10).
fn unkeepable_capture() -> AppError {
    AppError::new(
        ErrorKind::ClipboardUnkeepable,
        "Le presse-papiers ne peut pas être conservé en entier : rien n’a été copié ni perdu. \
         Copiez le texte vous-même, puis relancez.",
    )
}

/// The paste's refusal when the clipboard cannot be kept whole (nothing is written over it:
/// Copy result is the user's own choice), or is held open by another application.
fn unkept_paste(unkept: crate::clipboard_guard::Unkept) -> AppError {
    match unkept {
        crate::clipboard_guard::Unkept::Unkeepable => AppError::new(
            ErrorKind::ClipboardUnkeepable,
            "Le presse-papiers ne peut pas être conservé en entier : rien n’a été remplacé ni \
             perdu; utilisez Copier.",
        )
        .because(CLIPBOARD_UNKEEPABLE),
        crate::clipboard_guard::Unkept::Busy => AppError::new(
            ErrorKind::PasteBlocked,
            "Le presse-papiers est occupé : rien n’a été remplacé; utilisez Copier.",
        )
        .because(CLIPBOARD_BUSY),
    }
}

/// Sends the copy chord to the source window, reads what it copied and puts the previous
/// clipboard back (every format), within one clipboard session once the copy has finished:
/// whatever the source wrote, in however many steps, the user's clipboard comes back (0.6: it
/// used not to, see clipboard_guard.rs). A copy that lands after the wait is still undone, as
/// long as the user did nothing meanwhile. A clipboard that cannot be kept whole is never
/// copied over. The error names the step that gave up, for the matrix and the journal.
fn synthetic_copy(source_window: isize) -> Result<String, &'static str> {
    if source_window == 0 || crate::host::foreground() != source_window {
        return Err("source window lost");
    }
    if !crate::host::wait_modifiers_released(CHORD_RELEASE) {
        return Err("modifiers still down");
    }
    if crate::host::foreground() != source_window {
        return Err("source window lost after the chord");
    }
    copy_and_restore()?
        .filter(|text| !text.trim().is_empty())
        .ok_or("copied nothing readable")
}

/// The clipboard changed, but another application than the source wrote it (NATIVE-003).
const FOREIGN_WRITE: &str = "foreign clipboard write";

/// The processes that may write the copy of the window in front (NATIVE-003): its own, its
/// focused control's and the focused UI Automation element's (a frame and its content may live
/// in two processes); never ours.
fn source_processes() -> Vec<u32> {
    let window = crate::host::foreground();
    let control = crate::host::focused_control(window).map(|(handle, _)| handle);
    let element = focused_element().and_then(|element| element.get_process_id().ok());
    let own = std::process::id();
    let mut pids: Vec<u32> = [
        Some(crate::host::window_process(window)),
        control.map(crate::host::window_process),
        element,
    ]
    .into_iter()
    .flatten()
    .filter(|&pid| pid != 0 && pid != own)
    .collect();
    pids.sort_unstable();
    pids.dedup();
    pids
}

/// One copy chord to the window in front: what it copied (None: a copy without text), the
/// clipboard put back; `Err`: nothing was copied in time (watched a little longer), another
/// application wrote the clipboard (neither read nor undone), or the clipboard could not be
/// kept whole and no key was sent.
fn copy_and_restore() -> Result<Option<String>, &'static str> {
    use crate::clipboard_guard::{self, Copied, Keeper, Unkept};
    clipboard_guard::settle_late(crate::host::last_input_tick);
    let keeper = Keeper::take().map_err(|unkept| match unkept {
        Unkept::Unkeepable => CLIPBOARD_UNKEEPABLE,
        Unkept::Busy => CLIPBOARD_BUSY,
    })?;
    let sources = source_processes();
    crate::host::suppress_clipboard_tracking(OWN_TRAFFIC);
    let before = crate::host::clipboard_sequence();
    let watch_late = |keeper, sources| {
        clipboard_guard::watch_late(
            keeper,
            before,
            crate::host::last_input_tick(),
            crate::host::last_input_tick,
            sources,
        )
    };
    if let Err(sent) = crate::host::send_copy_chord() {
        // QA-03-C: Ctrl+Insert copies on its key down, so a chord cut part-way may still have
        // copied the selection. The user's clipboard comes back as after any copy of ours (it
        // used to stay overwritten); what was copied is not taken: the chord did not go through.
        if sent > 0
            && clipboard_guard::take_copy(&keeper, before, COPY_SETTLE, &sources) == Copied::Nothing
        {
            watch_late(keeper, sources);
        }
        return Err("SendInput refused");
    }
    match clipboard_guard::take_copy(&keeper, before, COPY_SETTLE, &sources) {
        Copied::Taken { text, .. } => Ok(text),
        Copied::Foreign => Err(FOREIGN_WRITE),
        Copied::Nothing => {
            watch_late(keeper, sources);
            Err("no clipboard change")
        }
    }
}

/// The identity check before a paste and for the watcher: the source window is still in
/// front, its focused control is the same and, when UI Automation gave the selection,
/// the focused element and its selection are unchanged (a UIA target compares its selection
/// even without a drawable anchor: review n°1); a copy target's selection still reads as the
/// copied text (NATIVE-002). A UIA that stopped answering proves nothing: `target_unverified`,
/// the replacement is refused (NATIVE-001).
pub fn validate_target(target: &TargetIdentity) -> Result<(), AppError> {
    // `reason`: which check saw the change, for the journal (a fixed word, never a text).
    let changed = |message: &str, reason: &'static str| {
        Err(AppError::new(ErrorKind::TargetChanged, message).because(reason))
    };
    if crate::host::foreground() != target.native_window {
        return changed("La fenêtre source a changé; remplacement refusé.", "window");
    }
    if target.control != 0
        && crate::host::focused_control(target.native_window)
            .is_some_and(|(handle, _)| handle != target.control)
    {
        return changed("Le champ actif a changé; remplacement refusé.", "control");
    }
    // NATIVE-002: a copy target was replaceable only because UI Automation read its selection as
    // the copied text, and it must still read so. Collapsed by a click, the control copy of VS
    // Code would give back its whole line (the very text captured when that line was selected),
    // and the paste would insert at the caret.
    if target.check == TargetCheck::Copy {
        if !copy_proved(&target.selected_text) {
            return changed(
                "La sélection a changé; remplacement refusé.",
                "copy unproved",
            );
        }
        return Ok(());
    }
    // NATIVE-001 (decision 1, Lucas 10/10): from here on a UIA target, which UI Automation alone
    // proves. One that no longer answers (no focused element, no runtime id, a selection it
    // cannot read) proves nothing: the replacement is refused, the result is for Copy. A silent
    // UIA used to count as no change, and the paste went wherever the selection had moved.
    let unverified = |reason: &'static str| {
        Err(AppError::new(
            ErrorKind::TargetUnverified,
            "La sélection ne peut plus être vérifiée; remplacement refusé, utilisez Copier.",
        )
        .because(reason))
    };
    let Some(runtime_id) = &target.runtime_id else {
        return unverified("no runtime id");
    };
    let Some(element) = focused_element() else {
        return unverified("uia silent");
    };
    let Ok(now) = element.get_runtime_id() else {
        return unverified("runtime id unreadable");
    };
    if element_changed(target.check, runtime_id, Some(&now)) {
        return changed("La cible a changé; remplacement refusé.", "element");
    }
    let selection = selection(&element);
    if let Some(reason) = selection_changed(target, &selection) {
        return changed("La sélection a changé; remplacement refusé.", reason);
    }
    if selection.is_err() {
        return unverified("selection unreadable");
    }
    Ok(())
}

/// Whether the focused element is another one than the captured. Only a UIA target is held to
/// its element: a copy target is identified by its window, its control and, at the paste, by
/// a second copy that must give the captured text again. 0.6: LibreOffice Writer gives its
/// paragraph a new runtime id each time it gets the focus back, and every replacement there
/// was refused (« Text changed ») by an identity that never holds.
fn element_changed(check: TargetCheck, captured: &[i32], now: Option<&[i32]>) -> bool {
    check == TargetCheck::Uia && now.is_some_and(|id| id != captured)
}

/// Review n°1: a text only a synthetic copy gave (VS Code's Monaco has no text pattern) is
/// copied again right before the paste, once the target is revalidated and the keys are up:
/// the paste goes on only when the source copies exactly the captured text again. Nothing
/// selected any more makes VS Code copy its whole line: never « contains », always « equals ».
/// The clipboard is put back as after the capture's own copy.
fn control_copy(target: &TargetIdentity) -> Result<(), AppError> {
    let copied =
        match copy_and_restore() {
            Ok(copied) => copied,
            Err("SendInput refused") => {
                return Err(AppError::new(
                    ErrorKind::PasteBlocked,
                    "La vérification de la sélection a été bloquée; remplacement refusé.",
                )
                .because("control copy refused"))
            }
            Err(CLIPBOARD_UNKEEPABLE) => {
                return Err(unkept_paste(crate::clipboard_guard::Unkept::Unkeepable))
            }
            Err(CLIPBOARD_BUSY) => return Err(unkept_paste(crate::clipboard_guard::Unkept::Busy)),
            Err(FOREIGN_WRITE) => return Err(AppError::new(
                ErrorKind::PasteBlocked,
                "Une autre application a écrit le presse-papiers pendant la vérification de la \
                 sélection; remplacement refusé.",
            )
            .because(FOREIGN_WRITE)),
            Err(_) => None,
        };
    same_copy(copied.as_deref(), &target.selected_text)
}

/// The control copy of a copy target must give back exactly the captured text.
fn same_copy(copied: Option<&str>, captured: &str) -> Result<(), AppError> {
    let changed = |reason| {
        Err(AppError::new(
            ErrorKind::TargetChanged,
            "La sélection a changé; remplacement refusé.",
        )
        .because(reason))
    };
    match copied {
        Some(text) if !text.is_empty() && text == captured => Ok(()),
        Some(text) if !text.is_empty() => changed("control copy differs"),
        _ => changed("control copy empty"),
    }
}

/// Whether the last rectangle of the selection moved (a scroll, a reflow): by more than a
/// sub-pixel drift, or it is no longer drawn. A capture that had no drawable rectangle has no
/// place to lose (0.5.1 refused a Chromium `<input>` that only gave its rectangles later).
fn anchor_moved(captured: Option<Rect>, now: Option<Rect>) -> bool {
    match (captured, now) {
        (Some(a), Some(b)) => [a.x - b.x, a.y - b.y, a.width - b.width, a.height - b.height]
            .iter()
            .any(|d| d.abs() > ANCHOR_DRIFT),
        (Some(_), None) => true,
        (None, _) => false,
    }
}

/// Whether what UI Automation answers now differs from the captured selection, and what
/// differs: another text, length or last rectangle, or no selection at all while the control
/// still answers (a click or an arrow collapsed it to the caret: a paste would insert there
/// instead of replacing). A control that stopped answering is not a change.
fn selection_changed(
    target: &TargetIdentity,
    now: &Result<(String, Vec<Rect>, usize, bool), String>,
) -> Option<&'static str> {
    match now {
        Ok((text, _, _, _)) if *text != target.selected_text => Some("text"),
        Ok((_, _, selection_len, _)) if *selection_len != target.selection_len => Some("length"),
        Ok((_, rects, _, _)) if anchor_moved(target.anchor, anchor_of(rects)) => Some("anchor"),
        Ok(_) => None,
        Err(message) if message == NO_SELECTION => Some("collapsed"),
        Err(message) if message == MULTIPLE_SELECTION => Some("multiple"),
        Err(_) => None,
    }
}

/// How a paste ended: the field read back proves it (`confirmed`), or the chord went through
/// and nothing proves it (assumed, like Wispr Flow: nothing could read the field, or it reads
/// no change that proves the paste).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Delivery {
    pub confirmed: bool,
}

/// Line endings and the non-breaking spaces Chromium makes of boundary spaces in a
/// contenteditable: the readback and copy proofs only, never the identity checks.
pub fn canonical(text: &str) -> String {
    text.replace("\r\n", "\n")
        .replace('\r', "\n")
        .replace('\u{a0}', " ")
}

/// Whether the field's readback proves the paste (NATIVE-010). None: nothing can read the field
/// now. True only when the field reads otherwise than before the paste, and the difference is the
/// captured selection turned into the result in one place: the text before and after it as it
/// was. The result found anywhere in the field proved nothing (it may have been there already,
/// beside a paste the page blocked); a field that could not be read before proves nothing either.
pub fn readback_confirms(
    before: Option<&str>,
    after: Option<&str>,
    replaced: &str,
    value: &str,
) -> Option<bool> {
    let after: Vec<char> = canonical(after?).chars().collect();
    let Some(before) = before else {
        return Some(false);
    };
    let before: Vec<char> = canonical(before).chars().collect();
    let replaced: Vec<char> = canonical(replaced).chars().collect();
    let value: Vec<char> = canonical(value).chars().collect();
    Some(replaced_in_place(&before, &after, &replaced, &value))
}

/// Whether `after` is `before` with `replaced` turned into `value` at one place `s`: the same
/// text before `s`, `replaced` then `value` at `s`, the same text after them. `s` can only lie
/// between the end of the common tail and the end of the common head: a few places in a real
/// text. A text so repetitive that thousands of places remain proves nothing (assumed).
fn replaced_in_place(before: &[char], after: &[char], replaced: &[char], value: &[char]) -> bool {
    const PLACES: usize = 4_096;
    if before == after
        || replaced.len() > before.len()
        || after.len() + replaced.len() != before.len() + value.len()
    {
        return false;
    }
    let head = before.iter().zip(after).take_while(|(b, a)| b == a).count();
    let tail = before
        .iter()
        .rev()
        .zip(after.iter().rev())
        .take_while(|(b, a)| b == a)
        .count();
    // after[..s] == before[..s] needs s <= head; after[s + value..] == before[s + replaced..]
    // needs the common tail to cover what follows the result.
    let first = after.len().saturating_sub(tail + value.len());
    let last = head.min(before.len() - replaced.len());
    if first > last || last - first >= PLACES {
        return false;
    }
    (first..=last)
        .any(|s| before[s..s + replaced.len()] == *replaced && after[s..s + value.len()] == *value)
}

/// Reads the focused field: UI Automation first (its value, else its document), then
/// WM_GETTEXT on a Win32 Edit/RichEdit control. None when nothing can read it.
pub(crate) fn field_text(window: isize) -> Option<String> {
    if let Some(element) = focused_element() {
        if let Ok(value) = element
            .get_pattern::<UIValuePattern>()
            .and_then(|p| p.get_value())
        {
            return Some(value);
        }
        if let Ok(document) = element
            .get_pattern::<UITextPattern>()
            .and_then(|p| p.get_document_range())
            .and_then(|r| r.get_text(FIELD_CAP as i32))
        {
            return Some(document);
        }
    }
    #[cfg(windows)]
    {
        let (control, class) = crate::host::focused_control(window)?;
        let lower = class.to_ascii_lowercase();
        if lower == "edit" || lower.starts_with("richedit") {
            return control_text(control).ok();
        }
    }
    #[cfg(not(windows))]
    let _ = window;
    None
}

/// Pastes `value` over the captured selection (0.4.0, the Wispr Flow route): checks the
/// identity, waits for the shortcut chord to be released, keeps the clipboard, writes
/// the result, sends one Ctrl+V, then reads the field back when something can read it
/// and puts the clipboard back while it still holds our write. `reactivate` (the menu
/// of the glass) brings the source window back to the front first. `ticket` is the session's
/// (NATIVE-006): read again before each step that acts on the source, and last right before the
/// chord; revoked, nothing more is sent and the clipboard comes back.
pub fn paste(
    target: &TargetIdentity,
    value: &str,
    reactivate: bool,
    ticket: Ticket,
) -> Result<Delivery, AppError> {
    if !ticket.live() {
        return Err(revoked());
    }
    paste_preflight(target, value)?;
    // Windows would drop our keys (the window was started as administrator): nothing is sent.
    if crate::host::window_protected(target.native_window) {
        return Err(protected_window());
    }
    #[cfg(windows)]
    if reactivate && crate::host::foreground() != target.native_window {
        use windows::Win32::{Foundation::HWND, UI::WindowsAndMessaging::SetForegroundWindow};
        // Not under a held chord: released over the source, Alt would first move its
        // focus to its menu bar (Win11 Notepad) and the revalidation would refuse.
        released(crate::host::wait_modifiers_released(CHORD_RELEASE))?;
        if !unsafe { SetForegroundWindow(HWND(target.native_window as *mut _)) }.as_bool() {
            return Err(AppError::new(
                ErrorKind::PasteBlocked,
                "Impossible de réactiver la fenêtre source; utilisez Copier.",
            ));
        }
        std::thread::sleep(Duration::from_millis(60));
    }
    #[cfg(not(windows))]
    let _ = reactivate;
    validate_target(target)?;
    released(crate::host::wait_modifiers_released(CHORD_RELEASE))?;
    validate_target(target)?;
    if target.check == TargetCheck::Copy {
        if !ticket.live() {
            return Err(revoked());
        }
        control_copy(target)?;
    }
    // What the field reads before the paste: a field that reads exactly the same afterwards
    // was not written (0.6: a PDF in a browser used to end on the check of a success).
    let before = field_text(target.native_window);
    crate::clipboard_guard::settle_late(crate::host::last_input_tick);
    if !ticket.live() {
        return Err(revoked());
    }
    // NATIVE-004: a clipboard that cannot be kept whole is never written over (nothing pasted).
    let take = || crate::clipboard_guard::Keeper::take().map_err(unkept_paste);
    let mut keeper = take()?;
    crate::host::suppress_clipboard_tracking(Duration::from_secs(4));
    if keeper.put_text(value).is_err() {
        // Written between the snapshot and our text (a clipboard manager): taken again, once.
        keeper = take()?;
        keeper.put_text(value).map_err(|message| {
            AppError::new(ErrorKind::PasteBlocked, message).because("clipboard busy")
        })?;
    }
    // From here on our text is on the clipboard: whatever happens, what was there comes back
    // (unless somebody else wrote it meanwhile: a newer copy is never overwritten).
    if let Err(error) = validate_target(target) {
        let _ = keeper.restore_ours();
        return Err(error);
    }
    // The last look before the chord: an emergency exit since then, even under the state lock
    // this paste holds, and no Ctrl+V leaves (NATIVE-006).
    if !ticket.live() {
        let _ = keeper.restore_ours();
        return Err(revoked());
    }
    if let Err(sent) = crate::host::send_paste_chord() {
        // A part of the chord left: the target may still read the clipboard for a moment.
        if sent != 0 {
            std::thread::sleep(PASTE_SETTLE);
        }
        let _ = keeper.restore_ours();
        return Err(AppError::new(
            ErrorKind::PasteBlocked,
            "Le collage a été bloqué par Windows ou par l’application; utilisez Copier.",
        )
        .because("paste chord refused"));
    }
    let started = Instant::now();
    let mut readable = true;
    // NATIVE-010: only a change proves the paste. Nothing read before it, or a result that is
    // the replaced text itself, can prove nothing: no long wait for a proof that cannot come.
    let provable = before.is_some() && canonical(&target.selected_text) != canonical(value);
    let mut after;
    let confirmed = loop {
        after = field_text(target.native_window);
        match readback_confirms(
            before.as_deref(),
            after.as_deref(),
            &target.selected_text,
            value,
        ) {
            Some(true) => break true,
            Some(false) => {}
            None => readable = false,
        }
        let elapsed = started.elapsed();
        if ((!readable || !provable) && elapsed >= PASTE_SETTLE) || elapsed >= PASTE_CONFIRM {
            break false;
        }
        std::thread::sleep(Duration::from_millis(40));
    };
    if started.elapsed() < PASTE_SETTLE {
        std::thread::sleep(PASTE_SETTLE - started.elapsed());
    }
    let mut untouched = !confirmed
        && unwritten(
            before.as_deref(),
            after.as_deref(),
            &target.selected_text,
            value,
        );
    if untouched {
        // Our text stays on the clipboard while a slow editor gets its last moment.
        std::thread::sleep(READ_ONLY_CONFIRM);
        untouched = unwritten(
            before.as_deref(),
            field_text(target.native_window).as_deref(),
            &target.selected_text,
            value,
        );
    }
    let _ = keeper.restore_ours();
    let read_only = |reason| {
        Err(AppError::new(
            ErrorKind::ReadOnly,
            "Ce texte est en lecture seule : rien n’a été remplacé; utilisez Copier.",
        )
        .because(reason))
    };
    if untouched {
        return read_only("field unchanged after the paste");
    }
    // Nothing can read the field (pdf.js in Firefox, 02/10: the paste was « assumed » and the
    // pill showed the check over a PDF): a copy target is asked once more. A paste that went
    // through leaves a caret, or the pasted text; the captured text still selected, to the
    // letter, was not replaced. The clipboard comes back as after any copy of ours.
    if !confirmed
        && after.is_none()
        && target.check == TargetCheck::Copy
        && crate::host::foreground() == target.native_window
    {
        let copied = copy_and_restore().ok().flatten();
        if still_selected(copied.as_deref(), &target.selected_text, value) {
            return read_only("selection still there after the paste");
        }
    }
    Ok(Delivery { confirmed })
}

/// Whether a paste left the field as it was: it could be read before and after, reads exactly
/// the same, and the result is not the text it replaced (pasting a text over itself changes
/// nothing either). A field nothing can read is never called read-only; nor is a document read
/// up to the cap only (the replaced selection may lie beyond what was read: a paste that went
/// through there used to be called « read-only », and the pill invited to paste a second time).
pub fn unwritten(before: Option<&str>, after: Option<&str>, replaced: &str, value: &str) -> bool {
    match (before, after) {
        (Some(before), Some(after)) => {
            before == after && read_whole(before) && canonical(replaced) != canonical(value)
        }
        _ => false,
    }
}
/// Whether a field's text is all of it: shorter than what was asked for.
fn read_whole(text: &str) -> bool {
    text.len() < FIELD_CAP || text.encode_utf16().count() < FIELD_CAP
}

/// Whether the copy made after a paste gives the captured text again, to the letter, while the
/// result was another text: the selection is still there, nothing was written over it.
pub fn still_selected(copied: Option<&str>, captured: &str, value: &str) -> bool {
    copied.is_some_and(|text| !text.is_empty() && text == captured)
        && canonical(captured) != canonical(value)
}

/// What is refused before anything is touched: a result the clipboard would cut at its
/// first NUL, a field that cannot be written.
fn paste_preflight(target: &TargetIdentity, value: &str) -> Result<(), AppError> {
    if value.contains('\0') {
        return Err(AppError::new(
            ErrorKind::PasteBlocked,
            "Le résultat contient un caractère nul; remplacement refusé.",
        ));
    }
    if !target.editable {
        return Err(AppError::new(
            ErrorKind::NotEditable,
            "Ce champ n’est pas modifiable; utilisez Copier.",
        ));
    }
    Ok(())
}

/// The shortcut's keys are still held: a chord sent now would be another one.
pub(crate) fn released(released: bool) -> Result<(), AppError> {
    if released {
        Ok(())
    } else {
        Err(AppError::new(
            ErrorKind::KeysHeld,
            "Relâchez les touches du raccourci, puis réessayez depuis la bulle.",
        ))
    }
}

#[cfg(windows)]
fn control_text(hwnd: isize) -> Result<String, String> {
    use windows::Win32::{
        Foundation::{HWND, LPARAM, WPARAM},
        UI::WindowsAndMessaging::{
            SendMessageTimeoutW, SMTO_ABORTIFHUNG, SMTO_BLOCK, WM_GETTEXT, WM_GETTEXTLENGTH,
        },
    };
    let hwnd = HWND(hwnd as *mut _);
    let message = |msg: u32, wparam: usize, lparam: isize| -> Result<usize, String> {
        let mut result = 0usize;
        let sent = unsafe {
            SendMessageTimeoutW(
                hwnd,
                msg,
                WPARAM(wparam),
                LPARAM(lparam),
                SMTO_ABORTIFHUNG | SMTO_BLOCK,
                250,
                Some(&mut result),
            )
        };
        if sent.0 == 0 {
            Err("Le contrôle source ne répond pas.".into())
        } else {
            Ok(result)
        }
    };
    let len = message(WM_GETTEXTLENGTH, 0, 0)?;
    if len > 200_000 {
        return Err("Le document source est trop volumineux.".into());
    }
    let mut text = vec![0u16; len + 1];
    let copied = message(WM_GETTEXT, text.len(), text.as_mut_ptr() as isize)?;
    text.truncate(copied.min(len));
    Ok(String::from_utf16_lossy(&text))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_emergency_exit_kills_the_tickets_taken_before_it_only() {
        let _epoch = EPOCH_TESTS.lock().unwrap_or_else(|p| p.into_inner());
        let before = Ticket::current();
        assert!(before.live());
        revoke_deliveries();
        assert!(!before.live());
        let after = Ticket::current();
        assert!(after.live());
        assert_ne!(before, after);
    }

    #[test]
    fn the_first_line_of_a_document_loses_the_margin_its_rectangle_included() {
        let r = |x: f64, y: f64, w: f64, h: f64| Rect {
            x,
            y,
            width: w,
            height: h,
        };
        // Notepad, 02/10: line 1 answers 34 px from the top of the control, an 18 px line.
        assert!(inset_line(34., 18.));
        assert!(
            !inset_line(18., 18.) && !inset_line(24., 18.),
            "a taller run (an emoji, a bigger word) is a line"
        );
        assert!(!inset_line(34., 0.));
        let mut rows = [r(350., 95., 544., 34.), r(46., 129., 80., 18.)];
        trim_rows(&mut rows, 95., 18.);
        assert_eq!(
            rows,
            [r(350., 111., 544., 18.), r(46., 129., 80., 18.)],
            "bottom kept, the second line untouched"
        );
        // Two runs of the first line are both cut back; a run of ordinary height stays.
        let mut rows = [
            r(100., 95., 40., 34.),
            r(140., 95., 30., 34.),
            r(170., 95.5, 20., 18.),
        ];
        trim_rows(&mut rows, 95., 18.);
        assert_eq!(
            rows,
            [
                r(100., 111., 40., 18.),
                r(140., 111., 30., 18.),
                r(170., 95.5, 20., 18.)
            ]
        );
    }
    #[test]
    fn an_anchorless_target_is_checked_by_its_text_and_a_copy_target_by_a_second_copy() {
        // Review n°1: a UIA selection without a drawable rectangle still compares its text.
        let target = TargetIdentity {
            runtime_id: Some(vec![1]),
            native_window: 1,
            control: 0,
            selected_text: "mot A".into(),
            anchor: None,
            selection_len: 5,
            editable: true,
            check: TargetCheck::Uia,
        };
        assert_eq!(
            selection_changed(&target, &Ok(("bloc B".into(), Vec::new(), 6, true))),
            Some("text"),
            "another selection in the same element"
        );
        assert_eq!(
            selection_changed(&target, &Err(NO_SELECTION.into())),
            Some("collapsed"),
            "collapsed to the caret"
        );
        assert_eq!(
            selection_changed(&target, &Ok(("mot A".into(), Vec::new(), 5, true))),
            None
        );
        // 0.6: the rectangles a Chromium `<input>` only gives later are not a change (0.5.1
        // refused every replacement there: « Text changed » on a selection that had not moved).
        let line = Rect {
            x: 100.,
            y: 200.,
            width: 300.,
            height: 18.,
        };
        assert_eq!(
            selection_changed(&target, &Ok(("mot A".into(), vec![line], 5, true))),
            None
        );
        // A copy target is not compared with UIA's selection: UIA must prove it (`copy_proved`,
        // NATIVE-002), then its control copy decides.
        assert!(same_copy(Some("mot A"), "mot A").is_ok());
        for copied in [
            None,
            Some(""),
            Some("bloc B"),
            Some("ligne entière avec mot A"),
            Some("mot A "),
        ] {
            assert_eq!(
                same_copy(copied, "mot A").unwrap_err().kind,
                ErrorKind::TargetChanged,
                "{copied:?}"
            );
        }
        // The element's id counts for a UIA target only (LibreOffice renews its ids).
        assert!(element_changed(TargetCheck::Uia, &[1, 2], Some(&[1, 3])));
        assert!(
            !element_changed(TargetCheck::Uia, &[1, 2], Some(&[1, 2]))
                && !element_changed(TargetCheck::Uia, &[1, 2], None)
        );
        assert!(!element_changed(TargetCheck::Copy, &[1, 2], Some(&[1, 3])));
        // The journal learns which check refused, never what was copied.
        assert_eq!(
            same_copy(None, "mot A").unwrap_err().reason,
            "control copy empty"
        );
        assert_eq!(
            same_copy(Some("bloc B"), "mot A").unwrap_err().reason,
            "control copy differs"
        );
    }

    #[test]
    fn a_paste_that_changed_nothing_is_a_read_only_text_and_never_a_success() {
        // A PDF in a browser: readable before and after, exactly the same: nothing was written.
        assert!(unwritten(
            Some("Page du PDF, ligne choisie."),
            Some("Page du PDF, ligne choisie."),
            "ligne choisie",
            "chosen line"
        ));
        // The field changed (even without the readback's proof): the paste went somewhere.
        assert!(!unwritten(Some("avant"), Some("après"), "avant", "after"));
        // Nothing can read the field (Scintilla, a canvas): assumed pasted, as in 0.4.
        assert!(!unwritten(None, None, "x", "y"));
        assert!(!unwritten(Some("avant"), None, "x", "y"));
        assert!(!unwritten(None, Some("après"), "x", "y"));
        // The result is the text it replaced (nothing to correct): the same field is a success.
        assert!(!unwritten(
            Some("Bonjour à tous."),
            Some("Bonjour à tous."),
            "Bonjour",
            "Bonjour"
        ));
        assert!(
            !unwritten(Some("a\r\nb"), Some("a\r\nb"), "a\r\nb", "a\nb"),
            "line endings aside"
        );
        // (see below for the rectangles of a first line)
        // A document read up to the cap: the selection may lie beyond, nothing is concluded.
        let head = "a".repeat(FIELD_CAP);
        assert!(!unwritten(Some(&head), Some(&head), "avant", "after"));
        let short = "a".repeat(FIELD_CAP - 1);
        assert!(unwritten(Some(&short), Some(&short), "avant", "after"));
        // A field nothing can read, reached by copy (pdf.js): the copy after the paste decides.
        assert!(
            still_selected(Some("ligne choisie"), "ligne choisie", "chosen line"),
            "still selected: not replaced"
        );
        assert!(
            !still_selected(None, "ligne choisie", "chosen line"),
            "a caret copies nothing: pasted"
        );
        assert!(!still_selected(Some(""), "ligne choisie", "chosen line"));
        assert!(
            !still_selected(Some("chosen line"), "ligne choisie", "chosen line"),
            "the pasted text kept selected"
        );
        assert!(
            !still_selected(
                Some(
                    "toute la ligne avec chosen line dedans
"
                ),
                "ligne choisie",
                "chosen line"
            ),
            "an editor that copies its line"
        );
        assert!(
            !still_selected(Some("Bonjour"), "Bonjour", "Bonjour"),
            "nothing to correct: the same text is a success"
        );
        assert_eq!(
            serde_json::to_value(ErrorKind::ReadOnly).unwrap(),
            "read_only"
        );
    }

    #[test]
    fn the_anchor_moves_with_a_scroll_and_not_with_a_sub_pixel_drift() {
        let line = Rect {
            x: 100.,
            y: 200.,
            width: 300.,
            height: 18.,
        };
        assert!(!anchor_moved(Some(line), Some(line)));
        // 0.5.1 compared exactly: the first try of a series was refused in a textarea whose
        // layout settled by a fraction of a pixel while the Îlot showed.
        assert!(!anchor_moved(
            Some(line),
            Some(Rect {
                x: 100.5,
                y: 199.25,
                width: 301.5,
                ..line
            })
        ));
        assert!(
            anchor_moved(Some(line), Some(Rect { y: 218., ..line })),
            "one line of scroll"
        );
        assert!(
            anchor_moved(
                Some(line),
                Some(Rect {
                    width: 280.,
                    ..line
                })
            ),
            "the selection shrank"
        );
        assert!(
            anchor_moved(Some(line), None),
            "no longer drawn: scrolled out of sight"
        );
        assert!(
            !anchor_moved(None, Some(line)),
            "never had a place: nothing to lose"
        );
        assert!(!anchor_moved(None, None));
    }

    #[test]
    fn a_selection_collapsed_to_the_caret_is_a_change_but_a_silent_control_is_not() {
        let line = Rect {
            x: 100.,
            y: 200.,
            width: 300.,
            height: 18.,
        };
        let target = TargetIdentity {
            runtime_id: Some(vec![1]),
            native_window: 1,
            control: 0,
            selected_text: "Deux lignes".into(),
            anchor: Some(line),
            selection_len: 11,
            editable: true,
            check: TargetCheck::Uia,
        };
        let same: Result<(String, Vec<Rect>, usize, bool), String> = Ok((
            "Deux lignes".into(),
            vec![Rect { y: 182., ..line }, line],
            11,
            true,
        ));
        assert_eq!(selection_changed(&target, &same), None);
        assert_eq!(
            selection_changed(&target, &Err(NO_SELECTION.into())),
            Some("collapsed"),
            "collapsed by a click: a paste would insert at the caret"
        );
        assert_eq!(
            selection_changed(
                &target,
                &Ok((
                    "Deux lignes".into(),
                    vec![Rect { y: 230., ..line }],
                    11,
                    true
                ))
            ),
            Some("anchor"),
            "scrolled: the anchor moved"
        );
        assert_eq!(
            selection_changed(&target, &Ok(("Autre".into(), vec![line], 5, true))),
            Some("text")
        );
        assert_eq!(
            selection_changed(&target, &Ok(("Deux lignes".into(), vec![line], 12, true))),
            Some("length")
        );
        assert_eq!(
            selection_changed(
                &target,
                &Err("La sélection n’est pas accessible par UI Automation.".into())
            ),
            None,
            "a control that stopped answering is not a change (validate_target refuses it as \
             unverified: NATIVE-001)"
        );
    }

    #[test]
    fn a_uia_target_ui_automation_no_longer_answers_for_is_refused_as_unverified() {
        // NATIVE-001 (decision 1): the target's window is in front, UI Automation gives no
        // focused element (the bench's fault, this thread only): nothing proves the selection.
        let target = TargetIdentity {
            runtime_id: Some(vec![42]),
            native_window: crate::host::foreground(),
            control: 0,
            selected_text: "x".into(),
            anchor: None,
            selection_len: 1,
            editable: true,
            check: TargetCheck::Uia,
        };
        faults::silence_uia(true);
        let silent = validate_target(&target);
        faults::silence_uia(false);
        let silent = silent.unwrap_err();
        assert_eq!(
            (silent.kind, silent.reason),
            (ErrorKind::TargetUnverified, "uia silent")
        );
        // A UIA target without the element's id has nothing to be proved with either.
        let anonymous = TargetIdentity {
            runtime_id: None,
            ..target
        };
        let refused = validate_target(&anonymous).unwrap_err();
        assert_eq!(
            (refused.kind, refused.reason),
            (ErrorKind::TargetUnverified, "no runtime id")
        );
        assert_eq!(
            serde_json::to_value(ErrorKind::TargetUnverified).unwrap(),
            "target_unverified"
        );
    }

    #[test]
    fn a_paste_replaces_a_uia_selection_or_a_proved_copy_but_never_a_console_or_a_password() {
        assert!(replaceable(
            CaptureOrigin::Uia,
            true,
            "Chrome_WidgetWin_1",
            false
        ));
        assert!(!replaceable(
            CaptureOrigin::Uia,
            false,
            "Chrome_WidgetWin_1",
            false
        ));
        assert!(replaceable(CaptureOrigin::Copy, true, "Notepad", false));
        // NATIVE-002: a copy UI Automation does not prove is for Copy only (VS Code without a
        // selection copies its whole line: the paste inserted at the caret).
        assert!(!replaceable(CaptureOrigin::Copy, false, "Notepad", false));
        assert!(proves_copy("mot A", "mot A"));
        assert!(
            proves_copy("a\r\nb\u{a0}c", "a\nb c"),
            "line endings, editor spaces"
        );
        for (selected, copied) in [
            ("", "seconde ligne à garder\n"),
            ("mot", "ligne entière avec mot\n"),
            ("delta", "alpha\ndelta"),
        ] {
            assert!(!proves_copy(selected, copied), "{selected:?} / {copied:?}");
        }
        assert!(!replaceable(
            CaptureOrigin::Copy,
            true,
            "CASCADIA_HOSTING_WINDOW_CLASS",
            false
        ));
        assert!(!replaceable(
            CaptureOrigin::Copy,
            true,
            "ConsoleWindowClass",
            false
        ));
        assert!(!replaceable(CaptureOrigin::Uia, true, "Edit", true));
        for origin in [
            CaptureOrigin::Fresh,
            CaptureOrigin::Replay,
            CaptureOrigin::Demo,
        ] {
            assert!(!replaceable(origin, true, "Notepad", false));
        }
    }

    #[test]
    fn the_readback_proof_tolerates_line_endings_and_editor_spaces_only() {
        let proof = |before: &str, after: &str, replaced: &str, value: &str| {
            readback_confirms(Some(before), Some(after), replaced, value)
        };
        assert_eq!(
            proof(
                "Début café\r\nfin",
                "Début\u{a0}équipe\r\nfin",
                "café",
                "équipe"
            ),
            Some(true)
        );
        assert_eq!(
            proof("avant café après", "avant équipe après", "café", "équipe"),
            Some(true)
        );
        assert_eq!(
            proof("deux  espaces", "deux  espaces!", "espaces", "espaces!"),
            Some(true),
            "a result that starts like what it replaced"
        );
        assert_eq!(
            proof("a café b", "a équipe b", "café", "deux  équipe"),
            Some(false),
            "two spaces are not one"
        );
        assert_eq!(readback_confirms(None, None, "x", "y"), None);
    }

    #[test]
    fn a_paste_is_confirmed_only_by_a_change_in_place_never_by_a_result_found_elsewhere() {
        let proof = |before: &str, after: &str, replaced: &str, value: &str| {
            readback_confirms(Some(before), Some(after), replaced, value)
        };
        // NATIVE-010: the result was already in the field and the page blocked the paste.
        let blocked = "équipe 🚀 — Début 🚀 café 😀 fin";
        assert_eq!(proof(blocked, blocked, "café 😀", "équipe 🚀"), Some(false));
        // The same paste that went through: proved.
        assert_eq!(
            proof(
                blocked,
                "équipe 🚀 — Début 🚀 équipe 🚀 fin",
                "café 😀",
                "équipe 🚀"
            ),
            Some(true)
        );
        // Inserted at the caret instead of replacing (VS Code without a selection): not proved.
        assert_eq!(
            proof(
                "seconde ligne à garder",
                "secondeRÉSULTAT ligne à garder",
                "seconde ligne à garder\n",
                "RÉSULTAT"
            ),
            Some(false)
        );
        assert_eq!(
            proof("Début café fin", "Début équipecafé fin", "café", "équipe"),
            Some(false),
            "the result beside the selection, which is still there"
        );
        // Something else changed, the result nowhere in place.
        assert_eq!(
            proof("Début café fin", "Début cafe fin", "café", "équipe"),
            Some(false)
        );
        // Nothing read before the paste: nothing to compare with, assumed.
        assert_eq!(
            readback_confirms(None, Some("Début équipe fin"), "café", "équipe"),
            Some(false)
        );
        // The result is the text it replaced: no change can prove it.
        assert_eq!(proof("a café b", "a café b", "café", "café"), Some(false));
        // A result whose head and tail repeat around it (the place is found all the same).
        assert_eq!(proof("Pxab", "Pxaab", "x", "xa"), Some(true));
        assert_eq!(proof("aaaa", "aaaaa", "a", "aa"), Some(true));
        // A text so repetitive that thousands of places remain: assumed, never confirmed.
        let long = "a".repeat(10_000);
        assert_eq!(proof(&long, &format!("{long}a"), "a", "aa"), Some(false));
    }

    #[test]
    fn every_refusal_of_a_capture_or_a_paste_carries_its_code() {
        // The capture: a protected field, nothing readable, too long.
        assert!(refuse_protected(Ok(false)).is_ok());
        assert_eq!(
            refuse_protected(Ok(true)).unwrap_err().kind,
            ErrorKind::ProtectedField
        );
        assert_eq!(
            refuse_protected(Err(())).unwrap_err().kind,
            ErrorKind::ProtectedField
        );
        assert_eq!(copied_text(None).unwrap_err().kind, ErrorKind::NoSelection);
        assert_eq!(
            copied_text(Some(" \n\t".into())).unwrap_err().kind,
            ErrorKind::NoSelection
        );
        assert_eq!(
            copied_text(Some("é".repeat(MAX_CHARS + 1)))
                .unwrap_err()
                .kind,
            ErrorKind::TooLong
        );
        assert_eq!(
            copied_text(Some("é".repeat(MAX_CHARS))).unwrap(),
            "é".repeat(MAX_CHARS)
        );
        // A window that is not in front (0 never is): the capture is refused as changed.
        assert_eq!(
            ensure_source_unchanged(0).unwrap_err().kind,
            ErrorKind::TargetChanged
        );
        // The paste: NUL, a read-only field, the chord still held, another window in front.
        let target = TargetIdentity {
            runtime_id: None,
            native_window: 1,
            control: 0,
            selected_text: "x".into(),
            anchor: None,
            selection_len: 1,
            editable: true,
            check: TargetCheck::Uia,
        };
        assert_eq!(
            paste_preflight(&target, "a\0b").unwrap_err().kind,
            ErrorKind::PasteBlocked
        );
        assert_eq!(
            paste_preflight(
                &TargetIdentity {
                    editable: false,
                    ..target.clone()
                },
                "ok"
            )
            .unwrap_err()
            .kind,
            ErrorKind::NotEditable
        );
        assert!(paste_preflight(&target, "ok").is_ok());
        assert_eq!(released(false).unwrap_err().kind, ErrorKind::KeysHeld);
        assert!(released(true).is_ok());
        // NATIVE-004: a clipboard that cannot be kept whole refuses the copy and the paste with
        // its own code (a busy one blocks the paste, as before).
        use crate::clipboard_guard::Unkept;
        assert_eq!(unkeepable_capture().kind, ErrorKind::ClipboardUnkeepable);
        assert_eq!(
            unkept_paste(Unkept::Unkeepable).kind,
            ErrorKind::ClipboardUnkeepable
        );
        assert_eq!(unkept_paste(Unkept::Busy).kind, ErrorKind::PasteBlocked);
        assert_eq!(unkept_paste(Unkept::Busy).reason, "clipboard busy");
        assert_eq!(
            validate_target(&target).unwrap_err().kind,
            ErrorKind::TargetChanged,
            "window 1 is never the foreground"
        );
        assert_eq!(
            {
                let _epoch = EPOCH_TESTS.lock().unwrap_or_else(|p| p.into_inner());
                paste(&target, "ok", false, Ticket::current())
                    .unwrap_err()
                    .kind
            },
            ErrorKind::TargetChanged,
            "refused before any key or clipboard"
        );
    }

    /// NATIVE-012 (Elio audit): a selection in several ranges (a simulated provider giving two)
    /// is refused, never cut down to its first range; at the revalidation it is a change. The
    /// real bench says the same (`selection-multiple-uia-simulee`).
    #[test]
    fn a_selection_in_several_ranges_is_refused() {
        assert_eq!(selected_range(vec!["bloc"]), Ok("bloc"));
        assert_eq!(
            selected_range(Vec::<&str>::new()),
            Err(NO_SELECTION.to_string())
        );
        assert_eq!(
            selected_range(vec!["premier bloc", "second bloc"]),
            Err(MULTIPLE_SELECTION.to_string()),
            "NATIVE-012: the first of two selected ranges was taken for the whole selection"
        );
        let target = TargetIdentity {
            runtime_id: Some(vec![1]),
            native_window: 1,
            control: 0,
            selected_text: "premier bloc".into(),
            anchor: None,
            selection_len: 12,
            editable: true,
            check: TargetCheck::Uia,
        };
        assert_eq!(
            selection_changed(&target, &Err(MULTIPLE_SELECTION.into())),
            Some("multiple"),
            "a second range added since the capture"
        );
        // Never proved for a copy either (the copy of Word gives every part).
        assert!(!proves_copy("", "premier bloc\nsecond bloc"));
    }

    #[test]
    fn a_copy_is_fresh_for_three_seconds_only() {
        assert!(fresh(Some(1_000), 3_500, 3_000));
        assert!(fresh(Some(1_000), 4_000, 3_000));
        assert!(!fresh(Some(1_000), 4_001, 3_000));
        assert!(!fresh(None, 4_000, 3_000));
        assert!(!fresh(Some(5_000), 4_000, 3_000));
    }
}
