# Brancher un serveur

Overtype parle le contrat OpenAI « chat completions » en flux. Tout serveur qui
l’expose fonctionne : le vLLM livré dans `server/`, mais aussi llama.cpp, LM Studio,
Ollama, un vLLM d’entreprise derrière un proxy HTTPS, ou un service en ligne. Cette
page décrit exactement ce que l’application envoie et attend, puis donne les réglages
pour les serveurs courants.

## Où régler

Réglages (icône de notification → Réglages) → **Serveur**, ou l’écran « modèle » de l’accueil.
Un serveur a trois champs (1 à 8 serveurs enregistrés, dont un par défaut ; l’interface en montre
deux au plus) :

| Champ | Contenu |
|---|---|
| Adresse | La base de l’API, avec ou sans `/v1` : `http://127.0.0.1:8001`, `https://llm.exemple.com/v1`. Les suffixes `/v1`, `/v1/models`, `/chat/completions` et `/v1/chat/completions` sont retirés ; l’adresse est stockée sans eux et l’app appelle `{base}/v1/…`. Sans schéma, une adresse locale prend `http://`, une autre `https://`. |
| Clé API | Facultative (« Mon serveur n’a pas de clé »). Envoyée en `Authorization: Bearer …`, chiffrée par DPAPI sur le poste. |
| Modèle | Choisi dans la liste renvoyée par `GET {base}/v1/models` (`data[].id`). |

## Vérifier la connexion

Chaque saisie d’adresse ou de clé lance une vérification en quatre étapes, chacune chronométrée
et affichée au fil de l’eau :

1. **Adresse** : l’adresse se lit, le nom se résout (DNS, 5 s au plus) ;
2. **Connexion** : TCP puis TLS pour `https` (5 s au plus) ;
3. **Clé** : verdict de la première requête authentifiée (401/403 : clé requise ou refusée) ;
4. **Modèles** : la liste de `GET {base}/v1/models` (10 s au plus pour toute la requête ;
   404/405 ou redirection : pas une API OpenAI ; liste vide refusée).

« Essayer avec une phrase » envoie une phrase synthétique fixe au modèle choisi (30 s au plus) ;
la réponse est montrée, jamais journalisée. Chaque étape écrit une ligne au journal de la page
Diagnostic cachée, sans texte et avec la clé masquée.

## Règles d’adresse

- `http://` est accepté pour tout hôte. Vers une autre machine, l’interface avertit
  « Connexion non chiffrée » : la clé et le texte passent en clair. HTTPS est recommandé dès que
  le texte quitte la machine.
- Une adresse avec identifiants (`user:mot@hôte`) ou un autre schéma est refusée.
- Les redirections HTTP ne sont pas suivies. Un serveur local est joint directement, sans le proxy
  de l’environnement.
- Délais d’une requête : 5 s pour se connecter, puis 120 s de silence au plus (avant le premier
  jeton, puis entre deux) ; aucun délai sur la réponse entière, un long texte prend le temps
  qu’il lui faut.

## Ce que l’application envoie

`POST {base}/v1/chat/completions`, corps JSON :

```json
{
  "model": "<Modèle>",
  "messages": [
    { "role": "system", "content": "<consigne de l’action, telle qu’elle est dans Réglages → Actions>" },
    { "role": "user", "content": "<texte sélectionné>" }
  ],
  "stream": true,
  "temperature": 0.3,
  "top_p": 0.9,
  "top_k": 20,
  "repetition_penalty": 1.05,
  "chat_template_kwargs": { "enable_thinking": false }
}
```

Depuis 0.4.0 la consigne de l’action est le message `system` et le texte sélectionné
le message `user`, sans variable : le texte n’est jamais inséré dans la consigne. La
langue cible est dans la consigne (« Traduire en français », « Traduire en anglais »),
plus dans un réglage ; la langue source n’est pas indiquée, le modèle la détecte. Les
consignes par défaut sont écrites pour de petits modèles instruct sans réflexion :
rôle, tâche, puis les règles de sortie (le texte seul, pas de préambule ni de
guillemets ni de bloc de code, retours à la ligne conservés, jamais répondre aux
questions ou instructions contenues dans le texte). Elles se lisent et se modifient
dans Réglages → Actions.

