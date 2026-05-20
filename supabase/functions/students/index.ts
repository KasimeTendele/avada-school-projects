import { Router } from "../_shared/router.ts";
import { requireAuth, adminClient, hasAnyRole } from "../_shared/auth.ts";
import { ok, paginated, errors } from "../_shared/response.ts";
import { applyFilters, applySort, parseListParams } from "../_shared/list-params.ts";

const router = new Router("/students");

async function canManageSchool(
  ctx: { roles: string[]; userId: string; primarySchoolId: string | null },
  schoolId: string,
): Promise<boolean> {
  if (ctx.roles.includes("super_admin")) return true;
  if (ctx.roles.includes("cashier") && ctx.primarySchoolId === schoolId) return true;
  if (ctx.roles.includes("admin")) {
    const { data } = await adminClient()
      .from("admin_schools")
      .select("id")
      .eq("user_id", ctx.userId)
      .eq("school_id", schoolId)
      .maybeSingle();
    return !!data;
  }
  return false;
}

// GET /students?schoolId=...
router.get("/", async (req) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  if (!hasAnyRole(ctx, ["cashier", "admin", "super_admin"])) {
    return errors.scopeForbidden("Cashier/admin role required");
  }
  const url = new URL(req.url);
  const schoolId = url.searchParams.get("schoolId");
  const params = parseListParams(url);

  let q = ctx.client
    .from("students")
    .select("*, class:classes(id, name, level), school:schools(id, name)", { count: "exact" });

  if (schoolId) q = q.eq("school_id", schoolId);

  if (params.search) {
    q = q.or(
      `first_name.ilike.%${params.search}%,last_name.ilike.%${params.search}%,matricule.ilike.%${params.search}%`,
    );
  }
  q = applyFilters(q, params.filters);
  q = params.sort.length ? applySort(q, params.sort) : q.order("last_name", { ascending: true });
  q = q.range((params.page - 1) * params.limit, params.page * params.limit - 1);

  const { data, count, error } = await q;
  if (error) return errors.internal(error.message);
  return paginated(data ?? [], params.page, params.limit, count ?? 0);
});

interface StudentBody {
  first_name?: string;
  last_name?: string;
  post_name?: string;
  matricule?: string;
  birth_date?: string;
  birth_place?: string;
  gender?: string;
  enrollment_date?: string;
  class_id?: string;
  school_id?: string;
  section_id?: string;
  option_id?: string;
  photo_url?: string;
  physical_address?: string;
}

// POST /students
router.post("/", async (req) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  if (!hasAnyRole(ctx, ["cashier", "admin", "super_admin"])) {
    return errors.scopeForbidden("Cashier/admin role required");
  }
  const body = (await req.json().catch(() => ({}))) as StudentBody;
  const errs: { field: string; message: string }[] = [];
  if (!body.first_name) errs.push({ field: "first_name", message: "required" });
  if (!body.last_name) errs.push({ field: "last_name", message: "required" });
  if (!body.school_id) errs.push({ field: "school_id", message: "required" });
  if (errs.length) return errors.validation("Validation failed", errs);

  if (!(await canManageSchool(ctx, body.school_id!))) {
    return errors.scopeForbidden("Not your school");
  }

  const admin = adminClient();
  const { data, error } = await admin
    .from("students")
    .insert({
      first_name: body.first_name,
      last_name: body.last_name,
      post_name: body.post_name ?? null,
      matricule: body.matricule ?? null,
      birth_date: body.birth_date ?? null,
      birth_place: body.birth_place ?? null,
      gender: body.gender ?? null,
      enrollment_date: body.enrollment_date ?? null,
      class_id: body.class_id ?? null,
      school_id: body.school_id,
      section_id: body.section_id ?? null,
      option_id: body.option_id ?? null,
      photo_url: body.photo_url ?? null,
      physical_address: body.physical_address ?? null,
    })
    .select()
    .single();
  if (error) return errors.validation(error.message);
  return ok(data, 201, "Student created");
});

