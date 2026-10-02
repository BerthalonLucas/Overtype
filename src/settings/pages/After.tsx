import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CircleCheck, Highlighter, PanelBottom, Undo2 } from 'lucide-react';
import { useT, type Translate } from '../../i18n';
import { Group, ICON, Row, Segmented, Slider, Switch, clampToStep } from '../../components/controls';
import { SPRINGS } from '../../components/motion';
import { DoneContent } from '../../result/ResultPill';
import type { AfterReplace, ChangedWordsStyle, PillPlacement, UndoStrategy } from '../../types';
import { changedWordsRange, undoRange } from '../AfterReplace';
import { useSettingsContext } from '../useSettingsStore';
import { CardChoice } from './CardChoice';
import '../../menu/ilot.css';
import '../../halo/halo.css';

export function formatSeconds(value: number, t: Translate): string {
  if (value < 60) return t('after.seconds', { count: value });
  return value % 60 ? t('page.after.minSec', { min: Math.floor(value / 60), sec: value % 60 }) : t('after.minutes', { count: value / 60 });
}

// The changed words as the halo draws them on text of our own (src/halo/halo.css .halo-lit):
// « Encre irisée » lights the letters themselves, « Éclat » is a deep ink, a thin line and a halo.
function Lit({ on, style, children }: { on: boolean; style: ChangedWordsStyle; children: ReactNode }) {
  return on ? <span className="halo-lit" data-style={style}>{children}</span> : <>{children}</>;
}
function SampleSentence({ on, style }: { on: boolean; style: ChangedWordsStyle }) {
  const t = useT();
  return <>{t('page.after.s1')}<Lit on={on} style={style}>{t('page.after.w1')}</Lit>{t('page.after.s2')}<Lit on={on} style={style}>{t('page.after.w2')}</Lit>{t('page.after.s3')}<Lit on={on} style={style}>{t('page.after.w3')}</Lit>{t('page.after.s4')}</>;
}

