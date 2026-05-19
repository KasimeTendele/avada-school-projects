import { supabase } from "@/integrations/supabase/client";

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(await authHeader()),
    ...((init.headers as Record<string, string>) ?? {}),
  };
  const res = await fetch(`${FUNCTIONS_BASE}${path}`, { ...init, headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || (json && json.success === false)) {
    const msg = (json && (json.message as string)) || `Request failed (${res.status})`;
    if (res.status === 401) {
      // Session révoquée ou expirée côté serveur : on purge la session locale
      // et on redirige vers /login pour une nouvelle authentification.
      try { await supabase.auth.signOut(); } catch { /* ignore */ }
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.replace("/login");
      }
    }
    throw new Error(msg);
  }
  return (json?.data ?? json) as T;
}