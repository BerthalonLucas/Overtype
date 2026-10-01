# Verre réel 0.6 : un vrai flou derrière les surfaces flottantes

Recherche du 1er octobre 2026 (agent « chercheur », aucune ligne de code changée). Suite de
[ACRYLIC-TRIAL.md](ACRYLIC-TRIAL.md) : l'essai caché marchait au repos mais avait deux défauts,
les **coins imposés à 8 px** et un **fond flou qui ne suit pas la forme** quand elle s'anime.
Ce document dit comment les corriger, avec les sources, et donne le plan pas à pas.

Légende : ✅ vérifié à la source aujourd'hui (URL ou code lu) · 🧠 connu de mémoire, à confirmer
à la compilation · 🧪 à essayer sur une vraie machine avec GPU.

## En bref

- **La cause des deux défauts est la même** : l'essai demandait à Windows de peindre *toute une
  fenêtre* en Acrylic (`DWMWA_SYSTEMBACKDROP_TYPE`). Dans ce mode, Windows décide de la forme
  (coins 8 px, 4 px ou carrés) et on ne peut animer qu'en déplaçant une fenêtre, ce qui saccade.
- **La bonne voie** : garder une fenêtre de fond *immobile*, grande comme la zone réservée de
  l'overlay, et y dessiner nous-mêmes le verre avec le compositeur de Windows
  (`Windows.UI.Composition`) : un pinceau « ce qu'il y a derrière la fenêtre, déjà flouté »
  (`CreateHostBackdropBrush`) découpé par un **rectangle arrondi dont on anime la taille, la
  position et le rayon** (`CompositionRoundedRectangleGeometry`). Rayon libre (14 → 999), plus
  aucune fenêtre qui bouge.
- **Synchronisation** : le front envoie **un seul message au début de chaque changement de
  forme** (départ, arrivée, courbe). Rust lance la même courbe dans le compositeur, qui l'exécute
  tout seul à la fréquence de l'écran. Pas de message par image.
- **Repli** : Windows 10, Windows 11 avant 22000, transparence coupée, économiseur d'énergie,
  contraste élevé, bureau à distance, ou toute erreur → verre peint actuel, inchangé.
- **Ce que la VM peut valider** : forme, alignement au pixel, clics, robustesse, replis.
  **Ce qu'elle ne peut pas valider** : fluidité, décalage d'une image, coût GPU, qualité du flou.
  Il faudra un passage sur la tour de Lucas.

## Une idée reçue à corriger

Tauri **utilise déjà WebView2** : c'est la vue web système de Windows, basée sur Chromium, de la
même famille que ce qu'embarquent les apps Electron (ChatGPT, Claude desktop). Le moteur web
n'est donc pas la question. Aucun moteur web, ni Chromium ni WebView2, ne sait flouter ce qui se
trouve *derrière sa fenêtre* : `backdrop-filter` ne floute que le contenu de la page. La question
est uniquement **la matière native placée sous la vue web transparente**. Electron a le même
problème et le règle de la même façon (`backgroundMaterial`, voir plus bas).

Vérifié dans le code de wry 0.55.1 (notre version, `Cargo.lock`) : la vue est créée par
`CreateCoreWebView2Controller[WithOptions]` avec un fond transparent
(`wry-0.55.1/src/webview2/mod.rs:375-410`). C'est l'hébergement « fenêtré » : une fenêtre enfant.

## Les options, avec preuves

### (a) Matières système de DWM : `DWMWA_SYSTEMBACKDROP_TYPE`

- ✅ Windows 11 build 22621+. Valeurs Mica / Acrylic (`DWMSBT_TRANSIENTWINDOW`) / Tabbed. La
  matière est dessinée « derrière la fenêtre, zone non cliente comprise », donc **sur toute la
  fenêtre**. Source : <https://learn.microsoft.com/en-us/windows/win32/api/dwmapi/ne-dwmapi-dwmwindowattribute>
- ✅ `DWMWA_WINDOW_CORNER_PREFERENCE` (22000+) ne propose qu'une *préférence* (rond 8 px, petit
  rond, carré). Aucun rayon libre. Même source.
