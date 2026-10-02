// The connection form and its live check, shared by the setup (question « Votre modèle ») and
// Réglages › Serveur. Owner: the Réglages agent (the Parcours agent imports it).
//
//   <Connection value={{ url, key, noKey, model }} onChange={next => …} onOpenLog={err => …} probe={useProbe(…)} check={true} />
//   <ConnectionCheck probe={p} model={id} onOpenLog={…} />     the check alone (line + trace)
//   useCheck(p) + <CheckLine> + <CheckTrace>                    the same, split (Réglages › Serveur card)
//   <ProbeTrace steps fix actions cause />                       the bare trace (4 steps, « balayage »)
//   <InsecureNotice endpoint={p.endpoint} />                     « Connexion non chiffrée » for http:// hosts
//
// The check (Lucas, 30/09): the trace is visible while it checks — the 4 steps are there from the
// start, dimmed, a light sweeps the running one (« balayage »), each lights up with its time when
// done. Once connected it holds a moment, then COLLAPSES into one line
//   ● Connecté · gemma-4-12B-it-qat · 162 ms     Détails ▾
// (users just want to know whether it is connected; « Détails » unfolds the trace again). On an
// error it stays open on the failing step: what failed, the cause, what to do, « Voir le journal ».
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, Minus, RotateCw, ScrollText, ChevronDown } from 'lucide-react';
import { Field, Input, SecretInput, Combobox, Button, Notice, StatusDot, useFieldId, ICON } from '../ui/index.jsx';
import { normalizeEndpoint, probe, modelOptions, subscribeScenario, getScenario, UNENCRYPTED_WARNING } from '../mock/server.js';
import { useTx, ms } from '../lib/motion.js';
import { useLab } from '../lab/store.jsx';
import './connection.css';

export function useProbe({ url, apiKey, noKey, auto = true }) {
  const [state, setState] = useState({ status: 'idle', steps: [], models: [], error: null, probeId: null, at: 0 });
  const ctrl = useRef(null);
  const timer = useRef(0);
  const args = useRef({ url, apiKey, noKey });
  args.current = { url, apiKey, noKey };
  const run = async () => {
    ctrl.current?.abort();
    const c = new AbortController(); ctrl.current = c;
    const { url: u, apiKey: k, noKey: nk } = args.current;
    clearTimeout(timer.current);
    // Keep the trace's rows (reset to « waiting ») until the probe's first step arrives: the trace
    // never collapses and reopens under the user's cursor on « Vérifier à nouveau ».
    setState(s => ({ ...s, status: 'running', steps: s.steps.map(st => ({ id: st.id, name: st.name, state: 'waiting' })), error: null, at: Date.now() }));
    try {
      const r = await probe({ url: u, key: k, noKey: nk, signal: c.signal, onStep: steps => { if (!c.signal.aborted) setState(s => ({ ...s, steps })); } });
      if (c.signal.aborted) return;
      setState(s => ({ ...s, status: r.ok ? 'ok' : 'error', steps: r.steps, models: r.models, error: r.error || null, probeId: r.probeId || null }));
    } catch (e) { if (e?.name !== 'AbortError' && !c.signal.aborted) setState(s => ({ ...s, status: 'error', error: { title: 'Erreur inattendue', fix: String(e) } })); }
  };
  // auto-check 600 ms after the last change, when there is something to check
  const endpoint = normalizeEndpoint(url);
  const ready = endpoint.ok && (!!String(apiKey || '').trim() || noKey);
  useEffect(() => {
    if (!auto) return undefined;
    if (!ready) { ctrl.current?.abort(); setState({ status: 'idle', steps: [], models: [], error: null, probeId: null, at: 0 }); return undefined; }
    timer.current = setTimeout(run, 600);
    return () => clearTimeout(timer.current);
  }, [url, apiKey, noKey, ready, auto]); // eslint-disable-line react-hooks/exhaustive-deps
  // re-run when the toolbar scenario changes (the running check is aborted first, and run() drops
  // a pending auto-check: no duplicate in the log, even when the saved scenario is restored on mount)
  useEffect(() => subscribeScenario(() => { if (ready && auto) run(); }), [ready, auto]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => ctrl.current?.abort(), []);
  return { ...state, endpoint, ready, run };
}

