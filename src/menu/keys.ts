// The Îlot's key table (docs/DA-PLAN.md lot 7, §9 « Îlot »; UI-DECISIONS, default decision 6),
// as a pure function: what a key does in a given state of the menu. The Îlot component
// (src/menu/Ilot.tsx) feeds it the real keydown events when its window has the keyboard, or the
// keys Rust forwards (`menu-key`, KeyboardEvent.key) when it could not take the focus.
// Reference: design-lab/src/menus.jsx:15-27 (useMenuKeys), 46-55 (commonKey), 58-75 (Ilot).

// An action as the Îlot needs it. Structurally a subset of ActionDefinition (src/types.ts):
// `key` is the letter that runs it, `shortName` its tile label, `icon` a Lucide name. The names
// are user data: shown as they are, never translated.
export type IlotAction = { id: string; name: string; shortName?: string; key?: string; icon?: string };
export type IlotMode = 'compact' | 'grid' | 'prompt';
// The two items of the compact state: the last action and the ✦ pastille (free instruction).
export type CompactItem = 'last' | 'ask';

// Default decision 6: a 3 × 2 grid, no « More » tile, no second page. The actions fill the tiles
// in the user's order (six at most); while there are fewer than six, the last tile is the free
// instruction (« Ask » / « Consigne »), as in the lab (data.js:5-12).
export const maxTiles = 6;
export type IlotTile = { kind: 'action'; action: IlotAction } | { kind: 'ask' };

export function ilotTiles(actions: readonly IlotAction[]): IlotTile[] {
  const tiles: IlotTile[] = actions.slice(0, maxTiles).map((action) => ({ kind: 'action', action }));
  if (tiles.length < maxTiles) tiles.push({ kind: 'ask' });
  return tiles;
}

// Three columns (app.css:188); fewer tiles than that keep one short row instead of holes.
export function gridColumns(count: number): number {
  return Math.min(3, Math.max(1, count));
}

// Keys the menu itself uses: the digits pick a tile, Space and « / » open the instruction.
// An action's `key` equal to one of them is never a letter shortcut.
export const reservedKeys: ReadonlySet<string> = new Set(['1', '2', '3', '4', '5', '6', ' ', '/']);

const oneCharacter = (key: string) => [...key].length === 1;
const fold = (key: string) => key.toLowerCase();

// Letter → action id, over every action given (the tiles are only the first six; an action past
// them still answers to its letter). One character, case-insensitive; the first action to claim a
// letter keeps it; reserved keys and anything longer are ignored.
export function letterTable(actions: readonly IlotAction[]): Map<string, string> {
  const table = new Map<string, string>();
  for (const action of actions) {
    const key = action.key;
    if (!key || !oneCharacter(key) || reservedKeys.has(key) || /\s/.test(key)) continue;
    if (!table.has(fold(key))) table.set(fold(key), action.id);
  }
  return table;
}

export type IlotKeyContext = {
  tiles: IlotTile[];
  columns: number;
  letters: Map<string, string>;
  // The action Entrée relaunches: the last one when it is among the actions (or, past the grid,
  // among every known action), else the first.
  last: IlotAction | undefined;
  // Tile the highlight starts on: the last action's tile, else the first.
  lastTile: number;
  // False when the keys come from Rust (the window has no keyboard): no text field then.
  promptAvailable: boolean;
};

// `known`: every saved action, so a last action (or the default one) outside the grid is still the
// one Enter relaunches, as the double press does; its letter stays with the grid's.
export function ilotKeyContext(
  actions: readonly IlotAction[],
  lastActionId: string | undefined,
  promptAvailable: boolean,
  known: readonly IlotAction[] = [],
): IlotKeyContext {
  const tiles = ilotTiles(actions);
  const last =
    actions.find((action) => action.id === lastActionId) ??
    known.find((action) => action.id === lastActionId) ??
    actions[0];
  const lastTile = Math.max(
    0,
    tiles.findIndex((tile) => tile.kind === 'action' && tile.action.id === last?.id),
  );
  return { tiles, columns: gridColumns(tiles.length), letters: letterTable(actions), last, lastTile, promptAvailable };
}

// A key as a KeyboardEvent describes it. `altGraph`: getModifierState('AltGraph'); on Windows,
// AltGr also sets ctrlKey and altKey (AZERTY: AltGr+E = €). `code`: the physical key.
export type KeyInput = {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  altGraph?: boolean;
  isComposing?: boolean;
};

export function keyInputOf(event: KeyboardEvent): KeyInput {
  return {
    key: event.key,
    code: event.code,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    altKey: event.altKey,
    shiftKey: event.shiftKey,
    altGraph: event.getModifierState?.('AltGraph') ?? false,
    isComposing: event.isComposing || event.keyCode === 229,
  };
}

