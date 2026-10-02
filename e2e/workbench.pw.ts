import { test, expect } from '@playwright/test';

test('workbench replays the real translation and keeps a reproducible URL', async ({ page }) => {
  await page.goto('/lab.html?view=states');
  const frame = page.frameLocator('iframe');
  await expect(frame.getByRole('button', { name: 'Copy translation', exact: true })).toBeEnabled();
  await page.screenshot({ path: 'test-results/workbench.png', fullPage: true });
  await frame.getByRole('button', { name: 'More options', exact: true }).click();
  await frame.getByRole('menuitem', { name: 'Close', exact: true }).click();
  await expect(frame.locator('.glass-overlay')).toHaveCount(0);
  await page.getByRole('button', { name: 'Rejouer', exact: true }).click();
  await expect(frame.getByRole('button', { name: 'Copy translation', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Traduction longue' }).click();
  await expect(page).toHaveURL(/scenario=long/);
  await expect(frame.locator('[data-lab-phase]')).toHaveAttribute('data-lab-phase', 'complete');
  // The reader band: half of the frame (its border leaves 898 px inside the 900 px iframe).
  await expect(frame.locator('.glass-overlay')).toHaveAttribute('data-form', 'reader');
  const inner = await frame.locator('html').evaluate(() => window.innerWidth);
  await expect(frame.locator('.translation-bubble')).toHaveCSS('width', `${Math.round(inner / 2)}px`);
  await expect(frame.locator('.translation-copy')).toHaveAttribute('data-scroll-edge', 'top');
  // Every state opens in the Îlot, the app's default; the 0.4 wait asks the frame for its journey.
  await expect(page.locator('iframe')).not.toHaveAttribute('src', /ui=/);
  await page.getByRole('button', { name: 'Attente du moteur (0.4)' }).click();
  await expect(page).toHaveURL(/scenario=pending/);
  await expect(page.locator('iframe')).toHaveAttribute('src', /[?&]ui=v4(&|$)/);
  await expect(frame.locator('.wait-pill')).toBeVisible();
  await expect(frame.locator('.working-pill')).toHaveCount(0);
});

// The wait in each journey: the Îlot's working pill (the frame's default, as the app's) and,
// asked for (ui=v4), the 0.4 spinner pill. A partial answer is the same glass in both.
const cases = [
  { scenario: 'pending', journey: ' (Îlot)', query: '', pill: '.working-pill' },
  { scenario: 'pending', journey: ' (0.4)', query: '&ui=v4', pill: '.wait-pill' },
  { scenario: 'partial', journey: '', query: '', pill: '' },
] as const;

for (const { scenario, journey, query, pill } of cases) {
  test(`${scenario} is inspectable, cannot be copied and can be dismissed${journey}`, async ({ page }) => {
    await page.goto(`/lab-frame.html?scenario=${scenario}&motion=reduce${query}`);
    await expect(page.locator('[data-lab-phase]')).toHaveAttribute('data-lab-phase', scenario === 'pending' ? 'streaming' : 'error');
    if (scenario === 'pending') { await expect(page.locator(pill)).toBeVisible(); await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toHaveCount(0); }
    else await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toBeDisabled();
    if (scenario === 'partial') await expect(page.locator('.translation-text')).toHaveText('Pourriez-vous envoyer la proposition');
    await page.keyboard.press('Escape');
    await expect(page.locator('.glass-overlay')).toHaveCount(0);
  });
}

test('history fixture is isolated from the settings fixture', async ({ page }) => {
  await page.goto('/lab-frame.html?scenario=history');
  await expect(page.locator('.st-history-item')).toHaveCount(1);
  await expect(page.getByRole('switch', { name: 'Keep encrypted history', exact: true })).toBeChecked();
  // The settings fixture never switched the history on: what was kept before stays listed (and
  // deletable), and the page says nothing more will be kept.
  await page.goto('/lab-frame.html?scenario=settings');
  await page.getByRole('tab', { name: 'Data', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'Keep encrypted history', exact: true })).not.toBeChecked();
  await expect(page.getByText('Off: the next texts will not be kept.')).toBeVisible();
});
