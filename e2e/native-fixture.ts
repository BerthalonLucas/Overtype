import {
  defaultActionId,
  defaultActions,
  defaultBindings,
  defaultMenuActionIds,
  instructionActionId,
  instructionActionName,
  instructionError,
} from '../src/actionDefaults';
// Browser-only IPC fixture. This does not launch a native window or read user data.
import { mockIPC, mockWindows } from '@tauri-apps/api/mocks';
import { emit } from '@tauri-apps/api/event';
import type {
  BindingState,
  Capture,
  DiagEntry,
  ErrorCode,
  ExecutionInfo,
  HaloEvent,
  PillSide,
  PillTarget,
  ProbeStepEvent,
  Rect,
  Settings,
  ShortcutStatus,
  TranslationRequest,
  UndoLoss,
  UndoOutcome,
} from '../src/types';
import {
  connectionCommand,
  isConnectionCommand,
  normalizeEndpoint,
  setConnScenario,
  type ConnScenario,
} from '../src/bridge.mock';
import { ilotReserve } from '../src/layout';
import { resetFrom } from '../src/settings/reset';

// The Îlot, as Rust's default (UiVersion::Ilot); `&ui=v4` in the URL starts in the 0.4 journey,
// for the tests that ask for it.
let settings: Settings = {
  defaultActionId,
  actions: structuredClone(defaultActions),
  shortcutBindings: structuredClone(defaultBindings),
  historyEnabled: false,
  autostart: false,
  textSize: 'normal',
  autoClose: 'normal',
  uiVersion: new URLSearchParams(location.search).get('ui') === 'v4' ? 'v4' : 'ilot',
  language: 'en',
  theme: 'system',
  motion: 'system',
  motionPreset: 'smooth',
  indicator: 'perle',
  afterReplace: { check: true, undo: true, undoSeconds: 8, changedWords: true, changedWordsSeconds: 60 },
  undoStrategy: 'keystroke',
  pillPlacement: 'below',
  glassMaterial: 'painted',
  menuActionIds: [...defaultMenuActionIds],
  // Two servers, named as the two profiles of 0.5 were, so the journeys that switch server keep their words.
  servers: [
    { id: 's1', name: 'Quality', endpoint: '', apiKey: '', noKey: false, model: 'test' },
    { id: 's2', name: 'Fast', endpoint: '', apiKey: '', noKey: false, model: 'test' },
  ],
  defaultServerId: 's1',
  setupDone: true,
  changedWordsStyle: 'encre',
};
// A fresh install's settings (Rust's Settings::default), for `reset_settings`.
const freshSettings: Settings = { ...structuredClone(settings), uiVersion: 'ilot' };
// What `suggest_shortcut` answers (Rust's first free proposal; null: none free).
let suggestion: string | null = 'Ctrl+Alt+Shift+Space';
// canReplace is false here; a test raises it with `target` (Rust knows it at the capture since 0.4.0).
// The fixture's captures are anchored on a 1920 × 1040 screen unless a test says otherwise.
const capture = (id: string, text = 'Example selection', execution?: ExecutionInfo): Capture => ({
  id,
  text,
  source: 'selection',
  canReplace: false,
  anchor: { x: 400, y: 300, width: 120, height: 18 },
  screen: { width: 1920, height: 1040, scale: 1 },
  ...(execution ? { execution } : {}),
});
const replaceExecution: ExecutionInfo = {
  actionId: 'correct',
  actionName: 'Corriger',
  outputMode: 'replace',
  serverId: 's1',
};
// Every command the page invokes, with the page's clock when it did (performance.now()).
const calls: Array<{ command: string; args: Record<string, unknown> | undefined; at: number }> = [];
let request: TranslationRequest;
// The current request's result as the model sent it (its deltas, or its `done` text): what Rust
// pastes, whose length its estimated place reads (never logged, never sent anywhere).
let resultText = '';
let currentCapture = capture('first');
let heldCopy = false;
let failSettings = new URLSearchParams(location.search).has('settingsError');
let refuseShortcut = false;
// Rust's refusal of the next `replace_result`: `{message, code}` (Refusal) since the review of
// da-ilot, the French message for the 0.4 glass, the code for the Îlot.
let refuseReplace: { message: string; code: ErrorCode } | null = null;
// Lot 9: what `undo_result` answers (Rust's UndoOutcome, or a rejection: its French string), at
// once or once released.
let undoAnswer: { outcome?: Partial<UndoOutcome>; reject?: string } = {};
let holdUndo = false;
let releaseUndo: (() => void) | undefined;
let resolveCopy: (() => void) | undefined;
// Lot 9: the new text's lines Rust found after its own paste (`pastedRects`, physical); none when
// it was not found. What the next `result_pill` calls answer instead of Rust's place ('refuse':
// rejected), in order. The next `move_overlay` refused. Each `move_overlay`, with what the page
// showed at that moment: the corner's opacity and the shape's box.
let pastedLines: Rect[] = [];
let pillAnswers: Array<Partial<PillTarget> | 'refuse'> = [];
let refuseMove = false;
const moves: Array<{
  dx: number;
  dy: number;
  at: number;
  opacity: string;
  shape: { width: number; height: number } | null;
}> = [];
// Rust's placement, ported line for line at scale 1 (src-tauri/src/placement.rs `overlay`,
// `pill_after_paste`, `estimated_text`, `clamp`; src-tauri/src/lib.rs `position`, `last_line`,
// `result_pill`): the fixture answers what Rust would, not a version that suits the tests.
const clampTo = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high);
const clampRect = (work: Rect, x: number, y: number, width: number, height: number): Rect => {
  const w = Math.min(width, work.width),
    h = Math.min(height, work.height);
  return {
    x: clampTo(x, work.x, work.x + work.width - w),
    y: clampTo(y, work.y, work.y + work.height - h),
    width: w,
    height: h,
  };
};
const intersects = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
// The line the new text ends on: the lowest one, the rightmost of that row (the last of equals).
const lastLine = (lines: Rect[]): Rect | undefined => {
  const lowest = Math.max(...lines.map((line) => line.y + line.height / 2));
  return lines
    .filter((line) => line.y <= lowest && lowest <= line.y + line.height)
    .reduce<Rect | undefined>(
      (best, line) => (!best || line.x + line.width >= best.x + best.width ? line : best),
      undefined,
    );
};
// The pasted text not found: the old selection's lines grown or shrunk by the ratio of the
// lengths (at least one line), ending on the old anchor moved by that many lines.
const estimatedText = (oldLines: Rect[], anchor: Rect, oldLength: number, newLength: number) => {
  const lines = oldLines.length ? oldLines : [anchor];
  const rows = lines.length;
  const newRows = clampTo(Math.ceil((rows * newLength) / Math.max(oldLength, 1)), 1, 64);
  const end = { ...anchor, y: anchor.y + (newRows - rows) * anchor.height };
  const left = Math.min(...lines.map((line) => line.x)),
    top = Math.min(...lines.map((line) => line.y));
  const right = Math.max(...lines.map((line) => line.x + line.width));
  const bottom = Math.max(end.y + end.height, top + anchor.height);
  return { block: [{ x: left, y: top, width: right - left, height: bottom - top }], end };
};
// Under the last line, its right edge on that line's end; no room below: above the first line;
// `margin`: right of the text, centred on the last line, tried first. Never over a line: `clear`
// is false only when no candidate fits the work area (then below, clamped).
const pillAfterPaste = (
  lines: Rect[],
  end: Rect,
  work: Rect,
  width: number,
  height: number,
  gap: number,
  margin: boolean,
): { rect: Rect; side: PillSide; clear: boolean } => {
  const block = [...lines, end];
  const top = Math.min(...block.map((line) => line.y)),
    bottom = Math.max(...block.map((line) => line.y + line.height));
  const right = Math.max(...block.map((line) => line.x + line.width));
  const xEnd = clampTo(end.x + end.width - width, work.x, Math.max(work.x + work.width - width, work.x));
  const below = { x: xEnd, y: bottom + gap, width, height };
  const above = { x: xEnd, y: top - gap - height, width, height };
  const beside = {
    x: right + gap,
    y: clampTo(end.y + (end.height - height) / 2, work.y, Math.max(work.y + work.height - height, work.y)),
    width,
    height,
  };
  const fits = (rect: Rect) =>
    rect.x >= work.x &&
    rect.y >= work.y &&
    rect.x + rect.width <= work.x + work.width &&
    rect.y + rect.height <= work.y + work.height;
  const clear = (rect: Rect) => !block.some((line) => intersects(line, rect));
  const order: Array<[Rect, PillSide]> = margin
    ? [
        [beside, 'margin'],
        [below, 'below'],
        [above, 'above'],
      ]
    : [
        [below, 'below'],
        [above, 'above'],
        [beside, 'margin'],
      ];
  const found = order.find(([rect]) => fits(rect) && clear(rect));
  if (found) return { rect: found[0], side: found[1], clear: true };
  const rect = clampRect(work, below.x, below.y, width, height);
  return { rect, side: 'below', clear: clear(rect) };
};
// `result_pill` for the current request: from the new text's lines (`pastedLines`), else
// estimated from the selection; relative to the window as it stands, `inside` within half a pixel
// of it. A refusal is Rust's French string.
const resultPill = (requestId: string, width: number, height: number): PillTarget | string => {
  if (![width, height].every((value) => Number.isFinite(value) && value > 0)) return 'Dimensions invalides.';
  if (requestId !== request?.id) return 'Ce résultat n’est plus actif.';
  let lines = pastedLines,
    end = lastLine(pastedLines),
    estimated = false;
  if (!lines.length || !end) {
    const old = currentCapture.selectionRects ?? [];
    const anchor = currentCapture.anchor ?? lastLine(old);
    if (!anchor) return 'Aucun emplacement pour la pilule.';
    const guess = estimatedText(old, anchor, [...currentCapture.text].length, [...resultText].length);
    [lines, end, estimated] = [guess.block, guess.end, true];
  }
  const { rect, side, clear } = pillAfterPaste(
    lines,
    end,
    workArea,
    width,
    height,
    8,
    settings.pillPlacement === 'margin',
  );
  const window = windowNow(),
    reserve = ilotReserve('anchored');
  const x = rect.x - window.x,
    y = rect.y - window.y;
  const inside = x >= -0.5 && y >= -0.5 && x + width <= reserve.width + 0.5 && y + height <= reserve.height + 0.5;
  return { x, y, side, inside, estimated, clear };
};
// Rust's reading of « Effets d'animation »: unknown until a test sets it.
let windowsMotion: { reduced: boolean } | null = null;
// Îlot (lots 3–4): whether the overlay gets the foreground, and the menu capture's choice.
let overlayFocus = true;
const chosen = new Set<string>();
// Where Rust put the overlay window (physical pixels), for the Îlot's side and the pill's place.
// An anchored menu capture as `position` places it: the strip (src/layout.ts, ilotReserve) 8 px
// under the selection, its right edge on the selection's end, kept in the work area; above the
// selection when 220 px do not fit under it, the side decided once per capture. Any other capture
// keeps the strip's place under the fixture's default anchor (the glass's own frame is not
// modelled). A test may put the window elsewhere (`windowAt`).
let windowOverride: { x: number; y: number } | null = null;
let placedSide: { captureId: string; below: boolean } | null = null;
const placedWindow = () => {
  const anchor = currentCapture.menu ? currentCapture.anchor : null;
  const { frame } = ilotReserve('anchored');
  if (!anchor) return { x: 400 + 120 - (frame.x + frame.width), y: 300 + 18 + 8 - frame.y };
  const work = workArea;
  if (placedSide?.captureId !== currentCapture.id)
    placedSide = { captureId: currentCapture.id, below: anchor.y + anchor.height + 8 + 220 <= work.y + work.height };
  const width = Math.min(frame.width, work.width),
    height = Math.min(frame.height, work.height);
  const x = clampTo(anchor.x + anchor.width - width, work.x, work.x + work.width - width);
  const y = clampTo(
    placedSide.below ? anchor.y + anchor.height + 8 : anchor.y - frame.height - 8,
    work.y,
    work.y + work.height - height,
  );
  return { x: x - frame.x, y: y - frame.y };
};
// Lot 9: how far `move_overlay` moved the window since the capture (Rust resets it at the next one).
let moved = { x: 0, y: 0 };
let movedFor: string | undefined;
const windowNow = () => {
  const at = windowOverride ?? placedWindow();
  return { x: at.x + moved.x, y: at.y + moved.y };
};
// While held, every read of that position answers only once released: the Îlot waits for its
// side. Every read, not the next one: the glass reads it too (the working pill's side), and its
// read can come after the hold under load.
let holdPosition = false;
let heldReads: Array<() => void> = [];
// The work area of the screen holding a point (`monitorFromPoint`, physical pixels), for the room
// the Îlot has around its strip: one 1920 × 1080 screen, its taskbar 40 high.
let workArea = { x: 0, y: 0, width: 1920, height: 1040 };
const monitor = () => ({
  name: 'fixture',
  scaleFactor: 1,
  position: { x: 0, y: 0 },
  size: { width: 1920, height: 1080 },
  workArea: { position: { x: workArea.x, y: workArea.y }, size: { width: workArea.width, height: workArea.height } },
});
// The next `choose_action` is refused, as when the chosen action was deleted meanwhile.
let refuseChoice = false;
// The next `choose_action` answers only once released: a choice still on its way.
let holdChoice = false;
let releaseChoice: (() => void) | undefined;
// Lot 10: what Windows answered for each binding (`shortcut_status`); by default every enabled
// chord is registered. A test sets a binding's state (another application holds the chord: 'taken'),
// or the URL does before the window opens (`&shortcutTaken=<binding id>`).
let shortcutStates: Record<string, BindingState> = {};
const takenAtStart = new URLSearchParams(location.search).get('shortcutTaken');
if (takenAtStart) shortcutStates[takenAtStart] = 'taken';
const shortcutStatus = (): ShortcutStatus[] =>
  settings.shortcutBindings.map((b) => ({
    bindingId: b.id,
    shortcut: b.shortcut,
    state: shortcutStates[b.id] ?? (b.enabled ? 'registered' : 'disabled'),
  }));
