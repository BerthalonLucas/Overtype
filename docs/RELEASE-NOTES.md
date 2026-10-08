# Overtype 0.6.2 — la mise à jour depuis l’app — 8 octobre 2026

- **Plus besoin de réinstaller.** Réglages › Général › À propos : « Vérifier les mises à jour » interroge GitHub, et quand une version plus récente existe, le bouton « Mettre à jour vers x.y.z » s’allume (et un point sur « Général » dans la barre latérale). Un clic : téléchargement, vérification de la signature, installation en mode passif, puis l’app redémarre dans la nouvelle version. Les réglages, les clés et l’historique ne bougent pas.
- **Vérifié tout seul.** Au démarrage, puis toutes les six heures. Rien d’autre ne part vers GitHub qu’une demande du fichier de version.
- **Signé.** Chaque installateur publié est signé ; l’app refuse un fichier dont la signature ne correspond pas à sa clé.

À savoir : cette version s’installe encore à la main (la 0.6.1 ne sait pas se mettre à jour). Les suivantes arriveront par le bouton.

# Overtype 0.6.1 — des textes longs — 8 octobre 2026

- **200 000 caractères au lieu de 6 000.** Une sélection ou une copie peut aller jusqu’à 200 000 caractères : de quoi tenir dans un contexte de 131k tokens, le texte puis sa réécriture. Au-delà, la pilule « Sélection trop longue » reste.
- **Plus de plafond sur la réponse.** La requête n’impose plus 4 096 tokens en sortie : le serveur écrit jusqu’au bout du contexte qui lui reste. Une longue réécriture n’est plus refusée comme « incomplète ».
- **Plus de limite de deux minutes.** L’attente n’est plus bornée au total mais au silence : la requête échoue seulement si le serveur ne renvoie rien pendant 120 s (lecture du texte avant le premier mot, ou entre deux mots). Un long texte s’écrit aussi longtemps qu’il le faut.

À savoir : le contexte du serveur doit suivre. Un modèle lancé avec 8k de contexte refusera un long texte (erreur du serveur).

Validation : `cargo test` (inférence, capture, probe) et Vitest. Pas encore de passage réel sur un texte de 200 000 caractères.
# Overtype 0.6.0 — un nouveau nom, de nouveaux Réglages, un accueil, un serveur — 2 octobre 2026

- **FlowTranslate devient Overtype.** Le nom change partout : fenêtres, zone de notification, installateur (`Overtype_0.6.0_x64-setup.exe`), exécutable (`Overtype.exe`), raccourcis. Rien n’est perdu : les réglages, les clés protégées par Windows et l’historique restent dans le même dossier (`%APPDATA%\com.flowtranslate.desktop`). Installé par-dessus une 0.5, l’installateur retire FlowTranslate (dossier, raccourcis, entrée de « Applications installées ») sans toucher aux données, et le lancement à l’ouverture de session suit vers `Overtype.exe`.
- **Réglages refaits.** Une fenêtre mate, une barre latérale fixe avec recherche, une page par sujet (Général, Raccourcis, Actions, Après remplacement, Apparence, Serveur, Données), une couleur par page et une pastille qui glisse vers la page choisie. Les contrôles sont ceux du labo : interrupteur à ressort, sélecteur de modèle avec recherche, curseur, barre de défilement fine.
- **Premier lancement.** Une fenêtre en verre dépoli : bienvenue, trois questions (apparence, raccourci, modèle), une démo de vingt secondes jouée par les vrais composants, phase par phase, puis « C’est prêt » et les Réglages. Chaque réponse est enregistrée aussitôt. « Revoir l’accueil » est dans Général. Une installation déjà réglée ne revoit pas l’accueil.
- **Un serveur, une adresse.** Plus de profils « Rapide » et « Qualité » : un serveur par défaut, « Ajouter un serveur » pour un second, et le choix de celui qu’utilisent le menu et les raccourcis. On ne donne que l’adresse (« /v1 » est retiré tout seul), la clé ou « Mon serveur n’a pas de clé » ; les modèles sont lus sur le serveur, ceux qui ne réécrivent pas de texte (embeddings) sont écartés. `http://` est accepté pour toute machine, avec l’avertissement « Connexion non chiffrée ». Les deux profils d’une 0.5 deviennent deux serveurs ; l’ancien fichier est gardé en `.bak`.
- **La connexion se voit.** La vérification part de ce qui est tapé et s’affiche étape par étape (Adresse, Connexion, Clé, Modèles), puis se replie en une ligne « Connecté · modèle · durée ». Un échec reste ouvert sur son étape, avec la cause, le geste à faire et « Voir le journal ». « Essayer avec une phrase » envoie une phrase fixe et demande une réponse directe, sans réflexion, comme une vraie réécriture.
- **Diagnostic.** Une page cachée (Ctrl+Maj+M, ou cinq clics sur la version) : le journal des connexions, avec l’heure, l’étape, la requête sans la clé, le statut, la durée et la cause. Jamais de texte ni de clé entière.
- **Mots changés.** « Encre irisée » par défaut : le texte lui-même s’éclaire, sans case. « Éclat » en alternative dans Après remplacement.
- **Vrai verre.** L’Îlot, les pilules, la bulle et la fenêtre d’accueil floutent ce qui est derrière eux quand Windows le permet ; sinon, la matière peinte opaque.
- **Robustesse.** Un raccourci martelé reste un seul geste ; Échap ferme la bulle devant n’importe quelle fenêtre ; une requête muette finit en pilule d’erreur ; « Fermer la bulle » dans la zone de notification ; le presse-papiers est toujours rendu après une copie synthétique ; une copie marquée sensible par son application (gestionnaire de mots de passe) n’est jamais lue ni envoyée ; un PDF, un texte en lecture seule et une fenêtre administrateur sont dits tels quels.

