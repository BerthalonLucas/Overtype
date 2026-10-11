//! Which window may call which command (NATIVE-011). The capabilities (capabilities/*.json, the
//! app's commands declared in build.rs) are the first gate: a window reaches only the commands
//! its capability allows. The commands that read or change what matters (the settings, the
//! history, quitting, an update, the bubble's result) check their caller's label once more, so
//! a capability granted too widely by mistake still opens nothing.

/// The bubble and the Îlot.
pub(crate) const OVERLAY: [&str; 1] = ["overlay"];
/// The Settings window.
pub(crate) const SETTINGS: [&str; 1] = ["settings"];
/// The first-run setup.
pub(crate) const SETUP: [&str; 1] = ["setup"];

/// Refuses a call from any window but `labels`, as the existing guards do.
pub(crate) fn only(window: &tauri::WebviewWindow, labels: &[&str]) -> Result<(), String> {
    allowed(window.label(), labels)
}

fn allowed(label: &str, labels: &[&str]) -> Result<(), String> {
    if labels.contains(&label) {
        Ok(())
    } else {
        Err("Fenêtre inattendue.".into())
    }
}

#[cfg(test)]
mod tests {
    use super::{allowed, OVERLAY, SETTINGS, SETUP};
    use crate::KEYED;
    use std::collections::{BTreeMap, BTreeSet};

    /// Every window the app creates (tauri.conf.json, show_setup, open_demo).
    const WINDOWS: [&str; 5] = ["overlay", "halo", "settings", "setup", "demo"];
    /// Registered commands no capability grants, each with its reason. None today.
    const UNGRANTED: [&str; 0] = [];

    /// The commands build.rs declares to tauri-build (`AppManifest::commands`).
    fn manifest() -> Vec<String> {
        let source = include_str!("../build.rs");
        let start = source.find("const COMMANDS").expect("build.rs: COMMANDS");
        let end = start
            + source[start..]
                .find("];")
                .expect("build.rs: end of COMMANDS");
        source[start..end]
            .split('"')
            .skip(1)
            .step_by(2)
            .map(String::from)
            .collect()
    }

    /// The commands `generate_handler!` registers (src/lib.rs), by their name (no module path).
    fn handler() -> Vec<String> {
        let source = include_str!("lib.rs");
        let start = source
            .find("generate_handler![")
            .expect("lib.rs: generate_handler!")
            + "generate_handler![".len();
        let end = start
            + source[start..]
                .find(']')
                .expect("lib.rs: end of generate_handler!");
        source[start..end]
            .split(',')
            .map(|item| item.trim())
            .filter(|item| !item.is_empty())
            .map(|item| item.rsplit("::").next().unwrap_or(item).to_string())
            .collect()
    }

    /// The capabilities: identifier → (windows, permissions).
    fn capabilities() -> BTreeMap<String, (Vec<String>, Vec<String>)> {
        let dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("capabilities");
        let mut found = BTreeMap::new();
        for entry in std::fs::read_dir(&dir).expect("capabilities folder") {
            let path = entry.expect("capability file").path();
            if path.extension().and_then(|e| e.to_str()) != Some("json") {
                continue;
            }
            let text = std::fs::read_to_string(&path).expect("capability text");
            let value: serde_json::Value = serde_json::from_str(&text).expect("capability JSON");
            let strings = |key: &str| -> Vec<String> {
                value[key]
                    .as_array()
                    .unwrap_or_else(|| panic!("{}: `{key}` must be a list", path.display()))
                    .iter()
                    .map(|item| {
                        item.as_str()
                            .unwrap_or_else(|| {
                                panic!("{}: `{key}` holds plain strings only", path.display())
                            })
                            .to_string()
                    })
                    .collect()
            };
            let id = value["identifier"]
                .as_str()
                .expect("capability identifier")
                .to_string();
            let previous = found.insert(id.clone(), (strings("windows"), strings("permissions")));
            assert!(previous.is_none(), "two capabilities named {id}");
        }
        assert!(!found.is_empty(), "no capability read in {}", dir.display());
        found
    }

    /// The app command an `allow-<command>` permission grants (None for a core permission).
    fn command_of(permission: &str) -> Option<String> {
        if permission.contains(':') {
            return None;
        }
        let name = permission
            .strip_prefix("allow-")
            .unwrap_or_else(|| panic!("{permission}: the app grants allow-<command> only"));
        Some(name.replace('-', "_"))
    }

    /// Command → the windows that are granted it.
    fn grants() -> BTreeMap<String, BTreeSet<String>> {
        let mut grants: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
        for (windows, permissions) in capabilities().values() {
            for permission in permissions {
                if let Some(command) = command_of(permission) {
                    grants
                        .entry(command)
                        .or_default()
                        .extend(windows.iter().cloned());
                }
            }
        }
        grants
    }

