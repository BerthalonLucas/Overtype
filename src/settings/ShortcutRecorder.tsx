import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Keyboard as KeyboardIcon, X } from 'lucide-react';
import { Button, ICON, KeyCombo, Keycap } from '../components/controls';
import { useTx } from '../components/motion';
import { bridge } from '../bridge';
import { useT, type MessageKey, type Translate } from '../i18n';
import type { BindingState, ShortcutConflict } from '../types';
import { describeRefusal } from './messages';

// The keys of a keydown the recorder reads (a React or a DOM KeyboardEvent).
export type RecordedKey = Pick<
  KeyboardEvent,
  'key' | 'code' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey' | 'getModifierState'
>;
export function fromKey(event: RecordedKey): { value?: string; error?: MessageKey } {
  if (['Control', 'Alt', 'Shift', 'Meta', 'AltGraph', 'CapsLock', 'NumLock'].includes(event.key)) return {};
  if (event.metaKey) return { error: 'shortcuts.windowsKey' };
  if (event.getModifierState('AltGraph')) return { error: 'shortcuts.altGr' };
  if (!event.ctrlKey && !event.altKey) return { error: 'shortcuts.needModifier' };
  if (event.key === 'F12') return { error: 'shortcuts.f12' };
  if (
    (event.ctrlKey && event.altKey && event.key === 'Delete') ||
    (event.altKey && ['Tab', 'F4', 'Escape'].includes(event.key))
  )
    return { error: 'shortcuts.system' };
  const { code, key } = event;
  // Windows registers virtual letter keys: respect the active layout (AZERTY too). Ctrl+Alt
  // on a letter that has an AltGr character reports that character (AZERTY: Ctrl+Alt+E → €):
  // the letter then comes from the physical key, and the recorder warns (shortcut_conflict).
  const main = /^[a-z]$/i.test(key)
    ? key.toUpperCase()
    : event.ctrlKey && event.altKey && /^Key[A-Z]$/.test(code)
      ? code.slice(3)
      : /^Digit\d$/.test(code)
        ? code.slice(5)
        : /^F([1-9]|1[01]|2[0-4]|1[3-9])$/.test(key)
          ? key
          : code === 'Space'
            ? 'Space'
            : ['Enter', 'Tab', 'Backspace', 'Delete', 'Home', 'End', 'PageUp', 'PageDown'].includes(key)
              ? key
              : key.startsWith('Arrow')
                ? key.slice(5)
                : null;
  if (!main) return { error: 'shortcuts.badKey' };
  return {
    value: [event.ctrlKey && 'Ctrl', event.altKey && 'Alt', event.shiftKey && 'Shift', main].filter(Boolean).join('+'),
  };
}

// Rust answers with the layout of the window in front (the Settings while they are open);
// one question per chord and window is enough.
const conflicts = new Map<string, Promise<ShortcutConflict | null>>();
const holdsCtrlAlt = (shortcut: string) => {
  const parts = shortcut.toLowerCase().split('+');
  return parts.includes('ctrl') && parts.includes('alt');
};
function useAltGrConflict(shortcut: string, enabled: boolean): ShortcutConflict | null {
  const [conflict, setConflict] = useState<{ shortcut: string; value: ShortcutConflict | null } | null>(null);
  useEffect(() => {
    if (!enabled || !shortcut || !holdsCtrlAlt(shortcut)) return;
    let live = true;
    let pending = conflicts.get(shortcut);
    if (!pending) {
      pending = bridge.shortcutConflict(shortcut).catch(() => null);
      conflicts.set(shortcut, pending);
    }
    void pending.then((value) => {
      if (live) setConflict({ shortcut, value });
    });
    return () => {
      live = false;
    };
  }, [shortcut, enabled]);
  return enabled && conflict?.shortcut === shortcut && conflict.value?.altGr ? conflict.value : null;
}

