import { useCallback, useEffect, useRef, useState } from 'react';
import { bridge } from '../bridge';
import { saveProblem, type SaveProblem } from '../settings/messages';
import type { Settings } from '../types';
import { shareSettings } from '../useSettings';
import { withShortcut } from './model';

// The setup's hold on the REAL settings: it loads them, shows every answer at once (theme and
// language apply before the save comes back) and saves it, immediately for a choice, after a
// pause for typing. Saves run one after the other; a refused save says so and can be tried again,
// it never blocks the screen. A change made elsewhere (`settings-changed`: the Settings window stays
// usable during « Revoir l'accueil ») is adopted while nothing is being typed or saved here, by the
// same rule as the Settings window (src/settings/useSettingsStore.ts): the setup always sends its
// whole copy, and a stale one would silently write the old values back.
export type SetupSettings = {
  settings: Settings | null;
  loadError: boolean;
  load: () => void;
  // The last save refused: Rust's refusal by its code, or the setup's own « not saved »; null when saved.
  saveError: SaveProblem | null;
  retry: () => void;
  persist: (next: Settings, immediate: boolean) => void;
  // What waits is saved now; false when the last save failed.
  flush: () => Promise<boolean>;
  // A recorded chord, saved at once; null once saved, else Rust's refusal (the previous chord is back).
  record: (shortcut: string) => Promise<SaveProblem | null>;
  recording: boolean;
};
export const TYPING_PAUSE_MS = 400;

const notSaved = (): SaveProblem => ({ key: 'setup.notSaved' });

export function useSetupSettings(): SetupSettings {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState<SaveProblem | null>(null);
  const [recording, setRecording] = useState(false);
  const latest = useRef<Settings | null>(null);
  // What Rust is known to hold: loaded, adopted from `settings-changed`, or saved by us.
  const synced = useRef<Settings | null>(null);
  const inFlight = useRef(0);
  const timer = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const alive = useRef(true);
  const show = useCallback((next: Settings) => {
    latest.current = next;
    setSettings(next);
    shareSettings(next);
  }, []);
  const load = useCallback(() => {
    setLoadError(false);
    bridge.getSettings().then(
      (next) => {
        if (alive.current && !latest.current) {
          synced.current = next;
          show(next);
        }
      },
      () => {
        if (alive.current) setLoadError(true);
      },
    );
  }, [show]);
  useEffect(() => {
    alive.current = true;
    load();
    return () => {
      alive.current = false;
      window.clearTimeout(timer.current);
    };
  }, [load]);
  useEffect(() => {
    let live = true;
    let off: (() => void) | undefined;
    void bridge
      .on<Settings>('settings-changed', (incoming) => {
        const current = latest.current;
        if (!alive.current) return;
        if (current === null) {
          setLoadError(false);
          synced.current = incoming;
          show(incoming);
          return;
        }
        // Our own echo, or a change we are about to overwrite: this window's copy stays the reference.
        if (timer.current !== 0 || inFlight.current > 0 || current !== synced.current) return;
        if (JSON.stringify(incoming) === JSON.stringify(current)) return;
        synced.current = incoming;
        show(incoming);
      })
      .then(
        (unlisten) => {
          if (live) off = unlisten;
          else unlisten();
        },
        () => undefined,
      );
    return () => {
      live = false;
      off?.();
    };
  }, [show]);
  const save = useCallback((next: Settings): Promise<void> => {
    inFlight.current += 1;
    const pending = queue.current.then(() => bridge.saveSettings(next));
    queue.current = pending.catch(() => undefined);
    return pending.then(
      () => {
        inFlight.current -= 1;
        synced.current = next;
        if (alive.current && latest.current === next) setSaveError(null);
      },
      (error) => {
        inFlight.current -= 1;
        if (alive.current && latest.current === next) setSaveError(saveProblem(error, 'setup.notSaved'));
        throw error;
      },
    );
  }, []);
  const persist = useCallback(
    (next: Settings, immediate: boolean) => {
      show(next);
      window.clearTimeout(timer.current);
      timer.current = 0;
      if (immediate) save(next).catch(() => undefined);
      else
        timer.current = window.setTimeout(() => {
          timer.current = 0;
          if (latest.current) save(latest.current).catch(() => undefined);
        }, TYPING_PAUSE_MS);
    },
    [show, save],
  );
  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = 0;
    }
    if (!latest.current) return true;
    // Nothing waits: what Rust holds is what this window shows (never a save of a copy that
    // may be older than a change made elsewhere).
    if (latest.current === synced.current) {
      await queue.current;
      return true;
    }
    try {
      await save(latest.current);
      return true;
    } catch {
      return false;
    }
  }, [save]);
  const retry = useCallback(() => {
    if (latest.current) save(latest.current).catch(() => undefined);
  }, [save]);
  const record = useCallback(
    async (shortcut: string): Promise<SaveProblem | null> => {
      const previous = latest.current;
      if (!previous) return notSaved();
      window.clearTimeout(timer.current);
      timer.current = 0;
      const next = withShortcut(previous, shortcut);
      setRecording(true);
      show(next);
      try {
        await save(next);
        return null;
      } catch (error) {
        // Refused (the chord is taken, or reserved): the chord that worked comes back.
        if (latest.current === next) {
          show(previous);
          setSaveError(null);
          save(previous).catch(() => undefined);
        }
        return saveProblem(error, 'setup.notSaved');
      } finally {
        if (alive.current) setRecording(false);
      }
    },
    [show, save],
  );
  return { settings, loadError, load, saveError, retry, persist, flush, record, recording };
}
