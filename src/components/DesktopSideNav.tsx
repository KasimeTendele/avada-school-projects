import { Link, useLocation } from "@tanstack/react-router";
import type { ComponentType, SVGProps } from "react";
import { LuLogOut as LogOut } from "react-icons/lu";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

export interface SideNavItem {
  to: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  exact?: boolean;
}

interface Props {
  brand: string;
  subtitle?: string;
  items: readonly SideNavItem[];
}

/**
 * Desktop-only left sidebar navigation. Hidden below `lg`.
 */
export function DesktopSideNav({ brand, subtitle, items }: Props) {
  const { pathname } = useLocation();
  const { profile, signOut } = useAuth();

  return (
    <aside className="hidden lg:flex lg:w-64 xl:w-72 shrink-0 flex-col border-r border-border bg-card">
      <div className="px-6 pt-8 pb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {subtitle ?? "Espace"}
        </p>
        <h1 className="mt-1 text-xl font-extrabold text-foreground">{brand}</h1>
      </div>

      <nav className="flex-1 px-3">
        <ul className="space-y-1">
          {items.map(({ to, label, Icon, exact }) => {
            const active = exact
              ? pathname === to
              : pathname === to || pathname.startsWith(to + "/");
            return (
              <li key={to}>
                <Link
                  to={to as "/"}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-colors",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-foreground/75 hover:bg-accent hover:text-foreground",
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="capitalize">{label.toLowerCase()}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border px-4 py-4">
        <div className="flex items-center gap-3 px-2 pb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
            {(profile?.full_name ?? profile?.email ?? "U").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{profile?.full_name ?? "Utilisateur"}</p>
            <p className="truncate text-xs text-muted-foreground">{profile?.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => signOut()}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-foreground/75 hover:bg-accent hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Se déconnecter
        </button>
      </div>
    </aside>
  );
}
