import type { MessageKey } from '../i18n';
import { settingsPages, type Settings, type SettingsPage } from '../types';

// The pages of the Settings window, in sidebar order (design-lab/reglages/src/settings/
// SettingsWindow.jsx). « After replacing » exists only in the Îlot journey; « Diagnostic » only
// once revealed (Ctrl+Shift+M, or five clicks on the version).
export const allPages = settingsPages;
export type PageId = SettingsPage;
export const isPage = (value: unknown): value is PageId => (allPages as readonly unknown[]).includes(value);

export function visiblePages(settings: Pick<Settings, 'uiVersion'>, diagnostics: boolean): PageId[] {
  return allPages.filter(
    (page) => (page !== 'after' || settings.uiVersion === 'ilot') && (page !== 'diagnostic' || diagnostics),
  );
}
export const pageTitle = (page: PageId): MessageKey => `nav.${page}`;
export const pageAbout = (page: PageId): MessageKey => `page.${page}.about`;

// The page a hidden or removed one falls back to.
export function pageOr(page: PageId, pages: readonly PageId[]): PageId {
  return pages.includes(page) ? page : pages.includes('general') ? 'general' : pages[0];
}
// The page asked for when the window opened (`?window=settings&page=…`).
export function pageFromLocation(search: string): PageId | null {
  const page = new URLSearchParams(search).get('page');
  return isPage(page) ? page : null;
}

// Ctrl+Shift+M toggles the Diagnostic page (« un truc que personne ne ferait »). The key that
// WRITES « m » counts, wherever the layout puts it (on AZERTY it is not the physical KeyM), and
// so does the physical KeyM (a layout without that letter; keys injected by a remote keyboard
// carry no code at all). Alt is left out (Ctrl+Alt is AltGr on many layouts), and a held key
// does not flip it back and forth.
export function isDiagnosticsChord(
  event: Pick<KeyboardEvent, 'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey' | 'code' | 'key' | 'repeat'>,
): boolean {
  return (
    event.ctrlKey &&
    event.shiftKey &&
    !event.altKey &&
    !event.metaKey &&
    (event.key.toLowerCase() === 'm' || event.code === 'KeyM') &&
    !event.repeat
  );
}

// Five clicks on the version, each within 700 ms of the previous one, reveal the Diagnostic too.
// Returns the run so far and whether this click completed it (the run then starts over).
export const secretClicks = 5;
export const secretGapMs = 700;
export type ClickRun = { count: number; at: number };
export function clickRun(previous: ClickRun, now: number): { run: ClickRun; fired: boolean } {
  const count = now - previous.at < secretGapMs ? previous.count + 1 : 1;
  return count >= secretClicks ? { run: { count: 0, at: 0 }, fired: true } : { run: { count, at: now }, fired: false };
}

// Whether the Diagnostic stays revealed from one opening to the next: a per-device convenience
// kept in the WebView's storage (never anything private); absent storage means hidden.
const storageKey = 'flowtranslate.settings.diagnostics';
export function loadDiagnosticsShown(): boolean {
  try {
    return window.localStorage.getItem(storageKey) === '1';
  } catch {
    return false;
  }
}
export function saveDiagnosticsShown(shown: boolean) {
  try {
    if (shown) window.localStorage.setItem(storageKey, '1');
    else window.localStorage.removeItem(storageKey);
  } catch {
    /* storage unavailable: shown for this opening only */
  }
}
