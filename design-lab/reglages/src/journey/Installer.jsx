// (0) The end of the installer: a small, classic Windows window. The bar fills (1,6 s), then
// « FlowTranslate est installé » and « Lancer ». Solid material on purpose: it is not the app yet.
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Check } from 'lucide-react';
import { AppWindow } from '../stage/AppWindow.jsx';
import { AppMark } from '../stage/Desktop.jsx';
import { Button, ICON } from '../ui/index.jsx';
import { useTx, wait } from '../lib/motion.js';
import { appName } from '../brand.js';

const FILES = ['Copie des fichiers…', 'Création du raccourci…', 'Inscription au démarrage de Windows…', 'Terminé'];

export function Installer({ onLaunch, onClose, launchRef }) {
  const tx = useTx();
  const [i, setI] = useState(0);
  const last = i >= FILES.length - 1;
  // « Terminé » and « Lancer » wait for the bar to actually reach the end, not for the target value.
  const [filled, setFilled] = useState(false);
  const done = last && filled;
  useEffect(() => { // safety net if the bar's animation never reports its end
    if (!last || filled) return undefined;
    const c = new AbortController();
    wait(900, c.signal).then(ok => { if (ok) setFilled(true); });
    return () => c.abort();
  }, [last, filled]);
  useEffect(() => {
    const c = new AbortController();
    (async () => {
      for (let k = 1; k < FILES.length; k++) { if (!(await wait(k === 1 ? 700 : 450, c.signal))) return; setI(k); }
    })();
    return () => c.abort();
  }, []);
  return (
    <AppWindow title={`Installation de ${appName}`} width={500} height={252} controls={['min', 'close']} onClose={onClose} className="jr-installer" material="solid">
      <div className="jr-inst">
        <div className="jr-inst-head">
          <AppMark size={44} />
          <div>
            <h1>{done ? `${appName} est installé` : `Installation de ${appName}`}</h1>
            <p>{done ? 'Tout est en place. Il ne reste qu’à le lancer.' : 'Veuillez patienter quelques secondes.'}</p>
          </div>
        </div>
        <div className="jr-inst-progress" role="progressbar" aria-label="Progression de l’installation" aria-valuemin={0} aria-valuemax={100} aria-valuenow={done ? 100 : Math.round((Math.min(i, FILES.length - 2) / (FILES.length - 1)) * 100)}>
          <motion.i initial={{ scaleX: 0.04 }} animate={{ scaleX: Math.max(0.04, i / (FILES.length - 1)) }} transition={tx({ duration: 0.45, ease: 'inOut' })}
            onAnimationComplete={() => { if (last) setFilled(true); }} />
        </div>
        <p className="jr-inst-file" aria-live="polite">
          {done && <Check size={14} strokeWidth={2.25} aria-hidden="true" />}
          <span>{done ? FILES[FILES.length - 1] : FILES[Math.min(i, FILES.length - 2)]}</span>
          {done && <span className="jr-inst-size">Version 0.5.1 · 38 Mo</span>}
        </p>
        <div className="jr-inst-actions">
          <Button onClick={onClose} disabled={!done}>Fermer</Button>
          <Button ref={launchRef} variant="primary" disabled={!done} onClick={onLaunch} iconEnd={<ArrowRight {...ICON} />}>Lancer</Button>
        </div>
      </div>
    </AppWindow>
  );
}
