import { undoRange } from '../settings/AfterReplace';
import type { AfterReplace } from '../types';

/*
 * The countdown of the result pill (docs/DA-PLAN.md lot 9; design-lab/src/Simulator.jsx:151-167):
 * Undo stays for `undoSeconds` (8 by default, 2 to 20), the time does not run while the pointer
 * rests on the pill or while it holds the focus, and resumes where it stopped; at the end the pill
 * leaves (and the changed words' marks with it). Without Undo, the check alone stays 1.1 s
 * (Simulator.jsx:155). Pure: every call takes the current time, so the tests drive a simulated
 * clock.
 *
 * One clock may outlive the content that draws it: when Rust withdraws Undo (`undo-state`), the
 * Îlot swaps the check and Undo for the check alone and the time goes on (src/menu/IlotStage.tsx).
 * Each holder pauses for reasons of its own (a pointer on one content, the focus on another, an
 * Undo on its way), so one resuming never releases another's; `subscribe` tells every view that
 * the clock stopped or started again.
 */

// Why the time stands still: 'hover', 'focus', 'busy' (an Undo on its way), or any key a holder
// makes its own (DoneContent prefixes its reasons with its instance id).
export type PauseReason = string;

// Simulator.jsx:155: the check alone stays 1100 ms.
export const checkOnlyMs = 1100;

export const undoMs = (seconds: number) =>
  1000 * Math.min(undoRange.max, Math.max(undoRange.min, Math.round(Number.isFinite(seconds) ? seconds : 8)));

// What the result pill shows and how long it stays (0: nothing to show, the surface leaves at
// once, as the lab's 60 ms, Simulator.jsx:154).
export function resultTiming(after: AfterReplace): { check: boolean; undo: boolean; durationMs: number } {
  const durationMs = after.undo ? undoMs(after.undoSeconds) : after.check ? checkOnlyMs : 0;
  return { check: after.check, undo: after.undo, durationMs };
}

export class Countdown {
  readonly durationMs: number;
  private spent = 0;
  private since: number | null;
  private readonly reasons = new Set<PauseReason>();
  private readonly listeners = new Set<() => void>();

  constructor(durationMs: number, now: number) {
    this.durationMs = Math.max(0, durationMs);
    this.since = now;
  }

  get paused(): boolean {
    return this.since === null;
  }

  elapsed(now: number): number {
    return Math.min(this.durationMs, this.spent + (this.since === null ? 0 : Math.max(0, now - this.since)));
  }
  remaining(now: number): number {
    return this.durationMs - this.elapsed(now);
  }
  expired(now: number): boolean {
    return this.remaining(now) <= 0;
  }
  // 1 at the start, 0 at the end (the ring's arc).
  progress(now: number): number {
    return this.durationMs ? this.remaining(now) / this.durationMs : 0;
  }
  // In whole seconds left, for reduced motion: the ring steps once a second instead of sliding.
  steppedProgress(now: number): number {
    const total = Math.ceil(this.durationMs / 1000);
    return total ? Math.ceil(this.remaining(now) / 1000) / total : 0;
  }

  // At most `ms` left from now (never more than there was): Undo withdrawn by a key or the caret,
  // the check alone leaves within the lab's 1.1 s. The pauses still hold.
  limit(ms: number, now: number): void {
    if (this.remaining(now) <= ms) return;
    this.spent = this.durationMs - Math.max(0, ms);
    if (this.since !== null) this.since = now;
    this.notify();
  }
  // Pausing for a reason already held, or resuming one not held, changes nothing.
  pause(reason: PauseReason, now: number): void {
    if (this.reasons.has(reason)) return;
    this.reasons.add(reason);
    if (this.since === null) return;
    this.spent = this.elapsed(now);
    this.since = null;
    this.notify();
  }
  resume(reason: PauseReason, now: number): void {
    if (!this.reasons.delete(reason) || this.reasons.size || this.since !== null) return;
    this.since = now;
    this.notify();
  }
  // Called whenever the clock stops or starts again; returns the unsubscribe.
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private notify() {
    for (const listener of [...this.listeners]) listener();
  }
}
