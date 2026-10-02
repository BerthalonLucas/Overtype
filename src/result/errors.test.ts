import { describe, expect, it } from 'vitest';
import labData from '../../design-lab/src/data.js?raw';
import errorRs from '../../src-tauri/src/error.rs?raw';
import { languages, translate } from '../i18n';
import { resolveField } from '../settings/fields';
import { errorCodes, type ErrorCode } from '../types';
import { describeError, errorCodeOf, errorFamily, refusalCode } from './errors';

// The lab's outcomes (design-lab/src/data.js:64-73), read from its source.
type Outcome = { id: string; kind?: string; field?: string; short?: Record<'en' | 'fr', string>; action?: Record<'en' | 'fr', string> };
const start = labData.indexOf('export const OUTCOMES = [');
const outcomes = new Function(`return ${labData.slice(labData.indexOf('[', start), labData.indexOf('];', start) + 1)};`)() as Outcome[];
const outcome = (id: string) => outcomes.find(item => item.id === id)!;

// Words as a reader counts them: a number with its thousands separator is one.
const wordCount = (text: string) => text.replace(/(\d)[\s,.](?=\d{3}\b)/g, '$1').split(/\s+/).filter(word => /[\p{L}\p{N}]/u.test(word)).length;

describe('error codes', () => {
  it('lists the codes of lot 10 and those the audit added, each in one family', () => {
    expect(errorCodes).toEqual(['unreachable', 'timeout', 'unauthorized', 'model_not_found', 'bad_endpoint', 'busy', 'length', 'stream_broken', 'paste_blocked', 'target_changed', 'not_editable', 'too_long', 'cancelled', 'server_error', 'no_selection', 'protected_field', 'keys_held', 'settings_open', 'nothing_recent', 'internal', 'read_only', 'protected_window', 'setup_open']);
    const families = Object.fromEntries(errorCodes.map(kind => [kind, errorFamily(kind)]));
    expect(families).toEqual({
      unreachable: 'config', bad_endpoint: 'config', unauthorized: 'config', model_not_found: 'config',
      timeout: 'transient', busy: 'transient', server_error: 'transient', stream_broken: 'transient', length: 'transient', internal: 'transient',
      paste_blocked: 'paste', target_changed: 'paste', not_editable: 'paste', keys_held: 'paste', read_only: 'paste',
      too_long: 'content', no_selection: 'content', protected_field: 'content', settings_open: 'content', nothing_recent: 'content', protected_window: 'content', setup_open: 'content',
      cancelled: 'silent',
    });
  });

  it('knows every code Rust sends, and no other', () => {
    // src-tauri/src/error.rs lists each ErrorKind with its snake_case name in its own test: a code
    // added on the native side fails here until the front gives it a family and its texts.
    const rust = [...errorRs.matchAll(/\(ErrorKind::\w+, "([a-z_]+)"\)/g)].map(match => match[1]);
    expect(rust.length).toBeGreaterThan(0);
    expect([...rust].sort()).toEqual([...errorCodes].sort());
  });

  it('reads a code from the bridge, anything unknown being internal', () => {
    expect(errorCodeOf('busy')).toBe('busy');
    for (const value of ['Busy', 'http_500', '', null, undefined, 42, { kind: 'busy' }]) expect(errorCodeOf(value)).toBe('internal');
  });

  it('gives configuration errors the exact field of the Settings, for the request’s server', () => {
    const fields: Array<[ErrorCode, string]> = [['unreachable', 'endpoint'], ['bad_endpoint', 'endpoint'], ['unauthorized', 'apiKey'], ['model_not_found', 'model']];
    const servers = [{ id: 's1' }, { id: 's2' }];
    for (const [kind, field] of fields) {
      expect(describeError(kind).action).toEqual({ type: 'settings', field });
      expect(describeError(kind, { serverId: 's2' }).action).toEqual({ type: 'settings', field: `s2.${field}` });
      // Both forms are identifiers of lot 13 (src/settings/fields.ts).
      expect(resolveField(field, servers, 's1')).toBe(`s1.${field}`);
      expect(resolveField(`s2.${field}`, servers, 's1')).toBe(`s2.${field}`);
    }
  });

  it('gives one button per family: Try again, Copy result, or none', () => {
    for (const kind of errorCodes) {
      const { family, action, actionLabel } = describeError(kind);
      if (family === 'transient') expect([action, actionLabel]).toEqual([{ type: 'retry' }, 'common.retry']);
      if (family === 'paste') expect([action, actionLabel]).toEqual([{ type: 'copy' }, 'result.action.copy']);
      if (family === 'content' || family === 'silent') expect([action, actionLabel]).toEqual([null, null]);
      if (family === 'config') expect(actionLabel).toMatch(/^result\.action\.(endpoint|apiKey|model)$/);
    }
  });

  it('offers no button for a capture Rust refused: nothing was read, nothing to retry or copy', () => {
    for (const code of errorCodes) {
      const { action, actionLabel, message } = describeError(code, { source: 'capture' });
      expect([action, actionLabel], code).toEqual([null, null]);
      // The request's words, but for the source window changing during the capture: nothing
      // was tried, so « not replaced » would mislead.
      expect(message, code).toBe(code === 'target_changed' ? 'result.notice.target_changed' : describeError(code).message);
    }
    expect(languages.map(language => translate(language, describeError('target_changed', { source: 'capture' }).message))).toEqual(['Window changed — try again', 'Fenêtre changée, réessayez']);
  });

  it('says why an Undo could not be done in its own words, with no button: nothing else is pasted', () => {
    const text = (code: ErrorCode, source: 'undo' | 'undo-sent') => languages.map(language => translate(language, describeError(code, { source }).message));
    expect(text('target_changed', 'undo')).toEqual(['Text changed — can’t undo', 'Texte modifié, annulation impossible']);
    expect(text('keys_held', 'undo')).toEqual(['Keys held down — can’t undo', 'Touches enfoncées, annulation impossible']);
    expect(text('paste_blocked', 'undo')).toEqual(['This app blocked Undo', 'L’application a bloqué l’annulation']);
    expect(text('internal', 'undo')).toEqual(['Can’t undo now', 'Annulation indisponible']);
    expect(text('paste_blocked', 'undo-sent')).toEqual(['Undo not confirmed — check text', 'Annulation non confirmée, vérifiez']);
    for (const code of errorCodes) for (const source of ['undo', 'undo-sent'] as const) {
      const { action, actionLabel } = describeError(code, { source });
      expect([action, actionLabel], `${code} ${source}`).toEqual([null, null]);
    }
  });

  it('says the Settings in front and nothing recent by their own codes, never from Rust’s words', () => {
    const text = (code: ErrorCode) => languages.map(language => translate(language, describeError(code, { source: 'capture' }).message));
    expect(text('no_selection')).toEqual(['Select some text first', 'Sélectionnez d’abord du texte']);
    expect(text('settings_open')).toEqual(['Close Settings first', 'Fermez d’abord les Réglages']);
    expect(text('setup_open')).toEqual(['Finish the setup first', 'Terminez d’abord l’accueil']);
    expect(text('nothing_recent')).toEqual(['No recent translation', 'Aucune traduction récente']);
  });

  it('reads a replace_result refusal by its code, anything else as internal', () => {
    // Rust rejects with `{message, code}` (Refusal); the French message is for the 0.4 glass only.
    for (const code of ['target_changed', 'keys_held', 'not_editable', 'paste_blocked'] as const) {
      expect(refusalCode({ message: 'La fenêtre source a changé; remplacement refusé.', code }), code).toBe(code);
    }
    expect(refusalCode({ message: 'x', code: 'teapot' })).toBe('internal');
    for (const reason of [undefined, null, 'La fenêtre source a changé; remplacement refusé.', new Error('x'), 42, { message: 'x' }]) expect(refusalCode(reason)).toBe('internal');
  });

  it('says it in six words at most, in English and in French', () => {
    const descriptions = [...errorCodes.map(kind => describeError(kind, { model: 'gemma-4-12b' })), ...errorCodes.map(kind => describeError(kind, { source: 'capture' })),
      ...errorCodes.map(kind => describeError(kind, { source: 'undo' })), describeError('paste_blocked', { source: 'undo-sent' })];
    for (const { code: kind, message, actionLabel } of descriptions) {
      for (const language of languages) {
        const text = translate(language, message, { model: 'gemma-4-12b' });
        expect(text.trim(), `${kind} ${language}`).not.toBe('');
        expect(wordCount(text), `${kind} ${language}: ${text}`).toBeLessThanOrEqual(6);
        if (actionLabel) expect(wordCount(translate(language, actionLabel)), `${kind} ${language}`).toBeLessThanOrEqual(3);
      }
    }
  });

  it('takes the lab’s wording where the lab has it', () => {
    const mapped: Array<[string, ErrorCode]> = [['endpoint', 'unreachable'], ['key', 'unauthorized'], ['model', 'model_not_found'], ['busy', 'busy'], ['paste', 'paste_blocked'], ['changed', 'target_changed'], ['long', 'too_long']];
    for (const [id, kind] of mapped) {
      const lab = outcome(id);
      const { family, message, params, actionLabel } = describeError(kind, { model: 'gemma-4-12b' });
      expect(family, id).toBe(lab.kind);
      for (const language of languages) {
        expect(translate(language, message, params), `${id} ${language}`).toBe(lab.short![language]);
        expect(actionLabel ? translate(language, actionLabel) : undefined, `${id} ${language}`).toBe(lab.action?.[language]);
      }
    }
    // Without the model's name, a plain « Model not found ».
    expect(translate('en', describeError('model_not_found').message)).toBe('Model not found');
    expect(describeError('model_not_found', { model: '  ' }).params).toBeUndefined();
    // The lab's notice when nothing is selected (Simulator.jsx:264).
    expect(['en', 'fr'].map(language => translate(language as 'en' | 'fr', describeError('no_selection').message))).toEqual(['Select some text first', 'Sélectionnez d’abord du texte']);
  });
});
