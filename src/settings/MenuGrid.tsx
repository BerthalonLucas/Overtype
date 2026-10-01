import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Icon, iconFromLucide } from '../ui';
import { useT } from '../i18n';
import { IconButton, ICON, Switch } from '../components/controls';
import { useTx } from '../components/motion';
import type { ActionDefinition, Settings } from '../types';
import { addToGrid, gridLimit, letterProblem, moveInGrid, nextLetter, removeFromGrid, withoutKey, type LetterProblem } from './grid';

// Each action with the icon its Îlot tile draws (the Lucide name it carries, actions.rs, resolved
// as src/menu/Ilot.tsx ActionIcon does): none when the app's registry lacks it (a custom action,
// an action migrated from 0.4), its slot left empty so the list stays aligned. The wand belongs
// to the free instruction alone (review of bc57857, finding 7).

type Props = { settings: Settings; persist: (settings: Settings, immediate: boolean) => void };
// « In the menu » (design-lab/reglages/src/settings/pages/Actions.jsx): every action in one
// ordered list, the Îlot's tiles first in their order (6 at most, decision 6), each with its
// letter, arrows to move it (keyboard included) and a switch that takes it in or out of the menu.
// A letter is checked here, in line, before anything is saved.
export function MenuGrid({ settings, persist }: Props) {
  const t = useT();
  const tx = useTx();
  const grid = settings.menuActionIds.map(id => settings.actions.find(action => action.id === id)).filter((action): action is ActionDefinition => Boolean(action));
  const others = settings.actions.filter(action => !settings.menuActionIds.includes(action.id));
  const canAdd = grid.length < gridLimit;
  // An invalid letter stays in its field with its reason, unsaved.
  const [drafts, setDrafts] = useState<Record<string, { letter: string; problem: LetterProblem }>>({});
  // A moved row is re-inserted in the DOM, which drops the focus: give it back to its button.
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const [refocus, setRefocus] = useState<string | null>(null);
  useEffect(() => {
    if (!refocus) return;
    const [id, direction] = refocus.split('\n');
    const other = direction === 'up' ? 'down' : 'up';
    const target = buttons.current.get(`${id}\n${direction}`);
    (target && !target.disabled ? target : buttons.current.get(`${id}\n${other}`))?.focus();
    setRefocus(null);
  }, [refocus]);
  const move = (id: string, delta: -1 | 1) => { persist({ ...settings, menuActionIds: moveInGrid(settings.menuActionIds, id, delta) }, true); setRefocus(`${id}\n${delta < 0 ? 'up' : 'down'}`); };
  const forget = (id: string) => setDrafts(({ [id]: _removed, ...rest }) => rest);
  const setLetter = (action: ActionDefinition, typed: string) => {
    const letter = nextLetter(typed, drafts[action.id]?.letter ?? action.key ?? '');
    const problem = letterProblem(letter, action.id, settings.actions);
    setDrafts(({ [action.id]: _previous, ...rest }) => problem ? { ...rest, [action.id]: { letter, problem } } : rest);
    if (!problem) persist({ ...settings, actions: settings.actions.map(item => item.id !== action.id ? item : letter ? { ...item, key: letter } : withoutKey(item)) }, true);
  };
  const toggle = (action: ActionDefinition, on: boolean) => { forget(action.id); persist(on ? addToGrid(settings, action.id) : removeFromGrid(settings, action.id), true); };
  const ref = (key: string) => (element: HTMLButtonElement | null) => { if (element) buttons.current.set(key, element); else buttons.current.delete(key); };
  const row = (action: ActionDefinition, index: number, inMenu: boolean) => {
    const draft = drafts[action.id];
    const letterId = `grid-letter-${action.id}`;
    const glyph = iconFromLucide(action.icon);
    const name = action.name || t('actions.untitled');
    return <motion.li key={action.id} layout="position" transition={tx('smooth')} className="st-grid-row" data-off={inMenu ? undefined : ''} data-invalid={draft ? true : undefined} data-action={action.id}>
      <span className="st-grid-index" aria-hidden="true">{inMenu ? index + 1 : ''}</span>
      <span className="st-grid-tile" data-icon={glyph} aria-hidden="true">{glyph && <Icon name={glyph} size={16} />}</span>
      <span className="st-grid-name">{name}</span>
      <span className="st-grid-letter">
        {/* Out of the menu an action keeps no letter (grid.ts): the field waits for it to come back. */}
        <input id={letterId} aria-label={t('grid.letter', { name })} aria-invalid={draft ? true : undefined} aria-describedby={draft ? `${letterId}-problem` : undefined} value={draft?.letter ?? action.key ?? ''} maxLength={4}
          disabled={!inMenu} autoComplete="off" spellCheck={false} onFocus={event => event.currentTarget.select()} onChange={event => setLetter(action, event.target.value)} />
      </span>
      <span className="st-grid-moves">
        <IconButton ref={ref(`${action.id}\nup`)} size="sm" label={t('grid.up', { name })} disabled={!inMenu || index === 0} onClick={() => move(action.id, -1)}><ArrowUp {...ICON} size={15} /></IconButton>
        <IconButton ref={ref(`${action.id}\ndown`)} size="sm" label={t('grid.down', { name })} disabled={!inMenu || index === grid.length - 1} onClick={() => move(action.id, 1)}><ArrowDown {...ICON} size={15} /></IconButton>
      </span>
      <Switch checked={inMenu} disabled={!inMenu && !canAdd} onCheckedChange={on => toggle(action, on)} label={t('page.actions.inMenu', { name })} />
      {draft && <p id={`${letterId}-problem`} className="st-grid-problem" role="alert">{t(draft.problem.key, draft.problem.params)}</p>}
    </motion.li>;
  };
  return <ol className="st-grid-list" data-field="grid" aria-label={t('grid.list')}>
    {grid.map((action, index) => row(action, index, true))}
    {others.map(action => row(action, -1, false))}
  </ol>;
}
