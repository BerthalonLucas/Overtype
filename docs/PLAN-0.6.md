# Plan de construction 0.6.0 : le labo devient l'app

Rédigé le 01/10/2026 par l'architecte (lecture seule sur le code). Branche `refonte-reglages`, un seul
arbre de travail partagé par tous les agents. Référence visuelle et de comportement :
`design-lab/reglages/` (README, puis `src/`). Spec d'origine : `docs/DESIGN-REGLAGES.md` (29/09), **dépassée
par le labo v2** partout où ils diffèrent (taille du setup, nombre d'étapes, Ctrl+Maj+M, http accepté).

Sommaire : 0. Règles communes · 1. Modèle de données · 2. Commandes et événements · 3. Fenêtres ·
4. Carte des fichiers, i18n, tests · 5. Propriété des fichiers · 6. Risques, ordre, décisions à remonter.

---

## 0. Règles communes (tous les agents)

- **Arbre partagé.** Jamais `git stash`, `git checkout -- .`, `git add -A`, `git reset`. Seulement
  `git add <mes chemins>` puis `git commit -- <mes chemins>` (ne prend que ces chemins, même si un autre
  agent a indexé les siens). `index.lock` occupé : attendre, réessayer. Jamais de push.
- **Le nom de l'app** vient de `src/brand.ts` (`appName`) côté front et d'un nouveau
  `src-tauri/src/brand.rs` (`pub const APP_NAME`) côté Rust. Aucune chaîne i18n ne contient le nom : paramètre
  `{app}`. L'identifiant `com.flowtranslate.desktop` (dossier de données, clés DPAPI, historique) et les
  variables `FLOWTRANSLATE_*` **ne changent pas** au renommage.
- **Jamais dans un journal, un événement de diagnostic ou un test** : texte source, traduction,
  presse-papiers, clé complète (4 derniers caractères au plus, `••••3f2a`).
- **Robustesse** (Lucas) : toute attente a un délai et une sortie (Échap, clic dehors, zone de notification) ;
  une commande relancée annule la précédente (un `run` par vérification, le front ignore tout `run` périmé) ;
  aucun double clic ne lance deux fois ; tout champ numérique est borné côté front **et** côté Rust.
- **Boucle** : modifier → capturer → regarder le PNG → revoir → valider, cas d'erreur compris. Captures dans
  `…\scratchpad\app06\<zone>\`. Aperçu : Vite 5173 (`/?window=settings`, `/?window=setup`,
  `/?window=setup&stage=demo`, `/?window=overlay&demo=1`), serveur simulé choisi par `&conn=<scénario>`.
- Ne jamais joindre les serveurs LLM de l'hôte : `--simulate-inference` et serveurs factices sur 127.0.0.1.

---

## 1. Modèle de données

### 1.1 Nouveaux types

TypeScript (`src/types.ts`) :

```ts
export type Server = { id: string; name: string; endpoint: string; apiKey: string; noKey: boolean; model: string };
export type ChangedWordsStyle = 'encre' | 'eclat';
export type Settings = {
  /* inchangé : actions, shortcutBindings, defaultActionId, historyEnabled, autostart, textSize, autoClose,
     uiVersion, language, theme, motion, motionPreset, indicator, afterReplace, undoStrategy, pillPlacement,
     glassMaterial, menuActionIds */
  servers: Server[];            // 1 à 8 ; l'interface en montre 2 au plus (labo)
  defaultServerId: string;      // toujours l'id d'un serveur présent
  setupDone: boolean;
  changedWordsStyle: ChangedWordsStyle;   // défaut 'encre'
};
// SUPPRIMÉS : Mode, Profile, Settings.mode, Settings.profiles, Settings.connectionExpanded
```

Rust (`src-tauri/src/types.rs`) :

```rust
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Server { pub id: String, #[serde(default)] pub name: String, pub endpoint: String,
                    #[serde(default)] pub api_key: String, #[serde(default)] pub no_key: bool, pub model: String }
#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ChangedWordsStyle { #[default] Encre, Eclat }
// Settings : servers: Vec<Server>, default_server_id: String, #[serde(default)] setup_done: bool,
//            #[serde(default)] changed_words_style: ChangedWordsStyle
impl Settings { pub fn server(&self, id: &str) -> Result<&Server, AppError>;   // BadEndpoint si absent
                pub fn default_server(&self) -> &Server; }
```

- `noKey` s'ajoute à la liste demandée (`id, name, endpoint, apiKey, model`) : c'est « Mon serveur n'a pas de
  clé » du labo. Sans lui, une clé vide ne dit pas si elle manque ou si elle n'existe pas.
- `name` : vide en 0.6 (l'interface affiche l'hôte, `hostOf` du labo `pages/Server.jsx:14`). Gardé pour plus tard.
- `endpoint` : **l'adresse sans `/v1`** (`https://llm.exemple.com`, `http://127.0.0.1:8002`), ou vide tant que
  rien n'est réglé. `inference::api_url` (`inference.rs:86-96`) ajoute déjà `/v1/<route>`.
- Installation neuve : `servers = [{ id: "s1", name: "", endpoint: "", apiKey: "", noKey: false, model: "" }]`,
  `defaultServerId = "s1"`, `setupDone = false`, langue = celle de Windows (`fr*` → `fr`, sinon `en`).
  Les valeurs d'usine 0.5 (`127.0.0.1:8001/8002`, `flowtranslate-fast/quality`, `types.rs:494-510`) disparaissent.

### 1.2 Normalisation et validation de l'adresse

Une seule règle, écrite deux fois et testée sur les mêmes vecteurs :
`src/connection/endpoint.ts` (`normalizeEndpoint`, indice immédiat pendant la frappe) et
`settings::normalize_endpoint` (Rust, fait foi). Fichier commun `src/connection/endpoint.vectors.json`
(lu par vitest et par `cargo test` via `include_str!`).

```ts
export type NormalizedEndpoint =
  | { ok: true; base: string; host: string; display: string; secure: boolean; local: boolean; insecure: boolean; changed: boolean; removed?: string }
  | { ok: false; reason: 'empty' | 'malformed' | 'scheme' | 'credentials' };
```

Règle (labo `mock/server.js:60-92`) : espaces retirés ; `https://` ajouté sans schéma (`http://` si l'hôte est
cet ordinateur) ; `/v1/chat/completions`, `/chat/completions`, `/v1/models`, `/v1` et la barre finale retirés ;
requête et fragment retirés ; identifiants dans l'adresse refusés. **`http://` accepté pour tout hôte** :
`insecure = http et hôte non local` → avertissement « Connexion non chiffrée · La clé et le texte passent en
clair sur le réseau. ». `validate_endpoint` (`settings.rs:312-341`) : retirer le refus de `settings.rs:332-336`
et celui du chemin (`:337-339`, un préfixe comme `/openai` devient permis) ; une adresse vide est valide (non réglé).

`settings::validate` (`settings.rs:287-310`) devient : 1 à 8 serveurs ; ids uniques `[a-z0-9-]{1,32}` ;
`defaultServerId` présent ; adresse vide ou normalisée ; modèle ≤ 200 caractères sans caractère de contrôle
(**vide permis**) ; clé ≤ 4096 sans retour à la ligne ; `noKey` vrai ⇒ clé vidée à l'enregistrement.
Une action lancée sans adresse → `bad_endpoint`, sans modèle → `model_not_found` : la pilule d'erreur ouvre
la page Serveur sur le bon champ (§1.4).

### 1.3 Migration depuis un fichier 0.5 (`settings.rs`)

`PersistedSettings` (`settings.rs:22-68`) : `mode` et `profiles` passent en `Option`, lus seulement
(`skip_serializing`) ; ajout de `servers: Option<Vec<PersistedServer>>`, `default_server_id`, `setup_done:
Option<bool>`, `changed_words_style`. `PersistedServer { id, name, endpoint, model, no_key, api_key_dpapi }` :
**le stockage DPAPI ne change pas** (`crypto::protect`, base64, `settings.rs:95-103, 171-175`).

Quand `servers` est absent (fichier ≤ 0.5.1) :

1. Avant toute réécriture, copier le fichier en `settings.0.5.bak.json` (une fois ; retour arrière possible).
2. Un profil est **rempli** si son adresse n'est pas vide et s'il n'est pas la valeur d'usine 0.5
   (adresse `http://127.0.0.1:8001/v1` ou `:8002/v1` + modèle `flowtranslate-fast|quality` + clé vide).
3. `quality` rempli → serveur `s1`. `fast` rempli **et** différent de `quality` (adresse normalisée, modèle ou
   clé) → serveur `s2` (ou `s1` si `quality` n'est pas rempli). Aucun rempli → un seul `s1` vide.
4. Chaque adresse passe par `normalize_endpoint` (le `/v1` enregistré disparaît). Clé vide sur un profil
   rempli → `noKey = true`.
5. `defaultServerId` = le serveur issu de `fast` si `mode == fast` et qu'il existe, sinon le premier.
6. `setupDone` = vrai si au moins un serveur est rempli (un utilisateur 0.5 ne revoit pas le setup ; « Revoir
   l'accueil » reste dans Général), faux sinon.
7. `changedWordsStyle = encre`. `connectionExpanded` abandonné. Réécriture une fois (comme `settings.rs:160-163`).

`settings::reset` (`settings.rs:262-272`) et `src/settings/reset.ts:7-12` gardent : `servers`,
`defaultServerId`, `setupDone`, `historyEnabled`, `autostart`, `language`.
Tests Rust à écrire : 0.5 deux profils distincts ; `fast` = `quality` ; valeurs d'usine seules ; `mode: fast` ;
clé DPAPI relue ; fichier 0.3/0.4 (les tests `settings.rs:347-532` s'adaptent) ; sauvegarde `.bak` écrite une fois.

### 1.4 Tous les usages de `Mode` / `profiles` et leur remplacement

Rust :

| Fichier:ligne | Aujourd'hui | Devient |
|---|---|---|
| `types.rs:8-11` | `enum Mode` | supprimé |
| `types.rs:365` | `Replay.mode` | `server_id: String` |
| `types.rs:453, 489, 494-548` | `Settings.mode`, `.profiles`, défauts, `profile(mode)` | §1.1 |
| `types.rs:556` | `TranslationRequest.mode` | `server_id: String` |
| `types.rs:589` | `HistoryEntry.mode` | `server: String` (hôte affiché, peut être vide) |
| `types.rs:675` | `CompletedResult.mode` | `server_id: String` |
| `actions.rs:1, 52` | `ExecutionInfo.mode` | `server_id: String` |
| `actions.rs:60, 80` | `Execution.profiles` (figés à la capture) | `servers: Vec<Server>` figés de même |
| `actions.rs:465-468` | test du gel | adapté |
| `settings.rs:27, 67, 93-112, 133, 153, 169-184, 187, 208, 262-271, 295-308` | lecture, écriture, reset, validation | §1.2, §1.3 |
| `lib.rs:376, 513, 538` | clés retirées hors fenêtre `settings` | clés données aux fenêtres `settings` **et** `setup` seulement |
| `lib.rs:713` | `Replay { mode }` (« Revoir » de la zone de notification) | `server_id` du résultat |
| `lib.rs:974-976` | profil pris par `request.mode` | `run.servers` par `request.server_id` ; la première demande doit viser `run.info.server_id` |
| `lib.rs:1092, 1102` | `mode` du résultat et de l'historique | `server_id` ; historique : hôte du serveur |
| `lib.rs:1538-1544` | `settings_field` accepte `quality.` / `fast.` | accepte `<idServeur>.<champ>` pour un serveur existant |
| `lib.rs:1913-1937` | `check_connection(mode)` | **supprimée**, remplacée par `probe_connection` (§2) |
| `lib.rs:1916, 2586` | divers, tests | adaptés |
| `history.rs:3, 64, 109, 132-142, 161, 172` | colonne `mode` = `fast`/`quality` | même colonne `mode TEXT` (pas de migration de schéma) : on y écrit l'hôte ; à la lecture `fast`/`quality` → `server = ""` |
| `inference.rs:110, 450-486` | `Profile` ; `check()` 5 s | `Server` ; `check()` supprimée (sonde §2) |

Front :

| Fichier:ligne | Devient |
|---|---|
| `types.ts:1, 8, 30, 52-58, 77-80` | §1.1 ; `Replay.serverId`, `HistoryEntry.server`, `TranslationRequest.serverId`, `ExecutionInfo.serverId`, `SettingsField = 'menuShortcut' \| ProfileField \| \`${string}.${ProfileField}\`` |
| `bridge.ts:5, 11-14, 25, 54, 88-92, 181` | défauts à un serveur, démo, `checkConnection` supprimé |
| `reducer.ts:1, 8, 29, 36, 57` (+ `reducer.test.ts`) | `serverId: string \| null` |
| `useTranslation.ts:8, 70-74` | `forced?: { serverId?: string }` ; défaut = `capture.execution.serverId ?? settings.defaultServerId` |
| `GlassOverlay.tsx:508` (bulle 0.4) | « Relancer avec {server} » : visible seulement avec ≥ 2 serveurs, vise le serveur suivant ; clé `menu.rerun` param `{server}` |
| `menu/IlotStage.tsx:624` | `serverId: state.serverId`, `model` du serveur correspondant |
| `result/ResultPill.tsx:10, 72, 196, 250`, `result/errors.ts:2, 116-126` | `mode` → `serverId` ; l'action ouvre `\`${serverId}.${field}\`` |
| `settings/fields.ts:1-23` (+ test) | `FieldId = 'menuShortcut' \| \`${string}.${ProfileField}\`` ; champ nu = serveur par défaut ; `pageOfField` (stash 1) |
| `settings/reset.ts:10` | §1.3 |
| `App.tsx:24, 35, 47, 125-126, 136-139, 197-229, 263-275, 281` | tout part avec la nouvelle fenêtre (§4) |
| `i18n.ts:102-103` (`mode.quality`, `mode.fast`), `i18n.test.ts:12` | supprimés / adaptés |
| `result/errors.test.ts:48-51`, `settings/fields.test.ts:8-12` | adaptés |
| `e2e/native-fixture.ts:11-12, 175`, `e2e/ilot-result.pw.ts:92-95, 191, 217`, `e2e/native-bridge.pw.ts:298, 326, 339, 341`, `e2e/result.pw.ts:235`, `e2e/settings-window.pw.ts:329-402`, `e2e/working-pill.pw.ts:191` | adaptés (§4.4) |

La zone de notification n'a pas de « relancer en mode » (ses entrées : Revoir, Réglages, Quitter,
`tray_text.rs:41-47`) : seul « Revoir » porte l'ancien `mode`, via `Replay`.

---

## 2. Commandes Tauri et événements

Toutes les commandes de connexion et de setup vérifient `window.label()` ∈ {`settings`, `setup`} (sinon
`Err("Fenêtre inattendue.")`). Types partagés dans `src/types.ts`, miroir serde `camelCase` dans `types.rs`.
Rust n'envoie **aucune phrase** : des codes, traduits par le front (EN + FR).

```ts
export type ProbeStepId = 'address' | 'reach' | 'key' | 'models';
export type StepState = 'waiting' | 'running' | 'ok' | 'error' | 'skipped';
export type StepDetail =            // ce que la ligne dit quand elle réussit
  | { code: 'found' | 'local'; host: string }          // Adresse
  | { code: 'tls' | 'http_local' | 'http_insecure' }   // Connexion
  | { code: 'key_accepted'; tail: string } | { code: 'key_none' | 'key_not_asked' }
  | { code: 'models'; count: number };
export type ProbeStep = { id: ProbeStepId; state: StepState; ms?: number; detail?: StepDetail };
export type ProbeCause =
  | 'address.empty' | 'address.malformed' | 'address.scheme' | 'address.credentials' | 'address.dns'
  | 'reach.refused' | 'reach.timeout' | 'reach.tls' | 'reach.network'
  | 'key.required' | 'key.rejected'
  | 'models.notfound' | 'models.empty' | 'models.invalid' | 'models.server'
  | 'try.model' | 'try.rejected' | 'try.server' | 'try.timeout' | 'try.empty' | 'cancelled';
export type ProbeProblem = { step: ProbeStepId | 'try'; cause: ProbeCause; status?: number; technical?: string; logId?: number };
export type ModelInfo = { id: string; ownedBy?: string };
export type ProbeResult = { run: string; ok: boolean; endpoint: NormalizedEndpoint; steps: ProbeStep[]; models: ModelInfo[]; problem?: ProbeProblem; totalMs: number };
export type TryResult = { run: string; ok: true; reply: string; ms: number } | { run: string; ok: false; problem: ProbeProblem };
export type DiagStep = ProbeStepId | 'try' | 'request' | 'app';
export type DiagEntry = { id: number; at: string; run?: string; step: DiagStep; level: 'ok' | 'info' | 'error';
  method?: 'GET' | 'POST'; url?: string; status?: number; ms?: number; code: string; cause?: string; proxy?: string };
```

| Commande (Rust) | Appel TS (`bridge.ts`) | Rôle |
|---|---|---|
| `async fn probe_connection(app: AppHandle, window: WebviewWindow, state: State<'_, AppState>, run: String, endpoint: String, api_key: String, no_key: bool) -> Result<ProbeResult, String>` | `probeConnection(run, endpoint, apiKey, noKey): Promise<ProbeResult>` | Les 4 étapes. Chaque changement émet `probe-step` vers la fenêtre appelante. Sonde ce qui est **tapé**, pas ce qui est enregistré. |
| `fn cancel_probe(state, run: String)` | `cancelProbe(run): Promise<void>` | Annule sonde ou essai (jeton par `run`). Une nouvelle sonde de la même fenêtre annule l'ancienne côté Rust aussi. |
| `async fn list_models(window, state, server_id: String) -> Result<Vec<ModelInfo>, ProbeProblem>` | `listModels(serverId): Promise<ModelInfo[]>` | Relit `/v1/models` d'un serveur **enregistré** (sa clé), sans trace : rafraîchir la liste à l'ouverture du sélecteur. |
| `async fn try_model(window, state, run: String, endpoint: String, api_key: String, no_key: bool, model: String) -> Result<TryResult, String>` | `tryModel(run, endpoint, apiKey, noKey, model): Promise<TryResult>` | « Essayer avec une phrase » : phrase fixe et synthétique (stash 0, `probe.ts` `trySentence`), 60 jetons, 30 s. La réponse est rendue (200 caractères au plus), jamais journalisée. |
| `fn get_diagnostics(window, state) -> Result<Vec<DiagEntry>, String>` | `getDiagnostics(): Promise<DiagEntry[]>` | Les 500 dernières, la plus ancienne d'abord. |
| `fn clear_diagnostics(window, state) -> Result<(), String>` | `clearDiagnostics(): Promise<void>` | Vide la mémoire et le fichier. |
| `fn open_setup(app: AppHandle, replay: Option<bool>) -> Result<(), String>` | `openSetup(replay?: boolean): Promise<void>` | Crée ou montre la fenêtre `setup`. `replay` (« Revoir l'accueil ») ne remet pas `setupDone` à faux. |
| `fn finish_setup(app, window, state, open_settings: bool) -> Result<(), String>` | `finishSetup(openSettings: boolean): Promise<void>` | `setupDone = true`, enregistre, émet `settings-changed`, ferme `setup`, ouvre les Réglages si demandé. |
| `fn open_demo(app, window) -> Result<(), String>` / `fn close_demo(app, window, done: bool) -> Result<(), String>` | `openDemo()` / `closeDemo(done)` | Fenêtre `demo` (§3) : cache `setup`, joue ; à la fermeture remontre `setup` et lui émet `demo-ended { done }`. |
| `fn open_settings(app, field: Option<String>, page: Option<String>)` (existe, `lib.rs:1547`) | `openSettings(field?, page?)` | `page` ∈ ids du §4.1 ; émet `settings-focus-field { field?, page? }`. |

L'**état du setup** n'a pas de commande à part : c'est `settings.setupDone` (lu par `get_settings`), plus
`?replay=1` dans l'URL de la fenêtre. Fermer le setup avant la fin ne change rien : il se rouvre au prochain
lancement et au clic sur l'icône de la zone de notification.

Événements (ajouter à `EventName`, `bridge.ts:8`) :

| Événement | Charge | Vers |
|---|---|---|
| `probe-step` | `{ run: string; steps: ProbeStep[] }` | la fenêtre qui a lancé la sonde |
| `diagnostic` | `DiagEntry` | `settings`, `setup` |
| `demo-ended` | `{ done: boolean }` | `setup` |
| `settings-focus-field` (existe) | `{ field?: SettingsField; page?: string }` | `settings` |
| `backdrop` (si l'essai §6.1 est retenu) | `{ captureId: string; x: number; y: number; width: number; height: number; image: string }` | `overlay` |
| `halo` (existe) | `HaloEvent` + `masks?: { rect: Rect; image: string }[]` + `style?: ChangedWordsStyle` (phase `marks`) | `halo` |

### 2.1 La sonde (Rust, nouveau `src-tauri/src/probe.rs`)

- **Adresse** : `normalize_endpoint`, puis résolution du nom (`tokio::net::lookup_host`, 5 s) → `found`/`local`
  ou `address.dns`. **Connexion** : TCP (+ TLS schannel, le client `native-tls` de la 0.5.1) → `tls`,
  `http_local`, `http_insecure`, ou `reach.refused|timeout|tls|network` (réutiliser `inference::cause`,
  `tls_cause`, `os_cause`, `inference.rs:359-420`). **Clé** et **Modèles** : un seul `GET {base}/v1/models`
  (Bearer si clé) : 401/403 → `key.rejected` (clé envoyée) ou `key.required` ; 404/405 → `models.notfound` ;
  5xx → `models.server` ; corps sans `data[]` → `models.invalid` ; `data: []` → `models.empty`.
- Délais : connexion 5 s, **total 10 s** (aujourd'hui 5 s, `inference.rs:454`). Redirections refusées.
- `technical` : le texte de l'erreur système, **jamais le corps de la réponse**, passé par un `redact`.
- Chaque étape écrit une `DiagEntry` (même `run`). Les demandes réelles (`inference::stream`) en écrivent une
  aussi (`step: 'request'`, `POST …/v1/chat/completions`, statut, durée, cause), sans aucun texte.

### 2.2 Le journal (Rust, nouveau `src-tauri/src/diagnostics.rs`)

Tampon circulaire de 500 `DiagEntry` dans `AppState`, écrit aussi dans `<dossier de données>/logs/diagnostic.log`
(une ligne JSON par entrée, rotation à 1 Mo). URL toujours sans requête ni fragment ; `proxy` : `"system:
<hôte>"` quand reqwest passe par le proxy système, sinon absent. Test Rust obligatoire : aucune entrée ne
contient une clé donnée en entrée, quelle que soit l'erreur.

### 2.3 Aperçu navigateur (`src/bridge.mock.ts`, nouveau)

`bridge.ts` délègue hors Tauri à ce module : serveur simulé du labo (`mock/server.js`, scénarios `ok`,
`cle-requise`, `cle-refusee`, `pas-d-api`, `refuse`, `delai`, `certificat`, `dns`, `vide`, `lent`) choisi par
`?conn=`, qui émet `probe-step` et `diagnostic` avec les mêmes types. Les tests e2e et les captures s'en servent.

---

## 3. Fenêtres

| Label | URL | Taille | Matière | Cadre | Création |
|---|---|---|---|---|---|
| `settings` | `/?window=settings` | **860 × 600**, min 720 × 480, redimensionnable, centrée | mate, `transparent: false` | `decorations: false`, barre de titre maison 32 px (réduire, fermer ; glisser = `drag_settings`) | au démarrage, cachée (`tauri.conf.json:47-60` : seules `width`, `height`, `minWidth`, `minHeight` changent) |
| `setup` | `/?window=setup` (`&replay=1`) | **620 × 720**, fixe, centrée ; réduite à la zone de travail si l'écran est plus petit (contenu défilant, labo `ScrollArea`) | **verre** : `transparent: true`, `shadow: true`, effet Acrylic de Windows (`set_effects`), coins arrondis par DWM ; repli opaque (`--ft-win-bg`) quand `backdrop::fallback` dit que Windows ne peut pas (`backdrop.rs:47-60`), signalé par `data-backdrop="native" \| "painted"` sur `<html>` | `decorations: false`, bouton fermer, glissable | **à la demande** par `open_setup` (`WebviewWindowBuilder`), détruite à la fermeture (pas de WebView en plus après le premier lancement) |
| `demo` | `/?window=setup&stage=demo` | 900 × 740 (labo `Journey.jsx:411`), bornée à la zone de travail, centrée | transparente, **sans effet** : la fenêtre de courrier et les calques sont dans la page, donc `backdrop-filter` y floute vraiment | `decorations: false`, `shadow: false`, `skipTaskbar: true` | à la demande par `open_demo`, détruite par `close_demo` |
| `overlay`, `halo` | inchangées | | §6.1 | | |

Quand le setup s'ouvre : au démarrage si `!setupDone` (sauf `--demo*`, `--settings`, ou
`FLOWTRANSLATE_SKIP_SETUP=1` pour les tests) ; clic sur l'icône ou seconde instance si `!setupDone`
(`lib.rs:2279-2281`, sinon Réglages) ; « Revoir l'accueil ». Un raccourci pressé pendant que `setup` ou `demo`
est devant : même refus que pour les Réglages (`settings_open`, `lib.rs:775`) ; ajouter les deux labels à
`ours()` (`lib.rs:741`). Capacités (`src-tauri/capabilities/default.json`) : ajouter `setup` et `demo`,
`core:window:allow-start-dragging`, `allow-minimize`, `allow-set-title`.
Sorties : Échap dans le setup = Retour (jamais fermer par surprise), la croix ferme ; Échap dans la démo = passer ;
la démo a un chien de garde (60 s sans fin → `close_demo(false)`).

---

## 4. Front : carte des fichiers

### 4.1 Du labo vers l'app

Portage **fidèle** : mêmes jetons, tailles, ressorts, textes. Le JSX du labo devient du TSX typé ; ce qui est
propre au labo (Vote, LabPanel, barre, vitesse, `Stage`, HeroUI, shadcn/Tailwind) ne vient pas.

| Labo (`design-lab/reglages/src/`) | App | Notes |
|---|---|---|
| `tokens/tokens.css`, `tokens/palettes.js` | `src/components/tokens.css` (généré par `scripts/gen-ft-tokens.mjs` depuis `palettes.js`, puis commité) | Base **Porcelaine & lavande** seule, jeu de pages **A**, clair + sombre. Sélecteurs : `:root`, `:root[data-theme="dark"]`, `[data-ft-page="…"]`. Ids de page de l'app : `general, shortcuts, actions, after, appearance, server, data, diagnostic` (labo : `raccourcis, apres, apparence, serveur, donnees`). |
| `ui/index.jsx`, `ui/ui.css` | `src/components/controls.tsx` + `controls.css` (existent, 148 lignes, à compléter), `src/components/nav.tsx` (Tabs à pastille qui glisse, `NAV_GLIDE` = ressort 0,46 s rebond 0,14 délai 35 ms), `src/components/scroll.tsx` (`ScrollArea` fine) | Manquent : `IconButton`, `Spinner`, `Tooltip`, `Popover`, `Segmented`, `PageHeader`, `Keycap`, `KeyCombo`, `Dialog`, `Notice`, `MiddleEllipsis`, `Row.icon`. `Switch` = le nôtre (ressort W11). `Combobox` façon HeroUI (≤ 480 px, recherche pleine largeur). `Slider` aspect shadcn. Pas de HeroUI ni de Tailwind dans l'app. |
| `lib/motion.js` | `src/components/motion.ts` | `SPRINGS` (`smooth .4/0`, `bouncy .4/.3`, `snappy .28/.12`, `gentle .6/0`, `window .42/.08`) et `useTx()` branché sur `useReducedMotionSetting` (`src/motion/MotionPreferences.tsx`). Pas de vitesse de labo. |
| `stage/Desktop.jsx` (`AppMark`, `.ft-heartbeat`) | `src/components/AppMark.tsx` | Le point irisé ; remplace le SVG de `App.tsx:232`. |
| `settings/SettingsWindow.jsx`, `settings.css` | `src/settings/SettingsWindow.tsx`, `settings.css`, `nav.ts`, `search.ts`, `useSettingsStore.ts` | La logique d'enregistrement de `App.tsx:41-229` (file d'attente, 300 ms, écho `settings-changed`, raccourcis, reset) sort telle quelle dans `useSettingsStore.ts`. Diagnostic : **Ctrl+Maj+M** (`code === 'KeyM'`, pas pendant un enregistrement de raccourci) ou 5 clics sur la version. Un seul toast, remplacé en place. |
| `settings/pages/*.jsx` | `src/settings/pages/{General,Shortcuts,Actions,After,Appearance,Server,Data,Diagnostic}.tsx` | Réutilisent la logique existante : `MenuSettings`, `MenuGrid`, `ShortcutRecorder`, `AfterReplace`, `ResetSettings`, `src/ActionSettings.tsx`, `AnimationsSetting.tsx` (habillage `Group`/`Row`). `After` : « Mots changés » gagne le style **Encre irisée / Éclat**. |
| `connection/Connection.jsx`, `connection.css` | `src/connection/ConnectionForm.tsx` (props déjà posées, `ConnectionValue` gagne `noKey`), `Check.tsx` (`useProbe`, `useCheck`, `CheckLine`, `CheckTrace`, `ProbeTrace`, `InsecureNotice`), `connection.css`, `endpoint.ts`, `causes.ts` (cause → clés de titre et de geste) | Vérification 600 ms après la dernière frappe ; trace tenue 900 ms puis repliée ; ouverte sur l'étape fautive ; hauteur gardée pendant « Vérifier à nouveau ». |
| `settings/pages/Diagnostic.jsx`, `journey/screens.jsx` (`LogSheet`) | `src/connection/DiagnosticsPanel.tsx`, `diagnostics.ts` (store : `getDiagnostics` + événement, filtre Tout / Erreurs, copie texte) | Utilisé par la page Diagnostic (A) et la feuille « Journal » du setup (B). |
| `journey/Journey.jsx`, `screens.jsx`, `variants.jsx`, `journey.css` | `src/setup/SetupWindow.tsx`, `screens.tsx`, `setup.css`, `model.ts`, `useSetupSettings.ts` | Étapes `welcome → apparence → raccourci → modele → demo → pret`. Transition « Fondu et échelle », battement + anneau, verrou de navigation 300 ms, Entrée = bouton principal, Échap = Retour. `Installer.jsx` ne vient pas (c'est NSIS). Chaque réponse est enregistrée tout de suite dans les vrais réglages. |
| `demo/Demo.jsx`, `timeline.js`, `demo.css`, `app-theme.css` | `src/demo/Demo.tsx`, `script.ts`, `Cursor.tsx`, `PhaseRail.tsx`, `selection.ts`, `demo.css`, `messages.i18n.ts` | §4.2. |
| `effects/`, `catalog/`, `lab/`, `heroui/`, `mock/` | rien (le serveur simulé va dans `src/bridge.mock.ts`) | |

Supprimés à la fin : la partie Réglages de `src/styles.css`, `SettingSwitch` de `src/ui.tsx:81-86`, les clés
`settings.*` devenues orphelines, `src/settings/pages/messages.i18n.ts` actuel remplacé.

### 4.2 La démo (agent B)

- **Les vrais composants.** La démo rend `IlotView`, le contenu de `ResultPill` (`resultContent`), `WorkingPill`,
  `MorphSurface` et `HaloView`, avec les vrais réglages (indicateur, ressort, noms et lettres des actions, langue,
  style des mots changés). L'agent C exporte en premier les vues sans pont : `IlotView` (depuis
  `menu/Ilot.tsx`) et `HaloView({ event })` (depuis `halo/HaloWindow.tsx`, l'écoute du pont reste dans
  `HaloWindow`). La démo ne redessine rien et ne recopie aucune valeur.
- **Script** : `script.ts` reprend les instants `T` de `timeline.js:25-46` ; il pilote des états (pas des pixels),
  avec un `AbortController` : fermer, passer ou rejouer annule tout. Commandes : Pause / Lecture, Revoir, Passer.
  Mouvement réduit : le diaporama des 9 états (`SLIDES`, `timeline.js:67`).
- **Phases visibles** (demande de Lucas du 01/10) : `PhaseRail` = une frise de segments numérotés, le segment
  courant se remplit de 0 à 1 pendant sa phase, sa légende est affichée (« n / N · texte ») ; chaque changement
  de phase marque un temps (≈ 250 ms) et un fondu de légende. Phases : 0 « Tout est prêt. Regardez comment ça
  marche. » (affichage seul) · 1 Sélectionner · 2 Raccourci · 3 Choisir une action · 4 Le modèle travaille ·
  5 Texte remplacé, mots changés · 6 Un clic, les marques s'en vont (`CHAPTERS`, `timeline.js:53-61`).
- **Sélection en diagonale** (remplace le mot à mot de `timeline.js:29` et `Demo.jsx:187-218`) : le curseur
  (barre en I) appuie au début du texte, puis va **en ligne droite** jusqu'à la fin de la dernière ligne
  (≈ 1,2 s, courbe `minJerk`). À chaque image, la sélection est celle que Windows ferait : du point d'appui
  jusqu'au caractère sous le curseur (`document.caretPositionFromPoint`, repli `caretRangeFromPoint`), rendue
  par les rectangles de `Range.getClientRects()` fusionnés par ligne. Donc : la première ligne se remplit
  jusqu'au curseur ; dès qu'il passe sur la ligne suivante, la première se complète d'un coup et la suivante
  s'arrête sous lui. Jamais ligne après ligne. Test unitaire sur `selection.ts` (géométrie simulée).
- Curseur : flèche Windows, lueur qui suit son contour (labo), flèche ↔ barre en I sans fondu.

### 4.3 i18n (EN + FR)

- Un dictionnaire par zone, fusionné dans `src/i18n.ts:3-5, 12-14` : `src/settings/pages/messages.i18n.ts`
  (préfixes `page.*`, `nav.*`), `src/connection/messages.i18n.ts` (`conn.*`, `conn.cause.<cause>.title|fix`,
  `diag.*`), `src/setup/messages.i18n.ts` (`setup.*`), `src/demo/messages.i18n.ts` (`demo2.*` ; `demo.*` est
  pris par l'ancien aperçu), `src/components/messages.i18n.ts` (`ui.*` : libellés ARIA des primitives).
- **FR = le texte du labo, mot pour mot.** EN écrit par le propriétaire de la zone, même ton, « you ».
- Le nom : `{app}` partout. À corriger dans l'existant : `i18n.ts:50, 96, 129, 138, 180, 259, 291`,
  `App.tsx:233, 308`, `tray_text.rs:25-37`, `lib.rs:2114`, `tauri.conf.json:3, 18, 35, 50`, `index.html:7`.
- Nombres et durées par `Intl` dans la langue de l'interface (le labo écrit `toLocaleString('fr-FR')` en dur).
- Tests (`i18n.test.ts`) : chaque clé a EN et FR non vides ; aucune valeur ne contient `appName` ; chaque
  `ProbeCause` a son titre et son geste.

### 4.4 Tests

**Vitest** (CI Ubuntu, `npm test`) : `connection/endpoint.test.ts` (vecteurs communs) ; `connection/check.test.ts`
(ouverture / repli de la trace, `run` périmé ignoré, double « Vérifier à nouveau ») ; `connection/diagnostics.test.ts`
(aucune clé dans le texte copié) ; `settings/nav.test.ts` (Ctrl+Maj+M, 5 clics, repli sur Général) ;
`settings/search.test.ts` ; `settings/servers.test.ts` (ajout, retrait, défaut) ; `setup/model.test.ts` ;
`demo/selection.test.ts` ; `demo/script.test.ts` (annulation à tout instant, phases dans l'ordre). Adaptés :
`reducer.test.ts`, `settings/fields.test.ts`, `result/errors.test.ts`, `i18n.test.ts`, `bridge.test.ts`,
`preferences.test.ts`, `settings/MenuGrid.test.tsx`, `menu/Ilot.test.tsx`, `result/ResultPill.test.tsx`.

**cargo test** (CI Windows) : migration (§1.3), `normalize_endpoint`, validation des serveurs, `probe.rs` contre
des serveurs factices 127.0.0.1 (200, 401, 404, liste vide, port fermé, silence > délai, annulation),
`diagnostics.rs` (tampon, rotation, pas de clé), gel des serveurs à la capture.

**Playwright e2e** (`playwright.config.ts`, dossier `e2e/`, lancé par la CI Ubuntu : `npx playwright test`,
Vite démarré par la config) :
- `e2e/settings-window.pw.ts` : **réécrit** (barre latérale, pages, recherche, Diagnostic caché, serveur :
  trace, repli, erreur, « Voir le journal », second serveur, serveur par défaut, enregistrement).
- nouveaux `e2e/setup.pw.ts` (parcours complet, Passer, Retour, double clic et Entrée tenue = une seule étape,
  Échap, modèle non vérifié = bouton inactif, fermeture puis reprise), `e2e/demo.pw.ts` (phases, sélection
  diagonale multi-lignes à mi-course, Passer et Revoir en pleine animation, mouvement réduit),
  `e2e/connection.pw.ts` (les 10 scénarios `?conn=`, changement d'adresse pendant une sonde).
- adaptés : `native-fixture.ts`, `native-bridge.pw.ts`, `ilot-result.pw.ts`, `result.pw.ts`,
  `working-pill.pw.ts`, `halo.pw.ts` (marques encre / éclat), `theme-language.pw.ts`.

**Références visuelles** (`playwright.visual.config.ts`, `visual-tests/`, images `references/win32/chromium/` :
**la CI ne les lance pas**, elles se vérifient et se régénèrent sur Windows, `npm run ui:check`) :
- à régénérer après examen attendu / réel / différence : `settings*` (jeux `@v4` et `@ilot`,
  `states.spec.ts:41` « settings at narrow width » passe à 720 px), `halo-marks*` (encre, + un jeu éclat),
  et toutes les images de l'Îlot, des pilules et de la bulle **si** le verre change (§6.1) ;
- à ajouter (scénarios dans `src/lab/scenarios.ts`) : `settings-<page>` × 8 × clair / sombre, `server-checking`,
  `server-error`, `setup-<étape>` × 6 × 2, `demo-phase-<n>` × 7 (mouvement réduit) ;
- commande : `npm run ui:reference -- --grep "<nom>"`, jamais un `--update-snapshots` global sans regarder.

---

## 5. Propriété des fichiers

| Agent | Possède |
|---|---|
| **Native** | `src-tauri/**` (dont `probe.rs`, `diagnostics.rs`, `brand.rs`, `tauri.conf.json`, `capabilities/`), `src/types.ts`, `src/bridge.ts`, `src/bridge.mock.ts`, `src/bridge.test.ts`, `src/reducer.ts` (+ test), `src/useTranslation.ts`, `src/actionDefaults.ts` (+ test), `e2e/native-fixture.ts`, `e2e/native-bridge.pw.ts`, `src/connection/endpoint.vectors.json`, `docs/BRIDGE.md` |
| **A** (Réglages) | `src/settings/**`, `src/components/**`, `src/connection/**` (sauf le fichier de vecteurs), `src/App.tsx`, `src/main.tsx`, `src/i18n.ts` (+ test), `src/styles.css`, `src/ActionSettings.tsx`, `src/AnimationsSetting.tsx`, `src/brand.ts`, `src/useSettings.ts`, `src/preferences.ts`, `scripts/gen-ft-tokens.mjs`, `e2e/settings-window.pw.ts`, `e2e/connection.pw.ts`, `e2e/theme-language.pw.ts` |
| **B** (Setup, démo) | `src/setup/**`, `src/demo/**`, `e2e/setup.pw.ts`, `e2e/demo.pw.ts` |
| **C** (surfaces) | `src/halo/**`, `src/result/**`, `src/menu/**`, `src/loaders/**`, `src/motion/**`, `src/GlassOverlay.tsx`, `src/ui.tsx`, `src/glass.css`, `src/theme.css`, `src/layout.ts`, `src/text.ts`, `e2e/halo.pw.ts`, `e2e/ilot*.pw.ts`, `e2e/result.pw.ts`, `e2e/working-pill.pw.ts`, `e2e/motion.pw.ts`, `e2e/ui.pw.ts`, `e2e/reported-defects.pw.ts` |
| **Intégration** (après A, B, C, Native) | `src/lab/**`, `lab.html`, `visual-tests/**`, `e2e/workbench.pw.ts`, `docs/RELEASE-NOTES.md`, versions (`package.json`, `package-lock.json`, `Cargo.toml`, `Cargo.lock`, `tauri.conf.json` → 0.6.0), `AGENTS.md` |

**Fichiers partagés** (un seul éditeur, les autres demandent dans leur rapport) :

| Fichier | Éditeur | Qui d'autre en dépend |
|---|---|---|
| `src/types.ts`, `src/bridge.ts` | Native | tous. Un type manquant se demande, ne s'ajoute pas ailleurs. |
| `src/i18n.ts` | A | B et C n'écrivent que leur `messages.i18n.ts` ; A branche `demo/messages.i18n.ts` et `components/messages.i18n.ts` dès son premier commit. Les clés de l'overlay (`glass.*`, `result.*`, `menu.*`) restent dans `i18n.ts` : C envoie ses changements de clés à A. |
| `src/App.tsx` | A | la route `setup` existe (`App.tsx:352`) ; B lit `stage=demo` dans `SetupWindow`, sans toucher `App.tsx`. |
| `src/components/**` | A | B les importe. Une primitive manquante : B la crée dans `src/setup/` et la signale. |
| `src/connection/**` | A | B importe `ConnectionForm`, `DiagnosticsPanel`. |
| `src/settings/ShortcutRecorder.tsx`, `registrations.ts` | A | B les importe (étape Raccourci). |
| `src/menu/Ilot.tsx`, `src/halo/HaloWindow.tsx`, `src/result/ResultPill.tsx` | C | B importe `IlotView`, `HaloView`, `resultContent` : C les exporte en premier. |
| `src/theme.css`, `src/glass.css` | C | A n'y écrit pas : ses variables sont dans `components/tokens.css`. |
| `src/styles.css` | A | C n'y touche pas (ses styles sont dans `menu/`, `result/`, `halo/`, `glass.css`). |
| `src/ui.tsx` | C | A cesse de l'importer (tout vient de `components/`). |
| `e2e/native-fixture.ts` | Native | tous les e2e. |

**Commit de bascule** (exception unique, par Native, avant que A, B, C ne commencent) : `types.ts`,
`bridge.ts`, `bridge.mock.ts` et les retouches mécaniques `mode → serverId` dans les fichiers des autres
(`reducer.ts`, `useTranslation.ts`, `GlassOverlay.tsx:508`, `IlotStage.tsx:624`, `ResultPill.tsx`, `errors.ts`,
`settings/fields.ts`, `settings/reset.ts`, `App.tsx` section connexion réduite au minimum, tests et
`native-fixture.ts`), de sorte que `npm test`, `npm run build` et `npx playwright test` restent verts.
Après ce commit, chacun reste dans sa zone.

---

## 6. Risques, ordre, décisions

### 6.1 Risques

1. **Vrai flou derrière l'Îlot, les pilules et la bulle.** Une WebView ne floute pas ce qui est derrière sa
   fenêtre ; l'Acrylic natif ne tient que sur une forme immobile (`docs/ACRYLIC-TRIAL.md`, recommandation de
   ne pas le livrer). Piste proposée : Rust lit les pixels de l'écran sous la surface **avant** de la montrer
   (comme `ground.rs:68-100` lit déjà la couleur), les envoie à l'overlay (événement `backdrop`, en mémoire
   seulement, jamais stockés ni journalisés), et la page les floute sous le verre (`filter: blur(28px)
   saturate(…)`, jetons `--ft-float-*`). C'est une photo, pas un flux : à reprendre quand la pilule glisse
   sous le nouveau texte. **Essai borné (Native + C), avec critère** : captures clair / sombre sur fond
   chargé, pendant le changement de forme et après le collage, sans zone fausse visible. Si le critère n'est
   pas tenu : verre peint aux teintes du labo pour l'Îlot et les pilules, vrai flou pour le setup (Acrylic)
   et la démo (CSS) seulement, et **le dire à Lucas** (il a demandé le vrai flou partout pour la 0.6.0).
   Ne pas utiliser `WDA_EXCLUDEFROMCAPTURE` : l'Îlot disparaîtrait des captures et des partages d'écran.
2. **Encre irisée sur le texte d'une autre application.** Le halo est une fenêtre posée sur le texte : pour
   allumer les lettres, Rust lit les pixels des mots changés, en tire un masque (écart à la couleur du fond),
   et la page peint l'encre et la lueur à travers (`mask-image`, `HaloEvent.masks`). À valider sur Word,
   navigateur, VS Code, clair et sombre, ClearType. Sans masque (fond illisible, lecture refusée) : repli sur
   « Éclat » dessiné sans masque (trait fin + halo, aucune case). Les marques partent déjà à la première action.
3. **Acrylic du setup** : sur certaines versions de Windows 11 une fenêtre Acrylic traîne au déplacement.
   Fenêtre fixe et petite ; si la gêne est visible, repli Mica ou opaque. La VM n'a pas de GPU : fluidité et
   qualité du flou **non vérifiables ici**, à faire vérifier par Lucas.
4. **Migration** : fichiers réels de Lucas (0.5.1, deux profils, clé DPAPI). Sauvegarde `.bak`, tests sur
   copies ; ne jamais tester sur son dossier de données (`FLOWTRANSLATE_DATA_DIR`).
5. **http pour tout hôte** : assouplit une règle de sécurité de la 0.5 ; l'avertissement doit être visible
   dans le formulaire, sur la carte du serveur (pastille « http ») et dans le setup.
6. **Démo fidèle** : elle dépend des exports de C ; tant qu'ils manquent, B avance sur le setup.
7. **Arbre partagé** : un `npm run build` rouge chez l'un bloque les captures des autres. Chacun vérifie
   `npx tsc -b` avant de commiter ; le commit de bascule passe d'abord.
8. **Pilule qui chevauche la ligne suivante** (signalé dans le labo) : c'est `placement.rs` / `pill_after_paste`
   (Native) et `result.css` (C) ; à traiter ensemble, avec capture.
9. **Références visuelles Windows seulement** : hors CI. Un oubli de régénération ne casse rien en CI mais
   laisse `npm run ui:check` rouge : c'est la dernière étape d'Intégration.

### 6.2 Ordre

1. **Phase 0, Native seul** : commit de bascule (§5). Puis Rust : types, migration, validation, `probe.rs`,
   `diagnostics.rs`, commandes, fenêtres `setup` / `demo`, langue de Windows au premier lancement.
2. **Phase 1, en parallèle** (aperçu navigateur + `bridge.mock.ts`, sans attendre Rust) :
   - A : `tokens.css` → primitives → `connection/` → `SettingsWindow` et pages → e2e.
   - C : **d'abord** `IlotView` et `HaloView` exportés ; puis marques encre / éclat, centrages, matière du verre.
   - B : setup (questions) → démo dès les exports de C → e2e.
3. **Phase 2, essais natifs** : flou réel (§6.1.1), masque de l'encre (§6.1.2), Acrylic du setup, dans la vraie
   fenêtre (`--simulate-inference`, serveur factice 127.0.0.1), captures `gdigrab`.
4. **Phase 3, Intégration** : atelier et références visuelles, `docs/BRIDGE.md`, notes de version, 0.6.0,
   `npm test`, `npm run build`, `npx playwright test`, `cargo test`, `npm run ui:check`, build NSIS.

### 6.3 Décisions à remonter à Lucas (prises par défaut ici)

- `noKey` ajouté au serveur ; modèle vide permis ; adresse enregistrée sans `/v1`.
- Un utilisateur 0.5 déjà réglé **ne revoit pas** le setup à la mise à jour (« Revoir l'accueil » dans Général).
- Installation neuve : la langue suit Windows (aujourd'hui anglais d'office). Les noms des actions par défaut
  restent ceux de l'app ; la démo affiche les vrais noms des réglages.
- La démo de l'app garde Pause, Revoir, Passer, mais pas le curseur de lecture libre du labo (vrais composants).
- L'interface montre deux serveurs au plus, comme le labo.
- Le flou réel de l'Îlot et des pilules dépend de l'essai §6.1.1 ; le renommage ne touche ni l'identifiant ni
  le dossier de données.

### 6.4 Les deux stash : ce qui se reprend

Ne pas faire `git stash pop` (arbre partagé). Lire avec `git show 'stash@{N}^3:<chemin>'` (fichiers non suivis)
ou `git show 'stash@{N}:<chemin>'` (fichiers suivis), puis recopier dans sa zone.

- **stash@{0}** « connexion partielle » : `src/connection/endpoint.ts` (à reprendre, en changeant deux règles :
  http permis partout, adresse gardée sans `/v1`) ; `log.ts` (`maskKey`, `redact`, `clock`, `toText` → store du
  Diagnostic) ; `probe.ts` (liste des causes, `parseModels`, `parseReply`, `trySentence` → `bridge.mock.ts`
  et modèle pour `probe.rs`) ; `simulate.ts` (scénarios → `bridge.mock.ts`). À laisser : `client.ts` (repli
  `fetch` de la WebView : la sonde est native en 0.6, et la CSP l'interdit).
- **stash@{1}** « réglages/accueil partiels » : `settings/nav.ts` (pages, 5 clics, mémoire du Diagnostic ;
  raccourci à passer de `KeyD` à `KeyM`) ; `settings/fields.ts` (`pageOfField`, `findField`) ;
  `settings/servers.ts` (`hostOf` seulement) ; l'habillage `Group`/`Row` de `ActionSettings`, `AfterReplace`,
  `MenuGrid`, `MenuSettings`, `ResetSettings`, `ShortcutRecorder` ; `ui.tsx` (`SettingSwitch` → `Switch`) ;
  `setup/model.ts` (`primaryBinding`, `withShortcut`, `withShortcutChoice`, `ownsKey`) ; le hook
  `useSetupSettings` de `SetupWindow.tsx`. À laisser : la mise en page du setup (720 × 520, 4 étapes, barre
  de segments, `TourStep` en vignettes), ses textes (ceux du labo v2 font foi), le couple « Serveur 1 /
  Serveur 2 » calqué sur `quality` / `fast`, les clés `settingsv2.*`.
