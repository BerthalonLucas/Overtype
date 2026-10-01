// EFFETS (v2) — only the effects Lucas chose (30/09), live, each with a replay button:
//   Battement et anneau · Fondu et échelle · Ressort Windows 11 · survol en voile léger ·
//   trace « balayage » puis repliée (the real ConnectionCheck) · Repli vers la barre des tâches ·
//   Apparition en place (try the real Ctrl+Maj+M on this page). The v1 alternatives he turned
//   down (iOS / « Glissé sec » switches, a hover pill that follows the mouse, « Cascade »,
//   « Fondu enchaîné », « Dépliage et message ») are gone, and so are the « Utiliser » buttons.
// Rules: transform + opacity only; motion via useTx(), timers via wait() (follow the lab speed);
// reduced motion: motion's MotionConfig + the CSS safety net; opacity-only fallbacks here.
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import {
  RotateCcw, Settings2, Keyboard, Sparkles, Replace, Palette, Server, Database, Stethoscope, Globe, Check, Power, Volume2,
} from 'lucide-react';
import { Variant } from '../lab/Vote.jsx';
import { useLab } from '../lab/store.jsx';
import { useTx, wait } from '../lib/motion.js';
import { Button, KeyCombo, ICON } from '../ui/index.jsx';
import { useProbe, ConnectionCheck } from '../connection/Connection.jsx';
import { AppMark } from '../stage/Desktop.jsx';
import { appName, defaultShortcut } from '../brand.js';
import * as JourneyVariants from '../journey/variants.jsx';
import './effects.css';

const { HEARTBEATS, STEP_TRANSITIONS, Heartbeat, stepMotion } = JourneyVariants;

// A placeholder when a sibling module does not export what we need (yet).
function Missing({ file, name }) {
  return <div className="lab-todo"><strong>À venir</strong><span>En attente de <code>{name}</code> dans <code>{file}</code>.</span></div>;
}

function Replay({ onClick, label = 'Rejouer' }) {
  return <Button size="sm" variant="secondary" icon={<RotateCcw size={14} strokeWidth={1.75} />} onClick={onClick}>{label}</Button>;
}
function Tools({ children }) { return <div className="fx-tools">{children}</div>; }

// ————————————————————— 1. Heartbeats —————————————————————
function HeartbeatCard({ hb }) {
  const [k, setK] = useState(0);
  return (
    <Variant id={`effects.heartbeat.${hb.id}`} label={`Battement de l’accueil : ${hb.label}`} description={hb.description} section="effects">
      <div className="fx-welcome" key={k}>
        <Heartbeat variant={hb.id} size={64} />
        <p className="fx-welcome-title">Bienvenue sur {appName}</p>
        <Button size="sm" variant="primary">Commencer le setup</Button>
      </div>
      <Tools><Replay onClick={() => setK(x => x + 1)} /></Tools>
    </Variant>
  );
}

// ————————————————————— 2. Step transitions —————————————————————
const STEPS = [
  { title: 'Comment voulez-vous voir l’app ?', body: () => <div className="fx-choice"><span data-on="">Clair</span><span>Sombre</span><span>Système</span></div> },
  { title: 'Votre raccourci', body: () => <KeyCombo keys={defaultShortcut} size="sm" active={3} /> },
  { title: 'Votre modèle', body: () => <div className="fx-fake-field"><Globe size={14} strokeWidth={1.5} />llm.exemple.com</div> },
  { title: 'Tout est prêt', body: () => <span className="fx-done"><Check size={18} strokeWidth={2} /></span> },
];
function StepCard({ st }) {
  const lab = useLab();
  const tx = useTx();
  const [[i, dir], setStep] = useState([0, 1]);
  const run = useRef(0);
  const go = d => setStep(([n]) => [Math.max(0, Math.min(STEPS.length - 1, n + d)), d]);
  const replay = async () => {
    const id = ++run.current;
    setStep([0, -1]);
    for (let n = 1; n < STEPS.length; n++) {
      if (!(await wait(900)) || run.current !== id) return;
      setStep([n, 1]);
    }
  };
  useEffect(() => () => { run.current++; }, []);
  const s = STEPS[i];
  return (
    <Variant id={`effects.step.${st.id}`} label={`Passage d’une question à l’autre : ${st.label}`} description={st.description} section="effects">
      <div className="fx-setup">
        <div className="fx-setup-stage">
          <AnimatePresence initial={false} custom={dir}>
            <motion.div key={i} className="fx-setup-screen" {...stepMotion(st.id, dir, lab.reduced, tx)}>
              <span className="fx-setup-count">{i + 1} sur {STEPS.length}</span>
              <p className="fx-setup-title">{s.title}</p>
              {s.body()}
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="fx-setup-nav">
          <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => go(-1)}>Retour</Button>
          <Button size="sm" variant="primary" disabled={i === STEPS.length - 1} onClick={() => go(1)}>Continuer</Button>
        </div>
      </div>
      <Tools><Replay onClick={replay} label="Tout jouer" /></Tools>
    </Variant>
  );
}

