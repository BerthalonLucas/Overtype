import {
  forwardRef,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type Ref,
  type UIEvent,
} from 'react';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';

// The only scrollbar of the Settings and the setup (design-lab/reglages/src/ui/index.jsx): a thin
// overlay thumb (6 px, 10 px on hover), rounded, shown on scroll or hover, no arrows; the content
// fades out at an edge that has more to scroll (a mask: works on any background).
// shadows: true | 'top' | 'bottom' | false. viewportRef / onScroll reach the scrolling element.
// maxHeight: grow with the content up to that.
function assign<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === 'function') ref(value);
  else if (ref) (ref as { current: T | null }).current = value;
}
type Props = {
  className?: string;
  viewportClassName?: string;
  viewportRef?: Ref<HTMLDivElement>;
  onScroll?: (event: UIEvent<HTMLDivElement>) => void;
  shadows?: boolean | 'top' | 'bottom';
  maxHeight?: string | number;
  children: ReactNode;
  style?: CSSProperties;
};
export const ScrollArea = forwardRef<HTMLDivElement, Props>(function ScrollArea(
  { className = '', viewportClassName = '', viewportRef, onScroll, shadows = true, maxHeight, children, style },
  ref,
) {
  const viewport = useRef<HTMLDivElement | null>(null);
  const [edge, setEdge] = useState({ top: false, bottom: false, tiny: false });
  const update = useCallback(() => {
    const element = viewport.current;
    if (!element) return;
    // A few pixels of overflow (padding) is not worth a near-full-height thumb nor an edge fade.
    const over = element.scrollHeight - element.clientHeight;
    const tiny = over > 0 && over < 8;
    const top = !tiny && element.scrollTop > 1;
    const bottom = !tiny && element.scrollTop + element.clientHeight < element.scrollHeight - 1;
    setEdge((current) =>
      current.top === top && current.bottom === bottom && current.tiny === tiny ? current : { top, bottom, tiny },
    );
  }, []);
  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return undefined;
    update();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    return () => observer.disconnect();
  }, [update]);
  const top = edge.top && (shadows === true || shadows === 'top');
  const bottom = edge.bottom && (shadows === true || shadows === 'bottom');
  return (
    <ScrollAreaPrimitive.Root
      ref={ref}
      type="hover"
      scrollHideDelay={700}
      className={`ft-scroll ${className}`}
      style={style}
      data-tiny={edge.tiny ? '' : undefined}
    >
      <ScrollAreaPrimitive.Viewport
        ref={(element) => {
          viewport.current = element;
          assign(viewportRef, element);
        }}
        className={`ft-scroll-viewport ${viewportClassName}`}
        data-fade-top={top ? '' : undefined}
        data-fade-bottom={bottom ? '' : undefined}
        style={maxHeight ? { maxHeight } : undefined}
        onScroll={(event) => {
          update();
          onScroll?.(event);
        }}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollAreaPrimitive.Scrollbar className="ft-scrollbar" orientation="vertical" forceMount>
        <ScrollAreaPrimitive.Thumb className="ft-scroll-thumb" />
      </ScrollAreaPrimitive.Scrollbar>
    </ScrollAreaPrimitive.Root>
  );
});
