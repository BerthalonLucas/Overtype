> **Pièce spécialisée initiale.** Les verdicts, regroupements et sévérités finaux sont dans [FINDINGS.md](FINDINGS.md) et [la synthèse](SYNTHESE.md). Ne pas additionner les totaux des spécialistes. Les chemins `preuves-locales/` et `artefacts-locaux/` désignent des preuves privées non jointes intégralement ; voir [VERIFICATION.md](VERIFICATION.md).

# Audit SECURITY / PRIVACY — Overtype

Base figée: `origin/main` `e202cd1f8831abc0f69435b9e2d0d96dd491e841`. Audit uniquement, sans modification du dépôt.

## Synthèse

Un défaut de suppression est reproduit: `secure_delete` est perdu à chaque nouvelle connexion SQLite. Les protections DPAPI/consentement/absence de logs de contenu sont réelles mais ne garantissent pas disparition des pages supprimées. Autres résultats: réponses inférence non bornées, isolation des commandes custom incomplète, chaîne release à refs Actions mutables, documentation HTTPS devenue fausse. Un risque supplémentaire concerne uniquement la récupération de la branche WIP `wt-050-natif`. **Aucune RCE, fuite de secret réel, incident actif ou faille P0/P1 démontrés.**

Constats: 6 (5 P2, 1 P3). La sévérité qualifie le scénario décrit, pas un scanner. Les risques conditionnels ne sont pas des exploits déjà obtenus.

## Constats

### SEC-01 — Effacement SQLite: secure_delete ne couvre pas les connexions qui suppriment (P2, bug)
- **Source:** `origin/main` `e202cd1f8831abc0f69435b9e2d0d96dd491e841` — `src-tauri/src/history.rs` lignes 27, 28, 48, 49, 66, 76, 113, 125.
- **Préconditions:** Historique précédemment activé, entrée supprimée/purgée, accès aux fichiers de la base.
- **Menace plausible:** Récupération forensique d’une donnée que l’utilisateur pense avoir supprimée, par un opérateur autorisé au compte ou une sauvegarde conservant les pages.
- **Chemin / preuve:** new() règle secure_delete=ON sur sa connexion; connection() rouvre ensuite sans ce PRAGMA. libsqlite3-sys 0.35.0 bundled ne définit pas SQLITE_SECURE_DELETE. Repro avec son amalgamation 3.50.2, SHA du crate vérifié: connexion initiale=1, réouverture=0, COUNT(*)=0 après DELETE mais marqueurs du payload synthétique et du nom d’action présents dans le fichier. Contrôle ON à chaque connexion: marqueurs absents.
- **Impact et nuance:** Suppression et rétention sont logiques, pas effacement des restes sur disque. Payload reste chiffré DPAPI, mais récupérable par le même utilisateur Windows; métadonnées action/server/date en clair. Pas une fuite de texte clair prouvée ni une garantie d’effacement SSD.
- **Alternative établie:** Initialiser secure_delete sur chaque Connection dans connection(); tester après close/reopen les suppressions et prune. Définir politique de checkpoint WAL/TRUNCATE pour purge complète, traiter busy explicitement; ne pas promettre effacement des backups/SSD.
- **Coût / compromis:** Faible: rusqlite/SQLite déjà présents; un peu plus d’I/O et coordination pour checkpoint.
- **Confiance:** high. **Limite:** Amalgamation exacte et options bundled compilées sur Linux; SQL du cycle réel reproduit, pas le Rust ni DPAPI Windows. Fixture ciphertext artificiel, aucune donnée utilisateur.

