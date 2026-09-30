// The demo as a pure function of time: scene(t, geo, opts) → every value the view needs.
// Nothing here keeps state, so play, pause, scrub, replay and the explainer's « show me this
// moment » are all the same thing: pick a t and render. Times are milliseconds at 1× (the lab's
// speed only changes how fast t advances). Springs are Apple's (lib/motion.js SPRINGS), solved in
// closed form (lib/spring.js), so a scrubbed frame is exactly the frame that plays.
import { SPRINGS } from '../lib/motion.js';
import { fromAppleDurationBounce, springSolver } from '../lib/spring.js';

// ——— The script ———
export const T = {
  introClose: 520,        // the setup window closes
  win: 760,               // the mail window opens
  cursorIn: 1300, cursorAt: 2300,
  press: 2450, dragFrom: 2560, dragTo: 3760, release: 3860,
  cursorAway: 3920, cursorRest: 4420,
  hudIn: 4250, key1: 4700, key2: 5060, key3: 5420, keysUp: 5980, hudOut: 6250,
  ilotIn: 5540,
  toIlot: 6300, atIlot: 6980, unfold: 7430,
  toTile: 7700, atTile: 8160, click: 8380,
  work: 8520, replace: 10350,
  toUndo: 10850, atUndo: 11450, leave: 12350, left: 12950,
  resultOut: 13400, diffOut: 13400,
  end: 14250, END: 15400,
};
export const START_NO_INTRO = 500;

// Captions (one short line per chapter) — also the scrubber's ticks.
export const CHAPTERS = [
  { at: 1150, n: 1, text: 'Sélectionnez du texte, dans n’importe quelle application' },
  { at: 4200, n: 2, text: 'Appuyez sur le raccourci' },
  { at: 6000, n: 3, text: 'Choisissez une action, ou tapez sa lettre' },
  { at: 8480, n: 4, text: 'Votre modèle travaille' },
  { at: 10300, n: 5, text: 'Le texte est remplacé, les mots changés sont surlignés' },
  { at: T.end - 200, n: 6, text: '' },
];
export function chapterAt(t) {
  let c = null;
  for (const ch of CHAPTERS) if (t >= ch.at) c = ch;
  return c;
}

// Mouvement réduit: a calm slideshow of still frames, each held HOLD ms.
export const SLIDES = [900, 3900, 5700, 7600, 9300, 11000, 14400];
export const HOLD = 2600;

// ——— Maths ———
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, p) => a + (b - a) * p;
export const prog = (t, a, b) => clamp((t - a) / (b - a));
const minJerk = p => p * p * p * (10 - 15 * p + 6 * p * p);          // natural hand movement
const easeOut = p => 1 - (1 - p) ** 3;
const smooth = (a, b, p) => { const x = clamp((p - a) / (b - a)); return x * x * (3 - 2 * x); };
// From the arrow's tip to the centre of its drawn box (Demo.jsx BigCursor draws it centred).
export const TIP = { x: 10, y: 15 };
const easeInOut = p => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);
const solvers = {};
const solverOf = name => (solvers[name] ||= springSolver(fromAppleDurationBounce(SPRINGS[name].duration, SPRINGS[name].bounce)));
// Spring progress 0 → 1 (may overshoot) started at t0.
export function sp(t, t0, name = 'smooth') {
  if (t <= t0) return 0;
  const s = (t - t0) / 1000;
  if (s > 2.5) return 1;
  return solverOf(name).pos(s);
}
// Opacity/scale entrance and exit on the same element: in at a (spring), out at b (ease-out 160 ms).
function presence(t, a, b = Infinity, spring = 'smooth', outMs = 180) {
  const pin = sp(t, a, spring);
  const pout = b === Infinity ? 0 : easeOut(prog(t, b, b + outMs));
  return { pin, pout, o: clamp(pin * 1.6) * (1 - pout), on: t >= a && t < b + outMs };
}
// Quadratic Bézier with a sideways bow (the hand never moves in a straight line).
function curve(a, b, p, bow = 0.18) {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const dx = b.x - a.x, dy = b.y - a.y;
  const c = { x: mx - dy * bow, y: my + dx * bow };
  const u = 1 - p;
  return { x: u * u * a.x + 2 * u * p * c.x + p * p * b.x, y: u * u * a.y + 2 * u * p * c.y + p * p * b.y };
}
function along(points, p) { // piecewise-linear path through points, p in 0..1 by segment count
  if (points.length < 2) return points[0];
  const f = p * (points.length - 1);
  const i = Math.min(points.length - 2, Math.floor(f));
  const k = f - i;
  return { x: lerp(points[i].x, points[i + 1].x, k), y: lerp(points[i].y, points[i + 1].y, k) };
}

