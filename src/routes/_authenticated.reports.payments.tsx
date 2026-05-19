import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { ReportTemplate } from "@/components/ReportTemplate";
import { formatNumber } from "@/lib/format";
import { prettyMethod } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/reports/payments")({
  head: () => ({ meta: [{ title: "Rapport des paiements reçus — Avada School" }] }),
  component: PaymentsReportPage,
});

type Period = "today" | "week" | "month" | "all";

function periodStart(p: Period): Date | null {
  const now = new Date();
  if (p === "all") return null;
  if (p === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (p === "week") {
    const d = new Date(now);
    d.setDate(now.getDate() - now.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  }
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function PaymentsReportPage() {
  const { profile, roles } = useAuth();
  const [period, setPeriod] = useState<Period>("month");

  const schoolId = profile?.primary_school_id ?? null;
  const isSuper = roles.includes("super_admin");

  const q = useQuery({
    queryKey: ["report-payments", schoolId, period, isSuper],
    queryFn: async () => {
      let pq = supabase
        .from("payments")
        .select("id, amount, currency, method, reference, paid_at, created_at, status, fee_id, student_id, school_id")
        .eq("status", "COMPLETED")
        .order("paid_at", { ascending: false })
        .limit(200);
      const start = periodStart(period);
      if (start) pq = pq.gte("paid_at", start.toISOString());
      if (!isSuper && schoolId) pq = pq.eq("school_id", schoolId);
      const { data: payments, error } = await pq;
      if (error) throw error;
      const list = payments ?? [];
      const studentIds = Array.from(new Set(list.map((p) => p.student_id).filter(Boolean))) as string[];
      const feeIds = Array.from(new Set(list.map((p) => p.fee_id).filter(Boolean))) as string[];
      const recIds = list.map((p) => p.id);
      const targetSchoolId = isSuper ? list[0]?.school_id ?? null : schoolId;

      const [studentsRes, feesRes, receiptsRes, schoolRes] = await Promise.all([
        studentIds.length
          ? supabase.from("students").select("id, first_name, last_name").in("id", studentIds)
          : Promise.resolve({ data: [] as { id: string; first_name: string; last_name: string }[] }),
        feeIds.length
          ? supabase.from("fees").select("id, label").in("id", feeIds)
          : Promise.resolve({ data: [] as { id: string; label: string }[] }),
        recIds.length
          ? supabase.from("receipts").select("payment_id, receipt_number").in("payment_id", recIds)
          : Promise.resolve({ data: [] as { payment_id: string; receipt_number: string }[] }),
        targetSchoolId
          ? supabase
              .from("schools")
              .select("name, sigle, approval_number, address, city, logo_url, email, phone")
              .eq("id", targetSchoolId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      return {
        payments: list,
        students: new Map((studentsRes.data ?? []).map((s) => [s.id, s])),
        fees: new Map((feesRes.data ?? []).map((f) => [f.id, f])),
        receipts: new Map((receiptsRes.data ?? []).map((r) => [r.payment_id, r.receipt_number])),
        school: schoolRes.data,
      };
    },
  });

  const totals = useMemo(() => {
    const acc: Record<string, number> = {};
    (q.data?.payments ?? []).forEach((p) => {
      const c = p.currency || "CDF";
      acc[c] = (acc[c] ?? 0) + Number(p.amount || 0);
    });
    return acc;
  }, [q.data]);

  if (q.isLoading) return <div className="p-10 text-center text-sm text-muted-foreground">Chargement…</div>;

  const payments = q.data?.payments ?? [];
  const school = q.data?.school;

  return (
    <div className="min-h-screen bg-neutral-100 py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-3 flex max-w-[210mm] items-center justify-between gap-3 px-4">
        <Link to="/home" className="text-sm font-semibold text-primary">← Retour</Link>
        <div className="flex gap-2 text-xs">
          {(["today", "week", "month", "all"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-full px-3 py-1.5 font-semibold ${period === p ? "bg-primary text-primary-foreground" : "bg-white text-neutral-700"}`}
            >
              {p === "today" ? "Aujourd'hui" : p === "week" ? "Cette semaine" : p === "month" ? "Ce mois" : "Tout"}
            </button>
          ))}
        </div>
      </div>

      <ReportTemplate
        school={{
          name: school?.name ?? "École",
          sigle: school?.sigle,
          approval_number: school?.approval_number,
          address: school?.address,
          city: school?.city,
          logo_url: school?.logo_url,
          email: school?.email,
          phone: school?.phone,
        }}
        title="Rapport des paiements reçus"
        info={{
          userId: profile?.full_name?.split(" ").map((n) => n[0]).join("").toUpperCase() ?? "—",
          userName: profile?.full_name?.toUpperCase() ?? "—",
          fonction: roles.includes("cashier") ? "CAISSIER(ÈRE)" : roles.includes("admin") ? "ADMINISTRATEUR" : "SUPER ADMIN",
          matricule: "—",
          classe: "—",
          section: "—",
          option: "—",
          devise: Object.keys(totals)[0] ?? "CDF",
        }}
        totals={Object.entries(totals).map(([cur, val]) => ({
          label: `Total Montant (${cur})`,
          value: `${formatNumber(val)},00`,
        }))}
        signatory={{ name: profile?.full_name ?? "Caisse", title: roles.includes("cashier") ? "Caissier(ère)" : "Responsable" }}
      >
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-neutral-100">
              <th className="border border-neutral-300 px-2 py-2 text-left">No</th>
              <th className="border border-neutral-300 px-2 py-2 text-left">ÉLÈVE</th>
              <th className="border border-neutral-300 px-2 py-2 text-left">REÇU</th>
              <th className="border border-neutral-300 px-2 py-2 text-left">DATE</th>
              <th className="border border-neutral-300 px-2 py-2 text-left">MONTANT</th>
              <th className="border border-neutral-300 px-2 py-2 text-left">RÉFÉRENCE</th>
              <th className="border border-neutral-300 px-2 py-2 text-left">MODE DE PAIEMENT</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 && (
              <tr>
                <td colSpan={7} className="border border-neutral-300 px-2 py-6 text-center text-neutral-500">
                  Aucun paiement sur cette période.
                </td>
              </tr>
            )}
            {payments.map((p, idx) => {
              const s = q.data?.students.get(p.student_id);
              const f = q.data?.fees.get(p.fee_id);
              const rn = q.data?.receipts.get(p.id);
              const date = new Date(p.paid_at ?? p.created_at);
              return (
                <tr key={p.id}>
                  <td className="border border-neutral-300 px-2 py-2">{String(idx + 1).padStart(2, "0")}</td>
                  <td className="border border-neutral-300 px-2 py-2">{s ? `${s.first_name} ${s.last_name}`.toUpperCase() : "—"}</td>
                  <td className="border border-neutral-300 px-2 py-2">{rn ?? "—"}</td>
                  <td className="border border-neutral-300 px-2 py-2">{date.toLocaleDateString("fr-FR")}</td>
                  <td className="border border-neutral-300 px-2 py-2">
                    {formatNumber(Number(p.amount))},00 {p.currency}
                  </td>
                  <td className="border border-neutral-300 px-2 py-2">{p.reference ?? "—"}</td>
                  <td className="border border-neutral-300 px-2 py-2 uppercase">
                    {prettyMethod(p.method)}
                    {f?.label ? <span className="block text-[10px] text-neutral-500 normal-case">{f.label}</span> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ReportTemplate>
    </div>
  );
}
