// The app's own code, imported as is (build.mjs `app-modules`: bare imports resolve from the lab's
// node_modules, and `:root[` in the app's CSS becomes `.dm-app[`). Nothing here is redrawn: the
// demo takes its values, springs, geometry, diff and CSS from the files the app ships.
//
//   src/motion/tokens.ts     motionPresets (enter / morph springs, exit / content curves, fromScale,
//                            travel), contentTiming, exitScale, emilOut, accelerate, surfaceMove,
//                            reducedFadeMs
//   src/motion/spring.ts     fromAppleDurationBounce + springSolver: the closed form Motion runs for
//                            { visualDuration: d / 1.2, bounce } (toMotionSpring)
//   src/motion/surface.ts    surfaceRadius (a pill is fully round up to 44 px high, else 16)
//   src/menu/metrics.ts      ilotMetrics (compact 32 high, tiles 66 × 50, grid 218 × 116, hover 450 ms)
//   src/layout.ts            ilotMenuShift (the grid opens right of the compact bubble)
//   src/loaders/pill.ts      workingPillShape, ORB_DELAY_MS
//   src/halo/geometry.ts     sweepStrip, sweepPositions, pad, inset (the halo's rectangles)
//   src/halo/HaloWindow.tsx  HALO_APPEAR_DELAY_MS is re-read below (the TSX needs the Tauri bridge)
//   src/result/highlight.ts  changedRanges: the SAME word diff decides which words are marked
//   src/result/countdown.ts  checkOnlyMs, undoMs (re-read below: the module imports a Settings view)
//   CSS: src/menu/ilot.css, src/result/result.css, src/loaders/loaders.css, src/halo/halo.css
export { motionPresets, contentTiming, exitScale, emilOut, accelerate, surfaceMove, reducedFadeMs } from '../../../../src/motion/tokens.ts';
export { fromAppleDurationBounce, springSolver } from '../../../../src/motion/spring.ts';
export { surfaceRadius } from '../../../../src/motion/surface.ts';
export { ilotMetrics } from '../../../../src/menu/metrics.ts';
export { ilotMenuShift, ilotStrip } from '../../../../src/layout.ts';
export { workingPillShape, ORB_DELAY_MS, indicatorBox } from '../../../../src/loaders/pill.ts';
export { sweepStrip, sweepPositions, pad, inset } from '../../../../src/halo/geometry.ts';
export { changedRanges } from '../../../../src/result/highlight.ts';
import '../../../../src/menu/ilot.css';
import '../../../../src/result/result.css';
import '../../../../src/loaders/loaders.css';
import '../../../../src/halo/halo.css';

// Values of modules that cannot be bundled here (they import the Tauri bridge or a Settings view):
// copied, with where they live. scripts/demo-check.mjs reads the app's
// files and fails if any of these drifted.
export const HALO_APPEAR_DELAY_MS = 250;   // src/halo/HaloWindow.tsx:10
export const CHECK_ONLY_MS = 1100;         // src/result/countdown.ts:24 (checkOnlyMs)
export const UNDO_MS = 8000;               // src/result/countdown.ts:26 undoMs(8): 8 s by default (types.ts:49)
export const UNDONE_MS = 900;              // src/result/ResultPill.tsx:83
export const MARKS_OUT_MS = 900;           // src/halo/halo.css:77 (.halo[data-phase="marks"] 900 ms)
export const HALO_FADE_MS = 150;           // src/halo/halo.css:6 (.halo transition 150 ms)
export const WAVE_MS = 1000;               // src/halo/halo.css:60 (halo-wave 1000 ms)
export const MARK_IN = { delay: 380, ms: 420 }; // src/halo/halo.css:64 (wave arrival)
export const CHECK_DRAW = { delay: 80, ms: 260 }; // src/result/result.css:16 (result-check-draw)
export const PILL_GAP = 8;                 // src-tauri/src/lib.rs:1298 (pill_after_paste gap 8) and placement.rs:14 (strip 8 px under the selection)
