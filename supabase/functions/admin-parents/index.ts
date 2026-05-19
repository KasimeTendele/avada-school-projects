import { Router } from "../_shared/router.ts";
import { requireAuth, adminClient, hasAnyRole } from "../_shared/auth.ts";
import { ok, errors } from "../_shared/response.ts";

const router = new Router("/admin-parents");

async function resolveSchoolId(ctx: {
  roles: string[];
  userId: string;
  primarySchoolId: string | null;
}, requested?: string): Promise<string | Response> {
  const isSuper = ctx.roles.includes("super_admin");
  if (isSuper) {
    if (!requested) return errors.validation("school_id requis");
    return requested;
  }
  const admin = adminClient();
  const { data } = await admin
    .from("admin_schools")
    .select("school_id")
    .eq("user_id", ctx.userId)
    .limit(1)
    .maybeSingle();
  const own = data?.school_id ?? ctx.primarySchoolId;
  if (!own) return errors.scopeForbidden("Aucune école associée");
  if (requested && requested !== own) return errors.scopeForbidden("Pas votre école");
  return own;
}

// GET /admin-parents?schoolId=...   -> liste des parents liés à au moins un élève de l'école
router.get("/", async (req) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  if (!hasAnyRole(ctx, ["admin", "super_admin"])) {
    return errors.scopeForbidden("Admin role required");
  }
  const url = new URL(req.url);
  const requested = url.searchParams.get("schoolId") ?? undefined;
  const search = (url.searchParams.get("search") ?? "").trim().toLowerCase();
  const resolved = await resolveSchoolId(ctx, requested);
  if (resolved instanceof Response) return resolved;
  const schoolId = resolved;

  const admin = adminClient();
  // Élèves de l'école -> ids
  const { data: students } = await admin.from("students").select("id, first_name, last_name, matricule").eq("school_id", schoolId);
  const studentIds = (students ?? []).map((s: any) => s.id);

  const { data: links } = studentIds.length
    ? await admin
        .from("parent_students")
        .select("parent_user_id, student_id, relationship")
        .in("student_id", studentIds)
    : { data: [] as any[] };

  // Parents directement rattachés à l'école (primary_school_id)
  const { data: schoolProfs } = await admin
    .from("profiles")
    .select("id")
    .eq("primary_school_id", schoolId);
  const schoolParentIds = new Set<string>((schoolProfs ?? []).map((p: any) => p.id));
  // Garder uniquement ceux ayant le rôle parent
  let parentRoleIds = new Set<string>();
  if (schoolParentIds.size) {
    const { data: roles } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "parent")
      .in("user_id", Array.from(schoolParentIds));
    parentRoleIds = new Set((roles ?? []).map((r: any) => r.user_id));
  }

  const parentIds = Array.from(new Set([
    ...(links ?? []).map((l: any) => l.parent_user_id),
    ...Array.from(parentRoleIds),
  ]));
  if (parentIds.length === 0) return ok({ items: [] });

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, email, phone, avatar_url, status, created_at")
    .in("id", parentIds);

  const studentsById = new Map<string, any>();
  (students ?? []).forEach((s: any) => studentsById.set(s.id, s));
  const childrenByParent = new Map<string, any[]>();
  (links ?? []).forEach((l: any) => {
    const arr = childrenByParent.get(l.parent_user_id) ?? [];
    const child = studentsById.get(l.student_id);
    if (child) arr.push({ ...child, relationship: l.relationship });
    childrenByParent.set(l.parent_user_id, arr);
  });

  let items = (profiles ?? []).map((p: any) => ({
    id: p.id,
    full_name: p.full_name,
    email: p.email,
    phone: p.phone,
    avatar_url: p.avatar_url,
    status: p.status,
    created_at: p.created_at,
    children: childrenByParent.get(p.id) ?? [],
  }));
  if (search) {
    items = items.filter((p) =>
      (p.full_name ?? "").toLowerCase().includes(search) ||
      (p.email ?? "").toLowerCase().includes(search) ||
      (p.phone ?? "").toLowerCase().includes(search) ||
      (p.children ?? []).some((c: any) => (c.matricule ?? "").toLowerCase().includes(search)),
    );
  }
  items.sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? "", "fr"));
  return ok({ items });
});

