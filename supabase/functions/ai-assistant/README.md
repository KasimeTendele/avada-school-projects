# ai-assistant — AvadaSchool Assistant (OpenAI GPT)

Assistant conversationnel en langage naturel pour le chatbot WhatsApp.
Il **ne remplace pas** le chatbot existant : il intervient uniquement quand le
message n'est ni une commande de menu, ni une étape d'un parcours métier.

> Règle d'or : **aucune logique métier dans `ai-assistant`**. Toute donnée réelle
> provient des Edge Functions existantes (`auth`, `students-by-parent`,
> `fees-by-parent`, `payments`, `receipts`) via les *tools*.

## Flux

```
Message WhatsApp
  ↓ whatsapp-webhook (signature HMAC)
  ↓ whatsapp-router
     ├─ commande menu / bouton  → whatsapp-menu
     ├─ étape d'un parcours     → flows/* → Edge Function métier
     └─ langage naturel         → ai-assistant
                                     ↓ détection d'intention
                                     ↓ prompt système + contexte + mémoire (30 min)
                                     ↓ tools → Edge Functions métier
                                     ↓ réponse OpenAI (formatée WhatsApp)
                                     ↓ whatsapp-send
```

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.ts` | Entrée HTTP : `POST { phone, message, dryRun? }`, orchestration, envoi WhatsApp. |
| `openai.ts` | Orchestrateur : prompt + mémoire + boucle d'appels d'outils. |
| `prompts.ts` | Prompt système, prompt de classification, bloc de contexte, hints d'intention. |
| `tools.ts` | Déclaration des outils et adaptateurs vers les Edge Functions existantes. |
| `memory.ts` | Mémoire de conversation 30 min dans `whatsapp_sessions.payload.ai`. |
| `intent.ts` | Détection d'intention par règles puis repli modèle. |
| `context.ts` | Contexte d'exécution construit depuis la session WhatsApp. |
| `formatter.ts` | Nettoyage Markdown → WhatsApp, bornage de longueur, message de repli. |
| `types.ts` | Types partagés (intentions, contexte, outils, résultats). |

### Modules partagés

| Fichier | Rôle |
|---|---|
| `_shared/openai/config.ts` | Lecture des secrets/paramètres (modèle, TTL, timeouts). |
| `_shared/openai/client.ts` | Client HTTP OpenAI (retry, timeout, `post()` générique). |
| `_shared/openai/responses.ts` | Types Chat Completions + helpers (`textOf`, `toolCallsOf`…). |
| `_shared/whatsapp/assistant.ts` | Pont routeur → `ai-assistant`. |

## Secrets

| Nom | Requis | Défaut |
|---|---|---|
| `OPENAI_API_KEY` | **oui** | — |
| `OPENAI_MODEL` | non | `gpt-4.1-mini` |
| `OPENAI_BASE_URL` | non | `https://api.openai.com/v1` |
| `OPENAI_TEMPERATURE` | non | `0.2` |
| `OPENAI_MAX_TOKENS` | non | `700` |
| `OPENAI_MAX_TOOL_ROUNDS` | non | `4` |
| `AI_MEMORY_TTL_MINUTES` | non | `30` |
| `AI_MEMORY_MAX_MESSAGES` | non | `20` |
| `OPENAI_TIMEOUT_MS` | non | `25000` |

Les secrets WhatsApp/Supabase existants (`WHATSAPP_*`, `SUPABASE_*`) restent requis.

## Outils disponibles

`getChildren()`, `getFees({ studentId?, onlyUnpaid? })`, `paymentHistory({ limit? })`,
`getReceipts({ limit? })`, `payFees({ studentId? })`, `resetPassword({ email? })`,
`getSupportInfo()`.

### Ajouter un outil

1. Ajouter une entrée dans `TOOLS` (`tools.ts`) : `name`, `description`,
   `parameters` (JSON Schema), `requiresAuth`, `run(args, ctx)`.
2. Dans `run`, appeler **uniquement** `callBusinessFunction(...)` ou un parcours
   existant de `_shared/whatsapp/flows/*`.
3. Retourner un `ToolResult` (`{ ok, data | error, openMenu? }`). Le schéma est
   exposé automatiquement au modèle, et masqué si `requiresAuth` et parent non connecté.

### Ajouter une intention

1. Ajouter la valeur au type `Intent` (`types.ts`) et à `INTENTS` (`intent.ts`).
2. Ajouter les motifs dans `RULES` (`intent.ts`).
3. Ajouter le hint correspondant dans `buildIntentHint` (`prompts.ts`).

## Sécurité

- Aucun mot de passe n'est transmis ni mémorisé par l'IA ; connexion et changement
  de mot de passe restent dans les parcours guidés.
- Les outils authentifiés utilisent le `access_token` du parent → **RLS appliquée**.
- Les outils authentifiés ne sont pas exposés au modèle si la session n'est pas connectée.
- La mémoire ne conserve que le dialogue (`user`/`assistant`), jamais les jetons,
  et expire au bout de 30 minutes.
- `verify_jwt = true` : la fonction n'est appelable qu'avec un jeton Supabase valide.

## Évolutions prévues (architecture prête)

`_shared/openai/client.ts::post()` accepte n'importe quel endpoint OpenAI, ce qui
permet d'ajouter sans refonte :

- reconnaissance vocale (`/audio/transcriptions` — messages vocaux WhatsApp),
- génération d'images (`/images/generations`),
- OCR de reçus et analyse de PDF (entrées multimodales + nouveaux outils),
- traduction automatique (prompt dédié dans `prompts.ts`),
- notifications intelligentes et recommandations (réutilisation de `whatsapp-reminders`).

Chaque ajout = un nouveau module + un outil, sans toucher au routeur ni au métier.

## Test

```
curl -X POST "$SUPABASE_URL/functions/v1/ai-assistant" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"phone":"243812163851","message":"Combien je dois pour Junior ?","dryRun":true}'
```