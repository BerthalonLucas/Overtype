> **Pièce spécialisée initiale.** Les verdicts, regroupements et sévérités finaux sont dans [FINDINGS.md](FINDINGS.md) et [la synthèse](SYNTHESE.md). Ne pas additionner les totaux des spécialistes. Les chemins `preuves-locales/` et `artefacts-locaux/` désignent des preuves privées non jointes intégralement ; voir [VERIFICATION.md](VERIFICATION.md).

# Overtype — audit NATIVE

## Synthèse

Baseline : `main` **e202cd1f8831abc0f69435b9e2d0d96dd491e841**, client 0.6.2 déclaré. Audit du 2026-10-10T03:34:08+02:00.
**12 constats : 6 P1 et 6 P2**, bugs et risques distingués ci-dessous; aucune compilation/exécution Windows revendiquée.

Les priorités sont la preuve de sélection avant écriture (UIA fail-open et copie sans sélection), la provenance du presse-papiers, puis le protocole de fermeture/concurrence. Deux protections utiles sont encore dans des branches : nettoyage de copie partielle dans **PR6** et récupération settings/history dans **wt-050-natif**. Ce n’est pas une recommandation de merger ces branches anciennes.

Le code Win32 custom est largement justifié par le produit : maintenir une sélection d’une application tierce, une fenêtre non activante et des surfaces cliquables animées ne sont pas des fonctionnalités clés-en-main du plugin clipboard ou d’un effet Acrylic de fenêtre entière. Les ACL d’app Tauri et le dispatch hors thread UI, eux, sont à mieux employer.

Rapport privé d’audit uniquement : aucun patch, commit, checkout, installation système, service ou publication. Guides Agency lus réellement : Desktop App Engineer et Rust Refactoring Specialist, source `f99f6aa910a442b0197b768ce0ea7751e35e2060`; aucun plugin installé.

## Parcours concret et frontières

1. **Initialisation.** `run` configure single-instance/global-shortcut/autostart/updater; root app-data ou override isolé de test; settings chargés et langues migrées; SQLite initialise et prune même historique off; AppState géré avant création WebViews. Surfaces handles conservés une fois; tray, keyboard hook, hit tester et watchers context/overlay/thème/motion/update sont démarrés. `frontend_ready` rattache la page ou ferme une capture après rechargement. Les erreurs avant le tray et le panic settings sont les angles morts (008–009).
2. **Capture.** Hotkey → dispatch worker → `capture_with_binding` refuse panneaux visibles, garde Flight single-flight/anti-burst, fige action ou menu/settings, lit HWND source → `capture_current`. UIA `GetSelection` lit actuellement la première plage, IsPassword connu refuse; texte/rects/runtime_id/contrôle sont figés. Sinon Ctrl+Insert après relâchement des modificateurs, snapshot clipboard, séquence + settle/restoration; sinon copie Fresh âgée de moins de trois secondes et non marquée sensible. Fresh/replay/demo ne donnent pas droit de remplacement; Copy oui, ce qui ne prouve pas toujours une sélection (002). UIA/plage UTF-16 bornée à 200 000 unités, copy texte à 200 000 caractères : les anciens 6 000 du SPEC sont historiques, pas un bug automatique.
3. **Menu et réseau.** `choose_action` s’applique une fois au captureId; instruction bornée reste en Rust; le menu ferme son scope, retire l’activation et rend le focus après relâchement du chord. `translate` utilise l’exécution figée, cancellation token et événements requestId; stale streams et relaunch n’ont pas le droit de re-livrer. Réseau/provider détaillés hors rôle; aucun endpoint appelé dans cet audit.
4. **Livraison.** Inférence complète → completed/active=None → worker `schedule_auto_delivery` prend inner, claim unique, consomme cible → `capture::paste`. Foreground doit être source ou nos surfaces; réactivation contrôlée; validation avant/après touches, contrôle-copy pour Copy; texte temporaire/opt-outs → dernière validation → un Ctrl+V → readback/settle → restauration si notre ownership persiste. `confirmed` et `assumed` sont distincts. L’automatique émet applied/fallback; `replace_result` est une tentative manuelle/retry, pas une nouvelle inférence, et n’offre pas l’Undo natif de l’automatique (contrat intentionnel). La preuve contient trop de chemins permissifs (001–004,010).
5. **Undo.** Si `pasted::locate` retrouve le résultat au caret, l’Applied garde texte original/résultat/id/position côté Rust, frontend reçoit surtout rectangles et disponibilité. Hook/watcher retirent Undo après saisie/caret/scroll. `undo_result` prend le même lock, désarme la disponibilité avant essai, valide deux fois puis Ctrl+Z ou Select + repaste. Original confirmé localement/whole field; refus sans injection versus échec après injection distincts. Ce n’est pas une restauration globale aveugle; échecs runtime_id permissifs restent liés à 001.
6. **Fermeture.** Dismiss révoque et retire completed sous inner, génération/ack frontend + fallback 300 ms évitent un ack obsolète qui ferme une nouvelle capture. Watchdog indépendant utilise try_lock, hide_handle contourne thread UI; force-close masque d’abord puis attend inner pour close_now/reload. Une opération pré-injection bloquée n’a pas de latch indépendante : 006. Le lock protège la sérialisation mais ne constitue pas une annulation de l’effet natif.
7. **IPC.** `bridge.ts` est transport invoke/listen Tauri + mock browser explicite; événements ciblés à la Webview et unlisten retourné. Mock absent du trajet natif, pas une preuve Windows. GetSettings masque les clés hors KEYED; certains verbs connection/glass bornent déjà caller/entrée. Toutefois invoke_handler métier n’est pas automatiquement cloisonné par les JSON core capabilities (011). `overlay-ipc.ts` n’existe que dans une ancienne branche frontend, pas sur main.

## Constats détaillés

Les citations de lignes ci-dessous visent **main @e202cd1f8831abc0f69435b9e2d0d96dd491e841** sauf référence de branche explicitement nommée. « Scénario » décrit la séquence de code à tester, non un résultat Windows inventé. Gravité P1 = correction prioritaire avant élargissement du pilote; P2 = correction importante avec conditions précisées.
### NATIVE-001 — La revalidation UIA autorise une cible devenue invérifiable

