import type { ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { LuHouse as Home, LuUsers as Users, LuCreditCard as CreditCard, LuBell as Bell, LuUser as User } from "react-icons/lu";
import { MobileShell } from "@/components/MobileShell";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/home", label: "ACCUEIL", Icon: Home },
  { to: "/children", label: "ENFANTS", Icon: Users },
  { to: "/payments", label: "PAYER", Icon: CreditCard },
  { to: "/notifications", label: "ALERTES", Icon: Bell },
  { to: "/profile", label: "PROFIL", Icon: User },
] as const;

export function ParentShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <MobileShell>
      <div className="flex min-h-screen sm:min-h-[calc(100vh-3rem)] flex-col">
        <div className="flex-1 pb-24">{children}</div>
        <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-[480px] -translate-x-1/2 border-t border-border bg-card">
          <div className="grid grid-cols-5">
            {tabs.map(({ to, label, Icon }) => {
              const active = pathname === to || pathname.startsWith(to + "/");
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    "flex flex-col items-center gap-1 py-3 text-[10px] font-semibold tracking-wide transition-colors",
                    active ? "text-primary" : "text-foreground/70",
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.2 : 1.7} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </MobileShell>
  );
}
