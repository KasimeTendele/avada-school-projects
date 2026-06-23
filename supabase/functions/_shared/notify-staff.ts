import { adminClient } from "./auth.ts";

/**
 * Notifie le personnel concerné par un paiement :
 *  - tous les super_admin
 *  - les admin liés à l'école (table admin_schools)
 *  - les cashier dont profiles.primary_school_id = school_id
 *
 * Évite les doublons et n'envoie pas la notification au parent initiateur
 * (il reçoit déjà sa propre notification "Paiement confirmé").
 */
export async function notifyStaffOfPayment(args: {
  paymentId: string;
  schoolId: string | null;
  studentId?: string | null;
  feeId?: string | null;
  amount: number | string;
  currency: string;
  method?: string | null;
  reference?: string | null;
  receiptId?: string | null;
  initiatedBy?: string | null;
}) {
  const admin = adminClient();
  try {
    // 1) Super admins (toujours notifiés)
    const { data: superAdmins } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "super_admin");

    // 2) Admins de l'école
    let schoolAdmins: { user_id: string }[] = [];
    let cashiers: { id: string }[] = [];
    let studentName: string | null = null;
    let schoolName: string | null = null;

    if (args.schoolId) {
      const [{ data: aRows }, { data: cRows }, { data: school }] = await Promise.all([
        admin.from("admin_schools").select("user_id").eq("school_id", args.schoolId),
        admin
          .from("profiles")
          .select("id")
          .eq("primary_school_id", args.schoolId),
        admin.from("schools").select("name").eq("id", args.schoolId).maybeSingle(),
      ]);
      schoolAdmins = aRows ?? [];
      // Filtrer les profils pour ne garder que ceux ayant le rôle cashier
      const candidateIds = (cRows ?? []).map((r) => r.id);
      if (candidateIds.length) {
        const { data: cashierRoles } = await admin
          .from("user_roles")
          .select("user_id")
          .eq("role", "cashier")
          .in("user_id", candidateIds);
        cashiers = (cashierRoles ?? []).map((r) => ({ id: r.user_id }));
      }
      schoolName = school?.name ?? null;
    }

    if (args.studentId) {
      const { data: student } = await admin
        .from("students")
        .select("first_name,last_name")
        .eq("id", args.studentId)
        .maybeSingle();
      if (student) studentName = `${student.first_name} ${student.last_name}`.trim();
    }

    // Recipients uniques
    const recipients = new Set<string>();
    for (const r of superAdmins ?? []) recipients.add(r.user_id);
    for (const r of schoolAdmins) recipients.add(r.user_id);
    for (const r of cashiers) recipients.add(r.id);
    if (args.initiatedBy) recipients.delete(args.initiatedBy);
    if (recipients.size === 0) return;

    const who = studentName ? ` pour ${studentName}` : "";
    const where = schoolName ? ` (${schoolName})` : "";
    const title = "Nouveau paiement reçu";
    const message = `Paiement de ${args.amount} ${args.currency}${who}${where} confirmé.`;

    const rows = Array.from(recipients).map((uid) => ({
      user_id: uid,
      type: "PAYMENT" as const,
      title,
      message,
      data: {
        paymentId: args.paymentId,
        studentId: args.studentId ?? null,
        studentName,
        schoolId: args.schoolId,
        schoolName,
        feeId: args.feeId ?? null,
        amount: args.amount,
        currency: args.currency,
        method: args.method ?? null,
        reference: args.reference ?? null,
        receiptId: args.receiptId ?? null,
        staff: true,
      },
    }));

    const { error } = await admin.from("notifications").insert(rows);
    if (error) console.warn("[notifyStaffOfPayment] insert error", error.message);
  } catch (e) {
    console.warn("[notifyStaffOfPayment] failed", e);
  }
}