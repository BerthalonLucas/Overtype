import { useState } from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronRight, Plus, Trash2, WandSparkles } from 'lucide-react';
import { bridge } from '../../bridge';
import { useT } from '../../i18n';
import { Icon, iconFromLucide } from '../../ui';
import { Button, Group, ICON, KeyCombo, Row, Segmented, Select, Switch } from '../../components/controls';
import type { ActionDefinition, OutputMode, Settings, ShortcutBinding } from '../../types';
import { ShortcutRecorder, shortcutKeys } from '../ShortcutRecorder';
import { useSettingsContext } from '../useSettingsStore';

export const bindingLimit = 12;
// The icon of an action as its Îlot tile draws it; the wand when it has none.
export function ActionGlyph({ action }: { action?: ActionDefinition }) {
  const glyph = iconFromLucide(action?.icon);
  return glyph ? <Icon name={glyph} size={16} /> : <WandSparkles {...ICON} />;
}

function Binding({ binding, settings, fresh, busy, onChange, onDelete }: {
  binding: ShortcutBinding; settings: Settings; fresh: boolean; busy: boolean; onChange: (patch: Partial<ShortcutBinding>) => void; onDelete?: () => void;
}) {
  const t = useT();
  const { recordShortcut, registrations } = useSettingsContext();
  const [open, setOpen] = useState(fresh);
  const menu = binding.kind === 'menu';
  const action = settings.actions.find(item => item.id === binding.actionId);
  const name = menu ? t('shortcuts.opensMenu') : action?.name || t('page.shortcuts.actionGone');
  return <Collapsible.Root open={open} onOpenChange={setOpen} className="ft-row st-binding" data-open={open ? '' : undefined} data-binding={binding.id}>
    <div className="ft-row-main">
      <span className="ft-row-icon" aria-hidden="true"><ActionGlyph action={menu ? undefined : action} /></span>
      <Collapsible.Trigger className="st-binding-trigger">
        <span className="ft-row-copy"><strong>{name}</strong><small>{!binding.enabled ? t('shortcuts.off') : menu ? t('settings.menu') : t(binding.outputMode === 'replace' ? 'page.shortcuts.replaces' : 'page.shortcuts.shows')}</small></span>
        <KeyCombo keys={binding.shortcut ? shortcutKeys(binding.shortcut, t) : [t('shortcuts.unset')]} size="sm" />
        <ChevronRight className="st-chevron" {...ICON} aria-hidden="true" />
      </Collapsible.Trigger>
      {/* A binding without a chord cannot be switched on: recording one enables it. */}
      <span className="ft-row-control"><Switch checked={binding.enabled} disabled={busy || (!binding.enabled && !binding.shortcut)} onCheckedChange={enabled => onChange({ enabled })} label={t('page.shortcuts.enable', { name })} /></span>
    </div>
    <Collapsible.Content className="st-collapse">
      <div className="st-binding-edit">
        <span className="st-mini-label">{t('shortcuts.field')}</span>
        <ShortcutRecorder shortcut={binding.shortcut} enabled={binding.enabled} label={t('page.shortcuts.direct')} busy={busy} record={shortcut => recordShortcut(binding.id, shortcut)} registration={registrations(binding)} />
        {/* A second menu binding (rare) opens the menu too: no action, no destination to pick. */}
        {!menu && <>
          <span className="st-mini-label">{t('shortcuts.action')}</span>
          <Select label={t('shortcuts.action')} value={action ? binding.actionId : undefined} placeholder={t('page.shortcuts.actionGone')} disabled={busy} onChange={actionId => onChange({ actionId })} width={220}
            options={settings.actions.map(item => ({ value: item.id, label: item.name || t('actions.untitled') }))} />
          <span className="st-mini-label">{t('shortcuts.result')}</span>
          <Segmented<OutputMode> label={t('shortcuts.result')} value={binding.outputMode} onChange={outputMode => onChange({ outputMode })} size="sm"
            options={[{ value: 'replace', label: t('shortcuts.replace') }, { value: 'display', label: t('shortcuts.display') }]} />
        </>}
        {onDelete && <><span /><span><Button size="sm" variant="danger" icon={<Trash2 {...ICON} size={14} />} disabled={busy} onClick={onDelete}>{t('shortcuts.delete')}</Button></span></>}
      </div>
    </Collapsible.Content>
  </Collapsible.Root>;
}

