# DA « Îlot » : rapport de fin de mission (0.5.0)

> Document historique (rapport de la 0.5.0, 25 septembre 2026) : ne décrit plus l’état actuel. État actuel : [README.md](../README.md) et [docs/BRIDGE.md](../docs/BRIDGE.md).

Rédigé le 25 septembre 2026, pour la décision de sortie de la 0.5.0. Branche `da-ilot`, poussée,
en PR brouillon vers `main` ; rien dans `main`, aucun tag. Plan : [DA-PLAN.md](DA-PLAN.md). Décisions par
défaut : dernière section de [UI-DECISIONS.md](UI-DECISIONS.md). Contrat : [BRIDGE.md](BRIDGE.md).
Recette : [RECETTE.md](RECETTE.md).

**Agents.** Tous les agents de la mission étaient Claude Opus 5.5 : la session principale
(orchestration, intégration, validation, preuves en vraie fenêtre), l’agent natif (Rust), l’agent
front, l’agent docs, les auditeurs du plan, les relecteurs et correcteurs, l’auteur des scripts de
preuves et l’agent des tests du lot 14. Le partage natif, front et docs suit le routage
d’AGENTS.md, dont les noms de rôles désignent un autre outil.

## 1. En bref

- **Livré.** Lots 0 à 14 intégrés sur `da-ilot` : 87 commits et 22 fusions. L’Îlot est le parcours
  par défaut, y compris après une mise à jour depuis la 0.4 ; la 0.4 reste derrière le réglage
  caché `uiVersion: "v4"`. En suspens : la décision Acrylic (lot 12), la recette manuelle et les
  notes de version (lot 14).
- **Tests.** Validation locale complète verte à `f9f7639` : tsc, Vitest 206, `cargo test` 105 + 1
  ignoré, build, Playwright 219. La CI était rouge 8 fois sur 11 depuis `45241a7`, toujours sur
  un test qui mesurait mal, corrigé dans `4bf97d7` (§3.1). CI verte sur `050f031`, premier commit
  poussé avec le correctif.
- **Vraie fenêtre.** Parcours complet prouvé dans Chrome, en clair et en sombre, en inférence
  simulée : Îlot, pilule, balayage, collage revalidé, coche, Annuler, mots changés, erreurs. Une
  erreur de serveur réelle aussi (serveur arrêté). Aucune inférence réelle par les agents ; Lucas a
  essayé une version intermédiaire avec son serveur : « c’est vraiment bien ».
- **Jamais vérifié.** 125, 150 et 200 %, deux écrans, Word, Outlook, Edge, Teams, AZERTY en vrai,
  erreurs réelles autres que « injoignable » (§6).
- **Avant la sortie**, décidé par Lucas et pas encore fait : la mise en valeur du texte et ses
  retours du 24/09 (§8). Neuf points restent à trancher (§7).

## 2. Livré, lot par lot

