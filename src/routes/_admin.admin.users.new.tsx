import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LuArrowLeft as ArrowLeft, LuMail as Mail, LuLock as Lock, LuUser as User, LuPhone as Phone, LuGraduationCap as GraduationCap, LuShieldCheck as ShieldCheck, LuEye as Eye, LuEyeOff as EyeOff, LuCalculator as Calculator, LuBuilding2 as Building2, LuBriefcase as Briefcase, LuFileText as FileText, LuImage as ImageIcon, LuLoader as Loader } from "react-icons/lu";
import { AdminShell } from "@/components/AdminShell";
import { apiFetch } from "@/lib/api";
import { uploadPublicFile } from "@/lib/upload";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

interface SchoolItem { id: string; name: string; city: string | null; }
interface SchoolsResp { items: SchoolItem[]; }

export const Route = createFileRoute("/_admin/admin/users/new")({
  head: () => ({ meta: [{ title: "Nouvel utilisateur — Administration" }] }),
  component: NewUserPage,
});

function NewUserPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { roles, profile } = useAuth();
  const isSuper = roles.includes("super_admin");

  const { data: schoolsResp } = useQuery({
    queryKey: ["admin-schools-min"],
    queryFn: () => apiFetch<SchoolsResp>("/admin-schools"),
    enabled: isSuper,
  });
  const schools = schoolsResp?.items ?? [];

  const [role, setRole] = useState<"admin" | "cashier">(isSuper ? "admin" : "cashier");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [postName, setPostName] = useState("");
  const [gender, setGender] = useState<"" | "M" | "F">("");
  const [matricule, setMatricule] = useState("");
  const [functionTitle, setFunctionTitle] = useState("");
  const [profAddress, setProfAddress] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [schoolId, setSchoolId] = useState<string>(isSuper ? "" : (profile?.primary_school_id ?? ""));

  const fullName = [firstName.trim(), postName.trim(), lastName.trim()].filter(Boolean).join(" ");

  const mutate = useMutation({
    mutationFn: () =>
      apiFetch("/admin-users", {
        method: "POST",
        body: JSON.stringify({
          role,
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          post_name: postName.trim() || null,
          gender: gender || null,
          full_name: fullName,
          email: email.trim(),
          phone: phone.trim() || null,
          password,
          school_id: schoolId,
          avatar_url: avatarUrl || null,
          employee_matricule: matricule.trim() || null,
          function_title: functionTitle.trim() || null,
          professional_address: profAddress.trim() || null,
        }),
      }),
    onSuccess: () => {
      toast.success("Compte créé avec succès");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      navigate({ to: "/admin/users" });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return toast.error("Prénom et nom requis");
    if (!email.trim()) return toast.error("Email requis");
    if (password.length < 8) return toast.error("Mot de passe : 8 caractères minimum");
    if (isSuper && !schoolId) return toast.error("Veuillez sélectionner une école");
    mutate.mutate();
  };

  return (
    <AdminShell>
      <header className="rounded-b-[2rem] bg-primary px-5 pt-8 pb-6 text-primary-foreground">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate({ to: "/admin/users" })}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15"
            aria-label="Retour"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-extrabold">Nouvel utilisateur</h1>
            <p className="text-sm text-white/85">
              {isSuper ? "Créer un compte admin école ou caissier" : "Créer un compte caissier pour votre école"}
            </p>
          </div>
        </div>
      </header>

      <form onSubmit={onSubmit} className="space-y-5 px-4 pt-5 pb-8">
        {isSuper && (
          <section>
            <p className="mb-2 flex items-center gap-2 text-sm font-extrabold">
              <ShieldCheck className="h-4 w-4 text-primary" /> Rôle
            </p>
            <div className="grid grid-cols-2 gap-3">
              <RoleCard active={role === "admin"} onClick={() => setRole("admin")} icon={<ShieldCheck className="h-5 w-5" />} label="Admin école" hint="Gère son école" />
              <RoleCard active={role === "cashier"} onClick={() => setRole("cashier")} icon={<Calculator className="h-5 w-5" />} label="Caissier" hint="Encaisse les paiements" />
            </div>
          </section>
        )}

        {isSuper ? (
          <section>
            <p className="mb-2 flex items-center gap-2 text-sm font-extrabold">
              <GraduationCap className="h-4 w-4 text-info" /> École assignée
            </p>
            <div className="rounded-2xl border border-input bg-card px-4 py-3 shadow-[var(--shadow-card)]">
              <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className="w-full bg-transparent text-sm font-bold outline-none" required>
                <option value="">— Sélectionner une école —</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}{s.city ? ` (${s.city})` : ""}</option>
                ))}
              </select>
            </div>
          </section>
        ) : (
          <section>
            <div className="rounded-2xl border border-input bg-tint-mint/40 px-4 py-3 text-xs text-muted-foreground">
              Ce {role === "admin" ? "compte" : "caissier"} sera affecté à votre école automatiquement.
            </div>
          </section>
        )}

        <section className="space-y-3">
          <p className="flex items-center gap-2 text-sm font-extrabold">
            <User className="h-4 w-4 text-primary" /> Identité
          </p>

          <PhotoUpload bucket="staff-photos" value={avatarUrl} onChange={setAvatarUrl} prefix="staff" />

          <div className="grid grid-cols-2 gap-3">
            <Field icon={<User className="h-5 w-5 text-muted-foreground" />}>
              <input required placeholder="Prénom *" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="flex-1 bg-transparent text-base outline-none" />
            </Field>
            <Field icon={<User className="h-5 w-5 text-muted-foreground" />}>
              <input required placeholder="Nom *" value={lastName} onChange={(e) => setLastName(e.target.value)} className="flex-1 bg-transparent text-base outline-none" />
            </Field>
          </div>
          <Field icon={<User className="h-5 w-5 text-muted-foreground" />}>
            <input placeholder="Postnom" value={postName} onChange={(e) => setPostName(e.target.value)} className="flex-1 bg-transparent text-base outline-none" />
          </Field>

          <div>
            <p className="mb-2 text-sm font-semibold">Sexe</p>
            <div className="grid grid-cols-2 gap-3">
              <GenderChip active={gender === "M"} onClick={() => setGender(gender === "M" ? "" : "M")} label="Masculin" />
              <GenderChip active={gender === "F"} onClick={() => setGender(gender === "F" ? "" : "F")} label="Féminin" />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <p className="flex items-center gap-2 text-sm font-extrabold">
            <Briefcase className="h-4 w-4 text-primary" /> Informations professionnelles
          </p>
          <Field icon={<FileText className="h-5 w-5 text-muted-foreground" />}>
            <input placeholder="Matricule employé" value={matricule} onChange={(e) => setMatricule(e.target.value)} className="flex-1 bg-transparent text-base outline-none" />
          </Field>
          <Field icon={<Briefcase className="h-5 w-5 text-muted-foreground" />}>
            <input placeholder="Fonction" value={functionTitle} onChange={(e) => setFunctionTitle(e.target.value)} className="flex-1 bg-transparent text-base outline-none" />
          </Field>
          <Field icon={<Building2 className="h-5 w-5 text-muted-foreground" />}>
            <input placeholder="Adresse professionnelle" value={profAddress} onChange={(e) => setProfAddress(e.target.value)} className="flex-1 bg-transparent text-base outline-none" />
          </Field>
        </section>

        <section className="space-y-3">
          <p className="flex items-center gap-2 text-sm font-extrabold">
            <Mail className="h-4 w-4 text-primary" /> Compte & contact
          </p>
          <Field icon={<Mail className="h-5 w-5 text-muted-foreground" />}>
            <input required type="email" placeholder="Email *" value={email} onChange={(e) => setEmail(e.target.value)} className="flex-1 bg-transparent text-base outline-none" />
          </Field>
          <Field icon={<Phone className="h-5 w-5 text-muted-foreground" />}>
            <input type="tel" placeholder="Téléphone" value={phone} onChange={(e) => setPhone(e.target.value)} className="flex-1 bg-transparent text-base outline-none" />
          </Field>
          <Field icon={<Lock className="h-5 w-5 text-muted-foreground" />}>
            <input required type={showPwd ? "text" : "password"} placeholder="Mot de passe (8+ caractères) *" value={password} onChange={(e) => setPassword(e.target.value)} className="flex-1 bg-transparent text-base outline-none" />
            <button type="button" onClick={() => setShowPwd((v) => !v)} aria-label="Afficher mot de passe">
              {showPwd ? <EyeOff className="h-5 w-5 text-muted-foreground" /> : <Eye className="h-5 w-5 text-muted-foreground" />}
            </button>
          </Field>
          <p className="text-xs text-muted-foreground">
            Ce mot de passe sera communiqué à l'utilisateur. Il pourra le changer après sa première connexion.
          </p>
        </section>

        <button type="submit" disabled={mutate.isPending} className="w-full rounded-3xl bg-primary py-4 text-sm font-extrabold text-primary-foreground disabled:opacity-60">
          {mutate.isPending ? "Création…" : "Créer le compte"}
        </button>
      </form>
    </AdminShell>
  );
}

