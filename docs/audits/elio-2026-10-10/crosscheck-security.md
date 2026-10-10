# Contre-review sécurité — Overtype

Base lecture seule : `main@e202cd1f8831abc0f69435b9e2d0d96dd491e841`. Sources : trois rapports spécialistes, code réel et APIs/docs officielles. Fiche Agency utilisée : `testing/testing-reality-checker.md` à `f99f6aa910a442b0197b768ce0ea7751e35e2060` ; principe de contre-vérification des preuves retenu, scripts Laravel/screenshots et biais « défaut obligatoire » non applicables. Aucun verdict production-ready.

## Synthèse

- Les advisories mentionnés existent : aucun CVE inventé. **Un piège de source : le rendu extrait de la page vLLM cache_salt laisse CVE vide, mais l’API officielle du dépôt donne `CVE-2026-100647`.** Pour stop_token_ids, elle donne `null` : conserver le GHSA sans créer de CVE.
- **SQLite : défaut confirmé pour le build bundled par défaut**, avec nettoyage logique mais résidus synthétiques chiffrés et métadonnées. Ce n’est pas encore une reproduction du binaire Windows lié à rusqlite. Contre-exemple compilé `SQLITE_SECURE_DELETE=1` réel : les résidus disparaissent sans changer le SQL de réouverture. Un lecteur maintenant un snapshot conserve toutefois les anciennes données dans le WAL même avec ON.
- **Inférence : bornage bytes/cancellation erreurs absent, et `[DONE]` ne quitte pas la boucle.** En revanche deadline globale et `max_tokens=4096` ont été retirés volontairement : ne pas les rétablir au nom d’une garantie inexistante.
- Isolation Tauri : manque de gardes confirmé, mais exploitation exige déjà JS compromis dans une fenêtre locale bundled. Pas de XSS/RCE établi. Supply-chain Actions : un seul risque conditionnel, dédoublonner SEC-05/DEP-003. Archives recovery : **branche WIP uniquement**, pas main.
- 7 points confirmés, 3 nuancés, 2 assertions/contre-arguments rejetés. Ces entrées sont des décisions de contre-review, **pas douze nouveaux défauts indépendants** ; les deux rejets ne décrivent pas des constats affirmés par les rapports.

## Advisories officiels exacts

| GHSA | CVE officiel | Affectées | Corrigées | Gravité upstream | Publication API UTC |
|---|---|---|---|---|---|
| GHSA-wpww-v874-ph2p | CVE-2026-100647 | <0.29.0 | >=0.29.0 | medium | 2026-09-12T08:49:34Z |
| GHSA-v5gm-qgmv-gc6c | Non attribué (API null) | < 0.29.0 | >= 0.29.0 | medium | 2026-09-12T14:45:55Z |
| GHSA-68fv-2mgg-jv7q | CVE-2026-93749 | >= 1.0.0, < 1.2.2 | 1.2.2 | high | 2026-09-18T18:31:44Z |
| GHSA-vfj7-8cjw-p6xm | CVE-2026-93687 | <= 3.0.3 | Aucun publié | high | 2026-09-18T18:31:41Z |

Sources machine, timestamps de consultation et versions corrigées exactes : `crosscheck-security-sources.json`. Pour vLLM, la route API globale retourne 404 ; la route officielle `/repos/vllm-project/vllm/security-advisories/<GHSA>` retourne les détails. Ce 404 ne réfute pas l’existence de l’avis.

**Scope :** vLLM est un moteur séparé, image Compose `v0.28.0` par digest `sha256:61fc8a896b0a4fbbbdc063bc4b0dbc25ce98e02b5050c24aeb7830ac02039b14`. L’artifact registry local renvoie ce même Docker-Content-Digest. Rien n’a été lancé. La portée source-map-js/braces est build/test/prototype ; les drapeaux npm « prod/dev » ne sont pas un graphe runtime de l’exécutable desktop. Pas de chemin des sorties modèle vers ces parsers établi. Le client natif ne transmet ni cache_salt ni stop_token_ids/min_tokens ; un autre client HTTP joignable reste nécessaire.

