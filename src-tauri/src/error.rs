//! Error codes (« Îlot », lot 10 of docs/DA-PLAN.md): what failed, as a code the frontend
//! turns into a short text in the interface language and one gesture: open the exact field
//! of the Settings, Try again, or Copy the result. The French message of 0.4 travels beside
//! it for the v4 journey. Neither ever carries the server's answer, a key, a URL path or any
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
    /// The field cannot be written (read-only, a console, a copy without a known selection).
    NotEditable,
    /// The paste went out and changed nothing: the text is read-only (a PDF in a browser).
    /// The result exists and was not written: Copy result.
    ReadOnly,
    /// The window in front runs as administrator while we do not: Windows lets us neither
    /// read its text nor send it a key (a capture notice, and a refusal of the paste).
    ProtectedWindow,
    /// Over 6,000 characters.
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
    /// Anything unexpected on our side.
    Internal,
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
        Self { kind, message: message.into(), reason: "" }
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

/// Commands that still answer a plain string (the 0.4 contract) keep the message only.
impl From<AppError> for String {
    fn from(error: AppError) -> Self {
        error.message
    }
}

/// A command refused with its code (`replace_result`), sent to the frontend as
/// `{message, code}` like the events of lot 10: the French message of 0.4 and the code.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Refusal {
    pub message: String,
    pub code: ErrorKind,
}

impl From<AppError> for Refusal {
    fn from(error: AppError) -> Self {
        Self { message: error.message, code: error.kind }
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

    #[test]
    fn every_code_serializes_to_the_frontend_list_in_snake_case() {
        let codes = [
            (ErrorKind::Unreachable, "unreachable"), (ErrorKind::Timeout, "timeout"), (ErrorKind::Unauthorized, "unauthorized"),
            (ErrorKind::ModelNotFound, "model_not_found"), (ErrorKind::BadEndpoint, "bad_endpoint"), (ErrorKind::Busy, "busy"),
            (ErrorKind::Length, "length"), (ErrorKind::StreamBroken, "stream_broken"), (ErrorKind::PasteBlocked, "paste_blocked"),
            (ErrorKind::TargetChanged, "target_changed"), (ErrorKind::NotEditable, "not_editable"), (ErrorKind::TooLong, "too_long"),
            (ErrorKind::Cancelled, "cancelled"), (ErrorKind::ServerError, "server_error"), (ErrorKind::NoSelection, "no_selection"),
            (ErrorKind::ProtectedField, "protected_field"), (ErrorKind::KeysHeld, "keys_held"), (ErrorKind::Internal, "internal"),
            (ErrorKind::SettingsOpen, "settings_open"), (ErrorKind::NothingRecent, "nothing_recent"),
            (ErrorKind::ReadOnly, "read_only"), (ErrorKind::ProtectedWindow, "protected_window"),
            (ErrorKind::SetupOpen, "setup_open"),
        ];
        for (kind, name) in codes {
            assert_eq!(serde_json::to_value(kind).unwrap(), serde_json::json!(name));
            assert_eq!(serde_json::from_value::<ErrorKind>(serde_json::json!(name)).unwrap(), kind);
        }
    }

    #[test]
    fn a_refused_command_carries_its_message_and_its_code() {
        let refusal = Refusal::from(AppError::new(ErrorKind::KeysHeld, "Relâchez les touches du raccourci, puis réessayez depuis la bulle."));
        assert_eq!(serde_json::to_value(&refusal).unwrap(), serde_json::json!({"message": "Relâchez les touches du raccourci, puis réessayez depuis la bulle.", "code": "keys_held"}));
    }

    #[test]
    fn the_status_decides_and_the_body_only_splits_the_404() {
        assert_eq!(http_status(401, ""), ErrorKind::Unauthorized);
        assert_eq!(http_status(403, "forbidden"), ErrorKind::Unauthorized);
        // vLLM: « The model `x` does not exist. »; OpenAI: code model_not_found; Ollama: model "x" not found.
        assert_eq!(http_status(404, r#"{"message":"The model `x` does not exist.","type":"NotFoundError"}"#), ErrorKind::ModelNotFound);
        assert_eq!(http_status(404, r#"{"error":{"code":"model_not_found"}}"#), ErrorKind::ModelNotFound);
        assert_eq!(http_status(404, r#"{"detail":"Not Found"}"#), ErrorKind::BadEndpoint);
        assert_eq!(http_status(404, ""), ErrorKind::BadEndpoint);
        assert_eq!(http_status(301, ""), ErrorKind::BadEndpoint);
        assert_eq!(http_status(429, ""), ErrorKind::Busy);
        assert_eq!(http_status(503, ""), ErrorKind::Busy);
        for status in [400, 405, 422, 500, 502, 504] {
            assert_eq!(http_status(status, "model"), ErrorKind::ServerError, "{status}");
        }
    }
}
