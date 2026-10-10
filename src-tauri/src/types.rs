use crate::actions::{ActionDefinition, ExecutionInfo, ShortcutBinding};
use crate::error::ErrorKind;
use serde::{Deserialize, Serialize};

/// The target language of 0.3.0 (read for the migration only) and, since the « Îlot »
/// art direction, the language of the interface: English by default, French on request.
#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Language {
    Fr,
    #[default]
    En,
}

/// Réglages of the « Îlot » art direction (docs/DA-PLAN.md). The frontend owns their
/// effect; Rust only persists and validates them. Every field has a default so a 0.4
/// settings file loads unchanged.
#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    #[default]
    System,
    Light,
    Dark,
}

/// « Animations : suivre Windows / toujours / réduites ».
#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MotionPreference {
    #[default]
    System,
    Full,
    Reduced,
}

/// Apple « smooth » (default) or « bouncy » springs.
#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MotionPreset {
    #[default]
    Smooth,
    Bouncy,
}

/// The orb of the waiting pill.
#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Indicator {
    #[default]
    Perle,
    Nebuleuse,
    Ruban,
}

/// How Undo reverts a replacement: Ctrl+Z sent to the source (option A, default) or the
/// original pasted back over the new text (option B). Both revalidate the target first.
#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum UndoStrategy {
    #[default]
    Keystroke,
    Repaste,
}

/// Where the pill rests after a replacement: under the new text, or in the margin.
#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum PillPlacement {
    #[default]
    Below,
    Margin,
}

/// What floats is made of: the real `glass` (Windows blurs what is behind, src/backdrop.rs;
/// the default, painted by itself wherever Windows cannot) or the `painted` glass always.
/// `acrylic` was the hidden trial of 0.5: a file that says so asked for the real material.
#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum GlassMaterial {
    Painted,
    #[default]
    #[serde(alias = "acrylic")]
    Glass,
}

/// What follows a replacement: the drawn check, Undo with its countdown, the changed
/// words highlighted until the user's next action in the text, `changed_words_seconds` at
/// most (Lucas, 25/09: independent of Undo). Each can be switched off.
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct AfterReplace {
    pub check: bool,
    pub undo: bool,
    pub undo_seconds: u32,
    pub changed_words: bool,
    pub changed_words_seconds: u32,
}

impl Default for AfterReplace {
    fn default() -> Self {
        Self {
            check: true,
            undo: true,
            undo_seconds: 8,
            changed_words: true,
            changed_words_seconds: 60,
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// Where the window lives (2026-09-14, calibrated reading): `anchored` beside the
/// selection (the waiting pill and the short glass), `bottom` centred on the bottom of
/// the cursor's screen (the reader band, and every capture without an anchor).
#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Presentation {
    Anchored,
    Bottom,
}

/// The work area of the screen a window is on, in logical pixels, with its DPI scale:
/// the frontend sizes the reader band from it (half the width, at most 45 % of the
/// height), never from a hard-coded resolution.
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Screen {
    pub width: f64,
    pub height: f64,
    pub scale: f64,
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SurfaceRegion {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub radius: f64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OverlayDismissRequested {
    pub capture_id: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Capture {
    pub id: String,
    pub text: String,
    pub source: CaptureSource,
    /// How the text was obtained; shown nowhere, read by the real capture matrix.
    pub origin: CaptureOrigin,
    pub can_replace: bool,
    /// The last visible rectangle of the selection, physical screen pixels.
    pub anchor: Option<Rect>,
    /// The lines of a UI Automation selection (lot 5), physical screen pixels like
    /// `anchor`, top to bottom (`selection_lines::lines`): one per line segment, at most
    /// 64. Empty (absent) for a synthetic or user copy, a replay, or an application that
    /// gives no usable rectangle: no effect is drawn on the text then.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub selection_rects: Vec<Rect>,
    /// The screen the capture opens on (its selection's, or the cursor's).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub screen: Option<Screen>,
    /// A result shown again (tray « Revoir la dernière traduction »): the frontend
    /// displays it as complete instead of asking for a translation.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub replay: Option<Replay>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub execution: Option<ExecutionInfo>,
    /// A capture of a `menu` shortcut under the Îlot (lot 3): no execution until
    /// `choose_action`; the frontend opens the menu instead of translating.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub menu: Option<MenuInfo>,
}

/// What the Îlot needs to open: the last action chosen in the source application
/// (lot 4, null when none is remembered or it no longer exists). Never any text.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MenuInfo {
    pub last_action_id: Option<String>,
}

/// A menu key the hook took from the source window (the overlay could not hold the
/// foreground): `key` as `KeyboardEvent.key`, `shiftKey` for Shift+Tab.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MenuKeyEvent {
    pub capture_id: String,
    pub key: String,
    pub shift_key: bool,
}

/// A second press of the same menu shortcut within 400 ms while its menu waits (lot 4):
/// the frontend runs the last action of that application at once.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MenuRepeatEvent {
    pub capture_id: String,
}

/// Whether a shortcut is also AltGr + a key on the active layout, and what it types.
#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutConflict {
    pub alt_gr: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub character: Option<String>,
}

/// Whether a « replace » result was pasted (`applied`) or stays in the glass (`fallback`).
#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum DeliveryStatus {
    Applied,
    Fallback,
}

