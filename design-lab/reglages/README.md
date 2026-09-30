# Labo Réglages — premier lancement, démo, Réglages

Labo de design (pas du code de l’app) : **3 directions × 6 palettes × 2 thèmes**, un bureau Windows 11
simulé où les fenêtres sont à taille réelle, un serveur simulé, des votes 👍/👎 et « Copier mes choix ».
Le tout sort en **une seule page** autonome : `labo-reglages.html` (JS et CSS en ligne, aucun réseau).

## Construire, ouvrir, vérifier

```sh
cd design-lab/reglages
npm install                 # une fois (dépendances locales à ce dossier)
node build.mjs              # → labo-reglages.html (+ dist/labo-reglages.artifact.html)
node build.mjs --watch      # reconstruit à chaque modification de src/
npx http-server . -p 5180 -c-1   # http://127.0.0.1:5180/labo-reglages.html  (jamais le port 5173)
node scripts/shots.mjs [dossier] [--only=nom,nom]   # captures Playwright (voir SHOTS dans le fichier)
node scripts/contrast.mjs [-v]   # contrôle des contrastes de toutes les palettes (0 échec attendu)
```

- La page s’ouvre aussi en `file://` (double-clic).
- **Publication claude.ai** : publier `dist/labo-reglages.artifact.html` (même page sans `<!doctype>/<html>/<head>` :
  le lecteur d’artefacts fournit le squelette). Taille actuelle ≈ 1,2 Mo (limite 16 Mo).
- Pas d’`alert/confirm/prompt` (bloqués dans l’artefact). Presse-papiers : seulement dans un gestionnaire de clic,
  avec repli (`copyText()` de `src/lab/copy.js`, puis boîte de dialogue « copiez à la main »).
- Captures : `C:\Users\agent\AppData\Local\Temp\claude\D--src\a9e04c7f-6ece-5d86-980b-e4bfe3913ac5\scratchpad\labo-shots\<votre-zone>\`.

## Carte

```
src/
  main.jsx, App.jsx        coque : barre du labo + section courante (chaque section isolée par une ErrorBoundary)
  brand.js                 appName (nom provisoire, À LIRE PARTOUT), raccourci par défaut, actions de l’Îlot
  lab/                     [coque] état, barre d’outils, votes, copie, Scope
  tokens/                  [coque] palettes.js (couleurs), directions.css (géométrie, matière, typo), index.js
  ui/                      [coque] primitives partagées (Radix, cmdk, motion, Lucide) + ui/shadcn/
  stage/                   [coque] bureau simulé (Stage, Taskbar, AppMark) et AppWindow
  lib/motion.js            [coque] ressorts Apple, tx(), wait(), animate() — suivent Vitesse et Mouvement réduit
  lib/spring.js, cn.js     solveur de ressort (copié du labo Îlot), cn() de shadcn
  mock/server.js           [coque] serveur OpenAI simulé, normalizeEndpoint, journal de diagnostic
  heroui/                  [coque] HeroUI v3 isolé (HeroScope, HeroPortal, preuve)
  connection/              formulaire de connexion partagé  → propriétaire : agent Réglages
  journey/Journey.jsx      PARCOURS (installeur → accueil → questions → démo → Réglages) → agent Parcours
  demo/Demo.jsx            DÉMO animée                                                  → agent Démo
  settings/SettingsWindow.jsx  RÉGLAGES (fenêtre 860 × 600, barre latérale, Diagnostic caché) → agent Réglages
  catalog/Catalog.jsx      COMPOSANTS (primitives, shadcn, HeroUI, comparaisons)       → agent Composants
  effects/Effects.jsx      EFFETS (battement, verre, ressorts, transitions, indicateurs) → agent Effets
