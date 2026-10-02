# Refonte des Réglages et accueil (setup), design 29/09/2026

Demande de Lucas (29/09) : l'app est « un calvaire » à connecter. Il faut un seul serveur par défaut,
une adresse sans « /v1 », une liste des modèles lue sur le serveur, une vérification précise, un
diagnostic avec les journaux caché par défaut, et un accueil en 3 ou 4 étapes à l'installation.
Le tout épuré, dans l'esprit du reste de l'app. Le nom de l'app n'est pas figé : `src/brand.ts`.

## Principes

1. **Une chose par écran.** L'accueil pose une question par étape. Les Réglages ont une page par sujet.
2. **L'app fait le travail.** Adresse nettoyée toute seule, modèles listés tout seuls, test lancé tout seul.
3. **Un échec dit quoi faire.** Chaque étape ratée donne la cause en clair, puis le geste qui corrige.
   Le détail technique est dans le journal, pas dans la phrase.
4. **Contrôles connus.** Radix (Switch, Select, Popover, Tabs, Slider, Dialog), cmdk pour la liste
   filtrable. Rien de maison : `src/components/controls.tsx`. Géométrie en CSS, jamais un décalage en px dans le composant.
5. **Windows 11, pas un site web.** Segoe UI Variable, cartes groupées et lignes séparées par un filet,
   contrôles de 32 px, soulignement d'accent au focus, Mica/flou derrière l'accueil.
6. **Rien de privé dans le journal.** Ni texte traduit, ni presse-papiers, ni clé (masquée `sk-…3f2a`).

## Ce qui ressort (l'élément mémorable)

La **vérification en direct** : dès que l'adresse et la clé sont là, une petite trace s'écrit ligne par ligne
(Adresse → Connexion → Clé → Modèles), chaque ligne avec son temps. C'est la même trace dans l'accueil,
dans la page Serveur et, en brut, dans le Diagnostic. Le reste reste calme.

## Accueil (fenêtre `?window=setup`, 720 × 520, centrée)

Fond : Mica/Acrylic de Windows (natif), sinon une couche mate floutée qui suit le thème Windows
(clair : blanc laiteux ; sombre : gris anthracite mat). Pas de carte au milieu : le contenu est posé sur le fond.

```
┌──────────────────────────────────────────────┐
│                                              │
│                  ( ◉ )  ← le logo bat        │
│                                              │
│        Bienvenue dans FlowTranslate          │
│   Corriger, reformuler, traduire, là où      │
│              vous écrivez.                   │
│                                              │
│            [ Commencer le réglage ]          │
│               Plus tard                      │
└──────────────────────────────────────────────┘
```

Heartbeat : un « toc-toc » toutes les 2,4 s (échelle 1 → 1,06 → 1 → 1,035 → 1) et un anneau qui
s'élargit et s'efface à chaque battement. Mouvement réduit : immobile, anneau fixe léger.

Puis 4 étapes, une barre de 4 segments en haut (étape courante nommée), « Retour » / « Continuer » en bas à droite,
« Passer » discret en bas à gauche :

1. **Apparence** : thème (Système / Clair / Sombre, trois vignettes), langue, indicateur de travail (Perle, Nébuleuse, Ruban, aperçu animé).
2. **Raccourci** : le raccourci du menu en grosses touches, « Changer » l'enregistre ; choix « Ouvrir le menu » (Îlot) ou « Lancer directement une action » ; une mini-animation montre ce qui va se passer.
3. **Votre modèle** : adresse, clé, liste des modèles, essai. Détail plus bas.
4. **Prise en main** (facultative, 30 s) : 3 vignettes animées : sélectionner, appuyer sur le raccourci, choisir ; puis Annuler. Fin : « C'est prêt. Tout se modifie dans les Réglages. » + « Ouvrir les Réglages » / « Terminer ».

## Connexion (même composant dans l'accueil et dans Réglages > Serveur)

```
Adresse du serveur
[ https://llm.exemple.com                    ]
  Juste l'adresse. Pas besoin de /v1, on s'en occupe.
Clé API                                   Mon serveur n'a pas de clé
[ ••••••••••••••••••••     Protégée par Windows  👁 ]

  ✓ Adresse      llm.exemple.com trouvé            12 ms
  ✓ Connexion    HTTPS, certificat valide          41 ms
  ✓ Clé          acceptée                          63 ms
  ✓ Modèles      12 disponibles

Modèle
[ gemma-4-12b-it                             ▾ ]   ← cmdk, recherche
[ Essayer avec une phrase ]   → « Bonjour » → réponse, 0,8 s
```

- L'adresse est **normalisée** : espaces retirés, `https://` ajouté si absent, `/v1`, `/v1/models`,
  `/v1/chat/completions` et la barre finale retirés. Si elle a changé, une ligne discrète dit
  « On utilisera https://llm.exemple.com/v1 ».
