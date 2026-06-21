import { Router } from "../_shared/router.ts";
import { requireAuth, adminClient, hasAnyRole } from "../_shared/auth.ts";
import { ok, errors } from "../_shared/response.ts";

const router = new Router("/schools-academics");

// GET /schools-academics/:id
// Retourne les sections, classes et options d'une école (pour les formulaires élève).
// Accès: super_admin, admin de l'école, cashier de l'école, parent (si ses enfants y sont).
router.get("/:id", async (req, params) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;

  const schoolId = params.id;
  const isSuper = hasAnyRole(ctx, ["super_admin"]);
  const isSchoolAdmin = hasAnyRole(ctx, ["admin"]);
  const isCashier = hasAnyRole(ctx, ["cashier"]);

  const admin = adminClient();

  // Vérifier que l'école existe
  const { data: school, error: schoolErr } = await admin
    .from("schools")
    .select("id, name")
    .eq("id", schoolId)
    .maybeSingle();
  if (schoolErr) return errors.internal(schoolErr.message);
  if (!school) return errors.notFound("École introuvable");

  // Scope pour admin/cashier école
  if (!isSuper && (isSchoolAdmin || isCashier)) {
    const { data: link } = await admin
      .from("admin_schools")
      .select("id")
      .eq("user_id", ctx.userId)
      .eq("school_id", schoolId)
      .maybeSingle();
    if (!link && ctx.primarySchoolId !== schoolId) {
      return errors.scopeForbidden("Vous n'avez pas accès à cette école");
    }
  }

  // Scope pour parent
  if (!isSuper && !isSchoolAdmin && !isCashier && hasAnyRole(ctx, ["parent"])) {
    const { data: parentLinks } = await admin
      .from("parent_students")
      .select("student_id")
      .eq("parent_id", ctx.userId);
    const studentIds = (parentLinks ?? []).map((r: any) => r.student_id);
    if (studentIds.length === 0) return errors.scopeForbidden("Aucun enfant lié");
    const { data: students } = await admin
      .from("students")
      .select("id")
      .in("id", studentIds)
      .eq("school_id", schoolId);
    if (!students || students.length === 0) {
      return errors.scopeForbidden("Aucun enfant dans cette école");
    }
  }

  const [
    { data: sections },
    { data: classes },
    { data: options },
  ] = await Promise.all([
    admin.from("sections").select("id, name, level, academic_year, created_at").eq("school_id", schoolId).order("name", { ascending: true }),
    admin.from("classes").select("id, name, level, academic_year, created_at").eq("school_id", schoolId).order("name", { ascending: true }),
    admin.from("options").select("id, section_id, name, description, created_at").eq("school_id", schoolId).order("name", { ascending: true }),
  ]);

  return ok({
    school: {
      id: school.id,
      name: school.name,
    },
    sections: sections ?? [],
    classes: classes ?? [],
    options: options ?? [],
  });
});

Deno.serve((req) => router.handle(req));
