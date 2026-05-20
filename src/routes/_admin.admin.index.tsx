import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  LuBell as Bell,
  LuSearch as Search,
  LuMaximize as Maximize,
  LuMoon as Moon,
  LuGlobe as Globe,
  LuMail as Mail,
  LuShieldCheck as ShieldCheck,
  LuGraduationCap as GraduationCap,
  LuUsers as Users,
  LuUserRoundCheck as UserRoundCheck,
  LuWallet as Wallet,
  LuClock as Clock,
  LuTrendingUp as TrendingUp,
  LuReceipt as Receipt,
  LuPlus as Plus,
  LuActivity as Activity,
  LuHeartPulse as HeartPulse,
  LuFileChartColumn as FileBarChart2,
  LuCalendar as Calendar,
  LuImage as ImageIcon,
  LuTag as Tag,
  LuRocket as Rocket,
  LuBuilding2 as Building2,
} from "react-icons/lu";
import { AdminShell } from "@/components/AdminShell";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { CreateStudentDrawer } from "@/components/CreateStudentDrawer";

interface AdminDash {
  schoolsCount: number;
  activeSchoolsCount: number;
  studentsCount: number;
  classesCount: number;
  usersCount: number;
  cashiersCount: number;
  monthTotal: number;
  completionRate: number;
  today: { total: number; transactionsCount: number };
  pending: { total: number; count: number };
}

export const Route = createFileRoute("/_admin/admin/")({
  head: () => ({
    meta: [
      { title: "Tableau de bord — Administration" },
      { name: "description", content: "Vue d'ensemble de la plateforme Avada School." },
    ],
  }),
  component: AdminHome,
});

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

