import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bridge } from './bridge';
import { connScenarioFrom, connScenarios, connectionCommand, maskKey, mockModels, mockReply, mockTiming, normalizeEndpoint, setConnScenario } from './bridge.mock';
import vectors from './connection/endpoint.vectors.json';
import { probeCauses, probeStepIds, type DemoEnded, type DiagEntry, type ProbeCause, type ProbeResult, type ProbeStepEvent, type Settings, type TryResult } from './types';

// The browser preview (no Tauri): the Îlot commands answer without a native window.
describe('bridge preview', () => {
  it('answers the AltGr question for French AZERTY (lot 4)', async () => {
    expect(await bridge.shortcutConflict('Ctrl+Alt+E')).toEqual({ altGr: true, character: '€' });
    expect(await bridge.shortcutConflict('Ctrl+Alt+Digit0')).toEqual({ altGr: true, character: '@' });
    expect(await bridge.shortcutConflict('Ctrl+Alt+Space')).toEqual({ altGr: false });
    expect(await bridge.shortcutConflict('Ctrl+Shift+E')).toEqual({ altGr: false });
  });
  it('starts from the defaults of a fresh install', async () => {
    const settings = await bridge.getSettings();
    expect(settings.defaultActionId).toBe('correct');
    expect(settings.menuActionIds).toEqual(['correct', 'translate', 'professionalize', 'shorten', 'email']);
    expect(settings.shortcutBindings.map(binding => [binding.kind, binding.shortcut])).toEqual([['menu', 'Ctrl+Alt+Space']]);
    // The Îlot, as Rust's UiVersion::Ilot.
    expect(settings.uiVersion).toBe('ilot');
    expect(settings.servers.map(server => server.id)).toContain(settings.defaultServerId);
  });
  it('asks for the 0.4 journey with ?ui=v4 only', async () => {
    const at = location.href;
    const loaded = async (search: string) => {
      history.replaceState(null, '', `/${search}`);
      vi.resetModules();
      return (await (await import('./bridge')).bridge.getSettings()).uiVersion;
    };
    try {
      expect(await loaded('?ui=v4')).toBe('v4');
      expect(await loaded('?ui=v5')).toBe('ilot');
      expect(await loaded('')).toBe('ilot');
    } finally {
      history.replaceState(null, '', at);
      vi.resetModules();
    }
  });
});

// ——— 0.6: the servers, the address rule and the simulated connection of the preview ———
describe('bridge preview: servers and settings of 0.6', () => {
  const loaded = async (search: string) => {
    history.replaceState(null, '', `/${search}`);
    vi.resetModules();
    return (await import('./bridge')).bridge;
  };
  const at = location.href;
  afterEach(() => { history.replaceState(null, '', at); vi.resetModules(); });

  it('starts set up on the simulated server, and as a fresh install in the setup window', async () => {
    const settings = await (await loaded('?window=settings')).getSettings();
    expect(settings.servers).toEqual([{ id: 's1', name: '', endpoint: 'https://llm.exemple.com', apiKey: '', noKey: true, model: 'unsloth/gemma-4-12B-it-qat-GGUF:UD-Q4_K_XL' }]);
    expect([settings.defaultServerId, settings.setupDone, settings.changedWordsStyle]).toEqual(['s1', true, 'encre']);
    const fresh = await (await loaded('?window=setup')).getSettings();
    expect(fresh.servers).toEqual([{ id: 's1', name: '', endpoint: '', apiKey: '', noKey: false, model: '' }]);
    expect(fresh.setupDone).toBe(false);
    // « Revoir l'accueil » and the demo stage open on an installation already set up.
    expect((await (await loaded('?window=setup&replay=1')).getSettings()).setupDone).toBe(true);
    expect((await (await loaded('?window=setup&stage=demo')).getSettings()).setupDone).toBe(true);
    expect((await (await loaded('?window=settings&servers=two')).getSettings()).servers.map(server => server.id)).toEqual(['s1', 's2']);
    expect((await (await loaded('?window=settings&servers=empty')).getSettings()).servers[0].endpoint).toBe('');
  });

  it('saves clean, as Rust does: the address normalised, no key for a server without one, a broken address refused', async () => {
    const bridge = await loaded('?window=settings');
    const settings = await bridge.getSettings();
    const changed: Settings[] = [];
    await bridge.on<Settings>('settings-changed', next => changed.push(next));
    await bridge.saveSettings({ ...settings, servers: [{ id: 's1', name: '', endpoint: ' llm.exemple.com/v1/ ', apiKey: 'left-over', noKey: true, model: '  gemma  ' }] });
    expect((await bridge.getSettings()).servers[0]).toEqual({ id: 's1', name: '', endpoint: 'https://llm.exemple.com', apiKey: '', noKey: true, model: 'gemma' });
    expect(changed).toHaveLength(1);
    await expect(bridge.saveSettings({ ...settings, servers: [{ ...settings.servers[0], endpoint: 'ftp://x' }] })).rejects.toBe('L’adresse du serveur est invalide.');
    expect((await bridge.getSettings()).servers[0].endpoint).toBe('https://llm.exemple.com');
    // The setup's end marks it done and tells every listener.
    const fresh = await loaded('?window=setup');
    await fresh.finishSetup(false);
    expect((await fresh.getSettings()).setupDone).toBe(true);
    // Restoring the defaults keeps the servers and the setup done.
    const reset = await bridge.resetSettings();
    expect([reset.servers[0].endpoint, reset.setupDone]).toEqual(['https://llm.exemple.com', true]);
  });

  it('closing the demo tells the setup how it ended', async () => {
    const bridge = await loaded('?window=setup');
    const ended: DemoEnded[] = [];
    await bridge.on<DemoEnded>('demo-ended', event => ended.push(event));
    await bridge.openDemo();
    await bridge.closeDemo(true);
    await bridge.closeDemo(false);
    expect(ended).toEqual([{ done: true }, { done: false }]);
  });
});

