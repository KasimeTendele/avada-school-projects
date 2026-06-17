import { Router } from "../_shared/router.ts";
import { requireAuth, adminClient, hasAnyRole } from "../_shared/auth.ts";
import { ok, errors } from "../_shared/response.ts";

const router = new Router("/admin-collections");

// GET /admin-collections/:id  -> détails complets d'un encaissement (paiement) ou d'un frais (fee)
// Retourne école, motif (label du frais), montant, infos élève (nom complet, classe)
router.get("/:id", async (req, params) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  if (!hasAnyRole(ctx, ["super_admin", "admin", "cashier"])) {
    return errors.scopeForbidden("Admin/cashier role required");
  }
  const admin = adminClient();

  // Essayer d'abord de trouver un payment avec cet ID
  const { data: payment, error: paymentError } = await admin
    .from("payments")
    .select("id, amount, currency, method, status, paid_at, created_at, reference, student_id, fee_id, school_id")
    .eq("id", params.id)
    .maybeSingle();

  if (paymentError) return errors.internal(paymentError.message);

  // Si payment trouvé, retourner les détails du payment
  if (payment) {
    const [{ data: school }, { data: fee }, { data: student }] = await Promise.all([
      payment.school_id
        ? admin.from("schools").select("id, name, sigle, city, logo_url").eq("id", payment.school_id).maybeSingle()
        : Promise.resolve({ data: null }),
      payment.fee_id
        ? admin.from("fees").select("id, label, amount, currency, scope, due_date").eq("id", payment.fee_id).maybeSingle()
        : Promise.resolve({ data: null }),
      payment.student_id
        ? admin.from("students").select("id, first_name, last_name, post_name, matricule, gender, photo_url, class_id, school_id").eq("id", payment.student_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    let studentClass: any = null;
    const classId = (student as any)?.class_id ?? null;
    if (classId) {
      const { data: c } = await admin
        .from("classes").select("id, name, level, academic_year").eq("id", classId).maybeSingle();
      studentClass = c ?? null;
    }

    const fullName = student
      ? [(student as any).first_name, (student as any).post_name, (student as any).last_name]
          .filter(Boolean).join(" ").trim()
      : null;

    return ok({
      type: "payment",
      payment: {
        id: payment.id,
        amount: Number(payment.amount ?? 0),
        currency: payment.currency,
        method: payment.method,
        status: payment.status,
        reference: (payment as any).reference ?? null,
        paid_at: payment.paid_at,
        created_at: payment.created_at,
      },
      motif: fee?.label ?? null,
      fee: fee
        ? {
            id: (fee as any).id,
            label: (fee as any).label,
            amount: Number((fee as any).amount ?? 0),
            currency: (fee as any).currency,
            scope: (fee as any).scope,
            due_date: (fee as any).due_date ?? null,
          }
        : null,
      school: school
        ? {
            id: (school as any).id,
            name: (school as any).name,
            sigle: (school as any).sigle ?? null,
            city: (school as any).city ?? null,
            logo_url: (school as any).logo_url ?? null,
          }
        : null,
      student: student
        ? {
            id: (student as any).id,
            full_name: fullName,
            first_name: (student as any).first_name,
            last_name: (student as any).last_name,
            post_name: (student as any).post_name ?? null,
            matricule: (student as any).matricule,
            gender: (student as any).gender ?? null,
            photo_url: (student as any).photo_url ?? null,
            class: studentClass,
          }
        : null,
    });
  }

  // Si pas de payment, chercher un fee avec cet ID
  const { data: fee, error: feeError } = await admin
    .from("fees")
    .select("id, label, amount, currency, scope, due_date, school_id, class_id, student_id")
    .eq("id", params.id)
    .maybeSingle();

  if (feeError) return errors.internal(feeError.message);
  if (!fee) return errors.notFound("Encaissement introuvable");

  const [{ data: school }, { data: student }] = await Promise.all([
    fee.school_id
      ? admin.from("schools").select("id, name, sigle, city, logo_url").eq("id", fee.school_id).maybeSingle()
      : Promise.resolve({ data: null }),
    fee.student_id
      ? admin.from("students").select("id, first_name, last_name, post_name, matricule, gender, photo_url, class_id, school_id").eq("id", fee.student_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  let studentClass: any = null;
  const classId = (student as any)?.class_id ?? null;
  if (classId) {
    const { data: c } = await admin
      .from("classes").select("id, name, level, academic_year").eq("id", classId).maybeSingle();
    studentClass = c ?? null;
  }

  const fullName = student
    ? [(student as any).first_name, (student as any).post_name, (student as any).last_name]
        .filter(Boolean).join(" ").trim()
    : null;

  return ok({
    type: "fee",
    fee: {
      id: fee.id,
      label: fee.label,
      amount: Number(fee.amount ?? 0),
      currency: fee.currency,
      scope: fee.scope,
      due_date: fee.due_date ?? null,
    },
    motif: fee.label,
    school: school
      ? {
          id: (school as any).id,
          name: (school as any).name,
          sigle: (school as any).sigle ?? null,
          city: (school as any).city ?? null,
          logo_url: (school as any).logo_url ?? null,
        }
      : null,
    student: student
      ? {
          id: (student as any).id,
          full_name: fullName,
          first_name: (student as any).first_name,
          last_name: (student as any).last_name,
          post_name: (student as any).post_name ?? null,
          matricule: (student as any).matricule,
          gender: (student as any).gender ?? null,
          photo_url: (student as any).photo_url ?? null,
          class: studentClass,
        }
      : null,
  });
});

router.get("/", async (req) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  if (!hasAnyRole(ctx, ["super_admin"])) {
    return errors.scopeForbidden("Super admin role required");
  }
  const admin = adminClient();
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const startPrevWeek = new Date(startOfWeek);
  startPrevWeek.setDate(startOfWeek.getDate() - 7);

  const [
    { data: pending },
    { data: completed },
    { data: completedPrevWeek },
    { data: completedThisWeek },
    { data: feesPending },
    { data: lastPayments },
    { data: students },
    { data: schools },
    { data: classes },
    { data: feesAll },
    { data: allPayments },
  ] = await Promise.all([
    admin.from("payments").select("amount").eq("status", "PENDING"),
    admin.from("payments").select("amount").eq("status", "COMPLETED"),
    admin.from("payments").select("amount").eq("status", "COMPLETED").gte("paid_at", startPrevWeek.toISOString()).lt("paid_at", startOfWeek.toISOString()),
    admin.from("payments").select("amount").eq("status", "COMPLETED").gte("paid_at", startOfWeek.toISOString()),
    admin.from("fees").select("id, label, amount, currency, school_id, class_id, student_id").limit(20),
    admin.from("payments").select("id, amount, currency, method, status, paid_at, created_at, student_id, fee_id, school_id").order("created_at", { ascending: false }).limit(20),
    admin.from("students").select("id, first_name, last_name, post_name, matricule, photo_url, school_id, class_id"),
    admin.from("schools").select("id, name, status, logo_url, city"),
    admin.from("classes").select("id, name"),
    admin.from("fees").select("id, label, amount, currency, school_id, class_id, student_id"),
    admin.from("payments").select("amount, status, school_id"),
  ]);

  const sum = (rows: any[] | null) => (rows ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const totalPending = sum(pending);
  const totalCompleted = sum(completed);
  const thisWeek = sum(completedThisWeek);
  const prevWeek = sum(completedPrevWeek);
  const growth = prevWeek > 0 ? ((thisWeek - prevWeek) / prevWeek) * 100 : 0;

  const studentsById = new Map<string, any>();
  (students ?? []).forEach((s: any) => studentsById.set(s.id, s));
  const schoolsById = new Map<string, string>();
  (schools ?? []).forEach((s: any) => schoolsById.set(s.id, s.name));
  const classesById = new Map<string, string>();
  (classes ?? []).forEach((c: any) => classesById.set(c.id, c.name));
  const feesById = new Map<string, any>();
  (feesAll ?? []).forEach((f: any) => feesById.set(f.id, f));

  // Compute "remaining" per fee (skip lookup of paid for simplicity, use fee.amount)
  const feesToCollect = (feesPending ?? []).map((f: any) => {
    const student = f.student_id ? studentsById.get(f.student_id) : null;
    return {
      id: f.id,
      label: f.label,
      amount: Number(f.amount ?? 0),
      currency: f.currency,
      school_name: schoolsById.get(f.school_id) ?? "—",
      class_name: f.class_id ? classesById.get(f.class_id) : null,
      student_name: student ? `${student.first_name} ${student.last_name}` : "—",
      remaining: Number(f.amount ?? 0),
    };
  });

  const recent = (lastPayments ?? []).map((p: any) => {
    const student = p.student_id ? studentsById.get(p.student_id) : null;
    const fee = p.fee_id ? feesById.get(p.fee_id) : null;
    return {
      id: p.id,
      amount: Number(p.amount ?? 0),
      currency: p.currency,
      method: p.method,
      status: p.status,
      paid_at: p.paid_at,
      created_at: p.created_at,
      student_name: student ? `${student.first_name} ${student.last_name}` : "—",
      school_name: schoolsById.get(p.school_id) ?? "—",
      fee_label: fee?.label ?? null,
    };
  });

  // Per-school aggregates
  const perSchool = (schools ?? []).map((sch: any) => {
    const sStudents = (students ?? []).filter((st: any) => st.school_id === sch.id);
    const sFees = (feesAll ?? []).filter((f: any) => f.school_id === sch.id);
    const sPayments = (allPayments ?? []).filter((p: any) => p.school_id === sch.id);
    const collected = sPayments
      .filter((p: any) => p.status === "COMPLETED")
      .reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
    const pendingAmt = sPayments
      .filter((p: any) => p.status === "PENDING")
      .reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
    const expected = sFees.reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
    const rate = expected > 0 ? Number(((collected / expected) * 100).toFixed(1)) : 0;
    return {
      id: sch.id,
      name: sch.name,
      city: sch.city ?? null,
      logo_url: sch.logo_url ?? null,
      status: sch.status,
      students_count: sStudents.length,
      fees_count: sFees.length,
      collected,
      pending: pendingAmt,
      completion_rate: rate,
    };
  }).sort((a: any, b: any) => b.collected - a.collected);

  return ok({
    pending: { total: totalPending, growthPct: 0 },
    completed: { total: totalCompleted, growthPct: Number(growth.toFixed(1)) },
    feesToCollect,
    recent,
    perSchool,
  });
});

Deno.serve((req) => router.handle(req));
