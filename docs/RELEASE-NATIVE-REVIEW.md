# Revue native de publication 0.1.5

> Document historique (revue native 0.1.5, 9 septembre 2026) : ne décrit plus l’état actuel. État actuel : [README.md](../README.md) et [docs/BRIDGE.md](../docs/BRIDGE.md).

Revue bornée du 9 septembre 2026 sur la capture réelle Windows et le cycle de vie de l’overlay. Aucun test d’inférence, lancement d’interface ou arrêt de processus n’a été effectué pendant cette passe.

## Correctifs appliqués

- **Champ protégé** : une cible UIA marquée comme mot de passe, ou dont l’état protégé ne peut pas être vérifié, arrête maintenant la capture avec une erreur en français. Le presse-papiers n’est plus proposé dans ce contexte ambigu.
- **Identité de la fenêtre source** : le handle de premier plan est figé avant la lecture UIA ou du presse-papiers, réutilisé pour l’ancrage et la cible de remplacement, puis vérifié avant d’accepter la capture. Un changement de fenêtre pendant la lecture refuse la capture au lieu d’associer le texte à une autre application.
- **Erreur du raccourci visible** : une capture lancée par le raccourci qui échoue conserve le diagnostic dans l’infobulle de la zone de notification et affiche une boîte d’avertissement native. Une capture ultérieure réussie remet l’infobulle normale. L’échec d’enregistrement du raccourci au démarrage continue d’ouvrir les réglages sans boîte modale pendant l’initialisation.
- **Focus obsolète** : `focus_overlay` vérifie qu’une capture visible existe et qu’aucune fermeture n’est en cours avant d’afficher ou d’activer la fenêtre. Un clic ou IPC tardif ne peut plus rouvrir une surface vide après fermeture.
- **Glisser sans verrou natif** : la compensation Tauri/Win32 et le démarrage du glisser s’exécutent hors du mutex d’état. L’état est revalidé ensuite avec l’identifiant de capture afin qu’une fermeture concurrente annule proprement l’action.
- **Client UI Automation borné** : le surveillant d’invalidation réutilise maintenant un client UIA par thread. Il ne répète plus l’initialisation COM environ toutes les 420 ms pendant toute la durée d’affichage.

## Comportements conservés et vérifiés par lecture

- Le mode installé normal utilise la capture et l’inférence réelles. Les réponses simulées nécessitent explicitement `--demo*` ou `--simulate-inference`.
- Une absence de sélection UIA produit une capture de source `clipboard` (copie synthétique Ctrl+Insert, ou copie de l’utilisateur de moins de 3 s), sans remplacement ni ancre ; elle est traduite aussitôt (décision du 14/09/2026).
- Une sélection UIA dépassant la limite est refusée avant tout accès au presse-papiers.
- Une nouvelle capture annule la requête active, invalide la fermeture précédente par génération et empêche son accusé ou son délai de masquer la nouvelle capture.
- Échap annule immédiatement la requête, marque la surface non visible et garde un délai natif de fermeture borné à 300 ms.
- Le remplacement reste limité aux contrôles Win32 `Edit` et `RichEdit` dont le document, la sélection UTF-16, la fenêtre et l’identité UIA sont tous revalidés. Aucun collage n’est utilisé ; le seul `SendInput` du produit est la corde de copie de la capture (Ctrl+Insert), jamais une écriture.
- Le surveillant invalide l’ancre et le remplacement après déplacement de la fenêtre source, changement de premier plan, changement de sélection ou changement de rectangle UIA.

## Validation exécutée

Commande :

```powershell
$env:CARGO_TARGET_DIR='C:\Users\Lucas\projects\flowtranslate-worktrees\native\src-tauri\target'
cargo test
```

Résultat : 20 tests réussis, 0 échec. Cela couvre notamment l’annulation obsolète, l’accusé de fermeture obsolète, la géométrie, les trames SSE et le remplacement Unicode isolé d’un contrôle Win32 `Edit`.

`cargo fmt -- --check` ne constitue pas un contrôle exploitable sur cette branche : il signale le format historique de plusieurs fichiers entiers, y compris `placement.rs` hors du périmètre de cette passe. `git diff --check` ne signale aucune erreur d’espace dans les changements.

## Matrice manuelle encore requise

- Raccourci global depuis Bloc-notes, Edge et Chrome : texte capturé, fenêtre source cohérente, focus préservé et erreur visible en cas d’échec.
- Champ mot de passe et propriété UIA protégée indisponible : aucune prévisualisation du presse-papiers.
- Application élevée ou UIA indisponible : repli presse-papiers uniquement avec confirmation explicite, sans remplacement.
- Sélection supérieure à 6 000 unités UIA et presse-papiers supérieur à 6 000 caractères : refus lisible, aucun envoi.
- Fermeture rapide, double Échap, nouveau raccourci pendant les 300 ms de sortie et clic tardif de capsule : aucune réouverture ni fenêtre masquée par un délai obsolète.
- Défilement, déplacement de fenêtre, changement de sélection et changement d’application : ancre perdue et remplacement désactivé.
- Remplacement réel : seulement Bloc-notes et contrôles `Edit`/`RichEdit` identifiés. Word, Outlook, Teams et les champs Chromium doivent rester en copie tant qu’un chemin natif spécifique n’est pas validé.
- Apparence, glisser, découpe, transparence, clic traversant, DPI 100/125/150/200 % et focus natif restent non validés ici, car les outils de session renvoient des captures noires et refusent `GetCursorPos`.
- L’inférence réelle reste à mesurer après libération d’un GPU. Une compilation et des tests unitaires ne valident ni le serveur ni la qualité de traduction.

Le manifeste observé porte encore la version `0.1.4`; son passage à `0.1.5` appartient à l’intégration de publication et n’a pas été modifié dans ce lot natif.
