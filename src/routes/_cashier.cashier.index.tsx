import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  LuBell as Bell,
  LuUser as User,
  LuUsers as Users,
  LuSearch as Search,
  LuPlus as Plus,
  LuWallet as Wallet,
  LuCreditCard as CreditCard,
  LuSmartphone as Smartphone,
  LuTrendingUp as TrendingUp,
  LuMaximize as Maximize,
  LuMoon as Moon,
  LuGlobe as Globe,
  LuMail as Mail,
  LuSlidersHorizontal as Sliders,
  LuCircleCheck as CheckCircle,
} from "react-icons/lu";
import { CashierShell } from "@/components/CashierShell";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { formatNumber, prettyMethod } from "@/lib/format";
import { cn } from "@/lib/utils";

interface CashierDash {
  schoolId: string;
  today: { total: number; transactionsCount: number; currency: string };
  month: { total: number };
  pending: { total: number; count: number };
  overview: { studentsCount: number; classesCount: number; feesTotal: number; completionRate: number };
  lastPayments: Array<{
    id: string; amount: number; currency: string; method: string;
    status: string; reference: string | null; paid_at: string | null;
    student_id: string; fee_id: string;
  }>;
}

interface School { id: string; name: string; city: string | null; }
interface StudentMini { id: string; first_name: string; last_name: string; class?: { name?: string } | null; }
interface FeeMini { id: string; label: string; }

export const Route = createFileRoute("/_cashier/cashier/")({
  head: () => ({
    meta: [
      { title: "Tableau de bord Caissier — Avada School" },
      { name: "description", content: "Tableau de bord moderne du caissier : encaissements, élèves, frais." },
    ],
  }),
  component: CashierHome,
});

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

