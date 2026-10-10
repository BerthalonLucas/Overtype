import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, ChevronLeft, Keyboard, Palette, Play, Server, Settings2, X, type LucideIcon } from 'lucide-react';
import { appName } from '../brand';
import { bridge } from '../bridge';
import { Button, ICON, IconButton, Notice, Spinner } from '../components/controls';
import { useReduced, useTx } from '../components/motion';
import { ScrollArea } from '../components/scroll';
import { TitleBar } from '../components/TitleBar';
import { DiagnosticsPanel, type DiagnosticsLanding } from '../connection/DiagnosticsPanel';
import { Demo } from '../demo/Demo';
import { Wallpaper } from '../demo/Wallpaper';
import { withLanguage } from '../actionDefaults';
import { t as tNow, useT, type MessageKey } from '../i18n';
import { shortcutKeys } from '../settings/ShortcutRecorder';
import { useRegistrations } from '../settings/registrations';
import type { DemoEnded, Language, ProbeProblem, Theme } from '../types';
import { useSettings } from '../useSettings';
import {
  canContinue,
  createNavLock,
  direction,
  isQuestion,
  isSetupStep,
  nextStep,
  ownsKey,
  previousStep,
  primaryBinding,
  setupQuestions,
  stepPage,
  type SetupQuestion,
  type SetupStep,
} from './model';
import { DemoIntroScreen, DoneMark, Heartbeat, LookScreen, ModelScreen, Recap, ShortcutScreen } from './screens';
import { useSetupSettings } from './useSetupSettings';
import '../components/tokens.css';
import '../components/base.css';
import '../components/controls.css';
import '../settings/settings.css';
import './setup.css';

/*
 * The first run (docs/PLAN-0.6.md §3 and §4.1; design-lab/reglages/src/journey/Journey.jsx): a
 * frosted window, iPhone-like. Welcome (the mark beats, a ring leaves on each beat), three
 * questions, one per screen, each in the colour of its topic (Appearance, Shortcut, Your model),
 * « Fondu et échelle » between them, then the demo, then « C'est prêt » → the Settings.
 * Every answer is saved at once in the real settings.
 *
 *   /?window=setup              the setup (`&replay=1`: « Revoir l'accueil »)
 *   /?window=setup&stage=demo   the demo alone: natively a window of its own (bridge.openDemo),
 *                               while the setup hides until `demo-ended`
 *   &step=<id>                  browser preview only: opens on that screen (captures, tests)
 *
 * Nothing stays stuck: a screen change locks the navigation for 300 ms (a double click or a held
 * Enter moves by one screen); Enter is the big button, Escape goes back (never closes); a demo
 * that cannot open, or that never reports its end, gives the setup back; closing the window before
 * the end changes nothing (it opens again at the next launch).
 */

const head: Record<SetupQuestion, { icon: LucideIcon; title: MessageKey; text: MessageKey }> = {
  appearance: { icon: Palette, title: 'setup.look.title', text: 'setup.look.text' },
  shortcut: { icon: Keyboard, title: 'setup.shortcut.title', text: 'setup.shortcut.text' },
  model: { icon: Server, title: 'setup.model.title', text: 'setup.model.text' },
  demo: { icon: Play, title: 'setup.demo.title', text: 'setup.demo.text' },
};
const primaryLabel: Record<SetupStep, MessageKey> = {
  welcome: 'setup.welcome.start',
  appearance: 'setup.continue',
  shortcut: 'setup.continue',
  model: 'setup.continue',
  demo: 'setup.demo.start',
  ready: 'setup.ready.open',
};
const skipLabel: Record<SetupQuestion, MessageKey> = {
  appearance: 'setup.skip',
  shortcut: 'setup.skip',
  model: 'setup.later',
  demo: 'setup.demo.skip',
};
// The window is 620 × 720 (src-tauri: SETUP_SIZE); smaller screens get a smaller window, whose
// screens scroll.
const SIZE = { width: 620, height: 720 };
// Natively the demo reports its end (`demo-ended`); Rust's own watchdog is 60 s. If even that
// word never comes, the setup takes itself back.
const DEMO_WATCHDOG_MS = 75_000;
// Enter presses the big button once the screen has been there this long, and only after this
// long without another Enter: a key mashed or held never skips a question.
export const ENTER_SETTLE_MS = 500;
export const ENTER_PAUSE_MS = 600;
const FOLD_MS = 520;

