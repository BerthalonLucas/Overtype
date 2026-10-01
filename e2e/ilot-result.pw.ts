import { test, expect, type Page } from '@playwright/test';
import { ilotRegion, ilotReserve } from '../src/layout';

// Lots 9 and 10 in the Îlot's journey (docs/DA-PLAN.md; docs/BRIDGE.md « Îlot »), over the IPC
// fixture (e2e/native-fixture.ts), which sends the codes of lot 10: once chosen, the Îlot's own
// surface carries the whole result. The work pill becomes the check after a paste, or the error
// pill of its code's family (configuration, transient, paste, content, cancelled), by the same
// spring and without being unmounted; the glass never opens. A browser run with a simulated
// translation: not the Windows window, not an inference.
type Call = { command: string; args?: Record<string, unknown> };
type Region = { x: number; y: number; width: number; height: number; radius: number };
type Geometry = { width: number; height: number; captureId: string; presentation: string; regions: Region[]; frame: Region };
type Box = { x: number; y: number; width: number; height: number };
type Fixture = {
  calls: Call[];
  settings: (next: Record<string, unknown>) => Promise<void>;
  captureMenu: (id: string, lastActionId?: string | null, text?: string) => Promise<void>;
  captureReplace: (id: string, text?: string) => Promise<void>;
  dismissEvent: (captureId: string) => Promise<void>;
  error: (code?: string, message?: string) => Promise<void>;
  done: (text?: string) => Promise<void>;
  deliver: (status: 'applied' | 'fallback', confirmed?: boolean, message?: string, code?: string) => Promise<void>;
  notice: (message: string, code?: string) => Promise<void>;
  invalidate: (anchorLost?: boolean) => Promise<void>;
  refuseReplace: (message?: string | null, code?: string) => void;
  requestId: () => string;
  workAreaAt: (x: number, y: number, width: number, height: number) => void;
};
const on = <T>(page: Page, run: (fixture: Fixture) => T | Promise<T>) => page.evaluate(`(${run.toString()})(window.nativeFixture)`) as Promise<T>;
const calls = (page: Page, command: string) => page.evaluate(name => (window as unknown as { nativeFixture: Fixture }).nativeFixture.calls.filter(call => call.command === name).map(call => call.args ?? {}), command);
const translations = async (page: Page, captureId: string) => (await calls(page, 'translate')).map(args => args.request as { id: string; captureId: string; actionId: string; serverId: string; text: string }).filter(request => request.captureId === captureId);
const geometries = async (page: Page, captureId: string) => (await calls(page, 'resize_overlay') as Geometry[]).filter(geometry => geometry.captureId === captureId);
const box = (page: Page) => page.locator('[data-ilot-shape]').evaluate(element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
const stage = (page: Page) => page.locator('.ilot-stage');

async function openIlot(page: Page, settings: Record<string, unknown> = {}) {
  // Chromium on Windows reports the system's « Effets d'animation »: the springs run here.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 640, height: 480 });
  await page.route('**/?window=overlay&fixture=1', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('/src/main.tsx', '/e2e/native-fixture.ts') });
  });
  await page.goto('/?window=overlay&fixture=1');
  await expect(page.locator('.glass-overlay')).toBeVisible();
  // The Îlot is the fixture's default, as it is Rust's: only the test's own settings are sent.
  await expect(page.locator('html')).toHaveAttribute('data-ui', 'ilot');
  await page.evaluate(next => (window as unknown as { nativeFixture: Fixture }).nativeFixture.settings(next), settings);
}
// The shape at rest: its box the same over two frames apart.
async function settled(page: Page) {
  await expect.poll(async () => { const a = await box(page); await page.waitForTimeout(80); const b = await box(page); return JSON.stringify(a) === JSON.stringify(b); }).toBe(true);
}
// A menu capture, chosen with Enter (its last action): the work pill, on the Îlot's surface,
// tagged so the tests can tell it is the same element later.
async function chooseAndWork(page: Page, id: string, lastActionId: string | null = null) {
  await page.evaluate(({ id, lastActionId }) => (window as unknown as { nativeFixture: Fixture }).nativeFixture.captureMenu(id, lastActionId), { id, lastActionId });
  await expect(stage(page)).toHaveAttribute('data-capture-id', id);
  await expect(stage(page)).toHaveAttribute('data-stage', 'menu');
  await settled(page);
  await page.locator('[data-ilot-shape]').evaluate(element => { (element as HTMLElement & { tag?: string }).tag = 'surface'; });
  await page.keyboard.press('Enter');
  await expect.poll(() => translations(page, id)).toHaveLength(1);
  await expect(stage(page)).toHaveAttribute('data-stage', 'working');
  await settled(page);
}
const sameSurface = (page: Page) => page.locator('[data-ilot-shape]').evaluate(element => (element as HTMLElement & { tag?: string }).tag === 'surface');
// Every frame for `ms` after `act`: the painted shape and the geometry Rust last received.
async function follow(page: Page, captureId: string, act: () => Promise<unknown>, ms = 900) {
  const frames = page.evaluate(({ captureId, ms }) => new Promise<Array<{ shape: Box; geometry: Geometry; layers: number }>>(resolve => {
    const out: Array<{ shape: Box; geometry: Geometry; layers: number }> = [];
    const start = performance.now();
    const tick = () => {
      const element = document.querySelector('[data-ilot-shape]');
      const shape = element?.getBoundingClientRect();
      const geometry = (window as unknown as { nativeFixture: Fixture }).nativeFixture.calls.filter(call => call.command === 'resize_overlay' && call.args?.captureId === captureId).at(-1)?.args as Geometry;
      if (shape) out.push({ shape: { x: shape.x, y: shape.y, width: shape.width, height: shape.height }, geometry, layers: element!.querySelectorAll('.shape-layer').length });
      if (performance.now() - start < ms) requestAnimationFrame(tick); else resolve(out);
    };
    requestAnimationFrame(tick);
  }), { captureId, ms });
  await act();
  return frames;
}
// Several captures per test, each with its springs: more time than the default 20 s under load.
test.describe.configure({ timeout: 45_000 });

