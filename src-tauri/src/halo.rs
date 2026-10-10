//! The `halo` window (« Îlot », lot 6; « mise en valeur », Lucas 25/09): the selection shown
//! at three levels while the menu waits (text box, whole lines, exact text), the reflection
//! passing over the letters and the aurora around the text box while an action works, then
//! the wave over the new text and the iridescent marks on the changed words. Transparent,
//! never hit (`WS_EX_TRANSPARENT | WS_EX_LAYERED` set once, outside the 8 ms hit tester),
//! never activated, above the source and right under the overlay. Rust places it on the
//! rectangles of the capture (`selection_lines`) and hands the page their logical
//! rectangles; the page only draws. Every window call runs on the main thread, in order, and
//! a generation drops the calls a newer one overtook.
//!
//! The marks live on their own (Lucas, 25/09): until the user's next action in the text (a
//! key, a click, the wheel: `host`'s marks watch; the window moved, left or scrolled: the
//! context watcher), `seconds` at most, whatever Undo or the overlay do.
use crate::ground;
use crate::host;
use crate::selection_lines::{bounds, halo_frame, HALO_MARGIN};
use crate::types::Rect;
use serde::Serialize;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

static GENERATION: AtomicU64 = AtomicU64::new(0);
static VISIBLE: AtomicBool = AtomicBool::new(false);
/// What the window shows: the marks (true) or the selection (menu, work).
static MARKS: AtomicBool = AtomicBool::new(false);
/// A `leave` is under way for the current generation: a second one sends nothing.
static LEAVING: AtomicBool = AtomicBool::new(false);
/// The generation whose fade `leave` started (0: none yet): its window hides by itself once the
/// fade is over, unless a newer generation overtook it.
static FADING: AtomicU64 = AtomicU64::new(0);
/// The selection fades out in 150 ms, the marks in 900 ms; the window hides once that is over.
const LEAVE: Duration = Duration::from_millis(200);
const LEAVE_MARKS: Duration = Duration::from_millis(950);
/// Room around the text box for the aurora's glow, and around the marks for theirs, in
/// logical pixels (the lines alone keep `HALO_MARGIN`).
const BOX_MARGIN: f64 = 24.;
const MARKS_MARGIN: f64 = 16.;

#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum HaloPhase {
    /// The menu waits for a choice: the selection at three levels, still.
    Menu,
    /// The work started: the reflection and the aurora (after 250 ms when no menu came first).
    Work,
    /// The result was pasted: the wave over the new text, then the marks, held until `leave`.
    Marks,
    /// The response arrived, or the marks' time is over: fade out.
    Leave,
    /// Hidden: draw nothing.
    Clear,
}

/// Light or dark drawing, from the ground under the text.
#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Tone {
    Light,
    Dark,
}

/// What the halo draws, physical screen pixels. `lines`: the exact text (menu, work) or the
/// changed words (marks); `full` and `text_box`: the other two levels (menu, work); `whole`:
/// the whole new text (marks, the wave); `ground`: the colour under the text.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Scene {
    pub lines: Vec<Rect>,
    pub full: Vec<Rect>,
    pub text_box: Option<Rect>,
    pub whole: Vec<Rect>,
    pub ground: Option<[u8; 3]>,
}

/// What the page draws: logical pixels relative to the window, which is `width` × `height`.
/// `tone` and `ground` are absent when the ground could not be read: the page then follows the
/// app's theme and its own veil.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HaloEvent {
    pub generation: u64,
    pub phase: HaloPhase,
    pub lines: Vec<Rect>,
    pub full: Vec<Rect>,
    pub text_box: Option<Rect>,
    pub whole: Vec<Rect>,
    pub tone: Option<Tone>,
    pub ground: Option<[u8; 3]>,
    pub width: f64,
    pub height: f64,
}

