// The three working indicators Lucas kept (app: src/loaders/indicators.tsx + loaders.css), copied
// with the lab's ink token. Decorative (aria-hidden): the control that holds them is labelled.
import { useId } from 'react';

export function Perle({ size = 14 }) {
  return <span className="st-ldr st-perle" style={{ '--size': `${size}px` }} aria-hidden="true" />;
}
export function Nebuleuse({ size = 16 }) {
  return <span className="st-ldr st-neb" style={{ '--size': `${size}px` }} aria-hidden="true"><i /><i /><i /></span>;
}
function wave(half) {
  let d = `M-${half * 4} 6`;
  for (let i = 0; i < 12; i++) d += ` q${half / 2} ${i % 2 ? 5 : -5} ${half} 0`;
  return d;
}
const WAVES = { s1: wave(6), s2: wave(8), s3: wave(10) };
export function Ruban({ scale = 1 }) {
  const id = `st-sin-${useId().replace(/[^\w-]/g, '')}`;
  return (
    <svg className="st-ldr st-sinus" width={28 * scale} height={12 * scale} viewBox="0 0 28 12" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-f`} x1="0" y1="0" x2="28" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".25" stopColor="#fff" /><stop offset=".75" stopColor="#fff" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
        <mask id={`${id}-m`}><rect width="28" height="12" fill={`url(#${id}-f)`} /></mask>
      </defs>
      <g mask={`url(#${id}-m)`}><g className="amp">
        <path className="s1" d={WAVES.s1} />
        <path className="s2" d={WAVES.s2} />
        <path className="s3" d={WAVES.s3} />
      </g></g>
    </svg>
  );
}
export function Indicator({ kind, big }) {
  if (kind === 'nebuleuse') return <Nebuleuse size={big ? 22 : 16} />;
  if (kind === 'ruban') return <Ruban scale={big ? 1.4 : 1} />;
  return <Perle size={big ? 20 : 14} />;
}
export const INDICATORS = [
  { value: 'perle', label: 'Perle', hint: 'Irisée, elle respire' },
  { value: 'nebuleuse', label: 'Nébuleuse', hint: 'Trois couleurs mêlées' },
  { value: 'ruban', label: 'Ruban', hint: 'Trois ondes qui glissent' },
];
