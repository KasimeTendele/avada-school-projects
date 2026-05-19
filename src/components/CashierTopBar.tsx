import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  LuBell as Bell,
  LuSearch as Search,
  LuMaximize as Maximize,
  LuMoon as Moon,
  LuGlobe as Globe,
  LuMail as Mail,
} from "react-icons/lu";
import { useAuth } from "@/lib/auth-context";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

export function CashierTopBar({
  subtitle,
  search,
  onSearchChange,
  searchPlaceholder = "Rechercher...",
  notifBadge,
  schoolName,
}: {
  subtitle?: ReactNode;
  search?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  notifBadge?: number;
  schoolName?: string;
}) {
  const { profile } = useAuth();
  const [internal, setInternal] = useState("");
  const value = search ?? internal;
  const setValue = onSearchChange ?? setInternal;

  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-card/90 px-4 py-3 backdrop-blur lg:px-8">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-extrabold text-foreground">
            {greeting()},{" "}
            <span className="text-primary">
              {profile?.full_name?.split(" ")[0] ?? "Caissier"}
            </span>
          </p>
          {subtitle && (
            <p className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>

        <div className="hidden flex-1 max-w-sm md:block">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-full border border-border/60 bg-muted/40 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-primary/40 focus:bg-card"
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <IconBtn label="Plein écran"><Maximize className="h-4 w-4" /></IconBtn>
          <IconBtn label="Thème"><Moon className="h-4 w-4" /></IconBtn>
          <IconBtn label="Langue"><Globe className="h-4 w-4" /></IconBtn>
          <IconBtn label="Messages" badge={3}><Mail className="h-4 w-4" /></IconBtn>
          <IconBtn label="Notifications" badge={notifBadge}><Bell className="h-4 w-4" /></IconBtn>

          <Link
            to={"/cashier/profile" as "/cashier"}
            className="ml-2 hidden items-center gap-2 rounded-full border border-border/60 bg-muted/40 py-1 pl-1 pr-3 transition hover:bg-card sm:flex"
          >
            <span
              style={{ backgroundImage: "var(--gradient-primary)" }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-black text-white"
            >
              {(profile?.full_name ?? "C").slice(0, 1).toUpperCase()}
            </span>
            <span className="hidden flex-col leading-tight md:flex">
              <span className="text-xs font-extrabold">
                {profile?.full_name ?? "Caissier"}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {schoolName ?? "Avada School"}
              </span>
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}

function IconBtn({
  children,
  label,
  badge,
}: {
  children: ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <button
      aria-label={label}
      className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-muted/40 text-foreground/70 transition hover:border-primary/40 hover:text-primary"
    >
      {children}
      {badge !== undefined && badge > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-black text-primary-foreground">
          {badge}
        </span>
      )}
    </button>
  );
}

export function PageTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
