# Profil de rendu

> Document historique (profil de rendu 0.1.4, 9 septembre 2026) : ne décrit plus l’état actuel. État actuel : [README.md](../README.md) et [docs/BRIDGE.md](../docs/BRIDGE.md).

## 0.1.4 — raffinement du matériau

Même protocole Chromium 153.0.8010.12 et viewport 1280 × 800, exécuté le
9 septembre après la fin des tests et de la compilation. Les rapports bruts
sont conservés dans `release/ui-profile-0.1.3-before.json` et
`release/ui-profile-0.1.4-after.json`, hors du nettoyage Playwright.

| Scénario / mouvements | p95 avant → après | Tâches >50 ms après | Intervalles >32 ms après | Temps de layout avant → après |
|---|---:|---:|---:|---:|
| Court / normaux | 16,8 → 16,7 ms | 0 | 0 | 8,93 → 8,99 ms |
| Long / normaux | 16,8 → 16,7 ms | 0 | 0 | 12,34 → 12,26 ms |
| Court / réduits | 16,8 → 16,7 ms | 0 | 0 | 8,35 → 8,53 ms |
| Long / réduits | 16,8 → 16,8 ms | 0 | 0 | 11,85 → 12,72 ms |

Aucune rupture de cadence dans ces quatre parcours courts. Les temps JS sont
légèrement supérieurs dans ce passage (163/197 ms contre 154/190 ms en mode
normal) ; ces échantillons uniques ne permettent pas de conclure à un gain
ou une régression statistique. Le profil ne mesure pas le compositeur Windows.

`scripts/capture-ui-preview.mjs` enregistre les composants réels du navigateur
avec une traduction simulée : copie, menu, agrandissement, réduction et fermeture.
Le fichier local `release/material-preview-0.1.4/transitions.webm` est un aperçu
visuel, pas une mesure de FPS natif.

## 0.1.3

Mesuré le 9 septembre 2026 avec `scripts/profile-ui.mjs`. Chromium headless
153.0.8010.12, viewport 1280 × 800, échelle 1, réponses simulées. Un passage par
scénario : chargement, flux, ouverture/fermeture du menu et 350 ms de repos.
Le profil après utilise le frontend du worktree glass-frontend servi sur 5176.

| Scénario / mouvements | Images mesurées | Intervalle p95 | Intervalles >32 ms | Tâches >50 ms | Calculs de layout | Temps total de layout |
|---|---:|---:|---:|---:|---:|---:|
| Court / normaux | 78 | 16,7 ms | 0 | 0 | 28 | 8,64 ms |
| Long / normaux | 109 | 16,8 ms | 0 | 0 | 38 | 11,77 ms |
| Court / réduits | 79 | 16,7 ms | 0 | 0 | 27 | 8,15 ms |
| Long / réduits | 107 | 16,8 ms | 0 | 0 | 37 | 11,79 ms |

Le passage avant modification présentait déjà un p95 de 16,7–16,8 ms, aucune
tâche longue et aucun intervalle >32 ms. Les nouveaux calculs de layout sont
plus nombreux (28/38 contre 22/33, mouvements normaux), avec un temps cumulé
de 8,64/11,77 ms contre 8,24/10,40 ms. Le temps JavaScript mesuré est de
148/187 ms contre 160/204 ms. Ces échantillons uniques ne démontrent pas un
gain statistique ; ils ne révèlent pas de régression de cadence dans ce parcours.

Les tests de pont simulé vérifient séparément qu'un flux de 120 fragments
n'émet aucun redimensionnement supplémentaire avant sa terminaison. Les
fragments sont regroupés pendant 32 ms ; les dimensions proviennent d'une
mesure du texte source, puis d'une vérification à la fin de la réponse.

Les animations utilisent Motion : opacité à l'entrée/sortie, fondu de 80 ms
avant changement de format puis 140 ms après acquittement de la géométrie
native. Aucun étirement du texte, animation du flou ou interpolation des
dimensions Windows. Les mouvements réduits désactivent ces transitions.

## Limites

Ces mesures ne représentent ni le FPS du compositeur Windows, ni la charge
GPU, ni une garantie de fluidité sur tous les moniteurs. Le fond acrylique
Win32 est indépendant de l'opacité du WebView et peut persister jusqu'au
masquage final de la fenêtre. Le DPI Windows mixte et le coût du dépoli
nécessitent une validation native séparée.

Les valeurs de cette exécution sont transcrites ci-dessus. Les JSON temporaires
ont été supprimés par le nettoyage de `test-results` au lancement de Playwright.
Pour reproduire après les tests et conserver un nouveau rapport :

```powershell
node scripts/profile-ui.mjs test-results/ui-profile.json glass
```
