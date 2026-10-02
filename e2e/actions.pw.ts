import { test, expect, type Page } from '@playwright/test';

// Actions and their shortcuts across the Settings pages of 0.6 (« Actions », « Shortcuts »).
// The instruction's limits, the grid and the narrow window are in e2e/settings-window.pw.ts.
async function openSettings(page: Page) {
  await page.route('**/?window=settings&fixture=1', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('/src/main.tsx', '/e2e/native-fixture.ts') });
  });
  await page.goto('/?window=settings&fixture=1');
  await expect(page.getByRole('tab', { name: 'Actions', exact: true })).toBeVisible();
}
const go = async (page: Page, name: string) => { await page.getByRole('tab', { name, exact: true }).click(); await expect(page.getByRole('heading', { level: 2, name, exact: true })).toBeVisible(); };
const saved = (page: Page) => page.evaluate(() => (window as any).nativeFixture.calls.filter((c: any) => c.command === 'save_settings').at(-1)?.args.settings);

test('a custom instruction and a second shortcut retain their action and destination', async ({ page }) => {
  await openSettings(page);
  await go(page, 'Actions');
  await page.getByRole('button', { name: 'Add an action', exact: true }).click();
  const custom = page.locator('.st-instr').last();
  await expect(custom.locator('.st-chip')).toHaveText('Custom');
  await custom.getByRole('textbox', { name: 'Action name', exact: true }).fill('Résumer');
  await custom.locator('textarea').fill('Résume le texte en une phrase.');
  await expect.poll(() => saved(page)).toMatchObject({ actions: expect.arrayContaining([expect.objectContaining({ name: 'Résumer', promptTemplate: 'Résume le texte en une phrase.' })]) });
  const id = (await saved(page)).actions.find((a: any) => a.name === 'Résumer').id;
  await go(page, 'Shortcuts');
  await page.getByRole('button', { name: 'Add a shortcut', exact: true }).click();
  // The menu's shortcut has its own row: the new binding is the one direct card.
  const second = page.locator('.st-binding');
  await expect(second).toHaveCount(1);
  await second.getByRole('combobox', { name: 'Action', exact: true }).click();
  await page.getByRole('option', { name: 'Résumer', exact: true }).click();
  await second.getByRole('radiogroup', { name: 'Result', exact: true }).getByRole('radio', { name: 'Replace the selection', exact: true }).click();
  await second.getByRole('button', { name: 'Change', exact: true }).click();
  await page.keyboard.press('Control+Alt+R');
  await expect.poll(() => saved(page)).toMatchObject({ shortcutBindings: [expect.objectContaining({ kind: 'menu', shortcut: 'Ctrl+Alt+Space', actionId: 'correct' }), expect.objectContaining({ shortcut: 'Ctrl+Alt+R', actionId: id, outputMode: 'replace', enabled: true })] });
  // An action a shortcut runs cannot be deleted.
  await go(page, 'Actions');
  const used = page.locator(`[data-action="${id}"].st-instr`);
  if (await used.locator('textarea').count() === 0) await used.getByRole('button', { name: /Résumer/ }).first().click();
  await expect(used.getByRole('button', { name: /Delete action/ })).toBeDisabled();
});

test('reserved chords are refused immediately and AZERTY letters use their label', async ({ page }) => {
  await openSettings(page);
  await go(page, 'Shortcuts');
  const menu = page.locator('[data-field="menuShortcut"]');
  await menu.getByRole('button', { name: 'Change', exact: true }).click();
  await page.keyboard.press('Control+F12');
  await expect(menu.getByRole('alert')).toContainText('F12 is reserved');
  expect(await saved(page)).toBeUndefined();
  // AZERTY: the key at the QWERTY « Q » position is labelled A, and A is what is saved and shown.
  await page.getByRole('textbox', { name: 'Menu shortcut: press the combination', exact: true }).dispatchEvent('keydown', { key: 'a', code: 'KeyQ', ctrlKey: true, altKey: true });
  await expect.poll(() => saved(page)).toMatchObject({ shortcutBindings: [expect.objectContaining({ shortcut: 'Ctrl+Alt+A' })] });
  await expect(menu.locator('kbd')).toHaveText(['Ctrl', 'Alt', 'A']);
});