## Verdicts détaillés

### XSEC-01 — CONFIRMÉ — Advisories vLLM exacts et version exposée, sous condition de joignabilité

Références : DEP-001. P2 / risque, `main@e202cd1f8831abc0f69435b9e2d0d96dd491e841`, `server/compose.yaml:4,17,37`.

- **Preuve :** GHSA-wpww-v874-ph2p: <0.29.0, patch >=0.29.0, medium; API officielle cve_id=CVE-2026-100647. GHSA-v5gm-qgmv-gc6c: < 0.29.0, patch >= 0.29.0, medium, cve_id=null. Compose v0.28.0 et digest concordant avec artifact registry Docker. cache_salt exige cache préfixe (activé par défaut upstream); stop_token_ids invalide exige min_tokens>0. request_body inference.rs:109-120 ne transmet aucun de ces paramètres.
- **Portée/impact :** DoS moteur via client HTTP direct local ou proxy partagé autorisé; pas exploitation distante du desktop ni fuite/RCE démontrée. Ports loopback atténuent la surface mais ne filtrent pas les autres clients locaux.
- **Suite recommandée :** Conserver loopback, limites corps/champs au proxy; qualifier >=0.29.0 et digest sur matériel cible, sans mise à latest aveugle.
- **Limite :** Pas de GPU, image chargée ni test modèle. Le CVE cache_salt est fourni par API repo; extraction HTML laisse sa rubrique CVE vide: ne pas conclure à absence de CVE depuis ce seul rendu.

### XSEC-02 — CONFIRMÉ — source-map-js et braces: advisories exacts, tooling et non faille desktop prouvée

Références : DEP-002. P3 / risque, `main@e202cd1f8831abc0f69435b9e2d0d96dd491e841`, `package-lock.json:3065`.

- **Preuve :** GHSA-68fv-2mgg-jv7q / CVE-2026-93749: >=1.0.0,<1.2.2; fix 1.2.2; lock 1.2.1. GHSA-vfj7-8cjw-p6xm / CVE-2026-93687: <=3.0.3; first_patched_version=null; lock prototype braces 3.0.3. Sources GitHub Reviewed et API officielle enregistrées. Chaîne source-map-js via postcss; braces via micromatch et @parcel/watcher. Aucun import de ces parsers dans src.
- **Portée/impact :** DoS sur sourcemap indexée/glob hostile consommé par tooling. Le flag dev absent dans lock racine vient aussi de Vite en dependencies: il ne prouve pas reachability WebView. Cinq entrées audit du prototype ne sont pas cinq advisories distincts.
- **Suite recommandée :** Fix source-map-js ciblé 1.2.2 et tests/build; pour braces surveiller patch et contrôler entrée de patterns. Ne pas présenter braces 3.0.3 comme fix de cet avis ni rétrograder Tailwind selon audit fix.
- **Limite :** Pas de nouveau npm audit/build exécuté; locks et artifacts locaux réexaminés. Pas de preuve de contrôle attaquant sur les entrées réelles.

### XSEC-03 — NUANCÉ — secure_delete oublié à la réouverture: repro exact SQLite, pas preuve du binaire rusqlite livré

Références : SEC-01. P2 / bug, `main@e202cd1f8831abc0f69435b9e2d0d96dd491e841`, `src-tauri/src/history.rs:20,28,48,49,59,66,76,81,113`.

