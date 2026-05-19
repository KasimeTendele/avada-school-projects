import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminShell } from "@/components/AdminShell";
import { AdminHero } from "@/components/AdminHero";

export const Route = createFileRoute("/_admin/admin/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Administration" }] }),
  component: AdminNotifications,
});

function AdminNotifications() {
  return (
    <AdminShell>
      <AdminHero title="Notifications" subtitle="Alertes système et messages." backTo="/admin" className="rounded-b-[2rem]" />
      <section className="px-4 pt-6 pb-6">
        <p className="rounded-3xl bg-card p-6 text-center text-sm text-muted-foreground shadow-[var(--shadow-card)]">
          Vos notifications administratives apparaîtront ici.{" "}
          <Link to="/notifications" className="font-bold text-primary underline">
            Voir le centre de notifications
          </Link>
        </p>
      </section>
    </AdminShell>
  );
}
