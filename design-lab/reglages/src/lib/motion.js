// Motion helpers aware of the lab clock (speed and reduced motion).
//
// Three kinds of animation, three ways to follow the lab « Vitesse » (1×, ½×, ¼×, ⅒×):
//   1. CSS transitions and @keyframes: nothing to do. The lab sets playbackRate on every
//      CSSTransition / CSSAnimation of the page (see applyRate below).
//   2. motion (motion/react): pass transitions through tx() / useTx(): durations are multiplied.
//        <motion.div animate={{ opacity: 1 }} transition={tx('smooth')} />
//   3. Timers and Web Animations you write: wait(ms) and animate(node, frames, opts).
// Reduced motion: <MotionConfig reducedMotion="always"> is set by the lab when the switch is on
// (motion then skips transform/layout animation), and CSS gets data-ft-reduced="true".
import { useSyncExternalStore } from 'react';
import { fromAppleDurationBounce, springToLinear } from './spring.js';

export const clock = { t: 1, reduced: false };
const listeners = new Set();
let version = 0;
export function onClock(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function setClock(patch) {
  const next = { ...clock, ...patch };
  if (next.t === clock.t && next.reduced === clock.reduced) return;
  Object.assign(clock, next);
  version++;
  applyRate();
  listeners.forEach(fn => fn(clock));
}
export function useClock() {
  useSyncExternalStore(onClock, () => version, () => version);
  return clock;
}

// ——— 1. CSS: slow every CSS transition / animation of the page by the lab speed ———
const isCss = a => (typeof CSSTransition !== 'undefined' && a instanceof CSSTransition) || (typeof CSSAnimation !== 'undefined' && a instanceof CSSAnimation);
export function applyRate() {
  if (typeof document === 'undefined' || !document.getAnimations) return;
  const rate = 1 / clock.t;
  for (const a of document.getAnimations()) if (isCss(a) && a.playbackRate !== rate) a.playbackRate = rate;
}
if (typeof document !== 'undefined') {
  const now = () => applyRate();
  for (const type of ['transitionrun', 'animationstart']) document.addEventListener(type, now, true);
  setInterval(now, 100);
}

// ——— 2. motion ———
// Apple springs (SwiftUI names), as motion's duration/bounce springs.
export const SPRINGS = {
  smooth: { duration: 0.4, bounce: 0 },        // Apple .smooth — Lucas's choice for the Îlot
  bouncy: { duration: 0.4, bounce: 0.3 },      // Apple .bouncy
  snappy: { duration: 0.28, bounce: 0.12 },    // Apple .snappy
  gentle: { duration: 0.6, bounce: 0 },        // slow, calm entrances
  window: { duration: 0.42, bounce: 0.08 },    // a window opening
};
export const CURVES = {
  out: [0.23, 1, 0.32, 1],           // Emil « ease-out » (exits, fades)
  inOut: [0.65, 0, 0.35, 1],
  fluent: [0, 0, 0, 1],              // Windows 11 « Fast In »
  linear: [0, 0, 1, 1],
};

// tx('smooth') · tx('bouncy', { delay: .1 }) · tx({ duration: .2, ease: 'out' }) · tx(0.2)
export function tx(spec = 'smooth', extra = {}) {
  const k = clock.t;
  let base;
  if (typeof spec === 'number') base = { type: 'tween', duration: spec, ease: CURVES.out };
  else if (typeof spec === 'string') base = SPRINGS[spec] ? { type: 'spring', ...SPRINGS[spec] } : { type: 'tween', duration: 0.2, ease: CURVES[spec] || CURVES.out };
  else base = { ...spec };
  if (typeof base.ease === 'string' && CURVES[base.ease]) base.ease = CURVES[base.ease];
  const out = { ...base, ...extra };
  if (typeof out.ease === 'string' && CURVES[out.ease]) out.ease = CURVES[out.ease];
  if (out.duration != null) out.duration *= k;
  if (out.visualDuration != null) out.visualDuration *= k;
  if (out.delay != null) out.delay *= k;
  if (out.type === 'spring' && out.duration == null && out.stiffness != null) { // physical spring: slow time by k
    out.stiffness = out.stiffness / (k * k);
    if (out.damping != null) out.damping = out.damping / k;
  }
  return out;
}
// Same, re-rendering the component when the speed changes.
export function useTx() { useClock(); return tx; }

// ——— 3. Timers and Web Animations ———
export const ms = n => n * clock.t;
export function wait(duration, signal) {
  return new Promise(resolve => {
    if (signal?.aborted) return resolve(false);
    const id = setTimeout(() => resolve(true), duration * clock.t);
    signal?.addEventListener('abort', () => { clearTimeout(id); resolve(false); }, { once: true });
  });
}
// A spring as a CSS linear() easing: { easing, duration (ms) } — for CSS or node.animate().
const springCache = new Map();
export function springCss(name = 'smooth') {
  const s = typeof name === 'string' ? SPRINGS[name] : name;
  const key = `${s.duration}|${s.bounce}`;
  if (!springCache.has(key)) springCache.set(key, springToLinear(fromAppleDurationBounce(s.duration, s.bounce)));
  return springCache.get(key);
}
// Web Animations with the lab clock. Under reduced motion only opacity survives (120 ms).
export function animate(node, frames, { spring, force, ...options } = {}) {
  if (!node) return Promise.resolve(null);
  let opts = { fill: 'both', easing: 'cubic-bezier(.23,1,.32,1)', duration: 200, ...options };
  if (spring) { const s = springCss(spring); opts = { ...opts, easing: s.easing, duration: s.duration }; }
  if (clock.reduced && !force) {
    const only = frames.map(f => ('opacity' in f ? { opacity: f.opacity } : {}));
    const has = only.some(f => 'opacity' in f);
    frames = has ? only : [frames[frames.length - 1], frames[frames.length - 1]];
    opts = { ...opts, duration: has ? 120 : 1, easing: 'linear', delay: 0 };
  }
  const a = node.animate(frames, opts);
  a.playbackRate = 1 / clock.t;
  return a.finished.then(() => a, () => a);
}
