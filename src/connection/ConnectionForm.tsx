import { useEffect, useRef, type ReactNode } from 'react';
import { useT, type MessageKey } from '../i18n';
import { Combobox, Field, Input, SecretInput, useFieldId, type Option } from '../components/controls';
import type { ModelInfo, ProbeProblem } from '../types';
import { ConnectionCheck, InsecureNotice, useProbe, type Probe } from './Check';
import { apiKeyMaxLength, cleanEndpoint, cleanKey, endpointMaxLength, shortModel } from './endpoint';
import './connection.css';

// Address, key, the live check and the model picker: one component for the setup (question
// « Votre modèle ») and Settings › Server (design-lab/reglages/src/connection/Connection.jsx).
// The person only ever types an address (never « /v1 »: it is cleaned for them), a key or « my
// server has no key », and picks a model in the list read from the server.
export type ConnectionValue = { endpoint: string; apiKey: string; noKey: boolean; model: string };
export type ConnectionFormProps = {
  value: ConnectionValue;
  // immediate: false while typing (the caller saves after a pause), true for a choice.
  onChange: (next: ConnectionValue, immediate: boolean) => void;
  variant: 'setup' | 'settings';
  // « Voir le journal »: open the journal on a failure (its logId) or on a check (its run id).
  onOpenLog?: (problem: ProbeProblem | null, run: string | null) => void;
  // Whether a model is chosen on a server that answered: the setup's « Continue » waits for it.
  onReady?: (ready: boolean) => void;
  // An external useProbe() (Settings keep one per server, shared by the card and this form, so
  // the journal gets no duplicates). Absent: the form runs its own.
  probe?: Probe;
  // Show the live check inside the form (false when the host shows it, like the server card).
  check?: boolean;
  // Prefix of the fields' data-field (« s1 » gives s1.endpoint, s1.apiKey, s1.model): direct links.
  fieldPrefix?: string;
  children?: ReactNode;
};

export function modelOptions(models: ModelInfo[]): Option[] {
  return models.map(model => {
    const label = shortModel(model.id);
    const hint = [label === model.id ? null : model.id, model.ownedBy].filter(Boolean).join(' · ');
    return { value: model.id, label, ...(hint ? { hint } : {}) };
  });
}
const reasonCause = { empty: 'address.empty', malformed: 'address.malformed', scheme: 'address.scheme', credentials: 'address.credentials' } as const;

export function ConnectionForm({ value, onChange, variant, onOpenLog, onReady, probe: external, check = true, fieldPrefix }: ConnectionFormProps) {
  const t = useT();
  const urlId = useFieldId('url');
  const keyId = useFieldId('key');
  const modelId = useFieldId('model');
  const { endpoint, apiKey, noKey, model } = value;
  const set = (patch: Partial<ConnectionValue>, immediate: boolean) => onChange({ ...value, ...patch }, immediate);
  const own = useProbe({ endpoint, apiKey, noKey, auto: !external });
  const probe = external ?? own;
  const field = (name: string) => fieldPrefix ? `${fieldPrefix}.${name}` : name;

  // A server that answered and no model chosen yet: the first of its list. A model already
  // chosen is never replaced behind the person's back, even when the server no longer lists it.
  const latest = useRef(value);
  latest.current = value;
  useEffect(() => {
    if (probe.status === 'ok' && probe.models.length && !latest.current.model.trim()) onChange({ ...latest.current, model: probe.models[0].id }, true);
  }, [probe.status, probe.models]); // eslint-disable-line react-hooks/exhaustive-deps
  const listed = probe.models.some(item => item.id === model);
  const ready = probe.status === 'ok' && model.trim() !== '';
  useEffect(() => { onReady?.(ready); }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const read = probe.endpoint;
  const typed = endpoint.trim() !== '';
  const urlHint = !typed ? t('conn.addressHint')
    : read.ok ? <>{t('conn.addressKept')}<b>{read.display}</b>{read.removed && t('conn.addressRemoved', { removed: read.removed })}</> : null;
  const urlProblem = typed && !read.ok ? `${t(`conn.cause.${reasonCause[read.reason]}.title` as MessageKey)}. ${t(`conn.cause.${reasonCause[read.reason]}.fix` as MessageKey)}` : null;
  const keyMissing = read.ok && !apiKey.trim() && !noKey;
  const count = probe.models.length;
  const modelHint = keyMissing ? t('conn.modelNeedsKeyHint')
    : probe.status === 'running' ? t('conn.modelReading')
    : probe.status === 'error' ? t('conn.modelUnavailable')
    : probe.status === 'ok' ? (model && !listed ? null : t(count === 1 ? 'conn.modelCountOne' : 'conn.modelCountOther', { count }))
    : t('conn.modelAuto');
  const modelProblem = probe.status === 'ok' && model && !listed ? t('conn.modelAbsent', { model }) : null;

  return <div className="ft-connection" data-layout={variant}>
    <div className="ft-connection-url" data-field={field('endpoint')}>
      <Field label={t('conn.address')} htmlFor={urlId} hint={urlHint} problem={urlProblem}>
        <Input id={urlId} value={endpoint} placeholder="https://llm.exemple.com" inputMode="url" maxLength={endpointMaxLength} onChange={event => set({ endpoint: cleanEndpoint(event.target.value) }, false)} />
      </Field>
      <InsecureNotice endpoint={read} />
    </div>
    <div data-field={field('apiKey')}>
      <Field label={t('conn.key')} htmlFor={keyId}
        aside={<button type="button" className="ft-linklike" aria-pressed={noKey} onClick={() => set({ noKey: !noKey, apiKey: noKey ? apiKey : '' }, true)}>{t(noKey ? 'conn.hasKey' : 'conn.noKey')}</button>}
        hint={noKey ? t('conn.noKeyHint') : apiKey ? null : t('conn.keyHint')}>
        <SecretInput id={keyId} value={apiKey} onChange={next => set({ apiKey: cleanKey(next) }, false)} placeholder={noKey ? t('conn.keyNone') : 'sk-…'} disabled={noKey} maxLength={apiKeyMaxLength}
          note={apiKey ? t('conn.keyNote') : undefined} />
      </Field>
    </div>

    {check && <ConnectionCheck probe={probe} model={model} onOpenLog={onOpenLog} />}

    <div data-field={field('model')}>
      <Field label={t('conn.model')} htmlFor={modelId} hint={modelHint} problem={modelProblem}>
        <Combobox id={modelId} label={t('conn.model')} value={model} options={modelOptions(probe.models)} onChange={next => set({ model: next }, true)} disabled={probe.status !== 'ok'}
          loading={probe.status === 'running'} placeholder={t(keyMissing ? 'conn.modelNeedsKey' : 'conn.modelChoose')} searchPlaceholder={t('conn.modelSearch')} empty={t('conn.modelNone')} />
      </Field>
    </div>
  </div>;
}
