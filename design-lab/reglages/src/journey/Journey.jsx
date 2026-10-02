// PARCOURS — the whole first run, on its own <Stage> (v2, Lucas's choices of 30/09):
//   (0) end of the installer (matte window) → « Lancer »
//   (1) Accueil: REAL glass window over the sharp desktop, the mark beating (« Battement et anneau »)
//   (2) Apparence · (3) Raccourci & menu · (4) Votre modèle · (5) Avant la démo — one question
//       per screen, iPhone-like, each in its topic's colour (TOPIC_PAGE), « Fondu et échelle »
//   (5→) the setup window folds into the tray icon (« Repli vers la barre des tâches »), the icon
//       pulses, then the demo (src/demo/Demo.jsx) plays
//   (6) C'est prêt → Réglages (src/settings/SettingsWindow.jsx), answers carried over
// Robustness: navigation is locked while a screen change runs (no double step on a double click
// or a held Enter); a jump from the lab bar cancels a fold in progress; every timer is aborted.
import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { ArrowRight, ChevronLeft, Palette, Keyboard, Server, Play, Settings2 } from 'lucide-react';
import { Stage, AppMark, useDesktop } from '../stage/Desktop.jsx';
import { AppWindow } from '../stage/AppWindow.jsx';
import { useLab } from '../lab/store.jsx';
import { Vote } from '../lab/Vote.jsx';
import { Button, ICON, ScrollArea } from '../ui/index.jsx';
import { clock, useTx, wait } from '../lib/motion.js';
import { TOPIC_PAGE } from '../tokens/palettes.js';
import { appName, defaultShortcut } from '../brand.js';
import { normalizeEndpoint } from '../mock/server.js';
import Demo from '../demo/Demo.jsx';
import SettingsWindow from '../settings/SettingsWindow.jsx';
import { Installer } from './Installer.jsx';
import { Heartbeat, stepMotion } from './variants.jsx';
import { LookScreen, ShortcutScreen, ModelScreen, LogSheet, DemoIntroScreen, DoneMark, Recap } from './screens.jsx';
import './journey.css';

const SETUP_W = 620;
const SETUP_H = 720;
const STEPS = ['welcome', 'apparence', 'raccourci', 'modele', 'demo', 'pret'];
const QUESTIONS = ['apparence', 'raccourci', 'modele', 'demo']; // the progress dots
// Lucas's picks (30/09): the only ones left in the journey (Effets still compares the others).
const TRANSITION = 'echelle';   // « Fondu et échelle »
const HEARTBEAT = 'anneau';     // « Battement et anneau »
const NAV_LOCK_MS = 300;        // a screen change runs: ignore Continuer / Retour / Enter / Échap

// One header for every question (icon, the question, one line under it), in the topic's colour.
const HEAD = {
  apparence: { icon: Palette, title: `Comment voulez‑vous voir ${appName} ?`, text: 'Choisissez un thème. Vous pourrez le changer à tout moment.' },
  raccourci: { icon: Keyboard, title: 'Quel raccourci voulez-vous ?', text: `Les touches qui ouvrent ${appName} sur le texte sélectionné.` },
  modele: { icon: Server, title: 'Quel modèle utiliser ?', text: 'L’adresse de votre serveur et sa clé. On vérifie aussitôt.' },
  demo: { icon: Play, title: 'On regarde comment ça marche ?', text: 'Une démonstration de quinze secondes, en trois gestes.' },
};
const PRIMARY = { welcome: 'Commencer le setup', apparence: 'Continuer', raccourci: 'Continuer', modele: 'Continuer', demo: 'Voir la démo', pret: 'Ouvrir les Réglages' };
const SKIP = { apparence: 'Passer', raccourci: 'Passer', modele: 'Plus tard', demo: 'Passer la démo' };

