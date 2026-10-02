import { test, expect, type Page } from '@playwright/test';
import type { HaloEvent, Rect } from '../src/types';
import type { HaloRun } from '../src/halo/HaloWindow';

// The halo window (lot 6, « mise en valeur », Lucas 25/09) over the IPC fixture: what it draws
// from the `halo` events Rust sends (src-tauri/src/halo.rs), with the values of Lucas's choice
// in design-lab/mise-en-valeur.html. The real window (placement, pass-through, z-order, the
// ground read under the text) is checked on Windows, not here.
const viewport = { width: 468, height: 148 };
// The exact selection's runs, the whole lines they stand on, the field around them.
const lines: Rect[] = [
  { x: 40, y: 40, width: 300, height: 20 },
  { x: 30, y: 60, width: 380, height: 22 },
  { x: 30, y: 82, width: 96, height: 20 },
];
const full: Rect[] = [
  { x: 30, y: 40, width: 310, height: 20 },
  { x: 30, y: 60, width: 380, height: 22 },
  { x: 30, y: 82, width: 250, height: 20 },
];
const textBox: Rect = { x: 24, y: 24, width: 420, height: 100 };
// After the paste: two changed words on the new text's lines.
const words: Rect[] = [{ x: 60, y: 40, width: 80, height: 20 }, { x: 30, y: 60, width: 120, height: 22 }];
const white: [number, number, number] = [255, 255, 255];

const pad = (r: Rect, dx: number, dy = 0): Rect => ({ x: r.x - dx, y: r.y - dy, width: r.width + 2 * dx, height: r.height + 2 * dy });
const inset = (r: Rect, n: number): Rect => ({ x: r.x + n, y: r.y + n, width: r.width - 2 * n, height: r.height - 2 * n });
const sum = (rects: Rect[]) => rects.reduce((total, r) => total + r.width, 0);

type Extra = Partial<Omit<HaloRun, 'generation' | 'phase'>>;
const run = (generation: number, phase: HaloEvent['phase'], extra: Extra = {}): HaloRun => {
  if (phase === 'leave' || phase === 'clear') return { generation, phase, lines: [], full: [], textBox: null, whole: [], tone: null, ground: null, width: 0, height: 0 };
  if (phase === 'marks') return { generation, phase, lines: words, full: [], textBox: null, whole: lines, tone: 'light', ground: white, ...viewport, ...extra };
  return { generation, phase, lines, full, textBox, whole: [], tone: 'light', ground: white, ...viewport, ...extra };
};
const send = (page: Page, event: HaloRun) => page.evaluate(event => (window as unknown as { nativeFixture: { halo: (event: HaloEvent) => Promise<void> } }).nativeFixture.halo(event), event);
const settings = (page: Page, next: Record<string, unknown>) => page.evaluate(next => (window as unknown as { nativeFixture: { settings: (next: Record<string, unknown>) => Promise<void> } }).nativeFixture.settings(next), next);
const now = (page: Page) => page.evaluate(() => performance.now());
const since = (page: Page, start: number) => page.evaluate(start => performance.now() - start, start);

async function openHalo(page: Page) {
  await page.setViewportSize(viewport);
  await page.route('**/?window=halo&fixture=1', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('/src/main.tsx', '/e2e/native-fixture.ts') });
  });
  await page.goto('/?window=halo&fixture=1');
  await expect(page.locator('body')).toHaveClass(/flowtranslate-halo/);
  await expect(page.locator('html')).toHaveAttribute('data-halo-ready', 'true');
}

async function expectBands(page: Page) {
  await expect(page.locator('.halo-band')).toHaveCount(3);
  for (const [index, line] of full.entries()) {
    const band = page.locator('.halo-band').nth(index);
    expect(await band.boundingBox()).toEqual(pad(line, 3, 1));
    await expect(band).toHaveCSS('border-radius', '4px');
    await expect(band).toHaveCSS('background-color', 'rgba(141, 159, 255, 0.08)');
  }
}

