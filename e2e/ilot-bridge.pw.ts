import { test, expect, type Page } from '@playwright/test';
import { ilotRegion, ilotReserve } from '../src/layout';

// The Îlot in the overlay (lot 7) over the IPC fixture: a menu capture never translates by itself,
// the Îlot asks for the keyboard once, a choice goes through `choose_action` once, `translate` then
// runs the returned action, and the same surface becomes the working pill until the simulated
// paste. Its window is reserved once; only the hit-test region follows the shapes. A browser run
// with a simulated translation, not the Windows window nor an inference.
type Call = { command: string; args?: Record<string, unknown> };
type Region = { x: number; y: number; width: number; height: number; radius: number };
type Geometry = { width: number; height: number; captureId: string; presentation: string; regions: Region[]; frame: Region };
type Fixture = {
  calls: Call[];
  settings: (next: Record<string, unknown>) => Promise<void>;
  captureMenu: (id: string, lastActionId?: string | null, text?: string) => Promise<void>;
  unanchoredMenu: (id: string, lastActionId?: string | null) => Promise<void>;
  capture: (id: string) => Promise<void>;
  refuseFocus: () => void;
  grantFocus: () => void;
  refuseChoice: () => void;
  holdChoice: () => void;
  releaseChoice: () => void;
  invalidate: (anchorLost?: boolean, captureId?: string) => Promise<void>;
  windowAt: (x: number, y: number) => void;
  workAreaAt: (x: number, y: number, width: number, height: number) => void;
  holdPosition: () => void;
  releasePosition: () => void;
  menuKey: (key: string, shiftKey?: boolean, captureId?: string) => Promise<void>;
  menuRepeat: (captureId?: string) => Promise<void>;
  done: (text?: string) => Promise<void>;
  dismissEvent: (captureId: string) => Promise<void>;
  deliver: (status: 'applied' | 'fallback', confirmed?: boolean, message?: string, code?: string) => Promise<void>;
};
// Runs `run` in the page against the fixture (the function travels as source: no outer variables).
const on = <T>(page: Page, run: (fixture: Fixture) => T | Promise<T>) => page.evaluate(`(${run.toString()})(window.nativeFixture)`) as Promise<T>;
const calls = (page: Page, command: string) => page.evaluate(name => (window as unknown as { nativeFixture: Fixture }).nativeFixture.calls.filter(call => call.command === name).map(call => call.args ?? {}), command);
const translations = async (page: Page, captureId: string) => (await calls(page, 'translate')).map(args => args.request as { captureId: string; actionId: string }).filter(request => request.captureId === captureId);
const geometries = async (page: Page, captureId: string) => (await calls(page, 'resize_overlay') as Geometry[]).filter(geometry => geometry.captureId === captureId);
const chosen = async (page: Page, captureId: string) => (await calls(page, 'choose_action')).filter(args => args.captureId === captureId);
const box = async (page: Page) => page.locator('[data-ilot-shape]').evaluate(element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });

async function openIlot(page: Page) {
  // Chromium on Windows reports the system's « Effets d'animation »: the springs run here.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 640, height: 480 });
  await page.route('**/?window=overlay&fixture=1', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('/src/main.tsx', '/e2e/native-fixture.ts') });
  });
  await page.goto('/?window=overlay&fixture=1');
  await expect(page.locator('.glass-overlay')).toBeVisible();
  // The Îlot is the fixture's default, as it is Rust's: nothing to switch on.
  await expect(page.locator('html')).toHaveAttribute('data-ui', 'ilot');
}
// The Îlot at rest: entered, its shape settled.
async function settled(page: Page, shape: 'menu' | 'pill' = 'menu') {
  await expect(page.locator(`[data-ilot][data-shape="${shape}"]`)).toBeVisible();
  await expect.poll(async () => { const a = await box(page); await page.waitForTimeout(80); const b = await box(page); return JSON.stringify(a) === JSON.stringify(b); }).toBe(true);
}
// Every frame for `ms` after `act`: the painted shape and the geometry Rust last received.
async function follow(page: Page, captureId: string, act: () => Promise<void>, ms = 900) {
  const frames = page.evaluate(({ captureId, ms }) => new Promise<Array<{ shape: { x: number; y: number; width: number; height: number }; geometry: Geometry }>>(resolve => {
    const out: Array<{ shape: { x: number; y: number; width: number; height: number }; geometry: Geometry }> = [];
    const start = performance.now();
    const tick = () => {
      const shape = document.querySelector('[data-ilot-shape]')?.getBoundingClientRect();
      const geometry = (window as unknown as { nativeFixture: Fixture }).nativeFixture.calls.filter(call => call.command === 'resize_overlay' && call.args?.captureId === captureId).at(-1)?.args as Geometry;
      if (shape) out.push({ shape: { x: shape.x, y: shape.y, width: shape.width, height: shape.height }, geometry });
      if (performance.now() - start < ms) requestAnimationFrame(tick); else resolve(out);
    };
    requestAnimationFrame(tick);
  }), { captureId, ms });
  await act();
  return frames;
}
const inside = (shape: { x: number; y: number; width: number; height: number }, region: Region) =>
  shape.x >= region.x - 1 && shape.y >= region.y - 1 && shape.x + shape.width <= region.x + region.width + 1 && shape.y + shape.height <= region.y + region.height + 1;

