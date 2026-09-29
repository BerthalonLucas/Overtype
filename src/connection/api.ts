// Contract of the connection area (docs/DESIGN-REGLAGES.md). The setup, the Server page and the
// Diagnostic page use only what this file exports. Natively these call the Rust commands
// probe_connection / try_model / get_diagnostics (to be written after Lucas validates the design);
// in the browser preview they run a simulated server chosen by `?conn=` (see simulate.ts).
// Nothing here ever carries a source text, a translation, the clipboard or a full API key.

export type ProbeStepId = 'address' | 'reach' | 'key' | 'models';
export type StepState = 'waiting' | 'running' | 'ok' | 'error' | 'skipped';
export type ProbeStep = { id: ProbeStepId; state: StepState; detail?: string; ms?: number };
export type ModelInfo = { id: string; ownedBy?: string };
// What failed, in plain words, and the gesture that fixes it (both already translated).
export type Problem = { step: ProbeStepId | 'try'; title: string; fix: string; logId?: string };
export type ProbeResult = { base: string; steps: ProbeStep[]; models: ModelInfo[]; problem?: Problem };
export type TryResult = { ok: true; reply: string; ms: number } | { ok: false; problem: Problem };

// Normalised address: what will actually be called (…/v1), and whether it differs from the input.
export type Endpoint = { base: string; host: string; changed: boolean } | { invalid: 'empty' | 'malformed' | 'http-remote' };

export type LogLevel = 'info' | 'warn' | 'error';
export type LogArea = 'connection' | 'model' | 'translation' | 'shortcut' | 'app';
export type LogEntry = { id: string; at: string; level: LogLevel; area: LogArea; message: string; ms?: number; status?: number; detail?: Record<string, string>; run?: string };
