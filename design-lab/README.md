# Labo FlowTranslate — la référence de la nouvelle DA « Îlot »

> Référence figée, datée des 23–25 septembre 2026 (avant la 0.5.0) : elle ne suit plus l’app. État actuel : [README.md](../README.md) et [docs/BRIDGE.md](../docs/BRIDGE.md).

**Ce dossier est la référence visuelle et de mouvement de FlowTranslate.** Tout ce que Lucas a
choisi les 23 et 24 septembre 2026 y est visible, manipulable et réglable, avec les pistes
écartées à côté pour comparaison. Le plan d’implémentation (`../docs/DA-PLAN.md`) s’appuie dessus :
quand le plan dit « comme dans le labo », c’est ici qu’il faut regarder, et le code d’ici peut
être repris tel quel.

À ne pas supprimer ni « nettoyer » : ce dossier n’est pas du code mort, c’est la maquette validée.

## Ouvrir le labo

- **`labo-flowtranslate.html`** : la page complète, en un seul fichier. L’ouvrir dans Edge ou
  Chrome (double-clic suffit ; React est chargé depuis cdnjs, il faut donc Internet).
- Copie identique : `../docs/design/labo-flowtranslate.html`.
- Version publiée pour Lucas : https://claude.ai/artifact/AtzY6pK6b6TvWsF8Be3MPt (privée).
- **`mise-en-valeur.html`** (25/09) : les prototypes de la mise en valeur du texte. Lucas a choisi
  depuis, et c’est implémenté (fenêtre `halo`, `src-tauri/src/halo.rs`, `src/halo/` ; style des mots
  changés « Encre irisée » ou « Éclat », 60 s par défaut, réglable de 5 à 120 s). Le prototype montrait : la sélection à trois niveaux pendant le menu, l’effet pendant le
  travail, l’arrivée du texte, les mots changés tenus jusqu’à la prochaine action (60 s au plus),
  en clair et en sombre. Page autonome sans dépendance ni build ; « Copier mon choix » donne le
  choix en texte + JSON. Version publiée : https://claude.ai/artifact/95Hn4JpMoSe8sHTneT7hBE
  (privée ; republier la page sans ses trois premières lignes, que le lecteur d’artefacts
  fournit lui-même).

Les **réglages par défaut sont les choix de Lucas**. Le bouton « Tout remettre à zéro » y revient.
Le bouton « Copier ma config » produit un résumé lisible + JSON des réglages en cours : c’est le
moyen le plus sûr pour qu’un humain et un agent parlent de la même chose.

## Comment s’en servir

1. **Le simulateur** (en haut) : un faux bureau avec un mail. Sélectionner du texte à la souris
   (au caractère près, double-clic pour un mot), puis **Ctrl+Alt+Espace** ou le bouton « Ouvrir le
   menu ». L’Îlot apparaît ; Entrée relance la dernière action, F T P S E choisissent, Tab déplie la
   grille, Espace ouvre la consigne libre, Échap ferme. Le texte est remplacé, les mots changés
   restent surlignés pendant les 8 s d’annulation, Ctrl+Z annule.
2. **Le panneau de droite** (7 onglets) règle tout : parcours, menu, chargement, résultat,
   mouvement, matière, simulation (temps de réponse, chargement tenu, erreurs à déclencher).
3. **La barre du haut** : vitesse (1× à ⅒×) pour observer un mouvement, et « Animations : toujours /
   comme l’appareil / réduites ». Le labo force les animations par défaut ; un témoin indique si
   l’appareil demande de les réduire.
4. **Les galeries** (en bas) : les 10 menus, les 23 indicateurs, les 8 effets sur la sélection,
   les courbes et ressorts sur des pistes côte à côte, les 7 matières, les 3 jeux d’icônes.

## Ce que Lucas a choisi (valeurs par défaut)

| Élément | Choix | Où le trouver dans la source |
|---|---|---|
| Menu | Îlot | `src/menus.jsx` → `Ilot` |
| Indicateur | Perle (ou Nébuleuse, Ruban) | `src/loaders.jsx` (définitions et réglages), `src/loaders.css` (`.perle`, `.neb`, `.sinus.ruban`) |
| Pendant le travail | Pilule + balayage de lumière sur la sélection | `src/Panel.jsx` → `TEXT_FX` (`sweep`), CSS `.tfx-sweep` dans `src/app.css` |
| Arrivée du texte | Fondu | CSS `.rx-fade` dans `src/app.css` |
| Mots changés | Surlignés tant qu’on peut annuler (8 s) | CSS `.chg-hold` / `.is-leaving`, logique `Para` dans `src/Simulator.jsx` |
| Coche et Annuler | Coche tracée, Annuler 8 s avec anneau | `src/Simulator.jsx` (phase `done`), CSS `.check-draw`, `.undo-ring` |
| Position de la pilule | Sous le nouveau texte, jamais dessus ; option marge | `place()` dans `src/Simulator.jsx` |
| Mouvement | Apple « smooth » (ou « bouncy ») | `src/data.js` → `MOTION_PRESETS`, calculs dans `src/motion.js` et `src/spring.js` |
| Transformation menu → pilule | Ressort, contenu centré | `src/Surface.jsx`, CSS `.surface .layer` |
| Matière | Verre Apple clair / verre sombre, suit le thème | `src/data.js` → `MATERIAL_PRESETS`, `materialVars` |
| Icônes | Lucide | `src/icons-data.js` (SVG exacts des paquets officiels) |
| Erreurs | Pilule compacte, lien direct vers le champ fautif | `src/data.js` → `OUTCOMES`, `MockSettings` dans `src/Simulator.jsx` |
| Langue | Anglais, bascule française | `src/data.js` → `UI` |

