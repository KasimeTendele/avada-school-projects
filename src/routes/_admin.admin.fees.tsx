import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LuPlus, LuLoader } from "react-icons/lu";
import { AdminShell } from "@/components/AdminShell";
import { AdminHero } from "@/components/AdminHero";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { formatNumber } from "@/lib/format";
import { FEE_CATEGORIES } from "@/lib/fee-categories";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/admin/fees")({
  head: () => ({ meta: [{ title: "Motifs de paiement — Administration" }] }),
  component: FeesPage,
});

interface FeeRow {
  id: string; label: string; fee_type: string; amount: number; currency: string;
  scope: "STUDENT" | "CLASS" | "SCHOOL"; due_date: string | null;
  academic_year: string | null;
  class?: { id: string; name: string } | null;
  student?: { id: string; first_name: string; last_name: string } | null;
}

function FeesPage() {
  const { profile, roles, user } = useAuth();
  const isAdmin = roles.includes("admin");
  const qc = useQueryClient();

  const adminSchoolQ = useQuery({
    queryKey: ["admin-school-of", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("admin_schools").select("school_id").eq("user_id", user!.id).limit(1).maybeSingle();
      return data?.school_id ?? null;
    },
    enabled: !!user?.id && isAdmin && !profile?.primary_school_id,
  });
  const schoolId = profile?.primary_school_id ?? adminSchoolQ.data ?? null;

  const feesQ = useQuery({
    enabled: !!schoolId,
    queryKey: ["fees-by-school", schoolId],
    queryFn: () => apiFetch<{ items: FeeRow[] }>(`/fees/by-school/${schoolId}`),
  });

  const [open, setOpen] = useState(false);

  return (
    <AdminShell>
      <AdminHero title="Motifs de paiement" subtitle="Gérez les frais à régler par les parents." backTo="/admin" className="rounded-b-[2rem]" />

      <section className="px-4 pt-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{feesQ.data?.items.length ?? 0} motif(s)</p>
          <Button onClick={() => setOpen(true)} className="rounded-full"><LuPlus className="mr-1 h-4 w-4" /> Nouveau motif</Button>
        </div>

        {/* Mobile cards */}
        <div className="mt-4 space-y-3 lg:hidden">
          {(feesQ.data?.items ?? []).map((f) => (
            <div key={f.id} className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
              <p className="text-xs font-bold uppercase text-primary">{f.fee_type}</p>
              <p className="text-base font-extrabold">{f.label}</p>
              <p className="text-sm">{formatNumber(f.amount)} {f.currency} · {f.scope}</p>
              <p className="text-xs text-muted-foreground">
                {f.scope === "CLASS" && f.class?.name}
                {f.scope === "STUDENT" && f.student && `${f.student.first_name} ${f.student.last_name}`}
                {f.due_date && ` · échéance ${new Date(f.due_date).toLocaleDateString("fr-FR")}`}
              </p>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="mt-4 hidden lg:block">
          <DataTable<FeeRow>
            rows={feesQ.data?.items ?? []}
            rowKey={(f) => f.id}
            columns={[
              { key: "fee_type", header: "Catégorie", cell: (f) => <span className="font-semibold text-primary">{f.fee_type}</span> },
              { key: "label", header: "Motif", cell: (f) => <span className="font-semibold">{f.label}</span> },
              { key: "amount", header: "Montant", cell: (f) => `${formatNumber(f.amount)} ${f.currency}` },
              { key: "scope", header: "Portée", cell: (f) => f.scope },
              { key: "target", header: "Cible", cell: (f) => f.scope === "CLASS" ? (f.class?.name ?? "—") : f.scope === "STUDENT" ? (f.student ? `${f.student.first_name} ${f.student.last_name}` : "—") : "Toute l'école" },
              { key: "due", header: "Échéance", cell: (f) => f.due_date ? new Date(f.due_date).toLocaleDateString("fr-FR") : "—" },
              { key: "year", header: "Année", cell: (f) => f.academic_year ?? "—" },
            ]}
          />
        </div>
      </section>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto">
          {schoolId && <NewFeeForm schoolId={schoolId} onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["fees-by-school", schoolId] }); }} />}
        </SheetContent>
      </Sheet>
    </AdminShell>
  );
}

