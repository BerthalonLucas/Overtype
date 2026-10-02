//! The real glass of 0.6 (docs/VERRE-0.6.md): what floats (the Îlot, the pills, the bubble, the
//! setup window) really blurs what lies behind it. The WebView cannot blur what is behind its
//! window, so Windows' compositor does it: each window that carries glass gets a visual tree of
//! `Windows.UI.Composition` on its own HWND, *under* the transparent WebView. One visual per
//! surface: Windows' host backdrop brush (what is behind the window, already blurred by the
//! shell; no pixel ever reaches this process), clipped by a rounded rectangle whose place, size
//! and radius are free, so the corners are the page's own (a pill stays a pill).
//!
//! The page is the only source of the shapes: its tracker (src/glassBackdrop.ts) measures every
//! glass surface on each frame it changes and sends the list (`glass_frame`); this module mirrors
//! it. Nothing here animates by itself and no second window exists: the glass belongs to the
//! window it backs, moves and hides with it, and cannot outlive it. Tint, grain, rim and shadow
//! stay the page's (src/theme.css, `data-backdrop="glass"`).
//!
//! Where Windows cannot draw it (`fallback`), with `glassMaterial: painted`, or after any native
//! error, the answer to `glass_frame` is `false`: the page keeps its painted glass, which is the
//! CSS default, so a silent Rust side never leaves a hole.
use crate::types::GlassMaterial;
use serde::Deserialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::AppHandle;

/// The first build with `DWMWA_USE_HOSTBACKDROPBRUSH` (Windows 11 21H2).
pub const FIRST_BUILD: u32 = 22000;
/// Test injection for the real window (docs/BRIDGE.md): forces one fallback condition.
pub const FORCE_FALLBACK: &str = "FLOWTRANSLATE_ACRYLIC_FALLBACK";
/// A page never has more glass surfaces than this at once (the Îlot, a pill, a menu, a notice).
pub const MAX_SHAPES: usize = 8;
/// How long what Windows said stays good: the conditions are read again at most this often
/// while a surface shows, so turning transparency off switches to the painted glass at once.
const CONDITIONS_TTL: Duration = Duration::from_millis(500);

/// Why Windows would not draw the material as meant: the painted glass stays.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Fallback {
    /// Windows 10, or Windows 11 before build 22000: no host backdrop for a Win32 window.
    OldWindows,
    /// Remote desktop: the material is drawn flat, and costs bandwidth.
    RemoteDesktop,
    /// High contrast: no transparency at all.
    HighContrast,
    /// « Effets de transparence » off: Windows draws a flat colour instead.
    Transparency,
    /// Energy saver (battery saver): Windows turns transparency off.
    EnergySaver,
}

/// What Windows says right now.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Conditions {
    pub build: u32,
    pub transparency: bool,
    pub energy_saver: bool,
    pub high_contrast: bool,
    pub remote: bool,
}

pub fn fallback(c: Conditions) -> Option<Fallback> {
    if c.build < FIRST_BUILD { return Some(Fallback::OldWindows); }
    if c.remote { return Some(Fallback::RemoteDesktop); }
    if c.high_contrast { return Some(Fallback::HighContrast); }
    if !c.transparency { return Some(Fallback::Transparency); }
    if c.energy_saver { return Some(Fallback::EnergySaver); }
    None
}

/// Why a window keeps the painted glass.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Painted {
    /// `glassMaterial` is `painted`.
    Setting,
    Fallback(Fallback),
    /// The compositor refused something once: painted until the app starts again.
    Native,
}

/// Whether the real glass shows. Windows is only read with the setting on and no native failure.
pub fn material(setting: GlassMaterial, failed: bool, conditions: impl FnOnce() -> Conditions) -> Result<(), Painted> {
    if setting != GlassMaterial::Glass { return Err(Painted::Setting); }
    if failed { return Err(Painted::Native); }
    match fallback(conditions()) {
        Some(reason) => Err(Painted::Fallback(reason)),
        None => Ok(()),
    }
}

