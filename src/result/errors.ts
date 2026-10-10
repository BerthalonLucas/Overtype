import type { MessageKey } from '../i18n';
import { errorCodes, type ErrorCode, type ProfileField, type SettingsField } from '../types';

/*
 * The errors of lot 10 on the front (docs/DA-PLAN.md lot 10, UI-DECISIONS 23/09): for each code
 * Rust sends (`ErrorCode`, the one list in src/types.ts), its family, its one button and the
 * Settings field it opens.
 *
 * Families (the lab's `kind`, design-lab/src/data.js:63-73):
 *   config     the user can fix it: the button opens the exact field of the Settings
 *              (lot 13 identifiers, `quality|fast.endpoint|apiKey|model`, or the bare field for
 *              the default profile: src/settings/fields.ts resolveField).
 *   transient  out of the user's hands: Try again.
 *   paste      the result exists but was not pasted (paste refused, the selection changed, a
 *              read-only field, keys held): nothing was replaced, Copy result.
 *   content    nothing to retry as is (the lab's « Selection too long »): no button, ✕ only.
 *   silent     nothing to show (the user cancelled): the pill just leaves.
 * Short texts (at most six words) are the lab's where it has one (OUTCOMES short and action);
 * they never carry the server's answer, a key or any text of the user.
 *
 * API
 *   errorCodeOf(value)          a code from the bridge; anything unknown is 'internal'.
 *   refusalCode(reason)         the code of a command refused with `{message, code}` (Refusal:
 *                               `replace_result`); anything else is 'internal'.
 *   describeError(code, { mode, model, source })  → { family, message, params, action, actionLabel }:
 *                               the i18n keys to show and the one action of its button.
 *                               source 'capture': a capture Rust refused (`capture-notice`):
 *                               nothing was read, no result exists, so no button at all, and
 *                               the capture's own words where the request's would mislead
 *                               (target_changed: the source window changed, nothing was tried).
 *                               source 'undo' / 'undo-sent': an Undo refused (nothing was sent: the
 *                               text changed, keys held, the application blocked it) or sent and
 *                               not read back; its own words, ✕ only.
 *   ErrorAction                 { type: 'settings', field } | { type: 'retry' } | { type: 'copy' }.
 *
 * Only codes decide. Rust's French words travel beside them for the 0.4 journey and are never
 * read here: each situation the Îlot tells apart has its own code (settings_open and
 * nothing_recent for the notices, the Refusal of replace_result; docs/BRIDGE.md « error codes »).
 */

export type ErrorFamily = 'config' | 'transient' | 'paste' | 'content' | 'silent';
export type ErrorAction = { type: 'settings'; field: SettingsField } | { type: 'retry' } | { type: 'copy' };
// Where it failed: a request (translation, paste), the capture itself, or an Undo (lot 9,
// `undo_result`): 'undo' refused before anything was sent, 'undo-sent' sent (Ctrl+Z or the
// original pasted back) and not read back. An Undo that fails pastes nothing else: no button.
export type ErrorSource = 'request' | 'capture' | 'undo' | 'undo-sent';

type Entry = { family: ErrorFamily; field?: ProfileField };
// Why each code sits in its family:
//   unreachable      nothing answers at the address: config (the lab's « endpoint » outcome).
//   bad_endpoint     an answer, but no API there (404 outside the model): config, the address.
//   unauthorized     401/403: config, the key (the lab's « key »).
//   model_not_found  404 naming the model: config, the model (the lab's « model »).
//   timeout, busy (429/503), server_error (other statuses, 5xx), stream_broken: transient.
//   length           the answer was cut by the token limit: never pasted, transient (Try again,
//                    perhaps on less text); a partial result is never offered for copy.
//   internal         anything unexpected on our side, and any code this front does not know.
//   paste_blocked, target_changed, not_editable, keys_held: the paste did not happen: paste.
//   read_only        0.6: the paste went out and the field reads exactly as before (a PDF in a
//                    browser used to end on the check): the result exists, Copy result: paste.
//   protected_window 0.6: the window in front runs as administrator, Windows lets us neither
//                    read it nor send it a key: content, ✕ only (a capture notice).
//   too_long, no_selection, protected_field, settings_open, setup_open, nothing_recent: nothing
//                    was read or sent: content, ✕ only (the last three are capture notices, no
//                    button at all; setup_open, 0.6: the same press over the first-run setup).
//   cancelled        the user's own Escape: silent.
const table: Record<ErrorCode, Entry> = {
  unreachable: { family: 'config', field: 'endpoint' },
  bad_endpoint: { family: 'config', field: 'endpoint' },
  unauthorized: { family: 'config', field: 'apiKey' },
  model_not_found: { family: 'config', field: 'model' },
  timeout: { family: 'transient' },
  busy: { family: 'transient' },
  server_error: { family: 'transient' },
  stream_broken: { family: 'transient' },
  length: { family: 'transient' },
  internal: { family: 'transient' },
  paste_blocked: { family: 'paste' },
  target_changed: { family: 'paste' },
  not_editable: { family: 'paste' },
  read_only: { family: 'paste' },
  keys_held: { family: 'paste' },
  too_long: { family: 'content' },
  no_selection: { family: 'content' },
  protected_field: { family: 'content' },
  protected_window: { family: 'content' },
  settings_open: { family: 'content' },
  setup_open: { family: 'content' },
  nothing_recent: { family: 'content' },
  cancelled: { family: 'silent' },
};

