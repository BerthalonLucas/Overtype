import * as ScrollArea from '@radix-ui/react-scroll-area';
import { ActionSettings } from './ActionSettings';
import { AnimationsSetting } from './AnimationsSetting';
import { promptError } from './actionDefaults';
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Icon, Segmented, SettingSwitch } from './ui';
import { bridge } from './bridge';
import { GlassOverlay } from './GlassOverlay';
import { HaloWindow } from './halo/HaloWindow';
import { SetupWindow } from './setup/SetupWindow';
import { useTranslation } from './useTranslation';
import { shareSettings, useSettings } from './useSettings';
import { useDocumentPreferences } from './preferences';
import { locales, t as tNow, useLanguage, useT, type MessageKey } from './i18n';
import { MotionPreferences, useContentPresence, useReducedMotionSetting } from './motion/MotionPreferences';
import { indicatorOf } from './loaders/pill';
import { MenuSettings } from './settings/MenuSettings';
import { AfterReplaceSettings } from './settings/AfterReplace';
import { describeRefusal } from './settings/messages';
import { fieldFromLocation, isProfileField, resolveField, revealField } from './settings/fields';
import { useRegistrations } from './settings/registrations';
import { ResetSettings } from './settings/ResetSettings';
import type { AutoClose, Capture, HistoryEntry, Indicator, Language, MotionPreset, Server, Settings, SettingsFocus, ShortcutBinding, TextSize, Theme } from './types';

const defaultCapture: Capture = { id: 'demo-selection', text: 'Could you send the updated proposal before Thursday?', source: 'selection', canReplace: true, anchor: { x: 820, y: 410, width: 350, height: 24 } };
const longCapture: Capture = { ...defaultCapture, id: 'demo-long', text: 'Hi Alex,\n\nThank you for your feedback. The updated proposal includes the delivery timeline, responsibilities, and payment terms. Could you confirm these details before Thursday?\n\nWe have kept the total budget unchanged and clarified the review process. Please check the dates and amounts before we share the final version with the team.\n\nBest regards,\nMarie' };
const clipboardCapture: Capture = { id: 'demo-clipboard', text: 'Je vous envoie la proposition mise à jour.', source: 'clipboard', canReplace: false, anchor: null };
const uid = () => crypto.randomUUID?.() ?? `request-${Date.now()}`;

