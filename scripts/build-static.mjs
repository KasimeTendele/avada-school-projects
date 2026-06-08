#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const root = join(scriptsDir, "..");
const viteCli = join(root, "node_modules", "vite", "bin", "vite.js");
const postbuild = join(scriptsDir, "postbuild-spa.mjs");

if (!existsSync(viteCli)) {
  console.error("[build-static] Vite introuvable. Exécutez d'abord `npm install`.");
  process.exit(1);
}

const build = spawnSync(process.execPath, [viteCli, "build"], {
  cwd: root,
  env: { ...process.env, BUILD_STATIC: "1" },
  stdio: "inherit",
});

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const spa = spawnSync(process.execPath, [postbuild], {
  cwd: root,
  stdio: "inherit",
});

process.exit(spa.status ?? 0);