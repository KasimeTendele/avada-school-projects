# Migration vers une SPA Vite classique pour Hostinger

## Bonne nouvelle après audit
Tout le backend est **déjà** dans `supabase/functions/` (18 edge functions). Le client `src/shared/api/client.ts` appelle déjà `${VITE_SUPABASE_URL}/functions/v1/...` directement. **Aucune** server function `createServerFn` dans `src/`, **aucune** route `/api/*`. La migration ne touche que le front.

## Cible
Une app **Vite + React + TanStack Router (SPA)** qui produit un dossier `dist/` statique uploadable tel quel chez Hostinger (mutualisé), comme votre capture d'écran.

## Étapes (dans cet ordre)

### Étape 1 — Dépendances
- **Retirer** : `@tanstack/react-start`, `@tanstack/router-plugin` (version Start), `@cloudflare/vite-plugin`, `@lovable.dev/vite-tanstack-config`, `nitro`
- **Ajouter** : `@tanstack/router-plugin` (mode SPA), garder `@tanstack/react-router`, `@vitejs/plugin-react`, `vite-tsconfig-paths`, `@tailwindcss/vite`
- Supprimer `wrangler.jsonc`, `bunfig.toml` (si lié à TSS)

### Étape 2 — Nouveaux fichiers d'entrée Vite SPA
- `index.html` à la racine (head + `<div id="root">` + `<script type="module" src="/src/main.tsx">`)
- `src/main.tsx` : monte `<RouterProvider>` sur `#root`, instancie `QueryClient`
- `vite.config.ts` réécrit : `react()` + `TanStackRouterVite()` + `tsconfigPaths()` + `tailwindcss()`. Plus de preset Cloudflare/Vercel.

### Étape 3 — Refonte du routing
- `src/router.tsx` : `createRouter` SPA (déjà presque OK, juste retirer le contexte SSR)
- `src/routes/__root.tsx` : retirer `HeadContent`, `Scripts`, `shellComponent`, `createRootRouteWithContext` → utiliser `createRootRoute`. Les `<meta>` passent dans `index.html` (ou via `react-helmet-async` si on veut dynamique).
- Toutes les autres routes (`_admin.*`, `_authenticated.*`, `_cashier.*`, `login`, etc.) restent identiques — TanStack Router fonctionne pareil en SPA.

### Étape 4 — Adapter le code isomorphique
- `src/integrations/supabase/client.ts` : supprimer le fallback `process.env` (browser only désormais)
- Vérifier qu'il ne reste aucun `import "@tanstack/react-start"` dans `src/` → tout remplacer par `@tanstack/react-router`
- Supprimer `src/integrations/supabase/auth-middleware.ts`, `auth-attacher.ts`, `client.server.ts` (inutiles en SPA)

### Étape 5 — Gestion des routes côté serveur statique (Hostinger)
- Ajouter `public/.htaccess` avec rewrite SPA fallback :
  ```
  RewriteEngine On
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
  ```
- Sans ça, `/admin/users` en accès direct ou refresh = 404 Hostinger.

### Étape 6 — Variables d'environnement
Tout ce qui sert au front doit être préfixé `VITE_` :
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

Les secrets serveur (`SUPABASE_SERVICE_ROLE_KEY`, `AVADAPAY_SECRET_KEY`) restent uniquement dans Supabase → utilisés par les edge functions, jamais bundlés.

### Étape 7 — Webhook AvadaPay
Le callback `payments-callback` est **déjà** une edge function Supabase. Son URL reste :
`https://ixtnwgkxrlukgnmdophx.supabase.co/functions/v1/payments-callback`
→ aucune modification AvadaPay nécessaire. ✅

### Étape 8 — Build & deploy Hostinger
```bash
bun install
bun run build         # produit ./dist
```
Upload du contenu de `dist/` (pas le dossier `dist` lui-même) dans `public_html/` de Hostinger via FTP/File Manager. Le `.htaccess` doit être à la racine de `public_html/`.

## Ce qui sera perdu (assumé)
- ❌ SSR / rendu serveur (première peinture plus lente, écran blanc 0.5–1s)
- ❌ SEO dynamique par route (les meta sont statiques dans `index.html`) — récupérable plus tard avec `react-helmet-async`
- ❌ Open Graph dynamique pour partages (`/admin/users/123` partagera le OG de la home)

## Ce qui continuera de marcher
- ✅ Auth Supabase (email/password, Google)
- ✅ Toutes les edge functions backend
- ✅ AvadaPay (paiements + webhook callback)
- ✅ Le design, les routes, les composants UI
- ✅ Storage Supabase (avatars, photos élèves, etc.)

## Estimation
~30–45 minutes de travail, 1–2 cycles de debug. Je fais tout en une passe et on teste ensemble juste après.

## Question avant de démarrer
Une chose à confirmer : **vous voulez bien que je supprime tous les fichiers TanStack Start** (`__root.tsx` shell, `wrangler.jsonc`, `auth-middleware.ts`, etc.) ? Une fois la migration faite, **on ne peut plus revenir en arrière facilement** — il faudrait restaurer ces fichiers depuis l'historique Git.

Répondez « **Go** » pour que je lance la migration, ou « **Stop** » si vous voulez d'abord poser des questions.
