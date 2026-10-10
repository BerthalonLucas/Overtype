# Comparaison bornée — roadmap assistant interne

## Verdict

Branche **`origin/application-chatgpt-like-interne`**, SHA **`1cabc9537f1fd76f05d6de335ea02879ea05358d`**. Référence de l’audit actuel : **main `e202cd1f8831abc0f69435b9e2d0d96dd491e841`**. Cette branche est une **exploration documentaire, pas une implémentation ni un audit de code**. Son diff trois-points ajoute **14 fichiers / 1 613 lignes** (13 documents, quatre recherches, une ligne AGENTS). Le merge-base est `deb9f0d581e256a8f00e0fd65be6d6e89234ae50`; les écarts deux-points incluent un état applicatif ancien hérité, à ne pas publier comme nouveau travail.

**Convergence utile** : conserver Rust pour réseau/données/natif, les primitives React existantes, découper orchestration et sessions, exploiter Open WebUI pour le back-office et des bibliothèques spécialisées pour rendu/extraction. **Nuances majeures** : le socle décrit n’est plus exactement main; quelques exclusions de bibliothèques reposent sur des comportements configurables; « interne », titres en clair, temporarité et approbation d’outils demandent un contrat explicite.

Les dix points ROAD ci-dessous portent sur **risques de conception, dette documentaire ou options futures**. Leur P2/P3 exprime priorité de clarification si le projet est engagé, **pas dix bugs actuels ajoutés à main**. Aucun avis légal, aucune garantie d’anonymisation ou de conformité DLP.

## 1. Décisions, suggestions et hypothèses

| Sujet | Statut retenu | Références / lecture |
|---|---|---|
| Demandes explicites rapportées | besoins utilisateur consignés, pas acceptance technique | README:5; 05:7-9; KANBAN colonne Origine — chat local, barre, passerelles ChatGPT/Open WebUI avec masquage, gestes Windows/clic droit, usages bureautiques/logs. La dictée « Hermès Sophie final » reste interprétation incertaine, non exigence produit vérifiée. |
| Contrats main à conserver | actuels, code et AGENTS/UI-DECISIONS | main AGENTS:8-15; lib.rs:584-595; useTranslation.ts:47-58 — Revalidation de cible, presse-papiers, pas de contenu dans journaux, historique opt-in DPAPI, composants établis, preuve vraie fenêtre Windows. Rendu en bloc Îlot intentionnel pour limiter resize natif, non bug streaming. |
| Principes nouveaux | proposés | 01:3,51-59; 03:3,45-78 — Trois surfaces/un moteur, rôles, jamais repli externe silencieux, aperçu pour sortie externe, confirmation des effets de bord; Rust réseau/données et React affichage. Aucun ADR accepté fourni. |
| Choix de briques et calendrier | recommandations, pas engagements | 03:65-91; 07:3,19-25; KANBAN:16-29 — ts-rs, Channel, markdown, migrations, montée rusqlite, registre modèles, MCP et phases 0.7→1.0 proposés. Carte « prêt à planifier » ne valide pas release. |
| Arbitrages Lucas | ouverts explicitement | 02:96-103; 03:104-108; 07:37-47 — Noms, focus/Alt+Tab, raccourci, geste souris, matière, stockage/recherche et titres, mémoire des fenêtres, ordre chat/passerelles, destinations et démarches IT. |
| Cas d’usage et performances | hypothèses à mesurer | 06:3-5,72-76; recherches paysage §3 — Pastilles local et recommandation taille/contexte 14B/64k ne sont pas benchmarks. Mesurer correction/extraction FR+EN, JSON, logs, OCR, NER et outils sur modèles effectivement déployés; taille paramètres n’est pas garantie de fiabilité. |

## 2. Solutions éprouvées utiles à l’audit

Les choix restent des candidats. Priorité aux dépendances présentes; ajouter une bibliothèque seulement après comparaison de code maintenu, intégration, sécurité et coût de migration.

### Radix + Motion + Lucide + cmdk; CSS/tokens existants
Convergence forte avec FE: primitives déjà réellement réutilisées. Pas de motif pour migrer vers Tailwind/HeroUI du prototype.

