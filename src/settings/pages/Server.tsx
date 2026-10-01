import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, LockOpen, MessageSquareText, Plus, RotateCw, Server as ServerIcon, Trash2 } from 'lucide-react';
import { bridge } from '../../bridge';
import { locales, useLanguage, useT } from '../../i18n';
import { Button, Group, ICON, IconButton, MiddleEllipsis, Segmented, Spinner, Tooltip } from '../../components/controls';
import { useTx } from '../../components/motion';
import { CheckLine, CheckTrace, useCheck, type Probe } from '../../connection/Check';
import { ConnectionForm } from '../../connection/ConnectionForm';
import { describeProblem } from '../../connection/causes';
import { hostOf, maskedKey, normalizeEndpoint } from '../../connection/endpoint';
import type { ProbeProblem, Server, TryResult } from '../../types';
import { addServer, canAddServer, removeServer, setDefaultServer, updateServer } from '../servers';
import { useSettingsContext } from '../useSettingsStore';

// « Essayer avec une phrase »: one fixed, synthetic sentence (never the person's text), on what
// is typed. One try at a time; it ends by its answer or, at the latest, by the watchdog (Rust's
// own limit is 30 s): the button never stays spinning.
const tryWatchdogMs = 35_000;
let trySerial = 0;
function TryLine({ server, ready }: { server: Server; ready: boolean }) {
  const t = useT();
  const tx = useTx();
  const language = useLanguage();
  const [state, setState] = useState<{ busy: boolean; result: TryResult | null }>({ busy: false, result: null });
  const current = useRef<string | null>(null);
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; if (current.current) void bridge.cancelProbe(current.current).catch(() => undefined); }; }, []);
  // The answer belongs to what was tried: a changed address, key or model forgets it.
  useEffect(() => { setState(previous => previous.busy ? previous : { busy: false, result: null }); }, [server.endpoint, server.apiKey, server.noKey, server.model]);
  const run = async () => {
    if (current.current) return;
    const id = `try-${Date.now().toString(36)}-${(trySerial++).toString(36)}`;
    current.current = id;
    setState({ busy: true, result: null });
    let watchdog = 0;
    const late = new Promise<TryResult>(resolve => { watchdog = window.setTimeout(() => resolve({ run: id, ok: false, problem: { step: 'try', cause: 'try.timeout' } }), tryWatchdogMs); });
    const answer = bridge.tryModel(id, server.endpoint, server.apiKey, server.noKey, server.model).catch((): TryResult => ({ run: id, ok: false, problem: { step: 'try', cause: 'try.server' } }));
    const result = await Promise.race([answer, late]);
    window.clearTimeout(watchdog);
    if (current.current !== id) return;
    current.current = null;
    if (!result.ok && result.problem.cause === 'try.timeout') void bridge.cancelProbe(id).catch(() => undefined);
    if (live.current) setState({ busy: false, result: !result.ok && result.problem.cause === 'cancelled' ? null : result });
  };
  const result = state.result;
  const seconds = (ms: number) => t('conn.seconds', { seconds: new Intl.NumberFormat(locales[language], { maximumFractionDigits: 1 }).format(ms / 1000) });
  return <div className="st-try">
    <Button size="sm" icon={state.busy ? <Spinner size={14} /> : <MessageSquareText {...ICON} size={14} />} onClick={() => void run()} disabled={state.busy || !ready || !server.model.trim()}>{t('conn.try')}</Button>
    <AnimatePresence initial={false}>
      {result && <motion.span key={result.run} className="st-try-reply" data-ok={result.ok ? '' : undefined} role="status" initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={tx('smooth')}>
        {result.ok ? <>{t('conn.tryReply', { reply: result.reply })} <span>{seconds(result.ms)}</span></> : <b>{describeProblem(result.problem, t).title}. {describeProblem(result.problem, t).fix}</b>}
      </motion.span>}
    </AnimatePresence>
  </div>;
}

