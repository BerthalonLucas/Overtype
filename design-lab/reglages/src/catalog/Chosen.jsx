// « Primitives retenues » (v2): every control Lucas chose, live, in light AND dark side by side, on
// the matte window material, plus a sample of the floating glass over the real wallpaper and the
// page colours of the current set. The shell's proof sheet; the Composants agent may restyle it.
import { useState } from 'react';
import { Settings2, Keyboard, Sparkles, Undo2, Palette, Server, Lock, Activity, Check, Trash2 } from 'lucide-react';
import { Scope } from '../lab/Scope.jsx';
import { useLab } from '../lab/store.jsx';
import { Wallpaper } from '../stage/Desktop.jsx';
import { PAGES, PAGE_SET_BY_ID, pageColor } from '../tokens/index.js';
import { modelOptions } from '../mock/server.js';
import {
  Button, IconButton, Switch, Select, Combobox, Slider, Segmented, Field, Input, SecretInput, Group, Row, StatusDot, KeyCombo,
  Tabs, TabList, Tab, TabPanel, ScrollArea, Notice, Dialog, PageHeader, ICON, useFieldId,
} from '../ui/index.jsx';
import './chosen.css';

export const NAV_PAGES = [
  { id: 'general', label: 'Général', icon: Settings2 },
  { id: 'raccourcis', label: 'Raccourcis', icon: Keyboard },
  { id: 'actions', label: 'Actions', icon: Sparkles },
  { id: 'apres', label: 'Après remplacement', icon: Undo2 },
  { id: 'apparence', label: 'Apparence', icon: Palette },
  { id: 'serveur', label: 'Serveur', icon: Server },
  { id: 'donnees', label: 'Données', icon: Lock },
  { id: 'diagnostic', label: 'Diagnostic', icon: Activity },
];
const LANGS = [{ value: 'fr', label: 'Français' }, { value: 'en', label: 'English' }, { value: 'de', label: 'Deutsch' }];

function safeModels() {
  try {
    const list = modelOptions?.() || [];
    if (list.length) return list;
  } catch { /* the mock may need a probe first */ }
  return [
    { value: 'unsloth/gemma-4-12B-it-qat-GGUF:UD-Q4_K_XL', label: 'unsloth/gemma-4-12B-it-qat-GGUF:UD-Q4_K_XL', hint: 'llama.cpp · 128 k' },
    { value: 'qwen3-8b-instruct', label: 'qwen3-8b-instruct', hint: 'vllm · 32 k' },
    { value: 'tencent/Hy-MT2-7B-FP8', label: 'tencent/Hy-MT2-7B-FP8', hint: 'vllm · 32 k' },
    { value: 'mistral-small-3.2-24b', label: 'mistral-small-3.2-24b', hint: 'vllm · 128 k' },
  ];
}

function Panel({ page }) {
  const keyId = useFieldId('k');
  const urlId = useFieldId('u');
  const [a, setA] = useState(true);
  const [b, setB] = useState(false);
  const [lang, setLang] = useState('fr');
  const models = safeModels();
  const [model, setModel] = useState(models[0].value);
  const [undo, setUndo] = useState(6);
  const [look, setLook] = useState('fluide');
  const [key, setKey] = useState('sk-demo-7f3a91c2');
  const [confirm, setConfirm] = useState(false);
  const P = NAV_PAGES.find(p => p.id === page);
  return (
    <div className="ch-panel-inner">
      <PageHeader title={P.label} description="Chaque contrôle retenu, sur la matière « fenêtre » : mate, opaque, nette." />
      <Group title="Interrupteur et liste">
        <Row icon={<Settings2 {...ICON} />} title="Lancer à l’ouverture de session" description="Prêt dès que Windows démarre." control={<Switch checked={a} onCheckedChange={setA} label="Lancer à l’ouverture de session" />} />
        <Row title="Sons" control={<Switch checked={b} onCheckedChange={setB} label="Sons" />} />
        <Row title="Langue de l’interface" control={<Select label="Langue" value={lang} onChange={setLang} options={LANGS} width={170} />} />
      </Group>
      <Group title="Modèle, curseur, segments">
        <Row stack title="Modèle" description="Liste lue sur votre serveur." control={<Combobox label="Modèle" value={model} onChange={setModel} options={models} searchPlaceholder="Rechercher un modèle" width={260} />} />
        <Row title="Temps pour annuler" control={<Slider label="Temps pour annuler" value={undo} min={2} max={20} onChange={setUndo} format={v => `${v} s`} />} />
        <Row title="Mouvement" control={<Segmented label="Mouvement" value={look} onChange={setLook} options={[{ value: 'fluide', label: 'Fluide' }, { value: 'rebondi', label: 'Rebondi' }]} />} />
        <Row title="Raccourci" control={<KeyCombo keys={['Ctrl', 'Alt', 'Espace']} size="sm" />} />
      </Group>
      <Group title="Connexion">
        <div className="ch-fields">
          <Field label="Adresse du serveur" htmlFor={urlId}><Input id={urlId} defaultValue="http://192.168.1.20:8000" /></Field>
          <Notice kind="warn" title="Connexion non chiffrée">Avec http://, le texte circule en clair sur le réseau.</Notice>
          <Field label="Clé API" htmlFor={keyId}><SecretInput id={keyId} value={key} onChange={setKey} note={key ? 'Protégée par Windows : chiffrée pour votre compte, jamais affichée en clair.' : undefined} /></Field>
          <div className="ch-row"><StatusDot state="ok">Connecté · 4 modèles · 180 ms</StatusDot></div>
        </div>
      </Group>
      <div className="ch-row">
        <Button variant="primary" icon={<Check {...ICON} />}>Enregistrer</Button>
        <Button>Annuler</Button>
        <Button variant="ghost">Détails</Button>
        <Button variant="danger" icon={<Trash2 {...ICON} />} onClick={() => setConfirm(true)}>Effacer</Button>
        <IconButton label="Supprimer" round variant="secondary"><Trash2 {...ICON} /></IconButton>
      </div>
      <Notice kind="error" title="Serveur injoignable" action={<Button size="sm">Réessayer</Button>}>Délai dépassé après 10 s. Vérifiez l’adresse ou le VPN.</Notice>
      <Notice kind="ok" title="Réglages enregistrés" />
      <Dialog open={confirm} onOpenChange={setConfirm} title="Effacer l’historique ?" description="Les 12 entrées de cet appareil seront supprimées. Cette action est définitive."
        actions={<><Button onClick={() => setConfirm(false)}>Annuler</Button><Button variant="danger" onClick={() => setConfirm(false)}>Effacer</Button></>} />
    </div>
  );
}

