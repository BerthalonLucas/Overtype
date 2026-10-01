import { forwardRef, useId, useLayoutEffect, useRef, useState, type ComponentPropsWithoutRef, type CSSProperties, type ReactNode } from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as SelectPrimitive from '@radix-ui/react-select';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import * as SliderPrimitive from '@radix-ui/react-slider';
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { Command } from 'cmdk';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { Check, ChevronDown, CircleAlert, CircleCheck, Eye, EyeOff, Info, LoaderCircle, Search, ShieldCheck, TriangleAlert, X } from 'lucide-react';
import { useT } from '../i18n';
import { useTx } from './motion';
import { ScrollArea } from './scroll';
import './tokens.css';
import './base.css';
import './controls.css';

// The controls of the Settings and the setup, ported from the design lab
// (design-lab/reglages/src/ui/index.jsx, Lucas's choices of 30/09): ours (Radix) for the switch,
// select, buttons, segments, notice, dialog and fields; a HeroUI-like model picker (wide, rounded,
// full ids); a shadcn-look slider. Styled by controls.css from the --ft-* tokens only. Geometry
// lives in the CSS (sizes, grid centring, calc()), never in a pixel nudge here, so every round
// glyph stays centred in its shape. What floats (popover, dialog, tooltip) is portalled into
// <body> and carries .ft-scope itself.

export const ICON = { size: 16, strokeWidth: 1.5 } as const; // Lucide, thin stroke (the Îlot's)
export const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

// ——— Buttons ———
type ButtonProps = ComponentPropsWithoutRef<'button'> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  // xl: the setup's big buttons.
  size?: 'sm' | 'md' | 'lg' | 'xl';
  icon?: ReactNode;
  iconEnd?: ReactNode;
  busy?: boolean;
  block?: boolean;
};
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'secondary', size = 'md', icon, iconEnd, busy, block, className, disabled, children, ...props }, ref) {
  return <button ref={ref} type="button" className={cx('ft-button', className)} data-variant={variant} data-size={size} data-block={block ? '' : undefined} disabled={disabled || busy} aria-busy={busy || undefined} {...props}>
    {busy ? <LoaderCircle className="ft-spin" {...ICON} aria-hidden="true" /> : icon}
    {children != null && <span className="ft-button-label">{children}</span>}
    {iconEnd}
  </button>;
});

// One icon in a square (or round) cell; label = accessible name and tooltip.
type IconButtonProps = ComponentPropsWithoutRef<'button'> & { label: string; variant?: 'ghost' | 'secondary' | 'primary'; size?: 'sm' | 'md' | 'lg'; round?: boolean };
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({ label, variant = 'ghost', size = 'md', round, className, children, ...props }, ref) {
  return <button ref={ref} type="button" className={cx('ft-icon-button', className)} data-variant={variant} data-size={size} data-round={round ? '' : undefined} aria-label={label} title={label} {...props}>{children}</button>;
});

export function Spinner({ size = 16 }: { size?: number }) { return <LoaderCircle className="ft-spin" size={size} strokeWidth={1.75} aria-hidden="true" />; }

// ——— Tooltip (Radix) ———
export function Tooltip({ content, children, side = 'top', delay = 250 }: { content: ReactNode; children: ReactNode; side?: 'top' | 'right' | 'bottom' | 'left'; delay?: number }) {
  return <TooltipPrimitive.Provider delayDuration={delay} skipDelayDuration={200}>
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content className="ft-tooltip" side={side} sideOffset={6} collisionPadding={8}>{content}</TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  </TooltipPrimitive.Provider>;
}

// ——— Switch: « Ressort Windows 11 » ———
// Radix Switch with the Windows 11 outline: the thumb grows on hover, then travels with a small
// overshoot. One fixed-size disc moved and scaled by transform only; its gap to the track is
// computed in the CSS, so it is concentric with both round ends in both states.
type SwitchProps = Omit<ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>, 'checked' | 'onCheckedChange'> & { checked: boolean; onCheckedChange: (checked: boolean) => void; label?: string };
export function Switch({ checked, onCheckedChange, label, className, ...props }: SwitchProps) {
  return <SwitchPrimitive.Root className={cx('ft-switch', className)} checked={checked} onCheckedChange={onCheckedChange} aria-label={label} {...props}>
    <SwitchPrimitive.Thumb className="ft-switch-thumb" />
  </SwitchPrimitive.Root>;
}