/// `FLOWTRANSLATE_ACRYLIC_FALLBACK`: `windows10`, `remote`, `contrast`, `transparency` or
/// `energy` forces that condition over what Windows says; anything else changes nothing.
pub fn forced(injection: Option<&str>, mut c: Conditions) -> Conditions {
    match injection {
        Some("windows10") => c.build = 19045,
        Some("remote") => c.remote = true,
        Some("contrast") => c.high_contrast = true,
        Some("transparency") => c.transparency = false,
        Some("energy") => c.energy_saver = true,
        _ => {}
    }
    c
}

/// What Windows says, read at most every `CONDITIONS_TTL`.
pub fn conditions() -> Conditions {
    static LAST: Mutex<Option<(Instant, Conditions)>> = Mutex::new(None);
    let now = Instant::now();
    let mut last = LAST.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    if let Some((at, conditions)) = *last {
        if now.duration_since(at) < CONDITIONS_TTL { return conditions; }
    }
    let conditions = forced(std::env::var(FORCE_FALLBACK).ok().as_deref(), imp::read());
    *last = Some((now, conditions));
    conditions
}

/// One glass surface as the page measured it: CSS pixels in the window's client area, the
/// radius of its corners, and the opacity it shows with (its own and its ancestors').
#[derive(Clone, Copy, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Shape {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub radius: f64,
    pub opacity: f64,
}

/// A surface for the compositor: physical pixels, every value finite and within reason.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Pane {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
    pub radius: f32,
    pub opacity: f32,
}

/// The page's shapes made safe for the compositor. Whatever a page sends, nothing here can
/// draw outside reason: a value that is not a number drops its shape, a shape without area or
/// fully transparent is not drawn, a radius never exceeds half the smaller side (a « 999 px »
/// pill), coordinates stay within ±32 000 px and no more than `MAX_SHAPES` are kept.
pub fn panes(shapes: &[Shape], scale: f64) -> Vec<Pane> {
    let scale = if scale.is_finite() { scale.clamp(0.5, 8.) } else { 1. };
    shapes
        .iter()
        .filter(|s| [s.x, s.y, s.width, s.height, s.radius, s.opacity].iter().all(|v| v.is_finite()))
        .filter(|s| s.width >= 1. && s.height >= 1. && s.opacity > 0.004)
        .take(MAX_SHAPES)
        .map(|s| {
            let width = (s.width * scale).min(32000.);
            let height = (s.height * scale).min(32000.);
            Pane {
                x: (s.x * scale).clamp(-32000., 32000.) as f32,
                y: (s.y * scale).clamp(-32000., 32000.) as f32,
                width: width as f32,
                height: height as f32,
                radius: (s.radius * scale).clamp(0., width.min(height) / 2.) as f32,
                opacity: blur_opacity(s.opacity) as f32,
            }
        })
        .collect()
}

/// How much of the blur shows under a surface of this opacity. A surface fades in and out by
/// its opacity; a blur faded the same way lets the sharp text behind it show through for most
/// of the fade (seen frame by frame in the real window). So the blur comes faster than the
/// tint and leaves later: 75 % at half opacity, the same at both ends.
pub fn blur_opacity(surface: f64) -> f64 {
    let o = surface.clamp(0., 1.);
    1. - (1. - o) * (1. - o)
}

/// Set once the compositor refused something: painted glass everywhere until the next start.
static FAILED: AtomicBool = AtomicBool::new(false);

