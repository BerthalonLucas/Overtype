import type { MessageKey, Translate } from '../i18n';
import { settingsRefusalCodes, type SettingsRefusalCode } from '../types';

// ARCH-05: Rust refuses a save with a code (`{message, code}`, its SettingsRefusal), and the
// Settings window and the setup show that code's text in the interface language. Rust's French
// `message` is never shown; a code this table does not know (an `internal`, a newer code) reads
// as the window's generic « not saved ».
const refusals: Record<SettingsRefusalCode, MessageKey> = {
  undo_seconds: 'refusal.undoSeconds',
  words_seconds: 'refusal.wordsSeconds',
  servers: 'refusal.servers',
  server_model: 'refusal.model',
  server_name: 'refusal.serverName',
  server_key: 'refusal.key',
  address: 'refusal.address',
  address_credentials: 'refusal.addressCredentials',
  address_scheme: 'refusal.addressScheme',
  actions: 'refusal.actions',
  action_id: 'refusal.actionId',
  action_name: 'refusal.actionName',
  action_prompt: 'actions.promptInvalid',
  action_short_name: 'refusal.shortName',
  action_icon: 'refusal.actionIcon',
  action_letter: 'grid.lettersInvalid',
  grid_too_many: 'grid.tooMany',
  grid_action: 'refusal.gridAction',
  default_action: 'refusal.defaultAction',
  shortcuts: 'refusal.shortcuts',
  shortcut_id: 'refusal.shortcutId',
  shortcut_action: 'refusal.shortcutAction',
  shortcut_duplicate: 'shortcuts.duplicate',
  shortcut_too_long: 'shortcuts.unknown',
  shortcut_windows_key: 'shortcuts.windowsKey',
  shortcut_f12: 'shortcuts.f12',
  shortcut_needs_modifier: 'shortcuts.needModifier',
  shortcut_reserved: 'shortcuts.system',
  shortcut_unknown: 'shortcuts.unknown',
  shortcut_taken: 'shortcuts.taken',
  autostart_unavailable: 'settings.autostartUnavailable',
  storage_failed: 'refusal.storage',
  window_refused: 'refusal.window',
};

// What a save problem says: one of the window's own messages, or Rust's refusal by its code.
export type SaveProblem = { key: MessageKey } | { code: SettingsRefusalCode };

// The code of the Settings' list a rejected command carries (`{message, code}`), else null.
export function settingsRefusalOf(reason: unknown): SettingsRefusalCode | null {
  const code = typeof reason === 'object' && reason !== null ? (reason as { code?: unknown }).code : undefined;
  return (settingsRefusalCodes as readonly unknown[]).includes(code) ? (code as SettingsRefusalCode) : null;
}

// A rejected save as a problem to show: a message of the window's own (`{key}`), Rust's refusal by
// its code, or `fallback` for anything else (a lock, a code of the result's list, a string).
export function saveProblem(reason: unknown, fallback: MessageKey): SaveProblem {
  if (typeof reason === 'object' && reason !== null && typeof (reason as { key?: unknown }).key === 'string')
    return reason as SaveProblem;
  const code = settingsRefusalOf(reason);
  return code ? { code } : { key: fallback };
}

export function refusalKey(code: string, fallback: MessageKey = 'settings.notSaved'): MessageKey {
  return Object.hasOwn(refusals, code) ? refusals[code as SettingsRefusalCode] : fallback;
}

export function describeRefusal(code: string, t: Translate, fallback?: MessageKey): string {
  return t(refusalKey(code, fallback));
}

export function describeProblem(problem: SaveProblem, t: Translate): string {
  return 'key' in problem ? t(problem.key) : describeRefusal(problem.code, t);
}
