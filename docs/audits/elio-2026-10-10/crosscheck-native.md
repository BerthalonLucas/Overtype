# Contre-review native et branches — Overtype

Main figé : `e202cd1f8831abc0f69435b9e2d0d96dd491e841`. Revue ciblée des **17 IDs** (12 natifs, 5 branches), sans modification produit.

## Conclusion bornée

**11 confirmés statiquement, 6 à nuancer, aucun reproduit ni rejeté intégralement.** Les nuances portent sur causalité, intentions documentées, portée ou priorité; elles ne certifient pas un comportement sûr sous Windows.

- P1 proposés : NATIVE-001/002 (garantie de cible/sélection à préciser et scénarios non reproduits), NATIVE-005 (mutex/UI/hook), NATIVE-006 (livraison non révoquée après fermeture).
- NATIVE-003 : P1 → P2 (concurrence/provenance conditionnelle, pas fuite reproduite); NATIVE-008 : P1 → P2 (état actions vide invalide, refusé par save normal).
- NATIVE-011 et BR-04 : P2 → P3 (durcissement et arbitrage produit, pas vulnérabilité ni obligation actuelle de persistance prouvée).
- BR-01 = NATIVE-008 : doublon à fusionner, pas deux défauts. Les sévérités par ID ne constituent donc pas un total de bugs uniques.

**Contrat déterminant :** `docs/UI-DECISIONS.md:21–22` exclut une lecture obligatoire du document avant collage. Ce choix est conservé dans toutes les recommandations. Il ne rend ni une identité perdue ni une sélection inexistante vérifiées; inversement, une relecture positive optionnelle doit être une vraie preuve pour annoncer `confirmed=true`.

## Matrice des verdicts

| ID | Verdict | Sévérité initiale → proposée |
|---|---|---|
| NATIVE-001 | à nuancer | P1 → P1 |
| NATIVE-002 | à nuancer | P1 → P1 |
| NATIVE-003 | à nuancer | P1 → P2 |
| NATIVE-004 | à nuancer | P2 → P2 |
| NATIVE-005 | confirmé statiquement | P1 → P1 |
| NATIVE-006 | confirmé statiquement | P1 → P1 |
| NATIVE-007 | confirmé statiquement | P2 → P2 |
| NATIVE-008 | confirmé statiquement | P1 → P2 |
| NATIVE-009 | confirmé statiquement | P2 → P2 |
| NATIVE-010 | confirmé statiquement | P2 → P2 |
| NATIVE-011 | à nuancer | P2 → P3 |
| NATIVE-012 | confirmé statiquement | P2 → P2 |
| BR-01 | confirmé statiquement | P2 → P2 |
| BR-02 | confirmé statiquement | P2 → P2 |
| BR-03 | confirmé statiquement | P3 → P3 |
| BR-04 | à nuancer | P2 → P3 |
| BR-05 | confirmé statiquement | P3 → P3 |

## Verdicts détaillés

### NATIVE-001 — Revalidation UIA permissive : choix délibéré, garantie de sélection non établie

**à nuancer · P1 proposé** (initial : P1).

Le chemin de collage accepte effectivement une perte de lecture UIA : absence du focused element, runtime id illisible ou erreur de sélection autre que NO_SELECTION. Pour une cible UIA capturée avec identité, aucune deuxième copie ne remplace cette preuve. Le watcher emploie exactement le même validateur. Le risque de collage après déplacement interne reste valide, mais ce n’est pas une omission accidentelle : commentaires et tests consacrent explicitement ce choix.

**Gardes, contre-exemples et limites :** Le foreground, un changement de contrôle connu, un runtime id différent connu, un texte/longueur/anchor différents et une sélection explicitement collapsed sont refusés; trois validations entourent les attentes et l’écriture du clipboard. Le code ne laisse donc pas passer toute modification. UI-DECISIONS:22 autorise l’absence de relecture DU DOCUMENT; elle ne fournit pas de preuve de sélection/identité. BRIDGE et tests admettent cependant le provider silencieux : tension entre contrat de sécurité AGENTS/SPEC et compatibilité documentée, à résoudre explicitement.