Corrigé pendant l’intégration, dans la vraie fenêtre : les Réglages cachés vérifiaient le serveur en double pendant l’accueil (chaque ligne du journal apparaissait deux fois) ; Ctrl+Maj+M ne suivait pas la lettre M sur un clavier AZERTY ; « Essayer avec une phrase » répondait « Réponse vide » avec un modèle qui réfléchit par défaut ; le champ de la clé montrait deux yeux ; les petites lignes de l’accueil devenaient illisibles sur un fond très clair ou très sombre.

À savoir : la commande `check_connection` de la 0.5 n’existe plus. Sur un texte d’une autre application, les mots changés ont une lueur douce ; les lettres recolorées se voient surtout dans la démo.

Validation : `cargo test`, Vitest, Playwright et la suite visuelle ; dans la vraie fenêtre, sur un profil jetable et des serveurs factices locaux : accueil complet (port fermé, 404, 401, serveur lent, serveur qui marche), démo, Réglages page par page, second serveur, serveur par défaut, Diagnostic ; l’Îlot sur le Bloc-notes en inférence simulée (menu, travail, mots changés, pilule, Annuler) ; puis un passage réel sur un serveur de modèles local (liste des modèles, phrase d’essai en 0,9 s, réécriture en 1,1 s, sans réflexion affichée).
# FlowTranslate 0.5.1 — un serveur derrière le pare-feu de l’entreprise — 25 septembre 2026

- **Certificats d’entreprise reconnus.** La connexion au serveur passe par la pile TLS de Windows (schannel) : un certificat émis par l’autorité de l’entreprise, ou réécrit par l’inspection TLS d’un pare-feu, est accepté dès que Windows l’accepte, comme dans le navigateur. En 0.5.0, seules les autorités publiques l’étaient, et un tel serveur restait « injoignable ».
- **« Injoignable » dit pourquoi.** Le message de « Check » (Réglages › Connection) nomme la cause : certificat refusé par Windows, connexion sécurisée impossible, nom introuvable, rien n’écoute à l’adresse, réseau ou pare-feu, connexion qui ne s’ouvre pas à temps ou qui est coupée. Seul l’hôte y figure, jamais le chemin ni la clé.
- **« Check » vérifie ce qui est écrit.** Une adresse tapée juste avant est enregistrée d’abord ; une modification refusée (un serveur distant en HTTP, par exemple) est signalée, au lieu de vérifier l’ancienne adresse.

À savoir : le proxy configuré dans Windows n’est toujours pas utilisé ; un serveur que seul le proxy de l’entreprise atteint reste injoignable, et le message l’indique (« pare-feu ou proxy ? »).

Validation : `cargo test` (causes lues dans les codes de Windows, port fermé, nom en `.invalid`, serveur qui ne parle pas TLS) ; à la main sur le poste de développement, des certificats réels : autosigné, racine non approuvée, expiré et mauvais nom refusés avec leur cause, certificat public accepté ; Vitest et Playwright (« Check » enregistre d’abord, un refus est signalé). Pas encore vérifié derrière le pare-feu de l’entreprise.

