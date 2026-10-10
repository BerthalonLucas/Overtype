# Plan d’implémentation de la nouvelle DA (« Îlot ») — FlowTranslate 0.5

> Document historique (plan exécuté de la DA Îlot, 0.5, 24 septembre 2026) : ne décrit plus l’état actuel. État actuel : [README.md](../README.md) et [docs/BRIDGE.md](../docs/BRIDGE.md).

Rédigé le 24 septembre 2026 à partir de la session labo (23–24 septembre) et d’une lecture
complète du code (`src/`, `src-tauri/`, `e2e/`, `visual-tests/`, `docs/`). Ce document est un
**plan**, pas du code. Il est destiné à une session Claude Code lancée sur le PC Windows de Lucas,
dans ce dépôt, là où l’app peut être compilée, lancée et observée dans sa vraie fenêtre.

Le plan GitLab rédigé au travail est remplacé par ce document (décision de Lucas, 24 septembre).

---

## 0. Mode d’emploi pour la session d’implémentation

1. Lire dans cet ordre : `AGENTS.md`, ce plan, `docs/UI-DECISIONS.md` (sections du 23 et
   24 septembre), `docs/UI-LAB.md`, `docs/BRIDGE.md`.
2. Lire `design-lab/README.md` puis ouvrir le labo `design-lab/labo-flowtranslate.html` dans Edge
   ou Chrome : c’est **la référence** visuelle et de mouvement, à garder dans le dépôt. Ses réglages
   par défaut sont les choix de Lucas. Sa source (`design-lab/src/`) contient le CSS et les calculs
   à reprendre tels quels (voir §9), et `design-lab/verify.mjs` les mesures qui l’ont validé
   (centrage, non-recouvrement, sélection au caractère…), à reprendre comme modèle de tests.
3. Travailler lot par lot (§5), dans l’ordre, une branche par lot ou un commit par lot. Chaque lot
   a ses critères de fin. Ne pas démarrer le lot suivant tant que les tests du lot ne passent pas.
4. Règles du dépôt qui s’appliquent sans exception : pas de journalisation de texte source,
   de résultat, de clé ou de presse-papiers ; historique opt-in chiffré DPAPI ; ne jamais remplacer
   une sélection sans revalider son identité et son texte ; ne pas arrêter les processus GPU ;
   ne pas déclarer une interface « prête » sans l’avoir vue dans la vraie fenêtre Windows.
5. Les décisions esthétiques finales restent à Lucas : chaque lot visuel se termine par une
   capture ou une courte vidéo de la vraie fenêtre à lui montrer.

Errata et écarts constatés en implémentation : `docs/DA-RAPPORT.md`.

---

## 1. Synthèse des décisions retenues (état au 24 septembre)

| Sujet | Décision | Source |
|---|---|---|
| Direction produit | Sélection → raccourci → petit menu d’actions à côté du texte → le texte est remplacé sur place. La traduction n’est plus centrale. | UI-DECISIONS 23/09 |
| Priorité | La vitesse : réponses de 0,4 à 4 s. Rien ne doit ralentir le chemin quotidien. | 23/09 |
| Menu | **Îlot** : au repos, la dernière action (Entrée la relance) et une pastille pour écrire une consigne. Tab, ↓ ou un survol déplie une grille de 6 tuiles. Lettres F T P S E, chiffres, Espace = consigne, taper une lettre inconnue ouvre la consigne. | 24/09 |
| Actions par défaut | Corriger, Traduire (FR↔EN en une action), Rendre professionnel, Raccourcir, Rédiger un mail, Consigne libre. Actions ajoutables. | 23/09 |
| Déclenchement | Raccourci clavier par défaut ; option « petit point à chaque sélection ». | 23/09 |
| Raccourci | **Non tranché.** Ctrl+Alt+T ou Ctrl+Alt seul posent problème sur AZERTY (Ctrl+Alt = AltGr). Recommandation : **Ctrl+Alt+Espace**, à confirmer par Lucas. | recherche, §8 |
| Chargement | Pilule avec l’orbe **Perle** (ou **Nébuleuse**) ; **Ruban** comme variante ligne. Rien de textuel, la pilule ne grandit pas. Délai d’apparition 250 ms. | 24/09 |
| Sélection pendant le travail | **Balayage de lumière** dessiné par-dessus les lignes sélectionnées (pas de surlignage bleu, pas de recoloration des lettres). En plus de la pilule. | 24/09 |
| Après remplacement | Coche (tracé), **Annuler 8 s** avec compte à rebours (pause au survol, Ctrl+Z), **mots changés surlignés tant qu’on peut annuler**, puis tout s’efface. Chaque élément désactivable dans les Réglages. | 24/09 |
| Position de la pilule | Jamais sur le texte modifié : repositionnée après le remplacement sous le nouveau texte ; option « dans la marge ». | 24/09 |
| Erreurs | Visibles, claires. Erreur de configuration (adresse, clé, modèle, droits) → bouton qui ouvre le champ exact des Réglages. Erreur transitoire → Réessayer. Collage refusé / sélection changée → rien remplacé, résultat à copier. | 23/09 |
| Thème et matière | Suit le thème de Windows. Clair : **verre Apple clair**. Sombre : **verre sombre**. Vrai verre (Acrylic) seulement si fonctionnel et net → essai natif à faire. | 24/09 |
| Icônes | **Lucide**, trait fin (1,5). | 24/09 |
| Langue | App en anglais par défaut, bascule français complète. | 23/09 |
| Mouvement | **Apple « smooth »** (ou « bouncy ») ; le contenu reste centré pendant les transformations. | 24/09 |
| Animations réduites | Réglage « Animations : suivre Windows / toujours / réduites ». | 23/09 |
| Réglages (fenêtre) | Refonte = chantier séparé, mais doit accueillir les nouveaux réglages et les liens directs des erreurs. | 15 et 23/09 |
| Réflexion des modèles | Niveaux de réflexion par modèle à rendre réglables : **sujet mis de côté**. | 23/09 |

