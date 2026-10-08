//! Updates from inside the app (0.6.2, Lucas 2026-10-08): the `latest.json` of the latest GitHub
//! release, its installer signed with Lucas's key (the public half is in tauri.conf.json). Checked
//! at start then every six hours, and on demand from Settings › General, whose button lights up
//! while a newer version waits. Installing runs the installer in its passive mode: Windows shows
//! its progress, the app quits, and the installer starts the new version.

use crate::diagnostics::{Diag, DiagLevel, DiagStep};
use serde::Serialize;
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_updater::{Update, UpdaterExt};

const EVERY: Duration = Duration::from_secs(6 * 60 * 60);
/// Asked of GitHub at once: a check never hangs the row longer than this.
const CHECK_TIMEOUT: Duration = Duration::from_secs(20);

/// What the General page shows; sent with every change as `update-status`.
#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStatus {
    pub current: String,
    /// The newer version waiting, if any.
    pub available: Option<String>,
    /// When GitHub last answered (milliseconds since 1970).
    pub checked_at: Option<u64>,
    pub checking: bool,
    /// The last check or install failed (no network, GitHub, a bad signature).
    pub failed: bool,
    pub installing: bool,
    /// Downloaded so far and the whole, in bytes, while installing.
    pub downloaded: u64,
    pub total: Option<u64>,
}

#[derive(Default)]
pub struct Updates {
    status: Mutex<UpdateStatus>,
    pending: Mutex<Option<Update>>,
}

fn change(app: &AppHandle, edit: impl FnOnce(&mut UpdateStatus)) -> UpdateStatus {
    let updates = app.state::<Updates>();
    let status = match updates.status.lock() {
        Ok(mut status) => { edit(&mut status); status.clone() }
        Err(_) => return UpdateStatus::default(),
    };
    let _ = app.emit_to("settings", "update-status", &status);
    status
}

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map_or(0, |d| d.as_millis() as u64)
}

/// Asks GitHub once; a check already running is answered with the status as it is.
pub async fn check(app: &AppHandle) -> UpdateStatus {
    let mut busy = false;
    let status = change(app, |s| {
        busy = s.checking || s.installing;
        if !busy { s.checking = true; }
    });
    if busy { return status; }
    let found = match app.updater_builder().timeout(CHECK_TIMEOUT).build() {
        Ok(updater) => updater.check().await.map_err(|e| e.to_string()),
        Err(e) => Err(e.to_string()),
    };
    match found {
        Ok(update) => {
            let version = update.as_ref().map(|u| u.version.clone());
            if let Ok(mut pending) = app.state::<Updates>().pending.lock() { *pending = update; }
            if let Some(version) = &version {
                crate::record(app, Diag::new(DiagStep::App, DiagLevel::Info, "update_available").detail(version.clone()));
            }
            change(app, |s| { s.checking = false; s.failed = false; s.available = version; s.checked_at = Some(now_ms()); })
        }
        Err(cause) => {
            crate::record(app, Diag::new(DiagStep::App, DiagLevel::Error, "update_check").cause(cause));
            change(app, |s| { s.checking = false; s.failed = true; })
        }
    }
}

/// At start, then every six hours. Never in a development build or a test run: the executable
/// there is not the installed one.
pub fn watch(app: AppHandle) {
    let test_run = std::env::var_os("FLOWTRANSLATE_DATA_DIR").is_some_and(|dir| !dir.is_empty());
    if cfg!(debug_assertions) || test_run { return; }
    tauri::async_runtime::spawn(async move {
        loop {
            check(&app).await;
            tokio::time::sleep(EVERY).await;
        }
    });
}

#[tauri::command]
pub fn update_status(app: AppHandle) -> UpdateStatus {
    change(&app, |_| {})
}

#[tauri::command]
pub async fn check_update(app: AppHandle) -> UpdateStatus {
    check(&app).await
}

/// Downloads the waiting version, checks its signature, then hands over to its installer: on
/// success the app quits here and never answers.
#[tauri::command]
pub async fn install_update(app: AppHandle) -> Result<UpdateStatus, String> {
    let update = app.state::<Updates>().pending.lock().ok().and_then(|pending| pending.clone());
    let Some(update) = update else { return Err("Aucune mise à jour en attente.".into()) };
    let mut busy = false;
    change(&app, |s| {
        busy = s.installing;
        if !busy { s.installing = true; s.failed = false; s.downloaded = 0; s.total = None; }
    });
    if busy { return Err("La mise à jour est déjà en cours.".into()); }
    crate::record(&app, Diag::new(DiagStep::App, DiagLevel::Info, "update_install").detail(update.version.clone()));
    let progress = app.clone();
    let mut downloaded = 0u64;
    let mut shown = 0u64;
    let result = update.download_and_install(move |chunk, total| {
        downloaded += chunk as u64;
        // One event per 256 KB at most: the row needs a bar, not every packet.
        if downloaded - shown >= 256 * 1024 || total == Some(downloaded) {
            shown = downloaded;
            change(&progress, |s| { s.downloaded = downloaded; s.total = total; });
        }
    }, || {}).await;
    match result {
        // Windows: the installer runs and the app has already quit. Elsewhere, start again.
        Ok(()) => app.restart(),
        Err(e) => {
            crate::record(&app, Diag::new(DiagStep::App, DiagLevel::Error, "update_install").cause(e.to_string()));
            let status = change(&app, |s| { s.installing = false; s.failed = true; });
            Err(format!("La mise à jour a échoué ({}).", status.available.unwrap_or_default()))
        }
    }
}

pub fn init(app: &AppHandle) {
    app.manage(Updates::default());
    change(app, |s| s.current = app.package_info().version.to_string());
}
