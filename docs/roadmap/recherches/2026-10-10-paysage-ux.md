# Paysage des assistants IA desktop et patterns UX (état au 2026-10-10)

Pour : transformer Overtype (Îlot sur sélection + remplacement sur place) en assistant interne d'entreprise à modèles locaux.
Légende : **vérifié (source, date)** = lu sur une page officielle (doc, changelog, release GitHub) pendant cette recherche ; **rapporté** = presse ou tiers ; **non vérifié** = connaissance antérieure, pas confirmée ici ; **déduit** = mon raisonnement.

---

## 0. « Hermès Sophie final » : ce que je retiens

- **Hermès = très probablement Hermes Agent de Nous Research**, plus précisément **Hermes Desktop**, son app graphique. Certitude ~80 %.
  - Open source MIT, mémoire persistante, skills qu'il écrit lui-même, modèles au choix dont endpoint perso / Ollama ; app desktop Windows/macOS/Linux en public preview le 3 juin 2026 — vérifié (README github.com/NousResearch/hermes-agent et hermes-agent.nousresearch.com/desktop, lus 2026-10-10) ; date rapportée (the-decoder.com, 2026-06-03). Ollama documente `ollama launch hermes-desktop` comme chemin d'install recommandé sur Windows — vérifié (docs.ollama.com/integrations/hermes-desktop).
  - ~252k étoiles GitHub — vérifié (page repo, 2026-10-10) : la référence « agent local » de 2026.
