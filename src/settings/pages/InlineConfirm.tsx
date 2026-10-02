import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from '../../components/controls';
import { useTx } from '../../components/motion';

// An inline confirmation under a row (no modal): what will happen, then the two choices. « Keep »
// comes first and takes the focus; Escape keeps too, wherever the focus went (a double click on
// the trigger leaves it on the page); on close the focus goes back to the row's own button.
export function InlineConfirm({ open, text, confirm, keep, onConfirm, onKeep, busy = false }: {
  open: boolean; text: string; confirm: string; keep: string; onConfirm: () => void; onKeep: () => void; busy?: boolean;
}) {
  const tx = useTx();
  const box = useRef<HTMLDivElement>(null);
  const keepAndReturn = () => {
    const trigger = box.current?.closest('.ft-row, .ft-group')?.querySelector<HTMLButtonElement>('.ft-row-control button, .ft-group-heading button');
    onKeep();
    requestAnimationFrame(() => requestAnimationFrame(() => { if (trigger?.isConnected && !trigger.disabled) trigger.focus(); }));
  };
  const latest = useRef({ keepAndReturn, busy });
  latest.current = { keepAndReturn, busy };
  useEffect(() => {
    if (!open) return undefined;
    const frame = requestAnimationFrame(() => box.current?.querySelector('button')?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || latest.current.busy) return;
      if (document.querySelector('[data-radix-popper-content-wrapper], .ft-dialog, [data-recording]')) return;
      event.preventDefault(); event.stopPropagation(); latest.current.keepAndReturn();
    };
    window.addEventListener('keydown', onKey, true);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('keydown', onKey, true); };
  }, [open]);
  return <AnimatePresence initial={false}>
    {open && <motion.div className="st-confirm-wrap" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={tx('smooth')}>
      <div ref={box} className="st-confirm" role="alertdialog" aria-label={confirm}>
        <p>{text}</p>
        <div className="st-confirm-actions">
          <Button size="sm" onClick={keepAndReturn} disabled={busy}>{keep}</Button>
          <Button size="sm" className="st-danger-solid" onClick={onConfirm} busy={busy}>{confirm}</Button>
        </div>
      </div>
    </motion.div>}
  </AnimatePresence>;
}