- **P1 · bug** — `main @e202cd1f8831abc0f69435b9e2d0d96dd491e841` · `src-tauri/src/capture.rs:428–513`
- **Preuve :** validate_target retourne Ok si get_focused_element échoue (438); element_changed ne refuse un runtime_id différent que si un id a été obtenu (453–455); selection_changed ignore les erreurs hors NO_SELECTION (505–513). Le contrôle Win32 inconnu ne provoque pas non plus de refus (434). pasted::check laisse également passer une erreur get_runtime_id (pasted.rs:219–226).
- **Scénario / appel :** Sélection UIA capturée → inférence → même HWND, contrôle sans handle distinct → le fournisseur cesse de répondre après déplacement du caret/changement interne → schedule_auto_delivery → paste → validate_target Ok → Ctrl+V. Le watcher réutilise la même validation et ne révoque rien.
- **Impact :** Insertion ou remplacement dans un champ/une sélection non prouvés, contraire à AGENTS.md:10 et SPEC.md:23. L’erreur UIA transitoire n’est pas une preuve de stabilité.
- **Alternative établie :** Traiter Uia/Copy comme des niveaux de preuve explicites. Pour une cible Uia, échec d’identité ou de sélection = refus avant injection; éventuellement revérifier par copie avec provenance et preuve de sélection, sinon proposer Copier. Appliquer la même politique aux identités d’Undo.
- **Coût / compromis :** Moyen : certains fournisseurs fragiles seront moins souvent remplaçables. Garder capture/affichage/Copier pour ne pas supprimer la fonctionnalité.
- **Confiance / limite :** élevée (preuve statique; Windows non exécuté). Aucun test Windows exécuté ici.
- **Branche à comparer :** PR6 valide plus strictement identité, protection et document, sans justification pour rétablir son ancien schéma de cibles entier.

### NATIVE-002 — Deux copies identiques ne prouvent pas qu’une sélection existe

- **P1 · bug** — `main @e202cd1f8831abc0f69435b9e2d0d96dd491e841` · `src-tauri/src/capture.rs:202–212`
- **Preuve :** CaptureOrigin::Copy est toujours remplaçable hors console/password (206–212). clipboard_capture crée la cible à partir de la copie (336–384). control_copy/same_copy compare seulement le texte (471–487), pas l’existence d’une plage. Le commentaire 469 reconnaît que Monaco copie la ligne entière sans sélection.
- **Scénario / appel :** VS Code/Monaco, aucun texte sélectionné, caret sur une ligne → Ctrl+Insert copie cette ligne → capture Copy can_replace=true → contrôle copie la même ligne → égalité acceptée → Ctrl+V insère le résultat au caret au lieu de remplacer la sélection inexistante.
- **Impact :** Écriture automatique injustifiée et duplication de texte. Même phénomène si une vraie sélection de ligne complète a été perdue et le copier sans sélection rend la même ligne.
- **Alternative établie :** Sans plage lisible ni contrat fiable d’éditeur, conserver le résultat en lecture seule/Copier. Pour Win32 Edit/RichEdit, exploiter la plage réelle du contrôle; pour providers web, exiger une preuve UIA ou un adaptateur borné. Ne pas utiliser Ctrl+A ni SetValue sur tout le document.
- **Coût / compromis :** Moyen : baisse de couverture de remplacement sur Monaco sans API de sélection; c’est le coût honnête d’une garantie de sélection.
- **Confiance / limite :** élevée (preuve statique; Windows non exécuté). Aucun test Windows exécuté ici.
- **Branche à comparer :** PR6 demande document/plage unique et provider éditable; à adapter, pas à fusionner aveuglément.

### NATIVE-003 — Le changement global du presse-papiers est attribué à la copie de la source sans provenance

- **P1 · risque** — `main @e202cd1f8831abc0f69435b9e2d0d96dd491e841` · `src-tauri/src/clipboard_guard.rs:177–214`
- **Preuve :** take_copy accepte toute modification de séquence; settle_and_swap lit puis remplace sous OpenClipboard mais ne compare jamais le propriétaire à source_window. Son API ne reçoit pas la source. late_copy_is_ours (243–249) assimile absence d’input à provenance. Le contrôle des marques sensitive n’est appliqué qu’au repli Fresh (capture.rs:343), pas au texte de take_copy.
- **Scénario / appel :** Copie synthétique de A lente/inefficace → un gestionnaire ou autre processus B écrit du texte, éventuellement sensible, pendant l’attente sans changer le foreground → texte B accepté comme CaptureOrigin::Copy et ancien snapshot remis à sa place. Un writer autonome tardif peut aussi être écrasé par watch_late sans input utilisateur.
- **Impact :** Texte d’un autre producteur potentiellement envoyé au modèle et contenu nouveau perdu. Verrouiller OpenClipboard rend le swap atomique, pas son attribution correcte.
- **Alternative établie :** Transporter l’identité de la source dans la transaction; vérifier owner/process attendu et marques sensibles dans la même session de lecture. Avec broker/OLE non attribuable, refuser la capture remplaçable et surtout la restauration destructive. Garder la protection contre les nouveaux writers.
- **Coût / compromis :** Moyen : owners OLE/brokers imposent exceptions explicites, fixtures de copies multiséances et delayed rendering. GetClipboardOwner seul n’est pas universel.
- **Confiance / limite :** élevée pour absence de preuve; moyenne pour fréquence/exploitabilité Windows. Aucun test Windows exécuté ici.
- **Branche à comparer :** PR6 clipboard_guard::copied_text:62–81 vérifie PID source/propriétaire; main n’a pas conservé ce contrôle.

### NATIVE-004 — Le repli TextOnly détruit silencieusement les formats non conservables

- **P2 · bug** — `main @e202cd1f8831abc0f69435b9e2d0d96dd491e841` · `src-tauri/src/clipboard_guard.rs:123–155`
- **Preuve :** Snapshot refuse certains formats, un budget supérieur à 64 Mio, un format non lisible etc. (85–118). Keeper::take avale toute erreur et passe à TextOnly. formats ne rend que Unicode, voire None. Après EmptyClipboard et collage/copie, les formats originaux manquants ne reviennent pas. capture.rs ignore aussi restored dans Copied::Taken (416) et restore_ours (596,602,626).
- **Scénario / appel :** Presse-papiers image seule > budget, objet propriétaire/Office non duplicable, ou mélange texte+format propriétaire → raccourci/collage Overtype → Snapshot Err → TextOnly → transaction destructrice → restauration texte seul ou aucune restauration.
- **Impact :** Perte de l’image, des formats riches ou du contenu complet, non signalée. Le commentaire promettant la remise du presse-papiers (capture.rs:593–594) ne couvre pas ce cas.
- **Alternative établie :** Rendre la conservation faillible avant toute modification, ou demander un opt-in explicite pour dégradation. Reprendre le principe de refus sans perte de PR6. Retourner/diagnostiquer la restauration échouée avec raison non sensible; ne jamais restaurer par-dessus un writer plus récent.
- **Coût / compromis :** Faible à moyen : certaines copies/pastes refusées avec fallback Copier; un support OLE/format spécialisé complet coûterait nettement plus.
- **Confiance / limite :** élevée (preuve statique; Windows non exécuté). Aucun test Windows exécuté ici.
- **Branche à comparer :** PR6 Snapshot::capture est une précondition stricte de synthetic_copy/replace_paste; main l’a remplacée par un fallback permissif.

