import { describe, expect, it } from 'vitest';
import {
  bottomReserve,
  countWords,
  decideForm,
  decidePlacement,
  frameSide,
  ilotBox,
  ilotFits,
  ilotMenuShift,
  ilotPlace,
  ilotRegion,
  ilotReserve,
  ilotRoom,
  ilotShift,
  ilotSide,
  ilotStrip,
  placeX,
  readerMetrics,
  readingBudget,
  remainingAfterLeave,
  shortMetrics,
} from './layout';
import { ilotMetrics } from './menu/metrics';

describe('reading forms (2026-09-14)', () => {
  it('reads up to eight short lines beside the selection, more in the reader', () => {
    expect(decideForm(1)).toBe('short');
    expect(decideForm(8)).toBe('short');
    expect(decideForm(9)).toBe('reader');
  });
  it('sizes the reader from the screen it is on, half the width and whole lines within 45 % of the height', () => {
    const wide = readerMetrics({ width: 2560, height: 1400 }, 'normal');
    expect(wide.width).toBe(1280);
    expect(wide).toMatchObject({ fontSize: 22, lineHeight: 33 });
    // 630 px available, 34 px of padding: 18 whole lines of 33 px.
    expect(wide.maxHeight).toBe(18 * 33 + 34);
    const laptop = readerMetrics({ width: 1280, height: 693 }, 'xlarge');
    expect(laptop.width).toBe(640);
    expect(laptop.maxHeight).toBe(Math.floor((312 - 34) / 39) * 39 + 34);
    expect(laptop.maxHeight).toBeLessThanOrEqual(312);
    // Nothing hard-coded: another screen, another band.
    expect(readerMetrics({ width: 1920, height: 1040 }, 'normal').width).toBe(960);
  });
  it('keeps the short glass at 380 px with the preset metrics', () => {
    expect(shortMetrics('normal')).toMatchObject({
      width: 380,
      fontSize: 16,
      lineHeight: 24,
      maxHeight: 8 * 24 + 29,
      minHeight: 53,
    });
    expect(shortMetrics('large')).toMatchObject({ fontSize: 18, lineHeight: 27 });
    expect(shortMetrics('xlarge')).toMatchObject({ fontSize: 20, lineHeight: 30 });
  });
  it('reserves the bottom window for the reader, its menu and the halos', () => {
    const reserve = bottomReserve({ width: 2560, height: 1400 }, 'normal');
    expect(reserve.width).toBe(1280 + 64);
    expect(reserve.height).toBe(20 + 236 + 6 + 14 + (18 * 33 + 34) + 16);
  });
});

describe('reading budget', () => {
  it('grows with the words between five seconds and the form ceiling, scaled by the setting', () => {
    expect(readingBudget(3, 'short', 'normal')).toBe(5000);
    expect(readingBudget(20, 'short', 'normal')).toBe(1000 + 350 * 20);
    expect(readingBudget(200, 'short', 'normal')).toBe(30000);
    expect(readingBudget(200, 'reader', 'normal')).toBe(1500 + 350 * 200);
    expect(readingBudget(1000, 'reader', 'normal')).toBe(90000);
    expect(readingBudget(20, 'short', 'fast')).toBe(Math.round(8000 * 0.7));
    expect(readingBudget(20, 'short', 'slow')).toBe(12000);
    expect(readingBudget(20, 'short', 'never')).toBeNull();
  });
  it('shortens what remains to four seconds after a real visit, never under two and a half', () => {
    expect(remainingAfterLeave(20000, 1500)).toBe(4000);
    expect(remainingAfterLeave(3000, 1500)).toBe(3000);
    expect(remainingAfterLeave(800, 1500)).toBe(2500);
    // A pass-through of less than a second changes nothing but the floor.
    expect(remainingAfterLeave(20000, 300)).toBe(20000);
    expect(remainingAfterLeave(1000, 300)).toBe(2500);
  });
  it('counts words on whitespace', () => {
    expect(countWords('Bonjour,  ceci est\nune phrase.')).toBe(5);
    expect(countWords('   ')).toBe(0);
  });
});

