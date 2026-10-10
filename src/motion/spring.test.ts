import { describe, expect, it } from 'vitest';
import {
  fromAppleDurationBounce,
  fromDampingRatio,
  fromMotionVisualDuration,
  fromResponse,
  springSolver,
  springToLinear,
  toAppleDurationBounce,
  toMotionSpring,
} from './spring';

const presets = [
  { name: 'smooth enter', duration: 0.4, bounce: 0 },
  { name: 'smooth morph', duration: 0.45, bounce: 0 },
  { name: 'bouncy enter', duration: 0.4, bounce: 0.3 },
  { name: 'bouncy morph', duration: 0.45, bounce: 0.3 },
];

describe('Apple springs in Motion', () => {
  it('converts an Apple duration and bounce to visualDuration = d / 1.2 and the same bounce, both always passed', () => {
    expect(toMotionSpring({ duration: 0.4, bounce: 0 })).toEqual({
      type: 'spring',
      visualDuration: 0.4 / 1.2,
      bounce: 0,
    });
    expect(toMotionSpring({ duration: 0.45, bounce: 0.3 })).toEqual({
      type: 'spring',
      visualDuration: 0.45 / 1.2,
      bounce: 0.3,
    });
    expect(toMotionSpring({ duration: 0.4, bounce: 0 }).visualDuration).toBeCloseTo(0.333, 3);
    expect(toMotionSpring({ duration: 0.45, bounce: 0 }).visualDuration).toBeCloseTo(0.375, 3);
    for (const spring of presets.map(toMotionSpring))
      expect(Object.keys(spring).sort()).toEqual(['bounce', 'type', 'visualDuration']);
  });

  it.each(presets)(
    'gives Motion the same stiffness and damping as the Apple spring ($name)',
    ({ duration, bounce }) => {
      const apple = fromAppleDurationBounce(duration, bounce);
      const motion = fromMotionVisualDuration(duration / 1.2, bounce);
      expect(motion.mass).toBe(apple.mass);
      expect(motion.stiffness).toBeCloseTo(apple.stiffness, 9);
      expect(motion.damping).toBeCloseTo(apple.damping, 9);
    },
  );

  it('refuses the bounces Motion cannot express instead of changing them', () => {
    expect(() => toMotionSpring({ duration: 0.4, bounce: -0.2 })).toThrow(RangeError);
    expect(() => toMotionSpring({ duration: 0.4, bounce: 0.99 })).toThrow(RangeError);
  });

  it('reads the Apple physics back (duration 2π/ω₀, bounce 1 − ζ), overdamped springs included', () => {
    for (const { duration, bounce } of [...presets, { duration: 0.5, bounce: -0.4 }]) {
      const back = toAppleDurationBounce(fromAppleDurationBounce(duration, bounce));
      expect(back.duration).toBeCloseTo(duration, 9);
      expect(back.bounce).toBeCloseTo(bounce, 9);
    }
    // The other notations of the lab land on the same physics.
    const smooth = fromAppleDurationBounce(0.4, 0);
    expect(fromResponse(0.4, 1).damping).toBeCloseTo(smooth.damping, 9);
    expect(fromDampingRatio(1, smooth.stiffness).damping).toBeCloseTo(smooth.damping, 9);
  });
});

describe('springs as CSS linear()', () => {
  // Settle times of the lab's own springToLinear (design-lab/src/spring.js:94-106 with its
  // defaults, recomputed from that source): what a CSS spring lasts, not what it is perceived as.
  it.each([
    [0.4, 0, 613],
    [0.45, 0, 680],
    [0.4, 0.3, 700],
    [0.45, 0.3, 775],
  ])('settles a %s s spring with bounce %s in %s ms', (duration, bounce, ms) => {
    expect(springToLinear(fromAppleDurationBounce(duration, bounce)).duration).toBe(ms);
  });

  it.each(presets)('writes a valid linear() easing from 0 to 1 ($name)', ({ duration, bounce }) => {
    const { easing, points } = springToLinear(fromAppleDurationBounce(duration, bounce));
    expect(easing).toMatch(/^linear\(.*\)$/);
    const stops = easing.slice('linear('.length, -1).split(', ');
    expect(stops).toHaveLength(points);
    expect(stops[0]).toBe('0');
    expect(stops.at(-1)).toBe('1');
    let last = 0;
    for (const stop of stops.slice(1, -1)) {
      const match = /^(-?\d+(?:\.\d+)?) (\d+(?:\.\d+)?)%$/.exec(stop);
      expect(match, stop).not.toBeNull();
      const at = Number(match![2]);
      expect(at).toBeGreaterThan(last);
      expect(at).toBeLessThan(100);
      last = at;
    }
    if (typeof CSS !== 'undefined' && CSS.supports)
      expect(CSS.supports('transition-timing-function', easing)).toBe(true);
  });

  it('overshoots only with a bounce', () => {
    const peak = (easing: string) =>
      Math.max(
        ...easing
          .slice(7, -1)
          .split(', ')
          .map((stop) => Number(stop.split(' ')[0])),
      );
    expect(peak(springToLinear(fromAppleDurationBounce(0.4, 0)).easing)).toBe(1);
    expect(peak(springToLinear(fromAppleDurationBounce(0.4, 0.3)).easing)).toBeGreaterThan(1.04);
  });

  it('starts at rest and reaches the target', () => {
    for (const { duration, bounce } of presets) {
      const solver = springSolver(fromAppleDurationBounce(duration, bounce));
      expect(solver.pos(0)).toBe(0);
      expect(solver.vel(0)).toBeCloseTo(0, 9);
      expect(solver.pos(2)).toBeCloseTo(1, 4);
    }
  });
});
