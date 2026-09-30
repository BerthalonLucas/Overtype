// shadcn/ui Button (new-york, v4), copied as shadcn does, with the lab's  tw:  prefix on every
// utility. Template for other shadcn components: copy from ui.shadcn.com, prefix each class with
// tw:, keep Radix / cva / cn. Colours (primary, secondary, accent…) resolve to the lab tokens
// (src/tailwind.css), so they follow direction / palette / theme.
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/cn.js';

export const buttonVariants = cva(
  "tw:inline-flex tw:items-center tw:justify-center tw:gap-2 tw:whitespace-nowrap tw:rounded-md tw:text-sm tw:font-medium tw:transition-all tw:disabled:pointer-events-none tw:disabled:opacity-50 tw:[&_svg]:pointer-events-none tw:[&_svg]:shrink-0 tw:outline-none tw:focus-visible:ring-[3px] tw:focus-visible:ring-ring/50 tw:border-0",
  {
    variants: {
      variant: {
        default: 'tw:bg-primary tw:text-primary-foreground tw:shadow-xs tw:hover:opacity-90',
        destructive: 'tw:bg-destructive tw:text-white tw:shadow-xs tw:hover:opacity-90',
        outline: 'tw:border tw:border-solid tw:border-input tw:bg-background tw:text-foreground tw:shadow-xs tw:hover:bg-accent tw:hover:text-accent-foreground',
        secondary: 'tw:bg-secondary tw:text-secondary-foreground tw:shadow-xs tw:hover:opacity-90',
        ghost: 'tw:bg-transparent tw:text-foreground tw:hover:bg-accent tw:hover:text-accent-foreground',
        link: 'tw:bg-transparent tw:text-accent-foreground tw:underline-offset-4 tw:hover:underline',
      },
      size: {
        default: 'tw:h-9 tw:px-4 tw:py-2',
        sm: 'tw:h-8 tw:rounded-md tw:gap-1.5 tw:px-3',
        lg: 'tw:h-10 tw:rounded-md tw:px-6',
        icon: 'tw:size-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export function ShadcnButton({ className, variant, size, asChild = false, ...props }) {
  const Comp = asChild ? Slot : 'button';
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