### NATIVE-005 — Des commandes synchrones peuvent bloquer le thread UI et son hook clavier

- **P1 · risque** — `main @e202cd1f8831abc0f69435b9e2d0d96dd491e841` · `src-tauri/src/lib.rs:989–991`
- **Preuve :** capture_text est #[tauri::command] fn, appelle directement capture_with_binding et UIA/attentes. get_settings (592–595), save_settings (664–671), frontend_ready (1316–1318), copy_result (1865–1872) attendent aussi le mutex depuis des commandes synchrones. install_keyboard_hook est appelé dans setup (3345), SetWindowsHookExW sur le thread appelant (host.rs:599–603). Les livraisons gardent inner pendant UIA (1603–1654).
- **Scénario / appel :** Invoke capture_text natif lent, ou livraison bloquée chez le provider puis invoke get_settings/copy_result/choix synchrone → attente mutex sur UI → pompe de messages suspendue → hook LL installé sur ce thread ne répond plus dans son budget.
- **Impact :** Gel du WebView/fenêtres; Microsoft prévoit le retrait silencieux du hook LL après timeout (plafond Windows récent : 1 s). Le watchdog masque la fenêtre par handle mais ne rend pas le thread UI.
- **Alternative établie :** Capture native sur worker MTA dédié/spawn_blocking; commandes lisant un état potentiellement verrouillé hors UI et section critique courte. Hook LL sur thread pompant dédié, callback atomiques/try_send uniquement (déjà bien appliqué dans le callback). Ne pas faire UIA sur le thread de fenêtre.
- **Coût / compromis :** Moyen : préserver les appels Tauri de fenêtres sur run_on_main_thread et éviter les inversions lock/UI. Le chemin raccourci ordinaire est déjà dispatché hors UI; ne pas confondre avec invoke capture_text.
- **Confiance / limite :** élevée (preuve statique; Windows non exécuté). Aucun test Windows exécuté ici.

### NATIVE-006 — La fermeture d’urgence ne révoque pas une livraison déjà entrée dans son verrou

- **P1 · bug** — `main @e202cd1f8831abc0f69435b9e2d0d96dd491e841` · `src-tauri/src/lib.rs:1962–1986`
- **Preuve :** force_close masque immédiatement mais close_now/cancel n’exécute qu’après inner.lock dans un thread séparé (1976–1981). schedule_auto_delivery garde inner pendant paste (1603–1621); replace_result fait pareil (1882–1892). capture::paste ne reçoit pas de token/génération annulable, y compris après les appels UIA et avant SendInput.
- **Scénario / appel :** Livraison a pris inner et attend un provider avant le chord → watchdog ou tray ferme la bulle → close_now attend le même lock → provider se débloque alors que la fenêtre/selection source est encore valable → l’ancien worker poursuit le collage derrière une bulle déjà fermée.
- **Impact :** Une action considérée annulée/fermée peut encore écrire tardivement. SPEC.md:19 demande closing cancels immediately. Une injection déjà envoyée n’est évidemment pas annulable; le problème ici est une injection non encore envoyée.
- **Alternative établie :** Latch d’annulation/génération indépendant du mutex, posé dès force_close/dismiss; recontrôler juste avant l’effet natif après chaque attente. Séparer snapshot, travail provider et commit avec génération, sans autoriser deux transactions concurrentes. En cas de provider indéfiniment pendu, isoler la tâche et ne pas attendre son lock pour une nouvelle session.
- **Coût / compromis :** Élevé pour refonte du protocole; faible/moyen pour latch. spawn_blocking et timeout Rust ne tuent pas un appel COM synchrone. Conserver la fermeture visuelle immédiate actuelle.
- **Confiance / limite :** élevée (preuve statique; Windows non exécuté). Aucun test Windows exécuté ici.

### NATIVE-007 — La copie ne libère pas les touches après SendInput partiel, contrairement au collage et à PR6

- **P2 · bug** — `main @e202cd1f8831abc0f69435b9e2d0d96dd491e841` · `src-tauri/src/host.rs:1202–1213`
- **Preuve :** Si 0 < sent < 4, send_copy_chord retourne Err sans key-up compensatoire. send_paste_chord/undo le font (1219–1255). origin/codex/multi-editor-replacement:host.rs:680–684 contient explicitement le nettoyage Ctrl/Insert absent de main.
- **Scénario / appel :** SendInput accepte Ctrl-down et éventuellement Insert-down mais pas les relâchements → capture échoue → Ctrl/Insert restent logiquement pressés jusqu’à une autre libération.
- **Impact :** Saisie ultérieure transformée en raccourcis, fausses collisions/état held. Une injection partielle est un cas documenté par le compteur retourné, pas une réussite binaire.
- **Alternative établie :** Extraire un helper de batch avec libération best-effort des touches réellement injectées et résultat sent. Adapter le petit correctif PR6, sans changement de protocole de remplacement.
- **Coût / compromis :** Faible : même pattern déjà dans paste/undo; fixture d’injection partielle nécessaire et Windows pour effet réel.
- **Confiance / limite :** élevée (preuve statique; Windows non exécuté). Aucun test Windows exécuté ici.
- **Branche à comparer :** PR6 head 86b3b23f217b4e26976815fca253397012a6cd4b, src-tauri/src/host.rs:680–684.

### NATIVE-008 — Une liste actions vide fait paniquer le démarrage avant validate

