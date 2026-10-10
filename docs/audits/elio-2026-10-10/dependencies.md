> **Pièce spécialisée initiale.** Les verdicts, regroupements et sévérités finaux sont dans [FINDINGS.md](FINDINGS.md) et [la synthèse](SYNTHESE.md). Ne pas additionner les totaux des spécialistes. Les chemins `preuves-locales/` et `artefacts-locaux/` désignent des preuves privées non jointes intégralement ; voir [VERIFICATION.md](VERIFICATION.md).

# Audit Overtype — dépendances

**État actif : main `e202cd1f8831abc0f69435b9e2d0d96dd491e841`.** Sources externes consultées le 10 octobre 2026 UTC. Audit seul ; repository partagé inchangé, aucun update.

## Synthèse

La stack actuelle s’installe et se construit pour les trois packages npm. Aucun paquet/version inventé ni conflit de peers constaté. Le risque principal identifié est **vLLM 0.28.0 et ses advisories DoS des routes texte**, limité par le loopback et le proxy prescrit. Les autres sujets sont les advisories de tooling, la chaîne de signature dépendant de références CI flottantes et la résolution Playwright non portable du prototype. **Aucun P0/P1, aucune preuve de vulnérabilité remotely exploitable du binaire Windows.**

Constats : 4 ({'P2': 2, 'P3': 2}). Inventaire JSON intégral : `dependencies-inventory.json`. Versions/ranges/features/edges/sources/intégrités et présence d’imports conservés, pas seulement les tableaux abrégés ci-dessous.

Fiches Agency réellement employées : **Tool Evaluator** (preuve, sécurité/intégration/coût) et **Developer Tooling Engineer** (portabilité/reproductibilité/interface des scripts). Aucun script issu de ces fiches exécuté.

## Totaux calculés en Python

| Package | Déclarées | Portée | Entrées résolues du lock | Couples nom/version |
|---|---:|---|---:|---:|
| `package.json` | 26 | {'dependencies': 20, 'devDependencies': 6} | 204 | 204 |
| `design-lab/package.json` | 3 | {'devDependencies': 3} | 32 | 32 |
| `design-lab/reglages/package.json` | 32 | {'devDependencies': 32} | 257 | 256 |

**npm : 61 déclarations, 493 installations dans les trois locks, 413 couples nom/version uniques entre packages.** Les entrées lock incluent les optional/binaries multi-plateformes, pas toutes installées sur Linux. **Cargo : 24 déclarations directes, 574 packages lock dont 573 de registry et le package local.** 50 noms Cargo ont plusieurs versions, toutes cibles confondues. 81 blobs manifest/lock/server distincts aux 35 pointes.

## Constats actionnables

### DEP-001 — P2 / risque — vLLM 0.28.0 possède des advisories DoS atteignables par les paramètres des routes texte

**Localisation :** `main@e202cd1f8831abc0f69435b9e2d0d96dd491e841`, `server/compose.yaml:4,37,78,120`.

**Fait / preuve :** Digest officiel vérifié. GHSA-wpww-v874-ph2p et GHSA-v5gm-qgmv-gc6c affectent <0.29.0, dont 0.28.0 ; upstream décrit cache_salt volumineux et stop_token_ids hors vocabulaire avec min_tokens>0 sur /v1/chat/completions. Pas de PoC GPU exécuté. Le client normal ne transmet pas ces paramètres.
**Scénario / chaîne :** Un autre client local atteignant 127.0.0.1:8001/8002/8003, ou un utilisateur du proxy entreprise autorisé sur chat/completions, forge directement une requête ; contournement de la surface du client Overtype.
**Impact :** Latence partagée ou arrêt EngineCore, reprise manuelle (restart:no). Risque local/tenant, pas preuve de compromission distante ou de fuite.
**Alternative établie :** Garder les ports loopback et les restrictions de proxy déjà documentées. Limiter taille du corps et autoriser les seuls paramètres nécessaires au contrat du client ; pour stop_token_ids, supprimer/refuser ce champ s’il est inutile. Préparer ensuite une image corrigée >=0.29.0 avec digest et recette WSL2/Gemma/MTP, pas une mise à latest aveugle.
**Coût / compromis :** Faible si proxy déjà présent ; changement moteur à coût moyen (GPU, FP8, speculative decoding et workaround V2 à revalider). Aucune nouvelle bibliothèque du client nécessaire.
**Confiance / limites :** élevée sur version et chemin upstream, moyenne sur exploitabilité de cette image/config sans chargement GPU

**Contre-exemples / protections existantes :** Loopback, aucun --trust-remote-code, multimedia general explicitement désactivé, docs/server entreprise exigent proxy et limites. GHSA-25q3-v2hm-8vpf est déjà corrigé en 0.28.0.

### DEP-002 — P3 / risque — Les locks npm conservent deux advisories de la chaîne build/test, sans exploit desktop démontré

**Localisation :** `main@e202cd1f8831abc0f69435b9e2d0d96dd491e841`, `package-lock.json:3065`.

**Fait / preuve :** npm audit: app 1 entrée high, ancien labo 0, reglages 5 entrées high issues de 2 advisories, non 5 vulnérabilités indépendantes. GHSA-68fv-2mgg-jv7q : source-map-js 1.2.1, correctif 1.2.2 ; GHSA-vfj7-8cjw-p6xm : braces 3.0.3, aucun correctif publié. Les 16 locks npm historiques racine ont aussi une entrée high.
**Scénario / chaîne :** Traitement de sourcemaps indexées ou de motifs glob malveillants dans tooling local ; root/source-map-js atteint via postcss (chaîne Vite), labo/braces via Tailwind CLI -> @parcel/watcher -> micromatch. Aucun chemin depuis texte corrigé/serveur vers ces parsers démontré.
**Impact :** DoS potentiel de build/test sur entrées hostiles. N’est pas une vulnérabilité à distance du binaire Overtype.
**Alternative établie :** Mise à jour ciblée future du lock vers source-map-js 1.2.2 compatible, puis builds/tests. Pour braces sans correctif, surveiller upstream et restreindre les motifs de build ; ne pas appliquer aveuglément npm audit fix (propose Tailwind CLI 4.3.0 contre 4.3.3). Ajouter contrôle advisory avec triage par scope.
**Coût / compromis :** Faible pour source-map-js, coût moyen et compromis fonctionnels pour remplacement du watcher ; ne pas migrer une bibliothèque UI majeure pour cette alerte tooling.
**Confiance / limites :** élevée pour présence et ranges, faible pour un attaquant réel contrôlant ces entrées

