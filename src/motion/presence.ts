import {
  contentTiming,
  curveTransition,
  exitScale,
  reducedFade,
  springTransition,
  accelerate,
  type MotionTokens,
} from './tokens';

// Which way a surface opens: 'down' glides in from above, 'up' from below (Surface.jsx:46).
export type Grow = 'down' | 'up';

// A surface appears with the enter spring (opacity, a few pixels of glide and a slight scale)
// and leaves on the exit curve, half-way to its entrance scale (Surface.jsx:34-48). Reduced
// motion keeps a short opacity fade and nothing that moves (motion.js:215-220).
export function surfacePresence(tokens: MotionTokens, reduced: boolean, grow: Grow = 'down', delayMs = 0) {
  if (reduced)
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: reducedFade },
      exit: { opacity: 0, transition: reducedFade },
    };
  const y = grow === 'up' ? tokens.travel : -tokens.travel;
  return {
    initial: { opacity: 0, y, scale: tokens.fromScale },
    animate: { opacity: 1, y: 0, scale: 1, transition: springTransition(tokens.enter, delayMs) },
    exit: { opacity: 0, scale: exitScale(tokens), transition: curveTransition(tokens.exit) },
  };
}

// Content swapped inside a surface cross-fades: the new content after a short wait, the old
// one faster and accelerating away (Surface.jsx:61, 120).
export function contentPresence(tokens: MotionTokens, reduced: boolean) {
  if (reduced)
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: reducedFade },
      exit: { opacity: 0, transition: reducedFade },
    };
  const timing = contentTiming(tokens);
  return {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: curveTransition(tokens.content, timing.inDelayMs) },
    exit: { opacity: 0, transition: curveTransition({ ms: timing.outMs, ease: accelerate }) },
  };
}

// A state change that moves something in place (a switch thumb): the morph spring, or nothing
// under reduced motion.
export function stateTransition(tokens: MotionTokens, reduced: boolean) {
  return reduced ? { duration: 0 } : springTransition(tokens.morph);
}
