> **Pièce spécialisée initiale.** Les verdicts, regroupements et sévérités finaux sont dans [FINDINGS.md](FINDINGS.md) et [la synthèse](SYNTHESE.md). Ne pas additionner les totaux des spécialistes. Les chemins `preuves-locales/` et `artefacts-locaux/` désignent des preuves privées non jointes intégralement ; voir [VERIFICATION.md](VERIFICATION.md).

# Overtype — Architecture et serveur

**Base :** `main@e202cd1f8831abc0f69435b9e2d0d96dd491e841` (0.6.2). Audit en lecture seule. Fiches effectivement utilisées : **Software Architect** et **AI Engineer**, bibliothèque Agency au commit indiqué dans le brief. Elles servent à expliciter frontières, fiabilité et compromis ; leurs objectifs génériques de latence, biais ou microservices ne sont pas des exigences ajoutées au produit.

## Synthèse

**7 constats : 5 P2 et 2 P3, aucun P0/P1.** Parmi eux, quatre bugs reproduits sur fonctions/scripts locaux (preflight, évaluation, traduction d’erreur, contrôle du labo), deux risques Rust constatés statiquement et une dette architecturale. Rien ne justifie une grande réécriture.

L’architecture principale est cohérente : React décrit les interfaces ; Rust garde l’autorité sur les captures, secrets, cibles et collage ; vLLM est un service séparé. Les défauts les mieux établis concernent deux petits parseurs maison et le contrôle anti-dérive du labo. Le point de fiabilité natif à travailler est la consommation des réponses : bornes par événement/corps, annulation et terminaison. Le principal coût de maintenance vient de l’orchestrateur `lib.rs`, pas du recours au custom en soi.

## 1. Carte des responsabilités et frontières

```text
Raccourci Windows / sélection / presse-papiers
  → Rust capture + snapshot actions/serveurs → événements vers overlay
  → React useTranslation + reducer → Îlot / résultat / halo
  → bridge choose_action puis translate (captureId, requestId, actionId, serverId)
  → Rust valide snapshot + texte → inference(reqwest/Tokio/JSON/SSE)
  → API OpenAI-compatible vLLM ou autre fournisseur configuré
  → résultat complet → Rust revalide cible, colle, garde Annuler
  → événements delivery / undo / halo → présentation React

Réglages / setup React → connexion/sondes + file de sauvegarde
  → Rust validation + stockage DPAPI / autostart / hotkeys / diagnostics

server/ : Compose lance vLLM ; Python fait préflight et évaluation,
          PowerShell choisit le service et attend sa santé.
```

- **Entrées frontend :** `App.tsx` route les fenêtres overlay, settings, setup et halo ; `main.tsx` monte React StrictMode. `useTranslation` orchestre le protocole, garde les IDs et filtre les événements périmés ; `reducer` est le seam métier de présentation. Le résultat est accumulé puis rendu d’un coup : décision explicite pour éviter un resize natif par ligne, pas un oubli de streaming visuel.
- **Vues métier :** `menu/`, `result/`, `halo/`, `settings/`, `setup/`, `connection/` ; composants/scroll/nav/contrôles partagés par setup et réglages. Les vues ne réalisent ni le collage Windows ni l’inférence HTTP elles-mêmes.
- **Pont :** `bridge.ts` concentre invoke/listen et simulation navigateur ; `types.ts` décrit les payloads ; types Rust utilisent camelCase avec commandes snake_case. Le simulateur est explicitement identifié, sans fallback de production silencieux.
- **Rust :** modules dédiés capture/clipboard, placement, halo/ground, settings/crypto/history, probe/diagnostics, actions/menu_memory, update et adaptateurs Windows. `lib.rs` assemble tout mais possède encore beaucoup de politique/session/transitions (ARCH-04).
- **Serveur :** pas d’application Python web à maintenir et donc pas de recommandation artificielle « migrer vers FastAPI ». Compose lance directement l’image vLLM verrouillée ; les utilitaires Python sont des outils opérateur séparés.

### Contrats préservés