### DEP-003 — P2 / risque — La signature de release dépend d’Actions et d’un compilateur flottants

**Localisation :** `main@e202cd1f8831abc0f69435b9e2d0d96dd491e841`, `.github/workflows/release.yml:23,42,46,47,59,63`.

**Fait / preuve :** actions/checkout@v4, setup-node@v4, dtolnay/rust-toolchain@stable, Swatinem/rust-cache@v2 ; job contents:write et étape build possédant la clé updater. CI emploie également des tags. GitHub recommande SHA complet pour une référence immuable. Aucun Action compromis constaté.
**Scénario / chaîne :** Une action amont réécrit son tag ou son comportement et exécute du code avant la signature dans le même job de publication. Le lock npm/Cargo ne fige pas ce code ni rust stable.
**Impact :** Surface supply-chain du constructeur qui produit des mises à jour signées ; reproductibilité et traçabilité compiler/actions incomplètes. C’est du durcissement, pas un incident démontré.
**Alternative établie :** Épingler Actions à SHA vérifiés, conserver le tag en commentaire et une politique de revue ; enregistrer/pinner la toolchain Rust compatible avec MSRV 1.91 et garder actualisations de sécurité explicites. Séparer si possible build et publication à privilèges minimaux, sans prétendre que signer après un build hostile suffit.
**Coût / compromis :** Faible pour SHA, maintenance récurrente des refresh ; moyen pour séparation de jobs/artefacts et provenance. Pas de nouvelle dépendance applicative.
**Confiance / limites :** élevée

**Contre-exemples / protections existantes :** npm ci, cargo test --locked, clé obligatoire, signatures updater et digest serveur constituent déjà de bons contrôles.

### DEP-004 — P3 / bug — Le script de captures du prototype résout Playwright depuis un checkout personnel absolu

**Localisation :** `main@e202cd1f8831abc0f69435b9e2d0d96dd491e841`, `design-lab/reglages/scripts/shots.mjs:10,11`.

**Fait / preuve :** Après npm ci des trois packages, npm run shots échoue exit 1 MODULE_NOT_FOUND sur <checkout-Windows-absolu>/node_modules/@playwright/test. Repro Linux joinne ce chemin au cwd ; sur Windows un autre disque/checkout ne possède pas non plus <checkout-Windows-absolu>.
**Scénario / chaîne :** Nouvel environnement ou autre checkout Windows du labo, puis commande documentée de captures.
**Impact :** Les preuves visuelles du prototype ne sont pas rejouables via la commande documentée hors du poste d’origine. App release non affectée.
**Alternative établie :** Résoudre Playwright relativement au repository/root package (déjà @playwright/test 1.63.0), ou déclarer une devDependency propre si labo doit être autonome ; reprendre le paramètre PLAYWRIGHT_MODULE du premier labo. Utiliser dossier de sortie fourni/plancher relatif au labo.
**Coût / compromis :** Faible sans ajout de lib ; déclarer localement Playwright augmente taille installation/browsers, réutiliser root nécessite documenter npm ci root.
**Confiance / limites :** élevée

## Inventaire npm direct actif

Les versions existent dans le registry officiel. `latest` est un repère, pas une exigence de migration ni une politique LTS. Une version ancienne n’est pas, à elle seule, un advisory. Toutes les métadonnées des versions transitives et historiques figurent dans `dependencies-npm-index.json`.

### `package.json`

| Dépendance | Demandée | Résolue directe | latest consulté | Utilisation effective |
|---|---|---|---|---|
| `@radix-ui/react-collapsible` | `1.1.20` | `1.1.20` | `1.1.21` | src/connection/DiagnosticsPanel.tsx:2 |
| `@radix-ui/react-dialog` | `1.1.23` | `1.1.23` | `1.2.0` | src/components/controls.tsx:7 |
| `@radix-ui/react-dropdown-menu` | `2.1.24` | `2.1.24` | `2.1.25` | src/ui.tsx:3 |
| `@radix-ui/react-popover` | `1.1.23` | `1.1.23` | `1.2.0` | src/components/controls.tsx:4 |
| `@radix-ui/react-scroll-area` | `1.2.18` | `1.2.18` | `1.3.0` | src/GlassOverlay.tsx:3 |
| `@radix-ui/react-select` | `2.3.7` | `2.3.7` | `2.3.8` | src/components/controls.tsx:3 |
| `@radix-ui/react-slider` | `1.4.7` | `1.4.7` | `1.5.0` | src/components/controls.tsx:5 |
| `@radix-ui/react-switch` | `1.3.7` | `1.3.7` | `1.3.8` | src/components/controls.tsx:2 |
| `@radix-ui/react-tabs` | `1.1.21` | `1.1.21` | `1.1.22` | src/components/nav.tsx:2 |
| `@radix-ui/react-toggle-group` | `1.1.19` | `1.1.19` | `1.1.20` | src/components/controls.tsx:6 |
| `@radix-ui/react-tooltip` | `1.2.16` | `1.2.16` | `1.3.0` | src/components/controls.tsx:8 |
| `@tauri-apps/api` | `2.11.1` | `2.11.1` | `2.12.2` | e2e/native-fixture.ts:3 |
| `@tauri-apps/cli` | `2.11.4` | `2.11.4` | `2.12.1` | script tauri |
| `@vitejs/plugin-react` | `6.1.1` | `6.1.1` | `6.1.2` | vite.config.ts:2 |
| `cmdk` | `1.1.1` | `1.1.1` | `1.1.1` | src/components/controls.tsx:9 |
| `lucide-react` | `1.43.0` | `1.43.0` | `1.54.0` | src/components/TitleBar.tsx:2 |
| `motion` | `13.2.0` | `13.2.0` | `14.1.0` | src/GlassOverlay.tsx:2 |
| `react` | `19.2.8` | `19.2.8` | `19.3.0` | src/App.tsx:1 |
| `react-dom` | `19.2.8` | `19.2.8` | `19.3.0` | src/connection/check.test.tsx:3 |
| `vite` | `8.2.2` | `8.2.2` | `8.3.4` | tsconfig.app.json:18 |
| `@playwright/test` | `1.63.0` | `1.63.0` | `1.64.0` | e2e/actions.pw.ts:1 |
| `@types/react` | `19.2.7` | `19.2.7` | `19.3.0` | types automatiques tsc |
| `@types/react-dom` | `19.2.3` | `19.2.3` | `19.3.0` | types automatiques tsc |
| `jsdom` | `26.1.0` | `26.1.0` | `30.1.2` | vite.config.ts:20 |
| `typescript` | `7.0.2` | `7.0.2` | `7.0.2` | script build |
| `vitest` | `5.0.0` | `5.0.0` | `5.0.3` | src/actionDefaults.test.ts:1 |
### `design-lab/package.json`

