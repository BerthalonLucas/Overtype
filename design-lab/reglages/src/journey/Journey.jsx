// PARCOURS — the whole first run, on its own <Stage>:
//   (0) end of the installer → « Lancer »
//   (1) Accueil: frosted setup window over the sharp desktop, the mark beating
//   (2) Apparence · (3) Raccourci & menu · (4) Votre modèle   — one question per screen
//   (5) Démo (the setup window closes, src/demo/Demo.jsx plays, nothing to do)
//   (6) C'est prêt → Réglages (src/settings/SettingsWindow.jsx)
// Lab bar above the desktop: jump to any screen, pick the step transition and the heartbeat
// (shared with Effets through ./variants.jsx), vote on the screen on show.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { ArrowRight, ChevronLeft, Palette, Keyboard, Server, Play, Settings2, X } from 'lucide-react';
import { Stage, AppMark } from '../stage/Desktop.jsx';
import { AppWindow } from '../stage/AppWindow.jsx';
import { useScope } from '../lab/Scope.jsx';
import { useLab } from '../lab/store.jsx';
import { Vote } from '../lab/Vote.jsx';
import { Button, IconButton, ICON } from '../ui/index.jsx';
import { useTx, wait } from '../lib/motion.js';
import { appName, defaultShortcut } from '../brand.js';
import { normalizeEndpoint } from '../mock/server.js';
import Demo from '../demo/Demo.jsx';
import SettingsWindow from '../settings/SettingsWindow.jsx';
import { Installer } from './Installer.jsx';
import { Heartbeat, HEARTBEATS, STEP_TRANSITIONS, stepMotion, useJourneyPrefs } from './variants.jsx';
import { LookScreen, ShortcutScreen, ModelScreen, LogSheet, DemoIntroScreen, DoneMark, Recap } from './screens.jsx';
import './journey.css';

const SETUP_W = 620;
const SETUP_H = 720;
const STEPS = ['welcome', 'apparence', 'raccourci', 'modele', 'demo', 'pret'];
const QUESTIONS = ['apparence', 'raccourci', 'modele', 'demo']; // the progress dots

// One header for every question (icon tile above, the question, one line under it): the same
// pattern on each screen, like an iPhone first start.
const HEAD = {
  apparence: { icon: Palette, tile: 5, title: `Comment voulez‑vous voir ${appName} ?`, text: 'Choisissez un thème. Vous pourrez le changer à tout moment.' },
  raccourci: { icon: Keyboard, tile: 1, title: 'Quel raccourci voulez-vous ?', text: `Les touches qui ouvrent ${appName} sur le texte sélectionné.` },
  modele: { icon: Server, tile: 2, title: 'Quel modèle utiliser ?', text: 'L’adresse de votre serveur et sa clé. On vérifie aussitôt.' },
  demo: { icon: Play, tile: 3, title: 'On regarde comment ça marche ?', text: 'Une démonstration de quinze secondes, en trois gestes.' },
};
const PRIMARY = { welcome: 'Commencer le setup', apparence: 'Continuer', raccourci: 'Continuer', modele: 'Continuer', demo: 'Voir la démo', pret: 'Ouvrir les Réglages' };
const SKIP = { apparence: 'Passer', raccourci: 'Passer', modele: 'Plus tard', demo: 'Passer la démo' };

// Lab bar: every stop of the journey, for « se balader ».
const STOPS = [
  { id: 'installer', name: 'Installation', vote: 'Fin de l’installeur (fenêtre classique, « Lancer »)' },
  { id: 'welcome', name: 'Accueil', vote: 'Accueil : fenêtre dépolie, logo qui bat, « Commencer le setup »' },
  { id: 'apparence', name: 'Apparence', vote: 'Question Apparence : 3 vignettes Système / Clair / Sombre, aperçu en direct' },
  { id: 'raccourci', name: 'Raccourci', vote: 'Question Raccourci : grandes touches, « Changer », menu ou action directe en 2 cartes' },
  { id: 'modele', name: 'Modèle', vote: 'Question Modèle : adresse, clé, trace en direct, liste des modèles, essai' },
  { id: 'demo', name: 'Démo', vote: 'Avant la démo : les 3 gestes, puis la fenêtre se ferme' },
  { id: 'pret', name: 'Prêt', vote: 'Fin : « C’est prêt », récapitulatif modifiable, « Ouvrir les Réglages »' },
  { id: 'reglages', name: 'Réglages', vote: 'Arrivée dans les Réglages depuis le setup' },
];