// « Raccourcis »: the chord that opens the menu and the action it starts on, then the direct
// shortcuts (one chord runs one action, without the menu). Rust remembers the last action per
// application; the default action is the fallback there.
export function ShortcutsPage() {
  const t = useT();
  const { settings, persist, recordShortcut, recording, registrations } = useSettingsContext();
  const [fresh, setFresh] = useState<string | null>(null);
  const ilot = settings.uiVersion === 'ilot';
  // The menu's own binding lives in « Menu »; any other one is a direct shortcut.
  const menuBinding = settings.shortcutBindings.find(binding => binding.kind === 'menu');
  const direct = settings.shortcutBindings.filter(binding => binding !== menuBinding);
  const help = menuBinding && !menuBinding.enabled ? t('settings.menuShortcutOff') : t(ilot ? 'settings.menuShortcutHelp' : 'settings.menuShortcutHelpV4');
  const update = (id: string, patch: Partial<ShortcutBinding>) => persist({ ...settings, shortcutBindings: settings.shortcutBindings.map(binding => binding.id === id ? { ...binding, ...patch } : binding) }, true);
  const full = settings.shortcutBindings.length >= bindingLimit;
  const add = () => {
    if (full || recording) return;
    const id = crypto.randomUUID();
    setFresh(id);
    persist({ ...settings, shortcutBindings: [...settings.shortcutBindings, { id, kind: 'action', shortcut: '', actionId: settings.defaultActionId, outputMode: 'display', enabled: false }] }, true);
  };
  const defaultKnown = settings.actions.some(action => action.id === settings.defaultActionId);
  return <>
    <Group title={t('settings.menu')}>
      <Row id="menuShortcut" stack title={t('settings.menuShortcutField')} description={help}>
        <ShortcutRecorder shortcut={menuBinding?.shortcut ?? ''} enabled={menuBinding?.enabled ?? false} label={t('settings.menuShortcutField')} busy={recording} size="lg"
          record={shortcut => recordShortcut(menuBinding?.id ?? null, shortcut)} registration={menuBinding && registrations(menuBinding)} suggest={bridge.suggestShortcut} />
      </Row>
      <Row id="defaultAction" title={t('settings.defaultAction')} description={t(ilot ? 'settings.defaultActionHelp' : 'settings.defaultActionHelpV4')}
        control={<Select label={t('settings.defaultAction')} value={defaultKnown ? settings.defaultActionId : undefined} onChange={defaultActionId => persist({ ...settings, defaultActionId }, true)} width={170}
          options={settings.actions.map(action => ({ value: action.id, label: action.name || t('actions.untitled') }))} />} />
    </Group>

    <Group title={t('shortcuts.title')} description={t('shortcuts.intro')}
      action={<Button size="sm" variant="ghost" icon={<Plus {...ICON} size={15} />} disabled={full || recording} title={full ? t('page.shortcuts.full') : undefined} onClick={add}>{t('shortcuts.add')}</Button>}>
      <div data-field="bindings" className="st-bindings">
        <AnimatePresence initial={false}>
          {direct.map(binding => <motion.div key={binding.id} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Binding binding={binding} settings={settings} fresh={fresh === binding.id} busy={recording} onChange={patch => update(binding.id, patch)}
              onDelete={settings.shortcutBindings.length > 1 ? () => persist({ ...settings, shortcutBindings: settings.shortcutBindings.filter(item => item.id !== binding.id) }, true) : undefined} />
          </motion.div>)}
        </AnimatePresence>
        {!direct.length && <p className="st-empty-line">{t('shortcuts.none')}</p>}
      </div>
    </Group>
    <p className="st-footnote">{t('page.shortcuts.footnote')}</p>
  </>;
}