const inside = (shape: Box, region: Region) => shape.x >= region.x - 1 && shape.y >= region.y - 1 && shape.x + shape.width <= region.x + region.width + 1 && shape.y + shape.height <= region.y + region.height + 1;

test('configuration: the work pill springs into the error pill on the same surface, and its button opens the request’s own field', async ({ page }) => {
  // The request runs on the second server; the default server changes meanwhile.
  await openIlot(page, { defaultServerId: 's2' });
  await chooseAndWork(page, 'config');
  expect((await translations(page, 'config'))[0]).toMatchObject({ serverId: 's2', actionId: 'correct' });
  await on(page, f => f.settings({ defaultServerId: 's1' }));
  const reserve = ilotReserve('anchored');
  const right = reserve.frame.x + reserve.frame.width;

  // Every painted frame of the spring sits in the region Rust holds; the corner facing the
  // selection never moves (no shake); the old content fades out while the new one fades in.
  const frames = await follow(page, 'config', () => on(page, f => f.error('unauthorized', 'Clé API refusée (401).')));
  await expect(stage(page)).toHaveAttribute('data-stage', 'error');
  await expect(stage(page)).toHaveAttribute('data-error', 'unauthorized');
  await settled(page);
  expect(frames.length).toBeGreaterThan(10);
  for (const frame of frames) {
    expect(inside(frame.shape, frame.geometry.regions[0]), JSON.stringify(frame)).toBe(true);
    expect(Math.abs(frame.shape.x + frame.shape.width - right)).toBeLessThan(0.5);
    expect(Math.abs(frame.shape.y - reserve.frame.y)).toBeLessThan(0.5);
  }
  expect(frames.some(frame => frame.layers === 2)).toBe(true);
  const pill = await box(page);
  // The spring was seen between the two widths, not a jump.
  expect(frames.filter(frame => frame.shape.width > 46 && frame.shape.width < pill.width - 2).length).toBeGreaterThan(3);
  expect(pill.height).toBe(30);
  await expect(page.locator('[data-ilot-shape]')).toHaveCSS('border-radius', '15px');
  expect((await geometries(page, 'config')).at(-1)?.regions).toEqual([ilotRegion('anchored', 'below', pill)]);
  for (const geometry of await geometries(page, 'config')) expect(geometry).toMatchObject({ width: reserve.width, height: reserve.height, frame: reserve.frame });
  expect(await sameSurface(page)).toBe(true);

  // Its words, never Rust's French message; the icon, the text, one button, ✕; never the glass.
  await expect(page.getByRole('alert')).toHaveText('API key rejected');
  await expect(stage(page)).not.toContainText('401');
  await expect(page.locator('.ilot-stage button')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Fix key' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close' })).toBeVisible();
  await expect(page.locator('.result-error-icon svg')).toHaveCount(1);
  await expect(page.locator('.glass-overlay')).toHaveCount(0);

  await page.getByRole('button', { name: 'Fix key' }).click();
  await expect.poll(() => calls(page, 'open_settings')).toEqual([{ field: 's2.apiKey' }]);
  // The Settings took over: the pill has said what it had to and leaves.
  await expect.poll(() => calls(page, 'dismiss_overlay')).toHaveLength(1);
  await expect.poll(() => calls(page, 'complete_overlay_dismiss')).toEqual([{ captureId: 'config' }]);
  await expect(page.locator('[data-ilot]')).toHaveCount(0);
  expect(await translations(page, 'config')).toHaveLength(1);
});

