# Labo Réglages — premier lancement, démo, Réglages

Labo de design (pas du code de l’app), **v2** : il converge sur les choix de Lucas (30/09). Une seule
structure (celle de « Verre » : barre latérale fixe et sobre, rangées groupées en cartes), **deux matières**
(fenêtre mate / vrai verre pour ce qui flotte), **une couleur par page**. Restent à trancher, dans la barre du
labo (ligne « À trancher », avec 👍/👎 et note) : **base neutre** Porcelaine ou Papier, **jeu de couleurs par
page** A ou B, **interrupteur** nos primitives ou HeroUI. Un bureau Windows 11 simulé où les fenêtres sont à
taille réelle, un serveur simulé, des votes et « Copier mes choix ».
Le tout sort en **une seule page** autonome : `labo-reglages.html` (JS et CSS en ligne, aucun réseau).

## Construire, ouvrir, vérifier

```sh
cd design-lab/reglages
npm install                 # une fois (dépendances locales à ce dossier)
node build.mjs              # → labo-reglages.html (+ dist/labo-reglages.artifact.html)
node build.mjs --watch      # reconstruit à chaque modification de src/
npx http-server . -p 5180 -c-1   # http://127.0.0.1:5180/labo-reglages.html  (jamais le port 5173)
node scripts/shots.mjs [--out=dossier] [--only=nom,nom]   # captures Playwright (voir SHOTS dans le fichier)
node scripts/contrast.mjs [-v] [--table]   # 2 bases + couleurs de page A/B, 2 thèmes (0 échec attendu)
node scripts/demo-shots.mjs [--out=dossier] [--times=…] [--theme=light,dark] [--crop=full|stage|ilot|text|words|cursor] [--dpr=2] [--marks=…] [--preset=…] [--reduced]
node scripts/demo-chaos.mjs [--out=dossier] [--rounds=3]   # la démo secouée puis comparée pixel à pixel à une page neuve
node scripts/demo-check.mjs               # les valeurs de l’app recopiées par la démo n’ont pas dérivé
```

- La page s’ouvre aussi en `file://` (double-clic).
- **Publication claude.ai** : publier `dist/labo-reglages.artifact.html` (même page sans `<!doctype>/<html>/<head>` :
  le lecteur d’artefacts fournit le squelette). Taille actuelle ≈ 1,8 Mo (limite 16 Mo).
- Pas d’`alert/confirm/prompt` (bloqués dans l’artefact). Presse-papiers : seulement dans un gestionnaire de clic,
  avec repli (`copyText()` de `src/lab/copy.js`, puis boîte de dialogue « copiez à la main »).
- Captures : par défaut dans `design-lab/reglages/shots/` (`shell/`, `demo/frames/`, `demo/chaos/`, ignoré par Git) ; `--out=dossier` pour
  écrire ailleurs plutôt que de copier un script. Les scripts trouvent la racine du repo depuis leur propre emplacement
  et chargent `@playwright/test` depuis le `node_modules` racine (`npm ci` à la racine) : ils se lancent de n’importe où.
  État du labo dans `localStorage`, clé **`ft-labo-reglages-v2`** : `{ section, base, pageSet, switchStyle, theme, speed, reduced, scenario }`.
- **Boucle obligatoire (Lucas, 30/09)** : pour chaque animation, effet ou correctif : modifier → capturer → REGARDER la
  capture (images intermédiaires à vitesse ⅒, recadrages DPR 2) → revoir → valider. Tester aussi la robustesse : serveur
  qui ne répond pas pendant qu’on clique ailleurs, double clic, Échap ou changement de page en pleine animation,
  changement de thème ou de scénario pendant une vérification. Rien ne doit rester bloqué, décalé ou en double.

## Carte

