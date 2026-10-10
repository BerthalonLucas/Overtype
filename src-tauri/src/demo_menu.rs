//! Probe only (lot 14): opens the Îlot's menu on the demo selection, as a press of a `menu`
//! binding would, so `npm run ui:native` can walk the 0.5.0 journey in the real window
//! without a real selection, a keyboard shortcut or any key sent to another application.
//! Honoured only in a demo process (`--demo-selection`…) started by the WebView2 probe
//! (`FLOWTRANSLATE_CDP_URL` set, like `host::override_cursor`), from the overlay page, under
//! `uiVersion: 'ilot'`. The capture reads no window: its source is none (0), so the keyboard
//! hook never takes a key from whatever application is in front, and a choice gives the
//! foreground back to nobody. Everything after it is the ordinary menu path (`choose_action`,
//! `translate` with simulated inference, the halo, the pill).
use crate::types::{Capture, UiVersion};
use crate::{capture_opening, AppState, Opening};
use tauri::{AppHandle, State};

fn allowed(demo: bool, probe: bool, window: &str, ilot: bool) -> Result<(), &'static str> {
    if !demo || !probe || window != "overlay" {
        return Err("Indisponible hors test.");
    }
    if !ilot {
        return Err("L’Îlot n’est pas actif.");
    }
    Ok(())
}

#[tauri::command]
pub(crate) fn demo_menu_capture(
    app: AppHandle,
    window: tauri::WebviewWindow,
    state: State<'_, AppState>,
) -> Result<Capture, String> {
    let settings = state
        .inner
        .lock()
        .map_err(|_| crate::lock_error())?
        .settings
        .clone();
    let probe = std::env::var_os("FLOWTRANSLATE_CDP_URL").is_some();
    allowed(
        state.demo,
        probe,
        window.label(),
        settings.ui_version == UiVersion::Ilot,
    )?;
    let flight = crate::Flight::begin().ok_or("Une capture est déjà en cours.")?;
    capture_opening(&app, &state, Opening::Menu(Box::new(settings)), 0, &flight)
        .map_err(String::from)?
        .ok_or_else(|| "Capture de démonstration indisponible.".into())
}

#[cfg(test)]
mod tests {
    use super::allowed;

    #[test]
    fn only_a_probed_demo_overlay_under_the_ilot_opens_the_menu() {
        assert!(allowed(true, true, "overlay", true).is_ok());
        assert!(
            allowed(false, true, "overlay", true).is_err(),
            "a real session never opens a demo menu"
        );
        assert!(
            allowed(true, false, "overlay", true).is_err(),
            "a demo without the probe neither"
        );
        assert!(allowed(true, true, "settings", true).is_err());
        assert!(allowed(true, true, "halo", true).is_err());
        assert_eq!(
            allowed(true, true, "overlay", false),
            Err("L’Îlot n’est pas actif.")
        );
    }
}
