# 03 · Architecture : du « one-shot » à un moteur à plusieurs surfaces

> Statut : **exploration** (10/10/2026). Constats lus dans le code de la 0.6.0 (branche `refonte-reglages`) ; recommandations à valider avant tout plan de release.
> Sources : [recherches/2026-10-10-briques-techniques.md](recherches/2026-10-10-briques-techniques.md) et la cartographie du code faite le même jour (résumée en §1).

## 1. Point de départ : ce que le code fait aujourd'hui

| Sujet | Constat | Où |
|---|---|---|
| Taille | 14 800 lignes de Rust, 16 200 de TS. `lib.rs` seul : **4 109 lignes** (état, fenêtres, raccourcis, flux, collage, watchdog) | `src-tauri/src/lib.rs` |
| État | **un seul** `Inner` : une capture, une exécution, une requête, un résultat, une fenêtre source. Chaque capture écrase la précédente | `lib.rs:93-147`, `lib.rs:831-866` |
| Inférence | requête figée à 2 messages (`system` = consigne, `user` = sélection), `temperature` 0.3, `max_tokens` 4096, réflexion coupée, plafond total 120 s. Ni historique, ni image, ni outil | `inference.rs:106-121`, `inference.rs:199-209` |
| Doublon | la même requête est reconstruite pour l'essai de connexion | `probe.rs:701` |
| Flux | Rust émet des deltas, mais React attend `done` pour tout afficher | `useTranslation.ts:47-58` |
| Événements | adressés en dur à la fenêtre `overlay` | `lib.rs:1425-1545` |
| Fenêtres | `overlay` (Îlot) transparente, traversante hors des surfaces (sondeur 8 ms), réservée à la taille max de l'Îlot ; `halo` ; `settings` ; `setup` et `demo` créées à la demande | `tauri.conf.json`, `host.rs:900-940`, `layout.ts:112` |
| Pont | 43 commandes, 21 événements, **types recopiés à la main** entre `types.rs` et `types.ts` ; valeurs par défaut des actions en 3 exemplaires | `bridge.ts`, `actionDefaults.ts`, `actions.rs` |
| Raccourcis | `tauri-plugin-global-shortcut` (`RegisterHotKey`) ; deux types seulement : `Action` et `Menu` ; anti-rafale **commune** à tous les raccourcis | `actions.rs:27`, `lib.rs:1062-1085` |
| Modèles | `Settings.servers` (1 à 8), un modèle **par serveur**, un serveur par défaut. Les actions n'ont ni serveur ni modèle | `types.rs:413-425`, `actions.rs:10-23` |
| Stockage | `settings.json` (écriture atomique), historique SQLite (`rusqlite` bundled) chiffré par DPAPI ligne à ligne, 7 jours / 100 entrées ; colonnes héritées détournées (`target_language` vide, `mode` = hôte) | `settings.rs:318-328`, `history.rs` |
| Secrets | clés DPAPI, ne sortent vers React que pour Réglages et accueil ; Rust fait les requêtes | `lib.rs:585-595` |
| Lancement | une 2ᵉ instance ouvre « la porte d'entrée » et **ignore ses arguments** | `lib.rs:3196-3199` |
| Dette | parcours v4 encore codé derrière `uiVersion` ; `bytes` et `thiserror` déclarés mais inutilisés ; deux accès au presse-papiers (`arboard` + FFI Win32) ; FFI brut à côté du crate `windows` ; `panic = "abort"` en release | `Cargo.toml`, `clipboard_guard.rs`, `host.rs` |

**Ce qui se réutilise tel quel** : la chaîne de capture (`capture::capture_current` : UIA → copie synthétique → copie récente), la réinsertion avec revalidation (`capture::paste`, `validate_target`), les serveurs et clés DPAPI, le client `reqwest` + décodeur SSE + annulation, le journal de diagnostic, les primitives UI (`MorphSurface`, `controls.tsx`, `motion/`, `i18n`).

**Ce qui empêche un chat aujourd'hui** : l'état unique, les événements vers `overlay` en dur, l'inférence à 2 messages, l'absence de chemin « capturer sans ouvrir la bulle », le watchdog qui fermerait une conversation longue, l'anti-rafale partagée, `BindingKind` limité à deux valeurs.

## 2. La cible en un schéma