**Compromis / contrôle** : Garder comportements accessibles; corriger focus/Field/store selon FE plutôt que remplacer framework.

### reqwest + Tokio + serde + client SSE existant
Convergence: TLS natif entreprise et replis provider déjà précieux. Un module LLM est opportunité, pas obligation de SDK.

**Compromis / contrôle** : La généralisation doit traiter limites SSE/DONE du main, fragments tool_calls, reasoning et budgets par usage; async-openai native-tls est alternative, non rustls obligé.

### ts-rs + Tauri Channel
Bon candidat: unique source shapes et flux ordonnés; docs Tauri confirment Channel adapté au streaming.

**Compromis / contrôle** : ts-rs n’exporte pas automatiquement noms/args de commandes/événements, permissions, defaults ni tous attributs serde. Conserver enveloppes IDs et tests de contrat; snapshot/reconnexion/session au-delà du transport.

### react-markdown + remark-gfm; remend; Shiki moteur JS
Briques établies de rendu React et coloration sans WASM; remend option de réparation de markdown incomplet, non contrôle sécurité.

**Compromis / contrôle** : HTML/images externes désactivés, URL/protocoles et ouverture contrôlés en Rust; tests injection, CSP et coût parsing. Flux chat seulement d’abord; ne pas changer geste Îlot sans choix produit. Streamdown écarté pour adéquation produit, pas vulnérabilité prouvée.

### rusqlite + DPAPI + migrations user_version
Convergence avec stockage existant. FTS sur texte chiffré par ligne ne procure pas recherche du plaintext; scan borné raisonnable pour petit volume.

**Compromis / contrôle** : Nouvelle version non requise par simple nouvelle table. Titres chiffrés vs recherche indexée SQLCipher: arbitrage performance/build/rétention, pas ajout systématique. Une seconde base de recherche est suggestion recherche, cible une seule base dans 03.

### regex + Aho-Corasick; détecteur LLM interne
Briques pertinentes sans nouveau runtime; prompts entités validés littéralement et aperçu sont bons garde-fous.

**Compromis / contrôle** : Unicode/spans/coréférence et faux négatifs à tester. Presidio benchmark serveur possible; GLiNER/camembert/ONNX options lourdes, chiffres tiers non transposables et non revalidés ici.

### windows-rs OCR + calamine/pdf-extract + zip/quick-xml
Réutilisation Windows existante et parseurs spécialisés préférables à extraction entièrement maison. panic=abort main confirme utilité du sous-processus.

**Compromis / contrôle** : Processus séparé n’est pas sandbox. Bornes mémoire/temps/archive/XML, files allowlist et permissions minimales à définir; extraction DOCX « 80 lignes » ne couvre pas tableaux/headers/notes. Aucun parseur installé ni fichier hostile testé.

### Open WebUI back-office/provider, vLLM direct pour geste court
Bonne réduction de réinvention RAG/admin; composition base /api + /v1 routes confirmée par code OWUI figé et main.

**Compromis / contrôle** : API expérimentale, permissions et latence, filtres et provider final; simple URL correcte ne valide pas streaming, citations ou gouvernance tools.

### rmcp client Rust et garde d’approbation
SDK officiel préférable à réimplémenter protocole MCP, quand besoin validé.

**Compromis / contrôle** : Maturité/versions et budget migration à vérifier au jalon; auth/SSRF/stdio/policies/approval restent à l’app. Pas de service MCP, serveur local ou installation automatique requise maintenant.

### window-state; contextMenus/native messaging; sparse package
Alternatives idiomatiques pour persistance et intégrations natives.

**Compromis / contrôle** : window-state se filtre; extension = deuxième frontend/host et parc géré; sparse = certificat/COM/déploiement Windows. Ne pas transposer menus fichier à sélection texte universelle; absence API globale reste conclusion architecturale, pas théorème vérifié par test.

## 3. Points de convergence et à confirmer

### ROAD-01 · Rebaser les constats historiques avant de planifier — P3 / dette

