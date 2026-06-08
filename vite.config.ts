// Config par défaut (Nitro/Cloudflare Worker) — nécessaire pour l'aperçu
// et le déploiement Lovable. Le mode SPA statique (Hostinger) est piloté
// par la variable d'env `BUILD_STATIC=1` (voir `bun run build:static`).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const STATIC = process.env.BUILD_STATIC === "1";

export default defineConfig(
  STATIC
    ? {
        nitro: false,
        tanstackStart: { spa: { enabled: true } },
      }
    : {},
);
