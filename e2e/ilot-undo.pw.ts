import { test, expect, type Page } from '@playwright/test';
import { changedRanges } from '../src/result/highlight';

// Lot 9 after Rust's own paste under the Îlot (docs/DA-PLAN.md lot 9; docs/BRIDGE.md « the
// result »), over the IPC fixture (e2e/native-fixture.ts): the check, then Undo with its ring while
// Rust offers it; the changed words asked once (word by word or the whole block); the time still
// under the pointer; `undo_result` once, its outcomes read by their status; Undo withdrawn by
// `undo-state` without the pill moving; the settings of « After replacing ». Synthetic texts, a
// simulated paste: a browser run, not the Windows window, not an inference.
type Call = { command: string; args?: Record<string, unknown>; at: number };
type Box = { x: number; y: number; width: number; height: number };
type Fixture = {
  calls: Call[];
  settings: (next: Record<string, unknown>) => Promise<void>;
  captureMenu: (id: string, lastActionId?: string | null, text?: string) => Promise<void>;
  done: (text?: string) => Promise<void>;
  error: (code?: string, message?: string) => Promise<void>;
  pasted: (options?: { undoable?: boolean; pastedRects?: Box[] }) => Promise<void>;
  undoWith: (outcome: Record<string, unknown>) => void;
  undoRejects: (message?: string) => void;
  holdUndo: () => void;
  releaseUndo: () => void;
  undoState: (reason?: string, requestId?: string) => Promise<void>;
  requestId: () => string;
};
const on = <T>(page: Page, run: (fixture: Fixture) => T | Promise<T>) =>
  page.evaluate(`(${run.toString()})(window.nativeFixture)`) as Promise<T>;
const calls = (page: Page, command: string) =>
  page.evaluate(
    (name) =>
      (window as unknown as { nativeFixture: Fixture }).nativeFixture.calls
        .filter((call) => call.command === name)
        .map((call) => call.args ?? {}),
    command,
  );
const stage = (page: Page) => page.locator('.ilot-stage');
const box = (page: Page) =>
  page.locator('[data-ilot-shape]').evaluate((element) => {
    const r = element.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
const sameSurface = (page: Page) =>
  page
    .locator('[data-ilot-shape]')
    .evaluate((element) => (element as HTMLElement & { tag?: string }).tag === 'surface');
const undoButton = (page: Page) => page.locator('.shape-layer:not(.is-leaving) .result-undo');

async function openIlot(page: Page, settings: Record<string, unknown> = {}) {
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
  await page.evaluate(
    (next) => (window as unknown as { nativeFixture: Fixture }).nativeFixture.settings(next),
    settings,
  );
}
async function settled(page: Page) {
  await expect
    .poll(async () => {
      const a = await box(page);
      await page.waitForTimeout(80);
      const b = await box(page);
      return JSON.stringify(a) === JSON.stringify(b);
    })
    .toBe(true);
}
// A menu capture of `text`, chosen with Enter (its last action), then the model's `result` and
// Rust's paste: the check on the Îlot's own surface, tagged to tell it is the same element.
async function pasteThrough(
  page: Page,
  id: string,
  {
    lastActionId = null,
    text = 'Their going too the store',
    result = 'They are going to the store',
    undoable = true,
  }: { lastActionId?: string | null; text?: string; result?: string; undoable?: boolean } = {},
  beforePaste?: () => Promise<unknown>,
  after: 'done' | 'undone' = 'done',
) {
  await page.evaluate(
    ({ id, lastActionId, text }) =>
      (window as unknown as { nativeFixture: Fixture }).nativeFixture.captureMenu(id, lastActionId, text),
    { id, lastActionId, text },
  );
  await expect(stage(page)).toHaveAttribute('data-stage', 'menu');
  await expect(stage(page)).toHaveAttribute('data-capture-id', id);
  await page.locator('[data-ilot-shape]').evaluate((element) => {
    (element as HTMLElement & { tag?: string }).tag = 'surface';
  });
  await page.keyboard.press('Enter');
  await expect(stage(page)).toHaveAttribute('data-stage', 'working');
  await page.evaluate((result) => (window as unknown as { nativeFixture: Fixture }).nativeFixture.done(result), result);
  await beforePaste?.();
  await page.evaluate(
    (undoable) => (window as unknown as { nativeFixture: Fixture }).nativeFixture.pasted({ undoable }),
    undoable,
  );
  await expect(stage(page)).toHaveAttribute('data-stage', after);
  return on(page, (f) => f.requestId());
}
test.describe.configure({ timeout: 45_000 });

test('after Rust’s paste: the check, then Undo and its ring; the changed words asked once, word by word; the time stands still under the pointer, then the Îlot leaves and the marks stay Rust’s', async ({
  page,
}) => {
  await page.clock.install();
  await openIlot(page);
  const text = 'Their going too the store',
    result = 'They are going to the store';
  const requestId = await pasteThrough(page, 'words', { text, result }, async () => {
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 50));
  });
  // Fix grammar: a word diff; ranges of the result only, never any text in the request.
  const expected = changedRanges(text, result, { actionId: 'correct' });
  expect(expected.mode).toBe('words');
  await expect.poll(() => calls(page, 'highlight_changes')).toEqual([{ requestId, ranges: expected.ranges }]);
  await expect(page.locator('.result-check')).toBeAttached();
  await expect(undoButton(page)).toBeVisible();
  await expect(page.locator('.result-ring')).toHaveCount(1);
  await expect(page.locator('[data-result-content="done"]')).not.toHaveClass(/is-check-only|is-undo-only/);
  expect(await sameSurface(page)).toBe(true);

  // Eight seconds by default; the pointer on the pill holds them.
  await page.clock.runFor(4000);
  await page.locator('.result-row').hover();
  await expect(page.locator('.result-row')).toHaveAttribute('data-paused', 'true');
  await page.clock.runFor(20_000);
  expect(await calls(page, 'dismiss_overlay')).toHaveLength(0);
  await page.mouse.move(2, 2);
  await expect(page.locator('.result-row')).not.toHaveAttribute('data-paused', 'true');
  await page.clock.runFor(3900);
  expect(await calls(page, 'dismiss_overlay')).toHaveLength(0);
  await page.clock.runFor(200);
  // The Îlot leaves at its countdown's end; the marks are not its to end (Rust ends them at the
  // user's next action in the text, or after their own time).
  await expect.poll(() => calls(page, 'dismiss_overlay')).toHaveLength(1);
  await expect(stage(page)).toHaveAttribute('data-closing', 'true');
  // The exit itself is not awaited here: Playwright's clock fakes performance.now(), not
  // document.timeline, so after 20 s held the Îlot's WAAPI exit starts that far ahead (its end is
  // checked in e2e/ilot-result.pw.ts with a short clock).
  await page.clock.resume();
  await page.waitForTimeout(300);
  expect(await calls(page, 'highlight_changes')).toEqual([{ requestId, ranges: expected.ranges }]);
  expect(await calls(page, 'undo_result')).toHaveLength(0);
});