**Preuve** (`docs/roadmap/03-architecture.md:3,10-23` à `1cabc9537f1fd76f05d6de335ea02879ea05358d`) : La branche ajoute uniquement 14 fichiers documentaires depuis merge-base deb9f0d581e256a8f00e0fd65be6d6e89234ae50. Main est 0.6.2, recherche lit refonte-reglages 0.6.0. Main inference.rs:109-120 n’a plus max_tokens=4096; :199-210 définit idle=120s, non total. Cargo.lock:3220-3260 a déjà reqwest 0.12.28 et 0.13.4. probe.rs:711 fait un seul user, max_tokens=60, température 0 et stream=false: duplication partielle de construction/compatibilité, pas même requête.

**Impact futur** : Un refactor peut réintroduire un plafond retiré ou une migration/de-duplication inutile; le refus de flux partiel reste à préserver.

**Recommandation et compromis** : Actualiser chaque constat avec SHA main et motif du comportement. Séparer bornes transport idle, deadline facultative par usage, budget sortie et limite mémoire. Ne pas fusionner la branche entière: ses différences deux-dot incluent du code ancien hérité.

**Confiance** : élevée. Convergence avec rapports parents : ARCH-03, SEC-02, ARCH-07.

### ROAD-02 · Statut « exploration » et cartes « décidé sur le fond » à harmoniser — P3 / dette

**Preuve** (`docs/roadmap/KANBAN.md:3,16-29` à `1cabc9537f1fd76f05d6de335ea02879ea05358d`) : README:3 et AGENTS ajout déclarent rien décidé; KANBAN:16 présente OT-001 à OT-008 comme décidés sur le fond. 07:37-47 attend les choix de Lucas. La colonne Origine Lucas trace la demande rapportée, pas une validation de ts-rs, stockage ou calendrier.

**Impact futur** : Une proposition peut être traitée comme exigence et devenir un faux défaut de main.

**Recommandation et compromis** : Distinguer demande utilisateur, principe proposé, choix technique recommandé, carte prête à discussion et ADR/release effectivement validé. Aucun choix nouveau réputé accepté dans cette revue.

**Confiance** : élevée.

### ROAD-03 · Persistance automatique, titres en clair et secrets: expliciter le contrat — P2 / risque

**Preuve** (`docs/roadmap/03-architecture.md:97-106` à `1cabc9537f1fd76f05d6de335ea02879ea05358d`) : 02:51 dit conversation jamais perdue; 03:106 recommande titres en clair; recherche briques:171 affirme clés ne quittent jamais Rust. Main AGENTS:9 impose historique explicitement opt-in/chiffré; lib.rs:584-595 renvoie bien les clés à settings/setup. history.rs:29-32,53-61 chiffre source/résultat mais conserve métadonnées.

**Impact futur** : Titre auto peut contenir client/personne/projet; persistence chat peut rendre ambigu le consentement existant et créer une nouvelle rétention de pièces jointes/pseudonymes.

**Recommandation et compromis** : Choisir consentement distinct ou commun chat/historique, TTL et suppression de toutes tables/pièces/correspondances. Préférer titres chiffrés + scan borné tant qu’un titre public n’est pas choisi explicitement. Restreindre exposition des clés aux éditeurs nécessaires, sans prétendre zéro secret en React.

**Confiance** : élevée. Convergence avec rapports parents : SEC-01.

### ROAD-04 · « Interne » décrit le point d’entrée, pas toute la chaîne provider — P2 / risque

**Preuve** (`docs/roadmap/04-modeles.md:33-47,64-77` à `1cabc9537f1fd76f05d6de335ea02879ea05358d`) : 05:13-16 considère interne sans masquage. Doc officielle Open WebUI offre des modèles OpenAI/Ollama/Functions et des outils serveur; un endpoint ATE peut relayer à un fournisseur externe ou activer une recherche distante. 04:22 permet surcharge utilisateur des rôles, tandis que OT-033 promet politiques admin.

**Impact futur** : Badge interne pourrait autoriser envoi non masqué à un backend réellement externe; surcharge utilisateur pourrait neutraliser la politique annoncée.

