// The demo as a pure function of time: scene(t, geo, opts) → every value the view needs. Nothing
// here keeps state, so play, pause, scrub, replay, a theme change, the explainer's « show me this
// moment » and a replay while it runs are all the same thing: pick a t and render. A frame can
// never stay stuck half-way: what shows at t is decided by t alone.
//
// Every motion of the app's objects is the APP's, computed from its own code (./app.js):
//   the Îlot's entrance / exit      src/motion/presence.ts surfacePresence (enter spring, exit curve)
//   its shape changes               src/menu/MorphSurface.tsx + src/motion/surface.ts animateSurface
//                                   (width, height, radius on the morph spring, content centred)
//   its content swaps               src/motion/presence.ts contentPresence (in after min(90, content/2),
//                                   out in 0.6 × content, accelerating)
//   the grid opening right          src/layout.ts ilotMenuShift, src/menu/IlotStage.tsx:224-237
//   the pill's glide under the text src/menu/IlotStage.tsx:514-526 (surfaceMove, 420 ms)
//   the halo (menu, work, marks)    src/halo/HaloWindow.tsx, halo.css
//   the countdown, Undo withdrawn   src/result/countdown.ts, IlotStage.tsx:426-430
// Reduced motion follows the app too: opacity fades of 120 ms, shapes set at once, the halo still.
// Times are milliseconds at 1× (the lab's speed only changes how fast t advances).
import {
  motionPresets, contentTiming, exitScale, emilOut, accelerate, surfaceMove, reducedFadeMs,
  fromAppleDurationBounce, springSolver, surfaceRadius, ilotMetrics, ilotMenuShift, workingPillShape,
  ORB_DELAY_MS, CHECK_ONLY_MS, UNDO_MS, MARKS_OUT_MS, HALO_FADE_MS, MARK_IN, CHECK_DRAW, PILL_GAP,
} from './app.js';

// ——— The script ———
export const T = {
  introClose: 520,        // the setup window closes (standalone only)
  win: 760,               // the mail window opens
  cursorIn: 1300, cursorAt: 2300,
  press: 2450, dragFrom: 2560, dragTo: 4360, release: 4440,   // the drag: 1.8 s, word by word
  cursorAway: 4500, cursorRest: 5050,
  hudIn: 4850, key1: 5250, key2: 5600, key3: 5950, keysUp: 6450, hudOut: 6800,
  open: 6070,             // Rust's capture: the Îlot shows, compact, with the menu's halo
  toAsk: 6650, atAsk: 7250, // the pointer comes to rest on the ✦
  toTile: 8150, atTile: 8700, click: 8900, clickUp: 9020,
  away: 9100, awayAt: 9700,
  answer: 10720,          // the model answered: Rust fades the work halo out (halo::leave, 150 ms ease-in)
  paste: 10900,           // Rust pasted: the text is replaced, the check and Undo
  toUndo: 11600, atUndo: 12250, leaveUndo: 13250,
  atCaret: 13900, caret: 14050,   // a click in the text: Undo withdrawn, the marks leave
  cursorOut: 14350, cursorGone: 14950,
  end: 15900, END: 17400,
};
// A pointer resting on the ✦ unfolds the grid after ilotMetrics.hoverMs (src/menu/Ilot.tsx:243).
// It enters the ✦ a few frames before it stops.
// A tile is chosen on onClick (src/menu/Ilot.tsx grid tiles), i.e. on the RELEASE: everything the
// choice starts (the working pill, the corner back, the work halo, the orb's wait) keys on T.pick.
T.pick = T.clickUp;
T.askEnter = T.atAsk - 70;
T.unfold = T.askEnter + ilotMetrics.hoverMs;
export const START_NO_INTRO = 500;

