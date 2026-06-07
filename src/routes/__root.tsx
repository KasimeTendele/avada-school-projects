import { Outlet, Link, createRootRouteWithContext, HeadContent, Scripts, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth, type AppRole } from "@/lib/auth-context";
import { Toaster } from "@/components/ui/sonner";
import { MobileAppPrompt } from "@/components/MobileAppPrompt";

import appCss from "../styles.css?url";
import faviconUrl from "@/assets/avada-logo.png?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

interface RouterContext {
  queryClient: QueryClient;
  auth: {
    isAuthenticated: boolean;
    loading: boolean;
    roles: AppRole[];
    hasRole: (r: AppRole) => boolean;
    hasAnyRole: (rs: AppRole[]) => boolean;
  };
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#2DD4B0" },
      { title: "Avada School — Paiement de frais scolaires simplifié" },
      { name: "description", content: "Avada School : payez les frais scolaires en quelques clics, gérez les encaissements et suivez la scolarité de vos enfants en toute sérénité." },
      { name: "author", content: "Avada School" },
      { property: "og:title", content: "Avada School — Paiement de frais scolaires simplifié" },
      { property: "og:description", content: "Avada School : payez les frais scolaires en quelques clics, gérez les encaissements et suivez la scolarité de vos enfants en toute sérénité." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Avada School — Paiement de frais scolaires simplifié" },
      { name: "twitter:description", content: "Avada School : payez les frais scolaires en quelques clics, gérez les encaissements et suivez la scolarité de vos enfants en toute sérénité." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/38LTs1eb1aOywklxGEPQ8aKh4583/social-images/social-1777670709749-avada-logo2.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/38LTs1eb1aOywklxGEPQ8aKh4583/social-images/social-1777670709749-avada-logo2.webp" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/png", href: faviconUrl },
      { rel: "apple-touch-icon", href: faviconUrl },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => {
    // Default theme = light; only change if user picked something in Settings.
    try {
      const saved = window.localStorage.getItem("avada.theme") as "light" | "dark" | "system" | null;
      const t = saved ?? "light";
      const dark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark", dark);
    } catch {}
  }, []);
  useEffect(() => {
    const onError = (e: PromiseRejectionEvent | ErrorEvent) => {
      const msg =
        (e as PromiseRejectionEvent).reason?.message ??
        (e as ErrorEvent).message ??
        "";
      if (
        typeof msg === "string" &&
        /dynamically imported module|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
          msg,
        )
      ) {
        const key = "__chunk_reload_at";
        const last = Number(sessionStorage.getItem(key) ?? 0);
        if (Date.now() - last > 10000) {
          sessionStorage.setItem(key, String(Date.now()));
          window.location.reload();
        }
      }
    };
    window.addEventListener("unhandledrejection", onError);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onError);
      window.removeEventListener("error", onError);
    };
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthBridge />
        <Toaster position="top-center" richColors closeButton />
        <MobileAppPrompt />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function AuthBridge() {
  const auth = useAuth();
  const router = useRouter();
  useEffect(() => {
    router.update({
      context: { ...router.options.context, auth },
    });
    router.invalidate();
    // Only re-run when auth identity/loading state actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.isAuthenticated, auth.loading, auth.roles.join(","), router]);
  return <Outlet />;
}
