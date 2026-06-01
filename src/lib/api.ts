// ⚠️ DEPRECATED — utilisez `apiClient` de `@/shared/api`.
// Ce fichier est conservé pour compatibilité avec le code existant ;
// migrez progressivement les anciens appels `apiFetch(...)` vers
// `apiClient.get/post/put/delete(...)` (voir docs/FRONTEND.md).
import { apiClient } from "@/shared/api";

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const body = init.body ? JSON.parse(init.body as string) : undefined;
  const headers = (init.headers as Record<string, string>) ?? {};
  switch (method) {
    case "GET":    return apiClient.get<T>(path, { headers });
    case "DELETE": return apiClient.delete<T>(path, { headers });
    case "POST":   return apiClient.post<T>(path, body, { headers });
    case "PUT":    return apiClient.put<T>(path, body, { headers });
    case "PATCH":  return apiClient.patch<T>(path, body, { headers });
    default:       throw new Error(`Unsupported method ${method}`);
  }
}

export { apiClient } from "@/shared/api";