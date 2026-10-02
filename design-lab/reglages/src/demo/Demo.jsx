// DÉMO — how the app works, played with the APP's own behaviour (Lucas, 30/09: « si le comportement
// n'est pas exactement le même que dans l'appli, ça va pas du tout »). The viewer does nothing: the
// setup window closes, a mail draft opens, a big cursor selects a sentence word by word (1.8 s), the
// shortcut lights up key by key under the window, the Îlot opens under the end of the selection
// exactly where and how the app opens it, the pointer rests on ✦ and the grid unfolds, « Corriger »
// is clicked, the surface turns into the working pill while the halo works over the text, Rust's
// paste replaces the text (wave of light, changed words marked), the pill glides under the new text
// with its check and Undo, a click in the text withdraws Undo and takes the marks away.
//
// What comes from the app (./app.js, build.mjs `app-modules`): the Îlot's DOM and CSS (ilot.css),
// the result pill's (result.css), the Perle (loaders.css), the halo (halo.css + geometry.ts), the
// springs and curves (motion/tokens.ts, spring.ts), the metrics, the placement rules (layout.ts,
// placement.rs), the word diff that decides the marks (result/highlight.ts). ./timeline.js turns
// them into a pure function of time: the same frames as the app, but scrubbable.
//
// Fixed export: default Demo({ standalone, onDone, autoPlay = true, intro = standalone, shortcut })
//   Renders INSIDE a <Stage> (desktop pixels). onDone(): end of the demo (auto, 3 s after the end
//   card unless the viewer took the controls) or « Continuer » / « Passer ».
// Everything moves by transform / opacity (the Îlot's box: width / height / radius, as the app's
// MorphSurface). Speed: t advances at 1 / lab speed. Mouvement réduit: a calm slideshow of the real
// states, each drawn with the app's reduced rules (fades only, shapes at once, halo still).
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Play, Pause, RotateCcw, SkipForward, Keyboard, LayoutGrid, Replace, Undo2, Highlighter, Sparkles, Server,
  SlidersHorizontal, Languages, BriefcaseBusiness, FoldVertical, Mail, WandSparkles, SpellCheck, Paperclip, Send,
  Bold, Italic, Underline, List, ArrowRight, Minus, Square, X,
} from 'lucide-react';
import { Button, Segmented, ICON } from '../ui/index.jsx';
import { Vote } from '../lab/Vote.jsx';
import { useLab } from '../lab/store.jsx';
import { useScope } from '../lab/Scope.jsx';
import { useClock, useTx } from '../lib/motion.js';
import { AppMark, useDesktop } from '../stage/Desktop.jsx';
import { createPortal } from 'react-dom';
import { appName, defaultShortcut } from '../brand.js';
import { T, START_NO_INTRO, CHAPTERS, SLIDES, HOLD, scene } from './timeline.js';
import { changedRanges, sweepStrip, sweepPositions, pad, inset, ilotMetrics, ilotMenuShift, workingPillShape, indicatorBox } from './app.js';
import './app-theme.css';
import './demo.css';

// ——— The text (the word diff of src/result/highlight.ts marks convenu, chiffres, clairs) ———
const OLD = 'Je vous envoie le compte rendu de la réunion de mardi, comme convenue. J’espère qu’il vous sera utile et que les chiffre sont clair.';
const NEW = 'Je vous envoie le compte rendu de la réunion de mardi, comme convenu. J’espère qu’il vous sera utile et que les chiffres sont clairs.';
const CHANGED = changedRanges(OLD, NEW, { actionId: 'correct' }).ranges;
// Word ends in OLD, for the drag (the selection grows to the end of each word).
const WORD_ENDS = [...OLD.matchAll(/\S+/g)].map(m => m.index + m[0].length);

// The Îlot's actions as the app's own lab names them in French (src/lab/ilot.tsx:26-32), icons of
// src/actionDefaults.ts; the sixth tile is « Consigne » (Ilot.tsx:222).
const TILES = [
  { id: 'fix', label: 'Corriger', Icon: SpellCheck },
  { id: 'translate', label: 'Traduire', Icon: Languages },
  { id: 'pro', label: 'Pro', Icon: BriefcaseBusiness },
  { id: 'shorten', label: 'Raccourcir', Icon: FoldVertical },
  { id: 'email', label: 'Mail', Icon: Mail },
  { id: 'ask', label: 'Consigne', Icon: WandSparkles },
];

// ——— Layout (desktop px, inside the 900 × 740 focus the section asks for) ———
const DESK_W = 1280;
const WIN = { x: 214, y: 104, w: 660, h: 408 };
const RAIL = { right: 1076, y: 96, w: 316, h: 548, rail: 56 };

