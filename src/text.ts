// Where the glass may break a long run. A sequence of 18 or more characters without a
// space (a path, a URL, an identifier) is cut after each of its separators; the caller
// renders a break opportunity (<wbr>) between the pieces, so the browser wraps there
// rather than at any letter (overflow-wrap: break-word only cuts a run that fits no
// line at all). Shorter words are never touched and the text itself is unchanged.
const LONG_RUN = /\S{18,}/g;
const SEPARATORS = new Set(['\\', '/', '_', '-', '?', '&', '.']);

export function breakable(text: string): string[] {
  const breaks: number[] = [];
  for (const match of text.matchAll(LONG_RUN)) {
    const run = match[0];
    // After a separator, before a character that is not one: « // » or « ._ » stay whole,
    // and a run never ends on a break.
    for (let i = 1; i < run.length; i++) {
      if (SEPARATORS.has(run[i - 1]) && !SEPARATORS.has(run[i])) breaks.push(match.index + i);
    }
  }
  const pieces: string[] = [];
  let start = 0;
  for (const index of breaks) {
    pieces.push(text.slice(start, index));
    start = index;
  }
  pieces.push(text.slice(start));
  return pieces;
}
