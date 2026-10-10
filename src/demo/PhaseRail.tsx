import { AnimatePresence, motion } from 'motion/react';
import { useT, type MessageKey } from '../i18n';
import { PHASE_BEAT_MS, phaseIds, type PhaseId } from './script';

// The phases, told apart (Lucas, 01/10): a caption « n / 7 · what happens » above the scene, and a
// frieze of seven numbered segments in the controls. The segments before the current one are full,
// the current one fills from 0 to 1 while its phase plays, the others wait. Each change of phase
// is a beat: the caption fades out, then the next one fades in.

const captionKey = (id: PhaseId) => `demo2.phase.${id}` as MessageKey;
const shortKey = (id: PhaseId) => `demo2.short.${id}` as MessageKey;

export function PhaseCaption({ index, hidden }: { index: number; hidden?: boolean }) {
  const t = useT();
  const id = phaseIds[index];
  return (
    <div className="dm-caption-wrap" aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        {!hidden && (
          <motion.div
            key={id}
            className="dm-caption ft-glass"
            data-phase={id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: PHASE_BEAT_MS / 2000, ease: [0.23, 1, 0.32, 1] }}
          >
            <span className="dm-caption-n">
              <b>{index + 1}</b>
              <i>/ {phaseIds.length}</i>
            </span>
            <span className="dm-caption-text">{t(captionKey(id))}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// position: phases done so far plus the share of the current one (script.ts `position`): 2.5 is
// the middle of the third phase; 7 once everything played.
export function PhaseRail({ position }: { position: number }) {
  const t = useT();
  const total = phaseIds.length;
  const current = Math.min(total - 1, Math.floor(position));
  const ended = position >= total;
  return (
    <ol className="dm-phases" aria-label={t('demo2.phases')}>
      {phaseIds.map((id, index) => {
        const state = ended || index < current ? 'done' : index === current ? 'current' : 'todo';
        const fill = state === 'done' ? 1 : state === 'current' ? Math.min(1, Math.max(0, position - index)) : 0;
        return (
          <li
            key={id}
            className="dm-phase"
            data-phase={id}
            data-state={state}
            aria-current={state === 'current' ? 'step' : undefined}
            aria-label={t('demo2.phaseOf', { n: index + 1, total, name: t(shortKey(id)) })}
          >
            <span className="dm-phase-bar" aria-hidden="true">
              <i style={{ transform: `scaleX(${fill.toFixed(4)})` }} />
            </span>
            <span className="dm-phase-name" aria-hidden="true">
              <b>{index + 1}</b>
              {t(shortKey(id))}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
