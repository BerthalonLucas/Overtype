# Installation, exploitation et retour arrière

## Client Windows 11

Le paquet NSIS est publié dans les releases GitHub par `.github/workflows/release.yml`,
avec son SHA-256 dans `SHA256SUMS.txt` et `latest.json` pour la mise à jour intégrée. Le
workflow part sur un push dans `main` qui modifie `package.json` (la version, qui doit égaler
celle de `src-tauri/tauri.conf.json`), sur un tag `v<version>`, ou à la main avec ce tag ; il
lance `npm test`, `npm run build` et `cargo test`, puis construit l’installateur signé (secret
`TAURI_SIGNING_PRIVATE_KEY`, sans lequel aucune release n’est faite) et crée le tag et la
release. Une version déjà publiée n’est jamais réécrite. Il se construit aussi localement par
`npm run tauri -- build --bundles nsis` dans `src-tauri/target/release/bundle/nsis/`.
Installation par utilisateur, sans droits administrateur. La signature est celle de la mise à
jour Tauri (minisign), pas un certificat Authenticode d’entreprise ; distribuer le paquet par le
canal interne approuvé. Une fois installée, l’app se met à jour seule depuis la 0.6.2.

Lorsqu’un installateur est lancé depuis une application Windows empaquetée,
`%LOCALAPPDATA%` peut être redirigé dans son espace privé. Sur le poste de
développement, passer `/D=C:\Users\Lucas\Apps\Overtype` en dernier argument
NSIS évite cette ambiguïté. Utiliser ensuite le chemin réellement installé dans
les commandes de lancement.

Prérequis de développement : Node.js 24, la toolchain Rust de `rust-toolchain.toml`, outils de compilation
MSVC et Windows SDK, Microsoft Edge WebView2 Runtime. Les dépendances sont
verrouillées dans `package-lock.json` et `src-tauri/Cargo.lock`.

```powershell
npm ci
npm run build
cargo test --locked --manifest-path src-tauri/Cargo.toml
npm run tauri -- build --bundles nsis
```

Au premier lancement, l’accueil règle l’apparence, le raccourci et le serveur ; ensuite,
chercher Overtype dans la zone de notification. Les serveurs se règlent dans Réglages →
Serveur ([ENDPOINTS.md](ENDPOINTS.md) pour un serveur autre que celui livré). Le raccourci
initial est `Ctrl+Alt+Espace` : l’Îlot s’ouvre à côté de la sélection (ou de la copie
qu’Overtype fait lui-même quand la sélection n’est pas lisible), l’action choisie remplace le
texte ; `Échap` ferme ou annule. La langue est dans la consigne de chaque action, il n’y a pas
de réglage de langue cible.

## Serveur

Voir [server/README.md](../server/README.md) pour le précontrôle matériel, les
profils et les commandes reproductibles. Les profils de `server/compose.yaml`
écoutent sur `127.0.0.1` : `fast` (port 8001, modèle `flowtranslate-fast`), `quality`
(8002, `flowtranslate-quality`) et `general` (8003, `flowtranslate-general`, Gemma 4, le seul
qui corrige et reformule). Dans Overtype, l’adresse se tape avec ou sans `/v1`.

Ne pas exposer les ports Docker directement au réseau de l’entreprise : la
configuration livrée écoute exclusivement sur loopback. Pour une installation
partagée, placer le serveur derrière la terminaison HTTPS et le contrôle
d’accès de l’entreprise. Le client accepte HTTP vers une autre machine mais l’affiche « Connexion non chiffrée » :
préférer HTTPS dès que le texte quitte la machine. Les secrets
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
5. Vérifier `/v1/models` (Réglages → Serveur), une traduction FR→EN et une EN→FR, puis
   Annuler après un remplacement. Consigner la version rétablie et le résultat.

## Limites de validation

[VALIDATION.md](VALIDATION.md) distingue les tests exécutés des essais encore
à réaliser. La présence d’un installateur ne vaut pas validation de toutes
les applications Office/Teams, ni mesure de qualité des modèles.
