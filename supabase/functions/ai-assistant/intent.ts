/**
 * Détection d'intention : d'abord des règles rapides (0 token, 0 latence),
 * puis repli optionnel sur le modèle quand le texte est ambigu.
 */
import type { OpenAIClient } from "../_shared/openai/client.ts";
import { textOf } from "../_shared/openai/responses.ts";
import { INTENT_PROMPT } from "./prompts.ts";
import type { Intent } from "./types.ts";

export const INTENTS: Intent[] = [
  "login",
  "forgot_password",
  "children",
  "fees",
  "history",
  "payment",
  "receipt",
  "help",
  "general",
  "unknown",
];

/** Ajoutez une intention : une entrée ici + un hint dans prompts.ts. */
const RULES: { intent: Intent; patterns: RegExp[] }[] = [
  { intent: "forgot_password", patterns: [/mot de passe (oubli|perdu)/i, /r[eé]initialis/i, /reset.*password/i] },
  { intent: "login", patterns: [/connexion/i, /me connecter/i, /se connecter/i, /login/i, /identifiant/i] },
  { intent: "receipt", patterns: [/re[çc]u/i, /facture/i, /justificatif/i, /pdf/i] },
  { intent: "history", patterns: [/historique/i, /derniers? paiements?/i, /mes paiements/i, /transactions?/i] },
  { intent: "payment", patterns: [/payer/i, /paiement/i, /mobile money/i, /orange money/i, /airtel/i, /m-?pesa/i] },
  { intent: "fees", patterns: [/frais/i, /scolarit[eé]/i, /solde/i, /dois?-je/i, /combien/i, /impay/i] },
  { intent: "children", patterns: [/mes enfants?/i, /mon enfant/i, /[eé]l[eè]ve/i, /classe de/i] },
  { intent: "help", patterns: [/aide/i, /assistance/i, /support/i, /probl[eè]me/i, /contact/i] },
];

export function detectIntentByRules(text: string): Intent {
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(text))) return rule.intent;
  }
  return "unknown";
}

export async function detectIntent(text: string, client?: OpenAIClient): Promise<Intent> {
  const rule = detectIntentByRules(text);
  if (rule !== "unknown" || !client) return rule;
  try {
    const res = await client.chat({
      messages: [
        { role: "system", content: INTENT_PROMPT },
        { role: "user", content: text.slice(0, 500) },
      ],
      temperature: 0,
      max_tokens: 30,
      response_format: { type: "json_object" },
    });
    const parsed = JSON.parse(textOf(res) || "{}") as { intent?: string };
    const intent = parsed.intent as Intent | undefined;
    return intent && INTENTS.includes(intent) ? intent : "general";
  } catch {
    return "general";
  }
}