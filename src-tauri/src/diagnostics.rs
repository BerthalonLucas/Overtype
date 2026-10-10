//! The connection journal (0.6, docs/PLAN-0.6.md §2.2): what the hidden Diagnostic page and
//! the setup's « Voir le journal » show. A ring of the 500 last entries in memory, each also
//! appended as one JSON line to `<logs>/diagnostic.log` (rotated at 1 MB into
//! `diagnostic.1.log`).
//!
//! An entry says when, which step, which request (method, URL without query nor fragment),
//! its status, its duration and a cause. It never carries a source text, a translation, the
//! clipboard, a response body or a key: a key appears as `••••` and its four last characters
//! at most, and every text written here is scrubbed of the keys the journal was told about.
use serde::{Deserialize, Serialize};
use std::{collections::VecDeque, fs, io::Write, path::PathBuf, sync::Mutex};

pub const CAPACITY: usize = 500;
pub const ROTATE_BYTES: u64 = 1024 * 1024;
const FILE: &str = "diagnostic.log";
const ROTATED: &str = "diagnostic.1.log";
/// settings.json was unreadable: set aside under this name (`detail`, never its content).
pub const SETTINGS_RECOVERED: &str = "settings_recovered";
/// The history database could not open: the app goes on without history (no content).
pub const HISTORY_UNAVAILABLE: &str = "history_unavailable";
/// A deletion's write-ahead log could not be emptied at once (a reader held it): retried later.
pub const HISTORY_CHECKPOINT_BUSY: &str = "history_checkpoint_busy";

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum DiagStep {
    Address,
    Reach,
    Key,
    Models,
    Try,
    Request,
    App,
}
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum DiagLevel {
    Ok,
    Info,
    Error,
}

/// One line of the journal. `code` is a stable word the interface translates (`resolved`,
/// `connected`, `tls`, `http`, `models`, `reply`, a probe cause such as `reach.refused`, an
/// error code such as `timeout`); `cause` is the system's own text for a failure (scrubbed,
/// never a response body); `detail` a neutral fact (an IP address, a count, a model id).
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DiagEntry {
    pub id: u64,
    /// UTC, RFC 3339 with milliseconds.
    pub at: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub run: Option<String>,
    pub step: DiagStep,
    pub level: DiagLevel,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub method: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<u16>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ms: Option<u64>,
    pub code: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cause: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    /// `system: <host>` when the request went through the proxy of the environment.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub proxy: Option<String>,
    /// The key that was sent, masked (`••••3f2a`); absent when none was.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub key: Option<String>,
}

/// An entry before the journal numbers and dates it.
#[derive(Clone, Debug, Default)]
pub struct Diag {
    pub run: Option<String>,
    pub step: Option<DiagStep>,
    pub level: Option<DiagLevel>,
    pub method: Option<&'static str>,
    pub url: Option<String>,
    pub status: Option<u16>,
    pub ms: Option<u64>,
    pub code: String,
    pub cause: Option<String>,
    pub detail: Option<String>,
    pub proxy: Option<String>,
    pub key: Option<String>,
}
impl Diag {
    pub fn new(step: DiagStep, level: DiagLevel, code: impl Into<String>) -> Self {
        Self {
            step: Some(step),
            level: Some(level),
            code: code.into(),
            ..Self::default()
        }
    }
    pub fn run(mut self, run: &str) -> Self {
        self.run = Some(run.to_string());
        self
    }
    pub fn request(mut self, method: &'static str, url: &str) -> Self {
        self.method = Some(method);
        self.url = Some(url.to_string());
        self
    }
    pub fn status(mut self, status: u16) -> Self {
        self.status = Some(status);
        self
    }
    pub fn ms(mut self, ms: u64) -> Self {
        self.ms = Some(ms);
        self
    }
    pub fn cause(mut self, cause: impl Into<String>) -> Self {
        self.cause = Some(cause.into());
        self
    }
    pub fn detail(mut self, detail: impl Into<String>) -> Self {
        self.detail = Some(detail.into());
        self
    }
    pub fn proxy(mut self, proxy: Option<String>) -> Self {
        self.proxy = proxy;
        self
    }
    /// The key that was sent: only its mask is kept.
    pub fn key(mut self, key: &str) -> Self {
        if !key.is_empty() {
            self.key = Some(mask_key(key));
        }
        self
    }
}

