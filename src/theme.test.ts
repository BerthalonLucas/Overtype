import { describe, expect, it } from 'vitest';
import css from './theme.css?raw';

// The tokens as the browser resolves them: the light block on :root, the dark block over it.
type Tokens = Record<string, string>;
function block(selector: string): Tokens {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`missing ${selector}`);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  return Object.fromEntries([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]));
}
const light = block(':root');
const darkChoice = block(':root[data-theme="dark"]');
const darkSystem = block(':root:not([data-theme="light"])');
const themes = { light, dark: { ...light, ...darkChoice } } as const;
function resolve(tokens: Tokens, value: string, depth = 0): string {
  if (depth > 8) throw new Error(`var cycle in ${value}`);
  return value.replace(/var\((--[\w-]+)\)/g, (_, name: string) => {
    if (!(name in tokens)) throw new Error(`unknown ${name}`);
    return resolve(tokens, tokens[name], depth + 1);
  });
}

// Colours: rgb(R G B[ / A]) or #rgb / #rrggbb, composited over an opaque backdrop.
type Rgba = { r: number; g: number; b: number; a: number };
function color(value: string): Rgba {
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const digits = hex[1].length === 3 ? [...hex[1]].map(d => d + d) : hex[1].match(/../g)!;
    const [r, g, b] = digits.map(d => parseInt(d, 16));
    return { r, g, b, a: 1 };
  }
  const rgb = value.match(/^rgb\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+))?\s*\)$/);
  if (!rgb) throw new Error(`not a colour: ${value}`);
  return { r: +rgb[1], g: +rgb[2], b: +rgb[3], a: rgb[4] === undefined ? 1 : +rgb[4] };
}
const over = (top: Rgba, bottom: Rgba): Rgba => ({ r: top.r * top.a + bottom.r * (1 - top.a), g: top.g * top.a + bottom.g * (1 - top.a), b: top.b * top.a + bottom.b * (1 - top.a), a: 1 });
const channel = (v: number) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const luminance = ({ r, g, b }: Rgba) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
function ratio(text: Rgba, background: Rgba) {
  const fg = luminance(over(text, background)), bg = luminance(background);
  return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
}
const white: Rgba = { r: 255, g: 255, b: 255, a: 1 };
const black: Rgba = { r: 0, g: 0, b: 0, a: 1 };

describe('theme tokens', () => {
  it('writes the dark theme once for the system and once for the choice, identically', () => {
    expect(darkSystem).toEqual(darkChoice);
    for (const name of Object.keys(darkChoice)) expect(light, name).toHaveProperty(name);
  });

  // The floating surfaces are translucent: the desktop behind may be white or black, and the
  // diagonal sheen lightens their top corner. Every text token must hold 4.5:1 on each.
  for (const [theme, tokens] of Object.entries(themes)) {
    const token = (name: string) => color(resolve(tokens, `var(${name})`));
    const sheen = +resolve(tokens, 'var(--surface-sheen)').match(/\/\s*([\d.]+)\)/)![1];
    it(`keeps 4.5:1 for text on the ${theme} surfaces, over a white or a black desktop`, () => {
      for (const desktop of [white, black]) {
        const base = over(token('--surface-fill'), desktop);
        const backgrounds = { base, sheen: over({ ...white, a: sheen }, base), hover: over(token('--hover'), base), quiet: over(token('--quiet-bg'), base) };
        for (const [where, background] of Object.entries(backgrounds)) {
          const texts = where === 'base' || where === 'sheen' ? ['--text', '--text-muted', '--text-subtle', '--error-text', '--warning-text'] : ['--text'];
          for (const text of texts) expect(ratio(token(text), background), `${theme} ${text} on ${where} over ${desktop === white ? 'white' : 'black'}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
    it(`keeps 4.5:1 for text in the ${theme} settings window`, () => {
      const bg = token('--settings-bg');
      expect(bg.a).toBe(1);
      const row = over(token('--settings-row'), bg);
      const pairs: Array<[string, string, Rgba]> = [];
      for (const text of ['--text', '--text-muted', '--text-subtle', '--link', '--error-text', '--warning-text']) pairs.push([text, 'window', bg], [text, 'row', row]);
      // --text-subtle on a field: the placeholders (styles.css, .settings-window input::placeholder).
      pairs.push(['--text', 'field', over(token('--settings-field'), row)], ['--text-subtle', 'field', over(token('--settings-field'), row)]);
      pairs.push(['--text-muted', 'segment track', over(token('--segment-track'), row)], ['--segment-on-text', 'segment on', over(token('--segment-on-bg'), row)]);
      pairs.push(['--primary-text', 'primary', token('--primary-bg')], ['--text', 'quiet', over(token('--quiet-bg'), bg)], ['--link', 'hover', over(token('--hover'), row)]);
      for (const [text, where, background] of pairs) expect(ratio(token(text), background), `${theme} ${text} on ${where}`).toBeGreaterThanOrEqual(4.5);
    });
  }

  // 0.6: the painted material is the fallback of the real glass. It follows the lab's floating
  // material (design-lab/reglages/src/tokens/tokens.css:80-86 and 135-138; vitest empties the
  // CSS it does not process, so its values are written here): its grain, its luminous rim over
  // a .5 px edge, and the real glass's own tint and blur; dense enough that nothing behind it
  // shows through sharp without a blur (the lab's .55 and .5 need one).
  it('paints the fallback of the lab\'s floating glass: dense, grained, with its luminous rim', () => {
    const lab = {
      light: { rim: 'inset 0 0 0 .5px rgb(255 255 255 / .5), inset 0 1px 0 rgb(255 255 255 / .65)', edge: '0 0 0 .5px rgb(0 0 0 / .14)', tint: 'rgb(255 255 255 / .55)', blur: 'blur(28px) saturate(1.9)' },
      dark: { rim: 'inset 0 0 0 .5px rgb(255 255 255 / .14), inset 0 1px 0 rgb(255 255 255 / .12)', edge: '0 0 0 .5px rgb(0 0 0 / .5)', tint: 'rgb(19 18 25 / .5)', blur: 'blur(28px) saturate(1.6)' },
    };
    for (const theme of ['light', 'dark'] as const) {
      const tokens = themes[theme];
      expect(resolve(tokens, 'var(--surface-rim)')).toBe(`${lab[theme].rim}, ${lab[theme].edge}`);
      expect(resolve(tokens, 'var(--surface-bg)')).toBe(`${tokens['--surface-grain']}, ${tokens['--surface-fill']}`);
      expect(tokens['--surface-grain']).toContain('feTurbulence');
      expect(color(tokens['--surface-fill']).a).toBeGreaterThanOrEqual(0.9);
      expect([tokens['--glass-tint'], tokens['--glass-blur']]).toEqual([lab[theme].tint, lab[theme].blur]);
    }
    expect(css).toMatch(/:root\[data-backdrop="glass"\][^{]*\.ilot-shape[^{]*\{[^}]*var\(--glass-tint\)[^}]*backdrop-filter: var\(--glass-blur\)/);
    expect([light['--ink-rgb'], darkChoice['--ink-rgb']]).toEqual(['29 29 31', '245 246 248']);
  });
});