test('near the work area’s left edge the error pill slides right to stay on the screen, on the shape’s spring; the work pill stays on the selection’s end', async ({ page }) => {
  await openIlot(page, { language: 'fr' });
  // Rust clamped the strip against the work area's left edge: the strip's corner (432 in the
  // window, which Rust put at x = 88) is 283 px right of it, the work area starting at x = 237.
  await on(page, f => f.workAreaAt(237, 0, 1683, 1040));
  const reserve = ilotReserve('anchored');
  const corner = reserve.frame.x + reserve.frame.width;
  const edge = 237 - 88;
  await chooseAndWork(page, 'edge');
  const work = await box(page);
  expect(work.x + work.width).toBeCloseTo(corner, 0);

  // The widest pill (« Texte non modifiable, rien remplacé » + « Copier le résultat »).
  await on(page, f => f.done('Texte synthétique'));
  const frames = await follow(page, 'edge', () => on(page, f => f.deliver('fallback', false, 'Ce champ n’est pas modifiable; utilisez Copier.', 'not_editable')));
  await expect(stage(page)).toHaveAttribute('data-error', 'not_editable');
  await settled(page);
  const pill = await box(page);
  expect(pill.width).toBeGreaterThan(283);
  // At rest on the work area's left edge: slid right by what it overhangs, inside the reserve.
  const shift = Math.ceil(pill.width - 283);
  expect(Math.abs(pill.x - edge)).toBeLessThan(1);
  expect(pill.x + pill.width).toBeCloseTo(corner + shift, 0);
  expect(pill.x + pill.width).toBeLessThanOrEqual(reserve.width - 32);
  expect((await geometries(page, 'edge')).at(-1)?.regions).toEqual([ilotRegion('anchored', 'below', { ...pill, shift })]);
  // Every frame of the spring stays on the screen and in the region Rust holds; the slide is seen
  // between its two positions, not a jump; same surface, same window and frame.
  expect(frames.length).toBeGreaterThan(10);
  for (const frame of frames) {
    expect(frame.shape.x, JSON.stringify(frame)).toBeGreaterThanOrEqual(edge - 1);
    expect(inside(frame.shape, frame.geometry.regions[0]), JSON.stringify(frame)).toBe(true);
  }
  expect(frames.filter(frame => frame.shape.x + frame.shape.width > corner + 2 && frame.shape.x + frame.shape.width < corner + shift - 2).length).toBeGreaterThan(3);
  expect(await sameSurface(page)).toBe(true);
  for (const geometry of await geometries(page, 'edge')) expect(geometry).toMatchObject({ width: reserve.width, height: reserve.height, frame: reserve.frame });

  // Far from the edge (the default work area), the same pill grows left from the selection's end.
  await on(page, f => f.workAreaAt(0, 0, 1920, 1040));
  await chooseAndWork(page, 'middle');
  await on(page, f => f.done('Texte synthétique'));
  await on(page, f => f.deliver('fallback', false, 'Ce champ n’est pas modifiable; utilisez Copier.', 'not_editable'));
  await expect(stage(page)).toHaveAttribute('data-error', 'not_editable');
  await settled(page);
  const middle = await box(page);
  expect(middle.x + middle.width).toBeCloseTo(corner, 0);
  expect((await geometries(page, 'middle')).at(-1)?.regions).toEqual([ilotRegion('anchored', 'below', middle)]);
});

