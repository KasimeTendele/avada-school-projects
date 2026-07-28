import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createLogger } from "../_shared/whatsapp/logger.ts";
import { fail, ok, preflight, WhatsAppError } from "../_shared/whatsapp/response.ts";
import { routeWebhookPayload } from "../_shared/whatsapp/router.ts";
import type { WhatsAppWebhookPayload } from "../_shared/whatsapp/types.ts";

const log = createLogger("whatsapp-router");

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    if (req.method !== "POST") throw new WhatsAppError(405, "Method not allowed", "BAD_REQUEST");
    const payload = (await req.json()) as WhatsAppWebhookPayload;
    await routeWebhookPayload(payload);
    return ok(null);
  } catch (err) {
    log.error("router error", err);
    return fail(err);
  }
});