// A notice is one of ours (a message key, shown in the current language) or Rust's refusal.
type Notice = { key: MessageKey } | { text: string } | null;
type Props = {
  shortcut: string;
  enabled: boolean;
  label: string;
  busy: boolean;
  // Saves the chord (enabling its binding); null once saved, else Rust's refusal.
  record: (shortcut: string) => Promise<string | null>;
  // What Windows answered for this chord (lot 10, `shortcut_status`): 'taken' when another
  // application holds it, 'failed' for any other refusal. Unknown: nothing is said.
  registration?: BindingState;
  // Lucas, 24/09: a taken chord gets a free one to take in one click (the menu's: Rust's
  // suggest_shortcut); null when none is free.
  suggest?: () => Promise<string | null>;
  // lg: the menu's own shortcut, with large keycaps. xl: the setup's question, as the lab draws
  // it (design-lab/reglages/src/journey/screens.jsx): three large keycaps, « Changer » with its
  // keyboard icon centred underneath, beside whatever `actions` adds (« Rétablir… »).
  size?: 'md' | 'lg' | 'xl';
  changeLabel?: string;
  // What the box says while it listens with no key down yet (the setup has the lab's words).
  hint?: string;
  actions?: ReactNode;
  onCapturing?: (capturing: boolean) => void;
};
// A chord as keycaps: the stored names (Ctrl+Alt+Space) in the interface's words (Espace, Maj).
const keyNames: Record<string, MessageKey> = {
  Space: 'page.key.space',
  Shift: 'page.key.shift',
  Enter: 'page.key.enter',
  Backspace: 'page.key.backspace',
  Delete: 'page.key.delete',
};
export const keyLabel = (part: string, t: Translate) => (keyNames[part] ? t(keyNames[part]) : part);
export const shortcutKeys = (shortcut: string, t: Translate) =>
  shortcut
    .split('+')
    .filter(Boolean)
    .map((part) => keyLabel(part, t));
// The modifiers held right now, in the order Windows writes them.
const heldModifiers = (event: Pick<KeyboardEvent, 'ctrlKey' | 'altKey' | 'shiftKey'>) =>
  [event.ctrlKey && 'Ctrl', event.altKey && 'Alt', event.shiftKey && 'Shift'].filter(Boolean) as string[];
