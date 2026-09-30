// Design tokens: 3 directions × 6 palettes × 2 themes, all as --ft-* custom properties on the
// element carrying data-ft-dir / data-ft-palette / data-ft-theme (see <Scope> in src/lab/Scope.jsx).
import './directions.css';
import { PALETTES, PALETTE_BY_ID, paletteCss } from './palettes.js';

export { PALETTES, PALETTE_BY_ID };

export const DIRECTIONS = [
  { id: 'verre', name: 'Verre', note: 'Dans la continuité de l’Îlot : verre peint, reflet, ombres douces en couches, fenêtres dépolies, rayons 14–16.' },
  { id: 'mat', name: 'Mat', note: 'Surfaces opaques, aucune ombre dans la fenêtre, filets fins, noir et blanc francs, rayon 8, grands titres gras, rangées groupées façon Windows 11.' },
  { id: 'aerien', name: 'Aérien', note: 'Aéré, rangées sans bordure, grande typo d’affichage, tuiles d’icônes colorées façon Réglages iOS, espacements généreux.' },
];
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

// Palette variables for every palette × theme, injected once.
let injected = false;
export function injectTokens() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const style = document.createElement('style');
  style.id = 'ft-palettes';
  style.textContent = paletteCss();
  document.head.appendChild(style);
}