// What the setup hands over to the Réglages: the same server, key and model (the address as the
// user sees it, without « /v1 »), the same shortcut, and the direct action if one was chosen.
function carriedServer(conn) {
  const ep = normalizeEndpoint(conn.url);
  return { url: ep.ok ? ep.display : conn.url.trim(), key: conn.noKey ? '' : conn.key, noKey: conn.noKey, model: conn.model };
}
function carriedSettings(state) {
  return { menuShortcut: [...state.shortcut], ...(state.mode === 'direct' ? { defaultActionId: state.directAction } : {}) };
}

function initialSetup() {
  return { shortcut: [...defaultShortcut], mode: 'menu', directAction: 'corriger', conn: { url: '', key: '', noKey: false, model: '' } };
}

// ——— The setup window ———
function ScreenHead({ step }) {
  const h = HEAD[step];
  const Icon = h.icon;
  return (
    <header className="jr-head">
      <span className="jr-head-icon" style={{ '--tile': `var(--ft-tile-${h.tile})`, '--on-tile': `var(--ft-on-tile-${h.tile})` }} aria-hidden="true"><Icon {...ICON} /></span>
      <h1 className="jr-title" tabIndex={-1}>{h.title}</h1>
      <p className="jr-sub">{h.text}</p>
    </header>
  );
}

function Dots({ index }) {
  const tx = useTx();
  return (
    <span className="jr-dots" role="img" aria-label={`Étape ${index + 1} sur ${QUESTIONS.length}`}>
      {QUESTIONS.map((q, i) => <i key={q} data-done={i < index ? '' : undefined} />)}
      <motion.b className="jr-dots-on" initial={false} animate={{ x: index * 16 }} transition={tx('snappy')} />
    </span>
  );
}
function Bars({ index }) {
  const tx = useTx();
  return (
    <span className="jr-bars" role="img" aria-label={`Étape ${index + 1} sur ${QUESTIONS.length}`}>
      <span className="jr-bars-count">Étape {index + 1} sur {QUESTIONS.length}</span>
      <span className="jr-bars-track">
        {QUESTIONS.map((q, i) => (
          <i key={q}><motion.b initial={false} animate={{ scaleX: i <= index ? 1 : 0 }} transition={tx('smooth', { delay: i === index ? 0.05 : 0 })} /></i>
        ))}
      </span>
    </span>
  );
}

