import { test, expect, type Page } from '@playwright/test';
import { defaultActions, legacyActions } from '../src/actionDefaults';
import type { Settings } from '../src/types';

// Lot 13 (docs/DA-PLAN.md): the Settings window of the Îlot, through the browser IPC fixture
// (e2e/native-fixture.ts). Every choice goes through the usual save path (`save_settings`);
// the real window is the integrator's to check.
type Fixture = {
  calls: Array<{ command: string; args?: Record<string, unknown> }>;
  settings: (next: Partial<Settings>) => Promise<void>;
  focusField: (field: string) => Promise<void>;
  refuseShortcut: () => void;
  shortcutStates: (states: Record<string, string>, emitNow?: boolean) => Promise<void> | undefined;
  current: () => Settings;
  suggestion: (value: string | null) => void;
};
async function openSettings(page: Page, query = '') {
  await page.route('**/?window=settings&fixture=1*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('/src/main.tsx', '/e2e/native-fixture.ts') });
  });
  await page.goto(`/?window=settings&fixture=1${query}`);
  await expect(page.getByRole('heading', { name: 'Menu', exact: true })).toBeVisible();
}
const call = <T,>(page: Page, run: (f: Fixture) => T) => page.evaluate(`(${run.toString()})(window.nativeFixture)`) as Promise<Awaited<T>>;
const saved = (page: Page) => call(page, f => f.calls.filter(c => c.command === 'save_settings').at(-1)?.args?.settings as Settings | undefined);
const saveCount = (page: Page) => call(page, f => f.calls.filter(c => c.command === 'save_settings').length);
// The fixture starts in the Îlot, as Rust does (the 0.4 journey is asked for, `uiVersion: 'v4'`);
// the test's own settings arrive as Rust sends them, by `settings-changed`.
async function ilot(page: Page, next: Partial<Settings> = {}) {
  await page.evaluate(n => (window as unknown as { nativeFixture: Fixture }).nativeFixture.settings(n), next);
  await expect(page.getByRole('heading', { name: 'After replacing', exact: true })).toBeVisible();
}
const headings = (page: Page, level: 2 | 3) => page.locator(`.settings-body h${level}`).allTextContents();

