import type { Capture, ErrorCode, ExecutionInfo, StreamEvent, ResultDelivery, UndoLoss } from './types';
import { t } from './i18n';
import { errorCodeOf } from './result/errors';

export type TranslationState = {
  capture: Capture | null;
  requestId: string | null;
  // The server of the running (or last) request; null before the first one.
  serverId: string | null;
  result: string;
  phase: 'idle' | 'streaming' | 'complete' | 'error' | 'cancelled';
  error: string | null;
  // Lot 10: the code of the last failure, a stream error or a delivery fallback (null: none, or
  // none sent). The v4 journey reads `error`; the Îlot reads this (src/menu/outcome.ts).
  code: ErrorCode | null;
  replacementValid: boolean;
  invalidated: boolean;
  comparing: boolean;
  delivery: null | 'pending' | 'applied' | 'fallback';
  // Lot 9: Rust's own paste under the Îlot found its text and Undo is on (`result-delivery`
  // applied, `undoable`), until `undo-state` withdraws it. False for anything else.
  undoable: boolean;
  // Lot 9: why Rust withdrew Undo for the current request (`undo-state`), null while it has not.
  // Kept even when it arrives before `result-delivery` (Rust may send it in between), so that
  // delivery never offers an Undo already withdrawn.
  undoLost: UndoLoss | null;
};

export const initialTranslationState: TranslationState = {
  capture: null,
  requestId: null,
  serverId: null,
  result: '',
  phase: 'idle',
  delivery: null,
  error: null,
  code: null,
  replacementValid: false,
  invalidated: false,
  comparing: false,
  undoable: false,
  undoLost: null,
};

export type Action =
  | { type: 'CAPTURE'; capture: Capture }
  | { type: 'CHOOSE'; captureId: string; execution: ExecutionInfo }
  | { type: 'START'; requestId: string; serverId: string }
  | { type: 'STREAM'; event: StreamEvent }
  | { type: 'TARGET'; captureId: string; canReplace: boolean }
  | { type: 'INVALIDATE'; message: string }
  | { type: 'DELIVERY'; event: ResultDelivery }
  | { type: 'UNDO_LOST'; requestId: string; reason: UndoLoss }
  | { type: 'CANCEL' }
  | { type: 'DISMISS' }
  | { type: 'TOGGLE_COMPARE' };

export function translationReducer(state: TranslationState, action: Action): TranslationState {
  switch (action.type) {
    case 'CAPTURE':
      return {
        ...state,
        capture: action.capture,
        requestId: null,
        result: '',
        error: null,
        code: null,
        comparing: false,
        undoable: false,
        undoLost: null,
        replacementValid: false,
        invalidated: false,
        phase: 'idle',
        delivery: action.capture.execution?.outputMode === 'replace' && !action.capture.replay ? 'pending' : null,
      };
    // Îlot: the menu capture received its execution (`choose_action`); the menu always
    // replaces, so the pill waits for the native delivery like a direct « replace » capture.
    case 'CHOOSE':
      if (action.captureId !== state.capture?.id || state.capture.execution) return state;
      return {
        ...state,
        capture: { ...state.capture, execution: action.execution },
        delivery: action.execution.outputMode === 'replace' ? 'pending' : null,
      };
    case 'START':
      return {
        ...state,
        requestId: action.requestId,
        serverId: action.serverId,
        undoable: false,
        undoLost: null,
        result: '',
        error: null,
        code: null,
        phase: 'streaming',
        replacementValid: false,
        delivery: state.requestId ? null : state.delivery,
      };
    case 'STREAM':
      if (action.event.requestId !== state.requestId) return state;
      if (action.event.kind === 'delta') return { ...state, result: state.result + (action.event.text ?? '') };
      // `done` may carry the cleaned final text (no thinking block, no fence): it replaces the deltas.
      if (action.event.kind === 'done')
        return {
          ...state,
          phase: 'complete',
          result: action.event.text ?? state.result,
          replacementValid: !state.invalidated && (state.capture?.canReplace ?? false),
        };
      return {
        ...state,
        phase: 'error',
        delivery: null,
        error: action.event.message ?? t('error.failed'),
        code: action.event.code === undefined ? null : errorCodeOf(action.event.code),
        replacementValid: false,
      };
    case 'DELIVERY':
      if (action.event.requestId !== state.requestId) return state;
      return {
        ...state,
        delivery: action.event.status,
        code:
          action.event.status === 'fallback' && action.event.code !== undefined ? errorCodeOf(action.event.code) : null,
        replacementValid: action.event.status === 'applied' ? false : state.replacementValid,
        undoable: action.event.status === 'applied' && action.event.undoable === true && state.undoLost === null,
      };
    // Lot 9: Rust withdrew Undo (a key in the source, the user's own Ctrl+Z, the caret moved), once
    // per replacement; the first reason stays, even before the delivery reached the reducer.
    case 'UNDO_LOST':
      return action.requestId === state.requestId && state.undoLost === null
        ? { ...state, undoable: false, undoLost: action.reason }
        : state;
    case 'TARGET':
      // The native target arrives behind the shown window; a stale capture id is ignored.
      if (action.captureId !== state.capture?.id) return state;
      return {
        ...state,
        capture: { ...state.capture, canReplace: action.canReplace },
        replacementValid:
          state.phase === 'complete' && !state.invalidated && state.delivery !== 'applied' && action.canReplace,
      };
    case 'INVALIDATE':
      return { ...state, replacementValid: false, invalidated: true, error: action.message };
    case 'DISMISS':
      return { ...initialTranslationState };
    case 'CANCEL':
      return state.phase === 'streaming'
        ? { ...state, requestId: null, phase: 'cancelled', replacementValid: false }
        : state;
    case 'TOGGLE_COMPARE':
      return { ...state, comparing: !state.comparing };
    default:
      return state;
  }
}
