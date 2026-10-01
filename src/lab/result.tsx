import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { AnimatePresence } from 'motion/react';
import type { ShapeChange } from '../menu/MorphSurface';
import { indicatorOf } from '../loaders/pill';
import { errorFamily, errorCodeOf, type ErrorAction } from '../result/errors';
import { changedHighlight, changedRanges, type ChangedRanges } from '../result/highlight';
import { ResultPill, showsResultPill, type ResultStage } from '../result/ResultPill';
import { errorCodes, type AfterReplace, type ErrorCode } from '../types';
import type { ResultScenario } from './scenarios';
import './result.css';

// Lab fixture of the result pill (lots 9 and 10), in the browser only: the components driven by
// their props, the way the overlay will drive them, on fictitious data. Parameters: scenario,
// theme, preset, motion (as every frame), and lang (en | fr), indicator, check=0|1, undo=0|1,
// seconds (2-20), kind (an error code), server (a server id), stage (working | done | undone |
// error: the stage it opens on), latency (ms of simulated work), hold=1 (no automatic loop, for
// the tests). Nothing is translated: the work is a timer.

type ResultEntry = { type: 'expire' | 'undo' | 'dismiss' | 'open' } | { type: 'action'; action: ErrorAction };
type ResultEvent = ResultEntry & { t: number };
declare global { interface Window { __resultEvents?: ResultEvent[]; __resultShapes?: ShapeChange[] } }

const scenarioKind: Partial<Record<ResultScenario, ErrorCode>> = {
  'result-error-config': 'unauthorized',
  'result-error-transient': 'busy',
  'result-error-paste': 'target_changed',
  'result-error-content': 'too_long',
};
const familyLabel = { config: 'Configuration', transient: 'Passagère', paste: 'Collage', content: 'Contenu', silent: 'Silencieuse' } as const;

function describe(event: ResultEvent | undefined): string {
  if (!event) return 'Aucun événement';
  if (event.type === 'action') return event.action.type === 'settings' ? `Réglages ouverts sur le champ ${event.action.field}` : event.action.type === 'retry' ? 'Réessayer : nouveau travail' : 'Résultat copié (simulé)';
  return { expire: 'Fin du compte à rebours : la pilule part', undo: 'Annuler (Ctrl+Z envoyé à l’application, simulé)', dismiss: 'Fermée', open: 'Nouveau travail' }[event.type];
}

export function ResultFixture({ scenario, params }: { scenario: ResultScenario; params: URLSearchParams }) {
  if (scenario === 'result-diff') return <DiffFixture />;
  return <PillFixture scenario={scenario} params={params} />;
}

