import { useRef, useState } from 'react';
import { Globe, Info, LogOut, Power, RotateCcw, Sparkles } from 'lucide-react';
import { menuShortcut, withLanguage } from '../../actionDefaults';
import { bridge } from '../../bridge';
import { useT } from '../../i18n';
import { Button, Group, ICON, Row, Select, Switch } from '../../components/controls';
import type { Language } from '../../types';
import { useSettingsContext } from '../useSettingsStore';
import { InlineConfirm } from './InlineConfirm';

// « Général »: start at sign-in, the interface language, « Revoir l'accueil », the reset (asked
// once more in its row, never in a modal) and the app itself.
export function GeneralPage() {
  const t = useT();
  const { settings, persist, resetToDefaults, showToast } = useSettingsContext();
  const [confirming, setConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetNote, setResetNote] = useState<{ text: string; failed: boolean } | null>(null);
  const opening = useRef(false);
  const [replaying, setReplaying] = useState(false);
  // « Restore default settings » (settings::reset): when Windows refused the default menu chord,
  // the menu kept its own (settings::keep_menu_chord) and the row says so.
  const reset = async () => {
    if (resetting) return;
    setResetting(true);
    try {
      const saved = await resetToDefaults();
      const chord = saved.shortcutBindings.find(binding => binding.kind === 'menu' && binding.enabled)?.shortcut ?? null;
      const kept = chord && chord !== menuShortcut ? chord : null;
      setResetNote(kept ? { text: t('settings.resetDoneKept', { default: menuShortcut, shortcut: kept }), failed: false } : null);
      showToast(t('settings.resetDone'));
    } catch { setResetNote({ text: t('settings.resetFailed'), failed: true }); }
    finally { setResetting(false); setConfirming(false); }
  };
  // One window, whatever the clicks: the button waits for the answer before it listens again.
  const replay = async () => {
    if (opening.current) return;
    opening.current = true; setReplaying(true);
    try { await bridge.openSetup(true); } catch { showToast(t('page.general.replayFailed')); }
    finally { opening.current = false; setReplaying(false); }
  };
  return <>
    <Group title={t('page.general.startup')}>
      <Row id="autostart" icon={<Power {...ICON} />} title={t('settings.autostart')} description={t('settings.autostartHelp')}
        control={<Switch checked={settings.autostart} onCheckedChange={autostart => persist({ ...settings, autostart }, true)} label={t('settings.autostart')} />} />
      <Row id="language" icon={<Globe {...ICON} />} title={t('page.general.language')} description={t('settings.languageHelp')}
        control={<Select<Language> label={t('page.general.language')} value={settings.language} onChange={language => persist(withLanguage(settings, language), true)} width={150}
          options={[{ value: 'fr', label: 'Français' }, { value: 'en', label: 'English' }]} />} />
    </Group>

    <Group title={t('page.general.firstRun')}>
      <Row id="replay" icon={<Sparkles {...ICON} />} title={t('page.general.replay')} description={t('page.general.replayHelp')}
        control={<Button onClick={() => void replay()} busy={replaying}>{t('page.general.replay')}</Button>} />
    </Group>

    <Group title={t('page.general.resetGroup')}>
      <Row id="reset" icon={<RotateCcw {...ICON} />} title={t('settings.reset')} description={resetNote && !resetNote.failed ? resetNote.text : t('settings.resetHelp')}
        control={<Button variant="danger" onClick={() => { setResetNote(null); setConfirming(true); }} disabled={confirming}>{t('settings.resetAction')}</Button>}>
        <InlineConfirm open={confirming} busy={resetting} text={t('settings.resetConfirm')} confirm={t('settings.resetConfirmAction')} keep={t('settings.resetKeep')}
          onKeep={() => setConfirming(false)} onConfirm={() => void reset()} />
        {resetNote?.failed && <p className="st-row-problem" role="alert">{resetNote.text}</p>}
      </Row>
    </Group>

    <Group title={t('page.general.aboutGroup')}>
      <Row icon={<Info {...ICON} />} title={t('page.general.version', { version: __APP_VERSION__ })} description={t('page.general.versionHelp')}
        control={<Button variant="ghost" icon={<LogOut {...ICON} size={15} />} onClick={() => void bridge.quit()}>{t('settings.quit')}</Button>} />
    </Group>
  </>;
}
