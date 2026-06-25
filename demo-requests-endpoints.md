# Demo Requests — Endpoints API (Postman)

Base URL : `https://ixtnwgkxrlukgnmdophx.supabase.co/functions/v1/demo-requests`

## Headers communs

| Header | Valeur |
|---|---|
| `apikey` | `<SUPABASE_ANON_KEY>` (toujours requis) |
| `Content-Type` | `application/json` (POST/PATCH) |
| `Authorization` | `Bearer <JWT>` (uniquement pour `/admin/*`, JWT super_admin) |

> Routes publiques (`/config`, `POST /`) : pas d'`Authorization`, seul `apikey` est requis.

---

## 1. `GET /config` — Configuration publique de la page (✅ testé 200)

**Request**
```
GET /demo-requests/config
```

**Response 200**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "page": {
      "badge": "Démonstration personnalisée",
      "title": "Découvrez AvadaSchool en action 👋",
      "subtitle": "Planifiez une démonstration personnalisée et découvrez comment digitaliser la gestion de votre école.",
      "response_sla": "Réponse garantie en moins de 24h"
    },
    "features": [
      { "title": "30 minutes chrono", "description": "Une démonstration courte et efficace, adaptée à vos besoins." },
      { "title": "100% personnalisée", "description": "Nous présentons les fonctionnalités pertinentes pour votre école." },
      { "title": "Sans engagement", "description": "Découvrez la plateforme sans aucune obligation." }
    ],
    "testimonials": [],
    "trusted_schools": [],
    "form_options": {
      "school_types": ["Maternelle", "Primaire", "Secondaire", "Mixte (Maternelle → Secondaire)"],
      "contact_roles": ["Directeur / Directrice", "Promoteur / Promotrice", "Gestionnaire", "Responsable financier"],
      "problem_options": ["Gestion des frais scolaires", "Retards de paiement", "Communication avec les parents", "Suivi des élèves", "Reporting et statistiques", "Autre (précisez)"],
      "demo_modes": ["Visioconférence", "En présentiel", "Appel téléphonique"]
    }
  }
}
```

---

## 2. `POST /` — Soumission d'une demande de démo (✅ testé 201)

Route **publique**. Envoie automatiquement :
- un mail à l'équipe commerciale (`Office.drc@avadapay.com`, surchargeable via secret `DEMO_SALES_EMAIL`) ;
- un mail de confirmation au demandeur (`contact_email`).

**Request**
```
POST /demo-requests
Content-Type: application/json
apikey: <SUPABASE_ANON_KEY>
```

**Body**
```json
{
  "school_name": "Groupe Scolaire La Réussite",
  "school_type": "Mixte (Maternelle → Secondaire)",
  "city": "Kinshasa",
  "student_count": 500,
  "contact_name": "Jean Baptiste Kouassi",
  "contact_role": "Directeur / Directrice",
  "contact_email": "contact@ecole.com",
  "contact_phone": "+243812163851",
  "problems": ["Gestion des frais scolaires", "Retards de paiement"],
  "other_problem": null,
  "has_existing_system": true,
  "existing_system_name": "Excel",
  "preferred_date": "2026-12-15",
  "preferred_time": "14:30",
  "demo_mode": "Visioconférence",
  "message": "Nous voulons digitaliser notre gestion."
}
```

**Response 201**
```json
{
  "success": true,
  "message": "Created",
  "data": {
    "id": "bc3c8844-2c1a-4cfb-919d-9390460c06fd",
    "status": "pending",
    "created_at": "2026-06-25T07:34:56.776051+00:00",
    "message": "Demande enregistrée. Nous vous contacterons sous 24h."
  }
}
```

**Erreur 422 — validation**
```json
{
  "success": false,
  "message": "Validation failed",
  "error": {
    "code": "VALIDATION_ERROR",
    "type": "VALIDATION",
    "details": {
      "contact_phone": "Format attendu : +243XXXXXXXXX",
      "preferred_date": "Doit être >= aujourd'hui",
      "other_problem": "Champ requis lorsque 'Autre' est sélectionné"
    }
  }
}
```

### Règles de validation

| Champ | Règle |
|---|---|
| `school_name`, `school_type`, `city` | string non vide |
| `student_count` | entier > 0 |
| `contact_name`, `contact_role` | string non vide |
| `contact_email` | email valide |
| `contact_phone` | format `+243XXXXXXXXX` (9 chiffres) |
| `problems` | tableau, au moins 1 élément |
| `other_problem` | requis si `problems` contient `"Autre (précisez)"` |
| `has_existing_system` | booléen |
| `existing_system_name` | optionnel |
| `preferred_date` | `YYYY-MM-DD`, ≥ aujourd'hui |
| `preferred_time` | `HH:mm` |
| `demo_mode` | string non vide |
| `message` | optionnel |

---

## 3. `GET /admin` — Liste des demandes (super_admin) (✅ auth testée 401 sans token)

**Request**
```
GET /demo-requests/admin?page=1&limit=20&status=pending&city=Kinshasa&dateFrom=2026-06-01&dateTo=2026-12-31
Authorization: Bearer <JWT super_admin>
apikey: <SUPABASE_ANON_KEY>
```

**Query params** : `page` (def 1), `limit` (def 20, max 100), `status`, `city` (ILIKE), `dateFrom`, `dateTo` (sur `created_at`). Tri : `created_at desc`.

**Response 200**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "items": [
      {
        "id": "bc3c8844-2c1a-4cfb-919d-9390460c06fd",
        "school_name": "Groupe Scolaire La Réussite",
        "school_type": "Mixte (Maternelle → Secondaire)",
        "city": "Kinshasa",
        "student_count": 500,
        "contact_name": "Jean Baptiste Kouassi",
        "contact_role": "Directeur / Directrice",
        "contact_email": "contact@ecole.com",
        "contact_phone": "+243812163851",
        "problems": ["Gestion des frais scolaires", "Retards de paiement"],
        "other_problem": null,
        "has_existing_system": true,
        "existing_system_name": "Excel",
        "preferred_date": "2026-12-15",
        "preferred_time": "14:30",
        "demo_mode": "Visioconférence",
        "message": "Nous voulons digitaliser notre gestion.",
        "status": "pending",
        "admin_notes": null,
        "created_at": "2026-06-25T07:34:56.776051+00:00",
        "updated_at": "2026-06-25T07:34:56.776051+00:00"
      }
    ],
    "page": 1, "limit": 20, "totalItems": 1, "totalPages": 1,
    "hasNextPage": false, "hasPrevPage": false, "nextPage": null, "prevPage": null
  }
}
```

