// DÉMO — how the app works, as pure animation (Lucas, QCM 29/09, point 3). The user does nothing:
// the setup window closes, a mail draft opens, a big cursor (bluish halo, black pointer) selects a
// sentence word by word, the default shortcut lights up key by key, the Îlot arrives beside the
// selection, unfolds, « Corriger » is clicked, the Perle works, the corrected text replaces the
// selection with the changed words highlighted, the result pill offers Undo.
// On the right, a rail unfolds on hover / focus / tap and explains each thing you can change;
// hovering an item jumps the animation to that moment and rings the matching element.
//
// Fixed export: default Demo({ standalone, onDone, autoPlay = true, intro = standalone })
//   Renders INSIDE a <Stage> (desktop pixels). onDone(): end of the demo (auto, 3 s after the end
//   card unless the viewer took the controls) or « Continuer » / « Passer ».
//   shortcut: optional key labels (['Ctrl', 'Alt', 'Espace'] by default, max 3) chosen in the setup.
//   intro: show the stand-in setup window closing first (the Parcours closes its own window, so
//   it passes intro={false} or leaves it to the default).
// Everything moves by transform / opacity, every frame is scene(t) (./timeline.js): play, pause,
// scrub and « show me » are the same thing. Speed: t advances at 1 / lab speed. Mouvement
// réduit: a calm slideshow of still frames with a fade.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Play, Pause, RotateCcw, SkipForward, Keyboard, LayoutGrid, Replace, Undo2, Highlighter, Sparkles, Server,
  SlidersHorizontal, Check, Languages, Briefcase, Scissors, Mail, WandSparkles, SpellCheck, Paperclip, Send,
  Bold, Italic, Underline, List, ArrowRight, Minus, Square, X,
} from 'lucide-react';
import { Button, Segmented, ICON } from '../ui/index.jsx';
import { Vote } from '../lab/Vote.jsx';
import { useLab } from '../lab/store.jsx';
import { useClock, useTx } from '../lib/motion.js';
import { useDesktop, AppMark } from '../stage/Desktop.jsx';
import { appName, defaultShortcut, ACTIONS } from '../brand.js';
import { T, START_NO_INTRO, CHAPTERS, SLIDES, HOLD, scene } from './timeline.js';
import './demo.css';

// ——— The text ———
const OLD = 'Je vous envoie le compte rendu de la réunion de mardi, comme convenue. J’espère qu’il vous sera utile et que les chiffre sont clair.';
const NEW = 'Je vous envoie le compte rendu de la réunion de mardi, comme convenu. J’espère qu’il vous sera utile et que les chiffres sont clairs.';
const split = s => s.split(' ').map(tok => { const m = tok.match(/^(.*?)([.,;:!?]*)$/); return { core: m[1], punct: m[2] }; });
const OLD_W = split(OLD);
const NEW_W = split(NEW);
const CHANGED = NEW_W.map((w, i) => (w.core !== OLD_W[i]?.core ? i : -1)).filter(i => i >= 0);

// ——— Layout (desktop px, inside the 900 × 620 focus the section asks for) ———
const WIN = { x: 214, y: 104, w: 660, h: 408 };
const RAIL = { right: 1076, y: 96, w: 316, h: 548, rail: 56 };
const GRID = { w: 218, h: 116, pad: 6, tw: 66, th: 50, gap: 4 };
const ICONS = { corriger: SpellCheck, traduire: Languages, professionnel: Briefcase, raccourcir: Scissors, email: Mail, consigne: WandSparkles };

