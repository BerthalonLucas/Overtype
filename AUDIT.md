# Audit d'Overtype — état des lieux

> Audit en lecture seule, 10/10/2026. Aucun fichier du repo n'a été modifié, hormis celui-ci. AGENTS.md et la documentation sont traités comme des affirmations à vérifier : le code fait foi. Ce document ne propose ni correctif ni plan de refactor. Un point ambigu est noté comme tel au lieu d'être tranché.

## Provenance

- **Qui** : une session Claude Code lancée par Lucas avec le skill `/flow`. C'est l'une des trois sessions d'audit lancées le 10/10/2026 ; les deux autres sont un audit Codex et une recherche de pistes d'amélioration.
- **Comment c'est délégué** : la session principale a planifié le travail, puis confié 9 tâches en parallèle à des sous-agents. Chacune avait un brief autonome, un critère de fin et une interdiction d'écrire dans le repo.
  - 3 *runners* lancent les outils et rendent leurs sorties brutes : versions npm et Python ; versions Rust ; code mort outillé.
  - 5 *scouts* lisent le code : Rust et frontière TS ; front cœur ; front UI et CSS ; périphérie ; doc contre code.
  - 1 *researcher* évalue l'état de maintenance des dépendances, sur le web.
  - La session principale a fait elle-même l'hygiène git, la revue de chaque rapport (constats majeurs recontrôlés dans le code, faux positifs écartés) et la rédaction.
- **Part de vérification sur Internet** : elle est concentrée sur le *researcher*, environ 10 sources primaires datées, citées dans S1 à S14 :
  - registres npm et crates.io, API GitHub, base RustSec ;
  - changelogs de reqwest, vLLM et windows-rs ;
  - guide React 19, blog GitHub sur node20.
  - Ailleurs, le web a peu servi :
    - les *runners* ont interrogé les registres en ligne de commande ;
    - les *scouts* ont travaillé sur le code local, avec deux consultations ponctuelles (doc std de `fs::rename`, crates.io pour tauri-specta) ;
    - la session principale a utilisé l'API GitHub pour l'écart avec `main`, les PR et l'état de la CI.

## Périmètre et méthode

- **Instantané audité** : branche `refonte-reglages` au commit `deb9f0d`, c'est-à-dire le contenu de la 0.6.0 (PR #11). Les numéros de ligne se rapportent à cet état.
- **Écart avec GitHub** : sur GitHub, `main` est à `e202cd1` (v0.6.2), soit 3 commits et 29 fichiers de plus (updater intégré, limite de texte portée à 200 000 caractères). Je l'ai relu via l'API GitHub et intégré là où il change un constat ; ces cas sont marqués **(0.6.2)**. Le clone local n'a pas été `fetch`, pour ne rien modifier.
- **Hors audit** : pendant l'audit, une autre session a commité `1cabc95` (`docs/roadmap/`) sur la même branche. Je ne l'ai pas audité.
- **Outils lancés** :
  - `npm outdated`, `npm view` et `npm audit` sur les trois projets npm ;
  - `cargo outdated` 0.19.0, installé dans un dossier temporaire ;
  - `cargo update --dry-run` et `cargo tree --duplicates` ;
  - `knip` sans configuration et `tsc --noUnusedLocals --noUnusedParameters` ;
  - `cargo clippy --all-targets`, avec une cible temporaire, et `cargo fmt --check`.
- **Lecture** : cinq relectures en parallèle (Rust et frontière, front cœur, front UI, périphérie, doc contre code) et une recherche sur l'état des dépendances. J'ai recontrôlé dans le code chacun des constats majeurs.
- **Étiquettes** : **à virer**, **à remplacer par X**, **à unifier**, **à discuter**. Sans mention, un constat est vérifié dans le code. Sinon il porte *(probable)* ou *(ambigu)*.

## En bref : ce qui structure tout le reste

1. **Deux générations d'interface coexistent sans frontière.** D'un côté l'overlay Îlot et le parcours 0.4 : `src/ui.tsx`, `theme.css`, `glass.css`, `src/motion/`. De l'autre les fenêtres 0.6 : `src/components/`, `tokens.css`, `base.css`, `components/motion.ts`. Résultat : deux systèmes de tokens avec deux couleurs d'accent, deux moteurs de motion, deux `IconButton` et au moins 12 préfixes CSS (D7 à D12).
2. **`src-tauri/src/lib.rs` est un monolithe** : 3 434 lignes hors tests, 11 responsabilités, un état de 36 champs sous un seul `Mutex`. Win32 y est appelé de trois façons (B11, R1, R2).
3. **Les erreurs Rust sont des phrases françaises.** Environ 100 signatures `Result<_, String>`, et du contrôle de flux sur le texte des messages des deux côtés de la frontière (C1, C2).
4. **La logique des réglages existe en 4 exemplaires côté front**, qui ont déjà divergé. Le mock du navigateur est livré dans le bundle de production et porte du vrai code (D1, D3, C12).
5. **Les docs d'entrée sont périmées.** Le README décrit la 0.4/0.5. `docs/SPEC.md`, qu'AGENTS.md impose de lire, se trompe sur 7 points, dont la règle HTTP (X5, X7).
6. **`design-lab/` copie l'app à la main** sur deux autres stacks (React 18 en UMD ; HeroUI avec Tailwind). Ses HTML générés sont versionnés et déjà périmés. Ses scripts pointent vers le dossier temporaire d'une autre session (D22, D23, H8, C20).
7. **Aucun garde-fou outillé** : pas de lint ni de formateur TS, `cargo fmt` reformaterait 940 blocs, clippy n'est pas en CI (C4).

---

## 1. Stack réelle

### 1.1 Langages et part du code (fichiers suivis par git)

| Langage / zone | Lignes | Part du code maintenu* | Remarque |
|---|---:|---:|---|
| Rust, `src-tauri/src` (29 fichiers) | 14 808 | 29 % | dont ≈ 4 600 de tests ; `lib.rs` seul : 4 109 |
| TypeScript/TSX de l'app (`src/`, hors tests) | 12 206 | 24 % | React 19 |
| Tests TS unitaires (`src/**/*.test.*`) | 3 951 | 8 % | Vitest + jsdom |
| Tests e2e et visuels (`e2e/`, `visual-tests/`) | 6 800 | 13 % | Playwright ; 53 PNG de référence |
| CSS de l'app (`src/**/*.css`) | 2 385 | 5 % | CSS global, pas de modules |
| JS/JSX/MJS/CSS de `design-lab/` | 13 001 | 25 %** | deux labos, deux stacks |
| Scripts (`scripts/` : .ps1, .mjs) | 1 150 | 2 % | |
| Python (`server/`) | 564 | 1 % | stdlib seule |
| Markdown | 6 934 | — | 40 fichiers |
| HTML généré versionné (`design-lab`, `docs/design`) | 2,1 Mo | — | 3 fichiers, dont 1 doublon |

\* Part des lignes de code (hors Markdown, JSON, HTML généré). \*\* Le labo pèse autant que l'app front.

### 1.2 Frameworks et paquets, par projet

- **App, front** : Tauri 2.11, React 19.2, TypeScript 7.0, Vite 8.2.
  - Interface : 11 paquets `@radix-ui/react-*`, `cmdk`, `motion` 13, `lucide-react`.
  - Tests : Vitest 5 avec jsdom 26, Playwright 1.63.
  - Versions exactes, sans `^`.
- **App, hôte Rust** : édition 2021, `rust-version = 1.91`, pas de `rust-toolchain.toml`.
  - Tauri 2.11.5 et ses plugins `autostart`, `global-shortcut`, `single-instance`, plus `updater` (0.6.2).
  - Réseau et données : `reqwest` 0.12 (native-tls), `tokio`, `rusqlite` (bundled).
  - Windows : `windows` 0.62 (27 features), `uiautomation` 0.25, `arboard`.
  - Divers : `serde`, `chrono`, `uuid`, `url`, `base64`.
- **`design-lab/`** (labo Îlot) : React 18.3.1 chargé en UMD depuis cdnjs, buildé par esbuild 0.25 (`build.sh`) puis `assemble.mjs`. Les dépendances ne sont pas installées sur la machine (`npm ls` : UNMET).
- **`design-lab/reglages/`** (labo Réglages), troisième projet npm :
  - Interface : React 19.3, HeroUI 3, react-aria, Tailwind 4, lightningcss, cva, clsx et tailwind-merge.
  - Mêmes bibliothèques que l'app, mais dans d'autres versions : Radix, cmdk, motion 13.4, lucide 1.48.
- **`server/`** : Python 3.13, stdlib seule (aucun requirements). Image `vllm/vllm-openai:v0.28.0`, épinglée par digest.
- **CI** : GitHub Actions, deux workflows (`ci.yml`, `release.yml`).
- **Version de Node** : fixée seulement dans la CI (`'24'`, trois fois). Pas d'`engines` ni de `.nvmrc`.

### 1.3 Versions utilisées et versions actuelles (sorties brutes)

**`npm outdated --long`, racine** (code 1 = retard ; `cmdk` 1.1.1 et `typescript` 7.0.2 sont à jour) :