- Sans clé : la liste reste grisée, « Renseignez d'abord la clé API » ; le lien « Mon serveur n'a pas de clé » lève ce blocage (serveurs locaux).
- Vérification automatique 600 ms après la dernière frappe, puis le bouton « Vérifier à nouveau ».
- Étapes et messages d'échec (cause, puis le geste) :
  - Adresse : nom introuvable → « Vérifiez l'orthographe de l'adresse. »
  - Connexion : refusée → « Rien n'écoute à cette adresse. Le serveur est-il démarré ? » ; délai → « Le serveur ne répond pas en 10 s. Pare-feu, proxy ou serveur occupé. » ; TLS/certificat → « Certificat refusé par Windows. »
  - Clé : 401/403 → « Clé refusée. Copiez-la à nouveau depuis votre fournisseur. »
  - Modèles : 404 → « Pas d'API OpenAI à cette adresse. » ; liste vide → « Aucun modèle chargé sur ce serveur. »
  - Chaque échec a « Voir le journal » qui ouvre le Diagnostic filtré sur cet essai.
- Le modèle choisi est gardé ; s'il disparaît de la liste, un avertissement le dit.

## Réglages (fenêtre 820 × 600, redimensionnable, barre latérale)

```
┌────────────┬─────────────────────────────────────────┐
│ ◉ FlowTr.  │  Serveur                          ✓ Enregistré
│            │  Où FlowTranslate envoie le texte.      │
│ ⚙ Général  │                                         │
│ ⌨ Raccourci│  ┌ llm.exemple.com ─────── ● Connecté ┐ │
│ ✦ Actions  │  │ gemma-4-12b-it · 41 ms              │ │
│ ↺ Après…   │  │ [Modifier]                          │ │
│ ◐ Apparence│  └─────────────────────────────────────┘ │
│ ▣ Serveur  │  + Ajouter un serveur                   │
│ 🔒 Données │                                         │
│            │                                         │
│ (Diagnostic│  ← visible après Ctrl+Maj+D             │
│ 0.5.1      │                                         │
└────────────┴─────────────────────────────────────────┘
```

Pages (Radix Tabs vertical) :
- **Général** : langue, démarrer avec Windows, « Revoir l'accueil », réinitialiser.
- **Raccourcis** : raccourci du menu, action par défaut, raccourcis directs.
- **Actions** : grille du menu (ordre, lettres), consignes.
- **Après remplacement** : vérification, Annuler (+ durée au Slider, méthode), mots changés, place de la pastille.
- **Apparence** : thème, indicateur, animations, style de mouvement, taille du texte de la bulle, fermeture auto.
- **Serveur** : un serveur par défaut ; « Ajouter un serveur » pour un second ; le serveur par défaut se choisit.
- **Données** : historique chiffré, effacer.
- **Diagnostic** (caché) : apparaît avec Ctrl+Maj+D (ou 5 clics sur la version), reste visible tant qu'on ne le masque pas.

Le statut d'enregistrement est en haut à droite du contenu, discret.

## Diagnostic

```
Diagnostic                           [Tout | Erreurs] [Copier] [Effacer]
Aucun texte, aucune clé : seulement ce qui s'est passé et combien de temps.

14:02:11.204  ● Connexion  GET https://llm.exemple.com/v1/models   200  63 ms
14:02:11.141  ● Connexion  TLS établi (certificat valide)                41 ms
14:01:58.902  ● Serveur    GET …/v1/models   délai dépassé (10 s)   ▸ détail
              cause: connect ok, réponse absente · proxy système: aucun
```

Chaque ligne se déplie (méthode, URL sans clé, statut HTTP, durée, cause technique, proxy utilisé).
« Copier » copie le journal texte (sans clé). Côté natif : tampon circulaire de 500 entrées en mémoire,
écrit aussi dans `%LOCALAPPDATA%\FlowTranslate\logs\diagnostic.log` (rotation 1 Mo).

## Travail natif à faire après validation (non fait dans cette maquette)

- Commandes Rust `probe_connection`, `list_models`, `try_model`, `get_diagnostics` + événement `diagnostic`.
- Modèle de données : `servers: [{id, name, endpoint, apiKey, model}]` + `defaultServerId` à la place de `profiles.fast/quality` (migration : quality → serveur 1, fast → serveur 2 s'il diffère).
- Fenêtre `setup` au premier lancement (Mica), drapeau `setupDone`.
- Délai de `/v1/models` : 5 s aujourd'hui, trop court pour un serveur qui charge un modèle ; 10 s + message dédié.
- Proxy système : noter dans le journal si reqwest passe par un proxy (piste pour « 127.0.0.1:8888 ne répond pas »).
