# Documentation Backend — Avada School

> Public visé : développeurs **backend** qui reprennent le projet.
> Pour la partie frontend, voir [`FRONTEND.md`](./FRONTEND.md).
> Pour la feuille de route, voir [`MIGRATION.md`](./MIGRATION.md).

---

## 1. Stack

| Couche | Choix |
|---|---|
| Base de données | **Postgres** (Supabase) |
| Auth | **Supabase Auth** (email/password + JWT) |
| Storage | **Supabase Storage** (buckets publics : `avatars`, `student-photos`, `school-assets`, `staff-photos`) |
| API HTTP | **Supabase Edge Functions** (Deno, `supabase/functions/**`) |
| Migrations | SQL versionné dans `supabase/migrations/**` |
| Webhooks paiement | Endpoint `payments-callback` (signature AvadaPay) |

Toutes les fonctions edge déployées sont accessibles sous :

```
{SUPABASE_URL}/functions/v1/<function-name>/<route>
```

L'URL de base est exposée côté front via `VITE_SUPABASE_URL`.

---

## 2. Architecture des fonctions

```
supabase/
├── config.toml                # config Supabase (ne PAS éditer les sections projet)
├── migrations/                # SQL ordonné par timestamp — append-only
└── functions/
    ├── _shared/               # helpers réutilisables
    │   ├── auth.ts            # requireAuth, hasAnyRole, adminClient, userClient
    │   ├── router.ts          # micro-router (GET/POST/PUT/DELETE + paramètres)
    │   ├── response.ts        # ok / paginated / errors
    │   ├── cors.ts
    │   └── ...
    ├── auth/                  # login, register, forgot, reset, refresh, change-password
    ├── admin-users/           # CRUD admins/cashiers (super_admin)
    ├── admin-schools/         # CRUD écoles (super_admin)
    ├── admin-parents/         # CRUD parents (admin école)
    ├── admin-collections/
    ├── admin-dashboard/
    ├── cashier-dashboard/
    ├── students/
    ├── students-by-parent/
    ├── classes/
    ├── fees/
    ├── fees-by-parent/
    ├── payments/
    ├── payments-callback/     # webhook AvadaPay (verify_jwt = false)
    ├── receipts/
    ├── notifications/
    └── users-me/
```

Toute fonction expose un `Deno.serve((req) => router.handle(req))` et
s'appuie sur le middleware `requireAuth` (sauf endpoints publics).

---

## 3. Contrat de réponse uniforme

Implémenté dans `supabase/functions/_shared/response.ts`.

**Succès**
```json
{
  "success": true,
  "message": "OK",
  "data": { ... },
  "meta": { "requestId": "req_xxxxxxxx", "timestamp": "2026-06-01T10:00:00.000Z" }
}
```

**Erreur**
```json
{
  "success": false,
  "message": "Mot de passe actuel incorrect",
  "error": { "code": "UNAUTHORIZED", "type": "AUTH", "details": null },
  "meta": { "requestId": "req_xxxxxxxx", "timestamp": "..." }
}
```

**Pagination**
```json
{
  "items": [...],
  "page": 1, "limit": 20,
  "totalItems": 132, "totalPages": 7,
  "hasNextPage": true, "hasPrevPage": false,
  "nextPage": 2, "prevPage": null
}
```

### Codes d'erreur (`ErrorCode`)

| Code | Type | HTTP | Quand |
|---|---|---|---|
| `BAD_REQUEST` | VALIDATION | 400 | Payload mal formé |
| `VALIDATION_ERROR` | VALIDATION | 422 | Champ invalide (`details` = liste) |
| `UNAUTHORIZED` | AUTH | 401 | Pas/mauvais token, mauvais mot de passe |
| `TOKEN_EXPIRED` | AUTH | 401 | JWT expiré → le client doit `refresh` |
| `FORBIDDEN` | FORBIDDEN | 403 | Rôle insuffisant |
| `SCOPE_FORBIDDEN` | FORBIDDEN | 403 | Hors périmètre (autre école, autre user) |
| `NOT_FOUND` | NOT_FOUND | 404 | Ressource absente |
| `CONFLICT` | CONFLICT | 409 | Doublon (email déjà pris, etc.) |
| `RATE_LIMIT_EXCEEDED` | RATE_LIMIT | 429 | À implémenter |
| `INTERNAL_ERROR` | INTERNAL | 500 | Erreur non gérée |