function CashierHome() {
  const { profile, roles } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (roles.length && !roles.some((r) => r === "cashier" || r === "admin" || r === "super_admin")) {
      navigate({ to: "/home", replace: true });
    }
  }, [roles, navigate]);

  const schoolId = profile?.primary_school_id ?? null;

  const schoolQ = useQuery({
    enabled: !!schoolId,
    queryKey: ["school", schoolId],
    queryFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.from("schools").select("id,name,city").eq("id", schoolId!).maybeSingle();
      return data as School | null;
    },
  });

  const dashQ = useQuery({
    enabled: !!schoolId,
    queryKey: ["cashier-dashboard", schoolId],
    queryFn: () => apiFetch<CashierDash>(`/cashier-dashboard/${schoolId}`),
  });

  const notifSummary = useQuery({
    queryKey: ["notifications-dashboard"],
    queryFn: () => apiFetch<{ unread_count: number }>("/notifications/dashboard"),
  });

  const studentsQ = useQuery({
    enabled: !!schoolId,
    queryKey: ["students-mini", schoolId],
    queryFn: () => apiFetch<{ items: StudentMini[] }>(`/students?schoolId=${schoolId}&limit=200`),
  });

  const feesQ = useQuery({
    enabled: !!schoolId,
    queryKey: ["fees-mini", schoolId],
    queryFn: () => apiFetch<{ items: FeeMini[] }>(`/fees?limit=200`),
  });

  const studentsById = useMemo(
    () => new Map((studentsQ.data?.items ?? []).map((s) => [s.id, s])),
    [studentsQ.data],
  );
  const feesById = useMemo(
    () => new Map((feesQ.data?.items ?? []).map((f) => [f.id, f])),
    [feesQ.data],
  );

  if (!schoolId) {
    return (
      <CashierShell>
        <div className="px-5 pt-10 text-center text-sm text-muted-foreground">
          Aucune école assignée à votre compte.
        </div>
      </CashierShell>
    );
  }

  const dash = dashQ.data;
  const todayTotal = dash?.today.total ?? 0;
  const todayCount = dash?.today.transactionsCount ?? 0;
  const monthTotal = dash?.month.total ?? 0;
  const feesTotal = dash?.overview.feesTotal ?? 0;
  const studentsCount = dash?.overview.studentsCount ?? 0;
  const currency = dash?.today.currency ?? "CDF";

  const filteredPayments = (dash?.lastPayments ?? []).filter((p) => {
    if (!search.trim()) return true;
    const s = studentsById.get(p.student_id);
    const f = feesById.get(p.fee_id);
    const hay = `${s?.first_name ?? ""} ${s?.last_name ?? ""} ${f?.label ?? ""} ${p.reference ?? ""}`.toLowerCase();
    return hay.includes(search.toLowerCase());
  });

  return (
    <CashierShell>
      {/* TOP BAR — style CV/Job */}
      <header className="sticky top-0 z-20 border-b border-border/60 bg-card/90 px-4 py-3 backdrop-blur lg:px-8">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-extrabold text-foreground">
              {greeting()}, <span className="text-primary">{profile?.full_name?.split(" ")[0] ?? "Caissier"}</span>
            </p>
            <p className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Bell className="h-3 w-3" />
              {dash?.pending.count ?? 0} paiement{(dash?.pending.count ?? 0) > 1 ? "s" : ""} en attente · {todayCount} aujourd'hui
            </p>
          </div>

          <div className="hidden flex-1 max-w-sm md:block">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher..."
                className="w-full rounded-full border border-border/60 bg-muted/40 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-primary/40 focus:bg-card"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <IconBtn label="Plein écran"><Maximize className="h-4 w-4" /></IconBtn>
            <IconBtn label="Thème"><Moon className="h-4 w-4" /></IconBtn>
            <IconBtn label="Langue"><Globe className="h-4 w-4" /></IconBtn>
            <IconBtn label="Messages" badge={3}><Mail className="h-4 w-4" /></IconBtn>
            <IconBtn label="Notifications" badge={notifSummary.data?.unread_count ?? 0}><Bell className="h-4 w-4" /></IconBtn>

            <Link
              to={"/cashier/profile" as "/cashier"}
              className="ml-2 hidden items-center gap-2 rounded-full border border-border/60 bg-muted/40 py-1 pl-1 pr-3 transition hover:bg-card sm:flex"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--gradient-primary)] text-xs font-black text-primary-foreground">
                {(profile?.full_name ?? "C").slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden flex-col leading-tight md:flex">
                <span className="text-xs font-extrabold">{profile?.full_name ?? "Caissier"}</span>
                <span className="text-[10px] text-muted-foreground">{schoolQ.data?.name ?? "Avada School"}</span>
              </span>
            </Link>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 lg:px-8">
        {/* TITRE */}
        <div className="mb-5 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            Tableau de bord Caissier
          </h1>
        </div>

        {/* STATS + CTA */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Encaissements aujourd'hui"
            value={formatNumber(todayTotal)}
            unit={currency}
            delta="+21%"
            deltaTone="positive"
            sub="sur les 7 derniers jours"
            icon={<Wallet className="h-5 w-5" />}
            iconBg="bg-[var(--gradient-primary)] text-primary-foreground"
            spark={<Sparkline variant="bars" tone="primary" />}
          />
          <StatCard
            label="Total encaissé ce mois"
            value={formatNumber(monthTotal)}
            unit={currency}
            delta="+15%"
            deltaTone="positive"
            sub="sur les 7 derniers jours"
            icon={<TrendingUp className="h-5 w-5" />}
            iconBg="bg-tint-peach text-tint-peach-foreground"
            spark={<Sparkline variant="line" tone="peach" />}
          />
          <StatCard
            label="Élèves actifs"
            value={String(studentsCount)}
            unit={`/ ${formatNumber(feesTotal)} ${currency}`}
            delta="+8%"
            deltaTone="positive"
            sub="sur les 7 derniers jours"
            icon={<Users className="h-5 w-5" />}
            iconBg="bg-tint-sky text-tint-sky-foreground"
            spark={<Sparkline variant="line" tone="primary" />}
          />

          {/* CTA button — petit, icône uniquement */}
          <div className="flex items-center justify-center">
            <Link
              to={"/cashier/collections" as "/cashier"}
              aria-label="Nouvel encaissement"
              title="Nouvel encaissement"
              style={{ backgroundImage: "var(--gradient-primary)" }}
              className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-white shadow-[var(--shadow-elevated)] transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <Plus className="h-7 w-7" strokeWidth={2.75} />
            </Link>
          </div>
        </section>

        {/* TABLEAU */}
        <section className="mt-6 overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[var(--shadow-card)]">
          <div className="flex flex-col gap-3 border-b border-border/60 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-black tracking-tight">Derniers encaissements</h2>
              <p className="text-[11px] text-muted-foreground">Activité récente confirmée</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher (élève, frais...)"
                  className="w-full rounded-full border border-border/60 bg-muted/40 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-primary/40 focus:bg-card sm:w-72"
                />
              </div>
              <button className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-2 text-xs font-semibold transition hover:border-primary/40 hover:text-primary">
                <Sliders className="h-3.5 w-3.5" /> Filtres
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30 text-left text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3">Réf</th>
                  <th className="px-5 py-3">Élève</th>
                  <th className="px-5 py-3">Frais</th>
                  <th className="px-5 py-3">Méthode</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3 text-right">Montant</th>
                  <th className="px-5 py-3">Statut</th>
                </tr>
              </thead>
              <tbody>
                {dashQ.isLoading && [0, 1, 2, 3].map((i) => (
                  <tr key={i} className="border-b border-border/40">
                    <td colSpan={7} className="px-5 py-3">
                      <div className="h-10 animate-pulse rounded-xl bg-muted/60" />
                    </td>
                  </tr>
                ))}

                {!dashQ.isLoading && filteredPayments.slice(0, 8).map((p) => {
                  const student = studentsById.get(p.student_id);
                  const fee = feesById.get(p.fee_id);
                  const date = new Date(p.paid_at ?? Date.now());
                  const method = prettyMethod(p.method);
                  const isCard = method.toLowerCase().includes("carte");
                  const initials = `${student?.first_name?.[0] ?? "?"}${student?.last_name?.[0] ?? ""}`.toUpperCase();
                  return (
                    <tr key={p.id} className="border-b border-border/40 transition hover:bg-muted/30">
                      <td className="px-5 py-3 font-mono text-[11px] text-muted-foreground">
                        {(p.reference ?? p.id).slice(0, 8)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-[10px] font-black text-primary">
                            {initials}
                          </span>
                          <div className="leading-tight">
                            <p className="text-sm font-extrabold">
                              {student ? `${student.first_name} ${student.last_name}` : "Élève"}
                            </p>
                            <p className="text-[10px] text-muted-foreground">{student?.class?.name ?? "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-foreground/80">{fee?.label ?? "—"}</td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold">
                          {isCard ? <CreditCard className="h-3 w-3" /> : <Smartphone className="h-3 w-3" />}
                          {method}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[11px] text-muted-foreground">
                        {date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-5 py-3 text-right text-sm font-extrabold text-primary">
                        +{formatNumber(Number(p.amount))} {p.currency}
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                          <CheckCircle className="h-2.5 w-2.5" /> Confirmé
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {!dashQ.isLoading && filteredPayments.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-sm text-muted-foreground">
                      Aucun encaissement trouvé.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* INDICATEURS DÉTAILLÉS */}
        <section className="mt-6">
          <h2 className="mb-3 flex items-center gap-2 text-base font-black tracking-tight">
            <Sliders className="h-4 w-4 text-primary" /> Indicateurs détaillés
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <MiniKpi label="Élèves actifs" value={String(studentsCount)} hint="Effectif suivi" />
            <MiniKpi label="Frais émis" value={`${formatNumber(feesTotal)} ${currency}`} hint="Cumul école" />
            <MiniKpi label="En attente" value={String(dash?.pending.count ?? 0)} hint={`${formatNumber(dash?.pending.total ?? 0)} ${currency}`} />
            <MiniKpi label="Taux complétion" value={`${dash?.overview.completionRate ?? 0}%`} hint="Mois en cours" />
          </div>
        </section>

        {/* RAPPORTS */}
        <section className="mt-6">
          <h2 className="mb-3 flex items-center gap-2 text-base font-black tracking-tight">
            <Sliders className="h-4 w-4 text-primary" /> Rapports
          </h2>
          <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-[var(--shadow-card)]">
            <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">
              Année scolaire (par classe / par type de frais)
            </label>
            <div className="rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 text-sm font-bold">
              2025-2026
            </div>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
              <Link
                to={"/reports/payments" as "/cashier"}
                style={{ backgroundImage: "var(--gradient-primary)" }}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-bold text-white shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-md"
              >
                Paiements reçus
              </Link>
              <Link
                to={"/reports/payments" as "/cashier"}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-info py-3 text-sm font-bold text-white shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-md"
              >
                Par classe
              </Link>
              <Link
                to={"/reports/payments" as "/cashier"}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-violet py-3 text-sm font-bold text-white shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-md"
              >
                Par type de frais
              </Link>
            </div>
          </div>
        </section>
      </main>
    </CashierShell>
  );
}

function MiniKpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-3xl border border-border/60 bg-card p-4 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-md">
      <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-black leading-none tracking-tight text-foreground">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function IconBtn({
  children, label, badge,
}: { children: React.ReactNode; label: string; badge?: number }) {
  return (
    <button
      aria-label={label}
      className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-muted/40 text-foreground/70 transition hover:border-primary/40 hover:text-primary"
    >
      {children}
      {badge !== undefined && badge > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-black text-primary-foreground">
          {badge}
        </span>
      )}
    </button>
  );
}

function StatCard({
  label, value, unit, delta, deltaTone, sub, icon, iconBg, spark,
}: {
  label: string; value: string; unit: string;
  delta: string; deltaTone: "positive" | "negative"; sub: string;
  icon: React.ReactNode; iconBg: string; spark: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between">
        <span className={cn("flex h-12 w-12 items-center justify-center rounded-2xl", iconBg)}>
          {icon}
        </span>
        <span className={cn(
          "rounded-full px-2.5 py-1 text-[10px] font-black",
          deltaTone === "positive" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
        )}>
          {delta}
        </span>
      </div>

      <p className="mt-4 text-[11px] font-semibold text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-black leading-none tracking-tight text-foreground">
        {value}
        <span className="ml-1 text-xs font-bold text-muted-foreground">{unit}</span>
      </p>
      <p className="mt-2 text-[11px] text-muted-foreground">{sub}</p>

      <div className="mt-3 h-10 w-full">{spark}</div>
    </div>
  );
}

function Sparkline({ variant, tone }: { variant: "line" | "bars"; tone: "primary" | "peach" }) {
  const stroke = tone === "primary" ? "var(--primary)" : "var(--tint-peach-foreground)";
  const fill = tone === "primary" ? "var(--primary)" : "var(--tint-peach-foreground)";
  if (variant === "bars") {
    const heights = [40, 65, 35, 80, 50, 95, 60];
    return (
      <svg viewBox="0 0 140 40" className="h-full w-full" preserveAspectRatio="none">
        {heights.map((h, i) => (
          <rect
            key={i}
            x={i * 20 + 4}
            y={40 - (h * 0.36)}
            width={12}
            height={h * 0.36}
            rx={3}
            fill={fill}
            opacity={i === 5 ? 1 : 0.55}
          />
        ))}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 140 40" className="h-full w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`g-${tone}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={0.3} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path
        d="M0,28 C15,22 25,30 40,18 C55,8 70,22 85,16 C100,10 115,20 140,8 L140,40 L0,40 Z"
        fill={`url(#g-${tone})`}
      />
      <path
        d="M0,28 C15,22 25,30 40,18 C55,8 70,22 85,16 C100,10 115,20 140,8"
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}
