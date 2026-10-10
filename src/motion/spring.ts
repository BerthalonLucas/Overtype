// Springs, ported from the design lab (design-lab/src/spring.js, the reference) without its
// page clock: parameter conversions, the closed-form damped oscillator, the settle time and a
// CSS linear() easing for animations Motion does not drive.

export type SpringPhysics = { stiffness: number; damping: number; mass: number };
// SwiftUI Spring(duration:bounce:): duration in seconds, bounce in −1…1.
export type AppleSpring = { duration: number; bounce: number };
// What Motion is given. Motion reads `visualDuration` only when `bounce` is passed too
// (otherwise its stiffness 100 / damping 10 default applies), so both are always present.
export type MotionSpring = { type: 'spring'; visualDuration: number; bounce: number };

const TAU = 2 * Math.PI;

/** Apple Spring(duration:bounce:) → physics, mass 1 (spring.js:4-10). */
export function fromAppleDurationBounce(duration = 0.5, bounce = 0): SpringPhysics {
  const stiffness = (TAU / duration) ** 2;
  const damping = bounce >= 0 ? ((1 - bounce) * 4 * Math.PI) / duration : (4 * Math.PI) / (duration * (1 + bounce));
  return { stiffness, damping, mass: 1 };
}

/** SwiftUI .spring(response:dampingFraction:) (spring.js:12-16). */
export function fromResponse(response = 0.5, dampingFraction = 0.825, mass = 1): SpringPhysics {
  const stiffness = (TAU / response) ** 2 * mass;
  return { stiffness, damping: dampingFraction * 2 * Math.sqrt(stiffness * mass), mass };
}

/** Motion `visualDuration` + `bounce`, the formula of motion-dom getSpringOptions (spring.js:18-23). */
export function fromMotionVisualDuration(visualDuration = 0.3, bounce = 0.3): SpringPhysics {
  const root = TAU / (visualDuration * 1.2);
  const stiffness = root * root;
  const zeta = Math.min(1, Math.max(0.05, 1 - bounce));
  return { stiffness, damping: 2 * zeta * Math.sqrt(stiffness), mass: 1 };
}

/** Compose / Material 3 spring(dampingRatio, stiffness) (spring.js:25-27). */
export function fromDampingRatio(dampingRatio: number, stiffness: number, mass = 1): SpringPhysics {
  return { stiffness, damping: dampingRatio * 2 * Math.sqrt(stiffness * mass), mass };
}

/** Physics → Apple duration and bounce, for display (spring.js:29-34). */
export function toAppleDurationBounce({ stiffness, damping, mass = 1 }: SpringPhysics) {
  const duration = TAU / Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const bounce = zeta <= 1 ? 1 - zeta : 1 / zeta - 1;
  return { duration, bounce, zeta };
}

/**
 * Apple (d, b) → Motion: same stiffness, same damping with visualDuration = d / 1.2 and the same
 * bounce (plan §9). Motion clamps its damping ratio to 0.05…1, so an overdamped Apple spring
 * (b < 0) has no Motion equivalent: it is refused rather than silently changed.
 */
export function toMotionSpring({ duration, bounce }: AppleSpring): MotionSpring {
  if (bounce < 0 || bounce > 0.95) throw new RangeError('Motion expresses bounces from 0 to 0.95 only');
  return { type: 'spring', visualDuration: duration / 1.2, bounce };
}

export type SpringSolver = { pos: (t: number) => number; vel: (t: number) => number; zeta: number; w0: number };

