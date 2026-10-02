// The notification area speaks the interface language (settings.language): its menu and its
// tooltip are built here, at startup and again when the language changes. Error tooltips
// are Rust messages, translated with the error codes of lot 10.
use crate::types::Language;
use tauri::{
    menu::{Menu, MenuItem},
    AppHandle, Runtime,
};

pub const TRAY_ID: &str = "flowtranslate";

struct Labels {
    replay: &'static str,
    close: &'static str,
    settings: &'static str,
    quit: &'static str,
    simulated: &'static str,
}

fn labels(language: Language) -> Labels {
    match language {
        Language::En => Labels {
            replay: "Show the last translation",
            close: "Close the bubble",
            settings: "Settings",
            quit: "Quit",
            simulated: "FlowTranslate · Simulated demo",
        },
        Language::Fr => Labels {
            replay: "Revoir la dernière traduction",
            close: "Fermer la bulle",
            settings: "Réglages",
            quit: "Quitter",
            simulated: "FlowTranslate · Démonstration simulée",
        },
    }
}

pub fn tooltip(language: Language, simulated: bool) -> &'static str {
    if simulated { labels(language).simulated } else { "FlowTranslate" }
}

// The ids « replay », « close », « settings » and « quit » are the ones the menu handler in
// lib.rs matches. « close » (0.6) is the emergency exit: it hides the bubble whatever state it
// is in, always enabled (a bubble that is stuck is exactly the one nothing else closes).
pub fn menu<R: Runtime>(app: &AppHandle<R>, language: Language) -> tauri::Result<Menu<R>> {
    let text = labels(language);
    let replay = MenuItem::with_id(app, "replay", text.replay, true, None::<&str>)?;
    let close = MenuItem::with_id(app, "close", text.close, true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", text.settings, true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", text.quit, true, None::<&str>)?;
    Menu::with_items(app, &[&replay, &close, &settings, &quit])
}

// After a language change: a new menu in the new language and the idle tooltip.
pub fn apply<R: Runtime>(app: &AppHandle<R>, language: Language, simulated: bool) {
    let Some(tray) = app.tray_by_id(TRAY_ID) else { return };
    if let Ok(menu) = menu(app, language) {
        let _ = tray.set_menu(Some(menu));
    }
    let _ = tray.set_tooltip(Some(tooltip(language, simulated)));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_label_exists_in_both_languages_and_differs() {
        let (en, fr) = (labels(Language::En), labels(Language::Fr));
        assert_eq!((en.close, fr.close), ("Close the bubble", "Fermer la bulle"));
        for (en, fr) in [(en.replay, fr.replay), (en.close, fr.close), (en.settings, fr.settings), (en.quit, fr.quit), (en.simulated, fr.simulated)] {
            assert!(!en.trim().is_empty() && !fr.trim().is_empty());
            assert_ne!(en, fr);
        }
        assert_eq!(tooltip(Language::En, false), "FlowTranslate");
        assert_eq!(tooltip(Language::Fr, false), "FlowTranslate");
        assert_eq!(tooltip(Language::En, true), "FlowTranslate · Simulated demo");
        assert_eq!(tooltip(Language::default(), false), "FlowTranslate");
    }
}
