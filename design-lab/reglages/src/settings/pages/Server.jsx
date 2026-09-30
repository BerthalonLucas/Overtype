import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Server, Plus, ScrollText, MessageSquareText, Trash2, RotateCw, ChevronDown, ChevronRight } from 'lucide-react';
import { Group, Button, StatusDot, Segmented, Spinner, ICON } from '../../ui/index.jsx';
import { Connection } from '../../connection/Connection.jsx';
import { normalizeEndpoint, modelOptions, tryModel } from '../../mock/server.js';
import { useTx } from '../../lib/motion.js';
import { useSettings } from '../state.js';

const hostOf = url => { const e = normalizeEndpoint(url); return e.ok ? e.display : (url.trim() || 'Nouveau serveur'); };
const modelName = id => (id ? modelOptions([{ id, context: 0 }])[0].label : null);
const total = steps => steps.reduce((n, st) => n + (st.state === 'ok' && st.ms ? st.ms : 0), 0);

function statusOf(p) {
  if (p.status === 'running') return { state: 'running', text: 'Vérification…' };
  if (p.status === 'ok') return { state: 'ok', text: `Connecté · ${total(p.steps).toLocaleString('fr-FR')} ms` };
  if (p.status === 'error') return { state: 'error', text: p.error?.title || 'Échec de connexion' };
  if (!p.endpoint?.ok) return { state: 'idle', text: 'Adresse à renseigner' };
  if (!p.ready) return { state: 'warn', text: 'Clé API à renseigner' };
  return { state: 'idle', text: 'Non vérifié' };
}

