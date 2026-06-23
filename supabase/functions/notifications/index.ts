import { Router } from "../_shared/router.ts";
import { requireAuth } from "../_shared/auth.ts";
import { ok, paginated, errors } from "../_shared/response.ts";
import { applyFilters, applySort, parseListParams } from "../_shared/list-params.ts";

const router = new Router("/notifications");

router.get("/", async (req) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  const url = new URL(req.url);
  const params = parseListParams(url);

  let q = ctx.client.from("notifications").select("*", { count: "exact" }).eq("user_id", ctx.userId);
  if (params.search) {
    q = q.or(`title.ilike.%${params.search}%,message.ilike.%${params.search}%`);
  }
  q = applyFilters(q, params.filters);
  q = params.sort.length ? applySort(q, params.sort) : q.order("created_at", { ascending: false });
  q = q.range((params.page - 1) * params.limit, params.page * params.limit - 1);
  const { data, count, error } = await q;
  if (error) return errors.internal(error.message);
  return paginated(data ?? [], params.page, params.limit, count ?? 0);
});

router.get("/dashboard", async (req) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;

  const { count, error: countErr } = await ctx.client
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", ctx.userId)
    .eq("read", false);
  if (countErr) return errors.internal(countErr.message);

  const { data, error } = await ctx.client
    .from("notifications")
    .select("*")
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) return errors.internal(error.message);

  return ok({ unread_count: count ?? 0, recent: data ?? [] });
});

router.patch("/read-all", async (req) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  const { error, count } = await ctx.client
    .from("notifications")
    .update({ read: true, read_at: new Date().toISOString() }, { count: "exact" })
    .eq("user_id", ctx.userId)
    .eq("read", false);
  if (error) return errors.internal(error.message);
  return ok({ updated: count ?? 0 });
});

router.patch("/:id/read", async (req, params) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  const { data, error } = await ctx.client
    .from("notifications")
    .update({ read: true, read_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("user_id", ctx.userId)
    .select()
    .maybeSingle();
  if (error) return errors.internal(error.message);
  if (!data) return errors.notFound();
  return ok({ notification: data });
});

Deno.serve((req) => router.handle(req));
