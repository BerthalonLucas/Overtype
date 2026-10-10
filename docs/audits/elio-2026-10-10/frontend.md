> **Pièce spécialisée initiale.** Les verdicts, regroupements et sévérités finaux sont dans [FINDINGS.md](FINDINGS.md) et [la synthèse](SYNTHESE.md). Ne pas additionner les totaux des spécialistes. Les chemins `preuves-locales/` et `artefacts-locaux/` désignent des preuves privées non jointes intégralement ; voir [VERIFICATION.md](VERIFICATION.md).

# Audit frontend Overtype

## Synthèse

Base **main `e202cd1f8831abc0f69435b9e2d0d96dd491e841`**, consultation du 10 octobre 2026. **5 constats : 3 P2, 2 P3 ; aucun P0/P1 démontré.** Priorités : retour du focus du dialogue, retour hors ordre des réglages, description des champs en erreur. La copie accessible et la duplication du noyau de persistance viennent ensuite.

**Pas de réécriture de la stack préconisée.** Radix, Motion, Lucide et cmdk fournissent effectivement les primitives attendues. La majorité du CSS maison décrit une matière et une géométrie spécifiques au produit ; ce n’est pas une réinvention de comportement de bibliothèque. La dette réellement superflue repérée concerne surtout deux implémentations de la même mécanique de sauvegarde, et non le dessin du verre.

Le scan axe des cinq états échantillonnés ne détecte aucune violation ; les reproductions ciblées détectent pourtant le focus perdu et la confirmation de copie masquée. **Conformité WCAG : non déterminée** (pas de lecteur d’écran Windows, ni campagne exhaustive). Aucun correctif ni modification du checkout partagé.

## Méthode et exigences

Guides Agency réellement lus : `engineering/engineering-frontend-developer.md` et `testing/testing-accessibility-auditor.md`. Utilisation : revue React/composition, état/effets, clavier et sémantique. Leurs slogans « guilty until proven innocent » et exigences mobile/PWA ne deviennent pas des critères produit : Overtype cible Windows 11. Aucun script Agency exécuté. Skill `code-review` consulté pour distinguer standard, spécification et jugement ; mission de spécialiste bornée, sans créer une nouvelle orchestration.

Autorités produit : `AGENTS.md:5-16`, `docs/UI-DECISIONS.md` lu intégralement, `docs/PLAN-0.6.md:295-338` en particulier. Les décisions Îlot/0.6 priment sur la marque graphite et les plans 0.5 historiques. L’historique d’introduction des symboles a été consulté avant de qualifier les défauts (notamment `git log -S`). Les interfaces natives ne sont pas modifiées.

## Résultats détaillés

### FE-01 — Le dialogue de copie manuelle du journal perd le focus à la fermeture

- **P2 · bug** · `main@e202cd1f8831abc0f69435b9e2d0d96dd491e841`
- **Preuve :** `src/components/controls.tsx:317-342` ; `src/connection/DiagnosticsPanel.tsx:88-95,129-132`.
- **Scénario / chemin :** Diagnostic → bouton Copier au clavier → refus du presse-papiers → dialogue de copie manuelle → Échap.
- **Fait observé :** Repro Chromium headless sur copie privée : navigator.clipboard.writeText refuse volontairement ; après Échap et fin de sortie, document.activeElement est BODY, pas le bouton Copier. Le wrapper contient Dialog.Root/Content/Close mais aucun Dialog.Trigger et aucune restauration onCloseAutoFocus. La version résolue Radix 1.1.23 empêche sa restauration générique et fait triggerRef.current?.focus().
- **Impact et limite :** Perte du point de reprise pour la navigation clavier ; l’utilisateur doit retrouver le bouton dans toute la fenêtre. Référence APG retour au déclencheur ; critère à vérifier WCAG 2.4.3 Focus Order.
- **Alternative établie :** Associer le déclencheur avec Dialog.Trigger asChild ou conserver le bouton actif avant ouverture et le refocaliser via Content.onCloseAutoFocus, après prévention du comportement par défaut. Ne pas remplacer Radix par un dialogue maison.
- **Coût / compromis :** Faible : étendre le wrapper et son appelant ; préserver les sorties AnimatePresence et tester Échap/croix/bouton Fermer.
- **Confiance :** élevée pour le défaut DOM reproduit ; NVDA/WebView2 non testés.