function TryLine({ server }) {
  const [state, setState] = useState({ busy: false, reply: null });
  const ctrl = useRef(null);
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
          <motion.span className="st-try-reply" initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
            « {state.reply.reply} » <span>{(state.reply.ms / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} s</span>
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

function ServerCard({ server, probe, isDefault, showDefault, expanded, onToggle, onChange, onRemove, onOpenLog }) {
  const tx = useTx();
  const st = statusOf(probe);
  const model = modelName(server.model);
  return (
    <motion.section layout="position" className="st-server" data-expanded={expanded ? '' : undefined} data-state={st.state}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={tx('smooth')}>
      <div className="st-server-head">
        <span className="st-server-icon" aria-hidden="true"><Server {...ICON} size={18} /></span>
        <div className="st-server-id">
          <strong>{hostOf(server.url)}{showDefault && isDefault && <span className="st-chip" data-kind="accent">Par défaut</span>}</strong>
          <span className="st-server-meta">
            <StatusDot state={st.state}>{st.text}</StatusDot>
          </span>
        </div>
        <div className="st-server-actions">
          {probe.status === 'error' && <Button size="sm" variant="ghost" icon={<ScrollText {...ICON} size={14} />} onClick={onOpenLog}>Voir le journal</Button>}
          {!expanded && probe.status !== 'running' && probe.ready && <Button size="sm" variant="ghost" icon={<RotateCw {...ICON} size={14} />} onClick={probe.run} aria-label="Vérifier à nouveau" title="Vérifier à nouveau" className="st-icon-only" />}
          <Button size="sm" onClick={onToggle} aria-expanded={expanded} iconEnd={<ChevronDown className="st-chevron-down" {...ICON} size={14} aria-hidden="true" />}>{expanded ? 'Fermer' : 'Modifier'}</Button>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {!expanded && (
          <motion.dl key="facts" className="st-server-facts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: tx(0.1) }} transition={tx(0.2)}>
            <div><dt>Modèle</dt><dd>{model || (probe.status === 'running' ? 'Lecture…' : '—')}</dd></div>
            <div><dt>Clé API</dt><dd>{server.noKey ? 'Aucune' : server.key ? `••••${server.key.slice(-4)}` : 'À renseigner'}</dd></div>
            <div><dt>Adresse</dt><dd>{probe.endpoint?.ok ? probe.endpoint.display : '—'}</dd></div>
          </motion.dl>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div className="st-server-body-wrap" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={tx('smooth')}>
            <div className="st-server-body" data-field="server">
              <Connection value={server} onChange={onChange} probe={probe} onOpenLog={onOpenLog} layout="settings" />
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

// ——— Mat (Windows 11): one row per server; the row opens the server as a sub-page ———
function ServerLink({ server, probe, isDefault, showDefault, onOpen }) {
  const st = statusOf(probe);
  const model = modelName(server.model);
  return (
    <button type="button" className="st-link-card st-server" data-state={st.state} onClick={onOpen}>
      <span className="st-server-icon" aria-hidden="true"><Server {...ICON} size={18} /></span>
      <span className="st-server-id">
        <strong>{hostOf(server.url)}{showDefault && isDefault && <span className="st-chip" data-kind="accent">Par défaut</span>}</strong>
        <span className="st-server-meta"><StatusDot state={st.state}>{st.text}</StatusDot></span>
      </span>
      <span className="st-link-aside">{model || ''}</span>
      <ChevronRight className="st-link-chev" size={16} strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}
function ServerDetail({ server, probe, onChange, onRemove, onOpenLog }) {
  const st = statusOf(probe);
  return (
    <section className="st-server st-server-detail" data-state={st.state}>
      <div className="st-server-head">
        <span className="st-server-icon" aria-hidden="true"><Server {...ICON} size={18} /></span>
        <div className="st-server-id">
          <strong>{hostOf(server.url)}</strong>
          <span className="st-server-meta"><StatusDot state={st.state}>{st.text}</StatusDot></span>
        </div>
      </div>
      <div className="st-server-body" data-field="server">
        <Connection value={server} onChange={onChange} probe={probe} onOpenLog={onOpenLog} layout="settings" />
        <div className="st-server-foot">
          <TryLine server={server} />
          {onRemove && <Button size="sm" variant="danger" icon={<Trash2 {...ICON} size={14} />} onClick={onRemove}>Retirer ce serveur</Button>}
        </div>
      </div>
    </section>
  );
}

export function ServerPage() {
  const { servers, setServers, defaultServerId, setDefaultServerId, probes, openLog, markSaved, nav, sub, openSub, closeSub } = useSettings();
  const mat = nav === 'breadcrumb';
  const [expanded, setExpanded] = useState(() => new Set());
  const tx = useTx();
  const toggle = id => setExpanded(x => { const n = new Set(x); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const update = (id, next) => { setServers(list => list.map(sv => (sv.id === id ? { ...sv, ...next } : sv))); markSaved(); };
  const add = () => {
    const id = 's2';
    setServers(list => (list.length > 1 ? list : [...list, { id, url: '', key: '', noKey: false, model: '' }]));
    if (mat) openSub('serveur', id, 'Nouveau serveur');
    else setExpanded(x => new Set(x).add(id));
    markSaved();
  };
  const remove = id => {
    setServers(list => list.filter(sv => sv.id !== id));
    if (defaultServerId === id) setDefaultServerId(servers[0].id);
    if (mat) closeSub();
    markSaved();
  };
  const two = servers.length > 1;
  const open = mat && sub?.page === 'serveur' ? servers.find(sv => sv.id === sub.id) : null;
  if (open) {
    return (
      <ServerDetail server={open} probe={probes[open.id]} onChange={next => update(open.id, next)}
        onRemove={open.id !== servers[0].id ? () => remove(open.id) : null} onOpenLog={openLog} />
    );
  }
  return (
    <>
      <div className="st-servers">
        <AnimatePresence initial={false}>
          {servers.map((sv, i) => (mat ? (
            <ServerLink key={sv.id} server={sv} probe={probes[sv.id]} isDefault={defaultServerId === sv.id} showDefault={two}
              onOpen={() => openSub('serveur', sv.id, hostOf(sv.url))} />
          ) : (
            <ServerCard key={sv.id} server={sv} probe={probes[sv.id]} isDefault={defaultServerId === sv.id} showDefault={two}
              expanded={expanded.has(sv.id)} onToggle={() => toggle(sv.id)} onChange={next => update(sv.id, next)}
              onRemove={i > 0 ? () => remove(sv.id) : null} onOpenLog={openLog} />
          )))}
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
