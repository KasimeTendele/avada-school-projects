import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { LuUsers as Users, LuCircleCheckBig as CheckCircle2, LuCalculator as Calculator, LuUserRound as UserRound, LuSearch as Search, LuEye as Eye, LuShieldCheck as ShieldCheck, LuChevronDown as ChevronDown, LuChevronUp as ChevronUp, LuGraduationCap as GraduationCap, LuX as X, LuPlus as Plus } from "react-icons/lu";
import { AdminShell } from "@/components/AdminShell";
import { AdminHero } from "@/components/AdminHero";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

interface UserRow {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  status: string;
  role: string;
  roles: string[];
  last_login_at: string | null;
  school_name: string | null;
}
interface UsersResp {
  items: UserRow[];
  stats: { total: number; active: number; cashiers: number; parents: number };
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super admin",
  admin: "Admin",
  cashier: "Caissier",
  parent: "Parent",
  inspector: "Inspecteur",
};
const ROLE_TINTS: Record<string, string> = {
  super_admin: "bg-tint-lavender text-tint-lavender-foreground",
  admin: "bg-tint-sky text-tint-sky-foreground",
  cashier: "bg-tint-mint text-tint-mint-foreground",
  parent: "bg-tint-peach text-tint-peach-foreground",
  inspector: "bg-tint-sky text-tint-sky-foreground",
};

export const Route = createFileRoute("/_admin/admin/users/")({
  head: () => ({ meta: [{ title: "Utilisateurs — Administration" }] }),
  component: UsersList,
});

