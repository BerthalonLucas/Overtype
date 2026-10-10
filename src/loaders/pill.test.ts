import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { indicatorBox, indicatorOf, indicators, ORB_DELAY_MS, workingPill, workingPillShape } from './pill';
import { WorkingPill } from './WorkingPill';

describe('working pill shape (lot 8)', () => {
  // docs/DA-PLAN.md lot 8: 28 high, 44 wide for Perle and Nébuleuse, 52 for the Ruban, radius 14.
  it('is 44 × 28 for the orbs and 52 × 28 for the Ruban, fully round', () => {
    expect(workingPillShape('perle')).toEqual({ width: 44, height: 28, borderRadius: 14 });
    expect(workingPillShape('nebuleuse')).toEqual({ width: 44, height: 28, borderRadius: 14 });
    expect(workingPillShape('ruban')).toEqual({ width: 52, height: 28, borderRadius: 14 });
  });

  // The lab's .pill-row: 12 px each side of the content, never under 44 px (app.css:155).
  it('keeps 12 px each side of every indicator and fits it in the height', () => {
    for (const indicator of indicators) {
      const shape = workingPillShape(indicator),
        box = indicatorBox[indicator];
      expect(shape.width - box.width).toBeGreaterThanOrEqual(2 * workingPill.paddingX);
      expect(box.height).toBeLessThan(shape.height);
    }
  });

  it('shows Perle for anything it does not know', () => {
    expect(indicators.map(indicatorOf)).toEqual(['perle', 'nebuleuse', 'ruban']);
    for (const value of [undefined, null, '', 'souffle', 'Perle', 3]) expect(indicatorOf(value)).toBe('perle');
  });
});

describe('WorkingPill', () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.useRealTimers();
  });
  const pill = () => host.querySelector<HTMLElement>('.working-pill')!;

  it('holds an empty slot of the indicator’s size for 250 ms, then the orb, at the same pill size', async () => {
    await act(async () => root.render(createElement(WorkingPill, { indicator: 'ruban' })));
    expect(pill().style.width).toBe('52px');
    expect(pill().style.height).toBe('28px');
    expect(host.querySelector<HTMLElement>('.working-slot')!.style.cssText).toContain('width: 28px');
    expect(host.querySelector('.ldr')).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(ORB_DELAY_MS - 1);
    });
    expect(host.querySelector('.ldr')).toBeNull();
    expect(pill().dataset.orb).toBe('waiting');
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(host.querySelector('.ldr.sinus.ruban')).not.toBeNull();
    expect(pill().dataset.orb).toBe('shown');
    expect(pill().style.width).toBe('52px');
    // Nothing textual: the name is for assistive technologies only.
    expect(pill().textContent).toBe('');
    expect(pill().getAttribute('aria-label')).toBe('Working');
  });

  it('never shows the orb when the work ends first: the check stands in its place', async () => {
    await act(async () => root.render(createElement(WorkingPill, { indicator: 'perle' })));
    await act(async () => {
      vi.advanceTimersByTime(120);
    });
    await act(async () => root.render(createElement(WorkingPill, { indicator: 'perle', done: true })));
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(host.querySelector('.ldr')).toBeNull();
    expect(pill().dataset.done).toBe('true');
    expect(pill().querySelector('svg.lucide-check')).not.toBeNull();
    expect(pill().getAttribute('aria-label')).toBe('Selection replaced');
    expect(pill().style.width).toBe('44px');
  });

  it('marks its loops paused while the page is hidden', async () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get');
    await act(async () => root.render(createElement(WorkingPill, { indicator: 'nebuleuse' })));
    expect(pill().dataset.paused).toBeUndefined();
    visibility.mockReturnValue('hidden');
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(pill().dataset.paused).toBe('true');
    visibility.mockReturnValue('visible');
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(pill().dataset.paused).toBeUndefined();
    visibility.mockRestore();
  });
});
