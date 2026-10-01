import { test, expect, type Page } from '@playwright/test';

// The demo of the first run (src/demo/, docs/PLAN-0.6.md §4.2), in the browser preview:
// `/?window=setup&stage=demo`. It plays the app's real components; these tests watch what they
// do, and shake the demo (skip, replay, keys, pause) at the worst moments: nothing may stay stuck.
type Hook = { time: () => number; pause: () => void; play: () => void };
const open = (page: Page, motion: 'full' | 'reduced' = 'full') => page.goto(`/?window=setup&stage=demo&lang=fr&theme=light&motion=${motion}`);
// Waits until the demo's own clock reached `at` and holds that frame.
async function holdAt(page: Page, at: number) {
  await page.waitForFunction(time => { const demo = (window as unknown as { __demo?: Hook }).__demo; return !!demo && demo.time() >= time; }, at, { polling: 'raf', timeout: 30_000 });
  await page.evaluate(() => (window as unknown as { __demo: Hook }).__demo.pause());
}
const resume = (page: Page) => page.evaluate(() => (window as unknown as { __demo: Hook }).__demo.play());
const boxes = (page: Page, selector: string) => page.locator(selector).evaluateAll(elements => elements.map(element => { const box = element.getBoundingClientRect(); return { x: box.x, y: box.y, right: box.right, bottom: box.bottom, width: box.width, height: box.height }; }));

