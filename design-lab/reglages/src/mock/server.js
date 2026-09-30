// A simulated OpenAI-compatible server, for the setup and Réglages › Serveur.
// No network at all: every answer is decided by the current SCENARIO (toolbar « Serveur »).
//
//   normalizeEndpoint(input)             → { ok, base, api, display, changed, notes[], error? }
//   probe({ url, key, noKey, signal, onStep })  → { ok, steps[], models[], error? }
//   listModels({ url, key })            → shortcut: probe() then .models
//   tryModel({ url, key, model })       → { ok, reply, ms } (« Essayer avec une phrase »)
//   diagnostics.{ list(), subscribe(fn), add(entry), clear(), toText(filter) }
//   setScenario(id) / getScenario() / subscribeScenario(fn)
//
// A probe runs 4 steps, each with its own duration, like the real app will (docs/DESIGN-REGLAGES.md):
//   adresse (DNS) → connexion (TCP + TLS) → cle (auth) → modeles (GET /v1/models)
// Every HTTP-ish step writes a diagnostic entry. Never any user text, never the key (only its
// last 4 characters, masked).

// ——— Scenarios ———
export const SCENARIOS = [
  { id: 'ok', label: 'Tout va bien', hint: '4 modèles, réponses rapides' },
  { id: 'cle-requise', label: 'Clé exigée', hint: '401 sans clé, OK avec une clé' },
  { id: 'cle-refusee', label: 'Clé refusée', hint: '401 quelle que soit la clé' },
  { id: 'pas-d-api', label: 'Pas d’API ici', hint: '404 sur /v1/models' },
  { id: 'refuse', label: 'Connexion refusée', hint: 'rien n’écoute à cette adresse' },
  { id: 'delai', label: 'Délai dépassé', hint: 'annoncé 10 s, simulé en 2,5 s' },
  { id: 'certificat', label: 'Certificat refusé', hint: 'TLS : certificat auto-signé' },
  { id: 'dns', label: 'Nom introuvable', hint: 'le DNS ne connaît pas l’hôte' },
  { id: 'vide', label: 'Aucun modèle', hint: '200, liste vide' },
  { id: 'lent', label: 'Serveur lent', hint: 'OK, mais 1,8 s pour la liste' },
];
export const SCENARIO_BY_ID = Object.fromEntries(SCENARIOS.map(s => [s.id, s]));

let scenario = 'ok';
const scenarioListeners = new Set();
export function getScenario() { return scenario; }
export function setScenario(id) {
  if (!SCENARIO_BY_ID[id] || id === scenario) return;
  scenario = id;
  scenarioListeners.forEach(fn => fn(id));
}
export function subscribeScenario(fn) { scenarioListeners.add(fn); return () => scenarioListeners.delete(fn); }

// ——— Models (realistic ids) ———
export const MODELS = [
  { id: 'unsloth/gemma-4-12B-it-qat-GGUF:UD-Q4_K_XL', owned_by: 'llama.cpp', context: 131072 },
  { id: 'qwen3-8b-instruct', owned_by: 'vllm', context: 32768 },
  { id: 'tencent/Hy-MT2-7B-FP8', owned_by: 'vllm', context: 32768 },
  { id: 'mistral-small-3.2-24b', owned_by: 'vllm', context: 131072 },
];
// For a picker: { value, label, hint }. label = the short name, hint = the full id + context.
export function modelOptions(models = MODELS) {
  return models.map(m => {
    const short = m.id.split('/').pop().replace(/-GGUF:.*/i, '').replace(/:.*/, '');
    return { value: m.id, label: short, hint: `${m.id} · ${Math.round(m.context / 1024)} k` };
  });
}

