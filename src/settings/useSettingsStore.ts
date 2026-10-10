import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { promptError } from '../actionDefaults';
import { bridge } from '../bridge';
import { t as tNow, type MessageKey } from '../i18n';
import { shareSettings } from '../useSettings';
import type { HistoryEntry, Settings, ShortcutBinding } from '../types';
import type { Probe } from '../connection/Check';
import type { DiagnosticsLanding } from '../connection/DiagnosticsPanel';
import type { ProbeProblem } from '../types';
import type { PageId } from './nav';
import type { Registrations } from './registrations';

// The Settings window's copy of the settings and its way of saving them, as it was in 0.5
// (src/App.tsx): every change is saved, at once for a switch or a choice, 300 ms after typing;
// saves go through one queue; a refused save is said and can be retried; a change made elsewhere
// (`settings-changed`) is adopted only when nothing is being typed or saved here.
export type SaveStatus = 'saved' | 'just-saved' | 'saving' | 'error';
// Why a save failed: one of our messages, or Rust's refusal (shown translated when known).
export type SaveProblem = { key: MessageKey } | { text: string };
export const typingDelayMs = 300;
const menuBindingId = (bindings: ShortcutBinding[]) =>
  ['menu', ...bindings.map((_, n) => `menu-${n + 2}`)].find((id) => bindings.every((b) => b.id !== id))!;

export type SettingsStore = {
  settings: Settings | null;
  loadError: boolean;
  reload: () => void;
  // The settings as this window holds them right now, a change not yet rendered included.
  current: () => Settings | null;
  // immediate: false while typing (saved after a pause), true for a switch or a choice.
  persist: (next: Settings, immediate: boolean) => void;
  // A chord is saved at once and enables its binding; refused, the previous one comes back.
  // id null: the menu has no binding yet, one is added. Resolves null once saved, else the refusal.
  recordShortcut: (id: string | null, shortcut: string) => Promise<string | null>;
  recording: boolean;
  resetToDefaults: () => Promise<Settings>;
  // Saves what is still waiting; false when Rust refused it (the window then stays open).
  flush: () => Promise<boolean>;
  saveStatus: SaveStatus;
  saveError: SaveProblem | null;
  retry: () => void;
  history: HistoryEntry[];
  historyError: boolean;
  removeHistory: (id: string | null) => Promise<boolean>;
  reloadHistory: () => void;
};

