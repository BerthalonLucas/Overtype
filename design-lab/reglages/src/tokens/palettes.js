// Colours of the lab, v2 (Lucas, 30/09): ONE structure, TWO neutral bases he liked, and ONE
// COLOUR PER PAGE against monotony.
//
//   Base neutre   Porcelaine & lavande | Papier & corail — the neutral tint of every surface and
//                 the default accent (buttons, switch, focus).
//   Jeu par page  A (vives, the hues he named) | B (poudrées: same lightness and chroma for every
//                 page, so no page shouts louder than another). Each settings page has a hue used
//                 for its sidebar icon, the gliding pill, a faint veil at the top of the page; the
//                 setup questions reuse the colour of their topic (TOPIC_PAGE). Diagnostic = mono.
//
// Rules (checked by scripts/contrast.mjs, both themes):
//   text, text2, text3, accentText ≥ 4.5:1 on bg, surface, field, sidebar;
//   accent ≥ 3:1 on bg and surface; onAccent on accent ≥ 4.5:1;
//   page hue ≥ 3:1 (icon) and page text ≥ 4.5:1 on window, sidebar, card and inside the pill.

export const PALETTES = [
  {
    id: 'porcelaine', name: 'Porcelaine', long: 'Porcelaine & lavande', note: 'Blanc laiteux, violet franc. Doux mais net.',
    light: {
      accent: '#5B4BDB', accentHover: '#4B3CC4', accentText: '#4F3FD0', deep: '#1D1450',
      bg: '#F5F4FA', surface: '#FFFFFF', sidebar: '#ECEAF5', field: '#FFFFFF',
      text: '#16141F', text2: '#4D4A5E', text3: '#646076',
      wall: ['#D9D2FB', '#B7A8FF', '#F7F5FC', '#E9E4FA'],
    },
    dark: {
      accent: '#B7A8FF', accentHover: '#C8BDFF', accentText: '#C8BDFF', deep: '#1D1450',
      bg: '#131219', surface: '#1C1A24', sidebar: '#0E0D13', field: '#24222E',
      text: '#F1EFF8', text2: '#B2ADC4', text3: '#9690AA',
      wall: ['#3A2C8A', '#1D1450', '#08070D', '#2A2150'],
    },
    tiles: ['#5B4BDB', '#8A58D6', '#C94D86', '#2F7BC4', '#B37A12', '#2F8C76', '#6E6888', '#2B2640'],
  },
  {
    id: 'papier', name: 'Papier', long: 'Papier & corail', note: 'Papier chaud, corail vif. Le plus chaleureux.',
    light: {
      accent: '#D63A4D', accentHover: '#C22F43', accentText: '#BE3244', deep: '#3B0A12',
      bg: '#F8F5EF', surface: '#FFFDF9', sidebar: '#F0EBE2', field: '#FFFFFF',
      text: '#1F1A17', text2: '#56504A', text3: '#6A635B',
      wall: ['#F7C9C0', '#F29A8E', '#FBF7F0', '#F1E4D6'],
    },
    dark: {
      accent: '#FF8A95', accentHover: '#FFA3AC', accentText: '#FFA3AC', deep: '#3B0A12',
      bg: '#16120F', surface: '#201B17', sidebar: '#110E0B', field: '#29231E',
      text: '#F6F0E8', text2: '#BFB5A8', text3: '#A2988B',
      wall: ['#6A2230', '#3B0A12', '#0B0908', '#3A2A20'],
    },
    tiles: ['#D63A4D', '#D0681C', '#9C7A0E', '#2E826C', '#3F6CC9', '#8C4FB8', '#7A6E62', '#2E2824'],
  },
];
export const PALETTE_BY_ID = Object.fromEntries(PALETTES.map(p => [p.id, p]));
export const BASES = PALETTES; // v2 name: the neutral base

// Status colours, shared by both bases.
export const STATUS = {
  light: { ok: '#1B7F52', warn: '#9A5406', danger: '#C22F3D', info: '#2A55C9' },
  dark: { ok: '#7FD3A3', warn: '#F0C27A', danger: '#FF9C8F', info: '#A9CDF9' },
};

