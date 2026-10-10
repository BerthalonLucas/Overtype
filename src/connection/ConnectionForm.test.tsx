import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { TooltipProvider } from '../components/controls';
import { ConnectionForm, type ConnectionValue } from './ConnectionForm';

const must = <T,>(value: T | null | undefined): T => {
  if (value == null) throw new Error('missing');
  return value;
};

// FE-03 (audit Elio): the address, key and model fields said their hint or their problem under
// them, but a screen reader on the field heard neither.
let root: Root;
let host: HTMLElement;
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
const render = (value: ConnectionValue) =>
  act(async () =>
    root.render(
      <TooltipProvider>
        <ConnectionForm value={value} onChange={() => undefined} variant="settings" check={false} />
      </TooltipProvider>,
    ),
  );
const description = (element: Element) =>
  (element.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent);

describe('the connection form', () => {
  it('ties each hint, then each problem, to its field', async () => {
    await render({ endpoint: '', apiKey: '', noKey: false, model: '' });
    const [address, key] = [...host.querySelectorAll('input')];
    const model = must(host.querySelector('[role="combobox"]'));
    expect(description(address)).toEqual(['Just the address, without /v1: we take care of it.']);
    expect(address.hasAttribute('aria-invalid')).toBe(false);
    expect(description(key)).toHaveLength(1);
    expect(description(key)[0]).toBeTruthy();
    expect(description(model)).toHaveLength(1);
    expect(description(model)[0]).toBeTruthy();

    await render({ endpoint: 'ftp://llm.exemple.com', apiKey: '', noKey: false, model: '' });
    const invalid = must(host.querySelector('input'));
    expect(invalid.getAttribute('aria-invalid')).toBe('true');
    expect(description(invalid)).toEqual([must(host.querySelector('.ft-field-problem')).textContent]);
  });
});
