import { useId } from 'react';
import type { Pointer } from './script';

// The demo's big pointer (Lucas, 30/09: no disc, no ring): the Windows arrow, black body, white
// rim, and a soft blue glow that FOLLOWS ITS CONTOUR (a dilated, blurred copy of the shape behind
// it). Over text it is the I-beam, swapped at once as Windows does (no cross-fade). The container
// sits on the click point: the arrow's tip, the I-beam's centre. A press brightens the glow and
// presses the arrow a little.
const ARROW = 'M1 1 L1 13.6 L4.2 10.7 L6.3 15.6 L8.4 14.7 L6.4 9.9 L10.8 9.9 Z';
const BEAM = 'M1 1 H6 M3.5 1 V14 M1 14 H6';

export function Cursor({ pointer }: { pointer: Pointer }) {
  const id = useId().replace(/[^\w-]/g, '');
  const beam = pointer.shape === 'beam';
  const glow = 0.8 + 0.2 * pointer.press;
  return (
    <div
      className="dm-cursor"
      data-shape={pointer.shape}
      style={{ opacity: pointer.opacity, transform: `translate(${pointer.x}px, ${pointer.y}px)` }}
    >
      <svg
        className="dm-arrow"
        style={{ opacity: beam ? 0 : 1, transform: `scale(${1 - 0.06 * pointer.press})` }}
        width="42"
        height="50"
        viewBox="-4 -4 21 25"
        aria-hidden="true"
      >
        <defs>
          <filter id={`${id}-a`} x="-60%" y="-60%" width="220%" height="220%" colorInterpolationFilters="sRGB">
            <feMorphology in="SourceAlpha" operator="dilate" radius="0.7" result="d" />
            <feGaussianBlur in="d" stdDeviation="1.05" result="b" />
            <feFlood className="dm-glow-flood" result="c" />
            <feComposite in="c" in2="b" operator="in" />
          </filter>
        </defs>
        <path style={{ opacity: glow }} filter={`url(#${id}-a)`} d={ARROW} />
        <path d={ARROW} fill="#111" stroke="#fff" strokeWidth="0.9" strokeLinejoin="round" />
      </svg>
      <svg
        className="dm-ibeam"
        style={{ opacity: beam ? 1 : 0 }}
        width="26"
        height="42"
        viewBox="-3 -3 13 21"
        aria-hidden="true"
      >
        <defs>
          <filter id={`${id}-i`} x="-80%" y="-40%" width="260%" height="180%" colorInterpolationFilters="sRGB">
            <feMorphology in="SourceAlpha" operator="dilate" radius="0.6" result="d" />
            <feGaussianBlur in="d" stdDeviation="0.9" result="b" />
            <feFlood className="dm-glow-flood" result="c" />
            <feComposite in="c" in2="b" operator="in" />
          </filter>
        </defs>
        <path
          style={{ opacity: glow }}
          filter={`url(#${id}-i)`}
          d={BEAM}
          fill="none"
          stroke="#fff"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path d={BEAM} fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
        <path d={BEAM} fill="none" stroke="#111" strokeWidth="1.1" strokeLinecap="round" />
      </svg>
    </div>
  );
}
