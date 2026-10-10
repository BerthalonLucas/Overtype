> **Pièce spécialisée initiale.** Les verdicts, regroupements et sévérités finaux sont dans [FINDINGS.md](FINDINGS.md) et [la synthèse](SYNTHESE.md). Ne pas additionner les totaux des spécialistes. Les chemins `preuves-locales/` et `artefacts-locaux/` désignent des preuves privées non jointes intégralement ; voir [VERIFICATION.md](VERIFICATION.md).

# Audit des branches Overtype

Base figée : `e202cd1f8831abc0f69435b9e2d0d96dd491e841`. **35/35 branches**, une entrée exclusive par branche dans `branches.json`. Aucun merge, suppression ni modification du checkout.

## Synthèse

- 17 : **ancêtre**.
- 5 : **partiellement repris**.
- 10 : **patch-equivalent/squash**.
- 2 : **abandonné historique**.
- 1 : **travail unique restant**.
- Correctifs utiles perdus : garde `actions: []`, récupération des paramètres corrompus, traitement persistant des erreurs du verre. Deux couvertures à sauver : matrice réelle du collage PR6 et type-check e2e/visuels.
- Les anciennes branches 0.5 sont pour l’essentiel un portage Graphite interrompu, remplacé par Îlot/Porcelaine : absence de leurs fichiers ≠ absence des fonctionnalités.

## Méthode et sources

Fiches réellement utilisées : **Git Workflow Master** et **Codebase Archaeologist**. Ascendance sur SHA figés, `git cherry`, `patch-id --stable` par commit et sur delta agrégé, puis comparaison des responsabilités, contrats et contenu main. Les axes intent et code sont séparés : des exigences du 17/09 ne supplantent pas les décisions du 24/09 et la 0.6. Aucun script historique exécuté.

Les fichiers par branche, merge-base, commit list, patch matches et comparaisons `present_main`/`identical_main` sont conservés dans le JSON. `unique_diff_files` est préservé littéralement depuis l’inventaire fourni; `delta_files` est régénéré avec `core.quotePath=false` (notamment noms accentués), sans réparer les tokens source. Les images/bundles vendored ne sont couverts que par manifeste et identité, pas par une revue ligne à ligne.

## PR6 — discussion lue, read-only

https://github.com/BerthalonLucas/Overtype/pull/6 est **OPEN**. `gh pr view` renvoie `comments: []`, `reviews: []`; les endpoints issue comments et inline review comments renvoient aussi `[]`. Il n’y a donc aucune discussion publique visible à résumer. Son body décrit une matrice Edge et un collage nécessitant relecture du document. Les 21/70/38/16 tests annoncés sont des résultats revendiqués à l’époque, pas des tests exécutés dans cet audit.

**Décision prioritaire :** `docs/UI-DECISIONS.md:21-24` demande explicitement de reprendre clipboard/Ctrl+V, mais de garder la relecture du document comme bonus. Main `2404ed2...`, puis les durcissements de 0.6, suivent une autre architecture. Importer PR6 entière rétablirait une précondition rejetée. La fermer n’est pas une action de cet audit.

## Inventaire complet

