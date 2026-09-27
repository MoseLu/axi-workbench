#!/usr/bin/env node
/**
 * Runtime Path Scanner (WFB-PACK-001)
 *
 * Scans a built artifact directory for any baked-in reference to the local
 * Axi workspace absolute path (`/Volumes/code/workspace`). Producing a build
 * artifact that contains such a reference is a sign that `link:`-style
 * provider wiring leaked past the bundler, which violates INV-FB-003 and the
 * cross-project boundary SOP.
 *
 * Usage:
 *   node scripts/scan-runtime-paths.mjs                # scan apps/devsvc-dashboard/dist
 *   node scripts/scan-runtime-paths.mjs <path>         # scan a specific directory
 *   node scripts/scan-runtime-paths.mjs --json <path>  # emit JSON report
 *
 * Exit codes:
 *   0  no workspace absolute path found
 *   1  one or more matches found (or input path missing)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const __filename = fileURLToPath(import.meta.url);

const WORKSPACE_PATH = "/Volumes/code/workspace";
const DEFAULT_TARGET = path.resolve(__dirname, "..", "dist");
const SCANNABLE_EXTENSIONS = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".jsx",
  ".ts",
  ".tsx",
  ".map",
  ".html",
  ".css",
  ".scss",
  ".json",
  ".svg",
  ".txt",
  ".wasm"
]);
const IGNORED_DIR_PARTS = new Set([".git", "node_modules", "coverage"]);

/** Directories we deliberately do not flag. */
const ALLOWLISTED_FILES = new Set([
  // Governance snapshot files that legitimately mention the workspace root;
  // they are produced by `workspace-project-cli.mjs` and shipped as artifacts.
  "workspace-project-completion.json",
  "workspace-project-handoff.json"
]);

/** Read argv without external deps. */
function parseArgs(argv) {
  const args = { json: false, target: DEFAULT_TARGET };
  const positional = [];
  for (const arg of argv) {
    if (arg === "--json") {
      args.json = true;
    } else if (!arg.startsWith("-")) {
      positional.push(arg);
    }
  }
  if (positional.length > 0) {
    args.target = path.resolve(positional[0]);
  }
  return args;
}

/**
 * Recursively yield every file under `root` whose extension is in
 * SCANNABLE_EXTENSIONS. Symlinks and ignored directories are skipped.
 *
 * @param {string} root
 * @returns {Generator<string>}
 */
function* walk(root) {
  if (!fs.existsSync(root)) return;
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isSymbolicLink()) continue;
      const parts = full.split(path.sep);
      if (parts.some((part) => IGNORED_DIR_PARTS.has(part))) continue;
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SCANNABLE_EXTENSIONS.has(ext)) {
          yield full;
        }
      }
    }
  }
}

/**
 * Search a single file for the workspace absolute path. Returns an array of
 * line numbers (1-based) where the path appears, or an empty array when none
 * of the lines contain it.
 *
 * @param {string} filePath
 * @returns {number[]}
 */
function findHits(filePath) {
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/u);
  const hits = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].includes(WORKSPACE_PATH)) {
      hits.push(index + 1);
    }
  }
  return hits;
}

/**
 * Run the scan against the resolved target directory. The result is a list of
 * match records with `{ file, lines }`. Allowlisted governance snapshot files
 * are skipped because they are not runtime wiring.
 *
 * @param {string} target
 */
export function scan(target = DEFAULT_TARGET) {
  if (!fs.existsSync(target)) {
    throw new Error(`scan target does not exist: ${target}`);
  }
  const matches = [];
  for (const filePath of walk(target)) {
    const base = path.basename(filePath);
    if (ALLOWLISTED_FILES.has(base)) continue;
    const lines = findHits(filePath);
    if (lines.length > 0) {
      matches.push({ file: filePath, lines });
    }
  }
  return matches;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(args.target)) {
    console.error(`scan target missing: ${args.target}`);
    process.exit(1);
  }
  let matches;
  try {
    matches = scan(args.target);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  if (args.json) {
    process.stdout.write(JSON.stringify({ target: args.target, matches }, null, 2) + "\n");
  } else {
    process.stdout.write(`Scanning: ${args.target}\n`);
    if (matches.length === 0) {
      process.stdout.write("✅ no /Volumes/code/workspace references in build output\n");
    } else {
      process.stdout.write(`❌ found ${matches.length} file(s) referencing ${WORKSPACE_PATH}:\n`);
      for (const match of matches) {
        process.stdout.write(`  ${match.file}:${match.lines.join(",")}\n`);
      }
    }
  }
  process.exit(matches.length === 0 ? 0 : 1);
}

// Export for tests; only run the CLI when invoked directly.
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (invokedDirectly) {
  main();
}
