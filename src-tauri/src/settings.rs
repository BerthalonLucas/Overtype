use crate::actions::{self, ActionDefinition, ShortcutBinding};
use crate::{
    crypto,
    types::{Server, Settings, FIRST_SERVER_ID},
};
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
};
use url::Url;

/// Why the file did not load: it could not be read at all, or it was read and is unusable.
enum LoadError {
    Access(String),
    Unreadable(String),
}

#[derive(Clone)]
pub struct SettingsStore {
    path: PathBuf,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PersistedSettings {
    /// Until 0.3.0 the target language was a setting; since 0.4.0 it lives in the
    /// instruction of each action. Read for the migration, never written again.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    target_language: Option<crate::types::Language>,
    /// Until 0.5.1: the default profile (`fast` or `quality`). Read for the migration to the
    /// servers of 0.6, never written again.
    #[serde(default, skip_serializing)]
    mode: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    shortcut: Option<String>,
    #[serde(default)]
    actions: Option<Vec<ActionDefinition>>,
    #[serde(default)]
    shortcut_bindings: Option<Vec<ShortcutBinding>>,
    #[serde(default)]
    default_action_id: Option<String>,
    history_enabled: bool,
    autostart: bool,
    #[serde(default)]
    text_size: crate::types::TextSize,
    #[serde(default)]
    auto_close: crate::types::AutoClose,
    #[serde(default)]
    ui_version: crate::types::UiVersion,
    #[serde(default)]
    language: crate::types::Language,
    #[serde(default)]
    theme: crate::types::Theme,
    #[serde(default)]
    motion: crate::types::MotionPreference,
    #[serde(default)]
    motion_preset: crate::types::MotionPreset,
    #[serde(default)]
    indicator: crate::types::Indicator,
    #[serde(default)]
    after_replace: crate::types::AfterReplace,
    #[serde(default)]
    undo_strategy: crate::types::UndoStrategy,
    #[serde(default)]
    pill_placement: crate::types::PillPlacement,
    #[serde(default)]
    glass_material: crate::types::GlassMaterial,
    /// Absent from a 0.4 file: the Îlot migration (lot 4) runs once, then it is written.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    menu_action_ids: Option<Vec<String>>,
    /// Until 0.5.1: the two profiles `fast` and `quality`. Read for the migration only.
    #[serde(default, skip_serializing)]
    profiles: Option<HashMap<String, PersistedProfile>>,
    /// Absent from a file of 0.5.1 or older: the migration to servers runs once.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    servers: Option<Vec<PersistedServer>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    default_server_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    setup_done: Option<bool>,
    #[serde(default)]
    changed_words_style: crate::types::ChangedWordsStyle,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PersistedProfile {
    endpoint: String,
    model: String,
    api_key_dpapi: String,
}

/// A server as it is written: its key encrypted with Windows DPAPI, base64, as in 0.5.
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PersistedServer {
    id: String,
    #[serde(default)]
    name: String,
    #[serde(default)]
    endpoint: String,
    #[serde(default)]
    model: String,
    #[serde(default)]
    no_key: bool,
    #[serde(default)]
    api_key_dpapi: String,
}

fn decrypt_key(stored: &str) -> Result<String, String> {
    if stored.is_empty() {
        return Ok(String::new());
    }
    let cipher = STANDARD
        .decode(stored)
        .map_err(|_| "Une clé enregistrée est invalide.".to_string())?;
    String::from_utf8(crypto::unprotect(&cipher)?)
        .map_err(|_| "Une clé enregistrée est invalide.".to_string())
}
fn encrypt_key(key: &str) -> Result<String, String> {
    if key.is_empty() {
        return Ok(String::new());
    }
    Ok(STANDARD.encode(crypto::protect(key.as_bytes())?))
}

/// A 0.5 profile as shipped (nobody set it up): one of the two factory addresses, one of the
/// two factory models, no key.
fn factory_profile(endpoint: &str, model: &str, api_key: &str) -> bool {
    matches!(
        endpoint.trim().trim_end_matches('/'),
        "http://127.0.0.1:8001/v1" | "http://127.0.0.1:8002/v1"
    ) && matches!(model.trim(), "flowtranslate-fast" | "flowtranslate-quality")
        && api_key.is_empty()
}

/// The servers of a file of 0.5.1 or older (docs/PLAN-0.6.md §1.3), from its two profiles
/// (endpoint, model, key) and its default one: `quality` then `fast` when they are set up and
/// differ; one empty server when none is. Returns the servers, the default one's id and
/// whether the setup counts as done.
/// A factory profile is nobody's choice, unless something listens at its address right now
/// (`listens`): that is the repository's own server (server/compose.yaml serves exactly these
/// ports and model names), and dropping it left a working installation answering « Aucun
/// serveur n'est réglé » to every shortcut after the update. It is kept as a server, and the
/// setup still shows (its live check has the last word).
fn servers_from_profiles(
    profiles: &HashMap<String, (String, String, String)>,
    mode: Option<&str>,
    listens: impl Fn(&Endpoint) -> bool,
) -> (Vec<Server>, String, bool) {
    // The server, and whether somebody set it up.
    let filled = |name: &str| -> Option<(Server, bool)> {
        let (endpoint, model, api_key) = profiles.get(name)?;
        if endpoint.trim().is_empty() {
            return None;
        }
        let factory = factory_profile(endpoint, model, api_key);
        // 0.5 validated its addresses; one that no longer reads is not a server set up.
        let endpoint = normalize_endpoint(endpoint).ok()?;
        if factory && !listens(&endpoint) {
            return None;
        }
        Some((
            Server {
                id: String::new(),
                name: String::new(),
                endpoint: endpoint.base,
                api_key: api_key.clone(),
                no_key: api_key.is_empty(),
                model: model.trim().to_string(),
            },
            !factory,
        ))
    };
    let quality = filled("quality");
    let fast = filled("fast").filter(|(fast, _)| {
        quality.as_ref().is_none_or(|(quality, _)| {
            (&fast.endpoint, &fast.model, &fast.api_key)
                != (&quality.endpoint, &quality.model, &quality.api_key)
        })
    });
    let fast_is_default = mode == Some("fast") && fast.is_some();
    let set_up = quality.iter().chain(fast.iter()).any(|(_, chosen)| *chosen);
    let mut servers: Vec<Server> = quality
        .into_iter()
        .chain(fast)
        .map(|(server, _)| server)
        .collect();
    if servers.is_empty() {
        return (
            vec![Server {
                id: FIRST_SERVER_ID.into(),
                ..Server::default()
            }],
            FIRST_SERVER_ID.into(),
            false,
        );
    }
    for (index, server) in servers.iter_mut().enumerate() {
        server.id = format!("s{}", index + 1);
    }
    let default = if fast_is_default {
        servers.last()
    } else {
        servers.first()
    }
    .map(|server| server.id.clone())
    .unwrap_or_else(|| FIRST_SERVER_ID.into());
    (servers, default, set_up)
}
/// Whether something accepts a connection at a local address, asked once at the migration of a
/// 0.5 file: this computer only, a fifth of a second at most, nothing sent.
fn local_server_listens(endpoint: &Endpoint) -> bool {
    use std::net::{SocketAddr, TcpStream, ToSocketAddrs};
    if !endpoint.local {
        return false;
    }
    let Ok(addresses) = (endpoint.hostname.as_str(), endpoint.port).to_socket_addrs() else {
        return false;
    };
    let addresses: Vec<SocketAddr> = addresses
        .filter(|address| address.ip().is_loopback())
        .take(2)
        .collect();
    addresses.iter().any(|address| {
        TcpStream::connect_timeout(address, std::time::Duration::from_millis(200)).is_ok()
    })
}

impl SettingsStore {
    pub fn new(root: &Path) -> Self {
        Self {
            path: root.join("settings.json"),
        }
    }

    /// False on a fresh install: nothing was ever saved (the first launch reads Windows' language).
    pub fn exists(&self) -> bool {
        self.path.exists()
    }

    /// Where the file of 0.5.1 or older is copied, once, before its first rewrite as 0.6.
    pub fn backup_path(&self) -> PathBuf {
        self.path.with_file_name("settings.0.5.bak.json")
    }

    #[cfg(test)]
    pub fn load(&self) -> Result<Settings, String> {
        self.read().map_err(|error| match error {
            LoadError::Access(message) | LoadError::Unreadable(message) => message,
        })
    }

    /// The settings, or, when the file is there but unreadable (invalid JSON, a key DPAPI can no
    /// longer decrypt, values `validate` refuses, no action), the defaults: the file is renamed
    /// `settings.illisible-AAAAMMJJ-HHMMSS.json` beside it, never deleted, and its name (no path)
    /// is returned. A file that cannot be accessed (locked, denied) is not corrupt: an error.
    pub fn load_or_recover(&self) -> Result<(Settings, Option<String>), String> {
        match self.read() {
            Ok(settings) => Ok((settings, None)),
            Err(LoadError::Access(message)) => Err(message),
            Err(LoadError::Unreadable(message)) => {
                let stamp = chrono::Local::now().format("%Y%m%d-%H%M%S").to_string();
                let mut name = format!("settings.illisible-{stamp}.json");
                let mut n = 2;
                while self.path.with_file_name(&name).exists() {
                    name = format!("settings.illisible-{stamp}-{n}.json");
                    n += 1;
                }
                fs::rename(&self.path, self.path.with_file_name(&name)).map_err(|_| message)?;
                Ok((Settings::default(), Some(name)))
            }
        }
    }

    fn read(&self) -> Result<Settings, LoadError> {
        if !self.path.exists() {
            return Ok(Settings::default());
        }
        let bytes = fs::read(&self.path)
            .map_err(|_| LoadError::Access("Impossible de lire les paramètres.".to_string()))?;
        let invalid =
            || LoadError::Unreadable("Le fichier de paramètres est invalide.".to_string());
        let raw: PersistedSettings = serde_json::from_slice(&bytes).map_err(|_| invalid())?;
        let bindings = raw.shortcut_bindings.unwrap_or_else(|| {
            let mut bindings =
                actions::legacy_bindings(raw.shortcut.unwrap_or_else(|| "Ctrl+Alt+T".into()));
            // A previously accepted system chord must not prevent startup or discard
            // the user's servers. Keep it visible, disabled, for re-recording.
            bindings[0].enabled = actions::parse_shortcut(&bindings[0].shortcut).is_ok();
            bindings
        });
        let language = raw.target_language.unwrap_or(crate::types::Language::Fr);
        let mut migrated = raw.target_language.is_some();
        let actions = raw
            .actions
            .map(|actions| {
                actions
                    .into_iter()
                    .map(|mut action| {
                        if action.prompt_template.contains("{{") {
                            action.prompt_template =
                                actions::migrate_template(&action.prompt_template, language);
                            migrated = true;
                        }
                        action
                    })
                    .collect::<Vec<_>>()
            })
            .unwrap_or_else(actions::legacy_defaults);
        // `actions: []` panicked here, before `validate` ever saw the file.
        let first = actions.first().ok_or_else(invalid)?;
        let default_action_id = raw
            .default_action_id
            .filter(|id| actions.iter().any(|a| &a.id == id))
            .unwrap_or_else(|| first.id.clone());
        let ilot_known = raw.menu_action_ids.is_some();
        // The servers of 0.6, or the two profiles of a file of 0.5.1 or older turned into them.
        let from_0_5 = raw.servers.is_none();
        let (servers, default_server_id, setup_done) = match raw.servers {
            Some(stored) => {
                let mut servers = Vec::new();
                for server in stored {
                    servers.push(Server {
                        api_key: decrypt_key(&server.api_key_dpapi)
                            .map_err(LoadError::Unreadable)?,
                        id: server.id,
                        name: server.name,
                        endpoint: server.endpoint,
                        no_key: server.no_key,
                        model: server.model,
                    });
                }
                let default = raw
                    .default_server_id
                    .filter(|id| servers.iter().any(|server| &server.id == id))
                    .or_else(|| servers.first().map(|server| server.id.clone()))
                    .unwrap_or_default();
                (servers, default, raw.setup_done.unwrap_or(false))
            }
            None => {
                let mut profiles = HashMap::new();
                for (name, profile) in raw.profiles.unwrap_or_default() {
                    profiles.insert(
                        name,
                        (
                            profile.endpoint,
                            profile.model,
                            decrypt_key(&profile.api_key_dpapi).map_err(LoadError::Unreadable)?,
                        ),
                    );
                }
                servers_from_profiles(&profiles, raw.mode.as_deref(), local_server_listens)
            }
        };
        let mut settings = Settings {
            actions,
            shortcut_bindings: bindings,
            default_action_id,
            history_enabled: raw.history_enabled,
            autostart: raw.autostart,
            text_size: raw.text_size,
            auto_close: raw.auto_close,
            ui_version: raw.ui_version,
            language: raw.language,
            theme: raw.theme,
            motion: raw.motion,
            motion_preset: raw.motion_preset,
            indicator: raw.indicator,
            after_replace: raw.after_replace,
            undo_strategy: raw.undo_strategy,
            pill_placement: raw.pill_placement,
            // Until 0.5.1 the material was a hidden trial, `painted` unless hand-edited: such a
            // file never chose it, and gets the real glass of 0.6 (src/backdrop.rs).
            glass_material: if from_0_5 {
                crate::types::GlassMaterial::Glass
            } else {
                raw.glass_material
            },
            menu_action_ids: raw.menu_action_ids.unwrap_or_default(),
            servers,
            default_server_id,
            setup_done,
            changed_words_style: raw.changed_words_style,
        };
        // A 0.4 file (or older) gains the Îlot grid, its letters and its menu shortcut.
        if !ilot_known && actions::migrate_to_ilot(&mut settings) {
            migrated = true;
        }
        // The default actions nobody renamed read in the interface's language (0.6).
        if actions::localize_defaults(&mut settings.actions, settings.language) {
            migrated = true;
        }
        validate(&settings).map_err(LoadError::Unreadable)?;
        if from_0_5 {
            // The file as 0.5 wrote it stays beside the new one, once: a way back.
            let backup = self.backup_path();
            if !backup.exists() {
                let _ = fs::write(&backup, &bytes);
            }
            migrated = true;
        }
        if migrated {
            // Rewrite the file once: no language setting, no variables, the Îlot grid, servers.
            let _ = self.save(&settings);
        }
        Ok(settings)
    }

    pub fn save(&self, settings: &Settings) -> Result<(), String> {
        validate(settings)?;
        let mut servers = Vec::new();
        for server in &settings.servers {
            servers.push(PersistedServer {
                id: server.id.clone(),
                name: server.name.clone(),
                endpoint: server.endpoint.clone(),
                model: server.model.clone(),
                no_key: server.no_key,
                api_key_dpapi: encrypt_key(if server.no_key { "" } else { &server.api_key })?,
            });
        }
        let raw = PersistedSettings {
            target_language: None,
            mode: None,
            shortcut: None,
            actions: Some(settings.actions.clone()),
            shortcut_bindings: Some(settings.shortcut_bindings.clone()),
            default_action_id: Some(settings.default_action_id.clone()),
            history_enabled: settings.history_enabled,
            autostart: settings.autostart,
            text_size: settings.text_size,
            auto_close: settings.auto_close,
            ui_version: settings.ui_version,
            language: settings.language,
            theme: settings.theme,
            motion: settings.motion,
            motion_preset: settings.motion_preset,
            indicator: settings.indicator,
            after_replace: settings.after_replace,
            undo_strategy: settings.undo_strategy,
            pill_placement: settings.pill_placement,
            glass_material: settings.glass_material,
            menu_action_ids: Some(settings.menu_action_ids.clone()),
            profiles: None,
            servers: Some(servers),
            default_server_id: Some(settings.default_server_id.clone()),
            setup_done: Some(settings.setup_done),
            changed_words_style: settings.changed_words_style,
        };
        let bytes = serde_json::to_vec_pretty(&raw)
            .map_err(|_| "Impossible de préparer les paramètres.".to_string())?;
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent)
                .map_err(|_| "Impossible de créer le dossier de données.".to_string())?;
        }
        let tmp = self.path.with_extension("json.tmp");
        fs::write(&tmp, bytes)
            .map_err(|_| "Impossible d’enregistrer les paramètres.".to_string())?;
        replace_file(&tmp, &self.path)
    }
}