function UsersList() {
  const { roles } = useAuth();
  const isSuper = roles.includes("super_admin");
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("name_asc");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", role, status, sort, search],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (search) qs.set("search", search);
      if (role !== "all") qs.set("role", role);
      if (status !== "all") qs.set("status", status);
      qs.set("sort", sort);
      return apiFetch<UsersResp>(`/admin-users?${qs.toString()}`);
    },
  });

  const items = data?.items ?? [];

  const ROLE_ORDER = ["super_admin", "admin", "cashier", "parent", "inspector"];
  const grouped = useMemo(() => {
    const map = new Map<string, UserRow[]>();
    for (const u of items) {
      const key = u.role || "user";
      const arr = map.get(key) ?? [];
      arr.push(u);
      map.set(key, arr);
    }
    const knownOrdered = ROLE_ORDER.filter((r) => map.has(r)).map((r) => [r, map.get(r)!] as const);
    const others = [...map.entries()].filter(([k]) => !ROLE_ORDER.includes(k));
    return [...knownOrdered, ...others];
  }, [items]);

  return (
    <AdminShell>
      <AdminHero
        title={isSuper ? "Gestion des utilisateurs" : "Équipe de l'école"}
        subtitle={isSuper ? "Gérez les comptes et les accès." : "Gérez les caissiers de votre école."}
        backTo="/admin"
        showFilter
        onFilterClick={() => setFiltersOpen(true)}
        className="rounded-b-[2rem]"
      />

      {/* New user CTA */}
      <section className="px-4 pt-4">
        <Link
          to="/admin/users/new"
          className="flex items-center justify-center gap-2 rounded-3xl bg-primary py-3.5 text-sm font-extrabold text-primary-foreground shadow-[var(--shadow-card)]"
        >
          <Plus className="h-4 w-4" /> {isSuper ? "Nouveau compte (admin école / caissier)" : "Nouveau caissier"}
        </Link>
      </section>

      {/* Stats */}
      <section className="px-4 pt-3">
        <div className="grid grid-cols-4 gap-2 rounded-3xl bg-card p-3 shadow-[var(--shadow-card)]">
          <Stat tint="bg-tint-sky" iconColor="text-tint-sky-foreground" icon={<Users className="h-4 w-4" />} value={data?.stats.total ?? 0} label="Total" />
          <Stat tint="bg-tint-mint" iconColor="text-tint-mint-foreground" icon={<CheckCircle2 className="h-4 w-4" />} value={data?.stats.active ?? 0} label="Actifs" />
          <Stat tint="bg-tint-sky" iconColor="text-tint-sky-foreground" icon={<Calculator className="h-4 w-4" />} value={data?.stats.cashiers ?? 0} label="Caissiers" />
          <Stat tint="bg-tint-peach" iconColor="text-tint-peach-foreground" icon={<UserRound className="h-4 w-4" />} value={data?.stats.parents ?? 0} label="Parents" />
        </div>
      </section>

      {/* Search */}
      <section className="px-4 pt-3">
        <div className="flex items-center gap-2 rounded-2xl bg-card px-4 py-3 shadow-[var(--shadow-card)]">
          <Search className="h-5 w-5 text-primary" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, email, école…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{items.length} utilisateurs</p>
      </section>

      {/* List */}
      <section className="px-4 pt-2 pb-6">
        {isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Chargement…</p>}
        <div className="space-y-6">
          {grouped.map(([roleKey, users]) => (
            <div key={roleKey}>
              <div className="mb-2 flex items-center justify-between px-1">
                <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide">
                  <span className={cn("flex h-7 w-7 items-center justify-center rounded-xl", roleIconBg(roleKey))}>
                    {roleIcon(roleKey)}
                  </span>
                  {ROLE_LABELS[roleKey] ?? roleKey}
                </h2>
                <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">
                  {users.length}
                </span>
              </div>
              <div className="space-y-3">
                {users.map((u) => (
                  <Link
                    key={u.id}
                    to="/admin/users/$id"
                    params={{ id: u.id }}
                    className="block rounded-3xl bg-card p-4 shadow-[var(--shadow-card)]"
                  >
                    <div className="flex items-start gap-3">
                      <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", roleIconBg(u.role))}>
                        {roleIcon(u.role)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="truncate text-base font-extrabold leading-tight">{u.full_name ?? "—"}</h3>
                            <p className="truncate text-xs text-muted-foreground">{u.email ?? "—"}</p>
                          </div>
                          <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold", ROLE_TINTS[u.role] ?? "bg-secondary text-muted-foreground")}>
                            {ROLE_LABELS[u.role] ?? u.role}
                          </span>
                        </div>
                        {u.school_name && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <GraduationCap className="h-3.5 w-3.5" /> {u.school_name}
                          </p>
                        )}
                        <div className="mt-1 flex items-center justify-end">
                          <span className={cn(
                            "flex items-center gap-1 text-[11px] font-semibold",
                            u.status === "active" ? "text-success" : "text-muted-foreground",
                          )}>
                            <span className={cn("h-1.5 w-1.5 rounded-full", u.status === "active" ? "bg-success" : "bg-muted-foreground")} />
                            {u.status === "active" ? "Actif" : u.status === "suspended" ? "Suspendu" : "Inactif"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <p className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
                      Dernière connexion : {relativeTime(u.last_login_at)}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          ))}
          {!isLoading && items.length === 0 && (
            <p className="rounded-3xl bg-card p-8 text-center text-sm text-muted-foreground shadow-[var(--shadow-card)]">
              Aucun utilisateur à afficher.
            </p>
          )}
        </div>
      </section>

      {/* Filters sheet */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="rounded-t-[2rem]">
          <div className="mx-auto h-1 w-10 -translate-y-3 rounded-full bg-border" />
          <h3 className="flex items-center gap-2 text-base font-extrabold">
            <ShieldCheck className="h-4 w-4 text-primary" /> Filtres
          </h3>

          <FilterGroup label="Rôle" icon={<ShieldCheck className="h-4 w-4 text-primary" />}>
            <NativeSelect value={role} onChange={setRole} options={[
              { value: "all", label: "Tous les rôles" },
              { value: "super_admin", label: "Super admin" },
              { value: "admin", label: "Admin" },
              { value: "cashier", label: "Caissier" },
              { value: "parent", label: "Parent" },
            ]} />
          </FilterGroup>

          <FilterGroup label="Statut" icon={<CheckCircle2 className="h-4 w-4 text-primary" />}>
            <NativeSelect value={status} onChange={setStatus} options={[
              { value: "all", label: "Tous les statuts" },
              { value: "active", label: "Actif" },
              { value: "suspended", label: "Suspendu" },
              { value: "inactive", label: "Inactif" },
            ]} />
          </FilterGroup>

          <FilterGroup label="Tri" icon={<ChevronUp className="h-4 w-4 text-primary" />}>
            <NativeSelect value={sort} onChange={setSort} options={[
              { value: "name_asc", label: "Nom (A-Z)" },
              { value: "name_desc", label: "Nom (Z-A)" },
              { value: "recent", label: "Connexion récente" },
            ]} />
          </FilterGroup>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              onClick={() => { setRole("all"); setStatus("all"); setSort("name_asc"); }}
              className="flex items-center justify-center gap-2 rounded-2xl border border-border py-3 text-sm font-bold"
            >
              <X className="h-4 w-4" /> Réinitialiser
            </button>
            <button
              onClick={() => setFiltersOpen(false)}
              className="flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground"
            >
              <CheckCircle2 className="h-4 w-4" /> Appliquer
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </AdminShell>
  );
}

function Stat({ tint, iconColor, icon, value, label }: { tint: string; iconColor: string; icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 px-1 py-2">
      <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", tint, iconColor)}>{icon}</span>
      <p className="text-base font-extrabold leading-none">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function FilterGroup({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-3xl bg-card p-4 shadow-[var(--shadow-card)]">
      <p className="mb-2 flex items-center gap-2 text-sm font-extrabold">{icon} {label}</p>
      {children}
    </div>
  );
}
function NativeSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3">
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-transparent text-sm font-bold outline-none">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}
function roleIconBg(r: string) {
  return ROLE_TINTS[r] ?? "bg-secondary text-muted-foreground";
}
function roleIcon(r: string) {
  if (r === "cashier") return <Calculator className="h-5 w-5" />;
  if (r === "parent") return <UserRound className="h-5 w-5" />;
  if (r === "inspector") return <Eye className="h-5 w-5" />;
  return <ShieldCheck className="h-5 w-5" />;
}
export function relativeTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 3600) return `Il y a ${Math.max(1, Math.round(diff / 60))} min`;
  if (diff < 86400) return `Il y a ${Math.round(diff / 3600)}h`;
  if (diff < 86400 * 7) return `Il y a ${Math.round(diff / 86400)} jours`;
  return d.toLocaleDateString("fr-FR");
}