function NewFeeForm({ schoolId, onDone }: { schoolId: string; onDone: () => void }) {
  const [category, setCategory] = useState<string>(FEE_CATEGORIES[0]);
  const [customCat, setCustomCat] = useState("");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [currency, setCurrency] = useState<"CDF" | "USD">("CDF");
  const [scope, setScope] = useState<"SCHOOL" | "CLASS" | "STUDENT">("SCHOOL");
  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [academicYear, setAcademicYear] = useState(`${new Date().getFullYear()}-${new Date().getFullYear() + 1}`);

  const isCustom = category === "__other__";
  const finalCategory = isCustom ? customCat.trim() : category;

  const classesQ = useQuery({
    queryKey: ["classes-pick", schoolId],
    queryFn: async () => {
      const { data } = await supabase.from("classes").select("id, name").eq("school_id", schoolId).order("name");
      return data ?? [];
    },
  });
  const studentsQ = useQuery({
    enabled: scope === "STUDENT",
    queryKey: ["students-pick", schoolId],
    queryFn: () => apiFetch<{ items: { id: string; first_name: string; last_name: string }[] }>(`/students?schoolId=${schoolId}&limit=500`),
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!finalCategory) throw new Error("Catégorie requise");
      if (!label.trim()) throw new Error("Motif requis");
      if (amount <= 0) throw new Error("Montant invalide");
      if (scope === "CLASS" && !classId) throw new Error("Classe requise");
      if (scope === "STUDENT" && !studentId) throw new Error("Élève requis");
      return apiFetch("/fees", {
        method: "POST",
        body: JSON.stringify({
          school_id: schoolId, scope, label: label.trim(), fee_type: finalCategory,
          amount, currency, due_date: dueDate || undefined, academic_year: academicYear || undefined,
          class_id: scope === "CLASS" ? classId : undefined,
          student_id: scope === "STUDENT" ? studentId : undefined,
        }),
      });
    },
    onSuccess: () => { toast.success("Motif créé"); onDone(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  return (
    <div className="space-y-4 py-4">
      <h2 className="text-lg font-extrabold">Nouveau motif de paiement</h2>

      <div className="space-y-1.5">
        <Label>Catégorie</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {FEE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            <SelectItem value="__other__">Autre (préciser)…</SelectItem>
          </SelectContent>
        </Select>
        {isCustom && <Input placeholder="Nom de la catégorie" value={customCat} onChange={(e) => setCustomCat(e.target.value)} />}
      </div>

      <div className="space-y-1.5">
        <Label>Motif (ex: Première tranche - 1er trimestre)</Label>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Montant</Label>
          <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        </div>
        <div className="space-y-1.5">
          <Label>Devise</Label>
          <Select value={currency} onValueChange={(v) => setCurrency(v as "CDF" | "USD")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="CDF">CDF</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Portée</Label>
        <Select value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="SCHOOL">Toute l'école</SelectItem>
            <SelectItem value="CLASS">Une classe</SelectItem>
            <SelectItem value="STUDENT">Un élève</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {scope === "CLASS" && (
        <div className="space-y-1.5">
          <Label>Classe</Label>
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
            <SelectContent>{(classesQ.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}
      {scope === "STUDENT" && (
        <div className="space-y-1.5">
          <Label>Élève</Label>
          <Select value={studentId} onValueChange={setStudentId}>
            <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
            <SelectContent>{(studentsQ.data?.items ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Échéance</Label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Année scolaire</Label>
          <Input value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} />
        </div>
      </div>

      <Button onClick={() => createMut.mutate()} disabled={createMut.isPending} className="w-full rounded-2xl">
        {createMut.isPending ? <LuLoader className="mr-2 h-4 w-4 animate-spin" /> : <LuPlus className="mr-1 h-4 w-4" />}
        Créer le motif
      </Button>
    </div>
  );
}