// ——— Endpoint normalisation ———
const LOCAL_HOSTS = /^(localhost|127(?:\.\d{1,3}){3}|\[::1\]|::1)$/i;
export function normalizeEndpoint(input) {
  const notes = [];
  let raw = String(input ?? '').trim().replace(/\s+/g, '');
  if (!raw) return { ok: false, error: { code: 'vide', title: 'Adresse vide', fix: 'Collez l’adresse de votre serveur, par exemple https://llm.exemple.com.' } };
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) { raw = `https://${raw}`; notes.push('https:// ajouté'); }
  let url;
  try { url = new URL(raw); } catch {
    return { ok: false, error: { code: 'invalide', title: 'Adresse illisible', fix: 'Vérifiez l’orthographe : lettres, chiffres, points et « : » pour le port.' } };
  }
  if (!/^https?:$/.test(url.protocol)) return { ok: false, error: { code: 'schema', title: `« ${url.protocol} » n’est pas une adresse web`, fix: 'Utilisez une adresse en https://.' } };
  if (url.protocol === 'http:' && !LOCAL_HOSTS.test(url.hostname)) {
    return { ok: false, error: { code: 'http', title: 'http:// est réservé à cet ordinateur', fix: `Utilisez https://${url.host}, ou localhost pour un serveur local.` } };
  }
  if (url.username || url.password) return { ok: false, error: { code: 'identifiants', title: 'Pas d’identifiants dans l’adresse', fix: 'Mettez la clé dans le champ « Clé API ».' } };
  let path = url.pathname.replace(/\/+$/, '');
  const before = path;
  path = path.replace(/\/v1\/chat\/completions$/i, '').replace(/\/chat\/completions$/i, '').replace(/\/v1\/models$/i, '').replace(/\/v1$/i, '');
  if (path !== before) notes.push(`${before.slice(path.length)} retiré`);
  if (url.search || url.hash) notes.push('paramètres retirés');
  const base = `${url.protocol}//${url.host}${path}`;
  const cleanedInput = String(input).trim().replace(/\/+$/, '');
  return {
    ok: true,
    base,                          // what we store: https://llm.exemple.com
    api: `${base}/v1`,             // what we call:  https://llm.exemple.com/v1
    host: url.host,
    secure: url.protocol === 'https:',
    local: LOCAL_HOSTS.test(url.hostname),
    display: base.replace(/^https:\/\//, ''),
    changed: cleanedInput !== base,
    notes,
  };
}

// ——— Diagnostics log store ———
let entries = [];
const logListeners = new Set();
let seq = 0;
const pad = (n, w = 2) => String(n).padStart(w, '0');
export const clockTime = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
export const maskKey = key => (key ? `••••${String(key).slice(-4)}` : 'aucune');
export const diagnostics = {
  list: () => entries,
  subscribe(fn) { logListeners.add(fn); return () => logListeners.delete(fn); },
  // { step, method?, url?, status?, ms?, level: 'ok'|'error'|'info', message, cause?, probeId? }
  add(entry) {
    const e = { id: ++seq, at: Date.now(), time: clockTime(), level: 'info', ...entry };
    if (e.url) e.url = String(e.url).replace(/([?&](api[_-]?key|key|token)=)[^&]+/gi, '$1•••'); // never a key in a URL
    entries = [e, ...entries].slice(0, 500);
    logListeners.forEach(fn => fn(entries));
    return e;
  },
  clear() { entries = []; logListeners.forEach(fn => fn(entries)); },
  toText(filter = 'all') {
    const rows = entries.filter(e => filter === 'all' || e.level === 'error');
    return rows.map(e => [e.time, e.level === 'error' ? '✕' : e.level === 'ok' ? '✓' : '·', STEP_NAMES[e.step] || e.step, e.method || '', e.url || '', e.status ?? '', e.ms != null ? `${e.ms} ms` : '', e.message || '', e.cause ? `(cause : ${e.cause})` : ''].filter(Boolean).join('  ')).join('\n');
  },
};
export const STEP_NAMES = { adresse: 'Adresse', connexion: 'Connexion', cle: 'Clé', modeles: 'Modèles', essai: 'Essai' };
export const STEPS = ['adresse', 'connexion', 'cle', 'modeles'];