### FE-02 — Une lecture initiale tardive réadopte des réglages périmés

- **P2 · risque** · `main@e202cd1f8831abc0f69435b9e2d0d96dd491e841`
- **Preuve :** `src/settings/useSettingsStore.ts:64-85` ; `src/useTranslation.ts:60-63,152`, `src/setup/useSetupSettings.ts:42-58`.
- **Scénario / chemin :** La fenêtre Réglages charge getSettings ; pendant son retour IPC un settings-changed plus récent arrive (autre fenêtre/zone de notification), puis le snapshot initial ancien se résout.
- **Fait observé :** Repro hook réel sous React/jsdom : événement langue fr adopté, puis getSettings retardé langue en ; le rendu repasse de fr à en. reload() appelle then(adopt) sans vérifier une révision ou si un état a déjà été adopté. Le setup possède au contraire le garde !latest.current pour sa lecture initiale.
- **Impact et limite :** La copie périmée devient synced ; une modification ultérieure peut sauver la copie entière et rétablir une préférence récemment changée. Ordonnancement démontré localement, fréquence et trajet IPC Windows non mesurés.
- **Alternative établie :** Pour la lecture initiale, ne pas remplacer un état déjà reçu ; pour reload explicite, employer un ticket/révision invalidé par une édition ou un événement plus récent. Examiner aussi le chargement initial du contrôleur overlay.
- **Coût / compromis :** Faible à moyen : garde local ou compteur de génération + tests des retours hors ordre. Une bibliothèque de cache réseau ne fournit pas à elle seule le contrat IPC multi-fenêtres.
- **Confiance :** élevée pour la course du hook ; moyenne pour son occurrence native.

### FE-03 — Field ne relie pas les problèmes et aides au contrôle

- **P2 · risque** · `main@e202cd1f8831abc0f69435b9e2d0d96dd491e841`
- **Preuve :** `src/components/controls.tsx:224-235` ; `src/connection/ConnectionForm.tsx:78-103`, `src/settings/MenuGrid.tsx:61-69`.
- **Scénario / chemin :** Saisir une adresse non valide ou revenir au champ Modèle dont le modèle sauvegardé a disparu.
- **Fait observé :** Repro du wrapper Field + Input réel : label htmlFor fonctionne ; aria-invalid=null, aria-describedby=null et paragraphe role=alert sans id. ConnectionForm ne transmet pas non plus ces attributs aux champs. Les annonces role=alert existent mais ne créent aucune relation durable champ→erreur. Contre-exemple correct : MenuGrid utilise aria-invalid et aria-describedby avec id du problème.
- **Impact et limite :** En revenant au contrôle, une technologie d’assistance ne dispose pas de son erreur/aide dans sa description accessible ; risque sur WCAG 1.3.1 Info and Relationships et 3.3.1 Error Identification, non-conformité globale non déterminée.
- **Alternative établie :** Générer un id stable de description dans Field, exposer les attributs aux contrôles (props explicites ou contexte ciblé), relier hint/problem via aria-describedby et renseigner aria-invalid quand problem existe. Réutiliser le contrat de MenuGrid.
- **Coût / compromis :** Faible : changement de Field et de ses appels ; ne pas cloner arbitrairement des enfants complexes Radix. role=alert peut être conservé pour l’annonce initiale.
- **Confiance :** élevée pour la structure DOM ; impact lecteur d’écran à valider sur NVDA.

### FE-04 — La copie réussie du résultat ne change jamais son message de statut

