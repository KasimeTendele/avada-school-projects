/**
 * Pont entre le routeur WhatsApp et l'Edge Function `ai-assistant`.
 * Le routeur reste maître du flux : l'IA n'est appelée qu'en dernier recours.
 */
import { callBusinessFunction } from "./api.ts";
import { createLogger } from "./logger.ts";

const log = createLogger("whatsapp:assistant");

/** Au-delà de ce délai, le chat WhatsApp classique reprend la main. */
const ASSISTANT_TIMEOUT_MS = Number(Deno.env.get("AI_ASSISTANT_TIMEOUT_MS") ?? "10000");

/**
 * Demande une réponse en langage naturel. `ai-assistant` envoie lui-même le
 * message WhatsApp. Retourne false si l'IA est indisponible (le routeur
 * retombe alors sur le menu classique).
 */
export async function askAssistant(phone: string, message: string): Promise<boolean> {
  const res = await callBusinessFunction<{ reply?: string }>("ai-assistant", {
    method: "POST",
    body: { phone, message },
    timeoutMs: ASSISTANT_TIMEOUT_MS,
  });
  if (!res.ok) {
    log.warn("assistant unavailable", { phone, status: res.status, err: res.error });
    return false;
  }
  return true;
}