function PillFixture({ scenario, params }: { scenario: ResultScenario; params: URLSearchParams }) {
  const hold = params.get('hold') === '1';
  const latency = Math.max(0, Number(params.get('latency') ?? 1400) || 0);
  const indicator = indicatorOf(params.get('indicator'));
  // `server=<id>`: the server the failed request used (its field then opens); `mode=fast` of 0.5 reads as the second server.
  const serverId: string | undefined = params.get('server') ?? (params.get('mode') === 'fast' ? 's2' : params.get('mode') === 'quality' ? 's1' : undefined);
  const [after, setAfter] = useState<AfterReplace>({
    check: params.get('check') !== '0', undo: params.get('undo') !== '0',
    undoSeconds: Math.min(20, Math.max(2, Number(params.get('seconds') ?? 8) || 8)), changedWords: true, changedWordsSeconds: 60,
  });
  const [kind, setKind] = useState<ErrorCode>(params.get('kind') ? errorCodeOf(params.get('kind')) : scenarioKind[scenario] ?? 'unauthorized');
  const failing = scenario !== 'result-done';
  const outcome = (): ResultStage => failing ? { stage: 'error', error: kind, serverId, model: kind === 'model_not_found' ? 'gemma-4-12b' : undefined } : { stage: 'done', afterReplace: after };
  const first = params.get('stage');
  const initial: ResultStage = first === 'done' ? { stage: 'done', afterReplace: after } : first === 'undone' ? { stage: 'undone' } : first === 'error' ? { stage: 'error', error: kind, serverId } : { stage: 'working', indicator };
  const [stage, setStage] = useState<ResultStage>(initial);
  const [open, setOpen] = useState(true);
  const [events, setEvents] = useState<ResultEvent[]>([]);
  const work = useRef(0);
  const reopen = useRef(0);
  const latest = useRef(outcome);
  latest.current = outcome;

  const record = (event: ResultEntry) => {
    const entry: ResultEvent = { ...event, t: performance.now() };
    (window.__resultEvents ??= []).push(entry);
    setEvents(list => [...list.slice(-4), entry]);
  };
  // Simulated work: the pill, then the outcome after `latency` (never with hold=1 unless asked).
  const start = (auto = !hold) => {
    window.clearTimeout(work.current);
    window.clearTimeout(reopen.current);
    setOpen(true);
    setStage({ stage: 'working', indicator });
    record({ type: 'open' });
    if (auto) work.current = window.setTimeout(() => setStage(latest.current()), latency);
  };
  const close = (type: 'expire' | 'dismiss') => {
    record({ type });
    setOpen(false);
    if (!hold) reopen.current = window.setTimeout(() => start(), 900);
  };
  useEffect(() => {
    if (initial.stage === 'working' && !hold) work.current = window.setTimeout(() => setStage(latest.current()), latency);
    return () => { window.clearTimeout(work.current); window.clearTimeout(reopen.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onAction = (action: ErrorAction) => {
    record({ type: 'action', action });
    if (action.type === 'retry') start();
    return true;
  };
  const visible = open && showsResultPill(stage);
  return <>
    <div className="result-demo">
      <p className="result-demo-text">Could you send the <mark>updated proposal before Thursday?</mark></p>
      <div className="result-demo-anchor">
        <AnimatePresence>
          {visible && <ResultPill key="pill" stage={stage}
            onShapeChange={change => { (window.__resultShapes ??= []).push(change); }}
            onUndo={() => { record({ type: 'undo' }); setStage({ stage: 'undone' }); }}
            onExpire={() => close('expire')}
            onAction={onAction}
            onDismiss={() => close('dismiss')} />}
        </AnimatePresence>
      </div>
    </div>
    <div className="result-demo-bar">
      <output aria-live="polite">{describe(events[events.length - 1])}</output>
      <button type="button" onClick={() => start(true)}>Rejouer</button>
      <button type="button" onClick={() => { setOpen(true); setStage({ stage: 'working', indicator }); }}>Travail</button>
      <button type="button" onClick={() => { setOpen(true); setStage(latest.current()); }}>{failing ? 'Erreur' : 'Coche + Annuler'}</button>
      {failing ? <label>Code<select value={kind} onChange={event => { const next = errorCodeOf(event.target.value); setKind(next); if (stage.stage === 'error') setStage({ stage: 'error', error: next, serverId, model: next === 'model_not_found' ? 'gemma-4-12b' : undefined }); }}>
        {errorCodes.map(code => <option key={code} value={code}>{code} · {familyLabel[errorFamily(code)]}</option>)}
      </select></label> : <>
        <label><input type="checkbox" checked={after.check} onChange={event => setAfter({ ...after, check: event.target.checked })} />Coche</label>
        <label><input type="checkbox" checked={after.undo} onChange={event => setAfter({ ...after, undo: event.target.checked })} />Annuler</label>
        <label>Durée<input type="number" min={2} max={20} value={after.undoSeconds} onChange={event => setAfter({ ...after, undoSeconds: Math.min(20, Math.max(2, Number(event.target.value) || 8)) })} /> s</label>
      </>}
    </div>
  </>;
}

// What the halo will mark after each action (fictitious text of design-lab/src/data.js:22-49).
const samples: Array<{ action: string; label: string; before: string; after: string }> = [
  { action: 'correct', label: 'Corriger', before: 'Hi Claire, thanks for you notes on the draft, I has read them all yesterday evening.', after: 'Hi Claire, thanks for your notes on the draft; I read them all yesterday evening.' },
  { action: 'correct', label: 'Corriger', before: 'The appendix will follow on monday, we still waiting for the final numbers from finance and i dont want to send something wrong.', after: 'The appendix will follow on Monday; we are still waiting for the final numbers from finance, and I don’t want to send anything wrong.' },
  { action: 'professionalize', label: 'Rendre professionnel', before: 'The appendix will follow on monday, we still waiting for the final numbers from finance and i dont want to send something wrong.', after: 'The appendix will follow on Monday. We are still awaiting the final figures from Finance and would prefer not to share anything inaccurate.' },
  { action: 'shorten', label: 'Raccourcir', before: 'Hi Claire, thanks for you notes on the draft, I has read them all yesterday evening.', after: 'Hi Claire, thanks for your notes — I read them all last night.' },
  { action: 'translate', label: 'Traduire', before: 'Hi Claire, thanks for you notes on the draft, I has read them all yesterday evening.', after: 'Bonjour Claire, merci pour tes remarques sur le brouillon ; je les ai toutes lues hier soir.' },
  { action: 'email', label: 'Rédiger un mail', before: 'The appendix will follow on monday, we still waiting for the final numbers from finance and i dont want to send something wrong.', after: 'Hi team,\n\nA quick heads-up: the appendix will follow on Monday. We are still waiting for the final numbers from finance, and I would rather not send anything inaccurate.\n\nThanks for your patience,\nLucas' },
  { action: 'instruction', label: 'Consigne libre', before: 'Hi Claire, thanks for you notes on the draft, I has read them all yesterday evening.', after: 'Hey Claire! Thanks a lot for the notes on the draft — I went through every one of them last night.' },
  { action: 'formal', label: 'Action créée (auto)', before: 'Please send the report before Friday so we can review it.', after: 'Please send the final report before Friday so we can review it.' },
];

function Marked({ text, ranges, leaving }: { text: string; ranges: ChangedRanges['ranges']; leaving: boolean }) {
  const parts: Array<string | { mark: string }> = [];
  let at = 0;
  for (const range of ranges) {
    if (range.start > at) parts.push(text.slice(at, range.start));
    parts.push({ mark: text.slice(range.start, range.end) });
    at = range.end;
  }
  if (at < text.length) parts.push(text.slice(at));
  return <p className="result-demo-marked">{parts.map((part, i) => typeof part === 'string' ? part : <mark key={i} className={leaving ? 'is-leaving' : undefined}>{part.mark}</mark>)}</p>;
}

function DiffFixture() {
  const [run, setRun] = useState(0);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    setLeaving(false);
    const timer = window.setTimeout(() => setLeaving(true), 8000);
    return () => window.clearTimeout(timer);
  }, [run]);
  const style = { '--chg': changedHighlight.color, '--chg-in': `${changedHighlight.in.ms}ms`, '--chg-out': `${changedHighlight.out.ms}ms` } as CSSProperties;
  return <div className="result-diff" style={style}>
    <div className="result-diff-head"><strong>Mots changés : ce que le halo marquera</strong><button type="button" onClick={() => setRun(run + 1)}>Rejouer (8 s puis fondu)</button></div>
    {samples.map((sample, index) => {
      const result = changedRanges(sample.before, sample.after, { actionId: sample.action });
      return <section key={`${run}-${index}`} className="result-diff-card" data-mode={result.mode}>
        <h3>{sample.label} <small>{sample.action} · {result.mode === 'words' ? 'mot à mot' : result.mode === 'block' ? 'bloc entier' : 'rien'} · {result.ranges.length} plage{result.ranges.length > 1 ? 's' : ''}</small></h3>
        <Marked text={sample.after} ranges={result.ranges} leaving={leaving} />
      </section>;
    })}
  </div>;
}
