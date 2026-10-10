import { useSyncExternalStore } from 'react';
import { bridge } from './bridge';
import type { Settings } from './types';

// The settings every window reads for its appearance (language, theme, motion): loaded once,
// then kept current through `settings-changed`. The overlay and the settings window still
// hold their own copy for their logic; this one only feeds document-level preferences.
// The settings window shares each edit here at once (shareSettings): a language or theme
// change must apply in the window that made it before the save's `settings-changed` echo
// comes back (Rust sends it to the settings window too, after the save).
let current: Settings | null = null;
let started = false;
const listeners = new Set<() => void>();
function publish(next: Settings) {
  current = next;
  listeners.forEach((listener) => listener());
}
function start() {
  if (started) return;
  started = true;
  void bridge
    .getSettings()
    .then((next) => {
      if (!current) publish(next);
    })
    .catch(() => undefined);
  void bridge.on<Settings>('settings-changed', publish);
}
function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
const snapshot = () => current;

export function shareSettings(next: Settings) {
  publish(next);
}
export function useSettings(): Settings | null {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
