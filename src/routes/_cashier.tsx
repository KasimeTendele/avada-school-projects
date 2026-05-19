import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_cashier")({
  beforeLoad: ({ context, location }) => {
    if (!context.auth || context.auth.loading) return;
    if (!context.auth?.isAuthenticated) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
  },
  component: CashierGate,
});

function CashierGate() {
  const { roles, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </div>
    );
  }
  const allowed = roles.some((r) => r === "cashier" || r === "admin" || r === "super_admin");
  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
        <div>
          <h1 className="text-xl font-bold">Accès refusé</h1>
          <p className="mt-2 text-sm text-muted-foreground">Espace réservé aux caissiers.</p>
        </div>
      </div>
    );
  }
  return <Outlet />;
}
