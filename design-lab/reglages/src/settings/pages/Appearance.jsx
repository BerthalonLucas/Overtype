import { useState } from 'react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import { Group, Row, Segmented, Select } from '../../ui/index.jsx';
import { useTx } from '../../lib/motion.js';
import { useSettings } from '../state.js';
import { Indicator, INDICATORS } from '../Indicators.jsx';

// A row of picture choices (Radix ToggleGroup, single): one card per option, a check on the chosen one.
function CardChoice({ label, value, onChange, options, render, columns }) {
  return (
    <ToggleGroup.Root type="single" className="st-cards" style={{ '--cols': columns || options.length }} aria-label={label}
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

// Smooth vs bouncy: a pill that grows into the menu shape, replayed on hover and on choice.
function MotionArt({ kind, selected }) {
  const tx = useTx();
  const [open, setOpen] = useState(false);
  return (
    <span className="st-motion-art" onPointerEnter={() => setOpen(true)} onPointerLeave={() => setOpen(false)} data-ft-keep-motion="">
      <motion.span className="st-motion-shape" animate={{ scaleX: open || selected ? 1 : 0.42, scaleY: open || selected ? 1 : 0.55 }} transition={tx(kind)} />
      <motion.span className="st-motion-dot" animate={{ x: open || selected ? 34 : 0 }} transition={tx(kind)} />
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

      <Group title="Mouvement">
        <div className="st-group-pad" data-field="motionPreset">
          <CardChoice label="Style de mouvement" value={s.motionPreset} onChange={v => set({ motionPreset: v })}
            options={[{ value: 'smooth', label: 'Fluide', hint: 'S’ouvre sans dépasser' }, { value: 'bouncy', label: 'Rebondi', hint: 'Un léger rebond à l’arrivée' }]}
            render={(o, sel) => <MotionArt kind={o.value} selected={sel} />} />
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
