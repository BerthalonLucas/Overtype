import { describe, expect, it } from 'vitest';
import {
  browserShortcut,
  gridColumns,
  ilotKeyContext,
  ilotTiles,
  letterTable,
  moveHot,
  resolveIlotKey,
  type IlotAction,
  type IlotState,
  type KeyInput,
} from './keys';

// The lab's five actions (design-lab/src/data.js:5-12); the sixth tile is the free instruction.
const actions: IlotAction[] = [
  { id: 'fix', name: 'Fix grammar', shortName: 'Fix', key: 'F', icon: 'SpellCheck' },
  { id: 'translate', name: 'Translate', key: 'T', icon: 'Languages' },
  { id: 'pro', name: 'Make professional', shortName: 'Pro', key: 'P', icon: 'BriefcaseBusiness' },
  { id: 'shorten', name: 'Shorten', key: 'S', icon: 'FoldVertical' },
  { id: 'email', name: 'Write email', shortName: 'Email', key: 'E', icon: 'Mail' },
];
const compact: IlotState = { mode: 'compact', hot: 0, compactHot: 'last' };
const grid = (hot = 0): IlotState => ({ mode: 'grid', hot, compactHot: 'last' });
const prompt: IlotState = { mode: 'prompt', hot: 0, compactHot: 'last' };
const focused = ilotKeyContext(actions, 'translate', true);
const injected = ilotKeyContext(actions, 'translate', false);
const press = (key: string | KeyInput, state: IlotState = compact, context = focused) =>
  resolveIlotKey(typeof key === 'string' ? { key } : key, state, context);

describe('Îlot tiles', () => {
  it('fills the tiles in the given order and ends with the free instruction while there are fewer than six', () => {
    expect(ilotTiles(actions).map((tile) => (tile.kind === 'action' ? tile.action.id : 'ask'))).toEqual([
      'fix',
      'translate',
      'pro',
      'shorten',
      'email',
      'ask',
    ]);
    expect(ilotTiles(actions.slice(0, 2)).map((tile) => tile.kind)).toEqual(['action', 'action', 'ask']);
    expect(ilotTiles([]).map((tile) => tile.kind)).toEqual(['ask']);
  });

  it('shows six actions and no « More » tile when there are six or more (default decision 6)', () => {
    const many = [...actions, { id: 'formal', name: 'Formal', key: 'O' }, { id: 'summary', name: 'Summary', key: 'U' }];
    const tiles = ilotTiles(many);
    expect(tiles).toHaveLength(6);
    expect(tiles.every((tile) => tile.kind === 'action')).toBe(true);
    // The order is never changed by the last action: only the highlight follows it.
    expect(ilotKeyContext(many, 'email', true).tiles.map((tile) => tile.kind === 'action' && tile.action.id)).toEqual([
      'fix',
      'translate',
      'pro',
      'shorten',
      'email',
      'formal',
    ]);
    expect(ilotKeyContext(many, 'email', true).lastTile).toBe(4);
  });

  it('keeps three columns, or one short row for fewer tiles', () => {
    expect([1, 2, 3, 4, 6].map(gridColumns)).toEqual([1, 2, 3, 3, 3]);
  });

  it('relaunches the last action, else the first, and starts the highlight on its tile', () => {
    expect(focused.last?.id).toBe('translate');
    expect(focused.lastTile).toBe(1);
    expect(ilotKeyContext(actions, 'unknown', true).last?.id).toBe('fix');
    expect(ilotKeyContext(actions, undefined, true).lastTile).toBe(0);
    expect(ilotKeyContext([], undefined, true).last).toBeUndefined();
  });

  it('relaunches a last action outside the grid when it is known, without giving it a tile or a letter', () => {
    const outside: IlotAction = { id: 'summary', name: 'Summarise', key: 'U' };
    const context = ilotKeyContext(actions, 'summary', true, [...actions, outside]);
    expect(context.last?.id).toBe('summary');
    expect(context.lastTile).toBe(0);
    expect(context.tiles.some((tile) => tile.kind === 'action' && tile.action.id === 'summary')).toBe(false);
    expect(context.letters.has('u')).toBe(false);
    expect(resolveIlotKey({ key: 'Enter' }, { mode: 'compact', hot: 0, compactHot: 'last' }, context)).toEqual({
      type: 'choose',
      actionId: 'summary',
    });
    // Unknown everywhere: the first action, as before.
    expect(ilotKeyContext(actions, 'gone', true, [...actions, outside]).last?.id).toBe('fix');
  });
});