impl HaloEvent {
    fn empty(generation: u64, phase: HaloPhase) -> Self {
        Self {
            generation,
            phase,
            lines: Vec::new(),
            full: Vec::new(),
            text_box: None,
            whole: Vec::new(),
            tone: None,
            ground: None,
            width: 0.,
            height: 0.,
        }
    }
}

/// Shown, or about to be: the context watcher checks the selection faster meanwhile.
pub fn visible() -> bool {
    VISIBLE.load(Ordering::Acquire)
}

/// The menu waits for a choice over a UI Automation selection: its three levels, still.
pub fn menu(app: &AppHandle, scene: Scene) {
    show(app, scene, HaloPhase::Menu);
}

/// The work starts: the reflection over the exact text, the aurora around the text box.
pub fn work(app: &AppHandle, scene: Scene) {
    show(app, scene, HaloPhase::Work);
}

/// The result was pasted: the changed words (`scene.lines`) marked after a wave over the new
/// text (`scene.whole`), until the user's next action or `seconds`. Answers their generation.
pub fn marks(app: &AppHandle, scene: Scene, seconds: u32) -> Option<u64> {
    let generation = show(app, scene, HaloPhase::Marks)?;
    let handle = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(u64::from(seconds)));
        if GENERATION.load(Ordering::Acquire) == generation && marking() {
            leave(&handle);
        }
    });
    Some(generation)
}

/// Whether the halo of `generation` is over: a newer one overtook it, or it fades out.
pub fn ended(generation: u64) -> bool {
    GENERATION.load(Ordering::Acquire) != generation || FADING.load(Ordering::Acquire) == generation
}

/// The room around what is drawn: the aurora's glow needs more than the lines.
fn margin(phase: HaloPhase, scene: &Scene) -> f64 {
    match phase {
        HaloPhase::Marks => MARKS_MARGIN,
        _ if scene.text_box.is_some() => BOX_MARGIN,
        _ => HALO_MARGIN,
    }
}

/// Physical rectangles as the page draws them: logical, relative to `window` at `scale`.
fn local(rects: &[Rect], window: &Rect, scale: f64) -> Vec<Rect> {
    rects
        .iter()
        .map(|r| Rect {
            x: (r.x - window.x) / scale,
            y: (r.y - window.y) / scale,
            width: r.width / scale,
            height: r.height / scale,
        })
        .collect()
}

/// The event of `scene` for a window drawn at `scale`, and where that window goes.
fn event(
    generation: u64,
    phase: HaloPhase,
    scene: &Scene,
    scale: f64,
) -> Option<(Rect, HaloEvent)> {
    let all: Vec<Rect> = scene
        .lines
        .iter()
        .chain(&scene.full)
        .chain(&scene.whole)
        .chain(scene.text_box.iter())
        .copied()
        .collect();
    let frame = halo_frame(&all, scale, margin(phase, scene))?;
    let tone = scene.ground.map(|color| {
        if ground::dark(color) {
            Tone::Dark
        } else {
            Tone::Light
        }
    });
    let event = HaloEvent {
        generation,
        phase,
        lines: local(&scene.lines, &frame.window, scale),
        full: local(&scene.full, &frame.window, scale),
        text_box: scene.text_box.map(|b| local(&[b], &frame.window, scale)[0]),
        whole: local(&scene.whole, &frame.window, scale),
        tone,
        ground: scene.ground,
        width: frame.width,
        height: frame.height,
    };
    Some((frame.window, event))
}

