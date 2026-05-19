import { corsHeaders } from "./cors.ts";

function meta() {
  return {
    requestId: `req_${crypto.randomUUID().slice(0, 12)}`,
    timestamp: new Date().toISOString(),
  };
}

export function ok(data: unknown, status = 200, message = "OK"): Response {
  return new Response(
    JSON.stringify({ success: true, message, data, meta: meta() }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

export function paginated(
  items: unknown[],
  page: number,
  limit: number,
  totalItems: number,
  status = 200,
): Response {
  const totalPages = limit > 0 ? Math.ceil(totalItems / limit) : 0;
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;
  return new Response(
    JSON.stringify({
      success: true,
      message: "OK",
      data: {
        items,
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? page + 1 : null,
        prevPage: hasPrevPage ? page - 1 : null,
      },
      meta: meta(),
    }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

export type ErrorType =
  | "VALIDATION"
  | "AUTH"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMIT"
  | "INTERNAL";

export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "TOKEN_EXPIRED"
  | "FORBIDDEN"
  | "SCOPE_FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_ERROR"
  | "RATE_LIMIT_EXCEEDED"
  | "INTERNAL_ERROR";

export function fail(
  status: number,
  message: string,
  code: ErrorCode,
  type: ErrorType,
  details?: unknown,
): Response {
  return new Response(
    JSON.stringify({
      success: false,
      message,
      error: { code, type, details },
      meta: meta(),
    }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

export const errors = {
  badRequest: (msg = "Bad request", details?: unknown) =>
    fail(400, msg, "BAD_REQUEST", "VALIDATION", details),
  validation: (msg = "Validation failed", details?: unknown) =>
    fail(422, msg, "VALIDATION_ERROR", "VALIDATION", details),
  unauthorized: (msg = "Unauthorized") =>
    fail(401, msg, "UNAUTHORIZED", "AUTH"),
  tokenExpired: (msg = "Token expired") =>
    fail(401, msg, "TOKEN_EXPIRED", "AUTH"),
  forbidden: (msg = "Forbidden") => fail(403, msg, "FORBIDDEN", "FORBIDDEN"),
  scopeForbidden: (msg = "Out of scope") =>
    fail(403, msg, "SCOPE_FORBIDDEN", "FORBIDDEN"),
  notFound: (msg = "Not found") => fail(404, msg, "NOT_FOUND", "NOT_FOUND"),
  conflict: (msg = "Conflict") => fail(409, msg, "CONFLICT", "CONFLICT"),
  rateLimit: (msg = "Too many requests") =>
    fail(429, msg, "RATE_LIMIT_EXCEEDED", "RATE_LIMIT"),
  internal: (msg = "Internal server error") =>
    fail(500, msg, "INTERNAL_ERROR", "INTERNAL"),
};
