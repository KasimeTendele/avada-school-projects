import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { LuArrowLeft as ArrowLeft, LuImage as ImageIcon, LuLoader as Loader, LuCheck as Check, LuTrash2 as Trash2, LuGraduationCap as GraduationCap, LuBuilding2 as Building2, LuPhone as Phone, LuMail as Mail, LuUser as User, LuFileText as FileText, LuScale as Scale, LuSun as Sun } from "react-icons/lu";
import { toast } from "sonner";
import { AdminShell } from "@/components/AdminShell";
import { apiFetch } from "@/lib/api";
import { uploadPublicFile } from "@/lib/upload";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

const REGIMES = ["Public", "Privé conventionné", "Privé non conventionné", "Confessionnel"];
const MANAGEMENT_TYPES = ["Étatique", "Privée", "Conventionnée catholique", "Conventionnée protestante", "Conventionnée kimbanguiste", "Conventionnée islamique", "Autre"];
const LEVELS = ["Maternelle", "Primaire", "Secondaire 1er cycle", "Secondaire 2e cycle"];
const SECTIONS_OPTS = ["Pédagogie", "Scientifique", "Commerciale", "Technique", "Professionnel"];
const VACATIONS = ["Matin", "Après-midi", "Plein temps", "Soir"];

interface School {
  id: string;
  name: string;
  sigle?: string | null;
  matricule?: string | null;
  epst_number?: string | null;
  regime?: string | null;
  management_type?: string | null;
  levels?: string[] | null;
  sections?: string[] | null;
  vacation?: string | null;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logo_url?: string | null;
  promoter_name?: string | null;
  promoter_phone?: string | null;
  approval_number?: string | null;
  director_first_name?: string | null;
  director_last_name?: string | null;
  director_post_name?: string | null;
  director_phone?: string | null;
  director_email?: string | null;
  director_photo_url?: string | null;
  status?: string | null;
}

type Form = {
  name: string; sigle: string; matricule: string; epst_number: string;
  regime: string; management_type: string; levels: string[]; sections: string[]; vacation: string;
  city: string; address: string; phone: string; email: string; logo_url: string;
  promoter_name: string; promoter_phone: string; approval_number: string;
  director_first_name: string; director_last_name: string; director_post_name: string;
  director_phone: string; director_email: string; director_photo_url: string;
};

const EMPTY: Form = {
  name: "", sigle: "", matricule: "", epst_number: "",
  regime: "", management_type: "", levels: [], sections: [], vacation: "",
  city: "", address: "", phone: "", email: "", logo_url: "",
  promoter_name: "", promoter_phone: "", approval_number: "",
  director_first_name: "", director_last_name: "", director_post_name: "",
  director_phone: "", director_email: "", director_photo_url: "",
};

function fromSchool(s: School): Form {
  return {
    name: s.name ?? "", sigle: s.sigle ?? "", matricule: s.matricule ?? "", epst_number: s.epst_number ?? "",
    regime: s.regime ?? "", management_type: s.management_type ?? "",
    levels: s.levels ?? [], sections: s.sections ?? [], vacation: s.vacation ?? "",
    city: s.city ?? "", address: s.address ?? "", phone: s.phone ?? "", email: s.email ?? "", logo_url: s.logo_url ?? "",
    promoter_name: s.promoter_name ?? "", promoter_phone: s.promoter_phone ?? "", approval_number: s.approval_number ?? "",
    director_first_name: s.director_first_name ?? "", director_last_name: s.director_last_name ?? "", director_post_name: s.director_post_name ?? "",
    director_phone: s.director_phone ?? "", director_email: s.director_email ?? "", director_photo_url: s.director_photo_url ?? "",
  };
}

export const Route = createFileRoute("/_admin/admin/schools/$id")({
  head: () => ({ meta: [{ title: "École — Édition" }] }),
  component: SchoolEditPage,
});

function SchoolEditPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { roles } = useAuth();
  const isSuper = roles.includes("super_admin");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-school", id],
    queryFn: () => apiFetch<School>(`/admin-schools/${id}`),
  });

  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm(fromSchool(data));
  }, [data]);

  const update = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toggle = (k: "levels" | "sections", v: string) =>
    setForm((f) => ({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] }));
  const hasSecondary = form.levels.some((l) => l.startsWith("Secondaire"));
  const sectionDisabled = (s: string) => s !== "Pédagogie" && !hasSecondary;

  const onSave = async () => {
    if (!form.name.trim()) return toast.error("La dénomination est requise");
    setSaving(true);
    try {
      await apiFetch(`/admin-schools/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...form,
          sigle: form.sigle || null,
          matricule: form.matricule || null,
          epst_number: form.epst_number || null,
          management_type: form.management_type || null,
          city: form.city || null,
          address: form.address || null,
          phone: form.phone || null,
          email: form.email || null,
          logo_url: form.logo_url || null,
          promoter_name: form.promoter_name || null,
          promoter_phone: form.promoter_phone || null,
          approval_number: form.approval_number || null,
          director_first_name: form.director_first_name || null,
          director_last_name: form.director_last_name || null,
          director_post_name: form.director_post_name || null,
          director_phone: form.director_phone || null,
          director_email: form.director_email || null,
          director_photo_url: form.director_photo_url || null,
        }),
      });
      toast.success("École mise à jour");
      qc.invalidateQueries({ queryKey: ["admin-school", id] });
      qc.invalidateQueries({ queryKey: ["admin-schools"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <AdminShell>
        <div className="p-10 text-center text-sm text-muted-foreground">Chargement…</div>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <header className="rounded-b-[2rem] bg-primary px-5 pt-8 pb-5 text-primary-foreground">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate({ to: "/admin/schools" })} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-extrabold">{data?.name}</h1>
            {data?.city && <p className="text-xs opacity-80">{data.city}</p>}
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-2xl space-y-4 px-4 pt-5 pb-28">
        {!isSuper && (
          <div className="rounded-2xl bg-secondary/60 px-4 py-3 text-xs text-muted-foreground">
            Seul le super administrateur peut modifier les informations de l'école.
          </div>
        )}

        <Card title="Logo de l'école" subtitle="Affiché sur les rapports et reçus officiels.">
          <PhotoUpload bucket="school-assets" value={form.logo_url} onChange={(v) => update("logo_url", v)} prefix={`logo-${id}`} disabled={!isSuper} />
        </Card>

        <Card title="Identification">
          <Field label="Dénomination *"><Input icon={<GraduationCap className="h-4 w-4" />} value={form.name} onChange={(v) => update("name", v)} disabled={!isSuper} /></Field>
          <Field label="Sigle"><Input icon={<span className="font-bold text-muted-foreground">A</span>} value={form.sigle} onChange={(v) => update("sigle", v)} disabled={!isSuper} /></Field>
          <Field label="Matricule"><Input icon={<FileText className="h-4 w-4" />} value={form.matricule} onChange={(v) => update("matricule", v)} disabled={!isSuper} /></Field>
          <Field label="N° EPST"><Input icon={<FileText className="h-4 w-4" />} value={form.epst_number} onChange={(v) => update("epst_number", v)} disabled={!isSuper} /></Field>
          <SelectBox label="Régime" icon={<Scale className="h-4 w-4" />} value={form.regime} options={REGIMES} onChange={(v) => update("regime", v)} disabled={!isSuper} />
          <SelectBox label="Type de gestion" icon={<Scale className="h-4 w-4" />} value={form.management_type} options={MANAGEMENT_TYPES} onChange={(v) => update("management_type", v)} disabled={!isSuper} />
          <div>
            <p className="mb-2 text-sm font-semibold">Niveaux</p>
            <div className="grid grid-cols-2 gap-2">
              {LEVELS.map((l) => <Chip key={l} label={l} checked={form.levels.includes(l)} onClick={() => isSuper && toggle("levels", l)} disabled={!isSuper} />)}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Sections</p>
            <div className="grid grid-cols-2 gap-2">
              {SECTIONS_OPTS.map((s) => <Chip key={s} label={s} checked={form.sections.includes(s)} disabled={!isSuper || sectionDisabled(s)} onClick={() => isSuper && !sectionDisabled(s) && toggle("sections", s)} />)}
            </div>
          </div>
          <SelectBox label="Vacation" icon={<Sun className="h-4 w-4" />} value={form.vacation} options={VACATIONS} onChange={(v) => update("vacation", v)} disabled={!isSuper} />
        </Card>

        <Card title="Localisation & Contact">
          <Field label="Ville"><Input icon={<Building2 className="h-4 w-4" />} value={form.city} onChange={(v) => update("city", v)} disabled={!isSuper} /></Field>
          <Field label="Adresse"><Input icon={<Building2 className="h-4 w-4" />} value={form.address} onChange={(v) => update("address", v)} disabled={!isSuper} /></Field>
          <Field label="Téléphone"><Input icon={<Phone className="h-4 w-4" />} value={form.phone} onChange={(v) => update("phone", v)} disabled={!isSuper} /></Field>
          <Field label="Email"><Input icon={<Mail className="h-4 w-4" />} value={form.email} onChange={(v) => update("email", v)} disabled={!isSuper} /></Field>
        </Card>

        <Card title="Documents & Promoteur">
          <Field label="Numéro d'agrément"><Input icon={<FileText className="h-4 w-4" />} value={form.approval_number} onChange={(v) => update("approval_number", v)} disabled={!isSuper} /></Field>
          <Field label="Nom du promoteur"><Input icon={<User className="h-4 w-4" />} value={form.promoter_name} onChange={(v) => update("promoter_name", v)} disabled={!isSuper} /></Field>
          <Field label="Téléphone du promoteur"><Input icon={<Phone className="h-4 w-4" />} value={form.promoter_phone} onChange={(v) => update("promoter_phone", v)} disabled={!isSuper} /></Field>
        </Card>

        <Card title="Chef d'établissement">
          <PhotoUpload bucket="staff-photos" value={form.director_photo_url} onChange={(v) => update("director_photo_url", v)} prefix={`director-${id}`} disabled={!isSuper} />
          <Field label="Prénom"><Input icon={<User className="h-4 w-4" />} value={form.director_first_name} onChange={(v) => update("director_first_name", v)} disabled={!isSuper} /></Field>
          <Field label="Nom"><Input icon={<User className="h-4 w-4" />} value={form.director_last_name} onChange={(v) => update("director_last_name", v)} disabled={!isSuper} /></Field>
          <Field label="Postnom"><Input icon={<User className="h-4 w-4" />} value={form.director_post_name} onChange={(v) => update("director_post_name", v)} disabled={!isSuper} /></Field>
          <Field label="Téléphone"><Input icon={<Phone className="h-4 w-4" />} value={form.director_phone} onChange={(v) => update("director_phone", v)} disabled={!isSuper} /></Field>
          <Field label="Email"><Input icon={<Mail className="h-4 w-4" />} value={form.director_email} onChange={(v) => update("director_email", v)} disabled={!isSuper} /></Field>
        </Card>

        <div className="flex justify-end gap-2">
          <button
            onClick={() => data && setForm(fromSchool(data))}
            disabled={!isSuper || saving}
            className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" /> Annuler
          </button>
          <button
            disabled={!isSuper || saving}
            onClick={onSave}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            <Check className="h-4 w-4" /> {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </section>
    </AdminShell>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-card p-5 shadow-[var(--shadow-card)] space-y-4">
      <div>
        <h2 className="text-base font-extrabold">{title}</h2>
        {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold">{label}</p>
      {children}
    </div>
  );
}

function Input({ icon, value, onChange, disabled }: { icon: React.ReactNode; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2 rounded-2xl border border-border bg-secondary/40 px-4 py-3", disabled && "opacity-70")}>
      <span className="text-muted-foreground">{icon}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
    </div>
  );
}

function SelectBox({ label, icon, value, options, onChange, disabled }: { label: string; icon: React.ReactNode; value: string; options: string[]; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold">{label}</p>
      <div className={cn("flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3", disabled && "opacity-70")}>
        <span className="text-muted-foreground">{icon}</span>
        <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="w-full bg-transparent text-sm font-bold outline-none">
          <option value="">—</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    </div>
  );
}

function Chip({ label, checked, disabled, onClick }: { label: string; checked: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-2xl border px-3 py-3 text-left text-sm transition-colors",
        disabled ? "cursor-not-allowed border-border bg-secondary/40 text-muted-foreground/60" :
        checked ? "border-primary bg-accent text-primary" : "border-border bg-card text-foreground",
      )}
    >
      <span className={cn("flex h-5 w-5 items-center justify-center rounded border", checked ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}>
        {checked && <Check className="h-3.5 w-3.5" />}
      </span>
      <span className="font-semibold">{label}</span>
    </button>
  );
}

function PhotoUpload({ bucket, value, onChange, prefix, disabled }: { bucket: "school-assets" | "staff-photos"; value: string; onChange: (url: string) => void; prefix: string; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const onPick = async (file: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Fichier trop volumineux (max 5 Mo)");
    setBusy(true);
    try {
      const url = await uploadPublicFile(bucket, file, prefix);
      onChange(url);
      toast.success("Image téléversée");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-secondary/40 p-3">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-card">
        {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy || disabled} className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60">
          {busy ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
          {busy ? "Téléversement…" : value ? "Remplacer" : "Choisir une image"}
        </button>
        {value && !disabled && (
          <button type="button" onClick={() => onChange("")} className="text-xs font-semibold text-destructive">Retirer</button>
        )}
      </div>
    </div>
  );
}
