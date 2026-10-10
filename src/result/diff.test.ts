import { describe, expect, it } from 'vitest';
import labSource from '../../design-lab/src/diff.js?raw';
import { diffTokens, tokenize, wordDiff, type DiffOp } from './diff';
import { changedRanges, highlightModeFor, insertedRanges, type TextRange } from './highlight';

// The lab's own diff (design-lab/src/diff.js), the reference the port must match exactly.
const lab = new Function(`${labSource.replace(/export function/g, 'function')}\nreturn { tokenize, wordDiff };`)() as {
  tokenize: (text: string) => string[];
  wordDiff: (a: string, b: string) => DiffOp[];
};

// Characters written by their code, to keep them visible here.
const combining = `cafe${String.fromCharCode(0x301)}`;
const noBreak = String.fromCharCode(0xa0);

// Deterministic pairs: a seeded generator (mulberry32), fictitious words only.
function generator(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let x = state;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number) => Math.floor(next() * n);
  const pick = <T>(list: readonly T[]) => list[int(list.length)];
  return { next, int, pick };
}
const words = [
  'the',
  'draft',
  'notes',
  'Claire',
  'réunion',
  'équipe',
  'l’équipe',
  'don’t',
  "it's",
  'e-mail',
  'GPU',
  'gpu',
  '10h',
  '10',
  'h',
  '6,000',
  'naïve',
  combining,
  'Straße',
  '日本語',
  'données',
  'serveur',
  'Monday',
  'monday',
  'a',
  'I',
  'i',
  'has',
  'read',
  'will',
  'follow',
];
const marks = [',', ';', '.', '!', '?', ':', '—', '«', '»', '(', ')', '🙂', '👍🏽', '"', '/'];
const spaces = [' ', ' ', ' ', ' ', '  ', '\n', '\r\n', '\t', noBreak, ' \n '];

function randomText(g: ReturnType<typeof generator>, length: number): string {
  let text = '';
  for (let i = 0; i < length; i++) {
    const roll = g.next();
    text += roll < 0.62 ? g.pick(words) : roll < 0.8 ? g.pick(marks) : g.pick(spaces);
    if (g.next() < 0.7) text += g.pick(spaces);
  }
  return text;
}
// b from a by a few edits of its tokens, as a model would change a sentence.
function edited(g: ReturnType<typeof generator>, a: string): string {
  const tokens = tokenize(a);
  const edits = g.int(7);
  for (let e = 0; e < edits; e++) {
    const at = g.int(tokens.length + 1);
    const kind = g.int(5);
    if (kind === 0 && tokens.length) tokens[Math.min(at, tokens.length - 1)] = g.pick(words);
    else if (kind === 1) tokens.splice(at, 0, g.pick(words), ' ');
    else if (kind === 2 && tokens.length) tokens.splice(Math.min(at, tokens.length - 1), 1);
    else if (kind === 3) tokens.splice(at, 0, g.pick(marks));
    else if (tokens.length > 2) {
      const i = g.int(tokens.length - 1);
      [tokens[i], tokens[i + 1]] = [tokens[i + 1], tokens[i]];
    }
  }
  return tokens.join('');
}
function pairs(count: number): Array<[string, string]> {
  const g = generator(20260924);
  const list: Array<[string, string]> = [
    ['', ''],
    ['', 'Hi'],
    ['Hi', ''],
    ['same text', 'same text'],
    ['a', 'b'],
    [' ', '\n'],
  ];
  while (list.length < count) {
    const a = randomText(g, g.int(40));
    list.push([a, g.next() < 0.12 ? randomText(g, g.int(40)) : edited(g, a)]);
  }
  return list;
}
const cases = pairs(2000);

// Longest common subsequence of two token lists, the plain way (no trimming, no merging).
function lcs(A: readonly string[], B: readonly string[]): number {
  let previous = new Array<number>(B.length + 1).fill(0);
  for (let i = 1; i <= A.length; i++) {
    const row = new Array<number>(B.length + 1).fill(0);
    for (let j = 1; j <= B.length; j++)
      row[j] = A[i - 1] === B[j - 1] ? previous[j - 1] + 1 : Math.max(previous[j], row[j - 1]);
    previous = row;
  }
  return previous[B.length];
}
const join = (ops: readonly DiffOp[], keep: 'del' | 'ins') =>
  ops
    .filter((op) => op.type === 'eq' || op.type === keep)
    .map((op) => op.text)
    .join('');
