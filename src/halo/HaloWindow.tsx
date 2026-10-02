import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { bridge } from '../bridge';
import type { ChangedWordsStyle, HaloEvent, Rect } from '../types';
import { useSettings } from '../useSettings';
import { inset, pad, sweepPositions, sweepStrip } from './geometry';
import { inkFor, maskOf, usableMasks, type HaloMask } from './ink';
import './halo.css';

// The work's halo appears with the orb's delay (DA-PLAN lot 6), in JS so it holds under
// reduced animations too, where every CSS delay is cancelled (styles.css). After the menu's
// halo it follows at once: the selection was already shown.
export const HALO_APPEAR_DELAY_MS = 250;

export type HaloState = 'waiting' | 'shown' | 'leaving';
// A run as the page draws it: Rust's event, plus what 0.6 adds for the marks (docs/PLAN-0.6.md
// §2): `masks`, the glyphs of the changed words (./ink.ts), and `style`, the user's choice at
// the replacement (else the page's own settings).
export type HaloRun = HaloEvent & { masks?: HaloMask[]; style?: ChangedWordsStyle };

const box = (rect: Rect): CSSProperties => ({ left: rect.x, top: rect.y, width: rect.width, height: rect.height });

// The rectangles laid end to end as one strip (src/halo/geometry.ts): a gradient runs on
// from one line to the next instead of restarting on each.
function stripped(rects: readonly Rect[]) {
  const strip = sweepStrip(rects);
  return strip.lines.map(line => {
    const { from, to } = sweepPositions(strip.total, line.offset);
    return { rect: line, style: { ...box(line), '--total': `${strip.total}px`, '--off': `${line.offset}px`, '--from': `${from}px`, '--to': `${to}px`, '--start': `${-line.offset}px` } as CSSProperties };
  });
}

// The selection (« mise en valeur », Lucas 25/09, design-lab/mise-en-valeur.html). The menu
// shows it at three levels, still: a line around the text box, a faint band per whole line,
// a tint on the exact text. The work keeps the bands, turns the box's line into an aurora and
// passes a reflection over the letters: a veil of the ground's own colour.
function HaloSelection({ run }: { run: HaloRun }) {
  const work = run.phase === 'work';
  const exact = useMemo(() => stripped(run.lines.map(line => pad(line, 1))), [run.lines]);
  const textBox = run.textBox ? inset(run.textBox, 3) : null;
  return <>
    {textBox && (work
      ? <div className="halo-aurora" style={box(textBox)}><i className="ring" /><i className="glow"><i className="ring" /></i></div>
      : <div className="halo-box" style={box(textBox)} />)}
    {(run.full ?? []).map((line, index) => <div key={`band-${index}`} className="halo-band" style={box(pad(line, 3, 1))} />)}
    {exact.map(({ style }, index) => <div key={index} className={work ? 'halo-veil' : 'halo-tint'} style={style} />)}
  </>;
}

// The result pasted: a wave of light over the new text (1 s, once), then the changed words:
// the text itself lit (« Encre irisée », or « Éclat »: brighter letters and a thin line), never
// a box. Through a mask of the glyphs when Rust read one (./ink.ts), else a feathered light.
// Held until Rust's `leave` (the user's next action in the text, 60 s at most), then 900 ms out.
function HaloMarks({ run, style }: { run: HaloRun; style: ChangedWordsStyle }) {
  const whole = useMemo(() => stripped((run.whole ?? []).map(line => pad(line, 1))), [run.whole]);
  const words = useMemo(() => {
    const masks = usableMasks(run.masks);
    const strip = sweepStrip(run.lines);
    return strip.lines.map(line => {
      const mask = maskOf(line, masks);
      const place = { '--total': `${strip.total}px`, '--off': `${line.offset}px` };
      return mask
        ? { ink: true, style: { ...box(mask.rect), ...place, '--mask': `url("${mask.image}")` } as CSSProperties }
        : { ink: false, style: { ...box(line), ...place } as CSSProperties };
    });
  }, [run.lines, run.masks]);
  return <>
    {whole.map(({ style }, index) => <div key={`wave-${index}`} className="halo-wave" style={style} />)}
    <div className="halo-marks" data-style={style} data-arrival={whole.length ? 'wave' : 'fade'}>
      {words.map((word, index) => <div key={index} className={`halo-mark ${word.ink ? 'is-ink' : 'is-light'}`} style={word.style}>
        <i className={word.ink ? 'halo-ink' : 'halo-light'} />
        {style === 'eclat' && <i className="halo-line" />}
      </div>)}
    </div>
  </>;
}