### SEC-02 — Inférence: taille de réponse et durée totale non bornées (P2, risque)
- **Source:** `origin/main` `e202cd1f8831abc0f69435b9e2d0d96dd491e841` — `src-tauri/src/inference.rs` lignes 23, 24, 145, 166, 199, 210, 245, 262, 273, 296.
- **Préconditions:** Utilisateur lance une action vers un endpoint configuré compromis, malveillant ou bogué; pas de serveur accessible arbitrairement depuis Internet vers l’app.
- **Menace plausible:** Le service auquel l’app accorde confiance envoie des octets sans séparateur ou une génération infinie; TLS ne protège pas d’un serveur authentifié hostile.
- **Chemin / preuve:** SseDecoder.buffer.extend_from_slice sans plafond; ThinkFilter garde tout un bloc non fermé; result.push_str accumule sans limite; réponse d’erreur .text().await non bornée. Limits ne borne que connect/idle, request_body n’a pas max_tokens. À l’inverse probe.rs borne les corps à 2 MiB. Watchdog lib.rs 2008–2047 expire le silence, réinitialisé par les deltas (1452–1458).
- **Impact et nuance:** Serveur sélectionné malveillant/défaillant peut épuiser mémoire native, CPU et WebView avec un gros événement/erreur ou des deltas continus. Disponibilité locale, pas RCE.
- **Alternative établie:** Réutiliser logique bounded_body de probe pour refus HTTP; plafond par événement SSE, thinking et texte total avant append; limites adaptées à MAX_CHARS=200000, délai global configurable et cancellation pendant lecture d’erreur. max_tokens est complément, jamais défense contre serveur hostile.
- **Coût / compromis:** Modéré, aucune dépendance nouvelle; compromis avec réponses légitimes longues.
- **Confiance:** high. **Limite:** Chemin statique confirmé; OOM/DoS non déclenché, suite Rust non exécutée (cargo absent).

### SEC-03 — Les commandes sensibles custom ne suivent pas toutes l’isolation par fenêtre (P2, risque)
- **Source:** `origin/main` `e202cd1f8831abc0f69435b9e2d0d96dd491e841` — `src-tauri/src/lib.rs` lignes 584, 595, 664, 671, 2725, 2726, 2841, 2847, 3390, 3436.
- **Préconditions:** Exécution de JavaScript non autorisé dans une fenêtre BUNDLED (overlay/halo/demo) déjà compromise; une page distante ordinaire n’a pas ce droit.
- **Menace plausible:** Extension du rayon d’impact d’un bug frontend futur au journal privé et à la configuration réseau, malgré l’intention déclarée KEYED.
- **Chemin / preuve:** get_settings filtre les clés hors settings/setup; probe_connection, diagnostics et try_model contrôlent connection_window. save_settings, get_history/delete_history et install_update (update.rs 109–123) ne reçoivent pas/contrôlent la fenêtre. build.rs appelle tauri_build::build() sans AppManifest::commands. Tauri documente que les commandes invoke_handler sont accessibles à toutes fenêtres par défaut; capabilities/default.json ne restreint donc pas ces commandes applicatives.
- **Impact et nuance:** Si une fenêtre locale peu privilégiée est compromise, elle peut lire l’historique déchiffré, modifier endpoint+historique+autostart et déclencher un update signé en attente. save_settings permet de changer la destination des prochaines sélections sans lire la clé existante. Aucune compromission frontend ni XSS depuis sortie modèle démontrée; ce n’est pas une RCE.
- **Alternative établie:** Appliquer côté Rust les mêmes gardes de labels à save_settings, history et updater, ou AppManifest::commands + permissions par fenêtre; garder les commandes d’usage overlay séparées. Tests de refus avec vraies fenêtres/labels Tauri.
- **Coût / compromis:** Faible à modéré; primitives Tauri déjà présentes. Ne pas ajouter shell/fs ni casser actions overlay légitimes.
- **Confiance:** high. **Limite:** Absence de garde et contrat Tauri vérifiés; IPC natif non exercé. CSP restrictive et rendu React texte sont des contre-exemples utiles, aucune entrée XSS prouvée.

