import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { LuImage as ImageIcon, LuLoader as Loader, LuUserRound as UserIcon, LuArrowLeft } from "react-icons/lu";
import { AdminShell } from "@/components/AdminShell";
import { AdminHero } from "@/components/AdminHero";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { uploadPublicFile } from "@/lib/upload";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/admin/students/new")({
  head: () => ({ meta: [{ title: "Nouvel élève — Administration" }] }),
  component: NewStudentPage,
});

interface Section { id: string; name: string }
interface Option { id: string; name: string; section_id: string }
interface ClassRow { id: string; name: string; level: string | null; academic_year: string | null }

function NewStudentPage() {
  const navigate = useNavigate();
  const { profile, roles, user, loading: authLoading } = useAuth();
  const isSuper = roles.includes("super_admin");
  const isAdmin = roles.includes("admin");

  const adminSchoolQ = useQuery({
    queryKey: ["admin-school-of", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_schools")
        .select("school_id")
        .eq("user_id", user!.id)
        .limit(1)
        .maybeSingle();
      return data?.school_id ?? null;
    },
    enabled: !!user?.id && (isAdmin || isSuper) && !profile?.primary_school_id,
  });

  // Pour super admin sans école : sélecteur d'école
  const allSchoolsQ = useQuery({
    queryKey: ["all-schools-for-new-student"],
    queryFn: async () => {
      const { data, error } = await supabase.from("schools").select("id, name").order("name");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
    enabled: isSuper,
  });

  const [pickedSchoolId, setPickedSchoolId] = useState<string>("");
  const schoolId = profile?.primary_school_id ?? adminSchoolQ.data ?? (isSuper ? pickedSchoolId || null : null);


  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [postName, setPostName] = useState("");
  const [matricule, setMatricule] = useState("");
  const [gender, setGender] = useState<"M" | "F" | "">("");
  const [birthDate, setBirthDate] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
  const [physicalAddress, setPhysicalAddress] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [optionId, setOptionId] = useState("");
  const [classId, setClassId] = useState("");
  const [enrollmentDate, setEnrollmentDate] = useState(new Date().toISOString().slice(0, 10));

  const sectionsQ = useQuery({
    queryKey: ["sections", schoolId],
    queryFn: async () => {
      const res = await apiFetch<{ items: Section[] }>(`/sections?schoolId=${schoolId}&limit=100`);
      return res.items ?? [];
    },
    enabled: !!schoolId,
  });
  const optionsQ = useQuery({
    queryKey: ["options", schoolId, sectionId],
    queryFn: async () => {
      const { data, error } = await supabase.from("options").select("id, name, section_id").eq("school_id", schoolId!).eq("section_id", sectionId).order("name");
      if (error) throw error;
      return (data ?? []) as Option[];
    },
    enabled: !!schoolId && !!sectionId,
  });
  const classesQ = useQuery({
    queryKey: ["classes", schoolId],
    queryFn: async () => {
      const res = await apiFetch<{ items: ClassRow[] }>(`/classes?schoolId=${schoolId}&limit=100`);
      return res.items ?? [];
    },
    enabled: !!schoolId,
  });

  useEffect(() => { setOptionId(""); }, [sectionId]);

  const createMut = useMutation({
    mutationFn: () =>
      apiFetch<{ id: string }>("/students", {
        method: "POST",
        body: JSON.stringify({
          school_id: schoolId,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          post_name: postName.trim() || undefined,
          matricule: matricule.trim() || undefined,
          gender: gender || undefined,
          birth_date: birthDate || undefined,
          birth_place: birthPlace.trim() || undefined,
          physical_address: physicalAddress.trim() || undefined,
          photo_url: photoUrl || undefined,
          section_id: sectionId || undefined,
          option_id: optionId || undefined,
          class_id: classId || undefined,
          enrollment_date: enrollmentDate || undefined,
        }),
      }),
    onSuccess: () => {
      toast.success("Élève créé");
      navigate({ to: "/admin/students" });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const canSubmit = firstName.trim() && lastName.trim() && schoolId;

  // Attendre la résolution de l'auth avant de juger l'absence d'école
  if (authLoading) {
    return (
      <AdminShell>
        <AdminHero title="Nouvel élève" subtitle="Chargement…" backTo="/admin/students" className="rounded-b-[2rem]" />
      </AdminShell>
    );
  }

  if (!schoolId && !isSuper) {
    if (adminSchoolQ.isLoading) {
      return (
        <AdminShell>
          <AdminHero title="Nouvel élève" subtitle="Chargement…" backTo="/admin/students" className="rounded-b-[2rem]" />
        </AdminShell>
      );
    }
    return (
      <AdminShell>
        <AdminHero title="Nouvel élève" subtitle="Aucune école associée à votre compte" backTo="/admin/students" className="rounded-b-[2rem]" />
        <div className="px-4 py-6">
          <p className="rounded-3xl bg-card p-6 text-center text-sm text-muted-foreground shadow-[var(--shadow-card)]">
            Aucune école n'est associée à votre compte. Veuillez contacter un super administrateur pour vous affecter à une école avant de créer des élèves.
          </p>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <AdminHero title="Nouvel élève" subtitle="Identité, scolarité et coordonnées" backTo="/admin/students" className="rounded-b-[2rem]" />

      <form
        onSubmit={(e) => { e.preventDefault(); if (canSubmit) createMut.mutate(); }}
        className="space-y-5 px-4 py-5"
      >
        {isSuper && !profile?.primary_school_id && !adminSchoolQ.data && (
          <Section title="École">
            <Field label="Sélectionner une école *">
              <select value={pickedSchoolId} onChange={(e) => setPickedSchoolId(e.target.value)} className={inputCls} required>
                <option value="">— Choisir —</option>
                {allSchoolsQ.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          </Section>
        )}

        <Section title="Photo">

          <PhotoUpload value={photoUrl} onChange={setPhotoUrl} />
        </Section>

        <Section title="Identité">
          <Field label="Prénom *">
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required className={inputCls} />
          </Field>
          <Field label="Nom *">
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} required className={inputCls} />
          </Field>
          <Field label="Postnom">
            <input value={postName} onChange={(e) => setPostName(e.target.value)} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sexe">
              <select value={gender} onChange={(e) => setGender(e.target.value as "M" | "F" | "")} className={inputCls}>
                <option value="">—</option>
                <option value="M">Masculin</option>
                <option value="F">Féminin</option>
              </select>
            </Field>
            <Field label="Matricule">
              <input value={matricule} onChange={(e) => setMatricule(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date de naissance">
              <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Lieu de naissance">
              <input value={birthPlace} onChange={(e) => setBirthPlace(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <Field label="Adresse physique">
            <textarea value={physicalAddress} onChange={(e) => setPhysicalAddress(e.target.value)} rows={2} className={inputCls} />
          </Field>
        </Section>

        <Section title="Scolarité">
          <Field label="Section">
            <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className={inputCls}>
              <option value="">— Aucune —</option>
              {sectionsQ.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {sectionsQ.data?.length === 0 && (
              <p className="mt-1 text-[11px] text-muted-foreground">Aucune section configurée pour votre école.</p>
            )}
          </Field>
          {sectionId && (
            <Field label="Option">
              <select value={optionId} onChange={(e) => setOptionId(e.target.value)} className={inputCls}>
                <option value="">— Aucune —</option>
                {optionsQ.data?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Classe">
            <select value={classId} onChange={(e) => setClassId(e.target.value)} className={inputCls}>
              <option value="">— Aucune —</option>
              {classesQ.data?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.level ? ` · ${c.level}` : ""}{c.academic_year ? ` (${c.academic_year})` : ""}</option>
              ))}
            </select>
          </Field>
          <Field label="Date d'inscription">
            <input type="date" value={enrollmentDate} onChange={(e) => setEnrollmentDate(e.target.value)} className={inputCls} />
          </Field>
        </Section>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate({ to: "/admin/students" })}
            className="flex-1 rounded-3xl border border-border bg-card py-3.5 text-sm font-bold"
          >
            <LuArrowLeft className="inline h-4 w-4 mr-1" /> Annuler
          </button>
          <button
            type="submit"
            disabled={!canSubmit || createMut.isPending}
            className="flex-1 rounded-3xl bg-primary py-3.5 text-sm font-extrabold text-primary-foreground disabled:opacity-50"
          >
            {createMut.isPending ? "Création…" : "Créer l'élève"}
          </button>
        </div>
      </form>
    </AdminShell>
  );
}

const inputCls = "w-full rounded-2xl border border-input bg-card px-4 py-3 text-sm font-medium outline-none focus:border-primary";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function PhotoUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onPick = async (file: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Fichier trop volumineux (max 5 Mo)"); return; }
    setBusy(true);
    try {
      const url = await uploadPublicFile("student-photos", file, "student");
      onChange(url);
      toast.success("Photo téléversée");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-secondary/40 p-3">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-card">
        {value ? <img src={value} alt="Photo" className="h-full w-full object-cover" /> : <UserIcon className="h-7 w-7 text-muted-foreground" />}
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60">
          {busy ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
          {busy ? "Téléversement…" : value ? "Remplacer la photo" : "Ajouter une photo"}
        </button>
        {value && (
          <button type="button" onClick={() => onChange("")} className="text-xs font-semibold text-destructive">Retirer</button>
        )}
      </div>
    </div>
  );
}
