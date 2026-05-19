import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { LuArrowLeft as ArrowLeft, LuReceipt as Receipt, LuClock as Clock, LuCircleCheck as CheckCircle, LuCircleX as XCircle, LuSearch as Search } from "react-icons/lu";
import { ParentShell } from "@/components/ParentShell";
import { apiFetch } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { formatNumber, prettyMethod } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/transactions")({
  head: () => ({
    meta: [
      { title: "Historique des transactions — Avada School" },
      { name: "description", content: "Historique de tous vos paiements scolaires." },
    ],
  }),
  component: TransactionsPage,
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
  fee_id?: string;
}
interface Student {
  id: string;
  first_name: string;
  last_name: string;
}

type StatusFilter = "all" | "completed" | "pending" | "failed";

function TransactionsPage() {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  const payments = useQuery({
    queryKey: ["payments-history"],
    queryFn: () =>
      apiFetch<{ items: PaymentRow[] }>("/payments?limit=200&sort=-created_at"),
  });
  const students = useQuery({
    queryKey: ["students-by-parent"],
    queryFn: () => apiFetch<{ items: Student[] }>("/students-by-parent"),
  });

  const paymentIds = useMemo(
    () => (payments.data?.items ?? []).map((p) => p.id),
    [payments.data],
  );
  const receipts = useQuery({
    queryKey: ["receipts-for-payments", paymentIds.join(",")],
    enabled: paymentIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receipts")
        .select("id, payment_id")
        .in("payment_id", paymentIds);
      if (error) throw error;
      const map = new Map<string, string>();
      (data ?? []).forEach((r) => map.set(r.payment_id, r.id));
      return map;
    },
  });

  const studentById = useMemo(() => {
    const m = new Map<string, Student>();
    (students.data?.items ?? []).forEach((s) => m.set(s.id, s));
    return m;
  }, [students.data]);

  const allItems = payments.data?.items ?? [];
  const filtered = useMemo(() => {
    return allItems.filter((p) => {
      const st = (p.status || "").toUpperCase();
      if (status === "completed" && st !== "COMPLETED") return false;
      if (status === "pending" && st !== "PENDING" && st !== "INITIATED") return false;
      if (status === "failed" && st !== "FAILED" && st !== "CANCELED") return false;
      if (search.trim()) {
        const s = studentById.get(p.student_id ?? "");
        const name = s ? `${s.first_name} ${s.last_name}` : "";
        const hay = `${name} ${p.reference ?? ""} ${p.method ?? ""}`.toLowerCase();
        if (!hay.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [allItems, status, search, studentById]);

  const totals = useMemo(() => {
    const completed = allItems.filter((p) => p.status?.toUpperCase() === "COMPLETED");
    const pending = allItems.filter((p) => ["PENDING", "INITIATED"].includes(p.status?.toUpperCase() ?? ""));
    const total = completed.reduce((s, p) => s + Number(p.amount || 0), 0);
    return {
      total,
      completedCount: completed.length,
      pendingCount: pending.length,
      allCount: allItems.length,
    };
  }, [allItems]);

  return (
    <ParentShell>
      <header className="rounded-b-[2rem] bg-[image:var(--gradient-primary)] px-5 pt-8 pb-8 text-primary-foreground">
        <div className="flex items-center gap-3">
          <Link
            to="/home"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15"
            aria-label="Retour"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold">Historique des transactions</h1>
            <p className="text-xs text-white/85">
              {totals.allCount} opération{totals.allCount > 1 ? "s" : ""} au total
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl bg-white/15 p-4 backdrop-blur-sm">
          <p className="text-xs uppercase tracking-wide text-white/75">Total payé</p>
          <p className="mt-1 text-3xl font-extrabold leading-none">
            {formatNumber(totals.total)} CDF
          </p>
          <div className="mt-3 flex items-center gap-4 text-xs">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5" /> {totals.completedCount} confirmé
              {totals.completedCount > 1 ? "s" : ""}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> {totals.pendingCount} en attente
            </span>
          </div>
        </div>
      </header>

      <section className="px-5 pt-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (enfant, référence, moyen)…"
            className="h-11 rounded-2xl bg-card pl-9 shadow-[var(--shadow-card)]"
          />
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {([
            { k: "all", l: "Toutes" },
            { k: "completed", l: "Confirmées" },
            { k: "pending", l: "En attente" },
            { k: "failed", l: "Échouées" },
          ] as { k: StatusFilter; l: string }[]).map((f) => (
            <button
              key={f.k}
              type="button"
              onClick={() => setStatus(f.k)}
              className={cn(
                "shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-colors",
                status === f.k
                  ? "bg-primary text-primary-foreground shadow-[var(--shadow-card)]"
                  : "bg-card text-muted-foreground shadow-[var(--shadow-card)]",
              )}
            >
              {f.l}
            </button>
          ))}
        </div>
      </section>

      <section className="px-5 pt-4 pb-6">
        {payments.isLoading && (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        )}
        {!payments.isLoading && filtered.length === 0 && (
          <p className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground shadow-[var(--shadow-card)]">
            Aucune transaction pour ces critères.
          </p>
        )}
        <div className="space-y-3">
          {filtered.map((p) => {
            const st = (p.status || "").toUpperCase();
            const isCompleted = st === "COMPLETED";
            const isPending = st === "PENDING" || st === "INITIATED";
            const isFailed = st === "FAILED" || st === "CANCELED";
            const s = studentById.get(p.student_id ?? "");
            const studentName = s ? `${s.first_name} ${s.last_name}` : "Paiement";
            const date = new Date(p.paid_at ?? p.created_at);
            const dateStr = `${date.toLocaleDateString("fr-FR")} · ${date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;

            const Row = (
              <div className="flex items-start gap-3 rounded-2xl bg-card p-4 shadow-[var(--shadow-card)] transition-colors hover:bg-accent/30">
                <span
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                    isCompleted && "bg-tint-mint text-tint-mint-foreground",
                    isPending && "bg-secondary text-muted-foreground",
                    isFailed && "bg-destructive/10 text-destructive",
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : isFailed ? (
                    <XCircle className="h-5 w-5" />
                  ) : (
                    <Clock className="h-5 w-5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold">{studentName}</p>
                  <p className="text-xs text-muted-foreground">{dateStr}</p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {prettyMethod(p.method)}
                    {p.reference ? ` · Réf ${p.reference}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-extrabold text-primary">
                    {formatNumber(Number(p.amount || 0))} {p.currency}
                  </p>
                  <span
                    className={cn(
                      "mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                      isCompleted && "bg-tint-mint text-tint-mint-foreground",
                      isPending && "bg-secondary text-muted-foreground",
                      isFailed && "bg-destructive/10 text-destructive",
                    )}
                  >
                    {isCompleted ? "Confirmé" : isPending ? "En attente" : isFailed ? "Échoué" : p.status}
                  </span>
                  {isCompleted && (
                    <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-primary">
                      <Receipt className="h-2.5 w-2.5" /> Voir le reçu
                    </p>
                  )}
                </div>
              </div>
            );

            return isCompleted ? (
              receipts.data?.get(p.id) ? (
                <Link
                  key={p.id}
                  to="/receipts/$id"
                  params={{ id: receipts.data.get(p.id)! }}
                >
                  {Row}
                </Link>
              ) : (
                <div key={p.id}>{Row}</div>
              )
            ) : (
              <div key={p.id}>{Row}</div>
            );
          })}
        </div>
      </section>
    </ParentShell>
  );
}