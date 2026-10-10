# Essai FlowTranslate 0.1.6 sur un autre poste

> Document historique (essai 0.1.6, 10 septembre 2026) : ne décrit plus l’état actuel. État actuel : [README.md](../README.md) et [docs/BRIDGE.md](../docs/BRIDGE.md).

Ce guide accompagne le kit `FlowTranslate-0.1.6-test-kit.zip`. Il sert à installer
le client Windows sur un poste qui n’est pas celui de Lucas et à observer la
nouvelle interface : bulle de verre, onglet replié en bas de l’écran, anneau
d’attente, bords lissés. Aucune donnée n’est envoyée hors du poste tant qu’un
serveur n’est pas configuré.

## Prérequis

- Windows 11 (ou Windows 10 récent) avec le **Microsoft Edge WebView2 Runtime**
  (présent par défaut sur Windows 11 ; sinon l’installateur le propose).
- Aucun droit administrateur : l’installation se fait par utilisateur, dans
  `%LOCALAPPDATA%\FlowTranslate` par défaut.
- Pour une vraie traduction sur ce poste : Docker Desktop (moteur Linux) et une
  carte NVIDIA avec au moins 6 Go libres pour le profil Rapide. Sans cela,
  l’interface se teste en mode simulé (voir plus bas).

## Installer

1. Lancer `FlowTranslate_0.1.6_x64-setup.exe` et garder le dossier proposé.
2. Ouvrir FlowTranslate depuis le raccourci. L’application vit dans la zone de
   notification (icône près de l’horloge) : clic droit → **Réglages** ou **Quitter**.
3. Avant toute réinstallation ou changement de mode, **Quitter** depuis cette
   icône : une instance déjà ouverte reçoit sinon la nouvelle commande.

## Tester l’interface sans serveur

`Mode-simule.cmd` (dans le kit) lance le client avec `--simulate-inference` :
la capture de texte est réelle, la réponse est synthétique et marquée comme
telle. Ce mode suffit pour juger le rendu et les interactions.

1. Dans un éditeur ou un navigateur, sélectionner une phrase, puis `Ctrl+Alt+T`.
   La traduction démarre aussitôt ; une nouvelle pression traduit la sélection
   courante. Sans sélection, le presse-papiers est utilisé.
2. Pendant l’attente, un **anneau** tourne dans le verre ; le texte arrive ensuite
   d’un bloc, le verre s’ouvre à sa taille finale.
3. Sortir la souris de la bulle : après une demi-seconde, elle se replie en un
   **onglet** de quelques dizaines de pixels au bord bas de l’écran. Le survoler
   rouvre la bulle ; le × de l’onglet ou **Fermer** dans le menu ⋯ la ferme.
   `Échap` ferme aussi.
4. Regarder les **bords** de près (verre, pilule, menu, onglet) : coins lissés,
   ombre douce, aucun cadre gris ni escalier de pixels. Noter l’échelle
   d’affichage du poste (Paramètres → Système → Écran, 100 %, 125 %, 150 %).
5. Cliquer **à côté** de la bulle : le clic doit atteindre l’application dessous.
   Cliquer dans le verre doit sélectionner le texte ou déplacer la bulle.
6. Essayer un paragraphe long : la bulle grandit jusqu’à 220 px puis le texte
   défile à la molette ; **Agrandir** dans le menu ⋯ ouvre le lecteur large.

## Tester avec un vrai moteur

Sur ce poste, si Docker Desktop et une carte NVIDIA sont disponibles, depuis le
dossier du kit :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\server\start.ps1 -Profile fast
```

Le premier lancement télécharge l’image vLLM épinglée et environ 4 Go de poids.
Ensuite, dans **Réglages** : langue cible, mode **Rapide**, puis **Enregistrer et
vérifier le moteur**. Les adresses locales (`http://127.0.0.1:8001/v1`) sont
déjà renseignées.

Un serveur sur un autre poste n’est utilisable qu’en **HTTPS** derrière un
proxy authentifié : le client refuse une adresse HTTP hors de la machine locale.
Ce cas n’est pas couvert par ce kit.

## Quoi rapporter

Pour chaque observation : la version de Windows, l’échelle d’affichage, l’action
faite, ce qui était attendu et ce qui s’est produit, avec une capture d’écran
si possible. Ne jamais joindre un texte confidentiel : le mode simulé et des
phrases neutres suffisent. Le fichier `VALIDATION.md` du kit liste ce qui a déjà
été vérifié automatiquement et ce qui reste à confirmer à l’œil.

## Désinstaller

Quitter FlowTranslate, puis Paramètres → Applications → FlowTranslate →
Désinstaller. Les réglages et l’historique facultatif restent dans
`%APPDATA%\com.flowtranslate.desktop` ; supprimer ce dossier pour repartir de zéro.
