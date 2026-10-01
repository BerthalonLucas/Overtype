// The simulated Windows 11 desktop: a « bloom » wallpaper tinted by the neutral base (crisp petals,
// so a floating glass surface visibly blurs what is behind it), a taskbar with the
// app's tray icon, and a 1280 × 800 coordinate space where windows float at REAL size. The
// whole desktop is scaled to fit the viewport (phone included); on a narrow screen it zooms on
// the focused window instead of shrinking everything (prop `focus`).
//
//   <Stage focus={{ w: 860, h: 600 }} onTray={…}>
//     <AppWindow …/>      ← children are positioned in desktop pixels (absolute)
//   </Stage>
//
// useDesktop() → { W, H, taskbarH, scale, workArea: { w, h } } inside the stage.
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronUp, Wifi, Volume2, BatteryFull, Search, Folder, Globe, Mail, FileText } from 'lucide-react';
import { appName } from '../brand.js';
import './stage.css';

export const DESKTOP = { W: 1280, H: 800, taskbarH: 48 };
const DesktopContext = createContext({ ...DESKTOP, scale: 1, workArea: { w: DESKTOP.W, h: DESKTOP.H - DESKTOP.taskbarH } });
export const useDesktop = () => useContext(DesktopContext);

function useSize(ref) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return undefined;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure); ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(id); }, []);
  return (
    <span className="ft-tray-clock">
      <span>{now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
      <span>{now.toLocaleDateString('fr-FR')}</span>
    </span>
  );
}

// The app's mark: the Îlot's iridescent dot in a rounded square (name from src/brand.js).
export function AppMark({ size = 16, className = '' }) {
  return <span className={`ft-appmark ${className}`} style={{ '--s': `${size}px` }} aria-hidden="true"><i /></span>;
}

// Windows 11 « Bloom »-like: petals fanning out of one point, crisp edges and a thin light rim
// on each, over a soft glow. Static SVG, coloured by the base (--ft-wall-1…4, --ft-accent).
const PETALS = [-78, -52, -26, 0, 26, 52, 78];
export function Wallpaper() {
  return (
    <div className="ft-wallpaper" aria-hidden="true">
      <i className="ft-bloom a" /><i className="ft-bloom c" />
      <svg className="ft-petals" viewBox="0 0 1280 800" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="ft-petal" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" style={{ stopColor: 'var(--ft-wall-2)' }} />
            <stop offset=".55" style={{ stopColor: 'var(--ft-accent)', stopOpacity: 0.55 }} />
            <stop offset="1" style={{ stopColor: 'var(--ft-wall-1)', stopOpacity: 0.9 }} />
          </linearGradient>
          <linearGradient id="ft-petal-2" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" style={{ stopColor: 'var(--ft-wall-1)' }} />
            <stop offset="1" style={{ stopColor: 'var(--ft-wall-2)', stopOpacity: 0.7 }} />
          </linearGradient>
        </defs>
        <g transform="translate(700 560)">
          {PETALS.map((a, i) => (
            <g key={a} transform={`rotate(${a - 90})`}>
              <ellipse cx="330" cy="0" rx="340" ry="92" fill={`url(#${i % 2 ? 'ft-petal-2' : 'ft-petal'})`} className="ft-petal" />
            </g>
          ))}
          <circle r="60" className="ft-petal-heart" />
        </g>
      </svg>
    </div>
  );
}

export function Taskbar({ onTray, trayActive, trayBadge }) {
  return (
    <div className="ft-taskbar" role="presentation">
      <div className="ft-taskbar-center">
        <span className="ft-tb-app ft-tb-start" aria-hidden="true"><i /><i /><i /><i /></span>
        <span className="ft-tb-search" aria-hidden="true"><Search size={15} strokeWidth={1.75} /><span>Rechercher</span></span>
        <span className="ft-tb-app" aria-hidden="true"><Folder size={20} strokeWidth={1.5} /></span>
        <span className="ft-tb-app" aria-hidden="true"><Globe size={20} strokeWidth={1.5} /></span>
        <span className="ft-tb-app" aria-hidden="true"><Mail size={20} strokeWidth={1.5} /></span>
        <span className="ft-tb-app" aria-hidden="true"><FileText size={20} strokeWidth={1.5} /></span>
      </div>
      <div className="ft-taskbar-tray">
        <span className="ft-tray-btn" aria-hidden="true"><ChevronUp size={15} strokeWidth={1.75} /></span>
        <button type="button" className="ft-tray-btn ft-tray-app" data-active={trayActive ? '' : undefined} onClick={onTray}
          aria-label={`${appName} — ouvrir les réglages`} title={appName}>
          <AppMark size={16} />
          {trayBadge && <span className="ft-tray-badge" aria-hidden="true" />}
        </button>
        <span className="ft-tray-btn ft-tray-sys" aria-hidden="true"><Wifi size={15} strokeWidth={1.75} /><Volume2 size={15} strokeWidth={1.75} /><BatteryFull size={15} strokeWidth={1.75} /></span>
        <Clock />
      </div>
    </div>
  );
}

