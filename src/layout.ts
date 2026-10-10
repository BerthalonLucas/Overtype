import type { AutoClose, Form, HitRegion, PillTarget, Presentation, Rect, Screen, TextSize } from './types';
import { ilotMetrics } from './menu/metrics';
import { surfaceRadius } from './motion/surface';

// Calibrated reading (2026-09-14): two forms decided once, on the real result. The short
// glass (≤ 8 lines at 380 px) opens beside the selection; anything longer is a reader
// band centred on the bottom of the screen, half its work area wide, never a hard-coded
// size. The pill bites the upper-right edge of the glass by 14 px (design « 1a »).
export const glass = {
  shortWidth: 380,
  radius: 28,
  pillHeight: 28,
  pillInset: 16,
  overlap: 14,
  menuWidth: 196,
  menuTop: 20,
  // Text paddings: top, side, bottom (short glass / reader band).
  shortPadding: { top: 16, side: 22, bottom: 13 },
  readerPadding: { top: 18, side: 28, bottom: 16 },
  waitPill: { width: 60, height: 28 },
};
export const COMPACT_MAX_LINES = 8;
// Shadow halo around the tight regions in the packaged window (glass.css carries the same values).
export const halo = { x: 32, top: 20, bottom: 44, bottomForm: 16 };
// The tallest menu: six entries (Original, Remplacer or Réessayer, Relancer, Réglages,
// Fermer, one spare) of 32.9 px each, 4 px padding and a 1 px border each side, a 1 px
// separator with 3 px margins. The reserve keeps room for a seventh entry.
export const menu = { width: 196, reserve: 236 };

// Font size / line height of each form, per preset (Réglages « Taille du texte »).
export const presets: Record<TextSize, { short: [number, number]; reader: [number, number] }> = {
  normal: { short: [16, 24], reader: [22, 33] },
  large: { short: [18, 27], reader: [24, 36] },
  xlarge: { short: [20, 30], reader: [26, 39] },
};

export type ShortMetrics = {
  width: number;
  fontSize: number;
  lineHeight: number;
  maxHeight: number;
  minHeight: number;
};
export type ReaderMetrics = { width: number; fontSize: number; lineHeight: number; maxHeight: number };

export function shortMetrics(preset: TextSize): ShortMetrics {
  const [fontSize, lineHeight] = presets[preset].short;
  const { top, bottom } = glass.shortPadding;
  return {
    width: glass.shortWidth,
    fontSize,
    lineHeight,
    maxHeight: COMPACT_MAX_LINES * lineHeight + top + bottom,
    minHeight: lineHeight + top + bottom,
  };
}

// The band: half the work area wide, at most 45 % of its height, whole lines only.
export function readerMetrics(screen: Pick<Screen, 'width' | 'height'>, preset: TextSize): ReaderMetrics {
  const [fontSize, lineHeight] = presets[preset].reader;
  const { top, bottom } = glass.readerPadding;
  const width = Math.max(320, Math.round(screen.width * 0.5));
  const lines = Math.max(2, Math.floor((Math.round(screen.height * 0.45) - top - bottom) / lineHeight));
  return { width, fontSize, lineHeight, maxHeight: lines * lineHeight + top + bottom };
}

// ≤ 8 lines at the short width read beside the selection; more is a reader.
export function decideForm(lines: number): Exclude<Form, 'pending'> {
  return lines <= COMPACT_MAX_LINES ? 'short' : 'reader';
}
// Where the wait pill and then the glass live is decided at the capture, on the source
// text: a translation is about as long as its source, so a source past the short glass
// waits at the bottom from the start and the band is born there, without any jump from
// the selection (UI-025). A capture without an anchor lives at the bottom anyway.
export function decidePlacement(anchored: boolean, sourceLines: number): Presentation {
  return anchored && sourceLines <= COMPACT_MAX_LINES ? 'anchored' : 'bottom';
}

// The native window is reserved once per form so a menu or feedback never resizes it:
// anchored, the short glass and the menu under its pill; bottom, the reader band and the
// menu above its pill. Both hold the halo that carries the shadows.
export const anchoredFloor = halo.top + glass.overlap + glass.menuTop + menu.reserve + halo.bottom; // 334
export const anchoredReserve = { width: glass.shortWidth + 2 * halo.x }; // 444
export function bottomReserve(screen: Pick<Screen, 'width' | 'height'>, preset: TextSize) {
  const reader = readerMetrics(screen, preset);
  // top halo, menu, 6 px gap, pill band, reader glass, bottom halo
  return {
    width: reader.width + 2 * halo.x,
    height: halo.top + menu.reserve + 6 + glass.overlap + reader.maxHeight + halo.bottomForm,
  };
}