test('Undo: one click asks undo_result once, the button waits meanwhile; « Undone », then the Îlot leaves; nothing else is pasted', async ({
  page,
}) => {
  await openIlot(page);
  const requestId = await pasteThrough(page, 'undo');
  await on(page, (f) => f.holdUndo());
  await undoButton(page).dblclick();
  await expect.poll(() => calls(page, 'undo_result')).toEqual([{ requestId }]);
  await expect(undoButton(page)).toHaveAttribute('aria-disabled', 'true');
  // A click while it waits (aria-disabled: past Playwright's own check) asks nothing more.
  await undoButton(page).click({ force: true });
  await on(page, (f) => f.releaseUndo());
  await expect(stage(page)).toHaveAttribute('data-stage', 'undone');
  await expect(page.locator('[data-result-content="undone"]')).toHaveText('Undone');
  // Said once: the stage's status, not a second live region on the pill.
  expect(await page.locator('[role="status"], [role="alert"], [aria-live]').filter({ hasText: 'Undone' }).count()).toBe(
    1,
  );
  expect(await sameSurface(page)).toBe(true);
  await expect.poll(() => calls(page, 'dismiss_overlay')).toHaveLength(1);
  expect(await calls(page, 'undo_result')).toHaveLength(1);
  // Rust hides the marks itself on Undo; nothing is pasted or copied by the front.
  for (const command of ['replace_result', 'copy_result']) expect(await calls(page, command), command).toHaveLength(0);
});

