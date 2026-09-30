// HeroUI v3 (@heroui/react) in the lab. Its CSS is compiled by build.mjs WITHOUT Tailwind's
// preflight and every selector is scoped under .heroui-scope (scripts/scope-css.mjs), so HeroUI
// can only style what sits inside a <HeroScope>. Its overlays (popover, select, modal…) portal
// into a .heroui-scope host thanks to <HeroPortal> (react-aria's UNSAFE_PortalProvider).
//
//   <HeroScope>              → HeroUI's own look, light/dark from the lab theme
//   <HeroScope themed>       → HeroUI mapped onto our tokens (accent, surfaces, radius)
import { useState } from 'react';
import { UNSAFE_PortalProvider } from 'react-aria';
import { Button, Chip, Switch as HeroSwitch } from '@heroui/react';
import { Sparkles } from 'lucide-react';
import { useScope } from '../lab/Scope.jsx';
import './heroui-bridge.css';

export function HeroScope({ themed = false, className = '', children }) {
  const { theme } = useScope();
  return <div className={`heroui-scope ${themed ? 'ft-heroui-themed' : ''} ${className}`} data-theme={theme}>{children}</div>;
}

// Wraps the lab once (App.jsx): gives HeroUI overlays a scoped container.
export function HeroPortal({ children }) {
  const [host, setHost] = useState(null);
  const { theme } = useScope();
  return (
    <UNSAFE_PortalProvider getContainer={() => host ?? document.body}>
      {children}
      <div ref={setHost} className="heroui-scope ft-heroui-portal" data-theme={theme} />
    </UNSAFE_PortalProvider>
  );
}

// Proof that HeroUI bundles into the static page (build.mjs) and renders.
export function HeroButtonProof() {
  const [count, setCount] = useState(0);
  const [on, setOn] = useState(true);
  return (
    <div className="ft-hero-proof">
      <HeroScope>
        <div className="ft-hero-row">
          <Button variant="primary" onPress={() => setCount(c => c + 1)}><Sparkles size={16} strokeWidth={1.5} />HeroUI · {count}</Button>
          <Button variant="secondary">Secondaire</Button>
          <Button variant="ghost">Discret</Button>
          <Chip>Chip</Chip>
        </div>
      </HeroScope>
      <HeroScope themed>
        <div className="ft-hero-row">
          <Button variant="primary" onPress={() => setCount(c => c + 1)}><Sparkles size={16} strokeWidth={1.5} />Nos couleurs · {count}</Button>
          <Button variant="secondary">Secondaire</Button>
          <Button variant="outline">Contour</Button>
          <HeroSwitch isSelected={on} onChange={setOn} aria-label="Interrupteur HeroUI">
            <HeroSwitch.Control><HeroSwitch.Thumb /></HeroSwitch.Control>
          </HeroSwitch>
        </div>
      </HeroScope>
    </div>
  );
}