it('decides the placement at the capture on the source: a long selection waits at the bottom', () => {
  expect(decidePlacement(true, 1)).toBe('anchored');
  expect(decidePlacement(true, 8)).toBe('anchored');
  expect(decidePlacement(true, 9)).toBe('bottom');
  expect(decidePlacement(false, 1)).toBe('bottom');
});

describe('Îlot window (lot 7)', () => {
  it('reserves the largest shape and its growth on both sides of the strip Rust anchors', () => {
    // The strip Rust clamps into the work area stays the menu's widest shape, the field (283): the
    // Îlot leaves the selection's end only within 283 px of the work area's left edge. The error
    // pill of lot 10 (400) overhangs it by 117 px on its left; on its right the reserve keeps 251
    // px, the menu opening right (the field from the ✦ alone, 283 − 32), which also holds the error
    // pill's slide; then 32 of halo: 32 + 117 + 283 + 251 + 32 wide; 20 + 84 + 32 + 84 + 44 high.
    expect(ilotStrip).toBe(283);
    expect(ilotReserve('anchored')).toEqual({
      width: 715,
      height: 264,
      frame: { x: 149, y: 104, width: 283, height: 32, radius: 0 },
    });
    // No anchor: the 400 × 116 box on the bottom halo of the band (16).
    expect(ilotReserve('bottom')).toEqual({
      width: 464,
      height: 152,
      frame: { x: 32, y: 20, width: 400, height: 116, radius: 0 },
    });
    // Every shape fits the box: the field, the grid, the error pill at its widest.
    expect(ilotBox.width).toBeGreaterThanOrEqual(
      Math.max(ilotMetrics.prompt.width, ilotMetrics.grid.width, ilotMetrics.error.maxWidth),
    );
    expect(ilotBox.height).toBeGreaterThanOrEqual(
      Math.max(ilotMetrics.grid.height, ilotMetrics.prompt.height, ilotMetrics.error.height),
    );
  });
  it('hangs each shape from the strip’s right edge, on the side Rust chose', () => {
    expect(ilotRegion('anchored', 'below', { width: 120, height: 32 })).toEqual({
      x: 312,
      y: 104,
      width: 120,
      height: 32,
      radius: 16,
    });
    expect(ilotRegion('anchored', 'below', { width: 218, height: 116 })).toEqual({
      x: 214,
      y: 104,
      width: 218,
      height: 116,
      radius: 16,
    });
    expect(ilotRegion('anchored', 'above', { width: 218, height: 116 })).toEqual({
      x: 214,
      y: 20,
      width: 218,
      height: 116,
      radius: 16,
    });
    expect(ilotRegion('anchored', 'above', { width: 283, height: 34 })).toEqual({
      x: 149,
      y: 102,
      width: 283,
      height: 34,
      radius: 17,
    });
    // The pill of lot 8 is fully round.
    expect(ilotRegion('anchored', 'below', { width: 44, height: 28 })).toEqual({
      x: 388,
      y: 104,
      width: 44,
      height: 28,
      radius: 14,
    });
    // The error pill of lot 10 at its widest fills the strip, fully round.
    expect(ilotRegion('anchored', 'below', { width: 400, height: 30 })).toEqual({
      x: 32,
      y: 104,
      width: 400,
      height: 30,
      radius: 15,
    });
    expect(ilotRegion('anchored', 'above', { width: 400, height: 30 })).toEqual({
      x: 32,
      y: 106,
      width: 400,
      height: 30,
      radius: 15,
    });
  });
  it('covers both shapes while one turns into the other, with the smaller radius', () => {
    expect(ilotRegion('anchored', 'below', { width: 218, height: 116 }, { width: 283, height: 34 })).toEqual({
      x: 149,
      y: 104,
      width: 283,
      height: 116,
      radius: 16,
    });
    expect(ilotRegion('anchored', 'below', { width: 120, height: 32 }, { width: 52, height: 28 })).toEqual({
      x: 312,
      y: 104,
      width: 120,
      height: 32,
      radius: 14,
    });
    // The work pill turning into the error pill.
    expect(ilotRegion('anchored', 'below', { width: 44, height: 28 }, { width: 300, height: 30 })).toEqual({
      x: 132,
      y: 104,
      width: 300,
      height: 30,
      radius: 14,
    });
  });
  it('centres the shape on the bottom edge without an anchor', () => {
    expect(ilotRegion('bottom', 'above', { width: 120, height: 32 })).toEqual({
      x: 172,
      y: 104,
      width: 120,
      height: 32,
      radius: 16,
    });
    expect(ilotRegion('bottom', 'above', { width: 44, height: 28 })).toEqual({
      x: 210,
      y: 108,
      width: 44,
      height: 28,
      radius: 14,
    });
    expect(ilotRegion('bottom', 'above', { width: 283, height: 116 })).toEqual({
      x: 90,
      y: 20,
      width: 284,
      height: 116,
      radius: 16,
    });
    expect(ilotRegion('bottom', 'above', { width: 400, height: 30 })).toEqual({
      x: 32,
      y: 106,
      width: 400,
      height: 30,
      radius: 15,
    });
  });
  it('slides a shape right only when the work area’s left edge is closer than its width', () => {
    // The strip's corner (its right edge, 432 in the window) on the selection's end at x = 520,
    // on a work area from 0 to 1920: plenty of room, nothing slides.
    const wide = ilotRoom(520 - 432, 1, { x: 0, width: 1920 });
    expect(wide).toEqual({ left: 520, right: 1400 });
    expect(ilotShift(400, wide)).toBe(0);
    // Rust clamped the strip against the left edge (a selection ending at x = 70): the corner at
    // 283. The menu's shapes still fit; the error pill slides by what it overhangs.
    const clamped = ilotRoom(-149, 1, { x: 0, width: 1920 });
    expect(clamped).toEqual({ left: 283, right: 1637 });
    for (const width of [44, 110, 218, 283]) expect(ilotShift(width, clamped)).toBe(0);
    expect(ilotShift(300, clamped)).toBe(17);
    expect(ilotShift(389.4, clamped)).toBe(107);
    expect(ilotShift(400, clamped)).toBe(117);
    // At 150 %, a work area starting at x = -1920 (a screen on the left): logical pixels.
    expect(ilotRoom(-1920 - 149 * 1.5 + 30, 1.5, { x: -1920, width: 1920 })).toEqual({ left: 303, right: 977 });
    expect(ilotShift(350, ilotRoom(-1920 - 149 * 1.5 + 30, 1.5, { x: -1920, width: 1920 }))).toBe(47);
    // Never past the reserve's room right of the strip (251) nor the work area's right edge;
    // unknown room: no slide.
    expect(ilotShift(500, clamped)).toBe(217);
    expect(ilotShift(600, clamped)).toBe(251);
    expect(ilotShift(400, { left: 283, right: 50.5 })).toBe(50);
    expect(ilotShift(400, null)).toBe(0);
  });
  it('places the pill where Rust says after its paste, keeping the corner that faces the text', () => {
    // The fixture's window at (88, 222): the strip's corner at (432, 104). A pill of 110 × 28 whose
    // top-left Rust puts at (362, 122): 40 px right of and 18 px below the strip's corner.
    const pill = { width: 110, height: 28 };
    expect(ilotPlace({ x: 362, y: 122, side: 'below' }, pill, 'below')).toEqual({
      x: 40,
      y: 18,
      width: 110,
      keepLeft: false,
    });
    // The Îlot above the selection keeps its bottom edge on the strip's (136): the same target.
    expect(ilotPlace({ x: 362, y: 122, side: 'below' }, pill, 'above')).toEqual({
      x: 40,
      y: 14,
      width: 110,
      keepLeft: false,
    });
    // Below or above the text the right edge stays for any later shape; in the margin the left.
    const below = ilotPlace({ x: 362, y: 122, side: 'below' }, pill, 'below');
    expect([placeX(below, 60), placeX(below, 240)]).toEqual([40, 40]);
    const margin = ilotPlace({ x: 362, y: 122, side: 'margin' }, pill, 'below');
    expect([placeX(margin, 60), placeX(margin, 240)]).toEqual([-10, 170]);
    expect(placeX(null, 240)).toBe(0);
    expect(ilotFits({ x: 362, y: 122 }, pill)).toBe(true);
    for (const target of [
      { x: -1, y: 122 },
      { x: 606, y: 122 },
      { x: 362, y: 237 },
      { x: 362, y: -2 },
    ])
      expect(ilotFits(target, pill), JSON.stringify(target)).toBe(false);
    // The shadow's room kept (the halo: 32 px each side, 20 above, 44 below in the 715 × 264
    // window): a pill any closer to an edge would have its shadow cut by the window.
    for (const target of [
      { x: 32, y: 20 },
      { x: 573, y: 192 },
    ])
      expect(ilotFits(target, pill), JSON.stringify(target)).toBe(true);
    for (const target of [
      { x: 31, y: 122 },
      { x: 574, y: 122 },
      { x: 362, y: 19 },
      { x: 362, y: 193 },
    ])
      expect(ilotFits(target, pill), JSON.stringify(target)).toBe(false);
    // At 125 or 150 % Rust's logical pixels are fractional: the place is whole pixels.
    expect(ilotPlace({ x: 362.4, y: 121.6, side: 'below' }, pill, 'below')).toEqual({
      x: 40,
      y: 18,
      width: 110,
      keepLeft: false,
    });
    expect(ilotPlace({ x: 327.6, y: 77.5, side: 'above' }, pill, 'above')).toEqual({
      x: 6,
      y: -30,
      width: 110,
      keepLeft: false,
    });
  });
  it('slides a placed pill only by what the work area needs, and keeps any shape in the window', () => {
    const wide = ilotRoom(520 - 432, 1, { x: 0, width: 1920 });
    // At its place the pill keeps it; a wider shape there too, growing left from the same corner.
    expect(ilotShift(110, wide, 40)).toBe(40);
    expect(ilotShift(260, wide, -120)).toBe(-120);
    // Near the work area's left edge (the corner 283 px from it), placed 100 px to its left: the
    // shape slides back right by what it overhangs, never past the reserve's halo.
    const clamped = ilotRoom(-149, 1, { x: 0, width: 1920 });
    expect(ilotShift(110, clamped, -100)).toBe(-100);
    expect(ilotShift(250, clamped, -100)).toBe(-33);
    expect(ilotShift(400, clamped, -100)).toBe(117);
    // Whatever the place, the shape stays in the window with its shadow's room (32 to 683, the
    // strip's corner at 432): its left edge at 32 at least, its corner 251 right of the strip's at
    // most. Before the review of lot 9 the bounds were the window's own edges (−172 and 149).
    expect(ilotShift(260, null, -300)).toBe(-140);
    expect(ilotShift(110, null, 200)).toBe(200);
    expect(ilotShift(110, null, 300)).toBe(251);
    // Nor past the work area's right edge (30 px right of the strip's corner): a shape placed in
    // the margin, 60 px right of it, stops there.
    expect(ilotShift(260, { left: 600, right: 30 }, 60)).toBe(30);
    expect(ilotShift(260, { left: 600, right: 30.8 }, 60)).toBe(30);
  });
  it('covers a placed pill and its way there, above or below the selection', () => {
    // From the strip's corner to 40 px right and 18 px below it: both positions.
    expect(
      ilotRegion(
        'anchored',
        'below',
        { width: 110, height: 28, shift: 0 },
        { width: 110, height: 28, shift: 40, dy: 18 },
      ),
    ).toEqual({ x: 322, y: 104, width: 150, height: 46, radius: 14 });
    expect(ilotRegion('anchored', 'below', { width: 110, height: 28, shift: 40, dy: 18 })).toEqual({
      x: 362,
      y: 122,
      width: 110,
      height: 28,
      radius: 14,
    });
    // Above the selection the pill rests on the strip's bottom (136), moved up or down by dy.
    expect(ilotRegion('anchored', 'above', { width: 110, height: 28, dy: -30 })).toEqual({
      x: 322,
      y: 78,
      width: 110,
      height: 28,
      radius: 14,
    });
    expect(ilotRegion('anchored', 'above', { width: 110, height: 28 }, { width: 110, height: 28, dy: 60 })).toEqual({
      x: 322,
      y: 108,
      width: 110,
      height: 88,
      radius: 14,
    });
    // Never outside the window.
    expect(ilotRegion('anchored', 'below', { width: 110, height: 28, dy: 150 })).toEqual({
      x: 322,
      y: 254,
      width: 110,
      height: 10,
      radius: 5,
    });
  });
  // Lucas, 24/09: the menu opens right of the compact bubble when the work area has room there.
  it('opens the menu right of the compact bubble when the work area holds its widest shape there, keeping its left edge', () => {
    // A compact of 110: the field (283) reaches 173 px right of the strip's corner.
    const room = (right: number) => ({ left: 900, right });
    expect([110, 218, 283].map((width) => ilotMenuShift(width, 110, room(173)))).toEqual([0, 108, 173]);
    // Its left edge stays the compact's (432 − 110 = 322) and each shape stays in the window.
    expect(ilotRegion('anchored', 'below', { width: 218, height: 116, shift: 108 })).toEqual({
      x: 322,
      y: 104,
      width: 218,
      height: 116,
      radius: 16,
    });
    expect(
      ilotRegion('anchored', 'below', { width: 110, height: 32, shift: 0 }, { width: 283, height: 34, shift: 173 }),
    ).toEqual({ x: 322, y: 104, width: 283, height: 34, radius: 16 });
    // Too little room on the right (near the screen's right edge): it opens left, as before.
    expect(ilotMenuShift(218, 110, room(172.5))).toBeNull();
    // The ✦ alone (32): the field reaches 251 px, the reserve's room on the right.
    expect(ilotMenuShift(283, 32, room(251))).toBe(251);
    expect(ilotRegion('anchored', 'below', { width: 283, height: 34, shift: 251 }).x + 283).toBe(
      ilotReserve('anchored').width - 32,
    );
    expect(ilotMenuShift(283, 31, room(900))).toBeNull();
    // Unknown compact or room (the browser preview): left.
    expect(ilotMenuShift(218, null, room(900))).toBeNull();
    expect(ilotMenuShift(218, 110, null)).toBeNull();
  });
  it('covers a slid shape, and both positions while it slides', () => {
    // The error pill at 117 px right of the corner: from 149 to 549 in the 715 px window.
    expect(ilotRegion('anchored', 'below', { width: 400, height: 30, shift: 117 })).toEqual({
      x: 149,
      y: 104,
      width: 400,
      height: 30,
      radius: 15,
    });
    // The work pill at the corner turning into that pill: the box that holds both.
    expect(
      ilotRegion('anchored', 'below', { width: 44, height: 28, shift: 0 }, { width: 350, height: 30, shift: 67 }),
    ).toEqual({ x: 149, y: 104, width: 350, height: 30, radius: 14 });
    // Back to work (Try again): the same box the other way.
    expect(
      ilotRegion('anchored', 'below', { width: 350, height: 30, shift: 67 }, { width: 44, height: 28, shift: 0 }),
    ).toEqual({ x: 149, y: 104, width: 350, height: 30, radius: 14 });
    // Without an anchor the box is centred: a shift means nothing there.
    expect(ilotRegion('bottom', 'above', { width: 400, height: 30, shift: 117 })).toEqual(
      ilotRegion('bottom', 'above', { width: 400, height: 30 }),
    );
  });
  it('reads the side Rust chose from the window’s position', () => {
    const anchor = { x: 400, y: 300, width: 120, height: 18 };
    // Below: the strip 8 px under the selection (318 + 8), the window 104 px higher.
    expect(ilotSide(222, 1, anchor)).toBe('below');
    // Above: the strip ends 8 px over the selection.
    expect(ilotSide(300 - 8 - 32 - 104, 1, anchor)).toBe('above');
    // At 150 %, the window's offsets are physical as well.
    expect(ilotSide(318 + 8 - 156, 1.5, anchor)).toBe('below');
    expect(ilotSide(300 - 8 - 48 - 156, 1.5, anchor)).toBe('above');
  });
  it("reads the side of any anchored frame the same way (the glass's footprint, review of bc57857 finding 8)", () => {
    const anchor = { x: 400, y: 300, width: 120, height: 18 };
    // The glass's footprint 34 px down its window: 8 px under the selection, or ending 8 px over it.
    expect(frameSide(318 + 8 - 34, 34, 1, anchor)).toBe('below');
    expect(frameSide(300 - 8 - 58 - 34, 34, 1, anchor)).toBe('above');
    expect(frameSide(318 + 8 - 51, 34, 1.5, anchor)).toBe('below');
    expect(ilotSide(222, 1, anchor)).toBe(frameSide(222, ilotReserve('anchored').frame.y, 1, anchor));
  });
});