| Jalon | Lot | Livré | Commits |
|---|---|---|---|
| A | 0 Préparation | Réglages de la DA, bascule cachée `uiVersion` (`v4` ou `ilot`), données de test isolées (`FLOWTRANSLATE_DATA_DIR`), base de tests remise au vert, documents mis en cohérence | 02faf34, 1295eac |
| A | 1 Fondations | Verre peint clair et sombre, thème de Windows lu côté Rust, icônes Lucide fines, anglais par défaut et bascule française sans relance | cb527b1, 1faaa25, 24054f0 |
| A | 2 Mouvement | Ressorts du labo (smooth, bouncy) sur les surfaces existantes ; réglage Animations (suivre Windows, toujours, réduites), « Effets d’animation » lu côté Rust | 4c18855, 3dcd41d, cfad830, d7d5e42 ; fusion 8b8f1bc |
| B | 3 Clavier et focus | L’overlay prend le clavier pour l’Îlot, choix unique côté Rust, repli par crochet quand Windows refuse le focus | 8364619 |
| B | 4 Raccourci | Liaison « menu » sur `Ctrl+Alt+Espace`, dernière action mémorisée par application, double appui, conflit AltGr signalé, migration des fichiers 0.4 | 6d2b7d9 ; fusion 1c89065 |
| B | 7 Îlot | Compact, grille 3×2, champ de consigne, table de touches ; une seule surface qui change de forme jusqu’à la pilule ; Îlot par défaut | e1f0a7a, 9716e5c, e69f3ea ; fusion b5f13e7 |
| C | 5 Rectangles | Rectangles de la sélection regroupés par ligne, plafond de 64 compté par ligne, conversion pour le halo testée à 100, 150 et 200 % | dc7c50b, 0e4aac5 |
| C | 6 Halo | Fenêtre `halo` transparente, jamais cliquable ni activable, balayage de lumière sur les lignes ; fenêtre capsule retirée | 672834b ; fusion e0657dc |
| C | 8 Chargement | Pilule 44×28 avec Perle, Nébuleuse ou Ruban (CSS du labo), orbe après 250 ms, réglage Indicateur | f266b6d, d0b6b74 |
| D | 9 Résultat | Diff mot à mot ; texte collé retrouvé par UIA ; pilule sous le nouveau texte, jamais dessus ; coche, Annuler (Ctrl+Z revalidé ou recollage) avec son anneau ; mots changés dans le halo | 54fd682, 553056b, 6ec906d, ae6586f, 805c3cf ; fusion 47cdc08 |
| D | 10 Erreurs | 20 codes d’erreur communs à Rust et au front, pilule d’erreur par famille, bouton vers le champ exact des Réglages, état de chaque raccourci (pris, échoué) | cdfaf36, e9300b7, d4c365e, 2f3bd9f, 253df6e, 07b67ed |
| E | 11 Mode résultat | Aucun commit propre : verre court et bande de lecture pris dans la matière du lot 1 et le mouvement du lot 2, comportement inchangé | — |
| E | 12 Matière | Phase A (verre peint) par défaut ; phase B : essai Acrylic derrière le réglage caché `glassMaterial`, constat dans [ACRYLIC-TRIAL.md](ACRYLIC-TRIAL.md) | ea05b90, aa061fa ; fusion 839340d |
| E | 13 Réglages | Sections Menu, Actions, Après remplacement, Apparence, Bulle de résultat, Connexion, Sur cet appareil ; liens directs vers un champ ; clair et sombre | 2675e63, e24fb07 |
| E | 14 Livraison | Version 0.5.0, recette Îlot, brouillon des notes 0.5.0, sonde native de l’Îlot, tests et aperçu qui partent de l’Îlot, 28 références visuelles | cadeca3, 2d13e91, 53c6364, 540628f, f62684c, dc0452c ; fusion 13f3957 |

Hors lots :

- `4439dfe` : une sélection réduite au curseur invalide la cible ; le collage s’insérait au point
  du clic (défaut antérieur à la DA, vu en vraie fenêtre).
- `4f76070` : l’Îlot ne se ferme plus seul juste après la capture (environ 2 % des ouvertures
  dans Chrome).
- 18 commits `fix(revue)`, issus de la revue adverse de `bc57857` (§3.5).

## 3. Ce qui est prouvé, et comment

### 3.1 Tests automatiques

| Contrôle | Base `origin/main` (`ca4168c`) | Dernière validation (`f9f7639`, 25/09) |
|---|---|---|
| `tsc -b` | non relevé | OK |
| Vitest | en échec : 10 fichiers d’anciens worktrees ramassés | 206/206 (29 fichiers) |
| `npm run build` | OK | OK |
| `cargo test` | OK | 105 passés, 1 ignoré (il demande un vrai vLLM) |
| Playwright | en échec : réoptimisation de Vite, premier chargement à froid de 13 s | 219/219 |
| `npm run ui:check` | non relevé | 30 passés, 18 en échec, tous `@v4` (à `13f3957`) |

- Le lot 0 a remis la base au vert (24 tests unitaires, 74 Playwright) ; la suite a grandi lot par
  lot jusqu’aux chiffres ci-dessus.
- Contraste ≥ 4,5:1 : calculé sur les tokens, sur bureau blanc et noir (`src/theme.test.ts`), pas
  mesuré sur capture.
