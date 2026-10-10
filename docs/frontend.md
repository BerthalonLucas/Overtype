# Frontend Overtype

`src/` contient le client React partagé par les fenêtres Tauri, choisies par le paramètre `?window=` (`src/App.tsx`) : `overlay` (l’Îlot, la pilule, la bulle), `halo` (la mise en valeur sur les lignes de la sélection, `src/halo/`), `settings` (les Réglages), `setup` (l’accueil du premier lancement, `src/setup/`) et `demo` (la démo animée de l’accueil, une fenêtre `setup` ouverte sur `?window=setup&stage=demo`). `overlay`, `halo` et `settings` sont déclarées dans `src-tauri/tauri.conf.json` ; `setup` et `demo` sont créées par Rust à la demande. Il ne contacte jamais un modèle directement : chaque effet passe par `src/bridge.ts`, qui applique les noms et formes de `docs/BRIDGE.md`.

En dehors de Tauri, `npm run dev` affiche un bureau de démonstration clairement identifié. Son adaptateur est en mémoire, déterministe, et ne lit ni n’écrit le presse-papiers, l’historique, les clés ou un serveur. `?window=overlay&demo=1` rend la micro-bulle seule pour les captures Playwright.

Le reducer ignore les événements de flux obsolètes, active les actions seulement après `done`, et invalide le remplacement quand le bridge signale que le `captureId` a changé. Les tests unitaires couvrent ces cas ; les tests UIA/focus et les captures multi-DPI restent des vérifications Windows natives.

L’overlay enregistre d’abord ses listeners, puis appelle `frontend_ready()`. Cette commande doit retourner le `Capture` en attente ou `null`; elle ne doit jamais relancer une capture de presse-papiers. Le halo, les réglages et l’accueil ne démarrent ni n’écoutent une traduction.

Commandes : `npm run dev`, `npm run build`, `npm test`, `npm run tauri`.
