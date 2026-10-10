import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { bridge } from './bridge';
import { initialTranslationState, translationReducer } from './reducer';
import { t } from './i18n';
import { defaultActionId } from './actionDefaults';
import { ilotJourney } from './menu/outcome';
import { errorCodeOf } from './result/errors';
import type {
  Capture,
  CaptureNotice,
  CaptureTarget,
  ErrorCode,
  MenuKey,
  MenuRepeat,
  Screen,
  Settings,
  StreamEvent,
  ResultDelivery,
  UndoState,
} from './types';

// A notice (nothing to translate, protected field…) shows four seconds, like Rust keeps its window.
const NOTICE_MS = 4000;
// A « replace » capture whose paste never reports back opens its glass after this.
const DELIVERY_MS = 3000;
// code (lot 10): why Rust refused the capture; the Îlot says it in its own words (GlassOverlay).
export type Notice = { id: number; message: string; code?: ErrorCode };
// Why the overlay cannot work at all; the window shows it in its own language.
export type InitError = 'connection' | 'close';

export function useTranslation(readyOnMount = false) {
  const [state, dispatch] = useReducer(translationReducer, initialTranslationState);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeTimer = useRef(0);
  // The screen the glass is on (the capture's, then `work-area` when the cursor moves a bottom form).
  const [screen, setScreen] = useState<Screen | null>(null);
  const [closingCaptureId, setClosingCaptureId] = useState<string | null>(null);
  const closingRef = useRef<string | null>(null);
  const requestRef = useRef<string | null>(null);
  const captureRef = useRef<Capture | null>(null);
  const settingsRef = useRef<Settings | null>(null);
  const settingsReadyRef = useRef<Promise<boolean>>(Promise.resolve(false));
  const handledCaptureRef = useRef<string | null>(null);
  // Lot 7: the menu keys Rust forwards while the source keeps the keyboard (`menu-key`). They may
  // come before the Îlot has rendered, so they wait here for the menu capture they belong to;
  // `menuKeys` counts them per capture and IlotStage takes them with `takeMenuKeys`.
  const menuKeysRef = useRef<MenuKey[]>([]);
  const [menuKeys, setMenuKeys] = useState({ captureId: '', count: 0 });
  const takeMenuKeys = useCallback((captureId: string) => {
    const keys = menuKeysRef.current.filter((key) => key.captureId === captureId);
    menuKeysRef.current = [];
    return keys;
  }, []);
  // The same count as the keys arrive, ahead of the render: a keyboard answer compares with it, so
  // a key forwarded just before the window got the keyboard is not taken for a later one.
  const menuKeyCount = useRef({ captureId: '', count: 0 });
  const forwardedKeys = useCallback(
    (captureId: string) => (menuKeyCount.current.captureId === captureId ? menuKeyCount.current.count : 0),
    [],
  );
  // Deltas are buffered until the stream ends: the glass shows a ring, then the whole
  // result lands at once (one native resize instead of one per line). An error or an
  // interruption still surfaces the partial text through flush().
  const pending = useRef({ requestId: '', text: '' });
  const [initError, setInitError] = useState<InitError | null>(null);

  const discardPending = useCallback(() => {
    pending.current = { requestId: '', text: '' };
  }, []);
  const flush = useCallback(() => {
    const queued = pending.current;
    if (queued.text && queued.requestId === requestRef.current)
      dispatch({ type: 'STREAM', event: { requestId: queued.requestId, kind: 'delta', text: queued.text } });
    discardPending();
  }, [discardPending]);

  useEffect(() => {
    settingsReadyRef.current = bridge
      .getSettings()
      .then((next) => {
        settingsRef.current = next;
        setSettings(next);
        return true;
      })
      .catch(() => false);
    return () => {
      discardPending();
      window.clearTimeout(noticeTimer.current);
    };
  }, [discardPending]);
  const showNotice = useCallback((message: string, code?: ErrorCode) => {
    window.clearTimeout(noticeTimer.current);
    setNotice({ id: Date.now(), message, ...(code ? { code } : {}) });
    noticeTimer.current = window.setTimeout(() => setNotice(null), NOTICE_MS);
  }, []);

  const start = useCallback(
    (capture: Capture, forced?: { serverId?: string }) => {
      const serverId = forced?.serverId ?? capture.execution?.serverId ?? settingsRef.current?.defaultServerId ?? 's1';
      const id = crypto.randomUUID();
      discardPending();
      requestRef.current = id;
      dispatch({ type: 'START', requestId: id, serverId });
      void bridge
        .translate({
          id,
          captureId: capture.id,
          text: capture.text,
          serverId,
          actionId: capture.execution?.actionId ?? settingsRef.current?.defaultActionId ?? defaultActionId,
        })
        .catch((error: unknown) => {
          if (requestRef.current === id)
            dispatch({
              type: 'STREAM',
              event: {
                requestId: id,
                kind: 'error',
                message: typeof error === 'string' ? error : t('error.startFailed'),
              },
            });
        });
    },
    [discardPending],
  );

  const receiveCapture = useCallback(
    (capture: Capture) => {
      if (handledCaptureRef.current === capture.id) return;
      if (requestRef.current) void bridge.cancel(requestRef.current).catch(() => undefined);
      discardPending();
      requestRef.current = null;
      handledCaptureRef.current = capture.id;
      captureRef.current = capture;
      closingRef.current = null;
      menuKeysRef.current = [];
      menuKeyCount.current = { captureId: capture.id, count: 0 };
      setMenuKeys({ captureId: capture.id, count: 0 });
      setClosingCaptureId(null);
      window.clearTimeout(noticeTimer.current);
      setNotice(null);
      setScreen(capture.screen ?? null);
      dispatch({ type: 'CAPTURE', capture });
      if (capture.replay) {
        // A result shown again from the tray: complete at once, nothing to translate.
        const { requestId, translatedText, serverId } = capture.replay;
        requestRef.current = requestId;
        dispatch({ type: 'START', requestId, serverId });
        dispatch({ type: 'STREAM', event: { requestId, kind: 'delta', text: translatedText } });
        dispatch({ type: 'STREAM', event: { requestId, kind: 'done' } });
        return;
      }
      // A menu capture (Îlot) waits for its choice: `choose` freezes it in Rust, then translates.
      if (capture.menu && !capture.execution) return;
      // The shortcut translates at once, clipboard fallback included: no confirmation step.
      start(capture);
    },
    [discardPending, start],
  );

  // Îlot (lots 3–4): the choice made in the menu, once per menu capture. Rust returns the
  // execution (always « replace »); the translation then starts like any capture's.
  const choosingRef = useRef<string | null>(null);
  // The same, for the Îlot: a choice on its way (the double press included) is not an abandon.
  const [choosingCaptureId, setChoosingCaptureId] = useState<string | null>(null);
  const choose = useCallback(
    async (actionId: string, instruction?: string) => {
      const capture = captureRef.current;
      if (!capture?.menu || capture.execution || closingRef.current || choosingRef.current === capture.id) return;
      choosingRef.current = capture.id;
      setChoosingCaptureId(capture.id);
      let execution;
      try {
        execution = await bridge.chooseAction(capture.id, actionId, instruction);
      } finally {
        if (choosingRef.current === capture.id) {
          choosingRef.current = null;
          setChoosingCaptureId(null);
        }
      }
      if (captureRef.current?.id !== capture.id || closingRef.current) return;
      const chosen = { ...capture, execution };
      captureRef.current = chosen;
      dispatch({ type: 'CHOOSE', captureId: capture.id, execution });
      start(chosen);
    },
    [start],
  );

  useEffect(() => {
    let off: Array<() => void> = [];
    let disposed = false;
    void Promise.all([
      bridge.on<Capture>('capture', receiveCapture),
      bridge.on<StreamEvent>('translation', (event) => {
        if (event.requestId !== requestRef.current || closingRef.current) return;
        if (event.kind === 'delta') {
          pending.current.requestId = event.requestId;
          pending.current.text += event.text ?? '';
        } else {
          flush();
          dispatch({ type: 'STREAM', event });
        }
      }),
      bridge.on<{ captureId: string }>('overlay-dismiss-requested', ({ captureId }) => {
        if (captureId !== captureRef.current?.id) return;
        discardPending();
        requestRef.current = null;
        closingRef.current = captureId;
        setClosingCaptureId(captureId);
        dispatch({ type: 'CANCEL' });
      }),
      bridge.on<Settings>('settings-changed', (next) => {
        settingsRef.current = next;
        setSettings(next);
      }),
      bridge.on<{ captureId: string; message: string }>('target-invalidated', (invalidation) => {
        if (invalidation.captureId === captureRef.current?.id)
          dispatch({ type: 'INVALIDATE', message: invalidation.message });
      }),
      bridge.on<CaptureTarget>('capture-target', (target) => dispatch({ type: 'TARGET', ...target })),
      // A code this front does not know reads as internal (src/result/errors.ts errorCodeOf).
      bridge.on<CaptureNotice>('capture-notice', ({ message, code }) =>
        showNotice(message, code === undefined ? undefined : errorCodeOf(code)),
      ),
      bridge.on<ResultDelivery>('result-delivery', (event) => {
        if (event.requestId !== requestRef.current || closingRef.current) return;
        dispatch({ type: 'DELIVERY', event });
        // Pasted: the pill's check is the whole feedback; only a fallback needs its reason, in
        // the glass. The Îlot says it in its error pill, from the code.
        if (event.status === 'fallback' && !ilotJourney(settingsRef.current, captureRef.current))
          showNotice(event.message);
      }),
      bridge.on<Screen>('work-area', (next) => setScreen(next)),
      // Lot 9: Undo is no longer safe; the reason decides what the Îlot says (src/menu/outcome.ts):
      // the user's own Ctrl+Z undid the paste (« Undone »), a key or the caret moved (the pill
      // leaves soon). Kept even when it comes before `result-delivery`.
      bridge.on<UndoState>('undo-state', (event) => {
        if (event.requestId === requestRef.current && !closingRef.current && event.available === false)
          dispatch({ type: 'UNDO_LOST', requestId: event.requestId, reason: event.reason });
      }),
      // Lot 4: the menu shortcut pressed twice within 400 ms runs, without the menu, the
      // last action of that application (else the default action). Handled here, not in
      // the menu, so it holds even before the menu has rendered.
      bridge.on<MenuRepeat>('menu-repeat', ({ captureId }) => {
        const capture = captureRef.current;
        if (capture?.id !== captureId || !capture.menu || capture.execution) return;
        void choose(capture.menu.lastActionId ?? settingsRef.current?.defaultActionId ?? defaultActionId).catch(
          () => undefined,
        );
      }),
      bridge.on<MenuKey>('menu-key', (key) => {
        const capture = captureRef.current;
        if (capture?.id !== key.captureId || !capture.menu || capture.execution || closingRef.current) return;
        menuKeysRef.current.push(key);
        const counted = menuKeyCount.current;
        menuKeyCount.current = {
          captureId: key.captureId,
          count: counted.captureId === key.captureId ? counted.count + 1 : 1,
        };
        setMenuKeys((current) => ({
          captureId: key.captureId,
          count: current.captureId === key.captureId ? current.count + 1 : 1,
        }));
      }),
    ])
      .then(async (listeners) => {
        if (disposed) listeners.forEach((unlisten) => unlisten());
        else {
          off = listeners;
          if (readyOnMount) {
            try {
              if (!(await settingsReadyRef.current)) throw new Error('settings unavailable');
              const capture = await bridge.frontendReady();
              if (capture && !disposed) receiveCapture(capture);
            } catch {
              if (!disposed) setInitError('connection');
            }
          }
        }
      })
      .catch(() => {
        if (!disposed) setInitError('connection');
      });
    return () => {
      disposed = true;
      off.forEach((unlisten) => unlisten());
    };
  }, [choose, discardPending, flush, readyOnMount, receiveCapture, showNotice]);

  // Rust pastes as soon as the result is complete; if nothing reports back, the glass opens.
  useEffect(() => {
    if (state.phase !== 'complete' || state.delivery !== 'pending' || !state.requestId) return;
    const requestId = state.requestId;
    const timer = window.setTimeout(() => {
      const message = t('error.deliveryTimeout');
      dispatch({ type: 'DELIVERY', event: { requestId, status: 'fallback', confirmed: false, message } });
      if (!ilotJourney(settingsRef.current, captureRef.current)) showNotice(message);
    }, DELIVERY_MS);
    return () => window.clearTimeout(timer);
  }, [state.phase, state.delivery, state.requestId, showNotice]);

  const cancelAndDismiss = useCallback(() => {
    void bridge.dismiss().catch(() => setInitError('close'));
  }, []);
  const completeDismiss = useCallback((captureId: string) => {
    if (closingRef.current !== captureId || captureRef.current?.id !== captureId) return;
    closingRef.current = null;
    captureRef.current = null;
    setClosingCaptureId(null);
    dispatch({ type: 'DISMISS' });
    void bridge.completeDismiss(captureId).catch(() => undefined);
  }, []);

  return {
    state,
    settings,
    screen,
    dispatch,
    receiveCapture,
    start,
    choose,
    choosingCaptureId,
    menuKeys,
    takeMenuKeys,
    forwardedKeys,
    cancelAndDismiss,
    completeDismiss,
    closingCaptureId,
    initError,
    notice,
  };
}

export type TranslationController = ReturnType<typeof useTranslation>;
