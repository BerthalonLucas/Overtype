import { test, expect, type Page } from '@playwright/test';
import { bottomReserve, glass, halo } from '../src/layout';
import type { Indicator, Settings } from '../src/types';

// Lot 8 (docs/DA-PLAN.md): under uiVersion 'ilot', the wait is a glass pill of 44 × 28 (52 × 28
// for the Ruban), radius 14, holding the chosen indicator centred; the orb shows after 250 ms, the
// pill never grows, the orb stands still in reduced motion, the Nébuleuse and the Ruban blend in
// screen on the dark theme. Measured in the browser through the IPC fixture, as the lab measures
// its own pill (design-lab/verify.mjs:55-65). A browser run, not the Windows window.
// window.nativeFixture is typed in e2e/native-bridge.pw.ts; here it is reached untyped.

type Region = { x: number; y: number; width: number; height: number; radius: number };
const shapes: Record<Indicator, { width: number; orb: string }> = {
  perle: { width: 44, orb: '.ldr.perle' },
  nebuleuse: { width: 44, orb: '.ldr.neb' },
  ruban: { width: 52, orb: '.ldr.sinus.ruban' },
};
const indicators = Object.keys(shapes) as Indicator[];

async function openIlot(page: Page, next: Partial<Settings>) {
  // Chromium on Windows reports the system's « Effets d'animation »: the tests choose.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 640, height: 480 });
  await page.route('**/?window=overlay&fixture=1', async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('/src/main.tsx', '/e2e/native-fixture.ts') });
  });
  await page.goto('/?window=overlay&fixture=1');
  await expect(page.locator('.glass-overlay')).toBeVisible();
  // The Îlot is the fixture's default, as it is Rust's: only the test's own settings are sent.
  await expect(page.locator('html')).toHaveAttribute('data-ui', 'ilot');
  await page.evaluate((next) => (window as any).nativeFixture.settings(next), next);
}
const lastGeometry = (page: Page) =>
  page.evaluate(
    () => (window as any).nativeFixture.calls.filter((call: any) => call.command === 'resize_overlay').at(-1)?.args,
  );

