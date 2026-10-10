import { useCallback, useEffect, useRef, useState } from 'react';
import { bridge } from '../bridge';
import type { ProbeProblem, TryResult } from '../types';

// « Essayer avec une phrase », one controller for Settings › Server and the setup's « Votre modèle »
// (each draws its own line): one fixed, synthetic sentence (never the person's text) sent to what
// is typed. One try at a time, under a run id Rust accepts (letters, digits, - and _, 64 at most).
// It ends by its answer or, at the latest, by the watchdog (Rust's own limit is 30 s): the button
// never stays spinning. A changed address, key or model (or `reset`) cancels the try on its way and
// forgets its answer, which would be about something else; so does leaving the screen.
export const TRY_WATCHDOG_MS = 35_000;
export type TryTarget = { endpoint: string; apiKey: string; noKey: boolean; model: string };
// stalled: no answer of the server's own (the watchdog, or the bridge refused the call).
export type TryState =
  | { state: 'idle' }
  | { state: 'running' }
  | { state: 'ok'; run: string; reply: string; ms: number }
  | { state: 'failed'; run: string; problem: ProbeProblem; stalled: boolean };

const newRun = () => `try-${crypto.randomUUID()}`;

export function useTryModel(target: TryTarget, reset?: unknown) {
  const [trial, setTrial] = useState<TryState>({ state: 'idle' });
  const run = useRef<string | null>(null);
  const watchdog = useRef(0);
  const latest = useRef(target);
  latest.current = target;
  const stop = useCallback(() => {
    window.clearTimeout(watchdog.current);
    const current = run.current;
    run.current = null;
    if (current) void bridge.cancelProbe(current).catch(() => undefined);
  }, []);
  const { endpoint, apiKey, noKey, model } = target;
  // biome-ignore lint/correctness/useExhaustiveDependencies: any change to these fields ends the running try and forgets its answer
  useEffect(() => {
    stop();
    setTrial({ state: 'idle' });
  }, [endpoint, apiKey, noKey, model, reset, stop]);
  useEffect(() => stop, [stop]);
  const start = useCallback(async () => {
    stop();
    const id = newRun();
    run.current = id;
    setTrial({ state: 'running' });
    const { endpoint, apiKey, noKey, model } = latest.current;
    watchdog.current = window.setTimeout(() => {
      if (run.current !== id) return;
      stop();
      setTrial({ state: 'failed', run: id, problem: { step: 'try', cause: 'try.timeout' }, stalled: true });
    }, TRY_WATCHDOG_MS);
    let answer: TryResult;
    let stalled = false;
    try {
      answer = await bridge.tryModel(id, endpoint, apiKey, noKey, model);
    } catch {
      answer = { run: id, ok: false, problem: { step: 'try', cause: 'try.server' } };
      stalled = true;
    }
    if (run.current !== id) return;
    window.clearTimeout(watchdog.current);
    run.current = null;
    if (answer.ok) setTrial({ state: 'ok', run: id, reply: answer.reply, ms: answer.ms });
    else if (answer.problem.cause === 'cancelled') setTrial({ state: 'idle' });
    else setTrial({ state: 'failed', run: id, problem: answer.problem, stalled });
  }, [stop]);
  return { trial, start };
}
