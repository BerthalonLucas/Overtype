import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { AnimatePresence } from 'motion/react';
import { bridge } from '../bridge';
import { defaultActionId, instructionActionId } from '../actionDefaults';
import { useT } from '../i18n';
import {
  ilotFits,
  ilotMenuShift,
  ilotPlace,
  ilotRegion,
  ilotReserve,
  ilotRoom,
  ilotShift,
  ilotSide,
  ilotStrip,
  placeX,
  type IlotPlace,
  type IlotRoom,
  type IlotShapeBox,
  type IlotSide,
} from '../layout';
import { indicatorOf } from '../loaders/pill';
import { useMotionPreset, useReducedMotionSetting } from '../motion/MotionPreferences';
import { animateCorner, fadeCorner, type CornerMove, type CornerOffset } from '../motion/surface';
import { checkOnlyMs, Countdown, resultTiming } from '../result/countdown';
import { errorCodeOf, refusalCode, type ErrorAction } from '../result/errors';
import { changedRanges } from '../result/highlight';
import { resultContent, type ActionAnswer, type ResultStage } from '../result/ResultPill';
import type {
  ActionDefinition,
  Capture,
  ErrorCode,
  HitRegion,
  PillSide,
  PillTarget,
  Presentation,
  Settings,
} from '../types';
import type { TranslationController } from '../useTranslation';
import { Ilot, type IlotHandle, type IlotKeyboard } from './Ilot';
import { browserShortcut, keyInputOf, maxTiles, type KeyInput } from './keys';
import { ilotMetrics } from './metrics';
import { MorphSurface, type ShapeChange, type SurfaceSize } from './MorphSurface';
import { effectiveAfterReplace, ilotOutcome, ownPasteRefusal, type OwnPaste, type UndoProgress } from './outcome';

/*
 * The Îlot in the overlay (lot 7, uiVersion 'ilot'): a menu capture (`capture.menu`, no execution
 * yet) opens the Îlot by its selection; the choice goes through `choose_action` once
 * (useTranslation.choose), then the same surface, never unmounted, carries the whole result
 * (lots 8 to 10, src/result/ResultPill.tsx resultContent): the work pill while the model works and
 * Rust pastes; the check once pasted, then it leaves; or the error pill, its one button after the
 * code's family (src/result/errors.ts). The glass never opens for this journey. docs/BRIDGE.md, Îlot.
 *   keyboard  `focus_overlay` once: true, the WebView has the keys; false, Rust forwards them as
 *             `menu-key` (Îlot 'injected' mode), kept by useTranslation until the Îlot shows. The
 *             window's own focus (a click on the Îlot) also gives the keys to the WebView, and the
 *             ✦ clicked in 'injected' mode asks `focus_overlay` again. The last signal wins, a
 *             forwarded key saying the source is in front. The browser's own shortcuts (F5, Ctrl+R, Ctrl+P,
 *             Ctrl+F, zoom, Alt+←) and Ctrl + wheel do nothing (keys.ts browserShortcut). A key
 *             the window receives before the Îlot shows (activated, the side still being read) is
 *             kept and replayed once it shows, after the forwarded ones: none is lost.
 *   window    reserved once for the largest shape (src/layout.ts, ilotReserve): shapes only change
 *             the hit-test region, published at the start of a change on both shapes and at its
 *             end on the new one; the window never resizes while the surface springs.
 *   side      read back from where Rust put the window (ilotSide), before the Îlot shows.
 *   slide     read at the same time: the room between the strip's corner and the work area's
 *             edges (ilotRoom, the anchor screen's work area). A shape wider than the room on the
 *             left (the error pill, near the screen's left edge) slides right by what it
 *             overhangs, on the shape's own spring (ilotShift); the region follows.
 *   opening   the menu opens right of the compact bubble when the work area has room there for
 *             its widest shape, keeping the compact's left edge (the corner moves right by what the
 *             shape outgrows it, on the shape's spring, ilotMenuShift); else left, as near the
 *             screen's right edge. Once chosen, the pill goes back to the strip's corner.
 *   outcome   src/menu/outcome.ts: the stage the surface shows, derived from the translation.
 *   lost      `target-invalidated` before any choice (none on its way either): the Îlot leaves.
 *   buttons   configuration → open_settings on the request's field, then the Îlot leaves;
 *             transient → Try again: the same action on the same capture (useTranslation.start,
 *             the v4 relaunch), whose result the Îlot pastes itself (replace_result, once: Rust
 *             delivers a capture's first request only; a refusal reads as its code, `{message,
 *             code}`, src/result/errors.ts refusalCode); paste → Copy result (copy_result), nothing
 *             replaced; content → ✕ only; cancelled → the Îlot leaves. ✕ and Escape close.
 *   Undo      lot 9: after Rust's own paste (`result-delivery` applied), the check, then Undo and
 *             its ring while Rust offers it (`undoable`). One click asks `undo_result` once:
 *             `undone` → « Undone », then the Îlot leaves; refused or failed → the error pill in
 *             Undo's words, ✕ only; nothing else is ever pasted. `undo-state` withdraws it (even
 *             before the delivery): the user's own Ctrl+Z (`undo_key`) undid the paste →
 *             « Undone » 0.9 s, then the Îlot leaves, as the lab's Ctrl+Z; a key or the caret
 *             (`typed`, `caret_moved`) → the check alone takes its place on the same clock (the
 *             surface's corner fixed), 1.1 s at most, then the Îlot leaves. The time stands still
 *             under the pointer, on the focus, while Undo is on its way and while the pill is out
 *             of sight (place, below); at its end the Îlot leaves. A retried result the Îlot
 *             pasted itself has no Undo (Rust's own only).
 *   marks     lot 9, « mise en valeur » (Lucas 25/09): the changed words (src/result/highlight.ts,
 *             afterReplace.changedWords) asked once per replacement with `highlight_changes`
 *             after Rust's own paste, Undo offered or not. Rust ends them at the user's next
 *             action in the text or after afterReplace.changedWordsSeconds: neither the
 *             countdown, nor Undo's withdrawal, nor the Îlot leaving takes them.
 *   place     lot 9: after Rust's own paste (anchored), the pill goes where Rust puts it, never over
 *             the new text: `result_pill` for the size of the check's pill, at the start of its
 *             shape (again for a wider shape later: an Undo's error). In the window, on the same
 *             side of the text as it stands (below then below, above then above): the corner
 *             glides there in the DOM (surfaceMove, the lab's 420 ms move), the region holding
 *             every position on the way. Across the text (the other side, the margin): it never
 *             sweeps over it; the corner fades out, takes its place at once and fades back in.
 *             Outside the window: the corner fades out at once, `move_overlay` moves the window
 *             once everything rests (never while anything animates), `result_pill` answers again
 *             for the moved window, and the pill fades back in at its place. A refusal leaves it
 *             where it is. The check alone keeps that place's corner (the left edge in the margin);
 *             « Undone » goes back to the strip's corner, against the original text, or, the
 *             window moved, the Îlot leaves without it.
 */