type Frame = { t: number; width: number; height: number; orb: boolean; offset: number | null; resizes: number };
type Run = { pillAt: number | null; orbAt: number | null; frames: Frame[] };
// Emits a capture and follows its pill for `ms`: when the pill and then the orb enter the DOM
// (a MutationObserver, precise to the commit), and every frame the pill's layout size, the orb's
// offset from the pill's centre (as verify.mjs: the larger of |dx|, |dy|) and how many times the
// native window was asked to change.
async function follow(page: Page, id: string, ms: number, kind: 'capture' | 'unanchored' = 'capture'): Promise<Run> {
  return page.evaluate(
    async ({ id, ms, kind }) => {
      const fixture = (window as any).nativeFixture;
      const find = () => document.querySelector<HTMLElement>(`[data-capture-id="${id}"] .working-pill`);
      const run: Run = { pillAt: null, orbAt: null, frames: [] };
      const observer = new MutationObserver(() => {
        const pill = find();
        if (pill) run.pillAt ??= performance.now();
        if (pill?.querySelector('.ldr')) run.orbAt ??= performance.now();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      const start = performance.now();
      const sampled = new Promise<void>((resolve) => {
        const tick = () => {
          const pill = find();
          if (pill) {
            const orb = pill.querySelector('.ldr');
            const p = pill.getBoundingClientRect(),
              o = orb?.getBoundingClientRect();
            run.frames.push({
              t: performance.now() - start,
              width: pill.offsetWidth,
              height: pill.offsetHeight,
              orb: Boolean(orb),
              offset: o
                ? Math.max(
                    Math.abs(o.left + o.width / 2 - p.left - p.width / 2),
                    Math.abs(o.top + o.height / 2 - p.top - p.height / 2),
                  )
                : null,
              resizes: fixture.calls.filter((call: { command: string }) => call.command === 'resize_overlay').length,
            });
          }
          if (performance.now() - start < ms) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });
      await fixture[kind](id);
      await sampled;
      observer.disconnect();
      return run;
    },
    { id, ms, kind },
  );
}

for (const theme of ['light', 'dark'] as const) {
  for (const indicator of indicators) {
    test(`${indicator} / ${theme}: an empty pill for 250 ms, then the orb, centred, in a pill that never grows`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'no-preference' });
      await openIlot(page, { indicator, theme });
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      const { width, orb } = shapes[indicator];
      const run = await follow(page, `ilot-${indicator}-${theme}`, 1100);

      // The orb waits 250 ms, then shows (data.js:158).
      expect(run.pillAt).not.toBeNull();
      expect(run.orbAt).not.toBeNull();
      const delay = run.orbAt! - run.pillAt!;
      expect(delay).toBeGreaterThanOrEqual(249);
      expect(delay).toBeLessThan(600);
      expect(run.frames.filter((frame) => frame.t < 200).every((frame) => !frame.orb)).toBe(true);
      expect(run.frames.at(-1)!.orb).toBe(true);

      // The pill never grows: its layout box is the same from the first frame to the last, and the
      // native window is asked nothing more once the pill is published (no resize while it animates).
      for (const frame of run.frames) expect([frame.width, frame.height]).toEqual([width, 28]);
      expect(new Set(run.frames.map((frame) => frame.resizes)).size).toBe(1);

      // Centred to the half pixel on every frame, the entrance spring included (verify.mjs:65).
      const offsets = run.frames.filter((frame) => frame.offset !== null).map((frame) => frame.offset!);
      expect(offsets.length).toBeGreaterThan(10);
      expect(Math.max(...offsets)).toBeLessThan(0.5);
      test.info().annotations.push({
        type: 'measured',
        description: `orb after ${delay.toFixed(1)} ms; centre offset max ${Math.max(...offsets).toFixed(3)} px over ${offsets.length} frames`,
      });

      // At rest: the pill's box, its radius, its glass, nothing textual, the orb faded in.
      const pill = page.locator('.working-pill');
      await expect(pill).toHaveCSS('transform', 'none');
      expect(await pill.boundingBox()).toMatchObject({ width, height: 28 });
      await expect(pill).toHaveCSS('border-radius', '14px');
      await expect(pill).toHaveAttribute('data-indicator', indicator);
      await expect(pill).toHaveAttribute('aria-label', 'Working');
      expect(await pill.evaluate((el) => el.textContent)).toBe('');
      expect(await pill.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain('linear-gradient');
      await expect(pill.locator(orb)).toHaveCount(1);
      expect(
        await pill
          .locator('.working-orb')
          .evaluate((el) => [getComputedStyle(el).animationName, getComputedStyle(el).animationDuration]),
      ).toEqual(['working-orb-in', '0.15s']);
      await expect(page.locator('.wait-pill')).toHaveCount(0);

      // The hit-test region is the new pill, where the wait pill stood (upper right of the glass to come).
      const regions = (await lastGeometry(page)).regions as Region[];
      expect(regions).toEqual([
        { x: halo.x + glass.shortWidth - glass.pillInset - width, y: halo.top, width, height: 28, radius: 14 },
      ]);

      // The lab's colours: multiply on light glass, screen on dark (loaders.css:59, 66-67, 175-176).
      const blend = theme === 'dark' ? 'screen' : 'multiply';
      if (indicator === 'nebuleuse') {
        expect(
          await pill.locator('.neb i').evaluateAll((els) => els.map((el) => getComputedStyle(el).mixBlendMode)),
        ).toEqual([blend, blend, blend]);
        await expect(pill.locator('.neb')).toHaveCSS(
          'background-color',
          theme === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.55)',
        );
      }
      if (indicator === 'ruban') {
        expect(
          await pill
            .locator('.ruban path')
            .evaluateAll((els) => els.map((el) => [getComputedStyle(el).mixBlendMode, getComputedStyle(el).stroke])),
        ).toEqual([
          [blend, 'rgb(141, 159, 255)'],
          [blend, 'rgb(255, 103, 120)'],
          [blend, 'rgb(255, 186, 113)'],
        ]);
      }
      if (indicator === 'perle') {
        expect(
          await pill
            .locator('.perle')
            .evaluate((el) => [
              getComputedStyle(el).animationName,
              getComputedStyle(el).animationDuration,
              getComputedStyle(el, '::before').animationName,
              getComputedStyle(el, '::before').animationDuration,
            ]),
        ).toEqual(['perle-b', '2.4s', 'ldr-spin', '3s']);
      }
    });
  }
}

