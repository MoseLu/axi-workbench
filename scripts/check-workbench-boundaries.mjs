#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { validateCapabilityInventory } from "./verify-capability-inventory.mjs";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);

const ignoredParts = new Set([
  ".build",
  ".cache",
  ".codegraph",
  ".git",
  ".omx",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "target",
  "test-results",
  "tmp",
]);

const implementationRoots = ["apps", "services", "packages", "ai", "infra", "tools"];
const implementationExtensions = new Set([
  ".cjs",
  ".go",
  ".java",
  ".js",
  ".jsx",
  ".mjs",
  ".py",
  ".rs",
  ".swift",
  ".ts",
  ".tsx",
]);

const packageLinkPattern = /(?:^|[/\\])projects[/\\](axi-agent-platform|axi-docs|axi-notify|axi-image-preview|axi-pet|axi-rules)(?:[/\\]|$)/;
const absoluteWorkspacePattern = /\/Volumes\/code\/workspace\/(?:projects|products|shared|infra|tools|references)\//;
const relativeSiblingPattern = /\.\.\/(?:\.\.\/)*(?:projects|products|infra|tools|references)\//;

const communicationGatewayForbidden = [
  {
    pattern: /workspace-project|WORKSPACE_INDEX|workspace\.graph|workspaceRoot/i,
    reason: "communication gateway must not own workspace discovery",
  },
  {
    pattern: /Codex|CODEX_BIN|AgentTask|spawn\(|execFile\(|execSync\(/,
    reason: "communication gateway must not execute agents or shell work",
  },
  {
    pattern: /CC_CONNECT_MEMORY_DATABASE_URL|memoryDatabase|postgres|pg\b/i,
    reason: "communication gateway must not query memory or persistence directly",
  },
];

const violations = [];

try {
  validateCapabilityInventory();
} catch (error) {
  violations.push(error instanceof Error ? error.message : String(error));
}

for (const packageJson of walk(repoRoot).filter((file) => path.basename(file) === "package.json")) {
  inspectPackage(packageJson);
}

for (const file of implementationFiles()) {
  inspectImplementationFile(file);
}

if (violations.length) {
  console.error("Axi Workbench boundary check failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("Axi Workbench boundary check passed.");

function inspectPackage(packageJson) {
  const relative = toRelative(packageJson);
  const data = JSON.parse(fs.readFileSync(packageJson, "utf8"));
  const sections = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
  for (const section of sections) {
    const deps = data[section] ?? {};
    for (const [name, specifier] of Object.entries(deps)) {
      if (typeof specifier !== "string") {
        continue;
      }
      if (absoluteWorkspacePattern.test(specifier) || packageLinkPattern.test(specifier)) {
        violations.push(`${relative}: ${section}.${name} links to another project implementation (${specifier})`);
      }
    }
  }
}

function inspectImplementationFile(file) {
  const relative = toRelative(file);
  if (isFixtureOrTemplate(relative)) {
    return;
  }
  const text = fs.readFileSync(file, "utf8");

  if (absoluteWorkspacePattern.test(text)) {
    violations.push(`${relative}: contains an absolute workspace path; use env/config/registry contracts instead`);
  }

  if (relativeSiblingPattern.test(text)) {
    violations.push(`${relative}: reaches a sibling workspace path by relative traversal; use a package/API/config contract`);
  }

  if (relative.startsWith("services/communication-gateway/")) {
    for (const rule of communicationGatewayForbidden) {
      if (rule.pattern.test(text)) {
        violations.push(`${relative}: ${rule.reason}`);
      }
    }
  }
}

function isFixtureOrTemplate(relative) {
  const parts = relative.split("/");
  const fileName = parts.at(-1) ?? "";
  return (
    parts.some((part) => ["test", "tests", "Tests", "__fixtures__", "fixtures", "templates"].includes(part)) ||
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(fileName) ||
    fileName.includes("Snapshot")
  );
}

function implementationFiles() {
  const files = [];
  for (const root of implementationRoots) {
    const absoluteRoot = path.join(repoRoot, root);
    if (!fs.existsSync(absoluteRoot)) {
      continue;
    }
    for (const file of walk(absoluteRoot)) {
      if (implementationExtensions.has(path.extname(file))) {
        files.push(file);
      }
    }
  }
  return files;
}

function walk(root) {
  const results = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    const relative = toRelative(current);
    if (relative && relative.split(path.sep).some((part) => ignoredParts.has(part))) {
      continue;
    }
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current)) {
        stack.push(path.join(current, entry));
      }
      continue;
    }
    if (stat.isFile()) {
      results.push(current);
    }
  }
  return results;
}

function toRelative(file) {
  return path.relative(repoRoot, file).split(path.sep).join("/");
}
