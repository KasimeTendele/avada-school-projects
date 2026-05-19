import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
  width?: string;
}

interface Props<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  loading?: boolean;
  caption?: ReactNode;
  className?: string;
}

/**
 * Professional data table for desktop dashboards.
 * Sticky header, zebra rows, hover state, optional row click.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty,
  loading,
  caption,
  className,
}: Props<T>) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]", className)}>
      {caption && (
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-3 text-sm font-semibold text-foreground/80">
          {caption}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  style={c.width ? { width: c.width } : undefined}
                  className={cn(
                    "px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground",
                    c.headerClassName,
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Chargement…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  {empty ?? "Aucune donnée."}
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((row, idx) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    "border-t border-border transition-colors",
                    idx % 2 === 1 ? "bg-muted/20" : "bg-card",
                    onRowClick && "cursor-pointer hover:bg-accent/60",
                  )}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cn("px-4 py-3 align-middle", c.className)}>
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