/// `result-delivery` (0.4.0): after the automatic paste of a « replace » capture. `code`
/// (lot 10) says why a fallback happened.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResultDelivery {
    pub request_id: String,
    pub status: DeliveryStatus,
    pub confirmed: bool,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<ErrorKind>,
    /// Applied under the Îlot (lot 9): the lines of the new text, physical like
    /// `Capture.selectionRects`; absent when the pasted text could not be found.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub pasted_rects: Vec<Rect>,
    /// Undo can be offered: the pasted text was found, so it can be checked again.
    pub undoable: bool,
}

/// Where the pill goes after a paste (lot 9).
#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum PillSide {
    Below,
    Above,
    Margin,
}

/// `result_pill`: the top-left corner of the pill, logical pixels relative to the overlay
/// window as it stands. `inside`: the pill fits in the window there (the frontend can move
/// its surface in the DOM); otherwise `move_overlay` first. `estimated`: the pasted text was
/// not found, the place comes from the old selection and the lengths. `clear`: the pill
/// covers no line of the new text (false only when nothing else fits the screen).
#[derive(Clone, Copy, Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PillTarget {
    pub x: f64,
    pub y: f64,
    pub side: PillSide,
    pub inside: bool,
    pub estimated: bool,
    pub clear: bool,
}

/// A range of the pasted result, UTF-16 offsets (JavaScript string indices), end excluded.
#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq)]
pub struct TextRange {
    pub start: usize,
    pub end: usize,
}

/// `highlight_changes`: how many ranges were found in the source, how many lines drawn.
#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HighlightResult {
    pub ranges: usize,
    pub lines: usize,
}

#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum UndoStatus {
    /// The original is back (read back when `confirmed`).
    Undone,
    /// Nothing was sent: the text, the field or the window changed, or the keys were held.
    Refused,
    /// The undo went out and the original did not come back.
    Failed,
}

/// `undo_result` (lot 9).
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UndoOutcome {
    pub request_id: String,
    pub status: UndoStatus,
    pub confirmed: bool,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<ErrorKind>,
}

/// Why Undo is no longer safe (`undo-state`, lot 9): a key reached the source (`typed`), the
/// user's own Ctrl+Z (`undo_key`: the application undid the paste itself, most likely), or
/// the pasted text is no longer right before the caret (`caret_moved`).
#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum UndoLoss {
    Typed,
    UndoKey,
    CaretMoved,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UndoState {
    pub request_id: String,
    pub available: bool,
    pub reason: UndoLoss,
}

/// `settings-focus-field` (lot 13, sent from lot 10): the field of the Settings to show, and
/// since 0.6 the page to open (general, shortcuts, actions, after, appearance, server, data,
/// diagnostic). Either may be absent.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsFocus {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub field: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page: Option<String>,
}

/// Whether a binding's chord works (lot 10): registered, refused because another
/// application holds it (`taken`), refused for another reason (`failed`), or disabled.
#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum BindingState {
    Registered,
    Taken,
    Failed,
    Disabled,
}

/// `shortcut_status` and the `shortcut-status` event: one per binding, in the settings order.
#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutStatus {
    pub binding_id: String,
    pub shortcut: String,
    pub state: BindingState,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Replay {
    pub request_id: String,
    pub translated_text: String,
    pub server_id: String,
}

/// Whether the capture can still be pasted over: false once a paste was attempted (a
/// result is delivered once) or the selection was lost.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureTarget {
    pub capture_id: String,
    pub can_replace: bool,
}

