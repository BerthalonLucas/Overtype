import { describe, expect, it } from 'vitest';
import { defaultActionId, defaultActions, defaultBindings, defaultMenuActionIds } from '../actionDefaults';
import type { Settings } from '../types';
import { canContinue, connectionOf, createNavLock, defaultServer, direction, directActionId, isQuestion, isSetupStep, nextStep, ownsKey, previousStep, primaryBinding, setupQuestions, setupSteps, shortcutChoice, stepPage, withConnection, withShortcut, withShortcutChoice } from './model';

const settings = (patch: Partial<Settings> = {}): Settings => ({
  defaultActionId, actions: structuredClone(defaultActions), shortcutBindings: structuredClone(defaultBindings), historyEnabled: false, autostart: false, textSize: 'normal', autoClose: 'normal', uiVersion: 'ilot',
  language: 'fr', theme: 'system', motion: 'system', motionPreset: 'smooth', indicator: 'perle', afterReplace: { check: true, undo: true, undoSeconds: 8, changedWords: true, changedWordsSeconds: 60 },
  undoStrategy: 'keystroke', pillPlacement: 'below', glassMaterial: 'painted', menuActionIds: [...defaultMenuActionIds],
  servers: [{ id: 's1', name: '', endpoint: '', apiKey: '', noKey: false, model: '' }], defaultServerId: 's1', setupDone: false, changedWordsStyle: 'encre', ...patch,
});

describe('the order of the setup', () => {
  it('goes welcome, three questions, the demo, then ready', () => {
    expect(setupSteps).toEqual(['welcome', 'appearance', 'shortcut', 'model', 'demo', 'ready']);
    expect(setupQuestions).toEqual(['appearance', 'shortcut', 'model', 'demo']);
    expect(setupSteps.map(nextStep)).toEqual(['appearance', 'shortcut', 'model', 'demo', 'ready', 'ready']);
    expect(isQuestion('welcome')).toBe(false);
    expect(isQuestion('model')).toBe(true);
    expect(isSetupStep('ready')).toBe(true);
    expect(isSetupStep('tour')).toBe(false);
    expect(isSetupStep(null)).toBe(false);
  });
  it('goes back one screen, never before the welcome nor out of « ready »', () => {
    expect(previousStep('welcome')).toBe('welcome');
    expect(previousStep('appearance')).toBe('welcome');
    expect(previousStep('demo')).toBe('model');
    expect(previousStep('ready')).toBe('ready');
    expect(direction('welcome', 'model')).toBe(1);
    expect(direction('ready', 'shortcut')).toBe(-1);
  });
  it('waits only on the model, for a verified one', () => {
    for (const step of setupSteps) expect(canContinue(step, true)).toBe(true);
    expect(canContinue('model', false)).toBe(false);
    expect(canContinue('shortcut', false)).toBe(true);
  });
  it('gives each screen the colour of its topic', () => {
    expect(stepPage).toEqual({ welcome: 'general', appearance: 'appearance', shortcut: 'shortcuts', model: 'server', demo: 'actions', ready: 'general' });
  });
});

describe('the navigation lock', () => {
  it('lets one step through, then refuses for 300 ms: a double click or a held Enter moves once', () => {
    let now = 1000;
    const lock = createNavLock(() => now);
    expect(lock.locked()).toBe(false);
    expect(lock.locked()).toBe(true);
    now += 299;
    expect(lock.locked()).toBe(true);
    now += 1;
    expect(lock.locked()).toBe(false);
    // Ten presses in the same instant: one step.
    now += 1000;
    expect(Array.from({ length: 10 }, () => lock.locked()).filter(refused => !refused)).toHaveLength(1);
  });
  it('can be released (the demo ended, the next screen is taken at once)', () => {
    let now = 0;
    const lock = createNavLock(() => now);
    lock.locked();
    lock.release();
    expect(lock.locked()).toBe(false);
  });
});

