import { useEffect, useRef, useState } from 'react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { AnimatePresence, motion } from 'motion/react';
import { Check, SpellCheck, Languages, BriefcaseBusiness, FoldVertical, Mail, WandSparkles } from 'lucide-react';
import { Group, Row, Segmented, Select } from '../../ui/index.jsx';
import { useTx, ms } from '../../lib/motion.js';
import { useLab } from '../../lab/store.jsx';
import { useSettings } from '../state.js';
import { Indicator, INDICATORS } from '../Indicators.jsx';

// A row of picture choices (Radix ToggleGroup, single): one card per option, a check on the chosen one.
function CardChoice({ label, value, onChange, options, render, columns, tall }) {
  return (
    <ToggleGroup.Root type="single" className="st-cards" data-tall={tall ? '' : undefined} style={{ '--cols': columns || options.length }} aria-label={label}
      value={value} onValueChange={v => { if (v) onChange(v); }}>
      {options.map(o => (
        <ToggleGroup.Item key={o.value} value={o.value} className="st-card" aria-label={o.label}>
          <span className="st-card-art" aria-hidden="true">{render(o, value === o.value)}</span>
          <span className="st-card-label">
            <span className="st-card-radio" aria-hidden="true">{value === o.value && <Check size={11} strokeWidth={3} />}</span>
            <span><strong>{o.label}</strong>{o.hint && <small>{o.hint}</small>}</span>
          </span>
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}

// A tiny window in a given theme (for the theme cards).
function MiniWindow({ tone }) {
  return (
    <span className="st-mini-win" data-tone={tone}>
      <span className="st-mini-side"><i /><i /><i /></span>
      <span className="st-mini-body"><i /><i /><b /></span>
    </span>
  );
}

// The Îlot's working pill with the indicator inside.
function IndicatorArt({ kind }) {
  return <span className="st-ind-art"><span className="st-ind-pill"><Indicator kind={kind} big /></span></span>;
}

// Fluide vs Rebondi, shown by a real mini-Îlot (the app's presets, src/motion/tokens.ts): it
// appears as the compact pill on the « enter » spring (opacity, the preset's scale and glide), then
// springs open into the menu grid on the « morph » spring; the box animates its size, the content
// sits centred at its natural size and cross-fades (like MorphSurface). Placed like the app: its
// compact right edge on the end of the selected line, 8 px under it (scaled), the grid opening to
// the right; the compact layout is the app's: action icon, label, ↵, separator, the ✦ orb on the
// right. Replays on hover, on click, and when chosen. At rest it shows the open menu.
const PRESETS = {
  smooth: { enter: { duration: 0.4, bounce: 0 }, morph: { duration: 0.45, bounce: 0 }, fromScale: 0.97, travel: 4 },
  bouncy: { enter: { duration: 0.4, bounce: 0.3 }, morph: { duration: 0.45, bounce: 0.3 }, fromScale: 0.94, travel: 6 },
};
const PILL = { width: 104, height: 26, borderRadius: 13 };
const MENU = { width: 118, height: 64, borderRadius: 14 };
const MINI_TILES = [SpellCheck, Languages, BriefcaseBusiness, FoldVertical, Mail, WandSparkles];

function MiniIlot({ kind, selected }) {
  const tx = useTx();
  const { reduced } = useLab();
  const pr = PRESETS[kind];
  const [phase, setPhase] = useState('menu'); // hidden → pill → menu
  const timers = useRef([]);
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const play = () => {
    clear();
    setPhase('hidden');
    timers.current.push(setTimeout(() => setPhase('pill'), ms(160)));
    timers.current.push(setTimeout(() => setPhase('menu'), ms(160 + 620)));
  };
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } if (selected) play(); }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => clear, []);
  const spring = k => (reduced ? tx(0.12) : tx({ type: 'spring', ...pr[k] }));
  const hidden = phase === 'hidden';
  // hidden: reset at once to the pill's size, invisible, scaled down and lifted (no animation);
  // pill: the enter spring; menu: the morph spring.
  const box = phase === 'menu' || reduced ? MENU : PILL;
  const transition = hidden ? { duration: 0 } : { default: spring('morph'), opacity: tx(0.18), scale: spring('enter'), y: spring('enter') };
  return (
    <span className="st-motion-art" onPointerEnter={play} onClick={play} data-ft-keep-motion="">
      <span className="st-motion-doc" aria-hidden="true"><i /><i data-sel="" /></span>
      <motion.span className="st-mini-ilot ft-glass" initial={false}
        animate={{ opacity: hidden ? 0 : 1, scale: hidden && !reduced ? pr.fromScale : 1, y: hidden && !reduced ? -pr.travel : 0, ...box }}
        transition={transition}>
        <AnimatePresence initial={false}>
          {phase !== 'menu' && !reduced ? (
            <motion.span key="pill" className="st-mini-layer st-mini-pill" initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={tx(0.16)}>
              <span className="st-mini-act"><SpellCheck size={11} strokeWidth={1.6} /><b>Corriger</b><span className="st-mini-hint">↵</span></span><span className="st-mini-sep" /><i className="st-mini-dot" />
            </motion.span>
          ) : (
            <motion.span key="menu" className="st-mini-layer st-mini-grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={tx(0.2)}>
              {MINI_TILES.map((Icon, i) => <span key={i}><Icon size={12} strokeWidth={1.6} /></span>)}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.span>
    </span>
  );
}

const SIZES = { normal: 16, large: 18, xlarge: 20 };

export function AppearancePage() {
  const { s, set, lab, markSaved } = useSettings();
  return (
    <>
      <Group title="Thème">
        <div className="st-group-pad" data-field="theme">
          <CardChoice label="Thème" value={lab.theme} onChange={v => { lab.set({ theme: v }); markSaved(); }}
            options={[{ value: 'system', label: 'Suivre Windows' }, { value: 'light', label: 'Clair' }, { value: 'dark', label: 'Sombre' }]}
            render={o => (o.value === 'system'
              ? <span className="st-split"><MiniWindow tone="light" /><MiniWindow tone="dark" /></span>
              : <MiniWindow tone={o.value} />)} />
        </div>
      </Group>

      <Group title="Indicateur" description="Dans la pilule, pendant que le modèle travaille.">
        <div className="st-group-pad" data-field="indicator">
          <CardChoice label="Indicateur" value={s.indicator} onChange={v => set({ indicator: v })} options={INDICATORS}
            render={o => <IndicatorArt kind={o.value} />} />
        </div>
      </Group>

      <Group title="Mouvement" description="Comment le menu s’ouvre. Survolez un aperçu pour le rejouer.">
        <div className="st-group-pad" data-field="motionPreset">
          <CardChoice label="Style de mouvement" value={s.motionPreset} onChange={v => set({ motionPreset: v })}
            options={[{ value: 'smooth', label: 'Fluide', hint: 'Le menu s’ouvre et se pose, sans dépasser.' }, { value: 'bouncy', label: 'Rebondi', hint: 'Le menu dépasse un peu, puis revient.' }]}
            tall render={(o, sel) => <MiniIlot kind={o.value} selected={sel} />} />
        </div>
        <Row id="motion" title="Animations" description={lab.systemReduced ? 'Windows demande de réduire les animations.' : 'Réduites : fondus courts seulement, sans ressort ni déplacement.'}
          control={<Segmented label="Animations" size="sm" value={s.motion}
            onChange={v => { set({ motion: v }); lab.set({ reduced: v === 'system' ? null : v === 'reduced' }); }}
            options={[{ value: 'system', label: 'Suivre Windows' }, { value: 'full', label: 'Toujours' }, { value: 'reduced', label: 'Réduites' }]} />} />
      </Group>

      <Group title="Bulle de résultat" description="Quand un raccourci affiche le résultat, ou qu’un collage échoue.">
        <Row id="textSize" stack title="Taille du texte" description="Verre court 16, 18 ou 20 px ; lecteur 22, 24 ou 26 px."
          control={<Segmented label="Taille du texte" size="sm" value={s.textSize} onChange={v => set({ textSize: v })}
            options={[{ value: 'normal', label: 'Normale' }, { value: 'large', label: 'Grande' }, { value: 'xlarge', label: 'Très grande' }]} />}>
          <div className="st-size-preview" aria-hidden="true">
            <motion.p key={s.textSize} initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ fontSize: SIZES[s.textSize] }}>Could you send me the signed quote before Friday?</motion.p>
          </div>
        </Row>
        <Row id="autoClose" title="Fermeture automatique" description="Le temps de lecture estimé, puis un fondu. Survoler ou épingler la retient."
          control={<Select label="Fermeture automatique" value={s.autoClose} onChange={v => set({ autoClose: v })} width={140}
            options={[{ value: 'fast', label: 'Rapide' }, { value: 'normal', label: 'Normale' }, { value: 'slow', label: 'Lente' }, { value: 'never', label: 'Jamais' }]} />} />
      </Group>
    </>
  );
}
