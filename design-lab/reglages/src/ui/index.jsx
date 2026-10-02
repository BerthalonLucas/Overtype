// Shared primitives of the lab, v2 (Lucas's votes, 30/09): ours (Radix) for switch, select, buttons,
// segments, notice, dialog and fields; a HeroUI-like model picker (wide, rounded, full ids); a
// shadcn-look slider; a sidebar nav whose selection pill GLIDES to the clicked item (never follows
// the mouse); a custom scroll area (thin overlay thumb, scroll shadows) for every scroll.
// Styled by ui.css from the --ft-* tokens only. Geometry lives in the CSS (sizes, grid centring,
// calc()), never in a pixel nudge here, so every round glyph stays centred in its shape.
import { createContext, forwardRef, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as SelectPrimitive from '@radix-ui/react-select';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import * as SliderPrimitive from '@radix-ui/react-slider';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import { Command } from 'cmdk';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import { Switch as HeroSwitch } from '@heroui/react';
import { Check, ChevronDown, CircleAlert, CircleCheck, Eye, EyeOff, Info, LoaderCircle, Search, ShieldCheck, TriangleAlert, X } from 'lucide-react';
import { usePortalContainer, useScope } from '../lab/Scope.jsx';
import { HeroScope } from '../heroui/HeroDemo.jsx';
import { useTx } from '../lib/motion.js';
import './ui.css';

export const ICON = { size: 16, strokeWidth: 1.5 }; // Lucide, thin stroke (the Îlot's)
const cx = (...c) => c.filter(Boolean).join(' ');
function setRef(ref, v) { if (typeof ref === 'function') ref(v); else if (ref) ref.current = v; }

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

// ——— Tooltip (Radix) ———
export function Tooltip({ content, children, side = 'top', delay = 250 }) {
  const container = usePortalContainer();
  return (
    <TooltipPrimitive.Provider delayDuration={delay} skipDelayDuration={200}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal container={container}>
          <TooltipPrimitive.Content className="ft-tooltip" side={side} sideOffset={6} collisionPadding={8}>{content}</TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

// ——— Switch ———
// Ours (Radix): Windows 11 outline, the thumb grows on hover then travels with a small overshoot
// (« Ressort Windows 11 »). One fixed-size disc moved and scaled by transform only; its gap to the
// track is computed in CSS, so it is concentric with both round ends in both states.
// The lab switch « Interrupteur » swaps every Switch for the real HeroUI v3 one (variant="hero"
// forces it, variant="ours" too), to try it in real conditions.
export function Switch({ checked, onCheckedChange, label, disabled, id, variant, ...props }) {
  const { switchStyle } = useScope();
  if ((variant ?? switchStyle) === 'hero') {
    return (
      <HeroScope themed className="ft-hero-switch">
        <HeroSwitch id={id} isSelected={!!checked} onChange={v => onCheckedChange?.(v)} isDisabled={disabled} aria-label={label}>
          <HeroSwitch.Control><HeroSwitch.Thumb /></HeroSwitch.Control>
        </HeroSwitch>
      </HeroScope>
    );
  }
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
        <SelectPrimitive.Content className="ft-popover ft-select-content" position="popper" sideOffset={6} collisionPadding={8}>
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

// ——— Model picker (Combobox): cmdk in a Radix Popover, HeroUI-like ———
// Wide (at least the trigger, grows to fit the longest id, up to 480 px), rounded, a full-width
// search field, items show the FULL id (they wrap, never truncate). The trigger shows the id with
// an ellipsis in the middle when it is too long, full id in its tooltip.
export function Combobox({ label, value, options, onChange, disabled, placeholder = 'Choisir…', searchPlaceholder = 'Rechercher', empty = 'Aucun résultat', loading, id, width }) {
  const [open, setOpen] = useState(false);
  const container = usePortalContainer();
  const current = options.find(o => o.value === value);
  const text = current?.label ?? (value || placeholder);
  // A WebView2 popup cannot leave its window: the list collides with the window it opens in
  // (flips above the field, or shrinks to the room left), never runs over the desktop or taskbar.
  const trigger = useRef(null);
  const [boundary, setBoundary] = useState(undefined);
  const onOpenChange = o => { if (o) setBoundary(trigger.current?.closest('.ft-window') || undefined); setOpen(o); };
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Trigger asChild disabled={disabled}>
        <button ref={trigger} id={id} type="button" className="ft-select-trigger ft-combobox-trigger" role="combobox" aria-expanded={open} aria-label={label}
          data-placeholder={current || value ? undefined : ''} style={width ? { width } : undefined} disabled={disabled} title={current || value ? String(text) : undefined}>
          <MiddleEllipsis className="ft-combobox-value" text={String(text)} />
          {loading ? <Spinner /> : <ChevronDown className="ft-select-icon" {...ICON} aria-hidden="true" />}
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal container={container}>
        <PopoverPrimitive.Content className="ft-popover ft-combobox-content" align="start" sideOffset={6} collisionPadding={8} collisionBoundary={boundary}>
          <Command label={label} className="ft-command" loop>
            <div className="ft-command-search"><Search {...ICON} aria-hidden="true" /><Command.Input placeholder={searchPlaceholder} /></div>
            <ScrollArea className="ft-command-scroll" maxHeight="min(300px, calc(var(--radix-popover-content-available-height, 400px) - 62px))">
              <Command.List className="ft-command-list">
                <Command.Empty className="ft-command-empty">{empty}</Command.Empty>
                {options.map(o => (
                  <Command.Item key={o.value} value={o.value} keywords={[o.label, o.hint || '']} className="ft-option ft-model-option" data-current={o.value === value ? '' : undefined}
                    onSelect={() => { onChange(o.value); setOpen(false); }}>
                    <span className="ft-option-text"><span>{o.label}</span>{o.hint && <small>{o.hint}</small>}</span>
                    <span className="ft-option-check" aria-hidden="true">{o.value === value && <Check size={15} strokeWidth={2} />}</span>
                  </Command.Item>
                ))}
              </Command.List>
            </ScrollArea>
          </Command>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

// Text that keeps its start and its end (« unsloth/gemma-4…UD-Q4_K_XL ») when it does not fit.
export function MiddleEllipsis({ text, className }) {
  const box = useRef(null);
  const probe = useRef(null); // no React children: safe to write into
  const [shown, setShown] = useState(text);
  useLayoutEffect(() => {
    const el = box.current, m = probe.current; if (!el || !m) return undefined;
    const fit = () => {
      const room = el.clientWidth + 0.5;
      const fits = t => { m.textContent = t; return m.scrollWidth <= room; };
      if (!room || fits(text)) { setShown(text); return; }
      let lo = 1, hi = text.length, best = '…';
      while (lo <= hi) {
        const keep = (lo + hi) >> 1;
        const head = Math.ceil(keep * 0.55), tail = keep - head;
        const cand = `${text.slice(0, head)}…${tail ? text.slice(-tail) : ''}`;
        if (fits(cand)) { best = cand; lo = keep + 1; } else hi = keep - 1;
      }
      setShown(best);
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el);
    return () => ro.disconnect();
  }, [text]);
  return <span ref={box} className={cx('ft-middle', className)}><span ref={probe} className="ft-middle-probe" aria-hidden="true" />{shown}</span>;
}

// ——— Popover (Radix), for anything else that floats ———
export function Popover({ trigger, children, align = 'center', side = 'bottom', open, onOpenChange, className }) {
  const container = usePortalContainer();
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal container={container}>
        <PopoverPrimitive.Content className={cx('ft-popover ft-popover-panel', className)} align={align} side={side} sideOffset={8} collisionPadding={8}>{children}</PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

// ——— Slider (Radix), shadcn look: 6 px track, filled range, white thumb ringed in the accent ———
export function Slider({ label, value, min = 0, max = 100, step = 1, onChange, format = v => String(v), width, disabled }) {
  return (
    <span className="ft-slider-control">
      <SliderPrimitive.Root className="ft-slider" value={[value]} min={min} max={max} step={step} disabled={disabled} onValueChange={([v]) => onChange(v)} style={width ? { width } : undefined}>
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
// <Tabs value onValueChange><TabList label="Réglages"><Tab value="general" icon={<Settings/>}>Général</Tab>…</TabList>
//   <TabPanel value="general">…</TabPanel></Tabs>
// Each Tab carries data-ft-page (its value, or `page`): its icon takes that page's colour. The
// selection is ONE pill in the list that glides from the previous item to the clicked one (short
// delay, soft spring, passing over the items in between, like HeroUI's), tinted with the colour of
// the selected page. It never follows the mouse: hover is a separate faint tint on the item.
export const NAV_GLIDE = { type: 'spring', duration: 0.46, bounce: 0.14, delay: 0.035 };
const TabsContext = createContext(null);
export function Tabs({ value, onValueChange, defaultValue, children, className }) {
  const [inner, setInner] = useState(defaultValue);
  const current = value ?? inner;
  const onChange = useCallback(v => { setInner(v); onValueChange?.(v); }, [onValueChange]);
  return (
    <TabsContext.Provider value={current}>
      <TabsPrimitive.Root className={cx('ft-tabs', className)} orientation="vertical" value={current} onValueChange={onChange} activationMode="manual">{children}</TabsPrimitive.Root>
    </TabsContext.Provider>
  );
}
export function TabList({ label, children, className }) {
  const value = useContext(TabsContext);
  const tx = useTx();
  const list = useRef(null);
  const [pill, setPill] = useState(null); // { y, h, page }
  const measure = useCallback(() => {
    const root = list.current; if (!root) return;
    const el = root.querySelector('[role="tab"][data-state="active"]');
    if (!el) { setPill(null); return; }
    // offsetTop ignores transforms (the scaled stage, an item still sliding in), so the pill lands
    // on the item's resting place.
    let y = 0, n = el;
    while (n && n !== root) { y += n.offsetTop; n = n.offsetParent; if (n && !root.contains(n)) { n = null; } }
    const next = { y, h: el.offsetHeight, page: el.getAttribute('data-ft-page') || undefined };
    setPill(p => (p && p.y === next.y && p.h === next.h && p.page === next.page ? p : next));
  }, []);
  useLayoutEffect(measure, [value, measure]);
  useEffect(() => {
    const root = list.current; if (!root) return undefined;
    const ro = new ResizeObserver(() => measure());
    ro.observe(root);
    const mo = new MutationObserver(() => measure());
    mo.observe(root, { subtree: true, attributes: true, attributeFilter: ['data-state'], childList: true });
    return () => { ro.disconnect(); mo.disconnect(); };
  }, [measure]);
  return (
    <TabsPrimitive.List ref={list} className={cx('ft-tablist', className)} aria-label={label}>
      {pill && (
        <motion.span className="ft-tab-pill" aria-hidden="true" data-ft-page={pill.page}
          initial={false} animate={{ y: pill.y }} transition={tx(NAV_GLIDE)} style={{ height: pill.h }} />
      )}
      {children}
    </TabsPrimitive.List>
  );
}
export function Tab({ value, icon, page, children, badge, className, tile: _tile }) {
  return (
    <TabsPrimitive.Trigger value={value} className={cx('ft-tab', className)} data-ft-page={page ?? value}>
      {icon && <span className="ft-tab-icon" aria-hidden="true">{icon}</span>}
      <span className="ft-tab-label">{children}</span>
      {badge}
    </TabsPrimitive.Trigger>
  );
}
export function TabPanel({ value, children, className }) {
  return <TabsPrimitive.Content value={value} className={cx('ft-tabpanel', className)}>{children}</TabsPrimitive.Content>;
}

// ——— Scroll area (Radix): the only scrollbar of the lab ———
// Thin overlay thumb (6 px, 10 px on hover), rounded, fades in on scroll / hover, no arrows; the
// content fades out at an edge that has more to scroll (HeroUI ScrollShadow idea, a mask: works on
// any background). shadows: true | 'top' | 'bottom' | false. viewportRef / onScroll reach the
// scrolling element (scrollTop, scrollIntoView…). maxHeight: grow with the content up to that.
export const ScrollArea = forwardRef(function ScrollArea({ className, viewportClassName, viewportRef, onScroll, shadows = true, maxHeight, children, style, ...rest }, ref) {
  const vp = useRef(null);
  const [edge, setEdge] = useState({ top: false, bottom: false, tiny: false });
  const update = useCallback(() => {
    const el = vp.current; if (!el) return;
    // A few px of overflow (padding) is not worth a near-full-height thumb nor an edge fade.
    const over = el.scrollHeight - el.clientHeight;
    const tiny = over > 0 && over < 8;
    const top = !tiny && el.scrollTop > 1;
    const bottom = !tiny && el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    setEdge(e => (e.top === top && e.bottom === bottom && e.tiny === tiny ? e : { top, bottom, tiny }));
  }, []);
  useLayoutEffect(() => {
    const el = vp.current; if (!el) return undefined;
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [update]);
  const top = edge.top && (shadows === true || shadows === 'top');
  const bottom = edge.bottom && (shadows === true || shadows === 'bottom');
  return (
    <ScrollAreaPrimitive.Root ref={ref} type="hover" scrollHideDelay={700} className={cx('ft-scroll', className)} style={style} data-tiny={edge.tiny ? '' : undefined} {...rest}>
      <ScrollAreaPrimitive.Viewport
        ref={el => { vp.current = el; setRef(viewportRef, el); }}
        className={cx('ft-scroll-viewport', viewportClassName)}
        data-fade-top={top ? '' : undefined} data-fade-bottom={bottom ? '' : undefined}
        style={maxHeight ? { maxHeight } : undefined}
        onScroll={e => { update(); onScroll?.(e); }}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollAreaPrimitive.Scrollbar className="ft-scrollbar" orientation="vertical" forceMount>
        <ScrollAreaPrimitive.Thumb className="ft-scroll-thumb" />
      </ScrollAreaPrimitive.Scrollbar>
    </ScrollAreaPrimitive.Root>
  );
});

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
// A key: masked, an eye to show it, and — once there is a key — a small shield whose tooltip says
// where it is kept (the v1 « Protégée par Windows » text was visual noise, Lucas 30/09).
// `note` (string) = the shield's tooltip; shield={false} hides it.
export function SecretInput({ id, value, onChange, placeholder, note, shield = true, showLabel = 'Afficher la clé', hideLabel = 'Masquer la clé', ...props }) {
  const [shown, setShown] = useState(false);
  const guard = shield && note;
  return (
    <div className="ft-secret" data-shield={guard ? '' : undefined}>
      <input id={id} className="ft-input" type={shown ? 'text' : 'password'} autoComplete="new-password" spellCheck={false} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)} {...props} />
      <span className="ft-secret-tools">
        {guard && (
          <Tooltip content={note === true ? 'Protégée par Windows (chiffrée pour votre compte)' : note}>
            <span className="ft-secret-shield" role="img" aria-label={note === true ? 'Protégée par Windows' : note} tabIndex={0}><ShieldCheck size={15} strokeWidth={1.6} /></span>
          </Tooltip>
        )}
        <IconButton label={shown ? hideLabel : showLabel} size="sm" className="ft-secret-eye" onClick={() => setShown(s => !s)}>
          {shown ? <EyeOff {...ICON} /> : <Eye {...ICON} />}
        </IconButton>
      </span>
    </div>
  );
}
export function useFieldId(prefix = 'f') { return `${prefix}-${useId().replace(/:/g, '')}`; }

// ——— Notice (banner): info | ok | warn | error ———
// <Notice kind="warn" title="Connexion non chiffrée" action={<Button size="sm">…</Button>}>Le texte circule en clair.</Notice>
const NOTICE_ICON = { info: Info, ok: CircleCheck, warn: TriangleAlert, error: CircleAlert };
export function Notice({ kind = 'info', title, text, children, action, icon, className, role }) {
  const Icon = NOTICE_ICON[kind] || Info;
  const body = children ?? text;
  return (
    <div className={cx('ft-notice', className)} data-kind={kind} role={role ?? (kind === 'error' ? 'alert' : 'status')}>
      <span className="ft-notice-icon" aria-hidden="true">{icon ?? <Icon size={16} strokeWidth={1.75} />}</span>
      <span className="ft-notice-copy">{title && <strong>{title}</strong>}{body && <span>{body}</span>}</span>
      {action && <span className="ft-notice-action">{action}</span>}
    </div>
  );
}

// ——— Groups and rows (cards on a matte window) ———
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
        {icon && <span className="ft-row-icon" aria-hidden="true">{icon}</span>}
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

// ——— Dialog (Radix): a matte window ———
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
                  <DialogPrimitive.Close asChild><IconButton label="Fermer" size="sm" round className="ft-dialog-close"><X {...ICON} /></IconButton></DialogPrimitive.Close>
                </motion.div>
              </DialogPrimitive.Content>
            </div>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
