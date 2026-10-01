import type { CSSProperties, ReactNode } from 'react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { Check } from 'lucide-react';

// A row of picture choices (Radix ToggleGroup, single): one card per option, a check on the
// chosen one (design-lab/reglages/src/settings/pages/Appearance.jsx).
export type Card<T extends string> = { value: T; label: string; hint?: string };
export function CardChoice<T extends string>({ label, value, onChange, options, render, columns, tall }: {
  label: string; value: T; onChange: (value: T) => void; options: Array<Card<T>>; render: (option: Card<T>, selected: boolean) => ReactNode; columns?: number; tall?: boolean;
}) {
  return <ToggleGroup.Root type="single" className="st-cards" data-tall={tall ? '' : undefined} style={{ '--cols': columns ?? options.length } as CSSProperties} aria-label={label}
    value={value} onValueChange={next => { if (next) onChange(next as T); }}>
    {options.map(option => <ToggleGroup.Item key={option.value} value={option.value} className="st-card" aria-label={option.label}>
      <span className="st-card-art" aria-hidden="true">{render(option, value === option.value)}</span>
      <span className="st-card-label">
        <span className="st-card-radio" aria-hidden="true">{value === option.value && <Check size={11} strokeWidth={3} />}</span>
        <span><strong>{option.label}</strong>{option.hint && <small>{option.hint}</small>}</span>
      </span>
    </ToggleGroup.Item>)}
  </ToggleGroup.Root>;
}
