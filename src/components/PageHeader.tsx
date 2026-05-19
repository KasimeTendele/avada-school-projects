import type { ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { LuCornerDownLeft as CornerDownLeft } from "react-icons/lu";

export function PageHeader({
  title,
  subtitle,
  actionIcon,
  onAction,
  actionLabel,
  stats,
}: {
  title: string;
  subtitle?: string;
  actionIcon?: ReactNode;
  onAction?: () => void;
  actionLabel?: string;
  stats?: { value: string; label: string }[];
}) {
  const router = useRouter();
  return (
    <>
      <header className="bg-[image:var(--gradient-primary)] px-5 pt-8 pb-6 text-primary-foreground">
        <div className="flex items-start gap-3">
          <button
            onClick={() => router.history.back()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm"
            aria-label="Retour"
          >
            <CornerDownLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-extrabold leading-tight">{title}</h1>
            {subtitle && (
              <p className="mt-1 text-sm leading-snug text-white/85">{subtitle}</p>
            )}
          </div>
          {actionIcon && (
            <button
              onClick={onAction}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm"
              aria-label={actionLabel ?? "Action"}
            >
              {actionIcon}
            </button>
          )}
        </div>
      </header>
      {stats && stats.length > 0 && (
        <div className="bg-card">
          <div className="grid grid-cols-3 px-2 py-4">
            {stats.map((s, i) => (
              <div
                key={i}
                className={
                  "flex flex-col items-center justify-center px-2 text-center" +
                  (i > 0 ? " border-l border-border" : "")
                }
              >
                <p className="text-lg font-extrabold text-foreground leading-tight">
                  {s.value}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
