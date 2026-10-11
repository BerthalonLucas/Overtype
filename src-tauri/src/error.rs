//! Error codes (« Îlot », lot 10 of docs/DA-PLAN.md): what failed, as a code the frontend
//! turns into a short text in the interface language and one gesture: open the exact field
//! of the Settings, Try again, or Copy the result. The French message of 0.4 travels beside
//! it for the glass of a direct shortcut. Neither ever carries the server's answer, a key, a URL path or any
//! text of the user: the server's body only serves to classify, here, and goes no further.
use serde::{Deserialize, Serialize};

/// Serialized in snake_case (`model_not_found`); the frontend keeps the same list
/// (src/result/errors.ts) and reads any code it does not know as `internal`.
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum ErrorKind {
    /// Nothing answers at the address (connection refused, unknown host, TLS, connect timeout).
    Unreachable,
    /// The server accepted the connection, then stopped answering in time.
    Timeout,
    /// 401 or 403: the key.
    Unauthorized,
    /// A 404 whose body speaks of the model, or a model the server does not list.
    ModelNotFound,
    /// Any other 404, a redirect, an invalid address, an answer that is not an OpenAI API.
    BadEndpoint,
    /// 429 or 503.
    Busy,
    /// The answer reached the token limit: never pasted.
    Length,
    /// The stream broke off or could not be read.
    StreamBroken,
    /// The paste did not happen (Windows or the application refused it, the clipboard was
    /// busy, the source could not be brought back).
    PasteBlocked,
    /// The selection, the field or the window changed: nothing was replaced.
    TargetChanged,
    /// UI Automation no longer answers for the captured selection (no focused element, no
    /// runtime id, a selection it cannot read): nothing proves it is still there, so nothing was
    /// replaced (NATIVE-001). The result exists: Copy result.
    TargetUnverified,
    /// The field cannot be written (read-only, a console, a copy without a known selection).
    NotEditable,
    /// The paste went out and changed nothing: the text is read-only (a PDF in a browser).
    /// The result exists and was not written: Copy result.
    ReadOnly,
    /// The window in front runs as administrator while we do not: Windows lets us neither
    /// read its text nor send it a key (a capture notice, and a refusal of the paste).
    ProtectedWindow,
    /// Over 200,000 characters (capture::MAX_CHARS).
    TooLong,
    /// Cancelled by the user or replaced by a newer request.
    Cancelled,
    /// Any other status (5xx, 400…), or a generation the server ended for another reason.
    ServerError,
    /// Nothing selected to act on.
    NoSelection,
    /// A password field: never read, never written.
    ProtectedField,
    /// The shortcut keys were still held when the paste or the undo had to type.
    KeysHeld,
    /// A shortcut pressed while the Settings window is in front: nothing of another
    /// application is selected (a capture notice).
    SettingsOpen,
    /// The same press while the first-run setup or its demo is in front (0.6): its own words
    /// (« Close Settings first » pointed at a window that was not on screen).
    SetupOpen,
    /// The tray's « Revoir la dernière traduction » with no result of the last ten minutes.
    NothingRecent,
    /// The clipboard holds what cannot be kept whole (the picture beside an Office copy, a
    /// format its owner renders): nothing was copied or pasted over it, nothing was lost
    /// (NATIVE-004). A capture notice (copy the text yourself, then try again) and a refusal of
    /// the paste (Copy result).
    ClipboardUnkeepable,
    /// Anything unexpected on our side.
    Internal,
    /// `choose_action` (and its neighbours) for a capture that is no longer the one shown, no
    /// longer waits for a choice, or already has one: the Îlot's menu has closed.
    CaptureGone,
    /// The Îlot's free instruction is empty, over 1,000 characters or holds a NUL.
    InstructionInvalid,
}