test('Undo refused, failed or rejected: the pill says why in Undo’s words, ✕ only, and nothing else is ever pasted', async ({
  page,
}) => {
  await openIlot(page);
  const cases = [
    [
      {
        status: 'refused',
        confirmed: false,
        message: 'Le texte a changé depuis le remplacement; annulation refusée.',
        code: 'target_changed',
      },
      'target_changed',
      'Text changed — can’t undo',
    ],
    [
      { status: 'refused', confirmed: false, message: 'Relâchez les touches.', code: 'keys_held' },
      'keys_held',
      'Keys held down — can’t undo',
    ],
    [
      {
        status: 'refused',
        confirmed: false,
        message: 'Impossible de réactiver la fenêtre source.',
        code: 'paste_blocked',
      },
      'paste_blocked',
      'This app blocked Undo',
    ],
    [
      { status: 'failed', confirmed: false, message: 'L’original n’est pas revenu.', code: 'paste_blocked' },
      'paste_blocked',
      'Undo not confirmed — check text',
    ],
    [null, 'internal', 'Can’t undo now'],
  ] as const;
  for (const [index, [outcome, code, words]] of cases.entries()) {
    const id = `refused-${index}`;
    const requestId = await pasteThrough(page, id);
    if (outcome)
      await page.evaluate(
        (outcome) => (window as unknown as { nativeFixture: Fixture }).nativeFixture.undoWith(outcome),
        outcome,
      );
    else await on(page, (f) => f.undoRejects());
    await undoButton(page).click();
    await expect(stage(page)).toHaveAttribute('data-stage', 'error');
    await expect(stage(page)).toHaveAttribute('data-error', code);
    await expect(page.getByRole('alert')).toHaveText(words);
    // Neither Rust's message nor a button to paste again: ✕ alone.
    await expect(stage(page)).not.toContainText('annulation refusée');
    await expect(page.locator('.ilot-stage button')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Close' })).toBeVisible();
    expect(await sameSurface(page)).toBe(true);
    expect((await calls(page, 'undo_result')).filter((args) => args.requestId === requestId)).toHaveLength(1);
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('[data-ilot]')).toHaveCount(0);
  }
  expect(await calls(page, 'undo_result')).toHaveLength(cases.length);
  for (const command of ['replace_result', 'copy_result']) expect(await calls(page, command), command).toHaveLength(0);
});

test('undo-state withdraws Undo: the button leaves while the pill keeps its corner, the check stays drawn; a stale withdrawal changes nothing', async ({
  page,
}) => {
  await openIlot(page);
  await pasteThrough(page, 'typed');
  await expect(undoButton(page)).toBeVisible();
  await settled(page);
  // Another request's withdrawal is not this one's.
  await on(page, (f) => f.undoState('typed', 'stale-request'));
  await page.waitForTimeout(100);
  await expect(undoButton(page)).toBeVisible();
  const before = await box(page);
  const frames = page.evaluate(
    () =>
      new Promise<Box[]>((resolve) => {
        const out: Box[] = [];
        const start = performance.now();
        const tick = () => {
          const r = document.querySelector('[data-ilot-shape]')!.getBoundingClientRect();
          out.push({ x: r.x, y: r.y, width: r.width, height: r.height });
          if (performance.now() - start < 900) requestAnimationFrame(tick);
          else resolve(out);
        };
        requestAnimationFrame(tick);
      }),
  );
  await on(page, (f) => f.undoState('typed'));
  const seen = await frames;
  await expect(undoButton(page)).toHaveCount(0);
  await expect(page.locator('.shape-layer:not(.is-leaving) [data-result-content="done"]')).toHaveClass(/is-check-only/);
  await expect(page.locator('.shape-layer:not(.is-leaving) .result-check')).toHaveClass(/is-drawn/);
  // The check alone leaves 1.1 s after a key (the lab): its shape at rest is the frames' last.
  const after = seen.at(-1)!;
  expect(Math.abs(seen.at(-4)!.width - after.width)).toBeLessThan(0.5);
  // Narrower, never moved: the corner facing the selection stays put, frame after frame.
  expect(after.width).toBeLessThan(before.width);
  for (const frame of seen) {
    expect(Math.abs(frame.x + frame.width - (before.x + before.width)), JSON.stringify(frame)).toBeLessThan(0.5);
    expect(Math.abs(frame.y - before.y), JSON.stringify(frame)).toBeLessThan(0.5);
  }
  expect(
    seen.filter((frame) => frame.width < before.width - 2 && frame.width > after.width + 2).length,
  ).toBeGreaterThan(2);
  expect(await sameSurface(page)).toBe(true);
  expect(await calls(page, 'undo_result')).toHaveLength(0);
});

