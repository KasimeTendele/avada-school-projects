import type { ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import {
  LuHouse as Home,
  LuGraduationCap as GraduationCap,
  LuCreditCard as CreditCard,
  LuBell as Bell,
  LuUser as User,
  LuUsers as Users,
  LuUserRound as UserRound,
} from "react-icons/lu";
import { MobileShell } from "@/components/MobileShell";
import { DesktopSideNav, type SideNavItem } from "@/components/DesktopSideNav";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

const SUPER_ADMIN_TABS: readonly SideNavItem[] = [
  { to: "/admin", label: "ACCUEIL", Icon: Home, exact: true },
  { to: "/admin/schools", label: "ÉCOLES", Icon: GraduationCap },
  { to: "/admin/collections", label: "ENCAISSEMENTS", Icon: CreditCard },
  { to: "/admin/notifications", label: "NOTIFICATIONS", Icon: Bell },
  { to: "/admin/profile", label: "PROFIL", Icon: User },
];

const SCHOOL_ADMIN_TABS: readonly SideNavItem[] = [
  { to: "/admin", label: "ACCUEIL", Icon: Home, exact: true },
  { to: "/admin/students", label: "ÉLÈVES", Icon: Users },
  { to: "/admin/parents", label: "PARENTS", Icon: UserRound },
  { to: "/admin/fees", label: "MOTIFS", Icon: CreditCard },
  { to: "/admin/profile", label: "PROFIL", Icon: User },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { roles } = useAuth();
  const isSuper = roles.includes("super_admin");
  const tabs = isSuper ? SUPER_ADMIN_TABS : SCHOOL_ADMIN_TABS;

  return (
    <MobileShell desktopFull>
      <div className="font-inter lg:flex lg:min-h-screen">
        <DesktopSideNav
          brand={isSuper ? "Super Admin" : "Admin École"}
          subtitle="Tableau de bord"
          items={tabs}
        />

        <div className="flex min-h-screen flex-1 flex-col sm:min-h-[calc(100vh-3rem)] lg:min-h-screen">
          <div className="flex-1 pb-24 lg:pb-8">
            <div className="mx-auto w-full lg:max-w-6xl">{children}</div>
          </div>

          <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-[480px] -translate-x-1/2 border-t border-border bg-card lg:hidden">
            <div className="grid grid-cols-5">
              {tabs.map(({ to, label, Icon, exact }) => {
                const active = exact
                  ? pathname === to
                  : pathname === to || pathname.startsWith(to + "/");
                return (
                  <Link
                    key={to}
                    to={to as "/admin"}
                    className={cn(
                      "flex flex-col items-center gap-1 py-3 text-[10px] font-semibold tracking-wide transition-colors",
                      active ? "text-primary" : "text-foreground/70",
                    )}
                  >
                    <Icon className="h-5 w-5" strokeWidth={active ? 2.2 : 1.7} />
                    <span className="text-center leading-tight">{label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      </div>
    </MobileShell>
  );
}
