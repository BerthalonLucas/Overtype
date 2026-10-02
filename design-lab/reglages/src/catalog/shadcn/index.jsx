// shadcn/ui (style new-york-v4), sources fetched from https://ui.shadcn.com/r/styles/new-york-v4/<name>.json
// on 29/09/2026: switch, select, command, popover, tabs, slider, input, toggle, toggle-group, dialog, alert.
// Adapted for the lab, and only that:
//   - every utility carries the  tw:  prefix (precompiled Tailwind v4, no preflight, see src/tailwind.css);
//   - "radix-ui" → the individual @radix-ui/react-* packages installed here;
//   - portals go to the nearest lab Scope (usePortalContainer) so the tokens follow;
//   - "dark:" variants dropped (our tokens already switch with data-ft-theme);
//   - tw-animate-css (animate-in / zoom-in-95 …) is not installed: the same fade + zoom is in catalog.css
//     under [data-slot=…-content] so the open animation looks like shadcn's.
// GENERATED from scratchpad/shadcn-raw/index.jsx by twprefix.mjs — edit freely, keep the tw: prefix.
import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as SelectPrimitive from '@radix-ui/react-select';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as SliderPrimitive from '@radix-ui/react-slider';
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Command as CommandPrimitive } from 'cmdk';
import { cva } from 'class-variance-authority';
import { createContext, useContext } from 'react';
import { CheckIcon, ChevronDownIcon, SearchIcon, XIcon } from 'lucide-react';
import { cn } from '../../lib/cn.js';
import { usePortalContainer } from '../../lab/Scope.jsx';

// ——— switch ———
export function Switch({ className, size = 'default', ...props }) {
  return (
    <SwitchPrimitive.Root data-slot="switch" data-size={size}
      className={cn("tw:peer tw:group/switch tw:inline-flex tw:shrink-0 tw:items-center tw:rounded-full tw:border tw:border-solid tw:border-transparent tw:shadow-xs tw:transition-all tw:outline-none tw:p-0 tw:focus-visible:border-ring tw:focus-visible:ring-[3px] tw:focus-visible:ring-ring/50 tw:disabled:cursor-not-allowed tw:disabled:opacity-50 tw:data-[size=default]:h-[1.15rem] tw:data-[size=default]:w-8 tw:data-[size=sm]:h-3.5 tw:data-[size=sm]:w-6 tw:data-[state=checked]:bg-primary tw:data-[state=unchecked]:bg-input", className)}
      {...props}>
      <SwitchPrimitive.Thumb data-slot="switch-thumb"
        className={cn("tw:pointer-events-none tw:block tw:rounded-full tw:bg-background tw:ring-0 tw:transition-transform tw:group-data-[size=default]/switch:size-4 tw:group-data-[size=sm]/switch:size-3 tw:data-[state=checked]:translate-x-[calc(100%-2px)] tw:data-[state=unchecked]:translate-x-0")} />
    </SwitchPrimitive.Root>
  );
}