- **P1 · bug** — `main @e202cd1f8831abc0f69435b9e2d0d96dd491e841` · `src-tauri/src/settings.rs:201–209`
- **Preuve :** Un PersistedSettings valide avec actions:[] produit un Vec vide, puis default_action_id utilise actions[0]. validate vient seulement ligne 263. run appelle store.load()? en setup (lib.rs:3213); profil release panic=abort (Cargo.toml:80).
- **Scénario / appel :** Prendre un fichier de réglages synthétique valide, remplacer uniquement actions par [] → Store::load → index hors bornes avant garde de validation → processus release abort avant création du tray.
- **Impact :** Application impossible à ouvrir/réparer par son UI sur un état JSON partiellement invalide. C’est une preuve statique d’un panic, non un crash Windows exécuté ici.
- **Alternative établie :** first().ok_or(...) avant calcul du défaut puis récupération du chargement avec mise à l’écart non destructive et notice. Adapter la garde existante dans wt-050-natif (settings.rs:162–167) au schéma actuel 0.6.
- **Coût / compromis :** Faible pour garde; moyen pour récupération et tests DPAPI/migration. Ne pas restaurer les anciens profils fast/quality de la branche.
- **Confiance / limite :** élevée (preuve statique; Windows non exécuté). Aucun test Windows exécuté ici.
- **Branche à comparer :** wt-050-natif SHA 1fcdd21f0aadd5a36978e47e6530b9fe9f1c74bd contient garde et test empty actions; absents de main.

### NATIVE-009 — L’historique optionnel est une condition obligatoire de démarrage

- **P2 · bug** — `main @e202cd1f8831abc0f69435b9e2d0d96dd491e841` · `src-tauri/src/lib.rs:3234–3234`
- **Preuve :** HistoryStore::new(&root)? s’exécute quelle que soit history_enabled, avant AppState/tray. new ouvre SQLite, configure WAL/schema et prune, toute erreur remonte (history.rs:20–45). run finit sur .expect (3439).
- **Scénario / appel :** historyEnabled=false mais history.sqlite3 synthétique corrompu/incompatible/occupé en erreur → initialisation échoue → setup Tauri échoue → pas d’application utilisable ni de réglages pour désactiver/réparer.
- **Impact :** La panne d’une fonction désactivée bloque capture et traduction; un stockage optionnel devient point de défaillance global.
- **Alternative établie :** Chargement paresseux ou état HistoryUnavailable avec erreur locale et notice; récupération/backup explicite non destructive. Réutiliser rusqlite; adapter l’intention HistoryStore::recover de wt-050-natif, pas son rename best-effort base/WAL/SHM tel quel.
- **Coût / compromis :** Moyen : protéger la cohérence du trio SQLite/WAL/SHM et conserver les données avant création d’une base neuve. Les erreurs de history.add sont actuellement ignorées (1518), à rendre visibles sans exposer de texte.
- **Confiance / limite :** élevée (preuve statique; Windows non exécuté). Aucun test Windows exécuté ici.
- **Branche à comparer :** wt-050-natif history.rs:22–46 ajoute recover; main retourne à new obligatoire.

### NATIVE-010 — confirmed=true peut signaler un collage qui n’a rien changé

- **P2 · bug** — `main @e202cd1f8831abc0f69435b9e2d0d96dd491e841` · `src-tauri/src/capture.rs:527–530`
- **Preuve :** readback_confirms fait canonical(field).contains(canonical(value)). Dans paste, cette preuve sort immédiatement confirmed=true (609–611); unwritten n’est évalué qu’avec !confirmed (620). Aucune comparaison before/after ou plage n’est requise pour le flag.
- **Scénario / appel :** Document contient déjà le résultat ailleurs, sélection de texte différent dans une portion non écrivable/provider donnant un faux editable → Ctrl+V ignoré → le document inchangé contient toujours value → success confirmed=true, bypass de ReadOnly.
- **Impact :** Fausse coche « Sélection remplacée » et diagnostics read back alors que l’action n’a pas été appliquée. Ce n’est pas la politique assumed explicite; c’est une preuve positive incorrecte.
- **Alternative établie :** Comparer d’abord absence de changement (sauf original==result) puis vérifier le résultat dans la plage/caret attendus, ou patch du document borné quand provider fiable. Réutiliser pasted::locate comme preuve locale tout en gardant l’état « envoyé non confirmé » pour les champs illisibles.
- **Coût / compromis :** Moyen : certains providers déplacent le caret; distinguer confirmation positive, échec prouvé et absence de preuve. PR6 compare le document attendu mais sa contrainte whole-document ne doit pas devenir universelle.
- **Confiance / limite :** élevée (preuve statique; Windows non exécuté). Aucun test Windows exécuté ici.

### NATIVE-011 — Les capabilities ne cloisonnent pas les commandes métier entre WebViews

- **P2 · risque** — `main @e202cd1f8831abc0f69435b9e2d0d96dd491e841` · `src-tauri/build.rs:1–3`
- **Preuve :** build.rs ne déclare pas AppManifest::commands; capabilities/default.json couvre cinq labels mais seulement core permissions. Tauri documente que invoke_handler app est accessible à toutes les WebViews par défaut. save_settings ne prend pas de fenêtre appelante (lib.rs:665–671), contrairement à get_settings qui masque les clés selon label (593–595).
- **Scénario / appel :** Code exécuté dans halo/demo/overlay invoque save_settings/reset ou commandes d’historique plutôt que via le bridge normal → mêmes droits métier que settings; le masquage des clés en lecture n’empêche pas la modification ni une invocation directe.
- **Impact :** Surface de privilèges excessive si une page est compromise ou fait une erreur. Aucun XSS/RCE démontré; CSP script-src self et absence de remote IPC diminuent l’exposition et doivent rester.
- **Alternative établie :** Déclarer les commandes d’app dans AppManifest et leurs permissions par label; vérifier en Rust le caller pour les opérations sensibles. Utiliser les ACL Tauri existantes, pas un pseudo-RBAC TS. Tests de refus depuis halo/demo/overlay et autorisation depuis settings/setup.
- **Coût / compromis :** Moyen : inventaire et matrice des commandes. Le bridge typed et les events ciblés sont utiles mais ne remplacent pas une autorisation native.
- **Confiance / limite :** élevée sur le comportement ACL; exploitabilité non démontrée. Aucun test Windows exécuté ici.

### NATIVE-012 — La capture UIA ignore les plages supplémentaires d’une sélection multiple

