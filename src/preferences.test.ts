import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, resolveTheme, type SystemThemeSource } from './theme';
import { applyMotion, reducedMotionConfig, resolveMotion } from './motion/preference';

describe('document preferences', () => {
  it('follows the system theme unless the user forced one', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
  // WebView2 answers prefers-color-scheme: light whatever Windows says: in « follow Windows »
  // the mode Rust reads wins, live, and the media query stays the answer when Rust has none.
  it('follows the Windows app mode that Rust reports, live, only while the theme follows Windows', async () => {
    const root = document.createElement('div');
    let emitSystem: ((payload: unknown) => void) | undefined;
    let unlistened = 0;
    let answer: unknown = null;
    const source: SystemThemeSource = {
      current: () => Promise.resolve(answer),
      listen: (handler) => {
        emitSystem = handler;
        return Promise.resolve(() => {
          unlistened += 1;
        });
      },
    };
    const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
    // No value in the registry (or no Rust at all): the media query decides (none in jsdom: light).
    let stop = applyTheme('system', root, source);
    await settle();
    expect(root.dataset.theme).toBe('light');
    stop();
    expect(unlistened).toBe(1);
    // Windows in dark mode: dark at once, then light when the mode flips while the window is open.
    answer = { dark: true };
    stop = applyTheme('system', root, source);
    await settle();
    expect(root.dataset.theme).toBe('dark');
    emitSystem?.({ dark: false });
    expect(root.dataset.theme).toBe('light');
    emitSystem?.({ unexpected: true });
    expect(root.dataset.theme).toBe('light');
    stop();
    // A forced theme ignores Windows and does not listen.
    emitSystem = undefined;
    stop = applyTheme('dark', root, source);
    await settle();
    expect(root.dataset.theme).toBe('dark');
    expect(emitSystem).toBeUndefined();
    stop();
    // Back to « follow Windows »: the last reported mode applies before Rust answers again.
    answer = new Promise(() => undefined);
    stop = applyTheme('system', root, { ...source, current: () => new Promise(() => undefined) });
    expect(root.dataset.theme).toBe('light');
    stop();
  });
  it('reduces motion when Windows asks, unless the user chose always or reduced', () => {
    expect(resolveMotion('system', true)).toBe('reduced');
    expect(resolveMotion('system', false)).toBe('full');
    expect(resolveMotion('full', true)).toBe('full');
    expect(resolveMotion('reduced', false)).toBe('reduced');
    expect([reducedMotionConfig('system'), reducedMotionConfig('full'), reducedMotionConfig('reduced')]).toEqual([
      'user',
      'never',
      'always',
    ]);
  });

  // The e2e suite and the visual references emulate prefers-reduced-motion: in « system »,
  // data-motion has to follow that media, live; a forced choice ignores it.
  describe('data-motion', () => {
    let reduces = false;
    const listeners = new Set<() => void>();
    const media = {
      get matches() {
        return reduces;
      },
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    };
    const flip = (next: boolean) => {
      reduces = next;
      listeners.forEach((fn) => fn());
    };
    afterEach(() => {
      vi.unstubAllGlobals();
      listeners.clear();
      reduces = false;
    });

    it('follows prefers-reduced-motion while the setting is « system »', () => {
      vi.stubGlobal(
        'matchMedia',
        vi.fn(() => media),
      );
      const root = document.createElement('html');
      const stop = applyMotion('system', root);
      expect(window.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
      expect(root.dataset.motion).toBe('full');
      flip(true);
      expect(root.dataset.motion).toBe('reduced');
      flip(false);
      expect(root.dataset.motion).toBe('full');
      stop();
      flip(true);
      expect(root.dataset.motion).toBe('full');
    });

    it('ignores the system when the user forced full or reduced motion', () => {
      vi.stubGlobal(
        'matchMedia',
        vi.fn(() => media),
      );
      reduces = true;
      const root = document.createElement('html');
      applyMotion('full', root);
      expect(root.dataset.motion).toBe('full');
      applyMotion('reduced', root);
      flip(false);
      expect(root.dataset.motion).toBe('reduced');
      expect(listeners.size).toBe(0);
    });
  });
});
