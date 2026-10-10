> **Pièce spécialisée initiale.** Les verdicts, regroupements et sévérités finaux sont dans [FINDINGS.md](FINDINGS.md) et [la synthèse](SYNTHESE.md). Ne pas additionner les totaux des spécialistes. Les chemins `preuves-locales/` et `artefacts-locaux/` désignent des preuves privées non jointes intégralement ; voir [VERIFICATION.md](VERIFICATION.md).

# Overtype — audit QA / CI

Base : `main@e202cd1f8831abc0f69435b9e2d0d96dd491e841`. Audit seul, checkout partagé inchangé. Copie détachée : `artefacts-locaux/qa-work`. Fiches réellement utilisées : **Evidence Collector** et **Test Automation Engineer** (Agency `f99f6aa910a442b0197b768ce0ea7751e35e2060`).

## Synthèse

- **314 tests frontend / 40 fichiers passent**, `tsc -b && vite build` passe réellement. **5 tests Python passent, 1 Windows sauté** sur 6 découverts.
- **E2E complet : 226 passent, 24 échouent à 6 workers**. Après arrêt de la concurrence visuelle, recheck isolé à 2 workers : **24/24 passent**. Tous les 250 cas ont donc passé au moins une fois, mais **aucun run complet vert n’est revendiqué**. Sensibilité à la charge observée; cause racine non prouvée, aucun bug produit déterministe établi par cette passe.
- **Visuels Linux : 14 failed, 1 interrupted, 37 did not run**, total 52. Les 14 erreurs sont des snapshots `references/linux/...` absents, non des écarts de pixels. Arrêt **volontaire** par SIGINT après diagnostic, exit **130**. Pas d’incident infra présenté comme défaut produit; aucune génération/régénération de snapshot, aucun Windows simulé.
- Les principaux risques portent sur les **gates**, pas sur le nombre de tests : test Python Windows jamais exécuté en CI, release indépendante des E2E, remplacement réel hors automatisation native de main.

## Exécutions et preuves

Logs complets : `preuves-locales/qa-logs/`. `qa.json` contient commandes, codes et durées individuels; les artefacts du run E2E initial complet sont conservés dans `qa-artifacts/e2e-highparallel/`, ceux du recheck dans `qa-artifacts/e2e/`.

| Contrôle | Résultat réel | Log |
|---|---|---|
| npm ci --no-audit --no-fund | succès, 153 paquets; aucune version modifiée | npm-ci.log |
| npm test (hôte principal, isolé) | 40 fichiers, 314 tests passent, code 0 | frontend-unit-host-retry.log |
| npm run build | TS + Vite passent, code 0 | frontend-build-host.log |
| Playwright complet, workers=6 | 226 pass / 24 fail, code 1, 6.9 min | e2e-complete.log |
| Playwright --last-failed, workers=2 | 24 pass, code 0, 1.3 min | e2e-failed-recheck.log |
| Playwright visual --update-snapshots=none | 14 baseline-missing / 1 interrompu / 37 non lancés, code 130 | visual-linux.log |
| unittest discover server | 6 découverts, 5 pass, 1 skip, code 0 | python-unit-host.log |
| Syntaxe des six outils Python + evaluate --help | succès, sans GPU/endpoint | python-tools-syntax.log / evaluate-help.log |
| npm run lint | missing script, code 1; absence de gate, pas défaut code prouvé | lint.log |
| cargo test --locked | commande absente, code 127 | rust-tests.log |
| docker compose … config --quiet | CLI absente, code 127; aucun service lancé | compose-config.log |
| Intégrité | main SHA inchangé dans les deux checkouts; aucun diff suivi | integrity.log |

**Tentatives partielles conservées.** Première exécution E2E à 2 workers limitée à 180 s par le collecteur auxiliaire : suite incomplète, log `e2e.log`; elle a été remplacée par un vrai run complet, pas comptée comme réussite. Première tentative `npm test` hôte a subi le délai outil 120 s lors des suites navigateur simultanées, sans synthèse Vitest (`frontend-unit-host.log`); sortie Vitest inconnue, seul code outil 124 connu. Rejoué seul, succès en 12.28 s.

