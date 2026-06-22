import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { LuArrowLeft as ArrowLeft, LuReceipt as Receipt, LuDownload as Download, LuSearch as Search } from "react-icons/lu";
import { ParentShell } from "@/components/ParentShell";
import { apiFetch } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { formatNumber, prettyMethod } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { downloadReceiptPdf } from "@/lib/receipt-pdf";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/receipts/")({
  head: () => ({
    meta: [
      { title: "Mes reçus — Avada School" },
      { name: "description", content: "Téléchargez tous vos reçus de paiement." },
    ],
  }),
  component: ReceiptsListPage,
});

interface PaymentRow {
  id: string;
  amount: number;
  currency: string;
  status: string;
  method: string | null;
  reference: string | null;
  paid_at: string | null;
  created_at: string;
  student_id?: string;
}
interface Student { id: string; first_name: string; last_name: string }

function ReceiptsListPage() {
  const [search, setSearch] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const payments = useQuery({
    queryKey: ["payments-completed-receipts"],
    queryFn: () => apiFetch<{ items: PaymentRow[] }>("/payments?limit=300&sort=-created_at"),
  });
  const students = useQuery({
    queryKey: ["students-by-parent"],
    queryFn: () => apiFetch<{ items: Student[] }>("/students-by-parent"),
  });

  const completed = useMemo(
    () => (payments.data?.items ?? []).filter((p) => (p.status || "").toUpperCase() === "COMPLETED"),
    [payments.data],
  );
  const paymentIds = useMemo(() => completed.map((p) => p.id), [completed]);

  const receipts = useQuery({
    queryKey: ["receipts-list", paymentIds.join(",")],
    enabled: paymentIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receipts")
        .select("id, payment_id, receipt_number")
        .in("payment_id", paymentIds);
      if (error) throw error;
      const map = new Map<string, { id: string; receipt_number: string }>();
      (data ?? []).forEach((r) => map.set(r.payment_id, { id: r.id, receipt_number: r.receipt_number }));
      return map;
    },
  });

  const studentById = useMemo(() => {
    const m = new Map<string, Student>();
    (students.data?.items ?? []).forEach((s) => m.set(s.id, s));
    return m;
  }, [students.data]);

  async function handleDownload(
    e: React.MouseEvent,
    paymentId: string,
    receiptId: string,
    receiptNumber: string,
  ) {
    e.preventDefault();
    e.stopPropagation();
    if (downloadingId) return;
    setDownloadingId(receiptId);
    try {
      const { data: payment, error: pErr } = await supabase
        .from("payments")
        .select("id, amount, currency, method, reference, paid_at, fee_id, student_id, school_id, created_at")
        .eq("id", paymentId)
        .maybeSingle();
      if (pErr || !payment) throw pErr ?? new Error("Paiement introuvable");
      const [{ data: fee }, { data: student }, { data: school }] = await Promise.all([
        supabase.from("fees").select("label, fee_type").eq("id", payment.fee_id).maybeSingle(),
        supabase.from("students").select("first_name, last_name, matricule, class_id").eq("id", payment.student_id).maybeSingle(),
        supabase.from("schools").select("name, sigle, approval_number, address, city, logo_url, email, phone").eq("id", payment.school_id).maybeSingle(),
      ]);
      const { data: cls } = student?.class_id
        ? await supabase.from("classes").select("name, level").eq("id", student.class_id).maybeSingle()
        : { data: null };
      await downloadReceiptPdf({
        school: school ?? {},
        receipt: { receipt_number: receiptNumber },
        payment: {
          amount: Number(payment.amount),
          currency: payment.currency,
          method: payment.method,
          reference: payment.reference,
          paid_at: payment.paid_at,
        },
        student: student ?? null,
        classe: cls ?? null,
        fee: fee ?? null,
        date: new Date(payment.paid_at ?? payment.created_at),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Téléchargement impossible");
    } finally {
      setDownloadingId(null);
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return completed;
    const q = search.toLowerCase();
    return completed.filter((p) => {
      const s = studentById.get(p.student_id ?? "");
      const name = s ? `${s.first_name} ${s.last_name}` : "";
      const rcpt = receipts.data?.get(p.id)?.receipt_number ?? "";
      return `${name} ${p.reference ?? ""} ${p.method ?? ""} ${rcpt}`.toLowerCase().includes(q);
    });
  }, [completed, search, studentById, receipts.data]);

  return (
    <ParentShell>
      <header className="rounded-b-[2rem] bg-[image:var(--gradient-primary)] px-5 pt-8 pb-8 text-primary-foreground">
        <div className="flex items-center gap-3">
          <Link to="/home" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15" aria-label="Retour">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold">Mes reçus</h1>
            <p className="text-xs text-white/85">
              {completed.length} reçu{completed.length > 1 ? "s" : ""} disponible{completed.length > 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </header>

      <section className="px-5 pt-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (enfant, n° reçu, référence)…"
            className="h-11 rounded-2xl bg-card pl-9 shadow-[var(--shadow-card)]"
          />
        </div>
      </section>

      <section className="px-5 pt-4 pb-6">
        {payments.isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
        {!payments.isLoading && filtered.length === 0 && (
          <p className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground shadow-[var(--shadow-card)]">
            Aucun reçu disponible pour le moment.
          </p>
        )}
        <div className="space-y-3">
          {filtered.map((p) => {
            const s = studentById.get(p.student_id ?? "");
            const studentName = s ? `${s.first_name} ${s.last_name}` : "Paiement";
            const date = new Date(p.paid_at ?? p.created_at);
            const rcpt = receipts.data?.get(p.id);
            const dateStr = `${date.toLocaleDateString("fr-FR")} · ${date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;

            const inner = (
              <div className="flex items-start gap-3 rounded-2xl bg-card p-4 shadow-[var(--shadow-card)] transition-colors hover:bg-accent/30">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-tint-mint text-tint-mint-foreground">
                  <Receipt className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold">{studentName}</p>
                  <p className="text-xs text-muted-foreground">{dateStr}</p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {rcpt ? `N° ${rcpt.receipt_number} · ` : ""}{prettyMethod(p.method)}
                    {p.reference ? ` · Réf ${p.reference}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-extrabold text-primary">
                    {formatNumber(Number(p.amount || 0))} {p.currency}
                  </p>
                  {rcpt ? (
                    <button
                      type="button"
                      onClick={(e) => handleDownload(e, p.id, rcpt.id, rcpt.receipt_number)}
                      disabled={downloadingId === rcpt.id}
                      className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary disabled:opacity-60"
                    >
                      <Download className="h-3 w-3" />
                      {downloadingId === rcpt.id ? "…" : "Télécharger"}
                    </button>
                  ) : (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      Reçu en cours
                    </span>
                  )}
                </div>
              </div>
            );

            return rcpt ? (
              <Link key={p.id} to="/receipts/$id" params={{ id: rcpt.id }}>
                {inner}
              </Link>
            ) : (
              <div key={p.id}>{inner}</div>
            );
          })}
        </div>
      </section>
    </ParentShell>
  );
}