type SaveStatus = 'saved' | 'just-saved' | 'saving' | 'error';
// Why a save failed: one of our messages, or Rust's refusal (shown translated when known).
type SaveProblem = { key: MessageKey } | { text: string };
type Connection = { state: 'ok' | 'unknown' | 'error' | 'checking'; latencyMs?: number; message?: string };
// A server as the old page names it: its host, or its rank while it has no address.
const serverName = (server: Server, index: number) => server.name || server.endpoint.replace(/^https?:\/\//, '') || `${index + 1}`;
const menuBindingId = (bindings: ShortcutBinding[]) => ['menu', ...bindings.map((_, n) => `menu-${n + 2}`)].find(id => bindings.every(b => b.id !== id))!;
export function SettingsWindow() {
  const t = useT();
  const language = useLanguage();
  const reduced = useReducedMotionSetting();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [saveError, setSaveError] = useState<SaveProblem | null>(null);
  const [recording, setRecording] = useState(false);
  const [connections, setConnections] = useState<Record<string, Connection>>({});
  // The fold of the connection section: a state of this window (0.6 no longer saves it).
  const [connectionOpen, setConnectionOpen] = useState(false);
  // Lot 10: whether Windows registered each binding's chord (another application may hold it).
  const registrations = useRegistrations();
  // A direct link to a field (lot 10): asked by the URL at opening, or by an event later.
  const [fieldRequest, setFieldRequest] = useState<{ field: string } | null>(() => { const field = fieldFromLocation(location.search); return field ? { field } : null; });
  const clearHighlight = useRef<(() => void) | null>(null);
  const latest = useRef<Settings | null>(null);
  // What Rust is known to hold: loaded, adopted from `settings-changed`, or saved by us.
  const synced = useRef<Settings | null>(null);
  const saveTimer = useRef(0);
  const inFlight = useRef(0);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const lastError = useRef<SaveProblem>({ key: 'settings.notSaved' });
  const settledTimer = useRef(0);
  // The window's own copy feeds its document preferences (language, theme) at once.
  const show = (next: Settings) => { latest.current = next; setSettings(next); shareSettings(next); };
  const adopt = (next: Settings) => { synced.current = next; show(next); };
  const loadSettings = () => { setLoadError(false); void bridge.getSettings().then(adopt).catch(() => setLoadError(true)); };
  useEffect(() => { loadSettings(); void bridge.getHistory().then(setHistory).catch(() => undefined); }, []);
  useEffect(() => { void bridge.setSettingsTitle(t('settings.windowTitle')).catch(() => undefined); }, [t]);
  useEffect(() => () => { window.clearTimeout(saveTimer.current); window.clearTimeout(settledTimer.current); clearHighlight.current?.(); }, []);
  // The window stays alive while hidden: settings changed elsewhere (another window, the tray,
  // a later lot) must replace its copy, or its next save would write the old values back.
  // Adopted only when nothing is being typed or saved here: a pending edit wins, and is saved.
  useEffect(() => {
    let live = true;
    const offs: Array<() => void> = [];
    const keep = (off: () => void) => { if (live) offs.push(off); else off(); };
    void bridge.on<Settings>('settings-changed', incoming => {
      const current = latest.current;
      if (current === null) { setLoadError(false); adopt(incoming); return; }
      const editing = saveTimer.current !== 0 || inFlight.current > 0 || current !== synced.current;
      // Our own echo, or a change we are about to overwrite: the window's copy stays the reference.
      if (editing) { shareSettings(current); return; }
      if (JSON.stringify(incoming) === JSON.stringify(current)) { synced.current = current; return; }
      adopt(incoming);
    }).then(keep);
    void bridge.on<SettingsFocus>('settings-focus-field', ({ field }) => { if (field) setFieldRequest({ field }); }).then(keep);
    return () => { live = false; offs.forEach(off => off()); };
  }, []);
  const commit = async (next: Settings): Promise<boolean> => {
    setSaveStatus('saving');
    inFlight.current += 1;
    try {
      for (const action of next.actions) {
        if (promptError(action.promptTemplate)) throw { key: 'actions.promptInvalid' } satisfies SaveProblem;
      }
      const pending = saveQueue.current.then(() => bridge.saveSettings(next));
      saveQueue.current = pending.catch(() => undefined);
      await pending;
      synced.current = next;
      if (latest.current !== next) return true;
      setSaveStatus('just-saved');
      window.clearTimeout(settledTimer.current);
      settledTimer.current = window.setTimeout(() => setSaveStatus(status => status === 'just-saved' ? 'saved' : status), 3000);
      return true;
    } catch (error) {
      lastError.current = typeof error === 'string' ? { text: error } : error && typeof error === 'object' && 'key' in error ? error as SaveProblem : { key: 'settings.notSaved' };
      if (latest.current === next) { setSaveError(lastError.current); setSaveStatus('error'); }
      return false;
    } finally {
      inFlight.current -= 1;
    }
  };
  // Every change is saved: immediately for switches and segments, 300 ms after typing.
  const persist = (next: Settings, immediate: boolean) => {
    show(next);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = 0;
    if (immediate) void commit(next);
    else saveTimer.current = window.setTimeout(() => { saveTimer.current = 0; if (latest.current) void commit(latest.current); }, 300);
  };
  const retry = () => { if (latest.current) void commit(latest.current); };
  const problemText = (problem: SaveProblem) => 'key' in problem ? t(problem.key) : describeRefusal(problem.text, t);
  // Opens the connection details if needed, then scrolls to the field, focuses it and makes it
  // pulse (lab: MockSettings). An unknown field is ignored.
  useEffect(() => {
    if (!fieldRequest || !settings) return;
    const id = resolveField(fieldRequest.field, settings.servers, settings.defaultServerId);
    if (id && isProfileField(id) && !connectionOpen) { setConnectionOpen(true); return; }
    setFieldRequest(null);
    if (!id) return;
    clearHighlight.current?.();
    clearHighlight.current = revealField(document, id, reduced);
  }, [fieldRequest, settings, connectionOpen]);

  if (!settings) return <main className="settings-window settings-loading"><h1>{t('settings.title')}</h1><p role={loadError ? 'alert' : 'status'}>{t(loadError ? 'settings.loadError' : 'settings.loading')}</p>{loadError && <button className="primary-action" onClick={loadSettings}>{t('common.retry')}</button>} <button className="quiet-action" onClick={() => void bridge.closeSettings()}>{t('common.close')}</button></main>;

  const update = <K extends keyof Settings>(key: K, value: Settings[K], immediate = true) => persist({ ...settings, [key]: value }, immediate);
  const profile = (id: string, key: 'endpoint' | 'model' | 'apiKey', value: string) => {
    setConnections(previous => ({ ...previous, [id]: { state: 'unknown' } }));
    persist({ ...settings, servers: settings.servers.map(server => server.id === id ? { ...server, [key]: value, ...(key === 'apiKey' ? { noKey: value === '' } : {}) } : server) }, false);
  };
  const connectionOf = (id: string): Connection => connections[id] ?? { state: 'unknown' };
  // A chord is saved at once and enables its binding; refused, the previous one comes back.
  // id null: the menu has no binding yet (a 0.4 file whose Ctrl+Alt+Space was taken), one is added.
  const recordShortcut = async (id: string | null, shortcut: string): Promise<string | null> => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = 0;
    const previous = latest.current!;
    const bindings: ShortcutBinding[] = id === null
      ? [...previous.shortcutBindings, { id: menuBindingId(previous.shortcutBindings), kind: 'menu', shortcut, actionId: previous.defaultActionId, outputMode: 'replace', enabled: true }]
      : previous.shortcutBindings.map(b => b.id === id ? { ...b, shortcut, enabled: true } : b);
    const next = { ...previous, shortcutBindings: bindings };
    setRecording(true);
    show(next);
    try {
      if (await commit(next)) return null;
      if (latest.current === next) {
        show(previous);
        // An edit typed just before stays to be saved; otherwise nothing changed.
        if (previous !== synced.current) persist(previous, false);
        else { setSaveStatus('saved'); setSaveError(null); }
      }
      return 'key' in lastError.current ? tNow(lastError.current.key) : lastError.current.text;
    } finally {
      setRecording(false);
    }
  };
  // « Restore default settings »: an edit still waiting gives way, then Rust saves a fresh
  // install's settings (keeping this device's setup, settings::reset) and the window adopts them.
  // Refused, nothing changed: the edit that waited is saved as it would have been.
  const resetToDefaults = async (): Promise<Settings> => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = 0;
    setSaveStatus('saving');
    inFlight.current += 1;
    try {
      const pending = saveQueue.current.then(() => bridge.resetSettings());
      saveQueue.current = pending.catch(() => undefined);
      const saved = await pending;
      adopt(saved);
      setSaveError(null);
      setSaveStatus('just-saved');
      window.clearTimeout(settledTimer.current);
      settledTimer.current = window.setTimeout(() => setSaveStatus(status => status === 'just-saved' ? 'saved' : status), 3000);
      return saved;
    } catch (error) {
      if (latest.current && latest.current !== synced.current) void commit(latest.current);
      else setSaveStatus('saved');
      throw error;
    } finally {
      inFlight.current -= 1;
    }
  };
  const closeSettings = async () => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = 0;
    if (latest.current && !await commit(latest.current)) return;
    await bridge.closeSettings();
  };
  const check = async (mode: string) => {
    setConnections(previous => ({ ...previous, [mode]: { state: 'checking' } }));
    // Rust checks the saved profile: an address typed less than 300 ms ago, or a save not
    // confirmed yet, is saved first; a refused save is said, never checked with the old address.
    if (saveTimer.current !== 0 || (latest.current && latest.current !== synced.current)) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = 0;
      if (latest.current && !await commit(latest.current)) {
        setConnections(previous => ({ ...previous, [mode]: { state: 'unknown', message: tNow('settings.checkUnsaved') } }));
        return;
      }
    }
    const started = performance.now();
    try {
      const result = await bridge.checkConnection(mode);
      setConnections(previous => ({ ...previous, [mode]: { state: result.connected ? 'ok' : 'error', latencyMs: Math.max(1, Math.round(performance.now() - started)), message: result.message } }));
    } catch {
      setConnections(previous => ({ ...previous, [mode]: { state: 'error', message: tNow('settings.checkImpossible') } }));
    }
  };
  const removeHistory = async (id: string | null) => { try { await bridge.deleteHistory(id); setHistory(await bridge.getHistory()); } catch { setSaveError({ key: 'settings.deleteFailed' }); setSaveStatus('error'); } };
  // Absolute dates in the interface's locale: the lab references must not drift day to day.
  const historyDate = (value: string) => {
    const date = new Date(value);
    return `${date.toLocaleDateString(locales[language], { day: 'numeric', month: 'short' })} ${date.toLocaleTimeString(locales[language], { hour: '2-digit', minute: '2-digit' })}`;
  };
  const statusLine = (mode: string) => {
    const connection = connectionOf(mode);
    if (connection.state === 'checking') return t('settings.checking');
    if (connection.state === 'ok') return t('settings.connected', { ms: connection.latencyMs ?? 0 });
    if (connection.state === 'error') return t('settings.connectionFailed');
    return t('settings.notChecked');
  };
  return <main className="settings-window" onKeyDown={event => { if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); void closeSettings(); } }}>
    <header className="settings-titlebar" onPointerDown={event => { if (bridge.native && event.button === 0 && !(event.target as HTMLElement).closest('button')) void bridge.dragSettings().catch(() => undefined); }}>
      <span className="settings-mark" aria-hidden="true"><svg viewBox="0 0 512 512" width="18" height="18"><rect width="512" height="512" rx="160" fill="#f2f5fa" stroke="rgb(29 29 31 / .16)" strokeWidth="24" /><path d="M140 182h208M140 254h144M140 326h84" fill="none" stroke="#1d1f24" strokeWidth="36" strokeLinecap="round" /><path d="m298 298 42 42 62-78" fill="none" stroke="#3b6fc4" strokeWidth="28" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
      <span className="settings-brand">FlowTranslate</span><h1>{t('settings.title')}</h1>
      <button className="close-settings" onClick={() => void closeSettings()} aria-label={t('settings.close')}><Icon name="close" /></button>
    </header>
    <ScrollArea.Root className="settings-scroll" type="always"><ScrollArea.Viewport className="settings-scroll-viewport"><div className="settings-body">
      {/* The sections of lot 13: Menu, Actions, After replacing, Appearance, then the result
          bubble, Connection and this device. What only the Îlot uses (grid, After replacing,
          indicator) shows under uiVersion « ilot » only; uiVersion and glassMaterial never show. */}
      <MenuSettings settings={settings} persist={persist} record={recordShortcut} busy={recording} registrations={registrations} />
      <ActionSettings settings={settings} persist={persist} record={recordShortcut} busy={recording} registrations={registrations} />
      {settings.uiVersion === 'ilot' && <AfterReplaceSettings settings={settings} persist={persist} />}
      <section className="appearance-settings">
        <h2>{t('settings.appearance')}</h2>
        <div className="setting-row"><div className="setting-copy"><strong>{t('settings.language')}</strong><small>{t('settings.languageHelp')}</small></div>
          <Segmented<Language> label={t('settings.language')} value={settings.language} options={[{ value: 'en', label: 'English' }, { value: 'fr', label: 'Français' }]} onChange={value => update('language', value)} /></div>
        <div className="setting-row"><div className="setting-copy"><strong>{t('settings.theme')}</strong><small>{t('settings.themeHelp')}</small></div>
          <Segmented<Theme> label={t('settings.theme')} value={settings.theme} options={[{ value: 'system', label: t('settings.themeSystem') }, { value: 'light', label: t('settings.themeLight') }, { value: 'dark', label: t('settings.themeDark') }]} onChange={value => update('theme', value)} /></div>
        {/* The working pill's indicator (lot 8) exists only in the Îlot journey: the 0.4 one keeps its spinner. */}
        {settings.uiVersion === 'ilot' && <div className="setting-row"><div className="setting-copy"><strong>{t('settings.indicator')}</strong><small>{t('settings.indicatorHelp')}</small></div>
          <Segmented<Indicator> label={t('settings.indicator')} value={indicatorOf(settings.indicator)} options={[{ value: 'perle', label: t('settings.indicatorPerle') }, { value: 'nebuleuse', label: t('settings.indicatorNebula') }, { value: 'ruban', label: t('settings.indicatorRibbon') }]} onChange={value => update('indicator', value)} /></div>}
        <AnimationsSetting value={settings.motion} onChange={value => update('motion', value)} />
        <div className="setting-row"><div className="setting-copy"><strong>{t('settings.motionPreset')}</strong><small>{t('settings.motionPresetHelp')}</small></div>
          <Segmented<MotionPreset> label={t('settings.motionPreset')} value={settings.motionPreset} options={[{ value: 'smooth', label: t('settings.motionSmooth') }, { value: 'bouncy', label: t('settings.motionBouncy') }]} onChange={value => update('motionPreset', value)} /></div>
      </section>
      <section className="bubble-settings">
        <div className="section-heading"><div><h2>{t('settings.bubble')}</h2><p>{t('settings.bubbleIntro')}</p></div></div>
        <div className="setting-row"><div className="setting-copy"><strong>{t('settings.textSize')}</strong><small>{t('settings.textSizeHelp')}</small></div>
          <Segmented<TextSize> label={t('settings.textSize')} value={settings.textSize} options={[{ value: 'normal', label: t('settings.textNormal') }, { value: 'large', label: t('settings.textLarge') }, { value: 'xlarge', label: t('settings.textXLarge') }]} onChange={value => update('textSize', value)} /></div>
        <div className="setting-row"><div className="setting-copy"><strong>{t('settings.autoClose')}</strong><small>{t('settings.autoCloseHelp')}</small></div>
          <Segmented<AutoClose> label={t('settings.autoClose')} value={settings.autoClose} options={[{ value: 'fast', label: t('settings.closeFast') }, { value: 'normal', label: t('settings.closeNormal') }, { value: 'slow', label: t('settings.closeSlow') }, { value: 'never', label: t('settings.closeNever') }]} onChange={value => update('autoClose', value)} /></div>
      </section>
      <section className="connection">
        <button className="section-toggle" onClick={() => setConnectionOpen(open => !open)} aria-expanded={connectionOpen} aria-controls="connection-profiles"><h2>{t('settings.connection')}</h2><Icon name="chevron" size={14} /></button>
        <div className="setting-row"><div className="setting-copy"><strong>{t('settings.defaultProfile')}</strong><small>{t('settings.defaultProfileHelp')}</small></div>
          <Segmented<string> label={t('settings.defaultProfile')} value={settings.defaultServerId} options={settings.servers.map((server, index) => ({ value: server.id, label: serverName(server, index) }))} onChange={value => update('defaultServerId', value)} /></div>
        {/* data-field: the stable identifiers the errors of lot 10 link to (src/settings/fields.ts). */}
        <div id="connection-profiles" className="profiles">{connectionOpen && settings.servers.map((server, index) => { const mode = server.id; return <div className="profile" key={mode}>
          <div className="profile-heading"><strong>{serverName(server, index)}</strong><span className="connection-state" data-state={connectionOf(mode).state} role="status"><i aria-hidden="true" />{statusLine(mode)}</span><button className="text-button" onClick={() => void check(mode)} disabled={connectionOf(mode).state === 'checking'}>{t('settings.check')}</button></div>
          <div className="field-grid"><label data-field={`${mode}.endpoint`}>{t('settings.endpoint')}<input type="url" placeholder="https://llm.exemple.com" value={server.endpoint} onChange={e => profile(mode, 'endpoint', e.target.value)} /></label><label data-field={`${mode}.model`}>{t('settings.model')}<input value={server.model} onChange={e => profile(mode, 'model', e.target.value)} /></label></div>
          <div className="secret" data-field={`${mode}.apiKey`}><label>{t('settings.apiKey')}<input type="password" autoComplete="new-password" placeholder={t('settings.apiKeyPlaceholder')} value={server.apiKey} onChange={e => profile(mode, 'apiKey', e.target.value)} /></label><small aria-hidden="true">{t('settings.apiKeyProtected')}</small></div>
          {(connectionOf(mode).state === 'error' || connectionOf(mode).state === 'unknown') && connectionOf(mode).message && <p className="row-warning">{connectionOf(mode).message}</p>}
        </div>; })}</div>
        {!bridge.native && connectionOpen && <small className="preview-note">{t('settings.previewConnection')}</small>}
      </section>
      <section>
        <h2>{t('settings.device')}</h2>
        <div className="setting-row"><div className="setting-copy"><strong>{t('settings.history')}</strong><small>{t('settings.historyHelp')}</small></div>
          <SettingSwitch label={t('settings.history')} checked={settings.historyEnabled} onCheckedChange={checked => update('historyEnabled', checked)} /></div>
        {settings.historyEnabled && <div className="history">
          {history.length ? history.map(item => <article key={item.id}><div><p>{item.translatedText}</p><small>{item.actionName}{item.server ? ` · ${item.server}` : ''} · {historyDate(item.createdAt)}</small></div><button className="icon-button history-remove" onClick={() => void removeHistory(item.id)} aria-label={t('settings.historyRemove')}><Icon name="close" size={14} /></button></article>) : <p className="empty-history">{t('settings.historyEmpty')}</p>}
          <div className="history-foot"><small>{t(new Intl.PluralRules(locales[language]).select(history.length) === 'one' ? 'settings.historyCountOne' : 'settings.historyCountOther', { count: history.length })}</small><button className="text-button" onClick={() => void removeHistory(null)} disabled={!history.length}>{t('settings.historyClear')}</button></div>
        </div>}
        <div className="setting-row"><div className="setting-copy"><strong>{t('settings.autostart')}</strong><small>{t('settings.autostartHelp')}</small></div>
          <SettingSwitch label={t('settings.autostart')} checked={settings.autostart} onCheckedChange={checked => update('autostart', checked)} /></div>
        <ResetSettings reset={resetToDefaults} />
      </section>
    </div></ScrollArea.Viewport><ScrollArea.Scrollbar className="settings-scrollbar" orientation="vertical"><ScrollArea.Thumb className="settings-scroll-thumb" /></ScrollArea.Scrollbar></ScrollArea.Root>
    <footer>
      <span className="save-status" data-status={saveStatus} aria-live="polite">
        {saveStatus === 'error' ? <button className="text-button retry" onClick={retry} title={saveError ? problemText(saveError) : undefined}>{t('settings.saveRetry')}</button> : <><Icon name="check" size={14} />{t(saveStatus === 'just-saved' ? 'settings.savedNow' : saveStatus === 'saving' ? 'settings.saving' : 'settings.saved')}</>}
      </span>
      <span className="settings-meta">{__APP_VERSION__} · <button className="text-button" onClick={() => void bridge.quit()}>{t('settings.quit')}</button></span>
    </footer>
    {saveStatus === 'error' && saveError && <p className="save-error-detail" role="alert">{problemText(saveError)}</p>}
    {bridge.native && <button className="settings-resize-grip" aria-label={t('settings.resize')} title={t('settings.resizeHint')} onPointerDown={event => { if (event.button === 0) { event.preventDefault(); void bridge.resizeSettingsCorner().catch(() => { setSaveError({ key: 'settings.resizeUnavailable' }); setSaveStatus('error'); }); } }}>◢</button>}
  </main>;
}

