# Essai Acrylic (lot 12, phase B) : constat pour la décision

> Document historique (essai Acrylic de la 0.5, 24 septembre 2026) : ne décrit plus l’état actuel. État actuel : [README.md](../README.md) et [docs/BRIDGE.md](../docs/BRIDGE.md).

Essai du 24 septembre 2026 par l'agent natif, fusionné dans `da-ilot` (839340d). Plan :
[DA-PLAN.md](DA-PLAN.md), lot 12 ; décision par défaut 3 de [UI-DECISIONS.md](UI-DECISIONS.md).
Contrat technique : [BRIDGE.md](BRIDGE.md), « Îlot: the Acrylic trial ».

## En bref

- Le vrai Acrylic de Windows fonctionne derrière l'Îlot et la pilule, dans la vraie fenêtre, en
  clair et en sombre, pendant que l'application source garde le focus.
- Il ne peut exister que sur une forme **immobile**. À chaque changement de forme, il disparaît
  et le verre peint prend le relais. Il revient d'un coup, 0,8 s après que la forme s'est posée,
  avec des coins de 8 px.
- **Recommandation : garder le verre peint (phase A) par défaut** et ne pas livrer l'Acrylic. Les
  surfaces de l'Îlot vivent peu et changent sans cesse de forme : l'Acrylic s'y voit rarement, et
  quand il se voit, c'est par un saut. Détails en fin de document.

## Comment le voir

