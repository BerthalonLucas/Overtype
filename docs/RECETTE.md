# Recette Windows

> Document historique (recette de la 0.6.0, 2 octobre 2026) : ne décrit plus l’état actuel. État actuel : [README.md](../README.md) et [docs/BRIDGE.md](../docs/BRIDGE.md).

Pour chaque passage, noter la version de l’application, l’échelle Windows, la configuration
des écrans, la disposition du clavier, le thème, et la preuve de chaque ligne (capture, vidéo,
résultat de sonde). Texte synthétique uniquement : une phrase courte, puis un paragraphe de
plusieurs lignes, puis un message plus long que la bande de lecture. Référence visuelle et de
mouvement : le labo design-lab/ (docs/DA-PLAN.md).

L’acceptation ne repose jamais sur une seule capture : vérifier l’identité de la sélection, le
focus et le contenu réel du presse-papiers avant et après. Ne fermer que les fenêtres lancées
pour le test et ne jamais arrêter une autre charge (processus GPU compris). Un exécutable de
test lancé depuis `src-tauri\target\release\` se lance avec `FLOWTRANSLATE_DATA_DIR` pointé
vers un dossier jetable, pour ne jamais toucher aux réglages ni à l’historique de
l’installation de Lucas (docs/UI-DECISIONS.md, décision 11 du 24 septembre 2026). Dans ce
document, « `settings.json` » désigne `<FLOWTRANSLATE_DATA_DIR>\settings.json` pour un
exécutable de test, sinon `%APPDATA%\com.flowtranslate.desktop\settings.json` pour
l’application installée ; `menu-memory.json` et `history.sqlite3` sont dans le même dossier.
Toujours quitter Overtype avant de modifier ce fichier à la main.

Consigner les résultats réels dans VALIDATION.md. Une case ne se coche qu’avec une preuve
consignée ; les listes ci-dessous sont une recette, pas une déclaration de tests réussis.

## Recette de la DA Îlot (0.5.0, branche `da-ilot`)

Cible : lot 14 de docs/DA-PLAN.md, décisions par défaut de la dernière section de
docs/UI-DECISIONS.md, contrat des sections « Îlot » de docs/BRIDGE.md. Les lignes décrivent ce
que le code livre au commit de cette recette, pas le plan quand ils diffèrent. Rien n’est coché
tant que la version n’est pas passée sur un vrai poste.

Chaque ligne : ce qu’on fait → ce qu’on attend. *Preuve* : ce qu’il faut consigner dans
VALIDATION.md. « Sentinelle » : une phrase synthétique copiée avant l’essai, puis recollée dans
le Bloc-notes après, pour voir si le presse-papiers est intact.

**État au commit de cette recette.** Le lot 9 est livré, natif et front (24/09/2026) : après un
collage, la pilule se pose sous le nouveau texte avec la coche et Annuler, et les mots changés
sont surlignés. La passe scriptée l’a déroulé une fois en vraie fenêtre dans Chrome, en clair et
en sombre (docs/DA-RAPPORT.md) : collage, pilule sous le texte sans le couvrir, surlignage des
mots changés, Annuler qui rend l’original, frappe qui retire Annuler. Le reste de ses lignes,
regroupées plus bas, reste à dérouler, notamment dans le Bloc-notes, Word et Outlook.

**Mise en valeur du texte (25/09/2026, choix de Lucas).** Le halo montre la sélection dès le
menu (zone de texte, lignes entières, texte exact), l’aurore et le reflet pendant le travail,
puis la vague et la lueur irisée des mots changés, gardée jusqu’à la prochaine action dans le
texte. Clair ou sombre d’après la couleur lue sous le texte. Les lignes 4 et 6 ci-dessous et la
section « Annuler, mots changés et place de la pilule » en tiennent compte.

### Avant de commencer

- Poste de Lucas au 24/09/2026. Installés : Chrome, Teams, Bloc-notes, VS Code. Absents : Word,
  Outlook, Edge (seul le runtime WebView2 est présent). Trois écrans à 100 % : 2560 × 1440
  (principal) et deux 1920 × 1080. Word, Outlook, Edge, 150 %, 200 % et les erreurs d’un vrai
  serveur sont à dérouler à la main par Lucas.
- [ ] Réglages, pied de fenêtre → `0.5.0`. *Preuve* : capture du pied.
- [ ] Raccourci déjà pris (UI-029). Sur le poste de Lucas, Claude desktop tient `Ctrl+Alt+Espace`.
  Au démarrage, les Réglages s’ouvrent, avec sous la ligne Menu › Shortcut : « Another app is
  already using Ctrl+Alt+Space… » (en français : « Une autre application utilise déjà… »).
  Ce n’est qu’un avertissement : l’enregistreur reste libre. Dessous, « Use Ctrl+Alt+Shift+Space »
  (retour du 24/09 : le premier raccourci libre parmi `Ctrl+Alt+Maj+Espace`, `Alt+Maj+Espace`,
  `Ctrl+Alt+Origine`) le prend d’un clic : « Shortcut saved. », l’avertissement disparaît, le
  raccourci ouvre l’Îlot. Sinon, enregistrer une autre combinaison ou libérer le raccourci dans
  Claude desktop, puis faire toute la recette avec cette combinaison. *Preuve* : capture de la
  ligne avec la proposition, combinaison retenue.
- [ ] Mise à jour depuis une 0.4 installée (pour un exécutable de test : copier le
  `settings.json` d’une 0.4 dans le dossier jetable avant le premier lancement) → l’Îlot est
  le parcours par défaut. Retour du 24/09, plus de mélange : une 0.4 jamais modifiée donne
  exactement les cinq actions anglaises d’une installation neuve, sans « Traduire en français »
  ni `Ctrl+Alt+T` en « Afficher le résultat ». Une action modifiée ou créée est gardée telle
  quelle (une consigne de « Corriger » changée : « Corriger » reste « Corriger ») ; une traduction
  de la 0.4 reste si un raccourci gardé la lance. Liaison du menu ajoutée sur `Ctrl+Alt+Espace`,
  sauf si une liaison gardée utilise déjà cette combinaison. Interface en anglais, fichier 0.4
  compris : repasser en français dans Appearance › Language. *Preuve* : capture des sections
  Menu et Actions.
- [ ] Rétablir les réglages par défaut (retour du 24/09). Sur cet appareil › Default settings ›
  « Restore… » → la question en place, « Keep my settings » a le focus, Échap garde tout. « Restore
  default settings » → « Default settings restored. » ; actions, raccourci du menu
  (`Ctrl+Alt+Espace`), grille, apparence et bulle comme à l’installation ; connexion (adresses,
  modèles, clés), historique, lancement à l’ouverture de session et langue inchangés ; l’Îlot
  repart sur l’action par défaut dans chaque application. Sur le poste de Lucas (`Ctrl+Alt+Espace`
  tenu par Claude desktop) : « …sauf le raccourci du menu : Windows n’a pas donné Ctrl+Alt+Space,
  le menu garde … », et le menu s’ouvre toujours. *Preuve* : captures avant et après des
  sections Menu, Actions et Connexion (clé masquée).

### Parcours par application

Sur une phrase, puis sur un paragraphe de plusieurs lignes :

1. **Îlot** : le raccourci l’ouvre 8 px sous la sélection, son bord droit sur la fin de la
   sélection (au-dessus s’il manque la place en bas). État compact : dernière action + pastille
   ✦. Choix par Entrée, par une lettre, par Tab puis flèches et Entrée, et à la souris.
2. **Consigne libre** : Espace, « / », la pastille ✦ ou la tuile Ask ouvrent le champ. Une
   consigne avec accents et touches mortes (« réécris ça plus sympa, prêt à envoyer »)
   s’écrit sans perte, Entrée l’envoie.
3. **Échap** : de la grille ou du champ, retour à l’état compact ; de l’état compact, l’Îlot se
   ferme, la source reprend le focus avec sa sélection, rien n’est collé.
4. **Mise en valeur** : dès l’ouverture du menu, la zone de texte est cernée, les lignes
   entières ont une bande pâle et le texte exact un calque. Au choix, sans délai, une aurore
   tourne autour de la zone de texte et un reflet passe sur les lettres sélectionnées ; un clic
   dessus atteint l’application. Sur fond sombre (thème sombre de l’application), les effets
   prennent leur version sombre. Sans rectangles (VS Code), rien : pilule seule.
5. **Résultat** : texte remplacé, la pilule sous le nouveau texte avec la coche et Annuler (8 s
   par défaut), puis plus rien. Sentinelle intacte.
6. **Annuler et mots changés** : voir plus bas.

| Application | Poste au 24/09/2026 | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|---|
| Word | absent : manuel, Lucas | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Outlook, thème clair et sombre | absent : manuel, Lucas | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Chrome : `textarea`, `contenteditable`, `input` | installé | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Edge | absent (seul WebView2) : manuel, Lucas | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Teams | installé | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Bloc-notes | installé | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| VS Code | installé | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |

*Preuve* par case : capture de l’Îlot ouvert (1), courte vidéo du balayage (4), sentinelle
recollée (5). Limites connues, à noter si vues, pas à corriger pendant la recette :

- VS Code : copie synthétique, sans rectangles ni ancre. L’Îlot et la pilule se posent en bas
  au centre de l’écran de la souris, sans balayage.
- Bloc-notes, première ligne du document : le balayage déborde vers le haut (UI-031).
- Bloc-notes, repli sans clavier : collage refusé proprement, rien n’est écrit (UI-030).

### Îlot au clavier : AZERTY et QWERTY

- [ ] QWERTY (États-Unis) puis AZERTY (France) : parcours 1 à 3 dans le Bloc-notes et dans
  Chrome. *Preuve* : disposition active notée, capture de l’Îlot.
- [ ] Lettres F, T, P, S, E (Fix grammar, Translate, Make professional, Shorten, Write email) →
  même action sur les deux dispositions. *Preuve* : action lancée, par disposition.
- [ ] Une lettre sans action (par exemple « r ») → le champ s’ouvre, déjà rempli de cette
  lettre.
- [ ] Chiffres 1 à 6 → la tuile de ce rang. La tuile Ask suit la dernière action (6 avec les
  cinq actions par défaut) ; un chiffre sans tuile ne fait rien. Sur AZERTY, avec l’Îlot au clavier, la rangée du haut sans Maj tape `&`, `é`, `"`…
  D’après le code (non vérifié en vraie fenêtre), ces touches ouvrent le champ pré-rempli au
  lieu de choisir une tuile. Maj + chiffre et le pavé numérique choisissent la tuile. Noter ce
  qu’on voit. *Preuve* : capture après la touche.
