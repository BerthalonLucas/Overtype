import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Undo2, X } from 'lucide-react';
import { useT } from '../i18n';
import { IndicatorView } from '../loaders/indicators';
import { indicatorBox, ORB_DELAY_MS, workingPillShape } from '../loaders/pill';
import { usePageHidden } from '../loaders/WorkingPill';
import { ilotMetrics } from '../menu/metrics';
import { MorphSurface, type ShapeChange, type SurfaceOrigin, type SurfaceSize } from '../menu/MorphSurface';
import { useReducedMotionSetting } from '../motion/MotionPreferences';
import type { AfterReplace, ErrorCode, Indicator } from '../types';
import { Icon, iconStroke } from '../ui';
import { Countdown, resultTiming } from './countdown';
import { describeError, errorFamily, type ErrorAction, type ErrorSource } from './errors';
import '../menu/ilot.css';
import './result.css';

/*
 * The result pill of lots 9 and 10 (docs/DA-PLAN.md; design-lab/src/Simulator.jsx:255-297 and
 * app.css:155-171, the reference). One glass surface, never unmounted, whose content changes:
 *
 *   working  the work pill of lot 8 (44 × 28, 52 × 28 for the Ruban), the orb after 250 ms;
 *   done     the check drawn in 260 ms after 80 ms, then Undo with its countdown ring (8 s by
 *            default, 2 to 20; paused while the pointer rests on the pill or while Undo has the
 *            focus, resumed after); at the end, onExpire: the surface leaves (and the halo's
 *            marks with it). Without Undo the check stays 1.1 s; without both, nothing shows;
 *   undone   « Undone » for 0.9 s, then onExpire;
 *   error    a compact pill 30 high, 400 wide at most: TriangleAlert, a text of six words at
 *            most, one button (configuration: the exact Settings field; transient: Try again;
 *            paste: Copy result, nothing replaced), ✕. No shake.
 *
 * Each change of content is the surface's own (src/menu/MorphSurface.tsx): the old content
 * fades out, the new one fades in, and the box springs (morph spring) from the old size to the
 * new one, content centred, never scaled. The working stage has the fixed size of the work
 * pill; every other stage takes its content's natural size.
 *
 * Reduced motion (data-motion="reduced", src/motion/): fades only; the check is drawn at once;
 * the ring does not slide but steps once a second, and the time runs as usual. A countdown text
 * would change the pill's width every second, and a still ring would hide how long Undo stays.
 *
 * API
 *   <ResultPill stage={…} onUndo onExpire onAction onDismiss origin originX onShapeChange />
 *       The surface and its content. Render it inside <AnimatePresence> while
 *       showsResultPill(stage) is true; its exit is the surface's.
 *   resultContent(stage, handlers) → { key, size?, node } | null
 *       The same content for another MorphSurface (the Îlot's, turned into the pill): `key` is
 *       its contentKey, `size` its fixed size (undefined: the content's natural size). null: no
 *       pill (done with neither check nor Undo, or a silent error such as cancelled).
 *       The Îlot (src/menu/Ilot.tsx) takes it as is for its pill shape (src/menu/IlotStage.tsx).
 *   Stages: { stage: 'working', indicator, delayMs? } | { stage: 'done', afterReplace, clock?, busy?, drawn? }
 *           | { stage: 'undone' } | { stage: 'error', error, serverId?, model?, source? }
 *           done: see DoneContent (a shared clock, Undo on its way, the check already drawn);
 *           keyed 'done' with Undo, 'done-check' without.
 *           source 'capture': a capture Rust refused (`capture-notice`), no button at all;
 *           'undo' / 'undo-sent': an Undo that could not be done (src/result/errors.ts).
 *   onUndo()        Undo was clicked (the native side sends Ctrl+Z or pastes the original back,
 *                   after revalidation).
 *   onExpire()      the done or undone stage is over: let the surface leave.
 *   onAction(a)     the error's button: { type: 'settings', field } → bridge.openSettings(field);
 *                   { type: 'retry' }; { type: 'copy' } → copy the result. For 'copy', anything
 *                   but `false` (or a promise of it) shows « Copied » in place, then onDismiss
 *                   after 0.9 s (Simulator.jsx:290).
 *   onDismiss()     ✕, or the end of « Copied ». Without it the error pill has no ✕ (a notice
 *                   Rust shows alone, never clickable).
 *   Other components: WorkingContent, DoneContent, UndoneContent, ErrorContent (contents only,
 *   without a surface).
 */

