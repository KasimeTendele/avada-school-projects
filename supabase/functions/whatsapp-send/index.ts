import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createLogger } from "../_shared/whatsapp/logger.ts";
import { getMetaClient } from "../_shared/whatsapp/meta.ts";
import { fail, ok, preflight, WhatsAppError } from "../_shared/whatsapp/response.ts";
import type {
  WhatsAppInteractiveButton,
  WhatsAppInteractiveListRow,
  WhatsAppOutgoingMessage,
} from "../_shared/whatsapp/types.ts";

const log = createLogger("whatsapp-send");

/* ---------- Reusable, extensible message builders ---------- */

export function buildText(to: string, body: string): WhatsAppOutgoingMessage {
  return { to, type: "text", text: { body } };
}

export function buildImage(
  to: string,
  image: { link?: string; id?: string; caption?: string },
): WhatsAppOutgoingMessage {
  return { to, type: "image", image };
}

export function buildDocument(
  to: string,
  document: { link?: string; id?: string; filename?: string; caption?: string },
): WhatsAppOutgoingMessage {
  return { to, type: "document", document };
}

export function buildTemplate(
  to: string,
  name: string,
  languageCode = "fr",
  components?: unknown[],
): WhatsAppOutgoingMessage {
  return {
    to,
    type: "template",
    template: { name, language: { code: languageCode }, components },
  };
}

export function buildButtons(
  to: string,
  body: string,
  buttons: WhatsAppInteractiveButton[],
  opts?: { header?: string; footer?: string },
): WhatsAppOutgoingMessage {
  return {
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body },
      ...(opts?.header ? { header: { type: "text", text: opts.header } } : {}),
      ...(opts?.footer ? { footer: { text: opts.footer } } : {}),
      action: { buttons },
    },
  };
}

export function buildList(
  to: string,
  body: string,
  button: string,
  sections: { title: string; rows: WhatsAppInteractiveListRow[] }[],
  opts?: { header?: string; footer?: string },
): WhatsAppOutgoingMessage {
  return {
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: body },
      ...(opts?.header ? { header: { type: "text", text: opts.header } } : {}),
      ...(opts?.footer ? { footer: { text: opts.footer } } : {}),
      action: { button, sections },
    },
  };
}

export async function sendMessage(msg: WhatsAppOutgoingMessage): Promise<unknown> {
  return getMetaClient().sendMessage(msg);
}

/* ---------- HTTP entry point ---------- */

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    if (req.method !== "POST") {
      throw new WhatsAppError(405, "Method not allowed", "BAD_REQUEST");
    }
    const payload = (await req.json()) as WhatsAppOutgoingMessage;
    if (!payload?.to || !payload?.type) {
      throw new WhatsAppError(400, "Missing `to` or `type`", "BAD_REQUEST");
    }
    const result = await sendMessage(payload);
    log.info("Outgoing message dispatched", { to: payload.to, type: payload.type });
    return ok(result);
  } catch (err) {
    log.error("send failed", err);
    return fail(err);
  }
});