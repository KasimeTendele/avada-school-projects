import { ACTIONS } from "./constants.ts";
import { createLogger } from "./logger.ts";
import { handleMenuSelection, showHomeMenu } from "./menu.ts";
import { MESSAGES } from "./messages.ts";
import { buildText, sendMessage } from "./send.ts";
import { closeSession, getSession, touchSession, upsertSession } from "./session.ts";
import type { WhatsAppIncomingMessage, WhatsAppWebhookPayload } from "./types.ts";

const log = createLogger("whatsapp:router");

function extractIntent(msg: WhatsAppIncomingMessage):
  | { kind: "text"; value: string }
  | { kind: "menu"; value: string }
  | { kind: "unknown" } {
  if (msg.type === "text" && msg.text?.body) return { kind: "text", value: msg.text.body.trim() };
  if (msg.type === "interactive" && msg.interactive) {
    const id = msg.interactive.button_reply?.id ?? msg.interactive.list_reply?.id ?? "";
    if (id) return { kind: "menu", value: id };
  }
  if (msg.type === "button" && msg.button?.payload) return { kind: "menu", value: msg.button.payload };
  return { kind: "unknown" };
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export async function routeIncomingMessage(msg: WhatsAppIncomingMessage, profileName?: string): Promise<void> {
  const phone = msg.from;
  const intent = extractIntent(msg);
  await touchSession(phone);
  const session = await getSession(phone);
  log.info("Routing", { phone, type: msg.type, intent: intent.kind, state: session?.state ?? "new" });

  if (intent.kind === "text") {
    const t = norm(intent.value);
    if (t === ACTIONS.CANCEL || t === "annuler") {
      await closeSession(phone);
      await sendMessage(buildText(phone, MESSAGES.CANCELLED));
      return;
    }
    if (["back", "retour", "menu", "home", "accueil"].includes(t)) {
      await showHomeMenu(phone, profileName);
      return;
    }
  }
  if (intent.kind === "menu") return handleMenuSelection(phone, intent.value);
  if (!session) return showHomeMenu(phone, profileName);
  if (intent.kind === "text") {
    await sendMessage(buildText(phone, MESSAGES.UNKNOWN_COMMAND));
    await upsertSession(phone, { state: session.state, current_menu: session.current_menu, payload: session.payload });
    return;
  }
  await sendMessage(buildText(phone, MESSAGES.UNKNOWN_COMMAND));
}

export async function routeWebhookPayload(payload: WhatsAppWebhookPayload): Promise<void> {
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const profileName = value.contacts?.[0]?.profile?.name;
      for (const msg of value.messages ?? []) {
        try {
          await routeIncomingMessage(msg, profileName);
        } catch (err) {
          log.error("Route failed", { err: (err as Error).message, msgId: msg.id });
          try { await sendMessage(buildText(msg.from, MESSAGES.INTERNAL_ERROR)); } catch { /* ignore */ }
        }
      }
    }
  }
}