function DemoDesktop({ controller }: { controller: ReturnType<typeof useTranslation> }) {
  const [scenario, setScenario] = useState<'selection' | 'clipboard' | 'long' | 'very-long' | 'error'>('selection');
  const capture = scenario === 'clipboard' ? clipboardCapture : scenario === 'long' || scenario === 'very-long' ? longCapture : defaultCapture;
  const t = useT();
  const begin = () => { const next = { ...capture, id: uid() }; bridge.setDemoCapture(next, scenario === 'error' ? 'error' : scenario === 'very-long' ? 'very-long' : scenario === 'long' ? 'long' : 'normal'); controller.receiveCapture(next); };
  return <main className="demo-desktop">
    <aside className="demo-sidebar"><span className="demo-logo">FT</span><span>{t('demo.mail')}</span><span>{t('demo.messages')}</span><span>{t('demo.settings')}</span></aside>
    <section className="demo-mail"><div className="demo-toolbar"><span>{t('demo.newMessage')}</span><span className="demo-search">{t('demo.search')}</span><span>{t('demo.send')}</span></div><div className="demo-recipient"><span>{t('demo.to')}</span><b>alex.martin@exemple.com</b></div><div className="mail-copy"><p>Bonjour Alex,</p><p>Je vous envoie la proposition mise à jour.</p><p>Bonne journée,<br/>Marie</p></div></section>
    <aside className="demo-panel"><span className="demo-badge">{t('demo.badge')}</span><h1>FlowTranslate</h1><p>{t('demo.intro')}</p><fieldset><legend>{t('demo.scenario')}</legend>
      {([['selection', 'demo.selection'], ['clipboard', 'demo.clipboard'], ['long', 'demo.long'], ['very-long', 'demo.veryLong'], ['error', 'demo.error']] as const).map(([value, key]) => <label key={value}><input type="radio" checked={scenario === value} onChange={() => setScenario(value)} /> {t(key)}</label>)}
    </fieldset><button className="primary-action demo-start" onClick={begin}>{t('demo.start')}</button><button className="text-button settings-link" onClick={() => location.assign('?window=settings&demo=1')}>{t('demo.openSettings')}</button></aside>
    <div className="demo-selection">Could you send the updated proposal before Thursday?</div>
    <GlassOverlay controller={controller} />
  </main>;
}