    #[test]
    fn the_manifest_lists_exactly_the_registered_commands() {
        let manifest = manifest();
        let handler = handler();
        let unique: BTreeSet<_> = manifest.iter().collect();
        assert_eq!(unique.len(), manifest.len(), "a command twice in build.rs");
        // The parsing found the commands (47 on 11/10/2026), each once.
        assert!(handler.len() >= 40, "generate_handler! read wrong");
        assert_eq!(
            handler.iter().collect::<BTreeSet<_>>().len(),
            handler.len(),
            "a command twice in generate_handler!"
        );
        assert_eq!(
            unique,
            handler.iter().collect::<BTreeSet<_>>(),
            "build.rs and generate_handler! must list the same commands"
        );
    }

    #[test]
    fn capabilities_grant_only_known_commands_to_known_windows() {
        let manifest: BTreeSet<String> = manifest().into_iter().collect();
        for (id, (windows, permissions)) in capabilities() {
            for window in &windows {
                assert!(
                    WINDOWS.contains(&window.as_str()),
                    "{id}: unknown window {window}"
                );
            }
            for permission in &permissions {
                assert!(
                    !permission.ends_with(":default") && permission != "default",
                    "{id}: {permission} grants more than the pages use (NATIVE-011)"
                );
                if let Some(command) = command_of(permission) {
                    assert!(
                        manifest.contains(&command),
                        "{id}: {permission} names no command of AppManifest"
                    );
                }
            }
        }
    }

    #[test]
    fn every_registered_command_is_granted_to_a_window() {
        let grants = grants();
        for command in manifest() {
            if UNGRANTED.contains(&command.as_str()) {
                continue;
            }
            assert!(
                grants
                    .get(&command)
                    .is_some_and(|windows| !windows.is_empty()),
                "{command} is registered but no window may call it"
            );
        }
    }

    /// The commands guarded in Rust: their capabilities never open them wider than the guard.
    #[test]
    fn capabilities_stay_within_the_rust_guards() {
        let guarded: [(&str, &[&str]); 24] = [
            ("save_settings", &KEYED),
            ("shortcut_status", &KEYED),
            ("suggest_shortcut", &KEYED),
            ("shortcut_conflict", &KEYED),
            ("reset_settings", &SETTINGS),
            ("get_history", &SETTINGS),
            ("delete_history", &SETTINGS),
            ("install_update", &SETTINGS),
            ("quit_app", &SETTINGS),
            ("settings_recovery", &SETUP),
            ("translate", &OVERLAY),
            ("cancel_translation", &OVERLAY),
            ("copy_result", &OVERLAY),
            ("replace_result", &OVERLAY),
            ("undo_result", &OVERLAY),
            ("result_pill", &OVERLAY),
            ("move_overlay", &OVERLAY),
            ("resize_overlay", &OVERLAY),
            ("highlight_changes", &OVERLAY),
            ("focus_overlay", &OVERLAY),
            ("choose_action", &OVERLAY),
            ("overlay_dimming", &OVERLAY),
            ("dismiss_overlay", &OVERLAY),
            ("complete_overlay_dismiss", &OVERLAY),
        ];
        let grants = grants();
        for (command, labels) in guarded {
            let windows = grants.get(command).cloned().unwrap_or_default();
            assert!(!windows.is_empty(), "{command} is granted to no window");
            for window in windows {
                assert!(
                    labels.contains(&window.as_str()),
                    "{command} is granted to {window}, which its Rust guard refuses"
                );
            }
        }
    }

    /// NATIVE-011, point 3: a window that never receives the API keys (get_settings sends it a
    /// copy without them) can never save, so it can never write that empty copy back and wipe
    /// the keys. Only the keyed windows are granted save_settings, and Rust refuses the others.
    #[test]
    fn only_the_keyed_windows_save_the_settings() {
        let granted = grants().remove("save_settings").unwrap_or_default();
        for window in WINDOWS {
            let keyed = KEYED.contains(&window);
            assert_eq!(
                granted.contains(window),
                keyed,
                "save_settings granted to {window}"
            );
            assert_eq!(
                allowed(window, &KEYED).is_ok(),
                keyed,
                "save_settings guard, {window}"
            );
        }
        assert!(allowed("", &KEYED).is_err());
        assert!(allowed("Settings", &KEYED).is_err());
    }

    #[test]
    fn the_guard_names_its_refusal() {
        assert_eq!(
            allowed("halo", &OVERLAY),
            Err("Fenêtre inattendue.".to_string())
        );
        assert!(allowed("overlay", &OVERLAY).is_ok());
        assert!(allowed("setup", &SETTINGS).is_err());
        assert!(allowed("settings", &SETUP).is_err());
    }
}
