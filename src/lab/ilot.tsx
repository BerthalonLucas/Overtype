import { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Ilot, type IlotHandle, type IlotShape } from '../menu/Ilot';
import type { IlotAction, IlotMode } from '../menu/keys';
import { ilotMetrics } from '../menu/metrics';
import type { ShapeChange } from '../menu/MorphSurface';
import type { IlotScenario } from './scenarios';
import './ilot.css';

// Lab fixture of the Îlot (lot 7), in the browser only: the component driven by its props, the
// way the overlay will drive it, on fictitious data. Parameters: scenario, theme, preset, motion
// (as every frame), and lang (en | fr), actions (how many, 0-7), last (an action id),
// hold=1 (no automatic return after a choice, for the tests), origin (top | bottom).

// The lab's actions (design-lab/src/data.js:5-12), named as they would be at their creation in
// each language (default decision 8); the letters stay F T P S E.
const english: IlotAction[] = [
  { id: 'fix', name: 'Fix grammar', shortName: 'Fix', key: 'F', icon: 'SpellCheck' },
  { id: 'translate', name: 'Translate', key: 'T', icon: 'Languages' },
  { id: 'pro', name: 'Make professional', shortName: 'Pro', key: 'P', icon: 'BriefcaseBusiness' },
  { id: 'shorten', name: 'Shorten', key: 'S', icon: 'FoldVertical' },
  { id: 'email', name: 'Write email', shortName: 'Email', key: 'E', icon: 'Mail' },
  { id: 'formal', name: 'Formal tone', shortName: 'Formal', key: 'O' },
  { id: 'summary', name: 'Summarize', shortName: 'Summary', key: 'U' },
];
const french: IlotAction[] = [
  { id: 'fix', name: 'Corriger', key: 'F', icon: 'SpellCheck' },
  { id: 'translate', name: 'Traduire', key: 'T', icon: 'Languages' },
  { id: 'pro', name: 'Rendre professionnel', shortName: 'Pro', key: 'P', icon: 'BriefcaseBusiness' },
  { id: 'shorten', name: 'Raccourcir', key: 'S', icon: 'FoldVertical' },
  { id: 'email', name: 'Rédiger un mail', shortName: 'Mail', key: 'E', icon: 'Mail' },
  { id: 'formal', name: 'Ton soutenu', shortName: 'Soutenu', key: 'O' },
  { id: 'summary', name: 'Résumer', key: 'U' },
];

// What the Îlot gave, for the tests and the readout: action ids, and only the length of an
// instruction (never its text, as everywhere in the app).
type IlotEvent =
  | { type: 'choose'; actionId: string }
  | { type: 'instruction'; length: number }
  | { type: 'close' }
  | { type: 'key'; key: string; used: boolean };
declare global {
  interface Window {
    __ilotEvents?: IlotEvent[];
    __ilotShapes?: ShapeChange[];
  }
}

// The keys Rust forwards when the window could not take the keyboard (menu-key, KeyboardEvent.key).
const injectable: Array<[string, string]> = [
  ['Enter', 'Entrée'],
  ['Tab', 'Tab'],
  ['ArrowLeft', '←'],
  ['ArrowUp', '↑'],
  ['ArrowDown', '↓'],
  ['ArrowRight', '→'],
  ['Escape', 'Échap'],
  ['f', 'F'],
  ['t', 'T'],
  ['e', 'E'],
  ['1', '1'],
  ['6', '6'],
  [' ', 'Espace'],
];

function describe(event: IlotEvent | undefined): string {
  if (!event) return 'Aucun événement';
  if (event.type === 'choose') return `Action choisie : ${event.actionId}`;
  if (event.type === 'instruction') return `Consigne envoyée (${event.length} caractères)`;
  if (event.type === 'close') return 'Fermé par Échap';
  return `Touche reçue : ${event.key === ' ' ? 'Espace' : event.key} (${event.used ? 'utilisée' : 'ignorée'})`;
}