/// One frame of a page's glass (`glass_frame`), on the main thread: `label` names the window,
/// `hwnd` is its handle, `seq` orders the messages of that page (an older one is dropped).
/// Returns whether the real glass shows, so the page knows which material to paint; the
/// second value is the cause of a native failure, the one time it happens (for the journal:
/// an error code of Windows, never anything of the user's).
pub fn frame(label: &str, hwnd: isize, seq: u64, shapes: &[Shape], scale: f64, setting: GlassMaterial) -> (bool, Option<String>) {
    let real = material(setting, FAILED.load(Ordering::Acquire), conditions).is_ok();
    if !real {
        imp::clear(label);
        return (false, None);
    }
    match imp::apply(label, hwnd, seq, &panes(shapes, scale)) {
        Ok(()) => (true, None),
        Err(cause) => {
            let first = !FAILED.swap(true, Ordering::AcqRel);
            imp::clear(label);
            (false, first.then_some(cause))
        }
    }
}

/// The window hides: its glass is emptied, so nothing of the last surface can show for an
/// instant the next time the window does (the page sends its shapes again as soon as it
/// paints). Any thread.
pub fn hide(app: &AppHandle, label: &'static str) {
    let _ = app.run_on_main_thread(move || imp::clear(label));
}

/// The window is destroyed (the setup closes): its visual tree goes with it. Any thread.
pub fn forget(app: &AppHandle, label: &'static str) {
    let _ = app.run_on_main_thread(move || imp::forget(label));
}

#[cfg(windows)]
mod imp {
    use super::{Conditions, Pane};
    use std::cell::RefCell;
    use std::collections::HashMap;
    use windows::core::{s, w, Interface, PCWSTR};
    use windows::Win32::Foundation::HWND;
    use windows::Win32::Graphics::Dwm::{DwmSetWindowAttribute, DWMWA_TRANSITIONS_FORCEDISABLED, DWMWA_USE_HOSTBACKDROPBRUSH};
    use windows::Win32::System::LibraryLoader::{GetModuleHandleW, GetProcAddress};
    use windows::Win32::System::Registry::{RegGetValueW, HKEY, HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, RRF_RT_REG_DWORD, RRF_RT_REG_SZ};
    use windows::Win32::System::WinRT::Composition::ICompositorDesktopInterop;
    use windows::Win32::System::WinRT::{CreateDispatcherQueueController, DispatcherQueueOptions, DQTAT_COM_NONE, DQTYPE_THREAD_CURRENT};
    use windows::Win32::UI::Accessibility::{HCF_HIGHCONTRASTON, HIGHCONTRASTW};
    use windows::Win32::UI::WindowsAndMessaging::{GetSystemMetrics, IsWindow, SystemParametersInfoW, SM_REMOTESESSION, SPI_GETHIGHCONTRAST, SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS};
    use windows::System::{DispatcherQueue, DispatcherQueueController};
    use windows::UI::Composition::Desktop::DesktopWindowTarget;
    use windows::UI::Composition::{CompositionBrush, CompositionRoundedRectangleGeometry, Compositor, ContainerVisual};
    use windows_numerics::Vector2;

    fn v2(x: f32, y: f32) -> Vector2 { Vector2 { X: x, Y: y } }

    /// One surface: a container the size of the window, clipped to the rounded rectangle, with
    /// the host backdrop inside. Kept and reused from one frame to the next.
    struct Slot {
        visual: ContainerVisual,
        geometry: CompositionRoundedRectangleGeometry,
        shown: Option<Pane>,
    }

    /// The glass of one window.
    struct Surface {
        hwnd: isize,
        seq: u64,
        target: DesktopWindowTarget,
        root: ContainerVisual,
        slots: Vec<Slot>,
    }

    #[derive(Default)]
    struct Glass {
        // The compositor needs a dispatcher queue on its thread; ours when the thread had none.
        queue: Option<DispatcherQueueController>,
        compositor: Option<Compositor>,
        brush: Option<CompositionBrush>,
        surfaces: HashMap<String, Surface>,
    }

    // Everything of the compositor lives on the main thread, where the windows are.
    thread_local! { static GLASS: RefCell<Glass> = RefCell::new(Glass::default()); }

    fn text(error: windows::core::Error) -> String { format!("0x{:08X}", error.code().0) }