// POST /admin-parents -> create parent account + link to student by matricule
// body: { school_id?, full_name, email, password, phone?, matricule, relationship? }
router.post("/", async (req) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  if (!hasAnyRole(ctx, ["admin", "super_admin"])) {
    return errors.scopeForbidden("Admin role required");
  }
  const body = await req.json().catch(() => ({}));
  const requested = body.school_id as string | undefined;
  const resolved = await resolveSchoolId(ctx, requested);
  if (resolved instanceof Response) return resolved;
  const schoolId = resolved;

  const email = (body.email as string | undefined)?.trim().toLowerCase();
  const password = body.password as string | undefined;
  const first_name = (body.first_name as string | undefined)?.trim() || null;
  const last_name = (body.last_name as string | undefined)?.trim() || null;
  const post_name = (body.post_name as string | undefined)?.trim() || null;
  const gender = (body.gender as string | undefined)?.trim() || null;
  const profession = (body.profession as string | undefined)?.trim() || null;
  const physical_address = (body.physical_address as string | undefined)?.trim() || null;
  const professional_address = (body.professional_address as string | undefined)?.trim() || null;
  const avatar_url = (body.avatar_url as string | undefined)?.trim() || null;
  const substitute = body.substitute && typeof body.substitute === "object" ? body.substitute : null;
  const full_name = ((body.full_name as string | undefined)?.trim()) ||
    [first_name, post_name, last_name].filter(Boolean).join(" ").trim() ||
    null;
  const phone = (body.phone as string | undefined)?.trim() || null;
  const matricule = (body.matricule as string | undefined)?.trim();
  const relationship = ((body.relationship as string | undefined) ?? "parent").trim() || "parent";

  if (!email || !email.includes("@")) return errors.validation("Email invalide");
  if (!password || password.length < 8) return errors.validation("Mot de passe : 8 caractères minimum");
  if (!full_name) return errors.validation("Nom complet requis");
  if (!matricule) return errors.validation("Matricule de l'élève requis");

  const admin = adminClient();

  // Bloquer doublon : un parent ne peut être créé qu'une seule fois.
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .ilike("email", email)
    .maybeSingle();
  if (existingProfile) {
    return errors.conflict(
      `Ce parent existe déjà dans le système (${existingProfile.full_name ?? existingProfile.email}). Ouvrez la fiche de l'élève et utilisez "Lier un parent existant".`,
    );
  }

  // Trouver l'élève dans l'école par matricule
  const { data: student } = await admin
    .from("students")
    .select("id, first_name, last_name, matricule")
    .eq("school_id", schoolId)
    .ilike("matricule", matricule)
    .maybeSingle();
  if (!student) return errors.notFound(`Aucun élève trouvé avec le matricule "${matricule}" dans cette école`);

  // Créer le compte auth
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, phone, role: "parent" },
  });
  if (createErr || !created.user) {
    const msg = createErr?.message ?? "Création échouée";
    if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("registered")) {
      return errors.conflict("Cet email est déjà utilisé");
    }
    return errors.internal(msg);
  }
  const userId = created.user.id;

  // Upsert profil (le trigger handle_new_user peut être absent)
  await admin.from("profiles").upsert({
    id: userId,
    email,
    full_name,
    phone,
    first_name,
    last_name,
    post_name,
    gender,
    profession,
    relationship,
    physical_address,
    professional_address,
    avatar_url,
    substitute,
  }, { onConflict: "id" });

  // S'assurer du rôle parent
  await admin.from("user_roles").upsert(
    { user_id: userId, role: "parent" },
    { onConflict: "user_id,role" },
  );

  // Lier au student
  const { error: linkErr } = await admin
    .from("parent_students")
    .insert({ parent_user_id: userId, student_id: student.id, relationship });
  if (linkErr && !linkErr.message.toLowerCase().includes("duplicate")) {
    return errors.internal(`Lien parent-élève: ${linkErr.message}`);
  }

  return ok(
    {
      id: userId,
      email,
      full_name,
      student: { id: student.id, name: `${student.first_name} ${student.last_name}`, matricule: student.matricule },
    },
    201,
    "Compte parent créé et lié à l'élève",
  );
});