test('Îlot: a menu capture opens the Îlot by its selection, takes the keyboard once, and the keyboard path runs to the paste', async ({ page }) => {
  await openIlot(page);
  await on(page, f => f.captureMenu('keys'));
  const ilot = page.locator('[data-ilot]');
  await expect(ilot).toHaveAttribute('data-keyboard', 'focused');
  await expect(ilot).toHaveAttribute('data-mode', 'compact');
  // Nothing remembered for that application: the default action (Fix grammar) under Enter.
  await expect(page.locator('[data-item="last"]')).toHaveAttribute('aria-description', 'Fix grammar');
  expect(await calls(page, 'focus_overlay')).toHaveLength(1);
  expect(await translations(page, 'keys')).toHaveLength(0);
  const surface = await page.locator('[data-ilot-shape]').elementHandle();

  await page.keyboard.press('Tab');
  await expect(ilot).toHaveAttribute('data-mode', 'grid');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-tile="translate"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(() => calls(page, 'choose_action')).toEqual([{ captureId: 'keys', actionId: 'translate' }]);
  await expect.poll(() => translations(page, 'keys')).toEqual([expect.objectContaining({ captureId: 'keys', actionId: 'translate' })]);
  // The same surface, not a second one, springs to the working pill of lot 8.
  await expect(ilot).toHaveAttribute('data-shape', 'pill');
  expect(await page.locator('[data-ilot-shape]').evaluate((element, before) => element === before, surface)).toBe(true);
  const pill = page.locator('.result-working');
  await expect(pill).toHaveAttribute('data-orb', 'shown');
  await expect(page.locator('.working-pill')).toHaveCount(0);
  await expect.poll(async () => { const b = await box(page); return [b.width, b.height]; }).toEqual([44, 28]);
  // Chosen: a second Enter chooses nothing.
  await page.keyboard.press('Enter');
  expect(await calls(page, 'choose_action')).toHaveLength(1);

  // Rust pastes the complete result: the check drawn on the same surface (lot 9), then the Îlot
  // leaves by itself.
  await on(page, f => f.done('Synthetic result'));
  await on(page, f => f.deliver('applied'));
  await expect(page.getByRole('group', { name: 'Selection replaced' }).locator('.result-check')).toBeVisible();
  expect(await page.locator('[data-ilot-shape]').evaluate((element, before) => element === before, surface)).toBe(true);
  await expect.poll(() => calls(page, 'dismiss_overlay')).toHaveLength(1);
  await expect.poll(() => calls(page, 'complete_overlay_dismiss')).toEqual([{ captureId: 'keys' }]);
  await expect(ilot).toHaveCount(0);
  expect(await calls(page, 'focus_overlay')).toHaveLength(1);
});

test('Îlot: the pointer unfolds the grid and picks a tile once, even clicked twice', async ({ page }) => {
  await openIlot(page);
  await on(page, f => f.captureMenu('mouse', 'shorten'));
  await expect(page.locator('[data-item="last"]')).toHaveAttribute('aria-description', 'Shorten');
  await page.locator('[data-item="ask"]').hover();
  await expect(page.locator('[data-ilot]')).toHaveAttribute('data-mode', 'grid');
  await page.locator('[data-tile="email"]').dblclick();
  await expect.poll(() => chosen(page, 'mouse')).toEqual([{ captureId: 'mouse', actionId: 'email' }]);
  await expect.poll(() => translations(page, 'mouse')).toEqual([expect.objectContaining({ actionId: 'email' })]);
  await expect(page.locator('[data-ilot]')).toHaveAttribute('data-shape', 'pill');
  await page.waitForTimeout(300);
  expect(await chosen(page, 'mouse')).toHaveLength(1);
  // A fallback (the paste was blocked) turns the same surface into the error pill of lot 10; the
  // glass never opens in the Îlot's journey (e2e/ilot-result.pw.ts goes through each family).
  await on(page, f => f.done('Synthetic result'));
  await on(page, f => f.deliver('fallback', false, 'Le collage a été bloqué; utilisez Copier.', 'paste_blocked'));
  await expect(page.locator('.ilot-stage')).toHaveAttribute('data-error', 'paste_blocked');
  await expect(page.getByRole('button', { name: 'Copy result' })).toBeVisible();
  await expect(page.locator('.translation-bubble')).toHaveCount(0);
  await expect(page.locator('.glass-overlay')).toHaveCount(0);
});