| Branche | SHA tip | Classification | Preuve courte |
|---|---|---|---|
| `chore/ui-iteration-workbench` | `afec21d4d9fa` | ancêtre | ascendance exit 0 |
| `claude/great-keller-6dwrqd` | `488eae22a879` | ancêtre | ascendance exit 0 |
| `codex/multi-editor-replacement` | `86b3b23f217b` | partiellement repris | inspection intention/source + comparaison main ci-dessous |
| `da-ilot` | `26aaa399c123` | ancêtre | ascendance exit 0 |
| `design/glass-reader` | `7d67ab5c34ad` | ancêtre | ascendance exit 0 |
| `feat/actions-shortcuts-settings` | `3f2aee15710d` | ancêtre | ascendance exit 0 |
| `feat/actions-that-work` | `e8df897a3b11` | ancêtre | ascendance exit 0 |
| `feat/direct-capture` | `74aefa69027d` | ancêtre | ascendance exit 0 |
| `feat/frontend` | `d4681e439123` | ancêtre | ascendance exit 0 |
| `feat/frontend-primitives` | `b9d6eb42e8d1` | patch-equivalent/squash | b9d6eb4 → 26cd431 |
| `feat/glass-frontend` | `170f96f7e26d` | patch-equivalent/squash | 170f96f → 2d09e26 |
| `feat/glass-material` | `058d34897923` | patch-equivalent/squash | 058d348 → 421541d |
| `feat/glass-native` | `f742599122bb` | patch-equivalent/squash | b8ab47b → 2a69895; f742599 → a24f19e |
| `feat/glass-native-polish` | `02b1fe8d47f0` | patch-equivalent/squash | 02b1fe8 → b5dbe0b |
| `feat/glass-reader` | `5005b026de73` | ancêtre | ascendance exit 0 |
| `feat/native` | `0dc02bbf1bbd` | ancêtre | ascendance exit 0 |
| `feat/reading-band` | `a1d903190e8c` | ancêtre | ascendance exit 0 |
| `feat/release-and-endpoints` | `83ebebb91f6c` | ancêtre | ascendance exit 0 |
| `feat/0.5.0-design-1.0` | `3ea09e6c2a20` | abandonné historique | inspection intention/source + comparaison main ci-dessous |
| `fix/compact-draggable-bubble` | `99a019d3a77e` | ancêtre | ascendance exit 0 |
| `fix/native-window` | `28e2f0eac7a2` | partiellement repris | 544f6c2 → 11b94bf |
| `fix/scoped-drag` | `fcb5c0196468` | patch-equivalent/squash | 119f51d → d920a5f; fcb5c01 → ec71d14 |
| `fix-endpoint-tls` | `dd4b218be9b4` | ancêtre | ascendance exit 0 |
| `main` | `e202cd1f8831` | ancêtre | ascendance exit 0 |
| `refonte-reglages` | `deb9f0d581e2` | ancêtre | ascendance exit 0 |
| `release/frontend-0.1.5` | `127fb7fb70b7` | patch-equivalent/squash | 127fb7f → bdd05ea |
| `release/guide-0.1.5` | `81f850333e78` | patch-equivalent/squash | 81f8503 → 269ad73 |
| `release/native-0.1.5` | `efe3abd5c9d7` | patch-equivalent/squash | efe3abd → 0c730ab |
| `release/server-0.1.5` | `8281476d4bca` | patch-equivalent/squash | 1c65bd1 → 4dea4e2; 5d20a3a → 30cf40f; 8281476 → d5ecd2a |
| `release/0.1.5` | `2f83abc75f19` | ancêtre | ascendance exit 0 |
| `wt-050-atelier` | `5b5f6a56962f` | travail unique restant | inspection intention/source + comparaison main ci-dessous |
| `wt-050-marque` | `1e2c6097d665` | abandonné historique | inspection intention/source + comparaison main ci-dessous |
| `wt-050-natif` | `1fcdd21f0aad` | partiellement repris | inspection intention/source + comparaison main ci-dessous |
| `wt-050-reglages` | `5da6010e2af1` | partiellement repris | inspection intention/source + comparaison main ci-dessous |
| `wt-050-verre` | `c5345af95ec9` | partiellement repris | inspection intention/source + comparaison main ci-dessous |

## Analyse des deltas non-ancêtres

### codex/multi-editor-replacement — partiellement repris

`86b3b23f217b4e26976815fca253397012a6cd4b` ; merge-base `83d6e363d36caa88112683fa966b05251ca00fdc`.

PR6 : garde multiformat et Ctrl+V repris par 2404ed2b4e5d82c83112d9e8664d97e5d45d3011, renforcés en 4e1dfa7c376d54c81944648612e3c98f02bd8c27. La preuve du document entier et copied_range ne sont volontairement plus préconditions du collage (UI-DECISIONS:21-24). La matrice Edge réelle, iframe/Shadow DOM, Unicode, texte autour, insertFromPaste et Ctrl+Z reste absente. Préserver les cas, pas le moteur strict ancien.

Preuves : src-tauri/src/capture.rs:215-315,556-637; src-tauri/src/clipboard_guard.rs; docs/UI-DECISIONS.md:19-25; scripts/capture-matrix.mjs

Périmètre : 20 fichiers delta, dont 3 intent/prototypes et 17 source/test/config. Liste complète dans le JSON.

### feat/frontend-primitives — patch-equivalent/squash

`b9d6eb42e8d1f8692bacc4bdce07ec0e525fd23b` ; merge-base `783bb2f64b37ec723ef1f1ba9242a96a77e87f30`.