// The changed words: today's marks, and three ways to make the text itself luminous (Lucas, 30/09).
export const MARK_STYLES = [
  { value: 'actuel', label: 'Actuel', vote: 'Mots changés : les marques actuelles de l’app (reflet irisé par-dessus le mot)' },
  { value: 'encre', label: 'Encre irisée', vote: 'Mots changés : le texte lui-même en encre irisée douce, léger halo, sans cadre' },
  { value: 'eclat', label: 'Éclat', vote: 'Mots changés : le texte s’éclaire (encre plus profonde ou blanc lumineux) + trait fin qui s’estompe' },
  { value: 'reflet', label: 'Reflet', vote: 'Mots changés : un reflet irisé traverse les lettres une fois, puis une teinte calme' },
];
const DEFAULT_MARKS = 'encre';

// What the rail explains, the moment it shows, the element it rings, the Settings page (its colour).
const EXPLAIN = [
  { id: 'raccourci', icon: Keyboard, page: 'raccourcis', title: 'Raccourci', text: `${defaultShortcut.join(' + ')} par défaut. Prenez-en un autre s’il est déjà pris.`, where: 'Raccourcis', at: 6250, target: 'hud' },
  { id: 'actions', icon: LayoutGrid, page: 'actions', title: 'Actions et lettres', text: 'Ajoutez, renommez, réordonnez. Chaque lettre lance son action sans clic.', where: 'Actions', at: 8200, target: 'ilot' },
  { id: 'indicateur', icon: Sparkles, page: 'apparence', title: 'Indicateur', text: 'Perle, Nébuleuse ou Ruban, pendant que le modèle travaille.', where: 'Apparence', at: 9900, target: 'ilot' },
  { id: 'serveur', icon: Server, page: 'serveur', title: 'Serveur', text: 'L’adresse et la clé données au premier lancement. Un second serveur peut prendre le relais.', where: 'Serveur', at: 9900, target: 'server' },
  { id: 'remplacer', icon: Replace, page: 'apres', title: 'Remplacer ou afficher', text: 'Le résultat remplace la sélection, ou s’affiche à côté pour le copier vous-même.', where: 'Après remplacement', at: 11900, target: 'text' },
  { id: 'annuler', icon: Undo2, page: 'apres', title: 'Annuler', text: 'Le bouton reste 8 secondes, arrêté sous la souris. Ctrl + Z marche aussi.', where: 'Après remplacement', at: 12700, target: 'ilot' },
  { id: 'mots', icon: Highlighter, page: 'apres', title: 'Mots changés', text: 'Marqués jusqu’à votre prochaine action dans le texte, ou pas du tout.', where: 'Après remplacement', at: 11900, target: 'diff' },
];

const fmt = ms => { const s = Math.max(0, Math.round(ms / 1000)); return `0:${String(s).padStart(2, '0')}`; };
const readPref = () => { try { return JSON.parse(localStorage.getItem('ft-labo-demo') || '{}'); } catch { return {}; } };
const writePref = v => { try { localStorage.setItem('ft-labo-demo', JSON.stringify(v)); } catch { /* private window */ } };
function offsetIn(el, root) {
  let x = 0, y = 0, node = el;
  while (node && node !== root) { x += node.offsetLeft; y += node.offsetTop; node = node.offsetParent; }
  return { x, y };
}
// Client rects of a text range, in desktop px (immune to the stage's scale and the windows' transforms).
function rangeRects(textNode, start, end, host, origin) {
  if (!textNode) return [];
  const range = document.createRange();
  range.setStart(textNode, Math.max(0, Math.min(start, textNode.length)));
  range.setEnd(textNode, Math.max(0, Math.min(end, textNode.length)));
  const hr = host.getBoundingClientRect();
  const k = hr.width / (host.offsetWidth || 1) || 1;
  const lines = [];
  for (const r of range.getClientRects()) {
    if (r.width < 0.5) continue;
    const x = origin.x + (r.left - hr.left) / k, y = origin.y + (r.top - hr.top) / k, w = r.width / k, h = r.height / k;
    const same = lines.find(l => Math.abs(l.y - y) < h / 2);
    if (same) { const right = Math.max(same.x + same.width, x + w); same.x = Math.min(same.x, x); same.width = right - same.x; }
    else lines.push({ x, y, width: w, height: h });
  }
  return lines;
}