// A check mark drawn once (stroke-dashoffset), like the « balayage » of the Effets section.
function CheckDraw() {
  return <svg className="ft-trace-check" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.6 6.3l2.2 2.2L9.4 3.6" /></svg>;
}
const STEP_TEXT = { running: 'en cours…', skipped: 'non testé', waiting: '' };

// The live trace, « balayage ». On a failure, the cause, the fix and the actions sit right under
// the failed step (one place for the error).
export function ProbeTrace({ steps, fix, actions, cause }) {
  const tx = useTx();
  return (
    <ol className="ft-trace" aria-label="Vérification de la connexion" aria-live="polite">
      {steps.map(s => (
        <li key={s.id} className="ft-trace-step" data-state={s.state}>
          <span className="ft-trace-row">
            <span className="ft-trace-icon" aria-hidden="true">
              {s.state === 'ok' ? <CheckDraw /> : s.state === 'error' ? <X size={12} strokeWidth={2.5} /> : s.state === 'skipped' ? <Minus size={12} strokeWidth={2} /> : s.state === 'running' ? <span className="ft-trace-spin" /> : <i />}
            </span>
            <span className="ft-trace-name">{s.name}</span>
            <span className="ft-trace-detail">{STEP_TEXT[s.state] ?? s.detail ?? ''}</span>
            <span className="ft-trace-ms">{s.ms != null && (s.state === 'ok' || s.state === 'error') ? `${s.ms.toLocaleString('fr-FR')} ms` : ''}</span>
          </span>
          {s.state === 'error' && (fix || actions || cause) && (
            <motion.span className="ft-trace-fix" role="alert" initial={{ opacity: 0, y: -2 }} animate={{ opacity: 1, y: 0 }} transition={tx('smooth')}>
              {fix && <span className="ft-trace-fix-text">{fix}</span>}
              {cause && <code className="ft-trace-cause">{cause}</code>}
              {actions && <span className="ft-trace-actions">{actions}</span>}
            </motion.span>
          )}
        </li>
      ))}
    </ol>
  );
}

const shortModel = id => (id ? modelOptions([{ id, context: 0 }])[0].label : null);
const totalMs = steps => steps.reduce((n, st) => n + (st.state === 'ok' && st.ms ? st.ms : 0), 0);

// Open / collapsed state of the check. While it runs and on an error: open. Connected: open a
// moment (the last step lights up), then collapsed, unless the user unfolded « Détails ».
export function useCheck(p) {
  const [manual, setManual] = useState(null);
  const [settled, setSettled] = useState(p.status === 'ok');
  useEffect(() => {
    if (p.status === 'ok') { const id = setTimeout(() => setSettled(true), ms(900)); return () => clearTimeout(id); }
    setSettled(false);
    if (p.status === 'running') setManual(null);
    return undefined;
  }, [p.status, p.at]);
  const collapsible = p.status === 'ok' && settled;
  const open = p.steps.length > 0 && (p.status !== 'ok' || !settled || manual === true) && p.status !== 'idle';
  return { open, collapsible, toggle: () => setManual(m => !m), details: manual === true };
}