export function IlotFixture({ scenario, params }: { scenario: IlotScenario; params: URLSearchParams }) {
  const hold = params.get('hold') === '1';
  const count = Math.max(0, Math.min(7, Number(params.get('actions') ?? 5) || 0));
  const actions = (params.get('lang') === 'fr' ? french : english).slice(0, count);
  const initialMode: IlotMode = scenario === 'ilot-grid' ? 'grid' : scenario === 'ilot-prompt' ? 'prompt' : 'compact';
  const keyboard = scenario === 'ilot-injected' ? 'injected' : 'focused';
  const origin = params.get('origin') === 'bottom' ? 'bottom' : 'top';
  const [open, setOpen] = useState(true);
  const [shape, setShape] = useState<IlotShape>('menu');
  const [last, setLast] = useState(params.get('last') ?? 'fix');
  const [events, setEvents] = useState<IlotEvent[]>([]);
  const handle = useRef<IlotHandle>(null);
  const timer = useRef(0);

  const record = (event: IlotEvent) => {
    (window.__ilotEvents ??= []).push(event);
    setEvents((list) => [...list.slice(-4), event]);
  };
  const later = (ms: number, run: () => void) => {
    window.clearTimeout(timer.current);
    if (!hold) timer.current = window.setTimeout(run, ms);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  // A choice turns the Îlot into the work pill, as the overlay will; here it comes back.
  const work = () => {
    setShape('pill');
    later(1600, () => setShape('menu'));
  };

  // Rust's `menu-key` event, as a window event in the browser.
  useEffect(() => {
    const onKey = (event: Event) => {
      const key = (event as CustomEvent<{ key: string }>).detail?.key;
      if (typeof key !== 'string') return;
      record({ type: 'key', key, used: handle.current?.press(key) ?? false });
    };
    window.addEventListener('menu-key', onKey);
    return () => window.removeEventListener('menu-key', onKey);
  }, []);

  // The pill scenario goes back and forth on its own unless held.
  useEffect(() => {
    if (scenario !== 'ilot-pill' || hold) return;
    const loop = window.setInterval(() => setShape((current) => (current === 'menu' ? 'pill' : 'menu')), 1800);
    return () => window.clearInterval(loop);
  }, [scenario, hold]);

  return (
    <>
      <div className={`ilot-demo is-${origin}`}>
        <p className="ilot-demo-text">
          Could you send the <mark>updated proposal before Thursday?</mark>
        </p>
        <div className="ilot-demo-anchor">
          <AnimatePresence>
            {open && (
              <Ilot
                ref={handle}
                actions={actions}
                lastActionId={last}
                keyboard={keyboard}
                initialMode={initialMode}
                origin={origin}
                shape={shape}
                pill={{
                  key: 'working',
                  size: ilotMetrics.pill,
                  node: <span className="ilot-demo-orb" role="status" aria-label="Working" />,
                }}
                onShapeChange={(change) => {
                  (window.__ilotShapes ??= []).push(change);
                }}
                onChoose={(id) => {
                  record({ type: 'choose', actionId: id });
                  setLast(id);
                  work();
                }}
                onInstruction={(text) => {
                  record({ type: 'instruction', length: [...text].length });
                  work();
                }}
                onClose={() => {
                  record({ type: 'close' });
                  setOpen(false);
                  later(900, () => setOpen(true));
                }}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
      <div className="ilot-demo-bar">
        <output aria-live="polite">{describe(events[events.length - 1])}</output>
        <button type="button" onClick={() => setShape((current) => (current === 'menu' ? 'pill' : 'menu'))}>
          Menu ⇄ pilule
        </button>
        <button
          type="button"
          onClick={() => {
            setShape('menu');
            setOpen(false);
            window.setTimeout(() => setOpen(true), 250);
          }}
        >
          Rouvrir
        </button>
        {keyboard === 'injected' && (
          <span className="ilot-demo-keys" aria-label="Touche reçue de Rust">
            {injectable.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('menu-key', { detail: { key } }))}
              >
                {label}
              </button>
            ))}
          </span>
        )}
      </div>
    </>
  );
}
