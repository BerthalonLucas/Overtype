import { test, expect, type Page } from '@playwright/test';

// Lot 2 (docs/DA-PLAN.md): the setting « Animations : suivre Windows / toujours / réduites »
// and the preset « smooth » / « bouncy » reach everything that moves in the browser preview.
// Settings go through the preview bridge, as the Settings window would save them.
async function saveSettings(page: Page, next: Record<string, unknown>) {
  await page.evaluate(async (next) => {
    const { bridge } = await import('/src/bridge.ts');
    await bridge.saveSettings({ ...(await bridge.getSettings()), ...next });
  }, next);
}

// Every transform the element paints during `ms` after the call, one sample per frame.
async function transformsDuring(page: Page, selector: string, ms: number) {
  return page.evaluate(
    ({ selector, ms }) =>
      new Promise<string[]>((resolve) => {
        const start = performance.now();
        const seen: string[] = [];
        const tick = () => {
          const element = document.querySelector(selector);
          if (element) seen.push(getComputedStyle(element).transform);
          if (performance.now() - start < ms) requestAnimationFrame(tick);
          else resolve(seen);
        };
        tick();
      }),
    { selector, ms },
  );
}

// The loop of the waiting pill: the Îlot's orb (lot 8, the Perle breathing in 2.4 s), the preview's
// default as the app's; asked for (`&ui=v4`), the 0.4 spinner turning once a second.
const loops = [
  { name: 'Îlot', query: '', loop: '.working-pill .ldr', period: '2.4s' },
  { name: '0.4', query: '&ui=v4', loop: '.wait-pill svg', period: '1s' },
] as const;

for (const { name, query, loop, period } of loops)
  test(`« suivre Windows » follows prefers-reduced-motion live (${name})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(`/?window=overlay&demo=1&scenario=long${query}`);
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-motion', 'full');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(html).toHaveAttribute('data-motion', 'reduced');
    expect(await page.locator(loop).evaluate((el) => getComputedStyle(el).animationPlayState)).toBe('paused');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(html).toHaveAttribute('data-motion', 'full');
    expect(
      await page
        .locator(loop)
        .evaluate((el) => [getComputedStyle(el).animationPlayState, getComputedStyle(el).animationDuration]),
    ).toEqual(['running', period]);
  });

test('« suivre Windows » tells Motion live too, not only the CSS', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/?window=overlay&demo=1');
  await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toBeEnabled();
  const more = page.getByRole('button', { name: 'More options', exact: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  await more.click();
  for (const transform of await transformsDuring(page, '.more-menu', 250)) expect(transform).toBe('none');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
  await more.click();
  expect((await transformsDuring(page, '.more-menu', 250)).some((transform) => transform !== 'none')).toBe(true);
});

for (const { name, query, loop } of loops)
  test(`« réduites » wins over a system that does not reduce: loops rest, menus and pills never move (${name})`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(`/?window=overlay&demo=1&scenario=long${query}`);
    await saveSettings(page, { motion: 'reduced' });
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
    expect(await page.locator(loop).evaluate((el) => getComputedStyle(el).animationPlayState)).toBe('paused');
    await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toBeEnabled({ timeout: 30000 });
    // Motion is told too (MotionConfig), not only the CSS: the menu opens without a transform.
    await page.getByRole('button', { name: 'More options', exact: true }).click();
    for (const transform of await transformsDuring(page, '.more-menu', 300)) expect(transform).toBe('none');
  });

for (const { name, query, loop, period } of loops)
  test(`« toujours » animates even when the system reduces motion (${name})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`/?window=overlay&demo=1&scenario=long${query}`);
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
    await saveSettings(page, { motion: 'full' });
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
    expect(
      await page
        .locator(loop)
        .evaluate((el) => [getComputedStyle(el).animationPlayState, getComputedStyle(el).animationDuration]),
    ).toEqual(['running', period]);
    await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toBeEnabled({ timeout: 30000 });
    await page.getByRole('button', { name: 'More options', exact: true }).click();
    // The menu enters on the spring: glide and scale show, then it rests.
    expect((await transformsDuring(page, '.more-menu', 250)).some((transform) => transform !== 'none')).toBe(true);
    await expect(page.getByRole('menu')).toHaveCSS('transform', 'none');
  });

