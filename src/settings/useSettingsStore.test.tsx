import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { bridge } from '../bridge';
import type { Settings } from '../types';
import { useSettingsStore, type SettingsStore } from './useSettingsStore';

const must = <T,>(value: T | null | undefined): T => {
  if (value == null) throw new Error('missing');
  return value;
};

// FE-02 (audit Elio): a first getSettings answering after a `settings-changed` put the older copy
// back, and the window's next save would have written it.
let root: Root;
let store: SettingsStore;
let changed: ((settings: Settings) => void) | undefined;
function Harness() {
  store = useSettingsStore();
  return null;
}
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  changed = undefined;
  vi.spyOn(bridge, 'getHistory').mockResolvedValue([]);
  vi.spyOn(bridge, 'on').mockImplementation(((name: string, handler: (payload: never) => void) => {
    if (name === 'settings-changed') changed = handler as (settings: Settings) => void;
    return Promise.resolve(() => undefined);
  }) as typeof bridge.on);
  root = createRoot(document.createElement('div'));
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.restoreAllMocks();
});

describe('the Settings window store', () => {
  it('keeps a change received while the first read was on its way', async () => {
    const base = await bridge.getSettings();
    const first = deferred<Settings>();
    vi.spyOn(bridge, 'getSettings').mockReturnValueOnce(first.promise);
    await act(async () => root.render(<Harness />));
    await act(async () => must(changed)({ ...base, language: 'fr' }));
    expect(store.settings?.language).toBe('fr');
    await act(async () => first.resolve({ ...base, language: 'en' }));
    expect(store.settings?.language).toBe('fr');
  });

  it('lets a reload win only when nothing newer came in the meantime', async () => {
    const base = await bridge.getSettings();
    vi.spyOn(bridge, 'getSettings').mockResolvedValueOnce({ ...base, language: 'en' });
    await act(async () => root.render(<Harness />));
    expect(store.settings?.language).toBe('en');
    // A reload overtaken by an edit: the edit stays.
    const late = deferred<Settings>();
    vi.spyOn(bridge, 'getSettings').mockReturnValueOnce(late.promise);
    vi.spyOn(bridge, 'saveSettings').mockResolvedValue(undefined);
    await act(async () => store.reload());
    await act(async () => store.persist({ ...must(store.settings), theme: 'dark' }, true));
    await act(async () => late.resolve({ ...base, language: 'en', theme: 'light' }));
    expect(store.settings?.theme).toBe('dark');
    // A reload nothing overtook: adopted.
    vi.spyOn(bridge, 'getSettings').mockResolvedValueOnce({ ...base, theme: 'light' });
    await act(async () => store.reload());
    expect(store.settings?.theme).toBe('light');
  });
});
