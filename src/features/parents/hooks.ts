import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parentsApi } from "./api";
import type { CreateParentInput, ParentListQuery, UpdateParentInput } from "./types";

const keys = {
  all: ["parents"] as const,
  list: (q: ParentListQuery) => ["parents", "list", q] as const,
  detail: (id: string) => ["parents", "detail", id] as const,
};

export function useParents(query: ParentListQuery = {}) {
  return useQuery({
    queryKey: keys.list(query),
    queryFn: () => parentsApi.list(query),
  });
}

export function useParent(id: string | undefined) {
  return useQuery({
    queryKey: keys.detail(id ?? "__none__"),
    queryFn: () => parentsApi.get(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateParent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateParentInput) => parentsApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useUpdateParent(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateParentInput) => parentsApi.update(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.all });
      qc.invalidateQueries({ queryKey: keys.detail(id) });
    },
  });
}

export function useDeleteParent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => parentsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}