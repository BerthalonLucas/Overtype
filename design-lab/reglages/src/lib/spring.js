// ---- parameter conversions (mass = 1 unless given) ----
const TAU = 2 * Math.PI;
/** Apple SwiftUI Spring(duration:bounce:) -> physics (mass 1) */
export function fromAppleDurationBounce(duration = 0.5, bounce = 0) {
  const stiffness = (TAU / duration) ** 2;
  const damping = bounce >= 0
    ? (1 - bounce) * 4 * Math.PI / duration
    : 4 * Math.PI / (duration * (1 + bounce));
  return { stiffness, damping, mass: 1 };
}
/** SwiftUI .spring(response:dampingFraction:) / Spring(response:dampingRatio:) */
export function fromResponse(response = 0.5, dampingFraction = 0.825, mass = 1) {
  const stiffness = (TAU / response) ** 2 * mass;
  const damping = dampingFraction * 2 * Math.sqrt(stiffness * mass); // = 4π·ζ·m/response
  return { stiffness, damping, mass };
}
/** Motion `visualDuration` + `bounce` (same formula as motion-dom getSpringOptions) */
export function fromMotionVisualDuration(visualDuration = 0.3, bounce = 0.3) {
  const root = TAU / (visualDuration * 1.2);
  const stiffness = root * root;
  const zeta = Math.min(1, Math.max(0.05, 1 - bounce));
  return { stiffness, damping: 2 * zeta * Math.sqrt(stiffness), mass: 1 };
}
/** Compose / Material 3 spring(dampingRatio, stiffness) — Compose uses mass 1 */
export function fromDampingRatio(dampingRatio, stiffness, mass = 1) {
  return { stiffness, damping: dampingRatio * 2 * Math.sqrt(stiffness * mass), mass };
}
/** physics -> Apple (duration, bounce) for display */
export function toAppleDurationBounce({ stiffness, damping, mass = 1 }) {
  const duration = TAU / Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const bounce = zeta <= 1 ? 1 - zeta : 1 / zeta - 1; // inverse of the two damping formulas
  return { duration, bounce, zeta };
}

// ---- closed-form damped harmonic oscillator, x(0)=0 -> target 1 ----
// v0 in "progress units per second" (0 for a fresh animation).
export function springSolver({ stiffness, damping, mass = 1, velocity = 0 }) {
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const x0 = -1;            // displacement from target at t=0
  const v0 = velocity;
  let pos, vel;
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    const A = x0, B = (v0 + zeta * w0 * x0) / wd;
    pos = t => { const e = Math.exp(-zeta * w0 * t); return 1 + e * (A * Math.cos(wd * t) + B * Math.sin(wd * t)); };
    vel = t => { const e = Math.exp(-zeta * w0 * t);
      return e * ((B * wd - zeta * w0 * A) * Math.cos(wd * t) - (A * wd + zeta * w0 * B) * Math.sin(wd * t)); };
  } else if (zeta === 1) {
    const A = x0, B = v0 + w0 * x0;
    pos = t => 1 + (A + B * t) * Math.exp(-w0 * t);
    vel = t => (B - w0 * (A + B * t)) * Math.exp(-w0 * t);
  } else {
    const s = w0 * Math.sqrt(zeta * zeta - 1);
    const r1 = -zeta * w0 + s, r2 = -zeta * w0 - s;
    const C2 = (v0 - r1 * x0) / (r2 - r1), C1 = x0 - C2;
    pos = t => 1 + C1 * Math.exp(r1 * t) + C2 * Math.exp(r2 * t);
    vel = t => C1 * r1 * Math.exp(r1 * t) + C2 * r2 * Math.exp(r2 * t);
  }
  return { pos, vel, zeta, w0 };
}

/** Settle time (s): last instant where |x-1| > restDelta or |v| > restSpeed. */
export function settleTime(solver, { restDelta = 0.001, restSpeed = 0.01, step = 1 / 1000, max = 10 } = {}) {
  let last = 0;
  for (let t = 0; t <= max; t += step) {
    if (Math.abs(solver.pos(t) - 1) > restDelta || Math.abs(solver.vel(t)) > restSpeed) last = t;
  }
  return Math.min(max, last + step);
}

/** Ramer–Douglas–Peucker on [t,x] points (keeps first/last). */
function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  let idx = -1, dmax = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    // vertical distance (what matters for an easing) to the chord a-b
    const p = pts[i];
    const y = a[1] + (b[1] - a[1]) * (p[0] - a[0]) / (b[0] - a[0]);
    const d = Math.abs(p[1] - y);
    if (d > dmax) { dmax = d; idx = i; }
  }
  if (dmax <= eps) return [a, b];
  return rdp(pts.slice(0, idx + 1), eps).slice(0, -1).concat(rdp(pts.slice(idx), eps));
}

/**
 * Spring -> { duration (ms), easing: "linear(...)" }.
 * Samples every `sampleMs` ms over the settle time, then (optionally) simplifies with RDP.
 * tolerance 0 => uniform stops (Motion-style, no % positions).
 */
export function springToLinear(params, { sampleMs = 4, tolerance = 0.0015, restDelta = 0.001, restSpeed = 0.01, decimals = 4 } = {}) {
  const solver = springSolver(params);
  const T = settleTime(solver, { restDelta, restSpeed });
  const n = Math.max(2, Math.ceil((T * 1000) / sampleMs) + 1);
  let pts = Array.from({ length: n }, (_, i) => { const p = i / (n - 1); return [p, i === n - 1 ? 1 : solver.pos(p * T)]; });
  const f = v => +v.toFixed(decimals);
  let stops;
  if (tolerance > 0) {
    pts = rdp(pts, tolerance);
    stops = pts.map(([p, x], i) => (i === 0 || i === pts.length - 1) ? `${f(x)}` : `${f(x)} ${+(p * 100).toFixed(2)}%`);
  } else stops = pts.map(([, x]) => `${f(x)}`);
  return { duration: Math.round(T * 1000), easing: `linear(${stops.join(', ')})`, points: stops.length, zeta: solver.zeta };
}