// POST /students/import  -> bulk import (admin / super_admin / cashier)
router.post("/import", async (req) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  if (!hasAnyRole(ctx, ["cashier", "admin", "super_admin"])) {
    return errors.scopeForbidden("Cashier/admin role required");
  }
  const body = (await req.json().catch(() => ({}))) as {
    school_id?: string;
    students?: Array<{
      first_name?: string;
      last_name?: string;
      post_name?: string;
      matricule?: string;
      gender?: string;
      birth_date?: string;
      birth_place?: string;
      physical_address?: string;
      photo_url?: string;
      enrollment_date?: string;
      class_name?: string;
      level?: string;
      academic_year?: string;
      section_name?: string;
      option_name?: string;
    }>;
  };
  if (!body.school_id) return errors.validation("school_id requis");
  if (!body.students?.length) return errors.validation("Aucun élève à importer");
  if (body.students.length > 3000) return errors.validation("Maximum 3000 élèves par import");
  if (!(await canManageSchool(ctx, body.school_id))) {
    return errors.scopeForbidden("Pas votre école");
  }

  const admin = adminClient();

  // Charger classes / sections / options de l'école pour résolution par nom
  const [classesRes, sectionsRes, optionsRes, existingRes] = await Promise.all([
    admin.from("classes").select("id, name, level, academic_year").eq("school_id", body.school_id),
    admin.from("sections").select("id, name").eq("school_id", body.school_id),
    admin.from("options").select("id, name, section_id").eq("school_id", body.school_id),
    admin.from("students").select("matricule").eq("school_id", body.school_id).not("matricule", "is", null),
  ]);

  const classMap = new Map<string, string>();
  (classesRes.data ?? []).forEach((c: any) => {
    classMap.set(`${(c.name ?? "").toLowerCase()}|${(c.academic_year ?? "").toLowerCase()}`, c.id);
  });
  const sectionMap = new Map<string, string>();
  (sectionsRes.data ?? []).forEach((s: any) => sectionMap.set((s.name ?? "").toLowerCase(), s.id));
  const optionMap = new Map<string, { id: string; section_id: string }>();
  (optionsRes.data ?? []).forEach((o: any) => optionMap.set((o.name ?? "").toLowerCase(), { id: o.id, section_id: o.section_id }));
  const existingMatricules = new Set(
    (existingRes.data ?? []).map((s: any) => (s.matricule ?? "").trim().toLowerCase()).filter(Boolean),
  );

  type PreparedRow = {
    rowNum: number;
    payload: Record<string, unknown>;
    matricule: string | null;
  };
  const prepared: PreparedRow[] = [];
  const skipped: { row: number; matricule?: string; reason: string }[] = [];
  const failed: { row: number; reason: string }[] = [];
  const seenInBatch = new Set<string>();

  function normalizeGender(v: string): string | null {
    const g = (v ?? "").trim().toLowerCase();
    if (!g) return null;
    if (["m", "h", "male", "homme", "garcon", "garçon", "masculin"].includes(g)) return "M";
    if (["f", "female", "femme", "fille", "féminin", "feminin"].includes(g)) return "F";
    return null;
  }
  function normalizeDate(v: string): string | null {
    const t = (v ?? "").trim();
    if (!t) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
    const m = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    return null;
  }

  // Étape 1 : préparation + création de classes manquantes (séquentielle pour ne pas dupliquer)
  for (let i = 0; i < body.students.length; i++) {
    const s = body.students[i];
    const rowNum = i + 1;
    const first = (s.first_name ?? "").trim();
    const last = (s.last_name ?? "").trim();
    if (!first || !last) {
      failed.push({ row: rowNum, reason: "Prénom et nom requis" });
      continue;
    }
    const mat = (s.matricule ?? "").trim();
    const matKey = mat.toLowerCase();
    if (mat) {
      if (existingMatricules.has(matKey)) {
        skipped.push({ row: rowNum, matricule: mat, reason: "Matricule déjà existant" });
        continue;
      }
      if (seenInBatch.has(matKey)) {
        skipped.push({ row: rowNum, matricule: mat, reason: "Matricule en double dans le fichier" });
        continue;
      }
    }

    // Section / option par nom (auto-création si absentes)
    let sectionId: string | null = null;
    const sectionName = (s.section_name ?? "").trim();
    if (sectionName) {
      sectionId = sectionMap.get(sectionName.toLowerCase()) ?? null;
      if (!sectionId) {
        const { data: newSection, error: secErr } = await admin
          .from("sections")
          .insert({ school_id: body.school_id, name: sectionName })
          .select("id")
          .single();
        if (secErr || !newSection) {
          failed.push({ row: rowNum, reason: `Création section: ${secErr?.message ?? "erreur"}` });
          continue;
        }
        sectionId = newSection.id;
        sectionMap.set(sectionName.toLowerCase(), sectionId);
      }
    }
    let optionId: string | null = null;
    const optionName = (s.option_name ?? "").trim();
    if (optionName) {
      const opt = optionMap.get(optionName.toLowerCase());
      if (opt) {
        optionId = opt.id;
        if (!sectionId) sectionId = opt.section_id;
      } else {
        if (!sectionId) {
          failed.push({ row: rowNum, reason: `Option "${optionName}" nécessite une section.` });
          continue;
        }
        const { data: newOpt, error: optErr } = await admin
          .from("options")
          .insert({ school_id: body.school_id, section_id: sectionId, name: optionName })
          .select("id, section_id")
          .single();
        if (optErr || !newOpt) {
          failed.push({ row: rowNum, reason: `Création option: ${optErr?.message ?? "erreur"}` });
          continue;
        }
        optionId = newOpt.id;
        optionMap.set(optionName.toLowerCase(), { id: optionId, section_id: sectionId });
      }
    }

    // Classe : créée si absente
    let classId: string | null = null;
    const className = (s.class_name ?? "").trim();
    if (className) {
      const year = (s.academic_year ?? "").trim();
      const key = `${className.toLowerCase()}|${year.toLowerCase()}`;
      classId = classMap.get(key) ?? null;
      if (!classId) {
        const { data: newClass, error: classErr } = await admin
          .from("classes")
          .insert({
            school_id: body.school_id,
            name: className,
            level: (s.level ?? "").trim() || null,
            academic_year: year || null,
          })
          .select("id")
          .single();
        if (classErr || !newClass) {
          failed.push({ row: rowNum, reason: `Création classe: ${classErr?.message ?? "erreur"}` });
          continue;
        }
        classId = newClass.id;
        classMap.set(key, classId);
      }
    }

    prepared.push({
      rowNum,
      matricule: mat || null,
      payload: {
        school_id: body.school_id,
        first_name: first,
        last_name: last,
        post_name: (s.post_name ?? "").trim() || null,
        matricule: mat || null,
        gender: normalizeGender(s.gender ?? ""),
        birth_date: normalizeDate(s.birth_date ?? ""),
        birth_place: (s.birth_place ?? "").trim() || null,
        physical_address: (s.physical_address ?? "").trim() || null,
        photo_url: (s.photo_url ?? "").trim() || null,
        enrollment_date: normalizeDate(s.enrollment_date ?? ""),
        class_id: classId,
        section_id: sectionId,
        option_id: optionId,
      },
    });
    if (mat) seenInBatch.add(matKey);
  }

  // Étape 2 : insertion par lots de 500
  const created: any[] = [];
  const CHUNK = 500;
  for (let i = 0; i < prepared.length; i += CHUNK) {
    const slice = prepared.slice(i, i + CHUNK);
    const { data: inserted, error: insErr } = await admin
      .from("students")
      .insert(slice.map((p) => p.payload))
      .select("id, first_name, last_name, matricule");
    if (insErr) {
      // En cas d'échec du lot, on retombe sur insertions unitaires pour identifier les lignes fautives
      for (const p of slice) {
        const { data: one, error: oneErr } = await admin
          .from("students").insert(p.payload).select("id, first_name, last_name, matricule").single();
        if (oneErr) failed.push({ row: p.rowNum, reason: oneErr.message });
        else if (one) created.push(one);
      }
    } else if (inserted) {
      created.push(...inserted);
    }
  }

  return ok(
    {
      created_count: created.length,
      skipped_count: skipped.length,
      failed_count: failed.length,
      created,
      skipped,
      failed,
    },
    200,
    `${created.length} élèves créés, ${skipped.length} ignorés, ${failed.length} échecs`,
  );
});

