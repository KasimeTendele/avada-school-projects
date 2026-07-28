import { corsHeaders } from "../cors.ts";

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function text(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { ...corsHeaders, "Content-Type": "text/plain" },
  });
}

export function ok(data: unknown = null): Response {
  return json({ success: true, data });
}

export class WhatsAppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code:
      | "BAD_REQUEST"
      | "UNAUTHORIZED"
      | "FORBIDDEN"
      | "NOT_FOUND"
      | "META_API_ERROR"
      | "INTERNAL_ERROR" = "INTERNAL_ERROR",
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export function fail(err: unknown): Response {
  if (err instanceof WhatsAppError) {
    return json(
      { success: false, error: { code: err.code, message: err.message, details: err.details } },
      err.status,
    );
  }
  const message = err instanceof Error ? err.message : "Unknown error";
  return json({ success: false, error: { code: "INTERNAL_ERROR", message } }, 500);
}

export function preflight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  return null;
}