test('undo-state for a key or the caret: the check alone leaves within the lab’s 1.1 s, and the marks are Rust’s: asked once per paste, never ended by the front', async ({
  page,
}) => {
  await page.clock.install();
  await openIlot(page);
  // The caret moved 3 s into Undo's 8 s: 1.1 s more, not 5.
  await pasteThrough(page, 'caret-time', {}, async () => {
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 50));
  });
  await expect.poll(() => calls(page, 'highlight_changes')).toHaveLength(1);
  await page.clock.runFor(3000);
  await on(page, (f) => f.undoState('caret_moved'));
  await expect(undoButton(page)).toHaveCount(0);
  await expect(page.locator('.shape-layer:not(.is-leaving) [data-result-content="done"]')).toHaveClass(/is-check-only/);
  await page.clock.runFor(1000);
  expect(await calls(page, 'dismiss_overlay')).toHaveLength(0);
  await page.clock.runFor(200);
  await expect.poll(() => calls(page, 'dismiss_overlay')).toHaveLength(1);
  await page.clock.resume();
  await expect(page.locator('[data-ilot]')).toHaveCount(0);

  // A key typed in the source at once: the same 1.1 s, whatever Undo had left.
  await page.clock.install();
  await pasteThrough(page, 'typed-time', {}, async () => {
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 50));
  });
  await page.clock.runFor(200);
  await on(page, (f) => f.undoState('typed'));
  await expect(undoButton(page)).toHaveCount(0);
  await page.clock.runFor(1000);
  expect(await calls(page, 'dismiss_overlay')).toHaveLength(1);
  await page.clock.runFor(200);
  await expect.poll(() => calls(page, 'dismiss_overlay')).toHaveLength(2);
  await page.clock.resume();
  expect(await calls(page, 'highlight_changes')).toHaveLength(2);
  expect(await calls(page, 'undo_result')).toHaveLength(0);
});

test('the user’s own Ctrl+Z in the source (undo-state undo_key): « Undone », said once, 0.9 s, then the Îlot leaves; nothing asked of Rust', async ({
  page,
}) => {
  await page.clock.install();
  await openIlot(page);
  await pasteThrough(page, 'ctrl-z', {}, async () => {
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 50));
  });
  await expect(undoButton(page)).toBeVisible();
  await page.clock.runFor(2000);
  await on(page, (f) => f.undoState('undo_key'));
  await expect(stage(page)).toHaveAttribute('data-stage', 'undone');
  await expect(page.locator('.shape-layer:not(.is-leaving) [data-result-content="undone"]')).toHaveText('Undone');
  expect(await page.locator('[role="status"], [role="alert"], [aria-live]').filter({ hasText: 'Undone' }).count()).toBe(
    1,
  );
  expect(await sameSurface(page)).toBe(true);
  await page.clock.runFor(800);
  expect(await calls(page, 'dismiss_overlay')).toHaveLength(0);
  await page.clock.runFor(200);
  await expect.poll(() => calls(page, 'dismiss_overlay')).toHaveLength(1);
  await page.clock.resume();
  // Rust ends its own marks (the Ctrl+Z was a key in the text), and nothing was asked of it.
  for (const command of ['undo_result', 'replace_result']) expect(await calls(page, command), command).toHaveLength(0);
});

test('undo-state before result-delivery is kept: Undo is never offered (the check alone, 1.1 s), and a Ctrl+Z seen first reads as Undone', async ({
  page,
}) => {
  await page.clock.install();
  await openIlot(page);
  // Rust saw the caret move between its paste and the delivery reaching the page.
  await pasteThrough(page, 'early-caret', {}, async () => {
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 50));
    await on(page, (f) => f.undoState('caret_moved'));
  });
  await expect(page.locator('.shape-layer:not(.is-leaving) [data-result-content="done"]')).toHaveClass(/is-check-only/);
  await expect(undoButton(page)).toHaveCount(0);
  await page.clock.runFor(1000);
  expect(await calls(page, 'dismiss_overlay')).toHaveLength(0);
  await page.clock.runFor(200);
  await expect.poll(() => calls(page, 'dismiss_overlay')).toHaveLength(1);
  await page.clock.resume();
  await expect(page.locator('[data-ilot]')).toHaveCount(0);
  // The marks are not Undo's (Lucas, 25/09): asked all the same.
  expect(await calls(page, 'highlight_changes')).toHaveLength(1);

  // The user's own Ctrl+Z, seen before the delivery: « Undone » straight away.
  await pasteThrough(page, 'early-ctrl-z', {}, () => on(page, (f) => f.undoState('undo_key')), 'undone');
  await expect(page.locator('.shape-layer:not(.is-leaving) [data-result-content="undone"]')).toHaveText('Undone');
  await expect(undoButton(page)).toHaveCount(0);
  await expect.poll(() => calls(page, 'dismiss_overlay')).toHaveLength(2);
  expect(await calls(page, 'undo_result')).toHaveLength(0);
  // The paste already undone: no marks asked for text that is gone.
  expect(await calls(page, 'highlight_changes')).toHaveLength(1);
});

