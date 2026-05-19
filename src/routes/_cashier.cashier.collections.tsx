import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  LuRefreshCw as RefreshCw,
  LuChevronDown as ChevronDown,
  LuChevronRight as ChevronRight,
  LuCreditCard as CreditCard,
  LuSmartphone as Smartphone,
  LuUser as User,
  LuX as X,
  LuWallet as Wallet,
  LuTrendingUp as TrendingUp,
  LuClock as Clock,
} from "react-icons/lu";
import { CashierShell } from "@/components/CashierShell";
import { CashierTopBar, PageTitle } from "@/components/CashierTopBar";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatNumber, initials, prettyMethod } from "@/lib/format";
import { cn } from "@/lib/utils";


type Period = "today" | "week" | "month";
type Currency = "CDF" | "USD";

interface CashierDash {
  today: { total: number; transactionsCount: number; currency: string };
  month: { total: number };
  pending: { total: number; count: number };
  overview: { feesTotal: number };
  lastPayments: Array<{
    id: string; amount: number; currency: string; method: string;
    status: string; paid_at: string | null; created_at?: string;
    student_id: string; fee_id: string; reference: string | null;
  }>;
}

interface FeeRow {
  id: string; label: string; amount: number; currency: string;
  student_id: string | null; class_id: string | null;
  paid: number; remaining: number; due_date: string | null;
  fee_type: string;
}
interface StudentMini { id: string; first_name: string; last_name: string; photo_url?: string | null; class?: { name?: string } | null; }
interface FeeMini { id: string; label: string; }

export const Route = createFileRoute("/_cashier/cashier/collections")({
  head: () => ({ meta: [{ title: "Encaissements — Caisse" }] }),
  component: CashierCollections,
});