Valeurs exactes (tokens) : §9.

---

## 2. Ce qui a été exploré et écarté (pour mémoire)

Tout reste consultable dans le labo.

| Famille | Retenu | Écarté (et pourquoi, quand c’est connu) |
|---|---|---|
| Menus (10) | Îlot | Éventail (une rangée : trop « liste »), Invite (peu découvrable à la souris), Boussole (4 à 8 emplacements), Molette (coût linéaire), Touches (invisible pour un débutant), Tonalité (mail et consigne hors axes), Aperçu direct (calcule pour rien), Recette (« je combine »), Writing Tools (liste, plus grand). **Idées à récupérer dans Îlot** : le délai « Touches » (lettres actives immédiatement, aides seulement si on hésite), l’historique de consignes d’« Invite » (↑). |
| Indicateurs (23) | Perle, Nébuleuse, Ruban | Souffle (premier choix, jugé trop gros), Vague, Relais, Duo, Quadrille, Gélules, Bulle, Goutte, Étincelle, Morphose, Iris, Comète (trop proche du spinner rejeté), Onde, Égaliseur, Sinus (Ruban préféré), effets de pilule Reflet / Liseré / Faisceau / Aurore, et l’ancien spinner lucide (rejeté). |
| Effets sur la sélection | Balayage de lumière | Faisables mais non retenus : Lueur colorée, Contour lumineux, Soulignement qui balaie, Voile qui respire. **Impossibles hors navigateur** : lettres colorées, lettres qui scintillent, vague de mots. |
| Arrivée du texte | Fondu (voile qui s’efface) | Net ; démo seulement (impossibles dans une autre application) : flou → net, mot à mot flou, mot à mot qui monte, machine à écrire. |
| Mots changés | Surlignés tant qu’on peut annuler | Surligné puis s’efface, surligné jusqu’au clic, souligné coloré, rien. |
| Erreurs | Pilule compacte | Petite carte détaillée (à garder pour les messages longs ?). |
| Mouvement | Apple smooth / bouncy | Apple snappy, Windows 11 Fluent, Material 3 Expressive, Emil Kowalski, lent et mou, aucune animation. |
| Matières | Verre Apple clair / verre sombre | Verre dépoli, verre liquide (filtre SVG, demanderait une capture d’écran), clair sans transparence (repli si pas d’Acrylic), Acrylic simulé (coins 8 px), graphite 0.4.0. |
| Icônes | Lucide | Iconoir, Phosphor, aucune. |
| Position | Sous la sélection | Au-dessus ; dans la marge (option). |
| Déclenchement | Raccourci | Point à chaque sélection (option). |
| Raccourcis étudiés | (à trancher) | Ctrl+Alt seul (déclenché par AltGr), Maj deux fois, touche F. |
| Chargement « long » | Rien ajouter | Libellé « Working… » qui scintille après 2,5 s. |

Écarté plus tôt et à ne pas réintroduire : anneau d’attente, trois points « qui sautent », balayage
sous la pilule après 1,5 s, grande bulle graphite « pâtée », bande de lecture comme forme principale,
capsule permanente, confirmation avant envoi.

---

## 3. Documents à mettre en cohérence (lot 0)

Ces passages contredisent la nouvelle direction. Les réécrire ou les marquer « historique ».

- `AGENTS.md:8` (capture `c-overlapping-pill.png` = référence) et `:15` (« retain the approved custom
  visual identity ») → pointer vers ce plan et le labo. *Fait dans ce commit.*
- `docs/SPEC.md:9, 11, 13, 17, 23, 25` : bulle graphite 280 px, bande de lecture, capsule, Ctrl+Alt+T,
  « repeated shortcut focuses it », cible française par défaut, animations réduites sans option.
- `docs/UI-DECISIONS.md:5, 6, 8, 9, 10, 21, 22, 31` : sections anciennes remplacées (les annoter).
- `docs/UI-FOUNDATION.md:3, 20, 22` : tokens 180/140/100 ms et « jamais de dimensions animées »
  (voir §4.3 : on anime désormais les dimensions **à l’intérieur** d’une fenêtre réservée).
- `docs/UI-ITERATION.md:76-78, 106, 167, 188` ; `docs/BRIDGE.md:9, 15, 57, 83, 84` ;
  `docs/RECETTE.md:3, 9, 10, 22, 24, 25, 33-43` ; `README.md:3, 36, 61, 66-77` ;
  `docs/GLASS-FRONTEND.md`, `docs/GLASS-MATERIAL.md`.
- `docs/UI-ISSUES.md` : rouvrir ou remplacer **UI-023** (spinner rejeté) ; marquer UI-002, 003, 004,
  009, 010, 013, 015, 021, 024, 025 comme obsolètes ; UI-027 devient le lot 9 ; mettre à jour
  la liste « Ordre ».

---

## 4. Architecture cible

### 4.1 Le parcours complet

```
Raccourci (Ctrl+Alt+Espace) ─► capture UIA (texte + TOUS les rectangles de lignes)
   │                               └─ repli : copie synthétique (pas de rectangles → pas d’effet sur le texte)
   ▼
Îlot ouvert à côté de la sélection (fenêtre overlay, clavier actif)
   │  Entrée / lettre / tuile / consigne libre
   ▼
Îlot ──ressort──► pilule (Perle)            + balayage de lumière sur les lignes (fenêtre « halo »)
   │  250 ms avant d’afficher l’orbe          (seulement si l’app a fourni les rectangles)
   ▼  réponse (0,4–4 s)
revalidation de la cible ─► collage (existant) ─► relecture
   │ succès                                    │ échec
   ▼                                           ▼
pilule repositionnée sous le NOUVEAU texte      pilule d’erreur (+ résultat à copier)
✓ tracée + Annuler 8 s (compte à rebours)
mots changés surlignés (fenêtre « halo ») pendant 8 s
   ▼
fondu de sortie (pilule + surlignage ensemble)
```

Le mode « Afficher le résultat » (sans remplacement) et la traduction longue restent disponibles
mais ne sont plus le cœur (§5, lot 11).

