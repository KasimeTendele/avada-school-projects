// Build SPA statique pour hébergement Hostinger (mutualisé).
// - `tanstackStart.spa.enabled: true` → prérend une coquille SPA (HTML + assets)
//   capable d'être servie par n'importe quel hébergeur statique (Apache/Nginx).
// - `nitro: false` → désactive la sortie Cloudflare Worker / serveur Node.
// - Le build sort dans `./dist/` (config Vite par défaut).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  nitro: false,
  tanstackStart: {
    spa: {
      enabled: true,
    },
  },
});