export default function Demo({ standalone, onDone, autoPlay = true, intro = !!standalone, shortcut }) {
  const keys = Array.isArray(shortcut) && shortcut.length ? shortcut : defaultShortcut;
  const lab = useLab();
  const clock = useClock();
  const scope = useScope();
  const { asideEl } = useDesktop();
  const reduced = clock.reduced || lab.reduced;
  const start = intro ? 0 : START_NO_INTRO;

  // ——— Lab variants (standalone only; the Parcours plays the defaults) ———
  const [pref, setPref] = useState(() => ({ marks: DEFAULT_MARKS, preset: 'smooth', ...readPref() }));
  const setP = patch => setPref(p => { const next = { ...p, ...patch }; writePref(next); return next; });
  const marks = standalone && MARK_STYLES.some(m => m.value === pref.marks) ? pref.marks : DEFAULT_MARKS;
  const preset = standalone && pref.preset === 'bouncy' ? 'bouncy' : 'smooth';

  // ——— Time ———
  const [t, setT] = useState(start);
  const [playing, setPlaying] = useState(autoPlay);
  const [preview, setPreview] = useState(null);     // { id, at } while an explainer item is hovered
  const [touched, setTouched] = useState(false);    // the viewer took the controls: no auto onDone
  const tRef = useRef(t); tRef.current = t;

  useEffect(() => {
    if (!playing || preview) return undefined;
    if (reduced) {
      const next = SLIDES.find(s => s > tRef.current + 1);
      const id = setTimeout(() => {
        if (next == null) { setT(T.END); setPlaying(false); } else setT(next);
      }, (tRef.current < SLIDES[0] - 600 ? 400 : HOLD) * clock.t);
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

  // End: hand over (3 s after the end card), unless the viewer is driving.
  useEffect(() => {
    if (t < T.END || !onDone || !autoPlay || touched || preview) return undefined;
    const id = setTimeout(onDone, 3000 * clock.t);
    return () => clearTimeout(id);
  }, [t, onDone, autoPlay, touched, preview, clock.t]);

  const replay = () => { setT(start); setPlaying(true); setPreview(null); };
  const toggle = () => { setTouched(true); if (t >= T.END) replay(); else setPlaying(p => !p); };

  // Lab hook for the screenshots (scripts/demo-shots.mjs): seek to an exact frame.
  useEffect(() => {
    if (!standalone) return undefined;
    window.__demo = { seek: v => { setPlaying(false); setPreview(null); setT(v); }, play: () => setPlaying(true), pause: () => setPlaying(false), get t() { return tRef.current; }, T, SLIDES };
    return () => { delete window.__demo; };
  }, [standalone]);

  // ——— Geometry (measured once laid out, and again when fonts or sizes change) ———
  const root = useRef(null);
  const oldP = useRef(null);
  const newP = useRef(null);
  const closeP = useRef(null);
  const bodyRef = useRef(null);
  const mailRef = useRef(null);
  const measureRef = useRef(null);
  const [geo, setGeo] = useState(null);
  const measure = useCallback(() => {
    const r = root.current, op = oldP.current, np = newP.current, mail = mailRef.current;
    if (!r || !op || !np || !mail || !op.firstChild || !np.firstChild) return;
    const originOf = el => { const o = offsetIn(el, r); return o; };
    const oo = originOf(op), no = originOf(np);
    // Selection after k words (Windows paints one band per line, contiguous).
    const sel = [[]];
    for (let k = 1; k <= WORD_ENDS.length; k++) sel.push(rangeRects(op.firstChild, 0, WORD_ENDS[k - 1], op, oo));
    const selLines = sel[sel.length - 1];
    const anchor = selLines[selLines.length - 1];
    if (!anchor) return;
    const wholeNew = rangeRects(np.firstChild, 0, NEW.length, np, no);
    const changed = CHANGED.flatMap(c => rangeRects(np.firstChild, c.start, c.end, np, no));
    const endNew = wholeNew[wholeNew.length - 1];
    const body = offsetIn(bodyRef.current, r);
    const textBox = { x: body.x, y: body.y, width: bodyRef.current.offsetWidth, height: bodyRef.current.offsetHeight };
    // Natural sizes of the contents (MorphSurface measures its layer: Math.ceil(offsetWidth)).
    const m = measureRef.current;
    const compactW = Math.ceil(m?.querySelector('[data-measure="compact"]')?.offsetWidth || 136);
    const doneEl = m?.querySelector('[data-measure="done"]');
    const doneW = Math.ceil(doneEl?.offsetWidth || 132);
    const undoEl = doneEl?.querySelector('.result-undo');
    const undo = undoEl ? { x: undoEl.offsetLeft, w: undoEl.offsetWidth } : { x: doneW - 90, w: 86 };
    // The strip: 8 px under the selection's last line, its right edge on that line's end.
    const strip = { right: anchor.x + anchor.width, top: anchor.y + anchor.height + 8 };
    const room = { left: strip.right, right: DESK_W - strip.right };
    const shift = ilotMenuShift(ilotMetrics.grid.width, compactW, room) ?? 0;
    const gridLeft = strip.right + shift - ilotMetrics.grid.width;
    const tiles = TILES.map((_, i) => ({ x: gridLeft + 6 + (i % 3) * 70, y: strip.top + 6 + Math.floor(i / 3) * 54, w: 66, h: 50 }));
    // After the paste: under the new text's last line, right edge on its end (placement.rs:78-99).
    const place = { dx: Math.round(endNew.x + endNew.width - strip.right), dy: Math.round(endNew.y + endNew.height - (anchor.y + anchor.height)) };
    const pill = { right: strip.right + place.dx, top: strip.top + place.dy };
    // The click in the text: the end of « N'hésitez pas… ».
    const cp = closeP.current;
    const cr = cp?.firstChild ? rangeRects(cp.firstChild, 0, cp.firstChild.length, cp, originOf(cp)) : [];
    const closeEnd = cr[cr.length - 1] || { x: anchor.x, y: anchor.y + 60, width: 0, height: 24 };
    const first = sel[1][0] || selLines[0];
    const dragPath = [{ x: first.x + 1, y: first.y + first.height / 2 }, ...sel.slice(1).map(ls => { const l = ls[ls.length - 1]; return { x: l.x + l.width, y: l.y + l.height / 2 }; })];
    setGeo({
      W: DESK_W, sel, selLines, anchor, wholeNew, changed, textBox, compactW, doneW, undo, tiles, place, shift,
      caretEnd: { x: endNew.x + endNew.width, y: endNew.y, h: endNew.height },
      caretClick: { x: closeEnd.x + closeEnd.width, y: closeEnd.y, h: closeEnd.height },
      mail: offsetIn(mail, r),
      points: {
        home: { x: WIN.x + WIN.w + 90, y: WIN.y + WIN.h + 120 },
        selStart: dragPath[0],
        dragPath,
        rest: { x: strip.right + 96, y: strip.top + 58 },
        ask: { x: strip.right - 10, y: strip.top + 24 },
        tile: { x: tiles[0].x + 52, y: tiles[0].y + 40 },
        aside: { x: strip.right + 70, y: strip.top + 96 },
        undo: { x: pill.right - doneW + undo.x + Math.round(undo.w * 0.42), y: pill.top + 22 },
        caret: { x: closeEnd.x + closeEnd.width + 2, y: closeEnd.y + closeEnd.height / 2 },
        out: { x: WIN.x + WIN.w + 70, y: WIN.y + WIN.h + 110 },
      },
    });
  }, []);
  useLayoutEffect(() => {
    measure();
    let alive = true;
    document.fonts?.ready?.then(() => { if (alive) measure(); });
    const ro = new ResizeObserver(() => measure());
    if (oldP.current) ro.observe(oldP.current);
    if (measureRef.current) ro.observe(measureRef.current);
    return () => { alive = false; ro.disconnect(); };
  }, [measure]);

  const shown = preview ? preview.at : t;
  const s = useMemo(() => scene(shown, geo, { preset, reduced, marks }), [shown, geo, preset, reduced, marks]);
  const ring = preview ? ringFor(preview.target, geo, s) : null;
  const serverTag = preview?.target === 'server';
  const theme = scope.theme === 'dark' ? 'dark' : 'light';

  return (
    <div ref={root} className="dm-root" data-paused={!playing || preview ? '' : undefined} data-reduced={reduced ? '' : undefined}
      role="region" aria-label={`Démo : comment utiliser ${appName}`}>
      {/* The animation itself: decorative, its caption is the accessible story. */}
      <div className="dm-scene" aria-hidden="true" key={reduced ? `slide-${shown}` : 'live'}>
        {intro && s.intro.on && <IntroWindow s={s.intro} />}

        <MailWindow s={s} geo={geo} marks={marks} theme={theme} refs={{ oldP, newP, closeP, bodyRef, mailRef }} />

        <ShortcutHud s={s} keys={keys} />

        {/* The app's own objects: the halo window and the Îlot's window (same CSS, same DOM). */}
        <div className="dm-app" data-theme={theme} data-motion={reduced ? 'reduced' : 'full'} data-seek="">
          {s.halo?.on && geo && <HaloLayer halo={s.halo} geo={geo} marks={marks} theme={theme} />}
          <div className="dm-server-tag" style={{ opacity: serverTag ? 1 : 0, left: s.strip.right + 10, top: s.strip.top + 4 }}>
            <Server size={12} strokeWidth={1.5} /> llm.exemple.com · qwen3-14b
          </div>
          {/* Natural sizes of the contents, measured like MorphSurface measures its layer. */}
          <div ref={measureRef} className="dm-measure">
            <div className="ilot"><div data-measure="compact" style={{ display: 'inline-block' }}><CompactContent /></div></div>
            <div className="ilot"><div data-measure="done" style={{ display: 'inline-block' }}><DoneContent p={1} /></div></div>
          </div>
        </div>

        {/* The Îlot's window, a second app layer above the halo's: inside the halo's layer, Chrome
            treats that layer as the backdrop root and the Îlot's real-glass blur would not see the
            mail behind it (measured: crisp text through the pill). */}
        <div className="dm-app dm-app-ilot" data-theme={theme} data-motion={reduced ? 'reduced' : 'full'} data-seek="">
          {s.ilotOn && <IlotLayer s={s} />}
        </div>

        <BigCursor c={s.cursor} />

        {/* The explainer's ring around the element it talks about. */}
        <div className="dm-ring-layer">
          {ring && ring.map((r, i) => (
            <motion.span key={`${preview.id}-${i}`} className="dm-ring"
              initial={{ opacity: 0, scale: 1.08 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', duration: 0.35 * clock.t, bounce: 0.2 }}
              style={{ left: r.x - 6, top: r.y - 6, width: r.w + 12, height: r.h + 12, borderRadius: r.r ?? 14 }} />
          ))}
        </div>

        {s.end.on && (
          <div className="dm-end ft-glass" style={{ opacity: s.end.o, transform: `translate(-50%, ${s.end.y}px) scale(${s.end.scale})` }} aria-hidden="false">
            <AppMark size={36} />
            <h2>C’est tout.</h2>
            <p>Raccourci, actions, serveur : tout se règle dans les Réglages. Survolez le bandeau de droite pour voir où.</p>
            <div className="dm-end-actions">
              <Button variant="secondary" size="md" icon={<RotateCcw {...ICON} />} onClick={replay}>Revoir</Button>
              {onDone && <Button variant="primary" size="md" iconEnd={<ArrowRight {...ICON} />} onClick={onDone}>Continuer</Button>}
            </div>
          </div>
        )}
      </div>

      <Caption chapter={s.chapter} ended={t >= T.END} />
      <ExplainRail preview={preview} setPreview={setPreview} onTouch={() => setTouched(true)} />
      {/* On a phone the controls and the lab bar leave the panned desktop for the panel under it
          (useDesktop().asideEl): always on screen, never cut at the right edge. */}
      <Below el={asideEl}>
      <Controls t={t} start={start} playing={playing && !preview} onToggle={toggle}
        onSeek={v => { setTouched(true); setT(v); }} onReplay={() => { setTouched(true); replay(); }} onSkip={onDone} reduced={reduced} />

      {standalone && (
        <div className="dm-lab">
          <span className="dm-lab-label" aria-hidden="true">Mots changés</span>
          <Segmented label="Mots changés" size="sm" value={marks} onChange={v => { setP({ marks: v }); if (!playing && t < T.paste) setT(12000); }}
            options={MARK_STYLES.map(m => ({ value: m.value, label: m.label }))} />
          <Vote id={`demo.mots.${marks}`} label={MARK_STYLES.find(m => m.value === marks).vote} section="demo" compact />
          <span className="dm-lab-sep" />
          <span className="dm-lab-label" aria-hidden="true">Ressort</span>
          <Segmented label="Ressort de l’Îlot" size="sm" value={preset} onChange={v => setP({ preset: v })}
            options={[{ value: 'smooth', label: 'Fluide' }, { value: 'bouncy', label: 'Rebondi' }]} />
          <span className="dm-lab-sep" />
          <span className="dm-lab-label" aria-hidden="true">Démo entière</span>
          <Vote id="demo.whole" label="La démo animée dans son ensemble (comportement de l’app)" section="demo" />
        </div>
      )}
      </Below>
    </div>
  );
}
function Below({ el, children }) {
  return el ? createPortal(<div className="dm-below">{children}</div>, el) : children;
}

// Rectangles to ring for an explainer item (desktop px).
function ringFor(target, geo, s) {
  if (!geo) return null;
  const box = () => {
    const sh = s.shape || { w: 44, h: 28, r: 14 };
    const right = s.strip.right + (s.corner?.x || 0), top = s.strip.top + (s.corner?.y || 0);
    return [{ x: right - sh.w, y: top, w: sh.w, h: sh.h, r: sh.r + 4 }];
  };
  switch (target) {
    case 'hud': { const el = document.querySelector('.dm-hud'); if (!el) return null; return [{ x: el.offsetLeft - el.offsetWidth / 2, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight, r: 30 }]; }
    case 'ilot': case 'server': return box();
    case 'text': { const w = geo.wholeNew; const x = Math.min(...w.map(l => l.x)), y = w[0].y, r = Math.max(...w.map(l => l.x + l.width)), b = w[w.length - 1].y + w[w.length - 1].height; return [{ x: x - 2, y: y - 2, w: r - x + 4, h: b - y + 4, r: 8 }]; }
    case 'diff': return geo.changed.map(d => ({ x: d.x - 2, y: d.y, w: d.width + 4, h: d.height, r: 6 }));
    default: return null;
  }
}

function IntroWindow({ s }) {
  return (
    <div className="ft-window dm-intro" data-material="floating" style={{ opacity: s.o, transform: `translateY(${s.y}px) scale(${s.scale})` }}>
      <div className="dm-intro-body">
        <div className="ft-heartbeat"><AppMark size={56} /></div>
        <h2>Tout est prêt</h2>
        <p>Regardez comment ça marche : quinze secondes, sans rien toucher.</p>
      </div>
    </div>
  );
}

// A plain « random » app: a mail draft (not our app: neutral ink, no accent). The text is ONE text
// node per paragraph so a range gives one rectangle per line, as UI Automation does.
function MailWindow({ s, geo, marks, theme, refs }) {
  const { oldP, newP, closeP, bodyRef, mailRef } = refs;
  const origin = geo?.mail || { x: WIN.x, y: WIN.y };
  const sel = geo?.sel?.[s.selWords] || [];
  const caret = s.caret && geo ? (s.caret.at === 'click' ? geo.caretClick : geo.caretEnd) : null;
  return (
    <div ref={mailRef} className="dm-mail" style={{ left: WIN.x, top: WIN.y, width: WIN.w, height: WIN.h, opacity: s.win.o, transform: `translateY(${s.win.y}px) scale(${s.win.scale})` }}>
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
      {/* Windows' selection (one band per line) behind the text; the caret above it. */}
      <div className="dm-mail-under">
        {!s.pasted && sel.map((l, i) => (
          <span key={i} className="dm-sel" style={{ left: l.x - origin.x, top: l.y - origin.y, width: l.width, height: l.height }} />
        ))}
      </div>
      <div ref={bodyRef} className="dm-mail-body">
        <p>Bonjour Claire,</p>
        <div className="dm-para">
          <p ref={oldP} className="dm-text" style={{ visibility: s.pasted ? 'hidden' : 'visible' }}>{OLD}</p>
          <p ref={newP} className="dm-text dm-new" style={{ visibility: s.pasted ? 'visible' : 'hidden' }}>{NEW}</p>
          {marks !== 'actuel' && s.glow.o > 0.001 && <GlowText marks={marks} o={s.glow.o} el={s.glow.el} geo={geo} theme={theme} />}
        </div>
        <p ref={closeP}>N’hésitez pas si vous avez des questions.</p>
        <p>Bonne journée,<br />Camille</p>
      </div>
      <div className="dm-mail-over">
        {caret && <span className="dm-caret" style={{ left: caret.x - origin.x, top: caret.y - origin.y, height: caret.h, opacity: s.caret.on ? 1 : 0 }} />}
      </div>
    </div>
  );
}

// The text-glow proposals: the new text drawn again exactly over itself, only the changed words
// visible, styled (the app would paint this in its halo window over the same rectangles).
function GlowText({ marks, o, el, geo, theme }) {
  const strip = useMemo(() => (geo ? sweepStrip(geo.changed) : null), [geo]);
  const parts = [];
  let at = 0;
  CHANGED.forEach((c, i) => {
    if (c.start > at) parts.push(<span key={`p${i}`} className="dm-glow-plain">{NEW.slice(at, c.start)}</span>);
    // Where this word sits on the strip (one gradient across the words, as geometry.ts lays them).
    const line = strip?.lines[i];
    const style = line ? (() => { const { from, to } = sweepPositions(strip.total, line.offset); return { '--off': `${line.offset}px`, '--from': `${from}px`, '--to': `${to}px` }; })() : undefined;
    parts.push(<span key={`c${i}`} className="dm-glow-word" data-i={i} style={style}>{NEW.slice(c.start, c.end)}</span>);
    at = c.end;
  });
  if (at < NEW.length) parts.push(<span key="tail" className="dm-glow-plain">{NEW.slice(at)}</span>);
  // One gradient across all the marked words laid end to end (as the app's strip, geometry.ts).
  const total = strip?.total || 200;
  return (
    <p className="dm-text dm-new dm-glow" data-style={marks} data-theme={theme} aria-hidden="true"
      style={{ opacity: o, '--total': `${total}px`, '--el': `${Math.max(0, el)}ms` }}>
      {parts}
    </p>
  );
}

// The halo window (src/halo/HaloWindow.tsx HaloScene), drawn with the app's classes over the same
// rectangles Rust would send: exact lines, full lines, the text box, the new text, the changed words.
function HaloLayer({ halo, geo, marks, theme }) {
  const stripped = rects => { const st = sweepStrip(rects); return st.lines.map(line => { const { from, to } = sweepPositions(st.total, line.offset); return { line, style: { left: line.x, top: line.y, width: line.width, height: line.height, '--total': `${st.total}px`, '--off': `${line.offset}px`, '--from': `${from}px`, '--to': `${to}px`, '--start': `${-line.offset}px` } }; }); };
  const box = r => ({ left: r.x, top: r.y, width: r.width, height: r.height });
  const ground = theme === 'dark' ? '32 32 32' : '251 251 251';
  const style = { opacity: halo.o, transition: 'none', '--ground': ground, '--dm-el': `${halo.el}ms` };
  if (halo.phase === 'marks') {
    const whole = stripped(geo.wholeNew.map(l => pad(l, 1)));
    const words = stripped(geo.changed.map(l => pad(l, 2)));
    return (
      <div className="halo" data-phase="marks" data-state="shown" data-tone={theme} style={style} aria-hidden="true">
        {whole.map(({ style: st }, i) => <div key={`w${i}`} className="halo-wave" style={st} />)}
        {marks === 'actuel' && <div className="halo-marks" data-arrival="wave">{words.map(({ style: st }, i) => <div key={i} className="halo-mark" style={st} />)}</div>}
      </div>
    );
  }
  const work = halo.phase === 'work';
  const exact = stripped(geo.selLines.map(l => pad(l, 1)));
  const tb = inset(geo.textBox, 3);
  return (
    <div className="halo" data-phase={halo.phase} data-state="shown" data-tone={theme} style={style} aria-hidden="true">
      {work
        ? <div className="halo-aurora" style={box(tb)}><i className="ring" /><i className="glow"><i className="ring" /></i></div>
        : <div className="halo-box" style={box(tb)} />}
      {geo.selLines.map((l, i) => <div key={`b${i}`} className="halo-band" style={box(pad(l, 3, 1))} />)}
      {exact.map(({ style: st }, i) => <div key={i} className={work ? 'halo-veil' : 'halo-tint'} style={st} />)}
    </div>
  );
}

// ——— The Îlot's contents: the DOM of src/menu/Ilot.tsx and src/result/ResultPill.tsx (spans, not
// buttons: the scene is decorative) ———
function CompactContent({ askHover }) {
  return (
    <div className="ilot-row">
      <span className="ilot-btn is-default" data-item="last"><SpellCheck size={14} strokeWidth={1.5} aria-hidden="true" /><span className="ilot-label">Corriger</span><span className="ilot-hint">↵</span></span>
      <span className="ilot-sep" />
      <span className="ilot-btn ilot-ask" data-item="ask" data-hover={askHover ? '' : undefined}><span className="ilot-dot" /></span>
    </div>
  );
}
function GridContent({ hot }) {
  return (
    <div className="ilot-grid" style={{ gridTemplateColumns: `repeat(3, ${ilotMetrics.tile.width}px)` }}>
      {TILES.map((tile, i) => (
        <span key={tile.id} className={`ilot-tile${i === hot ? ' is-hot' : ''}`} data-tile={tile.id}>
          <tile.Icon size={16} strokeWidth={1.5} aria-hidden="true" /><span className="ilot-tile-label">{tile.label}</span>
        </span>
      ))}
    </div>
  );
}
function WorkingContent({ orb }) {
  const box = indicatorBox.perle;
  return (
    <span className="result-working" data-orb={orb ? 'shown' : 'waiting'}>
      <span className="working-slot" style={{ width: box.width, height: box.height }}>{orb && <span className="working-orb"><span className="ldr perle" /></span>}</span>
    </span>
  );
}
const CIRC = 2 * Math.PI * 5;
function DoneContent({ p, undoHover, checkOnly }) {
  if (checkOnly) {
    return (
      <div className="result-row is-check-only">
        <svg className="result-check is-drawn" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path pathLength={1} d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
    );
  }
  return (
    <div className="result-row">
      <svg className="result-check" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path pathLength={1} d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <span className="result-btn result-undo" data-hover={undoHover ? '' : undefined}>
        <Undo2 size={12} strokeWidth={1.5} aria-hidden="true" />Annuler
        <svg className="result-ring" viewBox="0 0 14 14" aria-hidden="true"><circle className="track" cx="7" cy="7" r="5" /><circle cx="7" cy="7" r="5" strokeDasharray={`${(CIRC * p).toFixed(2)} 99`} /></svg>
      </span>
    </div>
  );
}

// One surface from the capture to its exit (src/menu/IlotStage.tsx:677-686 + MorphSurface.tsx:375-383):
// the corner (right edge on the selection's end, 8 px under it) slides; the surface enters and
// leaves; its box springs; each content sits on a centred layer that only fades.
function IlotLayer({ s }) {
  const sh = s.shape;
  const layer = key => {
    switch (key) {
      case 'compact': return <CompactContent askHover={s.askHover} />;
      case 'grid': return <GridContent hot={s.hot} />;
      case 'working': return <WorkingContent orb={s.orbOn} />;
      case 'done': return <DoneContent p={s.countdown} undoHover={s.undoHover} />;
      case 'done-check': return <DoneContent checkOnly />;
      default: return null;
    }
  };
  return (
    <div className="ilot-corner dm-corner" style={{ right: `calc(100% - ${s.strip.right}px)`, top: s.strip.top, transform: `translate(${s.corner.x}px, ${s.corner.y}px)` }}>
      <div className="ilot" data-ilot="" data-shape={s.shapeKey === 'compact' || s.shapeKey === 'grid' ? 'menu' : 'pill'} data-mode={s.shapeKey === 'grid' ? 'grid' : s.shapeKey === 'compact' ? 'compact' : undefined}
        style={{ transformOrigin: '100% top', transform: `translateY(${s.ilot.y}px) scale(${s.ilot.scale})`,
          '--dm-orb-el': `${Math.max(0, s.t - s.orbSince)}ms`, '--dm-done-el': `${Math.max(0, s.t - s.doneSince)}ms` }}>
        {/* The presence opacity sits on the shape itself, not on an ancestor: an ancestor below 1
            would become the backdrop root and the real-glass blur would only see an empty layer. */}
        <div className="ilot-shape" data-ilot-shape="" style={{ width: sh.w, height: sh.h, borderRadius: sh.r, opacity: s.ilot.o }}>
          <div className="shape-clip">
            {s.layers.map(l => (
              <div key={l.key} className={`shape-layer${l.o < 1 && s.shapeKey !== l.key ? ' is-leaving' : ''}`} style={{ opacity: l.o }}>{layer(l.key)}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ShortcutHud({ s, keys }) {
  return (
    <div className="dm-hud ft-glass" style={{ left: WIN.x + WIN.w / 2, top: WIN.y + WIN.h + 26, opacity: s.hud.o, transform: `translate(-50%, 0) translateY(${s.hud.y}px) scale(${s.hud.scale})` }}>
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

// The big cursor (Lucas, 30/09: no disc, no ring): the Windows arrow, black body, white inner
// stroke, and a soft blue glow that FOLLOWS ITS CONTOUR (a dilated, blurred copy of the shape
// behind it). The container sits on the click point (the arrow's tip, the I-beam's centre). A press
// brightens the glow and presses the arrow a little.
function BigCursor({ c }) {
  const id = useId().replace(/[^\w-]/g, '');
  const beam = c.beam ?? 0;
  const glow = 0.8 + 0.2 * c.press;
  return (
    <div className="dm-cursor" style={{ opacity: c.o, transform: `translate(${c.x}px, ${c.y}px)` }}>
      <svg className="dm-arrow" style={{ opacity: 1 - beam, transform: `scale(${1 - 0.06 * c.press})` }} width="42" height="50" viewBox="-4 -4 21 25" aria-hidden="true">
        <defs>
          <filter id={`${id}-g`} x="-60%" y="-60%" width="220%" height="220%" colorInterpolationFilters="sRGB">
            <feMorphology in="SourceAlpha" operator="dilate" radius="0.7" result="d" />
            <feGaussianBlur in="d" stdDeviation="1.05" result="b" />
            <feFlood className="dm-glow-flood" result="c" />
            <feComposite in="c" in2="b" operator="in" />
          </filter>
        </defs>
        <path className="dm-arrow-glow" style={{ opacity: glow }} filter={`url(#${id}-g)`} d="M1 1 L1 13.6 L4.2 10.7 L6.3 15.6 L8.4 14.7 L6.4 9.9 L10.8 9.9 Z" />
        <path d="M1 1 L1 13.6 L4.2 10.7 L6.3 15.6 L8.4 14.7 L6.4 9.9 L10.8 9.9 Z" fill="#111" stroke="#fff" strokeWidth="0.9" strokeLinejoin="round" />
      </svg>
      <svg className="dm-ibeam" style={{ opacity: beam }} width="26" height="42" viewBox="-3 -3 13 21" aria-hidden="true">
        <defs>
          <filter id={`${id}-i`} x="-80%" y="-40%" width="260%" height="180%" colorInterpolationFilters="sRGB">
            <feMorphology in="SourceAlpha" operator="dilate" radius="0.6" result="d" />
            <feGaussianBlur in="d" stdDeviation="0.9" result="b" />
            <feFlood className="dm-glow-flood" result="c" />
            <feComposite in="c" in2="b" operator="in" />
          </filter>
        </defs>
        <path className="dm-arrow-glow" style={{ opacity: glow }} filter={`url(#${id}-i)`} d="M1 1 H6 M3.5 1 V14 M1 14 H6" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M1 1 H6 M3.5 1 V14 M1 14 H6" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M1 1 H6 M3.5 1 V14 M1 14 H6" fill="none" stroke="#111" strokeWidth="1.1" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function Caption({ chapter, ended }) {
  const tx = useTx();
  const text = ended ? null : chapter?.text; // at the end, the end card speaks
  return (
    <div className="dm-caption-wrap" aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        {text && (
          <motion.div key={chapter.n} className="dm-caption ft-glass"
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={tx('smooth')}>
            <span className="dm-caption-n">{chapter.n}</span>
            <span>{text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// The right rail: collapsed to its icons; hover, focus or tap unfolds it. Hovering an item shows
// its moment in the animation (paused there) and rings the matching element. Each icon wears the
// colour of the Settings page it points to.
function ExplainRail({ preview, setPreview, onTouch }) {
  const [open, setOpen] = useState(false);
  const panel = useRef(null);
  const tx = useTx();
  const close = () => { setOpen(false); setPreview(null); };
  return (
    <div className="dm-rail-clip" style={{ left: RAIL.right - RAIL.w, top: RAIL.y, width: RAIL.w, height: RAIL.h }}>
      <motion.aside ref={panel} className="dm-rail ft-glass" data-open={open ? '' : undefined}
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
                  <span className="dm-rail-icon" data-ft-page={item.page}><Icon size={16} strokeWidth={1.5} /></span>
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
    <div className="dm-controls ft-glass" role="group" aria-label="Lecture de la démo">
      <button type="button" className="dm-ctl" onClick={onToggle} aria-label={playing ? 'Pause' : (t >= T.END ? 'Revoir' : 'Lecture')} title={playing ? 'Pause' : 'Lecture'}>
        {playing ? <Pause size={16} strokeWidth={1.75} /> : <Play size={16} strokeWidth={1.75} />}
      </button>
      <div className="dm-scrub">
        <span className="dm-scrub-fill" style={{ transform: `scaleX(${(t - start) / span})` }} />
        {CHAPTERS.map(c => c.at > start && <span key={c.n} className="dm-tick" style={{ left: pct(c.at) }} />)}
        {/* The visible thumb is drawn from t (a pure function of time, like the fill); the native
            one stays for the pointer and the keyboard, invisible. */}
        <span className="dm-scrub-thumb" style={{ left: `calc(7px + (100% - 14px) * ${Math.min(1, Math.max(0, (t - start) / span)).toFixed(5)})` }} />
        <input type="range" className="dm-range" min={start} max={T.END} step={50} value={start + Math.round((t - start) / 50) * 50}
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
