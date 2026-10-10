# 06 · Cas d'usage : ce qu'Overtype pourrait faire pour ATE

> Statut : **idées** (10/10/2026). Rien n'est mesuré : la colonne « Local » est une estimation à confirmer par des essais sur les modèles d'ATE.
> ★ = non évident et fort impact. Source principale : [recherches/2026-10-10-paysage-ux.md](recherches/2026-10-10-paysage-ux.md) §3.
> Légende Local : ✅ les petits modèles le font bien · ⚠️ dépend de la taille ou du contexte · ❌ mauvais candidat.

## Écriture (le cœur actuel)

| Cas | Geste → surface | Contexte | Capacité | Local |
|---|---|---|---|---|
| Corriger, ton pro, raccourcir, traduire | sélection → Îlot | sélection | réécriture | ✅ existe |
| Répondre à un mail en 3 variantes (accepter, décliner, demander une précision) | sélection → Îlot « Répondre » → chat | sélection ou fenêtre Outlook | génération courte | ✅ |
| ★ Vulgariser pour un non-technicien (client, manager) | sélection → Îlot | sélection | réécriture contrainte | ✅ |
| ★ Harmoniser au **glossaire interne** (noms produits, sigles, termes interdits) | sélection → Îlot | sélection + glossaire | consigne + petit RAG | ✅ |
| Traduire en gardant la structure (puces, tableaux, `{variables}`, balises) | sélection → Îlot | sélection | traduction | ✅ |

## Lire et synthétiser

| Cas | Geste → surface | Contexte | Capacité | Local |
|---|---|---|---|---|
| Fil de mails → décisions, actions, questions ouvertes | sélection → chat | sélection | extraction structurée | ⚠️ long contexte |
| ★ « Qu'attend-on de moi ? » : seulement les demandes adressées à l'utilisateur, avec échéances | sélection → Îlot ou chat | sélection, fichier | extraction structurée | ✅ |
| ★ Comparer deux versions (contrat, spec, procédure) : changements **de sens**, pas de forme | deux sélections ou fichiers → chat | diff calculé par l'app, expliqué par le modèle | lecture | ✅ si diff pré-calculé |
| Notes brutes → compte rendu (décisions, porteur, date) | sélection → chat | sélection | structuration | ✅ |
| PDF, norme → FAQ | fichier → chat | fichier extrait | long contexte | ⚠️ |

## Technique et IT (demande de Lucas : « comprendre des logs »)

| Cas | Geste → surface | Contexte | Capacité | Local |
|---|---|---|---|---|
| ★ **Log ou stack trace → cause probable, ligne clé, prochaine commande** | sélection → chat ; clic droit sur un `.log` → chat | log **filtré par l'app** : doublons repliés, erreurs ± contexte, tête et queue, budget de tokens | explication d'erreurs | ✅/⚠️ |
| ★ Capture d'une fenêtre d'erreur → explication + **ticket pré-rempli** (titre, étapes, impact, version) | barre + capture → chat | capture + OCR Windows | OCR + JSON | ⚠️ |
| Regex, XPath, PowerShell depuis des exemples, **testés sur la sélection** sous les yeux | sélection → chat | sélection | code | ✅ |
| SQL depuis une question, avec le schéma collé | sélection → chat | sélection | code | ✅/⚠️ |
| Expliquer un script ou une macro VBA hérités | sélection → chat | sélection | lecture de code | ✅ |
| ★ Mail d'utilisateur mécontent → ticket classé (catégorie, priorité, composant, résumé neutre) | sélection → Îlot | sélection | classification + JSON | ✅ |

## Données et tableur

| Cas | Geste → surface | Contexte | Capacité | Local |
|---|---|---|---|---|
| Formule Excel depuis une phrase, ou expliquer une formule | sélection → Îlot ou chat | sélection | code | ✅ |
| ★ **Texte en vrac → tableau** collable dans Excel (TSV) | sélection → Îlot « En tableau » | sélection | extraction JSON → TSV fait par l'app | ✅ |
| ★ Nettoyer une colonne copiée (noms, dates, unités, doublons) — **même nombre de lignes garanti par l'app** | sélection → Îlot | sélection multi-lignes | transformation ligne à ligne | ✅ |
| Poser des questions sur un fichier Excel | fichier → chat | extraction `calamine` | **les calculs sont faits par l'app**, le modèle explique | ⚠️ |

## Réunions, mails, organisation

| Cas | Geste → surface | Contexte | Capacité | Local |
|---|---|---|---|---|
| ★ Mail → événement ou tâche (date, lieu, participants → `.ics`) | sélection → Îlot | sélection | extraction JSON | ✅ |
| ★ **Contrôle avant envoi** : pièce jointe annoncée mais absente, destinataire externe + « confidentiel », ton, engagement de délai | sélection du brouillon → Îlot | brouillon | classification + règles | ✅ |
| Préparer une réunion depuis l'ordre du jour (questions, docs à relire) | sélection → chat | sélection + connaissance interne | RAG | ⚠️ |
| ★ Dictée → mail propre (l'Îlot à la voix) | raccourci maintenu + voix | micro | transcription locale + réécriture | ⚠️ latence |

## Connaissance interne (via l'Open WebUI d'ATE)

| Cas | Geste → surface | Contexte | Capacité | Local |
|---|---|---|---|---|
| Questions sur les procédures internes, avec citations | barre → chat | bases de connaissance Open WebUI | RAG | ⚠️ qualité = indexation |
| ★ Sélection d'un nom de projet, d'une référence, d'un sigle → documents internes liés | sélection → chat | sélection + RAG + métadonnées | RAG | ⚠️ |
| Expliquer un jargon interne (accueil des nouveaux) | sélection → Îlot | sélection + glossaire | petit RAG | ✅ |
| ★ **Transformer une réponse réussie en commande partagée** (capitaliser les prompts qui marchent) | chat → « Enregistrer comme commande » | historique | fonction produit | ✅ |

## Conformité et sécurité

| Cas | Geste → surface | Contexte | Capacité | Local |
|---|---|---|---|---|
| ★ **Pseudonymiser avant d'envoyer à ChatGPT** (demande de Lucas) | sélection → « Ouvrir dans… ⛨ » | sélection | détecteurs + NER | ✅ c'est l'argument du local |
| Réponse à un appel d'offres : cocher chaque exigence contre un document | deux fichiers → chat | fichiers extraits | long contexte + JSON | ⚠️ |

## Ce que les modèles locaux font bien, et mal

- **Bien** : traduire, corriger, reformuler, classer, extraire du JSON avec un schéma imposé, expliquer des erreurs courantes, regex/SQL/formules courtes, repérer des entités.
- **Mal ou risqué** : calculs et agrégations (**à faire faire par l'app**), faits absents du contexte, très long contexte (qualité et temps de lecture), vision fine (graphiques, petits caractères), outils en plusieurs étapes avec un petit modèle (les guides 2026 parlent de ≥ 14 B paramètres et ≥ 64 k de contexte, rapporté).
- Conséquence : chaque commande pointe vers un rôle, et l'app **annonce la limite** (« trop long pour Rapide → passer à Long document ? ») au lieu de produire une réponse tronquée.