**Recommandation et compromis** : Déclarer destination et rétention en bout de chaîne par modèle/provider, outils et filtres; inconnu doit rester inconnu. Politique machine contraignante avec précédence explicite et refus backend, distincte des préférences surchargables. Valider API keys, droits, SSE, annulation et champs étendus sur instance ATE avant intégration.

**Confiance** : élevée. Sources : S5, S7, S12.

### ROAD-05 · Passerelles URL: pas de garantie de temporarité ni de contrôle DLP — P2 / risque

**Preuve** (`docs/roadmap/05-confidentialite-et-passerelles.md:20-35,76-87` à `1cabc9537f1fd76f05d6de335ea02879ea05358d`) : La roadmap reconnaît liens SaaS non documentés et q dans historique/proxy. La doc Open WebUI récupérée confirme auto-submit par défaut mais ne documente pas submit=false; le code figé le confirme. Purview documente un contrôle collage spécifique ainsi que d’autres activités: q évite ce chemin collage, sans prouver contournement de toute DLP ni inspection Edge assurée dans chaque tenant. README:13 dit encore ChatGPT sans fuite.

**Impact futur** : URL contient une copie durable même pour destination interne; case conversation temporaire ne prouve pas activation SaaS ni absence de logs/rétention. Seuils 7000/12000 sont marges proposées, pas limites contractuelles.

**Recommandation et compromis** : Préférer copier-ouvrir sans prompt dans URL pour textes sensibles, soumis à politique IT; afficher destination exacte, copie presse-papiers et incertitudes. Tester submit/temporary sur la version déployée, login/redirections/proxy compris. Supprimer wording sans fuite/anonymisé; conserver aperçu, rappel par type et mesure documents sans fuite sans garantie.

**Confiance** : élevée. Sources : S6, S8, S13.

### ROAD-06 · Le dictionnaire Unicode et la ré-identification exigent plus qu’Aho-Corasick — P2 / risque

**Preuve** (`docs/roadmap/recherches/2026-10-10-anonymisation-passerelles.md:114,139-145,179` à `1cabc9537f1fd76f05d6de335ea02879ea05358d`) : Aho-Corasick est présenté insensible casse/accents; API n’offre que ASCII case folding. Normaliser accents change offsets octets/caractères. Coréférence par nom de famille peut confondre deux Dupont; restauration tolérante pourrait réinsérer une mauvaise valeur. Presidio sans reconnaisseurs FR spécifiques est résumé en aucun français, alors que sa doc décrit moteurs et reconnaisseurs multi-langues configurables.

**Impact futur** : Masque incorrect, entité manquée, ou ré-identification erronée lors de la future implémentation; exclusion d’un benchmark serveur sur prémisse trop large.

**Recommandation et compromis** : Garder regex/Aho-Corasick comme briques; définir normalisation Unicode et map offsets vers original, bornes lexicales et chevauchements. Token opaque unique par session + table exacte, ne pas fusionner personnes sur seul patronyme; ambiguïtés soumises à aperçu. Presidio reste candidat serveur de comparaison, pas runtime client requis. Valider règles gitleaks/checksums et faux négatifs plutôt que simple compilation.

**Confiance** : élevée. Sources : S10, S11.

### ROAD-07 · Deux alternatives établies sont écartées sur des limites configurables — P3 / option

**Preuve** (`docs/roadmap/recherches/2026-10-10-briques-techniques.md:31,90-94` à `1cabc9537f1fd76f05d6de335ea02879ea05358d`) : window-state est rejeté car sauve toutes positions/tailles, mais Builder offre with_state_flags, denylist, filter, skip_initial_state. async-openai est dit imposer rustls; Cargo officiel main propose native-tls. Main Cargo.lock contient déjà deux reqwest liés à usages légitimes. Ce ne sont pas des raisons d’adopter automatiquement les libs.

**Impact futur** : Réinvention future non justifiée ou montée globale de dépendances prématurée; slogan une seule techno confondu avec une version transitive unique.

**Recommandation et compromis** : Comparer persistance taille seule maison vs plugin Rust filtré chat/SIZE: code ajouté, comportement show/restore, coût dépendance. Garder client reqwest actuel est raisonnable pour compatibilité/replis; benchmarker API SDK avec TLS natif si expansion justifie migration. Ne monter rusqlite/reqwest que sur besoin/compatibilité/advisory prouvé, pas latest.

