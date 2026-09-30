// Centring check overlay. Wrap a live control in <CentringBox checks={[…]} on={bool}> and, when
// `on`, it draws the centre of each container (dashed accent cross) and of its glyph (solid cross)
// and prints the worst offset. Measured with getBoundingClientRect every frame while on, so it
// follows animations (a switch in mid-travel is reported once it rests).
//
// checks: [{ box: 'css selector', glyph: 'css selector inside box', mode, label }]
//   mode 'center'     → glyph centre = box centre (icon buttons, radio dots, close crosses)
//   mode 'vcenter'    → only the vertical centre (slider thumb on its track, chevrons)
//   mode 'concentric' → switch thumb: vertical centre, and the gap to the near end = the gap to the top
// Pass: every error < 0.5 px (Lucas: « chaque élément rond exactement centré dans sa forme »).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const TOL = 0.5;

function measure(root, checks) {
  const base = root.getBoundingClientRect();
  const out = [];
  for (const c of checks) {
    for (const box of root.querySelectorAll(c.box)) {
      const glyph = c.glyph === ':self' ? box : box.querySelector(c.glyph);
      if (!glyph) continue;
      const b = box.getBoundingClientRect();
      const g = glyph.getBoundingClientRect();
      if (!b.width || !g.width) continue;
      const bc = { x: b.left + b.width / 2, y: b.top + b.height / 2 };
      const gc = { x: g.left + g.width / 2, y: g.top + g.height / 2 };
      let err;
      if (c.mode === 'vcenter') err = Math.abs(gc.y - bc.y);
      else if (c.mode === 'concentric') {
        // the border (if any) is part of the box: compare gaps measured from the outer edge
        const top = g.top - b.top, bottom = b.bottom - g.bottom;
        const left = g.left - b.left, right = b.right - g.right;
        const side = Math.min(left, right);
        err = Math.max(Math.abs(top - bottom), Math.abs(side - (top + bottom) / 2));
      } else err = Math.hypot(gc.x - bc.x, gc.y - bc.y);
      out.push({
        label: c.label,
        err,
        box: { x: (c.mode === 'vcenter' ? gc.x : bc.x) - base.left, y: bc.y - base.top, w: b.width, h: b.height },
        glyph: { x: gc.x - base.left, y: gc.y - base.top },
      });
    }
  }
  return out;
}

export function CentringBox({ checks, on, children, className = '' }) {
  const ref = useRef(null);
  const [marks, setMarks] = useState([]);
  const checksRef = useRef(checks); checksRef.current = checks;
  const key = JSON.stringify(checks);
  useLayoutEffect(() => {
    if (!on || !ref.current) { setMarks([]); return undefined; }
    let raf = 0, last = '';
    const tick = () => {
      const m = measure(ref.current, checksRef.current);
      const sig = m.map(x => `${x.box.x.toFixed(2)},${x.box.y.toFixed(2)},${x.glyph.x.toFixed(2)},${x.glyph.y.toFixed(2)},${x.err.toFixed(3)}`).join('|');
      if (sig !== last) { last = sig; setMarks(m); }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [on, key]);
  const worst = marks.reduce((a, m) => Math.max(a, m.err), 0);
  return (
    <div ref={ref} className={`ct-box ${className}`}>
      {children}
      {on && (
        <div className="ct-layer" aria-hidden="true">
          {marks.map((m, i) => (
            <span key={i} className="ct-mark" data-bad={m.err >= TOL ? '' : undefined}>
              <i className="ct-box-x" style={{ transform: `translate(${m.box.x}px, ${m.box.y}px)` }} />
              <i className="ct-glyph-x" style={{ transform: `translate(${m.glyph.x}px, ${m.glyph.y}px)` }} />
            </span>
          ))}
        </div>
      )}
      {on && (
        <p className="ct-readout" data-bad={worst >= TOL ? '' : undefined} role="status">
          {marks.length ? <>{marks.length} mesure{marks.length > 1 ? 's' : ''} · écart max <strong>{worst.toFixed(2)} px</strong>{worst >= TOL ? ' · décentré' : ' · centré'}</> : (checks.length ? 'Rien à mesurer pour l’instant' : 'Pas de rond ni d’icône isolée à mesurer ici')}
        </p>
      )}
    </div>
  );
}

// Toggle button for the overlay (one per card, plus a page-wide one).
export function CentringToggle({ on, onChange, label = 'Repères de centrage' }) {
  return (
    <button type="button" className="ct-toggle" aria-pressed={on} onClick={() => onChange(!on)}>
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.25" /><circle cx="7" cy="7" r="3.25" fill="none" stroke="currentColor" strokeWidth="1.25" /></svg>
      <span>{label}</span>
    </button>
  );
}

// Ticks when the page toggle changes, so each card follows it but can still be flipped alone.
export function useFollow(global) {
  const [on, setOn] = useState(global);
  useEffect(() => setOn(global), [global]);
  return [on, setOn];
}
