import { test, expect } from '@playwright/test';
import { menu as menuLayout } from '../src/layout';

// The browser preview starts in the Îlot, as the app does: a direct capture waits in the working
// pill of lot 8. `&ui=v4` asks for the 0.4 journey and its spinner pill.
const journeys = [
  { name: 'Îlot', query: '', pill: '.working-pill' },
  { name: '0.4', query: '&ui=v4', pill: '.wait-pill' },
] as const;

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`preview backgrounds and copy feedback preserve the capture and pill bounds (${reducedMotion})`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion });
    await page.goto('/?window=overlay&demo=1&background=light');
    const copy = page.getByRole('button', { name: 'Copy translation', exact: true });
    await expect(copy).toBeEnabled();
    const text = await page.locator('.translation-text').textContent();
    const captureId = await page.locator('.glass-overlay').getAttribute('data-capture-id');
    await expect(page.locator('.action-pill')).toHaveCSS('transform', 'none');
    const pillBounds = await page.locator('.action-pill').boundingBox();
    for (const name of ['Dark', 'Color', 'Light']) {
      const background = page.getByRole('button', { name, exact: true });
      await background.click();
      await expect(background).toHaveAttribute('aria-pressed', 'true');
      expect(await page.locator('.translation-text').textContent()).toBe(text);
      await expect(page.locator('.glass-overlay')).toHaveAttribute('data-capture-id', captureId!);
      expect(await page.locator('.action-pill').boundingBox()).toEqual(pillBounds);
    }
    await copy.click();
    await expect(copy).toHaveAttribute('data-copied', 'true');
    await expect(copy.locator('.lucide-check')).toHaveCount(1);
    await expect(copy.locator('.lucide-copy')).toHaveCount(0);
    await expect(page.locator('.compact-feedback')).toHaveCount(0);
    expect(await page.locator('.action-pill').boundingBox()).toEqual(pillBounds);
    await expect(copy).not.toHaveAttribute('data-copied', 'true', { timeout: 3000 });
    await expect(copy.locator('.lucide-copy')).toHaveCount(1);
    await page.screenshot({ path: `test-results/glass-material-${reducedMotion}.png` });
  });
}

for (const scale of [1, 1.25, 1.5, 2]) {
  test(`the short glass keeps 380 px and eight lines at most at ${scale * 100}% device scale`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: scale });
    const page = await context.newPage();
    await page.goto('/?window=overlay&demo=1');
    const copy = page.getByRole('button', { name: 'Copy translation', exact: true });
    await expect(copy).toBeEnabled();
    const bubble = page.locator('.translation-bubble');
    const bounds = await bubble.boundingBox();
    expect(bounds?.width).toBe(380);
    expect(bounds!.height).toBeLessThanOrEqual(8 * 24 + 29);
    const style = await bubble.evaluate((el) => ({
      radius: getComputedStyle(el).borderRadius,
      opacity: getComputedStyle(el).opacity,
    }));
    expect(style.radius).toBe('28px');
    expect(style.opacity).toBe('1'); // alpha applies to background, not text
    await expect(bubble.getByRole('heading')).toHaveCount(0);
    await page.screenshot({ path: `test-results/bubble-scale-${scale}.png` });
    await context.close();
  });
}