/// A short message in place of the old MessageBox: shown in the glass when one is open,
/// otherwise as a pill alone at the bottom of the cursor's screen. `code` (lot 10): why
/// nothing was captured, for the Îlot's error pill.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureNotice {
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<ErrorKind>,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum CaptureSource {
    Selection,
    Clipboard,
}

/// uia: the UI Automation selection; copy: the synthetic Ctrl+Insert; fresh: a copy the
/// user made less than three seconds before; replay: the tray; demo: `--demo*`.
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum CaptureOrigin {
    Uia,
    Copy,
    Fresh,
    Replay,
    Demo,
}

/// A server of 0.6 (docs/PLAN-0.6.md §1): one OpenAI-compatible address, its key and the model
/// chosen on it. `endpoint` is the address without `/v1` (empty while nothing is set up);
/// `no_key` is « Mon serveur n'a pas de clé » (the key is then emptied when saved); `name` stays
/// empty in 0.6 (the interface shows the host).
#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Server {
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub endpoint: String,
    #[serde(default)]
    pub api_key: String,
    #[serde(default)]
    pub no_key: bool,
    #[serde(default)]
    pub model: String,
}

/// How the changed words show after a replacement: « Encre irisée » (the text itself glows,
/// default) or « Éclat » (a thin line and a halo, kinder to colour-vision differences).
#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ChangedWordsStyle {
    #[default]
    Encre,
    Eclat,
}

/// Reading presets (2026-09-14): short glass 16/24 · reader 22/33, 18/27 · 24/36,
/// 20/30 · 26/39 (font size / line height, logical pixels). The frontend owns the values.
#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TextSize {
    #[default]
    Normal,
    Large,
    Xlarge,
}

/// How fast the glass leaves once read: the reading budget × 0.7, × 1, × 1.5, or never.
#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum AutoClose {
    Fast,
    #[default]
    Normal,
    Slow,
    Never,
}

/// Hidden switch of the « Îlot » art direction (docs/DA-PLAN.md, lot 0): `v4` keeps the
/// 0.4 journey (a shortcut runs its action at once, the waiting pill, the glass),
/// `ilot` the new one (the menu beside the selection, the pill, the check and Undo). Not
/// shown in the settings window. The Îlot is the default since jalon B (0.5.0), a 0.4 file
/// included (it has no `uiVersion`); `v4` stays reachable by editing settings.json.
#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum UiVersion {
    V4,
    #[default]
    Ilot,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub actions: Vec<ActionDefinition>,
    pub shortcut_bindings: Vec<ShortcutBinding>,
    pub default_action_id: String,
    pub history_enabled: bool,
    pub autostart: bool,
    #[serde(default)]
    pub text_size: TextSize,
    #[serde(default)]
    pub auto_close: AutoClose,
    #[serde(default)]
    pub ui_version: UiVersion,
    #[serde(default)]
    pub language: Language,
    #[serde(default)]
    pub theme: Theme,
    #[serde(default)]
    pub motion: MotionPreference,
    #[serde(default)]
    pub motion_preset: MotionPreset,
    #[serde(default)]
    pub indicator: Indicator,
    #[serde(default)]
    pub after_replace: AfterReplace,
    #[serde(default)]
    pub undo_strategy: UndoStrategy,
    #[serde(default)]
    pub pill_placement: PillPlacement,
    #[serde(default)]
    pub glass_material: GlassMaterial,
    /// The actions of the Îlot grid, in the user's order (six at most). Empty: the user
    /// emptied the grid, the Îlot offers only the free instruction.
    #[serde(default)]
    pub menu_action_ids: Vec<String>,
    /// One to eight servers; the interface shows two at most.
    pub servers: Vec<Server>,
    /// Always the id of a server of `servers`.
    pub default_server_id: String,
    /// The first-run setup was finished (or the settings come from a 0.5 file already set up).
    #[serde(default)]
    pub setup_done: bool,
    #[serde(default)]
    pub changed_words_style: ChangedWordsStyle,
}

/// The one server of a fresh install: nothing set up yet.
pub const FIRST_SERVER_ID: &str = "s1";