- **CI GitHub « Validate and build » : rouge 8 fois sur 11 depuis `45241a7`** (lots 9-10 front,
  qui ont ajouté le test ; rouge sur `45241a7`, `3820e44`, `3e678ff`, `e60003d`, `839340d`,
  `d70e6d1`, `8fd30d0` et `13f3957`, vert sur `4a3cabd`, `47cdc08` et `b8bf020`), toujours sur
  ce seul test et jamais en local. Le test
  `e2e/result.pw.ts:73` (coche et Annuler, préréglage bouncy) mesurait une échelle de 1,005 sur le
  contenu pendant le ressort, pour une tolérance de 0,005. Cause établie le 25/09 : le test, pas
  l’app. Au sommet du dépassement du ressort d’entrée bouncy (échelle ≈ 1,003), Motion rend sa
  cible une ou deux images tant que sa vitesse est presque nulle, puis le ressort reprend pendant
  ≈ 170 ms. Le test prenait ce `transform: none` passager pour la fin de l’entrée, mesurait donc
  le morph avec la queue de l’entrée (≈ 0,25 %), plus l’arrondi d’`offsetWidth` au pixel entier
  (jusqu’à 1 % sur 100 px). Correctif `4bf97d7`, sans tolérance relâchée : l’entrée n’est finie
  qu’après 300 ms sans transformation, et l’échelle se mesure sur la taille non arrondie ; même
  correctif dans `e2e/ilot.pw.ts`, qui avait le même motif. Mesuré ensuite : aucune échelle
  d’ancêtre pendant le morph, écart de 3·10⁻⁶ (1,2·10⁻³ avant, en local). CI verte ensuite sur `050f031` (Playwright
  219, `cargo test` 105 + 1 ignoré).
- Une vraie course de test, trouvée en relançant la suite : `e2e/ilot-bridge.pw.ts:248` (touches
  reçues avant l’Îlot). La fixture ne retenait que la prochaine lecture de la position de la
  fenêtre ; la glace la lit aussi, et sous charge sa lecture consommait la retenue destinée à
  l’Îlot, qui apparaissait trop tôt. Reproduit en provoquant cette lecture (2 échecs sur 3), corrigé
  dans `050f031` (6 sur 6, puis 48 sur 48 sur le fichier répété).
- Pages encore blanches 5 s après leur chargement, dans la suite complète locale seulement (une
  dizaine de workers contre un seul serveur Vite de développement), un test différent à chaque
  fois, avant toute action du test : `e2e/working-pill.pw.ts:246`, `e2e/theme-language.pw.ts:45`,
  `e2e/ilot.pw.ts:150` ; chacun passe seul ou répété. Jamais vu sur la CI. Déjà connues sous
  charge : `e2e/native-bridge.pw.ts:134` (antérieur à la branche), « very long reader ».

### 3.2 Vraie fenêtre

Exécutable release, dossier de données jetable, Chrome sur un profil jetable et une page de
démonstration, écran principal à 100 %, inférence simulée sauf mention. Une touche synthétique ne
part que si la cible est au premier plan ; depuis le 24/09 au soir, tout s’arrête dès que Lucas
touche au PC. Preuves dans `release/da-ilot-evidence/`, hors Git :

| Dossier | Ce qu’il montre |
|---|---|
| `baseline-0.4/` | La 0.4 avant la DA, mêmes cadrages, pour comparer |
| `jalon-A/` | Overlay et Réglages en clair, sombre et « suivre Windows » (anglais), clair et sombre (français). « Suivre Windows » donne le sombre grâce à la lecture Rust, alors que WebView2 annonce le clair. 4 vidéos à 60 i/s (smooth et bouncy en sombre, smooth et réduit en clair), fenêtre inchangée après l’ouverture. Sonde native PASS sur 3 cycles |
| `jalon-BC/` | Clair et sombre : overlay au premier plan en 25-47 ms ; compact 109×32 ; Tab → grille ; champ, 24 caractères accentués ; Échap deux fois → source au premier plan en 24-39 ms, sélection intacte. F → source rendue en 74-117 ms, pilule 44×28, halo sur 3 lignes, collage revalidé, coche, fenêtre cachée ; Ctrl+Z rend le texte. Double appui : une seule capture. Balayage visible dans les vidéos, discret sur la sélection bleue de Chrome |
| `jalon-BC/fallback/` | Windows refuse le focus : Chrome garde le premier plan, l’Îlot suit le crochet (Tab, Échap, chiffre), collage OK |
| `jalon-D/` | Coche après un collage revalidé ; sélection changée pendant le travail → rien collé, pilule « Text changed » ; raccourci pris → les Réglages le disent (anglais, français) et focalisent le champ. Lot 9, en clair et en sombre, 5 sur 5 : collage, pilule sous le texte sans le couvrir, halo sur les mots changés, Annuler rend l’original (« Undone »), une touche retire Annuler. Lot 10, **serveur réel arrêté** (port vérifié fermé avant chaque requête) : code `unreachable` côté Rust et front, pilule de configuration, rien collé, presse-papiers intact |
| `jalon-E/` | Bande de lecture et Réglages, clair en anglais et sombre en français |

