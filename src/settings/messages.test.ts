import { describe, expect, it } from 'vitest';
import errorRs from '../../src-tauri/src/error.rs?raw';
import { languages, rawMessage, translate, type MessageKey, type Params } from '../i18n';
import { errorCodes, settingsRefusalCodes } from '../types';
import { describeProblem, describeRefusal, refusalKey, saveProblem } from './messages';

const inLanguage = (language: 'en' | 'fr') => (key: MessageKey, params?: Params) => translate(language, key, params);

// SettingsRefusal::ALL as src-tauri/src/error.rs writes it, each variant by the snake_case word its
// test's exhaustive match gives it (`settings_name`): the list Rust really sends, read from its source.
const rustSettingsCodes = () => {
  const start = errorRs.indexOf('impl SettingsRefusal {');
  const variants = [...errorRs.slice(start, errorRs.indexOf('];', start)).matchAll(/Self::(\w+)/g)].map((m) => m[1]);
  const names = new Map([...errorRs.matchAll(/SettingsRefusal::(\w+) => "([a-z0-9_]+)"/g)].map((m) => [m[1], m[2]]));
  return variants.map((variant) => names.get(variant) ?? `?${variant}`);
};

describe('Rust refusals in the Settings window and the setup (ARCH-05)', () => {
  it('knows every code of the Settings Rust sends, in its order, and no other', () => {
    const rust = rustSettingsCodes();
    expect(rust.length).toBeGreaterThan(20);
    expect(rust).toEqual([...settingsRefusalCodes]);
  });

  it('never shares a word with the codes of the result: the front reads one `code`', () => {
    for (const code of settingsRefusalCodes) expect(errorCodes as readonly string[], code).not.toContain(code);
  });

  it('gives every code its own text, in English and in French', () => {
    for (const code of settingsRefusalCodes) {
      const key = refusalKey(code);
      expect(key, code).not.toBe('settings.notSaved');
      for (const language of languages) expect(rawMessage(language, key).trim(), `${code} ${language}`).not.toBe('');
    }
  });

  it('says a refusal by its code in the interface language', () => {
    expect(describeRefusal('shortcut_taken', inLanguage('en'))).toBe(
      'Another app already uses this shortcut, or Windows refused it. Choose another one.',
    );
    expect(describeRefusal('shortcut_taken', inLanguage('fr'))).toBe(
      'Une autre application utilise déjà ce raccourci, ou Windows l’a refusé. Choisissez-en un autre.',
    );
    expect(describeRefusal('shortcut_duplicate', inLanguage('en'))).toBe(
      'Another Overtype shortcut already uses this combination.',
    );
    // ARCH-05: the settings file could not be written, said in English under an English interface.
    expect(describeRefusal('storage_failed', inLanguage('en'))).toBe('The settings could not be written. Try again.');
    expect(describeRefusal('shortcuts', inLanguage('en'))).toBe('Keep between 1 and 12 shortcuts.');
  });

  it('says a code it does not know with the window’s generic text, never Rust’s message', () => {
    expect(describeRefusal('teapot', inLanguage('en'))).toBe('Settings were not saved.');
    expect(describeRefusal('internal', inLanguage('fr'))).toBe('Les réglages n’ont pas été enregistrés.');
    expect(describeRefusal('toString', inLanguage('en'))).toBe('Settings were not saved.');
    expect(describeRefusal('teapot', inLanguage('en'), 'setup.notSaved')).toBe('This choice could not be saved.');
  });

  it('reads a rejected save as a problem: its code, the window’s own message, or the fallback', () => {
    expect(
      saveProblem(
        { code: 'shortcut_taken', message: 'Le raccourci est déjà utilisé ou indisponible.' },
        'settings.notSaved',
      ),
    ).toEqual({ code: 'shortcut_taken' });
    expect(saveProblem({ key: 'actions.promptInvalid' }, 'settings.notSaved')).toEqual({
      key: 'actions.promptInvalid',
    });
    for (const reason of [
      { code: 'internal', message: 'État interne indisponible.' },
      { code: 'teapot', message: 'x' },
      'Configurez entre 1 et 12 raccourcis.',
      new Error('x'),
      null,
      undefined,
    ])
      expect(saveProblem(reason, 'setup.notSaved')).toEqual({ key: 'setup.notSaved' });
    expect(describeProblem({ code: 'address' }, inLanguage('en'))).toBe('The server address is invalid.');
    expect(describeProblem({ key: 'settings.notSaved' }, inLanguage('fr'))).toBe(
      'Les réglages n’ont pas été enregistrés.',
    );
  });
});
