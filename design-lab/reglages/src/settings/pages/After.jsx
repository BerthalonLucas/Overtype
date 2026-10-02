import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CircleCheck, Undo2, Highlighter, PanelBottom } from 'lucide-react';
import { Group, Row, Switch, Slider, Segmented, ICON } from '../../ui/index.jsx';
import { useTx, clock } from '../../lib/motion.js';
import { useScope } from '../../lab/Scope.jsx';
import { useSettings } from '../state.js';

const fmtSeconds = v => (v >= 60 ? `${Math.floor(v / 60)} min${v % 60 ? ` ${v % 60} s` : ''}` : `${v} s`);

// A live preview: a replaced sentence, its changed words (luminous text), and the APP's result pill
// (the DOM of src/result/ResultPill.tsx with src/result/result.css, as in the Démo): ✓, then an
// « Annuler » chip with its countdown ring. Placed by the app's rule: its right edge on the end of
// the new text, 8 px under its last line (placement.rs strip); « Dans la marge »: beside that line.
const CIRC = 2 * Math.PI * 5;
function useCountdown(seconds, paused) {
  const [p, setP] = useState(1);
  const st = useRef({ left: seconds * 1000, last: 0, rest: 0 });
  useEffect(() => { st.current = { left: seconds * 1000, last: 0, rest: 0 }; setP(1); }, [seconds]);
  useEffect(() => {
    let raf = 0;
    const tick = now => {
      const c = st.current;
      const dt = c.last ? Math.min(100, now - c.last) / (clock.t || 1) : 0;
      c.last = now;
      if (c.rest > 0) { c.rest -= dt; if (c.rest <= 0) c.left = seconds * 1000; }
      else if (!paused.current) { c.left -= dt; if (c.left <= 0) { c.left = 0; c.rest = 900; } }
      setP(Math.max(0, c.left / (seconds * 1000)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seconds, paused]);
  return p;
}
function AfterPreview({ s }) {
  const tx = useTx();
  const { theme } = useScope();
  const stage = useRef(null);
  const end = useRef(null);
  const hover = useRef(false);
  const [at, setAt] = useState(null);
  const pill = useRef(null);
  const [pillW, setPillW] = useState(0);
  useLayoutEffect(() => { setPillW(pill.current?.offsetWidth || 0); }, [s.check, s.undo, s.placement]);
  const p = useCountdown(s.undoSeconds, hover);
  const hasPill = s.check || s.undo;
  useLayoutEffect(() => {
    const measure = () => {
      const st = stage.current?.getBoundingClientRect(), e = end.current?.getBoundingClientRect(), doc = end.current?.closest('.st-after-doc')?.getBoundingClientRect();
      if (!st || !e || !st.width) return;
      const k = st.width / (stage.current.offsetWidth || st.width);   // the stage may be scaled
      setAt({ x: (e.left - st.left) / k, top: (e.top - st.top) / k, bottom: (e.bottom - st.top) / k, docRight: (doc.right - st.left) / k });
    };
    measure();
    const ro = new ResizeObserver(measure); ro.observe(stage.current);
    return () => ro.disconnect();
  }, [s.changedWords, s.textSize]);
  const W = ({ children }) => (s.changedWords ? <span className="st-changed">{children}</span> : <>{children}</>);
  const layout = s.check && s.undo ? '' : s.check ? ' is-check-only' : ' is-undo-only';
  const place = !at ? { visibility: 'hidden' } : s.placement === 'margin'
    ? { left: at.docRight + 12, top: (at.top + at.bottom) / 2 - 14 }
    // the app keeps the pill inside the work area: here, inside the preview (8 px margin)
    : { left: Math.max(8, at.x - pillW), top: at.bottom + 8 };
  return (
    <figure ref={stage} className="st-after-stage" aria-label="Aperçu après remplacement" data-placement={s.placement}>
      <div className="st-after-doc">
        <p className="st-after-muted">Bonjour Julie,</p>
        <p className="st-after-new">
          Je vous <W>ai</W> envoyé le fichier hier soir. <W>Dites</W>-moi si <W>ça</W> vous convient pour jeudi.<span ref={end} className="st-after-end" />
        </p>
        <p className="st-after-muted">Bonne journée,<br />Lucas</p>
      </div>
      <AnimatePresence initial={false}>
        {hasPill && (
          <motion.div key={`${s.placement}-${layout}`} className="dm-app st-app" data-theme={theme === 'dark' ? 'dark' : 'light'} style={place}
            onMouseEnter={() => { hover.current = true; }} onMouseLeave={() => { hover.current = false; }}
            initial={{ opacity: 0, y: -4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
            transition={tx(s.motionPreset === 'bouncy' ? 'bouncy' : 'smooth')}>
            <div ref={pill} className="ilot-shape st-app-shape">
              <div className={`result-row${layout}`} role="group" aria-label="Texte remplacé">
                {s.check && <svg className="result-check" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path pathLength={1} d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                {s.undo && (
                  <span className="result-btn result-undo">
                    <Undo2 size={12} strokeWidth={1.5} aria-hidden="true" />Annuler
                    <svg className="result-ring" viewBox="0 0 14 14" aria-hidden="true"><circle className="track" cx="7" cy="7" r="5" /><circle cx="7" cy="7" r="5" strokeDasharray={`${(CIRC * p).toFixed(2)} 99`} /></svg>
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </figure>
  );
}

export function AfterPage() {
  const { s, set } = useSettings();
  return (
    <>
      <AfterPreview s={s} />
      <Group>
        <Row id="placement" icon={<PanelBottom {...ICON} />} title="Position de la pilule" description="Jamais sur le nouveau texte."
          control={<Segmented label="Position de la pilule" size="sm" value={s.placement} onChange={v => set({ placement: v })}
            options={[{ value: 'below', label: 'Sous le texte' }, { value: 'margin', label: 'Dans la marge' }]} />} />
      </Group>
      <Group title="Confirmation">
        <Row id="check" icon={<CircleCheck {...ICON} />} title="Coche" description="Montre que le texte a été remplacé."
          control={<Switch checked={s.check} onCheckedChange={v => set({ check: v })} label="Coche" />} />
      </Group>

      <Group title="Annuler">
        <Row id="undo" icon={<Undo2 {...ICON} />} title="Bouton Annuler" description="Un bouton qui remet le texte d’origine."
          control={<Switch checked={s.undo} onCheckedChange={v => set({ undo: v })} label="Bouton Annuler" />} />
        <div className="st-dependent" data-off={s.undo ? undefined : ''} aria-disabled={!s.undo || undefined}>
          <Row title="Durée d’Annuler" description="De 2 à 20 secondes. Le survol la met en pause."
            control={<Slider label="Durée d’Annuler" value={s.undoSeconds} min={2} max={20} onChange={v => set({ undoSeconds: v })} format={v => `${v} s`} />} />
          <Row title="Méthode" description="Ctrl+Z dans l’application, ou l’app recolle l’original."
            control={<Segmented label="Méthode" size="sm" value={s.undoStrategy} onChange={v => set({ undoStrategy: v })}
              options={[{ value: 'keystroke', label: 'Ctrl+Z' }, { value: 'repaste', label: 'Recoller l’original' }]} />} />
        </div>
      </Group>

      <Group title="Mots changés">
        <Row id="changedWords" icon={<Highlighter {...ICON} />} title="Mettre en valeur les mots changés" description="Les mots changés par le modèle, jusqu’à votre prochaine action dans le texte."
          control={<Switch checked={s.changedWords} onCheckedChange={v => set({ changedWords: v })} label="Mettre en valeur les mots changés" />} />
        <div className="st-dependent" data-off={s.changedWords ? undefined : ''}>
          <Row title="Durée de la mise en valeur" description="Le plus longtemps qu’il reste sans action."
            control={<Slider label="Durée de la mise en valeur" value={s.changedWordsSeconds} min={5} max={120} step={5} onChange={v => set({ changedWordsSeconds: v })} format={fmtSeconds} />} />
        </div>
      </Group>

    </>
  );
}