function CashierCollections() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const schoolId = profile?.primary_school_id ?? null;

  const [period, setPeriod] = useState<Period>("week");
  const [currency, setCurrency] = useState<Currency>("CDF");
  const [showCurrencySheet, setShowCurrencySheet] = useState(false);
  const [showPeriodSheet, setShowPeriodSheet] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const dashQ = useQuery({
    enabled: !!schoolId,
    queryKey: ["cashier-dashboard", schoolId],
    queryFn: () => apiFetch<CashierDash>(`/cashier-dashboard/${schoolId}`),
  });

  const feesQ = useQuery({
    enabled: !!schoolId,
    queryKey: ["fees-school", schoolId],
    queryFn: () => apiFetch<{ items: FeeRow[] }>(`/fees/by-school/${schoolId}`),
  });

  const studentsQ = useQuery({
    enabled: !!schoolId,
    queryKey: ["students-mini", schoolId],
    queryFn: () => apiFetch<{ items: StudentMini[] }>(`/students?schoolId=${schoolId}&limit=200`),
  });

  const feesMiniQ = useQuery({
    enabled: !!schoolId,
    queryKey: ["fees-mini-list", schoolId],
    queryFn: () => apiFetch<{ items: FeeMini[] }>(`/fees?limit=200`),
  });

  const studentsById = useMemo(
    () => new Map((studentsQ.data?.items ?? []).map((s) => [s.id, s])),
    [studentsQ.data],
  );
  const feesById = useMemo(
    () => new Map((feesMiniQ.data?.items ?? []).map((f) => [f.id, f])),
    [feesMiniQ.data],
  );

  const dash = dashQ.data;
  const toCollect = dash?.pending.total ?? 0;
  const collected = period === "today" ? (dash?.today.total ?? 0) : (dash?.month.total ?? 0);

  const periodLabels: Record<Period, string> = {
    today: "Aujourd'hui",
    week: "Cette semaine",
    month: "Ce mois",
  };

  const feesToCollect = (feesQ.data?.items ?? []).filter((f) => f.remaining > 0).slice(0, 8);
  const detail = detailId ? (dash?.lastPayments ?? []).find((p) => p.id === detailId) : null;

  return (
    <CashierShell>
      <CashierTopBar
        notifBadge={dash?.pending.count}
        subtitle={
          <>
            <Wallet className="h-3 w-3" />
            {dash?.pending.count ?? 0} en attente · {dash?.today.transactionsCount ?? 0} aujourd'hui
          </>
        }
      />

      <main className="px-4 py-6 lg:px-8">
        <PageTitle
          title="Encaissements"
          description="Suivi des paiements et frais à encaisser"
          action={
            <button
              onClick={() => { dashQ.refetch(); feesQ.refetch(); }}
              className="inline-flex h-10 items-center gap-2 rounded-2xl border border-border/60 bg-card px-3 text-xs font-extrabold text-foreground transition hover:border-primary/40 hover:text-primary"
              aria-label="Rafraîchir"
            >
              <RefreshCw className="h-4 w-4" /> Actualiser
            </button>
          }
        />

        {/* Filtres */}
        <section className="mb-5 flex flex-wrap gap-2">
          <button
            onClick={() => setShowPeriodSheet(true)}
            className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-4 py-2 text-xs font-extrabold transition hover:border-primary/40 hover:text-primary"
          >
            <Clock className="h-3.5 w-3.5" />
            {periodLabels[period]}
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </button>
          <button
            onClick={() => setShowCurrencySheet(true)}
            className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-4 py-2 text-xs font-extrabold transition hover:border-primary/40 hover:text-primary"
          >
            {currency}
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </button>
        </section>

        {/* Stats */}
        <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard
            label="À encaisser"
            value={formatNumber(toCollect)}
            unit={currency}
            sub={`${dash?.pending.count ?? 0} en attente`}
            Icon={Clock}
            bar="bg-tint-peach"
            tint="bg-tint-peach text-tint-peach-foreground"
          />
          <StatCard
            label="Déjà encaissé"
            value={formatNumber(collected)}
            unit={currency}
            sub={periodLabels[period]}
            Icon={TrendingUp}
            bar="bg-primary"
            tint="bg-primary/10 text-primary"
          />
          <StatCard
            label="Aujourd'hui"
            value={formatNumber(dash?.today.total ?? 0)}
            unit={dash?.today.currency ?? currency}
            sub={`${dash?.today.transactionsCount ?? 0} transaction${(dash?.today.transactionsCount ?? 0) > 1 ? "s" : ""}`}
            Icon={Wallet}
            bar="bg-tint-sky"
            tint="bg-tint-sky text-tint-sky-foreground"
          />
        </section>

      {/* Frais à encaisser */}
      <section className="mt-2">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-extrabold tracking-tight">Frais à encaisser</h2>
          <button className="inline-flex items-center gap-0.5 text-sm font-extrabold text-primary hover:underline">
            Voir plus <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 scrollbar-hide">
          {feesToCollect.map((f) => {
            const student = f.student_id ? studentsById.get(f.student_id) : null;
            return (
              <div
                key={f.id}
                className="min-w-[260px] rounded-2xl border-2 border-primary/60 bg-card p-3 shadow-[var(--shadow-card)]"
              >
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={student?.photo_url ?? undefined} />
                    <AvatarFallback className="bg-tint-peach text-tint-peach-foreground text-xs font-bold">
                      {student ? initials(`${student.first_name} ${student.last_name}`) : "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-extrabold">
                      {student ? `${student.first_name} ${student.last_name}` : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">📅 {student?.class?.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">🏷️ {f.label}</p>
                    <p className="mt-1 text-sm font-extrabold text-primary">
                      Reste : {formatNumber(f.remaining)} {f.currency}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-primary" />
                </div>
              </div>
            );
          })}
          {feesToCollect.length === 0 && (
            <p className="text-sm text-muted-foreground">Tous les frais sont à jour.</p>
          )}
        </div>
      </section>

      {/* Derniers encaissements */}
      <section className="pt-6 pb-2">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-extrabold">Derniers encaissements</h2>
          <button
            onClick={() => navigate({ to: "/reports/payments" as "/cashier" })}
            className="text-sm font-extrabold text-primary inline-flex items-center gap-0.5"
          >
            Rapport <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">
          {(dash?.lastPayments ?? []).map((p) => {
            const student = studentsById.get(p.student_id);
            const fee = feesById.get(p.fee_id);
            const date = new Date(p.paid_at ?? Date.now());
            const dateStr = `${date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}, ${date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
            const method = prettyMethod(p.method);
            const isCard = method.toLowerCase().includes("carte");
            return (
              <button
                key={p.id}
                onClick={() => setDetailId(p.id)}
                className="w-full rounded-2xl bg-card p-4 text-left shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-extrabold">{formatNumber(Number(p.amount))} {p.currency}</p>
                    <p className="text-sm text-foreground/80">{fee?.label ?? "Frais"}</p>
                    <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{student ? `${student.first_name} ${student.last_name}` : "—"}</span>
                      <span>·</span>
                      <span>{student?.class?.name ?? ""}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      {isCard ? <CreditCard className="h-3 w-3" /> : <Smartphone className="h-3 w-3" />}
                      {method}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{dateStr}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>
      </main>

      {/* Bottom sheet — currency */}
      {showCurrencySheet && (
        <Sheet onClose={() => setShowCurrencySheet(false)} title="DEVISE">
          {(["CDF", "USD"] as Currency[]).map((c) => (
            <button
              key={c}
              onClick={() => { setCurrency(c); setShowCurrencySheet(false); }}
              className={cn(
                "flex w-full items-center justify-between rounded-2xl px-4 py-4 text-base font-semibold",
                currency === c ? "bg-accent text-primary" : "text-foreground hover:bg-accent/40",
              )}
            >
              <span>{c === "USD" ? "USD, $" : "CDF"}</span>
              {currency === c && <span className="text-primary">✓</span>}
            </button>
          ))}
        </Sheet>
      )}

      {/* Bottom sheet — period */}
      {showPeriodSheet && (
        <Sheet onClose={() => setShowPeriodSheet(false)} title="PÉRIODE">
          {(Object.keys(periodLabels) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => { setPeriod(p); setShowPeriodSheet(false); }}
              className={cn(
                "flex w-full items-center justify-between rounded-2xl px-4 py-4 text-base font-semibold",
                period === p ? "bg-accent text-primary" : "text-foreground hover:bg-accent/40",
              )}
            >
              <span>{periodLabels[p]}</span>
              {period === p && <span className="text-primary">✓</span>}
            </button>
          ))}
        </Sheet>
      )}

      {/* Detail sheet */}
      {detail && (
        <PaymentDetailSheet
          payment={detail}
          student={studentsById.get(detail.student_id)}
          fee={feesById.get(detail.fee_id)}
          onClose={() => setDetailId(null)}
        />
      )}
    </CashierShell>
  );
}

function Sheet({ children, title, onClose }: { children: React.ReactNode; title: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-foreground/40">
      <div className="w-full max-w-[480px] rounded-t-[2rem] bg-card p-5 pb-8 shadow-[var(--shadow-elevated)]">
        <div className="mx-auto h-1 w-10 rounded-full bg-border" />
        <p className="mt-4 mb-2 text-xs font-bold tracking-widest text-muted-foreground">{title}</p>
        <div className="space-y-1">{children}</div>
        <button onClick={onClose} className="mt-4 w-full rounded-2xl bg-secondary py-3 text-sm font-semibold text-foreground">
          Fermer
        </button>
      </div>
    </div>
  );
}

function PaymentDetailSheet({
  payment, student, fee, onClose,
}: {
  payment: CashierDash["lastPayments"][number];
  student?: StudentMini;
  fee?: FeeMini;
  onClose: () => void;
}) {
  const date = new Date(payment.paid_at ?? Date.now());
  const dateStr = `${date.toLocaleDateString("fr-FR")}, ${date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-foreground/40 overflow-y-auto py-6">
      <div className="w-full max-w-[480px] rounded-t-[2rem] bg-background p-5 pb-8 shadow-[var(--shadow-elevated)]">
        <div className="flex items-center justify-between">
          <div className="mx-auto h-1 w-10 rounded-full bg-border" />
          <button onClick={onClose} className="absolute right-6 mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-card shadow-[var(--shadow-card)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 flex items-center gap-3 rounded-3xl bg-card p-4 shadow-[var(--shadow-card)]">
          <Avatar className="h-14 w-14">
            <AvatarImage src={student?.photo_url ?? undefined} />
            <AvatarFallback className="bg-tint-peach text-tint-peach-foreground text-base font-bold">
              {student ? initials(`${student.first_name} ${student.last_name}`) : "?"}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-xs font-bold text-primary">FICHE PAIEMENT</p>
            <p className="text-lg font-extrabold">{student ? `${student.first_name} ${student.last_name}` : "—"}</p>
            <p className="text-sm text-muted-foreground">{student?.class?.name ?? ""}</p>
          </div>
        </div>

        <div className="mt-4 rounded-3xl bg-card p-4 shadow-[var(--shadow-card)]">
          <p className="text-base font-extrabold">Informations du paiement</p>
          <div className="mt-3 divide-y divide-border">
            <DetailRow label="Type de frais" value={fee?.label ?? "—"} />
            <DetailRow label="Montant payé" value={`${formatNumber(Number(payment.amount))} ${payment.currency}`} highlight />
            <DetailRow label="Méthode" value={prettyMethod(payment.method)} />
            <DetailRow label="Date" value={dateStr} />
            <DetailRow
              label="Statut"
              value={
                <span className="inline-flex rounded-full bg-tint-mint px-3 py-0.5 text-xs font-semibold text-tint-mint-foreground">
                  {payment.status === "COMPLETED" ? "Complété" : payment.status}
                </span>
              }
            />
            <DetailRow label="ID paiement" value={payment.reference ?? payment.id.slice(0, 12)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("text-sm font-semibold", highlight && "text-primary font-extrabold")}>{value}</p>
    </div>
  );
}

function StatCard({
  label, value, unit, sub, Icon, bar, tint,
}: {
  label: string; value: string; unit: string; sub: string;
  Icon: typeof Wallet; bar: string; tint: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-md">
      <span className={cn("absolute left-0 top-0 h-full w-1.5", bar)} />
      <div className="flex items-start justify-between">
        <span className={cn("flex h-12 w-12 items-center justify-center rounded-2xl", tint)}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-4 text-[11px] font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-black leading-none tracking-tight text-foreground">
        {value}
        <span className="ml-1 text-xs font-bold text-muted-foreground">{unit}</span>
      </p>
      <p className="mt-2 text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}
