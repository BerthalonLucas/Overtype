import { test, expect, type Page } from '@playwright/test';
import {
  anchoredFloor,
  anchoredReserve,
  bottomReserve,
  glass,
  halo,
  menu,
  readerMetrics,
  shortMetrics,
} from '../src/layout';
import { workingPillShape } from '../src/loaders/pill';
import type { Settings, UiVersion } from '../src/types';

declare global {
  interface Window {
    nativeFixture: {
      calls: Array<{ command: string; args?: Record<string, unknown> }>;
      capture: (id: string, text?: string) => Promise<void>;
      unanchored: (id: string) => Promise<void>;
      delta: (text: string, requestId?: string) => Promise<void>;
      done: () => Promise<void>;
      dismissEvent: (captureId: string) => Promise<void>;
      requestId: () => string;
      recoverSettings: () => void;
      connect: () => void;
      refuseShortcut: () => void;
      refuseReplace: () => void;
      captureReplace: (id: string, text?: string) => Promise<void>;
      deliver: (status: 'applied' | 'fallback', confirmed?: boolean, message?: string) => Promise<void>;
      error: () => Promise<void>;
      holdCopy: () => void;
      releaseCopy: () => void;
      near: (near: boolean) => Promise<void>;
      target: (captureId: string, canReplace: boolean) => Promise<void>;
      notice: (message: string) => Promise<void>;
      replay: (id: string) => Promise<void>;
      workArea: (width: number, height: number, scale?: number) => Promise<void>;
      settings: (next: Partial<Settings>) => Promise<void>;
    };
  }
}

// The fixture starts in the Îlot, as the app does; `ui: 'v4'` asks for the 0.4 journey.
async function openNativeFixture(page: Page, ui: UiVersion = 'ilot') {
  await page.setViewportSize({ width: 640, height: 480 });
  await page.route('**/?window=overlay&fixture=1*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('/src/main.tsx', '/e2e/native-fixture.ts') });
  });
  await page.goto(`/?window=overlay&fixture=1${ui === 'v4' ? '&ui=v4' : ''}`);
  await expect(page.locator('html')).toHaveAttribute('data-ui', ui);
  await expect(page.locator('.glass-overlay')).toBeVisible();
}
// The waiting pill of each journey, where the glass's action pill will stand: the Îlot's working
// pill (lot 8, Perle by default) and the 0.4 spinner pill (uiVersion « v4 », asked for).
const journeys = [
  { ui: 'ilot', name: 'Îlot', pill: '.working-pill', width: workingPillShape('perle').width },
  { ui: 'v4', name: '0.4', pill: '.wait-pill', width: glass.waitPill.width },
] as const;
const geometry = (page: Page) =>
  page.evaluate(() => window.nativeFixture.calls.filter((call) => call.command === 'resize_overlay').at(-1)?.args);
const resizeCount = (page: Page) =>
  page.evaluate(() => window.nativeFixture.calls.filter((call) => call.command === 'resize_overlay').length);
const dimmingCalls = (page: Page) =>
  page.evaluate(() =>
    window.nativeFixture.calls.filter((call) => call.command === 'overlay_dimming').map((call) => call.args?.dimming),
  );
type Region = { x: number; y: number; width: number; height: number; radius: number };
const regionsOf = async (page: Page) => ((await geometry(page))?.regions ?? []) as Region[];
const fixtureScreen = { width: 1920, height: 1040 };
const short = shortMetrics('normal');

