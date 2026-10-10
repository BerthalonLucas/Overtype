import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SystemMotion } from '../types';

// The app asks Rust (SPI_GETCLIENTAREAANIMATION) rather than trusting WebView2's media query.
const native = vi.hoisted(() => ({
  answer: null as SystemMotion | null,
  push: undefined as ((value: SystemMotion) => void) | undefined,
}));
vi.mock('../bridge', () => ({
  bridge: {
    native: true,
    systemMotion: () => Promise.resolve(native.answer),
    on: (_: string, handler: (value: SystemMotion) => void) => {
      native.push = handler;
      return Promise.resolve(() => undefined);
    },
  },
}));

let mediaReduces = false;
const media = {
  get matches() {
    return mediaReduces;
  },
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
};

describe('whether Windows reduces animations', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    mediaReduces = false;
    native.answer = null;
    native.push = undefined;
  });

  it('believes Rust over prefers-reduced-motion, live, in « suivre Windows »', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => media),
    );
    native.answer = { reduced: true };
    const { applyMotion } = await import('./preference');
    const root = document.createElement('html');
    const stop = applyMotion('system', root);
    // Before Rust answers, the media query decides.
    expect(root.dataset.motion).toBe('full');
    await vi.waitFor(() => expect(root.dataset.motion).toBe('reduced'));
    native.push?.({ reduced: false });
    expect(root.dataset.motion).toBe('full');
    mediaReduces = true;
    native.push?.({ reduced: true });
    expect(root.dataset.motion).toBe('reduced');
    stop();
    native.push?.({ reduced: false });
    expect(root.dataset.motion).toBe('reduced');
  });

  it('keeps the media query when Rust does not know', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => media),
    );
    mediaReduces = true;
    const { subscribeSystemMotion, systemReducesMotion } = await import('./system');
    const stop = subscribeSystemMotion(() => undefined);
    await Promise.resolve();
    expect(systemReducesMotion()).toBe(true);
    stop();
  });

  it('does not ask Rust for a forced choice', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => media),
    );
    native.answer = { reduced: true };
    const { applyMotion } = await import('./preference');
    const root = document.createElement('html');
    applyMotion('full', root);
    await Promise.resolve();
    expect(root.dataset.motion).toBe('full');
    expect(native.push).toBeUndefined();
  });
});
