import { test, expect, type Page } from '@playwright/test';
import { ilotRegion, ilotReserve } from '../src/layout';

// Lot 9: the pill's place after Rust's own paste (docs/BRIDGE.md « The pill's place », « Moving
// the window »), over the IPC fixture (e2e/native-fixture.ts), which places the Îlot's window and
// answers `result_pill` with Rust's own algorithm, ported (placement.rs: under the new text's last
// line, above it without room, in the margin; never over a line), relative to the window, and
// records each `move_overlay` with what the page showed then. The pill leaves the
// selection's old end for its place, never over the new text: in the DOM when the place is in the
// window (every frame in the region Rust holds), else the window moves once, at rest, the pill
// faded out. Synthetic texts and rectangles: a browser run, not the Windows window.
type Call = { command: string; args?: Record<string, unknown>; at: number };
type Box = { x: number; y: number; width: number; height: number };
type Region = Box & { radius: number };
type Geometry = {
  width: number;
  height: number;
  captureId: string;
  presentation: string;
  regions: Region[];
  frame: Region;
};
type Move = { dx: number; dy: number; at: number; opacity: string; shape: { width: number; height: number } | null };
type Fixture = {
  calls: Call[];
  moves: Move[];
  settings: (next: Record<string, unknown>) => Promise<void>;
  captureMenu: (id: string, lastActionId?: string | null, text?: string) => Promise<void>;
  unanchoredMenu: (id: string, lastActionId?: string | null) => Promise<void>;
  done: (text?: string) => Promise<void>;
  error: (code?: string, message?: string) => Promise<void>;
  pasted: (options?: { undoable?: boolean; pastedRects?: Box[] }) => Promise<void>;
  undoState: (reason?: string, requestId?: string) => Promise<void>;
  pillAnswer: (answer: Record<string, unknown> | 'refuse') => void;
  refuseMove: () => void;
  windowPosition: () => { x: number; y: number };
  windowAt: (x: number, y: number) => void;
  workAreaAt: (x: number, y: number, width: number, height: number) => void;
  undoWith: (outcome: Record<string, unknown>) => void;
  requestId: () => string;
};
const fixture = (page: Page) => ({
  run: <T>(run: (fixture: Fixture) => T | Promise<T>) =>
    page.evaluate(`(${run.toString()})(window.nativeFixture)`) as Promise<T>,
  with: <A, T>(run: (fixture: Fixture, arg: A) => T | Promise<T>, arg: A) =>
    page.evaluate(
      ({ source, arg }) =>
        new Function('fixture', 'arg', `return (${source})(fixture, arg)`)(
          (window as unknown as { nativeFixture: Fixture }).nativeFixture,
          arg,
        ),
      { source: run.toString(), arg },
    ) as Promise<T>,
});
const calls = (page: Page, command: string) =>
  page.evaluate(
    (name) =>
      (window as unknown as { nativeFixture: Fixture }).nativeFixture.calls
        .filter((call) => call.command === name)
        .map((call) => call.args ?? {}),
    command,
  );
const geometries = async (page: Page, captureId: string) =>
  ((await calls(page, 'resize_overlay')) as Geometry[]).filter((geometry) => geometry.captureId === captureId);
const moves = (page: Page) => fixture(page).run((f) => f.moves.map((move) => ({ ...move })));
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
const opacity = (page: Page) => page.locator('.ilot-corner').evaluate((element) => getComputedStyle(element).opacity);
const undoButton = (page: Page) => page.locator('.shape-layer:not(.is-leaving) .result-undo');
const inside = (shape: Box, region: Region) =>
  shape.x >= region.x - 1 &&
  shape.y >= region.y - 1 &&
  shape.x + shape.width <= region.x + region.width + 1 &&
  shape.y + shape.height <= region.y + region.height + 1;
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

