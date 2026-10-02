import { defaultActionId, defaultActions, defaultBindings, defaultMenuActionIds, instructionActionId, instructionActionName, instructionError, localizeDefaults } from './actionDefaults';
import { resetFrom } from './settings/reset';
import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { listen as tauriListen } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { connectionCommand, isConnectionCommand, mockModels, normalizeEndpoint, setConnScenario, type ConnScenario } from './bridge.mock';
import type { Capture, DemoEnded, DiagEntry, ExecutionInfo, HighlightResult, HistoryEntry, OverlayGeometry, PillTarget, ProbeResult, Rect, Refusal, Screen, Server, Settings, SettingsField, SettingsPage, ShortcutConflict, ShortcutStatus, StreamEvent, SystemMotion, TextRange, TranslationRequest, TryResult, UndoOutcome } from './types';

type Unlisten = () => void;
// 0.6: 'probe-step' (ProbeStepEvent, to the window that started the check), 'diagnostic' (DiagEntry,
// settings and setup windows), 'demo-ended' (DemoEnded, to the setup window).
type EventName = 'capture' | 'translation' | 'settings-changed' | 'target-invalidated' | 'overlay-dismiss-requested' | 'glass-near' | 'capture-target' | 'capture-notice' | 'work-area' | 'result-delivery' | 'system-theme' | 'system-motion' | 'menu-key' | 'menu-repeat' | 'settings-focus-field' | 'halo' | 'shortcut-status' | 'undo-state' | 'probe-step' | 'diagnostic' | 'demo-ended';
type Handler<T> = (payload: T) => void;

// A fresh install, as Rust's Settings::default(): one server, nothing set up, the setup to do.
const emptyServer: Server = { id: 's1', name: '', endpoint: '', apiKey: '', noKey: false, model: '' };
const defaultSettings: Settings = {
  defaultActionId, actions: structuredClone(defaultActions), shortcutBindings: structuredClone(defaultBindings), historyEnabled: false, autostart: false, textSize: 'normal', autoClose: 'normal', uiVersion: 'ilot', language: 'en', theme: 'system', motion: 'system', motionPreset: 'smooth', indicator: 'perle', afterReplace: { check: true, undo: true, undoSeconds: 8, changedWords: true, changedWordsSeconds: 60 }, undoStrategy: 'keystroke', pillPlacement: 'below', glassMaterial: 'glass', menuActionIds: [...defaultMenuActionIds],
  servers: [structuredClone(emptyServer)], defaultServerId: 's1', setupDone: false, changedWordsStyle: 'encre',
};
// The servers of the preview. The setup window starts as a fresh install does; every other
// window as an installation already set up, on the simulated server (src/bridge.mock.ts).
// `?servers=empty | one | two` chooses; `?window=setup&replay=1` is « Revoir l'accueil ».
function previewServers(search: string): Pick<Settings, 'servers' | 'defaultServerId' | 'setupDone'> {
  const params = new URLSearchParams(search);
  const fresh = params.get('window') === 'setup' && params.get('replay') !== '1' && params.get('stage') !== 'demo';
  const asked = params.get('servers') ?? (fresh ? 'empty' : 'one');
  if (asked === 'empty') return { servers: [structuredClone(emptyServer)], defaultServerId: 's1', setupDone: false };
  const first: Server = { id: 's1', name: '', endpoint: 'https://llm.exemple.com', apiKey: '', noKey: true, model: mockModels[0].id };
  const second: Server = { id: 's2', name: '', endpoint: 'http://127.0.0.1:8002', apiKey: '', noKey: true, model: mockModels[1].id };
  return { servers: asked === 'two' ? [first, second] : [first], defaultServerId: 's1', setupDone: true };
}

