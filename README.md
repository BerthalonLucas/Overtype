# Overtype 0.6.0

Overtype est le nouveau nom de FlowTranslate (0.6.0). Les réglages, les clés et l’historique d’une 0.5 sont gardés ; l’installateur retire l’ancienne application. Nouveautés : [docs/RELEASE-NOTES.md](docs/RELEASE-NOTES.md). Les sections qui suivent datent de la 0.4 et de la 0.5 et n’ont pas encore été réécrites.

# En cours : 0.5.0 « Îlot » (branche `da-ilot`)

La 0.5.0 est en cours d’implémentation sur la branche `da-ilot` et n’est pas publiée. Elle
fera de Overtype un assistant d’écriture : sélectionner un texte, presser
`Ctrl+Alt+Espace`, choisir une action dans un petit menu ouvert à côté de la sélection
(l’« Îlot » : Corriger, Traduire, Rendre professionnel, Raccourcir, Rédiger un mail ou une
consigne libre), et le texte sera remplacé sur place. Pendant le travail, une petite pilule
avec un orbe et un balayage de lumière sur les lignes sélectionnées ; après, une coche, un
bouton Annuler de 8 secondes et les mots changés surlignés. Interface en anglais par défaut
avec bascule française, thème qui suit Windows. Plan : [docs/DA-PLAN.md](docs/DA-PLAN.md) ;
référence visuelle : [design-lab/](design-lab/README.md). Jusqu’à sa publication, tout ce
qui suit décrit la 0.4.0.

# Nouveautés 0.4.0

Sélectionnez un texte déjà écrit (`Ctrl+A`), pressez le raccourci de **Corriger** : le texte corrigé remplace la sélection sur place, dans un mail, la barre de recherche, un champ web, Word ou VS Code. Le résultat passe par le presse-papiers et une seule corde `Ctrl+V` ; le presse-papiers est remis en place. Pendant le travail, seule la pilule tourne ; elle montre ✓ puis s’efface. Si le collage est impossible (console, mot de passe, fenêtre changée), la bulle s’ouvre avec le résultat et Copier.

Dans **Réglages → Actions et consignes**, chaque action est une consigne seule, sans variable : le texte sélectionné est envoyé après elle. Quatre actions par défaut : Traduire en français, Traduire en anglais, Corriger, Professionnaliser ; ajoutez les vôtres. Le réglage « Langue cible » disparaît : la langue est dans la consigne. Les consignes sont écrites pour de petits modèles sans réflexion ; la réflexion est coupée quand le serveur le permet.

Le serveur livré gagne un profil **général** : Gemma 4 12B QAT avec décodage spéculatif sur `http://127.0.0.1:8003/v1`, modèle `flowtranslate-general`, à mettre dans Rapide ou Qualité pour corriger et reformuler (les Hy-MT ne font que traduire).

