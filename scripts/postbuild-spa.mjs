#!/usr/bin/env node
// Aplatit le build TanStack Start SPA pour Hostinger / hébergement statique.
// Avant : dist/client/* (avec _shell.html) + dist/server/
// Après : dist/index.html + dist/assets/ + dist/favicon.ico + dist/.htaccess

import { existsSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const dist = join(root, "dist");
const client = join(dist, "client");
const server = join(dist, "server");
const shell = join(client, "_shell.html");
const indexHtml = join(dist, "index.html");

if (!existsSync(client)) {
  console.warn("[postbuild-spa] dist/client/ introuvable — rien à faire.");
  process.exit(0);
}

// Renomme _shell.html → index.html
if (existsSync(shell)) {
  renameSync(shell, join(client, "index.html"));
}

// Déplace tout dist/client/* → dist/
for (const entry of readdirSync(client)) {
  const from = join(client, entry);
  const to = join(dist, entry);
  if (existsSync(to)) rmSync(to, { recursive: true, force: true });
  renameSync(from, to);
}
rmSync(client, { recursive: true, force: true });

// Supprime dist/server (pas nécessaire en hébergement statique)
if (existsSync(server)) {
  rmSync(server, { recursive: true, force: true });
}

// Récap
const top = readdirSync(dist).map((f) => {
  const s = statSync(join(dist, f));
  return `  ${s.isDirectory() ? "📁" : "📄"} ${f}`;
});
console.log("[postbuild-spa] ✅ dist/ aplati pour hébergement statique :");
console.log(top.join("\n"));