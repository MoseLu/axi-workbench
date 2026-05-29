import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dashboardRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(dashboardRoot, "..");

execFileSync("git", ["-C", repoRoot, "config", "core.hooksPath", ".githooks"], { stdio: "inherit" });
console.log("[git-hooks] configured .githooks for fleet-console.");