| Dépendance | Demandée | Résolue directe | latest consulté | Utilisation effective |
|---|---|---|---|---|
| `esbuild` | `0.25.10` | `0.25.10` | `0.28.2` | design-lab/build.sh:4-5 |
| `react` | `18.3.1` | `18.3.1` | `19.3.0` | design-lab/assemble.mjs:13 ; runtime UMD CDN, copie npm utilisée pour validation hors réseau |
| `react-dom` | `18.3.1` | `18.3.1` | `19.3.0` | design-lab/assemble.mjs:14 ; runtime UMD CDN, copie npm utilisée pour validation hors réseau |
### `design-lab/reglages/package.json`

| Dépendance | Demandée | Résolue directe | latest consulté | Utilisation effective |
|---|---|---|---|---|
| `@heroui/react` | `^3.2.6` | `3.2.6` | `3.2.6` | design-lab/reglages/src/catalog/heroui.jsx:8 |
| `@heroui/styles` | `^3.2.6` | `3.2.6` | `3.2.6` | design-lab/reglages/src/heroui/heroui.css:7 |
| `@internationalized/date` | `^3.12.4` | `3.12.4` | `3.12.4` | Peer dependencies of @heroui/react 3.2.6 (official registry metadata) |
| `@radix-ui/react-collapsible` | `^1.1.20` | `1.1.20` | `1.1.21` | design-lab/reglages/src/settings/pages/Actions.jsx:2 |
| `@radix-ui/react-dialog` | `^1.1.23` | `1.1.23` | `1.2.0` | design-lab/reglages/src/catalog/shadcn/index.jsx:17 |
| `@radix-ui/react-dropdown-menu` | `^2.1.24` | `2.1.24` | `2.1.25` | aucun import direct repéré, à revoir avant suppression |
| `@radix-ui/react-popover` | `^1.1.23` | `1.1.23` | `1.2.0` | design-lab/reglages/src/catalog/shadcn/index.jsx:13 |
| `@radix-ui/react-scroll-area` | `^1.2.18` | `1.2.18` | `1.3.0` | design-lab/reglages/src/ui/index.jsx:16 |
| `@radix-ui/react-select` | `^2.3.7` | `2.3.7` | `2.3.8` | design-lab/reglages/src/catalog/shadcn/index.jsx:12 |
| `@radix-ui/react-slider` | `^1.4.7` | `1.4.7` | `1.5.0` | design-lab/reglages/src/catalog/shadcn/index.jsx:15 |
| `@radix-ui/react-slot` | `^1.3.3` | `1.3.3` | `1.4.0` | design-lab/reglages/src/ui/shadcn/button.jsx:5 |
| `@radix-ui/react-switch` | `^1.3.7` | `1.3.7` | `1.3.8` | design-lab/reglages/src/catalog/shadcn/index.jsx:11 |
| `@radix-ui/react-tabs` | `^1.1.21` | `1.1.21` | `1.1.22` | design-lab/reglages/src/catalog/shadcn/index.jsx:14 |
| `@radix-ui/react-toggle-group` | `^1.1.19` | `1.1.19` | `1.1.20` | design-lab/reglages/src/catalog/shadcn/index.jsx:16 |
| `@radix-ui/react-tooltip` | `^1.2.16` | `1.2.16` | `1.3.0` | design-lab/reglages/src/ui/index.jsx:15 |
| `@react-aria/ssr` | `^3.10.1` | `3.10.1` | `3.10.1` | Peer dependencies of @heroui/react 3.2.6 (official registry metadata) |
| `@react-aria/utils` | `^3.34.1` | `3.34.1` | `3.34.1` | Peer dependencies of @heroui/react 3.2.6 (official registry metadata) |
| `@tailwindcss/cli` | `^4.3.3` | `4.3.3` | `4.3.3` | build.mjs:20-23 invokes node_modules/@tailwindcss/cli/dist/index.mjs |
| `class-variance-authority` | `^0.7.1` | `0.7.1` | `0.7.1` | design-lab/reglages/src/catalog/shadcn/index.jsx:19 |
| `clsx` | `^2.1.1` | `2.1.1` | `2.1.1` | design-lab/reglages/src/lib/cn.js:2 |
| `cmdk` | `^1.1.1` | `1.1.1` | `1.1.1` | design-lab/reglages/src/catalog/shadcn/index.jsx:18 |
| `esbuild` | `^0.28.2` | `0.28.2` | `0.28.2` | design-lab/reglages/build.mjs:14 |
| `http-server` | `^14.1.1` | `14.1.1` | `14.1.1` | script serve |
| `lightningcss` | `^1.33.0` | `1.33.0` | `1.33.0` | design-lab/reglages/scripts/scope-css.mjs:11 |
| `lucide-react` | `^1.48.0` | `1.48.0` | `1.54.0` | design-lab/reglages/src/catalog/Catalog.jsx:9 |
| `motion` | `^13.4.6` | `13.4.6` | `14.1.0` | design-lab/reglages/labo-reglages.html:98 |
| `react` | `^19.3.0` | `19.3.0` | `19.3.0` | design-lab/reglages/src/App.jsx:3 |
| `react-aria` | `^3.52.1` | `3.52.1` | `3.53.1` | design-lab/reglages/labo-reglages.html:84 |
| `react-aria-components` | `^1.21.1` | `1.21.1` | `1.22.1` | design-lab/reglages/labo-reglages.html:95 |
| `react-dom` | `^19.3.0` | `19.3.0` | `19.3.0` | design-lab/reglages/labo-reglages.html:28 |
| `tailwind-merge` | `^3.7.0` | `3.7.0` | `3.7.0` | design-lab/reglages/src/lib/cn.js:3 |
| `tailwindcss` | `^4.3.3` | `4.3.3` | `4.3.3` | design-lab/reglages/src/heroui/heroui.css:4 |

