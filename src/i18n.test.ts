import { afterEach, describe, expect, it } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { currentLanguage, languages, messageKeys, setLanguage, t, translate, useT, type MessageKey } from './i18n';

describe('i18n', () => {
  afterEach(() => setLanguage('en'));

  it('speaks English by default and fills parameters', () => {
    expect(currentLanguage()).toBe('en');
    expect(t('glass.copy')).toBe('Copy translation');
    expect(t('menu.rerun', { server: '127.0.0.1:8001' })).toBe('Run again with 127.0.0.1:8001');
    expect(translate('fr', 'settings.connected', { ms: 38 })).toBe('Connecté · 38 ms');
    expect(translate('en', 'settings.historyCountOther', { count: 2 })).toBe('2 entries');
  });

  // A message missing in one language, or a parameter one of them forgets, would show a hole.
  it('has every message in both languages, with the same parameters', () => {
    const params = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
    for (const key of messageKeys) {
      for (const language of languages) expect(translate(language, key).trim(), `${key} (${language})`).not.toBe('');
      expect(params(translate('fr', key)), key).toEqual(params(translate('en', key)));
    }
    // The French wording of 0.4 is kept as it was.
    const kept = ['glass.copy', 'glass.more', 'glass.close', 'menu.showOriginal', 'settings.language', 'settings.theme'] as MessageKey[];
    expect(kept.map(key => translate('fr', key))).toEqual(['Copier la traduction', 'Plus d’options', 'Fermer', 'Afficher l’original', 'Langue', 'Thème']);
  });

  it('switches every mounted label at once, without a reload', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement('div');
    const root = createRoot(host);
    const Label = () => createElement('span', null, useT()('settings.title'));
    await act(async () => root.render(createElement(Label)));
    expect(host.textContent).toBe('Settings');
    await act(async () => setLanguage('fr'));
    expect(host.textContent).toBe('Réglages');
    await act(async () => setLanguage('en'));
    expect(host.textContent).toBe('Settings');
    await act(async () => root.unmount());
  });
});