# FlowTranslate 0.5.0 — l’Îlot, un menu à côté de la sélection — 25 septembre 2026

- **Un raccourci, un menu.** `Ctrl+Alt+Espace` ouvre l’Îlot juste sous le texte sélectionné, au-dessus s’il manque la place en bas. Au repos, il ne montre que la dernière action utilisée dans cette application et une pastille ✦ ; Tab, ↓ ou la souris posée sur la ✦ déplie une grille de six tuiles, à droite de la bulle quand l’écran en a la place : Fix grammar, Translate (français → anglais, le reste → français), Make professional, Shorten, Write email et Ask. Entrée relance la dernière action, une lettre lance la sienne (F, T, P, S, E), les flèches parcourent la grille, Échap revient d’un cran puis ferme. Deux appuis rapides relancent la dernière action sans passer par le menu.
- **Consigne libre.** Espace, « / », la pastille ✦ ou une lettre sans action ouvrent un champ : on écrit ce qu’on veut (« plus sympa, prêt à envoyer »), le texte est réécrit selon la consigne. La consigne n’est ni enregistrée, ni journalisée.
- **Le texte mis en valeur.** Là où l’application expose sa sélection, l’Îlot la montre dès le menu, à trois niveaux : la zone de texte cernée, les lignes entières en bandes pâles, le texte exact sous un calque. Pendant le travail, le menu se change en une petite pilule avec un orbe (Perle, Nébuleuse ou Ruban), une aurore tourne autour de la zone de texte et un reflet passe sur les lettres, sans jamais intercepter un clic. Le résultat remplace la sélection : une vague de lumière parcourt le nouveau texte, la pilule se pose dessous sans jamais le couvrir, trace une coche et offre Annuler (8 s par défaut, en pause sous la souris), qui rend l’original. Les mots changés gardent une lueur irisée jusqu’à la prochaine action dans le texte (touche, clic, molette), une minute au plus (réglable), qu’Annuler soit offert ou non. Chaque effet prend sa version claire ou sombre d’après la couleur lue sous le texte, sans rien en garder.
- **Des erreurs claires.** Une pilule courte, dans la langue de l’interface, avec un seul bouton utile : ouvrir le bon champ des Réglages (adresse, clé, modèle, mis en évidence), réessayer, ou copier le résultat quand le collage a été refusé. Rien n’est jamais remplacé à moitié ; ni le texte, ni la réponse du serveur ne s’y affichent.
- **Nouvelle matière.** Verre clair ou sombre qui suit le thème de Windows (ou forcé dans les Réglages), icônes Lucide fines, mouvements à ressort « Fluide » ou « Rebondi ». Animations : suivre Windows, toujours, ou réduites (fondus courts seulement).
- **Interface en anglais, bascule en français.** L’Îlot, les pilules, les Réglages et le menu de l’icône de notification changent de langue sans relance. Les erreurs affichées dans le verre des raccourcis directs restent en français. Les noms des actions ne sont jamais traduits ni renommés.
- **Réglages refaits.** Sections Menu (raccourci, action par défaut), Actions (ordre de la grille, lettres), Après remplacement (coche, Annuler et sa durée, méthode d’annulation, mots changés et leur durée, place de la pilule) et Apparence (langue, thème, indicateur, animations). Un raccourci déjà pris par une autre application est signalé sous sa ligne, et le menu en propose un libre à prendre d’un clic ; « Rétablir les réglages par défaut » (Sur cet appareil) remet tout comme à l’installation, sauf la connexion, l’historique, la langue et le lancement à l’ouverture de session ; une combinaison `Ctrl+Alt+lettre` qui empêcherait de taper un caractère AltGr (`€` sur AZERTY) est signalée à l’enregistrement.
- **Mise à jour depuis la 0.4.** Ce que la 0.4 avait livré et que personne n’a modifié laisse la place à la 0.5.0 : « Corriger » et « Professionnaliser » deviennent Fix grammar et Make professional, les deux traductions et `Ctrl+Alt+T` s’en vont, sauf si un raccourci gardé ou l’action par défaut choisie s’en sert encore. Ce que vous avez modifié ou créé est gardé tel quel. Le raccourci du menu est ajouté s’il est libre ; les raccourcis directs gardés continuent de marcher, avec la nouvelle pilule. L’interface passe en anglais : Réglages › Appearance › Language pour revenir au français.

