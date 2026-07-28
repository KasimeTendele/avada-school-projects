/**
 * Centralised access to WhatsApp-related environment variables.
 * Never hard-code secrets. Read them here, in one place, so callers stay clean.
 */
export interface WhatsAppEnv {
  WHATSAPP_ACCESS_TOKEN: string;
  WHATSAPP_PHONE_NUMBER_ID: string;
  WHATSAPP_VERIFY_TOKEN: string;
  META_APP_SECRET: string;
  META_GRAPH_VERSION: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

function read(name: string, required = true): string {
  const v = Deno.env.get(name) ?? "";
  if (required && !v) {
    // We do NOT throw at import time — throwing here would kill the whole
    // function on cold start. Callers use `assertEnv()` where they need it.
    console.warn(`[whatsapp/env] Missing environment variable: ${name}`);
  }
  return v;
}

export function getEnv(): WhatsAppEnv {
  return {
    WHATSAPP_ACCESS_TOKEN: read("WHATSAPP_ACCESS_TOKEN"),
    WHATSAPP_PHONE_NUMBER_ID: read("WHATSAPP_PHONE_NUMBER_ID"),
    WHATSAPP_VERIFY_TOKEN: read("WHATSAPP_VERIFY_TOKEN"),
    META_APP_SECRET: read("META_APP_SECRET", false),
    META_GRAPH_VERSION: read("META_GRAPH_VERSION", false) || "v23.0",
    SUPABASE_URL: read("SUPABASE_URL"),
    SUPABASE_SERVICE_ROLE_KEY: read("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

export function assertEnv(keys: (keyof WhatsAppEnv)[], env = getEnv()): void {
  const missing = keys.filter((k) => !env[k]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }
}