test('Îlot: a free instruction goes to choose_action only; translate runs the reserved id', async ({ page }) => {
  await openIlot(page);
  await on(page, f => f.captureMenu('free', 'correct'));
  await expect(page.locator('[data-ilot]')).toHaveAttribute('data-keyboard', 'focused');
  await page.keyboard.press('Space');
  const field = page.getByRole('textbox', { name: 'Describe your change…' });
  await expect(field).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(field).toHaveCount(0);
  await expect(page.locator('[data-ilot]')).toHaveAttribute('data-mode', 'compact');
  expect(await calls(page, 'dismiss_overlay')).toHaveLength(0);
  await page.keyboard.press('Space');
  // A synthetic instruction, invented for the test.
  await field.fill('Mets au pluriel, sans « tu »');
  await page.keyboard.press('Enter');
  await expect.poll(() => calls(page, 'choose_action')).toEqual([{ captureId: 'free', actionId: 'instruction', instruction: 'Mets au pluriel, sans « tu »' }]);
  // Frozen in Rust: `translate` carries the reserved id, never the instruction.
  await expect.poll(() => translations(page, 'free')).toEqual([expect.objectContaining({ actionId: 'instruction' })]);
  expect(JSON.stringify(await calls(page, 'translate'))).not.toContain('pluriel');
  await expect(page.locator('[data-ilot]')).toHaveAttribute('data-shape', 'pill');
});

test('Îlot: without the foreground it reads the native menu-key events, kept until it shows, stale ones ignored', async ({ page }) => {
  await openIlot(page);
  // Keys forwarded before the Îlot rendered are kept, in order.
  await on(page, f => { f.refuseFocus(); return f.captureMenu('fallback', 'correct').then(() => f.menuKey('Tab')); });
  const ilot = page.locator('[data-ilot]');
  await expect(ilot).toHaveAttribute('data-keyboard', 'injected');
  await expect(ilot).toHaveAttribute('data-mode', 'grid');
  // No field without the keyboard: the ✦ tile is dimmed, an unassigned letter does nothing.
  await expect(page.locator('[data-tile="ask"]')).toHaveAttribute('aria-disabled', 'true');
  await on(page, f => f.menuKey('z'));
  await on(page, f => f.menuKey('Escape'));
  await expect(ilot).toHaveAttribute('data-mode', 'compact');
  await on(page, f => f.menuKey('2', false, 'stale-capture'));
  await page.waitForTimeout(100);
  expect(await chosen(page, 'fallback')).toHaveLength(0);
  await on(page, f => f.menuKey('2'));
  // The second tile of the default grid: Translate.
  await expect.poll(() => chosen(page, 'fallback')).toEqual([{ captureId: 'fallback', actionId: 'translate' }]);
  await expect.poll(() => translations(page, 'fallback')).toEqual([expect.objectContaining({ actionId: 'translate' })]);
  await expect(ilot).toHaveAttribute('data-shape', 'pill');
  expect(await calls(page, 'focus_overlay')).toHaveLength(1);
});

// Review of bc57857, finding 3: once in 'injected' mode the Îlot never took the keyboard back, even
// when its window held it (a click on it in the fallback): the ✦ stayed dimmed, the keys did nothing.
test('Îlot: in the fallback, the window\'s focus or a click on the ✦ gives the keyboard back to the Îlot', async ({ page }) => {
  await openIlot(page);
  await on(page, f => { f.refuseFocus(); return f.captureMenu('regain', 'correct'); });
  const ilot = page.locator('[data-ilot]');
  const ask = page.locator('[data-item="ask"]');
  const field = page.getByRole('textbox', { name: 'Describe your change…' });
  await expect(ilot).toHaveAttribute('data-keyboard', 'injected');
  await settled(page);
  // Windows activated the overlay (a click on it): the Îlot reads the window's own keys.
  await page.evaluate(() => window.dispatchEvent(new FocusEvent('focus')));
  await expect(ilot).toHaveAttribute('data-keyboard', 'focused');
  await expect(ask).not.toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Tab');
  await expect(ilot).toHaveAttribute('data-mode', 'grid');
  await page.keyboard.press('Escape');
  await expect(ilot).toHaveAttribute('data-mode', 'compact');
  await page.keyboard.press('Space');
  await expect(field).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(ilot).toHaveAttribute('data-mode', 'compact');
  expect(await calls(page, 'dismiss_overlay')).toHaveLength(0);

  // Rust forwards a key again: the source is in front, the keys are Rust's.
  await on(page, f => f.menuKey('Tab'));
  await expect(ilot).toHaveAttribute('data-keyboard', 'injected');
  await expect(ilot).toHaveAttribute('data-mode', 'grid');
  await on(page, f => f.menuKey('Escape'));
  await expect(ilot).toHaveAttribute('data-mode', 'compact');
  // The dimmed ✦ clicked asks for the keyboard again: refused, nothing opens; granted, the field.
  await ask.click({ force: true });
  await expect.poll(() => calls(page, 'focus_overlay')).toHaveLength(2);
  await page.waitForTimeout(100);
  await expect(ilot).toHaveAttribute('data-keyboard', 'injected');
  await expect(field).toHaveCount(0);
  await on(page, f => f.grantFocus());
  await ask.click({ force: true });
  await expect.poll(() => calls(page, 'focus_overlay')).toHaveLength(3);
  await expect(field).toBeFocused();
  await expect(ilot).toHaveAttribute('data-keyboard', 'focused');
  expect(await chosen(page, 'regain')).toHaveLength(0);
});

