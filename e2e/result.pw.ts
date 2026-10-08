import { test, expect, type Page } from '@playwright/test';

// Lots 9 and 10 (docs/DA-PLAN.md): the result pill in the lab frame (src/lab/result.tsx), in the
// browser. Measures after design-lab/verify.mjs (content centred within 0.5 px while the shape
// changes) and the lab's values (Simulator.jsx, app.css:155-171). Browser only: the real window,
// its hit-test regions and the halo are not validated here.

type Params = Record<string, string>;
const url = (params: Params) => `/lab-frame.html?${new URLSearchParams({ scenario: 'result-done', hold: '1', motion: 'full', theme: 'light', ...params })}`;

async function open(page: Page, params: Params = {}) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(url(params));
  await expect(page.locator('.result-pill')).toBeVisible();
  // The entrance is over: no transform left on the surface, for 300 ms on end. At the top of the
  // bouncy overshoot (scale ≈ 1.003) Motion's spring gives its target for a frame or two while
  // its speed is near zero, then settles on for another ~170 ms.
  await page.evaluate(() => new Promise<void>(resolve => {
    let since: number | null = null;
    const tick = (now: number) => {
      const s = document.querySelector('.result-pill');
      since = s && getComputedStyle(s).transform === 'none' && getComputedStyle(s).opacity === '1' ? since ?? now : null;
      if (since !== null && now - since >= 300) resolve(); else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  return errors;
}
const shape = (page: Page) => page.locator('[data-ilot-shape]').evaluate((el: HTMLElement) => ({ width: el.offsetWidth, height: el.offsetHeight, radius: getComputedStyle(el).borderRadius }));
// At rest: the shape's height, fully round, and its width (given, else the content's own).
async function restsAt(page: Page, height: number, width?: number) {
  await expect.poll(async () => {
    const s = await shape(page);
    return s.height === height && s.radius === `${height / 2}px` && s.width === (width ?? await layerWidth(page));
  }, { timeout: 3000 }).toBe(true);
  return shape(page);
}
const layerWidth = (page: Page) => page.locator('.shape-layer:not(.is-leaving)').evaluate((el: HTMLElement) => Math.ceil(el.offsetWidth));
const events = (page: Page) => page.evaluate(() => (window.__resultEvents ?? []) as Array<{ type: string; t: number; action?: unknown }>);
const arc = (page: Page) => page.locator('.result-ring circle:not(.track)').evaluate(el => Number(el.getAttribute('stroke-dasharray')!.split(' ')[0]));
const full = 2 * Math.PI * 5;
const tag = (page: Page) => page.locator('[data-ilot-shape]').evaluate(el => { (el as HTMLElement & { tag?: number }).tag = 9; });
const tagged = (page: Page) => page.locator('[data-ilot-shape]').evaluate(el => (el as HTMLElement & { tag?: number }).tag);

type Frame = { w: number; h: number; layers: Array<{ dx: number; dy: number; transform: string; scaleX: number; scaleY: number }> };
// Every frame for `ms` while `act` runs: the shape, each content layer and its transform.
async function framesDuring(page: Page, act: () => Promise<unknown>, ms = 900): Promise<Frame[]> {
  await page.evaluate(() => {
    const store = { frames: [] as Frame[], on: true };
    (window as unknown as { __frames: typeof store }).__frames = store;
    const tick = () => {
      const box = document.querySelector<HTMLElement>('[data-ilot-shape]');
      if (box) {
        const outer = box.getBoundingClientRect();
        store.frames.push({ w: box.offsetWidth, h: box.offsetHeight, layers: [...box.querySelectorAll<HTMLElement>('.shape-layer')].map(layer => {
          const inner = layer.getBoundingClientRect();
          // The scale against the layer's unrounded layout size: offsetWidth is snapped to a
          // whole pixel, up to 1 % off on a 100 px layer.
          const style = getComputedStyle(layer);
          return { dx: inner.left + inner.width / 2 - (outer.left + outer.width / 2), dy: inner.top + inner.height / 2 - (outer.top + outer.height / 2), transform: style.transform, scaleX: inner.width / parseFloat(style.width), scaleY: inner.height / parseFloat(style.height) };
        }) });
      }
      if (store.on) requestAnimationFrame(tick);
    };
    tick();
  });
  await act();
  await page.waitForTimeout(ms);
  return page.evaluate(() => { const store = (window as unknown as { __frames: { frames: Frame[]; on: boolean } }).__frames; store.on = false; return store.frames; });
}
function expectCentred(frames: Frame[]) {
  for (const frame of frames) for (const layer of frame.layers) {
    expect(Math.abs(layer.dx)).toBeLessThan(0.5);
    expect(Math.abs(layer.dy)).toBeLessThan(0.5);
    // Only the centring translation: never a scale on the text and icons.
    expect(layer.transform).toMatch(/^matrix\(1, 0, 0, 1, -?[\d.]+, -?[\d.]+\)$/);
    expect(layer.scaleX).toBeCloseTo(1, 2);
    expect(layer.scaleY).toBeCloseTo(1, 2);
  }
}

for (const preset of ['smooth', 'bouncy'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`work → check and Undo, on the same surface, content centred (${preset}, ${theme})`, async ({ page }) => {
      const errors = await open(page, { preset, theme });
      await restsAt(page, 28, 44);
      await tag(page);
      const frames = await framesDuring(page, () => page.getByRole('button', { name: 'Coche + Annuler' }).click());
      const done = await restsAt(page, 28);
      // The lab's row: check 14, gap 6, Undo (22 high), padding 10 / 6.
      expect(done.width).toBeGreaterThanOrEqual(100);
      expect(done.width).toBeLessThanOrEqual(130);
      // The spring was seen between the two widths, not a jump.
      expect(frames.filter(frame => frame.w > 46 && frame.w < done.width - 2).length).toBeGreaterThan(3);
      expectCentred(frames);
      expect(await tagged(page)).toBe(9);
      expect(await page.locator('.result-undo').evaluate(el => [(el as HTMLElement).offsetHeight, getComputedStyle(el).borderRadius])).toEqual([22, '11px']);
      // The ink follows the theme (src/theme.css).
      expect(await page.locator('.result-pill').evaluate(el => getComputedStyle(el).color)).toBe(theme === 'dark' ? 'rgb(245, 246, 248)' : 'rgb(29, 29, 31)');
      expect(errors).toEqual([]);
    });

    test(`work → error pill of 30 px, on the same surface, content centred (${preset}, ${theme})`, async ({ page }) => {
      const errors = await open(page, { scenario: 'result-error-config', preset, theme });
      await restsAt(page, 28, 44);
      await tag(page);
      const frames = await framesDuring(page, () => page.getByRole('button', { name: 'Erreur' }).click());
      const pill = await restsAt(page, 30);
      expectCentred(frames);
      expect(frames.filter(frame => frame.w > 46 && frame.w < pill.width - 2).length).toBeGreaterThan(3);
      expect(await tagged(page)).toBe(9);
      // The lab's colours (app.css:170-171) through --error-icon.
      expect(await page.locator('.result-error-icon').evaluate(el => getComputedStyle(el).color)).toBe(theme === 'dark' ? 'rgb(255, 138, 128)' : 'rgb(209, 67, 67)');
      await expect(page.getByRole('alert')).toHaveText('API key rejected');
      expect(errors).toEqual([]);
    });
  }
}

test('the check is drawn in 260 ms, after 80 ms, on the lab’s curve', async ({ page }) => {
  await open(page);
  const run = await page.evaluate(async () => {
    const samples: Array<{ t: number; offset: number }> = [];
    let born = 0;
    const observer = new MutationObserver(() => { if (!born && document.querySelector('.result-check path')) born = performance.now(); });
    observer.observe(document.body, { childList: true, subtree: true });
    [...document.querySelectorAll('button')].find(button => button.textContent === 'Coche + Annuler')!.click();
    await new Promise<void>(resolve => {
      const tick = () => {
        const path = document.querySelector<SVGPathElement>('.result-check path');
        if (path && born) samples.push({ t: performance.now() - born, offset: parseFloat(getComputedStyle(path).strokeDashoffset) });
        if (!born || performance.now() - born < 600) requestAnimationFrame(tick); else resolve();
      };
      requestAnimationFrame(tick);
    });
    observer.disconnect();
    const animation = document.querySelector('.result-check path')!.getAnimations()[0];
    const timing = animation?.effect?.getTiming();
    // A CSS animation carries its timing function on its keyframes (the effect's own easing stays linear).
    const easing = getComputedStyle(document.querySelector('.result-check path')!).animationTimingFunction;
    return { samples, timing: timing && { delay: timing.delay, duration: timing.duration, easing, fill: timing.fill }, name: (animation as CSSAnimation | undefined)?.animationName };
  });
  expect(run.name).toBe('result-check-draw');
  expect(run.timing).toEqual({ delay: 80, duration: 260, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', fill: 'forwards' });
  // Hidden until 80 ms, drawing between, drawn by 340 ms (one frame of slack each side).
  for (const sample of run.samples.filter(s => s.t < 70)) expect(sample.offset).toBeCloseTo(1, 3);
  expect(run.samples.some(s => s.t > 100 && s.t < 320 && s.offset > 0.02 && s.offset < 0.98)).toBe(true);
  for (const sample of run.samples.filter(s => s.t > 360)) expect(sample.offset).toBe(0);
});

test('Undo counts down, stops under the pointer and with the focus, resumes, then the pill leaves', async ({ page }) => {
  await open(page, { stage: 'done', seconds: '4' });
  await expect(page.locator('.result-undo')).toBeVisible();
  const row = page.locator('.result-row');
  const a1 = await arc(page);
  await page.waitForTimeout(400);
  const a2 = await arc(page);
  expect(a2).toBeLessThan(a1);
  // The pointer on the pill: the ring holds.
  await row.hover();
  await expect(row).toHaveAttribute('data-paused', 'true');
  const a3 = await arc(page);
  await page.waitForTimeout(900);
  expect(await arc(page)).toBe(a3);
  await page.mouse.move(5, 5);
  await expect(row).not.toHaveAttribute('data-paused');
  await page.waitForTimeout(300);
  const a4 = await arc(page);
  expect(a4).toBeLessThan(a3);
  // The focus on Undo holds it too.
  await page.locator('.result-undo').focus();
  await expect(row).toHaveAttribute('data-paused', 'true');
  const a5 = await arc(page);
  await page.waitForTimeout(900);
  expect(await arc(page)).toBe(a5);
  await page.locator('.result-undo').evaluate(el => (el as HTMLElement).blur());
  await expect(row).not.toHaveAttribute('data-paused');
  // What is left runs out, then the pill leaves (AnimatePresence) and says so once.
  await expect(page.locator('.result-pill')).toHaveCount(0, { timeout: 6000 });
  expect((await events(page)).filter(event => event.type === 'expire').length).toBe(1);
});

test('Undo lasts the chosen time, then the pill leaves', async ({ page }) => {
  await open(page);
  const started = await page.evaluate(() => { [...document.querySelectorAll('button')].find(button => button.textContent === 'Coche + Annuler')!.click(); return performance.now(); });
  await expect.poll(async () => (await events(page)).find(event => event.type === 'expire'), { timeout: 12000 }).toBeTruthy();
  const expired = (await events(page)).find(event => event.type === 'expire')!.t;
  // 8 s by default (data.js:170), a frame or two of slack.
  expect(expired - started).toBeGreaterThanOrEqual(8000);
  expect(expired - started).toBeLessThan(8300);
  await expect(page.locator('.result-pill')).toHaveCount(0);
});

test('Undo, then « Undone » for 0.9 s', async ({ page }) => {
  await open(page, { stage: 'done' });
  await tag(page);
  await page.locator('.result-undo').click();
  await expect(page.locator('[data-result-content="undone"]')).toHaveText('Undone');
  expect(await tagged(page)).toBe(9);
  await expect(page.locator('.result-pill')).toHaveCount(0, { timeout: 3000 });
  const list = await events(page);
  expect(list.map(event => event.type)).toEqual(['undo', 'expire']);
  expect(list[1].t - list[0].t).toBeGreaterThanOrEqual(900);
});

test('the check alone and Undo alone stay centred in the pill', async ({ page }) => {
  await open(page, { stage: 'done', undo: '0' });
  // The check alone rests in the work pill's own 44 × 28.
  expect(await restsAt(page, 28, 44)).toEqual({ width: 44, height: 28, radius: '14px' });
  const check = await page.locator('.result-check').evaluate(el => { const c = el.getBoundingClientRect(), s = document.querySelector('[data-ilot-shape]')!.getBoundingClientRect(); return [c.left + c.width / 2 - s.left - s.width / 2, c.top + c.height / 2 - s.top - s.height / 2]; });
  for (const offset of check) expect(Math.abs(offset)).toBeLessThan(0.5);
  await page.goto(url({ stage: 'done', check: '0' }));
  await restsAt(page, 28);
  const undo = await page.locator('.result-undo').evaluate(el => { const c = el.getBoundingClientRect(), s = document.querySelector('[data-ilot-shape]')!.getBoundingClientRect(); return [c.left + c.width / 2 - s.left - s.width / 2, c.top + c.height / 2 - s.top - s.height / 2]; });
  for (const offset of undo) expect(Math.abs(offset)).toBeLessThan(0.5);
});

test('the error pill never grows: « Copied » takes the place of « Copy result », then it leaves', async ({ page }) => {
  await open(page, { scenario: 'result-error-paste', stage: 'error' });
  const pill = await restsAt(page, 30);
  const before = await page.locator('[data-ilot-shape]').boundingBox();
  await expect(page.getByRole('button', { name: 'Copy result' })).toBeVisible();
  const frames = await framesDuring(page, () => page.getByRole('button', { name: 'Copy result' }).click(), 700);
  for (const frame of frames) expect([frame.w, frame.h]).toEqual([pill.width, 30]);
  expect(await page.locator('.result-swap > span:not([aria-hidden])').textContent()).toBe('Copied');
  // Nothing moved: no shake.
  expect(await page.locator('[data-ilot-shape]').boundingBox()).toEqual(before);
  await expect(page.locator('.result-pill')).toHaveCount(0, { timeout: 3000 });
  expect((await events(page)).map(event => event.type)).toEqual(['action', 'dismiss']);
});

test('each family has its one button: the field, Try again, Copy result, or none', async ({ page }) => {
  await open(page, { scenario: 'result-error-config', stage: 'error', mode: 'fast' });
  await page.getByRole('button', { name: 'Fix key' }).click();
  expect((await events(page)).at(-1)).toMatchObject({ type: 'action', action: { type: 'settings', field: 's2.apiKey' } });
  // Configuration errors: each opens its own field.
  for (const [kind, label, field] of [['unreachable', 'Open endpoint', 'endpoint'], ['bad_endpoint', 'Open endpoint', 'endpoint'], ['model_not_found', 'Choose model', 'model']] as const) {
    await page.getByLabel('Code').selectOption(kind);
    await page.getByRole('button', { name: label }).click();
    expect((await events(page)).at(-1)).toMatchObject({ type: 'action', action: { type: 'settings', field: `s2.${field}` } });
  }
  await expect(page.getByRole('alert')).toHaveText('Model not found: gemma-4-12b');

  // Transient: Try again goes back to work on the same surface.
  await page.goto(url({ scenario: 'result-error-transient', stage: 'error' }));
  await restsAt(page, 30);
  await tag(page);
  await expect(page.getByRole('alert')).toHaveText('Server busy — try again');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('.result-pill')).toHaveAttribute('data-result', 'working');
  await restsAt(page, 28, 44);
  expect(await tagged(page)).toBe(9);

  // Content: no button but ✕.
  await page.goto(url({ scenario: 'result-error-content', stage: 'error' }));
  await expect(page.getByRole('alert')).toHaveText('Selection too long (max 200,000 characters)');
  await expect(page.locator('.result-pill button')).toHaveCount(1);
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('.result-pill')).toHaveCount(0);

  // French.
  await page.goto(url({ scenario: 'result-error-paste', stage: 'error', lang: 'fr' }));
  await expect(page.getByRole('alert')).toHaveText('Texte modifié, rien remplacé');
  await expect(page.getByRole('button', { name: 'Copier le résultat' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fermer' })).toBeVisible();
});

test('reduced motion: the shape changes at once, the check is drawn at once, the ring steps each second and the time runs', async ({ page }) => {
  await open(page, { motion: 'reduce', seconds: '4' });
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  let clicked = 0;
  const frames = await framesDuring(page, async () => { clicked = await page.evaluate(() => { [...document.querySelectorAll('button')].find(button => button.textContent === 'Coche + Annuler')!.click(); return performance.now(); }); }, 300);
  const done = await shape(page);
  // No spring: from 44 straight to the new width.
  expect(frames.filter(frame => frame.w > 44 && frame.w < done.width)).toEqual([]);
  expectCentred(frames);
  expect(await page.locator('.result-check path').evaluate(el => [el.getAnimations().length, getComputedStyle(el).strokeDashoffset])).toEqual([0, '0px']);
  // The ring: whole seconds only (4/4, 3/4, 2/4…), sampled for about 2.4 s.
  const arcs = new Set<number>();
  for (let i = 0; i < 12; i++) { arcs.add(Math.round(await arc(page) * 100) / 100); await page.waitForTimeout(200); }
  const steps = [4, 3, 2, 1].map(left => Math.round(full * left / 4 * 100) / 100);
  for (const value of arcs) expect(steps).toContain(value);
  expect(arcs.size).toBeGreaterThanOrEqual(2);
  await expect.poll(async () => (await events(page)).find(event => event.type === 'expire'), { timeout: 4000 }).toBeTruthy();
  const expired = (await events(page)).find(event => event.type === 'expire')!.t;
  expect(expired - clicked).toBeGreaterThanOrEqual(4000);
  expect(expired - clicked).toBeLessThan(4300);
});