- **P2 · risque** — `main @e202cd1f8831abc0f69435b9e2d0d96dd491e841` · `src-tauri/src/capture.rs:61–87`
- **Preuve :** selection prend get_selection().into_iter().next sans vérifier cardinalité (65–70). validate_target et pasted::caret font pareil. Microsoft précise une plage par sélection non contiguë. PR6:selection refuse ranges.len()!=1, mais son fallback doit également être examiné avant portage.
- **Scénario / appel :** Éditeur/provider expose deux plages non contiguës → seule la première devient le texte de l’action et la preuve d’identité → Ctrl+V peut être appliqué par l’éditeur à plusieurs carets/plages.
- **Impact :** Traitement incomplet ou remplacement de plusieurs plages par un résultat calculé pour une seule. Dépend du support multi-range et de la sémantique du provider; pas affirmé pour Word/Outlook sans test.
- **Alternative établie :** Refus explicite des sélections multiples avant toute copie/écriture ou contrat multi-range complet. Un refus de cardinalité ne doit pas se transformer en fallback Copy remplaçable. Conserver le texte en lecture seule uniquement si le produit le veut.
- **Coût / compromis :** Faible pour refus; élevé pour support réel multi-range et Undo.
- **Confiance / limite :** élevée pour première plage seulement; moyenne pour conséquences selon éditeur. Aucun test Windows exécuté ici.

## Usage idiomatique et réinvention — décisions explicites

| Surface | Déjà fourni / limite | Avis et compromis |
|---|---|---|
| IPC métier / permissions | invoke, Serde, AppManifest, ACL par label Tauri | Conserver bridge étroit; appliquer ACL officielles (011) plutôt que policy TS custom. Aucun besoin de dépendance supplémentaire. |
| Exécution bloquante | Tauri async, spawn_blocking, run_on_main_thread; Win32 loop dédiée | Workers paste/Undo déjà corrects sur l’axe STA/MTA; compléter capture invoke et lock/UI (005). Un runtime async ne préempte pas un provider COM suspendu (006). |
| Hotkeys/tray/autostart/single instance/updater | Plugins Tauri déjà présents | Pas de réinvention systématique sur main. wt-050-natif ajoute autostart/reconciliation registre pour recovery : ne pas copier un deuxième gestionnaire à côté du plugin sans besoin encore réel. |
| Drag settings et resize | startDragging/startResizeDragging Tauri | Déjà réutilisés. Pointer compensation/scoped drag overlay a des contraintes non activantes spécifiques; reprendre le vieux mouse hook global serait une régression, pas une simplification. |
| Clipboard simple | arboard déjà présent; plugin Tauri texte/image/HTML | Pas de bénéfice établi à ajouter le plugin pour remplacer arboard. Aucun des exemples officiels ne fournit snapshot multiformat, attribution à une fenêtre, delayed rendering, swap gardé et restauration transactionnelle complète. Garder transaction custom, corriger preuves/restitution (003–004). |
| Clipboard/COM FFI | crate windows 0.62.2 déjà présent et features DataExchange/Memory | Option de dette : remplacer extern bruts de clipboard_guard par signatures windows existantes, centraliser ownership/RAII. Gain de type/maintenance, pas garantie automatique de sélection; faible/moyen coût, pas nouveau crate. Ce n’est pas un finding urgent autonome. |
| Effets/blur | Tauri WebviewWindow::set_effects pour fenêtre; Windows Composition pour sous-surfaces | set_effects ne décrit pas la liste des formes DOM avec rayon/opacité/position animés sous le WebView. Backdrop custom est justifié; Windows 11 host brush, painted fallback, main-thread ownership sont pertinents. Ne pas réclamer un remplacement intégral par window-vibrancy à partir de la taille du fichier. |
| Hit-testing | Tauri ignore_cursor_events pour toute fenêtre; Win32 styles/regions pour trous et no-activate | Ignorer toute la fenêtre perdrait boutons/menu; rendre toute la fenêtre interactive volerait clics dans marges transparentes. Région dynamique/WS_EX_NOACTIVATE/subclassing répondent à une contrainte produit réelle. |
| Sélection/remplacement/Undo | UIA fournit ranges/select; Win32 Edit/RichEdit et SendInput, pas transaction multi-app universelle | Conserver APIs d’éditeur et validation ciblée; jamais Ctrl+A, SetValue whole-field ni DOM injecté dans l’application tierce. Aucun nouveau crate ne transforme une copie en preuve de sélection. |
| Stockage | rusqlite, DPAPI/serde et fichiers settings atomiques | Approche appropriée; recovery de données optionnelles/persistées est le vrai manque (008–009), pas besoin d’un framework base de données supplémentaire. |
| Modules | Tauri permet commandes en modules avec mêmes noms invoke | Option : extraire capture_session/delivery/lifecycle/window_commands de lib.rs après fixation du protocole. Justification = ownership/locks/protocoles distincts, pas le nombre de lignes seul. Préserver tests invariant et noms IPC. |

## PR6 — statut et salvage ciblé

API GitHub lue : **ouverte, non mergée**, titre « Étendre le remplacement aux champs web et éditeurs accessibles », head `codex/multi-editor-replacement @86b3b23f217b4e26976815fca253397012a6cd4b`, base rapportée `main @83d6e363d36caa88112683fa966b05251ca00fdc`. Comparaison audit `origin/main...origin/codex/multi-editor-replacement` depuis merge-base, pas retrait des changements ultérieurs de main.

Les neuf commits de PR6 ont `+` dans git cherry : pas d’équivalence de patch exacte sur main. **Ce n’est pas une preuve que ses fonctionnalités n’existent pas** : main 0.6 utilise déjà le collage natif/clipboard guard, origin Copy et vérifications, mais a changé ses contrats.

À garder/adopter : nettoyage Ctrl/Insert après injection partielle (007), conservation clipboard strictement faillible (004), provenance PID du writer (003), refus cardinalité sélection, preuve plus forte pour UIA incertain et tests desktop production path.

À ne pas fusionner tel quel : ancien schéma Win32Target/selection_start/document, ancienne limite 6 000, protocole d’exécution/version et contraintes document entier. La branche garde le résultat dans clipboard en cas de collage non confirmé volontairement (docs/native.md), tandis que main restaure après délai et admet assumed : **choix de politique distincts**, pas un bug universel de PR6. PR6 peut encore refuser providers sans Value/TextPattern/plage unique et ne règle pas toute la sélection multi-editor. Son refus multiple retombe via les chemins de capture : adapter un code d’erreur terminal plutôt qu’un simple texte d’erreur attrapé par le fallback.

