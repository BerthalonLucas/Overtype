import { useReducedMotionSetting } from '../motion/MotionPreferences';

// Motion of the Settings and the setup (design-lab/reglages/src/lib/motion.js, without the lab's
// speed). Apple springs by their SwiftUI names, as Motion's duration / bounce springs. Reduced
// motion comes from MotionPreferences (MotionConfig reducedMotion="always"): Motion then skips
// transforms and layout and keeps the fades; CSS follows data-motion on <html>.
export const SPRINGS = {
  smooth: { duration: 0.4, bounce: 0 },
  bouncy: { duration: 0.4, bounce: 0.3 },
  snappy: { duration: 0.28, bounce: 0.12 },
  gentle: { duration: 0.6, bounce: 0 },
  window: { duration: 0.42, bounce: 0.08 },
} as const;
export type SpringName = keyof typeof SPRINGS;
type Bezier = [number, number, number, number];
export const CURVES: Record<'out' | 'inOut' | 'fluent' | 'linear', Bezier> = {
  out: [0.23, 1, 0.32, 1],
  inOut: [0.65, 0, 0.35, 1],
  fluent: [0, 0, 0, 1],
  linear: [0, 0, 1, 1],
};
export type CurveName = keyof typeof CURVES;
type Custom = { type?: 'spring' | 'tween'; duration?: number; bounce?: number; delay?: number; ease?: CurveName | Bezier };
export type Tx = { type: 'spring' | 'tween'; duration?: number; bounce?: number; delay?: number; ease?: Bezier };

// tx('smooth') · tx('bouncy', { delay: .1 }) · tx({ duration: .2, ease: 'out' }) · tx(0.2)
export function tx(spec: SpringName | CurveName | number | Custom = 'smooth', extra: { delay?: number } = {}): Tx {
  let base: Custom;
  if (typeof spec === 'number') base = { type: 'tween', duration: spec, ease: 'out' };
  else if (typeof spec === 'string') base = spec in SPRINGS ? { type: 'spring', ...SPRINGS[spec as SpringName] } : { type: 'tween', duration: 0.2, ease: spec as CurveName };
  else base = { ...spec };
  const { ease, ...rest } = { ...base, ...extra };
  const type = rest.type ?? (rest.bounce !== undefined ? 'spring' : 'tween');
  return { ...rest, type, ...(ease ? { ease: typeof ease === 'string' ? CURVES[ease] : ease } : type === 'tween' ? { ease: CURVES.out } : {}) };
}
export const useTx = () => tx;
// Whether movement gives way to short fades (the setting « Animations », or Windows).
export const useReduced = useReducedMotionSetting;

// The sidebar's selection pill: a short soft spring, a hint of delay (it glides after the click).
export const NAV_GLIDE: Tx = { type: 'spring', duration: 0.46, bounce: 0.14, delay: 0.035 };