- [ ] AZERTY : `@`, `€`, `#`, `{` tapés avec AltGr dans la source n’ouvrent jamais l’Îlot ; dans
  le champ de l’Îlot, ils s’écrivent.
- [ ] Dans l’Îlot : F5, Ctrl+R, Ctrl+P, Ctrl+F, Ctrl + molette → rien (ni rechargement, ni
  impression, ni zoom). Ctrl+A, Ctrl+V et les flèches marchent dans le champ.
- [ ] Double appui du raccourci en moins de 400 ms → la dernière action de cette application
  part sans passer par le menu (l’Îlot, s’il a eu le temps de s’afficher, devient la pilule).
- [ ] Mémoire par application : choisir Shorten dans le Bloc-notes, Translate dans Chrome ;
  rouvrir l’Îlot dans chacun → l’état compact propose l’action de cette application.
  `menu-memory.json` (à côté de `settings.json`) ne contient que des noms d’exécutables et des
  identifiants d’actions. *Preuve* : capture des deux états compacts, fichier relu.

### Réglages de l’Îlot

- [ ] Actions › In the menu : réordonner, changer une lettre, retirer, ajouter → l’Îlot suit
  l’ordre (six tuiles au plus). Une lettre déjà prise est refusée avec le nom de l’action qui
  la tient.
