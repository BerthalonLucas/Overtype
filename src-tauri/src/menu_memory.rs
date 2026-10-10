//! The Îlot's last action per application (lot 4): the executable name of the source
//! window (« notepad.exe ») → the id of the saved action chosen there last. Never a text,
//! never a free instruction. At most 64 applications, the least recent dropped first,
//! in `menu-memory.json` next to the settings.
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
};

const LIMIT: usize = 64;

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct Entry {
    process: String,
    action_id: String,
}

#[derive(Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Persisted {
    /// Most recent first.
    applications: Vec<Entry>,
}

pub struct MenuMemory {
    path: PathBuf,
    entries: Vec<Entry>,
}

fn plausible(entry: &Entry) -> bool {
    let fine = |value: &str, max: usize| {
        !value.trim().is_empty() && value.len() <= max && !value.chars().any(char::is_control)
    };
    fine(&entry.process, 260) && fine(&entry.action_id, 80)
}

impl MenuMemory {
    /// A missing or unreadable file is an empty memory: it only saves keystrokes.
    pub fn load(root: &Path) -> Self {
        let path = root.join("menu-memory.json");
        let mut entries = fs::read(&path)
            .ok()
            .and_then(|bytes| serde_json::from_slice::<Persisted>(&bytes).ok())
            .map(|persisted| persisted.applications)
            .unwrap_or_default();
        entries.retain(plausible);
        let mut seen = std::collections::HashSet::new();
        entries.retain(|entry| seen.insert(entry.process.clone()));
        entries.truncate(LIMIT);
        Self { path, entries }
    }

    pub fn get(&self, process: &str) -> Option<&str> {
        self.entries
            .iter()
            .find(|entry| entry.process == process)
            .map(|entry| entry.action_id.as_str())
    }

    /// Records the choice as the most recent; true when the memory changed.
    pub fn remember(&mut self, process: &str, action_id: &str) -> bool {
        let entry = Entry {
            process: process.into(),
            action_id: action_id.into(),
        };
        if !plausible(&entry) || self.entries.first() == Some(&entry) {
            return false;
        }
        self.entries.retain(|known| known.process != entry.process);
        self.entries.insert(0, entry);
        self.entries.truncate(LIMIT);
        true
    }

    /// Forgets every application (« Restore default settings »); true when there was any.
    pub fn clear(&mut self) -> bool {
        let known = !self.entries.is_empty();
        self.entries.clear();
        known
    }

    pub fn save(&self) -> Result<(), String> {
        let bytes = serde_json::to_vec_pretty(&Persisted {
            applications: self.entries.clone(),
        })
        .map_err(|_| "Impossible de préparer la mémoire du menu.".to_string())?;
        let tmp = self.path.with_extension("json.tmp");
        fs::write(&tmp, bytes)
            .map_err(|_| "Impossible d’enregistrer la mémoire du menu.".to_string())?;
        crate::settings::replace_file(&tmp, &self.path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_keeps_the_last_action_of_each_application_and_sixty_four_at_most() {
        let root = std::env::temp_dir().join(format!(
            "flowtranslate-menu-memory-{}",
            uuid::Uuid::new_v4()
        ));
        fs::create_dir_all(&root).unwrap();
        let mut memory = MenuMemory::load(&root);
        assert_eq!(memory.get("notepad.exe"), None, "no file yet");
        assert!(memory.remember("notepad.exe", "correct"));
        assert!(memory.remember("chrome.exe", "translate"));
        assert!(memory.remember("notepad.exe", "shorten"));
        assert!(!memory.remember("notepad.exe", "shorten"), "unchanged");
        assert!(!memory.remember("", "correct") && !memory.remember("x.exe", "a\nb"));
        memory.save().unwrap();
        let reloaded = MenuMemory::load(&root);
        assert_eq!(
            (reloaded.get("notepad.exe"), reloaded.get("chrome.exe")),
            (Some("shorten"), Some("translate"))
        );
        let written = fs::read_to_string(root.join("menu-memory.json")).unwrap();
        assert!(
            written.contains("\"process\": \"notepad.exe\"")
                && written.contains("\"actionId\": \"shorten\"")
        );
        let mut memory = reloaded;
        for n in 0..70 {
            memory.remember(&format!("app{n}.exe"), "correct");
        }
        assert_eq!(memory.entries.len(), LIMIT);
        assert_eq!(memory.get("app69.exe"), Some("correct"));
        assert_eq!(
            memory.get("notepad.exe"),
            None,
            "the least recent went first"
        );
        assert!(memory.clear() && !memory.clear());
        memory.save().unwrap();
        assert_eq!(
            MenuMemory::load(&root).get("app69.exe"),
            None,
            "forgotten, on disk too"
        );
        fs::write(root.join("menu-memory.json"), "not json").unwrap();
        assert_eq!(
            MenuMemory::load(&root).entries.len(),
            0,
            "an unreadable file is an empty memory"
        );
        fs::remove_dir_all(root).unwrap();
    }
}