async function openIlot(
  page: Page,
  settings: Record<string, unknown> = {},
  reducedMotion: 'reduce' | 'no-preference' = 'no-preference',
) {
  await page.emulateMedia({ reducedMotion });
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
// A menu capture chosen with Enter, the model's result, the work pill at rest on the Îlot's
// surface (tagged, to tell it is the same element later).
async function working(page: Page, id: string, anchored = true) {
  if (anchored)
    await page.evaluate(
      (id) =>
        (window as unknown as { nativeFixture: Fixture }).nativeFixture.captureMenu(
          id,
          null,
          'Their going too the store',
        ),
      id,
    );
  else
    await page.evaluate((id) => (window as unknown as { nativeFixture: Fixture }).nativeFixture.unanchoredMenu(id), id);
  await expect(stage(page)).toHaveAttribute('data-capture-id', id);
  await expect(stage(page)).toHaveAttribute('data-stage', 'menu');
  await page.locator('[data-ilot-shape]').evaluate((element) => {
    (element as HTMLElement & { tag?: string }).tag = 'surface';
  });
  await page.keyboard.press('Enter');
  await expect(stage(page)).toHaveAttribute('data-stage', 'working');
  await fixture(page).run((f) => f.done('They are going to the store'));
  await settled(page);
}
// Every frame for `ms` after `act`: the painted shape, the corner's opacity, the geometry Rust
// last received, on the page's clock.
type Frame = { t: number; shape: Box; opacity: number; geometry: Geometry };
async function follow(page: Page, captureId: string, act: () => Promise<unknown>, ms = 1400) {
  const frames = page.evaluate(
    ({ captureId, ms }) =>
      new Promise<Frame[]>((resolve) => {
        const out: Frame[] = [];
        const start = performance.now();
        const tick = () => {
          const element = document.querySelector('[data-ilot-shape]');
          const corner = document.querySelector('.ilot-corner');
          const shape = element?.getBoundingClientRect();
          const geometry = (window as unknown as { nativeFixture: Fixture }).nativeFixture.calls
            .filter((call) => call.command === 'resize_overlay' && call.args?.captureId === captureId)
            .at(-1)?.args as Geometry;
          if (shape && corner)
            out.push({
              t: performance.now(),
              shape: { x: shape.x, y: shape.y, width: shape.width, height: shape.height },
              opacity: Number(getComputedStyle(corner).opacity),
              geometry,
            });
          if (performance.now() - start < ms) requestAnimationFrame(tick);
          else resolve(out);
        };
        requestAnimationFrame(tick);
      }),
    { captureId, ms },
  );
  await act();
  return frames;
}
const paste = (page: Page, pastedRects: Box[]) =>
  fixture(page).with((f, rects) => f.pasted({ pastedRects: rects }), pastedRects);
test.describe.configure({ timeout: 45_000 });

const reserve = ilotReserve('anchored');
const cornerX = reserve.frame.x + reserve.frame.width;
// The fixture's window: Rust put it at (88, 222), the strip's corner on the selection's end (520, 318 + 8).
const origin = { x: 88, y: 222 };
const inWindow = (rect: Box) => ({ ...rect, x: rect.x - origin.x, y: rect.y - origin.y });

test('a longer text: the pill glides in the DOM to 8 px under the new text’s last line, its right edge on that line’s end, never over it; every frame in the region, the window never moves', async ({
  page,
}) => {
  await openIlot(page);
  await working(page, 'glide');
  const start = await box(page);
  expect(start.x + start.width).toBeCloseTo(cornerX, 0);
  // Two lines now, the last ending at x = 560, its bottom at y = 336.
  const lines = [
    { x: 300, y: 300, width: 420, height: 18 },
    { x: 300, y: 318, width: 260, height: 18 },
  ];
  const frames = await follow(page, 'glide', () => paste(page, lines));
  await expect(stage(page)).toHaveAttribute('data-stage', 'done');
  await settled(page);
  const pill = await box(page);
  const requestId = await fixture(page).run((f) => f.requestId());
  // Asked once, for the size of the check's pill.
  expect(await calls(page, 'result_pill')).toEqual([{ requestId, width: pill.width, height: pill.height }]);
  // At its place: right edge on 560 − 88, top 336 + 8 − 222; clear of every line of the new text.
  expect(pill.x + pill.width).toBeCloseTo(560 - origin.x, 0);
  expect(pill.y).toBeCloseTo(336 + 8 - origin.y, 0);
  for (const line of lines) expect(overlaps(pill, inWindow(line)), JSON.stringify(line)).toBe(false);
  expect((await geometries(page, 'glide')).at(-1)?.regions).toEqual([
    ilotRegion('anchored', 'below', { width: pill.width, height: pill.height, shift: 40, dy: 18 }),
  ]);
  // Every frame lies in the region Rust holds at that frame; the glide is seen on its way.
  expect(frames.length).toBeGreaterThan(20);
  for (const frame of frames) expect(inside(frame.shape, frame.geometry.regions[0]), JSON.stringify(frame)).toBe(true);
  expect(
    frames.filter(
      (frame) =>
        frame.shape.x + frame.shape.width > cornerX + 2 && frame.shape.x + frame.shape.width < 560 - origin.x - 2,
    ).length,
  ).toBeGreaterThan(3);
  expect(frames.every((frame) => frame.opacity === 1)).toBe(true);
  // The window stayed: no move, the same reserve and frame in every geometry; the same surface.
  expect(await moves(page)).toEqual([]);
  expect(await calls(page, 'move_overlay')).toEqual([]);
  for (const geometry of await geometries(page, 'glide'))
    expect(geometry).toMatchObject({ width: reserve.width, height: reserve.height, frame: reserve.frame });
  expect(await sameSurface(page)).toBe(true);

  // Undo withdrawn there: the check alone keeps that place's corner, frame after frame (it leaves
  // 1.1 s after the key: its shape at rest is the frames' last).
  const withdrawn = await follow(page, 'glide', () => fixture(page).run((f) => f.undoState('typed')), 900);
  const check = withdrawn.at(-1)!.shape;
  expect(Math.abs(withdrawn.at(-4)!.shape.width - check.width)).toBeLessThan(0.5);
  expect(check.width).toBeLessThan(pill.width);
  for (const frame of withdrawn) {
    expect(Math.abs(frame.shape.x + frame.shape.width - (pill.x + pill.width)), JSON.stringify(frame)).toBeLessThan(
      0.5,
    );
    expect(Math.abs(frame.shape.y - pill.y), JSON.stringify(frame)).toBeLessThan(0.5);
    expect(inside(frame.shape, frame.geometry.regions[0]), JSON.stringify(frame)).toBe(true);
  }
  expect(await calls(page, 'result_pill')).toHaveLength(1);
});

test('the check alone (no Undo) keeps the work pill’s size, and still goes to its place', async ({ page }) => {
  await openIlot(page);
  await working(page, 'check');
  const work = await box(page);
  const lines = [
    { x: 300, y: 300, width: 420, height: 18 },
    { x: 300, y: 318, width: 260, height: 18 },
  ];
  await fixture(page).with((f, rects) => f.pasted({ undoable: false, pastedRects: rects }), lines);
  await expect(stage(page)).toHaveAttribute('data-stage', 'done');
  await expect(page.locator('[data-result-content="done"]')).toHaveClass(/is-check-only/);
  await expect.poll(() => calls(page, 'result_pill')).toHaveLength(1);
  await settled(page);
  const pill = await box(page);
  expect({ width: pill.width, height: pill.height }).toEqual({ width: work.width, height: work.height });
  expect((await calls(page, 'result_pill'))[0]).toMatchObject({ width: work.width, height: work.height });
  expect(pill.x + pill.width).toBeCloseTo(560 - origin.x, 0);
  expect(pill.y).toBeCloseTo(336 + 8 - origin.y, 0);
  expect(await calls(page, 'move_overlay')).toEqual([]);
});

test('the pasted text not found: no Undo, and the place Rust estimates from the selection and the result’s length', async ({
  page,
}) => {
  await openIlot(page);
  await working(page, 'estimated');
  // 27 characters for 25 selected on one line: two lines, the text ending one line lower (318 to
  // 336) on the selection's end (520); the pill 8 px under it.
  await fixture(page).run((f) => f.pasted({ undoable: false, pastedRects: [] }));
  await expect(stage(page)).toHaveAttribute('data-stage', 'done');
  await expect(page.locator('[data-result-content="done"]')).toHaveClass(/is-check-only/);
  await expect.poll(() => calls(page, 'result_pill')).toHaveLength(1);
  await settled(page);
  const pill = await box(page);
  expect(pill.x + pill.width).toBeCloseTo(520 - origin.x, 0);
  expect(pill.y).toBeCloseTo(336 + 8 - origin.y, 0);
  expect(await calls(page, 'move_overlay')).toEqual([]);
});

test('a place outside the window: the pill fades out, the window moves once at rest, Rust answers again for it, and the pill fades back in there', async ({
  page,
}) => {
  await openIlot(page);
  await working(page, 'far');
  // Twelve lines: the last ends at x = 700, its bottom at y = 516: out of the 581 × 264 window.
  const lines = Array.from({ length: 12 }, (_, index) => ({ x: 100, y: 300 + 18 * index, width: 600, height: 18 }));
  const frames = await follow(page, 'far', () => paste(page, lines), 1800);
  await expect(stage(page)).toHaveAttribute('data-stage', 'done');
  await expect.poll(() => calls(page, 'result_pill')).toHaveLength(2);
  await settled(page);
  await expect.poll(() => opacity(page)).toBe('1');
  const pill = await box(page);
  const requestId = await fixture(page).run((f) => f.requestId());
  // The window moved by what puts the pill's corner on 700 and its top on 516 + 8.
  const dx = 700 - origin.x - cornerX,
    dy = 516 + 8 - origin.y - reserve.frame.y;
  expect(await calls(page, 'move_overlay')).toEqual([{ captureId: 'far', dx, dy }]);
  expect(await fixture(page).run((f) => f.windowPosition())).toEqual({ x: origin.x + dx, y: origin.y + dy });
  expect(await calls(page, 'result_pill')).toEqual([
    { requestId, width: pill.width, height: pill.height },
    { requestId, width: pill.width, height: pill.height },
  ]);
  // Never while anything moved: at that moment the pill was invisible and at rest, its shape final.
  const [move] = await moves(page);
  expect(move.opacity).toBe('0');
  expect(move.shape).toEqual({ width: pill.width, height: pill.height });
  const changing = frames.filter(
    (frame, index) =>
      index > 0 &&
      (Math.abs(frame.shape.width - frames[index - 1].shape.width) > 0.01 ||
        Math.abs(frame.shape.x - frames[index - 1].shape.x) > 0.01),
  );
  expect(changing.length).toBeGreaterThan(3);
  expect(Math.max(...changing.map((frame) => frame.t))).toBeLessThan(move.at);
  // In the DOM the pill never left the strip's corner: the window carried it. It faded out and in.
  for (const frame of frames) {
    expect(Math.abs(frame.shape.x + frame.shape.width - cornerX), JSON.stringify(frame)).toBeLessThan(0.5);
    expect(inside(frame.shape, frame.geometry.regions[0]), JSON.stringify(frame)).toBe(true);
  }
  expect(frames.some((frame) => frame.opacity < 0.05)).toBe(true);
  expect(frames.at(-1)?.opacity).toBe(1);
  expect(pill.x + pill.width).toBeCloseTo(cornerX, 0);
  expect(pill.y).toBeCloseTo(reserve.frame.y, 0);
  expect((await geometries(page, 'far')).at(-1)?.regions).toEqual([
    ilotRegion('anchored', 'below', { width: pill.width, height: pill.height }),
  ]);
  expect(await sameSurface(page)).toBe(true);
  // Undo still there, on the moved window.
  await expect(page.locator('.shape-layer:not(.is-leaving) .result-undo')).toBeVisible();
});

test('in the margin the pill keeps its left edge beside the text: a narrower shape shrinks away from the text', async ({
  page,
}) => {
  await openIlot(page, { pillPlacement: 'margin' });
  await working(page, 'margin');
  // The widest line ends at x = 420: the pill's left edge at 428, centred on the last line (318
  // to 336).
  const lines = [
    { x: 200, y: 300, width: 220, height: 18 },
    { x: 200, y: 318, width: 150, height: 18 },
  ];
  await paste(page, lines);
  await expect(stage(page)).toHaveAttribute('data-stage', 'done');
  await settled(page);
  const pill = await box(page);
  expect(pill.x).toBeCloseTo(428 - origin.x, 0);
  expect(pill.y).toBeCloseTo(318 + (18 - pill.height) / 2 - origin.y, 0);
  for (const line of lines) expect(overlaps(pill, inWindow(line)), JSON.stringify(line)).toBe(false);
  expect(await calls(page, 'move_overlay')).toEqual([]);
  const withdrawn = await follow(page, 'margin', () => fixture(page).run((f) => f.undoState('typed')), 900);
  const check = withdrawn.at(-1)!.shape;
  expect(Math.abs(withdrawn.at(-4)!.shape.width - check.width)).toBeLessThan(0.5);
  expect(check.width).toBeLessThan(pill.width);
  expect(check.x).toBeCloseTo(pill.x, 0);
  for (const frame of withdrawn) {
    expect(Math.abs(frame.shape.x - pill.x), JSON.stringify(frame)).toBeLessThan(1);
    expect(inside(frame.shape, frame.geometry.regions[0]), JSON.stringify(frame)).toBe(true);
  }
});

// The pasted lines in the window's coordinates at a frame's time: the window moved at `moved.at`
// by (dx, dy), if it moved.
const linesAt = (lines: Box[], window: { x: number; y: number }, frame: Frame, moved?: Move) =>
  lines.map((line) => ({
    ...line,
    x: line.x - window.x - (moved && frame.t >= moved.at ? moved.dx : 0),
    y: line.y - window.y - (moved && frame.t >= moved.at ? moved.dy : 0),
  }));

test('the Îlot above the selection, the place under the new text: the pill never sweeps over the text; out of sight it takes its place at once', async ({
  page,
}) => {
  // A selection near the bottom of the work area (220 px do not fit under it): Rust opens the
  // Îlot above it, the strip 8 px over the selection, the window at (88, 156); under the new text
  // there is still room for the pill.
  await openIlot(page);
  await fixture(page).run((f) => f.workAreaAt(0, 0, 1920, 500));
  await working(page, 'over');
  await expect(stage(page)).toHaveAttribute('data-side', 'above');
  const window = { x: 88, y: 156 };
  expect(await fixture(page).run((f) => f.windowPosition())).toEqual(window);
  const lines = [
    { x: 300, y: 300, width: 420, height: 18 },
    { x: 300, y: 318, width: 260, height: 18 },
  ];
  const frames = await follow(page, 'over', () => paste(page, lines), 1400);
  await expect(stage(page)).toHaveAttribute('data-stage', 'done');
  await settled(page);
  await expect.poll(() => opacity(page)).toBe('1');
  const pill = await box(page);
  // Under the new text: right edge on the last line's end (560), top 8 px under it (344).
  expect(pill.x + pill.width).toBeCloseTo(560 - window.x, 0);
  expect(pill.y).toBeCloseTo(344 - window.y, 0);
  // No visible frame over a line of the new text; the pill was out of sight between its places,
  // never at a position between them; every frame in the region Rust holds.
  for (const frame of frames) {
    if (frame.opacity > 0.05)
      for (const line of linesAt(lines, window, frame))
        expect(overlaps(frame.shape, line), JSON.stringify(frame)).toBe(false);
    const right = frame.shape.x + frame.shape.width;
    expect(Math.abs(right - cornerX) < 0.5 || Math.abs(right - (560 - window.x)) < 0.5, JSON.stringify(frame)).toBe(
      true,
    );
    expect(inside(frame.shape, frame.geometry.regions[0]), JSON.stringify(frame)).toBe(true);
  }
  expect(frames.some((frame) => frame.opacity < 0.05)).toBe(true);
  expect(frames.at(-1)?.opacity).toBe(1);
  expect(await calls(page, 'move_overlay')).toEqual([]);
  expect(await sameSurface(page)).toBe(true);
});

test('no room under the new text: the pill goes above its first line, its right edge on the end of the line the text ends on', async ({
  page,
}) => {
  // The work area ends at y = 360: Rust opens the Îlot above the selection (the window at
  // (88, 156)), and puts the pill above the new text, 8 px over its first line (300), its right
  // edge on the end of the last line (560), not of the first (720).
  await openIlot(page);
  await fixture(page).run((f) => f.workAreaAt(0, 0, 1920, 360));
  await working(page, 'up');
  await expect(stage(page)).toHaveAttribute('data-side', 'above');
  const window = await fixture(page).run((f) => f.windowPosition());
  expect(window).toEqual({ x: 88, y: 156 });
  const lines = [
    { x: 300, y: 300, width: 420, height: 18 },
    { x: 300, y: 318, width: 260, height: 18 },
  ];
  const frames = await follow(page, 'up', () => paste(page, lines), 1200);
  await expect(stage(page)).toHaveAttribute('data-stage', 'done');
  await settled(page);
  const pill = await box(page);
  expect(pill.x + pill.width + window.x).toBeCloseTo(560, 0);
  expect(pill.y + pill.height + window.y).toBeCloseTo(292, 0);
  // Above then above: a glide in the window, never over a line, every frame in the region.
  for (const frame of frames) {
    for (const line of linesAt(lines, window, frame))
      expect(overlaps(frame.shape, line), JSON.stringify(frame)).toBe(false);
    expect(inside(frame.shape, frame.geometry.regions[0]), JSON.stringify(frame)).toBe(true);
  }
  expect(frames.every((frame) => frame.opacity === 1)).toBe(true);
  expect(await calls(page, 'move_overlay')).toEqual([]);
});

test('in the margin without room on the right of the text, the pill goes under it instead: never squeezed over it', async ({
  page,
}) => {
  await openIlot(page, { pillPlacement: 'margin' });
  await working(page, 'squeezed');
  // Lines ending at x = 1860, 60 px from the work area's right edge: no room beside them for the
  // pill, so Rust puts it under the last line, its right edge on 1860, its top at 344.
  const lines = [
    { x: 300, y: 300, width: 1560, height: 18 },
    { x: 300, y: 318, width: 1560, height: 18 },
  ];
  const frames = await follow(page, 'squeezed', () => paste(page, lines), 1800);
  await expect.poll(() => moves(page)).toHaveLength(1);
  await expect.poll(() => opacity(page)).toBe('1');
  await settled(page);
  const pill = await box(page);
  const window = await fixture(page).run((f) => f.windowPosition());
  expect(pill.x + pill.width + window.x).toBeCloseTo(1860, 0);
  expect(pill.y + window.y).toBeCloseTo(344, 0);
  for (const line of lines)
    expect(overlaps({ ...pill, x: pill.x + window.x, y: pill.y + window.y }, line), JSON.stringify(line)).toBe(false);
  // From Rust's answer on, never visible over a line of the text.
  const [answered] = await fixture(page).run((f) =>
    f.calls.filter((call) => call.command === 'result_pill').map((call) => call.at),
  );
  const [move] = await moves(page);
  for (const frame of frames.filter((frame) => frame.t > answered + 170 + 50)) {
    if (frame.opacity <= 0.05) continue;
    for (const line of linesAt(lines, origin, frame, move))
      expect(overlaps(frame.shape, line), JSON.stringify(frame)).toBe(false);
  }
});

test('a place outside the window: the pill fades out as soon as Rust answers, not once its shape rests, and is never seen over the new text after that', async ({
  page,
}) => {
  await openIlot(page);
  await working(page, 'fade');
  // Twelve lines: the new text runs over the pill's first place (that much comes before any answer).
  const lines = Array.from({ length: 12 }, (_, index) => ({ x: 100, y: 300 + 18 * index, width: 600, height: 18 }));
  const frames = await follow(page, 'fade', () => paste(page, lines), 1800);
  await expect.poll(() => calls(page, 'result_pill')).toHaveLength(2);
  await expect.poll(() => opacity(page)).toBe('1');
  const answered = (
    await fixture(page).run((f) => f.calls.filter((call) => call.command === 'result_pill').map((call) => call.at))
  )[0];
  const [move] = await moves(page);
  // From Rust's answer, the exit fade (170 ms) and a frame: never visible over a line again.
  const late = frames.filter((frame) => frame.t > answered + 170 + 50);
  expect(late.length).toBeGreaterThan(20);
  for (const frame of late) {
    if (frame.opacity <= 0.05) continue;
    for (const line of linesAt(lines, origin, frame, move))
      expect(overlaps(frame.shape, line), JSON.stringify(frame)).toBe(false);
  }
  // It faded out while its shape still sprang: out of sight before the surface rested.
  const final = frames.at(-1)!.shape;
  expect(frames.some((frame) => frame.opacity < 0.05 && Math.abs(frame.shape.width - final.width) > 1)).toBe(true);
  // The window still moved at rest only, the pill invisible.
  expect(move.opacity).toBe('0');
  expect(move.shape).toEqual({ width: final.width, height: final.height });
});

test('a place in the window but too close to its edge for the shadow: the window moves instead, the shadow keeps its room', async ({
  page,
}) => {
  await openIlot(page);
  await working(page, 'edge');
  // Seven lines: the last ends at x = 560, its bottom at 426, the pill's top at 434: 212 in the
  // window, its bottom within 264 but past 220 (the 44 px of shadow below).
  const lines = Array.from({ length: 7 }, (_, index) => ({
    x: 300,
    y: 300 + 18 * index,
    width: index === 6 ? 260 : 420,
    height: 18,
  }));
  await paste(page, lines);
  await expect(stage(page)).toHaveAttribute('data-stage', 'done');
  await expect.poll(() => calls(page, 'move_overlay')).toHaveLength(1);
  await expect.poll(() => opacity(page)).toBe('1');
  await settled(page);
  const pill = await box(page);
  const window = await fixture(page).run((f) => f.windowPosition());
  expect(pill.x + pill.width + window.x).toBeCloseTo(560, 0);
  expect(pill.y + window.y).toBeCloseTo(434, 0);
  // In the moved window, the shadow's room on every side (32 px on the sides, 20 above, 44 below).
  expect(pill.x).toBeGreaterThanOrEqual(32);
  expect(pill.y).toBeGreaterThanOrEqual(20);
  expect(pill.x + pill.width).toBeLessThanOrEqual(reserve.width - 32);
  expect(pill.y + pill.height).toBeLessThanOrEqual(reserve.height - 44);
});

test('in the margin, a wider shape after the check (an Undo refused) is placed again for its size: never pushed over the text, its ✕ in the work area', async ({
  page,
}) => {
  await openIlot(page, { pillPlacement: 'margin' });
  await working(page, 'wider');
  // The widest line ends at x = 470: the pill's left edge at 478, 390 in the window.
  const lines = [
    { x: 250, y: 300, width: 220, height: 18 },
    { x: 250, y: 318, width: 150, height: 18 },
  ];
  await paste(page, lines);
  await expect(stage(page)).toHaveAttribute('data-stage', 'done');
  await expect.poll(() => opacity(page)).toBe('1');
  await settled(page);
  const check = await box(page);
  expect(check.x).toBeCloseTo(478 - origin.x, 0);
  const requestId = await fixture(page).run((f) => f.requestId());
  await fixture(page).run((f) =>
    f.undoWith({ status: 'refused', confirmed: false, message: 'Le texte a changé.', code: 'target_changed' }),
  );
  const frames = await follow(
    page,
    'wider',
    () => page.locator('.shape-layer:not(.is-leaving) .result-undo').click(),
    2000,
  );
  await expect(stage(page)).toHaveAttribute('data-stage', 'error');
  await expect.poll(() => opacity(page)).toBe('1');
  await settled(page);
  const error = await box(page);
  expect(error.width).toBeGreaterThan(check.width + 60);
  // Asked again for the error pill's size (once more after the window moved for it).
  const asked = await calls(page, 'result_pill');
  expect(asked[0]).toEqual({ requestId, width: check.width, height: check.height });
  expect(asked.slice(1).every((args) => args.width === error.width)).toBe(true);
  expect(asked.length).toBeGreaterThanOrEqual(2);
  // Never a visible frame over the text, whether the window moved or not; its left edge kept
  // (while it fades out before the move the window may cut its right end: the region holds the
  // part the window shows).
  const [move] = await moves(page);
  const shown = (shape: Box) => {
    const x = Math.max(0, shape.x),
      y = Math.max(0, shape.y);
    return {
      x,
      y,
      width: Math.min(reserve.width, shape.x + shape.width) - x,
      height: Math.min(reserve.height, shape.y + shape.height) - y,
    };
  };
  for (const frame of frames) {
    if (frame.opacity > 0.05)
      for (const line of linesAt(lines, origin, frame, move))
        expect(overlaps(frame.shape, line), JSON.stringify(frame)).toBe(false);
    if (frame.opacity > 0.05)
      expect(
        frame.shape.x >= -0.5 &&
          frame.shape.y >= -0.5 &&
          frame.shape.x + frame.shape.width <= reserve.width + 0.5 &&
          frame.shape.y + frame.shape.height <= reserve.height + 0.5,
        JSON.stringify(frame),
      ).toBe(true);
    expect(inside(shown(frame.shape), frame.geometry.regions[0]), JSON.stringify(frame)).toBe(true);
  }
  const window = await fixture(page).run((f) => f.windowPosition());
  expect(error.x + window.x).toBeCloseTo(478, 0);
  // The ✕ inside the work area (1920 wide), the shadow's room in the window.
  const close = await page.getByRole('button', { name: 'Close' }).evaluate((element) => {
    const r = element.getBoundingClientRect();
    return { x: r.x, width: r.width };
  });
  expect(close.x + close.width + window.x).toBeLessThanOrEqual(1920);
  expect(error.x + error.width).toBeLessThanOrEqual(reserve.width - 32);
});

test('« Undone » goes back to the strip’s corner, against the original text; once the window moved, the Îlot leaves without it', async ({
  page,
}) => {
  await openIlot(page);
  await working(page, 'back');
  const lines = [
    { x: 300, y: 300, width: 420, height: 18 },
    { x: 300, y: 318, width: 260, height: 18 },
  ];
  await paste(page, lines);
  await expect(stage(page)).toHaveAttribute('data-stage', 'done');
  await settled(page);
  const placed = await box(page);
  expect(placed.x + placed.width).toBeCloseTo(560 - origin.x, 0);
  const frames = await follow(
    page,
    'back',
    () => page.locator('.shape-layer:not(.is-leaving) .result-undo').click(),
    800,
  );
  await expect(stage(page)).toHaveAttribute('data-stage', 'undone');
  // At rest at the strip's corner (its right edge on the selection's end, its top 8 px under it).
  const last = frames.at(-1)!;
  expect(Math.abs(frames.at(-4)!.shape.x - last.shape.x)).toBeLessThan(0.5);
  expect(last.shape.x + last.shape.width).toBeCloseTo(cornerX, 0);
  expect(last.shape.y).toBeCloseTo(reserve.frame.y, 0);
  for (const frame of frames) expect(inside(frame.shape, frame.geometry.regions[0]), JSON.stringify(frame)).toBe(true);
  await expect.poll(() => calls(page, 'dismiss_overlay')).toHaveLength(1);
  await expect(page.locator('[data-ilot]')).toHaveCount(0);

  // The window moved for the pill's place: the strip's corner is no longer by the original text.
  await working(page, 'moved');
  await paste(
    page,
    Array.from({ length: 12 }, (_, index) => ({ x: 100, y: 300 + 18 * index, width: 600, height: 18 })),
  );
  await expect.poll(() => moves(page)).toHaveLength(1);
  await expect.poll(() => opacity(page)).toBe('1');
  await page.evaluate(() => {
    const seen = window as unknown as { sawUndone?: boolean };
    seen.sawUndone = false;
    new MutationObserver(() => {
      if (document.querySelector('[data-result-content="undone"]')) seen.sawUndone = true;
    }).observe(document.body, { subtree: true, childList: true });
  });
  await page.locator('.shape-layer:not(.is-leaving) .result-undo').click();
  await expect.poll(() => calls(page, 'dismiss_overlay')).toHaveLength(2);
  await expect(page.locator('[data-ilot]')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { sawUndone?: boolean }).sawUndone)).toBe(false);
  expect(await calls(page, 'undo_result')).toHaveLength(2);
});

