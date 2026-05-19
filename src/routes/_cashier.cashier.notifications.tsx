import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LuBell as Bell, LuCircleCheck as CheckCircle } from "react-icons/lu";
import { CashierShell } from "@/components/CashierShell";
import { CashierTopBar, PageTitle } from "@/components/CashierTopBar";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/format";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  created_at: string;
  read: boolean;
}

export const Route = createFileRoute("/_cashier/cashier/notifications")({
  head: () => ({ meta: [{ title: "Notifications caisse — Avada School" }] }),
  component: CashierNotifs,
});

function CashierNotifs() {
  const { data, isLoading } = useQuery({
    queryKey: ["cashier-notifications"],
    queryFn: () => apiFetch<{ items: Notification[] }>(`/notifications?limit=50&sort=-created_at`),
  });
  const items = data?.items ?? [];
  const unread = items.filter((n) => !n.read).length;

  return (
    <CashierShell>
      <CashierTopBar
        notifBadge={unread}
        subtitle={
          <>
            <Bell className="h-3 w-3" />
            {unread} non lue{unread > 1 ? "s" : ""} · {items.length} au total
          </>
        }
      />

      <main className="px-4 py-6 lg:px-8">
        <PageTitle
          title="Notifications"
          description="Suivi des opérations d'encaissement"
        />

        <section className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[var(--shadow-card)]">
          {isLoading && (
            <div className="space-y-2 p-5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted/60" />
              ))}
            </div>
          )}

          {!isLoading && items.length === 0 && (
            <p className="p-10 text-center text-sm text-muted-foreground">
              Aucune notification pour l'instant.
            </p>
          )}

          <ul className="divide-y divide-border/60">
            {items.map((n) => {
              const date = new Date(n.created_at);
              const time = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
              const isToday = new Date().toDateString() === date.toDateString();
              return (
                <li key={n.id} className="flex items-start gap-3 px-5 py-4 transition hover:bg-muted/30">
                  <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Bell className="h-5 w-5" />
                    {!n.read && (
                      <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-card" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-extrabold">{n.title}</p>
                      <p className="shrink-0 text-[11px] text-muted-foreground">
                        {isToday ? time : formatDate(n.created_at, { day: "2-digit", month: "short" })}
                      </p>
                    </div>
                    {n.message && (
                      <p className="mt-1 line-clamp-2 text-xs text-foreground/80">{n.message}</p>
                    )}
                    {n.read && (
                      <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                        <CheckCircle className="h-2.5 w-2.5" /> Lue
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    </CashierShell>
  );
}
