// HeroUI v3.2.6 candidates (real @heroui/react components, React Aria underneath), mapped onto
// our tokens with <HeroScope themed>. Their overlays portal into the lab's HeroUI host; the
// Catalog adds `ft-heroui-themed` to that host while it is mounted (see useThemedHeroPortal).
import { useEffect, useMemo, useState } from 'react';
import {
  Button, Switch, Select, ListBox, Label, ComboBox, Input, Tabs, Slider, TextField, InputGroup, Description,
  ToggleButton, ToggleButtonGroup, Toast, ToastQueue, AlertDialog,
} from '@heroui/react';
import { Eye, EyeOff, Trash2, Settings2, Search, Keyboard, Sparkles, Server, Palette } from 'lucide-react';
import { HeroScope } from '../heroui/HeroDemo.jsx';

const I = { size: 16, strokeWidth: 1.5 };

// While the Catalog is shown, HeroUI popovers (Select, ComboBox, AlertDialog) render in the shell's
// portal host: give that host our colour mapping too, and take it back on unmount.
export function useThemedHeroPortal() {
  useEffect(() => {
    const host = document.querySelector('.ft-heroui-portal');
    if (!host) return undefined;
    const had = host.classList.contains('ft-heroui-themed');
    host.classList.add('ft-heroui-themed');
    return () => { if (!had) host.classList.remove('ft-heroui-themed'); };
  }, []);
}

export function HeroSwitchDemo() {
  const [a, setA] = useState(true);
  const [b, setB] = useState(false);
  return (
    <HeroScope themed>
      <div className="cat-row">
        <Switch isSelected={a} onChange={setA} aria-label="Démarrer avec Windows"><Switch.Control><Switch.Thumb /></Switch.Control></Switch>
        <Switch isSelected={b} onChange={setB} aria-label="Sons"><Switch.Control><Switch.Thumb /></Switch.Control></Switch>
        <Switch isSelected isDisabled aria-label="Désactivé"><Switch.Control><Switch.Thumb /></Switch.Control></Switch>
        <Switch size="lg" isSelected={a} onChange={setA} aria-label="Grand"><Switch.Control><Switch.Thumb /></Switch.Control></Switch>
      </div>
    </HeroScope>
  );
}

