import { useEffect } from 'react';
import { applyTheme, type SystemThemeSource } from './theme';
import { bridge } from './bridge';
import { applyMotion } from './motion/preference';
import { setLanguage } from './i18n';
import { applyMotionPreset } from './motion/tokens';
import type { Settings } from './types';

const systemTheme: SystemThemeSource = {
  current: bridge.systemTheme,
  listen: (handler) => bridge.on<unknown>('system-theme', handler),
};

// Document-level preferences of every window: the interface language, the Îlot switch, the
// theme, the motion and its preset (CSS custom properties for the animations Motion does not
// drive). Before the settings load, the system decides theme and motion.
export function useDocumentPreferences(settings: Settings | null) {
  const root = document.documentElement;
  const theme = settings?.theme ?? 'system';
  const motion = settings?.motion ?? 'system';
  const language = settings?.language ?? 'en';
  const preset = settings?.motionPreset ?? 'smooth';
  useEffect(() => {
    root.lang = language;
    setLanguage(language);
    root.dataset.ui = settings?.uiVersion ?? 'ilot';
  }, [root, language, settings?.uiVersion]);
  useEffect(() => applyTheme(theme, root, systemTheme), [root, theme]);
  useEffect(() => applyMotion(motion, root), [root, motion]);
  useEffect(() => applyMotionPreset(preset, root), [root, preset]);
}
