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

Tous les chemins ci-dessous renvoient l'enveloppe standard
`{ success, message, data, meta }` (voir § 3). Les listes paginées renvoient
`data` au format `paginated` (`items`, `page`, `limit`, `totalItems`, …).

#### GET `/students`
- **Rôles** : `admin`, `cashier`, `super_admin`. RLS filtre déjà à l'école.
- **Query** : `page` (def. 1), `limit` (def. 20, max 100), `search`
  (matricule, prénom, nom), `sort` (ex: `last_name:asc`), filtres
  `schoolId`, `classId`, `sectionId`, `optionId`.
- **200** : `paginated<Student>` — chaque item inclut `school`, `class`,
  `section`, `option` joints.
- **Erreurs** : `UNAUTHORIZED`, `SCOPE_FORBIDDEN`, `INTERNAL_ERROR`.

#### POST `/students`
- **Rôles** : `admin`, `cashier`, `super_admin` (de l'école visée).
- **Body** :
  ```json
  {
    "school_id": "uuid",         // requis
    "first_name": "string",      // requis
    "last_name":  "string",      // requis
    "post_name":  "string?",
    "matricule":  "string?",
    "birth_date": "YYYY-MM-DD?",
    "birth_place": "string?",
    "gender":     "M|F?",
    "enrollment_date": "YYYY-MM-DD?",
    "class_id":   "uuid?",
    "section_id": "uuid?",
    "option_id":  "uuid?",
    "photo_url":  "string?",
    "physical_address": "string?"
  }
  ```
- **201** : `{ ...student }`.
- **Erreurs** : `VALIDATION_ERROR` (champs manquants),
  `SCOPE_FORBIDDEN` (école hors périmètre), `CONFLICT` (matricule en
  doublon dans l'école).

#### POST `/students/import`
- **Rôles** : `admin`, `cashier`, `super_admin`.
- **Body** : `{ school_id: uuid, students: Array<StudentBody> }`.
- **200** : `{ created: number, failed: Array<{ row, reason }> }`.
- **Erreurs** : `VALIDATION_ERROR`, `SCOPE_FORBIDDEN`.

#### GET `/students/:id`
- **Rôles** : portée RLS (admin/cashier/super_admin de l'école, parent de
  l'élève).
- **200** : `Student` avec relations.
- **Erreurs** : `NOT_FOUND` (inexistant ou hors portée).

#### PUT `/students/:id`
- **Rôles** : `admin`, `cashier`, `super_admin` (de l'école de l'élève).
- **Body** : tout sous-ensemble du corps `POST /students` (champs
  partiels).
- **200** : élève mis à jour.
- **Erreurs** : `VALIDATION_ERROR`, `SCOPE_FORBIDDEN`, `NOT_FOUND`.

#### DELETE `/students/:id`
- **Rôles** : `admin`, `super_admin` uniquement (le cashier ne peut pas
  supprimer).
- **200** : `{ deleted: true, id }`.
- **Erreurs** : `SCOPE_FORBIDDEN`, `NOT_FOUND`, `CONFLICT` (paiements
  rattachés).

#### GET `/students-by-parent`
- **Rôles** : `parent` (le `userId` est lu du JWT).
- **Query** : aucune.
- **200** : `{ items: Array<Student & { relationship: string }> }` — les
  élèves liés via `parent_students`, avec `school` et `class` joints.
- **Erreurs** : `UNAUTHORIZED`.

### 6.7 Classes (`/classes`)

| GET | `/classes?schoolId=` | tous (RLS filtre) | — | classes de l'école |
| POST / PUT / DELETE | `/classes[/:id]` | admin / cashier de l'école | — | CRUD |

### 6.8 Fees (`/fees`, `/fees-by-parent`)

#### GET `/fees`
- **Rôles** : tous les rôles authentifiés (RLS filtre la portée).
- **Query** : `page`, `limit`, `search` (label / fee_type), `sort`,
  filtres `schoolId`, `classId`, `studentId`, `scope`
  (`SCHOOL|CLASS|STUDENT`), `academic_year`.
- **200** : `paginated<Fee>` — chaque item inclut `school` et `class`
  joints.
- **Erreurs** : `UNAUTHORIZED`, `INTERNAL_ERROR`.

#### GET `/fees/by-school/:schoolId`
- **Rôles** : `super_admin`, `admin` (école liée via `admin_schools`),
  `cashier` (`primary_school_id == schoolId`).
- **200** : `{ items: Array<Fee & { paid: number, remaining: number,
  class?, student? }>, total }` — agrège les `payments` `COMPLETED`.
- **Erreurs** : `SCOPE_FORBIDDEN` (autre école), `INTERNAL_ERROR`.

#### POST `/fees`
- **Rôles** : `admin`, `cashier`, `super_admin` (école dans le périmètre).
- **Body** :
  ```json
  {
    "school_id": "uuid",                   // requis
    "scope":     "SCHOOL|CLASS|STUDENT",   // requis
    "label":     "string",                 // requis
    "fee_type":  "string",                 // requis
    "amount":    123.45,                   // > 0
    "currency":  "CDF|USD",                // def. CDF
    "due_date":  "YYYY-MM-DD?",
    "academic_year": "string?",
    "class_id":   "uuid?",  // requis si scope=CLASS
    "student_id": "uuid?"   // requis si scope=STUDENT
  }
  ```
- **201** : `Fee` créé. Effet de bord : insertion de
  `notifications` (type `FEE`) pour les parents des élèves concernés
  dont `notification_preferences.payments != false`.
- **Erreurs** : `VALIDATION_ERROR`, `SCOPE_FORBIDDEN`.

> ⚠️ `PUT /fees/:id` et `DELETE /fees/:id` ne sont pas encore exposés.
> Toute modification se fait côté DB ou à ajouter dans cette fonction si
> nécessaire (mêmes règles de rôle que `POST`).

#### GET `/fees-by-parent`
- **Rôles** : `parent`.
- **200** : `{ items: Array<Fee & { student_id, student_name, paid,
  remaining }> }` — uniquement les frais avec `remaining > 0` pour les
  enfants du parent connecté.
- **Erreurs** : `UNAUTHORIZED`.

### 6.9 Collections (`/admin-collections`)

| GET | `/admin-collections?schoolId=&period=` | admin / super_admin | — | encaissements agrégés |

### 6.10 Payments (`/payments`, `/payments-callback`)

#### GET `/payments`
- **Rôles** : tous (RLS scope par rôle ; côté code, un `parent` est
  re-filtré sur ses enfants via `parent_students`).
- **Query** : `page`, `limit`, `search` (`reference`), `sort`, filtres
  `status` (`PENDING|COMPLETED|FAILED`), `studentId`, `schoolId`,
  `feeId`, `method`.
- **200** : `paginated<Payment>`.
- **Erreurs** : `UNAUTHORIZED`, `INTERNAL_ERROR`.

#### GET `/payments/:id`
- **Rôles** : portée RLS. Déclenche une **réconciliation** AvadaPay si le
  paiement est `PENDING` Mobile Money (idempotent).
- **200** : `Payment & { receipts: Receipt[] }`.
- **Erreurs** : `NOT_FOUND`, `INTERNAL_ERROR`.

#### POST `/payments/initiate`
- **Rôles** : `parent` (uniquement pour ses enfants), `cashier`, `admin`,
  `super_admin` (pour l'école).
- **Body** :
  ```json
  {
    "fee_id":     "uuid",                              // requis
    "student_id": "uuid",                              // requis
    "amount":     50000,                               // > 0
    "method":     "MOBILE_MONEY|CASH|BANK_TRANSFER",   // requis
    "phone":      "string?",                           // requis si MOBILE_MONEY
    "provider":   "ORANGE|AIRTEL|MPESA|AFRIMONEY?",    // auto-détecté si absent
    "reference":  "string?"
  }
  ```
- **200** :
  - `MOBILE_MONEY` → `{ payment, redirect_url?, instructions?, provider }`
    + le paiement est créé `PENDING` puis confirmé par
      `/payments-callback`.
  - `CASH` / `BANK_TRANSFER` → `{ payment }` directement `COMPLETED` (le
    reçu est généré dans la foulée).
- **Erreurs** : `VALIDATION_ERROR` (champs / téléphone / opérateur),
  `SCOPE_FORBIDDEN` (enfant d'un autre parent), `NOT_FOUND` (`fee_id`),
  `INTERNAL_ERROR` (échec AvadaPay).

#### POST `/payments/:id/verify`
- **Rôles** : portée RLS. Force une réconciliation AvadaPay puis renvoie
  l'état mis à jour.
- **200** : `Payment & { receipts: Receipt[] }`.
- **Erreurs** : `NOT_FOUND`, `INTERNAL_ERROR`.

#### POST `/payments/:id/cancel`
- **Rôles** : créateur du paiement, `cashier`, `admin`, `super_admin`.
- **200** : `{ id, status: "FAILED" }`. Idempotent si déjà `FAILED`.
- **Erreurs** : `NOT_FOUND`, `SCOPE_FORBIDDEN`,
  `VALIDATION_ERROR` (« déjà confirmé, impossible d'annuler »).

#### POST `/payments-callback`
- **Auth** : **public** (`verify_jwt = false`). Endpoint webhook
  AvadaPay.
- **Body** : `{ order_id, status, transaction_id?, amount?, currency?,
  signature, ... }`.
- **Sécurité** : `signature` est vérifiée via `signPayload` (HMAC) avant
  toute écriture.
- **Réponses** (format **brut**, pas l'enveloppe standard car
  l'expéditeur est externe) :
  - `200 { success: true, message }` : traité (`Already processed`,
    `Marked failed`, `Ignored (non-final status)`, `Payment completed`).
  - `400` : JSON invalide / `order_id` manquant.
  - `401` : signature invalide.
  - `404` : `payment` introuvable.
  - `405` : méthode autre que `POST`.
- **Effet** : sur succès → met le `payment` en `COMPLETED`, crée un
  `receipt` (numéro `R-<ts>-<rand>`) et envoie une notification
  `PAYMENT` à `initiated_by`. Sur échec → `FAILED` + notification.

### 6.11 Receipts (`/receipts`)

> La fonction `receipts` n'expose pour l'instant **que** la résolution
> d'URL PDF d'un reçu existant. Les reçus sont créés automatiquement par
> `payments-callback` et par `POST /payments/initiate` (méthodes
> immédiates `CASH` / `BANK_TRANSFER`).

#### GET `/receipts/:id/pdf`
- **Rôles** : portée RLS (`parent` propriétaire, `cashier` / `admin` de
  l'école, `super_admin`).
- **200** : `{ url: string, receiptNumber: string }`. Si `pdf_url` est
  vide, une URL placeholder est générée puis persistée (à remplacer par
  un vrai PDF en production).
- **Erreurs** : `NOT_FOUND` (« Receipt not found or out of scope »),
  `INTERNAL_ERROR`.

> Pour lister les reçus d'un parent ou d'un élève, passer par
> `GET /payments?studentId=...` et lire `payments[].receipts` (les reçus
> sont inclus dans `GET /payments/:id`).

### 6.12 Notifications (`/notifications`)

#### GET `/notifications`
- **Rôles** : tout utilisateur authentifié. Renvoie uniquement ses
  propres notifications (`user_id = auth.uid()`, garanti par RLS).
- **Query** : `page` (def. 1), `limit` (def. 20, max 100), `search`
  (titre / message), `sort` (def. `created_at:desc`), filtres `read`
  (`true|false`), `type` (`PAYMENT|FEE|EVENT|SYSTEM`).
- **200** : `paginated<Notification>`.
- **Erreurs** : `UNAUTHORIZED`, `INTERNAL_ERROR`.

#### PATCH `/notifications/:id/read`
- **Rôles** : propriétaire de la notification.
- **200** : `{ notification: Notification }` (avec `read=true`,
  `read_at=now()`).
- **Erreurs** : `NOT_FOUND` (autre utilisateur ou inexistante),
  `INTERNAL_ERROR`.

#### PATCH `/notifications/read-all`
- **Rôles** : utilisateur connecté.
- **200** : `{ updated: number }` — nombre de notifs marquées comme lues.
- **Erreurs** : `UNAUTHORIZED`, `INTERNAL_ERROR`.

> La gestion des préférences (`notification_preferences`) et des
> tokens push (`push_tokens`) n'a pas encore d'endpoint dédié — l'app
> écrit directement via Supabase (à migrer vers une route HTTP, voir
> [`MIGRATION.md`](./MIGRATION.md)).

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