# Documentation Frontend — Avada School

> Public visé : développeurs **frontend** qui reprennent le projet.
> Pour la partie backend (edge functions, base de données, schéma), voir
> [`BACKEND.md`](./BACKEND.md). Pour la feuille de route de migration
> (features restant à isoler), voir [`MIGRATION.md`](./MIGRATION.md).

---

## 1. Stack

| Domaine | Choix |
|---|---|
| Framework | **TanStack Start** (React 19 + Vite 7) |
| Routing | TanStack Router file-based (`src/routes/**`) |
| Data fetching | **TanStack Query** (`@tanstack/react-query`) |
| Styles | **Tailwind CSS v4** (tokens dans `src/styles.css`) |
| Composants UI | **shadcn/ui** (dans `src/components/ui/**`) |
| Auth (SDK) | `@supabase/supabase-js` — **uniquement** pour la session, jamais pour la donnée |
| Notifs / toasts | `sonner` |
| Formulaires | `react-hook-form` + `zod` |
| Icônes | `lucide-react` |

Le build/typecheck/lint est géré automatiquement par Avadaschool. En local :
`bun install` puis `bun run dev`.

---

## 2. Architecture des dossiers

```
src/
├── app/                 (à venir — voir MIGRATION.md)
├── routes/              # routes TanStack file-based (UI + glue)
├── features/            # logique métier par domaine
│   ├── auth/            # password.ts, hooks et helpers d'authentification
│   └── parents/         # api.ts | hooks.ts | types.ts  ← exemple de référence
├── shared/
│   └── api/             # client HTTP unique + types + endpoints
│       ├── client.ts    # apiClient.get/post/put/patch/delete
│       ├── endpoints.ts # catalogue centralisé des chemins
│       └── types.ts     # ApiResponse, Paginated, ApiError, codes…
├── components/          # composants partagés (Shells, DataTable, dialogs…)
│   └── ui/              # primitives shadcn (ne pas modifier sans raison)
├── hooks/               # hooks transverses
├── lib/                 # utilitaires (format, upload, auth-context, api compat)
├── integrations/
│   └── supabase/        # client auth — auto-généré, NE PAS éditer
└── styles.css           # design tokens (palette OKLCH, ombres, gradients)
```

### Pourquoi `features/` ?

Chaque domaine métier (parents, élèves, paiements…) regroupe **api**, **hooks**,
**types** et éventuellement **composants** dans un même dossier. Cela permet :

- d'isoler les changements d'un domaine ;
- de donner aux nouveaux développeurs une convention prévisible ;
- de retirer un domaine sans casser les autres.

---

## 3. ⚠️ Règle d'or

> **Le frontend ne parle JAMAIS directement à la base de données.**
> Tout passe par l'API HTTP (edge functions Supabase) via `apiClient`.

Le SDK `supabase` (depuis `@/integrations/supabase/client`) est autorisé
**uniquement** pour :

1. La session utilisateur : `signInWithPassword`, `signOut`, `signUp`,
   `getSession`, `onAuthStateChange`, `resetPasswordForEmail`.
2. L'upload de fichiers vers **Supabase Storage** (avatars, photos d'élèves)
   via le helper `src/lib/upload.ts` — les URLs publiques sont ensuite
   stockées via l'API.