test('configuration: each code opens its own field, in English and in French', async ({ page }) => {
  await openIlot(page);
  for (const [code, label, field] of [['unreachable', 'Open endpoint', 's1.endpoint'], ['bad_endpoint', 'Open endpoint', 's1.endpoint'], ['model_not_found', 'Choose model', 's1.model']] as const) {
    await chooseAndWork(page, `field-${code}`);
    await on(page, f => f.settings({ servers: [{ id: 's1', name: 'Quality', endpoint: '', apiKey: '', noKey: false, model: 'gemma-4-12b' }, { id: 's2', name: 'Fast', endpoint: '', apiKey: '', noKey: false, model: 'test' }] }));
    await page.evaluate(code => (window as unknown as { nativeFixture: Fixture }).nativeFixture.error(code), code);
    await page.getByRole('button', { name: label }).click();
    await expect.poll(async () => (await calls(page, 'open_settings')).at(-1)).toEqual({ field });
  }
  // The model's name comes from the settings, never from the server.
  await chooseAndWork(page, 'model-fr');
  await on(page, f => f.settings({ language: 'fr' }));
  await on(page, f => f.error('model_not_found', 'Le serveur ne connaît pas ce modèle.'));
  await expect(page.getByRole('alert')).toHaveText('Modèle introuvable : gemma-4-12b');
  await expect(page.getByRole('button', { name: 'Choisir le modèle' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fermer' })).toBeVisible();
});

test('transient: Try again runs the same action on the same capture once, back to work on the same surface; the Îlot pastes that result itself', async ({ page }) => {
  await openIlot(page);
  await chooseAndWork(page, 'retry', 'translate');
  const [first] = await translations(page, 'retry');
  await on(page, f => f.error('busy', 'Serveur occupé (503).'));
  await expect(page.getByRole('alert')).toHaveText('Server busy — try again');
  // Two clicks in a row: one relaunch.
  await page.getByRole('button', { name: 'Try again' }).dblclick();
  await expect(stage(page)).toHaveAttribute('data-stage', 'working');
  await page.waitForTimeout(300);
  const runs = await translations(page, 'retry');
  expect(runs).toHaveLength(2);
  expect(runs[1]).toMatchObject({ captureId: 'retry', actionId: 'translate', serverId: first.serverId, text: first.text });
  expect(runs[1].id).not.toBe(first.id);
  expect(await sameSurface(page)).toBe(true);
  await expect(page.getByRole('img', { name: 'Working' })).toHaveAttribute('data-orb', 'shown');

  // Rust delivers a capture's first request only: the retried result is pasted through
  // replace_result, once, which revalidates the target (BRIDGE, Îlot).
  await on(page, f => f.done('Synthetic result'));
  await expect.poll(() => calls(page, 'replace_result')).toEqual([{ requestId: runs[1].id }]);
  await expect(page.getByRole('group', { name: 'Selection replaced' }).locator('.result-check')).toBeVisible();
  expect(await sameSurface(page)).toBe(true);
  await expect.poll(() => calls(page, 'dismiss_overlay')).toHaveLength(1);
  expect(await calls(page, 'replace_result')).toHaveLength(1);
  expect(await calls(page, 'copy_result')).toHaveLength(0);
});

test('transient: a retried result the paste refuses says why with Copy result; a dropped selection is never pasted over', async ({ page }) => {
  await openIlot(page);
  // replace_result refuses with `{message, code}`: the code alone says the cause (the source
  // window changed, keys held, the paste blocked), always with Copy result. The French message is
  // for the 0.4 glass: here it even says something else, and is never read nor shown.
  const causes = [
    ['target_changed', 'Text changed — not replaced'],
    ['keys_held', 'Keys held down, not replaced'],
    ['paste_blocked', 'Can’t edit this app’s text'],
    ['not_editable', 'Read-only text, not replaced'],
  ] as const;
  for (const [index, [code, text]] of causes.entries()) {
    const id = `refused-${code}`;
    await chooseAndWork(page, id);
    await on(page, f => f.error('timeout'));
    await expect(page.getByRole('alert')).toHaveText('Server took too long');
    await page.evaluate(code => (window as unknown as { nativeFixture: Fixture }).nativeFixture.refuseReplace('Relâchez les touches du raccourci; remplacement refusé.', code), code);
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect.poll(() => translations(page, id)).toHaveLength(2);
    await on(page, f => f.done('Synthetic result'));
    await expect(stage(page)).toHaveAttribute('data-error', code);
    await expect(page.getByRole('alert')).toHaveText(text);
    await expect(stage(page)).not.toContainText('remplacement refusé');
    await expect(page.getByRole('button', { name: 'Copy result' })).toBeVisible();
    expect(await calls(page, 'replace_result')).toHaveLength(index + 1);
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('[data-ilot]')).toHaveCount(0);
  }
  await on(page, f => { f.refuseReplace(null); });

  // The watcher dropped the selection during the retry: nothing is even tried.
  await chooseAndWork(page, 'moved');
  await on(page, f => f.error('stream_broken'));
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect.poll(() => translations(page, 'moved')).toHaveLength(2);
  await on(page, f => f.invalidate());
  await on(page, f => f.done('Synthetic result'));
  await expect(stage(page)).toHaveAttribute('data-error', 'target_changed');
  await expect(page.getByRole('alert')).toHaveText('Text changed — not replaced');
  expect(await calls(page, 'replace_result')).toHaveLength(causes.length);
});

test('paste: a refused paste says why with Copy result; the copy goes through copy_result, nothing is replaced, the result never shows', async ({ page }) => {
  await openIlot(page);
  await chooseAndWork(page, 'paste');
  // Synthetic text, invented for the test.
  await on(page, f => f.done('Texte synthétique du résultat'));
  await on(page, f => f.deliver('fallback', false, 'La fenêtre source a changé; remplacement refusé.', 'target_changed'));
  await expect(page.getByRole('alert')).toHaveText('Text changed — not replaced');
  await expect(stage(page)).not.toContainText('synthétique');
  await expect(stage(page)).not.toContainText('remplacement refusé');
  await expect(page.locator('.glass-overlay')).toHaveCount(0);
  expect(await sameSurface(page)).toBe(true);
  await settled(page);
  const before = await box(page);
  const requestId = await on(page, f => f.requestId());
  await page.getByRole('button', { name: 'Copy result' }).click();
  await expect.poll(() => calls(page, 'copy_result')).toEqual([{ requestId }]);
  // « Copied » in place: the pill never grows, nothing moves.
  await expect(page.locator('.result-swap > span:not([aria-hidden])')).toHaveText('Copied');
  expect(await box(page)).toEqual(before);
  await expect.poll(() => calls(page, 'dismiss_overlay')).toHaveLength(1);
  expect(await calls(page, 'replace_result')).toHaveLength(0);
  expect(await translations(page, 'paste')).toHaveLength(1);

  // In French, and a paste Rust never reported (three seconds after the result): Copy result too.
  await on(page, f => f.settings({ language: 'fr' }));
  await chooseAndWork(page, 'silent-paste');
  await on(page, f => f.done('Texte synthétique du résultat'));
  await expect(stage(page)).toHaveAttribute('data-error', 'paste_blocked', { timeout: 6000 });
  await expect(page.getByRole('alert')).toHaveText('Impossible de modifier ce texte');
  await expect(page.getByRole('button', { name: 'Copier le résultat' })).toBeVisible();
  await expect(page.locator('.notice-pill, .compact-feedback')).toHaveCount(0);
});

test('content: the text alone and ✕; cancelled: the pill just leaves', async ({ page }) => {
  await openIlot(page);
  await chooseAndWork(page, 'content');
  await on(page, f => f.error('too_long'));
  await expect(page.getByRole('alert')).toHaveText('Selection too long (max 6,000 characters)');
  await expect(page.locator('.ilot-stage button')).toHaveCount(1);
  await page.getByRole('button', { name: 'Close' }).click();
  await expect.poll(() => calls(page, 'dismiss_overlay')).toHaveLength(1);
  await expect(page.locator('[data-ilot]')).toHaveCount(0);

  await chooseAndWork(page, 'cancelled');
  const errorsSeen = page.evaluate(() => new Promise<boolean>(resolve => {
    let seen = false;
    const observer = new MutationObserver(() => { if (document.querySelector('.result-error')) seen = true; });
    observer.observe(document.body, { childList: true, subtree: true });
    window.setTimeout(() => { observer.disconnect(); resolve(seen); }, 800);
  }));
  await on(page, f => f.error('cancelled', 'Traduction annulée.'));
  await expect.poll(() => calls(page, 'dismiss_overlay')).toHaveLength(2);
  expect(await errorsSeen).toBe(false);

  // An unknown code reads as internal: Try again.
  await chooseAndWork(page, 'unknown');
  await on(page, f => f.error('teapot'));
  await expect(page.getByRole('alert')).toHaveText('Something went wrong');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  // Escape closes the error pill as it closes the work pill.
  await page.keyboard.press('Escape');
  await expect.poll(() => calls(page, 'dismiss_overlay')).toHaveLength(3);
});

test('the check after a paste stays 1.1 s on the simulated clock, without Undo while Rust offers none; turned off, the Îlot closes at once', async ({ page }) => {
  await page.clock.install();
  await openIlot(page);
  await chooseAndWork(page, 'check');
  await on(page, f => f.done('Synthetic result'));
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 50));
  await on(page, f => f.deliver('applied'));
  await expect(page.locator('.result-check')).toBeAttached();
  // Undo is on in the settings, but Rust offers none for this paste (no `undoable`): the check alone.
  await expect(page.locator('.result-undo')).toHaveCount(0);
  await expect(page.locator('[data-result-content="done"]')).toHaveClass(/is-check-only/);
  expect(await sameSurface(page)).toBe(true);
  await page.clock.runFor(1099);
  expect(await calls(page, 'dismiss_overlay')).toHaveLength(0);
  await expect(page.locator('.result-check')).toBeAttached();
  await page.clock.runFor(1);
  await expect.poll(() => calls(page, 'dismiss_overlay')).toHaveLength(1);
  await page.clock.resume();
  await expect.poll(() => calls(page, 'complete_overlay_dismiss')).toEqual([{ captureId: 'check' }]);

  // settings.afterReplace.check = false: no check at all, the Îlot leaves after the lab's 60 ms.
  await on(page, f => f.settings({ afterReplace: { check: false, undo: true, undoSeconds: 8, changedWords: true, changedWordsSeconds: 60 } }));
  await chooseAndWork(page, 'no-check');
  await on(page, f => f.done('Synthetic result'));
  const checkSeen = page.evaluate(() => new Promise<boolean>(resolve => {
    let seen = false;
    const observer = new MutationObserver(() => { if (document.querySelector('.result-check')) seen = true; });
    observer.observe(document.body, { childList: true, subtree: true });
    window.setTimeout(() => { observer.disconnect(); resolve(seen); }, 400);
  }));
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 50));
  await on(page, f => f.deliver('applied'));
  await expect(stage(page)).toHaveAttribute('data-stage', 'done');
  await page.clock.runFor(59);
  expect(await calls(page, 'dismiss_overlay')).toHaveLength(1);
  await page.clock.runFor(1);
  await expect.poll(() => calls(page, 'dismiss_overlay')).toHaveLength(2);
  await page.clock.resume();
  expect(await checkSeen).toBe(false);
});

