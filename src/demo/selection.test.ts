import { describe, expect, it } from 'vitest';
import {
  caretAt,
  caretPoint,
  dragEnds,
  dragPoint,
  dragSelection,
  joined,
  selectionRects,
  stroke,
  touchedLines,
  type TextLine,
} from './selection';

// Three lines of ten characters, 10 px a character, 24 px a line, starting at (100, 200); the last
// line holds six characters only.
function layout(): TextLine[] {
  const line = (index: number, count: number): TextLine => ({
    top: 200 + index * 24,
    bottom: 224 + index * 24,
    start: index * 10,
    end: index * 10 + count,
    xs: Array.from({ length: count + 1 }, (_, i) => 100 + i * 10),
  });
  return [line(0, 10), line(1, 10), line(2, 6)];
}

describe('the caret under the pointer', () => {
  const lines = layout();
  it('takes the nearest gap on the line the pointer is on', () => {
    expect(caretAt(lines, { x: 100, y: 210 })).toBe(0);
    expect(caretAt(lines, { x: 124, y: 210 })).toBe(2);
    expect(caretAt(lines, { x: 126, y: 210 })).toBe(3);
    expect(caretAt(lines, { x: 126, y: 230 })).toBe(13);
  });
  it('clamps above, below, left and right of the text', () => {
    expect(caretAt(lines, { x: 500, y: 0 })).toBe(10);
    expect(caretAt(lines, { x: -50, y: 900 })).toBe(20);
    expect(caretAt(lines, { x: 900, y: 900 })).toBe(26);
    expect(caretAt([], { x: 0, y: 0 })).toBe(0);
  });
  it('puts the end of a selection at the end of its line, not at the start of the next', () => {
    expect(caretPoint(lines, 10, true)).toEqual({ x: 200, top: 200, bottom: 224 });
    expect(caretPoint(lines, 10)).toEqual({ x: 100, top: 224, bottom: 248 });
    expect(caretPoint(lines, 26)).toEqual({ x: 160, top: 248, bottom: 272 });
  });
});

describe('a selection over several lines', () => {
  const lines = layout();
  it('is one band per line: the first from the press, the middle ones whole, the last up to the pointer', () => {
    expect(selectionRects(lines, 3, 24)).toEqual([
      { x: 130, y: 200, width: 70, height: 24 },
      { x: 100, y: 224, width: 100, height: 24 },
      { x: 100, y: 248, width: 40, height: 24 },
    ]);
  });
  it('is the same whichever end was pressed first, and empty for a caret', () => {
    expect(selectionRects(lines, 24, 3)).toEqual(selectionRects(lines, 3, 24));
    expect(selectionRects(lines, 7, 7)).toEqual([]);
  });
  it('knows the whole lines it touches', () => {
    expect(touchedLines(lines, 3, 12)).toEqual([
      { x: 100, y: 200, width: 100, height: 24 },
      { x: 100, y: 224, width: 100, height: 24 },
    ]);
  });
});

describe('the drag of the demo', () => {
  const lines = layout();
  it('is one diagonal from before the first character to after the last one', () => {
    const ends = dragEnds(lines)!;
    expect(ends.from).toEqual({ x: 99, y: 212 });
    expect(ends.to).toEqual({ x: 162, y: 260 });
    // It goes down all the way, never back up: no line-by-line zigzag.
    let previous = dragPoint(lines, 0)!;
    for (let step = 1; step <= 100; step++) {
      const point = dragPoint(lines, step / 100)!;
      expect(point.y).toBeGreaterThanOrEqual(previous.y);
      expect(point.x).toBeLessThan(ends.to.x + 8);
      previous = point;
    }
    expect(dragPoint(lines, 1)).toEqual(ends.to);
  });
  it('never sweeps to the end of a line before it goes down', () => {
    // On the first line the pointer stays far from the line's end (x 200): the first band only
    // completes when the pointer is on the next line.
    for (let step = 0; step <= 100; step++) {
      const at = dragSelection(lines, step / 100)!;
      if (at.point.y < 224) expect(at.point.x).toBeLessThan(140);
    }
  });
  it('selects like Windows at each instant', () => {
    expect(dragSelection(lines, 0)!.rects).toEqual([]);
    // The selection only grows, and each picture of it is a real multi-line selection.
    let focus = 0,
      sawPartialSecondLine = false;
    for (let step = 1; step <= 200; step++) {
      const at = dragSelection(lines, step / 200)!;
      expect(at.focus).toBeGreaterThanOrEqual(focus);
      focus = at.focus;
      expect(at.rects).toEqual(selectionRects(lines, 0, at.focus));
      if (at.rects.length === 2) {
        // The pointer is on the second line: the first one is whole, at once.
        expect(at.rects[0]).toEqual({ x: 100, y: 200, width: 100, height: 24 });
        if (at.rects[1].width < 100) sawPartialSecondLine = true;
      }
      if (at.rects.length === 3) expect(at.rects[1]).toEqual({ x: 100, y: 224, width: 100, height: 24 });
    }
    expect(sawPartialSecondLine).toBe(true);
    expect(dragSelection(lines, 1)!.focus).toBe(26);
    expect(dragSelection(lines, 1)!.rects).toHaveLength(3);
  });
  it('has nothing to select without a layout', () => {
    expect(dragSelection([], 0.5)).toBeNull();
    expect(dragEnds([])).toBeNull();
  });
});

describe('lines read from glyph boxes', () => {
  it('are grown to touch, so the bands of a selection leave no gap', () => {
    const glyphs: TextLine[] = [
      { top: 202, bottom: 222, start: 0, end: 2, xs: [0, 10, 20] },
      { top: 226, bottom: 246, start: 2, end: 4, xs: [0, 10, 20] },
      { top: 250, bottom: 270, start: 4, end: 5, xs: [0, 10] },
    ];
    expect(joined(glyphs).map((line) => [line.top, line.bottom])).toEqual([
      [200, 224],
      [224, 248],
      [248, 272],
    ]);
    expect(joined(glyphs.slice(0, 1))).toEqual(glyphs.slice(0, 1));
    // The caret changes line half-way between two lines, not at the bottom of the glyphs.
    expect(caretAt(joined(glyphs), { x: 9, y: 223 })).toBe(1);
    expect(caretAt(joined(glyphs), { x: 9, y: 225 })).toBe(3);
  });
});

describe('a stroke of the pointer', () => {
  it('starts and ends where asked, slow at both ends', () => {
    const from = { x: 0, y: 0 },
      to = { x: 100, y: 50 };
    expect(stroke(from, to, 0, 0.2)).toEqual(from);
    expect(stroke(from, to, 1, 0.2)).toEqual(to);
    expect(stroke(from, to, 0.1).x).toBeLessThan(2);
    expect(stroke(from, to, 0.5)).toEqual({ x: 50, y: 25 });
    expect(stroke(from, to, 7)).toEqual(to);
  });
});
