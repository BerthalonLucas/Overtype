import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useT } from '../../i18n';
import { Group, Row, Segmented, Select } from '../../components/controls';
import { useReduced } from '../../components/motion';
import { IndicatorView } from '../../loaders/indicators';
import { indicatorOf } from '../../loaders/pill';
import { IlotView, type IlotHandle } from '../../menu/Ilot';
import { menuActions } from '../../menu/IlotStage';
import { MotionPreferences, useSystemReducesMotion } from '../../motion/MotionPreferences';
import type { AutoClose, Indicator, MotionPreference, MotionPreset, Settings, TextSize, Theme } from '../../types';
import { useSettingsContext } from '../useSettingsStore';
import { CardChoice } from './CardChoice';
import '../../loaders/loaders.css';

// A tiny window in a given theme (for the theme cards).
function MiniWindow({ tone }: { tone: 'light' | 'dark' }) {
  return (
    <span className="st-mini-win" data-tone={tone}>
      <span className="st-mini-side">
        <i />
        <i />
        <i />
      </span>
      <span className="st-mini-body">
        <i />
        <i />
        <b />
      </span>
    </span>
  );
}

// Fluide vs Rebondi, shown by the app's own Îlot (src/menu/Ilot.tsx) under that preset
// (src/motion/tokens.ts), drawn at .55 of its size: it enters as the compact row on the « enter »
// spring, then springs open into its grid on the « morph » spring. Placed like the app: its
// compact state ends on the end of the selected line, the grid opening to the right. Replays on
// hover, on click, and when chosen. At rest it shows the open grid. A picture: no key, no focus,
// no click reaches the Îlot itself (inert).
const miniScale = 0.55;
function MiniIlot({ kind, selected, settings }: { kind: MotionPreset; selected: boolean; settings: Settings }) {
  const reduced = useReduced();
  const actions = useMemo(() => menuActions(settings), [settings]);
  // run 0 is the resting grid; each replay mounts a new Îlot (its entrance), compact first.
  const [run, setRun] = useState(0);
  const [shown, setShown] = useState(true);
  const ilot = useRef<IlotHandle>(null);
  const timers = useRef<number[]>([]);
  const clear = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };
  // Every replay starts from scratch: spamming the hover or the click never stacks timers. The
  // previous Îlot leaves first (its exit, 170 ms at most), then the new one enters.
  const play = () => {
    clear();
    setShown(false);
    timers.current.push(
      window.setTimeout(() => {
        setRun((previous) => previous + 1);
        setShown(true);
      }, 180),
    );
    timers.current.push(window.setTimeout(() => ilot.current?.press('Tab'), 180 + 620));
  };
  const first = useRef(true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: plays the preview when the selection changes only
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (selected) play();
  }, [selected]);
  useEffect(() => clear, []);
  return (
    <span className="st-motion-art" onPointerEnter={play} onClick={play}>
      <span className="st-motion-doc" aria-hidden="true">
        <i />
        <i data-sel="" />
      </span>
      <span
        aria-hidden="true"
        inert
        style={{
          position: 'absolute',
          left: 'calc(22px + (100% - 44px) * .64 - 60px)',
          top: 41,
          transform: `scale(${miniScale})`,
          transformOrigin: '0 0',
        }}
      >
        <MotionPreferences motion={settings.motion} preset={kind}>
          <AnimatePresence initial={false}>
            {shown && (
              <IlotView
                key={run}
                ref={(handle: IlotHandle | null) => {
                  // The leaving Îlot may unmount after the new one mounted: keep the newest.
                  if (handle) ilot.current = handle;
                }}
                actions={actions}
                knownActions={settings.actions}
                lastActionId={settings.defaultActionId}
                keyboard="none"
                originX="0%"
                initialMode={run === 0 || reduced ? 'grid' : 'compact'}
                onChoose={() => undefined}
                onInstruction={() => undefined}
                onClose={() => undefined}
              />
            )}
          </AnimatePresence>
        </MotionPreferences>
      </span>
    </span>
  );
}

const sizes: Record<TextSize, number> = { normal: 16, large: 18, xlarge: 20 };

