#!/usr/bin/env node
import { chmodSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

function run(command, args) {
  return spawnSync(command, args, { encoding: "utf8", stdio: "pipe" });
}

const isRepo = run("git", ["rev-parse", "--is-inside-work-tree"]);
if (isRepo.status !== 0 || isRepo.stdout.trim() !== "true") {
  console.log("[git-hooks] Skipped: not inside a git worktree.");
  process.exit(0);
}

const hooksPath = ".githooks";
const configResult = run("git", ["config", "core.hooksPath", hooksPath]);
if (configResult.status !== 0) {
  console.error(configResult.stderr.trim() || "[git-hooks] Failed to configure core.hooksPath.");
  process.exit(configResult.status || 1);
}

for (const hook of [`${hooksPath}/pre-commit`, `${hooksPath}/pre-push`]) {
  if (existsSync(hook)) chmodSync(hook, 0o755);
}

console.log(`[git-hooks] core.hooksPath=${hooksPath}`);