// POST /admin-parents/import  -> bulk import parents (admin/super_admin)
// body: { school_id?, parents: Array<{ first_name?, last_name?, post_name?, full_name?, email, password?, phone?, gender?, profession?, relationship?, physical_address?, professional_address?, avatar_url?, matricule? }> }
router.post("/import", async (req) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  if (!hasAnyRole(ctx, ["admin", "super_admin"])) {
    return errors.scopeForbidden("Admin role required");
  }
  const body = (await req.json().catch(() => ({}))) as {
    school_id?: string;
    parents?: Array<Record<string, string | undefined>>;
  };
  const resolved = await resolveSchoolId(ctx, body.school_id);
  if (resolved instanceof Response) return resolved;
  const schoolId = resolved;
  if (!body.parents?.length) return errors.validation("Aucun parent à importer");
  if (body.parents.length > 3000) return errors.validation("Maximum 3000 parents par import");

  const admin = adminClient();

  // Charger élèves de l'école pour résolution par matricule
  const { data: studentsData } = await admin
    .from("students")
    .select("id, first_name, last_name, matricule")
    .eq("school_id", schoolId)
    .not("matricule", "is", null);
  const studentByMat = new Map<string, any>();
  (studentsData ?? []).forEach((s: any) => {
    if (s.matricule) studentByMat.set(String(s.matricule).trim().toLowerCase(), s);
  });

  // Charger emails déjà existants
  const emails = body.parents
    .map((p) => (p.email ?? "").trim().toLowerCase())
    .filter(Boolean);
  const existingEmails = new Set<string>();
  if (emails.length > 0) {
    const { data: profs } = await admin
      .from("profiles")
      .select("email")
      .in("email", Array.from(new Set(emails)));
    (profs ?? []).forEach((p: any) => {
      if (p.email) existingEmails.add(String(p.email).trim().toLowerCase());
    });
  }

  function normalizeGender(v: string): string | null {
    const g = (v ?? "").trim().toLowerCase();
    if (!g) return null;
    if (["m", "h", "male", "homme", "masculin"].includes(g)) return "M";
    if (["f", "female", "femme", "féminin", "feminin"].includes(g)) return "F";
    return null;
  }
  function genPwd(): string {
    return "Parent" + Math.random().toString(36).slice(2, 8) + "!" + Math.floor(Math.random() * 90 + 10);
  }

  const created: any[] = [];
  const skipped: { row: number; email?: string; reason: string }[] = [];
  const failed: { row: number; reason: string }[] = [];
  const seenInBatch = new Set<string>();

  for (let i = 0; i < body.parents.length; i++) {
    const p = body.parents[i];
    const rowNum = i + 1;
    const email = (p.email ?? "").trim().toLowerCase();
    const first_name = (p.first_name ?? "").trim() || null;
    const last_name = (p.last_name ?? "").trim() || null;
    const post_name = (p.post_name ?? "").trim() || null;
    const full_name = (p.full_name ?? "").trim() ||
      [first_name, post_name, last_name].filter(Boolean).join(" ").trim() ||
      null;
    const phone = (p.phone ?? "").trim() || null;
    const matricule = (p.matricule ?? "").trim();

    if (!email || !email.includes("@")) {
      failed.push({ row: rowNum, reason: "Email invalide" });
      continue;
    }
    if (!full_name) {
      failed.push({ row: rowNum, reason: "Nom complet requis (first_name + last_name)" });
      continue;
    }
    if (existingEmails.has(email)) {
      skipped.push({ row: rowNum, email, reason: "Email déjà utilisé" });
      continue;
    }
    if (seenInBatch.has(email)) {
      skipped.push({ row: rowNum, email, reason: "Email en double dans le fichier" });
      continue;
    }

    let student: any = null;
    if (matricule) {
      student = studentByMat.get(matricule.toLowerCase()) ?? null;
      if (!student) {
        failed.push({ row: rowNum, reason: `Aucun élève avec matricule "${matricule}"` });
        continue;
      }
    }

    const password = (p.password ?? "").trim() || genPwd();
    if (password.length < 8) {
      failed.push({ row: rowNum, reason: "Mot de passe trop court (min 8)" });
      continue;
    }

    const { data: createdUser, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, phone, role: "parent" },
    });
    if (createErr || !createdUser.user) {
      const msg = createErr?.message ?? "Création échouée";
      if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("registered")) {
        skipped.push({ row: rowNum, email, reason: "Email déjà utilisé" });
      } else {
        failed.push({ row: rowNum, reason: msg });
      }
      continue;
    }
    const userId = createdUser.user.id;

    await admin.from("profiles").upsert({
      id: userId,
      email,
      full_name,
      phone,
      first_name,
      last_name,
      post_name,
      gender: normalizeGender(p.gender ?? ""),
      profession: (p.profession ?? "").trim() || null,
      relationship: (p.relationship ?? "parent").trim() || "parent",
      physical_address: (p.physical_address ?? "").trim() || null,
      professional_address: (p.professional_address ?? "").trim() || null,
      avatar_url: (p.avatar_url ?? "").trim() || null,
    }, { onConflict: "id" });

    await admin.from("user_roles").upsert(
      { user_id: userId, role: "parent" },
      { onConflict: "user_id,role" },
    );

    if (student) {
      await admin.from("parent_students").insert({
        parent_user_id: userId,
        student_id: student.id,
        relationship: (p.relationship ?? "parent").trim() || "parent",
      });
    }

    seenInBatch.add(email);
    existingEmails.add(email);
    created.push({
      id: userId,
      email,
      full_name,
      student: student ? { id: student.id, matricule: student.matricule } : null,
      generated_password: p.password ? undefined : password,
    });
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
    `${created.length} parents créés, ${skipped.length} ignorés, ${failed.length} échecs`,
  );
});