**Runtimes distincts.** `versions.log` atteste Node 26.5.1/npm 11.17.0/Python 3.13.5/Linux pour les validations principales. Le kernel execute_code exposait des sous-processus Node 26.7.0/npm 11.19.0/Python 3.14.7 pour les premières validations auxiliaires; ceux-ci sont étiquetés dans le JSON. Pas de downgrade silencieux. Le Node 24 de CI n’a pas été lancé.

**Avertissements non bloquants du build :** import JSON Vite sans attributs pour un futur configLoader natif; import dynamique Tauri inefficace car aussi statique; JS 864.90 kB (269.82 gzip), CSS 137.42 kB (27.96 gzip). Ce sont des mesures/avertissements, pas une preuve de régression de latence Windows.

## Constats

### QA-01 — P2 · risque — Le test de démarrage serveur Windows est toujours sauté dans la CI déclarée

**Source :** `main@e202cd1f8831abc0f69435b9e2d0d96dd491e841` · `.github/workflows/ci.yml` lignes 27, 35.

**Preuve / scénario :** Le seul job unittest est evaluation-harness sur ubuntu-latest. server/test_evaluation.py:67 protège le test start.ps1 par os.name == "nt" + powershell. Job windows:36-55 et release:50-53 ne lancent pas unittest. Exécution Linux: 6 découverts, 5 passent, 1 skip. Historique -S: d5ecd2a/8281476 introduisent bien ce test de non-régression.

**Impact :** Une régression PowerShell au premier démarrage ou sur service arrêté laisse tous les jobs déclarés verts; le scénario réel concerné est précisément celui régressé auparavant.

**Alternative établie :** Ajouter setup-python 3.13 et unittest au job Windows existant, sur fixtures docker.cmd/python.cmd sans GPU. Garder le test Linux pour le streaming et la politique endpoint. **Coût/compromis :** faible.

**Confiance :** haute. **Limites :** Test Windows non exécuté sur cette VM; absence de câblage établie statiquement.

### QA-02 — P2 · risque — La publication ne dépend pas des checks E2E ni du harness serveur

**Source :** `main@e202cd1f8831abc0f69435b9e2d0d96dd491e841` · `.github/workflows/release.yml` lignes 4, 9, 50, 53, 100.

**Preuve / scénario :** Release est déclenchée indépendamment par tag, dispatch ou package.json sur main. Elle exécute npm test/build/cargo test puis publie; aucune dépendance/attente de ci.yml, aucun Playwright/unittest/Compose dans release.

**Impact :** Un tag ou dispatch peut produire une release malgré une régression UI d’intégration qui échoue au job frontend, ou malgré un test serveur rouge. Pas de publication défectueuse observée ici.

**Alternative établie :** Factoriser les validations existantes en workflow réutilisable ou les faire précéder dans le même graphe la publication via needs; vérifier le SHA exact à publier. Éviter un needs entre workflows distincts, qui ne crée pas de dépendance. **Coût/compromis :** moyen: temps E2E sur release; pas de nouvelle bibliothèque.

**Confiance :** haute. **Limites :** Protections de branche et historique distant de runs non consultés; les protections de merge ne couvrent pas à elles seules tag/dispatch.

### QA-03 — P2 · risque — La voie CI native ne valide pas le remplacement réel d’un éditeur

**Source :** `main@e202cd1f8831abc0f69435b9e2d0d96dd491e841` · `.github/workflows/ci.yml` lignes 36, 55.

**Preuve / scénario :** Windows lance cargo test et NSIS, pas de parcours sélection→SendInput→éditeur→relecture. e2e/native-fixture.ts:50-115 recopie le placement Rust et :165+ simule les commandes. scripts/probe-native-ui.mjs:24 exclut explicitement capture réelle et collage réel. Une voie réelle existe dans origin/codex/multi-editor-replacement@86b3b23f (ci.yml:52-54, scripts/test-replacement-windows.mjs), mais pas sur main.