// The proposal for a taken chord, asked again whenever the chord or its state changes.
function useSuggestion(suggest: Props['suggest'], shortcut: string, taken: boolean): string | null {
  const [suggestion, setSuggestion] = useState<{ shortcut: string; value: string | null } | null>(null);
  useEffect(() => {
    if (!suggest || !taken || !shortcut) return;
    let live = true;
    void suggest().then(
      (value) => {
        if (live) setSuggestion({ shortcut, value });
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [suggest, shortcut, taken]);
  return taken && suggestion?.shortcut === shortcut ? suggestion.value : null;
}
// The keycaps, the Change button, then what happened: saved, refused (translated), whether
// Windows could register the saved chord, and the AltGr warning while the saved chord is also an
// AltGr key here. Warnings, never a refusal: the recorder stays free to take another chord.
// While it listens the keycaps light up as the keys go down (design-lab/reglages/src/settings/
// ShortcutRecorder.jsx), and its box carries data-recording so the window's own shortcuts
// (Ctrl+Shift+M, Escape) stand aside. Escape, a click elsewhere or « Cancel » stop it.
export function ShortcutRecorder({
  shortcut,
  enabled,
  label,
  busy,
  record,
  registration,
  suggest,
  size = 'md',
  changeLabel,
  hint,
  actions,
  onCapturing,
}: Props) {
  const t = useT();
  const tx = useTx();
  const [capturing, setCapturing] = useState(false);
  const [held, setHeld] = useState<string[]>([]);
  const [notice, setNotice] = useState<Notice>(null);
  const recorder = useRef<HTMLDivElement>(null);
  const conflict = useAltGrConflict(shortcut, enabled);
  const proposal = useSuggestion(suggest, shortcut, enabled && registration === 'taken');
  const tellCapturing = useRef(onCapturing);
  tellCapturing.current = onCapturing;
  useEffect(() => {
    if (capturing) recorder.current?.focus();
    else setHeld([]);
    tellCapturing.current?.(capturing);
  }, [capturing]);
  const take = async (value: string) => {
    setCapturing(false);
    setNotice(null);
    const error = await record(value);
    setNotice(error === null ? { key: 'shortcuts.saved' } : { text: error });
  };
  const captureKey = async (event: KeyboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Escape') {
      setCapturing(false);
      return;
    }
    if (event.repeat || busy) return;
    const candidate = fromKey(event);
    if (candidate.error) {
      setHeld(heldModifiers(event));
      setNotice({ key: candidate.error });
      return;
    }
    if (!candidate.value) {
      setHeld(heldModifiers(event));
      return;
    }
    setHeld(candidate.value.split('+'));
    await take(candidate.value);
  };
  const releaseKey = (event: KeyboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    setHeld(heldModifiers(event));
  };
  const noticeText = notice === null ? '' : 'key' in notice ? t(notice.key) : describeRefusal(notice.text, t);
  const saved = notice !== null && 'key' in notice && notice.key === 'shortcuts.saved';
  const key = shortcut.split('+').at(-1) ?? '';
  const invalid = capturing && notice !== null && !saved;
  const caps = size;
  const stacked = size === 'xl';
  const buttons = capturing ? (
    <Button
      size="sm"
      variant={stacked ? 'secondary' : 'ghost'}
      icon={stacked ? <X {...ICON} size={14} /> : undefined}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => {
        setNotice(null);
        setCapturing(false);
      }}
    >
      {t('shortcuts.cancel')}
    </Button>
  ) : (
    <Button
      size="sm"
      disabled={busy}
      icon={stacked ? <KeyboardIcon {...ICON} size={14} /> : undefined}
      onClick={() => {
        setNotice(null);
        setCapturing(true);
      }}
    >
      {changeLabel ?? t('shortcuts.change')}
    </Button>
  );
  return (
    <div className="st-recorder" data-size={size} data-stacked={stacked ? '' : undefined}>
      <div className="st-recorder-line">
        {capturing ? (
          <div
            ref={recorder}
            tabIndex={0}
            role="textbox"
            aria-readonly="true"
            aria-label={t('page.shortcuts.pressFor', { label })}
            aria-live="polite"
            className="st-recorder-box"
            data-recording=""
            data-invalid={invalid ? '' : undefined}
            onKeyDown={(event) => void captureKey(event)}
            onKeyUp={releaseKey}
            onBlur={() => setCapturing(false)}
          >
            <AnimatePresence initial={false} mode="popLayout">
              {held.length ? (
                <motion.span
                  key="keys"
                  className="st-recorder-keys"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={tx(0.12)}
                >
                  {held.map((part, index) => (
                    <motion.span
                      key={part}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={tx('bouncy')}
                      className="st-recorder-key"
                    >
                      {index > 0 && (
                        <span className="ft-keycombo-plus" aria-hidden="true">
                          +
                        </span>
                      )}
                      <Keycap size={caps} active>
                        {keyLabel(part, t)}
                      </Keycap>
                    </motion.span>
                  ))}
                </motion.span>
              ) : (
                <motion.span
                  key="hint"
                  className="st-recorder-hint"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={tx(0.12)}
                >
                  {hint ?? t('shortcuts.press')}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <span
            className="st-recorder-value"
            role="img"
            aria-label={`${label}: ${shortcut || t('shortcuts.unset')}`}
            data-off={shortcut && !enabled ? '' : undefined}
          >
            <KeyCombo keys={shortcut ? shortcutKeys(shortcut, t) : [t('shortcuts.unset')]} size={caps} />
          </span>
        )}
        {/* While listening, a press on Cancel must not first blur the box (which would stop, then
          the click would start listening again). */}
        {!stacked && buttons}
      </div>
      {stacked && (
        <div className="st-recorder-actions">
          {buttons}
          {!capturing && actions}
        </div>
      )}
      {noticeText && (
        <p
          className="st-recorder-problem shortcut-notice"
          data-ok={saved || undefined}
          role={saved ? 'status' : 'alert'}
        >
          {noticeText}
        </p>
      )}
      {enabled && shortcut && !capturing && (registration === 'taken' || registration === 'failed') && (
        <p className="st-recorder-problem shortcut-notice" data-warning={registration} role="status">
          {t(registration === 'taken' ? 'shortcuts.stateTaken' : 'shortcuts.stateFailed', { shortcut })}
        </p>
      )}
      {proposal && !capturing && (
        <p className="shortcut-notice shortcut-suggestion">
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void take(proposal)}>
            {t('shortcuts.useSuggestion', { shortcut: proposal })}
          </Button>
        </p>
      )}
      {conflict && !capturing && (
        <p className="st-recorder-problem shortcut-notice" data-warning="altgr" role="status">
          {conflict.character
            ? t('shortcuts.altGrConflict', { shortcut, key, character: conflict.character })
            : t('shortcuts.altGrConflictKey', { shortcut, key })}
        </p>
      )}
    </div>
  );
}