- **P3 · bug** · `main@e202cd1f8831abc0f69435b9e2d0d96dd491e841`
- **Preuve :** `src/GlassOverlay.tsx:478-488,533-544`.
- **Scénario / chemin :** Afficher un résultat terminé puis activer Copier la traduction.
- **Fait observé :** Chromium sur lab-frame scenario=short : bouton data-copied=true (1 occurrence) mais .sr-only[role=status] reste « Translation complete ». À la ligne 544, phase complete && !replacing précède copied et reste vraie pendant toute la copie ; la branche glass.copied est donc masquée.
- **Impact et limite :** La coche purement décorative indique le succès visuellement, mais la région de statut ne fournit aucune confirmation de copie. Référence WCAG 4.1.3 Status Messages ; lecture vocale réelle non testée.
- **Alternative établie :** Faire prioriser copied devant complete ou utiliser une région de statut dédiée à la copie ; garder les noms et messages i18n existants.
- **Coût / compromis :** Très faible ; tester copie répétée et expiration de copied (1600 ms), sans annoncer le résultat en double.
- **Confiance :** élevée, repro navigateur et chemin conditionnel concordants.

### FE-05 — La mécanique de persistance des Réglages et de l’accueil est dupliquée

- **P3 · dette** · `main@e202cd1f8831abc0f69435b9e2d0d96dd491e841`
- **Preuve :** `src/settings/useSettingsStore.ts:47-85,91-143,169-175` ; `src/setup/useSetupSettings.ts:29-99`.
- **Scénario / chemin :** Faire évoluer la politique de sauvegarde différée, les échos settings-changed, flush ou la restauration d’un raccourci refusé.
- **Fait observé :** Les deux hooks possèdent latest/synced, inFlight, timer, file Promise, adoption conditionnée aux éditions, flush et rollback du raccourci. Ils diffèrent déjà sur le garde de chargement initial (FE-02) et le délai de frappe (300/400 ms). Ce dernier peut être intentionnel : il ne prouve pas un bug.
- **Impact et limite :** Toute correction de l’invariant de persistance doit être portée deux fois ; risque de divergence déjà visible. Il ne s’agit pas de reprocher useState/useRef ou de demander Redux.
- **Alternative établie :** Extraire seulement le noyau de sauvegarde séquentielle/adoption/flush dans un hook partagé, avec délai et validation configurables ; conserver dans les adaptateurs l’historique, les statuts UX, reset et les règles de raccourcis.
- **Coût / compromis :** Moyen : contrats comportementaux d’abord, refactorisation après les bugs. Aucune nouvelle dépendance requise ; ne pas uniformiser de force les différences produit.
- **Confiance :** élevée sur la duplication ; jugement de maintenabilité, pas défaut utilisateur supplémentaire.

## Primitives bien réutilisées, à conserver

| Domaine | Preuves | Jugement |
|---|---|---|
| Contrôles Réglages/setup | `components/controls.tsx:2-11,68-143,193-221,317-342` | Switch/Select/Slider/ToggleGroup/Popover/Dialog/Tooltip Radix, recherche cmdk. Styliser ces primitives est l’usage officiel. Le problème FE-01 est une composition incomplète, pas une raison de supprimer Radix. Le garde `if (next)` du ToggleGroup est celui documenté officiellement. |
| Navigation/scroll | `components/nav.tsx:14-17,49-63`, `components/scroll.tsx:16-50`, `ui.tsx:55-76` | Tabs manuels verticaux, focus Radix, ScrollArea et DropdownMenu réels. Observer taille/position et ajouter un voile d’arête n’est pas réécrire leur navigation. |
| Îlot spécifique | `menu/Ilot.tsx:168-192,216-250`, `menu/keys.ts:163-201` | Compact → grille → consigne, clés injectées par Rust et focus roving : une primitive DropdownMenu générique ne couvre pas ce contrat. IME/AltGr pris en compte ; aucun remplacement global recommandé. |
| Morphing | `menu/MorphSurface.tsx:48-82,99-106`, `motion/surface.ts:20-29` | `animate()` Motion, largeur/hauteur/rayon sans mise à l’échelle du texte, hit-test natif informé au début/fin. Couches sortantes `inert` et `aria-hidden` : bon usage, contrairement aux simples fades qui laissent des boutons accessibles. |
| Réduction de mouvement | `motion/MotionPreferences.tsx:9-34`, `motion/surface.ts:20-29`, `styles.css:33-34`, `halo/halo.css:120-129` | Le système relie configuration produit, Windows et CSS. MotionConfig ne contrôle pas toutes les dimensions/animations impératives ; ce code supplémentaire est justifié. |
| Lucide | `ui.tsx:15-35`, `components/controls.tsx:27,48-52` | Imports nommés et petit registre produit. `SpellCheck.displayName` vérifié sur la version réellement installée. Les IconButton de l’overlay et des réglages ont des matières/API différentes : ne pas les fusionner sur seule ressemblance. |
| Démo | `demo/Demo.tsx:10-29,33-55,100-112`, `demo/script.ts:3-14` | Réutilise Îlot, résultat et halo runtime ; horloge externe pour les quelques éléments continus, état React pour les cues. Le script temporel n’est pas un second moteur général d’animation. |
| Validation et focus locaux | `settings/MenuGrid.tsx:29-39,61-69`, `result/ResultPill.tsx:129-177` | Refocus après réordonnancement, erreurs associées, compte à rebours suspendu par hover/focus/busy. Bonnes briques à répliquer dans Field, pas à remplacer par une bibliothèque supplémentaire. |

