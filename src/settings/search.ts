import type { MessageKey, Translate } from '../i18n';
import { pageTitle, type PageId } from './nav';

// Everything the sidebar search can find: the row to land on (its data-field), its title, its
// page, and extra words in both languages (never shown).
type Entry = { field: string; title: MessageKey; page: PageId; words: string };
const entries: Entry[] = [
  {
    field: 'autostart',
    title: 'settings.autostart',
    page: 'general',
    words: 'démarrer windows démarrage start startup boot sign in login',
  },
  {
    field: 'language',
    title: 'page.general.language',
    page: 'general',
    words: 'français english anglais french langue language',
  },
  {
    field: 'update',
    title: 'page.general.updates',
    page: 'general',
    words: 'mise à jour mettre à jour update upgrade nouvelle version installer télécharger download',
  },
  {
    field: 'replay',
    title: 'page.general.replay',
    page: 'general',
    words: 'setup premier lancement bienvenue accueil welcome first run tour demo démo',
  },
  {
    field: 'reset',
    title: 'settings.reset',
    page: 'general',
    words: 'réinitialiser rétablir reset restore default défaut',
  },
  {
    field: 'menuShortcut',
    title: 'settings.menuShortcutField',
    page: 'shortcuts',
    words: 'touches ctrl alt espace clavier keys keyboard space hotkey',
  },
  { field: 'defaultAction', title: 'settings.defaultAction', page: 'shortcuts', words: 'menu' },
  {
    field: 'bindings',
    title: 'shortcuts.title',
    page: 'shortcuts',
    words: 'combinaison touches combination keys hotkey',
  },
  {
    field: 'grid',
    title: 'page.actions.grid',
    page: 'actions',
    words: 'ordre lettres îlot grille tuiles order letters grid tiles menu',
  },
  { field: 'instructions', title: 'actions.instructions', page: 'actions', words: 'prompt instruction consigne' },
  { field: 'placement', title: 'after.placement', page: 'after', words: 'pastille marge pill margin position' },
  { field: 'check', title: 'after.check', page: 'after', words: 'vérifier coche check mark tick' },
  {
    field: 'undo',
    title: 'after.undo',
    page: 'after',
    words: 'durée secondes méthode ctrl+z undo time seconds annuler',
  },
  {
    field: 'changedWords',
    title: 'after.changedWords',
    page: 'after',
    words: 'surlignage mise en valeur lumineux mots modifiés highlight changed words encre irisée éclat glow ink',
  },
  {
    field: 'theme',
    title: 'settings.theme',
    page: 'appearance',
    words: 'clair sombre noir blanc light dark black white',
  },
  {
    field: 'indicator',
    title: 'settings.indicator',
    page: 'appearance',
    words: 'perle nébuleuse ruban chargement nebula ribbon loading spinner',
  },
  {
    field: 'motion',
    title: 'settings.animations',
    page: 'appearance',
    words: 'mouvement réduit reduced motion animation',
  },
  {
    field: 'motionPreset',
    title: 'settings.motionPreset',
    page: 'appearance',
    words: 'fluide rebondi ressort smooth bouncy spring',
  },
  {
    field: 'textSize',
    title: 'settings.textSize',
    page: 'appearance',
    words: 'police lecture font reading bulle bubble',
  },
  { field: 'autoClose', title: 'settings.autoClose', page: 'appearance', words: 'bulle bubble fermer close' },
  {
    field: 'server',
    title: 'conn.address',
    page: 'server',
    words: 'url connexion endpoint connection adresse address host',
  },
  { field: 'server', title: 'conn.key', page: 'server', words: 'key token clé' },
  { field: 'server', title: 'conn.model', page: 'server', words: 'model liste list modèle' },
  {
    field: 'history',
    title: 'page.data.historyKeep',
    page: 'data',
    words: 'effacer supprimer historique history delete clear privacy confidentialité',
  },
];
export const searchLimit = 8;
export const queryMaxLength = 60;
// Lower case, accents dropped: « reglage » finds « Réglage ».
export const fold = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export type SearchResult = { field: string; title: string; page: PageId; pageLabel: string };
export function searchSettings(query: string, t: Translate, pages: readonly PageId[]): SearchResult[] {
  const wanted = fold(query.trim());
  if (!wanted) return [];
  return entries
    .filter((entry) => pages.includes(entry.page))
    .map((entry) => ({
      field: entry.field,
      title: t(entry.title),
      page: entry.page,
      pageLabel: t(pageTitle(entry.page)),
      words: entry.words,
    }))
    .filter((result) => fold(`${result.title} ${result.pageLabel} ${result.words}`).includes(wanted))
    .slice(0, searchLimit)
    .map(({ words: _words, ...result }) => result);
}