type CardProps = {
  server: Server; probe: Probe; isDefault: boolean; showDefault: boolean; expanded: boolean;
  onToggle: () => void; onChange: (patch: Partial<Omit<Server, 'id'>>, immediate: boolean) => void; onRemove?: () => void; onOpenLog: (problem: ProbeProblem | null, run: string | null) => void;
};
// One card per server. Its header says whether it is connected in ONE line (« ● Connecté · model
// · 162 ms   Détails ▾ »); while it checks, the trace unfolds under the header with the sweep,
// then folds back; on an error it stays open on the failing step (cause, gesture, « Voir le
// journal »). « Modifier » unfolds the connection form.
function ServerCard({ server, probe, isDefault, showDefault, expanded, onToggle, onChange, onRemove, onOpenLog }: CardProps) {
  const t = useT();
  const tx = useTx();
  const check = useCheck(probe);
  const state = probe.status === 'idle' ? (probe.ready ? 'idle' : 'warn') : probe.status;
  return <motion.section layout="position" className="st-server" data-expanded={expanded ? '' : undefined} data-state={state} data-server={server.id}
    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={tx('smooth')}>
    <div className="st-server-head">
      <span className="st-server-icon" aria-hidden="true"><ServerIcon {...ICON} size={18} /></span>
      <div className="st-server-id">
        <strong>
          <span className="st-server-host">{hostOf(server.endpoint) || t('page.server.new')}</span>
          {probe.endpoint.ok && probe.endpoint.insecure && <Tooltip content={t('conn.insecureShort')}>
            <span className="st-chip" data-kind="warn" tabIndex={0}><LockOpen size={11} strokeWidth={2} aria-hidden="true" />http</span>
          </Tooltip>}
          {showDefault && isDefault && <span className="st-chip" data-kind="page">{t('page.server.default')}</span>}
        </strong>
        <CheckLine probe={probe} model={server.model} check={check} className="st-server-line" />
      </div>
      <div className="st-server-actions">
        {/* Always in its slot (no jump, a double click never falls through): a spinner while it
            checks; hidden on an error, where the open trace has its own « Vérifier à nouveau ». */}
        {probe.ready && <span className="st-recheck" data-hidden={probe.status === 'error' ? '' : undefined}>
          <IconButton size="sm" label={t(probe.status === 'running' ? 'conn.rechecking' : 'conn.recheck')} onClick={probe.start} disabled={probe.status === 'running' || probe.status === 'error'}>
            {probe.status === 'running' ? <Spinner size={14} /> : <RotateCw {...ICON} size={15} />}
          </IconButton>
        </span>}
        <Button size="sm" onClick={onToggle} aria-expanded={expanded} iconEnd={<ChevronDown className="st-chevron-down" {...ICON} size={14} aria-hidden="true" />}>{t(expanded ? 'ui.close' : 'page.server.edit')}</Button>
      </div>
    </div>
    <CheckTrace probe={probe} check={check} onOpenLog={onOpenLog} className="st-server-trace" />
    <AnimatePresence initial={false}>
      {!expanded && <motion.dl key="facts" className="st-server-facts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: tx(0.1) }} transition={tx(0.2)}>
        <div><dt>{t('conn.model')}</dt><dd>{server.model ? <MiddleEllipsis text={server.model} /> : probe.status === 'running' ? <span className="st-fact-wait"><Spinner size={12} />{t('page.server.searching')}</span> : '—'}</dd></div>
        <div><dt>{t('conn.key')}</dt><dd>{server.noKey ? t('page.server.keyNone') : server.apiKey ? maskedKey(server.apiKey) : t('page.server.keyMissing')}</dd></div>
      </motion.dl>}
    </AnimatePresence>
    <AnimatePresence initial={false}>
      {expanded && <motion.div key="form" className="st-server-body-wrap" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={tx('smooth')}>
        <div className="st-server-body">
          <ConnectionForm value={server} onChange={(next, immediate) => onChange({ endpoint: next.endpoint, apiKey: next.apiKey, noKey: next.noKey, model: next.model }, immediate)}
            probe={probe} onOpenLog={onOpenLog} variant="settings" check={false} fieldPrefix={server.id} />
          <div className="st-server-foot">
            <TryLine server={server} ready={probe.status === 'ok'} />
            {onRemove && <Button size="sm" variant="danger" icon={<Trash2 {...ICON} size={14} />} onClick={onRemove}>{t('page.server.remove')}</Button>}
          </div>
        </div>
      </motion.div>}
    </AnimatePresence>
  </motion.section>;
}