// Browser preview only (captures, tests): `&lang=fr|en`, `&theme=light|dark|system` and
// `&motion=full|reduced` set the simulated settings before the first render.
if (!bridge.native) {
  const params = new URLSearchParams(location.search);
  const lang = params.get('lang'),
    theme = params.get('theme'),
    motion = params.get('motion');
  const patch = {
    ...(lang === 'fr' || lang === 'en' ? ({ language: lang } as const) : {}),
    ...(theme === 'light' || theme === 'dark' || theme === 'system' ? ({ theme } as const) : {}),
    ...(motion === 'full' || motion === 'reduced' ? ({ motion } as const) : {}),
  };
  if (params.get('window') === 'setup' && Object.keys(patch).length)
    void bridge
      .getSettings()
      .then((settings) => bridge.saveSettings({ ...settings, ...patch }))
      .catch(() => undefined);
}

export function SetupWindow() {
  const params = useMemo(() => new URLSearchParams(location.search), []);
  return params.get('stage') === 'demo' ? <DemoStage /> : <Setup initial={params.get('step')} />;
}

// The demo's own window: it plays, then tells Rust how it ended (the setup comes back).
function DemoStage() {
  const settings = useSettings();
  const onDone = useCallback((done: boolean) => {
    void bridge
      .closeDemo(done)
      .catch(() => undefined)
      .then(() => {
        if (!bridge.native) location.assign('?window=setup&step=ready');
      });
  }, []);
  // The settings decide the names, the shortcut and the style: the demo waits for them, briefly.
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setWaited(true), 1500);
    return () => window.clearTimeout(timer);
  }, []);
  if (!settings && !waited) return null;
  return <Demo settings={settings} onDone={onDone} />;
}

type Phase = 'setup' | 'leaving' | 'demo';

