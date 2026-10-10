import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { iconFromLucide } from '../ui';
import { cleanInstruction, Ilot, type IlotHandle, type IlotProps } from './Ilot';
import type { IlotAction } from './keys';

const actions: IlotAction[] = [
  { id: 'fix', name: 'Fix grammar', shortName: 'Fix', key: 'F', icon: 'SpellCheck' },
  { id: 'translate', name: 'Translate', key: 'T', icon: 'Languages' },
  { id: 'pro', name: 'Make professional', shortName: 'Pro', key: 'P', icon: 'NotAnIcon' },
];

let root: Root | undefined;
let host: HTMLElement | undefined;
afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  root = host = undefined;
});

async function mount(props: Partial<IlotProps> = {}) {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  const handle = createRef<IlotHandle>();
  const calls = { onChoose: vi.fn(), onInstruction: vi.fn(), onClose: vi.fn() };
  const render = async (next: Partial<IlotProps> = {}) =>
    act(async () =>
      root!.render(<Ilot ref={handle} actions={actions} lastActionId="translate" {...calls} {...props} {...next} />),
    );
  await render();
  const press = async (key: string) => {
    let used = false;
    await act(async () => {
      used = handle.current!.press(key);
    });
    return used;
  };
  const keydown = async (key: string, init: KeyboardEventInit = {}) =>
    act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
    });
  const mode = () => host!.querySelector('[data-ilot]')?.getAttribute('data-mode');
  const present = () => host!.querySelector('.shape-layer:not(.is-leaving)')!;
  return { calls, press, keydown, mode, present, render };
}

describe('iconFromLucide', () => {
  it('finds the registry entry drawn with a Lucide glyph, none for an unknown name', () => {
    expect(
      [
        'SpellCheck',
        'Languages',
        'BriefcaseBusiness',
        'FoldVertical',
        'Mail',
        'WandSparkles',
        'Undo2',
        'Settings2',
        'TriangleAlert',
        'KeyRound',
        'Server',
        'Cpu',
      ].map(iconFromLucide),
    ).toEqual([
      'fix',
      'translate',
      'professional',
      'shorten',
      'email',
      'custom',
      'undo',
      'settings',
      'error',
      'key',
      'server',
      'model',
    ]);
    expect(iconFromLucide('NotAnIcon')).toBeUndefined();
    expect(iconFromLucide(undefined)).toBeUndefined();
  });
});

describe('cleanInstruction', () => {
  it('sends no NUL, no surrounding blanks and at most 1000 characters', () => {
    expect(cleanInstruction('  plus\0 court \n')).toBe('plus court');
    expect([...cleanInstruction('é'.repeat(1200))]).toHaveLength(1000);
    expect(cleanInstruction(' \0 ')).toBe('');
  });
});

