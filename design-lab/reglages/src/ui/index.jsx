// Shared primitives of the lab, on known libraries (Radix, cmdk, motion, lucide-react), styled by
// ui.css from the --ft-* tokens only: switching direction / palette / theme restyles them live.
// Geometry lives in the CSS (sizes, grid centring, calc()), never in a pixel nudge here, so every
// round glyph stays centred in its shape. Adapted from src/components/controls.tsx of the app.
import { forwardRef, useId, useState } from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as SelectPrimitive from '@radix-ui/react-select';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import * as SliderPrimitive from '@radix-ui/react-slider';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Command } from 'cmdk';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import { Check, ChevronDown, Eye, EyeOff, LoaderCircle, Search, X } from 'lucide-react';
import { usePortalContainer } from '../lab/Scope.jsx';
import { useTx } from '../lib/motion.js';
import './ui.css';

export const ICON = { size: 16, strokeWidth: 1.5 }; // Lucide, thin stroke (the Îlot's)
const cx = (...c) => c.filter(Boolean).join(' ');

// ——— Buttons ———
// variant: primary | secondary | ghost | danger · size: sm | md | lg | xl (xl = setup's big buttons)
export const Button = forwardRef(function Button({ variant = 'secondary', size = 'md', icon, iconEnd, busy, block, className, disabled, children, ...props }, ref) {
  return (
    <button ref={ref} type="button" className={cx('ft-button', className)} data-variant={variant} data-size={size} data-block={block ? '' : undefined}
      disabled={disabled || busy} aria-busy={busy || undefined} {...props}>
      {busy ? <LoaderCircle className="ft-spin" {...ICON} aria-hidden="true" /> : icon}
      {children != null && <span className="ft-button-label">{children}</span>}
      {iconEnd}
    </button>
  );
});

// One icon in a square (or round) cell; label = accessible name and tooltip.
export const IconButton = forwardRef(function IconButton({ label, variant = 'ghost', size = 'md', round, className, children, ...props }, ref) {
  return <button ref={ref} type="button" className={cx('ft-icon-button', className)} data-variant={variant} data-size={size} data-round={round ? '' : undefined} aria-label={label} title={label} {...props}>{children}</button>;
});

export function Spinner({ size = 16 }) { return <LoaderCircle className="ft-spin" size={size} strokeWidth={1.75} aria-hidden="true" />; }

// ——— Switch (Radix). Windows 11 outline in Verre / Mat, iOS filled in Aérien (tokens). The thumb
// is one fixed-size disc moved and scaled by transform only; its gap to the track is computed in
// CSS, so it is concentric with both round ends in both states. ———
export function Switch({ checked, onCheckedChange, label, disabled, id, ...props }) {
  return (
    <SwitchPrimitive.Root id={id} className="ft-switch" checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} aria-label={label} {...props}>
      <SwitchPrimitive.Thumb className="ft-switch-thumb" />
    </SwitchPrimitive.Root>
  );
}