À savoir : `Ctrl+Alt+Espace` peut déjà être tenu par une autre application ; FlowTranslate ouvre alors ses Réglages au démarrage, le dit sous le raccourci du menu et propose un raccourci libre (`Ctrl+Alt+Maj+Espace` d’abord) à prendre d’un clic. Dans VS Code, sans sélection lisible par UI Automation, l’Îlot s’ouvre en bas de l’écran, sans mise en valeur du texte.

Validation : `cargo test` (capture à trois niveaux, couleur lue sous le texte, fin des mots changés à la touche, au clic ou à la molette, migration depuis la 0.4, réinitialisation), Vitest et Playwright (chaque phase du halo et sa forme réduite, Annuler, Réglages), relancés par GitHub Actions ; sonde native sur l’exe release, en clair et en sombre. En vraie fenêtre, inférence simulée, dans Chrome en clair et en sombre : halo du menu et du travail, vague, lueur irisée gardée après le départ de la pilule puis effacée à la touche, au clic, à la molette et au bout de sa durée ; Annuler et mots changés ; 150 ouvertures du menu sur 150 sans fermeture intempestive ; erreur d’un serveur réellement éteint ; migration d’une 0.4 et « Rétablir les réglages par défaut ». Aucune nouvelle mesure d’inférence réelle n’est revendiquée : Lucas a essayé l’installateur de la CI avec le serveur General le 24/09, avant la mise en valeur du texte.

# FlowTranslate 0.4.0 — chaque action marche vraiment — 15 septembre 2026

- **Remplacement partout.** « Remplacer la sélection » colle le résultat à la place du texte sélectionné dans n’importe quel champ (navigateurs, mails, Word, VS Code, Bloc-notes…) : le résultat passe par le presse-papiers, une seule corde Ctrl+V est envoyée dans la sélection d’origine, le presse-papiers est remis en place (jamais par-dessus une copie plus récente). La relecture du champ est une preuve en bonus, plus une condition. Refus seulement pour une console, un champ mot de passe, une copie faite soi-même (aucune sélection garantie) ou une fenêtre qui a changé ; le résultat reste alors dans la bulle avec Copier. Plus d’`EM_REPLACESEL`.
- **Pilule seule en mode Remplacer.** Le verre ne s’ouvre plus : la pilule tourne, le résultat est collé, la pilule montre ✓ puis s’efface. Le verre n’apparaît qu’en cas d’échec du collage, avec la raison.
- **Consignes pour petits modèles.** Le prompt est la consigne seule, envoyée en message `system`, le texte sélectionné en message `user` ; plus de `{{text}}` ni de `{{targetLanguage}}` (les anciennes consignes sont migrées). Quatre actions par défaut : Traduire en français, Traduire en anglais, Corriger, Professionnaliser, avec les mêmes règles de sortie. Réflexion coupée (`chat_template_kwargs.enable_thinking = false`, retiré si le serveur le refuse), bloc de pensée et bloc de code englobant retirés de la réponse, échantillonnage prudent (température 0,3, top_p 0,9).
- **La langue vit dans la consigne.** Le réglage « Langue cible » disparaît ; l’historique et la capsule montrent le nom de l’action.
- **Serveur : profil `general`.** Gemma 4 12B QAT (w4a16, Apache-2.0) avec décodage spéculatif MTP sur `http://127.0.0.1:8003/v1`, modèle `flowtranslate-general` : un modèle généraliste qui corrige, reformule et traduit, à mettre dans Rapide ou Qualité.
- Correctif : la fenêtre Réglages cachée pouvait bloquer une capture au démarrage (« Fermez les réglages ») ; seule la fenêtre visible le fait.

Validation : `cargo test` (collage, relecture, garde du presse-papiers, migration, historique), Vitest, Playwright (pilule seule → ✓ → fermeture, repli, garde-fou 3 s, Réglages sans langue), probe natif, matrice réelle consignée dans `docs/UI-ISSUES.md` (UI-026).

# FlowTranslate 0.3.0 — Actions et raccourcis — 15 septembre 2026

