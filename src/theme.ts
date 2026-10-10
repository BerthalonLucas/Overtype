import type { Theme } from './types';

export type ResolvedTheme = 'light' | 'dark';

// What Rust reads of the Windows app mode (src-tauri/src/system_theme.rs): the command
// `system_theme` answers `{ dark } | null` (null: the registry value is missing) and the
// event `system-theme` carries `{ dark }` each time the mode flips.
export type SystemTheme = { dark: boolean };
export type SystemThemeSource = {
  current: () => Promise<unknown>;
  listen: (handler: (payload: unknown) => void) => Promise<() => void>;
};

// « Thème : suivre Windows / clair / sombre ». The resolved theme is written as data-theme on
// <html> for the CSS tokens.
export function resolveTheme(preference: Theme, prefersDark: boolean): ResolvedTheme {
  if (preference === 'light' || preference === 'dark') return preference;
  return prefersDark ? 'dark' : 'light';
}

const systemDark = (value: unknown): boolean | null =>
  typeof value === 'object' && value !== null && typeof (value as SystemTheme).dark === 'boolean'
    ? (value as SystemTheme).dark
    : null;

// The last mode Rust reported, shared by every call in this window: a return to « follow
// Windows » starts from it instead of flashing the media query's answer.
let reported: boolean | null = null;

// Applies the theme now and follows the system while the preference is « system ».
// In the app's WebView2, prefers-color-scheme stays light whatever Windows says (measured
// on 2026-09-24: tauri-runtime-wry creates the WebView with an explicit light theme), so
// the Windows app mode comes from Rust when it answers. The media query remains the
// answer where Rust has none: the browser preview, the e2e fixture, a missing value.
export function applyTheme(
  preference: Theme,
  root: HTMLElement = document.documentElement,
  system?: SystemThemeSource,
): () => void {
  const query = window.matchMedia?.('(prefers-color-scheme: dark)');
  const update = () => {
    root.dataset.theme = resolveTheme(preference, reported ?? Boolean(query?.matches));
  };
  update();
  if (preference !== 'system') return () => undefined;
  let disposed = false;
  let heard = false;
  let unlisten: (() => void) | undefined;
  query?.addEventListener('change', update);
  if (system) {
    system
      .listen((payload) => {
        const dark = systemDark(payload);
        if (disposed || dark === null) return;
        heard = true;
        reported = dark;
        update();
      })
      .then(
        (stop) => {
          if (disposed) stop();
          else unlisten = stop;
        },
        () => undefined,
      );
    system.current().then(
      (value) => {
        const dark = systemDark(value);
        // An event that arrived meanwhile is newer than this answer.
        if (disposed || heard || dark === null) return;
        reported = dark;
        update();
      },
      () => undefined,
    );
  }
  return () => {
    disposed = true;
    query?.removeEventListener('change', update);
    unlisten?.();
  };
}
