// Réglages — the Settings window of the lab (owner: agent Réglages).
// Fixed export: default SettingsWindow({ standalone, initialPage, onClose, onReplaySetup, initialServer, initialSettings, …AppWindow props })
//   renders ONE <AppWindow> (860 × 600) on the current <Stage>. Used by the section « Réglages »
//   (standalone: + a lab panel to the left of the window) and by the Parcours at the end of the setup.
//
// One structure (Lucas, 30/09, the « Verre » one): a fixed, sober sidebar with search, simple
// icons in the colour of their page, one selection pill that GLIDES to the clicked page (never
// follows the mouse); each page has its colour (icon, pill, faint veil at the top), grouped rows in
// cards on a MATTE window (no blur, no sheen). One scroll area, with the lab's thin scrollbar.
// The Diagnostic page
// is hidden: Ctrl+Maj+M (or 5 clicks on the version) shows its entry and opens it; « Voir le
// journal » on the Serveur page lands there, filtered on errors.
// Theme and Animations are wired to the lab bar, so the window restyles live when you change them.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Settings2, Keyboard, Sparkles, Undo2, Palette, Server, Lock, Activity, Search, X, Check } from 'lucide-react';
import { AppWindow } from '../stage/AppWindow.jsx';
import { createPortal } from 'react-dom';
import { AppMark, useDesktop } from '../stage/Desktop.jsx';
import { Tabs, TabList, Tab, TabPanel, PageHeader, StatusDot, Keycap, ScrollArea, ICON } from '../ui/index.jsx';
import { useProbe } from '../connection/Connection.jsx';
import { Vote } from '../lab/Vote.jsx';
import { useLab } from '../lab/store.jsx';
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
  { id: 'general', label: 'Général', icon: Settings2, description: 'Démarrage, langue et accueil.', Page: GeneralPage },
  { id: 'raccourcis', label: 'Raccourcis', icon: Keyboard, description: 'Les touches qui ouvrent le menu ou lancent une action.', Page: ShortcutsPage },
  { id: 'actions', label: 'Actions', icon: Sparkles, description: 'Ce que propose le menu, dans quel ordre, avec quelle consigne.', Page: ActionsPage },
  { id: 'apres', label: 'Après remplacement', icon: Undo2, description: 'Ce qui s’affiche quand le texte vient d’être remplacé.', Page: AfterPage },
  { id: 'apparence', label: 'Apparence', icon: Palette, description: 'Thème, indicateur et mouvements.', Page: AppearancePage },
  { id: 'serveur', label: 'Serveur', icon: Server, description: `Où ${appName} envoie le texte.`, Page: ServerPage },
  { id: 'donnees', label: 'Données', icon: Lock, description: 'Ce qui reste sur cet appareil, et rien d’autre.', Page: DataPage },
  { id: 'diagnostic', label: 'Diagnostic', icon: Activity, hidden: true, description: 'Ce qui s’est passé à chaque connexion, et en combien de temps. Ni texte ni clé complète.', Page: DiagnosticPage },
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
  ['changedWords', 'Mettre en valeur les mots changés', 'apres', 'surlignage mise en valeur lumineux mots modifiés'],
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
  apres: [['settings.apres.mots-lumineux', 'Réglages › Après remplacement : mots changés = le texte lui-même lumineux (irisé doux), sans case par-dessus', 'Mots changés : texte lumineux, sans case'], ['settings.page.apres', 'Réglages › Après remplacement : aperçu vivant de la pilule et des mots changés', 'Aperçu de la pilule']],
  apparence: [['settings.apparence.mini-ilot', 'Réglages › Apparence : Fluide / Rebondi montrés par une vraie mini-Îlot qui s’ouvre (survol ou clic)', 'Fluide / Rebondi : mini-Îlot'], ['settings.page.apparence.cards', 'Réglages › Apparence : choix en vignettes (thème, indicateur, mouvement)', 'Choix en vignettes']],
  serveur: [['settings.serveur.trace-repliee', 'Réglages › Serveur : trace « balayage » pendant la vérification, puis repliée en « ● Connecté · modèle · ms  Détails ▾ » ; ouverte sur l’étape fautive en cas d’erreur', 'Trace repliée en une ligne'], ['settings.serveur.http', 'Réglages › Serveur : http:// accepté pour tout hôte, avec « Connexion non chiffrée »', 'http:// avec avertissement'], ['settings.page.serveur.card', 'Réglages › Serveur : une carte par serveur, « Modifier » déplie la connexion', 'Carte serveur, « Modifier » la déplie']],
  donnees: [['settings.page.donnees', 'Réglages › Données : historique en liste avec suppression une à une', 'Historique, suppression une à une']],
  diagnostic: [['settings.diagnostic.console', 'Réglages › Diagnostic : journal en console monochrome, lignes dépliables, filtre Tout / Erreurs', 'Console monochrome'], ['settings.diagnostic.reveal', 'Diagnostic caché, révélé par Ctrl+Maj+M : l’entrée apparaît en place, la surbrillance y glisse', 'Apparition en place (Ctrl+Maj+M)']],
};
function LabPanel({ page, onReveal, diagShown }) {
  // On a phone the stage has no room beside the window: the panel stacks below it.
  const { asideEl } = useDesktop();
  const panel = (
    <aside className="st-labpanel" aria-label="Labo : avis sur les Réglages">
      <section>
        <h4>Essayez</h4>
        <p><span className="st-labpanel-keys"><Keycap size="sm">Ctrl</Keycap><Keycap size="sm">Maj</Keycap><Keycap size="sm">M</Keycap></span> affiche le Diagnostic caché.</p>
        <button type="button" className="st-labpanel-link" onClick={onReveal}>{diagShown ? 'Masquer le Diagnostic' : 'Afficher le Diagnostic'}</button>
        <p>Une couleur par page : icône, surbrillance qui glisse, voile en haut. Jeux A et B dans la barre du labo.</p>
        <p>Serveur : changez le « Serveur simulé » de la barre pendant une vérification.</p>
      </section>
      <section>
        <h4>Votre avis</h4>
        <p className="st-labpanel-page">{PAGE[page]?.label}</p>
        {(PAGE_VOTES[page] || []).map(([id, label, short]) => (
          <div key={id} className="st-labpanel-vote"><span>{short}</span><Vote id={id} label={label} section="settings" /></div>
        ))}
        <div className="st-labpanel-vote"><span>Surbrillance qui glisse au clic</span><Vote id="settings.nav.glisse" label="Réglages : la surbrillance de la barre latérale glisse jusqu’à la page cliquée (ne suit pas la souris)" section="settings" /></div>
        <div className="st-labpanel-vote"><span>Barre de défilement fine</span><Vote id="settings.scrollbar" label="Réglages : barre de défilement fine, sans flèches, qui apparaît au défilement" section="settings" /></div>
        <div className="st-labpanel-vote"><span>« Enregistré » en haut à droite</span><Vote id="settings.save-status" label="Réglages : statut « Enregistré » en haut à droite" section="settings" /></div>
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
  const [page, setPage] = useState(PAGE[initialPage] ? initialPage : 'general');
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
  const flashTimer = useRef(null);
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
  useEffect(() => () => { clearTimeout(saveTimer.current); clearTimeout(toastTimer.current); clearTimeout(flashTimer.current); }, []);

  const go = useCallback((id, field) => {
    setPage(id);
    setQuery('');
    if (content.current) content.current.scrollTop = 0;
    setScrolled(false);
    clearTimeout(flashTimer.current);
    if (field) {
      flashTimer.current = setTimeout(() => {
        const el = content.current?.querySelector(`[data-field="${field}"]`);
        if (!el) return;
        el.scrollIntoView({ block: 'center', behavior: lab.reduced ? 'auto' : 'smooth' });
        el.removeAttribute('data-flash'); void el.offsetWidth; el.setAttribute('data-flash', '');
        flashTimer.current = setTimeout(() => el.removeAttribute('data-flash'), ms(1600));
      }, ms(120));
    }
  }, [lab.reduced]);

  const diagRef = useRef(showDiag);
  diagRef.current = showDiag;
  const toggleDiag = useCallback(() => {
    const next = !diagRef.current;
    diagRef.current = next; // a second Ctrl+Maj+M before the render still toggles back
    setShowDiag(next);
    if (next) { go('diagnostic'); showToast('Diagnostic affiché', { keys: true }); }
    else { setPage(p => (p === 'diagnostic' ? 'general' : p)); showToast('Diagnostic masqué', { keys: true }); }
  }, [go, showToast]);
  const openLog = useCallback(() => {
    diagRef.current = true;
    setShowDiag(true);
    setDiagLanding({ filter: 'errors', at: Date.now() });
    go('diagnostic');
  }, [go]);

  useEffect(() => { // Ctrl+Maj+M: « un truc que personne ne ferait »
    const onKey = e => {
      if (!(e.ctrlKey && e.shiftKey && !e.altKey && (e.key === 'M' || e.key === 'm' || e.code === 'KeyM'))) return;
      if (e.repeat || e.target?.closest?.('[data-recording]')) return;
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
  };
  const visible = SETTINGS_PAGES.filter(p => !p.hidden);
  const serverBadge = defaultProbe.status === 'error' ? 'error' : defaultProbe.status === 'running' ? 'running' : null;
  const current = PAGE[page];
  const onScroll = e => { const on = e.currentTarget.scrollTop > 56; if (on !== scrolled) setScrolled(on); };

  const serverAside = serverBadge ? <span className="st-tab-badge"><StatusDot state={serverBadge} /><span className="st-sr">{serverBadge === 'error' ? 'Connexion en échec' : 'Vérification en cours'}</span></span> : null;

  return (
    <>
      <AppWindow title={`Réglages ${appName}`} width={860} height={600} onClose={onClose} showTitle={false} {...windowProps}>
        <SettingsContext.Provider value={ctx}>
          <Tabs value={page} onValueChange={id => go(id)}>
            <div className="ft-settings">
              <aside className="ft-settings-sidebar">
                <div className="ft-settings-app"><AppMark size={24} /><span><strong>{appName}</strong><small>Réglages</small></span></div>
                <div className="st-search">
                  <Search {...ICON} size={15} aria-hidden="true" />
                  <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher un réglage" aria-label="Rechercher un réglage"
                    onKeyDown={e => { if (e.key === 'Enter' && results[0]) go(results[0][2], results[0][0]); if (e.key === 'Escape') setQuery(''); }} />
                  {query && <button type="button" className="st-search-clear" aria-label="Effacer la recherche" onClick={() => setQuery('')}><X size={12} strokeWidth={2} /></button>}
                </div>
                <div className="st-nav">
                  {query.trim() ? (
                    <div className="st-results" role="list" aria-label="Résultats">
                      {results.length ? results.map(([field, title, pg], i) => (
                        <motion.button role="listitem" type="button" key={`${field}-${title}`} className="st-result" data-ft-page={pg} onClick={() => go(pg, field)}
                          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={tx('smooth', { delay: i * 0.02 })}>
                          <strong>{title}</strong><small>{PAGE[pg].label}</small>
                        </motion.button>
                      )) : <p className="st-results-empty">Aucun réglage ne correspond.</p>}
                    </div>
                  ) : (
                    <TabList label="Pages des réglages">
                      {visible.map(p => (
                        <Tab key={p.id} value={p.id} icon={<p.icon {...ICON} />} badge={p.id === 'serveur' ? serverAside : null}>{p.label}</Tab>
                      ))}
                      <AnimatePresence initial={false}>
                        {showDiag && (
                          // « Apparition en place »: the entry fades and grows where it will stay, no slide.
                          <motion.div key="diag" className="st-diag-tab" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96, transition: tx({ duration: 0.16, ease: 'out' }) }} transition={tx('smooth')}>
                            <span className="st-nav-sep" aria-hidden="true" />
                            <Tab value="diagnostic" icon={<Activity {...ICON} />}>Diagnostic</Tab>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </TabList>
                  )}
                </div>
                <div className="ft-settings-foot"><span onClick={onVersionClick}>Version 0.5.1</span></div>
              </aside>

              <div className="ft-settings-main" data-ft-page={page}>
                <span className="ft-page-veil" aria-hidden="true" />
                <ScrollArea className="ft-settings-content" viewportRef={content} onScroll={onScroll} shadows="bottom">
                  <div className="st-topbar" data-show={scrolled ? '' : undefined} aria-hidden="true"><span>{current?.label}</span></div>
                  {SETTINGS_PAGES.filter(p => !p.hidden || showDiag).map(P => (
                    <TabPanel key={P.id} value={P.id} className="ft-settings-page">
                      <motion.div className="st-page" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={tx('smooth')}>
                        <PageHeader title={P.label} description={P.description} aside={P.id === 'diagnostic' ? null : <SaveStatus state={saveState} />} />
                        <P.Page />
                      </motion.div>
                    </TabPanel>
                  ))}
                </ScrollArea>
              </div>
              <div className="st-toast-host">
                <AnimatePresence>
                  {toast && (
                    // One toast: a new message replaces the text in place (never a stack of toasts
                    // fading on top of each other when Ctrl+Maj+M is pressed several times).
                    <motion.div key="toast" className="st-toast ft-glass" role="status" initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6 }} transition={tx('smooth')}>
                      <motion.span key={toast.text} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={tx(0.14)}>{toast.text}</motion.span>
                      {toast.keys && <span className="st-toast-keys"><Keycap size="sm">Ctrl</Keycap><Keycap size="sm">Maj</Keycap><Keycap size="sm">M</Keycap></span>}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </Tabs>
        </SettingsContext.Provider>
      </AppWindow>
      {standalone && <LabPanel page={current?.id} diagShown={showDiag} onReveal={toggleDiag} />}
    </>
  );
}
