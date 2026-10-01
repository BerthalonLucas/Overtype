import { useEffect, useRef, useState } from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { AnimatePresence, motion } from 'motion/react';
import { Activity, Check, ChevronRight, Copy, Eraser, RotateCw } from 'lucide-react';
import { useT } from '../i18n';
import { Button, Dialog, ICON, Segmented } from '../components/controls';
import { useTx } from '../components/motion';
import type { DiagEntry } from '../types';
import { useDuration } from './Check';
import { entryMessage, stepName } from './causes';
import { clearJournal, clockTime, journalText, levelGlyph, redact, useJournal } from './diagnostics';
import './connection.css';
import '../settings/settings.css';

// The connection journal as a monochrome console (design-lab/reglages/src/settings/pages/
// Diagnostic.jsx): one ink, monospace, glyphs instead of colours; an error is told by ✕, its
// weight and an inverted status, never by red alone. Rows unfold on their detail. Used by the
// hidden Diagnostic page of the Settings and by the setup's « Journal » sheet.
export type JournalFilter = 'all' | 'errors';
export type DiagnosticsLanding = { filter: JournalFilter; logId?: number; run?: string | null; at: number };
type Props = {
  // « Voir le journal » lands here: that filter, that entry unfolded (or the check's first error).
  landing?: DiagnosticsLanding | null;
  // « Vérifier la connexion », offered while the journal is empty.
  onCheck?: () => void;
  // The visible rows are capped (the setup's sheet is small); the copy always takes them all.
  limit?: number;
};

function Entry({ entry, open, onOpenChange }: { entry: DiagEntry; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT();
  const duration = useDuration(1000);
  const message = redact(entryMessage(entry, t));
  const detail = ([
    [t('diag.colStep'), stepName(entry.step, t)],
    entry.method && [t('diag.request'), redact(`${entry.method} ${entry.url ?? ''}`)],
    entry.status != null && [t('diag.status'), String(entry.status)],
    entry.ms != null && [t('diag.colDuration'), duration(entry.ms)],
    entry.cause && [t('diag.cause'), redact(entry.cause)],
    entry.detail && [t('diag.detail'), redact(entry.detail)],
    entry.key && [t('diag.key'), entry.key],
    entry.proxy && [t('diag.proxy'), redact(entry.proxy)],
  ].filter(Boolean)) as Array<[string, string]>;
  return <Collapsible.Root open={open} onOpenChange={onOpenChange} className="st-log-entry" data-level={entry.level} data-entry={entry.id}>
    <Collapsible.Trigger className="st-log-row">
      <time className="st-log-time">{clockTime(entry.at)}</time>
      <span className="st-log-level" aria-label={t(`diag.level.${entry.level}`)}>{levelGlyph(entry.level)}</span>
      <span className="st-log-step">{stepName(entry.step, t)}</span>
      <span className="st-log-msg">{message}</span>
      <span className="st-log-status">{entry.status != null ? <span className="st-http" data-bad={entry.status >= 400 ? '' : undefined}>{entry.status}</span> : null}</span>
      <span className="st-log-ms">{entry.ms != null ? duration(entry.ms) : ''}</span>
      <ChevronRight className="st-chevron" size={14} strokeWidth={1.75} aria-hidden="true" />
    </Collapsible.Trigger>
    <Collapsible.Content className="st-collapse">
      <dl className="st-log-detail">{detail.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>
    </Collapsible.Content>
  </Collapsible.Root>;
}

export function DiagnosticsPanel({ landing, onCheck, limit }: Props) {
  const t = useT();
  const tx = useTx();
  const { entries, state } = useJournal();
  const [filter, setFilter] = useState<JournalFilter>(landing?.filter ?? 'all');
  const [openId, setOpenId] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const copiedTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);
  // « Voir le journal »: errors only, the failure unfolded (its entry, else the check's first
  // error, else the latest error). The entry may arrive a moment after the landing.
  const landed = useRef<number | null>(null);
  useEffect(() => {
    if (!landing) return;
    if (landed.current !== landing.at) setFilter(landing.filter);
    const target = entries.find(entry => entry.id === landing.logId)
      ?? entries.find(entry => entry.level === 'error' && landing.run != null && entry.run === landing.run)
      ?? (landed.current !== landing.at ? entries.find(entry => entry.level === 'error') : undefined);
    if (target && (landed.current !== landing.at || openId === null)) setOpenId(target.id);
    landed.current = landing.at;
  }, [landing, entries]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = entries.filter(entry => filter === 'all' || entry.level === 'error');
  const shown = limit ? rows.slice(0, limit) : rows;
  const errors = entries.filter(entry => entry.level === 'error').length;
  const copy = async () => {
    const text = journalText(entries, filter, t) || t('diag.emptyLog');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch { setManual(text); }
  };
  const clear = async () => {
    if (clearing) return;
    setClearing(true);
    try { await clearJournal(); setOpenId(null); } catch { /* the journal stays as it is */ } finally { setClearing(false); }
  };

  return <>
    <div className="st-log-bar">
      <Segmented<JournalFilter> label={t('diag.filter')} size="sm" value={filter} onChange={setFilter}
        options={[{ value: 'all', label: t('diag.all', { count: entries.length }) }, { value: 'errors', label: t('diag.errors', { count: errors }) }]} />
      <span className="st-log-tools">
        <Button size="sm" icon={copied ? <Check size={14} strokeWidth={2} /> : <Copy {...ICON} size={14} />} onClick={() => void copy()} disabled={!rows.length}>{t(copied ? 'diag.copied' : 'diag.copy')}</Button>
        <Button size="sm" variant="ghost" icon={<Eraser {...ICON} size={14} />} onClick={() => void clear()} disabled={!entries.length || clearing}>{t('diag.clear')}</Button>
      </span>
    </div>

    <div className="st-log" role="list" aria-label={t('diag.title')}>
      <div className="st-log-head" aria-hidden="true"><span>{t('diag.colTime')}</span><span /><span>{t('diag.colStep')}</span><span>{t('diag.colMessage')}</span><span>{t('diag.colStatus')}</span><span>{t('diag.colDuration')}</span><span /></div>
      <AnimatePresence initial={false}>
        {shown.map(entry => <motion.div key={entry.id} role="listitem" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={tx('smooth')}>
          <Entry entry={entry} open={openId === entry.id} onOpenChange={open => setOpenId(open ? entry.id : null)} />
        </motion.div>)}
      </AnimatePresence>
      {!shown.length && <div className="st-log-empty">
        <span className="st-empty-icon" aria-hidden="true"><Activity size={18} strokeWidth={1.5} /></span>
        <strong>{state === 'unavailable' ? t('diag.unavailable') : filter === 'errors' && entries.length ? t('diag.emptyErrors') : t('diag.emptyTitle')}</strong>
        <span>{t('diag.emptyText')}</span>
        {onCheck && <Button size="sm" icon={<RotateCw {...ICON} size={14} />} onClick={onCheck}>{t('diag.check')}</Button>}
      </div>}
    </div>
    <p className="st-footnote st-footnote-tight">{t('diag.footnote')} {t('diag.note')}</p>

    <Dialog open={manual != null} onOpenChange={open => { if (!open) setManual(null); }} title={t('diag.manualTitle')} description={t('diag.manualText')} width={520}
      actions={<Button variant="primary" onClick={() => setManual(null)}>{t('ui.close')}</Button>}>
      <textarea className="ft-input st-textarea st-mono" rows={10} readOnly value={manual ?? ''} onFocus={event => event.currentTarget.select()} autoFocus />
    </Dialog>
  </>;
}
