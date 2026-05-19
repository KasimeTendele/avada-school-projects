export function formatNumber(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n));
}

export function formatDate(s: string | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString(
      "fr-FR",
      opts ?? { day: "2-digit", month: "short", year: "numeric" },
    );
  } catch {
    return s;
  }
}

export function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

export function prettyMethod(m?: string | null) {
  if (!m) return "—";
  const v = m.toLowerCase();
  if (v.includes("card")) return "Carte bancaire";
  if (v.includes("mobile") || v.includes("mtn") || v.includes("orange") || v.includes("airtel")) return "Mobile money";
  if (v.includes("cash")) return "Espèces";
  return m;
}
