import { minJerk, stroke, type Point } from './selection';

// The demo's script (docs/PLAN-0.6.md §4.2). The demo plays the app's REAL components (the Îlot,
// the result pill's contents, the halo): this file never draws them. It only says WHEN things
// happen and where the pointer is:
//
//   · what is continuous (the pointer, the drag, the keycaps, the phase's progress, the cards)
//     is a pure function of the time t, in milliseconds;
//   · what is discrete (the capture, the pointer's click, the model's answer, the paste…) is a
//     list of cues, each fired once when the time crosses it; the components then live their own
//     life (their springs, their timers), exactly as in the app.
//
// The player owns the time: it runs, pauses, starts again and stops (abort) from any instant, and
// a cue can never fire twice nor after a stop. Nothing here knows React or the DOM.

// ——— The seven phases (Lucas, 01/10: each phase must be told apart) ———
export const phaseIds = ['ready', 'select', 'shortcut', 'menu', 'work', 'result', 'undo'] as const;
export type PhaseId = typeof phaseIds[number];

// Times in milliseconds. The drag lasts 1.6 s; the keys go down one after the other; the capture
// follows the last key by the time Rust takes (≈ 120 ms).
export const T = {
  introOut: 2050,                       // « Tout est prêt » leaves
  select: 2400,                         // phase 1
  cursorIn: 2500, cursorAt: 3300,
  press: 3450, dragFrom: 3550, dragTo: 5150, release: 5230,
  shortcut: 5500,                       // phase 2
  cursorAway: 5520, cursorRest: 6050,
  hudIn: 5600, key1: 6050, key2: 6400, key3: 6750, open: 6870, keysUp: 7300,
  menu: 7600,                           // phase 3
  hudOut: 7600,
  toAsk: 7650, atAsk: 8250,
  toTile: 9150, atTile: 9700, click: 9900, pick: 10020,
  work: 10020,                          // phase 4: the choice is made on the click's release
  away: 10100, awayAt: 10700,
  answer: 11820, paste: 12000,
  result: 12000,                        // phase 5
  undo: 14300,                          // phase 6
  toUndo: 14400, atUndo: 15050, leaveUndo: 16050,
  atCaret: 16700, caret: 16850,
  cursorOut: 17150, cursorGone: 17750,
  end: 18500,
  END: 18800,
} as const;

export const phaseStarts: Record<PhaseId, number> = { ready: 0, select: T.select, shortcut: T.shortcut, menu: T.menu, work: T.work, result: T.result, undo: T.undo };
// Each change of phase marks a beat: the caption fades, the new segment lights up.
export const PHASE_BEAT_MS = 250;

export function phaseIndexAt(t: number): number {
  let index = 0;
  for (let i = 0; i < phaseIds.length; i++) if (t >= phaseStarts[phaseIds[i]]) index = i;
  return index;
}
export const phaseAt = (t: number): PhaseId => phaseIds[phaseIndexAt(t)];
// 0 → 1 inside the current phase (Lucas: « la phase 0, c'est de 0 à 1 ; la phase 1, de 1 à 2 »).
export function phaseProgress(t: number): number {
  const index = phaseIndexAt(t);
  const from = phaseStarts[phaseIds[index]];
  const to = index + 1 < phaseIds.length ? phaseStarts[phaseIds[index + 1]] : T.end;
  return to <= from ? 1 : Math.min(1, Math.max(0, (t - from) / (to - from)));
}
// The whole demo on one number: 2.5 is the middle of phase 2.
export const position = (t: number) => (t >= T.end ? phaseIds.length : phaseIndexAt(t) + phaseProgress(t));

// ——— Cues ———
export type CueId = 'intro-out' | 'press' | 'release' | 'open' | 'click' | 'pick' | 'answer' | 'paste' | 'caret-down' | 'caret' | 'end';
export type Cue = { id: CueId; at: number };
export const cues: readonly Cue[] = [
  { id: 'intro-out', at: T.introOut },
  { id: 'press', at: T.press },
  { id: 'release', at: T.release },
  { id: 'open', at: T.open },
  { id: 'click', at: T.click },
  { id: 'pick', at: T.pick },
  { id: 'answer', at: T.answer },
  { id: 'paste', at: T.paste },
  { id: 'caret-down', at: T.atCaret + 60 },
  { id: 'caret', at: T.caret },
  { id: 'end', at: T.end },
];
// The cues in (from, to], in order.
export function cuesBetween(from: number, to: number): Cue[] {
  return cues.filter(cue => cue.at > from && cue.at <= to);
}

// ——— Continuous values ———
const clamp = (value: number, low = 0, high = 1) => Math.min(high, Math.max(low, value));
export const prog = (t: number, from: number, to: number) => (to <= from ? (t >= from ? 1 : 0) : clamp((t - from) / (to - from)));
const easeOut = (p: number) => 1 - (1 - p) ** 3;

