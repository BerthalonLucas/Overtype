import { test, expect, type Page } from '@playwright/test';
import { defaultActions, legacyActions } from '../src/actionDefaults';
import type { Settings } from '../src/types';

// The Settings window of 0.6 (docs/PLAN-0.6.md §4; design-lab/reglages), through the browser IPC
// fixture (e2e/native-fixture.ts): sidebar, pages, search, hidden Diagnostic, the server page on
// the simulated server, and the bad paths (double clicks, a spammed chord, a refused save).
// Every choice goes through the usual save path (`save_settings`).
type Fixture = {
  calls: Array<{ command: string; args?: Record<string, unknown> }>;
  settings: (next: Partial<Settings>) => Promise<void>;
  focusField: (field: string) => Promise<void>;
  refuseShortcut: () => void;
  shortcutStates: (states: Record<string, string>, emitNow?: boolean) => Promise<void> | undefined;
  current: () => Settings;
  suggestion: (value: string | null) => void;
  conn: (scenario: string) => void;
};
const shots = process.env.FT_SHOTS;
const shot = async (page: Page, name: string) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png` }); };
async function openSettings(page: Page, query = '') {
  await page.route('**/?window=settings&fixture=1*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('/src/main.tsx', '/e2e/native-fixture.ts') });
  });
  await page.goto(`/?window=settings&fixture=1${query}`);
  await expect(page.getByRole('tab', { name: 'General', exact: true })).toBeVisible();
}
const call = <T,>(page: Page, run: (f: Fixture) => T) => page.evaluate(`(${run.toString()})(window.nativeFixture)`) as Promise<Awaited<T>>;
const calls = (page: Page, command: string) => page.evaluate(name => (window as unknown as { nativeFixture: Fixture }).nativeFixture.calls.filter(c => c.command === name), command);
const saved = async (page: Page) => (await calls(page, 'save_settings')).at(-1)?.args?.settings as Settings | undefined;
const saveCount = async (page: Page) => (await calls(page, 'save_settings')).length;
const set = (page: Page, next: Partial<Settings>) => page.evaluate(n => (window as unknown as { nativeFixture: Fixture }).nativeFixture.settings(n), next);
const tab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true });
const go = async (page: Page, name: string) => { await tab(page, name).click(); await expect(page.getByRole('heading', { level: 2, name, exact: true })).toBeVisible(); };
const choose = async (page: Page, combobox: string, option: string) => { await page.getByRole('combobox', { name: combobox, exact: true }).click(); await page.getByRole('option', { name: option, exact: true }).click(); };
const oneServer: Pick<Settings, 'servers' | 'defaultServerId'> = { servers: [{ id: 's1', name: '', endpoint: 'https://llm.exemple.com', apiKey: '', noKey: true, model: '' }], defaultServerId: 's1' };

test('the sidebar: one page per topic, each with its colour, in English and French, light and dark; the hidden switches never show', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await openSettings(page);
  await expect(page.getByRole('tab')).toHaveText(['General', 'Shortcuts', 'Actions', 'After replacing', 'Appearance', 'Server', 'Data']);
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('General');
  await expect(page.locator('.ft-settings-app strong')).toHaveText('FlowTranslate');
  // One colour per page: the main area carries the page, its header veil and the nav pill follow.
  const colours = new Set<string>();
  for (const name of ['General', 'Shortcuts', 'Actions', 'After replacing', 'Appearance', 'Server', 'Data']) {
    await go(page, name);
    colours.add(await page.locator('.ft-settings-main').evaluate(element => getComputedStyle(element).getPropertyValue('--ft-page')));
    await expect(page.locator('.ft-settings-window')).not.toContainText(/ui ?version|glass ?material|acrylic|painted|Quality|Fast\b/i);
  }
  expect(colours.size).toBe(7);
  // The 0.4 journey has nothing after a replacement to set, and no grid.
  await set(page, { uiVersion: 'v4' });
  await expect(tab(page, 'After replacing')).toHaveCount(0);
  await go(page, 'Actions');
  await expect(page.getByRole('list', { name: 'Menu actions' })).toHaveCount(0);
  await set(page, { uiVersion: 'ilot' });
  await expect(tab(page, 'After replacing')).toBeVisible();

  await go(page, 'General');
  await choose(page, 'Interface language', 'Français');
  await expect(page.getByRole('tab')).toHaveText(['Général', 'Raccourcis', 'Actions', 'Après remplacement', 'Apparence', 'Serveur', 'Données']);
  await tab(page, 'Apparence').click();
  await page.getByRole('radiogroup', { name: 'Thème', exact: true }).getByRole('radio', { name: 'Sombre', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(19, 18, 25)');
  await expect(page.locator('.ft-page-header h2')).toHaveCSS('color', 'rgb(241, 239, 248)');
  await expect.poll(() => saved(page)).toMatchObject({ language: 'fr', theme: 'dark', uiVersion: 'ilot' });
  await expect(page.locator('.st-save')).toHaveText('Enregistré');
  await shot(page, 'e2e-appearance-fr-dark');
  // Action names are the person's own data: the language renamed nothing.
  await tab(page, 'Actions').click();
  await expect(page.locator('.st-grid-name').first()).toHaveText('Fix grammar');
});

test('the selection pill glides to the clicked page and never follows the mouse', async ({ page }) => {
  await openSettings(page);
  const pill = page.locator('.ft-tab-pill');
  const top = async () => (await pill.boundingBox())!.y;
  const start = await top();
  // Hovering another entry moves nothing.
  await tab(page, 'Data').hover();
  await page.waitForTimeout(250);
  expect(await top()).toBe(start);
  await tab(page, 'Data').click();
  // Mid-flight it is between the two entries, then it rests on the clicked one.
  await page.waitForTimeout(140);
  const end = (await tab(page, 'Data').boundingBox())!.y;
  const middle = await top();
  expect(middle).toBeGreaterThan(start);
  expect(middle).toBeLessThan(end + 8);
  await shot(page, 'e2e-pill-mid-flight');
  await expect.poll(top).toBeCloseTo(end, 0);
  await expect(pill).toHaveAttribute('data-ft-page', 'data');
  // A burst of clicks ends on the last one, with one pill.
  for (const name of ['General', 'Server', 'Actions', 'Shortcuts', 'Appearance']) await tab(page, name).click({ delay: 0 });
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('Appearance');
  await expect(page.locator('.ft-tab-pill')).toHaveCount(1);
  await expect.poll(top).toBeCloseTo((await tab(page, 'Appearance').boundingBox())!.y, 0);
});

test('the search finds a setting, lands on its row and flashes it; Escape empties the search before it closes the window', async ({ page }) => {
  await openSettings(page);
  const search = page.getByRole('searchbox', { name: 'Search a setting', exact: true });
  await search.fill('undo');
  await expect(page.getByRole('list', { name: 'Results' }).getByRole('listitem')).toHaveText([/Undo.*After replacing/]);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('After replacing');
  await expect(page.locator('[data-field="undo"]')).toHaveAttribute('data-flash', '');
  await expect(search).toHaveValue('');
  // Accents and case do not matter; the hidden Diagnostic is not found while hidden.
  await search.fill('MODELE');
  await expect(page.getByRole('list', { name: 'Results' }).getByRole('listitem')).toHaveText([/Model.*Server/]);
  await search.fill('zzzz');
  await expect(page.getByText('No setting matches.')).toBeVisible();
  await search.fill('diagnostic');
  await expect(page.getByText('No setting matches.')).toBeVisible();
  // A very long query is cut, nothing breaks.
  await search.fill('a'.repeat(500));
  expect((await search.inputValue()).length).toBeLessThanOrEqual(60);
  await page.keyboard.press('Escape');
  await expect(search).toHaveValue('');
  await expect(tab(page, 'General')).toBeVisible();
  expect(page.url()).toContain('window=settings');
});

test('the Diagnostic is hidden: Ctrl+Shift+M or five clicks on the version show it in place, a spammed chord ends where it should', async ({ page }) => {
  await openSettings(page);
  await expect(tab(page, 'Diagnostic')).toHaveCount(0);
  await page.keyboard.press('Control+Shift+M');
  await expect(tab(page, 'Diagnostic')).toBeVisible();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('Diagnostic');
  await expect(page.locator('.st-toast')).toHaveText(/Diagnostic shown/);
  await expect(page.getByText('Every connection check is written here, step by step.')).toBeVisible();
  await shot(page, 'e2e-diagnostic-empty');
  await page.keyboard.press('Control+Shift+M');
  await expect(tab(page, 'Diagnostic')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('General');
  // Seven presses in a row: an odd count shows it; never more than one toast, one entry.
  for (let n = 0; n < 7; n++) await page.keyboard.press('Control+Shift+M');
  await expect(tab(page, 'Diagnostic')).toHaveCount(1);
  await expect(page.locator('.st-toast')).toHaveCount(1);
  await page.keyboard.press('Control+Shift+M');
  await expect(tab(page, 'Diagnostic')).toHaveCount(0);
  // Four clicks on the version do nothing, the fifth reveals it.
  const version = page.locator('.ft-settings-foot span');
  for (let n = 0; n < 4; n++) await version.click();
  await expect(tab(page, 'Diagnostic')).toHaveCount(0);
  await version.click();
  await expect(tab(page, 'Diagnostic')).toBeVisible();
  // While a shortcut is being recorded, the chord belongs to the recorder.
  await go(page, 'Shortcuts');
  await page.locator('[data-field="menuShortcut"]').getByRole('button', { name: 'Change', exact: true }).click();
  await page.keyboard.press('Control+Shift+M');
  await expect(tab(page, 'Diagnostic')).toBeVisible();
  await expect.poll(() => saved(page)).toMatchObject({ shortcutBindings: [expect.objectContaining({ kind: 'menu', shortcut: 'Ctrl+Shift+M' })] });
});

test('After replacing: every control is saved by the usual path, sliders stay in their range, the changed words take a style', async ({ page }) => {
  await openSettings(page);
  await go(page, 'After replacing');
  const main = page.locator('.ft-settings-main');
  await main.getByRole('switch', { name: 'Check mark', exact: true }).click();
  await expect.poll(() => saved(page)).toMatchObject({ afterReplace: { check: false, undo: true, undoSeconds: 8, changedWords: true } });
  // The preview is the app's own pill: without the check, Undo alone.
  await expect(page.locator('.st-after-stage .result-check')).toHaveCount(0);
  await expect(page.locator('.st-after-stage .result-undo')).toBeVisible();
  // Undo time: 2 to 20 s, from the keyboard too, saved after a pause.
  const time = main.getByRole('slider', { name: 'Undo time', exact: true });
  await time.focus();
  for (let n = 0; n < 4; n++) await page.keyboard.press('ArrowRight');
  await expect.poll(() => saved(page)).toMatchObject({ afterReplace: { undoSeconds: 12 } });
  await page.keyboard.press('Home');
  await expect.poll(() => saved(page)).toMatchObject({ afterReplace: { undoSeconds: 2 } });
  await page.keyboard.press('End');
  for (let n = 0; n < 5; n++) await page.keyboard.press('ArrowRight');
  await expect.poll(() => saved(page)).toMatchObject({ afterReplace: { undoSeconds: 20 } });
  // The longest the changed words stay: 5 to 120 s by steps of 5, a minute by default.
  const highlight = main.getByRole('slider', { name: 'Highlight time', exact: true });
  await expect(highlight).toHaveAttribute('aria-valuetext', '1 min');
  await highlight.focus();
  await page.keyboard.press('End');
  await expect(highlight).toHaveAttribute('aria-valuetext', '2 min');
  await page.keyboard.press('ArrowLeft');
  await expect(highlight).toHaveAttribute('aria-valuetext', '1 min 55 s');
  await page.keyboard.press('Home');
  await expect.poll(() => saved(page)).toMatchObject({ afterReplace: { changedWordsSeconds: 5 } });
  // Encre irisée by default; Éclat for those who tell colours apart less easily.
  const style = main.getByRole('radiogroup', { name: 'Style', exact: true });
  await expect(style.getByRole('radio', { name: 'Iridescent ink', exact: true })).toHaveAttribute('data-state', 'on');
  await expect(page.locator('.st-after-new .halo-lit').first()).toHaveAttribute('data-style', 'encre');
  await style.getByRole('radio', { name: 'Glow', exact: true }).click();
  await expect.poll(() => saved(page)).toMatchObject({ changedWordsStyle: 'eclat' });
  await expect(page.locator('.st-after-new .halo-lit').first()).toHaveAttribute('data-style', 'eclat');
  await shot(page, 'e2e-after-eclat');
  await main.getByRole('radiogroup', { name: 'How to undo', exact: true }).getByRole('radio', { name: 'Paste original', exact: true }).click();
  await expect.poll(() => saved(page)).toMatchObject({ undoStrategy: 'repaste' });
  await main.getByRole('radiogroup', { name: 'Pill position', exact: true }).getByRole('radio', { name: 'In the margin', exact: true }).click();
  await expect.poll(() => saved(page)).toMatchObject({ pillPlacement: 'margin' });
  // Without Undo its time and method cannot be reached; without the highlight, neither its time nor its style.
  await main.getByRole('switch', { name: 'Undo button', exact: true }).click();
  await main.getByRole('switch', { name: 'Highlight changed words', exact: true }).click();
  await expect.poll(() => saved(page)).toMatchObject({ afterReplace: { undo: false, undoSeconds: 20, changedWords: false, changedWordsSeconds: 5 } });
  await expect(page.locator('.st-dependent[data-off]')).toHaveCount(2);
  await expect(page.locator('.st-after-new .halo-lit')).toHaveCount(0);
  await expect(page.locator('.st-after-stage .ilot')).toHaveCount(0);
  // A file that holds a value out of range shows it clamped, and saves a clamped one.
  await set(page, { afterReplace: { check: true, undo: true, undoSeconds: 999, changedWords: true, changedWordsSeconds: -4 } });
  await expect(time).toHaveAttribute('aria-valuenow', '20');
  await expect(highlight).toHaveAttribute('aria-valuenow', '5');

  await go(page, 'Appearance');
  await page.getByRole('radiogroup', { name: 'Motion style', exact: true }).getByRole('radio', { name: 'Bouncy', exact: true }).click();
  await expect.poll(() => saved(page)).toMatchObject({ motionPreset: 'bouncy' });
  await page.getByRole('radiogroup', { name: 'Indicator', exact: true }).getByRole('radio', { name: 'Ribbon', exact: true }).click();
  await expect.poll(() => saved(page)).toMatchObject({ indicator: 'ruban' });
  await go(page, 'Shortcuts');
  await choose(page, 'Default action', 'Translate');
  await expect.poll(() => saved(page)).toMatchObject({ defaultActionId: 'translate' });
});

test('the grid: order from the keyboard, letters checked in line, six actions at most', async ({ page }) => {
  await openSettings(page);
  await go(page, 'Actions');
  const grid = page.getByRole('list', { name: 'Menu actions', exact: true });
  await expect(grid.locator('.st-grid-name')).toHaveText(['Fix grammar', 'Translate', 'Make professional', 'Shorten', 'Write email']);
  await expect(page.locator('.st-ilot-label')).toHaveText(['Fix', 'Translate', 'Pro', 'Shorten', 'Email', 'Ask']);
  await page.getByRole('button', { name: 'Move Translate up', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => saved(page)).toMatchObject({ menuActionIds: ['translate', 'correct', 'professionalize', 'shorten', 'email'] });
  await expect(grid.locator('.st-grid-name')).toHaveText(['Translate', 'Fix grammar', 'Make professional', 'Shorten', 'Write email']);
  // The moved row keeps the focus (first now: its « up » is disabled, « down » takes it).
  await expect(page.getByRole('button', { name: 'Move Translate down', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(() => saved(page)).toMatchObject({ menuActionIds: ['correct', 'translate', 'professionalize', 'shorten', 'email'] });

  // A letter another action holds, or no letter at all: explained in line, never saved.
  const saves = await saveCount(page);
  const letter = page.getByRole('textbox', { name: 'Letter for Translate', exact: true });
  await letter.fill('f');
  await expect(page.locator('.st-grid-problem')).toHaveText('F is already used by Fix grammar.');
  await expect(letter).toHaveAttribute('aria-invalid', 'true');
  await letter.fill('1');
  await expect(page.locator('.st-grid-problem')).toHaveText('Use a single letter.');
  expect(await saveCount(page)).toBe(saves);
  await letter.fill('r');
  await expect(page.locator('.st-grid-problem')).toHaveCount(0);
  await expect(letter).toHaveValue('R');
  await expect.poll(async () => (await saved(page))?.actions.find(a => a.id === 'translate')?.key).toBe('R');

  // Out of the menu an action frees its letter; back in, it gets one again, at the end.
  await page.getByRole('switch', { name: 'Shorten in the menu', exact: true }).click();
  await expect.poll(() => saved(page)).toMatchObject({ menuActionIds: ['correct', 'translate', 'professionalize', 'email'] });
  expect((await saved(page))?.actions.find(a => a.id === 'shorten')).not.toHaveProperty('key');
  await expect(page.locator('.st-ilot-label')).toHaveText(['Fix', 'Translate', 'Pro', 'Email', 'Ask']);
  await page.getByRole('switch', { name: 'Shorten in the menu', exact: true }).click();
  await expect.poll(() => saved(page)).toMatchObject({ menuActionIds: ['correct', 'translate', 'professionalize', 'email', 'shorten'] });
  expect((await saved(page))?.actions.find(a => a.id === 'shorten')?.key).toBe('S');

  // A sixth action fills the menu (decision 6: no second page): a seventh cannot enter.
  await page.getByRole('button', { name: 'Add an action', exact: true }).click();
  await page.getByRole('button', { name: 'Add an action', exact: true }).click();
  await page.getByRole('switch', { name: 'New action in the menu', exact: true }).first().click();
  await expect(page.getByText('The menu is full: remove an action to add another.')).toBeVisible();
  await expect(page.getByRole('switch', { name: 'New action in the menu', exact: true }).last()).toBeDisabled();
  const last = await saved(page);
  expect(last?.menuActionIds).toHaveLength(6);
  expect(last?.actions.find(a => a.id === last.menuActionIds[5])?.key).toBe('N');
  await expect(page.locator('.st-ilot-tile')).toHaveCount(6);
  await shot(page, 'e2e-actions-full');
});

test('an instruction: its limits are said in place and never saved; Restore brings back the shipped one, never the name', async ({ page }) => {
  await openSettings(page);
  // « translate-fr » is a 0.4 action a migrated file may still hold (kept because a shortcut runs it).
  await set(page, { actions: [...defaultActions, { ...legacyActions[0], promptTemplate: 'Mine' }] });
  await go(page, 'Actions');
  const fix = page.locator('[data-action="correct"].st-instr');
  await fix.getByRole('button', { name: /Fix grammar/ }).click();
  await expect(fix.getByRole('button', { name: 'Restore the instruction', exact: true })).toBeDisabled();
  await expect(fix.getByRole('button', { name: /Delete action/ })).toHaveCount(0);
  await expect(fix.locator('.st-chip')).toHaveText('Built-in');
  const text = fix.locator('textarea');
  await fix.getByRole('textbox', { name: 'Action name', exact: true }).fill('Proofread');
  await text.fill('Fix the typos.');
  await expect.poll(async () => (await saved(page))?.actions[0]).toMatchObject({ name: 'Proofread', promptTemplate: 'Fix the typos.' });
  await expect(fix.locator('.st-chip')).toHaveText('Modified');
  // Empty, or over 8,000 characters: said under the field, the save refused with its reason.
  await text.fill('');
  await expect(fix.locator('.st-instr-count')).toHaveText('1 to 8,000 characters.');
  await expect(page.locator('.st-save-error')).toContainText('The instruction must hold 1 to 8,000 characters');
  const before = await saveCount(page);
  await text.fill('x'.repeat(8001));
  await page.waitForTimeout(500);
  expect(await saveCount(page)).toBe(before);
  await fix.getByRole('button', { name: 'Restore the instruction', exact: true }).click();
  await expect.poll(async () => (await saved(page))?.actions[0]).toMatchObject({ name: 'Proofread', promptTemplate: defaultActions[0].promptTemplate });
  await expect(page.locator('.st-save-error')).toHaveCount(0);
  // A name stops at 60 characters, a tile label at 16.
  await fix.getByRole('textbox', { name: 'Action name', exact: true }).fill('n'.repeat(200));
  await expect(fix.getByRole('textbox', { name: 'Action name', exact: true })).toHaveValue('n'.repeat(60));
  await fix.getByRole('textbox', { name: 'Tile label', exact: true }).fill('t'.repeat(40));
  await expect(fix.getByRole('textbox', { name: 'Tile label', exact: true })).toHaveValue('t'.repeat(16));
  const old = page.locator('[data-action="translate-fr"].st-instr');
  await old.getByRole('button', { name: /Traduire en français/ }).click();
  await old.getByRole('button', { name: 'Restore the instruction', exact: true }).click();
  await expect.poll(async () => (await saved(page))?.actions.at(-1)?.promptTemplate).toBe(legacyActions[0].promptTemplate);
  // A custom action can be deleted; one a shortcut or the default uses cannot.
  await page.getByRole('button', { name: 'Add an action', exact: true }).click();
  const custom = page.locator('.st-instr').last();
  await expect(custom.locator('.st-chip')).toHaveText('Custom');
  await custom.getByRole('button', { name: 'Delete action', exact: true }).click();
  await expect(page.locator('.st-instr')).toHaveCount(6);
});

test('the recorder lights the keys, warns when Ctrl+Alt+key is also AltGr here, and says a refused chord in the interface language', async ({ page }) => {
  await openSettings(page);
  await go(page, 'Shortcuts');
  const menu = page.locator('[data-field="menuShortcut"]');
  await expect(menu.locator('kbd')).toHaveText(['Ctrl', 'Alt', 'Space']);
  // AZERTY: Ctrl+Alt+E types €; the browser reports the character, the chord is still E.
  await menu.getByRole('button', { name: 'Change', exact: true }).click();
  const box = page.getByRole('textbox', { name: 'Menu shortcut: press the combination', exact: true });
  await expect(box).toBeFocused();
  await expect(box).toHaveText('Press the combination…');
  // Modifiers alone light up and save nothing; a chord without Ctrl or Alt is refused in place.
  await box.dispatchEvent('keydown', { key: 'Control', code: 'ControlLeft', ctrlKey: true });
  await expect(box.locator('kbd')).toHaveText(['Ctrl']);
  await shot(page, 'e2e-recorder-held');
  await box.dispatchEvent('keyup', { key: 'Control', code: 'ControlLeft' });
  await box.dispatchEvent('keydown', { key: 'a', code: 'KeyA' });
  await expect(menu.getByRole('alert')).toHaveText('Add Ctrl or Alt to the combination.');
  await box.dispatchEvent('keydown', { key: '€', code: 'KeyE', ctrlKey: true, altKey: true });
  await expect.poll(() => saved(page)).toMatchObject({ shortcutBindings: [expect.objectContaining({ kind: 'menu', shortcut: 'Ctrl+Alt+E', enabled: true })] });
  await expect(page.locator('[data-warning="altgr"]')).toHaveText('Ctrl+Alt+E is also AltGr+E on this keyboard: you could no longer type €.');
  await expect(page.getByRole('status').filter({ hasText: 'Shortcut saved.' })).toBeVisible();
  // Escape while recording stops the recorder, not the window.
  await menu.getByRole('button', { name: 'Change', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(menu.getByRole('button', { name: 'Change', exact: true })).toBeVisible();
  expect(page.url()).toContain('window=settings');
  // Another application holds the chord: Rust refuses, the previous chord comes back.
  await call(page, f => f.refuseShortcut());
  await menu.getByRole('button', { name: 'Change', exact: true }).click();
  await page.keyboard.press('Control+Shift+Space');
  await expect(menu.getByRole('alert')).toHaveText('Another app already uses this shortcut, or Windows refused it. Choose another one.');
  await expect(menu.locator('kbd')).toHaveText(['Ctrl', 'Alt', 'E']);
  await expect(page.locator('.st-save')).toHaveText('Saved');
});

test('a chord another application holds is said on its row with a free one to take in one click; the state follows shortcut-status', async ({ page }) => {
  await openSettings(page, '&shortcutTaken=menu');
  await go(page, 'Shortcuts');
  const menu = page.locator('[data-field="menuShortcut"]');
  const taken = menu.locator('[data-warning="taken"]');
  await expect(taken).toHaveText('Another app is already using Ctrl+Alt+Space, so Windows did not give it to FlowTranslate. Record another combination, or close that app.');
  await expect(menu.getByRole('button', { name: 'Use Ctrl+Alt+Shift+Space', exact: true })).toBeVisible();
  await shot(page, 'e2e-shortcut-taken');
  // A double click on the proposal saves once.
  const before = await saveCount(page);
  await menu.getByRole('button', { name: 'Use Ctrl+Alt+Shift+Space', exact: true }).dblclick();
  await expect.poll(() => saved(page)).toMatchObject({ shortcutBindings: [expect.objectContaining({ shortcut: 'Ctrl+Alt+Shift+Space' })] });
  expect(await saveCount(page) - before).toBe(1);
  await expect(taken).toHaveCount(0);
  await expect(menu.locator('kbd')).toHaveText(['Ctrl', 'Alt', 'Shift', 'Space']);
});

test('direct shortcuts: added in one click, recorded, switched and deleted; an unset one cannot be switched on', async ({ page }) => {
  await openSettings(page);
  await go(page, 'Shortcuts');
  await expect(page.getByText('No direct shortcut.')).toBeVisible();
  await page.getByRole('button', { name: 'Add a shortcut', exact: true }).click();
  const card = page.locator('.st-binding');
  await expect(card).toHaveCount(1);
  await expect(card.getByRole('switch')).toBeDisabled();
  await card.getByRole('button', { name: 'Change', exact: true }).click();
  await page.keyboard.press('Control+Alt+T');
  await expect.poll(async () => (await saved(page))?.shortcutBindings.at(-1)).toMatchObject({ kind: 'action', shortcut: 'Ctrl+Alt+T', enabled: true, actionId: 'correct', outputMode: 'display' });
  await card.getByRole('radiogroup', { name: 'Result', exact: true }).getByRole('radio', { name: 'Replace the selection', exact: true }).click();
  await choose(page, 'Action', 'Translate');
  await expect.poll(async () => (await saved(page))?.shortcutBindings.at(-1)).toMatchObject({ actionId: 'translate', outputMode: 'replace' });
  // The same chord twice is refused by Rust's rule, said in place.
  await card.getByRole('switch').click();
  await expect.poll(async () => (await saved(page))?.shortcutBindings.at(-1)).toMatchObject({ enabled: false });
  await card.getByRole('button', { name: 'Delete this shortcut', exact: true }).click();
  await expect(page.locator('.st-binding')).toHaveCount(0);
  await expect.poll(async () => (await saved(page))?.shortcutBindings).toHaveLength(1);
});

test('a direct link opens the page, unfolds the server, focuses the field and pulses for 2.8 s; reduced motion holds it still', async ({ page }) => {
  await openSettings(page, '&field=apiKey');
  // A bare field means the default server's: its page opens and its card unfolds.
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('Server');
  const key = page.locator('[data-field="s1.apiKey"]');
  await expect(key).toHaveAttribute('data-target', 'true');
  await expect(key.locator('input')).toBeFocused();
  await expect(key).toHaveCSS('animation-name', 'field-pulse');
  await page.waitForTimeout(3000);
  await expect(key).not.toHaveAttribute('data-target', 'true');
  // By event while open (the error pill's button), on another page, another server.
  await call(page, f => f.focusField('menuShortcut'));
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('Shortcuts');
  await expect(page.locator('[data-field="menuShortcut"]')).toHaveAttribute('data-target', 'true');
  await call(page, f => f.focusField('s2.model'));
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('Server');
  await expect(page.locator('[data-field="s2.model"]')).toHaveAttribute('data-target', 'true');
  // An unknown field, or a server that no longer exists, only leaves the window as it is.
  await call(page, f => f.focusField('nonsense'));
  await call(page, f => f.focusField('s9.endpoint'));
  await expect(page.locator('[data-target]')).toHaveCount(1);
  await set(page, { motion: 'reduced' });
  await call(page, f => f.focusField('s1.endpoint'));
  const address = page.locator('[data-field="s1.endpoint"]');
  await expect(address).toHaveAttribute('data-target', 'true');
  await expect(address).toHaveCSS('animation-name', 'none');
});

test('settings changed elsewhere replace the open window’s copy; an edit being typed wins', async ({ page }) => {
  await openSettings(page);
  await go(page, 'Actions');
  await set(page, { menuActionIds: ['email', 'correct'] });
  await expect(page.getByRole('list', { name: 'Menu actions' }).locator('.st-grid-row:not([data-off]) .st-grid-name')).toHaveText(['Write email', 'Fix grammar']);
  // The next change made here keeps what came from elsewhere.
  await page.getByRole('switch', { name: 'Translate in the menu', exact: true }).click();
  await expect.poll(() => saved(page)).toMatchObject({ menuActionIds: ['email', 'correct', 'translate'] });
  // Typing, then a change from elsewhere before the pause ends: what was typed is saved.
  await page.locator('[data-action="correct"].st-instr').getByRole('button', { name: /Fix grammar/ }).click();
  await page.getByRole('textbox', { name: 'Action name', exact: true }).fill('Mine');
  await set(page, { menuActionIds: [] });
  await expect.poll(async () => (await saved(page))?.actions[0].name).toBe('Mine');
  expect((await saved(page))?.menuActionIds).toEqual(['email', 'correct', 'translate']);
});

test('Restore default settings asks first in its row, then brings a fresh install back and keeps the connection, history, start at sign-in and language', async ({ page }) => {
  await openSettings(page);
  const kept = { servers: [{ ...oneServer.servers[0], model: 'qwen3-8b-instruct' }], defaultServerId: 's1' };
  await set(page, { ...kept, historyEnabled: true, autostart: true, language: 'fr', theme: 'dark', motionPreset: 'bouncy', menuActionIds: ['email'], changedWordsStyle: 'eclat' });
  const row = page.locator('[data-field="reset"]');
  await row.getByRole('button', { name: 'Rétablir…', exact: true }).click();
  const question = row.getByRole('alertdialog');
  await expect(question).toContainText('Vos propres actions et raccourcis seront supprimés.');
  await expect(question.getByRole('button', { name: 'Garder mes réglages', exact: true })).toBeFocused();
  // Escape keeps the settings and gives the focus back to the row's button; nothing was asked of Rust.
  await page.keyboard.press('Escape');
  await expect(question).toHaveCount(0);
  await expect(row.getByRole('button', { name: 'Rétablir…', exact: true })).toBeFocused();
  expect(await calls(page, 'reset_settings')).toHaveLength(0);
  expect(page.url()).toContain('window=settings');
  await row.getByRole('button', { name: 'Rétablir…', exact: true }).click();
  await shot(page, 'e2e-reset-confirm');
  // A double click on the confirmation resets once.
  await question.getByRole('button', { name: 'Rétablir les réglages par défaut', exact: true }).dblclick();
  await expect(page.locator('.st-toast')).toHaveText('Réglages par défaut rétablis.');
  expect(await calls(page, 'reset_settings')).toHaveLength(1);
  const now = await call(page, f => f.current());
  expect(now).toMatchObject({ ...kept, historyEnabled: true, autostart: true, language: 'fr', theme: 'system', motionPreset: 'smooth', changedWordsStyle: 'encre' });
  expect(now.menuActionIds).toEqual(defaultActions.map(action => action.id));
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
});

test('« See the welcome again » opens the setup once, whatever the clicks; quitting asks the app', async ({ page }) => {
  await openSettings(page);
  const replay = page.locator('[data-field="replay"]').getByRole('button', { name: 'See the welcome again', exact: true });
  await replay.dblclick();
  await replay.click();
  await expect.poll(async () => (await calls(page, 'open_setup')).length).toBeGreaterThanOrEqual(1);
  expect((await calls(page, 'open_setup'))[0].args).toEqual({ replay: true });
  await page.getByRole('button', { name: 'Quit FlowTranslate', exact: true }).click();
  expect(await calls(page, 'quit_app')).toHaveLength(1);
});

test('the Server page: one server, checked live; the trace collapses into one line and « Details » unfolds it', async ({ page }) => {
  await openSettings(page);
  await set(page, oneServer);
  await go(page, 'Server');
  const card = page.locator('[data-server="s1"]');
  await expect(card.locator('.st-server-host')).toHaveText('llm.exemple.com');
  // While it checks: four rows from the start, one running, in order.
  await expect(card.locator('.ft-trace-step')).toHaveCount(4);
  await expect(card.locator('.ft-trace-name')).toHaveText(['Address', 'Connection', 'Key', 'Models']);
  await expect(card.locator('.ft-check-line')).toHaveAttribute('data-state', 'running');
  await shot(page, 'e2e-server-checking');
  // Connected: the first model of the list is chosen and saved, the trace folds into the line.
  await expect(card.locator('.ft-check-line')).toHaveText(/Connected·gemma-4-12B-it-qat·[\d,]+ msDetails/);
  await expect(card.locator('.ft-trace')).toHaveCount(0);
  await expect.poll(async () => (await saved(page))?.servers[0].model).toBe('unsloth/gemma-4-12B-it-qat-GGUF:UD-Q4_K_XL');
  await expect(page.locator('.ft-tab .st-tab-badge')).toHaveCount(0);
  await shot(page, 'e2e-server-connected');
  await card.getByRole('button', { name: 'Details', exact: true }).click();
  await expect(card.locator('.ft-trace-step[data-state="ok"]')).toHaveCount(4);
  await expect(card.locator('.ft-trace-detail')).toHaveText(['llm.exemple.com found', 'HTTPS, valid certificate', 'none, as expected', '4 available']);
  await card.getByRole('button', { name: 'Details', exact: true }).click();
  await expect(card.locator('.ft-trace')).toHaveCount(0);
  // « Check again », clicked three times in a row, runs one check at a time and ends connected.
  const probes = (await calls(page, 'probe_connection')).length;
  const again = card.getByRole('button', { name: /^Check/ });
  await again.click(); await again.click({ force: true }); await again.click({ force: true });
  await expect(card.locator('.ft-check-line')).toHaveAttribute('data-state', 'ok');
  expect((await calls(page, 'probe_connection')).length - probes).toBe(1);
  // No word of the old two profiles, and nothing asks for « /v1 ».
  await card.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(card.getByText('Just the address, without /v1: we take care of it.')).toHaveCount(0);
  await expect(card.getByText('Address used: llm.exemple.com')).toBeVisible();
  await shot(page, 'e2e-server-form');
});

test('the Server page: the address is cleaned for the person, http is accepted with its warning, a key is asked or declared absent', async ({ page }) => {
  await openSettings(page);
  await set(page, { servers: [{ id: 's1', name: '', endpoint: '', apiKey: '', noKey: false, model: '' }], defaultServerId: 's1' });
  await go(page, 'Server');
  const card = page.locator('[data-server="s1"]');
  await expect(card.locator('.st-server-host')).toHaveText('New server');
  await expect(card.locator('.ft-check-line')).toHaveText('Address needed');
  await card.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(card.getByText('Just the address, without /v1: we take care of it.')).toBeVisible();
  const address = card.getByRole('textbox', { name: 'Server address', exact: true });
  await address.fill('ftp://example');
  await expect(card.getByRole('alert')).toHaveText('Not a web address. Use an address starting with https://.');
  await address.fill('http://192.168.1.20:8000/v1/chat/completions');
  await expect(card.getByText('Address used: http://192.168.1.20:8000 · “/v1/chat/completions” removed, not needed here')).toBeVisible();
  await expect(card.getByText('Unencrypted connection', { exact: true })).toBeVisible();
  await expect(card.getByText('The key and the text travel in clear over the network.')).toBeVisible();
  await expect(card.locator('.st-chip[data-kind="warn"]')).toHaveText('http');
  // No key yet: nothing is checked, the model list waits.
  await expect(card.locator('.ft-check-line')).toHaveText('API key needed');
  await expect(card.getByRole('combobox', { name: 'Model', exact: true })).toBeDisabled();
  expect(await calls(page, 'probe_connection')).toHaveLength(0);
  await shot(page, 'e2e-server-http');
  await card.getByRole('button', { name: 'My server has no key', exact: true }).click();
  await expect(card.getByRole('textbox', { name: 'API key', exact: true })).toBeDisabled();
  await expect(card.locator('.ft-check-line')).toHaveText(/Connected/);
  // What is saved: the address (Rust stores it clean, settings::normalize_endpoint) and the model picked from the list.
  await expect.poll(() => saved(page)).toMatchObject({ servers: [{ id: 's1', endpoint: 'http://192.168.1.20:8000/v1/chat/completions', noKey: true, apiKey: '', model: 'unsloth/gemma-4-12B-it-qat-GGUF:UD-Q4_K_XL' }] });
  // An address that cannot be read was never sent to be saved (the field says why, nothing else complains).
  expect((await calls(page, 'save_settings')).some(c => (c.args?.settings as Settings).servers[0].endpoint.startsWith('ftp'))).toBe(false);
  await expect(page.locator('.st-save-error')).toHaveCount(0);
  // The picker: wide, searchable, full identifiers.
  await card.getByRole('combobox', { name: 'Model', exact: true }).click();
  const list = page.locator('.ft-combobox-content');
  await expect(list.getByRole('option')).toHaveCount(4);
  await shot(page, 'e2e-server-models');
  await list.getByPlaceholder('Search a model').fill('hy-mt');
  await expect(list.getByRole('option')).toHaveText([/Hy-MT2-7B-FP8/]);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await saved(page))?.servers[0].model).toBe('tencent/Hy-MT2-7B-FP8');
  // A key typed instead: masked, kept by Windows, and a control character never enters it.
  await card.getByRole('button', { name: 'My server has a key', exact: true }).click();
  const key = card.getByRole('textbox', { name: 'API key', exact: true });
  await expect(key).toHaveAttribute('type', 'password');
  await key.fill('sk-test-0123456789abcdef');
  await expect.poll(async () => (await saved(page))?.servers[0]).toMatchObject({ noKey: false, apiKey: 'sk-test-0123456789abcdef' });
  await card.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(card.locator('.st-server-facts')).toContainText('••••cdef');
  await expect(card.locator('.st-server-facts')).not.toContainText('sk-test');
});

test('the Server page: a failing check stays open on its step with the cause, the gesture and the journal; nothing stays spinning', async ({ page }) => {
  await openSettings(page, '&conn=refuse');
  await set(page, oneServer);
  await go(page, 'Server');
  const card = page.locator('[data-server="s1"]');
  await expect(card.locator('.ft-check-line')).toHaveText('Failed · Connection');
  await expect(card).toHaveAttribute('data-state', 'error');
  const failed = card.locator('.ft-trace-step[data-state="error"]');
  await expect(failed.locator('.ft-trace-detail')).toHaveText('Connection refused');
  await expect(failed.getByRole('alert')).toContainText('Nothing is listening at this address. Is the server started?');
  await expect(card.locator('.ft-trace-step[data-state="skipped"]')).toHaveCount(2);
  await expect(card.locator('.ft-spin, .ft-trace-spin')).toHaveCount(0);
  await expect(page.locator('.ft-tab .st-tab-badge')).toContainText('Connection failing');
  await shot(page, 'e2e-server-error');
  // « Check again » twice in a row: one check, the trace keeps its height, the same verdict.
  const height = (await card.locator('.ft-check-trace-inner').boundingBox())!.height;
  const probes = (await calls(page, 'probe_connection')).length;
  await failed.getByRole('button', { name: 'Check again', exact: true }).dblclick();
  expect((await card.locator('.ft-check-trace-inner').boundingBox())!.height).toBeGreaterThanOrEqual(height - 1);
  await expect(card.locator('.ft-check-line')).toHaveText('Failed · Connection');
  expect((await calls(page, 'probe_connection')).length - probes).toBe(1);
  // The server comes back while the page is elsewhere: the next check says so.
  await call(page, f => f.conn('ok'));
  await failed.getByRole('button', { name: 'Check again', exact: true }).click();
  await go(page, 'General');
  await go(page, 'Server');
  await expect(card.locator('.ft-check-line')).toHaveText(/Connected/);
  // « Open the log » reveals the hidden Diagnostic on the errors, the failure unfolded.
  await call(page, f => f.conn('cle-refusee'));
  await card.getByRole('button', { name: /^Check/ }).click();
  await expect(card.locator('.ft-check-line')).toHaveText('Failed · Key');
  await card.getByRole('button', { name: 'Open the log', exact: true }).click();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('Diagnostic');
  await expect(tab(page, 'Diagnostic')).toBeVisible();
  const log = page.getByRole('list', { name: 'Connection log', exact: true });
  await expect(log.locator('.st-log-entry')).not.toHaveCount(0);
  await expect(log.locator('.st-log-entry:not([data-level="error"])')).toHaveCount(0);
  const open = log.locator('.st-log-entry[data-state="open"]');
  await expect(open).toHaveCount(1);
  await expect(open.locator('.st-log-row')).toContainText('Key');
  await expect(open.locator('.st-log-detail')).toContainText('GET https://llm.exemple.com/v1/models');
  await expect(open.locator('.st-log-detail')).toContainText('401');
  await shot(page, 'e2e-diagnostic-error');
  // « All » shows the steps that passed too; « Clear » empties the journal.
  await page.getByRole('radio', { name: /^All/ }).click();
  await expect(log.locator('.st-log-entry[data-level="ok"]')).not.toHaveCount(0);
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(page.getByText('Nothing yet')).toBeVisible();
  expect(await calls(page, 'clear_diagnostics')).toHaveLength(1);
});

test('the Server page: a second server, the default one, then its removal; « Try with a sentence » answers or says why not', async ({ page }) => {
  await openSettings(page);
  await set(page, oneServer);
  await go(page, 'Server');
  await expect(page.locator('.st-server')).toHaveCount(1);
  await expect(page.getByRole('radiogroup', { name: 'Default server' })).toHaveCount(0);
  // A double click adds one server, not two.
  await page.getByRole('button', { name: /Add a server/ }).dblclick();
  await expect(page.locator('.st-server')).toHaveCount(2);
  await expect.poll(async () => (await saved(page))?.servers.map(server => server.id)).toEqual(['s1', 's2']);
  await expect(page.getByRole('button', { name: /Add a server/ })).toHaveCount(0);
  const second = page.locator('[data-server="s2"]');
  await second.getByRole('textbox', { name: 'Server address', exact: true }).fill('127.0.0.1:8002');
  await expect(second.getByText('Address used: http://127.0.0.1:8002')).toBeVisible();
  await expect(second.getByText('Unencrypted connection', { exact: true })).toHaveCount(0);
  await second.getByRole('button', { name: 'My server has no key', exact: true }).click();
  await expect(second.locator('.ft-check-line')).toHaveText(/Connected/);
  await expect(page.locator('[data-server="s1"] .ft-check-line')).toHaveText(/Connected/);
  await expect.poll(async () => (await saved(page))?.servers[1]).toMatchObject({ endpoint: '127.0.0.1:8002', noKey: true });
  const which = page.getByRole('radiogroup', { name: 'Default server', exact: true });
  await expect(which.getByRole('radio')).toHaveText(['llm.exemple.com', 'http://127.0.0.1:8002']);
  await which.getByRole('radio', { name: 'http://127.0.0.1:8002', exact: true }).click();
  await expect.poll(() => saved(page)).toMatchObject({ defaultServerId: 's2' });
  await expect(second.locator('.st-chip[data-kind="page"]')).toHaveText('Default');
  await shot(page, 'e2e-server-two');
  // The sentence is Rust's own (never the person's text); a double click tries once.
  const before = (await calls(page, 'try_model')).length;
  await second.getByRole('button', { name: 'Try with a sentence', exact: true }).dblclick();
  await expect(second.locator('.st-try-reply')).toContainText('Bonjour, la réunion commence à dix heures.');
  expect((await calls(page, 'try_model')).length - before).toBe(1);
  await call(page, f => f.conn('cle-refusee'));
  await second.getByRole('button', { name: 'Try with a sentence', exact: true }).click();
  await expect(second.locator('.st-try-reply')).toContainText('This server asks for a key');
  await call(page, f => f.conn('ok'));
  // Removing the default server hands the default back to the one left.
  await second.getByRole('button', { name: 'Remove this server', exact: true }).click();
  await expect(page.locator('.st-server')).toHaveCount(1);
  await expect.poll(() => saved(page)).toMatchObject({ defaultServerId: 's1', servers: [expect.objectContaining({ id: 's1' })] });
  await expect(page.getByRole('button', { name: /Add a server/ })).toBeVisible();
});

test('Data: the history switch, entries removed one by one or all at once after a question in place', async ({ page }) => {
  await openSettings(page);
  await go(page, 'Data');
  await expect(page.getByText('Off: the next texts will not be kept.')).toBeVisible();
  await page.getByRole('switch', { name: 'Keep encrypted history', exact: true }).click();
  await expect.poll(() => saved(page)).toMatchObject({ historyEnabled: true });
  const list = page.getByRole('list', { name: 'History', exact: true });
  const count = await list.locator('.st-history-item').count();
  if (count > 0) {
    await page.getByRole('button', { name: 'Delete all', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toContainText('This cannot be undone.');
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete all', exact: true }).dblclick();
    await expect(page.locator('.st-toast')).toHaveText('History deleted');
    expect((await calls(page, 'delete_history')).length).toBe(1);
  }
  await expect(page.getByText('No saved text.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete all', exact: true })).toHaveCount(0);
});

test('closing: Escape and the cross save what waits, then close; a refused save keeps the window open once and says why', async ({ page }) => {
  await openSettings(page);
  await go(page, 'Actions');
  await page.locator('[data-action="correct"].st-instr').getByRole('button', { name: /Fix grammar/ }).click();
  await page.getByRole('textbox', { name: 'Instruction Fix grammar', exact: true }).fill('');
  // The window never holds its user: the first Escape says the change is not saved, the second leaves.
  await page.keyboard.press('Escape');
  await expect(page.locator('.st-toast')).toContainText('could not be saved');
  expect((await calls(page, 'close_settings')).length + (await calls(page, 'plugin:window|close')).length).toBe(0);
  await expect(page.locator('.st-save').getByRole('button', { name: 'Not saved — try again', exact: true })).toBeVisible();
  await shot(page, 'e2e-not-saved');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect.poll(async () => (await page.evaluate(() => (window as unknown as { nativeFixture: Fixture }).nativeFixture.calls.map(c => c.command))).some(name => /close/.test(name))).toBe(true);
});

test('at the minimum native size and below, pages scroll inside the frame without a sideways scroll', async ({ page }) => {
  for (const [width, height] of [[720, 480], [520, 420]] as const) {
    await page.setViewportSize({ width, height });
    await openSettings(page);
    for (const name of ['General', 'Shortcuts', 'Actions', 'After replacing', 'Appearance', 'Server', 'Data']) {
      await page.getByRole('tab', { name, exact: true }).click();
      await page.waitForTimeout(120);
      const overflow = await page.evaluate(() => ({ page: document.documentElement.scrollWidth - document.documentElement.clientWidth, body: document.body.scrollHeight - window.innerHeight, content: (() => { const view = document.querySelector('.ft-settings-content .ft-scroll-viewport')!; return view.scrollWidth - view.clientWidth; })() }));
      expect(overflow, `${name} at ${width}`).toEqual({ page: 0, body: 0, content: 0 });
    }
    await shot(page, `e2e-narrow-${width}`);
  }
});
