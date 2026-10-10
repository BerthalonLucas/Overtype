# Boucle de validation visuelle

Ce document retrace les itérations du verre graphite, de la 0.1.x à la 0.4.0. Depuis le
24 septembre 2026, la direction artistique « Îlot » les remplace : plan, lots et valeurs
exactes dans docs/DA-PLAN.md, référence visuelle et de mouvement dans design-lab/, en cours
d’implémentation sur la branche `da-ilot`. Les durées, le graphite et l’indicateur d’attente
décrits ci-dessous sont historiques (mentions en ligne) ; la méthode (vraie fenêtre Windows
avant toute déclaration, preuves rejouables, jugement final de Lucas) reste valable.

## Reprise du 9 septembre 2026 (Claude Code, handoff design « 1a »)

Les trois livrables du handoff (bulle 1a, défilement, fenêtre Réglages) sont implémentés
dans les vrais composants : `GlassOverlay.tsx`, `ui.tsx`, `App.tsx`, `glass.css`, `styles.css`,
plus `placement`/`lib.rs` (agrandi ancré, commandes de la fenêtre Réglages, champ
`connectionExpanded`). Deux primitives Radix ont été ajoutées avec l’accord de Lucas :
`react-scroll-area` (indicateur de défilement) et `react-toggle-group` (segmentés).
Les 17 références visuelles ont été régénérées **parce que le design change**, après
revue des images produites ; elles décrivent le nouveau design, pas une validation de
Lucas. Le rendu Windows (acrylique réel, contraste sur page blanche, DPI 125/150 %,
fenêtre Réglages sans cadre) reste à observer sur le bureau.

## Deuxième retour du 10 septembre 2026 (capture d’écran de Lucas)

Quatre points : cadre gris derrière les surfaces (UI-008), bulle qui ne se replie pas
quand la souris sort (UI-009), animation de streaming laide (UI-010), confirmation
avant traduction au raccourci (UI-011). La capture GDI du bureau fonctionne désormais
hors sandbox (`scratchpad/shot.ps1`), ce qui permet d’observer le rendu réel.
Décisions : plus de matériau DWM (il ignore la région, doc Microsoft), verre `.92` ;
repli en onglet 44 × 20 au bord bas dans la même fenêtre (fenêtre ancrée par le bas,
`presentation: 'docked'`), la capsule n’est plus affichée ; fragments de texte qui
s’installent et point qui respire ; traduction immédiate, raccourci toujours capture.
Références visuelles régénérées (verre plus opaque, attente, texte des réglages).

## Troisième retour du 10 septembre 2026 (fluidité et bords)

Les contours ont disparu ; restent des bords « coupés au cutter », crénelés (UI-012) et un
streaming saccadé (UI-010, Lucas préfère une roue puis le texte d’un bloc). Diagnostic sans
capture (bureau inaccessible aux process de capture dans cette session) : la fenêtre est
déjà transparente par pixel (Tao, `DwmEnableBlurBehindWindow`), mais `SetWindowRgn`
découpait la boîte exacte du DOM avec un masque 1 bit : ombres supprimées, bordure
tranchée, arcs GDI en escalier, visibles pixel par pixel à 100 %. La région ne servait
qu’au hit-test. Décisions de Lucas : plus de région, halo d’ombre dans la fenêtre,
hit-test par sondage du curseur (`WS_EX_TRANSPARENT | WS_EX_LAYERED`, spike validé par
`WindowFromPoint` sur l’onglet réel) ; anneau puis verre qui s’ouvre en DOM pur avec un
seul resize natif ; repli, dépli et menu inchangés pour ce lot. Référence visuelle
`pending-*` régénérée (anneau).

## Retour en conditions réelles du 10 septembre 2026