// The one-line status: « ● Connecté · model · 162 ms   Détails ▾ ».
export function CheckLine({ p, model, check, className }) {
  const running = p.steps.find(s => s.state === 'running');
  let state = 'idle', parts;
  if (p.status === 'running') { state = 'running'; parts = [running ? `Vérification · ${running.name.toLowerCase()}…` : 'Vérification…']; }
  else if (p.status === 'ok') { state = 'ok'; parts = ['Connecté', shortModel(model) || `${p.models.length} modèles`, `${totalMs(p.steps).toLocaleString('fr-FR')} ms`]; }
  else if (p.status === 'error') {
    // The open trace already says what failed (its row) and what to do: the line only names the step.
    const failed = p.steps.find(s => s.state === 'error');
    state = 'error'; parts = [failed ? `Échec · ${failed.name}` : (p.error?.title || 'Échec de connexion')];
  }
  else if (!p.endpoint?.ok) parts = ['Adresse à renseigner'];
  else if (!p.ready) { state = 'warn'; parts = ['Clé API à renseigner']; }
  else parts = ['Non vérifié'];
  return (
    <span className={`ft-check-line ${className || ''}`} data-state={state}>
      <StatusDot state={state}>
        {parts.map((t, i) => <span key={i} className="ft-check-part" data-i={i}>{i > 0 && <span className="ft-check-sep" aria-hidden="true">·</span>}{t}</span>)}
      </StatusDot>
      {check?.collapsible && (
        <button type="button" className="ft-check-toggle" aria-expanded={check.open} onClick={check.toggle}>
          Détails<ChevronDown size={14} strokeWidth={1.75} aria-hidden="true" />
        </button>
      )}
    </span>
  );
}

