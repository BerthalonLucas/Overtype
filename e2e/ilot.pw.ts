import { test, expect, type Page } from '@playwright/test';

// Lot 7 (docs/DA-PLAN.md): the Îlot in the lab frame (src/lab/ilot.tsx), in the browser. The
// measures follow design-lab/verify.mjs (content centred within 0.5 px while the shape changes).
// Browser only: the real window (focus, AZERTY, a real IME) is not validated here.

type Params = Record<string, string>;
const url = (params: Params) =>
  `/lab-frame.html?${new URLSearchParams({ scenario: 'ilot-compact', hold: '1', motion: 'full', ...params })}`;

async function open(page: Page, params: Params = {}) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(url(params));
  await expect(page.locator('[data-ilot]')).toBeVisible();
  // The entrance is over: no transform left on the surface, for 300 ms on end. At the top of a
  // bouncy overshoot Motion's spring gives its target for a frame or two while its speed is
  // near zero, then settles on (e2e/result.pw.ts).
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let since: number | null = null;
        const tick = (now: number) => {
          const s = document.querySelector('.ilot');
          since =
            s && getComputedStyle(s).transform === 'none' && getComputedStyle(s).opacity === '1'
              ? (since ?? now)
              : null;
          if (since !== null && now - since >= 300) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
  return errors;
}
const shape = (page: Page) =>
  page.locator('[data-ilot-shape]').evaluate((el: HTMLElement) => ({
    width: el.offsetWidth,
    height: el.offsetHeight,
    radius: getComputedStyle(el).borderRadius,
  }));
const restsAt = (page: Page, width: number, height: number, radius: number) =>
  expect.poll(() => shape(page), { timeout: 3000 }).toEqual({ width, height, radius: `${radius}px` });
const mode = (page: Page) => page.locator('[data-ilot]').getAttribute('data-mode');
const events = (page: Page) => page.evaluate(() => window.__ilotEvents ?? []);
const lastEvent = async (page: Page) => (await events(page)).at(-1);
// Back from the pill to the menu (the fixture's toggle), compact again.
async function backToMenu(page: Page) {
  await page.getByRole('button', { name: 'Menu ⇄ pilule' }).click();
  await expect(page.locator('[data-ilot]')).toHaveAttribute('data-shape', 'menu');
  await expect(page.locator('[data-ilot]')).toHaveAttribute('data-mode', 'compact');
}
// What Rust sends when the window could not take the keyboard (menu-key, KeyboardEvent.key).
const inject = (page: Page, ...keys: string[]) =>
  page.evaluate((keys) => {
    for (const key of keys) window.dispatchEvent(new CustomEvent('menu-key', { detail: { key } }));
  }, keys);

// Every frame for `ms` while `act` runs: the shape, each content layer and its transform.
async function framesDuring(page: Page, act: () => Promise<unknown>, ms = 900) {
  await page.evaluate(() => {
    const store = {
      frames: [] as Array<{
        w: number;
        h: number;
        layers: Array<{ dx: number; dy: number; transform: string; scaleX: number; scaleY: number }>;
      }>,
      on: true,
    };
    (window as unknown as { __frames: typeof store }).__frames = store;
    const tick = () => {
      const box = document.querySelector<HTMLElement>('[data-ilot-shape]');
      if (box) {
        const outer = box.getBoundingClientRect();
        store.frames.push({
          w: box.offsetWidth,
          h: box.offsetHeight,
          layers: [...box.querySelectorAll<HTMLElement>('.shape-layer')].map((layer) => {
            const inner = layer.getBoundingClientRect();
            // The scale against the layer's unrounded layout size: offsetWidth is snapped to a
            // whole pixel, up to 1 % off on a 100 px layer.
            const style = getComputedStyle(layer);
            return {
              dx: inner.left + inner.width / 2 - (outer.left + outer.width / 2),
              dy: inner.top + inner.height / 2 - (outer.top + outer.height / 2),
              transform: style.transform,
              scaleX: inner.width / parseFloat(style.width),
              scaleY: inner.height / parseFloat(style.height),
            };
          }),
        });
      }
      if (store.on) requestAnimationFrame(tick);
    };
    tick();
  });
  await act();
  await page.waitForTimeout(ms);
  return page.evaluate(() => {
    const store = (window as unknown as { __frames: { frames: unknown[]; on: boolean } }).__frames;
    store.on = false;
    return store.frames;
  }) as Promise<
    Array<{
      w: number;
      h: number;
      layers: Array<{ dx: number; dy: number; transform: string; scaleX: number; scaleY: number }>;
    }>
  >;
}