test('the working pill is centred at the bottom for a capture without an anchor', async ({ page }) => {
  await openIlot(page, { indicator: 'ruban' });
  await page.setViewportSize({ width: 1100, height: 800 });
  const run = await follow(page, 'ilot-clip', 700, 'unanchored');
  expect(run.frames.at(-1)!.orb).toBe(true);
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-placement', 'bottom');
  const reserve = bottomReserve({ width: 1920, height: 1040 }, 'normal');
  const geometry = await lastGeometry(page);
  expect([geometry.width, geometry.height, geometry.presentation]).toEqual([reserve.width, reserve.height, 'bottom']);
  expect(geometry.regions).toEqual([
    expect.objectContaining({ x: (reserve.width - 52) / 2, width: 52, height: 28, radius: 14 }),
  ]);
});

test('reduced motion: the orb still shows after 250 ms but stands still', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openIlot(page, { motion: 'reduced' });
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  for (const indicator of indicators) {
    await page.evaluate((indicator) => (window as any).nativeFixture.settings({ indicator }), indicator);
    const run = await follow(page, `still-${indicator}`, 500);
    expect(run.orbAt! - run.pillAt!).toBeGreaterThanOrEqual(249);
    // Every painted part of the orb, sampled on each frame for 600 ms: one value each.
    const seen = await page.evaluate(
      () =>
        new Promise<Record<string, string[]>>((resolve) => {
          const pill = document.querySelector('.working-pill')!;
          const parts = [...pill.querySelectorAll<Element>('.ldr, .ldr *')];
          const seen: Record<string, Set<string>> = {};
          const start = performance.now();
          const tick = () => {
            parts.forEach((part, index) => {
              const style = getComputedStyle(part),
                before = getComputedStyle(part, '::before');
              (seen[`${index}`] ??= new Set()).add(`${style.transform}|${style.opacity}|${before.transform}`);
            });
            if (performance.now() - start < 600) requestAnimationFrame(tick);
            else resolve(Object.fromEntries(Object.entries(seen).map(([key, values]) => [key, [...values]])));
          };
          tick();
        }),
    );
    expect(Object.keys(seen).length).toBeGreaterThan(0);
    for (const values of Object.values(seen)) expect(values).toHaveLength(1);
    expect(await page.locator('.working-pill .ldr').evaluate((el) => getComputedStyle(el).animationPlayState)).toBe(
      'paused',
    );
    // No entrance glide or scale either: Motion is told too.
    await expect(page.locator('.working-pill')).toHaveCSS('transform', 'none');
  }
});

test('an answer faster than 250 ms never shows the orb: the empty pill gives way to the glass', async ({ page }) => {
  await openIlot(page, { indicator: 'perle' });
  const orbSeen = await page.evaluate(async () => {
    const fixture = (window as any).nativeFixture;
    let seen = false;
    const observer = new MutationObserver(() => {
      if (document.querySelector('.working-pill .ldr')) seen = true;
    });
    observer.observe(document.body, { childList: true, subtree: true });
    await fixture.capture('fast');
    await new Promise((resolve) => setTimeout(resolve, 80));
    await fixture.delta('Bonjour.');
    await fixture.done();
    await new Promise((resolve) => setTimeout(resolve, 600));
    observer.disconnect();
    return seen;
  });
  expect(orbSeen).toBe(false);
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-form', 'short');
  await expect(page.locator('.working-pill')).toHaveCount(0);
});

