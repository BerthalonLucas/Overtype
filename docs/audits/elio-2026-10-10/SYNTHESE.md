# Overtype — audit de qualité, frameworks et dépendances

**Auteur : Elio, avec sept spécialistes et deux contre-reviewers indépendants.** Les missions ont utilisé des fiches Agency Agents, adaptées au projet, via la délégation native Hermes ; le plugin Agency n'a pas été installé. Modèle des spécialistes : `gpt-6.1-sol`, effort `medium`. Coordination et arbitrage : `gpt-6-astra`.

**Code audité :** `main`, commit [`e202cd1f8831abc0f69435b9e2d0d96dd491e841`](https://github.com/BerthalonLucas/Overtype/tree/e202cd1f8831abc0f69435b9e2d0d96dd491e841), version 0.6.2. Sources et registres consultés le 10 octobre 2026. Inventaire initial : 35 branches, 471 fichiers suivis sur main. Les branches apparues ensuite sont traitées séparément dans les comparaisons.

## Verdict

**La stack n'est pas à réécrire. Le principal risque n'est pas une prolifération de boutons faits maison, mais les garanties de la couche native et la capacité des tests à les démontrer.**

Radix, Motion, Lucide, cmdk, Tauri, reqwest, rusqlite et les plugins Tauri sont réellement utilisés. Le CSS spécifique décrit en grande partie une direction artistique et des contraintes de fenêtres natives que l'installation d'un kit supplémentaire ne supprimerait pas. Les trois projets npm s'installent et se construisent ; aucune incompatibilité de peers ou version inexistante n'a été trouvée dans les contrôles réalisés.

Le code contient néanmoins des risques sérieux de concurrence/validation avant collage, de la duplication de persistance, quelques mauvais usages de primitives accessibles, du parsing maison fragile et des outils de validation non portables. Les tests sont nombreux et utiles, mais les tests navigateur remplacent le bridge natif par des fixtures : ils ne prouvent pas le bon remplacement d'une sélection réelle dans une application Windows.

**Bilan consolidé : 46 constats initiaux, regroupés en 40 sujets : 4 P1, 23 P2, 13 P3.** Parmi eux, 39 concernent main et 1 uniquement une ancienne branche WIP. Ce ne sont pas 40 vulnérabilités : le registre distingue bugs, risques conditionnels et dette. Les quatre P1 sont des **priorités de validation/correction issues de l'analyse statique**, pas quatre incidents Windows reproduits. Aucun P0 ni chemin RCE démontré.

Le registre `FINDINGS.md` et `consolidated-findings.json` porte l'arbitrage final. Les rapports spécialisés initiaux servent de pièces justificatives ; leurs totaux et sévérités ne doivent pas être additionnés ni préférés aux verdicts consolidés.

## 1. Ce que je traiterais en premier

### Intégrité du collage et annulation — quatre risques P1, à tester sur Windows

1. **La revalidation UIA accepte certains échecs de lecture comme une absence de changement** (`NATIVE-001`, `src-tauri/src/capture.rs:428-513`). Le code refuse bien les changements connus de fenêtre, contrôle, identité et sélection. Mais un fournisseur UIA devenu muet peut encore laisser passer l'injection. Ce comportement est volontaire et testé : il faut arbitrer explicitement compatibilité contre preuve de stabilité, pas le présenter comme une simple ligne oubliée.
2. **Deux copies identiques ne prouvent pas l'existence d'une sélection** (`NATIVE-002`, `capture.rs:466-487`). La seconde copie existe et protège beaucoup de cas. Elle ne distingue cependant pas une sélection de ligne d'un éditeur qui copie cette même ligne sans sélection. Le cas concret dépend de l'éditeur, de sa configuration et de son exposition UIA ; duplication de texte non reproduite ici.
3. **Le verrou global reste pris pendant des appels UIA, tandis que des commandes Tauri synchrones l'attendent** (`NATIVE-005`, `lib.rs:592-595,1599-1654`). Cela peut bloquer l'UI et la pompe du hook clavier. Les raccourcis sont déjà dispatchés en worker ; le problème n'est donc pas « rien n'est asynchrone », mais l'attente partagée et la durée du verrou.
4. **Fermer visuellement la bulle ne révoque pas immédiatement un collage déjà engagé sous ce verrou** (`NATIVE-006`, `lib.rs:1962-1986`, `capture.rs:578-599`). Le nettoyage attend le verrou ; le worker peut reprendre avant lui. Une génération ou un signal d'annulation indépendant doit être vérifié après les attentes et avant l'injection.

**À préserver :** le choix produit de ne pas exiger une relecture complète du document pour coller. Relire le document, prouver la sélection avant injection et confirmer le résultat après injection sont trois contrats différents. Un correctif qui rétablit aveuglément les restrictions de PR6 pourrait annuler une décision explicite de Lucas.

### Robustesse et confidentialité — P2

- La provenance d'une copie synthétique n'est pas établie par son seul compteur global ; une écriture autonome concurrente peut être prise pour la copie source (`NATIVE-003`). La restauration après notre propre écriture possède déjà un contrôle de propriétaire : ne pas généraliser le défaut à tous les chemins.
- Le repli `TextOnly` peut perdre des formats quand un snapshot complet échoue (`NATIVE-004`). Tous les bitmaps ne sont pas perdus : certains sont conservés en DIB. La dégradation mérite une politique explicite et visible.
- `actions: []` peut provoquer un panic au chargement avant validation (`NATIVE-008`/`BR-01`), mais ce fichier n'est pas produit par une sauvegarde normale validée. Un historique SQLite indisponible peut aussi empêcher le démarrage même lorsque l'historique est désactivé (`NATIVE-009`).
- `secure_delete` n'est réglé que sur la connexion initiale ; les suppressions ultérieures ouvrent une autre connexion (`SEC-01`, `history.rs:20-49,113-125`). Une reproduction avec l'amalgamation SQLite exacte confirme le mécanisme par défaut, **pas le binaire rusqlite/DPAPI Windows livré**. Les textes restent chiffrés ; métadonnées et fragments chiffrés peuvent subsister. Un WAL retenu nécessite également une politique de purge ; aucune promesse d'effacement physique absolu.
- Le streaming possède des buffers sans plafond et des lectures de corps d'erreur difficilement annulables ; `[DONE]` ne termine pas immédiatement la lecture (`ARCH-03`, `ARCH-07`). Corriger les bornes mémoire et la consommation du flux, **sans restaurer automatiquement le timeout total ou 4096 tokens**, retirés intentionnellement.

## 2. Réutilisation des frameworks : garder, corriger, remplacer

| Zone | Constat | Choix recommandé |
|---|---|---|
| Boutons, menus, sliders, switches, dialogues | Les primitives Radix sont bien présentes et utilisées. | Garder ; compléter les contrats de focus et d'accessibilité. Pas de migration HeroUI imposée. |
| Dialogue de copie manuelle | Sans Trigger/refocus approprié, le focus revient sur BODY après fermeture ; reproduit. | Utiliser `Dialog.Trigger asChild` ou `onCloseAutoFocus` de Radix (`FE-01`). |
| Animations et morphing | Le runtime s'appuie sur Motion. Le solveur maison sert notamment à des courbes CSS précalculées et tests. | Ne pas appeler cela « deux moteurs runtime » sans suivre les imports et usages. Garder les besoins natifs/réduction du mouvement. |
| Îlot et halo | Interaction spécifique, hit-testing et géométrie liés à Windows ; ce n'est pas un dropdown standard. | Garder les adaptations produit, tester les invariants. CSS personnalisé ≠ réinvention fautive. |
| Persistance des réglages/setup | Deux noyaux de sauvegarde/adoption/flush ont divergé ; une lecture initiale tardive écrase un événement plus récent. | Corriger la course, mutualiser le noyau transactionnel seulement (`FE-02`, `FE-05`). Pas de Redux/Zustand obligatoire. |
| Configuration du préflight | Un parseur `.env` local ne reproduit pas les commentaires, substitutions et valeurs vides de Compose. | Lire les paramètres effectifs via `docker compose config --format json`, déjà disponible dans le déploiement ; ne pas journaliser le modèle complet (`ARCH-01`). |
| SSE d'évaluation Python | Décodage ligne par ligne au lieu d'événements ; `choices: null` provoque une exception. | Petit parseur d'événements correctement testé ou SDK officiel si son coût est justifié (`ARCH-02`). |
| SSE Rust | Framing et logique métier mélangés, bornes insuffisantes. | Évaluer une brique SSE éprouvée ; garder nos bornes, annulation et validation de complétude. Une bibliothèque ne remplace pas ces invariants. |
| Erreurs IPC | Des erreurs françaises brutes deviennent parfois des clés implicites de contrôle/traduction. | Étendre les codes structurés déjà présents, pas ajouter un framework i18n pour un défaut de contrat (`ARCH-05`). |
| `lib.rs` | Assemblage, cycle de vie, réglages, remplacement et fenêtres partagent un état/verrou. | Extraire progressivement les responsabilités et transitions testables ; pas un découpage mécanique motivé uniquement par le nombre de lignes (`ARCH-04`). |

Les différences React 18/19 entre les labos et l'app ne signifient pas que plusieurs React cohabitent dans le même runtime de production. Le labo Réglages utilise explicitement sa propre résolution d'imports. Les styles hérités et actuels méritent une carte de responsabilités, pas une fusion esthétique automatique.

## 3. Packages et versions

Inventaire : **61 déclarations npm dans trois projets**, 493 entrées résolues dans leurs locks, **24 déclarations Cargo**, 574 packages dans Cargo.lock, toutes cibles comprises. Les déclarations répétées entre projets ne sont pas des paquets uniques. L'inventaire des variantes couvre les 35 branches initiales ; les anciennes versions ne deviennent pas autant de problèmes actifs.

- **vLLM 0.28.0** : deux advisories officiels retenus sur les routes texte, corrigés en `>=0.29.0`. Scénarios : `cache_salt` excessif ou `stop_token_ids` invalide avec `min_tokens`. Le client Overtype n'envoie pas ces paramètres ; un autre client local ou un utilisateur autorisé d'un proxy peut le faire. Ports loopback et proxy réduisent l'exposition. Préparer une mise à niveau qualifiée sur les modèles/GPU cibles, pas une montée aveugle à latest. Sources : [GHSA-wpww-v874-ph2p](https://github.com/vllm-project/vllm/security/advisories/GHSA-wpww-v874-ph2p), [GHSA-v5gm-qgmv-gc6c](https://github.com/vllm-project/vllm/security/advisories/GHSA-v5gm-qgmv-gc6c).
- **Tooling npm** : `source-map-js 1.2.1` à corriger vers `1.2.2` ; `braces 3.0.3` sans correctif publié pour l'avis vérifié. Ce sont des risques sur entrées hostiles de build/test, pas une exploitation démontrée du desktop. Ne pas suivre aveuglément `npm audit fix` lorsqu'il propose un downgrade du tooling.
- **Cargo** : les doublons reqwest et windows viennent en partie des contraintes des dépendants. Le choix native-tls du client vise les certificats d'entreprise ; l'alignement des numéros ne doit pas casser ce support. Les versions API JS/CLI/crate/plugins Tauri ne se synchronisent pas en comparant simplement leurs chiffres.
- **Maintenance facultative** : `thiserror` et `bytes` déclarés sans usage direct repéré, une dépendance Radix du prototype sans import direct identifié, outils de build classés dans `dependencies`. Nettoyages modestes, pas justification d'une refonte. La contre-review du tiers a corrigé notre premier faux positif d'usage de `bytes` : il s'agissait d'un paramètre, pas de la crate.
- **Chaîne release** : Actions sur tags mutables et Rust `stable` flottant. Épingler/qualifier les références et réduire les privilèges ; aucun compromis d'Action ou secret divulgué n'a été observé.

## 4. Les branches changent réellement la conclusion

Classification des **35 refs initiales**, noms et SHA vérifiés en code :

| Classe | Nombre | Interprétation |
|---|---:|---|
| Ancêtre de main, main compris | 17 | Présentes dans son historique ; ne prouve pas que chaque ancien comportement a été conservé. |
| Patch équivalent / squash | 10 | Un `ahead` Git ne signifie pas que leur travail manque. |
| Partiellement reprises | 5 | Examiner les invariants utiles, pas fusionner globalement. |
| Historiques abandonnées | 2 | Ancienne direction artistique/documentation. |
| Travail unique restant | 1 | Notamment garde de type-check des tests de `wt-050-atelier`, pas promesse de chantier actif. |

À récupérer potentiellement, **par petites adaptations** :

- `codex/multi-editor-replacement` / PR6 : matrice Edge de remplacement, presse-papiers riche et Undo ; nettoyage des touches après SendInput partiel. PR6 est ouverte, pas fusionnée ; les restrictions de lecture du document ne sont pas toutes compatibles avec les décisions ultérieures.
- `wt-050-natif` : garde actions vides et idées de récupération des réglages. Sa récupération d'historique crée toutefois des archives hors purge : **ne pas reprendre ce code sans politique de rétention**.
- `wt-050-atelier` : type-check Playwright/visuels exclu du build actuel.
- `wt-050-verre` : persistance des erreurs du parcours « Afficher le résultat », à décider explicitement ; son ancien thème et transport ne sont pas à réintroduire.

Aucune branche ancienne n'a été fusionnée, supprimée ou modifiée.

## 5. Ce qui a réellement été exécuté

| Vérification locale | Résultat | Portée / limite |
|---|---|---|
| Installation/build des trois projets npm | Réussis | Versions verrouillées ; hôte Linux/Node 26, pas Windows/Node 24 cible. |
| Suite frontend principale | **314/314, 40 fichiers** lors du run réussi | Un autre passage concurrent a connu un échec de timing ; ne pas masquer la sensibilité à la charge. |
| Python server | **5 passent, 1 test Windows sauté** | Pas de GPU ni d'endpoint modèle. |
| Suite E2E complète à 6 workers | **226 passent, 24 échouent** | Concurrence avec autres vérifications durant une partie du run. |
| Reprise isolée des 24 E2E à 2 workers | **24 passent** | **Ce n'est pas un run complet vert.** Cause racine des premiers échecs non établie. |
| Visuels Linux | **14 erreurs de références absentes, 1 interrompu, 37 non exécutés** | Baselines versionnées Windows ; pas 14 défauts visuels. Aucune référence générée pour verdir. |
| Accessibilité ciblée | Cinq états axe sans violation ; bugs de focus/statut reproduits séparément | Ni conformité WCAG globale ni validation NVDA. |
| Repros de concurrence réglages et Field | Deux tests ciblés reproduisent les défauts ; rejoués par le coordinateur | Les tests affirment le mauvais comportement observé, pas une correction. |
| SQLite | Reproductions synthétiques avec l'amalgamation exacte, dont WAL | Pas exécution du produit rusqlite/DPAPI Windows. |
| Rust/NSIS/Windows/GPU local | Non exécutés | Cargo, PowerShell et Docker absents de l'hôte d'audit. |

**Contrepoint important : la CI GitHub du commit audité est verte.** Le coordinateur a relu l'API des runs et de leurs jobs, pas seulement un badge :

- [Validate and build, run 37957336929](https://github.com/BerthalonLucas/Overtype/actions/runs/37957336929) : frontend, evaluation-harness et windows réussis.
- [Release, run 37957336809](https://github.com/BerthalonLucas/Overtype/actions/runs/37957336809) : job Windows réussi.
- Un autre run Validate and build du même SHA, [37910793690](https://github.com/BerthalonLucas/Overtype/actions/runs/37910793690), est également vert.

Il s'agit de l'exécution distante existante, pas de tests Windows relancés par cet audit. Compilation/test Rust et packaging Windows ne couvrent toujours pas une sélection, un collage et une annulation réels dans un éditeur.

Autres manques de vérification : le test Python PowerShell n'est appelé qu'en CI Linux et donc sauté ; les E2E et le harness serveur ne sont pas des dépendances obligatoires du workflow de publication ; `npm run lint` n'existe pas ; les tests Playwright ne font pas partie de `tsc -b`.

## 6. Ordre de travail recommandé, sans l'exécuter ici

1. **Écrire/exécuter les scénarios Windows d'intégrité** : sélection perdue, UIA muette, absence de sélection, sélection multiple, clipboard concurrent, SendInput partiel, fermeture pendant UIA bloquée. Corriger les invariants prouvés défaillants avant d'étendre les fonctions.
2. **Renforcer les garde-fous déjà disponibles** : garde actions vides, récupération non destructive, historique optionnel résilient, pragmas par connexion, lecture réseau bornée et annulable.
3. **Faire correspondre publication et validation** : tests Windows ciblés, test Python Windows, typage E2E, traces d'échec et checks sur le SHA publié. Les retries servent au diagnostic, pas de correctif de flakiness.
4. **Corriger les défauts frontend reproduits**, puis mutualiser la persistance et structurer les erreurs IPC. Garder Radix/Motion et l'esthétique validée.
5. **Nettoyage proportionné** : scripts sans chemins personnels, docs d'entrée à jour, dépendances tooling ciblées, Actions épinglées. Reporter les migrations de stack sans bénéfice démontré.

## 7. Comparaison des branches ajoutées pendant l'audit

Deux nouvelles refs documentaires ont été examinées en complément des 35 initiales : **37 branches couvertes au total avant création de notre branche de livraison**, à des profondeurs précisées dans les matrices.

### Audit Claude — `audit/claude-code-flow-9-sous-agents`

Source figée : `aa2a23e0d6f1f8ab7476d8d70fce7b41f5cd116b`, `AUDIT.md`. Ses 765 lignes ont été lues et ses **118 IDs classés** : 13 confirmés, 15 convergences, 47 nuances, 5 rejets, 8 hors périmètre, 30 non revérifiés. Classer n'est pas reproduire : les compteurs clippy/knip et résultats natifs du tiers n'ont pas été relancés. Sa base principale est la 0.6.0 ; nos contrôles visent main 0.6.2.

Apports utiles : modal de journal setup à composer avec Radix, Provider Tooltip partagé, divergence des deux contrôleurs d'essai, normalisation utilisée en production mais hébergée dans le mock, simplification de quelques adaptations Tauri/fixtures. Ces apports sont qualifiés dans `comparison-claude.md` ; ils ne sont pas ajoutés automatiquement aux 40 sujets du registre initial.

En revanche, nous ne retenons pas comme défauts démontrés : « deux moteurs Motion runtime », familles de tokens forcément fautives, HeroUI forcément abandonné ou workspaces obligatoires. Ces propositions mélangent parfois choix produit, prototype et production. La séparation actuelle peut avoir un coût d'entretien, mais cela ne prouve pas qu'une fusion/migration soit la bonne réparation.

### Roadmap — `application-chatgpt-like-interne`

Source figée : `1cabc9537f1fd76f05d6de335ea02879ea05358d`, 14 fichiers changés, dont 13 documents de roadmap/recherche. **Ce n'est pas un audit du code actuel.** Les dix points de comparaison sont des clarifications et risques de conception futurs ; aucun n'est compté comme nouveau bug de main.

Le principe de garder React/Tauri et de réutiliser les briques éprouvées rejoint notre conclusion. Quelques exclusions méritent correction : `window-state` peut filtrer fenêtres/champs persistés ; `async-openai` propose TLS natif ; Presidio est extensible à des reconnaisseurs français ; Aho-Corasick ne fournit pas à lui seul une normalisation des accents.

Avant tout chat/passerelle, définir les contrats de consentement, rétention, titres et pseudonymes, ainsi que la destination réelle derrière un endpoint dit « interne ». Une URL de prompt et une option « temporaire » ne garantissent ni anonymisation, ni absence de logs, ni politique DLP. Génération des types et API Channel ne remplacent pas autorisation IPC, isolation des sessions et reprise de flux. Voir `comparison-roadmap.md` pour les sources officielles et critères de vérification.

## Limites et règles de lecture

Cet audit couvre tous les grands sous-systèmes et toutes les branches de l'inventaire, mais pas chaque ligne de chaque ancien snapshot. Les deltas et fichiers prioritaires sont indiqués dans les rapports spécialisés. Ce n'est pas une certification sécurité, une garantie d'absence de bug ou une validation esthétique/native Windows.

Les sévérités expriment une priorité éditoriale contextualisée, pas un score CVSS. La comparaison des autres audits distingue les apports confirmés, les recommandations discutables et les travaux futurs. Aucun code d'application, réglage, package ou workflow n'a été corrigé pendant l'audit ; la livraison demandée se limite aux rapports.