describe('letter table', () => {
  it('takes the letters from action.key, case-insensitive, first claim wins', () => {
    const table = letterTable([
      ...actions,
      { id: 'again', name: 'Fix again', key: 'f' },
      { id: 'summary', name: 'Summary', key: 'U' },
    ]);
    expect([...table]).toEqual([
      ['f', 'fix'],
      ['t', 'translate'],
      ['p', 'pro'],
      ['s', 'shorten'],
      ['e', 'email'],
      ['u', 'summary'],
    ]);
  });

  it('ignores keys the menu uses itself, blanks and anything longer than one character', () => {
    const table = letterTable([
      { id: 'a', name: 'A', key: '1' },
      { id: 'b', name: 'B', key: ' ' },
      { id: 'c', name: 'C', key: '/' },
      { id: 'd', name: 'D', key: 'Ctrl' },
      { id: 'e', name: 'E' },
      { id: 'f', name: 'F', key: 'é' },
    ]);
    expect([...table]).toEqual([['é', 'f']]);
  });
});

describe('moveHot', () => {
  it('wraps like the lab on six tiles (menus.jsx:70-71)', () => {
    for (let hot = 0; hot < 6; hot++) {
      expect(moveHot(hot, 'ArrowRight', false, 6, 3)).toBe((hot + 1) % 6);
      expect(moveHot(hot, 'ArrowLeft', false, 6, 3)).toBe((hot + 5) % 6);
      expect(moveHot(hot, 'ArrowDown', false, 6, 3)).toBe((hot + 3) % 6);
      expect(moveHot(hot, 'ArrowUp', false, 6, 3)).toBe((hot + 3) % 6);
      expect(moveHot(hot, 'Tab', false, 6, 3)).toBe((hot + 1) % 6);
      expect(moveHot(hot, 'Tab', true, 6, 3)).toBe((hot + 5) % 6);
    }
    expect([moveHot(4, 'Home', false, 6, 3), moveHot(1, 'End', false, 6, 3)]).toEqual([0, 5]);
  });

  it('stays in the column on an incomplete last row', () => {
    // Four tiles: 0 1 2 / 3.
    expect(moveHot(0, 'ArrowDown', false, 4, 3)).toBe(3);
    expect(moveHot(1, 'ArrowDown', false, 4, 3)).toBe(1);
    expect(moveHot(3, 'ArrowDown', false, 4, 3)).toBe(0);
    expect(moveHot(0, 'ArrowUp', false, 4, 3)).toBe(3);
    expect(moveHot(2, 'ArrowUp', false, 4, 3)).toBe(2);
    expect(moveHot(3, 'ArrowUp', false, 4, 3)).toBe(0);
    expect(moveHot(0, 'Enter', false, 4, 3)).toBeNull();
  });
});

