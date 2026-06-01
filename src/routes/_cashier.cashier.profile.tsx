import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import {
  LuMail as Mail,
  LuPhone as Phone,
  LuUser as User,
  LuShieldCheck as ShieldCheck,
  LuGraduationCap as School,
  LuCheck as Check,
  LuLock as Lock,
  LuPencil as Pencil,
  LuReceipt as Receipt,
  LuUsers as Users,
  LuFileText as FileText,
  LuBell as Bell,
  LuClock as Clock,
  LuLogOut as LogOut,
  LuRefreshCw as Refresh,
} from "react-icons/lu";
import { CashierShell } from "@/components/CashierShell";
import { CashierTopBar, PageTitle } from "@/components/CashierTopBar";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatNumber, initials } from "@/lib/format";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface CashierDash {
  today: { total: number; transactionsCount: number; currency: string };
  overview: { studentsCount: number };
}
interface School { id: string; name: string; }

const PERMISSIONS = [
  { Icon: Receipt, label: "Encaissements" },
  { Icon: Users, label: "Suivi élèves" },
  { Icon: FileText, label: "Gestion des frais" },
  { Icon: Bell, label: "Notifications" },
  { Icon: Clock, label: "Historique" },
];

const PREFS = [
  { key: "payments", label: "Paiements encaissés", Icon: Receipt },
  { key: "fees", label: "Frais & échéances", Icon: FileText },
  { key: "students", label: "Dossiers élèves", Icon: Users },
  { key: "reminders", label: "Rappels caisse", Icon: Bell },
  { key: "system", label: "Système", Icon: ShieldCheck },
] as const;

export const Route = createFileRoute("/_cashier/cashier/profile")({
  head: () => ({ meta: [{ title: "Profil caissier — Avada School" }] }),
  component: CashierProfile,
});