- **Preuve :** new active ON puis ferme; connection ouvre sans ON; prune startup est donc protégée, prune add/list/maintain et delete ne le sont pas par défaut. Crate libsqlite3-sys 0.35.0 hash 133c182a6a2c87864fe97778797e46c7e999672690dc9fa3ee8e241aa4a9c13f vérifié au Cargo.lock; C extrait identique à fixture initiale. Compilation indépendante C SQLite 3.50.2: réouverture=0, COUNT=0 mais ciphertext/action synthétiques présents; ON par connexion les retire du main. Build avec SQLITE_SECURE_DELETE=1: réouverture=1 et résidus absents, contre-exemple réel. build.rs upstream autorise LIBSQLITE3_FLAGS et override pkg-config.
- **Portée/impact :** Rétention logique ≠ nettoyage pages; action/server/date clair, payload chiffré. P2 conditionnel à accès fichiers et historique opt-in. Pas de texte clair ni blob DPAPI entier récupéré/déchiffré prouvé.
- **Suite recommandée :** ON dans chaque ouverture; test rusqlite Windows de close/reopen et suppressions/prune, plus coordination checkpoint WAL. Aucun besoin de remplacer rusqlite.
- **Limite :** La fixture utilise ctypes pour piloter C, NON sqlite3 Python, NON Rust lié, NON DPAPI. Builds C n’émulent pas toutes options du build Cargo. Flags/environnement exacts du binaire installé inconnus; aucun défaut garantit tous binaires.

### XSEC-04 — CONFIRMÉ — secure_delete ON ne suffit pas à purger un WAL maintenu par lecteur

Références : SEC-01. P2 / risque, `main@e202cd1f8831abc0f69435b9e2d0d96dd491e841`, `src-tauri/src/history.rs:28,113,125`.

- **Preuve :** Fixture avec ON par connexion, insertion et snapshot lecteur conservés: COUNT=0, marqueurs absents main, ciphertext/action encore dans -wal. Sans lecteur retenu, fixture ON nettoie main. Résultat dans crosscheck-security-sqlite.log.
- **Portée/impact :** Fenêtre de résidus sur WAL; pas promesse de récupération après chaque fermeture ni conservation systématique du WAL. Backups/SSD restent hors garantie.
- **Suite recommandée :** Politique purge explicite checkpoint/TRUNCATE avec busy reconnu; ne pas annoncer effacement physique absolu.
- **Limite :** Snapshot lecteur synthétique local, pas concurrence native de l’app mesurée.

### XSEC-05 — NUANCÉ — Bornage mémoire et cancellation erreurs: risque réel; timeout global/max_tokens retirés intentionnellement

Références : SEC-02, ARCH-03. P2 / risque, `main@e202cd1f8831abc0f69435b9e2d0d96dd491e841`, `src-tauri/src/inference.rs:23,24,145,166,199,209,262,273,296`.

- **Preuve :** Vec SSE sans plafond, rescans depuis début; thinking conserve bloc non fermé; résultat accumulé; response.text().await sans select cancellation. probe.rs:419-448 fournit bounded_body 2 MiB cancellable. idle reqwest 120 s et watchdog silence 150 s existent; i.touch à chaque chunk émis. Commit 744706d29c7898d66c505b1397552be1cb7be8d4 du 2026-10-08 retire explicitement max_tokens=4096 et total timeout.
- **Portée/impact :** Endpoint configuré hostile/bogué peut fournir événement énorme, erreur énorme ou deltas infinis; coût mémoire/CPU et annulation lente erreur. Le watchdog peut annuler un thinking/no-frame silencieux côté UI, mais ne constitue pas plafond bytes ni arrêt des deltas continus. Pas RCE.
- **Suite recommandée :** Réutiliser lecture bornée+cancellable pour erreurs; limite événement/texte compatible 200000 caractères, suffixe seul pour thinking, scan incrémental. Retenir bornage bytes sans réintroduire par défaut deadline globale ou 4096 tokens.
- **Limite :** Pas d’OOM/RSS ni tests Rust; risque conditionnel et statique. Un timeout global optionnel est décision produit, non correctif obligatoire.

### XSEC-06 — CONFIRMÉ — [DONE] ne termine pas le stream native

Références : ARCH-07. P2 / risque, `main@e202cd1f8831abc0f69435b9e2d0d96dd491e841`, `src-tauri/src/inference.rs:279,285,301,306,310,314`.

