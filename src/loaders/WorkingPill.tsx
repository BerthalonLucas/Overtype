import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { motion } from 'motion/react';
import { useT } from '../i18n';
import { useSurfacePresence } from '../motion/MotionPreferences';
import type { Grow } from '../motion/presence';
import type { Indicator } from '../types';
import { Icon } from '../ui';
import { IndicatorView } from './indicators';
import { indicatorBox, ORB_DELAY_MS, workingPillShape } from './pill';
import './loaders.css';

// Whether the page is hidden (a hidden overlay, a minimised window): the loops then rest.
function subscribeVisibility(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}
const pageHidden = () => document.visibilityState === 'hidden';
export function usePageHidden(): boolean {
  return useSyncExternalStore(subscribeVisibility, pageHidden, () => false);
}

// The pill of lot 8 (docs/DA-PLAN.md): a glass pill of 44 × 28 (52 × 28 for the Ruban), radius
// 14, that holds the chosen indicator while the model works. Nothing textual; the pill never
// grows: the slot reserves the indicator's box from the start, and the orb only shows after
// 250 ms, so a faster answer shows the empty pill alone, without a flash. The content sits on a
// layer centred in the pill (plan §4.3, glass.css .shape-layer). The Îlot's journey springs its
// own surface to this shape around the same content without a surface (src/result/ResultPill.tsx
// WorkingContent); this pill is the glass's, for a direct capture under the Îlot.
// The loops run only while the content is mounted; they rest under reduced motion (loaders.css)
// and while the page is hidden.
// `done`: the result was pasted (0.4 replace mode); the check stands in for the orb until lot 9
// draws its own.
type WorkingProps = { indicator: Indicator; done?: boolean; delayMs?: number };

// The orb's delay, the page's visibility, and the label and state attributes the tests and
// assistive technologies read.
function useWorking({ indicator, done = false, delayMs = ORB_DELAY_MS }: WorkingProps) {
  const t = useT();
  const hidden = usePageHidden();
  const [orb, setOrb] = useState(delayMs <= 0);
  useEffect(() => {
    if (orb) return;
    const timer = window.setTimeout(() => setOrb(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [orb, delayMs]);
  const attributes = {
    role: 'img',
    'aria-label': t(done ? 'glass.replaced' : 'pill.working'),
    'data-indicator': indicator,
    'data-orb': orb && !done ? 'shown' : 'waiting',
    'data-done': done || undefined,
    'data-paused': hidden || undefined,
  };
  const box = indicatorBox[indicator];
  const content = done ? (
    <Icon name="check" size={16} />
  ) : (
    <span className="working-slot" style={{ width: box.width, height: box.height }}>
      {orb && (
        <span className="working-orb">
          <IndicatorView indicator={indicator} />
        </span>
      )}
    </span>
  );
  return { attributes, content };
}

// `grow`: the side it enters from (src/motion/presence.ts). null: not known yet (the glass waits for
// Rust's placement to learn on which side of the selection it hangs): the pill waits unseen where
// it rests, then enters from that side once told (review of bc57857, finding 8).
export function WorkingPill({ grow = 'up', ...props }: WorkingProps & { grow?: Grow | null }) {
  const enter = useSurfacePresence(grow ?? 'up');
  const bornWaiting = useRef(grow === null).current;
  // Born waiting, it glides from the side learnt since, not from where it first stood unseen.
  const from = (enter.initial as { y?: number }).y;
  const animate =
    grow === null
      ? enter.initial
      : bornWaiting && from !== undefined
        ? { ...enter.animate, y: [from, 0] }
        : enter.animate;
  const { attributes, content } = useWorking(props);
  const shape = workingPillShape(props.indicator);
  const style = {
    width: shape.width,
    height: shape.height,
    borderRadius: shape.borderRadius,
    '--working-pill-width': `${shape.width}px`,
  } as CSSProperties;
  return (
    <motion.span
      initial={enter.initial}
      animate={animate}
      exit={enter.exit}
      className="working-pill"
      style={style}
      {...attributes}
      data-grow={grow ?? 'waiting'}
    >
      <span className="shape-clip">
        <span className="shape-layer working-layer">{content}</span>
      </span>
    </motion.span>
  );
}
