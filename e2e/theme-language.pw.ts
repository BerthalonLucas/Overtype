import { test, expect, type Page } from '@playwright/test';

// Lot 1 (docs/DA-PLAN.md): the interface speaks English by default and switches to French
// at once, without a reload; the theme follows Windows (prefers-color-scheme in WebView2)
// or the user's choice, as data-theme on <html>; icons are thin Lucide (1.5, 14–16 px).
// window.nativeFixture is typed in e2e/native-bridge.pw.ts; here it is reached untyped.

async function openFixture(page: Page, name: 'overlay' | 'settings') {
  await page.route(`**/?window=${name}&fixture=1`, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('/src/main.tsx', '/e2e/native-fixture.ts') });
  });
  await page.goto(`/?window=${name}&fixture=1`);
  if (name === 'overlay') {
    await expect(page.locator('.glass-overlay')).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as any).nativeFixture.calls.some((c: any) => c.command === 'translate'))).toBe(true);
  }
  // A marker that a reload would erase.
  await page.evaluate(() => { (window as unknown as { unreloaded: boolean }).unreloaded = true; });
}
const unreloaded = (page: Page) => page.evaluate(() => (window as unknown as { unreloaded?: boolean }).unreloaded === true);

test('the overlay speaks English by default and switches to French at once when the setting changes', async ({ page }) => {
  await openFixture(page, 'overlay');
  await page.evaluate(async () => { const f = (window as any).nativeFixture; await f.delta('Bonjour'); await f.done(); });
  await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toBeEnabled();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.evaluate(() => (window as any).nativeFixture.settings({ language: 'fr' }));
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Plus d’options', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await page.getByRole('button', { name: 'Plus d’options', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Afficher l’original', exact: true })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Relancer avec Fast', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.evaluate(() => (window as any).nativeFixture.settings({ language: 'en' }));
  await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toBeEnabled();
  // The result, user data, is never touched by the switch.
  await expect(page.locator('.translation-text')).toHaveText('Bonjour');
  expect(await unreloaded(page)).toBe(true);
});

