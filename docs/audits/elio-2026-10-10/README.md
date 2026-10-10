# Overtype — audit Elio

Audit du **10 octobre 2026**, code figé sur `main@e202cd1f8831abc0f69435b9e2d0d96dd491e841` (0.6.2). Livraison **rapports uniquement**, sans correctif, mise à jour de dépendances, modification de workflow ou PR.

## Commencer ici

1. **[Synthèse et priorités](SYNTHESE.md)** — verdict, usage des frameworks, bibliothèques à garder/réutiliser, limites et ordre de travail.
2. **[Registre final](FINDINGS.md)** — 40 sujets dédoublonnés : 4 P1, 23 P2, 13 P3. Les quatre P1 natifs restent des risques statiques à valider sur Windows.
3. **[Vérifications réelles](VERIFICATION.md)** — résultats, échecs, tentatives interrompues, environnement et distinction CI distante/exécution locale.

## Couverture et comparaisons

- [Branches](branches.md) et [matrice JSON](branches.json) : 35 refs initiales + 2 branches documentaires arrivées pendant la mission ; ascendance, équivalence de patch et contenu distingués.
- [Comparaison de l’audit Claude](comparison-claude.md) : 118 IDs classés, avec désaccords motivés, apports supplémentaires et limites. [JSON](comparison-claude.json).
- [Comparaison de la roadmap](comparison-roadmap.md) : 14 fichiers du delta ; dix clarifications/options futures, aucun bug actuel supplémentaire imputé à main. [JSON](comparison-roadmap.json).

## Pièces spécialisées

| Rapport | Sujet |
|---|---|
| [Frontend](frontend.md) | React, Radix, Motion, focus, a11y, persistance |
| [Dépendances](dependencies.md) | Versions, compatibilité, advisories, prototypes et usages |
| [Natif](native.md) | Rust, Tauri, Windows, sélection, clipboard, annulation |
| [Sécurité](security.md) | Confidentialité, stockage, IPC, réseau, chaîne de livraison |
| [QA / CI](qa.md) | Tests réels, mocks, couverture native et gates de release |
| [Architecture / serveur](architecture.md) | Contrats, modules, SSE, configuration Compose |
| [Contre-review native](crosscheck-native.md) | Gardes existantes, scénarios conditionnels, gravités corrigées |
| [Contre-review sécurité](crosscheck-security.md) | SQLite, advisories officiels et limites de menace |

**Hiérarchie :** le registre final et la synthèse arbitrent les rapports initiaux. Les sévérités et totaux des spécialistes ne doivent pas être additionnés. Les sept familles d’apports complémentaires du tiers restent dans sa comparaison, sans inflation automatique des 40 sujets initiaux. Ce nombre n’est pas un décompte de vulnérabilités.

## Données et preuves

- [Registre JSON](consolidated-findings.json) : source IDs, regroupements, sévérités finales, contre-reviews et niveaux de preuve.
- [Inventaire actif npm/Cargo](dependencies-current.json) : déclarations et résolutions ; pas un SBOM des binaires ou de l’image serveur.
- [Commandes et résultats QA](evidence/qa-checks.json), [extraits exacts de logs](evidence/test-excerpts.txt), [jobs CI du SHA audité](evidence/main-ci.json).

Les chemins `preuves-locales/` et `artefacts-locaux/` dans les pièces initiales sont des références à des artefacts privés, non des liens vers des fichiers livrés. Captures, traces, reproductions et métadonnées complètes restent conservées localement. Aucun transcript d’agent ni journal d’authentification n’est publié.

## Méthode

Sept spécialistes inspirés de fiches Agency Agents, deux contre-reviewers et deux comparaisons documentaires ; arbitrage et vérifications par Elio. Fiches utilisées comme guides, pas plugin installé. Audit de source et tests bornés : aucune certification, aucun benchmark modèle/GPU, aucune exécution Windows locale, aucune garantie de couverture exhaustive de chaque ligne historique.
