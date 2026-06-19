import { Router } from "../_shared/router.ts";
import { requireAuth, adminClient, hasAnyRole } from "../_shared/auth.ts";
import { ok, errors } from "../_shared/response.ts";

const router = new Router("/admin-users");

// GET /admin-users  -> list with stats
// super_admin: tous les utilisateurs
// admin (école): uniquement le personnel scopé sur sa primary_school_id (admin + cashier)
router.get("/", async (req) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  const isSuper = hasAnyRole(ctx, ["super_admin"]);
  const isSchoolAdmin = hasAnyRole(ctx, ["admin"]);
  if (!isSuper && !isSchoolAdmin) {
    return errors.scopeForbidden("Admin role required");
  }
  // Pour un admin école, on a besoin de connaître son école (via admin_schools).
  let schoolScope: string[] | null = null;
  if (!isSuper) {
    const { data: schoolsLinks } = await adminClient()
      .from("admin_schools")
      .select("school_id")
      .eq("user_id", ctx.userId);
    schoolScope = (schoolsLinks ?? []).map((r: any) => r.school_id);
    if (schoolScope.length === 0) {
      return ok({ items: [], stats: { total: 0, active: 0, cashiers: 0, parents: 0 } });
    }
  }
  const url = new URL(req.url);
  const search = (url.searchParams.get("search") ?? "").trim().toLowerCase();
  const roleFilter = url.searchParams.get("role"); // optional: 'cashier' | 'parent' | ...
  const statusFilter = url.searchParams.get("status"); // 'active' | 'suspended' | 'inactive'
  const sort = url.searchParams.get("sort") ?? "name_asc";

  const admin = adminClient();
  let profilesQuery = admin
    .from("profiles")
    .select("id, full_name, email, phone, avatar_url, primary_school_id, status, created_at");
  if (schoolScope) profilesQuery = profilesQuery.in("primary_school_id", schoolScope);

  const [
    { data: profiles },
    { data: roles },
    { data: activity },
    { data: schools },
  ] = await Promise.all([
    profilesQuery,
    admin.from("user_roles").select("user_id, role"),
    admin.from("user_activity").select("user_id, last_login_at"),
    admin.from("schools").select("id, name"),
  ]);

  const rolesByUser = new Map<string, string[]>();
  (roles ?? []).forEach((r: any) => {
    const arr = rolesByUser.get(r.user_id) ?? [];
    arr.push(r.role);
    rolesByUser.set(r.user_id, arr);
  });
  const activityByUser = new Map<string, string | null>();
  (activity ?? []).forEach((a: any) => activityByUser.set(a.user_id, a.last_login_at ?? null));
  const schoolsById = new Map<string, string>();
  (schools ?? []).forEach((s: any) => schoolsById.set(s.id, s.name));

  let items = (profiles ?? []).map((p: any) => {
    const userRoles = rolesByUser.get(p.id) ?? [];
    const primaryRole = userRoles.includes("super_admin")
      ? "super_admin"
      : userRoles.includes("admin")
      ? "admin"
      : userRoles.includes("cashier")
      ? "cashier"
      : userRoles.includes("parent")
      ? "parent"
      : "user";
    return {
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      phone: p.phone,
      avatar_url: p.avatar_url,
      status: p.status,
      created_at: p.created_at,
      role: primaryRole,
      roles: userRoles,
      last_login_at: activityByUser.get(p.id) ?? null,
      school_id: p.primary_school_id,
      school_name: p.primary_school_id ? schoolsById.get(p.primary_school_id) ?? null : null,
    };
  });

  // Pour admin école : on n'affiche que admin + cashier de son école (pas les parents).
  if (!isSuper) {
    items = items.filter((u) => u.roles.some((r) => r === "admin" || r === "cashier"));
  }

  if (search) {
    items = items.filter(
      (u) =>
        (u.full_name ?? "").toLowerCase().includes(search) ||
        (u.email ?? "").toLowerCase().includes(search) ||
        (u.school_name ?? "").toLowerCase().includes(search),
    );
  }
  if (roleFilter && roleFilter !== "all") {
    items = items.filter((u) => u.roles.includes(roleFilter));
  }
  if (statusFilter && statusFilter !== "all") {
    items = items.filter((u) => u.status === statusFilter);
  }

  const cmp = (a: any, b: any) => (a.full_name ?? "").localeCompare(b.full_name ?? "", "fr");
  if (sort === "name_desc") items.sort((a, b) => -cmp(a, b));
  else if (sort === "recent") items.sort((a, b) => (b.last_login_at ?? "").localeCompare(a.last_login_at ?? ""));
  else items.sort(cmp);

  // Stats : recalculées sur l'ensemble visible.
  const total = items.length;
  const actives = items.filter((u) => u.status === "active").length;
  const cashierCount = items.filter((u) => u.roles.includes("cashier")).length;
  const parentCount = items.filter((u) => u.roles.includes("parent")).length;

  return ok({
    items,
    stats: {
      total,
      active: actives,
      cashiers: cashierCount,
      parents: parentCount,
    },
  });
});

