import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  Bold,
  Highlighter,
  Italic,
  Keyboard,
  LayoutGrid,
  List,
  Mail,
  Minus,
  Paperclip,
  Pause,
  Play,
  Replace,
  RotateCcw,
  Send,
  Server,
  SkipForward,
  SlidersHorizontal,
  Sparkles,
  Square,
  Underline,
  Undo2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { defaultActionId, defaultActions, menuShortcut } from '../actionDefaults';
import { appName } from '../brand';
import { bridge } from '../bridge';
import { AppMark } from '../components/AppMark';
import { Button, ICON } from '../components/controls';
import { tx } from '../components/motion';
import { HaloView, type HaloRun, type HaloState } from '../halo/HaloWindow';
import { useLanguage, useT, type MessageKey } from '../i18n';
import { ilotMenuShift } from '../layout';
import { indicatorOf } from '../loaders/pill';
import { IlotView, type IlotMode } from '../menu/Ilot';
import { menuActions } from '../menu/IlotStage';
import { ilotMetrics } from '../menu/metrics';
import type { ShapeChange } from '../menu/MorphSurface';
import { useMotionPreset, useReducedMotionSetting } from '../motion/MotionPreferences';
import { animateCorner } from '../motion/surface';
import { checkOnlyMs, Countdown, undoMs } from '../result/countdown';
import { changedRanges } from '../result/highlight';
import { resultContent, type ResultStage } from '../result/ResultPill';
import { shortcutKeys } from '../settings/ShortcutRecorder';
import { primaryBinding } from '../setup/model';
import type { AfterReplace, Rect, Settings, SettingsPage } from '../types';
import { Cursor } from './Cursor';
import { PhaseCaption, PhaseRail } from './PhaseRail';
import {
  createPlayer,
  hudAt,
  introAt,
  keysAt,
  phaseIds,
  phaseIndexAt,
  pointerAt,
  position,
  SLIDE_HOLD_MS,
  stills,
  T,
  dragProgress,
  type Cue,
  type Player,
  type Pointer,
  type PointerPlaces,
  type Still,
} from './script';
import {
  caretPoint,
  dragEnds,
  dragPoint,
  dragSelection,
  measureLines,
  rangeRects,
  selectionRects,
  touchedLines,
  type Point,
  type TextLine,
} from './selection';
import { Wallpaper } from './Wallpaper';
import './demo.css';

/*
 * The demo of the first run (docs/PLAN-0.6.md §4.2). Lucas, 30/09: « la démo doit montrer
 * EXACTEMENT ce que fait l'app ». So nothing of the app is redrawn here: the Îlot is the app's
 * (src/menu/Ilot.tsx), its pill's contents are the app's (src/result/ResultPill.tsx
 * resultContent: the working indicator, the check, Undo and its ring), the halo is the app's
 * (src/halo/HaloWindow.tsx HaloView), the place of the Îlot and of the pill follow the app's
 * rules (8 px under the selection's last line, right edge on its end, the menu opening right:
 * src/layout.ts ilotMenuShift; the pill gliding under the new text: src/motion/surface.ts
 * animateCorner 'move'), the changed words are found by the app's diff (src/result/highlight.ts)
 * and lit with the app's ink (.halo-lit, src/halo/halo.css), in the user's style. The names and
 * letters of the actions, the indicator, the spring and the shortcut are the user's settings.
 *
 * What the demo adds is a stage around them: a mail draft (a plain application that is not
 * ours), a big pointer that selects in ONE diagonal drag and really acts on the components (it
 * hovers the ✦ so the grid unfolds by the Îlot's own timer, clicks the tile, rests on Undo so its
 * ring stops), the user's shortcut as keycaps under the window, a caption and a frieze that tell
 * the seven phases apart, and a strip that says where each thing is set.
 *
 * Time: src/demo/script.ts. Pause freezes the script, the CSS loops and Undo's countdown; « Revoir »
 * starts everything again from any instant; « Passer », Escape and the end call onDone once.
 * Reduced motion: a slideshow of the seven phases, each drawn by the same components at rest.
 * The scene is decorative (`inert`): the real pointer and keyboard never reach the Îlot.
 */

export type DemoProps = {
  settings: Settings | null;
  // done: it played to its end (« Continuer », or by itself); false: skipped.
  onDone: (done: boolean) => void;
};

// The stage, in its own pixels (the demo window is 900 × 740; smaller, the stage is scaled to fit).
const STAGE = { width: 900, height: 740 };
const WIN = { x: 24, y: 92, width: 660, height: 408 };
const RAIL = { right: 886, y: 84, width: 316, height: 548, closed: 56 };
// placement.rs: the Îlot's strip sits 8 px under the selection's last line; so does the pill.
const PILL_GAP = 8;
// The end hands over by itself after this long, unless the viewer took the controls.
const END_HOLD_MS = 3000;
// The demo's own replacement: the app's defaults (check, Undo 8 s, the changed words marked).
const AFTER: AfterReplace = { check: true, undo: true, undoSeconds: 8, changedWords: true, changedWordsSeconds: 60 };

type IlotScene = { shape: 'menu'; mode: IlotMode } | { shape: 'pill'; content: 'working' | 'done' | 'check' };
type Scene = {
  selection: 'none' | 'live' | 'full';
  pasted: boolean;
  caret: null | 'end' | 'click';
  ilot: IlotScene | null;
  halo: { phase: 'menu' | 'work' | 'marks'; state: HaloState } | null;
  glow: 'off' | 'on' | 'out';
  ended: boolean;
};
const emptyScene: Scene = {
  selection: 'none',
  pasted: false,
  caret: null,
  ilot: null,
  halo: null,
  glow: 'off',
  ended: false,
};
function sceneOf(still: Still): Scene {
  const ilot: IlotScene | null =
    still.ilot === 'none'
      ? null
      : still.ilot === 'compact' || still.ilot === 'grid'
        ? { shape: 'menu', mode: still.ilot }
        : { shape: 'pill', content: still.ilot };
  return {
    selection: still.selected ? 'full' : 'none',
    pasted: still.pasted,
    caret: still.pasted ? (still.marks ? 'end' : 'click') : null,
    ilot,
    halo: still.halo === 'none' ? null : { phase: still.halo, state: 'shown' },
    glow: still.marks ? 'on' : 'off',
    ended: false,
  };
}