test('the menu shows the selection at three levels at once, still; the work follows it without the delay', async ({ page }) => {
  await openHalo(page);
  const sent = await now(page);
  await send(page, run(1, 'menu'));
  const halo = page.locator('.halo');
  await expect(halo).toHaveAttribute('data-phase', 'menu');
  await expect(halo).toHaveAttribute('data-state', 'shown');
  expect(await since(page, sent), 'no 250 ms wait: the menu shows its selection with the bubble').toBeLessThan(240);
  await expect(halo).toHaveCSS('opacity', '1');
  // The text box: a line just inside the field.
  const field = page.locator('.halo-box');
  expect(await field.boundingBox()).toEqual(inset(textBox, 3));
  await expect(field).toHaveCSS('border-radius', '9px');
  await expect(field).toHaveCSS('box-shadow', 'rgba(141, 159, 255, 0.6) 0px 0px 0px 1px, rgba(141, 159, 255, 0.12) 0px 0px 0px 4px');
  // The whole lines: a faint band each.
  await expectBands(page);
  // The exact text: a tint (the « calque »), one per run.
  await expect(page.locator('.halo-tint')).toHaveCount(3);
  for (const [index, line] of lines.entries()) {
    const tint = page.locator('.halo-tint').nth(index);
    expect(await tint.boundingBox()).toEqual(pad(line, 1));
    await expect(tint).toHaveCSS('border-radius', '3px');
    await expect(tint).toHaveCSS('background-color', 'rgba(141, 159, 255, 0.24)');
    await expect(tint).toHaveCSS('animation-name', 'none');
  }
  await expect(page.locator('.halo-aurora, .halo-veil')).toHaveCount(0);

  // The choice made: the work at once (the selection was already shown), the bands kept.
  const chosen = await now(page);
  await send(page, run(2, 'work'));
  await expect(halo).toHaveAttribute('data-phase', 'work');
  await expect(halo).toHaveAttribute('data-state', 'shown');
  expect(await since(page, chosen)).toBeLessThan(240);
  await expect(page.locator('.halo-aurora')).toHaveCount(1);
  await expect(page.locator('.halo-veil')).toHaveCount(3);
  await expectBands(page);
  await expect(page.locator('.halo-box, .halo-tint')).toHaveCount(0);
});

test('the work alone waits 250 ms; then the aurora turns around the text box and a reflection of the ground passes over the letters', async ({ page }) => {
  await openHalo(page);
  const sent = await now(page);
  await send(page, run(1, 'work'));
  const halo = page.locator('.halo');
  await expect(page.locator('.halo-veil')).toHaveCount(3);
  await expect(halo).toHaveAttribute('data-state', 'waiting');
  await expect(halo).toHaveCSS('opacity', '0');
  await expect(halo).toHaveAttribute('data-state', 'shown');
  const shownAfter = await since(page, sent);
  expect(shownAfter).toBeGreaterThanOrEqual(240);
  expect(shownAfter).toBeLessThan(700);
  await expect(halo).toHaveCSS('opacity', '1');
  // The aurora: a conic ring just inside the field, 4.5 s a turn, over its blurred glow.
  const aurora = page.locator('.halo-aurora');
  expect(await aurora.boundingBox()).toEqual(inset(textBox, 3));
  await expect(aurora).toHaveCSS('border-radius', '10px');
  const rings = aurora.locator('.ring');
  await expect(rings).toHaveCount(2);
  for (const ring of [rings.first(), rings.last()]) {
    await expect(ring).toHaveCSS('animation-name', 'halo-aurora');
    await expect(ring).toHaveCSS('animation-duration', '4.5s');
    await expect(ring).toHaveCSS('animation-timing-function', 'linear');
    await expect(ring).toHaveCSS('animation-iteration-count', 'infinite');
  }
  await expect(aurora.locator('.glow')).toHaveCSS('filter', 'blur(9px)');
  await expect(aurora.locator('.glow')).toHaveCSS('opacity', '0.7');
  await expectBands(page);
  // The reflection: the ground's white at .8 over a faint violet, on the strip of the runs.
  const total = sum(lines.map(line => pad(line, 1)));
  for (const [index, line] of lines.entries()) {
    const veil = page.locator('.halo-veil').nth(index);
    expect(await veil.boundingBox()).toEqual(pad(line, 1));
    await expect(veil).toHaveCSS('border-radius', '3px');
    await expect(veil).toHaveCSS('animation-name', 'halo-reflect');
    await expect(veil).toHaveCSS('animation-duration', '1.8s');
    await expect(veil).toHaveCSS('animation-timing-function', 'cubic-bezier(0.45, 0, 0.55, 1)');
    await expect(veil).toHaveCSS('animation-iteration-count', 'infinite');
    await expect(veil).toHaveCSS('background-image', 'linear-gradient(100deg, rgba(0, 0, 0, 0) 36%, rgba(255, 255, 255, 0.8) 50%, rgba(0, 0, 0, 0) 64%), linear-gradient(rgba(188, 130, 243, 0.08), rgba(188, 130, 243, 0.08))');
    await expect(veil).toHaveCSS('background-size', `${3 * total}px 100%, 100% 100%`);
  }
  await expect(page.locator('.halo-box, .halo-tint')).toHaveCount(0);
});