const visible = /\S/;

describe('tokenize', () => {
  it('cuts words, whitespace runs and every other code point, and joins back to the text', () => {
    expect(tokenize("l’équipe, don't — 10h👍🏽")).toEqual([
      'l’équipe',
      ',',
      ' ',
      "don't",
      ' ',
      '—',
      ' ',
      '10h',
      '👍',
      '🏽',
    ]);
    expect(tokenize(`${combining}\r\n\tok`)).toEqual([combining, '\r\n\t', 'ok']);
    expect(tokenize('')).toEqual([]);
    for (const [a, b] of cases) {
      expect(tokenize(a).join('')).toBe(a);
      expect(tokenize(b)).toEqual(lab.tokenize(b));
    }
  });
});

describe('wordDiff (port of design-lab/src/diff.js)', () => {
  it('gives exactly the lab’s operations on 2,000 generated pairs', () => {
    expect(cases.length).toBe(2000);
    for (const [a, b] of cases) expect(wordDiff(a, b)).toEqual(lab.wordDiff(a, b));
  });

  it('rebuilds both texts, merges its runs, and keeps a longest common subsequence', () => {
    for (const [a, b] of cases) {
      const ops = wordDiff(a, b);
      expect(join(ops, 'del')).toBe(a);
      expect(join(ops, 'ins')).toBe(b);
      for (const [i, op] of ops.entries()) {
        expect(op.text).not.toBe('');
        if (i) expect(op.type).not.toBe(ops[i - 1].type);
      }
      const kept = ops.filter((op) => op.type === 'eq').reduce((sum, op) => sum + tokenize(op.text).length, 0);
      expect(kept).toBe(lcs(tokenize(a), tokenize(b)));
    }
  });

  it('diffs the lab’s first paragraph as the lab does', () => {
    const ops = wordDiff(
      'Hi Claire, thanks for you notes on the draft, I has read them all yesterday evening.',
      'Hi Claire, thanks for your notes on the draft; I read them all yesterday evening.',
    );
    expect(ops.filter((op) => op.type === 'ins').map((op) => op.text)).toEqual(['your', ';']);
    expect(ops.filter((op) => op.type === 'del').map((op) => op.text)).toEqual(['you', ',', ' has']);
  });

  it('gives up past its table limit, and only then', () => {
    const A = tokenize('one two three'),
      B = tokenize('four five six');
    expect(diffTokens(A, B, 5 * 6 - 1)).toBeNull();
    expect(diffTokens(A, B, 6 * 6)).toEqual(wordDiff('one two three', 'four five six'));
  });
});

// Where each token of the new text starts, and whether the diff kept it.
function resultTokens(ops: readonly DiffOp[]) {
  const tokens: Array<{ start: number; end: number; text: string; kept: boolean }> = [];
  let at = 0;
  for (const op of ops) {
    if (op.type === 'del') continue;
    for (const text of tokenize(op.text)) {
      tokens.push({ start: at, end: at + text.length, text, kept: op.type === 'eq' });
      at += text.length;
    }
  }
  return tokens;
}
const overlaps = (range: TextRange, start: number, end: number) => range.start < end && start < range.end;
const isHigh = (code: number) => code >= 0xd800 && code <= 0xdbff;