### SEC-04 — La documentation assure encore un refus HTTP distant qui n’existe plus (P3, dette)
- **Source:** `origin/main` `e202cd1f8831abc0f69435b9e2d0d96dd491e841` — `docs/ENDPOINTS.md` lignes 27, 29, 104, 108.
- **Préconditions:** Endpoint distant HTTP choisi/configuré et trafic sur réseau observé.
- **Menace plausible:** Interception réseau du texte et de la clé sous une garantie documentaire erronée.
- **Chemin / preuve:** docs/ENDPOINTS.md et DEPLOYMENT.md:46 annoncent HTTPS obligatoire hors loopback. settings.rs 535–548 accepte HTTP distant avec insecure=true; commentaire explicite choix Lucas 30/09 et introduction 9418959. UI InsecureNotice + chip http présents. Exécution fonction frontend: http://192.0.2.10:8000 accepté insecure=true; 21 vecteurs valides et 9 invalides passés.
- **Impact et nuance:** Une personne appliquant le guide peut croire que l’app empêchera transport en clair. En HTTP distant, sélection et Authorization Bearer sont visibles à un observateur sur le trajet; ce support est intentionnel, pas un bypass TLS automatique.
- **Alternative établie:** Actualiser ENDPOINTS/DEPLOYMENT avec décision 0.6, avertissement clair, recommandation HTTPS hors loopback; distinguer certificat confiance Windows et chiffrement. Option organisationnelle HTTPS-only seulement si besoin explicite, pas retour forcé sur décision produit.
- **Coût / compromis:** Faible, correction documentaire; laisser fonctionnement LAN voulu.
- **Confiance:** high. **Limite:** Repro frontend de normalisation sans réseau; comportement Rust confirmé statiquement et test unitaire existant non exécuté.

### SEC-05 — Chaîne release à signature: Actions résolues par tags mutables (P2, risque)
- **Source:** `origin/main` `e202cd1f8831abc0f69435b9e2d0d96dd491e841` — `.github/workflows/release.yml` lignes 15, 16, 23, 42, 46, 47, 56, 63.
- **Préconditions:** Acteur capable de changer un tag/code d’Action utilisé, ou compte upstream compromis; une PR sans accès secrets ne suffit pas en elle-même.
- **Menace plausible:** Supply-chain au niveau job de release de confiance, donnant un artefact que les clients accepteront par signature.
- **Chemin / preuve:** checkout@v4, setup-node@v4, rust-toolchain@stable, rust-cache@v2 exécutés dans le même job avec contents:write; plus tard le job reçoit TAURI_SIGNING_PRIVATE_KEY et lance npm/tauri build. Le secret n’est pas passé aux premières étapes, mais elles peuvent modifier workspace/outils utilisés ensuite. npm ci et cargo --locked limitent versions, pas intégrité d’un Action retaggé.
- **Impact et nuance:** Compromission d’un upstream Action/résolution de tag peut modifier code ou outillage puis exfiltrer la clé de signature au build ou faire signer un installateur hostile. Aucune compromission observée. Signature updater ne protège pas d’une build autorisée compromise.
- **Alternative établie:** Épingler Actions aux SHA revus, updates automatisées proposées en PR; permissions par job/étape minimale, séparation build/sign/publication et environnement protégé de release selon politique produit. Conserver lockfiles et refus sans clé.
- **Coût / compromis:** Faible pour pinning; modéré pour séparation/environnement et friction d’approbation.
- **Confiance:** medium. **Limite:** Configuration repo examinée; protections GitHub/environnements/permissions réelles et secrets non consultés. Risque conditionnel, pas vulnérabilité exploitable prouvée.

### SEC-06 — Branche WIP: archives de récupération de l’historique hors purge (P2, risque)
- **Source:** `origin/wt-050-natif` `1fcdd21f0aadd5a36978e47e6530b9fe9f1c74bd` — `src-tauri/src/history.rs` lignes 29, 46.
- **Préconditions:** Exécution de cette branche WIP, historique auparavant activé, erreur d’initialisation et renommage effectivement possible.
- **Menace plausible:** Opérateur/backup du compte récupère données conservées hors politique annoncée après demande de suppression.
- **Chemin / preuve:** origin/wt-050-natif ajoute recover(): toute erreur de new() renomme history.sqlite3, -wal, -shm en history.illisible-<date>.sqlite3*, puis crée nouvelle base. get/list/delete/prune ne ciblent que history.sqlite3. Chemin relié à startup dans lib.rs. Pas dans main; commit 1fcdd21 est WIP interrompu.
- **Impact et nuance:** Après corruption/erreur d’ouverture, anciens textes DPAPI et métadonnées sont archivés indéfiniment et ne sont plus visés par 'vider historique' ni la rétention 7 jours/100. Ne pas fusionner la récupération sans politique d’archives. Pas fuite de données actuelles affirmée.
- **Alternative établie:** Avant reprise de branche, enregistrer/montrer les archives de récupération, appliquer plafond/rétention et purge explicite sur ces fichiers; distinguer corruption des erreurs d’accès/verrouillage avant renommage. Garder fail-soft sans supprimer silencieusement les données.
- **Coût / compromis:** Modéré: helper fichiers/rusqlite existants; balance récupération vs confidentialité.
- **Confiance:** high. **Limite:** Revue diff et git show seulement. Branche non déployée selon mission; aucune corruption ni archivage provoqué, pas une régression main.