// One run of the halo, as Rust sent it. Its tone comes from the ground read under the text;
// without one, from the app's theme (halo.css). `marks`: the style of the changed words when
// the run does not carry its own. On a ground Rust read, the ink is made readable on it (4.5:1).
export function HaloScene({ run, state, marks = 'encre' }: { run: HaloRun; state: HaloState; marks?: ChangedWordsStyle }) {
  const words = run.style === 'eclat' || run.style === 'encre' ? run.style : marks;
  const style = useMemo(() => {
    if (!run.ground) return undefined;
    const vars: Record<string, string> = { '--ground': run.ground.join(' ') };
    if (run.phase === 'marks' && run.tone) inkFor(words, run.tone, run.ground).forEach((stop, index) => { vars[`--ink${index + 1}`] = stop.join(' '); });
    return vars as CSSProperties;
  }, [run.ground, run.phase, run.tone, words]);
  return <div className="halo" data-phase={run.phase} data-state={state} data-tone={run.tone ?? undefined} style={style} aria-hidden="true">
    {run.phase === 'marks' ? <HaloMarks run={run} style={words} /> : <HaloSelection run={run} />}
  </div>;
}

// The same drawing without the bridge, for whoever builds a run itself (the demo, src/demo/).
// `.halo` is `position: fixed; inset: 0`: inside a frame, give it a containing block (a parent
// with a transform or `contain: layout`), the rectangles are then relative to that parent.
export function HaloView({ event, state = 'shown', marks }: { event: HaloRun; state?: HaloState; marks?: ChangedWordsStyle }) {
  return <HaloScene key={event.generation} run={event} state={state} marks={marks} />;
}

// The `halo` window: Rust places it over the selection (or the new text) and sends its
// rectangles in logical pixels relative to the window (`halo` events, src-tauri/src/halo.rs).
// `menu` and `marks` draw at once, `work` after 250 ms unless the menu's halo was shown,
// `leave` fades out (150 ms, the marks 900 ms), `clear` removes. An event older than the last
// run is ignored.
export function HaloWindow() {
  const [run, setRun] = useState<HaloRun | null>(null);
  const [state, setState] = useState<HaloState>('waiting');
  // The style of the changed words: this window receives `settings-changed` (docs/BRIDGE.md).
  const settings = useSettings();
  const latest = useRef(-1);
  // The menu's halo is shown: the work's follows it without the delay.
  const menuShown = useRef(false);
  useEffect(() => {
    let off: (() => void) | undefined;
    let alive = true;
    let timer = 0;
    void bridge.on<HaloRun>('halo', event => {
      if (event.generation < latest.current) return;
      latest.current = event.generation;
      window.clearTimeout(timer);
      const afterMenu = menuShown.current;
      menuShown.current = event.phase === 'menu';
      if (event.phase === 'work' && !afterMenu) {
        setRun(event);
        setState('waiting');
        timer = window.setTimeout(() => setState('shown'), HALO_APPEAR_DELAY_MS);
      } else if (event.phase === 'menu' || event.phase === 'work' || event.phase === 'marks') {
        setRun(event);
        setState('shown');
      } else if (event.phase === 'leave') setState('leaving');
      else { setRun(null); setState('waiting'); }
    }).then(listener => {
      if (!alive) return listener();
      off = listener;
      // Listening: the tests (and the real-window checks) wait for this before any event.
      document.documentElement.dataset.haloReady = 'true';
    });
    return () => { alive = false; window.clearTimeout(timer); off?.(); delete document.documentElement.dataset.haloReady; };
  }, []);
  if (!run) return null;
  return <HaloScene key={run.generation} run={run} state={state} marks={settings?.changedWordsStyle} />;
}
