# 04 · Modèles : un choix simple pour l'utilisateur, une carte claire pour l'admin

> Statut : **exploration** (10/10/2026).
> Sources : [recherches/2026-10-10-briques-techniques.md](recherches/2026-10-10-briques-techniques.md) §4 et §7, [recherches/2026-10-10-paysage-ux.md](recherches/2026-10-10-paysage-ux.md) §2.5, [recherches/2026-10-10-anonymisation-passerelles.md](recherches/2026-10-10-anonymisation-passerelles.md) §2.

## Aujourd'hui

Réglages › Serveurs : 1 à 8 serveurs, **un modèle par serveur**, un serveur par défaut. Les actions n'ont pas de modèle. La liste des modèles vient déjà de `GET /v1/models` (`probe.rs`). Ça suffit pour un geste ; pas pour un chat où l'on veut parfois « le gros modèle » ou « celui qui voit les images ».

## Proposition : des rôles

L'utilisateur ne choisit pas « gemma-4-12b-qat-fp8 ». Il choisit un **rôle** :

| Rôle | Pour | Exemple de liaison (à confirmer chez ATE) |
|---|---|---|
| **Rapide** | Îlot, corrections, traductions courtes | petit modèle, latence minimale |
| **Précis** | chat, rédaction, explication de logs | le meilleur modèle généraliste disponible |
| **Vision** | captures, images du presse-papiers | un modèle multimodal |
| **Long document** | fichiers, longs fils de mails, gros logs | le modèle au plus grand contexte |

- Un rôle = un couple (serveur, modèle). L'admin peut **pousser** la liaison (fichier de configuration machine, ou préréglages de l'Open WebUI d'ATE) ; l'utilisateur peut la surcharger.
- Chaque **commande** pointe vers un rôle (modèle « Raycast » : un modèle par commande, vérifié le 10/10/2026).
- Dans le chat, le sélecteur montre les **rôles d'abord**, puis « Autres modèles » (tout ce que listent les serveurs), filtrable avec `cmdk` (déjà dans le repo).

```
 ┌ Précis · interne ● ▾ ─────────────────────┐
 │ ● Rapide         interne   ⚡ 48 tok/s     │
 │ ● Précis ✓       interne   🖹 32k          │
 │ ● Vision         interne   👁              │
 │ ● Long document  interne   🖹 128k         │
 │ ─────────────────────────────────────────  │
 │ Autres modèles…                    ⌕       │
 └────────────────────────────────────────────┘
```

## Badges qui aident vraiment

- **Destination** : `local` (le poste) · `interne` (serveur ou Open WebUI d'ATE) · `externe` (cloud public). Toujours visible.
- **Capacités** : vision 👁, outils 🛠, contexte max. Chaque capacité porte sa **source** : déclarée par le serveur, sondée, saisie à la main, inconnue.
- **Vitesse mesurée sur ce poste** (tokens/s des derniers usages), plutôt qu'une promesse.
- **Repli visible** : si un rôle est injoignable, l'app le dit et propose un autre rôle. Jamais de bascule silencieuse, surtout jamais vers l'externe.

## Ce que les serveurs exposent (vérifié le 10/10/2026)

| Serveur | Contexte max | Vision | Outils |
|---|---|---|---|
| vLLM | `max_model_len` dans `/v1/models` | non exposé | non exposé (dépend des options de lancement `--enable-auto-tool-choice --tool-call-parser`) |
| llama.cpp | `GET /props` → `n_ctx` ; `/v1/models` → `meta.n_ctx_train` | `input_modalities` / `modalities` | `chat_template_caps` |
| Ollama | `POST /api/show` → `<arch>.context_length` | `capabilities` | non vérifié |
| Open WebUI | non exposé | non exposé | outils serveur via `tool_ids` |

D'où un **registre de modèles** en Rust : `/v1/models`, puis sondes silencieuses propres à chaque serveur, puis surcharge manuelle ; cache daté ; test actif (« essayer la vision », « essayer les outils ») seulement à la demande, comme le bouton d'essai de la 0.6.

## Routage : des règles, pas un modèle qui choisit

Un routeur par LLM coûterait du temps sur CPU et serait inexplicable. Règles déterministes :

1. image jointe → rôle **Vision** ;
2. outils activés → un modèle marqué 🛠 ;
3. contexte estimé > contexte du rôle courant → proposer **Long document** (avec ce qui serait coupé sinon) ;
4. sinon : rôle de la commande, ou défaut de la surface (Îlot = Rapide, chat = Précis).

Le modèle réellement utilisé est **écrit sous chaque réponse**.

## L'Open WebUI d'ATE comme fournisseur

Vérifié dans le code d'Open WebUI 0.11.4 :
- l'API compatible OpenAI existe : `/api/v1/models`, `/api/v1/chat/completions` ; comme Overtype ajoute `/v1/` à l'adresse, la base `https://<owui>/api` **tombe juste sans changer le client** ;
- **les clés API sont désactivées par défaut** (`ENABLE_API_KEYS=False`, et la permission utilisateur aussi) : il faut l'accord de l'admin d'ATE ;
- on gagne les **bases de connaissance** (`files: [{type: "collection", id}]`), les **outils serveur** (`tool_ids`) et les préréglages de modèles déjà gouvernés ;
- l'API est marquée « experimental » ; les filtres d'admin peuvent modifier les consignes d'Overtype ; latence en plus.

Recommandation : garder le **vLLM direct** pour l'Îlot (chemin le plus court), proposer « **Open WebUI de l'entreprise** » comme second type de serveur pour le chat et la connaissance interne. À tester sur la vraie instance : flux SSE, paramètres `top_k` et `chat_template_kwargs` transmis ou rejetés, chats créés ou non en base.

## Idée : « Comparer »

Envoyer la même demande à deux rôles côte à côte (Msty, LM Studio, Open WebUI le font, vérifié le 10/10/2026). Utile **une fois**, pour aider un service à choisir son modèle ; pas une fonction de tous les jours. Carte OT-032 du kanban.