```
src/
  main.jsx, App.jsx        coque : barre du labo + section courante (chaque section isolée par une ErrorBoundary)
  brand.js                 appName (nom provisoire, À LIRE PARTOUT), raccourci par défaut, actions de l’Îlot
  lab/                     [coque] état, barre d’outils, votes, copie, Scope
  tokens/                  [coque] palettes.js (bases, couleurs par page), tokens.css (géométrie, 2 matières, typo), index.js
  ui/                      [coque] primitives partagées (Radix, cmdk, motion, Lucide) + ui/shadcn/
  stage/                   [coque] bureau simulé (Stage, Taskbar, AppMark) et AppWindow
  lib/motion.js            [coque] ressorts Apple, tx(), wait(), animate() — suivent Vitesse et Mouvement réduit
  lib/spring.js, cn.js     solveur de ressort (copié du labo Îlot), cn() de shadcn
  mock/server.js           [coque] serveur OpenAI simulé, normalizeEndpoint, journal de diagnostic
  heroui/                  [coque] HeroUI v3 isolé (HeroScope, HeroPortal, preuve)
  connection/              formulaire de connexion partagé  → propriétaire : agent Réglages
  journey/Journey.jsx      PARCOURS (installeur → accueil → questions → démo → Réglages) → agent Parcours
  demo/Demo.jsx            DÉMO animée, jouée avec le code de l’app (app.js, timeline.js)  → agent Démo
  settings/SettingsWindow.jsx  RÉGLAGES (fenêtre 860 × 600, barre latérale, Diagnostic caché) → agent Réglages
  catalog/Catalog.jsx      COMPOSANTS (primitives, shadcn, HeroUI, comparaisons)       → agent Composants
  catalog/Chosen.jsx       « Primitives retenues » en clair + sombre (planche de la coque, en tête de Composants)
  effects/Effects.jsx      EFFETS : seulement les effets retenus (battement et anneau, fondu et échelle, ressort W11,
                           voile au survol, vraie trace balayage → repliée, repli vers la barre, apparition en place)
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
| `connection/Connection.jsx` | `Connection`, `useProbe`, `ConnectionCheck` (ligne « ● Connecté · modèle · ms  Détails ▾ » + trace « balayage » qui se replie, ouverte sur l’erreur), `useCheck` / `CheckLine` / `CheckTrace` (la même, en deux morceaux), `ProbeTrace`, `InsecureNotice` (nommés) | importé par le Parcours (question « Votre modèle ») et les Réglages (Serveur) |

« Recommencer » remonte la section (nouvelle `key`) : gardez l’état dans vos composants.
Pour une page à classe `lab-page-inner` (Catalog, Effects) : `.lab-grid`, `.lab-grid-3`, `h1`, `h2`, `.lab-page-lead` sont prêts.

## Jetons de design (`--ft-*`)

Posés par `<Scope>` sur l’élément qui porte `data-ft-palette` (base neutre), `data-ft-pageset`, `data-ft-theme`,
`data-ft-reduced` (et `data-ft-dir="verre"`, gardé pour le CSS v1 : il n’y a plus d’autre direction). La racine du
labo en est un ; imbriquez `<Scope base="papier" theme="dark" pageSet="B">` pour comparer côte à côte (`page="serveur"`
pose `data-ft-page` sur le scope). **N’écrivez aucune couleur ni rayon en dur : utilisez ces variables.**
`useScope()` → `{ base, pageSet, switchStyle, theme, reduced }` ; `useLab()` → idem + `speed`, `scenario`, `set()`…
(`palette` = `base` et `direction` = `'verre'` restent lisibles pour le code v1.)

- **Base neutre** (`PALETTES` = `BASES`) : Porcelaine & lavande, Papier & corail. `--ft-accent`, `--ft-accent-hover`,
  `--ft-accent-text`, `--ft-on-accent`, `--ft-accent-soft`, `--ft-accent-rgb`, `--ft-bg`, `--ft-surface`, `--ft-sidebar`,
  `--ft-field` (+ `-rgb`), `--ft-text`, `--ft-text-2`, `--ft-text-3`, `--ft-ink-rgb`, `--ft-ok|warn|danger|info` (+ `-rgb`),
  `--ft-wall-1…4` (fond d’écran), `--ft-tile-1…8` (décor seulement : plus de tuiles d’icônes).
- **Une couleur par page** : sur tout élément `data-ft-page="<id>"` (`general`, `raccourcis`, `actions`, `apres`,
  `apparence`, `serveur`, `donnees`, `diagnostic`) : `--ft-page` (teinte ≥ 3:1 : icône, pastille), `--ft-page-rgb`,
  `--ft-page-text` (texte ≥ 4,5:1, aussi dans la pastille), `--ft-page-soft` (pastille), `--ft-page-veil` (voile).
  `<span className="ft-page-veil" />` pose le voile en haut d’une page (parent `position: relative`). Hors page : l’accent.
  Jeu **A « vives »** : ardoise, corail, lavande, bleu, ambre, vert d’eau, prune, console (mono). Jeu **B « poudrées »** :
  même luminosité et même intensité pour chaque page, aucune ne crie plus fort (graphite, abricot, iris, azur, miel,
  sauge, framboise, console). **Setup** : `TOPIC_PAGE` donne la page de chaque question (`apparence→apparence`,
  `raccourci→raccourcis`, `modele→serveur`, `demo→actions`, accueil / prêt → `general`).
  JS : `pageColor(set, page, base, theme)` → `{ name, hue, text }`.
- **Deux matières** :
  - *fenêtre* (mate, opaque, nette, sans reflet ni flou) : `--ft-win-bg(-solid)`, `--ft-win-border`, `--ft-win-shadow`,
    `--ft-sidebar-bg`, `--ft-sidebar-border`, `--ft-content-bg`, `--ft-group-bg|border|shadow`, `--ft-row-divider(-inset)`,
    `--ft-popover-*`. Réglages, installeur, dialogues, listes déroulantes.
  - *flottante* = **vrai verre** (flou réel de ce qui est derrière + saturation, liseré lumineux fin, grain) : classe
    **`.ft-glass`** ou `<AppWindow material="floating">`. Jetons `--ft-float-tint|blur|edge|rim|shadow|grain`, `--ft-r-float`.
    Îlot, pilule de résultat, bulle, accueil / setup, calques de la démo. Jamais un dégradé peint.
- **Interaction, géométrie, typo** : `--ft-hover`, `--ft-pressed`, `--ft-line(-strong)`, `--ft-focus`, `--ft-field-border`,
  `--ft-r-window|group|control|button|nav`, `--ft-control-h`, `--ft-button-h(-lg|-xl)`, `--ft-row-*`, `--ft-page-px|pt`,
  `--ft-sidebar-w`, `--ft-nav-h`, `--ft-font(-display|-mono)`, `--ft-title-*`, `--ft-body-size`, `--ft-sw-*`,
  `--ft-scroll-thumb(-hover)`.
- `scripts/contrast.mjs` : 796 contrôles, 0 échec (texte ≥ 4,5:1, accent et teintes ≥ 3:1, texte dans la pastille
  ≥ 4,5:1 ; deux bases, deux jeux, deux thèmes).

## Primitives (`src/ui/index.jsx`), selon les votes de Lucas

`Button` (primary / secondary / ghost / danger ; sm / md / lg / xl ; `icon`, `iconEnd`, `busy`, `block`),
`IconButton` (`label` obligatoire, `round`), `Spinner`, `Tooltip` (`content`), `Select`, `Popover`, `Segmented`,
`Field`, `Input`, `Group`, `Row` (`stack` : contrôle sous le texte, pleine largeur), `PageHeader`, `StatusDot`,
`Keycap`, `KeyCombo`, `Dialog` (fenêtre mate), et :

- **`Switch`** : le nôtre, « Ressort Windows 11 ». Le réglage « Interrupteur » de la barre le remplace partout par le
  **vrai HeroUI v3** (à nos couleurs) ; `variant="ours" | "hero"` force l’un ou l’autre.
- **`Combobox`** (liste des modèles, façon HeroUI) : au moins la largeur du champ, s’élargit jusqu’à 480 px, arrondie,
  recherche pleine largeur, identifiants complets qui passent à la ligne. Le champ coupe au milieu (`MiddleEllipsis`),
  identifiant complet en infobulle.
- **`Slider`** : aspect shadcn (piste 6 px, pastille blanche cerclée d’accent, halo au survol).
- **`Tabs` / `TabList` / `Tab` / `TabPanel`** (barre latérale) : une pastille unique **glisse** de l’ancienne page à la
  page cliquée (ressort court `NAV_GLIDE`, léger délai), en passant sur les entrées intermédiaires, teintée par la couleur
  de la page. Elle ne suit **jamais** la souris : le survol est une teinte légère à part. Chaque `Tab` porte
  `data-ft-page` = sa valeur (ou `page`) : son icône prend la couleur de sa page. La prop `tile` v1 est ignorée.
- **`ScrollArea`** : la seule barre de défilement. Pouce fin 6 px (10 px au survol), arrondi, apparaît au défilement
  ou au survol, sans flèches ; le contenu s’estompe au bord qui a encore de la matière (`shadows` true | 'top' |
  'bottom' | false). `viewportRef`, `onScroll`, `maxHeight`. Filet de sécurité : sous `.ft-scope`, toute autre zone qui
  défile a une barre fine arrondie sans flèches, jamais la grise native.
- **`SecretInput`** : plus de texte « Protégée par Windows » ; un petit bouclier vert, son infobulle = `note`.
- **`Notice`** (bannière info / ok / warn / error ; `title`, `text` ou enfants, `action`).

`ICON = { size: 16, strokeWidth: 1.5 }`. Règle de centrage : tout ce qui est rond est une cellule `display: grid;
place-items: center` de taille paire. Mesuré sur la planche « Primitives retenues » : 74 glyphes, 0 écart ≥ 0,5 px,
interrupteurs concentriques dans les deux états.

Les popovers passent par `usePortalContainer()` (hôte de portail du `Scope`) pour hériter des jetons.
**Ne créez pas de `Scope` avec son propre hôte à l’intérieur du `Stage`** (mis à l’échelle par transform, ce
qui décale les popovers) : `portal={false}` dans ce cas.

## Bureau et fenêtres (`src/stage/`)

```jsx
<Stage focus={{ w: 560, h: 620 }} onTray={…} trayActive trayBadge>
  <AnimatePresence>{open && <AppWindow key="setup" width={560} height={620} material="floating" controls={['close']}>…</AppWindow>}</AnimatePresence>
