import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, Minus, RotateCw, ScrollText, X } from 'lucide-react';
import { bridge } from '../bridge';
import { locales, useLanguage, useT } from '../i18n';
import { Button, ICON, Notice, StatusDot, cx, type StatusState } from '../components/controls';
import { useReduced, useTx } from '../components/motion';
import type { ModelInfo, NormalizedEndpoint, ProbeProblem, ProbeResult, ProbeStep, ProbeStepEvent } from '../types';
import { describeProblem, stepName, stepText } from './causes';
import { normalizeEndpoint, shortModel } from './endpoint';
import './connection.css';

/*
 * The live check of a connection, shared by the setup (question « Votre modèle ») and
 * Settings › Server (design-lab/reglages/src/connection/Connection.jsx; Rust: probe.rs).
 *
 *   const probe = useProbe({ endpoint, apiKey, noKey });      one check, of what is TYPED
 *   <ConnectionCheck probe={probe} model={id} onOpenLog={…} />  the line + the trace
 *   useCheck(probe) + <CheckLine> + <CheckTrace>               the same, split (the server card)
 *   <ProbeTrace steps problem actions />                       the bare trace (4 steps, « balayage »)
 *   <InsecureNotice endpoint={probe.endpoint} />               « Connexion non chiffrée »
 *
 * The trace is visible while it checks: the 4 steps are there from the start, dimmed, a light
 * sweeps the running one, each lights up with its time when done. Once connected it holds a
 * moment, then COLLAPSES into one line (« ● Connecté · model · 162 ms   Détails ▾ »). On an error
 * it stays open on the failing step: what failed, the cause, what to do, « Voir le journal ».
 *
 * Nothing may stay spinning: a check ends by its answer, by a newer check, by the watchdog below
 * (Rust's own limit is 10 s), or when its field empties.
 */

export type ProbeStatus = 'idle' | 'running' | 'ok' | 'error';
type ProbeState = { status: ProbeStatus; steps: ProbeStep[]; models: ModelInfo[]; problem: ProbeProblem | null; run: string | null; at: number; totalMs: number };
export type Probe = ProbeState & {
  // What was typed, read: ok false while the address is empty or unreadable.
  endpoint: NormalizedEndpoint;
  // There is something to check: a readable address, and a key or « no key ».
  ready: boolean;
  // Check now (« Vérifier à nouveau »); a check already running is replaced, never doubled.
  start: () => void;
};
const idle: ProbeState = { status: 'idle', steps: [], models: [], problem: null, run: null, at: 0, totalMs: 0 };
export const checkDelayMs = 600;
// Rust gives up after 10 s; if even that answer never comes (a bridge fault), the row fails here.
export const watchdogMs = 15_000;

// Rust runs one check per window: a newer one cancels the older. Two servers of the same window
// therefore take turns here instead of cancelling each other.
let turn: Promise<unknown> = Promise.resolve();
let serial = 0;
const newRun = () => `check-${Date.now().toString(36)}-${(serial++).toString(36)}`;