- ✅ Mesuré chez nous (ACRYLIC-TRIAL) : marche au repos, matière plate si la fenêtre est inactive
  (d'où l'astuce `WM_NCACTIVATE`), et déborde de la région de fenêtre (BRIDGE, « Glass
  calibration » : le cadre gris).
- **Verdict** : bon pour une *fenêtre* classique (voir « Fenêtre de setup »), mauvais pour une
  forme qui change. C'est exactement l'essai actuel.

### (b) `SetWindowCompositionAttribute` (`ACCENT_ENABLE_ACRYLICBLURBEHIND`) + `SetWindowRgn`

- ✅ API non documentée de `user32`. Le README de `window-vibrancy` annonce : « Bad performance
  when resizing/dragging the window on Windows 10 v1903+ and Windows 11 build 22000 » pour
  l'Acrylic, et la même chose pour le flou simple sur 22621+.
  Sources : <https://github.com/tauri-apps/window-vibrancy>,
  <https://github.com/tauri-apps/window-vibrancy/issues/47>
- 🧠 `SetWindowRgn` découpe bien cette matière, mais sans anticrénelage (bord en escalier) et
  chaque image d'animation demande un nouvel appel de région : c'est le décalage qu'on veut fuir.
- **Verdict** : écarté. Non documenté, lent en mouvement, bords crénelés.

### (c) `Windows.UI.Composition` : notre arbre de visuels sous la vue web ← **retenu**

- ✅ Une app Win32 peut héberger des visuels du compositeur dans un HWND :
  `DispatcherQueueController` + `Compositor` + `ICompositorDesktopInterop::CreateDesktopWindowTarget`.
  Windows 10 1803+. Source : <https://learn.microsoft.com/en-us/windows/apps/desktop/modernize/ui/using-the-visual-layer-with-win32>
- ✅ `Compositor.CreateHostBackdropBrush()` : « samples from the area behind the visual, before
  the window is drawn ». L'app ne peut pas relire les pixels (rien ne passe par nous : même
  garantie de confidentialité que l'essai). « The transparency of the host backdrop brush is a
  property the user can control from Settings or by using power policies. »
  Source : <https://learn.microsoft.com/en-us/uwp/api/windows.ui.composition.compositor.createhostbackdropbrush>