    impl Glass {
        fn compositor(&mut self) -> windows::core::Result<(Compositor, CompositionBrush)> {
            if let (Some(compositor), Some(brush)) = (&self.compositor, &self.brush) { return Ok((compositor.clone(), brush.clone())); }
            if DispatcherQueue::GetForCurrentThread().is_err() {
                let options = DispatcherQueueOptions { dwSize: std::mem::size_of::<DispatcherQueueOptions>() as u32, threadType: DQTYPE_THREAD_CURRENT, apartmentType: DQTAT_COM_NONE };
                self.queue = Some(unsafe { CreateDispatcherQueueController(options) }?);
            }
            let compositor = Compositor::new()?;
            let brush: CompositionBrush = compositor.CreateHostBackdropBrush()?.cast()?;
            self.compositor = Some(compositor.clone());
            self.brush = Some(brush.clone());
            Ok((compositor, brush))
        }

        fn surface(&mut self, label: &str, hwnd: isize) -> windows::core::Result<&mut Surface> {
            // A window created again under the same label (the setup, reopened) starts afresh.
            if self.surfaces.get(label).is_some_and(|surface| surface.hwnd != hwnd) { self.drop_surface(label); }
            if !self.surfaces.contains_key(label) {
                let (compositor, _) = self.compositor()?;
                let window = HWND(hwnd as *mut _);
                unsafe {
                    // Without it the host backdrop of a Win32 window is black.
                    let on = 1i32;
                    DwmSetWindowAttribute(window, DWMWA_USE_HOSTBACKDROPBRUSH, &on as *const i32 as *const _, std::mem::size_of::<i32>() as u32)?;
                    let _ = DwmSetWindowAttribute(window, DWMWA_TRANSITIONS_FORCEDISABLED, &on as *const i32 as *const _, std::mem::size_of::<i32>() as u32);
                }
                let interop: ICompositorDesktopInterop = compositor.cast()?;
                // Not topmost: under the window's children, so under the transparent WebView.
                let target = unsafe { interop.CreateDesktopWindowTarget(window, false) }?;
                let root = compositor.CreateContainerVisual()?;
                root.SetRelativeSizeAdjustment(v2(1., 1.))?;
                target.SetRoot(&root)?;
                self.surfaces.insert(label.to_string(), Surface { hwnd, seq: 0, target, root, slots: Vec::new() });
            }
            Ok(self.surfaces.get_mut(label).expect("just inserted"))
        }

        fn drop_surface(&mut self, label: &str) {
            if let Some(surface) = self.surfaces.remove(label) {
                // The handle may already be gone: nothing to tell Windows then.
                if unsafe { IsWindow(Some(HWND(surface.hwnd as *mut _))) }.as_bool() {
                    let _ = surface.root.Children().and_then(|children| children.RemoveAll());
                }
                let _ = surface.target.Close();
            }
        }
    }

    fn slot(compositor: &Compositor, brush: &CompositionBrush, root: &ContainerVisual) -> windows::core::Result<Slot> {
        let visual = compositor.CreateContainerVisual()?;
        visual.SetRelativeSizeAdjustment(v2(1., 1.))?;
        let geometry = compositor.CreateRoundedRectangleGeometry()?;
        visual.SetClip(&compositor.CreateGeometricClipWithGeometry(&geometry)?)?;
        let blur = compositor.CreateSpriteVisual()?;
        blur.SetRelativeSizeAdjustment(v2(1., 1.))?;
        blur.SetBrush(brush)?;
        visual.Children()?.InsertAtTop(&blur)?;
        visual.SetIsVisible(false)?;
        root.Children()?.InsertAtTop(&visual)?;
        Ok(Slot { visual, geometry, shown: None })
    }