// How long the Îlot waits for Rust's placement before it opens anyway (below the selection); the
// glass's working pill waits as long for its side (GlassOverlay).
export const SIDE_WAIT_MS = 400;
// Keys that only modify another: never kept for the Îlot (a chord's release is not a key).
const modifierKeys: ReadonlySet<string> = new Set([
  'Control',
  'Alt',
  'AltGraph',
  'Shift',
  'Meta',
  'OS',
  'CapsLock',
  'NumLock',
  'ScrollLock',
  'Fn',
]);

// The menu's actions, in the user's order (settings.menuActionIds). An empty list is the user's
// choice (the Settings say « only the free instruction »): no action tile, only « Ask ». Only a
// settings object without the field (a preview, a fixture) falls back to the first six. A grid
// action without a letter keeps none: Rust assigns the letters at the migration.
export function menuActions(settings: Settings | null): ActionDefinition[] {
  const actions = settings?.actions ?? [];
  const ids = settings?.menuActionIds ?? actions.slice(0, maxTiles).map((action) => action.id);
  return ids
    .map((id) => actions.find((action) => action.id === id))
    .filter((action): action is ActionDefinition => Boolean(action))
    .slice(0, maxTiles);
}

export function IlotStage({ controller, capture }: { controller: TranslationController; capture: Capture }) {
  const {
    state,
    settings,
    screen,
    choose,
    choosingCaptureId,
    start,
    menuKeys,
    takeMenuKeys,
    forwardedKeys,
    cancelAndDismiss,
    completeDismiss,
    closingCaptureId,
  } = controller;
  const t = useT();
  const captureId = capture.id;
  const presentation: Presentation = capture.anchor ? 'anchored' : 'bottom';
  const reserve = useMemo(() => ilotReserve(presentation), [presentation]);
  const indicator = indicatorOf(settings?.indicator);
  const actions = useMemo(() => menuActions(settings), [settings]);
  const lastActionId = capture.menu?.lastActionId ?? settings?.defaultActionId ?? defaultActionId;
  const closing = closingCaptureId === captureId;
  const closingRef = useRef(closing);
  closingRef.current = closing;
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Unknown until Rust placed and showed the window, so the entrance plays where it is seen; the
  // browser preview has no window. Without an anchor the Îlot grows up from the bottom.
  const [side, setSide] = useState<IlotSide | null>(() =>
    bridge.native ? null : presentation === 'bottom' ? 'above' : 'below',
  );
  // Read with the side (anchored, native only): the room around the strip's corner (ilotRoom).
  const [room, setRoom] = useState<IlotRoom | null>(null);
  const roomNow = useRef(room);
  roomNow.current = room;
  // The keyboard: the last answer that the window has it or not (focus_overlay, or the window's
  // own focus), unless Rust forwarded a key since (the source is in front then). Derived in the
  // same render as the key, so the key meets the right mode. `after` is the live count of the keys
  // received when the answer came (useTranslation.forwardedKeys), not the last render's.
  const forwarded = menuKeys.captureId === captureId ? menuKeys.count : 0;
  const [focus, setFocus] = useState<{ keyboard: IlotKeyboard; after: number }>({ keyboard: 'focused', after: 0 });
  const keyboard: IlotKeyboard = forwarded > focus.after ? 'injected' : focus.keyboard;
  const [choosing, setChoosing] = useState(false);
  const [refusal, setRefusal] = useState('');
  const handle = useRef<IlotHandle>(null);

  // One region at a time in a window that never changes (the reserve and its frame). The same
  // geometry published again waits for the same placement.
  const last = useRef<{ signature: string; placed: Promise<void> } | null>(null);
  const publish = useCallback(
    (region: HitRegion): Promise<void> => {
      if (!bridge.native || closingRef.current) return Promise.resolve();
      const geometry = { captureId, presentation, regions: [region], frame: reserve.frame };
      const signature = JSON.stringify(geometry);
      if (last.current?.signature === signature) return last.current.placed;
      const placed = bridge.resize(reserve.width, reserve.height, geometry).catch(() => {
        if (last.current?.signature === signature) last.current = null;
      });
      last.current = { signature, placed };
      return placed;
    },
    [captureId, presentation, reserve],
  );

  // The first geometry places and shows the window with the strip as its region; the window's
  // position then tells the side and, with the work area, the room, read once.
  const sideAsked = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: once per capture: GlassOverlay keys it by capture
  useLayoutEffect(() => {
    if (!bridge.native) return;
    const anchor = capture.anchor;
    const scale = capture.screen?.scale ?? screen?.scale ?? 1;
    const placed =
      last.current?.placed ??
      publish(ilotRegion(presentation, 'below', { width: ilotStrip, height: ilotMetrics.compactHeight }));
    const fallback: IlotSide = anchor ? 'below' : 'above';
    if (!sideAsked.current) {
      sideAsked.current = true;
      // Rust places a capture on the screen of its anchor's centre (host::monitor_at).
      const work = anchor
        ? bridge.workAreaAt(anchor.x + anchor.width / 2, anchor.y + anchor.height / 2).catch(() => null)
        : Promise.resolve(null);
      void placed
        .then(() => (anchor ? bridge.windowPosition() : null))
        .catch(() => null)
        .then(async (position) => {
          const area = await work;
          if (!alive.current) return;
          if (anchor && position && area) setRoom(ilotRoom(position.x, scale, area));
          setSide((known) => known ?? (anchor && position ? ilotSide(position.y, scale, anchor) : fallback));
        });
    }
    const timer = window.setTimeout(() => setSide((known) => known ?? fallback), SIDE_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, []);

  // The corner moves with a shape the room on its left cannot hold (ilotShift): on the shape's
  // spring when it changes, at once for the first shape. After Rust's paste it goes to the pill's
  // place (lot 9, `place` above). The region holds every box painted since the surface last
  // rested (its shapes at each of their positions), then the box at rest.
  const tokens = useMotionPreset();
  const reduced = useReducedMotionSetting();
  const motionNow = useRef({ tokens, reduced });
  motionNow.current = { tokens, reduced };
  const cornerRef = useRef<HTMLDivElement>(null);
  const cornerAt = useRef<CornerOffset>({ x: 0, y: 0 });
  const shapeNow = useRef<SurfaceSize | null>(null);
  // The pill's place after the paste (null: the strip's corner), the side of the new text it
  // stands on there (null: the Îlot's own side of the selection), and how far the window moved
  // since the room was read: the room moves with it.
  const placed = useRef<IlotPlace | null>(null);
  const placedSide = useRef<PillSide | null>(null);
  const windowShift = useRef({ x: 0, y: 0 });
  // The menu's shapes (not yet chosen) and the compact bubble's width, for the menu's opening side.
  const menuNow = useRef(true);
  const compactWidth = useRef<number | null>(null);
  const boxOf = useCallback(
    (size: SurfaceSize): IlotShapeBox => {
      if (presentation !== 'anchored') return size;
      const room = roomNow.current && {
        left: roomNow.current.left + windowShift.current.x,
        right: roomNow.current.right - windowShift.current.x,
      };
      const opening = menuNow.current && !placed.current ? ilotMenuShift(size.width, compactWidth.current, room) : null;
      if (opening !== null) return { ...size, shift: opening, dy: 0 };
      return {
        ...size,
        shift: ilotShift(size.width, room, placeX(placed.current, size.width)),
        dy: placed.current?.y ?? 0,
      };
    },
    [presentation],
  );
  const span = useRef<IlotShapeBox[]>([]);
  const springing = useRef(false);
  // The corner animates (a glide to the pill's place, a slide on the shape's spring): the region
  // keeps every position it passes until it rests.
  const moving = useRef(false);
  const cornerRun = useRef(0);
  // After the surface rests: the window's move waiting for it; the place asked for a shape (true:
  // asked); the corner faded out (place, below).
  const tryMoveRef = useRef<() => void>(() => undefined);
  const placeRef = useRef<(size: SurfaceSize) => boolean>(() => false);
  const hideRef = useRef<() => void>(() => undefined);
  // At rest (no spring, the corner still): the box where the corner holds it, alone. The window
  // moves only then.
  const settle = useCallback(() => {
    const size = shapeNow.current;
    if (!side || !size || springing.current || moving.current) return;
    const box =
      presentation === 'anchored' ? { ...size, shift: cornerAt.current.x, dy: cornerAt.current.y } : boxOf(size);
    span.current = [box];
    void publish(ilotRegion(presentation, side, box));
    tryMoveRef.current();
  }, [presentation, side, publish, boxOf]);
  const settleRef = useRef(settle);
  settleRef.current = settle;
  const moveCorner = useCallback((to: CornerOffset, how: CornerMove) => {
    if (to.x === cornerAt.current.x && to.y === cornerAt.current.y && how !== 'instant') return;
    cornerAt.current = to;
    const run = ++cornerRun.current;
    moving.current = false;
    const element = cornerRef.current;
    if (!element) return;
    const controls = animateCorner(element, to, motionNow.current.tokens, motionNow.current.reduced, how);
    if (how === 'instant' || motionNow.current.reduced) return;
    // The corner rests (a glide, or a slide on the shape's spring, even one that took over a
    // glide): the surface may rest.
    moving.current = true;
    void controls.then(() => {
      if (cornerRun.current !== run) return;
      moving.current = false;
      settleRef.current();
    });
  }, []);
  // A shape wider than the one the pill was placed for (an Undo's error after the check) cannot
  // grow there in the margin, where it keeps its left edge, when the window or the work area stops
  // it on the right: pushed back, it would cover the text. It keeps its left edge anyway (the
  // window may cut it meanwhile) and fades out at once while its own place is asked.
  const blocked = useCallback(
    (size: SurfaceSize) => {
      const place = placed.current;
      if (!place || placedSide.current !== 'margin' || size.width <= place.width) return false;
      return boxOf(size).shift !== placeX(place, size.width);
    },
    [boxOf],
  );
  const onShapeChange = useCallback(
    (change: ShapeChange) => {
      if (!side) return;
      shapeNow.current = change.to;
      // The compact bubble: the menu's only shape of its height.
      if (menuNow.current && change.to.height === ilotMetrics.compactHeight) compactWidth.current = change.to.width;
      let to = boxOf(change.to);
      if (change.phase === 'start' && change.from) {
        const from = { ...change.from, shift: cornerAt.current.x, dy: cornerAt.current.y };
        springing.current = true;
        const pushed = blocked(change.to);
        const wait = placeRef.current(change.to) && pushed;
        if (wait && placed.current) to = { ...to, shift: placeX(placed.current, change.to.width) };
        span.current = [...span.current, from, to];
        moveCorner({ x: to.shift ?? 0, y: to.dy ?? 0 }, 'morph');
        void publish(ilotRegion(presentation, side, ...span.current));
        if (wait) hideRef.current();
        return;
      }
      if (!change.from) moveCorner({ x: to.shift ?? 0, y: to.dy ?? 0 }, 'instant');
      springing.current = false;
      settle();
    },
    [presentation, side, publish, boxOf, moveCorner, settle, blocked],
  );
  // The room learnt after the Îlot showed (Rust's placement answered late): the shape in place
  // takes its slide at once.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only when the room arrives
  useEffect(() => {
    const size = shapeNow.current;
    if (!side || !size) return;
    const to = boxOf(size);
    if ((to.shift ?? 0) === cornerAt.current.x && (to.dy ?? 0) === cornerAt.current.y) return;
    moveCorner({ x: to.shift ?? 0, y: to.dy ?? 0 }, 'instant');
    settle();
  }, [room]);

  // The keyboard, asked once; a capture already chosen (double press) never takes it.
  const asked = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: once per capture
  useEffect(() => {
    if (asked.current || capture.execution || closingRef.current) return;
    asked.current = true;
    const answer = (mode: IlotKeyboard) => {
      if (alive.current) setFocus({ keyboard: mode, after: forwardedKeys(captureId) });
    };
    void bridge.focusOverlay().then(
      (focused) => answer(focused ? 'focused' : 'injected'),
      () => answer('injected'),
    );
  }, []);

  // The browser's own shortcuts (reload, print, find, zoom, history: keys.ts browserShortcut) and
  // Ctrl + wheel do nothing while the overlay has the keyboard, the field included: a reload would
  // empty the overlay while Rust keeps its menu open (review of bc57857, finding 2). Rust turns the
  // WebView's browser accelerators off too; this holds whatever the WebView does.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (browserShortcut(keyInputOf(event))) event.preventDefault();
    };
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) event.preventDefault();
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('wheel', onWheel, { capture: true, passive: false });
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('wheel', onWheel, true);
    };
  }, []);

  // The keys the window receives before the Îlot listens (the native agent's measure of lot 9: a key sent in
  // the ~25 ms after `focus_overlay` activated the overlay was lost twice): Rust has given the
  // WebView the foreground, but the Îlot only shows once the window's side is read (two more
  // IPC answers and a render). Installed with the stage's first frame, before `focus_overlay` is
  // even asked; kept in order, never the browser's own shortcuts, nor a composition.
  const early = useRef<KeyInput[]>([]);
  useLayoutEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (handle.current || closingRef.current || event.defaultPrevented) return;
      const input = keyInputOf(event);
      if (input.isComposing || browserShortcut(input) || modifierKeys.has(input.key)) return;
      early.current.push(input);
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  // Forwarded keys, then the early ones, go through the Îlot's table in order once it shows
  // (useTranslation keeps the forwarded ones): at its first frame, where it starts listening too.
  const shown = side !== null && !closing;
  useLayoutEffect(() => {
    const ilot = handle.current;
    if (!ilot) return;
    if (forwarded) for (const key of takeMenuKeys(captureId)) ilot.press(key.key, { shiftKey: key.shiftKey });
    const typed = early.current.splice(0);
    for (const { key, ...modifiers } of typed) ilot.press(key, modifiers);
  }, [forwarded, shown, captureId, takeMenuKeys]);

  // The pill as soon as a choice leaves; a refused choice gives the menu back.
  const run = (actionId: string, instruction?: string) => {
    setChoosing(true);
    setRefusal('');
    choose(actionId, instruction).catch((reason: unknown) => {
      if (!alive.current) return;
      setChoosing(false);
      setRefusal(typeof reason === 'string' ? reason : t('error.startFailed'));
    });
  };

  // What the surface shows (src/menu/outcome.ts), the frontend's own paste of a retry, and the
  // Undo of Rust's replacement.
  const [paste, setPaste] = useState<OwnPaste | null>(null);
  const [undo, setUndo] = useState<UndoProgress | null>(null);
  const outcome = ilotOutcome(state, { chosen: choosing, paste, undo });
  const requestId = state.requestId;
  useEffect(() => {
    if (state.phase !== 'complete' || state.delivery !== null || !requestId || closingRef.current) return;
    if (paste?.requestId === requestId || ownPasteRefusal(state)) return;
    setPaste({ requestId, status: 'pending' });
    bridge.replaceResult(requestId).then(
      () => {
        if (alive.current)
          setPaste((current) => (current?.requestId === requestId ? { requestId, status: 'applied' } : current));
      },
      // Rust refuses with `{message, code}`: the code says why (its French message is never read).
      (reason) => {
        if (alive.current)
          setPaste((current) =>
            current?.requestId === requestId ? { requestId, status: 'refused', code: refusalCode(reason) } : current,
          );
      },
    );
  }, [state, requestId, paste]);

  // The surface leaves once: at the end of the check, on ✕, Escape, Copied, a link to the Settings,
  // or at once when there is nothing to show (cancelled; the check turned off).
  const leaving = useRef(false);
  const leave = useCallback(() => {
    if (leaving.current || closingRef.current) return;
    leaving.current = true;
    cancelAndDismiss();
  }, [cancelAndDismiss]);
  // The watcher dropped the selection before any choice (a click in the source, another
  // application): the menu could only end in a refused paste, so it leaves. Rust closes a menu
  // that had the keyboard when the foreground leaves it (docs/BRIDGE.md, Îlot); this covers the
  // others. A choice on its way, a double press included, keeps its journey and its error pill.
  const choiceOnItsWay = choosingCaptureId === captureId;
  useEffect(() => {
    if (state.invalidated && outcome.stage === 'menu' && !choiceOnItsWay) leave();
  }, [state.invalidated, outcome.stage, choiceOnItsWay, leave]);

  // The window gets the keyboard after all while the menu waits (a click on the Îlot in the
  // fallback, an activation Windows let through late): the Îlot takes the keys itself, field
  // included, until Rust forwards another one. Only the window's focus says so, never a pointer
  // press alone (review of bc57857, finding 3).
  const menuWaits = outcome.stage === 'menu' && !closing;
  useEffect(() => {
    if (!menuWaits) return;
    const onFocus = () => {
      if (!document.hasFocus() || !alive.current) return;
      const after = forwardedKeys(captureId);
      setFocus((current) =>
        current.keyboard === 'focused' && current.after === after ? current : { keyboard: 'focused', after },
      );
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [menuWaits, captureId, forwardedKeys]);
  // The ✦ or the « Ask » tile clicked while the keys come from Rust: the keyboard is asked for
  // again, and the field opens only if the window really holds it.
  const takeKeyboard = useCallback(async () => {
    if (closingRef.current) return false;
    const focused = await bridge.focusOverlay().catch(() => false);
    if (!focused || !alive.current || closingRef.current) return false;
    setFocus({ keyboard: 'focused', after: forwardedKeys(captureId) });
    return true;
  }, [captureId, forwardedKeys]);
  // Try again: the same action on the same capture, once per failed request.
  const retried = useRef<string | null>(null);
  const retry = () => {
    const chosen = state.capture;
    if (state.phase !== 'error' || !chosen?.execution || retried.current === requestId || closingRef.current) return;
    retried.current = requestId;
    setPaste(null);
    start(chosen);
  };
  const onAction = (action: ErrorAction): ActionAnswer => {
    if (action.type === 'retry') {
      retry();
      return;
    }
    if (action.type === 'copy')
      return requestId
        ? bridge.copy(requestId).then(
            () => true,
            () => false,
          )
        : false;
    // The Settings take the foreground on the request's field; the pill has said what it had to.
    return bridge.openSettings(action.field).then(
      () => {
        leave();
        return true;
      },
      () => false,
    );
  };
  // Lot 9: Undo while Rust offers it for its own replacement (the pasted text found and
  // afterReplace.undo on, until `undo-state`), and while one is on its way.
  const rustPasted = state.delivery === 'applied';
  const busy = undo?.status === 'pending';
  const afterReplace = effectiveAfterReplace(settings?.afterReplace, rustPasted && (state.undoable || busy));
  // One countdown per replacement, from the check's first frame: the check alone that takes the
  // place of a withdrawn Undo keeps its time (src/result/countdown.ts).
  const doneClock = useRef<{ requestId: string; clock: Countdown; withUndo: boolean } | null>(null);
  if (outcome.stage === 'done' && requestId && doneClock.current?.requestId !== requestId) {
    const timing = resultTiming(afterReplace);
    doneClock.current = timing.durationMs
      ? { requestId, clock: new Countdown(timing.durationMs, performance.now()), withUndo: timing.undo }
      : null;
  }
  const clock = doneClock.current?.requestId === requestId ? doneClock.current : null;
  // Undo withdrawn by a key or the caret (`typed`, `caret_moved`): the check alone leaves within
  // the lab's 1.1 s from then (Simulator.jsx:155), the pauses still holding. The user's own Ctrl+Z
  // (`undo_key`) reads as « Undone » (outcome.ts).
  const cut = state.undoLost === 'typed' || state.undoLost === 'caret_moved';
  useEffect(() => {
    if (cut && clock) clock.clock.limit(checkOnlyMs, performance.now());
  }, [cut, clock]);

  // The changed words, marked by the halo after Rust's own paste: asked once per replacement,
  // never any text in the request (ranges of the result only), unless the user's own Ctrl+Z
  // already undid it. Rust ends them by itself.
  const marked = useRef<string | null>(null);
  useEffect(() => {
    const capture = state.capture;
    if (
      !rustPasted ||
      state.undoLost === 'undo_key' ||
      !requestId ||
      marked.current === requestId ||
      closingRef.current ||
      !capture?.execution
    )
      return;
    marked.current = requestId;
    const { ranges } = changedRanges(capture.text, state.result, {
      actionId: capture.execution.actionId,
      enabled: settings?.afterReplace?.changedWords !== false,
    });
    if (ranges.length) void bridge.highlightChanges(requestId, ranges).catch(() => undefined);
  }, [rustPasted, state.undoLost, state.capture, state.result, requestId, settings]);

  // Undo, once per replacement. A resolved answer may be a refusal: its status decides.
  const undoAsked = useRef<string | null>(null);
  const askUndo = () => {
    if (!requestId || !rustPasted || !state.undoable || undoAsked.current === requestId || closingRef.current) return;
    undoAsked.current = requestId;
    setUndo({ status: 'pending' });
    bridge.undoResult(requestId).then(
      (answer) => {
        if (!alive.current) return;
        const status = answer?.status === 'undone' || answer?.status === 'failed' ? answer.status : 'refused';
        setUndo({ status, ...(status === 'undone' ? {} : { code: errorCodeOf(answer?.code) }) });
      },
      () => {
        if (alive.current) setUndo({ status: 'refused', code: 'internal' });
      },
    );
  };

  // Lot 9: the pill's place after Rust's own paste (anchored: a bottom form stays docked), asked at
  // the start of the check's shape, and again for a wider shape (an Undo's error) (place).
  const placing = useRef<{ requestId: string | null; open: boolean }>({ requestId: null, open: false });
  const stillPlacing = (id: string) =>
    alive.current && !closingRef.current && placing.current.open && placing.current.requestId === id;
  const usable = (target: PillTarget | null | undefined): target is PillTarget =>
    typeof target === 'object' && target !== null && Number.isFinite(target.x) && Number.isFinite(target.y);
  // The widest shape asked for so far, and its turn: only the last answer counts.
  const askedPlace = useRef<{ requestId: string; width: number; turn: number } | null>(null);
  // Out of sight: the corner fading out (`hidden`), then faded out (`faded`); `run` tells one fade
  // from the next. What waits for it: a hop's jump, or the window's move once everything rests.
  const veil = useRef({ run: 0, hidden: false, faded: false });
  const hopTo = useRef<{ place: IlotPlace | null; side: PillSide | null } | null>(null);
  const windowMove = useRef<{ requestId: string; place: IlotPlace; side: PillSide } | null>(null);
  const moveInFlight = useRef(false);
  // The corner fades out; the time stands still while the pill cannot be read (countdown.ts).
  const hide = () => {
    if (veil.current.hidden) return;
    const run = veil.current.run + 1;
    veil.current = { run, hidden: true, faded: false };
    doneClock.current?.clock.pause('place', performance.now());
    const faded = () => {
      if (veil.current.run !== run || !alive.current) return;
      veil.current.faded = true;
      afterFade();
    };
    const element = cornerRef.current;
    if (!element) {
      faded();
      return;
    }
    void fadeCorner(element, false, motionNow.current.tokens, motionNow.current.reduced).then(faded);
  };
  hideRef.current = hide;
  // Out of sight: a shape that kept its left edge past the window's edge (blocked, above) comes
  // back in it, where its slide holds it.
  const snapHome = () => {
    const size = shapeNow.current;
    if (!side || !size) return;
    const home = boxOf(size);
    if ((home.shift ?? 0) === cornerAt.current.x && (home.dy ?? 0) === cornerAt.current.y) return;
    span.current = [...span.current.map((shape) => boxOf(shape)), home];
    void publish(ilotRegion(presentation, side, ...span.current));
    moveCorner({ x: home.shift ?? 0, y: home.dy ?? 0 }, 'instant');
  };
  const reveal = () => {
    if (!veil.current.hidden) return;
    snapHome();
    veil.current = { run: veil.current.run + 1, hidden: false, faded: false };
    doneClock.current?.clock.resume('place', performance.now());
    const element = cornerRef.current;
    if (element && !closingRef.current)
      void fadeCorner(element, true, motionNow.current.tokens, motionNow.current.reduced);
  };
  const afterFade = () => {
    const target = hopTo.current;
    if (!target) {
      tryMoveRef.current();
      return;
    }
    hopTo.current = null;
    jump(target.place, target.side);
    reveal();
  };
  // On the same side of the text: the corner glides to its place; the region holds the boxes
  // painted so far and each of them at the new place.
  const glide = (place: IlotPlace | null, pillSide: PillSide | null) => {
    const size = shapeNow.current;
    if (!side || !size) return;
    placed.current = place;
    placedSide.current = pillSide;
    const box = boxOf(size);
    const to = { x: box.shift ?? 0, y: box.dy ?? 0 };
    if (to.x === cornerAt.current.x && to.y === cornerAt.current.y) return;
    span.current = [...span.current, ...span.current.map((shape) => boxOf(shape)), box];
    void publish(ilotRegion(presentation, side, ...span.current));
    moveCorner(to, 'move');
    if (!moving.current) settle();
  };
  // Out of sight: the corner takes its place at once, the region with it (the boxes painted since
  // the surface last rested, at the new place).
  const jump = (place: IlotPlace | null, pillSide: PillSide | null) => {
    const size = shapeNow.current;
    if (!side || !size) return;
    placed.current = place;
    placedSide.current = pillSide;
    const box = boxOf(size);
    span.current = [...span.current.map((shape) => boxOf(shape)), box];
    void publish(ilotRegion(presentation, side, ...span.current));
    moveCorner({ x: box.shift ?? 0, y: box.dy ?? 0 }, 'instant');
    settle();
  };
  // Across the text (its other side, the margin), or while out of sight: fade out, jump, fade
  // in; never a sweep over the new text.
  const hop = (place: IlotPlace | null, pillSide: PillSide | null) => {
    hopTo.current = { place, side: pillSide };
    windowMove.current = null;
    if (!veil.current.hidden) hide();
    else if (veil.current.faded) afterFade();
  };
  // Rust's answer: in the window with the shadow's room, a glide on the same side of the text,
  // else a hop; outside, the pill fades out at once and the window moves once everything rests.
  const arrive = (target: PillTarget, size: SurfaceSize, id: string) => {
    if (!side) return;
    const place = ilotPlace(target, size, side);
    if (!target.inside || !ilotFits(target, size)) {
      hopTo.current = null;
      windowMove.current = { requestId: id, place, side: target.side };
      hide();
      tryMoveRef.current();
      return;
    }
    windowMove.current = null;
    if (!veil.current.hidden && target.side === (placedSide.current ?? side)) glide(place, target.side);
    else hop(place, target.side);
  };
  // Asked for a shape wider than any asked before for this replacement; a refusal or an unusable
  // answer leaves the pill where it is (back in sight). The window's move asks again itself.
  placeRef.current = (size) => {
    const id = placing.current.requestId;
    if (!placing.current.open || !id || closingRef.current || !side) return false;
    const asked = askedPlace.current;
    if (asked?.requestId === id && size.width <= asked.width) return false;
    const turn = (asked?.turn ?? 0) + 1;
    askedPlace.current = { requestId: id, width: size.width, turn };
    const current = () => stillPlacing(id) && askedPlace.current?.turn === turn && !moveInFlight.current;
    bridge.resultPill(id, size.width, size.height).then(
      (target) => {
        if (!current()) return;
        if (usable(target)) arrive(target, size, id);
        else if (!windowMove.current && !hopTo.current) reveal();
      },
      () => {
        if (current() && !windowMove.current && !hopTo.current) reveal();
      },
    );
    return true;
  };
  // Outside the window: faded out and at rest only (no spring, the corner still), the window
  // moves so the pill lands on its place; Rust answers again for the moved window, and the pill
  // fades back in there. A refused move: back in sight where it was. A pill with nothing left to
  // place once moved (« Undone » after the paste's Undo) leaves.
  tryMoveRef.current = () => {
    const pending = windowMove.current;
    const size = shapeNow.current;
    if (
      !pending ||
      !side ||
      !size ||
      springing.current ||
      moving.current ||
      !veil.current.faded ||
      moveInFlight.current
    )
      return;
    windowMove.current = null;
    if (!stillPlacing(pending.requestId)) return;
    snapHome();
    const dx = Math.round(placeX(pending.place, size.width) - cornerAt.current.x);
    const dy = Math.round(pending.place.y - cornerAt.current.y);
    if (!dx && !dy) {
      reveal();
      return;
    }
    moveInFlight.current = true;
    const growth = side;
    void bridge
      .moveOverlay(captureId, dx, dy)
      .then(
        () => true,
        () => false,
      )
      .then(async (moved) => {
        moveInFlight.current = false;
        if (!alive.current || closingRef.current) return;
        if (!moved) {
          reveal();
          return;
        }
        windowShift.current = { x: windowShift.current.x + dx, y: windowShift.current.y + dy };
        if (!stillPlacing(pending.requestId)) {
          leave();
          return;
        }
        // The pill stands at its place in the moved window; Rust's answer for it refines that.
        const now = shapeNow.current ?? size;
        let place: IlotPlace = { ...pending.place, x: pending.place.x - dx, y: pending.place.y - dy };
        let pillSide = pending.side;
        const again = await bridge.resultPill(pending.requestId, now.width, now.height).catch(() => null);
        if (!alive.current || closingRef.current) return;
        if (!stillPlacing(pending.requestId)) {
          leave();
          return;
        }
        if (usable(again) && again.inside && ilotFits(again, now)) {
          place = ilotPlace(again, now, growth);
          pillSide = again.side;
        }
        jump(place, pillSide);
        reveal();
      });
  };

  // « Undone » goes back to the strip's corner, against the original text, while the window stands
  // where Rust put it; once it moved (or while it moves) that corner is elsewhere, and the Îlot
  // leaves without it. Decided once, at its first frame.
  const undoneAway = useRef<boolean | null>(null);
  if (outcome.stage === 'undone' && undoneAway.current === null)
    undoneAway.current = moveInFlight.current || windowShift.current.x !== 0 || windowShift.current.y !== 0;
  const stage: ResultStage | null =
    outcome.stage === 'working'
      ? { stage: 'working', indicator }
      : outcome.stage === 'done'
        ? {
            stage: 'done',
            afterReplace,
            clock: clock?.clock,
            busy,
            drawn: Boolean(clock?.withUndo) && !afterReplace.undo,
          }
        : outcome.stage === 'undone'
          ? undoneAway.current
            ? null
            : { stage: 'undone' }
          : outcome.stage === 'error'
            ? {
                stage: 'error',
                error: outcome.code,
                source: outcome.source,
                serverId: state.serverId ?? undefined,
                model: settings?.servers.find((server) => server.id === (state.serverId ?? settings.defaultServerId))
                  ?.model,
              }
            : null;
  const content =
    stage &&
    resultContent(stage, {
      onExpire: leave,
      onDismiss: leave,
      onAction,
      onUndo: askUndo,
    });
  // Nothing to show once chosen (cancelled, or pasted with the check turned off): the surface
  // leaves after the lab's 60 ms (Simulator.jsx:154), keeping its last content while it goes
  // (Simulator.jsx:299-302), as it does when it closes.
  const empty = outcome.stage !== 'menu' && !content;
  // The check after Rust's paste, and an Undo's error in its place.
  const placeable =
    outcome.stage === 'done' ||
    (outcome.stage === 'error' && (outcome.source === 'undo' || outcome.source === 'undo-sent'));
  placing.current = { requestId, open: placeable && !empty && rustPasted && presentation === 'anchored' };
  // The check's pill may keep the work pill's size (the check alone, 44 × 28): no shape change
  // then, so the place is asked here (once: a change of shape asked first).
  useEffect(() => {
    const size = shapeNow.current;
    if (placing.current.open && size) placeRef.current(size);
  }, [outcome.stage, empty, rustPasted, requestId, side]);
  // « Undone » back at the strip's corner: on the same side of the text, a glide; across it, or
  // out of sight, a hop. Whatever waited for the window's move is dropped.
  const undoneHere = outcome.stage === 'undone' && undoneAway.current === false && presentation === 'anchored';
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, when « Undone » comes
  useLayoutEffect(() => {
    if (!undoneHere) return;
    windowMove.current = null;
    if (veil.current.hidden) hop(null, null);
    else if (placed.current) {
      if ((placedSide.current ?? side) === side) glide(null, null);
      else hop(null, null);
    }
  }, [undoneHere]);
  const lastContent = useRef(content);
  if (content && !closing) lastContent.current = content;
  const pill = closing || !content ? lastContent.current : content;
  useEffect(() => {
    if (!empty) return;
    const timer = window.setTimeout(leave, 60);
    return () => window.clearTimeout(timer);
  }, [empty, leave]);
  // Escape once chosen (the menu handles its own): the pill, the check or the error leave.
  useEffect(() => {
    if (outcome.stage === 'menu') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault();
        leave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [outcome.stage, leave]);

  // Closed before it ever showed: nothing to animate out.
  useEffect(() => {
    if (closing && side === null) completeDismiss(captureId);
  }, [closing, side, captureId, completeDismiss]);

  const shape = outcome.stage === 'menu' ? 'menu' : 'pill';
  menuNow.current = shape === 'menu';
  const { frame } = reserve;
  const right = reserve.width - frame.x - frame.width;
  const corner: CSSProperties =
    presentation === 'bottom'
      ? { left: 0, right: 0, bottom: reserve.height - frame.y - frame.height }
      : side === 'above'
        ? { right, bottom: reserve.height - frame.y - frame.height }
        : { right, top: frame.y };
  const status =
    outcome.stage === 'working'
      ? t('pill.working')
      : outcome.stage === 'done'
        ? t('glass.replaced')
        : outcome.stage === 'undone'
          ? t('result.undone')
          : '';
  return (
    <div
      className="ilot-stage"
      style={{ width: reserve.width, height: reserve.height }}
      data-capture-id={captureId}
      data-presentation={presentation}
      data-side={side ?? undefined}
      data-closing={closing}
      data-stage={outcome.stage}
      data-error={outcome.stage === 'error' ? outcome.code : undefined}
    >
      <div ref={cornerRef} className="ilot-corner" style={corner}>
        <AnimatePresence onExitComplete={() => completeDismiss(captureId)}>
          {shown && (
            <Ilot
              key={captureId}
              ref={handle}
              actions={actions}
              knownActions={settings?.actions}
              lastActionId={lastActionId}
              origin={presentation === 'bottom' || side === 'above' ? 'bottom' : 'top'}
              originX={presentation === 'bottom' ? '50%' : '100%'}
              keyboard={keyboard}
              onRequestKeyboard={takeKeyboard}
              shape={shape}
              pill={pill}
              onChoose={(actionId) => run(actionId)}
              onInstruction={(text) => run(instructionActionId, text)}
              onClose={cancelAndDismiss}
              onShapeChange={onShapeChange}
            />
          )}
        </AnimatePresence>
      </div>
      <span className="sr-only" role="status">
        {status}
      </span>
      {refusal && (
        <span className="sr-only" role="alert">
          {refusal}
        </span>
      )}
    </div>
  );
}

// A capture Rust refused under the Îlot (`capture-notice` with its code: nothing selected, a
// protected field, too long, the Settings in front, nothing recent to show again…): the error pill
// of the same family of shapes, its text in the interface language, without a button (nothing was
// read, nothing can be retried or copied) and without ✕: Rust shows it alone, never clickable, in
// its 420 × 64 window at the bottom of the cursor's screen, and hides it four seconds later. The
// code alone decides the text; Rust's French message is never read.
export function IlotNotice({ code }: { code: ErrorCode }) {
  const content = resultContent({ stage: 'error', error: code, source: 'capture' });
  if (!content) return null;
  return (
    <div className="notice-root" data-notice={code}>
      <MorphSurface contentKey={content.key} size={content.size} origin="bottom" originX="50%">
        {content.node}
      </MorphSurface>
    </div>
  );
}