Tous les commits non-ancêtres ont un patch-id stable identique à un commit main. Aucun delta manquant par identité de patch; les modifications ultérieures main et décisions actuelles priment sur le snapshot historique.

Preuves : patch-id --stable: b9d6eb42e8d1f8692bacc4bdce07ec0e525fd23b = 26cd43183ca1592798dd8894d72797437b0b1a03

Périmètre : 14 fichiers delta, dont 1 intent/prototypes et 13 source/test/config. Liste complète dans le JSON.

### feat/glass-frontend — patch-equivalent/squash

`170f96f7e26da3c0b6a15909764a9da6c251d41a` ; merge-base `7d67ab5c34ad78d5a6be8a4f20815f0848f076d3`.

Tous les commits non-ancêtres ont un patch-id stable identique à un commit main. Aucun delta manquant par identité de patch; les modifications ultérieures main et décisions actuelles priment sur le snapshot historique.

Preuves : patch-id --stable: 170f96f7e26da3c0b6a15909764a9da6c251d41a = 2d09e260e8a8e39b036d0fd97002b778faad27bb

Périmètre : 16 fichiers delta, dont 1 intent/prototypes et 15 source/test/config. Liste complète dans le JSON.

### feat/glass-material — patch-equivalent/squash

`058d348979239a401f619abfec09a75630a92ef5` ; merge-base `b923c019bc8a082070a600e7859762c4c7e0fb19`.

Tous les commits non-ancêtres ont un patch-id stable identique à un commit main. Aucun delta manquant par identité de patch; les modifications ultérieures main et décisions actuelles priment sur le snapshot historique.

Preuves : patch-id --stable: 058d348979239a401f619abfec09a75630a92ef5 = 421541dcb624b8803e8da19c53f6deaf1636d4b2

Périmètre : 7 fichiers delta, dont 1 intent/prototypes et 6 source/test/config. Liste complète dans le JSON.

### feat/glass-native — patch-equivalent/squash

`f742599122bbeb5df9b542ca02457192ef0bd832` ; merge-base `7d67ab5c34ad78d5a6be8a4f20815f0848f076d3`.

Tous les commits non-ancêtres ont un patch-id stable identique à un commit main. Aucun delta manquant par identité de patch; les modifications ultérieures main et décisions actuelles priment sur le snapshot historique.

Preuves : patch-id --stable: b8ab47b8f2c293fb5f69d4b6d77b03d1616ff28e = 2a698953627f4dbf2bdf3a11477139c061655dee; patch-id --stable: f742599122bbeb5df9b542ca02457192ef0bd832 = a24f19e3b507f8ece28509a04b479ad544fbf132

Périmètre : 6 fichiers delta, dont 2 intent/prototypes et 4 source/test/config. Liste complète dans le JSON.

### feat/glass-native-polish — patch-equivalent/squash

`02b1fe8d47f0322e3f580369b5de386a1f984828` ; merge-base `b923c019bc8a082070a600e7859762c4c7e0fb19`.

Tous les commits non-ancêtres ont un patch-id stable identique à un commit main. Aucun delta manquant par identité de patch; les modifications ultérieures main et décisions actuelles priment sur le snapshot historique.

Preuves : patch-id --stable: 02b1fe8d47f0322e3f580369b5de386a1f984828 = b5dbe0ba8be63ae88d097c457a6dce29bec8fbcd

Périmètre : 2 fichiers delta, dont 1 intent/prototypes et 1 source/test/config. Liste complète dans le JSON.

### feat/0.5.0-design-1.0 — abandonné historique

`3ea09e6c2a2047b5c40133482dd0e151ee01db40` ; merge-base `b42312a2acb5c428177d3650addb31d1fa5a6900`.

Documents, tokens et prototypes Graphite & Surligneur, pas une implémentation runtime 0.5. REPRISE déclare que le portage n’a jamais été fusionné, trois unités WIP non vérifiées. Les décisions du 24/09 remplacent ce plan par Îlot puis Porcelaine 0.6. Le renommage Verso et changement de bundle ID sont périmés; main garde com.flowtranslate.desktop pour les données.

Preuves : branche docs/0.5.0/REPRISE.md; main AGENTS.md:8-9; docs/UI-DECISIONS.md:51-84; src/theme.css

Périmètre : 202 fichiers delta, dont 200 intent/prototypes et 2 source/test/config. Liste complète dans le JSON.

### fix/native-window — partiellement repris

