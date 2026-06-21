import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: ({ context }) => {
    if (context.auth?.isAuthenticated) {
      if (context.auth.loading || context.auth.roles.length === 0) return;
      const roles = context.auth.roles ?? [];
      const isCashierOnly = roles.includes("cashier") && !roles.some((r) => r === "admin" || r === "super_admin");
      const isStaff = roles.some((r) => r === "super_admin" || r === "admin" || r === "cashier");
      throw redirect({ to: isCashierOnly ? "/cashier" : (isStaff ? "/admin" : "/home") });
    }
    // Les visiteurs non connectés sont redirigés vers l'onboarding.
    // Si les termes ont déjà été acceptés, l'onboarding redirige lui-même vers le login.
    throw redirect({ to: "/onboarding" });
  },
  component: () => null,
});