// Rust sends `settings-changed` to the overlay only: the settings window must switch from its
// own copy, the moment the choice is made, and save it by the usual path.
test('the settings window switches language and theme the moment they are chosen, and saves them', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await openFixture(page, 'settings');
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'English', exact: true })).toHaveAttribute('data-state', 'on');
  const actionName = await page.locator('.action-card summary > span').first().textContent();
  await page.getByRole('radio', { name: 'Français', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Réglages', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Consignes', exact: true })).toBeVisible();
  await expect(page.locator('.save-status')).toHaveText('Enregistré à l’instant');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  const saved = () => page.evaluate(() => (window as any).nativeFixture.calls.filter((c: any) => c.command === 'save_settings').at(-1)?.args.settings);
  await expect.poll(saved).toMatchObject({ language: 'fr' });
  // Action names are user data: the switch never renames an action, built-in ones included.
  await expect(page.locator('.action-card summary > span').first()).toHaveText(actionName ?? '');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('radio', { name: 'Sombre', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(28, 30, 34)');
  await expect.poll(saved).toMatchObject({ language: 'fr', theme: 'dark' });
  await page.getByRole('radio', { name: 'English', exact: true }).click();
  await page.getByRole('radio', { name: 'Light', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(245, 245, 247)');
  // « Follow Windows » also names an Animations choice: the Theme group's one.
  await page.getByRole('radiogroup', { name: 'Theme', exact: true }).getByRole('radio', { name: 'Follow Windows', exact: true }).click();
  await expect.poll(saved).toMatchObject({ language: 'en', theme: 'system' });
  expect(await unreloaded(page)).toBe(true);
});

test('history dates follow the interface language', async ({ page }) => {
  await page.goto('/?window=settings&demo=1');
  await page.getByRole('switch', { name: 'Keep encrypted history' }).check();
  const date = page.locator('.history article small').first();
  await expect(date).toContainText('Sep 8');
  await page.getByRole('radio', { name: 'Français', exact: true }).click();
  await expect(date).toContainText('8 sept.');
  await expect(page.locator('.history-foot small')).toHaveText('1 entrée');
});

test('the theme follows the system scheme live, and a forced theme wins over it', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await openFixture(page, 'overlay');
  await page.evaluate(async () => { const f = (window as any).nativeFixture; await f.delta('Bonjour'); await f.done(); });
  const html = page.locator('html');
  const copy = page.locator('.translation-copy');
  await expect(html).toHaveAttribute('data-theme', 'light');
  await expect(copy).toHaveCSS('color', 'rgb(29, 29, 31)');
  // Windows switches to dark while the glass is open: no reload, the tokens follow.
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(copy).toHaveCSS('color', 'rgb(245, 246, 248)');
  await expect(page.locator('.translation-bubble')).toHaveCSS('background-color', 'rgba(28, 30, 34, 0.86)');
  // Forced light while Windows is dark, then forced dark while Windows is light.
  await page.evaluate(() => (window as any).nativeFixture.settings({ theme: 'light' }));
  await expect(html).toHaveAttribute('data-theme', 'light');
  await expect(copy).toHaveCSS('color', 'rgb(29, 29, 31)');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.evaluate(() => (window as any).nativeFixture.settings({ theme: 'dark' }));
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(html).toHaveAttribute('data-theme', 'dark');
  // Back to « follow Windows »: the system decides again.
  await page.evaluate(() => (window as any).nativeFixture.settings({ theme: 'system' }));
  await expect(html).toHaveAttribute('data-theme', 'light');
  expect(await unreloaded(page)).toBe(true);
});

// The waiting pill of each journey: the Îlot's working pill (the preview's default, as the app's)
// and, asked for (`&ui=v4`), the 0.4 spinner pill.
const waitingPills = [
  { name: 'Îlot', query: '', pill: '.working-pill' },
  { name: '0.4', query: '&ui=v4', pill: '.wait-pill' },
] as const;

for (const colorScheme of ['light', 'dark'] as const) for (const { name, query, pill: waiting } of waitingPills) {
  test(`the ${colorScheme} material paints every surface, and every icon is a thin Lucide of 14 to 16 px (${name})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto(`/?window=overlay&demo=1&scenario=long${query}`);
    await expect(page.locator(waiting)).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', colorScheme);
    const paint = (selector: string) => page.locator(selector).evaluate(el => ({ image: getComputedStyle(el).backgroundImage, color: getComputedStyle(el).backgroundColor, shadow: getComputedStyle(el).boxShadow }));
    const pill = await paint(waiting);
    expect(pill.shadow).toContain('0.5px');
    await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toBeEnabled({ timeout: 30000 });
    await page.getByRole('button', { name: 'More options', exact: true }).click();
    await expect(page.getByRole('menu')).toBeVisible();
    const surfaces = await Promise.all(['.translation-bubble', '.action-pill', '.more-menu'].map(paint));
    for (const surface of surfaces) expect(surface).toEqual(pill);
    expect(pill.image).toContain(colorScheme === 'light' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.08)');
    if (colorScheme === 'dark') expect(pill.color).toBe('rgba(28, 30, 34, 0.86)');
    // Layout size, not the painted box: a surface still entering on its spring scales from .97.
    const icons = await page.locator('.glass-overlay svg.lucide').evaluateAll(nodes => nodes.map(node => ({ stroke: node.getAttribute('stroke-width'), width: parseFloat(getComputedStyle(node).width), height: parseFloat(getComputedStyle(node).height) })));
    expect(icons.length).toBeGreaterThanOrEqual(4);
    for (const icon of icons) {
      expect(icon.stroke).toBe('1.5');
      expect(icon.width).toBeGreaterThanOrEqual(14);
      expect(icon.width).toBeLessThanOrEqual(16);
      expect(icon.height).toBe(icon.width);
    }
    await page.screenshot({ path: `test-results/lot1-material-${colorScheme}.png` });
  });
}
