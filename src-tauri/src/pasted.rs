//! The text a paste left in the source (« Îlot », lot 9 of docs/DA-PLAN.md): where it is, so
//! the pill rests under it and the changed words are marked on it, and how Undo gives the
//! original back. UI Automation only. Nothing here logs, stores or emits any text: the texts
//! stay in Rust's memory for the comparisons, the frontend only ever receives rectangles.
//!
//! After the paste the caret sits at the end of the pasted text (or the pasted text stays
//! selected, some editors do): the pasted text is the range that ends at the caret and spans
//! as many of the provider's characters as the result has. Providers count characters their
//! own way (UTF-16 units in RichEdit and Chromium for most text) and may turn a line feed into
//! a carriage return, or into both: a few candidate lengths are tried and the one whose text
//! reads back as the result (line endings and non-breaking spaces aside) is kept.
use crate::capture::{self, canonical};
use crate::error::{AppError, ErrorKind};
use crate::selection_lines;
use crate::types::{Rect, TargetCheck, TargetIdentity, UndoStrategy};
use std::time::{Duration, Instant};
use uiautomation::patterns::{UITextPattern, UITextRange};
use uiautomation::types::{TextPatternRangeEndpoint, TextUnit};
use uiautomation::UIElement;

/// How long the source gets to show the original again after Ctrl+Z (0.6: 800 ms was short
/// for a rich editor that rebuilds its content on undo).
const UNDO_CONFIRM: Duration = Duration::from_millis(1_600);
/// How long a selection made by UIA `Select` gets to show (Chromium applies it asynchronously).
const SELECT_SETTLE: Duration = Duration::from_millis(400);

/// The pasted text right before the caret: how many of the provider's characters it spans,
/// the provider's own text of it, its visible runs (physical) and its lines (grouped and
/// clipped like `Capture.selectionRects`).
#[derive(Clone, Debug, PartialEq)]
pub struct Located {
    pub units: i32,
    pub text: String,
    pub rects: Vec<Rect>,
    pub lines: Vec<Rect>,
}

/// The lengths to try, in the provider's characters, for a text of `value`: its UTF-16
/// units or its code points, each as is, with every lone line break written as CR LF, or
/// with every CR LF written as one character. Positive and distinct, most likely first.
pub fn candidate_units(value: &str) -> Vec<i32> {
    let units = value.encode_utf16().count() as i64;
    let points = value.chars().count() as i64;
    let crlf = value.matches("\r\n").count() as i64;
    let lone = value.matches(['\n', '\r']).count() as i64 - 2 * crlf;
    let mut out = Vec::new();
    for base in [units, points] {
        for count in [base, base + lone, base - crlf] {
            if count > 0 && count <= i32::MAX as i64 && !out.contains(&(count as i32)) {
                out.push(count as i32);
            }
        }
    }
    out
}

/// Where each UTF-16 offset of `value` (0 to its length) falls in `provider`, the same text
/// as the provider reads it back: equal units, a line break written another way (CR, LF,
/// CR LF), a non-breaking space for a space. None when the two are not the same text.
pub fn align(value: &str, provider: &str) -> Option<Vec<usize>> {
    let v: Vec<u16> = value.encode_utf16().collect();
    let p: Vec<u16> = provider.encode_utf16().collect();
    let (cr, lf, space, nbsp) = (13u16, 10u16, 32u16, 0xA0u16);
    let brk = |u: u16| u == cr || u == lf;
    let pair = |s: &[u16], i: usize| s.get(i) == Some(&cr) && s.get(i + 1) == Some(&lf);
    let mut map = vec![0usize; v.len() + 1];
    let (mut i, mut j) = (0usize, 0usize);
    while i < v.len() {
        let &p_at = p.get(j)?;
        map[i] = j;
        if brk(v[i]) && brk(p_at) {
            let (vi, pj) = (
                if pair(&v, i) { 2 } else { 1 },
                if pair(&p, j) { 2 } else { 1 },
            );
            if vi == 2 {
                map[i + 1] = j;
            }
            i += vi;
            j += pj;
        } else if v[i] == p_at || (v[i] == space && p_at == nbsp) || (v[i] == nbsp && p_at == space)
        {
            i += 1;
            j += 1;
        } else {
            return None;
        }
    }
    (j == p.len()).then(|| {
        map[v.len()] = j;
        map
    })
}