**Preuves relues :**
- `src-tauri/src/capture.rs:428–445` — Retour Ok quand UIA ne donne pas d’élément; validation conditionnelle du contrôle et de l’id.
- `src-tauri/src/capture.rs:453–513` — element_changed ignore None; selection_changed ignore erreurs autres que NO_SELECTION; control_copy réservé à Copy.
- `src-tauri/src/capture.rs:578–599` — Trois validate_target, mais pas de preuve de remplacement pour Uia silencieuse.
- `src-tauri/src/capture.rs:783–793` — Test explicite : un contrôle devenu inaccessible n’est pas un changement.
- `src-tauri/src/lib.rs:3145–3164` — Watcher dépend du même validate_target.
- `src-tauri/src/pasted.rs:219–226` — Undo exige texte relocalisé mais ignore l’échec de runtime id.
- `AGENTS.md:10–10` — Identité et texte doivent être revalidés.
- `docs/UI-DECISIONS.md:21–22` — Document readback optionnel, pas abrogation explicite de l’identité/sélection.

**Suite proposée :** Conserver le collage sans lecture du document; préciser une preuve de sélection/identité de remplacement quand UIA devient muette, sinon Copier. Ne pas rétablir la précondition whole-document de PR6.

### NATIVE-002 — L’égalité de deux copies ne prouve pas une sélection active

**à nuancer · P1 proposé** (initial : P1).

replaceable(Copy)=true et same_copy vérifie exclusivement l’égalité du texte non vide. Une copie sans sélection produisant la même ligne est mathématiquement indiscernable d’une sélection dans cette implémentation. Le cas dangereux reste plausible et important pour l’intégrité du document.

**Gardes, contre-exemples et limites :** La seconde copie n’est PAS absente : elle refuse une sélection perdue si la ligne copiée diffère du texte capturé. Le scénario VS Code/Monaco dépend du réglage copy-without-selection, de Ctrl+Insert et de l’accessibilité réelle du provider/version; il n’est pas une reproduction universelle. Si UIA expose la sélection, le chemin Uia remplace le scénario Copy. Après collage, certains cas de lecture seule sont détectés, mais une insertion réellement faite n’est pas annulée par ces checks.

**Preuves relues :**
- `src-tauri/src/capture.rs:202–212` — Copy remplaçable même sans propriété de plage.
- `src-tauri/src/capture.rs:336–384` — Capture Copy issue de la copie; selection_len est le nombre de caractères copiés, pas une plage native.
- `src-tauri/src/capture.rs:466–487` — Contrôle exact, pas contains; commentaire reconnaît la copie de ligne sans sélection.
- `src-tauri/src/capture.rs:578–584` — Second control_copy avant paste.
- `src-tauri/src/capture.rs:620–637` — Post-check read-only ne protège pas d’une insertion réussie au caret.

**Suite proposée :** Prouver le cas sur un éditeur et ses réglages avant annoncer duplication reproduite; utiliser une preuve de sélection native/UIA ou adaptateur borné sans imposer lecture du document.

### NATIVE-003 — Attribution des changements clipboard : risque concurrent, pas fuite reproduite

**à nuancer · P2 proposé** (initial : P1).

take_copy attribue un changement global à la copie synthétique et settle_and_swap restaure sans vérifier le producteur. watch_late assimile absence de nouvel input à provenance. Un writer autonome peut donc être pris pour la source et écrasé. Le verrou exclut un writer PENDANT la lecture/restauration, pas celui qui précède sa prise.

**Gardes, contre-exemples et limites :** Après put_text, restore_ours vérifie bien GetClipboardOwner sous OpenClipboard : le constat ne doit pas être élargi à toute restauration. Le foreground est vérifié avant la capture puis après, et des writers récents sont conservés sur le chemin paste. Les marques sensibles ne sont garanties par le contrat actuel que pour une copie Fresh; refuser tous les opt-outs de copies synthétiques pourrait interdire des éditeurs légitimes. Une fuite vers un modèle exige writer concurrent, capture acceptée et action/inférence; aucun de ces effets Windows n’est reproduit. PID/owner seul est insuffisant avec OLE/broker.

**Preuves relues :**
- `src-tauri/src/clipboard_guard.rs:177–214` — Séquence puis lecture/restauration sans identité source.
- `src-tauri/src/clipboard_guard.rs:243–266` — Late copy dépend du tick input, pas du owner/PID.
- `src-tauri/src/clipboard_guard.rs:368–384` — Contre-garde réelle : restore_ours exige owner == notre fenêtre.
- `src-tauri/src/capture.rs:339–359` — Sensitive check Fresh et foreground après la capture.
- `docs/BRIDGE.md:248–248` — Contrat des marques : copie fraîche utilisateur.

**Suite proposée :** Tester un writer autonome; transporter provenance et politique brokers dans take_copy/watch_late; ne pas présenter GetClipboardOwner comme solution universelle.