```

Les fichiers des 5 sections sont aujourd’hui des **échantillons provisoires** : leur propriétaire les remplace
librement. Les dossiers marqués [coque] sont partagés : **ne pas les modifier** ; s’il manque quelque chose,
créez-le dans votre dossier (ou demandez-le à l’orchestrateur dans votre rapport).

## Points d’extension (exports fixes)

| Fichier | Export par défaut | Rendu où |
|---|---|---|
| `journey/Journey.jsx` | `Journey()` | pleine zone ; **rend son propre `<Stage>`** (pilote l’icône de la barre, la fenêtre mise au point, les enchaînements) |
| `demo/Demo.jsx` | `Demo({ standalone, onDone, autoPlay = true })` | **dans** un `<Stage>` (la section Démo l’enveloppe ; le Parcours le met dans le sien). Appeler `onDone()` à la fin |
| `settings/SettingsWindow.jsx` | `SettingsWindow({ standalone, initialPage, onClose, …props d’AppWindow })` | une `<AppWindow>` 860 × 600 dans un `<Stage>` ; utilisé par la section Réglages et par le Parcours |
| `catalog/Catalog.jsx` | `Catalog()` | page qui défile (`.lab-page`), pas de bureau |
| `effects/Effects.jsx` | `Effects()` | page qui défile, pas de bureau |
| `connection/Connection.jsx` | `Connection`, `useProbe`, `ProbeTrace` (nommés) | importé par le Parcours (question « Votre modèle ») et les Réglages (Serveur) |

« Recommencer » remonte la section (nouvelle `key`) : gardez l’état dans vos composants.
Pour une page à classe `lab-page-inner` (Catalog, Effects) : `.lab-grid`, `.lab-grid-3`, `h1`, `h2`, `.lab-page-lead` sont prêts.

## Jetons de design (`--ft-*`)

Posés par `<Scope>` sur l’élément qui porte `data-ft-dir`, `data-ft-palette`, `data-ft-theme`, `data-ft-reduced`.
La racine du labo en est un ; imbriquez un `<Scope direction="mat" palette="papier" theme="dark">` pour comparer
côte à côte (Catalog le fait). **N’écrivez aucune couleur ni rayon en dur : utilisez ces variables**, sinon
votre écran ne suivra pas la barre du labo.

- **Couleurs (palette)** : `--ft-accent`, `--ft-accent-hover`, `--ft-accent-text` (accent lisible en texte ≥ 4,5:1),
  `--ft-on-accent` (texte sur accent), `--ft-accent-soft`, `--ft-accent-rgb`, `--ft-accent-deep`,
  `--ft-bg`, `--ft-surface`, `--ft-sidebar`, `--ft-field` (+ `-rgb` pour bg/surface/sidebar), `--ft-text`, `--ft-text-2`,
  `--ft-text-3`, `--ft-ink-rgb` (pour `rgb(var(--ft-ink-rgb) / .08)`), `--ft-ok`, `--ft-warn`, `--ft-danger`, `--ft-info`,
  `--ft-tile-1…8` + `--ft-on-tile-1…8` (tuiles d’icônes), `--ft-wall-1…4` (fond d’écran).
- **Interaction** : `--ft-hover`, `--ft-pressed`, `--ft-line`, `--ft-line-strong`, `--ft-quiet`, `--ft-focus`, `--ft-field-border`.
- **Géométrie (direction)** : `--ft-r-window`, `--ft-r-group`, `--ft-r-control`, `--ft-r-button`, `--ft-r-nav`, `--ft-r-tile`,
  `--ft-control-h`, `--ft-button-h(-lg|-xl)`, `--ft-row-py`, `--ft-row-px`, `--ft-row-min`, `--ft-section-gap`,
  `--ft-page-px`, `--ft-page-pt`, `--ft-sidebar-w`, `--ft-nav-h`, `--ft-nav-icon`.
- **Typo** : `--ft-font`, `--ft-font-display`, `--ft-font-mono` (Segoe UI Variable Text / Display), `--ft-title-size/-weight/-tracking`,
  `--ft-hero-size/-weight`, `--ft-group-title-*`, `--ft-body-size`.
- **Matière** : `--ft-win-bg`, `--ft-win-bg-solid`, `--ft-win-blur`, `--ft-win-border`, `--ft-win-rim`, `--ft-win-shadow`,
  `--ft-win-sheen`, `--ft-sidebar-bg`, `--ft-group-bg`, `--ft-group-border`, `--ft-group-shadow`, `--ft-row-divider(-inset)`,
  `--ft-nav-active-*`, `--ft-secondary-bg`, `--ft-popover-*`, `--ft-key-*`, `--ft-sw-*` (interrupteur).
- Pour un écart de structure selon la direction : `[data-ft-dir="aerien"] .ma-classe { … }` (idem `data-ft-theme`).

Les 3 directions : **Verre** (continuité de l’Îlot, verre peint, reflet, rayons 14–16), **Mat** (opaque, sans ombre,
filets, noir/blanc francs, rayon 8, grands titres gras, rangées Windows 11), **Aérien** (sans bordure, grande typo,
tuiles colorées façon iOS, interrupteur iOS). Les 6 palettes : Encre & glacier, Graphite & chartreuse,
Porcelaine & lavande, Papier & corail, Sauge & cuivre, Nuit & menthe (`scripts/contrast.mjs` : texte ≥ 4,5:1,
accent ≥ 3:1, texte sur accent ≥ 4,5:1, pictos sur tuiles ≥ 3:1, dans les deux thèmes).

Chaque direction a aussi sa **structure** (pas seulement ses jetons) :

| | Réglages (`SettingsWindow.jsx`, `nav`) | Setup (`Journey.jsx`, `layout`) |
|---|---|---|
| Verre | `sidebar` : barre latérale fixe + recherche, une page par sujet | `stack` : pile centrée, points de progression, « Retour » / « Passer » en haut |
| Mat | `breadcrumb` : barre latérale + fil d’Ariane ; un serveur ou une consigne s’ouvre en sous-page (façon Windows 11) | `bar` : assistant, « Étape n sur 4 » + segments, barre de pied « Retour · Passer · Continuer » |
| Aérien | `push` : liste d’accueil (carte de l’app, groupes de lignes), chaque ligne pousse sa page, « ‹ Réglages » revient (façon iOS) | `hero` : bandeau pleine largeur à la couleur de la question, grand titre aligné à gauche, bouton retour rond |

Échap ou Alt+← remonte d’un niveau (sous-page Mat, page poussée Aérien). Les pages lisent `nav`, `sub`,
`openSub`, `closeSub` dans `useSettings()`.

## Primitives (`src/ui/index.jsx`)

`Button` (primary / secondary / ghost / danger ; sm / md / lg / xl ; `icon`, `iconEnd`, `busy`, `block`),
`IconButton` (`label` obligatoire, `round`), `Spinner`, `Switch`, `Select`, `Combobox` (cmdk), `Popover`, `Slider`,
`Segmented` (ToggleGroup, pastille qui glisse), `Tabs` / `TabList` / `Tab` (`icon`, `tile` 1–8) / `TabPanel` (barre
latérale verticale), `Field`, `Input`, `SecretInput`, `useFieldId`, `Group`, `Row` (`icon`, `tile`, `control`,
`onClick`, `stack`), `PageHeader`, `StatusDot` (ok / error / warn / pending / running / idle), `Keycap`
(sm / md / lg / xl, `active`), `KeyCombo` (`keys`, `active` = nombre de touches enfoncées), `Dialog`.
`ICON = { size: 16, strokeWidth: 1.5 }` : Lucide trait fin, comme l’Îlot.

Règle de centrage : tout ce qui est rond est une cellule `display: grid; place-items: center` de taille paire.
L’interrupteur : pastille de taille fixe déplacée et mise à l’échelle **uniquement par transform** ; écart et
course calculés en CSS (`--ft-sw-*`). Mesuré : 22 interrupteurs × 3 directions, 76 icônes, écart 0,00 px.

Les popovers passent par `usePortalContainer()` (hôte de portail du `Scope`) pour hériter des jetons.
**Ne créez pas de `Scope` avec son propre hôte à l’intérieur du `Stage`** (mis à l’échelle par transform, ce
qui décale les popovers) : `portal={false}` dans ce cas.

## Bureau et fenêtres (`src/stage/`)

```jsx
<Stage focus={{ w: 560, h: 620 }} onTray={…} trayActive trayBadge>
  <AnimatePresence>{open && <AppWindow key="setup" width={560} height={620} material="frost" controls={['close']}>…</AppWindow>}</AnimatePresence>
