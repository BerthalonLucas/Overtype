# Registre consolidé des constats

Main audité : `e202cd1f8831abc0f69435b9e2d0d96dd491e841`. **40 sujets**, dont 39 main et un risque limité à une branche WIP. **4 P1 / 23 P2 / 13 P3**. Les apports tiers et dix clarifications de roadmap restent dans leurs comparaisons, sans gonfler ce registre.

## Échelle et preuve

- P1 : priorité avant extension fonctionnelle, intégrité du texte ou réactivité/annulation. Les quatre P1 ici sont statiques et non reproduits sur Windows.
- P2 : défaut ou risque significatif borné ; vérifier préconditions et coût.
- P3 : dette, ergonomie ou durcissement non urgent.
- La présence de deux avis concordants ne prouve pas une occurrence runtime. Les contre-exemples font partie du constat.

## Index

| ID | Priorité | Catégorie | Sujet |
|---|---|---|---|
| [NATIVE-001](#native-001) | P1 | risque | La revalidation UIA autorise une cible devenue invérifiable |
| [NATIVE-002](#native-002) | P1 | risque | Deux copies identiques ne prouvent pas qu’une sélection existe |
| [NATIVE-005](#native-005) | P1 | risque | Des commandes synchrones peuvent bloquer le thread UI et son hook clavier |
| [NATIVE-006](#native-006) | P1 | risque | La fermeture d’urgence ne révoque pas une livraison déjà entrée dans son verrou |
| [ARCH-01](#arch-01) | P2 | bug | Le preflight ne lit pas la configuration effective de Compose |
| [ARCH-02](#arch-02) | P2 | bug | Le parseur SSE Python refuse des événements valides et peut laisser échapper une exception |
| [ARCH-03](#arch-03) | P2 | risque | Les lecteurs de génération ne bornent ni les événements ni les corps d’erreur |
| [ARCH-04](#arch-04) | P2 | dette | L’orchestration native concentre plusieurs invariants dans lib.rs |
| [ARCH-07](#arch-07) | P2 | risque | La fin [DONE] du flux ne termine pas la lecture native |
| [BR-02](#br-02) | P2 | risque | La récupération non destructive des réglages illisibles n’a pas été reprise |
| [DEP-001](#dep-001) | P2 | risque | vLLM 0.28.0 possède des advisories DoS atteignables par les paramètres des routes texte |
| [DEP-003](#dep-003) | P2 | risque | La signature de release dépend d’Actions et d’un compilateur flottants |
| [FE-01](#fe-01) | P2 | bug | Le dialogue de copie manuelle du journal perd le focus à la fermeture |
| [FE-02](#fe-02) | P2 | risque | Une lecture initiale tardive réadopte des réglages périmés |
| [FE-03](#fe-03) | P2 | risque | Field ne relie pas les problèmes et aides au contrôle |
| [NATIVE-003](#native-003) | P2 | risque | Le changement global du presse-papiers est attribué à la copie de la source sans provenance |
| [NATIVE-004](#native-004) | P2 | bug | Le repli TextOnly détruit silencieusement les formats non conservables |
| [NATIVE-007](#native-007) | P2 | bug | La copie ne libère pas les touches après SendInput partiel, contrairement au collage et à PR6 |
| [NATIVE-008](#native-008) | P2 | bug | Une liste actions vide fait paniquer le démarrage avant validate |
| [NATIVE-009](#native-009) | P2 | bug | L’historique optionnel est une condition obligatoire de démarrage |
| [NATIVE-010](#native-010) | P2 | bug | confirmed=true peut signaler un collage qui n’a rien changé |
| [NATIVE-012](#native-012) | P2 | risque | La capture UIA ignore les plages supplémentaires d’une sélection multiple |
| [QA-01](#qa-01) | P2 | risque | Le test de démarrage serveur Windows est toujours sauté dans la CI déclarée |
| [QA-02](#qa-02) | P2 | risque | La publication ne dépend pas des checks E2E ni du harness serveur |
| [QA-03](#qa-03) | P2 | risque | La voie CI native ne valide pas le remplacement réel d’un éditeur |
| [SEC-01](#sec-01) | P2 | bug | Effacement SQLite: secure_delete ne couvre pas les connexions qui suppriment |
| [ARCH-05](#arch-05) | P3 | bug | Une erreur d’écriture de réglages reste française sous une interface anglaise |
| [BR-04](#br-04) | P3 | risque | Le verre Afficher le résultat n’a pas repris la persistance des erreurs |
| [BR-05](#br-05) | P3 | dette | Le type-check des tests Playwright de wt-050-atelier est absent du build |
| [DEP-002](#dep-002) | P3 | risque | Les locks npm conservent deux advisories de la chaîne build/test, sans exploit desktop démontré |
| [DEP-004](#dep-004) | P3 | bug | Le script de captures du prototype résout Playwright depuis un checkout personnel absolu |
| [FE-04](#fe-04) | P3 | bug | La copie réussie du résultat ne change jamais son message de statut |
| [FE-05](#fe-05) | P3 | dette | La mécanique de persistance des Réglages et de l’accueil est dupliquée |
| [NATIVE-011](#native-011) | P3 | risque | Les capabilities ne cloisonnent pas les commandes métier entre WebViews |
| [QA-04](#qa-04) | P3 | dette | Les échecs fonctionnels sensibles à la charge n’ont pas de trace conservée |
| [QA-05](#qa-05) | P3 | dette | Les comparaisons visuelles Windows ne sont pas une gate CI |
| [QA-06](#qa-06) | P3 | bug | Le générateur de kit d’essai n’est plus utilisable tel quel pour 0.6.2 |
| [QA-07](#qa-07) | P3 | risque | Capture-matrix consigne les divergences sans les transformer en échec |
| [SEC-04](#sec-04) | P3 | dette | La documentation assure encore un refus HTTP distant qui n’existe plus |
| [SEC-06](#sec-06) | P2 | risque | Branche WIP: archives de récupération de l’historique hors purge |

<a id="native-001"></a>
## NATIVE-001 — La revalidation UIA autorise une cible devenue invérifiable

**P1 · risque · main**. Sources regroupées : NATIVE-001.
Localisation : `main` · `src-tauri/src/capture.rs:[428, 513]`.
Niveau de preuve : inspection-statique/documentation; comportement natif non exécuté.

**Constat après contre-review :** Le chemin de collage accepte effectivement une perte de lecture UIA : absence du focused element, runtime id illisible ou erreur de sélection autre que NO_SELECTION. Pour une cible UIA capturée avec identité, aucune deuxième copie ne remplace cette preuve. Le watcher emploie exactement le même validateur. Le risque de collage après déplacement interne reste valide, mais ce n’est pas une omission accidentelle : commentaires et tests consacrent explicitement ce choix.

**Gardes et réserves :** Le foreground, un changement de contrôle connu, un runtime id différent connu, un texte/longueur/anchor différents et une sélection explicitement collapsed sont refusés; trois validations entourent les attentes et l’écriture du clipboard. Le code ne laisse donc pas passer toute modification. UI-DECISIONS:22 autorise l’absence de relecture DU DOCUMENT; elle ne fournit pas de preuve de sélection/identité. BRIDGE et tests admettent cependant le provider silencieux : tension entre contrat de sécurité AGENTS/SPEC et compatibilité documentée, à résoudre explicitement.

**Suite proposée :** Conserver le collage sans lecture du document; préciser une preuve de sélection/identité de remplacement quand UIA devient muette, sinon Copier. Ne pas rétablir la précondition whole-document de PR6.

**Limites/confiance :** élevée (preuve statique; Windows non exécuté)


<a id="native-002"></a>
## NATIVE-002 — Deux copies identiques ne prouvent pas qu’une sélection existe

**P1 · risque · main**. Sources regroupées : NATIVE-002.
Localisation : `main` · `src-tauri/src/capture.rs:[202, 212]`.
Niveau de preuve : inspection-statique/documentation; comportement natif non exécuté.

**Constat après contre-review :** replaceable(Copy)=true et same_copy vérifie exclusivement l’égalité du texte non vide. Une copie sans sélection produisant la même ligne est mathématiquement indiscernable d’une sélection dans cette implémentation. Le cas dangereux reste plausible et important pour l’intégrité du document.

**Gardes et réserves :** La seconde copie n’est PAS absente : elle refuse une sélection perdue si la ligne copiée diffère du texte capturé. Le scénario VS Code/Monaco dépend du réglage copy-without-selection, de Ctrl+Insert et de l’accessibilité réelle du provider/version; il n’est pas une reproduction universelle. Si UIA expose la sélection, le chemin Uia remplace le scénario Copy. Après collage, certains cas de lecture seule sont détectés, mais une insertion réellement faite n’est pas annulée par ces checks.

**Suite proposée :** Prouver le cas sur un éditeur et ses réglages avant annoncer duplication reproduite; utiliser une preuve de sélection native/UIA ou adaptateur borné sans imposer lecture du document.

**Limites/confiance :** élevée (preuve statique; Windows non exécuté)


<a id="native-005"></a>
## NATIVE-005 — Des commandes synchrones peuvent bloquer le thread UI et son hook clavier

**P1 · risque · main**. Sources regroupées : NATIVE-005.
Localisation : `main` · `src-tauri/src/lib.rs:[989, 991]`.
Niveau de preuve : inspection-statique/documentation; comportement natif non exécuté.

**Constat après contre-review :** La règle API Tauri confirme sync sans command(async) exécuté sur main thread. get_settings/copy_result/frontend_ready peuvent attendre inner, détenu tout au long de paste et locate. Le hook LL est installé dans setup sur le thread appelant; les threads menu-keys/undo-watch ne déplacent PAS l’installation. Le risque UI/hook est fondé.

**Gardes et réserves :** Le raccourci normal et les livraisons sont déjà spawn_blocking; l’appel demo à capture_text aussi. La méthode bridge.captureText n’a pas de call-site de production trouvé dans src : ne pas décrire ce seul invoke comme le parcours quotidien. En revanche getSettings est appelé par plusieurs vues. Retrait du hook n’est ni certain à chaque livraison ni mesuré : il faut un blocage dépassant le timeout pendant une notification clavier. Les handles natifs cachés évitent un autre deadlock mais pas l’attente mutex UI.

**Suite proposée :** Raccourcir le lock et sortir des commandes UI les attentes; hook sur thread dédié pompant. Garder les appels fenêtre main-thread où Tauri l’exige.

**Limites/confiance :** élevée (preuve statique; Windows non exécuté)


<a id="native-006"></a>
## NATIVE-006 — La fermeture d’urgence ne révoque pas une livraison déjà entrée dans son verrou

**P1 · risque · main**. Sources regroupées : NATIVE-006.
Localisation : `main` · `src-tauri/src/lib.rs:[1962, 1986]`.
Niveau de preuve : inspection-statique/documentation; comportement natif non exécuté.

**Constat après contre-review :** force_close cache la fenêtre et ferme les scopes atomiques, mais close_now attend inner dans un autre thread. Un worker gardant inner pendant UIA peut reprendre et envoyer Ctrl+V après cette fermeture, tant que ses checks cible passent. Le watcher n’est pas une garde externe : il attend lui aussi inner. Aucun token indépendant n’est consulté par paste avant SendInput.

**Gardes et réserves :** claim_delivery empêche bien les doubles livraisons; pending_dismiss/visible/active sont testés AVANT de prendre la cible. Ces protections marchent si la fermeture obtient le lock avant delivery. Elles ne rendent pas révocable le travail natif déjà engagé. La nouvelle capture est bloquée plutôt qu’une livraison concurrente; il ne faut pas annoncer injection annulable une fois envoyée. Scénario watchdog accessible via try_lock + lock stuck même si main est gelé.

**Suite proposée :** Poser une génération/latch indépendant dès annulation, relire après attentes et juste avant injection. Ne pas prétendre qu’un timeout tokio tue COM.

**Limites/confiance :** élevée (preuve statique; Windows non exécuté)


<a id="arch-01"></a>
## ARCH-01 — Le preflight ne lit pas la configuration effective de Compose

**P2 · bug · main**. Sources regroupées : ARCH-01.
Localisation : `main` · `server/preflight.py:[21, 55]`.
Niveau de preuve : reproduction ciblée synthétique; limites détaillées dans le rapport spécialisé.

**Constat et preuve :** load_env_file retire seulement les guillemets et effective_settings choisit les chaînes vides au lieu des défauts ${VAR:-default}. Repro réelle : FAST_PORT=9011 # comment et FAST_PORT=${MY_PORT} lèvent ValueError ; FAST_GPU= donne gpu="". Docker documente commentaires, interpolation et défaut pour une variable vide. server/README.md:8 promet la même précédence et start.ps1:51-52 bloque le lancement sur refus.

**Impact :** Une configuration Compose valide peut être refusée ; la réserve GPU peut viser une valeur différente de celle du conteneur. Les lignes simples livrées restent prises en charge.

**Suite proposée :** Faire résoudre le modèle par docker compose config --format json avec exactement les mêmes -f/--env-file/profiles que start.ps1, puis ne lire que GPU et port effectifs. Ne jamais journaliser le modèle complet, qui peut contenir des secrets. Alternative limitée : annoncer et valider explicitement un sous-ensemble .env, plutôt que prétendre équivalence Compose.

**Coût et compromis :** Petit changement du préflight/lanceur et fixtures ; un processus Compose supplémentaire, Docker CLI déjà requis. python-dotenv seul ne garantit pas tous les defaults et règles Compose.

**Limites/confiance :** haute


<a id="arch-02"></a>
## ARCH-02 — Le parseur SSE Python refuse des événements valides et peut laisser échapper une exception

**P2 · bug · main**. Sources regroupées : ARCH-02.
Localisation : `main` · `server/evaluate.py:[60, 84]`.
Niveau de preuve : reproduction ciblée synthétique; limites détaillées dans le rapport spécialisé.

**Constat et preuve :** Le JSON est décodé ligne par ligne plutôt que par événement SSE. Fixture valide à deux lignes data: => success=false/transport-or-stream-error ; choix JSON null => TypeError non intercepté. Fixture monoligne identique => success=true. Appels réels de translate avec urllib remplacé, sans endpoint.

**Impact :** Un serveur/proxy SSE conforme utilisant plusieurs lignes produit de faux échecs. Une réponse malformée à choices:null peut interrompre pool.map et empêcher les rapports de la campagne. Ce script est un outil de mesure, pas le serveur de production ni le runtime Rust.

**Suite proposée :** Conserver urllib pour le petit outil mais accumuler data jusqu’à la ligne vide et valider les types avant accès. Alternative : client OpenAI officiel, pris en charge par vLLM, avec transport sans redirection et aucune journalisation de corps ; conserver contrôle finish_reason=stop, [DONE]/complétude et règles de confidentialité.

**Coût et compromis :** Correctif local très petit + fixtures ; SDK ajoute dépendance, validation et entretien de transport. Aucune nécessité de FastAPI/proxy maison.

**Limites/confiance :** haute


<a id="arch-03"></a>
## ARCH-03 — Les lecteurs de génération ne bornent ni les événements ni les corps d’erreur

**P2 · risque · main**. Sources regroupées : ARCH-03, SEC-02.
Localisation : `main` · `src-tauri/src/inference.rs:[23, 68]`.
Niveau de preuve : inspection-statique/documentation; comportement natif non exécuté.

**Arbitrage :** Bornes mémoire et annulation des lectures, pas réintroduction du timeout global ou de max_tokens=4096 intentionnellement retirés.

**Constat et preuve :** SseDecoder étend Vec puis rescane deux fois depuis le début à chaque push ; pas de taille maximale d’événement. ThinkFilter:145-166 conserve tout le raisonnement et recherche le marqueur à chaque delta. stream_within:262 lit response.text() sans borne ni select cancellation. Contraste : probe.rs:419-448 fournit déjà bounded_body cancellable avec 2 MiB.

**Impact :** Un endpoint cassé qui envoie des octets sans terminateur, un think non fermé ou un énorme corps HTTP d’erreur peut faire grossir la mémoire ; les recherches répétées sur buffers croissants peuvent être quadratiques. Le read_timeout par silence ne borne pas un serveur qui continue à émettre. Annuler ne coupe pas promptement la lecture de response.text().

**Suite proposée :** Réutiliser le principe bounded_body de probe pour les erreurs (limite adaptée) et cancellation select. Ajouter une limite par événement SSE et un curseur de scan incrémental ; pour les blocs think, jeter le contenu déjà consommé et ne garder que le suffixe nécessaire au marqueur. Évaluer eventsource-stream sur bytes_stream pour le framing, en gardant une borne explicite et la logique métier de complétude.

**Coût et compromis :** Modification localisée, tests fragmentés/bornes ; dépendance SSE éventuelle à qualifier, pas besoin d’un SDK Rust complet.

**Contre-review XSEC-05 (nuancé, sur l'assertion précisée) :** Bornage mémoire et cancellation erreurs: risque réel; timeout global/max_tokens retirés intentionnellement
Vec SSE sans plafond, rescans depuis début; thinking conserve bloc non fermé; résultat accumulé; response.text().await sans select cancellation. probe.rs:419-448 fournit bounded_body 2 MiB cancellable. idle reqwest 120 s et watchdog silence 150 s existent; i.touch à chaque chunk émis. Commit 744706d29c7898d66c505b1397552be1cb7be8d4 du 2026-10-08 retire explicitement max_tokens=4096 et total timeout.
Pas d’OOM/RSS ni tests Rust; risque conditionnel et statique. Un timeout global optionnel est décision produit, non correctif obligatoire.

**Contre-review XSEC-12 (rejeté, sur l'assertion précisée) :** Absence de timeout global ou max_tokens n’est pas seule un bug à réparer
Intention commit 744706d explicitement vérifiée: permettre longs textes sans deadline totale. Connect et silence bornés restent présents.
Rejet partiel de recommandation SEC-02, pas du constat absence limites bytes.

**Complément SEC-02 fusionné :** SseDecoder.buffer.extend_from_slice sans plafond; ThinkFilter garde tout un bloc non fermé; result.push_str accumule sans limite; réponse d’erreur .text().await non bornée. Limits ne borne que connect/idle, request_body n’a pas max_tokens. À l’inverse probe.rs borne les corps à 2 MiB. Watchdog lib.rs 2008–2047 expire le silence, réinitialisé par les deltas (1452–1458).

**Limites/confiance :** haute sur les propriétés statiques ; moyenne sur l’impact terrain


<a id="arch-04"></a>
## ARCH-04 — L’orchestration native concentre plusieurs invariants dans lib.rs

**P2 · dette · main**. Sources regroupées : ARCH-04.
Localisation : `main` · `src-tauri/src/lib.rs:[563, 805]`.
Niveau de preuve : inspection-statique/documentation; comportement natif non exécuté.

**Constat et preuve :** AppState/Inner partagés coordonnent apply_settings (684-761 : raccourcis, autostart, disque, diffusion), translate (1330-1559), delivery (1599+), résultat/annulation, fenêtres/setup et probes (2739-2826), watchers (3058+), bootstrap (3195+). Le fichier totalise 4116 lignes, tests inclus ; le problème est le partage des invariants de capture/lifecycle/réglages, pas ce nombre seul.

**Impact :** Une évolution de connexion, remplacement ou fermeture oblige à raisonner sur plusieurs zones et leur même verrou ; tests d’orchestration proches de Tauri rendent les variantes délicates. Ce n’est pas une race démontrée ni une violation d’une taille maximale documentée par Overtype.

**Suite proposée :** Extraire progressivement une responsabilité par modification : session/capture et transitions pures, application transactionnelle des réglages, puis commandes connexion. Garder lib.rs comme assemblage Tauri, garder les IDs/générations, snapshots, verrou et tests de contrats. Alternative acceptable à court terme : carte des invariants et fonctions auxiliaires ciblées, sans migration générale.

**Coût et compromis :** Coût moyen en étapes ; tests de contrats avant déplacement, éviter découpage mécanique en modules mutuellement dépendants. Aucun besoin de microservices, CQRS ou DDD cérémoniel.

**Limites/confiance :** haute sur le couplage, jugement architectural sur la priorité


<a id="arch-07"></a>
## ARCH-07 — La fin [DONE] du flux ne termine pas la lecture native

**P2 · risque · main**. Sources regroupées : ARCH-07.
Localisation : `main` · `src-tauri/src/inference.rs:[279, 325]`.
Niveau de preuve : inspection-statique/documentation; comportement natif non exécuté.

**Constat et preuve :** Item::Done:285 ne fait que done=true. Le loop attend bytes.next() jusqu’à None ; stop confirmé et [DONE] reçus ne sortent pas de la boucle. Le script Python:66-68 fait au contraire break à [DONE].

**Impact :** Un proxy/serveur qui garde le corps SSE ouvert après [DONE] retarde le résultat, puis peut le transformer en timeout ; schedule_auto_delivery attend inference::stream et ne colle donc pas. Un flux qui ferme normalement, comme les fixtures actuelles, fonctionne.

**Suite proposée :** Terminer la consommation sur la sentinelle terminale en exigeant toujours finish_reason=stop ; rejeter [DONE] prématuré. Fixture locale Rust : stop+[DONE] puis socket maintenue ouverte, et absence de stop ; ne pas supprimer les gardes contre résultat tronqué.

**Coût et compromis :** Petit changement dans boucle + tests HTTP locaux. La politique de terminaison est indépendante du choix de bibliothèque SSE.

**Contre-review XSEC-06 (confirmé, sur l'assertion précisée) :** [DONE] ne termine pas le stream native
Item::Done fait seulement done=true; sortie loop uniquement None/cancel/erreur. stop+[DONE] suivi corps qui reste ouvert attend encore et peut produire Timeout; erreur transport après DONE refuse aussi. decoder.finish puis done&&stop et résultat non vide sont requis.
Statique seulement, aucune fixture Rust exécutée; ne pas annoncer repro natif réussi.

**Limites/confiance :** moyenne


<a id="br-02"></a>
## BR-02 — La récupération non destructive des réglages illisibles n’a pas été reprise

**P2 · risque · main**. Sources regroupées : BR-02.
Localisation : `main` · `src-tauri/src/settings.rs:[184, 191]`.
Niveau de preuve : inspection-statique/documentation; comportement natif non exécuté.

**Constat après contre-review :** load échoue sur lecture/JSON/décryptage/validate et setup utilise ?. settings.0.5.bak.json sert uniquement à la sauvegarde de migration, jamais fallback de load. La récupération historique load_tolerant n’est pas reprise.

**Gardes et réserves :** Fail-closed évite d’envoyer une clé à une configuration devinée; save actuel utilise tmp + remplacement plutôt qu’une écriture directe tronquante. Il n’existe pas de preuve de corruption provoquée par le produit. Le backup 0.5 n’est pas une sauvegarde récente universelle : ne pas le restaurer silencieusement au détriment des nouveaux serveurs.

**Suite proposée :** Sauver original avant secours; recovery explicite, accueil avec notice, pas écrasement silencieux ni désactivation de la protection des clés.

**Limites/confiance :** élevée (inspection statique)


<a id="dep-001"></a>
## DEP-001 — vLLM 0.28.0 possède des advisories DoS atteignables par les paramètres des routes texte

**P2 · risque · main**. Sources regroupées : DEP-001.
Localisation : `main` · `server/compose.yaml:[4, 37, 78, 120]`.
Niveau de preuve : preuves détaillées du rapport spécialisé; pas validation native globale.

**Constat et preuve :** Digest officiel vérifié. GHSA-wpww-v874-ph2p et GHSA-v5gm-qgmv-gc6c affectent <0.29.0, dont 0.28.0 ; upstream décrit cache_salt volumineux et stop_token_ids hors vocabulaire avec min_tokens>0 sur /v1/chat/completions. Pas de PoC GPU exécuté. Le client normal ne transmet pas ces paramètres.

**Impact :** Latence partagée ou arrêt EngineCore, reprise manuelle (restart:no). Risque local/tenant, pas preuve de compromission distante ou de fuite.

**Suite proposée :** Garder les ports loopback et les restrictions de proxy déjà documentées. Limiter taille du corps et autoriser les seuls paramètres nécessaires au contrat du client ; pour stop_token_ids, supprimer/refuser ce champ s’il est inutile. Préparer ensuite une image corrigée >=0.29.0 avec digest et recette WSL2/Gemma/MTP, pas une mise à latest aveugle.

**Coût et compromis :** Faible si proxy déjà présent ; changement moteur à coût moyen (GPU, FP8, speculative decoding et workaround V2 à revalider). Aucune nouvelle bibliothèque du client nécessaire.

**Contre-review XSEC-01 (confirmé, sur l'assertion précisée) :** Advisories vLLM exacts et version exposée, sous condition de joignabilité
GHSA-wpww-v874-ph2p: <0.29.0, patch >=0.29.0, medium; API officielle cve_id=CVE-2026-100647. GHSA-v5gm-qgmv-gc6c: < 0.29.0, patch >= 0.29.0, medium, cve_id=null. Compose v0.28.0 et digest concordant avec artifact registry Docker. cache_salt exige cache préfixe (activé par défaut upstream); stop_token_ids invalide exige min_tokens>0. request_body inference.rs:109-120 ne transmet aucun de ces paramètres.
Pas de GPU, image chargée ni test modèle. Le CVE cache_salt est fourni par API repo; extraction HTML laisse sa rubrique CVE vide: ne pas conclure à absence de CVE depuis ce seul rendu.

**Limites/confiance :** élevée sur version et chemin upstream, moyenne sur exploitabilité de cette image/config sans chargement GPU


<a id="dep-003"></a>
## DEP-003 — La signature de release dépend d’Actions et d’un compilateur flottants

**P2 · risque · main**. Sources regroupées : DEP-003, SEC-05.
Localisation : `main` · `.github/workflows/release.yml:[23, 42, 46, 47, 59, 63]`.
Niveau de preuve : inspection-statique/documentation; comportement natif non exécuté.

**Constat et preuve :** actions/checkout@v4, setup-node@v4, dtolnay/rust-toolchain@stable, Swatinem/rust-cache@v2 ; job contents:write et étape build possédant la clé updater. CI emploie également des tags. GitHub recommande SHA complet pour une référence immuable. Aucun Action compromis constaté.

**Impact :** Surface supply-chain du constructeur qui produit des mises à jour signées ; reproductibilité et traçabilité compiler/actions incomplètes. C’est du durcissement, pas un incident démontré.

**Suite proposée :** Épingler Actions à SHA vérifiés, conserver le tag en commentaire et une politique de revue ; enregistrer/pinner la toolchain Rust compatible avec MSRV 1.91 et garder actualisations de sécurité explicites. Séparer si possible build et publication à privilèges minimaux, sans prétendre que signer après un build hostile suffit.

**Coût et compromis :** Faible pour SHA, maintenance récurrente des refresh ; moyen pour séparation de jobs/artefacts et provenance. Pas de nouvelle dépendance applicative.

**Contre-review XSEC-09 (nuancé, sur l'assertion précisée) :** Tags Actions et Rust stable: un seul risque supply-chain conditionnel
Tags checkout/setup-node/rust-cache et stable non SHA dans job contents:write; secret seulement étape build sign, étapes précédentes peuvent modifier workspace. Même cause dans deux rapports. npm ci et cargo --locked présents.
Protections réelles GitHub et secrets non consultés.

**Complément SEC-05 fusionné :** checkout@v4, setup-node@v4, rust-toolchain@stable, rust-cache@v2 exécutés dans le même job avec contents:write; plus tard le job reçoit TAURI_SIGNING_PRIVATE_KEY et lance npm/tauri build. Le secret n’est pas passé aux premières étapes, mais elles peuvent modifier workspace/outils utilisés ensuite. npm ci et cargo --locked limitent versions, pas intégrité d’un Action retaggé.

**Limites/confiance :** élevée


<a id="fe-01"></a>
## FE-01 — Le dialogue de copie manuelle du journal perd le focus à la fermeture

**P2 · bug · main**. Sources regroupées : FE-01.
Localisation : `main` · `src/components/controls.tsx:317-342`.
Niveau de preuve : reproduction ciblée synthétique; limites détaillées dans le rapport spécialisé.

**Constat et preuve :** Repro Chromium headless sur copie privée : navigator.clipboard.writeText refuse volontairement ; après Échap et fin de sortie, document.activeElement est BODY, pas le bouton Copier. Le wrapper contient Dialog.Root/Content/Close mais aucun Dialog.Trigger et aucune restauration onCloseAutoFocus. La version résolue Radix 1.1.23 empêche sa restauration générique et fait triggerRef.current?.focus().

**Impact :** Perte du point de reprise pour la navigation clavier ; l’utilisateur doit retrouver le bouton dans toute la fenêtre. Référence APG retour au déclencheur ; critère à vérifier WCAG 2.4.3 Focus Order.

**Suite proposée :** Associer le déclencheur avec Dialog.Trigger asChild ou conserver le bouton actif avant ouverture et le refocaliser via Content.onCloseAutoFocus, après prévention du comportement par défaut. Ne pas remplacer Radix par un dialogue maison.

**Coût et compromis :** Faible : étendre le wrapper et son appelant ; préserver les sorties AnimatePresence et tester Échap/croix/bouton Fermer.

**Limites/confiance :** élevée pour le défaut DOM reproduit ; NVDA/WebView2 non testés


<a id="fe-02"></a>
## FE-02 — Une lecture initiale tardive réadopte des réglages périmés

**P2 · risque · main**. Sources regroupées : FE-02.
Localisation : `main` · `src/settings/useSettingsStore.ts:64-85`.
Niveau de preuve : reproduction ciblée synthétique; limites détaillées dans le rapport spécialisé.

**Constat et preuve :** Repro hook réel sous React/jsdom : événement langue fr adopté, puis getSettings retardé langue en ; le rendu repasse de fr à en. reload() appelle then(adopt) sans vérifier une révision ou si un état a déjà été adopté. Le setup possède au contraire le garde !latest.current pour sa lecture initiale.

**Impact :** La copie périmée devient synced ; une modification ultérieure peut sauver la copie entière et rétablir une préférence récemment changée. Ordonnancement démontré localement, fréquence et trajet IPC Windows non mesurés.

**Suite proposée :** Pour la lecture initiale, ne pas remplacer un état déjà reçu ; pour reload explicite, employer un ticket/révision invalidé par une édition ou un événement plus récent. Examiner aussi le chargement initial du contrôleur overlay.

**Coût et compromis :** Faible à moyen : garde local ou compteur de génération + tests des retours hors ordre. Une bibliothèque de cache réseau ne fournit pas à elle seule le contrat IPC multi-fenêtres.

**Limites/confiance :** élevée pour la course du hook ; moyenne pour son occurrence native


<a id="fe-03"></a>
## FE-03 — Field ne relie pas les problèmes et aides au contrôle

**P2 · risque · main**. Sources regroupées : FE-03.
Localisation : `main` · `src/components/controls.tsx:224-235`.
Niveau de preuve : reproduction ciblée synthétique; limites détaillées dans le rapport spécialisé.

**Constat et preuve :** Repro du wrapper Field + Input réel : label htmlFor fonctionne ; aria-invalid=null, aria-describedby=null et paragraphe role=alert sans id. ConnectionForm ne transmet pas non plus ces attributs aux champs. Les annonces role=alert existent mais ne créent aucune relation durable champ→erreur. Contre-exemple correct : MenuGrid utilise aria-invalid et aria-describedby avec id du problème.

**Impact :** En revenant au contrôle, une technologie d’assistance ne dispose pas de son erreur/aide dans sa description accessible ; risque sur WCAG 1.3.1 Info and Relationships et 3.3.1 Error Identification, non-conformité globale non déterminée.

**Suite proposée :** Générer un id stable de description dans Field, exposer les attributs aux contrôles (props explicites ou contexte ciblé), relier hint/problem via aria-describedby et renseigner aria-invalid quand problem existe. Réutiliser le contrat de MenuGrid.

**Coût et compromis :** Faible : changement de Field et de ses appels ; ne pas cloner arbitrairement des enfants complexes Radix. role=alert peut être conservé pour l’annonce initiale.

**Limites/confiance :** élevée pour la structure DOM ; impact lecteur d’écran à valider sur NVDA


<a id="native-003"></a>
## NATIVE-003 — Le changement global du presse-papiers est attribué à la copie de la source sans provenance

**P2 · risque · main**. Sources regroupées : NATIVE-003.
Localisation : `main` · `src-tauri/src/clipboard_guard.rs:[177, 214]`.
Niveau de preuve : inspection-statique/documentation; comportement natif non exécuté.

**Constat après contre-review :** take_copy attribue un changement global à la copie synthétique et settle_and_swap restaure sans vérifier le producteur. watch_late assimile absence de nouvel input à provenance. Un writer autonome peut donc être pris pour la source et écrasé. Le verrou exclut un writer PENDANT la lecture/restauration, pas celui qui précède sa prise.

**Gardes et réserves :** Après put_text, restore_ours vérifie bien GetClipboardOwner sous OpenClipboard : le constat ne doit pas être élargi à toute restauration. Le foreground est vérifié avant la capture puis après, et des writers récents sont conservés sur le chemin paste. Les marques sensibles ne sont garanties par le contrat actuel que pour une copie Fresh; refuser tous les opt-outs de copies synthétiques pourrait interdire des éditeurs légitimes. Une fuite vers un modèle exige writer concurrent, capture acceptée et action/inférence; aucun de ces effets Windows n’est reproduit. PID/owner seul est insuffisant avec OLE/broker.

**Suite proposée :** Tester un writer autonome; transporter provenance et politique brokers dans take_copy/watch_late; ne pas présenter GetClipboardOwner comme solution universelle.

**Limites/confiance :** élevée pour absence de preuve; moyenne pour fréquence/exploitabilité Windows


<a id="native-004"></a>
## NATIVE-004 — Le repli TextOnly détruit silencieusement les formats non conservables

**P2 · bug · main**. Sources regroupées : NATIVE-004.
Localisation : `main` · `src-tauri/src/clipboard_guard.rs:[123, 155]`.
Niveau de preuve : inspection-statique/documentation; comportement natif non exécuté.

**Constat après contre-review :** Un échec Snapshot devient TextOnly et peut perdre tous les formats autres que Unicode lors d’une copie/collage. TextOnly(None) ne restaure rien : la phrase « aucune restauration » est plus juste que « restaure un presse-papiers vide ». Le défaut d’information utilisateur et la perte possible restent P2.

**Gardes et réserves :** Le repli est documenté (Keeper et synthetic_copy), non une régression mystérieuse; allocations avant EmptyClipboard et checks owner/sequence existent. Les bitmaps avec DIB/DIBV5 ne sont PAS tous perdus : ils sont sauvegardés via leurs formats mémoire. Il faut un format refusé, un budget dépassé ou une autre erreur Snapshot. La recommandation de refus strict diminue la couverture produit et nécessite arbitrage, pas portage automatique de PR6.

**Suite proposée :** Signaler la dégradation avant modification, ou refuser sans perte avec fallback clair. Conserver les garde-fous contre nouveaux writers.

**Limites/confiance :** élevée (preuve statique; Windows non exécuté)


<a id="native-007"></a>
## NATIVE-007 — La copie ne libère pas les touches après SendInput partiel, contrairement au collage et à PR6

**P2 · bug · main**. Sources regroupées : NATIVE-007.
Localisation : `main` · `src-tauri/src/host.rs:[1202, 1213]`.
Niveau de preuve : inspection-statique/documentation; comportement natif non exécuté.

**Constat après contre-review :** send_copy_chord retourne Err sans cleanup si sent != 4. Paste et Undo ont bien une libération best-effort; aucune garde appelante ne libère Ctrl/Insert injectés. L’asymétrie est confirmée.

**Gardes et réserves :** Le cas demande 0 < sent < 4; un refus total UIPI ne laisse pas de touche nouvellement pressée. Le risque n’est pas une touche bloquée systématiquement après chaque échec. Le cleanup lui-même n’offre pas de garantie absolue si Windows refuse également ses key-up.

**Suite proposée :** Réutiliser le cleanup best-effort du paste pour Ctrl/Insert; fixture injection partielle et validation Windows.

**Limites/confiance :** élevée (preuve statique; Windows non exécuté)


<a id="native-008"></a>
## NATIVE-008 — Une liste actions vide fait paniquer le démarrage avant validate

**P2 · bug · main**. Sources regroupées : NATIVE-008, BR-01.
Localisation : `main` · `src-tauri/src/settings.rs:[201, 209]`.
Niveau de preuve : inspection-statique/documentation; comportement natif non exécuté.

**Constat après contre-review :** Avec actions:[], le filter(defaultActionId) échoue quel que soit l’id et unwrap_or_else indexe actions[0]. Aucun garde/migration n’existe avant cette expression. load en setup propage normalement les erreurs, pas un panic; release panic=abort.

**Gardes et réserves :** Le JSON est structurellement désérialisable, pas un réglage VALIDE métier. save appelle validate et refuse les actions vides. Aucune preuve que l’UI normale ou une migration supportée crée ce fichier. P1 startup crash est excessif sans incident/fréquence : P2 robustesse pour fichier édité/corrompu. Même finding que BR-01, à compter une seule fois.

**Suite proposée :** first().ok_or avant calcul du défaut, puis récupération non destructive; fixture Rust à exécuter dans environnement équipé.

**Complément BR-01 fusionné :** main conserve actions[0] dans unwrap_or_else, avant validate. Avec un fichier valide structurellement contenant actions: [] et defaultActionId absent/invalide, l’indexation panique. wt-050-natif@1fcdd21f:settings.rs:162-167 utilise first().ok_or_else et son test an_empty_action_list_is_refused_instead_of_panicking. Startup appelle store.load()? en lib.rs:3213.

**Limites/confiance :** élevée (preuve statique; Windows non exécuté)


<a id="native-009"></a>
## NATIVE-009 — L’historique optionnel est une condition obligatoire de démarrage

**P2 · bug · main**. Sources regroupées : NATIVE-009.
Localisation : `main` · `src-tauri/src/lib.rs:[3234, 3234]`.
Niveau de preuve : inspection-statique/documentation; comportement natif non exécuté.

**Constat après contre-review :** HistoryStore::new s’exécute inconditionnellement avant app.manage. Open/schema/migration/prune faillibles propagent leur erreur au setup. La panne SQLite d’une fonctionnalité opt-in peut donc empêcher l’app de démarrer.

**Gardes et réserves :** Ce n’est pas une fuite de contenu : disabled n’implique aucun history.add. Un historique chiffré DPAPI illisible dans une ligne ne provoque pas nécessairement cette panne au démarrage, car new ne déchiffre pas les lignes. Le cas démontrable statiquement est DB/schema/WAL/prune en erreur, pas toute ancienne clé DPAPI.

**Suite proposée :** État HistoryUnavailable ou init paresseuse; ne pas copier la récupération historique best-effort WAL/SHM sans cohérence.

**Limites/confiance :** élevée (preuve statique; Windows non exécuté)


<a id="native-010"></a>
## NATIVE-010 — confirmed=true peut signaler un collage qui n’a rien changé

**P2 · bug · main**. Sources regroupées : NATIVE-010.
Localisation : `main` · `src-tauri/src/capture.rs:[527, 530]`.
Niveau de preuve : inspection-statique/documentation; comportement natif non exécuté.

**Constat après contre-review :** readback_confirms examine la présence de value n’importe où dans field. La boucle sort confirmed=true avant unwritten, lequel est conditionné par !confirmed. Si le résultat existe déjà ailleurs et l’éditeur bloque paste, le flag est une fausse confirmation. locate_pasted ultérieur ne rétrograde pas Delivery.

**Gardes et réserves :** Un collage non lisible confirmed=false est expressément autorisé; ce constat n’impose PAS de document relisible pour coller. original==result est un succès légitime sans changement : l’exemple fautif doit employer deux textes différents. Le refus initial read-only limite les providers fiables, mais Copy est toujours editable=true et un handler paste web peut annuler indépendamment de cette propriété.

**Suite proposée :** Écarter la confirmation si absence de changement prouvée et résultat différent; confirmer localement si possible, sinon rester assumed sans rendre le document obligatoire.

**Limites/confiance :** élevée (preuve statique; Windows non exécuté)


<a id="native-012"></a>
## NATIVE-012 — La capture UIA ignore les plages supplémentaires d’une sélection multiple

**P2 · risque · main**. Sources regroupées : NATIVE-012.
Localisation : `main` · `src-tauri/src/capture.rs:[61, 87]`.
Niveau de preuve : inspection-statique/documentation; comportement natif non exécuté.

**Constat après contre-review :** get_selection().into_iter().next() ignore les autres plages. La même fonction sert à revalidation. L’API Microsoft fournit une plage par sélection disjointe; aucune cardinalité SupportedTextSelection n’est contrôlée avant capture remplaçable.

**Gardes et réserves :** GetSelection n’est pas toujours multi-range : sans sélection, il renvoie une plage dégénérée que le code refuse correctement. L’effet « plusieurs insertions » dépend ensuite du Ctrl+V de l’éditeur; non établi sur Word/Outlook/Monaco ici. Le fait statique certain est l’action calculée pour la première plage sans déclarer l’incomplétude.

**Suite proposée :** Refuser la cardinalité multiple dans tout le parcours; ne pas convertir ce refus en Copy remplaçable. Fixture provider multi-range avant qualifier l’impact éditeur.

**Limites/confiance :** élevée pour première plage seulement; moyenne pour conséquences selon éditeur


<a id="qa-01"></a>
## QA-01 — Le test de démarrage serveur Windows est toujours sauté dans la CI déclarée

**P2 · risque · main**. Sources regroupées : QA-01.
Localisation : `main` · `.github/workflows/ci.yml:[27, 35]`.
Niveau de preuve : inspection-statique/documentation; comportement natif non exécuté.

**Constat et preuve :** Le seul job unittest est evaluation-harness sur ubuntu-latest. server/test_evaluation.py:67 protège le test start.ps1 par os.name == "nt" + powershell. Job windows:36-55 et release:50-53 ne lancent pas unittest. Exécution Linux: 6 découverts, 5 passent, 1 skip. Historique -S: d5ecd2a/8281476 introduisent bien ce test de non-régression.

**Impact :** Une régression PowerShell au premier démarrage ou sur service arrêté laisse tous les jobs déclarés verts; le scénario réel concerné est précisément celui régressé auparavant.

**Suite proposée :** Ajouter setup-python 3.13 et unittest au job Windows existant, sur fixtures docker.cmd/python.cmd sans GPU. Garder le test Linux pour le streaming et la politique endpoint.

**Coût et compromis :** faible

**Limites/confiance :** haute


<a id="qa-02"></a>
## QA-02 — La publication ne dépend pas des checks E2E ni du harness serveur

**P2 · risque · main**. Sources regroupées : QA-02.
Localisation : `main` · `.github/workflows/release.yml:[4, 9, 50, 53, 100]`.
Niveau de preuve : inspection-statique/documentation; comportement natif non exécuté.

**Constat et preuve :** Release est déclenchée indépendamment par tag, dispatch ou package.json sur main. Elle exécute npm test/build/cargo test puis publie; aucune dépendance/attente de ci.yml, aucun Playwright/unittest/Compose dans release.

**Impact :** Un tag ou dispatch peut produire une release malgré une régression UI d’intégration qui échoue au job frontend, ou malgré un test serveur rouge. Pas de publication défectueuse observée ici.

**Suite proposée :** Factoriser les validations existantes en workflow réutilisable ou les faire précéder dans le même graphe la publication via needs; vérifier le SHA exact à publier. Éviter un needs entre workflows distincts, qui ne crée pas de dépendance.

**Coût et compromis :** moyen: temps E2E sur release; pas de nouvelle bibliothèque

**Limites/confiance :** haute


<a id="qa-03"></a>
## QA-03 — La voie CI native ne valide pas le remplacement réel d’un éditeur

**P2 · risque · main**. Sources regroupées : QA-03, BR-03.
Localisation : `main` · `.github/workflows/ci.yml:[36, 55]`.
Niveau de preuve : inspection-statique/documentation; comportement natif non exécuté.

**Constat et preuve :** Windows lance cargo test et NSIS, pas de parcours sélection→SendInput→éditeur→relecture. e2e/native-fixture.ts:50-115 recopie le placement Rust et :165+ simule les commandes. scripts/probe-native-ui.mjs:24 exclut explicitement capture réelle et collage réel. Une voie réelle existe dans origin/codex/multi-editor-replacement@86b3b23f (ci.yml:52-54, scripts/test-replacement-windows.mjs), mais pas sur main.

**Impact :** Les assertions navigateur vérifient le consommateur TS, pas UIA, le presse-papiers riche, la cible réelle du collage ni Ctrl+Z dans Edge. Ces risques concernent la fonction principale et ne sont pas levés par le build natif.

**Suite proposée :** Adapter à l’API actuelle un petit sous-ensemble du test Edge de cette branche sur desktop Windows dédié: sélection Unicode, champ readonly, cible changée, nouveau propriétaire clipboard, collage bloqué. Réutiliser Playwright déjà présent; ne pas fusionner une ancienne branche entière.

**Coût et compromis :** moyen/élevé: desktop interactif Windows et coût de maintien; suite séparée bornée

**Complément BR-03 fusionné :** 86b3b23f contient vérification du champ entier avant/après, insertFromPaste, format b/i, Ctrl+Z, iframe, Shadow DOM, Unicode, concurrence presse-papiers, refus doublon. scripts/test-replacement-windows.mjs et replacement_tests.rs absents main; recherche insertFromPaste/replacement_desktop/rich clipboard vide. scripts/capture-matrix.mjs main teste capture, pas ces invariants complets du collage.

**Limites/confiance :** haute


<a id="sec-01"></a>
## SEC-01 — Effacement SQLite: secure_delete ne couvre pas les connexions qui suppriment

**P2 · bug · main**. Sources regroupées : SEC-01.
Localisation : `origin/main` · `src-tauri/src/history.rs:[27, 28, 48, 49, 66, 76, 113, 125]`.
Niveau de preuve : reproduction ciblée synthétique; limites détaillées dans le rapport spécialisé.

**Constat et preuve :** new() règle secure_delete=ON sur sa connexion; connection() rouvre ensuite sans ce PRAGMA. libsqlite3-sys 0.35.0 bundled ne définit pas SQLITE_SECURE_DELETE. Repro avec son amalgamation 3.50.2, SHA du crate vérifié: connexion initiale=1, réouverture=0, COUNT(*)=0 après DELETE mais marqueurs du payload synthétique et du nom d’action présents dans le fichier. Contrôle ON à chaque connexion: marqueurs absents.

**Impact :** Suppression et rétention sont logiques, pas effacement des restes sur disque. Payload reste chiffré DPAPI, mais récupérable par le même utilisateur Windows; métadonnées action/server/date en clair. Pas une fuite de texte clair prouvée ni une garantie d’effacement SSD.

**Suite proposée :** Initialiser secure_delete sur chaque Connection dans connection(); tester après close/reopen les suppressions et prune. Définir politique de checkpoint WAL/TRUNCATE pour purge complète, traiter busy explicitement; ne pas promettre effacement des backups/SSD.

**Coût et compromis :** Faible: rusqlite/SQLite déjà présents; un peu plus d’I/O et coordination pour checkpoint.

**Contre-review XSEC-03 (nuancé, sur l'assertion précisée) :** secure_delete oublié à la réouverture: repro exact SQLite, pas preuve du binaire rusqlite livré
new active ON puis ferme; connection ouvre sans ON; prune startup est donc protégée, prune add/list/maintain et delete ne le sont pas par défaut. Crate libsqlite3-sys 0.35.0 hash 133c182a6a2c87864fe97778797e46c7e999672690dc9fa3ee8e241aa4a9c13f vérifié au Cargo.lock; C extrait identique à fixture initiale. Compilation indépendante C SQLite 3.50.2: réouverture=0, COUNT=0 mais ciphertext/action synthétiques présents; ON par connexion les retire du main. Build avec SQLITE_SECURE_DELETE=1: réouverture=1 et résidus absents, contre-exemple réel. build.rs upstream autorise LIBSQLITE3_FLAGS et override pkg-config.
La fixture utilise ctypes pour piloter C, NON sqlite3 Python, NON Rust lié, NON DPAPI. Builds C n’émulent pas toutes options du build Cargo. Flags/environnement exacts du binaire installé inconnus; aucun défaut garantit tous binaires.

**Contre-review XSEC-04 (confirmé, sur l'assertion précisée) :** secure_delete ON ne suffit pas à purger un WAL maintenu par lecteur
Fixture avec ON par connexion, insertion et snapshot lecteur conservés: COUNT=0, marqueurs absents main, ciphertext/action encore dans -wal. Sans lecteur retenu, fixture ON nettoie main. Résultat dans crosscheck-security-sqlite.log.
Snapshot lecteur synthétique local, pas concurrence native de l’app mesurée.

**Contre-review XSEC-11 (rejeté, sur l'assertion précisée) :** Déduire de DPAPI que les résidus deviennent nécessairement inutilisables
CryptProtectData utilise contexte utilisateur, UI_FORBIDDEN et aucune entropy additionnelle. Pas clé par ligne détruite à DELETE/rename. Microsoft: normalement mêmes identifiants et même ordinateur. Crate features bundled ≠ SQLCipher et ne prouvent pas crypto-erasure.
Aucun déchiffrement Windows exécuté. Rejet d’un contre-argument, pas nouveau défaut confirmé.

**Limites/confiance :** high


<a id="arch-05"></a>
## ARCH-05 — Une erreur d’écriture de réglages reste française sous une interface anglaise

**P3 · bug · main**. Sources regroupées : ARCH-05.
Localisation : `main` · `src/settings/messages.ts:[3, 38]`.
Niveau de preuve : reproduction ciblée synthétique; limites détaillées dans le rapport spécialisé.

**Constat et preuve :** describeRefusal fait un mapping de phrases exactes puis retourne la phrase brute inconnue. settings.rs:325-326 émet Impossible d’enregistrer les paramètres. ; useSettingsStore:106-108 la conserve et SettingsWindow utilise describeRefusal. Appel Node réel : connu => EN:shortcuts.taken ; erreur stockage => chaîne française intacte.

**Impact :** Le contrat de français/anglais complets ne couvre pas ce parcours d’échec ; changer une ponctuation Rust peut aussi casser une traduction. Les événements d’inférence à ErrorCode sont au contraire déjà structurés.

**Suite proposée :** Court terme : mapper les erreurs stockage existantes. Évolution : refus IPC {code,message} stable pour save_settings et autres commandes, traduire le code côté React ; ne pas envoyer les erreurs OS brutes. Réutiliser ErrorCode/Refusal existants, pas ajouter i18next pour corriger ce défaut.

**Coût et compromis :** Très faible pour mapping ciblé ; petit coût transversal pour erreurs typées et adaptation v4.

**Limites/confiance :** haute


<a id="br-04"></a>
## BR-04 — Le verre Afficher le résultat n’a pas repris la persistance des erreurs

**P3 · risque · main**. Sources regroupées : BR-04.
Localisation : `main` · `src/GlassOverlay.tsx:[294, 300, 349, 382]`.
Niveau de preuve : inspection-statique/documentation; comportement natif non exécuté.

**Constat après contre-review :** Pour le parcours GlassSession direct/display, phase error est settled; budget normal puis fermeture automatique sauf hover/focus/pin/etc. Le feedback des commandes copy/replace expire après 3 s. La branche wt-050-verre faisait persister les erreurs, mais cette décision de branche ne suffit pas à imposer une exigence actuelle.

**Gardes et réserves :** L’erreur réseau state.error n’est PAS effacée par le timer feedback : elle demeure dans error-copy ou subtle-warning jusqu’à fermeture du verre. AutoClose=never, présence pointeur, clavier et menu peuvent empêcher la fermeture; BR-04 n’est donc pas général. UI-DECISIONS:10 maintient auto-close du mode Afficher le résultat et :46 demande erreurs visibles/claires sans durée illimitée. L’Îlot a son propre parcours. Persistance mérite arbitrage P3, pas bug P2 démontré. Le commentaire historique:306–308 revendique « décisions du 17/09, Q6 »; cette attribution n’a pas été retrouvée dans les contrats actuels examinés. Ne pas affirmer que Lucas a rejeté la persistance : la priorité documentaire reste à clarifier.

**Suite proposée :** Demander décision produit spécifique au verre direct; si erreurs persistantes voulues, ajouter tests timers, ne pas généraliser à Îlot.

**Limites/confiance :** élevée sur timers; comportement produit à confirmer, pas de test navigateur exécuté


<a id="br-05"></a>
## BR-05 — Le type-check des tests Playwright de wt-050-atelier est absent du build

**P3 · dette · main**. Sources regroupées : BR-05.
Localisation : `main` · `tsconfig.json:[1, 4]`.
Niveau de preuve : inspection-statique/documentation; comportement natif non exécuté.

**Constat après contre-review :** tsc -b référence uniquement app/node; includes src/vite.config. E2E/visual-tests ne sont pas racines et tsconfig.test.json historique est absent. CI build puis playwright n’ajoute pas un typecheck de ces tests.

**Gardes et réserves :** Les tests sous src sont bien couverts; les erreurs d’exécution e2e sont encore testées par Playwright. Absence de compilation des types de tests n’établit ni types actuellement cassés ni panne utilisateur. Le coût peut inclure des imports/types Node ambiants à adapter.

**Suite proposée :** Ajouter un projet noEmit et check CI avec TypeScript existant; pas besoin de reprendre les assertions UI historiques.

**Limites/confiance :** élevée (inspection statique)


<a id="dep-002"></a>
## DEP-002 — Les locks npm conservent deux advisories de la chaîne build/test, sans exploit desktop démontré

**P3 · risque · main**. Sources regroupées : DEP-002.
Localisation : `main` · `package-lock.json:[3065]`.
Niveau de preuve : preuves détaillées du rapport spécialisé; pas validation native globale.

**Constat et preuve :** npm audit: app 1 entrée high, ancien labo 0, reglages 5 entrées high issues de 2 advisories, non 5 vulnérabilités indépendantes. GHSA-68fv-2mgg-jv7q : source-map-js 1.2.1, correctif 1.2.2 ; GHSA-vfj7-8cjw-p6xm : braces 3.0.3, aucun correctif publié. Les 16 locks npm historiques racine ont aussi une entrée high.

**Impact :** DoS potentiel de build/test sur entrées hostiles. N’est pas une vulnérabilité à distance du binaire Overtype.

**Suite proposée :** Mise à jour ciblée future du lock vers source-map-js 1.2.2 compatible, puis builds/tests. Pour braces sans correctif, surveiller upstream et restreindre les motifs de build ; ne pas appliquer aveuglément npm audit fix (propose Tailwind CLI 4.3.0 contre 4.3.3). Ajouter contrôle advisory avec triage par scope.

**Coût et compromis :** Faible pour source-map-js, coût moyen et compromis fonctionnels pour remplacement du watcher ; ne pas migrer une bibliothèque UI majeure pour cette alerte tooling.

**Contre-review XSEC-02 (confirmé, sur l'assertion précisée) :** source-map-js et braces: advisories exacts, tooling et non faille desktop prouvée
GHSA-68fv-2mgg-jv7q / CVE-2026-93749: >=1.0.0,<1.2.2; fix 1.2.2; lock 1.2.1. GHSA-vfj7-8cjw-p6xm / CVE-2026-93687: <=3.0.3; first_patched_version=null; lock prototype braces 3.0.3. Sources GitHub Reviewed et API officielle enregistrées. Chaîne source-map-js via postcss; braces via micromatch et @parcel/watcher. Aucun import de ces parsers dans src.
Pas de nouveau npm audit/build exécuté; locks et artifacts locaux réexaminés. Pas de preuve de contrôle attaquant sur les entrées réelles.

**Limites/confiance :** élevée pour présence et ranges, faible pour un attaquant réel contrôlant ces entrées


<a id="dep-004"></a>
## DEP-004 — Le script de captures du prototype résout Playwright depuis un checkout personnel absolu

**P3 · bug · main**. Sources regroupées : DEP-004, ARCH-06.
Localisation : `main` · `design-lab/reglages/scripts/shots.mjs:[10, 11]`.
Niveau de preuve : reproduction ciblée synthétique; limites détaillées dans le rapport spécialisé.

**Constat et preuve :** Après npm ci des trois packages, npm run shots échoue exit 1 MODULE_NOT_FOUND sur <checkout-Windows-absolu>/node_modules/@playwright/test. Repro Linux joinne ce chemin au cwd ; sur Windows un autre disque/checkout ne possède pas non plus <checkout-Windows-absolu>.

**Impact :** Les preuves visuelles du prototype ne sont pas rejouables via la commande documentée hors du poste d’origine. App release non affectée.

**Suite proposée :** Résoudre Playwright relativement au repository/root package (déjà @playwright/test 1.63.0), ou déclarer une devDependency propre si labo doit être autonome ; reprendre le paramètre PLAYWRIGHT_MODULE du premier labo. Utiliser dossier de sortie fourni/plancher relatif au labo.

**Coût et compromis :** Faible sans ajout de lib ; déclarer localement Playwright augmente taille installation/browsers, réutiliser root nécessite documenter npm ci root.

**Complément ARCH-06 fusionné :** La commande documentée README:23 utilise resolve("<checkout-Windows-absolu>",p). Exécutée depuis design-lab/reglages sur ce clone : code 1, ENOENT sur D:/.../src/halo/HaloWindow.tsx. build.mjs:33 trouve déjà src relativement à import.meta.url.

**Limites/confiance :** élevée


<a id="fe-04"></a>
## FE-04 — La copie réussie du résultat ne change jamais son message de statut

**P3 · bug · main**. Sources regroupées : FE-04.
Localisation : `main` · `src/GlassOverlay.tsx:478-488,533-544`.
Niveau de preuve : reproduction ciblée synthétique; limites détaillées dans le rapport spécialisé.

**Constat et preuve :** Chromium sur lab-frame scenario=short : bouton data-copied=true (1 occurrence) mais .sr-only[role=status] reste « Translation complete ». À la ligne 544, phase complete && !replacing précède copied et reste vraie pendant toute la copie ; la branche glass.copied est donc masquée.

**Impact :** La coche purement décorative indique le succès visuellement, mais la région de statut ne fournit aucune confirmation de copie. Référence WCAG 4.1.3 Status Messages ; lecture vocale réelle non testée.

**Suite proposée :** Faire prioriser copied devant complete ou utiliser une région de statut dédiée à la copie ; garder les noms et messages i18n existants.

**Coût et compromis :** Très faible ; tester copie répétée et expiration de copied (1600 ms), sans annoncer le résultat en double.

**Limites/confiance :** élevée, repro navigateur et chemin conditionnel concordants


<a id="fe-05"></a>
## FE-05 — La mécanique de persistance des Réglages et de l’accueil est dupliquée

**P3 · dette · main**. Sources regroupées : FE-05.
Localisation : `main` · `src/settings/useSettingsStore.ts:47-85,91-143,169-175`.
Niveau de preuve : preuves détaillées du rapport spécialisé; pas validation native globale.

**Constat et preuve :** Les deux hooks possèdent latest/synced, inFlight, timer, file Promise, adoption conditionnée aux éditions, flush et rollback du raccourci. Ils diffèrent déjà sur le garde de chargement initial (FE-02) et le délai de frappe (300/400 ms). Ce dernier peut être intentionnel : il ne prouve pas un bug.

**Impact :** Toute correction de l’invariant de persistance doit être portée deux fois ; risque de divergence déjà visible. Il ne s’agit pas de reprocher useState/useRef ou de demander Redux.

**Suite proposée :** Extraire seulement le noyau de sauvegarde séquentielle/adoption/flush dans un hook partagé, avec délai et validation configurables ; conserver dans les adaptateurs l’historique, les statuts UX, reset et les règles de raccourcis.

**Coût et compromis :** Moyen : contrats comportementaux d’abord, refactorisation après les bugs. Aucune nouvelle dépendance requise ; ne pas uniformiser de force les différences produit.

**Limites/confiance :** élevée sur la duplication ; jugement de maintenabilité, pas défaut utilisateur supplémentaire


<a id="native-011"></a>
## NATIVE-011 — Les capabilities ne cloisonnent pas les commandes métier entre WebViews

**P3 · risque · main**. Sources regroupées : NATIVE-011, SEC-03.
Localisation : `main` · `src-tauri/build.rs:[1, 3]`.
Niveau de preuve : inspection-statique/documentation; comportement natif non exécuté.

**Arbitrage :** Durcissement inter-WebViews, conditionné à une compromission JS non démontrée. P3 retenu malgré le P2 du volet sécurité.

**Constat après contre-review :** build.rs ne fournit pas AppManifest::commands. Les capabilities limitent certains plugins/core APIs, pas ces commandes app autorisées par défaut selon Tauri. save_settings ne contrôle pas le label appelant. Le constat technique est juste.

**Gardes et réserves :** Certaines commandes sensibles ont déjà une garde KEYED (lecture clés, sonde/journal); CSP script self, pages locales et absence de remote capability restreignent l’exposition. Une app possédant plusieurs vues d’un même bundle ne requiert pas nécessairement séparation complète métier. Aucune compromission frontend, navigation hostile ou violation démontrée; traiter comme P3 défense en profondeur, pas P2 incident/accès distant.

**Suite proposée :** Définir d’abord la frontière de confiance attendue entre vues; utiliser AppManifest/ACL pour writes sensibles, sans inventer exploit.

**Contre-review XSEC-07 (confirmé, sur l'assertion précisée) :** Isolation fenêtres des commandes custom réellement partielle
get_settings filtre clés selon KEYED; save_settings/get_history/delete_history sans WebviewWindow ni garde. update.rs:110 install_update aussi. build.rs ne fournit pas AppManifest::commands. Docs Tauri déclarent explicitement invoke_handler autorisé à toutes fenêtres/webviews par défaut.
IPC natif non exécuté. CSP et rendu texte atténuent; absence de vecteur frontend démontré.

**Complément SEC-03 fusionné :** get_settings filtre les clés hors settings/setup; probe_connection, diagnostics et try_model contrôlent connection_window. save_settings, get_history/delete_history et install_update (update.rs 109–123) ne reçoivent pas/contrôlent la fenêtre. build.rs appelle tauri_build::build() sans AppManifest::commands. Tauri documente que les commandes invoke_handler sont accessibles à toutes fenêtres par défaut; capabilities/default.json ne restreint donc pas ces commandes applicatives.

**Limites/confiance :** élevée sur le comportement ACL; exploitabilité non démontrée


<a id="qa-04"></a>
## QA-04 — Les échecs fonctionnels sensibles à la charge n’ont pas de trace conservée

**P3 · dette · main**. Sources regroupées : QA-04.
Localisation : `main` · `playwright.config.ts:[10, 15]`.
Niveau de preuve : preuves détaillées du rapport spécialisé; pas validation native globale.

**Constat et preuve :** La config fonctionnelle ne conserve que screenshot only-on-failure; pas trace ni video. Run complet à 6 workers (simultané à une tentative visuelle et temporairement Vitest): 226 passent, 24 échouent, 0 retry automatique. Recheck des 24, seul à 2 workers: 24 passent. Erreurs: timeouts, html sans data-ui, clock.pauseAt vers le passé, région intermédiaire; qa-e2e-failures.json + e2e-highparallel/ gardent les premières preuves.

**Impact :** Une capture finale et le contexte ne reconstruisent pas l’ordre des événements IPC/rAF, ni la requête qui recharge la page. Le passage au second essai ne rend pas le premier run vert; il faut diagnostiquer avant de qualifier un bug produit.

**Suite proposée :** Activer trace retain-on-failure dans la config fonctionnelle, réutiliser upload-artifact existant. Reproduire à concurrence maîtrisée, figer l’horloge avant navigation quand possible et remplacer les attentes temporelles arbitraires par des conditions. Ne pas traiter les retries comme correctif.

**Coût et compromis :** faible pour traces; coût artifacts; diagnostic moyen

**Limites/confiance :** haute


<a id="qa-05"></a>
## QA-05 — Les comparaisons visuelles Windows ne sont pas une gate CI

**P3 · dette · main**. Sources regroupées : QA-05.
Localisation : `main` · `.github/workflows/ci.yml:[17, 21, 48, 51]`.
Niveau de preuve : inspection-statique/documentation; comportement natif non exécuté.

**Constat et preuve :** npm run ui:check n’est appelé dans aucun workflow. playwright.visual.config.ts:7 distingue {platform}; seules références win32 versionnées. README:20-31 précise Îlot non approuvé et :48-65 documente v4 périmé. Sur Linux sans génération: 14 tests échouent avec snapshot absent, 1 interrompu volontairement, 37 non exécutés.

**Impact :** Les références ne détectent pas automatiquement une dérive visuelle dans les releases actuelles; leurs succès historiques n’attestent pas l’approbation esthétique ni Windows natif.

**Suite proposée :** Après revue humaine des références Îlot, ajouter ui:check --grep @ilot sur un runner Windows cohérent avec leur Chromium. Maintenir v4 en lane séparée ou le retirer selon décision produit. Ne pas copier les baselines win32 en linux ni générer des images pour verdir.

**Coût et compromis :** moyen: revue références et stabilité environnement

**Limites/confiance :** haute


<a id="qa-06"></a>
## QA-06 — Le générateur de kit d’essai n’est plus utilisable tel quel pour 0.6.2

**P3 · bug · main**. Sources regroupées : QA-06.
Localisation : `main` · `scripts/package-test-kit.ps1:[24, 30, 49, 62]`.
Niveau de preuve : inspection-statique/documentation; comportement natif non exécuté.

**Constat et preuve :** Le script prend version package.json puis exige docs/ESSAIS-$version.md et docs/evaluation/$EvaluationVersion/README.md. Probe kit-paths: docs/ESSAIS-0.6.2.md et docs/evaluation/0.6.2/README.md absents. Il écrit encore Ctrl+Alt+T et le repli en onglet, alors que décisions UI:72 et :77 décrivent Ctrl+Alt+Space/Îlot.

**Impact :** Après fourniture de l’installateur, Copy-Item de la notice courante échoue; même une adaptation des chemins distribuerait des instructions de test obsolètes. Écart limité à un outil manuel historique, non au workflow NSIS/release.

**Suite proposée :** Choisir explicitement une notice actuelle et une version d’évaluation disponible, ou marquer le script archive 0.1.x; actualiser le parcours simulé Îlot. Garder la distinction réponse synthétique/capture réelle.

**Coût et compromis :** faible

**Limites/confiance :** haute


<a id="qa-07"></a>
## QA-07 — Capture-matrix consigne les divergences sans les transformer en échec

**P3 · risque · main**. Sources regroupées : QA-07.
Localisation : `main` · `scripts/capture-matrix.mjs:[82, 89, 124, 129]`.
Niveau de preuve : inspection-statique/documentation; comportement natif non exécuté.

**Constat et preuve :** textMatches et clipboardAfter sont enregistrés sans assertion. status DONE dépend uniquement de !c.error; shoot peut rendre kind=nothing. Même status ERRORS n’impose pas explicitement une sortie non nulle (erreurs absorbées par cas). Outil manuel de collecte, non utilisé par les workflows.

**Impact :** Un consommateur qui lit DONE ou exit 0 comme preuve de capture/preservation obtient un faux positif. Le JSON conserve toutefois les champs négatifs: la preuve n’est pas fabriquée ni perdue.

**Suite proposée :** Renommer DONE en collecte_complete et séparer verdicts par scénario, ou ajouter assertions adaptées aux cas puis code de sortie non nul sur violations. Ne pas exiger textMatches=true pour le scénario notice attendu.

**Coût et compromis :** faible

**Limites/confiance :** haute


<a id="sec-04"></a>
## SEC-04 — La documentation assure encore un refus HTTP distant qui n’existe plus

**P3 · dette · main**. Sources regroupées : SEC-04.
Localisation : `origin/main` · `docs/ENDPOINTS.md:[27, 29, 104, 108]`.
Niveau de preuve : inspection-statique/documentation; comportement natif non exécuté.

**Constat et preuve :** docs/ENDPOINTS.md et DEPLOYMENT.md:46 annoncent HTTPS obligatoire hors loopback. settings.rs 535–548 accepte HTTP distant avec insecure=true; commentaire explicite choix Lucas 30/09 et introduction 9418959. UI InsecureNotice + chip http présents. Exécution fonction frontend: http://192.0.2.10:8000 accepté insecure=true; 21 vecteurs valides et 9 invalides passés.

**Impact :** Une personne appliquant le guide peut croire que l’app empêchera transport en clair. En HTTP distant, sélection et Authorization Bearer sont visibles à un observateur sur le trajet; ce support est intentionnel, pas un bypass TLS automatique.

**Suite proposée :** Actualiser ENDPOINTS/DEPLOYMENT avec décision 0.6, avertissement clair, recommandation HTTPS hors loopback; distinguer certificat confiance Windows et chiffrement. Option organisationnelle HTTPS-only seulement si besoin explicite, pas retour forcé sur décision produit.

**Coût et compromis :** Faible, correction documentaire; laisser fonctionnement LAN voulu.

**Contre-review XSEC-08 (confirmé, sur l'assertion précisée) :** Document TLS obsolète, HTTP distant voulu
ENDPOINTS prétend HTTPS obligatoire et total timeout 120 s. settings.rs:541-548 accepte explicitement HTTP any host depuis 0.6; insecure flag 535. inference ajoute bearer lorsque clé autorisée. Commit limites retire délai total.
Normalisation Rust statique, pas réseau.

**Limites/confiance :** high


<a id="sec-06"></a>
## SEC-06 — Branche WIP: archives de récupération de l’historique hors purge

**P2 · risque · branche-historique-seulement**. Sources regroupées : SEC-06.
Localisation : `origin/wt-050-natif` · `src-tauri/src/history.rs:[29, 46]`.
Niveau de preuve : inspection-statique/documentation; comportement natif non exécuté.

**Constat et preuve :** origin/wt-050-natif ajoute recover(): toute erreur de new() renomme history.sqlite3, -wal, -shm en history.illisible-<date>.sqlite3*, puis crée nouvelle base. get/list/delete/prune ne ciblent que history.sqlite3. Chemin relié à startup dans lib.rs. Pas dans main; commit 1fcdd21 est WIP interrompu.

**Impact :** Après corruption/erreur d’ouverture, anciens textes DPAPI et métadonnées sont archivés indéfiniment et ne sont plus visés par 'vider historique' ni la rétention 7 jours/100. Ne pas fusionner la récupération sans politique d’archives. Pas fuite de données actuelles affirmée.

**Suite proposée :** Avant reprise de branche, enregistrer/montrer les archives de récupération, appliquer plafond/rétention et purge explicite sur ces fichiers; distinguer corruption des erreurs d’accès/verrouillage avant renommage. Garder fail-soft sans supprimer silencieusement les données.

**Coût et compromis :** Modéré: helper fichiers/rusqlite existants; balance récupération vs confidentialité.

**Contre-review XSEC-10 (confirmé, sur l'assertion précisée) :** Archives WIP hors rétention: branche uniquement
git show origin/wt-050-natif: recover renomme base/-wal/-shm en history.illisible-<stamp> puis new; chemins delete/prune visent uniquement history.sqlite3. Fonction absente main. Erreur open quelconque, rename best-effort.
Pas corruption/renommage runtime provoqué; P2 dormant non additionné à main.

**Contre-review XSEC-11 (rejeté, sur l'assertion précisée) :** Déduire de DPAPI que les résidus deviennent nécessairement inutilisables
CryptProtectData utilise contexte utilisateur, UI_FORBIDDEN et aucune entropy additionnelle. Pas clé par ligne détruite à DELETE/rename. Microsoft: normalement mêmes identifiants et même ordinateur. Crate features bundled ≠ SQLCipher et ne prouvent pas crypto-erasure.
Aucun déchiffrement Windows exécuté. Rejet d’un contre-argument, pas nouveau défaut confirmé.

**Limites/confiance :** high