```
Package                        Current  Wanted  Latest  Location                                    Depended by     Package Type
@playwright/test                1.63.0  1.63.0  1.64.0  node_modules/@playwright/test               Flow_Translate  devDependencies
@radix-ui/react-collapsible     1.1.20  1.1.20  1.1.21  node_modules/@radix-ui/react-collapsible    Flow_Translate  dependencies
@radix-ui/react-dialog          1.1.23  1.1.23   1.2.0  node_modules/@radix-ui/react-dialog         Flow_Translate  dependencies
@radix-ui/react-dropdown-menu   2.1.24  2.1.24  2.1.25  node_modules/@radix-ui/react-dropdown-menu  Flow_Translate  dependencies
@radix-ui/react-popover         1.1.23  1.1.23   1.2.0  node_modules/@radix-ui/react-popover        Flow_Translate  dependencies
@radix-ui/react-scroll-area     1.2.18  1.2.18   1.3.0  node_modules/@radix-ui/react-scroll-area    Flow_Translate  dependencies
@radix-ui/react-select           2.3.7   2.3.7   2.3.8  node_modules/@radix-ui/react-select         Flow_Translate  dependencies
@radix-ui/react-slider           1.4.7   1.4.7   1.5.0  node_modules/@radix-ui/react-slider         Flow_Translate  dependencies
@radix-ui/react-switch           1.3.7   1.3.7   1.3.8  node_modules/@radix-ui/react-switch         Flow_Translate  dependencies
@radix-ui/react-tabs            1.1.21  1.1.21  1.1.22  node_modules/@radix-ui/react-tabs           Flow_Translate  dependencies
@radix-ui/react-toggle-group    1.1.19  1.1.19  1.1.20  node_modules/@radix-ui/react-toggle-group   Flow_Translate  dependencies
@radix-ui/react-tooltip         1.2.16  1.2.16   1.3.0  node_modules/@radix-ui/react-tooltip        Flow_Translate  dependencies
@tauri-apps/api                 2.11.1  2.11.1  2.12.2  node_modules/@tauri-apps/api                Flow_Translate  dependencies
@tauri-apps/cli                 2.11.4  2.11.4  2.12.1  node_modules/@tauri-apps/cli                Flow_Translate  dependencies
@types/react                    19.2.7  19.2.7  19.3.0  node_modules/@types/react                   Flow_Translate  devDependencies
@types/react-dom                19.2.3  19.2.3  19.3.0  node_modules/@types/react-dom               Flow_Translate  devDependencies
@vitejs/plugin-react             6.1.1   6.1.1   6.1.2  node_modules/@vitejs/plugin-react           Flow_Translate  dependencies
jsdom                           26.1.0  26.1.0  30.1.2  node_modules/jsdom                          Flow_Translate  devDependencies
lucide-react                    1.43.0  1.43.0  1.54.0  node_modules/lucide-react                   Flow_Translate  dependencies
motion                          13.2.0  13.2.0  14.1.0  node_modules/motion                         Flow_Translate  dependencies
react                           19.2.8  19.2.8  19.3.0  node_modules/react                          Flow_Translate  dependencies
react-dom                       19.2.8  19.2.8  19.3.0  node_modules/react-dom                      Flow_Translate  dependencies
vite                             8.2.2   8.2.2   8.3.4  node_modules/vite                           Flow_Translate  dependencies
vitest                           5.0.0   5.0.0   5.0.3  node_modules/vitest                         Flow_Translate  devDependencies
```

**`npm outdated --long`, `design-lab/reglages/`** (code 1) :

```
Package                        Current  Wanted  Latest  Package Type
@radix-ui/react-collapsible     1.1.20  1.1.21  1.1.21  devDependencies
@radix-ui/react-dialog          1.1.23   1.2.0   1.2.0  devDependencies
@radix-ui/react-dropdown-menu   2.1.24  2.1.25  2.1.25  devDependencies
@radix-ui/react-popover         1.1.23   1.2.0   1.2.0  devDependencies
@radix-ui/react-scroll-area     1.2.18   1.3.0   1.3.0  devDependencies
@radix-ui/react-select           2.3.7   2.3.8   2.3.8  devDependencies
@radix-ui/react-slider           1.4.7   1.5.0   1.5.0  devDependencies
@radix-ui/react-slot             1.3.3   1.4.0   1.4.0  devDependencies
@radix-ui/react-switch           1.3.7   1.3.8   1.3.8  devDependencies
@radix-ui/react-tabs            1.1.21  1.1.22  1.1.22  devDependencies
@radix-ui/react-toggle-group    1.1.19  1.1.20  1.1.20  devDependencies
@radix-ui/react-tooltip         1.2.16   1.3.0   1.3.0  devDependencies
lucide-react                    1.48.0  1.54.0  1.54.0  devDependencies
motion                          13.4.6  13.5.1  14.1.0  devDependencies
react-aria                      3.52.1  3.53.1  3.53.1  devDependencies
react-aria-components           1.21.1  1.22.1  1.22.1  devDependencies
```

**`design-lab/`** : `node_modules` absent, `npm outdated` ne rend rien (code 0). D'après `npm view` :

| Paquet | Déclaré | Dernier |
|---|---|---|
| react / react-dom | 18.3.1 | 19.3.0 |
| esbuild | 0.25.10 | 0.28.2 |

**`npm audit`, racine** : 1 vulnérabilité haute, transitive (`source-map-js`, déni de service par offsets de source map). Aucune dépendance directe n'est concernée.

**`cargo outdated --root-deps-only`** (cargo-outdated 0.19.0, code 0 ; colonne « Project » = version verrouillée) :

```
Name                          Project  Compat  Latest   Kind    Platform
----                          -------  ------  ------   ----    --------
base64                        0.22.1   ---     0.23.1   Normal  ---
reqwest                       0.12.28  ---     0.13.5   Normal  ---
rusqlite                      0.37.0   ---     0.40.2   Normal  ---
tauri                         2.11.5   2.12.2  2.12.2   Normal  ---
tauri-build                   2.6.3    2.7.1   2.7.1    Build   ---
tauri-plugin-autostart        2.5.1    2.7.0   2.7.0    Normal  ---
tauri-plugin-global-shortcut  2.3.2    2.4.0   2.4.0    Normal  ---
tauri-plugin-single-instance  2.4.4    2.5.2   2.5.2    Normal  ---
thiserror                     2.0.20   2.0.21  2.0.21   Normal  ---
tokio                         1.53.1   1.53.2  1.53.2   Normal  ---
tokio-util                    0.7.19   0.7.20  0.7.20   Normal  ---
uuid                          1.26.0   1.28.0  1.28.0   Normal  ---
windows-numerics              0.3.1    ---     0.100.0  Normal  cfg(windows)
```

**`cargo update --dry-run`** : « Locking 103 packages to latest compatible versions » (90 mises à jour, 14 ajouts, 29 retraits). Parmi les retraits : `windows` 0.61.3 et `windows-core` 0.61.2.

