import type { CSSProperties } from 'react';
import './window.css';

// The app's mark: the Îlot's iridescent dot on a small dark rounded square
// (design-lab/reglages/src/stage/Desktop.jsx). Wrap it in .ft-heartbeat for the welcome's beat.
export function AppMark({ size = 16, className = '' }: { size?: number; className?: string }) {
  return <span className={`ft-appmark ${className}`} style={{ '--s': `${size}px` } as CSSProperties} aria-hidden="true"><i /></span>;
}
