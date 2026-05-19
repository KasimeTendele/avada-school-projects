import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  LuSlidersHorizontal as Sliders,
  LuSearch as Search,
  LuChevronRight as ChevronRight,
  LuUserPlus as UserPlus,
  LuUsers as Users,
} from "react-icons/lu";
import { CashierShell } from "@/components/CashierShell";
import { CashierTopBar, PageTitle } from "@/components/CashierTopBar";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  matricule: string | null;
  photo_url: string | null;
  class?: { id: string; name: string; level?: string } | null;
  school?: { id: string; name: string } | null;
}

interface FeeRow { id: string; student_id: string | null; class_id: string | null; }

export const Route = createFileRoute("/_cashier/cashier/students")({
  head: () => ({ meta: [{ title: "Élèves — Caisse" }] }),
  component: CashierStudents,
});

function CashierStudents() {
  const { profile } = useAuth();
  const schoolId = profile?.primary_school_id ?? null;
  const [q, setQ] = useState("");

  const studentsQ = useQuery({
    enabled: !!schoolId,
    queryKey: ["students-list", schoolId, q],
    queryFn: () =>
      apiFetch<{ items: Student[]; totalItems: number }>(
        `/students?schoolId=${schoolId}&limit=200${q ? `&search=${encodeURIComponent(q)}` : ""}`,
      ),
  });

  const feesQ = useQuery({
    enabled: !!schoolId,
    queryKey: ["fees-school", schoolId],
    queryFn: () => apiFetch<{ items: (FeeRow & { paid: number; remaining: number })[] }>(`/fees/by-school/${schoolId}`),
  });

  const items = studentsQ.data?.items ?? [];
  const total = studentsQ.data?.totalItems ?? 0;

  const unpaidByStudent = useMemo(() => {
    const set = new Set<string>();
    for (const f of feesQ.data?.items ?? []) {
      if (f.remaining > 0 && f.student_id) set.add(f.student_id);
    }
    return set;
  }, [feesQ.data]);
  const unpaidCount = unpaidByStudent.size;

  return (
    <CashierShell>
      <CashierTopBar
        search={q}
        onSearchChange={setQ}
        searchPlaceholder="Rechercher un élève..."
        subtitle={
          <>
            <Users className="h-3 w-3" />
            {total} élève{total > 1 ? "s" : ""} · {unpaidCount} impayé{unpaidCount > 1 ? "s" : ""}
          </>
        }
      />

      <main className="px-4 py-6 lg:px-8">
        <PageTitle
          title="Élèves"
          description="Annuaire et statut de paiement"
          action={
            <Link
              to={"/admin/students/new" as "/cashier"}
              style={{ backgroundImage: "var(--gradient-primary)" }}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-primary px-4 text-sm font-extrabold text-white shadow-[var(--shadow-elevated)] transition hover:-translate-y-0.5"
            >
              <UserPlus className="h-4 w-4" /> Nouvel élève
            </Link>
          }
        />

        {/* KPIs */}
        <section className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <MiniStat label="Total élèves" value={String(total)} bar="bg-primary" tint="bg-primary/10 text-primary" Icon={Users} />
          <MiniStat label="Impayés" value={String(unpaidCount)} bar="bg-tint-peach" tint="bg-tint-peach text-tint-peach-foreground" Icon={Sliders} />
          <MiniStat label="À jour" value={String(Math.max(total - unpaidCount, 0))} bar="bg-success" tint="bg-success/10 text-success" Icon={UserPlus} />
        </section>

        {/* Mobile search (md hidden : déjà dans la TopBar) */}
        <section className="mb-4 md:hidden">
          <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card px-3 py-2.5 shadow-[var(--shadow-card)]">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nom, prénom, matricule…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </section>

        {/* Mobile list */}
        <section className="space-y-3 lg:hidden">
          {items.map((s) => {
            const unpaid = unpaidByStudent.has(s.id);
            return (
              <div key={s.id} className="rounded-3xl border border-border/60 bg-card p-4 shadow-[var(--shadow-card)]">
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={s.photo_url ?? undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                      {initials(`${s.first_name} ${s.last_name}`)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-extrabold">{s.first_name} {s.last_name}</p>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[10px] font-semibold",
                          unpaid
                            ? "bg-tint-peach text-tint-peach-foreground"
                            : "bg-success/10 text-success",
                        )}
                      >
                        {unpaid ? "Impayé" : "À jour"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {s.class?.name ?? "—"} {s.matricule ? `· ${s.matricule}` : ""}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-end border-t border-border/60 pt-3 text-xs font-semibold text-primary">
                  <Link
                    to={"/cashier/collections" as "/cashier"}
                    className="inline-flex items-center gap-1 hover:underline"
                  >
                    Encaisser <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
          {studentsQ.isLoading && (
            <p className="text-center text-sm text-muted-foreground">Chargement…</p>
          )}
          {!studentsQ.isLoading && items.length === 0 && (
            <p className="rounded-3xl border border-border/60 bg-card p-5 text-center text-sm text-muted-foreground">
              Aucun élève trouvé.
            </p>
          )}
        </section>

        {/* Desktop table */}
        <section className="hidden overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[var(--shadow-card)] lg:block">
          <DataTable<Student>
            loading={studentsQ.isLoading}
            rows={items}
            rowKey={(s) => s.id}
            caption={<span>{items.length} élève{items.length > 1 ? "s" : ""}</span>}
            empty="Aucun élève trouvé."
            columns={[
              {
                key: "name",
                header: "Élève",
                cell: (s) => (
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={s.photo_url ?? undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                        {initials(`${s.first_name} ${s.last_name}`)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-bold">{s.first_name} {s.last_name}</span>
                  </div>
                ),
              },
              { key: "matricule", header: "Matricule", cell: (s) => <span className="font-mono text-xs">{s.matricule ?? "—"}</span> },
              { key: "class", header: "Classe", cell: (s) => s.class?.name ?? "—" },
              { key: "school", header: "École", cell: (s) => s.school?.name ?? "—" },
              {
                key: "status",
                header: "Statut",
                cell: (s) => {
                  const unpaid = unpaidByStudent.has(s.id);
                  return (
                    <span className={cn(
                      "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                      unpaid ? "bg-tint-peach text-tint-peach-foreground" : "bg-success/10 text-success",
                    )}>
                      {unpaid ? "Impayé" : "À jour"}
                    </span>
                  );
                },
              },
              {
                key: "actions",
                header: "",
                headerClassName: "text-right",
                className: "text-right",
                cell: () => (
                  <Link to={"/cashier/collections" as "/cashier"} className="text-xs font-semibold text-primary hover:underline">
                    Encaisser →
                  </Link>
                ),
              },
            ] as DataTableColumn<Student>[]}
          />
        </section>
      </main>
    </CashierShell>
  );
}

function MiniStat({
  label, value, bar, tint, Icon,
}: { label: string; value: string; bar: string; tint: string; Icon: typeof Users }) {
  return (
    <div className="relative flex items-center gap-3 overflow-hidden rounded-3xl border border-border/60 bg-card p-4 shadow-[var(--shadow-card)]">
      <span className={cn("absolute left-0 top-0 h-full w-1.5", bar)} />
      <span className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", tint)}>
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-[11px] font-semibold uppercase text-muted-foreground">{label}</p>
        <p className="text-2xl font-black leading-none">{value}</p>
      </div>
    </div>
  );
}