// Lab bar: every stop of the journey, for « se balader ».
const STOPS = [
  { id: 'installer', name: 'Installation', vote: 'Fin de l’installeur (fenêtre mate classique, « Lancer »)' },
  { id: 'welcome', name: 'Accueil', vote: 'Accueil : fenêtre en vrai verre sur le bureau net, logo qui bat avec anneau' },
  { id: 'apparence', name: 'Apparence', vote: 'Question Apparence (ambre) : 3 vignettes Système / Clair / Sombre, aperçu en direct' },
  { id: 'raccourci', name: 'Raccourci', vote: 'Question Raccourci (corail) : grandes touches, « Changer », menu ou action directe' },
  { id: 'modele', name: 'Modèle', vote: 'Question Modèle (vert d’eau) : connexion partagée, trace repliée en une ligne, liste des modèles' },
  { id: 'demo', name: 'Démo', vote: 'Avant la démo (lavande), puis la fenêtre se replie dans l’icône de la barre des tâches' },
  { id: 'pret', name: 'Prêt', vote: 'Fin : « C’est prêt », récapitulatif modifiable, « Ouvrir les Réglages »' },
  { id: 'reglages', name: 'Réglages', vote: 'Arrivée dans les Réglages depuis le setup (réponses reprises)' },
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
      <span className="jr-head-icon" aria-hidden="true"><Icon {...ICON} /></span>
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

// Where the window goes when it folds into the tray: the offset (desktop px) from the window's
// centre to the app's tray icon (the taskbar one, or the floating button on a phone).
function measureFold(win, scale) {
  const desk = win?.closest('.ft-stage');
  const tray = desk?.querySelector('.ft-tray-app') || desk?.querySelector('.ft-stage-tray');
  if (!win || !tray) return { x: 0, y: 320 };
  const a = win.getBoundingClientRect(), b = tray.getBoundingClientRect();
  const k = scale || 1;
  return { x: (b.left + b.width / 2 - (a.left + a.width / 2)) / k, y: (b.top + b.height / 2 - (a.top + a.height / 2)) / k };
}

function SetupWindow({ step, dir, state, patch, go, next, back, onClose, onOpenSettings, onFinish, setRecording, primaryRef, fold }) {
  const tx = useTx();
  const lab = useLab();
  const { reduced } = lab;
  const { scale } = useDesktop();
  const winRef = useRef(null);
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
  const [modelOk, setModelOk] = useState(false);
  const [log, setLog] = useState(null); // null | { probeId }
  const page = TOPIC_PAGE[step] || 'general';
  const qIndex = QUESTIONS.indexOf(step);
  const isQuestion = qIndex >= 0;
  const primaryDisabled = step === 'modele' && !modelOk;
  const primary = () => {
    if (primaryDisabled) return;
    if (step === 'pret') onOpenSettings();
    else if (step === 'demo') next(measureFold(winRef.current, scale));
    else next();
  };
  const skip = () => {
    if (step === 'modele') patch({ conn: { ...state.conn, model: modelOk ? state.conn.model : '' } });
    if (step === 'demo') { go('pret', 1); return; } // « Passer la démo »: straight to « C'est prêt »
    next();
  };
  useEffect(() => { if (step !== 'modele') setLog(null); }, [step]);

  const body = {
    welcome: (
      <div className="jr-welcome">
        <motion.span className="jr-welcome-mark" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={tx('bouncy', { delay: 0.15 })}><Heartbeat variant={HEARTBEAT} size={88} /></motion.span>
        <motion.h1 className="jr-hero" tabIndex={-1} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={tx('smooth', { delay: 0.3 })}>Bienvenue sur {appName}</motion.h1>
        <motion.p className="jr-sub" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={tx('smooth', { delay: 0.38 })}>
          Corrigez, traduisez et reformulez le texte sélectionné, dans n’importe quelle application.
        </motion.p>
      </div>
    ),
    apparence: <LookScreen value={look} onChange={setLook} />,
    raccourci: <ShortcutScreen value={state} onChange={patch} onRecording={setRecording} />,
    modele: <ModelScreen value={state.conn} onChange={c => patch({ conn: { ...state.conn, ...c } })} onOpenLog={probeId => setLog({ probeId })} onStatus={setModelOk} />,
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

  // Exit: folded into the tray icon (« Repli vers la barre des tâches »), or the window's own fade.
  // AnimatePresence hands `custom` (the fold target, or null) to the exiting window.
  const variants = {
    out: f => (f && !reduced
      ? { opacity: [1, 1, 0], scale: 0.06, x: f.x, y: f.y, transition: { ...tx({ duration: 0.52, ease: [0.5, 0, 0.2, 1] }), opacity: tx({ duration: 0.52, ease: 'linear', times: [0, 0.6, 1] }) } }
      : { opacity: 0, scale: 0.97, y: 4, transition: tx({ duration: 0.16, ease: 'out' }) }),
  };

  return (
    <AppWindow ref={winRef} title={`Configuration de ${appName}`} width={SETUP_W} height={SETUP_H} material="floating" controls={['close']} showTitle={false} onClose={onClose}
      className="jr-setup-window" custom={fold} variants={variants} exit="out">
      <div className="jr-setup" data-step={step} data-ft-page={page}>
        {/* The faint veil of the question's colour, one per screen so colours cross-fade. */}
        <AnimatePresence initial={false}>
          <motion.span key={page} className="ft-page-veil jr-veil" data-ft-page={page} aria-hidden="true"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={tx(0.32)} />
        </AnimatePresence>
        <div className="jr-nav">
          {isQuestion && (
            <>
              <Button variant="ghost" size="sm" className="jr-back" onClick={back} icon={<ChevronLeft {...ICON} />}>Retour</Button>
              <Dots index={qIndex} />
              <Button variant="ghost" size="sm" className="jr-skip" onClick={skip}>{SKIP[step]}</Button>
            </>
          )}
        </div>

        <div className="jr-screens">
          <AnimatePresence initial={false} custom={dir}>
            <motion.section key={step} data-screen={step} data-ft-page={page} className="jr-screen" {...stepMotion(TRANSITION, dir, reduced, tx)}>
              {/* Our ScrollArea (thin overlay thumb, edge fades), never the native grey scrollbar. */}
              <ScrollArea className="jr-scroll" viewportClassName="jr-scroll-vp">
                <div className="jr-screen-in">
                  {HEAD[step] && <ScreenHead step={step} />}
                  <div className="jr-body">{body}</div>
                </div>
              </ScrollArea>
            </motion.section>
          </AnimatePresence>
        </div>

        <footer className="jr-foot">
          {step === 'pret' && <Button size="xl" className="jr-secondary" onClick={onFinish}>Fermer</Button>}
          <Button ref={primaryRef} variant="primary" size="xl" className="jr-primary" onClick={primary} disabled={primaryDisabled}
            iconEnd={step === 'pret' ? <Settings2 {...ICON} size={18} /> : step === 'welcome' ? <ArrowRight {...ICON} size={18} /> : step === 'demo' ? <Play {...ICON} size={18} /> : null}>
            {PRIMARY[step]}
          </Button>
          {/* Always there (empty when there is nothing to say) so the big button never moves. */}
          <span className="jr-foot-note" aria-live="polite">
            {step === 'welcome' ? '3 questions et une courte démo, environ une minute.'
              : step === 'modele' && primaryDisabled ? 'Continuer dès que la connexion est vérifiée.'
                : ' '}
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
    <motion.div className="jr-toast ft-glass" role="status" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} transition={tx('smooth')}>
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
  const s = STOPS.find(x => x.id === stop);
  return (
    <div className="jr-labbar" role="toolbar" aria-label="Commandes du parcours">
      <div className="lab-field"><span className="lab-field-label">Écran</span>
        <Seg label="Aller à l’écran" value={stop} options={STOPS} onChange={onJump} />
      </div>
      {s && <Vote id={`journey.screen.${s.id}`} label={s.vote} section="journey" compact />}
      {stop === 'modele' && <button type="button" className="lab-btn" onClick={onPrefill}>Préremplir l’exemple</button>}
      <span className="jr-labbar-sep" aria-hidden="true" />
      <span className="jr-labbar-note">Vos choix : fondu et échelle · battement et anneau · repli vers la barre des tâches</span>
    </div>
  );
}

// ——— The journey ———
export default function Journey() {
  const tx = useTx();
  const [phase, setPhase] = useState('installer'); // installer | setup | folding | demo | settings | desktop
  const [step, setStep] = useState('welcome');
  const [dir, setDir] = useState(1);
  const [state, setState] = useState(initialSetup);
  const [pendingSetup, setPendingSetup] = useState(false);
  const [toast, setToast] = useState(false);
  const [settingsKey, setSettingsKey] = useState(0);
  const [fold, setFold] = useState(null);       // the fold target while the setup folds into the tray
  const recording = useRef(false);
  const primaryRef = useRef(null);
  const launchRef = useRef(null);
  const lockUntil = useRef(0);
  const foldCtrl = useRef(null);

  const patch = useCallback(p => setState(s => ({ ...s, ...p })), []);
  const locked = () => {
    const now = performance.now();
    if (now < lockUntil.current) return true;
    lockUntil.current = now + NAV_LOCK_MS * clock.t;
    return false;
  };

  const go = useCallback((to, d, force) => {
    if (!force && locked()) return;
    setStep(cur => { setDir(d ?? (STEPS.indexOf(to) >= STEPS.indexOf(cur) ? 1 : -1)); return to; });
  }, []);
  const next = useCallback((foldTarget) => {
    if (step === 'demo') {
      if (locked()) return;
      setFold(foldTarget || null);
      setPhase('folding');
      return;
    }
    const i = STEPS.indexOf(step);
    if (i < STEPS.length - 1) go(STEPS[i + 1], 1);
  }, [step, go]);
  const back = useCallback(() => {
    const i = STEPS.indexOf(step);
    if (i > 0 && step !== 'pret') go(STEPS[i - 1], -1);
  }, [step, go]);

  // The setup has folded into the tray (its exit is over): let the icon pulse, then the demo.
  const onFolded = useCallback(() => {
    if (phase !== 'folding') return;
    foldCtrl.current?.abort();
    const c = new AbortController(); foldCtrl.current = c;
    wait(320, c.signal).then(ok => { if (ok) { setFold(null); setPhase('demo'); } });
  }, [phase]);
  useEffect(() => () => foldCtrl.current?.abort(), []);
  const cancelFold = () => { foldCtrl.current?.abort(); setFold(null); };

  const onDemoDone = useCallback(() => { setDir(1); setStep('pret'); setPhase('setup'); }, []);
  const openSettings = useCallback(() => { cancelFold(); setToast(false); setPendingSetup(false); setSettingsKey(k => k + 1); setPhase('settings'); }, []);

  // Focus: the heading of each screen (no ring, read first by a screen reader; Enter still presses
  // the big button), the address field on « Votre modèle ».
  useEffect(() => {
    if (phase !== 'setup') return undefined;
    const c = new AbortController();
    wait(step === 'welcome' ? 700 : 380, c.signal).then(ok => {
      if (!ok) return;
      const target = step === 'modele'
        ? document.querySelector('.jr-screen[data-screen="modele"] .ft-connection input')
        : document.querySelector(`.jr-screen[data-screen="${step}"] :is(.jr-title, .jr-hero)`);
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
      if (t?.closest?.('.lab-bar, .jr-labbar, .lab-toolbar')) return;
      if (e.key === 'Escape') { e.preventDefault(); if (!e.repeat) back(); return; }
      if (e.key === 'Enter') {
        if (t?.closest?.('button, a, [role="combobox"], [role="radio"], textarea')) return; // native activation
        e.preventDefault();
        if (!e.repeat) primaryRef.current?.click();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, back]);

  const jump = id => {
    setToast(false);
    cancelFold();
    lockUntil.current = 0;
    if (id === 'installer') { setPhase('installer'); setStep('welcome'); return; }
    if (id === 'reglages') { openSettings(); return; }
    go(id, undefined, true);
    setPhase('setup');
  };
  const stop = phase === 'setup' ? step : phase === 'installer' ? 'installer' : phase === 'settings' ? 'reglages' : (phase === 'demo' || phase === 'folding') ? 'demo' : '';
  const prefill = () => patch({ conn: { url: 'llm.exemple.com/v1', key: 'sk-labo-7f3a9c2e', noKey: false, model: '' } });
  const onTray = () => {
    if (phase === 'folding' || phase === 'demo') return; // the demo owns the desktop
    if (phase === 'settings') { setPhase('desktop'); return; }
    if (pendingSetup) { setPendingSetup(false); setPhase('setup'); return; }
    if (phase === 'desktop') openSettings();
  };
  const setRecording = useCallback(v => { recording.current = v; }, []);
  const focus = phase === 'settings' ? { w: 860, h: 600 } : phase === 'demo' ? { w: 900, h: 740 } : { w: SETUP_W, h: SETUP_H };

  return (
    <div className="jr-root" data-phase={phase}>
      <div className="jr-scope">
        <Stage focus={focus} onTray={onTray} trayActive={['settings', 'setup', 'folding'].includes(phase)} trayBadge={pendingSetup}>
          <AnimatePresence mode="wait" custom={fold} onExitComplete={onFolded}>
            {phase === 'installer' && (
              <Installer key="installer" launchRef={launchRef}
                onLaunch={() => { setStep('welcome'); setDir(1); setPhase('setup'); }}
                onClose={() => { setPendingSetup(true); setPhase('desktop'); }} />
            )}
            {phase === 'setup' && (
              <SetupWindow key="setup" step={step} dir={dir} state={state} patch={patch} go={go} next={next} back={back} fold={fold}
                onClose={() => { setPendingSetup(step !== 'pret'); setPhase('desktop'); }}
                onOpenSettings={openSettings}
                onFinish={() => { setPhase('desktop'); setToast(true); }}
                setRecording={setRecording} primaryRef={primaryRef} />
            )}
            {phase === 'demo' && <Demo key="demo" onDone={onDemoDone} shortcut={state.shortcut} />}
            {phase === 'settings' && (
              <SettingsWindow key={`settings-${settingsKey}`} initialPage="general" onClose={() => setPhase('desktop')}
                onReplaySetup={() => jump('welcome')}
                initialServer={carriedServer(state.conn)} initialSettings={carriedSettings(state)} />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {phase === 'desktop' && toast && <Toast key="toast" shortcut={state.shortcut} onOpen={openSettings} onDismiss={() => setToast(false)} />}
            {phase === 'desktop' && !toast && (
              <motion.p key="hint" className="jr-desk-hint ft-glass" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={tx(0.3, { delay: 0.4 })}>
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