function Field({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex h-14 items-center gap-3 rounded-2xl border border-input bg-card px-4 shadow-[var(--shadow-card)]">
      {icon}
      {children}
    </div>
  );
}

function RoleCard({ active, onClick, icon, label, hint }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; hint: string; }) {
  return (
    <button type="button" onClick={onClick} className={cn("flex flex-col items-start gap-1 rounded-2xl border-2 p-4 text-left transition", active ? "border-primary bg-primary/5" : "border-input bg-card")}>
      <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>{icon}</span>
      <span className="text-sm font-extrabold">{label}</span>
      <span className="text-[11px] text-muted-foreground">{hint}</span>
    </button>
  );
}

function GenderChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string; }) {
  return (
    <button type="button" onClick={onClick} className={cn("rounded-2xl border-2 px-4 py-3 text-sm font-bold transition", active ? "border-primary bg-primary/5 text-primary" : "border-input bg-card text-foreground")}>
      {label}
    </button>
  );
}

function PhotoUpload({ bucket, value, onChange, prefix }: {
  bucket: "staff-photos" | "student-photos" | "school-assets" | "avatars";
  value: string; onChange: (url: string) => void; prefix: string;
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
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-secondary/40 p-3">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-card">
        {value ? <img src={value} alt="Photo" className="h-full w-full object-cover" /> : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
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
