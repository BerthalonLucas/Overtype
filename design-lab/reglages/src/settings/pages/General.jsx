import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Power, Globe, RotateCcw, Sparkles, Info, LogOut } from 'lucide-react';
import { Group, Row, Switch, Select, Button, ICON } from '../../ui/index.jsx';
import { useTx } from '../../lib/motion.js';
import { appName } from '../../brand.js';
import { useSettings } from '../state.js';

// An inline confirmation under a row (no modal): what will happen, then the two choices.
export function InlineConfirm({ open, text, confirm, keep = 'Annuler', onConfirm, onKeep, danger = true }) {
  const tx = useTx();
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div className="st-confirm-wrap" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={tx('smooth')}>
          <div className="st-confirm" role="alertdialog" aria-label={confirm}>
            <p>{text}</p>
            <div className="st-confirm-actions">
              <Button size="sm" onClick={onKeep} autoFocus>{keep}</Button>
              <Button size="sm" variant={danger ? 'dangerSolid' : 'primary'} className="st-danger-solid" onClick={onConfirm}>{confirm}</Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function GeneralPage() {
  const { s, set, reset, replaySetup, showToast } = useSettings();
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <Group title="Démarrage">
        <Row id="autostart" icon={<Power {...ICON} />} tile={6} title="Lancer à l’ouverture de session" description="Seule l’icône de la zone de notification est visible au repos."
          control={<Switch checked={s.autostart} onCheckedChange={v => set({ autostart: v })} label="Lancer à l’ouverture de session" />} />
        <Row id="language" icon={<Globe {...ICON} />} tile={2} title="Langue de l’interface" description="Menus, messages et réglages. Les noms des actions restent tels quels."
          control={<Select label="Langue de l’interface" value={s.language} onChange={v => set({ language: v })} width={150}
            options={[{ value: 'fr', label: 'Français' }, { value: 'en', label: 'English' }]} />} />
      </Group>

      <Group title="Premier lancement">
        <Row id="replay" icon={<Sparkles {...ICON} />} tile={3} title="Revoir l’accueil" description="Les questions du début, puis la démo animée."
          control={<Button onClick={replaySetup}>Revoir l’accueil</Button>} />
      </Group>

      <Group title="Réinitialiser">
        <Row id="reset" icon={<RotateCcw {...ICON} />} tile={4} title="Réglages par défaut"
          description="Tout revient à une nouvelle installation, sauf votre connexion, l’historique, la langue et le lancement à l’ouverture de session."
          control={<Button variant="danger" onClick={() => setConfirming(true)} disabled={confirming}>Rétablir…</Button>}>
          <InlineConfirm open={confirming}
            text="Vos propres actions et raccourcis seront supprimés. Rétablir les réglages par défaut ?"
            confirm="Rétablir les réglages par défaut" keep="Garder mes réglages"
            onKeep={() => setConfirming(false)}
            onConfirm={() => { reset(); setConfirming(false); showToast('Réglages par défaut rétablis'); }} />
        </Row>
      </Group>

      <Group title="À propos">
        <Row icon={<Info {...ICON} />} tile={7} title={`${appName} 0.5.1`} description="Canal stable · à jour"
          control={<Button variant="ghost" icon={<LogOut {...ICON} size={15} />}>Quitter {appName}</Button>} />
      </Group>
    </>
  );
}
