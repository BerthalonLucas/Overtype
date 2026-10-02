import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { Check, MessageSquareText, MousePointer2, TextCursorInput, WandSparkles } from 'lucide-react';
import { defaultBindings } from '../actionDefaults';
import { bridge } from '../bridge';
import { AppMark } from '../components/AppMark';
import { Button, ICON, KeyCombo, Segmented, Select } from '../components/controls';
import { useTx } from '../components/motion';
import { describeProblem } from '../connection/causes';
import { useDuration } from '../connection/Check';
import { ConnectionForm, type ConnectionValue } from '../connection/ConnectionForm';
import { hostOf, shortModel } from '../connection/endpoint';
import { useT, type MessageKey } from '../i18n';
import { ShortcutRecorder, shortcutKeys } from '../settings/ShortcutRecorder';
import type { Registrations } from '../settings/registrations';
import type { Language, ProbeProblem, Settings, Theme } from '../types';
import { connectionOf, directActionId, primaryBinding, shortcutChoice, withConnection, withShortcutChoice, type SetupStep } from './model';
import type { SetupSettings } from './useSetupSettings';

// The screens of the setup window, one question per screen (design-lab/reglages/src/journey/
// screens.jsx). Each is a body only: SetupWindow draws the header (icon, question, one line), the
// navigation and the big button. Every answer goes to the real settings at once.

// ——— The welcome: the mark that beats, a ring leaving on each beat (« Battement et anneau ») ———
export function Heartbeat({ size = 88 }: { size?: number }) {
  return <span className="su-heart" style={{ '--hs': `${size}px` } as React.CSSProperties} aria-hidden="true">
    <span className="su-heart-ring" />
    <span className="su-heart-ring su-heart-ring-2" />
    <span className="su-heart-mark"><AppMark size={size} /></span>
  </span>;
}

// ——— (1) Appearance ———
const looks: Array<{ id: Theme; label: MessageKey; hint: MessageKey }> = [
  { id: 'system', label: 'setup.look.system', hint: 'setup.look.systemHint' },
  { id: 'light', label: 'setup.look.light', hint: 'setup.look.lightHint' },
  { id: 'dark', label: 'setup.look.dark', hint: 'setup.look.darkHint' },
];
export const lookLabel = (theme: Theme): MessageKey => looks.find(look => look.id === theme)?.label ?? 'setup.look.system';
// A tiny Settings window with the Îlot beside a selected line: the look at a glance.
function MiniApp({ look }: { look: 'light' | 'dark' }) {
  return <span className="su-look-scope" data-look={look}>
    <span className="su-mini">
      <span className="su-mini-side"><i /><i /><i /><i /></span>
      <span className="su-mini-main">
        <b />
        <span className="su-mini-line"><em /><s /></span>
        <span className="su-mini-line short"><em /></span>
        <span className="su-mini-ilot"><i /><i /><i /><i /></span>
      </span>
    </span>
  </span>;
}
export function LookScreen({ theme, language, onTheme, onLanguage }: { theme: Theme; language: Language; onTheme: (theme: Theme) => void; onLanguage: (language: Language) => void }) {
  const t = useT();
  return <div className="su-body-center">
    <ToggleGroup.Root type="single" className="su-looks" aria-label={t('setup.look.label')} value={theme} onValueChange={value => { if (value) onTheme(value as Theme); }}>
      {looks.map(look => <ToggleGroup.Item key={look.id} value={look.id} className="su-look" aria-label={t(look.label)}>
        <span className="su-look-thumb">
          {look.id === 'system' ? <><MiniApp look="light" /><span className="su-look-half"><MiniApp look="dark" /></span></> : <MiniApp look={look.id} />}
          <span className="su-check" aria-hidden="true"><Check size={12} strokeWidth={2.75} /></span>
        </span>
        <span className="su-look-label">{t(look.label)}<small>{t(look.hint)}</small></span>
      </ToggleGroup.Item>)}
    </ToggleGroup.Root>
    <p className="su-note">{t('setup.look.note')}</p>
    <div className="su-language">
      <span className="su-q-label" id="su-language-label">{t('setup.look.language')}</span>
      <Segmented<Language> label={t('setup.look.language')} value={language} onChange={onLanguage} options={[{ value: 'en', label: 'English' }, { value: 'fr', label: 'Français' }]} />
    </div>
  </div>;
}

