import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type UIEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Activity, Check, Keyboard, Lock, Palette, RotateCw, Search, Server, Settings2, Sparkles, Undo2, X } from 'lucide-react';
import { appName } from '../brand';
import { bridge } from '../bridge';
import { useT } from '../i18n';
import { AppMark } from '../components/AppMark';
import { TitleBar } from '../components/TitleBar';
import { Button, ICON, Keycap, Notice, PageHeader, StatusDot } from '../components/controls';
import { useReduced, useTx } from '../components/motion';
import { Tab, TabList, TabPanel, Tabs } from '../components/nav';
import { ScrollArea } from '../components/scroll';
import { useProbe } from '../connection/Check';
import { DiagnosticsPanel, type DiagnosticsLanding } from '../connection/DiagnosticsPanel';
import type { ProbeProblem, SettingsFocus } from '../types';
import { fieldFromLocation, pageOfField, resolveField, revealField, serverOfField } from './fields';
import { describeRefusal } from './messages';
import { clickRun, isDiagnosticsChord, loadDiagnosticsShown, pageAbout, pageFromLocation, pageOr, pageTitle, saveDiagnosticsShown, visiblePages, type ClickRun, type PageId } from './nav';
import { useRegistrations } from './registrations';
import { queryMaxLength, searchSettings } from './search';
import { SettingsContext, useSettingsContext, useSettingsStore, type SaveProblem, type SaveStatus, type SettingsContextValue, type ToastExtra } from './useSettingsStore';
import { ActionsPage } from './pages/Actions';
import { AfterPage } from './pages/After';
import { AppearancePage } from './pages/Appearance';
import { DataPage } from './pages/Data';
import { GeneralPage } from './pages/General';
import { ServerPage } from './pages/Server';
import { ShortcutsPage } from './pages/Shortcuts';
import './settings.css';

/*
 * The Settings window of 0.6 (design-lab/reglages/src/settings/SettingsWindow.jsx, Lucas's
 * choices): a matte window, a fixed and sober sidebar with a search, one page per topic, simple
 * icons in the colour of their page, ONE selection pill that glides to the clicked page (it never
 * follows the mouse); each page has its colour (icon, pill, a faint veil at the top), grouped rows
 * in cards, one scroll area with the thin scrollbar. The Diagnostic page is hidden: Ctrl+Shift+M
 * (or five clicks on the version) shows its entry and opens it; « Voir le journal » on the Server
 * page lands there, filtered on errors.
 *
 * Saving is the store's (src/settings/useSettingsStore.ts, the logic of 0.5): every change is
 * saved, a refused one is said and can be retried, and nothing here can stay stuck: Escape and
 * the cross close the window (a second time when the last change could not be saved).
 */

const pageIcons: Record<PageId, ComponentType<{ size?: number; strokeWidth?: number }>> = {
  general: Settings2, shortcuts: Keyboard, actions: Sparkles, after: Undo2, appearance: Palette, server: Server, data: Lock, diagnostic: Activity,
};

function DiagnosticPage() {
  const { probes, settings, landing } = useSettingsContext();
  const probe = probes[settings.defaultServerId] ?? Object.values(probes)[0];
  return <DiagnosticsPanel landing={landing} onCheck={probe?.ready && probe.status !== 'running' ? probe.start : undefined} />;
}

const pageViews: Record<PageId, ComponentType> = {
  general: GeneralPage, shortcuts: ShortcutsPage, actions: ActionsPage, after: AfterPage, appearance: AppearancePage, server: ServerPage, data: DataPage, diagnostic: DiagnosticPage,
};

