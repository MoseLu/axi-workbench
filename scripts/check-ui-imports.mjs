#!/usr/bin/env node

// 契约治理防线 1（脚本化硬底线）：全仓扫描业务源码，禁止直接 import
// `antd` / `@ant-design/icons`（含子路径与 side-effect css）。
//
// 零依赖：即使没有安装 ESLint，CI / pre-commit 也能执行。
// 规则与 eslint.config.mjs、docs/prd/02 §5 豁免清单保持一致。
// 依据：docs/prd/02-CONTRACT-AND-CONSTRAINT-GOVERNANCE.md（Golden Rules R1）。

import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);

const ignoredParts = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.turbo',
  '.git',
  '.vite',
  'test-results',
]);

const scanRoots = ['apps'];
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

// 目录前缀豁免（相对路径，统一用 / 分隔，以 / 结尾）
const exemptPrefixes = [
  'apps/devsvc-dashboard/',
  'apps/resource-orchestration/',
  'apps/workbench/src/pages/admin/',
  'apps/workbench/src/pages/commit-ledger/',
];

// 精确文件豁免
const exemptFiles = new Set([
  // 应用根 / 入口：antd ConfigProvider 主题、locale、reset.css 桥接（配置层）
  'apps/workbench/src/App.tsx',
  'apps/workbench/src/main.tsx',
  // 独立认证表面
  'apps/workbench/src/pages/Login.tsx',
  // 已被路由表隔离为 404 的旧页面
  'apps/workbench/src/pages/ProjectDetail.tsx',
  'apps/workbench/src/pages/Projects.tsx',
]);

// 同时捕获：import { X } from 'antd'、import x from 'antd/locale/en_US'、
// import 'antd/dist/reset.css'、@ant-design/icons 及其子路径。
const bannedImportPattern =
  /(?:\bfrom\s*|import\s*)['"](antd|@ant-design\/icons)(?:\/[^'"]*)?['"]/;

const violations = [];
let scanned = 0;

function isExempt(relative) {
  if (exemptFiles.has(relative)) return true;
  return exemptPrefixes.some((prefix) => relative.startsWith(prefix));
}

function toRelative(file) {
  return path.relative(repoRoot, file).split(path.sep).join('/');
}

function walk(root) {
  const results = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    const relative = toRelative(current);
    if (relative && relative.split('/').some((part) => ignoredParts.has(part))) {
      continue;
    }
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current)) {
        stack.push(path.join(current, entry));
      }
    } else if (stat.isFile()) {
      results.push(current);
    }
  }
  return results;
}

for (const root of scanRoots) {
  const absoluteRoot = path.join(repoRoot, root);
  if (!fs.existsSync(absoluteRoot)) continue;
  for (const file of walk(absoluteRoot)) {
    if (!extensions.has(path.extname(file))) continue;
    const relative = toRelative(file);
    if (isExempt(relative)) continue;
    scanned++;
    const text = fs.readFileSync(file, 'utf8');
    const match = text.match(bannedImportPattern);
    if (match) {
      violations.push(
        `${relative}: 直接 import '${match[1]}' 绕过了 @axi UI 表面（R1 单一 UI 表面）。\n` +
          `    复用映射见 docs/prd/02-CONTRACT-AND-CONSTRAINT-GOVERNANCE.md §4；` +
          `若 @axi 缺少所需组件，请扩展对应 @axi 包（缺口回流 §8），不要在业务页面直接引入。`,
      );
    }
  }
}

if (violations.length) {
  console.error('Axi UI import check failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(
  `Axi UI import check passed（扫描 ${scanned} 个源文件；存量 antd 用法已按 docs/prd/02 §5 豁免，只减不增）。`,
);