Réglage caché, jamais affiché dans les Réglages : dans `settings.json` (dossier de données de
l'app, `%APPDATA%\com.flowtranslate.desktop` par défaut), mettre `"glassMaterial": "acrylic"` puis
relancer FlowTranslate. Pour revenir en arrière : `"painted"` ou retirer la clé. Avec `painted`
(le défaut), rien ne change : aucune fenêtre en plus, aucun attribut.

## Ce qui a été construit

La WebView ne peut pas flouter ce qu'il y a derrière sa fenêtre : c'est pour ça que la phase A
peint le verre. On avait déjà essayé l'effet Acrylic de Tauri sur toute la fenêtre de l'overlay :
Windows le dessine sur toute la fenêtre réservée, bien plus grande que la surface, d'où le cadre
gris d'avant (voir BRIDGE, « Glass calibration »).

L'essai emprunte donc la voie la plus simple qui montre honnêtement le rendu :

- **Une fenêtre native de fond**, à nous, placée juste sous l'overlay. Elle a exactement la taille
  de la surface de l'Îlot au repos, c'est-à-dire la dernière région publiée par le front. Elle
  porte l'Acrylic de Windows (`DWMSBT_TRANSIENTWINDOW`), avec des coins arrondis par Windows et
  sans bordure. Elle n'est jamais activée et laisse passer tous les clics. Elle n'a pas de bouton
  dans la barre des tâches (mesuré) et, comme c'est une fenêtre outil, elle n'apparaît pas dans
  Alt+Tab.
- **Masquée pendant les changements de forme** : l'entrée, le passage au menu, puis à la pilule,
  puis à la coche ou à l'erreur, et la sortie. Elle est masquée par *cloak* (DWM), jamais cachée
  par `SW_HIDE`, et elle revient 0,8 s après la dernière forme publiée, ce qui correspond au
  ressort le plus lent de l'Îlot. Aucun `SetWindowPos` sur l'overlay : seule la fenêtre de fond
  bouge, et uniquement une fois la forme posée.
- **Côté front, seulement du CSS** : tant que le matériau est visible, Rust pose
  `data-backdrop="acrylic"` sur `<html>`. Une règle en fin de `src/theme.css` retire alors le fond
  peint de la surface et met ses coins à 8 px. Le liseré, le filet et l'ombre reprennent le
  préréglage « Acrylic Windows » du labo.
- **Matériau « actif » forcé** : Windows dessine un Acrylic plat quand la fenêtre est inactive, et
  la nôtre l'est toujours. La fenêtre répond donc à chaque désactivation comme à une activation
  (`WM_NCACTIVATE`, comme le prévoit le plan).
- **Repli automatique sur la phase A** dans ces cas : Windows 10 ou Windows 11 avant 22H2,
  transparence désactivée, économiseur d'énergie, contraste élevé, bureau à distance. Ces
  conditions sont relues à chaque affichage.
- **Aucune capture d'écran** : c'est Windows qui floute, aucun pixel de l'écran ne passe par
  l'app. L'option écartée du plan, avec sa question de confidentialité, n'est pas nécessaire.

## Ce qu'on voit

Captures recadrées sur nos fenêtres, au-dessus d'une page de démonstration à bandes de couleurs
vives, hors du dépôt (rendu de l'agent natif) : `comparaison-light.png` et `comparaison-dark.png`
(Acrylic et verre peint côte à côte, pour le menu compact, la grille, la pilule de travail et la
coche), `film-light-*-grid.png` et `film-light-*-pill.png` (images successives d'un changement de
forme), `compare-active-frame-trick.png`.

- **Clair** : un verre dépoli qui prend la couleur de ce qu'il y a dessous (rose, vert d'eau,
  beige selon les bandes). Le texte se lit bien. Le verre peint est presque blanc.
- **Sombre** : un gris teinté, plus clair que le verre peint, où les couleurs vives remontent. Le
  texte blanc reste lisible. Constat au passage, qui concerne la phase A : à 0,86 d'opacité, le
  verre peint sombre laisse voir **nettement** les grandes lettres de la page à travers la grille,
  sans flou. L'Acrylic, lui, les efface. À regarder pour la décision 12, sur la valeur sombre.
- **La pilule n'est plus ronde** : un rectangle aux coins de 8 px au lieu d'une gélule
  (rayon 14). La grille passe de 16 à 8 px.
- **Le saut** : pendant le ressort, on voit le verre peint (blanc, coins ronds). Une fois la forme
  posée, en une image, la surface devient colorée et ses coins passent à 8 px.

## Ce qui marche (mesuré dans la vraie fenêtre)

Exécutable release, dossier de données jetable, inférence simulée, Chrome à profil jetable, écran
à 100 %.

| Critère du plan | Résultat |
|---|---|
| Acrylic visible pendant que la source garde le focus | Oui. Sur la pilule de travail et sur la coche, avec Chrome au premier plan : le matériau est là, coloré par la page (chroma moyenne de 25 à 35 ; le verre peint clair est à 2 à 6 hors de la pastille colorée de la pilule). |
| 50 cycles afficher/cacher sans perte (ni Mica, ni noir) | Trois séries de 50 sur l'exe final : 146 ouvertures sur 146 avec le matériau correct, calé au pixel sur la surface, jamais plat ni noir, puis masqué et traversable par un clic après chaque fermeture. Une seule fenêtre de fond à la fin. Les 4 autres cycles : l'Îlot s'est refermé seul juste après la capture (11 à 13 ms là où ce délai a été mesuré), avant tout matériau. Cela arrive aussi sans Acrylic (témoin peint : 1 sur 50), donc ce défaut ne vient pas du lot 12. |
| Pas de cadre gris | Aucun trait gris autour du matériau, en clair comme en sombre (zooms des coins). Bordure de Windows désactivée (`DWMWA_BORDER_COLOR`). |
| Repli sur la phase A quand la transparence est coupée | Vérifié par injection de test dans la vraie fenêtre (`FLOWTRANSLATE_ACRYLIC_FALLBACK`) pour les cinq conditions : aucune fenêtre de fond, aucun attribut, verre peint identique à la phase A. Tests unitaires pour les cinq conditions. **Non vérifié en vrai** : il aurait fallu modifier les réglages de Windows. |

Autres mesures :

- **Actif forcé, indispensable** : dans un exécutable témoin sans la réponse à `WM_NCACTIVATE`, le
  matériau est gris plat (chroma 2,9 contre 20,1 avec). C'est le cas même quand l'Îlot a le
  clavier, parce que la fenêtre de fond est une autre fenêtre.
- **Clics** : dans une première version, la fenêtre de fond prenait les clics dans les coins,
  entre son arrondi de 8 px et celui, plus grand, de la région de l'Îlot. En la rendant
  « layered » et transparente à la souris, le clic atteint la page, même quand le matériau est
  affiché. Ce style ne coûte pas le matériau (mesuré).
- **Délais**, du moment où la touche est envoyée jusqu'au changement du matériau :

  | Passage | Matériau masqué après | Matériau revenu après |
  |---|---|---|
  | Menu compact → grille (Tab) | 28 à 52 ms | 849 à 871 ms |
  | Menu → pilule de travail (Entrée) | 26 à 107 ms | 1 496 à 1 555 ms |

## Ce que ça coûte

1. **Coins imposés à 8 px.** Windows ne propose que 8 px, 4 px ou pas d'arrondi. La pilule
   devient un rectangle arrondi et la grille perd ses 16 px. Ce n'est plus la forme du labo.
2. **Pas de morph natif.** Le matériau ne suit pas le ressort : il est retiré au début de chaque
   changement de forme et revient seulement après. La pilule de travail reste peinte pendant ses
   1,5 premières secondes. Une vraie traduction courte peut donc se terminer sans que l'Acrylic
   n'apparaisse jamais sur la pilule. Même chose pour le menu quand le choix tombe en moins de
   0,85 s (Entrée tout de suite).
3. **Pas de fondu de la matière.** Le passage du verre peint à l'Acrylic se fait en une image,
   avec le saut de coins en plus (filmé). À la sortie, la surface redevient peinte dès le début
   de son fondu (par construction, non filmé).
4. **Le délai de 0,8 s est une estimation côté Rust** : Rust ne sait pas quand le ressort finit, il
   attend 0,8 s après la dernière forme publiée. Pour que le matériau revienne dès la fin du
   ressort, le front devrait annoncer « forme posée » (la phase `end` de `MorphSurface`). Le
   saut resterait.
5. **Masquage par cloak** : fiable sur les 150 cycles, avec une seule fenêtre de fond pour toute
   la session. Pour Windows, elle reste une fenêtre affichée, simplement masquée : c'est une
   fenêtre de plus à garder hors du chemin de la souris et du clavier.
6. **Un comportement de Windows forcé** : l'aspect actif repose sur une réponse inhabituelle à
   `WM_NCACTIVATE`. Une mise à jour de Windows pourrait le rendre plat sans prévenir.
7. **Replis** : en cas de transparence coupée, d'économiseur d'énergie, de contraste élevé, de
   bureau à distance ou de Windows 10, c'est la phase A qui s'affiche. Le rendu dépend donc de
   la machine : il faut maintenir et tester deux matières.
8. **Portée de l'essai** : seulement l'Îlot (menu, pilules, erreurs). Le verre v4 et la bande de
   lecture restent peints.

Non vérifié :

- réglages Windows réellement modifiés (transparence, économiseur, contraste élevé), bureau à
  distance, Windows 10 ;
- 150 et 200 % (les coins de Windows et la règle CSS devraient suivre l'échelle) et second
  écran ;
- coût GPU de DWM ;
- les une ou deux images au tout début d'un changement de forme, où le matériau immobile peut
  encore se voir derrière le ressort (non filmées à cette cadence) ;
- l'enregistrement depuis la fenêtre Réglages garde `glassMaterial` (lu dans le code, qui
  recopie tout l'objet des réglages ; non exercé).

## Recommandation

**Garder le verre peint (phase A) par défaut et ne pas livrer l'Acrylic.** Au repos, l'Acrylic
est plus beau et, en sombre, plus lisible que la phase A. Mais l'identité de l'Îlot, c'est une
seule surface qui change de forme, et c'est justement là que l'Acrylic ne suit pas : il arrive
tard, d'un coup, et avec d'autres coins. Sur des surfaces qui vivent une à quelques secondes, on
verrait surtout ce saut.

Si le rendu au repos plaît à Lucas malgré tout, trois étapes sont possibles, de la moins chère
à la plus chère :

1. Relever l'opacité sombre de la phase A, puisque le 0,86 actuel laisse lire le fond. C'est une
   correction du verre peint, indépendante de l'Acrylic.
2. Garder l'Acrylic uniquement pour la grille ouverte, la forme qui reste le plus longtemps
   immobile, et le verre peint pour les pilules.
3. Garder l'Acrylic partout, avec l'annonce « forme posée » du front pour supprimer le délai de
   0,8 s. Le saut et les coins de 8 px resteraient.

En attendant sa décision, l'essai reste derrière le réglage caché.