// Calibrated reading (2026-09-14): the waiting pill reserves the anchored window on the
// glass footprint (Rust anchors `frame`, not the pill), the short result then publishes
// the glass once at the same size; the menu only changes the surfaces. Both journeys.
for (const { ui, name, pill, width } of journeys)
  test(`IPC fixture (${name}): the waiting pill reserves the anchored window on the glass footprint; a short result opens there and the menu never resizes it`, async ({
    page,
  }) => {
    await openNativeFixture(page, ui);
    await expect.poll(async () => (await geometry(page))?.width).toBe(anchoredReserve.width);
    const initial = await geometry(page);
    expect(initial?.height).toBe(anchoredFloor);
    expect(initial?.presentation).toBe('anchored');
    expect(initial?.frame).toEqual({
      x: halo.x,
      y: halo.top + glass.overlap,
      width: glass.shortWidth,
      height: short.minHeight,
      radius: 0,
    });
    const waiting = await regionsOf(page);
    expect(waiting).toHaveLength(1);
    expect(waiting[0]).toEqual({
      x: halo.x + glass.shortWidth - glass.pillInset - width,
      y: halo.top,
      width,
      height: 28,
      radius: 14,
    });
    await expect(page.locator(pill)).toBeVisible();
    await expect(page.locator('.translation-bubble')).toHaveCount(0);
    const initialCount = await resizeCount(page);
    await page.evaluate(async () => {
      for (let i = 0; i < 4; i++) await window.nativeFixture.delta('Bonjour, ');
    });
    // Buffered: nothing lands and nothing resizes before the stream ends.
    await expect(page.locator(pill)).toBeVisible();
    expect(await resizeCount(page)).toBe(initialCount);
    await page.evaluate(() => window.nativeFixture.done());
    await expect(page.locator('.translation-text')).toContainText('Bonjour, Bonjour, Bonjour, Bonjour,');
    await expect(page.locator('.glass-overlay')).toHaveAttribute('data-form', 'short');
    await expect.poll(async () => (await regionsOf(page)).length).toBe(2);
    expect(await resizeCount(page)).toBe(initialCount + 1);
    const opened = await geometry(page);
    expect([opened!.width, opened!.height, opened!.presentation]).toEqual([
      anchoredReserve.width,
      anchoredFloor,
      'anchored',
    ]);
    const regions = opened!.regions as Region[];
    expect(regions[0]).toMatchObject({ x: halo.x, y: halo.top + glass.overlap, width: glass.shortWidth });
    // One line: 53 px plus the border, so the radius is capped at half the height.
    expect(regions[0].radius).toBeGreaterThanOrEqual(27);
    expect(regions[0].height).toBeLessThanOrEqual(short.maxHeight);
    expect(regions[1]).toMatchObject({ width: 76, height: 28, y: halo.top });
    expect(regions[1].x + regions[1].width).toBe(halo.x + glass.shortWidth - glass.pillInset);
    expect(opened!.frame).toEqual({ ...regions[0], radius: 0 });
    await expect(page.locator('.translation-bubble')).toHaveAttribute('data-reveal', 'true');
    await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toBeEnabled();
    await expect(page.locator('.translation-bubble')).toHaveCSS('width', '380px');
    await page.getByRole('button', { name: 'More options', exact: true }).click();
    await expect(page.getByRole('menu')).toBeVisible();
    await expect(page.getByRole('menu')).toHaveCSS('transform', 'none');
    await expect.poll(async () => (await regionsOf(page)).length).toBe(3);
    const withMenu = await geometry(page);
    const menuRegion = (withMenu!.regions as Region[])[2];
    expect(menuRegion.y - regions[0].y).toBe(20);
    expect(menuRegion.width).toBe(196);
    expect(menuRegion.height).toBeLessThanOrEqual(menu.reserve);
    expect(menuRegion.y + menuRegion.height).toBeLessThanOrEqual(withMenu!.height as number);
    for (const part of withMenu!.regions as Region[]) {
      expect(part.x).toBeGreaterThanOrEqual(0);
      expect(part.y).toBeGreaterThanOrEqual(0);
      expect(part.x + part.width).toBeLessThanOrEqual(withMenu!.width as number);
      expect(part.y + part.height).toBeLessThanOrEqual(withMenu!.height as number);
      expect(part.radius * 2).toBeLessThanOrEqual(Math.min(part.width, part.height));
    }
    expect([withMenu!.width, withMenu!.height]).toEqual([anchoredReserve.width, anchoredFloor]);
    await page.evaluate(() => window.nativeFixture.capture('second'));
    await expect.poll(async () => (await geometry(page))?.captureId).toBe('second');
    await expect.poll(async () => (await geometry(page))?.presentation).toBe('anchored');
    await expect(page.locator(pill)).toBeVisible();
  });

test('IPC fixture: initial regions are sent even when hidden WebView rAF is suspended', async ({ page }) => {
  await page.addInitScript(() => {
    window.requestAnimationFrame = () => 1;
  });
  await openNativeFixture(page);
  await expect.poll(async () => (await geometry(page))?.captureId).toBe('first');
  expect(((await geometry(page))?.regions as unknown[]).length).toBe(1);
  expect((await geometry(page))?.frame).toBeTruthy();
});

test('IPC fixture: native close request animates then acknowledges and ignores late streams', async ({ page }) => {
  await openNativeFixture(page);
  await page.evaluate(() => window.nativeFixture.delta('Bonjour'));
  const request = await page.evaluate(() => window.nativeFixture.requestId());
  await page.evaluate(() => window.nativeFixture.dismissEvent('first'));
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-closing', 'true');
  await expect(page.locator('.glass-overlay')).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      window.nativeFixture.calls
        .filter((call) => call.command === 'complete_overlay_dismiss')
        .map((call) => call.args?.captureId),
    ),
  ).toEqual(['first']);
  await page.evaluate((id) => window.nativeFixture.delta('Late stream', id), request);
  await expect(page.locator('.glass-overlay')).toHaveCount(0);
});

