// Design tokens, v2: one structure, two neutral bases × two page-colour sets × two themes, all as
// --ft-* custom properties on the element carrying data-ft-palette / data-ft-pageset / data-ft-theme
// (see <Scope> in src/lab/Scope.jsx). Materials (window / floating) live in tokens.css.
import './tokens.css';
import { PALETTES, PALETTE_BY_ID, PAGE_SETS, PAGE_SET_BY_ID, PAGES, TOPIC_PAGE, pageColor, paletteCss } from './palettes.js';

export { PALETTES, PALETTE_BY_ID, PAGE_SETS, PAGE_SET_BY_ID, PAGES, TOPIC_PAGE, pageColor };
export const BASES = PALETTES;

// Kept for v1 code that still reads it: there is only one structure now.
export const DIRECTIONS = [{ id: 'verre', name: 'Verre', note: 'Barre latérale fixe et sobre, rangées groupées en cartes ; fenêtres mates, verre réel pour ce qui flotte.' }];
export const DIRECTION_BY_ID = Object.fromEntries(DIRECTIONS.map(d => [d.id, d]));

export const THEMES = [
  { id: 'light', name: 'Clair' },
  { id: 'dark', name: 'Sombre' },
  { id: 'system', name: 'Système' },
];

// The lab speed: a multiplier on every duration (1 = real speed, 10 = ten times slower).
export const SPEEDS = [
  { id: 1, name: '1×' },
  { id: 2, name: '½×' },
  { id: 4, name: '¼×' },
  { id: 10, name: '⅒×' },
];

// The still-open alternatives (toolbar switches, each with 👍/👎 + note).
export const SWITCH_STYLES = [
  { id: 'ours', name: 'Nos primitives', note: 'Radix, ressort Windows 11 : contour, pastille qui grossit au survol puis file avec un léger dépassement.' },
  { id: 'hero', name: 'HeroUI', note: 'Le vrai interrupteur HeroUI v3 (React Aria), piste pleine et pastille blanche, à nos couleurs.' },
];

// Palette variables for every base × theme and every page colour, injected once.
let injected = false;
export function injectTokens() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const style = document.createElement('style');
  style.id = 'ft-palettes';
  style.textContent = paletteCss();
  document.head.appendChild(style);
}