- Réglages redimensionnables (minimum 460 × 420), défilement dédié et prompts dans des volets dépliables.
- Actions Traduire, Corriger et Professionnaliser modifiables, avec jusqu’à 24 actions personnelles. Chaque prompt contient une fois `{{text}}` et peut utiliser `{{targetLanguage}}`.
- Jusqu’à 12 raccourcis : action, activation et destination (bulle ou remplacement de la sélection). Enregistrement au clavier, lettres AZERTY prises en compte, erreurs immédiates pour les touches refusées et les conflits détectés par Windows.
- Remplacement automatique après réponse complète seulement : contrôle de la fenêtre, du champ, de la sélection et du document. Une annulation, une fermeture, une nouvelle capture ou une relance invalide l’ancienne livraison. Sans cible compatible, la réponse reste dans la bulle.
- Migration de l’ancien raccourci sans perdre les profils et clés DPAPI. Une ancienne combinaison désormais réservée reste visible mais désactivée pour pouvoir la modifier.
- Correction de la compilation des tests d’inférence Windows après le passage aux prompts personnalisables.

Le remplacement vérifiable reste limité aux contrôles natifs Edit/RichEdit compatibles. Les champs web, Word, Outlook et Teams ne sont pas garantis : la bulle et Copier restent le repli prévu. Les profils Hy-MT existants sont spécialisés en traduction ; la correction et la reformulation demandent un modèle capable de suivre ces instructions, configurable dans Connexion.

Validation : tests unitaires frontend, tests navigateur et tests Rust Windows via GitHub Actions. Aucun nouveau benchmark d’inférence réelle ni recette manuelle exhaustive des applications bureautiques n’est revendiqué pour cette version.

# 0.2.1 — plus de saut avant la bande, release GitHub, tout moteur OpenAI

La pilule d’attente ne se pose plus près de la sélection pour filer en bas une demi-seconde
plus tard : l’emplacement est décidé dès la capture, sur le texte sélectionné. Une sélection
de plus de huit lignes attend directement en bas au centre et la bande y naît sans bouger ;
seule une sélection courte traduite long se déplace encore. Quand la bande prend l’écran de
la souris et que ce n’est pas celui de la sélection, la bulle reçoit aussitôt la zone de
travail du bon écran.

L’installateur Windows est publié dans les releases GitHub avec son SHA-256 (workflow
« Release », sur tag `v<version>` ou à la main). Le README explique l’installation, le
serveur livré et le branchement de n’importe quel moteur compatible OpenAI ; la page
`docs/ENDPOINTS.md` donne la requête exacte, ce qui est attendu en retour et les réglages
pour vLLM, llama.cpp, LM Studio, Ollama et les services en ligne. Un serveur qui refuse
`top_k` ou `repetition_penalty` (API OpenAI stricte) reçoit la requête une seconde fois sans
ces champs, sans rien configurer.

# 0.2.0 — lecture calibrée : deux formes, un temps de lecture, la bande suit la souris

Plus d’anneau ni de grande fenêtre vide pendant l’attente : une pilule de 60 × 28 avec
un spinner net (celui de shadcn), au coin de l’endroit où le verre va s’ouvrir. Le résultat arrivé,
la forme est décidée une fois sur le vrai texte : jusqu’à huit lignes, un verre court
(380 px, 16/24) se déplie depuis la pilule à côté de la sélection ; au-delà, une bande de
lecture se pose en bas au centre de l’écran, large de la moitié de la zone de travail et
haute d’au plus 45 %, en 22/33, avec défilement. Plus de « Agrandir », plus d’onglet, plus
de repli.

La bulle s’efface d’elle-même au bout du temps de lecture estimé (350 ms par mot, entre
5 s et 30 s pour un verre court, 90 s pour la bande), puis s’assombrit et fond ; quand la
souris l’a visitée puis la quitte, elle part en quatre secondes au plus. Un clic, la
molette ou une touche la retiennent ; l’épingle de la bande la garde. Les Réglages
proposent « Taille du texte » (Normale, Grande, Très grande) et « Fermeture automatique »
(Rapide, Normale, Lente, Jamais).

La bande apparaît sur l’écran où est la souris et la suit d’un écran à l’autre ; un verre
court reste près de sa sélection. Typographie plus fine (`#e8eaef`, un seul graphite pour
verre, pilule et menu).

# 0.1.8 — capture directe : plus de Ctrl+C, plus de boîte de dialogue

