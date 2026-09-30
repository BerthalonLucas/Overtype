// 👍 / 👎 on any showcased variant, plus an optional note. Feeds « Copier mes choix ».
//   <Vote id="settings.sidebar.tiles" label="Barre latérale à tuiles colorées" />
// id: '<area>.<thing>[.<variant>]' — area = journey | demo | settings | catalog | effects | shell.
// The label is what Lucas reads in the copied summary: make it say what the variant IS.
import { useState } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { ThumbsUp, ThumbsDown, MessageSquareText } from 'lucide-react';
import { useLab } from './store.jsx';
import { usePortalContainer } from './Scope.jsx';

export function Vote({ id, label, section, note = true, className = '', compact }) {
  const lab = useLab();
  const current = lab.votes[id]?.v;
  const text = lab.notes[id] || '';
  const [open, setOpen] = useState(false);
  const container = usePortalContainer();
  const meta = { label, section };
  return (
    <span className={`lab-vote ${className}`} data-compact={compact ? '' : undefined} role="group" aria-label={`Votre avis : ${label}`}>
      <button type="button" className="lab-vote-btn" data-kind="up" aria-pressed={current === 'up'} title="J’aime" aria-label={`J’aime : ${label}`}
        onClick={() => lab.vote(id, 'up', meta)}>
        <ThumbsUp size={14} strokeWidth={1.75} />
      </button>
      <button type="button" className="lab-vote-btn" data-kind="down" aria-pressed={current === 'down'} title="Je n’aime pas" aria-label={`Je n’aime pas : ${label}`}
        onClick={() => lab.vote(id, 'down', meta)}>
        <ThumbsDown size={14} strokeWidth={1.75} />
      </button>
      {note && (
        <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
          <PopoverPrimitive.Trigger asChild>
            <button type="button" className="lab-vote-btn" data-kind="note" data-has-note={text ? '' : undefined} title="Ajouter une remarque" aria-label={`Remarque : ${label}`}>
              <MessageSquareText size={14} strokeWidth={1.75} />
            </button>
          </PopoverPrimitive.Trigger>
          <PopoverPrimitive.Portal container={container}>
            <PopoverPrimitive.Content className="lab-pop" sideOffset={6} align="end">
              <label className="lab-pop-label" htmlFor={`note-${id}`}>Remarque sur « {label} »</label>
              <textarea id={`note-${id}`} className="lab-textarea" rows={3} value={text} placeholder="Ce qui vous plaît ou pas, en une phrase."
                onChange={e => lab.note(id, e.target.value)} autoFocus />
            </PopoverPrimitive.Content>
          </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
      )}
    </span>
  );
}

// A labelled frame around a variant, with its vote in the corner. For galleries.
export function Variant({ id, label, description, section, children, className = '' }) {
  return (
    <figure className={`lab-variant ${className}`}>
      <figcaption className="lab-variant-head">
        <span><strong>{label}</strong>{description && <small>{description}</small>}</span>
        <Vote id={id} label={label} section={section} />
      </figcaption>
      <div className="lab-variant-body">{children}</div>
    </figure>
  );
}
