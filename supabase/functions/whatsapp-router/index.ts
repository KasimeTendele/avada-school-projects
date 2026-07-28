import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { ACTIONS } from "../_shared/whatsapp/constants.ts";
import { createLogger } from "../_shared/whatsapp/logger.ts";
import { MESSAGES } from "../_shared/whatsapp/messages.ts";
import { fail, ok, preflight, WhatsAppError } from "../_shared/whatsapp/response.ts";
import type {
  WhatsAppIncomingMessage,
  WhatsAppWebhookPayload,
} from "../_shared/whatsapp/types.ts";
import { buildText, sendMessage } from "../whatsapp-send/index.ts";
import {
  closeSession,
  getSession,
  touchSession,
  upsertSession,
} from "../whatsapp-session/index.ts";
import { handleMenuSelection, showHomeMenu } from "../whatsapp-menu/index.ts";

const log = createLogger("whatsapp-router");

function extractIntent(msg: WhatsAppIncomingMessage):
  | { kind: "text"; value: string }
  | { kind: "menu"; value: string }
  | { kind: "unknown" } {
  if (msg.type === "text" && msg.text?.body) {
    return { kind: "text", value: msg.text.body.trim() };
  }
  if (msg.type === "interactive" && msg.interactive) {
    const id =
      msg.interactive.button_reply?.id ?? msg.interactive.list_reply?.id ?? "";
    if (id) return { kind: "menu", value: id };
  }
  if (msg.type === "button" && msg.button?.payload) {
    return { kind: "menu", value: msg.button.payload };
  }
  return { kind: "unknown" };
}

function normaliseText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export async function routeIncomingMessage(
  msg: WhatsAppIncomingMessage,
  profileName?: string,
): Promise<void> {
  const phone = msg.from;
  const intent = extractIntent(msg);
  await touchSession(phone);
  const session = await getSession(phone);

  log.info("Routing incoming message", {
    phone,
    type: msg.type,
    intent: intent.kind,
    state: session?.state ?? "new",
  });

  if (intent.kind === "text") {
    const t = normaliseText(intent.value);
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

  if (intent.kind === "menu") {
    await handleMenuSelection(phone, intent.value);
    return;
  }

  if (!session) {
    await showHomeMenu(phone, profileName);
    return;
  }

  if (intent.kind === "text") {
    await sendMessage(buildText(phone, MESSAGES.UNKNOWN_COMMAND));
    await upsertSession(phone, {
      state: session.state,
      current_menu: session.current_menu,
      payload: session.payload,
    });
    return;
  }

  await sendMessage(buildText(phone, MESSAGES.UNKNOWN_COMMAND));
}

export async function routeWebhookPayload(
  payload: WhatsAppWebhookPayload,
): Promise<void> {
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const profileName = value.contacts?.[0]?.profile?.name;
      for (const msg of value.messages ?? []) {
        try {
          await routeIncomingMessage(msg, profileName);
        } catch (err) {
          log.error("Failed to route message", {
            err: (err as Error).message,
            msgId: msg.id,
          });
          try {
            await sendMessage(buildText(msg.from, MESSAGES.INTERNAL_ERROR));
          } catch {
            // ignore secondary failure
          }
        }
      }
    }
  }
}

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    if (req.method !== "POST") {
      throw new WhatsAppError(405, "Method not allowed", "BAD_REQUEST");
    }
    const payload = (await req.json()) as WhatsAppWebhookPayload;
    await routeWebhookPayload(payload);
    return ok(null);
  } catch (err) {
    log.error("router error", err);
    return fail(err);
  }
});