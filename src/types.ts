export type Language = 'fr' | 'en';
export type Rect = { x: number; y: number; width: number; height: number };
// The interface language since the Îlot art direction (English by default).
// The work area of the screen the capture opens on, logical pixels, with its DPI scale.
export type Screen = { width: number; height: number; scale: number };
// replay: a result shown again from the tray; the frontend displays it complete without translating.
// serverId: the server that answered (the menu's « Run again with » starts from it).
export type Replay = { requestId: string; translatedText: string; serverId: string };
// origin: how Rust obtained the text (uia selection, synthetic copy, fresh user copy, tray replay, demo); shown nowhere.
export type CaptureOrigin = 'uia' | 'copy' | 'fresh' | 'replay' | 'demo';
// menu: a `menu` shortcut under the Îlot (uiVersion 'ilot'): no execution until `choose_action`, the frontend opens the menu.
// The halo window (lot 6, « mise en valeur »): logical pixels relative to the window (width × height). menu: the selection at three levels (textBox, full lines, lines = exact text), still; work: the reflection over the exact text and the aurora around the text box, after 250 ms unless a menu was shown; marks: a wave over the new text (whole), then the changed words (lines), held; leave fades, clear removes. tone and ground come from the colour read under the text (null: the app's theme).
export type HaloPhase = 'menu' | 'work' | 'marks' | 'leave' | 'clear';
export type HaloTone = 'light' | 'dark';
export type HaloEvent = {
  generation: number;
  phase: HaloPhase;
  lines: Rect[];
  full?: Rect[];
  textBox?: Rect | null;
  whole?: Rect[];
  tone?: HaloTone | null;
  ground?: [number, number, number] | null;
  width: number;
  height: number;
};
// selectionRects: the lines of a UI Automation selection, physical screen pixels like anchor (lot 5); Rust places from them, the frontend never does.
export type Capture = {
  id: string;
  text: string;
  source: 'selection' | 'clipboard';
  origin?: CaptureOrigin;
  canReplace: boolean;
  anchor: Rect | null;
  selectionRects?: Rect[];
  screen?: Screen;
  replay?: Replay;
  execution?: ExecutionInfo;
  menu?: MenuInfo;
};
// lastActionId: the last action chosen in the source application (null: none remembered). Never any text.
export type MenuInfo = { lastActionId: string | null };
// A menu key the native hook took from the source window (the overlay could not hold the foreground): KeyboardEvent.key naming.
export type MenuKey = { captureId: string; key: string; shiftKey: boolean };
// `menu-repeat`: the menu shortcut pressed twice within 400 ms while its menu waits (lot 4).
export type MenuRepeat = { captureId: string };
// `shortcut_conflict`: the chord is also AltGr + a key on the active layout, typing `character`.
export type ShortcutConflict = { altGr: boolean; character?: string };
// Second step of a capture: the document offsets and the Win32 control decide « Remplacer » behind the shown window.
export type CaptureTarget = { captureId: string; canReplace: boolean };
// A short message in place of the old MessageBox: a pill alone, or a line in the open glass.
export type CaptureNotice = { message: string; code?: ErrorCode };
// A server of 0.6 (docs/PLAN-0.6.md §1): one OpenAI-compatible address, its key and the model
// chosen on it. endpoint: the address WITHOUT /v1 (https://llm.exemple.com, http://127.0.0.1:8002),
// empty while nothing is set up; Rust stores it normalised whatever was typed. noKey: « Mon serveur
// n'a pas de clé » (Rust then drops the key). name: empty in 0.6 (the interface shows the host).
// apiKey reaches the settings and setup windows only; every other window gets it empty.
export type Server = { id: string; name: string; endpoint: string; apiKey: string; noKey: boolean; model: string };
// How the changed words show after a replacement: « Encre irisée » (the text itself glows, default)
// or « Éclat » (a thin line and a halo, kinder to colour-vision differences).
export type ChangedWordsStyle = 'encre' | 'eclat';
// textSize: reading presets (16/24 · 22/33, 18/27 · 24/36, 20/30 · 26/39); autoClose: reading budget × 0.7, × 1, × 1.5, or never.
export type TextSize = 'normal' | 'large' | 'xlarge';
export type AutoClose = 'fast' | 'normal' | 'slow' | 'never';
// Hidden switch of the « Îlot » art direction (docs/DA-PLAN.md, lot 0): v4 keeps the 0.4
// journey, ilot the menu beside the selection. Not shown in the settings window.
export type UiVersion = 'v4' | 'ilot';
// Réglages of the Îlot art direction (docs/DA-PLAN.md); Rust persists and validates them.
export type Theme = 'system' | 'light' | 'dark';
export type MotionPreference = 'system' | 'full' | 'reduced';
// Rust's reading of « Effets d'animation » (command system_motion, event system-motion).
export type SystemMotion = { reduced: boolean };
export type MotionPreset = 'smooth' | 'bouncy';
export type Indicator = 'perle' | 'nebuleuse' | 'ruban';
// Undo: Ctrl+Z sent to the source (option A) or the original pasted back (option B).
export type UndoStrategy = 'keystroke' | 'repaste';
export type PillPlacement = 'below' | 'margin';
// What floats is made of: the real glass (Windows blurs what is behind; the default, painted by
// itself wherever Windows cannot) or the painted glass always (src-tauri/src/backdrop.rs).
export type GlassMaterial = 'painted' | 'glass';
// undoSeconds: 2 to 20. changedWordsSeconds: 5 to 120, the longest the marks stay without an action in the text.
export type AfterReplace = {
  check: boolean;
  undo: boolean;
  undoSeconds: number;
  changedWords: boolean;
  changedWordsSeconds: number;
};
// 0.4.0: no target language any more; each action's instruction names its language.
// servers: 1 to 8 (the interface shows two at most); defaultServerId: always one of them;
// setupDone: the first-run setup was finished (or the settings come from a 0.5 file already set up).
export type Settings = {
  actions: ActionDefinition[];
  shortcutBindings: ShortcutBinding[];
  defaultActionId: string;
  historyEnabled: boolean;
  autostart: boolean;
  textSize: TextSize;
  autoClose: AutoClose;
  uiVersion: UiVersion;
  language: Language;
  theme: Theme;
  motion: MotionPreference;
  motionPreset: MotionPreset;
  indicator: Indicator;
  afterReplace: AfterReplace;
  undoStrategy: UndoStrategy;
  pillPlacement: PillPlacement;
  glassMaterial: GlassMaterial;
  menuActionIds: string[];
  servers: Server[];
  defaultServerId: string;
  setupDone: boolean;
  changedWordsStyle: ChangedWordsStyle;
};
export type StreamEvent = {
  requestId: string;
  kind: 'delta' | 'done' | 'error';
  text?: string;
  message?: string;
  code?: ErrorCode;
};
// server: the host of the server that answered (empty for an entry older than 0.6).
export type HistoryEntry = {
  id: string;
  sourceText: string;
  translatedText: string;
  actionName: string;
  server: string;
  createdAt: string;
};
// serverId: one of the servers frozen at the capture; the first request must name the capture's (execution.serverId).
export type TranslationRequest = { actionId: string; id: string; captureId: string; text: string; serverId: string };
// What the session shows: the waiting pill, the short glass beside the selection, or the reader band.
export type Form = 'pending' | 'short' | 'reader';
// Where the native window lives: beside the selection, or centred on the bottom of the cursor's screen.
export type Presentation = 'anchored' | 'bottom';
export type HitRegion = { x: number; y: number; width: number; height: number; radius: number };
// frame: the rectangle Rust anchors beside the selection (the glass footprint, present before the glass opens).
export type OverlayGeometry = { captureId: string; presentation: Presentation; regions: HitRegion[]; frame: HitRegion };