// The drag: 0 before, 1 once the pointer reached the end (selection.ts gives it a hand's ease).
export const dragProgress = (t: number) => prog(t, T.dragFrom, T.dragTo);
export const dragging = (t: number) => t >= T.press && t < T.release;

// The keycaps under the window: each one goes down at its time (d: how far it is pressed, lit:
// how lit it is, flash: the ring that leaves it), all go up together.
export type KeyState = { down: number; lit: number; flash: number };
export function keysAt(t: number, count = 3): KeyState[] {
  const times = [T.key1, T.key2, T.key3];
  // More than three keys (Ctrl + Alt + Shift + X): spread the same span over them.
  const at = (index: number) => count <= 3 ? times[Math.min(index, 2)] : T.key1 + (index * (T.key3 - T.key1)) / (count - 1);
  return Array.from({ length: count }, (_, index) => {
    const down = easeOut(prog(t, at(index), at(index) + 160));
    const up = easeOut(prog(t, T.keysUp, T.keysUp + 260));
    return { down: down * (1 - up), lit: clamp(down * 1.3) * (1 - up), flash: t >= at(index) ? Math.max(0, 1 - (t - at(index)) / 420) : 0 };
  });
}
export function hudAt(t: number): { opacity: number; y: number; scale: number } {
  const enter = easeOut(prog(t, T.hudIn, T.hudIn + 320));
  const leave = easeOut(prog(t, T.hudOut, T.hudOut + 220));
  return { opacity: enter * (1 - leave), y: 14 * (1 - enter) + 6 * leave, scale: 0.94 + 0.06 * enter };
}
export function introAt(t: number): { opacity: number; scale: number; y: number; on: boolean } {
  const enter = easeOut(prog(t, 150, 550));
  const leave = easeOut(prog(t, T.introOut, T.introOut + 260));
  return { opacity: enter * (1 - leave), scale: 0.96 + 0.04 * enter - 0.03 * leave, y: 8 * (1 - enter) + 4 * leave, on: t < T.introOut + 260 };
}

// ——— The pointer ———
// The places it goes to, measured in the stage by the demo (pixels of the stage). Each is read
// when it is needed: the tile only exists once the grid has unfolded.
export type PointerPlaces = {
  home: Point;            // where it comes from, bottom right
  dragFrom: Point; dragTo: Point;
  rest: Point;            // aside while the keys go down
  ask: Point;             // the ✦ of the compact Îlot
  tile: Point;            // the action's tile in the grid
  aside: Point;           // aside while the model works
  undo: Point;            // the Undo button of the result pill
  caret: Point;           // the click in the text that ends the marks
  out: Point;
};
export type PointerShape = 'arrow' | 'beam';
export type Pointer = { x: number; y: number; opacity: number; shape: PointerShape; press: number };

// `drag`: where the drag stands (selection.ts dragPoint), given by the caller so the pointer and
// the selection always agree.
export function pointerAt(t: number, places: PointerPlaces, drag: (p: number) => Point): Pointer {
  let point: Point; let shape: PointerShape = 'arrow';
  if (t < T.cursorIn) point = places.home;
  else if (t < T.cursorAt) { const p = prog(t, T.cursorIn, T.cursorAt); point = stroke(places.home, places.dragFrom, p, 0.2); shape = minJerk(p) > 0.86 ? 'beam' : 'arrow'; }
  else if (t < T.dragFrom) { point = places.dragFrom; shape = 'beam'; }
  else if (t < T.cursorAway) { point = drag(dragProgress(t)); shape = 'beam'; }
  else if (t < T.toAsk) { const p = prog(t, T.cursorAway, T.cursorRest); point = stroke(places.dragTo, places.rest, p, -0.2); shape = minJerk(p) < 0.1 ? 'beam' : 'arrow'; }
  else if (t < T.toTile) point = stroke(places.rest, places.ask, prog(t, T.toAsk, T.atAsk), 0.22);
  else if (t < T.away) point = stroke(places.ask, places.tile, prog(t, T.toTile, T.atTile), -0.18);
  else if (t < T.toUndo) point = stroke(places.tile, places.aside, prog(t, T.away, T.awayAt), 0.12);
  else if (t < T.leaveUndo) point = stroke(places.aside, places.undo, prog(t, T.toUndo, T.atUndo), 0.2);
  else if (t < T.cursorOut) { const p = prog(t, T.leaveUndo, T.atCaret); point = stroke(places.undo, places.caret, p, -0.22); shape = minJerk(p) > 0.7 ? 'beam' : 'arrow'; }
  else { const p = prog(t, T.cursorOut, T.cursorGone); point = stroke(places.caret, places.out, p, 0.18); shape = minJerk(p) < 0.18 ? 'beam' : 'arrow'; }
  const enter = easeOut(prog(t, T.cursorIn - 250, T.cursorIn + 150));
  const leave = easeOut(prog(t, T.cursorGone - 350, T.cursorGone));
  const down = (t >= T.press && t < T.release) || (t >= T.click && t < T.pick) || (t >= T.caret && t < T.caret + 110);
  const since = t >= T.caret ? T.caret : t >= T.click ? T.click : T.press;
  const until = t >= T.caret + 110 ? T.caret + 110 : t >= T.pick ? T.pick : T.release;
  const press = t < T.press ? 0 : down ? easeOut(prog(t, since, since + 120)) : 1 - easeOut(prog(t, until, until + 200));
  return { x: point.x, y: point.y, opacity: enter * (1 - leave), shape, press: clamp(press) };
}

