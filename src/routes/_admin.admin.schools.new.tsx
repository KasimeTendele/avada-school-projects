import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { LuArrowLeft as ArrowLeft, LuGraduationCap as GraduationCap, LuBuilding2 as Building2, LuScale as Scale, LuFileText as FileText, LuSun as Sun, LuCheck as Check, LuX as X, LuChevronRight as ChevronRight, LuPhone as Phone, LuMail as Mail, LuImage as ImageIcon, LuUser as User, LuLoader as Loader } from "react-icons/lu";
import { AdminShell } from "@/components/AdminShell";
import { apiFetch } from "@/lib/api";
import { uploadPublicFile } from "@/lib/upload";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_admin/admin/schools/new")({
  head: () => ({ meta: [{ title: "Nouvelle école — Administration" }] }),
  component: NewSchoolWizard,
});

const REGIMES = ["Public", "Privé conventionné", "Privé non conventionné", "Confessionnel"];
const MANAGEMENT_TYPES = ["Étatique", "Privée", "Conventionnée catholique", "Conventionnée protestante", "Conventionnée kimbanguiste", "Conventionnée islamique", "Autre"];
const LEVELS = ["Maternelle", "Primaire", "Secondaire 1er cycle", "Secondaire 2e cycle"];
const SECTIONS = ["Pédagogie", "Scientifique", "Commerciale", "Technique", "Professionnel"];
const VACATIONS = ["Matin", "Après-midi", "Plein temps", "Soir"];

interface FormState {
  name: string;
  sigle: string;
  matricule: string;
  epst_number: string;
  regime: string;
  management_type: string;
  classes: string[];
  sections: string[];
  vacation: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  logo_url: string;
  promoter_name: string;
  promoter_phone: string;
  approval_number: string;
  director_first_name: string;
  director_last_name: string;
  director_post_name: string;
  director_phone: string;
  director_email: string;
  director_photo_url: string;
}

function NewSchoolWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>({
    name: "", sigle: "", matricule: "", epst_number: "", regime: "", management_type: "",
    classes: [], sections: [], vacation: "",
    city: "", address: "", phone: "", email: "", logo_url: "",
    promoter_name: "", promoter_phone: "", approval_number: "",
    director_first_name: "", director_last_name: "", director_post_name: "",
    director_phone: "", director_email: "", director_photo_url: "",
  });
  const total = 7;

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toggle = (k: "classes" | "sections", v: string) =>
    setForm((f) => ({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] }));

  const hasSecondary = form.classes.some((l) => l.startsWith("Secondaire"));
  const sectionDisabled = (s: string) => s !== "Pédagogie" && !hasSecondary;

  const canNext = () => {
    if (step === 1) return form.name.trim().length > 0 && form.regime && form.classes.length > 0 && form.sections.length > 0 && form.vacation;
    if (step === 2) return true;
    if (step === 3) return true;
    if (step === 4) return true;
    if (step === 5) return form.promoter_name.trim().length > 0;
    if (step === 6) return true;
    return true;
  };

  const onSubmit = async () => {
    setSubmitting(true);
    try {
      await apiFetch("/admin-schools", { method: "POST", body: JSON.stringify(form) });
      toast.success("École créée");
      navigate({ to: "/admin/schools" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminShell>
      <header className="rounded-b-[2rem] bg-primary px-5 pt-8 pb-3 text-primary-foreground">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate({ to: "/admin/schools" })} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-extrabold">Écoles</h1>
        </div>
      </header>

      <section className="-mt-2 px-3 pb-24">
        <div className="rounded-3xl bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="mx-auto h-1 w-10 rounded-full bg-border" />

          <div className="mt-3 flex flex-col items-center text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-3xl bg-tint-sky text-tint-sky-foreground">
              <GraduationCap className="h-7 w-7" />
            </span>
            <h2 className="mt-3 text-xl font-extrabold">Nouvelle école</h2>
            <p className="mt-2 text-xs text-muted-foreground">Étape {step} sur {total}</p>
            <p className="text-base font-extrabold">{stepTitle(step)}</p>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-border">
              <div className="h-full bg-primary transition-all" style={{ width: `${(step / total) * 100}%` }} />
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {step === 1 && (
              <>
                <h3 className="text-base font-extrabold">Identification de l'école</h3>
                <Field label="Dénomination de l'école *">
                  <Input icon={<GraduationCap className="h-4 w-4" />} placeholder="Ex: Complexe Scolaire Lumière" value={form.name} onChange={(v) => update("name", v)} />
                </Field>
                <Field label="Sigle / acronyme">
                  <Input icon={<span className="font-bold text-muted-foreground">A</span>} placeholder="Ex: CSL" value={form.sigle} onChange={(v) => update("sigle", v)} />
                </Field>
                <Field label="Matricule de l'école">
                  <Input icon={<FileText className="h-4 w-4" />} placeholder="Matricule officiel" value={form.matricule} onChange={(v) => update("matricule", v)} />
                </Field>
                <Field label="Numéro d'enregistrement (EPST)">
                  <Input icon={<FileText className="h-4 w-4" />} placeholder="Après agrément EPST" value={form.epst_number} onChange={(v) => update("epst_number", v)} />
                </Field>

                <SelectBox label="Régime de gestion *" icon={<Scale className="h-4 w-4" />} value={form.regime} placeholder="Choisir le régime" options={REGIMES} onChange={(v) => update("regime", v)} />
                <SelectBox label="Type de gestion" icon={<Scale className="h-4 w-4" />} value={form.management_type} placeholder="Choisir le type" options={MANAGEMENT_TYPES} onChange={(v) => update("management_type", v)} />

                <div>
                  <p className="mb-2 text-sm font-semibold">Niveaux d'enseignement * (au moins 1)</p>
                  <div className="grid grid-cols-2 gap-2">
                    {LEVELS.map((l) => (
                      <CheckChip key={l} label={l} checked={form.classes.includes(l)} onClick={() => toggle("classes", l)} />
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-semibold">Sections * (au moins 1)</p>
                  <div className="grid grid-cols-2 gap-2">
                    {SECTIONS.map((s) => (
                      <CheckChip key={s} label={s} checked={form.sections.includes(s)} disabled={sectionDisabled(s)} onClick={() => !sectionDisabled(s) && toggle("sections", s)} />
                    ))}
                  </div>
                </div>

                <SelectBox label="Type de vacation *" icon={<Sun className="h-4 w-4" />} value={form.vacation} placeholder="Choisir la vacation" options={VACATIONS} onChange={(v) => update("vacation", v)} />
              </>
            )}

            {step === 2 && (
              <>
                <h3 className="text-base font-extrabold">Localisation & Contact</h3>
                <Field label="Ville">
                  <Input icon={<Building2 className="h-4 w-4" />} placeholder="Ex: Kinshasa" value={form.city} onChange={(v) => update("city", v)} />
                </Field>
                <Field label="Adresse physique">
                  <Input icon={<Building2 className="h-4 w-4" />} placeholder="Quartier, avenue, n°" value={form.address} onChange={(v) => update("address", v)} />
                </Field>
                <Field label="Téléphone">
                  <Input icon={<Phone className="h-4 w-4" />} placeholder="+243…" value={form.phone} onChange={(v) => update("phone", v)} />
                </Field>
                <Field label="Email">
                  <Input icon={<Mail className="h-4 w-4" />} placeholder="contact@ecole.cd" value={form.email} onChange={(v) => update("email", v)} />
                </Field>
              </>
            )}

            {step === 3 && (
              <>
                <h3 className="text-base font-extrabold">Logo</h3>
                <PhotoUpload bucket="school-assets" label="Logo de l'école" value={form.logo_url} onChange={(v) => update("logo_url", v)} prefix="logo" />
              </>
            )}

            {step === 4 && (
              <>
                <h3 className="text-base font-extrabold">Documents</h3>
                <Field label="Numéro d'agrément">
                  <Input icon={<FileText className="h-4 w-4" />} placeholder="Numéro d'agrément" value={form.approval_number} onChange={(v) => update("approval_number", v)} />
                </Field>
              </>
            )}

            {step === 5 && (
              <>
                <h3 className="text-base font-extrabold">Promoteur</h3>
                <Field label="Nom du promoteur *">
                  <Input icon={<GraduationCap className="h-4 w-4" />} placeholder="Nom complet" value={form.promoter_name} onChange={(v) => update("promoter_name", v)} />
                </Field>
                <Field label="Téléphone du promoteur">
                  <Input icon={<Phone className="h-4 w-4" />} placeholder="+243…" value={form.promoter_phone} onChange={(v) => update("promoter_phone", v)} />
                </Field>
              </>
            )}

            {step === 6 && (
              <>
                <h3 className="text-base font-extrabold">Chef d'établissement</h3>
                <PhotoUpload bucket="staff-photos" label="Photo du chef d'établissement" value={form.director_photo_url} onChange={(v) => update("director_photo_url", v)} prefix="director" />
                <Field label="Prénom">
                  <Input icon={<User className="h-4 w-4" />} placeholder="Prénom" value={form.director_first_name} onChange={(v) => update("director_first_name", v)} />
                </Field>
                <Field label="Nom">
                  <Input icon={<User className="h-4 w-4" />} placeholder="Nom" value={form.director_last_name} onChange={(v) => update("director_last_name", v)} />
                </Field>
                <Field label="Postnom">
                  <Input icon={<User className="h-4 w-4" />} placeholder="Postnom" value={form.director_post_name} onChange={(v) => update("director_post_name", v)} />
                </Field>
                <Field label="Téléphone">
                  <Input icon={<Phone className="h-4 w-4" />} placeholder="+243…" value={form.director_phone} onChange={(v) => update("director_phone", v)} />
                </Field>
                <Field label="Email">
                  <Input icon={<Mail className="h-4 w-4" />} placeholder="email@ecole.cd" value={form.director_email} onChange={(v) => update("director_email", v)} />
                </Field>
              </>
            )}

            {step === 7 && (
              <>
                <h3 className="text-base font-extrabold">Récapitulatif</h3>
                <Recap label="Dénomination" value={form.name} />
                <Recap label="Sigle" value={form.sigle || "—"} />
                <Recap label="Matricule" value={form.matricule || "—"} />
                <Recap label="Régime" value={form.regime} />
                <Recap label="Type de gestion" value={form.management_type || "—"} />
                <Recap label="Classes" value={form.classes.join(", ")} />
                <Recap label="Sections" value={form.sections.join(", ")} />
                <Recap label="Vacation" value={form.vacation} />
                <Recap label="Ville" value={form.city || "—"} />
                <Recap label="Téléphone" value={form.phone || "—"} />
                <Recap label="Email" value={form.email || "—"} />
                <Recap label="Promoteur" value={form.promoter_name || "—"} />
                <Recap label="Direction" value={[form.director_first_name, form.director_last_name].filter(Boolean).join(" ") || "—"} />
              </>
            )}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              onClick={() => (step === 1 ? navigate({ to: "/admin/schools" }) : setStep((s) => s - 1))}
              className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3 text-sm font-bold text-primary"
            >
              <X className="h-4 w-4" /> {step === 1 ? "Annuler" : "Retour"}
            </button>
            {step < total ? (
              <button
                disabled={!canNext()}
                onClick={() => setStep((s) => s + 1)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-primary-foreground",
                  canNext() ? "bg-primary" : "bg-primary/50",
                )}
              >
                Suivant <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                disabled={submitting}
                onClick={onSubmit}
                className="flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
              >
                <Check className="h-4 w-4" /> {submitting ? "Création…" : "Créer l'école"}
              </button>
            )}
          </div>
        </div>
      </section>
    </AdminShell>
  );
}

function stepTitle(s: number) {
  return [
    "Identification de l'école",
    "Localisation & Contact",
    "Logo",
    "Documents",
    "Promoteur",
    "Chef d'établissement",
    "Validation",
  ][s - 1];
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold">{label}</p>
      {children}
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Input({ icon, value, onChange, placeholder }: { icon: React.ReactNode; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-border bg-secondary/40 px-4 py-3">
      <span className="text-muted-foreground">{icon}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
    </div>
  );
}

function SelectBox({ label, icon, value, placeholder, options, onChange }: {
  label: string; icon: React.ReactNode; value: string; placeholder: string; options: string[]; onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold">{label}</p>
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3">
        <span className="text-muted-foreground">{icon}</span>
        <div className="flex-1">
          <p className="text-[11px] text-muted-foreground">{label.replace(" *", "")}</p>
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-transparent text-sm font-bold outline-none"
          >
            <option value="" disabled>{placeholder}</option>
            {options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

function CheckChip({ label, checked, disabled, onClick }: { label: string; checked: boolean; disabled?: boolean; onClick: () => void }) {
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
      <span className={cn(
        "flex h-5 w-5 items-center justify-center rounded border",
        checked ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
      )}>
        {checked && <Check className="h-3.5 w-3.5" />}
      </span>
      <span className="font-semibold">{label}</span>
    </button>
  );
}

function Recap({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl bg-secondary/40 px-4 py-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-semibold">{value}</span>
    </div>
  );
}

function PhotoUpload({ bucket, label, value, onChange, prefix }: {
  bucket: "school-assets" | "staff-photos" | "student-photos" | "avatars";
  label: string;
  value: string;
  onChange: (url: string) => void;
  prefix: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onPick = async (file: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Fichier trop volumineux (max 5 Mo)");
      return;
    }
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
    <div>
      <p className="mb-1.5 text-sm font-semibold">{label}</p>
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-secondary/40 p-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-card">
          {value ? (
            <img src={value} alt={label} className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onPick(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"
          >
            {busy ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
            {busy ? "Téléversement…" : value ? "Remplacer" : "Choisir une image"}
          </button>
          {value && (
            <button type="button" onClick={() => onChange("")} className="text-xs font-semibold text-destructive">
              Retirer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
