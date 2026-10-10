import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { bridge } from '../bridge';
import type { TryResult } from '../types';
import { TRY_WATCHDOG_MS, useTryModel, type TryTarget, type TryState } from './useTryModel';

// D2 (audit Elio): « Essayer avec une phrase » lived twice (Settings › Server, the setup), and only
// the setup cancelled a try whose address, key or model changed. One controller now.
let root: Root;
let trial: ReturnType<typeof useTryModel>;
function Harness({ target, reset }: { target: TryTarget; reset?: unknown }) {
  trial = useTryModel(target, reset);
  return null;
}
const target: TryTarget = { endpoint: 'https://llm.exemple.com', apiKey: '', noKey: true, model: 'm' };
const render = (props: { target: TryTarget; reset?: unknown }) => act(async () => root.render(<Harness {...props} />));
const pending = () => {
  const answers: Array<(result: TryResult) => void> = [];
  const runs: string[] = [];
  vi.spyOn(bridge, 'tryModel').mockImplementation(
    (run) =>
      new Promise<TryResult>((resolve) => {
        runs.push(run);
        answers.push(resolve);
      }),
  );
  return { answers, runs };
};
const state = (): TryState => trial.trial;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  root = createRoot(document.createElement('div'));
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('one sentence to try a model', () => {
  it('runs under an id Rust accepts, and shows the answer of that run', async () => {
    const { answers, runs } = pending();
    await render({ target });
    await act(async () => void trial.start());
    expect(state()).toEqual({ state: 'running' });
    expect(runs[0]).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
    await act(async () => answers[0]({ run: runs[0], ok: true, reply: 'Bonjour', ms: 900 }));
    expect(state()).toEqual({ state: 'ok', run: runs[0], reply: 'Bonjour', ms: 900 });
  });

  for (const field of ['endpoint', 'apiKey', 'noKey', 'model'] as const) {
    it(`cancels a try on its way when the ${field} changes, and forgets its answer`, async () => {
      const { answers, runs } = pending();
      const cancel = vi.spyOn(bridge, 'cancelProbe').mockResolvedValue(undefined);
      await render({ target });
      await act(async () => void trial.start());
      const changed = { ...target, [field]: field === 'noKey' ? false : 'other' };
      await render({ target: changed });
      expect(cancel).toHaveBeenCalledWith(runs[0]);
      expect(state()).toEqual({ state: 'idle' });
      await act(async () => answers[0]({ run: runs[0], ok: true, reply: 'stale', ms: 1 }));
      expect(state()).toEqual({ state: 'idle' });
    });
  }

  it('forgets a finished answer when what was tried changes, and when the reset key changes', async () => {
    const { answers, runs } = pending();
    await render({ target, reset: 1 });
    await act(async () => void trial.start());
    await act(async () => answers[0]({ run: runs[0], ok: true, reply: 'x', ms: 1 }));
    await render({ target, reset: 2 });
    expect(state()).toEqual({ state: 'idle' });
  });

  it('never stays spinning: the watchdog ends the try and cancels it', async () => {
    const { runs } = pending();
    const cancel = vi.spyOn(bridge, 'cancelProbe').mockResolvedValue(undefined);
    await render({ target });
    await act(async () => void trial.start());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TRY_WATCHDOG_MS);
    });
    expect(cancel).toHaveBeenCalledWith(runs[0]);
    expect(state()).toMatchObject({ state: 'failed', stalled: true, problem: { step: 'try', cause: 'try.timeout' } });
  });

  it('says a refusal of the bridge as a stalled try, and a cancelled one as nothing', async () => {
    vi.spyOn(bridge, 'tryModel').mockRejectedValueOnce('gone');
    await render({ target });
    await act(async () => void trial.start());
    expect(state()).toMatchObject({ state: 'failed', stalled: true, problem: { cause: 'try.server' } });
    vi.spyOn(bridge, 'tryModel').mockImplementationOnce(async (run) => ({
      run,
      ok: false,
      problem: { step: 'try', cause: 'cancelled' },
    }));
    await act(async () => void trial.start());
    expect(state()).toEqual({ state: 'idle' });
    vi.spyOn(bridge, 'tryModel').mockImplementationOnce(async (run) => ({
      run,
      ok: false,
      problem: { step: 'try', cause: 'try.model' },
    }));
    await act(async () => void trial.start());
    expect(state()).toMatchObject({ state: 'failed', stalled: false, problem: { cause: 'try.model' } });
  });

  it('cancels the try on its way when the screen goes', async () => {
    const { runs } = pending();
    const cancel = vi.spyOn(bridge, 'cancelProbe').mockResolvedValue(undefined);
    await render({ target });
    await act(async () => void trial.start());
    await act(async () => root.unmount());
    root = createRoot(document.createElement('div'));
    expect(cancel).toHaveBeenCalledWith(runs[0]);
  });
});