// What the rail explains, the moment it shows and the element it rings.
const EXPLAIN = [
  { id: 'raccourci', icon: Keyboard, tile: 1, title: 'Raccourci', text: `${defaultShortcut.join(' + ')} par défaut. Prenez-en un autre s’il est déjà pris.`, where: 'Raccourcis', at: 5700, target: 'hud' },
  { id: 'actions', icon: LayoutGrid, tile: 2, title: 'Actions et lettres', text: 'Ajoutez, renommez, réordonnez. Chaque lettre lance son action sans clic.', where: 'Actions', at: 7640, target: 'grid' },
  { id: 'remplacer', icon: Replace, tile: 3, title: 'Remplacer ou afficher', text: 'Le résultat remplace la sélection, ou s’affiche à côté pour le copier vous-même.', where: 'Après remplacement', at: 11100, target: 'text' },
  { id: 'annuler', icon: Undo2, tile: 4, title: 'Annuler', text: 'Le bouton reste quelques secondes. Ctrl + Z marche aussi.', where: 'Après remplacement', at: 11500, target: 'result' },
  { id: 'mots', icon: Highlighter, tile: 5, title: 'Mots changés', text: 'Surlignés tant que vous pouvez annuler, jusqu’au clic, ou pas du tout.', where: 'Après remplacement', at: 11100, target: 'diff' },
  { id: 'indicateur', icon: Sparkles, tile: 6, title: 'Indicateur', text: 'Perle, Nébuleuse ou Ruban, pendant que le modèle travaille.', where: 'Apparence', at: 9300, target: 'work' },
  { id: 'serveur', icon: Server, tile: 7, title: 'Serveur', text: 'L’adresse et la clé données au premier lancement. Un second serveur peut prendre le relais.', where: 'Serveur', at: 9300, target: 'server' },
];

// offsetLeft/Top up to `root`: layout coordinates, immune to the transforms that animate windows.
function offsetIn(el, root) {
  let x = 0, y = 0, node = el;
  while (node && node !== root) { x += node.offsetLeft; y += node.offsetTop; node = node.offsetParent; }
  return { x, y };
}
const fmt = ms => { const s = Math.max(0, Math.round(ms / 1000)); return `0:${String(s).padStart(2, '0')}`; };