### 4.2 Fenêtres natives

| Fenêtre | Rôle | Changements |
|---|---|---|
| `overlay` (existe) | Îlot, pilule, erreurs, carte de résultat | Réserve de taille recalculée pour l’Îlot (grille ≈ 222×112 + halo). Clavier actif pendant le menu (§5, lot 3). `WS_EX_NOACTIVATE` hors menu. |
| `halo` (**nouvelle**) | Balayage pendant le travail, surlignage des mots changés après | Transparente, jamais cliquable (`WS_EX_TRANSPARENT | WS_EX_LAYERED | WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW`), au-dessus de l’app source, sous `overlay`. Dimensionnée sur l’union des rectangles de lignes + marge. |
| `settings` (existe) | Réglages | Thème clair/sombre, nouvelles sections, liens directs vers un champ. |
| `capsule` | Retirée de fait | La supprimer de `tauri.conf.json`, `lib.rs`, `host.rs`, du front et des tests (elle n’est plus jamais affichée). |

### 4.3 Règle de mouvement (remplace UI-FOUNDATION:22)

- **Jamais** de `SetWindowPos` pendant une animation (leçon UI-010 : un redimensionnement natif par
  image est impossible à lisser).
- La fenêtre `overlay` est **réservée** une fois par session à la plus grande forme possible
  (grille de l’Îlot ou carte d’erreur) ; **dans** cette fenêtre, le DOM anime librement la largeur,
  la hauteur et le rayon de la surface (menu → pilule), ce qui est peu coûteux sur une si petite
  surface. Les régions de hit-test sont republiées **à la fin** du ressort (et au début, sur la
  plus grande des deux formes, pour ne jamais rendre cliquable un vide).
- Le contenu reste centré dans la forme qui change (`left:50%; top:50%; transform: translate(-50%,-50%)`
  dans une couche en `position:absolute`, comme `.surface .layer` du labo).
- Déplacer la pilule après le remplacement = déplacer la **fenêtre** (une seule fois, sans animation
  native) pendant que la pilule est invisible, **ou** réserver une fenêtre assez haute pour contenir
  les deux positions et animer `top` dans le DOM. Recommandé : la seconde, sinon un « saut ».

---

## 5. Lots d’implémentation

Chaque lot : objectif, fichiers, outils et paquets, accrocs, critères de fin.

### Lot 0 — Préparation

- Branche `da-ilot` depuis `main`. Mettre à jour les documents du §3.
- Ajouter un réglage caché `uiVersion: 'v4' | 'ilot'` (ou un drapeau de compilation) pour garder
  l’ancien parcours pendant la migration, retiré à la fin.
- **Tests existants qui figent l’ancienne UI** et devront être réécrits (pas supprimés sans
  remplaçant) : `e2e/ui.pw.ts` (pilule 60×28 + `wait-spin`, bulle 380 px rayon 28, graphite
  rgba(24,26,31,.96), menu 196 px, pilule 76×28…), `e2e/native-bridge.pw.ts` (réserve 444×334,
  frame et régions exactes, `dismiss` 900 ms après `applied`), `e2e/reported-defects.pw.ts`
  (pilule 60×28 sans `.loading-ring`), `visual-tests/` (23 références), `scripts/probe-native-ui.mjs`
  (libellés français « Copier la traduction », « Fermer »). Les tests de comportement (poignée de
  fermeture, revalidation, raccourcis refusés, sauvegarde) restent valables.
- Critère : `npm test`, `npm run build`, `cargo test` verts sur la branche, docs cohérents.

### Lot 1 — Fondations visuelles : tokens, thème, icônes, langue

- **Tokens CSS** (`src/styles.css`, nouveau `src/theme.css`) : variables pour clair et sombre,
  valeurs exactes au §9. Surface : fond, liseré (`box-shadow: 0 0 0 .5px`), reflet du haut
  (`inset 0 1px 0`), éclat diagonal, ombres en deux couches, rayon 16 (grandes surfaces) et
  hauteur/2 (pilule). Encre `29 29 31` en clair, `245 246 248` en sombre (variable `--ink-rgb`
  utilisée par les indicateurs).
- **Thème** : dans WebView2, `prefers-color-scheme` suit le mode d’application de Windows.
  Le vérifier sur le PC ; sinon lire `HKCU\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize\AppsUseLightTheme`
  côté Rust et l’envoyer (événement `theme-changed`, écoute de `WM_SETTINGCHANGE` « ImmersiveColorSet »).
  Poser `data-theme="light|dark"` sur `<html>` ; réglage utilisateur « Thème : suivre Windows / clair / sombre ».
- **Icônes** : `lucide-react` est déjà installé (1.43.0) ; `strokeWidth={1.5}`, taille 14–16.
  Correspondance : Corriger `SpellCheck`, Traduire `Languages`, Pro `BriefcaseBusiness`,
  Raccourcir `FoldVertical`, Mail `Mail`, Consigne `WandSparkles`, Annuler `Undo2`, Réglages
  `Settings2`, Erreur `TriangleAlert`, Clé `KeyRound`, Serveur `Server`, Modèle `Cpu`
  (les 12 vérifiés présents dans lucide-react 1.43.0, déjà installé).
- **Langue EN/FR** : pas de dépendance ; un module `src/i18n.ts` (dictionnaire typé
  `Record<Key, {en, fr}>`, `t(key, params)`), langue dans `Settings.language` (défaut `en`).
  Les erreurs Rust deviennent des **codes** (lot 10), traduits côté front. Mettre à jour BRIDGE.md:15.
- **Accroc** : les noms d’actions par défaut sont des données utilisateur ; ne les traduire qu’à la
  création (migration des réglages : ne pas renommer une action déjà personnalisée).
- Critère : fenêtre Réglages et overlay lisibles en clair et en sombre (contraste ≥ 4,5:1 mesuré),
  bascule EN/FR sans rechargement.

### Lot 2 — Système de mouvement

