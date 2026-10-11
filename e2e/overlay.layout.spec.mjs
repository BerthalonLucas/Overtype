import { expect, test } from '@playwright/test';

// The waiting pill (the working pill) is the moment the root can be swapped before the band lands.
// The packaged root (native-overlay) holds the reader band centred on the bottom of a
// preview standing in for the screen: half its width, no hard-coded size.
test('the native reader band measures half the host width from a 1000px host window', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.goto('/?window=overlay&demo=1&scenario=long');
  await expect(page.locator('.working-pill')).toBeVisible();
  await page.locator('.standalone-demo').evaluate((element) => {
    element.className = 'native-overlay';
  });
  await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toBeEnabled({ timeout: 30000 });
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-form', 'reader');
  await expect(page.locator('.translation-bubble')).toHaveCSS('width', '500px');
  const box = await page.locator('.translation-bubble').boundingBox();
  expect(Math.abs(box.x + box.width / 2 - 500)).toBeLessThanOrEqual(1);
  expect(box.height).toBeLessThanOrEqual(Math.round(700 * 0.45));
});