export type OutputMode = 'display' | 'replace';
// key: the letter that runs it from the Îlot; shortName: its tile label; icon: a Lucide name.
export type ActionDefinition = {
  id: string;
  name: string;
  promptTemplate: string;
  key?: string;
  shortName?: string;
  icon?: string;
};
// kind: one action at once (0.4), or the Îlot menu beside the selection. Absent means 'action'.
export type BindingKind = 'action' | 'menu';
export type ShortcutBinding = {
  id: string;
  kind?: BindingKind;
  shortcut: string;
  actionId: string;
  outputMode: OutputMode;
  enabled: boolean;
};
// A direct link to one field of the Settings window (lot 13, for the errors of lot 10): the
// `field=` parameter of its URL, or the `settings-focus-field` event while it is open. A bare
// server field means the default server's; `<serverId>.<field>` names a server (Rust drops one
// that no longer exists).
export type ProfileField = 'endpoint' | 'apiKey' | 'model';
export type SettingsField = 'menuShortcut' | ProfileField | `${string}.${ProfileField}`;
// The pages of the Settings window (0.6); diagnostic is the hidden one (Ctrl+Shift+M).
export const settingsPages = [
  'general',
  'shortcuts',
  'actions',
  'after',
  'appearance',
  'server',
  'data',
  'diagnostic',
] as const;
export type SettingsPage = (typeof settingsPages)[number];
// `settings-focus-field`: the page to open and/or the field to reveal (either may be absent).
export type SettingsFocus = { field?: SettingsField; page?: SettingsPage };
// serverId: the default server when the capture was taken; the first request goes to it.
export type ExecutionInfo = { actionId: string; actionName: string; outputMode: OutputMode; serverId: string };
// applied: the result was pasted over the selection (confirmed when the field read it back); fallback: it stays in the glass.
export type ResultDelivery = {
  requestId: string;
  status: 'applied' | 'fallback';
  confirmed: boolean;
  message: string;
  code?: ErrorCode;
  pastedRects?: Rect[];
  undoable?: boolean;
};
// Lot 10: what failed, beside the French message of 0.4 (translation error, result-delivery
// fallback, capture-notice, target-invalidated, the refusals of replace_result
// and undo_result). The one list of the codes Rust sends (error.rs, in its order);
// src/result/errors.ts gives each its family, button and texts, and reads an unknown code as
// 'internal'. Never any text of the server or of the user. settings_open (a shortcut pressed
// while the Settings window is in front) and nothing_recent (the tray's « Revoir » with nothing
// recent) are capture notices since the review of da-ilot.
export const errorCodes = [
  'unreachable',
  'timeout',
  'unauthorized',
  'model_not_found',
  'bad_endpoint',
  'busy',
  'length',
  'stream_broken',
  'paste_blocked',
  'target_changed',
  'not_editable',
  'too_long',
  'cancelled',
  'server_error',
  'no_selection',
  'protected_field',
  'keys_held',
  'settings_open',
  'nothing_recent',
  'internal',
  // 0.6 (field test of 0.5.1): the paste changed nothing (a PDF in a browser); the window in
  // front runs as administrator and can neither be read nor written.
  'read_only',
  'protected_window',
  // 0.6: a shortcut pressed while the first-run setup (or its demo) is in front.
  'setup_open',
] as const;
export type ErrorCode = (typeof errorCodes)[number];
// Lot 10: whether each binding's chord works (`shortcut_status`, event `shortcut-status`); taken: another application holds it.
export type BindingState = 'registered' | 'taken' | 'failed' | 'disabled';
export type ShortcutStatus = { bindingId: string; shortcut: string; state: BindingState };
// Lot 9, after a paste under the Îlot: where the pill goes (`result_pill`), logical pixels relative to
// the overlay window; inside false: `move_overlay` first. estimated: the pasted text was not found.
export type PillSide = 'below' | 'above' | 'margin';
export type PillTarget = { x: number; y: number; side: PillSide; inside: boolean; estimated: boolean; clear: boolean };
// Lot 9: the changed words, UTF-16 offsets of the result (end excluded), and what the halo drew of them.
export type TextRange = { start: number; end: number };
export type HighlightResult = { ranges: number; lines: number };
// Lot 9, `undo_result`: undone (confirmed when read back), refused (nothing sent), failed (sent, the original did not come back).
export type UndoStatus = 'undone' | 'refused' | 'failed';
export type UndoOutcome = {
  requestId: string;
  status: UndoStatus;
  confirmed: boolean;
  message: string;
  code?: ErrorCode;
};
// Lot 9, event `undo-state`: Undo withdrawn; typed: a key reached the source; undo_key: the user's own Ctrl+Z; caret_moved: the text is no longer before the caret.
export type UndoLoss = 'typed' | 'undo_key' | 'caret_moved';
export type UndoState = { requestId: string; available: false; reason: UndoLoss };
// Since the review of da-ilot, `replace_result` rejects with its code beside the French message of
// 0.4: target_changed, keys_held, not_editable, paste_blocked (bridge.replaceResult keeps it).
export type Refusal = { message: string; code: ErrorCode };