**Classement réel :** @tauri-apps/cli, @vitejs/plugin-react et Vite sont dans `dependencies` mais sont du build, pas du JavaScript nécessaire à l’utilisateur après packaging. Pas d’obligation de déplacer pour corriger un bug runtime. `@types/react*` est implicitement utilisé par tsc. `@radix-ui/react-dropdown-menu` est seulement candidat au nettoyage dans le labo Réglages, pas dans l’app qui l’importe. `@heroui/styles` et Tailwind sont utilisés via CSS/build ; date/ssr/utils sont peers HeroUI. `tw-animate-css` est importé via un paquet transitif : dette de déclaration si le labo devient autonome, pas échec actuel.

### Compatibilité npm et doublons

- React/ReactDOM : app 19.2.8/19.2.8, Réglages 19.3.0/19.3.0, labo Îlot 18.3.1/18.3.1. Des pages/bundles distincts, donc pas trois React dans le même runtime app. Réglages réimporte des sources app mais son plugin esbuild résout les bare imports dans SON node_modules : protection explicite contre double React (`build.mjs:26-41`).
- Peers : plugin-react 6.1.1 attend Vite ^8.0.0 ; Vite 8.2.2 convient. Vitest 5 accepte Vite ^8 et Node ^22.12/^24/>=26. Motion 13 accepte React 18/19. HeroUI 3.2.6 attend React >=19 et les peers React Aria/date effectivement déclarés. `npm ls --all --json` exit 0 dans les trois packages.
- Node 24 LTS est la consigne README/CI ; hôte d’audit 26 Current. Vite 8.2 reçoit toujours important/security fixes selon politique officielle (8.3 courant). Ni React, Radix ni la plupart des crates n’exposent dans le registry une promesse LTS pour chacune de leurs anciennes versions : support individuel non déduit de latest.
- Root npm : aucun nom multiversion. Réglages : lightningcss 1.32.0 (Tailwind node) /1.33.0 (scoping CSS direct), ses binaries et detect-libc 1/2. Coût de tooling, pas conflit de composants.
- Îlot : React UMD chargé depuis cdnjs 18.3.1 (`assemble.mjs:13-14`), polices Geist Google Fonts non versionnées, pas SRI. Dépendance de réseau du prototype explicitement documentée ; `verify.mjs` route les copies npm locales et les polices hors réseau. Ceci n’est PAS la stratégie de distribution de l’app Tauri.

## Cargo direct actif

Versions TOML ordinaires sont des ranges caret Cargo, pas des pins exacts : les résolutions lock sont souvent plus récentes que le floor. `~2.12.0` borne updater sous 2.13.

| Dépendance | Demandée | Résolue root edge | latest stable registry | Usage direct / build |
|---|---|---|---|---|
| `arboard` | `3.6.1` | `3.6.1` | `3.6.1` | src-tauri/src/capture.rs:4 |
| `base64` | `0.22.1` | `0.22.1` | `0.23.1` | src-tauri/src/settings.rs:6 |
| `bytes` | `1.10.1` | `1.12.1` | `1.12.1` | aucun usage direct repéré ; un paramètre nommé bytes avait été pris à tort pour un usage de crate |
| `chrono` | `0.4.42` | `0.4.45` | `0.4.45` | src-tauri/src/diagnostics.rs:175 |
| `futures-util` | `0.3.31` | `0.3.34` | `0.3.34` | src-tauri/src/inference.rs:8 |
| `reqwest` | `0.12.23` | `0.12.28` | `0.13.5` | src-tauri/src/inference.rs:329 |
| `native-tls` | `0.2` | `0.2.18` | `0.2.18` | src-tauri/src/inference.rs:379 |
| `rusqlite` | `0.37.0` | `0.37.0` | `0.40.2` | src-tauri/src/history.rs:3 |
| `serde` | `1.0.228` | `1.0.229` | `1.0.229` | src-tauri/src/actions.rs:2 |
| `serde_json` | `1.0.145` | `1.0.151` | `1.0.151` | src-tauri/src/capture.rs:765 |
| `tauri` | `2.11.5` | `2.11.5` | `2.12.2` | src-tauri/src/backdrop.rs:23 |
| `tauri-plugin-autostart` | `2.5.1` | `2.5.1` | `2.7.0` | src-tauri/src/lib.rs:37 |
| `tauri-plugin-global-shortcut` | `2.3.2` | `2.3.2` | `2.4.0` | src-tauri/src/actions.rs:4 |
| `tauri-plugin-single-instance` | `2.4.4` | `2.4.4` | `2.5.2` | src-tauri/src/lib.rs:3197 |
| `tauri-plugin-updater` | `~2.12.0` | `2.12.0` | `2.13.2` | src-tauri/src/lib.rs:3203 |
| `thiserror` | `2.0.17` | `2.0.20` | `2.0.21` | aucun usage direct repéré |
| `tokio` | `1.47.1` | `1.53.1` | `1.53.2` | src-tauri/src/inference.rs:256 |
| `tokio-util` | `0.7.16` | `0.7.19` | `0.7.20` | src-tauri/src/inference.rs:10 |
| `uiautomation` | `0.25.1` | `0.25.1` | `0.25.1` | src-tauri/src/capture.rs:5 |
| `url` | `2.5.7` | `2.5.8` | `2.5.8` | src-tauri/src/diagnostics.rs:60 |
| `uuid` | `1.18.1` | `1.26.0` | `1.28.0` | src-tauri/src/capture.rs:7 |
| `tauri-build` | `2.5.3` | `2.6.3` | `2.7.1` | src-tauri/build.rs:2 |
| `windows-numerics` | `0.3.1` | `0.3.1` | `0.100.0` | src-tauri/src/backdrop.rs:236 |
| `windows` | `0.62.2` | `0.62.2` | `0.62.2` | src-tauri/src/actions.rs:366 |

