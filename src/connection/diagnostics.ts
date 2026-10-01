import { useSyncExternalStore } from 'react';
import { bridge } from '../bridge';
import type { Translate } from '../i18n';
import type { DiagEntry } from '../types';
import { entryMessage, stepName } from './causes';

// The journal of the connection, as the hidden Diagnostic page and the setup's « Journal » sheet
// read it: Rust's 500 last entries (get_diagnostics), then each new one as it happens (event
// `diagnostic`). Newest first here. Never a text of the person nor a whole key: Rust writes
// neither (diagnostics.rs), and what is copied is scrubbed once more below.
export const journalLimit = 500;
export type Journal = { entries: DiagEntry[]; state: 'loading' | 'ready' | 'unavailable' };
let journal: Journal = { entries: [], state: 'loading' };
let started = false;
const listeners = new Set<() => void>();
const publish = (next: Journal) => { journal = next; listeners.forEach(listener => listener()); };

export function addEntry(entries: DiagEntry[], entry: DiagEntry): DiagEntry[] {
  if (entries.some(item => item.id === entry.id)) return entries;
  return [entry, ...entries].sort((a, b) => b.id - a.id).slice(0, journalLimit);
}
function start() {
  if (started) return;
  started = true;
  void bridge.on<DiagEntry>('diagnostic', entry => publish({ ...journal, entries: addEntry(journal.entries, entry) })).catch(() => undefined);
  void load();
}
async function load() {
  try {
    const saved = await bridge.getDiagnostics();
    // Entries that arrived by event while the answer travelled are kept.
    publish({ entries: saved.reduce(addEntry, journal.entries), state: 'ready' });
  } catch { publish({ ...journal, state: 'unavailable' }); }
}
function subscribe(listener: () => void) { start(); listeners.add(listener); return () => { listeners.delete(listener); }; }
const snapshot = () => journal;
export function useJournal(): Journal { return useSyncExternalStore(subscribe, snapshot, snapshot); }
export const reloadJournal = () => load();
export async function clearJournal() {
  await bridge.clearDiagnostics();
  publish({ entries: [], state: 'ready' });
}
// For the tests: back to an unread journal.
export function resetJournal() { journal = { entries: [], state: 'loading' }; started = false; listeners.clear(); }

const pad = (value: number, width = 2) => String(value).padStart(width, '0');
// The local time of an entry, to the millisecond: 14:03:27.512.
export function clockTime(at: string): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return '';
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}
// A last guard before anything leaves the app by the clipboard: a key in a URL's query, a bearer
// token, an « sk-… » that a server would have echoed in its own words.
export function redact(text: string): string {
  return text
    .replace(/([?&](?:api[_-]?key|key|token|access_token)=)[^&\s]+/gi, '$1•••')
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/=-]{6,}/gi, '$1•••')
    .replace(/\bsk-[A-Za-z0-9_-]{8,}/g, 'sk-•••');
}
export const levelGlyph = (level: DiagEntry['level']) => level === 'error' ? '✕' : level === 'ok' ? '✓' : '·';
// The journal as text, for « Copier »: one line per entry, newest first.
export function journalText(entries: readonly DiagEntry[], filter: 'all' | 'errors', t: Translate): string {
  return entries.filter(entry => filter === 'all' || entry.level === 'error').map(entry => redact([
    clockTime(entry.at), levelGlyph(entry.level), stepName(entry.step, t), entry.method ?? '', entry.url ?? '', entry.status ?? '',
    entry.ms != null ? `${entry.ms} ms` : '', entryMessage(entry, t), entry.cause ? `(${entry.cause})` : '', entry.proxy ? `[${entry.proxy}]` : '', entry.key ?? '',
  ].filter(part => part !== '').join('  '))).join('\n');
}