Lucas a testé l’exécutable du 09-09 : la bulle et la capsule affichaient un titre
« FlowTranslate » en haut à gauche et des coins carrés, avec le texte brut de reqwest
(« error sending request for url … ») pour un serveur Qualité arrêté. Ce n’est pas le
mode démo : c’est UI-007 (registre), reproduit avec `scripts/inspect-native-windows.ps1`
sur le build démo (`--demo-clipboard`, CDP). Le clic sur la capsule appelait `show()`
de Tao, dont la reconstruction différée des styles remet WS_CAPTION et fait perdre la
région ; `host::hide` repassait aussi par Tao. Correctif : activation, masquage et
réparation au niveau HWND (`host::activate`, `host::repair_handle`), et message
d’erreur réseau lisible (`inference::unreachable_message`). Le probe natif vérifie
maintenant styles et région après affichage et après `focus_overlay`.

## Quatrième retour du 13 septembre 2026 (vidéo en conditions réelles)

Lucas a filmé 40 s d’usage réel de la 0.1.6 (capture presse-papiers, verre ancré en bas)
et relevé six points, consignés UI-013 à UI-018. Deux mécanismes dominent : un bandeau
de titre classique peint sur la fenêtre de la bulle à chaque changement d’activation
(UI-016 ; image par image, il apparaît dans la même image que la perte de focus et
persiste jusqu’au redimensionnement suivant) et un repli déclenché par la fermeture du
menu, le pointeur n’étant plus sur une surface (UI-018). Le bandeau a été reproduit le
soir même sur le bureau déverrouillé (`release/ui-evidence/band-repro/`) : le style ne
change jamais, c’est le repeint par défaut de `WM_NCACTIVATE` (Tao → `DefWindowProc`)
qui dessine une barre de titre basique dans la surface de la fenêtre ; le même message
envoyé avec lParam = -1 ne dessine rien, ce qui fixe le correctif (sous-classe du HWND). Les autres sont des réglages de
rythme et de design (anneau, cadrage du texte, menu, original).

Ce qui définit une interface fluide pour FlowTranslate, base des prochains lots :

1. Une seule fenêtre native par bulle, qui ne change ni de taille ni de style pendant une
   interaction : tout mouvement est une propriété composée (opacité, transform,
   clip-path) animée dans le DOM ; le redimensionnement natif n’a lieu qu’à l’arrivée du
   résultat. Le hit-test par régions le permet : une fenêtre plus grande que le verre ne
   coûte rien. (La DA Îlot garde la fenêtre réservée et anime aussi la largeur, la hauteur
   et le rayon de la surface dans le DOM : docs/DA-PLAN.md §4.3.)
2. Windows ne peint jamais rien : ni bandeau, ni cadre, ni fond (silhouette 100 % DOM).
3. Chaque transition a une durée et une courbe connues : entrée 180 ms, sortie 100 ms,
   survol 120 ms, anneau environ 1,4 s par tour ; rien n’est instantané, sauf sous
   mouvement réduit. (Historique pour les valeurs : ressorts Apple « smooth » et courbes
   de docs/DA-PLAN.md §9 ; l’anneau n’existe plus depuis la 0.2.0. Le principe d’une durée
   et d’une courbe connues pour chaque transition reste.)
4. L’interface ne disparaît jamais sous l’utilisateur : une action accorde un délai de
   grâce (2 s) ; la sortie du pointeur est jugée sur la silhouette et son halo, pas sur
   les boîtes serrées ; un retour rapide annule le repli.
5. Lecture : jamais de texte au ras d’un bord arrondi, coupures aux séparateurs,
   contraste d’au moins 4,5:1 pour l’original.
6. Réactivité : moins de 100 ms entre le geste et le premier retour visuel (menu, survol,
   Réglages).

### Lot « fluidité » 0.1.7 (13 septembre 2026)

Le lot applique les six critères en une fois, sans matériau natif nouveau.

