import type { MotionPreference } from '../types';
import { subscribeSystemMotion, systemReducesMotion } from './system';

export type ResolvedMotion = 'full' | 'reduced';

// « Animations : suivre Windows / toujours / réduites ». Whether Windows reduces comes from
// system.ts (Rust's reading of « Effets d'animation », else prefers-reduced-motion); the
// resolved value is written as data-motion on <html> for the CSS.
export function resolveMotion(preference: MotionPreference, prefersReduced: boolean): ResolvedMotion {
  if (preference === 'full' || preference === 'reduced') return preference;
  return prefersReduced ? 'reduced' : 'full';
}

// What Motion's MotionConfig is told: follow the system, never reduce, always reduce.
export function reducedMotionConfig(preference: MotionPreference): 'user' | 'never' | 'always' {
  return preference === 'full' ? 'never' : preference === 'reduced' ? 'always' : 'user';
}

// Applies the preference now and follows the system while it is « system ».
export function applyMotion(preference: MotionPreference, root: HTMLElement = document.documentElement): () => void {
  const update = () => {
    root.dataset.motion = resolveMotion(preference, systemReducesMotion());
  };
  update();
  return preference === 'system' ? subscribeSystemMotion(update) : () => undefined;
}