- **Outil** : `motion` 13 (déjà dans `package.json`, `motion/react`). Garder `MotionConfig`.
- **Ressorts** : Motion accepte `{ type: 'spring', visualDuration, bounce }`. Conversion depuis les
  réglages Apple du labo (durée *d*, rebond *b*) : `visualDuration = d / 1.2`, `bounce = b`
  (même raideur, même amortissement ; vérifié dans la recherche sur le code de Motion). Valeurs au §9.
- **Pour le CSS pur** (indicateurs, surlignage) : courbes `cubic-bezier` du §9 ; si un ressort CSS
  est nécessaire, générer une chaîne `linear()` avec `design-lab/src/spring.js` (`springToLinear`,
  testé) au moment du build, pas à l’exécution.
- **Animer la surface** : `animate(element, { width, height, borderRadius }, spring)` de `motion`
  (pas `layout`, qui passe par `scale` et déformerait le texte et les icônes). Contenu centré (§4.3).
- **Animations réduites** : nouveau réglage `motion: 'system' | 'full' | 'reduced'`.
  `MotionConfig reducedMotion` = `'user' | 'never' | 'always'` selon ce réglage, et
  `data-motion` sur `<html>` pour le CSS (remplacer les `@media (prefers-reduced-motion)` globaux de
  `glass.css:112` et `styles.css:131` par des sélecteurs `[data-motion="reduced"]`).
  En réduit : fondus d’opacité ≤ 150 ms seulement ; pas de ressort, pas de déplacement, boucles des
  indicateurs en pause (orbe fixe), balayage remplacé par un voile fixe. Côté Rust, lire
  `SPI_GETCLIENTAREAANIMATION` n’est utile que pour afficher « Windows demande de réduire les
  animations » dans les Réglages.
- **Accroc** : Lucas avait « Effets d’animation » coupé sans le savoir ; afficher cette phrase dans
  les Réglages quand le mode est « suivre Windows » et que Windows réduit.
- Critère : tests unitaires de conversion (durée/rebond → visualDuration), et vidéo de la vraie
  fenêtre en « smooth » et « bouncy ».

### Lot 3 — Clavier et focus pour le menu (natif, risque élevé)

Aujourd’hui la fenêtre `overlay` ne prend jamais le focus (`SWP_NOACTIVATE`, `host.rs:528`) et seul
Échap est capté par un crochet bas niveau (`host.rs:171-189`). L’Îlot a besoin d’Entrée, des lettres,
de Tab, des flèches et d’un champ de saisie libre.

- **Recommandé** : activer `overlay` à l’ouverture du menu (`host::activate`, déjà utilisé par
  `focus_overlay`), puis réactiver la source avant le collage : `capture::paste(..., reactivate=true)`
  existe déjà (`SetForegroundWindow(source)` + 60 ms, `capture.rs:339-346`) avec revalidation.
- **Accrocs** :
  - `validate_target` exige que la source soit au premier plan : l’appeler **après** la réactivation.
  - Certaines applications effacent ou grisent la sélection quand elles perdent le focus ; l’Îlot
    s’affiche quand même à côté des rectangles déjà capturés. À tester : Word, Outlook, Chrome,
    Edge, Teams, Notepad, VS Code.
  - Restrictions de `SetForegroundWindow` : notre processus vient de recevoir le raccourci, donc
    l’activation est permise ; si elle échoue, retomber sur le crochet clavier bas niveau limité aux
    touches du menu (Entrée, Échap, Tab, flèches, lettres d’action), sans champ libre.
  - IME, touches mortes et AZERTY : le champ de consigne est un vrai `<input>` dans une fenêtre
    active, donc aucun traitement spécial ; ne pas saisir la consigne via un crochet.
  - Échap : fermer le menu **et** rendre le focus à la source sans rien coller.
- Après le menu (pilule, résultat) : ajouter `WS_EX_NOACTIVATE` et répondre `MA_NOACTIVATE` à
  `WM_MOUSEACTIVATE` pour qu’un clic sur Annuler ne vole pas le focus (absent du code aujourd’hui).
- Critère : sur 7 applications, ouvrir l’Îlot, choisir au clavier, taper une consigne avec accents,
  Échap ; la source retrouve le focus et sa sélection chaque fois.

### Lot 4 — Raccourci, liaisons et déclenchement

- **Modèle** (`actions.rs`, `types.ts`) : une liaison vise soit une action (`kind: 'action'`,
  comportement actuel), soit **le menu** (`kind: 'menu'`). Liaison par défaut : menu sur
  Ctrl+Alt+Espace (à confirmer). Migration : l’ancienne liaison `Ctrl+Alt+T → translate-fr` reste
  (ou est proposée) comme liaison directe.
