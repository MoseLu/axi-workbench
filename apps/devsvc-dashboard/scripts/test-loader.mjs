// Test loader: locate the workspace's tsx package and re-export its
// Node module hooks so `node --import ./scripts/test-loader.mjs`
// behaves like `node --import tsx`.
//
// Why we need this indirection:
//   - tsx is not a direct dependency of `axi-devsvc-dashboard`; the
//     pnpm store hashes the package directory per-version.
//   - Hardcoding the version in `package.json` is brittle and breaks
//     on every lockfile bump.
//   - This file resolves tsx dynamically, then re-exports the hooks
//     Node expects (`globalPreload`, `initialize`, `load`, `resolve`).

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.env.AXI_WORKBENCH_REPO_ROOT
  ?? path.resolve(new URL("..", import.meta.url).pathname, "..", "..", "..", "..");
const TSX_STORE_ROOTS = [
  path.join(repoRoot, "node_modules", ".pnpm"),
];

function findTsxLoader() {
  for (const root of TSX_STORE_ROOTS) {
    if (!fs.existsSync(root)) continue;
    const entries = fs.readdirSync(root, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (!entry.name.startsWith("tsx@")) continue;
      const loader = path.join(
        root,
        entry.name,
        "node_modules",
        "tsx",
        "dist",
        "loader.mjs"
      );
      if (fs.existsSync(loader)) return loader;
    }
  }
  return null;
}

const tsxLoader = findTsxLoader();
if (!tsxLoader) {
  throw new Error(
    "scripts/test-loader.mjs: cannot locate tsx in the pnpm store. " +
    "Either run `pnpm install` at the monorepo root, or update this file."
  );
}

// Dynamic re-export: Node only reads the four hook names from
// `--import`'d files, so delegating them keeps tsx's full loader
// behavior intact.
const mod = await import(tsxLoader);
export const globalPreload = mod.globalPreload;
export const initialize = mod.initialize;
export const load = mod.load;
export const resolve = mod.resolve;