`lib.rs:1330-1368` vérifie capture courante, identité du texte, action et premier serveur, puis utilise le snapshot de serveurs/actions pris à la capture. Le front ne remplace pas la consigne figée par une valeur arbitraire. Retry peut choisir un autre serveur, pas provoquer une nouvelle écriture automatique non autorisée. Le résultat n’est accepté qu’avec stop + complétude ; une génération tronquée reste refusée. Les états `requestId`, `captureId`, générations halo et fermeture servent de garde aux réponses tardives. Ces propriétés sont plus importantes qu’un nouveau pattern architectural.

Le contrat reste **dupliqué manuellement TS/Rust**, et `bridge.on<T>` permet au caller de choisir T indépendamment du nom d’événement. C’est une **option d’amélioration**, pas une preuve de payload faux : table `EventPayloads` typée, fixtures de sérialisation partagées ; génération de types (ex. outil compatible Tauri) seulement si les changements fréquents justifient le coût. Ne pas imposer un framework de validation à tous les messages sans besoin.

## 2. Normes actuelles, pas les vieux plans

- `AGENTS.md` donne priorité aux décisions UI récentes, à BRIDGE/SPEC pour les interfaces et à la réutilisation Motion/Radix/Lucide. `PLAN-0.6.md:3-6` dit explicitement que le labo v2 remplace les divergences de DESIGN-REGLAGES. Les variantes verre graphite, capsule, quatre anciennes pages et schémas mode/quality/fast des branches historiques ne sont pas des manques actuels.
- `PLAN-0.6.md` garde les invariants de confidentialité, bornage, annulation et rejeu. Le code actuel a serveurs, setup, champs de connexion et composants partagés : cette direction est bien suivie. Le français/anglais complet reste pertinent (ARCH-05).
- `git log -S` retrouve `744706d29c7898d66c505b1397552be1cb7be8d4` : en 0.6.1, 200 000 caractères, pas de max_tokens imposé, timeout sur **silence** plutôt que durée totale. **Ne pas restaurer la limite 4096 ni un timeout total** pour corriger ARCH-03 ; borner les événements/mémoires transitoires et respecter Annuler.
- L’ancien essai de `wt-050-natif` contient schemaVersion/backup/récupération. Ce n’est pas une obligation de reprendre son schéma abandonné : main a sa migration serveurs et backup 0.5. Une récupération tolérante peut être étudiée comme besoin actuel démontré, pas justifiée par « la branche n’a pas été fusionnée ».

## 3. Constats actionnables

### ARCH-01 — Le preflight ne lit pas la configuration effective de Compose

**P2 · bug ·** `main@e202cd1f8831abc0f69435b9e2d0d96dd491e841` · `server/preflight.py:21-55`

**Chemin/scénario et preuve.** load_env_file retire seulement les guillemets et effective_settings choisit les chaînes vides au lieu des défauts ${VAR:-default}. Repro réelle : FAST_PORT=9011 # comment et FAST_PORT=${MY_PORT} lèvent ValueError ; FAST_GPU= donne gpu="". Docker documente commentaires, interpolation et défaut pour une variable vide. server/README.md:8 promet la même précédence et start.ps1:51-52 bloque le lancement sur refus.

**Impact.** Une configuration Compose valide peut être refusée ; la réserve GPU peut viser une valeur différente de celle du conteneur. Les lignes simples livrées restent prises en charge.

**Alternative pragmatique.** Faire résoudre le modèle par docker compose config --format json avec exactement les mêmes -f/--env-file/profiles que start.ps1, puis ne lire que GPU et port effectifs. Ne jamais journaliser le modèle complet, qui peut contenir des secrets. Alternative limitée : annoncer et valider explicitement un sous-ensemble .env, plutôt que prétendre équivalence Compose.

**Coût/compromis.** Petit changement du préflight/lanceur et fixtures ; un processus Compose supplémentaire, Docker CLI déjà requis. python-dotenv seul ne garantit pas tous les defaults et règles Compose.

