// Réglages — the Settings window of the lab (owner: agent Réglages).
// Fixed export: default SettingsWindow({ standalone, initialPage, onClose, onReplaySetup, initialServer, initialSettings, …AppWindow props })
//   renders ONE <AppWindow> (860 × 600) on the current <Stage>. Used by the section « Réglages »
//   (standalone: + a lab panel to the left of the window) and by the Parcours at the end of the setup.
//
// One page per topic (Lucas, QCM 29/09), organised three ways, one per direction:
//   Verre  (nav="sidebar")    fixed sidebar with search, every page one click away (Radix Tabs);
//   Mat    (nav="breadcrumb") Windows 11 Settings: sidebar + a breadcrumb title, and sub-pages that
//                             open inside a page (a server, an action's instruction);
//   Aérien (nav="push")       iOS Settings: a home list of rows, a row pushes its page, « ‹ Réglages »
//                             comes back.
// The Diagnostic page
// is hidden: Ctrl+Maj+M (or 5 clicks on the version) shows its entry and opens it; « Voir le
// journal » on the Serveur page lands there, filtered on errors.
// Theme and Animations are wired to the lab bar, so the window restyles live when you change them.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Settings2, Keyboard, Sparkles, Undo2, Palette, Server, Lock, Activity, Search, X, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { AppWindow } from '../stage/AppWindow.jsx';
import { createPortal } from 'react-dom';
import { AppMark, useDesktop } from '../stage/Desktop.jsx';
import { Tabs, TabList, Tab, TabPanel, PageHeader, StatusDot, Keycap, ICON } from '../ui/index.jsx';
import { useProbe } from '../connection/Connection.jsx';
import { Vote } from '../lab/Vote.jsx';
import { useLab } from '../lab/store.jsx';
import { useScope } from '../lab/Scope.jsx';
import { useTx, ms } from '../lib/motion.js';
import { appName } from '../brand.js';
import { DEFAULTS, KEPT_ON_RESET, SAMPLE_HISTORY, SettingsContext } from './state.js';
import { GeneralPage } from './pages/General.jsx';
import { ShortcutsPage } from './pages/Shortcuts.jsx';
import { ActionsPage } from './pages/Actions.jsx';
import { AfterPage } from './pages/After.jsx';
import { AppearancePage } from './pages/Appearance.jsx';
import { ServerPage } from './pages/Server.jsx';
import { DataPage } from './pages/Data.jsx';
import { DiagnosticPage } from './pages/Diagnostic.jsx';
import './settings.css';

export const SETTINGS_PAGES = [
  { id: 'general', label: 'Général', icon: Settings2, tile: 7, description: 'Démarrage, langue et accueil.', Page: GeneralPage },
  { id: 'raccourcis', label: 'Raccourcis', icon: Keyboard, tile: 1, description: 'Les touches qui ouvrent le menu ou lancent une action.', Page: ShortcutsPage },
  { id: 'actions', label: 'Actions', icon: Sparkles, tile: 3, description: 'Ce que propose le menu, dans quel ordre, avec quelle consigne.', Page: ActionsPage },
  { id: 'apres', label: 'Après remplacement', icon: Undo2, tile: 4, description: 'Ce qui s’affiche quand le texte vient d’être remplacé.', Page: AfterPage },
  { id: 'apparence', label: 'Apparence', icon: Palette, tile: 5, description: 'Thème, indicateur et mouvements.', Page: AppearancePage },
  { id: 'serveur', label: 'Serveur', icon: Server, tile: 2, description: `Où ${appName} envoie le texte.`, Page: ServerPage },
  { id: 'donnees', label: 'Données', icon: Lock, tile: 6, description: 'Ce qui reste sur cet appareil, et rien d’autre.', Page: DataPage },
  { id: 'diagnostic', label: 'Diagnostic', icon: Activity, tile: 8, hidden: true, description: 'Ce qui s’est passé à chaque connexion, et en combien de temps. Ni texte ni clé complète.', Page: DiagnosticPage },
];
const PAGE = Object.fromEntries(SETTINGS_PAGES.map(p => [p.id, p]));

