// shadcn's cn(): clsx + tailwind-merge, aware of the lab's  tw:  prefix (src/tailwind.css).
import { clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

const twMerge = extendTailwindMerge({ prefix: 'tw' });
export function cn(...inputs) { return twMerge(clsx(inputs)); }
