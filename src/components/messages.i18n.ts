import type { Language } from '../types';

// Accessible names and small words of the shared controls (src/components/), merged into the
// one dictionary of src/i18n.ts.
export const componentsMessages = {
  'ui.close': { en: 'Close', fr: 'Fermer' },
  'ui.minimize': { en: 'Minimize', fr: 'Réduire' },
  'ui.showKey': { en: 'Show the key', fr: 'Afficher la clé' },
  'ui.hideKey': { en: 'Hide the key', fr: 'Masquer la clé' },
  'ui.choose': { en: 'Choose…', fr: 'Choisir…' },
  'ui.search': { en: 'Search', fr: 'Rechercher' },
  'ui.noResult': { en: 'No result', fr: 'Aucun résultat' },
} satisfies Record<string, Record<Language, string>>;
