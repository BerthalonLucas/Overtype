// The connection of the browser preview (no Tauri): a simulated OpenAI-compatible server, ported
// from the lab (design-lab/reglages/src/mock/server.js). No network at all: every answer is
// decided by the scenario, chosen by `?conn=<id>` (or `setConnScenario`). It speaks the same
// types as Rust (src-tauri/src/probe.rs, diagnostics.rs): the same steps, details, causes and
// journal entries, so a screen built on the preview behaves the same on the real app.
//
// It never carries a user text, and a key only as its mask (••••3f2a).
import type {
  DiagEntry,
  ModelInfo,
  NormalizedEndpoint,
  ProbeCause,
  ProbeProblem,
  ProbeResult,
  ProbeStep,
  ProbeStepEvent,
  ProbeStepId,
  StepDetail,
  TryResult,
} from './types';
import { probeStepIds } from './types';

// ——— Scenarios ———
// ok: 4 models, quick answers · cle-requise: 401 without a key, fine with one · cle-refusee: 401
// whatever the key · pas-d-api: 404 on /v1/models · refuse: nothing listens · delai: the server
// never answers (announced 10 s, simulated in 2.5 s) · certificat: Windows refuses the
// certificate · dns: the name does not resolve · vide: 200 with an empty list · lent: fine, but
// 1.8 s for the list.
export const connScenarios = [
  'ok',
  'cle-requise',
  'cle-refusee',
  'pas-d-api',
  'refuse',
  'delai',
  'certificat',
  'dns',
  'vide',
  'lent',
] as const;
export type ConnScenario = (typeof connScenarios)[number];
export function connScenarioFrom(search: string): ConnScenario {
  const value = new URLSearchParams(search).get('conn');
  return (connScenarios as readonly string[]).includes(value ?? '') ? (value as ConnScenario) : 'ok';
}
let scenario: ConnScenario = connScenarioFrom(typeof location === 'undefined' ? '' : location.search);
export const getConnScenario = () => scenario;
export function setConnScenario(next: ConnScenario) {
  if ((connScenarios as readonly string[]).includes(next)) scenario = next;
}

// Timing: `scale` 1 plays the lab's durations, 0 answers at once (the unit tests).
export const mockTiming = { scale: 1 };
const jitter = (min: number, max: number) => Math.round(min + Math.random() * (max - min));

export const mockModels: ModelInfo[] = [
  { id: 'unsloth/gemma-4-12B-it-qat-GGUF:UD-Q4_K_XL', ownedBy: 'llama.cpp' },
  { id: 'qwen3-8b-instruct', ownedBy: 'vllm' },
  { id: 'tencent/Hy-MT2-7B-FP8', ownedBy: 'vllm' },
  { id: 'mistral-small-3.2-24b', ownedBy: 'vllm' },
];
// What « Essayer avec une phrase » answers: the translation of Rust's fixed sentence.
export const mockReply = 'Bonjour, la réunion commence à dix heures.';

