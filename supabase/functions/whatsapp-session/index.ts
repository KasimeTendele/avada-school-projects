import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SESSION_TTL_MINUTES } from "../_shared/whatsapp/constants.ts";
import { createLogger } from "../_shared/whatsapp/logger.ts";
import { fail, ok, preflight, WhatsAppError } from "../_shared/whatsapp/response.ts";
import { getSupabase } from "../_shared/whatsapp/supabase.ts";
import type { SessionState, WhatsAppSession } from "../_shared/whatsapp/types.ts";

const log = createLogger("whatsapp-session");
const TABLE = "whatsapp_sessions";

export async function getSession(phone: string): Promise<WhatsAppSession | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("phone_number", phone)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const expired =
    Date.now() - new Date(data.last_activity).getTime() >
    SESSION_TTL_MINUTES * 60_000;
  if (expired) {
    log.info("Session expired", { phone });
    return null;
  }
  return data as WhatsAppSession;
}

export async function upsertSession(
  phone: string,
  patch: Partial<Pick<WhatsAppSession, "state" | "current_menu" | "payload">>,
): Promise<WhatsAppSession> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(
      {
        phone_number: phone,
        state: patch.state ?? "idle",
        current_menu: patch.current_menu ?? null,
        payload: patch.payload ?? {},
        last_activity: new Date().toISOString(),
      },
      { onConflict: "phone_number" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return data as WhatsAppSession;
}

export async function touchSession(phone: string): Promise<void> {
  const supabase = getSupabase();
  await supabase
    .from(TABLE)
    .update({ last_activity: new Date().toISOString() })
    .eq("phone_number", phone);
}

export async function closeSession(phone: string): Promise<void> {
  const supabase = getSupabase();
  await supabase
    .from(TABLE)
    .update({ state: "closed" as SessionState, current_menu: null, payload: {} })
    .eq("phone_number", phone);
}

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