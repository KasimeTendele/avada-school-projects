import { Router } from "../_shared/router.ts";
import { requireAuth } from "../_shared/auth.ts";
import { paginated, errors } from "../_shared/response.ts";
import { applyFilters, applySort, parseListParams } from "../_shared/list-params.ts";

const router = new Router("/classes");

// GET /classes?schoolId=...
router.get("/", async (req) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  const url = new URL(req.url);
  const schoolId = url.searchParams.get("schoolId");
  const params = parseListParams(url);

  let q = ctx.client.from("classes").select("*, school:schools(id, name)", { count: "exact" });
  if (schoolId) q = q.eq("school_id", schoolId);
  if (params.search) q = q.or(`name.ilike.%${params.search}%,level.ilike.%${params.search}%`);
  q = applyFilters(q, params.filters);
  q = params.sort.length ? applySort(q, params.sort) : q.order("name", { ascending: true });
  q = q.range((params.page - 1) * params.limit, params.page * params.limit - 1);

  const { data, count, error } = await q;
  if (error) return errors.internal(error.message);
  return paginated(data ?? [], params.page, params.limit, count ?? 0);
});

Deno.serve((req) => router.handle(req));
