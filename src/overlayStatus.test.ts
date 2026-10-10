import { describe, expect, it } from 'vitest';
import { overlayStatus } from './GlassOverlay';

// FE-04 (audit Elio): the glass's one live region stayed on « Translation complete » while a copy
// succeeded, so a screen reader never heard « Translation copied ».
describe('the live status of the glass', () => {
  const done = { streaming: false, ilot: false, applied: false, complete: true, copied: false };
  it('says the copy over the completion, in its one region', () => {
    expect(overlayStatus(done)).toBe('glass.complete');
    expect(overlayStatus({ ...done, copied: true })).toBe('glass.copied');
    expect(overlayStatus({ ...done, copied: false })).toBe('glass.complete');
  });
  it('keeps the work and the replacement first, and says nothing at rest', () => {
    expect(overlayStatus({ ...done, streaming: true, copied: true })).toBe('glass.working');
    expect(overlayStatus({ ...done, streaming: true, ilot: true })).toBe('pill.working');
    expect(overlayStatus({ ...done, applied: true, copied: true })).toBe('glass.replaced');
    expect(overlayStatus({ ...done, complete: false })).toBeNull();
  });
});
