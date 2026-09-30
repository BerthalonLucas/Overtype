// The 6 palettes × 2 themes of the lab. Every colour of the UI comes from here (or from the
// direction CSS, which mixes these). Rules (checked by scripts/contrast.mjs):
//   text, text2, text3 and accentText  ≥ 4.5:1 on bg, surface and field;
//   accent                             ≥ 3:1   on bg and surface (fills, switch, focus);
//   onAccent on accent                 ≥ 4.5:1 (derived: white or the palette's deep ink);
//   tile glyph (white or deep ink)     ≥ 3:1   on each tile.
// Neutrals are tinted toward the accent. `tiles` feed the coloured icon tiles (direction Aérien)
// and anything decorative; `wall` paints the simulated desktop.

export const PALETTES = [
  {
    id: 'encre', name: 'Encre & glacier', note: 'Bleu encre le jour, bleu glacier la nuit. La continuité de l’Îlot.',
    light: {
      accent: '#3563E9', accentHover: '#2A55C9', accentText: '#2A55C9', deep: '#0E2440',
      bg: '#F3F5F9', surface: '#FFFFFF', sidebar: '#EBEEF4', field: '#FFFFFF',
      text: '#111623', text2: '#4A5263', text3: '#5E6677',
      wall: ['#BFD1F6', '#8FB0F0', '#EEF3FB', '#DCE6F8'],
    },
    dark: {
      accent: '#91BFF7', accentHover: '#A9CDF9', accentText: '#A9CDF9', deep: '#0E2440',
      bg: '#0F1218', surface: '#171B23', sidebar: '#0B0E13', field: '#1E232D',
      text: '#EEF2F8', text2: '#A9B1C0', text3: '#8F97A7',
      wall: ['#1B3D78', '#0E2440', '#05070C', '#132B55'],
    },
    tiles: ['#3563E9', '#0F8FA0', '#6E56F0', '#D9642E', '#C93B6E', '#23875A', '#56657F', '#1F2A44'],
  },
  {
    id: 'graphite', name: 'Graphite & chartreuse', note: 'Gris minéral, une pointe acide. Le plus typé.',
    light: {
      accent: '#6C8A00', accentHover: '#7A9A06', accentText: '#536B00', deep: '#101400',
      bg: '#F2F2EF', surface: '#FFFFFF', sidebar: '#E8E8E3', field: '#FFFFFF',
      text: '#1A1B17', text2: '#4B4D45', text3: '#62645C',
      wall: ['#DDE7B0', '#B9CC5C', '#F3F3EE', '#D9D9D2'],
    },
    dark: {
      accent: '#D4F06A', accentHover: '#E0F58E', accentText: '#D4F06A', deep: '#1C2400',
      bg: '#121311', surface: '#1B1C19', sidebar: '#0D0E0C', field: '#23251F',
      text: '#F0F1EA', text2: '#B0B3A6', text3: '#95988C',
      wall: ['#3C4A0E', '#1E2408', '#070806', '#2A2C25'],
    },
    tiles: ['#5E7800', '#3F4238', '#9A7B00', '#2B7563', '#8A5A44', '#566478', '#758A12', '#262722'],
  },
  {
    id: 'porcelaine', name: 'Porcelaine & lavande', note: 'Blanc laiteux, violet franc. Doux mais net.',
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
    id: 'papier', name: 'Papier & corail', note: 'Papier chaud, corail vif. Le plus chaleureux.',
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
  {
    id: 'sauge', name: 'Sauge & cuivre', note: 'Vert sauge apaisé, cuivre patiné. Organique.',
    light: {
      accent: '#AD5A26', accentHover: '#964C1D', accentText: '#9A4F1F', deep: '#3A1A05',
      bg: '#F1F4F0', surface: '#FFFFFF', sidebar: '#E5EBE3', field: '#FFFFFF',
      text: '#151A16', text2: '#4A544C', text3: '#5F6A61',
      wall: ['#C9D8C6', '#9DB59A', '#F4F6F2', '#EAD4C2'],
    },
    dark: {
      accent: '#E8A36F', accentHover: '#F0B98E', accentText: '#F0B98E', deep: '#3A1A05',
      bg: '#111512', surface: '#19201B', sidebar: '#0C100D', field: '#212923',
      text: '#EDF2EC', text2: '#AAB6AB', text3: '#8F9C90',
      wall: ['#2E4A33', '#5A3418', '#070A08', '#1E2B21'],
    },
    tiles: ['#5E7F62', '#AD5A26', '#A0701F', '#3F6C7C', '#7E5E8E', '#9A4843', '#66735A', '#2A332C'],
  },
  {
    id: 'nuit', name: 'Nuit & menthe', note: 'Bleu nuit profond, menthe glacée. Taillé pour le sombre.',
    light: {
      accent: '#0B8466', accentHover: '#09705A', accentText: '#087359', deep: '#032A20',
      bg: '#EFF3F5', surface: '#FFFFFF', sidebar: '#E3E9ED', field: '#FFFFFF',
      text: '#0E1519', text2: '#46535B', text3: '#5B6870',
      wall: ['#BFE9DB', '#7FD6BC', '#F1F5F7', '#D3DEE5'],
    },
    dark: {
      accent: '#6EE7C3', accentHover: '#8FEFD2', accentText: '#8FEFD2', deep: '#032A20',
      bg: '#0A0F14', surface: '#111820', sidebar: '#070B0F', field: '#18212A',
      text: '#EAF2F5', text2: '#A2B2BC', text3: '#8697A2',
      wall: ['#0F4A3C', '#0B1E33', '#03060A', '#10283A'],
    },
    tiles: ['#0B8466', '#1F6FB2', '#6452D9', '#C0632F', '#B8426F', '#16869B', '#51606B', '#111820'],
  },
];

export const PALETTE_BY_ID = Object.fromEntries(PALETTES.map(p => [p.id, p]));

// Status colours, shared by every palette.
export const STATUS = {
  light: { ok: '#1B7F52', warn: '#9A5406', danger: '#C22F3D', info: '#2A55C9' },
  dark: { ok: '#7FD3A3', warn: '#F0C27A', danger: '#FF9C8F', info: '#A9CDF9' },
};

// ——— Colour maths (sRGB, WCAG 2.x) ———
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
// The better of white and the palette's deep ink on a fill.
export function onColor(fill, deep = '#0B0D12') {
  return contrast('#FFFFFF', fill) >= contrast(deep, fill) ? '#FFFFFF' : deep;
}

// All the CSS custom properties of one palette in one theme (names documented in README).
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
    '--ft-wall-1': t.wall[0], '--ft-wall-2': t.wall[1], '--ft-wall-3': t.wall[2], '--ft-wall-4': t.wall[3],
    '--ft-scheme': theme,
  };
  palette.tiles.forEach((c, i) => {
    vars[`--ft-tile-${i + 1}`] = c;
    vars[`--ft-on-tile-${i + 1}`] = onColor(c, '#101114');
  });
  return vars;
}

// One stylesheet for every palette × theme, keyed by attributes on any element (the lab scope,
// or a nested <Scope> that compares palettes side by side).
export function paletteCss() {
  let css = '';
  for (const p of PALETTES) for (const theme of ['light', 'dark']) {
    const body = Object.entries(paletteVars(p, theme)).map(([k, v]) => `${k}:${v}`).join(';');
    css += `[data-ft-palette="${p.id}"][data-ft-theme="${theme}"]{${body};color-scheme:${theme}}\n`;
  }
  return css;
}