</Stage>
```
- Bureau virtuel 1280 × 800 (barre des tâches 48 px), mis à l’échelle pour tenir. Sous 700 px de large
  (téléphone) : une petite fenêtre `focus` (≤ 700 px, le setup) tient en entier ; une grande (Réglages, démo) garde
  une échelle ≥ 0,8 et se fait glisser ; la barre des tâches laisse place à un bouton flottant, et un panneau
  latéral se rend sous la fenêtre via `createPortal(…, useDesktop().asideEl)`.
  `useDesktop()` → `{ W, H, taskbarH, scale, narrow, asideEl, workArea }`. Les enfants se placent en pixels du bureau.
- `AppWindow` : barre de titre 32 px par-dessus le contenu (variable `--ft-titlebar-h`), boutons Windows 11,
  `material="window"` (défaut, mate) ou `"floating"` (vrai verre sur le bureau net ; anciens noms `solid` / `frost`
  acceptés), entrée/sortie en ressort.
- Fond d’écran : « Bloom » Windows 11 (`<Wallpaper />`, pétales nets à liseré clair) aux couleurs de la base, pour que
  le verre montre vraiment le flou de ce qu’il y a derrière.
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
`http://` accepté pour tout hôte : `insecure: true` hors de cet ordinateur, à signaler avec
`<Notice kind="warn" {...UNENCRYPTED_WARNING} />`, « Connexion non chiffrée ») ;
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
État mémorisé dans `localStorage` (`ft-labo-reglages-v2`), lu/écrit sous try/catch. Votes de la ligne « À trancher » :
`shell.base.<porcelaine|papier>`, `shell.pageset.<A|B>`, `shell.switch.<ours|hero>`.