**Confiance** : élevée. Sources : S2, S14. Convergence avec rapports parents : DEP-001, ARCH-03.

### ROAD-08 · Tests verts et capture réutilisée « telle quelle » ne suffisent pas — P2 / risque

**Preuve** (`docs/roadmap/03-architecture.md:25,80-91` à `1cabc9537f1fd76f05d6de335ea02879ea05358d`) : Le lot 0 demande tests existants verts; 07:21-25 ajoute vraie fenêtre/captures et corpus, utile mais pas tests contractuels multi-session. Audit natif relève des limites concrètes de revalidation/provenance/collage et blocages UI; générer types ne produit pas permissions Tauri. build.rs main:1-3 appelle seulement tauri_build::build(). ts-rs ne traduit qu’une partie des attributs serde.

**Impact futur** : Chat peut conserver une vieille cible remplaçable, abonnement Channel après recharge peut perdre/rejouer deltas, nouvelles surfaces peuvent appeler commandes non autorisées; stabilité des tests historiques ne démontre aucun de ces invariants.

**Recommandation et compromis** : Avant refactor: fixture HTTP/SSE fragmentation Unicode, DONE sans EOF, erreurs bornées, délais/cancel; 2 sessions concurrentes, stale IDs, rechargement/reconnexion Channel et snapshot; pont sérialisation Option/enums et CI export types; appels IPC autorisés/refusés selon fenêtre; migration/reprise sans duplication, consentement/purge; Windows focus/DPI/UIPI/Office/Edge et clips multiformats. Réutiliser modules natifs après traitement des constats parent, pas recopier leur état.

**Confiance** : élevée. Sources : S1, S3, S15. Convergence avec rapports parents : NATIVE-001, NATIVE-002, NATIVE-003, NATIVE-005, SEC-03, NATIVE-011, ARCH-04.

### ROAD-09 · Extension et geste souris: coût/scope et modèle de confiance à fixer — P2 / risque

**Preuve** (`docs/roadmap/02-surfaces-et-gestes.md:73-90` à `1cabc9537f1fd76f05d6de335ea02879ea05358d`) : Recherche passerelles:67 écarte extension, surfaces:74 et recherche Windows phase1 la recommandent, KANBAN:60 la laisse à explorer. Main host.rs:319-335 n’arme WH_MOUSE_LL que pendant marques; :347-365 observation/CallNextHookEx, pas geste permanent consommé. Policy Edge confirme host HKCU interdit si NativeMessagingUserLevelHosts=false.

**Impact futur** : Geste disponible au repos nécessite lifecycle différent; vrai contextMenus coûte host/framing/relay + content script distinct, hors règle React seul affichage. Surface non fiable supplémentaire vers IPC/fichiers/providers.

**Recommandation et compromis** : Réconcilier extension dédiée geste navigateur vs extension passerelle; ADR coûts séparés, pas dépendance obligatoire du chat. Native messaging allowed_origins précis + schéma, limites app inférieures limites protocole, chemins canonisés, pas argv/shell arbitraire, source/contenu non fiables et destination admin. Tests down+up, exclusions, retries hook sans bloquer callback; validation policies sur parc réel. Sparse package/Copilot: preuve Windows avant promesse.

**Confiance** : élevée. Sources : S9. Convergence avec rapports parents : NATIVE-005.

### ROAD-10 · Outils serveur/MCP: même consentement que la boucle locale — P2 / risque

**Preuve** (`docs/roadmap/07-trajectoire.md:25` à `1cabc9537f1fd76f05d6de335ea02879ea05358d`) : Recherche briques:119 dit MCP pas en v1, trajectoire le place 1.0. Vision:59 exige confirmation de toute action à effet de bord; recherche briques:115 propose toujours autoriser, schéma 03:101 décision auto. Open WebUI peut exécuter tool_ids côté serveur sans carte locale de chaque opération. Spec MCP traite annotations readOnlyHint non fiables hors serveurs de confiance.