// The native agent's measure (lot 9): a key sent to the overlay in the ~25 ms after `focus_overlay` activated it
// was lost twice. The WebView has the keyboard then, but the Îlot only shows once its window's side
// is read; the fixture holds that reading so the keys surely arrive before it.
async function pressBeforeTheIlot(page: Page, id: string, keys: Array<{ key: string; code?: string }>) {
  await on(page, f => f.holdPosition());
  const shown = await page.evaluate(async ({ id, keys }) => {
    await (window as unknown as { nativeFixture: Fixture }).nativeFixture.captureMenu(id);
    // The stage's first frame, without leaving the page (no Playwright round trip).
    for (let i = 0; i < 200 && !document.querySelector(`.ilot-stage[data-capture-id="${id}"]`); i++) await new Promise(resolve => requestAnimationFrame(resolve));
    const before = document.querySelectorAll('[data-ilot]').length;
    for (const { key, code } of keys) (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent('keydown', { key, code, bubbles: true, cancelable: true }));
    return before;
  }, { id, keys });
  expect(shown).toBe(0);
  await on(page, f => f.releasePosition());
}

test('Îlot: the keys the window receives before the Îlot shows are kept and replayed in order once it shows', async ({ page }) => {
  await openIlot(page);
  // A letter: its action, once.
  await pressBeforeTheIlot(page, 'early-letter', [{ key: 't', code: 'KeyT' }]);
  await expect.poll(() => chosen(page, 'early-letter')).toEqual([{ captureId: 'early-letter', actionId: 'translate' }]);
  await expect.poll(() => translations(page, 'early-letter')).toHaveLength(1);
  expect(await chosen(page, 'early-letter')).toHaveLength(1);
  await on(page, f => f.dismissEvent('early-letter'));
  await expect(page.locator('[data-ilot]')).toHaveCount(0);

  // In order: Tab unfolds the grid on the last action's tile (Fix, the first), → → move to the
  // third, Enter picks it.
  await pressBeforeTheIlot(page, 'early-grid', [{ key: 'Tab', code: 'Tab' }, { key: 'ArrowRight', code: 'ArrowRight' }, { key: 'ArrowRight', code: 'ArrowRight' }, { key: 'Enter', code: 'Enter' }]);
  await expect.poll(() => chosen(page, 'early-grid')).toEqual([{ captureId: 'early-grid', actionId: 'professionalize' }]);
  await on(page, f => f.dismissEvent('early-grid'));
  await expect(page.locator('[data-ilot]')).toHaveCount(0);

  // A letter no action holds opens the field with it; the next ones are its text, and the field
  // then takes the keyboard's keys itself.
  await pressBeforeTheIlot(page, 'early-field', [{ key: 'q', code: 'KeyQ' }, { key: 'u', code: 'KeyU' }, { key: 'i', code: 'KeyI' }]);
  const input = page.locator('.ilot-input');
  await expect(input).toHaveValue('qui');
  await expect(input).toBeFocused();
  await page.keyboard.type(' vite');
  await expect(input).toHaveValue('qui vite');
  expect(await chosen(page, 'early-field')).toHaveLength(0);
  await on(page, f => f.dismissEvent('early-field'));
  await expect(page.locator('[data-ilot]')).toHaveCount(0);

  // Escape before it shows: it closes as soon as it shows, nothing chosen, nothing pasted.
  await pressBeforeTheIlot(page, 'early-escape', [{ key: 'Escape', code: 'Escape' }]);
  await expect.poll(() => calls(page, 'dismiss_overlay')).toHaveLength(1);
  expect(await chosen(page, 'early-escape')).toHaveLength(0);
  expect(await calls(page, 'replace_result')).toHaveLength(0);
});

test('Îlot: a double press runs the application\'s last action once; before the Îlot shows, it is born a pill', async ({ page }) => {
  await openIlot(page);
  await on(page, f => f.captureMenu('twice', 'shorten'));
  await settled(page);
  await on(page, f => f.menuRepeat('stale-capture'));
  await on(page, f => f.menuRepeat());
  await expect.poll(() => chosen(page, 'twice')).toEqual([{ captureId: 'twice', actionId: 'shorten' }]);
  await expect.poll(() => translations(page, 'twice')).toEqual([expect.objectContaining({ actionId: 'shorten' })]);
  await expect(page.locator('[data-ilot]')).toHaveAttribute('data-shape', 'pill');
  await on(page, f => f.menuRepeat());
  expect(await chosen(page, 'twice')).toHaveLength(1);

  // The second press lands before the Îlot rendered: never the menu, straight to the pill, and
  // the keyboard is never taken. Nothing remembered for that application: the default action.
  const focusBefore = (await calls(page, 'focus_overlay')).length;
  await page.evaluate(() => {
    const seen: string[] = [];
    Object.assign(window, { shapesSeen: seen });
    const record = () => document.querySelectorAll('[data-ilot]').forEach(element => { const shape = element.getAttribute('data-shape') ?? ''; if (seen.at(-1) !== shape) seen.push(shape); });
    new MutationObserver(record).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-shape'] });
  });
  await on(page, f => f.captureMenu('early').then(() => f.menuRepeat()));
  await expect.poll(() => chosen(page, 'early')).toEqual([{ captureId: 'early', actionId: 'correct' }]);
  await settled(page, 'pill');
  expect(await page.evaluate(() => (window as unknown as { shapesSeen: string[] }).shapesSeen)).toEqual(['pill']);
  expect(await calls(page, 'focus_overlay')).toHaveLength(focusBefore);
});