for (const theme of ['light', 'dark'] as const) {
  test(`compact, grid and field at the lab's sizes (${theme})`, async ({ page }) => {
    const errors = await open(page, { theme });
    // Compact ≈ 110 × 32, fully round (app.css:179-184; plan §9).
    const compact = await shape(page);
    expect(compact.height).toBe(32);
    expect(compact.width).toBeGreaterThanOrEqual(100);
    expect(compact.width).toBeLessThanOrEqual(125);
    expect(compact.radius).toBe('16px');
    await page.keyboard.press('Tab');
    await restsAt(page, 218, 116, 16);
    await page.keyboard.press('Space');
    await restsAt(page, 283, 34, 17);
    await expect(page.getByRole('textbox', { name: 'Describe your change…' })).toBeFocused();
    // The ink follows the theme (src/theme.css).
    expect(await page.locator('.ilot').evaluate((el) => getComputedStyle(el).color)).toBe(
      theme === 'dark' ? 'rgb(245, 246, 248)' : 'rgb(29, 29, 31)',
    );
    expect(errors).toEqual([]);
  });
}

test('the content stays centred and unscaled while the shape springs (menu → grid → compact → pill)', async ({
  page,
}) => {
  await open(page);
  const frames = [
    ...(await framesDuring(page, () => page.keyboard.press('Tab'))),
    ...(await framesDuring(page, () => page.keyboard.press('Escape'))),
    ...(await framesDuring(page, () => page.getByRole('button', { name: 'Menu ⇄ pilule' }).click())),
  ];
  // The spring was seen between the shapes, not a jump.
  expect(frames.filter((frame) => frame.w > 115 && frame.w < 217).length).toBeGreaterThan(3);
  expect(frames.filter((frame) => frame.w > 44 && frame.w < 105).length).toBeGreaterThan(3);
  for (const frame of frames)
    for (const layer of frame.layers) {
      expect(Math.abs(layer.dx)).toBeLessThan(0.5);
      expect(Math.abs(layer.dy)).toBeLessThan(0.5);
      // Only the centring translation: never a scale on the text and icons.
      expect(layer.transform).toMatch(/^matrix\(1, 0, 0, 1, -?[\d.]+, -?[\d.]+\)$/);
      expect(layer.scaleX).toBeCloseTo(1, 2);
      expect(layer.scaleY).toBeCloseTo(1, 2);
    }
  await restsAt(page, 44, 28, 14);
});

test('letters, digits and Enter run the actions; the sixth tile opens the field', async ({ page }) => {
  await open(page, { last: 'translate' });
  const runs: Array<[string, string]> = [
    ['f', 'fix'],
    ['t', 'translate'],
    ['p', 'pro'],
    ['s', 'shorten'],
    ['e', 'email'],
    ['Shift+F', 'fix'],
    ['1', 'fix'],
    ['2', 'translate'],
    ['3', 'pro'],
    ['4', 'shorten'],
    ['5', 'email'],
    ['Enter', 'email'],
  ];
  for (const [key, actionId] of runs) {
    await page.keyboard.press(key);
    expect(await lastEvent(page), key).toEqual({ type: 'choose', actionId });
    await expect(page.locator('[data-ilot]')).toHaveAttribute('data-shape', 'pill');
    // The fixture makes the chosen action the last one, as the app will: Enter then runs Email.
    await backToMenu(page);
  }
  await page.keyboard.press('6');
  await expect(page.locator('[data-ilot]')).toHaveAttribute('data-mode', 'prompt');
  await expect(page.getByRole('textbox')).toHaveValue('');
  // Ctrl and Alt combinations belong to the system.
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+f');
  await page.keyboard.press('Alt+t');
  expect(await mode(page)).toBe('compact');
  expect((await events(page)).length).toBe(runs.length);
});

