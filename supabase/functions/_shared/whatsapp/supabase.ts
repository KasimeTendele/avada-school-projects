import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getEnv } from "./env.ts";

let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (cached) return cached;
  const env = getEnv();
  cached = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/**
 * Invoke an existing business Edge Function without duplicating its logic.
 * Used by WhatsApp handlers to reach fees/payments/receipts endpoints.
 */
export async function invokeBusinessFunction<T = unknown>(
  functionName: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const supabase = getSupabase();
  const { data, error } = await supabase.functions.invoke(functionName, {
    body: body ?? {},
  });
  if (error) throw error;
  return data as T;
}