Mesures de l’agent natif, rapports hors dépôt :

| Sujet | Mesure |
|---|---|
| Lots 3-4, Bloc-notes et Chrome | Overlay au premier plan en 19-32 ms (Bloc-notes), 22-102 ms (Chrome) ; Échap rend la source en 60-76 ms, sélection intacte ; consigne accentuée collée ; mémoire par application ; double appui |
| Lots 5-6 | Bloc-notes 3 lignes, Chrome 11 morceaux → 3 lignes ; halo jamais activable, traversé par les clics, visible en 250-259 ms, caché en 33-82 ms quand la fenêtre bouge |
| Lot 9 natif et revue | F5 ou Ctrl+R : 0 rechargement sur 16 (3 sur 3 sans correctif) ; Îlot fermé 25-52 ms après un clic dans le document ; VS Code : lettre tapée au relâchement remise à l’Îlot 9 fois sur 9 ; Annuler par Ctrl+Z en 19-32 ms, par recollage en 331-355 ms |
| Fermeture spontanée | 147 ouvertures sur 150 sans fermeture avant `4f76070`, 150 sur 150 après |
| Essai Acrylic | 146 affichages corrects sur 146 en trois séries de 50 (ACRYLIC-TRIAL.md) |

Navigateur (lot 8) : orbe à 252-268 ms, contenu centré à 0,000 px près, pilule 44×28 (Ruban 52×28)
stable pendant l’animation.

### 3.3 Sonde native

`npm run ui:native` : PASS en clair et en sombre après le lot 9 (24/09, 23:47 et 23:50). 4 cycles
0.4, puis l’Îlot « compact → grille → tuile » et « compact → dernière action » : réserve fixe,
régions, halo non activable, fermeture. Elle ne vérifie pas : la composition des bords et des
ombres, le premier plan (elle note la réponse de `focus_overlay`), le DPI, les temps d’image, une
vraie capture de sélection, la coche après un vrai collage, de vrais clics (elle clique par
DevTools).

### 3.4 Presse-papiers

Après le collage et après Annuler : texte identique, aucun format perdu. La restauration ajoute
trois marqueurs (`ExcludeClipboardContentFromMonitorProcessing`, `CanIncludeInClipboardHistory`,
`CanUploadToCloudClipboard`) qui la tiennent hors de l’historique Win+V et du presse-papiers
cloud. C’est un choix de conception, présent depuis la 0.4.0 (`clipboard_guard.rs`), pas un défaut.

### 3.5 Revues

| Revue | Constats | Suite |
|---|---|---|
| Revue adverse de `bc57857` (5 relecteurs, 5 vérificateurs) | 17 confirmés, 2 rejetés. Critique : une capture sans ancre (copie synthétique) n’était jamais revalidée sur son texte avant le collage. Majeurs : crochet qui avalait les frappes après le retour dans la source, portée du menu ouverte trop tard, F5 ou Ctrl+R qui rechargeaient l’overlay | 18 commits `fix(revue)` ; côté front, chaque test vu en échec sur l’ancien code |
| Relecture ×2 du lot 9 front | 4 majeurs (pilule qui passait sur le texte collé, pilule visible 0,6 s sur le texte, raison d’`undo-state` ignorée, mots changés coupés net), 7 mineurs, fixture et trous de tests | 11 corrigés en 12 commits ; la fixture reprend l’algorithme de `placement.rs` |
| Relecture ×2 du branchement du lot 10 | 4 constats | Corrigés (`b98a0d4`) |
| Lots 1 et 2 | Relecture adverse intégrée au workflow d’implémentation | Corrections avant fusion |

## 4. Écarts au plan

### 4.1 Errata du plan

Audit du lot 0 par 5 auditeurs : 106 affirmations du plan confrontées au code et au labo, 37 non
confirmées (4 fausses, 31 partielles, 2 invérifiables). Quand le §9 et la source du labo
divergent, le labo fait foi.

