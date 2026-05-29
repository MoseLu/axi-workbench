import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test("hosted app navigation uses distinct group and app icons", async () => {
  const registrySource = await readFile(path.join(projectRoot, "src", "app-registry.tsx"), "utf8");
  const shellSource = await readFile(path.join(projectRoot, "src", "app-shell", "Shell.tsx"), "utf8");

  assert.match(registrySource, /key:\s*"axi-apps",\s*[\s\S]*?icon:\s*axiAppsIcon\(\)/u);
  assert.match(registrySource, /key:\s*hostedAppRoute\(app\)[\s\S]*?icon:\s*hostedAppIcon\(app\)/u);
  assert.match(registrySource, /title:\s*hostedAppTitle\(match\.app,\s*t\),\s*icon:\s*hostedAppIcon\(match\.app\)/u);
  assert.match(shellSource, /hostedAppIcon\(currentHostedApp,\s*14\)/u);
});

test("axi app navigation keeps only real apps in the app group", async () => {
  const registrySource = await readFile(path.join(projectRoot, "src", "app-registry.tsx"), "utf8");

  assert.match(registrySource, /key:\s*"axi-apps",\s*[\s\S]*?label:\s*"Axi 应用",\s*[\s\S]*?children:\s*\[\s*\]/u);
  assert.match(registrySource, /key:\s*"axi-resources",\s*[\s\S]*?label:\s*"Axi 资源",\s*[\s\S]*?label:\s*"资源索引"/u);
  assert.match(registrySource, /const hostedAppItems:\s*NavItem\[\]\s*=\s*apps\.filter\(\(app\)\s*=>\s*app\.hostedMode\)\.map/u);
  assert.match(registrySource, /const resourceItems:\s*NavItem\[\]\s*=\s*resources\.filter\(\(resource\)\s*=>\s*resource\.surface\s*!==\s*"hosted-app"\)\.map/u);
});
