import { useEffect, useMemo, useRef, useState } from 'react';
import { appName } from './brand';
import { SettingsWindow } from './settings/SettingsWindow';
import { bridge } from './bridge';
import { GlassOverlay } from './GlassOverlay';
import { HaloWindow } from './halo/HaloWindow';
import { SetupWindow } from './setup/SetupWindow';
import { useTranslation } from './useTranslation';
import { useSettings } from './useSettings';
import { useDocumentPreferences } from './preferences';
import { useT } from './i18n';
import { MotionPreferences } from './motion/MotionPreferences';
import { overlayGlassSurfaces, setupGlassSurfaces, startGlassBackdrop } from './glassBackdrop';
import type { Capture } from './types';

const defaultCapture: Capture = {
  id: 'demo-selection',
  text: 'Could you send the updated proposal before Thursday?',
  source: 'selection',
  canReplace: true,
  anchor: { x: 820, y: 410, width: 350, height: 24 },
};
const longCapture: Capture = {
  ...defaultCapture,
  id: 'demo-long',
  text: 'Hi Alex,\n\nThank you for your feedback. The updated proposal includes the delivery timeline, responsibilities, and payment terms. Could you confirm these details before Thursday?\n\nWe have kept the total budget unchanged and clarified the review process. Please check the dates and amounts before we share the final version with the team.\n\nBest regards,\nMarie',
};
const clipboardCapture: Capture = {
  id: 'demo-clipboard',
  text: 'Je vous envoie la proposition mise à jour.',
  source: 'clipboard',
  canReplace: false,
  anchor: null,
};
const uid = () => crypto.randomUUID?.() ?? `request-${Date.now()}`;

function DemoDesktop({ controller }: { controller: ReturnType<typeof useTranslation> }) {
  const [scenario, setScenario] = useState<'selection' | 'clipboard' | 'long' | 'very-long' | 'error'>('selection');
  const capture =
    scenario === 'clipboard'
      ? clipboardCapture
      : scenario === 'long' || scenario === 'very-long'
        ? longCapture
        : defaultCapture;
  const t = useT();
  const begin = () => {
    const next = { ...capture, id: uid() };
    bridge.setDemoCapture(
      next,
      scenario === 'error' ? 'error' : scenario === 'very-long' ? 'very-long' : scenario === 'long' ? 'long' : 'normal',
    );
    controller.receiveCapture(next);
  };
  return (
    <main className="demo-desktop">
      <aside className="demo-sidebar">
        <span className="demo-logo">FT</span>
        <span>{t('demo.mail')}</span>
        <span>{t('demo.messages')}</span>
        <span>{t('demo.settings')}</span>
      </aside>
      <section className="demo-mail">
        <div className="demo-toolbar">
          <span>{t('demo.newMessage')}</span>
          <span className="demo-search">{t('demo.search')}</span>
          <span>{t('demo.send')}</span>
        </div>
        <div className="demo-recipient">
          <span>{t('demo.to')}</span>
          <b>alex.martin@exemple.com</b>
        </div>
        <div className="mail-copy">
          <p>Bonjour Alex,</p>
          <p>Je vous envoie la proposition mise à jour.</p>
          <p>
            Bonne journée,
            <br />
            Marie
          </p>
        </div>
      </section>
      <aside className="demo-panel">
        <span className="demo-badge">{t('demo.badge')}</span>
        <h1>{appName}</h1>
        <p>{t('demo.intro')}</p>
        <fieldset>
          <legend>{t('demo.scenario')}</legend>
          {(
            [
              ['selection', 'demo.selection'],
              ['clipboard', 'demo.clipboard'],
              ['long', 'demo.long'],
              ['very-long', 'demo.veryLong'],
              ['error', 'demo.error'],
            ] as const
          ).map(([value, key]) => (
            <label key={value}>
              <input type="radio" checked={scenario === value} onChange={() => setScenario(value)} /> {t(key)}
            </label>
          ))}
        </fieldset>
        <button className="primary-action demo-start" onClick={begin}>
          {t('demo.start')}
        </button>
        <button className="text-button settings-link" onClick={() => location.assign('?window=settings&demo=1')}>
          {t('demo.openSettings')}
        </button>
      </aside>
      <div className="demo-selection">Could you send the updated proposal before Thursday?</div>
      <GlassOverlay controller={controller} />
    </main>
  );
}

