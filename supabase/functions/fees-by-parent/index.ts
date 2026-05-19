import { Router } from "../_shared/router.ts";
import { requireAuth, adminClient, hasAnyRole } from "../_shared/auth.ts";
import { ok, errors } from "../_shared/response.ts";

const router = new Router("/fees-by-parent");

router.get("/", async (req) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  if (!hasAnyRole(ctx, ["parent", "super_admin"])) return errors.scopeForbidden("Parent role required");
  const admin = adminClient();

  // children of the parent
  const { data: links } = await admin
    .from("parent_students")
    .select("student:students(id, first_name, last_name, school_id, class_id)")
    .eq("parent_user_id", ctx.userId);
  type Child = { id: string; first_name: string; last_name: string; school_id: string; class_id: string | null };
  const students = (links ?? []).flatMap((l) => {
    const s = (l as { student: Child | Child[] | null }).student;
    if (!s) return [];
    return Array.isArray(s) ? s : [s];
  }) as Child[];
  if (students.length === 0) return ok({ items: [], total: 0 });

  const studentIds = students.map((s) => s.id);
  const classIds = Array.from(new Set(students.map((s) => s.class_id).filter(Boolean))) as string[];
  const schoolIds = Array.from(new Set(students.map((s) => s.school_id)));

  // fetch fees applicable per scope
  const orParts: string[] = [];
  if (studentIds.length) orParts.push(`and(scope.eq.STUDENT,student_id.in.(${studentIds.join(",")}))`);
  if (classIds.length) orParts.push(`and(scope.eq.CLASS,class_id.in.(${classIds.join(",")}))`);
  if (schoolIds.length) orParts.push(`and(scope.eq.SCHOOL,school_id.in.(${schoolIds.join(",")}))`);

  const { data: fees, error } = await admin
    .from("fees")
    .select("*")
    .or(orParts.join(","))
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error) return errors.internal(error.message);

  // For each (fee, child) couple, compute paid/remaining
  const { data: payments } = await admin
    .from("payments")
    .select("fee_id, student_id, amount, status")
    .in("student_id", studentIds);

  const items: Array<Record<string, unknown>> = [];
  for (const fee of fees ?? []) {
    const concerned = students.filter((s) => {
      if (fee.scope === "STUDENT") return fee.student_id === s.id;
      if (fee.scope === "CLASS") return fee.class_id === s.class_id;
      if (fee.scope === "SCHOOL") return fee.school_id === s.school_id;
      return false;
    });
    for (const child of concerned) {
      const paid = (payments ?? [])
        .filter((p) => p.fee_id === fee.id && p.student_id === child.id && p.status === "COMPLETED")
        .reduce((sum, p) => sum + Number(p.amount), 0);
      items.push({
        fee_id: fee.id,
        fee_type: fee.fee_type,
        label: fee.label,
        scope: fee.scope,
        amount: Number(fee.amount),
        currency: fee.currency,
        due_date: fee.due_date,
        academic_year: fee.academic_year,
        student: { id: child.id, first_name: child.first_name, last_name: child.last_name },
        total: Number(fee.amount),
        paid,
        remaining: Math.max(0, Number(fee.amount) - paid),
      });
    }
  }

  return ok({ items, total: items.length });
});

Deno.serve((req) => router.handle(req));
