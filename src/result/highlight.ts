import { diffTokens, tokenize, type DiffOp } from './diff';

/*
 * What to highlight after a replacement (docs/DA-PLAN.md lot 9, « Mots changés »): the words the
 * model changed while Undo is available, drawn by the native `halo` window over the rectangles
 * UI Automation gives for these ranges of the new text. This module only decides WHAT: ranges
 * of the result, never any text, never logged.
 *
 * API
 *   highlightModeFor(actionId)  'words' for Fix, Pro and Shorten (a word diff), 'block' for
 *                  Translate, Email and the free instruction (the whole new text), 'auto' for an
 *                  action the user created (decided from the diff itself).
 *   changedRanges(original, result, { actionId })  → { mode, ranges }: ranges of `result` in
 *                  UTF-16 code units (JavaScript string offsets, as Windows and UI Automation
 *                  count text), end excluded, sorted, disjoint, never empty, never starting or
 *                  ending on whitespace. mode 'none' (no range) when nothing changed or the
 *                  setting is off.
 *   changedHighlight  the look of the marks (design-lab/src/app.css:315-317), for the halo.
 *
 * Choices beyond the lab (which wraps each inserted run in its own span, Simulator.jsx:133,
 * 342-346):
 *   - an inserted run is trimmed of its outer whitespace, so no lone space is marked at the end
 *     of a line (UI Automation would give it a rectangle of its own);
 *   - two changed runs separated only by spaces or tabs (no line break) form one range: one mark
 *     per changed phrase, and fewer ranges to resolve through UI Automation (one cross-process
 *     call each). Unchanged words are never inside a range.
 *   - a word diff that would need more than `maxRanges` ranges, or a table of more than
 *     `maxCells` cells (the LCS is O(n·m) in memory), marks the whole block instead.
 */

export type HighlightMode = 'words' | 'block' | 'none';
export type TextRange = { start: number; end: number };
export type ChangedRanges = { mode: HighlightMode; ranges: TextRange[] };

// Action ids of src/actionDefaults.ts (and the 0.4 translations a migrated file keeps).
const wordActions: ReadonlySet<string> = new Set(['correct', 'professionalize', 'shorten']);
const blockActions: ReadonlySet<string> = new Set([
  'translate',
  'translate-fr',
  'translate-en',
  'email',
  'instruction',
]);

export function highlightModeFor(actionId: string): 'words' | 'block' | 'auto' {
  if (wordActions.has(actionId)) return 'words';
  if (blockActions.has(actionId)) return 'block';
  return 'auto';
}

// The lab's .chg-hold: a soft blue mark, 260 ms in, held while Undo is available (the pill's
// countdown, paused under the pointer: the halo follows the pill's end, not a fixed time), then
// 900 ms out. Radius 3 as the lab's line boxes.
export const changedHighlight = {
  color: 'rgba(141,159,255,.32)',
  radius: 3,
  in: { ms: 260, ease: 'ease-out' },
  out: { ms: 900, ease: 'ease-out' },
} as const;

export const highlightLimits = { maxRanges: 64, maxCells: 2_000_000 } as const;
// 'auto': a word diff when at least this share of the new text's visible characters is kept.
export const autoKeptShare = 0.5;

export type ChangedRangesOptions = {
  actionId: string;
  // settings.afterReplace.changedWords
  enabled?: boolean;
  maxRanges?: number;
  maxCells?: number;
};

const blank = /^\s*$/;
const inlineGap = /^[^\S\r\n]*$/;
const isSpace = (code: number) => /\s/.test(String.fromCharCode(code));

// The range without its outer whitespace (null when nothing is left).
function trimmed(text: string, start: number, end: number): TextRange | null {
  while (start < end && isSpace(text.charCodeAt(start))) start++;
  while (end > start && isSpace(text.charCodeAt(end - 1))) end--;
  return end > start ? { start, end } : null;
}

// The inserted runs of a diff, as trimmed ranges of the new text, joined across inline gaps.
export function insertedRanges(ops: readonly DiffOp[], result: string): TextRange[] {
  const ranges: TextRange[] = [];
  let at = 0;
  for (const op of ops) {
    if (op.type === 'del') continue;
    const start = at;
    at += op.text.length;
    if (op.type !== 'ins') continue;
    const range = trimmed(result, start, at);
    if (!range) continue;
    const last = ranges[ranges.length - 1];
    if (last && inlineGap.test(result.slice(last.end, range.start))) last.end = range.end;
    else ranges.push(range);
  }
  return ranges;
}

// Visible characters of the new text kept from the original (the eq runs), over all of them.
function keptShare(ops: readonly DiffOp[]): number {
  let kept = 0,
    total = 0;
  for (const op of ops) {
    if (op.type === 'del') continue;
    const visible = op.text.replace(/\s+/g, '').length;
    total += visible;
    if (op.type === 'eq') kept += visible;
  }
  return total ? kept / total : 1;
}

export function changedRanges(original: string, result: string, options: ChangedRangesOptions): ChangedRanges {
  const none: ChangedRanges = { mode: 'none', ranges: [] };
  if (options.enabled === false || original === result || blank.test(result)) return none;
  const whole = (): ChangedRanges => ({ mode: 'block', ranges: [trimmed(result, 0, result.length)!] });
  const wanted = highlightModeFor(options.actionId);
  if (wanted === 'block') return whole();
  const ops = diffTokens(tokenize(original), tokenize(result), options.maxCells ?? highlightLimits.maxCells);
  if (!ops) return whole();
  if (wanted === 'auto' && keptShare(ops) < autoKeptShare) return whole();
  const ranges = insertedRanges(ops, result);
  if (ranges.length > (options.maxRanges ?? highlightLimits.maxRanges)) return whole();
  return ranges.length ? { mode: 'words', ranges } : none;
}
