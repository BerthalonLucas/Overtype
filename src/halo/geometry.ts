import type { Rect } from '../types';

// The lines of the halo as one strip laid end to end (DA-PLAN lot 6: the gradient is
// continuous from one line to the next). `offset` is where a line starts on the strip,
// `total` the strip's length: the sweep's band leaves the end of a line and enters the
// start of the next one, in reading order. Logical pixels, as Rust sends them.
export type SweepLine = Rect & { offset: number };

export function sweepStrip(lines: readonly Rect[]): { lines: SweepLine[]; total: number } {
  let total = 0;
  const strip = lines.map((line) => {
    const placed = { ...line, offset: total };
    total += line.width;
    return placed;
  });
  return { lines: strip, total };
}

// The lab's keyframes (.tfx-sweep: background-size 300 %, background-position 120 % → -20 %)
// computed on the strip instead of each line: for an image three strips long, a position
// of p % moves it by p × (1 − 3) × total. One line alone gets exactly the lab's pixels.
export function sweepPositions(total: number, offset: number): { from: number; to: number } {
  return { from: -2.4 * total - offset, to: 0.4 * total - offset };
}

// The lab's own margins (design-lab/mise-en-valeur.html): a rectangle grown by `dx`, `dy` on
// each side (the bands, the tint, the veil, the wave, the marks), or shrunk by `n` (the text
// box's line and aurora stay inside the field).
export function pad(rect: Rect, dx: number, dy = 0): Rect {
  return { x: rect.x - dx, y: rect.y - dy, width: rect.width + 2 * dx, height: rect.height + 2 * dy };
}

export function inset(rect: Rect, n: number): Rect {
  return {
    x: rect.x + n,
    y: rect.y + n,
    width: Math.max(0, rect.width - 2 * n),
    height: Math.max(0, rect.height - 2 * n),
  };
}
