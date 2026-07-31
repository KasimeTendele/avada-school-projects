import { ACTIONS, MENU_IDS } from "./constants.ts";
import { createLogger } from "./logger.ts";
import { handleMenuSelection, showHomeMenu } from "./menu.ts";
import { MESSAGES } from "./messages.ts";
import { buildText, sendMessage } from "./send.ts";
import {
  getPayload,
  getSession,
  isAuthenticated,
  touchSession,
  updatePayload,
} from "./session.ts";
import type { WhatsAppIncomingMessage, WhatsAppWebhookPayload } from "./types.ts";
import {
  handleEmailInput,
  handlePasswordInput,
  startAuthFlow,
} from "./flows/auth.ts";
import { handlePasswordFlow } from "./flows/password.ts";
import { handleFeesChildSelected } from "./flows/fees.ts";
import { handlePaymentFlow, startPaymentFlow } from "./flows/payment.ts";
import { logoutUser } from "./flows/logout.ts";
import { askAssistant } from "./assistant.ts";

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

export async function routeIncomingMessage(
  msg: WhatsAppIncomingMessage,
  _profileName?: string,
): Promise<void> {
  const phone = msg.from;
  const intent = extractIntent(msg);
  await touchSession(phone);
  const session = await getSession(phone);
  const payload = getPayload(session);
  const state = session?.state ?? "new";
  log.info("Routing", { phone, type: msg.type, intent: intent.kind, state });

  // ---------------- Global text commands ----------------
  if (intent.kind === "text") {
    const t = norm(intent.value);
    if (["logout", "deconnexion"].includes(t)) return logoutUser(phone);
    if (t === ACTIONS.CANCEL || t === "annuler") {
      await updatePayload(phone, { flow: undefined }, { state: "in_menu", current_menu: MENU_IDS.HOME });
      await sendMessage(buildText(phone, MESSAGES.CANCELLED));
      if (isAuthenticated(session)) return showHomeMenu(phone);
      return startAuthFlow(phone);
    }
    if (["menu", "home", "accueil", "retour", "back"].includes(t)) {
      if (isAuthenticated(session)) return showHomeMenu(phone);
      return startAuthFlow(phone);
    }
  }

  // ---------------- Authentication gate ----------------
  if (!isAuthenticated(session)) {
    if (state === "awaiting_email" && intent.kind === "text") {
      return handleEmailInput(phone, intent.value);
    }
    if (state === "awaiting_password" && intent.kind === "text") {
      return handlePasswordInput(phone, intent.value);
    }
    if (session && state === "closed") {
      await sendMessage(buildText(phone, MESSAGES.SESSION_EXPIRED));
      return startAuthFlow(phone, false);
    }
    return startAuthFlow(phone, true);
  }

  // ---------------- Authenticated flows ----------------
  const flow = payload.flow;

  if (intent.kind === "menu" && intent.value.startsWith(`${ACTIONS.PAY_NOW}:`)) {
    const studentId = intent.value.slice(ACTIONS.PAY_NOW.length + 1);
    return startPaymentFlow(phone, studentId);
  }
  if (intent.kind === "menu" && intent.value.startsWith("fees:child:")) {
    const studentId = intent.value.slice("fees:child:".length);
    return handleFeesChildSelected(phone, studentId);
  }

  if (flow?.name === "payment") {
    if (intent.kind === "unknown") {
      await sendMessage(buildText(phone, MESSAGES.UNKNOWN_COMMAND));
      return;
    }
    return handlePaymentFlow(phone, intent as { kind: "text" | "menu"; value: string });
  }
  if (flow?.name === "password" && intent.kind === "text") {
    return handlePasswordFlow(phone, intent.value);
  }

  if (intent.kind === "menu") return handleMenuSelection(phone, intent.value);

  // Langage naturel : délégué à l'assistant IA (Edge Function `ai-assistant`).
  if (intent.kind === "text") {
    const handled = await askAssistant(phone, intent.value);
    if (handled) return;
  }

  return showHomeMenu(phone);
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