// ——— Select (Radix) ———
export type Option<T extends string = string> = { value: T; label: string; hint?: string; disabled?: boolean };
export function Select<T extends string>({ label, value, options, onChange, disabled, placeholder, width, id }: {
  label: string; value: T | undefined; options: Array<Option<T>>; onChange: (value: T) => void; disabled?: boolean; placeholder?: string; width?: number | string; id?: string;
}) {
  return <SelectPrimitive.Root value={value} onValueChange={next => onChange(next as T)} disabled={disabled}>
    <SelectPrimitive.Trigger id={id} className="ft-select-trigger" aria-label={label} style={width ? { width } : undefined}>
      <SelectPrimitive.Value placeholder={placeholder} />
      <SelectPrimitive.Icon className="ft-select-icon"><ChevronDown {...ICON} /></SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content className="ft-scope ft-popover ft-select-content" position="popper" sideOffset={6} collisionPadding={8}>
        <SelectPrimitive.Viewport className="ft-select-viewport">
          {options.map(option => <SelectPrimitive.Item key={option.value} value={option.value} className="ft-option" disabled={option.disabled}>
            <span className="ft-option-text"><SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>{option.hint && <small>{option.hint}</small>}</span>
            <SelectPrimitive.ItemIndicator className="ft-option-check"><Check size={15} strokeWidth={2} /></SelectPrimitive.ItemIndicator>
          </SelectPrimitive.Item>)}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  </SelectPrimitive.Root>;
}