export const CHAPTERS = [
  { at: 1150, n: 1, text: 'Sélectionnez du texte, dans n’importe quelle application' },
  { at: 4750, n: 2, text: 'Appuyez sur le raccourci' },
  { at: 6400, n: 3, text: 'Choisissez une action, ou tapez sa lettre' },
  { at: 8950, n: 4, text: 'Votre modèle travaille' },
  { at: 10850, n: 5, text: 'Le texte est remplacé, les mots changés sont marqués' },
  { at: 13300, n: 6, text: 'Un clic dans le texte, et les marques s’en vont' },
  { at: T.end - 200, n: 7, text: '' },
];
export function chapterAt(t) {
  let c = null;
  for (const ch of CHAPTERS) if (t >= ch.at) c = ch;
  return c;
}

// Mouvement réduit: a calm slideshow of still frames, one per real state, each held HOLD ms.
export const SLIDES = [1500, 4420, 6300, 7950, 9900, 11700, 12700, 14500, 16600];
export const HOLD = 2600;

// ——— Maths ———
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, p) => a + (b - a) * p;
export const prog = (t, a, b) => (b <= a ? (t >= a ? 1 : 0) : clamp((t - a) / (b - a)));
const minJerk = p => p * p * p * (10 - 15 * p + 6 * p * p);   // a hand's movement
const smoothstep = (a, b, p) => { const x = clamp((p - a) / (b - a)); return x * x * (3 - 2 * x); };

// CSS cubic-bezier(x1, y1, x2, y2), solved for x (Newton, then bisection).
const bezCache = new Map();
export function bezier(x1, y1, x2, y2) {
  const key = `${x1},${y1},${x2},${y2}`;
  if (bezCache.has(key)) return bezCache.get(key);
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = s => ((ax * s + bx) * s + cx) * s, Y = s => ((ay * s + by) * s + cy) * s, dX = s => (3 * ax * s + 2 * bx) * s + cx;
  const f = x => {
    if (x <= 0) return 0; if (x >= 1) return 1;
    let s = x;
    for (let i = 0; i < 8; i++) { const e = X(s) - x; if (Math.abs(e) < 1e-6) return Y(s); const d = dX(s); if (Math.abs(d) < 1e-6) break; s -= e / d; }
    let lo = 0, hi = 1; s = x;
    for (let i = 0; i < 30; i++) { const v = X(s); if (Math.abs(v - x) < 1e-6) break; if (v < x) lo = s; else hi = s; s = (lo + hi) / 2; }
    return Y(s);
  };
  bezCache.set(key, f);
  return f;
}
const EASE_OUT = bezier(0, 0, 0.58, 1);            // CSS ease-out
const EASE_IN_OUT = bezier(0.45, 0, 0.55, 1);
const HALO_LEAVE = bezier(0.42, 0, 1, 1);         // CSS ease-in (halo.css:6)
const ease = arr => bezier(...arr);
const curveAt = (t, t0, { ms, ease: e }) => ease(e)(prog(t, t0, t0 + ms));

// A spring (Apple duration / bounce, the app's tokens) from 0 to 1, started at t0: the closed form
// of src/motion/spring.ts, which is what Motion runs for toMotionSpring(spring).
const solvers = new Map();
export function spring(t, t0, s) {
  if (t <= t0) return 0;
  const key = `${s.duration}|${s.bounce}`;
  if (!solvers.has(key)) solvers.set(key, springSolver(fromAppleDurationBounce(s.duration, s.bounce)));
  const sec = (t - t0) / 1000;
  return sec > 3 ? 1 : solvers.get(key).pos(sec);
}

// A value that changes at given times, each change animated from where it stood at that moment
// (as Motion does when a new target arrives). changes: [{ at, v, how: 'instant' | spring | curve }],
// v a number or an object of numbers.
function track(t, changes) {
  let i = -1;
  for (let k = 0; k < changes.length; k++) if (changes[k].at <= t) i = k;
  return i < 0 ? changes[0].v : chain(t, changes, i);
}
function chain(t, changes, i) {
  const c = changes[i];
  if (i === 0 || c.how === 'instant') return c.v;
  const from = chain(c.at, changes, i - 1);
  const p = c.how.ms != null ? curveAt(t, c.at, c.how) : spring(t, c.at, c.how);
  return mix(from, c.v, p);
}
function mix(a, b, p) {
  if (typeof a === 'number') return lerp(a, b, p);
  const out = {};
  for (const k of Object.keys(b)) out[k] = lerp(a[k] ?? b[k], b[k], p);
  return out;
}