test('a capture without an anchor translates at once at the bottom, as a short glass', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('radio', { name: 'Clipboard', exact: true }).check();
  await page.getByRole('button', { name: 'Simulate Ctrl + Alt + T', exact: true }).click();
  const overlay = page.locator('.glass-overlay');
  await expect(overlay).toHaveAttribute('data-placement', 'bottom');
  await expect(overlay).toHaveAttribute('data-form', 'short');
  await expect(overlay.locator('.dock-tab')).toHaveCount(0);
  await expect(overlay.getByRole('button', { name: 'Translate', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toBeEnabled();
  expect(((await page.locator('.translation-text .reveal').textContent()) ?? '').length).toBeGreaterThan(0);
  // Bottom centre of the preview.
  const box = (await overlay.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
});

// Reading budget (2026-09-14): a glass the pointer visited and left dims within four
// seconds, then leaves on its own; no tab, no fold.
test('leaving a finished glass after a visit dims it within four seconds, then closes it', async ({ page }) => {
  await page.goto('/?window=overlay&demo=1');
  const copy = page.getByRole('button', { name: 'Copy translation', exact: true });
  await expect(copy).toBeEnabled();
  await page.locator('.translation-copy').hover();
  await page.waitForTimeout(1100);
  await page.mouse.move(5, 5);
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-dimming', 'true', { timeout: 5000 });
  await expect(page.locator('.glass-overlay')).toHaveCount(0, { timeout: 4000 });
});

test('a pinned reader never leaves on its own', async ({ page }) => {
  test.slow(); // twelve seconds of deliberate waits, plus a cold first load of the dev server
  await page.goto('/?window=overlay&demo=1&scenario=long');
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-form', 'reader');
  const pin = page.getByRole('button', { name: 'Pin', exact: true });
  await pin.click();
  await expect(page.getByRole('button', { name: 'Unpin', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.translation-copy').hover();
  await page.waitForTimeout(1100);
  await page.mouse.move(5, 5);
  await page.waitForTimeout(4500);
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-dimming', 'false');
  await page.getByRole('button', { name: 'Unpin', exact: true }).click();
  // Unpinned: a read of a second, then gone, and the band dims within four seconds.
  await page.locator('.translation-copy').hover();
  await page.waitForTimeout(1100);
  await page.mouse.move(5, 5);
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-dimming', 'true', { timeout: 5000 });
});

// The Îlot's wait: the working pill, empty for 250 ms then the Perle, nothing textual.
test('the working pill waits while the engine streams; a long result then lands whole as a reader band', async ({
  page,
}) => {
  await page.goto('/?window=overlay&demo=1&scenario=long');
  const pill = page.locator('.working-pill');
  await expect(pill).toHaveAttribute('aria-label', 'Working');
  // The pill enters on the spring (glide and scale are paint only): measured at rest.
  await expect(pill).toHaveCSS('transform', 'none');
  expect(await pill.boundingBox()).toMatchObject({ width: 44, height: 28 });
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-form', 'pending');
  // A long source waits at the bottom from the start (UI-025): the band is born there.
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-placement', 'bottom');
  await expect(page.locator('.translation-bubble')).toHaveCount(0);
  await expect(pill.locator('.ldr.perle')).toHaveCount(1);
  await expect(page.locator('.wait-pill')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toBeEnabled({ timeout: 30000 });
  await expect(pill).toHaveCount(0);
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-form', 'reader');
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-placement', 'bottom');
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-moving', 'false');
  await expect(page.locator('.translation-copy')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.translation-bubble')).toHaveAttribute('data-reveal', 'true');
  expect(await page.locator('.translation-bubble').evaluate((el) => getComputedStyle(el).animationName)).toBe(
    'band-in',
  );
  expect(((await page.locator('.translation-text .reveal').textContent()) ?? '').length).toBeGreaterThan(200);
});

// The 0.4 journey, asked for (uiVersion « v4 »): its spinner pill.
test('the spinner turns while the engine streams; a long result then lands whole as a reader band', async ({
  page,
}) => {
  await page.goto('/?window=overlay&demo=1&scenario=long&ui=v4');
  const pill = page.locator('.wait-pill');
  await expect(pill).toHaveAttribute('aria-label', 'Translating');
  // The pill enters on the spring (glide and scale are paint only): measured at rest.
  await expect(pill).toHaveCSS('transform', 'none');
  expect(await pill.boundingBox()).toMatchObject({ width: 60, height: 28 });
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-form', 'pending');
  // A long source waits at the bottom from the start (UI-025): the band is born there.
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-placement', 'bottom');
  await expect(page.locator('.translation-bubble')).toHaveCount(0);
  expect(await pill.locator('svg').count()).toBe(1);
  expect(
    await pill
      .locator('svg')
      .evaluate((el) => [
        getComputedStyle(el).animationName,
        getComputedStyle(el).animationDuration,
        getComputedStyle(el).animationTimingFunction,
        Number(el.getAttribute('width')),
      ]),
  ).toEqual(['wait-spin', '1s', 'linear', 16]);
  await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toBeEnabled({ timeout: 30000 });
  await expect(pill).toHaveCount(0);
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-form', 'reader');
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-placement', 'bottom');
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-moving', 'false');
  await expect(page.locator('.translation-copy')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.translation-bubble')).toHaveAttribute('data-reveal', 'true');
  expect(await page.locator('.translation-bubble').evaluate((el) => getComputedStyle(el).animationName)).toBe(
    'band-in',
  );
  expect(((await page.locator('.translation-text .reveal').textContent()) ?? '').length).toBeGreaterThan(200);
});

test('the reader band is half the viewport wide, 22/33, whole lines within 45 % of the height, and its menu opens above the pill', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?window=overlay&demo=1&scenario=very-long');
  await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toBeEnabled({ timeout: 15000 });
  const bubble = page.locator('.translation-bubble');
  // The band enters on the spring (glide and scale are paint only): measured at rest.
  await expect(bubble).toHaveCSS('transform', 'none');
  const box = (await bubble.boundingBox())!;
  expect(box.width).toBe(700);
  expect(Math.abs(box.x + box.width / 2 - 700)).toBeLessThanOrEqual(1);
  const lines = Math.floor((Math.round(800 * 0.45) - 34) / 33);
  expect(box.height).toBe(lines * 33 + 34);
  expect(box.height).toBeLessThanOrEqual(360);
  await expect(page.locator('.translation-copy')).toHaveCSS('font-size', '22px');
  await expect(page.locator('.translation-copy')).toHaveCSS('line-height', '33px');
  await expect(page.locator('.translation-copy')).toHaveCSS('color', 'rgb(29, 29, 31)');
  await expect(page.locator('.translation-copy')).toHaveAttribute('data-scroll-edge', 'top');
  await expect(page.getByRole('button', { name: 'Pin', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close', exact: true })).toBeVisible();
  await expect(page.locator('.action-pill')).toHaveCSS('transform', 'none');
  await page.getByRole('button', { name: 'More options', exact: true }).click();
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await expect(menu).toHaveCSS('transform', 'none');
  const menuBox = (await menu.boundingBox())!;
  const pill = (await page.locator('.action-pill').boundingBox())!;
  expect(Math.round(pill.y - (menuBox.y + menuBox.height))).toBe(6);
  expect(await menu.getByRole('menuitem').count()).toBe(4);
  expect(menuBox.height).toBeLessThanOrEqual(menuLayout.reserve);
  await expect(menu.getByRole('menuitem', { name: 'Expand' })).toHaveCount(0);
  // Same painted material as the glass (src/theme.css), light theme here.
  expect(await menu.evaluate((el) => getComputedStyle(el).backgroundImage)).toBe(
    await bubble.evaluate((el) => getComputedStyle(el).backgroundImage),
  );
});

test('a click restores the whole budget: the glass stays at least two and a half seconds after the pointer leaves', async ({
  page,
}) => {
  await page.goto('/?window=overlay&demo=1&scenario=long');
  const copy = page.getByRole('button', { name: 'Copy translation', exact: true });
  await expect(copy).toBeEnabled();
  await page.locator('.translation-copy').hover();
  await page.getByRole('button', { name: 'More options', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Show original', exact: true }).click();
  await expect(page.locator('.original-copy')).toBeVisible();
  // The click restored the whole budget (33 s for this text); a visit of a second then a
  // departure brings what remains to four seconds, never under two and a half.
  await page.locator('.translation-copy').hover();
  await page.waitForTimeout(1100);
  await page.mouse.move(5, 5);
  await page.waitForTimeout(2000);
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-dimming', 'false');
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-dimming', 'true', { timeout: 4000 });
});

test('a pointer resting beside the glass keeps it; it dims once the pointer is 32 px away', async ({ page }) => {
  await page.goto('/?window=overlay&demo=1');
  await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toBeEnabled();
  await page.locator('.translation-copy').hover();
  await page.waitForTimeout(1100);
  const box = (await page.locator('.glass-overlay').boundingBox())!;
  await page.mouse.move(box.x + box.width + 16, box.y + box.height / 2);
  await page.waitForTimeout(4500);
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-dimming', 'false');
  await page.mouse.move(box.x + box.width + 80, box.y + box.height / 2);
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-dimming', 'true', { timeout: 5000 });
  // Coming back while it dims brings it back for five seconds.
  await page.locator('.translation-copy').hover();
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-dimming', 'false');
  await expect(page.locator('.glass-overlay')).toHaveCSS('opacity', '1', { timeout: 2000 });
});

test('the original reads two sizes down on a tinted field and the text keeps 22 px from the rounded edge', async ({
  page,
}) => {
  await page.goto('/?window=overlay&demo=1');
  await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'More options', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Show original', exact: true }).click();
  const original = page.locator('.original-copy');
  await expect(original).toHaveCSS('font-size', '14px');
  // Ink of the light theme at .85 on ink at .05 (src/theme.css).
  await expect(original).toHaveCSS('color', 'rgba(29, 29, 31, 0.85)');
  await expect(original).toHaveCSS('background-color', 'rgba(29, 29, 31, 0.05)');
  await expect(page.locator('.translation-copy')).toHaveCSS('padding', '16px 22px 13px');
  await expect(page.locator('.translation-copy')).toHaveCSS('letter-spacing', 'normal');
});

test('error never enables copy of a partial or absent result', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('radio', { name: 'Network error', exact: true }).check();
  await page.getByRole('button', { name: 'Simulate Ctrl + Alt + T', exact: true }).click();
  await expect(page.locator('.translation-bubble')).toContainText('indisponible');
  await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toBeDisabled();
});

// The capsule window is retired (DA-PLAN §4.2, lot 6); its small native window is now the
// halo, sized by Rust to what it draws + its margin: the page fits it, stays transparent and
// never takes the pointer.
test('halo fits its native viewport without overflow, transparent and never under the pointer', async ({ page }) => {
  await page.setViewportSize({ width: 236, height: 48 });
  await page.route('**/?window=halo&fixture=1', async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('/src/main.tsx', '/e2e/native-fixture.ts') });
  });
  await page.goto('/?window=halo&fixture=1');
  await expect(page.locator('html')).toHaveAttribute('data-halo-ready', 'true');
  await page.evaluate(() =>
    (window as unknown as { nativeFixture: { halo: (event: unknown) => Promise<void> } }).nativeFixture.halo({
      generation: 1,
      phase: 'work',
      lines: [{ x: 12, y: 12, width: 212, height: 24 }],
      width: 236,
      height: 48,
    }),
  );
  // The reflection's run, 1 px wider on each side (the lab's margin).
  const line = page.locator('.halo-veil');
  expect(await line.boundingBox()).toEqual({ x: 11, y: 12, width: 214, height: 24 });
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(page.locator('.halo')).toHaveCSS('pointer-events', 'none');
  expect(
    await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight]),
  ).toEqual([236, 48]);
});

// « Suivre Windows » (the default) with Windows reducing animations: data-motion follows the
// media, the waiting pill's loop rests and the reveal keeps only a short fade, nothing moving.
// The Îlot's orb (lot 8) and, asked for, the 0.4 spinner.
for (const { name, query, pill } of journeys)
  test(`reduced motion ${name === 'Îlot' ? 'stills the orb' : 'freezes the spinner'} and keeps only a short fade for the reveal`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`/?window=overlay&demo=1&scenario=long${query}`);
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
    await expect(page.locator(pill)).toHaveCount(1);
    expect(
      await page
        .locator(name === 'Îlot' ? `${pill} .ldr` : `${pill} svg`)
        .evaluate((el) => getComputedStyle(el).animationPlayState),
    ).toBe('paused');
    await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toBeEnabled({ timeout: 30000 });
    const reveals = await page.evaluate(() =>
      ['.translation-bubble', '.translation-text .reveal'].map((selector) => {
        const el = document.querySelector(selector);
        if (!el) return 'missing';
        const style = getComputedStyle(el);
        return {
          name: style.animationName,
          duration: parseFloat(style.animationDuration),
          delay: style.animationDelay,
          transform: style.transform,
        };
      }),
    );
    for (const reveal of reveals) expect(reveal).toMatchObject({ name: 'text-in', delay: '0s', transform: 'none' });
    for (const reveal of reveals) expect((reveal as { duration: number }).duration).toBeLessThanOrEqual(0.15);
  });

test('comparison shows source without replacing the translated result', async ({ page }) => {
  await page.goto('/?window=overlay&demo=1');
  await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'More options', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Show original', exact: true }).click();
  await expect(page.locator('.original-copy')).toContainText('Could you send the updated proposal');
  await expect(page.locator('.translation-copy')).toContainText('Pourriez-vous envoyer');
});

test('explicit replacement is accessible for an editable completed selection', async ({ page }) => {
  await page.goto('/?window=overlay&demo=1');
  await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'More options', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Replace', exact: true }).click();
  await expect(page.locator('.compact-feedback')).toContainText('Result pasted into the selection');
});

test('settings keep connection details collapsed, offer the reading presets and expose history deletion', async ({
  page,
}) => {
  await page.goto('/?window=settings&demo=1');
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  const tab = (name: string) => page.getByRole('tab', { name, exact: true });
  // The server's card shows its facts; the address and the key only appear behind « Edit ».
  await tab('Server').click();
  await expect(page.getByRole('textbox', { name: 'API key', exact: true })).toHaveCount(0);
  await page.locator('[data-server]').first().getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'API key', exact: true })).toHaveCount(1);
  await tab('Appearance').click();
  await expect(
    page
      .getByRole('radiogroup', { name: 'Text size', exact: true })
      .getByRole('radio', { name: 'Extra large', exact: true }),
  ).toBeVisible();
  await page.getByRole('combobox', { name: 'Auto close', exact: true }).click();
  await expect(page.getByRole('option', { name: 'Never', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await tab('Data').click();
  await expect(page.locator('.st-history-item')).toHaveCount(1);
  await page.getByRole('button', { name: 'Delete all', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete all', exact: true }).click();
  await expect(page.locator('.st-history-item')).toHaveCount(0);
  await expect(page.getByText('No saved text.')).toBeVisible();
  await page.screenshot({ path: 'test-results/settings.png', fullPage: true });
});

test('menu supports keyboard navigation and restores focus after Escape', async ({ page }) => {
  await page.goto('/?window=overlay&demo=1');
  await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toBeEnabled();
  const trigger = page.getByRole('button', { name: 'More options', exact: true });
  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Show original', exact: true })).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.getByRole('menuitem', { name: 'Close', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page.locator('.translation-bubble')).toBeVisible();
});

for (const scenario of ['selection', 'error']) {
  test(`closing stays available during ${scenario}`, async ({ page }) => {
    await page.goto(`/?window=overlay&demo=1&scenario=${scenario}`);
    if (scenario === 'error') await expect(page.locator('.error-copy')).toBeVisible();
    await page.getByRole('button', { name: 'More options', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Close', exact: true }).click();
    await expect(page.locator('.translation-bubble')).toHaveCount(0);
  });
}

test('the short glass menu overlays the glass under the pill, in the same material', async ({ page }) => {
  await page.goto('/?window=overlay&demo=1');
  await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toBeEnabled();
  const bubble = page.locator('.translation-bubble');
  const before = await bubble.boundingBox();
  expect(before?.width).toBe(380);
  await expect(page.getByRole('button', { name: 'More options', exact: true })).toBeInViewport();
  await page.getByRole('button', { name: 'More options', exact: true }).click();
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await expect(menu).toHaveCSS('transform', 'none');
  const after = await bubble.boundingBox();
  expect(after).toEqual(before);
  const menuBounds = await menu.boundingBox();
  expect(Math.round(menuBounds!.y - before!.y)).toBe(20);
  expect(Math.round(before!.x + before!.width - (menuBounds!.x + menuBounds!.width))).toBe(16);
  expect(menuBounds!.width).toBe(196);
  expect(menuBounds!.height).toBeLessThanOrEqual(menuLayout.reserve);
  // The painted material of 0.6, the fallback of the real glass (light here): a soft light from the
  // top over the lab's grain and an opaque fill, the luminous rim over a 0.5 px edge (src/theme.css).
  const material = await bubble.evaluate((el) => ({
    image: getComputedStyle(el).backgroundImage,
    shadow: getComputedStyle(el).boxShadow,
  }));
  expect(material.image).toMatch(
    /^linear-gradient\(rgba\(255, 255, 255, 0\.5\), rgba\(255, 255, 255, 0\) 46%\), url\("data:image\/svg\+xml,.*feTurbulence.*"\), none$/,
  );
  await expect(bubble).toHaveCSS('background-color', 'rgb(250, 249, 253)');
  expect(material.shadow).toContain('rgba(255, 255, 255, 0.5) 0px 0px 0px 0.5px inset');
  expect(material.shadow).toContain('0px 0px 0px 0.5px');
  expect(
    await menu.evaluate((el) => ({
      image: getComputedStyle(el).backgroundImage,
      shadow: getComputedStyle(el).boxShadow,
    })),
  ).toEqual(material);
  expect(await menu.evaluate((el) => !!el.closest('.glass-overlay'))).toBe(true);
  expect(await menu.evaluate((el) => !!el.closest('.translation-bubble'))).toBe(false);
  await expect(page.locator('.glass-overlay')).toHaveCSS('transform', 'none');
  await page.screenshot({ path: 'test-results/short-menu.png' });
});

test('the short glass pill holds Copy, the menu and Close, biting the upper-right edge', async ({ page }) => {
  await page.goto('/?window=overlay&demo=1');
  await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toBeEnabled();
  await expect(page.locator('.action-pill')).toHaveCSS('transform', 'none');
  const bubble = await page.locator('.translation-bubble').boundingBox();
  const pill = await page.locator('.action-pill').boundingBox();
  expect(pill!.width).toBe(76);
  expect(pill!.height).toBe(28);
  expect(pill!.y).toBe(bubble!.y - 14);
  expect(pill!.x + pill!.width).toBe(bubble!.x + bubble!.width - 16);
  expect(await page.locator('.translation-bubble button').count()).toBe(0);
  await expect(page.getByRole('button', { name: 'Pin', exact: true })).toHaveCount(0);
  const textBefore = await page.locator('.translation-copy').boundingBox();
  await page.getByRole('button', { name: 'More options', exact: true }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  expect(await page.locator('.translation-bubble').boundingBox()).toEqual(bubble);
  expect(await page.locator('.translation-copy').boundingBox()).toEqual(textBefore);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.locator('.glass-overlay')).toHaveCount(0);
});

test('very long reader preserves all text and supports wheel and keyboard without scrollbars', async ({ page }) => {
  await page.goto('/?window=overlay&demo=1&scenario=very-long');
  await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toBeEnabled();
  const content = page.getByRole('document', { name: 'Translation', exact: true });
  const fullText = await page.locator('.translation-text').textContent();
  expect(fullText!.length).toBeGreaterThan(4000);
  await expect(content).toHaveCSS('scrollbar-width', 'none');
  await expect(content).toHaveAttribute('data-scroll-edge', 'top');
  const indicator = page.locator('.scroll-indicator');
  await expect(indicator).toHaveCSS('opacity', '0');
  await content.focus();
  await page.keyboard.press('PageDown');
  await expect.poll(() => content.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await expect(content).toHaveAttribute('data-scroll-edge', 'middle');
  await expect(indicator).toHaveCSS('opacity', '1');
  await page.keyboard.press('End');
  await expect(content).toHaveAttribute('data-scroll-edge', 'bottom');
  await page.keyboard.press('Home');
  await expect(content).toHaveAttribute('data-scroll-edge', 'top');
  // Off the reading area but still on the glass: the indicator fades, the glass stays.
  await page.locator('.action-pill').hover();
  await expect(indicator).toHaveCSS('opacity', '0', { timeout: 3000 });
  await content.hover();
  await expect(indicator).toHaveCSS('opacity', '1');
  await page.mouse.wheel(0, 240);
  await expect.poll(() => content.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  expect(await page.locator('.translation-text').textContent()).toBe(fullText);
  await expect(page.locator('.action-pill')).toBeInViewport();
  await expect(page.locator('.translation-bubble')).toHaveCSS('width', `${page.viewportSize()!.width / 2}px`);
});

test('demo can replay and change scenarios without stale capture deduplication', async ({ page }) => {
  await page.goto('/');
  const begin = page.getByRole('button', { name: 'Simulate Ctrl + Alt + T', exact: true });
  await begin.click();
  await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toBeEnabled();
  await page.getByRole('radio', { name: 'Network error', exact: true }).check();
  await begin.click();
  await expect(page.locator('.error-copy')).toContainText('indisponible');
  await page.getByRole('radio', { name: 'Selection', exact: true }).check();
  await begin.click();
  await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toBeEnabled();
});

test('reduced motion opens the menu without any transform, with a fade of 150 ms at most', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?window=overlay&demo=1');
  await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'More options', exact: true }).click();
  // Sampled every frame from the click: never a transform, fully opaque within 150 ms.
  const samples = await page.evaluate(
    () =>
      new Promise<Array<{ t: number; opacity: number; transform: string }>>((resolve) => {
        const start = performance.now();
        const out: Array<{ t: number; opacity: number; transform: string }> = [];
        const tick = () => {
          const menu = document.querySelector('.more-menu');
          if (menu) {
            const style = getComputedStyle(menu);
            out.push({ t: performance.now() - start, opacity: Number(style.opacity), transform: style.transform });
          }
          if (performance.now() - start < 400) requestAnimationFrame(tick);
          else resolve(out);
        };
        tick();
      }),
  );
  expect(samples.length).toBeGreaterThan(0);
  for (const sample of samples) expect(sample.transform).toBe('none');
  for (const sample of samples.filter((sample) => sample.t > 200)) expect(sample.opacity).toBe(1);
  await expect(page.getByRole('menu')).toHaveCSS('opacity', '1');
});

test('a short result opens beside the selection from the pill row and never becomes a reader', async ({ page }) => {
  await page.goto('/?window=overlay&demo=1');
  const copy = page.getByRole('button', { name: 'Copy translation', exact: true });
  await expect(copy).toBeEnabled();
  const overlay = page.locator('.glass-overlay');
  await expect(overlay).toHaveAttribute('data-form', 'short');
  await expect(overlay).toHaveAttribute('data-placement', 'anchored');
  expect(await page.locator('.translation-bubble').evaluate((el) => getComputedStyle(el).animationName)).toBe(
    'glass-open',
  );
  await expect(page.locator('.translation-copy')).toHaveCSS('line-height', '24px');
  await expect(page.getByRole('menuitem', { name: 'Expand' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Collapse' })).toHaveCount(0);
});

for (const { name, query, pill } of journeys)
  test(`a result past the ceiling lands whole and keeps the view at the top (${name})`, async ({ page }) => {
    await page.goto(`/?window=overlay&demo=1&scenario=very-long${query}`);
    const content = page.locator('.translation-copy');
    await expect(page.locator(pill)).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toBeEnabled({ timeout: 15000 });
    await expect(content).toHaveAttribute('data-capped', 'true');
    expect(await content.evaluate((el) => el.scrollTop)).toBe(0);
    await expect(page.locator(pill)).toHaveCount(0);
  });

test('browser settings save automatically, identify simulated checks and close back to preview', async ({ page }) => {
  await page.goto('/?window=settings&demo=1');
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
  const tab = (name: string) => page.getByRole('tab', { name, exact: true });
  await tab('Appearance').click();
  await page
    .getByRole('radiogroup', { name: 'Text size', exact: true })
    .getByRole('radio', { name: 'Large', exact: true })
    .click();
  await expect(
    page.getByRole('radiogroup', { name: 'Text size', exact: true }).getByRole('radio', { name: 'Large', exact: true }),
  ).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.st-save')).toHaveText('Saved');
  await tab('Server').click();
  await expect(page.getByText('Browser preview · simulated connection')).toBeVisible();
  const card = page.locator('[data-server]').first();
  await expect(card.locator('.ft-check-line')).toHaveText(/Connected·.+·[\d,]+ msDetails/);
  await tab('Shortcuts').click();
  const menu = page.locator('[data-field="menuShortcut"]');
  await menu.getByRole('button', { name: 'Change', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Menu shortcut: press the combination', exact: true })).toHaveText(
    'Press the combination…',
  );
  await page.keyboard.press('Control+Shift+K');
  await expect(menu.locator('kbd')).toHaveText(['Ctrl', 'Shift', 'K']);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Simulate Ctrl + Alt + T', exact: true })).toBeVisible();
});

// FE-04 (audit Elio): the glass's live region stayed on « Translation complete » during a copy.
test('the live status says the copy over the completion, then the completion again', async ({ page }) => {
  await page.goto('/?window=overlay&demo=1&background=light&ui=v4');
  const copy = page.getByRole('button', { name: 'Copy translation', exact: true });
  await expect(copy).toBeEnabled();
  const status = page.locator('.glass-overlay .sr-only[role="status"]');
  await expect(status).toHaveText('Translation complete');
  await copy.click();
  await expect(status).toHaveText('Translation copied');
  await expect(page.locator('.glass-overlay [role="status"]', { hasText: /Translation/ })).toHaveCount(1);
  await expect(status).toHaveText('Translation complete', { timeout: 3000 });
});