`28e2f0eac7a2a9bb662bdbe4b3716ad362ecff01` ; merge-base `c840b0f2eb60d2fe37e4a28bcc38e5d2210901c3`.

544f6c28 patch-identique à 11b94bfb. Le deuxième commit est non équivalent, mais son intention est reprise : clamp et manual_position_stays_in_offset_work_area_after_resize existent sur main; compensate_pointer_drag et start_drag traitent le déplacement retardé, sans réintroduire son crochet souris global. Aucun correctif de drag actuellement manquant démontré.

Preuves : src-tauri/src/placement.rs:45-62,202-218; src-tauri/src/host.rs:652; src-tauri/src/lib.rs:2618-2670; patch-id --stable: 544f6c28ef60062795b2510f385cbc45289c447c = 11b94bfb447f2bc9b9dbf2b22a9b2e866f45d4f2

Périmètre : 3 fichiers delta, dont 0 intent/prototypes et 3 source/test/config. Liste complète dans le JSON.

### fix/scoped-drag — patch-equivalent/squash

`fcb5c0196468258f62c11bf6f96d730e04cb8bc8` ; merge-base `893e5b28e88c82162eee73b60908ebb319b5105b`.

Tous les commits non-ancêtres ont un patch-id stable identique à un commit main. Aucun delta manquant par identité de patch; les modifications ultérieures main et décisions actuelles priment sur le snapshot historique.

Preuves : patch-id --stable: 119f51d1d108ce40d44e5b7b2a26aa429f90f586 = d920a5fc83ec23c60126dbd17e2b6212846e56f8; patch-id --stable: fcb5c0196468258f62c11bf6f96d730e04cb8bc8 = ec71d1416da13deea11152dd32753314597d09e4

Périmètre : 2 fichiers delta, dont 0 intent/prototypes et 2 source/test/config. Liste complète dans le JSON.

### release/frontend-0.1.5 — patch-equivalent/squash

`127fb7fb70b7c0cd830379855bfd7339597ed91e` ; merge-base `5005b026de73de235ea140f2dd1d8eb3f766e09e`.

Tous les commits non-ancêtres ont un patch-id stable identique à un commit main. Aucun delta manquant par identité de patch; les modifications ultérieures main et décisions actuelles priment sur le snapshot historique.

Preuves : patch-id --stable: 127fb7fb70b7c0cd830379855bfd7339597ed91e = bdd05ea7794300f04d88c2616db94cdbc57c8e68

Périmètre : 8 fichiers delta, dont 1 intent/prototypes et 7 source/test/config. Liste complète dans le JSON.

### release/guide-0.1.5 — patch-equivalent/squash

`81f850333e7884b4497a6dd147ae00d1d409d54a` ; merge-base `d5ecd2a85d78347bf4c0da2fda7f092d5d918464`.

Tous les commits non-ancêtres ont un patch-id stable identique à un commit main. Aucun delta manquant par identité de patch; les modifications ultérieures main et décisions actuelles priment sur le snapshot historique.

Preuves : patch-id --stable: 81f850333e7884b4497a6dd147ae00d1d409d54a = 269ad73bfe5034a5664b63c66b38d3a1b428cac8

Périmètre : 1 fichiers delta, dont 1 intent/prototypes et 0 source/test/config. Liste complète dans le JSON.

### release/native-0.1.5 — patch-equivalent/squash

`efe3abd5c9d73f9a748880e75a55cb4f9096d27b` ; merge-base `5005b026de73de235ea140f2dd1d8eb3f766e09e`.

Tous les commits non-ancêtres ont un patch-id stable identique à un commit main. Aucun delta manquant par identité de patch; les modifications ultérieures main et décisions actuelles priment sur le snapshot historique.

Preuves : patch-id --stable: efe3abd5c9d73f9a748880e75a55cb4f9096d27b = 0c730aba031e91c110164f5c5483167e62f20890

Périmètre : 4 fichiers delta, dont 1 intent/prototypes et 3 source/test/config. Liste complète dans le JSON.

### release/server-0.1.5 — patch-equivalent/squash

`8281476d4bcac7d74305532d26bd3cf2cf46c8da` ; merge-base `5005b026de73de235ea140f2dd1d8eb3f766e09e`.

Tous les commits non-ancêtres ont un patch-id stable identique à un commit main. Aucun delta manquant par identité de patch; les modifications ultérieures main et décisions actuelles priment sur le snapshot historique.