// The lists the tests compare with the frontend's (src/result/errors.test.ts, src/settings/messages.test.ts).
#[cfg(test)]
impl ErrorKind {
    /// Every code, in the order of the frontend's list (src/types.ts `errorCodes`).
    pub const ALL: &'static [Self] = &[
        Self::Unreachable,
        Self::Timeout,
        Self::Unauthorized,
        Self::ModelNotFound,
        Self::BadEndpoint,
        Self::Busy,
        Self::Length,
        Self::StreamBroken,
        Self::PasteBlocked,
        Self::TargetChanged,
        Self::NotEditable,
        Self::TooLong,
        Self::Cancelled,
        Self::ServerError,
        Self::NoSelection,
        Self::ProtectedField,
        Self::KeysHeld,
        Self::SettingsOpen,
        Self::NothingRecent,
        Self::Internal,
        Self::ReadOnly,
        Self::ProtectedWindow,
        Self::SetupOpen,
        Self::ClipboardUnkeepable,
        Self::TargetUnverified,
        Self::CaptureGone,
        Self::InstructionInvalid,
    ];
}

/// Why the Settings or the first-run setup could not save (or a window called what it may not):
/// one code per thing the person can be told, several messages of the validation sharing one
/// when they say the same. Serialized in snake_case beside `ErrorKind`'s codes, never the same
/// word (test `the_two_families_never_share_a_code`); src/settings/messages.ts gives each its
/// text in the interface language.
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum SettingsRefusal {
    /// Undo outside 2 to 20 seconds.
    UndoSeconds,
    /// The changed words outside 5 to 120 seconds.
    WordsSeconds,
    /// Not 1 to 8 servers, a server id invalid or repeated, or the default server missing.
    Servers,
    /// A server's model too long or with a control character.
    ServerModel,
    /// A server's name too long or with a control character.
    ServerName,
    /// A server's key too long or with a control character.
    ServerKey,
    /// A server address that does not read.
    Address,
    /// A server address holding a user name or a password.
    AddressCredentials,
    /// A server address in a scheme other than https:// or http://.
    AddressScheme,
    /// Not 1 to 24 actions.
    Actions,
    /// An action id empty, too long or repeated.
    ActionId,
    /// An action's name empty, over 60 characters or with a control character.
    ActionName,
    /// An action's instruction empty, over 8,000 characters or with a NUL.
    ActionPrompt,
    /// An action's short name empty, over 16 characters or with a control character.
    ActionShortName,
    /// An action's icon that is not a Lucide name.
    ActionIcon,
    /// An action's letter that is not one letter, or the same as another action's.
    ActionLetter,
    /// Over six actions in the menu's grid.
    GridTooMany,
    /// The grid names an action that does not exist, or one twice.
    GridAction,
    /// The default action does not exist.
    DefaultAction,
    /// Not 1 to 12 shortcuts.
    Shortcuts,
    /// A shortcut id empty, too long or repeated.
    ShortcutId,
    /// A shortcut runs an action that does not exist.
    ShortcutAction,
    /// Two enabled shortcuts on the same chord.
    ShortcutDuplicate,
    /// A chord over 80 characters.
    ShortcutTooLong,
    /// A chord with the Windows key.
    ShortcutWindowsKey,
    /// A chord on F12.
    ShortcutF12,
    /// A chord without Ctrl or Alt.
    ShortcutNeedsModifier,
    /// A chord Windows keeps for itself (Ctrl+Alt+Delete, Alt+Tab, Alt+F4, Alt+Escape).
    ShortcutReserved,
    /// A chord that does not read.
    ShortcutUnknown,
    /// Windows refused to register a new chord (another application holds it, or anything else).
    ShortcutTaken,
    /// Windows refused to switch the start at sign-in.
    AutostartUnavailable,
    /// The settings could not be written (the file, its folder, or DPAPI for a key).
    StorageFailed,
    /// A command called from a window that may not call it (NATIVE-011).
    WindowRefused,
}

// The lists the tests compare with the frontend's (src/result/errors.test.ts, src/settings/messages.test.ts).
#[cfg(test)]
impl SettingsRefusal {
    /// Every code, in the order of the frontend's list (src/types.ts `settingsRefusalCodes`).
    pub const ALL: &'static [Self] = &[
        Self::UndoSeconds,
        Self::WordsSeconds,
        Self::Servers,
        Self::ServerModel,
        Self::ServerName,
        Self::ServerKey,
        Self::Address,
        Self::AddressCredentials,
        Self::AddressScheme,
        Self::Actions,
        Self::ActionId,
        Self::ActionName,
        Self::ActionPrompt,
        Self::ActionShortName,
        Self::ActionIcon,
        Self::ActionLetter,
        Self::GridTooMany,
        Self::GridAction,
        Self::DefaultAction,
        Self::Shortcuts,
        Self::ShortcutId,
        Self::ShortcutAction,
        Self::ShortcutDuplicate,
        Self::ShortcutTooLong,
        Self::ShortcutWindowsKey,
        Self::ShortcutF12,
        Self::ShortcutNeedsModifier,
        Self::ShortcutReserved,
        Self::ShortcutUnknown,
        Self::ShortcutTaken,
        Self::AutostartUnavailable,
        Self::StorageFailed,
        Self::WindowRefused,
    ];
}