**Impact futur** : Une permission générale ou outil distant peut exécuter effet de bord non présenté, même si aucune boucle shell autonome n’est livrée.

**Recommandation et compromis** : Clarifier V1/release et périmètre tools. Préférer intégration RAG seule d’abord; si outils serveur, vérifier protocole d’approbation ou désactiver effets de bord non interceptables. Autorisation attachée serveur+outil+schéma+arguments+conversation; approbation spécifique pour écritures, limites itérations/durée/taille, cancellation et résultats non fiables. Pas d’approbation dérivée d’une annotation seule.

**Confiance** : élevée. Sources : S5, S12.

## 4. Couverture exacte

### Branche : totalité des documents ajoutés et modification AGENTS

| Fichier | Lignes dans la ref | Couverture |
|---|---:|---|
| `AGENTS.md` | 18 | contenu main lu intégralement + unique ajout de branche examiné |
| `docs/roadmap/01-vision.md` | 69 | lecture intégrale du document |
| `docs/roadmap/02-surfaces-et-gestes.md` | 103 | lecture intégrale du document |
| `docs/roadmap/03-architecture.md` | 115 | lecture intégrale du document |
| `docs/roadmap/04-modeles.md` | 77 | lecture intégrale du document |
| `docs/roadmap/05-confidentialite-et-passerelles.md` | 98 | lecture intégrale du document |
| `docs/roadmap/06-cas-usage.md` | 76 | lecture intégrale du document |
| `docs/roadmap/07-trajectoire.md` | 47 | lecture intégrale du document |
| `docs/roadmap/KANBAN.md` | 102 | lecture intégrale du document |
| `docs/roadmap/README.md` | 36 | lecture intégrale du document |
| `docs/roadmap/recherches/2026-10-10-anonymisation-passerelles.md` | 211 | lecture intégrale du document |
| `docs/roadmap/recherches/2026-10-10-briques-techniques.md` | 205 | lecture intégrale du document |
| `docs/roadmap/recherches/2026-10-10-entrees-windows.md` | 254 | lecture intégrale du document |
| `docs/roadmap/recherches/2026-10-10-paysage-ux.md` | 219 | lecture intégrale du document |

Les 13 documents totalisent **1 612 lignes**; avec l’ajout AGENTS, le diff a **1 613 insertions**. Aucun document source recopié en masse dans ce rapport.

### Main : contre-vérification, pas lecture exhaustive

- `AGENTS.md` : intégral.
- `docs/UI-DECISIONS.md` : intégral.
- `docs/BRIDGE.md` : passages contrats commandes/événements, isolation fenêtres, données et 0.6.
- `src-tauri/src/lib.rs` : 93-147,570-615,1415-1445,3188-3205.
- `src-tauri/src/inference.rs` : 1-28,40-130,195-215,220-265,275-380; diff main/ref intégral.
- `src/useTranslation.ts` : 1-90.
- `src-tauri/src/history.rs` : 1-100.
- `src-tauri/Cargo.toml` : intégral.
- `src-tauri/tauri.conf.json` : 50-85.
- `src-tauri/Cargo.lock` : blocs reqwest/rustls/updater seulement.
- `package.json` : intégral.
- `src/App.tsx` : 1-80.
- `src-tauri/src/probe.rs` : extraits modèles, requêtes/tests; 392-404,450-483,677-766 notamment.
- `src-tauri/src/host.rs` : 310-378,520-554 et extraits hook.
- `src-tauri/src/types.rs` : 410-425,500-518 et extraits historique/UI.
- `src-tauri/build.rs` : intégral.

Rapports parents JSON utilisés : `architecture`, `frontend`, `dependencies`, `security`, `native`. Fiches Agency lues et adaptées : **Tool Evaluator** (sécurité/intégration/coût, pas scoring inventé) et **Software Architect** (réversibilité/ADR/trade-offs). Aucun plugin installé et aucun exemple de fiche exécuté.

## 5. Vérifications réellement faites et limites