## Garanties vérifiées et bons usages à conserver

- CSP release restrictive: scripts self, connect limité IPC, pas unsafe-eval ni scripts inline; aucun remote capability, shell/fs/http plugin frontend exposé. Ne pas confondre unsafe-inline CSS avec RCE.
- Clés DPAPI par utilisateur (pas LOCAL_MACHINE), erreurs fail-closed hors Windows, aucune crypto custom. Clés uniquement rendues aux fenêtres settings/setup; événements settings-changed filtrés pour autres fenêtres.
- Historique false par défaut, gate au moment du commit sous verrou et !demo; consentement actuel, pas seulement valeur snapshot. Désactiver arrête nouvelles écritures mais ne vide pas les anciennes (bouton distinct), conforme UI.
- Source et traduction séparées system/user sans tools LLM. Rendu React texte pour résultats et historique, pas de HTML modèle identifié; pas de chemin prompt-injection vers shell démontré.
- Capture refuse password et statut indéterminé; limites sélection, revalidation source/texte/cible et clipboard sequence. États replay/undo restent mémoire; ne pas présenter history off comme absence totale de rétention RAM.
- Client HTTP unique sans redirects, TLS natif Schannel/Windows vérifié sans danger_accept_invalid_certs. Local loopback bypass proxy; HTTPS implicite distant; HTTP explicite averti, volontaire.
- Sonde bounded_body 2 MiB, tests fixtures locaux existants; sonde/diagnostics only KEYED, no_key empêche envoi bearer. UI tient ancienne clé quand origine modifiée, correction intégrée 13397c3.
- Diagnostics 500 entrées RAM et rotation 1 MiB x2, URL sans credentials/query/fragment, redaction clés connues et masque 4 derniers caractères; corps erreurs modèle non loggés. Métadonnées host/path/model/date/proxy restent lisibles localement, pas anonymisées.
- Serveur compose ports publiés 127.0.0.1, image digest et modèles révisions figées, request logging et usage telemetry désactivés. Pas de TLS/auth propre sur ports internes: déploiement partagé exige reverse proxy et contrôles extérieurs.
- Updater utilise plugin 2.12.0, endpoint GitHub HTTPS, clé publique embarquée et download_and_install vérifie signature; install explicitement demandé, checks seuls automatiques. Release refuse sans private key/.sig, --verify-tag, pas de remplacement release existante. Signature minisign ≠ certificat Authenticode; absence ce dernier documentée.

## Frontières / SSRF / flux de données

Le frontend local appelle des commandes Rust; les permissions de plugins ne restreignent pas automatiquement le handler applicatif. Pas de capacité remote ni accès shell arbitraire trouvé. Une URL HTTP(S) volontairement configurée peut cibler LAN/loopback: c’est la fonction d’un client de modèles, pas à elle seule une SSRF exploitable. Pour affirmer SSRF il faudrait un acteur non autorisé capable d’imposer cette URL ou d’appeler le pont; le seul scénario prouvé statiquement ici est la frontière locale compromise de SEC-03. Redirections refusées; le DNS n’est pas un filtre anti-SSRF, ni une adresse localhost une authentification du service. Aucun service distant exploité.

HTTP distant est supporté volontairement et averti; il transmet source et bearer en clair. HTTPS valide la chaîne Windows sans pinning custom; le proxy/autorité d’entreprise peut légitimement voir le contenu. Une garantie de confidentialité du serveur tiers ou son absence de rétention ne se déduit pas du client. Les checks automatiques GitHub constituent un flux réseau de mise à jour (pas analytics); seuls install/update demandés installent.