// ——— The probe ———
const sleep = (ms, signal) => new Promise((resolve, reject) => {
  const id = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(id); reject(new DOMException('Annulé', 'AbortError')); }, { once: true });
});
const jitter = (a, b) => Math.round(a + Math.random() * (b - a));

// Failure texts: cause, then what to do (docs/DESIGN-REGLAGES.md, « Étapes et messages d'échec »).
export const FAILURES = {
  dns: { step: 'adresse', title: 'Adresse introuvable', fix: 'Vérifiez l’orthographe de l’adresse.', cause: 'getaddrinfo ENOTFOUND' },
  refuse: { step: 'connexion', title: 'Connexion refusée', fix: 'Rien n’écoute à cette adresse. Le serveur est-il démarré ?', cause: 'connect ECONNREFUSED' },
  delai: { step: 'connexion', title: 'Le serveur ne répond pas en 10 s', fix: 'Pare-feu, proxy ou serveur occupé.', cause: 'connexion ouverte, aucune réponse · proxy système : aucun' },
  certificat: { step: 'connexion', title: 'Certificat refusé par Windows', fix: 'Le certificat du serveur n’est pas reconnu (auto-signé ?).', cause: 'CERT_UNTRUSTED_ROOT' },
  'cle-requise': { step: 'cle', title: 'Ce serveur demande une clé', fix: 'Renseignez la clé API, puis vérifiez à nouveau.', cause: 'HTTP 401 sans en-tête Authorization', status: 401 },
  'cle-refusee': { step: 'cle', title: 'Clé refusée', fix: 'Copiez-la à nouveau depuis votre fournisseur.', cause: 'HTTP 401 invalid_api_key', status: 401 },
  'pas-d-api': { step: 'modeles', title: 'Pas d’API OpenAI à cette adresse', fix: 'L’adresse répond, mais /v1/models n’existe pas. Est-ce la bonne machine et le bon port ?', cause: 'HTTP 404 sur /v1/models', status: 404 },
  vide: { step: 'modeles', title: 'Aucun modèle chargé sur ce serveur', fix: 'Chargez un modèle côté serveur, puis vérifiez à nouveau.', cause: 'HTTP 200, data: []', status: 200 },
  adresse: { step: 'adresse', title: 'Adresse à corriger', fix: '', cause: 'adresse invalide' },
};

/**
 * Runs the 4 steps. onStep(steps) is called at each change with the full array:
 *   [{ id, name, state: 'waiting'|'running'|'ok'|'error'|'skipped', ms?, detail? }]
 * Resolves { ok, steps, models, endpoint, error? } — error = { code, step, title, fix, cause, status? }.
 * The key is never logged; noKey = « Mon serveur n'a pas de clé ».
 */