export type ResultStage =
  | { stage: 'working'; indicator: Indicator; delayMs?: number }
  | { stage: 'done'; afterReplace: AfterReplace; clock?: Countdown; busy?: boolean; drawn?: boolean }
  | { stage: 'undone' }
  | { stage: 'error'; error: ErrorCode; serverId?: string; model?: string; source?: ErrorSource };
export type ActionAnswer = void | boolean | Promise<void | boolean>;
export type ResultHandlers = {
  onUndo?: () => void;
  onExpire?: () => void;
  onAction?: (action: ErrorAction) => ActionAnswer;
  onDismiss?: () => void;
};
export type ResultContent = { key: string; size?: SurfaceSize; node: ReactNode };

// « Undone » stays 900 ms (Simulator.jsx:169), and so does « Copied » (Simulator.jsx:290).
export const undoneMs = 900;
export const copiedMs = 900;
// The ring: r = 5 in a 14 viewBox (Simulator.jsx:282).
const circumference = 2 * Math.PI * 5;

// The work pill's content (lot 8, src/loaders/WorkingPill.tsx) without its own surface: the
// indicator's box reserved from the start, the orb after `delayMs`, the loops resting while the
// page is hidden.
// onCancel (0.6): the pill is a button while it works: a click on it cancels the request and
// the pill leaves (a click used to do nothing at all, and the pill had no way out but Escape);
// under the pointer the orb gives way to a ✕. Without it (a preview, the demo) it is a picture.
export function WorkingContent({ indicator, delayMs = ORB_DELAY_MS, onCancel }: { indicator: Indicator; delayMs?: number; onCancel?: () => void }) {
  const t = useT();
  const hidden = usePageHidden();
  const [orb, setOrb] = useState(delayMs <= 0);
  useEffect(() => {
    if (orb) return;
    const timer = window.setTimeout(() => setOrb(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [orb, delayMs]);
  const box = indicatorBox[indicator];
  const slot = <span className="working-slot" style={{ width: box.width, height: box.height }}>{orb && <span className="working-orb"><IndicatorView indicator={indicator} /></span>}</span>;
  if (!onCancel) return <span className="result-working" role="img" aria-label={t('pill.working')} data-orb={orb ? 'shown' : 'waiting'} data-paused={hidden || undefined}>{slot}</span>;
  return <button type="button" className="result-working result-cancel" aria-label={t('pill.cancel')} title={t('pill.cancel')} data-orb={orb ? 'shown' : 'waiting'} data-paused={hidden || undefined} onClick={() => onCancel()}>
    {slot}
    <span className="working-x" aria-hidden="true"><X size={12} strokeWidth={iconStroke} /></span>
  </button>;
}

// The check and Undo (Simulator.jsx:279-284). durationMs: resultTiming(afterReplace).durationMs.
// clock: a countdown that outlives this content (the Îlot keeps one per replacement, so the check
// alone that follows a withdrawn Undo ends when Undo would have); without it the content keeps
// its own of durationMs. busy: Undo is on its way: the button waits and the time stands still.
// drawn: the check is already drawn (it was, in the content this one follows).
export function DoneContent({ check, undo, durationMs, clock: shared, busy = false, drawn = false, onUndo, onExpire }: { check: boolean; undo: boolean; durationMs: number; clock?: Countdown; busy?: boolean; drawn?: boolean; onUndo?: () => void; onExpire?: () => void }) {
  const t = useT();
  const reduced = useReducedMotionSetting();
  const id = useId();
  const row = useRef<HTMLDivElement>(null);
  const ring = useRef<SVGCircleElement>(null);
  const countdown = useRef<Countdown | null>(null);
  const latest = useRef({ onExpire, reduced });
  latest.current = { onExpire, reduced };
  const [paused, setPaused] = useState(false);
  const wake = useRef<() => void>(() => undefined);

  // The time is the countdown's (performance.now()); a timer ends it even without frames, and
  // frames only draw the ring: none while paused, one per second in reduced motion. Any holder
  // pausing or resuming the clock wakes this view.
  useLayoutEffect(() => {
    const running = shared ?? new Countdown(durationMs, performance.now());
    countdown.current = running;
    let frame = 0, timer = 0, over = false, drawnArc = -1;
    const draw = (now: number) => {
      const value = latest.current.reduced ? running.steppedProgress(now) : running.progress(now);
      if (value === drawnArc || !ring.current) return;
      drawnArc = value;
      ring.current.setAttribute('stroke-dasharray', `${(circumference * value).toFixed(2)} 99`);
    };
    const run = () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      if (over) return;
      const now = performance.now();
      draw(now);
      setPaused(running.paused);
      if (running.expired(now)) { over = true; latest.current.onExpire?.(); return; }
      if (running.paused) return;
      const left = running.remaining(now);
      if (latest.current.reduced) { timer = window.setTimeout(run, Math.min(left, left % 1000 || 1000)); return; }
      timer = window.setTimeout(run, left);
      const paint = () => { draw(performance.now()); frame = window.requestAnimationFrame(paint); };
      frame = window.requestAnimationFrame(paint);
    };
    wake.current = run;
    const unsubscribe = running.subscribe(run);
    run();
    return () => {
      over = true; unsubscribe(); window.cancelAnimationFrame(frame); window.clearTimeout(timer);
      // What this content held, it releases: the next content holds its own reasons.
      for (const reason of ['hover', 'focus', 'busy']) running.resume(`${id}:${reason}`, performance.now());
    };
  }, [shared, durationMs, id]);
  useEffect(() => { wake.current(); }, [reduced]);

  const hold = useCallback((reason: 'hover' | 'focus' | 'busy', on: boolean) => {
    const running = countdown.current;
    if (!running) return;
    if (on) running.pause(`${id}:${reason}`, performance.now()); else running.resume(`${id}:${reason}`, performance.now());
  }, [id]);
  useLayoutEffect(() => { hold('busy', busy); }, [busy, hold]);
  const layout = check && undo ? '' : check ? ' is-check-only' : ' is-undo-only';
  return <div ref={row} className={`result-row${layout}`} role="group" aria-label={t('glass.replaced')} data-result-content="done" data-paused={paused || undefined}
    onMouseEnter={() => hold('hover', true)} onMouseLeave={() => hold('hover', false)}
    onFocus={() => hold('focus', true)} onBlur={event => { if (!row.current?.contains(event.relatedTarget as Node | null)) hold('focus', false); }}>
    {check && <svg className={`result-check${drawn ? ' is-drawn' : ''}`} width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path pathLength={1} d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
    {undo && <button type="button" className="result-btn result-undo" aria-disabled={busy || undefined} aria-busy={busy || undefined} onClick={() => { if (!busy) onUndo?.(); }}>
      <Undo2 size={12} strokeWidth={iconStroke} aria-hidden="true" />{t('result.undo')}
      <svg className="result-ring" viewBox="0 0 14 14" aria-hidden="true"><circle className="track" cx="7" cy="7" r="5" /><circle ref={ring} cx="7" cy="7" r="5" /></svg>
    </button>}
  </div>;
}

// After Undo (Simulator.jsx:285): « Undone », then onExpire after 0.9 s. Not a live region of its
// own: its host announces it once (the Îlot's status, src/menu/IlotStage.tsx).
export function UndoneContent({ onExpire }: { onExpire?: () => void }) {
  const t = useT();
  const latest = useRef(onExpire);
  latest.current = onExpire;
  useEffect(() => {
    const timer = window.setTimeout(() => latest.current?.(), undoneMs);
    return () => window.clearTimeout(timer);
  }, []);
  return <div className="result-undone" data-result-content="undone">
    <Undo2 size={13} strokeWidth={iconStroke} aria-hidden="true" /><span className="result-label">{t('result.undone')}</span>
  </div>;
}

// The compact error pill (Simulator.jsx:286-296, app.css:169-171).
export function ErrorContent({ error, serverId, model, source, onAction, onDismiss }: { error: ErrorCode; serverId?: string; model?: string; source?: ErrorSource } & Pick<ResultHandlers, 'onAction' | 'onDismiss'>) {
  const t = useT();
  const description = describeError(error, { serverId, model, source });
  const [copied, setCopied] = useState(false);
  const alive = useRef(true);
  const timer = useRef(0);
  const latest = useRef(onDismiss);
  latest.current = onDismiss;
  // Mounted again (StrictMode runs effects twice in development): alive again.
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; window.clearTimeout(timer.current); };
  }, []);
  const act = async () => {
    const action = description.action;
    if (!action || copied) return;
    let answer: void | boolean;
    try { answer = await onAction?.(action); } catch { return; }
    if (action.type !== 'copy' || answer === false || !alive.current) return;
    setCopied(true);
    timer.current = window.setTimeout(() => latest.current?.(), copiedMs);
  };
  return <div className="result-error" style={{ maxWidth: ilotMetrics.error.maxWidth }} data-result-content="error" data-error={error} data-family={description.family}>
    <span className="result-error-icon"><Icon name="error" size={14} /></span>
    <span className="result-error-text" role="alert">{t(description.message, description.params)}</span>
    {/* Both labels share one cell: « Copied » takes the place of « Copy result » without resizing the pill. */}
    {description.action && description.actionLabel && <button type="button" className="result-btn result-action" data-action={description.action.type} onClick={() => void act()}>
      <span className="result-swap">
        <span aria-hidden={copied || undefined}>{t(description.actionLabel)}</span>
        <span aria-hidden={!copied || undefined}>{t('result.copied')}</span>
      </span>
    </button>}
    {onDismiss && <button type="button" className="result-btn result-close" aria-label={t('common.close')} onClick={() => onDismiss()}><X size={12} strokeWidth={iconStroke} aria-hidden="true" /></button>}
  </div>;
}

