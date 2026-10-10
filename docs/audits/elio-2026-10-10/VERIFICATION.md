# Vérifications, reproductibilité et limites

Référence de code : `e202cd1f8831abc0f69435b9e2d0d96dd491e841`. Aucun test n’a été exécuté sur un produit corrigé : cet audit ne contient pas de correctifs.

## Résultats

Les commandes, codes de sortie, durées et runtimes QA sont dans [evidence/qa-checks.json](evidence/qa-checks.json). Les extraits de logs sont authentiques, avec seulement remplacement des chemins locaux, retrait des espaces de fin de ligne et omissions explicitement marquées : [test-excerpts.txt](evidence/test-excerpts.txt). Ils ne sont pas des sorties reconstituées.

- Installation et build des trois projets npm réussis (voir dependencies.md).
- Frontend QA : 314/314 tests dans 40 fichiers, après un premier essai interrompu par le délai outil. Un run séparé du spécialiste dépendances a eu un échec de timing (313/314) ; sa reprise ciblée a réussi. Les runtimes et charges n’étaient pas identiques.
- Python : 5 tests passent, 1 Windows sauté. Syntaxe et aide des outils vérifiées, sans inférence/GPU.
- E2E : run complet à 6 workers, 226 pass / 24 fail. Reprise des 24 échecs à 2 workers : 24 pass. Aucun run complet vert local n’est revendiqué. Les premiers échecs ne sont pas effacés par la reprise.
- Visuels Linux : 14 références applicables absentes, 1 interrompu, 37 non exécutés. Arrêt volontaire après diagnostic ; pas de snapshots régénérés pour verdir.
- Frontend ciblé : perte de focus et course de snapshot des réglages reproduites ; tests complémentaires relancés par le coordinateur. Le fait qu’un test de reproduction passe signifie qu’il retrouve le comportement défectueux attendu, pas que ce comportement est corrigé.
- SQLite : reproduction synthétique avec amalgamation correspondant au lock, vérification des connexions et WAL. Ce n’est pas le binaire Windows rusqlite/DPAPI.
- Rust, PowerShell, Docker, remplacement Windows réel, NVDA, GPU : non exécutés localement. Outils absents ou environnement inadapté, pas sorties simulées.

## CI distante

[main-ci.json](evidence/main-ci.json) conserve les jobs et étapes de trois runs du même SHA audité, relus via GitHub. Ces jobs réussissent, y compris Windows. Cette preuve ne rend pas le run E2E local vert et ne démontre pas un parcours natif éditeur → sélection → collage → Undo.

## Refaire les validations principales

Sur un checkout privé au SHA ci-dessus, utiliser les scripts du dépôt et les commandes exactes de qa-checks.json. Conserver la distinction des environnements : CI Node 24 ; validations locales principales Node 26.5.1/npm 11.17.0/Python 3.13.5 ; plusieurs contrôles auxiliaires Node 26.7.0/npm 11.19.0/Python 3.14.7.

Pour les cas Windows, le rapport natif fournit les préconditions, gardes déjà présentes et scénarios à exécuter. Adapter éventuellement les tests Edge de l’ancienne branche PR6 ; ne pas fusionner son comportement produit sans revalider les décisions ultérieures.

## Conservation et assainissement

Les sept rapports complets, JSON de travail, contre-reviews, traces/captures et scripts de reproduction restent conservés dans les preuves locales de l’audit. Seuls les rapports, données sélectionnées et extraits assainis sont publiés. Les chemins absolus personnels, journaux d’authentification et transcripts de délégation sont exclus.

Le registre JSON final est contrôlé pour unicité et dédoublonnage. La matrice des 35 refs initiales est comparée à l’inventaire original ; les deux nouvelles refs sont explicitement ajoutées. Les 118 IDs du tiers sont classés mais 30 restent non revérifiés. Les comparaisons documentaires ne valent pas validation d’une implémentation future.
