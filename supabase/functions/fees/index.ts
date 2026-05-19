import { Router } from "../_shared/router.ts";
import { requireAuth, adminClient, hasAnyRole } from "../_shared/auth.ts";
import { ok, paginated, errors } from "../_shared/response.ts";
import { applyFilters, applySort, parseListParams } from "../_shared/list-params.ts";

const router = new Router("/fees");

// GET /fees — global vision (RLS auto-scopes by role)
router.get("/", async (req) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  const url = new URL(req.url);
  const params = parseListParams(url);

  let q = ctx.client
    .from("fees")
    .select("*, school:schools(id, name), class:classes(id, name)", { count: "exact" });

  if (params.search) q = q.or(`label.ilike.%${params.search}%,fee_type.ilike.%${params.search}%`);
  q = applyFilters(q, params.filters);
  q = params.sort.length ? applySort(q, params.sort) : q.order("created_at", { ascending: false });
  q = q.range((params.page - 1) * params.limit, params.page * params.limit - 1);

  const { data, count, error } = await q;
  if (error) return errors.internal(error.message);
  return paginated(data ?? [], params.page, params.limit, count ?? 0);
});

// GET /fees/by-school/:schoolId — with paid/remaining aggregated
router.get("/by-school/:schoolId", async (req, params) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  const schoolId = params.schoolId;

  const admin = adminClient();
  // Scope check
  if (!ctx.roles.includes("super_admin")) {
    const isCashier = ctx.roles.includes("cashier") && ctx.primarySchoolId === schoolId;
    let isAdmin = false;
    if (ctx.roles.includes("admin")) {
      const { data: link } = await admin
        .from("admin_schools").select("id")
        .eq("user_id", ctx.userId).eq("school_id", schoolId).maybeSingle();
      isAdmin = !!link;
    }
    if (!isCashier && !isAdmin) return errors.scopeForbidden("Not your school");
  }

  const { data: fees, error } = await admin
    .from("fees")
    .select("*, class:classes(id, name), student:students(id, first_name, last_name, matricule)")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });
  if (error) return errors.internal(error.message);

  // Aggregate payments per fee
  const feeIds = (fees ?? []).map((f) => f.id);
  let paidByFee = new Map<string, number>();
  if (feeIds.length) {
    const { data: payments } = await admin
      .from("payments")
      .select("fee_id, amount, status")
      .in("fee_id", feeIds)
      .eq("status", "COMPLETED");
    for (const p of payments ?? []) {
      paidByFee.set(p.fee_id, (paidByFee.get(p.fee_id) ?? 0) + Number(p.amount));
    }
  }

  const items = (fees ?? []).map((f) => {
    const paid = paidByFee.get(f.id) ?? 0;
    const total = Number(f.amount);
    return { ...f, paid, remaining: Math.max(0, total - paid) };
  });

  return ok({ items, total: items.length });
});

interface FeeBody {
  school_id?: string;
  scope?: "STUDENT" | "CLASS" | "SCHOOL";
  label?: string;
  fee_type?: string;
  amount?: number;
  currency?: string;
  due_date?: string;
  academic_year?: string;
  class_id?: string;
  student_id?: string;
}

// POST /fees
router.post("/", async (req) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  if (!hasAnyRole(ctx, ["cashier", "admin", "super_admin"])) {
    return errors.scopeForbidden("Cashier/admin role required");
  }
  const body = (await req.json().catch(() => ({}))) as FeeBody;
  const errs: { field: string; message: string }[] = [];
  if (!body.school_id) errs.push({ field: "school_id", message: "required" });
  if (!body.scope) errs.push({ field: "scope", message: "required (STUDENT|CLASS|SCHOOL)" });
  if (!body.label) errs.push({ field: "label", message: "required" });
  if (!body.fee_type) errs.push({ field: "fee_type", message: "required" });
  if (!body.amount || body.amount <= 0) errs.push({ field: "amount", message: "must be > 0" });
  if (body.scope === "STUDENT" && !body.student_id) errs.push({ field: "student_id", message: "required for STUDENT scope" });
  if (body.scope === "CLASS" && !body.class_id) errs.push({ field: "class_id", message: "required for CLASS scope" });
  if (errs.length) return errors.validation("Validation failed", errs);

  const admin = adminClient();
  // Scope check
  if (!ctx.roles.includes("super_admin")) {
    const isCashier = ctx.roles.includes("cashier") && ctx.primarySchoolId === body.school_id;
    let isAdmin = false;
    if (ctx.roles.includes("admin")) {
      const { data: link } = await admin
        .from("admin_schools").select("id")
        .eq("user_id", ctx.userId).eq("school_id", body.school_id!).maybeSingle();
      isAdmin = !!link;
    }
    if (!isCashier && !isAdmin) return errors.scopeForbidden("Not your school");
  }

  const { data, error } = await admin
    .from("fees")
    .insert({
      school_id: body.school_id,
      scope: body.scope,
      label: body.label,
      fee_type: body.fee_type,
      amount: body.amount,
      currency: body.currency ?? "CDF",
      due_date: body.due_date ?? null,
      academic_year: body.academic_year ?? null,
      class_id: body.scope === "CLASS" ? body.class_id : null,
      student_id: body.scope === "STUDENT" ? body.student_id : null,
    })
    .select()
    .single();
  if (error) return errors.validation(error.message);
  return ok(data, 201, "Fee created");
});

Deno.serve((req) => router.handle(req));