test('the time stands still while the pill is out of sight: a 2 s Undo still has its 2 s once the pill is back', async ({
  page,
}) => {
  await openIlot(page, {
    afterReplace: { check: true, undo: true, undoSeconds: 2, changedWords: true, changedWordsSeconds: 60 },
  });
  await page.mouse.move(2, 2);
  await working(page, 'time');
  await paste(
    page,
    Array.from({ length: 12 }, (_, index) => ({ x: 100, y: 300 + 18 * index, width: 600, height: 18 })),
  );
  // Out of sight, the ring stands still.
  await expect(page.locator('.shape-layer:not(.is-leaving) .result-row')).toHaveAttribute('data-paused', 'true');
  await expect.poll(() => moves(page)).toHaveLength(1);
  await expect.poll(() => opacity(page)).toBe('1');
  const back = await page.evaluate(() => performance.now());
  await expect(page.locator('.shape-layer:not(.is-leaving) .result-row')).not.toHaveAttribute('data-paused', 'true');
  await expect.poll(() => calls(page, 'dismiss_overlay'), { timeout: 5000 }).toHaveLength(1);
  const [left] = await fixture(page).run((f) =>
    f.calls.filter((call) => call.command === 'dismiss_overlay').map((call) => call.at),
  );
  // Back in sight, it stays its 2 s (less the fade in, 200 ms), not what the move left of them.
  expect(left - back).toBeGreaterThan(1600);
});

