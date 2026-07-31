/**
 * Construit le contexte d'exécution de l'assistant depuis la session WhatsApp.
 * Lecture seule : aucune écriture de session ici.
 */
import { getPayload, getSession, isAuthenticated } from "../_shared/whatsapp/session.ts";
import type { AssistantContext } from "./types.ts";

export async function buildContext(phone: string, locale = "fr"): Promise<AssistantContext> {
  const session = await getSession(phone);
  const payload = getPayload(session);
  const auth = payload.auth;
  return {
    phone,
    authenticated: isAuthenticated(session),
    userId: auth?.user_id,
    email: auth?.email,
    firstName: auth?.first_name,
    lastName: auth?.last_name,
    accessToken: auth?.access_token,
    currentMenu: session?.current_menu ?? null,
    state: session?.state,
    locale,
  };
}