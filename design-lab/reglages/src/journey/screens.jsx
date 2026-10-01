// The screens of the setup window, one question per screen (iPhone first start). Each screen is
// a body only: SetupWindow draws the header (icon, title, subtitle), the nav and the big button.
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { Check, MessageSquareText, Keyboard as KeyboardIcon, MousePointer2, TextCursorInput, Wand2, X } from 'lucide-react';
import { Scope } from '../lab/Scope.jsx';
import { Button, KeyCombo, Keycap, Select, Segmented, Spinner, ICON } from '../ui/index.jsx';
import { Connection, useProbe } from '../connection/Connection.jsx';
import { modelOptions, tryModel, diagnostics, STEP_NAMES } from '../mock/server.js';
import { useTx, wait } from '../lib/motion.js';
import { ACTIONS, appName, defaultShortcut } from '../brand.js';

// ——— (2) Apparence ———
const LOOKS = [
  { id: 'system', label: 'Système', hint: 'Suit Windows' },
  { id: 'light', label: 'Clair', hint: 'Toujours clair' },
  { id: 'dark', label: 'Sombre', hint: 'Toujours sombre' },
];
function MiniApp() {
  // A tiny Réglages window with the Îlot beside a selected line: the look at a glance.
  return (
    <span className="jr-mini">
      <span className="jr-mini-side"><i /><i /><i /><i /></span>
      <span className="jr-mini-main">
        <b />
        <span className="jr-mini-line"><em /><s /></span>
        <span className="jr-mini-line short"><em /></span>
        <span className="jr-mini-ilot"><i /><i /><i /><i /></span>
      </span>
    </span>
  );
}
export function LookScreen({ value, onChange }) {
  return (
    <div className="jr-body-center">
      <ToggleGroup.Root type="single" className="jr-looks" aria-label="Apparence de l’application" value={value} onValueChange={v => { if (v) onChange(v); }}>
        {LOOKS.map(l => (
          <ToggleGroup.Item key={l.id} value={l.id} className="jr-look" aria-label={l.label}>
            <span className="jr-look-thumb">
              {l.id === 'system' ? (
                <>
                  <Scope theme="light" portal={false} className="jr-look-scope"><MiniApp /></Scope>
                  <Scope theme="dark" portal={false} className="jr-look-scope jr-look-half"><MiniApp /></Scope>
                </>
              ) : (
                <Scope theme={l.id} portal={false} className="jr-look-scope"><MiniApp /></Scope>
              )}
              <span className="jr-check" aria-hidden="true"><Check size={12} strokeWidth={2.75} /></span>
            </span>
            <span className="jr-look-label">{l.label}{l.hint && <small>{l.hint}</small>}</span>
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
      <p className="jr-note">Le changement est immédiat. Les autres applications ne bougent pas.</p>
    </div>
  );
}

// ——— (3) Raccourci & menu ———
const MODS = { Control: 'Ctrl', Alt: 'Alt', Shift: 'Maj', Meta: 'Win', AltGraph: 'Alt' };
const CODE_NAMES = { Space: 'Espace', Enter: 'Entrée', Tab: 'Tab', Backspace: 'Retour arrière', Delete: 'Suppr', Insert: 'Inser', Home: 'Début', End: 'Fin', PageUp: 'Pg préc', PageDown: 'Pg suiv', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Backquote: '²' };
function keyName(e) {
  if (MODS[e.key]) return null;
  if (CODE_NAMES[e.code]) return CODE_NAMES[e.code];
  if (/^F\d{1,2}$/.test(e.key)) return e.key;
  if (e.key && e.key.length === 1 && /[\p{L}\p{N}]/u.test(e.key) && !e.altKey) return e.key.toUpperCase();
  const m = /^(Key|Digit|Numpad)(.+)$/.exec(e.code || '');
  if (m) return m[2];
  return e.key?.length === 1 ? e.key.toUpperCase() : e.key || null;
}
const TAKEN = {
  'Ctrl+C': 'Copier', 'Ctrl+V': 'Coller', 'Ctrl+X': 'Couper', 'Ctrl+Z': 'Annuler', 'Ctrl+Y': 'Rétablir', 'Ctrl+A': 'Tout sélectionner',
  'Ctrl+S': 'Enregistrer', 'Ctrl+P': 'Imprimer', 'Ctrl+F': 'Rechercher', 'Alt+F4': 'Fermer la fenêtre', 'Alt+Tab': 'Changer de fenêtre',
  'Win+L': 'Verrouiller', 'Win+D': 'Bureau', 'Win+E': 'Explorateur', 'Win+V': 'Historique du presse-papiers', 'Ctrl+Alt+Suppr': 'Sécurité Windows',
};
const same = (a, b) => a.length === b.length && a.every((k, i) => k === b[i]);

function ShortcutRecorder({ value, onChange, onRecording }) {
  const [rec, setRec] = useState(false);
  const [held, setHeld] = useState([]);
  const [problem, setProblem] = useState(null);
  const sim = useRef(null);
  const changeBtn = useRef(null);
  const tx = useTx();
  useEffect(() => { onRecording?.(rec); }, [rec, onRecording]);
  const stop = (combo) => {
    sim.current?.abort();
    setRec(false); setHeld([]);
    if (combo) { onChange(combo); setProblem(null); }
    requestAnimationFrame(() => changeBtn.current?.focus({ preventScroll: true }));
  };
  useEffect(() => {
    if (!rec) return undefined;
    const mods = e => [e.ctrlKey && 'Ctrl', (e.altKey || e.key === 'AltGraph') && 'Alt', e.shiftKey && 'Maj', e.metaKey && 'Win'].filter(Boolean);
    const down = e => {
      e.preventDefault(); e.stopPropagation();
      if (e.key === 'Escape' && !e.ctrlKey && !e.altKey && !e.metaKey) { setProblem(null); stop(null); return; }
      const m = mods(e);
      const k = keyName(e);
      if (!k) { setHeld(m); return; }
      const combo = [...m, k];
      setHeld(combo);
      if (!m.some(x => x !== 'Maj')) { setProblem('Ajoutez Ctrl, Alt ou Win : seule, cette touche servirait aussi à écrire.'); return; }
      const taken = TAKEN[combo.join('+')];
      if (taken) { setProblem(`${combo.join(' + ')} est déjà pris par Windows (${taken}). Essayez une autre combinaison.`); return; }
      stop(combo);
    };
    const up = e => { e.preventDefault(); setHeld(h => (h.length && !MODS[h[h.length - 1]] && keyName(e) === h[h.length - 1] ? h : mods(e))); };
    window.addEventListener('keydown', down, true);
    window.addEventListener('keyup', up, true);
    return () => { window.removeEventListener('keydown', down, true); window.removeEventListener('keyup', up, true); };
  }, [rec]); // eslint-disable-line react-hooks/exhaustive-deps

  // For a touch screen (or to watch it): types Ctrl, Maj, T, one key at a time.
  const simulate = async () => {
    const c = new AbortController(); sim.current = c;
    const seq = ['Ctrl', 'Maj', 'T'];
    for (let n = 1; n <= seq.length; n++) { if (!(await wait(380, c.signal))) return; setHeld(seq.slice(0, n)); }
    if (await wait(520, c.signal)) stop(seq);
  };
  const isDefault = same(value, defaultShortcut);
  return (
    <div className="jr-rec" data-recording={rec ? '' : undefined}>
      <div className="jr-rec-keys" aria-live="polite">
        <AnimatePresence mode="popLayout" initial={false}>
          {rec ? (
            <motion.div key="rec" className="jr-rec-live" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={tx('snappy')}>
              {held.length ? <KeyCombo keys={held} active={true} size="xl" /> : <span className="jr-rec-wait">Appuyez sur la nouvelle combinaison…</span>}
            </motion.div>
          ) : (
            <motion.div key={value.join('+')} className="jr-rec-live" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={tx('snappy')}>
              <KeyCombo keys={value} size="xl" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="jr-rec-actions">
        {rec ? (
          <>
            <Button size="sm" onClick={() => stop(null)} icon={<X {...ICON} size={14} />}>Annuler</Button>
            <Button size="sm" variant="ghost" onClick={simulate}>Simuler une saisie</Button>
          </>
        ) : (
          <>
            <Button ref={changeBtn} size="sm" onClick={() => { setProblem(null); setHeld([]); setRec(true); }} icon={<KeyboardIcon {...ICON} size={14} />}>Changer</Button>
            {!isDefault && <Button size="sm" variant="ghost" onClick={() => onChange([...defaultShortcut])}>Rétablir {defaultShortcut.join(' + ')}</Button>}
          </>
        )}
      </div>
      <p className={`jr-rec-note ${problem ? 'is-problem' : ''}`} role={problem ? 'alert' : undefined}>
        {problem || (rec ? 'Échap pour annuler.' : 'Sélectionnez du texte n’importe où, puis appuyez sur ces touches.')}
      </p>
    </div>
  );
}

function IlotSketch() {
  return (
    <span className="jr-sk jr-sk-ilot" aria-hidden="true">
      <span className="jr-sk-text"><em>Bonjour, je vous envoie</em> le devis</span>
      <span className="jr-sk-menu">{['F', 'T', 'P', 'S', 'E'].map(k => <i key={k}>{k}</i>)}</span>
    </span>
  );
}
function DirectSketch({ action }) {
  return (
    <span className="jr-sk jr-sk-direct" aria-hidden="true">
      <span className="jr-sk-text"><em>Bonjour, je vous envoie</em> le devis</span>
      <span className="jr-sk-pill"><Wand2 size={12} strokeWidth={1.75} />{action}</span>
    </span>
  );
}
export function ShortcutScreen({ value, onChange, onRecording }) {
  const tx = useTx();
  const actionOptions = ACTIONS.filter(a => a.id !== 'consigne').map(a => ({ value: a.id, label: a.label }));
  const action = ACTIONS.find(a => a.id === value.directAction)?.label || 'Corriger';
  return (
    <div className="jr-body-stack">
      <ShortcutRecorder value={value.shortcut} onChange={shortcut => onChange({ shortcut })} onRecording={onRecording} />
      <div className="jr-q">
        <div className="jr-q-head">
          <span className="jr-q-label" id="jr-mode-label">Quand vous appuyez sur ces touches</span>
          <AnimatePresence initial={false}>
            {value.mode === 'direct' && (
              <motion.span className="jr-direct" initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 6 }} transition={tx('smooth')}>
                <Select label="Action lancée par le raccourci" value={value.directAction} onChange={v => onChange({ directAction: v })} options={actionOptions} width={168} />
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <ToggleGroup.Root type="single" className="jr-cards" aria-labelledby="jr-mode-label" value={value.mode} onValueChange={v => { if (v) onChange({ mode: v }); }}>
          <ToggleGroup.Item value="menu" className="jr-card">
            <IlotSketch />
            <span className="jr-card-copy"><strong>Ouvrir le menu</strong><small>Vous choisissez l’action à chaque fois.</small></span>
            <span className="jr-check" aria-hidden="true"><Check size={12} strokeWidth={2.75} /></span>
          </ToggleGroup.Item>
          <ToggleGroup.Item value="direct" className="jr-card">
            <DirectSketch action={action} />
            <span className="jr-card-copy"><strong>Lancer directement une action</strong><small>Toujours la même, sans menu.</small></span>
            <span className="jr-check" aria-hidden="true"><Check size={12} strokeWidth={2.75} /></span>
          </ToggleGroup.Item>
        </ToggleGroup.Root>
      </div>
    </div>
  );
}

// ——— (4) Votre modèle ———
// The shared connection form (src/connection, owner: Réglages agent): imported, not forked. The
// setup keeps its own useProbe() and hands it over (`probe`), so it knows when « Continuer » can
// light up and which check the log should point at. Under it, one sentence to try the model.
export function ModelScreen({ value, onChange, onOpenLog, onStatus }) {
  const { url, key, noKey, model } = value;
  const p = useProbe({ url, apiKey: key, noKey });
  const [trial, setTrial] = useState({ state: 'idle' });
  const trialCtrl = useRef(null);
  const tx = useTx();

  useEffect(() => { onStatus?.(p.status === 'ok' && !!model); }, [p.status, model, onStatus]);
  useEffect(() => { trialCtrl.current?.abort(); setTrial({ state: 'idle' }); }, [url, key, noKey, model, p.status]);
  useEffect(() => () => { trialCtrl.current?.abort(); onStatus?.(false); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const tryIt = async () => {
    trialCtrl.current?.abort();
    const c = new AbortController(); trialCtrl.current = c;
    setTrial({ state: 'running' });
    try {
      const r = await tryModel({ url, model, signal: c.signal });
      if (!c.signal.aborted) setTrial({ state: 'ok', ...r });
    } catch { /* aborted */ }
  };

  return (
    <div className="jr-body-form">
      <Connection value={value} onChange={next => onChange(next)} probe={p} layout="setup"
        onOpenLog={() => onOpenLog?.(p.probeId)} />
      <AnimatePresence initial={false}>
        {p.status === 'ok' && model && (
          <motion.div key="trial" className="jr-trial-row" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={tx('smooth')}>
            <Button size="sm" variant="ghost" onClick={tryIt} busy={trial.state === 'running'} icon={<MessageSquareText {...ICON} size={14} />}>Essayer avec une phrase</Button>
            <span className="jr-trial" role="status" aria-live="polite">
              {trial.state === 'ok' && <><span className="jr-trial-bubble">{trial.reply}</span><span className="jr-trial-ms">{trial.ms.toLocaleString('fr-FR')} ms</span></>}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// The connection log, as a sheet inside the setup window (same data as Réglages › Diagnostic).
export function LogSheet({ onClose, probeId }) {
  const [rows, setRows] = useState(diagnostics.list());
  const [filter, setFilter] = useState('all');
  useEffect(() => diagnostics.subscribe(setRows), []);
  const shown = useMemo(() => rows.filter(r => filter === 'all' || r.level === 'error').slice(0, 40), [rows, filter]);
  return (
    <div className="jr-log">
      <div className="jr-log-head">
        <strong>Journal de connexion</strong>
        <Segmented label="Filtre du journal" size="sm" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Tout' }, { value: 'errors', label: 'Erreurs' }]} />
        <Button size="sm" onClick={onClose}>Fermer</Button>
      </div>
      <p className="jr-log-note">Ni texte ni clé complète.</p>
      <ol className="jr-log-list">
        {shown.length === 0 && <li className="jr-log-empty">Rien pour l’instant.</li>}
        {shown.map(r => (
          <li key={r.id} data-level={r.level} data-current={r.probeId && r.probeId === probeId ? '' : undefined}>
            <span className="jr-log-time">{r.time}</span>
            <span className="jr-log-step">{STEP_NAMES[r.step] || r.step}</span>
            <span className="jr-log-msg">
              {r.message}
              {(r.method || r.url) && <small>{[r.method, r.url, r.status].filter(v => v != null && v !== '').join(' · ')}</small>}
              {r.cause && <small>{r.level === 'error' ? 'Cause' : 'Détail'} : {r.cause}</small>}
            </span>
            <span className="jr-log-ms">{r.ms != null ? `${r.ms.toLocaleString('fr-FR')} ms` : ''}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ——— (5) Before the demo ———
export function DemoIntroScreen({ shortcut }) {
  const steps = [
    { icon: <TextCursorInput {...ICON} size={20} />, title: 'Sélectionnez', text: 'du texte, n’importe où' },
    { icon: <KeyCombo keys={shortcut} size="sm" joiner="" />, title: 'Appuyez', text: shortcut.join(' + ') },
    { icon: <MousePointer2 {...ICON} size={20} />, title: 'Choisissez', text: 'une action du menu' },
  ];
  return (
    <div className="jr-body-center">
      <ol className="jr-how">
        {steps.map((s, i) => (
          <li key={i} style={{ '--i': i }}>
            <span className="jr-how-icon">{s.icon}</span>
            <strong>{s.title}</strong>
            <small>{s.text}</small>
          </li>
        ))}
      </ol>
      <p className="jr-note">Cette fenêtre se range dans la barre des tâches le temps de la démo. Vous n’avez rien à faire.</p>
    </div>
  );
}

// ——— (6) Ready ———
export function DoneMark() {
  const tx = useTx();
  return (
    <span className="jr-done-mark" aria-hidden="true">
      <motion.span className="jr-done-disc" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={tx('bouncy', { delay: 0.1 })} />
      <svg viewBox="0 0 48 48" width="40" height="40">
        <motion.path d="M13 25l7 7 15-16" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={tx({ duration: 0.42, ease: 'out', delay: 0.32 })} />
      </svg>
    </span>
  );
}
export function Recap({ state, onEdit }) {
  const look = LOOKS.find(l => l.id === state.look)?.label;
  const action = ACTIONS.find(a => a.id === state.directAction)?.label;
  const model = state.conn.model ? modelOptions([{ id: state.conn.model, context: 32768 }])[0].label : null;
  const rows = [
    { id: 'apparence', label: 'Apparence', value: look },
    { id: 'raccourci', label: 'Raccourci', value: <><KeyCombo keys={state.shortcut} size="sm" /> <span className="jr-recap-sub">{state.mode === 'menu' ? 'ouvre le menu' : `lance « ${action} »`}</span></> },
    { id: 'modele', label: 'Modèle', value: model ? <>{model} <span className="jr-recap-sub">sur {state.conn.url.replace(/^https?:\/\//, '').replace(/\/.*$/, '')}</span></> : <span className="jr-recap-todo">À configurer dans les Réglages</span> },
  ];
  return (
    <dl className="jr-recap">
      {rows.map(r => (
        <div key={r.id} className="jr-recap-row">
          <dt>{r.label}</dt>
          <dd>{r.value}</dd>
          <button type="button" className="ft-linklike" onClick={() => onEdit(r.id)} aria-label={`Modifier : ${r.label}`}>Modifier</button>
        </div>
      ))}
    </dl>
  );
}

export { LOOKS, appName, Keycap, Spinner };
