import { expect, test } from '@playwright/test';

// The waiting pill is the moment the root can be swapped before the band lands: the Îlot's
// working pill (the preview's default, as the app's) and, asked for (`&ui=v4`), the 0.4 spinner
// pill. The band itself is the same glass in both journeys.
const journeys = [
  { name: 'Îlot', query: '', pill: '.working-pill' },
  { name: '0.4', query: '&ui=v4', pill: '.wait-pill' },
];

// The packaged root (native-overlay) holds the reader band centred on the bottom of a
// preview standing in for the screen: half its width, no hard-coded size.
for (const { name, query, pill } of journeys) {
  test(`the native reader band measures half the host width from a 1000px host window (${name})`, async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 700 });
    await page.goto(`/?window=overlay&demo=1&scenario=long${query}`);
    await expect(page.locator(pill)).toBeVisible();
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
}