// « Apparence »: the theme, the working pill's indicator (the app's own, src/loaders), how the
// menu moves, the animations, and the result bubble's reading presets.
export function AppearancePage() {
  const t = useT();
  const { settings, persist } = useSettingsContext();
  const systemReduces = useSystemReducesMotion();
  const ilot = settings.uiVersion === 'ilot';
  return (
    <>
      <Group title={t('settings.theme')}>
        <div className="st-group-pad" data-field="theme">
          <CardChoice<Theme>
            label={t('settings.theme')}
            value={settings.theme}
            onChange={(theme) => persist({ ...settings, theme }, true)}
            options={[
              { value: 'system', label: t('settings.themeSystem') },
              { value: 'light', label: t('settings.themeLight') },
              { value: 'dark', label: t('settings.themeDark') },
            ]}
            render={(option) =>
              option.value === 'system' ? (
                <span className="st-split">
                  <MiniWindow tone="light" />
                  <MiniWindow tone="dark" />
                </span>
              ) : (
                <MiniWindow tone={option.value} />
              )
            }
          />
        </div>
      </Group>

      {/* The working pill's indicator exists only in the Îlot journey: the 0.4 one keeps its spinner. */}
      {ilot && (
        <Group title={t('settings.indicator')} description={t('settings.indicatorHelp')}>
          <div className="st-group-pad" data-field="indicator">
            <CardChoice<Indicator>
              label={t('settings.indicator')}
              value={indicatorOf(settings.indicator)}
              onChange={(indicator) => persist({ ...settings, indicator }, true)}
              options={[
                { value: 'perle', label: t('settings.indicatorPerle'), hint: t('page.appearance.perleHint') },
                { value: 'nebuleuse', label: t('settings.indicatorNebula'), hint: t('page.appearance.nebulaHint') },
                { value: 'ruban', label: t('settings.indicatorRibbon'), hint: t('page.appearance.ribbonHint') },
              ]}
              render={(option) => (
                <span className="st-ind-art">
                  <span className="st-ind-pill">
                    <IndicatorView indicator={option.value} />
                  </span>
                </span>
              )}
            />
          </div>
        </Group>
      )}

      <Group title={t('page.appearance.motion')} description={t('page.appearance.motionHelp')}>
        <div className="st-group-pad" data-field="motionPreset">
          <CardChoice<MotionPreset>
            label={t('settings.motionPreset')}
            value={settings.motionPreset}
            onChange={(motionPreset) => persist({ ...settings, motionPreset }, true)}
            tall
            options={[
              { value: 'smooth', label: t('settings.motionSmooth'), hint: t('page.appearance.smoothHint') },
              { value: 'bouncy', label: t('settings.motionBouncy'), hint: t('page.appearance.bouncyHint') },
            ]}
            render={(option, selected) => <MiniIlot kind={option.value} selected={selected} settings={settings} />}
          />
        </div>
        {/* Lucas had « Effets d'animation » switched off without knowing it: in « suivre Windows »,
          say when Windows is the one reducing. */}
        <Row
          id="motion"
          title={t('settings.animations')}
          description={
            settings.motion === 'system' && systemReduces ? (
              <span role="status">{t('settings.animationsSystemReduces')}</span>
            ) : (
              t('settings.animationsHelp')
            )
          }
          control={
            <Segmented<MotionPreference>
              label={t('settings.animations')}
              size="sm"
              value={settings.motion}
              onChange={(motion) => persist({ ...settings, motion }, true)}
              options={[
                { value: 'system', label: t('settings.animationsSystem') },
                { value: 'full', label: t('settings.animationsFull') },
                { value: 'reduced', label: t('settings.animationsReduced') },
              ]}
            />
          }
        />
      </Group>

      <Group title={t('settings.bubble')} description={t('settings.bubbleIntro')}>
        <Row
          id="textSize"
          stack
          title={t('settings.textSize')}
          description={t('settings.textSizeHelp')}
          control={
            <Segmented<TextSize>
              label={t('settings.textSize')}
              size="sm"
              value={settings.textSize}
              onChange={(textSize) => persist({ ...settings, textSize }, true)}
              options={[
                { value: 'normal', label: t('settings.textNormal') },
                { value: 'large', label: t('settings.textLarge') },
                { value: 'xlarge', label: t('settings.textXLarge') },
              ]}
            />
          }
        >
          <div className="st-size-preview" aria-hidden="true">
            <motion.p
              key={settings.textSize}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ fontSize: sizes[settings.textSize] ?? sizes.normal }}
            >
              {t('page.appearance.sample')}
            </motion.p>
          </div>
        </Row>
        <Row
          id="autoClose"
          title={t('settings.autoClose')}
          description={t('settings.autoCloseHelp')}
          control={
            <Select<AutoClose>
              label={t('settings.autoClose')}
              value={settings.autoClose}
              onChange={(autoClose) => persist({ ...settings, autoClose }, true)}
              width={140}
              options={[
                { value: 'fast', label: t('settings.closeFast') },
                { value: 'normal', label: t('settings.closeNormal') },
                { value: 'slow', label: t('settings.closeSlow') },
                { value: 'never', label: t('settings.closeNever') },
              ]}
            />
          }
        />
      </Group>
    </>
  );
}