// The trace under the line, with its disclosure (height + opacity on a small subtree).
export function CheckTrace({ p, check, onOpenLog, className }) {
  const tx = useTx();
  const { reduced } = useLab();
  const err = p.status === 'error' ? p.error : null;
  // « Vérifier à nouveau » restarts the check: the error block under the failed step goes away.
  // Hold the trace at its height until the check ends, so nothing slides under the pointer (a
  // double click never lands on what was below).
  const inner = useRef(null);
  const lastH = useRef(0);
  useLayoutEffect(() => { if (p.status !== 'running') lastH.current = inner.current?.offsetHeight || 0; });
  return (
    <AnimatePresence initial={false}>
      {check.open && (
        <motion.div key="trace" className={`ft-check-trace ${className || ''}`}
          initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0, transition: tx({ duration: 0.26, ease: 'out' }) }} transition={tx('smooth')}>
          <div ref={inner} className="ft-check-trace-inner" style={p.status === 'running' && lastH.current ? { minHeight: lastH.current } : undefined}>
            <ProbeTrace steps={p.steps} fix={err?.fix} cause={err?.cause}
              actions={err ? (
                <>
                  <Button size="sm" icon={<RotateCw {...ICON} size={14} />} onClick={p.run}>Vérifier à nouveau</Button>
                  {onOpenLog && <Button size="sm" variant="ghost" icon={<ScrollText {...ICON} size={14} />} onClick={() => onOpenLog(err)}>Voir le journal</Button>}
                </>
              ) : null} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Line + trace, stacked: for the setup or anywhere the check stands alone.
export function ConnectionCheck({ probe: p, model, onOpenLog, className }) {
  const check = useCheck(p);
  if (p.status === 'idle' && !p.steps.length) return null;
  return (
    <div className={`ft-check ${className || ''}`} data-state={p.status}>
      <CheckLine p={p} model={model} check={check} />
      <CheckTrace p={p} check={check} onOpenLog={onOpenLog} />
    </div>
  );
}

// http:// to another machine: said once, clearly, under the address.
export function InsecureNotice({ endpoint }) {
  const tx = useTx();
  return (
    <AnimatePresence initial={false}>
      {endpoint?.ok && endpoint.insecure && (
        <motion.div key="insecure" className="ft-insecure" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={tx('smooth')}>
          <Notice kind="warn" {...UNENCRYPTED_WARNING} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// check: show the live check inside the form (false when the parent shows it, like the Serveur card).
export function Connection({ value, onChange, onOpenLog, layout = 'settings', probe: external, check = true }) {
  const urlId = useFieldId('url');
  const keyId = useFieldId('key');
  const modelId = useFieldId('model');
  const { url = '', key = '', noKey = false, model = '' } = value;
  const set = patch => onChange({ ...value, ...patch });
  // `probe`: an external useProbe() result (Réglages keeps one per server, so the collapsed card
  // and this form share one check and the log gets no duplicates). Absent: the form runs its own.
  const own = useProbe({ url, apiKey: key, noKey, auto: !external });
  const p = external || own;
  const options = modelOptions(p.models);

  // keep the chosen model; pick the first one when none is chosen yet
  useEffect(() => {
    if (p.status === 'ok' && p.models.length && !p.models.some(m => m.id === model)) set({ model: p.models[0].id });
  }, [p.status, p.models]); // eslint-disable-line react-hooks/exhaustive-deps

  const endpoint = p.endpoint;
  // Same wording as the setup: the user only ever sees the address, never « /v1 » (Lucas, 29/09).
  const removed = endpoint.ok ? endpoint.notes.find(n => n.startsWith('/') && n.endsWith(' retiré'))?.slice(0, -' retiré'.length) : null;
  const urlHint = !url.trim()
    ? 'Juste l’adresse, sans /v1 : on s’en occupe.'
    : endpoint.ok ? <>Adresse retenue : <b>{endpoint.display}</b>{removed && <> · « {removed} » retiré, inutile ici</>}</> : null;
  const urlProblem = url.trim() && !endpoint.ok ? `${endpoint.error.title}. ${endpoint.error.fix}` : null;
  const keyMissing = endpoint.ok && !key.trim() && !noKey;
  const modelDisabled = p.status !== 'ok';
  const modelHint = keyMissing ? 'Renseignez d’abord la clé API.' : p.status === 'running' ? 'Lecture de la liste sur le serveur…' : p.status === 'error' ? 'Liste indisponible tant que la connexion échoue.' : p.status === 'ok' ? `${p.models.length} modèles lus sur le serveur.` : 'La liste se remplit toute seule depuis le serveur.';

  return (
    <div className="ft-connection" data-layout={layout}>
      <div className="ft-connection-url">
        <Field label="Adresse du serveur" htmlFor={urlId} hint={urlHint} problem={urlProblem}>
          <Input id={urlId} value={url} placeholder="https://llm.exemple.com" inputMode="url" onChange={e => set({ url: e.target.value })} />
        </Field>
        <InsecureNotice endpoint={endpoint} />
      </div>
      <Field label="Clé API" htmlFor={keyId}
        aside={<button type="button" className="ft-linklike" aria-pressed={noKey} onClick={() => set({ noKey: !noKey, key: noKey ? key : '' })}>{noKey ? 'Mon serveur a une clé' : 'Mon serveur n’a pas de clé'}</button>}
        hint={noKey ? 'Aucune clé ne sera envoyée.' : key ? null : 'Gardée par Windows, jamais écrite dans le journal.'}>
        <SecretInput id={keyId} value={key} onChange={v => set({ key: v })} placeholder={noKey ? 'Aucune clé' : 'sk-…'} disabled={noKey}
          note={key ? 'Protégée par Windows : chiffrée pour votre compte, jamais écrite dans le journal.' : undefined} />
      </Field>

      {check && <ConnectionCheck probe={p} model={model} onOpenLog={onOpenLog} />}

      <Field label="Modèle" htmlFor={modelId} hint={modelHint}>
        <Combobox id={modelId} label="Modèle" value={model} options={options} onChange={v => set({ model: v })} disabled={modelDisabled}
          loading={p.status === 'running'} placeholder={keyMissing ? 'Renseignez d’abord la clé API' : 'Choisir un modèle'} searchPlaceholder="Rechercher un modèle" empty="Aucun modèle ne correspond" />
      </Field>
    </div>
  );
}

export { getScenario };