Preuves : patch-id --stable: 1c65bd1d36c7d096c5038efa2e0d6b083fa969e2 = 4dea4e286b506ca528b4000c8f866b50c0a042fe; patch-id --stable: 5d20a3a50302c971ecd5fd21a7b47bcf629be1ab = 30cf40fac140423d985ca78e02ff6398ef4c7a54; patch-id --stable: 8281476d4bcac7d74305532d26bd3cf2cf46c8da = d5ecd2a85d78347bf4c0da2fda7f092d5d918464

Périmètre : 6 fichiers delta, dont 0 intent/prototypes et 6 source/test/config. Liste complète dans le JSON.

### wt-050-atelier — travail unique restant

`5b5f6a56962f59202d2ea127daf52cedf0439ba5` ; merge-base `b42312a2acb5c428177d3650addb31d1fa5a6900`.

Atelier à scénarios Réglages séparés, thème système (ancienne règle), signal settings-ready borné, captures et tsconfig.test.json. Main a un labo Îlot/résultat/halo, thème explicite dans URL et des visual-tests : pas besoin de restaurer le labo entier ni d’interdire ses thèmes forcés. Le contrôle TypeScript des e2e/visual-tests est une petite amélioration autonome réellement absente du graphe build main.

Preuves : branche tsconfig.test.json:1-24, tsconfig.json; main tsconfig.json:1-4, tsconfig.app.json:20, tsconfig.node.json:15, package.json:13; src/lab/frame.tsx:87-129

Périmètre : 114 fichiers delta, dont 103 intent/prototypes et 11 source/test/config. Liste complète dans le JSON.

### wt-050-marque — abandonné historique

`1e2c6097d66573e20e2a002b3d8ada1ceb1abcd8` ; merge-base `b42312a2acb5c428177d3650addb31d1fa5a6900`.

Icônes graphite jaunes et six variantes tray + générateur Chromium/encodeur PNG/ICO/contrôle. Assets et scripts uniques mais liés au design rejeté, pas une dette fonctionnelle du produit actuel. Ne pas importer les encodeurs PNG/ICO maison simplement parce qu’ils existent. Les ressources tray attendues par wt-050-natif ne rendent pas cette branche intégrable seule.

Preuves : branche scripts/build-icons.mjs:1-160, scripts/check-icons.mjs; main AGENTS.md:8-9; src-tauri/icons; src-tauri/src/lib.rs

Périmètre : 124 fichiers delta, dont 103 intent/prototypes et 3 source/test/config. Liste complète dans le JSON.

### wt-050-natif — partiellement repris

`1fcdd21f0aadd5a36978e47e6530b9fe9f1c74bd` ; merge-base `b42312a2acb5c428177d3650addb31d1fa5a6900`.

Route ciblée vers Réglages, copie de l’historique par identifiant, retours connexion et sauvegarde de migration ont des successeurs main, mais la récupération des paramètres illisibles et la garde actions.first() n’ont pas été reprises. schemaVersion, réconciliation Run et tray thème séparé restent du WIP; ni build ni test historiques confirmés par cet audit. Schéma profils fast/quality ancien incompatible avec les serveurs 0.6; reprendre uniquement les comportements de récupération et leurs tests adaptés.

Preuves : branche src-tauri/src/settings.rs:162-167,198-240,453-635; main src-tauri/src/settings.rs:184-274; src-tauri/src/lib.rs:3204-3234; src/bridge.ts; src-tauri/src/legacy_autostart.rs

Périmètre : 117 fichiers delta, dont 103 intent/prototypes et 14 source/test/config. Liste complète dans le JSON.

### wt-050-reglages — partiellement repris

`5da6010e2af1516c29bb1ff0e0281ef8f8778b6b` ; merge-base `b42312a2acb5c428177d3650addb31d1fa5a6900`.

Fenêtre Actions/Lecture/Moteurs/Confidentialité, draft d’adresse validé au blur, sérialisation des saves, ciblage settings-target et nouveaux e2e. Main livre d’autres pages, serveurs multiples, form/probe et interface bilingue à travers 9418959,658de210,4e2e9f81; donc les anciens moteurs fast/quality et libellés FR ne sont pas des features manquantes. Le startup notice de récupération est perdu avec le backend natif. Tests historiques non exécutés : ne pas cherry-pick tout le front.

Preuves : branche src/settings/EnginesPage.tsx:55-84, src/settings/SettingsWindow.tsx, e2e/settings*.ts; main src/settings/pages/Server.tsx, src/settings/useSettingsStore.ts, src/connection; docs/PLAN-0.6.md