- `git rev-parse origin/application-chatgpt-like-interne` → 1cabc9537f1fd76f05d6de335ea02879ea05358d (code 0).
- `git diff --stat / --name-status e202cd1f8831abc0f69435b9e2d0d96dd491e841...1cabc9537f1fd76f05d6de335ea02879ea05358d` → 14 fichiers, 1613 insertions, zéro suppression; 13 nouveaux documents dont quatre recherches + unique ajout AGENTS. (code 0).
- `git merge-base e202cd1f8831abc0f69435b9e2d0d96dd491e841 1cabc9537f1fd76f05d6de335ea02879ea05358d; git log --oneline e202cd1f8831abc0f69435b9e2d0d96dd491e841..1cabc9537f1fd76f05d6de335ea02879ea05358d` → deb9f0d581e256a8f00e0fd65be6d6e89234ae50; un commit propre documentaire 1cabc95. (code 0).
- `git show 1cabc9537f1fd76f05d6de335ea02879ea05358d:<chaque document>; git show e202cd1f8831abc0f69435b9e2d0d96dd491e841:<fichiers ciblés>; git diff e202cd1f8831abc0f69435b9e2d0d96dd491e841 1cabc9537f1fd76f05d6de335ea02879ea05358d -- src-tauri/src/inference.rs` → Documents lus intégralement, extraits tronqués repris; différences baseline confirmées, pas checkout ni modification dépôt. (code 0).
- `Analyse JSON architecture/frontend/dependencies/security/native` → Constats et strengths lus/agrégés, IDs croisés sans compter nouveaux bugs du main. (code 0).
- `web_extract 13 pages officielles + urllib 4 sources code officielles ciblées` → Succès extraction; alias OWUI et submit vérifiés code figé; contre-exemples window-state, async-openai, Aho-Corasick, Presidio et Edge établis. (code 0).
- `git show e202cd1:src-tauri/src/http.rs / network.rs` → Chemins exploratoires absents, exit 128; inspection poursuivie via imports inference.rs et probe.rs, pas conclusion d’absence de client. (code 128).

- Aucun test runtime exécuté dans cette mission documentaire; pas de build/installation, pas de service, GPU, modèle téléchargé ou endpoint personnel contacté. Les checks ci-dessous sont lectures/diffs/extractions réels, pas benchmark.
- Pas de test natif Windows/Office/WebView2, coût mémoire, hook, installation sparse, OCR ou native messaging; tous exigent pilote sur parc ATE.
- Pas de session SaaS authentifiée ni mesure de liens q/temporary/longueur; pas de corpus sensible reçu ni anonymisation garantie. Aucune analyse juridique ni avis légal fourni.
- Versions récentes, F1 NER, popularité/stars et fonctionnalités de tous concurrents ne sont pas revalidés exhaustivement; éléments rapportés dans paysage restent inspiration, pas preuve de compatibilité.
- Autres branches et audit complet main restent rôle du parent/spécialistes; ici seulement branche nouvelle et contre-vérifications ciblées. Findings parents cités pour convergence, pas reproduits runtime par cette mission.
- Exclusions de bibliothèques sont jugements produit. Sources docs.rs/latest et main tierces sont mutables; captures de leur capacité ici ne prouvent pas API de chaque version citée dans roadmap. OWUI contre-vérifié sur commit 8bd8b4fa.

## 6. Sources primaires contre-vérifiées

Consultées le 10/10/2026, uniquement sur principaux choix techniques/privacy. Les autres références des quatre recherches sont lues dans leur contexte, **pas toutes revalidées**.