Le driver `replacement_tests.rs` est `cfg(test)` avec test ignored opt-in, loopback éphémère et fixture synthetic. Il appelle capture/complete_target/remplacement réels. La documentation prévoit Edge visible, input/textarea/contenteditable/iframe/Shadow DOM, races, protection et clipboard multiformat. **Recette lue, pas exécutée; Office/Teams non prouvés compatibles.** Adapter et porter ces fixtures au nouveau paste, et ajouter les scénarios des constats, plutôt que supprimer cette couverture parce que la branche est ancienne.

## Limites Windows — garanties réalistes

- **SendInput n’adresse pas un HWND.** Le foreground est revérifié, puis les événements sont injectés dans la file globale. Batch serial évite mélange intra-batch; il ne rend pas atomique le couple validation du provider + effet sur l’éditeur. Un changement à la dernière frontière reste à tester. Le compteur confirme injection, jamais modification du document.
- **UIPI / intégrité.** Un processus normal ne peut pas injecter vers un élevé; SendInput/GetLastError ne prouvent pas spécifiquement UIPI. Garder détection d’intégrité/refus plutôt que recommander de lancer Overtype administrateur. Bureau sécurisé/UAC, fenêtres disparues et desktops distincts ne sont pas une compatibilité promise.
- **Focus.** SetForegroundWindow peut refuser même avec conditions réunies; ce n’est pas corrigeable par un sleep universel ou un force-focus agressif. Retour Copier/erreur et préservation des autres applications sont légitimes.
- **UIA dépend du fournisseur.** Pas de TextPattern ≠ pas de sélection; get_selection peut donner caret dégénéré ou plusieurs plages. IDs peuvent changer (LibreOffice), rectangles manquer/refluer, comptage UTF-16/codepoints/CRLF varier. La normalisation actuelle est limitée à la preuve après écriture et garde identité textuelle exacte avant : bon choix. L’échec du fournisseur ne prouve toutefois jamais l’identité (001).
- **Timeouts apparents.** 350 ms de copie, 800 ms de confirmation, 1 600 ms d’Undo/loops ne bornent pas un appel COM synchrone lui-même. Clipboard delayed rendering peut solliciter le producteur. Aucun « au maximum N ms » end-to-end ne peut être déduit des constantes seules. Isoler workers et états annulables, pas tuer arbitrairement un thread.
- **Presse-papiers partagé.** OLE/delayed formats, CF_BITMAP synthétisé depuis DIB, formats private/GDI non HGLOBAL simples; seuil 64 Mio et refus de duplication justifiés. Une baisse de fidélité doit être annoncée/refusée, pas cachée. Win+V/cloud opt-outs contrôlent le contenu mis par l’app, pas l’absence totale d’autres monitors sur la machine. L’âge Fresh et absence d’input ne prouvent pas provenance.
- **Undo.** Ctrl+Z agit sur la pile actuelle de l’éditeur; l’original localisé et l’interdiction après saisie sont indispensables mais modifications autonomes de l’éditeur/macros/rich-text demandent de vraies fixtures. Repaste est un nouveau geste éditorial plutôt qu’une annulation sémantique/rich-format universelle. Les garanties du produit sont texte, pas restauration mise en forme Office complète.
- **Multi-écrans / blur.** Physical pour Win32/UIA, logical pour DOM/Tauri, DPI et work area peuvent varier, coordonnées négatives légitimes. Composition host backdrop exige Win11 build 22000 et conditions transparency/remote/high contrast/energy appropriées; code prévoit painted. Ne pas généraliser aux targets Linux/macOS, au preview navigateur, ni mesurer perf/GPU à partir des seules sources.

## Matrice de couverture des branches

Toutes les 35 refs de l’inventaire sont classées ci-dessous. Une ligne « autre rôle » ne prétend pas audit frontend/serveur complet. Sept deltas Rust non-ancêtres sont revus; les icônes wt-050-marque sont inventoriées sans critique visuelle native.