/// The provider's character index of each UTF-16 offset of its own text, when its count
/// of characters is `units`: UTF-16 units (RichEdit, Chromium on most text) or code points.
pub fn unit_index(provider: &str, units: i32) -> Option<Vec<i32>> {
    let length = provider.encode_utf16().count();
    if units as usize == length {
        return Some((0..=length as i32).collect());
    }
    if units as usize != provider.chars().count() {
        return None;
    }
    let mut index = Vec::with_capacity(length + 1);
    for (k, c) in provider.chars().enumerate() {
        for _ in 0..c.len_utf16() {
            index.push(k as i32);
        }
    }
    index.push(units);
    Some(index)
}

fn clone_range(range: &UITextRange) -> Option<UITextRange> {
    unsafe { range.as_ref().Clone() }
        .ok()
        .map(UITextRange::from)
}

/// The focused element and its text pattern.
fn focused_text() -> Option<(UIElement, UITextPattern)> {
    let element = capture::ui_automation().ok()?.get_focused_element().ok()?;
    let pattern = element.get_pattern::<UITextPattern>().ok()?;
    Some((element, pattern))
}

/// A degenerate range at the caret: the end of the first selection range.
fn caret(pattern: &UITextPattern) -> Option<UITextRange> {
    let selection = pattern.get_selection().ok()?.into_iter().next()?;
    let caret = clone_range(&selection)?;
    caret
        .move_endpoint_by_range(
            TextPatternRangeEndpoint::Start,
            &selection,
            TextPatternRangeEndpoint::End,
        )
        .ok()?;
    Some(caret)
}

/// The `units` characters that end at `caret` (None when the document starts before).
fn back_from(caret: &UITextRange, units: i32) -> Option<UITextRange> {
    let range = clone_range(caret)?;
    let moved = range
        .move_endpoint_by_unit(TextPatternRangeEndpoint::Start, TextUnit::Character, -units)
        .ok()?;
    (moved == -units).then_some(range)
}

fn read(range: &UITextRange, units: i32) -> Option<String> {
    range
        .get_text(units.saturating_mul(2).saturating_add(16))
        .ok()
}

/// Right after a paste of `value` into `window`: the pasted text, or None (no text pattern,
/// no caret, or nothing before the caret that reads back as `value`).
pub fn locate(value: &str, window: isize) -> Option<Located> {
    let (_, pattern) = focused_text()?;
    let caret = caret(&pattern)?;
    let wanted = canonical(value);
    let clip = crate::host::window_rect(window);
    candidate_units(value).into_iter().find_map(|units| {
        let range = back_from(&caret, units)?;
        let text = read(&range, units)?;
        (canonical(&text) == wanted).then(|| {
            let rects = capture::range_rects(&range);
            let lines = selection_lines::lines(&rects, clip);
            Located {
                units,
                text,
                rects,
                lines,
            }
        })
    })
}

/// The pasted text found again where it was left: the same span before the caret, the same
/// provider text exactly. None when the caret moved or the text changed.
fn relocate_range(located: &Located) -> Option<(UIElement, UITextRange)> {
    let (element, pattern) = focused_text()?;
    let range = back_from(&caret(&pattern)?, located.units)?;
    (read(&range, located.units)? == located.text).then_some((element, range))
}

/// Its visible runs now (the watcher compares them with the paste's: a scroll or a reflow
/// moves them), or None when it can no longer be found before the caret.
pub fn relocate(located: &Located) -> Option<Vec<Rect>> {
    relocate_range(located).map(|(_, range)| capture::range_rects(&range))
}

fn utf16_slice(value: &[u16], start: usize, end: usize) -> String {
    String::from_utf16_lossy(&value[start..end])
}