**Confiance et limite.** haute ; Docker absent : comparaison normative avec la documentation, pas exécution du moteur Compose.

### ARCH-02 — Le parseur SSE Python refuse des événements valides et peut laisser échapper une exception

**P2 · bug ·** `main@e202cd1f8831abc0f69435b9e2d0d96dd491e841` · `server/evaluate.py:60-84`

**Chemin/scénario et preuve.** Le JSON est décodé ligne par ligne plutôt que par événement SSE. Fixture valide à deux lignes data: => success=false/transport-or-stream-error ; choix JSON null => TypeError non intercepté. Fixture monoligne identique => success=true. Appels réels de translate avec urllib remplacé, sans endpoint.

**Impact.** Un serveur/proxy SSE conforme utilisant plusieurs lignes produit de faux échecs. Une réponse malformée à choices:null peut interrompre pool.map et empêcher les rapports de la campagne. Ce script est un outil de mesure, pas le serveur de production ni le runtime Rust.

**Alternative pragmatique.** Conserver urllib pour le petit outil mais accumuler data jusqu’à la ligne vide et valider les types avant accès. Alternative : client OpenAI officiel, pris en charge par vLLM, avec transport sans redirection et aucune journalisation de corps ; conserver contrôle finish_reason=stop, [DONE]/complétude et règles de confidentialité.

**Coût/compromis.** Correctif local très petit + fixtures ; SDK ajoute dépendance, validation et entretien de transport. Aucune nécessité de FastAPI/proxy maison.

**Confiance et limite.** haute ; Fréquence de multiline sur vLLM non mesurée ; la fixture montre la compatibilité générique, pas un défaut observé du vLLM livré.

### ARCH-03 — Les lecteurs de génération ne bornent ni les événements ni les corps d’erreur

**P2 · risque ·** `main@e202cd1f8831abc0f69435b9e2d0d96dd491e841` · `src-tauri/src/inference.rs:23-68`

**Chemin/scénario et preuve.** SseDecoder étend Vec puis rescane deux fois depuis le début à chaque push ; pas de taille maximale d’événement. ThinkFilter:145-166 conserve tout le raisonnement et recherche le marqueur à chaque delta. stream_within:262 lit response.text() sans borne ni select cancellation. Contraste : probe.rs:419-448 fournit déjà bounded_body cancellable avec 2 MiB.

**Impact.** Un endpoint cassé qui envoie des octets sans terminateur, un think non fermé ou un énorme corps HTTP d’erreur peut faire grossir la mémoire ; les recherches répétées sur buffers croissants peuvent être quadratiques. Le read_timeout par silence ne borne pas un serveur qui continue à émettre. Annuler ne coupe pas promptement la lecture de response.text().

**Alternative pragmatique.** Réutiliser le principe bounded_body de probe pour les erreurs (limite adaptée) et cancellation select. Ajouter une limite par événement SSE et un curseur de scan incrémental ; pour les blocs think, jeter le contenu déjà consommé et ne garder que le suffixe nécessaire au marqueur. Évaluer eventsource-stream sur bytes_stream pour le framing, en gardant une borne explicite et la logique métier de complétude.

**Coût/compromis.** Modification localisée, tests fragmentés/bornes ; dépendance SSE éventuelle à qualifier, pas besoin d’un SDK Rust complet.

**Confiance et limite.** haute sur les propriétés statiques ; moyenne sur l’impact terrain ; Cargo absent : aucun repro Rust exécuté et aucune mesure RSS. Ne pas réintroduire timeout global ni max_tokens=4096 : leur retrait est intentionnel dans 744706d29c7898d66c505b1397552be1cb7be8d4.

### ARCH-04 — L’orchestration native concentre plusieurs invariants dans lib.rs

**P2 · dette ·** `main@e202cd1f8831abc0f69435b9e2d0d96dd491e841` · `src-tauri/src/lib.rs:563-805`

