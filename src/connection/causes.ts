import type { MessageKey, Translate } from '../i18n';
import { errorCodes, probeCauses, type DiagEntry, type DiagStep, type ErrorCode, type ProbeCause, type ProbeProblem, type ProbeStep } from '../types';

// Rust sends codes (src-tauri/src/probe.rs): the interface says them. A cause has a title (what
// failed) and a gesture (what to do); an unknown code reads as the generic failure.
const known = (cause: string): cause is ProbeCause => (probeCauses as readonly string[]).includes(cause);
export const causeTitleKey = (cause: ProbeCause): MessageKey => `conn.cause.${cause}.title`;
export const causeFixKey = (cause: ProbeCause): MessageKey => `conn.cause.${cause}.fix`;
export function describeProblem(problem: Pick<ProbeProblem, 'cause'>, t: Translate): { title: string; fix: string } {
  if (!known(problem.cause)) return { title: t('conn.failed'), fix: t('conn.cause.cancelled.fix') };
  return { title: t(causeTitleKey(problem.cause)), fix: t(causeFixKey(problem.cause)) };
}
export const stepName = (step: DiagStep, t: Translate): string => t(`conn.step.${step}` as MessageKey);

// What a row of the trace says: its state while it runs or was skipped, its detail once it
// succeeded, the title of the failure on the row that failed.
export function stepText(step: ProbeStep, problem: ProbeProblem | null, t: Translate): string {
  if (step.state === 'running') return t('conn.state.running');
  if (step.state === 'skipped') return t('conn.state.skipped');
  if (step.state === 'error') return problem ? describeProblem(problem, t).title : t('conn.failed');
  const detail = step.detail;
  if (step.state !== 'ok' || !detail) return '';
  switch (detail.code) {
    case 'found': case 'local': return t(`conn.detail.${detail.code}`, { host: detail.host });
    case 'key_accepted': return detail.tail ? t('conn.detail.key_accepted', { key: `••••${detail.tail}` }) : t('conn.detail.key_accepted_short');
    case 'models': return t('conn.detail.models', { count: detail.count });
    default: return t(`conn.detail.${detail.code}`);
  }
}

// One line of the journal, from the entry's code: a neutral fact, a cause, or a request's error.
const facts = ['resolved', 'local', 'proxy', 'connected', 'tls', 'key_accepted', 'key_none', 'models', 'reply', 'done', 'started'];
export function entryMessage(entry: Pick<DiagEntry, 'code' | 'detail'>, t: Translate): string {
  const base = facts.includes(entry.code) ? t(`diag.code.${entry.code}` as MessageKey)
    : known(entry.code) ? t(causeTitleKey(entry.code))
    : (errorCodes as readonly string[]).includes(entry.code) ? t(`result.error.${entry.code as ErrorCode}` as MessageKey)
    : entry.code;
  return entry.detail ? `${base} · ${entry.detail}` : base;
}
