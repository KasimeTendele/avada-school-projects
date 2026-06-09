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

---

## 11. Exemples Postman (requêtes prêtes à l'emploi)

> **Base URL** :
> `https://ixtnwgkxrlukgnmdophx.supabase.co/functions/v1`
>
> Définissez dans Postman les variables d'environnement suivantes :
>
> | Variable        | Valeur                                                                 |
> |-----------------|------------------------------------------------------------------------|
> | `baseUrl`       | `https://ixtnwgkxrlukgnmdophx.supabase.co/functions/v1`                |
> | `accessToken`   | Récupéré via `POST /auth/login` (champ `data.accessToken`)             |
> | `refreshToken`  | Récupéré via `POST /auth/login` (champ `data.refreshToken`)            |
>
> Headers communs (tous les endpoints sauf `/auth/login`, `/register`,
> `/forgot-password`, `/reset-password`, `/refresh`, `/payments-callback`) :
>
> ```
> Authorization: Bearer {{accessToken}}
> Content-Type: application/json
> ```

### 11.1 Auth

**Login**
```
POST {{baseUrl}}/auth/login
Content-Type: application/json

{
  "email": "admin@avada.school",
  "password": "MotDePasse123!"
}
```

**Register**
```
POST {{baseUrl}}/auth/register
Content-Type: application/json

{
  "email": "parent@example.com",
  "password": "MotDePasse123!",
  "full_name": "Jean Dupont",
  "phone": "+243900000000",
  "role": "parent"
}
```

**Forgot password**
```
POST {{baseUrl}}/auth/forgot-password
Content-Type: application/json

{
  "email": "parent@example.com",
  "redirect_to": "https://avada-school-projects.lovable.app/reset-password"
}
```

**Reset password**
```
POST {{baseUrl}}/auth/reset-password
Content-Type: application/json

{
  "access_token": "eyJhbGciOi...",
  "refresh_token": "v1.MrefreshT...",
  "new_password": "NouveauMdp123!"
}
```

**Refresh**
```
POST {{baseUrl}}/auth/refresh
Content-Type: application/json

{ "refresh_token": "{{refreshToken}}" }
```

**Change password** (Bearer requis)
```
POST {{baseUrl}}/auth/change-password
Authorization: Bearer {{accessToken}}
Content-Type: application/json

{
  "current_password": "MotDePasse123!",
  "new_password": "NouveauMdp123!"
}
```

### 11.2 Utilisateur courant

```
GET   {{baseUrl}}/users-me
PATCH {{baseUrl}}/users-me
{
  "full_name": "Jean Dupont",
  "phone": "+243900000000",
  "avatar_url": "https://.../avatars/uid.png"
}

GET   {{baseUrl}}/users-me/preferences/notifications
PATCH {{baseUrl}}/users-me/preferences/notifications
{ "payments": true, "reminders": true, "news": false, "push": true, "email": true }

PUT   {{baseUrl}}/users-me/push-token
{ "token": "ExponentPushToken[xxxx]", "platform": "android", "device_id": "abc-123" }
```

### 11.3 Écoles (super_admin)

```
GET    {{baseUrl}}/admin-schools?page=1&limit=20&search=kinshasa
GET    {{baseUrl}}/admin-schools/3f1c...-uuid

POST   {{baseUrl}}/admin-schools
{
  "name": "Avada Primary School",
  "city": "Kinshasa",
  "address": "Av. de la Paix 12",
  "phone": "+243812345678",
  "email": "contact@avada.school",
  "currency": "CDF"
}

PATCH  {{baseUrl}}/admin-schools/3f1c...-uuid
{ "phone": "+243812345679" }

DELETE {{baseUrl}}/admin-schools/3f1c...-uuid
```

### 11.4 Utilisateurs internes

```
GET    {{baseUrl}}/admin-users?role=cashier&school_id=<uuid>&page=1&limit=20
GET    {{baseUrl}}/admin-users/<uuid>

POST   {{baseUrl}}/admin-users
{
  "email": "caissier@avada.school",
  "password": "Temp1234!",
  "full_name": "Marie Kabila",
  "phone": "+243900111222",
  "role": "cashier",
  "school_ids": ["3f1c...-uuid"]
}

PATCH  {{baseUrl}}/admin-users/<uuid>
{ "status": "ACTIVE", "school_ids": ["3f1c...-uuid"] }

PATCH  {{baseUrl}}/admin-users/<uuid>/profile
{ "full_name": "Marie K.", "phone": "+243900111223" }
```

