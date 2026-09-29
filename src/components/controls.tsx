import { forwardRef, useId, useState, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as SelectPrimitive from '@radix-ui/react-select';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { Command } from 'cmdk';
import { Check, ChevronDown, Eye, EyeOff, LoaderCircle, Search } from 'lucide-react';
import './controls.css';

// The settings and the setup share these controls. Each one is a known primitive (Radix, cmdk)
// styled by controls.css: geometry comes from the CSS (sizes, gaps, place-items), never from a
// pixel offset written in the component, so what is round stays centred in its shape.

type ButtonProps = ComponentPropsWithoutRef<'button'> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'lg';
  icon?: ReactNode;
  busy?: boolean;
};
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'secondary', size = 'md', icon, busy, children, className = '', disabled, ...props }, ref) {
  return <button ref={ref} type="button" className={`ui-button ${className}`} data-variant={variant} data-size={size} disabled={disabled || busy} aria-busy={busy || undefined} {...props}>
    {busy ? <LoaderCircle className="ui-spin" size={16} strokeWidth={1.75} aria-hidden="true" /> : icon}
    {children !== undefined && <span>{children}</span>}
  </button>;
});

// A square button holding one icon; its label is the accessible name and the tooltip.
export const IconOnlyButton = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<'button'> & { label: string }>(function IconOnlyButton({ label, className = '', children, ...props }, ref) {
  return <button ref={ref} type="button" className={`ui-icon-button ${className}`} aria-label={label} title={label} {...props}>{children}</button>;
});

// Windows 11 toggle on Radix Switch: the thumb travels by the CSS (translate from data-state).
export function Switch({ label, checked, onCheckedChange, disabled, id }: { label?: string; checked: boolean; onCheckedChange: (checked: boolean) => void; disabled?: boolean; id?: string }) {
  return <SwitchPrimitive.Root id={id} className="ui-switch" checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} aria-label={label}>
    <SwitchPrimitive.Thumb className="ui-switch-thumb" />
  </SwitchPrimitive.Root>;
}

export type Option<T extends string> = { value: T; label: string; hint?: string };
export function Select<T extends string>({ label, value, options, onChange, disabled, placeholder, width }: {
  label: string; value: T | undefined; options: Array<Option<T>>; onChange: (value: T) => void; disabled?: boolean; placeholder?: string; width?: number;
}) {
  return <SelectPrimitive.Root value={value} onValueChange={next => onChange(next as T)} disabled={disabled}>
    <SelectPrimitive.Trigger className="ui-select-trigger" aria-label={label} style={width ? { width } : undefined}>
      <SelectPrimitive.Value placeholder={placeholder} />
      <SelectPrimitive.Icon className="ui-select-icon"><ChevronDown size={16} strokeWidth={1.75} /></SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content className="ui-popover ui-select-content" position="popper" sideOffset={4}>
        <SelectPrimitive.Viewport className="ui-select-viewport">
          {options.map(option => <SelectPrimitive.Item key={option.value} value={option.value} className="ui-option">
            <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
            <SelectPrimitive.ItemIndicator className="ui-option-check"><Check size={15} strokeWidth={2} /></SelectPrimitive.ItemIndicator>
          </SelectPrimitive.Item>)}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  </SelectPrimitive.Root>;
}

