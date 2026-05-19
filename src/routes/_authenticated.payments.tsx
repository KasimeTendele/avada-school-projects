import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { LuSearch as Search, LuSlidersHorizontal as SlidersHorizontal, LuChevronRight as ChevronRight, LuArrowLeft as ArrowLeft, LuX as X, LuCheck as Check, LuSmartphone as Smartphone, LuCreditCard as CardIcon, LuWallet as Wallet, LuCalendar as Calendar, LuFileText as FileText, LuCreditCard as PaymentIcon, LuGraduationCap as GraduationCap, LuUsers as UsersIcon, LuArrowUpDown as ArrowUpDown, LuChevronDown as ChevronDown } from "react-icons/lu";
import { ParentShell } from "@/components/ParentShell";
import { PageHeader } from "@/components/PageHeader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { formatNumber, formatDate, initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/payments")({
  head: () => ({
    meta: [
      { title: "Payer des frais — Avada School" },
      { name: "description", content: "Sélectionnez les frais à régler pour chaque enfant." },
    ],
  }),
  component: PaymentsPage,
});

interface FeeItem {
  fee_id: string;
  label: string;
  fee_type: string;
  amount: number;
  paid: number;
  remaining: number;
  currency: string;
  due_date: string | null;
  student: { id: string; first_name: string; last_name: string };
}
interface Student {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string | null;
  school?: { name?: string } | null;
  class?: { name?: string } | null;
}

type Sort = "name-asc" | "name-desc" | "remaining-desc" | "remaining-asc";
type DueFilter = "all" | "with" | "without";
type MinAmount = 0 | 25000 | 50000 | 100000 | 200000;
type FeeCount = "any" | "min2" | "min3";

interface Filters {
  schoolId: string | null;
  classId: string | null;
  feeType: string | null;
  feeCount: FeeCount;
  minAmount: MinAmount;
  due: DueFilter;
  sort: Sort;
}

const DEFAULT_FILTERS: Filters = {
  schoolId: null,
  classId: null,
  feeType: null,
  feeCount: "any",
  minAmount: 0,
  due: "all",
  sort: "name-asc",
};