| Branche | SHA | Couverture / évaluation |
|---|---|---|
| `chore/ui-iteration-workbench` | `afec21d4d9faec4856cb106832ab0543444b8876` | couvert via main, ancêtre |
| `claude/great-keller-6dwrqd` | `488eae22a879f19d51bac38c40479e2c0d18d765` | couvert via main, ancêtre |
| `codex/multi-editor-replacement` | `86b3b23f217b4e26976815fca253397012a6cd4b` | Deltas natifs approfondis; PR6 ouverte, pas fusionnée. Ancien parcours 0.4, garde stricte document/plage/clipboard, test desktop opt-in. Certaines intentions sont reprises/retravaillées sur main mais les protections 007/004/provenance restent à adapter. Ne pas merger l’ancienne architecture. |
| `da-ilot` | `26aaa399c12337ebd64b50c7b9e1ac022b6b449f` | couvert via main, ancêtre |
| `design/glass-reader` | `7d67ab5c34ad78d5a6be8a4f20815f0848f076d3` | couvert via main, ancêtre |
| `feat/actions-shortcuts-settings` | `3f2aee15710d31118a1b2e885f23d3866e11dff3` | couvert via main, ancêtre |
| `feat/actions-that-work` | `e8df897a3b11dd285cc6e3b3d32eb07c9078a495` | couvert via main, ancêtre |
| `feat/direct-capture` | `74aefa69027d48441d3428493a9ce4a8fab03385` | couvert via main, ancêtre |
| `feat/frontend` | `d4681e439123f0b91e64734d14e8c67391eb5f85` | couvert via main, ancêtre |
| `feat/frontend-primitives` | `b9d6eb42e8d1f8692bacc4bdce07ec0e525fd23b` | aucun delta Rust unique; autre rôle |
| `feat/glass-frontend` | `170f96f7e26da3c0b6a15909764a9da6c251d41a` | aucun delta Rust unique; autre rôle |
| `feat/glass-material` | `058d348979239a401f619abfec09a75630a92ef5` | aucun delta Rust unique; autre rôle |
| `feat/glass-native` | `f742599122bbeb5df9b542ca02457192ef0bd832` | Deltas natifs revus; deux commits patch-équivalents (- git cherry). placement main-thread, regions et dismiss génération réutilisés/étendus sur main. Pas un chantier natif absent. |
| `feat/glass-native-polish` | `02b1fe8d47f0322e3f580369b5de386a1f984828` | Delta host revu; commit patch-équivalent. SWP_FRAMECHANGED conditionnel, pas une raison de re-fusion. |
| `feat/glass-reader` | `5005b026de73de235ea140f2dd1d8eb3f766e09e` | couvert via main, ancêtre |
| `feat/native` | `0dc02bbf1bbdfcb2ebfedbfe121c48bacdc4d9ca` | couvert via main, ancêtre |
| `feat/reading-band` | `a1d903190e8c65abfd502b1435fffb0a730c16a2` | couvert via main, ancêtre |
| `feat/release-and-endpoints` | `83ebebb91f6c0d4c8a55556dff06c55e54c644cd` | couvert via main, ancêtre |
| `feat/0.5.0-design-1.0` | `3ea09e6c2a2047b5c40133482dd0e151ee01db40` | aucun delta Rust unique; autre rôle |
| `fix/compact-draggable-bubble` | `99a019d3a77eaf4ee15de354e09990e51d4a6bb5` | couvert via main, ancêtre |
| `fix/native-window` | `28e2f0eac7a2a9bb662bdbe4b3716ad362ecff01` | Deltas revus; un commit - et un +. Ancien mouse gesture global largement remplacé par pointer compensé/drag scopé; reprendre le hook global serait régressif. Diff statique seul ne justifie pas réintégration. |
| `fix/scoped-drag` | `fcb5c0196468258f62c11bf6f96d730e04cb8bc8` | Deltas revus; deux commits -. Compensation scoped plutôt que suivi global de tous les drags, focus chrome et corrections ultérieures déjà sur main. |
| `fix-endpoint-tls` | `dd4b218be9b432b734853e841179ac9762318ec5` | couvert via main, ancêtre |
| `main` | `e202cd1f8831abc0f69435b9e2d0d96dd491e841` | main approfondi |
| `refonte-reglages` | `deb9f0d581e256a8f00e0fd65be6d6e89234ae50` | couvert via main, ancêtre |
| `release/frontend-0.1.5` | `127fb7fb70b7c0cd830379855bfd7339597ed91e` | aucun delta Rust unique; autre rôle |
| `release/guide-0.1.5` | `81f850333e7884b4497a6dd147ae00d1d409d54a` | aucun delta Rust unique; autre rôle |
| `release/native-0.1.5` | `efe3abd5c9d73f9a748880e75a55cb4f9096d27b` | Delta revu; commit -. Capture source figée et cache client UIA présents sur main. MessageBox ancien remplacé par notice courte conforme décisions actuelles. |
| `release/server-0.1.5` | `8281476d4bcac7d74305532d26bd3cf2cf46c8da` | aucun delta Rust unique; autre rôle |
| `release/0.1.5` | `2f83abc75f19a68c28eea6ee408265592bd08347` | couvert via main, ancêtre |
| `wt-050-atelier` | `5b5f6a56962f59202d2ea127daf52cedf0439ba5` | aucun delta Rust unique; autre rôle |
| `wt-050-marque` | `1e2c6097d66573e20e2a002b3d8ada1ceb1abcd8` | Classée ressources natifs uniquement (icônes/tray), pas de delta Rust; qualité visuelle et intégration ressources hors revue native profonde. |
| `wt-050-natif` | `1fcdd21f0aadd5a36978e47e6530b9fe9f1c74bd` | Deltas revus, deux commits +. Récupération settings/history et garde actions vide à récupérer de manière ciblée (008/009). Ancien modèle profiles/engines et autostart registry custom incompatibles avec le schéma serveur/plugin actuel. |
| `wt-050-reglages` | `5da6010e2af1516c29bb1ff0e0281ef8f8778b6b` | aucun delta Rust unique; autre rôle |
| `wt-050-verre` | `c5345af95ec9fa6ac00cdea1444aba09cd4ba375` | Pas de delta Rust unique; overlay-ipc.ts lu : open_settings({target}) est ancien contrat à ne pas cherry-pick contre main field/page sans adaptation. |

## Fichiers examinés