### NATIVE-004 — Dégradation TextOnly réelle, explicitement assumée dans le code

**à nuancer · P2 proposé** (initial : P2).

Un échec Snapshot devient TextOnly et peut perdre tous les formats autres que Unicode lors d’une copie/collage. TextOnly(None) ne restaure rien : la phrase « aucune restauration » est plus juste que « restaure un presse-papiers vide ». Le défaut d’information utilisateur et la perte possible restent P2.

**Gardes, contre-exemples et limites :** Le repli est documenté (Keeper et synthetic_copy), non une régression mystérieuse; allocations avant EmptyClipboard et checks owner/sequence existent. Les bitmaps avec DIB/DIBV5 ne sont PAS tous perdus : ils sont sauvegardés via leurs formats mémoire. Il faut un format refusé, un budget dépassé ou une autre erreur Snapshot. La recommandation de refus strict diminue la couverture produit et nécessite arbitrage, pas portage automatique de PR6.

**Preuves relues :**
- `src-tauri/src/clipboard_guard.rs:85–119` — Formats non duplicables et budget; bitmap récupérable via DIB.
- `src-tauri/src/clipboard_guard.rs:123–155` — Dégradation explicite; None => aucune remise.
- `src-tauri/src/clipboard_guard.rs:186–214` — Restored retourné; transaction copie peut restaurer uniquement Unicode.
- `src-tauri/src/capture.rs:387–416` — Commentaire admet texte seul; restored ignoré.
- `src-tauri/src/capture.rs:586–626` — Paste utilise Keeper et ignore résultat de restore_ours.

**Suite proposée :** Signaler la dégradation avant modification, ou refuser sans perte avec fallback clair. Conserver les garde-fous contre nouveaux writers.

### NATIVE-005 — Un mutex détenu pendant UIA peut bloquer les commandes Tauri synchrones

**confirmé statiquement · P1 proposé** (initial : P1).

La règle API Tauri confirme sync sans command(async) exécuté sur main thread. get_settings/copy_result/frontend_ready peuvent attendre inner, détenu tout au long de paste et locate. Le hook LL est installé dans setup sur le thread appelant; les threads menu-keys/undo-watch ne déplacent PAS l’installation. Le risque UI/hook est fondé.

**Gardes, contre-exemples et limites :** Le raccourci normal et les livraisons sont déjà spawn_blocking; l’appel demo à capture_text aussi. La méthode bridge.captureText n’a pas de call-site de production trouvé dans src : ne pas décrire ce seul invoke comme le parcours quotidien. En revanche getSettings est appelé par plusieurs vues. Retrait du hook n’est ni certain à chaque livraison ni mesuré : il faut un blocage dépassant le timeout pendant une notification clavier. Les handles natifs cachés évitent un autre deadlock mais pas l’attente mutex UI.

**Preuves relues :**
- `src-tauri/src/lib.rs:592–595` — get_settings sync + inner.lock.
- `src-tauri/src/lib.rs:642–659` — Raccourci dispatché spawn_blocking.
- `src-tauri/src/lib.rs:989–991` — capture_text sync disponible IPC.
- `src-tauri/src/lib.rs:1316–1318` — frontend_ready sync + mutex.
- `src-tauri/src/lib.rs:1599–1654` — Worker paste/locate garde inner.
- `src-tauri/src/lib.rs:1865–1872` — copy_result sync appelle result_for, mutex.
- `src-tauri/src/lib.rs:3343–3373` — Hook installé setup; demo capture sur worker.
- `src-tauri/src/host.rs:591–603` — Workers pour callbacks métier; SetWindowsHookEx reste dans appelant.
- `src/useSettings.ts:18–18` — Appel getSettings réel.
- `src-tauri/src/lib.rs:1586–1591` — result_for acquiert inner, appelé par copy_result sync.

**Suite proposée :** Raccourcir le lock et sortir des commandes UI les attentes; hook sur thread dédié pompant. Garder les appels fenêtre main-thread où Tauri l’exige.

### NATIVE-006 — Fermeture visuelle immédiate sans révocation d’un collage déjà engagé

**confirmé statiquement · P1 proposé** (initial : P1).

force_close cache la fenêtre et ferme les scopes atomiques, mais close_now attend inner dans un autre thread. Un worker gardant inner pendant UIA peut reprendre et envoyer Ctrl+V après cette fermeture, tant que ses checks cible passent. Le watcher n’est pas une garde externe : il attend lui aussi inner. Aucun token indépendant n’est consulté par paste avant SendInput.

