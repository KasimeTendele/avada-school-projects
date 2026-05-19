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
    // Onboarding state lives in the browser; on the server we always go to onboarding,
    // and the client will redirect to /login if it has been seen before.
    if (typeof window === "undefined") {
      throw redirect({ to: "/onboarding" });
    }
    const seen = window.localStorage.getItem("avada.onboarding.seen");
    throw redirect({ to: seen === "1" ? "/login" : "/onboarding" });
  },
  component: () => null,
});