Périmètre : 119 fichiers delta, dont 103 intent/prototypes et 16 source/test/config. Liste complète dans le JSON.

### wt-050-verre — partiellement repris

`c5345af95ec9fa6ac00cdea1444aba09cd4ba375` ; merge-base `b42312a2acb5c428177d3650addb31d1fa5a6900`.

Tokens Graphite, icônes, étiquette action, erreur persistante hors budget et open_settings ciblé via overlay-ipc. Apparence rejetée; défauts UX/erreurs ont des successeurs dans ilot/result, mais le GlassOverlay actuel conserve le budget même pour phase error et efface toute erreur de feedback après 3 s. Ne pas assimiler le parcours Îlot au verre « Afficher le résultat ». splitReason sur ponctuation est moins solide que les erreurs structurées main.

Preuves : branche src/GlassOverlay.tsx:208-350, src/overlay-ipc.ts, src/useTranslation.ts; main src/GlassOverlay.tsx:240,294-300,349-382; src/ilot/result; src/bridge.ts

Périmètre : 117 fichiers delta, dont 103 intent/prototypes et 14 source/test/config. Liste complète dans le JSON.

## Constats et éléments à sauver

### BR-01 — La garde contre une liste d’actions vide a été laissée sur wt-050-natif (P2, bug)

**Cible :** `main@e202cd1f8831abc0f69435b9e2d0d96dd491e841` · `src-tauri/src/settings.rs:201,209`.

**Preuve/scénario :** main conserve actions[0] dans unwrap_or_else, avant validate. Avec un fichier valide structurellement contenant actions: [] et defaultActionId absent/invalide, l’indexation panique. wt-050-natif@1fcdd21f:settings.rs:162-167 utilise first().ok_or_else et son test an_empty_action_list_is_refused_instead_of_panicking. Startup appelle store.load()? en lib.rs:3213.

**Impact :** Un fichier incohérent, édité ou migré avec zéro action peut arrêter l’application plutôt que renvoyer une erreur contrôlée. Pas de preuve que l’UI normale puisse écrire ce fichier.

**Alternative / coût / compromis :** Adapter le first().ok_or_else au schéma serveurs actuel; test fixture SettingsStore::load avec actions:[] et defaultActionId absent/invalide. Coût faible, aucune dépendance; ne pas copier la struct 0.4.

**Confiance :** élevée sur le chemin statique; pas de repro Rust exécutée.

### BR-02 — La récupération non destructive des réglages illisibles n’a pas été reprise (P2, risque)

**Cible :** `main@e202cd1f8831abc0f69435b9e2d0d96dd491e841` · `src-tauri/src/settings.rs:184,191`.

**Preuve/scénario :** JSON invalide => Err; clé DPAPI invalide => Err à 217/226; lib.rs:3213 propage au setup. Le backup 0.5 à settings.rs:180-181,264-268 est conservé mais jamais chargé en secours. Ancienne branche 1fcdd21f:settings.rs:198-240 portait load_tolerant + mise à l’écart + notice, et tests fichier tronqué/vide/enum/DPAPI.

**Impact :** Une corruption de fichier bloque le démarrage avant l’accueil et la possibilité de réparer dans Réglages; la présence d’une sauvegarde de migration n’aide pas automatiquement.

**Alternative / coût / compromis :** Réimplémenter récupération contrôlée sur schéma 0.6 : conserver original, essayer backup validé, sinon accueil avec erreur explicite sans écraser silencieusement les clés. Réutiliser serde/fs/erreurs existants. Coût moyen; attention à ne pas écraser original si rename échoue (ancien WIP ignore cette erreur).

**Confiance :** élevée (inspection statique).

### BR-03 — La matrice de remplacement native Edge de PR6 reste utile mais non reprise (P3, dette)

**Cible :** `codex/multi-editor-replacement@86b3b23f217b4e26976815fca253397012a6cd4b` · `scripts/test-replacement-windows.mjs:65,128`.

**Preuve/scénario :** 86b3b23f contient vérification du champ entier avant/après, insertFromPaste, format b/i, Ctrl+Z, iframe, Shadow DOM, Unicode, concurrence presse-papiers, refus doublon. scripts/test-replacement-windows.mjs et replacement_tests.rs absents main; recherche insertFromPaste/replacement_desktop/rich clipboard vide. scripts/capture-matrix.mjs main teste capture, pas ces invariants complets du collage.

