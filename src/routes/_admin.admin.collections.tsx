import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LuPercent as Percent, LuHourglass as Hourglass, LuGraduationCap as GraduationCap, LuChevronRight as ChevronRight, LuSmartphone as Smartphone, LuCreditCard as CreditCard, LuUserRoundCheck as UserRoundCheck, LuFileText as FileText, LuMapPin as MapPin, LuTrendingUp as TrendingUp } from "react-icons/lu";
import { Link } from "@tanstack/react-router";
import { AdminShell } from "@/components/AdminShell";
import { AdminHero } from "@/components/AdminHero";
import { apiFetch } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

interface FeeToCollect {
  id: string; label: string; amount: number; currency: string;
  school_name: string; class_name: string | null; student_name: string;
  remaining: number;
}
interface RecentPayment {
  id: string; amount: number; currency: string; method: string; status: string;
  paid_at: string | null; created_at: string;
  student_name: string; school_name: string; fee_label: string | null;
}
interface CollectionsResp {
  pending: { total: number; growthPct: number };
  completed: { total: number; growthPct: number };
  feesToCollect: FeeToCollect[];
  recent: RecentPayment[];
  perSchool?: SchoolStat[];
}

interface SchoolStat {
  id: string;
  name: string;
  city: string | null;
  logo_url: string | null;
  status: string;
  students_count: number;
  fees_count: number;
  collected: number;
  pending: number;
  completion_rate: number;
}

export const Route = createFileRoute("/_admin/admin/collections")({
  head: () => ({ meta: [{ title: "Encaissements — Administration" }] }),
  component: CollectionsPage,
});