// ——— Colour maths (sRGB, WCAG 2.x, OKLCH) ———
export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgbTriplet = hex => hexToRgb(hex).join(' ');
export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
export function onColor(fill, deep = '#0B0D12') {
  return contrast('#FFFFFF', fill) >= contrast(deep, fill) ? '#FFFFFF' : deep;
}
// a over b with alpha (hex, hex, 0–1) → hex. Used to check text inside a translucent pill.
export function over(a, b, alpha) {
  const [x, y] = [hexToRgb(a), hexToRgb(b)];
  return '#' + x.map((v, i) => Math.round(v * alpha + y[i] * (1 - alpha)).toString(16).padStart(2, '0')).join('');
}
export function oklch(L, C, h) {
  const a = C * Math.cos((h * Math.PI) / 180), b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
  return '#' + lin.map(v => {
    const c = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0');
  }).join('');
}

// ——— One colour per page ———
// Pages of the Réglages (ids of SETTINGS_PAGES) and the setup topic that reuses each colour.
export const PAGES = ['general', 'raccourcis', 'actions', 'apres', 'apparence', 'serveur', 'donnees', 'diagnostic'];
export const TOPIC_PAGE = { welcome: 'general', apparence: 'apparence', raccourci: 'raccourcis', modele: 'serveur', demo: 'actions', pret: 'general', reglages: 'general' };

// Each hue: [name, C, h] in OKLCH; lightness is set per theme, then tuned for contrast.
export const PAGE_SETS = [
  {
    id: 'A', name: 'A · vives', note: 'Les teintes que vous avez nommées, franches : ardoise, corail, lavande, bleu, ambre, vert d’eau, prune, console.',
    L: { light: 0.56, dark: 0.80 },
    hues: {
      general: ['Ardoise', 0.035, 250], raccourcis: ['Corail', 0.16, 32], actions: ['Lavande', 0.15, 292], apres: ['Bleu', 0.15, 258],
      apparence: ['Ambre', 0.14, 68], serveur: ['Vert d’eau', 0.10, 185], donnees: ['Prune', 0.13, 342], diagnostic: ['Console', 0, 0],
    },
  },
  {
    id: 'B', name: 'B · poudrées', note: 'Même luminosité et même intensité pour chaque page, teintes réparties sur le cercle : aucune page ne crie plus fort qu’une autre.',
    L: { light: 0.57, dark: 0.79 },
    hues: {
      general: ['Graphite', 0.02, 70], raccourcis: ['Abricot', 0.09, 50], actions: ['Iris', 0.09, 285], apres: ['Azur', 0.09, 232],
      apparence: ['Miel', 0.09, 88], serveur: ['Sauge', 0.09, 155], donnees: ['Framboise', 0.09, 5], diagnostic: ['Console', 0, 0],
    },
  },
];
export const PAGE_SET_BY_ID = Object.fromEntries(PAGE_SETS.map(s => [s.id, s]));

// The grounds a page colour sits on (window content, sidebar, card, field) for a base × theme.
export function groundsOf(base, theme) {
  const t = base[theme];
  return [t.bg, t.sidebar, t.surface, t.field];
}
export const PILL_ALPHA = { light: 0.14, dark: 0.2 };

// Walk the lightness away from the grounds until every ground passes `min`.
function tune(L, C, h, grounds, min, theme) {
  const step = theme === 'light' ? -0.005 : 0.005;
  let l = L, hex = oklch(l, C, h);
  for (let i = 0; i < 80 && grounds.some(g => contrast(hex, g) < min); i++) { l += step; hex = oklch(l, C, h); }
  return hex;
}
// { hue, text } for one page of a set, on a base and theme. hue: icons, pill, veil (≥ 3:1);
// text: when the page colour writes text (≥ 4.5:1, also inside its own pill).
export function pageColor(setId, pageId, baseId, theme) {
  const set = PAGE_SET_BY_ID[setId] || PAGE_SETS[0];
  const base = PALETTE_BY_ID[baseId] || PALETTES[0];
  const [name, C, h] = set.hues[pageId] || set.hues.general;
  const grounds = groundsOf(base, theme);
  const hue = tune(set.L[theme], C, h, grounds, 3, theme);
  const pills = grounds.map(g => over(hue, g, PILL_ALPHA[theme]));
  const text = tune(set.L[theme], C, h, [...grounds, ...pills], 4.5, theme);
  return { name, hue, text };
}

