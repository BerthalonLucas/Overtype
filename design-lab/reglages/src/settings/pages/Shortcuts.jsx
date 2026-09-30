import { useState } from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronRight, Plus, Trash2 } from 'lucide-react';
import { Group, Row, Switch, Select, Segmented, Button, KeyCombo, IconButton, ICON } from '../../ui/index.jsx';
import { useTx } from '../../lib/motion.js';
import { ShortcutRecorder } from '../ShortcutRecorder.jsx';
import { useSettings, ACTION_ICONS, ACTION_TILES } from '../state.js';

const OUTPUT = { replace: 'Remplace la sélection', display: 'Affiche dans la bulle' };

function Binding({ b, actions, others, onChange, onDelete, fresh }) {
  const [open, setOpen] = useState(!!fresh);
  const action = actions.find(a => a.id === b.actionId);
  const Icon = ACTION_ICONS[b.actionId] || ACTION_ICONS.consigne;
  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} className="ft-row st-binding" data-open={open ? '' : undefined}>
      <div className="ft-row-main">
        <span className="ft-row-icon" data-tile="" style={{ '--tile': `var(--ft-tile-${ACTION_TILES[b.actionId] || 7})`, '--on-tile': `var(--ft-on-tile-${ACTION_TILES[b.actionId] || 7})` }} aria-hidden="true"><Icon {...ICON} /></span>
        <Collapsible.Trigger className="st-binding-trigger">
          <span className="ft-row-copy"><strong>{action?.name || 'Action supprimée'}</strong><small>{b.enabled ? OUTPUT[b.output] : 'Désactivé'}</small></span>
          <KeyCombo keys={b.keys.length ? b.keys : ['À définir']} size="sm" />
          <ChevronRight className="st-chevron" {...ICON} aria-hidden="true" />
        </Collapsible.Trigger>
        <span className="ft-row-control"><Switch checked={b.enabled} onCheckedChange={v => onChange({ enabled: v })} label={`Activer ${action?.name || 'ce raccourci'}`} /></span>
      </div>
      <Collapsible.Content className="st-collapse">
        <div className="st-binding-edit">
          <label className="st-mini-label">Raccourci</label>
          <ShortcutRecorder keys={b.keys} others={others} onChange={keys => onChange({ keys })} startRecording={fresh && !b.keys.length} label="Raccourci direct" />
          <label className="st-mini-label">Action</label>
          <Select label="Action" value={b.actionId} onChange={v => onChange({ actionId: v })} width={220} options={actions.map(a => ({ value: a.id, label: a.name }))} />
          <label className="st-mini-label">Résultat</label>
          <Segmented label="Résultat" value={b.output} onChange={v => onChange({ output: v })} size="sm"
            options={[{ value: 'replace', label: 'Remplacer la sélection' }, { value: 'display', label: 'Afficher dans la bulle' }]} />
          <span />
          <span><Button size="sm" variant="danger" icon={<Trash2 {...ICON} size={14} />} onClick={onDelete}>Supprimer ce raccourci</Button></span>
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

export function ShortcutsPage() {
  const { s, set } = useSettings();
  const [fresh, setFresh] = useState(null);
  const menuActions = s.actions.filter(a => s.menuIds.includes(a.id));
  const allCombos = [s.menuShortcut, ...s.bindings.map(b => b.keys)];
  const updateBinding = (id, patch) => set(v => ({ bindings: v.bindings.map(b => (b.id === id ? { ...b, ...patch } : b)) }));
  const add = () => {
    const id = `b${Date.now().toString(36)}`;
    setFresh(id);
    set(v => ({ bindings: [...v.bindings, { id, keys: [], actionId: v.actions[0]?.id || 'corriger', output: 'replace', enabled: true }] }));
  };
  return (
    <>
      <Group title="Menu">
        <Row id="menuShortcut" stack title="Raccourci du menu" description="Sélectionnez du texte, puis appuyez sur ces touches : le menu s’ouvre à côté.">
          <ShortcutRecorder keys={s.menuShortcut} others={s.bindings.map(b => b.keys)} onChange={keys => set({ menuShortcut: keys })} label="Raccourci du menu" size="lg" />
        </Row>
        <Row id="defaultAction" title="Action par défaut" description="Le menu propose la dernière action utilisée dans chaque application, sinon celle-ci."
          control={<Select label="Action par défaut" value={s.defaultActionId} onChange={v => set({ defaultActionId: v })} width={170}
            options={(menuActions.length ? menuActions : s.actions).map(a => ({ value: a.id, label: a.name }))} />} />
      </Group>

      <Group title="Raccourcis directs" description="Une combinaison lance une action, sans passer par le menu."
        action={<Button size="sm" variant="ghost" icon={<Plus {...ICON} size={15} />} onClick={add}>Ajouter un raccourci</Button>}>
        <div data-field="bindings" className="st-bindings">
          <AnimatePresence initial={false}>
            {s.bindings.map(b => (
              <motion.div key={b.id} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Binding b={b} fresh={fresh === b.id} actions={s.actions} others={allCombos.filter(k => k !== b.keys)}
                  onChange={patch => updateBinding(b.id, patch)} onDelete={() => set(v => ({ bindings: v.bindings.filter(x => x.id !== b.id) }))} />
              </motion.div>
            ))}
          </AnimatePresence>
          {!s.bindings.length && <p className="st-empty-line">Aucun raccourci direct.</p>}
        </div>
      </Group>
      <p className="st-footnote">Ctrl ou Alt requis. La touche Windows, F12 et les combinaisons du système sont refusées.</p>
    </>
  );
}
export { IconButton };