// GET /admin-users/:id -> detail
router.get("/:id", async (req, params) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  if (!hasAnyRole(ctx, ["super_admin"])) {
    return errors.scopeForbidden("Super admin role required");
  }
  const admin = adminClient();
  const id = params.id;
  const [{ data: p }, { data: r }, { data: act }] = await Promise.all([
    admin.from("profiles").select("id, full_name, email, phone, avatar_url, primary_school_id, status, created_at").eq("id", id).maybeSingle(),
    admin.from("user_roles").select("role").eq("user_id", id),
    admin.from("user_activity").select("last_login_at").eq("user_id", id).maybeSingle(),
  ]);
  if (!p) return errors.notFound("User not found");
  let school_name: string | null = null;
  if (p.primary_school_id) {
    const { data: s } = await admin.from("schools").select("name").eq("id", p.primary_school_id).maybeSingle();
    school_name = s?.name ?? null;
  }
  const rolesArr = (r ?? []).map((x: any) => x.role);
  const primaryRole = rolesArr.includes("super_admin")
    ? "super_admin"
    : rolesArr.includes("admin")
    ? "admin"
    : rolesArr.includes("cashier")
    ? "cashier"
    : rolesArr.includes("parent")
    ? "parent"
    : "user";
  return ok({
    id: p.id,
    full_name: p.full_name,
    email: p.email,
    phone: p.phone,
    avatar_url: p.avatar_url,
    status: p.status,
    created_at: p.created_at,
    school_id: p.primary_school_id,
    school_name,
    role: primaryRole,
    roles: rolesArr,
    last_login_at: act?.last_login_at ?? null,
  });
});

// PATCH /admin-users/:id -> update status (suspend/activate)
router.patch("/:id", async (req, params) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  if (!hasAnyRole(ctx, ["super_admin"])) {
    return errors.scopeForbidden("Super admin role required");
  }
  const body = await req.json().catch(() => ({}));
  const status = body.status as string | undefined;
  if (!status || !["active", "suspended", "inactive"].includes(status)) {
    return errors.badRequest("Invalid status");
  }
  const admin = adminClient();
  const { error } = await admin.from("profiles").update({ status }).eq("id", params.id);
  if (error) return errors.internal(error.message);
  return ok({ id: params.id, status });
});