</Stage>
```
- Bureau virtuel 1280 × 800 (barre des tâches 48 px), mis à l’échelle pour tenir. Sous 700 px de large
  (téléphone) : une petite fenêtre `focus` (≤ 700 px, le setup) tient en entier ; une grande (Réglages, démo) garde
  une échelle ≥ 0,8 et se fait glisser ; la barre des tâches laisse place à un bouton flottant, et un panneau
  latéral se rend sous la fenêtre via `createPortal(…, useDesktop().asideEl)`.
  `useDesktop()` → `{ W, H, taskbarH, scale, narrow, asideEl, workArea }`. Les enfants se placent en pixels du bureau.
- `AppWindow` : barre de titre 32 px par-dessus le contenu (variable `--ft-titlebar-h`), boutons Windows 11,
  `material="frost"` = fenêtre dépolie sur un bureau net (décision de Lucas), entrée/sortie en ressort.
- `AppMark` : le logo (point irisé de l’Îlot). `.ft-heartbeat` : le battement de l’accueil.

## Mouvement (`src/lib/motion.js`)

- CSS (transitions, `@keyframes`) : rien à faire, la barre ralentit tout (`playbackRate` des CSSTransition/CSSAnimation).
- motion : `const tx = useTx(); transition={tx('smooth')}` (`smooth`, `bouncy`, `snappy`, `gentle`, `window`,
  ou `tx(0.2)`, `tx({ duration, ease: 'out' })`) ; les durées sont multipliées par la vitesse.
- Minuteries / WAAPI : `wait(ms, signal)`, `animate(node, frames, { spring: 'smooth' })`, `springCss('smooth')` (CSS `linear()`).
- Mouvement réduit : `MotionConfig reducedMotion="always"` + `data-ft-reduced="true"` (filet CSS : transitions à 1 ms).
  Lire `useLab().reduced` pour remplacer un déplacement par un fondu. `data-ft-keep-motion` exempte un élément (courbes comparées).
- Seulement `transform` et `opacity` dans les animations (60 i/s).

## Serveur simulé (`src/mock/server.js`)

Scénario choisi dans la barre (« Serveur simulé ») : `ok`, `cle-requise`, `cle-refusee`, `pas-d-api` (404),
`refuse`, `delai` (annoncé 10 s, simulé 2,5 s), `certificat`, `dns`, `vide`, `lent`.
`probe({ url, key, noKey, signal, onStep })` → 4 étapes Adresse → Connexion → Clé → Modèles, chacune avec sa durée ;
`normalizeEndpoint(url)` (retire `/v1`, `/v1/models`, `/chat/completions`, `/` final ; ajoute `https://` ;
`http://` seulement pour localhost / 127.x / ::1 — sinon erreur « http:// est réservé à cet ordinateur ») ;
`modelOptions()`, `tryModel()`, `FAILURES` (textes cause + geste), `diagnostics` (`list`, `subscribe`, `clear`,
`toText('all'|'errors')`, 500 entrées, **jamais de texte utilisateur ni de clé** : 4 derniers caractères masqués).