// The matte window: sidebar with the gliding pill, page veil, custom scroll.
export function ChosenWindow({ initial = 'general' }) {
  const [page, setPage] = useState(initial);
  return (
    <div className="ch-window">
      <Tabs value={page} onValueChange={setPage}>
        <aside className="ch-sidebar">
          <TabList label="Pages des réglages">
            {NAV_PAGES.map(p => <Tab key={p.id} value={p.id} icon={<p.icon {...ICON} />}>{p.label}</Tab>)}
          </TabList>
        </aside>
        <div className="ch-main" data-ft-page={page}>
          <span className="ft-page-veil" aria-hidden="true" />
          <ScrollArea className="ch-scroll">
            {NAV_PAGES.map(p => <TabPanel key={p.id} value={p.id}>{p.id === page && <Panel page={p.id} />}</TabPanel>)}
          </ScrollArea>
        </div>
      </Tabs>
    </div>
  );
}

// Real glass over the wallpaper: an Îlot-like pill and a result pill.
export function GlassSample() {
  return (
    <div className="ch-glass-stage">
      <div className="ch-glass-wall"><Wallpaper /></div>
      <div className="ch-glass-ilot ft-glass">
        {['Corriger', 'Traduire', 'Pro'].map((t, i) => <span key={t} className="ch-glass-chip" data-on={i === 0 ? '' : undefined}>{t}</span>)}
      </div>
      <div className="ch-glass-pill ft-glass"><Check size={14} strokeWidth={2} />Texte remplacé<span className="ch-glass-undo">Annuler</span></div>
    </div>
  );
}

export function PageColours() {
  const lab = useLab();
  const set = PAGE_SET_BY_ID[lab.pageSet];
  return (
    <div className="ch-hues">
      {['light', 'dark'].map(theme => (
        <Scope key={theme} theme={theme} className="ch-hue-row">
          {PAGES.map(id => {
            const c = pageColor(set.id, id, lab.base, theme);
            const P = NAV_PAGES.find(p => p.id === id);
            return (
              <span key={id} className="ch-hue" data-ft-page={id}>
                <span className="ch-hue-dot"><P.icon {...ICON} /></span>
                <span><strong>{P.label}</strong><small>{c.name} · {c.hue}</small></span>
              </span>
            );
          })}
        </Scope>
      ))}
    </div>
  );
}

export default function ChosenPrimitives() {
  const lab = useLab();
  return (
    <section id="cat-chosen" className="cat-section ch-section">
      <h2>Primitives retenues (v2)</h2>
      <p className="cat-question">Vos choix, en clair et en sombre côte à côte : interrupteur, liste, boutons, segments, bannière, dialogue et champs à nous ; liste des modèles façon HeroUI ; curseur façon shadcn ; barre latérale dont la surbrillance glisse jusqu’à la page cliquée ; nouvelle barre de défilement. Jeu de couleurs {lab.pageSet}, base {lab.base === 'papier' ? 'Papier' : 'Porcelaine'}, interrupteur {lab.switchStyle === 'hero' ? 'HeroUI' : 'nos primitives'} (barre du labo).</p>
      <div className="ch-pair">
        {['light', 'dark'].map(theme => (
          <Scope key={theme} theme={theme} className="ch-scope">
            <span className="ch-theme">{theme === 'light' ? 'Clair' : 'Sombre'}</span>
            <ChosenWindow initial={theme === 'light' ? 'general' : 'serveur'} />
            <GlassSample />
          </Scope>
        ))}
      </div>
      <h2>Une couleur par page</h2>
      <p className="cat-question">Icône dans la barre latérale, surbrillance et voile en haut de la page. Le setup reprend la couleur de chaque question (Apparence, Raccourcis, Serveur pour « Votre modèle », Actions pour la démo).</p>
      <PageColours />
    </section>
  );
}
