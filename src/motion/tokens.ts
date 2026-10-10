import type { MotionPreset } from '../types';
import { toMotionSpring, type AppleSpring, type MotionSpring } from './spring';

// Motion tokens of the « Îlot » art direction. The design lab is the reference:
// design-lab/src/data.js:80-81 (MOTION_PRESETS 'apple-smooth' and 'apple-bouncy'),
// motion.js:130 (emil-out), Surface.jsx (exit scale, content cross-fade), app.css:149 (move).

export type CubicBezier = readonly [number, number, number, number];
export type Curve = { ms: number; ease: CubicBezier };
// A spring written for CSS: its settle time and a linear() easing. Generated from the spring
// with springToLinear (the lab's defaults) and checked against it by tokens.test.ts, so
// nothing is sampled at run time.
export type CssSpring = { ms: number; easing: string };

export type MotionTokens = {
  enter: AppleSpring; // a surface appears (menu, pill)
  morph: AppleSpring; // a surface changes shape (menu → pill, the glass opening)
  exit: Curve; // a surface leaves: opacity and a half-way scale
  content: Curve; // content swapped inside a surface (cross-fade)
  fromScale: number; // entrance scale
  travel: number; // entrance glide, px
  stagger: number; // between siblings, ms
  css: { enter: CssSpring; morph: CssSpring };
};

// « Sortie douce » (Emil Kowalski), motion.js:130.
export const emilOut: CubicBezier = [0.23, 1, 0.32, 1];
// The leaving content accelerates away (Surface.jsx:120).
export const accelerate: CubicBezier = [0.4, 0, 1, 1];
// Reduced motion keeps short opacity fades only (motion.js:215-220: 120 ms, linear); the plan
// allows 150 ms at most.
export const reducedFadeMs = 120;
// Moving a surface (a pill repositioned after the replacement) is a CSS transition in the lab,
// not the morph spring (app.css:149).
export const surfaceMove: Curve = { ms: 420, ease: emilOut };

export const motionPresets: Record<MotionPreset, MotionTokens> = {
  // Apple « smooth »: no bounce, a very soft arrival (data.js:80).
  smooth: {
    enter: { duration: 0.4, bounce: 0 },
    morph: { duration: 0.45, bounce: 0 },
    exit: { ms: 170, ease: emilOut },
    content: { ms: 200, ease: emilOut },
    fromScale: 0.97,
    travel: 4,
    stagger: 22,
    css: {
      enter: {
        ms: 613,
        easing:
          'linear(0, 0.0019 0.65%, 0.0072 1.3%, 0.0265 2.6%, 0.055 3.9%, 0.0903 5.19%, 0.1303 6.49%, 0.1735 7.79%, 0.3555 12.99%, 0.4631 16.23%, 0.5223 18.18%, 0.5593 19.48%, 0.5942 20.78%, 0.6426 22.73%, 0.6722 24.03%, 0.7129 25.97%, 0.7712 29.22%, 0.8189 32.47%, 0.8643 36.36%, 0.8828 38.31%, 0.9039 40.91%, 0.9324 45.45%, 0.9552 50.65%, 0.9735 57.14%, 0.9853 64.29%, 0.9927 72.73%, 1)',
      },
      morph: {
        ms: 680,
        easing:
          'linear(0, 0.0057 1.17%, 0.0213 2.34%, 0.0446 3.51%, 0.0738 4.68%, 0.1074 5.85%, 0.1634 7.6%, 0.365 13.45%, 0.4603 16.37%, 0.5133 18.13%, 0.5628 19.88%, 0.6369 22.81%, 0.7008 25.73%, 0.7345 27.49%, 0.7648 29.24%, 0.8166 32.75%, 0.8384 34.5%, 0.8639 36.84%, 0.8856 39.18%, 0.9041 41.52%, 0.933 46.2%, 0.9556 51.46%, 0.9734 57.89%, 0.9849 64.91%, 0.9923 73.1%, 1)',
      },
    },
  },
  // Apple « bouncy »: a visible bounce, and every other value of the lab preset too (data.js:81).
  bouncy: {
    enter: { duration: 0.4, bounce: 0.3 },
    morph: { duration: 0.45, bounce: 0.3 },
    exit: { ms: 150, ease: emilOut },
    content: { ms: 180, ease: emilOut },
    fromScale: 0.94,
    travel: 6,
    stagger: 24,
    css: {
      enter: {
        ms: 700,
        easing:
          'linear(0, 0.0019 0.57%, 0.0074 1.14%, 0.0277 2.27%, 0.0588 3.41%, 0.0776 3.98%, 0.1206 5.11%, 0.1693 6.25%, 0.222 7.39%, 0.4763 12.5%, 0.5837 14.77%, 0.6578 16.48%, 0.7037 17.61%, 0.7464 18.75%, 0.7859 19.89%, 0.8221 21.02%, 0.8551 22.16%, 0.8848 23.3%, 0.9236 25%, 0.9457 26.14%, 0.9738 27.84%, 0.9894 28.98%, 1.0083 30.68%, 1.0265 32.95%, 1.0379 35.23%, 1.044 37.5%, 1.046 40.34%, 1.0409 44.89%, 1.0111 59.09%, 1.0018 67.05%, 0.9979 78.41%, 1)',
      },
      morph: {
        ms: 775,
        easing:
          'linear(0, 0.0059 1.03%, 0.0129 1.55%, 0.0341 2.58%, 0.0633 3.61%, 0.1189 5.15%, 0.162 6.19%, 0.2327 7.73%, 0.4603 12.37%, 0.5809 14.95%, 0.6476 16.49%, 0.6892 17.53%, 0.7471 19.07%, 0.7825 20.1%, 0.8152 21.13%, 0.8595 22.68%, 0.8858 23.71%, 0.9206 25.26%, 0.9408 26.29%, 0.967 27.84%, 0.9886 29.38%, 1.0059 30.93%, 1.0232 32.99%, 1.0371 35.57%, 1.0441 38.14%, 1.046 40.72%, 1.0404 45.88%, 1.0115 59.79%, 1.0022 67.53%, 0.998 78.87%, 1)',
      },
    },
  },
};