export function useSettingsStore(): SettingsStore {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyError, setHistoryError] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [saveError, setSaveError] = useState<SaveProblem | null>(null);
  const [recording, setRecording] = useState(false);
  const latest = useRef<Settings | null>(null);
  // What Rust is known to hold: loaded, adopted from `settings-changed`, or saved by us.
  const synced = useRef<Settings | null>(null);
  const saveTimer = useRef(0);
  const inFlight = useRef(0);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const lastError = useRef<SaveProblem>({ key: 'settings.notSaved' });
  const settledTimer = useRef(0);
  // The window's own copy feeds its document preferences (language, theme) at once.
  const show = (next: Settings) => {
    latest.current = next;
    setSettings(next);
    shareSettings(next);
  };
  const adopt = (next: Settings) => {
    synced.current = next;
    show(next);
  };
  const reload = () => {
    setLoadError(false);
    void bridge
      .getSettings()
      .then(adopt)
      .catch(() => setLoadError(true));
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: once on mount: the first load
  useEffect(() => {
    reload();
    void bridge
      .getHistory()
      .then(setHistory)
      .catch(() => undefined);
  }, []);
  useEffect(
    () => () => {
      window.clearTimeout(saveTimer.current);
      window.clearTimeout(settledTimer.current);
    },
    [],
  );
  // The window stays alive while hidden: settings changed elsewhere (another window, the tray,
  // the setup) must replace its copy, or its next save would write the old values back.
  // Adopted only when nothing is being typed or saved here: a pending edit wins, and is saved.
  // biome-ignore lint/correctness/useExhaustiveDependencies: subscribed once; current values are read through refs
  useEffect(() => {
    let live = true;
    let off: (() => void) | undefined;
    void bridge
      .on<Settings>('settings-changed', (incoming) => {
        const current = latest.current;
        if (current === null) {
          setLoadError(false);
          adopt(incoming);
          return;
        }
        const editing = saveTimer.current !== 0 || inFlight.current > 0 || current !== synced.current;
        // Our own echo, or a change we are about to overwrite: the window's copy stays the reference.
        if (editing) {
          shareSettings(current);
          return;
        }
        if (JSON.stringify(incoming) === JSON.stringify(current)) {
          synced.current = current;
          return;
        }
        adopt(incoming);
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
  }, []);
  const settle = () => {
    setSaveStatus('just-saved');
    window.clearTimeout(settledTimer.current);
    settledTimer.current = window.setTimeout(
      () => setSaveStatus((status) => (status === 'just-saved' ? 'saved' : status)),
      3000,
    );
  };
  const commit = async (next: Settings): Promise<boolean> => {
    setSaveStatus('saving');
    inFlight.current += 1;
    try {
      for (const action of next.actions) {
        if (promptError(action.promptTemplate)) throw { key: 'actions.promptInvalid' } satisfies SaveProblem;
      }
      const pending = saveQueue.current.then(() => bridge.saveSettings(next));
      saveQueue.current = pending.catch(() => undefined);
      await pending;
      synced.current = next;
      if (latest.current !== next) return true;
      setSaveError(null);
      settle();
      return true;
    } catch (error) {
      lastError.current =
        typeof error === 'string'
          ? { text: error }
          : error && typeof error === 'object' && 'key' in error
            ? (error as SaveProblem)
            : { key: 'settings.notSaved' };
      if (latest.current === next) {
        setSaveError(lastError.current);
        setSaveStatus('error');
      }
      return false;
    } finally {
      inFlight.current -= 1;
    }
  };
  const persist = (next: Settings, immediate: boolean) => {
    show(next);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = 0;
    if (immediate) void commit(next);
    else
      saveTimer.current = window.setTimeout(() => {
        saveTimer.current = 0;
        if (latest.current) void commit(latest.current);
      }, typingDelayMs);
  };
  const retry = () => {
    if (latest.current) void commit(latest.current);
  };
  const recordShortcut = async (id: string | null, shortcut: string): Promise<string | null> => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = 0;
    const previous = latest.current!;
    const bindings: ShortcutBinding[] =
      id === null
        ? [
            ...previous.shortcutBindings,
            {
              id: menuBindingId(previous.shortcutBindings),
              kind: 'menu',
              shortcut,
              actionId: previous.defaultActionId,
              outputMode: 'replace',
              enabled: true,
            },
          ]
        : previous.shortcutBindings.map((b) => (b.id === id ? { ...b, shortcut, enabled: true } : b));
    const next = { ...previous, shortcutBindings: bindings };
    setRecording(true);
    show(next);
    try {
      if (await commit(next)) return null;
      if (latest.current === next) {
        show(previous);
        // An edit typed just before stays to be saved; otherwise nothing changed.
        if (previous !== synced.current) persist(previous, false);
        else {
          setSaveStatus('saved');
          setSaveError(null);
        }
      }
      return 'key' in lastError.current ? tNow(lastError.current.key) : lastError.current.text;
    } finally {
      setRecording(false);
    }
  };
  // « Restore default settings »: an edit still waiting gives way, then Rust saves a fresh
  // install's settings (keeping this device's setup, settings::reset) and the window adopts them.
  // Refused, nothing changed: the edit that waited is saved as it would have been.
  const resetToDefaults = async (): Promise<Settings> => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = 0;
    setSaveStatus('saving');
    inFlight.current += 1;
    try {
      const pending = saveQueue.current.then(() => bridge.resetSettings());
      saveQueue.current = pending.catch(() => undefined);
      const saved = await pending;
      adopt(saved);
      setSaveError(null);
      settle();
      return saved;
    } catch (error) {
      if (latest.current && latest.current !== synced.current) void commit(latest.current);
      else setSaveStatus('saved');
      throw error;
    } finally {
      inFlight.current -= 1;
    }
  };
  const flush = async (): Promise<boolean> => {
    const waiting = saveTimer.current !== 0 || (latest.current !== null && latest.current !== synced.current);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = 0;
    if (waiting && latest.current) return commit(latest.current);
    await saveQueue.current;
    return latest.current === synced.current;
  };
  const reloadHistory = () => {
    void bridge
      .getHistory()
      .then(setHistory)
      .catch(() => undefined);
  };
  const removeHistory = async (id: string | null): Promise<boolean> => {
    try {
      await bridge.deleteHistory(id);
      setHistory(await bridge.getHistory());
      setHistoryError(false);
      return true;
    } catch {
      setHistoryError(true);
      return false;
    }
  };
  return {
    settings,
    loadError,
    reload,
    current: () => latest.current,
    persist,
    recordShortcut,
    recording,
    resetToDefaults,
    flush,
    saveStatus,
    saveError,
    retry,
    history,
    historyError,
    removeHistory,
    reloadHistory,
  };
}

// What the pages share (design-lab: SettingsContext).
export type ToastExtra = { keys?: boolean };
export type SettingsContextValue = Omit<SettingsStore, 'settings' | 'loadError' | 'reload' | 'current'> & {
  settings: Settings;
  // Opens a page; with a field, scrolls to its row and flashes it once.
  go: (page: PageId, field?: string) => void;
  // « Voir le journal »: reveals the Diagnostic on the failure.
  openLog: (problem: ProbeProblem | null, run: string | null) => void;
  // Where « Voir le journal » landed (the Diagnostic page opens on it).
  landing: DiagnosticsLanding | null;
  // One toast at a time: a new message replaces the text in place.
  showToast: (text: string, extra?: ToastExtra) => void;
  registrations: Registrations;
  // One live check per server shown, shared by the sidebar, the card and the form.
  probes: Record<string, Probe>;
  // Which server cards are unfolded (a direct link to a field unfolds its server).
  // An address being typed that cannot be read yet (« http:/ »): shown in its field and checked
  // by nothing, never sent to be saved (Rust would refuse the whole file for it).
  addressDrafts: Readonly<Record<string, string>>;
  setAddressDraft: (id: string, typed: string | null) => void;
  expanded: ReadonlySet<string>;
  setExpanded: (id: string, open: boolean) => void;
};
export const SettingsContext = createContext<SettingsContextValue | null>(null);
export function useSettingsContext(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('SettingsContext is missing');
  return value;
}
