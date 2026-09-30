// The connection form, shared by the setup (question « Votre modèle ») and Réglages › Serveur
// (docs/DESIGN-REGLAGES.md, « Connexion »). Baseline built with the shell; owner afterwards:
// the Réglages agent (the Parcours agent imports it, and asks rather than forks).
//
//   <Connection value={{ url, key, noKey, model }} onChange={next => …} onOpenLog={probeId => …} layout="setup" | "settings" />
//
// - the address is normalised live (never « /v1 » for the user); a discreet line says what will be used;
// - without a key the model list stays disabled: « Renseignez d'abord la clé API » (unless « Mon serveur n'a pas de clé »);
// - automatic check 600 ms after the last keystroke, then « Vérifier à nouveau »;
// - live trace: Adresse → Connexion → Clé → Modèles, each with its time;
// - the model list is filled from GET /v1/models (mock), searchable (cmdk).
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, X, Minus, RotateCw, ScrollText } from 'lucide-react';
import { Field, Input, SecretInput, Combobox, Button, Spinner, useFieldId, ICON } from '../ui/index.jsx';
import { normalizeEndpoint, probe, modelOptions, subscribeScenario, getScenario } from '../mock/server.js';
import { useTx } from '../lib/motion.js';
import './connection.css';

export function useProbe({ url, apiKey, noKey, auto = true }) {
  const [state, setState] = useState({ status: 'idle', steps: [], models: [], error: null, probeId: null });
  const ctrl = useRef(null);
  const run = async () => {
    ctrl.current?.abort();
    const c = new AbortController(); ctrl.current = c;
    setState(s => ({ ...s, status: 'running', error: null }));
    try {
      const r = await probe({ url, key: apiKey, noKey, signal: c.signal, onStep: steps => { if (!c.signal.aborted) setState(s => ({ ...s, steps })); } });
      if (c.signal.aborted) return;
      setState({ status: r.ok ? 'ok' : 'error', steps: r.steps, models: r.models, error: r.error || null, probeId: r.probeId || null });
    } catch (e) { if (e?.name !== 'AbortError') setState(s => ({ ...s, status: 'error', error: { title: 'Erreur inattendue', fix: String(e) } })); }
  };
  // auto-check 600 ms after the last change, when there is something to check
  const endpoint = useMemo(() => normalizeEndpoint(url), [url]);
  const ready = endpoint.ok && (!!apiKey.trim() || noKey);
  useEffect(() => {
    if (!auto) return undefined;
    if (!ready) { ctrl.current?.abort(); setState({ status: 'idle', steps: [], models: [], error: null, probeId: null }); return undefined; }
    const id = setTimeout(run, 600);
    return () => clearTimeout(id);
  }, [url, apiKey, noKey, ready, auto]); // eslint-disable-line react-hooks/exhaustive-deps
  // re-run when the toolbar scenario changes
  useEffect(() => subscribeScenario(() => { if (ready && auto) run(); }), [ready, auto, url, apiKey, noKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => ctrl.current?.abort(), []);
  return { ...state, endpoint, ready, run };
}

const STEP_ICON = {
  ok: <Check size={14} strokeWidth={2.25} />,
  error: <X size={14} strokeWidth={2.25} />,
  skipped: <Minus size={14} strokeWidth={2} />,
};

// The live trace. On a failure, the fix and its actions sit right under the failed step (one
// place for the error: the step says what failed, the line under it what to do).
export function ProbeTrace({ steps, fix, actions }) {
  const tx = useTx();
  return (
    <ol className="ft-trace" aria-label="Vérification de la connexion" aria-live="polite">
      {steps.map((s, i) => (
        <motion.li key={s.id} className="ft-trace-step" data-state={s.state}
          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={tx('smooth', { delay: i * 0.04 })}>
          <span className="ft-trace-row">
            <span className="ft-trace-icon" aria-hidden="true">
              {s.state === 'running' ? <Spinner size={14} /> : STEP_ICON[s.state] || <i />}
            </span>
            <span className="ft-trace-name">{s.name}</span>
            <span className="ft-trace-detail">{s.state === 'running' ? 'en cours…' : s.state === 'skipped' ? 'non testé' : s.detail || ''}</span>
            <span className="ft-trace-ms">{s.ms != null && s.state !== 'waiting' ? `${s.ms.toLocaleString('fr-FR')} ms` : ''}</span>
          </span>
          {s.state === 'error' && (fix || actions) && (
            <motion.span className="ft-trace-fix" role="alert" initial={{ opacity: 0, y: -2 }} animate={{ opacity: 1, y: 0 }} transition={tx('smooth')}>
              {fix && <span>{fix}</span>}
              {actions && <span className="ft-trace-actions">{actions}</span>}
            </motion.span>
          )}
        </motion.li>
      ))}
    </ol>
  );
}

export function Connection({ value, onChange, onOpenLog, layout = 'settings', probe: external }) {
  const urlId = useFieldId('url');
  const keyId = useFieldId('key');
  const modelId = useFieldId('model');
  const { url = '', key = '', noKey = false, model = '' } = value;
  const set = patch => onChange({ ...value, ...patch });
  // `probe`: an external useProbe() result (Réglages keeps one per server, so the collapsed card
  // and this form share one check and the log gets no duplicates). Absent: the form runs its own.
  const own = useProbe({ url, apiKey: key, noKey, auto: !external });
  const p = external || own;
  const tx = useTx();
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
      <Field label="Adresse du serveur" htmlFor={urlId} hint={urlHint} problem={urlProblem}>
        <Input id={urlId} value={url} placeholder="https://llm.exemple.com" inputMode="url" onChange={e => set({ url: e.target.value })} />
      </Field>
      <Field label="Clé API" htmlFor={keyId}
        aside={<button type="button" className="ft-linklike" aria-pressed={noKey} onClick={() => set({ noKey: !noKey, key: noKey ? key : '' })}>{noKey ? 'Mon serveur a une clé' : 'Mon serveur n’a pas de clé'}</button>}
        hint={noKey ? 'Aucune clé ne sera envoyée (serveur local).' : 'Gardée par Windows, jamais écrite dans le journal.'}>
        <SecretInput id={keyId} value={key} onChange={v => set({ key: v })} placeholder={noKey ? 'Aucune clé' : 'sk-…'} disabled={noKey} note={key ? 'Protégée par Windows' : undefined} />
      </Field>

      <AnimatePresence initial={false}>
        {p.steps.length > 0 && (
          <motion.div className="ft-connection-check" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={tx('smooth')}>
            <ProbeTrace steps={p.steps} fix={p.status === 'error' ? p.error?.fix : null}
              actions={p.status === 'error' && p.error ? (
                <>
                  <Button size="sm" variant="secondary" icon={<RotateCw {...ICON} size={14} />} onClick={p.run}>Vérifier à nouveau</Button>
                  {onOpenLog && <Button size="sm" variant="ghost" icon={<ScrollText {...ICON} size={14} />} onClick={() => onOpenLog(p.error)}>Voir le journal</Button>}
                </>
              ) : null} />
          </motion.div>
        )}
      </AnimatePresence>

      <Field label="Modèle" htmlFor={modelId} hint={modelHint}
        aside={p.status === 'ok' ? <button type="button" className="ft-linklike" onClick={p.run}>Vérifier à nouveau</button> : null}>
        <Combobox id={modelId} label="Modèle" value={model} options={options} onChange={v => set({ model: v })} disabled={modelDisabled}
          loading={p.status === 'running'} placeholder={keyMissing ? 'Renseignez d’abord la clé API' : 'Choisir un modèle'} searchPlaceholder="Rechercher un modèle" empty="Aucun modèle ne correspond" />
      </Field>
    </div>
  );
}

export { getScenario };
