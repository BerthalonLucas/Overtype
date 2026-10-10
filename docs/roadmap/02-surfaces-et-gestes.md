# 02 · Surfaces et gestes : comment on appelle Overtype, où il répond

> Statut : **exploration** (10/10/2026). Maquettes en texte pour fixer les idées ; le design réel passera par le labo et un QCM avec Lucas avant tout code (méthode de la 0.6).
> Sources : [recherches/2026-10-10-entrees-windows.md](recherches/2026-10-10-entrees-windows.md), [recherches/2026-10-10-paysage-ux.md](recherches/2026-10-10-paysage-ux.md).

## 1. Les trois surfaces

### Îlot (existe)

Inchangé dans son geste. Deux ajouts possibles :
- une tuile ou une touche **« Discuter »** qui ouvre le chat avec la sélection attachée (au lieu de remplacer) ;
- chaque action gagne un **comportement de sortie** : Remplacer (défaut actuel) · Insérer dessous · Copier · Ouvrir dans le chat · Ouvrir ailleurs (anonymisé). C'est le modèle « Output Behavior » de Raycast, vérifié le 10/10/2026.

### Barre (nouvelle) : une question, au centre

```
            ┌────────────────────────────────────────────────────────┐
            │ ⌁ Outlook · 412 mots ✕   📎 app.log ✕                  │  ← puces de contexte, retirables
            │ Pourquoi ce service redémarre toutes les nuits ?_      │
            │                                   Précis ▾   ↵ Envoyer │  ← rôle du modèle, discret
            └────────────────────────────────────────────────────────┘
```