// ——— (2) Shortcut and menu ———
function Sketch({ kind, action }: { kind: 'menu' | 'direct'; action: string }) {
  const t = useT();
  return <span className="su-sk" data-kind={kind} aria-hidden="true">
    <span className="su-sk-text"><em>{t('setup.shortcut.sample')}</em> {t('setup.shortcut.sampleRest')}</span>
    {kind === 'menu'
      ? <span className="su-sk-menu">{['F', 'T', 'P', 'S', 'E'].map(key => <i key={key}>{key}</i>)}</span>
      : <span className="su-sk-pill"><WandSparkles size={12} strokeWidth={1.75} /><span>{action}</span></span>}
  </span>;
}
export function ShortcutScreen({ store, settings, registrations }: { store: SetupSettings; settings: Settings; registrations: Registrations }) {
  const t = useT();
  const tx = useTx();
  const binding = primaryBinding(settings);
  const choice = shortcutChoice(settings);
  const actionId = directActionId(settings);
  const action = settings.actions.find(item => item.id === actionId);
  const actionName = action?.shortName?.trim() || action?.name || '';
  const fallback = defaultBindings[0].shortcut;
  const suggest = () => bridge.suggestShortcut();
  const [listening, setListening] = useState(false);
  return <div className="su-body-stack">
    <div className="su-rec">
      <ShortcutRecorder shortcut={binding?.shortcut ?? ''} enabled={binding?.enabled ?? true} label={t('setup.shortcut.label')} busy={store.recording} record={store.record}
        registration={binding ? registrations(binding) : undefined} suggest={suggest} size="xl" changeLabel={t('setup.shortcut.change')} hint={t('setup.shortcut.press')} onCapturing={setListening}
        actions={binding && binding.shortcut !== fallback ? <Button size="sm" variant="ghost" disabled={store.recording} onClick={() => void store.record(fallback)}>{t('setup.shortcut.restore', { shortcut: shortcutKeys(fallback, t).join(' + ') })}</Button> : null} />
      <p className="su-rec-note">{t(listening ? 'setup.shortcut.escape' : 'setup.shortcut.note')}</p>
    </div>
    <div className="su-q">
      <div className="su-q-head">
        <span className="su-q-label" id="su-mode-label">{t('setup.shortcut.when')}</span>
        <AnimatePresence initial={false}>
          {choice === 'direct' && <motion.span className="su-direct" initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 6 }} transition={tx('smooth')}>
            <Select label={t('setup.shortcut.action')} value={actionId} options={settings.actions.map(item => ({ value: item.id, label: item.name }))} width={168}
              onChange={next => store.persist(withShortcutChoice(settings, 'direct', next), true)} />
          </motion.span>}
        </AnimatePresence>
      </div>
      <ToggleGroup.Root type="single" className="su-cards" aria-labelledby="su-mode-label" value={choice} onValueChange={value => { if (value === 'menu' || value === 'direct') store.persist(withShortcutChoice(settings, value), true); }}>
        <ToggleGroup.Item value="menu" className="su-card">
          <Sketch kind="menu" action={actionName} />
          <span className="su-card-copy"><strong>{t('setup.shortcut.menu')}</strong><small>{t('setup.shortcut.menuText')}</small></span>
          <span className="su-check" aria-hidden="true"><Check size={12} strokeWidth={2.75} /></span>
        </ToggleGroup.Item>
        <ToggleGroup.Item value="direct" className="su-card">
          <Sketch kind="direct" action={actionName} />
          <span className="su-card-copy"><strong>{t('setup.shortcut.direct')}</strong><small>{t('setup.shortcut.directText')}</small></span>
          <span className="su-check" aria-hidden="true"><Check size={12} strokeWidth={2.75} /></span>
        </ToggleGroup.Item>
      </ToggleGroup.Root>
    </div>
  </div>;
}