export function useProbe({ endpoint, apiKey, noKey, auto = true }: { endpoint: string; apiKey: string; noKey: boolean; auto?: boolean }): Probe {
  const [state, setState] = useState<ProbeState>(idle);
  const current = useRef<string | null>(null);
  const timer = useRef(0);
  const args = useRef({ endpoint, apiKey, noKey });
  args.current = { endpoint, apiKey, noKey };
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);

  const drop = useCallback(() => {
    const run = current.current;
    current.current = null;
    if (run) void bridge.cancelProbe(run).catch(() => undefined);
  }, []);
  const start = useCallback(() => {
    window.clearTimeout(timer.current);
    drop();
    const run = newRun();
    current.current = run;
    const mine = () => live.current && current.current === run;
    const { endpoint: address, apiKey: key, noKey: none } = args.current;
    // Keep the trace's rows (back to « waiting ») until the first step arrives: the trace never
    // collapses and reopens under the pointer on « Vérifier à nouveau ».
    setState(previous => ({ ...previous, status: 'running', steps: previous.steps.map(step => ({ id: step.id, state: 'waiting' })), problem: null, run, at: Date.now() }));
    const finish = (result: ProbeResult) => {
      if (!mine()) return;
      current.current = null;
      // Cancelled from elsewhere (never by us: a newer check of ours is no longer « mine »).
      if (!result.ok && result.problem?.cause === 'cancelled') { setState({ ...idle, at: Date.now() }); return; }
      setState({ status: result.ok ? 'ok' : 'error', steps: result.steps, models: result.models, problem: result.problem ?? null, run, at: Date.now(), totalMs: result.totalMs });
    };
    const fail = (cause: ProbeProblem['cause']) => {
      if (!mine()) return;
      current.current = null;
      void bridge.cancelProbe(run).catch(() => undefined);
      setState(previous => {
        const running = previous.steps.find(step => step.state === 'running')?.id ?? previous.steps.find(step => step.state === 'waiting')?.id ?? 'reach';
        const steps: ProbeStep[] = (previous.steps.length ? previous.steps : (['address', 'reach', 'key', 'models'] as const).map(id => ({ id, state: 'waiting' as const })))
          .map(step => step.id === running ? { id: step.id, state: 'error' } : step.state === 'ok' ? step : { id: step.id, state: 'skipped' });
        return { status: 'error', steps, models: [], problem: { step: running, cause }, run, at: Date.now(), totalMs: 0 };
      });
    };
    const job = turn.then(async () => {
      if (!mine()) return;
      let off: (() => void) | undefined;
      let watchdog = 0;
      try {
        off = await bridge.on<ProbeStepEvent>('probe-step', event => { if (event.run === run && mine()) setState(previous => ({ ...previous, steps: event.steps })); });
        const answer = bridge.probeConnection(run, address, key, none);
        const late = new Promise<'late'>(resolve => { watchdog = window.setTimeout(() => resolve('late'), watchdogMs); });
        const result = await Promise.race([answer, late]);
        if (result === 'late') fail('reach.timeout'); else finish(result);
      } catch { fail('reach.network'); }
      finally { window.clearTimeout(watchdog); off?.(); }
    });
    turn = job.catch(() => undefined);
  }, [drop]);

  const read = normalizeEndpoint(endpoint);
  const ready = read.ok && (apiKey.trim() !== '' || noKey);
  // Checked 600 ms after the last change, when there is something to check.
  useEffect(() => {
    if (!auto) return undefined;
    if (!ready) { window.clearTimeout(timer.current); drop(); setState(previous => previous.status === 'idle' && !previous.steps.length ? previous : idle); return undefined; }
    timer.current = window.setTimeout(start, checkDelayMs);
    return () => window.clearTimeout(timer.current);
  }, [endpoint, apiKey, noKey, ready, auto, start, drop]);
  useEffect(() => () => { window.clearTimeout(timer.current); drop(); }, [drop]);
  return { ...state, endpoint: read, ready, start };
}

// A check mark drawn once (stroke-dashoffset).
function CheckDraw() {
  return <svg className="ft-trace-check" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.6 6.3l2.2 2.2L9.4 3.6" /></svg>;
}
// A duration in the interface's language: milliseconds, then seconds from `secondsFrom` on.
export function useDuration(secondsFrom = 10_000) {
  const t = useT();
  const language = useLanguage();
  return useCallback((ms: number) => ms >= secondsFrom
    ? t('conn.seconds', { seconds: new Intl.NumberFormat(locales[language], { maximumFractionDigits: 1 }).format(ms / 1000) })
    : t('conn.ms', { ms: new Intl.NumberFormat(locales[language]).format(Math.max(0, Math.round(ms))) }), [t, language, secondsFrom]);
}