test('every section of the Îlot, in English and French, light and dark; the hidden switches never show', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await openSettings(page);
  // The Îlot, from the start.
  await ilot(page);
  expect(await headings(page, 2)).toEqual(['Menu', 'Actions', 'After replacing', 'Appearance', 'Result bubble', 'Connection', 'On this device']);
  expect(await headings(page, 3)).toEqual(['In the menu', 'Instructions', 'Direct shortcuts']);
  await expect(page.locator('.settings-body')).not.toContainText(/ui ?version|glass ?material|acrylic|painted/i);
  await page.screenshot({ path: 'test-results/lot13-settings-en-light.png' });
  // The 0.4 journey, asked for (uiVersion « v4 »), has no grid and nothing after a replacement to set.
  await call(page, f => f.settings({ uiVersion: 'v4' }));
  await expect(page.getByRole('heading', { name: 'After replacing', exact: true })).toHaveCount(0);
  expect(await headings(page, 2)).toEqual(['Menu', 'Actions', 'Appearance', 'Result bubble', 'Connection', 'On this device']);
  await expect(page.getByRole('list', { name: 'Menu actions' })).toHaveCount(0);
  await ilot(page, { uiVersion: 'ilot' });

  await page.getByRole('radio', { name: 'Français', exact: true }).click();
  await page.getByRole('radio', { name: 'Sombre', exact: true }).click();
  expect(await headings(page, 2)).toEqual(['Menu', 'Actions', 'Après remplacement', 'Apparence', 'Bulle de résultat', 'Connexion', 'Sur cet appareil']);
  expect(await headings(page, 3)).toEqual(['Dans le menu', 'Consignes', 'Raccourcis directs']);
  await expect(page.getByRole('switch', { name: 'Surligner les mots changés', exact: true })).toBeVisible();
  await expect(page.getByRole('radiogroup', { name: 'Style de mouvement', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(28, 30, 34)');
  await expect(page.locator('.menu-settings .setting-copy strong').first()).toHaveCSS('color', 'rgb(245, 246, 248)');
  await expect.poll(() => saved(page)).toMatchObject({ language: 'fr', theme: 'dark', uiVersion: 'ilot' });
  await page.screenshot({ path: 'test-results/lot13-settings-fr-dark.png' });
  // Action names are user data: the switch renamed nothing.
  await expect(page.locator('.grid-name').first()).toHaveText('Fix grammar');
});

test('After replacing, the motion style and the default action are saved by the usual path', async ({ page }) => {
  await openSettings(page);
  await ilot(page);
  const section = page.locator('.after-settings');
  await section.getByRole('switch', { name: 'Check mark', exact: true }).click();
  await expect.poll(() => saved(page)).toMatchObject({ afterReplace: { check: false, undo: true, undoSeconds: 8, changedWords: true } });
  // The changed words stay until the next action in the text, a minute at most by default.
  const highlight = section.getByRole('radiogroup', { name: 'Highlight time', exact: true });
  await expect(highlight.getByRole('radio', { name: '1 min', exact: true })).toHaveAttribute('data-state', 'on');
  await expect(highlight.getByRole('radio')).toHaveText(['15 s', '30 s', '1 min', '2 min']);
  await highlight.getByRole('radio', { name: '30 s', exact: true }).click();
  await expect.poll(() => saved(page)).toMatchObject({ afterReplace: { changedWords: true, changedWordsSeconds: 30 } });
  await section.getByRole('switch', { name: 'Highlight changed words', exact: true }).click();
  await expect.poll(() => saved(page)).toMatchObject({ afterReplace: { check: false, changedWords: false, changedWordsSeconds: 30 } });
  // Off, its time has nothing to set.
  await expect(highlight).toHaveCount(0);
  // Undo time: 2 to 20 s, from the keyboard too, saved after a pause.
  const time = section.getByRole('slider', { name: 'Undo time', exact: true });
  await time.focus();
  for (let n = 0; n < 4; n++) await page.keyboard.press('ArrowRight');
  await expect(section.locator('output')).toHaveText('12 s');
  await expect.poll(() => saved(page)).toMatchObject({ afterReplace: { undoSeconds: 12 } });
  await page.keyboard.press('Home');
  await expect.poll(() => saved(page)).toMatchObject({ afterReplace: { undoSeconds: 2 } });
  await page.keyboard.press('End');
  await expect.poll(() => saved(page)).toMatchObject({ afterReplace: { undoSeconds: 20 } });
  // Ctrl+Z in the app by default (decision 2), or the original pasted back.
  const method = section.getByRole('radiogroup', { name: 'How to undo', exact: true });
  await expect(method.getByRole('radio', { name: 'Ctrl+Z', exact: true })).toHaveAttribute('data-state', 'on');
  await method.getByRole('radio', { name: 'Paste original', exact: true }).click();
  await expect.poll(() => saved(page)).toMatchObject({ undoStrategy: 'repaste' });
  const position = section.getByRole('radiogroup', { name: 'Pill position', exact: true });
  await expect(position.getByRole('radio', { name: 'Below the text', exact: true })).toHaveAttribute('data-state', 'on');
  await position.getByRole('radio', { name: 'In the margin', exact: true }).click();
  await expect.poll(() => saved(page)).toMatchObject({ pillPlacement: 'margin' });
  // Without Undo, its time and its method have nothing to set.
  await section.getByRole('switch', { name: 'Undo', exact: true }).click();
  await expect.poll(() => saved(page)).toMatchObject({ afterReplace: { undo: false, undoSeconds: 20 } });
  await expect(time).toHaveCount(0);
  await expect(method).toHaveCount(0);

  await page.getByRole('radiogroup', { name: 'Motion style', exact: true }).getByRole('radio', { name: 'Bouncy', exact: true }).click();
  await expect.poll(() => saved(page)).toMatchObject({ motionPreset: 'bouncy' });
  await page.getByRole('combobox', { name: 'Default action', exact: true }).selectOption('translate');
  await expect.poll(() => saved(page)).toMatchObject({ defaultActionId: 'translate' });
});

test('the grid: order from the keyboard, letters checked in line, six actions at most', async ({ page }) => {
  await openSettings(page);
  await ilot(page);
  const grid = page.getByRole('list', { name: 'Menu actions', exact: true });
  await expect(grid.locator('.grid-name')).toHaveText(['Fix grammar', 'Translate', 'Make professional', 'Shorten', 'Write email']);
  await page.getByRole('button', { name: 'Move Translate up', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => saved(page)).toMatchObject({ menuActionIds: ['translate', 'correct', 'professionalize', 'shorten', 'email'] });
  await expect(grid.locator('.grid-name')).toHaveText(['Translate', 'Fix grammar', 'Make professional', 'Shorten', 'Write email']);
  // The moved tile keeps the focus (first now: its « up » is disabled, « down » takes it).
  await expect(page.getByRole('button', { name: 'Move Translate down', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(() => saved(page)).toMatchObject({ menuActionIds: ['correct', 'translate', 'professionalize', 'shorten', 'email'] });
  await expect(page.getByRole('button', { name: 'Move Translate down', exact: true })).toBeFocused();

  // A letter another action holds, or no letter at all: explained in line, never saved.
  const saves = await saveCount(page);
  const letter = page.getByRole('textbox', { name: 'Letter for Translate', exact: true });
  await letter.fill('f');
  await expect(page.locator('.grid-problem')).toHaveText('F is already used by Fix grammar.');
  await expect(letter).toHaveAttribute('aria-invalid', 'true');
  await letter.fill('1');
  await expect(page.locator('.grid-problem')).toHaveText('Use a single letter.');
  expect(await saveCount(page)).toBe(saves);
  await letter.fill('r');
  await expect(page.locator('.grid-problem')).toHaveCount(0);
  await expect(letter).toHaveValue('R');
  await expect.poll(async () => (await saved(page))?.actions.find(a => a.id === 'translate')?.key).toBe('R');

  // Out of the grid an action frees its letter; back in, it gets one again.
  await page.getByRole('button', { name: 'Remove Shorten from the menu', exact: true }).click();
  await expect.poll(() => saved(page)).toMatchObject({ menuActionIds: ['correct', 'translate', 'professionalize', 'email'] });
  expect((await saved(page))?.actions.find(a => a.id === 'shorten')).not.toHaveProperty('key');
  await page.getByRole('combobox', { name: 'Add to the menu' }).selectOption('shorten');
  await expect.poll(() => saved(page)).toMatchObject({ menuActionIds: ['correct', 'translate', 'professionalize', 'email', 'shorten'] });
  expect((await saved(page))?.actions.find(a => a.id === 'shorten')?.key).toBe('S');

  // A sixth action fills the grid (decision 6: no second page).
  await page.getByRole('button', { name: 'Add an action', exact: true }).click();
  await page.getByRole('combobox', { name: 'Add to the menu' }).selectOption({ label: 'New action' });
  await expect(grid.getByRole('listitem')).toHaveCount(6);
  await expect(page.getByText('The menu holds 6 actions. Remove one to add another.')).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Add to the menu' })).toHaveCount(0);
  const last = await saved(page);
  expect(last?.menuActionIds).toHaveLength(6);
  expect(last?.actions.find(a => a.id === last.menuActionIds[5])?.key).toBe('N');
  await page.screenshot({ path: 'test-results/lot13-settings-grid.png' });
});

test('the recorder warns when Ctrl+Alt+key is also AltGr here, and says a taken chord in the interface language', async ({ page }) => {
  await openSettings(page);
  const menu = page.locator('[data-field="menuShortcut"]');
  // AZERTY: Ctrl+Alt+E types €; the browser reports the character, the chord is still E.
  await menu.getByRole('button', { name: 'Change', exact: true }).click();
  await page.getByRole('textbox', { name: 'Menu shortcut', exact: true }).dispatchEvent('keydown', { key: '€', code: 'KeyE', ctrlKey: true, altKey: true });
  await expect.poll(() => saved(page)).toMatchObject({ shortcutBindings: [expect.objectContaining({ kind: 'menu', shortcut: 'Ctrl+Alt+E', enabled: true })] });
  await expect(page.locator('[data-warning="altgr"]')).toHaveText('Ctrl+Alt+E is also AltGr+E on this keyboard: you could no longer type €.');
  await expect(page.getByRole('status').filter({ hasText: 'Shortcut saved.' })).toBeVisible();
  expect(await call(page, f => f.calls.filter(c => c.command === 'shortcut_conflict').map(c => c.args?.shortcut))).toContain('Ctrl+Alt+E');
  await page.getByRole('radio', { name: 'Français', exact: true }).click();
  await expect(page.locator('[data-warning="altgr"]')).toHaveText('Ctrl+Alt+E est aussi AltGr+E sur ce clavier : vous ne pourriez plus taper €.');
  // Back to Ctrl+Alt+Space: no AltGr character, no warning.
  await menu.getByRole('button', { name: 'Modifier', exact: true }).click();
  await page.getByRole('textbox', { name: 'Raccourci du menu', exact: true }).dispatchEvent('keydown', { key: ' ', code: 'Space', ctrlKey: true, altKey: true });
  await expect.poll(() => saved(page)).toMatchObject({ shortcutBindings: [expect.objectContaining({ shortcut: 'Ctrl+Alt+Space' })] });
  await expect(page.locator('[data-warning="altgr"]')).toHaveCount(0);
  // Another application holds the chord: Rust refuses, the window says so in French here.
  await call(page, f => f.refuseShortcut());
  await menu.getByRole('button', { name: 'Modifier', exact: true }).click();
  await page.keyboard.press('Control+Shift+Space');
  await expect(page.getByRole('alert')).toHaveText('Une autre application utilise déjà ce raccourci, ou Windows l’a refusé. Choisissez-en un autre.');
  await expect(menu.locator('.keycaps kbd')).toHaveText(['Ctrl', 'Alt', 'Space']);
  await expect(page.locator('.save-status')).toHaveText('Enregistré');
});

test('a chord another application holds is said on its row, in English and French, without blocking the recorder; the state follows shortcut-status', async ({ page }) => {
  // Before the window opens, Windows gave Ctrl+Alt+Space to another application (the case
  // measured on the development PC): the window asks `shortcut_status` as it opens.
  await openSettings(page, '&shortcutTaken=menu');
  const menu = page.locator('[data-field="menuShortcut"]');
  const taken = menu.locator('[data-warning="taken"]');
  await expect(taken).toHaveText('Another app is already using Ctrl+Alt+Space, so Windows did not give it to FlowTranslate. Record another combination, or close that app.');
  await expect(taken).toHaveAttribute('role', 'status');
  expect(await call(page, f => f.calls.filter(c => c.command === 'shortcut_status').length)).toBeGreaterThanOrEqual(1);
  await expect(menu.locator('.keycaps kbd')).toHaveText(['Ctrl', 'Alt', 'Space']);
  await page.getByRole('radio', { name: 'Français', exact: true }).click();
  await expect(taken).toHaveText('Une autre application utilise déjà Ctrl+Alt+Space : Windows ne l’a pas donné à FlowTranslate. Enregistrez une autre combinaison, ou fermez cette application.');
  await page.getByRole('radio', { name: 'English', exact: true }).click();

  // The recorder stays free: while it listens the warning steps aside, and the new chord is saved.
  const change = menu.getByRole('button', { name: 'Change', exact: true });
  await expect(change).toBeEnabled();
  await change.click();
  await expect(taken).toHaveCount(0);
  await page.keyboard.press('Control+Shift+Space');
  await expect.poll(() => saved(page)).toMatchObject({ shortcutBindings: [expect.objectContaining({ kind: 'menu', shortcut: 'Ctrl+Shift+Space', enabled: true })] });
  // Rust registered it and said so after the save: no warning left.
  await expect(page.getByRole('status').filter({ hasText: 'Shortcut saved.' })).toBeVisible();
  await expect(menu.locator('[data-warning]')).toHaveCount(0);

  // Later the event alone moves it: taken again, then released by the other application.
  await call(page, f => f.shortcutStates({ menu: 'taken' }));
  await expect(menu.locator('[data-warning="taken"]')).toContainText('Ctrl+Shift+Space');
  await call(page, f => f.shortcutStates({}));
  await expect(menu.locator('[data-warning]')).toHaveCount(0);

  // A direct shortcut Windows refused for another reason says it on its card; a disabled one says nothing.
  await call(page, f => f.settings({ shortcutBindings: [
    { id: 'menu', kind: 'menu', shortcut: 'Ctrl+Shift+Space', actionId: 'correct', outputMode: 'replace', enabled: true },
    { id: 'direct', kind: 'action', shortcut: 'Ctrl+Alt+T', actionId: 'translate', outputMode: 'display', enabled: true },
    { id: 'off', kind: 'action', shortcut: 'Ctrl+Alt+O', actionId: 'correct', outputMode: 'display', enabled: false },
  ] }));
  await call(page, f => f.shortcutStates({ direct: 'failed', off: 'taken' }));
  const cards = page.locator('.shortcut-card');
  await expect(cards.nth(0).locator('[data-warning="failed"]')).toHaveText('Windows refused Ctrl+Alt+T: it does nothing for now. Record another combination.');
  await expect(cards.nth(1).locator('[data-warning]')).toHaveCount(0);
  await expect(menu.locator('[data-warning]')).toHaveCount(0);
});

test('a taken menu chord gets a free one to take in one click, in the interface language; none free, the notice alone', async ({ page }) => {
  // Lucas, 24/09: Ctrl+Alt+Space already taken at the first launch (Claude desktop holds it on his PC).
  await openSettings(page, '&shortcutTaken=menu');
  const menu = page.locator('[data-field="menuShortcut"]');
  const use = menu.getByRole('button', { name: 'Use Ctrl+Alt+Shift+Space', exact: true });
  await expect(use).toBeVisible();
  await expect(menu.locator('[data-warning="taken"]')).toContainText('Another app is already using Ctrl+Alt+Space');
  expect(await call(page, f => f.calls.filter(c => c.command === 'suggest_shortcut').length)).toBeGreaterThanOrEqual(1);
  await page.getByRole('radio', { name: 'Français', exact: true }).click();
  await expect(menu.getByRole('button', { name: 'Utiliser Ctrl+Alt+Shift+Space', exact: true })).toBeVisible();
  await page.getByRole('radio', { name: 'English', exact: true }).click();
  await use.click();
  await expect.poll(() => saved(page)).toMatchObject({ shortcutBindings: [expect.objectContaining({ kind: 'menu', shortcut: 'Ctrl+Alt+Shift+Space', enabled: true })] });
  await expect(page.getByRole('status').filter({ hasText: 'Shortcut saved.' })).toBeVisible();
  await expect(menu.locator('[data-warning]')).toHaveCount(0);
  await expect(use).toHaveCount(0);
  await expect(menu.locator('.keycaps kbd')).toHaveText(['Ctrl', 'Alt', 'Shift', 'Space']);
  // Taken again, and Windows gives none of Rust's proposals.
  await call(page, f => f.suggestion(null));
  await call(page, f => f.shortcutStates({ menu: 'taken' }));
  await expect(menu.locator('[data-warning="taken"]')).toContainText('Ctrl+Alt+Shift+Space');
  await expect(menu.getByRole('button', { name: /^Use / })).toHaveCount(0);
});

test('a 0.4 file whose Ctrl+Alt+Space runs an action directly gets a menu shortcut from the Menu row', async ({ page }) => {
  await openSettings(page);
  await call(page, f => f.settings({ shortcutBindings: [{ id: 'primary', kind: 'action', shortcut: 'Ctrl+Alt+Space', actionId: 'correct', outputMode: 'display', enabled: true }] }));
  const menu = page.locator('[data-field="menuShortcut"]');
  await expect(menu.locator('.keycaps')).toHaveText('Not set');
  await expect(page.locator('.shortcut-card .keycaps kbd')).toHaveText(['Ctrl', 'Alt', 'Space']);
  await menu.getByRole('button', { name: 'Change', exact: true }).click();
  await page.keyboard.press('Control+Shift+Space');
  await expect.poll(() => saved(page)).toMatchObject({ shortcutBindings: [expect.objectContaining({ id: 'primary', shortcut: 'Ctrl+Alt+Space' }), { id: 'menu', kind: 'menu', shortcut: 'Ctrl+Shift+Space', actionId: 'correct', outputMode: 'replace', enabled: true }] });
  await expect(menu.locator('.keycaps kbd')).toHaveText(['Ctrl', 'Shift', 'Space']);
});

test('a direct link scrolls to its field, focuses it and pulses for 2.8 s; reduced motion holds it still', async ({ page }) => {
  await page.setViewportSize({ width: 520, height: 560 });
  // At opening: the URL names the field (the Connection details open for it).
  await openSettings(page, '&field=s2.endpoint');
  const endpoint = page.locator('[data-field="s2.endpoint"]');
  await expect(endpoint).toHaveAttribute('data-target', 'true');
  const shown = Date.now();
  await expect(endpoint.locator('input')).toBeFocused();
  await expect(endpoint).toBeInViewport();
  expect(await endpoint.evaluate(el => getComputedStyle(el).animationName)).toBe('field-pulse');
  await expect(page.getByRole('button', { name: /^Conne(ct|x)ion$/ })).toHaveAttribute('aria-expanded', 'true');
  await expect(endpoint).not.toHaveAttribute('data-target', /./, { timeout: 5000 });
  expect(Date.now() - shown).toBeGreaterThan(2000);

  // While open: the event lot 10 sends with open_settings({ field }).
  await call(page, f => f.focusField('menuShortcut'));
  const menu = page.locator('[data-field="menuShortcut"]');
  await expect(menu).toHaveAttribute('data-target', 'true');
  await expect(menu.getByRole('button', { name: 'Change', exact: true })).toBeFocused();
  await expect(menu).toBeInViewport();
  // A bare profile field is the default profile's (quality here), through open_settings.
  await page.evaluate(async () => (await import('/src/bridge.ts')).bridge.openSettings('apiKey'));
  expect(await call(page, f => f.calls.filter(c => c.command === 'open_settings').at(-1)?.args)).toEqual({ field: 'apiKey' });
  const key = page.locator('[data-field="s1.apiKey"]');
  await expect(key).toHaveAttribute('data-target', 'true');
  await expect(key.locator('input[type="password"]')).toBeFocused();
  await expect(menu).not.toHaveAttribute('data-target', /./);
  // An unknown field changes nothing.
  await call(page, f => f.focusField('history'));
  await expect(key.locator('input[type="password"]')).toBeFocused();

  // Reduced motion: the same highlight, without the pulse.
  await call(page, f => f.settings({ motion: 'reduced' }));
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  await call(page, f => f.focusField('s1.model'));
  const model = page.locator('[data-field="s1.model"]');
  await expect(model).toHaveAttribute('data-target', 'true');
  await expect(model.locator('input')).toBeFocused();
  expect(await model.evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  await expect(model).toHaveCSS('background-color', 'rgba(255, 186, 113, 0.18)');
});

test('settings changed elsewhere replace the open window’s copy, and a later change keeps them', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-24T09:00:00') });
  await openSettings(page);
  const saves = await saveCount(page);
  await call(page, f => f.settings({ autoClose: 'slow', language: 'fr' }));
  await expect(page.getByRole('radiogroup', { name: 'Fermeture automatique', exact: true }).getByRole('radio', { name: 'Lente', exact: true })).toHaveAttribute('data-state', 'on');
  await expect(page.getByRole('heading', { name: 'Réglages', exact: true })).toBeVisible();
  // Adopting is not saving.
  expect(await saveCount(page)).toBe(saves);
  await page.getByRole('radio', { name: 'Grande', exact: true }).click();
  await expect.poll(() => saved(page)).toMatchObject({ autoClose: 'slow', textSize: 'large', language: 'fr' });

  // While a field is being typed (its save waits 300 ms), a change from elsewhere does not
  // replace it: the typed value is what gets saved.
  await page.clock.pauseAt(new Date('2026-09-24T10:00:00'));
  await page.getByRole('button', { name: 'Connexion', exact: true }).click();
  const model = page.getByLabel('Modèle', { exact: true }).first();
  await model.fill('typed-model');
  await call(page, f => f.settings({ servers: [{ id: 's1', name: 'Quality', endpoint: '', apiKey: '', noKey: false, model: 'outside-model' }, { id: 's2', name: 'Fast', endpoint: '', apiKey: '', noKey: false, model: 'test' }] }));
  await expect(model).toHaveValue('typed-model');
  await page.clock.runFor(400);
  await expect.poll(() => saved(page)).toMatchObject({ servers: [{ id: 's1', model: 'typed-model' }, { id: 's2' }] });
});

test('Restore brings back the shipped instruction of current and 0.4 built-in actions, never their name', async ({ page }) => {
  await openSettings(page);
  // A 0.4 file after migration: translate-fr kept, correct still named « Corriger ».
  const actions = [{ ...defaultActions[0], name: 'Corriger', promptTemplate: 'Corrige.' }, ...defaultActions.slice(1), { ...legacyActions[0], promptTemplate: 'Traduis.' }];
  await page.evaluate(next => (window as unknown as { nativeFixture: Fixture }).nativeFixture.settings({ actions: next }), actions);
  const legacy = page.locator('.action-card').filter({ hasText: 'Traduire en français' });
  await expect(legacy.locator('summary small')).toHaveText('Built-in');
  await legacy.locator('summary').click();
  await legacy.getByRole('button', { name: 'Restore the instruction', exact: true }).click();
  await expect.poll(async () => (await saved(page))?.actions.find(a => a.id === 'translate-fr')).toEqual(legacyActions[0]);
  await expect(legacy.getByRole('button', { name: 'Restore the instruction', exact: true })).toBeDisabled();
  // A former built-in nothing uses can go.
  await expect(legacy.getByRole('button', { name: 'Delete action', exact: true })).toBeEnabled();

  const correct = page.locator('.action-card').filter({ hasText: 'Corriger' });
  await correct.locator('summary').click();
  await correct.getByRole('button', { name: 'Restore the instruction', exact: true }).click();
  await expect.poll(async () => (await saved(page))?.actions.find(a => a.id === 'correct')).toEqual({ ...defaultActions[0], name: 'Corriger' });
  // A current default stays: no Delete.
  await expect(correct.getByRole('button', { name: /Delete action/ })).toHaveCount(0);
});

test('Restore default settings asks first, then brings a fresh install back and keeps the connection, history, start at sign-in and language', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.setViewportSize({ width: 460, height: 420 });
  await openSettings(page);
  // Far from a fresh install: an own action first on the menu and by default, another chord,
  // dark, large text, French, the second server by default, models of one's own, history and start on.
  const own = { id: 'action-1', name: 'Résumer', promptTemplate: 'Résume le texte.' };
  const servers = [{ id: 's1', name: '', endpoint: 'http://127.0.0.1:8002', apiKey: '', noKey: true, model: 'my-quality' }, { id: 's2', name: '', endpoint: 'http://127.0.0.1:8001', apiKey: '', noKey: true, model: 'my-fast' }];
  await page.evaluate(next => (window as unknown as { nativeFixture: Fixture }).nativeFixture.settings(next), {
    actions: [...defaultActions, own], menuActionIds: ['action-1', 'correct'], defaultActionId: 'action-1',
    shortcutBindings: [{ id: 'menu', kind: 'menu', shortcut: 'Ctrl+Alt+Shift+Space', actionId: 'correct', outputMode: 'replace', enabled: true }],
    theme: 'dark', textSize: 'large', language: 'fr', defaultServerId: 's2', servers, setupDone: true, historyEnabled: true, autostart: true,
  } satisfies Partial<Settings>);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const row = page.locator('[data-field="reset"]');
  const ask = row.getByRole('button', { name: 'Rétablir…', exact: true });
  await ask.scrollIntoViewIfNeeded();
  await expect(row).toContainText('Chaque réglage revient à celui d’une nouvelle installation, sauf votre connexion, l’historique, la langue et le lancement à l’ouverture de session.');
  await ask.click();
  await expect(row).toContainText('Vos propres actions et raccourcis seront supprimés. Rétablir les réglages par défaut ?');
  const keep = row.getByRole('button', { name: 'Garder mes réglages', exact: true });
  await expect(keep).toBeFocused();
  // The question fits the narrowest window, without a sideways scroll.
  const viewport = page.locator('.settings-scroll-viewport');
  expect(await viewport.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  for (const button of [keep, row.getByRole('button', { name: 'Rétablir les réglages par défaut', exact: true })]) {
    const box = (await button.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(460);
  }
  await row.screenshot({ path: 'test-results/reset-ask-fr-dark.png' });
  // Escape keeps them, and the window stays open.
  await page.keyboard.press('Escape');
  await expect(ask).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Réglages', exact: true })).toBeVisible();
  const resets = () => call(page, f => f.calls.filter(c => c.command === 'reset_settings').length);
  expect(await resets()).toBe(0);
  await ask.click();
  await row.getByRole('button', { name: 'Rétablir les réglages par défaut', exact: true }).click();
  await expect(row.getByRole('status')).toHaveText('Réglages par défaut rétablis.');
  expect(await resets()).toBe(1);
  // What Rust saved, and the window shows it, still in French.
  expect(await call(page, f => f.current())).toMatchObject({
    actions: defaultActions, menuActionIds: defaultActions.map(action => action.id), defaultActionId: 'correct',
    shortcutBindings: [{ id: 'menu', kind: 'menu', shortcut: 'Ctrl+Alt+Space', actionId: 'correct', outputMode: 'replace', enabled: true }],
    theme: 'system', textSize: 'normal', uiVersion: 'ilot',
    language: 'fr', defaultServerId: 's2', servers, setupDone: true, historyEnabled: true, autostart: true,
  });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('.grid-name').first()).toHaveText('Fix grammar');
  await expect(page.locator('.action-card').filter({ hasText: 'Résumer' })).toHaveCount(0);
  await expect(page.locator('[data-field="menuShortcut"] .keycaps kbd')).toHaveText(['Ctrl', 'Alt', 'Space']);
  await expect(page.getByRole('switch', { name: 'Conserver l’historique chiffré', exact: true })).toBeChecked();
  await expect(page.locator('.save-status')).toHaveText(/Enregistré/);
  await row.screenshot({ path: 'test-results/reset-done-fr-light.png' });

  // Windows refuses Ctrl+Alt+Space (Claude desktop holds it on Lucas's PC): the menu keeps its
  // own chord, everything else is restored, and the row says so.
  await call(page, f => f.settings({ shortcutBindings: [{ id: 'menu', kind: 'menu', shortcut: 'Ctrl+Alt+Shift+Space', actionId: 'correct', outputMode: 'replace', enabled: true }], textSize: 'large' }));
  await call(page, f => f.refuseShortcut());
  await ask.click();
  await row.getByRole('button', { name: 'Rétablir les réglages par défaut', exact: true }).click();
  await expect(row.getByRole('status')).toHaveText('Réglages par défaut rétablis, sauf le raccourci du menu : Windows n’a pas donné Ctrl+Alt+Space, le menu garde Ctrl+Alt+Shift+Space.');
  expect(await call(page, f => f.current())).toMatchObject({ textSize: 'normal', shortcutBindings: [expect.objectContaining({ kind: 'menu', shortcut: 'Ctrl+Alt+Shift+Space', enabled: true })] });
  await expect(page.locator('[data-field="menuShortcut"] .keycaps kbd')).toHaveText(['Ctrl', 'Alt', 'Shift', 'Space']);
});

test('at the minimum native size the Îlot sections scroll inside the frame, without a sideways scroll', async ({ page }) => {
  await page.setViewportSize({ width: 460, height: 420 });
  await openSettings(page);
  await ilot(page);
  const viewport = page.locator('.settings-scroll-viewport');
  const size = await viewport.evaluate(el => ({ height: el.clientHeight, content: el.scrollHeight, width: el.clientWidth, scrollWidth: el.scrollWidth }));
  expect(size.content).toBeGreaterThan(size.height);
  expect(size.scrollWidth).toBeLessThanOrEqual(size.width + 1);
  for (const name of ['Remove Write email from the menu', 'Paste original', 'In the margin']) {
    const control = page.getByRole(name.startsWith('Remove') ? 'button' : 'radio', { name, exact: true });
    await control.scrollIntoViewIfNeeded();
    await expect(control).toBeInViewport();
    const box = (await control.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(460);
  }
  await expect(page.locator('.settings-titlebar')).toBeInViewport();
  await expect(page.locator('.settings-window footer')).toBeInViewport();
  await page.screenshot({ path: 'test-results/lot13-settings-compact.png' });
});
