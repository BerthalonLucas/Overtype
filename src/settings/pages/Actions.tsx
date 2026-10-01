import { useState } from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronRight, Plus, RotateCcw, Trash2, WandSparkles } from 'lucide-react';
import { isCurrentDefault, newActionTemplate, promptError, shippedInstruction } from '../../actionDefaults';
import { locales, t as tNow, useLanguage, useT } from '../../i18n';
import { Icon, iconFromLucide } from '../../ui';
import { Button, Group, ICON, Input, Keycap } from '../../components/controls';
import { useTx } from '../../components/motion';
import type { ActionDefinition, Settings } from '../../types';
import { MenuGrid } from '../MenuGrid';
import { deleteAction, gridLimit } from '../grid';
import { useSettingsContext } from '../useSettingsStore';
import { ActionGlyph } from './Shortcuts';

export const actionLimit = 24;
export const nameMaxLength = 60;
export const shortNameMaxLength = 16;
export const promptMaxLength = 8000;

// The Îlot as it will open beside a selection: the tiles in their order, each with its letter;
// the free instruction takes the last tile while there is room.
function IlotPreview({ settings }: { settings: Settings }) {
  const t = useT();
  const tx = useTx();
  const tiles = settings.menuActionIds.map(id => settings.actions.find(action => action.id === id)).filter((action): action is ActionDefinition => Boolean(action)).slice(0, gridLimit);
  return <figure className="st-ilot-stage" aria-label={t('page.actions.previewLabel')}>
    <div className="st-ilot-text" aria-hidden="true">
      <span>{t('page.actions.sampleHello')}</span>
      <span><mark>{t('page.actions.sampleMarked')}</mark>{t('page.actions.sampleRest')}</span>
    </div>
    <div className="st-ilot">
      <div className="st-ilot-grid">
        <AnimatePresence initial={false} mode="popLayout">
          {tiles.map(action => {
            const glyph = iconFromLucide(action.icon);
            return <motion.span key={action.id} layout className="st-ilot-tile" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={tx('smooth')}>
              {glyph && <Icon name={glyph} size={16} />}
              <span className="st-ilot-label">{action.shortName || action.name || t('actions.untitled')}</span>
              {action.key && <span className="st-ilot-key">{action.key}</span>}
            </motion.span>;
          })}
          {tiles.length < gridLimit && <motion.span key="\nfree" layout className="st-ilot-tile" data-free="" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={tx('smooth')}>
            <WandSparkles size={16} strokeWidth={1.5} aria-hidden="true" />
            <span className="st-ilot-label">{t('ilot.ask')}</span>
          </motion.span>}
        </AnimatePresence>
      </div>
    </div>
    <figcaption>{t('page.actions.preview')}</figcaption>
  </figure>;
}