describe('changed ranges', () => {
  it('never marks an unchanged word, marks every inserted one, and stays within clean bounds (2,000 pairs)', () => {
    for (const [a, b] of cases) {
      const ops = wordDiff(a, b);
      const ranges = insertedRanges(ops, b);
      for (const [i, range] of ranges.entries()) {
        expect(range.start).toBeGreaterThanOrEqual(0);
        expect(range.end).toBeLessThanOrEqual(b.length);
        expect(range.end).toBeGreaterThan(range.start);
        expect(b[range.start]).toMatch(/\S/);
        expect(b[range.end - 1]).toMatch(/\S/);
        expect(isHigh(b.charCodeAt(range.end - 1))).toBe(false);
        if (i) {
          // Sorted, disjoint, and apart only where something visible or a line break separates them.
          expect(range.start).toBeGreaterThan(ranges[i - 1].end);
          expect(b.slice(ranges[i - 1].end, range.start)).toMatch(/[^\s]|[\r\n]/);
        }
      }
      for (const token of resultTokens(ops)) {
        if (!visible.test(token.text)) continue;
        const marked = ranges.filter((range) => overlaps(range, token.start, token.end));
        if (token.kept) expect(marked).toEqual([]);
        else expect(marked.some((range) => range.start <= token.start && token.end <= range.end)).toBe(true);
      }
    }
  });

  it('marks the lab’s corrections word by word, joined across a space', () => {
    const before =
      'The appendix will follow on monday, we still waiting for the final numbers from finance and i dont want to send something wrong.';
    const after =
      'The appendix will follow on Monday; we are still waiting for the final numbers from finance, and I don’t want to send anything wrong.';
    const { mode, ranges } = changedRanges(before, after, { actionId: 'correct' });
    expect(mode).toBe('words');
    expect(ranges.map((range) => after.slice(range.start, range.end))).toEqual([
      'Monday;',
      'are',
      ',',
      'I don’t',
      'anything',
    ]);
  });

  it('decides the mode from the action: words for Fix, Pro and Shorten, the block for the others', () => {
    expect(['correct', 'professionalize', 'shorten'].map(highlightModeFor)).toEqual(['words', 'words', 'words']);
    expect(['translate', 'translate-fr', 'translate-en', 'email', 'instruction'].map(highlightModeFor)).toEqual([
      'block',
      'block',
      'block',
      'block',
      'block',
    ]);
    expect(highlightModeFor('my-own-action')).toBe('auto');
    const after = '\nBonjour Claire, merci pour tes remarques.\n';
    expect(changedRanges('Hi Claire, thanks for your notes.', after, { actionId: 'translate' })).toEqual({
      mode: 'block',
      ranges: [{ start: 1, end: after.length - 1 }],
    });
  });

  it('marks nothing when the setting is off, when nothing changed, or when the result is blank', () => {
    expect(changedRanges('a b', 'a c', { actionId: 'correct', enabled: false })).toEqual({ mode: 'none', ranges: [] });
    expect(changedRanges('same', 'same', { actionId: 'translate' })).toEqual({ mode: 'none', ranges: [] });
    expect(changedRanges('text', '  \n', { actionId: 'email' })).toEqual({ mode: 'none', ranges: [] });
    // Only a deletion: nothing inserted to mark.
    expect(changedRanges('a very long text', 'a long text', { actionId: 'shorten' })).toEqual({
      mode: 'none',
      ranges: [],
    });
  });

  it('decides a user action from the diff: words when most of the text is kept, else the block', () => {
    const before = 'Please send the report before Friday so we can review it.';
    const light = changedRanges(before, 'Please send the final report before Friday so we can review it.', {
      actionId: 'formal',
    });
    expect(light.mode).toBe('words');
    const rewritten = changedRanges(before, 'Kindly deliver your findings ahead of the weekly meeting.', {
      actionId: 'formal',
    });
    expect(rewritten).toEqual({ mode: 'block', ranges: [{ start: 0, end: 57 }] });
  });

  it('marks the whole block past its limits (too many ranges, too large a table)', () => {
    const before = Array.from({ length: 10 }, (_, i) => `w${i} x`).join(' ');
    const after = Array.from({ length: 10 }, (_, i) => `v${i} x`).join(' ');
    expect(changedRanges(before, after, { actionId: 'correct' }).ranges.length).toBe(10);
    expect(changedRanges(before, after, { actionId: 'correct', maxRanges: 9 })).toEqual({
      mode: 'block',
      ranges: [{ start: 0, end: after.length }],
    });
    expect(changedRanges(before, after, { actionId: 'correct', maxCells: 100 })).toEqual({
      mode: 'block',
      ranges: [{ start: 0, end: after.length }],
    });
  });
});