- [ ] Retirer toutes les actions du menu → Réglages : « No action in the menu: only the free
  instruction. » Dans l’Îlot : grille réduite à Ask, aucune lettre ; l’état compact propose
  toujours la dernière action (sinon l’action par défaut du Menu).
- [ ] Enregistreur : `Ctrl+Alt+E` sur AZERTY → avertissement « …is also AltGr+E on this
  keyboard: you could no longer type €. », sans refus.
- [ ] Menu › Default action → l’action que propose l’Îlot dans une application encore jamais
  utilisée.
- [ ] Raccourci pris par une autre application → avertissement sous sa ligne (voir « Avant de
  commencer »). Une nouvelle combinaison déjà prise refuse l’enregistrement.

### Échelles et écrans

- [ ] 100 % : écran principal 2560 × 1440 et un écran 1920 × 1080.
- [ ] 150 % (manuel, Lucas) : Îlot, pilule et balayage alignés sur les lignes, texte net.
- [ ] 200 % (manuel, Lucas) : mêmes vérifications.
- [ ] Deux écrans : sélection sur un écran secondaire, y compris celui à coordonnées
  négatives. L’Îlot, la pilule et le balayage restent sur l’écran de la sélection, dans sa zone
  de travail, à la bonne échelle.
- [ ] Sélection qui finit près du bord gauche : l’Îlot reste au bout de la sélection tant qu’il
  a 283 px de place ; une pilule d’erreur, plus large, glisse vers la droite sans sortir de
  l’écran.