- Natif : `host::silence_frame` sous-classe le HWND de la bulle et de la capsule et
  répond à `WM_NCACTIVATE` avec lParam = -1 (plus de bandeau, UI-016) ; le sondeur du
  curseur émet `glass-near` quand le curseur entre ou sort d’une zone de 32 px autour
  des surfaces ; la fenêtre est **réservée** : 484 × 758 ancrée en bas (menu au-dessus de
  la pilule, verre agrandi, onglet), plancher de 334 px ancrée au texte (menu sous la
  pilule), plafond 640 × 800. `host::show` est scindé en `place` (rectangle) et
  `set_regions` (surfaces) : repli, dépli, menu et arrivée d’un résultat compact ne
  coûtent plus aucun `SetWindowPos`. La décision dessus/dessous tient compte de la
  réserve, et seul le verre est contraint à la zone de travail : la réserve
  transparente peut la dépasser sans pousser le verre sur son ancre.
- Front : le corps du verre reste monté et se replie en fondu (opacité et 6 px de
  translation, `inert` aussitôt, `visibility: hidden` après le fondu) ; les régions
  sont projetées dans la fenêtre finale sans attendre de redimensionnement ; deux
  secondes de grâce après toute action, sortie jugée sur `glass-near` ; anneau à 1,4 s
  par tour avec un arc qui respire ; `<wbr>` après les séparateurs des longues
  séquences (`src/text.ts`) et marge de 22 px ; menu dans le graphite du verre ;
  original à 14 px sur fond clair. (Historique pour l’anneau et le menu graphite :
  remplacés par l’orbe Perle, l’Îlot et la matière de docs/DA-PLAN.md.)
- Preuves : Vitest (`text.test.ts`), Playwright (grâce, proximité, fenêtre constante
  entre repli, dépli et menu, coupures aux séparateurs, durées de l’anneau, corps replié
  `toBeHidden()`), `cargo test` (côté avec réserve, décalage des régions sur écran bas,
  `near`), références visuelles régénérées après inspection (`short`, `long`, `pending`,
  `menu`, `error`, `partial`, réglages pour le numéro de version), probe natif PASS avec
  le contrôle « frame silent » (`-Poke`, différence 0, rect inchangé, menu sans
  redimensionnement sur trois cycles), rejeu du protocole du bandeau sur le nouvel
  exécutable (`release/ui-evidence/band-replay-0.1.7` : scénario L différence 0 ;
  Réglages ouverts et fermés sous le watcher, 47 captures à luminance constante, un seul
  rect). Le jugement à l’œil de Lucas reste la dernière étape.

## Cinquième retour du 14 septembre 2026 (usage réel de la 0.1.7)

Lucas juge la 0.1.7 « mieux au global » et relève ce qui reste faux dans la boucle
*sélectionner → contrôler → lire → comprendre → laisser partir* : devoir faire Ctrl+C
avant le raccourci, une bulle qui reste trop longtemps, « Agrandir » inutile (un long
texte doit être grand d’office, en bande centrée en bas), un anneau trop petit pour la
fenêtre (il veut des « pointillés qui sautent »), un texte qui manque de finesse, et la
bande du bas qui doit suivre la souris d’un écran à l’autre. Conception UX faite par un
agent puis relue par un second ; décisions par questions fermées : Ctrl+C simulé en
repli, copie de moins de 3 s acceptée, lecteur à la moitié de la largeur de l’écran
courant (aucune valeur d’écran en dur), toujours en bas, fixe ; disparition rapide
(≈ 3–4 s) une fois la souris partie ; budget de lecture estimé puis fondu. Le travail se
fait désormais sur `BerthalonLucas/Flow_Translate` (toutes les branches poussées le
14/09, une pull request par lot).

### Lot « capture directe » 0.1.8 (14 septembre 2026)

- Le raccourci copie lui-même : sans sélection UIA, `capture::synthetic_copy` attend le
  relâchement de la corde du raccourci, envoie Ctrl+Insert (`host::send_copy_chord`,
  la corde de copie CUA, jamais SIGINT dans un terminal), attend le changement de
  `GetClipboardSequenceNumber`, lit le texte et remet l’ancien contenu texte sans
  alimenter Win+V ni les moniteurs du presse-papiers, seulement si personne n’a écrit
  entre-temps. Une copie faite par Lucas moins de 3 s avant reste traduite
  (`host::track_clipboard`, sondé par le surveillant, nos écritures exclues) ; sinon avis.
  Un ancien contenu non texte (image, fichiers) n’est pas restauré : documenté.
