import type { ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import {
  LuHouse as Home,
  LuGraduationCap as Students,
  LuCreditCard as CreditCard,
  LuBell as Bell,
  LuUser as User,
} from "react-icons/lu";
import { MobileShell } from "@/components/MobileShell";
import { DesktopSideNav, type SideNavItem } from "@/components/DesktopSideNav";
import { cn } from "@/lib/utils";
import { ForcePasswordChangeDialog } from "@/components/ForcePasswordChangeDialog";

const TABS: readonly SideNavItem[] = [
  { to: "/cashier", label: "ACCUEIL", Icon: Home, exact: true },
  { to: "/cashier/students", label: "ÉLÈVES", Icon: Students },
  { to: "/cashier/collections", label: "ENCAISSEMENTS", Icon: CreditCard },
  { to: "/cashier/notifications", label: "NOTIFICATIONS", Icon: Bell },
  { to: "/cashier/profile", label: "PROFIL", Icon: User },
];

export function CashierShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <MobileShell desktopFull>
      <ForcePasswordChangeDialog />
      <div className="lg:flex lg:min-h-screen">
        <DesktopSideNav brand="Caisse" subtitle="Espace caissier" items={TABS} />

        <div className="flex min-h-screen flex-1 flex-col sm:min-h-[calc(100vh-3rem)] lg:min-h-screen">
          <div className="flex-1 pb-24 lg:pb-8">
            <div className="mx-auto w-full lg:max-w-6xl">{children}</div>
          </div>

          <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-[480px] -translate-x-1/2 border-t border-border bg-card lg:hidden">
            <div className="grid grid-cols-5">
              {TABS.map(({ to, label, Icon, exact }) => {
                const active = exact
                  ? pathname === to
                  : pathname === to || pathname.startsWith(to + "/");
                return (
                  <Link
                    key={to}
                    to={to as "/cashier"}
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