- [ ] Sélection en bas de l’écran : l’Îlot passe au-dessus et s’ouvre vers le haut.

*Preuve* : capture par échelle et par écran, avec l’échelle Windows notée.

### Thème, langue et animations

- [ ] Appearance › Theme : Follow Windows, Light, Dark → verre clair ou sombre sur l’Îlot, la pilule, le
  verre du résultat et les Réglages. Changer le thème de Windows pendant que l’app tourne →
  bascule sans relance.
- [ ] Lisibilité sur une page blanche, une page sombre et un fond chargé. En sombre, noter si
  le fond se lit à travers la grille (valeur `.86` à valider, décision 12 et
  docs/ACRYLIC-TRIAL.md).
- [ ] Appearance › Language : English ↔ Français → Réglages, Îlot, pilules d’erreur et menu de
  l’icône de notification changent de langue sans relance. Les noms des actions restent tels
  qu’écrits.
- [ ] Interface en anglais, liaison directe en mode « Afficher le résultat » vers une adresse
  sans serveur → le verre affiche le message d’erreur en français, suivi d’une aide en anglais.
  Limite connue de 0.5.0 : les erreurs du verre des liaisons directes restent en français.
- [ ] Animations « Follow Windows », avec « Effets d’animation » coupé dans Windows → mode
  réduit, et la ligne « Windows asks to reduce animations. » sous le réglage.
- [ ] Animations « Reduced » : fondus courts seulement, sans ressort ni déplacement. Orbe
  immobile, voile fixe à la place du balayage.
- [ ] Animations « Always » : ressorts même quand Windows réduit. Motion style « Smooth »
  (défaut) puis « Bouncy » : l’ouverture et le passage menu → pilule rebondissent.
- [ ] Appearance › Indicator : Perle (défaut), Nebula, Ribbon → l’orbe de la pilule change ;
  il n’apparaît qu’après 250 ms, une réponse plus rapide ne montre que la pilule vide.

*Preuve* : capture par thème et par langue, courte vidéo par réglage d’animation.

### Erreurs

Toujours sur le profil de la requête (Quality ou Fast), sur un texte de démonstration. Ne rien
arrêter côté GPU : provoquer les erreurs par les Réglages.

- [ ] Adresse sans serveur (par exemple un port libre) → pilule « Can’t reach the server »,
  bouton « Open endpoint ». Le bouton ouvre les Réglages sur le champ de l’adresse, qui pulse
  2,8 s avec le curseur dedans. Rien n’est remplacé.
- [ ] Clé fausse (401 ou 403, serveur protégé par clé) → « API key rejected », « Fix key » →
  champ de la clé.
- [ ] Nom de modèle faux (404) → « Model not found: <nom des Réglages> », « Choose model » →
  champ du modèle.
- [ ] Serveur occupé, trop lent ou réponse coupée (si l’occasion se présente) → « Try again » :
  la pilule repart, puis le résultat est collé après revalidation de la cible.
- [ ] Rien de sélectionné → « Select some text first », sans bouton ni ✕, disparaît en 4 s ;
  champ mot de passe → « Protected field, not read » ; plus de 6 000 caractères → « Selection
  too long (max 6,000 characters) ».
