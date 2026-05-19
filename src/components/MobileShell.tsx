import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Centers app content in a mobile-first frame on tablet.
 * On desktop (lg+), expands to full width to host a sidebar layout.
 */
export function MobileShell({
  children,
  className,
  desktopFull = false,
}: {
  children: ReactNode;
  className?: string;
  /** When true, the shell expands full-width on lg+ to host a desktop sidebar layout. */
  desktopFull?: boolean;
}) {
  return (
    <div className={cn("min-h-screen w-full bg-muted/40 sm:py-6", desktopFull && "lg:py-0")}>
      <div
        className={cn(
          "relative mx-auto min-h-screen w-full max-w-[480px] overflow-y-auto overflow-x-hidden bg-background scrollbar-hide",
          "sm:min-h-[calc(100vh-3rem)] sm:rounded-[2rem] sm:shadow-[var(--shadow-elevated)]",
          desktopFull &&
            "lg:max-w-none lg:min-h-screen lg:rounded-none lg:shadow-none lg:overflow-visible",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