function PaymentsPage() {
  const qc = useQueryClient();
  const [step, setStep] = useState<"list" | "pay">("list");
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [sheetFeeId, setSheetFeeId] = useState<string | null>(null); // single fee to pay

  const fees = useQuery({
    queryKey: ["fees-by-parent"],
    queryFn: () => apiFetch<{ items: FeeItem[] }>("/fees-by-parent"),
  });
  const students = useQuery({
    queryKey: ["students-by-parent"],
    queryFn: () => apiFetch<{ items: Student[] }>("/students-by-parent"),
  });

  const allFees = fees.data?.items ?? [];
  const allStudents = students.data?.items ?? [];

  const feeTypes = useMemo(
    () => Array.from(new Set(allFees.map((f) => f.fee_type))).filter(Boolean),
    [allFees],
  );
  const classes = useMemo(
    () =>
      Array.from(
        new Set(
          allStudents
            .map((s) => s.class?.name)
            .filter((n): n is string => Boolean(n)),
        ),
      ),
    [allStudents],
  );
  const schools = useMemo(
    () =>
      Array.from(
        new Set(
          allStudents
            .map((s) => s.school?.name)
            .filter((n): n is string => Boolean(n)),
        ),
      ),
    [allStudents],
  );

  // Aggregate per student with applied filters
  const studentRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = allStudents.map((s) => {
      const list = allFees.filter((f) => {
        if (f.student.id !== s.id) return false;
        if (Number(f.remaining || 0) <= 0) return false;
        if (filters.feeType && f.fee_type !== filters.feeType) return false;
        if (filters.due === "with" && !f.due_date) return false;
        if (filters.due === "without" && f.due_date) return false;
        return true;
      });
      const remaining = list.reduce((acc, f) => acc + Number(f.remaining || 0), 0);
      const paid = list.reduce((acc, f) => acc + Number(f.paid || 0), 0);
      const currency = list[0]?.currency ?? "CDF";
      return { student: s, list, remaining, paid, currency };
    });

    rows = rows.filter((r) => {
      if (filters.classId && r.student.class?.name !== filters.classId) return false;
      if (filters.schoolId && r.student.school?.name !== filters.schoolId) return false;
      if (filters.feeCount === "min2" && r.list.length < 2) return false;
      if (filters.feeCount === "min3" && r.list.length < 3) return false;
      if (filters.minAmount > 0 && r.remaining < filters.minAmount) return false;
      // Garder les enfants même sans frais en attente — état vide affiché plus bas
      if (q) {
        const hay = `${r.student.first_name} ${r.student.last_name} ${r.list.map((f) => f.label).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    rows.sort((a, b) => {
      switch (filters.sort) {
        case "name-asc":
          return a.student.first_name.localeCompare(b.student.first_name);
        case "name-desc":
          return b.student.first_name.localeCompare(a.student.first_name);
        case "remaining-desc":
          return b.remaining - a.remaining;
        case "remaining-asc":
          return a.remaining - b.remaining;
      }
    });

    return rows;
  }, [allStudents, allFees, search, filters]);

  const totals = useMemo(() => {
    const totalRemaining = allFees.reduce((s, f) => s + Number(f.remaining || 0), 0);
    const totalChildren = allStudents.length;
    const totalToPay = allFees.filter((f) => Number(f.remaining || 0) > 0).length;
    const currency = allFees[0]?.currency ?? "FC";
    return { totalRemaining, totalChildren, totalToPay, currency };
  }, [allFees, allStudents]);

  const activeStudent = allStudents.find((s) => s.id === activeStudentId) || null;
  const activeRow = studentRows.find((r) => r.student.id === activeStudentId);
  const activeFees = activeRow?.list ?? [];
  const sheetFee = activeFees.find((f) => f.fee_id === sheetFeeId) || null;

  return (
    <ParentShell>
      {step === "list" && (
        <>
          <PageHeader
            title="Payer des frais"
            subtitle="Sélectionnez les frais à régler pour chaque enfant."
            actionIcon={<SlidersHorizontal className="h-4 w-4" />}
            onAction={() => setFiltersOpen(true)}
            actionLabel="Filtres"
            stats={[
              { value: String(totals.totalChildren), label: "Enfants" },
              { value: String(totals.totalToPay), label: "À payer" },
              {
                value: `${formatNumber(totals.totalRemaining)} ${totals.currency}`,
                label: "Reste dû",
              },
            ]}
          />

          {/* Search */}
          <section className="px-5 pt-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un enfant ou un type de frais…"
                className="h-12 rounded-2xl border-0 bg-secondary pl-11 text-sm placeholder:text-muted-foreground"
              />
            </div>
          </section>

          {/* List */}
          <section className="px-5 pt-4 pb-6">
            {(fees.isLoading || students.isLoading) && (
              <p className="text-sm text-muted-foreground">Chargement…</p>
            )}
            {!fees.isLoading && !students.isLoading && allStudents.length === 0 && (
              <p className="rounded-2xl bg-card p-5 text-sm text-muted-foreground shadow-[var(--shadow-card)]">
                Aucun enfant n'est encore lié à votre compte. Ajoutez un enfant depuis l'onglet Enfants.
              </p>
            )}
            {!fees.isLoading && allStudents.length > 0 && studentRows.length === 0 && (
              <p className="rounded-2xl bg-card p-5 text-sm text-muted-foreground shadow-[var(--shadow-card)]">
                Aucun résultat avec les filtres actuels.
              </p>
            )}

            <div className="space-y-3">
              {studentRows.map((r) => {
                const hasFees = r.list.length > 0;
                return (
                <button
                  key={r.student.id}
                  onClick={() => {
                    if (!hasFees) return;
                    setActiveStudentId(r.student.id);
                    setSheetFeeId(null);
                  }}
                  disabled={!hasFees}
                  className={cn(
                    "block w-full rounded-3xl bg-card p-4 text-left shadow-[var(--shadow-card)]",
                    !hasFees && "opacity-80 cursor-default",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={r.student.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-accent text-accent-foreground font-bold">
                        {initials(`${r.student.first_name} ${r.student.last_name}`)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-extrabold">
                        {r.student.first_name} {r.student.last_name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.student.school?.name ?? "—"}
                        {r.student.class?.name ? ` | ${r.student.class.name}` : ""}
                      </p>
                    </div>
                    <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-primary">
                      {r.list.length} frais
                    </span>
                    {hasFees && (
                      <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-secondary">
                        <ChevronRight className="h-4 w-4 text-primary" />
                      </span>
                    )}
                  </div>
                  <div className="mt-3 border-t border-border pt-3">
                    {hasFees ? (
                      <p className="flex items-center gap-2 text-sm font-extrabold text-primary">
                        <PaymentIcon className="h-4 w-4" />
                        Total restant : {formatNumber(r.remaining)} {r.currency}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Aucun frais à payer pour le moment.
                      </p>
                    )}
                  </div>
                </button>
                );
              })}
            </div>
          </section>

          {/* Student detail sheet (list of fees with progress) */}
          <Sheet open={!!activeStudent && !sheetFee} onOpenChange={(o) => !o && setActiveStudentId(null)}>
            <SheetContent
              side="bottom"
              className="max-h-[88vh] overflow-y-auto rounded-t-[2rem] p-0"
            >
              {activeStudent && activeRow && (
                <div className="px-5 pt-2 pb-8">
                  <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-border" />
                  <div className="flex items-center justify-end">
                    <button
                      onClick={() => setActiveStudentId(null)}
                      className="flex items-center gap-1 text-sm font-semibold text-primary"
                    >
                      <X className="h-4 w-4" /> Fermer
                    </button>
                  </div>
                  <div className="mt-2 flex flex-col items-center text-center">
                    <Avatar className="h-20 w-20 border-2 border-accent">
                      <AvatarImage src={activeStudent.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-accent text-accent-foreground text-xl font-extrabold">
                        {initials(`${activeStudent.first_name} ${activeStudent.last_name}`)}
                      </AvatarFallback>
                    </Avatar>
                    <h2 className="mt-3 text-xl font-extrabold">
                      {activeStudent.first_name} {activeStudent.last_name}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {activeStudent.school?.name ?? "—"}
                      {activeStudent.class?.name ? ` | ${activeStudent.class.name}` : ""}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Choisissez un frais à régler ci-dessous.
                    </p>
                  </div>

                  <div className="mt-5 space-y-3">
                    {activeFees.map((f) => {
                      const total = Number(f.amount || 0);
                      const paid = Number(f.paid || 0);
                      const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
                      return (
                        <button
                          key={f.fee_id}
                          onClick={() => setSheetFeeId(f.fee_id)}
                          className="w-full rounded-3xl bg-card p-4 text-left shadow-[var(--shadow-card)]"
                        >
                          <div className="flex items-start gap-3">
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-tint-mint text-tint-mint-foreground">
                              <FileText className="h-5 w-5" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-base font-extrabold">{f.label}</p>
                              <p className="text-xs text-muted-foreground">Reste à payer</p>
                              <p className="mt-1 text-lg font-extrabold text-primary">
                                {formatNumber(f.remaining)} {f.currency}
                              </p>
                            </div>
                            <ChevronRight className="mt-1 h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="mt-3 flex items-center gap-3">
                            <Progress value={pct} className="h-2 flex-1" />
                            <span className="text-xs font-semibold text-muted-foreground">
                              {pct}%
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-muted-foreground">
                              <Wallet className="h-3 w-3" /> Payé {formatNumber(paid)} {f.currency}
                            </span>
                            {f.due_date && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-muted-foreground">
                                <Calendar className="h-3 w-3" /> Échéance {formatDate(f.due_date)}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </SheetContent>
          </Sheet>

          {/* Filters sheet */}
          <FiltersSheet
            open={filtersOpen}
            onClose={() => setFiltersOpen(false)}
            filters={filters}
            onChange={setFilters}
            feeTypes={feeTypes}
            classes={classes}
            schools={schools}
          />

          {/* Trigger pay step from fee sheet */}
          <Sheet open={!!sheetFee} onOpenChange={(o) => !o && setSheetFeeId(null)}>
            <SheetContent
              side="bottom"
              className="max-h-[88vh] overflow-y-auto rounded-t-[2rem] p-0"
            >
              {sheetFee && activeStudent && (
                <FeeReadyToPay
                  fee={sheetFee}
                  student={activeStudent}
                  onCancel={() => setSheetFeeId(null)}
                  onContinue={() => {
                    setStep("pay");
                  }}
                />
              )}
            </SheetContent>
          </Sheet>
        </>
      )}

      {step === "pay" && activeStudent && sheetFee && (
        <PayView
          student={activeStudent}
          fee={sheetFee}
          onBack={() => setStep("list")}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["fees-by-parent"] });
            qc.invalidateQueries({ queryKey: ["payments-mine-home"] });
            setStep("list");
            setActiveStudentId(null);
            setSheetFeeId(null);
          }}
        />
      )}
    </ParentShell>
  );
}

/* -------------------- Pre-pay confirmation sheet -------------------- */

function FeeReadyToPay({
  fee, student, onCancel, onContinue,
}: {
  fee: FeeItem;
  student: Student;
  onCancel: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="px-5 pt-2 pb-6">
      <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-border" />
      <div className="flex items-center justify-between">
        <h3 className="text-base font-extrabold">{fee.label}</h3>
        <button
          onClick={onCancel}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Pour {student.first_name} {student.last_name}
      </p>
      <div className="mt-4 rounded-2xl bg-ink p-5 text-ink-foreground">
        <p className="text-sm text-white/85">Reste à payer</p>
        <p className="mt-1 text-3xl font-extrabold">
          {formatNumber(fee.remaining)} <span className="text-xl">{fee.currency}</span>
        </p>
      </div>
      <Button
        onClick={onContinue}
        className="mt-5 h-12 w-full rounded-2xl bg-[image:var(--gradient-primary)] text-sm font-bold text-primary-foreground"
      >
        Continuer vers le paiement
      </Button>
    </div>
  );
}

/* -------------------- PAY VIEW -------------------- */

function PayView({
  student, fee, onBack, onSuccess,
}: {
  student: Student;
  fee: FeeItem;
  onBack: () => void;
  onSuccess: () => void;
}) {
  const [method, setMethod] = useState<"MOBILE_MONEY" | "CARD">("MOBILE_MONEY");
  const [provider, setProvider] = useState<"MTN" | "ORANGE" | "AIRTEL">("MTN");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState<number>(fee.remaining);
  const [loading, setLoading] = useState(false);

  const presets = useMemo(() => buildPresets(fee.remaining), [fee.remaining]);

  const handlePay = async () => {
    if (amount <= 0) {
      toast.error("Le montant doit être supérieur à 0.");
      return;
    }
    if (method === "MOBILE_MONEY" && phone.trim().length < 6) {
      toast.error("Numéro mobile money invalide.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<{ payment: { id: string }; receipt: { id: string } | null }>("/payments/initiate", {
        method: "POST",
        body: JSON.stringify({
          fee_id: fee.fee_id,
          student_id: student.id,
          amount,
          method: method === "MOBILE_MONEY" ? `MOBILE_MONEY_${provider}` : method,
          reference: method === "MOBILE_MONEY" ? phone : undefined,
        }),
      });
      toast.success("Paiement enregistré. Reçu disponible.");
      if (res?.receipt?.id) {
        window.location.href = `/receipts/${res.receipt.id}`;
        return;
      }
      onSuccess();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur lors du paiement.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <header className="bg-[image:var(--gradient-primary)] px-5 pt-8 pb-10 text-primary-foreground">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20"
            aria-label="Retour"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-lg font-extrabold">Payer des frais</h1>
          <span className="w-10" />
        </div>
      </header>

      <div className="-mt-6 rounded-t-[2rem] bg-background px-5 pt-4 pb-32">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-border" />
        <h2 className="text-center text-base font-extrabold">Paiement</h2>

        <div className="mt-4 rounded-3xl bg-ink px-5 py-5 text-ink-foreground shadow-[var(--shadow-elevated)]">
          <p className="text-sm text-white/85">Montant restant à payer</p>
          <p className="mt-2 text-3xl font-extrabold leading-tight">
            {formatNumber(fee.remaining)} <span className="text-2xl">{fee.currency}</span>
          </p>
        </div>

        <div className="mt-4 rounded-3xl bg-card p-5 shadow-[var(--shadow-card)]">
          <h3 className="mb-3 text-sm font-extrabold">Sélectionner le montant à payer</h3>
          <div className="grid grid-cols-4 gap-2">
            {presets.slice(0, 4).map((p) => (
              <PresetButton key={p} value={p} active={amount === p} onClick={() => setAmount(p)} />
            ))}
          </div>
          {presets[4] !== undefined && (
            <div className="mt-2">
              <PresetButton wide value={presets[4]} active={amount === presets[4]} onClick={() => setAmount(presets[4])} />
            </div>
          )}
          <div className="mt-2 flex items-center gap-2 rounded-2xl bg-secondary px-4 py-3">
            <span className="text-sm font-bold text-muted-foreground">{fee.currency}</span>
            <Input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="h-8 flex-1 border-0 bg-transparent p-0 text-base font-bold text-foreground shadow-none focus-visible:ring-0"
            />
          </div>
        </div>

        <div className="mt-4 rounded-3xl bg-card p-5 shadow-[var(--shadow-card)]">
          <h3 className="mb-3 text-sm font-extrabold">Sélectionner le mode de paiement</h3>
          <RadioGroup value={method} onValueChange={(v) => setMethod(v as typeof method)} className="space-y-3">
            <MethodOption value="MOBILE_MONEY" current={method} icon={<Smartphone className="h-5 w-5" />} label="Mobile Money" sub="Orange Money, M-Pesa, Airtel" />
            <MethodOption value="CARD" current={method} icon={<CardIcon className="h-5 w-5" />} label="Carte bancaire" sub="Visa, Mastercard" />
          </RadioGroup>

          {method === "MOBILE_MONEY" && (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {(["MTN", "ORANGE", "AIRTEL"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setProvider(p)}
                    className={cn(
                      "rounded-2xl border-2 px-3 py-2.5 text-xs font-bold transition-colors",
                      provider === p ? "border-primary bg-accent text-primary" : "border-border bg-card text-foreground",
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="msisdn" className="text-xs font-semibold">Numéro de téléphone</Label>
                <Input
                  id="msisdn"
                  type="tel"
                  placeholder="+243…"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-11 rounded-2xl border-border bg-secondary"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-20 left-1/2 z-20 w-full max-w-[480px] -translate-x-1/2 border-t border-border bg-card/95 px-5 py-3 backdrop-blur-sm">
        <Button
          onClick={handlePay}
          disabled={loading}
          className="h-12 w-full rounded-2xl bg-[image:var(--gradient-primary)] text-sm font-bold text-primary-foreground"
        >
          {loading ? "Traitement…" : `Payer ${formatNumber(amount)} ${fee.currency}`}
        </Button>
      </div>
    </>
  );
}

function MethodOption({ value, current, icon, label, sub }: {
  value: string; current: string; icon: React.ReactNode; label: string; sub: string;
}) {
  const active = value === current;
  return (
    <Label
      htmlFor={`m-${value}`}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-3 transition-colors",
        active ? "border-primary bg-accent/40" : "border-border bg-card",
      )}
    >
      <span className={cn(
        "flex h-11 w-11 items-center justify-center rounded-xl",
        active ? "bg-card text-primary" : "bg-secondary text-muted-foreground",
      )}>
        {icon}
      </span>
      <span className="flex-1">
        <span className={cn("block text-sm font-extrabold", active ? "text-primary" : "text-foreground")}>{label}</span>
        <span className="block text-[11px] text-muted-foreground">{sub}</span>
      </span>
      <span className={cn(
        "flex h-5 w-5 items-center justify-center rounded-full border-2",
        active ? "border-primary" : "border-border",
      )}>
        {active && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
      </span>
      <RadioGroupItem id={`m-${value}`} value={value} className="sr-only" />
    </Label>
  );
}

function PresetButton({ value, active, onClick, wide }: {
  value: number; active: boolean; onClick: () => void; wide?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-2xl px-2 py-3 text-sm font-bold transition-colors",
        wide ? "w-full" : "",
        active
          ? "bg-ink text-ink-foreground shadow-[var(--shadow-elevated)]"
          : "bg-secondary text-foreground hover:bg-accent",
      )}
    >
      {formatNumber(value)}
    </button>
  );
}

function buildPresets(total: number): number[] {
  const round = (n: number) => Math.max(1000, Math.round(n / 1000) * 1000);
  const base = [10000, 50000, total > 0 ? total : 100000, 100000, 200000];
  const seen = new Set<number>();
  return base
    .map(round)
    .filter((v) => {
      if (seen.has(v)) return false;
      seen.add(v);
      return true;
    });
}

/* -------------------- FILTERS SHEET -------------------- */

function FiltersSheet({
  open, onClose, filters, onChange, feeTypes, classes, schools,
}: {
  open: boolean;
  onClose: () => void;
  filters: Filters;
  onChange: (f: Filters) => void;
  feeTypes: string[];
  classes: string[];
  schools: string[];
}) {
  const [feeTypeOpen, setFeeTypeOpen] = useState(false);
  const update = <K extends keyof Filters>(k: K, v: Filters[K]) =>
    onChange({ ...filters, [k]: v });

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent
          side="bottom"
          className="max-h-[92vh] overflow-y-auto rounded-t-[2rem] p-0"
        >
          <div className="px-5 pt-2 pb-6">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-border" />

            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-primary">
                <SlidersHorizontal className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <h2 className="text-lg font-extrabold">Filtres &amp; tri</h2>
                <p className="text-xs text-muted-foreground">
                  Affinez la liste des enfants et des frais à régler.
                </p>
              </div>
            </div>

            {/* Tri */}
            <FilterSection icon={<ArrowUpDown className="h-4 w-4" />} title="Tri">
              <div className="flex flex-wrap gap-2">
                {([
                  ["name-asc", "Nom (A-Z)"],
                  ["name-desc", "Nom (Z-A)"],
                  ["remaining-desc", "Reste dû (↓)"],
                  ["remaining-asc", "Reste dû (↑)"],
                ] as const).map(([k, l]) => (
                  <Pill key={k} active={filters.sort === k} onClick={() => update("sort", k)} label={l} />
                ))}
              </div>
            </FilterSection>

            {/* Établissement */}
            <FilterSection icon={<GraduationCap className="h-4 w-4" />} title="Établissement">
              <SelectField
                label="École"
                value={filters.schoolId ?? "Toutes les écoles"}
                onClick={() => {
                  const idx = schools.indexOf(filters.schoolId ?? "");
                  const next = idx + 1 >= schools.length ? null : schools[idx + 1];
                  update("schoolId", next);
                }}
              />
            </FilterSection>

            {/* Classe */}
            <FilterSection icon={<UsersIcon className="h-4 w-4" />} title="Classe">
              <SelectField
                label="Classe"
                value={filters.classId ?? "Toutes les classes"}
                onClick={() => {
                  const idx = classes.indexOf(filters.classId ?? "");
                  const next = idx + 1 >= classes.length ? null : classes[idx + 1];
                  update("classId", next);
                }}
              />
            </FilterSection>

            {/* Type de frais */}
            <FilterSection icon={<FileText className="h-4 w-4" />} title="Type de frais">
              <SelectField
                label="Type de frais"
                value={filters.feeType ?? "Tous les types"}
                onClick={() => setFeeTypeOpen(true)}
              />
            </FilterSection>

            {/* Nb frais en attente */}
            <FilterSection
              icon={<FileText className="h-4 w-4" />}
              title="Nombre de frais en attente"
              flat
            >
              <div className="flex flex-wrap gap-2">
                <Pill active={filters.feeCount === "any"} onClick={() => update("feeCount", "any")} label="Peu importe" />
                <Pill active={filters.feeCount === "min2"} onClick={() => update("feeCount", "min2")} label="Au moins 2 frais" />
                <Pill active={filters.feeCount === "min3"} onClick={() => update("feeCount", "min3")} label="Au moins 3 frais" />
              </div>
            </FilterSection>

            {/* Montant minimum */}
            <FilterSection
              icon={<PaymentIcon className="h-4 w-4" />}
              title="Reste total minimum (par enfant)"
              flat
            >
              <div className="flex flex-wrap gap-2">
                {([0, 25000, 50000, 100000, 200000] as MinAmount[]).map((v) => (
                  <Pill
                    key={v}
                    active={filters.minAmount === v}
                    onClick={() => update("minAmount", v)}
                    label={v === 0 ? "Tous montants" : `≥ ${formatNumber(v)} FC`}
                  />
                ))}
              </div>
            </FilterSection>

            {/* Échéance */}
            <FilterSection icon={<Calendar className="h-4 w-4" />} title="Échéance" flat>
              <p className="mb-2 text-xs text-muted-foreground">
                Affiche les enfants ayant au moins un frais en attente qui correspond au critère
                (selon la date renseignée par l&apos;école).
              </p>
              <div className="flex flex-wrap gap-2">
                <Pill active={filters.due === "all"} onClick={() => update("due", "all")} label="Tous" />
                <Pill active={filters.due === "with"} onClick={() => update("due", "with")} label="Avec échéance" />
                <Pill active={filters.due === "without"} onClick={() => update("due", "without")} label="Sans échéance" />
              </div>
            </FilterSection>

            <div className="mt-6 flex gap-3">
              <Button
                variant="outline"
                onClick={() => onChange(DEFAULT_FILTERS)}
                className="h-12 flex-1 rounded-2xl border-border"
              >
                <X className="mr-1 h-4 w-4" /> Réinitialiser
              </Button>
              <Button
                onClick={onClose}
                className="h-12 flex-1 rounded-2xl bg-[image:var(--gradient-primary)] text-primary-foreground"
              >
                <Check className="mr-1 h-4 w-4" /> Appliquer
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Fee type picker (nested sheet) */}
      <Sheet open={feeTypeOpen} onOpenChange={setFeeTypeOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[80vh] overflow-y-auto rounded-t-[2rem] p-0"
        >
          <div className="px-5 pt-2 pb-6">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-border" />
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold">Type de frais</h3>
              <button
                onClick={() => setFeeTypeOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Rechercher…" className="h-11 rounded-2xl border-border bg-secondary pl-9" />
            </div>
            <div className="mt-3 space-y-1">
              <FeeTypeRow
                label="Tous les types"
                active={filters.feeType === null}
                onClick={() => {
                  update("feeType", null);
                  setFeeTypeOpen(false);
                }}
              />
              {feeTypes.map((t) => (
                <FeeTypeRow
                  key={t}
                  label={t}
                  active={filters.feeType === t}
                  onClick={() => {
                    update("feeType", t);
                    setFeeTypeOpen(false);
                  }}
                />
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function FilterSection({
  icon, title, children, flat,
}: { icon: React.ReactNode; title: string; children: React.ReactNode; flat?: boolean }) {
  return (
    <div className="mt-4 rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-foreground">{icon}</span>
        <h3 className="text-sm font-extrabold">{title}</h3>
      </div>
      <div className={flat ? "" : ""}>{children}</div>
    </div>
  );
}

function SelectField({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-left"
    >
      <span className="min-w-0">
        <span className="block text-[11px] text-muted-foreground">{label}</span>
        <span className="block truncate text-sm font-extrabold text-foreground">{value}</span>
      </span>
      <ChevronDown className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

function Pill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-2 text-xs font-extrabold transition-colors",
        active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
      )}
    >
      {label}
    </button>
  );
}

function FeeTypeRow({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-semibold transition-colors",
        active ? "bg-accent text-primary" : "bg-card text-foreground hover:bg-secondary",
      )}
    >
      <span>{label}</span>
      {active && <Check className="h-4 w-4 text-primary" />}
    </button>
  );
}
