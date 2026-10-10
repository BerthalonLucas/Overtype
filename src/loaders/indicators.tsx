import { useId } from 'react';
import type { Indicator } from '../types';

// The three indicators Lucas kept (docs/DA-PLAN.md §1, 24/09), as the lab renders them
// (design-lab/src/loaders.jsx:32, 35, 109-123); their CSS is ./loaders.css. Decorative: the
// pill that holds them carries the accessible name.

export function Perle() {
  return <span className="ldr perle" aria-hidden="true" />;
}

export function Nebuleuse() {
  return (
    <span className="ldr neb" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

// A sine of 12 half-waves of `half` px, drawn from four waves to the left so it can slide.
function wave(half: number) {
  let d = `M-${half * 4} 6`;
  for (let i = 0; i < 12; i++) d += ` q${half / 2} ${i % 2 ? 5 : -5} ${half} 0`;
  return d;
}
const waves = { s1: wave(6), s2: wave(8), s3: wave(10) };

// The lab's Sinus with its ribbon: three waves under a mask that fades both ends.
export function Ruban() {
  const id = `sin-${useId().replace(/[^\w-]/g, '')}`;
  return (
    <svg className="ldr sinus ruban" width="28" height="12" viewBox="0 0 28 12" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-f`} x1="0" y1="0" x2="28" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset=".25" stopColor="#fff" />
          <stop offset=".75" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={`${id}-m`}>
          <rect width="28" height="12" fill={`url(#${id}-f)`} />
        </mask>
      </defs>
      <g mask={`url(#${id}-m)`}>
        <g className="amp">
          <path className="s1" d={waves.s1} />
          <path className="s2" d={waves.s2} />
          <path className="s3" d={waves.s3} />
        </g>
      </g>
    </svg>
  );
}

export function IndicatorView({ indicator }: { indicator: Indicator }) {
  if (indicator === 'nebuleuse') return <Nebuleuse />;
  if (indicator === 'ruban') return <Ruban />;
  return <Perle />;
}