/// The lines of the changed words (lot 9): `ranges` are UTF-16 offsets of `value` (the
/// result as pasted), end excluded. Each becomes a sub-range of the pasted text, checked by
/// its text, then lines (runs of one range merge on a line; two ranges never do). A range
/// that cannot be resolved or read back is left out. At most 256 lines.
pub fn changed_lines(
    located: &Located,
    value: &str,
    ranges: &[(usize, usize)],
    window: isize,
) -> (usize, Vec<Rect>) {
    let Some((_, range)) = relocate_range(located) else {
        return (0, Vec::new());
    };
    let (Some(map), Some(units)) = (
        align(value, &located.text),
        unit_index(&located.text, located.units),
    ) else {
        return (0, Vec::new());
    };
    let v: Vec<u16> = value.encode_utf16().collect();
    let clip = crate::host::window_rect(window);
    let mut resolved = 0;
    let mut lines = Vec::new();
    for &(start, end) in ranges {
        if start >= end || end > v.len() {
            continue;
        }
        let (us, ue) = (units[map[start]], units[map[end]]);
        let Some(sub) = clone_range(&range) else {
            continue;
        };
        let collapsed = sub
            .move_endpoint_by_range(
                TextPatternRangeEndpoint::End,
                &range,
                TextPatternRangeEndpoint::Start,
            )
            .is_ok();
        let spans = collapsed
            && sub
                .move_endpoint_by_unit(TextPatternRangeEndpoint::End, TextUnit::Character, ue)
                .ok()
                == Some(ue)
            && sub
                .move_endpoint_by_unit(TextPatternRangeEndpoint::Start, TextUnit::Character, us)
                .ok()
                == Some(us);
        if !spans
            || read(&sub, ue - us).map(|text| canonical(&text))
                != Some(canonical(&utf16_slice(&v, start, end)))
        {
            continue;
        }
        resolved += 1;
        lines.extend(selection_lines::lines(&capture::range_rects(&sub), clip));
    }
    lines.truncate(256);
    (resolved, lines)
}

/// Where the paste went and what it replaced: the identity Undo checks again.
pub struct UndoTarget<'a> {
    pub window: isize,
    pub control: isize,
    pub runtime_id: Option<&'a [i32]>,
    pub located: &'a Located,
    pub original: &'a str,
    pub pasted: &'a str,
}

/// Nothing was touched (`Refused`), or the undo went out and the original did not come
/// back (`Failed`).
#[derive(Debug)]
pub enum UndoFailure {
    Refused(AppError),
    Failed(AppError),
}

fn changed() -> UndoFailure {
    UndoFailure::Refused(AppError::new(
        ErrorKind::TargetChanged,
        "Le texte a changé depuis le remplacement; annulation refusée.",
    ))
}

/// Rule 1 for Undo: the source in front, the same field, the same element, and the pasted
/// text still exactly where it was left.
fn check(target: &UndoTarget) -> Result<(UIElement, UITextRange), UndoFailure> {
    if crate::host::foreground() != target.window {
        return Err(changed());
    }
    if target.control != 0
        && crate::host::focused_control(target.window)
            .is_some_and(|(handle, _)| handle != target.control)
    {
        return Err(changed());
    }
    let (element, range) = relocate_range(target.located).ok_or_else(changed)?;
    if let Some(id) = target.runtime_id {
        if element.get_runtime_id().is_ok_and(|now| now != id) {
            return Err(changed());
        }
    }
    Ok((element, range))
}

/// Whether the original is back: selected (editors reselect what an undo restores) or right
/// before the caret. None when nothing can be read.
fn restored(original: &str) -> Option<bool> {
    let (_, pattern) = focused_text()?;
    let wanted = canonical(original);
    let selection = pattern.get_selection().ok()?.into_iter().next();
    if selection
        .and_then(|range| range.get_text(-1).ok())
        .is_some_and(|text| canonical(&text) == wanted)
    {
        return Some(true);
    }
    let caret = caret(&pattern)?;
    Some(candidate_units(original).into_iter().any(|units| {
        back_from(&caret, units)
            .and_then(|range| read(&range, units))
            .is_some_and(|text| canonical(&text) == wanted)
    }))
}

/// Whether `now` is `before` with one occurrence of `pasted` put back to `original` (line
/// endings and non-breaking spaces aside): the field reads again as it did before the paste,
/// wherever the editor left its caret. 0.6: RoosterJS (Outlook on the web) undoes the paste and
/// puts the caret elsewhere; the two checks of `restored` then saw nothing and the pill said
/// « Undo not confirmed » over a text that was back.
pub fn undone_in(before: &str, now: &str, pasted: &str, original: &str) -> bool {
    let (before, now, pasted, original) = (
        canonical(before),
        canonical(now),
        canonical(pasted),
        canonical(original),
    );
    if pasted.is_empty() || now.len() + pasted.len() != before.len() + original.len() {
        return false;
    }
    before.match_indices(&pasted).take(64).any(|(at, _)| {
        now.len() >= at
            && now.is_char_boundary(at)
            && now[..at] == before[..at]
            && now[at..]
                .strip_prefix(original.as_str())
                .is_some_and(|rest| rest == &before[at + pasted.len()..])
    })
}