Le raccourci suffit : sans sélection lisible par UI Automation (Teams, Discord, Word,
VS Code…), FlowTranslate copie lui-même la sélection (Ctrl+Insert synthétique une fois
le raccourci relâché, jamais SIGINT dans un terminal), la traduit et remet le
presse-papiers tel qu’il était, sans alimenter Win+V. Une copie faite soi-même moins de
trois secondes avant reste traduite. Un ancien contenu non texte du presse-papiers
(image, fichiers) n’est pas restauré.

La fenêtre s’ouvre dès que le texte est connu ; le contrôle natif est lu ensuite et
« Remplacer » n’apparaît qu’une fois vérifié. Quand il n’y a rien à traduire, une petite
pilule en bas de l’écran de la souris le dit et s’efface en quatre secondes : plus de
boîte de dialogue à fermer. L’icône de notification propose « Revoir la dernière
traduction » pendant dix minutes.

# 0.1.7 — fluidité : plus de bandeau, fenêtre réservée, délai de grâce

Plus de barre de titre « FlowTranslate » peinte sur la bulle quand une autre fenêtre
prend ou rend le focus : le HWND est sous-classé et `WM_NCACTIVATE` n’a plus le droit
de repeindre (cause établie et reproduite dans `release/ui-evidence/band-repro/`).

La fenêtre native est réservée une fois pour toutes : 484 × 758 px ancrée en bas (menu
au-dessus de la pilule, verre agrandi, onglet), au moins 334 px ancrée au texte (menu
sous la pilule). Le repli en onglet, le dépli, le menu et l’arrivée d’un résultat
compact ne redimensionnent plus rien : seules les surfaces cliquables changent. Le
corps du verre reste monté et se replie en fondu ; l’onglet ne bouge jamais.

Après une action (Agrandir, Original, copie, clic), le verre reste ouvert au moins
deux secondes ; la sortie du pointeur est jugée à 32 px autour du verre et de sa
pilule, mesurée nativement par le sondeur du curseur.

Anneau d’attente à 1,4 s par tour avec un arc qui respire. Les chemins, URL et
identifiants se coupent après leurs séparateurs, jamais au milieu d’un mot ; 22 px
entre le texte et le bord arrondi. Menu dans le graphite du verre, survol fondu ;
original à 14 px sur fond clair.

# 0.1.6 — onglet, bords lissés, attente en anneau

La bulle se replie en un onglet de 44 × 20 px au bord bas de l’écran quand la
souris la quitte (ou après 10 s sans visite) ; le survoler la rouvre, le × ou
**Fermer** la ferme. `Ctrl+Alt+T` traduit aussitôt la sélection courante, presse-
papiers compris, sans confirmation ; la fenêtre capsule n’est plus affichée.

Plus de matériau DWM ni de région Win32 : le verre se peint lui-même, Chromium
dessine les coins et les ombres avec l’alpha par pixel, et le hit-test suit le
curseur (sondage toutes les 8 ms, `WS_EX_TRANSPARENT | WS_EX_LAYERED`). Fini le
cadre gris, les coins en escalier et les ombres coupées ; la fenêtre porte un halo
transparent pour les ombres.

Pendant la traduction, un anneau tourne ; le résultat arrive d’un bloc, la
fenêtre se redimensionne une seule fois et le verre s’ouvre en fondu. Une erreur
de connexion nomme le serveur injoignable et renvoie aux Réglages. Le rendu natif
(coins, ombre, fluidité) reste à confirmer à l’œil : la session de validation
était verrouillée, voir VALIDATION.md. Kit d’essai pour un autre poste :
`scripts/package-test-kit.ps1 -EvaluationVersion 0.1.5`.

## 0.1.5 — moteurs réels et kit de recette

Inférence réelle sous WSL2 (runner alternatif de l’image vLLM 0.28.0 épinglée,
une carte par profil), 600/600 réponses complètes sur les extraits synthétiques,
fenêtre Réglages sans cadre, premier kit de recette Windows.

## 0.1.4 — verre plus présent, interactions affinées

Le verre graphite passe de 78 % à 66 % d'opacité, les accessoires à 68 %.
Un bord asymétrique et des reflets intérieurs discrets donnent du relief sans
modifier la taille de la bulle. Le menu et la pilule partagent le même matériau.

