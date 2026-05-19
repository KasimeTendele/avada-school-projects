import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: ({ context, location }) => {
    // Attendre que la restauration de session soit terminée avant
    // de décider de rediriger — sinon on tourne en boucle login ↔ home
    // au rechargement (loading=true, isAuthenticated=false transitoires).
    if (context.auth?.loading) return;
    if (!context.auth?.isAuthenticated) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
  },
  component: () => <Outlet />,
});