// The Îlot (lot 7) has its own window, reserved once per capture for its largest shapes: the
// widest (the error pill of lot 10, 400, wider than the field's 283) by the tallest (the grid,
// 116), src/menu/metrics.ts, plus the halo. Its shapes then only change the hit-test regions,
// never the window (plan §4.3: the reserve holds « the Îlot's grid or the error card »).
//   anchored  `frame` is the compact strip that Rust places beside the selection like the glass
//             (8 px under it, or 8 px over it when the room below is short; its right edge on the
//             selection's end, clamped into the work area): 283 × 32, the widest shape of the
//             menu (the field), so the Îlot only leaves the selection's end when that end is less
//             than 283 px from the work area's left edge, as before lot 10. The Îlot hangs from
//             the strip's right edge and grows away from the selection, by at most 84 px: the
//             reserve keeps that room on both sides, since the side is only known once Rust placed
//             the window (ilotSide). The error pill, up to 117 px wider than the strip, grows left
//             like every shape; the reserve keeps those 117 px on the strip's left. On its right it
//             keeps 251 px: the menu opens right of the compact bubble when the work area has room
//             there (ilotMenuShift), the field (283) growing from the narrowest compact (32); the
//             error pill slides there too, by 117 px at most, when the work area's left edge is
//             closer than its width (ilotShift). Rust clamps the strip only: the transparent
//             reserve around it may leave the work area. 715 × 264.
//   bottom    no anchor (clipboard): the box rests on the window's bottom edge, centred, and
//             grows up; Rust docks the window bottom-centre. 464 × 152.
// Lot 9: after Rust's own paste the pill leaves the strip's corner for the place Rust gives it
// (`result_pill`, under the new text): its corner then sits `x` right of and `y` below the strip's
// (ilotPlace), in the same window, or the window moves first (`move_overlay`) when that place is
// outside it.
export type IlotSide = 'below' | 'above';
// shift: how far the shape's corner sits right of the strip's (ilotShift: the pill's place and the
// slide that keeps it on the screen); dy: below it (the pill's place). Anchored only.
export type IlotShapeBox = { width: number; height: number; shift?: number; dy?: number };
// The strip Rust clamps: the menu's widest shape.
export const ilotStrip = Math.max(ilotMetrics.prompt.width, ilotMetrics.grid.width);
export const ilotBox = { width: Math.max(ilotStrip, ilotMetrics.error.maxWidth), height: ilotMetrics.grid.height };
// What the widest shape overhangs the strip by: the reserve's room on the strip's left, and the
// error pill's slide on its right.
const ilotSpare = ilotBox.width - ilotStrip;
// The reserve's room on the strip's right: the menu opening right (ilotMenuShift), its widest
// shape from the narrowest compact, or the error pill's slide.
const ilotRightSpare = Math.max(ilotSpare, ilotStrip - ilotMetrics.compactMinWidth);
const ilotGrowth = ilotBox.height - ilotMetrics.compactHeight;
export function ilotReserve(presentation: Presentation): { width: number; height: number; frame: HitRegion } {
  if (presentation === 'bottom')
    return {
      width: ilotBox.width + 2 * halo.x,
      height: halo.top + ilotBox.height + halo.bottomForm,
      frame: { x: halo.x, y: halo.top, width: ilotBox.width, height: ilotBox.height, radius: 0 },
    };
  const y = halo.top + ilotGrowth;
  return {
    width: halo.x + ilotSpare + ilotStrip + ilotRightSpare + halo.x,
    height: y + ilotMetrics.compactHeight + ilotGrowth + halo.bottom,
    frame: { x: halo.x + ilotSpare, y, width: ilotStrip, height: ilotMetrics.compactHeight, radius: 0 },
  };
}
// Lucas, 24/09: the menu opens right of where the compact bubble was when the work area has room
// there for its widest shape (the field), else left from the strip's corner as before, near the
// screen's right edge. Opening right, a menu shape keeps the compact's left edge: its corner sits
// right of the strip's by what it outgrows the compact, on the shape's own spring. null: it opens
// left (ilotShift), also while the compact's width or the room is unknown (the browser preview).
export function ilotMenuShift(width: number, compactWidth: number | null, room: IlotRoom | null): number | null {
  if (!room || !compactWidth) return null;
  const reach = ilotStrip - compactWidth;
  if (reach > ilotRightSpare || room.right < reach) return null;
  return Math.max(0, width - compactWidth);
}
// The room around the strip's right edge (the corner facing the selection's end) inside the work
// area, logical pixels: `left` to its left edge, `right` to its right edge. From where Rust put the
// window and the work area of the anchor's screen, both physical (the anchor's own units).
export type IlotRoom = { left: number; right: number };
export function ilotRoom(windowX: number, scale: number, work: Pick<Rect, 'x' | 'width'>): IlotRoom {
  const corner = windowX + (ilotReserve('anchored').frame.x + ilotStrip) * scale;
  return { left: (corner - work.x) / scale, right: (work.x + work.width - corner) / scale };
}
// How far right of the strip's corner a shape's corner sits: `x`, the pill's place after the paste
// (0 before; ilotPlace, placeX), then a slide so the shape stays in the work area: nothing while it
// fits left of its corner (always at the strip's corner, up to the strip's width: Rust clamped the
// strip), else what it overhangs, whole pixels. Whatever the place, the corner never goes past the
// reserve's room right of the strip nor the work area's right edge, and the shape's left edge
// keeps the halo's room in the window: its shadow is never cut. Unknown room: no slide (the browser preview, a screen the
// point is not on).
export function ilotShift(width: number, room: IlotRoom | null, x = 0): number {
  const at = room && { left: room.left + x, right: room.right - x };
  const overhang = at ? Math.ceil(width - at.left) : 0;
  const slide = at && overhang > 0 ? Math.max(0, Math.min(overhang, ilotRightSpare - x, Math.floor(at.right))) : 0;
  const corner = ilotReserve('anchored').frame.x + ilotStrip;
  const high = room ? Math.min(ilotRightSpare, Math.floor(room.right)) : ilotRightSpare;
  return Math.max(width - corner + halo.x, Math.min(x + slide, high));
}
// Lot 9: where the pill goes after Rust's paste, from `result_pill` (its top-left corner in the
// window as it stands, logical) for a pill of `size`: the offset of its corner from the strip's,
// the corner facing the selection the Îlot keeps (its right edge; its top below the selection, its
// bottom above it). In the margin (right of the text, `side: 'margin'`) the pill keeps its left
// edge instead, so a wider shape never grows over the text.
export type IlotPlace = { x: number; y: number; width: number; keepLeft: boolean };
// Whole pixels (Rust answers in logical pixels, fractional at 125 or 150 %): a translation by a
// fraction would blur the pill's text.
export function ilotPlace(
  target: Pick<PillTarget, 'x' | 'y' | 'side'>,
  size: { width: number; height: number },
  side: IlotSide,
): IlotPlace {
  const { frame } = ilotReserve('anchored');
  return {
    x: Math.round(target.x + size.width - (frame.x + frame.width)),
    y: Math.round(side === 'below' ? target.y - frame.y : target.y + size.height - (frame.y + frame.height)),
    width: size.width,
    keepLeft: target.side === 'margin',
  };
}
// The corner's place for a shape of `width` at that place (before any slide): the right edge
// kept, or the left edge in the margin. No place: the strip's corner.
export function placeX(place: IlotPlace | null, width: number): number {
  return !place ? 0 : place.keepLeft ? place.x + width - place.width : place.x;
}
// Whether a pill of `size` at that target lies inside the reserved window with its shadow's room
// (the halo: 32 px on each side, 20 above, 44 below): any closer to an edge, the window would cut
// the shadow, and the window moves instead (`move_overlay`).
export function ilotFits(target: Pick<PillTarget, 'x' | 'y'>, size: { width: number; height: number }): boolean {
  const reserve = ilotReserve('anchored');
  return (
    target.x >= halo.x &&
    target.y >= halo.top &&
    target.x + size.width <= reserve.width - halo.x &&
    target.y + size.height <= reserve.height - halo.bottom
  );
}
// The hit-test region of a shape in that window. Given several shapes (the start of a change, a
// pill on its way to its place), the box that holds them all: they share the corner, or the
// bottom edge, that faces the selection (each moved by its own shift and dy), and the smaller
// radius keeps every corner inside. Whole pixels, inside the window.
export function ilotRegion(presentation: Presentation, side: IlotSide, ...shapes: IlotShapeBox[]): HitRegion {
  const reserve = ilotReserve(presentation);
  const { frame } = reserve;
  const height = Math.min(reserve.height, Math.ceil(Math.max(...shapes.map((shape) => shape.height))));
  const bottomEdge = frame.y + frame.height;
  const round = (width: number, tall = height) =>
    Math.min(...shapes.map((shape) => surfaceRadius(shape.height)), width / 2, tall / 2);
  if (presentation === 'bottom') {
    const width = Math.min(reserve.width, Math.ceil(Math.max(...shapes.map((shape) => shape.width))));
    const x = Math.max(0, Math.floor((reserve.width - width) / 2));
    return {
      x,
      y: Math.max(0, bottomEdge - height),
      width: Math.min(reserve.width - x, Math.ceil((reserve.width + width) / 2) - x),
      height,
      radius: round(width),
    };
  }
  const corner = frame.x + frame.width;
  const x = Math.max(0, Math.floor(Math.min(...shapes.map((shape) => corner + (shape.shift ?? 0) - shape.width))));
  const width = Math.min(reserve.width, Math.ceil(Math.max(...shapes.map((shape) => corner + (shape.shift ?? 0))))) - x;
  // Each shape hangs from the strip's top (below the selection) or rests on its bottom (above).
  const tops = shapes.map((shape) => (side === 'below' ? frame.y : bottomEdge - shape.height) + (shape.dy ?? 0));
  const y = Math.max(0, Math.floor(Math.min(...tops)));
  const bottom = Math.min(
    reserve.height,
    Math.ceil(Math.max(...shapes.map((shape, index) => tops[index] + shape.height))),
  );
  return { x, y, width, height: bottom - y, radius: round(width, Math.min(height, bottom - y)) };
}
// Which side of its anchor Rust put a window's `frame` (the region it anchors: the Îlot's strip,
// the glass or its footprint), read back from the window's top (physical pixels, like the anchor)
// and the frame's top in the window (logical): the frame below the middle of the selection means
// below.
export function frameSide(windowTop: number, frameTop: number, scale: number, anchor: Rect): IlotSide {
  return windowTop + frameTop * scale >= anchor.y + anchor.height / 2 ? 'below' : 'above';
}
export function ilotSide(windowTop: number, scale: number, anchor: Rect): IlotSide {
  return frameSide(windowTop, ilotReserve('anchored').frame.y, scale, anchor);
}