function SaveState({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  const t = useT();
  const tx = useTx();
  return <span className="st-save" aria-live="polite" data-status={status}>
    <AnimatePresence mode="wait" initial={false}>
      {status === 'error'
        ? <motion.span key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={tx(0.12)}><Button size="sm" variant="danger" icon={<RotateCw {...ICON} size={14} />} onClick={onRetry}>{t('settings.saveRetry')}</Button></motion.span>
        : status === 'saving'
          ? <motion.span key="saving" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={tx(0.12)}><StatusDot state="running">{t('settings.saving')}</StatusDot></motion.span>
          : <motion.span key="saved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={tx(0.16)} className="st-save-ok"><Check size={14} strokeWidth={2} aria-hidden="true" />{t('settings.saved')}</motion.span>}
    </AnimatePresence>
  </span>;
}

// Whether the window is on screen. It is created hidden when the app starts and stays alive
// (closing it hides it): nothing is checked on the network while nobody looks at it. A hidden
// window can be focused (Windows hands it the foreground at launch), so a focus only counts once
// the window is really on screen; a click in it always does. And it goes back to false when the
// window leaves (0.6 review: once opened, it kept checking for ever, and every change the setup
// made was probed by both windows, each line of the journal twice).
function useOpened(): boolean {
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    let live = true;
    let retry = 0;
    const open = () => setOpened(true);
    const check = () => { void bridge.windowShown().then(shown => { if (live) setOpened(shown); }); };
    // Shown and focused arrive in either order: asked at once, and once more a moment later.
    const focused = () => { check(); window.clearTimeout(retry); retry = window.setTimeout(check, 400); };
    // Hidden (its cross, Escape, Alt+F4), or behind another window: asked again.
    const left = () => { if (document.hidden) setOpened(false); else focused(); };
    window.addEventListener('focus', focused);
    window.addEventListener('blur', focused);
    window.addEventListener('pointerdown', open);
    document.addEventListener('visibilitychange', left);
    if (document.hasFocus()) focused();
    return () => { live = false; window.clearTimeout(retry); window.removeEventListener('focus', focused); window.removeEventListener('blur', focused); window.removeEventListener('pointerdown', open); document.removeEventListener('visibilitychange', left); };
  }, []);
  return opened;
}
const staleCheckMs = 60_000;
const toastMs = 2600;
const flashMs = 1600;
const emptyConnection = { endpoint: '', apiKey: '', noKey: false };