test('the reflection runs on from one line to the next at every moment', async ({ page }) => {
  await openHalo(page);
  await send(page, run(1, 'work'));
  await expect(page.locator('.halo')).toHaveAttribute('data-state', 'shown');
  const widths = lines.map(line => pad(line, 1).width);
  const total = sum(lines.map(line => pad(line, 1)));
  for (const at of [0, 300, 900, 1600]) {
    const positions = await page.evaluate(at => [...document.querySelectorAll<HTMLElement>('.halo-veil')].map(line => {
      const animation = line.getAnimations()[0];
      animation.pause();
      animation.currentTime = at;
      return parseFloat(getComputedStyle(line).backgroundPositionX);
    }), at);
    // The image point under a line's right edge is the one under the next line's left edge.
    for (let index = 0; index + 1 < lines.length; index++) expect(widths[index] - positions[index]).toBeCloseTo(-positions[index + 1], 1);
    // One strip: at the start the band is before the first line.
    if (at === 0) expect(positions[0]).toBeCloseTo(-2.4 * total, 1);
  }
});

test('leave fades out in 150 ms, clear removes the halo, a stale event changes nothing', async ({ page }) => {
  await openHalo(page);
  await send(page, run(4, 'work'));
  const halo = page.locator('.halo');
  await expect(halo).toHaveAttribute('data-state', 'shown');
  await send(page, run(3, 'leave'));
  await send(page, run(3, 'clear'));
  await expect(halo).toHaveAttribute('data-state', 'shown');
  await send(page, run(4, 'leave'));
  await expect(halo).toHaveAttribute('data-state', 'leaving');
  await expect(halo).toHaveCSS('transition-duration', '0.15s');
  await expect(halo).toHaveCSS('opacity', '0');
  await send(page, run(5, 'clear'));
  await expect(halo).toHaveCount(0);
  // A new run after a clear starts over, waiting 250 ms again.
  await send(page, run(6, 'work'));
  await expect(halo).toHaveAttribute('data-state', 'waiting');
  await expect(halo).toHaveAttribute('data-state', 'shown');
  // A menu that left no longer spares the work its wait.
  await send(page, run(7, 'menu'));
  await expect(halo).toHaveAttribute('data-phase', 'menu');
  await send(page, run(7, 'leave'));
  await send(page, run(8, 'work'));
  await expect(halo).toHaveAttribute('data-state', 'waiting');
  await expect(halo).toHaveAttribute('data-state', 'shown');
});