describe('an address is read the same way as in Rust', () => {
  it('passes the vectors Rust reads too (src/connection/endpoint.vectors.json)', () => {
    expect(vectors.valid.length).toBeGreaterThanOrEqual(20);
    expect(vectors.invalid.length).toBeGreaterThanOrEqual(8);
    for (const { input, ...expected } of vectors.valid) {
      const endpoint = normalizeEndpoint(input);
      expect(endpoint, input).toEqual({ ok: true, ...expected });
      // What is stored reads back as itself.
      if (endpoint.ok) expect(normalizeEndpoint(endpoint.base), input).toMatchObject({ ok: true, base: endpoint.base, changed: false });
    }
    for (const { input, reason } of vectors.invalid) expect(normalizeEndpoint(input), JSON.stringify(input)).toEqual({ ok: false, reason });
  });
});

describe('the simulated connection of the preview', () => {
  const key = 'sk-synthetic-0123456789-3f2a';
  let steps: ProbeStepEvent[];
  let journal: DiagEntry[];
  const emit = (name: 'probe-step' | 'diagnostic', payload: ProbeStepEvent | DiagEntry) => { if (name === 'probe-step') steps.push(payload as ProbeStepEvent); else journal.push(payload as DiagEntry); };
  const servers = (id: string) => id === 's1' ? { endpoint: 'https://llm.exemple.com', apiKey: key, noKey: false } : undefined;
  const probe = (run: string, endpoint = 'https://llm.exemple.com/v1', apiKey = key, noKey = false) => connectionCommand('probe_connection', { run, endpoint, apiKey, noKey }, emit, servers) as Promise<ProbeResult>;
  const attempt = (run: string, model: string, apiKey = key) => connectionCommand('try_model', { run, endpoint: 'https://llm.exemple.com', apiKey, noKey: false, model }, emit, servers) as Promise<TryResult>;
  const states = (result: ProbeResult) => result.steps.map(step => step.state);
  beforeEach(async () => { steps = []; journal = []; mockTiming.scale = 0; setConnScenario('ok'); await connectionCommand('clear_diagnostics', undefined, emit, servers); });
  afterEach(() => { mockTiming.scale = 1; setConnScenario('ok'); });

  it('reads the scenario from ?conn= and ignores an unknown one', () => {
    expect(connScenarios).toHaveLength(10);
    for (const id of connScenarios) expect(connScenarioFrom(`?window=settings&conn=${id}`)).toBe(id);
    expect(connScenarioFrom('?conn=nope')).toBe('ok');
    expect(connScenarioFrom('')).toBe('ok');
  });

  it('ok: four steps, each running before it is judged, the models, and a journal without the key', async () => {
    const result = await probe('r1');
    expect(result).toMatchObject({ run: 'r1', ok: true, endpoint: { ok: true, base: 'https://llm.exemple.com', removed: '/v1' } });
    expect(states(result)).toEqual(['ok', 'ok', 'ok', 'ok']);
    expect(result.steps.map(step => step.detail)).toEqual([{ code: 'found', host: 'llm.exemple.com' }, { code: 'tls' }, { code: 'key_accepted', tail: '3f2a' }, { code: 'models', count: 4 }]);
    expect(result.models).toEqual(mockModels);
    expect(result.problem).toBeUndefined();
    expect(steps.every(event => event.run === 'r1')).toBe(true);
    expect(steps[0].steps.every(step => step.state === 'waiting')).toBe(true);
    probeStepIds.forEach((id, index) => {
      const running = steps.findIndex(event => event.steps[index].state === 'running');
      const done = steps.findIndex(event => event.steps[index].state === 'ok');
      expect(running, id).toBeGreaterThan(-1);
      expect(done, id).toBeGreaterThan(running);
    });
    expect(steps.at(-1)!.steps).toEqual(result.steps);
    expect(journal.map(entry => entry.code)).toEqual(['resolved', 'tls', 'key_accepted', 'models']);
    expect(journal.at(-1)).toMatchObject({ run: 'r1', step: 'models', level: 'ok', method: 'GET', url: 'https://llm.exemple.com/v1/models', status: 200, key: '••••3f2a' });
    expect(JSON.stringify([journal, result])).not.toContain(key);
    expect(await connectionCommand('get_diagnostics', undefined, emit, servers)).toEqual(journal);
    // This computer, plain HTTP, no key at all.
    const local = await probe('r2', '127.0.0.1:8002', '', true);
    expect(local.steps.map(step => step.detail?.code)).toEqual(['local', 'http_local', 'key_none', 'models']);
    expect((await probe('r3', 'http://192.168.1.20:8000', '')).steps.map(step => step.detail?.code)).toEqual(['found', 'http_insecure', 'key_not_asked', 'models']);
  });

  it('every failing scenario stops on its row with its cause, like the real check', async () => {
    const cases: Array<[typeof connScenarios[number], string, ProbeResult['steps'][number]['state'][], ProbeCause, number | undefined]> = [
      ['dns', key, ['error', 'skipped', 'skipped', 'skipped'], 'address.dns', undefined],
      ['refuse', key, ['ok', 'error', 'skipped', 'skipped'], 'reach.refused', undefined],
      ['certificat', key, ['ok', 'error', 'skipped', 'skipped'], 'reach.certificate', undefined],
      ['delai', key, ['ok', 'error', 'skipped', 'skipped'], 'reach.timeout', undefined],
      ['cle-requise', '', ['ok', 'ok', 'error', 'skipped'], 'key.required', 401],
      ['cle-refusee', key, ['ok', 'ok', 'error', 'skipped'], 'key.rejected', 401],
      ['cle-refusee', '', ['ok', 'ok', 'error', 'skipped'], 'key.required', 401],
      ['pas-d-api', key, ['ok', 'ok', 'skipped', 'error'], 'models.notfound', 404],
      ['vide', key, ['ok', 'ok', 'ok', 'error'], 'models.empty', 200],
    ];
    for (const [scenario, apiKey, expected, cause, status] of cases) {
      setConnScenario(scenario);
      const result = await probe(`run-${scenario}`, 'https://llm.exemple.com', apiKey);
      expect(states(result), scenario).toEqual(expected);
      expect(result, scenario).toMatchObject({ ok: false, models: [], problem: { cause, step: cause.split('.')[0], ...(status ? { status } : {}) } });
      // « Voir le journal » opens on the failure's own line.
      expect(journal.find(entry => entry.id === result.problem!.logId), scenario).toMatchObject({ level: 'error', code: cause, run: `run-${scenario}` });
    }
    setConnScenario('cle-requise');
    expect((await probe('with-key')).ok).toBe(true);
    setConnScenario('lent');
    expect((await probe('slow')).steps[3]).toMatchObject({ state: 'ok', ms: 1800 });
    expect(JSON.stringify(journal)).not.toContain(key);
    for (const [input, reason] of [['', 'empty'], ['https://', 'malformed'], ['ftp://x', 'scheme'], ['https://u:p@x', 'credentials']] as const) {
      expect(await probe('bad', input), input).toMatchObject({ ok: false, endpoint: { ok: false, reason }, problem: { step: 'address', cause: `address.${reason}` } });
    }
  });

  it('a newer check cancels the older one, and cancel_probe stops a run: nothing stays spinning', async () => {
    mockTiming.scale = 1;
    setConnScenario('lent');
    const first = probe('first');
    const second = probe('second');
    const cancelled = await first;
    expect(cancelled).toMatchObject({ run: 'first', ok: false, problem: { cause: 'cancelled' } });
    expect(cancelled.steps.some(step => step.state === 'running' || step.state === 'waiting')).toBe(false);
    await connectionCommand('cancel_probe', { run: 'second' }, emit, servers);
    expect(await second).toMatchObject({ run: 'second', ok: false, problem: { cause: 'cancelled' } });
    // A try runs beside a check without cancelling it; a second try cancels the first.
    mockTiming.scale = 0;
    setConnScenario('ok');
    const [check, tried] = await Promise.all([probe('check'), attempt('try', mockModels[0].id)]);
    expect([check.ok, tried.ok]).toEqual([true, true]);
    await connectionCommand('cancel_probe', { run: 'gone' }, emit, servers);
  });

  it('« Essayer avec une phrase » answers the fixed translation, or says why it cannot, and never logs the reply', async () => {
    expect(await attempt('t1', mockModels[1].id)).toMatchObject({ run: 't1', ok: true, reply: mockReply });
    expect(journal.at(-1)).toMatchObject({ step: 'try', level: 'ok', code: 'reply', method: 'POST', url: 'https://llm.exemple.com/v1/chat/completions', status: 200 });
    expect(JSON.stringify(journal)).not.toContain('réunion');
    const cause = async (scenario: typeof connScenarios[number], model = mockModels[0].id, apiKey = key) => { setConnScenario(scenario); const result = await attempt(`t-${scenario}`, model, apiKey); return result.ok ? 'ok' : result.problem.cause; };
    expect(await cause('ok', 'unknown-model')).toBe('try.model');
    expect(await cause('ok', '   ')).toBe('try.model');
    expect(await cause('delai')).toBe('try.timeout');
    expect(await cause('refuse')).toBe('reach.refused');
    expect(await cause('cle-refusee')).toBe('key.rejected');
    expect(await cause('cle-requise', mockModels[0].id, '')).toBe('key.required');
    expect(await cause('lent')).toBe('ok');
  });

  it('lists the models of a saved server and rejects with a problem otherwise', async () => {
    expect(await connectionCommand('list_models', { serverId: 's1' }, emit, servers)).toEqual(mockModels);
    await expect(connectionCommand('list_models', { serverId: 'gone' }, emit, servers)).rejects.toMatchObject({ cause: 'cancelled' });
    setConnScenario('vide');
    await expect(connectionCommand('list_models', { serverId: 's1' }, emit, servers)).rejects.toMatchObject({ step: 'models', cause: 'models.empty', status: 200 });
    setConnScenario('cle-refusee');
    await expect(connectionCommand('list_models', { serverId: 's1' }, emit, servers)).rejects.toMatchObject({ step: 'key', cause: 'key.rejected', status: 401 });
    expect(steps).toEqual([]);
  });

  it('masks a key like Rust: four characters of a long one, none of a short one', () => {
    expect(maskKey(key)).toBe('••••3f2a');
    expect(maskKey('short-key')).toBe('••••');
    expect(maskKey('clé-avec-accents-éàü')).toBe('••••-éàü');
  });

  it('has a cause for every failure Rust can name', () => {
    expect(probeCauses).toContain('reach.certificate');
    expect(new Set(probeCauses).size).toBe(probeCauses.length);
    expect(probeCauses.filter(cause => cause !== 'cancelled').every(cause => ['address', 'reach', 'key', 'models', 'try'].includes(cause.split('.')[0]))).toBe(true);
  });
});
