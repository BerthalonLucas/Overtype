# Overtype en assistant conversationnel : briques techniques

Recherche du 2026-10-10. Lecture seule du repo (0.6.0, branche `refonte-reglages`). Légende : **[CODE]** lu dans le repo ou dans le code d'une lib (chemin, commit), **[ANNONCÉ]** doc ou registre officiel, **[RAPPORTÉ]** retour de terrain tiers, **[DÉDUIT]** mon raisonnement, **[NON VÉRIFIÉ]** pas de source primaire trouvée.

## 0. Principe directeur (réponse à « une techno quelque part et pas ailleurs »)

Une seule règle par couche. Elle découle de ce que le repo fait déjà :

| Couche | Propriétaire unique | Déjà dans le repo |
|---|---|---|
| Réseau (LLM, MCP HTTP, sondes) | Rust, **un seul** `reqwest` + `native-tls` | `inference.rs`, `probe.rs` [CODE] |
| Données persistantes | Rust, **un seul** `rusqlite` bundled, contenu chiffré DPAPI | `history.rs`, `crypto.rs` [CODE] |
| Secrets | Rust, DPAPI | `settings.rs` `api_key_dpapi` [CODE] |
| Natif Windows (capture, OCR, presse-papiers) | Rust, **un seul** crate `windows` (on ajoute des *features*, pas des crates) | `windows 0.62.2`, `uiautomation`, `arboard` [CODE] |
| Boucle d'agent, outils, MCP | Rust | (nouveau) |
| Affichage | React, uniquement via `src/bridge.ts`, événements `emit_to` par label de fenêtre | `lib.rs` `emit_to(...)` [CODE] |

