import { Router } from "../_shared/router.ts";
import { requireAuth, adminClient, hasAnyRole } from "../_shared/auth.ts";
import { ok, errors } from "../_shared/response.ts";

const router = new Router("/cashier-dashboard");

// GET /cashier-dashboard/:schoolId
router.get("/:schoolId", async (req, params) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  const schoolId = params.schoolId;
  if (!hasAnyRole(ctx, ["cashier", "admin", "super_admin"])) {
    return errors.scopeForbidden("Cashier/admin role required");
  }
  // Scope: cashier must have primary_school_id == schoolId; admin must have admin_schools entry
  const admin = adminClient();
  if (!ctx.roles.includes("super_admin")) {
    if (ctx.roles.includes("cashier") && ctx.primarySchoolId !== schoolId) {
      return errors.scopeForbidden("Not your school");
    }
    if (ctx.roles.includes("admin") && !ctx.roles.includes("cashier")) {
      const { data: link } = await admin
        .from("admin_schools")
        .select("id")
        .eq("user_id", ctx.userId)
        .eq("school_id", schoolId)
        .maybeSingle();
      if (!link) return errors.scopeForbidden("Not your school");
    }
  }

  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

  const [
    { data: dayPayments, count: dayCount },
    { data: monthPayments },
    { data: pendingPayments, count: pendingCount },
    { data: lastPayments },
    { count: studentsCount },
    { count: classesCount },
    { data: feesAll },
  ] = await Promise.all([
    admin.from("payments").select("amount, currency", { count: "exact" })
      .eq("school_id", schoolId).eq("status", "COMPLETED").gte("paid_at", startOfDay),
    admin.from("payments").select("amount")
      .eq("school_id", schoolId).eq("status", "COMPLETED").gte("paid_at", startOfMonth),
    admin.from("payments").select("amount", { count: "exact" })
      .eq("school_id", schoolId).eq("status", "PENDING"),
    admin.from("payments").select("id, amount, currency, method, status, reference, paid_at, student_id, fee_id")
      .eq("school_id", schoolId).order("created_at", { ascending: false }).limit(10),
    admin.from("students").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
    admin.from("classes").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
    admin.from("fees").select("amount").eq("school_id", schoolId),
  ]);

  const sum = (rows: { amount: number }[] | null) =>
    (rows ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);

  const dayTotal = sum(dayPayments as any);
  const monthTotal = sum(monthPayments as any);
  const pendingTotal = sum(pendingPayments as any);
  const feesTotal = sum(feesAll as any);
  const completionRate = feesTotal > 0 ? Number(((monthTotal / feesTotal) * 100).toFixed(2)) : 0;

  return ok({
    schoolId,
    today: {
      total: dayTotal,
      transactionsCount: dayCount ?? 0,
      currency: (dayPayments?.[0] as any)?.currency ?? "CDF",
    },
    month: {
      total: monthTotal,
    },
    pending: {
      total: pendingTotal,
      count: pendingCount ?? 0,
    },
    overview: {
      studentsCount: studentsCount ?? 0,
      classesCount: classesCount ?? 0,
      feesTotal,
      completionRate,
    },
    lastPayments: lastPayments ?? [],
  });
});

Deno.serve((req) => router.handle(req));
