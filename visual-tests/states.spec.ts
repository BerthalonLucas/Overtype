import { test, expect, type Locator, type Page } from '@playwright/test';
import { scenarios } from '../src/lab/scenarios';

// Two journeys, two sets of references (README.md). The frame opens in the Îlot, the app's
// default: the 0.4 journey (uiVersion « v4 ») is asked for with ui=v4. `--grep @v4` or
// `--grep @ilot` checks one set alone.

// The 0.4 journey: the images recorded at 0.4.0, under their names of then.
const v4States = ['short', 'long', 'pending', 'partial', 'error', 'notice', 'settings', 'history'] as const;
for (const theme of ['light', 'dark']) {
  for (const id of v4States) {
    test(`${id} / ${theme}`, { tag: '@v4' }, async ({ page }) => {
      await page.goto(`/lab-frame.html?scenario=${id}&theme=${theme}&motion=reduce&ui=v4`);
      if (['short', 'long'].includes(id))
        await expect(page.locator('[data-lab-phase]')).toHaveAttribute('data-lab-phase', 'complete');
      else if (['error', 'partial'].includes(id))
        await expect(page.locator('[data-lab-phase]')).toHaveAttribute('data-lab-phase', 'error');
      else if (id === 'pending')
        await expect(page.locator('[data-lab-phase]')).toHaveAttribute('data-lab-phase', 'streaming');
      else if (id === 'notice')
        await expect(page.locator('.notice-pill')).toHaveText('Rien à traduire dans la fenêtre active.');
      // The settings window and its history: their title (the app speaks English since lot 13).
      else await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
      if (id === 'history') await expect(page.locator('html')).toHaveAttribute('data-lab-ready', 'true');
      // Soft: when the state differs, the menu that follows it is compared as well.
      await expect.soft(page).toHaveScreenshot(`${id}-${theme}.png`);
      if (id === 'short') {
        await page.getByRole('button', { name: 'More options', exact: true }).click();
        await expect(page.getByRole('menu')).toBeVisible();
        await expect(page).toHaveScreenshot(`menu-${theme}.png`);
      }
    });
  }
}
// The reader band on Lucas's screens: half of 1920 and of 2560, 22/33, 45 % of the height at most.
for (const [width, height] of [
  [1920, 1080],
  [2560, 1440],
]) {
  test(`reader on a ${width} px screen`, { tag: '@v4' }, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto(`/lab-frame.html?scenario=long&theme=dark&motion=reduce&ui=v4`);
    await expect(page.locator('[data-lab-phase]')).toHaveAttribute('data-lab-phase', 'complete');
    await expect(page.locator('.translation-bubble')).toHaveCSS('width', `${width / 2}px`);
    await expect(page).toHaveScreenshot(`reader-${width}.png`);
  });
}
test('settings at narrow width', { tag: '@v4' }, async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 640 });
  await page.goto('/lab-frame.html?scenario=settings&motion=reduce&ui=v4');
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page).toHaveScreenshot('settings-narrow.png');
});

// The Îlot, the app's default, in English (its language by default) and on fictitious data:
// its images under ilot/, awaiting Lucas's review (README.md).

// A surface at rest: entered, no transform left, fully opaque.
async function atRest(surface: Locator) {
  await expect(surface).toBeVisible();
  await expect(surface).toHaveCSS('opacity', '1');
  await expect(surface).toHaveCSS('transform', 'none');
}
// The Undo ring runs on performance.now(): the clock stands still from the page's first script,
// then runs 2.5 s, so the ring always shows 6 of its 8 seconds.
const ringAt = 2500;
const circumference = 2 * Math.PI * 5;