/// Places the window at the DPI of the screen under what it draws; when Windows gives it
/// another one (across two screens), placed again at its own. Answers the generation.
fn show(app: &AppHandle, scene: Scene, phase: HaloPhase) -> Option<u64> {
    let generation = GENERATION.fetch_add(1, Ordering::AcqRel) + 1;
    let all: Vec<Rect> = scene
        .lines
        .iter()
        .chain(&scene.full)
        .chain(&scene.whole)
        .chain(scene.text_box.iter())
        .copied()
        .collect();
    let Some(union) = bounds(&all) else {
        hide(app);
        return None;
    };
    let (_, scale, _) = host::monitor_at(Some(union));
    let Some((window, first)) = event(generation, phase, &scene, scale) else {
        hide(app);
        return None;
    };
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        if GENERATION.load(Ordering::Acquire) != generation {
            return;
        }
        let Some(halo) = handle.get_webview_window("halo") else {
            return;
        };
        let overlay = handle
            .get_webview_window("overlay")
            .map(|window| host::handle(&window))
            .unwrap_or(0);
        let mut sent = first;
        if host::place_below(&halo, window, overlay).is_err() {
            return;
        }
        if let Some((again, redrawn)) = halo
            .scale_factor()
            .ok()
            .filter(|actual| (actual - scale).abs() > 1e-3)
            .and_then(|actual| event(generation, phase, &scene, actual))
        {
            sent = redrawn;
            if host::place_below(&halo, again, overlay).is_err() {
                return;
            }
        }
        VISIBLE.store(true, Ordering::Release);
        LEAVING.store(false, Ordering::Release);
        let marked = phase == HaloPhase::Marks;
        MARKS.store(marked, Ordering::Release);
        if marked {
            host::arm_marks_watch(overlay);
        } else {
            host::disarm_marks_watch();
        }
        let _ = handle.emit_to("halo", "halo", sent);
    });
    Some(generation)
}

/// The response arrived (a result or an error), or the marks' time is over, or the user's next
/// action came: the page fades, then the window hides.
pub fn leave(app: &AppHandle) {
    if !visible() || LEAVING.swap(true, Ordering::AcqRel) {
        return;
    }
    host::disarm_marks_watch();
    let generation = GENERATION.load(Ordering::Acquire);
    FADING.store(generation, Ordering::Release);
    let delay = if MARKS.load(Ordering::Acquire) {
        LEAVE_MARKS
    } else {
        LEAVE
    };
    let _ = app.emit_to(
        "halo",
        "halo",
        HaloEvent::empty(generation, HaloPhase::Leave),
    );
    let handle = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(delay);
        hide_window(&handle, generation);
    });
}

/// The marks are shown (not fading, not hidden).
pub fn marking() -> bool {
    visible() && MARKS.load(Ordering::Acquire) && !LEAVING.load(Ordering::Acquire)
}

/// The overlay is dismissed: the menu's or the work's halo hides at once. The marks outlive
/// the overlay (their own end takes them), and a fade already under way ends as promised,
/// then its window hides by itself (review of lot 9, finding 4).
pub fn dismiss(app: &AppHandle) {
    if !survives_dismissal(marking(), fading(&GENERATION, &FADING)) {
        hide(app);
    }
}

fn survives_dismissal(marking: bool, fading: bool) -> bool {
    marking || fading
}

/// Whether the current generation is fading out: `leave` started it and nothing overtook it.
fn fading(generation: &AtomicU64, faded: &AtomicU64) -> bool {
    let current = generation.load(Ordering::Acquire);
    current != 0 && faded.load(Ordering::Acquire) == current
}

/// Hides at once: a new capture, a cancelled request, a selection that moved, scrolled or
/// changed, an Undo, marks whose text moved. Never waits for the page.
pub fn hide(app: &AppHandle) {
    let generation = GENERATION.fetch_add(1, Ordering::AcqRel) + 1;
    host::disarm_marks_watch();
    hide_window(app, generation);
}

