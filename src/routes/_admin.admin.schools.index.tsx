import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { LuGraduationCap as GraduationCap, LuCircleCheckBig as CheckCircle2, LuUserRoundCheck as UserRoundCheck, LuFileText as FileText, LuSearch as Search, LuPlus as Plus, LuMapPin as MapPin, LuUser as User, LuChevronRight as ChevronRight } from "react-icons/lu";
import { AdminShell } from "@/components/AdminShell";
import { AdminHero } from "@/components/AdminHero";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

interface School {
  id: string;
  name: string;
  sigle?: string | null;
  city?: string | null;
  status: string;
  promoter_name?: string | null;
  students_count: number;
  fees_count: number;
  logo_url?: string | null;
}
interface SchoolsResp {
  items: School[];
  stats: { total: number; active: number; students: number; fees: number };
}

export const Route = createFileRoute("/_admin/admin/schools/")({
  head: () => ({ meta: [{ title: "Écoles — Administration" }] }),
  component: SchoolsList,
});

function SchoolsList() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["admin-schools"],
    queryFn: () => apiFetch<SchoolsResp>("/admin-schools"),
  });

  const items = (data?.items ?? []).filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.city ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AdminShell>
      <AdminHero
        title="Écoles"
        subtitle="Gérez vos établissements et caissiers."
        backTo="/admin"
        showFilter
        className="rounded-b-[2rem]"
      />

      {/* Stats row */}
      <section className="px-4 pt-4">
        <div className="grid grid-cols-4 gap-2 rounded-3xl bg-card p-3 shadow-[var(--shadow-card)]">
          <Stat tint="bg-tint-sky" iconColor="text-tint-sky-foreground" icon={<GraduationCap className="h-4 w-4" />} value={data?.stats.total ?? 0} label="Écoles" />
          <Stat tint="bg-tint-mint" iconColor="text-tint-mint-foreground" icon={<CheckCircle2 className="h-4 w-4" />} value={data?.stats.active ?? 0} label="Actives" />
          <Stat tint="bg-tint-sky" iconColor="text-tint-sky-foreground" icon={<UserRoundCheck className="h-4 w-4" />} value={data?.stats.students ?? 0} label="Élèves" />
          <Stat tint="bg-tint-peach" iconColor="text-tint-peach-foreground" icon={<FileText className="h-4 w-4" />} value={data?.stats.fees ?? 0} label="Frais" />
        </div>
      </section>

      {/* Search */}
      <section className="px-4 pt-3">
        <div className="flex items-center gap-2 rounded-2xl bg-card px-4 py-3 shadow-[var(--shadow-card)]">
          <Search className="h-5 w-5 text-primary" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une école…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </section>

      {/* List */}
      <section className="px-4 pt-3 pb-24">
        {isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Chargement…</p>}
        {!isLoading && items.length === 0 && (
          <p className="rounded-2xl bg-card p-5 text-center text-sm text-muted-foreground shadow-[var(--shadow-card)]">
            Aucune école pour le moment.
          </p>
        )}
        <div className="space-y-3">
          {items.map((s) => (
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
                    <h3 className="truncate text-base font-extrabold leading-tight">{s.name}</h3>
                    <span className={cn(
                      "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                      s.status === "active" ? "bg-tint-mint text-tint-mint-foreground" : "bg-secondary text-muted-foreground",
                    )}>
                      {s.status === "active" ? "Actif" : "Inactif"}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    {s.city && (
                      <span className="flex items-center gap-1 truncate"><MapPin className="h-3.5 w-3.5" /> {s.city}</span>
                    )}
                    {s.promoter_name && (
                      <span className="flex items-center gap-1 truncate"><User className="h-3.5 w-3.5" /> {s.promoter_name}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <UserRoundCheck className="h-3.5 w-3.5" /> {s.students_count} élèves
                </span>
                <span className="rounded-full bg-secondary px-3 py-1 font-semibold text-muted-foreground">
                  {s.fees_count} frais enregistrés
                </span>
                <ChevronRight className="h-4 w-4 text-primary" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* FAB */}
      <Link
        to="/admin/schools/new"
        className="fixed bottom-24 right-5 z-20 sm:right-[calc(50%-220px)]"
        aria-label="Créer une école"
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-elevated)]">
          <Plus className="h-6 w-6" />
        </span>
      </Link>
    </AdminShell>
  );
}

function Stat({ tint, iconColor, icon, value, label }: {
  tint: string; iconColor: string; icon: React.ReactNode; value: number; label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 px-1 py-2">
      <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", tint, iconColor)}>
        {icon}
      </span>
      <p className="text-base font-extrabold leading-none">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
