import { describe, expect, it } from 'vitest';
import { contrast, inkFor, inkStops, MASK_MAX_LENGTH, maskOf, readable, usableMasks, type Rgb } from './ink';

const png = 'data:image/png;base64,iVBORw0KGgo=';
const rect = { x: 10, y: 10, width: 80, height: 20 };

describe('the ink of the changed words', () => {
  it('keeps the inks of the lab where they already read at 4.5:1: white and near-white, the dark grounds', () => {
    for (const ground of [
      [255, 255, 255],
      [251, 251, 251],
      [243, 243, 243],
    ] as Rgb[])
      expect(inkFor('encre', 'light', ground)).toEqual(inkStops.encre.light);
    for (const ground of [
      [32, 32, 32],
      [30, 30, 30],
      [13, 17, 23],
      [0, 0, 0],
    ] as Rgb[])
      expect(inkFor('encre', 'dark', ground)).toEqual(inkStops.encre.dark);
  });

  it('reads at 4.5:1 on every ground, both styles, whatever the tone Rust gave', () => {
    for (let r = 0; r <= 255; r += 15)
      for (let g = 0; g <= 255; g += 15)
        for (let b = 0; b <= 255; b += 51) {
          const ground: Rgb = [r, g, b];
          for (const style of ['encre', 'eclat'] as const)
            for (const tone of ['light', 'dark'] as const) {
              for (const stop of inkFor(style, tone, ground))
                expect(contrast(stop, ground), `${style} ${tone} on ${ground}`).toBeGreaterThanOrEqual(4.5);
            }
        }
  });

  it('moves an ink no further than it must', () => {
    const ground: Rgb = [200, 200, 200];
    const [first] = inkFor('encre', 'light', ground);
    expect(contrast(first, ground)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(first, ground)).toBeLessThan(5.2);
    expect(readable([74, 85, 214], [255, 255, 255])).toEqual([74, 85, 214]);
  });

  it('without a ground, the inks of the lab as they are', () => {
    expect(inkFor('eclat', 'dark')).toEqual(inkStops.eclat.dark);
  });
});

describe('the masks the page accepts', () => {
  it('PNG data URLs on real rectangles only, of a sane size and number', () => {
    expect(usableMasks([{ rect, image: png }])).toHaveLength(1);
    expect(usableMasks(undefined)).toEqual([]);
    expect(usableMasks('x')).toEqual([]);
    expect(
      usableMasks([
        null,
        { rect, image: 'https://example.invalid/a.png' },
        { rect, image: 'data:image/svg+xml;base64,AAAA' },
        { rect, image: `${png}"); background: url("x` },
        { rect: { ...rect, width: 0 }, image: png },
        { rect: { ...rect, x: Number.NaN }, image: png },
        { image: png },
        { rect, image: png + 'A'.repeat(MASK_MAX_LENGTH) },
      ]),
    ).toEqual([]);
    expect(usableMasks(Array.from({ length: 100 }, () => ({ rect, image: png })))).toHaveLength(64);
  });

  it('a line takes the mask that covers most of it, half at least', () => {
    const near = { rect: { x: 9.5, y: 10, width: 81, height: 20 }, image: png };
    const half = { rect: { x: 60, y: 10, width: 80, height: 20 }, image: png };
    const far = { rect: { x: 300, y: 10, width: 80, height: 20 }, image: png };
    expect(maskOf(rect, [far, half, near])).toBe(near);
    expect(maskOf(rect, [far, half])).toBeNull();
    expect(maskOf(rect, [])).toBeNull();
  });
});
