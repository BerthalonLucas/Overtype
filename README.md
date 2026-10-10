# Overtype 0.6.2

Assistant d’écriture pour Windows 11 (ex-FlowTranslate, renommé en 0.6.0). On sélectionne un
texte dans n’importe quelle application, on presse `Ctrl+Alt+Espace` : l’**Îlot**, un petit menu
d’actions, s’ouvre à côté de la sélection (Corriger, Traduire, Pro, Raccourcir, E-mail, ou une
consigne libre). Le texte est remplacé sur place, puis une coche, un bouton Annuler et les mots
changés surlignés s’affichent un moment.

Client **Tauri 2 + React + Rust**. Le modèle de langue tourne ailleurs : le serveur vLLM livré
dans `server/`, ou tout serveur compatible OpenAI, local ou distant. Nouveautés de chaque version :
[docs/RELEASE-NOTES.md](docs/RELEASE-NOTES.md).

## Installer

1. Prendre `Overtype_<version>_x64-setup.exe` dans les
   [releases GitHub](https://github.com/BerthalonLucas/Overtype/releases/latest) ; son SHA-256
   est dans `SHA256SUMS.txt`. L’installateur est signé (clé de mise à jour Tauri). Installation par
   utilisateur, sans droits administrateur ; WebView2 Runtime requis (présent sur Windows 11).
2. Au premier lancement, l’accueil pose quelques questions (apparence, raccourci, modèle), propose
   une démo animée, puis l’app ne laisse qu’une icône dans la zone de notification. Réglages →
   Général → « Revoir l’accueil » le relance.
3. Mises à jour intégrées depuis la 0.6.2 : vérification au démarrage puis toutes les six heures,
   ou à la demande dans Réglages → Général ; l’installation se fait en mode passif et relance l’app.

Une installation par-dessus FlowTranslate garde réglages, clés et historique, et retire l’ancienne
application.

## Serveurs

Réglages → Serveur (ou l’accueil). Un serveur, c’est une **adresse**, une **clé API** (ou « pas
de clé ») et un **modèle** choisi dans la liste que renvoie `GET /v1/models`.

- 1 à 8 serveurs enregistrés, dont un par défaut (l’interface en montre deux au plus).
- L’adresse se tape avec ou sans `/v1` (ou même `/v1/chat/completions`) : le suffixe est retiré et
  l’adresse stockée sans lui. Sans schéma, une adresse locale prend `http://`, une autre `https://`.
- `http://` est accepté partout ; vers une autre machine, l’interface avertit « Connexion non
  chiffrée ». HTTPS reste recommandé dès que le texte quitte la machine.
- Les clés sont chiffrées par Windows DPAPI, non portables vers un autre compte.
- « Vérifier » déroule 4 étapes (adresse, connexion, clé, modèles) : détail dans
  [docs/ENDPOINTS.md](docs/ENDPOINTS.md).

Serveur livré : [server/README.md](server/README.md) (profils fast, quality et general ; le profil
general, Gemma 4 sur `127.0.0.1:8003`, est celui qui corrige et reformule).

## Réglages

Pages : **Général** (démarrage, langue, accueil, mises à jour, réinitialisation), **Raccourcis**,
**Actions** (grille du menu, consignes), **Après remplacement** (coche, Annuler, mots changés),
**Apparence** (thème, indicateur, mouvements), **Serveur**, **Données** (historique).
Une page **Diagnostic** cachée (`Ctrl+Maj+M`, ou cinq clics sur la version) montre le journal des
connexions.

## Confidentialité

- Le texte sélectionné ne part qu’au serveur choisi.
- Aucun texte, résultat ni contenu du presse-papiers dans les journaux ; d’une clé, le journal de
  diagnostic garde au plus les 4 derniers caractères.
- Historique facultatif (désactivé au départ), chiffré DPAPI, 7 jours et 100 entrées au plus.

## Développer

Prérequis : Node.js 24, la toolchain Rust figée par `rust-toolchain.toml`, outils MSVC et
Windows SDK, WebView2 Runtime. Dépendances verrouillées (`package-lock.json`,
`src-tauri/Cargo.lock`).

```powershell
npm ci
npm run dev               # aperçu navigateur (réponses simulées) sur http://127.0.0.1:5173
npm run tauri -- dev      # l’app réelle
npm test                  # Vitest
npm run lint              # Biome
npm run typecheck:test    # types des tests
npx playwright install chromium --only-shell
npx playwright test
cargo fmt --check --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked -- -D warnings
cargo test --locked --manifest-path src-tauri/Cargo.toml
npm run tauri -- build --bundles nsis
```

Modes sans moteur : `Overtype.exe --demo-selection`, `--demo-clipboard`, `--demo-long` ;
`--simulate-inference` garde la capture réelle et simule la réponse ; `--settings` ouvre les
Réglages.

## Publier

1. Changer la version dans `package.json`, `src-tauri/Cargo.toml` et `src-tauri/tauri.conf.json`,
   et ajouter sa note en tête de [docs/RELEASE-NOTES.md](docs/RELEASE-NOTES.md).
2. Fusionner dans `main` : `.github/workflows/release.yml` part sur un changement de
   `package.json`, vérifie (tests, build, `cargo test`), construit l’installateur signé, crée le
   tag `v<version>` et la release avec `latest.json` pour la mise à jour intégrée.
3. Sinon : pousser un tag `v<version>`, ou lancer le workflow « Release » à la main avec ce tag.
   Une version déjà publiée n’est jamais réécrite.

## Documentation

- [docs/BRIDGE.md](docs/BRIDGE.md) : contrat React ↔ Rust (le contrat courant) ;
  [docs/SPEC.md](docs/SPEC.md) : invariants ; [docs/native.md](docs/native.md),
  [docs/frontend.md](docs/frontend.md) : couche Windows et fenêtres.
- [docs/ENDPOINTS.md](docs/ENDPOINTS.md) : brancher un serveur, requête exacte ;
  [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) : installation, exploitation, retour arrière ;
  [server/README.md](server/README.md) : serveur vLLM livré.
- [docs/UI-DECISIONS.md](docs/UI-DECISIONS.md), [docs/UI-ISSUES.md](docs/UI-ISSUES.md) :
  décisions de Lucas et défauts suivis ; [design-lab/README.md](design-lab/README.md) : labo de
  référence (figé).
- Historique (plans exécutés, essais, recettes) : [docs/PLAN-0.6.md](docs/PLAN-0.6.md),
  [docs/DA-PLAN.md](docs/DA-PLAN.md) et les documents marqués « Document historique ».