const native = '__TAURI_INTERNALS__' in window;
let demoCapture: Capture = { id: 'demo-selection', text: 'Could you send the updated proposal before Thursday?', source: 'selection', canReplace: true, anchor: { x: 830, y: 410, width: 360, height: 24 } };
type DemoScenario = 'normal' | 'error' | 'long' | 'very-long' | 'pending' | 'partial';
let demoScenario: DemoScenario = 'normal';
// The preview starts where the app does, in the Îlot (Rust's default since 0.5.0); `?ui=v4` asks
// for the 0.4 journey, as the tests and the lab's 0.4 states do.
let demoSettings: Settings = { ...structuredClone(defaultSettings), ...previewServers(location.search), uiVersion: new URLSearchParams(location.search).get('ui') === 'v4' ? 'v4' : 'ilot' };
let activeTimer: number | undefined;
let activeDemoRequest: string | undefined;
let demoHistory: HistoryEntry[] = [{ id: 'demo-history', sourceText: 'Could you send the updated proposal?', translatedText: 'Pourriez-vous envoyer la proposition mise à jour ?', actionName: 'Traduire en français', server: 'llm.exemple.com', createdAt: '2026-09-08T10:24:00Z' }];
const demoListeners = new Map<EventName, Set<(payload: never) => void>>();

function emit<T>(name: EventName, payload: T) { demoListeners.get(name)?.forEach(handler => handler(payload as never)); }
function demoTranslation(text: string, actionId: string) {
  const language = actionId.endsWith('-en') ? 'en' : 'fr';
  if (demoScenario === 'error') return null;
  if (demoScenario === 'long' || demoScenario === 'very-long') return ( 'Bonjour Alex,\n\nMerci pour votre retour sur la proposition. La nouvelle version reprend les points discutés lors de notre réunion : le calendrier de livraison, la répartition des responsabilités et les conditions de validation.\n\nPourriez-vous vérifier les montants et les dates avant jeudi ? Nous pourrons ensuite transmettre la version définitive à l’équipe. Le budget de 12 500 € reste inchangé et la première livraison est prévue le 15 octobre.\n\nVous trouverez également une synthèse des modifications et la liste des questions encore ouvertes. Je reste disponible pour en discuter demain matin.\n\nBonne journée,\nMarie').repeat(demoScenario === 'very-long' ? 8 : 1);
  if (text.includes('updated proposal')) return language === 'fr' ? 'Pourriez-vous envoyer la proposition mise à jour avant jeudi ?' : 'Could you send the updated proposal before Thursday?';
  if (text.includes('Je vous envoie')) return language === 'en' ? 'I am sending you the updated proposal.' : 'Je vous envoie la proposition mise à jour.';
  return language === 'fr' ? 'Voici une traduction de démonstration, prête à être relue.' : 'Here is a demo translation, ready for review.';
}

const azertyAltGr: Record<string, string> = { e: '€', '2': '~', '3': '#', '4': '{', '5': '[', '6': '|', '7': '`', '8': '\\', '9': '^', '0': '@', bracketleft: ']', equal: '}' };

// A `{message, code}` refusal (replace_result) read as its message, for the callers of 0.4.
function refusalMessage(reason: unknown): unknown {
  return typeof reason === 'object' && reason !== null && typeof (reason as Refusal).message === 'string' ? (reason as Refusal).message : reason;
}

