import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ShieldCheck, X, Inbox, ArrowRight } from 'lucide-react';
import { Group, Row, Switch, Button, IconButton, ICON } from '../../ui/index.jsx';
import { useTx } from '../../lib/motion.js';
import { useSettings, ACTION_ICONS, ACTION_TILES, relTime } from '../state.js';
import { InlineConfirm } from './General.jsx';

export function DataPage() {
  const { s, set, history, setHistory, markSaved, showToast } = useSettings();
  const [confirming, setConfirming] = useState(false);
  const tx = useTx();
  const names = Object.fromEntries(s.actions.map(a => [a.id, a.name]));
  const count = history.length;
  return (
    <>
      <Group title="Sur cet appareil">
        <Row id="history" icon={<ShieldCheck {...ICON} />} tile={6} title="Conserver l’historique chiffré"
          description="7 jours, 100 entrées, protégé par Windows. Rien ne quitte l’appareil."
          control={<Switch checked={s.historyEnabled} onCheckedChange={v => set({ historyEnabled: v })} label="Conserver l’historique chiffré" />} />
      </Group>

      <Group title="Historique" description={s.historyEnabled ? null : 'Désactivé : les prochains textes ne seront pas gardés.'}
        action={count > 0 ? <Button size="sm" variant="danger" onClick={() => setConfirming(true)} disabled={confirming}>Tout supprimer</Button> : null}>
        <InlineConfirm open={confirming} text={`Supprimer ${count === 1 ? 'l’entrée' : `les ${count} entrées`} de l’historique ? Cette action est définitive.`}
          confirm="Tout supprimer" keep="Garder" onKeep={() => setConfirming(false)}
          onConfirm={() => { setHistory([]); setConfirming(false); markSaved(); showToast('Historique supprimé'); }} />
        <ul className="st-history" aria-label="Historique">
          <AnimatePresence initial={false}>
            {history.map(h => {
              const Icon = ACTION_ICONS[h.actionId] || ACTION_ICONS.consigne;
              return (
                <motion.li key={h.id} layout="position" className="st-history-item"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: 24, transition: tx({ duration: 0.18, ease: 'out' }) }} transition={tx('smooth')}>
                  <span className="st-history-tile" style={{ '--tile': `var(--ft-tile-${ACTION_TILES[h.actionId] || 8})`, '--on-tile': `var(--ft-on-tile-${ACTION_TILES[h.actionId] || 8})` }} aria-hidden="true"><Icon {...ICON} size={15} /></span>
                  <span className="st-history-main">
                    <span className="st-history-head"><strong>{names[h.actionId] || 'Action'}</strong><time>{relTime(h.at)}</time></span>
                    <span className="st-history-text">
                      <span className="st-history-from">{h.from}</span>
                      <ArrowRight size={13} strokeWidth={1.75} aria-hidden="true" />
                      <span className="st-history-to">{h.to}</span>
                    </span>
                  </span>
                  <IconButton size="sm" label="Supprimer cette entrée" onClick={() => { setHistory(list => list.filter(x => x.id !== h.id)); markSaved(); }}><X {...ICON} size={15} /></IconButton>
                </motion.li>
              );
            })}
          </AnimatePresence>
          {count === 0 && (
            <motion.li className="st-history-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={tx(0.2)}>
              <span className="st-empty-icon" aria-hidden="true"><Inbox size={18} strokeWidth={1.5} /></span>
              Aucun texte enregistré.
            </motion.li>
          )}
        </ul>
      </Group>
      {count > 0 && <p className="st-footnote st-footnote-tight">{count} {count === 1 ? 'entrée' : 'entrées'} · la plus ancienne s’efface après 7 jours.</p>}
    </>
  );
}