export default function Demo({ standalone, onDone, autoPlay = true, intro = !!standalone, shortcut }) {
  const keys = Array.isArray(shortcut) && shortcut.length ? shortcut : defaultShortcut;
  const lab = useLab();
  const clock = useClock();
  const reduced = clock.reduced || lab.reduced;
  const start = intro ? 0 : START_NO_INTRO;

  // ——— Time ———
  const [t, setT] = useState(start);
  const [playing, setPlaying] = useState(autoPlay);
  const [preview, setPreview] = useState(null);     // { id, at } while an explainer item is hovered
  const [touched, setTouched] = useState(false);    // the viewer took the controls: no auto onDone
  const tRef = useRef(t); tRef.current = t;

  useEffect(() => {
    if (!playing || preview) return undefined;
    if (reduced) {
      // Slideshow: jump to the next still frame every HOLD ms (scaled by the lab speed).
      const next = SLIDES.find(s => s > tRef.current + 1);
      const id = setTimeout(() => {
        if (next == null) { setT(T.END); setPlaying(false); } else setT(next);
      }, (tRef.current < SLIDES[0] ? 400 : HOLD) * clock.t);
      return () => clearTimeout(id);
    }
    let raf = 0; let last = performance.now();
    const step = now => {
      const dt = Math.min(64, now - last); last = now;
      const nt = tRef.current + dt / clock.t;
      if (nt >= T.END) { setT(T.END); setPlaying(false); return; }
      setT(nt);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, preview, reduced, clock.t, t === T.END, reduced ? t : 0]); // reduced: re-arm on each slide

  // End: hand over to the Réglages (3 s after the end card), unless the viewer is driving.
  useEffect(() => {
    if (t < T.END || !onDone || !autoPlay || touched || preview) return undefined;
    const id = setTimeout(onDone, 3000 * clock.t);
    return () => clearTimeout(id);
  }, [t, onDone, autoPlay, touched, preview, clock.t]);

  const replay = () => { setT(start); setPlaying(true); setPreview(null); };
  const toggle = () => { setTouched(true); if (t >= T.END) replay(); else setPlaying(p => !p); };

  // ——— Geometry (measured once laid out, and again when fonts or sizes change) ———
  const root = useRef(null);
  const para = useRef(null);
  const oldRefs = useRef([]);
  const newRefs = useRef([]);
  const compactRef = useRef(null);
  const resultRef = useRef(null);
  const undoRef = useRef(null);
  const hudRef = useRef(null);
  const [geo, setGeo] = useState(null);
  const measure = useCallback(() => {
    const r = root.current; if (!r || !para.current) return;
    const words = oldRefs.current.map(el => { if (!el) return null; const o = offsetIn(el, r); return { x: o.x, y: o.y, w: el.offsetWidth, h: el.offsetHeight }; }).filter(Boolean);
    if (!words.length) return;
    const diff = CHANGED.map(i => { const el = newRefs.current[i]; if (!el) return null; const o = offsetIn(el, r); return { x: o.x, y: o.y, w: el.offsetWidth, h: el.offsetHeight }; }).filter(Boolean);
    const p = offsetIn(para.current, r);
    const textRect = { x: p.x, y: p.y, w: para.current.offsetWidth, h: para.current.offsetHeight };
    const first = words[0]; const lastW = words[words.length - 1];
    const selStart = { x: first.x + 1, y: first.y + first.h / 2 };
    const dragPath = [selStart, ...words.map((w, i) => ({ x: w.x + w.w - (i === words.length - 1 ? 0 : 4), y: w.y + w.h / 2 }))];
    // The Îlot opens beside the end of the selection (8–10 px gap), like the app's placement; it
    // drops below the selection only when the window has no room on the right.
    const selBottom = Math.max(...words.map(w => w.y + w.h));
    const room = WIN.x + WIN.w - 16 - (lastW.x + lastW.w + 10);
    const ilot = room >= GRID.w
      ? { x: Math.round(lastW.x + lastW.w + 10), y: Math.round(lastW.y + lastW.h / 2 - 16) }
      : { x: Math.round(Math.min(Math.max(lastW.x + lastW.w - 150, WIN.x + 24), WIN.x + WIN.w - GRID.w - 24)), y: Math.round(selBottom + 10) };
    const cw = compactRef.current?.offsetWidth || 150;
    const rw = resultRef.current?.offsetWidth || 120;
    const undo = undoRef.current
      ? { x: undoRef.current.offsetLeft, y: undoRef.current.offsetTop, w: undoRef.current.offsetWidth, h: undoRef.current.offsetHeight }
      : { x: rw - 80, y: 3, w: 76, h: 22 };
    const hud = hudRef.current ? { ...offsetIn(hudRef.current, r), w: hudRef.current.offsetWidth, h: hudRef.current.offsetHeight } : null;
    // Targets = where the tip clicks: at the edge of what it points at, so the label stays visible.
    const tilePt = { x: ilot.x + GRID.pad + GRID.tw - 8, y: ilot.y + GRID.pad + GRID.th - 7 };
    setGeo({
      words, diff, textRect, selStart, dragPath, ilot, cw, rw, hud,
      cursorHome: { x: WIN.x + WIN.w + 90, y: WIN.y + WIN.h + 120 },
      cursorRestPt: { x: lastW.x + lastW.w + 70, y: selBottom + 96 },
      ilotPt: { x: ilot.x + cw - 16, y: ilot.y + 26 },
      tilePt,
      tileOff: { x: tilePt.x + 30, y: tilePt.y + 32 },
      undoPt: { x: ilot.x + undo.x + undo.w - 6, y: ilot.y + undo.y + undo.h - 3 },
      cursorExit: { x: WIN.x + WIN.w + 60, y: WIN.y + WIN.h + 90 },
    });
  }, []);
  useLayoutEffect(() => {
    measure();
    let alive = true;
    document.fonts?.ready?.then(() => { if (alive) measure(); });
    const ro = new ResizeObserver(() => measure());
    if (para.current) ro.observe(para.current);
    return () => { alive = false; ro.disconnect(); };
  }, [measure]);

  // ——— Lab variants (standalone only) ———
  const [cursorStyle, setCursorStyle] = useState('anneau');
  const [hudPlace, setHudPlace] = useState('bas');
  useEffect(() => { const id = requestAnimationFrame(measure); return () => cancelAnimationFrame(id); }, [hudPlace, measure]);

  const shown = preview ? preview.at : t;
  const s = useMemo(() => scene(shown, geo), [shown, geo]);
  const ring = preview ? ringFor(preview.target, geo) : null;
  const ilotAt = geo?.ilot || { x: 520, y: 300 };
  const serverTag = preview?.target === 'server';

  return (
    <div ref={root} className="dm-root" data-paused={!playing || preview ? '' : undefined} data-reduced={reduced ? '' : undefined}
      role="region" aria-label={`Démo : comment utiliser ${appName}`}>
      {/* The animation itself: decorative, its caption is the accessible story. */}
      <div className="dm-scene" aria-hidden="true" key={reduced ? `slide-${shown}` : 'live'}>
        {intro && s.intro.on && <IntroWindow s={s.intro} />}

        <MailWindow s={s} para={para} oldRefs={oldRefs} newRefs={newRefs} />

        {/* Selection highlight, word by word (behind the text: the window paints it). */}
        <ShortcutHud s={s} place={hudPlace} hudRef={hudRef} keys={keys} />

        {/* The Îlot and its pills, anchored beside the end of the selection. */}
        <div className="dm-anchor" style={{ transform: `translate(${ilotAt.x}px, ${ilotAt.y}px)` }}>
          <div ref={compactRef} className="dm-surface dm-compact" style={{ opacity: s.compact.o, transform: `translateY(${s.compact.y}px) scale(${s.compact.scale})` }}>
            <span className="dm-compact-btn is-default"><SpellCheck size={14} strokeWidth={1.5} /><span>Corriger</span><span className="dm-hint">↵</span></span>
            <span className="dm-sep" />
            <span className="dm-compact-btn dm-ask"><span className="dm-dot" /></span>
          </div>
          <div className="dm-surface dm-grid" style={{ opacity: s.grid.o, transform: `scale(${s.grid.scale})`, visibility: s.grid.o > 0.001 ? 'visible' : 'hidden' }}>
            {ACTIONS.map((a, i) => {
              const Icon = ICONS[a.id] || Sparkles;
              return (
                <span key={a.id} className="dm-tile" data-hot={s.hot === i ? '' : undefined} data-press={s.hot === i && s.tilePress ? '' : undefined}>
                  <Icon size={16} strokeWidth={1.5} />
                  <span className="dm-tile-label">{a.label === 'Consigne libre' ? 'Consigne' : a.label}</span>
                  <span className="dm-tile-key">{a.key === 'Espace' ? '/' : a.key}</span>
                </span>
              );
            })}
          </div>
          <div className="dm-surface dm-work" style={{ opacity: s.work.o, transform: `scale(${s.work.scale})`, visibility: s.work.o > 0.001 ? 'visible' : 'hidden' }}>
            <span className="dm-perle" />
          </div>
          <div className="dm-server-tag" style={{ opacity: serverTag ? 1 : 0 }}>
            <Server size={12} strokeWidth={1.5} /> llm.exemple.com · qwen3-14b
          </div>
          <div ref={resultRef} className="dm-surface dm-result" style={{ opacity: s.result.o, transform: `scale(${s.result.scale})`, visibility: s.result.o > 0.001 ? 'visible' : 'hidden' }}>
            <span className="dm-check" style={{ opacity: Math.min(1, s.check * 1.5), transform: `scale(${0.4 + 0.6 * s.check})` }}><Check size={14} strokeWidth={2} /></span>
            <span ref={undoRef} className="dm-undo" data-hover={s.undoHover ? '' : undefined}>
              <Countdown p={s.countdown} />
              <span>Annuler</span>
            </span>
            <span className="dm-undo-tip" style={{ opacity: s.undoHover ? 1 : 0, transform: `translateY(${s.undoHover ? 0 : -3}px)` }}>ou Ctrl + Z</span>
          </div>
        </div>

        {/* Click ripples and the big cursor. */}
        {s.ripples.map((r, i) => (
          <span key={i} className="dm-ripple" style={{ opacity: r.o, transform: `translate(${r.x}px, ${r.y}px) translate(-50%, -50%) scale(${r.k})` }} />
        ))}
        <BigCursor c={s.cursor} variant={cursorStyle} />

        {/* The explainer's ring around the element it talks about. */}
        <div className="dm-ring-layer">
          {ring && ring.map((r, i) => (
            <motion.span key={`${preview.id}-${i}`} className="dm-ring"
              initial={{ opacity: 0, scale: 1.08 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', duration: 0.35 * clock.t, bounce: 0.2 }}
              style={{ left: r.x - 6, top: r.y - 6, width: r.w + 12, height: r.h + 12, borderRadius: r.r ?? 14 }} />
          ))}
        </div>

        {s.end.on && (
          <div className="dm-end" style={{ opacity: s.end.o, transform: `translate(-50%, ${s.end.y}px) scale(${s.end.scale})` }} aria-hidden="false">
            <AppMark size={36} />
            <h2>C’est tout.</h2>
            <p>Raccourci, actions, serveur : tout se modifie dans les Réglages. Survolez le bandeau de droite pour voir quoi.</p>
            <div className="dm-end-actions">
              <Button variant="secondary" size="md" icon={<RotateCcw {...ICON} />} onClick={replay}>Revoir</Button>
              {onDone && <Button variant="primary" size="md" iconEnd={<ArrowRight {...ICON} />} onClick={onDone}>Continuer</Button>}
            </div>
          </div>
        )}
      </div>

      <Caption chapter={s.chapter} ended={t >= T.END} />
      <ExplainRail preview={preview} setPreview={setPreview} onTouch={() => setTouched(true)} />
      <Controls t={t} start={start} playing={playing && !preview} onToggle={toggle}
        onSeek={v => { setTouched(true); setT(v); }} onReplay={() => { setTouched(true); replay(); }} onSkip={onDone} reduced={reduced} />

      {standalone && (
        <div className="dm-lab">
          <span className="dm-lab-label" aria-hidden="true">Curseur</span>
          <Segmented label="Curseur" size="sm" value={cursorStyle} onChange={setCursorStyle}
            options={[{ value: 'anneau', label: 'Anneau' }, { value: 'disque', label: 'Disque' }]} />
          <Vote id={`demo.cursor.${cursorStyle}`} label={cursorStyle === 'anneau' ? 'Curseur : anneau bleuté fin' : 'Curseur : disque bleuté plein'} section="demo" compact />
          <span className="dm-lab-sep" />
          <span className="dm-lab-label" aria-hidden="true">Touches</span>
          <Segmented label="Place du raccourci" size="sm" value={hudPlace} onChange={setHudPlace}
            options={[{ value: 'bas', label: 'Touches en bas' }, { value: 'centre', label: 'Au centre' }]} />
          <Vote id={`demo.keys.${hudPlace}`} label={hudPlace === 'bas' ? 'Touches du raccourci sous la fenêtre' : 'Touches du raccourci au centre de l’écran'} section="demo" compact />
          <span className="dm-lab-sep" />
          <span className="dm-lab-label" aria-hidden="true">Démo entière</span>
          <Vote id="demo.whole" label="La démo animée dans son ensemble" section="demo" />
        </div>
      )}
    </div>
  );
}

// Rectangles to ring for an explainer item.
function ringFor(target, geo) {
  if (!geo) return null;
  const { ilot } = geo;
  switch (target) {
    case 'hud': return geo.hud ? [{ ...geo.hud, r: 24 }] : null;
    case 'grid': return [{ x: ilot.x, y: ilot.y, w: GRID.w, h: GRID.h, r: 16 }];
    case 'work': case 'server': return [{ x: ilot.x, y: ilot.y, w: 44, h: 28, r: 14 }];
    case 'result': return [{ x: ilot.x, y: ilot.y, w: geo.rw, h: 28, r: 14 }];
    case 'text': return [{ ...geo.textRect, r: 8 }];
    case 'diff': return geo.diff.map(d => ({ x: d.x - 1, y: d.y, w: d.w + 2, h: d.h, r: 6 }));
    default: return null;
  }
}

function IntroWindow({ s }) {
  return (
    <div className="ft-window dm-intro" data-material="frost" style={{ opacity: s.o, transform: `translateY(${s.y}px) scale(${s.scale})` }}>
      <div className="dm-intro-body">
        <div className="ft-heartbeat"><AppMark size={56} /></div>
        <h2>Tout est prêt</h2>
        <p>Regardez comment ça marche : quinze secondes, sans rien toucher.</p>
      </div>
    </div>
  );
}

// A plain « random » app: a mail draft (not our app: neutral ink, no accent).
function MailWindow({ s, para, oldRefs, newRefs }) {
  return (
    <div className="dm-mail" style={{ left: WIN.x, top: WIN.y, width: WIN.w, height: WIN.h, opacity: s.win.o, transform: `translateY(${s.win.y}px) scale(${s.win.scale})` }}>
      <div className="dm-mail-bar">
        <span className="dm-mail-app"><Mail size={14} strokeWidth={1.5} />Courrier</span>
        <span className="dm-mail-title">Nouveau message</span>
        <span className="dm-mail-caps"><span><Minus size={16} strokeWidth={1} /></span><span><Square size={12} strokeWidth={1.25} /></span><span><X size={16} strokeWidth={1} /></span></span>
      </div>
      <div className="dm-mail-tools">
        <span className="dm-mail-send"><Send size={14} strokeWidth={1.5} />Envoyer</span>
        <span className="dm-mail-tool"><Paperclip size={15} strokeWidth={1.5} /></span>
        <span className="dm-mail-divider" />
        <span className="dm-mail-tool"><Bold size={15} strokeWidth={1.75} /></span>
        <span className="dm-mail-tool"><Italic size={15} strokeWidth={1.5} /></span>
        <span className="dm-mail-tool"><Underline size={15} strokeWidth={1.5} /></span>
        <span className="dm-mail-tool"><List size={15} strokeWidth={1.5} /></span>
      </div>
      <div className="dm-mail-field"><span>À</span><span className="dm-chip">Claire Martin</span></div>
      <div className="dm-mail-field"><span>Objet</span><strong>Compte rendu de mardi</strong></div>
      <div className="dm-mail-body">
        <p>Bonjour Claire,</p>
        <div className="dm-para" ref={para}>
          {/* Selection: one rect per word, behind the text, growing from the left. */}
          <div className="dm-sel-layer">
            {OLD_W.map((w, i) => {
              const sel = s.sel[i];
              return <span key={i} className="dm-sel" data-i={i} style={{ opacity: sel?.o ?? 0, transform: `scaleX(${sel?.k ?? 0})` }} />;
            })}
          </div>
          <p className="dm-text dm-old" style={{ opacity: s.oldText }}>
            {OLD_W.map((w, i) => (
              <span key={i} ref={el => { oldRefs.current[i] = el; }} className="dm-w">{w.core}{w.punct}{i < OLD_W.length - 1 ? ' ' : ''}</span>
            ))}
          </p>
          <p className="dm-text dm-new" style={{ opacity: s.newText }}>
            {NEW_W.map((w, i) => {
              const d = CHANGED.indexOf(i);
              return (
                <span key={i} className="dm-w">
                  {d >= 0 ? (
                    <span className="dm-changed" ref={el => { newRefs.current[i] = el; }}>
                      <span className="dm-diff" style={{ opacity: s.diff[d]?.o ?? 0, transform: `scale(${s.diff[d]?.k ?? 0.6})` }} />
                      <span className="dm-changed-text">{w.core}</span>
                    </span>
                  ) : w.core}
                  {w.punct}{i < NEW_W.length - 1 ? ' ' : ''}
                </span>
              );
            })}
          </p>
        </div>
        <p>N’hésitez pas si vous avez des questions.</p>
        <p>Bonne journée,<br />Camille</p>
      </div>
      <SelectionRects s={s} oldRefs={oldRefs} />
    </div>
  );
}

// Positions the per-word selection rects on their words (layout coordinates inside the para).
function SelectionRects({ oldRefs }) {
  useLayoutEffect(() => {
    const place = () => {
      const words = oldRefs.current;
      const para = words[0]?.closest('.dm-para');
      if (!para) return;
      para.querySelectorAll('.dm-sel').forEach(el => {
        const w = words[+el.dataset.i]; if (!w) return;
        el.style.left = `${w.offsetLeft}px`; el.style.top = `${w.offsetTop}px`;
        el.style.width = `${w.offsetWidth + 1}px`; el.style.height = `${w.offsetHeight}px`;
      });
    };
    place();
    document.fonts?.ready?.then(place);
    const ro = new ResizeObserver(place);
    const para = oldRefs.current[0]?.closest('.dm-para'); if (para) ro.observe(para);
    return () => ro.disconnect();
  }, [oldRefs]);
  return null;
}

function ShortcutHud({ s, place, hudRef, keys }) {
  const style = place === 'centre'
    ? { left: WIN.x + WIN.w / 2, top: WIN.y + WIN.h / 2 - 20 }
    : { left: WIN.x + WIN.w / 2, top: WIN.y + WIN.h + 26 };
  return (
    <div ref={hudRef} className="dm-hud" data-place={place}
      style={{ ...style, opacity: s.hud.o, transform: `translate(-50%, ${place === 'centre' ? '-50%' : '0'}) translateY(${s.hud.y}px) scale(${s.hud.scale})` }}>
      {keys.slice(0, 3).map((k, i) => (
        <span key={k} className="dm-hud-item">
          {i > 0 && <span className="dm-plus" style={{ opacity: 0.35 + 0.65 * s.keys[i - 1].lit }}>+</span>}
          <BigKey label={k} k={s.keys[i]} wide={k.length > 4} />
        </span>
      ))}
    </div>
  );
}
function BigKey({ label, k, wide }) {
  return (
    <span className="dm-key" data-wide={wide ? '' : undefined} style={{ transform: `translateY(${3 * k.d}px) scale(${1 - 0.04 * k.d})` }}>
      <span className="dm-key-face">{label}</span>
      <span className="dm-key-lit" style={{ opacity: k.lit }}>{label}</span>
      <span className="dm-key-flash" style={{ opacity: k.flash * 0.7, transform: `scale(${1 + 0.35 * (1 - k.flash)})` }} />
    </span>
  );
}

// The big cursor: a bluish halo with the black system pointer centred in it. The container sits on
// the halo's centre; timeline.js places it TIP away from the click point while it is an arrow.
function BigCursor({ c, variant }) {
  const halo = 1 - 0.14 * c.down;
  return (
    <div className="dm-cursor" data-variant={variant} style={{ opacity: c.o, transform: `translate(${c.x}px, ${c.y}px)` }}>
      <span className="dm-halo" style={{ transform: `translate(-50%, -50%) scale(${halo})` }} />
      <svg className="dm-arrow" style={{ opacity: 1 - (c.tk ?? (c.text ? 1 : 0)) }} width="26" height="34" viewBox="0 0 13 17" aria-hidden="true">
        <path d="M1 1 L1 13.6 L4.2 10.7 L6.3 15.6 L8.4 14.7 L6.4 9.9 L10.8 9.9 Z" fill="#111" stroke="#fff" strokeWidth="1" strokeLinejoin="round" />
      </svg>
      <svg className="dm-ibeam" style={{ opacity: c.tk ?? (c.text ? 1 : 0) }} width="14" height="30" viewBox="0 0 7 15" aria-hidden="true">
        <path d="M1 1 H6 M3.5 1 V14 M1 14 H6" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M1 1 H6 M3.5 1 V14 M1 14 H6" fill="none" stroke="#111" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

// Undo countdown ring (r 5 in a 14 box, starts at the top), as in the app's result pill.
function Countdown({ p }) {
  const len = 2 * Math.PI * 5;
  return (
    <svg className="dm-countdown" width="12" height="12" viewBox="0 0 14 14" aria-hidden="true">
      <circle className="track" cx="7" cy="7" r="5" />
      <circle cx="7" cy="7" r="5" strokeDasharray={len} strokeDashoffset={len * p} />
    </svg>
  );
}

function Caption({ chapter, ended }) {
  const tx = useTx();
  const text = ended ? null : chapter?.text; // at the end, the end card speaks
  return (
    <div className="dm-caption-wrap" aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        {text && (
          <motion.div key={ended ? 'end' : chapter.n} className="dm-caption"
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={tx('smooth')}>
            {!ended && <span className="dm-caption-n">{chapter.n}</span>}
            <span>{text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// The right rail: collapsed to its icons; hover, focus or tap unfolds it. Hovering an item shows
// its moment in the animation (paused there) and rings the element it talks about.
function ExplainRail({ preview, setPreview, onTouch }) {
  const [open, setOpen] = useState(false);
  const panel = useRef(null);
  const tx = useTx();
  const close = () => { setOpen(false); setPreview(null); };
  return (
    <div className="dm-rail-clip" style={{ left: RAIL.right - RAIL.w, top: RAIL.y, width: RAIL.w, height: RAIL.h }}>
      <motion.aside ref={panel} className="dm-rail" data-open={open ? '' : undefined}
        aria-label="Ce que vous pouvez changer"
        initial={false} animate={{ x: open ? 0 : RAIL.w - RAIL.rail }} transition={tx('smooth')}
        onPointerEnter={e => { if (e.pointerType === 'mouse') setOpen(true); }}
        onPointerLeave={e => { if (e.pointerType === 'mouse') close(); }}
        onFocus={() => setOpen(true)}
        onBlur={e => { if (!panel.current?.contains(e.relatedTarget)) close(); }}
        onKeyDown={e => { if (e.key === 'Escape') { close(); e.currentTarget.querySelector('.dm-rail-head')?.focus(); } }}>
        <button type="button" className="dm-rail-head" aria-expanded={open} onClick={() => { onTouch(); setOpen(o => !o); if (open) setPreview(null); }}>
          <span className="dm-rail-icon"><SlidersHorizontal size={16} strokeWidth={1.5} /></span>
          <span className="dm-rail-head-text"><strong>Ce que vous pouvez changer</strong><small>Survolez un point pour le voir</small></span>
        </button>
        <ul className="dm-rail-list">
          {EXPLAIN.map(item => {
            const Icon = item.icon;
            const active = preview?.id === item.id;
            return (
              <li key={item.id}>
                <button type="button" className="dm-rail-item" data-active={active ? '' : undefined} aria-pressed={active}
                  onPointerEnter={() => { if (open) { onTouch(); setPreview(item); } }}
                  onFocus={() => { onTouch(); setPreview(item); }}
                  onClick={() => { onTouch(); setOpen(true); setPreview(active ? null : item); }}>
                  <span className="dm-rail-icon" data-tile={item.tile}><Icon size={16} strokeWidth={1.5} /></span>
                  <span className="dm-rail-text">
                    <strong>{item.title}</strong>
                    <span>{item.text}</span>
                    <small>Réglages › {item.where}</small>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </motion.aside>
    </div>
  );
}

function Controls({ t, start, playing, onToggle, onSeek, onReplay, onSkip, reduced }) {
  const was = useRef(false);
  const span = T.END - start;
  const pct = v => `${((v - start) / span) * 100}%`;
  return (
    <div className="dm-controls" role="group" aria-label="Lecture de la démo">
      <button type="button" className="dm-ctl" onClick={onToggle} aria-label={playing ? 'Pause' : (t >= T.END ? 'Revoir' : 'Lecture')} title={playing ? 'Pause' : 'Lecture'}>
        {playing ? <Pause size={16} strokeWidth={1.75} /> : <Play size={16} strokeWidth={1.75} />}
      </button>
      <div className="dm-scrub">
        <span className="dm-scrub-fill" style={{ transform: `scaleX(${(t - start) / span})` }} />
        {CHAPTERS.map(c => c.at > start && <span key={c.n} className="dm-tick" style={{ left: pct(c.at) }} />)}
        <input type="range" className="dm-range" min={start} max={T.END} step={50} value={Math.round(t)}
          aria-label="Position dans la démo" aria-valuetext={`${fmt(t - start)} sur ${fmt(span)}`}
          onPointerDown={() => { was.current = playing; if (playing) onToggle(); }}
          onPointerUp={() => { if (was.current) onToggle(); was.current = false; }}
          onChange={e => onSeek(+e.target.value)} />
      </div>
      <span className="dm-time">{fmt(t - start)}</span>
      <button type="button" className="dm-ctl" onClick={onReplay} aria-label="Recommencer la démo" title="Recommencer"><RotateCcw size={15} strokeWidth={1.75} /></button>
      {onSkip && <button type="button" className="dm-ctl dm-skip" onClick={onSkip}><span>Passer</span><SkipForward size={14} strokeWidth={1.75} /></button>}
      {reduced && <span className="dm-reduced-note">Mouvement réduit : diaporama</span>}
    </div>
  );
}
