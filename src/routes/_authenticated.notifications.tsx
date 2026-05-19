import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ParentShell } from "@/components/ParentShell";
import { apiFetch } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { LuBell as Bell, LuGraduationCap as GraduationCap, LuChartColumnIncreasing as LineChart, LuCalendar as Calendar, LuReceipt as Receipt, LuCheckCheck as CheckCheck } from "react-icons/lu";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AvadaPaySheet, type AvadaPayContext } from "@/components/AvadaPaySheet";
import { initials, formatNumber } from "@/lib/format";
import { LuChevronRight as ChevronRight } from "react-icons/lu";
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
  data?: {
    feeId?: string;
    studentId?: string;
    studentName?: string;
    amount?: number;
    currency?: string;
    label?: string;
  } | null;
}

interface FeeStatus {
  fee_id: string;
  remaining: number;
  student: { id: string };
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
  const [selectedFee, setSelectedFee] = useState<Notif | null>(null);
  const [payCtx, setPayCtx] = useState<AvadaPayContext | null>(null);

  const list = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiFetch<{ items: Notif[] }>("/notifications?limit=30"),
  });

  const feesQ = useQuery({
    queryKey: ["fees-by-parent"],
    queryFn: () => apiFetch<{ items: FeeStatus[] }>("/fees-by-parent"),
  });

  // Map "feeId|studentId" -> remaining
  const remainingByKey = (() => {
    const m = new Map<string, number>();
    (feesQ.data?.items ?? []).forEach((f) => {
      m.set(`${f.fee_id}|${f.student.id}`, Number(f.remaining || 0));
    });
    return m;
  })();
  const isFeePaid = (n: Notif) => {
    if (n.type !== "FEE" || !n.data?.feeId || !n.data?.studentId) return false;
    const r = remainingByKey.get(`${n.data.feeId}|${n.data.studentId}`);
    return r !== undefined && r <= 0;
  };

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

  const markRead = async (id: string) => {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: "PATCH" });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    } catch {
      /* ignore */
    }
  };

  const onNotifClick = (n: Notif) => {
    if (!n.read) markRead(n.id);
    if (n.type === "FEE" && n.data?.feeId && n.data?.studentId) {
      if (isFeePaid(n)) {
        toast.success("Ce motif est déjà entièrement payé.");
        return;
      }
      setSelectedFee(n);
    }
  };

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
            (() => {
              const paid = isFeePaid(n);
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => onNotifClick(n)}
                  className={`block w-full text-left rounded-2xl bg-card p-4 shadow-[var(--shadow-card)] transition-colors ${!n.read ? "border border-primary/30" : ""} ${n.type === "FEE" && !paid ? "hover:bg-accent/30" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-semibold">{n.title}</p>
                      {n.message && <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>}
                      <div className="mt-2 flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">{formatDate(n.created_at)}</p>
                        {paid && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-tint-mint px-2 py-0.5 text-[10px] font-semibold text-tint-mint-foreground">
                            Déjà payé
                          </span>
                        )}
                      </div>
                    </div>
                    {!n.read && <span className="mt-1 h-2 w-2 rounded-full bg-primary" />}
                  </div>
                </button>
              );
            })()
          ))}
        </div>
      </section>

      <section className="px-5 pt-8">
        <h2 className="mb-3 text-base font-bold">Préférences de notifications</h2>
        <div className="rounded-2xl bg-card shadow-[var(--shadow-card)]">
          <PrefRow icon={<Receipt className="h-4 w-4 text-primary" />} label="Paiements & reçus"
            checked={prefs.data?.payments ?? true}
            disabled={updatePref.isPending || prefs.isLoading}
            onChange={(v) => updatePref.mutate({ payments: v })} />
          <Divider />
          <PrefRow icon={<GraduationCap className="h-4 w-4 text-primary" />} label="Infos école"
            checked={prefs.data?.system ?? true}
            disabled={updatePref.isPending || prefs.isLoading}
            onChange={(v) => updatePref.mutate({ system: v })} />
          <Divider />
          <PrefRow icon={<LineChart className="h-4 w-4 text-primary" />} label="Résultats & bulletins"
            checked={prefs.data?.events ?? true}
            disabled={updatePref.isPending || prefs.isLoading}
            onChange={(v) => updatePref.mutate({ events: v })} />
          <Divider />
          <PrefRow icon={<Calendar className="h-4 w-4 text-primary" />} label="Événements & réunions"
            checked={prefs.data?.events ?? true}
            disabled={updatePref.isPending || prefs.isLoading}
            onChange={(v) => updatePref.mutate({ events: v })} />
          <Divider />
          <PrefRow icon={<Bell className="h-4 w-4 text-primary" />} label="Rappels échéances"
            checked={prefs.data?.reminders ?? true}
            disabled={updatePref.isPending || prefs.isLoading}
            onChange={(v) => updatePref.mutate({ reminders: v })} />
        </div>
      </section>

      {/* Concerned student sheet */}
      <Sheet open={!!selectedFee} onOpenChange={(o) => !o && setSelectedFee(null)}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-[2rem] p-0">
          {selectedFee?.data && (
            <div className="px-5 pt-3 pb-6">
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-border" />
              <h2 className="text-lg font-extrabold">{selectedFee.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Élève concerné — touchez pour payer.
              </p>
              <button
                type="button"
                onClick={() => {
                  const d = selectedFee.data!;
                  setPayCtx({
                    feeId: d.feeId!,
                    studentId: d.studentId!,
                    studentName: d.studentName ?? "Élève",
                    amount: Number(d.amount ?? 0),
                    currency: d.currency ?? "CDF",
                    label: d.label ?? selectedFee.title,
                  });
                  setSelectedFee(null);
                }}
                className="mt-4 flex w-full items-center gap-3 rounded-2xl bg-card p-4 text-left shadow-[var(--shadow-card)]"
              >
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-accent text-accent-foreground font-bold">
                    {initials(selectedFee.data.studentName ?? "EL")}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-extrabold">
                    {selectedFee.data.studentName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {selectedFee.data.label}
                  </p>
                  <p className="mt-1 text-sm font-bold text-primary">
                    {formatNumber(Number(selectedFee.data.amount ?? 0))} {selectedFee.data.currency}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AvadaPaySheet
        open={!!payCtx}
        onOpenChange={(o) => !o && setPayCtx(null)}
        context={payCtx}
      />
    </ParentShell>
  );
}

function PrefRow({ icon, label, checked, onChange, disabled }: { icon: React.ReactNode; label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">{icon}</span>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}
function Divider() { return <div className="mx-4 border-t border-border" />; }
function formatDate(s: string) {
  try { return new Date(s).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch { return s; }
}