mockIPC(
  (command, args) => {
    calls.push({ command, args, at: performance.now() });
    // Rust places each capture afresh: the previous capture's move is forgotten.
    if (command === 'resize_overlay' && (args as { captureId?: string } | undefined)?.captureId !== movedFor) {
      movedFor = (args as { captureId?: string } | undefined)?.captureId;
      moved = { x: 0, y: 0 };
    }
    if (command === 'get_settings') {
      if (failSettings) {
        return Promise.reject('Synthetic settings failure');
      }
      return settings;
    }
    if (command === 'get_history') return [];
    if (command === 'system_motion') return windowsMotion;
    if (command === 'save_settings') {
      const next = structuredClone(args?.settings as Settings);
      if (refuseShortcut && JSON.stringify(next.shortcutBindings) !== JSON.stringify(settings.shortcutBindings))
        return Promise.reject('Le raccourci est déjà utilisé ou indisponible.');
      // As Rust (settings::sanitize, then validate): an address that does not read is refused;
      // what is saved is clean (the address normalised, no key for a server without one).
      if (next.servers.some((server) => server.endpoint.trim() !== '' && !normalizeEndpoint(server.endpoint).ok))
        return Promise.reject('L’adresse du serveur est invalide.');
      next.servers = next.servers.map((server) => {
        const endpoint = normalizeEndpoint(server.endpoint);
        return {
          ...server,
          endpoint: endpoint.ok ? endpoint.base : '',
          model: server.model.trim(),
          apiKey: server.noKey ? '' : server.apiKey,
        };
      });
      // As Rust: a binding saved on another chord registered it (a taken one refuses the save), and
      // every save sends the state of each shortcut.
      for (const binding of next.shortcutBindings)
        if (settings.shortcutBindings.find((b) => b.id === binding.id)?.shortcut !== binding.shortcut)
          delete shortcutStates[binding.id];
      settings = next;
      void emit('shortcut-status', shortcutStatus());
      return;
    }
    // As Rust (settings::reset): saved like any change, answered with what was saved; when Windows
    // refuses the default chord (`refuseShortcut`), the menu keeps its own (settings::keep_menu_chord).
    if (command === 'reset_settings') {
      let next = resetFrom(freshSettings, settings);
      const own = settings.shortcutBindings.find((b) => b.kind === 'menu' && b.enabled);
      if (refuseShortcut && own)
        next = {
          ...next,
          shortcutBindings: next.shortcutBindings.map((b) =>
            b.kind === 'menu' ? { ...b, shortcut: own.shortcut } : b,
          ),
        };
      for (const binding of next.shortcutBindings)
        if (settings.shortcutBindings.find((b) => b.id === binding.id)?.shortcut !== binding.shortcut)
          delete shortcutStates[binding.id];
      settings = next;
      void emit('shortcut-status', shortcutStatus());
      return structuredClone(settings);
    }
    if (command === 'suggest_shortcut') return suggestion;
    // 0.6: the connection commands answer from the simulated server of the preview (src/bridge.mock.ts),
    // its scenario chosen by `?conn=` or `nativeFixture.conn(id)`; steps and journal lines arrive as events.
    if (isConnectionCommand(command))
      return connectionCommand(
        command,
        args,
        (name, payload: ProbeStepEvent | DiagEntry) => {
          void emit(name, payload);
        },
        (id) => settings.servers.find((server) => server.id === id),
      );
    if (command === 'finish_setup') {
      settings = { ...settings, setupDone: true };
      void emit('settings-changed', settings);
      return undefined;
    }
    if (command === 'close_demo') {
      void emit('demo-ended', { done: (args as { done?: boolean } | undefined)?.done === true });
      return undefined;
    }
    if (command === 'frontend_ready') return currentCapture;
    if (command === 'translate') {
      request = args?.request as TranslationRequest;
      resultText = '';
    }
    if (command === 'focus_overlay') return overlayFocus;
    if (command === 'plugin:window|inner_position') {
      if (!holdPosition) return windowNow();
      return new Promise((resolve) => {
        heldReads.push(() => resolve(windowNow()));
      });
    }
    if (command === 'plugin:window|monitor_from_point') return monitor();
    if (command === 'choose_action') {
      const { captureId, actionId, instruction } = args as {
        captureId: string;
        actionId: string;
        instruction?: string;
      };
      if (captureId !== currentCapture.id || !currentCapture.menu)
        return Promise.reject('Cette capture n’attend pas de choix.');
      if (refuseChoice) {
        refuseChoice = false;
        return Promise.reject('L’action n’existe plus.');
      }
      if (chosen.has(captureId)) return Promise.reject('Une action a déjà été choisie pour cette sélection.');
      const action = settings.actions.find((item) => item.id === actionId);
      if (instruction !== undefined ? actionId !== instructionActionId || instructionError(instruction) : !action)
        return Promise.reject('L’action n’existe plus.');
      chosen.add(captureId);
      const execution = {
        actionId,
        actionName: action?.name ?? instructionActionName,
        outputMode: 'replace',
        serverId: settings.defaultServerId,
      } satisfies ExecutionInfo;
      if (holdChoice) {
        holdChoice = false;
        return new Promise<ExecutionInfo>((resolve) => {
          releaseChoice = () => resolve(execution);
        });
      }
      return execution;
    }
    if (command === 'shortcut_status') return shortcutStatus();
    if (command === 'shortcut_conflict')
      return (args as { shortcut: string }).shortcut === 'Ctrl+Alt+E'
        ? { altGr: true, character: '€' }
        : { altGr: false };
    // Lot 10's `open_settings({ field })` on an open Settings window: the event it will send.
    if (command === 'open_settings' && args?.field) return emit('settings-focus-field', { field: args.field });
    if (command === 'start_drag') return Promise.reject('Synthetic drag failure');
    if (command === 'dismiss_overlay') return emit('overlay-dismiss-requested', { captureId: currentCapture.id });
    if (command === 'copy_result' && heldCopy)
      return new Promise<void>((resolve) => {
        resolveCopy = resolve;
      });
    // Lot 9: Rust undoes once, after revalidation; the marks it draws are counted, never shown here.
    if (command === 'undo_result') {
      const requestId = (args as { requestId: string }).requestId;
      const answer = () =>
        undoAnswer.reject !== undefined
          ? Promise.reject(undoAnswer.reject)
          : Promise.resolve({
              requestId,
              status: 'undone',
              confirmed: true,
              message: 'Remplacement annulé.',
              ...undoAnswer.outcome,
            } satisfies UndoOutcome);
      if (!holdUndo) return answer();
      holdUndo = false;
      return new Promise((resolve, reject) => {
        releaseUndo = () => {
          answer().then(resolve, reject);
        };
      });
    }
    // Lot 9: the pill's place, and the window moved under a faded pill.
    if (command === 'result_pill') {
      const { requestId, width, height } = args as { requestId: string; width: number; height: number };
      const next = pillAnswers.shift();
      if (next === 'refuse') return Promise.reject('Ce résultat n’est plus actif.');
      const place = resultPill(requestId, width, height);
      return typeof place === 'string' ? Promise.reject(place) : { ...place, ...next };
    }
    if (command === 'move_overlay') {
      const { captureId, dx, dy } = args as { captureId: string; dx: number; dy: number };
      const corner = document.querySelector('.ilot-corner');
      const shape = document.querySelector('[data-ilot-shape]')?.getBoundingClientRect();
      moves.push({
        dx,
        dy,
        at: performance.now(),
        opacity: corner ? getComputedStyle(corner).opacity : '',
        shape: shape ? { width: shape.width, height: shape.height } : null,
      });
      if (refuseMove) {
        refuseMove = false;
        return Promise.reject('Déplacement refusé.');
      }
      // As Rust: a finite move within the work area, for the current anchored capture.
      if (
        !Number.isFinite(dx) ||
        !Number.isFinite(dy) ||
        Math.abs(dx) > workArea.width ||
        Math.abs(dy) > workArea.height
      )
        return Promise.reject('Déplacement invalide.');
      if (captureId !== currentCapture.id) return Promise.reject('La capture n’est plus active.');
      if (!currentCapture.anchor) return Promise.reject('Seule la fenêtre ancrée se déplace.');
      moved = { x: moved.x + dx, y: moved.y + dy };
      return;
    }
    if (command === 'highlight_changes') {
      const ranges = (args as { ranges: unknown[] }).ranges;
      return { ranges: ranges.length, lines: ranges.length };
    }
    if (command === 'replace_result' && refuseReplace !== null) {
      void emit('capture-target', { captureId: currentCapture.id, canReplace: false });
      return Promise.reject(refuseReplace);
    }
  },
  { shouldMockEvents: true },
);
mockWindows('overlay');

