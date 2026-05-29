#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const maxLines = 600;
const args = new Set(process.argv.slice(2));
const mode = args.has("--staged") ? "staged" : args.has("--push") ? "push" : "all";
const auditedExtensions = new Set([".css", ".js", ".jsx", ".mjs", ".scss", ".ts", ".tsx"]);
const ignoredPathParts = new Set([".git", "build", "coverage", "dist", "node_modules", "public", "test-results", "tmp"]);
const ignoredFiles = new Set(["pnpm-lock.yaml"]);

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim();
    throw new Error(detail || `${command} ${args.join(" ")} failed`);
  }
  return result.stdout;
}

function splitNul(value) {
  return value.split("\0").filter(Boolean);
}

function extensionOf(filePath) {
  const index = filePath.lastIndexOf(".");
  return index >= 0 ? filePath.slice(index) : "";
}

function isAuditedPath(filePath) {
  if (ignoredFiles.has(filePath)) return false;
  if (!auditedExtensions.has(extensionOf(filePath))) return false;
  const parts = filePath.split("/");
  if (parts.some((part) => ignoredPathParts.has(part))) return false;
  return filePath.startsWith("src/") || filePath.startsWith("scripts/") || /(^|\/)[^/]+\.config\.(js|mjs|ts)$/.test(filePath);
}

function currentFiles() {
  return splitNul(run("git", ["ls-files", "-co", "--exclude-standard", "-z"])).filter(isAuditedPath);
}

function stagedFiles() {
  return splitNul(run("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"])).filter(isAuditedPath);
}

function readCurrentFile(filePath) {
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
}

function readStagedFile(filePath) {
  return run("git", ["show", `:${filePath}`]);
}

function countLines(content) {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!normalized) return 0;
  const text = normalized.endsWith("\n") ? normalized.slice(0, -1) : normalized;
  return text ? text.split("\n").length : 0;
}

function audit(files, reader) {
  return files
    .map((filePath) => ({ filePath, lines: countLines(reader(filePath)) }))
    .filter((item) => item.lines > maxLines)
    .sort((a, b) => b.lines - a.lines || a.filePath.localeCompare(b.filePath));
}

const files = mode === "staged" ? stagedFiles() : currentFiles();
const failures = audit(files, mode === "staged" ? readStagedFile : readCurrentFile);

if (!failures.length) {
  console.log(`[file-lines] PASS ${files.length} file(s), limit ${maxLines} lines.`);
  process.exit(0);
}

console.error(`[file-lines] FAIL ${failures.length} file(s) exceed ${maxLines} lines:`);
for (const failure of failures) {
  console.error(`  ${failure.lines.toString().padStart(4, " ")}  ${failure.filePath}`);
}
console.error("Split large source/style files by feature before committing or pushing.");
process.exit(1);