test('reduced animations: a fixed iridescent veil over the same strip and a still aurora, after 250 ms', async ({ page }) => {
  await openHalo(page);
  await settings(page, { motion: 'reduced' });
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  const sent = await now(page);
  await send(page, run(1, 'work'));
  await expect(page.locator('.halo')).toHaveAttribute('data-state', 'shown');
  expect(await since(page, sent)).toBeGreaterThanOrEqual(240);
  const total = sum(lines.map(line => pad(line, 1)));
  const veil = page.locator('.halo-veil').nth(1);
  await expect(veil).toHaveCSS('animation-name', 'none');
  await expect(veil).toHaveCSS('background-size', `${total}px 100%`);
  // The second run shows the strip from the first one's width on: continuous with it.
  await expect(veil).toHaveCSS('background-position', `-${pad(lines[0], 1).width}px 0px`);
  await expect(veil).toHaveCSS('background-image', 'linear-gradient(100deg, rgba(141, 159, 255, 0.24), rgba(188, 130, 243, 0.24) 50%, rgba(255, 186, 113, 0.24))');
  for (const ring of await page.locator('.halo-aurora .ring').all()) await expect(ring).toHaveCSS('animation-name', 'none');
});

test('marks: a wave of light over the new text, then the changed words lit without a box, held until leave, then 900 ms out', async ({ page }) => {
  await openHalo(page);
  const sent = await now(page);
  await send(page, run(1, 'marks'));
  const halo = page.locator('.halo');
  await expect(halo).toHaveAttribute('data-phase', 'marks');
  await expect(halo).toHaveAttribute('data-state', 'shown');
  expect(await since(page, sent), 'no 250 ms wait: the marks follow the paste').toBeLessThan(240);
  await expect(page.locator('.halo-veil, .halo-tint, .halo-band, .halo-aurora, .halo-box')).toHaveCount(0);
  // The wave, once, 1 s, over the new text's lines laid end to end.
  const waveTotal = sum(lines.map(line => pad(line, 1)));
  await expect(page.locator('.halo-wave')).toHaveCount(3);
  for (const [index, line] of lines.entries()) {
    const wave = page.locator('.halo-wave').nth(index);
    expect(await wave.boundingBox()).toEqual(pad(line, 1));
    await expect(wave).toHaveCSS('animation-name', 'halo-wave');
    await expect(wave).toHaveCSS('animation-duration', '1s');
    await expect(wave).toHaveCSS('animation-iteration-count', '1');
    await expect(wave).toHaveCSS('animation-timing-function', 'cubic-bezier(0.4, 0, 0.2, 1)');
    await expect(wave).toHaveCSS('animation-fill-mode', 'both');
    await expect(wave).toHaveCSS('background-image', 'linear-gradient(100deg, rgba(0, 0, 0, 0) 25%, rgba(141, 159, 255, 0.44) 40%, rgba(188, 130, 243, 0.48) 50%, rgba(255, 186, 113, 0.44) 60%, rgba(0, 0, 0, 0) 75%)');
    await expect(wave).toHaveCSS('background-size', `${3 * waveTotal}px 100%`);
  }
  // The wave, too, runs on from one line to the next.
  const positions = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.halo-wave')].map(line => {
    const animation = line.getAnimations()[0];
    animation.pause();
    animation.currentTime = 400;
    return parseFloat(getComputedStyle(line).backgroundPositionX);
  }));
  for (let index = 0; index + 1 < lines.length; index++) expect(pad(lines[index], 1).width - positions[index]).toBeCloseTo(-positions[index + 1], 1);
  // The changed words rise from 380 ms, over 420 ms. No mask was read: a feathered light around
  // each word, in the deep inks of a light ground, with nothing a box could be told from.
  await expect(page.locator('.halo-marks')).toHaveAttribute('data-arrival', 'wave');
  await expect(page.locator('.halo-marks')).toHaveAttribute('data-style', 'encre');
  const markTotal = sum(words);
  await expect(page.locator('.halo-mark.is-light')).toHaveCount(2);
  await expect(page.locator('.halo-ink, .halo-line')).toHaveCount(0);
  for (const [index, word] of words.entries()) {
    const mark = page.locator('.halo-mark').nth(index);
    expect(await mark.boundingBox()).toEqual(word);
    await expect(mark).toHaveCSS('animation-name', 'halo-mark-in');
    await expect(mark).toHaveCSS('animation-duration', '0.42s');
    await expect(mark).toHaveCSS('animation-delay', '0.38s');
    await expect(mark).toHaveCSS('animation-timing-function', 'ease-out');
    for (const property of ['background-image', 'box-shadow', 'outline-style', 'border-top-style']) await expect(mark).toHaveCSS(property, 'none');
    const light = mark.locator('.halo-light');
    await expect(light).toHaveCSS('background-image', 'linear-gradient(90deg, rgba(74, 85, 214, 0.3), rgba(122, 63, 201, 0.3) 55%, rgba(168, 51, 106, 0.3))');
    await expect(light).toHaveCSS('filter', 'blur(6px)');
    await expect(light).toHaveCSS('box-shadow', 'none');
    await expect(light).toHaveCSS('background-size', `${markTotal}px 100%`);
  }
  // One gradient across the marks: the second continues where the first ends.
  await expect(page.locator('.halo-light').nth(1)).toHaveCSS('background-position', `-${words[0].width}px 0px`);
  await expect(halo).toHaveCSS('opacity', '1');
  // Held until Rust says the user acted (or the time ran out): still there a second later.
  await page.waitForTimeout(1000);
  await expect(halo).toHaveAttribute('data-state', 'shown');
  await expect(halo).toHaveCSS('opacity', '1');
  await expect(page.locator('.halo-mark').first()).toHaveCSS('opacity', '1');
  const left = await now(page);
  await send(page, run(1, 'leave'));
  await expect(halo).toHaveAttribute('data-state', 'leaving');
  await expect(halo).toHaveCSS('transition-duration', '0.9s');
  await expect(halo).toHaveCSS('transition-timing-function', 'ease-out');
  await expect(halo).toHaveCSS('opacity', '0');
  expect(await since(page, left)).toBeGreaterThanOrEqual(850);
  await send(page, run(2, 'clear'));
  await expect(page.locator('.halo-mark')).toHaveCount(0);
});