**Chemin/scénario et preuve.** AppState/Inner partagés coordonnent apply_settings (684-761 : raccourcis, autostart, disque, diffusion), translate (1330-1559), delivery (1599+), résultat/annulation, fenêtres/setup et probes (2739-2826), watchers (3058+), bootstrap (3195+). Le fichier totalise 4116 lignes, tests inclus ; le problème est le partage des invariants de capture/lifecycle/réglages, pas ce nombre seul.

**Impact.** Une évolution de connexion, remplacement ou fermeture oblige à raisonner sur plusieurs zones et leur même verrou ; tests d’orchestration proches de Tauri rendent les variantes délicates. Ce n’est pas une race démontrée ni une violation d’une taille maximale documentée par Overtype.

**Alternative pragmatique.** Extraire progressivement une responsabilité par modification : session/capture et transitions pures, application transactionnelle des réglages, puis commandes connexion. Garder lib.rs comme assemblage Tauri, garder les IDs/générations, snapshots, verrou et tests de contrats. Alternative acceptable à court terme : carte des invariants et fonctions auxiliaires ciblées, sans migration générale.

**Coût/compromis.** Coût moyen en étapes ; tests de contrats avant déplacement, éviter découpage mécanique en modules mutuellement dépendants. Aucun besoin de microservices, CQRS ou DDD cérémoniel.

**Confiance et limite.** haute sur le couplage, jugement architectural sur la priorité ; Pas de suite native, pas d’affirmation de bug concurrent.

### ARCH-05 — Une erreur d’écriture de réglages reste française sous une interface anglaise

**P3 · bug ·** `main@e202cd1f8831abc0f69435b9e2d0d96dd491e841` · `src/settings/messages.ts:3-38`

**Chemin/scénario et preuve.** describeRefusal fait un mapping de phrases exactes puis retourne la phrase brute inconnue. settings.rs:325-326 émet Impossible d’enregistrer les paramètres. ; useSettingsStore:106-108 la conserve et SettingsWindow utilise describeRefusal. Appel Node réel : connu => EN:shortcuts.taken ; erreur stockage => chaîne française intacte.

**Impact.** Le contrat de français/anglais complets ne couvre pas ce parcours d’échec ; changer une ponctuation Rust peut aussi casser une traduction. Les événements d’inférence à ErrorCode sont au contraire déjà structurés.

**Alternative pragmatique.** Court terme : mapper les erreurs stockage existantes. Évolution : refus IPC {code,message} stable pour save_settings et autres commandes, traduire le code côté React ; ne pas envoyer les erreurs OS brutes. Réutiliser ErrorCode/Refusal existants, pas ajouter i18next pour corriger ce défaut.

**Coût/compromis.** Très faible pour mapping ciblé ; petit coût transversal pour erreurs typées et adaptation v4.

**Confiance et limite.** haute ; Repro du formatter seulement ; panne disque Windows non provoquée.

### ARCH-06 — Le contrôle anti-dérive du labo dépend du disque D: du développeur

**P3 · bug ·** `main@e202cd1f8831abc0f69435b9e2d0d96dd491e841` · `design-lab/reglages/scripts/demo-check.mjs:7-8`

**Chemin/scénario et preuve.** La commande documentée README:23 utilise resolve("<checkout-Windows-absolu>",p). Exécutée depuis design-lab/reglages sur ce clone : code 1, ENOENT sur D:/.../src/halo/HaloWindow.tsx. build.mjs:33 trouve déjà src relativement à import.meta.url.

**Impact.** La protection des valeurs recopiées app/labo ne fonctionne pas sur un autre clone ou CI, y compris un autre chemin Windows. Aucun impact direct sur l’app installée.

**Alternative pragmatique.** Résoudre racine du dépôt depuis import.meta.url (node:url/node:path), comme build.mjs. Garder le labo et le check ciblé ; à terme exporter les constantes pures réellement communes plutôt que copier le pont Tauri.

**Coût/compromis.** Quelques lignes, stdlib Node déjà utilisée ; aucun nouveau package.

**Confiance et limite.** haute ; Build complet et captures du labo non lancés ; le check a échoué avant de comparer les constantes.

### ARCH-07 — La fin [DONE] du flux ne termine pas la lecture native