- Tauri JS API 2.11.1, CLI 2.11.4, crate 2.11.5 et tauri-build demandé 2.5.3/résolu 2.6.3 ont une numérotation indépendante. Aucun « mismatch » déduit du chiffre ; compat updater 2.12.0 -> Tauri ^2.10 confirmée par index.
- reqwest direct 0.12.28/native-tls est un choix intentionnel pour certificats système d’entreprise (`probe.rs`, `inference.rs`). Updater utilise reqwest 0.13.4/rustls. Conserver les deux tant qu’on ne prouve pas une économie/compatibilité corporate avec une unification. `windows` 0.61.3 de Tauri, 0.62.2 de UI Automation/app : pareil, changement majeur en 0.x non interchangeable.
- thiserror et bytes sont déclarés sans usage direct repéré dans les sources Rust ; AppError implémente Display/From à la main. Nettoyage optionnel faible bénéfice : les usages transitifs ne disparaissent pas par retrait d'une déclaration directe. Ne pas proposer une réécriture des erreurs juste pour utiliser la lib. Corrections de la contre-review : ne pas confondre un nom de paramètre avec un import ; les exemples d'usage du premier labo doivent exclure le projet imbriqué reglages.
- Index crates.io : tous les packages/version de tous les locks existent et checksums concordent. Aucun actif yanked et aucun MSRV renseigné supérieur au rust-version 1.91 du projet. Cela ne remplace pas un cargo build MSVC.

### RustSec : actif versus historique

Base officielle figée au commit `7eebec69c352c7191b1f13eb95dd510eeca5d1de`. Matching des ranges patched/unaffected sur les packages locks ; advisories retirés ignorés. Pas un cargo audit ni une résolution cible/features.

- Actif : **glib 0.18.5 / RUSTSEC-2024-0429** (unsoundness VariantStrIter, corrigée >=0.20) est dans le lock multi-target via GTK ; **pas dans le produit Windows par ce chemin**. Le forcer vers 0.20 sans coordonner GTK/Tauri ne constitue pas un correctif de l’app Windows.
- Actif : cinq `unic-*` 0.9.0 et proc-macro-error 1.0.4 ont un advisory **unmaintained**, pas six CVE avérées. Dette transitive de maintenance ; adresser via dépendants amont, pas substitution directe de crates que l’app n’importe pas. Les avis GTK unmaintained de 2024 ont été retirés en août 2026 ; ils ne sont pas comptés comme actifs.
- Historique seul DEP-HIST-001 : RUSTSEC-2026-0285 pour rustls <0.23.45 correspond à 14 variantes Cargo.lock anciennes. Main est hors range affectée. Ces 14 snapshots ne sont pas 14 bugs supplémentaires ni une raison de réouvrir les branches archivées. Toutes les correspondances et refs associées : `dependencies-rustsec.json`.

## Server / Compose et chaîne build

- Scripts Python locaux : stdlib + modules server, aucune dépendance pip tierce déclarée/importée. CI Python 3.13 ; unittest 6 tests, 5 exécutés avec succès, 1 PowerShell ignoré. `docker`, Compose plugin, NVIDIA driver/Container Toolkit, `nvidia-smi`, PowerShell et WebView2/MSVC sont des prérequis externes non figés par les locks.
- Quatre variantes Compose et model-lock existent aux refs ; toutes gardent exactement **vLLM v0.28.0 + même digest**. Main ajoute général Gemma QAT/MTP, bornes/profiles conservés et workaround V2. Le digest officiel du tag et de la référence digest est recalculé égal à `sha256:61fc8a896b0a4fbbbdc063bc4b0dbc25ce98e02b5050c24aeb7830ac02039b14`. Manifest liste Linux arm64 et amd64.
- Métadonnées Hugging Face des **quatre** révisions (fast/quality/general/draft) existent au SHA demandé. `HunYuanDenseV1ForCausalLM` et famille Gemma4 figurent dans le registry vLLM v0.28.0 consulté. CLI flags documentés : pas de flag déclaré incompatible trouvé ; chargement réel FP8/Blackwell/WSL2, budgets VRAM et disponibilité GPU non testés.
- Dépendances upstream déclarées vLLM archivées (common/cuda/pyproject, Dockerfile source) dans `dependencies-server-registry.json`/inventaire. **Pas de SBOM exact des Python/OS packages résolus de l’image : impossible à affirmer sans inspecter ses layers/environnement, Docker absent et poids/layers non téléchargés.**
- Advisories vLLM : **104 IDs uniques**, pagination officielle cursor suivie jusqu’à fin (les paramètres page=2/3 répétaient la première page ; dédupliqué). 48 ranges compatibles avec 0.28.0 ; quatre ranges non interprétables par semver conservés verbatim et marqués inconnus. Ce sont des matches de version, **pas 48 exploitations Overtype**. Conditions sélectionnées documentées dans `dependencies-vllm-assessment.json`; trust-remote-code RCE exclue, modèles VL/audio non servis, embeddings DoS corrigé en 0.28.0 ; cache_salt et stop_token_ids retenus dans DEP-001.
- CI : Node24 -> npm ci -> Vitest/tsc/Vite ; Windows -> Rust stable -> cargo test --locked -> Tauri NSIS (beforeBuildCommand relance build frontend). Release ajoute clé exigée, signature obligatoire, checksum et latest.json. Signature protège la distribution, pas l’intégrité du code déjà exécuté par le builder. Actions listées exhaustivement dans inventaire.

