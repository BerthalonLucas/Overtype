import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Inbox, ShieldCheck, X } from 'lucide-react';
import { locales, useLanguage, useT } from '../../i18n';
import { Button, Group, ICON, IconButton, Row, Switch } from '../../components/controls';
import { useTx } from '../../components/motion';
import { useSettingsContext } from '../useSettingsStore';
import { InlineConfirm } from './InlineConfirm';
import { ActionGlyph } from './Shortcuts';

// « Données »: the opt-in encrypted history (7 days, 100 entries, DPAPI) and what it holds, with
// a removal one by one or all at once (asked once more in place). Nothing leaves the device.
export function DataPage() {
  const t = useT();
  const tx = useTx();
  const language = useLanguage();
  const { settings, persist, history, historyError, removeHistory, reloadHistory, showToast } = useSettingsContext();
  // The window is created hidden at startup and read the history then: read again each time the
  // page opens and each time the window comes back in front.
  useEffect(() => {
    reloadHistory();
    window.addEventListener('focus', reloadHistory);
    return () => window.removeEventListener('focus', reloadHistory);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const count = history.length;
  // Absolute dates in the interface's locale: a screenshot of today reads the same tomorrow.
  const date = (value: string) => {
    const at = new Date(value);
    if (Number.isNaN(at.getTime())) return '';
    return `${at.toLocaleDateString(locales[language], { day: 'numeric', month: 'short' })} ${at.toLocaleTimeString(locales[language], { hour: '2-digit', minute: '2-digit' })}`;
  };
  const clear = async () => {
    if (clearing) return;
    setClearing(true);
    const done = await removeHistory(null);
    setClearing(false);
    setConfirming(false);
    if (done) showToast(t('page.data.cleared'));
  };
  const remove = async (id: string) => {
    if (removing) return;
    setRemoving(id);
    await removeHistory(id);
    setRemoving(null);
  };
  const plural = new Intl.PluralRules(locales[language]).select(count) === 'one';
  return (
    <>
      <Group title={t('settings.device')}>
        <Row
          id="history"
          icon={<ShieldCheck {...ICON} />}
          title={t('page.data.historyKeep')}
          description={t('settings.historyHelp')}
          control={
            <Switch
              checked={settings.historyEnabled}
              onCheckedChange={(historyEnabled) => persist({ ...settings, historyEnabled }, true)}
              label={t('page.data.historyKeep')}
            />
          }
        />
      </Group>

      <Group
        title={t('page.data.history')}
        description={settings.historyEnabled ? null : t('page.data.off')}
        action={
          count > 0 ? (
            <Button size="sm" variant="danger" onClick={() => setConfirming(true)} disabled={confirming}>
              {t('settings.historyClear')}
            </Button>
          ) : null
        }
      >
        <InlineConfirm
          open={confirming && count > 0}
          busy={clearing}
          text={plural ? t('page.data.confirmOne') : t('page.data.confirmOther', { count })}
          confirm={t('settings.historyClear')}
          keep={t('page.data.keep')}
          onKeep={() => setConfirming(false)}
          onConfirm={() => void clear()}
        />
        {historyError && (
          <p className="st-row-problem" role="alert">
            {t('settings.deleteFailed')}
          </p>
        )}
        <ul className="st-history" aria-label={t('page.data.history')}>
          <AnimatePresence initial={false}>
            {history.map((item) => (
              <motion.li
                key={item.id}
                layout="position"
                className="st-history-item"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, x: 24, transition: tx({ duration: 0.18, ease: 'out' }) }}
                transition={tx('smooth')}
              >
                <span className="st-history-tile" aria-hidden="true">
                  <ActionGlyph action={settings.actions.find((action) => action.name === item.actionName)} />
                </span>
                <span className="st-history-main">
                  <span className="st-history-head">
                    <strong>{item.actionName}</strong>
                    <time>{[item.server, date(item.createdAt)].filter(Boolean).join(' · ')}</time>
                  </span>
                  <span className="st-history-text">
                    <span className="st-history-from">{item.sourceText}</span>
                    <ArrowRight size={13} strokeWidth={1.75} aria-hidden="true" />
                    <span className="st-history-to">{item.translatedText}</span>
                  </span>
                </span>
                <IconButton
                  size="sm"
                  label={t('settings.historyRemove')}
                  disabled={removing !== null || clearing}
                  onClick={() => void remove(item.id)}
                >
                  <X {...ICON} size={15} />
                </IconButton>
              </motion.li>
            ))}
          </AnimatePresence>
          {count === 0 && (
            <motion.li
              className="st-history-empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={tx(0.2)}
            >
              <span className="st-empty-icon" aria-hidden="true">
                <Inbox size={18} strokeWidth={1.5} />
              </span>
              {t('page.data.empty')}
            </motion.li>
          )}
        </ul>
      </Group>
      {count > 0 && (
        <p className="st-footnote st-footnote-tight">
          {t(plural ? 'page.data.countOne' : 'page.data.countOther', { count })}
        </p>
      )}
    </>
  );
}
