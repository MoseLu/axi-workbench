import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sharedRoot = path.resolve(projectRoot, "..", "..", "..", "..", "shared", "axi-ui");

test("hosted breadcrumbs expose host and subapp scopes", async () => {
  const registrySource = await readFile(path.join(projectRoot, "src", "app-registry.tsx"), "utf8");
  const shellSource = await readFile(path.join(projectRoot, "src", "app-shell", "Shell.tsx"), "utf8");
  const hostedStyles = await readFile(path.join(projectRoot, "src", "styles", "hosted-apps.scss"), "utf8");
  const sharedLayoutSource = await readFile(path.join(sharedRoot, "packages", "shell", "src", "layout.tsx"), "utf8");

  assert.match(registrySource, /scope\?:\s*"host"\s*\|\s*"subapp"/u);
  assert.match(registrySource, /className:\s*"breadcrumb-scope-host"[\s\S]*?scope:\s*"host"/u);
  assert.match(registrySource, /className:\s*"breadcrumb-scope-subapp"[\s\S]*?scope:\s*"subapp"/u);
  assert.match(shellSource, /className:\s*item\.className/u);
  assert.match(shellSource, /scope:\s*item\.scope/u);
  assert.match(sharedLayoutSource, /data-scope=\{item\.scope\}/u);
  assert.match(sharedLayoutSource, /is-scope-boundary/u);
  assert.match(hostedStyles, /\.axi-breadcrumb-item\.breadcrumb-scope-host/u);
  assert.match(hostedStyles, /\.axi-breadcrumb-item\.breadcrumb-scope-subapp/u);
  assert.match(hostedStyles, /\.axi-breadcrumb-separator\.is-scope-boundary/u);
  assert.doesNotMatch(hostedStyles, /\.axi-breadcrumb-separator\.is-scope-boundary::after/u);
  assert.doesNotMatch(hostedStyles, /rotate\(45deg\)/u);
});
