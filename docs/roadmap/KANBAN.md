# Kanban des idées

> Tableau vivant des pistes pour les prochaines releases. **Une carte n'est pas un engagement** : elle entre dans une release seulement via un plan (`docs/PLAN-x.y.md`) validé par Lucas.
> Mis à jour le 10/10/2026.

**Comment s'en servir**
- Nouvelle idée → une ligne dans 💡 avec le prochain numéro libre (`OT-0xx`), son axe et son origine.
- Une carte avance de colonne quand sa question est tranchée : on la **déplace** (couper/coller la ligne), on ne la duplique pas.
- Une carte écartée garde sa raison : on ne rediscute pas sans élément nouveau.

**Axes** : `SUR` surfaces · `GES` gestes et entrées · `MOT` moteur et architecture · `MOD` modèles · `CONF` confidentialité et passerelles · `CTX` contexte (fichiers, captures, logs) · `ENT` entreprise et admin · `USE` cas d'usage · `DET` dette.
**Effort** : S (jours) · M (1-2 semaines) · L (plus). **Origine** : *Lucas* (demande du 10/10/2026) ou *Recherche*.

---

## ✅ Prêt à planifier — décidé sur le fond, sans question de design ouverte

Le « lot 0 » de [03-architecture.md](03-architecture.md) §4 : invisible pour l'utilisateur, requis par presque tout le reste.

| ID | Carte | Axe | Effort | Dépend de | Origine |
|---|---|---|---|---|---|
| OT-001 | Découper `lib.rs` (4 109 lignes) par domaine, sans changer le comportement | MOT | M | — | Recherche |
| OT-002 | Capturer la sélection **sans ouvrir la bulle** (chemin réutilisable par la barre et le chat) | MOT | S | OT-001 | Recherche |
| OT-003 | Module `llm/` : requête à messages multiples, images, `tool_calls`, `reasoning`, `json_schema` ; fin du doublon `probe.rs:701` | MOT | M | — | Recherche |
| OT-004 | Types du pont **générés depuis Rust** (`ts-rs`) ; une seule source pour les valeurs par défaut | MOT | M | — | Recherche |
| OT-005 | Nettoyage : parcours v4 (`uiVersion`), `bytes`, `thiserror`, double accès au presse-papiers | DET | S | — | Recherche |
| OT-006 | Store SQLite : migrations `user_version`, `rusqlite` 0.40, schéma des conversations | MOT | S | — | Recherche |
| OT-007 | Routeur d'entrée : arguments de la 2ᵉ instance et schéma d'URI → « Demandes » | GES | S | OT-001 | Recherche |
| OT-008 | Watchdog, anti-rafale et cible **par session** (Îlot ≠ conversation) | MOT | S | OT-001 | Recherche |

## 📐 À concevoir — besoin d'une maquette ou d'un QCM avec Lucas

