// Réglages › Serveur: one card per server. Its header says whether it is connected in ONE line
// (« ● Connecté · model · 162 ms   Détails ▾ »); while it checks, the trace unfolds under the
// header with the « balayage » sweep, then folds back; on an error it stays open on the failing
// step (cause, fix, « Voir le journal »). « Modifier » unfolds the connection form.
import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Server, Plus, MessageSquareText, Trash2, RotateCw, ChevronDown, LockOpen } from 'lucide-react';
import { Group, Button, IconButton, Segmented, Spinner, Tooltip, MiddleEllipsis, ICON } from '../../ui/index.jsx';
import { Connection, CheckLine, CheckTrace, useCheck } from '../../connection/Connection.jsx';
import { normalizeEndpoint, tryModel } from '../../mock/server.js';
import { useTx } from '../../lib/motion.js';
import { useSettings } from '../state.js';

const hostOf = url => { const e = normalizeEndpoint(url); return e.ok ? e.display : (url.trim() || 'Nouveau serveur'); };

function TryLine({ server }) {
  const [state, setState] = useState({ busy: false, reply: null });
  const ctrl = useRef(null);
  const tx = useTx();
  const run = async () => {
    ctrl.current?.abort(); const c = new AbortController(); ctrl.current = c;
    setState({ busy: true, reply: null });
    const r = await tryModel({ url: server.url, model: server.model, signal: c.signal }).catch(() => null);
    if (!c.signal.aborted && r) setState({ busy: false, reply: r });
  };
  return (
    <div className="st-try">
      <Button size="sm" icon={state.busy ? <Spinner size={14} /> : <MessageSquareText {...ICON} size={14} />} onClick={run} disabled={state.busy || !server.model}>Essayer avec une phrase</Button>
      <AnimatePresence initial={false}>
        {state.reply && (
          <motion.span className="st-try-reply" initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={tx('smooth')}>
            « {state.reply.reply} » <span>{(state.reply.ms / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} s</span>
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

function ServerCard({ server, probe: p, isDefault, showDefault, expanded, onToggle, onChange, onRemove, onOpenLog }) {
  const tx = useTx();
  const check = useCheck(p);
  const state = p.status === 'idle' ? (p.ready ? 'idle' : 'warn') : p.status;
  return (
    <motion.section layout="position" className="st-server" data-expanded={expanded ? '' : undefined} data-state={state}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={tx('smooth')}>
      <div className="st-server-head">
        <span className="st-server-icon" aria-hidden="true"><Server {...ICON} size={18} /></span>
        <div className="st-server-id">
          <strong>
            <span className="st-server-host">{hostOf(server.url)}</span>
            {p.endpoint?.insecure && (
              <Tooltip content="Connexion non chiffrée : la clé et le texte passent en clair.">
                <span className="st-chip" data-kind="warn" tabIndex={0}><LockOpen size={11} strokeWidth={2} aria-hidden="true" />http</span>
              </Tooltip>
            )}
            {showDefault && isDefault && <span className="st-chip" data-kind="page">Par défaut</span>}
          </strong>
          <CheckLine p={p} model={server.model} check={check} className="st-server-line" />
        </div>
        <div className="st-server-actions">
          {/* Always in its slot (no jump, a double click never falls through): a spinner while it
              checks; hidden on an error, where the open trace has its own « Vérifier à nouveau ». */}
          {p.ready && (
            <span className="st-recheck" data-hidden={p.status === 'error' ? '' : undefined}>
              <IconButton size="sm" label={p.status === 'running' ? 'Vérification en cours' : 'Vérifier à nouveau'} onClick={p.run}
                disabled={p.status === 'running' || p.status === 'error'}>
                {p.status === 'running' ? <Spinner size={14} /> : <RotateCw {...ICON} size={15} />}
              </IconButton>
            </span>
          )}
          <Button size="sm" onClick={onToggle} aria-expanded={expanded} iconEnd={<ChevronDown className="st-chevron-down" {...ICON} size={14} aria-hidden="true" />}>{expanded ? 'Fermer' : 'Modifier'}</Button>
        </div>
      </div>
      <CheckTrace p={p} check={check} onOpenLog={onOpenLog} className="st-server-trace" />
      <AnimatePresence initial={false}>
        {!expanded && (
          <motion.dl key="facts" className="st-server-facts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: tx(0.1) }} transition={tx(0.2)}>
            <div><dt>Modèle</dt><dd>{server.model ? <MiddleEllipsis text={server.model} /> : (p.status === 'running' ? <span className="st-fact-wait"><Spinner size={12} />Recherche…</span> : '—')}</dd></div>
            <div><dt>Clé API</dt><dd>{server.noKey ? 'Aucune' : server.key ? `••••${server.key.slice(-4)}` : 'À renseigner'}</dd></div>
          </motion.dl>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div key="form" className="st-server-body-wrap" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={tx('smooth')}>
            <div className="st-server-body" data-field="server">
              <Connection value={server} onChange={onChange} probe={p} onOpenLog={onOpenLog} layout="settings" check={false} />
              <div className="st-server-foot">
                <TryLine server={server} />
                {onRemove && <Button size="sm" variant="danger" icon={<Trash2 {...ICON} size={14} />} onClick={onRemove}>Retirer ce serveur</Button>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

export function ServerPage() {
  const { servers, setServers, defaultServerId, setDefaultServerId, probes, openLog, markSaved } = useSettings();
  const [expanded, setExpanded] = useState(() => new Set());
  const tx = useTx();
  const toggle = id => setExpanded(x => { const n = new Set(x); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const update = (id, next) => { setServers(list => list.map(sv => (sv.id === id ? { ...sv, ...next } : sv))); markSaved(); };
  const add = () => {
    const id = 's2';
    setServers(list => (list.length > 1 ? list : [...list, { id, url: '', key: '', noKey: false, model: '' }]));
    setExpanded(x => new Set(x).add(id));
    markSaved();
  };
  const remove = id => {
    setServers(list => list.filter(sv => sv.id !== id));
    setExpanded(x => { const n = new Set(x); n.delete(id); return n; });
    if (defaultServerId === id) setDefaultServerId(servers[0].id);
    markSaved();
  };
  const two = servers.length > 1;
  return (
    <>
      <div className="st-servers">
        <AnimatePresence initial={false}>
          {servers.map((sv, i) => (
            <ServerCard key={sv.id} server={sv} probe={probes[sv.id]} isDefault={defaultServerId === sv.id} showDefault={two}
              expanded={expanded.has(sv.id)} onToggle={() => toggle(sv.id)} onChange={next => update(sv.id, next)}
              onRemove={i > 0 ? () => remove(sv.id) : null} onOpenLog={openLog} />
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence initial={false} mode="popLayout">
        {two ? (
          <motion.div key="default" layout="position" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={tx('smooth')}>
            <Group title="Serveur par défaut" description="Celui qu’utilisent le menu et les raccourcis.">
              <div className="st-group-pad">
                <Segmented label="Serveur par défaut" block value={defaultServerId} onChange={v => { setDefaultServerId(v); markSaved(); }}
                  options={servers.map(sv => ({ value: sv.id, label: hostOf(sv.url) }))} />
              </div>
            </Group>
          </motion.div>
        ) : (
          <motion.div key="add" layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={tx(0.16)}>
            <button type="button" className="st-add-server" onClick={add}>
              <span className="st-add-icon" aria-hidden="true"><Plus size={16} strokeWidth={1.75} /></span>
              <span><strong>Ajouter un serveur</strong><small>Un second serveur, par exemple un modèle local pour les textes privés.</small></span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