// ——— select ———
export const Select = props => <SelectPrimitive.Root data-slot="select" {...props} />;
export const SelectValue = props => <SelectPrimitive.Value data-slot="select-value" {...props} />;
export function SelectTrigger({ className, size = 'default', children, ...props }) {
  return (
    <SelectPrimitive.Trigger data-slot="select-trigger" data-size={size}
      className={cn("tw:flex tw:w-fit tw:items-center tw:justify-between tw:gap-2 tw:rounded-md tw:border tw:border-solid tw:border-input tw:bg-transparent tw:px-3 tw:py-2 tw:text-sm tw:text-foreground tw:whitespace-nowrap tw:shadow-xs tw:transition-[color,box-shadow] tw:outline-none tw:focus-visible:border-ring tw:focus-visible:ring-[3px] tw:focus-visible:ring-ring/50 tw:disabled:cursor-not-allowed tw:disabled:opacity-50 tw:data-[placeholder]:text-muted-foreground tw:data-[size=default]:h-9 tw:data-[size=sm]:h-8 tw:*:data-[slot=select-value]:line-clamp-1 tw:*:data-[slot=select-value]:flex tw:*:data-[slot=select-value]:items-center tw:*:data-[slot=select-value]:gap-2 tw:[&_svg]:pointer-events-none tw:[&_svg]:shrink-0 tw:[&_svg:not([class*='size-'])]:size-4 tw:[&_svg:not([class*='text-'])]:text-muted-foreground", className)}
      {...props}>
      {children}
      <SelectPrimitive.Icon asChild><ChevronDownIcon className={"tw:size-4 tw:opacity-50"} /></SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}
export function SelectContent({ className, children, position = 'item-aligned', align = 'center', ...props }) {
  const container = usePortalContainer();
  return (
    <SelectPrimitive.Portal container={container}>
      <SelectPrimitive.Content data-slot="select-content"
        className={cn("tw:relative tw:z-50 tw:max-h-(--radix-select-content-available-height) tw:min-w-[8rem] tw:origin-(--radix-select-content-transform-origin) tw:overflow-x-hidden tw:overflow-y-auto tw:rounded-md tw:border tw:border-solid tw:border-border tw:bg-popover tw:text-popover-foreground tw:shadow-md",
          position === 'popper' && "tw:data-[side=bottom]:translate-y-1 tw:data-[side=left]:-translate-x-1 tw:data-[side=right]:translate-x-1 tw:data-[side=top]:-translate-y-1", className)}
        position={position} align={align} {...props}>
        <SelectPrimitive.Viewport className={cn("tw:p-1", position === 'popper' && "tw:h-[var(--radix-select-trigger-height)] tw:w-full tw:min-w-[var(--radix-select-trigger-width)] tw:scroll-my-1")}>
          {children}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}
export function SelectItem({ className, children, ...props }) {
  return (
    <SelectPrimitive.Item data-slot="select-item"
      className={cn("tw:relative tw:flex tw:w-full tw:cursor-default tw:items-center tw:gap-2 tw:rounded-sm tw:py-1.5 tw:pr-8 tw:pl-2 tw:text-sm tw:outline-hidden tw:select-none tw:focus:bg-accent tw:focus:text-accent-foreground tw:data-[disabled]:pointer-events-none tw:data-[disabled]:opacity-50 tw:[&_svg]:pointer-events-none tw:[&_svg]:shrink-0 tw:[&_svg:not([class*='size-'])]:size-4", className)}
      {...props}>
      <span data-slot="select-item-indicator" className={"tw:absolute tw:right-2 tw:flex tw:size-3.5 tw:items-center tw:justify-center"}>
        <SelectPrimitive.ItemIndicator><CheckIcon className={"tw:size-4"} /></SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

// ——— popover ———
export const Popover = props => <PopoverPrimitive.Root data-slot="popover" {...props} />;
export const PopoverTrigger = props => <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
export function PopoverContent({ className, align = 'center', sideOffset = 4, ...props }) {
  const container = usePortalContainer();
  return (
    <PopoverPrimitive.Portal container={container}>
      <PopoverPrimitive.Content data-slot="popover-content" align={align} sideOffset={sideOffset}
        className={cn("tw:z-50 tw:w-72 tw:origin-(--radix-popover-content-transform-origin) tw:rounded-md tw:border tw:border-solid tw:border-border tw:bg-popover tw:p-4 tw:text-popover-foreground tw:shadow-md tw:outline-hidden", className)}
        {...props} />
    </PopoverPrimitive.Portal>
  );
}

// ——— command (cmdk) ———
export function Command({ className, ...props }) {
  return <CommandPrimitive data-slot="command" className={cn("tw:flex tw:h-full tw:w-full tw:flex-col tw:overflow-hidden tw:rounded-md tw:bg-popover tw:text-popover-foreground", className)} {...props} />;
}
export function CommandInput({ className, ...props }) {
  return (
    <div data-slot="command-input-wrapper" className={"tw:flex tw:h-9 tw:items-center tw:gap-2 tw:border-0 tw:border-b tw:border-solid tw:border-border tw:px-3"}>
      <SearchIcon className={"tw:size-4 tw:shrink-0 tw:opacity-50"} />
      <CommandPrimitive.Input data-slot="command-input"
        className={cn("tw:flex tw:h-10 tw:w-full tw:rounded-md tw:border-0 tw:bg-transparent tw:py-3 tw:text-sm tw:text-foreground tw:outline-hidden tw:placeholder:text-muted-foreground tw:disabled:cursor-not-allowed tw:disabled:opacity-50", className)} {...props} />
    </div>
  );
}
export function CommandList({ className, ...props }) {
  return <CommandPrimitive.List data-slot="command-list" className={cn("tw:max-h-[300px] tw:scroll-py-1 tw:overflow-x-hidden tw:overflow-y-auto", className)} {...props} />;
}
export const CommandEmpty = props => <CommandPrimitive.Empty data-slot="command-empty" className={"tw:py-6 tw:text-center tw:text-sm"} {...props} />;
export function CommandGroup({ className, ...props }) {
  return <CommandPrimitive.Group data-slot="command-group" className={cn("tw:overflow-hidden tw:p-1 tw:text-foreground tw:[&_[cmdk-group-heading]]:px-2 tw:[&_[cmdk-group-heading]]:py-1.5 tw:[&_[cmdk-group-heading]]:text-xs tw:[&_[cmdk-group-heading]]:font-medium tw:[&_[cmdk-group-heading]]:text-muted-foreground", className)} {...props} />;
}
export function CommandItem({ className, ...props }) {
  return <CommandPrimitive.Item data-slot="command-item" className={cn("tw:relative tw:flex tw:cursor-default tw:items-center tw:gap-2 tw:rounded-sm tw:px-2 tw:py-1.5 tw:text-sm tw:outline-hidden tw:select-none tw:data-[disabled=true]:pointer-events-none tw:data-[disabled=true]:opacity-50 tw:data-[selected=true]:bg-accent tw:data-[selected=true]:text-accent-foreground tw:[&_svg]:pointer-events-none tw:[&_svg]:shrink-0 tw:[&_svg:not([class*='size-'])]:size-4", className)} {...props} />;
}

// ——— tabs ———
export function Tabs({ className, orientation = 'horizontal', ...props }) {
  return <TabsPrimitive.Root data-slot="tabs" data-orientation={orientation} orientation={orientation} className={cn("tw:group/tabs tw:flex tw:gap-2 tw:data-[orientation=horizontal]:flex-col", className)} {...props} />;
}
export const tabsListVariants = cva("tw:group/tabs-list tw:inline-flex tw:w-fit tw:items-center tw:justify-center tw:rounded-lg tw:p-[3px] tw:text-muted-foreground tw:group-data-[orientation=horizontal]/tabs:h-9 tw:group-data-[orientation=vertical]/tabs:h-fit tw:group-data-[orientation=vertical]/tabs:flex-col tw:data-[variant=line]:rounded-none", {
  variants: { variant: { default: "tw:bg-muted", line: "tw:gap-1 tw:bg-transparent" } },
  defaultVariants: { variant: 'default' },
});
export function TabsList({ className, variant = 'default', ...props }) {
  return <TabsPrimitive.List data-slot="tabs-list" data-variant={variant} className={cn(tabsListVariants({ variant }), className)} {...props} />;
}
export function TabsTrigger({ className, ...props }) {
  return (
    <TabsPrimitive.Trigger data-slot="tabs-trigger"
      className={cn(
        "tw:relative tw:inline-flex tw:h-[calc(100%-1px)] tw:flex-1 tw:items-center tw:justify-center tw:gap-1.5 tw:rounded-md tw:border tw:border-solid tw:border-transparent tw:bg-transparent tw:px-2 tw:py-1 tw:text-sm tw:font-medium tw:whitespace-nowrap tw:text-foreground/60 tw:transition-all tw:group-data-[orientation=vertical]/tabs:w-full tw:group-data-[orientation=vertical]/tabs:justify-start tw:hover:text-foreground tw:focus-visible:border-ring tw:focus-visible:ring-[3px] tw:focus-visible:ring-ring/50 tw:focus-visible:outline-1 tw:focus-visible:outline-ring tw:disabled:pointer-events-none tw:disabled:opacity-50 tw:group-data-[variant=default]/tabs-list:data-[state=active]:shadow-sm tw:group-data-[variant=line]/tabs-list:data-[state=active]:shadow-none tw:[&_svg]:pointer-events-none tw:[&_svg]:shrink-0 tw:[&_svg:not([class*='size-'])]:size-4",
        "tw:group-data-[variant=line]/tabs-list:bg-transparent tw:group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent",
        "tw:data-[state=active]:bg-background tw:data-[state=active]:text-foreground",
        "tw:after:absolute tw:after:bg-foreground tw:after:opacity-0 tw:after:transition-opacity tw:group-data-[orientation=horizontal]/tabs:after:inset-x-0 tw:group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] tw:group-data-[orientation=horizontal]/tabs:after:h-0.5 tw:group-data-[orientation=vertical]/tabs:after:inset-y-0 tw:group-data-[orientation=vertical]/tabs:after:-right-1 tw:group-data-[orientation=vertical]/tabs:after:w-0.5 tw:group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100",
        className)}
      {...props} />
  );
}
export function TabsContent({ className, ...props }) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn("tw:flex-1 tw:outline-none", className)} {...props} />;
}

// ——— slider ———
export function Slider({ className, defaultValue, value, min = 0, max = 100, ...props }) {
  const values = Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min, max];
  return (
    <SliderPrimitive.Root data-slot="slider" defaultValue={defaultValue} value={value} min={min} max={max}
      className={cn("tw:relative tw:flex tw:w-full tw:touch-none tw:items-center tw:select-none tw:data-[disabled]:opacity-50 tw:data-[orientation=vertical]:h-full tw:data-[orientation=vertical]:min-h-44 tw:data-[orientation=vertical]:w-auto tw:data-[orientation=vertical]:flex-col", className)}
      {...props}>
      <SliderPrimitive.Track data-slot="slider-track" className={cn("tw:relative tw:grow tw:overflow-hidden tw:rounded-full tw:bg-muted tw:data-[orientation=horizontal]:h-1.5 tw:data-[orientation=horizontal]:w-full tw:data-[orientation=vertical]:h-full tw:data-[orientation=vertical]:w-1.5")}>
        <SliderPrimitive.Range data-slot="slider-range" className={cn("tw:absolute tw:bg-primary tw:data-[orientation=horizontal]:h-full tw:data-[orientation=vertical]:w-full")} />
      </SliderPrimitive.Track>
      {values.map((_, i) => (
        <SliderPrimitive.Thumb data-slot="slider-thumb" key={i} aria-label={props['aria-label']}
          className={"tw:block tw:size-4 tw:shrink-0 tw:rounded-full tw:border tw:border-solid tw:border-primary tw:bg-white tw:shadow-sm tw:ring-ring/50 tw:transition-[color,box-shadow] tw:hover:ring-4 tw:focus-visible:ring-4 tw:focus-visible:outline-hidden tw:disabled:pointer-events-none tw:disabled:opacity-50"} />
      ))}
    </SliderPrimitive.Root>
  );
}

// ——— input ———
export function Input({ className, type, ...props }) {
  return (
    <input type={type} data-slot="input"
      className={cn(
        "tw:h-9 tw:w-full tw:min-w-0 tw:rounded-md tw:border tw:border-solid tw:border-input tw:bg-transparent tw:px-3 tw:py-1 tw:text-base tw:text-foreground tw:shadow-xs tw:transition-[color,box-shadow] tw:outline-none tw:selection:bg-primary tw:selection:text-primary-foreground tw:placeholder:text-muted-foreground tw:disabled:pointer-events-none tw:disabled:cursor-not-allowed tw:disabled:opacity-50 tw:md:text-sm",
        "tw:focus-visible:border-ring tw:focus-visible:ring-[3px] tw:focus-visible:ring-ring/50",
        "tw:aria-invalid:border-destructive tw:aria-invalid:ring-destructive/20",
        className)}
      {...props} />
  );
}

// ——— toggle + toggle-group ———
export const toggleVariants = cva("tw:inline-flex tw:items-center tw:justify-center tw:gap-2 tw:rounded-md tw:text-sm tw:font-medium tw:whitespace-nowrap tw:text-foreground tw:transition-[color,box-shadow] tw:outline-none tw:hover:bg-muted tw:hover:text-muted-foreground tw:focus-visible:border-ring tw:focus-visible:ring-[3px] tw:focus-visible:ring-ring/50 tw:disabled:pointer-events-none tw:disabled:opacity-50 tw:data-[state=on]:bg-accent tw:data-[state=on]:text-accent-foreground tw:[&_svg]:pointer-events-none tw:[&_svg]:shrink-0 tw:[&_svg:not([class*='size-'])]:size-4", {
  variants: {
    variant: { default: "tw:bg-transparent tw:border-0", outline: "tw:border tw:border-solid tw:border-input tw:bg-transparent tw:shadow-xs tw:hover:bg-accent tw:hover:text-accent-foreground" },
    size: { default: "tw:h-9 tw:min-w-9 tw:px-2", sm: "tw:h-8 tw:min-w-8 tw:px-1.5", lg: "tw:h-10 tw:min-w-10 tw:px-2.5" },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});
const ToggleGroupContext = createContext({ size: 'default', variant: 'default', spacing: 0 });
export function ToggleGroup({ className, variant, size, spacing = 0, children, ...props }) {
  return (
    <ToggleGroupPrimitive.Root data-slot="toggle-group" data-variant={variant} data-size={size} data-spacing={spacing} style={{ '--gap': spacing }}
      className={cn("tw:group/toggle-group tw:flex tw:w-fit tw:items-center tw:rounded-md tw:data-[spacing=default]:data-[variant=outline]:shadow-xs", className)} {...props}>
      <ToggleGroupContext.Provider value={{ variant, size, spacing }}>{children}</ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  );
}
export function ToggleGroupItem({ className, children, variant, size, ...props }) {
  const ctx = useContext(ToggleGroupContext);
  return (
    <ToggleGroupPrimitive.Item data-slot="toggle-group-item" data-variant={ctx.variant || variant} data-size={ctx.size || size} data-spacing={ctx.spacing}
      className={cn(toggleVariants({ variant: ctx.variant || variant, size: ctx.size || size }),
        "tw:w-auto tw:min-w-0 tw:shrink-0 tw:px-3 tw:focus:z-10 tw:focus-visible:z-10",
        "tw:data-[spacing=0]:rounded-none tw:data-[spacing=0]:shadow-none tw:data-[spacing=0]:first:rounded-l-md tw:data-[spacing=0]:last:rounded-r-md tw:data-[spacing=0]:data-[variant=outline]:border-l-0 tw:data-[spacing=0]:data-[variant=outline]:first:border-l",
        className)} {...props}>
      {children}
    </ToggleGroupPrimitive.Item>
  );
}

// ——— dialog ———
export const Dialog = props => <DialogPrimitive.Root data-slot="dialog" {...props} />;
export const DialogTrigger = props => <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
export const DialogClose = props => <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
export function DialogContent({ className, children, showCloseButton = true, ...props }) {
  const container = usePortalContainer();
  return (
    <DialogPrimitive.Portal container={container}>
      <DialogPrimitive.Overlay data-slot="dialog-overlay" className={"tw:fixed tw:inset-0 tw:z-50 tw:bg-black/50"} />
      <DialogPrimitive.Content data-slot="dialog-content"
        className={cn("tw:fixed tw:top-[50%] tw:left-[50%] tw:z-50 tw:grid tw:w-full tw:max-w-[calc(100%-2rem)] tw:translate-x-[-50%] tw:translate-y-[-50%] tw:gap-4 tw:rounded-lg tw:border tw:border-solid tw:border-border tw:bg-background tw:text-foreground tw:p-6 tw:shadow-lg tw:duration-200 tw:outline-none tw:sm:max-w-lg", className)}
        {...props}>
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close data-slot="dialog-close"
            className={"tw:absolute tw:top-4 tw:right-4 tw:grid tw:place-items-center tw:size-6 tw:border-0 tw:bg-transparent tw:p-0 tw:text-foreground tw:rounded-xs tw:opacity-70 tw:transition-opacity tw:hover:opacity-100 tw:focus:ring-2 tw:focus:ring-ring tw:focus:ring-offset-2 tw:focus:outline-hidden tw:disabled:pointer-events-none tw:[&_svg]:pointer-events-none tw:[&_svg]:shrink-0 tw:[&_svg:not([class*='size-'])]:size-4"}>
            <XIcon />
            <span className={"tw:sr-only"}>Fermer</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
export const DialogHeader = ({ className, ...props }) => <div data-slot="dialog-header" className={cn("tw:flex tw:flex-col tw:gap-2 tw:text-center tw:sm:text-left", className)} {...props} />;
export const DialogFooter = ({ className, ...props }) => <div data-slot="dialog-footer" className={cn("tw:flex tw:flex-col-reverse tw:gap-2 tw:sm:flex-row tw:sm:justify-end", className)} {...props} />;
export const DialogTitle = ({ className, ...props }) => <DialogPrimitive.Title data-slot="dialog-title" className={cn("tw:m-0 tw:text-lg tw:leading-none tw:font-semibold", className)} {...props} />;
export const DialogDescription = ({ className, ...props }) => <DialogPrimitive.Description data-slot="dialog-description" className={cn("tw:m-0 tw:text-sm tw:text-muted-foreground", className)} {...props} />;

// ——— alert ———
const alertVariants = cva("tw:relative tw:grid tw:w-full tw:grid-cols-[0_1fr] tw:items-start tw:gap-y-0.5 tw:rounded-lg tw:border tw:border-solid tw:border-border tw:px-4 tw:py-3 tw:text-sm tw:has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] tw:has-[>svg]:gap-x-3 tw:[&>svg]:size-4 tw:[&>svg]:translate-y-0.5 tw:[&>svg]:text-current", {
  variants: { variant: { default: "tw:bg-card tw:text-card-foreground", destructive: "tw:bg-card tw:text-destructive tw:*:data-[slot=alert-description]:text-destructive/90 tw:[&>svg]:text-current" } },
  defaultVariants: { variant: 'default' },
});
export const Alert = ({ className, variant, ...props }) => <div data-slot="alert" role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
export const AlertTitle = ({ className, ...props }) => <div data-slot="alert-title" className={cn("tw:col-start-2 tw:line-clamp-1 tw:min-h-4 tw:font-medium tw:tracking-tight", className)} {...props} />;
export const AlertDescription = ({ className, ...props }) => <div data-slot="alert-description" className={cn("tw:col-start-2 tw:grid tw:justify-items-start tw:gap-1 tw:text-sm tw:text-muted-foreground tw:[&_p]:leading-relaxed tw:[&_p]:m-0", className)} {...props} />;
