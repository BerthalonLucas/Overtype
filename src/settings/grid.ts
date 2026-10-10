import { defaultActions } from '../actionDefaults';
import type { MessageKey, Params } from '../i18n';
import type { ActionDefinition, Settings } from '../types';

// The Îlot's grid in the Settings (lot 13, decision 6 of docs/UI-DECISIONS.md): up to six
// actions in the user's order, each with its own letter. Rust validates the same rules
// (actions.rs, validate): a letter is one alphabetic character, unique case-insensitively
// among all the actions; the grid holds known actions, six at most, without repeats.
export const gridLimit = 6;
const isLetter = (value: string) => /^\p{L}$/u.test(value);
const same = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase();

// What the letter field keeps of a keystroke: the one new character (typing before or after
// the current letter, or over it once selected), upper-cased; an empty field clears it.
export function nextLetter(typed: string, current: string): string {
  const characters = [...typed.trim()];
  if (characters.length <= 1) return (characters[0] ?? '').toLocaleUpperCase();
  const fresh = characters.find((character) => !same(character, current)) ?? characters.at(-1)!;
  return fresh.toLocaleUpperCase();
}

export type LetterProblem = { key: MessageKey; params?: Params };
// Checked before any save: Rust would refuse the whole file for one bad letter.
export function letterProblem(letter: string, actionId: string, actions: ActionDefinition[]): LetterProblem | null {
  if (!letter) return null;
  if (!isLetter(letter)) return { key: 'grid.letterInvalid' };
  const owner = actions.find((action) => action.id !== actionId && action.key && same(action.key, letter));
  return owner ? { key: 'grid.letterTaken', params: { letter: letter.toLocaleUpperCase(), name: owner.name } } : null;
}

// A letter for an action entering the grid, as Rust's migration gives one: its default letter
// when free, else the first free letter of its tile label or name, else none.
export function freeLetter(action: ActionDefinition, actions: ActionDefinition[]): string | undefined {
  const taken = (letter: string) =>
    actions.some((other) => other.id !== action.id && other.key && same(other.key, letter));
  const preferred = defaultActions.find((item) => item.id === action.id)?.key;
  const candidates = [...(preferred ?? ''), ...(action.shortName ?? ''), ...action.name];
  return candidates.find((letter) => isLetter(letter) && !taken(letter))?.toLocaleUpperCase();
}

export function moveInGrid(ids: string[], id: string, delta: -1 | 1): string[] {
  const from = ids.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= ids.length) return ids;
  const next = [...ids];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

export function addToGrid(settings: Settings, id: string): Settings {
  if (settings.menuActionIds.length >= gridLimit || settings.menuActionIds.includes(id)) return settings;
  const action = settings.actions.find((item) => item.id === id);
  if (!action) return settings;
  const key = action.key ?? freeLetter(action, settings.actions);
  return {
    ...settings,
    menuActionIds: [...settings.menuActionIds, id],
    actions: settings.actions.map((item) => (item.id === id ? { ...item, ...(key ? { key } : {}) } : item)),
  };
}

// Out of the grid an action keeps no letter (as Rust's migration leaves them): the letter is
// free for another action, and a new one is found if it comes back.
export function removeFromGrid(settings: Settings, id: string): Settings {
  return {
    ...settings,
    menuActionIds: settings.menuActionIds.filter((item) => item !== id),
    actions: settings.actions.map((item) => (item.id === id ? withoutKey(item) : item)),
  };
}
export function withoutKey(action: ActionDefinition): ActionDefinition {
  const { key: _key, ...rest } = action;
  return rest;
}

// Deleting an action also takes it out of the grid.
export function deleteAction(settings: Settings, id: string): Settings {
  return {
    ...settings,
    actions: settings.actions.filter((item) => item.id !== id),
    menuActionIds: settings.menuActionIds.filter((item) => item !== id),
  };
}