### CSS maison et réinvention : décisions explicites

- **À garder** : jetons Porcelaine/Îlot, gradients du halo, masques d’encre, dimensions natives, silhouettes de verre, media queries et focus-visible. `docs/PLAN-0.6.md:299-306` demande justement ce portage sans HeroUI/Tailwind runtime. « shadcn-look » est un style ; le Slider utilise déjà Radix. Installer HeroUI ou Tailwind uniquement pour le remplacer ajouterait du coût sans fournir de comportement manquant.
- **À garder sous contrat** : `MiddleEllipsis` (`components/controls.tsx:145-172`) mesure au DOM une troncature au milieu qui conserve fin d’identifiant ; `text-overflow: ellipsis` standard coupe à la fin. ResizeObserver a son nettoyage. Pas de dette démontrée par sa seule existence.
- **Solveur de ressort** : `motion/spring.ts:63-132` est maison, mais `motion/tokens.ts:10-12` utilise des valeurs CSS pré-calculées ; le runtime animé utilise Motion (`motion/surface.ts:24-29`). Ce n’est pas un moteur JS concurrent exécuté à chaque frame. Les conversions et la génération servent au contrat visuel/test. Option non prioritaire : isoler les fonctions exclusivement de génération dans un outil dev ; pas de migration imposée ni de finding « réinventer Motion » sans équivalence de courbe démontrée.
- **À mutualiser** : seulement le noyau transactionnel des deux hooks de persistance (FE-05), en gardant leurs différences d’expérience et de validation. Ajouter Zustand/Redux ne résout pas une course de snapshots IPC ou une fusion multi-fenêtres.
- Les états `hot`, phases, refs de requête et observers ne sont pas par principe des anti-patterns : ils représentent l’interaction, les réponses IPC hors ordre et les mesures externes. L’ajustement conditionnel d’état pendant le rendu dans Ilot n’est pas interdit par React ; sa condition converge. Pas de recommandation générale de tout passer en effets ni de mémoriser tous les callbacks.

### Dépendances dans ce rôle

Déclaré et lockfile résolu concordent pour React/ReactDOM **19.2.8**, Motion **13.2.0**, Lucide **1.43.0**, cmdk **1.1.1**, Radix Dialog **1.1.23** et Tabs **1.1.21**. Installation locale lockfile réussie ; test ciblé et Chromium rendus sans pageerror. Ce n’est ni un audit de vulnérabilités ni une validation globale de compatibilité : aucun conseil de montée majeure « latest » sur cette seule base. Classification prod/dev/prototype complète laissée au rôle dépendances.

## Branches : couverture et équivalence

Les 35 refs ont été comparées à l’inventaire. Ancestry ne signifie pas lecture ligne par ligne de chaque snapshot. `git cherry` retrouve **quatre deltas frontend patch-équivalents** bien qu’ils ne soient pas ancêtres : `feat/frontend-primitives`, `feat/glass-frontend`, `feat/glass-material`, `release/frontend-0.1.5`. Les branches 0.5 WIP partagent le commit documentaire `2fbfdac` ; leurs listes énormes d’assets ne correspondent pas à autant de fonctionnalités perdues.

