import { Router } from "../_shared/router.ts";
import { requireAuth, adminClient, hasAnyRole } from "../_shared/auth.ts";
import { ok, errors } from "../_shared/response.ts";

const router = new Router("/admin-dashboard");

router.get("/", async (req) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  const isSuper = hasAnyRole(ctx, ["super_admin"]);
  if (!hasAnyRole(ctx, ["super_admin", "admin", "cashier"])) {
    return errors.scopeForbidden("Admin role required");
  }
  const admin = adminClient();
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

  let schoolIds: string[] | null = null;
  if (!isSuper) {
    const { data: links } = await admin
      .from("admin_schools")
      .select("school_id")
      .eq("user_id", ctx.userId);
    schoolIds = (links ?? []).map((l: any) => l.school_id);
    if (schoolIds.length === 0 && ctx.primarySchoolId) schoolIds = [ctx.primarySchoolId];
    if (schoolIds.length === 0) return ok({
      schoolsCount: 0, activeSchoolsCount: 0, studentsCount: 0, classesCount: 0, usersCount: 0, cashiersCount: 0,
      monthTotal: 0, completionRate: 0, today: { total: 0, transactionsCount: 0 }, pending: { total: 0, count: 0 },
    });
  }

  let schoolsQ = admin.from("schools").select("id", { count: "exact", head: true });
  let activeSchoolsQ = admin.from("schools").select("id", { count: "exact", head: true }).eq("status", "active");
  let studentsQ = admin.from("students").select("id", { count: "exact", head: true });
  let classesQ = admin.from("classes").select("id", { count: "exact", head: true });
  let feesQ = admin.from("fees").select("amount, school_id");
  let monthPaymentsQ = admin.from("payments").select("amount, fees!inner(school_id)").eq("status", "COMPLETED").gte("paid_at", startOfMonth);
  let dayPaymentsQ = admin.from("payments").select("amount, fees!inner(school_id)", { count: "exact" }).eq("status", "COMPLETED").gte("paid_at", startOfDay);
  let pendingPaymentsQ = admin.from("payments").select("amount, fees!inner(school_id)", { count: "exact" }).eq("status", "PENDING");
  let profilesQ = admin.from("profiles").select("id", { count: "exact", head: true });

  if (schoolIds) {
    schoolsQ = schoolsQ.in("id", schoolIds);
    activeSchoolsQ = activeSchoolsQ.in("id", schoolIds);
    studentsQ = studentsQ.in("school_id", schoolIds);
    classesQ = classesQ.in("school_id", schoolIds);
    feesQ = feesQ.in("school_id", schoolIds);
    monthPaymentsQ = monthPaymentsQ.in("fees.school_id", schoolIds);
    dayPaymentsQ = dayPaymentsQ.in("fees.school_id", schoolIds);
    pendingPaymentsQ = pendingPaymentsQ.in("fees.school_id", schoolIds);
    profilesQ = profilesQ.in("primary_school_id", schoolIds);
  }

  const [
    schoolsRes,
    activeSchoolsRes,
    studentsRes,
    classesRes,
    feesAggRes,
    monthPaymentsRes,
    dayPaymentsRes,
    pendingPaymentsRes,
    cashiersRes,
    usersRes,
  ] = await Promise.all([
    schoolsQ,
    activeSchoolsQ,
    studentsQ,
    classesQ,
    feesQ,
    monthPaymentsQ,
    dayPaymentsQ,
    pendingPaymentsQ,
    admin.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "cashier"),
    profilesQ,
  ]);

  const sum = (rows: { amount: number }[] | null) =>
    (rows ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const monthTotal = sum(monthPaymentsRes.data as any);
  const feesTotal = sum(feesAggRes.data as any);
  const completionRate = feesTotal > 0 ? Math.min(100, Number(((monthTotal / feesTotal) * 100).toFixed(1))) : 0;

  return ok({
    schoolsCount: schoolsRes.count ?? 0,
    activeSchoolsCount: activeSchoolsRes.count ?? 0,
    studentsCount: studentsRes.count ?? 0,
    classesCount: classesRes.count ?? 0,
    usersCount: usersRes.count ?? 0,
    cashiersCount: cashiersRes.count ?? 0,
    monthTotal,
    completionRate,
    today: {
      total: sum(dayPaymentsRes.data as any),
      transactionsCount: dayPaymentsRes.count ?? 0,
    },
    pending: {
      total: sum(pendingPaymentsRes.data as any),
      count: pendingPaymentsRes.count ?? 0,
    },
  });
});

Deno.serve((req) => router.handle(req));