// ——— Reduced motion: one still picture per phase, each held HOLD ms ———
export const SLIDE_HOLD_MS = 2600;
// What a phase looks like once it is over (the picture of its slide).
export type Still = {
  intro: boolean;
  selected: boolean;
  keysLit: boolean;
  ilot: 'none' | 'compact' | 'grid' | 'working' | 'done' | 'check';
  halo: 'none' | 'menu' | 'work' | 'marks';
  pasted: boolean;
  marks: boolean;
  pointer: keyof PointerPlaces | null;
};
export const stills: Record<PhaseId, Still> = {
  ready: { intro: true, selected: false, keysLit: false, ilot: 'none', halo: 'none', pasted: false, marks: false, pointer: null },
  select: { intro: false, selected: true, keysLit: false, ilot: 'none', halo: 'none', pasted: false, marks: false, pointer: 'dragTo' },
  shortcut: { intro: false, selected: true, keysLit: true, ilot: 'compact', halo: 'menu', pasted: false, marks: false, pointer: 'rest' },
  menu: { intro: false, selected: true, keysLit: false, ilot: 'grid', halo: 'menu', pasted: false, marks: false, pointer: 'tile' },
  work: { intro: false, selected: true, keysLit: false, ilot: 'working', halo: 'work', pasted: false, marks: false, pointer: 'aside' },
  result: { intro: false, selected: false, keysLit: false, ilot: 'done', halo: 'marks', pasted: true, marks: true, pointer: 'aside' },
  undo: { intro: false, selected: false, keysLit: false, ilot: 'check', halo: 'none', pasted: true, marks: false, pointer: 'caret' },
};

// ——— The player ———
export type PlayerState = { t: number; playing: boolean; ended: boolean };
export type PlayerHost = {
  now: () => number;
  // Asks for one frame; returns how to cancel it.
  frame: (run: (now: number) => void) => () => void;
  onCue: (cue: Cue) => void;
  onChange: (state: PlayerState) => void;
};
export type Player = {
  state: () => PlayerState;
  play: () => void;
  pause: () => void;
  // Back to the start, playing (« Revoir »).
  restart: () => void;
  // Stops for good: no cue, no frame, no change after it.
  stop: () => void;
};

// A step longer than this (the page was hidden, the machine stalled) is cut: the demo never
// jumps over a cue's neighbours in one frame.
const MAX_STEP_MS = 64;

export function createPlayer(host: PlayerHost, start = 0): Player {
  let t = start, playing = false, stopped = false, last = 0;
  let cancel: (() => void) | null = null;
  const snapshot = (): PlayerState => ({ t, playing, ended: t >= T.END });
  const tell = () => { if (!stopped) host.onChange(snapshot()); };
  const halt = () => { cancel?.(); cancel = null; };
  const tick = (now: number) => {
    cancel = null;
    if (stopped || !playing) return;
    const step = Math.min(MAX_STEP_MS, Math.max(0, now - last));
    last = now;
    const next = Math.min(T.END, t + step);
    const due = cuesBetween(t, next);
    t = next;
    for (const cue of due) { if (stopped) return; host.onCue(cue); }
    if (stopped) return;
    if (t >= T.END) playing = false; else if (playing) cancel = host.frame(tick);
    tell();
  };
  return {
    state: snapshot,
    play() {
      if (stopped || playing || t >= T.END) return;
      playing = true; last = host.now();
      halt(); cancel = host.frame(tick);
      tell();
    },
    pause() {
      if (stopped || !playing) return;
      playing = false; halt(); tell();
    },
    restart() {
      if (stopped) return;
      halt(); t = start; playing = true; last = host.now();
      cancel = host.frame(tick);
      tell();
    },
    stop() { stopped = true; playing = false; halt(); },
  };
}
