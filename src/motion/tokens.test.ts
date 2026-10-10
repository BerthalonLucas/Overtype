import { describe, expect, it } from 'vitest';
import { fromAppleDurationBounce, springToLinear } from './spring';
import {
  applyMotionPreset,
  contentTiming,
  exitScale,
  motionCssVariables,
  motionPresets,
  motionTokens,
  reducedFadeMs,
  springTransition,
} from './tokens';
import { contentPresence, stateTransition, surfacePresence } from './presence';

describe('motion presets (design-lab/src/data.js:80-81)', () => {
  it('keeps every value of the lab presets, not only the bounce', () => {
    const { css: _smoothCss, ...smooth } = motionPresets.smooth;
    const { css: _bouncyCss, ...bouncy } = motionPresets.bouncy;
    const emil = [0.23, 1, 0.32, 1];
    expect(smooth).toEqual({
      enter: { duration: 0.4, bounce: 0 },
      morph: { duration: 0.45, bounce: 0 },
      exit: { ms: 170, ease: emil },
      content: { ms: 200, ease: emil },
      fromScale: 0.97,
      travel: 4,
      stagger: 22,
    });
    expect(bouncy).toEqual({
      enter: { duration: 0.4, bounce: 0.3 },
      morph: { duration: 0.45, bounce: 0.3 },
      exit: { ms: 150, ease: emil },
      content: { ms: 180, ease: emil },
      fromScale: 0.94,
      travel: 6,
      stagger: 24,
    });
    expect(motionTokens(undefined)).toBe(motionPresets.smooth);
    expect(motionTokens('bouncy')).toBe(motionPresets.bouncy);
  });

  it('holds CSS springs generated from its own springs (no sampling at run time)', () => {
    for (const tokens of Object.values(motionPresets)) {
      for (const kind of ['enter', 'morph'] as const) {
        const generated = springToLinear(fromAppleDurationBounce(tokens[kind].duration, tokens[kind].bounce));
        expect(tokens.css[kind]).toEqual({ ms: generated.duration, easing: generated.easing });
      }
    }
  });

  it('derives the lab choreography: exit half-way to the entrance scale, content cross-fade', () => {
    expect(exitScale(motionPresets.smooth)).toBeCloseTo(0.985, 9);
    expect(exitScale(motionPresets.bouncy)).toBeCloseTo(0.97, 9);
    expect(contentTiming(motionPresets.smooth)).toEqual({ inDelayMs: 90, outMs: 120 });
    expect(contentTiming(motionPresets.bouncy)).toEqual({ inDelayMs: 90, outMs: 108 });
    expect(springTransition(motionPresets.smooth.enter, 65)).toEqual({
      type: 'spring',
      visualDuration: 0.4 / 1.2,
      bounce: 0,
      delay: 0.065,
    });
  });

  it('writes the preset as CSS custom properties on <html>', () => {
    const root = document.createElement('html');
    applyMotionPreset('bouncy', root);
    expect(root.dataset.motionPreset).toBe('bouncy');
    expect(root.style.getPropertyValue('--motion-morph-ms')).toBe('775ms');
    expect(root.style.getPropertyValue('--motion-enter-ease')).toBe(motionPresets.bouncy.css.enter.easing);
    expect(root.style.getPropertyValue('--motion-from-scale')).toBe('0.94');
    expect(root.style.getPropertyValue('--motion-travel')).toBe('6px');
    expect(motionCssVariables(motionPresets.smooth)['--motion-content-delay']).toBe('90ms');
    expect(motionCssVariables(motionPresets.smooth)['--motion-exit-ease']).toBe('cubic-bezier(0.23,1,0.32,1)');
  });
});

describe('presence', () => {
  it('enters a surface on the enter spring with glide and scale, and leaves on the exit curve', () => {
    const presence = surfacePresence(motionPresets.smooth, false, 'down');
    expect(presence.initial).toEqual({ opacity: 0, y: -4, scale: 0.97 });
    expect(presence.animate).toEqual({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { type: 'spring', visualDuration: 0.4 / 1.2, bounce: 0 },
    });
    expect(presence.exit).toEqual({
      opacity: 0,
      scale: 0.985,
      transition: { duration: 0.17, ease: [0.23, 1, 0.32, 1], delay: 0 },
    });
    expect(surfacePresence(motionPresets.bouncy, false, 'up').initial).toEqual({ opacity: 0, y: 6, scale: 0.94 });
  });

  it('keeps only short opacity fades under reduced motion', () => {
    for (const presence of [
      surfacePresence(motionPresets.bouncy, true, 'up', 65),
      contentPresence(motionPresets.bouncy, true),
    ]) {
      for (const state of [presence.initial, presence.animate, presence.exit]) {
        expect(Object.keys(state).filter((key) => key !== 'transition')).toEqual(['opacity']);
      }
      for (const transition of [presence.animate.transition, presence.exit.transition]) {
        expect(transition).toEqual({ duration: reducedFadeMs / 1000, ease: 'linear', delay: 0 });
        expect(reducedFadeMs).toBeLessThanOrEqual(150);
      }
    }
    expect(stateTransition(motionPresets.smooth, true)).toEqual({ duration: 0 });
    expect(stateTransition(motionPresets.smooth, false)).toEqual({
      type: 'spring',
      visualDuration: 0.45 / 1.2,
      bounce: 0,
    });
  });

  it('cross-fades content: the new one after min(90, content / 2), the old one in 0.6 × content', () => {
    const presence = contentPresence(motionPresets.smooth, false);
    expect(presence.animate.transition).toEqual({ duration: 0.2, ease: [0.23, 1, 0.32, 1], delay: 0.09 });
    expect(presence.exit.transition).toEqual({ duration: 0.12, ease: [0.4, 0, 1, 1], delay: 0 });
  });
});
