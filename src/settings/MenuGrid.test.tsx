import { afterEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { defaultActions } from '../actionDefaults';
import type { ActionDefinition, Settings } from '../types';
import { MenuGrid } from './MenuGrid';

let root: Root | undefined;
let host: HTMLElement | undefined;
afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  root = host = undefined;
});

// Review of bc57857, finding 7: « In the menu » drew the free instruction's wand beside every action
// without a known icon, while its tile in the Îlot draws none.
describe('MenuGrid', () => {
  it("draws each action with the icon of its Îlot tile, none without one; the wand stays the free instruction's", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const custom: ActionDefinition = { id: 'summary', name: 'Summarise', promptTemplate: 'x' };
    const unknown: ActionDefinition = { id: 'legacy', name: 'Legacy', promptTemplate: 'x', icon: 'NotAnIcon' };
    const settings = {
      actions: [...defaultActions, custom, unknown],
      menuActionIds: ['correct', 'summary', 'legacy', 'email'],
    } as unknown as Settings;
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root!.render(<MenuGrid settings={settings} persist={() => undefined} />));
    const glyphs = [...host.querySelectorAll('.st-grid-row:not([data-off]) .st-grid-tile')];
    expect(glyphs.map((glyph) => glyph.querySelectorAll('svg').length)).toEqual([1, 0, 0, 1]);
    expect(glyphs.map((glyph) => glyph.getAttribute('data-icon'))).toEqual(['fix', null, null, 'email']);
    // Each row keeps its slot, drawn or not, so the names stay aligned.
    expect(host.querySelectorAll('.st-grid-row:not([data-off]) > .st-grid-tile')).toHaveLength(4);
    // The actions out of the menu follow, dimmed, without a rank nor a letter to type.
    const out = [...host.querySelectorAll<HTMLElement>('.st-grid-row[data-off]')];
    expect(out.map((row) => row.dataset.action)).toEqual(['translate', 'professionalize', 'shorten']);
    expect(
      out.every(
        (row) => row.querySelector('input')!.disabled && row.querySelector('.st-grid-index')!.textContent === '',
      ),
    ).toBe(true);
  });
});
