# 01 · Vision : d'un correcteur à l'assistant de travail interne

> Statut : **exploration** (10/10/2026). Rien ici n'est décidé ni planifié. Les décisions passent par Lucas, puis par un plan de release (`docs/PLAN-x.y.md`).

## Le constat

Aujourd'hui Overtype fait une chose, très bien : **sélection → raccourci → Îlot → le texte est remplacé sur place**. C'est un geste court, sans fenêtre, qui ne vole pas le focus.

Ce qui manque pour en faire l'outil IA quotidien d'une entreprise :

| Besoin | Aujourd'hui | Manque |
|---|---|---|
| Discuter d'un texte (« pourquoi ce log plante ? ») | impossible, un seul aller-retour | une **conversation** multi-tours |
| Poser une question sans sélection | impossible | une **barre de saisie** au centre de l'écran |
| Garder une réponse sous la main | la pilule disparaît | un **chat compact** en bas à droite |
| Envoyer vers ChatGPT / l'Open WebUI d'ATE | à la main, données en clair | une **passerelle** avec anonymisation |
| Choisir son modèle | un serveur par défaut, modèle fixé par serveur | un **sélecteur simple**, par rôle |
| Travailler sur un fichier, une capture, un log | rien | du **contexte** au-delà de la sélection |
| Déclencher autrement qu'au clavier | un raccourci | des **gestes natifs** (souris, Explorateur, navigateur) |

## L'idée en une phrase

**L'IA de l'entreprise, là où on travaille déjà** : un seul moteur local et privé, plusieurs portes d'entrée légères, et jamais une donnée qui sort sans qu'on l'ait vue.

## Le modèle mental : trois surfaces, un moteur

```
          GESTES (comment on appelle)                 SURFACES (où ça répond)
  ┌───────────────────────────────────┐       ┌──────────────────────────────────┐
  │ Raccourci « menu »  Ctrl+Alt+Espace│──┐    │ ÎLOT   près de la sélection       │
  │ Ctrl + clic droit sur la sélection │──┤    │        action → remplacé sur place│
  │ Raccourci « demander »             │──┤    ├──────────────────────────────────┤
  │ Clic droit sur un fichier          │──┼──▶ │ BARRE  au centre de l'écran      │
  │ Extension Edge/Chrome              │──┤    │        une question, un contexte  │
  │ Icône de la zone de notification   │──┘    ├──────────────────────────────────┤
  └───────────────────────────────────┘       │ CHAT   compact en bas à droite    │
                                               │        conversation, agrandissable│
                                               └──────────────┬───────────────────┘
                                                              │
                         ┌────────────────────────────────────▼─────────────────┐
                         │ MOTEUR (Rust)  contexte · modèles · conversations ·   │
                         │ confidentialité · outils · passerelles externes       │
                         └───────────────────────────────────────────────────────┘
```

- **Îlot** reste le geste roi pour les transformations courtes : il ne change pas.
- **Barre** : un raccourci ouvre une ligne de saisie au centre, la sélection courante y est déjà attachée en « puce ». Entrée → la barre se pose en chat.
- **Chat** : une petite fenêtre en bas à droite qui garde la conversation. On l'agrandit en vraie fenêtre (historique, recherche) quand on veut.
- Les trois se passent la main : depuis l'Îlot, « Discuter de ce texte » ouvre le chat avec la sélection ; depuis le chat, « Remplacer dans l'app » réinsère la réponse avec les garde-fous actuels.

## Principes (ceux qui tranchent les débats)

1. **Local et interne d'abord.** Les modèles par défaut sont ceux d'ATE (vLLM interne, Open WebUI interne, ou le poste). Le cloud public est une **destination explicite**, jamais un repli silencieux.
2. **Rien ne sort sans être vu.** Toute sortie vers l'extérieur passe par un aperçu anonymisé que l'utilisateur valide.
3. **Le texte reste là où il est.** On agit dans l'app de l'utilisateur ; on ne l'oblige pas à copier-coller vers une autre fenêtre.
4. **Un geste, une surface, un résultat.** Pas de prolifération façon ChatGPT 2026 (Chat, Work, Codex, Pages…). Trois surfaces, c'est le plafond.
5. **Des rôles, pas des noms de modèles.** L'utilisateur choisit « Rapide », « Précis », « Vision », « Long document » ; l'admin relie ces rôles aux vrais modèles.
6. **Une techno par besoin, partout la même.** Voir [03-architecture.md](03-architecture.md) : Rust pour tout ce qui touche au système, au réseau, aux données ; React pour l'affichage ; un seul pont typé.
7. **Aucune action à effet de bord sans confirmation.** Un modèle peut proposer d'envoyer, de créer, de supprimer ; seul l'utilisateur déclenche.

## Ce qu'Overtype ne cherche pas à être

- **Pas un agent autonome** qui exécute du shell ou range des fichiers (Hermes Agent, OpenClaw) : risque trop élevé en entreprise.
- **Pas un clone de l'Open WebUI d'ATE.** L'Open WebUI reste le back-office (bases de connaissance, préréglages, droits) ; Overtype en est la porte d'entrée sur le poste. Voir [04-modeles.md](04-modeles.md).
- **Pas une suite Office.** On ne réécrit pas Word ; on agit sur ce que Word affiche.

## La référence « Hermès »

Lucas a dicté « un peu comme Hermès Sophie final ». Lecture retenue (certitude ~80 % pour Hermès, faible pour le reste) : **Hermes Agent / Hermes Desktop de Nous Research** (open source MIT, ~252 000 étoiles GitHub vérifiées le 10/10/2026, app desktop en preview depuis juin 2026), et « Sophie final » = probablement « sauf qu'au final » (… plus bureautique). Ce qu'on en garde : mémoire, recherche dans les sessions passées, commandes qu'on capitalise. Ce qu'on n'en garde pas : l'agent qui agit seul sur la machine. Détail dans [recherches/2026-10-10-paysage-ux.md](recherches/2026-10-10-paysage-ux.md).