/// The code of a refused command: a code of the result and the paste (`ErrorKind`), or one of
/// the Settings (`SettingsRefusal`). Serialized as the bare snake_case word, so the frontend
/// reads one `code` whichever family it comes from.
#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq, Hash)]
#[serde(untagged)]
pub enum RefusalCode {
    Kind(ErrorKind),
    Settings(SettingsRefusal),
}
impl From<ErrorKind> for RefusalCode {
    fn from(kind: ErrorKind) -> Self {
        Self::Kind(kind)
    }
}
impl From<SettingsRefusal> for RefusalCode {
    fn from(code: SettingsRefusal) -> Self {
        Self::Settings(code)
    }
}

/// A code and the French message of 0.4 (user-readable, never any payload). `reason`: which
/// check gave up, as a fixed word for the journal (`anchor`, `no clipboard change`…); never a
/// text of the user, empty when there is nothing more to say than the code.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct AppError {
    pub kind: ErrorKind,
    pub message: String,
    pub reason: &'static str,
}

impl AppError {
    pub fn new(kind: ErrorKind, message: impl Into<String>) -> Self {
        Self {
            kind,
            message: message.into(),
            reason: "",
        }
    }
    pub fn because(mut self, reason: &'static str) -> Self {
        self.reason = reason;
        self
    }
    pub fn internal(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::Internal, message)
    }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.message)
    }
}

/// Every command refuses with its code (`{message, code}`): the frontend shows the code's text in
/// the interface language and never `message`, the French sentence of 0.4 kept for the journal
/// and debugging (never any text of the user, a key or a server's answer).
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Refusal {
    pub message: String,
    pub code: RefusalCode,
}

impl Refusal {
    pub fn new(code: impl Into<RefusalCode>, message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            code: code.into(),
        }
    }
    pub fn internal(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::Internal, message)
    }
}

impl std::fmt::Display for Refusal {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.message)
    }
}

impl From<AppError> for Refusal {
    fn from(error: AppError) -> Self {
        Self::new(error.kind, error.message)
    }
}

/// A plain string from a helper that knows nothing better (a window that would not show, an
/// emit, a lock): internal. What the person can act on has its own code and never comes this way.
impl From<String> for Refusal {
    fn from(message: String) -> Self {
        Self::internal(message)
    }
}
impl From<&str> for Refusal {
    fn from(message: &str) -> Self {
        Self::internal(message)
    }
}

/// A plain string error from a helper that knows nothing better (a lock, an emit): internal.
impl From<String> for AppError {
    fn from(message: String) -> Self {
        Self::internal(message)
    }
}

