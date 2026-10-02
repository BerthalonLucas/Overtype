import { afterEach, describe, expect, it } from 'vitest';
import { messageKeys } from '../i18n';
import { allPages, clickRun, isDiagnosticsChord, loadDiagnosticsShown, pageAbout, pageFromLocation, pageOr, pageTitle, saveDiagnosticsShown, secretClicks, secretGapMs, visiblePages } from './nav';

const chord = (over: Partial<Parameters<typeof isDiagnosticsChord>[0]> = {}) => ({ ctrlKey: true, shiftKey: true, altKey: false, metaKey: false, code: 'KeyM', key: 'M', repeat: false, ...over });

describe('the pages of the Settings window', () => {
  afterEach(() => saveDiagnosticsShown(false));

  it('shows one page per topic in order; After replacing only in the Îlot, Diagnostic only once revealed', () => {
    expect(visiblePages({ uiVersion: 'ilot' }, false)).toEqual(['general', 'shortcuts', 'actions', 'after', 'appearance', 'server', 'data']);
    expect(visiblePages({ uiVersion: 'v4' }, false)).toEqual(['general', 'shortcuts', 'actions', 'appearance', 'server', 'data']);
    expect(visiblePages({ uiVersion: 'ilot' }, true).at(-1)).toBe('diagnostic');
    for (const page of allPages) { expect(messageKeys).toContain(pageTitle(page)); expect(messageKeys).toContain(pageAbout(page)); }
  });

  it('falls back to General when the page went away, and reads the page asked by the URL', () => {
    const pages = visiblePages({ uiVersion: 'v4' }, false);
    expect(pageOr('after', pages)).toBe('general');
    expect(pageOr('diagnostic', pages)).toBe('general');
    expect(pageOr('server', pages)).toBe('server');
    expect(pageFromLocation('?window=settings&page=server')).toBe('server');
    expect(pageFromLocation('?window=settings&page=nonsense')).toBeNull();
    expect(pageFromLocation('?window=settings')).toBeNull();
  });

  it('takes Ctrl+Shift+M by its physical key, never with Alt or Windows, never from a held key', () => {
    expect(isDiagnosticsChord(chord())).toBe(true);
    // AZERTY and QWERTY agree: the code is read, whatever character the layout gives.
    expect(isDiagnosticsChord(chord({ code: 'KeyD', key: 'D' }))).toBe(false);
    // AZERTY: the key labelled M is the physical Semicolon. A remote keyboard sends no code.
    expect(isDiagnosticsChord(chord({ code: 'Semicolon', key: 'M' }))).toBe(true);
    expect(isDiagnosticsChord(chord({ code: '', key: 'm' }))).toBe(true);
    expect(isDiagnosticsChord(chord({ code: 'KeyM', key: '?' }))).toBe(true);
    expect(isDiagnosticsChord(chord({ ctrlKey: false }))).toBe(false);
    expect(isDiagnosticsChord(chord({ shiftKey: false }))).toBe(false);
    expect(isDiagnosticsChord(chord({ altKey: true }))).toBe(false);
    expect(isDiagnosticsChord(chord({ metaKey: true }))).toBe(false);
    expect(isDiagnosticsChord(chord({ repeat: true }))).toBe(false);
  });

  it('reveals the Diagnostic at the fifth quick click on the version, and starts the count over after a pause', () => {
    let run = { count: 0, at: 0 };
    let now = 10_000;
    for (let n = 1; n < secretClicks; n++) { const next = clickRun(run, now); expect(next.fired).toBe(false); run = next.run; now += 100; }
    expect(clickRun(run, now).fired).toBe(true);
    expect(clickRun(run, now).run).toEqual({ count: 0, at: 0 });
    // Four clicks, a pause, then a click: the run starts over.
    const late = clickRun(run, now + secretGapMs + 1);
    expect(late.fired).toBe(false);
    expect(late.run.count).toBe(1);
  });

  it('remembers on this device whether the Diagnostic is shown', () => {
    expect(loadDiagnosticsShown()).toBe(false);
    saveDiagnosticsShown(true);
    expect(loadDiagnosticsShown()).toBe(true);
    saveDiagnosticsShown(false);
    expect(loadDiagnosticsShown()).toBe(false);
  });
});