describe('resolveIlotKey', () => {
  it('runs the actions from their letters, in either case, compact or grid', () => {
    for (const [key, id] of [
      ['f', 'fix'],
      ['t', 'translate'],
      ['p', 'pro'],
      ['s', 'shorten'],
      ['e', 'email'],
      ['F', 'fix'],
      ['E', 'email'],
    ]) {
      expect(press(key)).toEqual({ type: 'choose', actionId: id });
      expect(press(key, grid(3))).toEqual({ type: 'choose', actionId: id });
    }
    expect(press({ key: 'F', shiftKey: true })).toEqual({ type: 'choose', actionId: 'fix' });
  });

  it('runs the tiles from the digits 1 to 6; the sixth opens the free instruction', () => {
    expect(['1', '2', '3', '4', '5'].map((key) => press(key))).toEqual(
      actions.map((action) => ({ type: 'choose', actionId: action.id })),
    );
    expect(press('6')).toEqual({ type: 'prompt', seed: '' });
    // A digit without a tile is swallowed, not typed into a field.
    expect(press('5', compact, ilotKeyContext(actions.slice(0, 2), 'fix', true))).toEqual({ type: 'none' });
    expect(press('3', compact, ilotKeyContext(actions.slice(0, 2), 'fix', true))).toEqual({ type: 'prompt', seed: '' });
  });

  it('relaunches the last action on Enter; Tab or ↓ unfolds the grid', () => {
    expect(press('Enter')).toEqual({ type: 'choose', actionId: 'translate' });
    expect(press('Tab')).toEqual({ type: 'grid' });
    expect(press({ key: 'Tab', shiftKey: true })).toEqual({ type: 'grid' });
    expect(press('ArrowDown')).toEqual({ type: 'grid' });
    expect(press('ArrowUp')).toBeNull();
  });

  it('moves between the last action and the pastille in the compact state', () => {
    expect(press('ArrowRight')).toEqual({ type: 'compact-hot', item: 'ask' });
    const onAsk: IlotState = { ...compact, compactHot: 'ask' };
    expect(press('ArrowLeft', onAsk)).toEqual({ type: 'compact-hot', item: 'last' });
    expect(press('Enter', onAsk)).toEqual({ type: 'prompt', seed: '' });
    // No last action at all: Enter writes an instruction.
    expect(press('Enter', compact, ilotKeyContext([], undefined, true))).toEqual({ type: 'prompt', seed: '' });
  });

  it('moves the highlight and runs the highlighted tile in the grid', () => {
    expect(press('ArrowRight', grid(1))).toEqual({ type: 'hot', index: 2 });
    expect(press('ArrowDown', grid(1))).toEqual({ type: 'hot', index: 4 });
    expect(press('Tab', grid(5))).toEqual({ type: 'hot', index: 0 });
    expect(press('Enter', grid(2))).toEqual({ type: 'choose', actionId: 'pro' });
    expect(press('Enter', grid(5))).toEqual({ type: 'prompt', seed: '' });
  });

  it('opens the free instruction on Space or « / », and on any other character already typed', () => {
    expect(press(' ')).toEqual({ type: 'prompt', seed: '' });
    expect(press('/', grid(0))).toEqual({ type: 'prompt', seed: '' });
    for (const key of ['x', 'X', 'é', 'à', '7', '?', '😀']) expect(press(key)).toEqual({ type: 'prompt', seed: key });
  });

  it('goes back one step on Escape, then closes', () => {
    expect(press('Escape', grid(4))).toEqual({ type: 'compact' });
    expect(press('Escape')).toEqual({ type: 'close' });
  });

  it('leaves Ctrl, Alt and Meta combinations alone, but lets AltGr type (AZERTY: AltGr+E = €)', () => {
    for (const modifier of ['ctrlKey', 'altKey', 'metaKey'] as const) {
      expect(press({ key: 'f', [modifier]: true })).toBeNull();
      expect(press({ key: 'Enter', [modifier]: true })).toBeNull();
    }
    // Windows reports AltGr as Ctrl+Alt with the AltGraph modifier.
    expect(press({ key: '€', ctrlKey: true, altKey: true, altGraph: true })).toEqual({ type: 'prompt', seed: '€' });
    expect(press({ key: '@', ctrlKey: true, altKey: true, altGraph: true }, grid(0))).toEqual({
      type: 'prompt',
      seed: '@',
    });
    expect(press({ key: 'AltGraph', ctrlKey: true, altKey: true, altGraph: true })).toBeNull();
  });

  it('never takes a key while an IME composes or a dead key waits', () => {
    expect(press({ key: 'f', isComposing: true })).toBeNull();
    expect(press('Process')).toBeNull();
    expect(press('Dead')).toBeNull();
  });

  // Review of bc57857, finding 5: Escape left to the input was lost once a click on the field's dot
  // or ↵ had moved the focus; the table now takes it wherever the focus is.
  it('lets the text field handle every key but Escape, which goes back to the compact state', () => {
    for (const key of ['Enter', 'f', ' ', 'Tab', '1', 'ArrowDown']) expect(press(key, prompt)).toBeNull();
    expect(press('Escape', prompt)).toEqual({ type: 'compact' });
    expect(press({ key: 'Escape', shiftKey: true }, prompt)).toEqual({ type: 'compact' });
    // An IME composition cancels itself with Escape; a chord stays the system's.
    expect(press({ key: 'Escape', isComposing: true }, prompt)).toBeNull();
    expect(press({ key: 'Escape', ctrlKey: true }, prompt)).toBeNull();
  });

  it('has no field when the keys come from Rust: Space is swallowed, other characters pass', () => {
    expect(press(' ', compact, injected)).toEqual({ type: 'none' });
    expect(press('/', compact, injected)).toEqual({ type: 'none' });
    expect(press('x', compact, injected)).toBeNull();
    expect(press('6', compact, injected)).toEqual({ type: 'none' });
    expect(press('Enter', grid(5), injected)).toEqual({ type: 'none' });
    expect(press('ArrowRight', compact, injected)).toBeNull();
    // Everything else behaves the same.
    expect(press('f', compact, injected)).toEqual({ type: 'choose', actionId: 'fix' });
    expect(press('Enter', compact, injected)).toEqual({ type: 'choose', actionId: 'translate' });
    expect(press('Tab', compact, injected)).toEqual({ type: 'grid' });
    expect(press('Escape', grid(0), injected)).toEqual({ type: 'compact' });
  });

  it('answers the letter of an action past the six tiles', () => {
    const many = [...actions, { id: 'formal', name: 'Formal', key: 'O' }, { id: 'summary', name: 'Summary', key: 'U' }];
    expect(press('u', compact, ilotKeyContext(many, 'fix', true))).toEqual({ type: 'choose', actionId: 'summary' });
    expect(press('6', compact, ilotKeyContext(many, 'fix', true))).toEqual({ type: 'choose', actionId: 'formal' });
  });
});