export function HeroSelectDemo({ options, value, onChange }) {
  return (
    <HeroScope themed>
      <Select className="cat-hero-w" selectedKey={value} onSelectionChange={k => k != null && onChange(String(k))} placeholder="Choisir">
        <Label>Langue de l’interface</Label>
        <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
        <Select.Popover>
          <ListBox>
            {options.map(o => (
              <ListBox.Item key={o.value} id={o.value} textValue={o.label}>{o.label}<ListBox.ItemIndicator /></ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
    </HeroScope>
  );
}

export function HeroComboDemo({ options, value, onChange }) {
  return (
    <HeroScope themed>
      <ComboBox className="cat-hero-w" selectedKey={value} onSelectionChange={k => k != null && onChange(String(k))} menuTrigger="focus">
        <Label>Modèle</Label>
        <ComboBox.InputGroup>
          <Input placeholder="Rechercher un modèle" />
          <ComboBox.Trigger />
        </ComboBox.InputGroup>
        <ComboBox.Popover>
          <ListBox>
            {options.map(o => (
              <ListBox.Item key={o.value} id={o.value} textValue={o.label}>
                <span className="cat-hero-opt"><span>{o.label}</span>{o.hint && <small>{o.hint}</small>}</span>
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </ComboBox.Popover>
        <Description>Liste lue sur votre serveur (/v1/models).</Description>
      </ComboBox>
    </HeroScope>
  );
}

const NAV = [
  { id: 'general', label: 'Général', icon: Settings2 },
  { id: 'raccourcis', label: 'Raccourcis', icon: Keyboard },
  { id: 'actions', label: 'Actions', icon: Sparkles },
  { id: 'apparence', label: 'Apparence', icon: Palette },
  { id: 'serveur', label: 'Serveur', icon: Server },
];
export function HeroTabsDemo() {
  const [tab, setTab] = useState('general');
  return (
    <HeroScope themed>
      <Tabs orientation="vertical" selectedKey={tab} onSelectionChange={k => setTab(String(k))} className="cat-hero-tabs">
        <Tabs.ListContainer>
          <Tabs.List aria-label="Réglages">
            {NAV.map(n => (
              <Tabs.Tab key={n.id} id={n.id}><span className="cat-tab-inner"><n.icon {...I} />{n.label}</span><Tabs.Indicator /></Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
        {NAV.map(n => <Tabs.Panel key={n.id} id={n.id} className="cat-tab-panel"><strong>{n.label}</strong><small>Page « {n.label} » des Réglages.</small></Tabs.Panel>)}
      </Tabs>
    </HeroScope>
  );
}

export function HeroSliderDemo({ value, onChange }) {
  return (
    <HeroScope themed>
      <Slider className="cat-hero-slider" minValue={3} maxValue={20} value={value} onChange={v => onChange(Array.isArray(v) ? v[0] : v)} formatOptions={{ style: 'unit', unit: 'second', unitDisplay: 'narrow' }}>
        <Label>Temps pour annuler</Label>
        <Slider.Output />
        <Slider.Track><Slider.Fill /><Slider.Thumb /></Slider.Track>
      </Slider>
    </HeroScope>
  );
}

export function HeroFieldsDemo() {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('sk-demo-7f3a');
  const [shown, setShown] = useState(false);
  return (
    <HeroScope themed>
      <div className="cat-stack">
        <TextField className="cat-hero-w" value={url} onChange={setUrl}>
          <Label>Adresse du serveur</Label>
          <Input placeholder="https://llm.exemple.com" />
          <Description>Juste l’adresse. Pas besoin de /v1.</Description>
        </TextField>
        <TextField className="cat-hero-w" value={key} onChange={setKey} type={shown ? 'text' : 'password'}>
          <Label>Clé API</Label>
          <InputGroup>
            <InputGroup.Input autoComplete="new-password" />
            <InputGroup.Suffix>
              <Button isIconOnly size="sm" variant="ghost" aria-label={shown ? 'Masquer la clé' : 'Afficher la clé'} onPress={() => setShown(s => !s)} className="cat-eye">
                {shown ? <EyeOff {...I} /> : <Eye {...I} />}
              </Button>
            </InputGroup.Suffix>
          </InputGroup>
          <Description>Protégée par Windows.</Description>
        </TextField>
      </div>
    </HeroScope>
  );
}

export function HeroButtonsDemo() {
  return (
    <HeroScope themed>
      <div className="cat-stack">
        <div className="cat-row"><Button variant="primary">Continuer</Button><Button variant="secondary">Annuler</Button><Button variant="ghost">En savoir plus</Button></div>
        <div className="cat-row"><Button variant="danger"><Trash2 {...I} />Effacer</Button><Button isPending variant="secondary">Vérification</Button><Button isDisabled>Désactivé</Button></div>
        <div className="cat-row"><Button size="lg" variant="primary">Commencer le setup</Button></div>
        <div className="cat-row"><Button isIconOnly variant="secondary" aria-label="Rechercher" className="cat-iconly"><Search {...I} /></Button><Button isIconOnly variant="primary" aria-label="Réglages" className="cat-iconly cat-round"><Settings2 {...I} /></Button></div>
      </div>
    </HeroScope>
  );
}

export function HeroSegmentedDemo({ value, onChange }) {
  const keys = useMemo(() => new Set([value]), [value]);
  return (
    <HeroScope themed>
      <ToggleButtonGroup aria-label="Thème" selectionMode="single" disallowEmptySelection selectedKeys={keys} onSelectionChange={s => { const v = [...s][0]; if (v) onChange(String(v)); }}>
        <ToggleButton id="system">Système</ToggleButton>
        <ToggleButton id="light">Clair</ToggleButton>
        <ToggleButton id="dark">Sombre</ToggleButton>
      </ToggleButtonGroup>
    </HeroScope>
  );
}

const queue = new ToastQueue({ maxVisibleToasts: 3 });
export function HeroToastDemo() {
  return (
    <HeroScope themed>
      <div className="cat-row">
        <Button variant="secondary" onPress={() => queue.add({ title: 'Réglages enregistrés', description: 'Ils s’appliquent tout de suite.', variant: 'success' }, { timeout: 4000 })}>Enregistré</Button>
        <Button variant="secondary" onPress={() => queue.add({ title: 'Serveur injoignable', description: 'Délai dépassé après 10 s.', variant: 'danger' }, { timeout: 5000 })}>Erreur</Button>
      </div>
      <Toast.Provider queue={queue} placement="bottom" />
    </HeroScope>
  );
}

export function HeroDialogDemo() {
  return (
    <HeroScope themed>
      <AlertDialog>
        <Button variant="danger"><Trash2 {...I} />Tout remettre à zéro</Button>
        <AlertDialog.Backdrop>
          <AlertDialog.Container>
            <AlertDialog.Dialog className="cat-hero-dialog">
              <AlertDialog.Header>
                <AlertDialog.Icon status="danger" />
                <AlertDialog.Heading>Tout remettre à zéro ?</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body><p>Raccourcis, actions et apparence reviennent aux valeurs d’origine. Votre serveur et votre clé restent.</p></AlertDialog.Body>
              <AlertDialog.Footer>
                <Button slot="close" variant="secondary">Annuler</Button>
                <Button slot="close" variant="danger">Remettre à zéro</Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </HeroScope>
  );
}