**Impact :** Les assertions navigateur vérifient le consommateur TS, pas UIA, le presse-papiers riche, la cible réelle du collage ni Ctrl+Z dans Edge. Ces risques concernent la fonction principale et ne sont pas levés par le build natif.

**Alternative établie :** Adapter à l’API actuelle un petit sous-ensemble du test Edge de cette branche sur desktop Windows dédié: sélection Unicode, champ readonly, cible changée, nouveau propriétaire clipboard, collage bloqué. Réutiliser Playwright déjà présent; ne pas fusionner une ancienne branche entière. **Coût/compromis :** moyen/élevé: desktop interactif Windows et coût de maintien; suite séparée bornée.

**Confiance :** haute. **Limites :** Absence de couverture automatique native ≠ bug de collage prouvé; aucune exécution Windows revendiquée.

### QA-04 — P3 · dette — Les échecs fonctionnels sensibles à la charge n’ont pas de trace conservée

**Source :** `main@e202cd1f8831abc0f69435b9e2d0d96dd491e841` · `playwright.config.ts` lignes 10, 15.

**Preuve / scénario :** La config fonctionnelle ne conserve que screenshot only-on-failure; pas trace ni video. Run complet à 6 workers (simultané à une tentative visuelle et temporairement Vitest): 226 passent, 24 échouent, 0 retry automatique. Recheck des 24, seul à 2 workers: 24 passent. Erreurs: timeouts, html sans data-ui, clock.pauseAt vers le passé, région intermédiaire; qa-e2e-failures.json + e2e-highparallel/ gardent les premières preuves.

**Impact :** Une capture finale et le contexte ne reconstruisent pas l’ordre des événements IPC/rAF, ni la requête qui recharge la page. Le passage au second essai ne rend pas le premier run vert; il faut diagnostiquer avant de qualifier un bug produit.

**Alternative établie :** Activer trace retain-on-failure dans la config fonctionnelle, réutiliser upload-artifact existant. Reproduire à concurrence maîtrisée, figer l’horloge avant navigation quand possible et remplacer les attentes temporelles arbitraires par des conditions. Ne pas traiter les retries comme correctif. **Coût/compromis :** faible pour traces; coût artifacts; diagnostic moyen.

**Confiance :** haute. **Limites :** La concurrence/charge est un facteur associé observé, pas une cause racine prouvée; aucune flakiness en CI distante démontrée.

### QA-05 — P3 · dette — Les comparaisons visuelles Windows ne sont pas une gate CI

**Source :** `main@e202cd1f8831abc0f69435b9e2d0d96dd491e841` · `.github/workflows/ci.yml` lignes 17, 21, 48, 51.

**Preuve / scénario :** npm run ui:check n’est appelé dans aucun workflow. playwright.visual.config.ts:7 distingue {platform}; seules références win32 versionnées. README:20-31 précise Îlot non approuvé et :48-65 documente v4 périmé. Sur Linux sans génération: 14 tests échouent avec snapshot absent, 1 interrompu volontairement, 37 non exécutés.

**Impact :** Les références ne détectent pas automatiquement une dérive visuelle dans les releases actuelles; leurs succès historiques n’attestent pas l’approbation esthétique ni Windows natif.

**Alternative établie :** Après revue humaine des références Îlot, ajouter ui:check --grep @ilot sur un runner Windows cohérent avec leur Chromium. Maintenir v4 en lane séparée ou le retirer selon décision produit. Ne pas copier les baselines win32 en linux ni générer des images pour verdir. **Coût/compromis :** moyen: revue références et stabilité environnement.

**Confiance :** haute. **Limites :** Les erreurs Linux sont un manque de baseline applicable, pas 14 défauts visuels produit. Pas de comparaison Windows exécutée.

### QA-06 — P3 · bug — Le générateur de kit d’essai n’est plus utilisable tel quel pour 0.6.2