/** Closed-form damped oscillator from 0 to 1, time in seconds (spring.js:38-62). */
export function springSolver({
  stiffness,
  damping,
  mass = 1,
  velocity = 0,
}: SpringPhysics & { velocity?: number }): SpringSolver {
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const x0 = -1;
  const v0 = velocity;
  let pos: (t: number) => number;
  let vel: (t: number) => number;
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    const A = x0,
      B = (v0 + zeta * w0 * x0) / wd;
    pos = (t) => {
      const e = Math.exp(-zeta * w0 * t);
      return 1 + e * (A * Math.cos(wd * t) + B * Math.sin(wd * t));
    };
    vel = (t) => {
      const e = Math.exp(-zeta * w0 * t);
      return e * ((B * wd - zeta * w0 * A) * Math.cos(wd * t) - (A * wd + zeta * w0 * B) * Math.sin(wd * t));
    };
  } else if (zeta === 1) {
    const A = x0,
      B = v0 + w0 * x0;
    pos = (t) => 1 + (A + B * t) * Math.exp(-w0 * t);
    vel = (t) => (B - w0 * (A + B * t)) * Math.exp(-w0 * t);
  } else {
    const s = w0 * Math.sqrt(zeta * zeta - 1);
    const r1 = -zeta * w0 + s,
      r2 = -zeta * w0 - s;
    const C2 = (v0 - r1 * x0) / (r2 - r1),
      C1 = x0 - C2;
    pos = (t) => 1 + C1 * Math.exp(r1 * t) + C2 * Math.exp(r2 * t);
    vel = (t) => C1 * r1 * Math.exp(r1 * t) + C2 * r2 * Math.exp(r2 * t);
  }
  return { pos, vel, zeta, w0 };
}

/** Settle time in seconds: the last instant where |x − 1| > restDelta or |v| > restSpeed (spring.js:65-71). */
export function settleTime(
  solver: SpringSolver,
  { restDelta = 0.001, restSpeed = 0.01, step = 1 / 1000, max = 10 } = {},
): number {
  let last = 0;
  for (let t = 0; t <= max; t += step) {
    if (Math.abs(solver.pos(t) - 1) > restDelta || Math.abs(solver.vel(t)) > restSpeed) last = t;
  }
  return Math.min(max, last + step);
}

type Point = [number, number];
// Ramer–Douglas–Peucker on [t, x] points, first and last kept (spring.js:74-87).
function rdp(points: Point[], epsilon: number): Point[] {
  if (points.length < 3) return points;
  const a = points[0],
    b = points[points.length - 1];
  let index = -1,
    dmax = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const y = a[1] + ((b[1] - a[1]) * (p[0] - a[0])) / (b[0] - a[0]);
    const d = Math.abs(p[1] - y);
    if (d > dmax) {
      dmax = d;
      index = i;
    }
  }
  if (dmax <= epsilon) return [a, b];
  return rdp(points.slice(0, index + 1), epsilon)
    .slice(0, -1)
    .concat(rdp(points.slice(index), epsilon));
}

export type LinearEasing = { duration: number; easing: string; points: number; zeta: number };

/**
 * Spring → { duration (ms, the settle time, not the perceived one), easing: 'linear(...)' }
 * (spring.js:94-106). Samples every `sampleMs` over the settle time, then simplifies with RDP;
 * tolerance 0 keeps uniform stops.
 */
export function springToLinear(
  params: SpringPhysics & { velocity?: number },
  { sampleMs = 4, tolerance = 0.0015, restDelta = 0.001, restSpeed = 0.01, decimals = 4 } = {},
): LinearEasing {
  const solver = springSolver(params);
  const T = settleTime(solver, { restDelta, restSpeed });
  const n = Math.max(2, Math.ceil((T * 1000) / sampleMs) + 1);
  let points: Point[] = Array.from({ length: n }, (_, i) => {
    const p = i / (n - 1);
    return [p, i === n - 1 ? 1 : solver.pos(p * T)];
  });
  const f = (v: number) => +v.toFixed(decimals);
  let stops: string[];
  if (tolerance > 0) {
    points = rdp(points, tolerance);
    stops = points.map(([p, x], i) =>
      i === 0 || i === points.length - 1 ? `${f(x)}` : `${f(x)} ${+(p * 100).toFixed(2)}%`,
    );
  } else stops = points.map(([, x]) => `${f(x)}`);
  return {
    duration: Math.round(T * 1000),
    easing: `linear(${stops.join(', ')})`,
    points: stops.length,
    zeta: solver.zeta,
  };
}