- [ ] Raccourci pressé avec les Réglages au premier plan → « Close Settings first ».
- [ ] ✕ ou Échap sur une pilule d’erreur → l’Îlot se ferme, rien n’est collé.
- [ ] Aucune pilule ni info-bulle de l’icône ne montre le texte, le résultat, la consigne, la
  clé ou la réponse du serveur. L’app n’écrit pas de journal : le dossier de données ne
  contient que `settings.json`, `menu-memory.json` et `history.sqlite3`. Ce dernier existe
  toujours (créé au démarrage), même historique coupé ; `history.sqlite3-wal` et `-shm`
  peuvent l’accompagner pendant que l’app tourne. Historique coupé, sa table `history` reste
  vide. *Preuve* : liste du dossier ; nombre de lignes de la table `history` (0 historique
  coupé) ; recherche d’un mot de la phrase de test dans les fichiers lisibles, sans résultat.

### Cible, sélection et presse-papiers

- [ ] Menu ouvert, clic dans le document ou passage à une autre application → l’Îlot se ferme,
  rien n’est collé.
- [ ] Après le choix, sélection modifiée, fenêtre déplacée ou texte défilé pendant le travail
  → balayage caché. À la fin, rien n’est remplacé : pilule « Text changed — not replaced »,
  bouton « Copy result » → « Copied », le résultat est dans le presse-papiers.
- [ ] Fenêtre au premier plan changée pendant le travail → aucun collage dans l’autre fenêtre ;
  même pilule.
- [ ] Presse-papiers modifié par l’utilisateur pendant l’opération → jamais restauré
  par-dessus.
- [ ] Application sans UI Automation ou élevée → repli par la copie synthétique, aucune
  injection privilégiée ; sinon « Read-only text, not replaced » et « Copy result ».

### Annuler, mots changés et place de la pilule

Natif et front livrés (lot 9, docs/BRIDGE.md, « Îlot: the result »). À dérouler en Chrome et
dans le Bloc-notes par la passe, et dans Word et Outlook à la main par Lucas, sur un texte de démonstration. Une fois avec After
replacing › How to undo sur « Ctrl+Z » (défaut, option A), puis sur « Paste original »
(option B).

- [ ] Après le collage, la pilule se pose 8 px sous la dernière ligne du nouveau texte, son bord
  droit sur la fin de cette ligne, sans toucher aucune ligne. En bas de l’écran, au-dessus de la
  première ligne. Avec Pill position « In the margin », à droite de la ligne la plus large.
- [ ] Après le collage, une vague de lumière parcourt le nouveau texte, puis les mots changés
  gardent une lueur irisée (plus profonde sur fond clair), visible sans cacher le texte, en
  clair comme en sombre. Translate, Write email et la consigne libre marquent le bloc entier.
  Highlight changed words coupé → aucune lueur.
- [ ] La lueur reste après la fin du compte à rebours d’Annuler et après le départ de la
  pilule, avec Undo coupé aussi ; elle part en fondu à la prochaine touche, au prochain clic
  (ailleurs que sur la pilule) ou à la molette, et au plus tard après Highlight time (1 min par
  défaut ; 15 s pour l’essai).
- [ ] Annuler dans les 8 s (réglable de 2 à 20 s, pause au survol) → l’original revient à
  l’identique (accents, espaces insécables, retours à la ligne) et la pilule affiche
  « Undone ». En « Ctrl+Z », la mise en forme de Word revient aussi. En « Paste original »,
  l’original est recollé en texte brut : dans Word, il prend la mise en forme du point
  d’insertion (limite connue, une mise en forme mixte ne revient pas) ; la sentinelle est
  intacte.
- [ ] Option A, une lettre tapée dans la source après le collage → Annuler disparaît et la
  lueur s’efface. Le Ctrl+Z de l’utilisateur annule le collage lui-même et retire aussi
  Annuler.
- [ ] Un clic ailleurs dans le texte → Annuler disparaît, la pilule reste, la lueur s’efface. Un
  défilement ou un déplacement de la fenêtre, pilule partie ou non → la lueur disparaît aussitôt.
- [ ] Texte collé modifié puis Annuler → refus propre, rien n’est modifié.
- [ ] Word : texte dans un tableau, puis dans une liste à puces → la pilule reste hors du texte.
  Si le texte collé n’est pas retrouvé (correction automatique de Word, par exemple), ni
  lueur ni Annuler : c’est attendu, à noter avec l’application.
