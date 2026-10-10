import { describe, expect, it } from 'vitest';
import { defaultActions, defaultMenuActionIds } from '../actionDefaults';
import type { ActionDefinition, Settings } from '../types';
import {
  addToGrid,
  deleteAction,
  freeLetter,
  gridLimit,
  letterProblem,
  moveInGrid,
  nextLetter,
  removeFromGrid,
} from './grid';

const custom: ActionDefinition = { id: 'summary', name: 'Résumer', promptTemplate: 'Résume.' };
const settingsWith = (actions: ActionDefinition[], menuActionIds: string[]) => ({ actions, menuActionIds }) as Settings;

describe('the Îlot grid in the Settings', () => {
  it('keeps the one letter typed, before, after or over the current one, upper-cased', () => {
    expect(nextLetter('Fx', 'F')).toBe('X');
    expect(nextLetter('xF', 'F')).toBe('X');
    expect(nextLetter('é', '')).toBe('É');
    expect(nextLetter('', 'F')).toBe('');
    expect(nextLetter('  ', 'F')).toBe('');
  });

  it('checks a letter as Rust does: one letter, unique among all actions, case-insensitive', () => {
    expect(letterProblem('', 'translate', defaultActions)).toBeNull();
    expect(letterProblem('Q', 'translate', defaultActions)).toBeNull();
    expect(letterProblem('T', 'translate', defaultActions)).toBeNull();
    expect(letterProblem('1', 'translate', defaultActions)).toEqual({ key: 'grid.letterInvalid' });
    expect(letterProblem('f', 'translate', defaultActions)).toEqual({
      key: 'grid.letterTaken',
      params: { letter: 'F', name: 'Fix grammar' },
    });
    // An action outside the grid that kept a letter still holds it (Rust validates every action).
    expect(letterProblem('R', 'translate', [...defaultActions, { ...custom, key: 'R' }])).toMatchObject({
      key: 'grid.letterTaken',
    });
  });

  it('gives an action entering the grid its default letter when free, else the first free one of its label or name', () => {
    expect(
      freeLetter(
        defaultActions[1],
        defaultActions.map((action) => (action.id === 'translate' ? { ...action, key: undefined } : action)),
      ),
    ).toBe('T');
    expect(freeLetter(custom, defaultActions)).toBe('R');
    expect(freeLetter({ ...custom, shortName: 'Brief' }, defaultActions)).toBe('B');
    expect(freeLetter({ ...custom, name: 'FTPSE' }, defaultActions)).toBeUndefined();
  });

  it('moves a tile one place, never past either end', () => {
    expect(moveInGrid(defaultMenuActionIds, 'translate', -1)).toEqual([
      'translate',
      'correct',
      'professionalize',
      'shorten',
      'email',
    ]);
    expect(moveInGrid(defaultMenuActionIds, 'translate', 1)).toEqual([
      'correct',
      'professionalize',
      'translate',
      'shorten',
      'email',
    ]);
    expect(moveInGrid(defaultMenuActionIds, 'correct', -1)).toBe(defaultMenuActionIds);
    expect(moveInGrid(defaultMenuActionIds, 'email', 1)).toBe(defaultMenuActionIds);
  });

  it('adds up to six actions with a letter, takes the letter back on removal, and deletes out of the grid too', () => {
    const start = settingsWith([...defaultActions, custom], [...defaultMenuActionIds]);
    const added = addToGrid(start, 'summary');
    expect(added.menuActionIds).toEqual([...defaultMenuActionIds, 'summary']);
    expect(added.actions.find((action) => action.id === 'summary')?.key).toBe('R');
    expect(added.menuActionIds).toHaveLength(gridLimit);
    const full = settingsWith([...added.actions, { ...custom, id: 'other', name: 'Other' }], added.menuActionIds);
    expect(addToGrid(full, 'other')).toBe(full);
    const removed = removeFromGrid(added, 'summary');
    expect(removed.menuActionIds).toEqual(defaultMenuActionIds);
    expect(removed.actions.find((action) => action.id === 'summary')).not.toHaveProperty('key');
    const deleted = deleteAction(added, 'summary');
    expect(deleted.actions.some((action) => action.id === 'summary')).toBe(false);
    expect(deleted.menuActionIds).toEqual(defaultMenuActionIds);
  });
});
