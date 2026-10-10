import { describe, expect, it } from 'vitest';
import css from '../theme.css?raw';

// The error pill's icon (lot 10): the lab's colours (design-lab/src/app.css:170-171, #D14343 and
// #FF8A80; vitest empties CSS it does not process, so they are written here) through the
// theme's --error-icon, visible at 3:1 at least (a graphic, WCAG 1.4.11) on the surfaces of
// its theme over a white or a black desktop, as src/theme.test.ts measures the text.
function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  return Object.fromEntries(
    [...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]),
  );
}
type Rgba = [number, number, number, number];
const hex = (value: string): Rgba => [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16)).concat(1) as Rgba;
const rgb = (value: string): Rgba => {
  const [r, g, b, a = '1'] = value.match(/[\d.]+/g)!;
  return [+r, +g, +b, +a];
};
const over = (top: Rgba, bottom: Rgba): Rgba =>
  [0, 1, 2].map((i) => top[i] * top[3] + bottom[i] * (1 - top[3])).concat(1) as Rgba;
const channel = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]: Rgba) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const ratio = (a: Rgba, b: Rgba) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe('--error-icon', () => {
  const light = block(':root'),
    dark = block(':root[data-theme="dark"]'),
    system = block(':root:not([data-theme="light"])');
  it('takes the lab’s colours, the same for the dark system theme and the dark choice', () => {
    expect([light['--error-icon'], dark['--error-icon'], system['--error-icon']]).toEqual([
      '#d14343',
      '#ff8a80',
      '#ff8a80',
    ]);
  });
  it('stands out at 3:1 on its surface, over a white or a black desktop', () => {
    for (const [tokens, fill] of [
      [light, light['--surface-fill']],
      [dark, dark['--surface-fill']],
    ] as const) {
      for (const desktop of [
        [255, 255, 255, 1],
        [0, 0, 0, 1],
      ] as Rgba[]) {
        expect(ratio(hex(tokens['--error-icon']), over(rgb(fill), desktop))).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