Object.assign(window, {
  nativeFixture: {
    calls,
    recoverSettings: () => {
      failSettings = false;
    },
    refuseShortcut: () => {
      refuseShortcut = true;
    },
    refuseReplace: (
      message: string | null = 'La fenêtre source a changé; remplacement refusé.',
      code: ErrorCode = 'target_changed',
    ) => {
      refuseReplace = message === null ? null : { message, code };
    },
    // A failed request; lot 10 sends its code beside the French message (none: a 0.4 error).
    error: (code?: ErrorCode, message = 'Serveur indisponible.') =>
      emit('translation', { requestId: request.id, kind: 'error', message, ...(code ? { code } : {}) }),
    capture: (id: string, text?: string) => {
      currentCapture = capture(id, text);
      return emit('capture', currentCapture);
    },
    // A « replace » capture: Rust will paste the first complete result and report `result-delivery`.
    captureReplace: (id: string, text?: string) => {
      currentCapture = { ...capture(id, text, replaceExecution), canReplace: true };
      return emit('capture', currentCapture);
    },
    deliver: async (
      status: 'applied' | 'fallback',
      confirmed = status === 'applied',
      message = status === 'applied' ? 'Sélection remplacée.' : 'Le collage a été bloqué; utilisez Copier.',
      code?: ErrorCode,
    ) => {
      pastedLines = [];
      await emit('capture-target', { captureId: currentCapture.id, canReplace: false });
      await emit('result-delivery', { requestId: request.id, status, confirmed, message, ...(code ? { code } : {}) });
    },
    // Lot 9: Rust's own paste under the Îlot, its text found (`pastedRects`, physical) and Undo on
    // (`undoable`), or not.
    pasted: async ({
      undoable = true,
      pastedRects = [{ x: 380, y: 300, width: 140, height: 18 }],
    }: {
      undoable?: boolean;
      pastedRects?: Rect[];
    } = {}) => {
      pastedLines = pastedRects;
      await emit('capture-target', { captureId: currentCapture.id, canReplace: false });
      await emit('result-delivery', {
        requestId: request.id,
        status: 'applied',
        confirmed: true,
        message: 'Sélection remplacée.',
        pastedRects,
        undoable,
      });
    },
    // What the next `undo_result` answers: an outcome (undone by default), or a rejection.
    undoWith: (outcome: Partial<UndoOutcome>) => {
      undoAnswer = { outcome };
    },
    undoRejects: (message = 'Ce résultat n’est plus actif.') => {
      undoAnswer = { reject: message };
    },
    holdUndo: () => {
      holdUndo = true;
    },
    releaseUndo: () => {
      releaseUndo?.();
      releaseUndo = undefined;
    },
    // Rust withdrew Undo: a key in the source, the user's own Ctrl+Z, the caret moved.
    undoState: (reason: UndoLoss = 'typed', requestId = request.id) =>
      emit('undo-state', { requestId, available: false, reason }),
    // The next `result_pill` answers (a part of a PillTarget over Rust's own, or 'refuse').
    pillAnswer: (answer: Partial<PillTarget> | 'refuse') => {
      pillAnswers.push(answer);
    },
    refuseMove: () => {
      refuseMove = true;
    },
    moves,
    // Where the window is now (physical): Rust's place plus the moves of this capture.
    windowPosition: () => windowNow(),
    delta: (text: string, requestId = request.id) => {
      if (requestId === request.id) resultText += text;
      return emit('translation', { requestId, kind: 'delta', text });
    },
    done: (text?: string) => {
      if (text !== undefined) resultText = text;
      return emit('translation', { requestId: request.id, kind: 'done', ...(text === undefined ? {} : { text }) });
    },
    dismissEvent: (captureId: string) => emit('overlay-dismiss-requested', { captureId }),
    requestId: () => request.id,
    holdCopy: () => {
      heldCopy = true;
    },
    releaseCopy: () => {
      resolveCopy?.();
      heldCopy = false;
    },
    near: (near: boolean) => emit('glass-near', { near }),
    target: (captureId: string, canReplace: boolean) => emit('capture-target', { captureId, canReplace }),
    notice: (message: string, code?: ErrorCode) => emit('capture-notice', { message, ...(code ? { code } : {}) }),
    // The watcher dropped the selection (lot 10: code target_changed).
    invalidate: (anchorLost = false, captureId = currentCapture.id) =>
      emit('target-invalidated', { captureId, anchorLost, message: 'La sélection a changé.', code: 'target_changed' }),
    // Lot 10: what Windows answered for each binding; sent as `shortcut-status` when `emitNow`.
    shortcutStates: (states: Record<string, BindingState>, emitNow = true) => {
      shortcutStates = states;
      return emitNow ? emit('shortcut-status', shortcutStatus()) : undefined;
    },
    workArea: (width: number, height: number, scale = 1) => emit('work-area', { width, height, scale }),
    systemMotion: (reduced: boolean) => {
      windowsMotion = { reduced };
      return emit('system-motion', windowsMotion);
    },
    settings: (next: Partial<Settings>) => {
      settings = { ...settings, ...next };
      return emit('settings-changed', settings);
    },
    // What Rust holds now, and what its next `suggest_shortcut` answers.
    current: () => structuredClone(settings),
    suggestion: (value: string | null) => {
      suggestion = value;
    },
    // Lot 13: a direct link to a field of the open Settings window.
    focusField: (field: string) => emit('settings-focus-field', { field }),
    unanchored: (id: string) => {
      currentCapture = { ...capture(id), source: 'clipboard', anchor: null };
      return emit('capture', currentCapture);
    },
    // A `menu` capture under the Îlot: no execution until choose_action.
    captureMenu: (id: string, lastActionId: string | null = null, text?: string) => {
      currentCapture = { ...capture(id, text), canReplace: true, menu: { lastActionId } };
      return emit('capture', currentCapture);
    },
    refuseFocus: () => {
      overlayFocus = false;
    },
    grantFocus: () => {
      overlayFocus = true;
    },
    refuseChoice: () => {
      refuseChoice = true;
    },
    holdChoice: () => {
      holdChoice = true;
    },
    releaseChoice: () => {
      releaseChoice?.();
      releaseChoice = undefined;
    },
    // A menu capture without an anchor (clipboard): the Îlot opens at the bottom of the screen.
    unanchoredMenu: (id: string, lastActionId: string | null = null) => {
      currentCapture = { ...capture(id), source: 'clipboard', anchor: null, canReplace: true, menu: { lastActionId } };
      return emit('capture', currentCapture);
    },
    // Rust placed the window elsewhere (above the selection, another screen): physical pixels.
    windowAt: (x: number, y: number) => {
      windowOverride = { x, y };
    },
    // The reads of the window's position wait for releasePosition (the Îlot not shown yet).
    holdPosition: () => {
      holdPosition = true;
    },
    releasePosition: () => {
      holdPosition = false;
      for (const read of heldReads.splice(0)) read();
    },
    // The work area of the anchor's screen (physical pixels): a taskbar on the left, another screen.
    workAreaAt: (x: number, y: number, width: number, height: number) => {
      workArea = { x, y, width, height };
    },
    menuKey: (key: string, shiftKey = false, captureId = currentCapture.id) =>
      emit('menu-key', { captureId, key, shiftKey }),
    // Lot 4: the menu shortcut pressed twice within 400 ms while its menu waits.
    menuRepeat: (captureId = currentCapture.id) => emit('menu-repeat', { captureId }),
    // Lot 6: what Rust sends the halo window (lines in logical pixels relative to it).
    halo: (event: HaloEvent) => emit('halo', event),
    // 0.6: the scenario of the simulated server (ok, cle-requise, cle-refusee, pas-d-api, refuse, delai, certificat, dns, vide, lent).
    conn: (scenario: ConnScenario) => setConnScenario(scenario),
    replay: (id: string) => {
      currentCapture = {
        ...capture(id, 'Example selection'),
        source: 'clipboard',
        canReplace: false,
        anchor: null,
        replay: { requestId: `replay-${id}`, translatedText: 'Exemple de sélection', serverId: 's1' },
      };
      return emit('capture', currentCapture);
    },
  },
});
await import('../src/main');