- Capture en deux temps : la fenêtre s’ouvre dès le texte et l’ancre ; les décalages du
  document et le contrôle Win32 arrivent ensuite (`complete_target`, événement
  `capture-target`) et décident de « Remplacer ».
- Plus de MessageBox : `show_notice` place la bulle en pilule seule (420 × 64, bas centre
  de l’écran du curseur, aucune surface cliquable, cachée après 4 s) ou, bulle ouverte,
  affiche l’avis comme retour d’action. `host::monitor` prend désormais l’écran du
  curseur pour toute capture sans ancre.
- Tray « Revoir la dernière traduction » : le dernier résultat complet est gardé 10 min
  après la fermeture et réaffiché sans inférence (`Capture.replay`).
- Preuves : `cargo test` (`fresh`), Vitest (`TARGET`), Playwright (pont IPC :
  `capture-target`, avis seul sans redimensionnement, avis dans le verre, rejeu sans
  `translate` ; atelier : scénario `notice`, défaut UI-020), références visuelles
  `notice-*`. Matrice réelle du 14/09 sur le build 0.1.8 (`scripts/capture-matrix.ps1`,
  table dans `docs/UI-ISSUES.md`, UI-019) : Bloc-notes et Chrome par UIA (≈ 450 ms,
  ancrés), VS Code par la copie synthétique (438 ms, presse-papiers restauré), copie de
  moins de 3 s acceptée dans le Bloc-notes sans sélection et dans Windows Terminal, avis
  au-delà. La matrice a révélé que l’Insert injecté devait être un scan code étendu
  (`KEYEVENTF_EXTENDEDKEY`), sinon Chromium lit Ctrl+Pavé0. Word, Outlook, Teams, Discord
  restent au jugement de Lucas.

### Lot « lecture calibrée » 0.2.0 (14 septembre 2026)

- Deux formes décidées une fois, sur le vrai texte (`src/layout.ts`, `src/GlassOverlay.tsx`) :
  attente en pilule seule (60 × 28, spinner de shadcn : `LoaderCircle` 18 px un tour par seconde, balayage après 1,5 s ; les trois points du premier jet, jugés hideux par Lucas, sont retirés) ; à
  l’arrivée du résultat, mesure hors écran à 380 px : ≤ 8 lignes → verre court déplié
  depuis la pilule (16/24) ; sinon lecteur en bande bas centre, large de la moitié de la
  zone de travail de l’écran courant, haute d’au plus 45 %, lignes entières (22/33). Plus
  de « Agrandir/Réduire », d’onglet ni de repli : le verre part de lui-même.
  (Historique pour le spinner : rejeté par Lucas le 23 septembre 2026 ; l’indicateur
  retenu est l’orbe Perle, lot 8 de docs/DA-PLAN.md. Les deux formes restent le
  comportement du mode « Afficher le résultat », restylé au lot 11.)
- Budget de lecture puis fondu : `readingBudget` (orientation + 350 ms par mot, 5 s à
  30 s / 90 s), réglage « Fermeture automatique », sortie de la souris après une visite
  → 4 s au plus, jamais moins de 2,5 s ; assombrissement 55 % en 600 ms, tenue 1,4 s,
  fondu 300 ms ; toute approche, molette ou touche rend 100 % et 5 s ; épingle dans la
  pilule du lecteur. Commande `overlay_dimming` : Échap redevient celui de l’utilisateur
  pendant l’assombrissement.
- Réglages « Taille du texte » (Normale 16/24 · 22/33, Grande 18/27 · 24/36, Très grande
  20/30 · 26/39) et « Fermeture automatique » (Rapide, Normale, Lente, Jamais),
  persistés (`text_size`, `auto_close`), lus par la bulle via `settings-changed`.