test('IPC fixture: a new capture during exit cannot be closed by the old animation', async ({ page }) => {
  await openNativeFixture(page);
  await page.evaluate(async () => {
    await window.nativeFixture.dismissEvent('first');
    // Mid-exit whatever the machine's load: a fixed 35 ms wait could outlast the 120 ms exit
    // on a busy runner (1 failure in 12 before the Îlot branch). The capture lands on the first
    // frame where the glass is closing.
    await new Promise<void>((resolve) => {
      const check = () =>
        document.querySelector('.glass-overlay[data-closing="true"]') ? resolve() : requestAnimationFrame(check);
      check();
    });
    await window.nativeFixture.capture('new-capture');
    await window.nativeFixture.delta('Nouvelle traduction');
    await window.nativeFixture.done();
  });
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-capture-id', 'new-capture');
  await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toBeEnabled();
  expect(
    await page.evaluate(
      () => window.nativeFixture.calls.filter((call) => call.command === 'complete_overlay_dismiss').length,
    ),
  ).toBe(0);
  await page.evaluate(() => window.nativeFixture.dismissEvent('first'));
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-closing', 'false');
});

test('IPC fixture: a late copy acknowledgement never appears in the next capture', async ({ page }) => {
  await openNativeFixture(page);
  await page.evaluate(async () => {
    await window.nativeFixture.delta('Bonjour');
    await window.nativeFixture.done();
    window.nativeFixture.holdCopy();
  });
  await page.getByRole('button', { name: 'Copy translation', exact: true }).click();
  await page.evaluate(async () => {
    await window.nativeFixture.capture('next');
    window.nativeFixture.releaseCopy();
    await window.nativeFixture.delta('Autre traduction');
    await window.nativeFixture.done();
  });
  await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toBeEnabled();
  await expect(page.locator('.compact-feedback')).toHaveCount(0);
});

test('IPC fixture: reduced motion closes immediately through the same handshake', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openNativeFixture(page);
  await page.evaluate(() => window.nativeFixture.dismissEvent('first'));
  await expect(page.locator('.glass-overlay')).toHaveCount(0);
  expect(
    await page.evaluate(() => window.nativeFixture.calls.some((call) => call.command === 'complete_overlay_dismiss')),
  ).toBe(true);
});

// A long result becomes a reader band: the window moves to the bottom reserve sized from
// the capture's screen (half the width, 45 % of the height), invisible until Rust has
// placed it; a `work-area` event (the cursor changed screen) resizes the band.
// UI-025: the placement is decided at the capture on the source text, so a long selection
// waits at the bottom from the start and the band is born there without any move.
for (const { ui, name, width } of journeys)
  test(`IPC fixture (${name}): a long source waits at the bottom from the start; the band is born there without a move`, async ({
    page,
  }) => {
    await openNativeFixture(page, ui);
    await page.setViewportSize({ width: 1100, height: 800 });
    const reserve = bottomReserve(fixtureScreen, 'normal');
    await page.evaluate(() =>
      window.nativeFixture.capture('long-source', 'Une longue sélection à traduire. '.repeat(40)),
    );
    await expect.poll(async () => (await geometry(page))?.captureId).toBe('long-source');
    await expect(page.locator('.glass-overlay')).toHaveAttribute('data-placement', 'bottom');
    const initial = await geometry(page);
    expect([initial!.width, initial!.height, initial!.presentation]).toEqual([reserve.width, reserve.height, 'bottom']);
    expect((initial!.regions as Region[])[0]).toMatchObject({ x: (reserve.width - width) / 2, width, height: 28 });
    await page.evaluate(async () => {
      await window.nativeFixture.delta('Une longue traduction. '.repeat(120));
      await window.nativeFixture.done();
    });
    await expect(page.locator('.glass-overlay')).toHaveAttribute('data-form', 'reader');
    await expect(page.locator('.glass-overlay')).toHaveAttribute('data-moving', 'false');
    const landed = await geometry(page);
    expect([landed!.width, landed!.height, landed!.presentation]).toEqual([reserve.width, reserve.height, 'bottom']);
    expect((landed!.regions as Region[])[0]).toMatchObject({
      x: halo.x,
      width: readerMetrics(fixtureScreen, 'normal').width,
    });
  });

