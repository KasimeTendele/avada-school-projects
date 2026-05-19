import { Router } from "../_shared/router.ts";
import { requireAuth, adminClient, hasAnyRole } from "../_shared/auth.ts";
import { ok, errors } from "../_shared/response.ts";

const router = new Router("/students-by-parent");

router.get("/", async (req) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  if (!hasAnyRole(ctx, ["parent", "super_admin"])) return errors.scopeForbidden("Parent role required");
  const admin = adminClient();
  const { data, error } = await admin
    .from("parent_students")
    .select(`
      relationship,
      student:students(
        id, first_name, last_name, matricule, birth_date, gender, enrollment_date,
        school:schools(id, name, city),
        class:classes(id, name, level, academic_year)
      )
    `)
    .eq("parent_user_id", ctx.userId);
  if (error) return errors.internal(error.message);
  const items = (data ?? []).map((row) => ({
    relationship: row.relationship,
    ...(row.student as object),
  }));
  return ok({ items, total: items.length });
});

Deno.serve((req) => router.handle(req));