**Gardes, contre-exemples et limites :** claim_delivery empêche bien les doubles livraisons; pending_dismiss/visible/active sont testés AVANT de prendre la cible. Ces protections marchent si la fermeture obtient le lock avant delivery. Elles ne rendent pas révocable le travail natif déjà engagé. La nouvelle capture est bloquée plutôt qu’une livraison concurrente; il ne faut pas annoncer injection annulable une fois envoyée. Scénario watchdog accessible via try_lock + lock stuck même si main est gelé.

**Preuves relues :**
- `src-tauri/src/lib.rs:1603–1621` — Checks de début puis paste sous inner.
- `src-tauri/src/lib.rs:1882–1892` — Même verrou pour remplacement manuel.
- `src-tauri/src/lib.rs:1962–1986` — Hide immédiat, close_now seulement après lock.
- `src-tauri/src/lib.rs:2023–2053` — Watchdog force sur WouldBlock et durée dépassée.
- `src-tauri/src/lib.rs:3073–3086` — Watcher attend le même mutex.
- `src-tauri/src/capture.rs:578–599` — Checks cible mais pas cancellation/latch avant injection.
- `docs/SPEC.md:19–19` — Closing cancels immediately.

**Suite proposée :** Poser une génération/latch indépendant dès annulation, relire après attentes et juste avant injection. Ne pas prétendre qu’un timeout tokio tue COM.

### NATIVE-007 — SendInput partiel copy sans key-up compensatoire

**confirmé statiquement · P2 proposé** (initial : P2).

send_copy_chord retourne Err sans cleanup si sent != 4. Paste et Undo ont bien une libération best-effort; aucune garde appelante ne libère Ctrl/Insert injectés. L’asymétrie est confirmée.

**Gardes, contre-exemples et limites :** Le cas demande 0 < sent < 4; un refus total UIPI ne laisse pas de touche nouvellement pressée. Le risque n’est pas une touche bloquée systématiquement après chaque échec. Le cleanup lui-même n’offre pas de garantie absolue si Windows refuse également ses key-up.

**Preuves relues :**
- `src-tauri/src/host.rs:1202–1213` — Erreur immédiate copy.
- `src-tauri/src/host.rs:1219–1255` — Key-up compensatoire paste/undo.
- `src-tauri/src/capture.rs:408–421` — Appelant remonte erreur, pas cleanup.

**Suite proposée :** Réutiliser le cleanup best-effort du paste pour Ctrl/Insert; fixture injection partielle et validation Windows.

### NATIVE-008 — actions:[] panique avant validation, mais état invalide non produit normalement

**confirmé statiquement · P2 proposé** (initial : P1).

Avec actions:[], le filter(defaultActionId) échoue quel que soit l’id et unwrap_or_else indexe actions[0]. Aucun garde/migration n’existe avant cette expression. load en setup propage normalement les erreurs, pas un panic; release panic=abort.

**Gardes, contre-exemples et limites :** Le JSON est structurellement désérialisable, pas un réglage VALIDE métier. save appelle validate et refuse les actions vides. Aucune preuve que l’UI normale ou une migration supportée crée ce fichier. P1 startup crash est excessif sans incident/fréquence : P2 robustesse pour fichier édité/corrompu. Même finding que BR-01, à compter une seule fois.

**Preuves relues :**
- `src-tauri/src/settings.rs:184–209` — Actions Option<Vec>, fallback uniquement pour None; index Vec vide.
- `src-tauri/src/settings.rs:257–278` — Migrations/validate après index; save valide avant écriture.
- `src-tauri/src/lib.rs:3211–3213` — load durant setup.
- `src-tauri/Cargo.toml:76–81` — panic=abort release.
- `src-tauri/src/actions.rs:377–378` — validate refuse explicitement zéro action : état non sauvable via save normal.

**Suite proposée :** first().ok_or avant calcul du défaut, puis récupération non destructive; fixture Rust à exécuter dans environnement équipé.

### NATIVE-009 — Historique désactivé néanmoins initialisé obligatoirement

**confirmé statiquement · P2 proposé** (initial : P2).

HistoryStore::new s’exécute inconditionnellement avant app.manage. Open/schema/migration/prune faillibles propagent leur erreur au setup. La panne SQLite d’une fonctionnalité opt-in peut donc empêcher l’app de démarrer.

**Gardes, contre-exemples et limites :** Ce n’est pas une fuite de contenu : disabled n’implique aucun history.add. Un historique chiffré DPAPI illisible dans une ligne ne provoque pas nécessairement cette panne au démarrage, car new ne déchiffre pas les lignes. Le cas démontrable statiquement est DB/schema/WAL/prune en erreur, pas toute ancienne clé DPAPI.

