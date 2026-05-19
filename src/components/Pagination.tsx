import { LuChevronLeft, LuChevronRight } from "react-icons/lu";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({ page, totalPages, totalItems, pageSize, onPageChange, className }: PaginationProps) {
  if (totalPages <= 0 || (totalItems != null && totalItems === 0)) return null;

  const goto = (p: number) => {
    const next = Math.min(Math.max(1, p), totalPages);
    if (next !== page) onPageChange(next);
  };

  // Build a compact page list: 1 … p-1 p p+1 … last
  const pages: (number | "…")[] = [];
  const add = (n: number) => { if (!pages.includes(n)) pages.push(n); };
  add(1);
  if (page - 2 > 2) pages.push("…");
  for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) add(i);
  if (page + 2 < totalPages - 1) pages.push("…");
  if (totalPages > 1) add(totalPages);

  const from = pageSize ? (page - 1) * pageSize + 1 : null;
  const to = pageSize && totalItems ? Math.min(page * pageSize, totalItems) : null;

  return (
    <div className={cn("flex flex-col items-center gap-2 py-4 sm:flex-row sm:justify-between", className)}>
      {totalItems != null && from != null && to != null && (
        <p className="text-xs text-muted-foreground">
          {from}–{to} sur {totalItems}
        </p>
      )}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => goto(page - 1)}
          disabled={page <= 1}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-[var(--shadow-card)] disabled:opacity-40"
          aria-label="Page précédente"
        >
          <LuChevronLeft className="h-4 w-4" />
        </button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`e-${i}`} className="px-1 text-xs text-muted-foreground">…</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => goto(p)}
              className={cn(
                "h-9 min-w-9 rounded-xl px-3 text-xs font-bold shadow-[var(--shadow-card)]",
                p === page
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card text-foreground",
              )}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          onClick={() => goto(page + 1)}
          disabled={page >= totalPages}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-[var(--shadow-card)] disabled:opacity-40"
          aria-label="Page suivante"
        >
          <LuChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}