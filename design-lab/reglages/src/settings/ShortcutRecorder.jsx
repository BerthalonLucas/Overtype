// Records a global shortcut: focus it, press the keys. The keycaps light up as the keys go down;
// the combination is checked like the app does (Ctrl or Alt required, no Windows key, no F12…).
// Échap cancels. While recording, the element carries data-recording so the window's own shortcuts
// (Ctrl+Maj+M) stand aside.
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Keycap, KeyCombo, Button } from '../ui/index.jsx';
import { useTx } from '../lib/motion.js';
import { keyLabel, isModifier, orderKeys, shortcutProblem } from './state.js';

export function ShortcutRecorder({ keys, onChange, others = [], label = 'Raccourci', startRecording = false, onDone, size = 'md' }) {
  const [recording, setRecording] = useState(startRecording);
  const [held, setHeld] = useState([]);
  const [problem, setProblem] = useState(null);
  const box = useRef(null);
  const tx = useTx();

  useEffect(() => { if (recording) box.current?.focus(); }, [recording]);

  const stop = () => { setRecording(false); setHeld([]); onDone?.(); };
  const onKeyDown = e => {
    if (!recording) return;
    e.preventDefault(); e.stopPropagation();
    const k = keyLabel(e);
    if (k === 'Escape' && !e.ctrlKey && !e.altKey && !e.shiftKey) { setProblem(null); stop(); return; }
    const mods = [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Maj', e.metaKey && 'Windows'].filter(Boolean);
    const now = orderKeys([...mods, k]);
    setHeld(now);
    if (!isModifier(k)) {
      const p = shortcutProblem(now, others);
      setProblem(p);
      if (!p) { onChange(now); setTimeout(() => { setHeld([]); setRecording(false); onDone?.(); }, 260); }
    }
  };
  const onKeyUp = e => {
    if (!recording) return;
    e.preventDefault();
    const mods = [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Maj'].filter(Boolean);
    setHeld(h => (h.some(k => !isModifier(k)) ? h : orderKeys(mods)));
  };

  return (
    <div className="st-recorder" data-size={size}>
      <div className="st-recorder-line">
        {recording ? (
          <div ref={box} tabIndex={0} role="textbox" aria-label={`${label} : pressez la combinaison`} aria-live="polite"
            className="st-recorder-box" data-recording="" data-invalid={problem ? '' : undefined}
            onKeyDown={onKeyDown} onKeyUp={onKeyUp} onBlur={() => { if (!problem) stop(); }}>
            <AnimatePresence initial={false} mode="popLayout">
              {held.length ? (
                <motion.span key="keys" className="st-recorder-keys" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={tx(0.12)}>
                  {held.map((k, i) => (
                    <motion.span key={k} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={tx('bouncy')} className="st-recorder-key">
                      {i > 0 && <span className="ft-keycombo-plus" aria-hidden="true">+</span>}
                      <Keycap size={size === 'lg' ? 'lg' : 'md'} active>{k}</Keycap>
                    </motion.span>
                  ))}
                </motion.span>
              ) : (
                <motion.span key="hint" className="st-recorder-hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={tx(0.12)}>
                  Pressez la combinaison…
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <KeyCombo keys={keys?.length ? keys : ['À définir']} size={size === 'lg' ? 'lg' : 'md'} />
        )}
        {recording
          ? <Button size="sm" variant="ghost" onMouseDown={e => e.preventDefault()} onClick={() => { setProblem(null); stop(); }}>Annuler</Button>
          : <Button size="sm" onClick={() => { setProblem(null); setRecording(true); }}>Modifier</Button>}
      </div>
      <AnimatePresence initial={false}>
        {problem && (
          <motion.p key={problem} className="st-recorder-problem" role="alert" initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={tx(0.16)}>
            {problem}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
