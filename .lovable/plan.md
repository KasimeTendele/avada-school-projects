# Plan : Restructuration scalable Frontend / Backend + Documentation

## Objectif
Séparer clairement les responsabilités frontend / backend, garantir que toute communication passe uniquement par des API HTTP, et livrer deux documentations distinctes destinées aux développeurs frontend et backend humains qui reprendront le projet.

## État actuel
- **Backend** : Supabase Edge Functions (`supabase/functions/*`) — `auth`, `admin-users`, `admin-parents`, `admin-schools`, `admin-collections`, `students`, `fees`, `payments`, `receipts`, `notifications`, etc. Router maison + helpers partagés (`_shared/auth.ts`, `response.ts`, `router.ts`, `cors.ts`).
- **Frontend** : TanStack Start / React, routes dans `src/routes/*`, accès Supabase mixte :
  - `src/lib/api.ts` → appels REST aux edge functions (✅ bonne pratique)
  - Mais aussi appels directs `supabase.from(...)` dans plusieurs composants/routes (auth-context, profile, etc.) → couplage direct à la base.

Problème principal : le frontend mélange deux modes d'accès (API HTTP + SDK Supabase direct). Cela casse la frontière "communication uniquement par API".

## Stratégie de restructuration

### 1. Frontend — couche d'accès unique
Réorganiser `src/` autour d'une couche service unique :

```
src/
├── app/                    # routes + shells (UI pure)
│   └── routes/             # (déplacement de src/routes)
├── features/               # logique métier par domaine
│   ├── auth/
│   ├── parents/
│   ├── students/
│   ├── fees/
│   ├── payments/
│   └── notifications/
│       ├── api.ts          # appels HTTP au backend (via apiClient)
│       ├── hooks.ts        # React Query hooks
│       ├── types.ts        # types DTO partagés avec le backend
│       └── components/
├── shared/
│   ├── api/
│   │   ├── client.ts       # apiClient (fetch + auth header + erreurs)
│   │   ├── endpoints.ts    # constantes de chemins API
│   │   └── types.ts        # ApiResponse<T>, ApiError, Paginated<T>
│   ├── ui/                 # composants shadcn (ex src/components/ui)
│   ├── components/         # composants partagés (Shells, DataTable…)
│   ├── hooks/
│   └── lib/                # utils, format, fee-categories
└── integrations/supabase/  # UNIQUEMENT auth client (login/session/refresh)
```

**Règle d'or frontend :**
- Tous les accès aux données → `features/*/api.ts` → `apiClient` → edge functions.
- `supabase` n'est utilisé QUE pour : `signIn`, `signOut`, `signUp`, `resetPasswordForEmail`, `updateUser` (mot de passe), `getSession`, `onAuthStateChange`, et l'upload de fichiers vers Storage (avatars, photos).
- Plus aucun `supabase.from('...').select()` dans les composants ou routes.

### 2. Backend — API REST homogène
Restructurer `supabase/functions/` autour de domaines clairs, formaliser le contrat :

```
supabase/functions/
├── _shared/
│   ├── auth.ts             # requireAuth, requireRole
│   ├── router.ts
│   ├── response.ts         # ok / fail / paginated (déjà ok)
│   ├── cors.ts
│   ├── validation.ts       # helpers zod-like (validation centralisée)
│   └── errors.ts           # codes d'erreur typés
├── auth/                   # /auth/login, /register, /forgot, /reset, /refresh, /change-password
├── users/                  # /users/me, /users/:id (admin)
├── schools/                # CRUD écoles (super_admin)
├── parents/                # CRUD parents (admin école)
├── students/               # CRUD élèves
├── classes/
├── fees/
├── collections/
├── payments/               # initiate, callback, status
├── receipts/
├── notifications/
└── dashboards/             # admin-dashboard, cashier-dashboard
```

**Contrat API uniforme** (déjà partiellement en place via `response.ts`) :
- Succès : `{ success: true, message, data, meta: { requestId, timestamp } }`
- Erreur : `{ success: false, message, error: { code, type, details }, meta }`
- Pagination : `{ items, page, limit, totalItems, totalPages, hasNextPage, hasPrevPage }`
- Auth : Bearer JWT Supabase dans header `Authorization`.

**Ajouts :**
- Centraliser le mapping rôle → permissions dans `_shared/auth.ts` (`requireRole(['admin','super_admin'])`).
- Ajouter un endpoint `POST /auth/change-password` pour remplacer l'appel direct `supabase.auth.updateUser` côté front.
- Versionner via préfixe logique `v1` dans la doc (les URLs Supabase Functions restent `/functions/v1/<name>`).

### 3. Types partagés
Créer `src/shared/api/types.ts` reflétant exactement les DTO renvoyés par le backend (manuellement maintenu, source de vérité = doc backend). Les types DB générés (`integrations/supabase/types.ts`) restent côté backend uniquement.

### 4. Documentation — deux fichiers distincts

**`docs/FRONTEND.md`** (≈ développeurs front)
1. Stack : TanStack Start, React 19, Tailwind v4, shadcn/ui, React Query.
2. Arborescence `src/` expliquée (app / features / shared).
3. Règle d'or : aucun accès direct à la base — uniquement `apiClient`.
4. Comment ajouter une feature (création `features/<name>/{api,hooks,types,components}`).
5. Gestion auth : `useAuth()`, session, redirection, force-change-password.
6. Design system : tokens dans `styles.css`, dark/light, thème par défaut Light.
7. Routing TanStack (file-based, route guards `_authenticated` / `_admin` / `_cashier`).
8. État serveur : conventions React Query (keys, invalidation).
9. Upload fichiers : helper `lib/upload.ts` → Supabase Storage (seule exception au principe API).
10. Tests, lint, build.