```
 ENTRÉES                    ROUTEUR                    MOTEUR (Rust)                         SURFACES (React)
 ───────                    ───────                    ─────────────                         ────────────────
 raccourcis ─┐                                ┌─ context/  sélection, fenêtre, fichier,      ┌─ Îlot   (overlay)
 geste souris├─▶ Demande {origine, contexte,  │            capture+OCR, log filtré           ├─ Barre
 argv / URI  │   commande?, surface}  ───────▶├─ llm/      client unique OpenAI-compatible   ├─ Chat
 extension   ┘                                ├─ models/   registre, rôles, routage          ├─ Réglages
                                              ├─ sessions/ sélection (Îlot) + conversations  └─ Accueil
                                              ├─ privacy/  détection, pseudonymes                  ▲
                                              ├─ gateways/ ChatGPT, Open WebUI, presse-papiers     │ état projeté
                                              ├─ agent/    outils, approbations, MCP (plus tard)   │ (Channel par fenêtre
                                              └─ store/    SQLite unique, migrations, DPAPI ───────┘  pour les deltas)
```

### Trois idées qui structurent tout

1. **Une « Demande » unique.** Chaque porte d'entrée (raccourci, Ctrl+clic droit, Explorateur, extension, jump list) produit la même structure : d'où elle vient, quel contexte elle porte, quelle commande elle vise, quelle surface doit répondre. Un seul routeur décide. Ajouter un geste ne touche plus au reste.
2. **Une « Commande » unique.** Les actions de l'Îlot, les commandes `/` de la barre et du chat, et les entrées du clic droit de l'Explorateur sont la même chose : `{id, nom, consigne, rôle de modèle, comportement de sortie, contexte requis, raccourci, icône}`. Une bibliothèque, pas trois.
3. **Des sessions indépendantes.** La session « sélection » de l'Îlot (une à la fois, avec sa cible à revalider) et les **conversations** (plusieurs, sans cible, persistées) ont chacune leur état, leur watchdog, leur anti-rafale. L'Îlot peut tourner pendant qu'une conversation attend.

### Côté front

```
src/
  surfaces/ilot · bar · chat · settings · setup   une entrée par fenêtre (App.tsx route déjà sur ?window=)
  components/                                      primitives partagées (Radix, motion, lucide, cmdk)
  markdown/                                        LE rendu des réponses, pour toutes les surfaces
  bridge/                                          types générés depuis Rust + wrappers de commandes
```

React ne fait que **projeter** l'état que Rust lui pousse. Aucune lib front ne parle au réseau, au disque ou au modèle.

## 3. Règles de cohérence (« une techno par besoin, partout la même »)