- **Preuve :** Item::Done fait seulement done=true; sortie loop uniquement None/cancel/erreur. stop+[DONE] suivi corps qui reste ouvert attend encore et peut produire Timeout; erreur transport après DONE refuse aussi. decoder.finish puis done&&stop et résultat non vide sont requis.
- **Portée/impact :** Disponibilité/compatibilité d’un proxy endpoint configuré, pas fuite ni attaque Internet sans endpoint hostile. Pas preuve que vLLM livré garde corps ouvert. La propriété du code est certaine, occurrence terrain inconnue.
- **Suite recommandée :** Stopper consommation à sentinelle terminale en conservant finish_reason=stop; tester stop+DONE/socket maintenue et DONE sans stop. Clarifier traitement données post-DONE.
- **Limite :** Statique seulement, aucune fixture Rust exécutée; ne pas annoncer repro natif réussi.

### XSEC-07 — CONFIRMÉ — Isolation fenêtres des commandes custom réellement partielle

Références : SEC-03. P2 / risque, `main@e202cd1f8831abc0f69435b9e2d0d96dd491e841`, `src-tauri/src/lib.rs:584,595,665,671,2842,2846`.

- **Preuve :** get_settings filtre clés selon KEYED; save_settings/get_history/delete_history sans WebviewWindow ni garde. update.rs:110 install_update aussi. build.rs ne fournit pas AppManifest::commands. Docs Tauri déclarent explicitement invoke_handler autorisé à toutes fenêtres/webviews par défaut.
- **Portée/impact :** Après compromission JS préalable d’une fenêtre locale bundled, lecture historique déchiffré et modification destination. Ce n’est ni XSS prouvé ni accès d’une page web distante quelconque. install_update reste signature contrôlée: pas téléchargement/exécution arbitraire depuis argument libre.
- **Suite recommandée :** Garde Rust sur commandes administratives ou manifest permissions Tauri par fenêtre, garder actions overlay permises.
- **Limite :** IPC natif non exécuté. CSP et rendu texte atténuent; absence de vecteur frontend démontré.

### XSEC-08 — CONFIRMÉ — Document TLS obsolète, HTTP distant voulu

Références : SEC-04. P3 / dette, `main@e202cd1f8831abc0f69435b9e2d0d96dd491e841`, `docs/ENDPOINTS.md:27,29,31`.

- **Preuve :** ENDPOINTS prétend HTTPS obligatoire et total timeout 120 s. settings.rs:541-548 accepte explicitement HTTP any host depuis 0.6; insecure flag 535. inference ajoute bearer lorsque clé autorisée. Commit limites retire délai total.
- **Portée/impact :** Risque interception si HTTP distant choisi; pas bypass certificat ni régression accidentelle. Dette documentaire contient aussi délais et contrat endpoints historiques.
- **Suite recommandée :** Actualiser docs vers HTTP averti et timeout silence; recommander HTTPS sans forcer suppression support LAN voulu.
- **Limite :** Normalisation Rust statique, pas réseau.

### XSEC-09 — NUANCÉ — Tags Actions et Rust stable: un seul risque supply-chain conditionnel

Références : DEP-003, SEC-05. P2 / risque, `main@e202cd1f8831abc0f69435b9e2d0d96dd491e841`, `.github/workflows/release.yml:15,16,23,42,46,47,56,59,63`.

- **Preuve :** Tags checkout/setup-node/rust-cache et stable non SHA dans job contents:write; secret seulement étape build sign, étapes précédentes peuvent modifier workspace. Même cause dans deux rapports. npm ci et cargo --locked présents.
- **Portée/impact :** Durcissement pipeline de confiance; aucun Action compromis ni clé exposée au constat. Toolchain floating est reproductibilité/qualification, pas CVE en soi. P2 priorité politique, pas incident ou exploit reproduit.
- **Suite recommandée :** Pin SHA Actions, outil Rust compatible et qualification; séparation privilèges/provenance/environnement protégé selon politique.
- **Limite :** Protections réelles GitHub et secrets non consultés.