/// Undoes the replacement (lot 9): brings the source back when one of our windows is in
/// front, checks the target after that, waits for the keys to be up, checks again, then
/// sends Ctrl+Z (`keystroke`) or selects the pasted text and pastes the original over it
/// (`repaste`, the clipboard kept as for any paste). Ok(true) when the original reads back.
pub fn undo(
    target: &UndoTarget,
    strategy: UndoStrategy,
    reactivate: bool,
) -> Result<bool, UndoFailure> {
    #[cfg(windows)]
    if reactivate && crate::host::foreground() != target.window {
        use windows::Win32::{Foundation::HWND, UI::WindowsAndMessaging::SetForegroundWindow};
        capture::released(crate::host::wait_modifiers_released(capture::CHORD_RELEASE))
            .map_err(UndoFailure::Refused)?;
        if !unsafe { SetForegroundWindow(HWND(target.window as *mut _)) }.as_bool() {
            return Err(UndoFailure::Refused(AppError::new(
                ErrorKind::PasteBlocked,
                "Impossible de réactiver la fenêtre source.",
            )));
        }
        std::thread::sleep(Duration::from_millis(60));
    }
    #[cfg(not(windows))]
    let _ = reactivate;
    check(target)?;
    capture::released(crate::host::wait_modifiers_released(capture::CHORD_RELEASE))
        .map_err(UndoFailure::Refused)?;
    let (element, range) = check(target)?;
    match strategy {
        UndoStrategy::Keystroke => {
            // The whole field as it reads with the pasted text: the proof of last resort.
            let before = capture::field_text(target.window);
            crate::host::send_undo_chord().map_err(|sent| {
                let error = AppError::new(
                    ErrorKind::PasteBlocked,
                    "L’annulation a été bloquée par Windows ou par l’application.",
                );
                if sent == 0 {
                    UndoFailure::Refused(error)
                } else {
                    UndoFailure::Failed(error)
                }
            })?;
            let started = Instant::now();
            loop {
                let near_caret = restored(target.original);
                if near_caret == Some(true) {
                    return Ok(true);
                }
                let whole = before.as_deref().and_then(|before| {
                    capture::field_text(target.window)
                        .map(|now| undone_in(before, &now, &target.located.text, target.original))
                });
                if whole == Some(true) {
                    return Ok(true);
                }
                // Nothing can read the field: the chord went out, the undo is assumed.
                if near_caret.is_none()
                    && whole.is_none()
                    && started.elapsed() >= Duration::from_millis(300)
                {
                    return Ok(false);
                }
                if started.elapsed() >= UNDO_CONFIRM {
                    return Err(UndoFailure::Failed(
                        AppError::new(
                            ErrorKind::PasteBlocked,
                            "L’application n’a pas rendu le texte d’origine.",
                        )
                        .because("original not read back"),
                    ));
                }
                std::thread::sleep(Duration::from_millis(40));
            }
        }
        UndoStrategy::Repaste => {
            range.select().map_err(|_| changed())?;
            // Chromium applies a UIA selection a moment later: read it until it is the pasted text.
            let wanted = canonical(target.pasted);
            let started = Instant::now();
            let (text, rects, selection_len, _) = loop {
                match capture::selection(&element) {
                    Ok(found) if canonical(&found.0) == wanted => break found,
                    _ if started.elapsed() >= SELECT_SETTLE => return Err(changed()),
                    _ => std::thread::sleep(Duration::from_millis(30)),
                }
            };
            let identity = TargetIdentity {
                runtime_id: target.runtime_id.map(<[i32]>::to_vec),
                native_window: target.window,
                control: target.control,
                selected_text: text,
                anchor: capture::anchor_of(&rects),
                selection_len,
                editable: true,
                check: TargetCheck::Uia,
            };
            // Every refusal of the paste comes before its chord: nothing was written.
            let delivery =
                capture::paste(&identity, target.original, false).map_err(UndoFailure::Refused)?;
            Ok(delivery.confirmed)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_candidate_lengths_cover_the_ways_a_provider_counts_and_writes_line_breaks() {
        assert_eq!(candidate_units("Bonjour"), vec![7]);
        // « a\nb »: 3 units, 4 when the provider writes CR LF.
        assert_eq!(candidate_units("a\nb"), vec![3, 4]);
        // « a\r\nb »: 4 units, 3 when the provider keeps one character per break.
        assert_eq!(candidate_units("a\r\nb"), vec![4, 3]);
        // An emoji is two UTF-16 units, one code point.
        assert_eq!(candidate_units("ok 👍"), vec![5, 4]);
        assert!(candidate_units("").is_empty());
    }

    #[test]
    fn the_result_aligns_with_the_providers_text_whatever_its_line_breaks_and_spaces() {
        assert_eq!(align("ab", "ab"), Some(vec![0, 1, 2]));
        // RichEdit gives CR for a line feed: same length.
        assert_eq!(align("a\nb", "a\rb"), Some(vec![0, 1, 2, 3]));
        // A provider that writes CR LF: the offsets after the break shift by one.
        assert_eq!(align("a\nbc", "a\r\nbc"), Some(vec![0, 1, 3, 4, 5]));
        // A result with CR LF read back with one character.
        assert_eq!(align("a\r\nb", "a\nb"), Some(vec![0, 1, 1, 2, 3]));
        // Chromium's non-breaking space at a boundary.
        assert_eq!(align("a b", "a\u{a0}b"), Some(vec![0, 1, 2, 3]));
        assert_eq!(align("ab", "abc"), None);
        assert_eq!(align("abc", "ab"), None);
        assert_eq!(align("ab", "ax"), None);
    }

    #[test]
    fn provider_characters_are_utf16_units_or_code_points() {
        assert_eq!(unit_index("abc", 3), Some(vec![0, 1, 2, 3]));
        // « é👍 » is three UTF-16 units, two code points.
        assert_eq!(unit_index("é👍", 3), Some(vec![0, 1, 2, 3]));
        assert_eq!(unit_index("é👍", 2), Some(vec![0, 1, 1, 2]));
        assert_eq!(unit_index("abc", 5), None);
    }

    #[test]
    fn an_undo_is_confirmed_by_the_whole_field_wherever_the_caret_went() {
        let before = "Bonjour,\nPourriez-vous envoyer la proposition ?\nMerci.";
        let now = "Bonjour,\nje voudrai la proposition\nMerci.";
        assert!(undone_in(
            before,
            now,
            "Pourriez-vous envoyer la proposition ?",
            "je voudrai la proposition"
        ));
        // Line endings and Chromium's non-breaking spaces do not matter.
        assert!(undone_in(
            "a\r\nNOUVEAU\u{a0}b",
            "a\nancien b",
            "NOUVEAU",
            "ancien"
        ));
        // The pasted text twice in the field: either occurrence may be the one undone.
        assert!(undone_in("x NEW y NEW z", "x NEW y old z", "NEW", "old"));
        assert!(undone_in("x NEW y NEW z", "x old y NEW z", "NEW", "old"));
        // Still the pasted text, something else changed, or more than the paste was undone.
        assert!(!undone_in(
            before,
            before,
            "Pourriez-vous envoyer la proposition ?",
            "je voudrai la proposition"
        ));
        assert!(!undone_in("x NEW y", "x old y!", "NEW", "old"));
        assert!(!undone_in("x NEW y", "x  y", "NEW", "old"));
        assert!(!undone_in("x NEW y", "old", "NEW", "old"));
        assert!(
            !undone_in("x y", "x y", "", "old"),
            "nothing pasted, nothing to prove"
        );
        // Accents and emoji: byte offsets stay on character boundaries.
        assert!(undone_in("é👍 NEW fin", "é👍 été fin", "NEW", "été"));
        assert!(!undone_in("é👍 NEW fin", "👍é été fin", "NEW", "été"));
    }

    #[test]
    fn undo_is_refused_when_the_source_is_not_in_front() {
        let located = Located {
            units: 5,
            text: "Salut".into(),
            rects: Vec::new(),
            lines: Vec::new(),
        };
        let target = UndoTarget {
            window: 1,
            control: 0,
            runtime_id: None,
            located: &located,
            original: "Bonjour",
            pasted: "Salut",
        };
        for strategy in [UndoStrategy::Keystroke, UndoStrategy::Repaste] {
            match undo(&target, strategy, false) {
                Err(UndoFailure::Refused(error)) => {
                    assert_eq!(error.kind, ErrorKind::TargetChanged)
                }
                other => panic!("refused before any key: {other:?}"),
            }
        }
    }
}