// ——— The scene ———
// geo: measured geometry in desktop px (see Demo.jsx measure()). Missing pieces fall back to
// sensible guesses so the first frame never breaks.
export function scene(t, geo) {
  const g = geo || {};
  const words = g.words || [];
  const n = words.length || 1;
  const s = {};

  // Setup window closing, mail window opening.
  const close = easeOut(prog(t, T.introClose, T.introClose + 260));
  s.intro = { o: 1 - close, scale: 1 - 0.03 * close, y: 4 * close, on: t < T.introClose + 260 };
  const win = sp(t, T.win, 'window');
  s.win = { o: clamp(win * 1.5), scale: 0.96 + 0.04 * win, y: 10 * (1 - win) };

  // Drag selection: how many words are selected (word by word).
  const drag = easeInOut(prog(t, T.dragFrom, T.dragTo));
  const selCount = t < T.dragFrom ? 0 : Math.min(n, Math.floor(drag * n + 0.35));
  const replaced = t >= T.replace;
  s.sel = words.map((w, i) => {
    const k = i < selCount ? sp(t, T.dragFrom + (T.dragTo - T.dragFrom) * (i / n), 'snappy') : 0;
    const fade = 1 - easeOut(prog(t, T.replace - 60, T.replace + 140));
    return { k: clamp(k, 0, 1.04), o: (i < selCount ? 1 : 0) * fade };
  });
  // Old text → new text (crossfade, the new layer lands a hair later).
  s.oldText = 1 - easeOut(prog(t, T.replace, T.replace + 220));
  s.newText = easeOut(prog(t, T.replace + 60, T.replace + 320));
  s.working = t >= T.work && t < T.replace;
  // Changed words: pop in one after the other, then fade when Undo is gone.
  s.diff = (g.diff || []).map((_, i) => {
    const p = sp(t, T.replace + 180 + i * 90, 'bouncy');
    const out = easeOut(prog(t, T.diffOut + 200, T.diffOut + 800));
    return { k: 0.6 + 0.4 * clamp(p, 0, 1.05), o: clamp(p * 1.4) * (1 - out) };
  });
  s.replaced = replaced;

  // Shortcut HUD and its three keys.
  const hud = presence(t, T.hudIn, T.hudOut, 'smooth', 220);
  s.hud = { o: hud.o, y: 14 * (1 - hud.pin) + 6 * hud.pout, scale: 0.94 + 0.06 * clamp(hud.pin, 0, 1.02) };
  s.keys = [T.key1, T.key2, T.key3].map(at => {
    const down = sp(t, at, 'snappy');
    const up = t >= T.keysUp ? sp(t, T.keysUp, 'smooth') : 0;
    const d = clamp(down) * (1 - clamp(up));
    const flash = t >= at ? Math.max(0, 1 - (t - at) / 420) : 0;
    return { d, lit: clamp(down * 1.3) * (1 - clamp(up)), flash };
  });

  // The Îlot: compact → grid → work pill → result pill.
  const ilot = presence(t, T.ilotIn, T.unfold, 'bouncy', 160);
  s.compact = { o: ilot.o, scale: 0.9 + 0.1 * clamp(ilot.pin, 0, 1.03), y: -6 * (1 - clamp(ilot.pin)) };
  const grid = presence(t, T.unfold, T.work, 'smooth', 160);
  s.grid = { o: grid.o, scale: 0.92 + 0.08 * clamp(grid.pin, 0, 1.02) - 0.08 * grid.pout, on: grid.on };
  s.hot = t >= T.atTile - 60 ? 0 : -1;                          // Corriger lit under the cursor
  s.tilePress = t >= T.click && t < T.click + 160 ? 1 : 0;
  const work = presence(t, T.work, T.replace, 'bouncy', 160);
  s.work = { o: work.o, scale: 0.8 + 0.2 * clamp(work.pin, 0, 1.05) - 0.1 * work.pout, on: work.on };
  const result = presence(t, T.replace, T.resultOut, 'bouncy', 200);
  s.result = { o: result.o, scale: 0.8 + 0.2 * clamp(result.pin, 0, 1.05) - 0.08 * result.pout, on: result.on };
  s.check = clamp(sp(t, T.replace + 120, 'bouncy'), 0, 1.1);
  s.countdown = prog(t, T.replace + 200, T.resultOut);             // 0 → 1: the Undo window runs out
  s.undoHover = t >= T.atUndo - 80 && t < T.leave;

  // The cursor.
  const home = g.cursorHome || { x: 1000, y: 700 };
  const selStart = g.selStart || { x: 300, y: 250 };
  const path = g.dragPath || [selStart, { x: 600, y: 270 }];
  const selEnd = path[path.length - 1];
  const rest = g.cursorRestPt || { x: selEnd.x + 90, y: selEnd.y + 90 };
  const ilotPt = g.ilotPt || { x: selEnd.x, y: selEnd.y + 40 };
  const tilePt = g.tilePt || { x: ilotPt.x, y: ilotPt.y + 20 };
  const undoPt = g.undoPt || tilePt;
  const exitPt = g.cursorExit || { x: undoPt.x + 170, y: undoPt.y + 120 };
  // Every target point is where the TIP lands (the click point). The pointer glyph is centred in
  // the halo, so the drawn position is the tip + TIP (arrow) or the point itself (I-beam, centred);
  // tk blends the two so the halo never jumps when the pointer changes shape.
  const tileOff = g.tileOff || { x: tilePt.x + 30, y: tilePt.y + 32 };
  let c; let tk = 0;
  if (t < T.cursorIn) c = home;
  else if (t < T.cursorAt) { const p = prog(t, T.cursorIn, T.cursorAt); c = curve(home, selStart, minJerk(p), 0.22); tk = smooth(0.6, 0.86, p); }
  else if (t < T.dragFrom) { c = selStart; tk = 1; }
  else if (t < T.cursorAway) { c = along(path, drag); tk = 1; }
  else if (t < T.toIlot) { const p = prog(t, T.cursorAway, T.cursorRest); c = curve(selEnd, rest, minJerk(p), -0.2); tk = 1 - smooth(0.08, 0.34, p); }
  else if (t < T.toTile) c = curve(rest, ilotPt, minJerk(prog(t, T.toIlot, T.atIlot)), 0.25);
  else if (t < T.click + 160) c = curve(ilotPt, tilePt, minJerk(prog(t, T.toTile, T.atTile)), -0.15);
  else if (t < T.toUndo) c = curve(tilePt, tileOff, minJerk(prog(t, T.click + 160, T.click + 620)), 0.1);  // steps aside after the click
  else if (t < T.leave) c = curve(tileOff, undoPt, minJerk(prog(t, T.toUndo, T.atUndo)), 0.2);
  else c = curve(undoPt, exitPt, minJerk(prog(t, T.leave, T.left)), -0.2);
  const text = tk > 0.5;
  const cursorIn = easeOut(prog(t, T.cursorIn - 250, T.cursorIn + 150));
  const cursorOut = easeOut(prog(t, T.left - 300, T.left));
  // Once it has clicked or while it rests on « Annuler », the cursor fades back so what it points
  // at stays readable.
  const dimTile = prog(t, T.click + 160, T.click + 520) * (1 - prog(t, T.toUndo, T.toUndo + 300));
  const dimUndo = prog(t, T.atUndo - 150, T.atUndo + 150) * (1 - prog(t, T.leave, T.leave + 200));
  const dim = 1 - 0.55 * Math.max(dimTile, dimUndo);
  // Press: the halo dips while the button is down (selection drag, tile click).
  const down = (t >= T.press && t < T.release) || (t >= T.click && t < T.click + 140);
  const downK = down ? clamp(sp(t, t >= T.click ? T.click : T.press, 'snappy')) : 1 - clamp(sp(t, t >= T.click + 140 ? T.click + 140 : T.release, 'snappy'));
  s.cursor = { x: c.x + TIP.x * (1 - tk), y: c.y + TIP.y * (1 - tk), o: cursorIn * (1 - cursorOut) * dim, text, tk, down: clamp(downK) };
  // Click ripples (press of the selection, click on the tile).
  s.ripples = [T.press, T.click].map((at, i) => {
    const p = prog(t, at, at + 520);
    const at2 = i === 0 ? selStart : tilePt;
    return { x: at2.x, y: at2.y, k: 0.4 + 1.1 * easeOut(p), o: t >= at && p < 1 ? 0.55 * (1 - p) : 0 };
  });

  // The end card.
  const end = sp(t, T.end, 'smooth');
  s.end = { o: clamp(end * 1.4), y: 10 * (1 - clamp(end)), scale: 0.97 + 0.03 * clamp(end, 0, 1.01), on: t >= T.end };
  s.chapter = chapterAt(t);
  return s;
}