---

## 4. `GET /admin/:id` — Détail d'une demande (super_admin)

**Request**
```
GET /demo-requests/admin/bc3c8844-2c1a-4cfb-919d-9390460c06fd
Authorization: Bearer <JWT super_admin>
apikey: <SUPABASE_ANON_KEY>
```

**Response 200** — objet `demo_requests` complet (mêmes champs que ci-dessus).

**Response 404**
```json
{ "success": false, "message": "Demo request not found",
  "error": { "code": "NOT_FOUND", "type": "NOT_FOUND" } }
```

---

## 5. `PATCH /admin/:id` — Mise à jour du statut (super_admin)

**Request**
```
PATCH /demo-requests/admin/bc3c8844-2c1a-4cfb-919d-9390460c06fd
Authorization: Bearer <JWT super_admin>
apikey: <SUPABASE_ANON_KEY>
Content-Type: application/json
```

**Body**
```json
{
  "status": "contacted",
  "admin_notes": "Appelé le 25/06, RDV confirmé pour le 15/12."
}
```

**Statuts acceptés** : `pending` · `contacted` · `scheduled` · `completed` · `cancelled`

**Response 200** — objet `demo_requests` mis à jour.

**Erreur 422 — statut invalide**
```json
{
  "success": false,
  "message": "Invalid status",
  "error": {
    "code": "VALIDATION_ERROR",
    "type": "VALIDATION",
    "details": { "status": "Doit être l'un de pending, contacted, scheduled, completed, cancelled" }
  }
}
```

---

## Récupérer un JWT super_admin pour Postman

1. Se connecter dans l'app avec un compte super_admin.
2. DevTools → Application → Local Storage → clé `sb-ixtnwgkxrlukgnmdophx-auth-token` → copier `access_token`.
3. Coller dans `Authorization: Bearer <access_token>`.

## Tests réalisés

| Endpoint | Statut |
|---|---|
| `GET /config` | ✅ 200 |
| `POST /` (payload valide) | ✅ 201 — ID `bc3c8844-…` créé, emails déclenchés |
| `GET /admin` sans token | ✅ 401 `UNAUTHORIZED` (protection OK) |
| `GET /admin/:id` / `PATCH /admin/:id` | à tester avec JWT super_admin |