test('After replacing: changed words off, Undo off, the check off, a shorter Undo, and a block for Translate', async ({
  page,
}) => {
  await page.clock.install();
  await openIlot(page);
  // Changed words off: Undo, no marks.
  await on(page, (f) =>
    f.settings({
      afterReplace: { check: true, undo: true, undoSeconds: 8, changedWords: false, changedWordsSeconds: 60 },
    }),
  );
  await pasteThrough(page, 'no-marks');
  await expect(undoButton(page)).toBeVisible();
  await page.clock.runFor(500);
  expect(await calls(page, 'highlight_changes')).toHaveLength(0);
  await page.keyboard.press('Escape');
  await expect.poll(() => calls(page, 'dismiss_overlay')).toHaveLength(1);
  await expect(page.locator('[data-ilot]')).toHaveCount(0);

  // Undo off: Rust says it is not undoable; the check alone, and the marks all the same (they
  // are not Undo's, Lucas 25/09).
  await on(page, (f) =>
    f.settings({
      afterReplace: { check: true, undo: false, undoSeconds: 8, changedWords: true, changedWordsSeconds: 60 },
    }),
  );
  const noUndo = await pasteThrough(page, 'no-undo', { undoable: false });
  await expect(page.locator('[data-result-content="done"]')).toHaveClass(/is-check-only/);
  await expect(undoButton(page)).toHaveCount(0);
  await page.clock.runFor(1200);
  await expect.poll(() => calls(page, 'dismiss_overlay')).toHaveLength(2);
  expect(await calls(page, 'highlight_changes')).toEqual([expect.objectContaining({ requestId: noUndo })]);
  await expect(page.locator('[data-ilot]')).toHaveCount(0);

  // The check off: Undo alone; three seconds.
  await on(page, (f) =>
    f.settings({
      afterReplace: { check: false, undo: true, undoSeconds: 3, changedWords: true, changedWordsSeconds: 60 },
    }),
  );
  await pasteThrough(page, 'undo-only', {}, async () => {
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 50));
  });
  await expect(page.locator('[data-result-content="done"]')).toHaveClass(/is-undo-only/);
  await expect(page.locator('.result-check')).toHaveCount(0);
  await page.clock.runFor(2900);
  expect(await calls(page, 'dismiss_overlay')).toHaveLength(2);
  await page.clock.runFor(200);
  await expect.poll(() => calls(page, 'dismiss_overlay')).toHaveLength(3);
  await page.clock.resume();
  await expect(page.locator('[data-ilot]')).toHaveCount(0);

  // Translate marks the whole new text as one block.
  await on(page, (f) =>
    f.settings({
      afterReplace: { check: true, undo: true, undoSeconds: 8, changedWords: true, changedWordsSeconds: 60 },
    }),
  );
  const text = 'Pourriez-vous envoyer la proposition ?',
    result = 'Could you send the proposal?';
  const requestId = await pasteThrough(page, 'block', { lastActionId: 'translate', text, result });
  await expect
    .poll(async () => (await calls(page, 'highlight_changes')).filter((args) => args.requestId === requestId))
    .toEqual([{ requestId, ranges: [{ start: 0, end: result.length }] }]);
});

test('a retried result the Îlot pasted itself has no Undo and no marks: the check alone', async ({ page }) => {
  await openIlot(page);
  await page.evaluate(() =>
    (window as unknown as { nativeFixture: Fixture }).nativeFixture.captureMenu(
      'retry',
      null,
      'Their going too the store',
    ),
  );
  await expect(stage(page)).toHaveAttribute('data-stage', 'menu');
  await page.keyboard.press('Enter');
  await expect(stage(page)).toHaveAttribute('data-stage', 'working');
  await on(page, (f) => f.error('busy'));
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(stage(page)).toHaveAttribute('data-stage', 'working');
  await on(page, (f) => f.done('They are going to the store'));
  await expect(stage(page)).toHaveAttribute('data-stage', 'done');
  await expect(page.locator('[data-result-content="done"]')).toHaveClass(/is-check-only/);
  await expect(undoButton(page)).toHaveCount(0);
  await expect.poll(() => calls(page, 'dismiss_overlay')).toHaveLength(1);
  expect(await calls(page, 'highlight_changes')).toHaveLength(0);
  expect(await calls(page, 'undo_result')).toHaveLength(0);
});
