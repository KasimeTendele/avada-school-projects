import { Router } from "../_shared/router.ts";
import { adminClient, requireAuth, hasAnyRole } from "../_shared/auth.ts";
import { ok, paginated, errors } from "../_shared/response.ts";
import { sendMail } from "../_shared/mailer.ts";

const router = new Router("/demo-requests");

const SALES_EMAIL = Deno.env.get("DEMO_SALES_EMAIL") ?? "Office.drc@avadapay.com";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const PHONE_RE = /^\+243\d{9}$/;

function validatePayload(body: any): { ok: true; data: any } | { ok: false; details: Record<string, string> } {
  const details: Record<string, string> = {};
  const str = (v: any) => (typeof v === "string" ? v.trim() : "");

  const school_name = str(body?.school_name);
  if (!school_name) details.school_name = "Champ requis";
  const school_type = str(body?.school_type);
  if (!school_type) details.school_type = "Champ requis";
  const city = str(body?.city);
  if (!city) details.city = "Champ requis";
  const student_count = Number(body?.student_count);
  if (!Number.isInteger(student_count) || student_count <= 0)
    details.student_count = "Doit être un entier > 0";
  const contact_name = str(body?.contact_name);
  if (!contact_name) details.contact_name = "Champ requis";
  const contact_role = str(body?.contact_role);
  if (!contact_role) details.contact_role = "Champ requis";
  const contact_email = str(body?.contact_email).toLowerCase();
  if (!contact_email || !EMAIL_RE.test(contact_email))
    details.contact_email = "Email invalide";
  const contact_phone = str(body?.contact_phone).replace(/\s+/g, "");
  if (!contact_phone || !PHONE_RE.test(contact_phone))
    details.contact_phone = "Format attendu : +243XXXXXXXXX";
  const problems = Array.isArray(body?.problems) ? body.problems.map((p: any) => String(p)) : [];
  if (problems.length === 0) details.problems = "Sélectionnez au moins un problème";
  const other_problem = body?.other_problem ? str(body.other_problem) : null;
  if (problems.includes("Autre (précisez)") && !other_problem)
    details.other_problem = "Champ requis lorsque 'Autre' est sélectionné";
  const has_existing_system = Boolean(body?.has_existing_system);
  const existing_system_name = body?.existing_system_name ? str(body.existing_system_name) : null;
  const preferred_date = str(body?.preferred_date);
  if (!DATE_RE.test(preferred_date)) details.preferred_date = "Format YYYY-MM-DD";
  else {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d = new Date(preferred_date + "T00:00:00");
    if (d < today) details.preferred_date = "Doit être >= aujourd'hui";
  }
  const preferred_time = str(body?.preferred_time);
  if (!TIME_RE.test(preferred_time)) details.preferred_time = "Format HH:mm";
  const demo_mode = str(body?.demo_mode);
  if (!demo_mode) details.demo_mode = "Champ requis";
  const message = body?.message ? str(body.message) : null;

  if (Object.keys(details).length > 0) return { ok: false, details };
  return {
    ok: true,
    data: {
      school_name, school_type, city, student_count,
      contact_name, contact_role, contact_email, contact_phone,
      problems, other_problem, has_existing_system, existing_system_name,
      preferred_date, preferred_time, demo_mode, message,
    },
  };
}

function esc(s: string | null | undefined) {
  return String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string),
  );
}

async function notifyEmails(record: any) {
  // Email équipe commerciale
  const salesHtml = `
    <h2>Nouvelle demande de démonstration</h2>
    <p><b>École :</b> ${esc(record.school_name)} (${esc(record.school_type)})</p>
    <p><b>Ville :</b> ${esc(record.city)} — <b>Effectif :</b> ${record.student_count}</p>
    <p><b>Contact :</b> ${esc(record.contact_name)} — ${esc(record.contact_role)}</p>
    <p><b>Email :</b> ${esc(record.contact_email)} — <b>Tél :</b> ${esc(record.contact_phone)}</p>
    <p><b>Problèmes :</b> ${(record.problems ?? []).map(esc).join(", ")}</p>
    ${record.other_problem ? `<p><b>Autre :</b> ${esc(record.other_problem)}</p>` : ""}
    <p><b>Système existant :</b> ${record.has_existing_system ? "Oui" : "Non"} ${record.existing_system_name ? `(${esc(record.existing_system_name)})` : ""}</p>
    <p><b>Démo souhaitée :</b> ${esc(record.preferred_date)} à ${esc(record.preferred_time)} — ${esc(record.demo_mode)}</p>
    ${record.message ? `<p><b>Message :</b><br/>${esc(record.message)}</p>` : ""}
    <hr/><p>ID : ${record.id}</p>
  `;
  const userHtml = `
    <h2>Merci ${esc(record.contact_name)} 👋</h2>
    <p>Nous avons bien reçu votre demande de démonstration pour <b>${esc(record.school_name)}</b>.</p>
    <p>Notre équipe vous contactera sous <b>24 heures</b> pour confirmer le rendez-vous prévu le
    <b>${esc(record.preferred_date)}</b> à <b>${esc(record.preferred_time)}</b> (${esc(record.demo_mode)}).</p>
    <p>À très vite,<br/>L'équipe AvadaSchool</p>
  `;
  await Promise.allSettled([
    sendMail({ to: SALES_EMAIL, subject: `Nouvelle demande de démo — ${record.school_name}`, html: salesHtml }),
    sendMail({ to: record.contact_email, subject: "Votre demande de démo AvadaSchool a bien été reçue", html: userHtml }),
  ]);
}

