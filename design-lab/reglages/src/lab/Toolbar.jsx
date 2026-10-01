// The lab toolbar, v2: what to look at (section) and how (theme, speed, reduced motion, simulated
// server), plus the alternatives Lucas has not decided yet (neutral base, page-colour set, switch),
// each with 👍/👎 and a note. Its own geometry never changes; its colours follow base and theme.
import { useEffect, useRef, useState } from 'react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import * as SelectPrimitive from '@radix-ui/react-select';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, ChevronUp, Check, ClipboardCopy, NotebookPen, RotateCcw, Server, SlidersHorizontal } from 'lucide-react';
import { useLab, SECTIONS } from './store.jsx';
import { usePortalContainer } from './Scope.jsx';
import { Vote } from './Vote.jsx';
import { buildChoices, copyText } from './copy.js';
import { PALETTES, PALETTE_BY_ID, PAGE_SETS, PAGE_SET_BY_ID, PAGES, pageColor, SWITCH_STYLES, THEMES, SPEEDS } from '../tokens/index.js';
import { SCENARIOS, SCENARIO_BY_ID } from '../mock/server.js';
import { AppMark } from '../stage/Desktop.jsx';
import { Dialog, Button } from '../ui/index.jsx';
import { tx } from '../lib/motion.js';

function Seg({ label, value, options, onChange, className = '' }) {
  return (
    <ToggleGroup.Root type="single" className={`lab-seg ${className}`} aria-label={label} value={String(value)}
      onValueChange={v => { if (v) onChange(v); }}>
      {options.map(o => (
        <ToggleGroup.Item key={o.id} value={String(o.id)} className="lab-seg-item" title={o.title || o.note}>
          {o.content ?? o.name}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}

function Labelled({ label, children }) {
  return <div className="lab-field"><span className="lab-field-label">{label}</span><div className="lab-field-control">{children}</div></div>;
}

// Neutral base: a swatch (light half / dark half) + its name.
function BaseLabel({ p }) {
  return <span className="lab-seg-rich"><i className="lab-dot" style={{ '--a': p.light.accent, '--b': p.dark.accent }} />{p.name}</span>;
}
// Page-colour set: its 7 hues in a strip (in the current base and theme).
function SetLabel({ set, base, theme }) {
  return (
    <span className="lab-seg-rich">
      <span className="lab-hues" aria-hidden="true">{PAGES.filter(id => id !== 'diagnostic').map(id => <i key={id} style={{ background: pageColor(set.id, id, base, theme).hue }} />)}</span>
      {set.id}
    </span>
  );
}

function ScenarioSelect({ value, onChange }) {
  const container = usePortalContainer();
  return (
    <SelectPrimitive.Root value={value} onValueChange={onChange}>
      <SelectPrimitive.Trigger className="lab-select" aria-label="Scénario du serveur simulé">
        <Server size={14} strokeWidth={1.75} aria-hidden="true" />
        <SelectPrimitive.Value />
        <ChevronDown size={14} strokeWidth={1.75} aria-hidden="true" />
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal container={container}>
        <SelectPrimitive.Content className="lab-pop lab-select-pop" position="popper" sideOffset={6}>
          <SelectPrimitive.Viewport>
            {SCENARIOS.map(s => (
              <SelectPrimitive.Item key={s.id} value={s.id} className="lab-option">
                <span className="lab-option-text"><SelectPrimitive.ItemText>{s.label}</SelectPrimitive.ItemText><small>{s.hint}</small></span>
                <SelectPrimitive.ItemIndicator><Check size={14} strokeWidth={2} /></SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

function NotesButton() {
  const lab = useLab();
  const container = usePortalContainer();
  const has = !!lab.notes._general;
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <button type="button" className="lab-btn" data-has={has ? '' : undefined}><NotebookPen size={14} strokeWidth={1.75} aria-hidden="true" /><span>Notes</span></button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal container={container}>
        <PopoverPrimitive.Content className="lab-pop" sideOffset={6} align="end">
          <label className="lab-pop-label" htmlFor="lab-notes">Vos notes (copiées avec vos choix)</label>
          <textarea id="lab-notes" className="lab-textarea" rows={6} value={lab.notes._general || ''} placeholder="Ce que vous voulez garder, changer, essayer."
            onChange={e => lab.note('_general', e.target.value)} autoFocus />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

function CopyButton({ onToast }) {
  const lab = useLab();
  const [fallback, setFallback] = useState(null);
  const count = Object.keys(lab.votes).length;
  const onClick = async () => {
    const text = buildChoices(lab);
    const ok = await copyText(text);
    if (ok) onToast('Choix copiés : collez-les dans la conversation.');
    else setFallback(text);
  };
  return (
    <>
      <button type="button" className="lab-btn lab-btn-primary" onClick={onClick}>
        <ClipboardCopy size={14} strokeWidth={1.75} aria-hidden="true" /><span>Copier mes choix</span>
        {count > 0 && <span className="lab-count" aria-label={`${count} avis`}>{count}</span>}
      </button>
      <Dialog open={!!fallback} onOpenChange={o => { if (!o) setFallback(null); }} title="Copiez vos choix"
        description="Le presse-papiers est bloqué ici. Le texte est sélectionné : Ctrl+C, puis collez-le dans la conversation." width={560}
        actions={<Button variant="primary" onClick={() => setFallback(null)}>Terminé</Button>}>
        <textarea className="lab-textarea lab-textarea-big" readOnly value={fallback || ''} rows={14} ref={el => { if (el) { el.focus(); el.select(); } }} />
      </Dialog>
    </>
  );
}

function useNarrow(query = '(max-width: 700px)') {
  const get = () => { try { return window.matchMedia(query).matches; } catch { return false; } };
  const [v, setV] = useState(get);
  useEffect(() => {
    let mq; try { mq = window.matchMedia(query); } catch { return undefined; }
    const on = () => setV(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, [query]);
  return v;
}

// The « how » controls (theme, speed, reduced motion, server, open alternatives): one row on a
// wide screen, a sheet behind « Labo » on a phone.
function LabFields() {
  const lab = useLab();
  return (
    <>
      <Labelled label="Thème">
        <Seg label="Thème" value={lab.theme} options={THEMES} onChange={v => lab.set({ theme: v })} />
      </Labelled>
      <Labelled label="Vitesse">
        <Seg label="Vitesse des animations" value={lab.speed} options={SPEEDS.map(s => ({ ...s, title: s.id === 1 ? 'Vitesse réelle' : `${s.id} fois plus lent` }))} onChange={v => lab.set({ speed: Number(v) })} />
      </Labelled>
      <Labelled label="Mouvement réduit">
        <SwitchPrimitive.Root className="lab-switch" checked={!!lab.reduced} onCheckedChange={c => lab.set({ reduced: c })} aria-label="Mouvement réduit">
          <SwitchPrimitive.Thumb className="lab-switch-thumb" />
        </SwitchPrimitive.Root>
        {lab.systemReduced && <span className="lab-hint" title="Windows demande de réduire les animations">appareil : réduit</span>}
      </Labelled>
      <Labelled label="Serveur simulé">
        <ScenarioSelect value={lab.scenario} onChange={v => lab.set({ scenario: v })} />
      </Labelled>
    </>
  );
}

// The alternatives Lucas has not decided yet, each with 👍/👎 + note.
function OpenChoices() {
  const lab = useLab();
  const base = PALETTE_BY_ID[lab.base];
  const set = PAGE_SET_BY_ID[lab.pageSet];
  const sw = SWITCH_STYLES.find(x => x.id === lab.switchStyle);
  return (
    <>
      <Labelled label="Base neutre">
        <Seg label="Base neutre" value={lab.base} options={PALETTES.map(p => ({ id: p.id, name: p.name, title: `${p.long} — ${p.note}`, content: <BaseLabel p={p} /> }))} onChange={v => lab.set({ base: v })} />
        <Vote id={`shell.base.${lab.base}`} label={`Base neutre « ${base?.long} »`} section="shell" compact />
      </Labelled>
      <Labelled label="Couleurs par page">
        <Seg label="Jeu de couleurs par page" value={lab.pageSet} options={PAGE_SETS.map(x => ({ id: x.id, name: x.name, title: `${x.name} — ${x.note}`, content: <SetLabel set={x} base={lab.base} theme={lab.resolvedTheme} /> }))} onChange={v => lab.set({ pageSet: v })} />
        <Vote id={`shell.pageset.${lab.pageSet}`} label={`Couleurs par page, jeu ${set?.name}`} section="shell" compact />
      </Labelled>
      <Labelled label="Interrupteur">
        <Seg label="Interrupteur" value={lab.switchStyle} options={SWITCH_STYLES.map(x => ({ ...x, title: x.note }))} onChange={v => lab.set({ switchStyle: v })} />
        <Vote id={`shell.switch.${lab.switchStyle}`} label={`Interrupteur « ${sw?.name} » en conditions réelles`} section="shell" compact />
      </Labelled>
    </>
  );
}

function LabSheetButton() {
  const container = usePortalContainer();
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <button type="button" className="lab-btn lab-btn-labo"><SlidersHorizontal size={14} strokeWidth={1.75} aria-hidden="true" /><span className="lab-keep">Labo</span></button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal container={container}>
        <PopoverPrimitive.Content className="lab-pop lab-sheet" sideOffset={6} align="end" collisionPadding={8} aria-label="Réglages du labo">
          <LabFields />
          <p className="lab-sheet-title">À trancher</p>
          <OpenChoices />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

export function Toolbar() {
  const lab = useLab();
  const narrow = useNarrow();
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(0);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const showToast = (msg) => { setToast(msg); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 2600); };

  const collapsed = !lab.toolbarOpen;
  const summary = `${PALETTE_BY_ID[lab.base]?.name} · jeu ${lab.pageSet} · ${THEMES.find(t => t.id === lab.theme)?.name}`;
  const sections = <Seg label="Section" className="lab-sections" value={lab.section} options={SECTIONS.map(s => ({ id: s.id, name: narrow ? s.short : s.name }))} onChange={v => lab.set({ section: v })} />;

  return (
    <>
      {collapsed ? (
        <div className="lab-mini">
          <button type="button" className="lab-mini-btn" onClick={() => lab.set({ toolbarOpen: true })} aria-label="Déplier la barre du labo">
            <AppMark size={16} /><span>{SECTIONS.find(s => s.id === lab.section)?.short}</span><span className="lab-mini-sum">{summary}</span><ChevronDown size={14} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      ) : narrow ? (
        // Phone: every action in view (« Copier mes choix » first), the sections on their own
        // line, the other controls in the « Labo » sheet.
        <header className="lab-bar" data-narrow="">
          <div className="lab-row">
            <div className="lab-brand"><AppMark size={18} /></div>
            <div className="lab-actions">
              <CopyButton onToast={showToast} />
              <LabSheetButton />
              <button type="button" className="lab-btn" onClick={lab.restart} aria-label="Recommencer la section" title="Recommencer"><RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" /></button>
              <NotesButton />
              <button type="button" className="lab-icon" onClick={() => lab.set({ toolbarOpen: false })} aria-label="Replier la barre du labo" title="Replier la barre"><ChevronUp size={16} strokeWidth={1.75} /></button>
            </div>
          </div>
          <div className="lab-row lab-row-sections">{sections}</div>
        </header>
      ) : (
        <header className="lab-bar">
          <div className="lab-row">
            <div className="lab-brand"><AppMark size={18} /><strong>Labo Réglages</strong></div>
            {sections}
            <div className="lab-actions">
              <button type="button" className="lab-btn" onClick={lab.restart} title="Rejouer la section depuis le début"><RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" /><span>Recommencer</span></button>
              <NotesButton />
              <CopyButton onToast={showToast} />
              <button type="button" className="lab-icon" onClick={() => lab.set({ toolbarOpen: false })} aria-label="Replier la barre du labo" title="Replier la barre"><ChevronUp size={16} strokeWidth={1.75} /></button>
            </div>
          </div>
          <div className="lab-row lab-row-2"><LabFields /></div>
          <div className="lab-row lab-row-2 lab-row-open"><span className="lab-open-title">À trancher</span><OpenChoices /></div>
          <p className="lab-note">{PALETTE_BY_ID[lab.base]?.long} : {PALETTE_BY_ID[lab.base]?.note} <span>·</span> Jeu {PAGE_SET_BY_ID[lab.pageSet]?.name} : {PAGE_SET_BY_ID[lab.pageSet]?.note} <span>·</span> Serveur : {SCENARIO_BY_ID[lab.scenario]?.hint}.</p>
        </header>
      )}
      <AnimatePresence>
        {toast && (
          <motion.div className="lab-toast" role="status" initial={{ opacity: 0, y: -8, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: -6, x: '-50%' }} transition={tx('smooth')}>
            <Check size={15} strokeWidth={2} aria-hidden="true" />{toast}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