**P2 · risque ·** `main@e202cd1f8831abc0f69435b9e2d0d96dd491e841` · `src-tauri/src/inference.rs:279-325`

**Chemin/scénario et preuve.** Item::Done:285 ne fait que done=true. Le loop attend bytes.next() jusqu’à None ; stop confirmé et [DONE] reçus ne sortent pas de la boucle. Le script Python:66-68 fait au contraire break à [DONE].

**Impact.** Un proxy/serveur qui garde le corps SSE ouvert après [DONE] retarde le résultat, puis peut le transformer en timeout ; schedule_auto_delivery attend inference::stream et ne colle donc pas. Un flux qui ferme normalement, comme les fixtures actuelles, fonctionne.

**Alternative pragmatique.** Terminer la consommation sur la sentinelle terminale en exigeant toujours finish_reason=stop ; rejeter [DONE] prématuré. Fixture locale Rust : stop+[DONE] puis socket maintenue ouverte, et absence de stop ; ne pas supprimer les gardes contre résultat tronqué.

**Coût/compromis.** Petit changement dans boucle + tests HTTP locaux. La politique de terminaison est indépendante du choix de bibliothèque SSE.

**Confiance et limite.** moyenne ; Lecture statique seulement, pas de preuve que le vLLM livré maintient la réponse ouverte.

## 4. Réutilisation, duplications et performance

### À garder

- Les contrôles sont des wrappers **réels** Radix (imports controls.tsx:2-8), cmdk pour la recherche, Motion pour mouvement et présence, Lucide pour icônes. L’aspect Windows 11/Îlot n’est pas fourni tel quel par Radix : styling et géométrie custom ne sont pas une réinvention de son clavier/ARIA.
- Le framing SSE et le parsing `.env` sont au contraire des standards aux cas limites bien connus : c’est là que la réutilisation gagne quelque chose (ARCH-01/02/03). `reqwest`, `url`, `serde_json`, Tokio sont déjà les bons outils. Conserver les règles produit de finish_reason, confidentialité et collage plutôt que déléguer aveuglément à un SDK.
- Le dictionnaire i18n est typé et réparti par domaine, avec paramètres et `useSyncExternalStore`. Pour deux langues sans pluriels complexes, i18next n’est pas nécessaire. Le défaut est le transport d’erreurs en phrases exactes, pas la taille de cette bibliothèque maison.
- Le diff LCS a une complexité O(n·m), mais `changedRanges` utilise **2 000 000 cellules et 64 plages au plus**, trim prefix/suffix et repli sur bloc. La fonction `wordDiff` non bornée est un helper de parité/tests ; les callers utilisateur recherchés passent par `changedRanges`. Ne pas appeler ce chemin un OOM démontré ni imposer Myers/jsdiff avant mesure. Le surlignage de traduction peut préférer le bloc plutôt que chercher des mots « communs » sans sens.

### Source / labos

Il y a trois niveaux différents : `src/lab` importe les modules runtime pour exercices ; `design-lab/` conserve variantes Îlot historiques ; `design-lab/reglages` reste prototype de comparaison (incluant HeroUI/shadcn) et importe de vraies vues Îlot/résultat/halo pour sa démo. **Ne pas traiter HeroUI du labo comme dépendance prod.** Le build résout les bare imports de l’app sur les dépendances du labo pour éviter deux React, puis scope le CSS. Ce sont des adaptations utiles pour une page autonome, pas une raison de convertir tout le produit.

Quelques constantes et thèmes sont recopiés car les imports originaux tirent le pont Tauri ou des vues. Le check anti-dérive existe déjà mais est non portable (ARCH-06). Étape minimale : le rendre portable ; ensuite sortir uniquement les tokens et constantes pures réellement communs. Mutualiser l’ensemble des pages du prototype avec le runtime serait un mauvais compromis : scénarios, palettes et états simulés sont des besoins distincts. Le normaliseur production `connection/endpoint.ts` réexporte actuellement une fonction de `bridge.mock.ts` : déplacer cette fonction pure dans endpoint.ts rendrait la frontière plus lisible, sans nouveau service, sans en faire un bug.