// A short source translated long is the rare case that still moves.
test('IPC fixture: a long result from a short source moves to the bottom as a reader sized from its screen; a work-area event resizes it', async ({
  page,
}) => {
  await openNativeFixture(page);
  // The preview viewport must hold the 1024 px reserve for the pill to be clickable.
  await page.setViewportSize({ width: 1100, height: 800 });
  const reader = readerMetrics(fixtureScreen, 'normal');
  const reserve = bottomReserve(fixtureScreen, 'normal');
  await page.evaluate(async () => {
    await window.nativeFixture.delta('Une longue traduction. '.repeat(120));
    await window.nativeFixture.done();
  });
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-form', 'reader');
  await expect.poll(async () => (await geometry(page))?.presentation).toBe('bottom');
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-moving', 'false');
  const moved = await geometry(page);
  expect([moved!.width, moved!.height]).toEqual([reserve.width, reserve.height]);
  expect(reserve.width).toBe(960 + 2 * halo.x);
  const regions = moved!.regions as Region[];
  expect(regions[0]).toMatchObject({ x: halo.x, width: reader.width, height: reader.maxHeight, radius: 28 });
  expect(regions[0].y + regions[0].height + halo.bottomForm).toBe(reserve.height);
  expect(regions[1]).toMatchObject({ width: 100, height: 28 });
  await expect(page.locator('.translation-bubble')).toHaveCSS('width', `${reader.width}px`);
  await expect(page.locator('.translation-copy')).toHaveCSS('line-height', '33px');
  await expect(page.locator('.translation-copy')).toHaveCSS('font-size', '22px');
  await expect(page.locator('.translation-bubble')).toHaveAttribute('data-reveal', 'true');
  await expect(page.getByRole('button', { name: 'Pin', exact: true })).toBeVisible();
  // The menu opens above the pill, inside the reserve, without a resize.
  const count = await resizeCount(page);
  await page.getByRole('button', { name: 'More options', exact: true }).click();
  await expect.poll(async () => (await regionsOf(page)).length).toBe(3);
  const withMenu = await regionsOf(page);
  expect(withMenu[2].y).toBeGreaterThanOrEqual(halo.top);
  expect(Math.abs(withMenu[2].y + withMenu[2].height + 6 - regions[1].y)).toBeLessThanOrEqual(1);
  expect([(await geometry(page))!.width, (await geometry(page))!.height]).toEqual([reserve.width, reserve.height]);
  await page.keyboard.press('Escape');
  // The cursor moved to a larger screen under the band: half of it now.
  await page.evaluate(() => window.nativeFixture.workArea(2560, 1400));
  const wide = bottomReserve({ width: 2560, height: 1400 }, 'normal');
  await expect.poll(async () => (await geometry(page))?.width).toBe(wide.width);
  expect((await geometry(page))?.height).toBe(wide.height);
  await expect(page.locator('.translation-bubble')).toHaveCSS('width', '1280px');
  expect(count).toBeLessThan(await resizeCount(page));
});

for (const { ui, name, width } of journeys)
  test(`IPC fixture (${name}): a capture without an anchor opens at the bottom at once, its waiting pill centred`, async ({
    page,
  }) => {
    await openNativeFixture(page, ui);
    await page.evaluate(() => window.nativeFixture.unanchored('clip'));
    await expect.poll(async () => (await geometry(page))?.captureId).toBe('clip');
    const reserve = bottomReserve(fixtureScreen, 'normal');
    const initial = await geometry(page);
    expect([initial!.width, initial!.height, initial!.presentation]).toEqual([reserve.width, reserve.height, 'bottom']);
    const regions = initial!.regions as Region[];
    expect(regions).toHaveLength(1);
    expect(regions[0]).toMatchObject({ x: (reserve.width - width) / 2, width, height: 28 });
    await page.evaluate(async () => {
      await window.nativeFixture.delta('Court.');
      await window.nativeFixture.done();
    });
    await expect(page.locator('.glass-overlay')).toHaveAttribute('data-form', 'short');
    await expect.poll(async () => (await regionsOf(page))[0]?.width).toBe(glass.shortWidth);
    expect((await geometry(page))?.presentation).toBe('bottom');
    expect((await regionsOf(page))[0].x).toBe((reserve.width - glass.shortWidth) / 2);
  });

test('IPC fixture: the text size preset changes the metrics live', async ({ page }) => {
  await openNativeFixture(page);
  await page.evaluate(async () => {
    await window.nativeFixture.delta('Bonjour.');
    await window.nativeFixture.done();
  });
  await expect(page.locator('.translation-copy')).toHaveCSS('line-height', '24px');
  await page.evaluate(() => window.nativeFixture.settings({ textSize: 'large' }));
  await expect(page.locator('.translation-copy')).toHaveCSS('line-height', '27px');
  await expect(page.locator('.translation-copy')).toHaveCSS('font-size', '18px');
  await page.evaluate(() => window.nativeFixture.settings({ textSize: 'xlarge' }));
  await expect(page.locator('.translation-copy')).toHaveCSS('line-height', '30px');
});

async function openSettingsFixture(page: Page, fail = false) {
  await page.route('**/?window=settings&fixture=1*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('/src/main.tsx', '/e2e/native-fixture.ts') });
  });
  await page.goto(`/?window=settings&fixture=1${fail ? '&settingsError=1' : ''}`);
}