// ————————————————————— 3. Switch toggles —————————————————————
const SWITCH_FX = [
  { id: 'w11', label: 'Ressort Windows 11', description: 'La pastille grossit au survol, puis file avec un petit dépassement. C’est l’interrupteur actuel des primitives.' },
];
function FxSwitch({ fx, checked, onChange, label }) {
  return (
    <SwitchPrimitive.Root className="ft-switch fx-sw" data-fx={fx} checked={checked} onCheckedChange={onChange} aria-label={label}>
      <SwitchPrimitive.Thumb className="ft-switch-thumb" />
    </SwitchPrimitive.Root>
  );
}
function SwitchCard({ sw }) {
  const [a, setA] = useState(true);
  const [b, setB] = useState(false);
  const [pressed, setPressed] = useState(false);
  const run = useRef(0);
  const replay = async () => {
    const id = ++run.current;
    for (let n = 0; n < 4; n++) {
      setPressed(true);
      if (!(await wait(160)) || run.current !== id) return setPressed(false);
      setPressed(false);
      setA(x => !x); setB(x => !x);
      if (!(await wait(700)) || run.current !== id) return;
    }
  };
  useEffect(() => () => { run.current++; }, []);
  return (
    <Variant id={`effects.switch.${sw.id}`} label={`Interrupteur : ${sw.label}`} description={sw.description} section="effects">
      <div className="fx-switch-rows" data-pressed={pressed ? '' : undefined}>
        <label className="fx-switch-row"><span><Power size={15} strokeWidth={1.5} />Démarrer avec Windows</span><FxSwitch fx={sw.id} checked={a} onChange={setA} label="Démarrer avec Windows" /></label>
        <label className="fx-switch-row"><span><Volume2 size={15} strokeWidth={1.5} />Sons</span><FxSwitch fx={sw.id} checked={b} onChange={setB} label="Sons" /></label>
      </div>
      <Tools><Replay onClick={replay} label="Basculer 4 fois" /></Tools>
    </Variant>
  );
}

// ————————————————————— 4. Row hover —————————————————————
const HOVER_FX = [
  { id: 'voile', label: 'Voile léger', description: 'Une teinte très légère sous la rangée survolée, rien ne suit la souris. Façon Windows 11.' },
];
const HOVER_ROWS = [
  { icon: Power, title: 'Démarrer avec Windows', value: 'Oui' },
  { icon: Keyboard, title: 'Raccourci', value: 'Ctrl + Alt + Espace' },
  { icon: Replace, title: 'Après remplacement', value: 'Pilule 8 s' },
  { icon: Server, title: 'Serveur', value: 'Connecté' },
];
function HoverCard({ hv }) {
  const [hot, setHot] = useState(null);
  const run = useRef(0);
  const replay = async () => {
    const id = ++run.current;
    for (const n of [0, 1, 2, 3, 2, null]) {
      setHot(n);
      if (!(await wait(420)) || run.current !== id) return;
    }
  };
  useEffect(() => () => { run.current++; }, []);
  return (
    <Variant id={`effects.hover.${hv.id}`} label={`Survol des rangées : ${hv.label}`} description={hv.description} section="effects">
      <LayoutGroup id={`hv-${hv.id}`}>
        <div className="fx-rows" data-fx={hv.id} onMouseLeave={() => setHot(null)}>
          {HOVER_ROWS.map((r, n) => (
            <button type="button" key={r.title} className="fx-row" data-hot={hot === n ? '' : undefined}
              onMouseEnter={() => setHot(n)} onFocus={() => setHot(n)} onBlur={() => setHot(null)}>
              <span className="fx-row-icon"><r.icon {...ICON} /></span>
              <span className="fx-row-title">{r.title}</span>
              <span className="fx-row-value">{r.value}</span>
            </button>
          ))}
        </div>
      </LayoutGroup>
      <Tools><Replay onClick={replay} label="Parcourir" /></Tools>
    </Variant>
  );
}

