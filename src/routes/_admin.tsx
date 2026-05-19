import { createFileRoute, redirect, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_admin")({
  beforeLoad: ({ context, location }) => {
    if (!context.auth || context.auth.loading) return;
    if (!context.auth?.isAuthenticated) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
  },
  component: AdminGate,
});

function AdminGate() {
  const { roles, loading } = useAuth();
  const navigate = useNavigate();
  const isCashierOnly = !loading && roles.includes("cashier") && !roles.some((r) => r === "admin" || r === "super_admin");

  useEffect(() => {
    if (isCashierOnly) navigate({ to: "/cashier", replace: true });
  }, [isCashierOnly, navigate]);

  if (loading || isCashierOnly) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </div>
    );
  }
  const allowed = roles.some((r) => r === "super_admin" || r === "admin");
  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
        <div>
          <h1 className="text-xl font-bold">Accès refusé</h1>
          <p className="mt-2 text-sm text-muted-foreground">Espace réservé au personnel de l'école.</p>
        </div>
      </div>
    );
  }
  return <Outlet />;
}
