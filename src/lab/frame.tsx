import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SettingsWindow } from '../settings/SettingsWindow';
import { HaloScene } from '../halo/HaloWindow';
import { GlassOverlay } from '../GlassOverlay';
import { useTranslation } from '../useTranslation';
import { bridge } from '../bridge';
import { ilotScenarioFrom, resultScenarioFrom, scenarioFrom } from './scenarios';
import { IlotFixture } from './ilot';
import { ResultFixture } from './result';
import { setLanguage } from '../i18n';
import '../theme.css';
import { MotionPreferences } from '../motion/MotionPreferences';
import { applyMotion } from '../motion/preference';
import { applyMotionPreset } from '../motion/tokens';
import { indicatorOf } from '../loaders/pill';
import type { HaloEvent, MotionPreference, MotionPreset, Rect } from '../types';
import '../styles.css';
import '../glass.css';

const params = new URLSearchParams(location.search);
const scenario = scenarioFrom(params.get('scenario')).id;
const theme = params.get('theme') === 'light' ? 'light' : 'dark';
// motion=reduce|full forces the setting « Animations »; without it the frame follows the system.
const motion: MotionPreference =
  params.get('motion') === 'reduce' ? 'reduced' : params.get('motion') === 'full' ? 'full' : 'system';
const preset: MotionPreset = params.get('preset') === 'bouncy' ? 'bouncy' : 'smooth';
// Every scenario opens in the Îlot journey, the app's default; ui=v4 asks for the 0.4 journey
// (read by the preview bridge, src/bridge.ts). working-<indicator>: the Îlot's working pill
// (lot 8) on a request that never answers, in the Îlot whatever the URL says.
const indicator = scenario.startsWith('working-') ? indicatorOf(scenario.slice('working-'.length)) : null;

function OverlayFixture() {
  const controller = useTranslation();
  const begun = useRef(false);
  useEffect(() => {
    // Start only after the real hook has installed its listeners and loaded settings.
    if (!controller.settings || begun.current) return;
    begun.current = true;
    if (scenario === 'notice') {
      // What Rust emits when the shortcut finds nothing: repeated so the reference stays visible.
      const show = () => bridge.demoNotice('Rien à traduire dans la fenêtre active.');
      show();
      const timer = window.setInterval(show, 3000);
      return () => window.clearInterval(timer);
    }
    const capture = {
      id: `lab-${scenario}`,
      text:
        scenario === 'long'
          ? 'Please review the updated proposal. '.repeat(20)
          : 'Could you send the updated proposal before Thursday?',
      source: 'selection' as const,
      canReplace: true,
      anchor: { x: 400, y: 300, width: 20, height: 16 },
    };
    if (params.get('screen')) {
      // A screen other than the viewport (e.g. 2560x1400): what Rust would send with the capture.
      const [width, height] = params.get('screen')!.split('x').map(Number);
      Object.assign(capture, { screen: { width, height, scale: 1 } });
    }
    bridge.setDemoCapture(
      capture,
      indicator
        ? 'pending'
        : scenario === 'long' || scenario === 'error' || scenario === 'pending' || scenario === 'partial'
          ? scenario
          : 'normal',
    );
    controller.receiveCapture(capture);
  }, [controller]);
  return (
    <div className="standalone-demo" data-preview-background={theme} data-lab-phase={controller.state.phase}>
      <GlassOverlay controller={controller} />
    </div>
  );
}