// ——— Model picker (Combobox): cmdk in a Radix Popover, HeroUI-like ———
// Wide (at least the trigger, grows to fit the longest id, up to 480 px), rounded, a full-width
// search field, items show the FULL id (they wrap, never truncate). The trigger shows the id with
// an ellipsis in the middle when it is too long, the full id in its tooltip. A WebView2 popup
// cannot leave its window: the list flips above the field or shrinks to the room left.
export function Combobox({ label, value, options, onChange, disabled, placeholder, searchPlaceholder, empty, loading, id, width, onOpen }: {
  label: string; value: string; options: Option[]; onChange: (value: string) => void; disabled?: boolean;
  placeholder?: string; searchPlaceholder?: string; empty?: string; loading?: boolean; id?: string; width?: number | string;
  // The list opens: the moment to refresh what it shows.
  onOpen?: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const current = options.find(option => option.value === value);
  const text = current?.label ?? (value || placeholder || t('ui.choose'));
  return <PopoverPrimitive.Root open={open} onOpenChange={next => { if (next) onOpen?.(); setOpen(next); }}>
    <PopoverPrimitive.Trigger asChild disabled={disabled}>
      <button id={id} type="button" className="ft-select-trigger ft-combobox-trigger" role="combobox" aria-expanded={open} aria-label={label}
        data-placeholder={current || value ? undefined : ''} style={width ? { width } : undefined} disabled={disabled} title={current || value ? text : undefined}>
        <MiddleEllipsis className="ft-combobox-value" text={text} />
        {loading ? <Spinner /> : <ChevronDown className="ft-select-icon" {...ICON} aria-hidden="true" />}
      </button>
    </PopoverPrimitive.Trigger>
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content className="ft-scope ft-popover ft-combobox-content" align="start" sideOffset={6} collisionPadding={8}>
        <Command label={label} className="ft-command" loop>
          <div className="ft-command-search"><Search {...ICON} aria-hidden="true" /><Command.Input placeholder={searchPlaceholder ?? t('ui.search')} maxLength={200} /></div>
          <ScrollArea className="ft-command-scroll" maxHeight="min(300px, calc(var(--radix-popover-content-available-height, 400px) - 62px))">
            <Command.List className="ft-command-list">
              <Command.Empty className="ft-command-empty">{empty ?? t('ui.noResult')}</Command.Empty>
              {options.map(option => <Command.Item key={option.value} value={option.value} keywords={[option.label, option.hint ?? '']} className="ft-option ft-model-option" data-current={option.value === value ? '' : undefined}
                onSelect={() => { onChange(option.value); setOpen(false); }}>
                <span className="ft-option-text"><span>{option.label}</span>{option.hint && <small>{option.hint}</small>}</span>
                <span className="ft-option-check" aria-hidden="true">{option.value === value && <Check size={15} strokeWidth={2} />}</span>
              </Command.Item>)}
            </Command.List>
          </ScrollArea>
        </Command>
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  </PopoverPrimitive.Root>;
}

// Text that keeps its start and its end (« unsloth/gemma-4…UD-Q4_K_XL ») when it does not fit.
export function MiddleEllipsis({ text, className }: { text: string; className?: string }) {
  const box = useRef<HTMLSpanElement>(null);
  const probe = useRef<HTMLSpanElement>(null); // no React children: safe to write into
  const [shown, setShown] = useState(text);
  useLayoutEffect(() => {
    const element = box.current, measure = probe.current;
    if (!element || !measure) return undefined;
    const fit = () => {
      const room = element.clientWidth + 0.5;
      const fits = (candidate: string) => { measure.textContent = candidate; return measure.scrollWidth <= room; };
      if (room <= 0.5 || fits(text)) { setShown(text); return; }
      let low = 1, high = text.length, best = '…';
      while (low <= high) {
        const keep = (low + high) >> 1;
        const head = Math.ceil(keep * 0.55), tail = keep - head;
        const candidate = `${text.slice(0, head)}…${tail ? text.slice(-tail) : ''}`;
        if (fits(candidate)) { best = candidate; low = keep + 1; } else high = keep - 1;
      }
      setShown(best);
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text]);
  return <span ref={box} className={cx('ft-middle', className)}><span ref={probe} className="ft-middle-probe" aria-hidden="true" />{shown}</span>;
}

// ——— Popover (Radix), for anything else that floats ———
export function Popover({ trigger, children, align = 'center', side = 'bottom', open, onOpenChange, className }: {
  trigger: ReactNode; children: ReactNode; align?: 'start' | 'center' | 'end'; side?: 'top' | 'right' | 'bottom' | 'left'; open?: boolean; onOpenChange?: (open: boolean) => void; className?: string;
}) {
  return <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
    <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content className={cx('ft-scope ft-popover ft-popover-panel', className)} align={align} side={side} sideOffset={8} collisionPadding={8}>{children}</PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  </PopoverPrimitive.Root>;
}

// ——— Slider (Radix), shadcn look: 6 px track, filled range, white thumb ringed in the accent ———
// The value shown and sent is always inside [min, max] on a step, whatever was stored.
export const clampToStep = (value: number, min: number, max: number, step = 1) => {
  const finite = Number.isFinite(value) ? value : min;
  return Math.min(max, Math.max(min, min + Math.round((finite - min) / step) * step));
};
export function Slider({ label, value, min = 0, max = 100, step = 1, onChange, format = String, width, disabled }: {
  label: string; value: number; min?: number; max?: number; step?: number; onChange: (value: number) => void; format?: (value: number) => string; width?: number; disabled?: boolean;
}) {
  const shown = clampToStep(value, min, max, step);
  return <span className="ft-slider-control">
    <SliderPrimitive.Root className="ft-slider" value={[shown]} min={min} max={max} step={step} disabled={disabled} onValueChange={([next]) => onChange(clampToStep(next, min, max, step))} style={width ? { width } : undefined}>
      <SliderPrimitive.Track className="ft-slider-track"><SliderPrimitive.Range className="ft-slider-range" /></SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="ft-slider-thumb" aria-label={label} aria-valuetext={format(shown)} />
    </SliderPrimitive.Root>
    <output aria-hidden="true">{format(shown)}</output>
  </span>;
}

// ——— Segmented control (Radix ToggleGroup, single) with a sliding pill (motion layoutId) ———
export type Segment<T extends string> = { value: T; label?: ReactNode; icon?: ReactNode; aria?: string };
export function Segmented<T extends string>({ label, value, onChange, options, size = 'md', block }: {
  label: string; value: T; onChange: (value: T) => void; options: Array<Segment<T>>; size?: 'sm' | 'md' | 'lg'; block?: boolean;
}) {
  const group = useId();
  const tx = useTx();
  return <LayoutGroup id={group}>
    <ToggleGroupPrimitive.Root type="single" className="ft-segmented" data-size={size} data-block={block ? '' : undefined} aria-label={label}
      value={value} onValueChange={next => { if (next) onChange(next as T); }}>
      {options.map(option => <ToggleGroupPrimitive.Item key={option.value} value={option.value} className="ft-segment" aria-label={option.aria ?? (typeof option.label === 'string' ? option.label : undefined)}>
        {value === option.value && <motion.span layoutId="pill" className="ft-segment-pill" transition={tx('snappy')} />}
        <span className="ft-segment-label">{option.icon}{option.label != null && <span>{option.label}</span>}</span>
      </ToggleGroupPrimitive.Item>)}
    </ToggleGroupPrimitive.Root>
  </LayoutGroup>;
}

// ——— Fields ———
// Label, field, then one line under it: the hint, or the problem when there is one.
export function Field({ label, hint, problem, htmlFor, aside, children }: { label: string; hint?: ReactNode; problem?: ReactNode; htmlFor: string; aside?: ReactNode; children: ReactNode }) {
  return <div className="ft-field" data-invalid={problem ? '' : undefined}>
    <div className="ft-field-label"><label htmlFor={htmlFor}>{label}</label>{aside}</div>
    {children}
    {problem ? <p className="ft-field-problem" role="alert">{problem}</p> : hint ? <p className="ft-field-hint">{hint}</p> : null}
  </div>;
}
export const Input = forwardRef<HTMLInputElement, ComponentPropsWithoutRef<'input'>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cx('ft-input', className)} spellCheck={false} autoComplete="off" {...props} />;
});
// A key: masked, an eye to show it, and, once there is a key, a small shield whose tooltip says
// where it is kept (`note`).
type SecretProps = Omit<ComponentPropsWithoutRef<'input'>, 'value' | 'onChange' | 'type'> & { value: string; onChange: (value: string) => void; note?: string };
export function SecretInput({ value, onChange, note, ...props }: SecretProps) {
  const t = useT();
  const [shown, setShown] = useState(false);
  return <div className="ft-secret" data-shield={note ? '' : undefined}>
    <input className="ft-input" type={shown ? 'text' : 'password'} autoComplete="new-password" spellCheck={false} value={value} onChange={event => onChange(event.target.value)} {...props} />
    <span className="ft-secret-tools">
      {note && <Tooltip content={note}><span className="ft-secret-shield" role="img" aria-label={note} tabIndex={0}><ShieldCheck size={15} strokeWidth={1.6} /></span></Tooltip>}
      <IconButton label={t(shown ? 'ui.hideKey' : 'ui.showKey')} size="sm" className="ft-secret-eye" disabled={props.disabled} onClick={() => setShown(current => !current)}>
        {shown ? <EyeOff {...ICON} /> : <Eye {...ICON} />}
      </IconButton>
    </span>
  </div>;
}
export function useFieldId(prefix = 'f') { return `${prefix}-${useId().replace(/[^\w-]/g, '')}`; }