test('a fast paste shows the check in the same pill, never the orb', async ({ page }) => {
  await openIlot(page, { indicator: 'ruban' });
  const orbSeen = await page.evaluate(async () => {
    const fixture = (window as any).nativeFixture;
    let seen = false;
    const observer = new MutationObserver(() => {
      if (document.querySelector('.working-pill .ldr')) seen = true;
    });
    observer.observe(document.body, { childList: true, subtree: true });
    await fixture.captureReplace('fast-replace', 'Texte avec des fotes');
    await fixture.delta('Texte avec des fautes');
    await fixture.done('Texte avec des fautes');
    await fixture.deliver('applied');
    await new Promise((resolve) => setTimeout(resolve, 400));
    observer.disconnect();
    return seen;
  });
  expect(orbSeen).toBe(false);
  const pill = page.locator('.working-pill');
  await expect(pill).toHaveAttribute('data-done', 'true');
  await expect(pill).toHaveAttribute('aria-label', 'Selection replaced');
  expect(await pill.evaluate((el: HTMLElement) => [el.offsetWidth, el.offsetHeight])).toEqual([52, 28]);
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as any).nativeFixture.calls.filter((call: any) => call.command === 'dismiss_overlay').length,
      ),
    )
    .toBe(1);
});

test('the loops rest while the page is hidden and run again when it shows', async ({ page }) => {
  await openIlot(page, { indicator: 'perle' });
  await page.evaluate(() => (window as any).nativeFixture.capture('hidden'));
  const orb = page.locator('.working-pill .perle');
  await expect(orb).toHaveCount(1);
  const states = () =>
    orb.evaluate((el) => [
      getComputedStyle(el).animationPlayState,
      getComputedStyle(el, '::before').animationPlayState,
    ]);
  expect(await states()).toEqual(['running', 'running']);
  const setVisibility = (state: 'hidden' | 'visible') =>
    page.evaluate((state) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
      document.dispatchEvent(new Event('visibilitychange'));
    }, state);
  await setVisibility('hidden');
  await expect(page.locator('.working-pill')).toHaveAttribute('data-paused', 'true');
  expect(await states()).toEqual(['paused', 'paused']);
  await setVisibility('visible');
  await expect(page.locator('.working-pill')).not.toHaveAttribute('data-paused', /.*/);
  expect(await states()).toEqual(['running', 'running']);
});

test('the 0.4 journey keeps its spinner pill', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 640, height: 480 });
  await page.route('**/?window=overlay&fixture=1*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('/src/main.tsx', '/e2e/native-fixture.ts') });
  });
  await page.goto('/?window=overlay&fixture=1&ui=v4');
  await expect(page.locator('html')).toHaveAttribute('data-ui', 'v4');
  await expect(page.locator('.wait-pill')).toBeVisible();
  await page.waitForTimeout(400);
  await expect(page.locator('.working-pill')).toHaveCount(0);
  await expect(page.locator('.ldr')).toHaveCount(0);
  expect(await page.locator('.wait-pill').evaluate((el: HTMLElement) => [el.offsetWidth, el.offsetHeight])).toEqual([
    60, 28,
  ]);
  expect(await page.locator('.wait-pill svg').evaluate((el) => getComputedStyle(el).animationName)).toBe('wait-spin');
});