---

## 4. Authentification & rôles

- Header attendu : `Authorization: Bearer <access_token>` (JWT Supabase).
- Décodé via `userClient(authHeader).auth.getUser(token)` dans
  `_shared/auth.ts → requireAuth(req)`. Renvoie un `AuthContext`
  `{ userId, email, roles, primarySchoolId, client, token }`.
- Rôles stockés dans la table **`user_roles`** (`super_admin`, `admin`,
  `cashier`, `parent`).
- Helpers de garde : `hasAnyRole(ctx, ["admin", "super_admin"])`.
- Fonctions SQL `SECURITY DEFINER` :
  - `has_role(user_id, role)`
  - `is_super_admin(user_id)`
  - `admin_has_school(user_id, school_id)`
  - `is_parent_of_student(user_id, student_id)`

**Sécurité** : aucun rôle ne doit jamais être stocké sur `profiles` ou
inféré côté client. Toujours passer par `user_roles` + RLS.

---

## 5. Schéma de base de données (vue d'ensemble)

Tables principales (`public.*`) :

| Table | Description |
|---|---|
| `profiles` | Données extra utilisateur (lié 1-1 à `auth.users`). |
| `user_roles` | (user_id, role) — source de vérité des permissions. |
| `admin_schools` | Lie un admin école à 1+ `schools`. |
| `schools` | Établissements (super_admin gère). |
| `sections`, `options`, `classes` | Structure pédagogique d'une école. |
| `students` | Élèves (matricule, classe, école…). |
| `parent_students` | Lie un parent (`auth.users`) à un élève. |
| `fees` | Frais scolaires (scope `SCHOOL` / `CLASS` / `STUDENT`). |
| `payments` | Paiements (status `PENDING` / `COMPLETED` / `FAILED`). |
| `receipts` | Reçus PDF générés après paiement. |
| `notifications`, `notification_preferences` | In-app notifications. |
| `push_tokens` | Tokens push mobiles. |
| `user_activity` | Dernière connexion. |

Toutes les tables `public.*` ont **RLS activé** + politiques scopées par rôle
(voir `supabase/migrations/`). Ne **jamais** désactiver RLS.

### Règles de migration

1. Fichier `supabase/migrations/<timestamp>_<slug>.sql` — **append-only**, ne
   jamais réécrire un fichier existant.
2. Toute nouvelle table publique doit, dans le **même** fichier :
   1. `CREATE TABLE public.<t> (...)`
   2. `GRANT SELECT, INSERT, UPDATE, DELETE ON public.<t> TO authenticated;`
      `GRANT ALL ON public.<t> TO service_role;`
      (ajouter `anon` UNIQUEMENT si lecture publique souhaitée)
   3. `ALTER TABLE public.<t> ENABLE ROW LEVEL SECURITY;`
   4. `CREATE POLICY ...` scopées sur `auth.uid()` ou via `has_role(...)`.
3. Utiliser un **trigger** plutôt qu'un CHECK pour les contraintes
   temporelles (ex: `expire_at > now()`).
4. Ne jamais toucher aux schémas `auth`, `storage`, `realtime`,
   `supabase_functions`, `vault`.

---

## 6. Catalogue des endpoints

> Tous les chemins sont relatifs à `{SUPABASE_URL}/functions/v1`.
> Tous les endpoints (sauf `payments-callback` et `auth/*`) exigent
> `Authorization: Bearer <jwt>`.

### 6.1 Auth (`/auth/...`)