// Narrow screens (phone): no shrinking the whole desktop to a stamp. The focused window is shown
// whole when it is small (the setup), at a readable scale (≥ 0.8) with a swipe to pan when it is
// large (Réglages, the demo); the taskbar
// gives way to a floating tray button, and side panels (useDesktop().asideEl) stack below.
const NARROW = 700;
const MIN_NARROW_SCALE = 0.8;

export function Stage({ children, focus, onTray, trayActive, trayBadge, className = '', wallpaper = true }) {
  const outer = useRef(null);
  const { w, h } = useSize(outer);
  const [asideEl, setAsideEl] = useState(null);
  const { W, H, taskbarH } = DESKTOP;
  const narrow = !!(focus && w && h && w < NARROW);
  let scale = w && h ? Math.min(1, w / W, h / H) : 1;
  // Medium screens: zoom on the focused window (centred) rather than shrinking the whole desktop.
  if (focus && w && h && scale < 0.62) scale = Math.min(1, (w - 16) / focus.w, (h - 16) / focus.h);
  // A small window (the setup, 620 px) fits whole; a large one (Réglages, the demo) keeps a
  // readable scale and pans.
  if (narrow) scale = Math.min(1, focus.w <= 700 ? Math.min((w - 16) / focus.w, (h - 16) / focus.h) : Math.max(MIN_NARROW_SCALE, (w - 16) / focus.w));
  const ctx = { W, H, taskbarH, scale, narrow, asideEl: narrow ? asideEl : null, workArea: { w: W, h: H - taskbarH } };

  // ONE element tree in both modes (wide / narrow): crossing the breakpoint only changes styles,
  // so React never remounts the children (a paused demo, a Réglages page, a check in flight survive).
  let deskStyle, panStyle;
  if (!narrow) {
    deskStyle = { transform: `translate(-50%, -50%) scale(${scale})` };
    panStyle = { width: '100%', height: '100%' };
  } else {
    // The focused region of the desktop (where AppWindow centres a window of focus.w × focus.h).
    const fx = (W - focus.w) / 2;
    const fy = Math.max(12, (H - taskbarH - focus.h) / 2);
    const pw = Math.round(focus.w * scale + 16);
    const ph = Math.round(focus.h * scale + 16);
    deskStyle = { left: 8 - fx * scale + Math.max(0, (w - pw) / 2), top: 8 - fy * scale, transform: `scale(${scale})`, transformOrigin: '0 0' };
    panStyle = { width: Math.max(pw, w), height: ph };
  }
  return (
    <div ref={outer} className={`ft-stage ${className}`} data-narrow={narrow ? '' : undefined}>
      <div className="ft-stage-scroll">
        <div className="ft-stage-pan" style={panStyle}>
          <div className="ft-desktop" data-wallpaper={wallpaper ? '' : undefined} style={{ width: W, height: H, ...deskStyle }}>
            <Wallpaper />
            <DesktopContext.Provider value={ctx}>
              <div className="ft-workarea" style={{ height: H - taskbarH }}>{children}</div>
            </DesktopContext.Provider>
            <div className="ft-taskbar-slot" hidden={narrow || undefined}>
              <Taskbar onTray={onTray} trayActive={trayActive} trayBadge={trayBadge} />
            </div>
          </div>
        </div>
        <div ref={setAsideEl} className="ft-stage-aside" style={{ width: narrow ? w : undefined }} />
      </div>
      {onTray && narrow && (
        <button type="button" className="ft-stage-tray" data-active={trayActive ? '' : undefined} onClick={onTray} aria-label={`${appName} — ouvrir les réglages`}>
          <AppMark size={18} />
          {trayBadge && <span className="ft-tray-badge" aria-hidden="true" />}
        </button>
      )}
    </div>
  );
}