**Impact :** Le moteur main a changé et des tests Rust/frontend existent; cela n’établit pas un bug, mais la recette automatisée bout-en-bout rich-edit/undo a perdu une couverture utile.

**Alternative / coût / compromis :** Porter fixtures et assertions sur capture::paste/Delivery main dans un test Windows isolé, intégrer à CI Windows. Garder preuve du texte autour et clipboard, mais accepter confirmed:false là où le contrat permet un collage non relisible. Playwright déjà présent; coût moyen, runners bureau requis. Ne pas exécuter ce driver historique sans adaptation.

**Confiance :** élevée (inspection statique).

### BR-04 — Le verre Afficher le résultat n’a pas repris la persistance des erreurs (P2, risque)

**Cible :** `main@e202cd1f8831abc0f69435b9e2d0d96dd491e841` · `src/GlassOverlay.tsx:294,300,349,382`.

**Preuve/scénario :** settled inclut phase error à 240; budget readingBudget à 349 et held à 361 n’excluent pas error; timer 298 efface tous les feedback après 3 s. wt-050-verre@c5345af:GlassOverlay ajoute failed, budget null, held, tone danger non effaçable. Le parcours ilot/result main est distinct et ne constitue pas une correction de ce chemin.

**Impact :** Avec un raccourci « Afficher le résultat », erreur réseau/modèle puis pointeur éloigné, la raison et l’accès Réessayer disparaissent au budget automatique. Une erreur de collage dans le verre perd son texte après 3 s. Le parcours Îlot par défaut ne suffit pas à généraliser ce constat.

**Alternative / coût / compromis :** Décider explicitement la durée des erreurs du verre actuel; si elles doivent rester actionnables, exclure error et feedback danger du budget. Ajouter test fake timers/browser : erreur sans hover reste jusqu’à Échap/nouvelle capture. Coût faible; garder auto-close des succès. Ne pas importer tokens Graphite ni overlay-ipc redondant.

**Confiance :** élevée sur timers; comportement produit à confirmer, pas de test navigateur exécuté.

### BR-05 — Le type-check des tests Playwright de wt-050-atelier est absent du build (P3, dette)

**Cible :** `main@e202cd1f8831abc0f69435b9e2d0d96dd491e841` · `tsconfig.json:1,4`.

**Preuve/scénario :** References uniquement app/node. tsconfig.app inclut src, node inclut vite.config.ts. Aucun tsconfig.test.json main. Branche 5b5f6a:tsconfig.test.json inclut e2e/visual-tests/src/env.d.ts et son tsconfig racine référence ce projet.

**Impact :** Les tests navigateur exécutent TypeScript transpilé sans faire partie du tsc -b; une erreur de types dans e2e peut ne pas être détectée par le build actuel. Les unit tests sous src restent bien couverts, ils ne sont pas concernés.

**Alternative / coût / compromis :** Ajouter un projet noEmit actuel pour e2e et visual-tests et un check explicite en CI. Réutiliser TypeScript déjà présent. Coût faible à moyen suivant dette types découverte; ne pas reprendre les anciennes assertions de spinner ou thème graphite.

**Confiance :** élevée (inspection statique).

## Risques d’intégration et contre-exemples

- **Ne pas intégrer les tips complets sur main.** Contrats fast/quality, contrôles et tailles natives anciens, absence de Halo/Îlot/Setup, offsets Win32 et schémas JSON différents : une reprise doit s’écrire sur le schéma actuel. Une non-ascendance n’autorise ni un merge ni la restauration d’un fichier historique.
- **PR6 :** la réparation copied_range est liée à l’exigence de document unique et au coûteux synthetic-copy à la capture. La proposer comme option/test pour providers problématiques, pas comme condition obligatoire de tout collage. Pas de bug « offsets non repris » démontré ici : main colle sur la sélection revalidée, il ne réécrit plus un document à ces offsets.
- **wt-050-natif :** code WIP non vérifié et dépendant de glyphes wt-050-marque. Son load_tolerant ignore les échecs de mise à l’écart/sauvegarde; copier tel quel risquerait de masquer une perte de fichier. Son schemaVersion ne gère pas à lui seul toutes les versions futures.
- **wt-050-verre :** garder le comportement d’erreur utile sans copier le split par ponctuation, le wrapper overlay-ipc dupliqué ni les tokens rejetés. Confirmer la politique auto-close sur le mode Afficher le résultat, distinct du parcours Îlot.
- **wt-050-atelier :** le thème forcé par URL du labo actuel est intentionnel pour comparer des variantes; l’ancienne règle « tout overlay graphite » est rejetée, pas un correctif perdu. Réutiliser uniquement le projet type-check et des tests adaptés aux surfaces actuelles.
- **Renommage :** ne pas appliquer Verso/com.verso.desktop depuis REPRISE; Overtype garde volontairement l’identifiant et le dossier historiques.
- **Déjà bons :** drag/clamp + test work-area décalée, clipboard plus récent préservé, état créé avant WebViews (main lib.rs:3248-3265), IDs de capture et unlisten gardés dans les chemins historiques patch-équivalents. L’audit de branches ne prétend pas vérifier tous les handlers main.

