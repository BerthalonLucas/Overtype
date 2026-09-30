// A Windows 11 window at real size on the <Stage>. Title bar (32 px) overlays the content, so
// the content decides what sits under it (the Réglages sidebar runs to the top, like Windows
// Settings). The content gets --ft-titlebar-h to pad itself.
//
//   <AnimatePresence>{open && (
//     <AppWindow key="settings" title="Réglages" width={860} height={600} onClose={…}>…</AppWindow>
//   )}</AnimatePresence>
//
// material: 'solid' (window of the direction) | 'frost' (the setup: frosted window over a sharp
// desktop — only the window is blurred, Lucas 29/09).
// x / y: desktop pixels of the top-left corner; default = centred in the work area.
import { forwardRef } from 'react';
import { motion } from 'motion/react';
import { Minus, Square, X } from 'lucide-react';
import { useDesktop, AppMark } from './Desktop.jsx';
import { useTx } from '../lib/motion.js';
import { appName } from '../brand.js';

export const AppWindow = forwardRef(function AppWindow({
  title = appName, width = 860, height = 600, x, y, material = 'solid', onClose, onMinimize,
  controls = ['min', 'max', 'close'], showTitle = true, zIndex = 10, className = '', children, style,
  initial, animate, exit, transition, ...rest
}, ref) {
  const { W, workArea } = useDesktop();
  const tx = useTx();
  const left = x ?? Math.round((W - width) / 2);
  const top = y ?? Math.max(12, Math.round((workArea.h - height) / 2));
  return (
    <motion.div
      ref={ref}
      className={`ft-window ${className}`}
      data-material={material}
      role="dialog" aria-label={title}
      style={{ left, top, width, height, zIndex, '--ft-titlebar-h': '32px', ...style }}
      initial={initial ?? { opacity: 0, scale: 0.96, y: 10 }}
      animate={animate ?? { opacity: 1, scale: 1, y: 0 }}
      exit={exit ?? { opacity: 0, scale: 0.97, y: 4, transition: tx({ duration: 0.16, ease: 'out' }) }}
      transition={transition ?? tx('window')}
      {...rest}
    >
      <div className="ft-window-body">{children}</div>
      <div className="ft-titlebar">
        {showTitle && <span className="ft-titlebar-title"><AppMark size={16} /><span>{title}</span></span>}
        <span className="ft-caption">
          {controls.includes('min') && <button type="button" className="ft-caption-btn" aria-label="Réduire" tabIndex={-1} onClick={onMinimize}><Minus size={16} strokeWidth={1} /></button>}
          {controls.includes('max') && <button type="button" className="ft-caption-btn" aria-label="Agrandir" tabIndex={-1} disabled><Square size={12} strokeWidth={1.25} /></button>}
          {controls.includes('close') && <button type="button" className="ft-caption-btn ft-caption-close" aria-label="Fermer" onClick={onClose}><X size={16} strokeWidth={1} /></button>}
        </span>
      </div>
    </motion.div>
  );
});