// One action's instruction, unfolded in place. Built-in: shipped with the app, now or in 0.4;
// « Restore » puts back the shipped instruction only (the name, the letter and the tile label
// stay the person's). An invalid instruction is said here and never saved.
function InstructionEditor({ action, settings, defaultOpen, onChange, onDelete }: {
  action: ActionDefinition; settings: Settings; defaultOpen: boolean; onChange: (patch: (action: ActionDefinition) => ActionDefinition, immediate: boolean) => void; onDelete: () => void;
}) {
  const t = useT();
  const language = useLanguage();
  const shipped = shippedInstruction(action.id);
  const modified = shipped !== undefined && action.promptTemplate !== shipped;
  const count = [...action.promptTemplate].length;
  const invalid = promptError(action.promptTemplate) !== null;
  const used = settings.defaultActionId === action.id || settings.shortcutBindings.some(binding => binding.actionId === action.id);
  const ilot = settings.uiVersion === 'ilot';
  const first = action.promptTemplate.split('\n')[0];
  return <Collapsible.Root className="ft-row st-instr" defaultOpen={defaultOpen} data-action={action.id}>
    <Collapsible.Trigger className="ft-row-main st-instr-trigger">
      <span className="ft-row-icon" aria-hidden="true"><ActionGlyph action={action} /></span>
      <span className="ft-row-copy"><strong>{action.name || t('actions.untitled')}</strong><small>{first.slice(0, 90)}{first.length > 90 ? '…' : ''}</small></span>
      <span className="st-chip" data-kind={shipped !== undefined ? (modified ? 'accent' : undefined) : 'custom'}>{t(shipped !== undefined ? (modified ? 'page.actions.modified' : 'actions.builtIn') : 'actions.custom')}</span>
      <ChevronRight className="st-chevron" {...ICON} aria-hidden="true" />
    </Collapsible.Trigger>
    <Collapsible.Content className="st-collapse">
      <div className="st-instr-edit">
        <div className="st-instr-name" data-two={ilot ? '' : undefined}>
          <div>
            <label className="st-mini-label" htmlFor={`name-${action.id}`}>{t('actions.name')}</label>
            <Input id={`name-${action.id}`} value={action.name} maxLength={nameMaxLength} aria-invalid={!action.name.trim() || undefined} onChange={event => onChange(item => ({ ...item, name: event.target.value }), false)} />
          </div>
          {/* The tile's label in the Îlot (1 to 16 characters); empty, the tile shows the name. */}
          {ilot && <div>
            <label className="st-mini-label" htmlFor={`short-${action.id}`}>{t('actions.shortName')}</label>
            <Input id={`short-${action.id}`} value={action.shortName ?? ''} maxLength={shortNameMaxLength} placeholder={action.name}
              onChange={event => onChange(({ shortName: _old, ...item }) => event.target.value.trim() ? { ...item, shortName: event.target.value } : item, false)} />
          </div>}
        </div>
        <label className="st-mini-label" htmlFor={`instr-${action.id}`}>{t('actions.instruction')}</label>
        <textarea id={`instr-${action.id}`} className="ft-input st-textarea" rows={6} spellCheck={false} value={action.promptTemplate} aria-label={t('actions.instructionFor', { name: action.name })} aria-invalid={invalid || undefined}
          onChange={event => onChange(item => ({ ...item, promptTemplate: event.target.value }), false)} />
        <div className="st-instr-foot">
          <span className={invalid ? 'st-instr-count st-bad' : 'st-instr-count'} role={invalid ? 'alert' : undefined}>{invalid ? t('page.actions.countInvalid') : t('page.actions.count', { count: new Intl.NumberFormat(locales[language]).format(count) })}</span>
          <span className="st-instr-actions">
            {shipped !== undefined && <Button size="sm" variant="ghost" icon={<RotateCcw {...ICON} size={14} />} disabled={!modified} onClick={() => onChange(item => ({ ...item, promptTemplate: shipped }), true)}>{t('actions.restore')}</Button>}
            {!isCurrentDefault(action.id) && <Button size="sm" variant="danger" icon={<Trash2 {...ICON} size={14} />} disabled={used} title={used ? t('actions.inUseHint') : undefined} onClick={onDelete}>{t('actions.delete')}{used ? t('actions.inUse') : ''}</Button>}
          </span>
        </div>
        <p className="st-footnote">{t('page.actions.instructionNote')}</p>
      </div>
    </Collapsible.Content>
  </Collapsible.Root>;
}

// « Actions »: the Îlot's grid (order, letters, which ones) under its live preview, then each
// action's instruction. Action names are the person's own data.
export function ActionsPage() {
  const t = useT();
  const { settings, persist } = useSettingsContext();
  const [fresh, setFresh] = useState<string | null>(null);
  const ilot = settings.uiVersion === 'ilot';
  const full = settings.actions.length >= actionLimit;
  const edit = (id: string, patch: (action: ActionDefinition) => ActionDefinition, immediate: boolean) => persist({ ...settings, actions: settings.actions.map(action => action.id === id ? patch(action) : action) }, immediate);
  const add = () => {
    if (full) return;
    const id = crypto.randomUUID();
    setFresh(id);
    persist({ ...settings, actions: [...settings.actions, { id, name: tNow('actions.newName'), promptTemplate: newActionTemplate }] }, true);
  };
  const menuFull = settings.menuActionIds.length >= gridLimit;
  return <>
    {ilot && <>
      <IlotPreview settings={settings} />
      <Group title={t('grid.title')} description={t('grid.intro')}>
        <MenuGrid settings={settings} persist={persist} />
      </Group>
      <p className="st-footnote st-footnote-tight">{t('page.actions.free')} <Keycap size="sm">{t('page.key.space')}</Keycap> {t('page.actions.or')} <Keycap size="sm">/</Keycap>{t('page.actions.freeEnd')}{menuFull && t('page.actions.full')}</p>
    </>}

    <Group title={t('actions.instructions')} description={t('actions.intro')}
      action={<Button size="sm" variant="ghost" icon={<Plus {...ICON} size={15} />} disabled={full} title={full ? t('page.actions.limit') : undefined} onClick={add}>{t('actions.add')}</Button>}>
      <div data-field="instructions" className="st-instr-list">
        {settings.actions.map(action => <InstructionEditor key={action.id} action={action} settings={settings} defaultOpen={fresh === action.id}
          onChange={(patch, immediate) => edit(action.id, patch, immediate)} onDelete={() => persist(deleteAction(settings, action.id), true)} />)}
      </div>
    </Group>
  </>;
}