## Couverture et limites

- Matrice par répertoire : `src`, `src-tauri`, `e2e`, `scripts`, configs et `server` pour les branches fonctionnelles; `docs/0.5.0`, `docs/ux`, `docs/design-system` comme intent historique/prototypes; assets sous manifeste/blob.
- Ancêtres : vérification d’ascendance de tous les tips; pas de ré-exécution de leurs anciennes versions. Non-ancêtres : tous les deltas inventoriés, patch IDs vérifiés, responsabilités uniques comparées à main. Ne pas lire « examined » comme une relecture exhaustive de toutes les lignes générées.
- Sources officielles externes utilisées ici : GitHub PR6/API read-only. Pas de recherche npm/Tauri de versions nécessaire pour la classification; ce point relève des autres audits.
- Audit de branches, pas audit exhaustif ligne par ligne du runtime. Tous les noms et deltas ont été inventoriés; inspection fonctionnelle concentrée sur sources/tests nouveaux non équivalents et leurs successeurs main.
- PNG/ICO non rendus : identité de blobs/manifeste seulement. Bundles React minifiés et previews design-system : scope historique/prototype, pas revue sécurité ligne par ligne.
- Aucun ancien checkout ni script historique exécuté. Aucun test Windows, Rust (cargo absent dans environnement fourni), GPU ou serveur distant lancé. Constats runtime ci-dessus sont des chemins statiques, pas résultats de tests.
- PR6 ne comporte aucune discussion publique visible au moment de lecture : issue comments [], review comments [], comments/reviews []. Les nombres de tests de son body sont revendications historiques, non rejouées.
- La classification est exclusive par branche, pas une mesure de chaque idée conservée : une branche partiellement reprise peut contenir surtout du travail obsolète. Les fichiers absents ne sont jamais seuls une preuve de fonctionnalité manquante.
- Aucune modification de checkout partagé; aucune fusion, suppression, publication, configuration ou skill/mémoire modifiée.

## Checks exécutés

- `git merge-base --is-ancestor SHA MAIN (35 tips); git cherry -v MAIN SHA (18 non-ancêtres)` → 35/35 couverture, 17 ancêtres, 18 non-ancêtres; détails par branche (exit 0). Log : `artefacts-locaux/branches-work/inventory.json`.
- `git log --no-merges -p MAIN | git patch-id --stable; git show commit | git patch-id --stable; git diff merge-base tip | git patch-id --stable` → Équivalence par commit et agrégat conservée; les + de git cherry ne sont pas assimilés à des features absentes (exit 0). Log : `artefacts-locaux/branches-work/main-patchids.txt`.
- `gh pr view 6 --repo BerthalonLucas/Overtype --json title,body,state,comments,reviews,url; gh api repos/BerthalonLucas/Overtype/issues/6/comments; gh api repos/BerthalonLucas/Overtype/pulls/6/comments` → OPEN; body lu, commentaires et reviews vides; endpoints comments [] et [] (exit 0). Log : `artefacts-locaux/branches-work/pr6.json`.
- `git diff merge-base tip; git cat-file -e MAIN:path; git diff --quiet MAIN tip -- path; git show/log successeurs main` → Delta et existence/identité de chaque fichier renseignés; source vs intent séparés; fichiers cités et successeurs inspectés (exit 0). Log : `artefacts-locaux/branches-work/details.txt`.

Validation livrable : schéma JSON lisible; 35 noms, 35 noms uniques, égalité exacte des ensembles nom/SHA avec inventaire; aucun tip omis.