Fausses :

1. Grille « ≈ 222×112 » : 218×116.
2. Champ de consigne « ≈ 262×34 » : ≈ 283×34, la forme la plus large de l’Îlot.
3. Le §9 range le déplacement de la pilule sous le ressort « morph ». Dans le labo, c’est une
   transition CSS de 420 ms `cubic-bezier(.23,1,.32,1)` ; seuls la taille et le rayon suivent le
   ressort. Le lot 9 suit le labo.
4. Phase A « .94 → .90 en clair, ≈ .86 en sombre » : le clair du labo est le préréglage
   `opaque-light` (1 → .94) ; le labo n’a aucun sombre opaque, le .86 vient du plan (décision 12).

Partielles qui ont pesé :

- « L’overlay ne prend jamais le focus » : faux dès qu’on cliquait.
- Mode réduit : `MotionConfig` ne suffit pas (`useReducedMotion` l’ignore, `animate()` sur la
  taille n’est jamais réduit).
- `spring.js` et `diff.js` « testés » : aucun test dans le dépôt ; écrits au portage.
- Valeurs arrondies ou incomplètes : « bouncy » change aussi sortie, contenu, échelle et
  glissement ; éclat × .15 ; seconde ombre .072 ; fondu d’arrivée 320 ms ; pilule d’erreur 30 px.
- Absents du labo, ajoutés par le plan et gardés : pause d’Annuler au focus, fondu de 150 ms de
  l’orbe, voile fixe en mode réduit.
- Erreurs : la liste oubliait les 5xx, « rien de sélectionné », le champ protégé, les touches
  tenues et l’erreur interne. Il y a 20 codes aujourd’hui, `settings_open` et `nothing_recent`
  compris.
- UIA donne un rectangle par morceau visible, pas par ligne.
- Divers : nom `halo` déjà pris dans `layout.ts` (décision 13) ; exécutable de test sur les
  données de l’app installée (décision 11) ; critère du lot 0 sans Playwright ; lignes citées
  décalées au §3.

### 4.2 Écarts d’implémentation

| Où | Plan | Livré | Pourquoi |
|---|---|---|---|
| §0, §7 | Lots dans l’ordre ; chaque jalon montré à Lucas avant le suivant | Lots front en parallèle ; chaque jalon validé par ses preuves puis poussé | Décisions 9 et 10 |
| Lot 7 | Sixième tuile « Plus » vers une seconde page | Grille 3×2 sans seconde page | Décision 6 |
| Lots 1-2 | WebView2 suit le thème et les animations de Windows ; Rust seulement pour une phrase des Réglages | Rust lit les deux (`system_theme.rs`, `system_motion.rs`) et prime ; le média CSS reste le repli | WebView2 annonçait le clair sous un Windows sombre ; le passage des animations au média n’a jamais été mesuré |
| Lot 4 | `instruction` dans la requête `translate` | Donnée à `choose_action`, dont Rust fait une action éphémère ; `translate` ne porte jamais la consigne | Contrat de BRIDGE.md, « Choice » |
| Lot 4 | Double appui : relancer sans afficher le menu | Si l’Îlot a eu le temps d’apparaître, il devient la pilule | — |
| Lot 5 | Rectangles en pixels logiques par écran | Pixels physiques, convertis pour la fenêtre halo | L’ancre reste physique pour la revalidation |
| Lot 7 | Chiffres 1 à 6 → tuile | Lus sur la touche produite : sur AZERTY, la rangée du haut sans Maj ouvre la consigne pré-remplie ; Maj ou pavé choisissent la tuile | Ne pas voler une consigne qui commence par « é » ; à trancher (§7) |
| Lot 7 | Labo : Îlot posé depuis la fin de la sélection, vers la droite | Bord droit sur la fin de la sélection, il s’étend vers la gauche | Éviter le débord d’écran ; Lucas veut l’inverse quand il y a la place (§8) |
| Lot 9 | Déplacement de la pilule au ressort (§9) | Transition de 420 ms du labo ; fondus quand la fenêtre doit bouger | Le labo fait foi (§4.1) |
| Lot 10 | 13 codes ; pilule d’erreur de 28 px | 20 codes ; 30 px comme le labo ; « Réessayer » relance la requête puis colle par `replace_result` | Rust ne livre que la première requête |
| Lot 12 B | Une fenêtre Acrylic par surface | Une fenêtre de fond sous l’overlay, retour estimé à 0,8 s, transparente aux clics | ACRYLIC-TRIAL.md |
| Lots 3, 5, 6, 9 | Critères sur 4 à 7 applications, dont Word, Outlook, Edge et Teams | Chrome, Bloc-notes, VS Code | Word, Outlook et Edge absents du poste ; Teams : aucun essai consigné |
| Lot 14 | Références régénérées après revue de Lucas ; recette déroulée | 28 images Îlot générées sans revue, marquées « en attente » ; images 0.4 ni acceptées ni régénérées ; recette écrite, pas déroulée | La revue et la recette manuelle reviennent à Lucas |
| Lot 0 | `uiVersion` retiré à la fin | Toujours là : `"uiVersion": "v4"` dans `settings.json`, `ui=v4` dans l’aperçu | À trancher (§7) |