/// `••••` and the four last characters; a key too short to hide behind four keeps none.
pub fn mask_key(key: &str) -> String {
    let chars: Vec<char> = key.chars().collect();
    if chars.len() < 12 {
        return "••••".into();
    }
    format!(
        "••••{}",
        chars[chars.len() - 4..].iter().collect::<String>()
    )
}
/// The four last characters a mask shows (empty for a short key): the interface's « acceptée (••••3f2a) ».
pub fn key_tail(key: &str) -> String {
    mask_key(key).trim_start_matches('•').to_string()
}

/// A URL as the journal shows it: no credentials, no query, no fragment.
pub fn clean_url(url: &str) -> String {
    match url::Url::parse(url) {
        Ok(mut parsed) => {
            parsed.set_query(None);
            parsed.set_fragment(None);
            let _ = parsed.set_username("");
            let _ = parsed.set_password(None);
            parsed.to_string()
        }
        Err(_) => url.split(['?', '#']).next().unwrap_or_default().to_string(),
    }
}

struct Inner {
    entries: VecDeque<DiagEntry>,
    next_id: u64,
    secrets: Vec<String>,
}

pub struct Diagnostics {
    inner: Mutex<Inner>,
    /// The folder of the log files; None keeps the journal in memory only (tests).
    dir: Option<PathBuf>,
}

impl Diagnostics {
    pub fn new(dir: Option<PathBuf>) -> Self {
        Self {
            inner: Mutex::new(Inner {
                entries: VecDeque::with_capacity(CAPACITY),
                next_id: 1,
                secrets: Vec::new(),
            }),
            dir,
        }
    }

    /// A key that is about to travel: whatever an error says later, it never reaches the journal.
    pub fn remember_secret(&self, secret: &str) {
        let secret = secret.trim();
        if secret.len() < 4 {
            return;
        }
        if let Ok(mut inner) = self.inner.lock() {
            if !inner.secrets.iter().any(|known| known == secret) {
                // The few last keys typed are enough; the list never grows without bound.
                if inner.secrets.len() >= 32 {
                    inner.secrets.remove(0);
                }
                inner.secrets.push(secret.to_string());
            }
        }
    }

    /// A text with every known key replaced by its mask, on one line, 300 characters at most.
    pub fn redact(&self, text: &str) -> String {
        let secrets = self
            .inner
            .lock()
            .map(|inner| inner.secrets.clone())
            .unwrap_or_default();
        redact(text, &secrets)
    }

    pub fn add(&self, draft: Diag) -> DiagEntry {
        let mut inner = self
            .inner
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let scrub = |text: Option<String>| {
            text.map(|text| redact(&text, &inner.secrets))
                .filter(|text| !text.is_empty())
        };
        let entry = DiagEntry {
            id: inner.next_id,
            at: chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
            run: scrub(draft.run),
            step: draft.step.unwrap_or(DiagStep::App),
            level: draft.level.unwrap_or(DiagLevel::Info),
            method: draft.method.map(str::to_string),
            url: scrub(draft.url.map(|url| clean_url(&url))),
            status: draft.status,
            ms: draft.ms,
            code: redact(&draft.code, &inner.secrets),
            cause: scrub(draft.cause),
            detail: scrub(draft.detail),
            proxy: scrub(draft.proxy),
            key: draft.key,
        };
        inner.next_id += 1;
        if inner.entries.len() >= CAPACITY {
            inner.entries.pop_front();
        }
        inner.entries.push_back(entry.clone());
        // Under the lock: lines land in the file in their order.
        self.append(&entry);
        entry
    }

    /// The entries in memory, the oldest first.
    pub fn list(&self) -> Vec<DiagEntry> {
        self.inner
            .lock()
            .map(|inner| inner.entries.iter().cloned().collect())
            .unwrap_or_default()
    }

    /// Empties the memory and removes the files. The numbering goes on (an id names one entry).
    pub fn clear(&self) {
        if let Ok(mut inner) = self.inner.lock() {
            inner.entries.clear();
        }
        if let Some(dir) = &self.dir {
            let _ = fs::remove_file(dir.join(FILE));
            let _ = fs::remove_file(dir.join(ROTATED));
        }
    }

