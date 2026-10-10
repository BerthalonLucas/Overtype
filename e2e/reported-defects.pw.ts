import { test, expect } from '@playwright/test';

test('settings background covers the widened production document', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 450 });
  await page.goto('/lab-frame.html?scenario=settings&surface=production');
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await page.screenshot({
    path: `release/ui-evidence/settings-${process.env.FLOWTRANSLATE_EVIDENCE_STAGE ?? 'current'}.png`,
  });
  // The scenario's dark theme: the matte window of 0.6 (src/components/tokens.css), edge to edge.
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(19, 18, 25)');
  const box = await page.locator('.ft-settings-window').boundingBox();
  expect(box).toMatchObject({ x: 0, y: 0, width: 960, height: 450 });
});

test('the frame band is documented as native-only with its established cause', async ({ page }) => {
  await page.goto('/lab.html?issue=band');
  await expect(page.getByText('Pas de reproduction web pour ce défaut.', { exact: true })).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.getByText('Établie le 13/09/2026', { exact: false })).toBeVisible();
});

// UI-021 (« Agrandir » useless): a long result is a reader band from the start, half the
// frame wide, without any enlarge control.
test('a long translation reads as a band, half the frame wide, without « Agrandir »', async ({ page }) => {
  await page.goto('/lab.html?issue=reader');
  const frame = page.frameLocator('iframe');
  await expect(frame.locator('[data-lab-phase]')).toHaveAttribute('data-lab-phase', 'complete');
  await expect(frame.locator('.glass-overlay')).toHaveAttribute('data-form', 'reader');
  const inner = await frame.locator('html').evaluate(() => window.innerWidth);
  expect(inner).toBeGreaterThanOrEqual(956);
  await expect(frame.locator('.translation-bubble')).toHaveCSS('width', `${Math.round(inner / 2)}px`);
  await frame.getByRole('button', { name: 'More options', exact: true }).click();
  await expect(frame.getByRole('menuitem', { name: 'Expand' })).toHaveCount(0);
  await expect(frame.getByRole('menuitem', { name: 'Show original', exact: true })).toBeVisible();
});

// UI-022 (the glass stays too long): read, leave, gone within four seconds.
test('a glass the pointer visited dims within four seconds of its departure and then leaves', async ({ page }) => {
  await page.goto('/lab.html?issue=duration');
  const frame = page.frameLocator('iframe');
  await expect(frame.locator('[data-lab-phase]')).toHaveAttribute('data-lab-phase', 'complete');
  await frame.locator('.translation-copy').hover();
  await page.waitForTimeout(1100);
  await page.mouse.move(2, 2);
  await expect(frame.locator('.glass-overlay')).toHaveAttribute('data-dimming', 'true', { timeout: 5000 });
  await expect(frame.locator('.glass-overlay')).toHaveCount(0, { timeout: 4000 });
});

// UI-023 (loading): a pill alone, no ring in a big glass. In the Îlot, the app's default, the
// working pill of lot 8: 44 × 28, its Perle after 250 ms.
test('waiting shows the working pill alone, 44 × 28, its Perle after 250 ms', async ({ page }) => {
  await page.goto('/lab.html?issue=loading');
  const frame = page.frameLocator('iframe');
  await expect(frame.locator('[data-lab-phase]')).toHaveAttribute('data-lab-phase', 'streaming');
  const pill = frame.locator('.working-pill');
  // The pill enters on the spring (glide and scale are paint only): measured at rest.
  await expect(pill).toHaveCSS('transform', 'none');
  expect(await pill.boundingBox()).toMatchObject({ width: 44, height: 28 });
  await expect(pill).toHaveAttribute('data-orb', 'shown');
  await expect(pill.locator('.ldr.perle')).toHaveCount(1);
  await expect(frame.locator('.wait-pill')).toHaveCount(0);
  await expect(frame.locator('.loading-ring')).toHaveCount(0);
  await expect(frame.locator('.translation-bubble')).toHaveCount(0);
});

// The 0.4 journey, asked for (ui=v4) in the same frame: shadcn's spinner in a pill of 60 × 28.
test('the 0.4 journey waits with a turning spinner in a pill of 60 × 28', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 450 });
  await page.goto('/lab-frame.html?scenario=pending&surface=production&ui=v4');
  await expect(page.locator('[data-lab-phase]')).toHaveAttribute('data-lab-phase', 'streaming');
  const pill = page.locator('.wait-pill');
  // The pill enters on the spring (glide and scale are paint only): measured at rest.
  await expect(pill).toHaveCSS('transform', 'none');
  expect(await pill.boundingBox()).toMatchObject({ width: 60, height: 28 });
  expect(await pill.locator('svg').count()).toBe(1);
  expect(await pill.locator('svg').evaluate((el) => getComputedStyle(el).animationName)).toBe('wait-spin');
  await expect(page.locator('.working-pill')).toHaveCount(0);
  await expect(page.locator('.loading-ring')).toHaveCount(0);
  await expect(page.locator('.translation-bubble')).toHaveCount(0);
});

test('native-only defects do not present a web simulation as a reproduction', async ({ page }) => {
  for (const issue of ['residual', 'screens']) {
    await page.goto(`/lab.html?issue=${issue}`);
    await expect(page.getByText('Pas de reproduction web pour ce défaut.', { exact: true })).toBeVisible();
    await expect(page.locator('iframe')).toHaveCount(0);
  }
  await page.goto('/lab.html?issue=residual');
  await expect(page.getByText('Établie pour la fermeture', { exact: false })).toBeVisible();
});

test('the notice replaces the message box and is reproducible in the workbench', async ({ page }) => {
  await page.goto('/lab.html?issue=notice');
  await expect(page.getByText('capture_error appelait MessageBoxW', { exact: false })).toBeVisible();
  const frame = page.frameLocator('iframe');
  await expect(frame.locator('.notice-pill')).toHaveText('Rien à traduire dans la fenêtre active.');
  await expect(frame.locator('.glass-overlay')).toHaveCount(0);
});