function CollectionsPage() {
  const { data } = useQuery({
    queryKey: ["admin-collections"],
    queryFn: () => apiFetch<CollectionsResp>("/admin-collections"),
  });

  return (
    <AdminShell>
      <AdminHero
        title="Encaissements"
        subtitle="Suivez les paiements et les frais."
        backTo="/admin"
        showFilter
        className="rounded-b-[2rem]"
      />

      {/* Two big colored cards */}
      <section className="px-4 pt-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-3xl bg-lime p-4 text-lime-foreground shadow-[var(--shadow-elevated)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-base font-extrabold">À encaisser</p>
                <p className="text-xs">En attente</p>
              </div>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background">
                <Percent className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-extrabold">
              {formatNumber(data?.pending.total ?? 0)} <span className="text-base font-bold">CDF</span>
            </p>
            <span className="mt-2 inline-block rounded-full bg-foreground px-2.5 py-0.5 text-xs font-bold text-background">
              {(data?.pending.growthPct ?? 0).toFixed(0)}%
            </span>
            <p className="mt-2 text-xs">Croissance vs semaine préc.</p>
          </div>

          <div className="rounded-3xl bg-warning p-4 text-warning-foreground shadow-[var(--shadow-elevated)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-base font-extrabold">Déjà encaissé</p>
                <p className="text-xs">Cumulé</p>
              </div>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background">
                <Hourglass className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-extrabold">
              {formatNumber(data?.completed.total ?? 0)} <span className="text-base font-bold">CDF</span>
            </p>
            <span className="mt-2 inline-block rounded-full bg-foreground px-2.5 py-0.5 text-xs font-bold text-background">
              {(data?.completed.growthPct ?? 0).toFixed(1)}%
            </span>
            <p className="mt-2 text-xs">Croissance vs semaine préc.</p>
          </div>
        </div>
      </section>

      {/* Frais à encaisser - horizontal scroll */}
      <section className="pt-5">
        <div className="flex items-center justify-between px-4">
          <h2 className="text-base font-extrabold">Frais à encaisser</h2>
          <button className="flex items-center gap-1 text-sm font-extrabold text-primary">
            Voir plus <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide">
          {(data?.feesToCollect ?? []).map((f) => (
            <article key={f.id} className="w-[260px] shrink-0 snap-start rounded-3xl border border-primary/40 bg-card p-4 shadow-[var(--shadow-card)]">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-tint-sky text-tint-sky-foreground">
                  <GraduationCap className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-bold uppercase tracking-wider text-primary">{f.school_name}</p>
                  <p className="truncate text-sm font-extrabold">{f.label}</p>
                </div>
              </div>
              <p className="mt-2 truncate text-xs text-muted-foreground">👤 {f.student_name}</p>
              {f.class_name && <p className="mt-1 truncate text-xs text-muted-foreground">🎓 {f.class_name}</p>}
              <p className="mt-2 text-sm font-extrabold text-success">
                Reste: {formatNumber(f.remaining)} {f.currency}
              </p>
            </article>
          ))}
          {(!data || data.feesToCollect.length === 0) && (
            <p className="text-sm text-muted-foreground">Aucun frais en attente.</p>
          )}
        </div>
      </section>

      {/* Statistiques par école */}
      <section className="px-4 pt-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold">Statistiques par école</h2>
          <Link to="/admin/schools" className="flex items-center gap-1 text-sm font-extrabold text-primary">
            Voir plus <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(data?.perSchool ?? []).map((s) => (
            <Link
              key={s.id}
              to="/admin/schools/$id"
              params={{ id: s.id }}
              className="block rounded-3xl bg-card p-4 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-elevated)]"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-tint-sky text-tint-sky-foreground">
                  {s.logo_url ? (
                    <img src={s.logo_url} alt={s.name} className="h-full w-full object-cover" />
                  ) : (
                    <GraduationCap className="h-5 w-5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="truncate text-sm font-extrabold leading-tight">{s.name}</h3>
                    <span className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      s.status === "active" ? "bg-tint-mint text-tint-mint-foreground" : "bg-secondary text-muted-foreground",
                    )}>
                      {s.status === "active" ? "Actif" : "Inactif"}
                    </span>
                  </div>
                  {s.city && (
                    <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {s.city}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-tint-sky/40 p-2.5">
                  <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-tint-sky-foreground">
                    <UserRoundCheck className="h-3 w-3" /> Élèves
                  </p>
                  <p className="mt-0.5 text-base font-extrabold">{s.students_count}</p>
                </div>
                <div className="rounded-2xl bg-tint-peach/40 p-2.5">
                  <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-tint-peach-foreground">
                    <FileText className="h-3 w-3" /> Frais
                  </p>
                  <p className="mt-0.5 text-base font-extrabold">{s.fees_count}</p>
                </div>
              </div>

              <div className="mt-2 space-y-1.5 border-t border-border pt-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Encaissé</span>
                  <span className="font-extrabold text-success">{formatNumber(s.collected)} CDF</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">En attente</span>
                  <span className="font-extrabold text-warning-foreground">{formatNumber(s.pending)} CDF</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <TrendingUp className="h-3 w-3" /> Complétion
                  </span>
                  <span className="font-extrabold text-primary">{s.completion_rate}%</span>
                </div>
              </div>
            </Link>
          ))}
          {(!data || (data.perSchool ?? []).length === 0) && (
            <p className="rounded-2xl bg-card p-5 text-center text-sm text-muted-foreground shadow-[var(--shadow-card)] sm:col-span-2 lg:col-span-3">
              Aucune école.
            </p>
          )}
        </div>
      </section>

      {/* Derniers encaissements */}
      <section className="px-4 pt-2 pb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold">Derniers encaissements</h2>
          <button className="flex items-center gap-1 text-sm font-extrabold text-primary">
            Voir plus <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 space-y-2.5">
          {(data?.recent ?? []).map((p) => {
            const date = new Date(p.paid_at ?? p.created_at);
            const dateStr = `${date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}, ${date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
            const isMobile = (p.method ?? "").toLowerCase().includes("mobile");
            return (
              <div key={p.id} className="rounded-3xl bg-card p-4 shadow-[var(--shadow-card)]">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-base font-extrabold">{formatNumber(p.amount)} {p.currency}</p>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    {isMobile ? <Smartphone className="h-3.5 w-3.5" /> : <CreditCard className="h-3.5 w-3.5" />}
                    {isMobile ? "Mobile money" : "Carte"}
                  </span>
                </div>
                <p className="text-sm font-semibold">{p.fee_label ?? "Paiement"}</p>
                <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="truncate">👤 {p.student_name} | 🎓 {p.school_name}</span>
                  <span className="shrink-0">{dateStr}</span>
                </div>
              </div>
            );
          })}
          {(!data || data.recent.length === 0) && (
            <p className="rounded-2xl bg-card p-5 text-center text-sm text-muted-foreground shadow-[var(--shadow-card)]">
              Aucun encaissement récent.
            </p>
          )}
        </div>
      </section>
    </AdminShell>
  );
}