// GET /admin-parents/search-exact?email=... or ?phone=...
// Recherche cross-école par email ou téléphone EXACT (un seul résultat).
router.get("/search-exact", async (req) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  if (!hasAnyRole(ctx, ["admin", "super_admin"])) {
    return errors.scopeForbidden("Admin role required");
  }
  const url = new URL(req.url);
  const email = (url.searchParams.get("email") ?? "").trim().toLowerCase();
  const phone = (url.searchParams.get("phone") ?? "").trim();
  if (!email && !phone) return errors.validation("Email ou téléphone requis");

  const admin = adminClient();
  let q = admin.from("profiles").select("id, full_name, email, phone, avatar_url");
  if (email) q = q.ilike("email", email);
  else q = q.eq("phone", phone);
  const { data: profile } = await q.maybeSingle();
  if (!profile) return ok({ parent: null });

  // Vérifier que c'est bien un parent
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", profile.id)
    .eq("role", "parent")
    .maybeSingle();
  if (!roleRow) return ok({ parent: null });

  return ok({ parent: profile });
});

// GET /admin-parents/by-school?schoolId=...&search=...&page=1&limit=20
// Liste paginée des parents ayant déjà au moins un enfant dans l'école.
router.get("/by-school", async (req) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  if (!hasAnyRole(ctx, ["admin", "super_admin"])) {
    return errors.scopeForbidden("Admin role required");
  }
  const url = new URL(req.url);
  const requested = url.searchParams.get("schoolId") ?? undefined;
  const search = (url.searchParams.get("search") ?? "").trim().toLowerCase();
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? "20")));
  const resolved = await resolveSchoolId(ctx, requested);
  if (resolved instanceof Response) return resolved;
  const schoolId = resolved;

  const admin = adminClient();
  const { data: students } = await admin.from("students").select("id").eq("school_id", schoolId);
  const studentIds = (students ?? []).map((s: any) => s.id);
  if (studentIds.length === 0) return ok({ items: [], total: 0, page, limit });

  const { data: links } = await admin
    .from("parent_students")
    .select("parent_user_id")
    .in("student_id", studentIds);
  const parentIds = Array.from(new Set((links ?? []).map((l: any) => l.parent_user_id)));
  if (parentIds.length === 0) return ok({ items: [], total: 0, page, limit });

  let q = admin
    .from("profiles")
    .select("id, full_name, email, phone, avatar_url", { count: "exact" })
    .in("id", parentIds);
  if (search) {
    q = q.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
  }
  q = q.order("full_name", { ascending: true });
  q = q.range((page - 1) * limit, page * limit - 1);
  const { data: profiles, count } = await q;
  return ok({ items: profiles ?? [], total: count ?? 0, page, limit });
});

// GET /admin-parents/students/:studentId/parents -> parents liés à un élève
router.get("/students/:studentId/parents", async (req, params) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  if (!hasAnyRole(ctx, ["admin", "super_admin", "cashier"])) {
    return errors.scopeForbidden("Admin role required");
  }
  const admin = adminClient();
  const { data: student } = await admin
    .from("students")
    .select("id, school_id")
    .eq("id", params.studentId)
    .maybeSingle();
  if (!student) return errors.notFound("Élève introuvable");
  // Scope : l'admin doit avoir accès à cette école
  const isSuper = ctx.roles.includes("super_admin");
  if (!isSuper) {
    const { data: link } = await admin
      .from("admin_schools")
      .select("id")
      .eq("user_id", ctx.userId)
      .eq("school_id", student.school_id)
      .maybeSingle();
    const cashierOk = ctx.roles.includes("cashier") && ctx.primarySchoolId === student.school_id;
    if (!link && !cashierOk) return errors.scopeForbidden("Pas votre école");
  }
  const { data: links } = await admin
    .from("parent_students")
    .select("id, relationship, parent_user_id")
    .eq("student_id", params.studentId);
  const parentIds = (links ?? []).map((l: any) => l.parent_user_id);
  if (parentIds.length === 0) return ok({ items: [] });
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, email, phone, avatar_url")
    .in("id", parentIds);
  const byId = new Map((profiles ?? []).map((p: any) => [p.id, p]));
  const items = (links ?? []).map((l: any) => ({
    link_id: l.id,
    relationship: l.relationship,
    parent: byId.get(l.parent_user_id) ?? null,
  }));
  return ok({ items });
});