### XSEC-10 — CONFIRMÉ — Archives WIP hors rétention: branche uniquement

Références : SEC-06. P2 / risque, `origin/wt-050-natif@1fcdd21f0aadd5a36978e47e6530b9fe9f1c74bd`, `src-tauri/src/history.rs:29,46`.

- **Preuve :** git show origin/wt-050-natif: recover renomme base/-wal/-shm en history.illisible-<stamp> puis new; chemins delete/prune visent uniquement history.sqlite3. Fonction absente main. Erreur open quelconque, rename best-effort.
- **Portée/impact :** Conservation hors politique si branche reprise et rename possible. DPAPI n’est pas invalidé par changement de nom. Métadonnées récupérables indépendamment du déchiffrement. Une base corrupt peut avoir payload illisible, mais toutes erreurs new ne signifient pas tous blobs inutilisables.
- **Suite recommandée :** Avant reprise, politique archives/purge/rétention visible et distinction erreur accès/corruption, sans fusion automatique.
- **Limite :** Pas corruption/renommage runtime provoqué; P2 dormant non additionné à main.

### XSEC-11 — REJETÉ — Déduire de DPAPI que les résidus deviennent nécessairement inutilisables

Références : SEC-01, SEC-06. P3 / option, `main@e202cd1f8831abc0f69435b9e2d0d96dd491e841`, `src-tauri/src/crypto.rs:13,19,43,49`.

- **Preuve :** CryptProtectData utilise contexte utilisateur, UI_FORBIDDEN et aucune entropy additionnelle. Pas clé par ligne détruite à DELETE/rename. Microsoft: normalement mêmes identifiants et même ordinateur. Crate features bundled ≠ SQLCipher et ne prouvent pas crypto-erasure.
- **Portée/impact :** Un autre compte ne peut normalement pas déchiffrer, et un blob partiel peut échouer MAC; cela ne rend pas toute rétention inoffensive: metadata clair et récupération possible blob entier sous contexte autorisé. Ne pas affirmer toute page résiduelle permet récupérer texte.
- **Suite recommandée :** Conserver qualification encryption/metadata/contexte/complétude distincte, aucune nouvelle crypto ad hoc.
- **Limite :** Aucun déchiffrement Windows exécuté. Rejet d’un contre-argument, pas nouveau défaut confirmé.

### XSEC-12 — REJETÉ — Absence de timeout global ou max_tokens n’est pas seule un bug à réparer

Références : SEC-02, ARCH-03. P3 / option, `main@e202cd1f8831abc0f69435b9e2d0d96dd491e841`, `src-tauri/src/inference.rs:109,112,199,209`.

- **Preuve :** Intention commit 744706d explicitement vérifiée: permettre longs textes sans deadline totale. Connect et silence bornés restent présents.
- **Portée/impact :** Assimiler durée non bornée au défaut produit annulerait décision récente. En revanche taille mémoire/corps hostiles et cancellation erreurs sont des risques indépendants confirmés XSEC-05.
- **Suite recommandée :** Ne pas restaurer silencieusement ancien plafond; appliquer contrôles ressources compatibilité produit.
- **Limite :** Rejet partiel de recommandation SEC-02, pas du constat absence limites bytes.

## Ce que prouve exactement la fixture SQLite

Le crate public exact est téléchargé puis SHA-256 vérifié contre Cargo.lock ; son C est identique au C du premier rapport. Deux bibliothèques C sont recompilées indépendamment. Python **pilote l’ABI C avec ctypes** : sa propre distribution SQLite ne participe pas au résultat. Version C rapportée par `sqlite3_libversion()` : 3.50.2. Les bibliothèques de cette contre-review utilisent les options explicitement consignées, pas une prétendue résolution complète des features Cargo/Windows.