| ID | Carte | Axe | Effort | Dépend de | Origine | Doc |
|---|---|---|---|---|---|---|
| OT-010 | **Barre de saisie au centre** de l'écran (raccourci « demander »), sélection en puce | SUR | M | OT-002, OT-003 | *Lucas* | [02](02-surfaces-et-gestes.md) |
| OT-011 | **Chat compact en bas à droite**, agrandissable en fenêtre complète, conversation jamais perdue | SUR | L | OT-003, OT-006, OT-008 | *Lucas* | [02](02-surfaces-et-gestes.md) |
| OT-012 | Puces de contexte (sélection, fichier, capture, log filtré) retirables, avec aperçu | SUR | M | OT-010 | Recherche | [02](02-surfaces-et-gestes.md) |
| OT-013 | Comportement de sortie par action : Remplacer · Insérer · Copier · Ouvrir dans le chat · Ouvrir ailleurs | SUR | M | — | Recherche | [02](02-surfaces-et-gestes.md) |
| OT-014 | **Sélection de modèle par rôles** (Rapide, Précis, Vision, Long document), badges destination et capacités | MOD | M | OT-003 | *Lucas* | [04](04-modeles.md) |
| OT-015 | **« Ouvrir dans ChatGPT / Open WebUI ⛨ »** avec aperçu pseudonymisé | CONF | M | OT-021, OT-022 | *Lucas* | [05](05-confidentialite-et-passerelles.md) |
| OT-016 | **Ctrl + clic droit** (ou bouton latéral) sur une sélection → Îlot au curseur (la réponse au « clic droit ») | GES | S–M | — | *Lucas* | [02](02-surfaces-et-gestes.md) §2 |
| OT-017 | Historique et recherche des conversations (et des actions de l'Îlot, avant/après) | SUR | M | OT-006, OT-011 | Recherche | [03](03-architecture.md) §5 |
| OT-018 | **Commandes unifiées** : actions de l'Îlot = commandes `/` de la barre et du chat = entrées de l'Explorateur | SUR | M | OT-004 | Recherche | [03](03-architecture.md) §2 |
| OT-019 | Rendu markdown des réponses (flux, code coloré, sans HTML brut ni images distantes) | SUR | S | — | Recherche | [03](03-architecture.md) §3 |

## 🔍 À explorer — prototype, mesure ou recherche avant de concevoir

| ID | Carte | Axe | Effort | Dépend de | Origine | Doc |
|---|---|---|---|---|---|---|
| OT-020 | **Open WebUI d'ATE comme fournisseur** : clés API (à activer par l'admin), flux SSE, paramètres transmis ou rejetés | MOD | S | accès admin ATE | *Lucas* | [04](04-modeles.md) |
| OT-021 | Gabarits d'URL ChatGPT, Claude, Le Chat : envoi auto ou non, longueur max réelle, test mensuel | CONF | S | — | *Lucas* | [05](05-confidentialite-et-passerelles.md) |
| OT-022 | Détection des noms par le LLM interne : corpus maison FR+EN, **rappel par type** | CONF | M | OT-003 | *Lucas* | [05](05-confidentialite-et-passerelles.md) §6 |
| OT-023 | Dictionnaire d'entreprise (clients, projets, produits) : qui le tient, quel format, quelle mise à jour | CONF / ENT | S | — | Recherche | [05](05-confidentialite-et-passerelles.md) |
| OT-024 | **Pipeline logs** : repli des doublons, erreurs ± contexte, budget compté par `/tokenize` | CTX | M | OT-003 | *Lucas* | [06](06-cas-usage.md) |
| OT-025 | Fichiers PDF, DOCX, XLSX : extraction dans un sous-processus (`panic = "abort"`) | CTX | M | OT-007 | Recherche | [03](03-architecture.md) §3 |
| OT-026 | Capture d'écran ou de fenêtre + OCR Windows comme contexte | CTX | M | OT-002 | Recherche | [03](03-architecture.md) §3 |
| OT-027 | Mesurer la mémoire d'une fenêtre WebView2 de plus (barre et chat : étage de l'overlay ou fenêtres à part ?) | MOT | S | — | Recherche | [03](03-architecture.md) §5 |
| OT-028 | Banc **tool calling** sur les modèles d'ATE (vLLM : `--enable-auto-tool-choice`, parseur) | MOD | M | OT-003 | Recherche | [03](03-architecture.md) §6 |
| OT-029 | **Sparse package signé** (PKI interne d'ATE ?) → clic droit moderne de l'Explorateur, Partager, touche Copilot | GES / ENT | L | OT-007 | *Lucas* | [02](02-surfaces-et-gestes.md) §2 |
| OT-030 | Extension Edge/Chrome : clic droit › Overtype dans le navigateur, native messaging | GES | M | OT-007 | Recherche | [02](02-surfaces-et-gestes.md) §2 |
| OT-031 | Client MCP (`rmcp`) avec approbation outil par outil | MOT | L | OT-028, montée `reqwest` 0.13 | Recherche | [03](03-architecture.md) §6 |
| OT-032 | « Comparer » deux rôles côte à côte, pour aider un service à choisir son modèle | MOD | M | OT-011 | Recherche | [04](04-modeles.md) |
| OT-033 | Politiques admin : destinations externes autorisées, apps exclues, liaison des rôles, poussées par fichier machine ou registre | ENT | M | — | Recherche | [05](05-confidentialite-et-passerelles.md) |
| OT-034 | Revoir le centrage des contrôles (pilule, Îlot, boutons, interrupteurs) en vraie fenêtre (retour du 28/09/2026) | DET | S | — | *Lucas* | — |

## 💡 Idées — à trier

| ID | Carte | Axe | Origine |
|---|---|---|---|
| OT-040 | « Rétablir les noms » sur une réponse revenue de ChatGPT | CONF | Recherche |
| OT-041 | Contrôle d'un mail avant envoi (pièce jointe annoncée absente, destinataire externe, ton) | USE | Recherche |
| OT-042 | Texte en vrac → tableau collable dans Excel | USE | Recherche |
| OT-043 | Comparer deux versions d'un document (changements de sens) | USE | Recherche |
| OT-044 | Capture d'erreur → ticket pré-rempli | USE | Recherche |
| OT-045 | « Qu'attend-on de moi ? » sur un fil de mails | USE | Recherche |
| OT-046 | Harmoniser un texte au glossaire interne | USE | Recherche |
| OT-047 | Transformer une réponse réussie en commande partagée avec l'équipe | ENT | Recherche |
| OT-048 | Dictée vocale : l'Îlot à la voix (sélection + raccourci maintenu + consigne dite) | SUR | Recherche |
| OT-049 | Barre flottante qui apparaît à la sélection à la souris (opt-in) | GES | Recherche |
| OT-050 | Complément Word / Excel / PowerPoint (pas Outlook : pas de clic droit pour les add-ins) | GES / ENT | Recherche |
| OT-051 | Panneau « document » à côté du chat : brouillon long, diff avant/après, réinsérer | SUR | Recherche |
| OT-052 | Envoyer vers › Overtype et « Analyser avec Overtype » sur `.log`/`.txt` (sans identité de package) | GES | Recherche |
| OT-053 | Traduire un document entier en gardant la mise en forme (hors périmètre de la V1 jusqu'ici) | USE | Recherche |
| OT-054 | Mémoire de l'utilisateur : préférences de ton, signature, glossaire perso (façon Hermes) | SUR | *Lucas* (« comme Hermès ») |
| OT-055 | Notes brutes de réunion → compte rendu (décisions, porteur, date) | USE | Recherche |
| OT-056 | Mail → événement ou tâche (`.ics`) | USE | Recherche |
| OT-057 | Répondre à une question sur les procédures internes, avec citations (connaissance Open WebUI) | USE | *Lucas* (« interne ») |

## 🗄️ Écarté — avec la raison

| Idée | Pourquoi |
|---|---|
| Injecter une entrée dans le menu contextuel du texte des autres apps | Aucune API Windows ; l'injection de DLL rate Office/Chromium/WinUI, ressemble à un malware pour les EDR, peut faire planter l'app hôte |
| Click to Do | PC Copilot+ seulement (NPU 40 TOPS, 16 Go) |
| PowerToys Command Palette | PowerToys rare en entreprise ; extension .NET séparée |
| Extension de message Teams | Cachée sous « Autres actions », effort élevé pour peu de visibilité |
| Clic droit **maintenu** comme geste par défaut | Retarde le menu natif de toutes les apps |
| Alt+Espace comme raccourci par défaut | Déjà revendiqué par Copilot, ChatGPT et Gemini |
| Python / Presidio dans le client | Second runtime ; aucun détecteur français |
| `streamdown` pour le rendu | HTML brut et liens ouverts par défaut, dépend de Tailwind |
| Agent autonome qui exécute shell et fichiers | Risque trop élevé en entreprise ; toute action à effet de bord reste confirmée par l'utilisateur |
| Routeur de modèles par LLM | Lent sur CPU, inexplicable ; des règles suffisent |
