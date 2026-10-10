import { describe, expect, it } from 'vitest';
import { fromKey, type RecordedKey } from './ShortcutRecorder';

const key = (
  key: string,
  code: string,
  modifiers: Partial<Pick<RecordedKey, 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>> & { altGraph?: boolean } = {},
): RecordedKey => ({
  key,
  code,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  ...modifiers,
  getModifierState: (name: string) => name === 'AltGraph' && Boolean(modifiers.altGraph),
});

describe('the shortcut recorder', () => {
  it('reads letters on the active layout (AZERTY A is KeyQ)', () => {
    expect(fromKey(key('a', 'KeyQ', { ctrlKey: true, altKey: true }))).toEqual({ value: 'Ctrl+Alt+A' });
    expect(fromKey(key(' ', 'Space', { ctrlKey: true, altKey: true }))).toEqual({ value: 'Ctrl+Alt+Space' });
    expect(fromKey(key('K', 'KeyK', { ctrlKey: true, shiftKey: true }))).toEqual({ value: 'Ctrl+Shift+K' });
  });
  // AZERTY: Ctrl+Alt+E types €. The chord is recorded (with a warning), never refused.
  it('records a Ctrl+Alt letter that types an AltGr character', () => {
    expect(fromKey(key('€', 'KeyE', { ctrlKey: true, altKey: true }))).toEqual({ value: 'Ctrl+Alt+E' });
    expect(fromKey(key('@', 'Digit0', { ctrlKey: true, altKey: true }))).toEqual({ value: 'Ctrl+Alt+0' });
  });
  it('refuses what Windows keeps or cannot register', () => {
    expect(fromKey(key('F12', 'F12', { ctrlKey: true }))).toEqual({ error: 'shortcuts.f12' });
    expect(fromKey(key('t', 'KeyT'))).toEqual({ error: 'shortcuts.needModifier' });
    expect(fromKey(key('t', 'KeyT', { ctrlKey: true, metaKey: true }))).toEqual({ error: 'shortcuts.windowsKey' });
    expect(fromKey(key('€', 'KeyE', { ctrlKey: true, altKey: true, altGraph: true }))).toEqual({
      error: 'shortcuts.altGr',
    });
    expect(fromKey(key('Control', 'ControlLeft', { ctrlKey: true }))).toEqual({});
  });
});
