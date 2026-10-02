// A themed scope: the element that carries data-ft-palette (neutral base) / data-ft-pageset /
// data-ft-theme, so every --ft-* token below it resolves. The lab root is one; nest another to show
// a different combination side by side:
//   <Scope base="papier" theme="dark" pageSet="B">…</Scope>
// `page` puts data-ft-page on the scope itself (its --ft-page… colours); any element below can
// also carry data-ft-page="<id>" to take that page's colour.
// Popovers (Radix / cmdk / HeroUI) must render inside a scope to get the tokens: each Scope has
// a portal host, and the ui/ primitives portal into the nearest one (usePortalContainer()).
// Do not put a Scope with its own portal host INSIDE the scaled stage (a CSS transform breaks
// fixed positioning of popovers): pass portal={false} there, popovers then use the root host.
import { createContext, useContext, useState } from 'react';
import { useLab } from './store.jsx';

const PortalContext = createContext(null);
const ScopeContext = createContext(null);

export function Scope({ base, palette, pageSet, switchStyle, theme, reduced, page, portal = true, className = '', style, children, direction: _ignored, ...rest }) {
  const lab = useLab();
  const parent = useContext(ScopeContext);
  const parentHost = useContext(PortalContext);
  const pal = base ?? palette ?? parent?.base ?? lab.base;
  const set = pageSet ?? parent?.pageSet ?? lab.pageSet;
  const sw = switchStyle ?? parent?.switchStyle ?? lab.switchStyle;
  const th = theme === 'system' || theme == null ? (parent?.theme ?? lab.resolvedTheme) : theme;
  const red = reduced ?? parent?.reduced ?? lab.reduced;
  const [host, setHost] = useState(null);
  const value = { base: pal, palette: pal, pageSet: set, switchStyle: sw, theme: th, reduced: red, direction: 'verre' };
  return (
    <div
      className={`ft-scope ${className}`}
      data-ft-dir="verre" data-ft-palette={pal} data-ft-pageset={set} data-ft-theme={th} data-ft-reduced={red ? 'true' : 'false'}
      data-ft-page={page}
      style={style}
      {...rest}
    >
      <ScopeContext.Provider value={value}>
        <PortalContext.Provider value={portal ? host : parentHost}>{children}</PortalContext.Provider>
      </ScopeContext.Provider>
      {portal && <div ref={setHost} className="ft-portal-host" />}
    </div>
  );
}

// The nearest scope's portal host (undefined before mount → Radix falls back to document.body).
export function usePortalContainer() { return useContext(PortalContext) ?? undefined; }
// The effective { base, pageSet, switchStyle, theme, reduced } where a component renders
// (+ palette = base and direction = 'verre' for v1 code).
export function useScope() {
  const lab = useLab();
  return useContext(ScopeContext) ?? { base: lab.base, palette: lab.base, pageSet: lab.pageSet, switchStyle: lab.switchStyle, theme: lab.resolvedTheme, reduced: lab.reduced, direction: 'verre' };
}