describe('the shortcut', () => {
  it('is the menu binding, even once turned into a direct action', () => {
    const fresh = settings();
    expect(primaryBinding(fresh)?.id).toBe('menu');
    expect(shortcutChoice(fresh)).toBe('menu');
    const direct = withShortcutChoice(fresh, 'direct', 'translate');
    expect(direct.shortcutBindings).toEqual([{ id: 'menu', kind: 'action', shortcut: 'Ctrl+Alt+Space', actionId: 'translate', outputMode: 'replace', enabled: true }]);
    expect(primaryBinding(direct)?.id).toBe('menu');
    expect(shortcutChoice(direct)).toBe('direct');
    expect(directActionId(direct)).toBe('translate');
    expect(withShortcutChoice(direct, 'menu').shortcutBindings[0]).toMatchObject({ kind: 'menu', actionId: defaultActionId });
  });
  it('never runs an action that does not exist', () => {
    const direct = withShortcutChoice(settings(), 'direct', 'gone');
    expect(direct.shortcutBindings[0].actionId).toBe(defaultActionId);
    expect(directActionId({ ...direct, shortcutBindings: [{ ...direct.shortcutBindings[0], actionId: 'gone' }] })).toBe(defaultActionId);
  });
  it('records a chord on its binding, enabling it, or adds a menu binding when there is none', () => {
    const disabled = settings({ shortcutBindings: [{ ...defaultBindings[0], enabled: false }] });
    expect(withShortcut(disabled, 'Ctrl+Alt+K').shortcutBindings).toEqual([{ ...defaultBindings[0], shortcut: 'Ctrl+Alt+K', enabled: true }]);
    const none = settings({ shortcutBindings: [{ id: 'primary', kind: 'action', shortcut: 'Ctrl+Alt+T', actionId: 'correct', outputMode: 'display', enabled: true }] });
    expect(primaryBinding(none)).toBeUndefined();
    const added = withShortcut(none, 'Ctrl+Alt+Space').shortcutBindings;
    expect(added).toHaveLength(2);
    expect(added[1]).toEqual({ id: 'menu', kind: 'menu', shortcut: 'Ctrl+Alt+Space', actionId: defaultActionId, outputMode: 'replace', enabled: true });
    expect(withShortcutChoice(none, 'direct')).toBe(none);
  });
});

describe('the model', () => {
  it('reads and writes the default server only', () => {
    const two = settings({ servers: [{ id: 's1', name: '', endpoint: 'https://a.example', apiKey: 'k1', noKey: false, model: 'm1' }, { id: 's2', name: '', endpoint: 'http://127.0.0.1:8002', apiKey: '', noKey: true, model: 'm2' }], defaultServerId: 's2' });
    expect(defaultServer(two)?.id).toBe('s2');
    expect(connectionOf(two)).toEqual({ endpoint: 'http://127.0.0.1:8002', apiKey: '', noKey: true, model: 'm2' });
    const next = withConnection(two, { endpoint: 'https://b.example', apiKey: 'k2', noKey: false, model: 'm3' });
    expect(next.servers[0]).toEqual(two.servers[0]);
    expect(next.servers[1]).toEqual({ id: 's2', name: '', endpoint: 'https://b.example', apiKey: 'k2', noKey: false, model: 'm3' });
    expect(next.defaultServerId).toBe('s2');
  });
  it('drops the key of a server without one, and survives a broken list', () => {
    expect(withConnection(settings(), { endpoint: 'https://a.example', apiKey: 'secret', noKey: true, model: 'm' }).servers[0]).toMatchObject({ apiKey: '', noKey: true });
    const lost = settings({ defaultServerId: 'gone' });
    expect(defaultServer(lost)?.id).toBe('s1');
    expect(withConnection(lost, { endpoint: 'https://a.example', apiKey: '', noKey: true, model: 'm' }).defaultServerId).toBe('s1');
    const empty = settings({ servers: [] });
    expect(connectionOf(empty)).toEqual({ endpoint: '', apiKey: '', noKey: false, model: '' });
    expect(withConnection(empty, { endpoint: 'https://a.example', apiKey: 'k', noKey: false, model: 'm' })).toMatchObject({ defaultServerId: 's1', servers: [{ id: 's1', endpoint: 'https://a.example', apiKey: 'k', model: 'm' }] });
  });
});

describe('Enter and Escape', () => {
  const element = (html: string, selector: string) => { const host = document.createElement('div'); host.innerHTML = html; document.body.append(host); return host.querySelector(selector); };
  it('belong to an open list, a dialog or the shortcut recorder', () => {
    expect(ownsKey(element('<div role="listbox"><span id="x"></span></div>', '#x'), 'Escape')).toBe(true);
    expect(ownsKey(element('<div role="dialog"><input id="x"></div>', '#x'), 'Enter')).toBe(true);
    expect(ownsKey(element('<div data-recording=""><i id="x"></i></div>', '#x'), 'Escape')).toBe(true);
    expect(ownsKey(element('<div data-radix-popper-content-wrapper=""><i id="x"></i></div>', '#x'), 'Enter')).toBe(true);
  });
  it('leave Enter to a button, and Escape to the setup everywhere else', () => {
    expect(ownsKey(element('<button id="x"></button>', '#x'), 'Enter')).toBe(true);
    expect(ownsKey(element('<button id="x"></button>', '#x'), 'Escape')).toBe(false);
    // Enter in a text field presses the big button (the address, the key).
    expect(ownsKey(element('<input id="x">', '#x'), 'Enter')).toBe(false);
    expect(ownsKey(element('<h1 id="x"></h1>', '#x'), 'Enter')).toBe(false);
    expect(ownsKey(null, 'Enter')).toBe(false);
  });
});