## 5. Décisions prises à la place de Lucas

### 5.1 Les 13 décisions par défaut, à confirmer

| # | Décision | Depuis |
|---|---|---|
| 1 | Menu sur `Ctrl+Alt+Espace` ; aucune `Ctrl+Alt+lettre` par défaut | Pris par Claude desktop sur le poste de Lucas (UI-029) ; défaut gardé, preuves avec `Ctrl+Alt+Maj+Espace` |
| 2 | Annuler par Ctrl+Z revalidé (option A) ; recollage de l’original (option B) dans les Réglages | Les deux mesurés par l’agent natif |
| 3 | Verre peint par défaut ; Acrylic en essai caché | Constat : garder le verre peint |
| 4 | Mode « Afficher le résultat » et bande de lecture restylés, comportement inchangé | |
| 5 | Point à chaque sélection : reporté | |
| 6 | Grille 3×2 sans seconde page ; « Consigne libre » en dernière tuile tant qu’il y a moins de 6 actions | |
| 7 | Mouvement « smooth » par défaut, « bouncy » en option | |
| 8 | Anglais par défaut ; noms d’actions jamais renommés | Vaut aussi après une mise à jour 0.4 |
| 9 | Sous-agents et workflows pour cette passe | Autorisé par Lucas |
| 10 | Chaque jalon validé par ses preuves sans attendre Lucas ; ni `main` ni tag | |
| 11 | Tous les lancements de test sur un dossier de données jetable | |
| 12 | Verre sombre `rgb(28 30 34 / .86)` ; clair = `opaque-light` du labo | À .86, les grandes lettres de la page se lisent à travers la grille |
| 13 | La fenêtre s’appelle `halo` ; la constante de marge d’ombre est renommée | |

### 5.2 Décisions d’exécution

En plus des écarts du §4.2 :

- les valeurs du labo priment sur le §9 arrondi ;
- Animations : « suivre Windows » par défaut ;
- l’Îlot est le parcours par défaut aussi pour un fichier 0.4 ;
- réserve de fenêtre ancrée de 581×264, pour une pilule d’erreur jusqu’à 400 px (715×264 depuis le
  25/09, pour l’ouverture du menu à droite) ;
- Ctrl+Z de l’utilisateur → « Undone » 0,9 s puis départ ; frappe ou curseur déplacé → départ en
  1,1 s au plus, comme le labo ;
- animations réduites : coche immédiate, anneau d’un cran par seconde, voile fixe à la place du
  balayage ;
- 13 des 20 textes d’erreur écrits par l’agent front (11 au lot 10, 2 au lot 9), les 7 autres
  repris du labo ;
- AltGr au repos ouvre le champ de consigne.

## 6. Jamais vérifié

