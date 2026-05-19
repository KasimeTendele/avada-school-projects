import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { LuBell as Bell, LuSettings as Settings, LuCreditCard as CreditCard, LuFileText as FileText, LuUsers as Users, LuClock as Clock, LuChevronRight as ChevronRight, LuCamera as Camera } from "react-icons/lu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { ParentShell } from "@/components/ParentShell";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatNumber, initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Accueil — Avada School" },
      { name: "description", content: "Tableau de bord parent : suivi des frais et paiements." },
    ],
  }),
  component: HomePage,
});

interface FeeItem {
  fee_id: string;
  amount: number;
  paid: number;
  remaining: number;
  currency: string;
  student: { id: string; first_name: string; last_name: string };
}
interface Student {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string | null;
  school?: { name?: string } | null;
  class?: { name?: string } | null;
}
interface PaymentRow {
  id: string;
  amount: number;
  currency: string;
  status: string;
  paid_at: string | null;
  created_at: string;
}

type Period = "day" | "week" | "month";
type Scope = "global" | "child";

function HomePage() {
  const { user, profile, refresh, roles } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [period, setPeriod] = useState<Period>("week");
  const [scope, setScope] = useState<Scope>("global");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Redirect school staff to their dedicated dashboard
  useEffect(() => {
    const isCashierOnly = roles.includes("cashier") && !roles.some((r) => r === "admin" || r === "super_admin");
    if (isCashierOnly) {
      navigate({ to: "/cashier", replace: true });
    } else if (roles.some((r) => r === "super_admin" || r === "admin")) {
      navigate({ to: "/admin", replace: true });
    }
  }, [roles, navigate]);

  const onAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image trop grande (5 Mo max)"); return; }
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = `${pub.publicUrl}?t=${Date.now()}`;
      const { error: updErr } = await supabase
        .from("profiles")
        .upsert(
          {
            id: user.id,
            avatar_url: url,
            email: user.email ?? null,
            full_name: (user.user_metadata as { full_name?: string })?.full_name ?? null,
            phone: (user.user_metadata as { phone?: string })?.phone ?? null,
          },
          { onConflict: "id" },
        );
      if (updErr) throw updErr;
      await refresh();
      toast.success("Photo de profil mise à jour");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const fees = useQuery({
    queryKey: ["fees-by-parent"],
    queryFn: () => apiFetch<{ items: FeeItem[] }>("/fees-by-parent"),
  });
  const students = useQuery({
    queryKey: ["students-by-parent"],
    queryFn: () => apiFetch<{ items: Student[] }>("/students-by-parent"),
  });
  const payments = useQuery({
    queryKey: ["payments-mine-home"],
    queryFn: () =>
      apiFetch<{ items: PaymentRow[] }>("/payments?limit=100&sort=-created_at"),
  });
  const notifs = useQuery({
    queryKey: ["notifications-bell"],
    queryFn: () =>
      apiFetch<{ items: { id: string; read: boolean }[] }>("/notifications?limit=100"),
    refetchInterval: 30000,
  });

  // Realtime: refresh badge as new notifications / fees / payments arrive
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`bell-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["notifications-bell"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "fees" },
        () => qc.invalidateQueries({ queryKey: ["fees-by-parent"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payments" },
        () => {
          qc.invalidateQueries({ queryKey: ["fees-by-parent"] });
          qc.invalidateQueries({ queryKey: ["payments-mine-home"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  const items = fees.data?.items ?? [];
  const studentList = students.data?.items ?? [];
  const childCount = studentList.length;
  // "Paiements en attente" = nombre de frais avec un reste à payer > 0
  const pendingPayments = items.filter((i) => Number(i.remaining || 0) > 0).length;
  const unreadNotifs = (notifs.data?.items ?? []).filter((n) => !n.read).length;
  const bellBadge = unreadNotifs + pendingPayments;

  const chartData = useMemo(
    () => buildChartData(payments.data?.items ?? [], period),
    [payments.data, period],
  );
  const periodTotal = chartData.reduce((s, d) => s + d.amount, 0);
  const totalPaid = items.reduce((s, i) => s + Number(i.paid || 0), 0);

  return (
    <ParentShell>
      {/* Header clair */}
      <header className="px-5 pt-8 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              aria-label="Changer la photo de profil"
              className="relative h-12 w-12 rounded-full focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <Avatar className="h-12 w-12 bg-accent">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-accent text-accent-foreground font-bold">
                  {initials(profile?.full_name)}
                </AvatarFallback>
              </Avatar>
              <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-card)]">
                <Camera className="h-3 w-3" />
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg"
              hidden
              onChange={onAvatarFile}
            />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Bienvenue,</p>
              <h1 className="truncate text-lg font-extrabold text-foreground">
                {profile?.full_name ?? "Parent"}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/notifications"
              className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-card shadow-[var(--shadow-card)]"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5 text-foreground" />
              {bellBadge > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow">
                  {bellBadge > 99 ? "99+" : bellBadge}
                </span>
              )}
            </Link>
            <Link
              to="/profile"
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-card shadow-[var(--shadow-card)]"
              aria-label="Paramètres"
            >
              <Settings className="h-5 w-5 text-foreground" />
            </Link>
          </div>
        </div>
      </header>

      {/* 2 grandes cartes stats : ink (sombre) + teal foncé */}
      <section className="px-5 pt-2">
        <div className="grid grid-cols-2 gap-3">
          {/* Mes enfants — carte ink */}
          <Link
            to="/children"
            className="rounded-3xl bg-ink p-4 text-ink-foreground shadow-[var(--shadow-elevated)]"
          >
            <div className="flex items-center">
              <AvatarStack students={studentList} extra={Math.max(0, childCount - 2)} />
            </div>
            <p className="mt-4 text-4xl font-extrabold leading-none">{childCount}</p>
            <div className="mt-4 flex items-center gap-1 text-sm font-medium text-white/85">
              Voir mes enfants <ChevronRight className="h-4 w-4" />
            </div>
          </Link>

          {/* Paiements en attente — carte teal foncé */}
          <Link
            to="/transactions"
            className="rounded-3xl bg-teal-deep p-4 text-teal-deep-foreground shadow-[var(--shadow-elevated)]"
          >
            <div className="flex items-start justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
                <Clock className="h-5 w-5" />
              </span>
              <p className="text-right text-sm font-semibold leading-tight max-w-[110px]">
                Paiements en<br />attente
              </p>
            </div>
            <p className="mt-4 text-4xl font-extrabold leading-none">{pendingPayments}</p>
            <div className="mt-4 flex items-center gap-1 text-sm font-medium text-white/85">
              Voir l'historique <ChevronRight className="h-4 w-4" />
            </div>
          </Link>
        </div>
      </section>

      {/* Actions rapides — carte blanche avec 4 pastels */}
      <section className="mx-5 mt-4 rounded-3xl bg-card p-5 shadow-[var(--shadow-card)]">
        <h2 className="mb-4 text-base font-extrabold">Actions rapides</h2>
        <div className="grid grid-cols-4 gap-2.5">
          <QuickAction
            to="/payments"
            tint="bg-tint-mint"
            iconColor="text-tint-mint-foreground"
            icon={<CreditCard className="h-5 w-5" />}
            label="Payer des frais"
          />
          <QuickAction
            to="/children"
            tint="bg-tint-sky"
            iconColor="text-tint-sky-foreground"
            icon={<Users className="h-5 w-5" />}
            label="Mes enfants"
          />
          <QuickAction
            to="/payments"
            tint="bg-tint-peach"
            iconColor="text-tint-peach-foreground"
            icon={<FileText className="h-5 w-5" />}
            label="Reçus"
          />
          <QuickAction
            to="/transactions"
            tint="bg-tint-lavender"
            iconColor="text-tint-lavender-foreground"
            icon={<Clock className="h-5 w-5" />}
            label="Historique"
          />
        </div>
      </section>

      {/* Analyse des paiements */}
      <section className="mx-5 mt-4 rounded-3xl bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-extrabold">Analyse des paiements</h2>
          <p className="text-sm font-extrabold text-primary">
            {formatNumber(scope === "global" ? totalPaid : periodTotal)} CDF
          </p>
        </div>

        {/* Toggle pilule Jour / Semaine / Mois */}
        <div className="grid grid-cols-3 gap-2">
          {(["day", "week", "month"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "h-10 rounded-full text-sm font-semibold transition-colors",
                period === p
                  ? "bg-primary text-primary-foreground shadow-[var(--shadow-card)]"
                  : "bg-secondary text-foreground",
              )}
            >
              {p === "day" ? "Jour" : p === "week" ? "Semaine" : "Mois"}
            </button>
          ))}
        </div>

        {/* Toggle Total global / Par enfant */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(["global", "child"] as Scope[]).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={cn(
                "h-10 rounded-full border text-sm font-semibold transition-colors",
                scope === s
                  ? "border-primary bg-accent text-primary"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              {s === "global" ? "Total global" : "Par enfant"}
            </button>
          ))}
        </div>

        <div className="mt-4 h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 4, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                tickFormatter={(v) => compactCDF(v)}
              />
              <Tooltip
                cursor={{ fill: "var(--accent)", opacity: 0.4 }}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--card)",
                  fontSize: 12,
                }}
                formatter={(v: number) => [`${formatNumber(v)} CDF`, "Encaissé"]}
              />
              <Bar dataKey="amount" fill="var(--tint-sky)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Derniers paiements effectués */}
      <section className="px-5 pt-4 pb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-extrabold">Derniers paiements effectués</h2>
          <Link to="/payments" className="text-sm font-extrabold text-primary">
            Voir tout
          </Link>
        </div>
        <RecentPayments
          payments={payments.data?.items ?? []}
          students={studentList}
          loading={payments.isLoading}
        />
      </section>
    </ParentShell>
  );
}

function RecentPayments({
  payments, students, loading,
}: { payments: PaymentRow[]; students: Student[]; loading: boolean }) {
  if (loading) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }
  const recent = payments.slice(0, 5);
  if (recent.length === 0) {
    return (
      <p className="rounded-2xl bg-card p-5 text-sm text-muted-foreground shadow-[var(--shadow-card)]">
        Aucun paiement récent.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {recent.map((p) => {
        const studentName = (() => {
          const sid = (p as PaymentRow & { student_id?: string }).student_id;
          const s = students.find((x) => x.id === sid);
          return s ? `${s.first_name} ${s.last_name}` : "Paiement";
        })();
        const date = new Date(p.paid_at ?? p.created_at);
        const dateStr = `${date.toLocaleDateString("fr-FR")} ${date
          .toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
        const isCompleted = p.status?.toUpperCase() === "COMPLETED";
        return (
          <div
            key={p.id}
            className="flex items-start justify-between gap-3 rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold">{studentName}</p>
              <p className="text-xs text-muted-foreground">{dateStr}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-extrabold text-primary">
                {formatNumber(Number(p.amount || 0))} {p.currency}
              </p>
              <span
                className={cn(
                  "mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                  isCompleted
                    ? "bg-tint-mint text-tint-mint-foreground"
                    : "bg-secondary text-muted-foreground",
                )}
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
                {isCompleted ? "Confirmé" : p.status ?? "En cours"}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AvatarStack({ students, extra }: { students: Student[]; extra: number }) {
  const visible = students.slice(0, 2);
  return (
    <div className="flex items-center -space-x-3">
      {visible.map((s) => (
        <Avatar key={s.id} className="h-10 w-10 border-2 border-ink">
          <AvatarImage src={s.avatar_url ?? undefined} />
          <AvatarFallback className="bg-tint-peach text-tint-peach-foreground text-xs font-bold">
            {initials(`${s.first_name} ${s.last_name}`)}
          </AvatarFallback>
        </Avatar>
      ))}
      {extra > 0 && (
        <span className="flex h-10 min-w-10 items-center justify-center rounded-full border-2 border-ink bg-white/15 px-2 text-xs font-bold text-white">
          +{extra}
        </span>
      )}
      {visible.length === 0 && (
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-xs font-bold text-white">
          0
        </span>
      )}
    </div>
  );
}

function QuickAction({ to, tint, iconColor, icon, label }: {
  to: "/payments" | "/notifications" | "/children";
  tint: string; iconColor: string; icon: React.ReactNode; label: string;
}) {
  return (
    <Link to={to} className="flex flex-col items-center gap-2">
      <span className={cn("flex h-14 w-14 items-center justify-center rounded-2xl", tint, iconColor)}>
        {icon}
      </span>
      <span className="text-center text-[11px] font-semibold leading-tight text-foreground">
        {label}
      </span>
    </Link>
  );
}

function compactCDF(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}k`;
  return String(v);
}

function buildChartData(payments: PaymentRow[], period: Period) {
  const now = new Date();
  const completed = payments.filter(
    (p) => p.status?.toUpperCase() === "COMPLETED" || p.paid_at,
  );
  if (period === "day") {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);
      return d;
    });
    return days.map((d) => {
      const next = new Date(d); next.setDate(next.getDate() + 1);
      const sum = completed
        .filter((p) => {
          const t = new Date(p.paid_at ?? p.created_at).getTime();
          return t >= d.getTime() && t < next.getTime();
        })
        .reduce((s, p) => s + Number(p.amount || 0), 0);
      return {
        label: d.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", ""),
        amount: sum,
      };
    });
  }
  if (period === "week") {
    const weeks = Array.from({ length: 6 }, (_, i) => {
      const end = new Date(now);
      end.setDate(end.getDate() - i * 7);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      return { start, end };
    }).reverse();
    return weeks.map((w, i) => {
      const sum = completed
        .filter((p) => {
          const t = new Date(p.paid_at ?? p.created_at).getTime();
          return t >= w.start.setHours(0, 0, 0, 0) && t <= w.end.setHours(23, 59, 59, 999);
        })
        .reduce((s, p) => s + Number(p.amount || 0), 0);
      return { label: `S${i + 1}`, amount: sum };
    });
  }
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return d;
  });
  return months.map((d) => {
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const sum = completed
      .filter((p) => {
        const t = new Date(p.paid_at ?? p.created_at).getTime();
        return t >= d.getTime() && t < next.getTime();
      })
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    return {
      label: d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", ""),
      amount: sum,
    };
  });
}
