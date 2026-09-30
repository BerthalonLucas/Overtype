import { AnimatePresence, motion } from 'motion/react';
import { Check, CircleCheck, Undo2, Highlighter, PanelBottom } from 'lucide-react';
import { Group, Row, Switch, Slider, Segmented, ICON } from '../../ui/index.jsx';
import { useTx } from '../../lib/motion.js';
import { useSettings } from '../state.js';

const fmtSeconds = v => (v >= 60 ? `${Math.floor(v / 60)} min${v % 60 ? ` ${v % 60} s` : ''}` : `${v} s`);

// A live preview: a replaced sentence, its changed words, and the pill where it will sit.
function AfterPreview({ s }) {
  const tx = useTx();
  const hasPill = s.check || s.undo;
  const W = ({ children }) => (s.changedWords ? <mark className="st-changed">{children}</mark> : <>{children}</>);
  return (
    <figure className="st-after-stage" aria-label="Aperçu après remplacement" data-placement={s.placement}>
      <div className="st-after-doc">
        <p className="st-after-muted">Bonjour Julie,</p>
        <p className="st-after-new">
          Je vous <W>ai</W> envoyé le fichier hier soir, <W>dites</W>-moi si <W>ça</W> convient.
        </p>
        <p className="st-after-muted">Bonne journée,<br />Lucas</p>
      </div>
      <AnimatePresence initial={false}>
        {hasPill && (
          <motion.div key={s.placement} className="st-pill" data-at={s.placement}
            initial={{ opacity: 0, y: s.placement === 'below' ? -6 : 0, x: s.placement === 'margin' ? -6 : 0, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, x: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={tx(s.motionPreset === 'bouncy' ? 'bouncy' : 'smooth')}>
            {s.check && <span className="st-pill-check" aria-hidden="true"><Check size={13} strokeWidth={2.4} /></span>}
            {s.undo && (
              <span className="st-pill-undo">
                <Undo2 size={14} strokeWidth={1.75} aria-hidden="true" />Annuler
                <span className="st-pill-timer" aria-hidden="true"><i key={`${s.undoSeconds}-${s.placement}`} style={{ animationDuration: `${s.undoSeconds}s` }} /></span>
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </figure>
  );
}

export function AfterPage() {
  const { s, set } = useSettings();
  return (
    <>
      <AfterPreview s={s} />
      <Group>
        <Row id="placement" icon={<PanelBottom {...ICON} />} tile={2} title="Position de la pilule" description="Jamais sur le nouveau texte."
          control={<Segmented label="Position de la pilule" size="sm" value={s.placement} onChange={v => set({ placement: v })}
            options={[{ value: 'below', label: 'Sous le texte' }, { value: 'margin', label: 'Dans la marge' }]} />} />
      </Group>
      <Group title="Confirmation">
        <Row id="check" icon={<CircleCheck {...ICON} />} tile={6} title="Coche" description="Montre que le texte a été remplacé."
          control={<Switch checked={s.check} onCheckedChange={v => set({ check: v })} label="Coche" />} />
      </Group>

      <Group title="Annuler">
        <Row id="undo" icon={<Undo2 {...ICON} />} tile={4} title="Bouton Annuler" description="Un bouton qui remet le texte d’origine."
          control={<Switch checked={s.undo} onCheckedChange={v => set({ undo: v })} label="Bouton Annuler" />} />
        <div className="st-dependent" data-off={s.undo ? undefined : ''} aria-disabled={!s.undo || undefined}>
          <Row title="Durée d’Annuler" description="De 2 à 20 secondes. Le survol la met en pause."
            control={<Slider label="Durée d’Annuler" value={s.undoSeconds} min={2} max={20} onChange={v => set({ undoSeconds: v })} format={v => `${v} s`} />} />
          <Row title="Méthode" description="Ctrl+Z dans l’application, ou l’app recolle l’original."
            control={<Segmented label="Méthode" size="sm" value={s.undoStrategy} onChange={v => set({ undoStrategy: v })}
              options={[{ value: 'keystroke', label: 'Ctrl+Z' }, { value: 'repaste', label: 'Recoller l’original' }]} />} />
        </div>
      </Group>

      <Group title="Mots changés">
        <Row id="changedWords" icon={<Highlighter {...ICON} />} tile={3} title="Surligner les mots changés" description="Les mots changés par le modèle, jusqu’à votre prochaine action dans le texte."
          control={<Switch checked={s.changedWords} onCheckedChange={v => set({ changedWords: v })} label="Surligner les mots changés" />} />
        <div className="st-dependent" data-off={s.changedWords ? undefined : ''}>
          <Row title="Durée du surlignage" description="Le plus longtemps qu’il reste sans action."
            control={<Slider label="Durée du surlignage" value={s.changedWordsSeconds} min={5} max={120} step={5} onChange={v => set({ changedWordsSeconds: v })} format={fmtSeconds} />} />
        </div>
      </Group>

    </>
  );
}