function OverlayWindow({ standaloneDemo }: { standaloneDemo: boolean }) {
  const controller = useTranslation(true);
  const [background, setBackground] = useState(() => {
    const requested = new URLSearchParams(location.search).get('background');
    return requested === 'light' || requested === 'dark' ? requested : 'color';
  });
  const { receiveCapture, initError } = controller;
  const t = useT();
  const demoStarted = useRef(false);
  useEffect(() => {
    if (!demoStarted.current && standaloneDemo) {
      demoStarted.current = true;
      const scenario = new URLSearchParams(location.search).get('scenario');
      const capture = scenario === 'confirmation' ? clipboardCapture : scenario === 'long' || scenario === 'very-long' ? longCapture : defaultCapture;
      bridge.setDemoCapture(capture, scenario === 'error' ? 'error' : scenario === 'very-long' ? 'very-long' : scenario === 'long' ? 'long' : 'normal');
      receiveCapture(capture);
    }
  }, [standaloneDemo, receiveCapture]);
  return <div className={standaloneDemo ? 'standalone-demo' : 'native-overlay'} data-preview-background={standaloneDemo ? background : undefined}>{initError && <div className="initialization-error"><p role="alert">{t(initError === 'close' ? 'init.close' : 'init.connection')} {t('init.restart')}</p><button className="quiet-action" onClick={() => location.reload()}>{t('common.retry')}</button> <button className="quiet-action" onClick={() => void bridge.openSettings()}>{t('common.settings')}</button> <button className="quiet-action" onClick={() => void bridge.dismiss()}>{t('common.close')}</button></div>}{standaloneDemo && <>
    <span className="preview-label">{t('preview.label')}</span>
    <div className="preview-backgrounds" role="group" aria-label={t('preview.backgrounds')}>
      {([['light', 'preview.light'], ['dark', 'preview.dark'], ['color', 'preview.color']] as const).map(([value, key]) => <button key={value} type="button" aria-pressed={background === value} onClick={() => setBackground(value)}>{t(key)}</button>)}
    </div>
  </>}<GlassOverlay controller={controller} /></div>;
}

function DemoWindow() { return <DemoDesktop controller={useTranslation(false)} />; }

export function App() {
  const params = useMemo(() => new URLSearchParams(location.search), []);
  const windowName = params.get('window') ?? (bridge.native ? 'overlay' : 'demo');
  const standaloneDemo = params.get('demo') === '1';
  const settings = useSettings();
  useDocumentPreferences(settings);
  useEffect(() => { document.body.className = `flowtranslate-window flowtranslate-${windowName}`; return () => { document.body.className = ''; }; }, [windowName]);
  const content = windowName === 'settings' ? <SettingsWindow />
    : windowName === 'setup' ? <SetupWindow />
    : windowName === 'halo' ? <HaloWindow />
    : windowName === 'overlay' && (bridge.native || standaloneDemo) ? <OverlayWindow standaloneDemo={standaloneDemo} />
    : <DemoWindow />;
  return <MotionPreferences motion={settings?.motion ?? 'system'} preset={settings?.motionPreset ?? 'smooth'}>{content}</MotionPreferences>;
}