export function resultContent(stage: ResultStage, handlers: ResultHandlers = {}): ResultContent | null {
  switch (stage.stage) {
    case 'working': {
      const { width, height } = workingPillShape(stage.indicator);
      return { key: 'working', size: { width, height }, node: <WorkingContent indicator={stage.indicator} delayMs={stage.delayMs} onCancel={handlers.onDismiss} /> };
    }
    case 'done': {
      const timing = resultTiming(stage.afterReplace);
      if (!timing.durationMs) return null;
      // Undo withdrawn: the check alone is a new content (it fades in while Undo fades out and the
      // surface springs narrower), on the same clock.
      return { key: timing.undo ? 'done' : 'done-check', node: <DoneContent check={timing.check} undo={timing.undo} durationMs={timing.durationMs} clock={stage.clock} busy={stage.busy} drawn={stage.drawn}
        onUndo={handlers.onUndo} onExpire={handlers.onExpire} /> };
    }
    case 'undone':
      return { key: 'undone', node: <UndoneContent onExpire={handlers.onExpire} /> };
    case 'error':
      if (errorFamily(stage.error) === 'silent') return null;
      return { key: `error-${stage.error}`, node: <ErrorContent error={stage.error} serverId={stage.serverId} model={stage.model} source={stage.source} onAction={handlers.onAction} onDismiss={handlers.onDismiss} /> };
  }
}

export const showsResultPill = (stage: ResultStage) => resultContent(stage) !== null;

export type ResultPillProps = ResultHandlers & {
  stage: ResultStage;
  origin?: SurfaceOrigin;
  originX?: string;
  onShapeChange?: (change: ShapeChange) => void;
};

export function ResultPill({ stage, origin, originX, onShapeChange, ...handlers }: ResultPillProps) {
  const content = resultContent(stage, handlers);
  if (!content) return null;
  return <MorphSurface contentKey={content.key} size={content.size} origin={origin} originX={originX} onShapeChange={onShapeChange} className="result-pill" data-result={stage.stage}>
    {content.node}
  </MorphSurface>;
}
