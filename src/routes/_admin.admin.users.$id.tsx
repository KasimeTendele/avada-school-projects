import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LuArrowLeft as ArrowLeft, LuCircleCheckBig as CheckCircle2, LuUserRound as UserRound, LuMail as Mail, LuPhone as Phone, LuShieldCheck as ShieldCheck, LuGraduationCap as GraduationCap, LuClock as Clock, LuUserMinus as UserMinus, LuChevronUp as ChevronUp, LuChevronDown as ChevronDown, LuEye as Eye } from "react-icons/lu";
import { AdminShell } from "@/components/AdminShell";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface UserDetail {
  id: string; full_name: string | null; email: string | null; phone: string | null;
  avatar_url: string | null; status: string; created_at: string;
  school_id: string | null; school_name: string | null;
  role: string; roles: string[]; last_login_at: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super admin", admin: "Admin", cashier: "Caissier", parent: "Parent", inspector: "Inspecteur",
};

export const Route = createFileRoute("/_admin/admin/users/$id")({
  head: () => ({ meta: [{ title: "Utilisateur — Administration" }] }),
  component: UserDetailPage,
});

function UserDetailPage() {
  const navigate = useNavigate();
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-user", id],
    queryFn: () => apiFetch<UserDetail>(`/admin-users/${id}`),
  });
  const [openInfo, setOpenInfo] = useState(true);
  const [openAffect, setOpenAffect] = useState(true);
  const [openActivity, setOpenActivity] = useState(true);

  const mutate = useMutation({
    mutationFn: (status: string) =>
      apiFetch(`/admin-users/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => {
      toast.success("Statut mis à jour");
      qc.invalidateQueries({ queryKey: ["admin-user", id] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!data) {
    return <AdminShell><p className="p-6 text-center text-sm text-muted-foreground">Chargement…</p></AdminShell>;
  }

  const isActive = data.status === "active";

  return (
    <AdminShell>
      {/* Hero (compact, like screenshot - title row) */}
      <header className="bg-primary/5 px-5 pt-6 pb-4">
        <button onClick={() => navigate({ to: "/admin/users" })} className="mb-3 flex h-9 w-9 items-center justify-center rounded-2xl bg-card shadow-[var(--shadow-card)]">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-tint-sky text-tint-sky-foreground">
            <Eye className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <h1 className="text-xl font-extrabold leading-tight">{data.full_name ?? "—"}</h1>
            <span className="mt-1 inline-block rounded-full bg-tint-sky px-2.5 py-0.5 text-[11px] font-semibold text-tint-sky-foreground">
              {ROLE_LABELS[data.role] ?? data.role}
            </span>
          </div>
          <span className={cn("flex items-center gap-1 text-sm font-bold", isActive ? "text-success" : "text-muted-foreground")}>
            <CheckCircle2 className="h-4 w-4" /> {isActive ? "Actif" : data.status === "suspended" ? "Suspendu" : "Inactif"}
          </span>
        </div>
      </header>

      <section className="space-y-3 px-4 pt-4 pb-6">
        {/* Informations personnelles */}
        <Section title="Informations personnelles" icon={<UserRound className="h-4 w-4 text-primary" />} open={openInfo} onToggle={() => setOpenInfo((v) => !v)}>
          <Row label="Nom complet" value={data.full_name ?? "—"} />
          <Row label="Email" value={data.email ?? "—"} icon={<Mail className="h-3.5 w-3.5 text-primary" />} link={data.email ? `mailto:${data.email}` : undefined} />
          <Row label="Téléphone" value={data.phone ?? "—"} icon={<Phone className="h-3.5 w-3.5 text-primary" />} link={data.phone ? `tel:${data.phone}` : undefined} />
          <Row label="Rôle" value={ROLE_LABELS[data.role] ?? data.role} />
          <Row label="Statut" value={isActive ? "Actif" : data.status === "suspended" ? "Suspendu" : "Inactif"} />
        </Section>

        {/* Affectation */}
        <Section title="Affectation" icon={<GraduationCap className="h-4 w-4 text-info" />} open={openAffect} onToggle={() => setOpenAffect((v) => !v)}>
          <Row label="École" value={data.school_name ?? "Non assigné (Global)"} />
          <Row label="ID école" value={data.school_id ?? "—"} mono />
        </Section>

        {/* Activité du compte */}
        <Section title="Activité du compte" icon={<Clock className="h-4 w-4 text-warning" />} open={openActivity} onToggle={() => setOpenActivity((v) => !v)}>
          <Row label="Date de création" value={new Date(data.created_at).toLocaleString("fr-FR")} />
          <Row label="Dernière connexion" value={data.last_login_at ? new Date(data.last_login_at).toLocaleString("fr-FR") : "—"} />
          <Row label="Dernière connexion (relative)" value={relativeTime(data.last_login_at)} />
        </Section>

        {/* Action */}
        <button
          onClick={() => mutate.mutate(isActive ? "suspended" : "active")}
          disabled={mutate.isPending}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-3xl py-4 text-sm font-extrabold disabled:opacity-60",
            isActive ? "bg-destructive/10 text-destructive" : "bg-tint-mint text-tint-mint-foreground",
          )}
        >
          <UserMinus className="h-4 w-4" />
          {isActive ? "Suspendre" : "Réactiver"}
        </button>
      </section>
    </AdminShell>
  );
}

function Section({ title, icon, open, onToggle, children }: {
  title: string; icon: React.ReactNode; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div>
      <button onClick={onToggle} className="mb-2 flex w-full items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-extrabold">{icon} {title}</span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="rounded-3xl bg-card p-4 shadow-[var(--shadow-card)]">
          {children}
        </div>
      )}
    </div>
  );
}
function Row({ label, value, icon, link, mono }: { label: string; value: string; icon?: React.ReactNode; link?: string; mono?: boolean }) {
  const content = (
    <span className={cn("flex items-center gap-1 text-right text-sm font-bold", link ? "text-primary underline" : "text-foreground", mono && "font-mono text-xs")}>
      {icon}{value}
    </span>
  );
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border py-2.5 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      {link ? <a href={link}>{content}</a> : content}
    </div>
  );
}
function relativeTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 3600) return `Il y a ${Math.max(1, Math.round(diff / 60))} min`;
  if (diff < 86400) return `Il y a ${Math.round(diff / 3600)}h`;
  if (diff < 86400 * 7) return `Il y a ${Math.round(diff / 86400)} jours`;
  return d.toLocaleDateString("fr-FR");
}
