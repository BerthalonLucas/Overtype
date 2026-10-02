// Tests the web content in an explicitly started Overtype demo process.
// A WebView screenshot is not evidence of Windows backdrop/focus/hit-testing;
// the HWND inspection below is evidence of the frameless silhouette only.
// Two journeys (lot 14): the direct bubble of --demo-selection (the « show the result » mode and
// the long translation of the Îlot), then the Îlot of a menu capture (the 0.5.0 path: compact,
// grid, work with the halo window, outcome pill, close), opened on the same demo selection by the
// probe-only `demo_menu_capture` (src-tauri/src/demo_menu.rs). No key is ever sent anywhere; the
// probe's clicks go through the DevTools protocol into our own page.
import { chromium, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const endpoint = process.env.FLOWTRANSLATE_CDP_URL ?? 'http://127.0.0.1:9227';
const host = new URL(endpoint);
if (!['127.0.0.1', 'localhost'].includes(host.hostname)) throw Error('Local test endpoint required');
const output = resolve(process.argv[2] ?? 'release/native-ui-probe');
await mkdir(output, { recursive: true });
const browser = await chromium.connectOverCDP(endpoint);
const report = { status: 'running', cycles: [], ilot: [], notChecked: ['desktop composition of the anti-aliased edges and shadows', 'foreground focus (the Îlot records what focus_overlay answered, never asserts it)', 'monitor DPI', 'animation frame times', 'real selection capture', 'the check after a real paste (the demo capture has no writable target: its menu ends on the not_editable pill)', 'real clicks on the Îlot (the probe clicks through the DevTools protocol; the real cursor only hovers)'] };
const chromeStyles = ['CAPTION', 'THICKFRAME', 'SYSMENU', 'MINIMIZEBOX', 'MAXIMIZEBOX'];
// Screen pixels sampled in the top band may drift by a hair (composition, cursor shadow);
// the title band Windows used to paint moves them by dozens of levels.
const FRAME_SILENT_TOLERANCE = 2;
// Top-level HWNDs of the test process: physical geometry, region box, caption and pass-through styles.
const probeArgs = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', resolve(dirname(fileURLToPath(import.meta.url)), 'inspect-native-windows.ps1')];
const inspectNative = () => {
  const args = [...probeArgs];
  if (process.env.FLOWTRANSLATE_TEST_PID) args.push('-ProcessId', process.env.FLOWTRANSLATE_TEST_PID);
  return JSON.parse(execFileSync('powershell', args, { encoding: 'utf8' }));
};
// Moves the real cursor, lets the hit tester react (8 ms poll, 40 ms wait) and reports the window under it.
const hitTest = (x, y) => JSON.parse(execFileSync('powershell', [...probeArgs, '-MoveCursor', `${x},${y}`, '-HitTest', `${x},${y}`], { encoding: 'utf8' }));
// A locked session (LogonUI) neither moves nor reports the real cursor: the probe then feeds the
// hit tester through the test-only `override_cursor` command and says so in the report.
const sessionLocked = () => { const check = hitTest(700, 700); return check.cursor.x !== 700 || check.cursor.y !== 700; };
// Sends WM_NCACTIVATE(FALSE, 0) to the HWND (scenario L of release/ui-evidence/band-repro) and
// compares the screen under its top band before and after: since 0.1.7 the subclass keeps
// DefWindowProc from painting a title band there.
// quiet: the same two captures without any message, a control for what moves behind the window.
// save: false keeps both captures in memory only (the Îlot's top band is the desktop behind it).
const poke = (hwnd, quiet = false, save = true) => JSON.parse(execFileSync('powershell', [...probeArgs, '-Poke', String(parseInt(hwnd, 16)), ...(save ? ['-Out', output] : []), ...(quiet ? ['-Quiet'] : [])], { encoding: 'utf8' }));
// The demo selection's two lines (src-tauri/src/capture.rs, physical pixels): the halo covers them.
const demoLines = { left: 640, top: 396, right: 1000, bottom: 444 };
try {
  const overlayTargets = () => browser.contexts().flatMap(context => context.pages()).filter(page => /tauri\.localhost/.test(page.url()) && new URL(page.url()).searchParams.get('window') === 'overlay');
  await expect.poll(() => overlayTargets().length, { timeout: 10000, message: 'Expected exactly one packaged Overtype overlay' }).toBe(1);
  const targets = overlayTargets();
  const page = targets[0];
  // Refuse to capture an arbitrary live translation: the launcher must start an explicit demo.
  // The demo sentence follows the persisted target language (FR by default, EN once Lucas switched).
  const demoSentence = /^(Pourriez-vous envoyer la proposition mise à jour avant jeudi \?|Could you send the updated proposal before Thursday\?)$/;
  await expect(page.locator('.translation-text')).toHaveText(demoSentence, { timeout: 15000 });
  await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toBeEnabled();
  const info = await page.evaluate(() => ({ userAgent: navigator.userAgent, devicePixelRatio, viewport: { width: innerWidth, height: innerHeight }, nativeBridge: '__TAURI_INTERNALS__' in window, theme: document.documentElement.dataset.theme ?? null, motion: document.documentElement.dataset.motion ?? null }));
  Object.assign(report, info);
  const invoke = (command, args) => page.evaluate(([command, args]) => window.__TAURI_INTERNALS__.invoke(command, args), [command, args]);
  const nativeVisible = label => invoke('plugin:window|is_visible', { label });
  const locked = sessionLocked();
  report.cursorSource = locked ? 'override_cursor (session locked: SetCursorPos and GetCursorPos inert)' : 'real cursor (SetCursorPos)';
  // What lies under a point, without the title of another application's window (a page title,
  // a document name): the report keeps its handle and whether it is ours.
  const testPid = Number(process.env.FLOWTRANSLATE_TEST_PID);
  const scrub = hit => ({ x: hit.x, y: hit.y, root: { hwnd: hit.root.hwnd, ours: hit.root.pid === testPid } });
  const pointCursor = async (x, y) => {
    if (!locked) return scrub(hitTest(x, y));
    await invoke('override_cursor', { x, y });
    await page.waitForTimeout(60);
    return scrub(JSON.parse(execFileSync('powershell', [...probeArgs, '-HitTest', `${x},${y}`], { encoding: 'utf8' })));
  };
  const nativeSize = () => invoke('plugin:window|outer_size', { label: 'overlay' });
  // A window's rectangle as Tao reads it (GetWindowRect, physical), matched with the HWND list.
  const nativeRect = async label => {
    const [position, size] = await Promise.all([invoke('plugin:window|outer_position', { label }), invoke('plugin:window|outer_size', { label })]);
    return { x: position.x, y: position.y, width: size.width, height: size.height };
  };
  const hwndOf = async label => {
    const rect = await nativeRect(label);
    const found = inspectNative().filter(w => w.x === rect.x && w.y === rect.y && w.width === rect.width && w.height === rect.height);
    expect(found.length, `one HWND at the ${label} window's rectangle ${JSON.stringify(rect)}`).toBe(1);
    return found[0];
  };
  const exStylesOf = hwnd => inspectNative().find(w => w.hwnd === hwnd).exStyles;
  // The rectangles Tao reports for the overlay while something animates: the reserved window of
  // the Îlot never moves nor resizes while its surface springs (only the regions change).
  const watchOverlay = ms => page.evaluate(async ms => {
    const invoke = window.__TAURI_INTERNALS__.invoke;
    const seen = new Set();
    const end = performance.now() + ms;
    while (performance.now() < end) {
      const [p, s] = await Promise.all([invoke('plugin:window|outer_position', { label: 'overlay' }), invoke('plugin:window|outer_size', { label: 'overlay' })]);
      seen.add(`${p.x},${p.y},${s.width}x${s.height}`);
      await new Promise(done => setTimeout(done, 8));
    }
    return [...seen];
  }, ms);
  // A surface's box once its spring has settled (two equal reads 120 ms apart).
  const settledBox = async locator => {
    let previous = null;
    const deadline = Date.now() + 4000;
    for (;;) {
      const box = await locator.boundingBox();
      if (box && previous && ['x', 'y', 'width', 'height'].every(key => Math.abs(box[key] - previous[key]) < 0.5)) {
        // The region of a change is published at the spring's end: one more beat for its IPC.
        await page.waitForTimeout(150);
        return box;
      }
      if (Date.now() > deadline) throw Error(`the surface never settled (${JSON.stringify(box)})`);
      previous = box;
      await page.waitForTimeout(120);
    }
  };
  const dprNow = () => page.evaluate(() => devicePixelRatio);
  const toScreen = (win, dpr, x, y) => ({ x: Math.round(win.x + x * dpr), y: Math.round(win.y + y * dpr) });
  // The visible overlay HWND must stay frameless (no DWM title) and carry no region: the
  // silhouette is Chromium's, and the pass-through styles follow the real cursor.
  const expectFrameless = async step => {
    const size = await nativeSize();
    const windows = inspectNative();
    const overlay = windows.find(w => w.visible && w.width === size.width && w.height === size.height);
    expect(overlay, `${step}: visible overlay HWND of ${size.width}×${size.height}`).toBeTruthy();
    expect(overlay.styles.filter(style => chromeStyles.includes(style)), `${step}: caption styles`).toEqual([]);
    expect(overlay.region, `${step}: window region`).toBeNull();
    // A direct capture lowers the no-activate bit a menu choice raised (docs/BRIDGE.md, Îlot lot 3).
    expect(overlay.noActivate, `${step}: the bubble stays activatable`).toBe(false);
    const dpr = await dprNow();
    const glass = await page.locator('.translation-bubble').boundingBox();
    const inside = await pointCursor(Math.round(overlay.x + (glass.x + glass.width / 2) * dpr), Math.round(overlay.y + (glass.y + glass.height / 2) * dpr));
    expect(inside.root.hwnd, `${step}: the glass takes the cursor`).toBe(overlay.hwnd);
    expect(exStylesOf(overlay.hwnd), `${step}: pass-through cleared on the glass`).toEqual([]);
    const halo = await pointCursor(overlay.x + 2, overlay.y + 2);
    expect(halo.root.hwnd, `${step}: the halo lets the cursor through`).not.toBe(overlay.hwnd);
    expect(exStylesOf(overlay.hwnd), `${step}: pass-through set in the halo`).toEqual(['TRANSPARENT', 'LAYERED']);
    return { ...overlay, inside, halo };
  };
  // The halo window (lot 6) only shows while an action works, never after its response.
  const expectHaloGone = async step => {
    await expect.poll(() => nativeVisible('halo'), { message: `${step}: halo window hidden` }).toBe(false);
  };

  // --- The bubble: a direct capture of the demo selection (the glass, its menu, its close).
  const bubbleCycle = async (index, first) => {
    if (index > 0) await invoke('capture_text');
    await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toBeEnabled({ timeout: 15000 });
    await expect(page.locator('.translation-text')).toHaveText(demoSentence);
    await expect.poll(() => nativeVisible('overlay')).toBe(true);
    const beforeSize = await nativeSize();
    const result = { cycle: index + 1, beforeSize, domClosed: false, nativeHidden: false };
    report.cycles.push(result);
    // The response came: the halo that swept the lines during the work has left.
    await expectHaloGone(`bubble ${index + 1} after the response`);
    if (first) {
      await page.screenshot({ path: resolve(output, 'webview-short.png') });
      result.framelessAfterShow = await expectFrameless('after show');
      // focus_overlay only activates a waiting Îlot menu: on the bubble it must change nothing.
      result.focusOverlay = await invoke('focus_overlay');
      await page.waitForTimeout(400);
      result.framelessAfterFocus = await expectFrameless('after focus_overlay');
      if (locked) report.frameSilent = 'not checked (session locked: the screen cannot be captured)';
      else {
        // The cursor rests on the glass so nothing folds or moves during the two captures.
        const frameless = result.framelessAfterFocus;
        await pointCursor(frameless.inside.x, frameless.inside.y);
        await page.waitForTimeout(150);
        // A video or a slideshow behind the window moves between the two captures: the
        // control (no message) measures that, the poke must not add a band on top of it.
        const control = poke(frameless.hwnd, true);
        const silent = poke(frameless.hwnd);
        report.frameSilent = { ...silent, controlMeanDiff: control.meanDiff };
        expect(silent.windowMoved, 'the window kept its rect across WM_NCACTIVATE').toBe(false);
        expect(silent.meanDiff, `WM_NCACTIVATE(FALSE, 0) paints nothing in the top band (control ${control.meanDiff})`).toBeLessThanOrEqual(FRAME_SILENT_TOLERANCE + 2 * control.meanDiff);
        result.framelessAfterPoke = await expectFrameless('after WM_NCACTIVATE');
      }
    } else result.frameless = await expectFrameless(`bubble ${index + 1}`);
    await page.getByRole('button', { name: 'More options', exact: true }).click();
    await expect(page.getByRole('menu')).toBeVisible();
    result.menuSize = await nativeSize();
    // The window is reserved: the menu opens in it without a native resize.
    expect(result.menuSize, 'menu opens without a resize').toEqual(beforeSize);
    if (first) await page.screenshot({ path: resolve(output, 'webview-menu.png') });
    await page.getByRole('menuitem', { name: 'Close', exact: true }).click();
    await expect(page.locator('.glass-overlay')).toHaveCount(0);
    result.domClosed = true;
    result.overlayVisibleAfterDomClose = await nativeVisible('overlay');
    result.haloVisibleAfterDomClose = await nativeVisible('halo');
    await expect.poll(() => nativeVisible('overlay')).toBe(false);
    await expectHaloGone(`bubble ${index + 1} after close`);
    result.nativeHidden = true;
  };

  // --- The Îlot: a menu capture of the same selection, walked to its outcome and closed.
  const stage = page.locator('.ilot-stage');
  const shape = page.locator('.ilot-stage [data-ilot-shape]');
  // The overlay HWND of the Îlot, its reserve (the stage is the reserved window, logical) and its
  // frameless styles; the Win32 region stays empty: the Îlot's shape is a hit-test region only
  // (host::set_regions, no SetWindowRgn), so Chromium's per-pixel alpha draws the silhouette.
  const ilotWindow = async (step, expected) => {
    const win = await hwndOf('overlay');
    expect(win.visible, `${step}: overlay visible`).toBe(true);
    expect(win.styles.filter(style => chromeStyles.includes(style)), `${step}: caption styles`).toEqual([]);
    expect(win.region, `${step}: window region`).toBeNull();
    if (expected) expect({ x: win.x, y: win.y, width: win.width, height: win.height }, `${step}: the reserved window never moves nor resizes`).toEqual(expected);
    return win;
  };
  // The region follows the shape: the cursor is taken inside it and let through a few pixels
  // outside it, in the reserve's transparent room (which the window still covers).
  // inside: false checks the outside points only (the compact state then stays compact: a real
  // cursor resting on it would unfold the grid after 450 ms).
  const expectRegion = async (step, win, box, extraThrough = [], { inside: checkInside = true } = {}) => {
    const dpr = await dprNow();
    const logical = { width: win.width / dpr, height: win.height / dpr };
    const outside = [
      [box.x - 10, box.y + box.height / 2], [box.x + box.width + 10, box.y + box.height / 2],
      [box.x + box.width / 2, box.y - 10], [box.x + box.width / 2, box.y + box.height + 10],
      ...extraThrough,
    ].filter(([x, y]) => x > 1 && y > 1 && x < logical.width - 1 && y < logical.height - 1 && !(x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height));
    const through = [];
    for (const [x, y] of outside) {
      const point = toScreen(win, dpr, x, y);
      const hit = await pointCursor(point.x, point.y);
      // A point taken outside the shape fails at once; before failing, the report says whether the
      // shape's region came late (the point lets the cursor through 0.25 to 2 s later) or never.
      // The Îlot's mode then tells a region left behind from a shape that really grew there.
      let later = '';
      if (hit.root.hwnd === win.hwnd) {
        const retries = [];
        for (const wait of [250, 500, 1000, 2000]) {
          await page.waitForTimeout(wait - (retries.at(-1)?.wait ?? 0));
          retries.push({ wait, taken: (await pointCursor(point.x, point.y)).root.hwnd === win.hwnd });
        }
        const mode = await page.evaluate(() => document.querySelector('.ilot-stage [data-ilot]')?.getAttribute('data-mode') ?? null);
        (report.regionRetries ??= []).push({ step, x: Math.round(x), y: Math.round(y), mode, retries });
        const through = retries.find(retry => !retry.taken);
        later = through ? ` (region late: let through after ${through.wait} ms` : ' (region never published: still taken after 2 s';
        later += mode ? `; Îlot ${mode})` : ')';
      }
      expect(hit.root.hwnd, `${step}: the cursor passes through at ${Math.round(x)},${Math.round(y)} outside the shape${later}`).not.toBe(win.hwnd);
      through.push({ x: Math.round(x), y: Math.round(y), root: hit.root.hwnd });
    }
    expect(through.length, `${step}: at least one point outside the shape inside the window`).toBeGreaterThan(0);
    expect(exStylesOf(win.hwnd), `${step}: pass-through set outside the shape`).toEqual(['TRANSPARENT', 'LAYERED']);
    if (!checkInside) return { box, through };
    const center = toScreen(win, dpr, box.x + box.width / 2, box.y + box.height / 2);
    const inside = await pointCursor(center.x, center.y);
    expect(inside.root.hwnd, `${step}: the shape takes the cursor`).toBe(win.hwnd);
    expect(exStylesOf(win.hwnd), `${step}: pass-through cleared on the shape`).toEqual([]);
    return { box, through, inside: { x: center.x, y: center.y } };
  };
  // Parks the real cursor in a transparent corner of the reserve: outside every shape, so it
  // neither unfolds the grid nor holds a pill. DevTools' own pointer goes there too: a DevTools
  // click leaves it on what it clicked, and Chromium hovers whatever appears under it later (the
  // next capture's ✦ where the last ✕ was, 25/09), which no real cursor there would do.
  const parkDevTools = () => page.mouse.move(2, 2);
  const park = async win => { await parkDevTools(); return pointCursor(win.x + 2, win.y + 2); };

  const ilotCycle = async (index, viaGrid) => {
    const result = { cycle: index + 1, path: viaGrid ? 'compact → grid → tile' : 'compact → last action', closed: false };
    report.ilot.push(result);
    await parkDevTools();
    const capture = await invoke('demo_menu_capture');
    expect(capture.menu, 'the demo menu capture carries its menu').toBeTruthy();
    await expect(stage).toHaveAttribute('data-capture-id', capture.id);
    await expect(stage).toHaveAttribute('data-stage', 'menu');
    await expect(stage).toHaveAttribute('data-side', /^(below|above)$/);
    await expect(page.locator('.ilot-stage [data-ilot]')).toHaveAttribute('data-mode', 'compact');
    result.side = await stage.getAttribute('data-side');
    const reserve = await stage.evaluate(element => ({ width: parseFloat(element.style.width), height: parseFloat(element.style.height) }));
    const compact = await settledBox(shape);
    result.keyboard = await page.locator('.ilot-stage [data-ilot]').getAttribute('data-keyboard');
    const dpr = await dprNow();
    const menuWin = await ilotWindow('menu');
    const reserved = { x: menuWin.x, y: menuWin.y, width: menuWin.width, height: menuWin.height };
    result.reserve = { logical: reserve, physical: { width: reserved.width, height: reserved.height } };
    expect(Math.abs(reserved.width - reserve.width * dpr), 'the window is the Îlot reserve (width)').toBeLessThanOrEqual(1);
    expect(Math.abs(reserved.height - reserve.height * dpr), 'the window is the Îlot reserve (height)').toBeLessThanOrEqual(1);
    expect(menuWin.noActivate, 'the menu window stays activatable before the choice').toBe(false);
    // While the menu waits, the halo shows the selection at three levels (« mise en valeur »,
    // Lucas 25/09): never hit, never activated, over the demo lines.
    await expect.poll(() => nativeVisible('halo'), { message: 'the halo shows the selection while the menu waits' }).toBe(true);
    const menuHalo = await hwndOf('halo');
    result.menuHalo = { x: menuHalo.x, y: menuHalo.y, width: menuHalo.width, height: menuHalo.height, exStyles: menuHalo.exStyles };
    expect(menuHalo.exStyles, 'the menu halo lets every click through').toEqual(['TRANSPARENT', 'LAYERED']);
    expect(menuHalo.noActivate && menuHalo.toolWindow, 'the menu halo is never activated and has no taskbar entry').toBe(true);
    expect(menuHalo.x <= demoLines.left && menuHalo.y <= demoLines.top && menuHalo.x + menuHalo.width >= demoLines.right && menuHalo.y + menuHalo.height >= demoLines.bottom, 'the menu halo covers the demo selection lines').toBe(true);
    if (index === 0) {
      await page.screenshot({ path: resolve(output, 'webview-ilot-compact.png') });
      if (locked) result.frameSilent = 'not checked (session locked: the screen cannot be captured)';
      else {
        await park(menuWin);
        await page.waitForTimeout(150);
        // The captures stay in memory: the transparent top band shows whatever lies behind.
        const control = poke(menuWin.hwnd, true, false);
        const silent = poke(menuWin.hwnd, false, false);
        result.frameSilent = { meanDiff: silent.meanDiff, controlMeanDiff: control.meanDiff, windowMoved: silent.windowMoved };
        expect(silent.windowMoved, 'the Îlot window kept its rect across WM_NCACTIVATE').toBe(false);
        expect(silent.meanDiff, `WM_NCACTIVATE(FALSE, 0) paints nothing over the Îlot (control ${control.meanDiff})`).toBeLessThanOrEqual(FRAME_SILENT_TOLERANCE + 2 * control.meanDiff);
        await ilotWindow('menu after WM_NCACTIVATE', reserved);
      }
    }
    // The compact region from outside: a real cursor resting on its ✦ unfolds the grid after
    // 450 ms, which only the grid path wants (its last action never does, Lucas 24/09).
    result.compact = await expectRegion('compact', menuWin, compact, [], { inside: false });
    if (viaGrid) {
      // Now the real cursor comes onto the compact state's ✦ (its 26 px button, 3 px from the right
      // edge) in two moves, as a real pointer arrives in many: the first lands under the window
      // before the hit tester lifts the pass-through (every 8 ms), the second on the WebView, whose
      // hover unfolds the grid after 450 ms. A locked session moves no cursor (nor a WebView that
      // still saw no move): a DevTools hover unfolds it then.
      let watchGrid = watchOverlay(2400);
      const center = toScreen(menuWin, dpr, compact.x + compact.width - 16, compact.y + compact.height / 2);
      const inside = await pointCursor(center.x, center.y);
      expect(inside.root.hwnd, 'compact: the shape takes the cursor').toBe(menuWin.hwnd);
      expect(exStylesOf(menuWin.hwnd), 'compact: pass-through cleared on the shape').toEqual([]);
      result.compact.inside = { x: center.x, y: center.y };
      if (!locked) await pointCursor(center.x + 1, center.y);
      try {
        await expect(page.locator('.ilot-stage [data-ilot]')).toHaveAttribute('data-mode', 'grid', { timeout: 1200 });
        result.gridOpenedBy = 'real cursor on the ✦';
      } catch {
        result.beforeHover = await watchGrid;
        expect(result.beforeHover, 'compact under the real cursor: the window never moves nor resizes').toEqual([`${reserved.x},${reserved.y},${reserved.width}x${reserved.height}`]);
        watchGrid = watchOverlay(2000);
        await page.locator('.ilot-stage [data-item="ask"]').hover();
        await expect(page.locator('.ilot-stage [data-ilot]')).toHaveAttribute('data-mode', 'grid');
        result.gridOpenedBy = 'DevTools hover (the real cursor did not unfold it)';
      }
      const grid = await settledBox(shape);
      result.morphToGrid = await watchGrid;
      expect(result.morphToGrid, 'compact → grid: the window never moves nor resizes').toEqual([`${reserved.x},${reserved.y},${reserved.width}x${reserved.height}`]);
      await ilotWindow('grid', reserved);
      if (index === 0) await page.screenshot({ path: resolve(output, 'webview-ilot-grid.png') });
      // The grid's own region: taken inside, let through around it (and on the compact state's far
      // end when that lies beyond the grid).
      await park(menuWin);
      result.grid = await expectRegion('grid', menuWin, grid, [[compact.x + 6, compact.y + compact.height / 2]]);
      await park(menuWin);
    } else await park(menuWin);
    // The choice: a tile of the grid, or the compact state's last action (Enter's action).
    const watchPill = watchOverlay(1400);
    if (viaGrid) await page.locator('.ilot-stage .ilot-tile[data-tile]:not([data-tile="ask"])').first().click();
    else await page.locator('.ilot-stage [data-item="last"]').click();
    await expect(stage).toHaveAttribute('data-stage', 'working');
    const before = viaGrid ? result.grid.box : compact;
    const pill = await settledBox(shape);
    result.morphToPill = await watchPill;
    expect(result.morphToPill, 'menu → pill: the window never moves nor resizes').toEqual([`${reserved.x},${reserved.y},${reserved.width}x${reserved.height}`]);
    await expect(stage, 'the work lasts long enough for the checks (FLOWTRANSLATE_SIMULATE_WORD_MS)').toHaveAttribute('data-stage', 'working');
    // After the choice the overlay can no longer be activated (a click on the pill keeps the
    // source's focus); the halo works over the lines under it, never hit, never activated.
    const workWin = await ilotWindow('working pill', reserved);
    expect(workWin.noActivate, 'the pill window carries WS_EX_NOACTIVATE after the choice').toBe(true);
    await expect.poll(() => nativeVisible('halo'), { message: 'the halo window shows while the action works' }).toBe(true);
    const halo = await hwndOf('halo');
    result.halo = { x: halo.x, y: halo.y, width: halo.width, height: halo.height, exStyles: halo.exStyles, noActivate: halo.noActivate, toolWindow: halo.toolWindow };
    expect(halo.styles.filter(style => chromeStyles.includes(style)), 'halo caption styles').toEqual([]);
    expect(halo.region, 'halo window region').toBeNull();
    expect(halo.exStyles, 'the halo lets every click through').toEqual(['TRANSPARENT', 'LAYERED']);
    expect(halo.noActivate && halo.toolWindow, 'the halo is never activated and has no taskbar entry').toBe(true);
    expect(halo.x <= demoLines.left && halo.y <= demoLines.top && halo.x + halo.width >= demoLines.right && halo.y + halo.height >= demoLines.bottom, 'the halo covers the demo selection lines').toBe(true);
    // The pill's region: the old shape's room lets the cursor through again.
    const far = [[before.x + 6, before.y + before.height - 6], [before.x + before.width / 2, before.y + before.height / 2]];
    result.pill = await expectRegion('working pill', workWin, pill, far);
    await expect(stage, 'the pill region was checked while the action worked').toHaveAttribute('data-stage', 'working');
    await park(workWin);
    // A point on the selection's lines, clear of the pill: neither the halo nor the overlay takes it.
    const lineHit = await pointCursor(demoLines.left + 8, demoLines.top + 12);
    expect([halo.hwnd, workWin.hwnd].includes(lineHit.root.hwnd), 'the cursor on the swept lines reaches what lies under the halo').toBe(false);
    result.lineHit = lineHit.root.hwnd;
    await expect(stage, 'the halo was checked while the action worked').toHaveAttribute('data-stage', 'working');
    // The outcome: the demo capture has no writable target, so Rust's delivery answers
    // not_editable and the same surface becomes the paste family's error pill.
    const watchOutcome = watchOverlay(2400);
    await expect(stage).toHaveAttribute('data-stage', /^(done|error)$/, { timeout: 20000 });
    result.outcome = { stage: await stage.getAttribute('data-stage'), code: await stage.getAttribute('data-error') };
    expect(result.outcome, 'the demo menu ends on the not_editable pill').toEqual({ stage: 'error', code: 'not_editable' });
    const outcome = await settledBox(shape);
    await expectHaloGone('after the response');
    result.morphToOutcome = await watchOutcome;
    expect(result.morphToOutcome, 'pill → outcome: the window never moves nor resizes').toEqual([`${reserved.x},${reserved.y},${reserved.width}x${reserved.height}`]);
    const outcomeWin = await ilotWindow('outcome pill', reserved);
    if (index === 0) await page.screenshot({ path: resolve(output, 'webview-ilot-outcome.png') });
    result.outcomeRegion = await expectRegion('outcome pill', outcomeWin, outcome);
    await park(outcomeWin);
    // Close with the pill's ✕ (a DevTools click in our page): everything leaves and stays gone.
    await page.locator('.ilot-stage .result-close').click();
    await expect(stage).toHaveCount(0);
    await expect.poll(() => nativeVisible('overlay'), { message: 'overlay hidden after the close' }).toBe(false);
    await expectHaloGone('after the close');
    await page.waitForTimeout(1000);
    result.overlayVisibleLater = await nativeVisible('overlay');
    result.haloVisibleLater = await nativeVisible('halo');
    expect([result.overlayVisibleLater, result.haloVisibleLater], 'overlay and halo stay hidden a second later').toEqual([false, false]);
    result.closed = true;
  };

  for (let cycle = 0; cycle < 3; cycle++) await bubbleCycle(cycle, cycle === 0);
  for (let cycle = 0; cycle < 2; cycle++) await ilotCycle(cycle, cycle === 0);
  // A direct capture after the Îlot: the choice's no-activate bit is lowered, the bubble as before.
  await bubbleCycle(3, false);
  report.status = 'passed';
  console.log(`PASS: bubble ×4 (3 before, 1 after the Îlot): frameless HWND without region, cursor let through in the halo and taken on the glass, frame silent under WM_NCACTIVATE (${typeof report.frameSilent === 'string' ? report.frameSilent : `mean diff ${report.frameSilent.meanDiff}`}), menus without a resize, halo gone after each response, DOM close and native windows hidden. Îlot ×2 (grid, compact): reserved window frameless and fixed through every morph, region following compact, grid, pill and outcome shapes, halo window from the menu to the response and let through, overlay no-activate after the choice, close hides both. Theme ${report.theme}. Desktop composition not established.`);
} catch (error) {
  report.status = 'failed';
  report.error = String(error.message);
  throw error;
} finally {
  await writeFile(resolve(output, 'result.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