async function command<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  if (native) return tauriInvoke<T>(name, args);
  if (name === 'get_settings') return structuredClone(demoSettings) as T;
  // What is saved is clean, as Rust's settings::sanitize: addresses normalised, no key for a server
  // without one, the untouched default actions in the interface's language; a finished setup stays so.
  if (name === 'save_settings') {
    const next = structuredClone(args?.settings as Settings);
    next.actions = localizeDefaults(next.actions, next.language);
    if (demoSettings.setupDone) next.setupDone = true;
    next.servers = next.servers.map(server => { const endpoint = normalizeEndpoint(server.endpoint); return { ...server, endpoint: endpoint.ok ? endpoint.base : server.endpoint.trim(), model: server.model.trim(), apiKey: server.noKey ? '' : server.apiKey }; });
    if (next.servers.some(server => server.endpoint !== '' && !normalizeEndpoint(server.endpoint).ok)) throw 'L’adresse du serveur est invalide.';
    demoSettings = next; emit('settings-changed', demoSettings); return undefined as T;
  }
  if (isConnectionCommand(name)) return connectionCommand(name, args, emit) as Promise<T>;
  // The setup of the preview: finishing it marks it done; the demo plays in the same page.
  if (name === 'finish_setup' || name === 'complete_setup') { if (!demoSettings.setupDone) { demoSettings = { ...demoSettings, setupDone: true }; emit('settings-changed', demoSettings); } return undefined as T; }
  if (name === 'open_demo') return undefined as T;
  if (name === 'close_demo') { emit<DemoEnded>('demo-ended', { done: args?.done === true }); return undefined as T; }
  if (name === 'reset_settings') { demoSettings = resetFrom(defaultSettings, demoSettings); demoSettings = { ...demoSettings, actions: localizeDefaults(demoSettings.actions, demoSettings.language) }; emit('settings-changed', demoSettings); return structuredClone(demoSettings) as T; }
  // The preview registers every chord: its proposal is Rust's first.
  if (name === 'suggest_shortcut') return 'Ctrl+Alt+Shift+Space' as T;
  if (name === 'capture_text') return structuredClone(demoCapture) as T;
  if (name === 'frontend_ready') return null as T;
  if (name === 'get_history') return structuredClone(demoHistory) as T;
  if (name === 'delete_history') { const id = args?.id as string | null; demoHistory = id === null ? [] : demoHistory.filter(item => item.id !== id); return undefined as T; }
  if (name === 'translate') {
    const request = args?.request as TranslationRequest;
    window.clearTimeout(activeTimer);
    activeDemoRequest = request.id;
    if (import.meta.env.DEV && demoScenario === 'pending') return undefined as T;
    if (import.meta.env.DEV && demoScenario === 'partial') {
      activeTimer = window.setTimeout(() => {
        if (activeDemoRequest !== request.id) return;
        emit<StreamEvent>('translation', { requestId: request.id, kind: 'delta', text: 'Pourriez-vous envoyer la proposition' });
        emit<StreamEvent>('translation', { requestId: request.id, kind: 'error', message: 'Réponse interrompue. Réessayez.' });
      }, 120);
      return undefined as T;
    }
    const translated = demoTranslation(request.text, request.actionId);
    if (!translated) { activeTimer = window.setTimeout(() => emit<StreamEvent>('translation', { requestId: request.id, kind: 'error', message: 'Démo : le serveur est indisponible.' }), 260); return undefined as T; }
    let i = 0;
    const tick = () => {
      if (activeDemoRequest !== request.id) return;
      if (i < translated.length) { emit<StreamEvent>('translation', { requestId: request.id, kind: 'delta', text: translated.slice(i, i += demoScenario === 'very-long' ? 180 : demoScenario === 'long' ? 28 : 5) }); activeTimer = window.setTimeout(tick, 45); }
      else emit<StreamEvent>('translation', { requestId: request.id, kind: 'done' });
    };
    activeTimer = window.setTimeout(tick, 120); return undefined as T;
  }
  // The Îlot in the preview: the page has the keyboard, a choice runs the demo translation.
  if (name === 'focus_overlay') return true as T;
  if (name === 'choose_action') {
    const actionId = args?.actionId as string;
    const instruction = args?.instruction as string | undefined;
    if (instruction !== undefined) {
      const error = actionId === instructionActionId ? instructionError(instruction) : 'La consigne libre ne correspond pas à l’action demandée.';
      if (error) throw error;
      return { actionId, actionName: instructionActionName, outputMode: 'replace', serverId: demoSettings.defaultServerId } as T;
    }
    const action = demoSettings.actions.find(item => item.id === actionId);
    if (!action) throw 'L’action n’existe plus.';
    return { actionId, actionName: action.name, outputMode: 'replace', serverId: demoSettings.defaultServerId } satisfies ExecutionInfo as T;
  }
  // The preview has no keyboard layout to ask: it answers for French AZERTY, the layout
  // the AltGr warning matters most for (Ctrl+Alt+E types €, Ctrl+Alt+0 types @).
  if (name === 'shortcut_conflict') {
    const parts = String(args?.shortcut ?? '').split('+').map(part => part.trim().toLowerCase());
    const key = parts.at(-1)?.replace(/^(key|digit)/, '') ?? '';
    const character = parts.includes('ctrl') && parts.includes('alt') && !parts.includes('shift') ? azertyAltGr[key] : undefined;
    return (character ? { altGr: true, character } : { altGr: false }) satisfies ShortcutConflict as T;
  }
  // Lot 10: the preview registers every enabled chord.
  if (name === 'shortcut_status') return demoSettings.shortcutBindings.map(b => ({ bindingId: b.id, shortcut: b.shortcut, state: b.enabled ? 'registered' : 'disabled' })) satisfies ShortcutStatus[] as T;
  if (name === 'dismiss_overlay') { activeDemoRequest = undefined; window.clearTimeout(activeTimer); emit('overlay-dismiss-requested', { captureId: demoCapture.id }); return undefined as T; }
  if (name === 'cancel_translation') { activeDemoRequest = undefined; window.clearTimeout(activeTimer); return undefined as T; }
  // Lot 9: the preview pastes nothing, so there is no text to stand under or to mark; Undo has nothing to read back.
  if (name === 'result_pill') throw 'Aperçu : aucun texte collé.';
  if (name === 'highlight_changes') return { ranges: 0, lines: 0 } satisfies HighlightResult as T;
  if (name === 'undo_result') return { requestId: String(args?.requestId ?? ''), status: 'undone', confirmed: false, message: 'Démo : remplacement annulé.' } satisfies UndoOutcome as T;
  return undefined as T;
}