impl Default for Settings {
    fn default() -> Self {
        Self {
            actions: crate::actions::defaults(),
            shortcut_bindings: crate::actions::default_bindings(),
            default_action_id: crate::actions::DEFAULT_ACTION_ID.into(),
            history_enabled: false,
            autostart: false,
            text_size: TextSize::Normal,
            auto_close: AutoClose::Normal,
            ui_version: UiVersion::default(),
            language: Language::default(),
            theme: Theme::default(),
            motion: MotionPreference::default(),
            motion_preset: MotionPreset::default(),
            indicator: Indicator::default(),
            after_replace: AfterReplace::default(),
            undo_strategy: UndoStrategy::default(),
            pill_placement: PillPlacement::default(),
            glass_material: GlassMaterial::default(),
            menu_action_ids: crate::actions::default_menu_action_ids(),
            servers: vec![Server {
                id: FIRST_SERVER_ID.into(),
                ..Server::default()
            }],
            default_server_id: FIRST_SERVER_ID.into(),
            setup_done: false,
            changed_words_style: ChangedWordsStyle::default(),
        }
    }
}

impl Settings {
    /// The default server (validation guarantees it exists; the first one otherwise). Read by
    /// the migration tests only: a request always names its server.
    #[cfg(test)]
    pub fn default_server(&self) -> &Server {
        self.servers
            .iter()
            .find(|server| server.id == self.default_server_id)
            .unwrap_or(&self.servers[0])
    }
}
pub fn find_server<'a>(
    servers: &'a [Server],
    id: &str,
) -> Result<&'a Server, crate::error::AppError> {
    servers
        .iter()
        .find(|server| server.id == id)
        .ok_or_else(|| {
            crate::error::AppError::new(
                ErrorKind::BadEndpoint,
                "Ce serveur n’existe plus dans les réglages.",
            )
        })
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslationRequest {
    pub action_id: String,
    pub id: String,
    pub capture_id: String,
    pub text: String,
    pub server_id: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamEvent {
    pub request_id: String,
    pub kind: StreamKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    /// With `kind: error` (lot 10): what failed, beside the French message.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<ErrorKind>,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum StreamKind {
    Delta,
    Done,
    Error,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub id: String,
    pub source_text: String,
    pub translated_text: String,
    /// The action that produced the entry (« Traduire » for rows older than 0.4.0).
    pub action_name: String,
    /// The host of the server that answered (empty for rows older than 0.6).
    pub server: String,
    pub created_at: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TargetInvalidated {
    pub capture_id: String,
    pub anchor_lost: bool,
    pub message: String,
    /// Always `target_changed` (lot 10).
    pub code: ErrorKind,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PlacementSide {
    Above,
    Below,
}

/// Where the selection lives, kept in Rust only: the source window, its focused control
/// and, when UI Automation gave the selection, the element it came from. The paste of
/// 0.4.0 checks that identity again just before the chord; the text serves the watcher
/// and the confirmation, never a log.
#[derive(Clone, Debug)]
pub struct TargetIdentity {
    pub runtime_id: Option<Vec<i32>>,
    pub native_window: isize,
    pub control: isize,
    pub selected_text: String,
    pub anchor: Option<Rect>,
    pub selection_len: usize,
    pub editable: bool,
    pub check: TargetCheck,
}

/// How the text of a target is checked again before a paste (review of da-ilot, n°1): through
/// UI Automation, the selection it reads (with or without a drawable anchor), or, for a text
/// only a synthetic copy gave, by a second copy made right before the paste.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TargetCheck {
    Uia,
    Copy,
}

#[derive(Clone, Debug)]
pub struct StoredCapture {
    pub public: Capture,
    pub target: Option<TargetIdentity>,
    /// The context watcher dropped the target (the selection moved, changed or left): a
    /// paste then fails as `target_changed`, not as a field that cannot be written.
    pub invalidated: bool,
    /// The halo's other levels and the ground under the text (UI Automation captures only).
    pub levels: HaloLevels,
}

/// The text box and the whole lines around a UI Automation selection, and the colour under
/// its text (« mise en valeur », Lucas 25/09): the halo's three levels, and its light or dark
/// drawing. Physical screen pixels, Rust only: never emitted as such, never logged.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct HaloLevels {
    /// The focused element's bounds, clipped to its window.
    pub text_box: Option<Rect>,
    /// From the start of the selection's first line to the end of its last, one per line.
    pub full_lines: Vec<Rect>,
    /// The colour most points just around the lines agree on.
    pub ground: Option<[u8; 3]>,
}

#[derive(Clone, Debug)]
pub struct CompletedResult {
    pub execution: Option<ExecutionInfo>,
    pub request_id: String,
    pub capture_id: String,
    pub source_text: String,
    pub translated_text: String,
    pub server_id: String,
    pub complete: bool,
}

/// settings.json was unreadable at launch and set aside: `backup` is its new file name, no path.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SettingsRecovery {
    pub backup: String,
}
