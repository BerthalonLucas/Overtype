import { describe, expect, it } from 'vitest';
import { localizeDefaults, withLanguage, defaultActionId, defaultActions, defaultBindings, defaultMenuActionIds, isCurrentDefault, legacyActions, newActionTemplate, outputRules, promptError, shippedInstruction } from './actionDefaults';
import actionsRs from '../src-tauri/src/actions.rs?raw';

describe('editable instructions', () => {
  it('accepts each preset, the new-action template and any plain instruction', () => {
    for (const action of defaultActions) {
      expect(promptError(action.promptTemplate)).toBeNull();
      expect(action.promptTemplate.endsWith(outputRules)).toBe(true);
      expect(action.promptTemplate).not.toContain('{{');
    }
    expect(promptError(newActionTemplate)).toBeNull();
    expect(promptError('Corrige sans changer la langue.')).toBeNull();
  });
  it('names both languages in the one translation preset (French ↔ English)', () => {
    const translate = defaultActions.find(a => a.id === 'translate')?.promptTemplate;
    expect(translate).toContain('If the text is in French, translate it into English; otherwise translate it into French.');
  });
  it('mirrors the fresh install of Rust: five actions of the grid, one menu shortcut', () => {
    expect(defaultActions.map(a => [a.id, a.name, a.key, a.shortName, a.icon])).toEqual([
      ['correct', 'Fix grammar', 'F', 'Fix', 'SpellCheck'],
      ['translate', 'Translate', 'T', 'Translate', 'Languages'],
      ['professionalize', 'Make professional', 'P', 'Pro', 'BriefcaseBusiness'],
      ['shorten', 'Shorten', 'S', 'Shorten', 'FoldVertical'],
      ['email', 'Write email', 'E', 'Email', 'Mail'],
    ]);
    expect(defaultMenuActionIds).toEqual(['correct', 'translate', 'professionalize', 'shorten', 'email']);
    expect(defaultActionId).toBe('correct');
    expect(defaultBindings).toEqual([{ id: 'menu', kind: 'menu', shortcut: 'Ctrl+Alt+Space', actionId: 'correct', outputMode: 'replace', enabled: true }]);
  });
  // Lot 13: « Restore » had vanished for the 0.4 actions a migrated file keeps (translate-fr).
  it('restores the instruction each built-in action was shipped with, current or from 0.4', () => {
    expect(legacyActions.map(a => [a.id, a.name])).toEqual([['translate-fr', 'Traduire en français'], ['translate-en', 'Traduire en anglais']]);
    for (const action of legacyActions) { expect(promptError(action.promptTemplate)).toBeNull(); expect(action.promptTemplate.endsWith(outputRules)).toBe(true); }
    expect(shippedInstruction('translate-fr')).toContain('Translate the text into French.');
    expect(shippedInstruction('correct')).toBe(defaultActions[0].promptTemplate);
    expect(shippedInstruction('my-own-action')).toBeUndefined();
    expect(['correct', 'translate', 'email', 'translate-fr', 'custom'].map(isCurrentDefault)).toEqual([true, true, true, false, false]);
    // The mirror holds Rust's words (legacy_defaults and DEFAULTS in actions.rs).
    for (const action of [...legacyActions, ...defaultActions]) expect(actionsRs).toContain(action.promptTemplate.slice(0, -outputRules.length).trim());
  });
  it('names the untouched default actions in the interface language, as Rust does, and nothing else', () => {
    const english = structuredClone(defaultActions);
    expect(localizeDefaults(english, 'en')).toBe(english);
    const french = localizeDefaults(english, 'fr');
    expect(french.map(action => [action.name, action.shortName])).toEqual([['Corriger', 'Corriger'], ['Traduire', 'Traduire'], ['Professionnel', 'Pro'], ['Raccourcir', 'Raccourcir'], ['E-mail', 'E-mail']]);
    expect(french.map(action => [action.id, action.key, action.icon, action.promptTemplate])).toEqual(english.map(action => [action.id, action.key, action.icon, action.promptTemplate]));
    expect(localizeDefaults(french, 'fr')).toBe(french);
    // Rust's French names are the same words (DEFAULTS_FR in actions.rs).
    for (const action of french) expect(actionsRs).toContain(`("${action.id}", "${action.name}", "${action.shortName}")`);
    // What the person renamed stays, in either field; a custom action never moves.
    const mine = [{ ...french[0], name: 'Relire' }, { ...french[1], shortName: 'Trad' }, french[2], { id: 'mine', name: 'Corriger', shortName: 'Corriger', promptTemplate: 'x' }];
    const back = localizeDefaults(mine, 'en');
    expect(back.map(action => action.name)).toEqual(['Relire', 'Traduire', 'Make professional', 'Corriger']);
    expect(withLanguage({ language: 'en', actions: english } as never, 'fr')).toMatchObject({ language: 'fr', actions: french });
  });
  it('rejects empty, oversized and null-bearing instructions', () => {
    for (const prompt of ['', '   ', 'a\0b', 'a'.repeat(8001)]) expect(promptError(prompt)).not.toBeNull();
  });
});