### Intégration vLLM et mesure

Image, checkpoints et draft sont figés par digest/révision ; `general` couvre les actions de réécriture que les deux Hy-MT2 traducteurs ne peuvent pas fournir. La doc officielle vLLM 0.28 confirme les extras top_k/chat_template_kwargs et l’usage du SDK OpenAI. Le runtime retente sans extras quand un endpoint strict les nomme. Pas de migration « latest » recommandée.

`evaluate.py` teste **fast/quality uniquement**, avec prompt de traduction user-message, paramètres du lock et seed ; le runtime actuel utilise system+user et sampling .3/.9 sans max_tokens imposé. Les anciens CSV de traduction ne constituent donc **pas un benchmark de correction/Îlot/general/0.6.2**. README l’admet pour general. Option utile : ajouter une campagne synthétique dédiée aux actions actuelles en enregistrant le payload de configuration (jamais des textes réels), sans remplacer les anciens essais ni inventer de mesure.

Compose est loopback et l’exploitation entreprise est confiée à un reverse proxy HTTPS/authenticated, avec routes restreintes et sans corps dans les logs. La doc vLLM confirme qu’api-key seule ne protège pas toutes les routes : la consigne actuelle est bonne. Les réserves de VRAM du préflight ne sont pas une garantie de chargement ; pas de recommandation autoscaling/Prometheus sur la seule base d’une app personnelle.

## 5. Couverture des branches

L’inventaire de **35 refs** a été lu ; **22 refs pertinentes** ont reçu une lecture stat/cherry (voir JSON et ledger scratch), pas une review ligne par ligne de 22 arbres.

- **Déjà ancêtres :** main, refonte-reglages, da-ilot, fix-endpoint-tls, feat/release-and-endpoints.
- **Équivalence de tous les commits non-ancêtres signalée par `git cherry` (-) :** feat/frontend-primitives, feat/glass-frontend, feat/glass-material, feat/glass-native, feat/glass-native-polish, fix/scoped-drag, release/frontend-0.1.5, release/native-0.1.5, **release/server-0.1.5**. Le serveur n’est donc pas un chantier oublié ; ses correctifs lanceur sont présents sur main. `git show` du dernier patch et lecture du start.ps1 actuel confirment empty/stopped-service handling.
- **Équivalence partielle :** fix/native-window (un patch - et un +) ; pas de conclusion « le + manque encore » sans comparer l’évolution Windows.
- **Non équivalentes au sens patch-id :** codex/multi-editor-replacement, feat/0.5.0-design-1.0, wt-050-atelier/marque/natif/reglages/verre. Cela ne prouve pas que leur besoin manque ; une reprise modifiée ou direction abandonnée peut expliquer les différences.
- **Code/doc de branche consulté par git show en plus de stat :** frontend-primitives/UI-FOUNDATION, glass-frontend/useTranslation, release/frontend-0.1.5/bridge, release/server-0.1.5/preflight/start (patch), wt-050-natif/settings, wt-050-reglages/SettingsWindow, wt-050-verre/overlay-ipc. La duplication temporaire overlay-ipc des wt anciens n’est plus le contrat settings actuel. Les branches exclusivement natives/remplacement/assets sont cartographiées seulement ; les spécialistes natif/frontend en sont propriétaires.

## 6. Couverture fichiers et vérifications

| Périmètre | Lecture |
|---|---|
| Standards | AGENTS, UI-DECISIONS, BRIDGE, SPEC ; PLAN-0.6 §0-1 lu directement ; sections longues ciblées/inventaire |
| Front architecture | App/main, types, bridge (début + exports), useSettings, useTranslation, SettingsWindow début, useSettingsStore, messages, endpoint, i18n, controls imports/contrôles, diff et callers recherchés |
| Rust | lib inventaire de symboles, réglages application, translate ; inference parser/filtre/loop/tests ; probe client et bounded_body ; settings début/migration/écriture/messages ; types inventaire ; Cargo manifest |
| Server | README, compose, lock, preflight, evaluate, start, test_evaluation ; GPU helper chargé sans activation |
| Labos | README réglages, build, demo-check ; structure des autres labos inventoriée, pas revue complète des visuels |

