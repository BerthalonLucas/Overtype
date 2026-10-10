import type { ChangedWordsStyle, HaloTone, Rect } from '../types';

// The changed words of 0.6 (Lucas, 30/09 and 01/10): the TEXT itself glows, no box. The halo is
// a window laid over another application's text: it cannot recolour that application's glyphs,
// it can only paint over them. So:
//   with a mask     Rust reads the pixels of the changed words once and hands the page an image
//                   whose alpha is the glyphs (`HaloRun.masks`); the page paints the ink through
//                   it (CSS mask-image), exactly on the letters, and a glow that follows them;
//   without a mask  (not read, refused, too large) a feathered light around the word: no edge,
//                   no outline, nothing a box could be told from. « Éclat » adds its thin line.
// Never logged: a mask is a picture of the user's text.

export type Rgb = readonly [number, number, number];
export type HaloMask = { rect: Rect; image: string };

// The lab's inks (design-lab/reglages/src/demo/demo.css:71-87): deeper on a light ground, pastel
// on a dark one. « Éclat » is one ink (a deep night blue, or white).
export const inkStops: Record<ChangedWordsStyle, Record<HaloTone, readonly Rgb[]>> = {
  encre: {
    light: [
      [74, 85, 214],
      [122, 63, 201],
      [168, 51, 106],
    ],
    dark: [
      [174, 188, 255],
      [213, 182, 255],
      [245, 163, 181],
    ],
  },
  eclat: {
    light: [
      [13, 20, 64],
      [13, 20, 64],
      [13, 20, 64],
    ],
    dark: [
      [255, 255, 255],
      [255, 255, 255],
      [255, 255, 255],
    ],
  },
};

const channel = (value: number) => {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
export const luminance = ([r, g, b]: Rgb) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
export function contrast(a: Rgb, b: Rgb): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

// The ink kept readable on the ground Rust read: pushed towards black (or white, on a ground
// darker than the point where both contrast alike) until it reaches `min`:1. Black or white
// always reaches 4.5:1 on any ground, so the loop ends on a readable colour.
export function readable(ink: Rgb, ground: Rgb, min = 4.5): Rgb {
  const towards = luminance(ground) > 0.179 ? 0 : 255;
  for (let step = 0; step <= 50; step++) {
    const k = step / 50;
    const mixed = ink.map((value) => Math.round(value + (towards - value) * k)) as unknown as Rgb;
    if (contrast(mixed, ground) >= min) return mixed;
  }
  return [towards, towards, towards];
}

// The three stops of the ink for a run: the lab's, made readable on the ground when it is known.
export function inkFor(style: ChangedWordsStyle, tone: HaloTone, ground?: Rgb | null): readonly Rgb[] {
  const stops = inkStops[style][tone];
  return ground ? stops.map((stop) => readable(stop, ground)) : stops;
}

// What the page accepts as a mask: a PNG data URL (nothing fetched, nothing else decoded), of a
// sane size, on a real rectangle; 64 at most. Anything else is dropped and its word falls back
// to the light without a mask.
const MASK_PREFIX = 'data:image/png;base64,';
export const MASK_MAX_LENGTH = 400_000;
export const MASK_MAX_COUNT = 64;
const real = (rect: Rect | undefined): rect is Rect =>
  !!rect && [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) && rect.width > 0 && rect.height > 0;
export function usableMasks(masks: unknown): HaloMask[] {
  if (!Array.isArray(masks)) return [];
  return (masks as Partial<HaloMask>[])
    .filter(
      (mask): mask is HaloMask =>
        !!mask &&
        typeof mask.image === 'string' &&
        mask.image.startsWith(MASK_PREFIX) &&
        mask.image.length <= MASK_MAX_LENGTH &&
        /^[A-Za-z0-9+/=]+$/.test(mask.image.slice(MASK_PREFIX.length)) &&
        real(mask.rect),
    )
    .slice(0, MASK_MAX_COUNT);
}

// The mask that belongs to a line of changed words: the one covering most of it (half at least).
export function maskOf(line: Rect, masks: readonly HaloMask[]): HaloMask | null {
  let best: HaloMask | null = null,
    most = 0;
  for (const mask of masks) {
    const w = Math.min(line.x + line.width, mask.rect.x + mask.rect.width) - Math.max(line.x, mask.rect.x);
    const h = Math.min(line.y + line.height, mask.rect.y + mask.rect.height) - Math.max(line.y, mask.rect.y);
    const share = w > 0 && h > 0 ? (w * h) / (line.width * line.height) : 0;
    if (share >= 0.5 && share > most) {
      best = mask;
      most = share;
    }
  }
  return best;
}
