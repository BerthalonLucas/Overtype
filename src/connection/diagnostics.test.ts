import { describe, expect, it } from 'vitest';
import { translate, type Translate } from '../i18n';
import type { DiagEntry } from '../types';
import { entryMessage, describeProblem, stepText } from './causes';
import { addEntry, clockTime, journalLimit, journalText, redact } from './diagnostics';
import { cleanEndpoint, cleanKey, hostOf, isTextModel, maskedKey, shortModel, textModels } from './endpoint';

const fr: Translate = (key, params) => translate('fr', key, params);
const key = 'sk-live-0123456789abcdefSECRET';
const entry = (id: number, over: Partial<DiagEntry> = {}): DiagEntry => ({
  id,
  at: '2026-10-01T12:00:00.000Z',
  step: 'models',
  level: 'ok',
  code: 'models',
  ...over,
});

describe('the connection journal', () => {
  it('keeps the newest first, without doubles, 500 at most', () => {
    let entries: DiagEntry[] = [];
    for (let id = 1; id <= journalLimit + 20; id++) entries = addEntry(entries, entry(id));
    expect(entries).toHaveLength(journalLimit);
    expect(entries[0].id).toBe(journalLimit + 20);
    expect(addEntry(entries, entry(journalLimit + 20))).toBe(entries);
    // An older entry that arrives late takes its place, not the top.
    expect(addEntry([entry(5), entry(3)], entry(4)).map((item) => item.id)).toEqual([5, 4, 3]);
  });

  it('never lets a key out in the copied text, whatever an entry carries', () => {
    const entries = [
      entry(3, {
        level: 'error',
        step: 'key',
        code: 'key.rejected',
        method: 'GET',
        url: `https://llm.exemple.com/v1/models?api_key=${key}`,
        status: 401,
        ms: 74,
        cause: `invalid key ${key}`,
        key: maskedKey(key),
      }),
      entry(2, { step: 'reach', code: 'tls', detail: `Authorization: Bearer ${key}` }),
      entry(1, {
        step: 'address',
        code: 'resolved',
        detail: 'llm.exemple.com → 203.0.113.24',
        proxy: `system: proxy.exemple.com?token=${key}`,
      }),
    ];
    const text = journalText(entries, 'all', fr);
    expect(text).not.toContain(key);
    expect(text).not.toContain('SECRET');
    expect(text.split('\n')).toHaveLength(3);
    expect(text).toContain('✕  Clé  GET  https://llm.exemple.com/v1/models?api_key=•••  401  74 ms  Clé refusée');
    // The mask (four last characters) is all that is ever shown of a key.
    expect(text).toContain('••••CRET');
    expect(journalText(entries, 'errors', fr).split('\n')).toHaveLength(1);
    expect(journalText([], 'all', fr)).toBe('');
    expect(redact(`x-api-key sk-abcdefgh12345678 and ?key=${key}&v=1`)).toBe('x-api-key sk-••• and ?key=•••&v=1');
  });

  it('says an entry from its code: a fact, a cause, or a request error', () => {
    expect(entryMessage(entry(1, { code: 'models', detail: '4' }), fr)).toBe('Modèles lus · 4');
    expect(entryMessage(entry(1, { code: 'reach.refused' }), fr)).toBe('Connexion refusée');
    expect(entryMessage(entry(1, { code: 'unauthorized' }), fr)).toBe('Clé API refusée');
    expect(entryMessage(entry(1, { code: 'something_new' }), fr)).toBe('something_new');
    expect(clockTime('not a date')).toBe('');
    expect(clockTime('2026-10-01T12:00:00.007Z')).toMatch(/^\d\d:\d\d:\d\d\.007$/);
  });

  it('says each row of the trace, and a failure by its title and its gesture', () => {
    expect(stepText({ id: 'address', state: 'ok', detail: { code: 'local', host: '127.0.0.1:8002' } }, null, fr)).toBe(
      '127.0.0.1:8002, sur cet ordinateur',
    );
    expect(stepText({ id: 'key', state: 'ok', detail: { code: 'key_accepted', tail: '3f2a' } }, null, fr)).toBe(
      'acceptée (••••3f2a)',
    );
    expect(stepText({ id: 'key', state: 'ok', detail: { code: 'key_accepted', tail: '' } }, null, fr)).toBe('acceptée');
    expect(stepText({ id: 'models', state: 'ok', detail: { code: 'models', count: 4 } }, null, fr)).toBe(
      '4 disponibles',
    );
    expect(stepText({ id: 'reach', state: 'running' }, null, fr)).toBe('en cours…');
    expect(stepText({ id: 'models', state: 'skipped' }, null, fr)).toBe('non testé');
    expect(stepText({ id: 'models', state: 'waiting' }, null, fr)).toBe('');
    expect(stepText({ id: 'reach', state: 'error' }, { step: 'reach', cause: 'reach.certificate' }, fr)).toBe(
      'Certificat refusé par Windows',
    );
    expect(describeProblem({ cause: 'models.empty' }, fr)).toEqual({
      title: 'Aucun modèle chargé sur ce serveur',
      fix: 'Chargez un modèle côté serveur, puis vérifiez à nouveau.',
    });
    // A cause this version does not know still reads as a failure with something to do.
    expect(describeProblem({ cause: 'future.cause' as never }, fr).title).toBe('Échec de connexion');
  });
});

