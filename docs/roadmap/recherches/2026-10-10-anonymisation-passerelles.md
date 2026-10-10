# Overtype : « envoyer ailleurs, anonymisé » — passerelles, Open WebUI, anonymisation

Recherche du 2026-10-10. Légende : **vérifié (source, date)** = lu dans une doc officielle ou dans le code ; **rapporté** = observé par un tiers (outil, forum, article), non confirmé par l'éditeur ; **déduit** = mon raisonnement, base indiquée ; **non vérifié** = pas de source trouvée.

Dépôts lus (clones `--depth 1` temporaires, non versionnés) :
- `open-webui/open-webui` @ `8bd8b4fa` (2026-09-21), version 0.11.4
- `microsoft/presidio` @ `2523c7b7` (2026-10-08), analyzer 2.2.364
- `ThatGuySam/prefillprompt` @ `a163c340` (2026-08-31) : générateur de liens maintenu, sert de témoin pour ChatGPT/Claude/Gemini
- `coatless-rpkg/searcher` @ `250c51a3` (2025-05-27), `arthurdejong/python-stdnum` @ `006192e5` (2026-08-15), `openai/privacy-filter` (premier commit 2026-04-22)
- Overtype lui-même : `src-tauri/Cargo.toml` et `src-tauri/src/inference.rs`

---

## 0. Ce qu'il faut retenir