test('Tab or ↓ unfold the grid; arrows, Home, End and Tab move the highlight and the focus', async ({ page }) => {
  await open(page, { last: 'translate' });
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('[data-ilot]')).toHaveAttribute('data-mode', 'grid');
  // The highlight starts on the last action; the order does not change.
  expect(
    await page
      .locator('.shape-layer:not(.is-leaving) [data-tile]')
      .evaluateAll((tiles) => tiles.map((tile) => tile.getAttribute('data-tile'))),
  ).toEqual(['fix', 'translate', 'pro', 'shorten', 'email', 'ask']);
  const hot = page.locator('.ilot-tile.is-hot');
  await expect(hot).toHaveAttribute('data-tile', 'translate');
  await expect(page.locator('[data-tile="translate"]')).toBeFocused();
  for (const [key, tile] of [
    ['ArrowRight', 'pro'],
    ['ArrowDown', 'ask'],
    ['ArrowLeft', 'email'],
    ['ArrowUp', 'translate'],
    ['End', 'ask'],
    ['Home', 'fix'],
    ['Shift+Tab', 'ask'],
    ['Tab', 'fix'],
    ['ArrowUp', 'shorten'],
  ] as const) {
    await page.keyboard.press(key);
    await expect(hot, key).toHaveAttribute('data-tile', tile);
    await expect(page.locator(`[data-tile="${tile}"]`)).toBeFocused();
  }
  await page.keyboard.press('Enter');
  expect(await lastEvent(page)).toEqual({ type: 'choose', actionId: 'shorten' });
});

test('Space, « / », the ✦ item and an unassigned letter open the field; Enter sends, Escape goes back', async ({
  page,
}) => {
  await open(page);
  const field = page.getByRole('textbox', { name: 'Describe your change…' });
  for (const key of ['Space', '/']) {
    await page.keyboard.press(key);
    await expect(field, key).toBeFocused();
    await expect(field).toHaveValue('');
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-ilot]')).toHaveAttribute('data-mode', 'compact');
  }
  // → reaches the pastille, Enter opens the field.
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-item="ask"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(field).toBeFocused();
  await page.keyboard.press('Escape');
  // A letter that runs nothing opens the field with that letter typed, the caret after it.
  await page.keyboard.press('x');
  await expect(field).toHaveValue('x');
  expect(await field.evaluate((input: HTMLInputElement) => [input.selectionStart, input.selectionEnd])).toEqual([1, 1]);
  await page.keyboard.type('yz f');
  await expect(field).toHaveValue('xyz f');
  // An empty instruction is not sent.
  await page.keyboard.press('Escape');
  await page.keyboard.press('Space');
  await page.keyboard.press('Enter');
  expect(await events(page)).toEqual([]);
  await page.keyboard.type('  plus court  ');
  await page.keyboard.press('Enter');
  expect(await lastEvent(page)).toEqual({ type: 'instruction', length: 10 });
});

test('Escape goes back one step, then closes', async ({ page }) => {
  await open(page, { scenario: 'ilot-grid' });
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-ilot]')).toHaveAttribute('data-mode', 'compact');
  expect(await events(page)).toEqual([]);
  await page.keyboard.press('Escape');
  expect(await lastEvent(page)).toEqual({ type: 'close' });
  await expect(page.locator('[data-ilot]')).toHaveCount(0);
  await open(page, { scenario: 'ilot-prompt' });
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-ilot]')).toHaveAttribute('data-mode', 'compact');
});

test('everything works with the mouse: resting 450 ms on the ✦ unfolds the grid, tiles and items click', async ({
  page,
}) => {
  await open(page);
  // The last action's side never unfolds it (Lucas, 24/09), only the ✦.
  await page.locator('[data-item="last"]').hover();
  await page.waitForTimeout(700);
  expect(await mode(page)).toBe('compact');
  await page.locator('[data-item="ask"]').hover();
  await page.waitForTimeout(250);
  expect(await mode(page)).toBe('compact');
  await expect(page.locator('[data-ilot]')).toHaveAttribute('data-mode', 'grid', { timeout: 1000 });
  await page.locator('[data-tile="pro"]').hover();
  await expect(page.locator('.ilot-tile.is-hot')).toHaveAttribute('data-tile', 'pro');
  await page.locator('[data-tile="pro"]').click();
  expect(await lastEvent(page)).toEqual({ type: 'choose', actionId: 'pro' });
  await backToMenu(page);
  // The last action is now Pro; clicking it runs it.
  await page.locator('[data-item="last"]').click();
  expect(await lastEvent(page)).toEqual({ type: 'choose', actionId: 'pro' });
  await backToMenu(page);
  await page.mouse.move(0, 0);
  await page.locator('[data-item="ask"]').click();
  await expect(page.getByRole('textbox')).toBeFocused();
  await page.keyboard.press('Escape');
  await page.mouse.move(0, 0);
  await page.locator('[data-item="ask"]').hover();
  await expect(page.locator('[data-ilot]')).toHaveAttribute('data-mode', 'grid', { timeout: 1000 });
  await page.locator('[data-tile="ask"]').click();
  await expect(page.locator('[data-ilot]')).toHaveAttribute('data-mode', 'prompt');
});