describe('Ilot', () => {
  it('shows the last action and the pastille, then the tiles in the given order', async () => {
    const { press, mode, present } = await mount();
    expect(mode()).toBe('compact');
    expect(present().querySelector('[data-item="last"]')!.textContent).toBe('Translate↵');
    expect(present().querySelector('[data-item="last"]')).toBe(document.activeElement);
    expect(await press('Tab')).toBe(true);
    expect(mode()).toBe('grid');
    const tiles = [...present().querySelectorAll('[role="menuitem"]')];
    expect(tiles.map((tile) => tile.getAttribute('data-tile'))).toEqual(['fix', 'translate', 'pro', 'ask']);
    expect(tiles.map((tile) => tile.textContent)).toEqual(['Fix', 'Translate', 'Pro', 'Ask']);
    // An icon outside the registry is left out, the tile keeps its label.
    expect(tiles.map((tile) => tile.querySelectorAll('svg').length)).toEqual([1, 1, 0, 1]);
    expect(tiles[1]).toBe(document.activeElement);
  });

  it('answers the window keys while it has the keyboard, and leaves Ctrl combinations', async () => {
    const { calls, keydown, mode } = await mount();
    await keydown('p', { ctrlKey: true });
    expect(calls.onChoose).not.toHaveBeenCalled();
    await keydown('p');
    expect(calls.onChoose).toHaveBeenCalledWith('pro');
    await keydown('x');
    expect(mode()).toBe('prompt');
    const input = document.activeElement as HTMLInputElement;
    expect(input.value).toBe('x');
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    });
    expect(mode()).toBe('compact');
    expect(calls.onClose).not.toHaveBeenCalled();
    // The focus outside the input (review of bc57857, finding 5): Escape still goes back one step.
    await keydown('x');
    expect(mode()).toBe('prompt');
    (document.activeElement as HTMLElement).blur();
    await keydown('Escape');
    expect(mode()).toBe('compact');
    expect(calls.onClose).not.toHaveBeenCalled();
    await keydown('Escape');
    expect(calls.onClose).toHaveBeenCalledTimes(1);
  });

  // Review of bc57857, finding 5: a click on the field's dot or ↵ took the focus from the input.
  it('keeps the focus in the field when its dot or ↵ is pressed, and sends on the ↵ like Enter', async () => {
    const { calls, keydown, present } = await mount();
    await keydown(' ');
    const input = present().querySelector<HTMLInputElement>('input')!;
    expect(document.activeElement).toBe(input);
    for (const part of ['.ilot-dot', '.ilot-keycap', '.ilot-field']) {
      const press = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      present().querySelector(part)!.dispatchEvent(press);
      expect(press.defaultPrevented, part).toBe(true);
    }
    const onInput = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    input.dispatchEvent(onInput);
    expect(onInput.defaultPrevented).toBe(false);
    // Blank: nothing is sent; a (synthetic) instruction is sent trimmed, once per click.
    await act(async () => {
      present().querySelector<HTMLElement>('.ilot-keycap')!.click();
    });
    expect(calls.onInstruction).not.toHaveBeenCalled();
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '  plus court  ');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      present().querySelector<HTMLElement>('.ilot-keycap')!.click();
    });
    expect(calls.onInstruction).toHaveBeenCalledWith('plus court');
  });

  it('takes only the keys it is given when Rust forwards them, without a field', async () => {
    const { calls, press, keydown, mode, present } = await mount({ keyboard: 'injected' });
    expect(document.activeElement).toBe(document.body);
    await keydown('t');
    expect(calls.onChoose).not.toHaveBeenCalled();
    expect(present().querySelector('[data-item="ask"]')!.getAttribute('aria-disabled')).toBe('true');
    expect(await press(' ')).toBe(true);
    expect(await press('x')).toBe(false);
    expect(mode()).toBe('compact');
    expect(await press('ArrowDown')).toBe(true);
    expect(await press('Enter')).toBe(true);
    expect(calls.onChoose).toHaveBeenCalledWith('translate');
  });

  // Lot 9 (the native agent's measure): the keys the window received before the Îlot listened are replayed
  // through press() once it shows, with their modifiers; those after the one that opened the
  // field are its text.
  it('replays the keys typed before it showed: a chord is not a letter, and the characters after the field opened are its text', async () => {
    const { calls, mode, present } = await mount();
    const ref = createRef<IlotHandle>();
    await act(async () => root!.render(<Ilot ref={ref} actions={actions} lastActionId="translate" {...calls} />));
    // Ctrl+T is the system's, never the letter of Translate.
    let used = true;
    await act(async () => {
      used = ref.current!.press('t', { ctrlKey: true });
    });
    expect(used).toBe(false);
    expect(calls.onChoose).not.toHaveBeenCalled();
    // Replayed together (one frame): « q » opens the field, « u », « i » and an AltGr « € » join it.
    await act(async () => {
      for (const [key, modifiers] of [
        ['q', {}],
        ['u', {}],
        ['i', { shiftKey: true }],
        ['€', { ctrlKey: true, altKey: true, altGraph: true }],
      ] as const)
        ref.current!.press(key, modifiers);
    });
    expect(mode()).toBe('prompt');
    const input = present().querySelector('input')!;
    expect(input.value).toBe('qui€');
    // A key replayed once the field shows is typed into it too; a chord or a named key is not.
    await act(async () => {
      ref.current!.press('x');
      ref.current!.press('v', { ctrlKey: true });
      ref.current!.press('ArrowLeft');
    });
    expect(input.value).toBe('qui€x');
    expect(calls.onInstruction).not.toHaveBeenCalled();
  });

  // Review of bc57857, finding 3: the dimmed ✦ and « Ask » did nothing once the keys came from Rust.
  it('asks for the keyboard when the pastille or the « Ask » tile is clicked without it, and opens the field once granted', async () => {
    const onRequestKeyboard = vi.fn(async () => false);
    const { mode, present, press, render } = await mount({ keyboard: 'injected', onRequestKeyboard });
    await act(async () => {
      present().querySelector<HTMLButtonElement>('[data-item="ask"]')!.click();
    });
    expect(onRequestKeyboard).toHaveBeenCalledTimes(1);
    expect(mode()).toBe('compact');
    expect(present().querySelector('input')).toBeNull();
    // Granted from the grid's « Ask » tile: the parent then passes the keyboard it holds.
    onRequestKeyboard.mockResolvedValue(true);
    expect(await press('Tab')).toBe(true);
    await act(async () => {
      present().querySelector<HTMLButtonElement>('[data-tile="ask"]')!.click();
    });
    expect(onRequestKeyboard).toHaveBeenCalledTimes(2);
    await render({ keyboard: 'focused', onRequestKeyboard });
    expect(mode()).toBe('prompt');
    expect(document.activeElement).toBe(present().querySelector('input'));
  });

  // Lucas, 24/09: the pointer unfolds the grid from the ✦ only, never from the last action.
  it('unfolds the grid after 450 ms on the ✦ only; the last action and a pointer that leaves never do', async () => {
    const { mode, present } = await mount();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const pointer = (element: Element, on: boolean) =>
        act(async () => {
          element.dispatchEvent(
            new MouseEvent(on ? 'mouseover' : 'mouseout', { bubbles: true, relatedTarget: document.body }),
          );
        });
      const advance = (ms: number) =>
        act(async () => {
          vi.advanceTimersByTime(ms);
        });
      const last = present().querySelector('[data-item="last"]')!;
      const ask = present().querySelector('[data-item="ask"]')!;
      await pointer(last, true);
      await advance(1000);
      expect(mode()).toBe('compact');
      await pointer(last, false);
      await pointer(ask, true);
      await advance(300);
      await pointer(ask, false);
      await advance(1000);
      expect(mode()).toBe('compact');
      await pointer(ask, true);
      await advance(449);
      expect(mode()).toBe('compact');
      await advance(1);
      expect(mode()).toBe('grid');
    } finally {
      vi.useRealTimers();
    }
  });

  it('becomes the pill on the same surface, ignores the menu keys there, and starts over compact', async () => {
    const { press, mode, render } = await mount({ initialMode: 'grid' });
    const surface = host!.querySelector('[data-ilot-shape]');
    await render({
      shape: 'pill',
      pill: { key: 'working', size: { width: 44, height: 28 }, node: <span data-testid="orb" /> },
    });
    expect(host!.querySelector('[data-ilot]')!.getAttribute('data-shape')).toBe('pill');
    expect(host!.querySelector('.shape-layer:not(.is-leaving) [data-testid="orb"]')).not.toBeNull();
    expect(host!.querySelector('[data-ilot-shape]')).toBe(surface);
    expect(await press('f')).toBe(false);
    // Another pill content (the error pill, of its natural size): a new layer on the same surface,
    // the previous one leaving.
    await render({ shape: 'pill', pill: { key: 'error-busy', node: <span data-testid="error" /> } });
    expect(host!.querySelector('.shape-layer:not(.is-leaving) [data-testid="error"]')).not.toBeNull();
    expect(host!.querySelector('.shape-layer:not(.is-leaving) [data-testid="orb"]')).toBeNull();
    expect(host!.querySelector('[data-ilot-shape]')).toBe(surface);
    await render({ shape: 'menu' });
    expect(mode()).toBe('compact');
    expect(host!.querySelector('[data-ilot-shape]')).toBe(surface);
  });
});