type Surface = { name: string; query: Record<string, string>; clock?: true; ready: (page: Page) => Promise<void> };
const surfaces: Surface[] = [
  // The menu: compact, grid, prompt field (lot 7), held where it opens.
  ...(['compact', 'grid', 'prompt'] as const).map((mode) => ({
    name: mode,
    query: { scenario: `ilot-${mode}`, hold: '1' },
    ready: async (page: Page) => {
      await expect(page.locator('[data-ilot]')).toHaveAttribute('data-mode', mode);
      await atRest(page.locator('.ilot'));
    },
  })),
  // The working pill (lot 8), in each indicator, its orb shown.
  ...(['perle', 'nebuleuse', 'ruban'] as const).map((indicator) => ({
    name: `working-${indicator}`,
    query: { scenario: `working-${indicator}` },
    ready: async (page: Page) => {
      await expect(page.locator('[data-lab-phase]')).toHaveAttribute('data-lab-phase', 'streaming');
      await expect(page.locator('.working-pill')).toHaveAttribute('data-orb', 'shown');
      await atRest(page.locator('.working-pill'));
    },
  })),
  // The check and Undo (lot 9).
  {
    name: 'done',
    query: { scenario: 'result-done', stage: 'done', hold: '1' },
    clock: true,
    ready: async (page: Page) => {
      await expect(page.locator('.result-pill')).toHaveAttribute('data-result', 'done');
      await expect(page.locator('.result-check')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();
      await atRest(page.locator('.result-pill'));
      const arc = await page
        .locator('.result-ring circle:not(.track)')
        .evaluate((el) => Number(el.getAttribute('stroke-dasharray')!.split(' ')[0]));
      expect(arc).toBeCloseTo((circumference * 6) / 8, 1);
    },
  },
  // One error pill per family with a button or a ✕ (lot 10).
  ...(['config', 'transient', 'paste', 'content'] as const).map((family) => ({
    name: `error-${family}`,
    query: { scenario: `result-error-${family}`, stage: 'error', hold: '1' },
    ready: async (page: Page) => {
      await expect(page.locator('.result-pill')).toHaveAttribute('data-result', 'error');
      await expect(page.getByRole('alert')).toBeVisible();
      await atRest(page.locator('.result-pill'));
    },
  })),
  // A long result, shown (lot 11): the reader band in the Îlot's material.
  {
    name: 'long',
    query: { scenario: 'long' },
    ready: async (page: Page) => {
      await expect(page.locator('[data-lab-phase]')).toHaveAttribute('data-lab-phase', 'complete');
      await expect(page.locator('.glass-overlay')).toHaveAttribute('data-form', 'reader');
    },
  },
  // The Settings of the Îlot (lot 13).
  {
    name: 'settings',
    query: { scenario: 'settings' },
    ready: async (page: Page) => {
      await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'After replacing', exact: true })).toBeVisible();
    },
  },
  // The halo (lot 6, « mise en valeur », Lucas 25/09) under reduced motion: while the action
  // works, the still aurora, the bands and the still iridescent veil; the menu's three levels;
  // the changed words' iridescent glow, without the wave.
  {
    name: 'halo',
    query: { scenario: 'halo' },
    ready: async (page: Page) => {
      await expect(page.locator('.halo-veil')).toHaveCount(3);
      await expect(page.locator('.halo-aurora')).toHaveCount(1);
      await expect(page.locator('.halo-band')).toHaveCount(3);
    },
  },
  {
    name: 'halo-menu',
    query: { scenario: 'halo', phase: 'menu' },
    ready: async (page: Page) => {
      await expect(page.locator('.halo-tint')).toHaveCount(3);
      await expect(page.locator('.halo-box')).toHaveCount(1);
    },
  },
  {
    name: 'halo-marks',
    query: { scenario: 'halo', phase: 'marks' },
    ready: async (page: Page) => {
      await expect(page.locator('.halo-mark')).toHaveCount(2);
      await expect(page.locator('.halo-mark').first()).toHaveCSS('opacity', '1');
    },
  },
];

// Every state of the workbench keeps a reference, in one journey or the other.
test('every state of the workbench has its reference', () => {
  const covered: string[] = [...v4States, ...surfaces.map((surface) => surface.query.scenario)];
  for (const { id } of scenarios) expect(covered, id).toContain(id);
});

for (const theme of ['light', 'dark'] as const) {
  for (const surface of surfaces) {
    test(`Îlot · ${surface.name} / ${theme}`, { tag: '@ilot' }, async ({ page }) => {
      if (surface.clock) {
        await page.clock.install({ time: new Date('2026-09-25T10:00:00') });
        await page.clock.pauseAt(new Date('2026-09-25T10:00:01'));
      }
      await page.goto(`/lab-frame.html?${new URLSearchParams({ ...surface.query, theme, motion: 'reduce' })}`);
      if (surface.clock) await page.clock.runFor(ringAt);
      await surface.ready(page);
      await expect(page).toHaveScreenshot(['ilot', `${surface.name}-${theme}.png`]);
    });
  }
}