// POST /admin-users -> create a school admin account (super_admin only)
router.post("/", async (req) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  const isSuper = hasAnyRole(ctx, ["super_admin"]);
  const isSchoolAdmin = hasAnyRole(ctx, ["admin"]);
  if (!isSuper && !isSchoolAdmin) {
    return errors.scopeForbidden("Admin role required");
  }
  const body = await req.json().catch(() => ({}));
  const email = (body.email as string | undefined)?.trim().toLowerCase();
  const password = body.password as string | undefined;
  const first_name = (body.first_name as string | undefined)?.trim() || null;
  const last_name = (body.last_name as string | undefined)?.trim() || null;
  const post_name = (body.post_name as string | undefined)?.trim() || null;
  const gender = (body.gender as string | undefined)?.trim() || null;
  const phone = (body.phone as string | undefined)?.trim() || null;
  const avatar_url = (body.avatar_url as string | undefined)?.trim() || null;
  const employee_matricule = (body.employee_matricule as string | undefined)?.trim() || null;
  const function_title = (body.function_title as string | undefined)?.trim() || null;
  const professional_address = (body.professional_address as string | undefined)?.trim() || null;
  let school_id = body.school_id as string | undefined;
  const role = (body.role as string | undefined) ?? "admin";

  // full_name: utilise champ explicite OU concat first/last
  const full_name = ((body.full_name as string | undefined)?.trim())
    || [first_name, post_name, last_name].filter(Boolean).join(" ").trim();

  if (!email || !email.includes("@")) return errors.validation("Email invalide");
  if (!password || password.length < 8) return errors.validation("Mot de passe : 8 caractères minimum");
  if (!full_name) return errors.validation("Nom complet requis (prénom et nom)");
  if (!["admin", "cashier"].includes(role)) return errors.validation("Rôle invalide");

  const admin = adminClient();

  if (!isSuper) {
    if (role !== "cashier") {
      return errors.scopeForbidden("Vous ne pouvez créer qu'un compte caissier");
    }
    const { data: schoolsLinks } = await admin
      .from("admin_schools")
      .select("school_id")
      .eq("user_id", ctx.userId)
      .limit(1)
      .maybeSingle();
    const ownSchoolId = schoolsLinks?.school_id ?? ctx.primarySchoolId;
    if (!ownSchoolId) return errors.scopeForbidden("Aucune école associée à votre compte");
    school_id = ownSchoolId;
  }

  if (!school_id) return errors.validation("École requise");

  const { data: school, error: schoolErr } = await admin
    .from("schools").select("id, name").eq("id", school_id).maybeSingle();
  if (schoolErr) return errors.internal(schoolErr.message);
  if (!school) return errors.notFound("École introuvable");

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, phone, role, must_change_password: true },
  });
  if (createErr || !created.user) {
    const msg = createErr?.message ?? "Création échouée";
    if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("registered")) {
      return errors.conflict("Cet email est déjà utilisé");
    }
    return errors.internal(msg);
  }
  const userId = created.user.id;

  await admin.from("user_roles").delete().eq("user_id", userId);
  const { error: roleErr } = await admin.from("user_roles").insert({ user_id: userId, role });
  if (roleErr) return errors.internal(`Rôle: ${roleErr.message}`);

  const { error: profErr } = await admin
    .from("profiles")
    .upsert({
      id: userId,
      email,
      primary_school_id: school_id,
      full_name,
      phone,
      first_name,
      last_name,
      post_name,
      gender,
      avatar_url,
      employee_matricule,
      function_title,
      professional_address,
    }, { onConflict: "id" });
  if (profErr) return errors.internal(`Profil: ${profErr.message}`);

  if (role === "admin") {
    const { error: linkErr } = await admin
      .from("admin_schools").insert({ user_id: userId, school_id });
    if (linkErr && !linkErr.message.toLowerCase().includes("duplicate")) {
      return errors.internal(`Affectation école: ${linkErr.message}`);
    }
  }

  return ok(
    { id: userId, email, full_name, role, school_id, school_name: school.name },
    201,
    "Compte créé",
  );
});

// PATCH /admin-users/:id/profile -> update profile fields (super admin or self-school admin)
router.patch("/:id/profile", async (req, params) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  if (!hasAnyRole(ctx, ["super_admin", "admin"])) {
    return errors.scopeForbidden("Admin role required");
  }
  const body = await req.json().catch(() => ({}));
  const admin = adminClient();
  const allowed = [
    "full_name", "phone", "avatar_url",
    "first_name", "last_name", "post_name", "gender",
    "employee_matricule", "function_title", "professional_address",
  ];
  const patch: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) patch[k] = (body as any)[k];
  if (Object.keys(patch).length === 0) return errors.validation("Aucun champ à modifier");

  // Scope : un admin école ne peut éditer que des profils de son école
  if (!hasAnyRole(ctx, ["super_admin"])) {
    const { data: target } = await admin.from("profiles").select("primary_school_id").eq("id", params.id).maybeSingle();
    if (!target?.primary_school_id) return errors.scopeForbidden("Profil hors scope");
    const { data: link } = await admin.from("admin_schools")
      .select("id").eq("user_id", ctx.userId).eq("school_id", target.primary_school_id).maybeSingle();
    if (!link) return errors.scopeForbidden("Pas votre école");
  }

  const { error } = await admin.from("profiles").update(patch).eq("id", params.id);
  if (error) return errors.internal(error.message);
  return ok({ id: params.id }, 200, "Profil mis à jour");
});

Deno.serve((req) => router.handle(req));