    fn apply_panes(glass: &mut Glass, label: &str, hwnd: isize, seq: u64, panes: &[Pane]) -> windows::core::Result<()> {
        let (compositor, brush) = glass.compositor()?;
        let surface = glass.surface(label, hwnd)?;
        // Messages of one page are numbered; one that arrives after a later one is dropped.
        if seq < surface.seq { return Ok(()); }
        surface.seq = seq;
        while surface.slots.len() < panes.len() {
            let slot = slot(&compositor, &brush, &surface.root)?;
            surface.slots.push(slot);
        }
        for (index, slot) in surface.slots.iter_mut().enumerate() {
            let pane = panes.get(index).copied();
            if slot.shown == pane { continue; }
            match pane {
                Some(pane) => {
                    slot.geometry.SetOffset(v2(pane.x, pane.y))?;
                    slot.geometry.SetSize(v2(pane.width, pane.height))?;
                    slot.geometry.SetCornerRadius(v2(pane.radius, pane.radius))?;
                    slot.visual.SetOpacity(pane.opacity)?;
                    if slot.shown.is_none() { slot.visual.SetIsVisible(true)?; }
                }
                None => slot.visual.SetIsVisible(false)?,
            }
            slot.shown = pane;
        }
        Ok(())
    }

    /// The panes of this frame under the window's WebView (main thread). An error is Windows'
    /// code as text.
    pub fn apply(label: &str, hwnd: isize, seq: u64, panes: &[Pane]) -> Result<(), String> {
        GLASS.with(|glass| match glass.try_borrow_mut() {
            Ok(mut glass) => apply_panes(&mut glass, label, hwnd, seq, panes).map_err(text),
            Err(_) => Ok(()),
        })
    }

    /// Nothing shows in this window's glass any more (main thread); the tree stays for the
    /// next frame.
    pub fn clear(label: &str) {
        GLASS.with(|glass| {
            let Ok(mut glass) = glass.try_borrow_mut() else { return };
            let Some(surface) = glass.surfaces.get_mut(label) else { return };
            for slot in surface.slots.iter_mut().filter(|slot| slot.shown.is_some()) {
                let _ = slot.visual.SetIsVisible(false);
                slot.shown = None;
            }
        });
    }

    /// The window is gone (main thread).
    pub fn forget(label: &str) {
        GLASS.with(|glass| {
            if let Ok(mut glass) = glass.try_borrow_mut() { glass.drop_surface(label); }
        });
    }

    fn dword(root: HKEY, key: PCWSTR, value: PCWSTR) -> Option<u32> {
        let mut data = 0u32;
        let mut size = std::mem::size_of::<u32>() as u32;
        unsafe { RegGetValueW(root, key, value, RRF_RT_REG_DWORD, None, Some(&mut data as *mut u32 as *mut _), Some(&mut size)) }
            .is_ok()
            .then_some(data)
    }

    fn build() -> u32 {
        let mut text = [0u16; 16];
        let mut size = std::mem::size_of_val(&text) as u32;
        let status = unsafe {
            RegGetValueW(
                HKEY_LOCAL_MACHINE,
                w!("SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion"),
                w!("CurrentBuildNumber"),
                RRF_RT_REG_SZ,
                None,
                Some(text.as_mut_ptr() as *mut _),
                Some(&mut size),
            )
        };
        if status.is_err() { return 0; }
        let len = text.iter().position(|c| *c == 0).unwrap_or(text.len());
        String::from_utf16_lossy(&text[..len]).trim().parse().unwrap_or(0)
    }

    #[repr(C)]
    #[derive(Default)]
    struct PowerStatus { ac: u8, battery: u8, percent: u8, system: u8, life: u32, full: u32 }

    // GetSystemPowerStatus, looked up in kernel32: its SystemStatusFlag is 1 while the battery
    // (energy) saver is on. Found by name to keep the crate's feature list short.
    fn energy_saver() -> bool {
        type GetSystemPowerStatus = unsafe extern "system" fn(*mut PowerStatus) -> i32;
        unsafe {
            let Ok(kernel32) = GetModuleHandleW(w!("kernel32.dll")) else { return false };
            let Some(entry) = GetProcAddress(kernel32, s!("GetSystemPowerStatus")) else { return false };
            let get: GetSystemPowerStatus = std::mem::transmute(entry);
            let mut status = PowerStatus::default();
            get(&mut status) != 0 && status.system == 1
        }
    }