## Matrice de couverture branches et variantes

Comparer les contenus manifest/lock via git show et blobs, sans changer HEAD. « Non ancêtre » décrit une topologie, pas un chantier manquant : les reprises/squashes ne se déduisent pas d’un compteur ahead. Les contrôles portent sur dépendances, pas statut fonctionnel de chaque feature.

| Branche | SHA | Ancêtre main | Variantes différentes de main |
|---|---|---|---|
| `chore/ui-iteration-workbench` | `afec21d4d9faec4856cb106832ab0543444b8876` | oui | package-lock.json, package.json, server/compose.yaml, server/model-lock.json, src-tauri/Cargo.lock, src-tauri/Cargo.toml |
| `claude/great-keller-6dwrqd` | `488eae22a879f19d51bac38c40479e2c0d18d765` | oui | package-lock.json, package.json, src-tauri/Cargo.lock, src-tauri/Cargo.toml |
| `codex/multi-editor-replacement` | `86b3b23f217b4e26976815fca253397012a6cd4b` | non | package-lock.json, package.json, server/compose.yaml, server/model-lock.json, src-tauri/Cargo.lock, src-tauri/Cargo.toml |
| `da-ilot` | `26aaa399c12337ebd64b50c7b9e1ac022b6b449f` | oui | package-lock.json, package.json, src-tauri/Cargo.lock, src-tauri/Cargo.toml |
| `design/glass-reader` | `7d67ab5c34ad78d5a6be8a4f20815f0848f076d3` | oui | package-lock.json, package.json, server/compose.yaml, server/model-lock.json, src-tauri/Cargo.lock, src-tauri/Cargo.toml |
| `feat/actions-shortcuts-settings` | `3f2aee15710d31118a1b2e885f23d3866e11dff3` | oui | package-lock.json, package.json, server/compose.yaml, server/model-lock.json, src-tauri/Cargo.lock, src-tauri/Cargo.toml |
| `feat/actions-that-work` | `e8df897a3b11dd285cc6e3b3d32eb07c9078a495` | oui | package-lock.json, package.json, src-tauri/Cargo.lock, src-tauri/Cargo.toml |
| `feat/direct-capture` | `74aefa69027d48441d3428493a9ce4a8fab03385` | oui | package-lock.json, package.json, server/compose.yaml, server/model-lock.json, src-tauri/Cargo.lock, src-tauri/Cargo.toml |
| `feat/frontend` | `d4681e439123f0b91e64734d14e8c67391eb5f85` | oui | package-lock.json, package.json |
| `feat/frontend-primitives` | `b9d6eb42e8d1f8692bacc4bdce07ec0e525fd23b` | non | package-lock.json, package.json, server/compose.yaml, server/model-lock.json, src-tauri/Cargo.lock, src-tauri/Cargo.toml |
| `feat/glass-frontend` | `170f96f7e26da3c0b6a15909764a9da6c251d41a` | non | package-lock.json, package.json, server/compose.yaml, server/model-lock.json, src-tauri/Cargo.lock, src-tauri/Cargo.toml |
| `feat/glass-material` | `058d348979239a401f619abfec09a75630a92ef5` | non | package-lock.json, package.json, server/compose.yaml, server/model-lock.json, src-tauri/Cargo.lock, src-tauri/Cargo.toml |
| `feat/glass-native` | `f742599122bbeb5df9b542ca02457192ef0bd832` | non | package-lock.json, package.json, server/compose.yaml, server/model-lock.json, src-tauri/Cargo.lock, src-tauri/Cargo.toml |
| `feat/glass-native-polish` | `02b1fe8d47f0322e3f580369b5de386a1f984828` | non | package-lock.json, package.json, server/compose.yaml, server/model-lock.json, src-tauri/Cargo.lock, src-tauri/Cargo.toml |
| `feat/glass-reader` | `5005b026de73de235ea140f2dd1d8eb3f766e09e` | oui | package-lock.json, package.json, server/compose.yaml, server/model-lock.json, src-tauri/Cargo.lock, src-tauri/Cargo.toml |
| `feat/native` | `0dc02bbf1bbdfcb2ebfedbfe121c48bacdc4d9ca` | oui | package-lock.json, package.json, server/compose.yaml, server/model-lock.json, src-tauri/Cargo.lock, src-tauri/Cargo.toml |
| `feat/reading-band` | `a1d903190e8c65abfd502b1435fffb0a730c16a2` | oui | package-lock.json, package.json, server/compose.yaml, server/model-lock.json, src-tauri/Cargo.lock, src-tauri/Cargo.toml |
| `feat/release-and-endpoints` | `83ebebb91f6c0d4c8a55556dff06c55e54c644cd` | oui | package-lock.json, package.json, server/compose.yaml, server/model-lock.json, src-tauri/Cargo.lock, src-tauri/Cargo.toml |
| `feat/0.5.0-design-1.0` | `3ea09e6c2a2047b5c40133482dd0e151ee01db40` | non | package-lock.json, package.json, src-tauri/Cargo.lock, src-tauri/Cargo.toml |
| `fix/compact-draggable-bubble` | `99a019d3a77eaf4ee15de354e09990e51d4a6bb5` | oui | package-lock.json, package.json, server/compose.yaml, server/model-lock.json, src-tauri/Cargo.lock, src-tauri/Cargo.toml |
| `fix/native-window` | `28e2f0eac7a2a9bb662bdbe4b3716ad362ecff01` | non | package-lock.json, package.json, server/compose.yaml, server/model-lock.json, src-tauri/Cargo.lock, src-tauri/Cargo.toml |
| `fix/scoped-drag` | `fcb5c0196468258f62c11bf6f96d730e04cb8bc8` | non | package-lock.json, package.json, server/compose.yaml, server/model-lock.json, src-tauri/Cargo.lock, src-tauri/Cargo.toml |
| `fix-endpoint-tls` | `dd4b218be9b432b734853e841179ac9762318ec5` | oui | package-lock.json, package.json, src-tauri/Cargo.lock, src-tauri/Cargo.toml |
| `main` | `e202cd1f8831abc0f69435b9e2d0d96dd491e841` | oui | aucune |
| `refonte-reglages` | `deb9f0d581e256a8f00e0fd65be6d6e89234ae50` | oui | package-lock.json, package.json, src-tauri/Cargo.lock, src-tauri/Cargo.toml |
| `release/frontend-0.1.5` | `127fb7fb70b7c0cd830379855bfd7339597ed91e` | non | package-lock.json, package.json, server/compose.yaml, server/model-lock.json, src-tauri/Cargo.lock, src-tauri/Cargo.toml |
| `release/guide-0.1.5` | `81f850333e7884b4497a6dd147ae00d1d409d54a` | non | package-lock.json, package.json, server/compose.yaml, server/model-lock.json, src-tauri/Cargo.lock, src-tauri/Cargo.toml |
| `release/native-0.1.5` | `efe3abd5c9d73f9a748880e75a55cb4f9096d27b` | non | package-lock.json, package.json, server/compose.yaml, server/model-lock.json, src-tauri/Cargo.lock, src-tauri/Cargo.toml |
| `release/server-0.1.5` | `8281476d4bcac7d74305532d26bd3cf2cf46c8da` | non | package-lock.json, package.json, server/compose.yaml, server/model-lock.json, src-tauri/Cargo.lock, src-tauri/Cargo.toml |
| `release/0.1.5` | `2f83abc75f19a68c28eea6ee408265592bd08347` | oui | package-lock.json, package.json, server/compose.yaml, server/model-lock.json, src-tauri/Cargo.lock, src-tauri/Cargo.toml |
| `wt-050-atelier` | `5b5f6a56962f59202d2ea127daf52cedf0439ba5` | non | package-lock.json, package.json, src-tauri/Cargo.lock, src-tauri/Cargo.toml |
| `wt-050-marque` | `1e2c6097d66573e20e2a002b3d8ada1ceb1abcd8` | non | package-lock.json, package.json, src-tauri/Cargo.lock, src-tauri/Cargo.toml |
| `wt-050-natif` | `1fcdd21f0aadd5a36978e47e6530b9fe9f1c74bd` | non | package-lock.json, package.json, src-tauri/Cargo.lock, src-tauri/Cargo.toml |
| `wt-050-reglages` | `5da6010e2af1516c29bb1ff0e0281ef8f8778b6b` | non | package-lock.json, package.json, src-tauri/Cargo.lock, src-tauri/Cargo.toml |
| `wt-050-verre` | `c5345af95ec9fa6ac00cdea1444aba09cd4ba375` | non | package-lock.json, package.json, src-tauri/Cargo.lock, src-tauri/Cargo.toml |