**Preuves relues :**
- `src-tauri/src/lib.rs:3226–3261` — HistoryStore::new sans test history_enabled.
- `src-tauri/src/history.rs:20–49` — Erreurs d’ouverture/init/migration/prune.
- `docs/SPEC.md:31–31` — Historique optionnel, off par défaut.

**Suite proposée :** État HistoryUnavailable ou init paresseuse; ne pas copier la récupération historique best-effort WAL/SHM sans cohérence.

### NATIVE-010 — Contains peut confirmer un document inchangé

**confirmé statiquement · P2 proposé** (initial : P2).

readback_confirms examine la présence de value n’importe où dans field. La boucle sort confirmed=true avant unwritten, lequel est conditionné par !confirmed. Si le résultat existe déjà ailleurs et l’éditeur bloque paste, le flag est une fausse confirmation. locate_pasted ultérieur ne rétrograde pas Delivery.

**Gardes, contre-exemples et limites :** Un collage non lisible confirmed=false est expressément autorisé; ce constat n’impose PAS de document relisible pour coller. original==result est un succès légitime sans changement : l’exemple fautif doit employer deux textes différents. Le refus initial read-only limite les providers fiables, mais Copy est toujours editable=true et un handler paste web peut annuler indépendamment de cette propriété.

**Preuves relues :**
- `src-tauri/src/capture.rs:527–530` — Contains document-wide.
- `src-tauri/src/capture.rs:584–628` — Before acquis mais !confirmed saute unwritten.
- `src-tauri/src/capture.rs:645–648` — Cas identique remplacé/value exclu à juste titre.
- `src-tauri/src/lib.rs:1624–1669` — locate ne révise pas outcome/confirmed.

**Suite proposée :** Écarter la confirmation si absence de changement prouvée et résultat différent; confirmer localement si possible, sinon rester assumed sans rendre le document obligatoire.

### NATIVE-011 — Commandes métier partagées : durcissement ACL, pas vulnérabilité établie

**à nuancer · P3 proposé** (initial : P2).

build.rs ne fournit pas AppManifest::commands. Les capabilities limitent certains plugins/core APIs, pas ces commandes app autorisées par défaut selon Tauri. save_settings ne contrôle pas le label appelant. Le constat technique est juste.

**Gardes, contre-exemples et limites :** Certaines commandes sensibles ont déjà une garde KEYED (lecture clés, sonde/journal); CSP script self, pages locales et absence de remote capability restreignent l’exposition. Une app possédant plusieurs vues d’un même bundle ne requiert pas nécessairement séparation complète métier. Aucune compromission frontend, navigation hostile ou violation démontrée; traiter comme P3 défense en profondeur, pas P2 incident/accès distant.

**Preuves relues :**
- `src-tauri/build.rs:1–3` — tauri_build::build sans app_manifest.
- `src-tauri/capabilities/default.json:5–15` — Labels et permissions core.
- `src-tauri/capabilities/settings.json:5–15` — Permissions spécifiques fenêtre, pas commandes métier.
- `src-tauri/src/lib.rs:584–595` — KEYED garde/masquage existants.
- `src-tauri/src/lib.rs:664–671` — save_settings sans caller.
- `src-tauri/tauri.conf.json:63–65` — CSP locale restrictive.
- `src-tauri/src/lib.rs:2725–2726` — connection_window garde KEYED; contre-exemple à absence générale d’autorisation.

**Suite proposée :** Définir d’abord la frontière de confiance attendue entre vues; utiliser AppManifest/ACL pour writes sensibles, sans inventer exploit.

### NATIVE-012 — Seule première plage UIA capturée et validée

**confirmé statiquement · P2 proposé** (initial : P2).

get_selection().into_iter().next() ignore les autres plages. La même fonction sert à revalidation. L’API Microsoft fournit une plage par sélection disjointe; aucune cardinalité SupportedTextSelection n’est contrôlée avant capture remplaçable.

**Gardes, contre-exemples et limites :** GetSelection n’est pas toujours multi-range : sans sélection, il renvoie une plage dégénérée que le code refuse correctement. L’effet « plusieurs insertions » dépend ensuite du Ctrl+V de l’éditeur; non établi sur Word/Outlook/Monaco ici. Le fait statique certain est l’action calculée pour la première plage sans déclarer l’incomplétude.