| Donnée | Destination / stockage | Protection / effacement |
|---|---|---|
| Sélection + résultat | RAM overlay/capture/replay/undo; service choisi; SQLite si opt-in | system/user séparés, DPAPI du payload local; tiers hors contrôle; SEC-01 pour résidus |
| Clé | RAM settings/setup; settings.json et temporaire/backup de migration | DPAPI utilisateur, sans fallback clair; no_key supprime clé courante; ancien backup non purgé automatiquement |
| Métadonnées | action/server/date historique; URL host/path/model/proxy diagnostics | Pas chiffrées ni anonymisées; journal taille/count bornés, bouton clear best-effort |

DPAPI protège au repos contre la copie brute pour un autre compte, pas contre un processus du même compte, une session déverrouillée ou une compromission système. Ne pas remplacer ce bon choix par AES maison ni stocker une clé AES à côté du fichier. Désactivation historique ≠ suppression des entrées précédentes; distinction visible dans la page Données. Rétention est appliquée lors new/add/list et maintenance périodique; app arrêtée, purge reprend au prochain lancement. Aucune conformité GDPR générale revendiquée.

## Branches — couverture et équivalence

Inventaire Git vérifié en code: **35 refs**, **17 ancêtres de main**, **18 non-ancêtres**. Tous les SHAs/méthodes/fichiers touchés sont dans security.json. Le diff trois-points identifie ce qu’une branche introduisait depuis sa base, pas ce qui manque actuellement dans main.

- `fix-endpoint-tls`: passage à Schannel (`25c465d`) intégré; aucune option ignore-certificate.
- `refonte-reglages` / 0.6 main: diagnostics, DPAPI et probes intégrés; ancienne politique HTTPS-only remplacée explicitement (`9418959`).
- `13397c3` main: clé de sonde retenue à changement scheme/host/port; contrôle manuel autorise adresse montrée. Protection UI, pas autorisation backend des futures traductions.
- `c311844` main: updater minisign / release fail-closed intégré.
- `release/native-0.1.5`: refus password/état inconnu + revalidation foreground maintenant visibles dans main; pas correctif sécurité oublié à réappliquer aveuglément.
- `codex/multi-editor-replacement`: revue des hunks capture/clipboard/delivery; snapshot/formats, identité et documents vérifiés, protections équivalentes reprises et modifiées dans main. Identité des patches non revendiquée pour toute la branche.
- `release/server-0.1.5`: flags ajoutés déjà présents dans compose main.
- `wt-050-natif`: WIP non intégré; copy_history a garde settings-only, récupération settings fail-soft; archives historique hors purge = SEC-06. Ne pas fusionner le WIP en bloc pour importer seulement la résilience.
- Autres branches non-ancêtres: différences frontend/fenêtre/placement ou aucun diff sécurité ciblé; pas nouveau problème réseau/DPAPI/release identifié dans ces hunks. Ni exhaustivité fonctionnelle de ces branches ni inutilité totale affirmées.

### Matrice des refs

