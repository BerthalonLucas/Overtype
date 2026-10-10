import { useCallback, useLayoutEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion, useIsPresent } from 'motion/react';
import { animateSurface, surfaceRadius } from '../motion/surface';
import {
  useContentPresence,
  useMotionPreset,
  useReducedMotionSetting,
  useSurfacePresence,
} from '../motion/MotionPreferences';

// One glass object that changes shape (design-lab/src/Surface.jsx, plan §4.3): its content swaps
// by `contentKey` (the old layer fades out on its own, the new one fades in) while the box springs
// from the old size to the new one on the « morph » spring. The box animates width, height and
// radius only (animateSurface, src/motion/surface.ts); the content sits on a layer centred at its
// natural size (.shape-clip / .shape-layer, src/glass.css), so text and icons are never scaled.
// It enters on the « enter » spring (opacity, the preset's scale and glide) with its transform
// origin on the side of the selection; wrap it in <AnimatePresence> for the exit.
// Reduced motion: opacity fades only, the shape is set at once.

export type SurfaceSize = { width: number; height: number };
// For the hit-test regions (§4.3): published at the start of a change on the larger of the two
// shapes, and at its end on the new one. The first shape arrives as an `end` without `from`.
export type ShapeChange = { from: SurfaceSize | null; to: SurfaceSize; phase: 'start' | 'end' };
// The side of the surface that faces the selection: 'top' when it opens below the selection.
export type SurfaceOrigin = 'top' | 'bottom';

export type MorphSurfaceProps = {
  contentKey: string;
  // A fixed shape (the work pill); by default the shape follows the content's natural size.
  size?: SurfaceSize;
  origin?: SurfaceOrigin;
  // Horizontal transform origin (CSS length or percentage), toward the selection.
  originX?: string;
  className?: string;
  onShapeChange?: (change: ShapeChange) => void;
  children: ReactNode;
  // data-* attributes for the parent and the tests.
  [data: `data-${string}`]: string | undefined;
};

export function MorphSurface({
  contentKey,
  size,
  origin = 'top',
  originX = '50%',
  className = '',
  onShapeChange,
  children,
  ...data
}: MorphSurfaceProps) {
  const presence = useSurfacePresence(origin === 'top' ? 'down' : 'up');
  const tokens = useMotionPreset();
  const reduced = useReducedMotionSetting();
  const shape = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLElement | null>(null);
  const current = useRef<SurfaceSize | null>(null);
  const running = useRef<ReturnType<typeof animateSurface> | null>(null);
  const latest = useRef({ tokens, reduced, onShapeChange });
  latest.current = { tokens, reduced, onShapeChange };
  const fixedWidth = size?.width,
    fixedHeight = size?.height;

  // Surface.jsx:65-98: the box follows the current layer's natural size (offset sizes ignore
  // the entrance scale), set at once the first time, then on the morph spring.
  const fit = useCallback(() => {
    const box = shape.current,
      content = layer.current;
    const target =
      fixedWidth && fixedHeight
        ? { width: fixedWidth, height: fixedHeight }
        : content
          ? { width: Math.ceil(content.offsetWidth), height: Math.ceil(content.offsetHeight) }
          : null;
    if (!box || !target?.width || !target.height) return;
    const from = current.current;
    if (from && from.width === target.width && from.height === target.height) return;
    current.current = target;
    const report = latest.current.onShapeChange;
    if (!from) {
      Object.assign(box.style, {
        width: `${target.width}px`,
        height: `${target.height}px`,
        borderRadius: `${surfaceRadius(target.height)}px`,
      });
      report?.({ from: null, to: target, phase: 'end' });
      return;
    }
    report?.({ from, to: target, phase: 'start' });
    running.current?.stop();
    const controls = animateSurface(box, target, latest.current.tokens, latest.current.reduced);
    running.current = controls;
    void controls.then(() => {
      if (running.current !== controls) return;
      running.current = null;
      latest.current.onShapeChange?.({ from, to: target, phase: 'end' });
    });
  }, [fixedWidth, fixedHeight]);

  useLayoutEffect(() => {
    fit();
    const content = layer.current;
    if (!content || (fixedWidth && fixedHeight) || typeof ResizeObserver === 'undefined') return;
    // A label that changes length (another language, another last action) reshapes it too.
    const observer = new ResizeObserver(() => fit());
    observer.observe(content);
    return () => observer.disconnect();
  }, [contentKey, fit, fixedWidth, fixedHeight]);

  useLayoutEffect(
    () => () => {
      running.current?.stop();
    },
    [],
  );

  const register = useCallback((element: HTMLElement | null) => {
    if (element) layer.current = element;
  }, []);

  return (
    <motion.div
      className={`ilot ${className}`.trim()}
      style={{ transformOrigin: `${originX} ${origin}` }}
      {...presence}
      {...data}
    >
      <div ref={shape} className="ilot-shape" data-ilot-shape="">
        <div className="shape-clip">
          <AnimatePresence initial={false}>
            <Layer key={contentKey} register={register}>
              {children}
            </Layer>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

// One content layer. Leaving, it keeps its place while it fades, out of reach of the pointer,
// the keyboard and assistive technologies (Surface.jsx:116-123).
function Layer({ register, children }: { register: (element: HTMLElement | null) => void; children: ReactNode }) {
  const present = useIsPresent();
  const fade = useContentPresence();
  return (
    <motion.div
      ref={present ? register : undefined}
      className={present ? 'shape-layer' : 'shape-layer is-leaving'}
      aria-hidden={present ? undefined : true}
      inert={!present}
      {...fade}
    >
      {children}
    </motion.div>
  );
}
