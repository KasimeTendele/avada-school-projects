/**
 * whatsapp-reminders
 *
 * Envoie sur WhatsApp les rappels d'échéance de frais aux parents dont le
 * numéro est connu (table `whatsapp_users`), y compris ceux qui se sont
 * déconnectés. Lit les notifications `FEE` créées le jour même par la fonction
 * SQL `dispatch_fee_reminders()` afin d'éviter toute duplication de logique.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createLogger } from "../_shared/whatsapp/logger.ts";
import { fail, ok, preflight, WhatsAppError } from "../_shared/whatsapp/response.ts";
import { buildText, sendMessage } from "../_shared/whatsapp/send.ts";
import { getSupabase } from "../_shared/whatsapp/supabase.ts";

const log = createLogger("whatsapp-reminders");

interface NotificationRow {
  id: string;
  user_id: string;
  title: string;
  message: string | null;
  created_at: string;
  data: Record<string, unknown> | null;
}
interface MappingRow {
  user_id: string;
  phone_number: string;
  first_name: string | null;
}

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    if (req.method !== "POST") throw new WhatsAppError(405, "Method not allowed", "BAD_REQUEST");
    const supabase = getSupabase();

    const { data: dispatchCount, error: dispatchErr } = await supabase.rpc("dispatch_fee_reminders");
    if (dispatchErr) log.warn("dispatch_fee_reminders failed", { err: dispatchErr.message });
    else log.info("dispatch_fee_reminders inserted", { count: dispatchCount });

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: notifs, error: nErr } = await supabase
      .from("notifications")
      .select("id,user_id,title,message,created_at,data")
      .eq("type", "FEE")
      .gte("created_at", since)
      .order("created_at", { ascending: false });
    if (nErr) throw nErr;
    const rows = (notifs ?? []) as NotificationRow[];
    if (rows.length === 0) return ok({ sent: 0 });

    const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
    const { data: mappings } = await supabase
      .from("whatsapp_users")
      .select("user_id,phone_number,first_name")
      .in("user_id", userIds);
    const byUser = new Map<string, MappingRow>();
    for (const m of (mappings ?? []) as MappingRow[]) byUser.set(m.user_id, m);

    let sent = 0;
    for (const notif of rows) {
      const target = byUser.get(notif.user_id);
      if (!target) continue;
      const name = target.first_name ? `Bonjour ${target.first_name},\n\n` : "";
      const body = `${name}🔔 *${notif.title}*\n${notif.message ?? ""}\n\nTapez *menu* pour vous connecter et régler ce frais.`;
      try {
        await sendMessage(buildText(target.phone_number, body));
        sent++;
      } catch (err) {
        log.warn("Send reminder failed", { phone: target.phone_number, err: (err as Error).message });
      }
    }
    log.info("Reminders sent", { sent, total: rows.length });
    return ok({ sent, considered: rows.length });
  } catch (err) {
    log.error("reminders error", err);
    return fail(err);
  }
});