# 07 · Trajectoire proposée : dans quel ordre

> Statut : **proposition** (10/10/2026), à réordonner par Lucas. Les numéros de version sont indicatifs. Les cartes `OT-xxx` sont dans [KANBAN.md](KANBAN.md).

## Le principe d'ordre

1. **Le socle d'abord**, invisible mais indispensable : sans lui, chaque fonctionnalité ajoute une exception de plus dans `lib.rs`.
2. Ensuite **une seule grosse surface par release**, chacune livrée finie (design validé, vraie fenêtre, cas limites), selon la méthode de la 0.6.
3. Ce qui demande l'IT d'ATE (clés API Open WebUI, certificat de signature, politiques) est **lancé tôt en parallèle**, parce que l'attente ne dépend pas de nous.

```
 0.7 Socle ──▶ 0.8 Conversation ──▶ 0.9 Passerelles ──▶ 0.10 Contexte ──▶ 1.0 Entreprise
   │                                   ▲
   └── en parallèle, côté ATE : clés API Open WebUI · certificat de signature · dictionnaire clients/projets
```

## Les étapes

| Version | Thème | Cartes | Ce que l'utilisateur voit | Critère de fin |
|---|---|---|---|---|
| **0.7** | Socle | OT-001 → OT-008, OT-016, OT-019, OT-020 (essai), OT-027 (mesure) | Ctrl + clic droit ouvre l'Îlot ; rien d'autre ne change | tests existants verts, `lib.rs` découpé, types générés, Open WebUI testé en vrai |
| **0.8** | Conversation | OT-010, OT-011, OT-012, OT-013, OT-014, OT-017, OT-018 | la barre au centre, le chat en bas à droite, les rôles de modèles | une conversation sur une sélection, de bout en bout, en vraie fenêtre, captures et vidéo |
| **0.9** | Passerelles | OT-015, OT-021, OT-022, OT-023, OT-033 (destinations), OT-040 | « Ouvrir dans ChatGPT ⛨ » avec aperçu, « Ouvrir dans Open WebUI », « Rétablir les noms » | rappel mesuré par type sur le corpus maison, publié dans le repo |
| **0.10** | Contexte | OT-024, OT-025, OT-026, OT-052 | logs, fichiers, captures dans le chat ; « Analyser avec Overtype » sur un `.log` | un log de 10 000 lignes expliqué sans dépasser le contexte, ce qui a été coupé est montré |
| **1.0** | Entreprise | OT-029, OT-031, OT-033, OT-047, déploiement signé | clic droit moderne de l'Explorateur, partage, commandes d'équipe, outils MCP approuvés | installation signée sur un poste ATE standard, politiques admin appliquées |

## Variante : les passerelles avant le chat

Le bouton « Ouvrir dans ChatGPT ⛨ » **ne dépend pas du chat** : il part d'une sélection, comme l'Îlot. Si l'urgence pour ATE est d'empêcher les fuites vers ChatGPT, on inverse 0.8 et 0.9 :

```
 0.7 Socle ──▶ 0.8 Passerelles (depuis l'Îlot) ──▶ 0.9 Conversation ──▶ …
```

Coût : l'aperçu pseudonymisé est conçu une fois sans le chat, puis réintégré dans le chat en 0.9.

## Décisions attendues de Lucas

| # | Question | Options | Ma recommandation |
|---|---|---|---|
| 1 | Ordre des releases | Conversation d'abord / Passerelles d'abord | Selon l'urgence chez ATE ; à défaut, Conversation d'abord |
| 2 | Noms des nouvelles surfaces (anglais) | « Ask bar » / « Chat » / autre | QCM avec aperçus, comme pour le nom Overtype |
| 3 | Comportement du chat | au premier plan ou fenêtre normale ; dans Alt+Tab ou non | premier plan léger, hors Alt+Tab, joignable par raccourci et icône |
| 4 | Geste souris par défaut | Ctrl + clic droit / bouton latéral / désactivé | Ctrl + clic droit, réglable |
| 5 | Recherche dans l'historique | titres en clair + déchiffrement borné / SQLCipher | titres en clair d'abord |
| 6 | Destinations externes proposées | ChatGPT, Claude, Le Chat, Copilot, Gemini (copier-ouvrir) | ChatGPT + Open WebUI d'abord, le reste en table de config |
| 7 | Démarches côté ATE | clés API Open WebUI, certificat de signature, dictionnaire clients/projets | lancer les trois maintenant |