// ---------- PUBLIC ----------

// GET /demo-requests/config
router.get("/config", async () => {
  const admin = adminClient();
  const { data, error } = await admin.from("demo_request_config").select("*").eq("id", 1).maybeSingle();
  if (error) return errors.internal(error.message);
  return ok({
    page: data?.page ?? {},
    features: data?.features ?? [],
    testimonials: data?.testimonials ?? [],
    trusted_schools: data?.trusted_schools ?? [],
    form_options: data?.form_options ?? {},
  });
});

// POST /demo-requests
router.post("/", async (req) => {
  let body: any;
  try { body = await req.json(); } catch { return errors.badRequest("Invalid JSON"); }
  const v = validatePayload(body);
  if (!v.ok) return errors.validation("Validation failed", v.details);

  const admin = adminClient();
  const { data, error } = await admin
    .from("demo_requests")
    .insert(v.data)
    .select("id, status, created_at")
    .single();
  if (error) return errors.internal(error.message);

  // Envoi emails (best effort, ne bloque pas la réponse)
  notifyEmails({ ...v.data, ...data }).catch((e) => console.error("[demo-requests] mail error", e));

  return ok(
    {
      id: data.id,
      status: data.status,
      created_at: data.created_at,
      message: "Demande enregistrée. Nous vous contacterons sous 24h.",
    },
    201,
    "Created",
  );
});

// ---------- ADMIN (super_admin) ----------

async function requireSuperAdmin(req: Request) {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  if (!hasAnyRole(ctx, ["super_admin"])) return errors.forbidden("Super admin only");
  return ctx;
}

// GET /demo-requests/admin
router.get("/admin", async (req) => {
  const ctx = await requireSuperAdmin(req);
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? "20")));
  const status = url.searchParams.get("status");
  const city = url.searchParams.get("city");
  const dateFrom = url.searchParams.get("dateFrom");
  const dateTo = url.searchParams.get("dateTo");

  const admin = adminClient();
  let q = admin.from("demo_requests").select("*", { count: "exact" });
  if (status) q = q.eq("status", status);
  if (city) q = q.ilike("city", `%${city}%`);
  if (dateFrom) q = q.gte("created_at", dateFrom);
  if (dateTo) q = q.lte("created_at", dateTo);
  q = q.order("created_at", { ascending: false })
       .range((page - 1) * limit, page * limit - 1);

  const { data, count, error } = await q;
  if (error) return errors.internal(error.message);
  return paginated(data ?? [], page, limit, count ?? 0);
});

// GET /demo-requests/admin/:id
router.get("/admin/:id", async (req, params) => {
  const ctx = await requireSuperAdmin(req);
  if (ctx instanceof Response) return ctx;
  const admin = adminClient();
  const { data, error } = await admin.from("demo_requests").select("*").eq("id", params.id).maybeSingle();
  if (error) return errors.internal(error.message);
  if (!data) return errors.notFound("Demo request not found");
  return ok(data);
});

// PATCH /demo-requests/admin/:id
router.patch("/admin/:id", async (req, params) => {
  const ctx = await requireSuperAdmin(req);
  if (ctx instanceof Response) return ctx;
  let body: any;
  try { body = await req.json(); } catch { return errors.badRequest("Invalid JSON"); }

  const ALLOWED_STATUSES = ["pending", "contacted", "scheduled", "completed", "cancelled"];
  const patch: Record<string, any> = {};
  if (body.status !== undefined) {
    if (!ALLOWED_STATUSES.includes(body.status))
      return errors.validation("Invalid status", { status: `Doit être l'un de ${ALLOWED_STATUSES.join(", ")}` });
    patch.status = body.status;
  }
  if (body.admin_notes !== undefined) patch.admin_notes = body.admin_notes;
  if (Object.keys(patch).length === 0) return errors.badRequest("Nothing to update");

  const admin = adminClient();
  const { data, error } = await admin.from("demo_requests").update(patch).eq("id", params.id).select("*").single();
  if (error) return errors.internal(error.message);
  return ok(data);
});

Deno.serve((req) => router.handle(req));