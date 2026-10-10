import { describe, expect, it } from 'vitest';
import css from './theme.css?raw';
import { cornerRadius, overlap, overlayGlassSurfaces, setupGlassSurfaces } from './glassBackdrop';

const shape = (x: number, y: number, width: number, height: number, radius = 16, opacity = 1) => ({
  x,
  y,
  width,
  height,
  radius,
  opacity,
});

describe('the real glass tracker', () => {
  it('tracks exactly the surfaces the stylesheet lets through under data-backdrop="glass"', () => {
    const rule = css.match(/:root\[data-backdrop="glass"\] :is\(([^)]*)\)/);
    expect(
      rule?.[1]
        .split(',')
        .map((selector: string) => selector.trim())
        .sort(),
    ).toEqual([...overlayGlassSurfaces].sort());
    // The setup window is glass through its own rule (src/setup/setup.css): the page is the window.
    expect(setupGlassSurfaces).toEqual(['.su-desk[data-native] .su-window']);
  });

  it('reads a corner radius as the page draws it: a capsule is half the smaller side', () => {
    expect(cornerRadius('16px', 218, 176)).toBe(16);
    expect(cornerRadius('999px', 300, 44)).toBe(22);
    expect(cornerRadius('50%', 40, 40)).toBe(20);
    expect(cornerRadius('22px 22px', 300, 44)).toBe(22);
    expect(cornerRadius('0px', 620, 720)).toBe(0);
    expect(cornerRadius('', 10, 10)).toBe(0);
    expect(cornerRadius('-4px', 10, 10)).toBe(0);
  });

  it('sends only what two successive frames share, so the blur never shows outside the surface', () => {
    // Growing (pill → grid): the earlier, smaller shape; shrinking: the later, smaller shape.
    expect(overlap(shape(10, 10, 108, 32, 16), shape(10, 10, 140, 60, 16))).toEqual(shape(10, 10, 108, 32, 16));
    expect(overlap(shape(10, 10, 218, 116, 16), shape(10, 10, 180, 90, 16))).toEqual(shape(10, 10, 180, 90, 16));
    // Sliding: the band both cover; the rounder corner; the fainter opacity.
    expect(overlap(shape(0, 0, 100, 40, 20, 0.4), shape(12, 0, 100, 40, 12, 0.6))).toEqual(
      shape(12, 0, 88, 40, 20, 0.4),
    );
    // Still: itself.
    expect(overlap(shape(5, 6, 70, 30, 15), shape(5, 6, 70, 30, 15))).toEqual(shape(5, 6, 70, 30, 15));
    // Nothing in common (a jump): nothing for this frame.
    expect(overlap(shape(0, 0, 50, 20), shape(200, 0, 50, 20))).toBeNull();
    // The radius never exceeds half of what is left.
    expect(overlap(shape(0, 0, 100, 44, 22), shape(0, 30, 100, 44, 22))?.radius).toBe(7);
  });
});