1. **Open WebUI est la seule cible dont les paramètres d'URL sont documentés et lisibles dans le code**, y compris `submit=false` (pré-remplir sans envoyer) et `temporary-chat=true`. Les liens ChatGPT, Claude, Copilot, Mistral et Gemini **ne sont documentés nulle part par leurs éditeurs** : ils marchent « en pratique » selon des tiers et peuvent casser sans préavis.
2. **Overtype peut viser l'Open WebUI de l'entreprise comme serveur sans changer son client** : Open WebUI expose `/api/v1/chat/completions` et `/api/v1/models`, et `inference.rs` ajoute `/v1/` à la base, donc la base `https://owui.corp/api` tombe juste (déduit du code des deux côtés). Une condition bloque : l'admin doit activer les clés API, désactivées par défaut.
3. **Pipeline recommandé, sans Python côté client** : (1) détecteurs déterministes en Rust (regex, sommes de contrôle, dictionnaire d'entreprise) ; (2) noms de personnes, organisations et projets détectés par le **LLM interne** via le client OpenAI-compatible qu'Overtype a déjà, chaque entité renvoyée étant revérifiée dans le texte ; (3) aperçu surligné, l'utilisateur valide, pseudonymes `[PERSONNE_1]` gardés dans une table locale chiffrée (DPAPI + SQLite, déjà présents), puis ouverture avec repli presse-papiers. Un modèle ONNX local (GLiNER2-PII, `ort`) reste une option pour plus tard : il fait 0,6 à 1,2 Go et aucun chiffre en français n'est publié.
4. **Rien n'est promis avant de mesurer** le rappel par type d'entité sur un corpus maison FR+EN. Les meilleurs chiffres publiés (F1 de 0,48 à 0,89 selon les jeux de test, voir §3.2) ne justifient pas de dire « anonymisé ». Il faut dire « pseudonymisé, à relire ».

---

## 1. Ouvrir une conversation pré-remplie

### 1.1 Open WebUI (cible prioritaire) — vérifié (code + doc)

Lu dans `src/lib/components/chat/Chat.svelte` (0.11.4) et dans la doc [URL Parameters](https://docs.openwebui.com/features/chat-conversations/chat-features/url-params.md) (consultée le 2026-10-10) :

| Paramètre | Effet | Preuve |
|---|---|---|
| `q=` | texte initial | Chat.svelte l.2243-2250 |
| `submit=false` | **pré-remplit sans envoyer**. Sans ce paramètre, ou avec toute autre valeur, le message **part tout seul** | `(searchParams.get('submit') ?? 'true') === 'true'` l.2246 ; doc idem |
| `model=` / `models=a,b` | choix du ou des modèles. Si l'id est inconnu, le sélecteur s'ouvre pré-filtré | l.2068-2080 |
| `temporary-chat=true` | chat temporaire, rien n'est écrit en base (doc). Ignoré si l'utilisateur n'a pas la permission `chat.temporary` ; forcé si l'admin a mis `temporary_enforced` | l.2038-2044 ; `routes/(app)/+layout.svelte` l.359-366 |
| `tools=` ou `tool-ids=` | ids d'outils séparés par des virgules ; un id inconnu est ignoré. MCP : `server:mcp:<id>` (doc) | l.2184-2196 |
| `web-search=true`, `code-interpreter=true`, `image-generation=true`, `call=true`, `load-url=`, `youtube=` | active la fonction | l.2164-2209 |

- **Connexion** : si l'utilisateur n'est pas connecté, la redirection garde la requête entière (`/auth?redirect=${encodeURIComponent(pathname+search)}`, `+layout.svelte` l.197-199). Le pré-remplissage survit donc au login (vérifié, code).
- **Lien conseillé pour Overtype** : `https://owui.corp/?model=<id>&temporary-chat=true&submit=false&q=<texte encodé>` (déduit du tableau).

### 1.2 Services publics — aucun n'est documenté par son éditeur

| Service | Gabarit observé | Options | Statut |
|---|---|---|---|
| ChatGPT | `https://chatgpt.com/?q=…` | `model=…`, `hints=search` (recherche web), `temporary-chat=true` | **rapporté** : code de prefillprompt (`src/lib/prompt-links.ts`, 2026-08-31), qui classe `temporary` en « experimental ». Forum OpenAI : le mode temporaire saute après rechargement ou au 1er message ([fil](https://community.openai.com/t/temporary-chat-gets-disabled-after-the-second-message/932746)). **Envoi automatique** selon des rapports de forum ; aucun paramètre connu pour l'empêcher. Aucun texte officiel OpenAI trouvé (la page d'aide 9237897 répond 403 au fetch). |
| Claude | `https://claude.ai/new?q=…` | `model=…`, `incognito=true` (prefillprompt, « experimental ») | **rapporté** (prefillprompt ; searcher `R/index-sites.R` l.104 ; extension PopClip, avril 2026). Pas de doc Anthropic trouvée. Pré-remplissage seul ou envoi : **non vérifié**. |
| Microsoft Copilot (grand public) | `https://copilot.microsoft.com/?q=…` ; ancien : `https://www.bing.com/search?showconv=1&sendquery=1&q=…` | — | **rapporté** seulement (u2l.ai ; searcher l.111, 2025). Pour **M365 Copilot Chat** (entreprise), Learn ne documente aucun paramètre de prompt, seulement un « handoff » en preview pour les bots ([Learn](https://learn.microsoft.com/en-za/MicrosoftTeams/platform/bots/how-to/conversations/bot-copilot-handoff)). |
| Mistral Le Chat | `https://chat.mistral.ai/chat?q=…` | — | **rapporté** (searcher l.109, 2025-05). Pas de doc Mistral. Non testé. |
| Gemini | `https://gemini.google.com/app?q={searchTerms}` vient du raccourci `@gemini` de Chromium | — | La [page d'aide Google](https://support.google.com/gemini/answer/14886647) ne documente que la saisie `@gemini` dans la barre d'adresse, pas de paramètre d'URL (vérifié 2026-10-10). prefillprompt a **abandonné** le lien direct (prompt perdu selon navigateur, compte ou région) au profit de « copier puis ouvrir » (`docs/progressive-disclosure-audit.md`). |
| Perplexity (bonus) | `https://www.perplexity.ai/search?q=…&s=o` | — | rapporté (prefillprompt) |

Conséquence (déduit) : il faut garder ces gabarits dans une **table de configuration** modifiable sans release (réglage admin ou fichier de profil), avec un repli « copier puis ouvrir » toujours disponible.

### 1.3 Limites de longueur

| Maillon | Limite | Statut |
|---|---|---|
| Chromium / Edge | `kMaxURLChars` = 2 Mio ; au-delà, l'URL devient vide quand elle passe par Mojo | vérifié ([url.mojom](https://gitcode.com/openharmony-tpc/chromium_src/blob/master/url/mojom/url.mojom), miroir) |
| Windows : ouvrir l'URL via la ligne de commande du navigateur | `lpCommandLine` ≤ 32 767 caractères | vérifié ([CreateProcessW](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-createprocessw), maj 2025-07). ShellExecute → argument `%1` du gestionnaire http : déduit |
| **nginx** devant un Open WebUI interne | `large_client_header_buffers 4 8k` : une ligne de requête > 8 Ko renvoie **414** | vérifié ([doc nginx](https://nginx.org/en/docs/http/ngx_http_core_module.html#large_client_header_buffers)) |
| Cloudflare (devant beaucoup de SaaS) | URL ≤ 16 Ko | vérifié ([limites Workers](https://developers.cloudflare.com/workers/about/limits), [changelog 2025-10-16](https://developers.cloudflare.com/changelog/2025-10-16-header-limit-increase/)) ; que chatgpt.com applique cette limite exacte : **non vérifié** |
| prefillprompt (outil en production) | prompt ≤ 12 000 caractères, URL ≤ 15 000 octets | rapporté (`prompt-links.ts` l.9-13) |
| Proxy d'entreprise (Zscaler, Bluecoat, etc.) | variable | non vérifié : à mesurer chez le client |

- **Encodage** : un caractère accentué français pèse 6 octets encodés (`é` → `%C3%A9`), un espace 3 (`%20`). Un texte français encodé pèse donc environ 1,3 à 2 fois sa taille brute (déduit).
- **Seuils proposés** (déduit) : URL encodée ≤ 7 000 octets pour Open WebUI (nginx 8 Ko moins la marge), ≤ 12 000 pour les SaaS. Au-delà, on passe au repli.
- **Repli** : (1) Overtype copie le texte pseudonymisé dans le presse-papiers (arboard est déjà là) ; (2) il ouvre l'URL **sans** `q`, ou avec une consigne courte (« Le texte suit, collé par l'utilisateur ») ; (3) un toast dit « Collez avec Ctrl+V ». Une extension navigateur ferait mieux mais ajoute une technologie et un déploiement par navigateur : à écarter (déduit).
- **Effet de bord à signaler** : le texte de `q=` atterrit dans l'historique du navigateur, synchronisé vers le compte Google ou Microsoft si la synchro est active, et dans les **logs d'accès du reverse proxy** d'Open WebUI (query string). Pour l'interne non anonymisé, c'est une copie de plus dans les logs (déduit). Open WebUI lit `searchParams`, pas le fragment `#`, donc on ne peut pas cacher le texte dans le fragment (vérifié, code).

---

## 2. Open WebUI comme fournisseur de modèles

### 2.1 L'API — vérifié (code 0.11.4 + doc)

- **Routes** (`backend/open_webui/main.py`) : `GET /api/models` et `/api/v1/models` (l.897-898, renvoie `{'data': [...]}` filtré selon les droits de l'utilisateur, l.947) ; `POST /api/chat/completions` et `/api/v1/chat/completions` (l.1108-1109, commentaire « Experimental: Compatibility with OpenAI API ») ; `/api/v1/embeddings` ; `/api/v1/messages` au format Anthropic (l.2003).
- **Clés API** : interrupteur global `ENABLE_API_KEYS`, **par défaut `False`** (`config.py` l.2454). Les non-admins doivent en plus avoir la permission `USER_PERMISSIONS_FEATURES_API_KEYS`, **par défaut `False`** (l.1924). L'admin peut restreindre les routes accessibles aux clés (`ENABLE_API_KEYS_ENDPOINT_RESTRICTIONS` + `API_KEYS_ALLOWED_ENDPOINTS`, l.2456-2464), mais la restriction vaut pour toute l'instance. Doc [API Keys](https://docs.openwebui.com/features/authentication-access/api-keys.md) : la clé hérite du rôle et des groupes de son propriétaire. Couper l'interrupteur invalide toutes les clés existantes. Si le proxy occupe déjà `Authorization`, l'en-tête de repli est `x-api-key` (`CUSTOM_API_KEY_HEADER`).
- **RAG et outils via l'API** (doc [API Endpoints](https://docs.openwebui.com/reference/api-endpoints.md)) : `files: [{"type":"collection","id":…}]` pour une base de connaissance, `{"type":"file","id":…}` pour un fichier, `tool_ids: [...]` pour les outils serveur. Les **filtres** `inlet()` s'appliquent aussi aux appels API. La doc qualifie l'ensemble d'« experimental setup ».
- **Pas d'anonymisation intégrée** : aucune occurrence de presidio, PII ou anonymi* dans `backend/` ni `src/` (grep, 0.11.4). Les filtres `inlet` permettraient d'en ajouter une côté serveur (déduit).

### 2.2 Compatibilité avec Overtype — déduit du code

`inference.rs::api_url` construit `{base}/v1/{route}` (l.89-95, test l.546-551). Avec la base `https://owui.corp/api`, on obtient `…/api/v1/chat/completions` et `…/api/v1/models`, deux routes qui existent. Le streaming SSE reste à confirmer sur une vraie instance. À tester aussi : Overtype envoie `top_k`, `repetition_penalty` et `chat_template_kwargs`, puis rejoue sans eux en cas de 400 (l.97-104). Open WebUI les transmet-il à vLLM ou les rejette-t-il ? **Non vérifié.**

### 2.3 Avantages et limites

| + | − |
|---|---|
| Un seul point d'entrée : droits par groupe, modèles « maison » (prompt système, RAG attaché), journalisation et quotas déjà gérés par l'admin | Clés API **désactivées par défaut** : il faut l'accord de l'admin, et la clé est personnelle (chaque utilisateur en crée une, pas de jeton de service ni d'OAuth pour une app desktop) |
| Accès aux bases de connaissance (`files: collection`) et aux outils sans réimplémenter le RAG | Couche « experimental » selon la doc ; les filtres `inlet` d'admin peuvent modifier les prompts d'Overtype (consignes de transformation) sans qu'Overtype le sache |
| L'utilisateur retrouve les mêmes modèles dans Overtype et dans le navigateur | Latence en plus (pipeline middleware, filtres) et dépendance à la disponibilité d'Open WebUI, même pour une simple correction |
| Pour le bouton « Ouvrir dans Open WebUI », pas besoin d'anonymiser : la donnée reste interne | Les appels API créent-ils des chats en base ? Aucun `chat_id` n'est envoyé : non vérifié en détail |

**Recommandation** (déduit) : garder vLLM direct comme profil par défaut (le chemin le plus court pour la transformation de texte), et proposer Open WebUI comme **2e type de profil** (« Open WebUI de l'entreprise » : base `…/api`, clé API utilisateur), utile pour le RAG et la réponse d'un modèle d'entreprise. Le bouton navigateur vers Open WebUI fonctionne même sans clé API, puisqu'il passe par la session web de l'utilisateur.

---

## 3. Anonymisation et pseudonymisation FR + EN

### 3.1 Détecteurs structurés (couche 1, Rust pur, déterministe)

| Type | Méthode | Référence |
|---|---|---|
| E-mail | regex | — |
| Téléphone FR / international | regex + validation libphonenumber (crate Rust `phonenumber` : non vérifié) | Presidio s'appuie sur `phonenumbers`, régions par défaut `US, GB, DE, FR, IL, IN, CA, BR` (`phone_recognizer.py` l.29, vérifié) |
| IBAN | regex par pays + mod 97 (ISO 7064) | Presidio `iban_recognizer.py` / `iban_patterns.py` |
| SIREN (9) / SIRET (14) | Luhn ; **exception La Poste** : SIRET commençant par `356000000` (hors siège `35600000000048`) → somme des chiffres multiple de 5 | python-stdnum `stdnum/fr/siret.py` (vérifié, code 2026-08-15). Source INSEE officielle **non trouvée** |
| NIR (n° de sécu) | 13 chiffres + clé = `97 − (NIR mod 97)` ; Corse : `2A`→`19`, `2B`→`18` avant le calcul | python-stdnum `stdnum/fr/nir.py` `calc_check_digits` (vérifié, code). Doc ameli/INSEE officielle **non trouvée** |
| Carte bancaire | regex + Luhn | Presidio `credit_card_recognizer.py` |
| IPv4/IPv6, MAC, UUID | regex + parse (`std::net`) | Presidio generic (UUID ajouté en 2026, CHANGELOG unreleased) |
| Noms d'hôtes et URL internes | liste de suffixes de domaine de l'entreprise (`*.corp.local`, `intranet.*`) + regex FQDN ; IP RFC1918 | déduit |
| Chemins Windows avec utilisateur | `C:\Users\<nom>\…`, `\serveur\partage\…`, `%USERPROFILE%` | déduit |
| Secrets | jeu de règles **gitleaks** (`config/gitleaks.toml` : ~220 règles avec `regex`, `keywords`, `entropy`). Exemples : `private-key`, `jwt`, `aws-access-token`, `github-pat`, `openai-api-key`, `azure-ad-client-secret`, `generic-api-key` | vérifié ([gitleaks.toml](https://raw.githubusercontent.com/gitleaks/gitleaks/master/config/gitleaks.toml), 2026-10-10). Ces regex sont en syntaxe Go RE2, sans lookaround, a priori compatible avec la crate Rust `regex` (déduit ; à valider règle par règle à l'import) |
| Dictionnaire d'entreprise | clients, projets, produits, noms de code : automate **Aho-Corasick** (crate `aho-corasick` 1.1.5, 2026-08-03), insensible à la casse et aux accents, avec variantes | vérifié (crates.io). La liste est fournie par l'admin (fichier signé ou endpoint interne) |

- **Presidio n'a aucun détecteur français spécifique** : pas de NIR, SIREN ni SIRET. Ses dossiers `country_specific/` couvrent AU, CA, DE, ES, FI, IN, IT, KR, NG, PH, PL, SG, ZA, SE, TH, TR, UK, US (vérifié, code 2026-10-08). En plus, Presidio est en Python : l'embarquer contredit la contrainte « pas de 2e runtime » (cf. §4).

### 3.2 Entités nommées (personnes, organisations, lieux, projets)

| Option | Taille / exécution | Langues | Chiffres publiés (jeu de test) | Statut |
|---|---|---|---|---|
| **GLiNER2-PII** `fastino/gliner2-privacy-filter-PII-multi` (Apache-2.0) | ~205-300 M paramètres. ONNX tiers `jugaadsrl/…-onnx` : ~1,17 Go en fp32 (variante CPU `fp32_v2`), ~590 Mo en fp16, **pas d'int8** (valeurs aberrantes DeBERTa-v3) | EN, FR, ES, DE, IT, PT, NL ; 42 types | **SPY** (span exact) : F1 moy. 0,477 (légal 0,473, médical 0,480) ; précision 0,346/0,369, rappel 0,750/0,686. Mêmes conditions : nvidia/gliner-PII 0,400 ; urchade/gliner_multi_pii-v1 0,398 ; openai/privacy-filter 0,380. Les auteurs sont ceux du modèle | vérifié (carte HF + [arXiv 2605.09973](https://arxiv.org/abs/2605.09973), 2026-05-11). **Aucun chiffre par langue, ni en français** |
| `urchade/gliner_multi_pii-v1` | mDeBERTa, défaut du `GLiNERRecognizer` de Presidio (`gliner_recognizer.py` l.37) | EN, FR, DE, ES, PT, IT | voir SPY ci-dessus | vérifié |
| **OpenAI Privacy Filter** `openai/privacy-filter` (Apache-2.0, 2026-04-22) | 1,5 G paramètres au total, 50 M actifs (MoE) ; contexte 128 k ; transformers.js/WebGPU ; ONNX tagué | **« Primarily English »** (README l.154), aucun chiffre multilingue | « SOTA » sur PII-Masking-300k corrigé (annonce OpenAI ; la page renvoie 403, chiffre 97,43 % rapporté par la presse). 8 catégories fixes (personne, adresse, e-mail, téléphone, URL, date, n° de compte, secret) : impossible d'ajouter « client » ou « projet » sans fine-tuning | vérifié (dépôt + carte HF) / rapporté |
| `Jean-Baptiste/camembert-ner` (MIT) | 110 M, ONNX dispo | FR | wikiner-fr (split non précisé) : F1 0,891 ; PER 0,948, ORG 0,818, LOC 0,896 | vérifié (carte HF). Données encyclopédiques, pas de mails ni de tickets d'entreprise |
| knowledgator `gliner-pii-*-v1.0`, nvidia/gliner-PII | ONNX (edge en uint8) | EN officiellement ; multilingue « inconnu » chez NVIDIA | — | rapporté |
| **LLM interne** (vLLM existant) | 0 octet côté client ; quelques centaines de ms à quelques s selon le modèle (non mesuré) | dépend du modèle | aucun chiffre générique ; Presidio intègre déjà un détecteur LLM (`LangExtract`, `third_party/basic_langextract_recognizer.py`) | vérifié (code Presidio) ; perf non vérifiée |

**Rust / ONNX sur CPU** :
- `ort` 2.0.0-rc.13 (2026-07-28), toujours en release candidate.
- `gline-rs` 1.1.0 (2026-08-05) épingle `ort` rc.9 : conflit de versions possible.
- `gliner2-rs` 0.9.6 (2026-08-29) ; `gliner2` 0.1.3 ; `tokenizers` 1.0.0-rc.2.
- (vérifié, crates.io API, 2026-10-10)
- Perf publiées : gline-rs 0.9.0 → 6,67 séquences/s sur i9 2,3 GHz 8 cœurs, contre 1,61 en Python (README docs.rs). Un retour terrain GLiNER2 + `ort` en Rust, encodeur int8 : p50 ~250 ms sur 4 vCPU AMD, ~800 Mo de RAM, ~60 Mo de runtime ONNX ([forum Rust, 2026-05-05](https://users.rust-lang.org/t/building-a-production-multilingual-pii-detection-system-in-rust-with-gliner2/139964), rapporté ; F1 0,86 « 13 langues » sans protocole décrit, donc inexploitable).
- Ce que ça coûte à Overtype (déduit) : `onnxruntime.dll` (~60 Mo) + modèle 0,6 à 1,2 Go à télécharger au premier usage, ~0,8 Go de RAM, une nouvelle chaîne de build, pour un gain en français **non mesuré**.

### 3.3 Pseudonymisation réversible

- **Jetons typés et numérotés** de façon cohérente dans le document : `[PERSONNE_1]`, `[ORG_2]`, `[CLIENT_1]`, `[EMAIL_1]`, `[IBAN_1]`. La même valeur donne le même jeton, en normalisant casse, accents et formes « M. Dupont » / « Jean Dupont » (coréférence simple par nom de famille). C'est lisible pour le LLM externe et l'inversion est triviale (déduit).
- **Faux noms plausibles** : plus naturels, mais plus risqués. Un faux nom peut tomber sur une vraie personne. Le LLM peut les décliner, les tutoyer ou les traduire (« Jean » → « John »), ce qui casse l'inversion. On ne repère pas non plus à l'œil ce qui a été remplacé. Ils restent utiles pour du texte à réécrire où le registre compte : option avancée (déduit).
- **Table de correspondance locale** : SQLite (rusqlite, déjà présent) chiffrée par DPAPI (`crypto.rs` appelle déjà `CryptProtectData`), une table par session d'envoi, TTL court (ex. 7 jours), purge manuelle. Jamais de synchro ni de télémétrie (déduit des deps vérifiées dans `Cargo.toml`).
- **Ré-identification de la réponse** : l'utilisateur sélectionne la réponse collée ou copiée, puis action Overtype « Rétablir les noms ». Overtype cherche les jetons de la session, de façon tolérante : `[PERSONNE_1]`, `PERSONNE_1`, `Personne 1`, `[PERSON_1]` (traduit). Ce qui ne trouve aucune correspondance est surligné au lieu d'être deviné (déduit).
- **Fuites résiduelles** : les quasi-identifiants (poste + site + date, « le DAF de notre filiale de Lyon »), le style, les montants et le contexte métier ne sont pas des entités. Les LLM infèrent des attributs personnels (lieu, revenu, sexe) depuis du texte avec jusqu'à 85 % de top-1 sur des profils Reddit réels, et les auteurs jugent l'anonymisation textuelle classique « inefficace » contre cette inférence (Staab et al., [arXiv 2310.07298](https://arxiv.org/pdf/2310.07298), ICLR 2024, vérifié via abstract). D'où l'**aperçu obligatoire** : surlignage par type, clic pour ajouter ou retirer un masque, compteur « 12 éléments masqués », mention « vérifiez le contexte ».

### 3.4 Cadre juridique et DLP

- **RGPD / CNIL** : une donnée pseudonymisée **reste une donnée personnelle** pour qui détient la clé. CNIL : « Les données résultant d'une pseudonymisation sont considérés comme des données personnelles » ([cnil.fr/identifier-les-donnees-personnelles](https://www.cnil.fr/fr/identifier-les-donnees-personnelles), vérifié via extrait). Nuance de la **CJUE, 4 sept. 2025, C-413/23 P EDPS c/ SRB** : pour un *destinataire* qui n'a raisonnablement aucun moyen de ré-identifier, les données peuvent ne pas être personnelles. Le responsable de traitement (l'entreprise, qui garde la table) reste soumis à ses obligations ([EUR-Lex](https://eur-lex.europa.eu/eli/C/2025/5551/oj/eng) ; lu via résumés [Clifford Chance](https://www.cliffordchance.com/insights/resources/blogs/talking-tech/en/articles/2025/09/pseudonymized-data-after-edps-v-srb.html) et A&O Shearman : rapporté, texte intégral non lu). EDPB : lignes directrices 01/2025 sur la pseudonymisation (adoptées en janvier 2025, consultation close) ; version finale **non confirmée**. Projet de lignes directrices sur l'anonymisation adopté pour consultation le 2026-07-07 selon [DLA Piper](https://privacymatters.dlapiper.com/2026/08/eu-edpb-publishes-draft-guidelines-on-anonymisation/) (rapporté).
  → Pour le marketing : **ne jamais écrire « anonymisé » ; écrire « pseudonymisé »** (déduit). Le secret des affaires (noms de clients, projets) relève d'une autre logique que le RGPD et la couche dictionnaire y répond.
- **Microsoft Purview** (Learn, maj 2026-09-24 et 2026-06-25) :
  - L'Endpoint DLP sait **bloquer ou avertir sur le collage** (« Paste to supported browsers ») vers des domaines sensibles, par exemple « empêcher de coller des numéros de carte dans ChatGPT » ([ai-other-apps](https://learn.microsoft.com/en-us/purview/ai-other-apps), [endpoint-dlp-learn-about](https://learn.microsoft.com/en-us/purview/endpoint-dlp-learn-about)).
  - Il existe aussi une stratégie « détection en ligne et blocage des prompts dans les apps d'IA sous Microsoft Edge » (browser data security), et une détection réseau via SASE/SSE.
  - Conséquences (déduit) : (a) le lien `?q=` ne passe pas par un collage, donc il **contourne le contrôle « paste »** de l'Endpoint DLP. Overtype ne doit surtout pas passer pour un outil de contournement DLP. Il faut le dire, le documenter et laisser l'admin désactiver ou restreindre les destinations par politique (GPO, registre ou fichier de config machine). (b) Dans Edge géré, l'inspection en ligne des prompts verra quand même le texte envoyé, ce qui est un bon filet de sécurité. (c) Le repli presse-papiers sera inspecté au collage : c'est voulu.

---

## 4. Recommandation pour Overtype

### 4.1 Pipeline (tout le traitement dans Rust, aucun runtime ajouté)

```
Sélection ──► [Rust] Couche 1 : déterministe (< 5 ms visé, non mesuré)
               regex + checksums (IBAN, Luhn, SIREN/SIRET, NIR) + règles gitleaks importées
               + domaines/chemins internes + dictionnaire entreprise (Aho-Corasick)
          ──► [Rust → LLM interne, via inference.rs existant] Couche 2 : NER
               prompt « renvoie un JSON {type, texte} des personnes/orgs/lieux/projets »
               sur le texte DÉJÀ masqué par la couche 1 (le LLM ne voit pas les secrets),
               chaque entité renvoyée est re-cherchée littéralement dans le texte (anti-hallucination),
               timeout → l'aperçu s'affiche quand même, bandeau « détection partielle »
          ──► [React] Aperçu surligné : retirer/ajouter un masque, choisir la destination
          ──► [Rust] Table locale (SQLite + DPAPI, TTL) ; jetons [TYPE_n]
          ──► Ouverture : URL ≤ seuil ? ShellExecute(url) : presse-papiers + URL nue + toast
Retour   ──► « Rétablir les noms » sur la réponse collée/sélectionnée (remplacement tolérant)
```

- **Côté client** : couche 1, aperçu, table, ouverture, ré-identification.
- **Côté serveur interne** : couche 2, sur le vLLM existant ou via Open WebUI.
- **Hors ligne ou sans serveur** : couche 1 seule, avec un bandeau rouge « noms de personnes non détectés ».
- **Plus tard, si la mesure le justifie** : un modèle ONNX local (GLiNER2-PII via `gliner2-rs`/`ort`) en téléchargement optionnel, derrière la même interface `Detector`.
- **Python** : ne s'impose nulle part. Presidio serait la seule raison d'en vouloir un, et il n'apporte ni le français ni rien que la couche 1 et un LLM ne couvrent pas. S'il fallait Presidio, ce serait **côté serveur** (filtre `inlet` Open WebUI ou micro-service), jamais dans le client (déduit).
- **Dépendances nouvelles** : la crate `regex` et `aho-corasick` (BurntSushi, pur Rust). L'ouverture d'URL passe par `ShellExecuteW` (feature `Win32_UI_Shell` du crate `windows` déjà présent) ou par `tauri-plugin-opener` (déduit ; Overtype n'a pas encore d'opener dans `Cargo.toml`).

### 4.2 Parcours « Ouvrir dans ChatGPT (pseudonymisé) »

1. **Déclenchement** : sélection → menu Overtype → « Envoyer vers… » → ChatGPT / Claude / Le Chat / Open WebUI (entreprise). Les destinations sont configurables et filtrables par l'admin.
2. **Panneau d'aperçu** : texte avec masques colorés par type et légende. Le compteur et la liste à droite donnent pour chaque masque le jeton, la valeur et la source de détection. Un clic sur un mot ajoute un masque, un clic sur un masque le retire. Case « Chat temporaire » cochée par défaut. Si l'URL est trop longue, mention « sera copié dans le presse-papiers ».
3. **Bouton principal** « Ouvrir dans ChatGPT ». Rappel discret : « Pseudonymisé, pas anonyme : relisez le contexte ».
4. **Destination interne** (Open WebUI) : pas de masquage par défaut, puisque la donnée reste interne. `submit=false&temporary-chat=true`.
5. **Retour** : « Rétablir les noms » sur la réponse sélectionnée, avec diff surligné.

### 4.3 À mesurer avant toute promesse

- **Corpus maison** FR + EN, 200 à 500 documents réels anonymisés à la main : mails, tickets, comptes rendus, extraits de code et de logs, documents juridiques et RH. Double annotation, accord inter-annotateurs. Pour compléter : ai4privacy `open-pii-masking-500k` (CC-BY-4.0, contient du FR, ~580 k lignes, nature synthétique **non confirmée**) et SPY pour comparer aux chiffres publiés.
- **Métriques** : **rappel par type** en priorité (une fuite coûte plus cher qu'un faux positif), au niveau span et au niveau « document sans aucune fuite ». Précision ensuite, car trop de faux positifs dégradent la réponse. On mesure chaque couche seule puis empilée.
- **Comparer** : couche 1 seule ; couche 1 + LLM interne (2 ou 3 modèles et prompts) ; couche 1 + GLiNER2-PII ONNX ; couche 1 + camembert-ner.
- **Latence** p50/p95 sur un poste client sans GPU, et RAM.
- **Inversion** : taux de jetons altérés par ChatGPT ou Claude dans les réponses (format `[PERSONNE_1]` contre faux noms), taux de rétablissement correct.
- **Longueur** : seuils réels de chatgpt.com, claude.ai et de l'Open WebUI client derrière son proxy (414 ?), dans Edge et dans Chrome.
- **Liens** : test mensuel automatisé des gabarits ChatGPT/Claude/Le Chat (pré-remplissage, envoi auto, temporaire), puisque rien n'est garanti.

---

## 5. Non vérifié, et où j'ai cherché

- **Doc officielle des paramètres `?q=` de ChatGPT, Claude, Copilot, Mistral** : help.openai.com (403 au fetch), recherches web, communauté OpenAI ; rien chez Anthropic, Microsoft Learn ni Mistral. Comportement d'envoi automatique de claude.ai et du Chat : inconnu.
- **Gabarit Chromium `@gemini`** : cité par prefillprompt, source Chromium non ouverte.
- **Comportement réel de chatgpt.com au-delà de 8 à 16 Ko** : non testé (pas de navigation authentifiée).
- **Open WebUI 0.11.4** : transmission ou rejet de `top_k`, `chat_template_kwargs` ; persistance des chats appelés par API ; format SSE exact. Non testé (pas d'instance).
- **Chiffres en français pour GLiNER2-PII et OpenAI Privacy Filter** : aucun publié (cartes HF, arXiv abstract).
- **Formules NIR/SIRET** : seulement python-stdnum et des sites tiers ; pas trouvé la page INSEE ou ameli.
- **Texte intégral de l'arrêt CJUE C-413/23 P** et statut final des lignes directrices EDPB 01/2025 : lus via résumés.
- **Crate Rust `phonenumber`** (port de libphonenumber) : non vérifiée.
