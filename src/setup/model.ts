import type { ConnectionValue } from '../connection/ConnectionForm';
import type { Server, Settings, SettingsPage, ShortcutBinding } from '../types';

// The setup's pure logic (docs/PLAN-0.6.md §4.1, design-lab/reglages/src/journey/Journey.jsx):
// the order of its screens, the lock that keeps a double click or a held Enter from skipping a
// screen, and how each question reads and writes the REAL settings (every answer is saved at once).

// welcome → three questions → before the demo → « C'est prêt ».
export const setupSteps = ['welcome', 'appearance', 'shortcut', 'model', 'demo', 'ready'] as const;
export type SetupStep = typeof setupSteps[number];
// The progress dots: the questions only.
export const setupQuestions = ['appearance', 'shortcut', 'model', 'demo'] as const;
export type SetupQuestion = typeof setupQuestions[number];
export const isQuestion = (step: SetupStep): step is SetupQuestion => (setupQuestions as readonly string[]).includes(step);
export const isSetupStep = (value: unknown): value is SetupStep => (setupSteps as readonly unknown[]).includes(value);

// Each screen wears the colour of its topic's Settings page (the lab's TOPIC_PAGE).
export const stepPage: Record<SetupStep, SettingsPage> = { welcome: 'general', appearance: 'appearance', shortcut: 'shortcuts', model: 'server', demo: 'actions', ready: 'general' };

export function nextStep(step: SetupStep): SetupStep { return setupSteps[Math.min(setupSteps.indexOf(step) + 1, setupSteps.length - 1)]; }
// Retour: one screen back, never from the first one, never from « C'est prêt » (the answers are
// edited from its recap).
export function previousStep(step: SetupStep): SetupStep {
  const index = setupSteps.indexOf(step);
  return index <= 0 || step === 'ready' ? step : setupSteps[index - 1];
}
// +1 forward, −1 back: the side the « Fondu et échelle » transition plays on.
export const direction = (from: SetupStep, to: SetupStep): 1 | -1 => (setupSteps.indexOf(to) >= setupSteps.indexOf(from) ? 1 : -1);
// Only « Votre modèle » waits: for a model chosen on a server that answered. « Plus tard » stays free.
export function canContinue(step: SetupStep, modelReady: boolean): boolean { return step !== 'model' || modelReady; }

// While a screen change runs, Continuer / Retour / Enter / Escape are ignored: a double click or
// a held key moves by one screen only.
export const NAV_LOCK_MS = 300;
export function createNavLock(now: () => number = () => performance.now(), ms = NAV_LOCK_MS) {
  let until = -Infinity;
  return {
    // true: the navigation is refused (a change is still running); false: it is taken, and locks.
    locked() { const at = now(); if (at < until) return true; until = at + ms; return false; },
    release() { until = -Infinity; },
  };
}

// ——— The shortcut (question 2) ———
// The menu's binding, or the one the setup turned into a direct action (it keeps its id and its
// chord, so Rust never adds a second menu binding beside it).
const isMenuId = (id: string) => id === 'menu' || /^menu-\d+$/.test(id);
export function primaryBinding(settings: Pick<Settings, 'shortcutBindings'>): ShortcutBinding | undefined {
  return settings.shortcutBindings.find(binding => binding.kind === 'menu') ?? settings.shortcutBindings.find(binding => isMenuId(binding.id));
}
export type ShortcutChoice = 'menu' | 'direct';
export function shortcutChoice(settings: Settings): ShortcutChoice {
  const binding = primaryBinding(settings);
  return binding && binding.kind === 'action' ? 'direct' : 'menu';
}
// The action a direct shortcut runs (the binding's, else the default action).
export function directActionId(settings: Settings): string {
  const binding = primaryBinding(settings);
  return binding?.kind === 'action' && settings.actions.some(action => action.id === binding.actionId) ? binding.actionId : settings.defaultActionId;
}
const freeMenuId = (bindings: ShortcutBinding[]) => ['menu', ...bindings.map((_, n) => `menu-${n + 2}`)].find(id => bindings.every(binding => binding.id !== id))!;

// Menu: kind 'menu' (the Îlot opens beside the selection). Direct: kind 'action' on that action,
// replacing the selection. An unknown action falls back to the default one.
export function withShortcutChoice(settings: Settings, choice: ShortcutChoice, actionId = directActionId(settings)): Settings {
  const binding = primaryBinding(settings);
  if (!binding) return settings;
  const action = settings.actions.some(item => item.id === actionId) ? actionId : settings.defaultActionId;
  const next: ShortcutBinding = choice === 'menu'
    ? { ...binding, kind: 'menu', actionId: settings.defaultActionId, outputMode: 'replace' }
    : { ...binding, kind: 'action', actionId: action, outputMode: 'replace' };
  return { ...settings, shortcutBindings: settings.shortcutBindings.map(item => item.id === binding.id ? next : item) };
}
// A recorded chord: on the question's binding (enabled), or a new menu binding when there is none.
export function withShortcut(settings: Settings, shortcut: string): Settings {
  const binding = primaryBinding(settings);
  const bindings: ShortcutBinding[] = binding
    ? settings.shortcutBindings.map(item => item.id === binding.id ? { ...item, shortcut, enabled: true } : item)
    : [...settings.shortcutBindings, { id: freeMenuId(settings.shortcutBindings), kind: 'menu', shortcut, actionId: settings.defaultActionId, outputMode: 'replace', enabled: true }];
  return { ...settings, shortcutBindings: bindings };
}

// ——— The model (question 3): ONE server, the default one (Lucas, 29/09) ———
export function defaultServer(settings: Pick<Settings, 'servers' | 'defaultServerId'>): Server | undefined {
  return settings.servers.find(server => server.id === settings.defaultServerId) ?? settings.servers[0];
}
export function connectionOf(settings: Settings): ConnectionValue {
  const server = defaultServer(settings);
  return { endpoint: server?.endpoint ?? '', apiKey: server?.apiKey ?? '', noKey: server?.noKey ?? false, model: server?.model ?? '' };
}
// Written on the default server; a list without one (never from Rust) gets the fresh install's.
export function withConnection(settings: Settings, value: ConnectionValue): Settings {
  const current = defaultServer(settings);
  const patch = { endpoint: value.endpoint, apiKey: value.noKey ? '' : value.apiKey, noKey: value.noKey, model: value.model };
  if (!current) return { ...settings, servers: [{ id: 's1', name: '', ...patch }], defaultServerId: 's1' };
  return { ...settings, defaultServerId: current.id, servers: settings.servers.map(server => server.id === current.id ? { ...server, ...patch } : server) };
}
// Enter continues and Escape goes back, unless the key belongs to what has the focus: an open
// popover or dialog, the shortcut recorder, a list; for Enter also a field's own controls. The
// setup's own window and its journal sheet are dialogs too, and they do NOT own the key.
export function ownsKey(target: Element | null, key: string): boolean {
  if (!target) return false;
  if (target.closest('[data-radix-popper-content-wrapper], [role="listbox"], [role="dialog"]:not(.su-window):not(.su-log-sheet), [cmdk-root], [data-recording]')) return true;
  if (key !== 'Enter') return false;
  return Boolean(target.closest('button, a[href], textarea, select, [role="combobox"], [role="radio"], [role="button"], [contenteditable="true"]'));
}