Les deltas propres ont été examinés de manière sélective : les sources citées ci-dessous, pas tous les bundles/assets. Aucun défaut d’ancienne branche n’est présenté comme un défaut de main. Aucune fusion globale des WIP préconisée.

| Branche (SHA figé) | Niveau / résultat frontend |
|---|---|
| `chore/ui-iteration-workbench` (`afec21d4d9faec4856cb106832ab0543444b8876`) | Ancêtre : contenu intégré dans l’historique de main ; pas revue distincte du snapshot ancien. |
| `claude/great-keller-6dwrqd` (`488eae22a879f19d51bac38c40479e2c0d18d765`) | Ancêtre : contenu intégré dans l’historique de main ; pas revue distincte du snapshot ancien. |
| `codex/multi-editor-replacement` (`86b3b23f217b4e26976815fca253397012a6cd4b`) | Delta GlassOverlay lu : conserve le message de refus natif ; comportement repris sur main:487-488. Le reste est natif, hors rôle. Ne pas confondre git cherry + avec fonction absente. |
| `da-ilot` (`26aaa399c12337ebd64b50c7b9e1ac022b6b449f`) | Ancêtre : contenu intégré dans l’historique de main ; pas revue distincte du snapshot ancien. |
| `design/glass-reader` (`7d67ab5c34ad78d5a6be8a4f20815f0848f076d3`) | Ancêtre : contenu intégré dans l’historique de main ; pas revue distincte du snapshot ancien. |
| `feat/actions-shortcuts-settings` (`3f2aee15710d31118a1b2e885f23d3866e11dff3`) | Ancêtre : contenu intégré dans l’historique de main ; pas revue distincte du snapshot ancien. |
| `feat/actions-that-work` (`e8df897a3b11dd285cc6e3b3d32eb07c9078a495`) | Ancêtre : contenu intégré dans l’historique de main ; pas revue distincte du snapshot ancien. |
| `feat/direct-capture` (`74aefa69027d48441d3428493a9ce4a8fab03385`) | Ancêtre : contenu intégré dans l’historique de main ; pas revue distincte du snapshot ancien. |
| `feat/frontend` (`d4681e439123f0b91e64734d14e8c67391eb5f85`) | Ancêtre : contenu intégré dans l’historique de main ; pas revue distincte du snapshot ancien. |
| `feat/frontend-primitives` (`b9d6eb42e8d1f8692bacc4bdce07ec0e525fd23b`) | git cherry − : commit équivalent intégré ; primitives Radix/Motion/Lucide présentes dans main. |
| `feat/glass-frontend` (`170f96f7e26da3c0b6a15909764a9da6c251d41a`) | git cherry − : commit équivalent intégré ; verre/lecture maintenant évolués sur main. |
| `feat/glass-material` (`058d348979239a401f619abfec09a75630a92ef5`) | git cherry − : commit équivalent intégré ; matière depuis remplacée par Îlot puis 0.6. |
| `feat/glass-native` (`f742599122bbeb5df9b542ca02457192ef0bd832`) | Aucun delta frontend identifié ; inventaire seul, propriétaire natif/server/docs. |
| `feat/glass-native-polish` (`02b1fe8d47f0322e3f580369b5de386a1f984828`) | Aucun delta frontend identifié ; inventaire seul, propriétaire natif/server/docs. |
| `feat/glass-reader` (`5005b026de73de235ea140f2dd1d8eb3f766e09e`) | Ancêtre : contenu intégré dans l’historique de main ; pas revue distincte du snapshot ancien. |
| `feat/native` (`0dc02bbf1bbdfcb2ebfedbfe121c48bacdc4d9ca`) | Ancêtre : contenu intégré dans l’historique de main ; pas revue distincte du snapshot ancien. |
| `feat/reading-band` (`a1d903190e8c65abfd502b1435fffb0a730c16a2`) | Ancêtre : contenu intégré dans l’historique de main ; pas revue distincte du snapshot ancien. |
| `feat/release-and-endpoints` (`83ebebb91f6c0d4c8a55556dff06c55e54c644cd`) | Ancêtre : contenu intégré dans l’historique de main ; pas revue distincte du snapshot ancien. |
| `feat/0.5.0-design-1.0` (`3ea09e6c2a2047b5c40133482dd0e151ee01db40`) | README design system et tokens inspectés : graphite jaune, français et ancien nom ; décisions remplacées par Îlot/Porcelaine/anglais. Assets/bundle de documentation, pas preuve de code runtime manquant. |
| `fix/compact-draggable-bubble` (`99a019d3a77eaf4ee15de354e09990e51d4a6bb5`) | Ancêtre : contenu intégré dans l’historique de main ; pas revue distincte du snapshot ancien. |
| `fix/native-window` (`28e2f0eac7a2a9bb662bdbe4b3716ad362ecff01`) | Aucun delta frontend identifié ; inventaire seul, propriétaire natif/server/docs. |
| `fix/scoped-drag` (`fcb5c0196468258f62c11bf6f96d730e04cb8bc8`) | Aucun delta frontend identifié ; inventaire seul, propriétaire natif/server/docs. |
| `fix-endpoint-tls` (`dd4b218be9b432b734853e841179ac9762318ec5`) | Ancêtre : contenu intégré dans l’historique de main ; pas revue distincte du snapshot ancien. |
| `main` (`e202cd1f8831abc0f69435b9e2d0d96dd491e841`) | Ancêtre : contenu intégré dans l’historique de main ; pas revue distincte du snapshot ancien. |
| `refonte-reglages` (`deb9f0d581e256a8f00e0fd65be6d6e89234ae50`) | Ancêtre : contenu intégré dans l’historique de main ; pas revue distincte du snapshot ancien. |
| `release/frontend-0.1.5` (`127fb7fb70b7c0cd830379855bfd7339597ed91e`) | git cherry − : commit équivalent intégré ; readiness/recovery ensuite refondus. |
| `release/guide-0.1.5` (`81f850333e7884b4497a6dd147ae00d1d409d54a`) | Aucun delta frontend identifié ; inventaire seul, propriétaire natif/server/docs. |
| `release/native-0.1.5` (`efe3abd5c9d73f9a748880e75a55cb4f9096d27b`) | Aucun delta frontend identifié ; inventaire seul, propriétaire natif/server/docs. |
| `release/server-0.1.5` (`8281476d4bcac7d74305532d26bd3cf2cf46c8da`) | Aucun delta frontend identifié ; inventaire seul, propriétaire natif/server/docs. |
| `release/0.1.5` (`2f83abc75f19a68c28eea6ee408265592bd08347`) | Ancêtre : contenu intégré dans l’historique de main ; pas revue distincte du snapshot ancien. |
| `wt-050-atelier` (`5b5f6a56962f59202d2ea127daf52cedf0439ba5`) | Delta frame lu : banc, thèmes et readiness de l’ancien portage ; labo actuel suit les composants Îlot. Pas de reprise automatique de classes/pages historiques. |
| `wt-050-marque` (`1e2c6097d66573e20e2a002b3d8ada1ceb1abcd8`) | Delta tokens inspecté et inventaire assets : ancienne marque graphite au surligneur. Pas audit des PNG ; aucune conclusion de fonctionnalité runtime manquante. |
| `wt-050-natif` (`1fcdd21f0aadd5a36978e47e6530b9fe9f1c74bd`) | Inventaire : frontend uniquement tokens et design-system commun historique ; commit propre principalement natif, laissé au spécialiste. |
| `wt-050-reglages` (`5da6010e2af1516c29bb1ff0e0281ef8f8778b6b`) | Deltas SettingsWindow/controls lus : navigation 4 pages, profils fast/quality, doubles primitives locales. Supplantés sur main par Tabs Radix, 8 pages et serveurs ; conserver au plus les idées/test scenarios compatibles, pas porter le WIP tel quel. |
| `wt-050-verre` (`c5345af95ec9fa6ac00cdea1444aba09cd4ba375`) | Deltas overlay-ipc/useTranslation/ui lus + chemin danger dans GlassOverlay : duplication de transport explicitement transitoire, icônes/alertes/ancien routing vers moteurs. Main utilise bridge.openSettings et codes de résultat. Équivalence de comportement partielle, pas patch-id ; contrat ancien incompatible. |