- [ ] Outlook : corps d’un nouveau message puis d’une réponse, thème clair et sombre → mêmes
  points.

### Essai Acrylic (réglage caché `glassMaterial`, désactivé par défaut)

Décision de Lucas attendue sur docs/ACRYLIC-TRIAL.md (recommandation : garder le verre peint).
Ces lignes ne servent qu’à voir l’essai.

- [ ] Quitter Overtype (icône de notification › Quit). Dans `settings.json`, mettre
  `"glassMaterial": "acrylic"`, puis relancer. Le réglage n’apparaît jamais dans les Réglages.
- [ ] Menu compact, grille, pilule, coche : le verre peint pendant chaque changement de forme,
  puis le vrai Acrylic environ 0,8 s après que la forme s’est posée, avec des coins de 8 px.
  La source garde le focus. *Preuve* : capture au repos, courte vidéo du saut.
- [ ] Clic sur un coin de l’Acrylic → le clic atteint ce qu’il y a dessous.
- [ ] « Effets de transparence » coupé dans Windows, ou économiseur d’énergie → verre peint,
  sans fenêtre de fond (manuel, non vérifié par la passe).
- [ ] Modifier un réglage dans les Réglages → `"glassMaterial"` toujours présent dans
  `settings.json`.
- [ ] Revenir : `"painted"` ou retirer la clé, puis relancer.

### Général

- [ ] Au repos : aucune fenêtre ni bouton de barre des tâches, seulement l’icône de
  notification.
- [ ] Liaison directe (par exemple `Ctrl+Alt+T` gardé d’une 0.4) en mode Remplacer → pilule de
  travail avec l’orbe, collage, coche, puis plus rien. Si le collage échoue, le verre s’ouvre
  avec le résultat et Copier.
- [ ] Liaison directe en mode « Afficher le résultat » → verre court près de la sélection ou
  bande de lecture en bas, comportement de la 0.4.0 dans la nouvelle matière.
- [ ] Historique désactivé : ni source ni résultat persistés. Activé : charges chiffrées,
  suppression et rétention fonctionnent.
- [ ] Installateur puis redémarrage : app disponible, pas de lancement automatique sans
  accord.

## Parcours 0.4 derrière `uiVersion: "v4"`

Gardé pour dépanner et comparer. Pour y revenir : quitter Overtype, mettre
`"uiVersion": "v4"` dans `settings.json`, relancer. Pour revenir à l’Îlot : `"ilot"` ou retirer
la clé. Le réglage n’apparaît jamais dans les Réglages.

- [ ] Le raccourci du menu lance directement Menu › Default action et remplace la sélection :
  ni Îlot, ni balayage.
- [ ] Pilule avec l’ancien indicateur tournant, collage, ✓, puis plus rien. Si le collage
  échoue, le verre s’ouvre avec la raison (en français, comme en 0.4) et Copier.
- [ ] Liaison en mode « Afficher le résultat » : verre court ou bande de lecture, comme en
  0.4.0, dans la nouvelle matière claire ou sombre.
- [ ] Erreurs : le message français de la 0.4, pas les pilules de l’Îlot ni leurs liens vers
  les Réglages.
- [ ] Réglages : ni grille, ni After replacing, ni Indicator.
- [ ] Bloc-notes, remplacement direct : refusé proprement (UI-030), comme en 0.4.
- [ ] Sélection modifiée, fenêtre changée, presse-papiers modifié pendant l’opération : mêmes
  garanties qu’en 0.4 (rien de collé ailleurs, presse-papiers jamais restauré par-dessus).

## Historique : recette de la bulle graphite (0.1.x à 0.4.0)

Remplacée par la recette Îlot ci-dessus et gardée pour mémoire. La référence
`design/glass-reader/c-overlapping-pill.png`, la capsule, la confirmation avant envoi, le
focus par un second appui et le graphite translucide sont historiques (docs/DA-PLAN.md).

Record application version, Windows scaling, screen configuration and pass/fail evidence for each run. Use synthetic text only. Start with the approved short sentence, then a multiline paragraph and a message longer than the bottom reader viewport. Current visual reference: design/glass-reader/c-overlapping-pill.png.