L’installateur se trouve dans les [releases](https://github.com/BerthalonLucas/Overtype/releases/latest). Les réglages, consignes et clés sont migrés.

# Overtype

Assistant d’écriture pour Windows 11 : sélectionner un texte dans n’importe quelle
application, choisir une action (corriger, traduire, professionnaliser, les vôtres) et
laisser un modèle de langue remplacer le texte sur place, ou lire le résultat à côté. En
0.4.0, chaque action a son raccourci ; la 0.5.0, en cours sur la branche `da-ilot`,
ouvrira à la place un menu d’actions à côté de la sélection (`Ctrl+Alt+Espace`). Client
**Tauri 2 + React + Rust** ; moteur **séparé**, au choix : le serveur vLLM livré dans
`server/` (Hy-MT2 pour traduire, Gemma 4 pour corriger et reformuler), ou tout serveur
compatible OpenAI, local ou distant.

**État : version d’essai 0.4.0.** Capture directe (le raccourci copie lui-même la
sélection quand UI Automation ne la donne pas), lecture calibrée (verre court près du
texte ou bande de lecture à la moitié de l’écran, décidés sur le vrai texte), fermeture
d’elle-même au temps de lecture, bande qui suit la souris d’un écran à l’autre. Moteurs
réels validés en 0.1.5. Le jugement visuel de Lucas sur chaque version reste la
référence ([docs/UI-ISSUES.md](docs/UI-ISSUES.md)). La nouvelle direction artistique
« Îlot » de la 0.5.0 est en cours d’implémentation sur la branche `da-ilot` (section
précédente).

## Installer

1. Prendre l’installateur `Overtype_<version>_x64-setup.exe` dans les
   [releases GitHub](https://github.com/BerthalonLucas/Overtype/releases) et
   comparer son SHA-256 au fichier `SHA256SUMS.txt` joint. Installation par utilisateur,
   sans droits administrateur ; Microsoft Edge WebView2 Runtime doit être présent (il
   l’est sur Windows 11).
2. Lancer Overtype : seule une icône apparaît dans la zone de notification.
3. Brancher un moteur (section suivante), puis Réglages → **Connexion avancée** →
   « Vérifier ».
4. Sélectionner du texte dans n’importe quelle application et presser `Ctrl+Alt+T`
   (0.4.0). À partir de la 0.5.0, en cours sur la branche `da-ilot`, le raccourci par
   défaut deviendra `Ctrl+Alt+Espace`, qui ouvre le menu d’actions.

Pas de release publiée pour une version donnée ? La construire soi-même : voir
« Développer et construire ».

## Brancher un moteur de traduction

Le client parle le contrat OpenAI `/v1/chat/completions` en flux. Trois champs par
profil (Rapide, Qualité) dans Réglages → Connexion avancée : **Adresse**, **Modèle**,
**Clé API** (facultative en local, chiffrée par DPAPI). `http://` n’est accepté que sur
le poste (`127.0.0.1`) ; ailleurs, `https://` est obligatoire.

- **Le serveur livré** (`server/`) : vLLM 0.28.0 épinglé, deux profils Docker Compose,
  Rapide `http://127.0.0.1:8001/v1` modèle `flowtranslate-fast` (Hy-MT2-1.8B), Qualité
  `http://127.0.0.1:8002/v1` modèle `flowtranslate-quality` (Hy-MT2-7B-FP8), Général
  `http://127.0.0.1:8003/v1` modèle `flowtranslate-general` (Gemma 4 12B QAT, décodage
  spéculatif ; le seul des trois qui corrige et reformule). Procédure,
  précontrôle GPU et évaluation dans [server/README.md](server/README.md) ; les poids
  sont téléchargés au premier lancement, jamais commités.
- **Un autre serveur** (llama.cpp, LM Studio, Ollama, vLLM d’entreprise, service en
  ligne) : adresses, noms de modèle et pièges dans [docs/ENDPOINTS.md](docs/ENDPOINTS.md),
  avec la requête exacte envoyée et ce qui est attendu en retour.

## Utiliser

Cette section décrit la 0.4.0 publiée. La 0.5.0, en cours sur la branche `da-ilot`,
remplacera les raccourcis par action par le menu Îlot sur `Ctrl+Alt+Espace` (les
raccourcis directs vers une action resteront possibles), la bulle graphite par une pilule
avec coche, Annuler et mots changés surlignés, et gardera le mode « Afficher le résultat »
et la bande de lecture dans la nouvelle matière (voir [docs/DA-PLAN.md](docs/DA-PLAN.md)).

- Un raccourci = une action sur la sélection courante (`Ctrl+Alt+T` : Traduire en
  français au départ) et un résultat : **Afficher dans la bulle** ou **Remplacer la
  sélection**. Sans sélection lisible, Overtype copie lui-même (Ctrl+Insert
  synthétique, presse-papiers remis en place) ; une copie faite soi-même moins de trois
  secondes avant est acceptée ; sinon un avis discret, jamais de boîte de dialogue.
- Remplacer la sélection : la pilule seule, puis le résultat est collé à la place du
  texte (une corde `Ctrl+V`, presse-papiers remis en place), la pilule montre ✓ et
  s’efface. Console, champ mot de passe ou copie faite soi-même : la bulle s’ouvre à la
  place, avec Copier.
- Un texte court s’ouvre près de la sélection ; un texte long s’ouvre en bande de
  lecture en bas de l’écran de la souris, large de la moitié de l’écran, et suit la
  souris d’un écran à l’autre. Molette pour défiler, épingle pour garder la bande.
- La bulle s’efface d’elle-même au bout du temps de lecture estimé, vite une fois la
  souris partie ; un clic, la molette ou une touche la retiennent ; `Échap` la ferme.
- Pilule : Copier, Épingler (bande), menu ⋯ (Original, Remplacer quand le contrôle le
  permet, Relancer avec l’autre profil, Réglages, Fermer). L’icône de notification
  propose « Revoir la dernière traduction » pendant dix minutes.
- Réglages : profil par défaut, taille du texte, fermeture automatique, actions et
  consignes (la consigne seule ; le texte est envoyé après elle), raccourcis, historique
  chiffré (désactivé au départ : DPAPI, 7 jours, 100 entrées), lancement à l’ouverture
  de session, connexions.

Modes de démonstration, sans moteur ni historique :

```powershell
Overtype.exe --demo-selection
Overtype.exe --demo-clipboard
Overtype.exe --demo-long
```

`--simulate-inference` garde la capture Windows réelle mais simule la réponse.
`--settings` ouvre directement les Réglages. Fermer l’instance précédente depuis son
icône avant de changer de mode.

## Développer et construire

Prérequis : Node.js 24, Rust stable, outils MSVC et Windows SDK, WebView2 Runtime.
Dépendances verrouillées (`package-lock.json`, `src-tauri/Cargo.lock`).

```powershell
npm ci
npm run tauri -- dev
```

Aperçu navigateur seul (composants React, réponses simulées, aucun presse-papiers ni
moteur) : `npm run dev` puis `http://127.0.0.1:5173` ; atelier des défauts signalés sur
`/lab.html`.

```powershell
npm test
npx playwright install chromium --only-shell
npx playwright test
npm run ui:check
python -m unittest discover -s server -p 'test_*.py' -v
cargo test --locked --manifest-path src-tauri/Cargo.toml
npm run tauri -- build --bundles nsis
```

L’installateur sort dans `src-tauri/target/release/bundle/nsis/` (ou sous
`CARGO_TARGET_DIR`). Preuves natives : `scripts/test-native-ui.ps1 -Executable <exe>`
(fenêtre sans cadre, surfaces cliquables, fermeture) et
`scripts/capture-matrix.ps1 -Executable <exe>` (capture réelle par application).

Publier une version : pousser un tag `v<version>` (ou lancer le workflow « Release » à
la main avec ce tag) ; `.github/workflows/release.yml` construit l’installateur, calcule
son SHA-256 et crée la release GitHub avec la note de version de
[docs/RELEASE-NOTES.md](docs/RELEASE-NOTES.md).

## Documentation

- [docs/ENDPOINTS.md](docs/ENDPOINTS.md) : brancher un moteur, contrat exact.
- [server/README.md](server/README.md) : serveur vLLM livré, GPU, évaluation.
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) : installation, exploitation, retour arrière.
- [docs/BRIDGE.md](docs/BRIDGE.md) : contrat React ↔ Rust ; [docs/SPEC.md](docs/SPEC.md),
  [docs/native.md](docs/native.md) : spécification et couche Windows.
- [docs/DA-PLAN.md](docs/DA-PLAN.md), [design-lab/README.md](design-lab/README.md),
  [docs/UI-DECISIONS.md](docs/UI-DECISIONS.md) : nouvelle direction artistique « Îlot »
  (plan, labo de référence, décisions de Lucas) ; [docs/RECETTE.md](docs/RECETTE.md) :
  recette manuelle.
- [docs/RELEASE-NOTES.md](docs/RELEASE-NOTES.md), [docs/UI-ISSUES.md](docs/UI-ISSUES.md),
  [docs/UI-ITERATION.md](docs/UI-ITERATION.md) : versions, défauts, itérations visuelles.

## Confidentialité

Le texte sélectionné n’est envoyé qu’au serveur du profil choisi. Aucun texte, aucune
traduction, aucun contenu du presse-papiers ni aucune clé n’est écrit dans les journaux
ni dans le dépôt. Les clés API et l’historique (s’il est activé) sont chiffrés par
Windows DPAPI et ne sont pas portables vers un autre compte.
