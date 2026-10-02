import { describe, expect, it } from 'vitest';
import { initialTranslationState, translationReducer } from './reducer';
import type { Capture } from './types';

const selected: Capture = { id: 'c1', text: 'Hello', source: 'selection', canReplace: true, anchor: null };

describe('translationReducer', () => {
  it('demands confirmation for clipboard input', () => {
    const clipboard = { ...selected, source: 'clipboard' as const, canReplace: false };
    expect(translationReducer(initialTranslationState, { type: 'CAPTURE', capture: clipboard }).phase).toBe('idle');
  });
  it('keeps a menu capture waiting, then gives it the chosen execution once and waits for the paste', () => {
    const menu: Capture = { ...selected, menu: { lastActionId: null } };
    let state = translationReducer(initialTranslationState, { type: 'CAPTURE', capture: menu });
    expect(state).toMatchObject({ phase: 'idle', delivery: null, requestId: null });
    const execution = { actionId: 'correct', actionName: 'Fix grammar', outputMode: 'replace' as const, serverId: 's1' as const };
    expect(translationReducer(state, { type: 'CHOOSE', captureId: 'stale', execution })).toBe(state);
    state = translationReducer(state, { type: 'TARGET', captureId: 'c1', canReplace: false });
    state = translationReducer(state, { type: 'CHOOSE', captureId: 'c1', execution });
    expect(state).toMatchObject({ delivery: 'pending', capture: { execution, canReplace: false, menu: { lastActionId: null } } });
    expect(translationReducer(state, { type: 'CHOOSE', captureId: 'c1', execution: { ...execution, actionId: 'translate' } })).toBe(state);
  });
  it('ignores events belonging to a stale request', () => {
    const active = translationReducer(translationReducer(initialTranslationState, { type: 'CAPTURE', capture: selected }), { type: 'START', requestId: 'new', serverId: 's1' });
    expect(translationReducer(active, { type: 'STREAM', event: { requestId: 'old', kind: 'done' } })).toEqual(active);
  });
  it('enables completed actions only after the done event', () => {
    let state = translationReducer(initialTranslationState, { type: 'CAPTURE', capture: selected });
    state = translationReducer(state, { type: 'START', requestId: 'r1', serverId: 's1' });
    state = translationReducer(state, { type: 'STREAM', event: { requestId: 'r1', kind: 'delta', text: 'Bonjour' } });
    expect(state.phase).toBe('streaming');
    state = translationReducer(state, { type: 'STREAM', event: { requestId: 'r1', kind: 'done' } });
    expect(state.phase).toBe('complete');
    expect(state.replacementValid).toBe(true);
  });
  it('invalidates replacement without discarding an already rendered result', () => {
    const complete = { ...initialTranslationState, capture: selected, result: 'Bonjour', phase: 'complete' as const, replacementValid: true };
    const next = translationReducer(complete, { type: 'INVALIDATE', message: 'La sélection a changé.' });
    expect(next).toMatchObject({ result: 'Bonjour', replacementValid: false });
  });
  it('ignores done events after cancellation', () => {
    let state = translationReducer(initialTranslationState, { type: 'CAPTURE', capture: selected });
    state = translationReducer(state, { type: 'START', requestId: 'r1', serverId: 's1' });
    state = translationReducer(state, { type: 'CANCEL' });
    state = translationReducer(state, { type: 'STREAM', event: { requestId: 'r1', kind: 'done' } });
    expect(state.phase).toBe('cancelled');
    expect(state.requestId).toBeNull();
  });
  it('does not restore replacement after invalidation arrives during a stream', () => {
    let state = translationReducer(initialTranslationState, { type: 'CAPTURE', capture: selected });
    state = translationReducer(state, { type: 'START', requestId: 'r1', serverId: 's1' });
    state = translationReducer(state, { type: 'INVALIDATE', message: 'La sélection a changé.' });
    state = translationReducer(state, { type: 'STREAM', event: { requestId: 'r1', kind: 'done' } });
    expect(state).toMatchObject({ phase: 'complete', replacementValid: false });
  });
  it('offers replacement only once the native target arrives, for the current capture', () => {
    const pending = { ...selected, canReplace: false };
    let state = translationReducer(initialTranslationState, { type: 'CAPTURE', capture: pending });
    state = translationReducer(state, { type: 'START', requestId: 'r1', serverId: 's1' });
    state = translationReducer(state, { type: 'STREAM', event: { requestId: 'r1', kind: 'done' } });
    expect(state.replacementValid).toBe(false);
    expect(translationReducer(state, { type: 'TARGET', captureId: 'other', canReplace: true })).toEqual(state);
    state = translationReducer(state, { type: 'TARGET', captureId: 'c1', canReplace: true });
    expect(state).toMatchObject({ replacementValid: true, capture: { canReplace: true } });
    const invalidated = translationReducer(state, { type: 'INVALIDATE', message: 'La sélection a changé.' });
    expect(translationReducer(invalidated, { type: 'TARGET', captureId: 'c1', canReplace: true }).replacementValid).toBe(false);
  });
  it('shows the final text of the done event in place of the deltas, and keeps them without it', () => {
    let state = translationReducer(initialTranslationState, { type: 'CAPTURE', capture: selected });
    state = translationReducer(state, { type: 'START', requestId: 'r1', serverId: 's1' });
    state = translationReducer(state, { type: 'STREAM', event: { requestId: 'r1', kind: 'delta', text: '```\nBonjour\n```' } });
    expect(translationReducer(state, { type: 'STREAM', event: { requestId: 'r1', kind: 'done', text: 'Bonjour' } }).result).toBe('Bonjour');
    expect(translationReducer(state, { type: 'STREAM', event: { requestId: 'r1', kind: 'done' } }).result).toBe('```\nBonjour\n```');
  });
  it('a replace capture waits for its delivery, applied or fallback', () => {
    const replace = { ...selected, execution: { actionId: 'correct', actionName: 'Corriger', outputMode: 'replace' as const, serverId: 's1' as const } };
    let state = translationReducer(initialTranslationState, { type: 'CAPTURE', capture: replace });
    expect(state.delivery).toBe('pending');
    state = translationReducer(state, { type: 'START', requestId: 'r1', serverId: 's1' });
    state = translationReducer(state, { type: 'STREAM', event: { requestId: 'r1', kind: 'done', text: 'Bonjour' } });
    expect(state.delivery).toBe('pending');
    expect(translationReducer(state, { type: 'DELIVERY', event: { requestId: 'other', status: 'applied', confirmed: true, message: '' } }).delivery).toBe('pending');
    expect(translationReducer(state, { type: 'DELIVERY', event: { requestId: 'r1', status: 'applied', confirmed: true, message: '' } })).toMatchObject({ delivery: 'applied', replacementValid: false });
    expect(translationReducer(state, { type: 'DELIVERY', event: { requestId: 'r1', status: 'fallback', confirmed: false, message: 'x' } })).toMatchObject({ delivery: 'fallback', result: 'Bonjour' });
    // A relaunch with the other profile shows its result: no second delivery.
    expect(translationReducer(state, { type: 'START', requestId: 'r2', serverId: 's2' }).delivery).toBeNull();
  });
  it('offers Undo only after Rust’s own paste found its text, until undo-state withdraws it for that request', () => {
    let state = translationReducer(initialTranslationState, { type: 'CAPTURE', capture: { id: 'c1', text: 'x', source: 'selection', canReplace: true, anchor: null, execution: { actionId: 'correct', actionName: 'Fix', outputMode: 'replace', serverId: 's1' } } });
    state = translationReducer(state, { type: 'START', requestId: 'r1', serverId: 's1' });
    state = translationReducer(state, { type: 'STREAM', event: { requestId: 'r1', kind: 'done', text: 'y' } });
    expect(state.undoable).toBe(false);
    expect(translationReducer(state, { type: 'DELIVERY', event: { requestId: 'r1', status: 'applied', confirmed: true, message: '' } }).undoable).toBe(false);
    expect(translationReducer(state, { type: 'DELIVERY', event: { requestId: 'r1', status: 'fallback', confirmed: false, message: '', undoable: true } }).undoable).toBe(false);
    const pasted = translationReducer(state, { type: 'DELIVERY', event: { requestId: 'r1', status: 'applied', confirmed: true, message: '', undoable: true, pastedRects: [{ x: 0, y: 0, width: 10, height: 10 }] } });
    expect(pasted.undoable).toBe(true);
    expect(translationReducer(pasted, { type: 'UNDO_LOST', requestId: 'stale', reason: 'typed' })).toBe(pasted);
    expect(translationReducer(pasted, { type: 'UNDO_LOST', requestId: 'r1', reason: 'typed' })).toMatchObject({ undoable: false, undoLost: 'typed' });
    // A retry starts without Undo.
    expect(translationReducer(pasted, { type: 'START', requestId: 'r2', serverId: 's1' }).undoable).toBe(false);
  });

  it('keeps why Undo was withdrawn, the first reason only, even when undo-state comes before the delivery', () => {
    let state = translationReducer(initialTranslationState, { type: 'CAPTURE', capture: { id: 'c1', text: 'x', source: 'selection', canReplace: true, anchor: null, execution: { actionId: 'correct', actionName: 'Fix', outputMode: 'replace', serverId: 's1' } } });
    state = translationReducer(state, { type: 'START', requestId: 'r1', serverId: 's1' });
    state = translationReducer(state, { type: 'STREAM', event: { requestId: 'r1', kind: 'done', text: 'y' } });
    const delivered = { type: 'DELIVERY', event: { requestId: 'r1', status: 'applied', confirmed: true, message: '', undoable: true } } as const;
    // Rust watched the caret move between its paste and the delivery reaching the page.
    const early = translationReducer(state, { type: 'UNDO_LOST', requestId: 'r1', reason: 'caret_moved' });
    expect(early).toMatchObject({ undoable: false, undoLost: 'caret_moved' });
    expect(translationReducer(early, delivered)).toMatchObject({ delivery: 'applied', undoable: false, undoLost: 'caret_moved' });
    // The first reason stays.
    const pasted = translationReducer(state, delivered);
    const undone = translationReducer(pasted, { type: 'UNDO_LOST', requestId: 'r1', reason: 'undo_key' });
    expect(undone).toMatchObject({ undoable: false, undoLost: 'undo_key' });
    expect(translationReducer(undone, { type: 'UNDO_LOST', requestId: 'r1', reason: 'typed' })).toBe(undone);
    // Another request, another capture: nothing withdrawn yet.
    expect(translationReducer(undone, { type: 'START', requestId: 'r2', serverId: 's1' }).undoLost).toBeNull();
    expect(translationReducer(undone, { type: 'CAPTURE', capture: { id: 'c2', text: 'x', source: 'selection', canReplace: true, anchor: null } }).undoLost).toBeNull();
  });

  it('keeps the code of lot 10 beside the message, an unknown one read as internal, none as null', () => {
    const replace = { ...selected, execution: { actionId: 'correct', actionName: 'Corriger', outputMode: 'replace' as const, serverId: 's1' as const } };
    let state = translationReducer(initialTranslationState, { type: 'CAPTURE', capture: replace });
    state = translationReducer(state, { type: 'START', requestId: 'r1', serverId: 's1' });
    expect(translationReducer(state, { type: 'STREAM', event: { requestId: 'r1', kind: 'error', message: 'Clé refusée.', code: 'unauthorized' } })).toMatchObject({ phase: 'error', error: 'Clé refusée.', code: 'unauthorized' });
    expect(translationReducer(state, { type: 'STREAM', event: { requestId: 'r1', kind: 'error', message: 'x', code: 'teapot' as never } }).code).toBe('internal');
    expect(translationReducer(state, { type: 'STREAM', event: { requestId: 'r1', kind: 'error', message: 'x' } }).code).toBeNull();
    const done = translationReducer(state, { type: 'STREAM', event: { requestId: 'r1', kind: 'done', text: 'Bonjour' } });
    expect(translationReducer(done, { type: 'DELIVERY', event: { requestId: 'r1', status: 'fallback', confirmed: false, message: 'x', code: 'target_changed' } }).code).toBe('target_changed');
    expect(translationReducer(done, { type: 'DELIVERY', event: { requestId: 'r1', status: 'applied', confirmed: true, message: '' } }).code).toBeNull();
    // A relaunch starts clean.
    const failed = translationReducer(state, { type: 'STREAM', event: { requestId: 'r1', kind: 'error', message: 'x', code: 'busy' } });
    expect(translationReducer(failed, { type: 'START', requestId: 'r2', serverId: 's1' }).code).toBeNull();
  });
  it('keeps a target that arrives before the result for the done event', () => {
    let state = translationReducer(initialTranslationState, { type: 'CAPTURE', capture: { ...selected, canReplace: false } });
    state = translationReducer(state, { type: 'START', requestId: 'r1', serverId: 's1' });
    state = translationReducer(state, { type: 'TARGET', captureId: 'c1', canReplace: true });
    expect(state.replacementValid).toBe(false);
    state = translationReducer(state, { type: 'STREAM', event: { requestId: 'r1', kind: 'done' } });
    expect(state.replacementValid).toBe(true);
  });

});