| Branche | SHA | Statut / conclusion ciblée |
|---|---|---|
| `origin/chore/ui-iteration-workbench` | `afec21d4d9faec4856cb106832ab0543444b8876` | Ancêtre main: contenu/histoire intégré; pas branche candidate de correctif séparé. |
| `origin/claude/great-keller-6dwrqd` | `488eae22a879f19d51bac38c40479e2c0d18d765` | Ancêtre main: contenu/histoire intégré; pas branche candidate de correctif séparé. |
| `origin/codex/multi-editor-replacement` | `86b3b23f217b4e26976815fca253397012a6cd4b` | Clipboard snapshot, revalidation et document proof; protections équivalentes reprises/évoluées dans main; pas preuve d’un chantier sécurité manquant par commits non-ancêtres. |
| `origin/da-ilot` | `26aaa399c12337ebd64b50c7b9e1ac022b6b449f` | Ancêtre main: contenu/histoire intégré; pas branche candidate de correctif séparé. |
| `origin/design/glass-reader` | `7d67ab5c34ad78d5a6be8a4f20815f0848f076d3` | Ancêtre main: contenu/histoire intégré; pas branche candidate de correctif séparé. |
| `origin/feat/0.5.0-design-1.0` | `3ea09e6c2a2047b5c40133482dd0e151ee01db40` | Aucun changement propre aux fichiers security ciblés, ou changements fenêtre/placement sans chemin réseau/stockage sensible supplémentaire identifié. |
| `origin/feat/actions-shortcuts-settings` | `3f2aee15710d31118a1b2e885f23d3866e11dff3` | Ancêtre main: contenu/histoire intégré; pas branche candidate de correctif séparé. |
| `origin/feat/actions-that-work` | `e8df897a3b11dd285cc6e3b3d32eb07c9078a495` | Ancêtre main: contenu/histoire intégré; pas branche candidate de correctif séparé. |
| `origin/feat/direct-capture` | `74aefa69027d48441d3428493a9ce4a8fab03385` | Ancêtre main: contenu/histoire intégré; pas branche candidate de correctif séparé. |
| `origin/feat/frontend` | `d4681e439123f0b91e64734d14e8c67391eb5f85` | Ancêtre main: contenu/histoire intégré; pas branche candidate de correctif séparé. |
| `origin/feat/frontend-primitives` | `b9d6eb42e8d1f8692bacc4bdce07ec0e525fd23b` | Aucun changement propre aux fichiers security ciblés, ou changements fenêtre/placement sans chemin réseau/stockage sensible supplémentaire identifié. |
| `origin/feat/glass-frontend` | `170f96f7e26da3c0b6a15909764a9da6c251d41a` | Aucun changement propre aux fichiers security ciblés, ou changements fenêtre/placement sans chemin réseau/stockage sensible supplémentaire identifié. |
| `origin/feat/glass-material` | `058d348979239a401f619abfec09a75630a92ef5` | Aucun changement propre aux fichiers security ciblés, ou changements fenêtre/placement sans chemin réseau/stockage sensible supplémentaire identifié. |
| `origin/feat/glass-native` | `f742599122bbeb5df9b542ca02457192ef0bd832` | Aucun changement propre aux fichiers security ciblés, ou changements fenêtre/placement sans chemin réseau/stockage sensible supplémentaire identifié. |
| `origin/feat/glass-native-polish` | `02b1fe8d47f0322e3f580369b5de386a1f984828` | Aucun changement propre aux fichiers security ciblés, ou changements fenêtre/placement sans chemin réseau/stockage sensible supplémentaire identifié. |
| `origin/feat/glass-reader` | `5005b026de73de235ea140f2dd1d8eb3f766e09e` | Ancêtre main: contenu/histoire intégré; pas branche candidate de correctif séparé. |
| `origin/feat/native` | `0dc02bbf1bbdfcb2ebfedbfe121c48bacdc4d9ca` | Ancêtre main: contenu/histoire intégré; pas branche candidate de correctif séparé. |
| `origin/feat/reading-band` | `a1d903190e8c65abfd502b1435fffb0a730c16a2` | Ancêtre main: contenu/histoire intégré; pas branche candidate de correctif séparé. |
| `origin/feat/release-and-endpoints` | `83ebebb91f6c0d4c8a55556dff06c55e54c644cd` | Ancêtre main: contenu/histoire intégré; pas branche candidate de correctif séparé. |
| `origin/fix-endpoint-tls` | `dd4b218be9b432b734853e841179ac9762318ec5` | Ancêtre main: contenu/histoire intégré; pas branche candidate de correctif séparé. |
| `origin/fix/compact-draggable-bubble` | `99a019d3a77eaf4ee15de354e09990e51d4a6bb5` | Ancêtre main: contenu/histoire intégré; pas branche candidate de correctif séparé. |
| `origin/fix/native-window` | `28e2f0eac7a2a9bb662bdbe4b3716ad362ecff01` | Aucun changement propre aux fichiers security ciblés, ou changements fenêtre/placement sans chemin réseau/stockage sensible supplémentaire identifié. |
| `origin/fix/scoped-drag` | `fcb5c0196468258f62c11bf6f96d730e04cb8bc8` | Aucun changement propre aux fichiers security ciblés, ou changements fenêtre/placement sans chemin réseau/stockage sensible supplémentaire identifié. |
| `origin/main` | `e202cd1f8831abc0f69435b9e2d0d96dd491e841` | Ancêtre main: contenu/histoire intégré; pas branche candidate de correctif séparé. |
| `origin/refonte-reglages` | `deb9f0d581e256a8f00e0fd65be6d6e89234ae50` | Ancêtre main: contenu/histoire intégré; pas branche candidate de correctif séparé. |
| `origin/release/0.1.5` | `2f83abc75f19a68c28eea6ee408265592bd08347` | Ancêtre main: contenu/histoire intégré; pas branche candidate de correctif séparé. |
| `origin/release/frontend-0.1.5` | `127fb7fb70b7c0cd830379855bfd7339597ed91e` | Aucun changement propre aux fichiers security ciblés, ou changements fenêtre/placement sans chemin réseau/stockage sensible supplémentaire identifié. |
| `origin/release/guide-0.1.5` | `81f850333e7884b4497a6dd147ae00d1d409d54a` | Aucun changement propre aux fichiers security ciblés, ou changements fenêtre/placement sans chemin réseau/stockage sensible supplémentaire identifié. |
| `origin/release/native-0.1.5` | `efe3abd5c9d73f9a748880e75a55cb4f9096d27b` | Protection password fail-closed et foreground désormais présentes dans main: ne pas compter comme correctif manquant. |
| `origin/release/server-0.1.5` | `8281476d4bcac7d74305532d26bd3cf2cf46c8da` | Flags no-enable-flashinfer-autotune déjà dans main; ni régression confidentialité ni correction manquante. |
| `origin/wt-050-atelier` | `5b5f6a56962f59202d2ea127daf52cedf0439ba5` | Aucun changement propre aux fichiers security ciblés, ou changements fenêtre/placement sans chemin réseau/stockage sensible supplémentaire identifié. |
| `origin/wt-050-marque` | `1e2c6097d66573e20e2a002b3d8ada1ceb1abcd8` | Aucun changement propre aux fichiers security ciblés, ou changements fenêtre/placement sans chemin réseau/stockage sensible supplémentaire identifié. |
| `origin/wt-050-natif` | `1fcdd21f0aadd5a36978e47e6530b9fe9f1c74bd` | WIP recovery/quarantine hors main; copy_history gardé settings-only; HTTPS-only ancien, remplacé intentionnellement en 0.6; pas fusion intégrale recommandée. |
| `origin/wt-050-reglages` | `5da6010e2af1516c29bb1ff0e0281ef8f8778b6b` | Aucun changement propre aux fichiers security ciblés, ou changements fenêtre/placement sans chemin réseau/stockage sensible supplémentaire identifié. |
| `origin/wt-050-verre` | `c5345af95ec9fa6ac00cdea1444aba09cd4ba375` | Aucun changement propre aux fichiers security ciblés, ou changements fenêtre/placement sans chemin réseau/stockage sensible supplémentaire identifié. |

