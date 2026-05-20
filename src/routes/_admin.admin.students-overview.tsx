import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LuChevronDown as ChevronDown, LuSearch as Search, LuGraduationCap as GraduationCap, LuShieldCheck as ShieldCheck, LuUsers as Users } from "react-icons/lu";
import { AdminShell } from "@/components/AdminShell";
import { AdminHero } from "@/components/AdminHero";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

interface AdminInfo {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
}
interface StudentInfo {
  id: string;
  first_name: string;
  last_name: string;
  post_name: string | null;
  matricule: string | null;
  gender: string | null;
  class_name: string | null;
  class_level: string | null;
}
interface SchoolGroup {
  id: string;
  name: string;
  sigle: string | null;
  city: string | null;
  status: string;
  logo_url: string | null;
  admins: AdminInfo[];
  students: StudentInfo[];
  students_count: number;
}
interface Resp { items: SchoolGroup[] }

export const Route = createFileRoute("/_admin/admin/students-overview")({
  head: () => ({ meta: [{ title: "Élèves par école — Administration" }] }),
  component: StudentsOverviewPage,
});

function StudentsOverviewPage() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const { data, isLoading } = useQuery({
    queryKey: ["admin-students-overview"],
    queryFn: () => apiFetch<Resp>("/admin-schools/overview"),
  });

  const items = useMemo(() => {
    const list = data?.items ?? [];
    const s = search.trim().toLowerCase();
    if (!s) return list;
    return list
      .map((g) => ({
        ...g,
        students: g.students.filter(
          (st) =>
            `${st.first_name} ${st.last_name} ${st.post_name ?? ""}`.toLowerCase().includes(s) ||
            (st.matricule ?? "").toLowerCase().includes(s) ||
            (st.class_name ?? "").toLowerCase().includes(s),
        ),
      }))
      .filter(
        (g) =>
          g.name.toLowerCase().includes(s) ||
          (g.city ?? "").toLowerCase().includes(s) ||
          g.students.length > 0 ||
          g.admins.some((a) => (a.full_name ?? "").toLowerCase().includes(s) || (a.email ?? "").toLowerCase().includes(s)),
      );
  }, [data, search]);

  const totalStudents = (data?.items ?? []).reduce((a, g) => a + g.students_count, 0);

  return (
    <AdminShell>
      <AdminHero
        title="Élèves par école"
        subtitle={`${data?.items.length ?? 0} école(s) · ${totalStudents} élève(s) au total`}
        backTo="/admin"
        className="rounded-b-[2rem]"
      />
      <main className="px-4 pb-8 pt-4 lg:px-8">
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher école, élève, matricule, classe, admin…"
            className="w-full rounded-full border border-border/60 bg-card py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary/40"
          />
        </div>

        {isLoading && (
          <p className="text-center text-sm text-muted-foreground">Chargement…</p>
        )}

        <div className="space-y-3">
          {items.map((g) => {
            const isOpen = open[g.id] ?? false;
            return (
              <section key={g.id} className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[var(--shadow-card)]">
                <button
                  type="button"
                  onClick={() => setOpen((o) => ({ ...o, [g.id]: !isOpen }))}
                  className="flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-muted/40"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-tint-sky text-tint-sky-foreground">
                    {g.logo_url ? (
                      <img src={g.logo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <GraduationCap className="h-6 w-6" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold">
                      {g.name} {g.sigle ? <span className="text-muted-foreground">· {g.sigle}</span> : null}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {g.city ?? "—"} · {g.students_count} élève(s) · {g.admins.length} admin(s)
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-black",
                      g.status === "active" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {g.status}
                  </span>
                  <ChevronDown className={cn("h-5 w-5 shrink-0 text-muted-foreground transition", isOpen && "rotate-180")} />
                </button>

                {isOpen && (
                  <div className="border-t border-border/60 bg-muted/20 p-4">
                    {/* Admins */}
                    <div className="mb-4">
                      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-muted-foreground">
                        <ShieldCheck className="h-3.5 w-3.5" /> Admin(s) en charge
                      </p>
                      {g.admins.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Aucun admin assigné</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {g.admins.map((a) => (
                            <div key={a.id} className="flex items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-1.5">
                              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-black text-primary">
                                {(a.full_name ?? "?").slice(0, 1).toUpperCase()}
                              </span>
                              <div className="leading-tight">
                                <p className="text-xs font-bold">{a.full_name ?? "—"}</p>
                                <p className="text-[10px] text-muted-foreground">{a.email ?? a.phone ?? ""}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Students */}
                    <p className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-muted-foreground">
                      <Users className="h-3.5 w-3.5" /> Élèves ({g.students.length})
                    </p>
                    {g.students.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Aucun élève</p>
                    ) : (
                      <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-muted/40 text-[10px] uppercase text-muted-foreground">
                            <tr>
                              <th className="px-3 py-2 font-bold">Matricule</th>
                              <th className="px-3 py-2 font-bold">Nom complet</th>
                              <th className="px-3 py-2 font-bold">Sexe</th>
                              <th className="px-3 py-2 font-bold">Classe</th>
                            </tr>
                          </thead>
                          <tbody>
                            {g.students.map((st) => (
                              <tr key={st.id} className="border-t border-border/60">
                                <td className="px-3 py-2 font-mono">{st.matricule ?? "—"}</td>
                                <td className="px-3 py-2 font-semibold">
                                  {[st.last_name, st.post_name, st.first_name].filter(Boolean).join(" ")}
                                </td>
                                <td className="px-3 py-2">{st.gender ?? "—"}</td>
                                <td className="px-3 py-2">
                                  {st.class_name ? `${st.class_name}${st.class_level ? ` · ${st.class_level}` : ""}` : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          })}

          {!isLoading && items.length === 0 && (
            <p className="rounded-3xl bg-card p-8 text-center text-sm text-muted-foreground shadow-[var(--shadow-card)]">
              Aucune école à afficher.
            </p>
          )}
        </div>
      </main>
    </AdminShell>
  );
}