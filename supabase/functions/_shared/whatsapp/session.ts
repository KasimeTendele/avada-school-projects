import { SESSION_TTL_MINUTES } from "./constants.ts";
import { createLogger } from "./logger.ts";
import { getSupabase } from "./supabase.ts";
import type { SessionState, WhatsAppSession, WhatsAppSessionPayload } from "./types.ts";

const log = createLogger("whatsapp:session");
const TABLE = "whatsapp_sessions";

export async function getSession(phone: string): Promise<WhatsAppSession | null> {
  const { data, error } = await getSupabase().from(TABLE).select("*").eq("phone_number", phone).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (Date.now() - new Date(data.last_activity).getTime() > SESSION_TTL_MINUTES * 60_000) {
    log.info("Session expired", { phone });
    return null;
  }
  return data as WhatsAppSession;
}
export async function upsertSession(phone: string, patch: Partial<Pick<WhatsAppSession, "state" | "current_menu" | "payload">>): Promise<WhatsAppSession> {
  const { data, error } = await getSupabase().from(TABLE).upsert({
    phone_number: phone,
    state: patch.state ?? "idle",
    current_menu: patch.current_menu ?? null,
    payload: patch.payload ?? {},
    last_activity: new Date().toISOString(),
  }, { onConflict: "phone_number" }).select("*").single();
  if (error) throw error;
  return data as WhatsAppSession;
}
export async function touchSession(phone: string): Promise<void> {
  await getSupabase().from(TABLE).update({ last_activity: new Date().toISOString() }).eq("phone_number", phone);
}
export async function closeSession(phone: string): Promise<void> {
  await getSupabase().from(TABLE).update({ state: "closed" as SessionState, current_menu: null, payload: {} }).eq("phone_number", phone);
}

/** Typed accessor for the JSONB payload. */
export function getPayload(session: WhatsAppSession | null): WhatsAppSessionPayload {
  return (session?.payload as WhatsAppSessionPayload | undefined) ?? {};
}

/** Merge a partial payload into the session and persist it. */
export async function updatePayload(
  phone: string,
  patch: Partial<WhatsAppSessionPayload>,
  extra?: { state?: SessionState; current_menu?: string | null },
): Promise<WhatsAppSession> {
  const current = await getSession(phone);
  const nextPayload = { ...getPayload(current), ...patch };
  return upsertSession(phone, {
    state: extra?.state ?? current?.state ?? "idle",
    current_menu: extra?.current_menu ?? current?.current_menu ?? null,
    payload: nextPayload as Record<string, unknown>,
  });
}

/** True when the session holds a non-expired authenticated user. */
export function isAuthenticated(session: WhatsAppSession | null): boolean {
  const auth = getPayload(session).auth;
  if (!auth?.user_id || !auth.access_token) return false;
  return true;
}