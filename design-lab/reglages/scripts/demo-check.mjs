// The Démo copies a few values it cannot import (their modules need the Tauri bridge or a Settings
// view): src/demo/app.js. This reads the app's files and fails when one of them drifted.
//   node scripts/demo-check.mjs
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const app = p => readFileSync(resolve('D:/src/Flow_Translate', p), 'utf8');
const demo = readFileSync(resolve('src/demo/app.js'), 'utf8');
const val = name => Number((demo.match(new RegExp(`export const ${name} = (\\d+)`)) || [])[1]);
const checks = [
  ['HALO_APPEAR_DELAY_MS', /HALO_APPEAR_DELAY_MS = (\d+)/, 'src/halo/HaloWindow.tsx'],
  ['CHECK_ONLY_MS', /checkOnlyMs = (\d+)/, 'src/result/countdown.ts'],
  ['UNDONE_MS', /undoneMs = (\d+)/, 'src/result/ResultPill.tsx'],
  ['MARKS_OUT_MS', /\.halo\[data-phase="marks"\] \{ transition: opacity (\d+)ms/, 'src/halo/halo.css'],
  ['HALO_FADE_MS', /\.halo \{[^}]*transition: opacity (\d+)ms/, 'src/halo/halo.css'],
  ['WAVE_MS', /animation: halo-wave (\d+)ms/, 'src/halo/halo.css'],
  ['PILL_GAP', /let gap = (\d+)\.0;/, 'src-tauri/src/placement.rs'],
];
let bad = 0;
for (const [name, re, file] of checks) {
  const m = app(file).match(re);
  const ours = val(name);
  const ok = m && Number(m[1]) === ours;
  if (!ok) bad++;
  console.log(`${ok ? 'ok ' : 'BAD'} ${name} = ${ours} (${file}: ${m ? m[1] : 'not found'})`);
}
// Structured values, read from their source lines.
const markIn = app('src/halo/halo.css').match(/data-arrival="wave"\] \.halo-mark \{ animation: halo-mark-in (\d+)ms ease-out (\d+)ms/);
const ours = demo.match(/MARK_IN = \{ delay: (\d+), ms: (\d+) \}/);
const okMark = markIn && ours && markIn[1] === ours[2] && markIn[2] === ours[1];
console.log(`${okMark ? 'ok ' : 'BAD'} MARK_IN (halo.css: ${markIn ? `${markIn[1]} ms after ${markIn[2]} ms` : 'not found'})`);
const draw = app('src/result/result.css').match(/result-check-draw (\d+)ms cubic-bezier\([^)]*\) (\d+)ms/);
const ourDraw = demo.match(/CHECK_DRAW = \{ delay: (\d+), ms: (\d+) \}/);
const okDraw = draw && ourDraw && draw[1] === ourDraw[2] && draw[2] === ourDraw[1];
console.log(`${okDraw ? 'ok ' : 'BAD'} CHECK_DRAW (result.css: ${draw ? `${draw[1]} ms after ${draw[2]} ms` : 'not found'})`);
const undo = app('src/result/countdown.ts').match(/Number\.isFinite\(seconds\) \? seconds : (\d+)/);
const okUndo = undo && Number(undo[1]) * 1000 === val('UNDO_MS');
console.log(`${okUndo ? 'ok ' : 'BAD'} UNDO_MS (countdown.ts default ${undo ? undo[1] : '?'} s)`);
if (!okMark) bad++; if (!okDraw) bad++; if (!okUndo) bad++;
process.exit(bad ? 1 : 0);