// ——— The scene ———
// geo: measured geometry in desktop px (see Demo.jsx measure()). Missing pieces fall back to
// sensible guesses so the first frame never breaks.
// opts: { preset: 'smooth' | 'bouncy', reduced, marks: 'actuel' | 'encre' | 'eclat' | 'reflet' }
export function scene(t, geo, opts = {}) {
  const g = geo || {};
  const tokens = motionPresets[opts.preset] || motionPresets.smooth;
  const reduced = !!opts.reduced;
  const s = { t, reduced };

  // ——— Windows (the stand-in setup, the mail draft): the lab's own springs, not the app's ———
  const close = EASE_OUT(prog(t, T.introClose, T.introClose + 260));
  s.intro = { o: 1 - close, scale: 1 - 0.03 * close, y: 4 * close, on: t < T.introClose + 260 };
  const win = reduced ? prog(t, T.win, T.win + 200) : spring(t, T.win, { duration: 0.42, bounce: 0.08 });
  s.win = { o: clamp(win * 1.5), scale: reduced ? 1 : 0.96 + 0.04 * win, y: reduced ? 0 : 10 * (1 - win) };

  // ——— The text ———
  const n = Math.max(1, (g.sel?.length || 2) - 1);   // words of the selection (g.sel[k]: after k words)
  const drag = EASE_IN_OUT(prog(t, T.dragFrom, T.dragTo));
  // Word by word: the selection reaches the end of word k once the hand passed it.
  s.selWords = t < T.dragFrom ? 0 : Math.min(n, Math.floor(drag * n + 0.25));
  s.pasted = t >= T.paste;
  // The caret after the paste blinks (530 ms, Windows), then moves where the click lands.
  const caretSince = t >= T.caret ? T.caret : T.paste;
  s.caret = !s.pasted ? null : { at: t >= T.caret ? 'click' : 'end', on: Math.floor((t - caretSince) / 530) % 2 === 0 };

  // ——— Shortcut HUD (under the window, liked by Lucas) ———
  const hudIn = spring(t, T.hudIn, { duration: 0.4, bounce: 0 });
  const hudOut = EASE_OUT(prog(t, T.hudOut, T.hudOut + 220));
  s.hud = { o: clamp(hudIn * 1.6) * (1 - hudOut), y: reduced ? 0 : 14 * (1 - hudIn) + 6 * hudOut, scale: reduced ? 1 : 0.94 + 0.06 * clamp(hudIn, 0, 1.02) };
  s.keys = [T.key1, T.key2, T.key3].map(at => {
    const down = spring(t, at, { duration: 0.28, bounce: 0.12 });
    const up = t >= T.keysUp ? spring(t, T.keysUp, { duration: 0.4, bounce: 0 }) : 0;
    const d = clamp(down) * (1 - clamp(up));
    const flash = t >= at ? Math.max(0, 1 - (t - at) / 420) : 0;
    return { d: reduced ? 0 : d, lit: clamp(down * 1.3) * (1 - clamp(up)), flash: reduced ? 0 : flash };
  });

  // ——— The Îlot: one surface, never unmounted, from the capture to its exit ———
  const anchor = g.anchor || { x: 400, y: 300, width: 200, height: 24 };
  const strip = { right: anchor.x + anchor.width, top: anchor.y + anchor.height + PILL_GAP };  // placement.rs:14-32
  const compact = { width: g.compactW || 136, height: ilotMetrics.compactHeight };
  const grid = { ...ilotMetrics.grid };
  const work = workingPillShape('perle');
  const done = { width: g.doneW || 132, height: 28 };
  const checkOnly = { width: 44, height: 28 };
  const exitAt = T.caret + CHECK_ONLY_MS;       // countdown.limit(checkOnlyMs) at the caret's move
  s.ilotOn = t >= T.open && t < exitAt + (reduced ? reducedFadeMs : tokens.exit.ms);
  // Entrance (presence.ts:9-22): opacity, a glide of `travel` from above, the entrance scale, on
  // the enter spring; exit on the exit curve, half-way to the entrance scale.
  if (reduced) {
    const o = prog(t, T.open, T.open + reducedFadeMs) * (1 - prog(t, exitAt, exitAt + reducedFadeMs));
    s.ilot = { o, y: 0, scale: 1 };
  } else {
    const p = spring(t, T.open, tokens.enter);
    const q = curveAt(t, exitAt, tokens.exit);
    const scaleIn = tokens.fromScale + (1 - tokens.fromScale) * p;
    s.ilot = { o: clamp(p) * (1 - q), y: -tokens.travel * (1 - p), scale: lerp(scaleIn, exitScale(tokens), q) };
  }
  // Shape (MorphSurface.tsx:337-359): the first shape at once, each next one on the morph spring.
  const morph = reduced ? 'instant' : tokens.morph;
  const shapes = [
    { at: T.open, v: sizeOf(compact), how: 'instant' },
    { at: T.unfold, v: sizeOf(grid), how: morph },
    { at: T.pick, v: sizeOf(work), how: morph },
    { at: T.paste, v: sizeOf(done), how: morph },
    { at: T.caret, v: sizeOf(checkOnly), how: morph },
  ];
  s.shape = track(Math.max(t, T.open), shapes);
  // The corner: the grid opens right of the compact bubble (ilotMenuShift, the desktop's work area
  // as the room), the pill goes back to the strip's corner on the same spring, then after the paste
  // glides under the new text (surfaceMove, 420 ms) — IlotStage.tsx:194-200, 224-237, 514-526.
  const room = { left: strip.right, right: (g.W || 1280) - strip.right };
  const menuShift = ilotMenuShift(grid.width, compact.width, room) ?? 0;
  const place = g.place || { dx: 0, dy: 0 };
  const corner = [
    { at: T.open, v: { x: 0, y: 0 }, how: 'instant' },
    { at: T.unfold, v: { x: menuShift, y: 0 }, how: morph },
    { at: T.pick, v: { x: 0, y: 0 }, how: morph },
    { at: T.paste + 16, v: { x: place.dx, y: place.dy }, how: reduced ? 'instant' : surfaceMove },
  ];
  s.corner = track(Math.max(t, T.open), corner);
  s.strip = strip;
  // Contents (contentPresence): the new layer after a short wait, the old one faster, accelerating.
  const timing = contentTiming(tokens);
  const keys = [
    { key: 'compact', at: T.open },
    { key: 'grid', at: T.unfold },
    { key: 'working', at: T.pick },
    { key: 'done', at: T.paste },
    { key: 'done-check', at: T.caret },
  ];
  s.layers = [];
  keys.forEach((k, i) => {
    if (t < k.at) return;
    const next = keys[i + 1];
    let o;
    if (i === 0) o = 1;                       // AnimatePresence initial={false}: born with the surface
    else if (reduced) o = prog(t, k.at, k.at + reducedFadeMs);
    else o = curveAt(t, k.at + timing.inDelayMs, tokens.content);
    if (next && t >= next.at) {
      const out = reduced ? prog(t, next.at, next.at + reducedFadeMs) : ease(accelerate)(prog(t, next.at, next.at + timing.outMs));
      if (out >= 1) return;
      o = Math.min(o, o * (1 - out));
    }
    s.layers.push({ key: k.key, o, since: k.at });
  });
  s.shapeKey = keys.filter(k => t >= k.at).pop()?.key || 'compact';
  // Pointer states the app reacts to.
  s.askHover = t >= T.askEnter && t < T.unfold + 40;
  // The orb waits ORB_DELAY_MS, then fades in (loaders.css .working-orb).
  s.orbOn = t >= T.pick + ORB_DELAY_MS;
  s.orbSince = T.pick + ORB_DELAY_MS;
  // The check is drawn after 80 ms in 260 ms (result.css:16): s.doneSince drives it.
  s.doneSince = T.paste;
  // The countdown (countdown.ts): from the check's first frame, standing still while the pointer
  // rests on the pill (hover), limited to CHECK_ONLY_MS at the caret's move.
  const hoverFrom = T.atUndo - 90, hoverTo = T.leaveUndo + 80;
  const running = (a, b) => Math.max(0, Math.min(b, t) - a);
  const spent = running(T.paste, Math.min(hoverFrom, t)) + (t > hoverTo ? running(hoverTo, t) : 0);
  s.countdown = clamp(1 - spent / UNDO_MS);   // the ring: 1 at the start, 0 at the end
  s.rowHover = t >= hoverFrom && t < hoverTo;
  s.undoHover = t >= T.atUndo - 60 && t < T.leaveUndo + 40;
  // Grid highlight: it starts on the last action (Corriger, Ilot.tsx:110-115); the pointer moves it
  // (below, once the cursor is known).
  s.hot = 0;

  // ——— The halo (src/halo): menu → work → marks ———
  if (t >= T.open) {
    const phase = t < T.pick ? 'menu' : t < T.paste ? 'work' : 'marks';
    const since = phase === 'menu' ? T.open : phase === 'work' ? T.pick : T.paste;
    // The menu's halo shows at once (HaloWindow.tsx:84-86 mounts it already « shown »: no CSS
    // transition on a first style). The work halo leaves BEFORE the paste: Rust calls halo::leave
    // when the answer arrives (lib.rs:1082), .halo[data-state="leaving"] goes to 0 in 150 ms ease-in
    // (halo.css:5-6), then the paste and the marks.
    let o = 1;
    if (phase === 'work' && t >= T.answer) o = 1 - HALO_LEAVE(prog(t, T.answer, T.answer + HALO_FADE_MS));
    if (phase === 'marks' && t >= T.caret) o = reduced ? 0 : 1 - EASE_OUT(prog(t, T.caret, T.caret + MARKS_OUT_MS));
    s.halo = { phase, since, el: t - since, o, on: o > 0.001 };
  } else s.halo = null;
  // The changed words, as the text-glow proposals draw them (same timing as the app's marks:
  // in from 380 ms for 420 ms, out in 900 ms at the next action). 'actuel' uses halo.css itself.
  const markIn = reduced ? (t >= T.paste ? 1 : 0) : EASE_OUT(prog(t, T.paste + MARK_IN.delay, T.paste + MARK_IN.delay + MARK_IN.ms));
  const markOut = t >= T.caret ? (reduced ? 1 : EASE_OUT(prog(t, T.caret, T.caret + MARKS_OUT_MS))) : 0;
  s.glow = { o: t >= T.paste ? markIn * (1 - markOut) : 0, el: t - T.paste - MARK_IN.delay };

  // ——— The cursor ———
  const P = g.points || {};
  const home = P.home || { x: 1000, y: 700 };
  const selStart = P.selStart || { x: 300, y: 250 };
  const path = P.dragPath || [selStart, { x: 600, y: 270 }];
  const selEnd = path[path.length - 1];
  const rest = P.rest || { x: selEnd.x + 90, y: selEnd.y + 80 };
  const ask = P.ask || { x: strip.right - 14, y: strip.top + 20 };
  const tile = P.tile || { x: ask.x - 60, y: ask.y + 20 };
  const aside = P.aside || { x: tile.x + 70, y: tile.y + 70 };
  const undo = P.undo || aside;
  const caretPt = P.caret || { x: selEnd.x, y: selEnd.y + 60 };
  const out = P.out || { x: caretPt.x + 160, y: caretPt.y + 140 };
  let c; let beam = 0;    // beam: 0 arrow → 1 I-beam (over text)
  if (t < T.cursorIn) c = home;
  else if (t < T.cursorAt) { const p = prog(t, T.cursorIn, T.cursorAt); c = curve(home, selStart, minJerk(p), 0.22); beam = p > 0.8 ? 1 : 0; }
  else if (t < T.dragFrom) { c = selStart; beam = 1; }
  else if (t < T.cursorAway) { c = along(path, drag); beam = 1; }
  else if (t < T.toAsk) { const p = prog(t, T.cursorAway, T.cursorRest); c = curve(selEnd, rest, minJerk(p), -0.2); beam = p < 0.12 ? 1 : 0; }
  else if (t < T.toTile) c = curve(rest, ask, minJerk(prog(t, T.toAsk, T.atAsk)), 0.22);
  else if (t < T.away) c = curve(ask, tile, minJerk(prog(t, T.toTile, T.atTile)), -0.18);
  else if (t < T.toUndo) c = curve(tile, aside, minJerk(prog(t, T.away, T.awayAt)), 0.12);
  else if (t < T.leaveUndo) c = curve(aside, undo, minJerk(prog(t, T.toUndo, T.atUndo)), 0.2);
  else if (t < T.cursorOut) { const p = prog(t, T.leaveUndo, T.atCaret); c = curve(undo, caretPt, minJerk(p), -0.22); beam = p > 0.72 ? 1 : 0; }
  else { const p = prog(t, T.cursorOut, T.cursorGone); c = curve(caretPt, out, minJerk(p), 0.18); beam = p < 0.2 ? 1 : 0; }
  // The pointer changes shape at once over text (Windows swaps the glyph, no cross-fade).
  // Grid highlight: the tile under the pointer (ilot.css .ilot-tile:hover and Ilot.tsx:220
  // onMouseEnter, which the browser fires as soon as the grid lays out under a resting pointer); in a
  // gap between tiles, the last one entered (the nearest).
  if (t >= T.unfold && t < T.click + 200 && g.tiles) {
    let best = -1, bestD = Infinity;
    g.tiles.forEach((r, i) => {
      const dx = Math.max(r.x - c.x, 0, c.x - (r.x + r.w)), dy = Math.max(r.y - c.y, 0, c.y - (r.y + r.h));
      const d = Math.hypot(dx, dy);
      if (d < bestD) { bestD = d; best = i; }
    });
    if (bestD <= 6) s.hot = best;
  }
  const cin = EASE_OUT(prog(t, T.cursorIn - 250, T.cursorIn + 150));
  const cout = EASE_OUT(prog(t, T.cursorGone - 350, T.cursorGone));
  const down = (t >= T.press && t < T.release) || (t >= T.click && t < T.clickUp) || (t >= T.caret && t < T.caret + 110);
  const downAt = t >= T.caret ? T.caret : t >= T.click ? T.click : T.press;
  const upAt = t >= T.caret + 110 ? T.caret + 110 : t >= T.clickUp ? T.clickUp : T.release;
  const press = down ? clamp(spring(t, downAt, { duration: 0.2, bounce: 0 })) : 1 - clamp(spring(t, upAt, { duration: 0.3, bounce: 0 }));
  s.cursor = { x: c.x, y: c.y, o: cin * (1 - cout), beam, press: t < T.press ? 0 : clamp(press) };

  // ——— The end card ———
  const end = reduced ? prog(t, T.end, T.end + 200) : spring(t, T.end, { duration: 0.4, bounce: 0 });
  s.end = { o: clamp(end * 1.4), y: reduced ? 0 : 10 * (1 - clamp(end)), scale: reduced ? 1 : 0.97 + 0.03 * clamp(end, 0, 1.01), on: t >= T.end };
  s.chapter = chapterAt(t);
  return s;
}

const sizeOf = ({ width, height }) => ({ w: width, h: height, r: surfaceRadius(height) });

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