| Quoi | Pourquoi | Ce qui le couvre aujourd’hui |
|---|---|---|
| 125, 150 et 200 % | Trois écrans à 100 % ; changer l’échelle est un réglage système | Tests de conversion et d’arrondi |
| Deux écrans avec l’Îlot | Pas fait | Recette manuelle |
| Word, Outlook, Edge | Absents du poste | Recette manuelle |
| Teams | Installé ; aucun essai consigné | Recette manuelle |
| Parcours final (lot 9 front) hors de Chrome | Le Bloc-notes rouvre les onglets de session de Lucas : la session principale ne l’a pas piloté, les preuves finales visent Chrome | Bloc-notes par l’agent natif aux lots 3 à 6 et au lot 9 natif |
| AZERTY : chiffres, AltGr, avertissement de l’enregistreur | Poste en saisie française sur clavier US : `shortcut_conflict` répond non | Tests Rust et Vitest |
| « Suivre Windows » sous un Windows clair, ou qui réduit les animations | Réglages système | Clair et « Réduites » forcés, capturés |
| Erreurs réelles hors « injoignable » : clé, modèle, occupé, délai, flux coupé | Pas fait : il faut un serveur qui tourne (arrêté à la demande de Lucas) | Tests Rust à serveur factice, pont simulé |
| Inférence réelle par les agents, latence | Règle de la mission : inférence simulée | Essai de Lucas, non instrumenté |
| Clic réel sur « Copy result » | Écraserait le presse-papiers de Lucas sans restauration | Playwright |
| Replis Acrylic réels, coût GPU de DWM | Réglages système | Injection de test |
| Revue de `bc57857` : constats natifs 3, 8 et 9 ; côté front, `preventDefault` face aux accélérateurs, focus au clic en repli, entrée de la pilule, emplacement vide des Réglages | Pas repassés en vraie fenêtre | Tests Rust, Playwright |
| Esthétique | Revue de Lucas | 28 références Îlot en attente |

Non expliqué :

- Sonde du 24/09 vers 21:15 : une fois, la région cliquable est restée celle de la bande initiale
  au lieu de la forme compacte (une bande invisible d’environ 140 px à gauche de la bulle prenait
  le curseur). Pas reproduit ensuite (2 passages sur 2, clair et sombre) ; cause non établie. La
  sonde dit désormais si une région arrive « en retard » ou « jamais » (`b8bf020`).
- Harnais : 3 raccourcis sur environ 70 sans capture.

## 7. À trancher par Lucas

1. **Sortie 0.5.0.** La fusion dans `main` publie l’installateur. Lucas a décidé que la mise en
   valeur du texte passe avant (§8), et sa règle de fusion demande que tout soit vérifié, CI verte
   comprise.
2. **Acrylic** : garder le verre peint (recommandé) ou l’une des trois étapes d’ACRYLIC-TRIAL.md.
3. **Verre sombre** : à .86, les grandes lettres de la page se lisent à travers la grille ; relever
   l’opacité ?
4. **Chiffres AZERTY** : rangée du haut sans Maj → consigne (aujourd’hui) ou tuile.
5. **Textes d’erreur** : relire les 13 textes écrits par l’agent front, en anglais et en français
   (`src/i18n.ts`).
6. **Langue par défaut** : l’anglais, même après une mise à jour depuis la 0.4.
7. **Références visuelles** : revoir les 28 images de
   `visual-tests/references/win32/chromium/ilot/`, puis `npm run ui:reference -- --grep @ilot`.
   Pour la 0.4, périmée depuis les lots 1 et 13 (18 tests en échec, 20 images sur 21 qui
   diffèrent) : `--grep @v4` ou attendre son retrait. Sans filtre, `ui:reference` réécrit tout.
8. **Parcours 0.4** : le retirer (le plan le prévoyait à la fin) ou le garder encore.
9. **Décisions par défaut** (§5.1) : les confirmer ou non, surtout 1, 2, 4, 5 et 6 ; et le
   raccourci à proposer quand `Ctrl+Alt+Espace` est pris.

## 8. Reste à faire

Chantier « mise en valeur du texte », décidé par Lucas le 24/09 pour la 0.5.0 :

- montrer la sélection à trois niveaux : zone de texte, lignes, texte exact (beaucoup
  d’applications grisent leur sélection quand l’Îlot prend le clavier) ;
- effets « à la Apple Intelligence », dessinés par-dessus via la fenêtre `halo` sans recolorer le
  texte de l’autre application, pendant le travail et à l’arrivée du texte ;
- mots changés surlignés jusqu’à la prochaine action dans le texte (frappe, clic, défilement),
  60 s au plus, durée réglable, sans dépendre d’Annuler ; jolis en clair et en sombre, visibles
  sans cacher le texte ;
