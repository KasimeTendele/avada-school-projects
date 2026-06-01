# Plan de migration progressive

Cette première itération a posé les fondations :

- `src/shared/api/` (client HTTP, types, catalogue d'endpoints)
- `src/features/parents/` (feature pilote complète : api + hooks + types)
- `src/features/auth/password.ts` (helper changement mdp)
- Endpoint backend `POST /auth/change-password`
- `src/lib/api.ts` devenu un alias de compatibilité vers `apiClient`
- Docs frontend / backend

## Reste à faire (à dérouler par un dev humain)

Pour chaque domaine ci-dessous, créer `src/features/<domaine>/{types,api,hooks,index}.ts`
sur le modèle de `parents/`, puis remplacer les usages dans les routes par les hooks.
Supprimer ensuite les appels `supabase.from(...)` résiduels.

### Domaines à migrer

- [ ] `students` — `/students`, `/students-by-parent`
- [ ] `schools` — `/admin-schools`
- [ ] `users` — `/admin-users`, `/users-me`
- [ ] `classes` — `/classes`
- [ ] `fees` — `/fees`, `/fees-by-parent`
- [ ] `collections` — `/admin-collections`
- [ ] `payments` — `/payments`
- [ ] `receipts` — `/receipts`
- [ ] `notifications` — `/notifications`
- [ ] `dashboards` — `/admin-dashboard`, `/cashier-dashboard`
- [ ] `auth` — déplacer `src/lib/auth-context.tsx` sous `src/features/auth/`

### Étapes par domaine

1. **Audit** : `rg "supabase\.from\('<table>'" src/` pour repérer les appels directs.
2. **Types** : déclarer les DTOs depuis `docs/BACKEND.md`.
3. **API** : 5–10 lignes par opération via `apiClient` + `endpoints.<domaine>`.
4. **Hooks** : `useQuery` / `useMutation` (conventions `queryKey` : `["<feature>"]`, `["<feature>","list", params]`, `["<feature>","detail", id]`).
5. **Routes** : remplacer chaque `useQuery` avec `supabase.from(...)` par le hook.
6. **Nettoyage** : supprimer l'import `supabase` quand plus utilisé.

### Critères de validation finale

- `rg "supabase\.from\(" src/routes src/components` ne retourne rien.
- Seuls `src/lib/auth-context.tsx`, `src/features/auth/*` et `src/lib/upload.ts`
  peuvent encore importer `supabase` (auth + storage).
- Aucun composant n'appelle `apiClient` directement : toujours via un hook.

### Améliorations backend optionnelles

- Validation d'input centralisée avec `zod` dans `_shared/validation.ts`.
- Middleware `requireRole(roles[])` dans `_shared/auth.ts`.
- Pagination standardisée (`?page=&limit=`) sur tous les endpoints list.
- Rate-limit.
- Tests d'intégration HTTP via `bunx vitest` + `apiClient`.