import type { Rect } from '../types';

// The demo's text selection, as Windows makes it under a mouse drag (Lucas, 01/10: « personne ne
// surligne toute la ligne, revient au début de l'autre et surligne le reste : on surligne en
// diagonale »). The pointer presses before the first character and travels in one stroke to after
// the last one; at every frame the selection is the text between the press and the character
// under the pointer: the first line from the press to its end, the lines in between whole, the
// pointer's line up to the pointer. Pure geometry: the DOM is read once (measureLines), the rest
// is computed, so it is tested without a layout.

export type Point = { x: number; y: number };
// One laid-out line of a paragraph. start / end: offsets in the text (end excluded). xs[i]: where
// the caret stands before the character start + i (xs has end − start + 1 entries, the last one
// after the line's last character).
export type TextLine = { top: number; bottom: number; start: number; end: number; xs: number[] };

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

// The caret under a point, as a click or a drag puts it: the line the point is on (the first one
// above the text, the last one below it), then the nearest gap between two characters.
export function caretAt(lines: readonly TextLine[], point: Point): number {
  if (!lines.length) return 0;
  let line = lines[lines.length - 1];
  for (const candidate of lines) if (point.y < candidate.bottom) { line = candidate; break; }
  let best = 0;
  for (let i = 1; i < line.xs.length; i++) if (Math.abs(line.xs[i] - point.x) < Math.abs(line.xs[best] - point.x)) best = i;
  return line.start + best;
}

// Where the caret stands for an offset: at the end of a line rather than at the start of the next
// when the offset is a line break (`trailing`, the end of a selection), else the other way.
export function caretPoint(lines: readonly TextLine[], offset: number, trailing = false): { x: number; top: number; bottom: number } | null {
  if (!lines.length) return null;
  const last = lines[lines.length - 1];
  const at = clamp(offset, lines[0].start, last.end);
  let line = last;
  for (const candidate of lines) {
    if (at < candidate.end || (at === candidate.end && (trailing || candidate === last))) { line = candidate; break; }
  }
  return { x: line.xs[clamp(at - line.start, 0, line.xs.length - 1)], top: line.top, bottom: line.bottom };
}

// The bands of a selection between two offsets (in either order), one per line, top to bottom.
export function selectionRects(lines: readonly TextLine[], anchor: number, focus: number): Rect[] {
  const from = Math.min(anchor, focus), to = Math.max(anchor, focus);
  const rects: Rect[] = [];
  if (to <= from) return rects;
  for (const line of lines) {
    const start = Math.max(from, line.start), end = Math.min(to, line.end);
    if (end <= start) continue;
    const left = line.xs[start - line.start], right = line.xs[end - line.start];
    if (right - left < 0.5) continue;
    rects.push({ x: left, y: line.top, width: right - left, height: line.bottom - line.top });
  }
  return rects;
}

// The whole lines a selection touches (the halo's bands, as Rust expands them to `Line`).
export function touchedLines(lines: readonly TextLine[], anchor: number, focus: number): Rect[] {
  const from = Math.min(anchor, focus), to = Math.max(anchor, focus);
  return lines.filter(line => line.end > from && line.start < to)
    .map(line => ({ x: line.xs[0], y: line.top, width: line.xs[line.xs.length - 1] - line.xs[0], height: line.bottom - line.top }));
}

// A hand's movement between two points: minimum jerk in time, with a slight bow (a wrist turns,
// it never draws a ruler's line). p in 0..1 is the share of the time.
export const minJerk = (p: number) => { const x = clamp(p, 0, 1); return x * x * x * (10 - 15 * x + 6 * x * x); };
export function stroke(from: Point, to: Point, p: number, bow = 0): Point {
  const k = minJerk(p);
  const mid = { x: (from.x + to.x) / 2 - (to.y - from.y) * bow, y: (from.y + to.y) / 2 + (to.x - from.x) * bow };
  const u = 1 - k;
  return { x: u * u * from.x + 2 * u * k * mid.x + k * k * to.x, y: u * u * from.y + 2 * u * k * mid.y + k * k * to.y };
}

