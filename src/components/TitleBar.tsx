import type { PointerEvent, ReactNode } from 'react';
import { Minus, X } from 'lucide-react';
import { useT } from '../i18n';
import './window.css';

// The title bar of a window without native decorations: a drag strip across the top (the
// content's own controls sit above it and stay clickable) and the Windows 11 caption buttons.
// onDrag: start the native move (bridge.dragWindow / dragSettings).
export function TitleBar({
  title,
  onDrag,
  onMinimize,
  onClose,
}: {
  title?: ReactNode;
  onDrag?: () => void;
  onMinimize?: () => void;
  onClose?: () => void;
}) {
  const t = useT();
  const drag = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button === 0) onDrag?.();
  };
  return (
    <>
      <div className="ft-titlebar-drag" onPointerDown={drag} aria-hidden="true" />
      <div className="ft-titlebar">
        {title && <span className="ft-titlebar-title">{title}</span>}
        <span className="ft-caption">
          {onMinimize && (
            <button
              type="button"
              className="ft-caption-btn"
              aria-label={t('ui.minimize')}
              tabIndex={-1}
              onClick={onMinimize}
            >
              <Minus size={16} strokeWidth={1} />
            </button>
          )}
          {onClose && (
            <button
              type="button"
              className="ft-caption-btn ft-caption-close"
              aria-label={t('ui.close')}
              onClick={onClose}
            >
              <X size={16} strokeWidth={1} />
            </button>
          )}
        </span>
      </div>
    </>
  );
}
