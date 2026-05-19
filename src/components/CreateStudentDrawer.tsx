import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  LuArrowLeft,
  LuImage as ImageIcon,
  LuLoader as Loader,
  LuUserRound as UserIcon,
  LuX as X,
} from "react-icons/lu";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { uploadPublicFile } from "@/lib/upload";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SectionRow { id: string; name: string }
interface OptionRow { id: string; name: string; section_id: string }
interface ClassRow { id: string; name: string; level: string | null; academic_year: string | null }

export interface EditableStudent {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  post_name?: string | null;
  matricule?: string | null;
  gender?: string | null;
  birth_date?: string | null;
  birth_place?: string | null;
  physical_address?: string | null;
  photo_url?: string | null;
  section_id?: string | null;
  option_id?: string | null;
  class_id?: string | null;
  enrollment_date?: string | null;
  school_id?: string | null;
}

interface CreateStudentDrawerProps {
  onClose: () => void;
  onCreated: () => void;
  initialSchoolId?: string | null;
  student?: EditableStudent | null;
}

export function CreateStudentDrawer({ onClose, onCreated, initialSchoolId, student }: CreateStudentDrawerProps) {
  const isEdit = !!student;
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
    enabled: !!user?.id && (isAdmin || isSuper) && !profile?.primary_school_id && !initialSchoolId,
  });

  const allSchoolsQ = useQuery({
    queryKey: ["all-schools-for-new-student"],
    queryFn: async () => {
      const { data, error } = await supabase.from("schools").select("id, name").order("name");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
    enabled: isSuper,
  });

  const [pickedSchoolId, setPickedSchoolId] = useState("");
  const schoolId = student?.school_id ?? initialSchoolId ?? profile?.primary_school_id ?? adminSchoolQ.data ?? (isSuper ? pickedSchoolId || null : null);

  const [firstName, setFirstName] = useState(student?.first_name ?? "");
  const [lastName, setLastName] = useState(student?.last_name ?? "");
  const [postName, setPostName] = useState(student?.post_name ?? "");
  const [matricule, setMatricule] = useState(student?.matricule ?? "");
  const [gender, setGender] = useState<"M" | "F" | "">((student?.gender as "M" | "F" | undefined) ?? "");
  const [birthDate, setBirthDate] = useState(student?.birth_date ?? "");
  const [birthPlace, setBirthPlace] = useState(student?.birth_place ?? "");
  const [physicalAddress, setPhysicalAddress] = useState(student?.physical_address ?? "");
  const [photoUrl, setPhotoUrl] = useState(student?.photo_url ?? "");
  const [sectionId, setSectionId] = useState(student?.section_id ?? "");
  const [optionId, setOptionId] = useState(student?.option_id ?? "");
  const [classId, setClassId] = useState(student?.class_id ?? "");
  const [enrollmentDate, setEnrollmentDate] = useState(student?.enrollment_date ?? new Date().toISOString().slice(0, 10));

  const sectionsQ = useQuery({
    queryKey: ["sections", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from("sections").select("id, name").eq("school_id", schoolId!).order("name");
      if (error) throw error;
      return (data ?? []) as SectionRow[];
    },
    enabled: !!schoolId,
  });

  const optionsQ = useQuery({
    queryKey: ["options", schoolId, sectionId],
    queryFn: async () => {
      const { data, error } = await supabase.from("options").select("id, name, section_id").eq("school_id", schoolId!).eq("section_id", sectionId).order("name");
      if (error) throw error;
      return (data ?? []) as OptionRow[];
    },
    enabled: !!schoolId && !!sectionId,
  });

  const classesQ = useQuery({
    queryKey: ["classes", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("id, name, level, academic_year").eq("school_id", schoolId!).order("name");
      if (error) throw error;
      return (data ?? []) as ClassRow[];
    },
    enabled: !!schoolId,
  });

  const sectionInitRef = useRef(true);
  useEffect(() => {
    if (sectionInitRef.current) { sectionInitRef.current = false; return; }
    setOptionId("");
  }, [sectionId]);

  const createMut = useMutation({
    mutationFn: () =>
      apiFetch<{ id: string }>(isEdit ? `/students/${student!.id}` : "/students", {
        method: isEdit ? "PUT" : "POST",
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
      toast.success(isEdit ? "Élève mis à jour" : "Élève créé");
      onCreated();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const canSubmit = Boolean(firstName.trim() && lastName.trim() && schoolId);
  const showSchoolPicker = isSuper && !initialSchoolId && !profile?.primary_school_id && !adminSchoolQ.data;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/50" onClick={onClose}>
      <form
        onSubmit={(e) => { e.preventDefault(); if (canSubmit) createMut.mutate(); }}
        className="max-h-[92vh] w-full max-w-[480px] overflow-y-auto rounded-t-[2rem] bg-background p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-border" />
        <div className="mt-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-extrabold">
            <UserIcon className="h-5 w-5 text-primary" /> {isEdit ? "Modifier l'élève" : "Nouvel élève"}
          </h3>
          <button type="button" onClick={onClose} aria-label="Fermer">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <p className="mt-2 text-xs text-muted-foreground">Identité, scolarité et coordonnées de l'élève.</p>

        {authLoading || adminSchoolQ.isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Chargement…</p>
        ) : !schoolId && !isSuper ? (
          <p className="mt-5 rounded-3xl bg-card p-5 text-center text-sm text-muted-foreground shadow-[var(--shadow-card)]">
            Aucune école n'est associée à votre compte. Veuillez contacter un super administrateur.
          </p>
        ) : (
          <>
            {showSchoolPicker && (
              <SectionTitle>École</SectionTitle>
            )}
            {showSchoolPicker && (
              <Field label="Sélectionner une école *">
                <select value={pickedSchoolId} onChange={(e) => setPickedSchoolId(e.target.value)} className={inputCls} required>
                  <option value="">— Choisir —</option>
                  {allSchoolsQ.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
            )}

            <SectionTitle>Photo</SectionTitle>
            <PhotoUpload value={photoUrl} onChange={setPhotoUrl} />

            <SectionTitle>Identité</SectionTitle>
            <div className="space-y-2.5">
              <Field label="Prénom *">
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required className={inputCls} />
              </Field>
              <Field label="Nom *">
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} required className={inputCls} />
              </Field>
              <Field label="Postnom">
                <input value={postName} onChange={(e) => setPostName(e.target.value)} className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-2.5">
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
              <div className="grid grid-cols-2 gap-2.5">
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
            </div>

            <SectionTitle>Scolarité</SectionTitle>
            <div className="space-y-2.5">
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
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" onClick={onClose} className="flex items-center justify-center gap-2 rounded-3xl border border-border bg-card py-3.5 text-sm font-bold">
                <LuArrowLeft className="h-4 w-4" /> Annuler
              </button>
              <button
                type="submit"
                disabled={!canSubmit || createMut.isPending}
                className="rounded-3xl bg-primary py-3.5 text-sm font-extrabold text-primary-foreground disabled:opacity-50"
              >
                {createMut.isPending ? (isEdit ? "Mise à jour…" : "Création…") : (isEdit ? "Enregistrer" : "Créer l'élève")}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

const inputCls = "w-full rounded-2xl border border-input bg-card px-4 py-3 text-sm font-medium outline-none focus:border-primary";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="mt-5 mb-2 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">{children}</h4>;
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
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-card">
        {value ? <img src={value} alt="Photo" className="h-full w-full object-cover" /> : <UserIcon className="h-6 w-6 text-muted-foreground" />}
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60">
          {busy ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
          {busy ? "Téléversement…" : value ? "Remplacer" : "Ajouter une photo"}
        </button>
        {value && <button type="button" onClick={() => onChange("")} className="text-xs font-semibold text-destructive">Retirer</button>}
      </div>
    </div>
  );
}
