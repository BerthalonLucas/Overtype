import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { MotionConfig, useReducedMotionConfig } from 'motion/react';
import type { MotionPreference, MotionPreset } from '../types';
import { reducedMotionConfig, resolveMotion } from './preference';
import { subscribeSystemMotion, systemReducesMotion } from './system';
import { motionTokens, type MotionTokens } from './tokens';
import { contentPresence, stateTransition, surfacePresence, type Grow } from './presence';

// Whether Windows asks to reduce animations (system.ts), live; the Settings window shows
// « Windows demande de réduire les animations » from this.
export function useSystemReducesMotion(): boolean {
  return useSyncExternalStore(subscribeSystemMotion, systemReducesMotion, () => false);
}

const PresetContext = createContext<MotionPreset>('smooth');

// The setting « Animations : suivre Windows / toujours / réduites » for everything Motion
// drives. « suivre Windows » is resolved here, live, rather than left to Motion's 'user' (read
// once per component): Motion, useReducedMotionConfig and data-motion always agree.
export function MotionPreferences({
  motion,
  preset,
  children,
}: {
  motion: MotionPreference;
  preset: MotionPreset;
  children: ReactNode;
}) {
  const systemReduces = useSystemReducesMotion();
  return (
    <MotionConfig reducedMotion={reducedMotionConfig(resolveMotion(motion, systemReduces))}>
      <PresetContext.Provider value={preset}>{children}</PresetContext.Provider>
    </MotionConfig>
  );
}

// The tokens of the chosen preset (settings.motionPreset: « smooth » or « bouncy »).
export function useMotionPreset(): MotionTokens {
  return motionTokens(useContext(PresetContext));
}

// Motion's own answer under MotionConfig (useReducedMotion reads only the system).
export function useReducedMotionSetting(): boolean {
  return Boolean(useReducedMotionConfig());
}

export function useSurfacePresence(grow: Grow = 'down', delayMs = 0) {
  const tokens = useMotionPreset();
  const reduced = useReducedMotionSetting();
  return useMemo(() => surfacePresence(tokens, reduced, grow, delayMs), [tokens, reduced, grow, delayMs]);
}

export function useContentPresence() {
  const tokens = useMotionPreset();
  const reduced = useReducedMotionSetting();
  return useMemo(() => contentPresence(tokens, reduced), [tokens, reduced]);
}

export function useStateTransition() {
  const tokens = useMotionPreset();
  const reduced = useReducedMotionSetting();
  return useMemo(() => stateTransition(tokens, reduced), [tokens, reduced]);
}