// ——— Notice (banner): info | ok | warn | error ———
const noticeIcons = { info: Info, ok: CircleCheck, warn: TriangleAlert, error: CircleAlert };
export function Notice({ kind = 'info', title, text, children, action, icon, className, role }: {
  kind?: keyof typeof noticeIcons; title?: ReactNode; text?: ReactNode; children?: ReactNode; action?: ReactNode; icon?: ReactNode; className?: string; role?: string;
}) {
  const Glyph = noticeIcons[kind];
  const body = children ?? text;
  return <div className={cx('ft-notice', className)} data-kind={kind} role={role ?? (kind === 'error' ? 'alert' : 'status')}>
    <span className="ft-notice-icon" aria-hidden="true">{icon ?? <Glyph size={16} strokeWidth={1.75} />}</span>
    <span className="ft-notice-copy">{title && <strong>{title}</strong>}{body && <span>{body}</span>}</span>
    {action && <span className="ft-notice-action">{action}</span>}
  </div>;
}

// ——— Groups and rows (cards on a matte window) ———
export function Group({ title, description, action, children, className }: { title?: ReactNode; description?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={cx('ft-group', className)}>
    {(title || action) && <div className="ft-group-heading"><div>{title && <h3>{title}</h3>}{description && <p>{description}</p>}</div>{action}</div>}
    <div className="ft-group-card">{children}</div>
  </section>;
}
// id: the row's data-field (search landing, direct links). stack: the control under the text.
export function Row({ title, description, control, icon, children, id, stack, onClick }: {
  title: ReactNode; description?: ReactNode; control?: ReactNode; icon?: ReactNode; children?: ReactNode; id?: string; stack?: boolean; onClick?: () => void;
}) {
  const content = <>
    {icon && <span className="ft-row-icon" aria-hidden="true">{icon}</span>}
    <span className="ft-row-copy"><strong>{title}</strong>{description && <small>{description}</small>}</span>
    {control && <span className="ft-row-control">{control}</span>}
  </>;
  return <div className="ft-row" data-field={id} data-stack={stack ? '' : undefined}>
    {onClick ? <button type="button" className="ft-row-main" onClick={onClick}>{content}</button> : <div className="ft-row-main">{content}</div>}
    {children}
  </div>;
}

// Page header of a Settings page (title + one line).
export function PageHeader({ title, description, aside }: { title: ReactNode; description?: ReactNode; aside?: ReactNode }) {
  return <header className="ft-page-header"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{aside}</header>;
}

// ——— Status ———
export type StatusState = 'ok' | 'error' | 'warn' | 'pending' | 'running' | 'idle';
export function StatusDot({ state = 'idle', children }: { state?: StatusState; children?: ReactNode }) {
  return <span className="ft-status" data-state={state}><i aria-hidden="true" />{children && <span>{children}</span>}</span>;
}

// ——— Keycaps ———
type KeySize = 'sm' | 'md' | 'lg' | 'xl';
export function Keycap({ children, active, size = 'md', className }: { children: ReactNode; active?: boolean; size?: KeySize; className?: string }) {
  return <kbd className={cx('ft-keycap', className)} data-size={size} data-active={active ? '' : undefined}>{children}</kbd>;
}
// keys: ['Ctrl', 'Alt', 'Space']; active: the number of keys pressed (0…n), or true for all.
export function KeyCombo({ keys, active = 0, size = 'md', joiner = '+' }: { keys: readonly string[]; active?: number | true; size?: KeySize; joiner?: string }) {
  const pressed = active === true ? keys.length : active;
  return <span className="ft-keycombo" data-size={size}>
    {keys.map((key, index) => <span key={key + index} className="ft-keycombo-item">
      {index > 0 && joiner && <span className="ft-keycombo-plus" aria-hidden="true">{joiner}</span>}
      <Keycap size={size} active={index < pressed}>{key}</Keycap>
    </span>)}
  </span>;
}

// ——— Dialog (Radix): a matte window ———
export function Dialog({ open, onOpenChange, title, description, children, actions, width = 420 }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: ReactNode; description?: ReactNode; children?: ReactNode; actions?: ReactNode; width?: number;
}) {
  const t = useT();
  const tx = useTx();
  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
    <AnimatePresence>
      {open && <DialogPrimitive.Portal forceMount>
        <DialogPrimitive.Overlay asChild forceMount>
          <motion.div className="ft-dialog-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={tx(0.18)} />
        </DialogPrimitive.Overlay>
        <div className="ft-dialog-center">
          <DialogPrimitive.Content asChild forceMount {...(description ? {} : { 'aria-describedby': undefined })}>
            <motion.div className="ft-scope ft-dialog" style={{ width } as CSSProperties} initial={{ opacity: 0, scale: 0.96, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={tx('smooth')}>
              <DialogPrimitive.Title className="ft-dialog-title">{title}</DialogPrimitive.Title>
              {description && <DialogPrimitive.Description className="ft-dialog-desc">{description}</DialogPrimitive.Description>}
              {children}
              {actions && <div className="ft-dialog-actions">{actions}</div>}
              <DialogPrimitive.Close asChild><IconButton label={t('ui.close')} size="sm" round className="ft-dialog-close"><X {...ICON} /></IconButton></DialogPrimitive.Close>
            </motion.div>
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>}
    </AnimatePresence>
  </DialogPrimitive.Root>;
}