test('the preset reaches Motion and the CSS: « bouncy » enters from 0.94 and springs the band', async ({ page }) => {
  await page.goto('/?window=overlay&demo=1&scenario=long');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-motion-preset', 'smooth');
  expect(await html.evaluate((el) => el.style.getPropertyValue('--motion-enter-ms'))).toBe('613ms');
  await saveSettings(page, { motionPreset: 'bouncy', motion: 'full' });
  await expect(html).toHaveAttribute('data-motion-preset', 'bouncy');
  expect(
    await html.evaluate((el) => [
      el.style.getPropertyValue('--motion-enter-ms'),
      el.style.getPropertyValue('--motion-morph-ms'),
    ]),
  ).toEqual(['700ms', '775ms']);
  await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toBeEnabled({ timeout: 30000 });
  const band = await page.locator('.translation-bubble').evaluate((el) => {
    const style = getComputedStyle(el);
    return { name: style.animationName, duration: style.animationDuration, easing: style.animationTimingFunction };
  });
  expect(band).toMatchObject({ name: 'band-in', duration: '0.7s' });
  expect(band.easing).toMatch(/^linear\(/);
  // Motion's first frame of the menu is the preset's entrance scale.
  await page.getByRole('button', { name: 'More options', exact: true }).click();
  const scales = (await transformsDuring(page, '.more-menu', 250))
    .filter((transform) => transform !== 'none')
    .map((transform) => Number(/^matrix\(([^,]+),/.exec(transform)![1]));
  expect(scales.length).toBeGreaterThan(0);
  expect(Math.min(...scales)).toBeGreaterThanOrEqual(0.94 - 0.001);
  expect(Math.min(...scales)).toBeLessThan(0.97);
});

// The shape utility for lots 7-9 (menu → pill): the box springs its width, height and radius,
// the content stays centred at its natural size, and reduced motion sets the shape at once.
test('animateSurface changes the shape around a centred layer that never scales', async ({ page }) => {
  await page.goto('/?window=overlay&demo=1');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
  const result = await page.evaluate(async () => {
    const { animateSurface } = await import('/src/motion/surface.ts');
    const { motionPresets } = await import('/src/motion/tokens.ts');
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:40px;top:40px;width:218px;height:116px;border-radius:16px;background:#888';
    box.innerHTML =
      '<div class="shape-clip"><div class="shape-layer" style="font:13px/1.3 sans-serif">Fix ↵</div></div>';
    document.body.append(box);
    const layer = box.querySelector<HTMLElement>('.shape-layer')!;
    const natural = layer.getBoundingClientRect();
    const frames: Array<{ w: number; h: number; dx: number; dy: number; lw: number; lh: number }> = [];
    let sampling = true;
    const sample = () => {
      const outer = box.getBoundingClientRect(),
        inner = layer.getBoundingClientRect();
      frames.push({
        w: outer.width,
        h: outer.height,
        dx: inner.left + inner.width / 2 - (outer.left + outer.width / 2),
        dy: inner.top + inner.height / 2 - (outer.top + outer.height / 2),
        lw: inner.width,
        lh: inner.height,
      });
      if (sampling) requestAnimationFrame(sample);
    };
    sample();
    await animateSurface(box, { width: 110, height: 32 }, motionPresets.smooth, false);
    sampling = false;
    const end = { width: box.style.width, height: box.style.height, radius: box.style.borderRadius };
    // Reduced: no frames in between.
    const started = performance.now();
    await animateSurface(box, { width: 218, height: 116 }, motionPresets.smooth, true);
    const reduced = {
      elapsed: performance.now() - started,
      width: box.style.width,
      height: box.style.height,
      radius: box.style.borderRadius,
    };
    box.remove();
    return { natural: { w: natural.width, h: natural.height }, frames, end, reduced };
  });
  const between = result.frames.filter((frame) => frame.w > 110.5 && frame.w < 217.5);
  expect(between.length).toBeGreaterThan(3);
  for (const frame of result.frames) {
    expect(Math.abs(frame.dx)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(frame.dy)).toBeLessThanOrEqual(0.5);
    expect(frame.lw).toBeCloseTo(result.natural.w, 1);
    expect(frame.lh).toBeCloseTo(result.natural.h, 1);
  }
  expect(result.end).toEqual({ width: '110px', height: '32px', radius: '16px' });
  expect(result.reduced).toMatchObject({ width: '218px', height: '116px', radius: '16px' });
  expect(result.reduced.elapsed).toBeLessThan(100);
});

// DA-PLAN lot 2, « Accroc »: Lucas had « Effets d'animation » off without knowing it.
test('the Settings say when Windows is the one reducing animations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?window=settings&demo=1');
  await page.getByRole('tab', { name: 'Appearance', exact: true }).click();
  const notice = page.getByText('Windows asks to reduce animations.', { exact: true });
  await expect(
    page
      .getByRole('radiogroup', { name: 'Animations', exact: true })
      .getByRole('radio', { name: 'Follow Windows', exact: true }),
  ).toHaveAttribute('aria-checked', 'true');
  await expect(notice).toBeVisible();
  await page
    .getByRole('radiogroup', { name: 'Animations', exact: true })
    .getByRole('radio', { name: 'Always', exact: true })
    .click();
  await expect(notice).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
  await page
    .getByRole('radiogroup', { name: 'Animations', exact: true })
    .getByRole('radio', { name: 'Follow Windows', exact: true })
    .click();
  await expect(notice).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(notice).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
});

// In the app, Rust's reading of « Effets d'animation » wins over WebView2's media query, which
// nobody has shown to follow that switch.
test('IPC fixture: « suivre Windows » believes Rust, live, over prefers-reduced-motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.route('**/?window=settings&fixture=1', async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('/src/main.tsx', '/e2e/native-fixture.ts') });
  });
  await page.goto('/?window=settings&fixture=1');
  await page.getByRole('tab', { name: 'Appearance', exact: true }).click();
  const html = page.locator('html');
  const notice = page.getByText('Windows asks to reduce animations.', { exact: true });
  await expect(
    page
      .getByRole('radiogroup', { name: 'Animations', exact: true })
      .getByRole('radio', { name: 'Follow Windows', exact: true }),
  ).toBeVisible();
  await expect(html).toHaveAttribute('data-motion', 'full');
  await expect(notice).toHaveCount(0);
  await page.evaluate(() =>
    (
      window as unknown as { nativeFixture: { systemMotion: (reduced: boolean) => Promise<void> } }
    ).nativeFixture.systemMotion(true),
  );
  await expect(html).toHaveAttribute('data-motion', 'reduced');
  await expect(notice).toBeVisible();
  await page.evaluate(() =>
    (
      window as unknown as { nativeFixture: { systemMotion: (reduced: boolean) => Promise<void> } }
    ).nativeFixture.systemMotion(false),
  );
  await expect(html).toHaveAttribute('data-motion', 'full');
  await expect(notice).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      (window as unknown as { nativeFixture: { calls: Array<{ command: string }> } }).nativeFixture.calls.some(
        (call) => call.command === 'system_motion',
      ),
    ),
  ).toBe(true);
});