- **S1** [https://v2.tauri.app/develop/calling-frontend/](https://v2.tauri.app/develop/calling-frontend/) — Tauri recommande Channel pour flux rapides/ordonnés; événements JSON sans ACL fine du contenu.
- **S2** [https://docs.rs/tauri-plugin-window-state/latest/tauri_plugin_window_state/struct.Builder.html](https://docs.rs/tauri-plugin-window-state/latest/tauri_plugin_window_state/struct.Builder.html) — Builder window-state configurable: flags, denylist, filter, skip_initial_state.
- **S3** [https://github.com/remarkjs/react-markdown](https://github.com/remarkjs/react-markdown) — react-markdown: rendu React, HTML brut non interprété par défaut; plugins et URL personnalisées restent à sécuriser.
- **S4** [https://shiki.style/guide/regex-engines](https://shiki.style/guide/regex-engines) — Shiki propose moteur RegExp JavaScript sans WASM; contrôler grammaires et cible WebView2.
- **S5** [https://docs.openwebui.com/reference/api-endpoints/](https://docs.openwebui.com/reference/api-endpoints/) — API Open WebUI expérimentale; authentification, RAG, outils MCP et filtres disponibles; doc expose routes /api sans prouver tous alias /api/v1.
- **S6** [https://docs.openwebui.com/features/chat-conversations/chat-features/url-params/](https://docs.openwebui.com/features/chat-conversations/chat-features/url-params/) — q soumis automatiquement par défaut; temporary-chat documenté; submit=false non retrouvé dans cette page récupérée.
- **S7** [https://raw.githubusercontent.com/open-webui/open-webui/8bd8b4fa/backend/open_webui/main.py](https://raw.githubusercontent.com/open-webui/open-webui/8bd8b4fa/backend/open_webui/main.py) — Code figé 8bd8b4fa: alias /api/v1/models et /api/v1/chat/completions confirmés lignes 897-898,1108-1109.
- **S8** [https://raw.githubusercontent.com/open-webui/open-webui/8bd8b4fa/src/lib/components/chat/Chat.svelte](https://raw.githubusercontent.com/open-webui/open-webui/8bd8b4fa/src/lib/components/chat/Chat.svelte) — Code figé 8bd8b4fa: submit=false inhibe envoi à 2246; temporary-chat traité à 2038.
- **S9** [https://learn.microsoft.com/en-us/deployedge/microsoft-edge-browser-policies/nativemessaginguserlevelhosts](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-browser-policies/nativemessaginguserlevelhosts) — Politique Edge officielle confirme blocage des hosts natifs HKCU si NativeMessagingUserLevelHosts désactivée.
- **S10** [https://microsoft.github.io/presidio/analyzer/languages/](https://microsoft.github.io/presidio/analyzer/languages/) — Presidio extensible à plusieurs langues avec moteur NLP et reconnaisseurs adaptés; absence de détecteurs FR spécifiques ≠ impossibilité de traiter FR.
- **S11** [https://docs.rs/aho-corasick/latest/aho_corasick/struct.AhoCorasickBuilder.html](https://docs.rs/aho-corasick/latest/aho_corasick/struct.AhoCorasickBuilder.html) — ascii_case_insensitive ne traite que lettres ASCII; pas de normalisation accents/Unicode intégrée.
- **S12** [https://modelcontextprotocol.io/specification/latest/server/tools](https://modelcontextprotocol.io/specification/latest/server/tools) — Approbation humaine et validation; annotations outils non fiables hors serveurs de confiance.
- **S13** [https://learn.microsoft.com/en-us/purview/endpoint-dlp-learn-about](https://learn.microsoft.com/en-us/purview/endpoint-dlp-learn-about) — Paste to supported browsers est un contrôle spécifique; autres contrôles upload/domaines existent. Pas de preuve de contournement général ou blocage garanti de q.
- **S14** [https://raw.githubusercontent.com/64bit/async-openai/main/async-openai/Cargo.toml](https://raw.githubusercontent.com/64bit/async-openai/main/async-openai/Cargo.toml) — Cargo.toml officiel main async-openai: rustls par défaut mais native-tls optionnel. Ref mutable, pas une certification du paquet 0.42.2.

- **S15** [https://docs.rs/ts-rs/latest/ts_rs/](https://docs.rs/ts-rs/latest/ts_rs/) — ts-rs serde-compat traduit une liste bornée d’attributs; skip_serializing_if a des contraintes, skip_deserializing ignoré et attributs non pris en charge avertis.

## Suite pour le parent

Intégrer cette comparaison comme **opportunités/clarifications**, sans changer les totaux de bugs main. Les correctifs prioritaires du runtime restent ceux étayés dans les rapports spécialistes; aucune fonction future ne devient un défaut par son absence. Publication uniquement des rapports par le parent sur sa nouvelle branche; ce sous-agent n’a ni commité ni poussé.