### 11.5 Parents

```
GET    {{baseUrl}}/admin-parents?schoolId=<uuid>&search=dupont&page=1&limit=20
GET    {{baseUrl}}/admin-parents/<userId>

POST   {{baseUrl}}/admin-parents
{
  "school_id": "3f1c...-uuid",
  "full_name": "Jean Dupont",
  "email": "jean.dupont@example.com",
  "phone": "+243900000000",
  "password": "Temp1234!",
  "relationship": "father",
  "children": [
    { "student_id": "stu...-uuid", "relationship": "father" }
  ]
}

PATCH  {{baseUrl}}/admin-parents/<userId>
{ "phone": "+243900000001", "relationship": "guardian" }

DELETE {{baseUrl}}/admin-parents/<userId>

POST   {{baseUrl}}/admin-parents/import
{
  "school_id": "3f1c...-uuid",
  "rows": [
    { "full_name": "A. Test", "email": "a@test.com", "phone": "+24390..." }
  ]
}

GET    {{baseUrl}}/admin-parents/search-exact?email=jean.dupont@example.com
GET    {{baseUrl}}/admin-parents/by-school?schoolId=<uuid>
GET    {{baseUrl}}/admin-parents/students/<studentId>/parents

POST   {{baseUrl}}/admin-parents/link
{ "parent_user_id": "<uuid>", "student_id": "<uuid>", "relationship": "mother" }

DELETE {{baseUrl}}/admin-parents/link/<linkId>
```

### 11.6 Collections & dashboards

```
GET {{baseUrl}}/admin-collections?schoolId=<uuid>&from=2026-01-01&to=2026-06-30
GET {{baseUrl}}/admin-dashboard
GET {{baseUrl}}/cashier-dashboard/<schoolId>
```

### 11.7 Élèves & classes

```
GET    {{baseUrl}}/students?school_id=<uuid>&class_id=<uuid>&page=1&limit=20
POST   {{baseUrl}}/students
{
  "school_id": "3f1c...-uuid",
  "class_id":  "cls...-uuid",
  "first_name": "Eliane",
  "last_name":  "Mbuyi",
  "matricule":  "AV-2026-0001",
  "birth_date": "2014-08-12",
  "gender": "F",
  "enrollment_date": "2026-09-01"
}

POST   {{baseUrl}}/students/import
{
  "school_id": "3f1c...-uuid",
  "rows": [
    { "first_name": "A", "last_name": "B", "matricule": "AV-2026-0002", "class_id": "cls...-uuid" }
  ]
}

PUT    {{baseUrl}}/students/<id>
{ "class_id": "cls...-uuid", "first_name": "Eliane" }

DELETE {{baseUrl}}/students/<id>

GET    {{baseUrl}}/students-by-parent
GET    {{baseUrl}}/classes?school_id=<uuid>&academic_year=2025-2026
```

### 11.8 Frais

```
GET  {{baseUrl}}/fees?page=1&limit=20&filter[school_id]=<uuid>
GET  {{baseUrl}}/fees/by-school/<schoolId>

POST {{baseUrl}}/fees
{
  "school_id": "3f1c...-uuid",
  "scope": "CLASS",
  "label": "Frais scolaires T1",
  "fee_type": "TUITION",
  "amount": 150000,
  "currency": "CDF",
  "due_date": "2026-10-15",
  "academic_year": "2026-2027",
  "class_id": "cls...-uuid"
}

// Scope STUDENT
{
  "school_id": "<uuid>", "scope": "STUDENT", "label": "Frais d'examen",
  "fee_type": "EXAM", "amount": 25000, "student_id": "<studentId>"
}

// Scope SCHOOL
{
  "school_id": "<uuid>", "scope": "SCHOOL", "label": "Cotisation annuelle",
  "fee_type": "ANNUAL", "amount": 5000
}

GET  {{baseUrl}}/fees-by-parent
```

### 11.9 Paiements

