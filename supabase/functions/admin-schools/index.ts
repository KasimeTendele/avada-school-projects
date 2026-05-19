import { Router } from "../_shared/router.ts";
import { requireAuth, adminClient, hasAnyRole } from "../_shared/auth.ts";
import { ok, errors } from "../_shared/response.ts";

const router = new Router("/admin-schools");

// GET /admin-schools -> list with stats
router.get("/", async (req) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  if (!hasAnyRole(ctx, ["super_admin"])) {
    return errors.scopeForbidden("Super admin role required");
  }
  const url = new URL(req.url);
  const search = (url.searchParams.get("search") ?? "").trim().toLowerCase();

  const admin = adminClient();
  const [
    { data: schools },
    { data: students },
    { data: fees },
    { count: total },
    { count: actives },
    { count: studentsCount },
    { count: feesCount },
  ] = await Promise.all([
    admin.from("schools").select("id, name, sigle, city, address, status, promoter_name, promoter_phone, levels, sections, vacation, regime, epst_number, created_at"),
    admin.from("students").select("id, school_id"),
    admin.from("fees").select("id, school_id"),
    admin.from("schools").select("id", { count: "exact", head: true }),
    admin.from("schools").select("id", { count: "exact", head: true }).eq("status", "active"),
    admin.from("students").select("id", { count: "exact", head: true }),
    admin.from("fees").select("id", { count: "exact", head: true }),
  ]);

  const studentsBySchool = new Map<string, number>();
  (students ?? []).forEach((s: any) => studentsBySchool.set(s.school_id, (studentsBySchool.get(s.school_id) ?? 0) + 1));
  const feesBySchool = new Map<string, number>();
  (fees ?? []).forEach((f: any) => feesBySchool.set(f.school_id, (feesBySchool.get(f.school_id) ?? 0) + 1));

  let items = (schools ?? []).map((s: any) => ({
    ...s,
    students_count: studentsBySchool.get(s.id) ?? 0,
    fees_count: feesBySchool.get(s.id) ?? 0,
  }));
  if (search) {
    items = items.filter((s: any) => (s.name ?? "").toLowerCase().includes(search) || (s.city ?? "").toLowerCase().includes(search));
  }
  items.sort((a: any, b: any) => (a.name ?? "").localeCompare(b.name ?? "", "fr"));

  return ok({
    items,
    stats: {
      total: total ?? 0,
      active: actives ?? 0,
      students: studentsCount ?? 0,
      fees: feesCount ?? 0,
    },
  });
});

// GET /admin-schools/:id
router.get("/:id", async (req, params) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  if (!hasAnyRole(ctx, ["super_admin"])) {
    return errors.scopeForbidden("Super admin role required");
  }
  const admin = adminClient();
  const { data, error } = await admin.from("schools").select("*").eq("id", params.id).maybeSingle();
  if (error) return errors.internal(error.message);
  if (!data) return errors.notFound("School not found");
  return ok(data);
});

function buildSchoolPayload(body: any) {
  return {
    name: body.name,
    sigle: body.sigle ?? null,
    epst_number: body.epst_number ?? null,
    matricule: body.matricule ?? null,
    management_type: body.management_type ?? null,
    regime: body.regime,
    levels: body.levels,
    sections: body.sections,
    vacation: body.vacation,
    city: body.city ?? null,
    address: body.address ?? null,
    phone: body.phone ?? null,
    email: body.email ?? null,
    logo_url: body.logo_url ?? null,
    promoter_name: body.promoter_name ?? null,
    promoter_phone: body.promoter_phone ?? null,
    approval_number: body.approval_number ?? null,
    director_first_name: body.director_first_name ?? null,
    director_last_name: body.director_last_name ?? null,
    director_post_name: body.director_post_name ?? null,
    director_phone: body.director_phone ?? null,
    director_email: body.director_email ?? null,
    director_photo_url: body.director_photo_url ?? null,
    status: body.status ?? "active",
  };
}

// POST /admin-schools -> create
router.post("/", async (req) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  if (!hasAnyRole(ctx, ["super_admin"])) {
    return errors.scopeForbidden("Super admin role required");
  }
  const body = await req.json().catch(() => ({}));
  if (!body.name || typeof body.name !== "string") return errors.badRequest("name required");
  if (!body.regime) return errors.badRequest("regime required");
  if (!Array.isArray(body.levels) || body.levels.length === 0) return errors.badRequest("levels required");
  if (!Array.isArray(body.sections) || body.sections.length === 0) return errors.badRequest("sections required");
  if (!body.vacation) return errors.badRequest("vacation required");

  const admin = adminClient();
  const { data, error } = await admin
    .from("schools")
    .insert(buildSchoolPayload(body))
    .select()
    .single();
  if (error) return errors.internal(error.message);
  return ok(data, 201, "Created");
});

// PATCH /admin-schools/:id -> update
router.patch("/:id", async (req, params) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  if (!hasAnyRole(ctx, ["super_admin"])) {
    return errors.scopeForbidden("Super admin role required");
  }
  const body = await req.json().catch(() => ({}));
  const admin = adminClient();
  // patch partiel : on n'inclut que les champs fournis
  const patch: Record<string, unknown> = {};
  const allowed = [
    "name", "sigle", "epst_number", "matricule", "management_type",
    "regime", "levels", "sections", "vacation", "city", "address",
    "phone", "email", "logo_url",
    "promoter_name", "promoter_phone", "approval_number",
    "director_first_name", "director_last_name", "director_post_name",
    "director_phone", "director_email", "director_photo_url", "status",
  ];
  for (const k of allowed) if (k in body) patch[k] = (body as any)[k];
  const { data, error } = await admin.from("schools").update(patch).eq("id", params.id).select().single();
  if (error) return errors.internal(error.message);
  return ok(data, 200, "Updated");
});

Deno.serve((req) => router.handle(req));
