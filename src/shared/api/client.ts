import { supabase } from "@/integrations/supabase/client";
import { ApiError, type ApiResponse } from "./types";

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

type Query = Record<string, string | number | boolean | null | undefined>;

interface RequestOptions {
  query?: Query;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Si true, n'ajoute pas le Bearer token (utile pour endpoints publics). */
  anonymous?: boolean;
}

function buildUrl(path: string, query?: Query): string {
  const url = new URL(`${FUNCTIONS_BASE}${path.startsWith("/") ? path : `/${path}`}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === "") continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.anonymous ? {} : await authHeader()),
    ...(opts.headers ?? {}),
  };
  const init: RequestInit = { method, headers, signal: opts.signal };
  if (opts.body !== undefined && method !== "GET" && method !== "HEAD") {
    init.body = JSON.stringify(opts.body);
  }
  const res = await fetch(buildUrl(path, opts.query), init);
  const json = (await res.json().catch(() => ({}))) as Partial<ApiResponse<T>> & { data?: T };

  if (!res.ok || (json && (json as { success?: boolean }).success === false)) {
    const message =
      (json as { message?: string })?.message ?? `Request failed (${res.status})`;
    const err = (json as { error?: { code?: string; type?: string; details?: unknown } })?.error;
    if (res.status === 401) {
      try { await supabase.auth.signOut(); } catch { /* ignore */ }
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.replace("/login");
      }
    }
    throw new ApiError(
      message,
      res.status,
      err?.code as never,
      err?.type as never,
      err?.details,
    );
  }

  // Compat : certains endpoints renvoient déjà la donnée brute.
  return ((json as { data?: T }).data ?? (json as unknown)) as T;
}

/**
 * Client HTTP unique pour communiquer avec le backend (edge functions).
 *
 * RÈGLE D'OR : tout accès aux données passe par cet objet.
 * Aucun composant React ne doit appeler `supabase.from(...)` directement.
 */
export const apiClient = {
  get:    <T>(path: string, opts?: Omit<RequestOptions, "body">) => request<T>("GET", path, opts),
  post:   <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "body">) => request<T>("POST", path, { ...opts, body }),
  put:    <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "body">) => request<T>("PUT", path, { ...opts, body }),
  patch:  <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "body">) => request<T>("PATCH", path, { ...opts, body }),
  delete: <T>(path: string, opts?: Omit<RequestOptions, "body">) => request<T>("DELETE", path, opts),
};

export { ApiError };
export type { ApiResponse, RequestOptions };