// A mask: a PNG whose alpha is the glyphs, as Rust reads them under the changed words. 1 × 1 here.
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==';

test('marks with the masks of the glyphs: the ink is painted through them, one iris strip, a glow that follows the letters', async ({ page }) => {
  await openHalo(page);
  const masks = words.map(rect => ({ rect: { x: rect.x - 0.5, y: rect.y, width: rect.width + 1, height: rect.height }, image: png }));
  await send(page, run(1, 'marks', { masks }));
  await expect(page.locator('.halo-mark.is-ink')).toHaveCount(2);
  await expect(page.locator('.halo-light, .halo-line')).toHaveCount(0);
  const total = sum(words);
  for (const [index, mask] of masks.entries()) {
    const mark = page.locator('.halo-mark').nth(index);
    expect(await mark.boundingBox()).toEqual(mask.rect);
    await expect(mark).toHaveCSS('filter', 'drop-shadow(rgba(120, 100, 255, 0.35) 0px 0px 2px) drop-shadow(rgba(150, 110, 255, 0.35) 0px 0px 8px)');
    for (const property of ['background-image', 'box-shadow', 'outline-style', 'border-top-style']) await expect(mark).toHaveCSS(property, 'none');
    const ink = mark.locator('.halo-ink');
    expect(await ink.boundingBox()).toEqual(mask.rect);
    // The lab's inks, opaque: each already reads at 4.5:1 on white.
    await expect(ink).toHaveCSS('background-image', 'linear-gradient(90deg, rgb(74, 85, 214), rgb(122, 63, 201) 55%, rgb(168, 51, 106))');
    await expect(ink).toHaveCSS('background-size', `${total}px 100%`);
    await expect(ink).toHaveCSS('mask-image', `url("${png}")`);
    await expect(ink).toHaveCSS('mask-size', '100% 100%');
    await expect(ink).toHaveCSS('mask-repeat', 'no-repeat');
  }
  await expect(page.locator('.halo-ink').nth(1)).toHaveCSS('background-position', `-${words[0].width}px 0px`);
  // On a mid ground the inks are pushed until they read at 4.5:1 (src/halo/ink.ts).
  await send(page, run(2, 'marks', { masks, tone: 'light', ground: [200, 200, 200] }));
  await expect(page.locator('.halo-ink')).toHaveCount(2);
  const pushed = await page.locator('.halo-ink').first().evaluate(node => getComputedStyle(node).backgroundImage);
  expect(pushed).not.toContain('rgb(74, 85, 214)');
  // A mask the page does not accept (not a PNG data URL, or far from the word) leaves the feathered light.
  await send(page, run(3, 'marks', { masks: [{ rect: masks[0].rect, image: 'https://example.invalid/mask.png' }, { rect: { x: 300, y: 100, width: 40, height: 20 }, image: png }] }));
  await expect(page.locator('.halo-mark.is-light')).toHaveCount(2);
  await expect(page.locator('.halo-ink')).toHaveCount(0);
});