#[cfg(windows)]
pub(crate) fn replace_file(source: &Path, destination: &Path) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    use windows::{
        core::PCWSTR,
        Win32::Storage::FileSystem::{
            MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
        },
    };
    let source = source
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect::<Vec<_>>();
    let destination = destination
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect::<Vec<_>>();
    unsafe {
        MoveFileExW(
            PCWSTR(source.as_ptr()),
            PCWSTR(destination.as_ptr()),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    }
    .map_err(|_| "Impossible de finaliser les paramètres.".to_string())
}

#[cfg(not(windows))]
pub(crate) fn replace_file(source: &Path, destination: &Path) -> Result<(), String> {
    fs::rename(source, destination)
        .map_err(|_| "Impossible de finaliser les paramètres.".to_string())
}

/// « Restore default settings » (Lucas, 24/09): a fresh install's settings, its actions,
/// shortcut, menu, appearance and result bubble included, but what sets this device up stays:
/// the connection (its servers and the default one), the setup already done, the history
/// switch, the start with Windows and the language of the interface.
pub fn reset(current: &Settings) -> Settings {
    Settings {
        servers: current.servers.clone(),
        default_server_id: current.default_server_id.clone(),
        setup_done: current.setup_done,
        history_enabled: current.history_enabled,
        autostart: current.autostart,
        language: current.language,
        ..Settings::default()
    }
}