export function errorCodeOf(value: unknown): ErrorCode {
  return (errorCodes as readonly unknown[]).includes(value) ? (value as ErrorCode) : 'internal';
}
// A command refused with its code (`replace_result` since the review of da-ilot: `{message, code}`).
// The message is Rust's French sentence for the 0.4 journey: never read here.
export function refusalCode(reason: unknown): ErrorCode {
  return errorCodeOf(typeof reason === 'object' && reason !== null ? (reason as { code?: unknown }).code : undefined);
}
export const errorFamily = (code: ErrorCode): ErrorFamily => table[code].family;

// The button's label per action (the lab's OUTCOMES action, data.js:66-71).
const fieldLabel: Record<ProfileField, MessageKey> = {
  endpoint: 'result.action.endpoint',
  apiKey: 'result.action.apiKey',
  model: 'result.action.model',
};

export type ErrorDescription = {
  code: ErrorCode;
  family: ErrorFamily;
  message: MessageKey;
  params?: Record<string, string>;
  action: ErrorAction | null;
  actionLabel: MessageKey | null;
};

// What a capture says in its own words (source 'capture'): target_changed there is the source
// window changing during the capture (capture.rs), before anything was pasted.
const captureMessage: Partial<Record<ErrorCode, MessageKey>> = { target_changed: 'result.notice.target_changed' };
// Why an Undo was refused, in its own words (the request's would say « not replaced »): the text,
// the caret, the field or the window changed, or Undo was already withdrawn; keys still held; the
// source could not be brought back or the chord was blocked; anything else (the command refused:
// the result no longer current). Sent and not read back: the text may not be the original.
const undoMessage: Partial<Record<ErrorCode, MessageKey>> = {
  target_changed: 'result.undo.target_changed',
  keys_held: 'result.undo.keys_held',
  paste_blocked: 'result.undo.paste_blocked',
};

// serverId: the server the failed request used (its field then opens, else the default
// server's). model: the model's name from the settings, for « Model not found: … » (the lab's
// wording); never anything from the server's answer.
export function describeError(
  code: ErrorCode,
  { serverId, model, source = 'request' }: { serverId?: string; model?: string; source?: ErrorSource } = {},
): ErrorDescription {
  const { family, field } = table[code];
  const named = code === 'model_not_found' && model?.trim();
  const message = (named ? 'result.error.model_not_found_named' : `result.error.${code}`) as MessageKey;
  const params = named ? { model: model!.trim() } : undefined;
  const none = { code, family, message, params, action: null, actionLabel: null };
  if (source === 'capture') return { ...none, message: captureMessage[code] ?? message };
  if (source === 'undo') return { ...none, message: undoMessage[code] ?? 'result.undo.internal' };
  if (source === 'undo-sent') return { ...none, message: 'result.undo.sent' };
  if (family === 'config' && field)
    return {
      ...none,
      action: { type: 'settings', field: serverId ? `${serverId}.${field}` : field },
      actionLabel: fieldLabel[field],
    };
  if (family === 'transient') return { ...none, action: { type: 'retry' }, actionLabel: 'common.retry' };
  if (family === 'paste') return { ...none, action: { type: 'copy' }, actionLabel: 'result.action.copy' };
  return none;
}