test('IPC fixture: settings recover from load failure', async ({ page }) => {
  await openSettingsFixture(page, true);
  await expect(page.getByRole('alert')).toContainText('Settings are unavailable');
  await expect(page.getByText('Loading settings…')).toHaveCount(0);
  await page.evaluate(() => window.nativeFixture.recoverSettings());
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'General', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'General', exact: true })).toBeVisible();
});

const tabTo = async (page: Page, name: string) => {
  await page.getByRole('tab', { name, exact: true }).click();
  await expect(page.getByRole('heading', { level: 2, name, exact: true })).toBeVisible();
};
const commands = (page: Page, name: string) =>
  page.evaluate((command) => window.nativeFixture.calls.filter((call) => call.command === command), name);

// 0.6: no « Check » button to press after typing. The check runs by itself on what is typed
// (never on the saved address), and an address that does not read is neither checked nor saved.
test('IPC fixture: the check runs on the address as typed, and an unreadable address is neither checked nor saved', async ({
  page,
}) => {
  await openSettingsFixture(page);
  await page.evaluate(() =>
    (window.nativeFixture as unknown as { settings: (next: unknown) => Promise<void> }).settings({
      servers: [
        {
          id: 's1',
          name: '',
          endpoint: 'https://llm.exemple.com',
          apiKey: '',
          noKey: true,
          model: 'unsloth/gemma-4-12B-it-qat-GGUF:UD-Q4_K_XL',
        },
      ],
      defaultServerId: 's1',
    }),
  );
  await tabTo(page, 'Server');
  const card = page.locator('[data-server="s1"]');
  await expect(card.locator('.ft-check-line')).toHaveAttribute('data-state', /ok|error/);
  await card.getByRole('button', { name: 'Edit', exact: true }).click();
  const address = card.getByRole('textbox', { name: 'Server address', exact: true });
  const before = (await commands(page, 'probe_connection')).length;
  await address.fill('https://inference.example.test/v1');
  await expect
    .poll(async () => (await commands(page, 'probe_connection')).at(-1)?.args?.endpoint)
    .toBe('https://inference.example.test/v1');
  expect((await commands(page, 'probe_connection')).length - before).toBe(1);
  await expect
    .poll(
      async () =>
        (
          (await commands(page, 'save_settings')).at(-1)?.args?.settings as
            | { servers: Array<{ endpoint: string }> }
            | undefined
        )?.servers[0].endpoint,
    )
    .toBe('https://inference.example.test/v1');
  // An address that does not read: said under the field, no check, no save.
  const probes = (await commands(page, 'probe_connection')).length;
  const saves = (await commands(page, 'save_settings')).length;
  await address.fill('ftp://inference.example.test/v1');
  await expect(card.getByRole('alert')).toHaveText('Not a web address. Use an address starting with https://.');
  await page.waitForTimeout(1200);
  expect((await commands(page, 'probe_connection')).length).toBe(probes);
  expect((await commands(page, 'save_settings')).length).toBe(saves);
  // Typing a readable address again clears the warning and checks again.
  await address.fill('https://inference.example.test');
  await expect(card.getByRole('alert')).toHaveCount(0);
  await expect.poll(async () => (await commands(page, 'probe_connection')).length).toBe(probes + 1);
});

test('IPC fixture: choices save immediately, checks never save, typing saves after a pause, close without translation', async ({
  page,
}) => {
  await openSettingsFixture(page);
  await expect(page.locator('.st-save')).toHaveText('Saved');
  expect(await commands(page, 'save_settings')).toHaveLength(0);
  await tabTo(page, 'Appearance');
  await page
    .getByRole('radiogroup', { name: 'Text size', exact: true })
    .getByRole('radio', { name: 'Large', exact: true })
    .click();
  await expect.poll(async () => (await commands(page, 'save_settings')).length).toBe(1);
  await page.getByRole('combobox', { name: 'Auto close', exact: true }).click();
  await page.getByRole('option', { name: 'Slow', exact: true }).click();
  await expect
    .poll(async () => (await commands(page, 'save_settings')).at(-1)?.args?.settings)
    .toMatchObject({ autoClose: 'slow', textSize: 'large' });
  await expect(page.locator('.st-save')).toHaveText('Saved');
  // A check never saves: « Check again » on a server already set changes nothing.
  await page.evaluate(() =>
    (window.nativeFixture as unknown as { settings: (next: unknown) => Promise<void> }).settings({
      servers: [
        {
          id: 's1',
          name: '',
          endpoint: 'https://llm.exemple.com',
          apiKey: '',
          noKey: true,
          model: 'unsloth/gemma-4-12B-it-qat-GGUF:UD-Q4_K_XL',
        },
      ],
      defaultServerId: 's1',
    }),
  );
  await tabTo(page, 'Server');
  const card = page.locator('[data-server="s1"]');
  await expect(card.locator('.ft-check-line')).toHaveAttribute('data-state', /ok|error/);
  await page.waitForTimeout(600);
  const saves = (await commands(page, 'save_settings')).length;
  const probes = (await commands(page, 'probe_connection')).length;
  await card.getByRole('button', { name: /^Check/ }).click();
  await expect.poll(async () => (await commands(page, 'probe_connection')).length).toBe(probes + 1);
  await expect(card.locator('.ft-check-line')).toHaveAttribute('data-state', /ok|error/);
  expect((await commands(page, 'save_settings')).length).toBe(saves);
  // Typing saves after a pause, once.
  await tabTo(page, 'Actions');
  await page
    .locator('[data-action="correct"].st-instr')
    .getByRole('button', { name: /Fix grammar/ })
    .click();
  await page
    .getByRole('textbox', { name: 'Instruction Fix grammar', exact: true })
    .pressSequentially('Typed. ', { delay: 20 });
  await expect.poll(async () => (await commands(page, 'save_settings')).length).toBe(saves + 1);
  expect(await commands(page, 'translate')).toHaveLength(0);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.nativeFixture.calls.some((call) => call.command === 'plugin:window|close')))
    .toBe(true);
});