test.describe('the demo', () => {
  test.setTimeout(60_000);

  test('tells its seven phases apart, in order, each with its numbered caption and its segment', async ({ page }) => {
    await open(page);
    await expect(page.locator('.dm-root')).toBeVisible();
    await expect(page.locator('.dm-phase')).toHaveCount(7);
    const seen: Array<{ phase: string; caption: string; current: string }> = [];
    for (const [name, number, text] of [['ready', '1', 'Tout est prêt'], ['select', '2', 'Sélectionnez du texte'], ['shortcut', '3', 'Appuyez sur le raccourci'], ['menu', '4', 'Choisissez une action'], ['work', '5', 'Votre modèle travaille'], ['result', '6', 'Le texte est remplacé'], ['undo', '7', 'Annuler reste']] as const) {
      await expect(page.locator('.dm-root')).toHaveAttribute('data-phase', name, { timeout: 15_000 });
      await expect(page.locator(`.dm-caption[data-phase="${name}"]`)).toContainText(text);
      await expect(page.locator(`.dm-caption[data-phase="${name}"] .dm-caption-n b`)).toHaveText(number);
      // The frieze: this segment is the current one, those before it are done.
      await expect(page.locator('.dm-phase[data-state="current"]')).toHaveAttribute('data-phase', name);
      await expect(page.locator('.dm-phase[data-state="done"]')).toHaveCount(Number(number) - 1);
      seen.push({ phase: name, caption: number, current: name });
    }
    expect(seen).toHaveLength(7);
    await expect(page.locator('.dm-root')).toHaveAttribute('data-phase', 'end', { timeout: 15_000 });
    await expect(page.locator('.dm-end')).toBeVisible();
    await expect(page.locator('.dm-phase[data-state="done"]')).toHaveCount(7);
  });

  test('selects in one diagonal drag: at each instant a real multi-line selection up to the pointer', async ({ page }) => {
    await open(page);
    // Before the press: no selection. The I-beam waits before the first character.
    await holdAt(page, 3400);
    await expect(page.locator('.dm-sel')).toHaveCount(0);
    await expect(page.locator('.dm-cursor')).toHaveAttribute('data-shape', 'beam');
    await resume(page);
    let previous = { lines: 0, y: 0 };
    const pictures: number[] = [];
    for (const at of [3900, 4150, 4350, 4550, 4800, 5100]) {
      await holdAt(page, at);
      const bands = await boxes(page, '.dm-sel');
      const [cursor] = await boxes(page, '.dm-cursor');
      pictures.push(bands.length);
      expect(bands.length, `t ${at}`).toBeGreaterThanOrEqual(previous.lines);
      // The pointer only goes down and right of where it pressed: never back to a line's start.
      expect(cursor.y).toBeGreaterThanOrEqual(previous.y);
      if (bands.length) {
        const last = bands[bands.length - 1];
        // The band of the pointer's line stops under the pointer; the lines above it are whole.
        expect(Math.abs(last.right - cursor.x), `t ${at}`).toBeLessThan(12);
        expect(cursor.y).toBeGreaterThanOrEqual(last.y - 1);
        expect(cursor.y).toBeLessThanOrEqual(last.bottom + 1);
        for (const band of bands.slice(0, -1)) expect(band.width).toBeGreaterThan(520);
        // Bands touch: one selection, not three stripes.
        for (let i = 1; i < bands.length; i++) expect(Math.abs(bands[i].y - bands[i - 1].bottom)).toBeLessThan(1.5);
        expect(bands.every(band => Math.abs(band.x - bands[0].x) < 1.5)).toBe(true);
      }
      previous = { lines: bands.length, y: cursor.y };
      await resume(page);
    }
    // One line, then two, then three: the selection crossed the paragraph in one stroke.
    expect(new Set(pictures)).toEqual(new Set([1, 2, 3]));
    await holdAt(page, 5300);
    await expect(page.locator('.dm-sel')).toHaveCount(3);
  });

  test('plays the real components: the Îlot unfolds under the pointer, works, pastes, offers Undo', async ({ page }) => {
    await open(page);
    // The shortcut's keys light one after the other, with the user's own chord.
    await holdAt(page, 6500);
    await expect(page.locator('.dm-key')).toHaveText(['CtrlCtrl', 'AltAlt', 'EspaceEspace']);
    await expect(page.locator('.dm-key[data-lit]')).toHaveCount(2);
    await resume(page);
    // The capture: the app's own Îlot, compact, under the end of the selection.
    await expect(page.locator('[data-ilot][data-mode="compact"]')).toBeVisible({ timeout: 10_000 });
    // Once its entrance rests: 8 px under the selection's last line, its right edge on its end
    // (the app's placement).
    await holdAt(page, 7500);
    const [shape] = await boxes(page, '[data-ilot-shape]');
    const bands = await boxes(page, '.dm-sel');
    expect(Math.abs(shape.right - bands[2].right)).toBeLessThan(2.5);
    expect(Math.abs(shape.y - bands[2].bottom - 8)).toBeLessThan(1.5);
    await resume(page);
    await expect(page.locator('.halo[data-phase="menu"][data-state="shown"]')).toHaveCount(1);
    // The pointer rests on the ✦: the grid unfolds by the Îlot's own timer.
    await expect(page.locator('[data-ilot][data-mode="grid"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-ilot] [data-tile]')).toHaveCount(6);
    // The pointer's click on a tile is a real choice: the same surface becomes the working pill.
    await expect(page.locator('[data-ilot][data-shape="pill"] .result-working')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.halo[data-phase="work"]')).toHaveCount(1);
    await expect(page.locator('[data-ilot-shape]')).toHaveCount(1);
    // The paste: the text is replaced, the changed words take the app's ink, Undo and its ring.
    await expect(page.locator('[data-ilot] [data-result-content="done"] .result-undo')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.dm-lit .halo-lit')).toHaveText(['convenu', 'chiffres', 'clairs']);
    await expect(page.locator('.halo[data-phase="marks"] .halo-wave')).toHaveCount(3);
    // The pointer rests on Undo: its countdown stands still, as under a real pointer.
    await holdAt(page, 15_400);
    await expect(page.locator('[data-ilot] [data-result-content="done"]')).toHaveAttribute('data-paused', 'true');
    await expect(page.locator('[data-ilot] .result-undo')).toHaveAttribute('data-demo-hover', '');
    await resume(page);
    // A click in the text: Undo is withdrawn, the check alone, then the Îlot leaves by itself.
    await expect(page.locator('[data-ilot] .result-row.is-check-only')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-ilot] .result-undo')).toHaveCount(0);
    await expect(page.locator('.dm-lit')).toHaveAttribute('data-state', 'out');
    await expect(page.locator('[data-ilot]')).toHaveCount(0, { timeout: 10_000 });
    await expect(page.locator('.dm-end')).toBeVisible({ timeout: 10_000 });
  });

  test('the keyboard and the real pointer never reach the Îlot; Space pauses, Escape skips', async ({ page }) => {
    await open(page);
    await expect(page.locator('[data-ilot][data-mode="compact"]')).toBeVisible({ timeout: 15_000 });
    await holdAt(page, 7700);
    // Keys the Îlot would take (its letters, Enter, Tab, digits): nothing is chosen, nothing opens.
    for (const key of ['f', 'Enter', 'Tab', '2', 't', 'ArrowDown', '/']) await page.keyboard.press(key);
    await page.mouse.move(350, 400); await page.mouse.click(350, 400);
    await page.waitForTimeout(700);
    await expect(page.locator('[data-ilot][data-mode="compact"]')).toBeVisible();
    await expect(page.locator('[data-ilot] input')).toHaveCount(0);
    // Space: play, pause.
    const at = () => page.evaluate(() => (window as unknown as { __demo: Hook }).__demo.time());
    const held = await at();
    await page.waitForTimeout(300);
    expect(await at()).toBe(held);
    await page.keyboard.press('Space');
    await page.waitForTimeout(400);
    const moved = await at();
    expect(moved).toBeGreaterThan(held + 200);
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    expect(await at()).toBeLessThan(moved + 120);
    // Escape skips the demo: the setup takes over at « C'est prêt ».
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/step=ready/);
    await expect(page.locator('.su-screen[data-screen="ready"]')).toBeVisible();
  });

  test('« Revoir » in the middle of anything starts clean; « Passer » mashed ends once', async ({ page }) => {
    await open(page);
    // Replay while the grid unfolds, then while the pill works, then right after the paste.
    for (const at of [8700, 10_300, 12_150]) {
      await page.waitForFunction(time => (window as unknown as { __demo?: Hook }).__demo!.time() >= time, at, { polling: 'raf', timeout: 30_000 });
      await page.getByRole('button', { name: 'Recommencer la démo' }).dblclick();
      await expect(page.locator('.dm-root')).toHaveAttribute('data-phase', 'ready');
      // Nothing of the previous run is left: no Îlot, no halo, no selection, no changed word.
      await expect(page.locator('[data-ilot]')).toHaveCount(0);
      await expect(page.locator('.halo')).toHaveCount(0);
      await expect(page.locator('.dm-sel')).toHaveCount(0);
      await expect(page.locator('.dm-lit')).toHaveCount(0);
      await expect(page.locator('.dm-intro')).toBeVisible();
    }
    // It still plays: one Îlot, never two.
    await expect(page.locator('[data-ilot][data-mode="compact"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-ilot-shape]')).toHaveCount(1);
    // « Passer », clicked three times in a row in the middle of the menu.
    const navigations: string[] = [];
    page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations.push(frame.url()); });
    const skip = page.getByRole('button', { name: 'Passer' });
    await skip.evaluate(button => { for (let i = 0; i < 3; i++) (button as HTMLButtonElement).click(); });
    await expect(page).toHaveURL(/step=ready/);
    expect(navigations.filter(url => url.includes('step=ready'))).toHaveLength(1);
  });

  test('the strip unfolds on hover and on focus, and the demo waits while it is read', async ({ page }) => {
    await open(page);
    await holdAt(page, 6600);
    await resume(page);
    const at = () => page.evaluate(() => (window as unknown as { __demo: Hook }).__demo.time());
    await page.locator('.dm-rail').hover();
    await expect(page.locator('.dm-rail')).toHaveAttribute('data-open', '');
    await expect(page.locator('.dm-root')).toHaveAttribute('data-paused', '');
    await page.locator('.dm-rail-item').first().hover();
    await expect(page.locator('.dm-rail-item[data-active]')).toContainText('Raccourci');
    await expect(page.locator('.dm-rail-item[data-active]')).toContainText('Ctrl + Alt + Espace');
    await expect(page.locator('.dm-rail-item[data-active]')).toContainText('Réglages › Raccourcis');
    // What it talks about is ringed while it is on the stage: the keycaps.
    await expect(page.locator('.dm-ring')).toHaveCount(1);
    const held = await at();
    await page.waitForTimeout(400);
    expect(await at()).toBe(held);
    // Leaving the strip folds it, and the demo goes on.
    await page.mouse.move(300, 30);
    await expect(page.locator('.dm-rail')).not.toHaveAttribute('data-open', '');
    await expect(page.locator('.dm-ring')).toHaveCount(0);
    await page.waitForTimeout(400);
    expect(await at()).toBeGreaterThan(held + 200);
    // The keyboard unfolds it too.
    await page.locator('.dm-rail-head').focus();
    await expect(page.locator('.dm-rail')).toHaveAttribute('data-open', '');
    await page.keyboard.press('Escape');
    await expect(page.locator('.dm-rail')).not.toHaveAttribute('data-open', '');
    await expect(page.locator('.dm-root')).toBeVisible();
  });

  test('reduced motion: a slideshow of the seven phases, drawn by the same components at rest', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, 'reduced');
    await expect(page.locator('.dm-root')).toHaveAttribute('data-reduced', '');
    await expect(page.getByText('Mouvement réduit : diaporama')).toBeVisible();
    await expect(page.locator('.dm-intro')).toBeVisible();
    // Pause holds a slide; play goes on.
    await page.getByRole('button', { name: 'Pause' }).click();
    await page.waitForTimeout(3200);
    await expect(page.locator('.dm-root')).toHaveAttribute('data-phase', 'ready');
    await page.getByRole('button', { name: 'Lecture' }).click();
    await expect(page.locator('.dm-root')).toHaveAttribute('data-phase', 'select', { timeout: 6000 });
    await expect(page.locator('.dm-sel')).toHaveCount(3);
    await expect(page.locator('.dm-root')).toHaveAttribute('data-phase', 'shortcut', { timeout: 6000 });
    await expect(page.locator('[data-ilot][data-mode="compact"]')).toBeVisible();
    await expect(page.locator('.dm-key[data-lit]')).toHaveCount(3);
    await expect(page.locator('.dm-root')).toHaveAttribute('data-phase', 'menu', { timeout: 6000 });
    await expect(page.locator('[data-ilot][data-mode="grid"] [data-tile]')).toHaveCount(6);
    // The grid opens right of where the compact bubble stood, as in the app.
    const [grid] = await boxes(page, '[data-ilot-shape]');
    const bands = await boxes(page, '.dm-sel');
    expect(grid.right).toBeGreaterThan(bands[2].right + 60);
    await expect(page.locator('.dm-root')).toHaveAttribute('data-phase', 'work', { timeout: 6000 });
    await expect(page.locator('[data-ilot] .result-working')).toBeVisible();
    await expect(page.locator('.dm-root')).toHaveAttribute('data-phase', 'result', { timeout: 6000 });
    await expect(page.locator('.dm-lit .halo-lit')).toHaveCount(3);
    await expect(page.locator('[data-ilot] .result-undo')).toBeVisible();
    await expect(page.locator('.dm-root')).toHaveAttribute('data-phase', 'undo', { timeout: 6000 });
    await expect(page.locator('[data-ilot] .result-row.is-check-only')).toBeVisible();
    await expect(page.locator('.dm-root')).toHaveAttribute('data-phase', 'end', { timeout: 6000 });
    await page.getByRole('button', { name: 'Continuer' }).click();
    await expect(page).toHaveURL(/step=ready/);
  });

  test('speaks English with the English text, and fits a smaller window', async ({ page }) => {
    await page.setViewportSize({ width: 720, height: 560 });
    await page.goto('/?window=setup&stage=demo&lang=en&theme=dark&motion=full');
    await expect(page.locator('.dm-caption')).toContainText('All set. Watch how it works.');
    const [stage] = await boxes(page, '.dm-fit');
    expect(stage.width).toBeLessThanOrEqual(720.5);
    expect(stage.height).toBeLessThanOrEqual(560.5);
    expect(stage.x).toBeGreaterThanOrEqual(-0.5);
    await holdAt(page, 5300);
    // Scaled, the selection still lies on its text: three touching bands inside the mail.
    const bands = await boxes(page, '.dm-sel');
    const [mail] = await boxes(page, '.dm-mail-body');
    expect(bands).toHaveLength(3);
    for (const band of bands) { expect(band.x).toBeGreaterThanOrEqual(mail.x); expect(band.right).toBeLessThanOrEqual(mail.right + 1); }
    await expect(page.locator('.dm-mail-body')).toContainText('as agree.');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
});
