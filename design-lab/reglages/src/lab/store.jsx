// Lab state: what the toolbar picks, the votes (👍/👎) and the notes. Remembered in
// localStorage (per viewer, best effort: every access is wrapped).
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { setClock } from '../lib/motion.js';
import { setScenario } from '../mock/server.js';

const KEY = 'ft-labo-reglages-v2';
export const SECTIONS = [
  { id: 'parcours', name: 'Parcours complet', short: 'Parcours' },
  { id: 'reglages', name: 'Réglages', short: 'Réglages' },
  { id: 'demo', name: 'Démo', short: 'Démo' },
  { id: 'composants', name: 'Composants', short: 'Composants' },
  { id: 'effets', name: 'Effets', short: 'Effets' },
];

const DEFAULTS = {
  base: 'porcelaine',     // neutral base: 'porcelaine' | 'papier' (src/tokens/palettes.js)
  pageSet: 'A',           // one colour per page: set 'A' | 'B'
  switchStyle: 'ours',    // 'ours' (Radix, ressort Windows 11) | 'hero' (HeroUI v3)
  theme: 'system',
  speed: 1,
  reduced: null,          // null = follow the device
  section: 'parcours',
  scenario: 'ok',
  toolbarOpen: true,
  votes: {},              // { [id]: { v: 'up' | 'down', label, section } }
  notes: {},              // { [id]: string } — '_general' is the free note
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const saved = JSON.parse(raw);
    const out = { ...DEFAULTS, ...saved, votes: saved.votes || {}, notes: saved.notes || {} };
    if (!['porcelaine', 'papier'].includes(out.base)) out.base = DEFAULTS.base;
    if (!['A', 'B'].includes(out.pageSet)) out.pageSet = DEFAULTS.pageSet;
    if (!['ours', 'hero'].includes(out.switchStyle)) out.switchStyle = DEFAULTS.switchStyle;
    return out;
  } catch { return DEFAULTS; }
}
function save(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private window, blocked storage */ }
}

function useMedia(query) {
  const get = () => { try { return window.matchMedia(query).matches; } catch { return false; } };
  const [value, setValue] = useState(get);
  useEffect(() => {
    let mq; try { mq = window.matchMedia(query); } catch { return undefined; }
    const on = () => setValue(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, [query]);
  return value;
}

const LabContext = createContext(null);

export function LabProvider({ children }) {
  const [state, setState] = useState(load);
  const [restartKey, setRestartKey] = useState(0);
  const systemDark = useMedia('(prefers-color-scheme: dark)');
  const systemReduced = useMedia('(prefers-reduced-motion: reduce)');

  useEffect(() => { save(state); }, [state]);

  const resolvedTheme = state.theme === 'system' ? (systemDark ? 'dark' : 'light') : state.theme;
  const reduced = state.reduced == null ? systemReduced : state.reduced;

  // Keep the non-React clocks in step (motion helpers, mock server).
  setClock({ t: state.speed, reduced });
  useEffect(() => { setScenario(state.scenario); }, [state.scenario]);

  const set = useCallback((patch) => setState(s => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) })), []);
  const vote = useCallback((id, v, meta = {}) => setState(s => {
    const votes = { ...s.votes };
    if (!v || votes[id]?.v === v) delete votes[id];
    else votes[id] = { v, label: meta.label || id, section: meta.section || id.split('.')[0] };
    return { ...s, votes };
  }), []);
  const note = useCallback((id, text) => setState(s => {
    const notes = { ...s.notes };
    if (text && text.trim()) notes[id] = text; else delete notes[id];
    return { ...s, notes };
  }), []);
  const restart = useCallback(() => setRestartKey(k => k + 1), []);
  const resetAll = useCallback(() => { setState({ ...DEFAULTS, toolbarOpen: true }); setRestartKey(k => k + 1); }, []);

  const value = useMemo(() => ({
    ...state, theme: state.theme,
    direction: 'verre', palette: state.base, /* v1 names, kept for older code */ resolvedTheme, reduced, systemReduced, restartKey,
    set, vote, note, restart, resetAll,
  }), [state, resolvedTheme, reduced, systemReduced, restartKey, set, vote, note, restart, resetAll]);

  return <LabContext.Provider value={value}>{children}</LabContext.Provider>;
}

// Everything the lab knows: base ('porcelaine'|'papier'), pageSet ('A'|'B'), switchStyle
// ('ours'|'hero'), theme ('light'|'dark'|'system'), resolvedTheme, speed, reduced, section,
// scenario, restartKey, votes, notes, set(), vote(), note(), restart().
// (palette = base and direction = 'verre' are kept for v1 code.)
export function useLab() {
  const ctx = useContext(LabContext);
  if (!ctx) throw new Error('useLab() outside <LabProvider>');
  return ctx;
}