// A live preview: a replaced sentence, its changed words, and the APP's own result pill (the
// content of src/result/ResultPill.tsx on the Îlot's surface): the check, then Undo with its
// countdown ring, paused under the pointer as in the app. Placed by the app's rule: its right edge
// on the end of the new text, 8 px under its last line (placement.rs); « In the margin »: beside it.
// The sample ends on the new text, so the pill never sits on a following line.
function AfterPreview() {
  const t = useT();
  const { settings } = useSettingsContext();
  const after = settings.afterReplace;
  const stage = useRef<HTMLElement>(null);
  const end = useRef<HTMLSpanElement>(null);
  const pill = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ x: number; top: number; bottom: number; docRight: number } | null>(null);
  const [pillWidth, setPillWidth] = useState(0);
  // The countdown runs out, rests a moment, then starts over (a preview, not a replacement).
  const [round, setRound] = useState(0);
  const rest = useRef(0);
  useEffect(() => () => window.clearTimeout(rest.current), []);
  const seconds = clampToStep(after.undoSeconds, undoRange.min, undoRange.max);
  useLayoutEffect(() => { setPillWidth(pill.current?.offsetWidth ?? 0); }, [after.check, after.undo, settings.pillPlacement, settings.language]);
  useLayoutEffect(() => {
    const measure = () => {
      const frame = stage.current?.getBoundingClientRect(), caret = end.current?.getBoundingClientRect(), doc = end.current?.closest('.st-after-doc')?.getBoundingClientRect();
      if (!frame || !caret || !doc || !frame.width) return;
      setAt({ x: caret.left - frame.left, top: caret.top - frame.top, bottom: caret.bottom - frame.top, docRight: doc.right - frame.left });
    };
    measure();
    if (typeof ResizeObserver === 'undefined' || !stage.current) return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(stage.current);
    return () => observer.disconnect();
  }, [after.changedWords, settings.changedWordsStyle, settings.language]);
  const hasPill = after.check || after.undo;
  const layout = after.check && after.undo ? 'both' : after.check ? 'check' : 'undo';
  const place: CSSProperties = !at ? { visibility: 'hidden' } : settings.pillPlacement === 'margin'
    ? { left: at.docRight + 12, top: (at.top + at.bottom) / 2 - 14 }
    // The app keeps the pill inside the work area: here, inside the preview (8 px margin).
    : { left: Math.max(8, at.x - pillWidth), top: at.bottom + 8 };
  // A picture of the pill, not the pill: nothing in it takes the focus or a click.
  return <figure ref={stage} className="st-after-stage" aria-label={t('page.after.preview')} data-placement={settings.pillPlacement} inert>
    <div className="st-after-doc">
      <p className="st-after-muted">{t('page.actions.sampleHello')}</p>
      <p className="st-after-new"><SampleSentence on={after.changedWords} style={settings.changedWordsStyle} /><span ref={end} className="st-after-end" /></p>
      {/* The lab's closing lines: the pill lands inside the card, under the changed paragraph. */}
      <p className="st-after-muted">{t('page.after.sampleBye')}<br />Lucas</p>
    </div>
    <AnimatePresence initial={false}>
      {hasPill && <motion.div key={`${settings.pillPlacement}-${layout}`} className="ilot st-app" style={place}
        initial={{ opacity: 0, y: -4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
        transition={{ type: 'spring', ...SPRINGS[settings.motionPreset === 'bouncy' ? 'bouncy' : 'smooth'] }}>
        <div ref={pill} className="ilot-shape st-app-shape">
          <DoneContent key={`${round}-${seconds}`} check={after.check} undo={after.undo} durationMs={seconds * 1000} drawn={round > 0}
            onExpire={() => { window.clearTimeout(rest.current); rest.current = window.setTimeout(() => setRound(value => value + 1), 900); }} />
        </div>
      </motion.div>}
    </AnimatePresence>
  </figure>;
}

// « Après remplacement »: where the pill rests, the check, Undo with its time and its method,
// and the changed words: whether, how long at most, and in which style.
export function AfterPage() {
  const t = useT();
  const { settings, persist } = useSettingsContext();
  const after = settings.afterReplace;
  const set = (patch: Partial<AfterReplace>, immediate = true) => persist({ ...settings, afterReplace: { ...after, ...patch } }, immediate);
  return <>
    <AfterPreview />
    <Group>
      <Row id="placement" icon={<PanelBottom {...ICON} />} title={t('after.placement')} description={t('after.placementHelp')}
        control={<Segmented<PillPlacement> label={t('after.placement')} size="sm" value={settings.pillPlacement} onChange={pillPlacement => persist({ ...settings, pillPlacement }, true)}
          options={[{ value: 'below', label: t('after.placementBelow') }, { value: 'margin', label: t('after.placementMargin') }]} />} />
    </Group>
    <Group title={t('page.after.confirmation')}>
      <Row id="check" icon={<CircleCheck {...ICON} />} title={t('after.check')} description={t('after.checkHelp')}
        control={<Switch checked={after.check} onCheckedChange={check => set({ check })} label={t('after.check')} />} />
    </Group>

    <Group title={t('page.after.undoGroup')}>
      <Row id="undo" icon={<Undo2 {...ICON} />} title={t('page.after.undoButton')} description={t('after.undoHelp')}
        control={<Switch checked={after.undo} onCheckedChange={undo => set({ undo })} label={t('page.after.undoButton')} />} />
      <div className="st-dependent" data-off={after.undo ? undefined : ''} aria-disabled={!after.undo || undefined} inert={!after.undo}>
        {/* Saved after a pause: a drag or held arrow keys run through many values. */}
        <Row title={t('after.undoSeconds')} description={t('after.undoSecondsHelp')}
          control={<Slider label={t('after.undoSeconds')} value={after.undoSeconds} {...undoRange} onChange={undoSeconds => set({ undoSeconds }, false)} format={value => t('after.seconds', { count: value })} />} />
        <Row title={t('after.strategy')} description={t('after.strategyHelp')}
          control={<Segmented<UndoStrategy> label={t('after.strategy')} size="sm" value={settings.undoStrategy} onChange={undoStrategy => persist({ ...settings, undoStrategy }, true)}
            options={[{ value: 'keystroke', label: t('after.strategyKeystroke') }, { value: 'repaste', label: t('after.strategyRepaste') }]} />} />
      </div>
    </Group>

    <Group title={t('page.after.words')}>
      <Row id="changedWords" icon={<Highlighter {...ICON} />} title={t('after.changedWords')} description={t('after.changedWordsHelp')}
        control={<Switch checked={after.changedWords} onCheckedChange={changedWords => set({ changedWords })} label={t('after.changedWords')} />} />
      <div className="st-dependent" data-off={after.changedWords ? undefined : ''} aria-disabled={!after.changedWords || undefined} inert={!after.changedWords}>
        <Row title={t('after.changedWordsSeconds')} description={t('after.changedWordsSecondsHelp')}
          control={<Slider label={t('after.changedWordsSeconds')} value={after.changedWordsSeconds} {...changedWordsRange} onChange={changedWordsSeconds => set({ changedWordsSeconds }, false)} format={value => formatSeconds(value, t)} />} />
        <div className="st-group-pad st-style-cards" data-field="changedWordsStyle">
          <CardChoice<ChangedWordsStyle> label={t('page.after.style')} value={settings.changedWordsStyle} onChange={changedWordsStyle => persist({ ...settings, changedWordsStyle }, true)}
            options={[{ value: 'encre', label: t('page.after.encre'), hint: t('page.after.encreHint') }, { value: 'eclat', label: t('page.after.eclat'), hint: t('page.after.eclatHint') }]}
            render={option => <span className="st-style-art"><SampleSentence on style={option.value} /></span>} />
        </div>
      </div>
    </Group>
  </>;
}
