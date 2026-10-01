import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { bridge } from '../bridge';
import { mockTiming, setConnScenario } from '../bridge.mock';
import { checkDelayMs, settleMs, useCheck, useProbe, watchdogMs, type CheckState, type Probe } from './Check';

// The live check on the preview's simulated server (src/bridge.mock.ts, answering at once here):
// what the hook says at each moment, and that nothing can stay spinning.
let root: Root | undefined;
let probe: Probe;
let check: CheckState;
type Props = { endpoint: string; apiKey?: string; noKey?: boolean; auto?: boolean };
function Harness({ endpoint, apiKey = '', noKey = true, auto = true }: Props) {
  probe = useProbe({ endpoint, apiKey, noKey, auto });
  check = useCheck(probe);
  return null;
}
const render = (props: Props) => act(async () => { root!.render(<Harness {...props} />); });
// Lets the 600 ms pause pass, then the answers (promises and zero-length timers) settle.
const settle = async (ms = checkDelayMs) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); for (let n = 0; n < 12; n++) await act(async () => { await vi.advanceTimersByTimeAsync(1); }); };

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  mockTiming.scale = 0;
  setConnScenario('ok');
  root = createRoot(document.createElement('div'));
});
afterEach(async () => {
  await act(async () => root?.unmount());
  vi.useRealTimers();
  vi.restoreAllMocks();
  mockTiming.scale = 1;
  setConnScenario('ok');
});

describe('the live check of a connection', () => {
  it('waits for something to check: an address, then a key or « no key »', async () => {
    await render({ endpoint: '', noKey: false });
    expect(probe).toMatchObject({ status: 'idle', ready: false, endpoint: { ok: false, reason: 'empty' } });
    await render({ endpoint: 'llm.exemple.com', noKey: false });
    await settle();
    expect(probe).toMatchObject({ status: 'idle', ready: false, endpoint: { ok: true, base: 'https://llm.exemple.com' } });
    expect(check.open).toBe(false);
  });

  it('checks 600 ms after the last change, shows the trace, then collapses it once connected', async () => {
    const spy = vi.spyOn(bridge, 'probeConnection');
    await render({ endpoint: 'llm.exemple.com/v1' });
    await act(async () => { await vi.advanceTimersByTimeAsync(checkDelayMs - 1); });
    expect(spy).not.toHaveBeenCalled();
    await settle(1);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0].slice(1)).toEqual(['llm.exemple.com/v1', '', true]);
    expect(probe.status).toBe('ok');
    expect(probe.steps.map(step => step.state)).toEqual(['ok', 'ok', 'ok', 'ok']);
    expect(probe.models).toHaveLength(4);
    // Held open a moment (the last row lights up), then one line; « Details » unfolds it again.
    expect(check).toMatchObject({ open: true, collapsible: false });
    await act(async () => { await vi.advanceTimersByTimeAsync(settleMs); });
    expect(check).toMatchObject({ open: false, collapsible: true });
    await act(async () => check.toggle());
    expect(check).toMatchObject({ open: true, details: true });
  });

  it('checks once however fast the address is typed, and only the last one typed', async () => {
    const spy = vi.spyOn(bridge, 'probeConnection');
    for (const typed of ['l', 'll', 'llm', 'llm.exemple', 'llm.exemple.com']) { await render({ endpoint: typed }); await act(async () => { await vi.advanceTimersByTimeAsync(100); }); }
    await settle();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][1]).toBe('llm.exemple.com');
  });

  it('stays open on the failing step with its cause, and « Check again » clicked twice runs one check at a time', async () => {
    setConnScenario('cle-requise');
    await render({ endpoint: 'llm.exemple.com' });
    await settle();
    expect(probe.status).toBe('error');
    expect(probe.problem).toMatchObject({ step: 'key', cause: 'key.required', status: 401 });
    expect(probe.steps.map(step => step.state)).toEqual(['ok', 'ok', 'error', 'skipped']);
    await act(async () => { await vi.advanceTimersByTimeAsync(settleMs * 3); });
    expect(check).toMatchObject({ open: true, collapsible: false });
    // The server now accepts: two clicks in a row end in one answer, the newer check's.
    setConnScenario('ok');
    const cancel = vi.spyOn(bridge, 'cancelProbe');
    await act(async () => { probe.start(); probe.start(); });
    // The rows are kept (back to waiting) so the trace does not jump under the pointer.
    expect(probe.status).toBe('running');
    expect(probe.steps).toHaveLength(4);
    await settle(1);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(probe.status).toBe('ok');
  });

  it('ignores the answer of a check that a change made stale', async () => {
    mockTiming.scale = 1;
    await render({ endpoint: 'llm.exemple.com' });
    await act(async () => { await vi.advanceTimersByTimeAsync(checkDelayMs + 50); });
    expect(probe.status).toBe('running');
    const first = probe.run;
    // The address empties mid-check: back to idle at once, and the old answer never shows.
    await render({ endpoint: '' });
    expect(probe).toMatchObject({ status: 'idle', steps: [], models: [] });
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(probe.status).toBe('idle');
    expect(probe.run).not.toBe(first);
  });

  it('never stays spinning: a check that gets no answer fails by itself', async () => {
    vi.spyOn(bridge, 'probeConnection').mockReturnValue(new Promise(() => undefined));
    const cancel = vi.spyOn(bridge, 'cancelProbe');
    await render({ endpoint: 'llm.exemple.com' });
    await settle();
    expect(probe.status).toBe('running');
    await act(async () => { await vi.advanceTimersByTimeAsync(watchdogMs); });
    expect(probe.status).toBe('error');
    expect(probe.problem?.cause).toBe('reach.timeout');
    expect(probe.steps.some(step => step.state === 'running' || step.state === 'waiting')).toBe(false);
    expect(cancel).toHaveBeenCalled();
  });

  it('says a bridge failure as a failure, not as a wait', async () => {
    vi.spyOn(bridge, 'probeConnection').mockRejectedValue('Fenêtre inattendue.');
    await render({ endpoint: 'llm.exemple.com' });
    await settle();
    expect(probe).toMatchObject({ status: 'error', problem: { cause: 'reach.network' } });
  });

  it('does not check by itself when its host asks it not to', async () => {
    const spy = vi.spyOn(bridge, 'probeConnection');
    await render({ endpoint: 'llm.exemple.com', auto: false });
    await settle();
    expect(spy).not.toHaveBeenCalled();
    expect(probe).toMatchObject({ status: 'idle', ready: true });
  });
});
