import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LuLogOut as LogOut, LuShieldCheck as ShieldCheck, LuMail as Mail, LuPhone as Phone } from "react-icons/lu";
import { AdminShell } from "@/components/AdminShell";
import { AdminHero } from "@/components/AdminHero";
import { useAuth } from "@/lib/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";

export const Route = createFileRoute("/_admin/admin/profile")({
  head: () => ({ meta: [{ title: "Profil — Administration" }] }),
  component: AdminProfile,
});

function AdminProfile() {
  const { profile, signOut, roles } = useAuth();
  const navigate = useNavigate();
  const onLogout = async () => { await signOut(); navigate({ to: "/login" }); };

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
        <button onClick={onLogout} className="flex w-full items-center justify-center gap-2 rounded-3xl bg-destructive/10 py-4 text-sm font-extrabold text-destructive">
          <LogOut className="h-4 w-4" /> Se déconnecter
        </button>
      </section>
    </AdminShell>
  );
}
