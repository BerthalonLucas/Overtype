import { normalizeEndpoint } from '../bridge.mock';
import type { NormalizedEndpoint, Server } from '../types';

// The address as it is read while typing: one rule, written in Rust (settings::normalize_endpoint,
// which has the last word when saving) and in src/bridge.mock.ts, tested on the same vectors
// (endpoint.vectors.json, src/bridge.test.ts and cargo test).
export { normalizeEndpoint };
export type { NormalizedEndpoint };

// Limits Rust enforces (settings::validate): the fields refuse to grow past them.
export const endpointMaxLength = 2048;
export const apiKeyMaxLength = 4096;
export const modelMaxLength = 200;

// How a server is named in the interface: its host (and port), « https:// » left out.
export function hostOf(endpoint: string): string {
  const read = normalizeEndpoint(endpoint);
  return read.ok ? read.display : endpoint.trim();
}
// The four last characters of a key, as the journal masks it. A short key shows nothing of itself.
export function maskedKey(key: string): string {
  const chars = [...key.trim()];
  return chars.length < 12 ? '••••' : `••••${chars.slice(-4).join('')}`;
}
// A model id as a short name: « unsloth/gemma-4-12B-it-qat-GGUF:UD-Q4_K_XL » → « gemma-4-12B-it-qat ».
export function shortModel(id: string): string {
  const short = (id.split('/').pop() ?? id).replace(/-GGUF:.*/i, '').replace(/:.*/, '');
  return short || id;
}
// What a key field may hold: no line break, no control character, bounded.
export const cleanKey = (typed: string) => typed.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, apiKeyMaxLength);
export const cleanEndpoint = (typed: string) => typed.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, endpointMaxLength);
export const sameConnection = (a: Pick<Server, 'endpoint' | 'apiKey' | 'noKey'>, b: Pick<Server, 'endpoint' | 'apiKey' | 'noKey'>) => a.endpoint === b.endpoint && a.apiKey === b.apiKey && a.noKey === b.noKey;