## Checks effectivement exécutés

- Git refs, ancestry, diffs merge-base ciblés, git show et log -S pour intention/équivalence; aucune modification HEAD.
- Crate libsqlite3-sys 0.35.0 récupéré depuis registry public, SHA-256 égal au Cargo.lock; inspection build.rs puis compilation locale C de SQLite 3.50.2 avec options bundled. Pas de script Cargo/package exécuté.
- `python repro_sqlite.py`, exit 0: secure_delete réouvert=0, suppression logique=0 ligne mais marqueurs présents; contrôle réglage par connexion efface les deux marqueurs. Log: `security-sqlite.log`.
- `node check_endpoints.mjs`, exit 0 après correction du harness: **21 valides, 9 invalides**, aucune requête réseau; credentials/file refusés, query/fragment retirés, HTTPS implicite distant et HTTP distant averti. Log final: `security-endpoints-final.log`. Le premier échec est conservé dans `security-endpoints.log` et n’est pas attribué au produit.
- Cargo absent: aucun test natif Rust exécuté, aucune exploitation DoS/OOM, aucun appel aux endpoints personnels. Le SQL exercé et la normalisation frontend ne sont pas présentés comme test Windows.

## Couverture / limites

**Fiches Agency utilisées:** Privacy Engineer (minimisation, carte flux/stockage, consentement au sink, suppression réelle) et AI-Generated Code Security Auditor (chemin concret, menaces explicites, pas de biais IA/scanner ni secrets imprimés). Skill code-review chargé; axes standards/intention appliqués au périmètre délégué, sans nouvelle délégation ni tracker/publication.

