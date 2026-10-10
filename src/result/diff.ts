// Word diff of lot 9 (docs/DA-PLAN.md): a TypeScript port of the design lab's LCS diff
// (design-lab/src/diff.js), the reference. Same tokens, same trimming of the common prefix and
// suffix, same tie-break (a deletion before an insertion), same merged runs: diff.test.ts checks
// the port against the lab's own source on 2,000 generated pairs.
// Pure functions on strings and indices: nothing here reads, stores or logs the text.

export type DiffOpType = 'eq' | 'del' | 'ins';
export type DiffOp = { type: DiffOpType; text: string };

// Words (letters, digits, marks, apostrophes, hyphens), whitespace runs, and any other code
// point on its own (diff.js:2-4): joining the tokens gives the text back exactly.
const token = /[\p{L}\p{N}\p{M}'’-]+|\s+|[^\s\p{L}\p{N}\p{M}]/gu;
export function tokenize(text: string): string[] {
  return text.match(token) ?? [];
}

// LCS diff of two token lists, merged into runs (diff.js:9-32). O(n·m) time and memory on what
// remains once the common prefix and suffix are set aside; `maxCells` bounds that table: past it
// the answer is null (the caller then highlights the whole block rather than pay for it).
export function diffTokens(A: readonly string[], B: readonly string[], maxCells = Infinity): DiffOp[] | null {
  const n = A.length,
    m = B.length;
  // Trim the common prefix and suffix first (cheap, a huge win for small edits).
  let p = 0;
  while (p < n && p < m && A[p] === B[p]) p++;
  let s = 0;
  while (s < n - p && s < m - p && A[n - 1 - s] === B[m - 1 - s]) s++;
  const a2 = A.slice(p, n - s),
    b2 = B.slice(p, m - s),
    N = a2.length,
    M = b2.length;
  if ((N + 1) * (M + 1) > maxCells) return null;
  const L = Array.from({ length: N + 1 }, () => new Uint32Array(M + 1));
  for (let i = N - 1; i >= 0; i--)
    for (let j = M - 1; j >= 0; j--)
      L[i][j] = a2[i] === b2[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const ops: DiffOp[] = [];
  const push = (type: DiffOpType, text: string) => {
    const last = ops[ops.length - 1];
    if (last && last.type === type) last.text += text;
    else ops.push({ type, text });
  };
  for (const t of A.slice(0, p)) push('eq', t);
  let i = 0,
    j = 0;
  while (i < N && j < M) {
    if (a2[i] === b2[j]) {
      push('eq', a2[i]);
      i++;
      j++;
    } else if (L[i + 1][j] >= L[i][j + 1]) push('del', a2[i++]);
    else push('ins', b2[j++]);
  }
  while (i < N) push('del', a2[i++]);
  while (j < M) push('ins', b2[j++]);
  for (const t of A.slice(n - s)) push('eq', t);
  return ops;
}

// The lab's wordDiff(a, b): ops [{ type: 'eq' | 'del' | 'ins', text }] merged into runs.
// Joining eq + del gives `a` back, eq + ins gives `b`.
export function wordDiff(a: string, b: string): DiffOp[] {
  return diffTokens(tokenize(a), tokenize(b))!;
}