// ————————————————————— 5. Live trace —————————————————————
// The real check of the app (src/connection): the 4 steps swept (« balayage »), then folded into
// « ● Connecté · modèle · ms  Détails ▾ » ; on an error (toolbar « Serveur ») it stays open on the step.
function TraceCard() {
  const p = useProbe({ url: 'https://llm.exemple.com', apiKey: 'sk-labo-7f3a', noKey: false, auto: true });
  const model = p.models[0]?.id;
  return (
    <Variant id="effects.trace.balayage" label="Trace de connexion : balayage, puis repliée" section="effects"
      description="Les 4 étapes sont là dès le début ; un reflet passe sur celle en cours. Une fois connecté, tout se replie en une ligne. Changez le scénario « Serveur » de la barre pour voir une erreur.">
      <div className="fx-check" data-ft-page="serveur"><ConnectionCheck probe={p} model={model} /></div>
      <Tools><Replay onClick={p.run} label="Vérifier à nouveau" /></Tools>
    </Variant>
  );
}

// ————————————————————— 6. Setup closing into the demo —————————————————————
const WINDOW_FX = [
  { id: 'repli', label: 'Repli vers la barre des tâches', description: 'La fenêtre du setup se rétracte vers l’icône de l’app, qui pulse, puis la fenêtre de démo s’ouvre. On comprend où vit l’app.' },
];
function WindowCard({ wf }) {
  const tx = useTx();
  const lab = useLab();
  const [phase, setPhase] = useState('setup'); // setup → closing → demo
  const deskRef = useRef(null);
  const trayRef = useRef(null);
  const [target, setTarget] = useState({ x: 118, y: 96 });
  const aim = () => {
    const d = deskRef.current?.getBoundingClientRect(), t = trayRef.current?.getBoundingClientRect();
    if (!d || !t || !d.width) return;
    const k = d.width / (deskRef.current.offsetWidth || d.width); // the page may be scaled
    setTarget({ x: (t.left + t.width / 2 - (d.left + d.width / 2)) / k, y: (t.top + t.height / 2 - (d.top + 18 * k + 75 * k)) / k });
  };
  const run = useRef(0);
  const replay = async () => {
    const id = ++run.current;
    setPhase('setup');
    aim();
    if (!(await wait(700)) || run.current !== id) return;
    setPhase('closing');
    if (!(await wait(wf.id === 'repli' ? 650 : 320)) || run.current !== id) return;
    setPhase('demo');
  };
  useEffect(() => { replay(); return () => { run.current++; }; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const exit = wf.id === 'repli' && !lab.reduced
    ? { opacity: 0, scale: 0.08, x: target.x, y: target.y, transition: tx({ duration: 0.5, ease: [0.5, 0, 0.2, 1] }) }
    : { opacity: 0, scale: 0.97, transition: tx({ duration: 0.22, ease: 'out' }) };
  const enter = wf.id === 'repli' ? { opacity: 0, scale: 0.94 } : { opacity: 0, y: 22 };
  return (
    <Variant id={`effects.window.${wf.id}`} label={`Du setup à la démo : ${wf.label}`} description={wf.description} section="effects">
      <div className="fx-desk" ref={deskRef}>
        <div className="fx-desk-wall" />
        <AnimatePresence>
          {phase === 'setup' && (
            <motion.div key="setup" className="fx-win fx-win-setup" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={exit} transition={tx('window')}>
              <span className="fx-done"><Check size={16} strokeWidth={2} /></span>
              <strong>Tout est prêt</strong>
              <span className="fx-win-btn">Voir comment ça marche</span>
            </motion.div>
          )}
          {phase === 'demo' && (
            <motion.div key="demo" className="fx-win fx-win-demo" initial={enter} animate={{ opacity: 1, scale: 1, y: 0 }} transition={tx('window')}>
              <span className="fx-win-bar"><i /><i /><i /></span>
              <span className="fx-win-text"><i style={{ width: '82%' }} /><i style={{ width: '64%' }} className="fx-sel" /><i style={{ width: '74%' }} /></span>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="fx-desk-bar">
          <span ref={trayRef} className="fx-desk-tray" data-pulse={phase === 'closing' && wf.id === 'repli' ? '' : undefined}><AppMark size={12} /></span>
        </div>
      </div>
      <Tools><Replay onClick={replay} /></Tools>
    </Variant>
  );
}

// ————————————————————— 7. Diagnostic reveal —————————————————————
const DIAG_FX = [
  { id: 'apparait', label: 'Apparition en place', description: 'Un filet, puis « Diagnostic » glisse dans la barre latérale avec un éclat d’accent qui s’éteint.' },
];
const SIDEBAR = [
  { icon: Settings2, label: 'Général' }, { icon: Keyboard, label: 'Raccourcis' }, { icon: Sparkles, label: 'Actions' },
  { icon: Replace, label: 'Après remplacement' }, { icon: Palette, label: 'Apparence' }, { icon: Server, label: 'Serveur' }, { icon: Database, label: 'Données' },
];
function DiagCard({ df, shown, onToggle }) {
  const tx = useTx();
  const [note, setNote] = useState(false);
  useEffect(() => {
    if (!shown || df.id !== 'deplie') { setNote(false); return undefined; }
    setNote(true);
    const ctl = new AbortController();
    wait(2600, ctl.signal).then(ok => ok && setNote(false));
    return () => ctl.abort();
  }, [shown, df.id]);
  const item = df.id === 'apparait'
    ? { initial: { opacity: 0, x: -10 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -6, transition: tx(0.16) }, transition: tx('bouncy') }
    : { initial: { opacity: 0, scaleY: 0.2 }, animate: { opacity: 1, scaleY: 1 }, exit: { opacity: 0, scaleY: 0.4, transition: tx(0.16) }, transition: tx('smooth'), style: { originY: 0 } };
  return (
    <Variant id={`effects.diag.${df.id}`} label={`Page Diagnostic révélée : ${df.label}`} description={df.description} section="effects">
      <div className="fx-side">
        <nav className="fx-side-list" aria-label="Réglages (aperçu)">
          {SIDEBAR.map((s, n) => <span key={s.label} className="fx-side-item" data-on={n === 5 ? '' : undefined}><s.icon {...ICON} />{s.label}</span>)}
          <div className="fx-side-slot">
            <AnimatePresence>
              {shown && (
                <motion.div key="diag" className="fx-side-diag" {...item}>
                  <span className="fx-side-sep" />
                  <span className="fx-side-item" data-diag="" data-flash={df.id === 'apparait' ? '' : undefined}><Stethoscope {...ICON} />Diagnostic</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </nav>
        <AnimatePresence>
          {note && (
            <motion.p key="note" className="fx-side-note" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={tx('smooth')}>
              Diagnostic affiché · <KeyCombo keys={['Ctrl', 'Maj', 'M']} size="sm" /> pour le masquer
            </motion.p>
          )}
        </AnimatePresence>
      </div>
      <Tools><Button size="sm" variant="secondary" onClick={onToggle}>{shown ? 'Masquer' : 'Simuler Ctrl+Maj+M'}</Button></Tools>
    </Variant>
  );
}

export default function Effects() {
  const [diag, setDiag] = useState(false);
  useEffect(() => {
    const on = e => {
      if (e.ctrlKey && e.shiftKey && !e.altKey && (e.key === 'M' || e.key === 'm' || e.code === 'KeyM')) { e.preventDefault(); setDiag(d => !d); }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);
  const pick = (list, id) => list?.filter(v => v.id === id) ?? [];
  return (
    <div className="lab-page-inner fx-page">
      <header>
        <h1>Effets</h1>
        <p className="lab-page-lead">Les effets retenus, tels qu’ils jouent dans le Parcours et les Réglages. Rejouez-les, passez la vitesse à ⅒× pour les voir au ralenti, essayez « Mouvement réduit ».</p>
      </header>

      <section className="fx-section">
        <h2>Accueil et setup</h2>
        <div className="lab-grid-3">
          {pick(HEARTBEATS, 'anneau').map(hb => <HeartbeatCard key={hb.id} hb={hb} />)}
          {pick(STEP_TRANSITIONS, 'echelle').map(st => <StepCard key={st.id} st={st} />)}
          {WINDOW_FX.map(wf => <WindowCard key={wf.id} wf={wf} />)}
        </div>
      </section>

      <section className="fx-section">
        <h2>Réglages</h2>
        <div className="lab-grid-3">
          {SWITCH_FX.map(sw => <SwitchCard key={sw.id} sw={sw} />)}
          {HOVER_FX.map(hv => <HoverCard key={hv.id} hv={hv} />)}
          <TraceCard />
        </div>
      </section>

      <section className="fx-section">
        <h2>Révéler la page Diagnostic</h2>
        <p className="fx-question">Cachée par défaut. Essayez pour de vrai : <KeyCombo keys={['Ctrl', 'Maj', 'M']} size="sm" /> sur cette page.</p>
        <div className="lab-grid-3">{DIAG_FX.map(df => <DiagCard key={df.id} df={df} shown={diag} onToggle={() => setDiag(d => !d)} />)}</div>
      </section>
    </div>
  );
}
