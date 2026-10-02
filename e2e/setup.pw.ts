import { test, expect, type Page } from '@playwright/test';
import type { Settings } from '../src/types';

// The first-run setup (src/setup/, docs/PLAN-0.6.md §4.1) in the browser preview: `/?window=setup`
// on the simulated settings and server (src/bridge.mock.ts, `&conn=<scenario>`). Every answer goes
// through the usual save path; the real window is checked by hand (docs/RECETTE.md).
const open = (page: Page, query = '') => page.goto(`/?window=setup&lang=fr&theme=light&motion=full${query}`);
const screen = (page: Page, step: string) => page.locator(`.su-screen[data-screen="${step}"]`);
const primary = (page: Page) => page.locator('.su-primary');
// What the simulated bridge holds: the same module the page uses.
const saved = (page: Page) => page.evaluate(async () => (await (await import('/src/bridge.ts' as string)).bridge.getSettings()) as Settings);
async function fillServer(page: Page, address = 'llm.exemple.com/v1', key = 'sk-labo-7f3a9c2e') {
  await page.locator('.ft-connection input').first().fill(address);
  if (key) await page.locator('.ft-connection input[type="password"]').fill(key);
}

test.describe('the first-run setup', () => {
  test('goes from the welcome to the Settings, each answer saved at once', async ({ page }) => {
    await open(page);
    await expect(screen(page, 'welcome')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Bienvenue sur FlowTranslate' })).toBeVisible();
    await expect(page.locator('.su-heart-ring')).toHaveCount(2);
    await expect(page.locator('.su-foot-note')).toHaveText('3 questions et une courte démo, environ une minute.');
    await primary(page).click();

    // 1. Appearance: the theme applies at once, and so does the language.
    await expect(screen(page, 'appearance')).toBeVisible();
    await expect(page.locator('.su-setup')).toHaveAttribute('data-ft-page', 'appearance');
    await expect(page.locator('.su-dots')).toHaveAttribute('aria-label', 'Étape 1 sur 4');
    await page.getByRole('radio', { name: 'Sombre' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('radio', { name: 'English' }).click();
    await expect(page.getByRole('heading', { name: 'How do you want to see FlowTranslate?' })).toBeVisible();
    await page.getByRole('radio', { name: 'Français' }).click();
    await page.getByRole('radio', { name: 'Clair' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(await saved(page)).toMatchObject({ theme: 'light', language: 'fr' });
    await primary(page).click();

    // 2. Shortcut: the user's chord, menu or direct action.
    await expect(screen(page, 'shortcut')).toBeVisible();
    await expect(page.locator('.su-setup')).toHaveAttribute('data-ft-page', 'shortcuts');
    await expect(page.locator('.su-rec .ft-keycap')).toHaveText(['Ctrl', 'Alt', 'Espace']);
    await page.getByRole('radio', { name: /Lancer directement une action/ }).click();
    await expect(page.getByRole('combobox', { name: 'Action lancée par le raccourci' })).toBeVisible();
    expect((await saved(page)).shortcutBindings[0]).toMatchObject({ id: 'menu', kind: 'action', actionId: 'correct', shortcut: 'Ctrl+Alt+Space' });
    await page.getByRole('radio', { name: /Ouvrir le menu/ }).click();
    await expect(page.getByRole('combobox', { name: 'Action lancée par le raccourci' })).toHaveCount(0);
    expect((await saved(page)).shortcutBindings[0]).toMatchObject({ id: 'menu', kind: 'menu' });
    await primary(page).click();

    // 3. The model: nothing to continue with until a model is chosen on a server that answered.
    await expect(screen(page, 'model')).toBeVisible();
    await expect(page.locator('.su-setup')).toHaveAttribute('data-ft-page', 'server');
    await expect(primary(page)).toBeDisabled();
    await expect(page.locator('.su-foot-note')).toHaveText('Continuer dès que la connexion est vérifiée.');
    await fillServer(page);
    await expect(page.getByText('Connecté')).toBeVisible({ timeout: 8000 });
    await expect(primary(page)).toBeEnabled();
    // Saved without « /v1 », as Rust stores it.
    await expect.poll(async () => (await saved(page)).servers[0]).toMatchObject({ endpoint: 'https://llm.exemple.com', apiKey: 'sk-labo-7f3a9c2e', noKey: false, model: 'unsloth/gemma-4-12B-it-qat-GGUF:UD-Q4_K_XL' });
    // One sentence to try it.
    await page.getByRole('button', { name: 'Essayer avec une phrase' }).click();
    await expect(page.locator('.su-trial-bubble')).toHaveText('Bonjour, la réunion commence à dix heures.', { timeout: 8000 });
    await primary(page).click();

    // 4. Before the demo; skipped here (e2e/demo.pw.ts plays it).
    await expect(screen(page, 'demo')).toBeVisible();
    await expect(page.locator('.su-how li')).toHaveCount(3);
    await expect(page.locator('.su-how')).toContainText('Ctrl + Alt + Espace');
    await page.waitForTimeout(350);
    await page.getByRole('button', { name: 'Passer la démo' }).click();

    // « C'est prêt »: what was answered, then the Settings.
    await expect(screen(page, 'ready')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'C’est prêt' })).toBeVisible();
    await expect(page.locator('.su-recap')).toContainText('Clair');
    await expect(page.locator('.su-recap')).toContainText('ouvre le menu');
    await expect(page.locator('.su-recap')).toContainText('gemma-4-12B-it-qat');
    await expect(page.locator('.su-recap')).toContainText('sur llm.exemple.com');
    expect((await saved(page)).setupDone).toBe(false);
    await page.waitForTimeout(350);
    await primary(page).click();
    await expect(page).toHaveURL(/window=settings/);
  });

  test('a double click, a held Enter or a mashed key move by one screen only', async ({ page }) => {
    await open(page);
    await expect(screen(page, 'welcome')).toBeVisible();
    await primary(page).dblclick();
    await expect(screen(page, 'appearance')).toBeVisible();
    await page.waitForTimeout(500);
    await expect(screen(page, 'appearance')).toBeVisible();
    await expect(screen(page, 'shortcut')).toHaveCount(0);
    // Enter held down (auto-repeat), from the heading: one step.
    await page.locator('.su-title').focus();
    await page.keyboard.down('Enter');
    for (let i = 0; i < 12; i++) await page.keyboard.down('Enter');
    await page.keyboard.up('Enter');
    await expect(screen(page, 'shortcut')).toBeVisible();
    await page.waitForTimeout(500);
    await expect(screen(page, 'shortcut')).toBeVisible();
    await expect(page.locator('.su-screen')).toHaveCount(1);
    // Ten presses of the big button in the same instant.
    await primary(page).evaluate(button => { for (let i = 0; i < 10; i++) (button as HTMLButtonElement).click(); });
    await expect(screen(page, 'model')).toBeVisible();
    await page.waitForTimeout(500);
    await expect(page.locator('.su-screen')).toHaveCount(1);
    await expect(screen(page, 'model')).toBeVisible();
  });

  test('Escape goes back one screen and never closes; Enter never passes an unverified model', async ({ page }) => {
    await open(page, '&step=model');
    await expect(screen(page, 'model')).toBeVisible();
    // Enter on the address field with nothing verified: the big button is disabled, nothing moves.
    await page.locator('.ft-connection input').first().focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    await expect(screen(page, 'model')).toBeVisible();
    await expect(primary(page)).toBeDisabled();
    // « Plus tard » stays free.
    await page.getByRole('button', { name: 'Plus tard' }).click();
    await expect(screen(page, 'demo')).toBeVisible();
    await page.waitForTimeout(350);
    await page.keyboard.press('Escape');
    await expect(screen(page, 'model')).toBeVisible();
    await page.waitForTimeout(350);
    await page.keyboard.press('Escape');
    await expect(screen(page, 'shortcut')).toBeVisible();
    await page.waitForTimeout(350);
    await page.keyboard.press('Escape');
    await expect(screen(page, 'appearance')).toBeVisible();
    await page.waitForTimeout(350);
    await page.keyboard.press('Escape');
    await expect(screen(page, 'welcome')).toBeVisible();
    await page.waitForTimeout(350);
    // On the welcome there is nowhere to go back to: the window stays.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(350);
    await expect(screen(page, 'welcome')).toBeVisible();
    await expect(page.locator('.su-window')).toBeVisible();
  });

  test('a refused key keeps the trace open on the failing step, with its journal; the server fixed, it continues', async ({ page }) => {
    await open(page, '&step=model&conn=cle-refusee');
    await fillServer(page);
    await expect(page.getByText('Clé refusée')).toBeVisible({ timeout: 8000 });
    await expect(primary(page)).toBeDisabled();
    await page.getByRole('button', { name: 'Voir le journal' }).click();
    const sheet = page.getByRole('dialog', { name: 'Journal de connexion' });
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText('401');
    // Never the key itself, only its last characters masked.
    await expect(sheet).not.toContainText('sk-labo-7f3a9c2e');
    // Escape closes the journal, not the screen.
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(screen(page, 'model')).toBeVisible();
    // The server answers again: a new check, and the way is free.
    await page.evaluate(async () => (await import('/src/bridge.ts' as string)).bridge.setConnScenario('ok'));
    await page.getByRole('button', { name: 'Vérifier à nouveau' }).dblclick();
    await expect(page.getByText('Connecté')).toBeVisible({ timeout: 8000 });
    await expect(primary(page)).toBeEnabled();
  });

  test('a server that never answers does not hold the screen: typing elsewhere, leaving and coming back work', async ({ page }) => {
    await open(page, '&step=model&conn=delai');
    await fillServer(page);
    await expect(page.locator('.ft-trace, .ft-check')).not.toHaveCount(0);
    // While it waits: the other controls answer, and « Retour » leaves at once.
    await page.getByRole('button', { name: 'Mon serveur n’a pas de clé' }).click();
    await page.getByRole('button', { name: 'Retour' }).click();
    await expect(screen(page, 'shortcut')).toBeVisible();
    await page.waitForTimeout(350);
    await primary(page).click();
    await expect(screen(page, 'model')).toBeVisible();
    // Back on the question, what was typed is still there and a check ends by itself.
    await expect(page.locator('.ft-connection input').first()).toHaveValue('https://llm.exemple.com');
    await expect(page.getByText(/ne répond pas|pas répondu|Délai/i).first()).toBeVisible({ timeout: 12_000 });
    await expect(primary(page)).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Plus tard' })).toBeEnabled();
  });

  test('« Voir la démo » clicked twice opens one demo; skipped, the setup comes back on « C’est prêt »', async ({ page }) => {
    await open(page, '&step=demo');
    await expect(screen(page, 'demo')).toBeVisible();
    await primary(page).evaluate(button => { for (let i = 0; i < 4; i++) (button as HTMLButtonElement).click(); });
    await expect(page.locator('.dm-root')).toHaveCount(1, { timeout: 8000 });
    await expect(page.locator('.su-window')).toHaveCount(0);
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: 'Passer' }).click();
    await expect(page.locator('.dm-root')).toHaveCount(0);
    await expect(screen(page, 'ready')).toBeVisible();
    // The answers can be edited from the recap, and « Retour » leads back through the questions.
    await page.getByRole('button', { name: 'Modifier : Raccourci' }).click();
    await expect(screen(page, 'shortcut')).toBeVisible();
    await page.waitForTimeout(350);
    await primary(page).click();
    await expect(screen(page, 'model')).toBeVisible();
  });

  test('« Fermer » ends the setup without the Settings; the setup is then done', async ({ page }) => {
    await open(page, '&step=ready');
    await expect(screen(page, 'ready')).toBeVisible();
    await expect(page.locator('.su-recap')).toContainText('À configurer dans les Réglages');
    const done = page.waitForFunction(async () => (await (await import('/src/bridge.ts' as string)).bridge.getSettings()).setupDone === true);
    await page.locator('.su-secondary').dblclick();
    await done;
    await expect(page).not.toHaveURL(/window=settings/);
  });

  test('fits a small window: the screen scrolls, the big button stays in sight', async ({ page }) => {
    await page.setViewportSize({ width: 620, height: 520 });
    await open(page, '&step=shortcut');
    await expect(screen(page, 'shortcut')).toBeVisible();
    const button = await primary(page).boundingBox();
    expect(button!.y + button!.height).toBeLessThanOrEqual(520);
    const viewport = page.locator('.su-scroll-vp');
    expect(await viewport.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
    await viewport.evaluate(element => { element.scrollTop = element.scrollHeight; });
    await expect(page.getByRole('radio', { name: /Lancer directement une action/ })).toBeInViewport();
  });
});