// The halo over three lines of demonstration text, with the rectangles the page lays out
// (what UI Automation gives Rust in the real window): the text box, the whole lines, the
// selection (from « send » to « and the »), the changed words. phase=menu|work|marks (work by
// default), drawn by the halo itself in the frame's theme.
function HaloFixture() {
  const text = useRef<HTMLDivElement>(null);
  const [run, setRun] = useState<HaloEvent | null>(null);
  useEffect(() => {
    const root = text.current;
    if (!root) return;
    const rect = (node: Element): Rect => {
      const box = node.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    };
    const rects = (selector: string): Rect[] => [...root.querySelectorAll(selector)].map(rect);
    const textBox = rect(root);
    const phase =
      params.get('phase') === 'menu' || params.get('phase') === 'marks'
        ? (params.get('phase') as 'menu' | 'marks')
        : 'work';
    const base = { generation: 1, tone: theme, ground: null, width: innerWidth, height: innerHeight } as const;
    setRun(
      phase === 'marks'
        ? { ...base, phase, lines: rects('.lab-word'), whole: rects('.lab-line'), full: [], textBox: null }
        : { ...base, phase, lines: rects('.lab-exact'), full: rects('.lab-line'), textBox, whole: [] },
    );
  }, []);
  return (
    <div className="standalone-demo" data-preview-background={theme}>
      <div
        ref={text}
        className="lab-field"
        style={{ font: '18px/28px "Segoe UI", sans-serif', color: 'var(--text)', padding: '14px 18px', width: 460 }}
      >
        <span className="lab-line">
          Could you{' '}
          <span className="lab-exact">
            send the <span className="lab-word">revised</span> proposal
          </span>
        </span>
        <br />
        <span className="lab-line">
          <span className="lab-exact">
            before Thursday, with the <span className="lab-word">delivery</span> timeline
          </span>
        </span>
        <br />
        <span className="lab-line">
          <span className="lab-exact">and the</span> payment terms?
        </span>
      </div>
      {run && <HaloScene run={run} state="shown" />}
    </div>
  );
}

async function mount() {
  if (!import.meta.env.DEV || bridge.native) return;
  // The defect reproduction must not hide the production document background.
  if (params.get('surface') !== 'production') document.documentElement.style.colorScheme = theme;
  // The app's tokens follow data-theme (src/theme.css): the scenario's theme is the app's.
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.labScenario = scenario;
  applyMotion(motion);
  applyMotionPreset(preset);
  const ilotScenario = ilotScenarioFrom(params.get('scenario'));
  if (ilotScenario) {
    // The Îlot alone (lot 7), on the overlay's page style.
    document.documentElement.dataset.labScenario = ilotScenario.id;
    setLanguage(params.get('lang') === 'fr' ? 'fr' : 'en');
    document.body.className = 'flowtranslate-window flowtranslate-overlay';
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <MotionPreferences motion={motion} preset={preset}>
          <div className="standalone-demo" data-preview-background={theme}>
            <IlotFixture scenario={ilotScenario.id} params={params} />
          </div>
        </MotionPreferences>
      </StrictMode>,
    );
    return;
  }
  const resultScenario = resultScenarioFrom(params.get('scenario'));
  if (resultScenario) {
    // The result pill alone (lots 9 and 10), on the overlay's page style.
    document.documentElement.dataset.labScenario = resultScenario.id;
    setLanguage(params.get('lang') === 'fr' ? 'fr' : 'en');
    document.body.className = 'flowtranslate-window flowtranslate-overlay';
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <MotionPreferences motion={motion} preset={preset}>
          <div className="standalone-demo" data-preview-background={theme}>
            <ResultFixture scenario={resultScenario.id} params={params} />
          </div>
        </MotionPreferences>
      </StrictMode>,
    );
    return;
  }
  document.body.className = `flowtranslate-window flowtranslate-${scenario === 'settings' || scenario === 'history' ? 'settings' : 'overlay'}`;
  if (indicator) await bridge.saveSettings({ ...(await bridge.getSettings()), uiVersion: 'ilot', indicator });
  if (scenario === 'history') {
    await bridge.saveSettings({ ...(await bridge.getSettings()), historyEnabled: true });
    const observer = new MutationObserver(() => {
      const history = document.querySelector('.st-history');
      if (!history) return;
      history.scrollIntoView({ block: 'center', behavior: 'instant' });
      document.documentElement.dataset.labReady = 'true';
      observer.disconnect();
    });
    observer.observe(document.getElementById('root')!, { childList: true, subtree: true });
  }
  createRoot(document.getElementById('root')!).render(
    <MotionPreferences motion={motion} preset={preset}>
      {scenario === 'history' ? (
        <SettingsWindow initialPage="data" />
      ) : scenario === 'settings' ? (
        <SettingsWindow initialPage={params.get('ui') === 'v4' ? 'general' : 'after'} />
      ) : scenario === 'halo' ? (
        <HaloFixture />
      ) : (
        <OverlayFixture />
      )}
    </MotionPreferences>,
  );
}
void mount();