La liste complète des choix, des pistes écartées et de leurs raisons est dans
`../docs/DA-PLAN.md` (§1 et §2) et `../docs/UI-DECISIONS.md`.

## Carte des fichiers

| Fichier | Contenu | Réutilisable dans l’app |
|---|---|---|
| `src/Surface.jsx` | La surface qui se transforme (menu → pilule → résultat), entrée/sortie, contenu centré, verre liquide expérimental, `Icon` | Oui : principe du morph (animer largeur/hauteur/rayon dans une fenêtre réservée) |
| `src/menus.jsx` | Les 10 menus et leur gestion clavier (`useMenuKeys`, `commonKey`) | Oui : `Ilot` et la table de touches |
| `src/loaders.jsx`, `src/loaders.css` | Les 23 indicateurs, paramètres en variables CSS | Oui : copier le CSS de Perle, Nébuleuse, Ruban à l’identique |
| `src/Simulator.jsx` | Le parcours complet : sélection au caractère, raccourcis, phases, résultat, annulation, erreurs, faux Réglages | Comme modèle de comportement (la vraie app passe par Rust et UI Automation) |
| `src/Panel.jsx` | Le panneau de réglages, la liste des effets sur la sélection (faisables / démo) | Liste des réglages à prévoir dans l’app |
| `src/Galleries.jsx` | Les galeries (menus, indicateurs, effets, courbes, matières, icônes) | Non (outil de comparaison) |
| `src/data.js` | Actions, textes simulés, réécriture simulée d’une plage, erreurs, préréglages de mouvement et de matière, **valeurs par défaut** | Oui : valeurs exactes |
| `src/motion.js` | Ressorts en `linear()`, courbes nommées, horloge (ralenti, animations réduites) | Oui : conversions et courbes |
| `src/spring.js` | Solveur de ressort testé (conversions Apple, Motion, Material) | Oui (tests faits sur la doc Apple) |
| `src/diff.js` | Diff mot à mot LCS (testé sur 2 000 cas aléatoires) | Oui : surlignage des mots changés |
| `src/icons-data.js` | SVG Iconoir 7.12, Lucide 1.47, Phosphor 2.1 | L’app utilise `lucide-react` (même dessin) |
| `src/app.css` | Tout le style : bureau, surface, menus, effets, résultat | Oui pour les classes citées plus haut |
| `verify.mjs` | Les vérifications automatiques du labo | Modèle pour les tests de la nouvelle DA |

## Limites à connaître (important pour l’app)

- **Tout est simulé** : aucun modèle, des sorties préécrites (`PARAGRAPHS` et `mockRewrite` dans
  `src/data.js`).
- **Navigateur seulement** : rien ici ne valide la vraie fenêtre Windows.
- **Le flou du verre** marche dans le labo parce que le bureau est dessiné dans la page. Dans l’app,
  la fenêtre WebView2 ne voit pas le bureau : le vrai verre est livré en 0.6 par le compositeur de
  Windows, sous la page (`src-tauri/src/backdrop.rs`, matière par défaut), avec le verre « peint »
  en repli.
- **Effets marqués « démo seulement »** (lettres colorées, scintillement des lettres, vague de mots,
  arrivée mot à mot, machine à écrire) : impossibles dans une autre application, car FlowTranslate
  ne peut pas redessiner le texte d’une autre fenêtre. Seuls les effets **dessinés par-dessus les
  lignes sélectionnées** sont faisables (balayage de lumière, lueur, contour, soulignement, voile).
- **Le menu au clavier** marche ici parce que la page a le focus. Dans l’app, la fenêtre prend le
  focus le temps du menu par la commande `focus_overlay` (lot 3, livré), puis le rend à la source.

## Reconstruire et vérifier

```sh
cd design-lab
npm install          # esbuild + React (et Playwright à la racine du dépôt pour verify)
npm run build        # régénère labo-flowtranslate.html (et la copie dans docs/design)
npm run verify       # 17 vérifications Playwright (Chromium)
```

`verify` vérifie : l’Îlot au raccourci, le balayage pendant le travail, le remplacement, le
surlignage pendant l’annulation, la pilule jamais sur le nouveau texte (même quand il s’allonge),
Ctrl+Z, le centrage de l’indicateur pendant la transformation (écart < 0,5 px), la sélection au
caractère près, l’ouverture des 10 menus, le lien direct d’une erreur de clé vers son champ,
l’absence d’erreur de console, la largeur téléphone et le mode « animations réduites ».
Si Playwright ne trouve pas son navigateur, `CHROMIUM_PATH` indique un Chromium à utiliser.

Après toute modification : reconstruire, vérifier, et republier la page pour Lucas si besoin.