// POST /admin-parents/link  -> lier un parent existant à un élève
// body: { student_id, parent_user_id, relationship? }
router.post("/link", async (req) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  if (!hasAnyRole(ctx, ["admin", "super_admin"])) {
    return errors.scopeForbidden("Admin role required");
  }
  const body = await req.json().catch(() => ({}));
  const studentId = (body.student_id as string | undefined)?.trim();
  const parentUserId = (body.parent_user_id as string | undefined)?.trim();
  const relationship = ((body.relationship as string | undefined) ?? "parent").trim() || "parent";
  if (!studentId || !parentUserId) return errors.validation("student_id et parent_user_id requis");

  const admin = adminClient();
  const { data: student } = await admin
    .from("students")
    .select("id, school_id, first_name, last_name")
    .eq("id", studentId)
    .maybeSingle();
  if (!student) return errors.notFound("Élève introuvable");

  const isSuper = ctx.roles.includes("super_admin");
  if (!isSuper) {
    const { data: link } = await admin
      .from("admin_schools")
      .select("id")
      .eq("user_id", ctx.userId)
      .eq("school_id", student.school_id)
      .maybeSingle();
    if (!link) return errors.scopeForbidden("Pas votre école");
  }

  // Vérifier le parent
  const { data: parentProfile } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", parentUserId)
    .maybeSingle();
  if (!parentProfile) return errors.notFound("Parent introuvable");

  // Doublon de lien ?
  const { data: existing } = await admin
    .from("parent_students")
    .select("id")
    .eq("parent_user_id", parentUserId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (existing) return errors.conflict("Ce parent est déjà lié à cet élève");

  const { error: insErr } = await admin
    .from("parent_students")
    .insert({ parent_user_id: parentUserId, student_id: studentId, relationship });
  if (insErr) return errors.internal(insErr.message);

  return ok(
    {
      parent: parentProfile,
      student: { id: student.id, name: `${student.first_name} ${student.last_name}` },
    },
    201,
    `${parentProfile.full_name ?? "Parent"} a été lié à l'élève`,
  );
});

// DELETE /admin-parents/link/:linkId
router.delete("/link/:linkId", async (req, params) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  if (!hasAnyRole(ctx, ["admin", "super_admin"])) {
    return errors.scopeForbidden("Admin role required");
  }
  const admin = adminClient();
  const { data: link } = await admin
    .from("parent_students")
    .select("id, student_id, students!inner(school_id)")
    .eq("id", params.linkId)
    .maybeSingle();
  if (!link) return errors.notFound("Lien introuvable");
  const isSuper = ctx.roles.includes("super_admin");
  if (!isSuper) {
    const schoolId = (link as any).students.school_id;
    const { data: ah } = await admin
      .from("admin_schools").select("id").eq("user_id", ctx.userId).eq("school_id", schoolId).maybeSingle();
    if (!ah) return errors.scopeForbidden("Pas votre école");
  }
  const { error } = await admin.from("parent_students").delete().eq("id", params.linkId);
  if (error) return errors.internal(error.message);
  return ok({ success: true }, 200, "Lien supprimé");
});