    fn append(&self, entry: &DiagEntry) {
        let Some(dir) = &self.dir else { return };
        let Ok(mut line) = serde_json::to_vec(entry) else {
            return;
        };
        line.push(b'\n');
        let path = dir.join(FILE);
        let size = fs::metadata(&path).map(|meta| meta.len()).unwrap_or(0);
        if size > 0 && size + line.len() as u64 > ROTATE_BYTES {
            let _ = fs::remove_file(dir.join(ROTATED));
            let _ = fs::rename(&path, dir.join(ROTATED));
        }
        if fs::create_dir_all(dir).is_err() {
            return;
        }
        if let Ok(mut file) = fs::OpenOptions::new().create(true).append(true).open(&path) {
            let _ = file.write_all(&line);
        }
    }
}

pub fn redact(text: &str, secrets: &[String]) -> String {
    let mut clean = text.replace(['\r', '\n'], " ");
    for secret in secrets {
        if !secret.is_empty() && clean.contains(secret.as_str()) {
            clean = clean.replace(secret.as_str(), &mask_key(secret));
        }
    }
    // « Bearer xxxx » of a key the journal was never told about still loses its value.
    if let Some(at) = clean.find("Bearer ") {
        let rest = &clean[at + 7..];
        let end = rest.find(char::is_whitespace).unwrap_or(rest.len());
        if !rest[..end].starts_with('•') {
            clean.replace_range(at + 7..at + 7 + end, "••••");
        }
    }
    if clean.chars().count() > 300 {
        clean = clean.chars().take(299).chain(Some('…')).collect();
    }
    clean.trim().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir() -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "flowtranslate-diagnostics-{}",
            uuid::Uuid::new_v4()
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }
    const KEY: &str = "sk-synthetic-0123456789-3f2a";

    #[test]
    fn the_ring_keeps_the_500_last_entries_in_their_order() {
        let journal = Diagnostics::new(None);
        for n in 0..(CAPACITY as u64 + 40) {
            let entry = journal.add(Diag::new(DiagStep::Reach, DiagLevel::Ok, "connected").ms(n));
            assert_eq!(entry.id, n + 1);
        }
        let entries = journal.list();
        assert_eq!(entries.len(), CAPACITY);
        assert_eq!((entries[0].id, entries[CAPACITY - 1].id), (41, 540));
        assert!(
            entries.windows(2).all(|pair| pair[0].id < pair[1].id),
            "the oldest first"
        );
        journal.clear();
        assert!(journal.list().is_empty());
        assert_eq!(
            journal
                .add(Diag::new(DiagStep::App, DiagLevel::Info, "cleared"))
                .id,
            541,
            "an id is never used twice"
        );
    }

    #[test]
    fn a_key_never_reaches_the_journal_whatever_the_error_says() {
        let dir = temp_dir();
        let journal = Diagnostics::new(Some(dir.clone()));
        journal.remember_secret(KEY);
        let hostile = format!("error sending request for url (https://llm.exemple.com/v1/models?api_key={KEY}): header Authorization: Bearer {KEY}\r\nrefused");
        journal.add(
            Diag::new(
                DiagStep::Key,
                DiagLevel::Error,
                format!("key.rejected {KEY}"),
            )
            .run(&format!("run-{KEY}"))
            .request(
                "GET",
                &format!("https://user:{KEY}@llm.exemple.com/v1/models?api_key={KEY}&x=1#{KEY}"),
            )
            .status(401)
            .ms(42)
            .cause(hostile.clone())
            .detail(hostile.clone())
            .proxy(Some(format!("system: {KEY}")))
            .key(KEY),
        );
        // A key the journal was never told about, as a server or a library could echo it.
        journal.add(
            Diag::new(DiagStep::Request, DiagLevel::Error, "unauthorized")
                .cause("invalid header Bearer sk-unknown-999999999999 rejected"),
        );
        let entries = journal.list();
        let memory = serde_json::to_string(&entries).unwrap();
        let file = fs::read_to_string(dir.join(FILE)).unwrap();
        for text in [&memory, &file] {
            assert!(!text.contains(KEY), "{text}");
            assert!(!text.contains("0123456789"));
            assert!(!text.contains("sk-unknown"));
        }
        assert_eq!(entries[0].key.as_deref(), Some("••••3f2a"));
        assert_eq!(
            entries[0].url.as_deref(),
            Some("https://llm.exemple.com/v1/models"),
            "no credentials, query nor fragment"
        );
        assert!(entries[0]
            .cause
            .as_deref()
            .is_some_and(|cause| cause.contains("••••3f2a") && !cause.contains('\n')));
        assert_eq!(
            entries[1].cause.as_deref(),
            Some("invalid header Bearer •••• rejected")
        );
        // One JSON line per entry, the same as in memory.
        let lines: Vec<DiagEntry> = file
            .lines()
            .map(|line| serde_json::from_str(line).unwrap())
            .collect();
        assert_eq!(lines, entries);
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn a_mask_shows_four_characters_of_a_long_key_and_none_of_a_short_one() {
        assert_eq!(mask_key(KEY), "••••3f2a");
        assert_eq!(key_tail(KEY), "3f2a");
        assert_eq!(
            mask_key("short-key"),
            "••••",
            "four characters would be half of it"
        );
        assert_eq!(key_tail("abcd"), "");
        assert_eq!(mask_key("clé-avec-accents-éàü"), "••••-éàü");
        assert_eq!(
            clean_url("http://127.0.0.1:8002/v1/models?x=1#y"),
            "http://127.0.0.1:8002/v1/models"
        );
        assert_eq!(clean_url("pas une adresse ?secret"), "pas une adresse ");
        assert_eq!(redact(&"x".repeat(400), &[]).chars().count(), 300);
    }

    #[test]
    fn the_file_rotates_at_one_megabyte_and_clear_removes_it() {
        let dir = temp_dir();
        let journal = Diagnostics::new(Some(dir.clone()));
        let path = dir.join(FILE);
        // A file already close to the limit: the next entry starts a new one.
        fs::write(&path, vec![b'x'; ROTATE_BYTES as usize - 10]).unwrap();
        journal.add(Diag::new(DiagStep::Models, DiagLevel::Ok, "models").detail("4"));
        assert_eq!(
            fs::metadata(dir.join(ROTATED)).unwrap().len(),
            ROTATE_BYTES - 10
        );
        let fresh = fs::read_to_string(&path).unwrap();
        assert_eq!(fresh.lines().count(), 1);
        assert!(fresh.len() < 400);
        // Below the limit it only grows; a second rotation replaces the first.
        journal.add(Diag::new(DiagStep::Models, DiagLevel::Ok, "models"));
        assert_eq!(fs::read_to_string(&path).unwrap().lines().count(), 2);
        fs::write(&path, vec![b'y'; ROTATE_BYTES as usize]).unwrap();
        journal.add(Diag::new(DiagStep::App, DiagLevel::Info, "again"));
        assert!(fs::read(dir.join(ROTATED))
            .unwrap()
            .iter()
            .all(|b| *b == b'y'));
        journal.clear();
        assert!(!path.exists() && !dir.join(ROTATED).exists());
        // Still usable after a clear, and the folder is created when it is missing.
        fs::remove_dir_all(&dir).unwrap();
        journal.add(Diag::new(DiagStep::App, DiagLevel::Info, "after"));
        assert!(path.exists());
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn an_entry_serialises_as_the_interface_reads_it() {
        let journal = Diagnostics::new(None);
        let entry = journal.add(
            Diag::new(DiagStep::Models, DiagLevel::Ok, "models")
                .run("r1")
                .request("GET", "https://llm.exemple.com/v1/models")
                .status(200)
                .ms(84)
                .detail("4"),
        );
        let json = serde_json::to_value(&entry).unwrap();
        assert_eq!(json["step"], "models");
        assert_eq!(json["level"], "ok");
        assert_eq!(
            (
                json["method"].as_str(),
                json["status"].as_u64(),
                json["ms"].as_u64()
            ),
            (Some("GET"), Some(200), Some(84))
        );
        assert!(
            json.get("cause").is_none() && json.get("proxy").is_none() && json.get("key").is_none()
        );
        assert!(json["at"]
            .as_str()
            .is_some_and(|at| at.ends_with('Z') && at.contains('.')));
    }
}
