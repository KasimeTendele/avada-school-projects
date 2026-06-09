# Documentation des endpoints backend ↔ frontend

> Audience : développeurs humains qui reprennent le projet **Avada School**.
> Objectif : référencer **tous** les endpoints exposés par le backend
> (Supabase Edge Functions, Deno) et utilisés par le frontend React.
>
> Complète [`BACKEND.md`](./BACKEND.md) (architecture interne) et
> [`FRONTEND.md`](./FRONTEND.md) (organisation du front).

---

## 1. Vue d'ensemble

- **Base URL** : `${VITE_SUPABASE_URL}/functions/v1`
  (en prod : `https://ixtnwgkxrlukgnmdophx.supabase.co/functions/v1`).
- **Transport** : HTTPS, JSON, UTF-8.
- **Authentification** : header `Authorization: Bearer <access_token>` (JWT Supabase)
  pour tous les endpoints sauf `/auth/*` (login, register, forgot, reset, refresh).
- **Format de réponse standard** (`supabase/functions/_shared/response.ts`) :

```jsonc
// succès
{ "success": true, "message": "...", "data": { ... },
  "meta": { "requestId": "...", "timestamp": "..." } }

// erreur
{ "success": false, "message": "...",
  "error": { "code": "VALIDATION_ERROR", "type": "VALIDATION", "details": [...] },
  "meta": { "requestId": "...", "timestamp": "..." } }
```

Codes d'erreur possibles : `BAD_REQUEST`, `UNAUTHORIZED`, `TOKEN_EXPIRED`,
`FORBIDDEN`, `SCOPE_FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `VALIDATION_ERROR`,
`RATE_LIMIT_EXCEEDED`, `INTERNAL_ERROR`.

- **Client front centralisé** : `src/shared/api/client.ts` (`apiClient`).
  Aucun composant React ne doit appeler `supabase.from(...)` directement.
- **Catalogue des chemins** : `src/shared/api/endpoints.ts`.
- **Sur 401** : le client déconnecte la session et redirige vers `/login`.

### Paramètres de liste communs

Pour les endpoints paginés (`parseListParams`) :

| Param         | Type      | Description                                  |
|---------------|-----------|----------------------------------------------|
| `page`        | int       | Numéro de page (1-based, défaut 1)           |
| `limit`       | int       | Taille de page (défaut 20, max 100)          |
| `search`      | string    | Recherche plein-texte                        |
| `sort`        | string    | Ex : `created_at:desc,name:asc`              |
| `filter[key]` | string    | Filtres dynamiques (`filter[status]=ACTIVE`) |

Réponse paginée :
```jsonc
{ "items": [...], "page": 1, "limit": 20, "totalItems": 57,
  "totalPages": 3, "hasNextPage": true, "hasPrevPage": false,
  "nextPage": 2, "prevPage": null }
