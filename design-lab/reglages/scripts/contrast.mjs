// Checks the contrast rules of src/tokens/palettes.js (v2). Exit code 1 when a rule fails.
//   node scripts/contrast.mjs [-v]
// Bases (Porcelaine, Papier) × themes: text / accent on every ground of the matte window.
// Page colours (sets A and B) × bases × themes: hue ≥ 3:1 (icons, pill) and text ≥ 4.5:1 on the
// window, sidebar, card and field, and page text inside its own pill; body text inside the pill.
import { PALETTES, PAGE_SETS, PAGES, PILL_ALPHA, contrast, onColor, over, pageColor, groundsOf } from '../src/tokens/palettes.js';

let fails = 0;
const rows = [];
const check = (label, ratio, min) => { const ok = ratio >= min; if (!ok) fails++; rows.push(`${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(64)} ${ratio.toFixed(2)} (≥ ${min})`); };

for (const p of PALETTES) for (const theme of ['light', 'dark']) {
  const t = p[theme];
  const grounds = { bg: t.bg, surface: t.surface, field: t.field, sidebar: t.sidebar };
  for (const [gn, g] of Object.entries(grounds)) {
    for (const k of ['text', 'text2', 'text3', 'accentText']) check(`${p.id}/${theme} ${k} on ${gn}`, contrast(t[k], g), 4.5);
    check(`${p.id}/${theme} accent on ${gn}`, contrast(t.accent, g), 3);
  }
  check(`${p.id}/${theme} onAccent on accent`, contrast(onColor(t.accent, t.deep), t.accent), 4.5);
  check(`${p.id}/${theme} onAccent on accentHover`, contrast(onColor(t.accent, t.deep), t.accentHover), 4.5);
  check(`${p.id}/${theme} switch-off border on bg (ink .56)`, contrast(over(t.text, t.bg, 0.56), t.bg), 3);
}

for (const set of PAGE_SETS) for (const p of PALETTES) for (const theme of ['light', 'dark']) {
  const t = p[theme];
  const grounds = groundsOf(p, theme);
  for (const id of PAGES) {
    const c = pageColor(set.id, id, p.id, theme);
    const tag = `${set.id}/${p.id}/${theme} ${id} (${c.hue} · ${c.text})`;
    for (const g of grounds) {
      check(`${tag} hue on ${g}`, contrast(c.hue, g), 3);
      check(`${tag} text on ${g}`, contrast(c.text, g), 4.5);
    }
    const pill = over(c.hue, t.sidebar, PILL_ALPHA[theme]);
    check(`${tag} body text in pill`, contrast(t.text, pill), 4.5);
    check(`${tag} page text in pill`, contrast(c.text, pill), 4.5);
    check(`${tag} icon in pill`, contrast(c.hue, pill), 3);
  }
}

const verbose = process.argv.includes('-v');
for (const r of rows) if (verbose || r.startsWith('FAIL')) console.log(r);
if (process.argv.includes('--table')) {
  for (const set of PAGE_SETS) for (const p of PALETTES) for (const theme of ['light', 'dark']) {
    console.log(`${set.id} ${p.id} ${theme}: ` + PAGES.map(id => `${id}=${pageColor(set.id, id, p.id, theme).hue}`).join(' '));
  }
}
console.log(`${rows.length} checks, ${fails} failures`);
process.exit(fails ? 1 : 0);