Absence d’un labo ou Cargo dans une ancienne pointe est historique, pas défaut actuel. Variantes par chemin :

- `package-lock.json` : 17 blobs distincts (tous inventoriés avec branches/SHA).
- `package.json` : 17 blobs distincts (tous inventoriés avec branches/SHA).
- `server/compose.yaml` : 4 blobs distincts (tous inventoriés avec branches/SHA).
- `server/model-lock.json` : 4 blobs distincts (tous inventoriés avec branches/SHA).
- `src-tauri/Cargo.lock` : 17 blobs distincts (tous inventoriés avec branches/SHA).
- `src-tauri/Cargo.toml` : 18 blobs distincts (tous inventoriés avec branches/SHA).
- `design-lab/package-lock.json` : 1 blobs distincts (tous inventoriés avec branches/SHA).
- `design-lab/package.json` : 1 blobs distincts (tous inventoriés avec branches/SHA).
- `design-lab/reglages/package-lock.json` : 1 blobs distincts (tous inventoriés avec branches/SHA).
- `design-lab/reglages/package.json` : 1 blobs distincts (tous inventoriés avec branches/SHA).

Fichiers inspectés : manifests/locks des pointes ; AGENTS/UI-DECISIONS et README ; workflows CI/release ; build scripts/Vite/Tauri config ; imports npm/CSS/Rust dans les sources ; update/probe/inference pour les chemins TLS ; scripts server/imports et contrats engine/model-lock. Liste exacte dans `dependencies.json.reviewed_files`, usages fichier:ligne dans inventaire. **Ce n’est pas une lecture humaine de toutes les lignes de chaque fichier.**

## Vérifications réellement exécutées

| Commande / package | Exit | Résultat / log |
|---|---:|---|
| `npm audit --package-lock-only --json --ignore-scripts` (copy) | 1 | advisories triés ci-dessus — `dependencies-audit-app.log` |
| `npm audit --package-lock-only --json --ignore-scripts` (design-lab) | 0 | advisories triés ci-dessus — `dependencies-audit-lab.log` |
| `npm audit --package-lock-only --json --ignore-scripts` (reglages) | 1 | advisories triés ci-dessus — `dependencies-audit-reglages.log` |
| `python -m unittest discover -s server -p test_*.py -v` (copy) | 0 | voir log — `dependencies-server-tests.log` |
| `git clone --depth 1 https://github.com/RustSec/advisory-db.git artefacts-locaux/dependencies-work/advisory-db` (dependencies-work) | 0 | voir log — `dependencies-rustsec-clone.log` |
| `npm ci --ignore-scripts --no-audit --no-fund` (copy) | 0 | installation exacte lock, lifecycle désactivé — `dependencies-ci-app.log` |
| `npm ls --all --json` (copy) | 0 | arbre/peers valides — `dependencies-ls-app.log` |
| `npm run build` (copy) | 0 | build réussi — `dependencies-build-app.log` |
| `npm test` (copy) | 1 | 313 passent / 1 timing échoue — `dependencies-test-app.log` |
| `npm ci --ignore-scripts --no-audit --no-fund` (design-lab) | 0 | installation exacte lock, lifecycle désactivé — `dependencies-ci-lab.log` |
| `npm ls --all --json` (design-lab) | 0 | arbre/peers valides — `dependencies-ls-lab.log` |
| `npm run build` (design-lab) | 0 | build réussi — `dependencies-build-lab.log` |
| `npm run verify` (design-lab) | 0 | voir log — `dependencies-verify-lab.log` |
| `npm ci --ignore-scripts --no-audit --no-fund` (reglages) | 0 | installation exacte lock, lifecycle désactivé — `dependencies-ci-reglages.log` |
| `npm ls --all --json` (reglages) | 0 | arbre/peers valides — `dependencies-ls-reglages.log` |
| `npm run build` (reglages) | 0 | build réussi — `dependencies-build-reglages.log` |
| `npm run shots` (reglages) | 1 | voir log — `dependencies-shots-reglages.log` |
| `npm test -- --run src/motion/surface.test.ts` (copy) | 0 | 3/3 passent après échec isolé précédent — `dependencies-test-surface-repeat.log` |