export async function probe({ url, key = '', noKey = false, signal, onStep, scenario: forced } = {}) {
  const sc = forced || scenario;
  const probeId = `p${Date.now().toString(36)}`;
  const steps = STEPS.map(id => ({ id, name: STEP_NAMES[id], state: 'waiting' }));
  const emit = () => onStep?.(steps.map(s => ({ ...s })));
  const run = i => { steps[i].state = 'running'; emit(); };
  const done = (i, state, ms, detail) => { Object.assign(steps[i], { state, ms, detail }); emit(); };
  const fail = (code, i, ms, extra = {}) => {
    const f = { ...FAILURES[code], ...extra };
    done(i, 'error', ms, f.title);
    for (let k = i + 1; k < steps.length; k++) steps[k].state = 'skipped';
    emit();
    diagnostics.add({ probeId, step: STEPS[i], method: f.method, url: f.url, status: f.status ?? null, ms, level: 'error', message: f.title, cause: f.cause });
    return { ok: false, steps, models: [], endpoint, error: { code, step: STEPS[i], ...f } };
  };

  const endpoint = normalizeEndpoint(url);
  emit();
  run(0);
  if (!endpoint.ok) {
    await sleep(80, signal);
    return fail('adresse', 0, 0, { title: endpoint.error.title, fix: endpoint.error.fix, cause: endpoint.error.code });
  }
  const modelsUrl = `${endpoint.api}/models`;
  const slow = sc === 'lent';

  // 1. Adresse (DNS)
  let ms = jitter(8, 24); await sleep(ms * 6, signal);
  if (sc === 'dns') return fail('dns', 0, ms, { cause: `getaddrinfo ENOTFOUND ${endpoint.host}` });
  done(0, 'ok', ms, endpoint.local ? `${endpoint.host}, sur cet ordinateur` : `${endpoint.host} trouvé`);
  diagnostics.add({ probeId, step: 'adresse', ms, level: 'ok', message: `${endpoint.host} résolu`, cause: endpoint.local ? 'hôte local' : 'DNS système' });

  // 2. Connexion (TCP + TLS)
  run(1);
  if (sc === 'delai') { await sleep(2500, signal); return fail('delai', 1, 10000, { method: 'GET', url: modelsUrl }); }
  ms = jitter(28, 60); await sleep(ms * 5, signal);
  if (sc === 'refuse') return fail('refuse', 1, ms, { cause: `connect ECONNREFUSED ${endpoint.host}` });
  if (sc === 'certificat') return fail('certificat', 1, ms);
  const tls = endpoint.secure ? 'HTTPS, certificat valide' : 'HTTP local';
  done(1, 'ok', ms, tls);
  diagnostics.add({ probeId, step: 'connexion', ms, level: 'ok', message: endpoint.secure ? 'TLS établi (certificat valide)' : 'connexion ouverte (http local)' });

  // 3. Clé (the first authenticated request)
  run(2);
  ms = jitter(40, 90); await sleep(ms * 4, signal);
  const hasKey = !!key.trim();
  if (sc === 'cle-refusee' && hasKey) return fail('cle-refusee', 2, ms, { method: 'GET', url: modelsUrl });
  if ((sc === 'cle-requise' || sc === 'cle-refusee') && !hasKey) return fail('cle-requise', 2, ms, { method: 'GET', url: modelsUrl });
  done(2, 'ok', ms, hasKey ? `acceptée (${maskKey(key)})` : noKey ? 'aucune, comme prévu' : 'aucune demandée');
  diagnostics.add({ probeId, step: 'cle', ms, level: 'ok', message: hasKey ? `clé acceptée (${maskKey(key)})` : 'aucune clé envoyée' });

  // 4. Modèles
  run(3);
  ms = slow ? 1800 : jitter(35, 110); await sleep(slow ? 1800 : ms * 3, signal);
  if (sc === 'pas-d-api') return fail('pas-d-api', 3, ms, { method: 'GET', url: modelsUrl });
  if (sc === 'vide') {
    const r = fail('vide', 3, ms, { method: 'GET', url: modelsUrl });
    return r;
  }
  const models = MODELS.map(m => ({ ...m }));
  done(3, 'ok', ms, `${models.length} disponibles`);
  diagnostics.add({ probeId, step: 'modeles', method: 'GET', url: modelsUrl, status: 200, ms, level: 'ok', message: `${models.length} modèles` });
  return { ok: true, steps, models, endpoint, probeId };
}

export async function listModels(opts) { const r = await probe(opts); return r.ok ? r.models : []; }

// « Essayer avec une phrase » — a canned reply, never the user's text in the log.
export async function tryModel({ url, model, signal } = {}) {
  const endpoint = normalizeEndpoint(url);
  const ms = scenario === 'lent' ? 2400 : jitter(520, 950);
  await sleep(ms, signal);
  diagnostics.add({ step: 'essai', method: 'POST', url: endpoint.ok ? `${endpoint.api}/chat/completions` : '', status: 200, ms, level: 'ok', message: `réponse de ${model || 'modèle'}` });
  return { ok: true, reply: 'Bonjour ! Je suis prêt.', ms };
}
