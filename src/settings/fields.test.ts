import { afterEach, describe, expect, it, vi } from 'vitest';
import { fieldFromLocation, highlightMs, pageOfField, resolveField, revealField, serverOfField } from './fields';

describe('direct links to a Settings field', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('resolves the stable identifiers; a bare server field is the default server’s', () => {
    const servers = [{ id: 's1' }, { id: 's2' }];
    expect(resolveField('menuShortcut', servers, 's1')).toBe('menuShortcut');
    expect(resolveField('endpoint', servers, 's1')).toBe('s1.endpoint');
    expect(resolveField('apiKey', servers, 's2')).toBe('s2.apiKey');
    expect(resolveField('s2.model', servers, 's1')).toBe('s2.model');
    // A server that no longer exists, a profile of 0.5, anything else: ignored.
    for (const unknown of ['', null, 'model.s2', 's3.model', 'quality.endpoint', 's1.model.x', 'history', 's1.'])
      expect(resolveField(unknown, servers, 's1')).toBeNull();
    expect(fieldFromLocation('?window=settings&field=s1.apiKey')).toBe('s1.apiKey');
    expect(fieldFromLocation('?window=settings')).toBeNull();
  });

  it('knows the page of a field, and the server whose card must unfold', () => {
    expect(pageOfField('menuShortcut')).toBe('shortcuts');
    expect(serverOfField('menuShortcut')).toBeNull();
    expect(pageOfField('s2.apiKey')).toBe('server');
    expect(serverOfField('s2.apiKey')).toBe('s2');
    expect(serverOfField('my-server.endpoint')).toBe('my-server');
  });

  it('focuses the field itself, not the button that sits before it', () => {
    document.body.innerHTML =
      '<div data-field="s1.apiKey"><button id="toggle">No key</button><input id="key"></div><div data-field="s1.model"><button id="picker" role="combobox">Pick</button></div>';
    for (const element of document.querySelectorAll<HTMLElement>('[data-field]'))
      element.scrollIntoView = () => undefined;
    revealField(document, 's1.apiKey', true)?.();
    expect(document.activeElement?.id).toBe('key');
    revealField(document, 's1.model', true)?.();
    expect(document.activeElement?.id).toBe('picker');
  });

  it('scrolls to the field, focuses its control and highlights it for 2.8 s; smooth only with full motion', () => {
    vi.useFakeTimers();
    document.body.innerHTML =
      '<label data-field="s2.model">Model<input id="model"></label><label data-field="s2.endpoint">Address<input></label>';
    const field = document.querySelector<HTMLElement>('[data-field="s2.model"]')!;
    const scroll = vi.fn();
    field.scrollIntoView = scroll;
    const clear = revealField(document, 's2.model', false);
    expect(clear).toBeTypeOf('function');
    expect(scroll).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' });
    expect(document.activeElement?.id).toBe('model');
    expect(field.dataset.target).toBe('true');
    vi.advanceTimersByTime(highlightMs - 1);
    expect(field.dataset.target).toBe('true');
    vi.advanceTimersByTime(1);
    expect(field.dataset.target).toBeUndefined();
    revealField(document, 's2.model', true);
    expect(scroll).toHaveBeenLastCalledWith({ block: 'center', behavior: 'auto' });
    expect(highlightMs).toBe(2800);
    expect(revealField(document, 's1.model', false)).toBeNull();
  });
});