// A window hears what Rust sends to it (`emit_to(<its label>)`) and what Rust sends to everyone
// (`emit`), nothing else. Tauri's plain `listen` hears every window's events: the overlay would
// receive the settings with their API keys meant for the Settings window, and the Settings
// window the keyless copy meant for the overlay (which it could then save back, losing the keys).
async function event<T>(name: EventName, handler: Handler<T>): Promise<Unlisten> {
  if (native) return tauriListen<T>(name, e => handler(e.payload), { target: { kind: 'WebviewWindow', label: getCurrentWebviewWindow().label } });
  const set = demoListeners.get(name) ?? new Set();
  set.add(handler as (payload: never) => void); demoListeners.set(name, set);
  return () => set.delete(handler as (payload: never) => void);
}

export const bridge = {
  native,
  getSettings: () => command<Settings>('get_settings'),
  saveSettings: (settings: Settings) => command<void>('save_settings', { settings }),
  captureText: () => command<Capture>('capture_text'),
  frontendReady: () => command<Capture | null>('frontend_ready'),
  closeSettings: async () => {
    if (native) { const { getCurrentWindow } = await import('@tauri-apps/api/window'); return getCurrentWindow().close(); }
    location.assign('/');
  },
  resizeSettingsCorner: async () => {
    if (native) { const { getCurrentWindow } = await import('@tauri-apps/api/window'); await getCurrentWindow().startResizeDragging('SouthEast'); }
  },
  // The settings window's title bar text (taskbar, Alt+Tab) follows the interface language.
  setSettingsTitle: async (title: string) => {
    if (native) { const { getCurrentWindow } = await import('@tauri-apps/api/window'); await getCurrentWindow().setTitle(title); }
    else document.title = title;
  },
  // Whether this window is really on screen. The Settings window is created hidden and can hold
  // the focus while hidden (Windows gives it the foreground at launch): « focused » is not « shown ».
  // An answer that cannot be had reads as shown, as before 0.6.
  windowShown: async (): Promise<boolean> => {
    if (!native) return true;
    try { const { getCurrentWindow } = await import('@tauri-apps/api/window'); return await getCurrentWindow().isVisible(); } catch { return true; }
  },
  dragSettings: () => command<void>('drag_settings'),
  quit: () => command<void>('quit_app'),
  translate: (request: TranslationRequest) => command<void>('translate', { request }),
  cancel: (requestId: string) => command<void>('cancel_translation', { requestId }),
  copy: (requestId: string) => command<void>('copy_result', { requestId }),
  replace: (requestId: string) => command<void>('replace_result', { requestId }).catch((reason: unknown) => { throw refusalMessage(reason); }),
  dismiss: () => command<void>('dismiss_overlay'),
  completeDismiss: (captureId: string) => command<void>('complete_overlay_dismiss', { captureId }),
  // field (lot 10): the Settings open on that field; page (0.6): on that page. Rust ignores an
  // unknown one and sends `settings-focus-field { field?, page? }` to the open window.
  openSettings: async (field?: SettingsField, page?: SettingsPage) => {
    if (native) return command<void>('open_settings', { ...(field ? { field } : {}), ...(page ? { page } : {}) });
    location.assign(`?window=settings&demo=1${field ? `&field=${encodeURIComponent(field)}` : ''}${page ? `&page=${page}` : ''}`);
  },
  // ——— 0.6: the connection (docs/PLAN-0.6.md §2). Settings and setup windows only. ———
  // The check of what is TYPED (not of what is saved). `run`: an id of the caller's making
  // (letters, digits, - and _, 64 at most); each change of the trace arrives as `probe-step
  // { run, steps }` before the promise resolves. A new check from the same window cancels the
  // older one (its result then has problem.cause 'cancelled'): ignore any run that is not yours.
  probeConnection: (run: string, endpoint: string, apiKey: string, noKey: boolean) => command<ProbeResult>('probe_connection', { run, endpoint, apiKey, noKey }),
  // Cancels a check or a try by its run id (the field changed, the window closes).
  cancelProbe: (run: string) => command<void>('cancel_probe', { run }),
  // « Essayer avec une phrase »: one fixed, synthetic sentence (never the person's text), 30 s
  // at most. The reply (200 characters at most) is shown, never logged.
  tryModel: (run: string, endpoint: string, apiKey: string, noKey: boolean, model: string) => command<TryResult>('try_model', { run, endpoint, apiKey, noKey, model }),
  // The journal: the 500 last entries, the oldest first; new ones arrive as `diagnostic`.
  getDiagnostics: () => command<DiagEntry[]>('get_diagnostics'),
  clearDiagnostics: () => command<void>('clear_diagnostics'),
  // The same rule as Rust's, for a hint while typing (Rust has the last word when saving).
  normalizeEndpoint,
  // ——— 0.6: the setup and its demo (docs/PLAN-0.6.md §3) ———
  // Creates or shows the setup window. replay: « Revoir l'accueil » (setupDone stays as it is).
  openSetup: async (replay = false) => {
    if (native) return command<void>('open_setup', { replay });
    location.assign(`?window=setup${replay ? '&replay=1' : ''}`);
  },
  // The end of the setup: setupDone is saved, the setup closes, the Settings open when asked.
  finishSetup: async (openSettings: boolean) => {
    await command<void>('finish_setup', { openSettings });
    if (!native && openSettings) location.assign('?window=settings&demo=1');
  },
  // The setup reached « C'est prêt »: setupDone is saved now, whatever closes the window later.
  completeSetup: () => command<void>('complete_setup'),
  // The demo: its own window natively (the setup hides, then gets `demo-ended { done }`); in the
  // preview nothing opens (the setup page plays it in place) and closeDemo emits `demo-ended`.
  openDemo: () => command<void>('open_demo'),
  closeDemo: (done: boolean) => command<void>('close_demo', { done }),
  // The framed windows without decorations (settings, setup): drag by their own title bar, minimise.
  dragWindow: async () => {
    if (native) { const { getCurrentWindow } = await import('@tauri-apps/api/window'); await getCurrentWindow().startDragging(); }
  },
  minimizeWindow: async () => {
    if (native) { const { getCurrentWindow } = await import('@tauri-apps/api/window'); await getCurrentWindow().minimize(); }
  },
  // Browser preview only: the scenario of the simulated server (also `?conn=<id>`).
  setConnScenario: (scenario: ConnScenario) => { if (!native) setConnScenario(scenario); },
  // Îlot (lots 3–4): true when the overlay really holds the foreground; false leaves the
  // menu to the native keyboard fallback (`menu-key` events, no free field).
  focusOverlay: () => command<boolean>('focus_overlay'),
  // Once per menu capture: a saved action, or `instructionActionId` with the free instruction.
  chooseAction: (captureId: string, actionId: string, instruction?: string) => command<ExecutionInfo>('choose_action', { captureId, actionId, ...(instruction === undefined ? {} : { instruction }) }),
  // Where Rust put the overlay (physical pixels of the virtual screen, like a capture's anchor),
  // so the Îlot knows on which side of the selection it opened; null outside the native app.
  windowPosition: async (): Promise<{ x: number; y: number } | null> => {
    if (!native) return null;
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const position = await getCurrentWindow().innerPosition();
    return { x: position.x, y: position.y };
  },
  // The work area (physical pixels) of the screen holding a point: Rust places a capture on the
  // screen of its anchor's centre (host::monitor_at, rcWork), the Îlot keeps its widest shape on
  // it (src/layout.ts ilotShift). null outside the native app, or off every screen.
  workAreaAt: async (x: number, y: number): Promise<Rect | null> => {
    if (!native) return null;
    const { monitorFromPoint } = await import('@tauri-apps/api/window');
    const monitor = await monitorFromPoint(x, y);
    if (!monitor) return null;
    const { position, size } = monitor.workArea;
    return { x: position.x, y: position.y, width: size.width, height: size.height };
  },
  // Lot 4, for the shortcut recorder (wired in lot 13): is this chord AltGr + a key here?
  shortcutConflict: (shortcut: string) => command<ShortcutConflict>('shortcut_conflict', { shortcut }),
  startDrag: (clientX: number, clientY: number) => command<void>('start_drag', { clientX, clientY }),
  resize: (width: number, height: number, geometry: OverlayGeometry) => command<void>('resize_overlay', { width, height, ...geometry }),
  // The reading budget is spent: Rust frees Escape while the glass dims; an approach re-arms it.
  dimming: (dimming: boolean) => command<void>('overlay_dimming', { dimming }),
  getHistory: () => command<HistoryEntry[]>('get_history'),
  deleteHistory: (id: string | null) => command<void>('delete_history', { id }),
  // The real glass (src/glassBackdrop.ts): the glass surfaces this page shows right now, for
  // Windows' compositor to blur what is behind them. Answers whether the real glass shows;
  // false outside the native app (the painted material, or the page's own backdrop-filter).
  glassFrame: (seq: number, scale: number, shapes: { x: number; y: number; width: number; height: number; radius: number; opacity: number }[]) => native ? command<boolean>('glass_frame', { seq, scale, shapes }) : Promise.resolve(false),
  // The Windows app mode read by Rust (null when unknown, or outside the native app).
  systemTheme: () => native ? command<unknown>('system_theme').catch(() => null) : Promise.resolve(null),
  // Whether Windows asks to reduce animations (Rust reads SPI_GETCLIENTAREAANIMATION); null or
  // undefined when unknown, always unknown in the browser preview.
  systemMotion: () => command<SystemMotion | null | undefined>('system_motion'),
  on: event,
  setDemoCapture: (capture: Capture, scenario: DemoScenario = 'normal') => { demoCapture = capture; demoScenario = scenario; },
  // Browser preview only: what Rust emits when the shortcut finds nothing to translate.
  demoNotice: (message: string) => { if (!native) emit('capture-notice', { message }); },
  // Browser preview only: what Rust emits when the cursor changes screen under a bottom form.
  demoWorkArea: (screen: Screen) => { if (!native) emit('work-area', screen); },
  // Lot 10: the state of every binding (a chord another application holds is 'taken').
  shortcutStatus: () => command<ShortcutStatus[]>('shortcut_status'),
  // Lucas, 24/09: a chord for the menu that Windows gives now, when another application holds
  // its own (null: none of Rust's proposals is free); « Restore default settings », answering
  // what Rust saved.
  suggestShortcut: () => command<string | null>('suggest_shortcut'),
  resetSettings: () => command<Settings>('reset_settings'),
  // Lot 9, after a paste under the Îlot (docs/BRIDGE.md « the result »): where the pill goes for a
  // pill of this size; moving the window by (dx, dy) logical pixels at a moment nothing animates;
  // the changed words marked in the halo until the user's next action in the text (Rust ends
  // them itself, whatever Undo or the pill do).
  resultPill: (requestId: string, width: number, height: number) => command<PillTarget>('result_pill', { requestId, width, height }),
  moveOverlay: (captureId: string, dx: number, dy: number) => command<void>('move_overlay', { captureId, dx, dy }),
  highlightChanges: (requestId: string, ranges: TextRange[]) => command<HighlightResult>('highlight_changes', { requestId, ranges }),
  // Lot 9: undo a pasted result, once, after revalidation (`undo_result` → UndoOutcome). Read its
  // status: a resolved promise may be a refusal (`refused`: nothing was sent; `failed`: sent, the
  // original did not read back); a rejection is a French string (the result no longer current).
  undoResult: (requestId: string) => command<UndoOutcome>('undo_result', { requestId }),
  // `replace_result` with its refusal as Rust sends it, `{message, code}` (Refusal): the code says
  // why (target_changed, keys_held, not_editable, paste_blocked); `replace` keeps the message only,
  // for the glass of 0.4. The Îlot's own paste of a retried result reads the code (IlotStage).
  replaceResult: (requestId: string) => command<void>('replace_result', { requestId }),
};