`AGENTS.md`, `docs/UI-DECISIONS.md`, `docs/SPEC.md`, `docs/BRIDGE.md`, `src/bridge.ts`, `src-tauri/build.rs`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`, `src-tauri/capabilities/settings.json`, `src-tauri/src/lib.rs`, `src-tauri/src/capture.rs`, `src-tauri/src/clipboard_guard.rs`, `src-tauri/src/pasted.rs`, `src-tauri/src/host.rs`, `src-tauri/src/halo.rs`, `src-tauri/src/backdrop.rs`, `src-tauri/src/settings.rs`, `src-tauri/src/history.rs`, `PR6:src-tauri/src/replacement_tests.rs`, `PR6:docs/native.md`, `wt-050-verre:src/overlay-ipc.ts`.

Les deltas ajoutent la lecture des hunks placement/types/autostart/tray/inference, pas une revendication de revue intégrale de chacun.

## Bons usages à préserver

- Rust possède réseau/stockage/secrets, le frontend invoque des verbes métier; pas de shell/fs arbitraire identifié sur la surface examinée.
- Serde/camelCase, IDs de capture/requête, snapshot d’action/serveur et claim_delivery limitent stale streams, relaunch et doubles collages. Les unités tests présentes couvrent déjà de nombreuses transitions; elles ne sont pas exécutées ici.
- UIA est déjà déplacé vers spawn_blocking sur les chemins paste/Undo et clients thread-local; contexte watcher dédié. Éviter les getters Tauri sous le lock à l’aide de handles cachés est une correction importante à préserver.
- Le hook fait try_send et atomiques plutôt que le travail métier; injected input possède OUR_KEYS; callbacks lourds reçus sur workers. Le problème restant est son thread installateur.
- Presse-papiers : RAII Open/Memory, allocations avant EmptyClipboard, budget, owner window dédié pompant, checks de writers récents après put_text et opt-outs cloud/history; pas un simple copier-coller naïf.
- Capture Fresh, replay, demo non remplaçables, refus console, intégrité élevée et IsPassword connu; Ctrl+Insert au lieu de Ctrl+C évite SIGINT.
- Undo est disponible seulement si résultat localisé; contrôle de source/caret/texte, deux stratégies, compteur partiel différencie refus et échec. Pas de restauration aveugle du document entier.
- Tauri global-shortcut, autostart, single-instance, updater, tray/menu et APIs de drag réglages sont déjà réutilisés.
- CSP script self, connect-src WebView borné à IPC, events ciblés et API keys masquées hors settings/setup; chiffrement DPAPI et historique opt-in dans le contrat/code observé.
- Backdrop attaché au HWND plutôt qu’un service/fenêtre indépendante, formes limitées et finies, fallback painted sur incompatibilité Windows/erreur native.

## Vérifications réellement effectuées

- `git rev-parse HEAD origin/main; git status --porcelain` — exit 0; e202cd1f8831abc0f69435b9e2d0d96dd491e841 · e202cd1f8831abc0f69435b9e2d0d96dd491e841; log `preuves-locales/native-checks.log`.
- `if command -v cargo; then cargo --version; else printf 'cargo absent; compilation et tests Rust non exécutés\n'; fi; if command -v rustc; then rustc --version; else printf 'rustc absent\n'; fi` — exit 0; cargo absent; compilation et tests Rust non exécutés · rustc absent; log `preuves-locales/native-checks.log`.
- `gh api repos/BerthalonLucas/Overtype/pulls/6 --jq '{number,title,state,merged,base_ref:.base.ref,base_sha:.base.sha,head_ref:.head.ref,head_sha:.head.sha,merge_commit_sha}'` — exit 0; {"base_ref":"main","base_sha":"83d6e363d36caa88112683fa966b05251ca00fdc","head_ref":"codex/multi-editor-replacement","head_sha":"86b3b23f217b4e26976815fca253397012a6cd4b","merge_commit_sha":null,"merged":false,"number":6,"state":"open","title":"Étendre le remplacement aux champs web et éditeurs accessibles"}; log `preuves-locales/native-checks.log`.
- `date -Iseconds` — exit 0; 2026-10-10T03:34:08+02:00; log `preuves-locales/native-checks.log`.
- `git diff origin/main...origin/<branche> -- src-tauri; git cherry origin/main origin/<branche> (7 branches avec delta Rust)` — exit 0; Inventaire 35 refs; sept deltas de code natif; sorties cherry et stats persistées, aucun checkout.; log `preuves-locales/native-coverage-evidence.json`.

Pas de cargo test/clippy/build et pas de benchmark; pas de sortie de test Windows fabriquée. Les lectures git show/diff et sources documentent des parcours, pas la compatibilité Office.

## Limites de couverture

- Analyse statique et docs officielles; ni compilation Rust, cargo test, clippy, ni exécution Windows/UIA/SendInput/WebView2. Cargo et rustc absents, aucune installation système.
- Aucun modèle, service GPU, endpoint utilisateur, appli réelle, DB utilisateur ou secret lu/exécuté. Les scénarios de findings sont propositions de fixtures, pas des repros Windows déclarés réussis.
- Couverture approfondie des parcours et sept deltas Rust uniques, pas une revue exhaustive ligne par ligne de tous les modules; variantes de bridge frontend historiques seulement classées pour frontière de rôle.
- Le pilote desktop PR6 a été lu mais pas exécuté : cfg(test), test ignored opt-in, loopback driver; Office/Teams non couverts par sa recette.
- Crypto/update/probe sont considérés à leur interface; audit cryptographique, packaging/signature/installer et serveur confiés aux autres rôles. Pas de conclusion sur versions/advisories résolues Cargo.lock.
- Branches ancêtres couvertes par main sans relecture intégrale de leur passé. git cherry négatif prouve équivalence de patch, pas identité de fichier courant; git cherry positif ne prouve pas fonctionnalité manquante.
- Les archives native-diff anciennes peuvent contenir des marqueurs de troncature sur les gros dumps; les points clés wt-050 et PR6 ont été revérifiés directement avec git show, et coverage-evidence est obtenu du Git réel.
- src/overlay-ipc.ts n’existe pas sur main; fichier retrouvé et lu dans wt-050-verre. Pas de finding de fichier manquant sur main.

## Sources officielles consultées

- [Tauri 2 — Capabilities et app commands](https://v2.tauri.app/security/capabilities/) — Commandes app autorisées par défaut; AppManifest, permissions par label.
- [Tauri 2 — Calling Rust](https://v2.tauri.app/develop/calling-rust/) — Commandes sync sur main thread, async dispatch, types Serde, modules de commandes.
- [Tauri 2.11.5 WebviewWindow](https://docs.rs/tauri/2.11.5/tauri/webview/struct.WebviewWindow.html) — run_on_main_thread, set_effects, start_dragging et ignore_cursor_events déjà offerts.
- [Tauri Clipboard plugin](https://v2.tauri.app/plugin/clipboard/) — Texte/image/HTML et permissions; pas de transaction exhaustive de sélection.
- [Microsoft SendInput](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendinput) — Compteur partiel, UIPI, touches déjà actives, injection ne vaut pas application.
- [Microsoft SetForegroundWindow](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setforegroundwindow) — Foreground non garanti même si conditions réunies.
- [Microsoft UIA threading](https://learn.microsoft.com/en-us/windows/win32/winauto/uiauto-threading) — Thread séparé MTA sans fenêtre; risque UI thread, lifetime COM.
- [Microsoft LowLevelKeyboardProc](https://learn.microsoft.com/en-us/windows/win32/winmsg/lowlevelkeyboardproc) — Thread installateur/pompe, timeout/retrait silencieux; thread dédié recommandé.
- [Microsoft Clipboard Formats](https://learn.microsoft.com/en-us/windows/win32/dataxchg/clipboard-formats) — Formats multiples, données owner-managed, conversions et opt-outs histoire/cloud.
- [Microsoft GetClipboardOwner](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getclipboardowner) — Propriétaire dernier écrivain; données possibles sans owner.
- [Microsoft GetSelection](https://learn.microsoft.com/en-us/windows/win32/api/uiautomationclient/nf-uiautomationclient-iuiautomationtextpattern-getselection) — Plage dégénérée sans sélection; collection multiple pour sélections disjointes.
- [GitHub PR6 (API authentifiée, lecture seule)](https://github.com/BerthalonLucas/Overtype/pull/6) — Open, non mergée; head codex/multi-editor-replacement @86b3b23f217b4e26976815fca253397012a6cd4b; base main @83d6e363d36caa88112683fa966b05251ca00fdc.

## Lots de correction suggérés, sans implémentation

1. Preuve de sélection/provenance et clipboard (001–004,010,012), avec fixtures qui garantissent aucune écriture après refus.
2. Dispatch/thread hook/lock et annulation pré-effet (005–006), avec provider suspendu puis libéré après fermeture.
3. Petits salvages isolés : copy partial de PR6 (007), settings/history récupérables adaptés de wt-050-natif (008–009).
4. Matrice ACL app/callers (011). Aucun nouveau crate requis pour ces quatre lots.