fn hide_window(app: &AppHandle, generation: u64) {
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        if GENERATION.load(Ordering::Acquire) != generation {
            return;
        }
        if let Some(halo) = handle.get_webview_window("halo") {
            let _ = host::hide(&halo);
        }
        if VISIBLE.swap(false, Ordering::AcqRel) {
            let _ = handle.emit_to(
                "halo",
                "halo",
                HaloEvent::empty(generation, HaloPhase::Clear),
            );
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn r(x: f64, y: f64, width: f64, height: f64) -> Rect {
        Rect {
            x,
            y,
            width,
            height,
        }
    }

    #[test]
    fn a_dismissal_lets_a_halo_that_already_fades_out_end_its_fade() {
        let (generation, faded) = (AtomicU64::new(0), AtomicU64::new(0));
        assert!(
            !fading(&generation, &faded),
            "nothing shown yet: a dismissal hides"
        );
        // The marks of a paste are shown (generation 3).
        generation.store(3, Ordering::Release);
        assert!(!fading(&generation, &faded));
        // Their time ended: `leave` fades them out (900 ms), then hides the window. A
        // dismissal that follows leaves that fade alone.
        faded.store(3, Ordering::Release);
        assert!(fading(&generation, &faded));
        // A newer generation (the next capture's menu, a hide) is not fading: hidden at once.
        generation.store(4, Ordering::Release);
        assert!(!fading(&generation, &faded));
    }

    #[test]
    fn the_marks_outlive_the_overlay_the_selection_does_not() {
        assert!(
            survives_dismissal(true, false),
            "the pill left: the marks stay until the next action"
        );
        assert!(
            survives_dismissal(false, true),
            "a fade under way ends as promised"
        );
        assert!(
            !survives_dismissal(false, false),
            "the menu's or the work's halo hides with the overlay"
        );
    }

    #[test]
    fn the_window_holds_the_text_box_and_its_glow_and_every_level_is_relative_to_it() {
        let scene = Scene {
            lines: vec![r(200., 100., 300., 20.), r(120., 120., 150., 20.)],
            full: vec![r(120., 100., 380., 20.), r(120., 120., 360., 20.)],
            text_box: Some(r(100., 80., 600., 200.)),
            whole: Vec::new(),
            ground: Some([255, 255, 255]),
        };
        // 150 %: the box grown by 24 logical px (36 physical) on each side.
        let (window, drawn) = event(7, HaloPhase::Menu, &scene, 1.5).expect("a frame");
        assert_eq!(window, r(64., 44., 672., 272.));
        assert_eq!((drawn.width, drawn.height), (448., 181.33333333333334));
        assert_eq!(drawn.text_box, Some(r(24., 24., 400., 133.33333333333334)));
        assert_eq!(
            drawn.lines[0],
            r(
                90.66666666666667,
                37.333333333333336,
                200.,
                13.333333333333334
            )
        );
        assert_eq!(
            drawn.full[1],
            r(
                37.333333333333336,
                50.666666666666664,
                240.,
                13.333333333333334
            )
        );
        assert_eq!(
            (drawn.tone, drawn.ground),
            (Some(Tone::Light), Some([255, 255, 255]))
        );
        // The marks keep 16 px around the words and the new text; a dark ground, a dark tone.
        let marks = Scene {
            lines: vec![r(10., 10., 40., 20.)],
            whole: vec![r(10., 10., 200., 20.)],
            ground: Some([30, 31, 34]),
            ..Scene::default()
        };
        let (window, drawn) = event(8, HaloPhase::Marks, &marks, 1.).expect("a frame");
        assert_eq!(window, r(-6., -6., 232., 52.));
        assert_eq!(drawn.tone, Some(Tone::Dark));
        // No ground read: no tone, the page follows the app's theme.
        let unknown = Scene {
            lines: vec![r(10., 10., 40., 20.)],
            ..Scene::default()
        };
        assert_eq!(event_tone(&unknown), None);
        assert!(
            event(9, HaloPhase::Work, &Scene::default(), 1.).is_none(),
            "nothing to draw, no frame"
        );
    }

    fn event_tone(scene: &Scene) -> Option<Tone> {
        event(1, HaloPhase::Work, scene, 1.).and_then(|(_, drawn)| drawn.tone)
    }
}