export function motionTokens(preset: MotionPreset | undefined): MotionTokens {
  return motionPresets[preset ?? 'smooth'] ?? motionPresets.smooth;
}

// Motion transitions. A spring always carries visualDuration and bounce together.
export function springTransition(spring: AppleSpring, delayMs = 0): MotionSpring & { delay?: number } {
  return delayMs ? { ...toMotionSpring(spring), delay: delayMs / 1000 } : toMotionSpring(spring);
}
export function curveTransition({ ms, ease }: Curve, delayMs = 0) {
  return { duration: ms / 1000, ease: [...ease] as [number, number, number, number], delay: delayMs / 1000 };
}
export const reducedFade = { duration: reducedFadeMs / 1000, ease: 'linear' as const, delay: 0 };

// A surface leaves half-way to its entrance scale (Surface.jsx:34).
export function exitScale(tokens: MotionTokens): number {
  return tokens.fromScale + (1 - tokens.fromScale) / 2;
}
// Content cross-fade: the new content waits min(90 ms, content / 2) (Surface.jsx:61), the old
// one fades in 0.6 × content (Surface.jsx:120).
export function contentTiming(tokens: MotionTokens) {
  return { inDelayMs: Math.min(90, tokens.content.ms / 2), outMs: Math.max(1, Math.round(tokens.content.ms * 0.6)) };
}

const css = (curve: Curve) => `${curve.ms}ms`;
const bezier = (ease: CubicBezier) => `cubic-bezier(${ease.join(',')})`;
// The preset as CSS custom properties on <html>, for the animations Motion does not drive
// (the glass opening, the reader band, the text reveal).
export function motionCssVariables(tokens: MotionTokens): Record<string, string> {
  return {
    '--motion-enter-ms': `${tokens.css.enter.ms}ms`,
    '--motion-enter-ease': tokens.css.enter.easing,
    '--motion-morph-ms': `${tokens.css.morph.ms}ms`,
    '--motion-morph-ease': tokens.css.morph.easing,
    '--motion-exit-ms': css(tokens.exit),
    '--motion-exit-ease': bezier(tokens.exit.ease),
    '--motion-content-ms': css(tokens.content),
    '--motion-content-ease': bezier(tokens.content.ease),
    '--motion-content-delay': `${contentTiming(tokens).inDelayMs}ms`,
    '--motion-from-scale': String(tokens.fromScale),
    '--motion-travel': `${tokens.travel}px`,
  };
}

export function applyMotionPreset(
  preset: MotionPreset | undefined,
  root: HTMLElement = document.documentElement,
): void {
  root.dataset.motionPreset = preset ?? 'smooth';
  for (const [name, value] of Object.entries(motionCssVariables(motionTokens(preset))))
    root.style.setProperty(name, value);
}