test('« Éclat »: one bright ink and a thin line that fades at both ends; the style of the run wins over the settings', async ({ page }) => {
  await openHalo(page);
  // From the settings (the halo window receives `settings-changed`), without a mask.
  await settings(page, { changedWordsStyle: 'eclat' });
  await send(page, run(1, 'marks'));
  await expect(page.locator('.halo-marks')).toHaveAttribute('data-style', 'eclat');
  await expect(page.locator('.halo-mark.is-light')).toHaveCount(2);
  const line = page.locator('.halo-line').first();
  expect(await line.boundingBox()).toEqual({ x: words[0].x, y: words[0].y + words[0].height - 2.5, width: words[0].width, height: 1.5 });
  await expect(line).toHaveCSS('background-image', 'linear-gradient(90deg, rgba(95, 111, 255, 0), rgba(95, 111, 255, 0.75) 25%, rgba(163, 91, 234, 0.75) 75%, rgba(163, 91, 234, 0))');
  await expect(page.locator('.halo-light').first()).toHaveCSS('background-image', 'linear-gradient(90deg, rgba(95, 111, 255, 0.2), rgba(95, 111, 255, 0.2) 55%, rgba(95, 111, 255, 0.2))');
  // With masks: the letters in one deep ink (white on a dark ground), the line kept.
  await send(page, run(2, 'marks', { masks: words.map(rect => ({ rect, image: png })) }));
  await expect(page.locator('.halo-ink').first()).toHaveCSS('background-image', 'linear-gradient(90deg, rgb(13, 20, 64), rgb(13, 20, 64) 55%, rgb(13, 20, 64))');
  await expect(page.locator('.halo-line')).toHaveCount(2);
  await send(page, run(3, 'marks', { masks: words.map(rect => ({ rect, image: png })), tone: 'dark', ground: [30, 30, 30] }));
  await expect(page.locator('.halo-ink').first()).toHaveCSS('background-image', 'linear-gradient(90deg, rgb(255, 255, 255), rgb(255, 255, 255) 55%, rgb(255, 255, 255))');
  await expect(page.locator('.halo-mark').first()).toHaveCSS('filter', 'drop-shadow(rgba(170, 185, 255, 0.7) 0px 0px 2px) drop-shadow(rgba(150, 170, 255, 0.55) 0px 0px 9px)');
  // The style the run carries (the choice at the replacement) wins over the page's settings.
  await send(page, run(4, 'marks', { style: 'encre' }));
  await expect(page.locator('.halo-marks')).toHaveAttribute('data-style', 'encre');
  await expect(page.locator('.halo-line')).toHaveCount(0);
});