test('AltGr characters, dead keys and IME composition reach the field as typed', async ({ page }) => {
  await open(page);
  // Compact: AltGr types (Windows reports it as Ctrl+Alt with the AltGraph modifier)…
  const keydown = (init: Omit<KeyboardEventInit, 'view'>) =>
    page.evaluate((init) => {
      const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
      (document.activeElement ?? document.body).dispatchEvent(event);
      return event.defaultPrevented;
    }, init);
  expect(await keydown({ key: 'e', ctrlKey: true, altKey: true })).toBe(false);
  expect(await mode(page)).toBe('compact');
  expect(await keydown({ key: '€', ctrlKey: true, altKey: true, modifierAltGraph: true })).toBe(true);
  const field = page.getByRole('textbox');
  await expect(field).toHaveValue('€');
  // …and in the field the Îlot takes nothing: AltGr, dead keys and composition belong to the input.
  expect(await keydown({ key: 'AltGraph', ctrlKey: true, altKey: true, modifierAltGraph: true })).toBe(false);
  expect(await keydown({ key: '@', ctrlKey: true, altKey: true, modifierAltGraph: true })).toBe(false);
  expect(await keydown({ key: 'Dead', code: 'BracketLeft' })).toBe(false);
  await page.keyboard.insertText('@ê');
  await expect(field).toHaveValue('€@ê');
  // Enter while an IME composes validates the composition, never the instruction.
  expect(await keydown({ key: 'Enter', isComposing: true })).toBe(false);
  expect(await events(page)).toEqual([]);
  await page.keyboard.press('Enter');
  expect(await lastEvent(page)).toEqual({ type: 'instruction', length: 3 });
});

test('keys injected by Rust drive the menu when the window has no keyboard; no field then', async ({ page }) => {
  await open(page, { scenario: 'ilot-injected' });
  // Nothing takes the focus, the real keyboard is not listened to.
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
  await page.keyboard.press('Tab');
  expect(await mode(page)).toBe('compact');
  // The free instruction is visibly unavailable.
  await expect(page.locator('[data-item="ask"]')).toHaveAttribute('aria-disabled', 'true');
  // Playwright refuses to click an aria-disabled item; forced, the click changes nothing.
  await page.locator('[data-item="ask"]').click({ force: true });
  expect(await mode(page)).toBe('compact');
  await inject(page, ' ', 'x', '/');
  expect(await mode(page)).toBe('compact');
  expect((await events(page)).map((event) => event.type === 'key' && event.used)).toEqual([true, false, true]);
  // Two keys back to back act on each other's result.
  await inject(page, 'Tab', 'ArrowRight');
  await expect(page.locator('[data-ilot]')).toHaveAttribute('data-mode', 'grid');
  await expect(page.locator('.ilot-tile.is-hot')).toHaveAttribute('data-tile', 'translate');
  await expect(page.locator('[data-tile="ask"]')).toHaveAttribute('aria-disabled', 'true');
  await inject(page, '6');
  expect(await mode(page)).toBe('grid');
  await inject(page, 'Enter');
  expect((await events(page)).filter((event) => event.type === 'choose')).toEqual([
    { type: 'choose', actionId: 'translate' },
  ]);
  await backToMenu(page);
  // The fixture notes the injected key after the Îlot answered it: the answer comes first.
  await inject(page, 'e');
  expect((await events(page)).slice(-2)).toEqual([
    { type: 'choose', actionId: 'email' },
    { type: 'key', key: 'e', used: true },
  ]);
  await backToMenu(page);
  await inject(page, 'Escape');
  expect((await events(page)).slice(-2)).toEqual([{ type: 'close' }, { type: 'key', key: 'Escape', used: true }]);
});

