import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createLogger } from "../_shared/whatsapp/logger.ts";
import { fail, ok, preflight, WhatsAppError } from "../_shared/whatsapp/response.ts";
import { closeSession, getSession, upsertSession } from "../_shared/whatsapp/session.ts";

const log = createLogger("whatsapp-session");

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const url = new URL(req.url);
    const phone = url.searchParams.get("phone");
    if (!phone) throw new WhatsAppError(400, "Missing `phone`", "BAD_REQUEST");
    if (req.method === "GET") return ok(await getSession(phone));
    if (req.method === "POST" || req.method === "PATCH") {
      const body = await req.json().catch(() => ({}));
      return ok(await upsertSession(phone, body));
    }
    if (req.method === "DELETE") {
      await closeSession(phone);
      return ok(null);
    }
    throw new WhatsAppError(405, "Method not allowed", "BAD_REQUEST");
  } catch (err) {
    log.error("session error", err);
    return fail(err);
  }
});