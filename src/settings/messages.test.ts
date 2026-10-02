import { describe, expect, it } from 'vitest';
import { translate, type MessageKey, type Params } from '../i18n';
import { describeRefusal } from './messages';

const inLanguage = (language: 'en' | 'fr') => (key: MessageKey, params?: Params) => translate(language, key, params);

describe('Rust refusals in the Settings window', () => {
  it('says a chord held by another app in the interface language', () => {
    expect(describeRefusal('Le raccourci est déjà utilisé ou indisponible.', inLanguage('en'))).toBe('Another app already uses this shortcut, or Windows refused it. Choose another one.');
    expect(describeRefusal('Le raccourci est déjà utilisé ou indisponible.', inLanguage('fr'))).toBe('Une autre application utilise déjà ce raccourci, ou Windows l’a refusé. Choisissez-en un autre.');
    expect(describeRefusal('Deux raccourcis actifs utilisent la même combinaison.', inLanguage('en'))).toBe('Another Overtype shortcut already uses this combination.');
  });
  it('keeps any other message as Rust wrote it', () => {
    expect(describeRefusal('Configurez entre 1 et 12 raccourcis.', inLanguage('en'))).toBe('Configurez entre 1 et 12 raccourcis.');
  });
});
