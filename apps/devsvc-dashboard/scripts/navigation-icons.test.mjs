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

test("axi app navigation dynamically generates menuGroup-based groups", async () => {
  const registrySource = await readFile(path.join(projectRoot, "src", "app-registry.tsx"), "utf8");

  // menuGroup 配置和 staticNavGroups 静态定义
  assert.match(registrySource, /const menuGroupConfig:\s*Record<string,\s*\{[^}]*label:\s*string[^}]*icon:\s*string[^}]*\}>/u);
  assert.match(registrySource, /const staticNavGroups:\s*NavGroup\[\]/u);

  // 动态分组逻辑：hostedAppItems 和 filteredResources
  assert.match(registrySource, /const hostedAppItems:\s*NavItem\[\]\s*=\s*apps\.filter\(\(app\)\s*=>\s*app\.hostedMode\)\.map/u);
  assert.match(registrySource, /const filteredResources\s*=\s*resources\.filter\(/u);
  assert.match(registrySource, /const menuGroupMap\s*=\s*new Map/u);

  // 动态生成分组结构：基于 menuGroupMap 循环创建分组
  assert.match(registrySource, /for\s*\(\s*const\s*\[\s*groupKey,\s*items\s*\]\s+of\s+menuGroupMap\)/u);
  assert.match(registrySource, /groups\.push\(\{\s*key:\s*groupKey/);
});