    fn high_contrast() -> bool {
        let mut contrast = HIGHCONTRASTW { cbSize: std::mem::size_of::<HIGHCONTRASTW>() as u32, ..Default::default() };
        unsafe {
            SystemParametersInfoW(SPI_GETHIGHCONTRAST, contrast.cbSize, Some(&mut contrast as *mut _ as *mut _), SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS(0)).is_ok()
                && contrast.dwFlags.contains(HCF_HIGHCONTRASTON)
        }
    }

    pub fn read() -> Conditions {
        Conditions {
            build: build(),
            // Missing value: Windows' default, transparency on.
            transparency: dword(HKEY_CURRENT_USER, w!("Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize"), w!("EnableTransparency")) != Some(0),
            energy_saver: energy_saver(),
            high_contrast: high_contrast(),
            remote: unsafe { GetSystemMetrics(SM_REMOTESESSION) } != 0,
        }
    }
}

#[cfg(not(windows))]
mod imp {
    use super::{Conditions, Pane};
    pub fn apply(_: &str, _: isize, _: u64, _: &[Pane]) -> Result<(), String> { Err("unsupported".into()) }
    pub fn clear(_: &str) {}
    pub fn forget(_: &str) {}
    pub fn read() -> Conditions { Conditions { build: 0, transparency: false, energy_saver: false, high_contrast: false, remote: false } }
}

#[cfg(test)]
mod tests {
    use super::*;

    const WINDOWS_11: Conditions = Conditions { build: 26200, transparency: true, energy_saver: false, high_contrast: false, remote: false };

    #[test]
    fn the_real_glass_shows_only_with_the_setting_on_no_native_failure_and_windows_able_to_draw_it() {
        let read = std::cell::Cell::new(0);
        let conditions = || { read.set(read.get() + 1); WINDOWS_11 };
        assert_eq!(material(GlassMaterial::Painted, false, conditions), Err(Painted::Setting));
        assert_eq!(material(GlassMaterial::Glass, true, conditions), Err(Painted::Native));
        assert_eq!(read.get(), 0, "Windows is read only when the material could show");
        assert_eq!(material(GlassMaterial::Glass, false, conditions), Ok(()));
        assert_eq!(read.get(), 1);
        let off = |c: Conditions| material(GlassMaterial::Glass, false, || c);
        assert_eq!(off(Conditions { build: 19045, ..WINDOWS_11 }), Err(Painted::Fallback(Fallback::OldWindows)));
        assert_eq!(off(Conditions { build: 21999, ..WINDOWS_11 }), Err(Painted::Fallback(Fallback::OldWindows)));
        assert_eq!(off(Conditions { build: FIRST_BUILD, ..WINDOWS_11 }), Ok(()), "Windows 11 21H2 has the host backdrop");
        assert_eq!(off(Conditions { remote: true, ..WINDOWS_11 }), Err(Painted::Fallback(Fallback::RemoteDesktop)));
        assert_eq!(off(Conditions { high_contrast: true, ..WINDOWS_11 }), Err(Painted::Fallback(Fallback::HighContrast)));
        assert_eq!(off(Conditions { transparency: false, ..WINDOWS_11 }), Err(Painted::Fallback(Fallback::Transparency)));
        assert_eq!(off(Conditions { energy_saver: true, ..WINDOWS_11 }), Err(Painted::Fallback(Fallback::EnergySaver)));
        assert_eq!(off(Conditions { build: 0, ..WINDOWS_11 }), Err(Painted::Fallback(Fallback::OldWindows)), "an unreadable build falls back");
    }