type Geometry = {
  lines: TextLine[]; // the original text
  newLines: TextLine[]; // the corrected text
  changed: Rect[]; // the changed words in it
  textBox: Rect; // the mail's body (UI Automation's text box)
  strip: { right: number; top: number };
  place: { x: number; y: number }; // where the pill goes after the paste, from the strip's corner
  caretClick: { x: number; top: number; bottom: number };
};

// The time of the player, read by the few pieces that move with it (the pointer, the selection
// under the drag, the keycaps, the frieze): the rest of the demo renders on cues only.
function createTimeStore() {
  let now = 0;
  const listeners = new Set<() => void>();
  return {
    get: () => now,
    set(value: number) {
      if (value === now) return;
      now = value;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
type TimeStore = ReturnType<typeof createTimeStore>;
const useNow = (store: TimeStore) => useSyncExternalStore(store.subscribe, store.get, store.get);

// The offset of an element in the stage: offsets ignore transforms (the fitted stage, a window
// still springing in), so a measure taken at any moment is the resting one.
function offsetIn(element: HTMLElement, root: HTMLElement): Point {
  let x = 0,
    y = 0;
  let node: HTMLElement | null = element;
  while (node && node !== root) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x, y };
}
// A drawn element's box in the stage's pixels (for what the app's components lay out themselves).
function boxIn(element: Element, root: HTMLElement): Rect {
  const frame = root.getBoundingClientRect();
  const scale = frame.width / (root.offsetWidth || 1) || 1;
  const box = element.getBoundingClientRect();
  return {
    x: (box.left - frame.left) / scale,
    y: (box.top - frame.top) / scale,
    width: box.width / scale,
    height: box.height / scale,
  };
}

export function Demo({ settings, onDone }: DemoProps) {
  const t = useT();
  const language = useLanguage();
  const reduced = useReducedMotionSetting();
  const tokens = useMotionPreset();
  const motionNow = useRef({ tokens, reduced });
  motionNow.current = { tokens, reduced };

  // ——— What the user set ———
  const actions = useMemo(() => {
    const menu = menuActions(settings);
    return menu.length ? menu : defaultActions;
  }, [settings]);
  const known = settings?.actions ?? defaultActions;
  const lastActionId = settings?.defaultActionId ?? defaultActionId;
  const indicator = indicatorOf(settings?.indicator);
  const marks = settings?.changedWordsStyle === 'eclat' ? 'eclat' : 'encre';
  const shortcut = (settings && primaryBinding(settings)?.shortcut) || menuShortcut;
  const keys = useMemo(() => shortcutKeys(shortcut, t).slice(0, 4), [shortcut, t]);
  const before = t('demo2.mail.before'),
    after = t('demo2.mail.after');
  const changed = useMemo(() => changedRanges(before, after, { actionId: 'correct' }).ranges, [before, after]);

  // ——— State ———
  const [run, setRun] = useState(0);
  const [live, setScene] = useState<Scene>(emptyScene);
  const [playing, setPlaying] = useState(true);
  const [slide, setSlide] = useState(0);
  // Reduced motion: the scene is the still picture of the slide, known before its components
  // mount (the Îlot is born in the right state); else the scene the cues built so far.
  const scene = useMemo<Scene>(
    () =>
      !reduced
        ? live
        : slide >= phaseIds.length
          ? { ...sceneOf(stills.undo), ilot: null, ended: true }
          : sceneOf(stills[phaseIds[slide]]),
    [reduced, live, slide],
  );
  const [geo, setGeo] = useState<Geometry | null>(null);
  const [rail, setRail] = useState<{ open: boolean; item: ExplainId | null }>({ open: false, item: null });
  const store = useRef<TimeStore | null>(null);
  store.current ??= createTimeStore();
  const time = store.current;
  const player = useRef<Player | null>(null);
  const touched = useRef(false);
  const finished = useRef(false);
  const finish = useCallback(
    (done: boolean) => {
      if (finished.current) return;
      finished.current = true;
      player.current?.stop();
      onDone(done);
    },
    [onDone],
  );

  // ——— Geometry: read once laid out, again when fonts or sizes change ———
  const fit = useRef<HTMLDivElement>(null);
  const oldP = useRef<HTMLParagraphElement>(null);
  const newP = useRef<HTMLParagraphElement>(null);
  const byeP = useRef<HTMLParagraphElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const geoRef = useRef<Geometry | null>(null);
  const measure = useCallback(() => {
    const root = fit.current,
      original = oldP.current,
      corrected = newP.current,
      box = body.current,
      bye = byeP.current;
    const first = original?.firstChild,
      second = corrected?.firstChild,
      third = bye?.firstChild;
    if (
      !root ||
      !original ||
      !corrected ||
      !box ||
      !bye ||
      !(first instanceof Text) ||
      !(second instanceof Text) ||
      !(third instanceof Text)
    )
      return;
    const lines = measureLines(first, original, offsetIn(original, root));
    const newLines = measureLines(second, corrected, offsetIn(corrected, root));
    const byeLines = measureLines(third, bye, offsetIn(bye, root));
    const end = lines[lines.length - 1],
      newEnd = newLines[newLines.length - 1];
    if (!end || !newEnd || !byeLines.length) return;
    const origin = offsetIn(box, root);
    const strip = { right: end.xs[end.xs.length - 1], top: end.bottom + PILL_GAP };
    const next: Geometry = {
      lines,
      newLines,
      changed: changed.flatMap((range) => rangeRects(newLines, range.start, range.end)),
      textBox: { x: origin.x, y: origin.y, width: box.offsetWidth, height: box.offsetHeight },
      strip,
      // placement.rs (pill_after_paste): under the new text's last line, its right edge on its end.
      place: {
        x: Math.round(newEnd.xs[newEnd.xs.length - 1] - strip.right),
        y: Math.round(newEnd.bottom - end.bottom),
      },
      caretClick: caretPoint(byeLines, byeLines[0].end, true)!,
    };
    geoRef.current = next;
    setGeo((previous) => (previous && JSON.stringify(previous) === JSON.stringify(next) ? previous : next));
  }, [changed]);
  useLayoutEffect(() => {
    measure();
    let alive = true;
    void document.fonts?.ready?.then(() => {
      if (alive) measure();
    });
    if (typeof ResizeObserver === 'undefined')
      return () => {
        alive = false;
      };
    const observer = new ResizeObserver(() => measure());
    for (const element of [oldP.current, newP.current, byeP.current]) if (element) observer.observe(element);
    return () => {
      alive = false;
      observer.disconnect();
    };
  }, [measure, language]);

  // The stage fits the window: the native one is 900 × 740 unless the screen is smaller.
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const update = () => setScale(Math.min(1, window.innerWidth / STAGE.width, window.innerHeight / STAGE.height));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // ——— The pointer's places ———
  const dynamic = useRef<Partial<Pick<PointerPlaces, 'ask' | 'tile' | 'undo'>>>({});
  const centreOf = (selector: string, at: (box: Rect) => Point): Point | undefined => {
    const root = fit.current;
    const element = root?.querySelector(selector);
    return root && element ? at(boxIn(element, root)) : undefined;
  };
  const places = useCallback((): PointerPlaces | null => {
    const g = geoRef.current;
    const ends = g && dragEnds(g.lines);
    if (!g || !ends) return null;
    const { strip, place } = g;
    return {
      home: { x: WIN.x + WIN.width + 90, y: WIN.y + WIN.height + 110 },
      dragFrom: ends.from,
      dragTo: ends.to,
      rest: { x: strip.right + 96, y: strip.top + 58 },
      ask: dynamic.current.ask ?? { x: strip.right - 16, y: strip.top + 16 },
      tile: dynamic.current.tile ?? { x: strip.right - 40, y: strip.top + 40 },
      aside: { x: strip.right + 70, y: strip.top + 96 },
      undo: dynamic.current.undo ?? { x: strip.right + place.x - 40, y: strip.top + place.y + 14 },
      caret: { x: g.caretClick.x + 2, y: (g.caretClick.top + g.caretClick.bottom) / 2 },
      out: { x: WIN.x + WIN.width + 70, y: WIN.y + WIN.height + 100 },
    };
  }, []);
  const pointerNow = useCallback(
    (at: number): Pointer | null => {
      const where = places(),
        g = geoRef.current;
      if (!where || !g) return null;
      return pointerAt(at, where, (p) => dragPoint(g.lines, p) ?? where.dragFrom);
    },
    [places],
  );

  // ——— The pointer acts on the real components ———
  // What it is over gets the events a mouse would give it (React builds onMouseEnter / onMouseLeave
  // from them): the ✦ starts the Îlot's own 450 ms timer, a tile takes the highlight, the result
  // row stops Undo's countdown. `data-demo-hover` stands in for :hover, which no script can set.
  const hovered = useRef<Element | null>(null);
  const hover = useCallback((pointer: Pointer | null) => {
    const root = fit.current;
    if (!root) return;
    let target: Element | null = null;
    if (pointer && pointer.opacity > 0.5) {
      const frame = root.getBoundingClientRect();
      const k = frame.width / (root.offsetWidth || 1) || 1;
      const x = frame.left + pointer.x * k,
        y = frame.top + pointer.y * k;
      for (const element of root.querySelectorAll(
        '[data-ilot] [data-item="ask"], [data-ilot] [data-tile], [data-ilot] [data-result-content="done"], [data-ilot] .result-undo',
      )) {
        if (element.closest('.is-leaving')) continue;
        const box = element.getBoundingClientRect();
        if (x >= box.left && x <= box.right && y >= box.top && y <= box.bottom && (!target || target.contains(element)))
          target = element;
      }
    }
    const previous = hovered.current;
    if (target === previous) return;
    hovered.current = target;
    previous?.removeAttribute('data-demo-hover');
    target?.setAttribute('data-demo-hover', '');
    if (previous?.isConnected)
      previous.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: target }));
    else target?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: null }));
  }, []);

  // ——— The Îlot's corner (IlotStage's rules, with the app's own functions) ———
  const corner = useRef<HTMLDivElement>(null);
  const compactWidth = useRef<number | null>(null);
  const sceneNow = useRef(scene);
  sceneNow.current = scene;
  // A first shape met before the corner's own ref exists (the slideshow remounts the scene: a
  // child's layout effect runs before its new parent's ref is set) is placed right after the commit.
  const pendingCorner = useRef<{ x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    const element = corner.current,
      to = pendingCorner.current;
    if (!element || !to) return;
    pendingCorner.current = null;
    void animateCorner(element, to, motionNow.current.tokens, true, 'instant');
  });
  const onShapeChange = useCallback((change: ShapeChange) => {
    const element = corner.current,
      g = geoRef.current,
      now = sceneNow.current;
    if (!g) return;
    const menu = now.ilot?.shape === 'menu';
    if (menu && change.to.height === ilotMetrics.compactHeight) compactWidth.current = change.to.width;
    // After the paste the corner is at the pill's place: a later shape (the check alone) keeps it.
    if (now.pasted) return;
    // The menu opens right of the compact bubble when the stage has room there (ilotMenuShift);
    // once chosen, the pill goes back to the strip's corner, on the shape's own spring.
    const room = { left: g.strip.right, right: STAGE.width - g.strip.right - 16 };
    const x = menu ? (ilotMenuShift(change.to.width, compactWidth.current, room) ?? 0) : 0;
    if (!element) {
      if (!change.from) pendingCorner.current = { x, y: 0 };
      return;
    }
    if (change.phase === 'start')
      void animateCorner(element, { x, y: 0 }, motionNow.current.tokens, motionNow.current.reduced, 'morph');
    else if (!change.from) void animateCorner(element, { x, y: 0 }, motionNow.current.tokens, true, 'instant');
  }, []);
  // The pill glides under the new text (IlotStage `glide`: the corner moves, 420 ms).
  // biome-ignore lint/correctness/useExhaustiveDependencies: replays the glide on these scene changes only; the rest is read through refs
  useLayoutEffect(() => {
    const element = corner.current,
      g = geoRef.current;
    if (!element || !g || !scene.pasted || !scene.ilot) return;
    void animateCorner(element, g.place, motionNow.current.tokens, motionNow.current.reduced, 'move');
  }, [scene.pasted, scene.ilot !== null, geo, run, slide]);

  // ——— The result pill's content ———
  const clock = useRef<Countdown | null>(null);
  const leaveIlot = useCallback(() => setScene((current) => (current.ilot ? { ...current, ilot: null } : current)), []);
  const choose = useCallback((_actionId: string) => {
    setScene((current) =>
      current.ilot?.shape === 'menu'
        ? { ...current, ilot: { shape: 'pill', content: 'working' }, halo: { phase: 'work', state: 'shown' } }
        : current,
    );
  }, []);
  const stage: ResultStage | null =
    scene.ilot?.shape !== 'pill'
      ? null
      : scene.ilot.content === 'working'
        ? { stage: 'working', indicator, ...(reduced ? { delayMs: 0 } : {}) }
        : scene.ilot.content === 'done'
          ? { stage: 'done', afterReplace: AFTER, clock: clock.current ?? undefined, drawn: reduced }
          : { stage: 'done', afterReplace: { ...AFTER, undo: false }, clock: clock.current ?? undefined, drawn: true };
  const pill = stage && resultContent(stage, { onExpire: reduced ? undefined : leaveIlot });

  // ——— The script's cues ———
  const onCue = useCallback((cue: Cue) => {
    switch (cue.id) {
      case 'press':
        setScene((current) => ({ ...current, selection: 'live' }));
        break;
      case 'release':
        setScene((current) => ({ ...current, selection: 'full' }));
        break;
      // Rust's capture: the Îlot shows, compact, with the menu's halo, at once.
      case 'open':
        compactWidth.current = null;
        setScene((current) => ({
          ...current,
          ilot: { shape: 'menu', mode: 'compact' },
          halo: { phase: 'menu', state: 'shown' },
        }));
        break;
      // The click's release chooses, as a button does: the tile under the pointer gets a real click.
      case 'pick': {
        const root = fit.current;
        const tile = hovered.current?.matches('[data-tile]')
          ? hovered.current
          : root?.querySelector('[data-ilot] .ilot-tile.is-hot, [data-ilot] [data-tile]:not([data-tile="ask"])');
        if (tile?.isConnected && !tile.matches('[data-tile="ask"]'))
          tile.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        // No grid to click (it never unfolded): the choice is made all the same, nothing stays open.
        setScene((current) =>
          current.ilot?.shape === 'menu'
            ? { ...current, ilot: { shape: 'pill', content: 'working' }, halo: { phase: 'work', state: 'shown' } }
            : current,
        );
        break;
      }
      // The model answered: Rust fades the work's halo out, then pastes.
      case 'answer':
        setScene((current) =>
          current.halo?.phase === 'work' ? { ...current, halo: { phase: 'work', state: 'leaving' } } : current,
        );
        break;
      case 'paste':
        clock.current = new Countdown(undoMs(AFTER.undoSeconds), performance.now());
        setScene((current) => ({
          ...current,
          selection: 'none',
          pasted: true,
          caret: 'end',
          ilot: { shape: 'pill', content: 'done' },
          halo: { phase: 'marks', state: 'shown' },
          glow: 'on',
        }));
        break;
      // A click in the text (`undo-state` caret_moved): Undo is withdrawn, the check alone stays
      // 1.1 s on the same clock, the marks leave.
      case 'caret':
        clock.current?.limit(checkOnlyMs, performance.now());
        setScene((current) => ({
          ...current,
          caret: 'click',
          ilot: current.ilot ? { shape: 'pill', content: 'check' } : null,
          halo: current.halo ? { ...current.halo, state: 'leaving' } : null,
          glow: 'out',
        }));
        break;
      case 'end':
        setScene((current) => ({ ...current, ilot: null, halo: null, ended: true }));
        break;
      default:
        break;
    }
  }, []);

  // ——— The player (full motion) ———
  // biome-ignore lint/correctness/useExhaustiveDependencies: the frame reads the scene through refs; it must stay stable for the player
  const frame = useCallback(
    (at: number) => {
      const root = fit.current;
      if (root) {
        // The places that only exist once the app's components drew them.
        if (!dynamic.current.ask && at >= T.toAsk - 20)
          dynamic.current.ask = centreOf('[data-ilot] [data-item="ask"]', (box) => ({
            x: box.x + box.width / 2,
            y: box.y + box.height / 2,
          }));
        if (!dynamic.current.tile && at >= T.toTile - 20)
          dynamic.current.tile = centreOf('[data-ilot] .ilot-tile.is-hot, [data-ilot] [data-tile]', (box) => ({
            x: box.x + box.width * 0.78,
            y: box.y + box.height * 0.8,
          }));
        if (!dynamic.current.undo && at >= T.toUndo - 20)
          dynamic.current.undo = centreOf('[data-ilot] .result-undo', (box) => ({
            x: box.x + box.width * 0.42,
            y: box.y + box.height / 2,
          }));
      }
      hover(sceneNow.current.ilot ? pointerNow(at) : null);
      time.set(at);
    },
    [hover, pointerNow, time],
  );
  useEffect(() => {
    if (reduced) return;
    hovered.current = null;
    dynamic.current = {};
    clock.current = null;
    compactWidth.current = null;
    setScene(emptyScene);
    time.set(0);
    const made = createPlayer({
      now: () => performance.now(),
      frame: (run) => {
        const id = requestAnimationFrame(run);
        return () => cancelAnimationFrame(id);
      },
      onCue,
      onChange: (state) => {
        frame(state.t);
        setPlaying(state.playing);
      },
    });
    player.current = made;
    made.play();
    return () => {
      made.stop();
      if (player.current === made) player.current = null;
    };
  }, [reduced, run, onCue, frame, time]);

  // What floats over the stage is real glass: the page itself blurs the mail behind the Îlot
  // (src/theme.css, data-backdrop="glass"). The attribute is the page's while the demo shows.
  useLayoutEffect(() => {
    const root = document.documentElement;
    const previous = root.getAttribute('data-backdrop');
    root.setAttribute('data-backdrop', 'glass');
    return () => {
      if (previous === null) root.removeAttribute('data-backdrop');
      else root.setAttribute('data-backdrop', previous);
    };
  }, []);

  // Browser preview only: the captures and the tests read the time and hold a frame.
  useEffect(() => {
    if (bridge.native) return;
    const hook = { time: () => time.get(), pause: () => player.current?.pause(), play: () => player.current?.play() };
    (window as unknown as { __demo?: typeof hook }).__demo = hook;
    return () => {
      delete (window as unknown as { __demo?: typeof hook }).__demo;
    };
  }, [time]);

  // ——— The slideshow (reduced motion) ———
  // The compact bubble's width is kept from one slide to the next: the grid's slide opens right of
  // where the compact one stood, as in the app.
  useLayoutEffect(() => {
    if (reduced) clock.current = null;
  }, [reduced, slide, run]);
  useEffect(() => {
    if (!reduced || !playing || slide >= phaseIds.length) return;
    const timer = window.setTimeout(() => setSlide((current) => current + 1), SLIDE_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [reduced, playing, slide]);
  // Where the still pointer rests: read once the slide's components are laid out.
  const [stillPointer, setStillPointer] = useState<Pointer | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: read again only when the slide layout changes
  useLayoutEffect(() => {
    if (!reduced) {
      setStillPointer(null);
      return;
    }
    const name = slide < phaseIds.length ? stills[phaseIds[slide]].pointer : null;
    let frameId = 0;
    const read = () => {
      dynamic.current = {
        ask: centreOf('[data-ilot] [data-item="ask"]', (box) => ({
          x: box.x + box.width / 2,
          y: box.y + box.height / 2,
        })),
        tile: centreOf('[data-ilot] .ilot-tile.is-hot, [data-ilot] [data-tile]', (box) => ({
          x: box.x + box.width * 0.78,
          y: box.y + box.height * 0.8,
        })),
        undo: centreOf('[data-ilot] .result-undo', (box) => ({
          x: box.x + box.width * 0.42,
          y: box.y + box.height / 2,
        })),
      };
      const where = places();
      setStillPointer(
        name && where
          ? { ...where[name], opacity: 1, press: 0, shape: name === 'dragTo' || name === 'caret' ? 'beam' : 'arrow' }
          : null,
      );
    };
    frameId = requestAnimationFrame(read);
    return () => cancelAnimationFrame(frameId);
  }, [reduced, slide, geo, run, places]);

  // ——— Pause: the script, the CSS loops (data-paused) and Undo's countdown stand still ———
  const paused = !playing || rail.open;
  useEffect(() => {
    const now = performance.now();
    if (paused) clock.current?.pause('demo', now);
    else clock.current?.resume('demo', now);
  }, [paused, scene.ilot]);
  // The strip unfolded: the demo waits while it is read, and goes on when it folds.
  const heldByRail = useRef(false);
  useEffect(() => {
    if (reduced) return;
    if (rail.open && player.current?.state().playing) {
      heldByRail.current = true;
      player.current.pause();
    }
    if (!rail.open && heldByRail.current) {
      heldByRail.current = false;
      player.current?.play();
    }
  }, [rail.open, reduced]);

  // ——— Controls ———
  const ended = scene.ended;
  const replay = useCallback(() => {
    touched.current = true;
    heldByRail.current = false;
    setRail({ open: false, item: null });
    setSlide(0);
    setPlaying(true);
    setRun((current) => current + 1);
  }, []);
  const toggle = useCallback(() => {
    touched.current = true;
    if (sceneNow.current.ended) {
      replay();
      return;
    }
    if (reduced) {
      setPlaying((current) => !current);
      return;
    }
    const current = player.current;
    if (!current) return;
    if (current.state().playing) current.pause();
    else current.play();
  }, [reduced, replay]);
  // The end hands over by itself, unless the viewer took the controls or reads the strip.
  useEffect(() => {
    if (!ended || touched.current || rail.open) return;
    const timer = window.setTimeout(() => {
      if (!touched.current) finish(true);
    }, END_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [ended, rail.open, finish]);

  // The keyboard is the demo's: nothing typed reaches the Îlot (its own listener is installed
  // later, on the same target, so this one runs first). Escape skips; Space pauses unless a
  // control has the focus (it then presses that control).
  useLayoutEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      event.stopImmediatePropagation();
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (event.key === 'Escape') {
        event.preventDefault();
        if (event.repeat) return;
        // In the strip, Escape folds it (its focus leaves); anywhere else it skips the demo.
        if (target?.closest('.dm-rail')) {
          (document.activeElement as HTMLElement | null)?.blur?.();
          return;
        }
        finish(false);
      } else if (event.key === ' ' && !target?.closest('button, a, input')) {
        event.preventDefault();
        if (!event.repeat) toggle();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [finish, toggle]);

  // ——— The halo, as Rust would send it for this text ———
  // biome-ignore lint/correctness/useExhaustiveDependencies: recomputed when the halo phase changes: a run keeps its tone
  const haloRun = useMemo((): HaloRun | null => {
    if (!geo || !scene.halo) return null;
    const dark = document.documentElement.dataset.theme === 'dark';
    const base = {
      width: STAGE.width,
      height: STAGE.height,
      tone: dark ? ('dark' as const) : ('light' as const),
      ground: (dark ? [32, 32, 32] : [251, 251, 251]) as [number, number, number],
    };
    const end = geo.lines[geo.lines.length - 1].end;
    if (scene.halo.phase === 'marks')
      return {
        ...base,
        generation: run * 10 + 3,
        phase: 'marks',
        lines: [],
        whole: rangeRects(geo.newLines, 0, geo.newLines[geo.newLines.length - 1].end),
        style: marks,
      };
    return {
      ...base,
      generation: run * 10 + (scene.halo.phase === 'menu' ? 1 : 2),
      phase: scene.halo.phase,
      lines: selectionRects(geo.lines, 0, end),
      full: touchedLines(geo.lines, 0, end),
      textBox: geo.textBox,
    };
    // The theme is read when the halo's phase changes: a run keeps its tone, as in the app.
  }, [geo, scene.halo?.phase, run, marks]);

  const phaseIndex = usePhaseIndex(time, reduced ? slide : null);
  const ilot = scene.ilot;
  const stripStyle: CSSProperties | undefined = geo
    ? { right: STAGE.width - geo.strip.right, top: geo.strip.top }
    : undefined;
  const stageKey = reduced ? `slide-${run}-${slide}` : `run-${run}`;

  return (
    <div
      className="dm-root ft-scope"
      data-paused={paused ? '' : undefined}
      data-reduced={reduced ? '' : undefined}
      data-phase={ended ? 'end' : phaseIds[phaseIndex]}
      data-ended={ended ? '' : undefined}
      role="region"
      aria-label={t('demo2.region', { app: appName })}
    >
      <div
        ref={fit}
        className="dm-fit"
        style={{ width: STAGE.width, height: STAGE.height, transform: scale === 1 ? undefined : `scale(${scale})` }}
      >
        <Wallpaper />
        {/* The animation itself: decorative, out of reach of the real pointer and keyboard. Its story is the caption's. */}
        <div className="dm-scene" aria-hidden="true" inert key={reduced ? stageKey : 'scene'}>
          <MailWindow
            time={time}
            still={reduced}
            scene={scene}
            geo={geo}
            before={before}
            after={after}
            changed={changed}
            marks={marks}
            refs={{ oldP, newP, byeP, body }}
          />
          {reduced ? slide === 0 && <IntroCard style={{ opacity: 1 }} /> : <LiveIntro time={time} />}
          <ShortcutHud
            time={time}
            keys={keys}
            lit={reduced ? slide < phaseIds.length && stills[phaseIds[slide]].keysLit : null}
          />
          <div className="dm-halo">
            {haloRun && scene.halo && <HaloView event={haloRun} state={scene.halo.state} marks={marks} />}
          </div>
          <div className="dm-ilot">
            <div ref={corner} className="ilot-corner" style={stripStyle}>
              <AnimatePresence>
                {ilot && geo && (
                  <IlotView
                    key={stageKey}
                    actions={actions}
                    knownActions={known}
                    lastActionId={lastActionId}
                    origin="top"
                    originX="100%"
                    initialMode={ilot.shape === 'menu' ? ilot.mode : 'compact'}
                    shape={ilot.shape}
                    pill={pill}
                    onChoose={choose}
                    onInstruction={() => undefined}
                    onClose={() => undefined}
                    onShapeChange={onShapeChange}
                  />
                )}
              </AnimatePresence>
            </div>
          </div>
          {reduced ? stillPointer && <Cursor pointer={stillPointer} /> : <LiveCursor time={time} at={pointerNow} />}
          <ExplainRing item={rail.open ? rail.item : null} root={fit} />
        </div>

        <PhaseCaption index={phaseIndex} hidden={ended} />
        <ExplainRail
          open={rail.open}
          item={rail.item}
          shortcut={keys.join(' + ')}
          onChange={(next) => {
            touched.current = true;
            setRail(next);
          }}
        />
        <AnimatePresence>
          {ended && (
            <motion.div
              key="end"
              className="dm-end ft-glass"
              initial={{ opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={tx('smooth')}
            >
              <AppMark size={36} />
              <h2>{t('demo2.end.title')}</h2>
              <p>{t('demo2.end.text')}</p>
              <div className="dm-end-actions">
                <Button size="md" icon={<RotateCcw {...ICON} />} onClick={replay}>
                  {t('demo2.end.replay')}
                </Button>
                <Button variant="primary" size="md" iconEnd={<ArrowRight {...ICON} />} onClick={() => finish(true)}>
                  {t('demo2.end.continue')}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="dm-controls ft-glass" role="group" aria-label={t('demo2.controls')}>
          <button
            type="button"
            className="dm-ctl"
            onClick={toggle}
            aria-label={ended ? t('demo2.end.replay') : paused ? t('demo2.play') : t('demo2.pause')}
            title={ended ? t('demo2.end.replay') : paused ? t('demo2.play') : t('demo2.pause')}
          >
            {paused || ended ? <Play size={16} strokeWidth={1.75} /> : <Pause size={16} strokeWidth={1.75} />}
          </button>
          <LiveRail time={time} still={reduced ? (ended ? phaseIds.length : slide + 0.999) : null} />
          <button
            type="button"
            className="dm-ctl"
            onClick={replay}
            aria-label={t('demo2.restart')}
            title={t('demo2.restart')}
          >
            <RotateCcw size={15} strokeWidth={1.75} />
          </button>
          <button type="button" className="dm-ctl dm-skip" onClick={() => finish(false)}>
            <span>{t('demo2.skip')}</span>
            <SkipForward size={14} strokeWidth={1.75} />
          </button>
          {reduced && <span className="dm-reduced-note">{t('demo2.reduced')}</span>}
        </div>
      </div>
    </div>
  );
}

// The current phase, re-rendering only when it changes.
function usePhaseIndex(time: TimeStore, slide: number | null): number {
  const live = useSyncExternalStore(
    time.subscribe,
    () => phaseIndexAt(time.get()),
    () => 0,
  );
  return slide === null ? live : Math.min(slide, phaseIds.length - 1);
}

function LiveCursor({ time, at }: { time: TimeStore; at: (t: number) => Pointer | null }) {
  const pointer = at(useNow(time));
  return pointer ? <Cursor pointer={pointer} /> : null;
}
function LiveRail({ time, still }: { time: TimeStore; still: number | null }) {
  const now = useNow(time);
  return <PhaseRail position={still ?? position(now)} />;
}

// Phase 0: « Tout est prêt », alone over the mail draft.
function IntroCard({ style }: { style: CSSProperties }) {
  const t = useT();
  return (
    <div className="dm-intro ft-glass" style={style}>
      <div className="ft-heartbeat">
        <AppMark size={56} />
      </div>
      <h2>{t('demo2.intro.title')}</h2>
      <p>{t('demo2.intro.text')}</p>
    </div>
  );
}
function LiveIntro({ time }: { time: TimeStore }) {
  const intro = introAt(useNow(time));
  if (!intro.on) return null;
  return (
    <IntroCard style={{ opacity: intro.opacity, transform: `translate(-50%, ${intro.y}px) scale(${intro.scale})` }} />
  );
}

// A plain application that is not ours: a mail draft (neutral ink, no accent). Each paragraph is
// ONE text node, so a range gives one rectangle per line, as UI Automation does.
type MailRefs = {
  oldP: RefObject<HTMLParagraphElement | null>;
  newP: RefObject<HTMLParagraphElement | null>;
  byeP: RefObject<HTMLParagraphElement | null>;
  body: RefObject<HTMLDivElement | null>;
};
function MailWindow({
  time,
  still,
  scene,
  geo,
  before,
  after,
  changed,
  marks,
  refs,
}: {
  time: TimeStore;
  still: boolean;
  scene: Scene;
  geo: Geometry | null;
  before: string;
  after: string;
  changed: Array<{ start: number; end: number }>;
  marks: 'encre' | 'eclat';
  refs: MailRefs;
}) {
  const t = useT();
  const caret =
    !geo || !scene.caret
      ? null
      : scene.caret === 'click'
        ? geo.caretClick
        : caretPoint(geo.newLines, geo.newLines[geo.newLines.length - 1].end, true);
  const lit: ReactNode[] = [];
  let at = 0;
  changed.forEach((range, index) => {
    if (range.start > at)
      lit.push(
        <span key={`p${index}`} className="dm-lit-plain">
          {after.slice(at, range.start)}
        </span>,
      );
    lit.push(
      <span key={`w${index}`} className="halo-lit" data-style={marks === 'eclat' ? 'eclat' : undefined}>
        {after.slice(range.start, range.end)}
      </span>,
    );
    at = range.end;
  });
  if (at < after.length)
    lit.push(
      <span key="tail" className="dm-lit-plain">
        {after.slice(at)}
      </span>,
    );
  return (
    <div className="dm-mail" style={{ left: WIN.x, top: WIN.y, width: WIN.width, height: WIN.height }}>
      <div className="dm-mail-bar">
        <span className="dm-mail-app">
          <Mail size={14} strokeWidth={1.5} />
          {t('demo2.mail.app')}
        </span>
        <span className="dm-mail-title">{t('demo2.mail.window')}</span>
        <span className="dm-mail-caps">
          <span>
            <Minus size={16} strokeWidth={1} />
          </span>
          <span>
            <Square size={12} strokeWidth={1.25} />
          </span>
          <span>
            <X size={16} strokeWidth={1} />
          </span>
        </span>
      </div>
      <div className="dm-mail-tools">
        <span className="dm-mail-send">
          <Send size={14} strokeWidth={1.5} />
          {t('demo2.mail.send')}
        </span>
        <span className="dm-mail-tool">
          <Paperclip size={15} strokeWidth={1.5} />
        </span>
        <span className="dm-mail-divider" />
        <span className="dm-mail-tool">
          <Bold size={15} strokeWidth={1.75} />
        </span>
        <span className="dm-mail-tool">
          <Italic size={15} strokeWidth={1.5} />
        </span>
        <span className="dm-mail-tool">
          <Underline size={15} strokeWidth={1.5} />
        </span>
        <span className="dm-mail-tool">
          <List size={15} strokeWidth={1.5} />
        </span>
      </div>
      <div className="dm-mail-field">
        <span>{t('demo2.mail.to')}</span>
        <span className="dm-chip">{t('demo2.mail.recipient')}</span>
      </div>
      <div className="dm-mail-field">
        <span>{t('demo2.mail.subject')}</span>
        <strong>{t('demo2.mail.subjectText')}</strong>
      </div>
      <div ref={refs.body} className="dm-mail-body">
        <p>{t('demo2.mail.hello')}</p>
        <div className="dm-para">
          <p ref={refs.oldP} className="dm-text" style={{ visibility: scene.pasted ? 'hidden' : 'visible' }}>
            {before}
          </p>
          <p ref={refs.newP} className="dm-text dm-new" style={{ visibility: scene.pasted ? 'visible' : 'hidden' }}>
            {after}
          </p>
          {/* The changed words take the app's ink themselves (.halo-lit): the new text drawn again
            exactly over itself, only those words visible; in after 380 ms, out in 900 ms, as the
            halo's marks. */}
          {scene.glow !== 'off' && (
            <p className="dm-text dm-new dm-lit" data-state={scene.glow} aria-hidden="true">
              {lit}
            </p>
          )}
        </div>
        <p ref={refs.byeP} className="dm-bye">
          {t('demo2.mail.bye')}
        </p>
        <p>{t('demo2.mail.name')}</p>
      </div>
      {/* Windows' selection (one band per line) and the caret, in the stage's pixels. */}
      <div className="dm-mail-over" style={{ left: -WIN.x, top: -WIN.y }}>
        {geo && !scene.pasted && scene.selection === 'full' && (
          <Bands rects={selectionRects(geo.lines, 0, geo.lines[geo.lines.length - 1].end)} />
        )}
        {geo && !scene.pasted && scene.selection === 'live' && !still && <LiveBands time={time} lines={geo.lines} />}
        {caret && (
          <span
            className="dm-caret"
            data-blink={still ? undefined : ''}
            style={{ left: caret.x, top: caret.top, height: caret.bottom - caret.top }}
          />
        )}
      </div>
    </div>
  );
}
function Bands({ rects }: { rects: Rect[] }) {
  return (
    <>
      {rects.map((rect, index) => (
        <span
          key={index}
          className="dm-sel"
          style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
        />
      ))}
    </>
  );
}
// The selection while the pointer drags: what Windows would select at this instant.
function LiveBands({ time, lines }: { time: TimeStore; lines: TextLine[] }) {
  const at = dragSelection(lines, dragProgress(useNow(time)));
  return at ? <Bands rects={at.rects} /> : null;
}

// The user's shortcut as big keycaps under the window, lit one after the other.
function ShortcutHud({ time, keys, lit }: { time: TimeStore; keys: string[]; lit: boolean | null }) {
  const now = useNow(time);
  const hud = lit === null ? hudAt(now) : { opacity: lit ? 1 : 0, y: 0, scale: 1 };
  const states = lit === null ? keysAt(now, keys.length) : keys.map(() => ({ down: 0, lit: lit ? 1 : 0, flash: 0 }));
  return (
    <div
      className="dm-hud ft-glass"
      style={{
        left: WIN.x + WIN.width / 2,
        top: WIN.y + WIN.height + 26,
        opacity: hud.opacity,
        visibility: hud.opacity < 0.01 ? 'hidden' : 'visible',
        transform: `translate(-50%, ${hud.y}px) scale(${hud.scale})`,
      }}
    >
      {keys.map((label, index) => {
        const key = states[index];
        return (
          <span key={`${label}-${index}`} className="dm-hud-item">
            {index > 0 && (
              <span className="dm-plus" style={{ opacity: 0.35 + 0.65 * states[index - 1].lit }}>
                +
              </span>
            )}
            <span
              className="dm-key"
              data-wide={label.length > 4 ? '' : undefined}
              data-lit={key.lit > 0.5 ? '' : undefined}
              style={{ transform: `translateY(${3 * key.down}px) scale(${1 - 0.04 * key.down})` }}
            >
              <span className="dm-key-face">{label}</span>
              <span className="dm-key-lit" style={{ opacity: key.lit }}>
                {label}
              </span>
              <span
                className="dm-key-flash"
                style={{ opacity: key.flash * 0.7, transform: `scale(${1 + 0.35 * (1 - key.flash)})` }}
              />
            </span>
          </span>
        );
      })}
    </div>
  );
}

// ——— The strip on the right: what can be changed, and where ———
type ExplainId = 'shortcut' | 'actions' | 'indicator' | 'server' | 'replace' | 'undo' | 'words';
type ExplainTarget = 'hud' | 'ilot' | 'text' | 'words';
const EXPLAIN: Array<{
  id: ExplainId;
  icon: LucideIcon;
  page: Exclude<SettingsPage, 'general' | 'data' | 'diagnostic'>;
  target: ExplainTarget;
}> = [
  { id: 'shortcut', icon: Keyboard, page: 'shortcuts', target: 'hud' },
  { id: 'actions', icon: LayoutGrid, page: 'actions', target: 'ilot' },
  { id: 'indicator', icon: Sparkles, page: 'appearance', target: 'ilot' },
  { id: 'server', icon: Server, page: 'server', target: 'ilot' },
  { id: 'replace', icon: Replace, page: 'after', target: 'text' },
  { id: 'undo', icon: Undo2, page: 'after', target: 'ilot' },
  { id: 'words', icon: Highlighter, page: 'after', target: 'words' },
];
const TARGETS: Record<ExplainTarget, string> = {
  hud: '.dm-hud',
  ilot: '[data-ilot-shape]',
  text: '.dm-para',
  words: '.dm-lit .halo-lit',
};

// Collapsed to its icons; hover, focus or a tap unfolds it, and the demo waits meanwhile. The
// item under the pointer rings what it talks about, when that is on the stage at this moment.
function ExplainRail({
  open,
  item,
  shortcut,
  onChange,
}: {
  open: boolean;
  item: ExplainId | null;
  shortcut: string;
  onChange: (next: { open: boolean; item: ExplainId | null }) => void;
}) {
  const t = useT();
  const panel = useRef<HTMLElement>(null);
  const close = () => onChange({ open: false, item: null });
  return (
    <div
      className="dm-rail-clip"
      style={{ left: RAIL.right - RAIL.width, top: RAIL.y, width: RAIL.width, height: RAIL.height }}
    >
      <motion.aside
        ref={panel}
        className="dm-rail ft-glass"
        data-open={open ? '' : undefined}
        aria-label={t('demo2.rail.title')}
        initial={false}
        animate={{ width: open ? RAIL.width : RAIL.closed }}
        transition={tx('smooth')}
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse' && !open) onChange({ open: true, item: null });
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === 'mouse') close();
        }}
        onFocus={() => {
          if (!open) onChange({ open: true, item });
        }}
        onBlur={(event) => {
          if (!panel.current?.contains(event.relatedTarget as Node | null)) close();
        }}
      >
        <div className="dm-rail-in" style={{ width: RAIL.width }}>
          <button
            type="button"
            className="dm-rail-head"
            aria-expanded={open}
            onClick={() => onChange(open ? { open: false, item: null } : { open: true, item: null })}
          >
            <span className="dm-rail-icon">
              <SlidersHorizontal size={16} strokeWidth={1.5} />
            </span>
            <span className="dm-rail-head-text">
              <strong>{t('demo2.rail.title')}</strong>
              <small>{t('demo2.rail.hint')}</small>
            </span>
          </button>
          <ul className="dm-rail-list">
            {EXPLAIN.map((entry) => {
              const active = open && item === entry.id;
              const Glyph = entry.icon;
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    className="dm-rail-item"
                    data-active={active ? '' : undefined}
                    aria-pressed={active}
                    tabIndex={open ? 0 : -1}
                    onPointerEnter={() => {
                      if (open) onChange({ open: true, item: entry.id });
                    }}
                    onFocus={() => onChange({ open: true, item: entry.id })}
                    onClick={() => onChange({ open: true, item: active ? null : entry.id })}
                  >
                    <span className="dm-rail-icon" data-ft-page={entry.page}>
                      <Glyph size={16} strokeWidth={1.5} />
                    </span>
                    <span className="dm-rail-text">
                      <strong>{t(`demo2.rail.${entry.id}.title` as MessageKey)}</strong>
                      <span>{t(`demo2.rail.${entry.id}.text` as MessageKey, { shortcut })}</span>
                      <small>{t('demo2.rail.where', { page: t(`demo2.page.${entry.page}` as MessageKey) })}</small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </motion.aside>
    </div>
  );
}
// The ring around what the hovered item talks about (nothing when it is not on the stage now).
function ExplainRing({ item, root }: { item: ExplainId | null; root: RefObject<HTMLDivElement | null> }) {
  const [rects, setRects] = useState<Rect[]>([]);
  useLayoutEffect(() => {
    const host = root.current;
    const entry = EXPLAIN.find((candidate) => candidate.id === item);
    if (!host || !entry) {
      setRects([]);
      return;
    }
    const found = [...host.querySelectorAll(TARGETS[entry.target])].filter((element) => {
      const style = getComputedStyle(element);
      return style.visibility !== 'hidden' && Number(style.opacity) > 0.5 && !element.closest('[data-state="out"]');
    });
    setRects(found.map((element) => boxIn(element, host)).filter((box) => box.width > 1 && box.height > 1));
  }, [item, root]);
  return (
    <div className="dm-ring-layer">
      {rects.map((rect, index) => (
        <motion.span
          key={`${item}-${index}`}
          className="dm-ring"
          initial={{ opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', duration: 0.35, bounce: 0.2 }}
          style={{
            left: rect.x - 6,
            top: rect.y - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            borderRadius: Math.min(18, (rect.height + 12) / 2),
          }}
        />
      ))}
    </div>
  );
}