- ✅ Pour une fenêtre Win32, il faut l'attribut `DWMWA_USE_HOSTBACKDROPBRUSH` : « Enables a
  non-UWP window to use host backdrop brushes […] supported starting with Windows 11 Build
  22000 ». Source : page DWMWINDOWATTRIBUTE ci-dessus. Sans lui, on obtient un visuel noir
  (symptôme décrit, sans réponse, dans
  <https://github.com/microsoft/Windows.UI.Composition-Win32-Samples/issues/84>).
- ✅ **Le flou est déjà dans le pinceau.** Le code de WinUI le dit pour l'Acrylic « fenêtre » :
  « either the shell baked the blur into the backdrop brush, and we use it directly, or we apply
  the blur ourselves » : pas de `GaussianBlurEffect` sur le HostBackdrop.
  Source : <https://github.com/microsoft/microsoft-ui-xaml/blob/winui2/main/dev/Materials/Acrylic/AcrylicBrush.cpp>.
  Confirmé par <https://github.com/ALTaleX531/Win32Acrylic> : « HostBackdropBrush has a certain
  blur amount itself ». Conséquence : pas besoin de Win2D (qui n'existe pas en Rust) pour la
  première version ; l'intensité du flou est celle de Windows, on ne peut pas la *réduire*.
- ✅ Découpe : `CompositionGeometricClip` (1809+) avec une `CompositionRoundedRectangleGeometry`
  (1803+) dont `Size`, `Offset` et `CornerRadius` sont des propriétés **animables** par
  `StartAnimation`. Sources :
  <https://learn.microsoft.com/en-us/uwp/api/windows.ui.composition.compositiongeometricclip>,
  <https://learn.microsoft.com/en-us/uwp/api/windows.ui.composition.compositionroundedrectanglegeometry>
- ✅ Les animations du compositeur tournent dans DWM, hors de nos threads, à la fréquence de
  l'écran (c'est le principe de la couche visuelle ; ressorts natifs disponibles depuis 16299 :
  <https://learn.microsoft.com/en-us/uwp/api/windows.ui.composition.springvector3naturalmotionanimation>).
- ✅ La crate `windows` 0.62.2 (déjà dans le projet) a les features nécessaires : `UI_Composition`,
  `UI_Composition_Desktop`, `Win32_System_WinRT`, `Win32_System_WinRT_Composition`, `System`,
  `Foundation_Numerics` (lu dans `windows-0.62.2/Cargo.toml`).
- ✅ DirectComposition seul ne convient pas : pas de HostBackdropBrush dans cette API
  (<https://notes.yvt.jp/Desktop-Apps/Enabling-Backdrop-Blur/>).

**Variante « hébergement visuel » de WebView2** (`CoreWebView2CompositionController`) : la vue
web deviendrait elle-même un visuel de notre arbre, découpable par la même géométrie.
- ✅ wry 0.55.1 ne l'expose pas (aucune occurrence de `CompositionController` dans ses sources).
- ✅ Dans ce mode, l'app doit recevoir et retransmettre elle-même souris, tactile et stylet
  (<https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/windowed-vs-visual-hosting>),
  et des bugs d'entrée récents existent
  (<https://github.com/MicrosoftEdge/WebView2Feedback/issues/5695>).
- **Verdict** : écarté pour la 0.6. Il faudrait sortir de Tauri pour créer la vue. Inutile : la
  vue web reste une fenêtre enfant transparente, le verre est *dessous*.

### (d) Crates

| Crate | Version (Cargo.lock) | Ce qu'elle fait sous Windows | Limite pour nous |
|---|---|---|---|
| `window-vibrancy` | 0.6.0 | ✅ `apply_acrylic` : `DWMWA_SYSTEMBACKDROP_TYPE` si disponible, sinon `SetWindowCompositionAttribute` (lu : `src/windows.rs:61-92`). `apply_mica`, `apply_tabbed`, `apply_blur`. | Fenêtre entière, coins de Windows. Options (a) et (b). |
| Tauri `effects` (`setEffects`, `windowEffects`) | tauri 2.11.5 | ✅ Enveloppe de `window-vibrancy` ; fenêtre `transparent: true` exigée (<https://v2.tauri.app/reference/javascript/api/namespacewindow/>). | Idem. Déjà essayé (cadre gris). |
| `windows` | 0.62.2 | ✅ Toute la couche visuelle (voir (c)). | Pas de Win2D : un effet (saturation, bruit) demande d'implémenter `IGraphicsEffect` + `IGraphicsEffectD2D1Interop` à la main 🧠. Reporté. |
| `wry` / `tao` | 0.55.1 / 0.35.3 | ✅ Hébergement fenêtré, fond transparent. | Pas d'hébergement visuel. |

### (e) Ce que font les autres

| App | Technique | Source | Leçon |
|---|---|---|---|
| **Electron** (`backgroundMaterial`) | Matière DWM (`mica`, `acrylic`, `tabbed`), Windows 11 22H2+ ; coins via `roundedCorners` (22000+). | ✅ <https://www.electronjs.org/docs/latest/api/base-window> | Même option (a) : fenêtre entière, coins de Windows. |
| **Raycast pour Windows** | Coque native C# / .NET 8 / WPF autour de **WebView2** ; « acrylic blur-behind effects » coordonnés entre la coque et WebView2 ; ils ont dû éviter le flash blanc au démarrage et l'étranglement de la vue hors focus. | ✅ <https://www.raycast.com/blog/a-technical-deep-dive-into-the-new-raycast> | Même architecture que nous : matière native sous une vue web. Leur fenêtre est un rectangle fixe. |
| **Flow Launcher** | WPF + `DwmSetWindowAttribute` (`DWM_SYSTEMBACKDROP_TYPE`, `DWM_WINDOW_CORNER_PREFERENCE`) ; flou seulement sous Windows 11. | ✅ (résumé de la PR) <https://github.com/Flow-Launcher/Flow.Launcher/pull/3271> | Option (a). |
| **PowerToys Command Palette** | WinUI 3, fonds système Acrylic (défaut) / Mica / transparent, via les contrôleurs `DesktopAcrylicController` du Windows App SDK. | ✅ <https://learn.microsoft.com/en-us/windows/powertoys/command-palette/settings>, <https://learn.microsoft.com/en-us/windows/apps/develop/ui/system-backdrops> | Fenêtre entière aussi ; ces contrôleurs sont, en interne, le montage (c). |
| **Windows Terminal** | `AcrylicBrush` XAML (source `HostBackdrop` ou `Backdrop`). | ✅ partiel <https://github.com/microsoft/terminal/issues/10296> | C'est le montage (c) emballé par XAML : preuve qu'il tient en production. |
| **Files** | 🧠 WinUI 3 + Mica. Non revérifié aujourd'hui. | — | — |

Conclusion du tour d'horizon : **personne ne fait morpher une fenêtre Acrylic**. Tous peignent
une fenêtre rectangulaire fixe. Les seules surfaces floutées à forme libre de Windows (menus,
flyouts XAML) passent par le compositeur, option (c). C'est ce qu'il nous faut.

## Approche recommandée

### Schéma

```
écran
 └─ fenêtre overlay (Tauri, WebView2 transparent)      ← contenu : texte, icônes, liseré, ombre
 └─ fenêtre de fond « FlowTranslateBackdrop »          ← juste dessous, MÊME rectangle, immobile
      DesktopWindowTarget
       └─ ContainerVisual racine (taille = fenêtre)
            └─ ContainerVisual « verre »  (Clip = GeometricClip(RoundedRectangleGeometry))
                 ├─ SpriteVisual  brush = HostBackdropBrush        (le flou, fourni par Windows)
                 └─ SpriteVisual  brush = ColorBrush teinte + alpha (clair / sombre)
```

- **On garde** de `backdrop.rs` : la fenêtre à nous (popup, `WS_EX_NOREDIRECTIONBITMAP`, outil,
  jamais activée, « layered » et transparente à la souris, placée sous l'overlay), le masquage
  par `DWMWA_CLOAK`, `Conditions` / `fallback()` / l'injection de test, le compteur `generation`.
- **On retire** : `DWMWA_SYSTEMBACKDROP_TYPE`, `DWMWA_WINDOW_CORNER_PREFERENCE`,
  `DwmExtendFrameIntoClientArea`, le délai `SETTLE` de 800 ms, la règle CSS « coins 8 px ».
- **On ajoute** : `DWMWA_USE_HOSTBACKDROPBRUSH = TRUE`, l'arbre de visuels, les animations.
- **La fenêtre de fond ne bouge et ne change de taille que lorsque l'overlay le fait** (jamais
  pendant une animation : c'est déjà la règle de `move_overlay`). Les deux `SetWindowPos` se font
  dans un même lot (`BeginDeferWindowPos` / `DeferWindowPos` / `EndDeferWindowPos`).
- **Seuil Windows** : 22000 (Windows 11 21H2) au lieu de 22621. `FIRST_BUILD` passe à 22000.
- **Variante à essayer en premier jour (🧪, 2 h)** : poser le `DesktopWindowTarget` directement
  sur le HWND de l'overlay (`isTopmost = false` : visuels sous les fenêtres enfants 🧠), sous la
  vue web transparente. Si ça marche, plus de seconde fenêtre du tout (ni ordre Z, ni clics, ni
  cloak). Si le fond reste noir ou passe devant la vue web, on garde la fenêtre séparée, dont le
  placement est déjà mesuré.

### Teinte clair / sombre

Le pinceau de Windows donne le flou ; la matière « Porcelaine & lavande » vient de la couche de
teinte (une couleur + alpha par thème, reprises des tokens du labo). Changement de thème :
`ColorKeyFrameAnimation` sur `ColorBrush.Color`. Bruit et saturation de l'Acrylic complet :
plus tard, si Lucas le demande (demande un effet écrit à la main, voir (d)).

### Synchroniser la forme sans décalage

Principe : **une courbe, deux exécutants, un seul message.**

1. Aujourd'hui, la boîte `.ilot-shape` est animée par Motion en JS, image par image
   (`animateSurface`, `src/motion/surface.ts`). On ne peut pas recopier ça nativement à chaque
   image : l'IPC + le saut sur le thread principal + le commit DWM coûtent 1 à 3 images, avec du
   tremblement. C'est le « fond qui traîne ».
2. Les ressorts existent déjà sous forme de **courbes échantillonnées avec une durée** :
   `tokens.css.morph` (680 ms ou 775 ms, `linear(0, 0.0057 1.17%, …)`) et `tokens.css.enter`
   (`src/motion/tokens.ts`). Ces points *sont* des images clés.
3. Au `phase: 'start'` de `onShapeChange` (`MorphSurface.tsx`), le front appelle une commande
   `glass_morph` avec : rectangle de départ, rectangle d'arrivée (px CSS, relatifs à la fenêtre),
   rayons, identifiant de courbe (`morph` | `enter` | `exit` | `move` | `instant`), préréglage de
   mouvement, génération.
4. Rust crée une `Vector2KeyFrameAnimation` pour `Size`, une pour `Offset`, une pour
   `CornerRadius` : une image clé par point de la courbe, interpolation
   `CreateLinearEasingFunction`, `Duration` = la durée du token. `StartAnimation` sur la
   géométrie. Le compositeur fait le reste, sans nous.
5. Côté web, la boîte passe sur **la même courbe temporelle** (WAAPI / `animate` avec
   `duration` + `ease: linear(...)` du token) au lieu du ressort physique de Motion : les deux
   côtés suivent alors exactement les mêmes valeurs en fonction du temps.
6. Il reste un **déphasage au départ** (le temps que le message arrive) : 🧪 à mesurer, attendu
   entre 0 et 2 images. Trois parades, dans l'ordre :
   - le front démarre sa propre animation dans le `requestAnimationFrame` qui suit l'appel ;
   - un `DelayTime` ou un retard côté web, calibré une fois sur machine réelle ;
   - **si un liseré décalé se voit encore** : dessiner aussi le liseré nativement (un
     `ShapeVisual` avec une `CompositionSpriteShape` en trait, sur *la même géométrie*) : fond et
     bord deviennent le même objet, aucun écart possible. Le web ne garde que le contenu, centré
     et en fondu, où une image d'écart ne se voit pas. L'ombre, floue, tolère l'écart.
7. Autres mouvements, même mécanisme : entrée (opacité + échelle + glissement →
   `Opacity`, `Scale` avec `CenterPoint`, `Offset` du visuel « verre », courbe `enter`), sortie
   (170 / 150 ms, `CreateCubicBezierEasingFunction` avec la courbe `emilOut`), déplacement du
   coin (`animateCorner` → `Offset`), mouvement réduit (valeurs posées d'un coup, fondu seul).
8. **Interruption** (une forme change pendant un morph) : le front envoie un nouveau message dont
   le départ est la taille *mesurée à cet instant* ; `StartAnimation` remplace l'animation en
   cours. On perd la continuité de vitesse du ressort physique : à juger à l'œil 🧪.
9. Filet de sécurité : à `phase: 'end'`, le front envoie la forme finale ; Rust la pose telle
   quelle (`StopAnimation` + valeurs). Toute dérive est donc bornée à la durée d'un morph.

### Échelle de repli

| Situation | Détection | Rendu |
|---|---|---|
| Windows 11 ≥ 22000, transparence active | `Conditions` | **Verre réel** |
| Windows 11 < 22000, Windows 10 | build | Verre peint |
| « Effets de transparence » coupés | registre `EnableTransparency` (déjà lu) | Verre peint |
| Économiseur d'énergie | `GetSystemPowerStatus` (déjà lu) | Verre peint |
| Contraste élevé | `SPI_GETHIGHCONTRAST` (déjà lu) | Verre peint |
| Bureau à distance | `SM_REMOTESESSION` (déjà lu) | Verre peint |
| Erreur à n'importe quelle étape native | `Result` | Verre peint, une ligne de journal (sans texte utilisateur) |

- Les conditions sont relues à chaque apparition (déjà le cas). À ajouter : relire aussi sur
  `WM_SETTINGCHANGE`, `WM_POWERBROADCAST` et `WM_WTSSESSION_CHANGE`, pour basculer sans relancer.
- Le verre peint reste **le rendu par défaut du CSS** ; `data-backdrop="glass"` (posé une fois
  quand le verre réel est prêt, retiré au repli) enlève seulement le fond peint. Si Rust
  plante ou se tait, l'utilisateur voit le verre peint, jamais un trou.
- Sur Windows 10, le HostBackdrop Win32 exigerait l'API non documentée de l'option (b)
  (Win32Acrylic) : on ne le fait pas.

### Fenêtre de setup (verre dépoli, grande, quasi fixe)

Deux choix : (1) le même module avec une géométrie statique (rayon libre, même matière que
l'Îlot : cohérent) ; (2) l'option (a) via `effects: ["acrylic"]` de Tauri, plus simple mais coins
de 8 px et matière plate quand la fenêtre perd le focus. **Recommandé : (1)**, pour n'avoir
qu'une matière à régler ; (2) en secours si le planning serre.

## Pièges attendus

1. **Visuel noir** : attribut `DWMWA_USE_HOSTBACKDROPBRUSH` oublié, ou posé après la création de
   la cible. Le poser juste après `CreateWindowExW`.
2. **Fenêtre jamais active** 🧪 : avec la matière DWM, l'essai a dû forcer `WM_NCACTIVATE`.
   WinUI retombe sur une couleur unie pour une fenêtre inactive, mais c'est une règle de XAML,
   pas du compositeur. À vérifier : le HostBackdrop reste-t-il vivant sur notre fenêtre jamais
   activée ? Garder l'astuce `WM_NCACTIVATE` en place tant que ce n'est pas mesuré.
3. **« Layered » + cible de composition** 🧪 : la fenêtre de fond doit rester transparente à la
   souris (`WS_EX_LAYERED | WS_EX_TRANSPARENT`, mesuré avec la matière DWM). À re-mesurer avec
   un `DesktopWindowTarget`.
4. **Unités** : dans une cible Win32, le compositeur compte en pixels physiques. Multiplier
   rectangles et rayons par le facteur d'échelle de l'écran ; recalculer au changement d'écran.
5. **Thread** : `Compositor` exige une `DispatcherQueue` sur son thread
   (`CreateDispatcherQueueController`, `DQTYPE_THREAD_CURRENT`). Tout faire sur le thread
   principal (`run_on_main_thread`), comme `backdrop.rs` aujourd'hui ; une seule file par thread.
6. **Intensité du flou** imposée par Windows ; on peut seulement teinter par-dessus.
7. **Rayon 999** : borner `CornerRadius` à `min(largeur, hauteur) / 2` avant de l'envoyer.
8. **Cas extrêmes de Lucas** (raccourci martelé, Entrée par erreur, serveur muet) : chaque
   message porte la génération ; un message périmé est ignoré. Le verre natif est masqué par le
   même chemin que l'overlay (`backdrop::hide` est déjà appelé à chaque sortie) et un garde-fou
   le masque si l'overlay n'est plus visible. Aucun état natif ne doit pouvoir survivre à
   l'overlay : c'est le scénario « bulle coincée ».
9. **Jamais `SW_HIDE`** sur la fenêtre de fond tant que ce n'est pas re-mesuré (tauri#12854
   concernait la matière DWM) : continuer à masquer par cloak ou `Opacity = 0`.
10. **Captures** : seul `gdigrab` montre la matière (README des outils). Les captures Playwright
    de la page ne verront jamais le flou : normal.

## Plan d'implémentation

Chaque étape : modifier → capturer la vraie fenêtre → regarder → valider.

1. **Sonde** (hors app, 1 fichier d'exemple Rust) : fenêtre popup + `DWMWA_USE_HOSTBACKDROPBRUSH`
   + `CreateDispatcherQueueController` + `Compositor::new()` + `cast::<ICompositorDesktopInterop>()`
   + `CreateDesktopWindowTarget(hwnd, false)` + `SpriteVisual` au `CreateHostBackdropBrush()`.
   Critère : le fond est flouté et coloré par la page de bandes vives, pas noir. Tester ici la
   variante « sur le HWND de l'overlay », le piège 2 et le piège 3.
2. **Découpe** : `CreateRoundedRectangleGeometry()` → `CreateGeometricClipWithGeometry()` →
   `verre.SetClip()`. Critère : pilule de rayon 22 puis grille de rayon 16, bords lisses (zoom).
3. **Module** `src-tauri/src/glass.rs` (remplace l'intérieur `imp` de `backdrop.rs`, garde ses
   tests et son repli) : `create`, `place(rect fenêtre)`, `shape(rect, rayon)`,
   `morph(de, vers, courbe)`, `fade(in|out, courbe)`, `theme(dark)`, `conceal`. Features à
   ajouter à la crate `windows` : `UI_Composition`, `UI_Composition_Desktop`, `System`,
   `Foundation_Numerics`, `Win32_System_WinRT`, `Win32_System_WinRT_Composition`.
4. **Courbes partagées** : exporter les points de `tokens.css.*` dans le message (le front reste
   la seule source des courbes ; Rust ne les recopie pas). Images clés :
   `CreateVector2KeyFrameAnimation`, `InsertKeyFrame(t, valeur, CreateLinearEasingFunction())`,
   `SetDuration`, `geometry.StartAnimation("Size" | "Offset" | "CornerRadius", …)`.
5. **Front** : commande `glass_morph` appelée depuis `onShapeChange` (`start` et `end`) ; boîte
   web sur la même courbe temporelle ; `data-backdrop="glass"` ; règle CSS qui retire le fond
   peint *sans toucher au rayon*. Le réglage caché `glassMaterial` devient le défaut
   (`glass`), avec `painted` en choix de secours dans Apparence.
6. **Entrée, sortie, déplacement, thème, mouvement réduit** (point 7 de la synchronisation).
7. **Repli vivant** : messages système du tableau, bascule sans relance.
8. **Robustesse** : 50 cycles × 3, raccourci martelé, Échap en plein morph, serveur muet, clic
   ailleurs ; une seule fenêtre de fond à la fin, jamais de verre orphelin.
9. **Étendre** aux pilules, à la bulle et à la fenêtre de setup (même module).
10. **Passage GPU chez Lucas** : film à 60 i/s et à la fréquence native de son écran, réglage du
    déphasage (point 6 de la synchronisation), décision liseré natif ou non.

## Ce qui est validable ici, et ce qui ne l'est pas

La VM n'a pas de GPU : DWM compose en logiciel (WARP). L'essai a quand même mesuré une vraie
matière Acrylic ici (chroma 25 à 35), donc le flou de Windows *s'affiche* dans la VM.

| Validable dans la VM | À faire sur une machine avec GPU 🧪 |
|---|---|
| Le pinceau n'est pas noir, la teinte clair / sombre | Fluidité réelle (60 / 120 / 144 Hz) |
| Forme, rayon, bords lisses, alignement au pixel au repos | Déphasage web / natif pendant le morph |
| Géométrie image par image à cadence lente (film `gdigrab`) | Coût GPU et batterie |
| Clics traversants, ordre Z, absence d'Alt+Tab | Qualité visuelle du flou, HDR, multi-écran à DPI mixtes |
| 150 cycles, raccourci martelé, sorties d'erreur | Économiseur d'énergie et transparence coupée « en vrai » |
| Les cinq replis par injection (`FLOWTRANSLATE_ACRYLIC_FALLBACK`) | Bureau à distance réel, Windows 10 réel |

## Non vérifié dans cette recherche

- La page de référence de `CreateDesktopWindowTarget` (sens exact de `isTopmost`) n'a pas pu
  être relue (404) : sens donné de mémoire.
- Les chemins Rust exacts (`windows::Win32::System::WinRT::Composition::ICompositorDesktopInterop`,
  `windows::Win32::System::WinRT::CreateDispatcherQueueController`) : features confirmées dans
  le `Cargo.toml` de la crate, signatures non compilées.
- Le comportement du HostBackdrop sur une fenêtre jamais active, et avec `WS_EX_LAYERED`.
- Files, et le détail du code de PowerToys et de Windows Terminal (docs et tickets lus, pas le
  code).
- Rien n'a été exécuté : c'est une recherche. La sonde de l'étape 1 tranche les points 🧪 en une
  demi-journée.