test('IPC fixture: server error offers retry and settings through existing menu', async ({ page }) => {
  await openNativeFixture(page);
  await page.evaluate(() => window.nativeFixture.error());
  await expect(page.locator('.error-copy')).toContainText('Settings and Try again');
  await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'More options', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Settings', exact: true }).click();
  expect(await page.evaluate(() => window.nativeFixture.calls.some((call) => call.command === 'open_settings'))).toBe(
    true,
  );
  await page.getByRole('button', { name: 'More options', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Try again', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.nativeFixture.calls.filter((call) => call.command === 'translate').length))
    .toBe(2);
  await page.evaluate(async () => {
    await window.nativeFixture.delta('Bonjour');
    await window.nativeFixture.done();
  });
  await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toBeEnabled();
});

// Reading budget over the bridge: the glass dims once the budget is spent and unheld
// (Rust frees Escape), an approach measured natively brings it back and re-arms Escape,
// and the second departure ends with a native dismiss.
test('IPC fixture: the budget spent, the glass dims and frees Escape; the native proximity brings it back, its departure closes it', async ({
  page,
}) => {
  await openNativeFixture(page);
  await page.evaluate(async () => {
    await window.nativeFixture.settings({ autoClose: 'fast' });
    await window.nativeFixture.delta('Bonjour.');
    await window.nativeFixture.done();
  });
  await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toBeEnabled();
  // 5 s × 0.7 = 3.5 s without any visit.
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-dimming', 'true', { timeout: 5000 });
  await expect.poll(() => dimmingCalls(page)).toEqual([true]);
  await page.evaluate(() => window.nativeFixture.near(true));
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-dimming', 'false');
  await expect.poll(() => dimmingCalls(page)).toEqual([true, false]);
  await page.waitForTimeout(1100);
  await page.evaluate(() => window.nativeFixture.near(false));
  // A visit of more than a second, then gone: at most four seconds, never under 2.5 s.
  await page.waitForTimeout(2000);
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-dimming', 'false');
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-dimming', 'true', { timeout: 3000 });
  await expect
    .poll(() => page.evaluate(() => window.nativeFixture.calls.some((call) => call.command === 'dismiss_overlay')), {
      timeout: 3000,
    })
    .toBe(true);
  await expect(page.locator('.glass-overlay')).toHaveCount(0);
});

test('IPC fixture: the native cursor proximity holds the glass past its budget', async ({ page }) => {
  await openNativeFixture(page);
  await page.evaluate(async () => {
    await window.nativeFixture.settings({ autoClose: 'fast' });
    await window.nativeFixture.near(true);
    await window.nativeFixture.delta('Bonjour.');
    await window.nativeFixture.done();
  });
  await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toBeEnabled();
  await page.waitForTimeout(4500);
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-dimming', 'false');
  expect(await dimmingCalls(page)).toEqual([]);
  await page.evaluate(() => window.nativeFixture.near(false));
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-dimming', 'true', { timeout: 4000 });
});

test('IPC fixture: « Jamais » keeps the glass without any budget', async ({ page }) => {
  await openNativeFixture(page);
  await page.evaluate(async () => {
    await window.nativeFixture.settings({ autoClose: 'never' });
    await window.nativeFixture.delta('Bonjour.');
    await window.nativeFixture.done();
  });
  await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toBeEnabled();
  await page.waitForTimeout(6000);
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-dimming', 'false');
  expect(await dimmingCalls(page)).toEqual([]);
});

test('IPC fixture: a long path breaks after its separators in the result and in the original, never inside a name', async ({
  page,
}) => {
  await openNativeFixture(page);
  const path = 'C:\\Users\\Lucas\\projects\\flowtranslate\\src-tauri\\target\\release\\FlowTranslate.exe';
  await page.evaluate((path) => window.nativeFixture.capture('path', `The binary is at ${path}`), path);
  await expect.poll(async () => (await geometry(page))?.captureId).toBe('path');
  await page.evaluate(async (path) => {
    await window.nativeFixture.delta(`Le binaire est dans ${path}`);
    await window.nativeFixture.done();
  }, path);
  await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toBeEnabled();
  const text = page.locator('.translation-text');
  await expect(text).toHaveText(`Le binaire est dans ${path}`);
  await expect(text).toHaveCSS('overflow-wrap', 'break-word');
  expect(await text.locator('wbr').count()).toBe(10);
  // Pieces without a space stay on one line each: the wrap happens at the separators only.
  const wrapped = (scope: string) =>
    page.locator(scope).evaluate((element) => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const lines: number[] = [];
      let split = 0;
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const range = document.createRange();
        range.selectNodeContents(node);
        const tops = new Set(Array.from(range.getClientRects()).map((rect) => Math.round(rect.top)));
        tops.forEach((top) => lines.push(top));
        if (!/\s/.test(node.textContent ?? '') && tops.size > 1) split++;
      }
      return { split, lines: new Set(lines).size };
    });
  expect(await wrapped('.translation-text')).toMatchObject({ split: 0 });
  expect((await wrapped('.translation-text')).lines).toBeGreaterThan(1);
  await page.getByRole('button', { name: 'More options', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Show original', exact: true }).click();
  await expect(page.locator('.original-copy')).toContainText('The binary is at');
  expect(await page.locator('.original-copy wbr').count()).toBe(10);
  expect(await wrapped('.original-copy')).toMatchObject({ split: 0 });
});

// Since 0.1.8 a capture arrives in two steps: the text and its anchor open the window,
// the native target (document offsets, Win32 control) follows and decides « Remplacer ».
test('IPC fixture: « Remplacer » waits for the second capture step and ignores a stale target', async ({ page }) => {
  await openNativeFixture(page);
  await page.evaluate(async () => {
    await window.nativeFixture.delta('Bonjour');
    await window.nativeFixture.done();
  });
  await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'More options', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Replace', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.nativeFixture.target('someone-else', true));
  await page.getByRole('button', { name: 'More options', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Replace', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.nativeFixture.target('first', true));
  await page.getByRole('button', { name: 'More options', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Replace', exact: true })).toBeEnabled();
});

test('IPC fixture: a notice without a glass is a lone pill that never asks for a window resize', async ({ page }) => {
  await openNativeFixture(page);
  await page.evaluate(() => window.nativeFixture.dismissEvent('first'));
  await expect(page.locator('.glass-overlay')).toHaveCount(0);
  const before = await resizeCount(page);
  await page.evaluate(() => window.nativeFixture.notice('Rien à traduire dans la fenêtre active.'));
  const pill = page.locator('.notice-pill');
  await expect(pill).toHaveText('Rien à traduire dans la fenêtre active.');
  await expect(pill).toHaveCSS('font-size', '13px');
  await expect(page.locator('.glass-overlay')).toHaveCount(0);
  expect(await resizeCount(page)).toBe(before);
  // Rust hides its window after four seconds; the pill leaves on the same clock.
  await expect(pill).toHaveCount(0, { timeout: 6000 });
  // A capture replaces a notice at once.
  await page.evaluate(() => window.nativeFixture.notice('Champ protégé : capture refusée.'));
  await expect(page.locator('.notice-pill')).toBeVisible();
  await page.evaluate(() => window.nativeFixture.capture('after-notice'));
  await expect(page.locator('.notice-pill')).toHaveCount(0);
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-capture-id', 'after-notice');
});

test('IPC fixture: a notice while the glass is open reads as feedback in the glass', async ({ page }) => {
  await openNativeFixture(page);
  await page.evaluate(async () => {
    await window.nativeFixture.delta('Bonjour');
    await window.nativeFixture.done();
  });
  await page.evaluate(() => window.nativeFixture.notice('Rien à traduire dans la fenêtre active.'));
  await expect(page.locator('.compact-feedback')).toHaveText('Rien à traduire dans la fenêtre active.');
  await expect(page.locator('.notice-pill')).toHaveCount(0);
  await expect(page.locator('.translation-text')).toHaveText('Bonjour');
});

test('IPC fixture: a replayed result is complete at once, at the bottom, and asks for no translation', async ({
  page,
}) => {
  await openNativeFixture(page);
  await page.evaluate(() => window.nativeFixture.dismissEvent('first'));
  await expect(page.locator('.glass-overlay')).toHaveCount(0);
  const translations = () =>
    page.evaluate(() => window.nativeFixture.calls.filter((call) => call.command === 'translate').length);
  const before = await translations();
  await page.evaluate(() => window.nativeFixture.replay('again'));
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-capture-id', 'again');
  await expect(page.locator('.translation-text')).toHaveText('Exemple de sélection');
  await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toBeEnabled();
  expect(await translations()).toBe(before);
  await expect.poll(async () => (await geometry(page))?.presentation).toBe('bottom');
});

// 0.4.0 — « Remplacer la sélection »: the pill alone, then the paste reported by Rust. A direct
// shortcut under the Îlot does the same in its working pill.
for (const { ui, name, pill } of journeys)
  test(`IPC fixture (${name}): a replace capture keeps the pill alone, shows the check once pasted, then leaves by itself`, async ({
    page,
  }) => {
    await openNativeFixture(page, ui);
    await page.evaluate(async () => {
      await window.nativeFixture.captureReplace('replace-1', 'Texte avec des fotes');
      await window.nativeFixture.delta('Texte avec des fautes');
      await window.nativeFixture.done('Texte avec des fautes');
    });
    await expect(page.locator('.glass-overlay')).toHaveAttribute('data-form', 'pending');
    await expect(page.locator('.translation-bubble')).toHaveCount(0);
    await expect(page.locator(pill)).toBeVisible();
    await page.evaluate(() => window.nativeFixture.deliver('applied'));
    await expect(page.locator(pill)).toHaveAttribute('data-done', 'true');
    await expect(page.locator('.translation-bubble')).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(() => window.nativeFixture.calls.filter((call) => call.command === 'dismiss_overlay').length),
      )
      .toBe(1);
    expect(
      await page.evaluate(() => window.nativeFixture.calls.filter((call) => call.command === 'replace_result').length),
    ).toBe(0);
  });

test('IPC fixture: a refused paste opens the glass with the result, the reason and Copier, and never pastes twice', async ({
  page,
}) => {
  await openNativeFixture(page);
  await page.evaluate(async () => {
    await window.nativeFixture.captureReplace('replace-2', 'Texte avec des fotes');
    await window.nativeFixture.delta('Texte avec des fautes');
    await window.nativeFixture.done('Texte avec des fautes');
    await window.nativeFixture.deliver('fallback');
  });
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-form', 'short');
  await expect(page.locator('.translation-text')).toContainText('Texte avec des fautes');
  await expect(page.locator('.compact-feedback')).toContainText('Le collage a été bloqué');
  await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'More options', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Replace', exact: true })).toHaveCount(0);
  expect(
    await page.evaluate(() => window.nativeFixture.calls.filter((call) => call.command === 'dismiss_overlay').length),
  ).toBe(0);
});

test('IPC fixture: a paste that never reports back opens the glass after three seconds', async ({ page }) => {
  await openNativeFixture(page);
  await page.clock.install({ time: new Date('2026-09-15T12:00:00Z') });
  await page.evaluate(async () => {
    await window.nativeFixture.captureReplace('replace-3', 'Texte avec des fotes');
    await window.nativeFixture.delta('Texte avec des fautes');
    await window.nativeFixture.done('Texte avec des fautes');
  });
  await page.clock.runFor(2500);
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-form', 'pending');
  await page.clock.runFor(700);
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-form', 'short');
  await expect(page.locator('.compact-feedback')).toContainText('did not answer');
});

test('IPC fixture: the manual « Remplacer » keeps the native refusal and disables another attempt', async ({
  page,
}) => {
  await openNativeFixture(page);
  await page.evaluate(async () => {
    await window.nativeFixture.target('first', true);
    await window.nativeFixture.delta('Bonjour');
    await window.nativeFixture.done();
    window.nativeFixture.refuseReplace();
  });
  await page.getByRole('button', { name: 'More options', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Replace', exact: true }).click();
  await expect(page.locator('.compact-feedback')).toContainText('La fenêtre source a changé');
  await page.getByRole('button', { name: 'More options', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Replace', exact: true })).toHaveCount(0);
  expect(
    await page.evaluate(() => window.nativeFixture.calls.filter((call) => call.command === 'replace_result').length),
  ).toBe(1);
});

test('IPC fixture: the done event carries the cleaned text that replaces the deltas', async ({ page }) => {
  await openNativeFixture(page);
  await page.evaluate(async () => {
    await window.nativeFixture.delta('```\nBonjour\n```');
    await window.nativeFixture.done('Bonjour');
  });
  await expect(page.locator('.translation-text')).toHaveText('Bonjour');
});