// ——— Select (Radix) ———
export function Select({ label, value, options, onChange, disabled, placeholder, width, id }) {
  const container = usePortalContainer();
  return (
    <SelectPrimitive.Root value={value} onValueChange={onChange} disabled={disabled}>
      <SelectPrimitive.Trigger id={id} className="ft-select-trigger" aria-label={label} style={width ? { width } : undefined}>
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon className="ft-select-icon"><ChevronDown {...ICON} /></SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal container={container}>
        <SelectPrimitive.Content className="ft-popover ft-select-content" position="popper" sideOffset={6}>
          <SelectPrimitive.Viewport className="ft-select-viewport">
            {options.map(o => (
              <SelectPrimitive.Item key={o.value} value={o.value} className="ft-option" disabled={o.disabled}>
                <span className="ft-option-text"><SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>{o.hint && <small>{o.hint}</small>}</span>
                <SelectPrimitive.ItemIndicator className="ft-option-check"><Check size={15} strokeWidth={2} /></SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

// ——— Combobox: cmdk inside a Radix Popover (the model picker, with search) ———
export function Combobox({ label, value, options, onChange, disabled, placeholder = 'Choisir…', searchPlaceholder = 'Rechercher', empty = 'Aucun résultat', loading, id, width }) {
  const [open, setOpen] = useState(false);
  const container = usePortalContainer();
  const current = options.find(o => o.value === value);
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild disabled={disabled}>
        <button id={id} type="button" className="ft-select-trigger ft-combobox-trigger" role="combobox" aria-expanded={open} aria-label={label}
          data-placeholder={current || value ? undefined : ''} style={width ? { width } : undefined} disabled={disabled}>
          <span className="ft-combobox-value">{current?.label ?? (value || placeholder)}</span>
          {loading ? <Spinner /> : <ChevronDown className="ft-select-icon" {...ICON} aria-hidden="true" />}
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal container={container}>
        <PopoverPrimitive.Content className="ft-popover ft-combobox-content" align="start" sideOffset={6}>
          <Command label={label} className="ft-command">
            <div className="ft-command-search"><Search {...ICON} aria-hidden="true" /><Command.Input placeholder={searchPlaceholder} /></div>
            <Command.List className="ft-command-list">
              <Command.Empty className="ft-command-empty">{empty}</Command.Empty>
              {options.map(o => (
                <Command.Item key={o.value} value={o.value} keywords={[o.label, o.hint || '']} className="ft-option" onSelect={() => { onChange(o.value); setOpen(false); }}>
                  <span className="ft-option-text"><span>{o.label}</span>{o.hint && <small>{o.hint}</small>}</span>
                  {o.value === value && <Check className="ft-option-check" size={15} strokeWidth={2} aria-hidden="true" />}
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

// ——— Popover (Radix), for anything else that floats ———
export function Popover({ trigger, children, align = 'center', side = 'bottom', open, onOpenChange, className }) {
  const container = usePortalContainer();
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal container={container}>
        <PopoverPrimitive.Content className={cx('ft-popover ft-popover-panel', className)} align={align} side={side} sideOffset={8}>{children}</PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

// ——— Slider (Radix) ———
export function Slider({ label, value, min = 0, max = 100, step = 1, onChange, format = v => String(v), width }) {
  return (
    <span className="ft-slider-control">
      <SliderPrimitive.Root className="ft-slider" value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} style={width ? { width } : undefined}>
        <SliderPrimitive.Track className="ft-slider-track"><SliderPrimitive.Range className="ft-slider-range" /></SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="ft-slider-thumb" aria-label={label} aria-valuetext={format(value)} />
      </SliderPrimitive.Root>
      <output aria-hidden="true">{format(value)}</output>
    </span>
  );
}

// ——— Segmented control (Radix ToggleGroup, single) with a sliding pill (motion layoutId) ———
export function Segmented({ label, value, onChange, options, size = 'md', block }) {
  const group = useId();
  const tx = useTx();
  return (
    <LayoutGroup id={group}>
      <ToggleGroupPrimitive.Root type="single" className="ft-segmented" data-size={size} data-block={block ? '' : undefined} aria-label={label}
        value={value} onValueChange={v => { if (v) onChange(v); }}>
        {options.map(o => (
          <ToggleGroupPrimitive.Item key={o.value} value={o.value} className="ft-segment" aria-label={o.aria || (typeof o.label === 'string' ? o.label : undefined)}>
            {value === o.value && <motion.span layoutId="pill" className="ft-segment-pill" transition={tx('snappy')} />}
            <span className="ft-segment-label">{o.icon}{o.label != null && <span>{o.label}</span>}</span>
          </ToggleGroupPrimitive.Item>
        ))}
      </ToggleGroupPrimitive.Root>
    </LayoutGroup>
  );
}

// ——— Vertical tabs (Radix Tabs): the Réglages sidebar ———
// <Tabs value onValueChange><TabList label="Réglages"><Tab value="general" icon={<Settings/>} tile={1}>Général</Tab>…</TabList>
//   <TabPanel value="general">…</TabPanel></Tabs>
// `tile` (1–8) paints the icon on a coloured tile in the Aérien direction (--ft-tile-n).
export function Tabs({ value, onValueChange, defaultValue, children, className }) {
  return <TabsPrimitive.Root className={cx('ft-tabs', className)} orientation="vertical" value={value} defaultValue={defaultValue} onValueChange={onValueChange} activationMode="manual">{children}</TabsPrimitive.Root>;
}
export function TabList({ label, children, className }) {
  return <TabsPrimitive.List className={cx('ft-tablist', className)} aria-label={label}>{children}</TabsPrimitive.List>;
}
export function Tab({ value, icon, tile = 1, children, badge, className }) {
  return (
    <TabsPrimitive.Trigger value={value} className={cx('ft-tab', className)}>
      {icon && <span className="ft-tab-icon" style={{ '--tile': `var(--ft-tile-${tile})`, '--on-tile': `var(--ft-on-tile-${tile})` }} aria-hidden="true">{icon}</span>}
      <span className="ft-tab-label">{children}</span>
      {badge}
    </TabsPrimitive.Trigger>
  );
}
export function TabPanel({ value, children, className }) {
  return <TabsPrimitive.Content value={value} className={cx('ft-tabpanel', className)}>{children}</TabsPrimitive.Content>;
}

// ——— Fields ———
export function Field({ label, hint, problem, htmlFor, aside, children }) {
  return (
    <div className="ft-field" data-invalid={problem ? '' : undefined}>
      <div className="ft-field-label"><label htmlFor={htmlFor}>{label}</label>{aside}</div>
      {children}
      {problem ? <p className="ft-field-problem" role="alert">{problem}</p> : hint ? <p className="ft-field-hint">{hint}</p> : null}
    </div>
  );
}
export const Input = forwardRef(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cx('ft-input', className)} spellCheck={false} autoComplete="off" {...props} />;
});
// A key: masked, an eye to show it, a note on the right (« Protégée par Windows »).
export function SecretInput({ id, value, onChange, placeholder, note, showLabel = 'Afficher la clé', hideLabel = 'Masquer la clé', ...props }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="ft-secret" data-has-note={note ? '' : undefined}>
      <input id={id} className="ft-input" type={shown ? 'text' : 'password'} autoComplete="new-password" spellCheck={false} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)} {...props} />
      {note && <span className="ft-secret-note" aria-hidden="true">{note}</span>}
      <IconButton label={shown ? hideLabel : showLabel} size="sm" className="ft-secret-eye" onClick={() => setShown(s => !s)}>
        {shown ? <EyeOff {...ICON} /> : <Eye {...ICON} />}
      </IconButton>
    </div>
  );
}
export function useFieldId(prefix = 'f') { return `${prefix}-${useId().replace(/:/g, '')}`; }

// ——— Groups and rows (Windows 11 cards in Mat, glass cards in Verre, borderless in Aérien) ———
export function Group({ title, description, action, children, className }) {
  return (
    <section className={cx('ft-group', className)}>
      {(title || action) && (
        <div className="ft-group-heading">
          <div>{title && <h3>{title}</h3>}{description && <p>{description}</p>}</div>
          {action}
        </div>
      )}
      <div className="ft-group-card">{children}</div>
    </section>
  );
}
export function Row({ title, description, control, icon, tile, children, id, stack, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <div className="ft-row" data-field={id} data-stack={stack ? '' : undefined}>
      <Tag className="ft-row-main" {...(onClick ? { type: 'button', onClick } : {})}>
        {icon && <span className="ft-row-icon" data-tile={tile ? '' : undefined} style={tile ? { '--tile': `var(--ft-tile-${tile})`, '--on-tile': `var(--ft-on-tile-${tile})` } : undefined} aria-hidden="true">{icon}</span>}
        <span className="ft-row-copy"><strong>{title}</strong>{description && <small>{description}</small>}</span>
        {control && <span className="ft-row-control">{control}</span>}
      </Tag>
      {children}
    </div>
  );
}

// Page header of a Réglages page (title + one line).
export function PageHeader({ title, description, aside }) {
  return (
    <header className="ft-page-header">
      <div><h2>{title}</h2>{description && <p>{description}</p>}</div>
      {aside}
    </header>
  );
}

// ——— Status ———
// state: ok | error | warn | pending | running | idle
export function StatusDot({ state = 'idle', children }) {
  return <span className="ft-status" data-state={state}><i aria-hidden="true" />{children && <span>{children}</span>}</span>;
}

// ——— Keycaps ———
export function Keycap({ children, active, size = 'md', className }) {
  return <kbd className={cx('ft-keycap', className)} data-size={size} data-active={active ? '' : undefined}>{children}</kbd>;
}
// keys: ['Ctrl', 'Alt', 'Espace']; active: number of keys pressed (0…n) or true for all.
export function KeyCombo({ keys, active = 0, size = 'md', joiner = '+' }) {
  const n = active === true ? keys.length : active;
  return (
    <span className="ft-keycombo" data-size={size}>
      {keys.map((k, i) => (
        <span key={k + i} className="ft-keycombo-item">
          {i > 0 && joiner && <span className="ft-keycombo-plus" aria-hidden="true">{joiner}</span>}
          <Keycap size={size} active={i < n}>{k}</Keycap>
        </span>
      ))}
    </span>
  );
}

// ——— Dialog (Radix) ———
export function Dialog({ open, onOpenChange, title, description, children, actions, width = 420 }) {
  const container = usePortalContainer();
  const tx = useTx();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount container={container}>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div className="ft-dialog-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={tx(0.18)} />
            </DialogPrimitive.Overlay>
            <div className="ft-dialog-center">
              <DialogPrimitive.Content asChild forceMount aria-describedby={description ? undefined : undefined}>
                <motion.div className="ft-dialog" style={{ width }} initial={{ opacity: 0, scale: 0.96, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={tx('smooth')}>
                  <DialogPrimitive.Title className="ft-dialog-title">{title}</DialogPrimitive.Title>
                  {description && <DialogPrimitive.Description className="ft-dialog-desc">{description}</DialogPrimitive.Description>}
                  {children}
                  {actions && <div className="ft-dialog-actions">{actions}</div>}
                  <DialogPrimitive.Close asChild><IconButton label="Fermer" size="sm" className="ft-dialog-close"><X {...ICON} /></IconButton></DialogPrimitive.Close>
                </motion.div>
              </DialogPrimitive.Content>
            </div>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