test('Undo withdrawn on the pill’s way to the margin: it never sweeps over the text, the check alone lands at the margin’s left edge, every frame in the region', async ({
  page,
}) => {
  await openIlot(page, { pillPlacement: 'margin' });
  await working(page, 'hop');
  // Two lines ending at x = 529, the last one right above the strip (300 to 318): the margin's
  // left edge at 537, up and to the right of the pill; a straight way there crosses the text.
  const lines = [
    { x: 300, y: 282, width: 229, height: 18 },
    { x: 300, y: 300, width: 229, height: 18 },
  ];
  const frames = await follow(
    page,
    'hop',
    async () => {
      await paste(page, lines);
      await fixture(page).run((f) => f.undoState('typed'));
    },
    1000,
  );
  await expect(undoButton(page)).toHaveCount(0);
  const last = frames.at(-1)!;
  expect(Math.abs(frames.at(-4)!.shape.width - last.shape.width)).toBeLessThan(0.5);
  expect(last.opacity).toBe(1);
  // Where the window stands now (the check and Undo, wider, did not fit in it with its shadow:
  // it moved), the check alone's left edge on the margin's.
  const window = await fixture(page).run((f) => f.windowPosition());
  expect(last.shape.x + window.x).toBeCloseTo(537, 0);
  const [move] = await moves(page);
  for (const frame of frames) {
    if (frame.opacity > 0.05)
      for (const line of linesAt(lines, origin, frame, move))
        expect(overlaps(frame.shape, line), JSON.stringify(frame)).toBe(false);
    expect(inside(frame.shape, frame.geometry.regions[0]), JSON.stringify(frame)).toBe(true);
  }
  // Its region at rest: the check alone at its place.
  expect((await geometries(page, 'hop')).at(-1)?.regions).toEqual([
    ilotRegion('anchored', 'below', {
      width: last.shape.width,
      height: last.shape.height,
      shift: Math.round(last.shape.x + last.shape.width - cornerX),
      dy: Math.round(last.shape.y - reserve.frame.y),
    }),
  ]);
});