// The browser's own shortcuts, which the WebView would act on while the overlay has the keyboard
// (review of bc57857, finding 2): reload (F5, Ctrl+R, with Shift or Ctrl), print (Ctrl+P), find
// (Ctrl+F, Ctrl+G, F3), caret browsing (F7), zoom (Ctrl with + = - 0, keypad included), history
// (Alt+← →, Alt+Home), save, open and source (Ctrl+S, O, U), and the keyboard's browser keys. The
// Îlot swallows them without acting (src/menu/IlotStage.tsx). A letter is read from `key`, as
// Chromium reads its virtual key; a layout without Latin letters falls back to the physical key.
// Editing chords (Ctrl+A, C, V, X, Z, Y, arrows, Backspace) pass, and AltGr, which types.
const browserLetters: ReadonlySet<string> = new Set(['r', 'p', 'f', 'g', 's', 'o', 'u']);
const zoomKeys: ReadonlySet<string> = new Set(['+', '=', '-', '_', '0']);
const zoomCodes: ReadonlySet<string> = new Set(['Equal', 'Minus', 'Digit0', 'NumpadAdd', 'NumpadSubtract', 'Numpad0']);
export function browserShortcut(input: KeyInput): boolean {
  const { key, code } = input;
  if (input.altGraph) return false;
  if (key.startsWith('Browser') || key === 'F3' || key === 'F5' || key === 'F7') return true;
  if (input.ctrlKey && !input.altKey && !input.metaKey) {
    const letter = /^[a-z]$/i.test(key) ? key.toLowerCase() : code?.match(/^Key([A-Z])$/)?.[1].toLowerCase();
    return (
      (letter !== undefined && browserLetters.has(letter)) ||
      zoomKeys.has(key) ||
      (code !== undefined && zoomCodes.has(code))
    );
  }
  return Boolean(
    input.altKey && !input.ctrlKey && !input.metaKey && (key === 'ArrowLeft' || key === 'ArrowRight' || key === 'Home'),
  );
}

export type IlotState = { mode: IlotMode; hot: number; compactHot: CompactItem };

export type IlotCommand =
  | { type: 'choose'; actionId: string }
  | { type: 'prompt'; seed: string }
  | { type: 'grid' }
  | { type: 'compact' }
  | { type: 'close' }
  | { type: 'hot'; index: number }
  | { type: 'compact-hot'; item: CompactItem }
  // Handled (the key is swallowed) but nothing happens: a digit without a tile, Space while the
  // field is unavailable.
  | { type: 'none' };

// What a tile does when chosen: its action, or the free instruction when that is available.
export function tileCommand(tile: IlotTile | undefined, promptAvailable: boolean): IlotCommand {
  if (!tile) return { type: 'none' };
  if (tile.kind === 'action') return { type: 'choose', actionId: tile.action.id };
  return promptAvailable ? { type: 'prompt', seed: '' } : { type: 'none' };
}

// Moving the highlight in the grid (menus.jsx:70-71 wraps around six tiles: → ← one step, ↓ ↑ one
// row, Tab forward). Shift+Tab steps back; Home and End reach the first and last tile. A vertical
// move past the last row comes back to the same column of the first one, and the other way round.
export function moveHot(hot: number, key: string, shiftKey: boolean, count: number, columns: number): number | null {
  if (count <= 0) return null;
  const column = hot % columns;
  switch (key) {
    case 'ArrowRight':
      return (hot + 1) % count;
    case 'ArrowLeft':
      return (hot - 1 + count) % count;
    case 'Tab':
      return shiftKey ? (hot - 1 + count) % count : (hot + 1) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    case 'ArrowDown': {
      const below = hot + columns;
      return below < count ? below : column;
    }
    case 'ArrowUp': {
      const above = hot - columns;
      if (above >= 0) return above;
      const lastRow = Math.ceil(count / columns) - 1;
      const wrapped = lastRow * columns + column;
      return wrapped < count ? wrapped : Math.max(column, wrapped - columns);
    }
    default:
      return null;
  }
}

// The key table. null: not the menu's key, let it through (the browser or the text field gets it).
export function resolveIlotKey(input: KeyInput, state: IlotState, context: IlotKeyContext): IlotCommand | null {
  const { key } = input;
  // An IME composition or a dead key is text in the making, never a command.
  if (input.isComposing || key === 'Process' || key === 'Dead' || key === 'Unidentified') return null;
  // menus.jsx:21: Ctrl, Meta and Alt combinations belong to the system, except AltGr, which types.
  if ((input.ctrlKey || input.metaKey || input.altKey) && !input.altGraph) return null;
  // The field is a real <input>: it handles Enter and every character itself (menus.jsx:40, 66).
  // Escape goes back to the compact state wherever the focus is: a click on the field's dot or
  // its ↵ must not leave Escape to close the whole menu (review of bc57857, finding 5).
  if (state.mode === 'prompt') return key === 'Escape' ? { type: 'compact' } : null;
  const { tiles, promptAvailable } = context;
  const openPrompt = (seed: string): IlotCommand | null =>
    promptAvailable ? { type: 'prompt', seed } : seed ? null : { type: 'none' };

  // Échap goes back one step (grid → compact), then closes (menus.jsx:47, 69).
  if (key === 'Escape') return state.mode === 'grid' ? { type: 'compact' } : { type: 'close' };

  if (state.mode === 'compact') {
    if (key === 'Tab' || key === 'ArrowDown') return { type: 'grid' };
    if ((key === 'ArrowRight' || key === 'ArrowLeft') && context.last && promptAvailable) {
      return { type: 'compact-hot', item: state.compactHot === 'last' ? 'ask' : 'last' };
    }
    if (key === 'Enter') {
      if (state.compactHot === 'ask' || !context.last) return openPrompt('');
      return { type: 'choose', actionId: context.last.id };
    }
  } else {
    const next = moveHot(state.hot, key, Boolean(input.shiftKey), tiles.length, context.columns);
    if (next !== null) return { type: 'hot', index: next };
    if (key === 'Enter') return tileCommand(tiles[state.hot], promptAvailable);
  }

  if (key === ' ' || key === '/') return openPrompt('');
  if (!oneCharacter(key)) return null;
  const letter = context.letters.get(fold(key));
  if (letter) return { type: 'choose', actionId: letter };
  if (/^[1-6]$/.test(key)) return tileCommand(tiles[Number(key) - 1], promptAvailable);
  // Any other character opens the field with that character already typed (menus.jsx:53).
  return openPrompt(key);
}