| Méthode | Chemin | Auth | Body | Réponse |
|---|---|---|---|---|
| POST | `/auth/login` | public | `{ email, password }` | `{ accessToken, refreshToken, expiresIn, expiresAt, user }` |
| POST | `/auth/register` | public | `{ email, password, full_name?, phone?, role? }` | `{ pendingActivation, user, session }` |
| POST | `/auth/forgot-password` | public | `{ email, redirect_to? }` | `{ sent: true }` (toujours 200) |
| POST | `/auth/reset-password` | token reset | `{ access_token, refresh_token?, new_password }` | `{ updated: true }` |
| POST | `/auth/refresh` | public | `{ refresh_token }` | `{ accessToken, refreshToken, expiresIn, expiresAt }` |
| POST | `/auth/change-password` | **bearer** | `{ current_password, new_password }` | `{ updated: true }` — vérifie l'ancien mdp, met à jour, désactive `must_change_password` |

### 6.2 Users (`/users-me`)

| GET | `/users-me` | bearer | — | Profil + rôles + école primaire |
| PUT | `/users-me` | bearer | champs profil partiels | Profil mis à jour |

### 6.3 Schools (`/admin-schools`)

| GET | `/admin-schools` | super_admin (et admin pour son périmètre) | — | liste |
| POST | `/admin-schools` | super_admin | corps école | école créée |
| GET | `/admin-schools/:id` | super_admin / admin de l'école | — | détail |
| PUT | `/admin-schools/:id` | super_admin / admin de l'école | partiel | mis à jour |
| DELETE | `/admin-schools/:id` | super_admin | — | suppression |

> ⚠️ La suppression d'une école NE DOIT JAMAIS supprimer en cascade le
> compte super_admin. Voir procédure runtime § 9.

### 6.4 Parents (`/admin-parents`)

| GET | `/admin-parents?schoolId=&search=&page=&limit=` | admin / super_admin | — | liste parents + enfants |
| POST | `/admin-parents` | admin / super_admin | `{ school_id?, full_name, email, phone?, password?, relationship?, children?: [{student_id, relationship?}] }` | crée le compte auth, le profile, le rôle parent, les liens parent_students. Pose `user_metadata.must_change_password = true`. |
| GET | `/admin-parents/:id` | admin / super_admin | — | détail |
| PUT | `/admin-parents/:id` | admin / super_admin | partiel | mis à jour |
| DELETE | `/admin-parents/:id` | admin / super_admin | — | suppression |

### 6.5 Users admin/cashier (`/admin-users`)

| GET | `/admin-users` | super_admin / admin (de leur école) | — | liste |
| POST | `/admin-users` | super_admin (admin), admin (cashier) | `{ email, password, role, full_name, school_id?, ... }` | crée. Pose `must_change_password = true`. |
| GET / PUT / DELETE | `/admin-users/:id` | idem | — | détail / update / delete |

### 6.6 Students (`/students`, `/students-by-parent`)

| GET | `/students?schoolId=&classId=&search=&page=&limit=` | admin / cashier / super_admin | — | liste paginée |
| POST | `/students` | admin / cashier | corps élève | crée |
| GET / PUT / DELETE | `/students/:id` | idem | — | CRUD |
| GET | `/students-by-parent` | parent | — | enfants liés au parent connecté |

### 6.7 Classes (`/classes`)

| GET | `/classes?schoolId=` | tous (RLS filtre) | — | classes de l'école |
| POST / PUT / DELETE | `/classes[/:id]` | admin / cashier de l'école | — | CRUD |

### 6.8 Fees (`/fees`, `/fees-by-parent`)

| GET | `/fees?schoolId=&classId=&studentId=&scope=` | admin / cashier / super_admin | — | liste |
| POST / PUT / DELETE | `/fees[/:id]` | admin / cashier | corps fee | CRUD |
| GET | `/fees-by-parent` | parent | — | frais à payer pour ses enfants (avec solde restant) |

### 6.9 Collections (`/admin-collections`)

| GET | `/admin-collections?schoolId=&period=` | admin / super_admin | — | encaissements agrégés |

### 6.10 Payments (`/payments`, `/payments-callback`)