function SetupWindow({ step, dir, state, patch, go, next, back, onClose, onOpenSettings, onFinish, setRecording, primaryRef, urlRef }) {
  const tx = useTx();
  const lab = useLab();
  const { reduced } = lab;
  // The app's theme IS the lab's theme (same 3 choices): picking one here restyles everything
  // live, like the real app would, and the lab toolbar follows.
  const look = lab.theme;
  const setLook = v => {
    if (v === lab.theme) return;
    const run = () => lab.set({ theme: v });
    if (!reduced && typeof document !== 'undefined' && document.startViewTransition) {
      try { document.startViewTransition(() => flushSync(run)); return; } catch { /* fall through */ }
    }
    run();
  };
  const { direction } = useScope();
  const { transition } = useJourneyPrefs();
  const [modelOk, setModelOk] = useState(false);
  const [log, setLog] = useState(null); // null | { probeId }
  // Three structures, one per direction: Verre = centred stack with dots; Mat = wizard with a step
  // bar and a footer bar (Retour / Passer / Continuer); Aérien = a full-bleed coloured band on top
  // (the question's colour), large left-aligned title at its foot, round back button.
  const layout = direction === 'mat' ? 'bar' : direction === 'aerien' ? 'hero' : 'stack';
  const band = HEAD[step]?.tile ? `var(--ft-tile-${HEAD[step].tile})` : 'var(--ft-accent)';
  // The band ends just under the question's header, whatever its height (1 or 2 lines of title).
  const [bandH, setBandH] = useState(224);
  useLayoutEffect(() => {
    if (layout !== 'hero') return;
    if (step === 'welcome') { setBandH(420); return; }
    if (step === 'pret') { setBandH(260); return; }
    const head = document.querySelector(`.jr-screen[data-screen="${step}"] .jr-head`);
    if (head) setBandH(Math.min(420, 32 + 40 + 10 + head.offsetHeight + 11));
  }, [step, layout]);
  const qIndex = QUESTIONS.indexOf(step);
  const isQuestion = qIndex >= 0;
  const primaryDisabled = step === 'modele' && !modelOk;
  const primary = () => {
    if (primaryDisabled) return;
    if (step === 'pret') onOpenSettings(); else next();
  };
  const skip = () => {
    if (step === 'modele') patch({ conn: { ...state.conn, model: modelOk ? state.conn.model : '' } });
    next();
  };
  useEffect(() => { if (step !== 'modele') setLog(null); }, [step]);

  const body = {
    welcome: (
      <div className="jr-welcome">
        <motion.span initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={tx('bouncy', { delay: 0.15 })}><Heartbeat size={88} /></motion.span>
        <motion.h1 className="jr-hero" tabIndex={-1} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={tx('smooth', { delay: 0.3 })}>Bienvenue sur {appName}</motion.h1>
        <motion.p className="jr-sub" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={tx('smooth', { delay: 0.38 })}>
          Corrigez, traduisez et reformulez le texte sélectionné, dans n’importe quelle application.
        </motion.p>
      </div>
    ),
    apparence: <LookScreen value={look} onChange={setLook} />,
    raccourci: <ShortcutScreen value={state} onChange={patch} onRecording={setRecording} />,
    modele: <ModelScreen value={state.conn} onChange={c => patch({ conn: { ...state.conn, ...c } })} onOpenLog={probeId => setLog({ probeId })} onStatus={setModelOk} urlRef={urlRef} />,
    demo: <DemoIntroScreen shortcut={state.shortcut} />,
    pret: (
      <div className="jr-done">
        <DoneMark />
        <h1 className="jr-hero" tabIndex={-1}>C’est prêt</h1>
        <p className="jr-sub">Vous pouvez tout modifier dans les Réglages.</p>
        <Recap state={{ ...state, look }} onEdit={id => go(id, -1)} />
      </div>
    ),
  }[step];

  return (
    <AppWindow title={`Configuration de ${appName}`} width={SETUP_W} height={SETUP_H} material="frost" controls={['close']} showTitle={false} onClose={onClose}>
      <div className="jr-setup" data-layout={layout} data-step={step} style={{ '--band': band }}>
        {layout === 'hero' && <span className="jr-band" aria-hidden="true" style={{ transform: `scaleY(${bandH / 420})` }} />}
        <div className="jr-nav">
          {isQuestion && layout === 'stack' && (
            <>
              <Button variant="ghost" size="sm" className="jr-back" onClick={back} icon={<ChevronLeft {...ICON} />}>Retour</Button>
              <Dots index={qIndex} />
              <Button variant="ghost" size="sm" className="jr-skip" onClick={skip}>{SKIP[step]}</Button>
            </>
          )}
          {isQuestion && layout === 'bar' && <Bars index={qIndex} />}
          {isQuestion && layout === 'hero' && (
            <>
              <IconButton label="Retour" round className="jr-back jr-back-round" onClick={back}><ChevronLeft {...ICON} size={18} /></IconButton>
              <span className="jr-steppill" role="img" aria-label={`Étape ${qIndex + 1} sur ${QUESTIONS.length}`}>{qIndex + 1} / {QUESTIONS.length}</span>
              <Button variant="ghost" size="sm" className="jr-skip" onClick={skip}>{SKIP[step]}</Button>
            </>
          )}
        </div>

        <div className="jr-screens">
          <AnimatePresence initial={false} custom={dir}>
            <motion.section key={step} data-screen={step} className="jr-screen" {...stepMotion(transition, dir, reduced, tx)}>
              {HEAD[step] && <ScreenHead step={step} />}
              <div className="jr-body">{body}</div>
            </motion.section>
          </AnimatePresence>
        </div>

        <footer className="jr-foot">
          {layout === 'bar' && isQuestion && (
            <span className="jr-foot-left">
              <Button variant="secondary" size="lg" onClick={back} icon={<ChevronLeft {...ICON} />}>Retour</Button>
              <Button variant="ghost" size="lg" onClick={skip}>{SKIP[step]}</Button>
            </span>
          )}
          {step === 'pret' && <Button size="xl" className="jr-secondary" onClick={onFinish}>Fermer</Button>}
          <Button ref={primaryRef} variant="primary" size="xl" className="jr-primary" onClick={primary} disabled={primaryDisabled}
            iconEnd={step === 'pret' ? <Settings2 {...ICON} size={18} /> : step === 'welcome' ? <ArrowRight {...ICON} size={18} /> : step === 'demo' ? <Play {...ICON} size={18} /> : null}>
            {PRIMARY[step]}
          </Button>
          {/* Always there (empty when there is nothing to say) so the big button never moves. */}
          <span className="jr-foot-note" aria-live="polite">
            {step === 'welcome' ? '3 questions et une courte démo, environ une minute.'
              : step === 'modele' && primaryDisabled ? 'Continuer dès que la connexion est vérifiée.' : ' '}
          </span>
        </footer>

        <AnimatePresence>
          {log && (
            <motion.div key="log" className="jr-log-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={tx(0.18)}>
              <button type="button" className="jr-log-scrim" aria-label="Fermer le journal" tabIndex={-1} onClick={() => setLog(null)} />
              <motion.div className="jr-log-sheet" role="dialog" aria-label="Journal de connexion" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} transition={tx('smooth')}>
                <LogSheet probeId={log.probeId} onClose={() => setLog(null)} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppWindow>
  );
}

// A Windows notification (bottom right) after « Fermer » at the end.
function Toast({ onOpen, onDismiss, shortcut }) {
  const tx = useTx();
  useEffect(() => {
    const c = new AbortController();
    wait(7000, c.signal).then(ok => { if (ok) onDismiss(); });
    return () => c.abort();
  }, [onDismiss]);
  return (
    <motion.div className="jr-toast" role="status" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} transition={tx('smooth')}>
      <span className="jr-toast-app"><AppMark size={16} /><span>{appName}</span></span>
      <strong>{appName} est prêt</strong>
      <span>Sélectionnez du texte, puis {shortcut.join(' + ')}.</span>
      <span className="jr-toast-actions">
        <Button size="sm" onClick={onOpen}>Ouvrir les Réglages</Button>
        <Button size="sm" variant="ghost" onClick={onDismiss}>OK</Button>
      </span>
    </motion.div>
  );
}