test('Îlot: Escape goes back from the grid first, then closes without choosing or pasting', async ({ page }) => {
  await openIlot(page);
  await on(page, f => f.captureMenu('escape'));
  const ilot = page.locator('[data-ilot]');
  await expect(ilot).toHaveAttribute('data-keyboard', 'focused');
  await page.keyboard.press('Tab');
  await expect(ilot).toHaveAttribute('data-mode', 'grid');
  await page.keyboard.press('Escape');
  await expect(ilot).toHaveAttribute('data-mode', 'compact');
  expect(await calls(page, 'dismiss_overlay')).toHaveLength(0);
  await page.keyboard.press('Escape');
  await expect.poll(() => calls(page, 'dismiss_overlay')).toHaveLength(1);
  await expect.poll(() => calls(page, 'complete_overlay_dismiss')).toEqual([{ captureId: 'escape' }]);
  await expect(ilot).toHaveCount(0);
  expect(await chosen(page, 'escape')).toHaveLength(0);
  expect(await translations(page, 'escape')).toHaveLength(0);
});

// Review of bc57857, finding 1: a menu left armed after the user went back to the source
// (a click that dropped the selection) took the keys typed there. Rust closes a menu that had the
// keyboard; the Îlot closes on `target-invalidated` whenever no choice is made or on its way.
test('Îlot: the selection lost before any choice closes the menu; a choice on its way keeps its journey', async ({ page }) => {
  await openIlot(page);
  await on(page, f => f.captureMenu('lost'));
  await settled(page);
  await on(page, f => f.invalidate(true, 'stale-capture'));
  await page.waitForTimeout(100);
  expect(await calls(page, 'dismiss_overlay')).toHaveLength(0);
  await on(page, f => f.invalidate());
  await expect.poll(() => calls(page, 'dismiss_overlay')).toHaveLength(1);
  await expect.poll(() => calls(page, 'complete_overlay_dismiss')).toEqual([{ captureId: 'lost' }]);
  await expect(page.locator('[data-ilot]')).toHaveCount(0);
  expect(await chosen(page, 'lost')).toHaveLength(0);
  expect(await translations(page, 'lost')).toHaveLength(0);

  // A double press whose `choose_action` has not answered yet: the invalidation leaves it be.
  await on(page, f => f.captureMenu('racing', 'shorten'));
  await settled(page);
  await on(page, f => { f.holdChoice(); return f.menuRepeat(); });
  await expect.poll(() => chosen(page, 'racing')).toHaveLength(1);
  await on(page, f => f.invalidate());
  await page.waitForTimeout(100);
  await on(page, f => f.releaseChoice());
  await expect.poll(() => translations(page, 'racing')).toEqual([expect.objectContaining({ actionId: 'shorten' })]);
  await expect(page.locator('[data-ilot]')).toHaveAttribute('data-shape', 'pill');
  // Chosen: a later invalidation is the paste's to report (target_changed), not an abandon.
  await on(page, f => f.invalidate());
  await page.waitForTimeout(100);
  expect(await calls(page, 'dismiss_overlay')).toHaveLength(1);
  await expect(page.locator('[data-ilot]')).toHaveAttribute('data-shape', 'pill');
});

