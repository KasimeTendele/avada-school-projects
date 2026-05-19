import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { LuSearch as Search, LuX as X, LuGraduationCap as GraduationCap, LuMapPin as MapPin, LuUsers as UsersIcon, LuFileText as FileText, LuWallet as Wallet, LuCreditCard as CreditCard } from "react-icons/lu";
import { ParentShell } from "@/components/ParentShell";
import { PageHeader } from "@/components/PageHeader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { formatNumber, initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/children")({
  head: () => ({
    meta: [
      { title: "Mes enfants — Avada School" },
      { name: "description", content: "Consultez les fiches et le suivi des frais de vos enfants." },
    ],
  }),
  component: ChildrenPage,
});

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  matricule?: string | null;
  birth_date?: string | null;
  gender?: string | null;
  enrollment_date?: string | null;
  relationship?: string | null;
  avatar_url?: string | null;
  school?: { id?: string; name?: string; city?: string } | null;
  class?: { id?: string; name?: string; level?: string; academic_year?: string } | null;
}

interface FeeItem {
  fee_id: string;
  label: string;
  amount: number;
  paid: number;
  remaining: number;
  currency: string;
  student: { id: string; first_name: string; last_name: string };
}

function ChildrenPage() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");

  const students = useQuery({
    queryKey: ["students-by-parent"],
    queryFn: () => apiFetch<{ items: Student[] }>("/students-by-parent"),
  });
  const fees = useQuery({
    queryKey: ["fees-by-parent"],
    queryFn: () => apiFetch<{ items: FeeItem[] }>("/fees-by-parent"),
  });

  const items = students.data?.items ?? [];
  const feeItems = fees.data?.items ?? [];

  const totalsFor = (sid: string) => {
    const list = feeItems.filter((f) => f.student.id === sid);
    return {
      total: list.reduce((s, f) => s + Number(f.amount || 0), 0),
      paid: list.reduce((s, f) => s + Number(f.paid || 0), 0),
      remaining: list.reduce((s, f) => s + Number(f.remaining || 0), 0),
      currency: list[0]?.currency ?? "CDF",
      list,
    };
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((s) =>
      `${s.first_name} ${s.last_name}`.toLowerCase().includes(q),
    );
  }, [items, search]);

  const opened = items.find((s) => s.id === openId) || null;
  const openedTotals = opened ? totalsFor(opened.id) : null;

  return (
    <ParentShell>
      <PageHeader
        title="Mes enfants"
        subtitle="Consultez les fiches et le suivi des frais de vos enfants."
        actionIcon={<Search className="h-4 w-4" />}
        onAction={() => setSearchOpen((v) => !v)}
        actionLabel="Rechercher"
      />

      {searchOpen && (
        <section className="px-5 pt-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un enfant…"
              className="h-12 rounded-2xl border-0 bg-secondary pl-11 text-sm"
            />
          </div>
        </section>
      )}

      {/* Accès rapides */}
      {items.length > 0 && (
        <section className="px-5 pt-4">
          <div className="rounded-3xl bg-card p-5 shadow-[var(--shadow-card)]">
            <h2 className="mb-4 text-base font-extrabold">Accès rapides</h2>
            <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-hide">
              {items.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setOpenId(s.id)}
                  className="flex w-[72px] shrink-0 flex-col items-center gap-2"
                >
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={s.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-accent text-accent-foreground text-base font-extrabold">
                      {initials(`${s.first_name} ${s.last_name}`)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="line-clamp-2 text-center text-xs font-extrabold leading-tight">
                    {s.first_name}<br />
                    <span className="font-extrabold">{s.last_name}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Cartes enfants */}
      <section className="px-5 pt-4 pb-6">
        {students.isLoading && (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        )}
        {!students.isLoading && filtered.length === 0 && (
          <p className="rounded-2xl bg-card p-5 text-sm text-muted-foreground shadow-[var(--shadow-card)]">
            Aucun enfant trouvé.
          </p>
        )}

        <div className="space-y-4">
          {filtered.map((s) => {
            const t = totalsFor(s.id);
            return (
              <div
                key={s.id}
                className="rounded-3xl bg-card p-4 shadow-[var(--shadow-card)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={s.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-accent text-accent-foreground font-extrabold">
                        {initials(`${s.first_name} ${s.last_name}`)}
                      </AvatarFallback>
                    </Avatar>
                    <p className="truncate text-base font-extrabold">
                      {s.first_name} {s.last_name}
                    </p>
                  </div>
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground">
                    Actif
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4">
                  <InfoCol icon={<GraduationCap className="h-4 w-4" />} label={s.school?.name ?? "—"} />
                  <InfoCol icon={<MapPin className="h-4 w-4" />} label={s.school?.city ?? "—"} />
                  <InfoCol icon={<UsersIcon className="h-4 w-4" />} label={s.class?.name ?? "—"} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-secondary/60 p-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-tint-mint text-tint-mint-foreground">
                      <Wallet className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted-foreground">Déjà payé</p>
                      <p className="truncate text-sm font-extrabold text-tint-mint-foreground">
                        {formatNumber(t.paid)} {t.currency}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-primary">
                      <CreditCard className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted-foreground">Reste à payer</p>
                      <p className="truncate text-sm font-extrabold text-primary">
                        {formatNumber(t.remaining)} {t.currency}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setOpenId(s.id)}
                  className="mt-3 flex w-full items-center justify-end gap-1 text-sm font-extrabold text-primary"
                >
                  Voir les détails
                  <span className="text-base">›</span>
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Sheet fiche enfant */}
      <Sheet open={!!opened} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent
          side="bottom"
          className="max-h-[88vh] overflow-y-auto rounded-t-[2rem] p-0"
        >
          {opened && openedTotals && (
            <div className="px-5 pt-2 pb-8">
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-border" />
              <div className="flex items-center justify-end">
                <button
                  onClick={() => setOpenId(null)}
                  className="flex items-center gap-1 text-sm font-semibold text-muted-foreground"
                >
                  <X className="h-4 w-4" /> Fermer
                </button>
              </div>

              <div className="mt-2 flex flex-col items-center text-center">
                <Avatar className="h-24 w-24 border-4 border-accent">
                  <AvatarImage src={opened.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-accent text-accent-foreground text-2xl font-extrabold">
                    {initials(`${opened.first_name} ${opened.last_name}`)}
                  </AvatarFallback>
                </Avatar>
                <h2 className="mt-3 text-xl font-extrabold">
                  {opened.first_name} {opened.last_name}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {opened.birth_date ? `Né(e) le ${opened.birth_date}` : "Âge non renseigné"}
                </p>
              </div>

              <div className="mt-5">
                <h3 className="mb-3 text-base font-extrabold">Informations générales</h3>
                <div className="space-y-1 rounded-3xl bg-card p-2 shadow-[var(--shadow-card)]">
                  <InfoRow icon={<GraduationCap className="h-4 w-4" />} label="École" value={opened.school?.name ?? "—"} />
                  <Divider />
                  <InfoRow icon={<MapPin className="h-4 w-4" />} label="Ville" value={opened.school?.city ?? "—"} />
                  <Divider />
                  <InfoRow icon={<UsersIcon className="h-4 w-4" />} label="Classe" value={opened.class?.name ?? "—"} />
                </div>
              </div>

              <div className="mt-5">
                <h3 className="mb-3 text-base font-extrabold">Situation financière</h3>
                <div className="space-y-1 rounded-3xl bg-card p-2 shadow-[var(--shadow-card)]">
                  <InfoRow
                    icon={<FileText className="h-4 w-4" />}
                    label="Total des frais"
                    value={`${formatNumber(openedTotals.total)} ${openedTotals.currency}`}
                  />
                  <Divider />
                  <InfoRow
                    icon={<Wallet className="h-4 w-4" />}
                    label="Déjà payé"
                    value={`${formatNumber(openedTotals.paid)} ${openedTotals.currency}`}
                    valueClass="text-tint-mint-foreground"
                  />
                  <Divider />
                  <InfoRow
                    icon={<CreditCard className="h-4 w-4" />}
                    label="Reste à payer"
                    value={`${formatNumber(openedTotals.remaining)} ${openedTotals.currency}`}
                    valueClass="text-primary"
                  />
                </div>
              </div>

              {openedTotals.list.length > 0 && (
                <div className="mt-5">
                  <h3 className="mb-3 text-base font-extrabold">Frais associés</h3>
                  <div className="space-y-2">
                    {openedTotals.list.map((f) => (
                      <div key={f.fee_id} className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
                        <div className="flex items-center justify-between">
                          <p className="truncate pr-2 text-sm font-extrabold">{f.label}</p>
                          <p className="shrink-0 text-sm font-extrabold text-primary">
                            {formatNumber(f.remaining)} {f.currency}
                          </p>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Total {formatNumber(f.amount)} · payé {formatNumber(f.paid)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Link to="/payments" onClick={() => setOpenId(null)} className="mt-6 block">
                <Button className="h-12 w-full rounded-2xl bg-[image:var(--gradient-primary)] text-sm font-extrabold text-primary-foreground">
                  Payer un frais
                </Button>
              </Link>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </ParentShell>
  );
}

function InfoCol({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <span className="text-primary">{icon}</span>
      <span className="line-clamp-2 text-[11px] font-medium leading-tight text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function InfoRow({
  icon, label, value, valueClass,
}: { icon: React.ReactNode; label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl px-3 py-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-primary">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className={cn("truncate text-sm font-extrabold text-foreground", valueClass)}>{value}</p>
      </div>
    </div>
  );
}

function Divider() {
  return <div className="mx-3 h-px bg-border" />;
}