function CashierProfile() {
  const { profile, user, signOut } = useAuth();
  const schoolId = profile?.primary_school_id ?? null;
  const [prefs, setPrefs] = useState<Record<string, boolean>>(
    Object.fromEntries(PREFS.map((p) => [p.key, true])),
  );
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

  const dashQ = useQuery({
    enabled: !!schoolId,
    queryKey: ["cashier-dashboard", schoolId],
    queryFn: () => apiFetch<CashierDash>(`/cashier-dashboard/${schoolId}`),
  });

  const schoolQ = useQuery({
    enabled: !!schoolId,
    queryKey: ["my-school", schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from("schools")
        .select("id,name")
        .eq("id", schoolId!)
        .maybeSingle();
      return data as School | null;
    },
  });

  const dash = dashQ.data;

  return (
    <CashierShell>
      <CashierTopBar
        schoolName={schoolQ.data?.name}
        subtitle={
          <>
            <ShieldCheck className="h-3 w-3" />
            Caissier · Compte actif
          </>
        }
      />

      <main className="px-4 py-6 lg:px-8">
        <PageTitle title="Mon profil" description="Compte, sécurité et préférences" />

        {/* Hero card */}
        <section
          style={{ backgroundImage: "var(--gradient-primary)" }}
          className="relative mb-6 overflow-hidden rounded-3xl bg-primary p-6 text-white shadow-[var(--shadow-elevated)]"
        >
          <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-12 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
          <div className="relative flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:gap-5 sm:text-left">
            <div className="relative">
              <Avatar className="h-20 w-20 border-4 border-white/30">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-white/20 text-xl font-bold text-white">
                  {initials(profile?.full_name)}
                </AvatarFallback>
              </Avatar>
              <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white text-primary">
                <Check className="h-4 w-4" strokeWidth={3} />
              </span>
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-black tracking-tight">{profile?.full_name ?? "Caissier"}</h2>
              <p className="text-sm text-white/85">{profile?.email ?? user?.email ?? "—"}</p>
              <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold backdrop-blur">
                  <Receipt className="h-3.5 w-3.5" /> Caissier
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold backdrop-blur">
                  <School className="h-3.5 w-3.5" /> {schoolQ.data?.name ?? "Mon école"}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Stat
            Icon={Receipt}
            value={`${formatNumber(dash?.today.total ?? 0)} ${dash?.today.currency ?? "FC"}`}
            label="Aujourd'hui"
            bar="bg-primary"
            tint="bg-primary/10 text-primary"
          />
          <Stat
            Icon={Refresh}
            value={`${dash?.today.transactionsCount ?? 0}`}
            label="Transactions"
            bar="bg-tint-sky"
            tint="bg-tint-sky text-tint-sky-foreground"
          />
          <Stat
            Icon={Users}
            value={`${dash?.overview.studentsCount ?? 0}`}
            label="Élèves"
            bar="bg-tint-peach"
            tint="bg-tint-peach text-tint-peach-foreground"
          />
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Infos personnelles */}
          <Card title="Informations personnelles" actionIcon={<Pencil className="h-4 w-4" />}>
            <Row Icon={User} label="Nom complet" value={profile?.full_name ?? "—"} />
            <Row Icon={Mail} label="Adresse e-mail" value={profile?.email ?? user?.email ?? "—"} />
            <Row Icon={Phone} label="Téléphone" value={profile?.phone ?? "Non renseigné"} />
            <Row Icon={User} label="Identifiant" value={user?.id?.slice(0, 18) ?? "—"} mono />
          </Card>

          {/* Compte & sécurité */}
          <Card title="Compte & Sécurité" actionIcon={<Lock className="h-4 w-4" />}>
            <Row Icon={ShieldCheck} label="Rôle" value="Caissier" />
            <Row Icon={School} label="École assignée" value={schoolQ.data?.name ?? "—"} />
            <Row Icon={Check} label="Statut du compte" value="Actif" />
          </Card>

          {/* Permissions */}
          <Card title="Permissions">
            <div className="flex flex-wrap gap-2 p-3">
              {PERMISSIONS.map(({ Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
                >
                  <Icon className="h-3.5 w-3.5" /> {label}
                </span>
              ))}
            </div>
          </Card>

          {/* Préférences notifications */}
          <Card title="Préférences de notifications">
            <div className="divide-y divide-border/60">
              {PREFS.map(({ key, label, Icon }) => (
                <div key={key} className="flex items-center gap-3 px-3 py-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <p className="flex-1 text-sm font-semibold">{label}</p>
                  <Switch
                    checked={prefs[key]}
                    onCheckedChange={(v) => setPrefs((p) => ({ ...p, [key]: v }))}
                  />
                </div>
              ))}
            </div>
          </Card>
        </div>

        <section className="mt-6">
          <button
            onClick={async () => {
              await signOut();
              toast.success("Déconnecté");
            }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-destructive py-3.5 text-sm font-extrabold text-destructive-foreground shadow-[var(--shadow-card)] transition hover:-translate-y-0.5"
          >
            <LogOut className="h-4 w-4" /> Déconnexion
          </button>
        </section>

        <section className="mt-6">
          <Card title="Sécurité — Mot de passe" actionIcon={<Lock className="h-4 w-4" />}>
            <form onSubmit={onChangePassword} className="space-y-3 p-4">
              <div className="space-y-1.5">
                <Label htmlFor="cur-pwd">Mot de passe actuel</Label>
                <Input id="cur-pwd" type="password" autoComplete="current-password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} required />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="new-pwd">Nouveau mot de passe</Label>
                  <Input id="new-pwd" type="password" autoComplete="new-password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} required minLength={8} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="conf-pwd">Confirmer</Label>
                  <Input id="conf-pwd" type="password" autoComplete="new-password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} required minLength={8} />
                </div>
              </div>
              <Button type="submit" disabled={changingPwd} className="w-full md:w-auto">
                {changingPwd ? "Mise à jour…" : "Mettre à jour le mot de passe"}
              </Button>
            </form>
          </Card>
        </section>
      </main>
    </CashierShell>
  );
}

function Card({
  title, actionIcon, children,
}: { title: string; actionIcon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
        <h2 className="text-sm font-extrabold tracking-tight">{title}</h2>
        {actionIcon && (
          <button className="flex h-8 w-8 items-center justify-center rounded-2xl bg-primary/10 text-primary transition hover:bg-primary/15">
            {actionIcon}
          </button>
        )}
      </div>
      <div className="p-2">{children}</div>
    </section>
  );
}

function Stat({
  Icon, value, label, bar, tint,
}: { Icon: typeof Receipt; value: string; label: string; bar: string; tint: string }) {
  return (
    <div className="relative flex items-center gap-3 overflow-hidden rounded-3xl border border-border/60 bg-card p-4 shadow-[var(--shadow-card)]">
      <span className={cn("absolute left-0 top-0 h-full w-1.5", bar)} />
      <span className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", tint)}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase text-muted-foreground">{label}</p>
        <p className="truncate text-xl font-black leading-none">{value}</p>
      </div>
    </div>
  );
}

function Row({ Icon, label, value, mono }: { Icon: typeof Mail; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className={`truncate text-sm font-extrabold ${mono ? "font-mono text-foreground/80" : ""}`}>{value}</p>
      </div>
    </div>
  );
}