function Setup({ initial }: { initial: string | null }) {
  const t = useT();
  const tx = useTx();
  const reduced = useReduced();
  const store = useSetupSettings(useCallback(() => tNow('setup.notSaved'), []));
  const { settings } = store;
  const registrations = useRegistrations();
  const [step, setStep] = useState<SetupStep>(() => (!bridge.native && isSetupStep(initial) ? initial : 'welcome'));
  const [dir, setDir] = useState<1 | -1>(1);
  const [phase, setPhase] = useState<Phase>('setup');
  const [modelReady, setModelReady] = useState(false);
  const [log, setLog] = useState<DiagnosticsLanding | null>(null);
  const [demoFailed, setDemoFailed] = useState(false);
  const [closing, setClosing] = useState(false);
  const [finishFailed, setFinishFailed] = useState(false);
  const [fold, setFold] = useState<{ x: number; y: number } | null>(null);
  const lock = useRef(createNavLock()).current;
  const primaryRef = useRef<HTMLButtonElement>(null);
  const stepNow = useRef(step);
  stepNow.current = step;
  const phaseNow = useRef(phase);
  phaseNow.current = phase;

  useEffect(() => {
    document.title = t('setup.windowTitle', { app: appName });
  }, [t]);

  const go = useCallback(
    (to: SetupStep, force = false) => {
      if (!force && lock.locked()) return;
      setDir(direction(stepNow.current, to));
      setStep(to);
    },
    [lock],
  );
  const back = useCallback(() => {
    const to = previousStep(stepNow.current);
    if (to !== stepNow.current) go(to);
  }, [go]);

  // ——— The demo ———
  // The window steps aside (its own fade), then the demo plays: natively in its own window
  // (Rust hides this one), in the preview in place of this one.
  const startDemo = useCallback(async () => {
    if (phaseNow.current !== 'setup' || lock.locked()) return;
    setDemoFailed(false);
    const folds = !bridge.native && !reduced;
    setFold(folds ? { x: window.innerWidth / 2 - 96, y: window.innerHeight / 2 - 24 } : null);
    setPhase('leaving');
    await store.flush();
    await new Promise((resolve) => window.setTimeout(resolve, reduced ? 0 : folds ? FOLD_MS + 120 : 180));
    try {
      await bridge.openDemo();
      if ((phaseNow.current as Phase) === 'leaving') setPhase('demo');
    } catch {
      // The demo could not open: the question stays, and says so. « Passer la démo » goes on.
      setPhase('setup');
      setDemoFailed(true);
    }
  }, [lock, store, reduced]);
  const endDemo = useCallback(() => {
    if (phaseNow.current === 'setup') return;
    lock.release();
    setFold(null);
    setPhase('setup');
    setDir(1);
    setStep('ready');
  }, [lock]);
  useEffect(() => {
    let live = true;
    let off: (() => void) | undefined;
    void bridge
      .on<DemoEnded>('demo-ended', () => {
        if (live) endDemo();
      })
      .then(
        (unlisten) => {
          if (live) off = unlisten;
          else unlisten();
        },
        () => undefined,
      );
    return () => {
      live = false;
      off?.();
    };
  }, [endDemo]);
  useEffect(() => {
    if (phase !== 'demo') return;
    const timer = window.setTimeout(() => {
      void bridge.closeDemo(false).catch(() => undefined);
      endDemo();
    }, DEMO_WATCHDOG_MS);
    return () => window.clearTimeout(timer);
  }, [phase, endDemo]);

  // ——— The end ———
  const finish = useCallback(
    async (openSettings: boolean) => {
      if (closing || lock.locked()) return;
      setClosing(true);
      setFinishFailed(false);
      await store.flush();
      try {
        await bridge.finishSetup(openSettings);
        if (!bridge.native && !openSettings) location.assign('/');
      } catch {
        // Refused (the file could not be written): said under the button, which works again.
        setClosing(false);
        setFinishFailed(true);
        lock.release();
      }
    },
    [closing, lock, store],
  );
  // « C'est prêt » is the end: the setup is done from here, however the window is closed (its
  // cross used to bring the whole setup back at the next launch, the server already saved).
  useEffect(() => {
    if (step !== 'ready' || !settings) return;
    setFinishFailed(false);
    void store
      .flush()
      .then(() => bridge.completeSetup())
      .catch(() => undefined);
  }, [step, settings !== null]); // eslint-disable-line react-hooks/exhaustive-deps
  const closeWindow = useCallback(async () => {
    await store.flush();
    void bridge.closeSettings().catch(() => undefined);
  }, [store]);

  const primaryDisabled = !canContinue(step, modelReady) || closing;
  const primary = useCallback(() => {
    if (primaryDisabled) return;
    if (step === 'ready') void finish(true);
    else if (step === 'demo') void startDemo();
    else go(nextStep(step));
  }, [primaryDisabled, step, finish, startDemo, go]);
  const skip = () => {
    if (step === 'demo') go('ready');
    else go(nextStep(step));
  };
  useEffect(() => {
    if (step !== 'model') {
      setLog(null);
      setModelReady(false);
    }
    if (step !== 'demo') setDemoFailed(false);
  }, [step]);

  // Theme and language apply at once (the document follows the shared settings), then are saved.
  const setTheme = (theme: Theme) => {
    if (!settings || theme === settings.theme) return;
    const apply = () => store.persist({ ...settings, theme }, true);
    const transition = (document as Document & { startViewTransition?: (run: () => void) => unknown })
      .startViewTransition;
    if (!reduced && typeof transition === 'function') {
      try {
        transition.call(document, () => flushSync(apply));
        return;
      } catch {
        /* plain change below */
      }
    }
    apply();
  };
  // The default actions nobody renamed follow the language (« Corriger » / « Fix grammar »).
  const setLanguage = (language: Language) => {
    if (settings && language !== settings.language) store.persist(withLanguage(settings, language), true);
  };

  // Focus: each screen's heading (read first by a screen reader; Enter still presses the big
  // button), the address field on « Votre modèle ».
  useEffect(() => {
    if (phase !== 'setup' || !settings) return;
    const timer = window.setTimeout(
      () => {
        const screen = document.querySelector(`.su-screen[data-screen="${step}"]`);
        const target =
          (step === 'model' ? screen?.querySelector('.ft-connection input') : null) ??
          screen?.querySelector('.su-title, .su-hero');
        if (target instanceof HTMLElement && !(target as HTMLInputElement).disabled)
          target.focus({ preventScroll: true });
      },
      step === 'welcome' ? 700 : 380,
    );
    return () => window.clearTimeout(timer);
  }, [phase, step, settings !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  // Enter = the big button, Escape = Retour: never while a shortcut is being recorded, a list is
  // open, or the journal shows (Escape then closes the journal). Enter mashed (twelve presses
  // rushed through the welcome and two questions unseen, 02/10) moves by one screen: it counts
  // only on a screen that had the time to show, and after a pause since the previous Enter.
  const shownAt = useRef(0);
  const lastEnter = useRef(-Infinity);
  useEffect(() => {
    shownAt.current = performance.now();
  }, [step]);
  useEffect(() => {
    if (phase !== 'setup') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey || event.isComposing) return;
      if (event.key !== 'Escape' && event.key !== 'Enter') return;
      if (document.querySelector('[data-recording]')) return;
      const target = event.target instanceof Element ? event.target : null;
      if (log) {
        if (event.key === 'Escape' && !ownsKey(target, 'Escape')) {
          event.preventDefault();
          setLog(null);
        }
        return;
      }
      if (ownsKey(target, event.key) || document.querySelector('[data-radix-popper-content-wrapper], .ft-dialog'))
        return;
      event.preventDefault();
      if (event.repeat) return;
      if (event.key === 'Escape') {
        back();
        return;
      }
      const now = performance.now();
      const deliberate = now - lastEnter.current >= ENTER_PAUSE_MS && now - shownAt.current >= ENTER_SETTLE_MS;
      lastEnter.current = now;
      if (deliberate) primaryRef.current?.click();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, back, log]);

  const page = stepPage[step];
  const question = isQuestion(step) ? step : null;
  const keys = settings ? shortcutKeys(primaryBinding(settings)?.shortcut ?? '', t) : [];
  const openLog = (problem: ProbeProblem | null, run: string | null) =>
    setLog({ filter: 'errors', logId: problem?.logId, run, at: Date.now() });

  let body: React.ReactNode = null;
  if (settings) {
    body =
      step === 'welcome' ? (
        <div className="su-welcome">
          <motion.span
            className="su-welcome-mark"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={tx('bouncy', { delay: 0.15 })}
          >
            <Heartbeat size={88} />
          </motion.span>
          <motion.h1
            className="su-hero"
            tabIndex={-1}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={tx('smooth', { delay: 0.3 })}
          >
            {t('setup.welcome.title', { app: appName })}
          </motion.h1>
          <motion.p
            className="su-sub"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={tx('smooth', { delay: 0.38 })}
          >
            {t('setup.welcome.text')}
          </motion.p>
        </div>
      ) : step === 'appearance' ? (
        <LookScreen theme={settings.theme} language={settings.language} onTheme={setTheme} onLanguage={setLanguage} />
      ) : step === 'shortcut' ? (
        <ShortcutScreen store={store} settings={settings} registrations={registrations} />
      ) : step === 'model' ? (
        <ModelScreen store={store} settings={settings} onReady={setModelReady} onOpenLog={openLog} />
      ) : step === 'demo' ? (
        <DemoIntroScreen keys={keys} problem={demoFailed} />
      ) : (
        <div className="su-done">
          <DoneMark />
          <h1 className="su-hero" tabIndex={-1}>
            {t('setup.ready.title')}
          </h1>
          <p className="su-sub">{t('setup.ready.text')}</p>
          <Recap settings={settings} onEdit={(to) => go(to)} />
        </div>
      );
  }
  // « Fondu et échelle »: the screen leaves growing a little, the next one enters from 96 %; in
  // place, no travel. Reduced motion: a short fade.
  const screenMotion = reduced
    ? {
        variants: { enter: { opacity: 0 }, center: { opacity: 1 }, exit: { opacity: 0 } },
        transition: tx({ duration: 0.16, ease: 'out' }),
      }
    : {
        variants: {
          enter: (d: number) => ({ opacity: 0, scale: d > 0 ? 0.96 : 1.03 }),
          center: { opacity: 1, scale: 1 },
          exit: (d: number) => ({
            opacity: 0,
            scale: d > 0 ? 1.03 : 0.96,
            transition: tx({ duration: 0.18, ease: 'out' }),
          }),
        },
        transition: tx('smooth', { delay: 0.06 }),
      };

  // The preview has no window of its own: it paints a desktop and plays the demo in place.
  if (phase === 'demo' && !bridge.native)
    return (
      <Demo
        settings={settings}
        onDone={(done) => {
          void bridge.closeDemo(done).catch(() => endDemo());
        }}
      />
    );

  const native = bridge.native;
  const Head = question ? head[question].icon : null;
  // How the window leaves. For the demo, in the preview, it folds towards the taskbar's corner
  // (the lab's « Repli vers la barre des tâches »); natively Windows hides the window itself, the
  // page only fades. AnimatePresence hands `fold` to the leaving window.
  const exits = {
    out: (folding: { x: number; y: number } | null) =>
      folding && !native && !reduced
        ? {
            opacity: [1, 1, 0],
            scale: 0.06,
            x: folding.x,
            y: folding.y,
            transition: {
              duration: FOLD_MS / 1000,
              ease: [0.5, 0, 0.2, 1] as [number, number, number, number],
              opacity: { duration: FOLD_MS / 1000, ease: 'linear' as const, times: [0, 0.6, 1] },
            },
          }
        : native || reduced
          ? { opacity: 0, transition: tx({ duration: 0.16, ease: 'out' }) }
          : { opacity: 0, scale: 0.97, y: 4, transition: tx({ duration: 0.16, ease: 'out' }) },
  };
  return (
    <div className="su-desk ft-scope" data-native={native ? '' : undefined} data-phase={phase}>
      {!native && <Wallpaper />}
      <AnimatePresence custom={fold}>
        {phase === 'setup' && (
          <motion.div
            key="window"
            className="ft-window su-window"
            data-material="floating"
            role="dialog"
            aria-label={t('setup.windowTitle', { app: appName })}
            style={native ? undefined : { width: SIZE.width, height: SIZE.height }}
            initial={native ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            variants={exits}
            custom={fold}
            exit="out"
            transition={tx('window')}
          >
            <div className="su-setup" data-step={step} data-ft-page={page}>
              {/* The faint veil of the question's colour, one per screen so colours cross-fade. */}
              <AnimatePresence initial={false}>
                <motion.span
                  key={page}
                  className="ft-page-veil su-veil"
                  data-ft-page={page}
                  aria-hidden="true"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={tx(0.32)}
                />
              </AnimatePresence>
              <div className="su-nav">
                {question && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="su-back"
                      onClick={back}
                      icon={<ChevronLeft {...ICON} />}
                    >
                      {t('setup.back')}
                    </Button>
                    <span
                      className="su-dots"
                      role="img"
                      aria-label={t('setup.progress', {
                        n: setupQuestions.indexOf(question) + 1,
                        total: setupQuestions.length,
                      })}
                    >
                      {setupQuestions.map((id, index) => (
                        <i key={id} data-done={index < setupQuestions.indexOf(question) ? '' : undefined} />
                      ))}
                      <motion.b
                        className="su-dots-on"
                        initial={false}
                        animate={{ x: setupQuestions.indexOf(question) * 16 }}
                        transition={tx('snappy')}
                      />
                    </span>
                    <Button variant="ghost" size="sm" className="su-skip" onClick={skip}>
                      {t(skipLabel[question])}
                    </Button>
                  </>
                )}
              </div>

              <div className="su-screens">
                {!settings && (
                  <div className="su-loading" role={store.loadError ? 'alert' : 'status'}>
                    {store.loadError ? (
                      <Notice
                        kind="error"
                        title={t('setup.loadError')}
                        action={
                          <Button size="sm" onClick={store.load}>
                            {t('common.retry')}
                          </Button>
                        }
                      />
                    ) : (
                      <>
                        <Spinner size={18} />
                        <span>{t('setup.loading')}</span>
                      </>
                    )}
                  </div>
                )}
                <AnimatePresence initial={false} custom={dir}>
                  {settings && (
                    <motion.section
                      key={step}
                      data-screen={step}
                      data-ft-page={page}
                      className="su-screen"
                      custom={dir}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      {...screenMotion}
                    >
                      {/* Our ScrollArea (thin overlay thumb, edge fades), never the native grey scrollbar. */}
                      <ScrollArea className="su-scroll" viewportClassName="su-scroll-vp">
                        <div className="su-screen-in">
                          {question && Head && (
                            <header className="su-head">
                              <span className="su-head-icon" aria-hidden="true">
                                <Head {...ICON} />
                              </span>
                              <h1 className="su-title" tabIndex={-1}>
                                {t(head[question].title, { app: appName })}
                              </h1>
                              <p className="su-sub">{t(head[question].text, { app: appName })}</p>
                            </header>
                          )}
                          <div className="su-body">{body}</div>
                        </div>
                      </ScrollArea>
                    </motion.section>
                  )}
                </AnimatePresence>
              </div>

              <footer className="su-foot">
                {step === 'ready' && (
                  <Button size="xl" className="su-secondary" disabled={closing} onClick={() => void finish(false)}>
                    {t('setup.ready.close')}
                  </Button>
                )}
                <Button
                  ref={primaryRef}
                  variant="primary"
                  size="xl"
                  className="su-primary"
                  onClick={primary}
                  disabled={primaryDisabled || !settings}
                  iconEnd={
                    step === 'ready' ? (
                      <Settings2 {...ICON} size={18} />
                    ) : step === 'welcome' ? (
                      <ArrowRight {...ICON} size={18} />
                    ) : step === 'demo' ? (
                      <Play {...ICON} size={18} />
                    ) : null
                  }
                >
                  {t(primaryLabel[step])}
                </Button>
                {/* Always there (empty when there is nothing to say) so the big button never moves. */}
                <span className="su-foot-note" aria-live="polite">
                  {finishFailed ? (
                    <span role="alert">
                      {t('setup.notFinished')}{' '}
                      <button type="button" className="ft-linklike" onClick={() => void finish(true)}>
                        {t('common.retry')}
                      </button>
                    </span>
                  ) : store.saveError ? (
                    <>
                      {t('setup.notSaved')}{' '}
                      <button type="button" className="ft-linklike" onClick={store.retry}>
                        {t('common.retry')}
                      </button>
                    </>
                  ) : step === 'welcome' ? (
                    t('setup.welcome.note')
                  ) : step === 'model' && !modelReady ? (
                    t('setup.model.wait')
                  ) : (
                    ' '
                  )}
                </span>
              </footer>

              <AnimatePresence>
                {log && (
                  <motion.div
                    key="log"
                    className="su-log-layer"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={tx(0.18)}
                  >
                    <button
                      type="button"
                      className="su-log-scrim"
                      aria-label={t('setup.model.logClose')}
                      tabIndex={-1}
                      onClick={() => setLog(null)}
                    />
                    <motion.div
                      className="su-log-sheet"
                      role="dialog"
                      aria-label={t('setup.model.log')}
                      data-ft-page="diagnostic"
                      initial={{ y: 40, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: 30, opacity: 0 }}
                      transition={tx('smooth')}
                    >
                      <div className="su-log-head">
                        <strong>{t('setup.model.log')}</strong>
                        <IconButton
                          label={t('setup.model.logClose')}
                          size="sm"
                          round
                          autoFocus
                          onClick={() => setLog(null)}
                        >
                          <X {...ICON} />
                        </IconButton>
                      </div>
                      <ScrollArea className="su-log-scroll">
                        <DiagnosticsPanel landing={log} limit={40} />
                      </ScrollArea>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <TitleBar
              onDrag={() => {
                void bridge.dragWindow().catch(() => undefined);
              }}
              onClose={() => void closeWindow()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
