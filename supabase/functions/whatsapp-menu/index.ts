import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createLogger } from "../_shared/whatsapp/logger.ts";
import { handleMenuSelection, showHomeMenu } from "../_shared/whatsapp/menu.ts";
import { fail, ok, preflight, WhatsAppError } from "../_shared/whatsapp/response.ts";

const log = createLogger("whatsapp-menu");

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    if (req.method !== "POST") throw new WhatsAppError(405, "Method not allowed", "BAD_REQUEST");
    const { phone, menuId, name } = (await req.json()) as { phone?: string; menuId?: string; name?: string };
    if (!phone) throw new WhatsAppError(400, "Missing `phone`", "BAD_REQUEST");
    if (menuId) await handleMenuSelection(phone, menuId);
    else await showHomeMenu(phone, name);
    return ok(null);
  } catch (err) {
    log.error("menu error", err);
    return fail(err);
  }
});