- Fenêtre et écrans (`lib.rs`, `host.rs`) : `Presentation::Anchored | Bottom`, plafond de
  `resize_overlay` = zone de travail courante, réserve par capture (444 × ≥ 334 ancrée ;
  bande + 64 × réserve menu + pilule + bande maximale en bas), `frame` = empreinte du
  verre ancrée par Rust dès la pilule d’attente ; `capture.screen` porte la zone logique
  et l’échelle. Les formes du bas prennent l’écran du curseur et le suivent : le sondeur
  relève `MonitorFromPoint`, `screen_changed` adopte le nouvel écran, émet `work-area`
  et replace la fenêtre ; un verre ancré ne suit jamais.
- Typographie : `#e8eaef`, interlettrage 0, `text-wrap: pretty`, un seul graphite
  `rgba(24,26,31,.96)` pour verre, pilule et menu, liseré à 20 %, plus de sheen.
  (Historique pour le graphite : remplacé par le verre clair et le verre sombre qui
  suivent le thème de Windows, docs/DA-PLAN.md §9 et lot 12.)
- Preuves : `cargo test` (plafond, cadre), Vitest (`layout.test.ts`), Playwright
  (`ui.pw.ts`, `native-bridge.pw.ts`, `reported-defects.pw.ts` UI-021 à UI-024,
  `workbench.pw.ts`, `overlay.layout.spec.mjs`), références visuelles régénérées et
  regardées (`short`, `long`, `pending`, `menu`, `settings`, `reader-1920`,
  `reader-2560`). Probe natif `scripts/test-native-ui.ps1` sur le build 0.2.0 : PASS (3 cycles,
  fenêtre ancrée 444 × 334 identique avant et après le menu, bandeau silencieux à 0,
  fermeture DOM puis HWND masqués). Le probe prend désormais un contrôle sans message
  avant le `WM_NCACTIVATE` : une vidéo derrière la fenêtre faisait varier la bande
  entre deux captures (diff de 2 à 124 sans aucun message), ce que la tolérance fixe de
  2 prenait pour un bandeau peint. Preuve multi-écrans dans `docs/UI-ISSUES.md`,
  UI-024 : la bande suit le curseur de DISPLAY3 à DISPLAY1, DISPLAY2 et retour.

### Lot « release et moteurs » 0.2.1 (14 septembre 2026)

- Saccade signalée par Lucas sur la 0.2.0 (UI-025) : la pilule d’attente se posait près
  de la sélection puis tout filait en bas. L’emplacement est décidé dès la capture sur le
  texte source (`decidePlacement`), la bande naît en bas sans bouger ; Rust émet
  `work-area` si l’écran du curseur n’est pas celui de la sélection.
- Publication : `.github/workflows/release.yml` (tag `v*` ou lancement manuel) construit
  l’installateur NSIS, calcule son SHA-256 et crée la release GitHub avec la note de
  version. README réécrit (installer, brancher un moteur, utiliser, construire) ;
  `docs/ENDPOINTS.md` décrit la requête exacte, la réponse attendue et les réglages
  pour vLLM, llama.cpp, LM Studio, Ollama et les services en ligne. `top_k` et
  `repetition_penalty` sont retirés de la requête et renvoyés sans eux quand un serveur
  strict les refuse (`inference::rejects_extended_sampling`).

## Correction de méthode après retour de Lucas

L’entrée par défaut de `/lab.html` est désormais la liste des **défauts signalés**,
pas le catalogue technique (`?view=states`). Chaque fiche distingue capture fournie,
gestes, diagnostic établi ou inconnu, reproduction web possible ou test Windows requis.
Les captures personnelles restent uniquement dans `release/ui-evidence`, hors Git.

Pour UI-005a, `surface=production` n’impose pas color-scheme : l’ancienne fixture
sombre masquait précisément les marges blanches. Le test a échoué avec un fond de
body transparent, puis réussi après application du fond au document des réglages.