**Preuves relues :**
- `src-tauri/src/capture.rs:61–87` — Première plage seulement.
- `src-tauri/src/capture.rs:262–305` — Peut devenir target Uia remplaçable.
- `src-tauri/src/capture.rs:461–463` — Revalidation réutilise selection.
- `src-tauri/src/pasted.rs:113–118` — Caret première plage aussi.

**Suite proposée :** Refuser la cardinalité multiple dans tout le parcours; ne pas convertir ce refus en Copy remplaçable. Fixture provider multi-range avant qualifier l’impact éditeur.

### BR-01 — Doublon NATIVE-008 : garde liste vide absente

**confirmé statiquement · P2 proposé** (initial : P2).

Le first().ok_or de wt-050-natif n’existe pas sur main; index panique pour actions:[] avant validate. Le correctif historique est petit et adaptable.

**Gardes, contre-exemples et limites :** Même défaut que NATIVE-008, pas un second bug. Le fichier doit être incohérent; save valide la collection avant écriture. La reprise globale du schéma 0.5 est injustifiée.

**Preuves relues :**
- `src-tauri/src/settings.rs:201–209` — Index avant validate.
- `src-tauri/src/settings.rs:263–278` — validate tardif load, précoce save.
- `origin/wt-050-natif:src-tauri/src/settings.rs:162–168` — first().ok_or_else au lieu d’index.
- `src-tauri/src/actions.rs:377–378` — validate refuse explicitement zéro action : état non sauvable via save normal.

**Suite proposée :** Conserver P2 de branches, fusionner avec NATIVE-008 dans la synthèse.

### BR-02 — Réglages invalides bloquent setup sans récupération

**confirmé statiquement · P2 proposé** (initial : P2).

load échoue sur lecture/JSON/décryptage/validate et setup utilise ?. settings.0.5.bak.json sert uniquement à la sauvegarde de migration, jamais fallback de load. La récupération historique load_tolerant n’est pas reprise.

**Gardes, contre-exemples et limites :** Fail-closed évite d’envoyer une clé à une configuration devinée; save actuel utilise tmp + remplacement plutôt qu’une écriture directe tronquante. Il n’existe pas de preuve de corruption provoquée par le produit. Le backup 0.5 n’est pas une sauvegarde récente universelle : ne pas le restaurer silencieusement au détriment des nouveaux serveurs.

**Preuves relues :**
- `src-tauri/src/settings.rs:179–191` — Backup et load strict.
- `src-tauri/src/settings.rs:217–228` — decrypt_key faillible.
- `src-tauri/src/settings.rs:263–273` — Backup créé seulement pour migration, non lu en secours.
- `src-tauri/src/settings.rs:324–327` — Save tmp + replace.
- `src-tauri/src/lib.rs:3211–3213` — Erreur bloque setup.
- `origin/wt-050-natif:src-tauri/src/settings.rs:198–240` — load_tolerant historique; set_aside ignoré => pas à porter aveuglément.

**Suite proposée :** Sauver original avant secours; recovery explicite, accueil avec notice, pas écrasement silencieux ni désactivation de la protection des clés.

### BR-03 — Matrice Edge historique : couverture absente, pas bug prouvé

**confirmé statiquement · P3 proposé** (initial : P3).

Le script et replacement_tests.rs sont absents de main. Script PR6 vérifie insertFromPaste, surrounding text, formats b/i, undo natif, iframe/shadow, clipboard concurrency, duplicate delivery. capture-matrix main observe capture/clipboard/UI, pas ces invariants de remplacement.

**Gardes, contre-exemples et limites :** Main garde des unit tests clipboard/capture/state et tests frontend, ainsi qu’une CI Windows cargo test : « aucun test natif » serait faux. Le driver historique utilise anciens contrats et le refus si document modifié (lignes 95–103), incompatible avec la priorité produit sans lecture obligatoire. Le Ctrl+Z du script teste l’undo ÉDITEUR; pas directement le nouveau bouton Undo de l’app. Le script ne prouve pas que sa matrice passe aujourd’hui.

**Preuves relues :**
- `origin/codex/multi-editor-replacement:scripts/test-replacement-windows.mjs:66–122` — Assertions navigateur + driver SendInput réel; critères document/focus/selection historiques.
- `scripts/capture-matrix.mjs:68–94` — Capture, original, clipboard; pas lecture du champ après replacement.
- `.github/workflows/ci.yml:36–51` — CI Windows avec cargo test existante.
- `src-tauri/src/capture.rs:692–847` — Unit tests existants.

**Suite proposée :** Porter les assertions utiles, pas le moteur ni le critère document inchangé; tests Windows interactifs séparés, ne pas exécuter sur Linux.

