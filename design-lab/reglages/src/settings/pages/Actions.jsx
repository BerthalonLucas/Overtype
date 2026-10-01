import { useState } from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUp, ArrowDown, ChevronRight, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Group, Switch, Button, IconButton, Keycap, Input, ICON } from '../../ui/index.jsx';
import { useTx } from '../../lib/motion.js';
import { useSettings, ACTION_ICONS, shippedInstruction } from '../state.js';

const LIMIT = 6;
// Tile labels (the app's shortName): the Îlot tile is 70 px wide.
const SHORT = { professionnel: 'Pro' };

// The Îlot as it will open beside a selection: the tiles in their order, each with its letter;
// the free instruction takes the last tile while there is room.
function IlotPreview({ actions, menuIds }) {
  const tx = useTx();
  const tiles = menuIds.map(id => actions.find(a => a.id === id)).filter(Boolean);
  const withFree = tiles.length < LIMIT ? [...tiles, { id: 'consigne', name: 'Consigne', key: 'Espace', free: true }] : tiles;
  return (
    <figure className="st-ilot-stage" aria-label="Aperçu du menu">
      <div className="st-ilot-text" aria-hidden="true">
        <span>Bonjour Julie,</span>
        <span><mark>je vous est envoyé le fichier hier soir</mark>, dite moi si sa convient.</span>
      </div>
      <div className="st-ilot">
        <div className="st-ilot-grid">
          <AnimatePresence initial={false} mode="popLayout">
            {withFree.map(a => {
              const Icon = ACTION_ICONS[a.id] || ACTION_ICONS.consigne;
              return (
                <motion.span key={a.id} layout className="st-ilot-tile" data-free={a.free ? '' : undefined}
                  initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={tx('smooth')}>
                  <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
                  <span className="st-ilot-label">{a.free ? 'Consigne' : SHORT[a.id] || a.name}</span>
                  {a.key && !a.free && <span className="st-ilot-key">{a.key}</span>}
                </motion.span>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
      <figcaption>Le menu, tel qu’il s’ouvre à côté de la sélection.</figcaption>
    </figure>
  );
}

function letterProblem(letter, id, actions) {
  if (!letter) return null;
  if (!/^\p{L}$/u.test(letter)) return 'Une seule lettre.';
  const other = actions.find(a => a.id !== id && a.key?.toUpperCase() === letter);
  return other ? `${letter} est déjà utilisée par ${other.name}.` : null;
}

function GridRow({ a, index, count, inMenu, canAdd, onMove, onToggle, onLetter, problem, draft }) {
  const Icon = ACTION_ICONS[a.id] || ACTION_ICONS.consigne;
  const tx = useTx();
  return (
    <motion.li layout="position" transition={tx('smooth')} className="st-grid-row" data-off={inMenu ? undefined : ''}>
      <span className="st-grid-index" aria-hidden="true">{inMenu ? index + 1 : ''}</span>
      <span className="st-grid-tile" aria-hidden="true"><Icon {...ICON} /></span>
      <span className="st-grid-name">{a.name}</span>
      <span className="st-grid-letter">
        <input aria-label={`Lettre de ${a.name}`} value={draft ?? a.key ?? ''} maxLength={2} spellCheck={false} autoComplete="off"
          aria-invalid={problem ? true : undefined} onFocus={e => e.currentTarget.select()} onChange={e => onLetter(e.target.value.slice(-1).toUpperCase())} />
      </span>
      <span className="st-grid-moves">
        <IconButton size="sm" label={`Monter ${a.name}`} disabled={!inMenu || index === 0} onClick={() => onMove(-1)}><ArrowUp {...ICON} size={15} /></IconButton>
        <IconButton size="sm" label={`Descendre ${a.name}`} disabled={!inMenu || index === count - 1} onClick={() => onMove(1)}><ArrowDown {...ICON} size={15} /></IconButton>
      </span>
      <Switch checked={inMenu} disabled={!inMenu && !canAdd} onCheckedChange={onToggle} label={`${a.name} dans le menu`} />
      {problem && <p className="st-grid-problem" role="alert">{problem}</p>}
    </motion.li>
  );
}

function InstructionBody({ a, onChange, onDelete }) {
  const shipped = shippedInstruction(a.id);
  const modified = shipped != null && a.instruction !== shipped;
  const count = [...a.instruction].length;
  const invalid = !a.instruction.trim() || count > 8000;
  return (
    <div className="st-instr-edit">
      {!a.builtIn && (
        <div className="st-instr-name">
          <label className="st-mini-label" htmlFor={`name-${a.id}`}>Nom de l’action</label>
          <Input id={`name-${a.id}`} value={a.name} onChange={e => onChange({ name: e.target.value })} />
        </div>
      )}
      <label className="st-mini-label" htmlFor={`instr-${a.id}`}>Consigne</label>
      <textarea id={`instr-${a.id}`} className="ft-input st-textarea" rows={6} spellCheck={false} value={a.instruction} aria-invalid={invalid || undefined}
        onChange={e => onChange({ instruction: e.target.value })} />
      <div className="st-instr-foot">
        <span className={invalid ? 'st-instr-count st-bad' : 'st-instr-count'}>{invalid ? 'De 1 à 8 000 caractères.' : `${count.toLocaleString('fr-FR')} / 8 000`}</span>
        <span className="st-instr-actions">
          {a.builtIn
            ? <Button size="sm" variant="ghost" icon={<RotateCcw {...ICON} size={14} />} disabled={!modified} onClick={() => onChange({ instruction: shipped })}>Rétablir la consigne</Button>
            : <Button size="sm" variant="danger" icon={<Trash2 {...ICON} size={14} />} onClick={onDelete}>Supprimer l’action</Button>}
        </span>
      </div>
      <p className="st-footnote">Écrivez la langue voulue dans la consigne. Le texte sélectionné est envoyé après elle.</p>
    </div>
  );
}

function InstructionHead({ a }) {
  const shipped = shippedInstruction(a.id);
  const modified = shipped != null && a.instruction !== shipped;
  const Icon = ACTION_ICONS[a.id] || ACTION_ICONS.consigne;
  return (
    <>
      <span className="ft-row-icon" aria-hidden="true"><Icon {...ICON} /></span>
      <span className="ft-row-copy"><strong>{a.name || 'Action sans nom'}</strong><small>{a.instruction.split('\n')[0].slice(0, 90)}{a.instruction.length > 90 ? '…' : ''}</small></span>
      <span className="st-chip" data-kind={a.builtIn ? (modified ? 'accent' : undefined) : 'custom'}>{a.builtIn ? (modified ? 'Modifiée' : 'Prédéfinie') : 'Personnalisée'}</span>
    </>
  );
}

// The instruction unfolds in place.
function InstructionEditor({ a, onChange, onDelete, defaultOpen }) {
  return (
    <Collapsible.Root className="ft-row st-instr" defaultOpen={defaultOpen}>
      <Collapsible.Trigger className="ft-row-main st-instr-trigger">
        <InstructionHead a={a} />
        <ChevronRight className="st-chevron" {...ICON} aria-hidden="true" />
      </Collapsible.Trigger>
      <Collapsible.Content className="st-collapse">
        <InstructionBody a={a} onChange={onChange} onDelete={onDelete} />
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
export function ActionsPage() {
  const { s, set } = useSettings();
  const [problems, setProblems] = useState({});
  const [drafts, setDrafts] = useState({});
  const [fresh, setFresh] = useState(null);
  const inMenu = s.menuIds.map(id => s.actions.find(a => a.id === id)).filter(Boolean);
  const outMenu = s.actions.filter(a => !s.menuIds.includes(a.id));
  const canAdd = s.menuIds.length < LIMIT;

  const move = (id, d) => set(v => {
    const ids = [...v.menuIds]; const i = ids.indexOf(id); const j = i + d;
    if (j < 0 || j >= ids.length) return {};
    [ids[i], ids[j]] = [ids[j], ids[i]];
    return { menuIds: ids };
  });
  const toggle = (id, on) => set(v => ({ menuIds: on ? (v.menuIds.length < LIMIT ? [...v.menuIds, id] : v.menuIds) : v.menuIds.filter(x => x !== id) }));
  const letter = (a, l) => {
    const p = letterProblem(l, a.id, s.actions);
    setProblems(x => ({ ...x, [a.id]: p }));
    setDrafts(x => ({ ...x, [a.id]: p ? l : undefined }));
    if (!p) set(v => ({ actions: v.actions.map(x => (x.id === a.id ? { ...x, key: l || undefined } : x)) }));
  };
  const patch = (id, change) => set(v => ({ actions: v.actions.map(x => (x.id === id ? { ...x, ...change } : x)) }));
  const addAction = () => {
    const id = `perso-${Date.now().toString(36)}`;
    setFresh(id);
    set(v => ({ actions: [...v.actions, { id, name: 'Nouvelle action', instruction: 'Transform the text as follows: describe the change you want here.', builtIn: false }] }));
  };
  const remove = id => set(v => ({ actions: v.actions.filter(a => a.id !== id), menuIds: v.menuIds.filter(x => x !== id), bindings: v.bindings.filter(b => b.actionId !== id) }));

  return (
    <>
      <IlotPreview actions={s.actions} menuIds={s.menuIds} />

      <Group title="Dans le menu" description="Six au plus, dans cet ordre. Une lettre en lance une depuis le menu.">
        <ol className="st-grid-list" data-field="grid" aria-label="Actions du menu">
          {inMenu.map((a, i) => (
            <GridRow key={a.id} a={a} index={i} count={inMenu.length} inMenu canAdd={canAdd} problem={problems[a.id]} draft={drafts[a.id]}
              onMove={d => move(a.id, d)} onToggle={on => toggle(a.id, on)} onLetter={l => letter(a, l)} />
          ))}
          {outMenu.map(a => (
            <GridRow key={a.id} a={a} index={-1} count={0} inMenu={false} canAdd={canAdd} problem={problems[a.id]} draft={drafts[a.id]}
              onMove={() => {}} onToggle={on => toggle(a.id, on)} onLetter={l => letter(a, l)} />
          ))}
        </ol>
      </Group>
      <p className="st-footnote st-footnote-tight">Consigne libre : <Keycap size="sm">Espace</Keycap> ou <Keycap size="sm">/</Keycap>, et la dernière tuile tant qu’il reste de la place.{!canAdd && ' Le menu est plein : retirez une action pour en ajouter une autre.'}</p>

      <Group title="Consignes" description="La consigne seule ; le texte sélectionné est envoyé après elle."
        action={<Button size="sm" variant="ghost" icon={<Plus {...ICON} size={15} />} onClick={addAction}>Ajouter une action</Button>}>
        <div data-field="instructions" className="st-instr-list">
          {s.actions.map(a => <InstructionEditor key={a.id} a={a} defaultOpen={fresh === a.id} onChange={c => patch(a.id, c)} onDelete={() => remove(a.id)} />)}
        </div>
      </Group>
    </>
  );
}