Pour UI-001, le test du seul DOM était insuffisant. Le probe interroge maintenant
la visibilité des HWND via l’API Tauri avant/après fermeture, sur trois cycles.
Le test renforcé a échoué sur l’installation 0.1.5 : DOM vide, fenêtre encore visible.
Sur le build du 9 septembre (checkout principal, `--features tauri/custom-protocol`), le même
probe passe : `release/ui-evidence/native-after-1a/result.json`, trois cycles, overlay et capsule
masqués nativement, fenêtre 300 × 89 puis 300 × 206 avec le menu. Cela ne mesure toujours pas
le dépoli ni la composition du bureau : la capture d’écran (GDI, Windows-MCP) est refusée dans la
session d’agent, il faut une observation de Lucas sur page blanche.

## Atelier reproductible — jalon du 9 septembre 2026

Décisions à respecter : [UI-DECISIONS.md](UI-DECISIONS.md).
Défauts à traiter séparément : [UI-ISSUES.md](UI-ISSUES.md).

`npm run ui:lab` ouvre http://127.0.0.1:5174/lab.html. L’atelier est une entrée
Vite de développement, exclue du build Windows. Il réutilise GlassOverlay,
Capsule, SettingsWindow et useTranslation ; seules les réponses du pont sont
simulées. Chaque iframe remet ses données fictives à zéro. Aucun appel vLLM,
accès au presse-papiers Windows ou lecture de l’historique réel.

Huit états, taille de fenêtre, fond clair/sombre, mouvements réduits et Rejouer.
Les paramètres restent dans l’URL pour partager exactement le cas local.
Le fond demandé n’est pas une simulation du DPI Windows. La capsule réduite
et le thème automatique ne sont pas inventés dans l’atelier : leur absence
reste visible tant que les composants ne les implémentent pas.

### Références fixes

- `npm run ui:check` compare 19 images dans 17 scénarios (dont menu et largeur étroite).
- `npm run ui:reference` remplace les références : uniquement après revue de la différence.
- `npx playwright show-report playwright-report/visual` présente attendu/réel/différence en cas d’échec.
- Les premières références sont un **constat de 0.1.5 avec ses défauts**, pas un design approuvé.
- Même Windows, version Chromium, polices et paramètres pour comparer. Les références
  sont séparées par plateforme. Textes/dates fictifs et stables ; aucune donnée utilisateur.
- Les images figent les animations. L’ancien `npm run ui:motion`, qui enregistrait les
  interactions du lecteur 0.4, est retiré depuis le 10/10/2026 : il visait des menus qui
  n’existent plus. Une vidéo navigateur ne mesure de toute façon pas la fluidité native.

### Accès réel à Tauri / WebView2

`npm run ui:native` lance l’exécutable installé (`%LOCALAPPDATA%\FlowTranslate`, installateur
NSIS) en démo explicite, ouvre un port CDP local et utilise Playwright dans sa vraie WebView2.
Fermer l’application avant ce test ; le script refuse une session existante. Pour un autre build :
`powershell -NoProfile -File scripts/test-native-ui.ps1 -Executable CHEMIN_EXE`. Les réglages
de la sonde sont versionnés dans `scripts/native-ui-settings/` (`-Theme dark` pour le sombre) :
aucun raccourci global n'est enregistré, et l'Îlot fait son parcours après le lecteur de la démo.
La sonde déplace le vrai curseur (sauf session verrouillée) : ne pas la lancer pendant que
quelqu'un utilise le PC.
Le script termine seulement son propre processus, même si le test échoue.
La version de l’exécutable testé dépend du chemin fourni : ne jamais assimiler
le test de l’installation 0.1.5 à celui d’un futur build de la branche.

Preuves locales dans `release/native-ui-probe` : contenu court, menu, métadonnées
WebView2 et vérification de disparition du DOM après Fermer. Les profils de test
restent dans `release/native-profiles`, hors Git. Le port de débogage n’est pas
ajouté à la configuration de production. Le stockage des réglages Rust reste
celui de l’installation : le scénario ne le modifie pas et ne lit pas ses secrets.