**Fichiers examinés** (certains sections pertinentes seulement): `AGENTS.md`, `docs/UI-DECISIONS.md`, `docs/ENDPOINTS.md`, `docs/DEPLOYMENT.md`, `src-tauri/build.rs`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/tauri.conf.json`, `src-tauri/tauri.updater.conf.json`, `src-tauri/capabilities/default.json`, `src-tauri/capabilities/settings.json`, `src-tauri/src/crypto.rs`, `src-tauri/src/history.rs`, `src-tauri/src/diagnostics.rs`, `src-tauri/src/inference.rs`, `src-tauri/src/probe.rs`, `src-tauri/src/settings.rs`, `src-tauri/src/types.rs`, `src-tauri/src/lib.rs`, `src-tauri/src/update.rs`, `src-tauri/src/capture.rs`, `src-tauri/src/host.rs`, `src/bridge.mock.ts`, `src/connection/Check.tsx`, `src/connection/ConnectionForm.tsx`, `src/connection/endpoint.ts`, `src/settings/pages/Server.tsx`, `src/settings/pages/Data.tsx`, `src/settings/useSettingsStore.ts`, `server/compose.yaml`, `.github/workflows/release.yml`, `package.json`.

- Linux, cargo absent: aucun cargo test ni Tauri/WebView2/Schannel/DPAPI/NSIS réel exécuté; pas de garantie des ACL utilisateur ni effacement natif Windows.
- Aucun secret/.env/store utilisateur lu. Aucun endpoint modèle réel, service GPU, poids ou serveur distant testé. Réseau limité aux docs officielles et au crate exact public.
- Couverture ciblée des chemins security/privacy et des diffs de toutes refs; pas lecture ligne par ligne des 471 fichiers. Les prototypes, suites e2e Windows, registry/autostart et clipboard avancé ne sont pas audités exhaustivement.
- Aucune recherche d’advisory exhaustive ni affirmation version ancienne=vulnérable. Protections GitHub/branche, politique des tiers inférence, isolation Docker et configuration du proxy hors dépôt inconnues.
- Repro SQLite exécute vraie amalgamation, schéma et séquence SQL, non DPAPI ni Rust; marqueurs exclusivement synthétiques. Check endpoints exécute fonction frontend copiée (seul import ./types→./types.ts adapté), pas parité Rust prouvée.
- Premier harness endpoints échoué parce que vectors valides n’incluent pas ok:true; corrigé dans scratch et repassé. Première collecte branches dépassait limite 50 appels; recommencée en subprocess Git local, inventaire complet vérifié.
- Demande audit-only: pas de correctif, commit, push, issue, publication, changement skills/config ni repo partagé.

## Sources officielles

- https://v2.tauri.app/security/capabilities/ — Commandes custom accessibles par défaut; AppManifest et scopes; consulté pendant audit.
- https://v2.tauri.app/security/permissions/ — Permissions distinctes des commandes applicatives.
- https://v2.tauri.app/plugin/updater/ — Signature obligatoire et TLS; documentation actuelle, version réellement résolue 2.12.0 dans lock.
- https://learn.microsoft.com/en-us/windows/win32/api/dpapi/nf-dpapi-cryptprotectdata — Protection liée utilisateur et exceptions roaming; intégrité MAC.
- https://www.sqlite.org/pragma.html#pragma_secure_delete — Effacement pages ordinaires et compile-time default; réglage non global entre connexions indépendantes.
- https://static.crates.io/crates/libsqlite3-sys/libsqlite3-sys-0.35.0.crate — Crate exact SHA-256 vérifié au Cargo.lock; build.rs et amalgamation 3.50.2 examinés/compilés.