- `parse_shortcut` accepte déjà Ctrl+Alt+Espace (Ctrl ou Alt requis). **Ne pas** proposer Ctrl+Alt
  seul : il faudrait un crochet clavier permanent et il se déclencherait avec AltGr (@, €, #).
  Signaler dans l’enregistreur de raccourci les combinaisons qui entrent en conflit avec AltGr sur la
  disposition active (AZERTY AFNOR : Ctrl+Alt+T = `{`, +E = €…).
- **Double appui** du raccourci du menu dans les 400 ms = relancer la dernière action sans afficher
  le menu (chemin le plus rapide).
- **Dernière action** : mémorisée **par application** (nom du processus source → identifiant
  d’action), jamais le texte. Fichier de réglages ou petit magasin séparé.
- **Mode « point à chaque sélection »** (option, lot tardif) : demande de détecter les sélections à
  la souris dans toutes les applications (crochet souris bas niveau pour le relâchement du bouton +
  lecture UIA de la sélection), un point de 16–20 px `WS_EX_NOACTIVATE` qui ne prend jamais le focus,
  qui disparaît à la première touche, et des exclusions par application. Coût et risques réels ;
  à faire après tout le reste.
- Critère : les deux types de liaisons fonctionnent, conflit AltGr signalé, double appui testé.

### Lot 5 — Capture des rectangles de la sélection (natif)

- `capture.rs:65-75` ne garde que le **dernier** rectangle de `GetBoundingRectangles()`. Garder
  **tous** les rectangles (une entrée par ligne), en pixels physiques, convertis en logiques par
  écran, et les exposer : `Capture.selectionRects: Rect[]` (et `anchor` = dernier, pour la
  compatibilité).
- Plafonner (ex. 64 rectangles) ; au-delà, garder premier, dernier et la boîte englobante.
- Le repli par copie synthétique n’a pas de rectangles : **pas d’effet sur le texte** dans ce cas,
  pilule seule, ouverte en bas de l’écran comme aujourd’hui.
- **Accrocs** : certaines applications (Electron, champs web anciens, terminaux) renvoient des
  rectangles vides ou faux ; les ignorer s’ils sont hors de la fenêtre source ou de taille nulle.
  Défilement ou déplacement de la fenêtre pendant le travail : `watch_context` détecte déjà le
  déplacement (`lib.rs:1238-1277`) → cacher le halo.
- Critère : rectangles corrects dans Word, Outlook, Chrome, Edge, Notepad ; test unitaire de la
  conversion physique → logique multi-écran (100 %, 150 %, 200 %).

### Lot 6 — Fenêtre « halo » : balayage pendant le travail

- Nouvelle fenêtre Tauri `halo` (`tauri.conf.json`), transparente, jamais cliquable, sans ombre,
  créée au démarrage et cachée. Page `/?window=halo`.
- Positionnée sur l’union des rectangles (+ 12 px de marge pour la lueur), au-dessus de la source,
  sous `overlay` (`SetWindowPos` avec `hWndInsertAfter` = `overlay`).
- Contenu : une `div` par rectangle de ligne, rayon 3 px, avec l’effet **Balayage de lumière**
  (CSS exact de `design-lab/src/app.css`, classe `.tfx-sweep` : dégradé 100° violet/rose/ambre à
  alpha 0,32, `background-size: 300%`, 1,6 s, `cubic-bezier(.4,0,.2,1)`). Le dégradé doit être
  **continu d’une ligne à l’autre** : une seule animation de `background-position` calculée sur la
  largeur totale (ou `background-attachment` sur un conteneur commun).
- Apparaît avec le même délai que l’orbe (250 ms), disparaît en fondu (150 ms) à la réponse.
- **Accrocs** : cette fenêtre dessine **par-dessus** le texte, elle ne le recolore pas ; garder
  l’alpha bas (≤ 0,35) pour ne pas gêner la lecture. Mode sombre de l’application source : le même
  dégradé fonctionne ; le vérifier dans Outlook en sombre. Garder un `pass_through` permanent (ne
  pas l’ajouter au testeur de régions de 8 ms).
- Critère : balayage visible sur les bonnes lignes dans 5 applications, aucun clic intercepté.

### Lot 7 — L’Îlot (front + contrat)

- Composant `src/menu/Ilot.tsx`, repris de `design-lab/src/menus.jsx` (`Ilot`) : états `compact`,
  `grid`, `prompt`. Tuiles 66×50, grille 3×2, écart 4, marge 6 (≈ 222×112) ; compact ≈ 110×32 ;
  champ ≈ 262×34.
- Accessibilité : `role="menu"` + `menuitem` (ou grille ARIA), focus visible, `aria-keyshortcuts`
  pour les lettres. Radix DropdownMenu n’est pas adapté (forme libre, morph) : implémenter le
  focus itinérant à la main.
- **Plus de 6 actions** : 6e tuile « Plus » → seconde page de tuiles ; ordre fixe choisi par
  l’utilisateur (ne jamais réordonner automatiquement, seule la surbrillance suit la dernière action).
- **Lettres** : champ `key` par action (unique, une lettre), défaut = première lettre libre du nom ;
  ne pas utiliser de lettre pour une action et dans une consigne commençant par cette lettre : une
  lettre enregistrée lance l’action, toute autre lettre ouvre le champ avec cette lettre.
- **Consigne libre** : nouvelle donnée dans la requête `translate` : `instruction?: string`
  (1–1000 caractères, sans NUL, jamais journalisée). Côté Rust, prompt système = gabarit
  « réécris selon cette consigne » + consigne ; même règles de sortie que les autres actions.
  Historique des consignes (↑) : local, facultatif, jamais de texte source.
- **Ouverture** : fondu + échelle 0,97 + glissement 4 px (ressort « entrée », §9), origine du
  transform vers la sélection. **Transformation** menu → pilule : ressort « morph » (§4.3).
- **Accroc** : la réserve de fenêtre (`layout.ts`) doit couvrir la grille et le champ ; nouveaux
  `anchoredReserve`/`frame` à définir et à documenter dans BRIDGE.md.
- Critère : tests Playwright au clavier et à la souris (repris de ceux du labo), tests unitaires de
  la table de touches.

### Lot 8 — Chargement : pilule et orbe

- Composants `Perle`, `Nebuleuse`, `Ruban` (`src/loaders/`), CSS **copié à l’identique** de
  `design-lab/src/loaders.css` (sélecteurs `.perle`, `.neb`, `.sinus.ruban`) avec leurs paramètres
  par défaut (§9). `@property --a` n’est pas utilisé par ces trois-là.
- Pilule : hauteur 28, largeur 44 (Perle/Nébuleuse) ou 52 (Ruban), rayon 14, contenu centré.
  L’orbe apparaît après **250 ms** (fondu 150 ms) : une réponse plus rapide n’affiche que la
  pilule vide pendant la transformation, sans clignotement. Pas de libellé.
- Réglage « Indicateur : Perle / Nébuleuse / Ruban » dans les Réglages (défaut Perle).
- **Accroc** : `mix-blend-mode: multiply` de la Nébuleuse doit passer en `screen` en thème sombre
  (déjà dans le labo). Mettre les boucles en pause quand l’overlay est caché
  (`animation-play-state`) pour ne rien consommer en arrière-plan.
- Critère : pilule centrée au pixel (mesure Playwright comme dans le labo), capture et vidéo native.

### Lot 9 — Résultat : collage, repositionnement, coche, Annuler, mots changés

- **Collage** : inchangé (`capture::paste`, relecture, `Keeper`), déclenché automatiquement pour une
  liaison menu (le menu est toujours en mode « remplacer »).
- **Nouvelle portée du texte collé** : après le collage, la sélection est en général réduite au
  curseur. Pour placer la pilule et le surlignage, obtenir la plage du nouveau texte : via UIA,
  plage du document entre la position de départ enregistrée et le curseur, ou `FindText` du
  résultat près de l’ancienne position. Échec → pas de surlignage, pilule sous l’ancienne ancre
  décalée de la hauteur estimée.
- **Mots changés** : diff mot à mot dans le front (`design-lab/src/diff.js`, LCS testé sur 2 000 cas),
  puis rectangles des mots insérés via UIA (sous-plages de la nouvelle plage : `FindText` ou
  `Move(Word)`). Traduction, mail, consigne libre → **bloc entier**. Surlignage dans la fenêtre
  `halo` : fond `rgba(141,159,255,.32)`, apparition 260 ms, maintien pendant Annuler, disparition
  900 ms (`chg-hold` du labo).
- **Pilule** : ✓ tracée (`pathLength=1`, 260 ms `cubic-bezier(.65,0,.35,1)`, délai 80 ms) + bouton
  Annuler avec anneau de compte à rebours (8 s, pause au survol et au focus). Placée **sous la
  dernière ligne du nouveau texte**, jamais sur ses rectangles (test d’intersection) ; option
  « dans la marge » = à droite de la colonne de texte de la fenêtre source.
- **Annuler** — accroc majeur :
  - Option A (recommandée) : envoyer Ctrl+Z à la source après revalidation (même fenêtre, même
    contrôle, texte à la plage = résultat collé). Simple et natif. Risque : si l’utilisateur a tapé
    entre-temps, Ctrl+Z annule autre chose → cacher Annuler dès la première frappe dans la source
    (crochet ou `GetLastInputInfo` + vérification du texte).
  - Option B : resélectionner la nouvelle plage (UIA `Select`) et recoller l’original avec la même
    revalidation. Plus sûr sur le contenu, plus fragile selon les applications.
  - Ne jamais coller sans revalidation (règle AGENTS.md).
- **Réglages** : ✓ oui/non, Annuler oui/non + durée (2–20 s, défaut 8), mots changés oui/non.
- Critère : parcours complet dans Word, Outlook, Chrome (textarea), Notepad ; Annuler fonctionne et
  refuse proprement si le texte a changé ; aucune pilule sur le nouveau texte.

### Lot 10 — Erreurs classées et liens vers les Réglages

- Aujourd’hui les erreurs sont des chaînes françaises (`inference.rs:222, 281-298`), 401 et 404
  confondus. Introduire `ErrorKind` (Rust, sérialisé en code) : `unreachable`, `timeout`,
  `unauthorized` (401/403), `model_not_found` (404 + corps « model »), `bad_endpoint` (404 hors
  modèle), `busy` (429/503), `length`, `stream_broken`, `paste_blocked`, `target_changed`,
  `not_editable`, `too_long`, `cancelled`. Garder la règle : jamais le corps de la réponse serveur
  dans le message ni dans un journal.
- Front : textes EN/FR par code ; bouton selon le type : configuration → `open_settings({ field:
  'endpoint' | 'apiKey' | 'model' })`, transitoire → Réessayer, collage → Copier le résultat.
- Réglages : défiler jusqu’au champ, le mettre en évidence 2,8 s (pulsation), focus dedans
  (maquette du labo, `MockSettings`).
- Pilule d’erreur compacte (icône `TriangleAlert`, texte ≤ 6 mots, un bouton, ✕). Même forme et
  même mouvement que la pilule de chargement, fondu de contenu 150 ms, pas de secousse.
- Critère : chaque code déclenché par un serveur factice (tests Rust + Playwright).

### Lot 11 — Mode « Afficher le résultat » et traduction longue (secondaire)

- Garder la carte de résultat existante (courte / bande de lecture) mais dans la nouvelle matière,
  les nouvelles icônes et le nouveau mouvement. Pas de nouvelle conception tant que Lucas n’a pas
  tranché (la bande de lecture « n’est plus centrale »).
- Accroc : les tests e2e de la bande (largeur moitié d’écran, 22/33 px, indicateur de défilement)
  restent valables pour le comportement ; seules les valeurs visuelles changent.

### Lot 12 — Matière : verre peint d’abord, Acrylic en essai

- **Phase A (sans risque)** : verre « peint » en CSS. Une fenêtre WebView2 transparente ne voit pas
  le bureau : `backdrop-filter` n’y floute rien. Utiliser les tokens du §9 **avec une opacité
  relevée** (fond clair ≈ 0,90–0,94, sombre ≈ 0,86) pour rester lisible sur n’importe quel fond ;
  garder reflet, liseré, éclat et ombres. C’est la version « Clair sans transparence » du labo.
- **Phase B (essai d’un à deux jours, décision de Lucas ensuite)** : vrai Acrylic Windows.
  - Une fenêtre **par surface** (pilule, menu) dimensionnée exactement à la surface, sans halo.
  - `DwmSetWindowAttribute(DWMWA_SYSTEMBACKDROP_TYPE, DWMSBT_TRANSIENTWINDOW)` +
    `DWMWA_WINDOW_CORNER_PREFERENCE = DWMWCP_ROUND` + `DwmExtendFrameIntoClientArea(-1)` +
    `DWMWA_USE_IMMERSIVE_DARK_MODE` selon le thème (ajouter les fonctionnalités `Win32_Graphics_Dwm`
    et `Win32_UI_Controls` à la dépendance `windows`).
  - Garder le matériau « actif » alors que la fenêtre ne l’est pas : `WM_NCACTIVATE(TRUE, -1)` dans
    `silent_frame_proc`.
  - Afficher/cacher par `DWMWA_CLOAK` plutôt que `SW_HIDE` (l’Acrylic se perd ou devient Mica
    après un masquage, tauri#12854).
  - Repli automatique vers la phase A : Windows 10, transparence désactivée, économiseur d’énergie,
    contraste élevé, bureau à distance.
  - **Coûts connus** : coins imposés à 8 px (la pilule n’est plus parfaitement ronde), pas de fondu
    CSS de la matière, pas de morph natif (changer de forme = masquer, redimensionner, réafficher).
    Ces coûts vont à l’encontre du morph de l’Îlot : **à arbitrer par Lucas** après avoir vu l’essai.
  - Option écartée par défaut : capture de l’écran sous la pilule (vrai flou, mais pixels de l’écran
    en mémoire → question de confidentialité à poser à Lucas).
- Critère phase B : Acrylic visible pendant que l’app source garde le focus, 50 cycles
  afficher/cacher sans perte, pas de cadre gris, repli correct quand la transparence est coupée.

### Lot 13 — Fenêtre Réglages (chantier séparé, minimum requis)

- Nouvelles sections : Menu (liaison, position, dernière action), Actions (ordre, lettres, grille),
  Après remplacement (✓, Annuler + durée, mots changés), Apparence (thème, indicateur, animations),
  Langue, Connexion (profils ; niveau de réflexion **mis de côté**), Historique.
- Identifiants stables sur les champs pour les liens directs des erreurs.
- Thème clair/sombre (aujourd’hui graphite seulement, UI-005).

### Lot 14 — Tests, validation et livraison

- **Unitaires** : conversions de ressorts, diff mot à mot, table de touches de l’Îlot, classement
  des erreurs (Rust), conversion des rectangles.
- **Playwright (navigateur)** : réécrire les specs du lot 0 pour l’Îlot, la pilule, la coche,
  Annuler, les erreurs ; mesures de centrage et de non-recouvrement comme dans le labo.
- **Pont simulé** (`e2e/native-fixture.ts`) : nouveau contrat de réserve, de régions et des
  fenêtres `halo`.
- **Références visuelles** : régénérer (`npm run ui:reference`) **après** revue par Lucas, en clair
  et en sombre (`visual-tests/README.md:11-13` prévoit l’émulation du thème).
- **Sonde native** (`scripts/probe-native-ui.mjs`) : libellés anglais, nouvelles fenêtres.
- **Recette manuelle** (à réécrire dans RECETTE.md) : Word, Outlook, Chrome, Edge, Teams, Notepad,
  VS Code ; AZERTY et QWERTY ; 100/150/200 % ; deux écrans ; thème clair et sombre ; animations
  réduites ; serveur coupé, clé fausse, modèle absent ; sélection modifiée pendant le travail.
- **Version** 0.5.0, notes de version, installateur par la CI existante.

---

## 6. Accrocs et risques (récapitulatif)

| Risque | Gravité | Parade |
|---|---|---|
| Focus : le menu doit capter le clavier sans perdre la sélection de la source | Élevée | Activer `overlay` pendant le menu, réactiver la source avant collage (existant), tester 7 apps ; repli crochet clavier limité. |
| Rectangles UIA absents ou faux selon les apps | Moyenne | Pas d’effet sur le texte, pilule seule ; filtre des rectangles aberrants. |
| Plage du texte collé difficile à retrouver | Moyenne | UIA depuis la position de départ ; sinon pas de surlignage, pilule sous l’ancre. |
| Annuler par Ctrl+Z annule autre chose | Élevée | Cacher Annuler dès une frappe dans la source ; revalider le texte ; option B (recoller l’original). |
| Ctrl+Alt+lettre = AltGr sur AZERTY | Élevée | Ctrl+Alt+Espace par défaut ; avertissement dans l’enregistreur. |
| Verre : pas de flou possible sans Acrylic | Moyenne | Phase A peinte ; phase B en essai, arbitrée par Lucas. |
| Acrylic : coins 8 px, pas de fondu, pas de morph | Élevée si retenu | Documenté ; décision après essai. |
| Animations coupées par Windows à l’insu de l’utilisateur | Moyenne | Réglage « toujours », phrase explicative. |
| Redimensionnement natif pendant une animation | Élevée | Fenêtre réservée, animation dans le DOM seulement (§4.3). |
| Lisibilité du balayage sur le texte | Faible | Alpha ≤ 0,35, durée 1,6 s, désactivable. |
| Performance (boucles CSS dans une fenêtre cachée) | Faible | `animation-play-state: paused` hors affichage. |
| Tests existants qui figent l’ancienne UI | Certain | Réécriture au lot 14, pas de suppression sans remplaçant. |
| Consigne libre mal suivie par un petit modèle | Moyenne | Gabarit de prompt court et explicite ; tests de qualité à part (UI-028). |

---

## 7. Ordre et jalons

1. **Jalon A — Fondations** : lots 0, 1, 2 (aucun changement de comportement).
2. **Jalon B — Le menu** : lots 3, 4, 7 (Îlot fonctionnel au clavier, remplacement existant).
3. **Jalon C — Le travail visible** : lots 5, 6, 8 (rectangles, balayage, pilule Perle).
4. **Jalon D — Le résultat** : lots 9, 10 (coche, Annuler, mots changés, erreurs).
5. **Jalon E — Finitions** : lots 11, 13, 14, puis l’essai Acrylic (lot 12 phase B) et la décision.

Montrer chaque jalon à Lucas dans la vraie fenêtre avant le suivant.

---

## 8. Questions ouvertes pour Lucas

1. Raccourci du menu : **Ctrl+Alt+Espace** (recommandé) ou autre ?
2. Annuler : Ctrl+Z envoyé à l’application (option A) ou recoller l’original (option B) ?
3. Après l’essai Acrylic : vrai verre avec coins 8 px et sans morph natif, ou verre peint ?
4. Mode « Afficher le résultat » et traduction longue : les garder tels quels (restylés) ou les
   repenser plus tard ?
5. Mode « point à chaque sélection » : à faire dans cette version ou plus tard ?
6. Combien d’actions au maximum dans la grille avant une seconde page (6 ? 8 ?) ?

---

## 9. Valeurs exactes (à reprendre telles quelles)

### Mouvement (préréglage Apple « smooth », variante « bouncy »)

| Usage | Labo (Apple : durée, rebond) | Motion (`visualDuration`, `bounce`) | CSS |
|---|---|---|---|
| Apparition (menu, pilule) | ressort 0,40 s, 0 | 0.333, 0 | — |
| Transformation (menu → pilule, repositionnement) | ressort 0,45 s, 0 | 0.375, 0 | — |
| Variante « bouncy » | 0,40 s / 0,45 s, rebond 0,3 | 0.333 / 0.375, 0.3 | — |
| Disparition | — | — | `cubic-bezier(0.23,1,0.32,1)` 170 ms |
| Fondu de contenu | — | — | `cubic-bezier(0.23,1,0.32,1)` 200 ms |
| Échelle / glissement de départ | 0,97 / 4 px | — | — |

Formules (recherche, vérifiées sur la doc Apple et le code de Motion) :
raideur = (2π / d)², amortissement = 4π(1 − b) / d (masse 1) ; `visualDuration = d / 1.2`.
Durée CSS d’un ressort = temps d’établissement (ex. `.smooth(0.3)` → 475 ms), pas la durée perçue.

### Matière — clair (« verre Apple clair ») et sombre (« verre sombre »)

| Token | Clair | Sombre |
|---|---|---|
| Fond | dégradé vertical `rgb(250 250 252 / .80)` → `/ .72` (phase A : .94 → .90) | `rgb(28 30 34 / .62)` (phase A : ≈ .86) |
| Flou / saturation (Acrylic ou labo seulement) | 22 px / 180 % | 24 px / 170 % |
| Liseré | `0 0 0 .5px rgb(0 0 0 / .08)` | `0 0 0 .5px rgb(255 255 255 / .14)` |
| Reflet du haut | `inset 0 1px 0 rgb(255 255 255 / .85)`, `inset 0 -1px 0 rgb(0 0 0 / .04)` | `inset 0 1px 0 rgb(255 255 255 / .12)` |
| Éclat diagonal | `linear-gradient(135deg, rgb(255 255 255 / .35), rgb(255 255 255 / .05) 30%, transparent 60%)` | alpha .08 |
| Ombre | `0 8px 26px rgb(0 0 0 / .12), 0 1px 3px rgb(0 0 0 / .07)` | `0 10px 30px rgb(0 0 0 / .30), 0 1px 3px rgb(0 0 0 / .18)` |
| Rayon | 16 px (menu, carte) ; hauteur/2 pour la pilule (≤ 44 px) | idem |
| Encre (`--ink-rgb`) | `29 29 31` | `245 246 248` |

Source exacte : `design-lab/src/data.js` (`MATERIAL_PRESETS`, `materialVars`).

### Indicateurs (paramètres par défaut)

- **Perle** : 14 px, tour 3 s, flou interne 2,5 px, respiration 0,9 ↔ 1 en 2,4 s, lueur 0,45 ;
  dégradé conique `#BC82F3, #F5B9EA, #8D9FFF, #AA6EEE, #FF6778, #FFBA71, #C686FF`.
- **Nébuleuse** : 16 px, dérive 3 px, flou 2 px, taches `#8D9FFF` (3,1 s), `#FF6778` (3,7 s),
  `#FFBA71` (4,3 s), `multiply` (clair) / `screen` (sombre).
- **Ruban** : 28×12, trois ondes `#8D9FFF`, `#FF6778`, `#FFBA71`, demi-périodes 6/8/10 px,
  1,2 s / 1,68 s inversée / 2,28 s, amplitude 0,35 ↔ 1, masque de fondu aux bords.
- Délai d’apparition : 250 ms. Source : `design-lab/src/loaders.css`, `loaders.jsx`.

### Sélection et résultat

- Balayage de lumière : dégradé 100° transparent 25 % → `rgba(141,159,255,.32)` 40 % →
  `rgba(188,130,243,.32)` 50 % → `rgba(255,186,113,.32)` 60 % → transparent 75 %,
  `background-size: 300% 100%`, 1,6 s `cubic-bezier(.4,0,.2,1)` en boucle.
- Mots changés : `rgba(141,159,255,.32)`, apparition 260 ms, maintien = durée d’Annuler (8 s),
  disparition 900 ms `ease-out`.
- Coche : tracé 260 ms `cubic-bezier(.65,0,.35,1)`, délai 80 ms. Annuler : 8 s, pause au survol.

### Îlot

- Compact ≈ 110×32 (bouton de la dernière action + séparateur + pastille IA), rayon = hauteur/2.
- Grille 3×2 de tuiles 66×50, écart 4, marge 6 → ≈ 222×112, rayon 16.
- Champ de consigne ≈ 262×34.
- Touches : Entrée = dernière action ; F T P S E ; 1–6 ; Tab ou ↓ = grille ; flèches dans la grille ;
  Espace ou `/` = consigne ; lettre non enregistrée = consigne pré-remplie ; Échap = retour puis fermeture.

### Correspondance labo → app

| Labo (`design-lab/src/`) | App (proposé) |
|---|---|
| `Surface.jsx` (morph, contenu centré, sortie) | `src/overlay/Surface.tsx` avec `motion` |
| `menus.jsx` → `Ilot` | `src/menu/Ilot.tsx` |
| `loaders.css` / `loaders.jsx` (Perle, Nébuleuse, Ruban) | `src/loaders/` |
| `app.css` `.tfx-sweep`, `.chg-hold`, `.check-draw`, `.undo-ring` | `src/halo/` et pilule |
| `diff.js` (LCS mot à mot) | `src/diff.ts` |
| `spring.js` (ressorts, `linear()`) | `src/motion/spring.ts` (build) |
| `data.js` `OUTCOMES` | codes d’erreur du lot 10 |
| `Simulator.jsx` `MockSettings` | lien direct vers un champ des Réglages |