// Review of bc57857, finding 2: F5 in the focused Îlot reloaded the overlay's page (an empty window
// and a menu scope left armed in Rust). The browser's shortcuts are swallowed; editing chords pass.
describe('browser shortcuts in the Îlot', () => {
  const ctrl = (key: string, extra: Partial<KeyInput> = {}): KeyInput => ({ key, ctrlKey: true, ...extra });
  it('recognises reload, print, find, caret browsing, zoom and history, whatever the layout', () => {
    const shortcuts: KeyInput[] = [
      { key: 'F5' },
      ctrl('F5'),
      { key: 'F5', shiftKey: true },
      ctrl('r', { code: 'KeyR' }),
      ctrl('R', { shiftKey: true, code: 'KeyR' }),
      ctrl('p'),
      ctrl('f'),
      ctrl('g'),
      ctrl('G', { shiftKey: true }),
      { key: 'F3' },
      { key: 'F3', shiftKey: true },
      { key: 'F7' },
      ctrl('s'),
      ctrl('o'),
      ctrl('u'),
      ctrl('+', { shiftKey: true, code: 'Equal' }),
      ctrl('=', { code: 'Equal' }),
      ctrl('-', { code: 'Minus' }),
      ctrl('0', { code: 'Digit0' }),
      ctrl('+', { code: 'NumpadAdd' }),
      ctrl('-', { code: 'NumpadSubtract' }),
      // AZERTY: Ctrl+à is Ctrl+0 for Chromium (its virtual key is VK_0).
      ctrl('à', { code: 'Digit0' }),
      // A Cyrillic layout: the key of R types к; Chromium still reads VK_R.
      ctrl('к', { code: 'KeyR' }),
      { key: 'ArrowLeft', altKey: true },
      { key: 'ArrowRight', altKey: true },
      { key: 'Home', altKey: true },
      { key: 'BrowserBack' },
      { key: 'BrowserForward' },
      { key: 'BrowserRefresh' },
      { key: 'BrowserSearch' },
      { key: 'BrowserHome' },
    ];
    for (const input of shortcuts) expect(browserShortcut(input), JSON.stringify(input)).toBe(true);
  });
  it('lets the field edit, the menu keys through, and AltGr type', () => {
    const passing: KeyInput[] = [
      ctrl('a'),
      ctrl('c'),
      ctrl('v'),
      ctrl('x'),
      ctrl('z'),
      ctrl('y'),
      ctrl('Z', { shiftKey: true }),
      ctrl('Backspace'),
      ctrl('Delete'),
      ctrl('ArrowLeft'),
      ctrl('ArrowRight', { shiftKey: true }),
      ctrl('Home'),
      ctrl('End'),
      { key: 'r' },
      { key: 'F' },
      { key: 'Enter' },
      { key: 'Escape' },
      { key: 'Tab' },
      { key: 'ArrowLeft' },
      { key: '0' },
      { key: '+' },
      // AZERTY: AltGr+à is @, AltGr+= is }, AltGr+E is € (Windows adds Ctrl and Alt).
      { key: '@', code: 'Digit0', ctrlKey: true, altKey: true, altGraph: true },
      { key: '}', code: 'Equal', ctrlKey: true, altKey: true, altGraph: true },
      { key: '€', code: 'KeyE', ctrlKey: true, altKey: true, altGraph: true },
      // AZERTY: the key of Q types a (Ctrl+A selects all); nothing reads the physical key then.
      ctrl('a', { code: 'KeyQ' }),
      { key: 'F4', altKey: true },
    ];
    for (const input of passing) expect(browserShortcut(input), JSON.stringify(input)).toBe(false);
  });
});
