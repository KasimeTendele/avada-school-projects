# Avada School

Plateforme de gestion scolaire (parents, élèves, frais, paiements) déployée
sur **Lovable Cloud** (Supabase + Edge Functions, frontend TanStack Start).

## Documentation

| Public | Document |
|---|---|
| 🖼️ Développeurs **frontend** | [`docs/FRONTEND.md`](./docs/FRONTEND.md) |
| ⚙️ Développeurs **backend** | [`docs/BACKEND.md`](./docs/BACKEND.md) |
| 🛣️ Feuille de route migration | [`docs/MIGRATION.md`](./docs/MIGRATION.md) |

## Principe d'architecture

```
┌──────────────────────────┐    HTTP / JSON     ┌──────────────────────────┐
│   Frontend (TanStack)    │ ─────────────────► │ Backend (Edge Functions) │
│   React 19 · Tailwind v4 │ ◄───────────────── │ Deno · Postgres · RLS    │
└──────────────────────────┘   apiClient only   └──────────────────────────┘
```

**Règle fondamentale :** le frontend communique avec le backend **uniquement**
via l'API HTTP (`@/shared/api`). Aucun accès direct à la base de données depuis
les composants. Voir `docs/FRONTEND.md` § 3.

## Démarrage local

```bash
bun install
bun run dev
```

Lovable gère build, lint, typecheck et déploiement automatiquement.