// ——— (3) Your model ———
// The shared connection form (src/connection, imported, not forked). What is typed stays here;
// what is saved is always an address Rust accepts (empty, or one that reads): a half-typed address
// never makes a save fail. Under the form, one sentence to try the model.
const TRY_WATCHDOG_MS = 35_000;
type Trial = { state: 'idle' } | { state: 'running' } | { state: 'ok'; reply: string; ms: number } | { state: 'failed'; text: string };
let trySerial = 0;
export function ModelScreen({ store, settings, onReady, onOpenLog }: { store: SetupSettings; settings: Settings; onReady: (ready: boolean) => void; onOpenLog: (problem: ProbeProblem | null, run: string | null) => void }) {
  const t = useT();
  const tx = useTx();
  const duration = useDuration();
  const [value, setValue] = useState<ConnectionValue>(() => connectionOf(settings));
  const [ready, setReady] = useState(false);
  const [trial, setTrial] = useState<Trial>({ state: 'idle' });
  const run = useRef<string | null>(null);
  const watchdog = useRef(0);
  const latest = useRef(settings);
  latest.current = settings;
  const change = (next: ConnectionValue, immediate: boolean) => {
    setValue(next);
    const read = bridge.normalizeEndpoint(next.endpoint);
    const saved = connectionOf(latest.current);
    const endpoint = next.endpoint.trim() === '' ? '' : read.ok ? read.base : saved.endpoint;
    store.persist(withConnection(latest.current, { ...next, endpoint }), immediate);
  };
  const stopTrial = () => {
    window.clearTimeout(watchdog.current);
    if (run.current) { void bridge.cancelProbe(run.current).catch(() => undefined); run.current = null; }
  };
  // Whatever changes ends a try on its way: its answer would be about something else.
  useEffect(() => { stopTrial(); setTrial({ state: 'idle' }); }, [value.endpoint, value.apiKey, value.noKey, value.model, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { stopTrial(); onReady(false); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const tryIt = async () => {
    stopTrial();
    const id = `try-${Date.now().toString(36)}-${(trySerial++).toString(36)}`;
    run.current = id;
    setTrial({ state: 'running' });
    // Rust gives up after 30 s; if even that never comes, the button is freed here.
    watchdog.current = window.setTimeout(() => { if (run.current === id) { stopTrial(); setTrial({ state: 'failed', text: t('setup.model.tryStalled') }); } }, TRY_WATCHDOG_MS);
    try {
      const answer = await bridge.tryModel(id, value.endpoint, value.apiKey, value.noKey, value.model);
      if (run.current !== id) return;
      window.clearTimeout(watchdog.current); run.current = null;
      if (answer.ok) setTrial({ state: 'ok', reply: answer.reply, ms: answer.ms });
      else if (answer.problem.cause === 'cancelled') setTrial({ state: 'idle' });
      else setTrial({ state: 'failed', text: t('setup.model.tryFailed', describeProblem(answer.problem, t)) });
    } catch {
      if (run.current !== id) return;
      window.clearTimeout(watchdog.current); run.current = null;
      setTrial({ state: 'failed', text: t('setup.model.tryStalled') });
    }
  };
  return <div className="su-body-form">
    <ConnectionForm value={value} onChange={change} variant="setup" onOpenLog={onOpenLog} onReady={next => { setReady(next); onReady(next); }} />
    <AnimatePresence initial={false}>
      {ready && <motion.div key="trial" className="su-trial-row" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={tx('smooth')}>
        <Button size="sm" variant="ghost" onClick={() => void tryIt()} busy={trial.state === 'running'} icon={<MessageSquareText {...ICON} size={14} />}>{t('setup.model.try')}</Button>
        <span className="su-trial" role="status" aria-live="polite">
          {trial.state === 'ok' && <><span className="su-trial-bubble">{trial.reply}</span><span className="su-trial-ms">{duration(trial.ms)}</span></>}
          {trial.state === 'failed' && <span className="su-trial-failed">{trial.text}</span>}
        </span>
      </motion.div>}
    </AnimatePresence>
  </div>;
}

// ——— (4) Before the demo ———
export function DemoIntroScreen({ keys, problem }: { keys: string[]; problem: boolean }) {
  const t = useT();
  const steps: Array<{ icon: ReactNode; title: string; text: string }> = [
    { icon: <TextCursorInput {...ICON} size={20} />, title: t('setup.demo.select'), text: t('setup.demo.selectText') },
    { icon: <KeyCombo keys={keys} size="sm" joiner="" />, title: t('setup.demo.press'), text: keys.join(' + ') },
    { icon: <MousePointer2 {...ICON} size={20} />, title: t('setup.demo.choose'), text: t('setup.demo.chooseText') },
  ];
  return <div className="su-body-center">
    <ol className="su-how">
      {steps.map((step, index) => <li key={index} style={{ '--i': index } as React.CSSProperties}>
        <span className="su-how-icon">{step.icon}</span>
        <strong>{step.title}</strong>
        <small>{step.text}</small>
      </li>)}
    </ol>
    <p className="su-note" role={problem ? 'alert' : undefined} data-problem={problem ? '' : undefined}>{t(problem ? 'setup.demo.failed' : 'setup.demo.note')}</p>
  </div>;
}

// ——— (5) Ready ———
export function DoneMark() {
  const tx = useTx();
  return <span className="su-done-mark" aria-hidden="true">
    <motion.span className="su-done-disc" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={tx('bouncy', { delay: 0.1 })} />
    <svg viewBox="0 0 48 48" width="40" height="40">
      <motion.path d="M13 25l7 7 15-16" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={tx({ duration: 0.42, ease: 'out', delay: 0.32 })} />
    </svg>
  </span>;
}
// What was answered, each line editable: « Modifier » goes back to its question.
export function Recap({ settings, onEdit }: { settings: Settings; onEdit: (step: SetupStep) => void }) {
  const t = useT();
  const binding = primaryBinding(settings);
  const direct = shortcutChoice(settings) === 'direct';
  const action = settings.actions.find(item => item.id === directActionId(settings));
  const server = connectionOf(settings);
  const rows: Array<{ step: SetupStep; label: string; value: ReactNode }> = [
    { step: 'appearance', label: t('setup.ready.look'), value: t(lookLabel(settings.theme)) },
    { step: 'shortcut', label: t('setup.ready.shortcut'), value: <>{binding?.shortcut ? <KeyCombo keys={shortcutKeys(binding.shortcut, t)} size="sm" /> : null} <span className="su-recap-sub">{direct ? t('setup.ready.runs', { action: action?.name ?? '' }) : t('setup.ready.opensMenu')}</span></> },
    { step: 'model', label: t('setup.ready.model'), value: server.model && server.endpoint
      ? <><span className="su-recap-model" title={server.model}>{shortModel(server.model)}</span> <span className="su-recap-sub">{t('setup.ready.on', { host: hostOf(server.endpoint) })}</span></>
      : <span className="su-recap-todo">{t('setup.ready.todo')}</span> },
  ];
  return <dl className="su-recap">
    {rows.map(row => <div key={row.step} className="su-recap-row">
      <dt>{row.label}</dt>
      <dd>{row.value}</dd>
      <button type="button" className="ft-linklike" onClick={() => onEdit(row.step)} aria-label={t('setup.ready.editOf', { label: row.label })}>{t('setup.ready.edit')}</button>
    </div>)}
  </dl>;
}