// ——— The connection of 0.6 (docs/PLAN-0.6.md §2; Rust: src-tauri/src/probe.rs, diagnostics.rs) ———
// Rust sends codes, never sentences: the interface translates a StepDetail and a ProbeCause.
// Nothing here ever carries a source text, a translation, the clipboard or a whole API key.

// An address read as it is typed: `base` is what is stored and shown, `{base}/v1/…` what is called.
// insecure: plain http to another machine (« Connexion non chiffrée »). removed: the OpenAI suffix
// that was cut (/v1, /v1/models…). The same rule in Rust (settings::normalize_endpoint) and in
// the preview (normalizeEndpoint, src/bridge.mock.ts), tested on src/connection/endpoint.vectors.json.
export type NormalizedEndpoint =
  | {
      ok: true;
      base: string;
      host: string;
      display: string;
      secure: boolean;
      local: boolean;
      insecure: boolean;
      changed: boolean;
      removed?: string;
    }
  | { ok: false; reason: 'empty' | 'malformed' | 'scheme' | 'credentials' };
export const probeStepIds = ['address', 'reach', 'key', 'models'] as const;
export type ProbeStepId = (typeof probeStepIds)[number];
export type StepState = 'waiting' | 'running' | 'ok' | 'error' | 'skipped';
// What a row says once it succeeded. key_accepted.tail: the four last characters of the key
// (empty for a short key). key_none: « Mon serveur n'a pas de clé »; key_not_asked: none typed.
export type StepDetail =
  | { code: 'found' | 'local'; host: string }
  | { code: 'tls' | 'http_local' | 'http_insecure' }
  | { code: 'key_accepted'; tail: string }
  | { code: 'key_none' | 'key_not_asked' }
  | { code: 'models'; count: number };
