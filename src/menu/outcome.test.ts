import { describe, expect, it } from 'vitest';
import { initialTranslationState, type TranslationState } from '../reducer';
import type { AfterReplace, Capture, ErrorCode, ExecutionInfo } from '../types';
import {
  effectiveAfterReplace,
  ilotJourney,
  ilotOutcome,
  ownPasteRefusal,
  pasteCode,
  type OwnPaste,
  type UndoProgress,
} from './outcome';

const execution: ExecutionInfo = {
  actionId: 'correct',
  actionName: 'Fix grammar',
  outputMode: 'replace',
  serverId: 's2',
};
const capture: Capture = {
  id: 'c',
  text: 'x',
  source: 'selection',
  canReplace: true,
  anchor: null,
  menu: { lastActionId: null },
  execution,
};
const state = (patch: Partial<TranslationState> = {}): TranslationState => ({
  ...initialTranslationState,
  capture,
  requestId: 'r1',
  phase: 'streaming',
  delivery: 'pending',
  ...patch,
});
const outcome = (
  patch: Partial<TranslationState> = {},
  paste: OwnPaste | null = null,
  chosen = false,
  undo: UndoProgress | null = null,
) => ilotOutcome(state(patch), { chosen, paste, undo });

describe('the Îlot journey', () => {
  it('is a menu capture under uiVersion ilot, nothing else', () => {
    expect(ilotJourney({ uiVersion: 'ilot' }, { menu: { lastActionId: null } })).toBe(true);
    expect(ilotJourney({ uiVersion: 'v4' }, { menu: { lastActionId: null } })).toBe(false);
    expect(ilotJourney({ uiVersion: 'ilot' }, {})).toBe(false);
    expect(ilotJourney(null, { menu: { lastActionId: null } })).toBe(false);
  });
});