// Review of bc57857, finding 2: F5 or Ctrl+R in the focused Îlot reloaded the overlay (an empty
// window, a menu scope left armed in Rust). Every browser shortcut reaches the page's last listener
// already prevented, in the menu and in its field, while the menu keys and the field's editing keep
// working. Rust turns the WebView's accelerators off as well; headless Chromium would not reload on
// a synthetic F5 anyway, so the test reads `defaultPrevented`.
test('Îlot: the browser\'s shortcuts do nothing in the menu or its field; editing keys still work', async ({ page }) => {
  await openIlot(page);
  await on(page, f => f.captureMenu('browser', 'correct'));
  await settled(page);
  await page.evaluate(() => {
    const seen: Array<{ key: string; ctrl: boolean; prevented: boolean }> = [];
    Object.assign(window, { keysSeen: seen, wheelsSeen: [] as boolean[] });
    window.addEventListener('keydown', event => seen.push({ key: event.key, ctrl: event.ctrlKey, prevented: event.defaultPrevented }));
    window.addEventListener('wheel', event => (window as unknown as { wheelsSeen: boolean[] }).wheelsSeen.push(event.defaultPrevented), { passive: false });
  });
  const shortcuts = ['F5', 'Control+r', 'Control+Shift+R', 'Control+F5', 'Control+p', 'Control+f', 'F3', 'Control+g', 'F7', 'Alt+ArrowLeft', 'Alt+ArrowRight', 'Control+Equal', 'Control+Minus', 'Control+0'];
  const seen = () => page.evaluate(() => (window as unknown as { keysSeen: Array<{ key: string; ctrl: boolean; prevented: boolean }> }).keysSeen.filter(key => !['Control', 'Shift', 'Alt'].includes(key.key)));
  for (const shortcut of shortcuts) await page.keyboard.press(shortcut);
  expect((await seen()).map(key => key.prevented)).toEqual(shortcuts.map(() => true));
  await page.keyboard.down('Control');
  await page.mouse.move(600, 150);
  await page.mouse.wheel(0, -100);
  await page.keyboard.up('Control');
  await expect.poll(() => page.evaluate(() => (window as unknown as { wheelsSeen: boolean[] }).wheelsSeen)).toEqual([true]);
  const ilot = page.locator('[data-ilot]');
  await expect(ilot).toHaveAttribute('data-mode', 'compact');
  expect(await chosen(page, 'browser')).toHaveLength(0);

  // In the field: the same shortcuts are swallowed; typing and the editing chords still work
  // (none that touches the clipboard: the test never writes the user's).
  await page.keyboard.press('Space');
  const field = page.getByRole('textbox', { name: 'Describe your change…' });
  await expect(field).toBeFocused();
  await page.evaluate(() => { (window as unknown as { keysSeen: unknown[] }).keysSeen.length = 0; });
  for (const shortcut of ['F5', 'Control+r', 'Control+p', 'Control+f']) await page.keyboard.press(shortcut);
  expect((await seen()).map(key => key.prevented)).toEqual([true, true, true, true]);
  // A synthetic instruction, invented for the test.
  await page.keyboard.type('plus court');
  await page.keyboard.press('Control+Backspace');
  await expect(field).toHaveValue('plus ');
  await page.keyboard.press('Control+a');
  await page.keyboard.type('x');
  await expect(field).toHaveValue('x');
  expect((await seen()).filter(key => key.ctrl && ['Backspace', 'a'].includes(key.key)).map(key => key.prevented)).toEqual([false, false]);
  await expect(ilot).toHaveAttribute('data-mode', 'prompt');
  expect(await calls(page, 'dismiss_overlay')).toHaveLength(0);
});

// Review of bc57857, findings 4 and 6: with every action removed from the grid in the Settings
// (« only the free instruction »), the Îlot still showed the first six, launchable by digit.
test('Îlot: an emptied grid shows only « Ask »; the compact state still offers the last action', async ({ page }) => {
  await openIlot(page);
  await on(page, f => f.settings({ menuActionIds: [] }));
  await on(page, f => f.captureMenu('empty-grid', 'shorten'));
  const ilot = page.locator('[data-ilot]');
  await expect(page.locator('[data-item="last"]')).toHaveAttribute('aria-description', 'Shorten');
  await page.keyboard.press('Tab');
  await expect(ilot).toHaveAttribute('data-mode', 'grid');
  expect(await page.locator('[data-ilot] [data-tile]').evaluateAll(tiles => tiles.map(tile => tile.getAttribute('data-tile')))).toEqual(['ask']);
  // No letter either: « f » opens the field with it, and 1 is the « Ask » tile.
  await page.keyboard.press('f');
  const field = page.getByRole('textbox', { name: 'Describe your change…' });
  await expect(field).toHaveValue('f');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Tab');
  await page.keyboard.press('1');
  await expect(field).toHaveValue('');
  expect(await chosen(page, 'empty-grid')).toHaveLength(0);
});

// Review of bc57857, finding 5: a click on the field's dot or its drawn ↵ took the focus from the
// input; Enter then went nowhere and Escape closed the whole menu, the instruction lost.
test('Îlot: a click in the field keeps its focus, Escape still goes back, and the drawn ↵ sends', async ({ page }) => {
  await openIlot(page);
  await on(page, f => f.captureMenu('field-click', 'correct'));
  await settled(page);
  const ilot = page.locator('[data-ilot]');
  const field = page.getByRole('textbox', { name: 'Describe your change…' });
  const present = (part: string) => page.locator(`.shape-layer:not(.is-leaving) ${part}`);
  await page.keyboard.press('Space');
  await expect(field).toBeFocused();
  // A synthetic instruction, invented for the test.
  await page.keyboard.type('plus court');
  await present('.ilot-dot').click();
  await expect(field).toBeFocused();
  // The focus lost all the same (the body): Escape goes back to the compact state, nothing closes.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Escape');
  await expect(ilot).toHaveAttribute('data-mode', 'compact');
  await expect(field).toHaveCount(0);
  expect(await calls(page, 'dismiss_overlay')).toHaveLength(0);
  await page.keyboard.press('Space');
  await expect(field).toBeFocused();
  await page.keyboard.type('plus court');
  await present('.ilot-keycap').click();
  await expect.poll(() => chosen(page, 'field-click')).toEqual([{ captureId: 'field-click', actionId: 'instruction', instruction: 'plus court' }]);
  await expect(ilot).toHaveAttribute('data-shape', 'pill');
});