function OverlayWindow({ standaloneDemo }: { standaloneDemo: boolean }) {
  const controller = useTranslation(true);
  const [background, setBackground] = useState(() => {
    const requested = new URLSearchParams(location.search).get('background');
    return requested === 'light' || requested === 'dark' ? requested : 'color';
  });
  const { receiveCapture, initError } = controller;
  const t = useT();
  const demoStarted = useRef(false);
  useEffect(() => {
    if (!demoStarted.current && standaloneDemo) {
      demoStarted.current = true;
      const scenario = new URLSearchParams(location.search).get('scenario');
      const capture =
        scenario === 'confirmation'
          ? clipboardCapture
          : scenario === 'long' || scenario === 'very-long'
            ? longCapture
            : defaultCapture;
      bridge.setDemoCapture(
        capture,
        scenario === 'error'
          ? 'error'
          : scenario === 'very-long'
            ? 'very-long'
            : scenario === 'long'
              ? 'long'
              : 'normal',
      );
      receiveCapture(capture);
    }
  }, [standaloneDemo, receiveCapture]);
  return (
    <div
      className={standaloneDemo ? 'standalone-demo' : 'native-overlay'}
      data-preview-background={standaloneDemo ? background : undefined}
    >
      {initError && (
        <div className="initialization-error">
          <p role="alert">
            {t(initError === 'close' ? 'init.close' : 'init.connection')} {t('init.restart')}
          </p>
          <button className="quiet-action" onClick={() => location.reload()}>
            {t('common.retry')}
          </button>{' '}
          <button className="quiet-action" onClick={() => void bridge.openSettings()}>
            {t('common.settings')}
          </button>{' '}
          <button className="quiet-action" onClick={() => void bridge.dismiss()}>
            {t('common.close')}
          </button>
        </div>
      )}
      {standaloneDemo && (
        <>
          <span className="preview-label">{t('preview.label')}</span>
          <div className="preview-backgrounds" role="group" aria-label={t('preview.backgrounds')}>
            {(
              [
                ['light', 'preview.light'],
                ['dark', 'preview.dark'],
                ['color', 'preview.color'],
              ] as const
            ).map(([value, key]) => (
              <button
                key={value}
                type="button"
                aria-pressed={background === value}
                onClick={() => setBackground(value)}
              >
                {t(key)}
              </button>
            ))}
          </div>
        </>
      )}
      <GlassOverlay controller={controller} />
    </div>
  );
}

function DemoWindow() {
  return <DemoDesktop controller={useTranslation(false)} />;
}

export function App() {
  const params = useMemo(() => new URLSearchParams(location.search), []);
  const windowName = params.get('window') ?? (bridge.native ? 'overlay' : 'demo');
  const standaloneDemo = params.get('demo') === '1';
  const settings = useSettings();
  useDocumentPreferences(settings);
  useEffect(() => {
    document.body.className = `flowtranslate-window flowtranslate-${windowName}`;
    return () => {
      document.body.className = '';
    };
  }, [windowName]);
  // The real glass (src/glassBackdrop.ts): the windows that float glass tell Windows where it is.
  useEffect(() => {
    if (!bridge.native || standaloneDemo) return;
    if (windowName === 'overlay') return startGlassBackdrop(overlayGlassSurfaces);
    if (windowName === 'setup') return startGlassBackdrop(setupGlassSurfaces, 'opaque');
  }, [windowName, standaloneDemo]);
  const content =
    windowName === 'settings' ? (
      <SettingsWindow />
    ) : windowName === 'setup' ? (
      <SetupWindow />
    ) : windowName === 'halo' ? (
      <HaloWindow />
    ) : windowName === 'overlay' && (bridge.native || standaloneDemo) ? (
      <OverlayWindow standaloneDemo={standaloneDemo} />
    ) : (
      <DemoWindow />
    );
  return (
    <MotionPreferences motion={settings?.motion ?? 'system'} preset={settings?.motionPreset ?? 'smooth'}>
      {content}
    </MotionPreferences>
  );
}
