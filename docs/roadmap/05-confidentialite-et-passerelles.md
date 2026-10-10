# 05 · Confidentialité et passerelles : envoyer ailleurs, sans laisser fuir

> Statut : **exploration** (10/10/2026). Rien n'est mesuré : aucune promesse de taux de détection avant le banc décrit en §6.
> Source : [recherches/2026-10-10-anonymisation-passerelles.md](recherches/2026-10-10-anonymisation-passerelles.md).

## Le besoin (mots de Lucas)

> « Un bouton qui ouvrirait directement une nouvelle conversation dans le navigateur avec ChatGPT, avec les données sélectionnées, mais qui, avant, auraient été automatiquement anonymisées, pour éviter que des données d'entreprise soient envoyées à GPT. »

## Trois destinations, trois niveaux

| Destination | Exemple | Masquage | Pourquoi |
|---|---|---|---|
| **Locale / interne** | Îlot, chat sur le vLLM d'ATE | aucun | la donnée ne sort pas |
| **Open WebUI d'ATE** (navigateur) | « Ouvrir dans Open WebUI » | aucun par défaut | la donnée reste interne |
| **Externe** | ChatGPT, Claude, Le Chat, Copilot grand public | **aperçu pseudonymisé obligatoire** | la donnée quitte l'entreprise |

## Ouvrir une conversation pré-remplie : ce qui marche vraiment

| Cible | Lien | Statut (10/10/2026) |
|---|---|---|
| **Open WebUI** | `https://<owui>/?model=<id>&temporary-chat=true&submit=false&q=<texte>` | **documenté et lu dans le code** (0.11.4). `submit=false` = pré-remplit sans envoyer. Le pré-remplissage survit à la page de connexion. |
| ChatGPT | `https://chatgpt.com/?q=<texte>` (+ `temporary-chat=true`, `model=` : expérimental) | **non documenté par OpenAI**, connu par des outils tiers ; le message **part tout seul** selon des rapports de forum |
| Claude | `https://claude.ai/new?q=<texte>` | non documenté, rapporté |
| Le Chat | `https://chat.mistral.ai/chat?q=<texte>` | non documenté, rapporté |
| Copilot grand public | `https://copilot.microsoft.com/?q=<texte>` | non documenté, rapporté ; rien pour M365 Copilot Chat |
| Gemini | pas de lien fiable → **copier puis ouvrir** | — |

Conséquences :
- les gabarits vivent dans une **table de configuration** modifiable sans release (et filtrable par l'admin) ;
- **seuils de longueur** : URL encodée ≤ 7 000 octets pour un Open WebUI derrière nginx (8 Ko par défaut → erreur 414), ≤ 12 000 pour les services publics ; au-delà, **repli** : texte pseudonymisé dans le presse-papiers, ouverture de la page sans `q`, message « Collez avec Ctrl+V » ;
- un texte dans `?q=` finit dans l'historique du navigateur (synchronisé si le compte l'est) et dans les journaux du proxy : à dire dans l'aperçu.

## Pipeline de pseudonymisation recommandé (tout en Rust, aucun runtime ajouté)

```
 Sélection
    │
    ▼
 [1] Détecteurs déterministes (Rust, local, < 5 ms visés)
     e-mails, téléphones, IBAN (mod 97), cartes (Luhn), SIREN/SIRET, NIR,
     IP, noms d'hôtes et chemins internes, secrets (règles gitleaks),
     dictionnaire d'entreprise : clients, projets, produits (Aho-Corasick)
    │
    ▼
 [2] Noms de personnes, organisations, lieux, projets
     → LLM interne d'ATE via le client existant, sur le texte DÉJÀ masqué par [1],
       réponse JSON, chaque entité revérifiée littéralement dans le texte
       (hors ligne : couche 1 seule + bandeau « noms non détectés »)
    │
    ▼
 [3] Aperçu surligné (React) : l'utilisateur ajoute / retire des masques, choisit la destination
    │
    ▼
 [4] Jetons [PERSONNE_1], [CLIENT_2]… ; correspondance gardée en local (SQLite + DPAPI, durée courte)
    │
    ▼
 [5] Ouverture : lien pré-rempli, ou presse-papiers + page
    │
 Retour : « Rétablir les noms » sur la réponse collée ou sélectionnée (remplacement tolérant, diff surligné)
```

- **Python / Presidio côté client : non.** Presidio n'a aucun détecteur français (ni NIR, ni SIREN/SIRET) et ajouterait un second runtime. S'il le fallait un jour, ce serait côté serveur (filtre Open WebUI), jamais sur le poste.
- **Modèle NER local (ONNX)** : option pour plus tard, derrière la même interface de détecteur. GLiNER2-PII multilingue pèse 0,6 à 1,2 Go, `ort` est encore en *release candidate*, et **aucun chiffre en français n'est publié**. Meilleur F1 multilingue publié sur le banc SPY : 0,477.
- **Jetons plutôt que faux noms** : un faux nom peut tomber sur une vraie personne, se faire traduire (« Jean » → « John ») et casser le rétablissement. Les faux noms restent une option avancée.

## Le parcours « Ouvrir dans ChatGPT ⛨ »

```
 ┌ Envoyer vers ChatGPT ───────────────────────────────────────────── ✕ ┐
 │ Bonjour [PERSONNE_1], suite à notre échange sur le dossier            │
 │ [CLIENT_1], je vous confirme que le virement sur [IBAN_1] …           │
 │                                                                       │
 │ 7 éléments masqués   personnes 2 · clients 1 · IBAN 1 · e-mails 3    │
 │ Cliquez un mot pour le masquer, un masque pour le retirer.            │
 │ ☑ Conversation temporaire                                             │
 │ ⚠ Pseudonymisé, pas anonyme : relisez le contexte (poste, site, date).│
 │                                      [Copier]  [Ouvrir dans ChatGPT]  │
 └───────────────────────────────────────────────────────────────────────┘
```

Wording : **« pseudonymisé »**, jamais « anonymisé ». Pour la CNIL, une donnée pseudonymisée reste une donnée personnelle pour qui détient la correspondance (ici, l'entreprise).

## L'admin et la DLP

- **Microsoft Purview Endpoint DLP** sait bloquer le *collage* vers ChatGPT ; un lien `?q=` ne passe pas par un collage et **contourne ce contrôle**. Overtype ne doit jamais passer pour un outil de contournement : le dire, et donner à l'admin une politique machine (registre ou fichier) pour **restreindre ou couper les destinations externes**.
- Dans un Edge géré, l'inspection en ligne des prompts verra quand même le texte envoyé : bon filet de sécurité.
- Journal local : destination, nombre de masques, jamais le texte.

## 6. À mesurer avant de promettre quoi que ce soit

1. **Corpus maison** FR + EN, 200 à 500 documents réels masqués à la main (mails, tickets, CR, logs, juridique, RH), double annotation.
2. **Rappel par type d'entité** d'abord (une fuite coûte plus cher qu'un faux positif), puis précision ; et le taux de documents « sans aucune fuite ».
3. Comparer : couche 1 seule · couche 1 + LLM interne (2-3 modèles) · couche 1 + GLiNER2-PII · couche 1 + `camembert-ner`.
4. Latence p50/p95 sur un poste **sans GPU**.
5. Taux de jetons altérés par ChatGPT/Claude dans les réponses, taux de rétablissement correct.
6. Longueur réelle acceptée par chatgpt.com, claude.ai et l'Open WebUI d'ATE derrière son proxy.
7. Test automatique mensuel des gabarits d'URL, puisque rien n'est garanti par les éditeurs.
