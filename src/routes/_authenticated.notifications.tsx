import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ParentShell } from "@/components/ParentShell";
import { apiFetch } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { LuBell as Bell, LuGraduationCap as GraduationCap, LuChartColumnIncreasing as LineChart, LuCalendar as Calendar, LuReceipt as Receipt, LuCheckCheck as CheckCheck } from "react-icons/lu";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Avada School" },
      { name: "description", content: "Centre de notifications et préférences." },
    ],
  }),
  component: NotificationsPage,
});

interface Notif {
  id: string;
  title: string;
  message: string | null;
  type: string;
  read: boolean;
  created_at: string;
}

interface Prefs {
  payments: boolean;
  system: boolean;
  reminders: boolean;
  events: boolean;
  push_enabled: boolean;
  email_enabled: boolean;
}

function NotificationsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const list = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiFetch<{ items: Notif[] }>("/notifications?limit=30"),
  });

  const prefs = useQuery({
    queryKey: ["notification_preferences", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as Prefs | null;
    },
  });

  const updatePref = useMutation({
    mutationFn: async (patch: Partial<Prefs>) => {
      const { error } = await supabase
        .from("notification_preferences")
        .upsert({ user_id: user!.id, ...patch }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notification_preferences"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const markAll = useMutation({
    mutationFn: () => apiFetch("/notifications/read-all", { method: "PATCH" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Toutes les notifications marquées lues");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const items = list.data?.items ?? [];
  const unread = items.filter((n) => !n.read).length;

  return (
    <ParentShell>
      <header className="rounded-b-[2rem] bg-[image:var(--gradient-primary)] px-6 pt-10 pb-8 text-primary-foreground">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Notifications</h1>
            <p className="text-sm text-white/85">{unread} non lue{unread > 1 ? "s" : ""}</p>
          </div>
          {unread > 0 && (
            <button
              onClick={() => markAll.mutate()}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-2 text-xs font-medium backdrop-blur-sm"
            >
              <CheckCheck className="h-4 w-4" /> Tout lire
            </button>
          )}
        </div>
      </header>

      <section className="px-5 pt-6">
        {list.isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
        {!list.isLoading && items.length === 0 && (
          <p className="rounded-2xl bg-card p-5 text-sm text-muted-foreground shadow-[var(--shadow-card)]">
            Aucune notification pour l'instant.
          </p>
        )}
        <div className="space-y-3">
          {items.map((n) => (
            <article key={n.id} className={`rounded-2xl bg-card p-4 shadow-[var(--shadow-card)] ${!n.read ? "border border-primary/30" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="font-semibold">{n.title}</p>
                  {n.message && <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>}
                  <p className="mt-2 text-xs text-muted-foreground">{formatDate(n.created_at)}</p>
                </div>
                {!n.read && <span className="mt-1 h-2 w-2 rounded-full bg-primary" />}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="px-5 pt-8">
        <h2 className="mb-3 text-base font-bold">Préférences de notifications</h2>
        <div className="rounded-2xl bg-card shadow-[var(--shadow-card)]">
          <PrefRow icon={<Receipt className="h-4 w-4 text-primary" />} label="Paiements & reçus"
            checked={!!prefs.data?.payments}
            onChange={(v) => updatePref.mutate({ payments: v })} />
          <Divider />
          <PrefRow icon={<GraduationCap className="h-4 w-4 text-primary" />} label="Infos école"
            checked={!!prefs.data?.system}
            onChange={(v) => updatePref.mutate({ system: v })} />
          <Divider />
          <PrefRow icon={<LineChart className="h-4 w-4 text-primary" />} label="Résultats & bulletins"
            checked={!!prefs.data?.events}
            onChange={(v) => updatePref.mutate({ events: v })} />
          <Divider />
          <PrefRow icon={<Calendar className="h-4 w-4 text-primary" />} label="Événements & réunions"
            checked={!!prefs.data?.events}
            onChange={(v) => updatePref.mutate({ events: v })} />
          <Divider />
          <PrefRow icon={<Bell className="h-4 w-4 text-primary" />} label="Rappels échéances"
            checked={!!prefs.data?.reminders}
            onChange={(v) => updatePref.mutate({ reminders: v })} />
        </div>
      </section>
    </ParentShell>
  );
}

function PrefRow({ icon, label, checked, onChange }: { icon: React.ReactNode; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">{icon}</span>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
function Divider() { return <div className="mx-4 border-t border-border" />; }
function formatDate(s: string) {
  try { return new Date(s).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch { return s; }
}