export type ProbeStep = { id: ProbeStepId; state: StepState; ms?: number; detail?: StepDetail };
// Every cause has a title and a gesture in the interface. reach.certificate: Windows refused the
// server's certificate (self-signed, unknown authority, name, dates); reach.tls: no TLS there.
export const probeCauses = [
  'address.empty',
  'address.malformed',
  'address.scheme',
  'address.credentials',
  'address.dns',
  'reach.refused',
  'reach.timeout',
  'reach.tls',
  'reach.certificate',
  'reach.network',
  'key.required',
  'key.rejected',
  'models.notfound',
  'models.empty',
  'models.invalid',
  'models.server',
  'try.model',
  'try.rejected',
  'try.server',
  'try.timeout',
  'try.empty',
  'cancelled',
] as const;
export type ProbeCause = (typeof probeCauses)[number];
// technical: the system's own words (an OS error), scrubbed of the key; never a response body.
// logId: the journal entry of the failure (« Voir le journal » opens on it).
export type ProbeProblem = {
  step: ProbeStepId | 'try';
  cause: ProbeCause;
  status?: number;
  technical?: string;
  logId?: number;
};
export type ModelInfo = { id: string; ownedBy?: string };
// A stale run is ignored by its caller: a newer check of the same window cancels the older one
// (its result then says cause 'cancelled').
export type ProbeResult = {
  run: string;
  ok: boolean;
  endpoint: NormalizedEndpoint;
  steps: ProbeStep[];
  models: ModelInfo[];
  problem?: ProbeProblem;
  totalMs: number;
};
// `probe-step`: the whole trace at each change, to the window that started the check.
export type ProbeStepEvent = { run: string; steps: ProbeStep[] };
// « Essayer avec une phrase »: reply is 200 characters at most, shown and never logged.
export type TryResult =
  | { run: string; ok: true; reply: string; ms: number }
  | { run: string; ok: false; problem: ProbeProblem };
// The journal (hidden Diagnostic page, « Voir le journal »). code: a stable word (resolved, local,
// proxy, connected, tls, key_accepted, key_none, models, reply, done, started, a ProbeCause, an
// ErrorCode). cause: the system's words for a failure. detail: a neutral fact (host → IP, a count,
// a model id). url: never a query nor a fragment. key: the key that was sent, masked (••••3f2a).
// proxy: `system: <host>` when the request went through the proxy of the environment.
export type DiagStep = ProbeStepId | 'try' | 'request' | 'app';
export type DiagLevel = 'ok' | 'info' | 'error';
export type DiagEntry = {
  id: number;
  at: string;
  run?: string;
  step: DiagStep;
  level: DiagLevel;
  method?: 'GET' | 'POST';
  url?: string;
  status?: number;
  ms?: number;
  code: string;
  cause?: string;
  detail?: string;
  proxy?: string;
  key?: string;
};
// `demo-ended`: the demo window closed (done: it played to its end; false: skipped, closed, or its watchdog).
export type DemoEnded = { done: boolean };
// `update-status` (Rust update.rs, 0.6.2): the in-app update, as Settings › General shows it.
export type UpdateStatus = {
  current: string;
  available: string | null;
  checkedAt: number | null;
  checking: boolean;
  failed: boolean;
  installing: boolean;
  downloaded: number;
  total: number | null;
};