test('the pill stays where it is when Rust refuses its place or the window’s move; a retried paste and a bottom Îlot never ask', async ({
  page,
}) => {
  await openIlot(page);
  // result_pill refused (a stale request): no move at all.
  await working(page, 'refused');
  await fixture(page).run((f) => f.pillAnswer('refuse'));
  await paste(page, [{ x: 300, y: 318, width: 260, height: 18 }]);
  await expect(stage(page)).toHaveAttribute('data-stage', 'done');
  await expect.poll(() => calls(page, 'result_pill')).toHaveLength(1);
  await settled(page);
  let pill = await box(page);
  expect(pill.x + pill.width).toBeCloseTo(cornerX, 0);
  expect(pill.y).toBeCloseTo(reserve.frame.y, 0);
  expect(await calls(page, 'move_overlay')).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-ilot]')).toHaveCount(0);

  // move_overlay refused: the pill fades back in where it was, asked once.
  await working(page, 'unmoved');
  await fixture(page).run((f) => f.refuseMove());
  await paste(
    page,
    Array.from({ length: 12 }, (_, index) => ({ x: 100, y: 300 + 18 * index, width: 600, height: 18 })),
  );
  await expect.poll(() => moves(page)).toHaveLength(1);
  await expect.poll(() => opacity(page)).toBe('1');
  await settled(page);
  pill = await box(page);
  expect(pill.x + pill.width).toBeCloseTo(cornerX, 0);
  expect(pill.y).toBeCloseTo(reserve.frame.y, 0);
  expect(await calls(page, 'result_pill')).toHaveLength(2);
  expect(await fixture(page).run((f) => f.windowPosition())).toEqual(origin);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-ilot]')).toHaveCount(0);

  // A result the Îlot pasted itself (Try again): no new place.
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
  await fixture(page).run((f) => f.error('busy'));
  await page.getByRole('button', { name: 'Try again' }).click();
  await fixture(page).run((f) => f.done('They are going to the store'));
  await expect(stage(page)).toHaveAttribute('data-stage', 'done');
  await page.waitForTimeout(300);
  expect(await calls(page, 'result_pill')).toHaveLength(2);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-ilot]')).toHaveCount(0);

  // Without an anchor the Îlot stays docked at the bottom.
  await working(page, 'docked', false);
  await paste(page, [{ x: 300, y: 318, width: 260, height: 18 }]);
  await expect(stage(page)).toHaveAttribute('data-stage', 'done');
  await page.waitForTimeout(300);
  expect(await calls(page, 'result_pill')).toHaveLength(2);
  expect(await calls(page, 'move_overlay')).toHaveLength(1);
});

test('reduced motion: the pill takes its place at once, no glide', async ({ page }) => {
  await openIlot(page, {}, 'reduce');
  await working(page, 'still');
  const lines = [
    { x: 300, y: 300, width: 420, height: 18 },
    { x: 300, y: 318, width: 260, height: 18 },
  ];
  const frames = await follow(page, 'still', () => paste(page, lines), 700);
  await expect(stage(page)).toHaveAttribute('data-stage', 'done');
  await settled(page);
  const pill = await box(page);
  expect(pill.x + pill.width).toBeCloseTo(560 - origin.x, 0);
  expect(pill.y).toBeCloseTo(336 + 8 - origin.y, 0);
  // Only its two places, never a position between them.
  for (const frame of frames) {
    const right = frame.shape.x + frame.shape.width;
    expect(Math.abs(right - cornerX) < 0.5 || Math.abs(right - (560 - origin.x)) < 0.5, JSON.stringify(frame)).toBe(
      true,
    );
    expect(inside(frame.shape, frame.geometry.regions[0]), JSON.stringify(frame)).toBe(true);
  }
  expect(await calls(page, 'move_overlay')).toEqual([]);
});