**Source :** `main@e202cd1f8831abc0f69435b9e2d0d96dd491e841` · `scripts/package-test-kit.ps1` lignes 24, 30, 49, 62.

**Preuve / scénario :** Le script prend version package.json puis exige docs/ESSAIS-$version.md et docs/evaluation/$EvaluationVersion/README.md. Probe kit-paths: docs/ESSAIS-0.6.2.md et docs/evaluation/0.6.2/README.md absents. Il écrit encore Ctrl+Alt+T et le repli en onglet, alors que décisions UI:72 et :77 décrivent Ctrl+Alt+Space/Îlot.

**Impact :** Après fourniture de l’installateur, Copy-Item de la notice courante échoue; même une adaptation des chemins distribuerait des instructions de test obsolètes. Écart limité à un outil manuel historique, non au workflow NSIS/release.

**Alternative établie :** Choisir explicitement une notice actuelle et une version d’évaluation disponible, ou marquer le script archive 0.1.x; actualiser le parcours simulé Îlot. Garder la distinction réponse synthétique/capture réelle. **Coût/compromis :** faible.

**Confiance :** haute. **Limites :** PowerShell non exécuté; chemins manquants et interpolation établis sur le snapshot.

### QA-07 — P3 · risque — Capture-matrix consigne les divergences sans les transformer en échec

**Source :** `main@e202cd1f8831abc0f69435b9e2d0d96dd491e841` · `scripts/capture-matrix.mjs` lignes 82, 89, 124, 129.

**Preuve / scénario :** textMatches et clipboardAfter sont enregistrés sans assertion. status DONE dépend uniquement de !c.error; shoot peut rendre kind=nothing. Même status ERRORS n’impose pas explicitement une sortie non nulle (erreurs absorbées par cas). Outil manuel de collecte, non utilisé par les workflows.

**Impact :** Un consommateur qui lit DONE ou exit 0 comme preuve de capture/preservation obtient un faux positif. Le JSON conserve toutefois les champs négatifs: la preuve n’est pas fabriquée ni perdue.

**Alternative établie :** Renommer DONE en collecte_complete et séparer verdicts par scénario, ou ajouter assertions adaptées aux cas puis code de sortie non nul sur violations. Ne pas exiger textMatches=true pour le scénario notice attendu. **Coût/compromis :** faible.

**Confiance :** haute. **Limites :** Pas d’exécution de la matrice native ni de capture défaillante observée; risque de mauvaise interprétation, pas régression runtime.

## Assertions, mocks et preuves revendiquées

Le scan d’assertions/skips/temporisations (inventaire `qa-test-patterns.json`) n’a pas trouvé de `expect(true)` littéral. Beaucoup de `toBe(true)` portent sur un vrai résultat, une convergence géométrique ou une politique : pas tautologiques par nature. Les comparaisons de tokens et les tests de contraste lisent le CSS; les contraintes 4.5:1 peuvent réellement échouer, même si elles ne prouvent pas le rendu final de tous les textes.

`src/bridge.test.ts` teste aussi le simulateur lui-même (résultat `mockReply`, modèles `mockModels`, scénarios déterministes). C’est utile pour garder une preview fidèle, **pas** une preuve du probe Rust. Les vecteurs endpoint partagés et les tests Rust sur serveur HTTP loopback apportent au contraire un contrat indépendant. La fixture native recopie une partie du placement Rust : risque de dérive, limité par les tests géométriques Rust mais non supprimé par le navigateur.

Le serveur Python local teste Unicode, `[DONE]`, `finish_reason=length`, endpoint, percentiles et environnement. Son Handler ignore le corps de requête : il ne valide pas modèle, prompt, Authorization ou réglages vLLM. `gpu_memory.py` et `fetch_metadata.py` n’ont pas de tests dédiés dans la discovery actuelle; syntaxe seulement contrôlée. Ni benchmark modèle ni GPU lancé.

