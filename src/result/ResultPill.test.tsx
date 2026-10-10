import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import { DoneContent, ErrorContent, resultContent, showsResultPill, UndoneContent } from './ResultPill';
import { Countdown } from './countdown';
import type { AfterReplace } from '../types';

// The contents of the result pill in jsdom, on a simulated clock (timers, frames and
// performance.now faked together). The surface, its spring and the real frames are measured by
// Playwright (e2e/result.pw.ts).

let root: Root | undefined;
let host: HTMLElement | undefined;
beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'],
  });
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  root = host = undefined;
  vi.useRealTimers();
});

async function mount(node: ReactNode, reduced = false) {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root!.render(<MotionConfig reducedMotion={reduced ? 'always' : 'never'}>{node}</MotionConfig>));
  return host;
}
const advance = (ms: number) =>
  act(async () => {
    vi.advanceTimersByTime(ms);
  });
const arc = () =>
  Number(host!.querySelector('.result-ring circle:not(.track)')!.getAttribute('stroke-dasharray')!.split(' ')[0]);
const full = 2 * Math.PI * 5;
const hover = (element: Element, on: boolean) =>
  act(async () => {
    element.dispatchEvent(
      new MouseEvent(on ? 'mouseover' : 'mouseout', { bubbles: true, relatedTarget: document.body }),
    );
  });