test('a capture Rust refuses under the Îlot reads as its error pill, in the interface language, without a button; v4 keeps its message', async ({ page }) => {
  await openIlot(page);
  await on(page, f => f.dismissEvent('first'));
  await expect(page.locator('.glass-overlay')).toHaveCount(0);
  const resizes = (await calls(page, 'resize_overlay')).length;
  await on(page, f => f.notice('Rien à traduire dans la fenêtre active.', 'no_selection'));
  const notice = page.locator('.notice-root[data-notice="no_selection"]');
  await expect(notice.getByRole('alert')).toHaveText('Select some text first');
  await expect(notice.locator('.result-error-icon svg')).toHaveCount(1);
  await expect(notice.locator('button')).toHaveCount(0);
  await expect(notice.locator('[data-ilot-shape]')).toHaveCSS('height', '30px');
  await expect(page.locator('.notice-pill')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('Rien à traduire');
  // Rust shows it alone and hides it: no geometry asked, never clickable.
  expect((await calls(page, 'resize_overlay')).length).toBe(resizes);
  await expect(notice).toHaveCSS('pointer-events', 'none');
  // Two situations where selecting text would not help have their own codes: a shortcut pressed
  // while the Settings window is in front, the tray's « Revoir » with nothing recent. Only the
  // code decides: Rust's words are never read (the same words under no_selection say no_selection).
  await on(page, f => f.notice('Fermez les réglages avant d’utiliser un raccourci.', 'settings_open'));
  await expect(page.locator('.notice-root[data-notice="settings_open"]').getByRole('alert')).toHaveText('Close Settings first');
  await on(page, f => f.notice('Aucune traduction récente.', 'nothing_recent'));
  await expect(page.locator('.notice-root[data-notice="nothing_recent"]').getByRole('alert')).toHaveText('No recent translation');
  await expect(page.locator('.notice-root button')).toHaveCount(0);
  await on(page, f => f.notice('Fermez les réglages avant d’utiliser un raccourci.', 'no_selection'));
  await expect(page.locator('.notice-root[data-notice="no_selection"]').getByRole('alert')).toHaveText('Select some text first');
  await expect(page.locator('body')).not.toContainText('Aucune traduction');
  await expect(page.locator('body')).not.toContainText('Fermez les réglages');
  // A code this front does not know reads as internal, never a blank page.
  await on(page, f => f.notice('Rien.', 'teapot'));
  await expect(page.locator('.notice-root[data-notice="internal"]').getByRole('alert')).toHaveText('Something went wrong');
  // A paste code at the capture: the source window changed before anything was tried, nothing
  // was read, nothing to copy.
  await on(page, f => f.settings({ language: 'fr' }));
  await on(page, f => f.notice('La fenêtre source a changé pendant la capture. Réessayez.', 'target_changed'));
  await expect(page.locator('.notice-root[data-notice="target_changed"]').getByRole('alert')).toHaveText('Fenêtre changée, réessayez');
  await expect(page.locator('.notice-root button')).toHaveCount(0);
  await on(page, f => f.notice('Fermez les réglages avant d’utiliser un raccourci.', 'settings_open'));
  await expect(page.locator('.notice-root').getByRole('alert')).toHaveText('Fermez d’abord les Réglages');
  await on(page, f => f.notice('Aucune traduction récente.', 'nothing_recent'));
  await expect(page.locator('.notice-root').getByRole('alert')).toHaveText('Aucune traduction récente');
  await on(page, f => f.notice('La capture est refusée dans un champ protégé.', 'protected_field'));
  await expect(page.locator('.notice-root').getByRole('alert')).toHaveText('Champ protégé, rien lu');

  // The 0.4 journey keeps Rust's message in its own pill.
  await on(page, f => f.settings({ uiVersion: 'v4', language: 'en' }));
  await on(page, f => f.notice('Rien à traduire dans la fenêtre active.', 'no_selection'));
  await expect(page.locator('.notice-pill')).toHaveText('Rien à traduire dans la fenêtre active.');
  await expect(page.locator('.result-error')).toHaveCount(0);
});

test('under v4 the codes change nothing: an error and a refused paste still open the glass with Rust’s message', async ({ page }) => {
  await openIlot(page);
  await on(page, f => f.settings({ uiVersion: 'v4' }));
  await on(page, f => f.captureReplace('v4-error'));
  await expect(page.locator('.glass-overlay[data-capture-id="v4-error"]')).toBeVisible();
  await on(page, f => f.error('unauthorized', 'Clé API refusée.'));
  await expect(page.locator('.error-copy')).toContainText('Clé API refusée.');
  await expect(page.locator('.result-error, [data-ilot]')).toHaveCount(0);
  await on(page, f => f.captureReplace('v4-paste'));
  await on(page, f => f.done('Résultat synthétique'));
  await on(page, f => f.deliver('fallback', false, 'La fenêtre source a changé; remplacement refusé.', 'target_changed'));
  await expect(page.locator('.translation-text')).toHaveText('Résultat synthétique');
  await expect(page.locator('.compact-feedback')).toHaveText('La fenêtre source a changé; remplacement refusé.');
  await expect(page.locator('.result-error, [data-ilot]')).toHaveCount(0);
});