Les nombreuses attentes `waitForTimeout` ne sont pas toutes équivalentes : certaines observent volontairement une absence pendant une durée ou échantillonnent une animation; d’autres attendent arbitrairement navigation/sauvegarde. Ne pas les remplacer toutes aveuglément. Les erreurs `clock.pauseAt` vers le passé et les timeouts du run chargé motivent un diagnostic avec trace, pas une assertion « application cassée ».

`docs/VALIDATION.md` parle surtout des versions 0.1.x et distingue honnêtement les sessions verrouillées, screenshots noirs, browser IPC, DPIs non validés et benchmarks synthétiques/humain pending. Leurs chiffres ne sont pas reconfirmés pour 0.6.2 ici. `visual-tests/README.md` précise que les références Îlot ne sont pas approuvées; cette réserve doit rester dans toute synthèse.

## Inspection visuelle réelle, limitée

Deux PNG Linux issus des échecs de baseline ont été ouverts et inspectés : `qa-artifacts/visual/states-history-light-chromium/test-failed-1.png` montre la page Data claire, historique activé, une entrée fictive, navigation et état Saved; `states-long-dark-chromium/test-failed-1.png` montre une bande sombre centrée en bas, texte long et actions superposées. Ce sont des **états Chromium**, pas preuve de suppression/persistance, d’effet Acrylic, de composition Windows ou de fluidité native. Aucune approbation esthétique globale n’en est tirée.

## Couverture et variantes de branches

- **35 refs origin** inventoriées/comparées sur le périmètre QA. Matrice exacte SHA/ancêtre/fichiers : `qa-branch-matrix.json`. Les configurations se regroupent en **13 variantes fichier-contenu** : `qa-branch-variants.json`. Main seule exécutée; 18 refs non-ancêtres ne sont pas qualifiées de chantiers manquants.
- Config CI presque identique sur les anciennes branches; `codex/multi-editor-replacement@86b3b23f` apporte la voie réelle Edge/SendInput/UIA (script archivé dans `qa-logs/branch-native-replacement-source.log`). Main possède des évolutions produit ultérieures : reprendre un test adapté, pas la branche complète.
- `refonte-reglages` est déjà ancêtre, configurations fonctionnelles proches de main; main ajoute notamment signature updater et latest.json aux releases. Anciennes variantes release non signées ne constituent pas un défaut courant de main.
- Analyse sémantique : workflows/configs, fixture IPC, assertions ciblées frontend, suite visuelle, outils native/test-kit, six modules Python, sections tests Rust probe/inference/capture/actions/history/placement. `reviewed_files` liste les fichiers lus spécifiquement. Le scan global des tests et leur exécution ne valent pas review de chaque ligne.
- Hors couverture réelle : Windows natif, Rust/NSIS, moniteurs/DPI mixtes, Office/Teams, performance GPU/inférence, publication/signature effective, runs CI distants, protections de branche.

## Points solides à conserver
- 314 assertions/tests unitaires passent dans 40 fichiers, build TS+Vite réel réussi.
- Vecteurs endpoint JSON partagés entre TS et Rust; tests Rust HTTP local et SSE réels plutôt qu’un simple retour constant.
- Mocks explicitement signalés comme browser-only, jamais benchmark d’inférence; documentation native précise focus/capture/composition/DPI non établis.
- README visuel sépare stabilité des screenshots et approbation Lucas; références périmées signalées, pas masquées par régénération.
- Probe natif restreint au processus lancé et données isolées FLOWTRANSLATE_DATA_DIR; serveur unittest loopback sans GPU.
- Release contrôle versions, refuse réécriture, exige clé et signature updater, fournit SHA256 et latest.json. Signature updater ≠ preuve Authenticode.
- Pas d’assertion littérale expect(true) repérée dans le scan; contrastes calculés et tests d’état/races apportent de vraies contraintes.

## Sources
- https://playwright.dev/docs/test-use-options (consulté 2026-10-10)
- https://playwright.dev/docs/test-snapshots (consulté 2026-10-10)
- https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idneeds (consulté 2026-10-10)
