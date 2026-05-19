import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function userClient(authHeader: string | null): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: authHeader ? { Authorization: authHeader } : {} },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface AuthContext {
  userId: string;
  email: string | null;
  roles: string[];
  primarySchoolId: string | null;
  client: SupabaseClient;
  token: string;
}

export async function requireAuth(req: Request): Promise<AuthContext | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    const { errors } = await import("./response.ts");
    return errors.unauthorized("Missing bearer token");
  }
  const token = authHeader.slice(7);
  const client = userClient(authHeader);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    const { errors } = await import("./response.ts");
    return error?.message?.includes("expired")
      ? errors.tokenExpired()
      : errors.unauthorized(error?.message ?? "Invalid token");
  }
  const admin = adminClient();
  const [{ data: roleRows }, { data: profile }] = await Promise.all([
    admin.from("user_roles").select("role").eq("user_id", data.user.id),
    admin.from("profiles").select("primary_school_id").eq("id", data.user.id).maybeSingle(),
  ]);
  return {
    userId: data.user.id,
    email: data.user.email ?? null,
    roles: (roleRows ?? []).map((r) => r.role as string),
    primarySchoolId: profile?.primary_school_id ?? null,
    client,
    token,
  };
}

export function hasAnyRole(ctx: AuthContext, roles: string[]): boolean {
  return ctx.roles.some((r) => roles.includes(r));
}
