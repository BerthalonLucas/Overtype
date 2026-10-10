import { useId } from 'react';

// The ground of the demo's stage (and of the setup's browser preview): Windows 11 « Bloom »-like
// petals fanning out of one point, crisp edges with a thin light rim, so the real glass above
// them visibly blurs something (design-lab/reglages/src/stage/Desktop.jsx). Static, painted once,
// in the colours of the neutral base (demo.css --dm-wall-*).
const PETALS = [-78, -52, -26, 0, 26, 52, 78];

export function Wallpaper() {
  const id = useId().replace(/[^\w-]/g, '');
  return (
    <div className="dm-wallpaper" aria-hidden="true">
      <i className="dm-bloom a" />
      <i className="dm-bloom c" />
      <svg className="dm-petals" viewBox="0 0 1280 800" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={`${id}-a`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" style={{ stopColor: 'var(--dm-wall-2)' }} />
            <stop offset=".55" style={{ stopColor: 'var(--ft-accent)', stopOpacity: 0.55 }} />
            <stop offset="1" style={{ stopColor: 'var(--dm-wall-1)', stopOpacity: 0.9 }} />
          </linearGradient>
          <linearGradient id={`${id}-b`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" style={{ stopColor: 'var(--dm-wall-1)' }} />
            <stop offset="1" style={{ stopColor: 'var(--dm-wall-2)', stopOpacity: 0.7 }} />
          </linearGradient>
        </defs>
        <g transform="translate(700 560)">
          {PETALS.map((angle, index) => (
            <g key={angle} transform={`rotate(${angle - 90})`}>
              <ellipse
                cx="330"
                cy="0"
                rx="340"
                ry="92"
                fill={`url(#${id}-${index % 2 ? 'b' : 'a'})`}
                className="dm-petal"
              />
            </g>
          ))}
          <circle r="60" className="dm-petal-heart" />
        </g>
      </svg>
    </div>
  );
}
