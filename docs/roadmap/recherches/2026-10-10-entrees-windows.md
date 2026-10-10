# Overtype : déclencher l'app depuis les gestes natifs de Windows (clic droit & co)

Recherche du 2026-10-10. Statuts : **ANNONCÉ** (doc/vendeur), **CODE** (lu dans un repo), **RAPPORTÉ** (tiers, daté), **DÉDUIT** (raisonnement, base indiquée). « vérifié (source, date) » = lu dans la source primaire pendant cette recherche.

---

## 1) Réponse courte : « Overtype dans le clic droit »

- **Sur du texte sélectionné dans n'importe quelle app : non, pas de façon propre.** Windows n'a aucun point d'extension global pour le menu contextuel du *texte*. Chaque app construit et dessine son propre menu : Win32 `TrackPopupMenu`/HMENU, menus XAML (`MenuFlyout`, nouveau Bloc-notes), menus dessinés par Chromium (Chrome, Edge, Teams, new Outlook = WebView2), barres de commandes propres à Office. Le seul registre de menu contextuel que l'OS expose aux tiers est celui de **l'Explorateur (fichiers/dossiers)**. Ce dernier point est vérifié : seul l'Explorateur documente un point d'extension tiers (`windows.fileExplorerContextMenus`, learn.microsoft.com, 2026-07-16). Aucune API « text context menu » système n'a été trouvée (DÉDUIT de l'absence de doc, voir §5).
- **Contournements « vrais » (injecter une entrée dans le menu de l'app) : à écarter.** Un hook global qui injecte une DLL pour intercepter `WM_INITMENUPOPUP` ne marche que sur les menus HMENU natifs, donc ni Chrome/Edge/Teams/Office ni le nouveau Bloc-notes (DÉDUIT). Une DLL injectée dans tous les processus est le profil type que les EDR signalent. Elle fait crasher l'hôte si elle est boguée, ne passe pas l'UIPI vers les apps élevées et exige une DLL par architecture (x64/ARM64). En entreprise c'est rédhibitoire (DÉDUIT, voir §3.1).
- **Ce qui donne le même résultat UX sans injecter :**
  1. **Un geste souris global** capté par le hook bas niveau `WH_MOUSE_LL` qu'Overtype utilise *déjà* : Ctrl + clic droit, bouton latéral, ou clic droit maintenu. Overtype ouvre alors *son* menu d'actions à côté de la sélection. Ça marche dans toutes les apps, sans identité de package. C'est la vraie réponse à la demande de Lucas.
  2. **Des entrées natives dans les menus qui acceptent des tiers** : Explorateur (fichiers), navigateur (extension, contexte `selection`), Word/Excel/PowerPoint (complément Office, `ContextMenuText`), Teams (« Autres actions » d'un message).

---

## 2) Tableau des surfaces

| Surface | Faisable ? | Prérequis | Effort | Valeur UX | Risques / limites |
|---|---|---|---|---|---|
| Menu contextuel du texte dans toute app (injection) | Techniquement partiel, **à écarter** | Hook global + DLL injectée, x64/ARM64 | L | Haute en théorie | Ne couvre pas Chromium/Office/XAML. Antivirus/EDR, crash de l'hôte, politique d'entreprise |
| **Geste souris global** (Ctrl+clic droit, bouton latéral, appui long) → menu Overtype | **Oui** | Rien (hook `WH_MOUSE_LL` déjà dans le code) | **S–M** | **Très haute** : partout, même menu qu'aujourd'hui | Timeout de hook de 1 s (hook retiré en silence), UIPI (apps admin), conflits de geste |
| Barre flottante auto à la sélection (façon PopClip) | Oui | Hooks LL + UIA/MSAA + copie de secours | M | Haute pour certains, bruyante pour d'autres | Faux positifs, presse-papier, apps à curseur custom, apps élevées. Doit être opt-in |
| Menu Explorateur moderne (Win11, 1er niveau) pour fichiers | Oui | **Identité de package** (sparse OK) + DLL COM `IExplorerCommand` + **signature de confiance** | M–L | Haute pour « Analyser ce log », « Résumer ce PDF » | DLL chargée dans l'Explorateur (doit être rapide), certificat, enregistrement Appx |
| Menu Explorateur classique (« Afficher plus d'options ») via registre HKCU | Oui | Clés `HKCU\Software\Classes\*\shell\...` | S | Faible (2 clics, menu caché) | Aucun risque notable. Accès par Maj+F10 / « Afficher plus d'options » |
| « Envoyer vers » (`shell:sendto`) | Oui | Un raccourci .lnk dans `%AppData%\...\SendTo` | **S** | Faible–moyenne (menu legacy) | Uniquement sous « Afficher plus d'options » |
| Cible de partage Windows (Share) | Oui avec identité | Identité (sparse OK) + extension share target | M | Moyenne (Partager depuis Explorateur/apps) | Même coût d'identité que le menu moderne. Gratuit une fois le sparse en place |
| Click to Do / App Actions | Click to Do : **PC Copilot+ seulement**. App Actions : identité requise | Identité + `com.microsoft.windows.ai.actions` + COM ou URI | M–L | Faible pour la cible (parc non Copilot+) | Parc limité, API récente, actions désactivables par l'utilisateur/IT |
| MCP sur Windows (ODR) | Preview | Identité pour le mode confiné. Sinon bundle MCPB + « réduire les protections » | M | Stratégique plus tard (exposer/consommer des outils) | Statut prérelease, intégration UI floue |
| Extension Edge/Chrome (`contextMenus` « selection » + native messaging) | **Oui** | Extension (store ou forcelist GPO) + manifest host natif en HKCU | M | **Haute** dans le navigateur (vraie entrée de clic droit) | Politiques d'entreprise (NativeMessaging*), maintenance d'une 2e base de code |
| Complément Office (Word/Excel/PPT `ContextMenuText`) | **Oui** (Word/Excel/PowerPoint/OneNote) ; **Outlook non** (ruban seulement) | Add-in web hébergé en HTTPS, manifeste, déploiement via le portail « Integrated apps » M365 | M–L | Haute dans Word (vrai clic droit natif) | Hébergement web, pas de lien direct avec l'app desktop, Outlook exclu |
| Teams (action de message) | Oui | App Teams + message extension `context: message` | M–L | Faible–moyenne (sous « Autres actions ») | Bot/hébergement, consentement admin Teams |
| Touche Copilot / Win+C | Oui sous conditions | App **packagée et signée** (`com.microsoft.windows.copilotkeyprovider`) | M (si identité déjà là) | Moyenne (PC récents seulement) | L'utilisateur ou l'IT doit choisir l'app (policy `SetCopilotHardwareKey`) |
| PowerToys Command Palette | Oui | Extension .NET/WinRT packagée (appxmanifest), PowerToys installé | M | Faible en entreprise (PowerToys rare) | SDK en preview, 2e base de code .NET |
| Jump list barre des tâches / tray | Oui | Rien (API shell, AUMID) | S | Faible–moyenne (raccourcis vers chat, presse-papier) | Utile seulement si l'app est épinglée |

---

## 3) Détail par surface

### 3.1 Menu contextuel du texte dans toute app : pourquoi non
- **Il n'existe pas d'extension système pour le texte.** L'Explorateur est la seule surface documentée : la doc Windows 11 parle de commandes pour « arbitrary files, folders, or folder backgrounds » via `IExplorerCommand` (vérifié, learn « Add a File Explorer context menu command… », ms.date 2026-07-16). Le blog Windows de 2021 sur le menu Windows 11 ne traite que de l'Explorateur et du dialogue Partager (vérifié, blogs.windows.com 2021-07-19).
- **Chaque app possède son menu** (DÉDUIT de l'architecture des frameworks) : Office dessine ses propres menus et n'accepte que ses compléments (§3.10). Chromium dessine les siens et n'accepte que ses extensions (§3.9). Le nouveau Bloc-notes est une app packagée WinUI. Teams et new Outlook sont des apps web dans WebView2.
- **Contournement par injection** : hook global `SetWindowsHookEx` (WH_CBT/WH_CALLWNDPROC) qui charge une DLL dans chaque processus pour patcher les menus HMENU. Risques :
  - couverture faible : les menus non-HMENU échappent (DÉDUIT) ;
  - EDR/antivirus : injection de DLL globale, comportement de malware (DÉDUIT, non vérifié sur un EDR précis) ;
  - stabilité : un bug fait crasher Word/Outlook (DÉDUIT) ;
  - UIPI : les hooks d'un processus non élevé n'atteignent pas les fenêtres élevées. La doc de selection-hook le dit (CODE/doc, repo 0xfullex/selection-hook, commit 768544d du 2026-09-03, `docs/WINDOWS.md` « Elevated (Administrator) Windows »).
  - Verdict : à écarter.
- **Variante non intrusive, expérimentale** (non vérifiée) : un `SetWinEventHook` hors contexte sur `EVENT_SYSTEM_MENUPOPUPSTART` pour afficher une « pastille Overtype » collée au menu natif quand il s'ouvre. Pas d'injection, mais rien ne garantit que Chromium et Office émettent cet événement de façon fiable. Prototype requis avant tout engagement (DÉDUIT).

### 3.2 Geste souris global (recommandé n°1)
- **Base technique déjà présente** : Overtype installe un `WH_MOUSE_LL` dans un thread dédié avec boucle de messages, plus un `WH_KEYBOARD_LL` (CODE, `src-tauri/src/host.rs` l.346-375 et l.521-601).
- **Contraintes documentées de `LowLevelMouseProc`** (vérifié, learn, ms.date 2025-07-14) :
  - le hook est appelé dans le thread qui l'a installé, qui doit avoir une boucle de messages ;
  - au-delà de `LowLevelHooksTimeout` (plafonné à **1000 ms** depuis Windows 10 1709), « the hook is silently removed », sans aucun moyen de le savoir ;
  - renvoyer une valeur non nulle **avale** l'événement, ce qui permet de consommer Ctrl+clic droit pour que le menu natif ne s'ouvre pas ;
  - Microsoft recommande Raw Input pour la simple surveillance. Mais Raw Input ne peut pas avaler l'événement, donc le LL hook reste nécessaire pour un geste qui *remplace* le clic droit (DÉDUIT).
- **Gestes candidats** (DÉDUIT, à valider en vraie fenêtre) :
  - **Ctrl + clic droit sur la sélection** → menu Overtype à la place du menu natif. Il faut avaler *à la fois* `WM_RBUTTONDOWN` et `WM_RBUTTONUP`, sinon l'app reçoit un up orphelin. Quelques apps utilisent déjà ce combo, d'où une liste d'exclusion par exe.
  - **Bouton latéral (XBUTTON1/2)** : très peu de conflits hors navigateurs (précédent/suivant). À activer seulement si l'utilisateur le choisit.
  - **Clic droit maintenu** (≥ ~400 ms) : en retenant le down, on retarde le menu natif de tout le monde. Risqué pour l'UX, à éviter par défaut.
  - **Clic milieu + modificateur** : faisable, mais le clic milieu sert aux onglets et au défilement.
- **Lecture du texte** : même pipeline qu'aujourd'hui (UIA, sinon copie synthétique). Le geste ne change que le déclencheur.
- **Limites** : apps élevées (UIPI), jeux plein écran, bureau à distance (RDP capte la souris), touchpad sans bouton latéral.

### 3.3 Barre flottante à la sélection (façon PopClip)
- **Mode de détection, d'après le code de référence open source** (CODE, 0xfullex/selection-hook, commit 768544d, 2026-09-03, `src/windows/selection_hook.cc` et `docs/WINDOWS.md`) :
  - hooks `WH_MOUSE_LL`/`WH_KEYBOARD_LL` pour classer le geste : drag ≥ 8 px (`MIN_DRAG_DISTANCE = 8`), double-clic (`GetDoubleClickTime`), Maj+clic ;
  - puis lecture du texte en trois niveaux : UIA → IAccessible → copie de secours (Ctrl+Insert, puis Ctrl+C, avec sauvegarde et restauration du presse-papier) ;
  - la copie de secours est filtrée sur la forme du curseur (I-beam oui, flèche/main non) ;
  - listes par app pour les curseurs custom (Acrobat) et les écritures de presse-papier en plusieurs temps.
  - Utilisé par le « Selection Assistant » de Cherry Studio (ANNONCÉ, README).
- **WritingTools (theJayTea)** n'a *pas* de barre auto : c'est un raccourci (défaut `ctrl+space`) suivi d'un Ctrl+C synthétique (CODE, commit 0839d8c du 2026-08-19, `Windows_and_Linux/WritingToolApp.py`, `ui/OnboardingWindow.py`). Même modèle qu'Overtype aujourd'hui.
- **Pièges** :
  - faux positifs : un drag de fenêtre ou de fichier ressemble à une sélection ;
  - la barre vole l'attention, donc il faut la montrer sans prendre le focus et la masquer au moindre clic ou défilement ;
  - le presse-papier peut être touché ;
  - UIPI ;
  - curseurs custom.
  - Référence macOS : PopClip, barre au-dessus de la sélection.
- SnipDo (ex-Pantherbar) et le mini-menu d'Edge : comportement non vérifié dans le code, ce sont des produits fermés (non vérifié).

### 3.4 Menu contextuel de l'Explorateur (fichiers)
- **Menu moderne Windows 11** (vérifié, learn « Add a File Explorer context menu command to a packaged desktop app », ms.date 2026-07-16) :
  - DLL native exposant `IExplorerCommand`, enregistrée en `windows.comServer` (SurrogateServer) et `windows.fileExplorerContextMenus` (`desktop4`/`desktop5`) ;
  - `ItemType` `*`, `Directory` ou `Directory\Background` ;
  - sous-menu attribué à l'app via `EnumSubCommands` ;
  - « applies to … unpackaged Win32 apps that use a sparse package » ;
  - « Keep GetTitle, GetIcon, GetState… fast » ;
  - l'architecture de la DLL doit correspondre à celle de l'Explorateur.
- **Menu classique** : « Show more options loads the Windows 10 context menu as-is », aussi accessible par Maj+F10 (vérifié, blogs.windows.com 2021-07-19). Une entrée par registre HKCU sans identité n'apparaît que là. Ce mécanisme de verbes statiques n'a pas été relu dans la doc pendant cette recherche (non vérifié, pratique établie).
- **Précédent** : VS Code livre « Shell extension to integrate with Win11 Context menu via sparse pkg ». C'est une DLL C/C++ plus un sparse package non signé, que le repo principal signe et installe via son installateur classique (Inno) (ANNONCÉ, README de github.com/microsoft/vscode-explorer-command, consulté le 2026-10-10). C'est exactement le schéma « installateur classique + sparse » applicable à NSIS.
- **Rust** : la DLL peut s'écrire avec `windows-rs` (`#[implement]`). Non vérifié dans un projet réel ; la doc recommande C++ (DÉDUIT).
- **UX proposée** : clic droit sur `.log`/`.txt`/`.pdf`/`.docx` → sous-menu « Overtype » : « Résumer », « Analyser ce log », « Demander à Overtype… ». Chaque entrée ouvre la fenêtre de chat avec le fichier attaché.
- **À prévoir côté app** : le callback actuel de `tauri_plugin_single_instance` ignore les arguments et ouvre seulement « la porte d'entrée » (CODE, `src-tauri/src/lib.rs` l.3196-3199). Toute entrée externe (Explorateur, Envoyer vers, jump list, native messaging) demande un routage `argv`/URI vers une action.

### 3.5 « Envoyer vers » et cible de partage
- **Envoyer vers** = un raccourci dans `shell:sendto` (`%AppData%\Microsoft\Windows\SendTo`). Sous Windows 11, il n'apparaît que sous « Afficher plus d'options » (RAPPORTÉ, tweaktown, pcworld, elevenforum, pages non datées, consultées le 2026-10-10). Effort S, faisable depuis NSIS en mode per-user. Valeur faible.
- **Share target** : « All apps can now participate in the Share dialog as targets », y compris les Win32 non packagés via sparse manifest (vérifié, blogs.windows.com 2021-07-19). La doc sparse liste « share targets » parmi les capacités débloquées par l'identité (vérifié, learn « Grant package identity… manually », ms.date 2026-10-03). Une fois le sparse en place pour l'Explorateur, l'ajout est marginal (DÉDUIT).

### 3.6 Click to Do et App Actions on Windows
- **Click to Do** :
  - exige « A Copilot+ PC or eligible Cloud PC », NPU 40 TOPS, 16 Go de RAM (vérifié, learn « Manage Click to Do », ms.date 2025-12-10, mis à jour 2026-08-18 ; idem support.microsoft.com) ;
  - s'ouvre par Win+Q ou Win+clic ;
  - policy `DisableClickToDo` (GPO/CSP) ;
  - les actions d'apps se désactivent dans Paramètres > Applications > Actions.
- **App Actions** :
  - « Apps must have package identity in order to register an app action » ;
  - extension `com.microsoft.windows.ai.actions` plus un JSON d'actions ;
  - entités Text, Document, Photo… ;
  - activation COM (`IActionProvider`) ou URI ; le streaming de texte n'est pas supporté en URI ;
  - `allowedAppInvokers` (vérifié, learn « App Actions on Windows Overview », ms.date 2025-04-14, mis à jour 2026-01-21 ; « Get started », mis à jour 2025-09-05).
- **Autres surfaces** :
  - les App Actions alimentent aussi les « AI actions » du menu de l'Explorateur. Manus et Filmora y ont été annoncés comme intégrations tierces, « available for all Windows 11 PCs, not just Copilot+ PCs » (RAPPORTÉ, windowslatest 2025-10-16). Ce point n'est pas confirmé sur learn, et la même source attribue l'intégration de Manus à MCP, pas aux App Actions.
  - les **Agent Launchers** reposent sur les App Actions et l'ODR : un agent enregistré devient visible « from the Start menu, search, or within applications » (vérifié, learn « Agent Launchers overview », mis à jour 2025-12-12).
- **Verdict** : pour une app interne, sur un parc probablement pas tout Copilot+, Click to Do est à écarter. Les App Actions et Agent Launchers sont à réévaluer une fois l'identité en place : coût marginal, surfaces encore mouvantes (DÉDUIT).

### 3.7 MCP sur Windows (ODR)
- **Statut** : prérelease (« Some information relates to prereleased product », vérifié, learn « MCP on Windows overview », mis à jour 2026-06-04). `odr.exe mcp list/add/remove/run`. L'enregistrement manuel demande le build 26220.7262 ou plus (vérifié, learn `mcp-manual`, via le résumé de recherche). Annoncé en preview à Ignite 2025 (RAPPORTÉ, blogs.windows.com 2025-11-18). Aucune annonce de disponibilité générale (GA) trouvée.
- **Enregistrer un serveur** :
  - avec identité : enregistrement et désenregistrement automatiques, exécution confinée ;
  - sans identité : bundle MCPB installé par l'installateur, mais « can't run in the securely contained agent process and will not be accessible from the … registry unless users explicitly enable … Reduce protections for agent connectors » (vérifié, learn « MCP servers on Windows overview », mis à jour 2025-11-18).
- **Intérêt pour Overtype** (DÉDUIT) :
  - *consommer* : Overtype comme hôte MCP peut lister les serveurs ODR (connecteur File Explorer : `read_text_file` lit Office et PDF) pour le chat et l'analyse de documents ;
  - *exposer* : des outils Overtype (« réécrire », « traduire ») pour d'autres agents.
  - Les deux sont secondaires par rapport aux points d'entrée gestuels. À garder sur la feuille de route une fois l'identité acquise.

### 3.8 Touche Copilot, Win+raccourcis, Command Palette, jump list
- **Touche Copilot / Win+C** (vérifié, learn « Microsoft Copilot hardware key providers », ms.date 2026-09-26) :
  - « An app must be packaged » et « Provider apps must be signed » ; extension `com.microsoft.windows.copilotkeyprovider` ;
  - lancement par URI, avec option press-and-hold (`PressAndHoldStart`/`Stop`) ;
  - l'IT peut l'imposer (`BrandedKeyChoiceType = AppEnforcedByPolicy`, policy WindowsAI `SetCopilotHardwareKey`).
  - Un sparse package suffit-il ? Non vérifié : la doc dit « packaged » sans préciser.
  - UX : appui court → chat, appui long → dictée ou action sur la sélection.
- **Win+raccourcis** : les combinaisons Win+X sont en grande partie réservées par le shell. Overtype a déjà Ctrl+Alt+Espace (pas de nouvelle source consultée).
- **PowerToys Command Palette** (vérifié, learn « How Command Palette extensions work », ms.date 2026-04-10) :
  - extensions = apps .NET séparées en serveur COM hors processus ;
  - déclarées dans `.appxmanifest` (`com.microsoft.commandpalette`), découvertes via « the Windows Package Catalog », donc identité requise (DÉDUIT) ;
  - suppose PowerToys installé, ce qui est rare en entreprise. À écarter pour l'instant.
- **Jump list** : raccourcis « Nouveau chat », « Coller et analyser le presse-papier ». Faisable sans identité via `ICustomDestinationList` (non vérifié dans cette recherche ; Tauri n'a pas d'API intégrée, non vérifié). Valeur faible si l'app vit dans le tray.

### 3.9 Extension de navigateur (Edge/Chrome)
- **Menu contextuel** : `chrome.contextMenus` avec le contexte `"selection"`, `selectionText` dans `OnClickData` et la permission `contextMenus`. Plusieurs items d'une même extension sont regroupés sous un parent (vérifié, developer.chrome.com `contextMenus`, consulté le 2026-10-10). Edge est Chromium, même API (DÉDUIT).
- **Native messaging** (vérifié, developer.chrome.com « Native messaging », consulté le 2026-10-10) :
  - host déclaré en **HKCU** (`Software\Google\Chrome\NativeMessagingHosts\<nom>`) ou HKLM, donc compatible avec un NSIS per-user ;
  - `allowed_origins` sans joker ;
  - stdio en JSON préfixé de sa longueur ;
  - messages host → navigateur ≤ 1 Mo, navigateur → host ≤ 64 Mio ;
  - Chrome lance un processus host séparé, qui doit relayer vers l'instance Overtype (IPC ou argv via single-instance).
- **Entreprise** : déploiement forcé par `ExtensionInstallForcelist`. Si l'IT règle `NativeMessagingUserLevelHosts` à false, un host HKCU est bloqué (RAPPORTÉ, docs UiPath et forum 1Password, non datés). La source primaire chromeenterprise/learn Edge n'a pas pu être lue (§5).
- **UX** : sélection → clic droit → « Overtype › Réécrire / Traduire / Expliquer / Demander… ». Le résultat remplace la sélection (content script) ou s'ouvre dans Overtype.
- **Limites** : pas de contrôle sur le mini-menu de sélection d'Edge (non vérifié) ; visionneuse PDF non garantie (non documentée).

### 3.10 Compléments Office (Office.js)
- **Ce que permet le manifeste** : l'extension point `ContextMenu`, avec `OfficeMenu id="ContextMenuText"` pour le texte sélectionné et `ContextMenuCell` pour les cellules Excel, est « Valid for Word, Excel, PowerPoint, and OneNote ». Les extension points Outlook (`MessageReadCommandSurface`, `MessageComposeCommandSurface`, …) ne contiennent **aucun menu contextuel** (vérifié, learn « ExtensionPoint element », ms.date 2026-02-27). **Pas de clic droit dans Outlook** (DÉDUIT de cette liste).
- **Commandes** :
  - les « function commands » exécutent du JS dans un runtime navigateur, limité à 5 minutes ;
  - plateformes : Office web, Windows/Mac M365, Office 2021+ perpétuel ;
  - déploiement via le portail « integrated apps » du centre d'admin M365, catalogues SharePoint non supportés (vérifié, learn « Basic concepts for add-in commands », ms.date 2026-08-13).
- **Coût** : un add-in est une app web hébergée en HTTPS, qui parle à l'app desktop via un backend ou localhost. C'est une 2e base de code (DÉDUIT).
- **Valeur** : vrai clic droit natif dans Word. Mais le geste global (§3.2) couvre déjà Word sans rien déployer, donc priorité basse sauf si l'IT veut une entrée « officielle » dans Office.
- **Teams** : une message extension avec `context: ["message"]` apparaît dans le menu « … » d'un message, sous « Autres actions ». Elle reçoit le message entier ; seules les 3 actions récentes remontent (RAPPORTÉ via le résumé de recherche de learn « Define message extension action commands »). Valeur faible pour l'effort.

---

## 4) Recommandation classée

**Phase 1 : sans identité, dans l'installateur NSIS actuel**
1. **Geste souris global → menu Overtype** (S–M). Défaut proposé : **Ctrl + clic droit** sur une sélection ouvre le menu d'actions actuel, positionné au curseur. Option : bouton latéral de souris, au choix dans les Réglages avec détection du bouton pressé. Le clic droit simple n'est jamais touché. Il faut :
   - un hook ultra-court (renvoyer tout de suite, travail sur un autre thread) ;
   - le down et le up avalés ensemble ;
   - une liste d'exclusion par exe ;
   - un repli propre si la fenêtre est élevée.
   C'est la réponse directe à « Overtype dans le clic droit », sur Word, Outlook, Chrome, Teams et Bloc-notes.
2. **Extension Edge/Chrome** (M). Item « Overtype » dans le menu contextuel `selection`, avec sous-menu d'actions. Native messaging vers l'app ; host en HKCU écrit par NSIS. En entreprise, forcelist GPO plus vérification de `NativeMessagingUserLevelHosts`.
3. **Quick wins** (S) : raccourci « Envoyer vers › Overtype » et verbe classique HKCU « Analyser avec Overtype » pour `.log`/`.txt` (sous « Afficher plus d'options »), plus le routage `argv` dans `single-instance`. Ça valide l'UX fichiers avant d'investir dans le sparse package.

**Phase 2 : identité de package (sparse) dans l'installateur NSIS**
4. **Sparse package signé + menu Explorateur moderne** (M–L) : sous-menu « Overtype › Résumer / Analyser ce log / Demander… ». Débloque aussi la cible de partage (coût marginal) et ouvre la porte à la touche Copilot, aux App Actions, aux Agent Launchers et au MCP confiné.

**Phase 3 : selon la demande**
5. **Barre flottante auto à la sélection**, en opt-in, désactivée par défaut, avec liste d'apps. S'inspirer de selection-hook : ses heuristiques sont publiques (MIT).
6. **Complément Word/Excel/PPT** si l'IT veut une entrée Office « officielle » ; Outlook impossible en clic droit.
7. **MCP/ODR** (consommer le connecteur File Explorer, exposer les outils Overtype) quand la fonctionnalité sort de preview.

**À écarter** :
- injection dans les menus des apps ;
- Click to Do (Copilot+ seulement) ;
- PowerToys Command Palette (PowerToys rarement présent, .NET, preview) ;
- Teams message extension (« Autres actions », peu visible) ;
- clic droit *maintenu* comme geste par défaut (dégrade le menu natif partout).

### 4.1 Identité de package : Tauri 2, coût, entreprise
- **Tauri 2 ne produit pas de MSIX** :
  - issue #4818 « Build MSIX Packages to Support Package Extensions », ouverte depuis le 2022-08-01 ;
  - #15145 « Support MSIX dev-mode debugging », ouverte le 2026-03-23 ;
  - PR #15795 « `tauri dev --packaged` for Windows package identity », ouverte le 2026-07-29 ;
  - (RAPPORTÉ, page d'issues github.com/tauri-apps/tauri?q=msix, lue le 2026-10-10).
  - Overtype cible `nsis` en `installMode: currentUser` (CODE, `src-tauri/tauri.conf.json` l.70-78).
- **Voie MSIX complète** : Microsoft documente `winapp init/run/pack` pour Tauri. `winapp run` donne l'identité en debug sans certificat ; `winapp pack --cert` produit un MSIX signé (vérifié, learn « Using winapp CLI with Tauri », ms.date 2026-10-03). Cela remplace NSIS, donc change la distribution.
- **Voie sparse, compatible NSIS** (vérifié, learn « Grant package identity … manually », ms.date 2026-10-03) :
  - manifeste avec `uap10:AllowExternalContent`, `runFullTrust`, `TrustLevel=mediumIL`, `AppListEntry="none"` ;
  - `MakeAppx pack /nv` puis `SignTool` ;
  - manifeste fusion de l'exe avec un élément `msix` (publisher, packageName, applicationId identiques), à injecter dans l'exe Tauri via le manifeste Windows de `tauri-build` (DÉDUIT) ;
  - enregistrement **per-user sans admin** : `Add-AppxPackage -Path ... -ExternalLocation [dossier_install]` ou `PackageManager.AddPackageByUriAsync` ;
  - désenregistrement à la désinstallation ;
  - Windows 10 2004 minimum.
  - Pièges listés : `0x800B0109` (certificat non approuvé), `0x80073D54` (manifestes divergents), chemin `ExternalLocation` différent du dossier réel.
- **Signature** : « must be signed with a certificate that is trusted on the target computer ». Un certificat auto-signé impose un import dans Trusted People : CurrentUser possible, LocalMachine demande l'élévation. En production, il faut un certificat de la PKI de l'IT ou Azure Trusted/Artifact Signing (vérifié, même page). Prix rapporté : 9,99 $/mois (Basic, 5 000 signatures). Éligibilité : organisations US/CA/UE/UK, particuliers US/CA seulement (RAPPORTÉ, devclass 2026-01-14 ; la page de prix Azure n'affichait pas les montants).
- **Implications entreprise** (DÉDUIT) :
  - pour un usage interne, le plus simple est un certificat de signature de code de la PKI interne, déjà approuvé par GPO sur le parc ;
  - l'IT peut aussi déployer le MSIX ou le sparse par Intune ;
  - vérifier que les policies Appx/AppLocker n'interdisent pas `Add-AppxPackage` (non vérifié).
  - Signer aussi l'exe et l'installateur NSIS réduit les alertes SmartScreen et antivirus (issue Tauri #2486 « Trojan alert from windows defender », ouverte depuis 2021, RAPPORTÉ).

---

## 5) Non vérifié / limites de la recherche
- Absence d'API système de « menu contextuel du texte » : conclusion par absence dans la doc learn et le blog Windows (DÉDUIT, pas de déclaration explicite de Microsoft trouvée).
- Comportement des EDR face à une DLL injectée globalement : non testé, aucune source primaire consultée.
- `EVENT_SYSTEM_MENUPOPUPSTART` émis par Chromium/Office : non vérifié, à prototyper.
- Policies Edge/Chrome `NativeMessagingUserLevelHosts` et `ExtensionInstallForcelist` : sources tierces seulement. chromeenterprise.google n'a pas rendu le contenu ; la page learn des policies Edge n'a pas été trouvée.
- Mini-menu de sélection d'Edge extensible par des tiers : non vérifié. SnipDo : produit fermé, mécanisme non vérifié.
- Teams message extensions : lu via un résumé de recherche, page learn non ouverte directement.
- Touche Copilot avec un **sparse** package (et non un MSIX complet) : non précisé par la doc.
- App Actions dans les « AI actions » de l'Explorateur pour des tiers sur PC non Copilot+ : seulement RAPPORTÉ (windowslatest 2025-10-16), mécanisme exact non documenté sur learn.
- Statut GA de MCP/ODR en octobre 2026 : aucune annonce GA trouvée, la doc reste marquée prérelease.
- Envoyer vers sous Windows 11 « Afficher plus d'options » : sources communautaires seulement. Verbes statiques HKCU : non relus dans la doc.
- Jump lists sous Tauri 2 : non vérifié.
- Prix et éligibilité d'Artifact Signing : article tiers, page Azure sans montants.
- Rien n'a été prototypé ni exécuté. Toutes les conclusions UX sur les gestes sont à valider en vraie fenêtre (Word, Outlook classique et new, Chrome, Edge, Teams, Bloc-notes).

### Sources principales (consultées le 2026-10-10)
- https://learn.microsoft.com/en-us/windows/apps/desktop/modernize/integrate-packaged-app-with-file-explorer
- https://learn.microsoft.com/en-us/windows/apps/desktop/modernize/grant-identity-to-nonpackaged-apps
- https://learn.microsoft.com/en-us/windows/apps/dev-tools/winapp-cli/guides/tauri
- https://blogs.windows.com/windowsdeveloper/2021/07/19/extending-the-context-menu-and-share-dialog-in-windows-11/
- https://learn.microsoft.com/en-us/windows/client-management/manage-click-to-do
- https://learn.microsoft.com/en-us/windows/ai/app-actions/ et /actions-get-started
- https://learn.microsoft.com/en-us/windows/ai/agent-launchers/
- https://learn.microsoft.com/en-us/windows/ai/mcp/overview , /mcp/servers/mcp-server-overview , /mcp/file-connector
- https://learn.microsoft.com/en-us/windows/apps/develop/windows-integration/microsoft-copilot-key-provider
- https://learn.microsoft.com/en-us/windows/powertoys/command-palette/extensibility-overview
- https://learn.microsoft.com/en-us/windows/win32/winmsg/lowlevelmouseproc
- https://learn.microsoft.com/en-us/javascript/api/manifest/extensionpoint
- https://learn.microsoft.com/en-us/office/dev/add-ins/design/add-in-commands
- https://developer.chrome.com/docs/extensions/reference/api/contextMenus
- https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging
- https://github.com/tauri-apps/tauri/issues?q=msix
- https://github.com/microsoft/vscode-explorer-command
- https://github.com/0xfullex/selection-hook (768544d) ; https://github.com/theJayTea/WritingTools (0839d8c)
- https://www.windowslatest.com/2025/10/16/microsoft-confirms-windows-11s-file-explorer-is-getting-third-party-ai-features/ (RAPPORTÉ)
- https://devclass.com/2026/01/14/code-signing-windows-apps-may-be-easier-and-more-secure-with-new-azure-artifact-service/ (RAPPORTÉ)
