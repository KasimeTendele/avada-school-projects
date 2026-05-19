export interface ListParams {
  page: number;
  limit: number;
  search: string | null;
  sort: { field: string; ascending: boolean }[];
  filters: Record<string, Record<string, unknown>>;
}

export function parseListParams(url: URL): ListParams {
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("limit") ?? "20") || 20),
  );
  const search = url.searchParams.get("search");
  const sortRaw = url.searchParams.get("sort");
  const sort = (sortRaw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) =>
      s.startsWith("-")
        ? { field: s.slice(1), ascending: false }
        : { field: s, ascending: true },
    );
  let filters: Record<string, Record<string, unknown>> = {};
  const filtersRaw = url.searchParams.get("filters");
  if (filtersRaw) {
    try {
      filters = JSON.parse(filtersRaw);
    } catch {
      filters = {};
    }
  }
  return { page, limit, search, sort, filters };
}

// Apply standard {eq, neq, gt, gte, lt, lte, in, like, ilike} filters to a Supabase query builder.
// deno-lint-ignore no-explicit-any
export function applyFilters(query: any, filters: ListParams["filters"]): any {
  for (const [field, ops] of Object.entries(filters)) {
    for (const [op, value] of Object.entries(ops)) {
      switch (op) {
        case "eq": query = query.eq(field, value); break;
        case "neq": query = query.neq(field, value); break;
        case "gt": query = query.gt(field, value); break;
        case "gte": query = query.gte(field, value); break;
        case "lt": query = query.lt(field, value); break;
        case "lte": query = query.lte(field, value); break;
        case "in": query = query.in(field, value as unknown[]); break;
        case "like": query = query.like(field, String(value)); break;
        case "ilike": query = query.ilike(field, String(value)); break;
      }
    }
  }
  return query;
}

// deno-lint-ignore no-explicit-any
export function applySort(query: any, sort: ListParams["sort"]): any {
  for (const s of sort) {
    query = query.order(s.field, { ascending: s.ascending });
  }
  return query;
}
