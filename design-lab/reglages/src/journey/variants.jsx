// Shared variants of the first-run journey, chosen live from the Parcours lab bar AND from the
// Effets section (owner: Parcours agent). Effets imports:
//
//   import { HEARTBEATS, Heartbeat, STEP_TRANSITIONS, stepMotion, useJourneyPrefs } from '../journey/variants.jsx';
//   const { heartbeat, transition, setHeartbeat, setTransition } = useJourneyPrefs();
//   <Heartbeat variant={heartbeat} size={72} />                 // the welcome mark, beating
//   <motion.div {...stepMotion(transition, +1, reduced, tx)} />  // a setup screen entering
//
// The choice is remembered per viewer (localStorage, best effort) and shared by every mounted
// component through a tiny external store, so a pick in Effets shows up in the Parcours.
import { useSyncExternalStore } from 'react';
import { AppMark } from '../stage/Desktop.jsx';
import './variants.css';

// ——— Heartbeat of the welcome mark (transform + opacity only) ———
export const HEARTBEATS = [
  { id: 'anneau', label: 'Battement et anneau', description: 'Lub-dub toutes les 2,4 s, un anneau d’accent s’élargit et s’efface à chaque battement.' },
  { id: 'double', label: 'Double battement seul', description: 'Lub-dub toutes les 2,4 s, sans anneau. Le plus discret.' },
  { id: 'halo', label: 'Respiration et halo', description: 'Une respiration lente (3,2 s) et un halo irisé qui s’allume à l’inspiration. Pas de battement.' },
];
// ——— Transitions between the setup screens ———
export const STEP_TRANSITIONS = [
  { id: 'glisse', label: 'Glissé', description: 'L’écran suivant arrive de la droite, le précédent part à gauche (Retour : l’inverse). Comme un iPhone.' },
  { id: 'echelle', label: 'Fondu et échelle', description: 'L’écran sort en grossissant à peine, le suivant entre de 96 % à 100 %. Sur place, sans déplacement.' },
  { id: 'flou', label: 'Flou', description: 'Fondu croisé avec un léger flou (8 px) et une échelle de 98 %. Le flou coûte plus cher au GPU.' },
];

const KEY = 'ft-labo-journey-v1';
const DEFAULTS = { heartbeat: 'anneau', transition: 'glisse' };
let prefs = (() => {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULTS }; }
})();
const listeners = new Set();
function setPrefs(patch) {
  prefs = { ...prefs, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* storage blocked */ }
  listeners.forEach(fn => fn());
}
const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn); };
export const setHeartbeat = id => setPrefs({ heartbeat: id });
export const setTransition = id => setPrefs({ transition: id });
export function useJourneyPrefs() {
  const p = useSyncExternalStore(subscribe, () => prefs, () => prefs);
  return { ...p, setHeartbeat, setTransition };
}

// The app mark with its heartbeat. size = mark size in px (even number keeps the dot centred).
export function Heartbeat({ variant, size = 88, className = '' }) {
  const current = useJourneyPrefs().heartbeat;
  const v = variant || current;
  return (
    <span className={`jr-heart ${className}`} data-beat={v} style={{ '--hs': `${size}px` }} aria-hidden="true">
      <span className="jr-heart-glow" />
      <span className="jr-heart-ring" />
      <span className="jr-heart-ring jr-heart-ring-2" />
      <span className="jr-heart-mark"><AppMark size={size} /></span>
    </span>
  );
}

// motion props for one setup screen. dir: +1 forward, −1 back. tx: from useTx().
export function stepMotion(id, dir = 1, reduced = false, tx) {
  const t = tx || (s => s);
  if (reduced) {
    return { custom: dir, variants: { enter: { opacity: 0 }, center: { opacity: 1 }, exit: { opacity: 0 } }, initial: 'enter', animate: 'center', exit: 'exit', transition: t({ duration: 0.16, ease: 'out' }) };
  }
  if (id === 'echelle') {
    return {
      custom: dir,
      variants: {
        enter: d => ({ opacity: 0, scale: d > 0 ? 0.96 : 1.03 }),
        center: { opacity: 1, scale: 1 },
        exit: d => ({ opacity: 0, scale: d > 0 ? 1.03 : 0.96, transition: t({ duration: 0.18, ease: 'out' }) }),
      },
      initial: 'enter', animate: 'center', exit: 'exit', transition: t('smooth', { delay: 0.06 }),
    };
  }
  if (id === 'flou') {
    return {
      custom: dir,
      variants: {
        enter: { opacity: 0, scale: 0.98, filter: 'blur(8px)' },
        center: { opacity: 1, scale: 1, filter: 'blur(0px)' },
        exit: { opacity: 0, scale: 1.01, filter: 'blur(8px)', transition: t({ duration: 0.22, ease: 'out' }) },
      },
      initial: 'enter', animate: 'center', exit: 'exit', transition: t('gentle'),
    };
  }
  // glisse (default): push like iOS — the incoming screen travels 56 px, the outgoing one 40 px
  return {
    custom: dir,
    variants: {
      enter: d => ({ opacity: 0, x: d > 0 ? 56 : -56 }),
      center: { opacity: 1, x: 0 },
      exit: d => ({ opacity: 0, x: d > 0 ? -40 : 40, transition: t({ duration: 0.2, ease: 'out' }) }),
    },
    initial: 'enter', animate: 'center', exit: 'exit', transition: t('smooth'),
  };
}