**`cargo tree --duplicates`** (cible Windows) : 28 crates en plusieurs versions. Les plus lourdes :
- toute la pile `windows-*` (0.61 tirée par Tauri, tao, wry et webview2-com ; 0.62 tirée par l'app et uiautomation) ;
- `windows-sys` ×3, `hashbrown` ×3 ;
- `syn` 2/3, `thiserror` 1/2, `toml` ×2, `winreg` ×2.

### 1.4 Abandonné, déprécié ou remplacé par un standard

Aucune dépendance directe n'est marquée `deprecated` sur npm, ni « unmaintained » chez RustSec (vérifié le 10/10/2026).

- **S1** `.github/workflows/ci.yml`, `release.yml` — **à remplacer par les v7 (node24)**.
  - `actions/checkout@v4`, `setup-node@v4`, `upload-artifact@v4` et `setup-python@v5` déclarent le runtime `node20`, que GitHub a retiré de ses runners le 23/09/2026.
  - Les runs de `main` restent verts au 09/10.
- **S2** `src-tauri/Cargo.toml` — **à virer**.
  - `thiserror` et `bytes` sont déclarés mais ne figurent nulle part dans `src-tauri/src`.
  - `bytes` reste présent en transitif via reqwest.
- **S3** `src-tauri/Cargo.toml` (uiautomation) — **à virer** *(probable : à confirmer par `cargo check`)*.
  - Les features `clipboard` et `event` sont activées, mais aucune API correspondante n'est utilisée.
- **S4** `src-tauri/Cargo.toml` (features `windows`) — **à discuter** (confirmer une à une).
  - `Win32_System_Memory` n'est importée nulle part : seul le FFI maison de `clipboard_guard.rs` touche ces fonctions.
  - `Win32_System_Com` et `Win32_UI_Controls` n'ont aucun import visible.
- **S5** Tauri 2.11 (crates, `@tauri-apps/api`, `@tauri-apps/cli`) — **à discuter** (montée coordonnée Rust + JS).
  - La 2.11 tire encore `windows` 0.61 alors que l'app est en 0.62 : deux copies de la pile Windows. C'est la cause des conversions `HWND(x as *mut _)` et de l'appel COM par offset de `browser_keys.rs`.
  - D'après `cargo update --dry-run`, Tauri 2.12 retire la 0.61.
  - (0.6.2) `tauri-plugin-updater` est épinglé en `~2.12.0` « parce que la 2.13 exige Tauri 2.12 ».
- **S6** `src-tauri/src/probe.rs` (`tokio::net::TcpStream`, `lookup_host`) — **à unifier** (déclarer `net`) *(probable)*.
  - Le code utilise `tokio::net`, mais `Cargo.toml` ne déclare pas la feature `net`.
  - Ça compile uniquement par unification avec les features de reqwest et hyper.
- **S7** `reqwest` 0.12 avec `native-tls` — **à discuter**.
  - En 0.13, rustls devient le défaut.
  - native-tls est ici voulu : sonde schannel dans `probe.rs:493-508`, downcast dans `inference.rs:377`. Il faudra le garder explicitement au passage en 0.13.
- **S8** `jsdom` 26.1.0 — **à discuter** : mise à jour, ou happy-dom, ou mode navigateur de Vitest.
  - Quatre versions majeures de retard (dernière : 30.1.2).
- **S9** `cmdk` 1.1.1 — **à discuter** (surveiller).
  - Aucune version depuis le 14/03/2025, 24 PR en attente, dépôt déplacé vers `dip/cmdk`.
  - Seul usage : `Combobox` dans `components/controls.tsx`.
- **S10** `design-lab/package.json` et `assemble.mjs:13-14` — **à discuter**.
  - React 18.3.1 est chargé en UMD. React 19 ne publie plus de build UMD, donc le labo est bloqué en 18 alors que l'app est en 19.2.
- **S11** `server/compose.yaml` — **à discuter**.
  - L'image vLLM est en v0.28.0 avec `VLLM_USE_V2_MODEL_RUNNER: "0"`, imposé par WSL2.
  - vLLM a déprécié le Model Runner V1 en 0.29 et vise son retrait en 0.32. Version actuelle : 0.31.0.
- **S12** `src-tauri/Cargo.toml` `[lib] crate-type = ["rlib","cdylib","staticlib"]` — **à discuter** *(probable)*.
  - Gabarit mobile de Tauri, sans usage pour une app Windows.
- **S13** Version de Node — **à unifier** (`.nvmrc` ou `engines`, lu par `setup-node`).
  - Elle n'est fixée que par trois `node-version: '24'` dans les workflows. Aucun `engines` ni `.nvmrc`.
- **S14** `windows-numerics` 0.3.1 : la 0.100 existe, mais elle doit rester alignée sur `windows` 0.62, qui n'a pas de 0.100. Ce n'est pas une dette : à noter pour les montées de version.

---

## 2. Roue réinventée

- **R1** `src-tauri/src/clipboard_guard.rs:22-44` — **à remplacer par** `windows::Win32::System::{DataExchange, Memory}`.
  - Environ 15 fonctions Win32 sont déclarées à la main en `extern "system"` (OpenClipboard, GetClipboardData, GlobalAlloc…).
  - Le crate `windows` les fournit, et les deux features sont déjà dans Cargo.toml. `host.rs:9` importe d'ailleurs `GetClipboardSequenceNumber` depuis `windows`.
- **R2** `src-tauri/src/host.rs:125-128`, `host.rs:98-107`, `backdrop.rs:433-441` — **à remplacer par le crate `windows`** (2 features).
  - `GetUserDefaultUILanguage` est déclaré en `extern`, et `GetSystemPowerStatus` est obtenu par `GetProcAddress` + `transmute`.
  - Les deux existent dans `windows` (`Win32_Globalization`, `Win32_System_Power`).
- **R3** `src-tauri/src/error.rs:70-117` — **à remplacer par** `#[derive(thiserror::Error)]`, ou retirer la dépendance (S2).
  - `AppError` implémente `Display` à la main et n'implémente pas `std::error::Error`, alors que `thiserror` est déclaré.
- **R4** `src-tauri/src/system_theme.rs` (82 lignes), la commande `system_theme`, l'événement `system-theme` et `bridge.systemTheme` — **à remplacer par** `WebviewWindow::theme()` / `onThemeChanged` *(probable)*.
  - Le code lit `AppsUseLightTheme` et surveille le registre. Tauri expose déjà ce thème : tao lit la même clé.
  - À valider en vraie fenêtre : le contraste élevé diffère.
- **R5** `src-tauri/src/settings.rs:331-364` (`replace_file`) — **à remplacer par** `std::fs::rename` + `File::sync_all` *(probable)*.
  - C'est un `MoveFileExW` avec conversion UTF-16 manuelle. `fs::rename` remplace de façon atomique sous Windows 10 1607 et plus, et `diagnostics.rs:219` l'utilise déjà.
- **R6** `src/bridge.ts:162,166,170,178,229,232,245,254` et `bridge.ts:149` — **à remplacer par** un import statique et `getCurrentWebviewWindow().listen`.
  - Il y a 8 `import()` dynamiques de `@tauri-apps/api/window`, alors que `webviewWindow`, importé statiquement, l'importe déjà : aucun découpage de chunk n'est possible.
  - `listen(..., { target: { kind: 'WebviewWindow', label } })` refait `WebviewWindow.listen`.
- **R7** `src/connection/diagnostics.ts:45-50`, `src/settings/pages/After.tsx:15-18`, pluriels — **à remplacer par** `Intl.PluralRules` dans `t()` et `Intl.NumberFormat` (unités) / `Intl.DurationFormat` *(probable)*.
  - L'heure et les durées sont formatées à la main.
  - Les pluriels sont gérés de trois façons : `count === 1` (`Check.tsx:222`, `ConnectionForm.tsx:74`), `Intl.PluralRules` (`Data.tsx:48`), et des paires de clés `*One` / `*Other`. Le français traite 0 comme singulier.
- **R8** `src/connection/Check.tsx:55`, `src/settings/pages/Server.tsx:34`, `src/setup/screens.tsx:163` — **à remplacer par** `crypto.randomUUID()`, déjà utilisé ailleurs.
  - Même générateur d'identifiant écrit trois fois : `` `${prefix}-${Date.now().toString(36)}-${serial}` ``.
- **R9** `src/setup/SetupWindow.tsx:367-372` — **à remplacer par** le `Dialog` Radix de `components/controls.tsx:318` *(probable)*.
  - La feuille modale du journal est faite à la main : `motion.div role="dialog"`, Échap géré à la main, pas de piège de focus vu.
- **R10** `src/settings/SettingsWindow.tsx:258`, `InlineConfirm.tsx:26`, `SetupWindow.tsx:242`, `setup/model.ts:103` — **à discuter**.
  - `document.querySelector('[data-radix-popper-content-wrapper], .ft-dialog')` sert à décider qui possède Échap. C'est un couplage à un attribut interne de Radix, dont le `DismissableLayer` gère déjà l'empilement.
- **R11** `src/components/controls.tsx:57-65`, `controls.tsx:50`, `src/ui.tsx:46` — **à unifier** (un Provider à la racine).
  - Un `Tooltip.Provider` par instance : `skipDelayDuration` ne peut jamais agir.
  - Ailleurs, les deux `IconButton` posent un `title=` natif, avec un style différent.
- **R12** `e2e/*.pw.ts` (15 occurrences : `actions:8`, `halo:45`, `ilot-bridge:48`, `ilot-place:55`, `ilot-result:42`, `ilot-undo:38`, `motion:182`, `native-bridge:40` et `:274`, `settings-window:24`, `theme-language:11`, `ui:260`, `warmup.ts:16`, `working-pill:26` et `:251`) — **à remplacer par** une fixture Playwright `test.extend`, ou une entrée HTML dédiée.
  - Même contournement copié 15 fois : `page.route(... text.replace('/src/main.tsx', '/e2e/native-fixture.ts'))`.
- **R13** `design-lab/reglages/scripts/{shots,demo-shots,demo-chaos}.mjs` — **à remplacer par** `@playwright/test` déclaré et `toHaveScreenshot` (à discuter si le labo reste).
  - Playwright est chargé par chemin absolu (`D:/src/Flow_Translate/node_modules`) sans être déclaré.
  - `demo-chaos.mjs:81` compare les pixels à la main.
- **R14** `.github/workflows/release.yml` (0.6.2) — **à discuter** (tauri-action fait la même chose).
  - `latest.json` (signature, URL, notes) est construit à la main en PowerShell, alors que `tauri-apps/tauri-action` le génère et le publie.
- **R15** `server/preflight.py:19-31`, `evaluate.py:35`, `evaluate.py:59-80` — **à discuter**.
  - Parseur `.env`, percentile et lecture SSE écrits à la main. La contrainte « stdlib seule » semble voulue mais n'est écrite nulle part.
- **R16** Cas justifiés, à confirmer — **à discuter** *(ambigu)* :
  - `inference.rs:18-71` : décodeur SSE maison, court et testé ;
  - `probe.rs:231-254` : réanalyse de `*_PROXY` pour afficher la route ;
  - `browser_keys.rs` : méthode COM appelée par offset de vtable, conséquence de S5 ;
  - `actions.rs:319-362` : tables de codes VK en hexadécimal ;
  - `host.rs:1181-1257` : `SendInput`, marqué `OUR_KEYS` ;
  - recherche des Réglages maison (`settings/search.ts`) alors que cmdk est présent ;
  - toast maison.

## 3. Doublons internes

### Front : logique

- **D1** `src/useSettings.ts`, `src/settings/useSettingsStore.ts:47-183`, `src/setup/useSetupSettings.ts:29-101`, `src/useTranslation.ts:21,61,152` — **à unifier**.
  - Le même besoin (charger, écouter `settings-changed`, file de sauvegarde, debounce, flush) est codé 4 fois.
  - Les copies ont déjà divergé :
    - debounce de 300 ms d'un côté, 400 ms de l'autre ;
    - écho de `settings-changed` dans le store seulement ;
    - retour arrière d'un raccourci refusé différent ;
    - validation `promptError` absente du setup.
- **D2** `src/settings/pages/Server.tsx:20-46` et `src/setup/screens.tsx:133-180` — **à unifier**.
  - « Essayer avec une phrase » est implémenté deux fois : même watchdog `35_000` sous deux noms (`tryWatchdogMs` / `TRY_WATCHDOG_MS`), même compteur, même annulation.
- **D3** `src/bridge.mock.ts:46` et `:78`, `src/connection/endpoint.ts:1,20`, `src/connection/causes.ts:25`, `bridge.ts:209` — **à unifier** dans `connection/endpoint.ts`.
  - `normalizeEndpoint` est du code de production mais vit dans le mock. On y accède par trois chemins.
  - Le masquage de clé existe en trois versions (`maskKey`, `maskedKey`, `••••${tail}`).
- **D4** Petits doublons vérifiés — **à unifier** :
  - `emptyServer` (`bridge.ts:16`, `settings/servers.ts:7`, `setup/model.ts:95`) ;
  - `menuBindingId` = `freeMenuId` ;
  - durées formatées trois fois (`Check.tsx:158`, `Server.tsx:48`, `After.tsx:15`) ;
  - mise en évidence d'un champ en deux versions, avec deux attributs et deux durées (`fields.ts:35` / `SettingsWindow.tsx:189`) ;
  - noms de langue écrits deux fois, dans un ordre inversé (`General.tsx:48`, `screens.tsx:70`) ;
  - `MiniWindow` / `MiniApp` ;
  - `CardChoice` contre un `ToggleGroup` brut ;
  - `serverLabel` (`GlassOverlay.tsx:252`) / `hostOf` ;
  - étapes de sonde (`Check.tsx:110`) / `probeStepIds` (`types.ts:151`) ;
  - texte de capture d'exemple trois fois, avec des ancres différentes (`App.tsx:16,32`, `bridge.ts:35`).
- **D5** Squelettes sans helper — **à unifier** (`useBridgeEvent`, `withTimeout`) :
  - abonnement `bridge.on` avec un drapeau `live`, 7 fois ;
  - file de promesses sérielle, 3 fois ;
  - `Promise.race` + watchdog, 3 fois ;
  - 55 `.catch(() => undefined)` silencieux.
- **D6** i18n — **à unifier** :
  - 34 paires (en, fr) identiques sous des clés différentes (« Close » ×5, « Settings » ×4) ;
  - les chaînes des Réglages sont réparties entre `src/i18n.ts` et `settings/pages/messages.i18n.ts` ;
  - `demo.*` (17 clés) coexiste avec `demo2.*` (63 clés).

### Front : interface (deux générations)

- **D7** `src/ui.tsx:45` et `src/components/controls.tsx:50` — **à unifier** (ou acter la frontière).
  - Deux kits parallèles : deux `IconButton`, deux constantes de trait d'icône (`iconStroke`, `ICON`), deux spinners `LoaderCircle`.
  - `GlassOverlay.tsx:3` utilise Radix ScrollArea en direct, alors que `components/scroll.tsx` existe.
- **D8** `src/theme.css` contre `src/components/tokens.css` (généré) + `src/components/base.css` — **à unifier** (deux accents voulus ? *ambigu*).
  - Deux systèmes de tokens sur le même `:root`, avec des valeurs divergentes :
    - `--focus: #3563e9` (bleu) contre `--ft-accent: #5B4BDB` (violet) ;
    - `--ink-rgb: 29 29 31` contre `--ft-ink-rgb: 22 20 31`.
  - `src/demo/demo.css` mélange les deux familles.
- **D9** `theme.css:22-24,176-177`, `base.css:76-77,128-143`, `setup/setup.css:17-19` — **à unifier**.
  - La matière « verre flottant » est définie trois fois, avec les mêmes valeurs.
  - Le grain SVG l'est deux fois.
  - Le bloc sombre de `theme.css` est écrit deux fois à la main (l. 73-117 et 118-160).
- **D10** `src/motion/**` (`motionPresets`, `toMotionSpring`) contre `src/components/motion.ts` (`SPRINGS`, `CURVES`, `tx`) — **à unifier**.
  - Deux moteurs de motion, avec un seul utilisateur commun (la démo).
  - Le même « smooth » est converti différemment (`visualDuration = d/1.2` d'un côté, `duration` brut de l'autre).
  - Le preset choisi par l'utilisateur n'atteint pas Réglages ni le setup.
  - La courbe `[.23,1,.32,1]` existe en 3 endroits TS et en 11 littéraux CSS.
- **D11** Familles de contrôles CSS — **à unifier** :
  - Boutons : `.ft-button`, `.ilot-btn`, `.result-btn`, `.icon-button`, `.menu-item`, `.dm-ctl`, `.ft-caption-btn`. `.primary-action`, `.quiet-action` et `.text-button` existent en double exact (`styles.css:24-29` et `glass.css:116-119`).
  - Touches : `.ft-keycap`, `.ilot-keycap`, `.dm-key`.
  - Spinners : 4 implémentations, avec deux politiques différentes de mouvement réduit (`glass.css:128` met en pause, `base.css:152` laisse tourner).
- **D12** Valeurs non tokenisées — **à unifier** :
  - le dégradé de marque `#BC82F3 #8D9FFF #FF6778 #FFBA71` est collé dans `window.css:5`, `menu/ilot.css:26`, `settings.css:278` et `lab/ilot.css:10` ;
  - `border-radius` : 134 littéraux sur 179 déclarations, 26 valeurs distinctes ;
  - la règle globale de mouvement réduit est copiée mot pour mot (`styles.css:34` = `glass.css:127`) ;
  - `sr-only` existe en 3 versions.
- **D13** `src/settings/pages/Actions.tsx:23-45` (`IlotPreview`) et `Appearance.tsx:33-103` (`MiniIlot`) — **à remplacer par** le vrai composant (faisabilité hors fenêtre native : *ambigu*).
  - Deux faux Îlot redessinés sans importer `menu/Ilot` : grille 70×52, rayon 18, contre 66×50, rayon 16 dans le vrai.
  - Contraire à la règle « une démo reprend les vrais composants ».
- **D14** `src/result/ResultPill.tsx:94-111` (`WorkingContent`) et `src/loaders/WorkingPill.tsx:23-47` — **à unifier** *(probable)*.
  - Deux pilules d'attente : même minuteur d'orbe, même slot.
- **D15** `src/GlassOverlay.tsx:101-142` (`ReadingSurface`) et `src/components/scroll.tsx:19-51` — **à unifier** *(probable)*.
  - Deux enveloppes de ScrollArea avec le même mécanisme de bords, et trois styles de barre.

### Rust

- **D16** `host.rs:1202-1257`, `host.rs:218,241,284,302`, `capture.rs:560-570`, `pasted.rs:259-269`, `host.rs:638,958` — **à unifier**.
  - `send_copy_chord`, `send_paste_chord` et `send_undo_chord` sont quasi identiques.
  - 4 prédicats de « classe de touche » ont presque la même liste de codes VK en hexadécimal.
  - Ramener la fenêtre source au premier plan est codé 3 fois.
- **D17** — **à unifier** :
  - Lecture du registre en 5 endroits sans helper : `backdrop.rs:403,412`, `probe.rs:265,269`, `system_theme.rs:27`, `legacy_autostart.rs:32`.
  - Écriture JSON atomique en double : `settings.rs:277-328` et `menu_memory.rs:70-76`, qui importe `replace_file` depuis `settings`.
  - Thread + fenêtre cachée + boucle de messages en 3 exemplaires : `clipboard_guard.rs:327`, `system_motion.rs:58`, `host.rs:346`.
- **D18** — **à unifier** :
  - `host:port` formaté 3 fois ;
  - enum → `&str` via `serde_json::to_value` 3 fois ;
  - `"chat_template_kwargs"` est une constante dans `inference.rs:104` mais un littéral dans `probe.rs:702,728`. `probe::try_model` refait le réessai de `inference::stream_within`.
  - `reqwest::Url` d'un côté, `url::Url` de l'autre ;
  - `crypto.rs` : `protect` et `unprotect` sont deux corps quasi identiques.
- **D19** Limite de texte — **à unifier** : une constante, et des messages qui l'interpolent.
  - (0.6.2) `capture::MAX_CHARS` existe, mais le nombre « 200 000 » reste écrit en dur dans `capture.rs` (`UIA_TOO_LONG`), le message de `translate` dans `lib.rs`, la doc d'`error.rs`, `i18n.ts`, `design-lab/src/data.js` et 2 tests e2e.
  - `translate` compte des caractères, l'UIA des unités UTF-16.
  - `FIELD_CAP` vaut le même nombre sous un autre nom.
- **D20** `src-tauri/tauri.conf.json` et `lib.rs:2206-2217,2304-2315` — **à unifier**.
  - overlay, halo et settings sont déclarées dans la config. setup et demo sont construites dans le code, avec une dizaine d'options répétées.
- **D27** `src-tauri/src/lib.rs:2350` (`drag_settings`) + `bridge.dragSettings` — **à virer** *(probable)*.
  - Doublon de `bridge.dragWindow` (`startDragging` côté JS), alors que les deux fenêtres ont le même cadre et que la permission est déjà accordée.

### Frontière Rust ↔ TS

- **D21** Listes et logique copiées à la main — **à discuter** : un générateur de types (tauri-specta est encore en RC, ts-rs), ou des vecteurs de test partagés comme `endpoint.vectors.json`.
  - `ErrorKind` (23) / `errorCodes` (23) ; `ProbeCause` (22) / `probeCauses` (22) ; pages de Réglages (`lib.rs:2094` / `types.ts:90`).
  - `actionDefaults.ts` est marqué « mirrors actions.rs » 6 fois.
  - Doublons de données : `defaultSettings` (`bridge.ts:15-20`), `settings/reset.ts`.
  - Les types IPC sont répartis sur 9 fichiers Rust, contre un seul `types.ts`.
  - Chaque côté teste sa propre liste, sans test croisé.
  - Aujourd'hui, aucune divergence de champ sur environ 35 types, et 21 événements sur 21 concordent. La cohérence tient à la discipline, pas à la construction.

### Labo, tests, scripts

- **D22** `design-lab/reglages/src/ui/index.jsx`, `ui.css`, `mock/server.js`, `lib/motion.js`, `tokens/tokens.css` — **à discuter** : le labo importe-t-il l'app, ou en garde-t-il une copie ?
  - Ce sont des copies manuelles de `controls.tsx`, `controls.css`, `bridge.mock.ts`, `components/motion.ts` et des tokens.
  - `spring.js` est identique octet pour octet dans `design-lab/src/` et `design-lab/reglages/src/lib/`. Un troisième port existe : `src/motion/spring.ts`.
- **D23** `design-lab/reglages/src/demo/Demo.jsx` (711 lignes) + `timeline.js` contre `src/demo/Demo.tsx` (740 lignes) + `script.ts` — **à unifier**, ou à virer côté labo.
  - Deuxième implémentation de la démo, avec une autre timeline (`press` à 2 450 ms contre 3 450 ms).
  - `demo/app.js:1-3` dit « Nothing here is redrawn », alors que le menu, la pilule et le halo sont redessinés en JSX.
- **D24** `e2e/` — **à unifier**.
  - Le type `Fixture` est redéclaré 6 fois.
  - Les helpers `calls`, `on`, `box`, `stage`, `sameSurface`, `openIlot`, `settled`… sont copiés dans 3 à 5 fichiers.
  - `native-fixture.ts` n'exporte rien.
- **D25** `scripts/capture-matrix.ps1` et `test-native-ui.ps1`, `scripts/native-ui-settings/{light,dark}.json`, `ci.yml:36-55` et `release.yml:18-54` — **à unifier**.
  - Les deux scripts ont le même squelette de lanceur (environ 30 lignes de différence).
  - Les deux JSON diffèrent d'une seule ligne.
  - Le job Windows est répété dans les deux workflows.
- **D26** `scripts/native-ui-settings/*.json` (schéma 0.5 : `mode`, `profiles`) et `e2e/native-fixture.ts` (schéma 0.6) — **à unifier**.

## 4. Incohérences de conventions

### Erreurs

- **C1** Rust — **à unifier** sur `AppError` / `ErrorKind`, avec des codes : `probe.rs` en est le modèle.
  - Environ 100 signatures `Result<_, String>` (`lib.rs` 54, `host.rs` 11, `settings.rs` 8…) et environ 72 `.map_err(|_| "…".to_string())` qui jettent la cause.
  - `AppError` ne sert que dans `capture`, `pasted`, `inference` et le cœur de `lib`.
  - Les commandes rejettent de quatre façons : `String`, `Refusal` (`replace_result`), un refus dans un `Ok(UndoOutcome)`, un `bool` (`glass_frame`).
- **C2** Contrôle de flux sur du texte — **à unifier** (codes de bout en bout).
  - `capture.rs:305` : `message.contains("6 000")`, devenu en 0.6.2 `== UIA_TOO_LONG`.
  - `capture.rs:506` : `== NO_SELECTION`.
  - `lib.rs:600` : `starts_with("HotKey already registered")`, imposé par le plugin.
  - `src/settings/messages.ts` traduit 26 phrases françaises de Rust par égalité exacte. Son commentaire reconnaît la dette.
  - `useSettingsStore.ts:107` affiche le texte brut.
- **C3** Front — **à unifier**.
  - Le pont mélange trois formats d'erreur : `throw` de chaînes françaises, `{message, code}`, statut dans une valeur résolue.
  - 55 `catch` sont silencieux.
  - `promptError` et `instructionError` (`actionDefaults.ts:77,84`) renvoient des phrases jamais affichées.
  - La limite `8000` est écrite en dur, alors que `promptMaxLength` existe.

### Format, lint, sûreté

- **C4** Aucun garde-fou — **à unifier** (formateur et linters, en CI).
  - Pas d'ESLint, de Prettier, de Biome ni d'`.editorconfig`. Pas de script `lint` ni `typecheck`.
  - `cargo fmt --check` reformaterait **940 blocs dans 25 fichiers**. Il n'y a pas de `rustfmt.toml`.
  - 183 lignes Rust dépassent 160 caractères ; la plus longue en fait 746.
  - `host.rs:176-604` est en style compact.
  - clippy : 19 warnings (`too_many_arguments` ×4, `manual_is_multiple_of` ×3, `function_casts_as_integer` ×5…). Il ne tourne pas en CI.
  - `tsconfig` est en `strict`, mais sans `noUnused*`.
  - `e2e/`, `visual-tests/` et `scripts/` ne sont dans aucun tsconfig : `tsc -b` ne les voit pas.
- **C5** `src-tauri/src` — **à unifier**.
  - 179 lignes `unsafe` et aucun commentaire `// SAFETY:`.

### Nommage et langue

- **C6** TypeScript — **à unifier**.
  - Constantes en `SCREAMING_CASE` dans `setup/`, en camelCase dans `settings/` (`TRY_WATCHDOG_MS` / `tryWatchdogMs`).
  - Fichiers : `settings/AfterReplace.ts` en PascalCase sans être un composant ; `ui.tsx`, qui contient des composants, en minuscules.
  - `messages.ts` et `messages.i18n.ts` désignent deux choses différentes.
  - `types.ts` contient des tableaux exécutés.
  - Alias redondants (`PageId = SettingsPage`), vocabulaire `ProfileField` pour des serveurs, trois choses nommées `Notice`.
- **C7** Rust — **à unifier**.
  - Getters `get_settings`, `get_history` à côté de `system_theme`, `shortcut_status`.
  - Homonymes entre modules : `Inner`, `Limits`, `Surface`, `Glass`.
  - Même concept, deux noms : `SurfaceRegion` / `HitRegion`, `MenuKeyEvent` / `MenuKey`.
  - Casse des enums sérialisés : minuscules, `snake_case` ou pointée selon le type.
  - Codes de journal : `shortcut.captured` à côté de `setup_window`.
  - Les commentaires renvoient à l'historique (« lot 9 », « review n°6 », « Lucas, 25/09 ») plutôt qu'au code.
- **C8** Langue — **à discuter** (les valeurs persistées coûtent une migration).
  - Valeurs persistées en français dans un code anglais : `perle`, `nebuleuse`, `ruban`, `encre`, `eclat` (`types.rs:49-54,431-434`), contre `smooth`, `bouncy`.
  - Clés de scénario du mock en français (`cle-requise`, `pas-d-api`).
  - Scripts : erreurs en français, commentaires en anglais.
  - Commits en anglais jusqu'au 13/09, en français ensuite.
- **C9** CSS — **à unifier** (une règle de préfixe).
  - Au moins 12 préfixes : `ft-`, `st-`, `su-`, `dm-`, `ilot-`, `result-`, `halo-`, `ldr`/`perle`/`neb`…, `lab-`, et des classes sans préfixe dans `glass.css`.
  - Le CSS est global : 65 noms de classe sont déclarés dans au moins deux feuilles.
  - `src/lab/workbench.css` est minifié sur une ligne.
  - Des règles des Réglages traînent dans `styles.css`.
- **C10** Ancien nom dans les identifiants — **à discuter** (liste exhaustive ou migration).
  - `ft-` / `--ft-` : 1 778 occurrences dans 30 fichiers.
  - Hors de la liste d'AGENTS.md :
    - la clé `localStorage` `flowtranslate.settings.diagnostics` ;
    - `TRAY_ID "flowtranslate"` ;
    - la classe de fenêtre `FlowTranslateSystemMotion` ;
    - `name: flowtranslate` dans compose ;
    - les paquets npm `flowtranslate-*`.
- **C11** Nom de l'app écrit en dur malgré `brand.*` — **à remplacer par** `brand::APP_NAME` / `appName`.
  - Rust : `src-tauri/src/tray_text.rs:27,34,40` et `capture.rs:214`.
  - Labo de l'app : `src/lab/main.tsx:29,34` et `src/lab/bugs.tsx:115`.
  - `design-lab/reglages/src/brand.js` vaut `appName = 'FlowTranslate'`.
  - Tests e2e : `settings-window.pw.ts:44,361,473`, `setup.pw.ts:21,33`.

### Architecture

- **C12** Test et démo livrés en production — **à discuter** (feature Cargo, `cfg(debug_assertions)`, `import.meta.env.DEV`).
  - Rust :
    - 8 variables `FLOWTRANSLATE_*` lues par le code de prod et 6 flags CLI ;
    - 3 commandes de test enregistrées en release (`capture_text`, `override_cursor`, `demo_menu_capture`), gardées à l'exécution seulement ;
    - de fausses traductions en dur (`lib.rs:1409-1414`).
  - Front :
    - `src/bridge.ts:6` importe `bridge.mock.ts` sans condition ;
    - environ 120 lignes de simulation sont dans `command()` ;
    - le build `dist/` contient les scénarios du mock.
- **C13** `src-tauri/build.rs` — **à unifier** *(probable : lecture de la doc de tauri-build, non testé)*.
  - `tauri_build::build()` nu, sans `AppManifest::commands` : les commandes de l'app n'ont pas d'ACL et toute webview peut les appeler.
  - Le label de la fenêtre est vérifié pour certaines (`get_settings`, `probe_connection`, `glass_frame`…), pas pour d'autres (`save_settings`, `translate`, `quit_app`…).
- **C14** Commandes synchrones — **à discuter** *(probable)*.
  - 27 commandes sont synchrones, donc exécutées sur le thread principal. Parmi elles, `save_settings` (fichier, DPAPI, registre, raccourcis) et `get_history` (SQLite, DPAPI).
  - 13 sont `async` et 3 `command(async)`. Aucune règle n'est écrite. `lib.rs:1614` relate un gel.
- **C15** État global — **à discuter**.
  - `AppState` (`Arc<Mutex<Inner>>`, 36 champs), plus 34 atomiques et 10 `static Mutex` / `OnceLock`.
  - Ceux de `host.rs` se justifient (callbacks de hook). Ceux de `halo.rs` et `lib.rs` pourraient vivre dans `AppState`.
- **C16** Minuteries — **à unifier** *(probable)*.
  - Trois styles : `thread::spawn` + `sleep`, `async_runtime::spawn` + `tokio::time::sleep`, `run_on_main_thread`.
  - `halo.rs:119,204` lance un thread qui dort jusqu'à 120 s à chaque appel.
- **C17** `cfg(not(windows))` (11 bouchons : crypto, backdrop, probe…) — **à virer**.
  - Le crate ne peut pas compiler hors Windows : `host.rs`, `clipboard_guard.rs` et `lib.rs` appellent Win32 sans garde.
- **C18** Découpage — **à discuter**.
  - `lib.rs` : 11 responsabilités, des types d'état jusqu'à `run()`, et un câblage de 240 lignes. `demo_menu.rs` va chercher des éléments privés de `lib.rs`.
  - `host.rs` (1 384 lignes de prod) se dit « Windows geometry only » mais mêle hooks, presse-papiers, `SendInput`, hit-tester et langue.
  - `types.rs` mêle DTO IPC et état interne.
  - Côté front, `GlassSession` (`GlassOverlay.tsx:208-547`) fait 340 lignes, avec environ 15 `useState`.
- **C19** Tests — **à discuter**.
  - Quatre familles : `src/**/*.test.ts` (40), `e2e/*.pw.ts` (18, plus un `.spec.mjs`), `visual-tests/*.spec.ts`, `server/test_*.py`.
  - Pas de script npm pour l'e2e. `release.yml` ne lance pas Playwright.
  - Les deux configs Playwright diffèrent sans raison écrite : `warmup` d'un seul côté, locale `fr-FR`.
- **C20** Chemins de machine en dur — **à virer** (passer des paramètres).
  - `design-lab/reglages/scripts/shots.mjs:14`, `demo-shots.mjs:13`, `demo-chaos.mjs:15` et `reglages/README.md:31` pointent vers le dossier temporaire d'**une autre session Claude** (`…/a9e04c7f-…/scratchpad/labo-shots-v2`), et vers `D:/src/Flow_Translate`.
  - `scripts/capture-matrix.mjs:117` pointe vers `C:\Users\Lucas\…\Code.exe`.

## 5. Code mort

- **M1** `src-tauri/src/host.rs:82-120` (`Glass::{Blur, Acrylic, Dwm}`, `apply_glass`, appelé en `lib.rs:3299`) — **à virer** *(probable)*.
  - Essai de matière native par `SetWindowCompositionAttribute`, non documenté.
  - Inactif sans `FLOWTRANSLATE_GLASS`, variable que seule la doc cite. Le vrai verre est dans `backdrop.rs`.
- **M2** Parcours 0.4 (`uiVersion: 'v4'`, atteignable seulement en éditant `settings.json`, `types.rs:458-463`) — **à discuter** : couper le parcours ou l'assumer.
  - Il coûte des branches dans 5 fichiers des Réglages et dans `GlassOverlay.tsx:155,519`, plus des clés i18n en double.
  - Il garde en vie `WaitPill`, `NoticePill` et leur CSS (`glass.css:46-62`), ainsi que les e2e et tests visuels qui forcent `v4`.
  - `root.dataset.ui` (`preferences.ts:23`) n'est lu que par l'e2e.
- **M3** Fonctions et exports TS morts — **à virer** :
  - `getConnScenario` (`bridge.mock.ts:24`) ;
  - `resetJournal` (`connection/diagnostics.ts:43`) ;
  - `promptMaxLength` (`settings/pages/Actions.tsx:19`) ;
  - `bridge.captureText` (`bridge.ts:159`) et sa branche dans le mock ;
  - `bridge.demoWorkArea` (`bridge.ts:282`) ;
  - le composant `Popover` (`components/controls.tsx:176`) et `.ft-popover-panel` ;
  - `useStateTransition` / `stateTransition` (`motion/MotionPreferences.tsx:49`, `motion/presence.ts:41`, utilisés par les tests seulement) ;
  - `layout.ts` : `glass.menuWidth`, `glass.pillHeight`, `menu.width` *(probable)*.
- **M4** `tsc --noUnusedLocals --noUnusedParameters` donne 3 erreurs — **à virer** :
  - `src/GlassOverlay.tsx:5` (`halo`) ;
  - `src/bridge.test.ts:115` (`servers`) ;
  - `src/settings/pages/Server.tsx:159` (`index`).
- **M5** Exports inutiles : knip en signale 91, plus 22 types. La plupart sont utilisés dans leur propre fichier, comme `COMPACT_MAX_LINES`, `typingDelayMs` ou `isPage` — **à unifier** (retirer `export`).
  - Sans configuration, knip produit des faux positifs : `src/lab/*` et `design-lab/*` passent pour inutilisés (entrées `lab.html`), et les « imports non résolus » de l'e2e sont des URL Vite.
- **M6** Variables CSS jamais lues — **à virer** :
  - `theme.css` : `--settings-field-border`, `--settings-scheme`, `--settings-text`, `--switch-*`, `--keycap-*`, `--capture-bg`, `--ok`, `--pending`, `--fail`, et plusieurs autres lues seulement par `theme.test.ts` ;
  - `base.css` : 15 `--ft-*` (`--ft-win-blur`, `--ft-nav-*`…) ;
  - `tokens.css` : `--ft-accent-deep`, `--ft-sidebar-rgb`.
- **M7** CSS sans usage — **à virer** :
  - Classes posées en TSX sans aucune règle CSS : `ft-command-scroll`, `ft-secret-eye`, `ft-select-content`, `ilot-ask`, `dm-bye`, `dm-text`, `dm-caption-text`, `pill-close`.
  - Règles sans utilisateur : `.st-mini-more`, `.ft-keycap[data-size="xl"|"lg"]`.
- **M8** Frontière — **à virer**, ou à typer :
  - `TargetInvalidated.anchor_lost` et `.code` (`types.rs:611-617`) sont envoyés, mais jamais typés ni lus côté TS.
  - `Server.name` est persisté et validé en Rust, jamais écrit par le TS (toujours `''`) — **à discuter**.
- **M9** Scripts cassés ou obsolètes — **à virer**, ou à réécrire :
  - `scripts/capture-ui-preview.mjs` (`npm run ui:motion`) cherche les menus « Agrandir » et « Réduire », qui n'existent plus (confirmé par `docs/DA-RAPPORT.md:328`) ;
  - `scripts/profile-ui.mjs` utilise les libellés français de la 0.4 et n'a pas d'entrée npm ;
  - `scripts/package-test-kit.ps1` copie `docs/ESSAIS-<version>.md`, absent pour la 0.6, et décrit Ctrl+Alt+T ;
  - `scripts/capture-matrix.*` ne fonctionne qu'avec Ctrl+Alt+T et le verre 0.4 *(ambigu)*.
- **M10** `server/` — **à virer** ou **à unifier** :
  - `fetch_metadata.py` n'est référencé nulle part ;
  - `server/metadata/` n'a pas le profil `general` ;
  - `evaluate.py:101` n'accepte que `fast` et `quality` ;
  - `.env.example` n'a pas les variables `GENERAL_*` ;
  - `server/results/.gitkeep` est autorisé par le `.gitignore` mais n'est pas suivi.
- **M11** `e2e/native-fixture.ts:308` (`shortcutStates`) et `:314` (`suggestion`) ne sont appelés par aucun test — **à virer**.
- **M12** Branche HeroUI du labo Réglages — **à discuter**, puis **à virer** si l'abandon est confirmé.
  - `src/heroui/`, `catalog/heroui.jsx`, `scripts/scope-css.mjs`, les dépendances `@heroui/*`, Tailwind, react-aria, la palette « Papier » et le jeu B : tous ces choix sont tranchés ailleurs (`scripts/gen-ft-tokens.mjs:12-13` fixe porcelaine et A ; `controls.tsx:18-19` retient Radix).
  - 5 dépendances sans import : `@internationalized/date`, `@radix-ui/react-dropdown-menu`, `@react-aria/ssr`, `@react-aria/utils`, `react-aria-components`. Ce sont peut-être des peer deps.
- **M13** `src/App.tsx:21-35` (`DemoDesktop`, `?window=demo`) — **à discuter**.
  - Une deuxième mini-démo du navigateur (faux courrier, logo « FT ») qu'aucun test n'utilise.
- **M14** Rust — **à discuter**, la valeur dépend de la population restée en 0.3 à 0.5.
  - Migrations héritées : `actions.rs` (`migrate_to_ilot`, `legacy_*`), `settings.rs` (profils 0.5), `legacy_autostart.rs` (même travail que `windows/hooks.nsh`, en double volontaire).
  - Colonnes d'historique détournées : `mode` contient l'hôte.

## 5 bis. Ce que la doc affirme et que le code contredit

- **X1** `AGENTS.md:8` dit que le nom n'est « never written in new code » — **à remplacer par** `brand.*` (voir C11).
  - Le code le contredit : `tray_text.rs`, `capture.rs:214`, `src/lab/*`.
- **X2** `AGENTS.md:11` dit « Never log … credentials » — **à discuter** : reformuler (« jamais une clé entière »).
  - `diagnostics.rs:117-121` (`mask_key`) écrit les 4 derniers caractères d'une clé de 12 caractères ou plus dans `logs/diagnostic.log`. C'est voulu (`PLAN-0.6.md:30`).
- **X3** `AGENTS.md:14` (branches et worktrees par agent) contre `AGENTS.md:15` (peu de branches) et `PLAN-0.6.md:5,14` (« jamais de worktree ») — **à unifier**.
- **X4** `AGENTS.md:5` (« track individual fixes in docs/UI-ISSUES.md ») — **à discuter** : où vit le registre ?
  - Le registre s'arrête à UI-031 (24/09). Les correctifs 0.6 sont dans `RELEASE-NOTES.md` et `BRIDGE.md`.
- **X5** `AGENTS.md:7` impose de lire `docs/SPEC.md` avant de changer une interface — **à remplacer par** `docs/BRIDGE.md` comme référence, ou réécrire SPEC.
  - Or SPEC se trompe sur 7 points :
    - titre « FlowTranslate V1 » et « en cours sur da-ilot » ;
    - verre peint par défaut : faux, le défaut est `Glass` (`types.rs:80-84`) ;
    - Mode et profils : supprimés ;
    - « Remote endpoints require HTTPS except loopback » : faux depuis la 0.6 (`settings.rs:541-543`) ;
    - dépôt `BerthalonLucas/flowtranslate` : le vrai est `Overtype` ;
    - marques liées à Annuler : elles en sont indépendantes ;
    - « anglais par défaut » : une installation neuve prend la langue de Windows (`lib.rs:3211-3214`).
- **X6** `AGENTS.md:8-9` appelle `PLAN-0.6.md` et `DA-PLAN.md` « le plan » — **à discuter** : les marquer « exécuté ».
  - Les deux sont exécutés, avec une dizaine d'écarts : `list_models`, `glass_morph`, `glass.rs` jamais créé, `e2e/connection.pw.ts` jamais créé…
- **X7** `README.md` — **à remplacer par** une réécriture 0.6.
  - L3 avoue ne pas être réécrit.
  - L5-16 annonce une « 0.5.0 en cours, non publiée », alors que le code est en 0.6.x.
  - Il donne Ctrl+Alt+T, alors que le défaut est Ctrl+Alt+Space (`actions.rs:165`).
  - « Connexion avancée », « Rapide / Qualité », « Profil par défaut » n'existent plus : l'app gère de 1 à 8 serveurs.
  - Il dit « HTTP seulement en loopback », ce qui est faux.
  - Il dit qu'on publie seulement par tag, alors que `release.yml` publie aussi sur un push de `main` et crée le tag lui-même.
- **X8** `docs/BRIDGE.md` — **à unifier** : c'est la doc la plus juste (42 commandes sur 43, 21 événements sur 21), il reste des scories.
  - Titre « (FlowTranslate 0.4.0) ».
  - L15 donne un minimum de 460×420, contre 720×480 dans `tauri.conf.json`.
  - Le bloc Types (L134-161) garde `Mode`, `Profile`, `connectionExpanded`, alors que L239 dit qu'ils ont disparu.
  - L61 décrit un reset contraire à `settings/reset.ts`.
  - L107 annonce un temps de surlignage de 15 s, 30 s, 1 min ou 2 min, contre un slider de 5 à 120 s (`AfterReplace.ts:4`).
  - L228 parle d'un graphite `rgba(24,26,31,.96)` et de `--glass-shadow`, absents du code.
  - `override_cursor` n'est pas documenté.
- **X9** `docs/ENDPOINTS.md` — **à remplacer par** la description réelle.
  - Navigation « Connexion avancée » et « Vérifier = GET /models en 5 s », alors que la sonde a 4 étapes.
  - Le message de refus HTTP cité n'existe plus.
  - (0.6.2) Le contrat de requête, encore juste en 0.6.0, ne l'est plus : `max_tokens: 4096` a été retiré, et les « 120 s au total » sont devenus 120 s de silence (`inference.rs`, `Limits.idle`).
- **X10** `docs/DEPLOYMENT.md` — **à remplacer par** une version à jour.
  - Il donne Ctrl+Alt+T et « Connexion avancée », parle d'une « langue cible » supprimée en 0.4, dit « le client refuse HTTP hors loopback », mentionne Codex, et oublie le profil `general` (port 8003).
- **X11** `docs/native.md` et `docs/frontend.md` — **à remplacer par** une version à jour.
  - `native.md` :
    - règle HTTP loopback ;
    - `FlowTranslate.exe --demo-selection`, alors que le binaire s'appelle `Overtype.exe` ;
    - restauration du presse-papiers prouvée par le numéro de séquence, alors que c'est maintenant par la propriété (`clipboard_guard.rs:13-15`).
  - `frontend.md` parle de « trois fenêtres » ; il y en a cinq.
- **X12** `docs/UI-DECISIONS.md` — **à discuter** : marquer ces décisions comme dépassées.
  - La décision 3 (verre peint par défaut) est dépassée.
  - La décision 8 (« une action existante n'est jamais renommée ») est contredite par `actions.rs:150-161` (`localize_defaults` renomme les défauts jamais touchés).
  - La liste du temps de surlignage ne correspond pas au slider.
- **X13** `docs/UI-ISSUES.md` — **à unifier**.
  - UI-029 est marqué « Ouvert » alors qu'il est traité (`shortcut_status`, `suggest_shortcut`).
  - UI-005 décrit une fenêtre de 520 px graphite.
  - La section « Ordre » dit que le verre peint est le défaut.
- **X14** `design-lab/README.md` et `design-lab/reglages/README.md` — **à remplacer par** une version à jour.
  - `design-lab/README.md` :
    - mise-en-valeur « à choisir avant tout code » : choisie le 25/09 et implémentée ;
    - « la fenêtre ne prend pas le focus » : `focus_overlay` existe ;
    - Acrylic « lot 12 » : le vrai verre est livré.
  - Le labo Réglages liste comme « restent à trancher » trois choix déjà tranchés.
- **X15** `visual-tests/README.md` — **à unifier** *(probable)*.
  - Il dit que les images 0.4 sont « périmées, ni acceptées ni régénérées » et celles de l'Îlot « en attente de revue ».
  - Or le commit `dc8a9d9` (02/10) les a régénérées « après examen ».
- **X16** Mentions du routage d'agents obsolète (Astra, Codex) — **à virer** ces mentions.
  - `docs/VALIDATION.md:49`, `DEPLOYMENT.md:14-16`, `docs/design/glass-reader/README.md`, qui se dit « référence courante » alors qu'AGENTS.md:9 la dit historique.
- **X17** Chemins cités qui n'existent pas — **à discuter**.
  - `DA-PLAN.md:557,561` ;
  - `PLAN-0.6.md:280,435` (`glass.rs`), `:309,397` (`ActionSettings.tsx`, `AnimationsSetting.tsx`), `:377` (`e2e/connection.pw.ts`) ;
  - `ACRYLIC-TRIAL.md` renvoie à une section de BRIDGE qui n'existe pas ;
  - une vingtaine de renvois vers `release/` et `test-results/`, ignorés par git : ces preuves sont invérifiables depuis le dépôt.
- **X18** Docs datées sans bandeau « historique » — **à discuter** : ajouter un bandeau.
  - `DESIGN-REGLAGES.md` : tailles 720×520 et 820×600, contre 620×720 et 860×600 réels.
  - `GLASS-NATIVE*.md` parlent de `window-vibrancy`, absent de `Cargo.toml`.
  - `RECETTE.md` n'a pas de recette 0.6 et renvoie à `VALIDATION.md`, qui s'arrête à la 0.1.6.

**Statut des documents** (résumé) :

| Statut | Documents |
|---|---|
| À jour | `AGENTS.md` (3 réserves ci-dessus), `docs/VERRE-0.6.md`, `server/README.md`, `design-lab/reglages/README.md` (numéros de ligne dérivés), `docs/BRIDGE.md` (scories) |
| Historique assumé | `RELEASE-NOTES.md`, `DA-RAPPORT.md`, `UI-DECISIONS.md`, `UI-ISSUES.md`, `UI-ITERATION.md`, `UI-FOUNDATION.md`, `UI-LAB.md`, `UI-PERFORMANCE.md`, `UI-WORKBENCH-VALIDATION.md`, `VALIDATION.md`, `ESSAIS-*`, `RELEASE-FRONTEND.md`, `RELEASE-NATIVE-REVIEW.md`, `GLASS-FRONTEND.md`, `GLASS-MATERIAL.md`, `ACRYLIC-TRIAL.md`, `PLAN-0.6.md`, `DA-PLAN.md`, `docs/evaluation/` |
| Périmé mais présenté comme actuel | `README.md`, `docs/SPEC.md`, `ENDPOINTS.md`, `DEPLOYMENT.md`, `native.md`, `frontend.md`, `DESIGN-REGLAGES.md`, `GLASS-NATIVE.md`, `GLASS-NATIVE-POLISH.md`, `docs/design/glass-reader/README.md`, `design-lab/README.md`, `visual-tests/README.md` |
| Doublon | `docs/design/labo-flowtranslate.html` (= `design-lab/labo-flowtranslate.html`) |

## 6. Hygiène du repo

- **H1** Clone local — **à discuter** (règle : repartir de `main` après un merge).
  - Le clone est sur `refonte-reglages`, mergée (PR #11) le 02/10.
  - `main` local a 4 commits de retard sur GitHub. Les tags `v0.6.0`, `v0.6.1` et `v0.6.2` ne sont pas rapatriés.
  - Pendant l'audit, une autre session a commité `1cabc95` par-dessus cette branche mergée, qui diverge désormais de `main`.
- **H2** Branches sur GitHub : 34 en plus de `main`. Vérifié avec `git ls-remote`, `merge-base` et `git cherry` :
  - **16 mergées et jamais supprimées**, dont `refonte-reglages`, `da-ilot`, `fix-endpoint-tls` et `claude/great-keller-6dwrqd` — **à virer** ;
  - **10 non mergées, mais dont tous les commits ont un équivalent dans `main`** : `feat/frontend-primitives`, `feat/glass-frontend`, `feat/glass-material`, `feat/glass-native`, `feat/glass-native-polish`, `fix/scoped-drag`, `release/{frontend,guide,native,server}-0.1.5` — **à virer** ;
  - **8 avec du travail absent de `main`** — **à discuter** :
    - `codex/multi-editor-replacement` : 9 commits, PR #6 ouverte depuis le 15/09, 155 commits de retard ;
    - `feat/0.5.0-design-1.0` : 4 ;
    - `wt-050-atelier` : 4, `wt-050-reglages` : 4, `wt-050-marque` : 3, `wt-050-natif` : 2, `wt-050-verre` : 2 (marquées « wip ») ;
    - `fix/native-window` : 1.
- **H3** Dépôt local — **à virer** (`fetch --prune`), et **à discuter** pour les stash.
  - 21 références de suivi pointent vers des branches supprimées sur GitHub (`da-ilot-*`, `worktree-wf_*`).
  - 2 stash « wip workflow 1 » sont posés sur `refonte-reglages`.
- **H4** Nommage des branches — **à unifier**.
  - Coexistent : `feat/`, `fix/`, `release/`, `design/`, `chore/`, `codex/`, `claude/`, `wt-050-*`, `da-ilot-*`, `worktree-wf_*`, `fix-endpoint-tls` (tiret au lieu de barre), `refonte-reglages` (en français).
- **H5** Messages de commit, sur 238 commits hors merges — **à unifier**.
  - Le préfixe conventionnel est presque toujours là : fix 81, feat 72, docs 39, test 20, chore 15. Mais des types hors norme apparaissent : `design-lab`, `design`, `release`.
  - La première ligne fait **102 caractères en moyenne** ; 175 sur 238 dépassent 72 caractères, le maximum est **702** (`13397c3`). Le sujet sert de paragraphe de changelog.
  - Les scopes sont libres et doublonnés : `glass` / `verre`, `réglages` / `reglages`, `native` / `natif`, `lot 9`, `revue`, `0.6`.
  - Les merges ont trois formats : « Merge PR #10: … », « merge(lot 14): … », « Merge da-ilot-mev : … ».
  - Les messages sont en anglais jusqu'au 13/09, en français ensuite.
- **H6** Attribution — **à discuter** (réécrire l'historique n'est pas anodin).
  - 7 commits du 23 et 24/09 sont signés `Claude <noreply@anthropic.com>`, avec un `Co-Authored-By`. Contraire à la règle « aucune attribution IA ».
  - 12 merges faits depuis l'interface web portent l'adresse noreply de GitHub.
- **H7** Cadence — pour information, sans étiquette.
  - 110 commits le 24/09 seul, avec des lots en parallèle. L'historique de cette journée se lit mal.
- **H8** Fichiers versionnés discutables :
  - `design-lab/labo-flowtranslate.html` et `docs/design/labo-flowtranslate.html` : sortie de build (`assemble.mjs` écrit les deux), blob identique — **à virer** (la copie de `docs/`) ; versionner l'artefact lui-même est **à discuter**.
  - `design-lab/reglages/labo-reglages.html` : sortie de build de 1,85 Mo, **périmée** (elle contient `--ir1`, que l'app a remplacé par `--encre1`) — **à discuter** : le retirer du suivi, ou le régénérer et le vérifier en CI.
  - `src/components/tokens.css` : généré par `scripts/gen-ft-tokens.mjs`, appelé par aucun script npm ni par la CI. Il est fidèle aujourd'hui (regénéré à part, diff vide) — **à discuter** : le garder, avec une vérification en CI.
  - `docs/design/glass-reader/*.png` (3 × 1,5 Mo) et `docs/design/*-approved.png` (2 × 1 Mo) : références historiques d'après AGENTS.md:9 — **à discuter**.
  - `design-lab/reglages/.gitignore` : redondant avec celui de la racine — **à virer**.
- **H9** Trois projets npm sans workspaces (racine, `design-lab`, `design-lab/reglages`), avec trois lockfiles et des versions divergentes de React, motion et lucide. `design-lab` n'est pas installé sur la machine — **à discuter**.

---

## Points ambigus, notés sans trancher

- Les deux accents (bleu `#3563e9` de l'overlay, violet `#5B4BDB` des fenêtres) sont-ils voulus ? (D8)
- `design-lab/` doit-il importer l'app, ou garder une copie figée comme référence ? AGENTS.md demande de le garder. (D22, D23)
- Le parcours 0.4 (`uiVersion: 'v4'`) doit-il rester atteignable ? (M2)
- `server/` en stdlib seule : est-ce une contrainte voulue ? (R15)
- Faut-il migrer les identifiants de l'ancien nom (`ft-`, `flowtranslate.*`), ou les lister exhaustivement ? (C10)
- Faut-il adopter un générateur de types pour la frontière (tauri-specta est encore en RC) ? (D21)
- `arboard` et `clipboard_guard` en parallèle : `copy_result` n'exclut pas la copie de l'historique Win+V. Est-ce voulu ? *(ambigu)*
- Commandes sans ACL : le risque dépend du contenu chargé par chaque webview, uniquement local aujourd'hui. (C13)
- Le thème de Tauri remplace-t-il `system_theme.rs` en contraste élevé ? (R4)

## Sain, à garder tel quel

- **Discipline Radix et cmdk dans la couche fenêtres** : `components/controls.tsx`, `nav.tsx` et `scroll.tsx` sont des enveloppes minces. Aucun switch, select ou dialog maison dans les Réglages. Toutes les dépendances racine sont réellement importées.
- **Vecteurs partagés Rust/TS** : `normalizeEndpoint` est écrit deux fois, mais protégé par `endpoint.vectors.json`, que lisent les deux côtés. C'est le modèle à étendre à la frontière.
- **Confidentialité, conforme à AGENTS.md** :
  - aucun `println!` ni `console.log` en prod ;
  - journal `diagnostics.rs` sans aucun texte ni clé entière, avec rotation à 1 Mo et un anneau de 500 entrées ;
  - DPAPI pour les clés et l'historique ;
  - historique opt-in, purgé après 7 jours ou 100 entrées.
- **Presse-papiers et remplacement** : la cible est revalidée 3 fois avant de coller (`capture.rs:423-441`), et le presse-papiers n'est restauré que si l'app en est encore propriétaire (`clipboard_guard.rs`).
- **Rust propre sur les bases** :
  - aucun `#[allow(dead_code)]`, aucun warning de code mort de clippy ;
  - 5 `unwrap` / `expect` en prod, tous sur des invariants ;
  - environ 4 600 lignes de tests unitaires sur la logique pure.
- **Modèle d'erreur à généraliser** : `ErrorKind` / `AppError` / `Refusal`, et `probe.rs`, qui envoie des codes plutôt que des phrases.
- **Frontière cohérente aujourd'hui** :
  - 21 événements émis, 21 écoutés ;
  - aucun appel vers une commande inexistante ;
  - aucune divergence de champ sur environ 35 types.
- **Plugins Tauri officiels utilisés comme prévu** : `single-instance`, `autostart`, `global-shortcut` et (0.6.2) `updater`, avec un installeur signé.
- **Release** : `release.yml:27` vérifie que les versions concordent, et un SHA-256 est publié.
- **`tokens.css` généré fidèlement** (diff vide après régénération).
- **Démo et labo de l'app** :
  - `src/demo/Demo.tsx` importe les vrais composants, contrat vérifié par `demo.test.ts:30` ;
  - `src/lab/` sert les vrais composants, en dev seulement ;
  - `diff.test.ts` et `errors.test.ts` lisent les sources du labo (`?raw`) pour détecter la dérive.
- **`visual-tests/`** : chaque PNG a son test, et un garde-fou vérifie la couverture.
- **`server/`** : `compose.yaml`, `model-lock.json`, `preflight.py` et `start.ps1` sont cohérents, et `model-lock.json` est la source unique.
- **Dépendances racine** : épinglées en version exacte, aucune dépréciée, aucun avis RustSec sur les crates directes.
- **Secrets et poids** : rien de sensible n'est suivi. `.gitignore` couvre `.env`, `*.key`, `*.pem`, les modèles. Le dépôt pèse 35 Mo.
- **`docs/BRIDGE.md`, `docs/VERRE-0.6.md`, `server/README.md`** : fiables dans l'ensemble.

## Règles que le repo devrait se donner

1. **Un format, des gardes en CI** : `cargo fmt --check`, `cargo clippy -D warnings`, un linter et formateur TS (ESLint + Prettier, ou Biome), `tsc` avec `noUnused*`. `e2e/` et `scripts/` dans un tsconfig.
2. **Win32 uniquement via le crate `windows`** : pas d'`extern` ni de `GetProcAddress` sans justification écrite. Chaque bloc `unsafe` porte un `// SAFETY:`.
3. **Un seul type d'erreur à travers les commandes**, avec un code. Rust envoie des codes, le front traduit. Aucune logique ne dépend du texte d'un message.
4. **Une source unique par donnée partagée Rust ↔ TS** : générée, ou couverte par des vecteurs de test communs (modèle `endpoint.vectors.json`). Noms d'événements et de commandes en constantes.
5. **Une seule couche d'interface** :
   - des tokens `--ft-*`, un moteur de motion, un kit de composants Radix ;
   - pas de couleur, rayon ou durée en dur ;
   - un préfixe CSS déclaré par fonctionnalité.
6. **Le nom vient de `brand.ts` / `brand.rs` partout**, y compris labos, tray et tests. L'ancien nom n'est toléré que dans une liste exhaustive d'AGENTS.md.
7. **Le code de test et de démo reste hors du binaire et du bundle de prod** (feature Cargo, `import.meta.env.DEV`). Sinon, il est listé explicitement.
8. **Un labo importe l'app ou n'existe pas** : pas de copie manuelle de composants, de tokens ou de timelines. Un artefact généré n'est versionné que s'il est vérifié en CI.
9. **Doc tenue à chaque release** : le README et une référence d'interface (BRIDGE.md) à jour. Plans et rapports portent « historique » en tête. Un changement de comportement documenté met la doc à jour dans le même commit.
10. **Git** :
    - branches `type/sujet`, supprimées au merge, et on repart de `main` après un merge ;
    - première ligne de commit de 72 caractères au plus, le détail dans le corps ;
    - scopes pris dans une liste fixe, une seule langue.
11. **Aucun chemin de machine** (`D:/…`, `C:\Users\…`, dossier temporaire de session) dans un fichier versionné.
12. **Dépendances honnêtes** : déclarer ce qu'on utilise (features tokio), retirer ce qu'on n'utilise pas. Node fixé dans un fichier que la CI lit. Tauri monté ensemble côté crates, API et CLI.

---

<details>
<summary>Non vérifié, et pourquoi</summary>

- Rien n'a été exécuté en vraie fenêtre : ni l'app, ni les tests, ni les builds autres que clippy. Les écarts de rendu (ressorts, teintes, verre) sont déduits du code.
- Les features `windows` et `uiautomation` « inutilisées » reposent sur des recherches textuelles : à confirmer une par une avec `cargo check`.
- L'ACL des commandes (C13) vient de la doc de tauri-build, sans test.
- `fs::rename` (R5) : vérifié dans la doc std seulement.
- Le thème Tauri face à `system_theme.rs` (R4) : non comparé en exécution.
- `hooks.nsh` : lu, mais l'installation n'a pas été jouée.
- Fraîcheur de `design-lab/labo-flowtranslate.html` : impossible à prouver sans lancer `build.sh`.
- Les images de référence 0.4 passent-elles encore ? `ui:check` n'a pas été lancé.
- Effet réel de la fin de node20 sur la CI : les runs sont verts, mais je n'ai pas lu de log.
- `docs/roadmap/` (commit `1cabc95`, fait pendant l'audit par une autre session) : non audité.
- Lecture partielle : la fin de `capture.rs`, `clipboard_guard.rs`, `settings.rs`, `actions.rs`, `inference.rs` et `probe.rs`, les modules de tests Rust, `IlotStage.tsx` et la seconde moitié de `GlassOverlay.tsx`.

</details>