// The live trace, « balayage ». On a failure, the gesture, the system's words and the actions sit
// right under the failed step (one place for the error).
export function ProbeTrace({ steps, problem, actions }: { steps: ProbeStep[]; problem?: ProbeProblem | null; actions?: ReactNode }) {
  const t = useT();
  const tx = useTx();
  const duration = useDuration();
  const described = problem ? describeProblem(problem, t) : null;
  return <ol className="ft-trace" aria-label={t('conn.trace')} aria-live="polite">
    {steps.map(step => <li key={step.id} className="ft-trace-step" data-state={step.state} data-step={step.id}>
      <span className="ft-trace-row">
        <span className="ft-trace-icon" aria-hidden="true">
          {step.state === 'ok' ? <CheckDraw /> : step.state === 'error' ? <X size={12} strokeWidth={2.5} /> : step.state === 'skipped' ? <Minus size={12} strokeWidth={2} /> : step.state === 'running' ? <span className="ft-trace-spin" /> : <i />}
        </span>
        <span className="ft-trace-name">{stepName(step.id, t)}</span>
        <span className="ft-trace-detail">{stepText(step, problem ?? null, t)}</span>
        <span className="ft-trace-ms">{step.ms != null && (step.state === 'ok' || step.state === 'error') ? duration(step.ms) : ''}</span>
      </span>
      {step.state === 'error' && (described || actions) && <motion.span className="ft-trace-fix" role="alert" initial={{ opacity: 0, y: -2 }} animate={{ opacity: 1, y: 0 }} transition={tx('smooth')}>
        {described && <span className="ft-trace-fix-text">{described.fix}</span>}
        {problem?.technical && <code className="ft-trace-cause">{problem.status ? `HTTP ${problem.status} · ` : ''}{problem.technical}</code>}
        {!problem?.technical && problem?.status ? <code className="ft-trace-cause">HTTP {problem.status}</code> : null}
        {actions && <span className="ft-trace-actions">{actions}</span>}
      </motion.span>}
    </li>)}
  </ol>;
}

// Open / collapsed state of the check. While it runs and on an error: open. Connected: open a
// moment (the last step lights up), then collapsed, unless the person unfolded « Détails ».
export const settleMs = 900;
export type CheckState = { open: boolean; collapsible: boolean; toggle: () => void; details: boolean };
export function useCheck(probe: Pick<Probe, 'status' | 'steps' | 'at'>): CheckState {
  const [manual, setManual] = useState<boolean | null>(null);
  const [settled, setSettled] = useState(probe.status === 'ok');
  useEffect(() => {
    if (probe.status === 'ok') { const id = window.setTimeout(() => setSettled(true), settleMs); return () => window.clearTimeout(id); }
    setSettled(false);
    if (probe.status === 'running') setManual(null);
    return undefined;
  }, [probe.status, probe.at]);
  const collapsible = probe.status === 'ok' && settled;
  const open = probe.steps.length > 0 && (probe.status !== 'ok' || !settled || manual === true) && probe.status !== 'idle';
  return { open, collapsible, toggle: () => setManual(current => !current), details: manual === true };
}

// The one-line status: « ● Connecté · model · 162 ms   Détails ▾ ».
export function CheckLine({ probe, model, check, className }: { probe: Probe; model?: string; check?: CheckState; className?: string }) {
  const t = useT();
  const duration = useDuration();
  const running = probe.steps.find(step => step.state === 'running');
  let state: StatusState = 'idle';
  let parts: string[];
  if (probe.status === 'running') { state = 'running'; parts = [running ? t('conn.checkingStep', { step: stepName(running.id, t).toLocaleLowerCase() }) : t('conn.checking')]; }
  else if (probe.status === 'ok') {
    state = 'ok';
    const count = probe.models.length;
    parts = [t('conn.connected'), model ? shortModel(model) : t(count === 1 ? 'conn.modelsOne' : 'conn.modelsOther', { count }), duration(probe.totalMs)];
  }
  else if (probe.status === 'error') {
    // The open trace already says what failed (its row) and what to do: the line names the step.
    const failed = probe.steps.find(step => step.state === 'error');
    state = 'error';
    parts = [failed ? t('conn.failedStep', { step: stepName(failed.id, t) }) : t('conn.failed')];
  }
  else if (!probe.endpoint.ok) parts = [t('conn.needAddress')];
  else if (!probe.ready) { state = 'warn'; parts = [t('conn.needKey')]; }
  else parts = [t('conn.notChecked')];
  return <span className={cx('ft-check-line', className)} data-state={state}>
    <StatusDot state={state}>
      {parts.map((text, index) => <span key={index} className="ft-check-part" data-i={index}>{index > 0 && <span className="ft-check-sep" aria-hidden="true">·</span>}{text}</span>)}
    </StatusDot>
    {check?.collapsible && <button type="button" className="ft-check-toggle" aria-expanded={check.open} onClick={check.toggle}>
      {t('conn.details')}<ChevronDown size={14} strokeWidth={1.75} aria-hidden="true" />
    </button>}
  </span>;
}

