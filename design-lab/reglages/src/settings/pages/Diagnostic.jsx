import { useEffect, useState, useSyncExternalStore } from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronRight, Copy, Check, Eraser, Activity, RotateCw } from 'lucide-react';
import { Segmented, Button, Dialog, ICON } from '../../ui/index.jsx';
import { diagnostics, STEP_NAMES } from '../../mock/server.js';
import { copyText } from '../../lab/copy.js';
import { useTx } from '../../lib/motion.js';
import { useSettings } from '../state.js';

const useLog = () => useSyncExternalStore(diagnostics.subscribe, diagnostics.list, diagnostics.list);
const fmtMs = v => (v == null ? '' : v >= 1000 ? `${(v / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} s` : `${v} ms`);

function Entry({ e, open, onOpenChange }) {
  const detail = [
    ['Étape', STEP_NAMES[e.step] || e.step],
    e.method && ['Requête', `${e.method} ${e.url || ''}`],
    e.status != null && ['Statut HTTP', String(e.status)],
    e.ms != null && ['Durée', fmtMs(e.ms)],
    e.cause && [e.level === 'error' ? 'Cause' : 'Détail', e.cause],
  ].filter(Boolean);
  return (
    <Collapsible.Root open={open} onOpenChange={onOpenChange} className="st-log-entry" data-level={e.level}>
      <Collapsible.Trigger className="st-log-row">
        <time className="st-log-time">{e.time}</time>
        <span className="st-log-level" aria-label={e.level === 'error' ? 'Erreur' : e.level === 'ok' ? 'Réussi' : 'Info'}><i /></span>
        <span className="st-log-step">{STEP_NAMES[e.step] || e.step}</span>
        <span className="st-log-msg">{e.message}</span>
        <span className="st-log-status">{e.status != null ? <span className="st-http" data-bad={e.status >= 400 ? '' : undefined}>{e.status}</span> : null}</span>
        <span className="st-log-ms">{fmtMs(e.ms)}</span>
        <ChevronRight className="st-chevron" size={14} strokeWidth={1.75} aria-hidden="true" />
      </Collapsible.Trigger>
      <Collapsible.Content className="st-collapse">
        <dl className="st-log-detail">
          {detail.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

export function DiagnosticPage() {
  const { diagLanding, probes, defaultServerId } = useSettings();
  const log = useLog();
  const tx = useTx();
  const [filter, setFilter] = useState(diagLanding?.filter || 'all');
  const [openId, setOpenId] = useState(null);
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState(null);

  // « Voir le journal » lands here: errors only, the latest one unfolded.
  useEffect(() => {
    if (!diagLanding) return;
    setFilter(diagLanding.filter);
    const firstError = diagnostics.list().find(e => e.level === 'error');
    if (firstError) setOpenId(firstError.id);
  }, [diagLanding]);

  const rows = log.filter(e => filter === 'all' || e.level === 'error');
  const errors = log.filter(e => e.level === 'error').length;
  const copy = async () => {
    const text = diagnostics.toText(filter);
    const ok = await copyText(text || 'Journal vide.');
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1600); } else setManual(text);
  };
  const probe = probes[defaultServerId] || Object.values(probes)[0];

  return (
    <>
      <div className="st-log-bar">
        <Segmented label="Filtre du journal" size="sm" value={filter} onChange={setFilter}
          options={[{ value: 'all', label: `Tout · ${log.length}` }, { value: 'errors', label: `Erreurs · ${errors}` }]} />
        <span className="st-log-tools">
          <Button size="sm" icon={copied ? <Check size={14} strokeWidth={2} /> : <Copy {...ICON} size={14} />} onClick={copy} disabled={!rows.length}>{copied ? 'Copié' : 'Copier'}</Button>
          <Button size="sm" variant="ghost" icon={<Eraser {...ICON} size={14} />} onClick={() => { diagnostics.clear(); setOpenId(null); }} disabled={!log.length}>Effacer</Button>
        </span>
      </div>

      <div className="st-log" role="list" aria-label="Journal de connexion">
        <div className="st-log-head" aria-hidden="true"><span>Heure</span><span /><span>Étape</span><span>Message</span><span>HTTP</span><span>Durée</span><span /></div>
        <AnimatePresence initial={false}>
          {rows.map(e => (
            <motion.div key={e.id} role="listitem" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={tx('smooth')}>
              <Entry e={e} open={openId === e.id} onOpenChange={o => setOpenId(o ? e.id : null)} />
            </motion.div>
          ))}
        </AnimatePresence>
        {!rows.length && (
          <div className="st-log-empty">
            <span className="st-empty-icon" aria-hidden="true"><Activity size={18} strokeWidth={1.5} /></span>
            <strong>{filter === 'errors' && log.length ? 'Aucune erreur' : 'Rien pour l’instant'}</strong>
            <span>Chaque vérification de connexion s’écrit ici, étape par étape.</span>
            {probe?.ready && <Button size="sm" icon={<RotateCw {...ICON} size={14} />} onClick={probe.run}>Vérifier la connexion</Button>}
          </div>
        )}
      </div>
      <p className="st-footnote st-footnote-tight">Les plus récentes en haut, 500 entrées au plus.</p>

      <Dialog open={manual != null} onOpenChange={o => { if (!o) setManual(null); }} title="Copiez le journal à la main" description="Le presse-papiers est bloqué ici. Sélectionnez le texte, puis Ctrl+C." width={520}
        actions={<Button variant="primary" onClick={() => setManual(null)}>Fermer</Button>}>
        <textarea className="ft-input st-textarea st-mono" rows={10} readOnly value={manual || ''} onFocus={e => e.currentTarget.select()} autoFocus />
      </Dialog>
    </>
  );
}