// All the CSS custom properties of one base in one theme (names documented in README).
export function paletteVars(palette, theme) {
  const t = palette[theme];
  const s = STATUS[theme];
  const dark = theme === 'dark';
  const vars = {
    '--ft-accent': t.accent,
    '--ft-accent-rgb': rgbTriplet(t.accent),
    '--ft-accent-hover': t.accentHover,
    '--ft-accent-text': t.accentText,
    '--ft-on-accent': onColor(t.accent, t.deep),
    '--ft-accent-soft': `rgb(${rgbTriplet(t.accent)} / ${dark ? 0.16 : 0.11})`,
    '--ft-accent-deep': t.deep,
    '--ft-bg': t.bg, '--ft-bg-rgb': rgbTriplet(t.bg),
    '--ft-surface': t.surface, '--ft-surface-rgb': rgbTriplet(t.surface),
    '--ft-sidebar': t.sidebar, '--ft-sidebar-rgb': rgbTriplet(t.sidebar),
    '--ft-field': t.field,
    '--ft-text': t.text, '--ft-ink-rgb': rgbTriplet(t.text),
    '--ft-text-2': t.text2, '--ft-text-3': t.text3,
    '--ft-ok': s.ok, '--ft-warn': s.warn, '--ft-danger': s.danger, '--ft-info': s.info,
    '--ft-ok-rgb': rgbTriplet(s.ok), '--ft-warn-rgb': rgbTriplet(s.warn), '--ft-danger-rgb': rgbTriplet(s.danger), '--ft-info-rgb': rgbTriplet(s.info),
    '--ft-wall-1': t.wall[0], '--ft-wall-2': t.wall[1], '--ft-wall-3': t.wall[2], '--ft-wall-4': t.wall[3],
    '--ft-scheme': theme,
  };
  palette.tiles.forEach((c, i) => {
    vars[`--ft-tile-${i + 1}`] = c;
    vars[`--ft-on-tile-${i + 1}`] = onColor(c, '#101114');
  });
  return vars;
}

// One stylesheet: every base × theme, then every page colour of every set × base × theme.
// A page colour resolves on any element carrying data-ft-page="<id>" (or on the scope itself):
//   --ft-page (hue), --ft-page-rgb, --ft-page-text, --ft-page-soft (pill), --ft-page-veil (top veil).
export function paletteCss() {
  let css = '';
  for (const p of PALETTES) for (const theme of ['light', 'dark']) {
    const body = Object.entries(paletteVars(p, theme)).map(([k, v]) => `${k}:${v}`).join(';');
    css += `[data-ft-palette="${p.id}"][data-ft-theme="${theme}"]{${body};color-scheme:${theme}}\n`;
  }
  for (const set of PAGE_SETS) for (const p of PALETTES) for (const theme of ['light', 'dark']) {
    const scope = `[data-ft-pageset="${set.id}"][data-ft-palette="${p.id}"][data-ft-theme="${theme}"]`;
    for (const id of PAGES) {
      const c = pageColor(set.id, id, p.id, theme);
      const rgb = rgbTriplet(c.hue);
      const body = `--ft-page:${c.hue};--ft-page-rgb:${rgb};--ft-page-text:${c.text};--ft-page-soft:rgb(${rgb} / ${PILL_ALPHA[theme]});--ft-page-veil:rgb(${rgb} / ${theme === 'dark' ? 0.13 : 0.09})`;
      css += `${scope} [data-ft-page="${id}"],${scope}[data-ft-page="${id}"]{${body}}\n`;
    }
  }
  return css;
}