| Cas exécuté | secure_delete réouvert | COUNT après prune | Marqueurs après suppression |
|---|---:|---:|---|
| Default SQLite, ON seulement à l’initialisation | 0 | 0 | payload synthétique et action présents dans main |
| ON à chaque connexion | 1 | 0 | absents main (aucun lecteur retenu) |
| Default compilé `SQLITE_SECURE_DELETE=1`, ON seulement à l’initialisation | 1 | 0 | absents main |
| ON à chaque connexion, lecteur/snapshot retenu | 1 | 0 | absents main, présents WAL |

Les payloads sont des placeholders répétitifs, **pas du DPAPI réel** : on prouve la rétention des octets, pas le déchiffrement ni la reconstruction d’un blob DPAPI valide. Pour qu’un utilisateur autorisé déchiffre il faut notamment récupérer un blob suffisamment complet et disposer de son contexte DPAPI. La fixture démontre le cycle prune âge/count ; le premier rapport couvrait aussi DELETE all. L’init prune est sous ON : ne pas dire « aucune suppression protégée ». L’environment `LIBSQLITE3_FLAGS` ou override pkg-config peut changer le défaut du SQLite effectivement lié ; les workflows du repo examinés ne définissent pas ces overrides, mais le binaire installé n’est pas vérifié.

Premier essai de fixture WAL : assertion échouée, car fermeture de dernière connexion après insertion avait checkpointé avant création du snapshot. Fixture corrigée pour garder connexion puis snapshot ; quatre scénarios et assertions repassés, exit 0. Aucune correction produit.

## Vérifications réellement exécutées et limites

- SHA et état Git lus au début/fin : base attendue, worktree propre.
- Requêtes lecture seule GitHub API + pages officielles ; quatre advisories et champs CVE/range/patch revérifiés. Artifacts registry npm/Docker consultés sélectivement, locks réinspectés ; pas nouvel audit npm/build ni inventaire exhaustif de tous advisories.
- Téléchargement crate et hash, compilation C `cc` (deux configurations), fixture `python -B repro.py` : exit 0 final, journal `crosscheck-security-sqlite.log`.
- `git show` du commit limites `744706d29c7898d66c505b1397552be1cb7be8d4` (date source Git : 2026-10-08) et history WIP ; contrôle statique appel/guards/stream réel.
- Cargo absent : **pas de tests Rust**, ni reproduction SSE native ou mesures RSS. Pas Windows/DPAPI/Tauri IPC, chargement image, GPU, modèle ni endpoint réel. Aucune affirmation d’exploitabilité terrain sans ces réserves.

Couverture : main fichiers ciblés répertoriés dans JSON ; branche `origin/wt-050-natif` uniquement recovery history, pas nouvelle analyse de toutes les refs. Rapports dependencies/security/architecture examinés, sans reclasser les sujets non sécurité (i18n, script captures, preflight) ni les anciens RustSec hors périmètre demandé.

## Sources / livrables

- `crosscheck-security.json` : verdicts structurés, refs, preuves, checks, coverage, limites et sources.
- `crosscheck-security-sources.json` : réponse réduite officielle des quatre advisories, dates et URLs exactes.
- `crosscheck-security-sqlite.log` : sortie réelle des quatre scénarios.
- Repro privé : `artefacts-locaux/crosscheck-security-work/repro.py`, C exact et deux `.so`.
- SQLite : https://www.sqlite.org/pragma.html#pragma_secure_delete (défaut compile-time, connexion/cache partagé et limites).
- DPAPI : https://learn.microsoft.com/en-us/windows/win32/api/dpapi/nf-dpapi-cryptprotectdata (contexte utilisateur, non-machine et conditions de déchiffrement).
- Tauri : https://v2.tauri.app/security/capabilities/ (invoke_handler permis par défaut, AppManifest::commands pour restriction).

Aucun repo partagé, configuration, mémoire ou skill modifié ; aucun secret ou données utilisateur lus, aucun service réel contacté, aucune publication. Les recommandations restent de l’audit, non des changements appliqués.
