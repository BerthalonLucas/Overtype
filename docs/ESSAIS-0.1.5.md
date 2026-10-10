# Essai réel FlowTranslate 0.1.5

> Document historique (essai 0.1.5, 9 septembre 2026) : ne décrit plus l’état actuel. État actuel : [README.md](../README.md) et [docs/BRIDGE.md](../docs/BRIDGE.md).

Cette recette vérifie l’installation Windows et une traduction réelle avec un
serveur local. Elle n’utilise aucun mode de démonstration. Les deux profils sont
déjà démarrés sur le poste de Lucas ; la section suivante sert après leur arrêt.

## Préparer le serveur

Docker Desktop doit être démarré avec le moteur **Linux** disponible. Depuis le
dépôt FlowTranslate, lancer un seul profil à la fois :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\Lucas\projects\flowtranslate\server\start.ps1" -Profile fast
```

Pour le moteur Qualité, relancer la même commande avec `-Profile quality`.
Les deux profils peuvent coexister sur ce poste : une carte leur est affectée
à chacun. Les profils exposent : Rapide sur
`http://127.0.0.1:8001/v1` avec `flowtranslate-fast` (Hy-MT2-1.8B), Qualité sur
`http://127.0.0.1:8002/v1` avec `flowtranslate-quality` (Hy-MT2-7B-FP8).
Le script valide le prérequis et attend l’état sain du profil sélectionné.

Les journaux peuvent aider à diagnostiquer un démarrage, mais ne doivent jamais
contenir le texte source, la traduction, le presse-papiers, une clé ou un autre
secret.

## Régler et lancer le client

1. Quitter une instance précédente depuis l’icône de notification, puis lancer
   exactement `C:\Users\Lucas\Apps\FlowTranslate\FlowTranslate.exe`.
2. Ouvrir Réglages et choisir la langue cible (**FR** ou **EN**) et le mode
   (**Rapide** ou **Qualité**), puis cliquer **Enregistrer et vérifier le moteur**.
   Les adresses locales sont déjà renseignées ; Connexion avancée sert à les
   modifier pour un autre serveur. Une erreur de connexion doit être
   corrigée avant l’essai.
3. Dans un éditeur, sélectionner une courte phrase puis presser `Ctrl+Alt+T`.
   Avec une sélection valide, la traduction démarre automatiquement. Sans
   sélection, FlowTranslate affiche une capsule presse-papiers : confirmer le
   texte avant l’envoi.
4. Vérifier le résultat dans la bulle. Tester **Copier**, le menu puis **Fermer**,
   et `Échap` (fermeture ou annulation). Une seconde pression sur
   `Ctrl+Alt+T` redonne le focus à la bulle ; le focus de l’application source
   doit rester utilisable après sa fermeture.
5. Essayer un paragraphe suffisamment long pour ouvrir le lecteur inférieur.
   Vérifier que la molette et le clavier parcourent tout le texte, sans barre de
   défilement visible. La position reste lisible pendant le flux.
6. Refaire une phrase **FR→EN** puis **EN→FR** dans chaque mode sélectionné et
   noter seulement les faits observés (profil, action, erreur éventuelle).

Le remplacement dans l’application source n’est à essayer que lorsqu’un champ
éditable pris en charge reste sélectionné et inchangé (contrôles `Edit`/RichEdit
vérifiés). Cette version ne promet pas un remplacement universel dans Office,
Teams ou les autres applications.

## Retour à 0.1.4

Conserver les données utilisateur et quitter FlowTranslate depuis la zone de
notification. L’installateur précédent vérifié sur ce poste est :

`C:\Users\Lucas\projects\flowtranslate\release\FlowTranslate_0.1.4_x64-setup.exe`

Le lancer pour réinstaller 0.1.4 dans le même dossier, sans supprimer les données.
Conserver le serveur 0.1.5 compatible avec le même contrat API : ses correctifs
WSL restent nécessaires sur ce poste. Ne pas utiliser `docker compose down -v`
et ne pas supprimer les volumes : ils contiennent notamment les poids et caches.
Vérifier `/v1/models`, une traduction dans les deux sens, **Copier** et
**Annuler**. Les données DPAPI restent liées au même compte Windows.
