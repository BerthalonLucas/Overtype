# Installation, exploitation et retour arrière

## Client Windows 11

Le paquet NSIS est publié dans les releases GitHub par `.github/workflows/release.yml`
(tag `v<version>` ou lancement manuel du workflow « Release » avec ce tag), avec son
SHA-256 dans `SHA256SUMS.txt`. Il se construit aussi localement par
`npm run tauri -- build --bundles nsis` dans `src-tauri/target/release/bundle/nsis/`.
Installation par utilisateur, sans droits administrateur. Un certificat de signature d’entreprise n’est pas
fourni dans ce dépôt ; distribuer le paquet par le canal interne approuvé.

Lorsqu’un installateur est lancé depuis une application Windows empaquetée,
`%LOCALAPPDATA%` peut être redirigé dans son espace privé. Sur le poste de
développement, passer `/D=C:\Users\Lucas\Apps\Overtype` en dernier argument
NSIS évite cette ambiguïté. Utiliser ensuite le chemin réellement installé dans
les commandes de lancement ; ne pas déduire sa visibilité depuis le seul shell Codex.

Prérequis de développement : Node.js 24, Rust stable, outils de compilation
MSVC et Windows SDK, Microsoft Edge WebView2 Runtime. Les dépendances sont
verrouillées dans `package-lock.json` et `src-tauri/Cargo.lock`.

```powershell
npm ci
npm run build
cargo test --locked --manifest-path src-tauri/Cargo.toml
npm run tauri -- build --bundles nsis
```

Au repos, chercher Overtype dans la zone de notification. Configurer la
langue cible et les deux connexions dans Réglages → Connexion avancée
([ENDPOINTS.md](ENDPOINTS.md) pour un moteur autre que le serveur livré). Le
raccourci initial est `Ctrl+Alt+T` : la traduction démarre sur la sélection, ou sur
la copie que Overtype fait lui-même quand la sélection n’est pas lisible. La bulle
s’efface d’elle-même au temps de lecture ; `Échap` ferme ou annule.

## Serveur

Voir [server/README.md](../server/README.md) pour le précontrôle matériel, les
profils et les commandes reproductibles. Les ports de développement sont
8001 (Rapide) et 8002 (Qualité), avec la base API `/v1`. Les modèles exposés
sont `flowtranslate-fast` et `flowtranslate-quality`.

Ne pas exposer les ports Docker directement au réseau de l’entreprise : la
configuration livrée écoute exclusivement sur loopback. Pour une installation
partagée, placer le serveur derrière la terminaison HTTPS et le contrôle
d’accès de l’entreprise. Le client refuse HTTP hors loopback. Les secrets
appartiennent à la configuration du déploiement, jamais au dépôt Git.

## Revenir à la version précédente

1. Conserver l’installateur précédent, son SHA-256, le commit du client et le
   fichier `server/model-lock.json` correspondant avant une mise à jour.
2. Quitter Overtype depuis la zone de notification. Sauvegarder son
   dossier de données utilisateur avant de changer de version ; les données
   protégées par DPAPI ne sont pas portables vers un autre compte Windows.
3. Réinstaller le paquet précédent. Ne pas effacer les données utilisateur
   pour effectuer un simple retour arrière. Si leur schéma a changé, restaurer
   la sauvegarde correspondante après avoir conservé une copie de la version
   la plus récente.
4. Sur le serveur, arrêter uniquement les services Overtype concernés,
   remettre la configuration du commit précédent, puis recréer ces services.
   Conserver le volume de cache des modèles. Ne pas utiliser de nettoyage
   global Docker ni supprimer les volumes pour revenir en arrière.
5. Vérifier `/v1/models`, une traduction FR→EN et une EN→FR, puis les actions
   Copier et Annuler. Consigner la version rétablie et le résultat.

## Limites de validation

[VALIDATION.md](VALIDATION.md) distingue les tests exécutés des essais encore
à réaliser. La présence d’un installateur ne vaut pas validation de toutes
les applications Office/Teams, ni mesure de qualité des modèles.