Conséquence : **aucune** lib JS qui parle au réseau, au disque ou au LLM (pas de `@modelcontextprotocol/sdk`, pas de `@tauri-apps/plugin-sql`, pas d'AI SDK côté front). React reçoit un état et le dessine.

---

## 1. Multi-fenêtres Tauri 2

**État du repo [CODE]** : `src-tauri/tauri.conf.json` pré-déclare `overlay`, `halo` (transparentes, `alwaysOnTop`, `skipTaskbar`, `visible:false`) et `settings` ; `lib.rs:2206` et `lib.rs:2304` créent `setup` et `demo` à la demande via `WebviewWindowBuilder`. Les deux patrons existent déjà. Le focus est déjà résolu côté natif : `focus_overlay` attend que la fenêtre soit montrée, l'active, puis vérifie qu'elle a vraiment le premier plan, car Windows peut refuser (docs/BRIDGE.md). Le redimensionnement sans cadre passe par `startResizeDragging('SouthEast')` (BRIDGE.md). Tauri dans le repo : 2.11.5 ; dernière version 2.12.2 (docs.rs, 2026-10-09) [ANNONCÉ].

**API disponibles [ANNONCÉ, docs.rs tauri 2.12.2]** : `WebviewWindowBuilder::{transparent, always_on_top, skip_taskbar, focused, focusable, visible, decorations, resizable, min_inner_size, position, shadow, prevent_overflow, parent, effects}`.

**Recommandations**
- **Barre centrée** : la pré-créer cachée, comme `overlay`, car elle est critique en latence au raccourci et doit prendre le focus. Piste [DÉDUIT] : la faire vivre **dans la fenêtre `overlay` existante** comme un nouvel « étage », plutôt que d'ajouter une 4ᵉ webview résidente. L'overlay est déjà transparente et au premier plan, a déjà la logique `focus_overlay`, le hook clavier et l'anti-raccourcis navigateur (`src/menu/keys.ts`). À arbitrer : la placement/hit-test de l'overlay est taillé pour l'Îlot près de la sélection.
- **Panneau de chat** : fenêtre `chat` **créée à la première ouverture, puis cachée** (pas détruite) ; détruite après N minutes d'inactivité si la mesure mémoire le justifie. `decorations:false`, `transparent:true`, `resizable:true`, `min_inner_size`, ancrage par calcul dans `placement.rs` (zone de travail du moniteur, coin bas-droit). Agrandissement = changement de taille côté Rust, pas une 2ᵉ fenêtre.
- **Taille mémorisée** : la stocker dans `settings.json` (ou un `chat-window.json` écrit par fichier temporaire puis renommage, comme `menu-memory.json`) **plutôt que** `tauri-plugin-window-state` (2.5.0, 2026-09-26 [ANNONCÉ]). Le plugin sauve position et taille de toutes les fenêtres, alors qu'ici la position est recalculée (coin du moniteur courant) et que seule la taille compte. Le repo calcule déjà toutes ses positions lui-même (`placement.rs`) [DÉDUIT].
- **Barre des tâches** : décision produit pour Lucas. `skip_taskbar(true)` est cohérent avec les autres surfaces et l'icône de tray. `false` rend le chat trouvable par Alt+Tab, mais il reste `alwaysOnTop`/sans cadre, ce qui est inhabituel. Je recommande `skip_taskbar(true)` + entrée de tray « Ouvrir le chat » + raccourci.
- **Glisser-déposer** : écouter `WindowEvent::DragDrop` **côté Rust** (`tauri-2.11.5/src/manager/window.rs:198`, `DragDropEvent::Enter{paths,..}` [CODE]). Le front n'affiche que l'état « survol/déposé ». Le fichier n'est jamais lu par la webview. Bug ouvert : `dragDropEnabled` est ignoré quand la fenêtre est créée via `WebviewWindowBuilder` en Rust (tauri#13761, ouvert depuis 2025-07-03, toujours ouvert le 2026-10-10) [RAPPORTÉ]. La méthode `drag_and_drop(bool)` existe (`webview_window.rs:718`) [CODE]. Si le bug gêne, déclarer `chat` dans `tauri.conf.json` puis la créer via `from_config`, comme `lib.rs:3263`.
- **Coût mémoire WebView2** : toutes les webviews d'une app partagent un dossier de données utilisateur, donc **un seul processus navigateur + GPU**. Chaque webview ajoute surtout un ou plusieurs renderers, éventuellement partagés selon la Site Isolation (MS Learn « Process model », màj 2026-06-12) [ANNONCÉ]. **Aucun chiffre par fenêtre trouvé, ni dans les docs ni dans le repo (`docs/UI-PERFORMANCE.md` ne mesure pas la mémoire)** [NON VÉRIFIÉ]. À mesurer avec `OpenTaskManagerWindow` ou le Gestionnaire des tâches avant de choisir entre pré-créer et créer à la demande.

## 2. Stockage des conversations

**État [CODE]** : `rusqlite 0.37.0` avec `bundled` ; `history.rs` = SQLite WAL + `secure_delete`, charge utile chiffrée **par ligne** par DPAPI (`crypto::protect`), migrations « à la main » via `PRAGMA table_info`. Dernière version de rusqlite : 0.40.2 (2026-08-08) [ANNONCÉ crates.io]. Le SQLite embarqué compile **déjà FTS5 et JSON1** (`libsqlite3-sys-0.35.0/build.rs:130-133`, `-DSQLITE_ENABLE_FTS5`, `-DSQLITE_ENABLE_JSON1`) [CODE].

| Option | Pour | Contre |
|---|---|---|
| **rusqlite + DPAPI par ligne** (patron actuel) | zéro nouvelle dépendance, cohérent avec `history.rs` | pas de FTS5 sur le contenu chiffré (l'index stockerait le texte en clair) |
| rusqlite `bundled-sqlcipher-vendored-openssl` + clé aléatoire protégée DPAPI | toute la base est chiffrée, donc FTS5 utilisable | compile OpenSSL dans une app qui a choisi SChannel (`native-tls`) : seconde pile crypto, build plus lourd (Perl requis par openssl-src [NON VÉRIFIÉ ici]) |
| Fichiers JSON | simple | pas de requêtes, réécriture complète, pas atomique par message ; incohérent avec `history.rs` |
| `tauri-plugin-sql` (sqlx) | — | SQL depuis le front, 2ᵉ driver SQLite : contraire au principe §0 |

**Recommandation** : **rusqlite (monter en 0.40.x) + DPAPI par ligne**, dans la même base ou une `conversations.sqlite3` à côté de `history.sqlite3`. **Recherche** : titres et métadonnées en clair (titre auto, optionnel), recherche plein texte en déchiffrant et scannant en mémoire, avec une borne. Si Lucas veut une vraie recherche FTS sur le contenu, passer à SQLCipher **pour tout** (historique compris), pas pour une seule table [DÉDUIT].

**Migrations** : `PRAGMA user_version` + une liste ordonnée de scripts SQL dans le code, appliqués dans une transaction (≈30 lignes). Ça généralise ce que fait `history.rs`. Alternative : `rusqlite_migration` 2.6.0, qui exige `rusqlite ^0.40` [ANNONCÉ crates.io] et apporte peu pour une seule base.

**Schéma minimal** (`*_dpapi` = BLOB chiffré) :
```
conversations(id TEXT PK, created_at, updated_at, title_dpapi BLOB NULL, model_profile TEXT, pinned INT, archived INT)
messages(id TEXT PK, conversation_id FK ON DELETE CASCADE, seq INT, role TEXT /* system|user|assistant|tool */,
         created_at, status TEXT /* streaming|done|cancelled|error */, model TEXT, tokens_in INT, tokens_out INT,
         body_dpapi BLOB /* JSON : content parts, tool_calls, tool_call_id, reasoning */)
attachments(id TEXT PK, message_id FK CASCADE, kind TEXT /* image|file|ocr|selection|log */, mime TEXT, name_dpapi BLOB,
            bytes INT, sha256 TEXT, data_dpapi BLOB /* ou chemin d'un fichier chiffré si > 1 Mo */)
captures(id TEXT PK, message_id FK CASCADE, source_process TEXT, captured_at, kind TEXT, text_dpapi BLOB)
tool_runs(id TEXT PK, message_id FK CASCADE, server TEXT, tool TEXT, decision TEXT /* approved|denied|auto */,
          args_dpapi BLOB, result_dpapi BLOB, started_at, ended_at)
INDEX messages(conversation_id, seq)
```
`foreign_keys` est déjà actif par défaut dans le build bundled (`-DSQLITE_DEFAULT_FOREIGN_KEYS=1`) [CODE]. Rétention : reprendre le modèle `prune` de `history.rs`, avec un réglage utilisateur.

## 3. Rendu du chat en React

**État** : aucun rendu markdown dans le repo (`grep` : rien hors Îlot/démo, sans lib markdown) [CODE]. CSP stricte : `script-src 'self'`, sans `wasm-unsafe-eval` (`tauri.conf.json:64`) [CODE]. Pas de Tailwind (CSS maison : `styles.css`, `glass.css`, `theme.css`) [CODE].

| Lib | Version (npm, 2026-10-10) | Constat |
|---|---|---|
| `react-markdown` | 10.1.0 (publiée 2025-03-07, repo actif le 2026-10-03) | stable, n'interprète **pas** le HTML brut par défaut (sauf ajout de `rehype-raw`) [ANNONCÉ] |
| `remark-gfm` | 4.0.1 | tableaux, listes de tâches, barré |
| `streamdown` (Vercel) | 2.7.0 (2026-09-30) | **[CODE vercel/streamdown@8edc648]** `defaultRehypePlugins = { raw: rehypeRaw, sanitize, harden{allowedLinkPrefixes:["*"], allowedImagePrefixes:["*"], allowedProtocols:["*"], allowDataImages:true} }` (`packages/streamdown/index.tsx:396`) : HTML brut **activé** puis assaini, liens et images ouverts. Dépend de `tailwind-merge`, classes Tailwind (README : config `globals.css`) |
| `remend` | 1.4.0, 0 dépendance | sous-paquet de streamdown qui **ferme le markdown incomplet** pendant le flux (gras ou bloc de code ouverts) [ANNONCÉ npm] |
| `shiki` | 4.5.0 (2026-10-01) | embarque `@shikijs/engine-javascript` (pas de WASM, compatible avec la CSP actuelle) et `engine-oniguruma` (WASM, exigerait `wasm-unsafe-eval`) [ANNONCÉ npm deps] |
| `@tanstack/react-virtual` | 3.14.14 | virtualisation si nécessaire |

**Recommandation** : `react-markdown` + `remark-gfm` + `remend` (pré-traitement du texte en cours de flux), **sans** `rehype-raw`, avec `skipHtml`, et une table `components` qui rend avec les primitives existantes (Radix ScrollArea pour les blocs de code, lucide pour les icônes copier). Liens : `urlTransform` limité à `http(s)`/`mailto`, clic intercepté puis ouverture par une commande Rust, jamais de navigation dans la webview. Images markdown **désactivées** (une image distante dans une réponse peut exfiltrer des données par l'URL). Coloration : `shiki` via `shiki/core` + `createJavaScriptRegexEngine`, grammaires chargées à la demande (une douzaine), appliquée **uniquement aux blocs fermés** ; pendant le flux, code en `<pre>` brut. Streamdown écarté : HTML brut par défaut, liens et images grands ouverts, couplage Tailwind ; il ne réutilise pas les composants maison (cf. mémoire « Composants de librairies connues ») [DÉDUIT].

**Longues conversations** : `React.memo` par message terminé (ne se re-parse jamais), seul le message en flux est re-rendu, avec des deltas regroupés à la frame (`requestAnimationFrame`) côté front ou ≈30 ms côté Rust. D'abord `content-visibility: auto` en CSS (zéro dépendance) ; `@tanstack/react-virtual` seulement si une mesure le justifie. Charger les anciens messages par pages depuis Rust.

## 4. Client LLM en Rust

**État [CODE `src-tauri/src/inference.rs`]** : `reqwest 0.12` `native-tls` + `stream` ; `SseDecoder` maison (UTF-8 fragmenté, CRLF, trame tronquée refusée, `[DONE]`) ; annulation par `tokio_util::CancellationToken` + `tokio::select!` ; `ThinkFilter` pour `<think>…</think>` ; repli si le serveur refuse les paramètres étendus ou `chat_template_kwargs` ; codes d'erreur sans le texte du serveur ; tests sur faux serveur, test TLS sur le magasin Windows. **Limites** : un seul `system` + un seul `user` (`request_body(profile, instruction, text, ...)`), pas d'historique, pas d'images, pas de `tools`.

| Option | Version | Points |
|---|---|---|
| **Client maison étendu** | — | garde native-tls/SChannel (CA d'entreprise), les codes d'erreur, les replis et les tests |
| `async-openai` | 0.42.2 (2026-10-10) | `reqwest 0.13`, `rustls` par défaut (`async-openai/Cargo.toml`, main) [CODE] ; types stricts OpenAI |
| `genai` | 0.7.0-rc.4 (pré-version) | `reqwest 0.13`, multi-fournisseurs [ANNONCÉ] |
| `rig-core` | 0.44.0 (2026-10-07), une version mineure par mois environ | cadre d'agent complet, API mouvante [ANNONCÉ] |

**Recommandation : garder le client maison** et l'étendre en un module `llm/`. `ChatRequest{messages: Vec<Message>, tools, tool_choice, response_format, max_tokens}` ; `Message.content` = texte **ou** parties `[{type:"text"},{type:"image_url",image_url:{url:"data:image/png;base64,..."}}]`. Format vLLM vérifié dans `docs/features/multimodal_inputs.md` [CODE vllm@9f1c783]. Accumulation des `delta.tool_calls[i]` (id, name, arguments en fragments). Lecture de `delta.reasoning` **et** `delta.reasoning_content` : vLLM a renommé `reasoning_content` en `reasoning` (`docs/features/reasoning_outputs.md:8`) [CODE vllm@9f1c783], llama.cpp met les pensées dans `reasoning_content` (`--reasoning-format deepseek`, README server) [ANNONCÉ]. Cette divergence entre serveurs est précisément ce qu'un client typé strict gère mal, et que le client maison gère déjà avec `ThinkFilter` [DÉDUIT]. Adopter `async-openai` ferait passer à `reqwest 0.13` + rustls, et le test `windows_refuses_bad_certificates_and_accepts_a_public_one` montre que le choix de SChannel est délibéré [CODE].

**Tool calling côté serveurs**
- **vLLM** (v0.31.0, 2026-10-05) [ANNONCÉ] : `--enable-auto-tool-choice --tool-call-parser <nom>` (+ `--chat-template` si celui du modèle ne gère pas le rôle `tool`). Parseurs : `hermes` (Qwen2.5, QwQ, Hermes), `qwen3_xml` (Qwen3-Coder), `llama3_json`, `llama4_pythonic`, `pythonic`, `mistral`, `openai` (gpt-oss), `granite4`, `deepseek_v3`, `deepseek_v31`, `functiongemma`… et **`gemma4`** (`vllm/tool_parsers/__init__.py:229`) [CODE vllm@9f1c783, 2026-10-10]. `tool_choice` : `auto`, `required` (vllm ≥ 0.8.3), `none`, fonction nommée. `named` et `required` passent par les sorties structurées, donc l'appel est **parsable mais pas forcément pertinent** ; en `auto`, les arguments peuvent être malformés sauf si un outil a `strict:true` ou si le serveur a `--tool-strict-level` (`docs/features/tool_calling.md:200`) [CODE]. Llama 3 : pas d'appels parallèles [ANNONCÉ]. **Le profil `general` de `server/` (Gemma 4 12B, vLLM 0.28.0) n'active pas `--enable-auto-tool-choice`** (`server/README.md`) [CODE]. La présence du parseur `gemma4` en 0.28.0 n'est **pas vérifiée**.
- **llama.cpp server** : `--jinja` **activé par défaut** (`--jinja, --no-jinja … (default: enabled)`, `tools/server/README.md` master, 2026-10-10) [CODE]. Formats natifs : Llama 3.x, Functionary, Hermes 2/3, Qwen 2.5, Mistral Nemo, Command R7B, GPT-OSS ; sinon format « Generic », plus gourmand en tokens. `parallel_tool_calls` est désactivé par défaut. Une quantification KV extrême (`-ctk q4_0`) dégrade les appels (`docs/function-calling.md`) [ANNONCÉ]. La doc ne dit rien du streaming des tool calls [NON VÉRIFIÉ].
- **Ollama, LM Studio** : support annoncé par modèle (capacité `tools`, label `tool_use` dans LM Studio 0.3.18) [RAPPORTÉ, recherche ; schéma v1 non lu].
- **Modèles locaux courants** : Qwen2.5/Qwen3, Llama 3.1+, Mistral, gpt-oss, Gemma 4 ont un parseur côté vLLM [CODE]. Qualité réelle sur 4–12B en CPU : **non mesurée** [NON VÉRIFIÉ]. Prévoir un banc d'essai maison, sur le modèle de `server/evaluate.py`.

**Sortie structurée** : envoyer `response_format:{type:"json_schema",json_schema:{name,schema,strict:true}}`, compris par vLLM (`docs/features/structured_outputs.md`) et llama.cpp (`response_format` avec `json_schema`, README server) [CODE/ANNONCÉ]. Les champs `guided_json` etc. sont **supprimés depuis vLLM v0.12.0**, remplacés par `structured_outputs` (`structured_outputs.md:10`) [CODE]. Valider la réponse côté Rust avec `serde` (types fixes) ; `jsonschema` 0.58.6 seulement si des schémas dynamiques (MCP) doivent être validés.

## 5. MCP

**rmcp** (SDK Rust officiel, `modelcontextprotocol/rust-sdk`) : 3.5.1 (2026-10-05), 34 M téléchargements, majeures 1.0.0 (2026-03-03), 2.0.0 (2026-06-29) et 3.0.0 (2026-07-28) [ANNONCÉ crates.io]. Protocole `LATEST = 2026-07-28`, rétrocompatible jusqu'à 2024-11-05 (`crates/rmcp/src/model.rs:169-176`) [CODE rust-sdk@4048ac4]. Features utiles : `client`, `transport-child-process` (stdio), `transport-streamable-http-client-reqwest`, `reqwest-native-tls`, `auth` (OAuth2) (`crates/rmcp/Cargo.toml`) [CODE]. **Il dépend de `reqwest 0.13.2`**, le repo de `0.12` : il faut monter tout le repo en `reqwest 0.13` (0.13.5, 2026-09-08 [ANNONCÉ]) en gardant `native-tls`, sinon deux reqwest cohabitent [DÉDUIT].

**Intérêt** : un seul connecteur générique pour les outils d'entreprise (tickets, wiki, base documentaire) au lieu d'intégrations maison. **Coût** : churn d'API (3 majeures en 5 mois) et surface d'attaque.

**Sécurité, d'après la spec (`/specification/2026-07-28/server/tools`) [ANNONCÉ]** : « there SHOULD always be a human in the loop with the ability to deny tool invocations ». Les clients SHOULD afficher les entrées avant l'appel, confirmer les opérations sensibles, valider les résultats, imposer des timeouts et journaliser. Les annotations (`readOnlyHint`…) sont **non fiables** sauf serveur de confiance. Les noms d'outils doivent être préfixés par le serveur.

**Recommandation** : rmcp en Rust, **client seulement**, derrière la même boucle d'agent (§8).
- Serveurs déclarés dans les réglages par l'utilisateur ou l'admin ; jamais d'installation automatique.
- stdio uniquement pour des exécutables déjà présents sur le poste, sinon HTTP.
- Approbation par outil : `toujours demander` (défaut) / `autoriser pour cette conversation` / `toujours autoriser`, jamais par défaut pour un outil non `readOnly`. Mémorisation à la manière de `menu-memory.json`.
- Carte d'approbation dans la fenêtre de chat : serveur, outil, arguments JSON lisibles, Autoriser/Refuser ; le résultat est tronqué au budget de tokens.
- Résultats d'outils traités comme **non fiables** (injection de prompt) : jamais d'exécution chaînée sans nouvelle approbation.
- Secrets MCP en DPAPI comme les clés API.
- À livrer **après** le chat multi-tours ; pas en v1.

## 6. Contexte capturé

- **OCR** : `Windows.Media.Ocr.OcrEngine` (`TryCreateFromUserProfileLanguages`, `RecognizeAsync(SoftwareBitmap)`, `MaxImageDimension`, `AvailableRecognizerLanguages`), Windows 10 10240+ (MS Learn, màj 2025-11-21) [ANNONCÉ]. Disponible via des **features du crate `windows` déjà présent** : `Media_Ocr`, `Graphics_Imaging`, ainsi que `Storage_Streams` et `Globalization` (nécessaires d'après la doc WinRT ; non relues dans le Cargo.toml du crate) (`windows-0.62.2/Cargo.toml:183,221`) [CODE]. Ça marche sans GPU. Les langues dépendent des packs installés : à vérifier par `AvailableRecognizerLanguages` et à signaler dans l'UI. Capture de région : GDI (`Win32_Graphics_Gdi` déjà activé) ; une sélection de région demande une surface plein écran (réutiliser `halo`/`overlay` ?) [DÉDUIT].
- **Images du presse-papiers vers la vision** : `arboard 3.6.1` a `image-data` **par défaut**, donc le crate `image 0.25.10` est **déjà compilé** en dépendance transitive [CODE registre local]. L'ajouter en dépendance directe à la même version pour redimensionner (≤ 1 568 px de côté, valeur à ajuster par modèle) et encoder en JPEG/PNG, puis envoyer en `data:` URI.
- **Glisser-déposer** : chemins reçus en Rust (§1) ; liste blanche d'extensions ; taille max ; lecture et extraction en Rust.
- **Extraction** :
  - XLSX/ODS : `calamine` 0.36.1 (dépend de `zip ^8.6` et `quick-xml ^0.41`) [ANNONCÉ crates.io].
  - DOCX : **pas** `docx-rs` (orienté écriture) mais `zip` + `quick-xml`, déjà amenés par calamine, avec ≈80 lignes sur `word/document.xml` [DÉDUIT].
  - PDF : `pdf-extract` 0.12.1 (2026-09-16, sur `lopdf ^0.42`) ; alternative `pdf_oxide` 0.3.78, plus jeune [ANNONCÉ]. `Windows.Data.Pdf` (feature `Data_Pdf` présente [CODE]) rend les pages en image : on le garde pour l'OCR des PDF scannés ; il n'offre pas d'extraction de texte [NON VÉRIFIÉ].
  - **Risque fort [CODE `Cargo.toml` `[profile.release] panic = "abort"`]** : un parseur qui panique sur un fichier piégé **tue toute l'app**, et `catch_unwind` ne protège pas. Exécuter l'extraction dans un **sous-processus** du même binaire (`Overtype.exe --extract <chemin>`, sortie JSON sur stdout, timeout, limite mémoire via Job Object). Pas de nouveau runtime [DÉDUIT].
- **Gros logs, budget de tokens** : compter via `POST /tokenize` quand le serveur l'expose, à la racine et pas sous `/v1` : vLLM `vllm/entrypoints/serve/tokenize/api_router.py:36` [CODE], llama.cpp README `POST /tokenize` [ANNONCÉ]. Sinon estimation prudente (≈3 caractères/token). Pipeline Rust déterministe avant le LLM :
  1. dédoublonner les lignes répétées (« ×42 ») ;
  2. garder les lignes ERROR/WARN/exceptions avec ±N lignes de contexte ;
  3. tête et queue ;
  4. tronquer au budget = `contexte max − sortie réservée − historique`.

  Afficher à l'utilisateur ce qui a été coupé. `text-splitter` 0.33.0 seulement si on fait du découpage multi-passes (résumer par morceaux) ; pas nécessaire en v1.

## 7. Registre de modèles et routage

**État [CODE]** : `probe.rs` lit déjà `GET {base}/v1/models` (`parse_models` : id, owned_by ; 500 max) ; les réglages 0.6 ont une liste de 1 à 8 serveurs avec un modèle par serveur et un serveur par défaut (`types.rs:413-425`, `types.rs:508-511`) ; les anciens profils `fast`/`quality` ne sont plus que des restes de migration. *(Corrigé à la relecture, 10/10/2026.)*

**Ce que chaque serveur expose**
- **vLLM** : `ModelCard.max_model_len` dans `/v1/models` (`vllm/entrypoints/serve/engine/protocol.py:112`) [CODE vllm@9f1c783]. Ni vision ni tools.
- **llama.cpp** : `/v1/models` → `architecture.input_modalities` (contient `image` si projecteur), `meta.n_ctx_train`. `GET /props` → `n_ctx` (contexte réel), `modalities`, `chat_template_caps` (README server) [ANNONCÉ].
- **Ollama** : `POST /api/show` → `capabilities` (exemple doc : `["completion","vision"]`) et `<arch>.context_length` (`docs/api.md`) [ANNONCÉ]. La valeur `tools` est absente de l'exemple lu [NON VÉRIFIÉ].
- **LM Studio** : API REST v0 dépréciée (`type: vlm`, `max_context_length`, `loaded_context_length`) ; champs de la v1 non lus [RAPPORTÉ].
- Open WebUI et proxys d'entreprise : inconnu, donc surcharge manuelle.

**Recommandation** : un `ModelRegistry` Rust par serveur, rempli par :
1. `/v1/models` ;
2. des sondes **optionnelles et silencieuses** propres à chaque serveur (`/props`, `/api/show`) ;
3. une **surcharge manuelle** dans les Réglages (contexte, vision, tools).

Le résultat est mis en cache avec la date. Chaque capacité porte une source (`déclarée`, `sondée`, `manuelle`, `inconnue`). Un test actif (« essayer les outils » : 1 requête `tools` + `tool_choice:"required"`) seulement à la demande, comme le bouton d'essai existant de la 0.6.

**Routage** : déterministe et explicable, pas de LLM routeur (coût et latence sur CPU).
- Choix de modèle : par action (l'existant fast/quality), par conversation (sélecteur dans l'en-tête du chat), puis par règles.
- Règles :
  - pièce jointe image → modèle `vision` ;
  - outils activés → modèle `tools` ;
  - tokens estimés > contexte du petit modèle → gros modèle ;
  - sinon modèle par défaut de la surface (barre = rapide, chat = qualité).
- Toujours afficher le modèle utilisé sur chaque message.

## 8. Où vit la boucle d'agent

**Recommandation : en Rust**, dans un module `agent/` (sessions, boucle `LLM → tool_calls → approbation → exécution → LLM`, borne d'itérations, annulation par `CancellationToken`).

Pourquoi :
1. **Secrets** : les clés (DPAPI) et les jetons MCP ne quittent jamais Rust. Le pont garantit déjà « pas de secret ni de contenu dans les erreurs » (BRIDGE.md) [CODE].
2. **Les outils sont natifs** : capture UIA, OCR, presse-papiers, fichiers, MCP via rmcp. Une boucle en TS ferait un aller-retour IPC par outil et exposerait des commandes puissantes à la webview.
3. **Une seule pile réseau** : `reqwest` + native-tls (§0).
4. **Plusieurs fenêtres** : la session vit hors de toute webview. La barre peut lancer une conversation et le chat la reprendre ; une fenêtre cachée ou rechargée ne tue pas le flux. Diffusion via `emit_to`/`emit_filter` vers les labels abonnés. Doc Tauri : les événements sont du JSON et « not designed for low latency or high throughput », les `Channel` sont « fast and ordered » [ANNONCÉ v2.tauri.app/develop/calling-frontend]. Donc un `tauri::ipc::Channel` par fenêtre abonnée pour les deltas (`ipc/channel.rs:49` [CODE]), et des événements pour les changements d'état grossiers.
5. **Testabilité** : le patron `fake_server` d'`inference.rs` s'étend à des scripts de tool calls sans webview ; React se teste avec un adaptateur de démo, comme aujourd'hui (`npm run dev` = adaptateur mémoire, `docs/frontend.md`) [CODE].

Côté TS : uniquement un store qui projette l'état (`conversation`, `messages`, `pendingApproval`) et des commandes typées dans `bridge.ts` (`chat_send`, `chat_cancel`, `chat_approve_tool`, `chat_subscribe`…).

## Nouvelles dépendances proposées (toutes transverses)

| Ajout | Où sert-il | Remplace ou évite |
|---|---|---|
| features `windows` : `Media_Ocr`, `Graphics_Imaging`, `Storage_Streams`, `Globalization`, `Data_Pdf` | OCR (captures, presse-papiers, PDF scannés) | toute lib OCR tierce |
| `image` (déjà dans l'arbre via arboard) | vision : presse-papiers, captures, glisser-déposer | — |
| `calamine`, `pdf-extract` (+ `zip`/`quick-xml` qu'ils amènent) | extraction de fichiers dans le sous-processus | `docx-rs` |
| `rmcp` (client) + montée `reqwest 0.13` | MCP | double reqwest |
| `react-markdown`, `remark-gfm`, `remend`, `shiki` | toutes les surfaces qui affichent une réponse (Îlot compris, à terme) | streamdown, marked |
| upgrade `rusqlite 0.40` | conversations + historique | sqlx / plugin-sql |

## Ce que je n'ai pas pu vérifier
- Coût mémoire réel d'une webview supplémentaire (aucune mesure publique ni dans le repo).
- Existence du parseur `gemma4` dans vLLM **0.28.0** (vérifié seulement sur main 2026-10-10 / v0.31.0) ; qualité réelle du tool calling des modèles 4–12B sur CPU.
- Streaming des tool calls dans llama.cpp (doc muette) ; schéma `/api/v1/models` de LM Studio ; présence de `tools` dans `capabilities` Ollama.
- Absence d'API texte dans `Windows.Data.Pdf` ; prérequis de build de `bundled-sqlcipher-vendored-openssl` sous MSVC.
- Correction de tauri#13761 (toujours ouvert le 2026-10-10).

## Sources principales
- Repo : `src-tauri/Cargo.toml`, `src-tauri/src/{inference,history,crypto,probe,placement,lib}.rs`, `src-tauri/tauri.conf.json`, `docs/BRIDGE.md`, `server/README.md`.
- crates.io API (2026-10-10) : rmcp, async-openai, genai, rig-core, rusqlite, reqwest, calamine, pdf-extract, pdf_oxide, rusqlite_migration, tauri-plugin-window-state. npm registry : streamdown, react-markdown, remark-gfm, remend, shiki, @tanstack/react-virtual.
- Code : vercel/streamdown@8edc648 ; modelcontextprotocol/rust-sdk@4048ac4 ; vllm-project/vllm@9f1c783 (docs/features/{tool_calling,structured_outputs,reasoning_outputs,multimodal_inputs}.md, vllm/tool_parsers/__init__.py) ; registre cargo local (libsqlite3-sys 0.35.0, tauri 2.11.5, windows 0.62.2, arboard 3.6.1).
- https://raw.githubusercontent.com/ggml-org/llama.cpp/master/tools/server/README.md ; https://github.com/ggml-org/llama.cpp/blob/master/docs/function-calling.md
- https://modelcontextprotocol.io/specification/latest/server/tools (2026-07-28)
- https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/process-model ; https://learn.microsoft.com/en-us/uwp/api/windows.media.ocr.ocrengine
- https://v2.tauri.app/develop/calling-frontend/ ; https://v2.tauri.app/plugin/window-state/ ; https://docs.rs/tauri/latest/tauri/webview/struct.WebviewWindowBuilder.html ; https://github.com/tauri-apps/tauri/issues/13761
- https://raw.githubusercontent.com/ollama/ollama/main/docs/api.md ; https://lmstudio.ai/docs/api/rest-api (via recherche)