- **« Sophie final » = probablement un artefact de dictée** ; lecture la plus plausible : « **sauf qu'au final** » (« un peu comme Hermès, sauf qu'au final… plus bureautique »). Certitude faible (~40 %). Alternatives moins probables : « Hermes Desktop », ou un 2ᵉ produit cité (OpenClaw, l'autre agent local très populaire en 2026). Aucun produit « Sophie » pertinent trouvé.
- **À retenir de Hermes** : mémoire curée par l'agent + recherche plein texte des sessions passées, skills réutilisables auto-générés, cron qui livre des rapports, multi-surfaces (desktop, Slack, Discord, mail…) partageant config/mémoire — vérifié (README). **Ce qui manque pour la bureautique** : pas de déclencheur sur sélection ni de raccourci global documenté (absent de la page desktop) ; posture « agent autonome qui exécute shell/fichiers » = risque élevé en entreprise (déduit).

---

## 1. Fiches produits

### 1.1 ChatGPT desktop (Windows)
- **Déclencheur** : Alt+Espace → *fenêtre compagnon* (petite, toujours au-dessus, mémorise sa position, sinon bas-centre ; raccourci modifiable ; bouton « Ouvrir dans la fenêtre principale ») ; Ctrl+K recherche l'historique — vérifié (releasebot.io « OpenAI Windows App », entrées 30/10/2024, 07/11/2024, 14/11/2024).
- **2026** : **Quick Chat Win+Alt+P** et **Appshots** (appui sur **les deux Alt** = fenêtre au premier plan jointe : image + texte exposé par l'app ; s'ouvre dans la fenêtre principale sur Windows), arrivés sur Windows le 11/09/2026 (v26.908) — **rapporté** (résumé des release notes OpenAI + windowsreport, omidsaffari ; help.openai.com renvoie 403, non lu). Politiques admin Enterprise pour autoriser/bloquer les apps natives lisibles par le client desktop, 03/09/2026 — rapporté.
- **Contexte** : fichiers, captures, Appshots. « Work with apps » (lecture directe VS Code/Terminal…) : historiquement macOS ; aucune preuve Windows 2026 — non vérifié. En 2026 « Work with » = plugins avec panneaux interactifs/éditeurs de fichiers (29/09/2026, vérifié releasebot.io/updates/openai/chatgpt).
- **Modèle** : sélecteur + effort de raisonnement, modèles distincts par onglet Chat/Work/Codex (22/09/2026, vérifié releasebot). Aucun local.
- **Remarquable** : double-Alt = geste minimal pour « regarde ça » ; conversation du compagnon jamais perdue.
- **Raté** : Alt+Espace en conflit (OpenAI le documente) ; produit fragmenté (Chat/Work/Codex/Space/Pages/Meetings) ; conversations macOS stockées en clair hors sandbox (juillet 2024, corrigé en 1.2024.171) — rapporté (ghacks 08/07/2024).

### 1.2 Claude desktop
- **Quick entry (Mac)** : double-tap Option / Option+Espace / perso → zone de texte ; **glisser pour capturer une zone ou cliquer une fenêtre pour joindre son contenu** ; dictée via Verr. Maj ; ouvre une **nouvelle conversation**, menu des 5 dernières — vérifié (support.claude.com/articles/12626668, lu 2026-10-10). **La doc dit « pas disponible sur Windows ».**
- **Contradiction** : issue anthropics/claude-code#22420 (01/02/2026, Windows 1.1.1520) : sur Windows une quick entry « popup une ligne » s'ouvre même au clic sur l'icône de la barre des tâches, sans option pour l'éviter ; fermée « not planned » par bot le 02/03/2026 — vérifié (issue). Donc forme minimale sur Windows (rapporté), non testé.
- Cowork GA Windows 09/04/2026, mémoire refondue 10/07/2026 — rapporté (résumé release notes support.claude.com).
- **Remarquable** : capture/fenêtre depuis la barre même. **Raté** : clic sur l'icône détourné vers la mini-barre = surprise de surface.

### 1.3 Microsoft Copilot (app Windows)
- Alt+Espace configurable : Aucun / **Quick View** (petite fenêtre) / plein écran, ou press-to-talk ; « Hey Copilot » ; **Vision** = partager une fenêtre et en parler — rapporté (windowslatest 09/01/2025, geekrewind ; versions 2025).
- **Notes Insider 14/08/2026 (v152.0.4191.25)** : refonte en cours, **Ask Copilot dans la barre des tâches temporairement désactivé**, Notebooks, Connectors et Vision temporairement indisponibles — vérifié (learn.microsoft.com, maj 2026-08-14). « Ask Copilot » (composer flottant barre/Start, M365 + agents, cible entreprise) annoncé mi-2026 — rapporté (windowslatest 27/05/2026), GA non confirmée. Click to Do + extraction vers Excel : rapporté, non vérifié.
- **Remarquable** : intégration OS, voix mains libres. **Raté** : fonctions retirées/réintroduites, Alt+Espace saturé (Copilot, ChatGPT, Gemini).

### 1.4 Gemini (app Windows, 10/09/2026)
- **Alt+Espace ouvre Gemini en overlay** sur le travail en cours ; résumés depuis Gmail/Drive ; délégation à « Gemini Spark » (agent 24/7, abonnement) ; Win10/11 x64+ARM64 — vérifié (blog.google 10/09/2026 ; workspaceupdates 11/09/2026). Ni partage d'écran ni choix de modèle mentionnés.

### 1.5 Raycast pour Windows
- 2.0 hors bêta 21/08/2026, AI Chat et Dictation passent en Pro — vérifié (raycast.com/changelog/windows/2-0).
- **Quick AI** : raccourci → question → Tab → réponse ; refonte 0.65 (18/06/2026) : composer en bas, MCP/AI Extensions dans Quick AI — vérifié.
- **AI Commands** : prompt avec `{selection}`, `{argument name="Language"}`, `@extension` ; **modèle propre à chaque commande** ; **Output Behavior : ouvrir dans Raycast OU remplacer la sélection** (0.65) ; partage des commandes à toute l'équipe (0.63, 04/06/2026) — vérifié (manual.raycast.com/ai/ai-commands ; changelogs).
- **Modèles** : 2.2 (08/09/2026) : fournisseurs custom OpenAI-compatibles, **Ollama local**, OpenRouter BYOK, dans le même sélecteur ; **réservés Pro** (« changement significatif vs v1 ») ; Quick AI gagne « Paste Formatted Response » — vérifié (changelog windows/2-2).
- Dictée 2.0 : « Context-Aware Paste » (espaces/majuscules selon le texte avant le curseur) — vérifié. « Screen Awareness » listé au manuel, non lu.
- **Remarquable** : concurrent direct de l'Îlot ; **modèle par commande** et **partage d'équipe** à reprendre. **Raté** : local/BYOK derrière abonnement.

### 1.6 PowerToys
- **Advanced Paste** (Win+Shift+V) : texte brut/Markdown/JSON avec raccourcis directs, OCR local, **actions IA nommées avec leur propre raccourci** ; 0.96 (19/11/2025) : plusieurs endpoints (OpenAI, Azure, Foundry Local, **Ollama**…), **liste déroulante de modèle dans la fenêtre**, aperçu du presse-papier — vérifié (devblogs.microsoft.com 19/11/2025 ; learn.microsoft.com/windows/powertoys/advanced-paste). Stable v0.101.2362.0 (25 août) : transformations **Phi Silica** sur l'appareil sans clé — vérifié (github.com/microsoft/PowerToys/releases).
- **Command Palette** : v0.101.2712.0 peut devenir la cible de la **touche Copilot** (réglage Windows) — vérifié (releases). Rien d'IA dans les previews 0.102.
- **Leçon** : Microsoft valide « presse-papier + action IA + modèle local au choix ». **Raté** : flux en deux temps (copier puis coller spécial), pas de conversation.

### 1.7 WritingTools (theJayTea, open source)
- Sélection + raccourci → fenêtre de boutons (Relire, Réécrire, Résumer…) + consigne libre + mode Chat ; Gemini, OpenAI-compatible, Ollama (v7, rapporté newreleases.io). **Windows v9 (10 mai, année non affichée, très probablement 2026)** : Gemma 4, **raccourci par bouton** (ex. Relire = Ctrl+`), popup plus rapide — vérifié (github releases).
- Le plus proche d'Overtype en open source. **Raté** : releases Windows espacées, défauts orientés clé Gemini gratuite (cloud).

### 1.8 Grammarly → Superhuman Go
- Renommage Superhuman + assistant Go le 29/10/2025 — rapporté (businesswire, thurrott). Desktop Windows/Mac : « AI Chat » remplace Go, **utilise la fenêtre/document actif, on peut joindre une autre fenêtre** ; seuls Go et Proofreader sur desktop — rapporté (help.superhuman.com, page non datée). Payant depuis 01/02/2026 (rapporté).
- **Remarquable** : soulignement inline + panneau latéral = standard de la correction ; « agents » spécialisés. **Raté** : 100 % cloud, abonnement.

### 1.9 Clients « modèles locaux / multi-fournisseurs »

- **LM Studio** — 0.4.0 (28/01/2026) : daemon headless `llmster`, requêtes parallèles, **Split View** (2 chats côte à côte), nouvelle recherche de modèles ; 0.4.5 (25/02/2026) : **LM Link** = utiliser les modèles d'une autre machine comme s'ils étaient locaux (chiffré, avec Tailscale) — vérifié (lmstudio.ai/changelog). **Bionic** (annoncé 16/07/2026) : app agent séparée (Work/Code Projects, fichiers Office en sandbox, clavier vocal système, « Secure Cloud » zéro rétention) — rapporté (alternativeto 07/2026) ; 1.1.4–1.1.8 (17/09–09/10/2026) : **Canvas** éditable à deux, aperçu Word/Excel/PowerPoint, sessions cherchables Ctrl/Cmd+P, @-mention d'autres sessions, statut du prompt-processing — vérifié (changelog). Closed source critiqué (HN, rapporté). Badges « tient en VRAM » et icônes vision/tools du catalogue : non revérifiés en 2026. → **LM Link = modèle du « serveur GPU d'équipe vu comme local »**.
- **Jan** — v0.8.4 (23/07) : clés dans le trousseau OS, passerelle OpenAI-compatible (Responses API), web search natif ; v0.8.5 (08/10) : llama.cpp embarqué, **assistant de premier lancement guidé**, serveur local bindé sur 0.0.0.0 restreint aux hôtes de confiance ; v0.8.6 (09/10) — vérifié (github.com/janhq/jan/releases). → onboarding guidé + secrets au keyring = attentes de base.
- **AnythingLLM** — v1.16.1 (27/08) : **Foundry Local embarqué (Windows 11)**, NPU Snapdragon ; v1.16.2 (22/09) ; v1.17.0 (01/10) : ingestion XLSX multi-feuilles, mbox, réglages de workspace auto-enregistrés, effort de raisonnement — vérifié (github Mintplex-Labs/anything-llm/releases). → « **workspace = dossier de docs + modèle + agent** », très lisible pour des non-techs.
- **Msty Studio** — 3.0.0 Beta 15 (07/10/2026) : Agent Mode, en-têtes custom pour fournisseurs OpenAI-compatibles ; Beta 14 (26/09) : MCP OAuth, Personas ; stable 2.9.11 (15/09) — vérifié (msty.ai changelog). Split Chats (plusieurs modèles côte à côte), Knowledge Stacks (RAG), branches — vérifié (msty.ai, billet 2.5.0 mars 2026). Turnstiles : description introuvable. → **comparer 2–3 modèles sur le même prompt** = meilleur outil pour faire choisir un modèle local.
- **Cherry Studio** — v2.1.2–2.1.4 (21–30/09/2026 ; 2.1.3 : OCR système des captures sur Windows/macOS) — vérifié (github CherryHQ). **Selection Assistant** : barre flottante sur sélection dans toute app ; déclencheur au choix (sélection immédiate / **maintien de Ctrl, Windows seulement, pour éviter les pop-ups accidentels** / raccourci) ; actions Traduire, Expliquer, Résumer, Rechercher, Copier (+ Optimiser, Citer désactivées) ; prompts éditables et actions custom ; **modèle par action** ; fenêtre de résultat qui suit la barre ou centrée, épinglable, opacité 20–100 %, fermeture au clic dehors ; **liste blanche/noire d'apps par .exe** — vérifié (docs.cherryai.com.cn selection-assistant). **Quick Assistant** : mini-fenêtre globale Ctrl+E, Échap/clic dehors ferme, modèle global par défaut — vérifié (docs.cherry-ai.com). → **benchmark fonctionnel le plus proche de la cible (Îlot + mini-chat), à étudier en premier.**
- **Chatbox** — v1.23.2 (10/09/2026) : OAuth MCP distants, prompts de compaction ; v1.23.3 : une réponse tronquée **explique pourquoi et comment continuer** ; v1.23.5 (24/09) — vérifié (github chatboxai/chatbox/releases). Pas de mini-fenêtre trouvée.
- **Open WebUI** (déjà chez ATE) — v0.11.4 (21/09) : skills d'un serveur terminal à côté des skills de workspace, chargés à la demande ; **`/skills:create` fige le workflow qu'on vient de faire en skill** ; métadonnées de fichiers propagées dans les sources RAG ; prompts de démarrage et noms par langue ; v0.11.3 (31/08) : sélecteur de modèle avec **filtre et comparaison** ; v0.11.2 : aperçu Word/slides, **modèles épinglés démarrent avec leurs propres tools et skills** — vérifié (github open-webui/releases). Workspace = Models (préréglage : base + prompt système + knowledge + tools, visible dans le sélecteur), Knowledge (RAG), Prompts (`/` avec variables typées), Skills, Tools ; droit d'accès vérifié sur le préréglage ET le modèle de base — vérifié (docs.openwebui.com/features/workspace). `#` pour citer un doc : rapporté (guides tiers). → piste produit (déduit) : **réutiliser l'Open WebUI d'ATE comme back-office** (préréglages, knowledge, prompts déjà gouvernés) plutôt que tout réinventer côté desktop ; à vérifier ce que son API expose.

### 1.10 Autres qui comptent en 2026
- **Wispr Flow** — **Command Mode sur Windows** : sélectionner, maintenir le raccourci, dire l'édition, relâcher → remplacé ; sans sélection → réponse insérée au curseur ; Ctrl+Z pour annuler ; expérimental, payant — vérifié (docs.wisprflow.ai, maj 06/06/2026). C'est l'Îlot **à la voix**.
- **OpenClaw** (ex Moltbot/Clawdbot) — agent auto-hébergé via passerelle messageries, BYO model ; guides : ≥14B et ≥64k de contexte pour des tools fiables — rapporté (guides tiers 2026). Exécute shell/fichiers.
- **Microsoft 365 Copilot / Ask Copilot** — la référence que la DSI comparera (voir 1.3).
- Tendance 2026 : « joindre la fenêtre active » devient standard (ChatGPT Appshots, Claude quick entry, Superhuman, Raycast Screen Awareness).

---

## 2. Patterns d'interface à retenir

1. **Barre centrée façon Spotlight** — ChatGPT (Alt+Espace, Win+Alt+P), Gemini (Alt+Espace overlay), Claude quick entry, Raycast Quick AI, Cherry Quick Assistant (Ctrl+E). Constantes : une ligne qui grandit, Échap/clic dehors ferme, Entrée envoie, retour exact à l'app d'origine. Leçon Claude : **ne pas détourner le clic sur l'icône**. Leçon Copilot/Gemini/ChatGPT : **Alt+Espace est saturé** → défaut libre + détection de conflit au réglage (déduit ; OpenAI documente l'échec du raccourci s'il est déjà pris).
2. **Mini-chat ancré en coin qui s'agrandit** — compagnon ChatGPT (toujours au-dessus, mémorise la position, « ouvrir dans la fenêtre principale »), Copilot Quick View vs plein écran, Cherry (épingle, opacité, suit la barre ou centré). Schéma cible : `barre centrale → Entrée → la barre se « pose » en mini-chat bas-droite → agrandir → fenêtre complète + historique`. La conversation n'est jamais perdue à la fermeture (ChatGPT).
3. **Sélection attachée comme puce de contexte** — Cherry « Citer » (sélection → conversation), Superhuman (fenêtre active + « joindre une autre fenêtre »), ChatGPT Appshots (image + texte). Forme : puce retirable au-dessus du champ (« 412 mots · Outlook »), aperçu au survol, plusieurs puces (sélection + fenêtre + fichier).
4. **Slash commands / bibliothèque de prompts** — Open WebUI `/` avec variables typées ; Raycast `{selection}` + `{argument}` + partage d'équipe ; Open WebUI `/skills:create` ; WritingTools/PowerToys **raccourci par action**. Entreprise : bibliothèque **partagée et versionnée par l'admin** + « mes commandes ».
5. **Sélecteur de modèle** — observé : **par commande** (Raycast, Cherry), par conversation (tous), **épinglés avec leurs tools** (Open WebUI 0.11.2), **filtre + comparaison** (Open WebUI 0.11.3, Msty Split Chats, LM Studio Split View), effort de raisonnement à côté (ChatGPT, AnythingLLM, Chatbox), liste déroulante dans la fenêtre d'action (PowerToys). À ajouter pour des non-techs (déduit) : présenter des **rôles** (« Rapide », « Précis », « Vision », « Long document ») avant les noms ; badges local/cloud, vision, tools, contexte max, **vitesse mesurée sur ce poste** ; routage automatique par action avec surcharge ; modèle indisponible → bascule **visible**, jamais silencieuse.
6. **Historique et recherche** — Ctrl+K (ChatGPT), Ctrl/Cmd+P sessions (Bionic 1.1.7), @-mention d'une autre session (Bionic 1.1.4), plein texte des sessions (Hermes). Pour Overtype : les **actions Îlot aussi** dans l'historique (avant/après), pas seulement les chats.
7. **Canvas / artefact** — Bionic Canvas éditable à deux + aperçu Office ; Open WebUI aperçu Word/slides ; ChatGPT plugins avec éditeurs de fichiers. Bureautique : panneau « document » à côté du mini-chat pour un mail long ou un CR, **diff avant/après**, bouton « réinsérer ».
8. **Voix** — Wispr Command Mode (sélection + voix → remplacement), Claude quick entry (Verr. Maj), Raycast Dictation (collage contextuel), « Hey Copilot ». Push-to-talk > mot d'éveil en open space (déduit).
9. **Capture d'écran comme contexte** — Claude (zone ou fenêtre depuis la barre), ChatGPT Appshots (double Alt), Cherry OCR système, PowerToys OCR local. Avec modèles locaux : **OCR local d'abord, vision ensuite** (déduit : petits VLM fragiles, OCR moins cher).
10. **Réponse réinsérée dans l'app source** — Raycast Output Behavior « remplacer la sélection » et « Paste Formatted Response », Wispr insertion au curseur, Overtype. Variantes **par commande** : Remplacer / Insérer dessous / Copier / Ouvrir dans le chat, + Annuler (Overtype 8 s, Wispr Ctrl+Z).
11. **Garde-fous contextuels** — liste blanche/noire d'apps (Cherry), politique admin des apps lisibles (ChatGPT Enterprise, rapporté). Indispensable : gestionnaires de mots de passe, RH, banque.

---

## 3. Cas d'usage entreprise (★ = non évident et fort impact)

Format : **Geste** · contexte capturé · capacité modèle · local (✅ bien / ⚠️ dépend taille-contexte / ❌ mauvais). Tout ce bloc est **déduit** (aucun banc fait ici).

### Écriture
1. **Corriger / ton pro / raccourcir** · sélection · texte court · ✅ (existant).
2. **Répondre à un mail en 3 variantes** (accepter / décliner / demander une précision) · sélection ou fenêtre Outlook · génération courte · ✅.
3. ★ **« Explique-le à un non-technicien »** : vulgariser une explication technique pour client/manager · sélection · réécriture contrainte · ✅.
4. ★ **Harmonisation terminologique** : réécrire selon le **glossaire interne** (noms produits, sigles imposés, termes interdits) · sélection + glossaire (knowledge Open WebUI) · prompt + petit RAG · ✅.
5. **Traduire en gardant la structure** (puces, tableaux Markdown, variables `{x}`, balises) · sélection · traduction · ✅ (point fort des locaux).

### Lecture / synthèse
6. **Fil de mails → décisions / actions / questions ouvertes** · sélection ou fenêtre · sortie JSON rendue en liste · ⚠️ long contexte.
7. ★ **« Qu'attend-on de moi ? »** : extraire seulement les demandes adressées à l'utilisateur, avec échéances · sélection/fichier · extraction structurée · ✅.
8. ★ **Comparer deux versions** (contrat, spec, procédure) et lister les changements **de sens**, pas de forme · deux fichiers/sélections · diff calculé par l'app puis expliqué par le modèle · ⚠️ (✅ si diff pré-calculé).
9. **PDF/norme → FAQ** · fichier · long contexte / RAG · ⚠️.

### Technique / IT
10. ★ **Log ou stack trace → cause probable, ligne clé, prochaine commande** · sélection, fenêtre console · explication d'erreurs · ✅/⚠️ (excellent si l'app tronque autour de l'erreur).
11. **Regex / XPath / PowerShell depuis des exemples**, avec **test immédiat sur la sélection** affiché · sélection · code · ✅.
12. **SQL depuis une question** avec le schéma collé · sélection · code · ✅/⚠️.
13. ★ **Capture d'une erreur (Windows, appli métier) → explication + ticket pré-rempli** (titre, étapes, impact, version) · capture + OCR · OCR/vision + JSON · ⚠️.
14. **Expliquer un script / une macro VBA hérités** · sélection · lecture de code · ✅.
15. ★ **Mail d'utilisateur mécontent → ticket classé** (catégorie, priorité, composant, résumé neutre) · sélection · classification + JSON · ✅ (classification = point fort des petits modèles).

### Données / tableur
16. **Formule Excel depuis une phrase**, et explication d'une formule existante · sélection · code · ✅.
17. ★ **Texte en vrac → tableau** (liste de mails, PDF copié, notes) : colonnes proposées, collage en TSV direct dans Excel · sélection · extraction JSON → TSV · ✅ (excellent cas local).
18. ★ **Nettoyer une colonne copiée** (noms, dates, unités, casse, doublons probables), même nombre de lignes garanti par l'app · sélection multi-lignes · transformation ligne à ligne · ✅.
19. **Expliquer un tableau/graphique en 3 phrases** · fenêtre · vision · ⚠️/❌ (petits VLM fragiles sur graphiques).

### Réunions / mails / organisation
20. **Notes brutes → compte rendu** (décisions, actions porteur/date) · sélection · structuration · ✅.
21. ★ **Mail → événement ou tâche** (date, lieu, participants → .ics / tâche) · sélection · extraction JSON + tool · ✅.
22. **Préparer une réunion** : questions et docs à relire depuis l'ordre du jour · sélection + knowledge · RAG · ⚠️.
23. ★ **Dictée en marchant → mail propre** (voix + Îlot, façon Wispr Command Mode) · micro · STT local + réécriture · ⚠️ (latence).

### Connaissance interne
24. **Questions sur les procédures internes, avec citations** · requête + knowledge Open WebUI · RAG · ⚠️ (qualité = indexation).
25. ★ **Depuis une sélection (nom de projet, référence, sigle) → docs internes liés et dernière version** · sélection · RAG + métadonnées (Open WebUI 0.11.4 propage les métadonnées) · ⚠️.
26. ★ **Transformer une réponse réussie en commande partagée** (façon `/skills:create` Open WebUI, partage d'équipe Raycast) : capitaliser les prompts qui marchent · historique · aucune · ✅ (fonction produit).
27. **Onboarding : expliquer un jargon interne sur sélection** · sélection + glossaire · petit RAG · ✅.

### Conformité / sécurité
28. ★ **Anonymiser avant d'envoyer** : repérer noms, mails, téléphones, n° clients, IBAN et les pseudonymiser (réversible localement) avant tout envoi vers un cloud ou un prestataire · sélection · NER + JSON des spans · ✅ (et c'est **l'argument** du local).
29. ★ **Contrôle d'un mail sortant** : pièce jointe annoncée mais absente, destinataire externe + « confidentiel », ton agressif, engagement de délai · brouillon · classification + règles · ✅.
30. **Réponse à exigences / appel d'offres** : cocher chaque exigence contre un document · deux sélections/fichiers · long contexte + JSON · ⚠️.

### Ce que les modèles locaux font bien / mal (déduit, à confirmer par bancs internes)
- **Bien** : traduction, correction, reformulation, classification, extraction JSON avec schéma imposé, explication d'erreurs courantes, regex/SQL/formules courtes, NER/anonymisation, résumés de textes courts.
- **Mal / risqué** : calculs et agrégations (les faire faire par l'app), faits absents du contexte (hallucination), très long contexte (dégradation + prefill lent), vision fine (graphiques, petits caractères), tool calling multi-étapes avec petits modèles (guides OpenClaw 2026 : ≥14B, rapporté), langues rares.
- Conséquence UX : chaque action pointe vers un **profil de modèle**, et l'app annonce la limite (« trop long pour le modèle rapide → passer au modèle long contexte ? »).

---

## 4. Pièges connus

- **Vie privée / stockage** : conversations en clair hors sandbox (ChatGPT macOS, juillet 2024 — rapporté, ghacks 08/07/2024) ; Appshots envoient image + texte de l'app même si stockés localement (rapporté). → historique chiffré, rétention réglable, **liste noire d'apps** (Cherry), indicateur de destination (local vs cloud) avant envoi, journal consultable.
- **Secrets** : clés API dans le stockage de la webview = mauvais ; Jan est passé au trousseau OS en 0.8.4 (vérifié).
- **Serveur local exposé** : Jan restreint désormais son serveur bindé sur 0.0.0.0 aux hôtes de confiance (0.8.5, vérifié).
- **Latence** : prefill long en local ; au-delà de ~3 s une pilule ne suffit plus (déduit) → streaming, progression, annulation ; Bionic affiche l'état du prompt-processing faute de pourcentage (1.1.5, vérifié).
- **Vol de focus** : l'overlay qui prend le focus casse la sélection et la réinsertion ; rendre le focus à la bonne fenêtre, rester hors Alt+Tab (déduit, pas de source primaire). Barre qui surgit à chaque sélection = agaçant → Cherry propose « maintenir Ctrl » (vérifié).
- **Conflits de raccourcis** : Alt+Espace revendiqué par Copilot, ChatGPT, Gemini (vérifié/rapporté).
- **Surprise de surface** : Claude Windows ouvre la quick entry au clic sur l'icône, sans option, issue fermée par bot (vérifié #22420).
- **Prolifération** : ChatGPT 2026 = Chat, Work, Codex, Space, Pages, Meetings, plugins (vérifié releasebot) ; Copilot retire Notebooks/Connectors/Vision pendant sa refonte (vérifié 14/08/2026). → 1 geste (Îlot) + 1 surface (mini-chat), le reste en commandes.
- **Monétisation qui casse l'usage** : Raycast v2 met local/BYOK derrière Pro (vérifié) ; Superhuman Go payant depuis 01/02/2026 (rapporté).
- **Maintenance** : capture/réinsertion app par app (Office, navigateurs, terminaux, Electron/Java), évolutions d'API serveur (Jan ajoute une passerelle Responses API en 0.8.4), formats de tool calling par famille (LM Studio corrige Qwen 3.5 en 0.4.5) — exemples vérifiés, généralisation déduite.
- **Agents autonomes** : OpenClaw/Hermes exécutent shell et fichiers ; en entreprise toute action à effet de bord doit être proposée puis confirmée (déduit).

---

## 5. Non vérifié / où j'ai cherché

- help.openai.com (release notes, page Windows) → 403 : Quick Chat Win+Alt+P, Appshots Windows 11/09/2026, politiques admin apps natives = **rapportés** seulement.
- « Work with apps » ChatGPT sur Windows : aucune preuve trouvée.
- Claude quick entry Windows : doc officielle « non disponible » vs issue GitHub (forme minimale) ; non testé.
- Copilot : GA de Ask Copilot / Click to Do Excel non confirmée ; seule source primaire = notes Insider 14/08/2026.
- Raycast Windows : Screen Awareness, attachements non lus en détail.
- LM Studio : badges VRAM/vision/tools non revérifiés ; changelog lu = surtout Bionic.
- Msty Turnstiles : description introuvable. Superhuman : page d'aide non datée. Hermes : ni raccourci global ni version sur la page desktop. WritingTools : dates sans année sur GitHub.
- Sources primaires lues : README hermes-agent ; hermes-agent.nousresearch.com/desktop ; docs.ollama.com ; support.claude.com 12626668 ; issue claude-code#22420 ; raycast.com/changelog/windows/{0-63,0-65,2-0,2-2} ; manual.raycast.com ; learn.microsoft.com (Copilot Insider, Advanced Paste) ; releases GitHub de PowerToys, WritingTools, Jan, AnythingLLM, Cherry Studio, Chatbox, Open WebUI ; lmstudio.ai/changelog ; msty.ai changelog ; docs Cherry ; docs.openwebui.com ; docs.wisprflow.ai ; blog.google.

## Sources
- https://github.com/NousResearch/hermes-agent
- https://hermes-agent.nousresearch.com/desktop
- https://the-decoder.com/nous-research-releases-hermes-desktop-an-open-source-ai-agent-for-every-platform/
- https://docs.ollama.com/integrations/hermes-desktop
- https://releasebot.io/updates/openai/openai-windows-app
- https://releasebot.io/updates/openai/chatgpt
- https://windowsreport.com/?p=1509199
- https://omidsaffari.com/blog/chatgpt-appshots-cut-context-copying-windows
- https://www.ghacks.net/2024/07/08/chatgpts-macos-app-was-storing-chats-in-plain-text-but-it-has-been-patched/
- https://support.claude.com/en/articles/12626668-use-quick-entry-with-claude-desktop-on-mac
- https://github.com/anthropics/claude-code/issues/22420
- https://learn.microsoft.com/en-us/windows-insider/release-notes/apps/copilot-on-windows
- https://www.windowslatest.com/2026/05/27/microsoft-confirms-ask-copilot-is-coming-to-the-windows-11-taskbar-in-mid-2026/
- https://windowslatest.com/2025/01/09/microsoft-really-wants-you-to-use-altspace-to-open-copilot-anytime-on-windows-11
- https://blog.google/innovation-and-ai/products/gemini-app/the-gemini-app-is-now-available-for-windows/
- https://www.raycast.com/changelog/windows/0-63
- https://www.raycast.com/changelog/windows/0-65
- https://www.raycast.com/changelog/windows/2-0
- https://www.raycast.com/changelog/windows/2-2
- https://manual.raycast.com/ai/ai-commands
- https://devblogs.microsoft.com/commandline/powertoys-0-96-is-here-endpoints-for-advanced-paste-metadata-support-for-powerrename-and-more
- https://learn.microsoft.com/windows/powertoys/advanced-paste
- https://github.com/microsoft/PowerToys/releases
- https://github.com/theJayTea/WritingTools/releases
- https://help.superhuman.com/hc/en-us/articles/46242137727757
- https://www.thurrott.com/a-i/328965/grammarly-rebrands-to-superhuman-and-launches-new-ai-suite
- https://lmstudio.ai/changelog
- https://alternativeto.net/news/2026/7/lm-studio-bionic-launches-as-new-ai-agent-for-open-models/
- https://github.com/janhq/jan/releases
- https://github.com/Mintplex-Labs/anything-llm/releases
- https://msty.ai/resources/changelog/studio/
- https://msty.ai/blog/msty-studio-2-5-0-quiet-revolution
- https://github.com/CherryHQ/cherry-studio/releases
- https://docs.cherryai.com.cn/docs/en-us/cherry-studio/preview/selection-assistant
- https://docs.cherry-ai.com/en-us/preview/quick-assistant
- https://github.com/chatboxai/chatbox/releases
- https://github.com/open-webui/open-webui/releases
- https://docs.openwebui.com/features/workspace/
- https://docs.wisprflow.ai/articles/4816967992-how-to-use-command-mode
- https://vallettasoftware.com/blog/post/openclaw-ollama