## Checks exécutés et artefacts

Copie privée : `artefacts-locaux/frontend-work/`. Lifecycle npm désactivé pour l’installation. Vite lancé seulement comme enfant borné du script navigateur, arrêté dans `finally`. Bridge de preview, aucun endpoint personnel ni inference. Le scénario de refus clipboard est une panne provoquée explicitement, pas une panne affirmée de Windows.

- `git status --short; git rev-parse HEAD; git log -S <symbols> -- <scoped files>` — exit **0** : HEAD main figé ; status vide avant/après ; historique des introductions consulté. Sortie outil, pas de log séparé.
- `git diff --name-only main...origin/<ref>; git cherry main origin/<ref> (18 refs non-ancêtres)` — exit **0** : 35 refs inventoriées ; 11 deltas frontend identifiés ; quatre branches frontend à patch équivalent. Log : `artefacts-locaux/frontend-work/branch-coverage.json`.
- `git archive HEAD | tar -x -C frontend-work; npm ci --ignore-scripts --no-audit --no-fund --prefix frontend-work` — exit **0** : 153 packages installés en privé ; aucun script lifecycle exécuté. Sortie outil, pas de log séparé.
- `npm install --no-save --ignore-scripts --no-audit --no-fund axe-core; chromium.launch({headless:true})` — exit **0** : 1 package axe ajouté en privé ; Chromium headless shell disponible et lancement OK. Sortie outil, pas de log séparé.
- `node audit-browser.mjs (premier essai)` — exit **1** : Timeout sur sélecteur de copie incorrect « Copy » ; corrigé dans le script de repro uniquement en « Copy translation ». Sortie outil, pas de log séparé.
- `node audit-browser.mjs (essai corrigé)` — exit **0** : 5 états Réglages scannés axe, aucune violation détectée ; focus fermeture dialogue BODY ; copie visuelle active mais statut Translation complete ; zéro pageerror. Log : `artefacts-locaux/frontend-work/audit-browser-result.json`.
- `npx vitest run src/frontend-audit.test.tsx --reporter=verbose` — exit **0** : 1 fichier / 2 tests ciblés réussis : course snapshot initial et attributs manquants de Field confirmés. Warning Vite sur futur configLoader native, pas échec courant. Aucune suite complète exécutée.. Log : `artefacts-locaux/frontend-work/audit-vitest.log`.