Les retours visuels et le menu utilisent des fondus courts ; les icônes de copie
se croisent dans une zone fixe. Le flou et les ombres restent statiques. Windows
ne recalcule plus le cadre à chaque changement de géométrie lorsque le style
de la fenêtre est déjà correct. Les mouvements réduits restent respectés.

L'aperçu navigateur permet de comparer les fonds clair, sombre et coloré.
Les contrôles de fond appartiennent uniquement à cet aperçu. Le fondu acrylique
du compositeur Windows demeure distinct des animations du WebView ; les preuves
et limites de la recette sont dans VALIDATION.md.

## 0.1.3 — verre, pilule chevauchante et lecteur bas

Référence visuelle : planche C validée par Lucas. La traduction dispose de sa
propre surface de verre graphite ; Copier et Plus sont réunis dans une petite
pilule à cheval sur le bord supérieur droit. Les textes longs utilisent un
lecteur plus large en bas du moniteur, sans barre de défilement visible.

Les transitions utilisent Motion et respectent les mouvements réduits. Le
texte reste net : pas d'étirement ou d'animation du flou. La fermeture annule
immédiatement la traduction, puis coordonne la sortie visuelle avec Rust ; un
délai borné sert de secours. Les régions natives correspondent aux surfaces
réelles pour laisser passer les clics dans les espaces transparents.

Les preuves de compilation, tests, rendu et mesures sont consignées dans
VALIDATION.md. Un profil Chromium synthétique ne prouve pas la fluidité du
compositeur Windows et le dépoli doit être vérifié dans la fenêtre Tauri.

## 0.1.2 — composants éprouvés et boucle de revue visuelle

Le frontend est confié à Astra avec un effort de raisonnement medium ou supérieur.
Motion anime les apparitions et retours visuels, Radix fournit les menus et
interrupteurs accessibles, Lucide fournit les icônes. Versions épinglées et
notices de licence embarquées. La bulle courte conserve ses 280 × 76 px,
ses coins de 26 px et son fond graphite à 82 %.

Fermer reste disponible pendant le chargement et après une erreur. Les
scénarios de démonstration sont rejouables. Les 6 tests unitaires et 19 tests
navigateur passent. La revue combine désormais navigateur contrôlé et captures
de la vraie fenêtre Windows ; voir UI-ITERATION.md pour les résultats natifs.

Les transitions de dimensions et la fermeture native ne sont pas encore
animées : elles demandent une coordination explicite entre React et Rust.

## Correctifs précédents — 0.1.1

Correction du cadre Windows qui recouvrait la traduction. Le texte utilise
désormais toute la largeur et les petites actions suivent sa dernière ligne.
Faire glisser le texte ou le fond pour déplacer la bulle ; les boutons et les
barres de défilement gardent leur interaction. La position choisie reste en
place pendant le streaming et les changements de taille du résultat courant.

Le poste de développement utilise désormais un chemin explicite :
`C:\Users\Lucas\Apps\FlowTranslate\FlowTranslate.exe`, afin d’éviter la
redirection de LocalAppData par l’environnement Codex.

## Fonctionnalités de l’aperçu V1

Premier client Windows installable : interface Tauri contextuelle, bulle 280 px,
capsule presse-papiers avec confirmation, réglages, profils, raccourci global,
streaming, copie explicite, historique DPAPI facultatif et installation NSIS.
Configuration reproductible vLLM 0.28.0 et modèles Hy-MT2 épinglés. Dépôt privé.

Les options `--demo-selection` et `--demo-clipboard` permettent d’essayer le
rendu sans serveur. `--simulate-inference` sert à tester la capture réelle avec
une réponse synthétique ; quitter l’instance avant de changer de mode.

Cet aperçu n’est pas encore une V1 entièrement réceptionnée :

- Les modèles n’ont pas été chargés ni comparés sur GPU : ressources occupées,
  moteur Docker arrêté. Aucun résultat de qualité/latence n’est inventé.
- Remplacer est limité aux contrôles Win32 Edit/RichEdit vérifiables. Les
  autres contrôles conservent Copier. La recette Office/Teams reste à faire.
- Une reprise visuelle sur le bureau Windows est nécessaire pour valider les
  derniers correctifs, les transitions de taille et le DPI multi-écrans.
- Le paquet n’est pas signé par un certificat de distribution d’entreprise.

Voir [les preuves de validation](VALIDATION.md), [la recette](RECETTE.md) et
[la procédure d’installation et de retour arrière](DEPLOYMENT.md).