/// Windows refused the default menu chord to `reset` (another application holds Ctrl+Alt+Space,
/// Claude desktop on Lucas's PC): the same settings with the menu on the chord it had, when it
/// had another one, enabled. None otherwise: the refusal stands.
pub fn keep_menu_chord(fresh: &Settings, current: &Settings) -> Option<Settings> {
    let chord = &current
        .shortcut_bindings
        .iter()
        .find(|b| b.kind == actions::BindingKind::Menu && b.enabled)?
        .shortcut;
    let mut kept = fresh.clone();
    let menu = kept
        .shortcut_bindings
        .iter_mut()
        .find(|b| b.kind == actions::BindingKind::Menu)?;
    let id = |value: &str| actions::parse_shortcut(value).ok().map(|key| key.id());
    if id(&menu.shortcut) == id(chord) {
        return None;
    }
    menu.shortcut = chord.clone();
    Some(kept)
}

/// What is saved is clean (docs/PLAN-0.6.md §1.2): every address in its normalised form
/// (no `/v1`, no final slash, `https://` when no scheme was typed), a model and a name without
/// the spaces around them, and no key kept for a server that has none; the default actions
/// nobody renamed carry the names of the interface's language (`actions::localize_defaults`). An address that does
/// not read is left as it is: `validate` then refuses it.
pub fn sanitize(settings: &mut Settings) {
    actions::localize_defaults(&mut settings.actions, settings.language);
    for server in &mut settings.servers {
        if let Ok(endpoint) = normalize_endpoint(&server.endpoint) {
            server.endpoint = endpoint.base;
        } else if server.endpoint.trim().is_empty() {
            server.endpoint.clear();
        }
        server.model = server.model.trim().to_string();
        server.name = server.name.trim().to_string();
        if server.no_key {
            server.api_key.clear();
        }
    }
}

pub const MAX_SERVERS: usize = 8;

pub fn validate(settings: &Settings) -> Result<(), String> {
    actions::validate(settings)?;
    if !(2..=20).contains(&settings.after_replace.undo_seconds) {
        return Err("La durée d’annulation doit être comprise entre 2 et 20 secondes.".into());
    }
    if !(5..=120).contains(&settings.after_replace.changed_words_seconds) {
        return Err("La durée des mots changés doit être comprise entre 5 et 120 secondes.".into());
    }
    if settings.servers.is_empty() || settings.servers.len() > MAX_SERVERS {
        return Err(format!("Il faut de 1 à {MAX_SERVERS} serveurs."));
    }
    for (index, server) in settings.servers.iter().enumerate() {
        let id_ok = (1..=32).contains(&server.id.len())
            && server
                .id
                .bytes()
                .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-');
        if !id_ok
            || settings.servers[..index]
                .iter()
                .any(|other| other.id == server.id)
        {
            return Err("L’identifiant d’un serveur est invalide.".into());
        }
        validate_endpoint(&server.endpoint)?;
        // An empty model is allowed: the server is not set up yet (the action then says so).
        if server.model.len() > 200 || server.model.chars().any(char::is_control) {
            return Err("Le modèle d’un serveur est invalide.".into());
        }
        if server.name.chars().count() > 80 || server.name.chars().any(char::is_control) {
            return Err("Le nom d’un serveur est invalide.".into());
        }
        if server.api_key.len() > 4096 || server.api_key.chars().any(char::is_control) {
            return Err("La clé d’un serveur est invalide.".into());
        }
    }
    if !settings
        .servers
        .iter()
        .any(|server| server.id == settings.default_server_id)
    {
        return Err("Le serveur par défaut n’existe pas.".into());
    }
    Ok(())
}

/// An address read as the person typed it (docs/PLAN-0.6.md §1.2; the same rule and the same
/// vectors as `normalizeEndpoint` in src/bridge.mock.ts): `base` is what is stored and shown,
/// `{base}/v1/…` what is called.
#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Endpoint {
    /// Scheme, host, port and path prefix, without `/v1` nor a final slash.
    pub base: String,
    /// Host and port, as shown.
    pub host: String,
    /// The host alone (no port, no brackets): what is resolved.
    #[serde(skip)]
    pub hostname: String,
    #[serde(skip)]
    pub port: u16,
    /// `base` without `https://` (an `http://` stays visible).
    pub display: String,
    pub secure: bool,
    /// This computer (localhost, 127.x.x.x, ::1).
    pub local: bool,
    /// Plain HTTP to another machine: « Connexion non chiffrée ».
    pub insecure: bool,
    /// The address typed differs from `base`.
    pub changed: bool,
    /// The OpenAI suffix that was removed (`/v1`, `/v1/models`…).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub removed: Option<String>,
}
#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum EndpointReason {
    Empty,
    Malformed,
    Scheme,
    Credentials,
}
const SUFFIXES: [&str; 4] = [
    "/v1/chat/completions",
    "/chat/completions",
    "/v1/models",
    "/v1",
];

pub fn is_local_host(host: &url::Host<&str>) -> bool {
    match host {
        url::Host::Domain(name) => {
            name.eq_ignore_ascii_case("localhost")
                || name.to_ascii_lowercase().ends_with(".localhost")
        }
        url::Host::Ipv4(ip) => ip.is_loopback(),
        url::Host::Ipv6(ip) => ip.is_loopback(),
    }
}

pub fn normalize_endpoint(input: &str) -> Result<Endpoint, EndpointReason> {
    let typed: String = input.chars().filter(|c| !c.is_whitespace()).collect();
    if typed.is_empty() {
        return Err(EndpointReason::Empty);
    }
    let has_scheme = typed.split_once("://").is_some_and(|(scheme, _)| {
        let mut chars = scheme.chars();
        chars.next().is_some_and(|c| c.is_ascii_alphabetic())
            && chars.all(|c| c.is_ascii_alphanumeric() || matches!(c, '+' | '.' | '-'))
    });
    let parse = |text: &str| Url::parse(text).map_err(|_| EndpointReason::Malformed);
    let mut url = if has_scheme {
        parse(&typed)?
    } else {
        parse(&format!("https://{typed}"))?
    };
    // A local server (llama.cpp, LM Studio, vLLM on this PC) speaks plain HTTP: no scheme typed
    // for this computer means http://.
    if !has_scheme && url.host().is_some_and(|host| is_local_host(&host)) {
        url = parse(&format!("http://{typed}"))?;
    }
    if !matches!(url.scheme(), "http" | "https") {
        return Err(EndpointReason::Scheme);
    }
    let Some(host) = url.host() else {
        return Err(EndpointReason::Malformed);
    };
    if url.host_str().is_none_or(str::is_empty) {
        return Err(EndpointReason::Malformed);
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err(EndpointReason::Credentials);
    }
    let local = is_local_host(&host);
    let secure = url.scheme() == "https";
    let mut path = url.path().trim_end_matches('/').to_string();
    let before = path.clone();
    loop {
        let lower = path.to_ascii_lowercase();
        let Some(suffix) = SUFFIXES.iter().find(|suffix| lower.ends_with(*suffix)) else {
            break;
        };
        path.truncate(path.len() - suffix.len());
        while path.ends_with('/') {
            path.pop();
        }
    }
    let removed = (path != before).then(|| before[path.len()..].to_string());
    let host_text = match url.port() {
        Some(port) => format!("{}:{port}", url.host_str().unwrap_or_default()),
        None => url.host_str().unwrap_or_default().to_string(),
    };
    let base = format!("{}://{host_text}{path}", url.scheme());
    let hostname = url
        .host_str()
        .unwrap_or_default()
        .trim_start_matches('[')
        .trim_end_matches(']')
        .to_string();
    let cleaned = input.trim().trim_end_matches('/');
    Ok(Endpoint {
        display: base.strip_prefix("https://").unwrap_or(&base).to_string(),
        changed: cleaned != base,
        host: host_text,
        hostname,
        port: url
            .port_or_known_default()
            .unwrap_or(if secure { 443 } else { 80 }),
        secure,
        local,
        insecure: !secure && !local,
        removed,
        base,
    })
}

