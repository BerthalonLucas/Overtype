// COMPOSANTS — each control the setup and the Réglages need, in three candidates side by side:
//   1. ours (src/ui: Radix, cmdk, motion, styled by the --ft-* tokens),
//   2. shadcn/ui (real new-york-v4 source, src/catalog/shadcn, tw: prefix, colours = our tokens),
//   3. HeroUI v3.2.6 (real @heroui/react, src/catalog/heroui.jsx, <HeroScope themed>).
// Every card is live, votable (👍/👎 + note) and has a centring overlay (src/catalog/Centring.jsx).
// Then: the 3 directions side by side and the 6 palettes (shell's proof, kept).
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Plus, Settings2, Keyboard, Server, Trash2, Search, Sparkles, Palette, Eye, EyeOff, Check, CheckIcon, ChevronsUpDown, CircleAlert, WifiOff } from 'lucide-react';
import { Scope } from '../lab/Scope.jsx';
import { Variant } from '../lab/Vote.jsx';
import {
  Button, IconButton, Switch, Select, Combobox, Slider, Segmented, Field, Input, SecretInput, Group, Row, StatusDot, KeyCombo,
  Dialog, ICON, useFieldId, Tabs, TabList, Tab, TabPanel,
} from '../ui/index.jsx';
import { ShadcnButton } from '../ui/shadcn/button.jsx';
import * as S from './shadcn/index.jsx';
import {
  useThemedHeroPortal, HeroSwitchDemo, HeroSelectDemo, HeroComboDemo, HeroTabsDemo, HeroSliderDemo, HeroFieldsDemo,
  HeroButtonsDemo, HeroSegmentedDemo, HeroToastDemo, HeroDialogDemo,
} from './heroui.jsx';
import { HeroButtonProof } from '../heroui/HeroDemo.jsx';
import { CentringBox, CentringToggle, useFollow } from './Centring.jsx';
import ChosenPrimitives from './Chosen.jsx';
import { modelOptions } from '../mock/server.js';
import { defaultShortcut } from '../brand.js';
import { useTx } from '../lib/motion.js';
import './catalog.css';