function AdminHome() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { profile, roles } = useAuth();
  const isSuper = roles.includes("super_admin");
  const [search, setSearch] = useState("");
  const [createStudentOpen, setCreateStudentOpen] = useState(false);

  const handleCtaClick = async () => {
    if (!isSuper) {
      setCreateStudentOpen(true);
      return;
    }
    await navigate({ to: "/admin/collections" });
  };

  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => apiFetch<AdminDash>("/admin-dashboard"),
  });

  const monthTotal = data?.monthTotal ?? 0;
  const completionRate = data?.completionRate ?? 0;
  const todayCount = data?.today.transactionsCount ?? 0;
  const pendingCount = data?.pending.count ?? 0;
  const studentsCount = data?.studentsCount ?? 0;
  const schoolsCount = data?.schoolsCount ?? 0;
  const activeSchoolsCount = data?.activeSchoolsCount ?? 0;
  const usersCount = data?.usersCount ?? 0;
  const cashiersCount = data?.cashiersCount ?? 0;

  const personaLabel = isSuper ? "Super Admin" : "Admin École";

  return (
    <AdminShell>
      {/* TOP BAR */}
      <header className="sticky top-0 z-20 border-b border-border/60 bg-card/90 px-4 py-3 backdrop-blur lg:px-8">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-extrabold text-foreground">
              {greeting()},{" "}
              <span className="text-primary">{profile?.full_name?.split(" ")[0] ?? "Admin"}</span>
            </p>
            <p className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3 w-3" />
              {personaLabel} · {pendingCount} en attente · {todayCount} aujourd'hui
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
            <IconBtn label="Notifications" badge={pendingCount}><Bell className="h-4 w-4" /></IconBtn>

            <Link
              to={"/admin/profile" as "/admin"}
              className="ml-2 hidden items-center gap-2 rounded-full border border-border/60 bg-muted/40 py-1 pl-1 pr-3 transition hover:bg-card sm:flex"
            >
              <span
                style={{ backgroundImage: "var(--gradient-primary)" }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-black text-white"
              >
                {(profile?.full_name ?? "A").slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden flex-col leading-tight md:flex">
                <span className="text-xs font-extrabold">{profile?.full_name ?? "Admin"}</span>
                <span className="text-[10px] text-muted-foreground">{personaLabel}</span>
              </span>
            </Link>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 lg:px-8">
        {/* TITRE */}
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
              Tableau de bord {isSuper ? "Super Admin" : "Administration"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Vue d'ensemble de votre plateforme
            </p>
          </div>
        </div>

        {/* STATS + CTA */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Collecte du mois"
            value={formatNumber(monthTotal)}
            unit="CDF"
            delta={`+${completionRate}%`}
            deltaTone="positive"
            sub={`Taux de complétion : ${completionRate}%`}
            icon={<Wallet className="h-5 w-5" />}
            iconBg="bg-[var(--gradient-primary)] text-primary-foreground"
            spark={<Sparkline variant="bars" tone="primary" />}
          />
          <StatCard
            label="Encaissements aujourd'hui"
            value={String(todayCount)}
            unit="trans."
            delta="+12%"
            deltaTone="positive"
            sub="Transactions confirmées"
            icon={<TrendingUp className="h-5 w-5" />}
            iconBg="bg-tint-peach text-tint-peach-foreground"
            spark={<Sparkline variant="line" tone="peach" />}
          />
          <StatCard
            label={isSuper ? "Écoles actives" : "Élèves suivis"}
            value={String(isSuper ? activeSchoolsCount : studentsCount)}
            unit={isSuper ? undefined : `/ ${formatNumber(cashiersCount)} caissiers`}
            delta="+8%"
            deltaTone="positive"
            sub={isSuper ? "Dans votre périmètre" : "Effectif total"}
            icon={isSuper ? <GraduationCap className="h-5 w-5" /> : <Users className="h-5 w-5" />}
            iconBg="bg-tint-sky text-tint-sky-foreground"
            spark={<Sparkline variant="line" tone="primary" />}
          />

          {/* CTA — petit bouton vert icône */}
          <div className="flex flex-col items-center justify-center gap-2">
            <button
              type="button"
              onClick={handleCtaClick}
              aria-label={isSuper ? "Nouvel encaissement" : "Nouvel élève"}
              title={isSuper ? "Nouvel encaissement" : "Nouvel élève"}
              style={{ backgroundImage: "var(--gradient-primary)" }}
              className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-white shadow-[var(--shadow-elevated)] transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
            >
              <Plus className="h-7 w-7" strokeWidth={2.75} />
            </button>
            <span className="text-[11px] font-bold text-muted-foreground">
              {isSuper ? "Nouvel encaissement" : "Nouvel élève"}
            </span>
          </div>
        </section>

        {createStudentOpen && (
          <CreateStudentDrawer
            initialSchoolId={profile?.primary_school_id ?? null}
            onClose={() => setCreateStudentOpen(false)}
            onCreated={() => {
              qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
              qc.invalidateQueries({ queryKey: ["admin-students"] });
              setCreateStudentOpen(false);
            }}
          />
        )}

        {/* SANTÉ DES PAIEMENTS */}
        <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-[var(--shadow-card)] lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-black tracking-tight">
                <HeartPulse className="h-4 w-4 text-primary" /> Santé des paiements
              </h2>
              <span className="rounded-full bg-success/10 px-2.5 py-1 text-[10px] font-black text-success">
                +{completionRate}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-success" />
                <span className="text-sm font-semibold">Taux de complétion</span>
              </div>
              <span className="text-base font-extrabold">{completionRate}%</span>
            </div>
            <Progress value={completionRate} className="mt-2 h-2 bg-secondary [&>div]:bg-success" />

            <div className="mt-4 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-primary" />
              <span className="text-sm font-semibold">Volume collecté ce mois</span>
            </div>
            <p className="mt-1 text-2xl font-black tracking-tight">
              {formatNumber(monthTotal)} <span className="text-xs font-bold text-muted-foreground">CDF</span>
            </p>

            <div className="mt-4 grid grid-cols-3 divide-x divide-border border-t border-border pt-3 text-center">
              <Stat value={todayCount} label="Aujourd'hui" />
              <Stat value={pendingCount} label="En attente" />
              <Stat value={isSuper ? schoolsCount : studentsCount} label={isSuper ? "Écoles" : "Élèves"} />
            </div>
          </div>

          {/* Activité du jour */}
          <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-[var(--shadow-card)]">
            <h2 className="mb-4 flex items-center gap-2 text-base font-black tracking-tight">
              <Activity className="h-4 w-4 text-primary" /> Activité du jour
            </h2>
            <ActivityRow
              tint="bg-tint-mint" iconColor="text-tint-mint-foreground"
              icon={<Wallet className="h-5 w-5" />}
              title="Encaissements" subtitle="Transactions confirmées"
              value={todayCount}
            />
            <div className="my-2 h-px bg-border" />
            <ActivityRow
              tint="bg-tint-peach" iconColor="text-tint-peach-foreground"
              icon={<Clock className="h-5 w-5" />}
              title="En attente" subtitle="À finaliser"
              value={pendingCount}
              valueClass="text-tint-peach-foreground"
            />
          </div>
        </section>

        {/* INDICATEURS DÉTAILLÉS */}
        <section className="mt-6">
          <h2 className="mb-3 flex items-center gap-2 text-base font-black tracking-tight">
            <FileBarChart2 className="h-4 w-4 text-primary" /> Indicateurs clés
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard
              tint="bg-tint-sky" iconColor="text-tint-sky-foreground"
              icon={<GraduationCap className="h-5 w-5" />}
              value={schoolsCount}
              label="Écoles" hint="Dans votre périmètre"
            />
            <KpiCard
              tint="bg-tint-lavender" iconColor="text-tint-lavender-foreground"
              icon={<Users className="h-5 w-5" />}
              value={usersCount}
              label="Utilisateurs" hint="Comptes administrés"
            />
            <KpiCard
              tint="bg-tint-mint" iconColor="text-tint-mint-foreground"
              icon={<UserRoundCheck className="h-5 w-5" />}
              value={studentsCount}
              label="Élèves" hint="Effectif total suivi"
            />
            <KpiCard
              tint="bg-tint-peach" iconColor="text-tint-peach-foreground"
              icon={<Building2 className="h-5 w-5" />}
              value={cashiersCount}
              label="Caissiers actifs" hint="Comptes opérationnels"
            />
          </div>
        </section>

        {/* RAPPORTS */}
        <section className="mt-6">
          <h2 className="mb-3 flex items-center gap-2 text-base font-black tracking-tight">
            <FileBarChart2 className="h-4 w-4 text-primary" /> Rapports
          </h2>
          <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-[var(--shadow-card)]">
            <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">
              Année scolaire (par classe / par type de frais)
            </label>
            <div className="rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 text-sm font-bold">
              2025-2026
            </div>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
              <Link to={"/reports/payments" as "/admin"} className="block">
                <ReportButton
                  style={{ backgroundImage: "var(--gradient-primary)" }}
                  className="bg-primary"
                  icon={<Calendar className="h-4 w-4" />}
                  label="Paiements reçus"
                />
              </Link>
              <Link to={"/reports/payments" as "/admin"} className="block">
                <ReportButton className="bg-info" icon={<ImageIcon className="h-4 w-4" />} label="Par classe" />
              </Link>
              <Link to={"/reports/payments" as "/admin"} className="block">
                <ReportButton className="bg-violet" icon={<Tag className="h-4 w-4" />} label="Par type de frais" />
              </Link>
            </div>
          </div>
        </section>

        {/* ACCÈS RAPIDE */}
        <section className="mt-6">
          <h2 className="mb-3 flex items-center gap-2 text-base font-black tracking-tight">
            <Rocket className="h-4 w-4 text-primary" /> Accès rapide
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {isSuper ? (
              <>
                <QuickLink to="/admin/schools" tint="bg-tint-sky" iconColor="text-tint-sky-foreground" icon={<GraduationCap className="h-5 w-5" />} label="Écoles" />
                <QuickLink to="/admin/users" tint="bg-tint-lavender" iconColor="text-tint-lavender-foreground" icon={<Users className="h-5 w-5" />} label="Utilisateurs" />
                <QuickLink to="/admin/collections" tint="bg-tint-mint" iconColor="text-tint-mint-foreground" icon={<Receipt className="h-5 w-5" />} label="Encaissements" />
                <QuickLink to="/admin/notifications" tint="bg-tint-peach" iconColor="text-tint-peach-foreground" icon={<Bell className="h-5 w-5" />} label="Notifications" />
              </>
            ) : (
              <>
                <QuickLink to="/admin/students" tint="bg-tint-sky" iconColor="text-tint-sky-foreground" icon={<UserRoundCheck className="h-5 w-5" />} label="Élèves" />
                <QuickLink to="/admin/parents" tint="bg-tint-lavender" iconColor="text-tint-lavender-foreground" icon={<Users className="h-5 w-5" />} label="Parents" />
                <QuickLink to="/admin/fees" tint="bg-tint-mint" iconColor="text-tint-mint-foreground" icon={<Receipt className="h-5 w-5" />} label="Motifs" />
                <QuickLink to="/admin/profile" tint="bg-tint-peach" iconColor="text-tint-peach-foreground" icon={<ShieldCheck className="h-5 w-5" />} label="Profil" />
              </>
            )}
          </div>

          {isLoading && (
            <p className="mt-4 text-center text-xs text-muted-foreground">Chargement des données…</p>
          )}
        </section>
      </main>
    </AdminShell>
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
  label: string; value: string; unit?: string;
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
        {unit && <span className="ml-1 text-xs font-bold text-muted-foreground">{unit}</span>}
      </p>
      <p className="mt-2 text-[11px] text-muted-foreground">{sub}</p>

      <div className="mt-3 h-10 w-full">{spark}</div>
    </div>
  );
}

function Sparkline({ variant, tone }: { variant: "line" | "bars"; tone: "primary" | "peach" }) {
  const stroke = tone === "primary" ? "var(--primary)" : "var(--tint-peach-foreground)";
  if (variant === "bars") {
    const heights = [40, 65, 35, 80, 50, 95, 60];
    return (
      <svg viewBox="0 0 140 40" className="h-full w-full">
        {heights.map((h, i) => (
          <rect
            key={i}
            x={i * 20 + 2}
            y={40 - (h / 100) * 36}
            width="14"
            height={(h / 100) * 36}
            rx="3"
            fill={stroke}
            opacity={0.85}
          />
        ))}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 140 40" className="h-full w-full" preserveAspectRatio="none">
      <path
        d="M 0 30 L 20 22 L 40 26 L 60 14 L 80 18 L 100 8 L 120 12 L 140 4"
        fill="none"
        stroke={stroke}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ActivityRow({
  tint, iconColor, icon, title, subtitle, value, valueClass,
}: {
  tint: string; iconColor: string; icon: React.ReactNode;
  title: string; subtitle: string; value: number; valueClass?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className={cn("flex h-10 w-10 items-center justify-center rounded-2xl", tint, iconColor)}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold">{title}</p>
        <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      </div>
      <p className={cn("text-2xl font-black", valueClass ?? "text-foreground")}>{formatNumber(value)}</p>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="px-2">
      <p className="text-xl font-black">{formatNumber(value)}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function QuickLink({ to, tint, iconColor, icon, label }: {
  to: "/admin/schools" | "/admin/users" | "/admin/collections" | "/admin/notifications" | "/admin/students" | "/admin/parents" | "/admin/fees" | "/admin/profile";
  tint: string; iconColor: string; icon: React.ReactNode; label: string;
}) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center gap-2 rounded-3xl border border-border/60 bg-card p-5 text-center shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <span className={cn("flex h-12 w-12 items-center justify-center rounded-2xl", tint, iconColor)}>
        {icon}
      </span>
      <span className="text-sm font-bold text-foreground">{label}</span>
    </Link>
  );
}

function KpiCard({ tint, iconColor, icon, value, label, hint, to }: {
  tint: string; iconColor: string; icon: React.ReactNode;
  value: number | string; label: string; hint?: string;
  to?: "/admin/schools" | "/admin/users" | "/admin/students-overview" | "/admin/students";
}) {
  const inner = (
    <>
      <span className={cn("mb-3 flex h-10 w-10 items-center justify-center rounded-2xl", tint, iconColor)}>
        {icon}
      </span>
      <p className="text-2xl font-black leading-none">
        {typeof value === "number" ? formatNumber(value) : value}
      </p>
      <p className="mt-2 text-sm font-extrabold text-foreground">{label}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </>
  );
  const className = "block text-left rounded-3xl border border-border/60 bg-card p-4 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-md hover:border-primary/40";
  if (to) {
    return <Link to={to} className={className}>{inner}</Link>;
  }
  return (
    <div className={className}>
      {inner}
    </div>
  );
}

function ReportButton({
  className, style, icon, label,
}: {
  className?: string;
  style?: React.CSSProperties;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      style={style}
      className={cn(
        "flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-white shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-md",
        className,
      )}
    >
      {icon}
      {label}
    </button>
  );
}