## Votes et notes

```jsx
import { Vote, Variant } from '../lab/Vote.jsx';
<Vote id="settings.sidebar.tuiles" label="Barre latérale à tuiles colorées" section="settings" />
<Variant id="effects.heartbeat.double" label="Double battement" description="…" section="effects">…</Variant>
```
Identifiant `zone.chose[.variante]` (zones : journey, demo, settings, catalog, effects, shell). Le `label` est ce que
Lucas relit dans « Copier mes choix » (texte lisible + JSON) : il doit dire ce qu’est la variante.
État mémorisé dans `localStorage` (`ft-labo-reglages-v1`), lu/écrit sous try/catch.

## Bibliothèques

- **Radix** (switch, select, popover, slider, tabs, toggle-group, dialog, slot), **cmdk**, **motion**, **lucide-react**, React 19.
- **shadcn/ui** : Tailwind v4 précompilé (`src/tailwind.css` → `dist/tw.css`) **sans preflight**, préfixe `tw:` sur
  chaque utilitaire, couleurs shadcn branchées sur nos jetons. Modèle : `src/ui/shadcn/button.jsx` (copier un
  composant de ui.shadcn.com, préfixer chaque classe par `tw:`, garder `cn()` de `src/lib/cn.js`).
  Tailwind scanne `src/` : seules les classes `tw:` produisent du CSS.
- **HeroUI v3.2.6** (`@heroui/react`) : **oui, il se bundle avec esbuild dans la page statique** (preuve dans
  Composants › Bibliothèques). Son CSS est compilé sans preflight puis **toutes ses règles sont préfixées par
  `.heroui-scope`** (`scripts/scope-css.mjs` ; `:root` → le conteneur, thème `data-theme` sur le conteneur) : il ne
  peut rien restyler hors d’un `<HeroScope>`. `<HeroScope themed>` le branche sur nos couleurs. Ses superpositions
  vont dans un hôte `.heroui-scope` via `<HeroPortal>` (déjà posé dans App). Coût : ≈ 450 Ko de CSS.
  Pour ajouter des composants HeroUI utilisés, rien à faire (tout le CSS de HeroUI est inclus).