Contrôles d’inventaire/registry aussi exécutés : scripts Python inventory/registry/index/npm_index/enrich ; npm audit sur 16 locks npm historiques ; RustSec TOML + semver sur les 17 locks Cargo ; validations existence/checksums ; registry Docker et APIs Hugging Face sans pull. Logs/data JSON archivés.

## Limites et non couvert

- Cargo et Docker absents : pas de cargo metadata/tree/audit/check/test natif, Docker Compose config, SBOM/image pip freeze ni analyse des paquets OS de l’image. Le digest et les manifests d’image ont été vérifiés sans télécharger les layers ni poids. Les requirements upstream sont des déclarations, PAS les versions exactes installées dans l’image.
- Hôte Linux Node 26.5.1, npm 11.17.0, Python 3.13.5 ; builds et npm ls actuels testés sur cet hôte, pas Windows/MSVC/WebView2 ni Node 24 de CI. Installation --ignore-scripts : aucun lifecycle tiers exécuté.
- Tests frontend : 313/314 au premier run ; test motion/surface à seuil 200ms échoue aussi une fois isolément, puis 3/3 au run archivé ; variance de timing non attribuée à incompatibilité de version.
- Les 104 advisories vLLM sont inventoriés et version-screenés ; conditions de modèles/features étudiées sur sélection explicitée, pas exploitation exhaustive de tous les avis. Quatre ranges upstream non interprétables conservés sans réparation et marqués inconnus.
- Coverage branches = toutes les pointes des 35 refs, avec 81 blobs distincts manifest/lock/server. Pas tous les commits intermédiaires, pas review ligne par ligne de tout le repo. npm ls/build sur main uniquement ; audit npm et RustSec/index sur toutes les variantes de locks.
- RustSec analysé au niveau lock par matching TOML/semver (pas cargo audit), sans résolution de features/targets. glib est Linux GTK et non une preuve de vulnérabilité du produit Windows. Aucun package actualisé.

## Bon usage à garder

- Les 61 déclarations npm actuelles et leurs 493 installations lock sont inventoriées ; 24 déclarations Cargo et 574 packages lock, dont un local. Registries : toutes les versions résolues présentes et checksums/intégrités concordants, aucun crate actif yanked ni MSRV déclaré >1.91.
- Aucun doublon multiversion dans le lock npm de l’app. Réact/ReactDOM alignés dans chacun des trois packages, version 18.3.1 du prototype historique intentionnelle et indépendante du React 19.2.8 de l’app.
- npm ci, npm ls --all et builds passent pour les trois packages ; premier labo verify passe. HeroUI est confinement de prototype ; React Aria/date/ssr/utils sont peers utiles et non packages morts sur simple absence d’import.
- Upgrader ~2.12.0 résout 2.12.0 et requiert tauri ^2.10 : Tauri 2.11.5 satisfait. Pas besoin du guest JS plugin-updater car update.rs utilise API Rust derrière commandes bridge. Les numéros API/CLI/crate Tauri ne sont pas obligés d’être identiques.
- reqwest native-tls sans default-features conserve schannel/certificats Windows pour inference ; rustls/reqwest 0.13 de updater est une autre chaîne légitime. Les crates windows 0.61/0.62 proviennent de dépendants différents ; pas un conflit ABI avéré.
- Docker tag+digest, modèle et draft révisions figées ; ports loopback, logs requêtes désactivés, trust_remote_code absent et contrôles GPU de préflight sans démarrage. Scripts Python server n’utilisent que stdlib/modules locaux.

## Sources officielles (consultation 10 octobre 2026)

- https://registry.npmjs.org/
- https://index.crates.io/
- https://crates.io/api/v1/crates/
- https://github.com/RustSec/advisory-db
- https://rustsec.org/advisories/RUSTSEC-2024-0429.html
- https://rustsec.org/advisories/RUSTSEC-2026-0285.html
- https://github.com/advisories/GHSA-68fv-2mgg-jv7q
- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- https://github.com/vllm-project/vllm/security/advisories
- https://github.com/vllm-project/vllm/security/advisories/GHSA-wpww-v874-ph2p
- https://github.com/vllm-project/vllm/security/advisories/GHSA-v5gm-qgmv-gc6c
- https://docs.vllm.ai/en/v0.28.0/cli/serve/
- https://vite.dev/releases
- https://nodejs.org/en/about/previous-releases
- https://v2.tauri.app/plugin/updater/
- https://docs.github.com/en/actions/reference/security/secure-use

## Fichiers livrés

- `dependencies.md` : ce rapport ; `dependencies.json` : constats/couverture/checks structurés.
- `dependencies-inventory.json` : inventaire complet déclaré/résolu des manifests/locks aux 35 pointes, imports/features/edges/targets, agrégats Python, références externes server/prototypes.
- `dependencies-variants.json` : contenus des 81 variantes pour vérification/rejeu.
- `dependencies-registry.json`, `dependencies-npm-index.json`, `dependencies-cargo-index.json` : preuves registry/peers/MSRV/intégrités.
- `dependencies-historical-npm-audits.json`, `dependencies-rustsec*.json`, `dependencies-vllm-advisories.json`, `dependencies-vllm-assessment.json`, `dependencies-server-registry.json` : résultats bruts et contexte.
- `dependencies-checks.json` et `dependencies-*.log` : commandes et sorties réelles.

Aucun fichier du checkout partagé modifié ; artefacts de compilation/install uniquement dans la copie scratch `dependencies-work/copy`.