test('Îlot: a refused choice gives the menu back, and the next choice goes through', async ({ page }) => {
  await openIlot(page);
  await on(page, f => { f.refuseChoice(); return f.captureMenu('refused', 'translate'); });
  await settled(page);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alert')).toHaveText('L’action n’existe plus.');
  await expect(page.locator('[data-ilot]')).toHaveAttribute('data-shape', 'menu');
  expect(await translations(page, 'refused')).toHaveLength(0);
  await page.keyboard.press('Enter');
  await expect.poll(() => translations(page, 'refused')).toEqual([expect.objectContaining({ actionId: 'translate' })]);
  expect(await chosen(page, 'refused')).toHaveLength(2);
});

test('Îlot window: reserved once below the selection, the region follows each shape and nothing resizes while it springs', async ({ page }) => {
  await openIlot(page);
  await on(page, f => f.captureMenu('regions', 'correct'));
  await settled(page);
  const reserve = ilotReserve('anchored');
  const stage = page.locator('.ilot-stage');
  await expect(stage).toHaveAttribute('data-side', 'below');
  // Rust clamps the strip into the work area: the menu's widest shape (the field, 283), never the
  // error pill's 400, so the Îlot stays on the selection's end unless it is within 283 px of the
  // left edge. The first geometry, before the Îlot rendered, holds that strip alone.
  const [first] = await geometries(page, 'regions');
  expect(first.frame).toEqual({ x: 149, y: 104, width: 283, height: 32, radius: 0 });
  expect(first.regions).toEqual([{ x: 149, y: 104, width: 283, height: 32, radius: 16 }]);
  // The Îlot hangs from the strip Rust anchors, its entrance origin on the selection's side.
  const compact = await box(page);
  const corner = reserve.frame.x + reserve.frame.width;
  // A painted box as the region counts it: its corner's shift from the strip's (the menu opens
  // right of the compact bubble here, the work area 1400 px wide on the right).
  const shapeOf = (painted: { x: number; width: number; height: number }) => ({ width: painted.width, height: painted.height, shift: Math.round(painted.x + painted.width - corner) });
  expect(compact.x + compact.width).toBeCloseTo(corner, 0);
  expect(compact.y).toBeCloseTo(reserve.frame.y, 0);
  await expect(page.locator('[data-ilot]')).toHaveCSS('transform-origin', `${compact.width}px 0px`);
  expect((await geometries(page, 'regions')).at(-1)?.regions).toEqual([ilotRegion('anchored', 'below', compact)]);

  // Grid, field, compact again, then the pill: each change publishes the region holding both shapes
  // at its start and the new shape at its end; the window, its frame and presentation never change.
  const published: Geometry[] = [];
  for (const key of ['Tab', 'Space', 'Escape', 'Enter']) {
    const before = (await geometries(page, 'regions')).length;
    const from = await box(page);
    const frames = await follow(page, 'regions', () => page.keyboard.press(key));
    await settled(page, (await page.locator('[data-ilot]').getAttribute('data-shape')) as 'menu' | 'pill');
    const to = await box(page);
    const added = (await geometries(page, 'regions')).slice(before);
    published.push(...added);
    expect(added[0].regions).toEqual([ilotRegion('anchored', 'below', shapeOf(from), shapeOf(to))]);
    expect(added.at(-1)?.regions).toEqual([ilotRegion('anchored', 'below', shapeOf(to))]);
    expect(added.length).toBeLessThanOrEqual(2);
    // Every painted frame of the spring lies inside the region Rust holds at that frame.
    expect(frames.length).toBeGreaterThan(10);
    for (const frame of frames) expect(inside(frame.shape, frame.geometry.regions[0]), JSON.stringify(frame)).toBe(true);
  }
  await expect(page.locator('[data-ilot]')).toHaveAttribute('data-shape', 'pill');
  const all = await geometries(page, 'regions');
  for (const geometry of all) {
    expect(geometry).toMatchObject({ width: reserve.width, height: reserve.height, presentation: 'anchored', frame: reserve.frame });
    expect(geometry.regions).toHaveLength(1);
  }
  // The pill in the strip's right corner.
  expect(published.at(-1)?.regions).toEqual([{ x: reserve.frame.x + reserve.frame.width - 44, y: reserve.frame.y, width: 44, height: 28, radius: 14 }]);
});

