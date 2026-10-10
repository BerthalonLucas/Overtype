import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BriefcaseBusiness, FoldVertical, Languages, Mail, SpellCheck, WandSparkles } from 'lucide-react';
import { useT } from '../../i18n';
import { Group, Row, Segmented, Select } from '../../components/controls';
import { useReduced, useTx } from '../../components/motion';
import { IndicatorView } from '../../loaders/indicators';
import { indicatorOf } from '../../loaders/pill';
import { useSystemReducesMotion } from '../../motion/MotionPreferences';
import { motionPresets, springTransition } from '../../motion/tokens';
import type { AutoClose, Indicator, MotionPreference, MotionPreset, TextSize, Theme } from '../../types';
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

// Fluide vs Rebondi, shown by a mini-Îlot driven by the app's own presets (src/motion/tokens.ts):
// it appears as the compact pill on the « enter » spring (opacity, the preset's scale and glide),
// then springs open into the menu grid on the « morph » spring; the box animates its size, the
// content sits centred at its natural size and cross-fades (like MorphSurface). Placed like the
// app: its compact right edge on the end of the selected line, the grid opening to the right.
// Replays on hover, on click, and when chosen. At rest it shows the open menu.
const PILL = { width: 104, height: 26, borderRadius: 13 };
const MENU = { width: 118, height: 64, borderRadius: 14 };
const miniTiles = [SpellCheck, Languages, BriefcaseBusiness, FoldVertical, Mail, WandSparkles];
function MiniIlot({ kind, selected }: { kind: MotionPreset; selected: boolean }) {
  const t = useT();
  const tx = useTx();
  const reduced = useReduced();
  const preset = motionPresets[kind];
  const [phase, setPhase] = useState<'hidden' | 'pill' | 'menu'>('menu');
  const timers = useRef<number[]>([]);
  const clear = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };
  // Every replay starts from scratch: spamming the hover or the click never stacks timers.
  const play = () => {
    clear();
    setPhase('hidden');
    timers.current.push(window.setTimeout(() => setPhase('pill'), 160));
    timers.current.push(window.setTimeout(() => setPhase('menu'), 160 + 620));
  };
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (selected) play();
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => clear, []);
  const spring = (which: 'enter' | 'morph') => (reduced ? tx(0.12) : springTransition(preset[which]));
  const hidden = phase === 'hidden';
  const box = phase === 'menu' || reduced ? MENU : PILL;
  const transition = hidden
    ? { duration: 0 }
    : { default: spring('morph'), opacity: tx(0.18), scale: spring('enter'), y: spring('enter') };
  return (
    <span className="st-motion-art" onPointerEnter={play} onClick={play}>
      <span className="st-motion-doc" aria-hidden="true">
        <i />
        <i data-sel="" />
      </span>
      <motion.span
        className="st-mini-ilot ft-glass"
        initial={false}
        animate={{
          opacity: hidden ? 0 : 1,
          scale: hidden && !reduced ? preset.fromScale : 1,
          y: hidden && !reduced ? -preset.travel : 0,
          ...box,
        }}
        transition={transition}
      >
        <AnimatePresence initial={false}>
          {phase !== 'menu' && !reduced ? (
            <motion.span
              key="pill"
              className="st-mini-layer st-mini-pill"
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={tx(0.16)}
            >
              <span className="st-mini-act">
                <SpellCheck size={11} strokeWidth={1.6} />
                <b>{t('page.appearance.miniAction')}</b>
                <span className="st-mini-hint">↵</span>
              </span>
              <span className="st-mini-sep" />
              <i className="st-mini-dot" />
            </motion.span>
          ) : (
            <motion.span
              key="menu"
              className="st-mini-layer st-mini-grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={tx(0.2)}
            >
              {miniTiles.map((Glyph, index) => (
                <span key={index}>
                  <Glyph size={12} strokeWidth={1.6} />
                </span>
              ))}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.span>
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
            render={(option, selected) => <MiniIlot kind={option.value} selected={selected} />}
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