| Scenario | Expected behavior | Status |
|---|---|---|
| Idle | No window/taskbar button except tray | Not run |
| Browser selected text | Small bubble at end, selection readable, source focus retained | Not run |
| Clipboard without selection | Small bottom capsule, explicit source confirmation before send | Not run |
| Repeat shortcut | Focus bubble for keyboard actions | Not run |
| Escape with source focused | Cancel/dismiss without editing source | Not run |
| Copy during generation | Unavailable | Not run |
| Normal completion | Copy copies exact final output | Not run |
| Truncated/server error | Clearly unavailable result, never insert partial text | Not run |
| Selection changed | Replacement unavailable/refused; original data untouched | Not run |
| Foreground window changed | Never paste into the new unrelated window | Not run |
| Clipboard changed during operation | Never restore old content over new clipboard | Not run |
| Window moved/scrolled | Correct re-anchor or explicit bottom fallback | Not run |
| Edge/Chrome input field | Explicit replacement only with verified target | Not run |
| Word/Outlook/Teams | Record each supported/unsupported actual version | Not run |
| UIA unavailable/elevated app | Safe clipboard fallback; no privileged injection | Not run |
| DPI100/125/150/200% |280 logicalpx bubble, correct anchor, legible15px text | Not run |
| Negative-coordinate monitor | Overlay remains within correct working area | Not run |
| Light/dark backdrop | Opaque readable text, translucent graphite only | Not run |
| Reduced motion | No animated expansion/translation | Not run |
| History off | No source/output persisted | Not run |
| History on | Encrypted local payloads, deletion/retention work | Not run |
| Wrong server/key | French actionable error, no credential/payload logging | Not run |
| Installer then restart | App available, no autostart without opt-in | Not run |

Acceptance is not based solely on a screenshot: verify selection identity, focus and actual clipboard contents before/after. Close only windows launched for this test, and never stop unrelated workloads.

### Régression verre et lecteur bas — 0.1.3

- Texte court : verre seul, pilule Copier/Plus chevauchant le bord supérieur droit, aucune première ligne masquée.
- Texte long : lecteur centré en bas du bon moniteur, aucune barre visible ; molette et clavier permettent de lire la fin du texte et Copier conserve tout.
- Ouvrir/fermer le menu du lecteur : le texte doit conserver ses coordonnées à l'écran, sauf si le moniteur est trop petit et impose un ajustement.
- Tester les coins et l'espace transparent entre menu/pilule/verre : les clics hors surfaces passent à l'application source.
- Streaming : pas d'aller-retour entre formats, pas de déplacement à chaque fragment, pas de texte étiré ni de flou animé.
- Fermer pendant le flux : annulation immédiate, disparition courte, aucun fragment tardif ne réaffiche la bulle.
- Nouvelle capture pendant la fermeture précédente : un ancien accusé de fermeture ou délai de secours ne doit jamais masquer la nouvelle capture.
- Répéter les interactions avec mouvements réduits ; pas d'animation prolongée imposée.
- Comparer un profil synthétique avant/après avec scripts/profile-ui.mjs. Les intervalles d'images de Chromium ne sont pas une mesure du compositeur Windows.

Consigner les résultats réels dans VALIDATION.md. Les points ci-dessus sont une recette, pas une déclaration de tests réussis.

### Régression 0.1.1 : cadre et déplacement

- Dans la vraie fenêtre Tauri, vérifier l’absence de barre de titre au premier affichage, après focus et après Agrandir/Réduire.
- Faire glisser le texte et le fond : la bulle suit la souris et reste à sa nouvelle position après ouverture du menu et pendant le streaming.
- Vérifier que Copier et Plus d’options ne déclenchent pas un déplacement ; faire défiler un texte long avec la molette et la barre.
- Fermer avec Échap pendant un déplacement ne doit pas réafficher la fenêtre au relâchement.
- Capturer un nouveau texte doit rétablir l’ancrage contextuel ; changer de moniteur doit conserver une bulle visible à la bonne échelle.
- Vérifier le lancement depuis le PowerShell de l’utilisateur avec le chemin réellement installé, hors redirection privée de Codex.