// ——— The address, read as it is typed (the twin of settings::normalize_endpoint) ———
const suffixes = ['/v1/chat/completions', '/chat/completions', '/v1/models', '/v1'];
function isLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return host === 'localhost' || host.endsWith('.localhost') || host === '::1' || /^127(\.\d{1,3}){3}$/.test(host);
}
export function normalizeEndpoint(input: string): NormalizedEndpoint {
  const typed = String(input ?? '').replace(/\s+/g, '');
  if (!typed) return { ok: false, reason: 'empty' };
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(typed);
  const parse = (text: string) => {
    try {
      return new URL(text);
    } catch {
      return null;
    }
  };
  let url = parse(hasScheme ? typed : `https://${typed}`);
  if (!url) return { ok: false, reason: 'malformed' };
  // A local server speaks plain HTTP: no scheme typed for this computer means http://.
  if (!hasScheme && isLocalHost(url.hostname)) url = parse(`http://${typed}`);
  if (!url) return { ok: false, reason: 'malformed' };
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { ok: false, reason: 'scheme' };
  if (!url.hostname) return { ok: false, reason: 'malformed' };
  if (url.username || url.password) return { ok: false, reason: 'credentials' };
  let path = url.pathname.replace(/\/+$/, '');
  const before = path;
  for (let stripped = true; stripped; ) {
    stripped = false;
    const lower = path.toLowerCase();
    const suffix = suffixes.find((item) => lower.endsWith(item));
    if (suffix) {
      path = path.slice(0, -suffix.length).replace(/\/+$/, '');
      stripped = true;
    }
  }
  const secure = url.protocol === 'https:';
  const local = isLocalHost(url.hostname);
  const base = `${url.protocol}//${url.host}${path}`;
  const cleaned = String(input).trim().replace(/\/+$/, '');
  return {
    ok: true,
    base,
    host: url.host,
    display: base.replace(/^https:\/\//, ''),
    secure,
    local,
    insecure: !secure && !local,
    changed: cleaned !== base,
    ...(path !== before ? { removed: before.slice(path.length) } : {}),
  };
}

// ——— The journal ———
export const maskKey = (key: string) => {
  const chars = [...key];
  return chars.length < 12 ? '••••' : `••••${chars.slice(-4).join('')}`;
};
const keyTail = (key: string) => maskKey(key).replace(/^•+/, '');
type Draft = Omit<DiagEntry, 'id' | 'at'>;
type Emit = (name: 'probe-step' | 'diagnostic', payload: ProbeStepEvent | DiagEntry) => void;
let entries: DiagEntry[] = [];
let nextId = 1;
function record(emit: Emit, draft: Draft): DiagEntry {
  const entry: DiagEntry = { id: nextId++, at: new Date().toISOString(), ...draft };
  entries = [...entries, entry].slice(-500);
  emit('diagnostic', entry);
  return entry;
}

// ——— Runs: one check and one try at a time, a newer one cancels the older ———
class Cancelled extends Error {}
const running = new Map<string, { kind: 'check' | 'try'; cancel: () => void }>();
function begin(run: string, kind: 'check' | 'try') {
  for (const [id, other] of running)
    if (other.kind === kind) {
      other.cancel();
      running.delete(id);
    }
  const waiting = new Set<() => void>();
  const state = { cancelled: false };
  running.set(run, {
    kind,
    cancel: () => {
      state.cancelled = true;
      waiting.forEach((stop) => stop());
    },
  });
  const sleep = (ms: number) =>
    new Promise<void>((resolve, reject) => {
      if (state.cancelled) {
        reject(new Cancelled());
        return;
      }
      const wait = ms * mockTiming.scale;
      const stop = () => {
        clearTimeout(timer);
        waiting.delete(stop);
        reject(new Cancelled());
      };
      const timer = setTimeout(() => {
        waiting.delete(stop);
        resolve();
      }, wait);
      waiting.add(stop);
    });
  return {
    sleep,
    end: () => {
      running.delete(run);
    },
  };
}

const technical: Partial<Record<ProbeCause, string>> = {
  'address.dns': 'No such host is known. (os error 11001)',
  'reach.refused': 'No connection could be made because the target machine actively refused it. (os error 10061)',
  'reach.timeout': 'operation timed out',
  'reach.certificate':
    'A certificate chain processed, but terminated in a root certificate which is not trusted by the trust provider. (os error -2146762487)',
};

async function probe(
  emit: Emit,
  run: string,
  endpointInput: string,
  apiKey: string,
  noKey: boolean,
): Promise<ProbeResult> {
  const sc = scenario;
  const started = Date.now();
  const { sleep, end } = begin(run, 'check');
  const endpoint = normalizeEndpoint(endpointInput);
  const steps: ProbeStep[] = probeStepIds.map((id) => ({ id, state: 'waiting' }));
  const send = () => emit('probe-step', { run, steps: steps.map((step) => ({ ...step })) });
  const set = (id: ProbeStepId, patch: Omit<ProbeStep, 'id'>) => {
    steps[probeStepIds.indexOf(id)] = { id, ...patch };
    send();
  };
  const key = noKey ? '' : apiKey.trim();
  const keyField = key ? { key: maskKey(key) } : {};
  const result = (ok: boolean, models: ModelInfo[], problem?: ProbeProblem): ProbeResult => ({
    run,
    ok,
    endpoint,
    steps: steps.map((step) => ({ ...step })),
    models,
    ...(problem ? { problem } : {}),
    totalMs: Date.now() - started,
  });
  const fail = (id: ProbeStepId, cause: ProbeCause, ms: number, extra: Partial<Draft> = {}): ProbeResult => {
    const index = probeStepIds.indexOf(id);
    steps.forEach((step, n) => {
      if (n > index || (n < index && (step.state === 'running' || step.state === 'waiting')))
        steps[n] = { id: step.id, state: 'skipped' };
    });
    set(id, { state: 'error', ms });
    const words = technical[cause];
    const entry = record(emit, {
      run,
      step: id,
      level: 'error',
      code: cause,
      ms,
      ...(words ? { cause: words } : {}),
      ...extra,
    });
    return result(false, [], {
      step: id,
      cause,
      ...(extra.status ? { status: extra.status } : {}),
      ...(words ? { technical: words } : {}),
      logId: entry.id,
    });
  };
  try {
    send();
    set('address', { state: 'running' });
    if (!endpoint.ok) {
      await sleep(80);
      return fail('address', `address.${endpoint.reason}`, 0);
    }
    const url = `${endpoint.base}/v1/models`;
    const request = { method: 'GET' as const, url, ...keyField };
    // 1. Address (DNS)
    let ms = endpoint.local ? jitter(0, 2) : jitter(8, 24);
    await sleep(ms * 6);
    if (sc === 'dns' && !endpoint.local) return fail('address', 'address.dns', ms, { detail: endpoint.host });
    set('address', { state: 'ok', ms, detail: { code: endpoint.local ? 'local' : 'found', host: endpoint.host } });
    record(emit, {
      run,
      step: 'address',
      level: 'ok',
      code: endpoint.local ? 'local' : 'resolved',
      ms,
      detail: `${endpoint.host} → ${endpoint.local ? '127.0.0.1' : '203.0.113.24'}`,
    });
    // 2. Reach (TCP + TLS)
    set('reach', { state: 'running' });
    if (sc === 'refuse') {
      ms = jitter(1900, 2100);
      await sleep(500);
      return fail('reach', 'reach.refused', ms, { detail: endpoint.host });
    }
    ms = endpoint.local ? jitter(1, 4) : jitter(28, 60);
    await sleep(ms * 5);
    if (sc === 'certificat' && endpoint.secure)
      return fail('reach', 'reach.certificate', ms, { detail: endpoint.host });
    const reached: StepDetail = { code: endpoint.secure ? 'tls' : endpoint.local ? 'http_local' : 'http_insecure' };
    set('reach', { state: 'ok', ms, detail: reached });
    record(emit, {
      run,
      step: 'reach',
      level: 'ok',
      code: endpoint.secure ? 'tls' : 'connected',
      ms,
      detail: endpoint.host,
    });
    // 3. Key (the first authenticated request). A server that never answers fails the connection's row.
    set('key', { state: 'running' });
    if (sc === 'delai') {
      await sleep(2500);
      return fail('reach', 'reach.timeout', 10_000, request);
    }
    ms = jitter(40, 90);
    await sleep(ms * 4);
    if (sc === 'cle-refusee' && key) return fail('key', 'key.rejected', ms, { ...request, status: 401 });
    if ((sc === 'cle-requise' || sc === 'cle-refusee') && !key)
      return fail('key', 'key.required', ms, { ...request, status: 401 });
    // 404: the address answers, but not as an OpenAI API; the key was never judged.
    if (sc === 'pas-d-api') return fail('models', 'models.notfound', ms, { ...request, status: 404 });
    set('key', {
      state: 'ok',
      ms,
      detail: key ? { code: 'key_accepted', tail: keyTail(key) } : { code: noKey ? 'key_none' : 'key_not_asked' },
    });
    record(emit, { run, step: 'key', level: 'ok', code: key ? 'key_accepted' : 'key_none', ms, ...keyField });
    // 4. Models
    set('models', { state: 'running' });
    ms = sc === 'lent' ? 1800 : jitter(35, 110);
    await sleep(sc === 'lent' ? 1800 : ms * 3);
    if (sc === 'vide') return fail('models', 'models.empty', ms, { ...request, status: 200 });
    const models = mockModels.map((model) => ({ ...model }));
    set('models', { state: 'ok', ms, detail: { code: 'models', count: models.length } });
    record(emit, {
      run,
      step: 'models',
      level: 'ok',
      code: 'models',
      ...request,
      status: 200,
      ms,
      detail: String(models.length),
    });
    // The line's total is what the steps add up to (the pauses of the simulation are not the server's).
    return { ...result(true, models), totalMs: steps.reduce((sum, step) => sum + (step.ms ?? 0), 0) };
  } catch (error) {
    if (!(error instanceof Cancelled)) throw error;
    // A newer check, or `cancel_probe`: nothing more is reported, nothing is left spinning.
    const at = steps.find((step) => step.state === 'running')?.id ?? 'address';
    steps.forEach((step, n) => {
      if (step.state === 'running' || step.state === 'waiting') steps[n] = { id: step.id, state: 'skipped' };
    });
    return result(false, [], { step: at, cause: 'cancelled' });
  } finally {
    end();
  }
}

async function tryModel(
  emit: Emit,
  run: string,
  endpointInput: string,
  apiKey: string,
  noKey: boolean,
  model: string,
): Promise<TryResult> {
  const sc = scenario;
  const { sleep, end } = begin(run, 'try');
  const endpoint = normalizeEndpoint(endpointInput);
  const key = noKey ? '' : apiKey.trim();
  const name = model.trim();
  const url = endpoint.ok ? `${endpoint.base}/v1/chat/completions` : undefined;
  const failed = (cause: ProbeCause, status?: number, ms?: number): TryResult => {
    const words = technical[cause];
    const entry = record(emit, {
      run,
      step: 'try',
      level: 'error',
      code: cause,
      ...(url ? { method: 'POST' as const, url } : {}),
      ...(status ? { status } : {}),
      ...(ms !== undefined ? { ms } : {}),
      ...(words ? { cause: words } : {}),
      ...(key ? { key: maskKey(key) } : {}),
      detail: name,
    });
    return {
      run,
      ok: false,
      problem: {
        step: 'try',
        cause,
        ...(status ? { status } : {}),
        ...(words ? { technical: words } : {}),
        logId: entry.id,
      },
    };
  };
  try {
    if (!endpoint.ok) return failed(`address.${endpoint.reason}`);
    if (!name) return failed('try.model');
    if (sc === 'dns' && !endpoint.local) {
      await sleep(120);
      return failed('address.dns', undefined, 20);
    }
    if (sc === 'refuse') {
      await sleep(500);
      return failed('reach.refused', undefined, 2000);
    }
    if (sc === 'certificat' && endpoint.secure) {
      await sleep(200);
      return failed('reach.certificate', undefined, 45);
    }
    if (sc === 'delai') {
      await sleep(2500);
      return failed('try.timeout', undefined, 30_000);
    }
    const ms = sc === 'lent' ? 2400 : jitter(520, 950);
    await sleep(ms);
    if (sc === 'cle-refusee' && key) return failed('key.rejected', 401, ms);
    if ((sc === 'cle-requise' || sc === 'cle-refusee') && !key) return failed('key.required', 401, ms);
    if (sc === 'pas-d-api' || sc === 'vide' || !mockModels.some((known) => known.id === name))
      return failed('try.model', 404, ms);
    record(emit, {
      run,
      step: 'try',
      level: 'ok',
      code: 'reply',
      method: 'POST',
      url,
      status: 200,
      ms,
      ...(key ? { key: maskKey(key) } : {}),
      detail: `${name} · ${mockReply.length} chars`,
    });
    return { run, ok: true, reply: mockReply, ms };
  } catch (error) {
    if (!(error instanceof Cancelled)) throw error;
    return { run, ok: false, problem: { step: 'try', cause: 'cancelled' } };
  } finally {
    end();
  }
}

// ——— The commands of the connection, as `bridge.ts` calls them outside Tauri ———
export const connectionCommands = [
  'probe_connection',
  'cancel_probe',
  'try_model',
  'get_diagnostics',
  'clear_diagnostics',
] as const;
export type ConnectionCommand = (typeof connectionCommands)[number];
export const isConnectionCommand = (name: string): name is ConnectionCommand =>
  (connectionCommands as readonly string[]).includes(name);
export async function connectionCommand(
  name: ConnectionCommand,
  args: Record<string, unknown> | undefined,
  emit: Emit,
): Promise<unknown> {
  const text = (key: string) => String(args?.[key] ?? '');
  switch (name) {
    case 'probe_connection':
      return probe(emit, text('run'), text('endpoint'), text('apiKey'), args?.noKey === true);
    case 'try_model':
      return tryModel(emit, text('run'), text('endpoint'), text('apiKey'), args?.noKey === true, text('model'));
    case 'cancel_probe': {
      const run = running.get(text('run'));
      run?.cancel();
      running.delete(text('run'));
      return undefined;
    }
    case 'get_diagnostics':
      return entries.map((entry) => ({ ...entry }));
    case 'clear_diagnostics':
      entries = [];
      return undefined;
  }
}