- Raccourci dédié (« demander »), distinct de celui de l'Îlot. **Pas Alt+Espace par défaut** : Copilot, ChatGPT et Gemini se le disputent déjà (vérifié/rapporté, 2025-2026).
- La sélection active est déjà là, en **puce** (app source + taille). Un clic la retire, un survol l'affiche.
- `/` ouvre la liste des commandes (les mêmes que l'Îlot), `@` pourrait citer un document interne (Open WebUI) : à explorer.
- Échap ou clic dehors : ferme, rend le focus à l'app d'origine, **la saisie est gardée** pour la prochaine ouverture.
- Entrée : la barre **se pose** en chat (repli animé vers le coin, même ressort que l'Îlot).

### Chat (nouveau) : la conversation, en petit, en bas à droite

```
                                          ┌─────────────────────────────┐
                                          │ Précis · interne ● ▾   ⤢  ✕ │  ← modèle + destination ; agrandir
                                          ├─────────────────────────────┤
                                          │ ⌁ app.log (2 140 lignes,    │
                                          │   312 gardées)              │
                                          │ Pourquoi ce service…        │
                                          │                             │
                                          │ ● La tâche planifiée X      │
                                          │   relance le pool à 03:00…  │
                                          │   [Copier] [Remplacer]      │
                                          │   [Ouvrir dans ChatGPT ⛨]   │  ← ⛨ = passera par l'anonymisation
                                          ├─────────────────────────────┤
                                          │ Répondre…            ↵      │
                                          └─────────────────────────────┘
```

- Fenêtre propre (pas l'overlay de l'Îlot), redimensionnable, **mémorise sa taille**, se recale dans le coin de l'écran courant.
- **⤢ Agrandir** : même fenêtre, plus grande, avec la liste des conversations et la recherche. Pas une seconde app.
- La conversation n'est **jamais perdue** à la fermeture (leçon du compagnon ChatGPT).
- Le **badge de destination** est toujours visible : `local` · `interne` · `externe`. Un changement de destination se voit, jamais en silence.
- Chaque réponse peut repartir dans l'app source (**Remplacer**, **Insérer**) avec les garde-fous actuels : cible revalidée, presse-papiers restauré, Annuler.
- Hors Alt+Tab et hors barre des tâches par défaut (cohérent avec l'Îlot), joignable par raccourci, icône de notification et jump list. **Décision à prendre par Lucas.**

### États à prévoir dès le design

| État | Barre | Chat |
|---|---|---|
| Vide (aucune sélection) | champ seul, suggestions de commandes | dernières conversations |
| Flux en cours | — | texte qui arrive, bouton Stop, prefill long = « lecture du contexte… » |
| Contexte trop long | puce orange « 312 lignes gardées sur 2 140 » | proposer le rôle « Long document » |
| Serveur injoignable | message + lien vers Réglages › Serveurs (comme la 0.6) | idem, la saisie est gardée |
| Modèle sans vision / sans outils | puce image grisée + explication | idem |
| Envoi externe | aperçu anonymisé obligatoire avant l'ouverture du navigateur | idem |

## 2. Les gestes pour appeler Overtype

**Réponse directe à « Overtype dans le clic droit »** : Windows ne permet pas d'ajouter une entrée au menu contextuel du *texte* des autres apps. Chaque app dessine son menu (Office, Chromium, WinUI) ; seul l'Explorateur accepte des entrées tierces, et seulement pour des fichiers (doc Microsoft du 16/07/2026). L'injection de DLL dans les menus est à écarter (EDR, plantages, couverture partielle). On obtient la même UX autrement :

| # | Geste | Ce qu'il fait | Prérequis | Effort | Phase |
|---|---|---|---|---|---|
| 1 | **Ctrl + clic droit** sur une sélection (option : bouton latéral de la souris) | ouvre l'Îlot au curseur, le menu natif ne s'ouvre pas | rien : le crochet souris bas niveau existe déjà (`host.rs`) | S–M | 1 |
| 2 | **Extension Edge/Chrome** : clic droit › Overtype › actions | vrai clic droit natif dans le navigateur (web mail, Teams web, Open WebUI…) | extension + native messaging en HKCU (compatible NSIS par utilisateur) | M | 1 |
| 3 | **Envoyer vers › Overtype** et verbe « Analyser avec Overtype » sur `.log`/`.txt` | ouvre le chat avec le fichier attaché | raccourci SendTo + clés HKCU ; menu « Afficher plus d'options » seulement | S | 1 |
| 4 | **Menu moderne de l'Explorateur** › Overtype › Résumer / Analyser ce log / Demander… | idem, au premier niveau du clic droit Windows 11 | identité de package (*sparse package* signé) + DLL `IExplorerCommand` | M–L | 2 |
| 5 | **Partager** (feuille de partage Windows) | envoyer un fichier ou une page vers le chat | même identité que #4 (coût marginal) | S après #4 | 2 |
| 6 | **Touche Copilot** reprogrammée vers Overtype | appui court = barre, appui long = dictée (idée) | app packagée et signée ; choix de l'utilisateur ou de l'IT | M après #4 | 2 |
| 7 | **Barre flottante à la sélection** (façon PopClip / Cherry Studio) | une pastille apparaît quand on sélectionne à la souris | crochets + heuristiques (`selection-hook`, MIT) | M | 3, opt-in |
| 8 | **Complément Word/Excel/PowerPoint** | entrée « officielle » dans le clic droit d'Office | add-in web hébergé, déploiement M365 ; **Outlook n'a pas de clic droit pour les add-ins** | M–L | 3, si l'IT le veut |

À écarter : injection dans les menus, Click to Do (PC Copilot+ seulement), PowerToys Command Palette (PowerToys rare en entreprise), extension de message Teams (cachée sous « Autres actions »), clic droit *maintenu* comme geste par défaut (retarde tous les menus natifs).

### Pièges connus sur les gestes

- Le crochet souris est **retiré en silence** par Windows s'il met plus d'une seconde à répondre : il doit rendre la main tout de suite et travailler ailleurs.
- Il faut avaler **l'appui et le relâchement** du clic droit, sinon l'app reçoit un relâchement orphelin.
- Les fenêtres lancées **en administrateur** ne sont pas visibles d'un processus normal (UIPI) : repli propre, message court.
- Liste d'exclusion par `.exe` (apps qui utilisent déjà Ctrl+clic droit, gestionnaires de mots de passe).
- Le lancement par l'Explorateur, l'extension ou la jump list passe par un **routeur d'arguments** : aujourd'hui le rappel `single-instance` ignore les arguments (`lib.rs:3196`).

## 3. Les passerelles : vers ChatGPT, l'Open WebUI d'ATE, ou ailleurs

Bouton **« Ouvrir dans… ⛨ »** sur une sélection, dans la barre ou sous une réponse. Détail, URL et anonymisation dans [05-confidentialite-et-passerelles.md](05-confidentialite-et-passerelles.md).

## 4. Questions de design pour Lucas (à passer en QCM avec aperçus)

1. Noms des deux nouvelles surfaces (anglais, test « j'utilise X ») : « Ask bar » / « Chat » ? autre ?
2. Le chat reste-t-il **au premier plan** ou se comporte-t-il comme une fenêtre normale ?
3. Chat dans la barre des tâches et Alt+Tab : oui ou non ?
4. Raccourci « demander » par défaut (sachant qu'Alt+Espace est saturé) ?
5. Geste souris par défaut : Ctrl + clic droit, bouton latéral, ou désactivé ?
6. Matière du chat : vrai verre comme l'Îlot, ou mat comme les Réglages (règle actuelle : « vrai verre seulement pour ce qui flotte ») ?