// Everything the sidebar search can find: [field id, title, page, extra words].
const SEARCH = [
  ['autostart', 'Lancer à l’ouverture de session', 'general', 'démarrer windows démarrage'],
  ['language', 'Langue de l’interface', 'general', 'français english anglais'],
  ['replay', 'Revoir l’accueil', 'general', 'setup premier lancement bienvenue'],
  ['reset', 'Réglages par défaut', 'general', 'réinitialiser rétablir'],
  ['menuShortcut', 'Raccourci du menu', 'raccourcis', 'touches ctrl alt espace clavier'],
  ['defaultAction', 'Action par défaut', 'raccourcis', 'menu'],
  ['bindings', 'Raccourcis directs', 'raccourcis', 'combinaison touches'],
  ['grid', 'Actions dans le menu', 'actions', 'ordre lettres îlot grille tuiles'],
  ['instructions', 'Consignes', 'actions', 'prompt instruction'],
  ['check', 'Coche', 'apres', 'vérifier'],
  ['undo', 'Annuler', 'apres', 'durée secondes méthode ctrl+z'],
  ['changedWords', 'Surligner les mots changés', 'apres', 'surlignage'],
  ['placement', 'Position de la pilule', 'apres', 'pastille marge'],
  ['theme', 'Thème', 'apparence', 'clair sombre noir blanc'],
  ['indicator', 'Indicateur', 'apparence', 'perle nébuleuse ruban chargement'],
  ['motion', 'Animations', 'apparence', 'mouvement réduit'],
  ['motionPreset', 'Style de mouvement', 'apparence', 'fluide rebondi ressort'],
  ['textSize', 'Taille du texte', 'apparence', 'police lecture'],
  ['autoClose', 'Fermeture automatique', 'apparence', 'bulle'],
  ['server', 'Adresse du serveur', 'serveur', 'url connexion endpoint'],
  ['server', 'Clé API', 'serveur', 'key token'],
  ['server', 'Modèle', 'serveur', 'model liste'],
  ['history', 'Historique chiffré', 'donnees', 'effacer supprimer'],
];
const fold = t => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function SaveStatus({ state }) {
  const tx = useTx();
  return (
    <span className="st-save" aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        {state === 'saving'
          ? <motion.span key="saving" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={tx(0.12)}><StatusDot state="running">Enregistrement…</StatusDot></motion.span>
          : <motion.span key="saved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={tx(0.16)} className="st-save-ok"><Check size={14} strokeWidth={2} aria-hidden="true" />Enregistré</motion.span>}
      </AnimatePresence>
    </span>
  );
}

// The lab panel beside the window (standalone section only): hints and votes on the current page.
const PAGE_VOTES = {
  general: [['settings.page.general', 'Réglages › Général : réinitialiser avec confirmation dans la ligne', 'Confirmation dans la ligne (pas de fenêtre)']],
  raccourcis: [['settings.page.raccourcis', 'Réglages › Raccourcis : enregistreur de touches + raccourcis directs dépliables', 'Enregistreur de touches, raccourcis dépliables']],
  actions: [['settings.page.actions.preview', 'Réglages › Actions : aperçu de l’Îlot en direct au-dessus de la liste', 'Aperçu du menu en direct'], ['settings.page.actions.list', 'Réglages › Actions : liste ordonnée (flèches, lettre, interrupteur) + consignes dépliables', 'Liste : flèches, lettre, interrupteur']],
  apres: [['settings.page.apres', 'Réglages › Après remplacement : aperçu vivant de la pilule et des mots surlignés', 'Aperçu de la pilule et des mots surlignés']],
  apparence: [['settings.page.apparence.cards', 'Réglages › Apparence : choix en vignettes animées (thème, indicateur, mouvement)', 'Choix en vignettes animées']],
  serveur: [['settings.page.serveur.card', 'Réglages › Serveur : une carte par serveur, « Modifier » déplie la connexion', 'Carte serveur, « Modifier » la déplie'], ['settings.page.serveur.trace', 'Réglages › Serveur : trace de vérification étape par étape', 'Trace de vérification pas à pas']],
  donnees: [['settings.page.donnees', 'Réglages › Données : historique en liste avec suppression une à une', 'Historique, suppression une à une']],
  diagnostic: [['settings.page.diagnostic', 'Réglages › Diagnostic : journal en lignes dépliables, filtre Tout / Erreurs', 'Journal en lignes dépliables'], ['settings.diagnostic.reveal', 'Diagnostic caché, révélé par Ctrl+Maj+M (entrée animée dans la barre)', 'Caché, révélé par Ctrl+Maj+M']],
};
const NAV_VOTE = {
  sidebar: ['Réglages, organisation Verre : barre latérale fixe avec recherche, une page par sujet', 'Organisation : barre latérale fixe'],
  breadcrumb: ['Réglages, organisation Mat : barre latérale + fil d’Ariane, sous-pages dans la page (façon Windows 11)', 'Organisation : fil d’Ariane et sous-pages'],
  push: ['Réglages, organisation Aérien : liste d’accueil, chaque ligne pousse sa page (façon iOS)', 'Organisation : liste puis page poussée'],
};
function LabPanel({ page, onReveal, diagShown, nav }) {
  // On a phone the stage has no room beside the window: the panel stacks below it.
  const { asideEl } = useDesktop();
  const panel = (
    <aside className="st-labpanel" aria-label="Labo : avis sur les Réglages">
      <section>
        <h4>Essayez</h4>
        <p><span className="st-labpanel-keys"><Keycap size="sm">Ctrl</Keycap><Keycap size="sm">Maj</Keycap><Keycap size="sm">M</Keycap></span> affiche le Diagnostic caché.</p>
        <button type="button" className="st-labpanel-link" onClick={onReveal}>{diagShown ? 'Masquer le Diagnostic' : 'Afficher le Diagnostic'}</button>
        <p>{{ sidebar: 'Verre : barre latérale fixe.', breadcrumb: 'Mat : ouvrez un serveur ou une consigne, le titre devient un fil d’Ariane.', push: 'Aérien : une liste d’accueil, chaque ligne pousse sa page.' }[nav]} Changez de direction pour comparer.</p>
        <p>Le thème et les animations de la page Apparence pilotent le labo.</p>
        <p>Le scénario « Serveur simulé » de la barre change la réponse du serveur.</p>
      </section>
      <section>
        <h4>Votre avis</h4>
        <p className="st-labpanel-page">{PAGE[page]?.label || 'Accueil des Réglages'}</p>
        <div className="st-labpanel-vote"><span>{NAV_VOTE[nav][1]}</span><Vote id={`settings.nav.${nav}`} label={NAV_VOTE[nav][0]} section="settings" /></div>
        <div className="st-labpanel-vote"><span>« Enregistré » en haut à droite</span><Vote id="settings.save-status" label="Réglages : statut « Enregistré » en haut à droite" section="settings" /></div>
        {(PAGE_VOTES[page] || []).map(([id, label, short]) => (
          <div key={id} className="st-labpanel-vote"><span>{short}</span><Vote id={id} label={label} section="settings" /></div>
        ))}
      </section>
    </aside>
  );
  return asideEl ? createPortal(panel, asideEl) : panel;
}

// initialServer / initialSettings: what the setup just chose (the Parcours hands them over), so the
// Réglages open on the user's own server, key, model and shortcut.
export default function SettingsWindow({ standalone, initialPage = 'general', onClose, onReplaySetup, initialServer, initialSettings, ...windowProps }) {
  const lab = useLab();
  const tx = useTx();
  const { direction, reduced } = useScope();
  const nav = direction === 'aerien' ? 'push' : direction === 'mat' ? 'breadcrumb' : 'sidebar';
  const [page, setPage] = useState(PAGE[initialPage] ? initialPage : 'general');
  const [atHome, setAtHome] = useState(initialPage !== 'diagnostic'); // push nav: on the home list
  const [pushDir, setPushDir] = useState(1);
  const [sub, setSub] = useState(null); // breadcrumb nav: { page, id, title } of an open sub-page
  const [showDiag, setShowDiag] = useState(initialPage === 'diagnostic');
  const [diagLanding, setDiagLanding] = useState(null); // { filter, at } when « Voir le journal » lands
  const [s, setS] = useState(() => ({ ...DEFAULTS, ...initialSettings }));
  const [history, setHistory] = useState(SAMPLE_HISTORY);
  const [servers, setServers] = useState(() => [{ id: 's1', ...(initialServer || { url: 'llm.exemple.com', key: 'sk-demo-7f3a', noKey: false, model: '' }) }]);
  const [defaultServerId, setDefaultServerId] = useState('s1');
  const [saveState, setSaveState] = useState('saved');
  const [toast, setToast] = useState(null);
  const [query, setQuery] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const content = useRef(null);
  const saveTimer = useRef(null);
  const toastTimer = useRef(null);
  const versionClicks = useRef({ n: 0, t: 0 });

  // One live check per server, kept here so the sidebar, the card and the form share it.
  const a = servers[0];
  const b = servers[1] || { url: '', key: '', noKey: false };
  const probeA = useProbe({ url: a.url, apiKey: a.key, noKey: a.noKey });
  const probeB = useProbe({ url: b.url, apiKey: b.key, noKey: b.noKey });
  const probes = { [a.id]: probeA, ...(servers[1] ? { [servers[1].id]: probeB } : {}) };
  const defaultProbe = probes[defaultServerId] || probeA;

  // Keep a model chosen once the server has answered (the form does the same while open).
  useEffect(() => {
    [[servers[0], probeA], [servers[1], probeB]].forEach(([sv, p]) => {
      if (sv && p.status === 'ok' && p.models.length && !p.models.some(m => m.id === sv.model)) {
        setServers(list => list.map(x => (x.id === sv.id ? { ...x, model: p.models[0].id } : x)));
      }
    });
  }, [probeA.status, probeA.models, probeB.status, probeB.models]); // eslint-disable-line react-hooks/exhaustive-deps

  const markSaved = useCallback(() => {
    setSaveState('saving');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSaveState('saved'), ms(520));
  }, []);
  const set = useCallback(patch => { setS(v => ({ ...v, ...(typeof patch === 'function' ? patch(v) : patch) })); markSaved(); }, [markSaved]);
  const showToast = useCallback((text, extra) => {
    setToast({ text, id: Date.now(), ...extra });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), ms(2600));
  }, []);
  useEffect(() => () => { clearTimeout(saveTimer.current); clearTimeout(toastTimer.current); }, []);

  const go = useCallback((id, field) => {
    setPage(id);
    setSub(null);
    setAtHome(false);
    setPushDir(1);
    setQuery('');
    if (content.current) content.current.scrollTop = 0;
    setScrolled(false);
    if (field) {
      setTimeout(() => {
        const el = content.current?.querySelector(`[data-field="${field}"]`);
        if (!el) return;
        el.scrollIntoView({ block: 'center', behavior: lab.reduced ? 'auto' : 'smooth' });
        el.removeAttribute('data-flash'); void el.offsetWidth; el.setAttribute('data-flash', '');
        setTimeout(() => el.removeAttribute('data-flash'), ms(1600));
      }, ms(nav === 'push' ? 420 : 120));
    }
  }, [lab.reduced, nav]);
  const goHome = useCallback(() => { setPushDir(-1); setAtHome(true); setSub(null); setScrolled(false); }, []);
  const openSub = useCallback((pg, id, title) => { setSub({ page: pg, id, title }); setScrolled(false); if (content.current) content.current.scrollTop = 0; }, []);
  const closeSub = useCallback(() => setSub(null), []);

  const diagRef = useRef(showDiag);
  diagRef.current = showDiag;
  const toggleDiag = useCallback(() => {
    const next = !diagRef.current;
    setShowDiag(next);
    if (next) { setPage('diagnostic'); setSub(null); setAtHome(false); setPushDir(1); showToast('Diagnostic affiché', { keys: true }); }
    else { setPage(p => (p === 'diagnostic' ? 'general' : p)); showToast('Diagnostic masqué', { keys: true }); }
  }, [showToast]);
  const openLog = useCallback(() => {
    setShowDiag(true);
    setDiagLanding({ filter: 'errors', at: Date.now() });
    go('diagnostic');
  }, [go]);

  useEffect(() => { // Ctrl+Maj+M: « un truc que personne ne ferait »
    const onKey = e => {
      if (!(e.ctrlKey && e.shiftKey && !e.altKey && (e.key === 'M' || e.key === 'm' || e.code === 'KeyM'))) return;
      if (e.target?.closest?.('[data-recording]')) return;
      e.preventDefault();
      toggleDiag();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleDiag]);

  const onVersionClick = () => {
    const now = Date.now();
    const c = versionClicks.current;
    c.n = now - c.t < 700 ? c.n + 1 : 1; c.t = now;
    if (c.n >= 5) { c.n = 0; toggleDiag(); }
  };

  const reset = () => {
    setS(v => ({ ...DEFAULTS, ...Object.fromEntries(KEPT_ON_RESET.map(k => [k, v[k]])) }));
    lab.set({ theme: 'system', reduced: null });
    markSaved();
  };
  const replaySetup = () => {
    if (onReplaySetup) { onReplaySetup(); return; }
    lab.set({ section: 'parcours' });
    lab.restart();
  };

  const results = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return [];
    return SEARCH.filter(([, title, pg, words]) => fold(`${title} ${PAGE[pg].label} ${words}`).includes(q) && (pg !== 'diagnostic' || showDiag)).slice(0, 8);
  }, [query, showDiag]);

  const ctx = {
    s, set, go, openLog, showToast, reset, replaySetup, markSaved,
    servers, setServers, defaultServerId, setDefaultServerId, probes,
    history, setHistory, diagLanding, lab,
    nav, sub, openSub, closeSub,
  };
  const visible = SETTINGS_PAGES.filter(p => !p.hidden);
  const serverBadge = defaultProbe.status === 'error' ? 'error' : defaultProbe.status === 'running' ? 'running' : null;
  const current = PAGE[page];
  const onScroll = e => { const on = e.currentTarget.scrollTop > 56; if (on !== scrolled) setScrolled(on); };

  const searchBox = (
    <div className="st-search">
      <Search {...ICON} size={15} aria-hidden="true" />
      <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher un réglage" aria-label="Rechercher un réglage"
        onKeyDown={e => { if (e.key === 'Enter' && results[0]) go(results[0][2], results[0][0]); if (e.key === 'Escape') setQuery(''); }} />
      {query && <button type="button" className="st-search-clear" aria-label="Effacer la recherche" onClick={() => setQuery('')}><X size={14} strokeWidth={1.75} /></button>}
    </div>
  );
  const resultList = (
    <div className="st-results" role="list" aria-label="Résultats">
      {results.length ? results.map(([field, title, pg], i) => {
        const P = PAGE[pg];
        return (
          <motion.button role="listitem" type="button" key={`${field}-${title}`} className="st-result" onClick={() => go(pg, field)}
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={tx('smooth', { delay: i * 0.02 })}>
            <strong>{title}</strong><small>{P.label}</small>
          </motion.button>
        );
      }) : <p className="st-results-empty">Aucun réglage ne correspond.</p>}
    </div>
  );
  const serverAside = serverBadge ? <span className="st-tab-badge"><StatusDot state={serverBadge} /><span className="st-sr">{serverBadge === 'error' ? 'Connexion en échec' : 'Vérification en cours'}</span></span> : null;

  // Title of a page: a breadcrumb while a sub-page is open (Mat).
  const inSub = P => !!(sub && sub.page === P.id);
  const titleOf = P => (inSub(P)
    ? <span className="st-crumbs"><button type="button" className="st-crumb" onClick={closeSub}>{P.label}</button><ChevronRight className="st-crumb-sep" size={22} strokeWidth={1.5} aria-hidden="true" /><span className="st-crumb-here">{sub.title}</span></span>
    : P.label);
  const pageBody = P => (
    <motion.div key={`${P.id}-${inSub(P) ? sub.id : ''}`} className="st-page" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={tx('smooth')}>
      <PageHeader title={titleOf(P)} description={inSub(P) ? null : P.description} aside={<SaveStatus state={saveState} />} />
      <P.Page />
    </motion.div>
  );

  const toastHost = (
    <div className="st-toast-host">
      <AnimatePresence>
        {toast && (
          <motion.div key={toast.id} className="st-toast" role="status" initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6 }} transition={tx('smooth')}>
            <span>{toast.text}</span>
            {toast.keys && <span className="st-toast-keys"><Keycap size="sm">Ctrl</Keycap><Keycap size="sm">Maj</Keycap><Keycap size="sm">M</Keycap></span>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  // ——— Verre and Mat: a sidebar (Radix Tabs) ———
  const sidebarLayout = (
    <Tabs value={page} onValueChange={id => go(id)}>
      <div className="ft-settings" data-nav={nav}>
        <aside className="ft-settings-sidebar">
          <div className="ft-settings-app"><AppMark size={24} /><span><strong>{appName}</strong><small>Réglages</small></span></div>
          {searchBox}
          <div className="st-nav">
            {query.trim() ? resultList : (
              <TabList label="Pages des réglages">
                {visible.map(p => (
                  <Tab key={p.id} value={p.id} icon={<p.icon {...ICON} />} tile={p.tile} badge={p.id === 'serveur' ? serverAside : null}>{p.label}</Tab>
                ))}
                <AnimatePresence initial={false}>
                  {showDiag && (
                    <motion.div key="diag" className="st-diag-tab" initial={{ opacity: 0, y: -6, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.98 }} transition={tx('bouncy')}>
                      <span className="st-nav-sep" aria-hidden="true" />
                      <Tab value="diagnostic" icon={<Activity {...ICON} />} tile={8}>Diagnostic</Tab>
                    </motion.div>
                  )}
                </AnimatePresence>
              </TabList>
            )}
          </div>
          <div className="ft-settings-foot"><span onClick={onVersionClick}>Version 0.5.1</span></div>
        </aside>

        <div className="ft-settings-content" ref={content} onScroll={onScroll}>
          <div className="st-topbar" data-show={scrolled ? '' : undefined} aria-hidden="true"><span>{sub ? `${current?.label} › ${sub.title}` : current?.label}</span></div>
          {SETTINGS_PAGES.filter(p => !p.hidden || showDiag).map(P => (
            <TabPanel key={P.id} value={P.id} className="ft-settings-page">{pageBody(P)}</TabPanel>
          ))}
        </div>
        {toastHost}
      </div>
    </Tabs>
  );

  // ——— Aérien: a home list, each row pushes its page ———
  const groups = [
    ['general', 'raccourcis', 'actions', 'apres'],
    ['apparence'],
    ['serveur', 'donnees'],
    ...(showDiag ? [['diagnostic']] : []),
  ];
  const defaultServer = servers.find(x => x.id === defaultServerId) || a;
  const serverLine = { ok: `Connecté à ${hostOf(defaultServer.url)}`, error: 'Connexion en échec', running: 'Vérification…' }[defaultProbe.status] || (defaultServer.url ? 'Non vérifié' : 'Aucun serveur');
  const serverDot = { ok: 'ok', error: 'error', running: 'running' }[defaultProbe.status] || 'idle';
  const push = reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: tx({ duration: 0.16, ease: 'out' }) }
    : {
      custom: pushDir,
      variants: {
        enter: d => ({ x: d > 0 ? 64 : -40, opacity: 0 }),
        center: { x: 0, opacity: 1 },
        exit: d => ({ x: d > 0 ? -40 : 64, opacity: 0, transition: tx({ duration: 0.2, ease: 'out' }) }),
      },
      initial: 'enter', animate: 'center', exit: 'exit', transition: tx('smooth'),
    };
  const pushLayout = (
    <div className="ft-settings" data-nav="push">
      <AnimatePresence initial={false} custom={pushDir}>
        {atHome ? (
          <motion.div key="home" className="st-push-view" {...push}>
            <div className="st-push-scroll" ref={content}>
              <div className="st-home">
                <h1 className="st-home-title">Réglages</h1>
                {searchBox}
                {query.trim() ? resultList : (
                  <>
                    <button type="button" className="st-home-card" onClick={() => go('serveur')}>
                      <AppMark size={52} />
                      <span className="st-home-card-text"><strong>{appName}</strong><small><StatusDot state={serverDot}>{serverLine}</StatusDot></small></span>
                      <ChevronRight className="st-home-chev" size={18} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                    {groups.map(g => (
                      <motion.div key={g.join()} className="st-home-group" role="list" initial={g[0] === 'diagnostic' ? { opacity: 0, y: -6 } : false} animate={{ opacity: 1, y: 0 }} transition={tx('smooth')}>
                        {g.map(id => {
                          const P = PAGE[id];
                          return (
                            <button key={id} type="button" role="listitem" className="st-home-row" onClick={() => go(id)}>
                              <span className="st-home-icon" style={{ '--tile': `var(--ft-tile-${P.tile})`, '--on-tile': `var(--ft-on-tile-${P.tile})` }} aria-hidden="true"><P.icon size={18} strokeWidth={1.9} /></span>
                              <span className="st-home-label">{P.label}</span>
                              {id === 'serveur' && <span className="st-home-aside">{serverAside || hostOf(defaultServer.url)}</span>}
                              <ChevronRight className="st-home-chev" size={16} strokeWidth={1.75} aria-hidden="true" />
                            </button>
                          );
                        })}
                      </motion.div>
                    ))}
                  </>
                )}
                <p className="st-home-foot"><span onClick={onVersionClick}>Version 0.5.1</span></p>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key={`page-${page}`} className="st-push-view" {...push}>
            <div className="st-push-bar">
              <button type="button" className="st-back" onClick={goHome}><ChevronLeft size={20} strokeWidth={1.75} aria-hidden="true" /><span>Réglages</span></button>
              <span className="st-push-title" data-show={scrolled ? '' : undefined} aria-hidden="true">{current?.label}</span>
            </div>
            <div className="st-push-scroll" ref={content} onScroll={onScroll}>
              <div className="st-push-page">
                <div className="st-page">
                  <PageHeader title={current?.label} description={current?.description} aside={<SaveStatus state={saveState} />} />
                  {current && <current.Page />}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {toastHost}
    </div>
  );

  // Escape (or Alt+←) goes back one level in the push and breadcrumb structures.
  const onKeyDown = e => {
    if (e.defaultPrevented || e.target?.closest?.('input, textarea, [role="combobox"], [data-recording]')) return;
    if (!(e.key === 'Escape' || (e.altKey && e.key === 'ArrowLeft'))) return;
    if (nav === 'push' && !atHome) { e.preventDefault(); goHome(); }
    else if (nav === 'breadcrumb' && sub) { e.preventDefault(); closeSub(); }
  };

  return (
    <>
      <AppWindow title={`Réglages ${appName}`} width={860} height={600} onClose={onClose} showTitle={false} onKeyDown={onKeyDown} {...windowProps}>
        <SettingsContext.Provider value={ctx}>
          {nav === 'push' ? pushLayout : sidebarLayout}
        </SettingsContext.Provider>
      </AppWindow>
      {standalone && <LabPanel page={nav === 'push' && atHome ? null : current?.id} diagShown={showDiag} onReveal={toggleDiag} nav={nav} />}
    </>
  );
}

function hostOf(url) {
  const t = String(url || '').trim();
  return t.replace(/^https?:\/\//, '').replace(/\/.*$/, '') || 'Aucun serveur';
}