// ——— Lab bar ———
function Seg({ label, value, options, onChange }) {
  return (
    <ToggleGroup.Root type="single" className="lab-seg" aria-label={label} value={value} onValueChange={v => { if (v) onChange(v); }}>
      {options.map(o => <ToggleGroup.Item key={o.id} value={o.id} className="lab-seg-item" title={o.description}>{o.short || o.name || o.label}</ToggleGroup.Item>)}
    </ToggleGroup.Root>
  );
}
function JourneyBar({ stop, onJump, onPrefill }) {
  const prefs = useJourneyPrefs();
  const s = STOPS.find(x => x.id === stop);
  const tr = STEP_TRANSITIONS.find(t => t.id === prefs.transition);
  const hb = HEARTBEATS.find(h => h.id === prefs.heartbeat);
  return (
    <div className="jr-labbar" role="toolbar" aria-label="Commandes du parcours">
      <div className="lab-field"><span className="lab-field-label">Écran</span>
        <Seg label="Aller à l’écran" value={stop} options={STOPS} onChange={onJump} />
      </div>
      {s && <Vote id={`journey.screen.${s.id}`} label={s.vote} section="journey" compact />}
      {stop === 'modele' && <button type="button" className="lab-btn" onClick={onPrefill}>Préremplir l’exemple</button>}
      <span className="jr-labbar-sep" aria-hidden="true" />
      <div className="lab-field"><span className="lab-field-label">Transition</span>
        <Seg label="Transition entre les écrans" value={prefs.transition} options={STEP_TRANSITIONS.map(t => ({ ...t, short: t.label.split(' ')[0] }))} onChange={prefs.setTransition} />
        <Vote id={`journey.transition.${tr.id}`} label={`Transition entre écrans : ${tr.label}`} section="journey" note={false} compact />
      </div>
      <div className="lab-field"><span className="lab-field-label">Battement</span>
        <Seg label="Battement du logo" value={prefs.heartbeat} options={HEARTBEATS.map(h => ({ ...h, short: { anneau: 'Anneau', double: 'Double', halo: 'Halo' }[h.id] }))} onChange={prefs.setHeartbeat} />
        <Vote id={`journey.heartbeat.${hb.id}`} label={`Battement de l’accueil : ${hb.label}`} section="journey" note={false} compact />
      </div>
    </div>
  );
}