Les tests ponctuels affirment le **comportement observé défectueux** afin de documenter une repro (2 tests verts ne signifient pas deux bugs corrigés). Scripts privés : `audit-browser.mjs` et `src/frontend-audit.test.tsx` ; résultats `audit-browser-result.json`, `audit-vitest.log`, `audit-vite.log`, `branch-coverage.json`. Premier essai navigateur échoué pour un libellé mal sélectionné puis relancé avec succès ; pas masqué dans le bilan.

## Matrice des fichiers / limites

**53 chemins main examinés**, en totalité ou par régions ; ni exhaustivité ligne par ligne ni tous scénarios runtime.

| Périmètre | Profondeur |
|---|---|
| `components/{controls,nav,scroll,motion}.tsx/ts` | Sources lues ; contrôles/navigation observés dans Chromium ; CSS ciblé aux tokens/focus/reduced motion. |
| `settings/SettingsWindow.tsx`, `useSettingsStore.ts`, `MenuGrid.tsx`, pages Actions/Appearance/Data/CardChoice | Lecture de la logique/UI ; état initial des 5 pages scanné. ShortcutRecorder/InlineConfirm lus, pas campagne complète de recorder/confirmation. |
| `connection/ConnectionForm.tsx`, `DiagnosticsPanel.tsx`, `Check.tsx` | Formulaire et dialogue lus ; hook de sonde partie initiale jusqu’à ~180 ; dialogue clipboard exercé. Aucun accès serveur réel. |
| `menu/{Ilot,keys,MorphSurface}`, `motion/{spring,surface,MotionPreferences,tokens}`, `ui.tsx` | Lecture ciblée approfondie ; API des primitives comparées aux docs et au paquet Radix résolu. |
| `GlassOverlay.tsx`, `App.tsx`, `main.tsx`, `useSettings.ts`, `useTranslation.ts` | Verre et bootstrap lus ; contrôleur IPC partiellement lu, pas audit complet de son transport. Repro copie via preview. |
| `setup/{SetupWindow,useSetupSettings}`, `demo/{Demo,script}`, `halo/HaloWindow`, `result/ResultPill` | Premières sections/hooks et contrats examinés ; pas chaque branche de la longue démo/setup ; halo purement décoratif. |
| `src/lab/frame.tsx`, `bridge.mock.ts` | Contrôle que la preuve passe par composants réels et mock local ; pas preuve du runtime natif. |
| `styles.css`, `glass.css`, `settings/settings.css`, `components/*css`, `halo/halo.css`, `result/result.css` | CSS complet ou excerpts/cherche ciblée selon taille ; pas simulation complète Windows contraste/transparence/DPI. |
| Docs produit + inventaire branches | Autorités courantes et deltas comparés ; anciens design systems classés historiques. |