test('the surface becomes the work pill without being unmounted, and comes back', async ({ page }) => {
  await open(page);
  await page.locator('[data-ilot-shape]').evaluate((el) => {
    (el as HTMLElement & { tag?: number }).tag = 7;
  });
  await page.evaluate(() => {
    window.__ilotShapes = [];
  });
  await page.getByRole('button', { name: 'Menu ⇄ pilule' }).click();
  await expect(page.locator('[data-ilot]')).toHaveAttribute('data-shape', 'pill');
  await restsAt(page, 44, 28, 14);
  expect(await page.locator('[data-ilot-shape]').evaluate((el) => (el as HTMLElement & { tag?: number }).tag)).toBe(7);
  await expect(page.getByRole('status', { name: 'Working' })).toBeVisible();
  const centre = await page.getByRole('status', { name: 'Working' }).evaluate((orb) => {
    const o = orb.getBoundingClientRect(),
      s = document.querySelector('[data-ilot-shape]')!.getBoundingClientRect();
    return [o.left + o.width / 2 - s.left - s.width / 2, o.top + o.height / 2 - s.top - s.height / 2];
  });
  for (const offset of centre) expect(Math.abs(offset)).toBeLessThan(0.5);
  // The pill takes no menu key.
  await page.keyboard.press('f');
  expect(await events(page)).toEqual([]);
  // Hit-test regions (plan §4.3): told at the start and at the end of the change.
  const shapes = await page.evaluate(() =>
    window.__ilotShapes!.map((change) => [change.phase, change.to.width, change.to.height]),
  );
  expect(shapes).toEqual([
    ['start', 44, 28],
    ['end', 44, 28],
  ]);
  await backToMenu(page);
  expect(await page.locator('[data-ilot-shape]').evaluate((el) => (el as HTMLElement & { tag?: number }).tag)).toBe(7);
  await expect.poll(async () => (await shape(page)).height).toBe(32);
});

test('reduced motion: fades only, the shape changes at once and nothing moves', async ({ page }) => {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __entrance: string[] }).__entrance = seen;
    const tick = () => {
      const s = document.querySelector('.ilot');
      if (s) seen.push(getComputedStyle(s).transform);
      if (seen.length < 40) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await open(page, { motion: 'reduce' });
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  const entrance = await page.evaluate(() => (window as unknown as { __entrance: string[] }).__entrance);
  expect(entrance.length).toBeGreaterThan(5);
  expect(entrance.every((transform) => transform === 'none')).toBe(true);
  // The compact width follows the fonts (109 with Segoe UI, 117 on the Linux runner): only the two
  // resting shapes may appear, never a size in between.
  const compact = await shape(page);
  const frames = await framesDuring(page, () => page.keyboard.press('Tab'), 400);
  expect(
    frames.filter(
      (frame) => !(frame.w === compact.width && frame.h === compact.height) && !(frame.w === 218 && frame.h === 116),
    ),
  ).toEqual([]);
  expect(frames.at(-1)).toMatchObject({ w: 218, h: 116 });
});