```
GET  {{baseUrl}}/payments?page=1&limit=20&filter[status]=COMPLETED
GET  {{baseUrl}}/payments/<id>

POST {{baseUrl}}/payments/initiate
{
  "fee_id":   "fee...-uuid",
  "student_id": "stu...-uuid",
  "amount":   150000,
  "currency": "CDF",
  "method":   "AVADAPAY",
  "msisdn":   "+243900000000",
  "return_url": "https://avada-school-projects.lovable.app/payments"
}

POST {{baseUrl}}/payments/<id>/verify
POST {{baseUrl}}/payments/<id>/cancel
```

**Webhook AvadaPay** (appelé par AvadaPay, pas par le front — pas d'auth Bearer)
```
POST {{baseUrl}}/payments-callback
X-AvadaPay-Signature: <hmac>
Content-Type: application/json

{
  "transaction_id": "AP-123456",
  "reference":      "<payment.id>",
  "status":         "SUCCESS",
  "amount":         150000,
  "currency":       "CDF"
}
```

### 11.10 Reçus

```
GET {{baseUrl}}/receipts/<id>/pdf
Accept: application/pdf
```
Dans Postman : onglet « Send and Download » pour récupérer le fichier.

### 11.11 Notifications

```
GET   {{baseUrl}}/notifications?page=1&limit=20&filter[read]=false
PATCH {{baseUrl}}/notifications/read-all
PATCH {{baseUrl}}/notifications/<id>/read
```

---

## 12. Collection Postman (import rapide)

Enregistrez ce JSON dans un fichier `avada-school.postman_collection.json`
puis **Import → File** dans Postman :

```json
{
  "info": { "name": "Avada School API", "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" },
  "variable": [
    { "key": "baseUrl", "value": "https://ixtnwgkxrlukgnmdophx.supabase.co/functions/v1" },
    { "key": "accessToken", "value": "" },
    { "key": "refreshToken", "value": "" }
  ],
  "auth": {
    "type": "bearer",
    "bearer": [{ "key": "token", "value": "{{accessToken}}", "type": "string" }]
  },
  "item": [
    {
      "name": "Auth / Login",
      "request": {
        "method": "POST",
        "header": [{ "key": "Content-Type", "value": "application/json" }],
        "url": "{{baseUrl}}/auth/login",
        "body": { "mode": "raw", "raw": "{\n  \"email\": \"admin@avada.school\",\n  \"password\": \"MotDePasse123!\"\n}" }
      },
      "event": [{
        "listen": "test",
        "script": { "exec": [
          "const j = pm.response.json();",
          "if (j?.data?.accessToken) pm.environment.set('accessToken', j.data.accessToken);",
          "if (j?.data?.refreshToken) pm.environment.set('refreshToken', j.data.refreshToken);"
        ] }
      }]
    },
    {
      "name": "Users / Me",
      "request": { "method": "GET", "url": "{{baseUrl}}/users-me" }
    },
    {
      "name": "Fees / Create",
      "request": {
        "method": "POST",
        "header": [{ "key": "Content-Type", "value": "application/json" }],
        "url": "{{baseUrl}}/fees",
        "body": { "mode": "raw", "raw": "{\n  \"school_id\": \"<uuid>\",\n  \"scope\": \"CLASS\",\n  \"label\": \"Frais scolaires T1\",\n  \"fee_type\": \"TUITION\",\n  \"amount\": 150000,\n  \"currency\": \"CDF\",\n  \"class_id\": \"<uuid>\"\n}" }
      }
    },
    {
      "name": "Payments / Initiate",
      "request": {
        "method": "POST",
        "header": [{ "key": "Content-Type", "value": "application/json" }],
        "url": "{{baseUrl}}/payments/initiate",
        "body": { "mode": "raw", "raw": "{\n  \"fee_id\": \"<uuid>\",\n  \"student_id\": \"<uuid>\",\n  \"amount\": 150000,\n  \"currency\": \"CDF\",\n  \"method\": \"AVADAPAY\",\n  \"msisdn\": \"+243900000000\"\n}" }
      }
    }
  ]
}
```

Le test script du **Login** stocke automatiquement `accessToken` /
`refreshToken` dans l'environnement Postman ; toutes les autres requêtes
les réutilisent via l'auth Bearer de la collection.