describe('ilotOutcome', () => {
  it('shows the menu until a choice, then works while the model runs and Rust pastes', () => {
    expect(
      outcome({ capture: { ...capture, execution: undefined }, phase: 'idle', requestId: null, delivery: null }),
    ).toEqual({ stage: 'menu' });
    // The choice is on its way: already the pill.
    expect(
      outcome(
        { capture: { ...capture, execution: undefined }, phase: 'idle', requestId: null, delivery: null },
        null,
        true,
      ),
    ).toEqual({ stage: 'working' });
    expect(outcome()).toEqual({ stage: 'working' });
    expect(outcome({ phase: 'complete', delivery: 'pending' })).toEqual({ stage: 'working' });
  });

  it('checks once Rust pasted, keeps the check while Undo is on its way, and says Undone after it', () => {
    const applied = { phase: 'complete', delivery: 'applied' } as const;
    expect(outcome(applied)).toEqual({ stage: 'done' });
    expect(outcome(applied, null, false, { status: 'pending' })).toEqual({ stage: 'done' });
    expect(outcome(applied, null, false, { status: 'undone' })).toEqual({ stage: 'undone' });
  });

  it('reads the user’s own Ctrl+Z in the source as Undone, a key or the caret as the check alone', () => {
    const applied = { phase: 'complete', delivery: 'applied' } as const;
    expect(outcome({ ...applied, undoLost: 'undo_key' })).toEqual({ stage: 'undone' });
    expect(outcome({ ...applied, undoLost: 'typed' })).toEqual({ stage: 'done' });
    expect(outcome({ ...applied, undoLost: 'caret_moved' })).toEqual({ stage: 'done' });
    // Undo asked from the pill decides: its answer, not the key Rust saw pass.
    expect(
      outcome({ ...applied, undoLost: 'undo_key' }, null, false, { status: 'refused', code: 'target_changed' }),
    ).toEqual({ stage: 'error', code: 'target_changed', source: 'undo' });
    // Not pasted yet: nothing to read as undone.
    expect(outcome({ phase: 'complete', delivery: 'pending', undoLost: 'undo_key' })).toEqual({ stage: 'working' });
  });

  it('says why an Undo could not be done, in its own words, and never as a paste to retry or copy', () => {
    const applied = { phase: 'complete', delivery: 'applied' } as const;
    // Refused: nothing was sent (the text changed, keys held, the application blocked it).
    expect(outcome(applied, null, false, { status: 'refused', code: 'target_changed' })).toEqual({
      stage: 'error',
      code: 'target_changed',
      source: 'undo',
    });
    expect(outcome(applied, null, false, { status: 'refused', code: 'keys_held' })).toEqual({
      stage: 'error',
      code: 'keys_held',
      source: 'undo',
    });
    expect(outcome(applied, null, false, { status: 'refused' })).toEqual({
      stage: 'error',
      code: 'internal',
      source: 'undo',
    });
    // Failed: sent, and the original did not read back.
    expect(outcome(applied, null, false, { status: 'failed', code: 'paste_blocked' })).toEqual({
      stage: 'error',
      code: 'paste_blocked',
      source: 'undo-sent',
    });
  });

  it('turns a stream error into its code, an unknown or missing one into internal, a cancel into leaving', () => {
    expect(outcome({ phase: 'error', delivery: null, code: 'unauthorized' })).toEqual({
      stage: 'error',
      code: 'unauthorized',
    });
    expect(outcome({ phase: 'error', delivery: null, code: null })).toEqual({ stage: 'error', code: 'internal' });
    expect(outcome({ phase: 'error', delivery: null, code: 'cancelled' })).toEqual({ stage: 'leave' });
    expect(outcome({ phase: 'cancelled', delivery: 'pending' })).toEqual({ stage: 'leave' });
  });

  it('reads a delivery fallback as a paste failure whatever its code: the result exists, Copy it', () => {
    for (const [code, expected] of [
      ['target_changed', 'target_changed'],
      ['not_editable', 'not_editable'],
      ['keys_held', 'keys_held'],
      ['paste_blocked', 'paste_blocked'],
      [null, 'paste_blocked'],
      ['busy', 'paste_blocked'],
      ['internal', 'paste_blocked'],
    ] as Array<[ErrorCode | null, ErrorCode]>) {
      expect(outcome({ phase: 'complete', delivery: 'fallback', code }), String(code)).toEqual({
        stage: 'error',
        code: expected,
      });
    }
    expect(pasteCode(undefined)).toBe('paste_blocked');
  });

  it('pastes a retried result itself: working until replace_result answers, then the check or Copy result', () => {
    // A retry: Rust delivers a capture's first request only (delivery null for the second).
    const retried = { requestId: 'r2', phase: 'complete', delivery: null } as const;
    expect(outcome(retried)).toEqual({ stage: 'working' });
    // A paste of an older request does not count.
    expect(outcome(retried, { requestId: 'r1', status: 'applied' })).toEqual({ stage: 'working' });
    expect(outcome(retried, { requestId: 'r2', status: 'pending' })).toEqual({ stage: 'working' });
    expect(outcome(retried, { requestId: 'r2', status: 'applied' })).toEqual({ stage: 'done' });
    expect(outcome(retried, { requestId: 'r2', status: 'refused' })).toEqual({ stage: 'error', code: 'paste_blocked' });
    expect(outcome({ ...retried, invalidated: true }, { requestId: 'r2', status: 'refused' })).toEqual({
      stage: 'error',
      code: 'target_changed',
    });
    // The refusal says why (its code, src/result/errors.ts refusalCode): the window moved, keys held…
    for (const code of ['target_changed', 'keys_held', 'not_editable', 'paste_blocked'] as const) {
      expect(outcome(retried, { requestId: 'r2', status: 'refused', code }), code).toEqual({ stage: 'error', code });
    }
    // Always a paste code: the result exists and was not pasted, Copy it.
    expect(outcome(retried, { requestId: 'r2', status: 'refused', code: 'busy' })).toEqual({
      stage: 'error',
      code: 'paste_blocked',
    });
    // The watcher's word wins: the selection moved.
    expect(
      outcome({ ...retried, invalidated: true }, { requestId: 'r2', status: 'refused', code: 'keys_held' }),
    ).toEqual({ stage: 'error', code: 'target_changed' });
  });

  it('never tries that paste over a selection the watcher dropped, nor on a capture that cannot be written', () => {
    const retried = { requestId: 'r2', phase: 'complete', delivery: null } as const;
    expect(ownPasteRefusal(state(retried))).toBeNull();
    expect(ownPasteRefusal(state({ ...retried, invalidated: true }))).toBe('target_changed');
    expect(ownPasteRefusal(state({ ...retried, capture: { ...capture, canReplace: false } }))).toBe('not_editable');
    expect(outcome({ ...retried, invalidated: true })).toEqual({ stage: 'error', code: 'target_changed' });
    expect(outcome({ ...retried, capture: { ...capture, canReplace: false } })).toEqual({
      stage: 'error',
      code: 'not_editable',
    });
  });
});

describe('effectiveAfterReplace', () => {
  const after: AfterReplace = { check: true, undo: true, undoSeconds: 8, changedWords: true, changedWordsSeconds: 60 };
  it('keeps Undo only while Rust offers it for this replacement', () => {
    expect(effectiveAfterReplace(after, false)).toEqual({ ...after, undo: false });
    expect(effectiveAfterReplace(after, true)).toEqual(after);
    expect(effectiveAfterReplace({ ...after, check: false }, false)).toEqual({ ...after, check: false, undo: false });
    // Settings without the section: the defaults (check on).
    expect(effectiveAfterReplace(undefined, false)).toMatchObject({ check: true, undo: false });
  });
});