for (const [preset, scale] of [
  ['smooth', 0.97],
  ['bouncy', 0.94],
] as const) {
  test(`the entrance follows the « ${preset} » preset from the side of the selection`, async ({ page }) => {
    await page.addInitScript(() => {
      const seen: Array<{ transform: string; origin: string }> = [];
      (window as unknown as { __entrance: typeof seen }).__entrance = seen;
      const tick = () => {
        const s = document.querySelector('.ilot');
        if (s) seen.push({ transform: getComputedStyle(s).transform, origin: getComputedStyle(s).transformOrigin });
        if (seen.length < 40) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    for (const origin of ['top', 'bottom'] as const) {
      await open(page, { preset, origin });
      const seen = await page.evaluate(
        () => (window as unknown as { __entrance: Array<{ transform: string; origin: string }> }).__entrance,
      );
      const moving = seen
        .filter((frame) => frame.transform !== 'none')
        .map((frame) => frame.transform.match(/^matrix\(([^,]+), [^,]+, [^,]+, [^,]+, [^,]+, ([^)]+)\)$/)!)
        .map((match) => ({ scale: Number(match[1]), y: Number(match[2]) }));
      expect(moving.length).toBeGreaterThan(2);
      expect(Math.min(...moving.map((frame) => frame.scale))).toBeGreaterThanOrEqual(scale - 0.001);
      expect(Math.min(...moving.map((frame) => frame.scale))).toBeLessThan(scale + 0.02);
      // It glides from the selection: down when the selection is above, up when it is below.
      expect(Math.sign(moving[0].y)).toBe(origin === 'top' ? -1 : 1);
      const height = (await shape(page)).height;
      expect(seen[0].origin.split(' ')[1]).toBe(origin === 'top' ? '0px' : `${height}px`);
    }
  });
}

test('menu semantics, key hints and a focus ring once the keyboard moves', async ({ page }) => {
  await open(page, { last: 'translate' });
  const menu = page.getByRole('menu', { name: 'Actions on the selection' });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem')).toHaveCount(2);
  await expect(page.locator('[data-item="last"]')).toHaveAttribute('aria-keyshortcuts', 'Enter T');
  await expect(page.locator('[data-item="last"]')).toBeFocused();
  // At rest, as in the lab: no ring on the focused default item.
  expect(await page.locator('[data-item="last"]').evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('none');
  await page.keyboard.press('Tab');
  await expect(menu.getByRole('menuitem')).toHaveCount(6);
  expect(
    await menu
      .getByRole('menuitem')
      .evaluateAll((items) => items.map((item) => item.getAttribute('aria-keyshortcuts'))),
  ).toEqual(['F 1', 'T 2', 'P 3', 'S 4', 'E 5', '6 Space /']);
  expect(
    await menu.getByRole('menuitem').evaluateAll((items) => items.map((item) => item.getAttribute('tabindex'))),
  ).toEqual(['-1', '0', '-1', '-1', '-1', '-1']);
  await expect(page.locator('[data-tile="translate"]')).toBeFocused();
  expect(await page.locator('[data-tile="translate"]').evaluate((el) => getComputedStyle(el).outlineStyle)).toBe(
    'none',
  );
  // The ring comes with the first move of the highlight.
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-tile="pro"]')).toBeFocused();
  expect(await page.locator('[data-tile="pro"]').evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('solid');
  await expect(page.locator('[data-tile="pro"]')).toHaveAttribute('aria-description', 'Make professional');
});

test('fewer than six actions end with Ask, more than six drop it; letters still reach them', async ({ page }) => {
  await open(page, { scenario: 'ilot-grid', actions: '2' });
  expect(
    await page
      .locator('.shape-layer:not(.is-leaving) [data-tile]')
      .evaluateAll((tiles) => tiles.map((tile) => tile.getAttribute('data-tile'))),
  ).toEqual(['fix', 'translate', 'ask']);
  await restsAt(page, 218, 62, 16);
  await open(page, { scenario: 'ilot-grid', actions: '7' });
  expect(
    await page
      .locator('.shape-layer:not(.is-leaving) [data-tile]')
      .evaluateAll((tiles) => tiles.map((tile) => tile.getAttribute('data-tile'))),
  ).toEqual(['fix', 'translate', 'pro', 'shorten', 'email', 'formal']);
  await page.keyboard.press('u');
  expect(await lastEvent(page)).toEqual({ type: 'choose', actionId: 'summary' });
  // No action at all: only the pastille; Enter writes an instruction.
  await open(page, { actions: '0' });
  await expect(page.locator('[data-item="last"]')).toHaveCount(0);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('textbox')).toBeFocused();
});

test('speaks French by the switch; action names stay as the user wrote them', async ({ page }) => {
  await open(page, { lang: 'fr', scenario: 'ilot-grid' });
  await expect(page.getByRole('menu', { name: 'Actions sur la sélection' })).toBeVisible();
  expect(await page.locator('.shape-layer:not(.is-leaving) .ilot-tile-label').allTextContents()).toEqual([
    'Corriger',
    'Traduire',
    'Pro',
    'Raccourcir',
    'Mail',
    'Consigne',
  ]);
  await page.keyboard.press('Space');
  await expect(page.getByRole('textbox', { name: 'Décrivez la modification…' })).toBeFocused();
});

test('the workbench lists the Îlot scenarios with the motion preset', async ({ page }) => {
  await page.goto('/lab.html?view=states');
  await page.getByRole('button', { name: 'Îlot en grille' }).click();
  await expect(page).toHaveURL(/scenario=ilot-grid/);
  await page.locator('label:has-text("Mouvement") select').selectOption('bouncy');
  await expect(page).toHaveURL(/preset=bouncy/);
  const frame = page.frameLocator('iframe');
  await expect(frame.locator('[data-ilot]')).toHaveAttribute('data-mode', 'grid');
  await expect(frame.locator('html')).toHaveAttribute('data-motion-preset', 'bouncy');
});