// initialPage: the page to open on when the URL names none (the lab's fixtures).
export function SettingsWindow({ initialPage = 'general' }: { initialPage?: PageId } = {}) {
  const t = useT();
  const tx = useTx();
  const reduced = useReduced();
  const store = useSettingsStore();
  const { settings } = store;
  const registrations = useRegistrations();
  // Closed by its own cross or Escape: the page is told nothing by Windows, so it notes it itself.
  const [hiddenAt, setHiddenAt] = useState(0);
  const openedNow = useOpened();
  const [seenAt, setSeenAt] = useState(0);
  useEffect(() => { if (openedNow) setSeenAt(Date.now()); }, [openedNow]);
  const opened = openedNow && seenAt >= hiddenAt;
  const [page, setPage] = useState<PageId>(() => pageFromLocation(location.search) ?? initialPage);
  const [showDiag, setShowDiag] = useState(() => loadDiagnosticsShown() || pageFromLocation(location.search) === 'diagnostic');
  const [landing, setLanding] = useState<DiagnosticsLanding | null>(null);
  const [toast, setToast] = useState<{ text: string; keys?: boolean } | null>(null);
  const [query, setQuery] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const [expanded, setExpandedSet] = useState<ReadonlySet<string>>(() => new Set());
  // A direct link to a field (lot 10): asked by the URL at opening, or by an event later.
  const [fieldRequest, setFieldRequest] = useState<{ field: string } | null>(() => { const field = fieldFromLocation(location.search); return field ? { field } : null; });
  const content = useRef<HTMLDivElement>(null);
  const toastTimer = useRef(0);
  const flashTimer = useRef(0);
  const revealTimer = useRef(0);
  const clearHighlight = useRef<(() => void) | null>(null);
  const versionClicks = useRef<ClickRun>({ count: 0, at: 0 });
  const closeRefused = useRef(false);

  // One live check per server shown, kept here so the sidebar, the card and the form share it.
  const [addressDrafts, setAddressDrafts] = useState<Readonly<Record<string, string>>>({});
  const setAddressDraft = useCallback((id: string, typed: string | null) => setAddressDrafts(previous => {
    if (typed !== null) return previous[id] === typed ? previous : { ...previous, [id]: typed };
    if (!(id in previous)) return previous;
    const { [id]: _gone, ...rest } = previous;
    return rest;
  }), []);
  const typed = (index: number) => { const server = settings?.servers[index]; return server ? { ...server, endpoint: addressDrafts[server.id] ?? server.endpoint } : emptyConnection; };
  const first = typed(0);
  const second = typed(1);
  const probeA = useProbe({ endpoint: first.endpoint, apiKey: first.apiKey, noKey: first.noKey, auto: opened && settings !== null });
  const probeB = useProbe({ endpoint: second.endpoint, apiKey: second.apiKey, noKey: second.noKey, auto: opened && settings !== null && settings.servers.length > 1 });
  const probes = useMemo(() => {
    const map: SettingsContextValue['probes'] = {};
    if (settings?.servers[0]) map[settings.servers[0].id] = probeA;
    if (settings?.servers[1]) map[settings.servers[1].id] = probeB;
    return map;
  }, [settings?.servers[0]?.id, settings?.servers[1]?.id, probeA, probeB]); // eslint-disable-line react-hooks/exhaustive-deps
  // A server that answered and has no model yet takes the first of its list, card folded or not
  // (the form does the same while open). A model already chosen is never replaced.
  // Read from the store, not from the last render: a server added a moment ago (its render still
  // to come) must not be written away by this save.
  useEffect(() => {
    const now = store.current();
    if (!now) return;
    let next = now;
    for (const server of now.servers.slice(0, 2)) {
      const probe = probes[server.id];
      // Only a server with an address of its own: a card just added never inherits a model.
      if (probe?.status === 'ok' && probe.models.length && !server.model.trim() && server.endpoint.trim()) next = { ...next, servers: next.servers.map(item => item.id === server.id ? { ...item, model: probe.models[0].id } : item) };
    }
    if (next !== now) store.persist(next, true);
  }, [probeA.status, probeA.models, probeB.status, probeB.models]); // eslint-disable-line react-hooks/exhaustive-deps
  // Back in front after a while: what the cards say is checked again (never while one runs).
  const probesRef = useRef(probes);
  probesRef.current = probes;
  useEffect(() => {
    // Only a window really on screen checks: a hidden one can be handed the focus too.
    const refresh = () => { void bridge.windowShown().then(shown => { if (!shown) return; for (const probe of Object.values(probesRef.current)) if (probe.ready && probe.status !== 'running' && Date.now() - probe.at > staleCheckMs) probe.start(); }); };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  useEffect(() => { void bridge.setSettingsTitle(t('settings.windowTitle')).catch(() => undefined); }, [t]);
  useEffect(() => () => { window.clearTimeout(toastTimer.current); window.clearTimeout(flashTimer.current); window.clearTimeout(revealTimer.current); clearHighlight.current?.(); }, []);

  const pages = useMemo(() => visiblePages(settings ?? { uiVersion: 'ilot' }, showDiag), [settings?.uiVersion, showDiag]); // eslint-disable-line react-hooks/exhaustive-deps
  const current = pageOr(page, pages);
  const showToast = useCallback((text: string, extra?: ToastExtra) => {
    setToast({ text, ...extra });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), toastMs);
  }, []);
  const go = useCallback((id: PageId, field?: string) => {
    setPage(id);
    setQuery('');
    if (content.current) content.current.scrollTop = 0;
    setScrolled(false);
    window.clearTimeout(flashTimer.current);
    if (!field) return;
    // The found row glows once, when its page is there.
    flashTimer.current = window.setTimeout(() => {
      const row = content.current?.querySelector<HTMLElement>(`[data-field="${CSS.escape(field)}"]`);
      if (!row) return;
      row.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
      row.removeAttribute('data-flash'); void row.offsetWidth; row.setAttribute('data-flash', '');
      flashTimer.current = window.setTimeout(() => row.removeAttribute('data-flash'), flashMs);
    }, 120);
  }, [reduced]);

  const diagRef = useRef(showDiag);
  diagRef.current = showDiag;
  const toggleDiag = useCallback(() => {
    const next = !diagRef.current;
    diagRef.current = next; // a second Ctrl+Shift+M before the render still toggles back
    setShowDiag(next);
    saveDiagnosticsShown(next);
    if (next) go('diagnostic'); else setPage(value => value === 'diagnostic' ? 'general' : value);
    showToast(t(next ? 'nav.diagShown' : 'nav.diagHidden'), { keys: true });
  }, [go, showToast, t]);
  const openLog = useCallback((problem: ProbeProblem | null, run: string | null) => {
    diagRef.current = true;
    setShowDiag(true);
    saveDiagnosticsShown(true);
    setLanding({ filter: 'errors', logId: problem?.logId, run, at: Date.now() });
    go('diagnostic');
  }, [go]);
  const setExpanded = useCallback((id: string, open: boolean) => setExpandedSet(previous => {
    if (previous.has(id) === open) return previous;
    const next = new Set(previous);
    if (open) next.add(id); else next.delete(id);
    return next;
  }), []);

  // Closing: what still waits is saved first. A refused save keeps the window open once, saying
  // why; closing again leaves without it (the window can never hold its user hostage).
  const closing = useRef(false);
  const closeSettings = useCallback(async () => {
    if (closing.current) return;
    closing.current = true;
    try {
      const saved = await store.flush();
      if (!saved && !closeRefused.current) { closeRefused.current = true; showToast(t('nav.closeAnyway')); return; }
      closeRefused.current = false;
      await bridge.closeSettings();
      // Hidden now: its checks stop (asked rather than assumed: the preview has no window to hide).
      void bridge.windowShown().then(shown => { if (!shown) setHiddenAt(Date.now()); });
    } finally { closing.current = false; }
  }, [store.flush, showToast, t]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (store.saveStatus !== 'error') closeRefused.current = false; }, [store.saveStatus]);

  // The window's own keys: Ctrl+Shift+M (Diagnostic), Escape (close). Both stand aside while a
  // shortcut is being recorded, and Escape first belongs to whatever is open above the page (a
  // list, a dialog, an inline confirmation: they prevent the default).
  const closeRef = useRef(closeSettings);
  closeRef.current = closeSettings;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('[data-recording]')) return;
      if (isDiagnosticsChord(event)) { event.preventDefault(); toggleDiag(); return; }
      if (event.key !== 'Escape' || event.defaultPrevented || event.repeat) return;
      if (document.querySelector('[data-radix-popper-content-wrapper], .ft-dialog')) return;
      event.preventDefault();
      void closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleDiag]);

  // Links from elsewhere (an error pill, the tray): a page, a field, or both.
  useEffect(() => {
    let live = true;
    let off: (() => void) | undefined;
    void bridge.on<SettingsFocus>('settings-focus-field', ({ field, page: asked }) => {
      if (field) setFieldRequest({ field });
      else if (asked) { if (asked === 'diagnostic') { diagRef.current = true; setShowDiag(true); } go(asked); }
    }).then(unlisten => { if (live) off = unlisten; else unlisten(); }, () => undefined);
    return () => { live = false; off?.(); };
  }, [go]);
  // A field link: open its page, unfold its server, then scroll to the field, focus it and make
  // it pulse. An unknown field is ignored.
  useEffect(() => {
    if (!fieldRequest || !settings) return;
    const id = resolveField(fieldRequest.field, settings.servers, settings.defaultServerId);
    if (!id) { setFieldRequest(null); return; }
    const target = pageOfField(id);
    if (current !== target) { setQuery(''); setPage(target); return; }
    const server = serverOfField(id);
    if (server && !expanded.has(server)) { setExpanded(server, true); return; }
    setFieldRequest(null);
    window.clearTimeout(revealTimer.current);
    revealTimer.current = window.setTimeout(() => {
      clearHighlight.current?.();
      clearHighlight.current = revealField(document, id, reduced);
    }, 60);
  }, [fieldRequest, settings, current, expanded, reduced, setExpanded]);

  const results = useMemo(() => searchSettings(query, t, pages), [query, t, pages]);
  const onVersionClick = () => {
    const { run, fired } = clickRun(versionClicks.current, Date.now());
    versionClicks.current = run;
    if (fired) toggleDiag();
  };
  const drag = () => { if (bridge.native) void bridge.dragSettings().catch(() => undefined); };
  const chrome = <TitleBar onDrag={drag} onMinimize={bridge.native ? () => void bridge.minimizeWindow().catch(() => undefined) : undefined} onClose={() => void closeSettings()} />;

  if (!settings) return <main className="ft-scope ft-settings-window settings-loading" data-ft-page="general">
    <div className="st-loading">
      <AppMark size={32} />
      <h1>{t('settings.title')}</h1>
      <p role={store.loadError ? 'alert' : 'status'}>{t(store.loadError ? 'settings.loadError' : 'settings.loading')}</p>
      <div className="st-loading-actions">
        {store.loadError && <Button variant="primary" onClick={store.reload}>{t('common.retry')}</Button>}
        <Button onClick={() => void bridge.closeSettings()}>{t('common.close')}</Button>
      </div>
    </div>
    {chrome}
  </main>;

  const problemText = (problem: SaveProblem) => 'key' in problem ? t(problem.key) : describeRefusal(problem.text, t);
  const defaultProbe = probes[settings.defaultServerId] ?? probeA;
  const serverBadge = defaultProbe.status === 'error' ? 'error' : defaultProbe.status === 'running' ? 'running' : null;
  const serverAside = serverBadge ? <span className="st-tab-badge"><StatusDot state={serverBadge} /><span className="st-sr">{t(serverBadge === 'error' ? 'nav.serverFailing' : 'nav.serverChecking')}</span></span> : null;
  const onScroll = (event: UIEvent<HTMLDivElement>) => { const on = event.currentTarget.scrollTop > 56; if (on !== scrolled) setScrolled(on); };
  const { settings: _settings, loadError: _loadError, reload: _reload, current: _current, ...actions } = store;
  const context: SettingsContextValue = { ...actions, settings, go, openLog, landing, showToast, registrations, probes, addressDrafts, setAddressDraft, expanded, setExpanded };

  return <main className="ft-scope ft-settings-window">
    <SettingsContext.Provider value={context}>
      <Tabs value={current} onValueChange={id => go(id as PageId)}>
        <div className="ft-settings">
          <aside className="ft-settings-sidebar">
            <div className="ft-settings-app"><AppMark size={24} /><span><strong>{appName}</strong><h1>{t('settings.title')}</h1></span></div>
            <div className="st-search">
              <Search {...ICON} size={15} aria-hidden="true" />
              <input type="search" value={query} maxLength={queryMaxLength} onChange={event => setQuery(event.target.value)} placeholder={t('nav.search')} aria-label={t('nav.search')}
                onKeyDown={event => {
                  if (event.key === 'Enter' && results[0]) go(results[0].page, results[0].field);
                  // Escape empties the search first; an empty one lets the window close.
                  if (event.key === 'Escape' && query) { event.preventDefault(); setQuery(''); }
                }} />
              {query && <button type="button" className="st-search-clear" aria-label={t('nav.searchClear')} onClick={() => setQuery('')}><X size={12} strokeWidth={2} /></button>}
            </div>
            <div className="st-nav">
              {query.trim()
                ? <div className="st-results" role="list" aria-label={t('nav.results')}>
                    {results.length ? results.map((result, index) => <motion.button role="listitem" type="button" key={`${result.field}-${result.title}`} className="st-result" data-ft-page={result.page} onClick={() => go(result.page, result.field)}
                      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={tx('smooth', { delay: index * 0.02 })}>
                      <strong>{result.title}</strong><small>{result.pageLabel}</small>
                    </motion.button>) : <p className="st-results-empty">{t('nav.noResult')}</p>}
                  </div>
                : <TabList label={t('nav.pages')}>
                    {pages.filter(id => id !== 'diagnostic').map(id => { const Glyph = pageIcons[id]; return <Tab key={id} value={id} icon={<Glyph {...ICON} />} badge={id === 'server' ? serverAside : null}>{t(pageTitle(id))}</Tab>; })}
                    <AnimatePresence initial={false}>
                      {showDiag && <motion.div key="diag" className="st-diag-tab" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96, transition: tx({ duration: 0.16, ease: 'out' }) }} transition={tx('smooth')}>
                        {/* « Apparition en place »: the entry fades and grows where it will stay, no slide. */}
                        <span className="st-nav-sep" aria-hidden="true" />
                        <Tab value="diagnostic" icon={<Activity {...ICON} />}>{t('nav.diagnostic')}</Tab>
                      </motion.div>}
                    </AnimatePresence>
                  </TabList>}
            </div>
            <div className="ft-settings-foot"><span onClick={onVersionClick}>{t('nav.version', { version: __APP_VERSION__ })}</span></div>
          </aside>

          <div className="ft-settings-main" data-ft-page={current}>
            <span className="ft-page-veil" aria-hidden="true" />
            <ScrollArea className="ft-settings-content" viewportRef={content} onScroll={onScroll} shadows="bottom">
              <div className="st-topbar" data-show={scrolled ? '' : undefined} aria-hidden="true"><span>{t(pageTitle(current))}</span></div>
              {pages.map(id => { const View = pageViews[id]; return <TabPanel key={id} value={id} className="ft-settings-page">
                <motion.div className="st-page" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={tx('smooth')}>
                  <PageHeader title={t(pageTitle(id))} description={t(pageAbout(id))} aside={id === 'diagnostic' ? null : <SaveState status={store.saveStatus} onRetry={store.retry} />} />
                  {store.saveStatus === 'error' && store.saveError && id !== 'diagnostic' && <Notice kind="error" className="st-save-error" title={t('nav.notSaved')} text={problemText(store.saveError)} />}
                  <View />
                </motion.div>
              </TabPanel>; })}
            </ScrollArea>
          </div>
          <div className="st-toast-host">
            <AnimatePresence>
              {/* One toast: a new message replaces the text in place (never a stack of toasts
                  fading on top of each other when Ctrl+Shift+M is pressed several times). */}
              {toast && <motion.div key="toast" className="st-toast" role="status" initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6 }} transition={tx('smooth')}>
                <motion.span key={toast.text} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={tx(0.14)}>{toast.text}</motion.span>
                {toast.keys && <span className="st-toast-keys"><Keycap size="sm">Ctrl</Keycap><Keycap size="sm">{t('page.key.shift')}</Keycap><Keycap size="sm">M</Keycap></span>}
              </motion.div>}
            </AnimatePresence>
          </div>
        </div>
      </Tabs>
    </SettingsContext.Provider>
    {chrome}
    {/* Without native decorations the corner still resizes the window. */}
    {bridge.native && <span className="st-resize-grip" aria-hidden="true" onPointerDown={event => { if (event.button === 0) { event.preventDefault(); void bridge.resizeSettingsCorner().catch(() => undefined); } }} />}
  </main>;
}