- Audit de code et échantillons, pas lecture exhaustive ligne par ligne de tous les fichiers.
- Windows 11 / Tauri / WebView2 / NVDA-JAWS / UI Automation non exécutés sur cette VM Linux.
- Axe Chromium : uniquement états initiaux anglais à 1000x800, mouvement réduit, pages general/server (cartes repliées)/appearance/actions (éditeurs repliés)/data (vide). Zéro violation ne vaut pas conformité WCAG.
- Pas de campagne manuelle lecteur d’écran, zoom 200/400 %, forced-colors, DPI multi-écrans, performance GPU ou bundle effectuée.
- Historique des branches examiné par ancestry/patch-id et deltas sélectionnés ; pas de build ni exécution des anciennes branches.
- Le rôle QA garde les suites complètes. Deux repros unitaires et un script navigateur bornés uniquement dans copie privée.
- Prototypes design-lab et anciens bundles docs/design-system distingués de production ; pas d’audit ligne par ligne de leurs dépendances ni des assets binaires.

## Sources officielles consultées

- [https://www.radix-ui.com/primitives/docs/components/dialog](https://www.radix-ui.com/primitives/docs/components/dialog) — Focus modal, Trigger, onCloseAutoFocus et composition officielle ; consulté le 2026-10-10.
- [https://www.radix-ui.com/primitives/docs/components/toggle-group](https://www.radix-ui.com/primitives/docs/components/toggle-group) — Roving focus et maintien d’une valeur par onValueChange conditionnel ; consulté le 2026-10-10.
- [https://motion.dev/docs/react-accessibility](https://motion.dev/docs/react-accessibility) — MotionConfig ignore transforms/layout, pas toutes propriétés ni impératif ; consulté le 2026-10-10.
- [https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) — Retour au déclencheur après fermeture ; consulté le 2026-10-10.
- [https://www.w3.org/WAI/tutorials/forms/notifications/](https://www.w3.org/WAI/tutorials/forms/notifications/) — Erreurs liées via aria-describedby et aria-invalid ; consulté le 2026-10-10.
- [https://react.dev/learn/you-might-not-need-an-effect](https://react.dev/learn/you-might-not-need-an-effect) — Effets pour synchronisation externe ; ajustement conditionnel pendant rendu non interdit ; consulté le 2026-10-10.

## Fichiers créés/modifiés

- Livrables : `preuves-locales/frontend.md`, `preuves-locales/frontend.json`.
- Repros/installation/logs exclusivement dans la copie scratch `frontend-work/` ; aucun fichier du repo partagé modifié. HEAD et status partagé vérifiés inchangés.
- Aucun commit, push, issue, PR, configuration, mémoire ou skill modifié.
