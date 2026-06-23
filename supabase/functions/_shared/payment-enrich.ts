import { adminClient } from "./auth.ts";
import { detectProvider, normalizePhone } from "./avadapay.ts";

// Enrichit une liste de paiements avec : fee (motif), student + classe,
// école, reçu, payeur, et — pour le Mobile Money — téléphone + opérateur.
export interface EnrichedPayment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  method: string | null;
  reference: string | null;
  phone: string | null;
  operator: string | null;
  motif: string | null;
  fee: { id: string; label: string; fee_type: string } | null;
  student: {
    id: string;
    first_name: string;
    last_name: string;
    matricule: string | null;
    class_id: string | null;
    class_name: string | null;
  } | null;
  school: { id: string; name: string; sigle: string | null } | null;
  receipt: { id: string; receipt_number: string } | null;
  initiated_by: string | null;
  payer: { id: string; full_name: string | null; email: string | null; phone: string | null } | null;
  paid_at: string | null;
  created_at: string;
}

export async function enrichPayments(payments: Array<Record<string, unknown>>): Promise<EnrichedPayment[]> {
  if (!payments.length) return [];
  const admin = adminClient();
  const feeIds = [...new Set(payments.map((p) => p.fee_id).filter(Boolean))] as string[];
  const studentIds = [...new Set(payments.map((p) => p.student_id).filter(Boolean))] as string[];
  const schoolIds = [...new Set(payments.map((p) => p.school_id).filter(Boolean))] as string[];
  const paymentIds = payments.map((p) => p.id as string);
  const payerIds = [...new Set(payments.map((p) => p.initiated_by).filter(Boolean))] as string[];

  const [fees, students, schools, receipts, payers] = await Promise.all([
    feeIds.length
      ? admin.from("fees").select("id,label,fee_type").in("id", feeIds)
      : Promise.resolve({ data: [] as Array<{ id: string; label: string; fee_type: string }> }),
    studentIds.length
      ? admin.from("students").select("id,first_name,last_name,matricule,class_id").in("id", studentIds)
      : Promise.resolve({ data: [] as Array<{ id: string; first_name: string; last_name: string; matricule: string | null; class_id: string | null }> }),
    schoolIds.length
      ? admin.from("schools").select("id,name,sigle").in("id", schoolIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string; sigle: string | null }> }),
    admin.from("receipts").select("id,payment_id,receipt_number").in("payment_id", paymentIds),
    payerIds.length
      ? admin.from("profiles").select("id,full_name,email,phone").in("id", payerIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null; email: string | null; phone: string | null }> }),
  ]);

  const classIds = [...new Set((students.data ?? []).map((s) => s.class_id).filter(Boolean))] as string[];
  const { data: classes } = classIds.length
    ? await admin.from("classes").select("id,name,level").in("id", classIds)
    : { data: [] as Array<{ id: string; name: string; level: string | null }> };

  const feeMap = new Map((fees.data ?? []).map((f) => [f.id, f]));
  const studentMap = new Map((students.data ?? []).map((s) => [s.id, s]));
  const schoolMap = new Map((schools.data ?? []).map((s) => [s.id, s]));
  const receiptMap = new Map((receipts.data ?? []).map((r) => [r.payment_id, r]));
  const payerMap = new Map((payers.data ?? []).map((p) => [p.id, p]));
  const classMap = new Map((classes ?? []).map((c) => [c.id, c]));

  return payments.map((p) => {
    const fee = (p.fee_id ? feeMap.get(p.fee_id as string) : null) ?? null;
    const student = (p.student_id ? studentMap.get(p.student_id as string) : null) ?? null;
    const school = (p.school_id ? schoolMap.get(p.school_id as string) : null) ?? null;
    const receipt = receiptMap.get(p.id as string) ?? null;
    const payer = (p.initiated_by ? payerMap.get(p.initiated_by as string) : null) ?? null;
    const cls = student?.class_id ? classMap.get(student.class_id) ?? null : null;
    const className = cls ? [cls.level, cls.name].filter(Boolean).join(" ") || cls.name : null;

    // Téléphone & opérateur — uniquement pertinent pour MOBILE_MONEY,
    // où la "reference" du paiement contient le numéro utilisé.
    let phone: string | null = null;
    let operator: string | null = null;
    if (p.method === "MOBILE_MONEY" && p.reference) {
      const normalized = normalizePhone(String(p.reference));
      phone = normalized || String(p.reference);
      operator = detectProvider(String(p.reference));
    }

    return {
      id: p.id as string,
      amount: Number(p.amount),
      currency: String(p.currency),
      status: String(p.status),
      method: (p.method as string | null) ?? null,
      reference: (p.reference as string | null) ?? null,
      phone,
      operator,
      motif: fee?.label ?? null,
      fee: fee ? { id: fee.id, label: fee.label, fee_type: fee.fee_type } : null,
      student: student
        ? {
            id: student.id,
            first_name: student.first_name,
            last_name: student.last_name,
            matricule: student.matricule ?? null,
            class_id: student.class_id ?? null,
            class_name: className,
          }
        : null,
      school: school ? { id: school.id, name: school.name, sigle: school.sigle ?? null } : null,
      receipt: receipt ? { id: receipt.id, receipt_number: receipt.receipt_number } : null,
      initiated_by: (p.initiated_by as string | null) ?? null,
      payer: payer
        ? { id: payer.id, full_name: payer.full_name, email: payer.email, phone: payer.phone }
        : null,
      paid_at: (p.paid_at as string | null) ?? null,
      created_at: String(p.created_at),
    } satisfies EnrichedPayment;
  });
}

// Regroupe une liste enrichie par clé (école ou classe) avec totaux par devise.
export function groupBy(
  rows: EnrichedPayment[],
  by: "school" | "class",
): Array<{
  key: string;
  label: string;
  count: number;
  totals: Record<string, number>;
  payments: EnrichedPayment[];
}> {
  const groups = new Map<string, { label: string; payments: EnrichedPayment[] }>();
  for (const r of rows) {
    const k =
      by === "school"
        ? r.school?.id ?? "unknown"
        : r.student?.class_id ?? "unknown";
    const label =
      by === "school"
        ? r.school?.name ?? "École inconnue"
        : r.student?.class_name ?? "Classe inconnue";
    if (!groups.has(k)) groups.set(k, { label, payments: [] });
    groups.get(k)!.payments.push(r);
  }
  return [...groups.entries()].map(([key, g]) => {
    const totals: Record<string, number> = {};
    for (const p of g.payments) {
      totals[p.currency] = (totals[p.currency] ?? 0) + p.amount;
    }
    return { key, label: g.label, count: g.payments.length, totals, payments: g.payments };
  });
}