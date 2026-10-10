import { useCallback, useEffect, useState } from 'react';
import { bridge } from '../bridge';
import type { BindingState, ShortcutBinding, ShortcutStatus } from '../types';

/*
 * Whether Windows registered each binding's chord (lot 10, docs/BRIDGE.md « The state of each
 * shortcut »): `shortcut_status()` when the Settings window opens, then every `shortcut-status`
 * Rust sends (after the startup registrations and after each save). A chord another application
 * holds is 'taken' (Ctrl+Alt+Space on the development PC, 2026-09-24): the row says so, and the
 * recorder stays free to take another one.
 */

export type Registrations = (binding: Pick<ShortcutBinding, 'id' | 'shortcut'>) => BindingState | undefined;

const chord = (shortcut: string) => shortcut.replace(/\s+/g, '').toLowerCase();

// A binding's state, only while it still names the chord Windows answered for: a chord just
// recorded waits for the next `shortcut-status` rather than inheriting the previous answer.
export function registrationOf(
  statuses: readonly ShortcutStatus[] | null,
  binding: Pick<ShortcutBinding, 'id' | 'shortcut'>,
): BindingState | undefined {
  const status = statuses?.find((item) => item.bindingId === binding.id);
  return status && chord(status.shortcut) === chord(binding.shortcut) ? status.state : undefined;
}

export function useRegistrations(): Registrations {
  const [statuses, setStatuses] = useState<ShortcutStatus[] | null>(null);
  useEffect(() => {
    let live = true;
    let received = false;
    let off: (() => void) | undefined;
    // The event is newer than any answer of the command still on its way.
    void bridge
      .on<ShortcutStatus[]>('shortcut-status', (next) => {
        if (!live) return;
        received = true;
        setStatuses(next);
      })
      .then(
        (unlisten) => {
          if (live) off = unlisten;
          else unlisten();
        },
        () => undefined,
      );
    void bridge.shortcutStatus().then(
      (next) => {
        if (live && !received) setStatuses(next);
      },
      () => undefined,
    );
    return () => {
      live = false;
      off?.();
    };
  }, []);
  return useCallback((binding) => registrationOf(statuses, binding), [statuses]);
}