/// A saved address: empty (nothing set up yet) or one that reads. `http://` is accepted for
/// any host since 0.6 (Lucas, 30/09): the interface warns « Connexion non chiffrée ».
pub fn validate_endpoint(value: &str) -> Result<(), String> {
    if value.trim().is_empty() {
        return Ok(());
    }
    match normalize_endpoint(value) {
        Ok(_) => Ok(()),
        Err(EndpointReason::Credentials) => {
            Err("L’adresse du serveur ne doit pas contenir d’identifiants.".into())
        }
        Err(EndpointReason::Scheme) => {
            Err("L’adresse du serveur doit commencer par https:// ou http://.".into())
        }
        Err(_) => Err("L’adresse du serveur est invalide.".into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::ChangedWordsStyle;

    fn temp_root(name: &str) -> PathBuf {
        let root =
            std::env::temp_dir().join(format!("flowtranslate-{name}-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        root
    }
    fn server(id: &str, endpoint: &str, model: &str, api_key: &str) -> Server {
        Server {
            id: id.into(),
            name: String::new(),
            endpoint: endpoint.into(),
            api_key: api_key.into(),
            no_key: api_key.is_empty(),
            model: model.into(),
        }
    }

    #[test]
    fn legacy_settings_keep_profiles_and_migrate_the_original_shortcut() {
        for shortcut in ["Ctrl+Alt+Y", "Super+T"] {
            let root = temp_root("migration");
            let old = serde_json::json!({
                "targetLanguage": "en", "mode": "fast", "shortcut": shortcut,
                "historyEnabled": true, "autostart": false,
                "profiles": {
                    "fast": {"endpoint": "http://127.0.0.1:8001/v1", "model": "custom-fast", "apiKeyDpapi": ""},
                    "quality": {"endpoint": "https://example.test/v1", "model": "custom-quality", "apiKeyDpapi": ""}
                }
            });
            fs::write(
                root.join("settings.json"),
                serde_json::to_vec(&old).unwrap(),
            )
            .unwrap();
            let store = SettingsStore::new(&root);
            let migrated = store.load().unwrap();
            assert_eq!(migrated.shortcut_bindings[0].shortcut, shortcut);
            assert_eq!(
                migrated.shortcut_bindings[0].enabled,
                shortcut == "Ctrl+Alt+Y"
            );
            assert_eq!(
                migrated.default_action_id, "correct",
                "0.4's own default action was never a choice"
            );
            // A fresh install's five actions, then the French translation the user's own shortcut
            // runs; the English one, as shipped and unused, is gone.
            assert_eq!(
                migrated
                    .actions
                    .iter()
                    .map(|a| a.id.as_str())
                    .collect::<Vec<_>>(),
                [
                    "correct",
                    "translate",
                    "professionalize",
                    "shorten",
                    "email",
                    "translate-fr"
                ]
            );
            assert_eq!(migrated.actions[..5], Settings::default().actions[..]);
            assert_eq!(migrated.shortcut_bindings.len(), 2);
            assert_eq!(
                (
                    migrated.shortcut_bindings[1].kind,
                    migrated.shortcut_bindings[1].shortcut.as_str()
                ),
                (actions::BindingKind::Menu, "Ctrl+Alt+Space")
            );
            // The two profiles become two servers, `quality` first; `mode: fast` chooses the second.
            assert_eq!(
                migrated.servers,
                vec![
                    server("s1", "https://example.test", "custom-quality", ""),
                    server("s2", "http://127.0.0.1:8001", "custom-fast", "")
                ]
            );
            assert_eq!(migrated.default_server_id, "s2");
            assert!(migrated.history_enabled);
            assert!(!fs::read_to_string(root.join("settings.json"))
                .unwrap()
                .contains("targetLanguage"));
            store.save(&migrated).unwrap();
            let restored = store.load().unwrap();
            assert_eq!(restored.actions, migrated.actions);
            assert_eq!(restored.shortcut_bindings, migrated.shortcut_bindings);
            fs::remove_dir_all(root).unwrap();
        }
    }
    #[test]
    fn a_0_3_0_action_list_loses_its_variables_and_keeps_its_ids() {
        let root = temp_root("migration-actions");
        let old = serde_json::json!({
            "targetLanguage": "en", "mode": "fast", "historyEnabled": false, "autostart": false,
            "actions": [
                {"id": "translate", "name": "Traduire", "promptTemplate": "Translate the following text into {{targetLanguage}}. Output only the translated result without any additional explanation:\n{{text}}"},
                {"id": "custom", "name": "Résumer", "promptTemplate": "Résume en une phrase : {{text}}"}
            ],
            "shortcutBindings": [{"id": "primary", "shortcut": "Ctrl+Alt+T", "actionId": "translate", "outputMode": "replace", "enabled": true}],
            "defaultActionId": "translate",
            "profiles": {
                "fast": {"endpoint": "http://127.0.0.1:8001/v1", "model": "custom-fast", "apiKeyDpapi": ""},
                "quality": {"endpoint": "https://example.test/v1", "model": "custom-quality", "apiKeyDpapi": ""}
            }
        });
        fs::write(
            root.join("settings.json"),
            serde_json::to_vec(&old).unwrap(),
        )
        .unwrap();
        let store = SettingsStore::new(&root);
        let migrated = store.load().unwrap();
        let find = |id: &str| migrated.actions.iter().find(|a| a.id == id).unwrap();
        assert_eq!(migrated.default_action_id, "translate");
        assert_eq!(find("translate").prompt_template, "Translate the following text into English. Output only the translated result without any additional explanation:");
        assert_eq!(find("custom").prompt_template, "Résume en une phrase :");
        assert_eq!(migrated.shortcut_bindings[0].action_id, "translate");
        // The 0.3 « translate » keeps its name and its instruction: it takes the grid's T, in the
        // place of a fresh install's, and the user's own action follows the five.
        assert_eq!(
            (
                find("translate").name.as_str(),
                find("translate").key.as_deref()
            ),
            ("Traduire", Some("T"))
        );
        assert_eq!(
            migrated
                .actions
                .iter()
                .map(|a| a.id.as_str())
                .collect::<Vec<_>>(),
            [
                "correct",
                "translate",
                "professionalize",
                "shorten",
                "email",
                "custom"
            ]
        );
        let written = fs::read_to_string(root.join("settings.json")).unwrap();
        assert!(!written.contains("{{text}}") && !written.contains("targetLanguage"));
        fs::remove_dir_all(root).unwrap();
    }
    #[cfg(windows)]
    #[test]
    fn saved_credentials_are_dpapi_encrypted_and_a_server_without_key_keeps_none() {
        let root = temp_root("key");
        let store = SettingsStore::new(&root);
        let value = Settings {
            servers: vec![
                server("s1", "https://llm.exemple.com", "m", "synthetic-test-key"),
                Server {
                    no_key: true,
                    ..server("s2", "http://127.0.0.1:8002", "m", "left-over-key")
                },
            ],
            ..Settings::default()
        };
        store.save(&value).unwrap();
        let written = fs::read_to_string(&store.path).unwrap();
        assert!(!written.contains("synthetic-test-key") && !written.contains("left-over-key"));
        let raw: serde_json::Value = serde_json::from_str(&written).unwrap();
        assert!(raw["servers"][0]["apiKeyDpapi"]
            .as_str()
            .is_some_and(|key| key.len() > 40));
        assert_eq!(raw["servers"][1]["apiKeyDpapi"], "");
        assert!(
            raw.get("profiles").is_none() && raw.get("mode").is_none(),
            "nothing of 0.5 is written again"
        );
        let loaded = store.load().unwrap();
        assert_eq!(loaded.servers[0].api_key, "synthetic-test-key");
        assert_eq!(
            (loaded.servers[1].api_key.as_str(), loaded.servers[1].no_key),
            ("", true)
        );
        fs::remove_dir_all(root).unwrap();
    }

    // ——— Files as 0.5.1 wrote them (src/fixtures/settings-0.5.1.json: a real file's shape, its
    // two profiles and its default one replaced per case). Never Lucas's own data folder. ———
    const FILE_0_5_1: &str = include_str!("fixtures/settings-0.5.1.json");
    fn file_0_5(
        mode: &str,
        quality: (&str, &str, &str),
        fast: (&str, &str, &str),
    ) -> serde_json::Value {
        let mut file: serde_json::Value = serde_json::from_str(FILE_0_5_1).unwrap();
        let profile = |(endpoint, model, key): (&str, &str, &str)| serde_json::json!({ "endpoint": endpoint, "model": model, "apiKeyDpapi": encrypt_key(key).unwrap() });
        file["mode"] = mode.into();
        file["profiles"] =
            serde_json::json!({ "quality": profile(quality), "fast": profile(fast) });
        file
    }
    fn migrate(file: &serde_json::Value) -> (PathBuf, SettingsStore, Settings) {
        let root = temp_root("migration-0-5");
        fs::write(
            root.join("settings.json"),
            serde_json::to_vec_pretty(file).unwrap(),
        )
        .unwrap();
        let store = SettingsStore::new(&root);
        let settings = store.load().unwrap();
        (root, store, settings)
    }
    const FACTORY_QUALITY: (&str, &str, &str) =
        ("http://127.0.0.1:8002/v1", "flowtranslate-quality", "");
    const FACTORY_FAST: (&str, &str, &str) = ("http://127.0.0.1:8001/v1", "flowtranslate-fast", "");

    #[test]
    fn the_fixture_is_a_0_5_1_file_and_0_6_still_reads_everything_else_of_it() {
        let file: serde_json::Value = serde_json::from_str(FILE_0_5_1).unwrap();
        for key in [
            "mode",
            "profiles",
            "connectionExpanded",
            "menuActionIds",
            "uiVersion",
            "afterReplace",
        ] {
            assert!(file.get(key).is_some(), "{key}");
        }
        assert!(file.get("servers").is_none() && file.get("setupDone").is_none());
        let (root, _, migrated) = migrate(&file);
        assert_eq!(
            (migrated.language, migrated.theme, migrated.text_size),
            (
                crate::types::Language::Fr,
                crate::types::Theme::Dark,
                crate::types::TextSize::Large
            )
        );
        assert!(migrated.history_enabled && migrated.autostart);
        assert_eq!(migrated.after_replace.undo_seconds, 12);
        assert_eq!(
            migrated.shortcut_bindings[0].shortcut,
            "Ctrl+Alt+Shift+Space"
        );
        assert_eq!(migrated.changed_words_style, ChangedWordsStyle::Encre);
        // The material was a hidden trial until 0.5.1: its `painted` was never chosen.
        assert_eq!(file["glassMaterial"], "painted");
        assert_eq!(migrated.glass_material, crate::types::GlassMaterial::Glass);
        fs::remove_dir_all(root).unwrap();
        // In a 0.6 file the choice is kept, and the trial's `acrylic` reads as the real glass.
        let read =
            |value: &str| serde_json::from_str::<crate::types::GlassMaterial>(value).unwrap();
        assert_eq!(
            (read("\"painted\""), read("\"glass\""), read("\"acrylic\"")),
            (
                crate::types::GlassMaterial::Painted,
                crate::types::GlassMaterial::Glass,
                crate::types::GlassMaterial::Glass
            )
        );
        assert_eq!(
            serde_json::to_string(&crate::types::GlassMaterial::Glass).unwrap(),
            "\"glass\""
        );
    }
    #[cfg(windows)]
    #[test]
    fn a_0_5_file_with_two_distinct_profiles_becomes_two_servers_keys_included() {
        let file = file_0_5(
            "quality",
            (
                "https://llm.exemple.com/v1",
                "gemma-4-12b",
                "sk-synthetic-quality-3f2a",
            ),
            ("http://127.0.0.1:8001/v1/", "qwen3-8b", ""),
        );
        let (root, store, migrated) = migrate(&file);
        assert_eq!(
            migrated.servers,
            vec![
                server(
                    "s1",
                    "https://llm.exemple.com",
                    "gemma-4-12b",
                    "sk-synthetic-quality-3f2a"
                ),
                server("s2", "http://127.0.0.1:8001", "qwen3-8b", ""),
            ]
        );
        assert!(
            !migrated.servers[0].no_key && migrated.servers[1].no_key,
            "an empty key on a profile set up: the server has none"
        );
        assert_eq!(migrated.default_server_id, "s1");
        assert!(
            migrated.setup_done,
            "a 0.5 user already set up does not see the setup again"
        );
        // Written once as 0.6: no profile left, the key still encrypted, the same settings read back.
        let written = fs::read_to_string(root.join("settings.json")).unwrap();
        assert!(
            !written.contains("sk-synthetic")
                && !written.contains("\"profiles\"")
                && !written.contains("\"mode\"")
                && !written.contains("connectionExpanded")
        );
        assert!(written.contains("\"servers\"") && written.contains("\"setupDone\": true"));
        assert_eq!(store.load().unwrap(), migrated);
        // The 0.5 file stays beside it, byte for byte, and is never overwritten by a later load.
        let backup = fs::read(store.backup_path()).unwrap();
        assert_eq!(
            serde_json::from_slice::<serde_json::Value>(&backup).unwrap(),
            file
        );
        fs::write(store.backup_path(), b"kept").unwrap();
        let mut again = file.clone();
        again["mode"] = "fast".into();
        fs::write(
            root.join("settings.json"),
            serde_json::to_vec(&again).unwrap(),
        )
        .unwrap();
        assert_eq!(
            store.load().unwrap().default_server_id,
            "s2",
            "mode fast: the server that came from `fast`"
        );
        assert_eq!(fs::read(store.backup_path()).unwrap(), b"kept");
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn a_0_5_file_whose_profiles_are_the_same_server_becomes_one() {
        // The same address written two ways, the same model, no key: one server.
        let (root, _, migrated) = migrate(&file_0_5(
            "fast",
            ("http://192.168.1.20:8000/v1", "gemma", ""),
            ("http://192.168.1.20:8000/v1/", "gemma", ""),
        ));
        assert_eq!(
            migrated.servers,
            vec![server("s1", "http://192.168.1.20:8000", "gemma", "")]
        );
        assert_eq!(
            (migrated.default_server_id.as_str(), migrated.setup_done),
            ("s1", true)
        );
        fs::remove_dir_all(root).unwrap();
        // The same address with another model is another server.
        let (root, _, migrated) = migrate(&file_0_5(
            "fast",
            ("https://llm.exemple.com/v1", "big", ""),
            ("https://llm.exemple.com/v1", "small", ""),
        ));
        assert_eq!(
            migrated
                .servers
                .iter()
                .map(|s| (s.id.as_str(), s.model.as_str()))
                .collect::<Vec<_>>(),
            [("s1", "big"), ("s2", "small")]
        );
        assert_eq!(migrated.default_server_id, "s2");
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn a_0_5_file_left_on_its_factory_profiles_starts_empty_and_sees_the_setup() {
        // The repository's own server running on this machine is kept (see the next test): this
        // one is about a machine where nothing listens there.
        let serving = |address: &str| {
            normalize_endpoint(address).is_ok_and(|endpoint| local_server_listens(&endpoint))
        };
        if serving(FACTORY_QUALITY.0) || serving(FACTORY_FAST.0) {
            return;
        }
        let (root, store, migrated) = migrate(&file_0_5("fast", FACTORY_QUALITY, FACTORY_FAST));
        assert_eq!(
            migrated.servers,
            vec![Server {
                id: "s1".into(),
                ..Server::default()
            }]
        );
        assert_eq!(
            (migrated.default_server_id.as_str(), migrated.setup_done),
            ("s1", false)
        );
        assert!(store.backup_path().exists());
        assert_eq!(store.load().unwrap(), migrated);
        fs::remove_dir_all(root).unwrap();
        // Only `fast` was set up: it is the one server, whatever the default mode was.
        let (root, _, migrated) = migrate(&file_0_5(
            "quality",
            FACTORY_QUALITY,
            ("https://llm.exemple.com/v1", "small", ""),
        ));
        assert_eq!(
            migrated.servers,
            vec![server("s1", "https://llm.exemple.com", "small", "")]
        );
        assert_eq!(
            (migrated.default_server_id.as_str(), migrated.setup_done),
            ("s1", true)
        );
        fs::remove_dir_all(root).unwrap();
        // A factory address with the user's own model is a server set up.
        let (root, _, migrated) = migrate(&file_0_5(
            "quality",
            ("http://127.0.0.1:8002/v1", "my-model", ""),
            FACTORY_FAST,
        ));
        assert_eq!(
            migrated.servers,
            vec![server("s1", "http://127.0.0.1:8002", "my-model", "")]
        );
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn the_profiles_of_0_5_turn_into_servers_by_one_rule() {
        let profiles = |quality: (&str, &str, &str), fast: (&str, &str, &str)| {
            HashMap::from([
                (
                    "quality".to_string(),
                    (
                        quality.0.to_string(),
                        quality.1.to_string(),
                        quality.2.to_string(),
                    ),
                ),
                (
                    "fast".to_string(),
                    (fast.0.to_string(), fast.1.to_string(), fast.2.to_string()),
                ),
            ])
        };
        // Same address and model, another key: two servers.
        let nothing = |_: &Endpoint| false;
        let (servers, default, done) = servers_from_profiles(
            &profiles(
                ("https://a.test/v1", "m", "key-one"),
                ("https://a.test/v1", "m", "key-two"),
            ),
            Some("quality"),
            nothing,
        );
        assert_eq!((servers.len(), default.as_str(), done), (2, "s1", true));
        // An address that no longer reads is not a server set up; an empty one neither.
        let (servers, _, done) = servers_from_profiles(
            &profiles(("ftp://a.test", "m", ""), ("", "m", "")),
            Some("fast"),
            nothing,
        );
        assert_eq!(
            (servers, done),
            (
                vec![Server {
                    id: "s1".into(),
                    ..Server::default()
                }],
                false
            )
        );
        // No profile at all (a damaged file): one empty server.
        assert_eq!(
            servers_from_profiles(&HashMap::new(), None, nothing)
                .0
                .len(),
            1
        );
        // The factory profiles: dropped when nothing listens there, kept when the repository's
        // own server does (its address and its model stay; the setup still shows and checks).
        let factory = profiles(FACTORY_QUALITY, FACTORY_FAST);
        let (servers, _, done) = servers_from_profiles(&factory, Some("fast"), nothing);
        assert_eq!(
            (servers, done),
            (
                vec![Server {
                    id: "s1".into(),
                    ..Server::default()
                }],
                false
            )
        );
        let (servers, default, done) =
            servers_from_profiles(&factory, Some("fast"), |endpoint| endpoint.local);
        assert_eq!(
            servers,
            vec![
                server(
                    "s1",
                    FACTORY_QUALITY.0.trim_end_matches("/v1"),
                    FACTORY_QUALITY.1,
                    ""
                ),
                server(
                    "s2",
                    FACTORY_FAST.0.trim_end_matches("/v1"),
                    FACTORY_FAST.1,
                    ""
                )
            ]
        );
        assert_eq!(
            (default.as_str(), done),
            ("s2", false),
            "the default profile stays the default server, the setup still shows"
        );
        // Only one of them answers: that one alone; beside a server somebody set up, the setup is done.
        let (servers, _, _) =
            servers_from_profiles(&factory, None, |endpoint| endpoint.port == 8001);
        assert_eq!(servers.len(), 1);
        let (servers, _, done) = servers_from_profiles(
            &profiles(("https://a.test/v1", "m", ""), FACTORY_FAST),
            None,
            |endpoint| endpoint.local,
        );
        assert_eq!((servers.len(), done), (2, true));
        // Never another machine: only this computer is asked.
        assert!(!local_server_listens(
            &normalize_endpoint("https://exemple.invalid").unwrap()
        ));
        assert!(factory_profile(
            "http://127.0.0.1:8001/v1/",
            " flowtranslate-quality ",
            ""
        ));
        assert!(!factory_profile(
            "http://127.0.0.1:8001/v1",
            "flowtranslate-fast",
            "a-key"
        ));
    }

    /// A settings file as 0.4.0 writes it (four actions, one custom, two shortcuts).
    fn settings_0_4(bindings: serde_json::Value) -> serde_json::Value {
        let rules = actions::OUTPUT_RULES;
        serde_json::json!({
            "mode": "quality",
            "actions": [
                {"id": "translate-fr", "name": "Traduire en français", "promptTemplate": format!("You are a professional translator. Translate the text into French. Detect the source language yourself; if the text is already in French, return it unchanged. Keep names, numbers, formatting and tone.\n\n{rules}")},
                {"id": "translate-en", "name": "Traduire en anglais", "promptTemplate": format!("You are a professional translator. Translate the text into English.\n\n{rules}")},
                {"id": "correct", "name": "Corriger", "promptTemplate": "Corrige les fautes, rien d’autre."},
                {"id": "professionalize", "name": "Professionnaliser", "promptTemplate": format!("You are an editor.\n\n{rules}")},
                {"id": "action-1726412345678", "name": "Résumer", "promptTemplate": "Résume le texte en une phrase."}
            ],
            "shortcutBindings": bindings,
            "defaultActionId": "translate-fr",
            "historyEnabled": true, "autostart": true, "connectionExpanded": true,
            "textSize": "large", "autoClose": "slow",
            "profiles": {
                "fast": {"endpoint": "http://127.0.0.1:8001/v1", "model": "custom-fast", "apiKeyDpapi": ""},
                "quality": {"endpoint": "http://127.0.0.1:8002/v1", "model": "custom-quality", "apiKeyDpapi": ""}
            }
        })
    }
    #[test]
    fn a_0_4_file_gains_the_ilot_and_keeps_what_the_user_changed_or_created() {
        let root = temp_root("migration-ilot");
        let old = settings_0_4(serde_json::json!([
            {"id": "primary", "shortcut": "Ctrl+Alt+T", "actionId": "translate-fr", "outputMode": "display", "enabled": true},
            {"id": "binding-1726412399999", "shortcut": "Ctrl+Alt+R", "actionId": "action-1726412345678", "outputMode": "replace", "enabled": false}
        ]));
        fs::write(
            root.join("settings.json"),
            serde_json::to_vec_pretty(&old).unwrap(),
        )
        .unwrap();
        let store = SettingsStore::new(&root);
        let migrated = store.load().unwrap();
        // Lucas, 24/09: what 0.4 shipped untouched gives way to a fresh install's (« Traduire en
        // français » and its Ctrl+Alt+T); what the user changed or created is neither renamed nor
        // rewritten, a shipped id gets its icon, and « Professionnaliser » the short name « Pro »
        // (review of da-ilot, n°9).
        assert_eq!(
            migrated
                .actions
                .iter()
                .map(|a| a.id.as_str())
                .collect::<Vec<_>>(),
            [
                "correct",
                "translate",
                "professionalize",
                "shorten",
                "email",
                "translate-en",
                "action-1726412345678"
            ]
        );
        let before: Vec<ActionDefinition> = serde_json::from_value(old["actions"].clone()).unwrap();
        let looks = [
            ("correct", None, Some("SpellCheck")),
            ("professionalize", Some("Pro"), Some("BriefcaseBusiness")),
            ("translate-en", None, Some("Languages")),
            ("action-1726412345678", None, None),
        ];
        for (id, short, icon) in looks {
            let kept = migrated.actions.iter().find(|a| a.id == id).unwrap();
            let original = before.iter().find(|a| a.id == id).unwrap();
            assert_eq!(
                (&kept.name, &kept.prompt_template),
                (&original.name, &original.prompt_template),
                "{id}"
            );
            assert_eq!(
                (kept.short_name.as_deref(), kept.icon.as_deref()),
                (short, icon),
                "{id}"
            );
        }
        let fresh = Settings::default().actions;
        for id in ["translate", "shorten", "email"] {
            assert_eq!(
                migrated.actions.iter().find(|a| a.id == id),
                fresh.iter().find(|a| a.id == id)
            );
        }
        let key = |id: &str| {
            migrated
                .actions
                .iter()
                .find(|a| a.id == id)
                .unwrap()
                .key
                .clone()
        };
        assert_eq!(
            [
                "correct",
                "translate",
                "professionalize",
                "shorten",
                "email"
            ]
            .map(key),
            ["F", "T", "P", "S", "E"].map(|k| Some(k.to_string()))
        );
        assert_eq!(
            (key("translate-en"), key("action-1726412345678")),
            (None, None)
        );
        assert_eq!(
            migrated.menu_action_ids,
            [
                "correct",
                "translate",
                "professionalize",
                "shorten",
                "email"
            ]
        );
        let before: Vec<ShortcutBinding> =
            serde_json::from_value(old["shortcutBindings"].clone()).unwrap();
        assert_eq!(
            migrated.shortcut_bindings.len(),
            2,
            "Ctrl+Alt+T, as 0.4 shipped it, is gone"
        );
        assert_eq!(
            migrated.shortcut_bindings[0], before[1],
            "the user's own shortcut stays, disabled"
        );
        assert_eq!(
            migrated.shortcut_bindings[1],
            ShortcutBinding {
                id: "menu".into(),
                kind: actions::BindingKind::Menu,
                shortcut: "Ctrl+Alt+Space".into(),
                action_id: "correct".into(),
                output_mode: actions::OutputMode::Replace,
                enabled: true
            }
        );
        assert_eq!(migrated.default_action_id, "correct");
        assert_eq!(
            migrated.ui_version,
            crate::types::UiVersion::Ilot,
            "0.5.0 opens the Îlot, its menu binding included"
        );
        assert!(migrated.history_enabled && migrated.autostart);
        assert_eq!(
            (migrated.text_size, migrated.auto_close),
            (crate::types::TextSize::Large, crate::types::AutoClose::Slow)
        );
        assert_eq!(
            migrated
                .servers
                .iter()
                .map(|s| s.model.as_str())
                .collect::<Vec<_>>(),
            ["custom-quality", "custom-fast"]
        );
        // Written once: the next load reads the same settings and migrates nothing more.
        let written: serde_json::Value =
            serde_json::from_slice(&fs::read(root.join("settings.json")).unwrap()).unwrap();
        assert_eq!(
            written["menuActionIds"],
            serde_json::json!([
                "correct",
                "translate",
                "professionalize",
                "shorten",
                "email"
            ])
        );
        assert_eq!(store.load().unwrap(), migrated);
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn a_0_4_file_that_already_uses_ctrl_alt_space_gets_no_second_binding_on_it() {
        let root = temp_root("migration-ilot");
        let old = settings_0_4(serde_json::json!([
            {"id": "primary", "shortcut": "Control+Alt+Space", "actionId": "translate-en", "outputMode": "display", "enabled": false}
        ]));
        fs::write(
            root.join("settings.json"),
            serde_json::to_vec(&old).unwrap(),
        )
        .unwrap();
        let migrated = SettingsStore::new(&root).load().unwrap();
        assert_eq!(
            migrated.shortcut_bindings.len(),
            1,
            "the user's own binding keeps the chord, even disabled"
        );
        assert_eq!(migrated.shortcut_bindings[0].action_id, "translate-en");
        assert_eq!(migrated.menu_action_ids.len(), 5);
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn an_untouched_0_4_file_updates_like_a_fresh_install_and_keeps_the_rest() {
        // Lucas's own update (24/09): 0.4 as shipped, only the connection and a few choices changed.
        let root = temp_root("migration-ilot");
        let mut old = settings_0_4(serde_json::json!([
            {"id": "primary", "shortcut": "Ctrl+Alt+T", "actionId": "translate-fr", "outputMode": "display", "enabled": true}
        ]));
        old["actions"] = serde_json::to_value(actions::legacy_defaults()).unwrap();
        fs::write(
            root.join("settings.json"),
            serde_json::to_vec(&old).unwrap(),
        )
        .unwrap();
        let migrated = SettingsStore::new(&root).load().unwrap();
        let fresh = Settings::default();
        assert_eq!(
            migrated.actions, fresh.actions,
            "no French action beside the English ones"
        );
        assert_eq!(
            migrated.shortcut_bindings, fresh.shortcut_bindings,
            "no Ctrl+Alt+T showing the result"
        );
        assert_eq!(
            (
                &migrated.menu_action_ids,
                migrated.default_action_id.as_str()
            ),
            (&fresh.menu_action_ids, "correct")
        );
        assert_eq!(
            (migrated.text_size, migrated.auto_close),
            (crate::types::TextSize::Large, crate::types::AutoClose::Slow)
        );
        assert!(migrated.history_enabled && migrated.autostart);
        assert_eq!(migrated.default_server().model, "custom-quality");
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn restoring_the_defaults_keeps_only_what_sets_this_device_up() {
        use crate::types::{Language, TextSize, Theme, UiVersion};
        let mut current = Settings::default();
        current.actions.push(ActionDefinition {
            id: "custom".into(),
            name: "Résumer".into(),
            prompt_template: "Résume.".into(),
            key: None,
            short_name: None,
            icon: None,
        });
        current.shortcut_bindings[0].shortcut = "Ctrl+Alt+Shift+Space".into();
        current.menu_action_ids = vec!["custom".into()];
        current.default_action_id = "custom".into();
        (
            current.text_size,
            current.theme,
            current.ui_version,
            current.changed_words_style,
        ) = (
            TextSize::Large,
            Theme::Dark,
            UiVersion::V4,
            ChangedWordsStyle::Eclat,
        );
        (
            current.history_enabled,
            current.autostart,
            current.language,
            current.setup_done,
        ) = (true, true, Language::Fr, true);
        current.servers = vec![
            server(
                "s1",
                "https://llm.exemple.com",
                "custom-quality",
                "synthetic-test-key",
            ),
            server("s2", "http://127.0.0.1:8001", "small", ""),
        ];
        current.default_server_id = "s2".into();
        let fresh = reset(&current);
        assert_eq!(
            fresh,
            Settings {
                history_enabled: true,
                autostart: true,
                language: Language::Fr,
                setup_done: true,
                servers: current.servers.clone(),
                default_server_id: "s2".into(),
                ..Settings::default()
            }
        );
        assert!(validate(&fresh).is_ok());
        // Windows refused Ctrl+Alt+Space: the menu keeps its chord, everything else is restored.
        let kept = keep_menu_chord(&fresh, &current).unwrap();
        assert_eq!(kept.shortcut_bindings[0].shortcut, "Ctrl+Alt+Shift+Space");
        assert_eq!(
            Settings {
                shortcut_bindings: fresh.shortcut_bindings.clone(),
                ..kept.clone()
            },
            fresh
        );
        // Already on the default chord (or with no menu shortcut on), the refusal stands.
        current.shortcut_bindings[0].shortcut = "Control+Alt+Space".into();
        assert_eq!(keep_menu_chord(&fresh, &current), None);
        current.shortcut_bindings[0] = ShortcutBinding {
            shortcut: "Ctrl+Alt+Y".into(),
            enabled: false,
            ..current.shortcut_bindings[0].clone()
        };
        assert_eq!(keep_menu_chord(&fresh, &current), None);
    }
    #[test]
    fn the_after_replace_durations_stay_in_their_bounds() {
        let mut settings = Settings::default();
        assert_eq!(
            settings.after_replace.changed_words_seconds, 60,
            "the marks last a minute at most by default"
        );
        assert!(validate(&settings).is_ok());
        for (undo, words, valid) in [
            (2, 5, true),
            (20, 120, true),
            (1, 60, false),
            (21, 60, false),
            (8, 4, false),
            (8, 121, false),
        ] {
            settings.after_replace.undo_seconds = undo;
            settings.after_replace.changed_words_seconds = words;
            assert_eq!(validate(&settings).is_ok(), valid, "{undo} s, {words} s");
        }
        // A file written before the marks had their own duration gets the default.
        let raw = serde_json::json!({ "check": true, "undo": false, "undoSeconds": 8, "changedWords": true });
        let after: crate::types::AfterReplace = serde_json::from_value(raw).unwrap();
        assert_eq!((after.undo, after.changed_words_seconds), (false, 60));
    }

    #[derive(Deserialize)]
    struct Vectors {
        valid: Vec<serde_json::Value>,
        invalid: Vec<serde_json::Value>,
    }
    #[test]
    fn an_address_is_read_the_same_way_as_in_the_interface() {
        // The vectors the frontend tests read too (src/bridge.test.ts).
        let vectors: Vectors =
            serde_json::from_str(include_str!("../../src/connection/endpoint.vectors.json"))
                .unwrap();
        assert!(vectors.valid.len() >= 20 && vectors.invalid.len() >= 8);
        for mut expected in vectors.valid {
            let input = expected.as_object_mut().unwrap().remove("input").unwrap();
            let endpoint = normalize_endpoint(input.as_str().unwrap())
                .unwrap_or_else(|reason| panic!("{input}: {reason:?}"));
            assert_eq!(
                serde_json::to_value(&endpoint).unwrap(),
                expected,
                "{input}"
            );
            // What is stored reads back as itself.
            let again = normalize_endpoint(&endpoint.base).unwrap();
            assert_eq!(
                (again.base.as_str(), again.changed, &again.removed),
                (endpoint.base.as_str(), false, &None),
                "{input}"
            );
        }
        for case in vectors.invalid {
            let reason = normalize_endpoint(case["input"].as_str().unwrap())
                .expect_err(&case["input"].to_string());
            assert_eq!(
                serde_json::to_value(reason).unwrap(),
                case["reason"],
                "{}",
                case["input"]
            );
        }
        // What the probe resolves and connects to.
        let local = normalize_endpoint("http://[::1]:8080/v1").unwrap();
        assert_eq!((local.hostname.as_str(), local.port), ("::1", 8080));
        assert_eq!(normalize_endpoint("llm.exemple.com").unwrap().port, 443);
        assert_eq!(
            normalize_endpoint("http://llm.exemple.com").unwrap().port,
            80
        );
    }
    #[test]
    fn endpoint_guards() {
        assert!(validate_endpoint("").is_ok(), "nothing set up yet");
        assert!(validate_endpoint("http://127.0.0.1:8001").is_ok());
        assert!(validate_endpoint("http://[::1]:8001").is_ok());
        assert!(validate_endpoint("https://translate.example.test").is_ok());
        assert!(validate_endpoint("http://127.0.0.1:8001/v1").is_ok());
        // Since 0.6 http:// is accepted for any host (the interface warns), and a path prefix too.
        assert!(validate_endpoint("http://translate.example.test").is_ok());
        assert!(validate_endpoint("https://translate.example.test/openai").is_ok());
        assert!(validate_endpoint("https://user:secret@example.test").is_err());
        assert!(validate_endpoint("file:///tmp/socket").is_err());
        assert!(validate_endpoint("https://").is_err());
    }
    #[test]
    fn the_servers_are_validated_and_what_is_saved_is_clean() {
        let with = |servers: Vec<Server>, default: &str| Settings {
            servers,
            default_server_id: default.into(),
            ..Settings::default()
        };
        assert!(
            validate(&Settings::default()).is_ok(),
            "one empty server: a fresh install"
        );
        assert!(validate(&with(vec![], "s1")).is_err());
        assert!(
            validate(&with(
                (0..9)
                    .map(|n| server(&format!("s{n}"), "", "", ""))
                    .collect(),
                "s0"
            ))
            .is_err(),
            "eight at most"
        );
        assert!(validate(&with(
            (0..8)
                .map(|n| server(&format!("s{n}"), "", "", ""))
                .collect(),
            "s7"
        ))
        .is_ok());
        assert!(
            validate(&with(
                vec![server("s1", "", "", ""), server("s1", "", "", "")],
                "s1"
            ))
            .is_err(),
            "unique ids"
        );
        for id in ["", "S1", "s 1", "../x", "s_1", &"a".repeat(33)] {
            assert!(
                validate(&with(vec![server(id, "", "", "")], id)).is_err(),
                "{id:?}"
            );
        }
        assert!(validate(&with(vec![server("serveur-2", "", "", "")], "serveur-2")).is_ok());
        assert!(
            validate(&with(vec![server("s1", "", "", "")], "s2")).is_err(),
            "the default server exists"
        );
        assert!(validate(&with(vec![server("s1", "ftp://x", "", "")], "s1")).is_err());
        assert!(validate(&with(vec![server("s1", "", &"m".repeat(201), "")], "s1")).is_err());
        assert!(validate(&with(vec![server("s1", "", "a\nb", "")], "s1")).is_err());
        assert!(validate(&with(
            vec![server("s1", "", "", "key\r\nInjected: header")],
            "s1"
        ))
        .is_err());
        assert!(validate(&with(vec![server("s1", "", "", &"k".repeat(4097))], "s1")).is_err());
        assert!(validate(&with(
            vec![Server {
                name: "n".repeat(81),
                ..server("s1", "", "", "")
            }],
            "s1"
        ))
        .is_err());
        // Saved clean: the address normalised, the model trimmed, no key for a server without one.
        let mut settings = with(
            vec![
                Server {
                    no_key: true,
                    ..server("s1", " llm.exemple.com/v1/ ", "  gemma  ", "left-over")
                },
                server("s2", "   ", "", ""),
                server("s3", "http://", "", ""),
            ],
            "s1",
        );
        sanitize(&mut settings);
        assert_eq!(
            settings.servers[0],
            Server {
                no_key: true,
                ..server("s1", "https://llm.exemple.com", "gemma", "")
            }
        );
        assert_eq!(settings.servers[1].endpoint, "");
        assert_eq!(
            settings.servers[2].endpoint, "http://",
            "left as typed: refused by validate"
        );
        assert!(validate(&settings).is_err());
    }
    #[test]
    fn settings_can_be_replaced_and_loaded() {
        let root = temp_root("settings-test");
        let store = SettingsStore::new(&root);
        assert!(!store.exists());
        let mut value = Settings::default();
        store.save(&value).unwrap();
        assert!(store.exists());
        value
            .servers
            .push(server("s2", "http://127.0.0.1:8001", "small", ""));
        value.default_server_id = "s2".into();
        value.setup_done = true;
        value.changed_words_style = ChangedWordsStyle::Eclat;
        value.text_size = crate::types::TextSize::Large;
        value.auto_close = crate::types::AutoClose::Never;
        value.ui_version = crate::types::UiVersion::Ilot;
        store.save(&value).unwrap();
        let loaded = store.load().unwrap();
        assert_eq!(loaded, value);
        assert!(
            !store.backup_path().exists(),
            "a 0.6 file is not a migration"
        );
        // A 0.6 file written before a field existed gets its default.
        let mut raw: serde_json::Value =
            serde_json::from_slice(&fs::read(root.join("settings.json")).unwrap()).unwrap();
        for key in ["changedWordsStyle", "setupDone", "defaultServerId"] {
            raw.as_object_mut().unwrap().remove(key);
        }
        fs::write(
            root.join("settings.json"),
            serde_json::to_vec(&raw).unwrap(),
        )
        .unwrap();
        let loaded = store.load().unwrap();
        assert_eq!(
            (
                loaded.changed_words_style,
                loaded.setup_done,
                loaded.default_server_id.as_str()
            ),
            (ChangedWordsStyle::Encre, false, "s1")
        );
        let _ = std::fs::remove_dir_all(root);
    }
    #[test]
    fn a_0_4_settings_file_without_the_ui_switch_opens_the_ilot_and_v4_stays_reachable() {
        let root = temp_root("settings-test");
        let store = SettingsStore::new(&root);
        store.save(&Settings::default()).unwrap();
        let path = root.join("settings.json");
        let mut raw: serde_json::Value =
            serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
        raw.as_object_mut().unwrap().remove("uiVersion");
        std::fs::write(&path, serde_json::to_vec(&raw).unwrap()).unwrap();
        assert_eq!(
            store.load().unwrap().ui_version,
            crate::types::UiVersion::Ilot
        );
        raw.as_object_mut()
            .unwrap()
            .insert("uiVersion".into(), "v4".into());
        std::fs::write(&path, serde_json::to_vec(&raw).unwrap()).unwrap();
        assert_eq!(
            store.load().unwrap().ui_version,
            crate::types::UiVersion::V4
        );
        let _ = std::fs::remove_dir_all(root);
    }
    #[test]
    fn an_empty_action_list_is_refused_instead_of_panicking() {
        // `actions[0]` used to panic before `validate` had a chance to say no.
        let root = temp_root("actions-vides");
        let store = SettingsStore::new(&root);
        store.save(&Settings::default()).unwrap();
        let path = root.join("settings.json");
        let mut raw: serde_json::Value =
            serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
        raw["actions"] = serde_json::json!([]);
        std::fs::write(&path, serde_json::to_vec(&raw).unwrap()).unwrap();
        assert!(store.load().is_err());
        let _ = std::fs::remove_dir_all(root);
    }
    /// A saved default file, changed by `edit`, then loaded with recovery.
    fn recover_after(name: &str, edit: impl FnOnce(&mut serde_json::Value) -> Vec<u8>) {
        let root = temp_root(name);
        let store = SettingsStore::new(&root);
        let saved = Settings {
            setup_done: true,
            ..Settings::default()
        };
        store.save(&saved).unwrap();
        let path = root.join("settings.json");
        let mut raw: serde_json::Value =
            serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
        let broken = edit(&mut raw);
        std::fs::write(&path, &broken).unwrap();
        let (settings, backup) = store.load_or_recover().unwrap();
        assert_eq!(settings, Settings::default());
        assert!(!settings.setup_done, "l’accueil doit se relancer");
        let backup = backup.expect("une sauvegarde est annoncée");
        assert!(backup.starts_with("settings.illisible-") && backup.ends_with(".json"));
        assert!(!backup.contains(['/', '\\']));
        // The original is kept, byte for byte, and settings.json is gone (first launch again).
        assert_eq!(std::fs::read(root.join(&backup)).unwrap(), broken);
        assert!(!path.exists());
        let _ = std::fs::remove_dir_all(root);
    }
    #[test]
    fn an_access_error_is_not_a_corruption() {
        // A folder named settings.json: it exists but cannot be read as a file.
        let root = temp_root("acces");
        let path = root.join("settings.json");
        fs::create_dir_all(&path).unwrap();
        let store = SettingsStore::new(&root);
        assert!(store.load().is_err());
        assert!(store.load_or_recover().is_err());
        let names: Vec<String> = fs::read_dir(&root)
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        assert_eq!(
            names,
            vec!["settings.json".to_string()],
            "rien n’est renommé ni créé"
        );
        assert!(path.is_dir());
        let _ = fs::remove_dir_all(root);
    }
    #[test]
    fn invalid_json_is_set_aside_and_the_defaults_load() {
        recover_after("recup-json", |_| b"{ pas du json".to_vec());
    }
    #[test]
    fn an_empty_action_list_is_set_aside_and_the_defaults_load() {
        recover_after("recup-actions", |raw| {
            raw["actions"] = serde_json::json!([]);
            serde_json::to_vec(raw).unwrap()
        });
    }
    #[test]
    fn refused_values_are_set_aside_and_the_defaults_load() {
        recover_after("recup-validation", |raw| {
            raw["afterReplace"]["undoSeconds"] = serde_json::json!(999);
            serde_json::to_vec(raw).unwrap()
        });
    }
    #[test]
    fn readable_or_missing_settings_are_not_recovered() {
        let root = temp_root("recup-rien");
        let store = SettingsStore::new(&root);
        assert_eq!(store.load_or_recover().unwrap().1, None);
        store.save(&Settings::default()).unwrap();
        assert_eq!(store.load_or_recover().unwrap().1, None);
        assert!(root.join("settings.json").exists());
        let _ = std::fs::remove_dir_all(root);
    }
}
