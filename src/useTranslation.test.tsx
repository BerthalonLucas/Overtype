import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { bridge } from './bridge';
import type { Settings } from './types';
import { useTranslation } from './useTranslation';

const must = <T,>(value: T | null | undefined): T => {
  if (value == null) throw new Error('missing');
  return value;
};

// FE-02 (audit Elio), the overlay's copy: a first read answering after a `settings-changed` must
// not put the older settings back.
let root: Root;
let settings: Settings | null = null;
let changed: ((settings: Settings) => void) | undefined;
function Harness() {
  settings = useTranslation().settings;
  return null;
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  changed = undefined;
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

describe('the overlay settings', () => {
  it('keep a change received while the first read was on its way', async () => {
    const base = await bridge.getSettings();
    let answer!: (value: Settings) => void;
    vi.spyOn(bridge, 'getSettings').mockReturnValueOnce(
      new Promise<Settings>((resolve) => {
        answer = resolve;
      }),
    );
    await act(async () => root.render(<Harness />));
    await act(async () => must(changed)({ ...base, language: 'fr' }));
    expect(settings?.language).toBe('fr');
    await act(async () => answer({ ...base, language: 'en' }));
    expect(settings?.language).toBe('fr');
  });
});