## Démo : le comportement de l’app, pas un dessin (`src/demo/`)

Règle de Lucas (30/09) : la démo montre **exactement** ce que fait l’app. Elle importe donc le code de l’app
(`src/demo/app.js`) et n’en redessine rien :

| Ce qu’on voit | D’où ça vient (dépôt de l’app) |
|---|---|
| Îlot compact, grille, pilule de travail, coche + Annuler, coche seule | DOM de `src/menu/Ilot.tsx` et `src/result/ResultPill.tsx`, CSS `src/menu/ilot.css`, `src/result/result.css` importés tels quels |
| Entrée, sortie, changements de forme, fondu des contenus | ressorts et courbes de `src/motion/tokens.ts` (Fluide / Rebondi), solveur `src/motion/spring.ts`, règles de `presence.ts`, `MorphSurface.tsx`, `surface.ts` |
| Place de l’Îlot : 8 px sous la dernière ligne, bord droit sur la fin de la sélection ; la grille s’ouvre à droite du compact | `src-tauri/src/placement.rs:14-32`, `src/layout.ts` (`ilotMenuShift`), `IlotStage.tsx:194-237` |
| La pilule glisse sous le nouveau texte (420 ms) | `placement.rs:78-99` (`pill_after_paste`), `IlotStage.tsx:514-526`, `surfaceMove` |
| Survol 450 ms du ✦ → grille ; tuile survolée surlignée | `ilotMetrics.hoverMs`, `Ilot.tsx:220, 243`, `ilot.css:25` |
| Perle après 250 ms, fondu 150 ms | `src/loaders/pill.ts`, `loaders.css` |
| Halo : cadre + bandes + calque (menu), aurore + reflet sur les lettres (travail), vague puis mots changés (collage) | `src/halo/halo.css`, `geometry.ts` importés ; rectangles comme Rust les envoie (lignes exactes, lignes entières, zone de texte) |
| Mots marqués | le vrai diff : `changedRanges` de `src/result/highlight.ts` (convenu, chiffres, clairs) |
| Anneau d’Annuler (8 s, arrêté sous la souris), clic dans le texte → Annuler retiré, coche seule 1,1 s, marques parties en 900 ms | `countdown.ts`, `IlotStage.tsx:426-442`, `halo.css:77` |

