#!/usr/bin/env node

// 契约治理防线 3：依赖守门。
// 扫描所有 app 的 package.json，禁止业务应用声明 antd / @ant-design/* 或任何
// 第二套 UI 组件库。它能在 `pnpm add antd` 之后、提交时把改动拦下。
//
// 存量应用在 allowedPrefixes 中豁免（只减不增）；@axi UI 封装层位于
// foundation/axi-ui，不在本 monorepo 扫描范围内，其对 antd 的依赖是合法的。
// 依据：docs/prd/02-CONTRACT-AND-CONSTRAINT-GOVERNANCE.md（Golden Rules R1/R3）。

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
const dependencySections = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
];

// 允许保留 antd / 第二套 UI 库的存量位置（目录前缀，以 / 结尾）。
// 迁移完成后从这里删除对应条目。
const allowedPrefixes = [
  // 主 app：当前在 App.tsx/main.tsx 用 antd 做根级主题/locale/reset 桥接，
  // 待迁移到 AxiThemeProvider + @axi/tokens 后移除。
  'apps/workbench/',
  'apps/devsvc-dashboard/',
  'apps/resource-orchestration/',
];

// 精确禁止的包名
const bannedExact = new Set([
  'antd',
  'semantic-ui-react',
  'react-bootstrap',
  'bootstrap',
  'grommet',
  'evergreen-ui',
  'rebass',
]);

// 按 scope 前缀禁止的第二套 UI 库
const bannedPrefixes = [
  '@ant-design/',
  '@mui/',
  '@material-ui/',
  '@chakra-ui/',
  '@blueprintjs/',
];

const violations = [];
let inspected = 0;

function isBanned(name) {
  if (bannedExact.has(name)) return true;
  return bannedPrefixes.some((prefix) => name.startsWith(prefix));
}

function isAllowed(relative) {
  return allowedPrefixes.some((prefix) => relative.startsWith(prefix));
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
    } else if (stat.isFile() && path.basename(current) === 'package.json') {
      results.push(current);
    }
  }
  return results;
}

for (const root of scanRoots) {
  const absoluteRoot = path.join(repoRoot, root);
  if (!fs.existsSync(absoluteRoot)) continue;
  for (const packageJson of walk(absoluteRoot)) {
    const relative = toRelative(packageJson);
    inspected++;
    if (isAllowed(relative)) continue;

    let data;
    try {
      data = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
    } catch (error) {
      violations.push(`${relative}: 无法解析 package.json（${error.message}）`);
      continue;
    }

    for (const section of dependencySections) {
      const deps = data[section] ?? {};
      for (const name of Object.keys(deps)) {
        if (isBanned(name)) {
          violations.push(
            `${relative}: ${section}.${name} 引入了被禁止的 UI 库。\n` +
              `    Axi 前端只能依赖 @axi/* 表面（R1），UI 依赖只减不增（R3）。` +
              `如确需新能力，请扩展 @axi 包，而不是给业务 app 增加 UI 库。` +
              `见 docs/prd/02-CONTRACT-AND-CONSTRAINT-GOVERNANCE.md。`,
          );
        }
      }
    }
  }
}

if (violations.length) {
  console.error('Axi dependency policy check failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(
  `Axi dependency policy check passed（检查 ${inspected} 个 package.json；存量 antd 已豁免，新 app / 新依赖不得引入第二套 UI 库）。`,
);