- prototypes clair et sombre à montrer à Lucas avant de coder ;
- piste relevée à la relecture du lot 9 : une durée de vie du surlignage côté Rust, séparée
  d’Annuler et de la fermeture de l’overlay, avec sa propre surveillance et un minuteur de 60 s.
  Aujourd’hui, `highlight_changes` ne marque rien sans Annuler actif et le surlignage meurt avec
  l’overlay.

Retours de Lucas du 24/09, sur la version d’essai :

- survol : seule la zone droite de la bulle compacte (la ✦) déplie la grille, jamais la zone de
  la dernière action ;
- la grille s’ouvre à droite de la bulle quand il y a la place, à gauche près du bord de l’écran ;
- mise à jour propre depuis la 0.4 : son installation a mêlé les actions françaises de la 0.4 et
  anglaises de la 0.5, gardé `Ctrl+Alt+T` en « Afficher le résultat » et posé le menu sur un
  raccourci déjà pris ; il a cru avoir encore l’ancienne version. À faire : remplacer les actions
  livrées jamais modifiées, et un bouton « Rétablir les réglages par défaut » ;
- raccourci par défaut déjà pris : en proposer un autre au premier lancement.

Et aussi :

- écrire la ligne « Validation » des notes 0.5.0, avec les vérifications réellement faites ;
- dérouler la recette manuelle : aucune case n’est cochée ;
- `scripts/capture-ui-preview.mjs` et `scripts/profile-ui.mjs` sont cassés : ils cherchent les
  libellés français de la 0.4 ;
- défauts ouverts : UI-029, UI-030, UI-031 ([UI-ISSUES.md](UI-ISSUES.md)) ;
- limites connues de la 0.5.0 : erreurs du verre des raccourcis directs en français ; VS Code
  sans rectangles, donc Îlot en bas de l’écran et pas de balayage.

## 9. Conduite de la mission

- Du 24/09 au matin au 25/09 vers 00:40 : 87 commits (30 feat, 42 fix, 7 docs, 6 test, 2 chore)
  et 22 fusions, 194 fichiers, jusqu’à `13f3957`. Puis, le 25/09 : ce rapport, le ménage des noms
  et des docs (recette, notes 0.5.0, pont) et le correctif du test intermittent. Un worktree et un port Playwright par agent ; à chaque lot,
  intégration, validation complète et poussée de `da-ilot`.
- Incidents :
  - une réponse à un agent de workflow en a lancé une copie : deux agents dans le même worktree
    au lot 1, copie arrêtée ;
  - limites d’usage vers 12:30 et 17:05 : agents coupés, puis repris ;
  - des séries en vraie fenêtre ont déplacé le curseur pendant que Lucas utilisait le PC : tout
    arrêté à sa demande vers 18:40. Depuis, séries seulement en son absence, sous une garde de
    présence qui ignore les événements injectés ;
  - des preuves supprimées : elles montraient le bureau ou une ligne d’une messagerie de Lucas ;
  - les preuves des lots 9 et 10 ont laissé une sentinelle aléatoire dans le presse-papiers de
    Lucas, à la place de son contenu ;
  - la CI n’a pas été relue après chaque poussée : rouge 8 fois sur 11 depuis `45241a7`, vu
    seulement à la rédaction de ce rapport. Les « validé » de ces lots ne valaient que pour la
    validation locale.
- Coût, relevé à partir du 24/09 à 20:43 seulement : de 20:43 à 23:14, 43 points de la fenêtre de
  5 h pour 6 points de l’hebdomadaire ; un relecteur, 410 à 430 k jetons. Hebdomadaire à 80 % le
  25/09 à 01:05.
- Poste de Lucas : 0.5.0 d’essai installée (branche locale `da-ilot-test`, antérieure aux
  corrections du lot 9 et à la fin du lot 14), réglages neufs à sa demande. L’ancien fichier, déjà
  migré, est sauvegardé dans
  `%APPDATA%\com.flowtranslate.desktop\sauvegarde-avant-0.5.0-propre-20260924-191124\`.
  Serveur vLLM `general` arrêté à sa demande.
- Hors Git : preuves dans `release/da-ilot-evidence/`, harnais dans `release/da-ilot-tools/`,
  installateur d’essai dans `release/test-0.5.0/`. Rapports de l’agent natif et de la sonde :
  dossier temporaire de la session, sans garantie de conservation.
