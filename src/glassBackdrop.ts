import { cancelFrame, frame } from 'motion';
import { bridge } from './bridge';

// The real glass of 0.6 (docs/VERRE-0.6.md, src-tauri/src/backdrop.rs). A WebView cannot blur
// what is behind its window: Windows' compositor does, under the transparent page, and it has
// to know where the glass is. This tracker is the page's side: on every frame it measures the
// glass surfaces as they are painted right now (their box after every transform, the radius of
// their corners, the opacity they show with) and, when anything changed, sends the list
// (`glass_frame`). Rust mirrors it; nothing else moves the native glass. So whatever a surface
// does (enter, morph, slide, fade, leave, be interrupted halfway), the blur follows the same
// box, and a surface that is gone takes its blur with it.
//
// The answer says whether the real glass shows. `data-backdrop="glass"` on <html> then lets
// the surfaces through (src/theme.css: the light tint instead of the dense paint); with any
// other answer, or none, the painted material stays: it is the CSS default.

export type GlassShape = { x: number; y: number; width: number; height: number; radius: number; opacity: number };

// The surfaces of the overlay that are glass: the list of the `data-backdrop="glass"` rule of
// src/theme.css (src/glassBackdrop.test.ts keeps the two in step).
export const overlayGlassSurfaces = [
  '.translation-bubble',
  '.wait-pill',
  '.working-pill',
  '.action-pill',
  '.more-menu',
  '.notice-pill',
  '.compact-feedback',
  '.ilot-shape',
];
// The setup window: natively the page is the window.
export const setupGlassSurfaces = ['.su-desk[data-native] .su-window'];

// Unchanged shapes are sent again this often while a surface shows: a lost message, a window
// shown again or Windows' transparency switched meanwhile is caught up within it.
const HEARTBEAT_MS = 250;
// What the page paints reaches the screen about one frame after what the compositor is told
// (measured in the real window at 60 Hz, frame by frame: sent at once, the blur ran one frame
// ahead of the surface and showed beyond its rim while it grew). So a shape measured on one
// frame is sent on the next, and only as far as the surface still covers it then: what is
// sent is the part common to the two frames (`overlap`). The blur thus never shows outside
// the surface, growing or shrinking, even when a message or a paint is one frame late; where
// the two differ, a thin band inside the rim has the tint without the blur for one frame.

const round = (value: number) => Math.round(value * 100) / 100;

// A computed corner radius (`22px`, `50%`) in pixels of a box of this layout size.
export function cornerRadius(computed: string, width: number, height: number): number {
  const first = computed.trim().split(/\s+/)[0] ?? '';
  const value = Number.parseFloat(first);
  if (!Number.isFinite(value) || value <= 0) return 0;
  const pixels = first.endsWith('%') ? (Math.min(width, height) * value) / 100 : value;
  return Math.min(pixels, Math.min(width, height) / 2);
}

// The part of a surface common to two successive frames, or null when they share nothing: the
// rectangle inside both, the rounder of the two corners, the fainter of the two opacities.
export function overlap(before: GlassShape, now: GlassShape): GlassShape | null {
  const x = Math.max(before.x, now.x),
    y = Math.max(before.y, now.y);
  const width = round(Math.min(before.x + before.width, now.x + now.width) - x),
    height = round(Math.min(before.y + before.height, now.y + now.height) - y);
  if (!(width >= 1) || !(height >= 1)) return null;
  return {
    x,
    y,
    width,
    height,
    radius: Math.min(Math.max(before.radius, now.radius), Math.min(width, height) / 2),
    opacity: Math.min(before.opacity, now.opacity),
  };
}

// One surface as it shows now, or null when nothing of it does.
export function measureGlass(element: HTMLElement): GlassShape | null {
  const box = element.getBoundingClientRect();
  if (!(box.width >= 1) || !(box.height >= 1)) return null;
  const style = getComputedStyle(element);
  if (style.visibility === 'hidden' || style.display === 'none') return null;
  // The opacity a pixel of it gets: its own and that of every ancestor (the entrance fades the
  // surface's wrapper, the corner fades before a move).
  let opacity = 1;
  for (let node: Element | null = element; node && node !== document.documentElement; node = node.parentElement) {
    const own = Number.parseFloat(node === element ? style.opacity : getComputedStyle(node).opacity);
    if (Number.isFinite(own)) opacity *= own;
  }
  if (!(opacity > 0.004)) return null;
  // The radius is written for the layout box; an entrance scales the whole surface with it.
  const width = element.offsetWidth || box.width,
    height = element.offsetHeight || box.height;
  const scale = Math.min(box.width / width, box.height / height);
  const radius =
    cornerRadius(style.borderTopLeftRadius, width, height) * (Number.isFinite(scale) && scale > 0 ? scale : 1);
  return {
    x: round(box.left),
    y: round(box.top),
    width: round(box.width),
    height: round(box.height),
    radius: round(Math.min(radius, Math.min(box.width, box.height) / 2)),
    opacity: round(Math.min(1, opacity)),
  };
}

// Starts the tracker for this page's window; returns how to stop it. `fallback`: the value of
// `data-backdrop` when the real glass does not show (null removes the attribute).
export function startGlassBackdrop(surfaces: string[], fallback: string | null = null): () => void {
  const selector = surfaces.join(', ');
  const root = document.documentElement;
  // Numbered across reloads of the page, so Rust can drop a message that arrives late.
  let seq = Date.now() * 1000;
  let sent = '';
  let sentAt = -Infinity;
  let stopped = false;
  let before = new Map<HTMLElement, GlassShape>();

  const show = (real: boolean) => {
    if (stopped) return;
    if (real) root.setAttribute('data-backdrop', 'glass');
    else if (fallback === null) root.removeAttribute('data-backdrop');
    else root.setAttribute('data-backdrop', fallback);
  };
  // After Motion's own writes of the frame (its `postRender` step, kept alive): the springs
  // that drive width, height and radius from JavaScript have set this frame's values, so what
  // is measured is what the page paints next. A plain requestAnimationFrame could run before
  // them and send the shape of the frame before.
  const tick = () => {
    if (stopped) return;
    const now = performance.now();
    const measured = new Map<HTMLElement, GlassShape>();
    const shapes: GlassShape[] = [];
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      const shape = measureGlass(element);
      if (!shape) continue;
      measured.set(element, shape);
      // Sent only once it has been there for two frames, and only what both frames share.
      const earlier = before.get(element);
      const common = earlier && overlap(earlier, shape);
      if (common) shapes.push(common);
    }
    before = measured;
    const key = `${window.devicePixelRatio}|${JSON.stringify(shapes)}`;
    if (key === sent && (shapes.length === 0 || now - sentAt < HEARTBEAT_MS)) return;
    sent = key;
    sentAt = now;
    seq += 1;
    bridge.glassFrame(seq, window.devicePixelRatio, shapes).then(show, () => show(false));
  };
  frame.postRender(tick, true);
  return () => {
    stopped = true;
    cancelFrame(tick);
  };
}