| POST | `/payments/initiate` | parent / cashier | `{ fee_id, student_id, amount, method, currency }` | crée payment PENDING + lien AvadaPay |
| GET | `/payments?status=&studentId=&schoolId=` | scoped | — | liste |
| GET | `/payments/:id` | scoped | — | détail |
| POST | `/payments-callback` | **public (webhook AvadaPay)** — `verify_jwt = false` | signature dans header | met à jour le statut. **Vérifier la signature** avant toute écriture. |

### 6.11 Receipts (`/receipts`)

| GET | `/receipts?studentId=` | scoped (parent / cashier / admin) | — | liste |
| GET | `/receipts/:id` | scoped | — | détail + PDF |
| POST | `/receipts` (interne) | cashier / admin | `{ payment_id }` | génère reçu + numéro |

### 6.12 Notifications (`/notifications`)

| GET | `/notifications?onlyUnread=&page=&limit=` | bearer | — | notifs de l'utilisateur |
| PATCH | `/notifications/:id/read` | bearer | — | marque comme lu |
| POST | `/notifications/preferences` | bearer | flags | met à jour les préférences |

### 6.13 Dashboards

| GET | `/admin-dashboard?schoolId=` | admin / super_admin | — | KPI école (collectes, élèves, parents…) |
| GET | `/cashier-dashboard?schoolId=` | cashier | — | KPI caisse du jour |

---

## 7. Secrets

Configurés dans **Lovable Cloud → Secrets** (jamais committés).

| Nom | Usage |
|---|---|
| `SUPABASE_URL` | URL projet (côté fonction) |
| `SUPABASE_PUBLISHABLE_KEY` | Clé anonyme pour `userClient` |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé privilégiée pour `adminClient` — **JAMAIS** côté front |
| `AVADAPAY_API_KEY` | Auth API AvadaPay |
| `AVADAPAY_MERCHANT_ID` | Identifiant marchand |
| `AVADAPAY_SECRET_KEY` | Vérification signature webhook |
| `LOVABLE_API_KEY` | Lovable AI Gateway (si IA activée) |

---

## 8. Tâches planifiées

- `dispatch_fee_reminders()` (fonction SQL) — à programmer via `pg_cron`
  ou un appel externe quotidien. Insère des notifications de rappel pour
  les frais impayés.

---

## 9. Procédures runtime utiles

### Recréer le super admin

Si le compte super_admin a été supprimé, créer une migration qui :
1. Insère dans `auth.users` (avec `crypt(<pwd>, gen_salt('bf'))`).
2. Insère dans `auth.identities` (`provider='email'`, `email_verified=true`).
3. Insère dans `public.profiles`, `public.user_roles` (`super_admin`),
   `public.notification_preferences`.

Modèle existant : `supabase/migrations/20260529080934_*.sql`.

### Empêcher la cascade lors de la suppression d'une école

Dans `admin-schools/index.ts` (DELETE) : avant `DELETE FROM schools`, ne
supprimer aucun `auth.users` qui détient le rôle `super_admin`. À garder
vérifié à chaque évolution de cet endpoint.

---

## 10. Ajouter un nouvel endpoint

1. Créer / réutiliser une fonction dans `supabase/functions/<nom>/index.ts`.
2. Démarrer avec :
   ```ts
   import { Router } from "../_shared/router.ts";
   import { requireAuth, hasAnyRole } from "../_shared/auth.ts";
   import { ok, errors } from "../_shared/response.ts";

   const router = new Router("/<nom>");
   router.get("/", async (req) => {
     const ctx = await requireAuth(req);
     if (ctx instanceof Response) return ctx;
     if (!hasAnyRole(ctx, ["admin", "super_admin"])) return errors.scopeForbidden();
     // ...
     return ok({ items: [] });
   });
   Deno.serve((req) => router.handle(req));
   ```
3. Toujours valider l'input (longueurs, formats, IDs UUID).
4. Retourner via `ok(...)` / `paginated(...)` / `errors.*`.
5. Mettre à jour `src/shared/api/endpoints.ts` côté front et ce document.
6. Si la fonction reçoit un webhook public, ajouter dans `supabase/config.toml` :
   ```toml
   [functions.<nom>]
   verify_jwt = false
   ```
   et **vérifier la signature** dans le handler.