test('Settings: the indicator row shows in the Îlot journey only and saves the choice', async ({ page }) => {
  // The 0.4 journey, asked for: its spinner has no indicator to choose.
  await page.goto('/lab-frame.html?scenario=settings&theme=light&motion=reduce&ui=v4');
  await page.getByRole('tab', { name: 'Appearance', exact: true }).click();
  await expect(page.getByRole('radiogroup', { name: 'Theme', exact: true })).toBeVisible();
  await expect(page.getByRole('radiogroup', { name: 'Indicator', exact: true })).toHaveCount(0);

  // The Îlot, the lab's default as it is the app's.
  await page.goto('/lab-frame.html?scenario=settings&theme=light&motion=reduce');
  await page.getByRole('tab', { name: 'Appearance', exact: true }).click();
  const row = page.getByRole('radiogroup', { name: 'Indicator', exact: true });
  await expect(row).toBeVisible();
  // On the Appearance page, between Theme and the motion (0.6: one card per indicator, the app's own).
  expect(
    await page
      .locator('.ft-settings-content [role="radiogroup"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('aria-label'))),
  ).toEqual(['Theme', 'Indicator', 'Motion style', 'Animations', 'Text size']);
  await expect(row.locator('.st-ind-pill .ldr')).toHaveCount(3);
  await expect(row.getByRole('radio').locator('strong')).toHaveText(['Perle', 'Nebula', 'Ribbon']);
  await expect(row.getByRole('radio', { name: 'Perle', exact: true })).toHaveAttribute('aria-checked', 'true');
  await row.getByRole('radio', { name: 'Nebula', exact: true }).click();
  await expect(row.getByRole('radio', { name: 'Nebula', exact: true })).toHaveAttribute('aria-checked', 'true');
  await expect
    .poll(() => page.evaluate(async () => (await (await import('/src/bridge.ts')).bridge.getSettings()).indicator))
    .toBe('nebuleuse');
  // French, at once.
  await page.evaluate(async () => (await import('/src/i18n.ts')).setLanguage('fr'));
  const french = page.getByRole('radiogroup', { name: 'Indicateur', exact: true });
  await expect(french.getByRole('radio').locator('strong')).toHaveText(['Perle', 'Nébuleuse', 'Ruban']);
  await expect(french.getByRole('radio', { name: 'Nébuleuse', exact: true })).toHaveAttribute('aria-checked', 'true');
});

test('the lab frame shows the working pill in each indicator', async ({ page }) => {
  for (const indicator of indicators) {
    for (const theme of ['light', 'dark'] as const) {
      await page.goto(`/lab-frame.html?scenario=working-${indicator}&theme=${theme}&motion=reduce`);
      await expect(page.locator('[data-lab-phase]')).toHaveAttribute('data-lab-phase', 'streaming');
      const pill = page.locator('.working-pill');
      await expect(pill.locator(shapes[indicator].orb)).toHaveCount(1);
      expect(await pill.boundingBox()).toMatchObject({ width: shapes[indicator].width, height: 28 });
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    }
  }
});

// Review of bc57857, finding 8: a direct capture's working pill always rose from below, away from
// the selection when the glass hangs under it. It now waits, unseen, for the side Rust chose, then
// glides from the selection: down below it, up above it; up from the bottom edge without an anchor.
test("the working pill enters from the selection's side: down below it, up above it, up at the bottom", async ({
  page,
}) => {
  await openIlot(page, { indicator: 'perle' });
  // The fixture's anchor spans y 300 to 318 (scale 1); the glass's footprint sits a few dozen
  // pixels down its window: at 330 the window is below the selection, at 0 above it.
  const cases = [
    { id: 'pill-below', windowY: 330, kind: 'capture', grow: 'down' },
    { id: 'pill-above', windowY: 0, kind: 'capture', grow: 'up' },
    { id: 'pill-bottom', windowY: 0, kind: 'unanchored', grow: 'up' },
  ] as const;
  for (const { id, windowY, kind, grow } of cases) {
    const frames = await page.evaluate(
      async ({ id, windowY, kind }) => {
        const fixture = (window as any).nativeFixture;
        fixture.windowAt(0, windowY);
        const seen: Array<{ opacity: number; y: number; grow: string | null }> = [];
        const start = performance.now();
        const sampled = new Promise<void>((resolve) => {
          const tick = () => {
            const pill = document.querySelector<HTMLElement>(`[data-capture-id="${id}"] .working-pill`);
            if (pill) {
              const style = getComputedStyle(pill);
              seen.push({
                opacity: Number(style.opacity),
                y: style.transform === 'none' ? 0 : new DOMMatrix(style.transform).f,
                grow: pill.getAttribute('data-grow'),
              });
            }
            if (performance.now() - start < 700) requestAnimationFrame(tick);
            else resolve();
          };
          requestAnimationFrame(tick);
        });
        await fixture[kind](id);
        await sampled;
        return seen;
      },
      { id, windowY, kind },
    );
    const visible = frames.filter((frame) => frame.opacity > 0.02);
    expect(visible.length, id).toBeGreaterThan(5);
    // The first visible frames stand on the selection's side of the resting place, then settle.
    expect(Math.sign(visible[0].y), id).toBe(grow === 'down' ? -1 : 1);
    expect(visible[0].grow, id).toBe(grow);
    expect(frames.at(-1)!.y, id).toBeCloseTo(0, 1);
    // Before the side is known, the pill never shows.
    expect(
      frames.filter((frame) => frame.grow === 'waiting').every((frame) => frame.opacity === 0),
      id,
    ).toBe(true);
  }
});