**Exécutions bornées :**

- `python -B artefacts-locaux/architecture-work/repro.py` — exit **0**, journal `artefacts-locaux/architecture-work/repro.log`.

- `node scripts/demo-check.mjs` — exit **1**, journal `artefacts-locaux/architecture-work/lab-check.log`.

- `node --input-type=module -e "import {describeRefusal} from './src/settings/messages.ts'; console.log(JSON.stringify({known:describeRefusal('Le raccourci est déjà utilisé ou indisponible.', k => 'EN:'+k),saveFailure:describeRefusal('Impossible d’enregistrer les paramètres.', k => 'EN:'+k)}));"` — exit **0**, journal `artefacts-locaux/architecture-work/i18n.log`.

Le repro Python passe ses observations attendues : contrôle standard success=true ; multiline false ; null_choices TypeError ; deux env pourtant valides refusés ; GPU vide non remplacé. Node démontre le fallback français. Le check du labo échoue réellement (ENOENT), ce n’est pas une comparaison de constantes réussie. `git status --porcelain` était vide après ces lectures/checks ; pas de correction, commit, changement de branche ou génération dans le checkout partagé.

Les commandes d’inventaire `git show --stat` / `git cherry main origin/<ref>` sont enregistrées dans `architecture-work/branch-coverage.json`. `git log -S` a servi à vérifier l’intention de la limite de streaming. Aucune suite globale exécutée : QA reste propriétaire.

### Sources officielles consultées

- [framing SSE multi-data](https://html.spec.whatwg.org/multipage/server-sent-events.html#event-stream-interpretation) — consulté le 2026-10-10.

- [règles .env/interpolation/defaults](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/) — consulté le 2026-10-10.

- [adaptateur Stream de bytes vers événements SSE ; alternative à qualifier](https://docs.rs/eventsource-stream/latest/eventsource_stream/) — consulté le 2026-10-10.

- [client OpenAI/extra_body, chat_template_kwargs et sécurité proxy](https://docs.vllm.ai/en/v0.28.0/serving/online_serving/openai_compatible_server/) — consulté le 2026-10-10.

### Limites
- Lecture ciblée, pas exhaustivité ligne par ligne. Les fichiers longs ont été lus par portions/inventaire de symboles ; couverture détaillée Markdown.
- Aucune suite globale lancée (QA propriétaire), aucune installation, aucun GPU, poids, vrai endpoint ou service contacté.
- Cargo et Docker absents ; aucune validation native Windows, chargement Gemma/Hy-MT2 ni génération réelle. Version Node exécutée 26.7.0, différente de la valeur indicative du brief.
- Les seules reproductions dynamiques sont le parseur Python avec urllib remplacé, le formatter i18n Node et le check du labo. Risques Rust sont statiques.
- Deux premières URL vLLM anciennes n’ont pas été extraites ; URL corrigée online_serving consultée avec succès.
- Pas d’audit versions/advisories ni d’évaluation qualité humaine ou de compatibilité GPU ; les affirmations historiques du repo ne sont pas une validation nouvelle.

## 7. Priorisation sans refonte

1. Corriger le parsing de configuration effective et le parser/validation Python ; rétablir le check labo portable.
2. Fixtures HTTP locales Rust pour corps borné/annulation, `[DONE]` avec socket ouverte et gros événement ; adapter la consommation sans casser les longues réponses intentionnelles.
3. Mapping erreurs de sauvegarde maintenant, contrat de refus structuré quand ce domaine évolue.
4. Découper progressivement l’orchestration native au fil des changements réels, pas en release de réécriture.

**Livrables uniquement :** ce Markdown, JSON homologue et fixtures/journaux scratch d’audit. Aucune modification de code, configuration, mémoire ou skill ; aucune publication.