| Besoin | La seule réponse | Écarté | Vérifié le 10/10/2026 |
|---|---|---|---|
| Réseau (modèles, MCP, sondes, passerelles) | `reqwest` + `native-tls` en Rust (SChannel : les CA de l'entreprise marchent) | fetch côté front, AI SDK, `async-openai`/`rig` (rustls, API mouvante) | `reqwest` 0.12.23 dans le repo ; `rmcp` impose 0.13 → montée globale le jour du MCP |
| Client LLM | **le client maison, étendu** en module `llm/` : messages multiples, images, `tool_calls`, `reasoning`/`reasoning_content`, `response_format: json_schema` | réécriture sur une crate tierce | vLLM a renommé `reasoning_content` en `reasoning` ; llama.cpp garde `reasoning_content` |
| Données | **un** SQLite (`rusqlite` bundled, monter en 0.40), contenu chiffré DPAPI par ligne, migrations `PRAGMA user_version` | `tauri-plugin-sql`, fichiers JSON, 2ᵉ base | FTS5 est compilé, mais inutilisable sur du contenu chiffré ligne à ligne (voir §5) |
| Secrets | DPAPI en Rust | trousseau côté webview | — |
| Types du pont | **générés depuis Rust** (`ts-rs` 12.0.1, stable) | recopie à la main ; `tauri-specta` (encore 2.0.0-rc.25 pour Tauri 2) | crates.io, 10/10/2026 |
| Flux vers l'UI | `tauri::ipc::Channel` par fenêtre abonnée pour les deltas ; événements pour les changements d'état | événements pour chaque token (la doc Tauri les dit non faits pour le débit) | doc Tauri v2 « calling the frontend » |
| Rendu des réponses | `react-markdown` + `remark-gfm` + `remend` (markdown incomplet pendant le flux) + `shiki` (moteur JS, compatible avec la CSP actuelle) ; **pas de HTML brut, pas d'images distantes** (exfiltration par URL) | `streamdown` (HTML brut et liens ouverts par défaut, dépend de Tailwind), `marked` | versions npm du 10/10/2026 |
| UI | Radix + motion + lucide + cmdk, CSS maison et tokens existants | Tailwind, HeroUI dans l'app (ils restent dans `design-lab/`) | — |
| Natif Windows | crate `windows` (on ajoute des *features* : `Media_Ocr`, `Graphics_Imaging`…) | nouvelles crates natives, FFI `extern "system"` neuf | `windows` 0.62.2 |
| Lecture de fichiers | `calamine` (XLSX), `pdf-extract` (PDF), `zip` + `quick-xml` (DOCX), **dans un sous-processus** `Overtype.exe --extract` | parseur dans le processus principal : avec `panic = "abort"`, un fichier piégé tuerait l'app | `Cargo.toml` `[profile.release]` |
| Détection de données sensibles | Rust (`regex`, `aho-corasick`) + LLM interne via `llm/` | Python / Presidio côté client | voir [05](05-confidentialite-et-passerelles.md) |
| Boucle d'agent et outils | **Rust**, module `agent/` : secrets, outils natifs et réseau y sont déjà ; une fenêtre fermée ne tue pas la conversation | boucle en TypeScript (un aller-retour IPC par outil, commandes puissantes exposées à la webview) | — |

## 4. Fondations à poser avant les fonctionnalités (« lot 0 »)

Rien de visible pour l'utilisateur ; tout ce qui suit en dépend. Chaque étape garde les tests existants verts.

1. **Découper `lib.rs`** par domaine (`sessions/`, `surfaces/`, `entry/`, `delivery/`…), sans changer le comportement.
2. **Capturer sans ouvrir la bulle** : sortir `capture_current` + identité de la source du chemin `capture_opening` → `store_capture`.
3. **Module `llm/`** : `ChatRequest { messages, tools, response_format, limites }` ; l'action actuelle devient un cas particulier ; fin du doublon `probe.rs:701` ; plafond de durée et `clean_output` paramétrables.
4. **Types du pont générés** (`ts-rs`) et une seule source pour les valeurs par défaut (Rust, exportées).
5. **Nettoyage** : retirer le parcours v4 (`uiVersion`, `GlassSession`, `BubbleMenu`), `bytes`, `thiserror`, un seul accès au presse-papiers.
6. **Store** : migrations `user_version`, `rusqlite` 0.40, schéma des conversations (ci-dessous), historique Îlot migré sans perte.
7. **Routeur d'entrée** : les arguments de la 2ᵉ instance (`single-instance`) et un schéma d'URI deviennent des « Demandes ».
8. **État par session** : watchdog, anti-rafale et cible propres à chaque session ; événements adressés au bon label.

### Schéma de stockage proposé

```
conversations(id, created_at, updated_at, title_dpapi?, role, pinned, archived)
messages(id, conversation_id → CASCADE, seq, role system|user|assistant|tool,
         status streaming|done|cancelled|error, model, tokens_in, tokens_out, body_dpapi)
attachments(id, message_id → CASCADE, kind image|file|ocr|selection|log, mime, name_dpapi, bytes, sha256, data_dpapi)
tool_runs(id, message_id → CASCADE, server, tool, decision approved|denied|auto, args_dpapi, result_dpapi, started_at, ended_at)
pseudonyms(id, session_id, token, value_dpapi, kind, expires_at)
```

## 5. Décisions techniques qui reviennent à Lucas

1. **Recherche dans les conversations** : (a) titres en clair + déchiffrement à la volée, borné (simple, cohérent avec l'historique actuel) ; ou (b) toute la base chiffrée avec SQLCipher pour avoir une vraie recherche plein texte (ajoute OpenSSL à côté de SChannel, build plus lourd). Recommandation : (a) d'abord.
2. **Barre** : un nouvel « étage » de la fenêtre `overlay` existante (déjà transparente, focus maîtrisé, crochet clavier) ou une fenêtre à part (plus simple à raisonner, une WebView2 de plus en mémoire, coût **non mesuré**). Recommandation : mesurer la mémoire d'abord (carte OT-027).
3. **Fenêtre de chat** pré-créée au lancement ou créée à la première ouverture puis gardée cachée. Recommandation : à la première ouverture.

## 6. Risques à garder en tête

- **Tool calling sur petits modèles locaux** : fragile. Le profil `general` livré (Gemma 4, vLLM 0.28.0) n'active pas `--enable-auto-tool-choice` ; le parseur `gemma4` n'est vérifié que sur vLLM récent (0.31.0). Banc maison obligatoire avant toute promesse.
- **MCP** : `rmcp` a eu 3 versions majeures en 5 mois (1.0.0 en mars, 3.0.0 en juillet 2026). À brancher tard, derrière une interface à nous.
- **Mémoire** : chaque fenêtre ajoute au moins un processus de rendu WebView2 ; aucun chiffre publié ni mesuré ici.
- **Glisser-déposer** : bug Tauri #13761 (ouvert depuis juillet 2025) quand la fenêtre est créée en Rust ; contournement connu (déclarer la fenêtre dans `tauri.conf.json`).