test('marks without the new text\'s lines fade in over 260 ms', async ({ page }) => {
  await openHalo(page);
  await send(page, run(1, 'marks', { whole: [] }));
  await expect(page.locator('.halo-wave')).toHaveCount(0);
  await expect(page.locator('.halo-marks')).toHaveAttribute('data-arrival', 'fade');
  await expect(page.locator('.halo-mark').first()).toHaveCSS('animation-duration', '0.26s');
  await expect(page.locator('.halo-mark').first()).toHaveCSS('animation-delay', '0s');
});

test('marks under reduced animations: no wave, shown and removed without animation', async ({ page }) => {
  await openHalo(page);
  await settings(page, { motion: 'reduced' });
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  await send(page, run(1, 'marks'));
  const mark = page.locator('.halo-mark').first();
  await expect(mark).toHaveCSS('animation-name', 'none');
  await expect(mark).toHaveCSS('opacity', '1');
  for (const wave of await page.locator('.halo-wave').all()) await expect(wave).toBeHidden();
  await send(page, run(1, 'leave'));
  const halo = page.locator('.halo');
  await expect(halo).toHaveCSS('transition-duration', '0s');
  await expect(halo).toHaveCSS('opacity', '0', { timeout: 100 });
});

test('the colours follow the ground read under the text, else the app\'s theme; the reflection is a veil of that ground', async ({ page }) => {
  await openHalo(page);
  const halo = page.locator('.halo');
  // A dark ground: the dark tokens, the veil of its own colour.
  await send(page, run(1, 'work', { tone: 'dark', ground: [40, 44, 52] }));
  await expect(halo).toHaveAttribute('data-tone', 'dark');
  await expect(page.locator('.halo-band').first()).toHaveCSS('background-color', 'rgba(150, 166, 255, 0.07)');
  await expect(page.locator('.halo-veil').first()).toHaveCSS('background-image', 'linear-gradient(100deg, rgba(0, 0, 0, 0) 36%, rgba(40, 44, 52, 0.8) 50%, rgba(0, 0, 0, 0) 64%), linear-gradient(rgba(201, 155, 255, 0.08), rgba(201, 155, 255, 0.08))');
  // The pastels on a dark ground.
  await send(page, run(2, 'marks', { tone: 'dark', ground: [40, 44, 52] }));
  await expect(page.locator('.halo-light').first()).toHaveCSS('background-image', 'linear-gradient(90deg, rgba(174, 188, 255, 0.34), rgba(213, 182, 255, 0.34) 55%, rgba(245, 163, 181, 0.34))');
  // The ground wins over the app's theme: a light ground under a dark app.
  await settings(page, { theme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await send(page, run(3, 'marks', { tone: 'light', ground: white }));
  await expect(page.locator('.halo-light').first()).toHaveCSS('background-image', 'linear-gradient(90deg, rgba(74, 85, 214, 0.3), rgba(122, 63, 201, 0.3) 55%, rgba(168, 51, 106, 0.3))');
  // No ground read: the app's theme, and its own veil.
  await send(page, run(4, 'menu', { tone: null, ground: null }));
  await expect(halo).not.toHaveAttribute('data-tone', /.*/);
  await expect(page.locator('.halo-band').first()).toHaveCSS('background-color', 'rgba(150, 166, 255, 0.07)');
  await expect(page.locator('.halo-tint').first()).toHaveCSS('background-color', 'rgba(150, 166, 255, 0.28)');
  await send(page, run(5, 'work', { tone: null, ground: null }));
  await expect(page.locator('.halo-veil').first()).toHaveCSS('background-image', /rgba\(30, 31, 34, 0\.8\)/);
  await settings(page, { theme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('.halo-veil').first()).toHaveCSS('background-image', /rgba\(255, 255, 255, 0\.8\)/);
  await expect(page.locator('.halo-band').first()).toHaveCSS('background-color', 'rgba(141, 159, 255, 0.08)');
});