Essai réel de ce jalon : capture du contenu WebView2, ouverture du menu et
fermeture du DOM réussies sur l’installation 0.1.5. La capture Computer Use
renvoie une image noire ; après nouvelle sélection et activation, échec
`GetCursorPos failed: Accès refusé. (0x80070005)`.
Le dépoli, le focus, les régions de clic et les animations sur le bureau
restent donc **non validés**. Une capture CDP ne remplace pas cette étape.

Les sections suivantes décrivent les anciens essais, pas leur état courant.

Le frontend doit être vu et manipulé avant chaque livraison. Les tests unitaires
et une maquette statique ne valident pas le rendu Windows.

## Aperçu React

Lancer `npm run dev -- --port 5173 --strictPort`, puis ouvrir
`http://127.0.0.1:5173/?window=overlay&demo=1` dans le navigateur contrôlé.
Le rechargement à chaud utilise les mêmes composants que Tauri, avec un pont
simulé. Vérifier le texte court/long, les menus, les réglages, les erreurs,
le clavier et les mouvements réduits. Conserver les captures des tests E2E.

Le connecteur navigateur actuel `cua_repl` permet captures et interactions.
L’ancien connecteur `browser-client` peut échouer avec « No Codex IAB backends
were discovered » ; cela ne signifie pas que tout accès au navigateur est absent.

## Fenêtre Windows

Construire et lancer une seule instance avec `--demo-selection` ou
`--demo-clipboard`. Identifier le processus par son chemin exact et retrouver
sa fenêtre avec Computer Use. Capturer avant et après chaque action native.
Le rendu navigateur ne prouve ni le dépoli du bureau, ni le cadre, ni le focus,
ni le déplacement de la fenêtre.

Points obligatoires :

- Absence de titre/cadre au premier affichage, au focus et à la perte du focus.
- Déplacement mesuré par le changement des coordonnées de la fenêtre, puis
  stabilité après ouverture du menu ou réception du texte.
- Fermeture via Échap et via une action visible, y compris pendant une requête.
- Aucun rognage pendant les changements de taille et aucun texte étiré.
- Échelles Windows et fonds clairs/sombres testés séparément des échelles navigateur.

Si une capture est noire ou une interaction échoue avec `GetCursorPos : accès
refusé`, consigner le résultat sans en déduire à lui seul un bureau verrouillé
ou un bug graphique. Rafraîchir la sélection de fenêtre et respecter la procédure
de reprise du connecteur. Ne pas déclarer le rendu validé dans cet état.

## État observé le 9 septembre 2026

L’aperçu React peut être capturé et manipulé dans le navigateur. La capture de
la fenêtre native et les clics fonctionnent de nouveau. Échap a rendu la bulle
inaccessible comme fenêtre affichée. La version 0.1.1 conserve un titre parasite
à la perte du focus et le déplacement automatisé n’a pas modifié ses coordonnées :
ces deux points restent à corriger avant validation native.

### Intégration 0.1.2

Le navigateur contrôlé montre les vrais composants Motion/Radix/Lucide ; le
menu s'ouvre et Fermer masque effectivement le résultat. Les 19 tests Playwright
et 6 tests unitaires passent dans le checkout intégré.

Le premier essai natif a révélé un blocage au démarrage : modifier le cadre
Windows directement dans le callback Focused réentrait dans des événements
protégés par un mutex du runtime. Le correctif diffère cette opération hors du
callback. Après reconstruction et installation, le processus répond et UI
Automation expose la traduction complète et les deux boutons.

La capture du dernier exécutable échoue avec
`IGraphicsCaptureItemInterop.CreateForMonitor failed (0x80070057)`, après nouvelle
sélection de fenêtre également. Le clic par accessibilité échoue avec
`coordinate input geometry is unavailable`. Aucun déplacement, rendu sans titre
au changement de focus ou effet dépoli de cette version n'est donc déclaré
validé. Le processus de démonstration a été arrêté après ces vérifications.

Les captures natives fonctionnaient plus tôt dans cette session sur 0.1.1 :
cette panne intermittente impose de garder la boucle navigateur utilisable,
puis de reprendre la recette native dès que la capture est disponible.