describe('what a connection field may hold', () => {
  it('names a server by its host, shortens a model id, masks a key', () => {
    expect(hostOf('https://llm.exemple.com/v1')).toBe('llm.exemple.com');
    expect(hostOf('http://127.0.0.1:8002')).toBe('http://127.0.0.1:8002');
    expect(hostOf('')).toBe('');
    expect(shortModel('unsloth/gemma-4-12B-it-qat-GGUF:UD-Q4_K_XL')).toBe('gemma-4-12B-it-qat');
    expect(shortModel('qwen3-8b-instruct')).toBe('qwen3-8b-instruct');
    expect(maskedKey(key)).toBe('••••CRET');
    expect(maskedKey('short')).toBe('••••');
  });

  it('drops control characters and stops at the limits Rust enforces', () => {
    expect(cleanKey('sk-abc\r\ndef\u0000')).toBe('sk-abcdef');
    expect(cleanKey('k'.repeat(5000))).toHaveLength(4096);
    expect(cleanEndpoint('https://llm.exemple.com\n')).toBe('https://llm.exemple.com');
    expect(cleanEndpoint('h'.repeat(3000))).toHaveLength(2048);
  });
});

describe('the models offered for rewriting', () => {
  const ids = (list: string[]) => list.map((id) => ({ id }));
  it('leaves embedding and reranking models out of the picker and counts them', () => {
    const listed = ids([
      'unsloth/gemma-4-12B-it-qat-GGUF',
      'unsloth/Qwen3.5-4B-MTP-GGUF',
      'sft-agent-001/sft-agent-001.Q8_0',
      'nomic-ai/nomic-embed-text-v2-moe-GGUF',
      'BAAI/bge-m3',
      'text-embedding-3-small',
      'jina-reranker-v2',
    ]);
    expect(textModels(listed)).toEqual({ models: listed.slice(0, 3), hidden: 4 });
  });
  it('keeps a model whose name only contains the letters', () => {
    for (const id of [
      'gemma-4-12B-it',
      'embedded-systems-tutor',
      'mistral-large',
      'page5-chat',
      'google/gemma',
      'bgem-chat',
    ])
      expect(isTextModel(id), id).toBe(true);
  });
  it('never empties the list: a server that lists nothing else keeps everything', () => {
    const only = ids(['nomic-embed-text']);
    expect(textModels(only)).toEqual({ models: only, hidden: 0 });
    expect(textModels([])).toEqual({ models: [], hidden: 0 });
  });
});