Valeurs **recopiées** (modules qui tirent le pont Tauri ou une vue des Réglages), avec leur fichier:ligne dans
`app.js` : `HALO_APPEAR_DELAY_MS`, `CHECK_ONLY_MS`, `UNDO_MS`, `UNDONE_MS`, `MARKS_OUT_MS`, `HALO_FADE_MS`,
`WAVE_MS`, `MARK_IN`, `CHECK_DRAW`, `PILL_GAP`. `scripts/demo-check.mjs` échoue si l’app les change. Les variables
de thème (`src/theme.css:13-39, 111-127`) et `.shape-clip / .shape-layer` (`src/glass.css:131-133`) sont recopiées
dans `src/demo/app-theme.css`. Le build (`build.mjs`, greffon `app-modules`) résout react / motion / lucide des
fichiers de l’app depuis ce dossier et réécrit `:root[` en `.dm-app[` dans leur CSS (thème et mouvement réduit
portés par l’élément `.dm-app` de la démo).

- **Temps** : `timeline.js` fait de tout ça une fonction pure du temps (`scene(t)`) : lecture, pause, curseur de
  lecture, rejeu, aperçu du bandeau et vitesse du labo donnent la même image. Les boucles CSS de l’app (aurore,
  reflet, Perle, vague, coche) sont calées sur t (pause + délai négatif). Rien ne peut rester à mi-chemin :
  `demo-chaos.mjs` le vérifie (3 × 26 actions au hasard, puis 9 instants comparés à une page neuve).
- **Scénario** (Lucas a compté les images) : fenêtre de courrier → sélection **mot à mot en 1,8 s** → touches sous la
  fenêtre, allumées l’une après l’autre → l’Îlot s’ouvre sous la fin de la sélection (vraie ouverture) → le pointeur
  se pose sur ✦, la grille se déplie → Corriger → pilule de travail + halo sur le texte → collage : vague, mots
  changés, coche + Annuler sous le nouveau texte → survol d’Annuler (l’anneau s’arrête) → clic dans le texte :
  les marques partent, la coche seule, puis l’Îlot part.
- **Curseur** : flèche Windows (corps noir, liseré blanc), lueur bleue qui **suit son contour** (copie dilatée et
  floutée de la forme), plus de disque ni d’anneau ; flèche ↔ barre en I sans fondu (comme Windows).
- **Mots changés** (ligne du haut de la section, avec vote) : *Actuel* (les marques de l’app, pour comparer) et trois
  propositions où **le texte lui-même** s’allume, sans cadre : *Encre irisée* (défaut : encre bleu → violet → rose le
  long des mots, léger halo qui suit les lettres), *Éclat* (encre plus profonde en clair, blanc en sombre, halo teinté,
  trait fin), *Reflet* (un reflet irisé traverse les lettres une fois, puis teinte calme). Même arrivée (après 380 ms,
  420 ms) et même départ (900 ms) que les marques de l’app. Contraste des mots changés sur le fond du courrier
  (#fbfbfb / #202020) : clair ≥ 5,2:1, sombre ≥ 7,4:1 pour chaque couleur utilisée. **Les marques de `src/halo`
  seront remplacées par le choix de Lucas.** Côté app, le halo est une fenêtre posée sur le texte d’une autre
  application : pour « allumer » les lettres, il faudra capturer les pixels sous les mots (Rust lit déjà la couleur du
  fond) et s’en servir de masque (`mask-image`) pour y peindre l’encre et la lueur. À valider côté natif.
- **Mouvement réduit** : diaporama des vrais états (9 images), dessinés avec les règles réduites de l’app
  (fondus seuls, formes d’un coup, halo immobile, marques sans fondu).
- `window.__demo` (section Démo seule) : `seek(t)`, `play()`, `pause()`, `T`, `SLIDES` pour les captures.

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
