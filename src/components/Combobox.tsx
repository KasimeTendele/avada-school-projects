import * as React from "react";
import { LuChevronDown, LuCheck } from "react-icons/lu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  value: string;
  onChange: (v: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  emptyText?: string;
  /** Allow free text not in options. Default true. */
  allowCustom?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * Combobox : un select recherchable qui autorise aussi la saisie libre.
 */
export function Combobox({
  value,
  onChange,
  options,
  placeholder = "Sélectionner…",
  emptyText = "Aucun résultat",
  allowCustom = true,
  disabled,
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const selected = options.find((o) => o.value === value);
  const display = selected?.label ?? value;

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const showCreate =
    allowCustom &&
    query.trim().length > 0 &&
    !options.some((o) => o.label.toLowerCase() === query.trim().toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            !display && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{display || placeholder}</span>
          <LuChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="p-2">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher ou saisir…"
            onKeyDown={(e) => {
              if (e.key === "Enter" && allowCustom && query.trim()) {
                e.preventDefault();
                onChange(query.trim());
                setQuery("");
                setOpen(false);
              }
            }}
          />
        </div>
        <div className="max-h-60 overflow-y-auto pb-1">
          {filtered.length === 0 && !showCreate && (
            <p className="px-3 py-2 text-sm text-muted-foreground">{emptyText}</p>
          )}
          {filtered.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setQuery("");
                setOpen(false);
              }}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
            >
              <span className="truncate">{o.label}</span>
              {value === o.value && <LuCheck className="h-4 w-4" />}
            </button>
          ))}
          {showCreate && (
            <button
              type="button"
              onClick={() => {
                onChange(query.trim());
                setQuery("");
                setOpen(false);
              }}
              className="flex w-full items-center px-3 py-2 text-left text-sm text-primary hover:bg-accent"
            >
              Utiliser « {query.trim()} »
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}