// The trace under the line, with its disclosure (height + opacity on a small subtree).
// onOpenLog: « Voir le journal », with the failure (its logId is the journal entry to land on).
export function CheckTrace({ probe, check, onOpenLog, className }: { probe: Probe; check: CheckState; onOpenLog?: (problem: ProbeProblem | null, run: string | null) => void; className?: string }) {
  const t = useT();
  const tx = useTx();
  const reduced = useReduced();
  const problem = probe.status === 'error' ? probe.problem : null;
  // « Vérifier à nouveau » restarts the check: the error block under the failed step goes away.
  // Hold the trace at its height until the check ends, so nothing slides under the pointer (a
  // double click never lands on what was below).
  const inner = useRef<HTMLDivElement>(null);
  const lastHeight = useRef(0);
  useLayoutEffect(() => { if (probe.status !== 'running') lastHeight.current = inner.current?.offsetHeight ?? 0; });
  return <AnimatePresence initial={false}>
    {check.open && <motion.div key="trace" className={cx('ft-check-trace', className)}
      initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0, transition: tx({ duration: 0.26, ease: 'out' }) }} transition={tx('smooth')}>
      <div ref={inner} className="ft-check-trace-inner" style={probe.status === 'running' && lastHeight.current ? { minHeight: lastHeight.current } : undefined}>
        <ProbeTrace steps={probe.steps} problem={problem} actions={probe.status === 'error' ? <>
          <Button size="sm" icon={<RotateCw {...ICON} size={14} />} onClick={probe.start}>{t('conn.recheck')}</Button>
          {onOpenLog && <Button size="sm" variant="ghost" icon={<ScrollText {...ICON} size={14} />} onClick={() => onOpenLog(problem, probe.run)}>{t('conn.openLog')}</Button>}
        </> : null} />
      </div>
    </motion.div>}
  </AnimatePresence>;
}

// Line + trace, stacked: for the setup, or anywhere the check stands alone.
export function ConnectionCheck({ probe, model, onOpenLog, className }: { probe: Probe; model?: string; onOpenLog?: (problem: ProbeProblem | null, run: string | null) => void; className?: string }) {
  const check = useCheck(probe);
  if (probe.status === 'idle' && !probe.steps.length) return null;
  return <div className={cx('ft-check', className)} data-state={probe.status}>
    <CheckLine probe={probe} model={model} check={check} />
    <CheckTrace probe={probe} check={check} onOpenLog={onOpenLog} />
  </div>;
}

// http:// to another machine: said once, clearly, under the address.
export function InsecureNotice({ endpoint }: { endpoint: NormalizedEndpoint }) {
  const t = useT();
  const tx = useTx();
  return <AnimatePresence initial={false}>
    {endpoint.ok && endpoint.insecure && <motion.div key="insecure" className="ft-insecure" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={tx('smooth')}>
      <Notice kind="warn" title={t('conn.insecureTitle')} text={t('conn.insecureText')} />
    </motion.div>}
  </AnimatePresence>;
}
