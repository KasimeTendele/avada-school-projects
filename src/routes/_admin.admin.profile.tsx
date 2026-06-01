import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { LuLogOut as LogOut, LuShieldCheck as ShieldCheck, LuMail as Mail, LuPhone as Phone, LuLock as Lock } from "react-icons/lu";
import { AdminShell } from "@/components/AdminShell";
import { AdminHero } from "@/components/AdminHero";
import { useAuth } from "@/lib/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/admin/profile")({
  head: () => ({ meta: [{ title: "Profil — Administration" }] }),
  component: AdminProfile,
});

function AdminProfile() {
  const { profile, signOut, roles, user } = useAuth();
  const navigate = useNavigate();
  const onLogout = async () => { await signOut(); navigate({ to: "/login" }); };
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [changingPwd, setChangingPwd] = useState(false);

  const onChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPwd.length < 8) return toast.error("Mot de passe : 8 caractères minimum.");
    if (newPwd !== confirmPwd) return toast.error("Les mots de passe ne correspondent pas.");
    if (!user?.email) return toast.error("Email introuvable.");
    setChangingPwd(true);
    try {
      const { changePassword } = await import("@/features/auth/password");
      await changePassword({ current_password: currentPwd, new_password: newPwd });
      toast.success("Mot de passe mis à jour.");
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
    } catch (err) {
      toast.error((err as Error).message ?? "Échec de la mise à jour");
    } finally {
      setChangingPwd(false);
    }
  };

  return (
    <AdminShell>
      <AdminHero title="Profil" subtitle="Votre compte administrateur." backTo="/admin" className="rounded-b-[2rem]" />
      <section className="px-4 pt-4 pb-6 space-y-3">
        <div className="rounded-3xl bg-card p-5 shadow-[var(--shadow-card)] text-center">
          <Avatar className="mx-auto h-20 w-20">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-accent text-accent-foreground text-xl font-bold">
              {initials(profile?.full_name)}
            </AvatarFallback>
          </Avatar>
          <h2 className="mt-3 text-lg font-extrabold">{profile?.full_name ?? "—"}</h2>
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-tint-lavender px-2.5 py-0.5 text-[11px] font-semibold text-tint-lavender-foreground">
            <ShieldCheck className="h-3 w-3" /> {roles.includes("super_admin") ? "Super admin" : roles[0] ?? "—"}
          </span>
        </div>
        <div className="rounded-3xl bg-card p-4 shadow-[var(--shadow-card)] space-y-2.5">
          <div className="flex items-center gap-3 border-b border-border pb-2.5">
            <Mail className="h-4 w-4 text-primary" />
            <span className="text-sm">{profile?.email ?? "—"}</span>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="h-4 w-4 text-primary" />
            <span className="text-sm">{profile?.phone ?? "—"}</span>
          </div>
        </div>
        <form onSubmit={onChangePassword} className="rounded-3xl bg-card p-5 shadow-[var(--shadow-card)] space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-extrabold">
            <Lock className="h-4 w-4 text-primary" /> Sécurité — Mot de passe
          </h3>
          <div className="space-y-1.5">
            <Label htmlFor="cur-pwd">Mot de passe actuel</Label>
            <Input id="cur-pwd" type="password" autoComplete="current-password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-pwd">Nouveau mot de passe</Label>
            <Input id="new-pwd" type="password" autoComplete="new-password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} required minLength={8} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="conf-pwd">Confirmer le mot de passe</Label>
            <Input id="conf-pwd" type="password" autoComplete="new-password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} required minLength={8} />
          </div>
          <Button type="submit" disabled={changingPwd} className="w-full">
            {changingPwd ? "Mise à jour…" : "Mettre à jour le mot de passe"}
          </Button>
        </form>
        <button onClick={onLogout} className="flex w-full items-center justify-center gap-2 rounded-3xl bg-destructive/10 py-4 text-sm font-extrabold text-destructive">
          <LogOut className="h-4 w-4" /> Se déconnecter
        </button>
      </section>
    </AdminShell>
  );
}
