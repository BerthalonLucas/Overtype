import { bridge } from '../bridge';
import type { SystemMotion } from '../types';

// Whether Windows asks to reduce animations, for « Animations : suivre Windows ».
// In the app, Rust reads « Effets d'animation » (SPI_GETCLIENTAREAANIMATION) and reports each
// change: whether WebView2 passes that switch on to prefers-reduced-motion has not been
// measured, and it does not pass the app mode on to prefers-color-scheme (lot 1). The media
// query stays the answer while Rust has not answered, and in the browser preview, where the
// e2e suite and the visual references emulate it.
const reduceQuery = '(prefers-reduced-motion: reduce)';
const listeners = new Set<() => void>();
let fromWindows: boolean | null = null;
let asked = false;

function receive(value: SystemMotion | null | undefined) {
  const next = typeof value?.reduced === 'boolean' ? value.reduced : null;
  if (next === fromWindows) return;
  fromWindows = next;
  listeners.forEach((listener) => listener());
}

// Listens before asking, so that a change between the two is not lost; once per window.
function askWindows() {
  if (asked || !bridge.native) return;
  asked = true;
  void bridge.on<SystemMotion>('system-motion', receive).catch(() => undefined);
  void bridge.systemMotion().then(receive, () => undefined);
}

export function systemReducesMotion(): boolean {
  return fromWindows ?? Boolean(window.matchMedia?.(reduceQuery).matches);
}

export function subscribeSystemMotion(onChange: () => void): () => void {
  askWindows();
  listeners.add(onChange);
  const query = window.matchMedia?.(reduceQuery);
  query?.addEventListener('change', onChange);
  return () => {
    listeners.delete(onChange);
    query?.removeEventListener('change', onChange);
  };
}