// ——— The journey ———
export default function Journey() {
  const lab = useLab();
  const tx = useTx();
  const [phase, setPhase] = useState('installer'); // installer | setup | demo | settings | desktop
  const [step, setStep] = useState('welcome');
  const [dir, setDir] = useState(1);
  const [state, setState] = useState(initialSetup);
  const [pendingSetup, setPendingSetup] = useState(false);
  const [toast, setToast] = useState(false);
  const [settingsKey, setSettingsKey] = useState(0);
  const recording = useRef(false);
  const primaryRef = useRef(null);
  const launchRef = useRef(null);
  const urlRef = useRef(null);

  const patch = useCallback(p => setState(s => ({ ...s, ...p })), []);

  const go = useCallback((to, d) => {
    setStep(cur => { setDir(d ?? (STEPS.indexOf(to) >= STEPS.indexOf(cur) ? 1 : -1)); return to; });
  }, []);
  const next = useCallback(() => {
    if (step === 'demo') { setPhase('demo'); return; }
    const i = STEPS.indexOf(step);
    if (i < STEPS.length - 1) go(STEPS[i + 1], 1);
  }, [step, go]);
  const back = useCallback(() => {
    const i = STEPS.indexOf(step);
    if (i > 0 && step !== 'pret') go(STEPS[i - 1], -1);
  }, [step, go]);

  const onDemoDone = useCallback(() => { setDir(1); setStep('pret'); setPhase('setup'); }, []);
  const openSettings = useCallback(() => { setToast(false); setPendingSetup(false); setSettingsKey(k => k + 1); setPhase('settings'); }, []);

  // Focus: the primary button on each screen (the address field on « Votre modèle »).
  useEffect(() => {
    if (phase !== 'setup') return undefined;
    const c = new AbortController();
    wait(step === 'welcome' ? 700 : 380, c.signal).then(ok => {
      if (!ok) return;
      // the heading (no ring, read first by a screen reader; Enter still presses the big button),
      // or the address field on « Votre modèle »
      const target = step === 'modele' ? urlRef.current : document.querySelector(`.jr-screen[data-screen="${step}"] :is(.jr-title, .jr-hero)`);
      if (target && !target.disabled) target.focus({ preventScroll: true });
    });
    return () => c.abort();
  }, [phase, step]);

  // Enter = the big button, Escape = Retour (not while typing a shortcut or with a popup open).
  useEffect(() => {
    if (phase !== 'setup') return undefined;
    const onKey = e => {
      if (e.defaultPrevented || recording.current || e.ctrlKey || e.altKey || e.metaKey) return;
      if (document.querySelector('[data-radix-popper-content-wrapper], .jr-log-layer, .ft-dialog')) return;
      const t = e.target;
      if (t?.closest?.('.lab-bar, .jr-labbar')) return;
      if (e.key === 'Escape') { e.preventDefault(); back(); return; }
      if (e.key === 'Enter') {
        if (t?.closest?.('button, a, [role="combobox"], [role="radio"], textarea')) return; // native activation
        e.preventDefault();
        primaryRef.current?.click();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, back]);

  const jump = id => {
    setToast(false);
    if (id === 'installer') { setPhase('installer'); setStep('welcome'); return; }
    if (id === 'reglages') { openSettings(); return; }
    go(id);
    setPhase('setup');
  };
  const stop = phase === 'setup' ? step : phase === 'installer' ? 'installer' : phase === 'settings' ? 'reglages' : phase === 'demo' ? 'demo' : '';
  const prefill = () => patch({ conn: { url: 'llm.exemple.com/v1', key: 'sk-labo-7f3a9c2e', noKey: false, model: '' } });
  const onTray = () => {
    if (phase === 'settings') { setPhase('desktop'); return; }
    if (pendingSetup) { setPendingSetup(false); setPhase('setup'); return; }
    if (phase === 'desktop') openSettings();
  };
  const setRecording = useCallback(v => { recording.current = v; }, []);

  return (
    <div className="jr-root">
      <div className="jr-scope">
        <Stage focus={phase === 'settings' ? { w: 860, h: 600 } : phase === 'demo' ? { w: 900, h: 740 } : { w: SETUP_W, h: SETUP_H }} onTray={onTray} trayActive={phase === 'settings' || phase === 'setup'} trayBadge={pendingSetup}>
          <AnimatePresence mode="wait">
            {phase === 'installer' && (
              <Installer key="installer" launchRef={launchRef}
                onLaunch={() => { setStep('welcome'); setDir(1); setPhase('setup'); }}
                onClose={() => { setPendingSetup(true); setPhase('desktop'); }} />
            )}
            {phase === 'setup' && (
              <SetupWindow key="setup" step={step} dir={dir} state={state} patch={patch} go={go} next={next} back={back}
                onClose={() => { setPendingSetup(step !== 'pret'); setPhase('desktop'); }}
                onOpenSettings={openSettings}
                onFinish={() => { setPhase('desktop'); setToast(true); }}
                setRecording={setRecording} primaryRef={primaryRef} urlRef={urlRef} />
            )}
            {phase === 'demo' && <Demo key="demo" onDone={onDemoDone} shortcut={state.shortcut} />}
            {phase === 'settings' && (
              <SettingsWindow key={`settings-${settingsKey}`} initialPage="general" onClose={() => setPhase('desktop')}
                initialServer={carriedServer(state.conn)} initialSettings={carriedSettings(state)} />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {phase === 'desktop' && toast && <Toast key="toast" shortcut={state.shortcut} onOpen={openSettings} onDismiss={() => setToast(false)} />}
            {phase === 'desktop' && !toast && (
              <motion.p key="hint" className="jr-desk-hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={tx(0.3, { delay: 0.4 })}>
                {pendingSetup ? `Le setup vous attend : cliquez sur l’icône de ${appName} en bas à droite.` : `${appName} attend dans la barre des tâches. Cliquez sur son icône pour les Réglages.`}
              </motion.p>
            )}
          </AnimatePresence>
        </Stage>
      </div>
      <JourneyBar stop={stop} onJump={jump} onPrefill={prefill} />
    </div>
  );
}