3. Les abonnements **Realtime** (s'ils sont introduits plus tard).

❌ Interdit : `supabase.from('table').select(...)`, `.insert(...)`, `.update(...)`,
`.delete(...)`, `.rpc(...)` dans les composants ou routes.

Pour mettre à jour le mot de passe par exemple, on n'appelle plus
`supabase.auth.updateUser({ password })` mais l'endpoint dédié :

```ts
import { changePassword } from "@/features/auth/password";
await changePassword({ current_password, new_password });
```

---

## 4. Le client API (`@/shared/api`)

```ts
import { apiClient, endpoints, ApiError } from "@/shared/api";

const parents = await apiClient.get<ParentDto[]>(endpoints.parents.base, {
  query: { schoolId, search: "dupont", page: 1, limit: 20 },
});

await apiClient.post(endpoints.parents.base, { full_name, email, password });
```

Caractéristiques :

- Injecte automatiquement `Authorization: Bearer <token>` depuis la session.
- Déballe `{ success, data }` → retourne `data` typé.
- Lance une `ApiError` (avec `status`, `code`, `type`, `details`) sur erreur.
- Sur `401`, déconnecte et redirige vers `/login`.
- Les chemins sont centralisés dans `src/shared/api/endpoints.ts` — **ne
  jamais hardcoder une URL dans un composant**.

---

## 5. Ajouter une nouvelle feature

Exemple : `students`. Créer `src/features/students/` avec :

```
features/students/
├── types.ts     # DTOs (miroirs des réponses backend)
├── api.ts       # studentsApi.list/get/create/update/remove
├── hooks.ts     # useStudents(), useStudent(id), useCreateStudent()…
└── index.ts     # re-export
```

Modèle de référence complet : [`src/features/parents/`](../src/features/parents/).

Étapes :

1. Lire le contrat de l'endpoint dans [`BACKEND.md`](./BACKEND.md).
2. Déclarer le DTO dans `types.ts`.
3. Ajouter le chemin dans `src/shared/api/endpoints.ts`.
4. Écrire `api.ts` (5–10 lignes par opération).
5. Écrire `hooks.ts` avec React Query (`useQuery` / `useMutation`).
6. Consommer dans la route TanStack via le hook — **pas d'appel direct `apiClient`
   dans un composant**.

---

## 6. Authentification & rôles

- Context React : `src/lib/auth-context.tsx` expose `useAuth()` avec `user`,
  `session`, `profile`, `roles`, `hasRole`, `hasAnyRole`, `signIn`, `signOut`,
  `resetPassword`, `refresh`.
- Rôles supportés : `super_admin`, `admin`, `cashier`, `parent`.
- Garde de route :
  - `_authenticated.tsx` → utilisateurs connectés (parents par défaut)
  - `_admin.tsx` → admin école + super_admin
  - `_cashier.tsx` → caissier
- **Force change password** : un utilisateur créé par un admin reçoit
  `user_metadata.must_change_password = true`. Le composant
  `ForcePasswordChangeDialog` (monté dans chaque Shell) ouvre une modale
  bloquante au premier login.
- **Changement manuel** : disponible dans chaque profil (parent / admin /
  cashier) via le helper `changePassword()` de `@/features/auth/password`.

---

## 7. Design system

- Tokens **uniquement** dans `src/styles.css` (couleurs en `oklch`, ombres,
  gradients, radius).
- **Interdit** : `text-white`, `bg-black`, `bg-[#xxxxxx]` dans les composants
  → utiliser les classes sémantiques Tailwind (`bg-primary`, `text-foreground`,
  `bg-card`, etc.).
- **Thème par défaut : Light**. Persistance via `localStorage` clef
  `avada.theme` (`light` | `dark` | `system`). Géré dans `__root.tsx`.
- Light **et** dark doivent toujours rester lisibles (contraste suffisant).

---

## 8. Routing

- File-based : `src/routes/foo.bar.tsx` → URL `/foo/bar`.
- Les routes sous `_authenticated` / `_admin` / `_cashier` sont protégées.
- `src/routeTree.gen.ts` est **auto-généré** — ne pas l'éditer à la main.
- Navigation : `<Link to="/...">` et `useNavigate()` depuis
  `@tanstack/react-router` (jamais `react-router-dom`).

---

## 9. État serveur (React Query)

Conventions de `queryKey` :

```ts
["<feature>"]                          // racine
["<feature>", "list", queryParams]     // liste
["<feature>", "detail", id]            // détail
```

Après une mutation, invalider avec `queryClient.invalidateQueries({ queryKey: ["<feature>"] })`.

---

## 10. Upload de fichiers

Helper unique : `src/lib/upload.ts`. Uploade vers les buckets Storage
(`avatars`, `student-photos`, `school-assets`, `staff-photos`) et renvoie
l'URL publique, qui est ensuite envoyée à l'API via un PUT/POST.

C'est la **seule** exception à la règle « tout passe par l'API ».

---

## 11. Lint / typecheck / build

Géré par Avadaschool. En local :

```bash
bun run dev       # dev server
bun run build     # build prod
bun run lint      # eslint
```

Pas de tests automatisés en place — à ajouter (Vitest recommandé).