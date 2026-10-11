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
  // The engine's wait: the working pill.
  await page.getByRole('button', { name: 'Attente du moteur' }).click();
  await expect(page).toHaveURL(/scenario=pending/);
  await expect(frame.locator('.working-pill')).toBeVisible();
});

// The wait: the working pill. A partial answer: the glass.
const cases = [
  { scenario: 'pending', pill: '.working-pill' },
  { scenario: 'partial', pill: '' },
] as const;

for (const { scenario, pill } of cases) {
  test(`${scenario} is inspectable, cannot be copied and can be dismissed`, async ({ page }) => {
    await page.goto(`/lab-frame.html?scenario=${scenario}&motion=reduce`);
    await expect(page.locator('[data-lab-phase]')).toHaveAttribute(
      'data-lab-phase',
      scenario === 'pending' ? 'streaming' : 'error',
    );
    if (scenario === 'pending') {
      await expect(page.locator(pill)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toHaveCount(0);
    } else await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toBeDisabled();
    if (scenario === 'partial')
      await expect(page.locator('.translation-text')).toHaveText('Pourriez-vous envoyer la proposition');
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
