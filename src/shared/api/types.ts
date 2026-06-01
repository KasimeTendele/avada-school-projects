// Contrat API partagé entre frontend et backend.
// Doit refléter exactement le format renvoyé par supabase/functions/_shared/response.ts.

export interface ApiMeta {
  requestId: string;
  timestamp: string;
}

export type ApiErrorCode =
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

export type ApiErrorType =
  | "VALIDATION"
  | "AUTH"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMIT"
  | "INTERNAL";

export interface ApiSuccess<T> {
  success: true;
  message: string;
  data: T;
  meta: ApiMeta;
}

export interface ApiFailure {
  success: false;
  message: string;
  error: { code: ApiErrorCode; type: ApiErrorType; details?: unknown };
  meta: ApiMeta;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  nextPage: number | null;
  prevPage: number | null;
}

export class ApiError extends Error {
  status: number;
  code?: ApiErrorCode;
  type?: ApiErrorType;
  details?: unknown;
  constructor(message: string, status: number, code?: ApiErrorCode, type?: ApiErrorType, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.type = type;
    this.details = details;
  }
}