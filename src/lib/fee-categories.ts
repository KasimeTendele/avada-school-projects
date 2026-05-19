// Liste fixe des catégories de frais + champ libre.
// La catégorie est stockée dans `fees.fee_type` (text).

export const FEE_CATEGORIES = [
  "Frais scolaires",
  "Transport",
  "Cantine",
  "Uniformes",
  "Examens",
  "Activités extrascolaires",
] as const;

export type FeeCategory = (typeof FEE_CATEGORIES)[number] | string;

export function isCustomCategory(c: string | null | undefined): boolean {
  if (!c) return false;
  return !FEE_CATEGORIES.includes(c as (typeof FEE_CATEGORIES)[number]);
}