test('Îlot window: above the selection it grows up from the strip; without an anchor it rests at the bottom', async ({ page }) => {
  await openIlot(page);
  // The fixture's first capture, a direct one, already read the window's position for its working
  // pill's side (GlassOverlay readPillSide): only the menu captures below are counted.
  const positionsBefore = (await calls(page, 'plugin:window|inner_position')).length;
  // Rust put the strip 8 px over the selection (anchor 300 high, strip 32, 104 above in the window).
  await on(page, f => { f.windowAt(205, 300 - 8 - 32 - 104); return f.captureMenu('above', 'correct'); });
  await settled(page);
  await expect(page.locator('.ilot-stage')).toHaveAttribute('data-side', 'above');
  const reserve = ilotReserve('anchored');
  const compact = await box(page);
  expect(compact.y + compact.height).toBeCloseTo(reserve.frame.y + reserve.frame.height, 0);
  await expect(page.locator('[data-ilot]')).toHaveCSS('transform-origin', `${compact.width}px ${compact.height}px`);
  await page.keyboard.press('Tab');
  await settled(page);
  const grid = await box(page);
  // Opened right of the compact bubble (the work area 1283 px wide on its right): its left edge.
  const left = compact.x;
  expect(grid).toEqual({ x: left, y: 20, width: 218, height: 116 });
  expect((await geometries(page, 'above')).at(-1)?.regions).toEqual([{ x: left, y: 20, width: 218, height: 116, radius: 16 }]);

  await on(page, f => f.unanchoredMenu('clipboard'));
  await settled(page);
  const bottom = ilotReserve('bottom');
  await expect(page.locator('.ilot-stage')).toHaveAttribute('data-presentation', 'bottom');
  const low = await box(page);
  expect(low.y + low.height).toBeCloseTo(bottom.frame.y + bottom.frame.height, 0);
  expect(low.x + low.width / 2).toBeCloseTo(bottom.width / 2, 0);
  for (const geometry of await geometries(page, 'clipboard')) expect(geometry).toMatchObject({ width: bottom.width, height: bottom.height, presentation: 'bottom', frame: bottom.frame });
  expect((await geometries(page, 'clipboard')).at(-1)?.regions).toEqual([ilotRegion('bottom', 'above', low)]);
  // The window position and the work area are only read for an anchored capture, at the anchor's
  // centre (the screen Rust placed it on).
  expect((await calls(page, 'plugin:window|inner_position')).length - positionsBefore).toBe(1);
  expect(await calls(page, 'plugin:window|monitor_from_point')).toEqual([{ x: 460, y: 309 }]);
});

// Lucas, 24/09: the menu opens right of where the compact bubble was when the work area holds its
// widest shape there, left near the screen's right edge.
test('Îlot: the menu opens right of the compact bubble when there is room, its left edge still on every frame; near the right edge, left', async ({ page }) => {
  await openIlot(page);
  await on(page, f => f.captureMenu('right', 'correct'));
  await settled(page);
  const reserve = ilotReserve('anchored');
  const corner = reserve.frame.x + reserve.frame.width;
  const compact = await box(page);
  expect(compact.x + compact.width).toBeCloseTo(corner, 0);
  for (const [key, width] of [['Tab', 218], ['Space', 283]] as const) {
    const frames = await follow(page, 'right', () => page.keyboard.press(key));
    await settled(page);
    const open = await box(page);
    expect(open.width).toBe(width);
    expect(open.x).toBeCloseTo(compact.x, 0);
    // The corner moves on the shape's own spring: the left edge never moves.
    expect(frames.length).toBeGreaterThan(10);
    for (const frame of frames) expect(Math.abs(frame.shape.x - compact.x), JSON.stringify(frame)).toBeLessThan(0.5);
  }
  await page.keyboard.press('Escape');
  await settled(page);
  expect(await box(page)).toEqual(compact);
  // Chosen from the grid: the pill goes back to the strip's corner, on the selection's end.
  await page.keyboard.press('Tab');
  await settled(page);
  await page.keyboard.press('Enter');
  await settled(page, 'pill');
  const pill = await box(page);
  expect(pill.x + pill.width).toBeCloseTo(corner, 0);

  // The selection's end 80 px from the work area's right edge: the grid opens left, as before.
  await on(page, f => { f.workAreaAt(0, 0, 600, 1040); return f.captureMenu('left', 'correct'); });
  await settled(page);
  await page.keyboard.press('Tab');
  await settled(page);
  const grid = await box(page);
  expect(grid.width).toBe(218);
  expect(grid.x + grid.width).toBeCloseTo(corner, 0);
});

test('Îlot: under v4 nothing changes, the menu capture shows no Îlot and a direct capture keeps its spinner pill', async ({ page }) => {
  await openIlot(page);
  await on(page, f => f.settings({ uiVersion: 'v4' }));
  await on(page, f => f.capture('direct'));
  await expect(page.locator('.wait-pill')).toBeVisible();
  await on(page, f => f.captureMenu('v4-menu'));
  await expect(page.locator('[data-capture-id="v4-menu"]')).toBeVisible();
  await expect(page.locator('[data-ilot]')).toHaveCount(0);
  expect(await calls(page, 'focus_overlay')).toHaveLength(0);
  // Under the Îlot, a direct capture keeps the standalone working pill of lot 8.
  await on(page, f => f.settings({ uiVersion: 'ilot' }));
  await on(page, f => f.capture('direct-ilot'));
  await expect(page.locator('.working-pill')).toBeVisible();
  await expect(page.locator('[data-ilot]')).toHaveCount(0);
});