// A searchable list in a popover (cmdk inside Radix Popover): the model picker.
export function Combobox({ label, value, options, onChange, disabled, placeholder, searchPlaceholder, empty, loading, id }: {
  label: string; value: string; options: Array<{ value: string; label: string; hint?: string }>; onChange: (value: string) => void;
  disabled?: boolean; placeholder: string; searchPlaceholder: string; empty: string; loading?: boolean; id?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find(option => option.value === value);
  return <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
    <PopoverPrimitive.Trigger asChild disabled={disabled}>
      <button id={id} type="button" className="ui-select-trigger ui-combobox-trigger" role="combobox" aria-expanded={open} aria-label={label} data-placeholder={current || value ? undefined : ''}>
        <span className="ui-combobox-value">{current?.label ?? (value || placeholder)}</span>
        {loading ? <LoaderCircle className="ui-spin ui-select-icon" size={16} strokeWidth={1.75} aria-hidden="true" /> : <ChevronDown className="ui-select-icon" size={16} strokeWidth={1.75} aria-hidden="true" />}
      </button>
    </PopoverPrimitive.Trigger>
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content className="ui-popover ui-combobox-content" align="start" sideOffset={4}>
        <Command label={label} className="ui-command">
          <div className="ui-command-search"><Search size={15} strokeWidth={1.75} aria-hidden="true" /><Command.Input placeholder={searchPlaceholder} /></div>
          <Command.List className="ui-command-list">
            <Command.Empty className="ui-command-empty">{empty}</Command.Empty>
            {options.map(option => <Command.Item key={option.value} value={option.value} keywords={[option.label]} className="ui-option" onSelect={() => { onChange(option.value); setOpen(false); }}>
              <span className="ui-option-text"><span>{option.label}</span>{option.hint && <small>{option.hint}</small>}</span>
              {option.value === value && <Check className="ui-option-check" size={15} strokeWidth={2} aria-hidden="true" />}
            </Command.Item>)}
          </Command.List>
        </Command>
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  </PopoverPrimitive.Root>;
}

export function Slider({ label, value, min, max, step = 1, onChange, format }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void; format: (value: number) => string }) {
  return <span className="ui-slider-control">
    <SliderPrimitive.Root className="ui-slider" value={[value]} min={min} max={max} step={step} onValueChange={([next]) => onChange(next)}>
      <SliderPrimitive.Track className="ui-slider-track"><SliderPrimitive.Range className="ui-slider-range" /></SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="ui-slider-thumb" aria-label={label} aria-valuetext={format(value)} />
    </SliderPrimitive.Root>
    <output aria-hidden="true">{format(value)}</output>
  </span>;
}

// Label, field, then one line under it: the hint, or the problem when there is one.
export function Field({ label, hint, problem, children, htmlFor, aside }: { label: string; hint?: ReactNode; problem?: ReactNode; children: ReactNode; htmlFor: string; aside?: ReactNode }) {
  return <div className="ui-field" data-invalid={problem ? '' : undefined}>
    <div className="ui-field-label"><label htmlFor={htmlFor}>{label}</label>{aside}</div>
    {children}
    {problem ? <p className="ui-field-problem" role="alert">{problem}</p> : hint ? <p className="ui-field-hint">{hint}</p> : null}
  </div>;
}

export const TextInput = forwardRef<HTMLInputElement, ComponentPropsWithoutRef<'input'>>(function TextInput({ className = '', ...props }, ref) {
  return <input ref={ref} className={`ui-input ${className}`} spellCheck={false} autoComplete="off" {...props} />;
});

// A key field: masked by default, an eye to show it, and what protects it on the right.
export function SecretInput({ id, value, onChange, placeholder, showLabel, hideLabel, note }: { id: string; value: string; onChange: (value: string) => void; placeholder?: string; showLabel: string; hideLabel: string; note?: string }) {
  const [shown, setShown] = useState(false);
  return <div className="ui-secret">
    <input id={id} className="ui-input" type={shown ? 'text' : 'password'} autoComplete="new-password" spellCheck={false} value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} />
    {note && <span className="ui-secret-note" aria-hidden="true">{note}</span>}
    <IconOnlyButton label={shown ? hideLabel : showLabel} onClick={() => setShown(!shown)} className="ui-secret-eye">{shown ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}</IconOnlyButton>
  </div>;
}

export function useFieldId(prefix: string) { return `${prefix}-${useId().replace(/:/g, '')}`; }

// A grouped list in the Windows 11 manner: rows share one card, split by hairlines.
export function Group({ title, description, children, action }: { title?: string; description?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return <section className="ui-group">
    {(title || action) && <div className="ui-group-heading"><div>{title && <h2>{title}</h2>}{description && <p>{description}</p>}</div>{action}</div>}
    <div className="ui-group-card">{children}</div>
  </section>;
}

export function Row({ title, description, control, children, id, stack }: { title: ReactNode; description?: ReactNode; control?: ReactNode; children?: ReactNode; id?: string; stack?: boolean }) {
  return <div className="ui-row" data-field={id} data-stack={stack ? '' : undefined}>
    <div className="ui-row-main">
      <div className="ui-row-copy"><strong>{title}</strong>{description && <small>{description}</small>}</div>
      {control && <div className="ui-row-control">{control}</div>}
    </div>
    {children}
  </div>;
}

// Status dot + text; state picks the colour.
export function StatusDot({ state, children }: { state: 'ok' | 'error' | 'pending' | 'idle' | 'running'; children?: ReactNode }) {
  return <span className="ui-status" data-state={state}><i aria-hidden="true" />{children}</span>;
}
