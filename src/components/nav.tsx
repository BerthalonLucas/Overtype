import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { motion } from 'motion/react';
import { NAV_GLIDE } from './motion';

// Vertical tabs (Radix Tabs): the sidebar of the Settings (design-lab/reglages/src/ui/index.jsx).
//   <Tabs value onValueChange><TabList label="…"><Tab value="general" icon={…}>General</Tab>…</TabList>
//     <TabPanel value="general">…</TabPanel></Tabs>
// Each Tab carries data-ft-page (its value, or `page`): its icon takes that page's colour. The
// selection is ONE pill in the list that glides from the previous item to the clicked one (a hint
// of delay, a soft spring, passing over the items in between), tinted by the selected page. It
// never follows the mouse: hover is a separate faint tint on the item.
const TabsContext = createContext<string | undefined>(undefined);
export function Tabs({
  value,
  onValueChange,
  children,
  className = '',
}: {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <TabsContext.Provider value={value}>
      <TabsPrimitive.Root
        className={`ft-tabs ${className}`}
        orientation="vertical"
        value={value}
        onValueChange={onValueChange}
        activationMode="manual"
      >
        {children}
      </TabsPrimitive.Root>
    </TabsContext.Provider>
  );
}
type Pill = { y: number; height: number; page?: string };
export function TabList({
  label,
  children,
  className = '',
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const value = useContext(TabsContext);
  const list = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<Pill | null>(null);
  const measure = useCallback(() => {
    const root = list.current;
    if (!root) return;
    const active = root.querySelector<HTMLElement>('[role="tab"][data-state="active"]');
    if (!active) {
      setPill(null);
      return;
    }
    // offsetTop ignores transforms (an item still fading in), so the pill lands on the item's resting place.
    let y = 0;
    for (let node: HTMLElement | null = active; node && node !== root; ) {
      y += node.offsetTop;
      const parent = node.offsetParent as HTMLElement | null;
      node = parent && root.contains(parent) ? parent : null;
    }
    const next: Pill = { y, height: active.offsetHeight, page: active.dataset.ftPage };
    setPill((current) =>
      current && current.y === next.y && current.height === next.height && current.page === next.page ? current : next,
    );
  }, []);
  useLayoutEffect(measure, [value, measure]);
  useEffect(() => {
    const root = list.current;
    if (!root || typeof ResizeObserver === 'undefined') return undefined;
    const resize = new ResizeObserver(measure);
    resize.observe(root);
    const mutation = new MutationObserver(measure);
    mutation.observe(root, { subtree: true, attributes: true, attributeFilter: ['data-state'], childList: true });
    return () => {
      resize.disconnect();
      mutation.disconnect();
    };
  }, [measure]);
  return (
    <TabsPrimitive.List ref={list} className={`ft-tablist ${className}`} aria-label={label}>
      {pill && (
        <motion.span
          className="ft-tab-pill"
          aria-hidden="true"
          data-ft-page={pill.page}
          initial={false}
          animate={{ y: pill.y }}
          transition={NAV_GLIDE}
          style={{ height: pill.height }}
        />
      )}
      {children}
    </TabsPrimitive.List>
  );
}
export function Tab({
  value,
  icon,
  page,
  children,
  badge,
  className = '',
}: {
  value: string;
  icon?: ReactNode;
  page?: string;
  children: ReactNode;
  badge?: ReactNode;
  className?: string;
}) {
  // The title names the tab when a narrow window keeps the icons only.
  return (
    <TabsPrimitive.Trigger
      value={value}
      className={`ft-tab ${className}`}
      data-ft-page={page ?? value}
      title={typeof children === 'string' ? children : undefined}
    >
      {icon && (
        <span className="ft-tab-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="ft-tab-label">{children}</span>
      {badge}
    </TabsPrimitive.Trigger>
  );
}
export function TabPanel({
  value,
  children,
  className = '',
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <TabsPrimitive.Content value={value} className={`ft-tabpanel ${className}`}>
      {children}
    </TabsPrimitive.Content>
  );
}
