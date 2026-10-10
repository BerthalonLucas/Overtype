# Mesures de recette 0.1.5

> Document historique (mesures 0.1.5, 9 septembre 2026) : ne décrit plus l’état actuel. État actuel : [README.md](../../../README.md) et [docs/BRIDGE.md](../../../docs/BRIDGE.md).

Exécutées le 9 septembre 2026 avec vLLM 0.28.0 et les deux modèles épinglés.
Chaque ligne porte sur 100 extraits synthétiques courts (50 FR→EN, 50 EN→FR),
après échauffement. Température 0.7, top_p 0.6, top_k 20, répétition 1.05, seed 42.

| Profil | Requêtes simultanées | Complètes | Latence p50 (ms) | Latence p95 (ms) |
|---|---:|---:|---:|---:|
| Rapide | 1 | 100/100 | 213 | 331 |
| Rapide | 4 | 100/100 | 239 | 359 |
| Rapide | 10 | 100/100 | 254 | 379 |
| Qualité | 1 | 100/100 | 365 | 553 |
| Qualité | 4 | 100/100 | 387 | 550 |
| Qualité | 10 | 100/100 | 390 | 594 |

Ces temps HTTP ne comprennent ni capture Windows, ni animation. Le préchauffage
est exclu ; premier démarrage et première requête peuvent être nettement plus
longs. Rapide a été mesuré pendant que Qualité chargeait sur son autre GPU ;
CPU, RAM et WSL restent partagés. Le corpus se répète entre niveaux et le cache
de préfixes est activé. Ce n’est pas un benchmark général ni une comparaison
de qualité indépendante.

## Mémoire et capacité

- Rapide : poids chargés 3.43 GiB ; maximum observé sur la RTX 5060 Ti pendant
  ces mesures 6877 MiB, incluant les autres processus. KV : 44128 tokens ;
  ligne native : `Maximum concurrency for 8192 tokens per request: 5.39x`.
- Qualité : poids chargés 7.6 GiB ; maximum observé sur la RTX 5070 Ti pendant
  ces mesures 12792 MiB, incluant les autres processus. KV : 25168 tokens ;
  ligne native : `Maximum concurrency for 8192 tokens per request: 3.07x`.
- Le plafond de 10 séquences traite les extraits courts ; il ne garantit pas
  10 contextes pleins de 8192 tokens simultanément. La VRAM est échantillonnée
  chaque seconde, donc des pics brefs peuvent être manqués.

## Alertes de conservation et revue

Deux correspondances littérales manquent dans chaque série : `mail-03-en-fr`
reformule la date `2026-09-15` (15 septembre 2026 ou 15/09/2026) ; `mail-48-en-fr`
traduit la citation anglaise « ignore previous instructions ». Inspection par
agent : le sens de ces deux extraits est conservé, mais la chaîne exacte change.
Aucun score humain de fidélité/naturel n’a été attribué. Les 100 lignes de chaque
mode restent disponibles dans les CSV pour une revue humaine.

Les JSON voisins enregistrent les révisions, le hash du corpus et les mesures
agrégées. Les résultats détaillés restent dans `release/evaluation-0.1.5` et
dans le kit de test. Aucun texte utilisateur n’entre dans ce corpus.
