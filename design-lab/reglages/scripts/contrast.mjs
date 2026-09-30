// Checks the contrast rules of src/tokens/palettes.js. Exit code 1 when a rule fails.
// Also checks the surfaces the directions derive (Mat whitens / blackens the window).
import { PALETTES, contrast, onColor } from '../src/tokens/palettes.js';

const mix = (a, b, t) => { // a*t + b*(1-t), hex
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return '#' + x.map((v, i) => Math.round(v * t + y[i] * (1 - t)).toString(16).padStart(2, '0')).join('');
};

let fails = 0;
const rows = [];
const check = (label, ratio, min) => { const ok = ratio >= min; if (!ok) fails++; rows.push(`${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(58)} ${ratio.toFixed(2)} (≥ ${min})`); };

for (const p of PALETTES) for (const theme of ['light', 'dark']) {
  const t = p[theme];
  const matWin = theme === 'light' ? mix(t.bg, '#FFFFFF', 0.25) : mix(t.bg, '#000000', 0.45);
  const matGroup = theme === 'light' ? mix(t.bg, '#FFFFFF', 0.7) : mix(t.surface, '#000000', 0.8);
  const grounds = { bg: t.bg, surface: t.surface, field: t.field, sidebar: t.sidebar, 'mat-win': matWin, 'mat-group': matGroup };
  for (const [gn, g] of Object.entries(grounds)) {
    for (const k of ['text', 'text2', 'text3', 'accentText']) check(`${p.id}/${theme} ${k} on ${gn}`, contrast(t[k], g), 4.5);
    check(`${p.id}/${theme} accent on ${gn}`, contrast(t.accent, g), 3);
  }
  check(`${p.id}/${theme} onAccent on accent`, contrast(onColor(t.accent, t.deep), t.accent), 4.5);
  check(`${p.id}/${theme} onAccent on accentHover`, contrast(onColor(t.accent, t.deep), t.accentHover), 4.5);
  p.tiles.forEach((c, i) => check(`${p.id} tile ${i + 1} glyph`, contrast(onColor(c, '#101114'), c), 3));
}
const verbose = process.argv.includes('-v');
for (const r of rows) if (verbose || r.startsWith('FAIL')) console.log(r);
console.log(`${rows.length} checks, ${fails} failures`);
process.exit(fails ? 1 : 0);
