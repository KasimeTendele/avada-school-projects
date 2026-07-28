# WhatsApp Cloud API — Architecture modulaire

Orchestration WhatsApp sans duplication de la logique métier. Les Edge Functions
existantes (fees, payments, receipts…) seront branchées via
`_shared/whatsapp/supabase.ts::invokeBusinessFunction()`.

## Modules

| Module | Rôle |
|---|---|
| `whatsapp-webhook`  | Point d'entrée Meta (GET vérif, POST événements, HMAC). |
| `whatsapp-router`   | Analyse le payload, charge la session, dispatche. |
| `whatsapp-session`  | CRUD sessions (`whatsapp_sessions`), TTL 30 min. |
| `whatsapp-menu`     | Menus interactifs (Accueil / Frais / Paiement / Historique / Aide). |
| `whatsapp-send`     | Envoi bas-niveau (texte, image, document, template, boutons, listes). |
| `_shared/whatsapp/` | `env`, `meta`, `supabase`, `logger`, `response`, `types`, `constants`, `messages`. |

## Secrets requis

| Nom | Requis | Description |
|---|---|---|
| `WHATSAPP_ACCESS_TOKEN`    | oui | Token permanent WhatsApp Business (Meta). |
| `WHATSAPP_PHONE_NUMBER_ID` | oui | ID du numéro d'expédition. |
| `WHATSAPP_VERIFY_TOKEN`    | oui | Token de vérification webhook (déjà configuré). |
| `META_APP_SECRET`          | recommandé | HMAC des payloads Meta. Skippé si absent (dev). |
| `META_GRAPH_VERSION`       | non | Défaut : `v23.0`. |

## Déploiement

```
supabase functions deploy whatsapp-webhook
supabase functions deploy whatsapp-router
supabase functions deploy whatsapp-session
supabase functions deploy whatsapp-menu
supabase functions deploy whatsapp-send
```

URL du webhook (à configurer chez Meta) :
`https://<project-ref>.supabase.co/functions/v1/whatsapp-webhook`

## État de conversation

Table `public.whatsapp_sessions` (service_role only) :
`phone_number`, `state`, `current_menu`, `payload` (JSONB libre), `last_activity`.

## Extensions futures (interfaces prêtes)

- Frais → `invokeBusinessFunction("fees-by-parent", …)`
- Paiement AvadaPay → `invokeBusinessFunction("payments", …)`
- Reçus PDF → `invokeBusinessFunction("receipts", …)` + `sendMessage(buildDocument(…))`
- Rappels d'échéance → cron + `sendMessage(buildTemplate(…))`

Aucune Edge Function métier existante n'est modifiée : l'intégration est purement additive.