// PATCH /admin-parents/:id  -> mise à jour du profil parent (admin de l'école d'au moins un enfant)
router.patch("/:id", async (req, params) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  if (!hasAnyRole(ctx, ["admin", "super_admin"])) {
    return errors.scopeForbidden("Admin role required");
  }
  const body = await req.json().catch(() => ({}));
  const admin = adminClient();
  const isSuper = ctx.roles.includes("super_admin");

  if (!isSuper) {
    // Vérifier que l'admin a accès via au moins un élève partagé
    const { data: links } = await admin
      .from("parent_students")
      .select("students!inner(school_id)")
      .eq("parent_user_id", params.id);
    const schoolIds = new Set((links ?? []).map((l: any) => l.students?.school_id).filter(Boolean));
    const { data: my } = await admin
      .from("admin_schools").select("school_id").eq("user_id", ctx.userId);
    const mySchools = new Set((my ?? []).map((r: any) => r.school_id));
    let allowed = false;
    schoolIds.forEach((s) => { if (mySchools.has(s)) allowed = true; });
    if (!allowed) return errors.scopeForbidden("Pas votre parent");
  }

  const update: Record<string, unknown> = {};
  for (const k of [
    "full_name", "first_name", "last_name", "post_name", "gender", "profession",
    "relationship", "phone", "physical_address", "professional_address", "avatar_url", "substitute",
  ] as const) {
    if (body[k] !== undefined) update[k] = body[k];
  }
  if (Object.keys(update).length === 0) return errors.validation("Aucun champ à mettre à jour");

  const { data, error } = await admin.from("profiles").update(update).eq("id", params.id).select().single();
  if (error) return errors.validation(error.message);
  return ok(data, 200, "Parent mis à jour");
});

// GET /admin-parents/:id  -> détails complets d'un parent (profil + enfants + infos compte)
router.get("/:id", async (req, params) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  if (!hasAnyRole(ctx, ["admin", "super_admin"])) {
    return errors.scopeForbidden("Admin role required");
  }
  const admin = adminClient();
  const isSuper = ctx.roles.includes("super_admin");

  // Charger le profil
  const { data: profile, error: profErr } = await admin
    .from("profiles")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (profErr) return errors.internal(profErr.message);
  if (!profile) return errors.notFound("Parent introuvable");

  // Charger les liens et écoles
  const { data: links } = await admin
    .from("parent_students")
    .select("id, relationship, student_id, students!inner(id, first_name, last_name, post_name, matricule, school_id, class_id, gender, birth_date, photo_url)")
    .eq("parent_user_id", params.id);

  const schoolIdsSet = new Set<string>();
  (links ?? []).forEach((l: any) => { if (l.students?.school_id) schoolIdsSet.add(l.students.school_id); });
  const schoolIds = Array.from(schoolIdsSet);

  // Scope admin
  if (!isSuper) {
    const { data: my } = await admin.from("admin_schools").select("school_id").eq("user_id", ctx.userId);
    const mySchools = new Set((my ?? []).map((r: any) => r.school_id));
    const allowed = schoolIds.some((s) => mySchools.has(s));
    if (!allowed) return errors.scopeForbidden("Pas votre parent");
  }

  // Charger noms d'écoles et classes
  const [{ data: schools }, classIds] = await Promise.all([
    schoolIds.length ? admin.from("schools").select("id, name").in("id", schoolIds) : Promise.resolve({ data: [] as any[] }),
    Promise.resolve(Array.from(new Set((links ?? []).map((l: any) => l.students?.class_id).filter(Boolean))) as string[]),
  ]);
  const { data: classes } = classIds.length
    ? await admin.from("classes").select("id, name, level, academic_year").in("id", classIds)
    : { data: [] as any[] };
  const schoolById = new Map((schools ?? []).map((s: any) => [s.id, s]));
  const classById = new Map((classes ?? []).map((c: any) => [c.id, c]));

  const children = (links ?? []).map((l: any) => ({
    link_id: l.id,
    relationship: l.relationship,
    id: l.students.id,
    first_name: l.students.first_name,
    last_name: l.students.last_name,
    post_name: l.students.post_name,
    matricule: l.students.matricule,
    gender: l.students.gender,
    birth_date: l.students.birth_date,
    photo_url: l.students.photo_url,
    school: schoolById.get(l.students.school_id) ?? null,
    class: l.students.class_id ? classById.get(l.students.class_id) ?? null : null,
  }));

  // Rôles
  const { data: roleRows } = await admin.from("user_roles").select("role").eq("user_id", params.id);
  const roles = (roleRows ?? []).map((r: any) => r.role);

  // Infos compte auth (last sign-in, confirmation)
  let account: any = null;
  try {
    const { data: userResp } = await admin.auth.admin.getUserById(params.id);
    if (userResp?.user) {
      account = {
        email: userResp.user.email,
        email_confirmed_at: userResp.user.email_confirmed_at,
        phone: userResp.user.phone,
        last_sign_in_at: userResp.user.last_sign_in_at,
        created_at: userResp.user.created_at,
        provider: userResp.user.app_metadata?.provider ?? null,
      };
    }
  } catch (_) { /* ignore */ }

  return ok({ profile, children, roles, account });
});

Deno.serve((req) => router.handle(req));