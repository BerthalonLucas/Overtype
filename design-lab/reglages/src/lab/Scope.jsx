// A themed scope: the element that carries data-ft-dir / data-ft-palette / data-ft-theme, so
// every --ft-* token below it resolves. The lab root is one; nest another to show a different
// combination side by side (e.g. the same card in the 3 directions):
//   <Scope direction="mat" palette="papier" theme="dark">…</Scope>
// Popovers (Radix / cmdk / HeroUI) must render inside a scope to get the tokens: each Scope has
// a portal host, and the ui/ primitives portal into the nearest one (usePortalContainer()).
// Do not put a Scope with its own portal host INSIDE the scaled stage (a CSS transform breaks
// fixed positioning of popovers): pass portal={false} there, popovers then use the root host.
import { createContext, useContext, useState } from 'react';
import { useLab } from './store.jsx';

const PortalContext = createContext(null);
const ScopeContext = createContext(null);

export function Scope({ direction, palette, theme, reduced, portal = true, className = '', style, children, ...rest }) {
  const lab = useLab();
  const parent = useContext(ScopeContext);
  const parentHost = useContext(PortalContext);
  const dir = direction ?? parent?.direction ?? lab.direction;
  const pal = palette ?? parent?.palette ?? lab.palette;
  const th = theme === 'system' || theme == null ? (parent?.theme ?? lab.resolvedTheme) : theme;
  const red = reduced ?? parent?.reduced ?? lab.reduced;
  const [host, setHost] = useState(null);
  const value = { direction: dir, palette: pal, theme: th, reduced: red };
  return (
    <div
      className={`ft-scope ${className}`}
      data-ft-dir={dir} data-ft-palette={pal} data-ft-theme={th} data-ft-reduced={red ? 'true' : 'false'}
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
// The effective { direction, palette, theme, reduced } where a component renders.
export function useScope() {
  const lab = useLab();
  return useContext(ScopeContext) ?? { direction: lab.direction, palette: lab.palette, theme: lab.resolvedTheme, reduced: lab.reduced };
}
