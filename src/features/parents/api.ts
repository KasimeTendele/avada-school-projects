import { apiClient, endpoints } from "@/shared/api";
import type { CreateParentInput, ParentDto, ParentListQuery, UpdateParentInput } from "./types";

/**
 * Feature « parents » — couche d'accès HTTP.
 * Toute interaction front/back pour ce domaine passe par ces fonctions.
 */
export const parentsApi = {
  list: (query: ParentListQuery = {}) =>
    apiClient.get<ParentDto[]>(endpoints.parents.base, { query: query as Record<string, string | number | undefined> }),

  get: (id: string) =>
    apiClient.get<ParentDto>(endpoints.parents.byId(id)),

  create: (input: CreateParentInput) =>
    apiClient.post<ParentDto>(endpoints.parents.base, input),

  update: (id: string, input: UpdateParentInput) =>
    apiClient.put<ParentDto>(endpoints.parents.byId(id), input),

  remove: (id: string) =>
    apiClient.delete<{ deleted: true }>(endpoints.parents.byId(id)),
};