**`docs/BACKEND.md`** (≈ développeurs back)
1. Stack : Supabase (Postgres + Auth + Storage), Edge Functions Deno.
2. Architecture : router maison, middleware auth, format réponse.
3. Schéma BDD : tables principales (`profiles`, `user_roles`, `schools`, `admin_schools`, `parent_students`, `students`, `classes`, `fees`, `payments`, `notifications`...), relations, RLS.
4. Modèle de rôles : `super_admin`, `admin`, `cashier`, `parent` via `user_roles` + fonctions `has_role` / `is_super_admin` / `admin_has_school`.
5. Conventions endpoint :
   - Naming `/<resource>/...`
   - Codes d'erreur (`UNAUTHORIZED`, `FORBIDDEN`, `VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`, …)
   - Pagination standard `?page=&limit=`
6. **Catalogue des endpoints** — pour chaque domaine : méthode, chemin, rôle requis, body, query, réponse, erreurs possibles. Domaines : Auth, Users, Schools, Parents, Students, Classes, Fees, Collections, Payments (+ callback webhook), Receipts, Notifications, Dashboards.
7. Migrations : workflow (`supabase/migrations/*.sql`), conventions (GRANT après CREATE TABLE, RLS systématique).
8. Secrets : liste + usage (`AVADAPAY_*`, `SUPABASE_SERVICE_ROLE_KEY`...).
9. Webhooks : `/payments-callback` — vérification de signature AvadaPay.
10. Tâches planifiées : `dispatch_fee_reminders()` (cron pg_cron).
11. Procédures runtime : recréation super admin, reset password admin, etc.

## Travaux concrets dans cette itération

Vu l'ampleur, je propose de découper en deux livraisons. **Cette première itération** :

1. **Créer la structure de dossiers** `src/features/`, `src/shared/api/` sans casser l'existant (les anciens chemins continuent de fonctionner via ré-exports).
2. **Mettre en place `src/shared/api/client.ts`** consolidé (refactor de `src/lib/api.ts`) + `endpoints.ts` + `types.ts`.
3. **Migrer 1 feature pilote** (`parents`) vers la nouvelle structure comme exemple de référence pour les développeurs.
4. **Ajouter l'endpoint backend `POST /auth/change-password`** + remplacer les `supabase.auth.updateUser({ password })` du front par un appel API.
5. **Écrire `docs/FRONTEND.md` et `docs/BACKEND.md`** complets, avec le catalogue exhaustif des endpoints existants (même ceux pas encore migrés vers la nouvelle structure).
6. **Ajouter `docs/MIGRATION.md`** listant les features restant à déplacer (students, fees, payments, notifications, schools, users, dashboards) avec un guide pas-à-pas — pour permettre à un dev humain de continuer.

**Itérations suivantes** (hors de ce ticket, listées dans `MIGRATION.md`) : migration progressive des autres features, suppression des appels `supabase.from(...)` résiduels, ajout de tests d'intégration API.

## Détails techniques

**`shared/api/client.ts`** — successeur de `lib/api.ts` :
- Singleton `apiClient` avec méthodes `get/post/put/patch/delete`.
- Injection automatique du Bearer token (via `supabase.auth.getSession()`).
- Gestion centralisée : 401 → signOut + redirect `/login`, 403 → toast, 5xx → toast erreur, parsing `ApiResponse<T>`.
- Type generics : `apiClient.get<ParentDto[]>('/admin-parents')`.

**`features/parents/api.ts`** (exemple) :
```ts
export const parentsApi = {
  list: (params) => apiClient.get<Paginated<ParentDto>>('/admin-parents', { query: params }),
  get:  (id)     => apiClient.get<ParentDto>(`/admin-parents/${id}`),
  create:(body)  => apiClient.post<ParentDto>('/admin-parents', body),
  update:(id, b) => apiClient.put<ParentDto>(`/admin-parents/${id}`, b),
  delete:(id)    => apiClient.delete(`/admin-parents/${id}`),
};
```

**`features/parents/hooks.ts`** : `useParents()`, `useParent(id)`, `useCreateParent()`, etc., basés sur React Query (déjà installé via TanStack).

**Backend `auth/change-password`** :
```
POST /auth/change-password
Auth: Bearer required
Body: { current_password, new_password }
→ vérifie current via signInWithPassword(email, current)
→ admin.updateUserById(uid, { password: new, user_metadata: { must_change_password: false }})
→ 200 { success: true }
```

## Risques
- Refactor large → garder l'existant fonctionnel pendant la migration (pas de big-bang).
- Les routes TanStack importent encore directement `supabase` à plusieurs endroits → migrer progressivement, documenter clairement.

## Livrables de cette itération
- Dossiers `src/features/parents`, `src/shared/api`, `docs/`.
- `docs/FRONTEND.md`, `docs/BACKEND.md`, `docs/MIGRATION.md`.
- Endpoint `POST /auth/change-password` + remplacement côté front.
- README racine mis à jour pointant vers les deux docs.
