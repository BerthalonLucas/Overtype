import { describe, expect, it } from 'vitest';
import { defaultActions } from '../actionDefaults';
import type { ActionDefinition, Settings } from '../types';
import { menuActions } from './IlotStage';
import { ilotTiles } from './keys';

const extra: ActionDefinition[] = [
  { id: 'summary', name: 'Summarise', promptTemplate: 'x' },
  { id: 'formal', name: 'Formal', promptTemplate: 'x' },
];
const settingsWith = (menuActionIds: string[], actions: ActionDefinition[] = [...defaultActions, ...extra]) =>
  ({ actions, menuActionIds }) as unknown as Settings;

describe('the Îlot’s actions in the overlay', () => {
  it('follows menuActionIds in the user’s order and drops ids that no longer exist', () => {
    expect(menuActions(settingsWith(['email', 'gone', 'correct', 'summary'])).map((action) => action.id)).toEqual([
      'email',
      'correct',
      'summary',
    ]);
  });
  // Review of bc57857, findings 4 and 6: an emptied grid showed the first six actions anyway,
  // against the Settings' « only the free instruction ».
  it('shows no action tile when the user emptied the grid: only « Ask » remains', () => {
    expect(menuActions(settingsWith([]))).toEqual([]);
    expect(ilotTiles(menuActions(settingsWith([]))).map((tile) => tile.kind)).toEqual(['ask']);
  });
  it('falls back to the first six actions only when the field is missing, and never shows more than six', () => {
    const withoutField = { actions: [...defaultActions, ...extra] } as unknown as Settings;
    expect(menuActions(withoutField).map((action) => action.id)).toEqual([
      'correct',
      'translate',
      'professionalize',
      'shorten',
      'email',
      'summary',
    ]);
    expect(
      menuActions(settingsWith(['summary', 'formal', 'correct', 'translate', 'professionalize', 'shorten', 'email'])),
    ).toHaveLength(6);
    expect(menuActions(null)).toEqual([]);
  });
  it('keeps an action without a letter letterless: Rust assigns the letters', () => {
    expect(menuActions(settingsWith(['summary'])).map((action) => action.key)).toEqual([undefined]);
  });
});
