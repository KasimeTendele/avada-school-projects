import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ParentShell } from "@/components/ParentShell";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LuCamera as Camera, LuMail as Mail, LuPhone as Phone, LuUser as User, LuLogOut as LogOut, LuCheck as Check, LuX as X, LuUserCog as UserCog, LuLock as Lock, LuShield as Shield } from "react-icons/lu";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profil — Avada School" },
      { name: "description", content: "Modifier mes informations et préférences." },
    ],
  }),
  component: ProfilePage,
});

type Theme = "light" | "dark" | "system";

function ProfilePage() {
  const { user, profile, signOut, refresh } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setEmail(profile?.email ?? user?.email ?? "");
    setPhone(profile?.phone ?? "");
    setAvatarUrl(profile?.avatar_url ?? null);
  }, [profile, user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = (window.localStorage.getItem("avada.theme") as Theme | null) ?? "system";
    setTheme(saved);
    applyTheme(saved);
  }, []);

  const onSelectFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image trop grande (5 Mo max)"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = `${pub.publicUrl}?t=${Date.now()}`;
      setAvatarUrl(url);
      toast.success("Photo mise à jour");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onSave = async () => {
    if (!user) return;
    if (!fullName.trim() || !email.trim()) { toast.error("Nom et email requis"); return; }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim(), email: email.trim(), phone: phone.trim() || null, avatar_url: avatarUrl })
        .eq("id", user.id);
      if (error) throw error;
      await refresh();
      toast.success("Informations enregistrées");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const setAndApplyTheme = (t: Theme) => {
    setTheme(t);
    if (typeof window !== "undefined") window.localStorage.setItem("avada.theme", t);
    applyTheme(t);
  };

  return (
    <ParentShell>
      <header className="relative bg-[image:var(--gradient-primary)] px-6 pt-12 pb-16 text-primary-foreground">
        <div className="flex flex-col items-center">
          <Avatar className="h-20 w-20 border-4 border-white/40 bg-white/20">
            <AvatarImage src={avatarUrl ?? undefined} />
            <AvatarFallback className="bg-white/30 text-2xl text-primary-foreground">
              {(fullName || "P").slice(0, 1)}
            </AvatarFallback>
          </Avatar>
        </div>
      </header>

      <div className="-mt-8 rounded-t-[2rem] bg-background px-5 pt-6 pb-2">
        <div className="mb-2 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-primary"><UserCog className="h-5 w-5" /></span>
          <h1 className="text-2xl font-bold">Modifier les informations</h1>
        </div>
        <p className="mb-6 text-sm text-muted-foreground">
          Mettez à jour votre identité et vos coordonnées. Elles seront utilisées pour vos échanges avec l'école.
        </p>

        <h2 className="mb-3 text-base font-bold">Informations personnelles</h2>
        <div className="space-y-4 rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
          <Field label="Nom complet *" icon={<User className="h-4 w-4" />}>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Votre nom complet" />
          </Field>
          <Field label="Adresse e-mail *" icon={<Mail className="h-4 w-4" />}>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Numéro de téléphone" icon={<Phone className="h-4 w-4" />}>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+243 ..." />
          </Field>

          <div>
            <Label className="mb-2 block text-sm">Photo de profil</Label>
            <div className="flex items-center justify-between rounded-xl bg-accent/50 p-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={avatarUrl ?? undefined} />
                  <AvatarFallback>{(fullName || "P").slice(0, 1)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold text-primary">Changer la photo</p>
                  <p className="text-xs text-muted-foreground">JPG, PNG · Max 5 Mo</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"
              >
                <Camera className="h-5 w-5" />
              </button>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg" hidden onChange={onSelectFile} />
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button variant="outline" className="rounded-xl" onClick={() => {
            setFullName(profile?.full_name ?? "");
            setEmail(profile?.email ?? user?.email ?? "");
            setPhone(profile?.phone ?? "");
          }}>
            <X className="h-4 w-4" /> Annuler
          </Button>
          <Button className="rounded-xl" onClick={onSave} disabled={saving}>
            <Check className="h-4 w-4" /> {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>

        <h2 className="mt-8 mb-3 text-base font-bold">Apparence</h2>
        <div className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
          <p className="mb-3 text-sm font-semibold">Thème de l'application</p>
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-border p-1">
            {(["light", "dark", "system"] as Theme[]).map((t) => (
              <button
                key={t}
                onClick={() => setAndApplyTheme(t)}
                className={`rounded-lg py-2 text-sm font-medium transition-colors ${theme === t ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
              >
                {t === "light" ? "Light" : t === "dark" ? "Dark" : "System"}
              </button>
            ))}
          </div>
        </div>

        <h2 className="mt-8 mb-3 text-base font-bold">Application</h2>
        <div className="space-y-2 rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
          <InfoRow label="Version" value="1.0.0" />
          <InfoRow label="Environnement" value="Production" />
        </div>

        <Button
          variant="outline"
          className="mt-6 mb-2 w-full rounded-2xl border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive"
          onClick={async () => { await signOut(); navigate({ to: "/login" }); }}
        >
          <LogOut className="h-4 w-4" /> Se déconnecter
        </Button>
      </div>
    </ParentShell>
  );
}

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-sm">{label}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>
        <div className="[&_input]:pl-9 [&_input]:bg-accent/40 [&_input]:border-transparent">{children}</div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const dark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);
}