/// An HTTP answer that is not a success. The status decides; the body (never shown, never
/// logged) only tells a missing model from a wrong address on a 404. A redirect is never
/// followed: the address is wrong (http for https, a login page), not the server busy.
pub fn http_status(status: u16, body: &str) -> ErrorKind {
    match status {
        401 | 403 => ErrorKind::Unauthorized,
        404 if body.to_ascii_lowercase().contains("model") => ErrorKind::ModelNotFound,
        404 => ErrorKind::BadEndpoint,
        300..=399 => ErrorKind::BadEndpoint,
        429 | 503 => ErrorKind::Busy,
        _ => ErrorKind::ServerError,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Its snake_case word, by an exhaustive match: a variant added to `ErrorKind` fails to compile
    /// here until it has its word, and the test below until it is in `ALL`.
    fn kind_name(kind: ErrorKind) -> &'static str {
        match kind {
            ErrorKind::Unreachable => "unreachable",
            ErrorKind::Timeout => "timeout",
            ErrorKind::Unauthorized => "unauthorized",
            ErrorKind::ModelNotFound => "model_not_found",
            ErrorKind::BadEndpoint => "bad_endpoint",
            ErrorKind::Busy => "busy",
            ErrorKind::Length => "length",
            ErrorKind::StreamBroken => "stream_broken",
            ErrorKind::PasteBlocked => "paste_blocked",
            ErrorKind::TargetChanged => "target_changed",
            ErrorKind::TargetUnverified => "target_unverified",
            ErrorKind::NotEditable => "not_editable",
            ErrorKind::ReadOnly => "read_only",
            ErrorKind::ProtectedWindow => "protected_window",
            ErrorKind::TooLong => "too_long",
            ErrorKind::Cancelled => "cancelled",
            ErrorKind::ServerError => "server_error",
            ErrorKind::NoSelection => "no_selection",
            ErrorKind::ProtectedField => "protected_field",
            ErrorKind::KeysHeld => "keys_held",
            ErrorKind::SettingsOpen => "settings_open",
            ErrorKind::SetupOpen => "setup_open",
            ErrorKind::NothingRecent => "nothing_recent",
            ErrorKind::ClipboardUnkeepable => "clipboard_unkeepable",
            ErrorKind::Internal => "internal",
            ErrorKind::CaptureGone => "capture_gone",
            ErrorKind::InstructionInvalid => "instruction_invalid",
        }
    }
    /// The same for `SettingsRefusal`.
    fn settings_name(code: SettingsRefusal) -> &'static str {
        match code {
            SettingsRefusal::UndoSeconds => "undo_seconds",
            SettingsRefusal::WordsSeconds => "words_seconds",
            SettingsRefusal::Servers => "servers",
            SettingsRefusal::ServerModel => "server_model",
            SettingsRefusal::ServerName => "server_name",
            SettingsRefusal::ServerKey => "server_key",
            SettingsRefusal::Address => "address",
            SettingsRefusal::AddressCredentials => "address_credentials",
            SettingsRefusal::AddressScheme => "address_scheme",
            SettingsRefusal::Actions => "actions",
            SettingsRefusal::ActionId => "action_id",
            SettingsRefusal::ActionName => "action_name",
            SettingsRefusal::ActionPrompt => "action_prompt",
            SettingsRefusal::ActionShortName => "action_short_name",
            SettingsRefusal::ActionIcon => "action_icon",
            SettingsRefusal::ActionLetter => "action_letter",
            SettingsRefusal::GridTooMany => "grid_too_many",
            SettingsRefusal::GridAction => "grid_action",
            SettingsRefusal::DefaultAction => "default_action",
            SettingsRefusal::Shortcuts => "shortcuts",
            SettingsRefusal::ShortcutId => "shortcut_id",
            SettingsRefusal::ShortcutAction => "shortcut_action",
            SettingsRefusal::ShortcutDuplicate => "shortcut_duplicate",
            SettingsRefusal::ShortcutTooLong => "shortcut_too_long",
            SettingsRefusal::ShortcutWindowsKey => "shortcut_windows_key",
            SettingsRefusal::ShortcutF12 => "shortcut_f12",
            SettingsRefusal::ShortcutNeedsModifier => "shortcut_needs_modifier",
            SettingsRefusal::ShortcutReserved => "shortcut_reserved",
            SettingsRefusal::ShortcutUnknown => "shortcut_unknown",
            SettingsRefusal::ShortcutTaken => "shortcut_taken",
            SettingsRefusal::AutostartUnavailable => "autostart_unavailable",
            SettingsRefusal::StorageFailed => "storage_failed",
            SettingsRefusal::WindowRefused => "window_refused",
        }
    }

    /// `ALL` holds each variant once: as many distinct entries as the match has arms (counted in
    /// this file's own source, between the `fn` and the next `}` at its depth).
    fn arms(function: &str) -> usize {
        let source = include_str!("error.rs");
        let start = source.find(&format!("fn {function}(")).expect("the match");
        let body = &source[start..];
        let end = body
            .find("\n        }\n    }")
            .expect("the end of the match");
        body[..end].matches(" => \"").count()
    }

    #[test]
    fn every_code_serializes_to_the_frontend_list_in_snake_case() {
        let unique: std::collections::HashSet<_> = ErrorKind::ALL.iter().collect();
        assert_eq!(unique.len(), ErrorKind::ALL.len(), "a code twice in ALL");
        assert_eq!(
            ErrorKind::ALL.len(),
            arms("kind_name"),
            "ErrorKind::ALL misses a code"
        );
        for &kind in ErrorKind::ALL {
            let name = kind_name(kind);
            assert_eq!(serde_json::to_value(kind).unwrap(), serde_json::json!(name));
            assert_eq!(
                serde_json::from_value::<ErrorKind>(serde_json::json!(name)).unwrap(),
                kind
            );
            assert_eq!(
                serde_json::to_value(RefusalCode::from(kind)).unwrap(),
                serde_json::json!(name)
            );
        }
    }

    #[test]
    fn every_settings_code_serializes_to_the_frontend_list_in_snake_case() {
        let unique: std::collections::HashSet<_> = SettingsRefusal::ALL.iter().collect();
        assert_eq!(
            unique.len(),
            SettingsRefusal::ALL.len(),
            "a code twice in ALL"
        );
        assert_eq!(
            SettingsRefusal::ALL.len(),
            arms("settings_name"),
            "SettingsRefusal::ALL misses a code"
        );
        for &code in SettingsRefusal::ALL {
            let name = settings_name(code);
            assert_eq!(serde_json::to_value(code).unwrap(), serde_json::json!(name));
            assert_eq!(
                serde_json::from_value::<SettingsRefusal>(serde_json::json!(name)).unwrap(),
                code
            );
            assert_eq!(
                serde_json::to_value(RefusalCode::from(code)).unwrap(),
                serde_json::json!(name)
            );
        }
    }

    /// The frontend reads one `code`: a word of one family is never a word of the other.
    #[test]
    fn the_two_families_never_share_a_code() {
        let kinds: std::collections::HashSet<_> =
            ErrorKind::ALL.iter().map(|&kind| kind_name(kind)).collect();
        for &code in SettingsRefusal::ALL {
            assert!(!kinds.contains(settings_name(code)), "{code:?}");
        }
    }

    #[test]
    fn a_refused_command_carries_its_message_and_its_code() {
        let refusal = Refusal::from(AppError::new(
            ErrorKind::KeysHeld,
            "Relâchez les touches du raccourci, puis réessayez depuis la bulle.",
        ));
        assert_eq!(
            serde_json::to_value(&refusal).unwrap(),
            serde_json::json!({"message": "Relâchez les touches du raccourci, puis réessayez depuis la bulle.", "code": "keys_held"})
        );
        assert_eq!(
            serde_json::to_value(Refusal::new(
                SettingsRefusal::ShortcutTaken,
                "Le raccourci est déjà utilisé ou indisponible."
            ))
            .unwrap(),
            serde_json::json!({"message": "Le raccourci est déjà utilisé ou indisponible.", "code": "shortcut_taken"})
        );
        // A helper's plain string: internal.
        assert_eq!(
            Refusal::from("État interne indisponible.").code,
            RefusalCode::Kind(ErrorKind::Internal)
        );
    }

    #[test]
    fn the_status_decides_and_the_body_only_splits_the_404() {
        assert_eq!(http_status(401, ""), ErrorKind::Unauthorized);
        assert_eq!(http_status(403, "forbidden"), ErrorKind::Unauthorized);
        // vLLM: « The model `x` does not exist. »; OpenAI: code model_not_found; Ollama: model "x" not found.
        assert_eq!(
            http_status(
                404,
                r#"{"message":"The model `x` does not exist.","type":"NotFoundError"}"#
            ),
            ErrorKind::ModelNotFound
        );
        assert_eq!(
            http_status(404, r#"{"error":{"code":"model_not_found"}}"#),
            ErrorKind::ModelNotFound
        );
        assert_eq!(
            http_status(404, r#"{"detail":"Not Found"}"#),
            ErrorKind::BadEndpoint
        );
        assert_eq!(http_status(404, ""), ErrorKind::BadEndpoint);
        assert_eq!(http_status(301, ""), ErrorKind::BadEndpoint);
        assert_eq!(http_status(429, ""), ErrorKind::Busy);
        assert_eq!(http_status(503, ""), ErrorKind::Busy);
        for status in [400, 405, 422, 500, 502, 504] {
            assert_eq!(
                http_status(status, "model"),
                ErrorKind::ServerError,
                "{status}"
            );
        }
    }
}