describe('DoneContent', () => {
  it('draws the check, then counts Undo down and ends once', async () => {
    const onExpire = vi.fn();
    await mount(<DoneContent check undo durationMs={2000} onExpire={onExpire} />);
    expect(host!.querySelector('.result-check path')!.getAttribute('pathLength')).toBe('1');
    expect(host!.querySelector('.result-undo')!.textContent).toBe('Undo');
    expect(arc()).toBeCloseTo(full, 1);
    await advance(1000);
    expect(arc()).toBeCloseTo(full / 2, 0);
    expect(onExpire).not.toHaveBeenCalled();
    await advance(1000);
    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(arc()).toBe(0);
    await advance(5000);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('stops under the pointer and while Undo has the focus, and resumes where it stopped', async () => {
    const onExpire = vi.fn();
    await mount(<DoneContent check undo durationMs={2000} onExpire={onExpire} />);
    const row = host!.querySelector('.result-row')!;
    await advance(500);
    await hover(row, true);
    expect(row.hasAttribute('data-paused')).toBe(true);
    const held = arc();
    await advance(10_000);
    expect(onExpire).not.toHaveBeenCalled();
    expect(arc()).toBe(held);
    await hover(row, false);
    expect(row.hasAttribute('data-paused')).toBe(false);
    // The focus holds it too.
    await advance(500);
    const undo = host!.querySelector<HTMLButtonElement>('.result-undo')!;
    await act(async () => undo.focus());
    await advance(10_000);
    expect(onExpire).not.toHaveBeenCalled();
    await act(async () => undo.blur());
    await advance(999);
    expect(onExpire).not.toHaveBeenCalled();
    await advance(1);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('in reduced motion, steps the ring once a second while the time runs as usual', async () => {
    const onExpire = vi.fn();
    await mount(<DoneContent check undo durationMs={2000} onExpire={onExpire} />, true);
    await advance(900);
    expect(arc()).toBeCloseTo(full, 1);
    await advance(100);
    expect(arc()).toBeCloseTo(full / 2, 1);
    await advance(999);
    expect(arc()).toBeCloseTo(full / 2, 1);
    expect(onExpire).not.toHaveBeenCalled();
    await advance(1);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('shows the check alone, or Undo alone, centred', async () => {
    await mount(<DoneContent check undo={false} durationMs={1100} />);
    expect(host!.querySelector('.result-row')!.className).toBe('result-row is-check-only');
    expect(host!.querySelector('.result-undo')).toBeNull();
    await act(async () => root!.render(<DoneContent check={false} undo durationMs={8000} />));
    expect(host!.querySelector('.result-row')!.className).toBe('result-row is-undo-only');
    expect(host!.querySelector('.result-check')).toBeNull();
  });

  it('keeps a shared clock across the contents that follow each other, and holds it while Undo is on its way', async () => {
    const onExpire = vi.fn();
    const clock = new Countdown(4000, performance.now());
    await mount(<DoneContent key="with-undo" check undo durationMs={4000} clock={clock} onExpire={onExpire} />);
    await advance(1000);
    // Undo on its way: the time stands still, the button waits.
    await act(async () =>
      root!.render(
        <MotionConfig reducedMotion="never">
          <DoneContent key="with-undo" check undo busy durationMs={4000} clock={clock} onExpire={onExpire} />
        </MotionConfig>,
      ),
    );
    expect(host!.querySelector('.result-undo')!.getAttribute('aria-disabled')).toBe('true');
    await advance(10_000);
    expect(onExpire).not.toHaveBeenCalled();
    // Withdrawn: the check alone takes its place, already drawn, on the same clock (3 s left).
    await act(async () =>
      root!.render(
        <MotionConfig reducedMotion="never">
          <DoneContent key="check" check undo={false} drawn durationMs={1100} clock={clock} onExpire={onExpire} />
        </MotionConfig>,
      ),
    );
    expect(host!.querySelector('.result-undo')).toBeNull();
    expect(host!.querySelector('.result-check')!.classList.contains('is-drawn')).toBe(true);
    // The busy hold went with the content that held it.
    await advance(2999);
    expect(onExpire).not.toHaveBeenCalled();
    await advance(1);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('never calls onUndo while Undo is on its way', async () => {
    const waiting = vi.fn();
    await mount(<DoneContent check undo busy durationMs={8000} onUndo={waiting} />);
    await act(async () => host!.querySelector<HTMLButtonElement>('.result-undo')!.click());
    expect(waiting).not.toHaveBeenCalled();
  });

  it('calls onUndo from its button', async () => {
    const onUndo = vi.fn();
    await mount(<DoneContent check undo durationMs={8000} onUndo={onUndo} />);
    await act(async () => host!.querySelector<HTMLButtonElement>('.result-undo')!.click());
    expect(onUndo).toHaveBeenCalledTimes(1);
  });
});

describe('UndoneContent', () => {
  it('says Undone for 0.9 s', async () => {
    const onExpire = vi.fn();
    await mount(<UndoneContent onExpire={onExpire} />);
    expect(host!.textContent).toBe('Undone');
    // Its host announces it (the Îlot's status): no second live region here.
    expect(host!.querySelector('[role="status"], [role="alert"], [aria-live]')).toBeNull();
    await advance(899);
    expect(onExpire).not.toHaveBeenCalled();
    await advance(1);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });
});

describe('ErrorContent', () => {
  it('opens the exact field of a configuration error', async () => {
    const onAction = vi.fn();
    await mount(<ErrorContent error="unauthorized" serverId="s2" onAction={onAction} />);
    expect(host!.querySelector('[role="alert"]')!.textContent).toBe('API key rejected');
    await act(async () => host!.querySelector<HTMLButtonElement>('.result-action')!.click());
    expect(onAction).toHaveBeenCalledWith({ type: 'settings', field: 's2.apiKey' });
  });

  it('shows Copied in place of Copy result, then dismisses after 0.9 s', async () => {
    const onDismiss = vi.fn();
    const onAction = vi.fn(async () => true);
    await mount(<ErrorContent error="target_changed" onAction={onAction} onDismiss={onDismiss} />);
    const labels = () =>
      [...host!.querySelectorAll('.result-swap > span')].map((span) => [
        span.textContent,
        span.getAttribute('aria-hidden'),
      ]);
    expect(labels()).toEqual([
      ['Copy result', null],
      ['Copied', 'true'],
    ]);
    await act(async () => host!.querySelector<HTMLButtonElement>('.result-action')!.click());
    expect(onAction).toHaveBeenCalledWith({ type: 'copy' });
    expect(labels()).toEqual([
      ['Copy result', 'true'],
      ['Copied', null],
    ]);
    await advance(899);
    expect(onDismiss).not.toHaveBeenCalled();
    await advance(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('keeps Copy result when the copy was refused, and dismisses on ✕', async () => {
    const onDismiss = vi.fn();
    await mount(<ErrorContent error="paste_blocked" onAction={() => false} onDismiss={onDismiss} />);
    await act(async () => host!.querySelector<HTMLButtonElement>('.result-action')!.click());
    await advance(2000);
    expect(onDismiss).not.toHaveBeenCalled();
    expect(host!.querySelector('.result-swap > span')!.getAttribute('aria-hidden')).toBeNull();
    await act(async () => host!.querySelector<HTMLButtonElement>('.result-close')!.click());
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('offers Try again for a transient error and no button for a content error', async () => {
    const onAction = vi.fn();
    await mount(<ErrorContent error="busy" onAction={onAction} />);
    await act(async () => host!.querySelector<HTMLButtonElement>('.result-action')!.click());
    expect(onAction).toHaveBeenCalledWith({ type: 'retry' });
    await act(async () => root!.render(<ErrorContent error="too_long" onDismiss={() => undefined} />));
    expect(host!.querySelector('.result-action')).toBeNull();
    expect(host!.querySelectorAll('button').length).toBe(1);
  });

  it('says why an Undo could not be done, in its own words, with ✕ only', async () => {
    const onAction = vi.fn();
    await mount(<ErrorContent error="target_changed" source="undo" onAction={onAction} onDismiss={() => undefined} />);
    expect(host!.querySelector('[role="alert"]')!.textContent).toBe('Text changed — can’t undo');
    expect([...host!.querySelectorAll('button')].map((button) => button.getAttribute('aria-label'))).toEqual(['Close']);
    await act(async () =>
      root!.render(<ErrorContent error="paste_blocked" source="undo-sent" onDismiss={() => undefined} />),
    );
    expect(host!.querySelector('[role="alert"]')!.textContent).toBe('Undo not confirmed — check text');
    expect(onAction).not.toHaveBeenCalled();
  });

  it('says a refused capture without any button: nothing to retry or copy, and no ✕ without onDismiss', async () => {
    const onAction = vi.fn();
    // The source window changed during the capture: nothing was tried, the capture's own words.
    await mount(<ErrorContent error="target_changed" source="capture" onAction={onAction} />);
    expect(host!.querySelector('[role="alert"]')!.textContent).toBe('Window changed — try again');
    expect(host!.querySelectorAll('button').length).toBe(0);
    await act(async () => root!.render(<ErrorContent error="no_selection" source="capture" />));
    expect(host!.querySelector('[role="alert"]')!.textContent).toBe('Select some text first');
    expect(host!.querySelectorAll('button').length).toBe(0);
    // The Settings in front has its own code (settings_open).
    await act(async () => root!.render(<ErrorContent error="settings_open" source="capture" />));
    expect(host!.querySelector('[role="alert"]')!.textContent).toBe('Close Settings first');
    // The pill is capped: the Îlot's window holds its widest.
    expect(host!.querySelector<HTMLElement>('.result-error')!.style.maxWidth).toBe('400px');
  });
});

describe('resultContent', () => {
  const after = (patch: Partial<AfterReplace> = {}): AfterReplace => ({
    check: true,
    undo: true,
    undoSeconds: 8,
    changedWords: true,
    changedWordsSeconds: 60,
    ...patch,
  });
  it('keys each stage, sizes the work pill, and leaves the others to their content', () => {
    expect(resultContent({ stage: 'working', indicator: 'perle' })).toMatchObject({
      key: 'working',
      size: { width: 44, height: 28 },
    });
    expect(resultContent({ stage: 'working', indicator: 'ruban' })).toMatchObject({
      key: 'working',
      size: { width: 52, height: 28 },
    });
    for (const [stage, key] of [
      [{ stage: 'done', afterReplace: after() }, 'done'],
      [{ stage: 'done', afterReplace: after({ undo: false }) }, 'done-check'],
      [{ stage: 'undone' }, 'undone'],
      [{ stage: 'error', error: 'busy' }, 'error-busy'],
    ] as const) {
      const content = resultContent(stage)!;
      expect(content.key).toBe(key);
      expect(content.size).toBeUndefined();
    }
  });
  it('shows no pill for a done stage without check and Undo, nor for a cancelled run', () => {
    expect(showsResultPill({ stage: 'done', afterReplace: after({ check: false, undo: false }) })).toBe(false);
    expect(showsResultPill({ stage: 'done', afterReplace: after({ undo: false }) })).toBe(true);
    expect(showsResultPill({ stage: 'error', error: 'cancelled' })).toBe(false);
  });
});
