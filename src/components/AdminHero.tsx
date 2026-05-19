import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { LuArrowLeft as ArrowLeft, LuSlidersHorizontal as SlidersHorizontal } from "react-icons/lu";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  subtitle?: string;
  backTo?: string;
  rightAction?: ReactNode;
  showFilter?: boolean;
  onFilterClick?: () => void;
  children?: ReactNode;
  className?: string;
}

/**
 * Teal hero header used across admin pages: back button, title, subtitle, filter action.
 */
export function AdminHero({
  title,
  subtitle,
  backTo,
  rightAction,
  showFilter,
  onFilterClick,
  children,
  className,
}: Props) {
  return (
    <header className={cn("relative bg-primary px-5 pt-8 pb-6 text-primary-foreground", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {backTo && (
            <Link
              to={backTo}
              className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/15"
              aria-label="Retour"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-extrabold leading-tight">{title}</h1>
            {subtitle && <p className="mt-0.5 text-sm text-white/85">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {rightAction}
          {showFilter && (
            <button
              type="button"
              onClick={onFilterClick}
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15"
              aria-label="Filtres"
            >
              <SlidersHorizontal className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
      {children}
    </header>
  );
}