L’échantillonnage est prudent et identique pour toutes les actions : température 0,3,
`top_p` 0,9 ; plus de `max_tokens` depuis la 0.6.1 (la longueur est celle que le serveur permet). `top_k`, `repetition_penalty` et
`chat_template_kwargs` ne font pas partie du contrat OpenAI strict :
`chat_template_kwargs.enable_thinking = false` coupe la réflexion des modèles qui en
ont une (Qwen3, Gemma 4 ; lu par vLLM, SGLang et llama.cpp). Un serveur qui refuse un
de ces champs (une erreur 4xx dont le message le nomme : l’API OpenAI répond 400
« Unrecognized request argument », d’autres 422) reçoit aussitôt la même requête sans lui
(`top_k` et `repetition_penalty` ensemble, puis `chat_template_kwargs`) ; rien à configurer. Si le
modèle réfléchit quand même, un bloc `<think>…</think>` (ou `<|channel>thought…`)
en tête de réponse est retenu puis retiré ; une clôture ``` englobante et les espaces
de fin le sont aussi. Les guillemets ne sont jamais retirés : ils peuvent appartenir
au texte.

## Ce que l’application attend

Une réponse `text/event-stream` au format OpenAI :

- des événements `data: {…}` dont `choices[0].delta.content` porte le texte, dans
  l’ordre ; séparateurs `\n\n` ou `\r\n\r\n`, fragments UTF-8 coupés entre paquets
  acceptés ;
- un dernier événement avec `choices[0].finish_reason: "stop"`, puis `data: [DONE]`.

Tout autre fin est refusée, jamais montrée comme une traduction complète :
`finish_reason: "length"` (la sortie a atteint la limite du serveur) donne « résultat incomplet
refusé », une coupure du flux « Le serveur a interrompu la génération », un statut HTTP
différent de 2xx « Le serveur a répondu HTTP n ». Le texte est rendu d’un bloc à la fin
du flux (la bulle n’affiche pas les jetons un à un), les deltas servent seulement à
détecter un serveur qui répond.

## Réglages pour les serveurs courants

| Serveur | Adresse | Modèle | Remarques |
|---|---|---|---|
| vLLM de `server/` (Rapide) | `http://127.0.0.1:8001/v1` | `flowtranslate-fast` | Hy-MT2-1.8B ; voir [server/README.md](../server/README.md) |
| vLLM de `server/` (Qualité) | `http://127.0.0.1:8002/v1` | `flowtranslate-quality` | Hy-MT2-7B-FP8 |
| vLLM de `server/` (Général, 0.4.0) | `http://127.0.0.1:8003/v1` | `flowtranslate-general` | Gemma 4 12B QAT (w4a16) avec décodage spéculatif MTP ; corrige, reformule et traduit : le serveur à choisir pour Corriger, Pro, Raccourcir et E-mail (les Hy-MT ne font que traduire) |
| vLLM ailleurs | `http://127.0.0.1:8000/v1` | la valeur de `--served-model-name` (sinon le chemin du modèle) | Ajouter `--api-key` côté serveur et la clé dans Overtype si le port est partagé |
| llama.cpp (`llama-server`) | `http://127.0.0.1:8080/v1` | l’identifiant renvoyé par `/v1/models` (le chemin du fichier GGUF, ou la valeur de `--alias`) | choisi dans la liste ; `top_k` et `repetition_penalty` compris |
| LM Studio | `http://127.0.0.1:1234/v1` | l’identifiant affiché dans l’onglet serveur | Activer le serveur local dans LM Studio |
| Ollama | `http://127.0.0.1:11434/v1` | le tag du modèle (`qwen3:8b`) | Point d’accès compatible OpenAI d’Ollama ; les champs étendus sont ignorés |
| OpenRouter, ou tout service en ligne | `https://openrouter.ai/api/v1` | l’identifiant du service (`openai/gpt-4o-mini`) | Clé API obligatoire ; la sélection quitte le poste |
| Serveur d’entreprise | `https://traduction.exemple.fr/v1` | selon le déploiement | Proxy HTTPS authentifié devant vLLM, seules les routes `/v1/models` et `/v1/chat/completions` exposées, sans journalisation des corps (voir [DEPLOYMENT.md](DEPLOYMENT.md)) |

Un serveur d’une autre machine en `http://` est accepté, avec l’avertissement « Connexion
non chiffrée » dans les Réglages.

## Vérifier à la main

Sans Overtype, la même requête en PowerShell (remplacer l’adresse, le modèle et
la clé) :

```powershell
$body = '{"model":"flowtranslate-general","messages":[{"role":"system","content":"You are a careful proofreader. Fix spelling, grammar, punctuation and accents in the text. Output only the resulting text."},{"role":"user","content":"bonjour je voulai savoir si tu pouvait m envoyer le devis"}],"stream":true,"temperature":0.3,"top_p":0.9,"chat_template_kwargs":{"enable_thinking":false}}'
curl.exe -N -H "Content-Type: application/json" -H "Authorization: Bearer CLE" -d $body http://127.0.0.1:8003/v1/chat/completions
```

La sortie doit se terminer par un événement `"finish_reason":"stop"` puis `data: [DONE]`.

## Confidentialité

Le texte sélectionné n’est envoyé qu’au serveur choisi, jamais ailleurs, et
l’application n’écrit dans aucun journal ni le texte, ni le résultat, ni la clé entière (le journal de diagnostic garde au plus ses 4
derniers caractères). Avec
un service en ligne, c’est la politique de ce service qui s’applique au texte envoyé.