// The drag of the demo: from just before the first character, at mid-height of the first line, to
// just after the last one, at mid-height of the last line. One diagonal.
export function dragEnds(lines: readonly TextLine[]): { from: Point; to: Point } | null {
  if (!lines.length) return null;
  const first = lines[0], last = lines[lines.length - 1];
  return {
    from: { x: first.xs[0] - 1, y: (first.top + first.bottom) / 2 },
    to: { x: last.xs[last.xs.length - 1] + 2, y: (last.top + last.bottom) / 2 },
  };
}
// The bow of the drag: small, so the path stays a diagonal.
export const DRAG_BOW = 0.045;
export function dragPoint(lines: readonly TextLine[], p: number): Point | null {
  const ends = dragEnds(lines);
  return ends ? stroke(ends.from, ends.to, p, DRAG_BOW) : null;
}
// What is selected when the drag is at p: from the first character to the caret under the pointer.
export function dragSelection(lines: readonly TextLine[], p: number): { focus: number; rects: Rect[]; point: Point } | null {
  const point = dragPoint(lines, p);
  if (!point || !lines.length) return null;
  const anchor = lines[0].start;
  const focus = p >= 1 ? lines[lines.length - 1].end : caretAt(lines, point);
  return { focus, rects: selectionRects(lines, anchor, focus), point };
}

// ——— Reading the layout (browser only) ———
// The lines of a paragraph made of ONE text node, in the coordinates of `origin` (the offset of
// the paragraph in the stage, which no transform changes): client rectangles are divided by the
// scale the paragraph is drawn at (a stage fitted to a small window, a window still springing in).
export function measureLines(node: Text, host: HTMLElement, origin: Point): TextLine[] {
  const box = host.getBoundingClientRect();
  const scale = box.width / (host.offsetWidth || 1) || 1;
  const range = document.createRange();
  const length = node.length;
  const lines: TextLine[] = [];
  let current: TextLine | null = null;
  for (let index = 0; index < length; index++) {
    range.setStart(node, index);
    range.setEnd(node, index + 1);
    const rects = range.getClientRects();
    // A space swallowed by a line break has no box of its own: it stays on the line it ends.
    const rect = rects[rects.length - 1];
    if (!rect) { if (current) { current.end = index + 1; current.xs.push(current.xs[current.xs.length - 1]); } continue; }
    const left = origin.x + (rect.left - box.left) / scale, right = origin.x + (rect.right - box.left) / scale;
    const top = origin.y + (rect.top - box.top) / scale, bottom = origin.y + (rect.bottom - box.top) / scale;
    if (!current || top >= current.bottom - (bottom - top) / 2) {
      current = { top, bottom, start: index, end: index + 1, xs: [left, right] };
      lines.push(current);
    } else {
      current.end = index + 1;
      current.top = Math.min(current.top, top);
      current.bottom = Math.max(current.bottom, bottom);
      current.xs.push(Math.max(right, current.xs[current.xs.length - 1]));
    }
  }
  return joined(lines);
}
// Windows paints a selection over whole line boxes: the bands of two lines touch, and the caret
// changes line half-way between them. The glyph boxes read above are shorter than the line
// (line-height): each line is grown to meet its neighbours, the first and the last by as much.
export function joined(lines: TextLine[]): TextLine[] {
  if (lines.length < 2) return lines;
  const gaps = lines.slice(1).map((line, index) => Math.max(0, line.top - lines[index].bottom));
  const edge = gaps[0] / 2;
  return lines.map((line, index) => ({
    ...line,
    top: index === 0 ? line.top - edge : line.top - gaps[index - 1] / 2,
    bottom: index === lines.length - 1 ? line.bottom + (gaps[gaps.length - 1] ?? 0) / 2 : line.bottom + gaps[index] / 2,
  }));
}

// The rectangles of a range of the text on those lines (the changed words, the whole new text).
export function rangeRects(lines: readonly TextLine[], start: number, end: number): Rect[] {
  return selectionRects(lines, start, end);
}
