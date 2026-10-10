import { animate } from 'motion';
import { toMotionSpring } from './spring';
import { curveTransition, reducedFade, surfaceMove, type MotionTokens } from './tokens';

// A surface that changes shape (lots 7-9: menu → pill) inside the reserved window (plan §4.3):
// width, height and radius follow the spring on the element itself, never Motion's `layout`
// (a scale, which would squash the text and icons). Its content sits on a `.shape-layer`
// (src/glass.css), centred at its natural size, so it stays centred while the shape changes.
// Nothing native moves meanwhile: hit-test regions are published at the end (and at the start
// on the larger of the two shapes).

export type SurfaceShape = { width: number; height: number; borderRadius?: number };

// Surface.jsx:70 — a pill (44 px or less) is fully round, anything taller has the 16 px radius.
export const surfaceCornerRadius = 16;
export function surfaceRadius(height: number): number {
  return height <= 44 ? height / 2 : surfaceCornerRadius;
}

// MotionConfig's reducedMotion never reaches an imperative animate() nor width/height/radius,
// so the reduced case is handled here: the shape is set at once. An instant Motion animation
// still replaces a spring in flight, but only writes on its next frame: the style is written
// now as well.
export function animateSurface(
  element: HTMLElement,
  shape: SurfaceShape,
  tokens: MotionTokens,
  reduced: boolean,
  spring: 'morph' | 'enter' = 'morph',
) {
  const target = {
    width: `${shape.width}px`,
    height: `${shape.height}px`,
    borderRadius: `${shape.borderRadius ?? surfaceRadius(shape.height)}px`,
  };
  if (!reduced) return animate(element, target, toMotionSpring(tokens[spring]));
  const controls = animate(element, target, { duration: 0 });
  Object.assign(element.style, target);
  return controls;
}

// The Îlot's corner moves (a translation only) in the reserved window:
//   'morph'    with a shape that changes, on the same spring: the slide right when a shape wider
//              than the room left of the selection's end would leave the work area (lot 10's error
//              pill near the screen's left edge; src/layout.ts ilotShift);
//   'move'     the pill going to its place under the new text after Rust's paste (lot 9): the
//              lab's own move of a surface, a 420 ms curve (design-lab/src/app.css:149, tokens
//              surfaceMove), not the morph spring;
//   'instant'  the first shape, a place taken while the pill is faded out.
// Reduced motion sets it at once (no movement, plan §9).
export type CornerOffset = { x: number; y: number };
export type CornerMove = 'morph' | 'move' | 'instant';
export function animateCorner(
  element: HTMLElement,
  to: CornerOffset,
  tokens: MotionTokens,
  reduced: boolean,
  how: CornerMove = 'morph',
) {
  if (!reduced && how !== 'instant')
    return animate(
      element,
      { x: to.x, y: to.y },
      how === 'morph' ? toMotionSpring(tokens.morph) : curveTransition(surfaceMove),
    );
  const controls = animate(element, { x: to.x, y: to.y }, { duration: 0 });
  element.style.transform = to.x || to.y ? `translateX(${to.x}px) translateY(${to.y}px)` : 'none';
  return controls;
}

// The corner fades out before the window moves under it (lot 9, `move_overlay`: never while
// anything animates) and back in at its place: the exit and content curves, or the reduced fade.
export function fadeCorner(element: HTMLElement, visible: boolean, tokens: MotionTokens, reduced: boolean) {
  return animate(
    element,
    { opacity: visible ? 1 : 0 },
    reduced ? reducedFade : curveTransition(visible ? tokens.content : tokens.exit),
  );
}