// Reading budget: orientation plus 350 ms per word, between 5 s and 30 s (short) or 90 s
// (reader), scaled by the « Fermeture automatique » setting; null means never.
export const autoCloseFactor: Record<AutoClose, number | null> = { fast: 0.7, normal: 1, slow: 1.5, never: null };
export function readingBudget(words: number, form: Exclude<Form, 'pending'>, autoClose: AutoClose): number | null {
  const factor = autoCloseFactor[autoClose];
  if (factor === null) return null;
  const orientation = form === 'reader' ? 1500 : 1000;
  const ceiling = form === 'reader' ? 90000 : 30000;
  return Math.round(Math.min(ceiling, Math.max(5000, orientation + 350 * words)) * factor);
}
export const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

// After a visit of at least a second, leaving with the pointer shortens what remains to
// four seconds, never below two and a half: the reader has said « done ».
export const LEAVE_REMAINING = 4000;
export const LEAVE_FLOOR = 2500;
export function remainingAfterLeave(remaining: number, visitMs: number): number {
  if (visitMs < 1000) return Math.max(remaining, LEAVE_FLOOR);
  return Math.max(LEAVE_FLOOR, Math.min(remaining, LEAVE_REMAINING));
}
// Dimming: to 55 % in 600 ms, held 1.4 s, then the 300 ms exit. Any approach grants 5 s.
export const dimming = { opacity: 0.55, fadeMs: 600, holdMs: 1400, exitMs: 300, graceMs: 5000 };
