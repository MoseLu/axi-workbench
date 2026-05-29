import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_LINES = 600;
const dashboardRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(dashboardRoot, "..");
const eligibleExtensions = new Set([".css", ".mjs", ".scss", ".ts", ".tsx"]);
const ignoredDirectories = new Set(["dist", "node_modules", "coverage"]);
const staged = process.argv.includes("--staged");

function isEligible(file) {
  return eligibleExtensions.has(extname(file)) && !file.split("/").some((part) => ignoredDirectories.has(part));
}

function walk(entry, files = []) {
  if (!existsSync(entry)) return files;
  const stats = statSync(entry);
  if (stats.isFile()) {
    if (isEligible(entry)) files.push(entry);
    return files;
  }
  for (const item of readdirSync(entry)) {
    if (!ignoredDirectories.has(item)) walk(join(entry, item), files);
  }
  return files;
}

function countLines(content) {
  if (!content) return 0;
  return content.split(/\r?\n/).length - (content.endsWith("\n") ? 1 : 0);
}

function stagedFiles() {
  const listed = execFileSync("git", ["-C", repoRoot, "diff", "--cached", "--name-only", "--diff-filter=ACMR"], { encoding: "utf8" });
  return listed
    .trim()
    .split("\n")
    .filter(Boolean)
    .filter((file) => file.startsWith("dashboard/") && isEligible(file))
    .map((file) => ({
      file: resolve(repoRoot, file),
      text: execFileSync("git", ["-C", repoRoot, "show", `:${file}`], { encoding: "utf8" }),
    }));
}

const files = staged
  ? stagedFiles()
  : [
      ...walk(join(dashboardRoot, "src")),
      ...walk(join(dashboardRoot, "scripts")),
      ...walk(join(dashboardRoot, "vite.config.ts")),
    ].map((file) => ({ file, text: readFileSync(file, "utf8") }));
const offenders = files
  .map(({ file, text }) => ({ file: relative(dashboardRoot, file), lines: countLines(text) }))
  .filter(({ lines }) => lines > MAX_LINES)
  .sort((left, right) => right.lines - left.lines);

if (offenders.length) {
  console.error(`[file-lines] FAIL Files over ${MAX_LINES} lines:`);
  for (const offender of offenders) console.error(`  ${offender.lines}  ${offender.file}`);
  process.exit(1);
}

console.log(`[file-lines] PASS ${files.length} file(s), limit ${MAX_LINES} lines.`);