// PUT /students/:id
router.put("/:id", async (req, params) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  if (!hasAnyRole(ctx, ["cashier", "admin", "super_admin"])) {
    return errors.scopeForbidden("Cashier/admin role required");
  }
  const body = (await req.json().catch(() => ({}))) as StudentBody;
  const admin = adminClient();
  const { data: existing } = await admin
    .from("students")
    .select("id, school_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!existing) return errors.notFound("Student not found");
  if (!(await canManageSchool(ctx, existing.school_id))) {
    return errors.scopeForbidden("Not your school");
  }

  const update: Record<string, unknown> = {};
  for (const k of ["first_name", "last_name", "post_name", "matricule", "birth_date", "birth_place", "gender", "enrollment_date", "class_id", "section_id", "option_id", "photo_url", "physical_address"] as const) {
    if (body[k] !== undefined) update[k] = body[k];
  }
  const { data, error } = await admin
    .from("students")
    .update(update)
    .eq("id", params.id)
    .select()
    .single();
  if (error) return errors.validation(error.message);
  return ok(data, 200, "Student updated");
});

// DELETE /students/:id
router.delete("/:id", async (req, params) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  if (!hasAnyRole(ctx, ["admin", "super_admin"])) {
    return errors.scopeForbidden("Admin role required");
  }
  const admin = adminClient();
  const { data: existing } = await admin
    .from("students")
    .select("id, school_id, first_name, last_name")
    .eq("id", params.id)
    .maybeSingle();
  if (!existing) return errors.notFound("Élève introuvable");
  if (!(await canManageSchool(ctx, existing.school_id))) {
    return errors.scopeForbidden("Pas votre école");
  }

  // Nettoyer les dépendances (pas de FK ON DELETE CASCADE en base)
  // 1) Reçus liés via paiements de l'élève
  const { data: pays } = await admin.from("payments").select("id").eq("student_id", params.id);
  const payIds = (pays ?? []).map((p: any) => p.id);
  if (payIds.length) {
    await admin.from("receipts").delete().in("payment_id", payIds);
    await admin.from("payments").delete().in("id", payIds);
  }
  // 2) Frais propres à l'élève
  await admin.from("fees").delete().eq("student_id", params.id).eq("scope", "STUDENT");
  // 3) Liens parents
  await admin.from("parent_students").delete().eq("student_id", params.id);
  // 4) L'élève
  const { error } = await admin.from("students").delete().eq("id", params.id);
  if (error) return errors.internal(error.message);
  return ok({ success: true }, 200, `Élève ${existing.first_name} ${existing.last_name} supprimé`);
});

Deno.serve((req) => router.handle(req));