```

### Rôles (`app_role`)

`super_admin`, `admin` (école), `cashier` (caissier école), `parent`.
Stockés dans la table `user_roles`. Les fonctions utilisent
`requireAuth` + `hasAnyRole` ; les RLS Postgres font la double sécurité.

---

## 2. Auth (`/auth`)

Public — pas de Bearer requis (sauf `change-password`).

| Méthode | Route                    | Description                                              |
|---------|--------------------------|----------------------------------------------------------|
| POST    | `/auth/login`            | `{ email, password }` → `{ accessToken, refreshToken, user }` |
| POST    | `/auth/register`         | `{ email, password, full_name?, phone?, role? }`         |
| POST    | `/auth/forgot-password`  | `{ email, redirect_to? }` — toujours 200 (anti-enum)     |
| POST    | `/auth/reset-password`   | `{ access_token, refresh_token?, new_password }`         |
| POST    | `/auth/refresh`          | `{ refresh_token }` → nouveau couple de tokens           |
| POST    | `/auth/change-password`  | **Bearer requis.** `{ current_password, new_password }`  |

Côté front : `src/features/auth/password.ts`, `src/lib/auth-context.tsx`,
routes `/login`, `/forgot-password`, `/reset-password`.

---

## 3. Utilisateur courant (`/users-me`)

Bearer requis.

| Méthode | Route                              | Description                                  |
|---------|------------------------------------|----------------------------------------------|
| GET     | `/users-me`                        | Profil + rôles + école principale            |
| PATCH   | `/users-me`                        | Met à jour le profil (`full_name`, `phone`, `avatar_url`, …) |
| PATCH   | `/users-me/password`               | Change le mot de passe (alias de `/auth/change-password`) |
| GET     | `/users-me/preferences/notifications` | Préférences notifications                 |
| PATCH   | `/users-me/preferences/notifications` | `{ payments?, reminders?, news?, push?, email? }` |
| PUT     | `/users-me/push-token`             | `{ token, platform, device_id? }`            |

---

## 4. Administration globale (super_admin)

### 4.1 Écoles — `/admin-schools`

| Méthode | Route                  | Description                                  |
|---------|------------------------|----------------------------------------------|
| GET     | `/admin-schools`       | Liste paginée (super_admin) ou écoles liées (admin) |
| GET     | `/admin-schools/:id`   | Détail école                                 |
| POST    | `/admin-schools`       | Crée une école                               |
| PATCH   | `/admin-schools/:id`   | Met à jour                                   |
| DELETE  | `/admin-schools/:id`   | Supprime                                     |

### 4.2 Utilisateurs internes — `/admin-users`

CRUD des admins/caissiers (super_admin).

| Méthode | Route                          | Description                          |
|---------|--------------------------------|--------------------------------------|
| GET     | `/admin-users`                 | Liste paginée + filtres `role`, `school_id` |
| GET     | `/admin-users/:id`             | Détail (profil + rôles + écoles)     |
| POST    | `/admin-users`                 | Crée user + rôle + liens écoles      |
| PATCH   | `/admin-users/:id`             | Met à jour rôle / écoles / statut    |
| PATCH   | `/admin-users/:id/profile`     | Met à jour profil                    |

### 4.3 Parents — `/admin-parents`

Admin école / super_admin.

| Méthode | Route                                              | Description                          |
|---------|----------------------------------------------------|--------------------------------------|
| GET     | `/admin-parents`                                   | Liste (filtres `schoolId`, `search`, pagination) |
| GET     | `/admin-parents/:id`                               | Détail parent + enfants              |
| POST    | `/admin-parents`                                   | Crée parent (+ mot de passe initial, liens enfants) |
| PATCH   | `/admin-parents/:id`                               | Met à jour                           |
| DELETE  | `/admin-parents/:id`                               | Supprime                             |
| POST    | `/admin-parents/import`                            | Import CSV/Excel en lot              |
| GET     | `/admin-parents/search-exact?email=...&phone=...`  | Recherche exacte (dédup)             |
| GET     | `/admin-parents/by-school?schoolId=...`            | Parents d'une école                  |
| GET     | `/admin-parents/students/:studentId/parents`       | Parents liés à un élève              |
| POST    | `/admin-parents/link`                              | `{ parent_user_id, student_id, relationship? }` |
| DELETE  | `/admin-parents/link/:linkId`                      | Supprime un lien parent-élève        |

### 4.4 Collections (versements) — `/admin-collections`

| Méthode | Route                  | Description                                  |
|---------|------------------------|----------------------------------------------|
| GET     | `/admin-collections`   | Liste des collectes (filtre `schoolId`, périodes) |

### 4.5 Dashboard admin — `/admin-dashboard`

| Méthode | Route                  | Description                                  |
|---------|------------------------|----------------------------------------------|
| GET     | `/admin-dashboard`     | KPIs école/globaux (revenus, impayés, etc.)  |

---

## 5. Caisse (cashier)

### 5.1 Dashboard — `/cashier-dashboard`

| Méthode | Route                            | Description                            |
|---------|----------------------------------|----------------------------------------|
| GET     | `/cashier-dashboard/:schoolId`   | Encaissements du jour, totaux, alertes |

---

## 6. Élèves & classes

### 6.1 `/students`

| Méthode | Route                  | Description                                  |
|---------|------------------------|----------------------------------------------|
| GET     | `/students`            | Liste paginée (RLS par école)                |
| POST    | `/students`            | Crée un élève                                |
| POST    | `/students/import`     | Import en lot                                |
| PUT     | `/students/:id`        | Met à jour                                   |
| DELETE  | `/students/:id`        | Supprime                                     |

### 6.2 Élèves d'un parent — `/students-by-parent`

| Méthode | Route                  | Description                                  |
|---------|------------------------|----------------------------------------------|
| GET     | `/students-by-parent`  | Enfants liés au parent connecté (vide pour autres rôles) |

### 6.3 Classes — `/classes`

| Méthode | Route        | Description                                      |
|---------|--------------|--------------------------------------------------|
| GET     | `/classes`   | Liste des classes (filtre `school_id`, `academic_year`) |

---

## 7. Frais & paiements

### 7.1 Frais — `/fees`

| Méthode | Route                              | Description                          |
|---------|------------------------------------|--------------------------------------|
| GET     | `/fees`                            | Vue globale (RLS par rôle)           |
| GET     | `/fees/by-school/:schoolId`        | Frais d'une école + `paid`/`remaining` agrégés |
| POST    | `/fees`                            | Crée un frais (scope `STUDENT`/`CLASS`/`SCHOOL`) — déclenche notifications parents |

Body POST : `{ school_id, scope, label, fee_type, amount, currency?,
due_date?, academic_year?, class_id?, student_id? }`.

### 7.2 Frais d'un parent — `/fees-by-parent`

| Méthode | Route                  | Description                                  |
|---------|------------------------|----------------------------------------------|
| GET     | `/fees-by-parent`      | Frais dus pour les enfants du parent connecté |

### 7.3 Paiements — `/payments`

| Méthode | Route                          | Description                                  |
|---------|--------------------------------|----------------------------------------------|
| GET     | `/payments`                    | Liste paginée (RLS par école / parent)       |
| GET     | `/payments/:id`                | Détail                                       |
| POST    | `/payments/initiate`           | Démarre un paiement AvadaPay → URL de redirection |
| POST    | `/payments/:id/verify`         | Force la vérif côté provider                 |
| POST    | `/payments/:id/cancel`         | Annule un paiement en attente                |

### 7.4 Webhook AvadaPay — `/payments-callback`

- `POST /payments-callback` — appelé par AvadaPay.
- **Pas d'auth Bearer** (`verify_jwt = false` dans `supabase/config.toml`).
- La signature `X-AvadaPay-Signature` est vérifiée dans le handler.
- Met à jour `payments.status` et insère le `receipts` correspondant.

### 7.5 Reçus — `/receipts`

| Méthode | Route                  | Description                                  |
|---------|------------------------|----------------------------------------------|
| GET     | `/receipts/:id/pdf`    | Stream PDF du reçu (Content-Type `application/pdf`) |

---

## 8. Notifications — `/notifications`

Bearer requis.

| Méthode | Route                          | Description                                  |
|---------|--------------------------------|----------------------------------------------|
| GET     | `/notifications`               | Liste paginée du user courant                |
| PATCH   | `/notifications/read-all`      | Marque tout comme lu                         |
| PATCH   | `/notifications/:id/read`      | Marque une notif comme lue                   |

Job SQL `dispatch_fee_reminders()` (cron Supabase) crée les rappels de frais
impayés en respectant `notification_preferences.reminders`.

---

## 9. Matrice endpoint ↔ front

| Endpoint                  | Catalogue (`endpoints.ts`) | Module front principal                       |
|---------------------------|----------------------------|----------------------------------------------|
| `/auth/*`                 | `endpoints.auth`           | `src/lib/auth-context.tsx`, routes `/login`, `/forgot-password`, `/reset-password` |
| `/users-me`               | `endpoints.users.me`       | `src/routes/_authenticated.profile.tsx`, `_admin.admin.profile.tsx`, `_cashier.cashier.profile.tsx` |
| `/admin-schools`          | `endpoints.schools`        | `_admin.admin.schools.*`                     |
| `/admin-parents`          | `endpoints.parents`        | `src/features/parents/*`, `_admin.admin.parents.tsx` |
| `/admin-users`            | (ad hoc)                   | `_admin.admin.users.*`                       |
| `/admin-collections`      | `endpoints.collections`    | `_admin.admin.collections.tsx`, `_cashier.cashier.collections.tsx` |
| `/admin-dashboard`        | `endpoints.dashboards.admin` | `_admin.admin.index.tsx`                   |
| `/cashier-dashboard`      | `endpoints.dashboards.cashier` | `_cashier.cashier.index.tsx`             |
| `/students`               | `endpoints.students`       | `_admin.admin.students*`, `_cashier.cashier.students.tsx` |
| `/students-by-parent`     | `endpoints.students.byParent` | `_authenticated.children.tsx`             |
| `/classes`                | `endpoints.classes`        | drawers de création d'élève / frais          |
| `/fees`                   | `endpoints.fees`           | `_admin.admin.fees.tsx`                      |
| `/fees-by-parent`         | `endpoints.fees.byParent`  | `_authenticated.home.tsx`, `_authenticated.payments.tsx` |
| `/payments`               | `endpoints.payments`       | `_authenticated.payments.tsx`, `_authenticated.transactions.tsx`, `AvadaPaySheet` |
| `/payments-callback`      | `endpoints.payments.callback` | (webhook AvadaPay, pas appelé par le front) |
| `/receipts/:id/pdf`       | `endpoints.receipts.byId`  | `_authenticated.receipts.*`                  |
| `/notifications`          | `endpoints.notifications`  | `_*.notifications.tsx`                       |

---

## 10. Conventions à respecter quand on ajoute un endpoint

1. **Créer la fonction edge** sous `supabase/functions/<nom>/index.ts` en
   utilisant `Router` + `requireAuth` + `ok`/`paginated`/`errors`.
2. **Ajouter le chemin** dans `src/shared/api/endpoints.ts` (jamais d'URL
   en dur dans les composants).
3. **Créer un module feature** (`src/features/<domaine>/api.ts`) qui appelle
   `apiClient.get/post/put/patch/delete` et expose des fonctions typées.
4. **Définir les DTO** dans `src/features/<domaine>/types.ts` (miroir du
   backend) et exporter des hooks React Query dans `hooks.ts`.
5. **Sécurité** : RLS Postgres + vérification de scope dans la fonction
   (`hasAnyRole`, `admin_has_school`, `is_parent_of_student`).
6. **Déployer** la fonction (`supabase functions deploy <nom>`) et
   documenter la nouvelle route dans ce fichier.

---

_Dernière mise à jour : 2026-06-09._