const LANGS = [
  { value: 'fr', label: 'Français' }, { value: 'en', label: 'English' }, { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' }, { value: 'it', label: 'Italiano' },
];
const THEMES = [{ value: 'system', label: 'Système' }, { value: 'light', label: 'Clair' }, { value: 'dark', label: 'Sombre' }];
const NAV = [
  { id: 'general', label: 'Général', icon: Settings2, tile: 7 },
  { id: 'raccourcis', label: 'Raccourcis', icon: Keyboard, tile: 1 },
  { id: 'actions', label: 'Actions', icon: Sparkles, tile: 4 },
  { id: 'apparence', label: 'Apparence', icon: Palette, tile: 5 },
  { id: 'serveur', label: 'Serveur', icon: Server, tile: 2 },
];
const LIBS = {
  ours: { name: 'Nos primitives', lib: 'Radix · src/ui' },
  shadcn: { name: 'shadcn/ui', lib: 'new-york v4 · Radix' },
  hero: { name: 'HeroUI v3', lib: '@heroui/react 3.2.6 · React Aria' },
};

// ——— our side: a notice pill (no toast library in the shell: motion + tokens, like the Îlot's Undo pill) ———
function OursNotice() {
  const [toast, setToast] = useState(null);
  const tx = useTx();
  const timer = useRef(0);
  const show = t => { clearTimeout(timer.current); setToast({ ...t, k: Date.now() }); timer.current = setTimeout(() => setToast(null), 4000); };
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <div className="cat-stack cat-notice-zone">
      <div className="cat-inline-notice" data-kind="error">
        <span className="cat-notice-icon"><WifiOff {...ICON} /></span>
        <span><strong>Serveur injoignable</strong><small>Délai dépassé après 10 s. Vérifiez l’adresse ou le VPN.</small></span>
      </div>
      <div className="cat-row">
        <Button size="sm" onClick={() => show({ kind: 'ok', title: 'Réglages enregistrés' })}>Enregistré</Button>
        <Button size="sm" onClick={() => show({ kind: 'error', title: 'Clé refusée (401)' })}>Erreur</Button>
      </div>
      <div className="cat-toast-slot" aria-live="polite">
        <AnimatePresence>
          {toast && (
            <motion.div key={toast.k} className="cat-toast" data-kind={toast.kind}
              initial={{ opacity: 0, y: 12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.98 }} transition={tx('smooth')}>
              <span className="cat-toast-icon">{toast.kind === 'ok' ? <Check size={14} strokeWidth={2} /> : <CircleAlert size={14} strokeWidth={2} />}</span>
              <span>{toast.title}</span>
              <button type="button" className="cat-toast-close" onClick={() => setToast(null)}>OK</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ——— shadcn: the official « Combobox » recipe (Popover + Command) ———
function ShadcnCombobox({ options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const current = options.find(o => o.value === value);
  return (
    <S.Popover open={open} onOpenChange={setOpen}>
      <S.PopoverTrigger asChild>
        <ShadcnButton variant="outline" role="combobox" aria-expanded={open} aria-label="Modèle" className="tw:w-[240px] tw:justify-between">
          <span className="tw:truncate">{current ? current.label : 'Choisir un modèle…'}</span>
          <ChevronsUpDown className="tw:size-4 tw:opacity-50" />
        </ShadcnButton>
      </S.PopoverTrigger>
      <S.PopoverContent className="tw:w-[280px] tw:p-0" align="start">
        <S.Command>
          <S.CommandInput placeholder="Rechercher un modèle" />
          <S.CommandList>
            <S.CommandEmpty>Aucun modèle.</S.CommandEmpty>
            <S.CommandGroup heading="Sur votre serveur">
              {options.map(o => (
                <S.CommandItem key={o.value} value={o.value} keywords={[o.label]} onSelect={v => { onChange(v); setOpen(false); }}>
                  <span className="tw:grid tw:min-w-0"><span className="tw:truncate">{o.label}</span><small className="tw:truncate tw:text-xs tw:text-muted-foreground">{o.hint}</small></span>
                  <CheckIcon className={o.value === value ? 'tw:ml-auto tw:opacity-100' : 'tw:ml-auto tw:opacity-0'} />
                </S.CommandItem>
              ))}
            </S.CommandGroup>
          </S.CommandList>
        </S.Command>
      </S.PopoverContent>
    </S.Popover>
  );
}

function ShadcnSecret() {
  const [shown, setShown] = useState(false);
  const [key, setKey] = useState('sk-demo-7f3a');
  return (
    <div className="tw:grid tw:gap-4 tw:w-full tw:max-w-[300px]">
      <div className="tw:grid tw:gap-2">
        <label htmlFor="sh-url" className="tw:text-sm tw:font-medium">Adresse du serveur</label>
        <S.Input id="sh-url" placeholder="https://llm.exemple.com" />
        <p className="tw:m-0 tw:text-xs tw:text-muted-foreground">Juste l’adresse. Pas besoin de /v1.</p>
      </div>
      <div className="tw:grid tw:gap-2">
        <label htmlFor="sh-key" className="tw:text-sm tw:font-medium">Clé API</label>
        <div className="tw:relative cat-sh-secret">
          <S.Input id="sh-key" type={shown ? 'text' : 'password'} value={key} onChange={e => setKey(e.target.value)} autoComplete="new-password" className="tw:pr-10" />
          <ShadcnButton variant="ghost" size="icon" type="button" aria-label={shown ? 'Masquer la clé' : 'Afficher la clé'} onClick={() => setShown(s => !s)}
            className="cat-sh-eye tw:absolute tw:right-0 tw:top-0 tw:h-9 tw:w-9 tw:hover:bg-transparent">
            {shown ? <EyeOff className="tw:size-4" /> : <Eye className="tw:size-4" />}
          </ShadcnButton>
        </div>
      </div>
    </div>
  );
}

function ShadcnDialogDemo() {
  const [open, setOpen] = useState(false);
  return (
    <S.Dialog open={open} onOpenChange={setOpen}>
      <S.DialogTrigger asChild><ShadcnButton variant="destructive"><Trash2 className="tw:size-4" />Tout remettre à zéro</ShadcnButton></S.DialogTrigger>
      <S.DialogContent className="tw:sm:max-w-[420px]">
        <S.DialogHeader>
          <S.DialogTitle>Tout remettre à zéro ?</S.DialogTitle>
          <S.DialogDescription>Raccourcis, actions et apparence reviennent aux valeurs d’origine. Votre serveur et votre clé restent.</S.DialogDescription>
        </S.DialogHeader>
        <S.DialogFooter>
          <S.DialogClose asChild><ShadcnButton variant="outline">Annuler</ShadcnButton></S.DialogClose>
          <ShadcnButton variant="destructive" onClick={() => setOpen(false)}>Remettre à zéro</ShadcnButton>
        </S.DialogFooter>
      </S.DialogContent>
    </S.Dialog>
  );
}

// ——— the matrix ———
function useControls() {
  const [sw, setSw] = useState({ a: true, b: false });
  const [lang, setLang] = useState('fr');
  const models = modelOptions();
  const [model, setModel] = useState(models[0]?.value || '');
  const [undo, setUndo] = useState(8);
  const [theme, setTheme] = useState('system');
  const [tab, setTab] = useState('general');
  const [dlg, setDlg] = useState(false);
  const keyId = useFieldId('key');
  const urlId = useFieldId('url');
  const [key, setKey] = useState('sk-demo-7f3a');

  return [
    {
      id: 'switch', title: 'Interrupteur', question: 'Pour chaque option oui/non des Réglages. Votre remarque de départ : la pastille doit être centrée dans le rail.',
      cards: {
        ours: { why: 'Contour Windows 11 en Verre et Mat, iOS plein en Aérien. Pastille concentrique calculée en CSS, bouge par transform.',
          checks: [{ box: '.ft-switch', glyph: '.ft-switch-thumb', mode: 'concentric', label: 'pastille' }],
          render: () => <div className="cat-row"><Switch checked={sw.a} onCheckedChange={a => setSw(s => ({ ...s, a }))} label="Démarrer avec Windows" /><Switch checked={sw.b} onCheckedChange={b => setSw(s => ({ ...s, b }))} label="Sons" /><Switch checked disabled label="Désactivé" onCheckedChange={() => {}} /><Switch checked={false} disabled label="Désactivé" onCheckedChange={() => {}} /></div> },
        shadcn: { why: 'Petit (32 × 18), plat, sans contour : très « web ». Pastille à 1 px du bord, pas d’état au survol.',
          checks: [{ box: '[data-slot=switch]', glyph: '[data-slot=switch-thumb]', mode: 'concentric', label: 'pastille' }],
          render: () => <div className="cat-row"><S.Switch checked={sw.a} onCheckedChange={a => setSw(s => ({ ...s, a }))} aria-label="Démarrer avec Windows" /><S.Switch checked={sw.b} onCheckedChange={b => setSw(s => ({ ...s, b }))} aria-label="Sons" /><S.Switch checked disabled aria-label="Désactivé" /><S.Switch size="sm" checked={sw.a} onCheckedChange={a => setSw(s => ({ ...s, a }))} aria-label="Petit" /></div> },
        hero: { why: 'Style iOS dans toutes les directions, pastille avec ombre qui s’étire à l’appui. Joli, mais ignore la direction choisie.',
          checks: [{ box: '.switch__control', glyph: '.switch__thumb', mode: 'concentric', label: 'pastille' }],
          render: () => <HeroSwitchDemo /> },
      },
    },
    {
      id: 'select', title: 'Liste déroulante', question: 'Pour les choix courts : langue, position de la pilule, délai.',
      cards: {
        ours: { why: 'Radix Select : la liste s’ouvre sous le champ, coche à droite, rayons et verre de la direction.',
          checks: [{ box: '.ft-select-trigger', glyph: '.ft-select-icon', mode: 'vcenter', label: 'chevron' }],
          render: () => <Select label="Langue de l’interface" value={lang} onChange={setLang} options={LANGS} width={220} /> },
        shadcn: { why: 'Radix aussi, mais la liste s’ouvre posée sur l’élément choisi (comme macOS). Sobre et générique.',
          checks: [{ box: '[data-slot=select-trigger]', glyph: 'svg', mode: 'vcenter', label: 'chevron' }],
          render: () => (
            <S.Select value={lang} onValueChange={setLang}>
              <S.SelectTrigger className="tw:w-[220px]" aria-label="Langue de l’interface"><S.SelectValue /></S.SelectTrigger>
              <S.SelectContent>{LANGS.map(l => <S.SelectItem key={l.value} value={l.value}>{l.label}</S.SelectItem>)}</S.SelectContent>
            </S.Select>
          ) },
        hero: { why: 'Libellé intégré au-dessus, flèche qui pivote, liste React Aria. Plus haut et plus présent visuellement.',
          checks: [{ box: '.select__trigger', glyph: '.select__indicator', mode: 'vcenter', label: 'chevron' }],
          render: () => <HeroSelectDemo options={LANGS} value={lang} onChange={setLang} /> },
      },
    },
    {
      id: 'combobox', title: 'Choix du modèle (liste avec recherche)', question: 'La liste remplie par /v1/models. Un serveur peut en renvoyer des dizaines.',
      cards: {
        ours: { why: 'cmdk dans un popover : on clique, puis on tape pour filtrer (façon Raycast). Clavier complet, modèle et contexte sur 2 lignes.',
          checks: [{ box: '.ft-combobox-trigger', glyph: 'svg', mode: 'vcenter', label: 'chevron' }],
          render: () => <Combobox label="Modèle" value={model} onChange={setModel} options={models} searchPlaceholder="Rechercher un modèle" width={240} /> },
        shadcn: { why: 'La recette « Combobox » officielle de shadcn (Popover + Command) : même principe que le nôtre, en plus neutre.',
          checks: [{ box: '[role=combobox]', glyph: 'svg', mode: 'vcenter', label: 'chevron' }],
          render: () => <ShadcnCombobox options={models} value={model} onChange={setModel} /> },
        hero: { why: 'On tape directement dans le champ (autocomplétion) : plus rapide, mais le champ vide peut dérouter tant que la liste n’est pas chargée.',
          checks: [{ box: '.combo-box__trigger', glyph: 'svg', mode: 'center', label: 'chevron' }],
          render: () => <HeroComboDemo options={models} value={model} onChange={setModel} /> },
      },
    },
    {
      id: 'nav', title: 'Navigation des Réglages (barre latérale)', question: 'Vous avez choisi : barre latérale, une page par sujet. Reste le style de l’onglet actif.',
      cards: {
        ours: { why: 'Radix Tabs vertical : fond sur l’onglet actif, icônes nues (Verre, Mat) ou sur tuiles colorées (Aérien). C’est la barre actuelle.',
          checks: [{ box: '.ft-tab-icon', glyph: 'svg', mode: 'center', label: 'icône' }],
          render: () => (
            <Tabs value={tab} onValueChange={setTab} className="cat-tabs">
              <TabList label="Réglages">{NAV.map(n => <Tab key={n.id} value={n.id} icon={<n.icon {...ICON} />} tile={n.tile}>{n.label}</Tab>)}</TabList>
              {NAV.map(n => <TabPanel key={n.id} value={n.id} className="cat-tab-panel"><strong>{n.label}</strong><small>Page « {n.label} » des Réglages.</small></TabPanel>)}
            </Tabs>
          ) },
        shadcn: { why: 'Tabs shadcn en vertical, variante « line » : un trait à droite de l’onglet actif, rien d’autre. Très minimal.',
          checks: [{ box: '[data-slot=tabs-trigger]', glyph: 'svg', mode: 'vcenter', label: 'icône' }],
          render: () => (
            <S.Tabs orientation="vertical" value={tab} onValueChange={setTab} className="tw:gap-4 cat-tabs">
              <S.TabsList variant="line" aria-label="Réglages" className="tw:items-stretch tw:w-[150px]">
                {NAV.map(n => <S.TabsTrigger key={n.id} value={n.id} className="tw:h-8 tw:px-2"><n.icon strokeWidth={1.5} />{n.label}</S.TabsTrigger>)}
              </S.TabsList>
              {NAV.map(n => <S.TabsContent key={n.id} value={n.id} className="cat-tab-panel"><strong>{n.label}</strong><small>Page « {n.label} » des Réglages.</small></S.TabsContent>)}
            </S.Tabs>
          ) },
        hero: { why: 'L’indicateur glisse d’un onglet à l’autre (animation intégrée). Élégant, mais pas de tuiles d’icônes.',
          checks: [{ box: '.tabs__tab', glyph: 'svg', mode: 'vcenter', label: 'icône' }],
          render: () => <HeroTabsDemo /> },
      },
    },
    {
      id: 'slider', title: 'Curseur', question: 'Pour « Temps pour annuler » (3 à 20 s) et la vitesse des animations.',
      cards: {
        ours: { why: 'Rail fin, pastille blanche, valeur lisible à droite (« 8 s »).',
          checks: [{ box: '.ft-slider', glyph: '.ft-slider-thumb', mode: 'vcenter', label: 'pastille' }],
          render: () => <Slider label="Temps pour annuler" value={undo} min={3} max={20} onChange={setUndo} format={v => `${v} s`} width={200} /> },
        shadcn: { why: 'Rail de 6 px, pastille cerclée d’accent, halo au survol. Pas de valeur affichée : à ajouter à côté.',
          checks: [{ box: '[data-slot=slider]', glyph: '[data-slot=slider-thumb]', mode: 'vcenter', label: 'pastille' }],
          render: () => <div className="cat-row cat-sh-slider"><S.Slider value={[undo]} min={3} max={20} step={1} onValueChange={([v]) => setUndo(v)} aria-label="Temps pour annuler" className="tw:w-[200px]" /><output className="cat-out">{undo} s</output></div> },
        hero: { why: 'Libellé et valeur intégrés au-dessus du rail, valeur formatée par le navigateur (« 8 s »).',
          checks: [{ box: '.slider__track', glyph: '.slider__thumb', mode: 'vcenter', label: 'pastille' }],
          render: () => <HeroSliderDemo value={undo} onChange={setUndo} /> },
      },
    },
    {
      id: 'fields', title: 'Champs : adresse et clé', question: 'La question « Votre modèle » du setup et la page Serveur.',
      cards: {
        ours: { why: 'Clé masquée, œil à droite, mention « Protégée par Windows » dans le champ. Indication sous le champ.',
          checks: [{ box: '.ft-secret-eye', glyph: 'svg', mode: 'center', label: 'œil' }, { box: '.ft-secret', glyph: '.ft-secret-eye', mode: 'vcenter', label: 'œil dans le champ' }],
          render: () => (
            <div className="cat-stack cat-w">
              <Field label="Adresse du serveur" htmlFor={urlId} hint="Juste l’adresse. Pas besoin de /v1."><Input id={urlId} placeholder="https://llm.exemple.com" /></Field>
              <Field label="Clé API" htmlFor={keyId}><SecretInput id={keyId} value={key} onChange={setKey} note="Protégée par Windows" /></Field>
            </div>
          ) },
        shadcn: { why: 'Input shadcn, et l’œil posé dessus à la main : shadcn n’a pas de champ « mot de passe » tout fait.',
          checks: [{ box: '.cat-sh-eye', glyph: 'svg', mode: 'center', label: 'œil' }, { box: '.cat-sh-secret', glyph: '.cat-sh-eye', mode: 'vcenter', label: 'œil dans le champ' }],
          render: () => <ShadcnSecret /> },
        hero: { why: 'TextField + InputGroup : l’œil est un suffixe prévu pour ça, description sous le champ. Le plus propre des trois.',
          checks: [{ box: '.cat-eye', glyph: 'svg', mode: 'center', label: 'œil' }, { box: '.input-group__suffix', glyph: '.cat-eye', mode: 'vcenter', label: 'œil dans le champ' }],
          render: () => <HeroFieldsDemo /> },
      },
    },
    {
      id: 'buttons', title: 'Boutons', question: 'Les grands boutons du setup, les actions des Réglages, les boutons ronds.',
      cards: {
        ours: { why: '4 variantes, taille xl pour le setup, rayon et matière de la direction, léger enfoncement à l’appui.',
          checks: [{ box: '.ft-icon-button', glyph: 'svg', mode: 'center', label: 'icône' }],
          render: () => (
            <div className="cat-stack">
              <div className="cat-row"><Button variant="primary">Continuer</Button><Button>Annuler</Button><Button variant="ghost">En savoir plus</Button></div>
              <div className="cat-row"><Button variant="danger" icon={<Trash2 {...ICON} />}>Effacer</Button><Button busy>Vérification</Button><Button disabled>Désactivé</Button></div>
              <div className="cat-row"><Button size="xl" variant="primary">Commencer le setup</Button></div>
              <div className="cat-row"><IconButton label="Rechercher" variant="secondary"><Search {...ICON} /></IconButton><IconButton label="Réglages" round variant="primary"><Settings2 {...ICON} /></IconButton><IconButton label="Ajouter un serveur" round size="lg" variant="secondary"><Plus {...ICON} /></IconButton></div>
            </div>
          ) },
        shadcn: { why: 'Les boutons shadcn : compacts (36 px), coins à 8 px, très « app web ». Pas de grande taille pour le setup.',
          checks: [{ box: '.cat-sh-icon', glyph: 'svg', mode: 'center', label: 'icône' }],
          render: () => (
            <div className="cat-stack">
              <div className="cat-row"><ShadcnButton>Continuer</ShadcnButton><ShadcnButton variant="outline">Annuler</ShadcnButton><ShadcnButton variant="ghost">En savoir plus</ShadcnButton></div>
              <div className="cat-row"><ShadcnButton variant="destructive"><Trash2 className="tw:size-4" />Effacer</ShadcnButton><ShadcnButton variant="secondary" disabled>Désactivé</ShadcnButton></div>
              <div className="cat-row"><ShadcnButton size="lg">Commencer le setup</ShadcnButton></div>
              <div className="cat-row"><ShadcnButton size="icon" variant="outline" aria-label="Rechercher" className="cat-sh-icon"><Search className="tw:size-4" /></ShadcnButton><ShadcnButton size="icon" aria-label="Réglages" className="cat-sh-icon tw:rounded-full"><Settings2 className="tw:size-4" /></ShadcnButton></div>
            </div>
          ) },
        hero: { why: 'Pression qui s’enfonce, état « en cours » intégré, rond parfait sur les boutons icône.',
          checks: [{ box: '.cat-iconly', glyph: 'svg', mode: 'center', label: 'icône' }],
          render: () => <HeroButtonsDemo /> },
      },
    },
    {
      id: 'segmented', title: 'Segments', question: 'Pour le thème (Système, Clair, Sombre) et les choix à 2 ou 3 options.',
      cards: {
        ours: { why: 'La pastille glisse d’un choix à l’autre (ressort), façon macOS. Le plus « Apple » des trois.',
          checks: [{ box: '.ft-segment', glyph: '.ft-segment-label', mode: 'center', label: 'libellé' }],
          render: () => <Segmented label="Thème" value={theme} onChange={setTheme} options={THEMES} /> },
        shadcn: { why: 'ToggleGroup contour : cases collées, fond accent doux sur le choix. Change d’un coup, sans glissement.',
          checks: [{ box: '[data-slot=toggle-group-item]', glyph: 'span', mode: 'center', label: 'libellé' }],
          render: () => (
            <S.ToggleGroup type="single" variant="outline" value={theme} onValueChange={v => v && setTheme(v)} aria-label="Thème">
              {THEMES.map(t => <S.ToggleGroupItem key={t.value} value={t.value}><span>{t.label}</span></S.ToggleGroupItem>)}
            </S.ToggleGroup>
          ) },
        hero: { why: 'ToggleButtonGroup : boutons collés, choix en fond plein. Net, un peu « barre d’outils ».',
          checks: [{ box: '.toggle-button', glyph: ':self', mode: 'center', label: 'bouton' }],
          render: () => <HeroSegmentedDemo value={theme} onChange={setTheme} /> },
      },
    },
    {
      id: 'notice', title: 'Notification et bandeau', question: 'Confirmer un enregistrement, signaler une erreur de connexion.',
      cards: {
        ours: { why: 'Bandeau dans la page + pilule qui monte, comme la pilule Annuler de l’Îlot (motion + nos jetons ; pas de bibliothèque de toast dans la coque).',
          checks: [{ box: '.cat-notice-icon', glyph: 'svg', mode: 'center', label: 'icône' }, { box: '.cat-toast-icon', glyph: 'svg', mode: 'center', label: 'icône pilule' }],
          render: () => <OursNotice /> },
        shadcn: { why: 'Alert shadcn dans la page. Le toast de shadcn, c’est Sonner : pas installé dans le labo, donc pas montré.',
          checks: [],
          render: () => (
            <div className="tw:grid tw:gap-3 tw:w-full">
              <S.Alert variant="destructive"><WifiOff /><S.AlertTitle>Serveur injoignable</S.AlertTitle><S.AlertDescription><p>Délai dépassé après 10 s. Vérifiez l’adresse ou le VPN.</p></S.AlertDescription></S.Alert>
              <S.Alert><CheckIcon /><S.AlertTitle>Connecté</S.AlertTitle><S.AlertDescription><p>12 modèles trouvés sur llm.exemple.com.</p></S.AlertDescription></S.Alert>
            </div>
          ) },
        hero: { why: 'Toasts empilés en bas de l’écran, couleur d’état et bouton fermer. Vrai composant HeroUI (ils sortent en bas de la page).',
          checks: [],
          render: () => <HeroToastDemo /> },
      },
    },
    {
      id: 'dialog', title: 'Confirmation (remise à zéro)', question: 'Le seul endroit où l’app demande « Êtes-vous sûr ? ».',
      cards: {
        ours: { why: 'Radix Dialog, entrée en ressort, fermer rond, matière de la direction.',
          checks: [{ box: '.ft-button', glyph: 'svg', mode: 'vcenter', label: 'icône' }],
          render: () => (
            <>
              <Button variant="danger" icon={<Trash2 {...ICON} />} onClick={() => setDlg(true)}>Tout remettre à zéro</Button>
              <Dialog open={dlg} onOpenChange={setDlg} title="Tout remettre à zéro ?" description="Raccourcis, actions et apparence reviennent aux valeurs d’origine. Votre serveur et votre clé restent."
                actions={<><Button onClick={() => setDlg(false)}>Annuler</Button><Button variant="primary" onClick={() => setDlg(false)}>Remettre à zéro</Button></>} />
            </>
          ) },
        shadcn: { why: 'Dialog shadcn : voile noir à 50 %, carte plate, fondu-zoom. Très standard.',
          checks: [{ box: '[data-slot=dialog-trigger]', glyph: 'svg', mode: 'vcenter', label: 'icône' }],
          render: () => <ShadcnDialogDemo /> },
        hero: { why: 'AlertDialog : icône d’état, voile, focus sur Annuler par défaut. Le plus explicite.',
          checks: [],
          render: () => <HeroDialogDemo /> },
      },
    },
  ];
}

function Candidate({ control, kind, card, globalOn }) {
  const [on, setOn] = useFollow(globalOn);
  const meta = LIBS[kind];
  return (
    <Variant id={`catalog.${control.id}.${kind}`} label={`${control.title} — ${meta.name}`} description={card.why} section="catalog" className="cat-card">
      <div className="cat-card-bar">
        <span className="cat-lib" data-kind={kind}>{meta.lib}</span>
        <CentringToggle on={on} onChange={setOn} label="Repères" />
      </div>
      <CentringBox checks={card.checks} on={on} className="cat-live">{card.render()}</CentringBox>
    </Variant>
  );
}

function MiniSettings() {
  const [a, setA] = useState(true);
  const [b, setB] = useState(false);
  const [mode, setMode] = useState('ilot');
  return (
    <div className="ft-mini-window">
      <Group title="Démarrage">
        <Row icon={<Settings2 {...ICON} />} tile={7} title="Démarrer avec Windows" description="Prêt dès l’ouverture de session." control={<Switch checked={a} onCheckedChange={setA} label="Démarrer avec Windows" />} />
        <Row icon={<Keyboard {...ICON} />} tile={1} title="Raccourci" control={<KeyCombo keys={defaultShortcut} size="sm" />} />
        <Row icon={<Server {...ICON} />} tile={2} title="Serveur" description="llm.exemple.com" control={<StatusDot state="ok">Connecté</StatusDot>} />
        <Row title="Sons" control={<Switch checked={b} onCheckedChange={setB} label="Sons" />} />
      </Group>
      <Segmented label="Mode" value={mode} onChange={setMode} options={[{ value: 'ilot', label: 'Menu' }, { value: 'direct', label: 'Direct' }]} />
      <div className="ft-mini-actions"><Button variant="primary">Continuer</Button><Button>Plus tard</Button></div>
    </div>
  );
}

export default function Catalog() {
  useThemedHeroPortal();
  const [globalOn, setGlobalOn] = useState(false);
  const controls = useControls();
  return (
    <div className="lab-page-inner cat-page">
      <header className="cat-head">
        <div>
          <h1>Composants</h1>
          <p className="lab-page-lead">Chaque contrôle des Réglages et du setup, en trois versions vivantes : nos primitives (Radix), shadcn/ui et HeroUI. Toutes prennent la palette et le thème choisis en haut. Votez pour celle que vous voulez voir dans l’app. « Repères » dessine le centre de la forme (croix pointillée) et celui du rond ou de l’icône (croix pleine), et mesure l’écart.</p>
        </div>
        <CentringToggle on={globalOn} onChange={setGlobalOn} label={globalOn ? 'Masquer tous les repères' : 'Afficher tous les repères'} />
      </header>

      <nav className="cat-toc" aria-label="Contrôles">
        {controls.map(c => <a key={c.id} href={`#cat-${c.id}`} onClick={e => { e.preventDefault(); document.getElementById(`cat-${c.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>{c.title.split(' (')[0]}</a>)}
      </nav>

      <ChosenPrimitives />

      {controls.map(c => (
        <section key={c.id} id={`cat-${c.id}`} className="cat-section">
          <h2>{c.title}</h2>
          <p className="cat-question">{c.question}</p>
          <div className="lab-grid-3 cat-grid">
            {['ours', 'shadcn', 'hero'].map(k => <Candidate key={k} control={c} kind={k} card={c.cards[k]} globalOn={globalOn} />)}
          </div>
        </section>
      ))}

      <section className="cat-section">
        <h2>HeroUI avec son propre style</h2>
        <p className="cat-question">Pour mémoire : HeroUI tel qu’il sort de la boîte (en haut), puis branché sur nos couleurs (en bas).</p>
        <div className="lab-grid cat-grid">
          <Variant id="catalog.heroui-proof" label="HeroUI brut et HeroUI à nos couleurs" description="CSS isolé sous .heroui-scope : il ne peut rien restyler d’autre." section="catalog">
            <HeroButtonProof />
          </Variant>
        </div>
      </section>
    </div>
  );
}
