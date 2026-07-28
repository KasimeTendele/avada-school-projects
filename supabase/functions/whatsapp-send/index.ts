import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createLogger } from "../_shared/whatsapp/logger.ts";
import { fail, ok, preflight, WhatsAppError } from "../_shared/whatsapp/response.ts";
import { sendMessage } from "../_shared/whatsapp/send.ts";
import type { WhatsAppOutgoingMessage } from "../_shared/whatsapp/types.ts";

const log = createLogger("whatsapp-send");

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    if (req.method !== "POST") throw new WhatsAppError(405, "Method not allowed", "BAD_REQUEST");
    const payload = (await req.json()) as WhatsAppOutgoingMessage;
    if (!payload?.to || !payload?.type) throw new WhatsAppError(400, "Missing `to` or `type`", "BAD_REQUEST");
    const result = await sendMessage(payload);
    log.info("Dispatched", { to: payload.to, type: payload.type });
    return ok(result);
  } catch (err) {
    log.error("send failed", err);
    return fail(err);
  }
});