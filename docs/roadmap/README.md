# Roadmap : où Overtype pourrait aller

Ce dossier rassemble les **pistes pour les prochaines releases** : vision, architecture, idées, recherches. Rien ici n'est décidé ni planifié ; une piste devient du travail quand elle entre dans un plan de release (`docs/PLAN-x.y.md`) validé par Lucas.

> Créé le 10/10/2026 à partir d'une demande de Lucas : élargir Overtype au-delà de la réécriture de sélection (chat avec un modèle local, barre de saisie, passerelles vers ChatGPT ou l'Open WebUI d'ATE avec pseudonymisation, gestes natifs de Windows comme le clic droit, cas d'usage bureautiques et IT), et repenser l'architecture pour que ça reste cohérent.

## En 30 secondes

- 🧭 **Concept** : trois surfaces (Îlot, Barre, Chat), un moteur Rust, plusieurs portes d'entrée. L'IA d'ATE là où on travaille, et rien ne sort sans être vu. → [01-vision.md](01-vision.md)
- 🖱️ **Clic droit** : impossible d'ajouter une entrée au menu du *texte* des autres apps (aucune API Windows). Même effet avec **Ctrl + clic droit → Îlot** (crochet souris déjà dans le code), et un vrai clic droit sur les **fichiers** dans l'Explorateur plus tard. → [02-surfaces-et-gestes.md](02-surfaces-et-gestes.md)
- 🏗️ **Architecture** : un « lot 0 » invisible d'abord (découper `lib.rs`, client LLM multi-messages, types du pont générés, une session par surface), puis une techno par besoin, partout la même. → [03-architecture.md](03-architecture.md)
- 🎛️ **Modèles** : des rôles (Rapide, Précis, Vision, Long document) plutôt que des noms ; l'Open WebUI d'ATE peut servir de fournisseur sans changer le client, si l'admin active les clés API. → [04-modeles.md](04-modeles.md)
- ⛨ **ChatGPT sans fuite** : détecteurs Rust + LLM interne + aperçu validé par l'utilisateur, jetons `[PERSONNE_1]` réversibles. Dire « pseudonymisé », jamais « anonymisé ». → [05-confidentialite-et-passerelles.md](05-confidentialite-et-passerelles.md)
- 💼 **Cas d'usage** : 30 idées, dont logs, tickets, Excel, contrôle avant envoi. → [06-cas-usage.md](06-cas-usage.md)
- 🗺️ **Ordre proposé** : 0.7 Socle → 0.8 Conversation → 0.9 Passerelles → 0.10 Contexte → 1.0 Entreprise, et 7 décisions pour Lucas. → [07-trajectoire.md](07-trajectoire.md)

## Le kanban

[KANBAN.md](KANBAN.md) : toutes les idées en cartes `OT-xxx`, rangées en ✅ Prêt à planifier · 📐 À concevoir · 🔍 À explorer · 💡 Idées · 🗄️ Écarté. C'est **le** endroit où noter une nouvelle idée.

## Les recherches (sources, datées)

Rapports bruts, avec leurs sources et le statut de chaque affirmation (vérifié, rapporté, déduit, non vérifié). Ils vieillissent : revérifier avant de s'en servir pour décider.

| Rapport | Sujet |
|---|---|
| [2026-10-10-entrees-windows.md](recherches/2026-10-10-entrees-windows.md) | Clic droit, Explorateur, extension navigateur, Office, Click to Do, MCP sur Windows, identité de package |
| [2026-10-10-paysage-ux.md](recherches/2026-10-10-paysage-ux.md) | ChatGPT, Claude, Copilot, Raycast, Cherry Studio, Open WebUI, Hermes… patterns d'interface, 30 cas d'usage |
| [2026-10-10-anonymisation-passerelles.md](recherches/2026-10-10-anonymisation-passerelles.md) | Liens pré-remplis, Open WebUI comme serveur, détection FR/EN, RGPD, DLP |
| [2026-10-10-briques-techniques.md](recherches/2026-10-10-briques-techniques.md) | Fenêtres Tauri, stockage, rendu markdown, client LLM, MCP, OCR, registre de modèles, boucle d'agent |

## Règles du dossier

- Une idée = une carte au kanban ; un sujet qui grossit = un document numéroté ici.
- Dates absolues, sources citées, ce qui n'est pas vérifié est dit.
- Quand une piste entre dans une release, son plan vit dans `docs/PLAN-x.y.md` et la carte passe en « planifiée » avec le lien.