### BR-04 — Erreurs du verre : timers réels, persistance obligatoire non établie

**à nuancer · P3 proposé** (initial : P2).

Pour le parcours GlassSession direct/display, phase error est settled; budget normal puis fermeture automatique sauf hover/focus/pin/etc. Le feedback des commandes copy/replace expire après 3 s. La branche wt-050-verre faisait persister les erreurs, mais cette décision de branche ne suffit pas à imposer une exigence actuelle.

**Gardes, contre-exemples et limites :** L’erreur réseau state.error n’est PAS effacée par le timer feedback : elle demeure dans error-copy ou subtle-warning jusqu’à fermeture du verre. AutoClose=never, présence pointeur, clavier et menu peuvent empêcher la fermeture; BR-04 n’est donc pas général. UI-DECISIONS:10 maintient auto-close du mode Afficher le résultat et :46 demande erreurs visibles/claires sans durée illimitée. L’Îlot a son propre parcours. Persistance mérite arbitrage P3, pas bug P2 démontré. Le commentaire historique:306–308 revendique « décisions du 17/09, Q6 »; cette attribution n’a pas été retrouvée dans les contrats actuels examinés. Ne pas affirmer que Lucas a rejeté la persistance : la priorité documentaire reste à clarifier.

**Preuves relues :**
- `src/GlassOverlay.tsx:148–151` — Routes IlotStage/GlassSession distinctes.
- `src/GlassOverlay.tsx:190–190` — Auto-close selon réglage.
- `src/GlassOverlay.tsx:237–240` — error settled.
- `src/GlassOverlay.tsx:294–300` — Timer feedback seulement.
- `src/GlassOverlay.tsx:347–382` — Budget et garde held.
- `src/GlassOverlay.tsx:512–543` — Retry et state.error restent distincts du feedback.
- `origin/wt-050-verre:src/GlassOverlay.tsx:71–74` — Ancienne politique de persistance.
- `docs/UI-DECISIONS.md:10–10` — Auto-close conservé display.
- `docs/UI-DECISIONS.md:46–46` — Visibilité/clarté sans durée explicitée.
- `origin/wt-050-verre:src/GlassOverlay.tsx:304–322` — failed exclu du budget et ajouté à held; commentaire revendique décision 17/09 Q6.

**Suite proposée :** Demander décision produit spécifique au verre direct; si erreurs persistantes voulues, ajouter tests timers, ne pas généraliser à Îlot.

### BR-05 — Type-check e2e non inclus dans build

**confirmé statiquement · P3 proposé** (initial : P3).

tsc -b référence uniquement app/node; includes src/vite.config. E2E/visual-tests ne sont pas racines et tsconfig.test.json historique est absent. CI build puis playwright n’ajoute pas un typecheck de ces tests.

**Gardes, contre-exemples et limites :** Les tests sous src sont bien couverts; les erreurs d’exécution e2e sont encore testées par Playwright. Absence de compilation des types de tests n’établit ni types actuellement cassés ni panne utilisateur. Le coût peut inclure des imports/types Node ambiants à adapter.

**Preuves relues :**
- `tsconfig.json:1–4` — Seulement app/node.
- `tsconfig.app.json:20–20` — include src.
- `tsconfig.node.json:15–15` — include vite.config.ts.
- `package.json:13–14` — build tsc -b && vite build.
- `.github/workflows/ci.yml:17–21` — Pas de typecheck tests séparé.
- `origin/wt-050-atelier:tsconfig.test.json:20–24` — Projet historique include e2e/visual-tests/env.

**Suite proposée :** Ajouter un projet noEmit et check CI avec TypeScript existant; pas besoin de reprendre les assertions UI historiques.

## Vérifications réellement exécutées

- Git : HEAD/SHA branches et état du checkout; checkout propre, aucun changement de HEAD. `git show` des variantes citées, `git log -S` sur tolérance UIA et TextOnly.
- Inventaire main par `git cat-file -e` : driver remplacement et tsconfig.test absents (code 128 attendu, pas échec de test). Recherche ciblée des call-sites, gardes et signatures, puis validation programmatique de couverture exacte des IDs et des bornes des références de lignes.
- Documentation officielle Tauri/Microsoft récupérée pour départager thread sync, ACL app, ranges UIA et compteur SendInput.
- Aucun lancement application, cargo test, build, test navigateur ou repro Windows. Cargo/rustc absents. Les fixtures décrites dans les rapports initiaux ne sont pas des résultats exécutés ici.