// « Serveur »: ONE server by default; « Ajouter un serveur » for a second, then which one the
// menu and the shortcuts use. Never « Quality / Fast ».
export function ServerPage() {
  const t = useT();
  const tx = useTx();
  const { settings, persist, probes, openLog, expanded, setExpanded, addressDrafts, setAddressDraft } = useSettingsContext();
  // An address that reads (or an empty one) is saved; one that does not yet stays a draft of the
  // window, shown in its field with its reason, while everything else typed is saved as usual.
  const change = (server: Server, patch: Partial<Omit<Server, 'id'>>, immediate: boolean) => {
    const address = patch.endpoint ?? server.endpoint;
    if (address.trim() === '' || normalizeEndpoint(address).ok) { setAddressDraft(server.id, null); persist(updateServer(settings, server.id, patch), immediate); return; }
    setAddressDraft(server.id, address);
    const { endpoint: _unreadable, ...rest } = patch;
    if ((Object.keys(rest) as Array<keyof typeof rest>).some(key => rest[key] !== server[key])) persist(updateServer(settings, server.id, rest), immediate);
  };
  const servers = settings.servers.slice(0, 2);
  const two = servers.length > 1;
  const add = () => {
    const next = addServer(settings);
    if (!next.id) return;
    setExpanded(next.id, true);
    persist(next.settings, true);
  };
  return <>
    <div className="st-servers" data-field="server">
      <AnimatePresence initial={false}>
        {servers.map((server, index) => probes[server.id] && <ServerCard key={server.id} server={{ ...server, endpoint: addressDrafts[server.id] ?? server.endpoint }} probe={probes[server.id]} isDefault={settings.defaultServerId === server.id} showDefault={two}
          expanded={expanded.has(server.id)} onToggle={() => setExpanded(server.id, !expanded.has(server.id))}
          onChange={(patch, immediate) => change(server, patch, immediate)}
          onRemove={index > 0 ? () => { setExpanded(server.id, false); setAddressDraft(server.id, null); persist(removeServer(settings, server.id), true); } : undefined} onOpenLog={openLog} />)}
      </AnimatePresence>
    </div>

    <AnimatePresence initial={false} mode="popLayout">
      {two
        ? <motion.div key="default" layout="position" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={tx('smooth')}>
            <Group title={t('page.server.defaultTitle')} description={t('page.server.defaultHelp')}>
              <div className="st-group-pad">
                <Segmented label={t('page.server.defaultTitle')} block value={settings.defaultServerId} onChange={id => persist(setDefaultServer(settings, id), true)}
                  options={servers.map(server => ({ value: server.id, label: hostOf(server.endpoint) || t('page.server.new') }))} />
              </div>
            </Group>
          </motion.div>
        : canAddServer(settings) && <motion.div key="add" layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={tx(0.16)}>
            <button type="button" className="st-add-server" onClick={add}>
              <span className="st-add-icon" aria-hidden="true"><Plus size={16} strokeWidth={1.75} /></span>
              <span><strong>{t('page.server.add')}</strong><small>{t('page.server.addHelp')}</small></span>
            </button>
          </motion.div>}
    </AnimatePresence>
    {!bridge.native && <p className="st-footnote">{t('settings.previewConnection')}</p>}
  </>;
}