    #[test]
    fn the_test_injection_forces_one_condition_and_nothing_else() {
        let fallback_of = |injection| fallback(forced(injection, WINDOWS_11));
        assert_eq!(fallback_of(None), None);
        assert_eq!(fallback_of(Some("windows10")), Some(Fallback::OldWindows));
        assert_eq!(fallback_of(Some("remote")), Some(Fallback::RemoteDesktop));
        assert_eq!(fallback_of(Some("contrast")), Some(Fallback::HighContrast));
        assert_eq!(fallback_of(Some("transparency")), Some(Fallback::Transparency));
        assert_eq!(fallback_of(Some("energy")), Some(Fallback::EnergySaver));
        assert_eq!(fallback_of(Some("anything")), None);
        assert_eq!(forced(Some("energy"), WINDOWS_11), Conditions { energy_saver: true, ..WINDOWS_11 });
    }

    fn shape(x: f64, y: f64, width: f64, height: f64, radius: f64, opacity: f64) -> Shape { Shape { x, y, width, height, radius, opacity } }

    #[test]
    fn a_shape_reaches_the_compositor_in_physical_pixels_with_the_radius_of_the_page() {
        // The work pill (a capsule: « 999 px ») and the grid (16 px), at 100 and 150 %.
        assert_eq!(panes(&[shape(40., 12., 300., 44., 999., 1.)], 1.), vec![Pane { x: 40., y: 12., width: 300., height: 44., radius: 22., opacity: 1. }]);
        assert_eq!(panes(&[shape(40., 12., 218., 176., 16., 0.5)], 1.5), vec![Pane { x: 60., y: 18., width: 327., height: 264., radius: 24., opacity: 0.75 }]);
        // Sub-pixel places are kept: the page's own layout is not rounded either.
        assert_eq!(panes(&[shape(10.25, 0.5, 20.5, 20.5, 4., 1.)], 1.)[0], Pane { x: 10.25, y: 0.5, width: 20.5, height: 20.5, radius: 4., opacity: 1. });
    }

    #[test]
    fn the_blur_comes_faster_than_the_surface_fades_in_and_meets_it_at_both_ends() {
        assert_eq!((blur_opacity(0.), blur_opacity(1.)), (0., 1.));
        assert_eq!(blur_opacity(0.5), 0.75);
        assert!((0..=100).map(|i| blur_opacity(i as f64 / 100.)).collect::<Vec<_>>().windows(2).all(|pair| pair[0] <= pair[1]));
        assert_eq!((blur_opacity(-3.), blur_opacity(9.)), (0., 1.));
    }

    #[test]
    fn nothing_a_page_sends_can_draw_out_of_reason() {
        let nan = f64::NAN;
        let hostile = [
            shape(nan, 0., 10., 10., 0., 1.),
            shape(0., 0., f64::INFINITY, 10., 0., 1.),
            shape(0., 0., 10., 10., nan, 1.),
            shape(0., 0., 0., 10., 0., 1.),
            shape(0., 0., 10., -4., 0., 1.),
            shape(0., 0., 10., 10., 0., 0.),
            shape(0., 0., 10., 10., 0., -1.),
        ];
        assert!(panes(&hostile, 1.).is_empty(), "no number, no area or no opacity: not drawn");
        let pane = panes(&[shape(-1e9, 1e9, 1e9, 30., -5., 7.)], 1.)[0];
        assert_eq!(pane, Pane { x: -32000., y: 32000., width: 32000., height: 30., radius: 0., opacity: 1. });
        assert_eq!(panes(&[shape(0., 0., 10., 10., 0., 1.)], nan)[0].width, 10., "an unreadable scale is 100 %");
        assert_eq!(panes(&[shape(0., 0., 10., 10., 0., 1.)], 1e9)[0].width, 80., "a scale stays within 50 and 800 %");
        let many: Vec<Shape> = (0..40).map(|i| shape(i as f64, 0., 10., 10., 0., 1.)).collect();
        assert_eq!(panes(&many, 1.).len(), MAX_SHAPES);
    }
}