Sorties Git/environnement : `crosscheck-native-checks.json`; résultats structurés et matrice : `crosscheck-native.json`.

## Couverture et méthode

Guides Agency effectivement lus : `testing/testing-reality-checker.md`, `engineering/engineering-code-reviewer.md` (source f99f6aa910a442b0197b768ce0ea7751e35e2060). Adaptation : confrontation aux fichiers/contrats et limitation des claims, sans exécuter exemples Laravel/Playwright ni imposer un score/échec automatique.

Branches examinées uniquement pour ces constats :
- `main` @ `e202cd1f8831abc0f69435b9e2d0d96dd491e841`.
- `wt-050-natif` @ `1fcdd21f0aadd5a36978e47e6530b9fe9f1c74bd`.
- `wt-050-verre` @ `c5345af95ec9fa6ac00cdea1444aba09cd4ba375`.
- `wt-050-atelier` @ `5b5f6a56962f59202d2ea127daf52cedf0439ba5`.
- `codex/multi-editor-replacement` @ `86b3b23f217b4e26976815fca253397012a6cd4b`.

Fichiers/fonctions examinés :
- `.github/workflows/ci.yml`
- `AGENTS.md`
- `docs/BRIDGE.md`
- `docs/SPEC.md`
- `docs/UI-DECISIONS.md`
- `origin/codex/multi-editor-replacement:scripts/test-replacement-windows.mjs`
- `origin/wt-050-atelier:tsconfig.test.json`
- `origin/wt-050-natif:src-tauri/src/settings.rs`
- `origin/wt-050-verre:src/GlassOverlay.tsx`
- `package.json`
- `scripts/capture-matrix.mjs`
- `src-tauri/Cargo.toml`
- `src-tauri/build.rs`
- `src-tauri/capabilities/default.json`
- `src-tauri/capabilities/settings.json`
- `src-tauri/src/actions.rs`
- `src-tauri/src/capture.rs`
- `src-tauri/src/clipboard_guard.rs`
- `src-tauri/src/history.rs`
- `src-tauri/src/host.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/src/pasted.rs`
- `src-tauri/src/settings.rs`
- `src-tauri/tauri.conf.json`
- `src/GlassOverlay.tsx`
- `src/bridge.ts`
- `src/useSettings.ts`
- `tsconfig.app.json`
- `tsconfig.json`
- `tsconfig.node.json`

## Sources API officielles

- [Tauri calling Rust](https://v2.tauri.app/develop/calling-rust/) — Sync commandes main thread sauf command(async).
- [Tauri capabilities](https://v2.tauri.app/security/capabilities/) — App commands autorisées par défaut; AppManifest::commands.
- [Microsoft LowLevelKeyboardProc](https://learn.microsoft.com/en-us/windows/win32/winmsg/lowlevelkeyboardproc) — Thread installateur, pompe, retrait après timeout; 1000 ms plafond.
- [Microsoft GetSelection](https://learn.microsoft.com/en-us/windows/win32/api/uiautomationclient/nf-uiautomationclient-iuiautomationtextpattern-getselection) — Collection multiple et range dégénérée au caret.
- [Microsoft SendInput](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendinput) — Compteur inséré, UIPI, état clavier.

## Limites et invariants à conserver

- Linux; cargo et rustc absents; aucune installation. Aucun test Rust, navigateur, Windows/UIA/SendInput/clipboard/COM exécuté. Aucun verdict reproduit.
- Contre-review ciblée des 17 IDs, pas nouvel audit des 35 branches ni certification production. Fonctions impliquées, chemins appelants/gardes et contrats lus; pas couverture exhaustive ligne par ligne de lib.rs.
- Scénarios éditeurs, providers silencieux, writer autonome et partial SendInput conditionnels; fréquence/gravité runtime non mesurées. Aucun secret ni donnée utilisateur lu.
- Commentaires/tests peuvent attester une intention technique sans déroger au contrat supérieur. Persistance des erreurs du verre et politique provider silencieux exigent arbitrage explicite.
- Aucune modification produit, HEAD, branches, config, mémoire ou skills. Seuls rapports privés créés.

- Double control_copy existe et refuse copie différente; préflight foreground/console/elevated/password préservé.
- Livraisons uniques claim_delivery et worker natif existants; fermeture visuelle d’urgence déjà indépendante.
- Owner/sequence sous OpenClipboard après notre paste; allocations préalables; snapshot multiformat existe.
- Save validate + remplacement par tmp; KEYED et CSP locale; unit tests existants et CI Windows.
