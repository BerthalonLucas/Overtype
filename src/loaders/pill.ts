import type { Indicator } from '../types';
import { surfaceRadius, type SurfaceShape } from '../motion/surface';

// The working pill of lot 8 (docs/DA-PLAN.md, lot 8 and §9 « Indicateurs »): while the model
// works, a small glass pill holds the chosen indicator, centred, and nothing textual. It is the
// lab's `.pill-row` (design-lab/src/app.css:155): 28 px high, 12 px each side of its content,
// never narrower than 44 px, fully round (Surface.jsx:70). The pill never grows while it works:
// its width is decided by the indicator alone, before the orb shows.
export const workingPill = { height: 28, paddingX: 12, minWidth: 44 } as const;

// The orb waits 250 ms (design-lab/src/data.js:158, loaderDelay): a faster answer only ever
// shows the empty pill. It then fades in over 150 ms (loaders.css .working-orb: the plan's lot 8;
// the lab shows it at once).
export const ORB_DELAY_MS = 250;

export const indicators: readonly Indicator[] = ['perle', 'nebuleuse', 'ruban'];
// The box each indicator paints at its default parameters: .perle --size 14px and .neb --size
// 16px (design-lab/src/loaders.css:51, 58), the Ruban's svg 28 × 12 (loaders.jsx:112). The slot
// reserves it from the start (the lab's placeholder is 14 px whatever the indicator, which made
// its Ruban pill grow from 44 to 52 px when the orb showed).
export const indicatorBox: Record<Indicator, { width: number; height: number }> = {
  perle: { width: 14, height: 14 },
  nebuleuse: { width: 16, height: 16 },
  ruban: { width: 28, height: 12 },
};

// Settings come from Rust: anything unknown shows the default, Perle.
export function indicatorOf(value: unknown): Indicator {
  return indicators.includes(value as Indicator) ? (value as Indicator) : 'perle';
}

// 44 × 28 for Perle and Nébuleuse, 52 × 28 for the Ruban, radius 14.
export function workingPillShape(indicator: Indicator): Required<SurfaceShape> {
  const box = indicatorBox[indicator];
  const width = Math.max(workingPill.minWidth, box.width + 2 * workingPill.paddingX);
  return { width, height: workingPill.height, borderRadius: surfaceRadius(workingPill.height) };
}
