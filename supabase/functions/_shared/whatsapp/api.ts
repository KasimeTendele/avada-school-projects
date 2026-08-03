/**
 * Helpers to call existing business Edge Functions (auth, fees, payments,
 * receipts, etc.) without duplicating their logic. Uses the parent's own
 * access token — RLS remains the source of truth for authorization.
 */
import { getEnv } from "./env.ts";
import { createLogger } from "./logger.ts";

const log = createLogger("whatsapp:api");

export interface CallOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path?: string;
  body?: unknown;
  accessToken?: string | null;
  query?: Record<string, string | number | undefined>;
  /** Hard deadline; aborts the call so the caller can fall back fast. */
  timeoutMs?: number;
}

export interface CallResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
}

export async function callBusinessFunction<T = unknown>(
  functionName: string,
  opts: CallOptions = {},
): Promise<CallResult<T>> {
  const env = getEnv();
  const method = opts.method ?? "GET";
  const path = opts.path ?? "";
  const qs = opts.query
    ? "?" +
      Object.entries(opts.query)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&")
    : "";
  const url = `${env.SUPABASE_URL}/functions/v1/${functionName}${path}${qs}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  };
  if (opts.accessToken) headers["Authorization"] = `Bearer ${opts.accessToken}`;
  else headers["Authorization"] = `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`;

  try {
    const controller = new AbortController();
    const timer = opts.timeoutMs
      ? setTimeout(() => controller.abort(), opts.timeoutMs)
      : undefined;
    const res = await fetch(url, {
      method,
      headers,
      body: method === "GET" || opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: controller.signal,
    }).finally(() => { if (timer) clearTimeout(timer); });
    const text = await res.text();
    let json: unknown = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
    if (!res.ok) {
      const errMsg =
        (json as { error?: { message?: string }; message?: string } | null)?.error?.message ??
        (json as { message?: string } | null)?.message ??
        text ??
        `HTTP ${res.status}`;
      log.warn("Business call failed", { functionName, path, status: res.status, errMsg });
      return { ok: false, status: res.status, data: null, error: errMsg };
    }
    // Our business API wraps payloads as { success, data, message } — unwrap when present.
    const wrapper = json as { data?: T } | null;
    const data = (wrapper && "data" in wrapper ? wrapper.data : json) as T;
    return { ok: true, status: res.status, data, error: null };
  } catch (err) {
    log.error("Business call threw", { functionName, err: (err as Error).message });
    return { ok: false, status: 0, data: null, error: (err as Error).message };
  }
}