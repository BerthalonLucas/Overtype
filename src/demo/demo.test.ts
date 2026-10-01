import { describe, expect, it } from 'vitest';
import demoSource from './Demo.tsx?raw';
import { translate } from '../i18n';
import { changedRanges } from '../result/highlight';
import { phaseIds } from './script';

// Vitest empties every stylesheet it is not told to keep (vite.config.ts): the three sheets are
// read from the disk as text.
const fs: { readFileSync: (path: URL, encoding: 'utf8') => string } = await import('node:fs' as string);
const sheet = (path: string) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

// The declarations of the first rule whose selector list holds `selector`.
function declarations(sheet: string, selector: string): string {
  const at = sheet.indexOf(selector);
  const open = sheet.indexOf('{', at), close = sheet.indexOf('}', open);
  if (at < 0 || open < 0 || close < 0) throw new Error(`no rule for ${selector}`);
  return sheet.slice(open + 1, close).replace(/\s+/g, ' ').trim().replace(/;$/, '');
}

describe('the demo borrows, it does not copy', () => {
  // The demo's pointer is not the mouse, so :hover never applies under it: the two hover rules
  // it stands in for must stay the app's own.
  it('shows the Îlot and Undo hovered exactly as the app does', () => {
    const demoCss = sheet('./demo.css');
    expect(declarations(demoCss, '.dm-ilot .ilot-btn[data-demo-hover]')).toBe(declarations(sheet('../menu/ilot.css'), '.ilot-btn:hover'));
    expect(declarations(demoCss, '.dm-ilot .result-btn[data-demo-hover]')).toBe(declarations(sheet('../result/result.css'), '.result-btn:hover'));
  });
  it('draws nothing of the app itself', () => {
    const source = demoSource;
    for (const component of ['IlotView', 'HaloView', 'resultContent', 'animateCorner', 'ilotMenuShift', 'changedRanges', 'Countdown']) expect(source, component).toContain(component);
    // No copy of the Îlot's or the pill's markup.
    for (const drawn of ['ilot-row', 'ilot-grid', 'ilot-tile"', 'result-row', 'result-check', 'working-orb', 'halo-aurora', 'halo-wave']) expect(source.includes(`className="${drawn}`), drawn).toBe(false);
  });
});

describe('the demo text', () => {
  for (const language of ['fr', 'en'] as const) {
    it(`holds three mistakes that the app's own diff finds (${language})`, () => {
      const before = translate(language, 'demo2.mail.before'), after = translate(language, 'demo2.mail.after');
      const { mode, ranges } = changedRanges(before, after, { actionId: 'correct' });
      expect(mode).toBe('words');
      expect(ranges).toHaveLength(3);
      expect(ranges.map(range => after.slice(range.start, range.end))).toEqual(language === 'fr' ? ['convenu', 'chiffres', 'clairs'] : ['agreed', 'useful', 'are']);
      // The same length class: the pill lands under the same last line.
      expect(Math.abs(before.length - after.length)).toBeLessThan(4);
    });
  }
  it('names every phase, in both languages', () => {
    for (const id of phaseIds) for (const language of ['fr', 'en'] as const) {
      expect(translate(language, `demo2.phase.${id}`).length).toBeGreaterThan(8);
      expect(translate(language, `demo2.short.${id}`).length).toBeLessThan(12);
    }
  });
});
