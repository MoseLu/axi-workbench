#!/usr/bin/env node

// 契约治理防线 4：统一契约门禁（单一入口）。
// 依次执行：UI 守门 → 依赖守门 → 边界检查 → Axi UI 采用 → CSS 架构 → 能力清单 → 文档漂移，
// 任一失败即整体失败。pre-commit 钩子与 CI 统一调用本脚本，
// 避免"各跑各的、漏跑某一项"。
//
// 用法：node scripts/check-contracts.mjs
// 依据：docs/prd/02-CONTRACT-AND-CONSTRAINT-GOVERNANCE.md。

import { spawnSync } from 'node:child_process';
import path from 'node:path';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const node = process.execPath;

const checks = [
  { name: 'UI import 守门（R1 单一 UI 表面）', cmd: 'scripts/check-ui-imports.mjs', args: [] },
  { name: '依赖守门（R3 依赖只减不增）', cmd: 'scripts/check-dependency-policy.mjs', args: [] },
  { name: 'Workbench 边界（R5/R6 契约唯一、改动可追溯）', cmd: 'scripts/check-workbench-boundaries.mjs', args: [] },
  { name: 'Axi UI 采用（R1 缺口回流 / 隔离页守门）', cmd: 'scripts/check-axi-ui-adoption.mjs', args: [] },
  { name: 'CSS 架构（!important / global selector / literal color / 重复 token）', cmd: 'scripts/check-css-architecture.mjs', args: [] },
  { name: '能力清单（CAPABILITY-INVENTORY 字段完整性）', cmd: 'scripts/verify-capability-inventory.mjs', args: [] },
  { name: '项目 dossier 漂移（en/zh 双语对齐）', cmd: 'apps/axi-docs/app/scripts/check-dossier-drift.mjs', args: [] },
];

const failures = [];

for (const { name, cmd, args } of checks) {
  console.log(`\n────────────────────────────────────────────────────────`);
  console.log(`▶ ${name}`);
  console.log(`  ${cmd}${args && args.length ? ' ' + args.join(' ') : ''}`);
  const result = spawnSync(node, [path.join(repoRoot, cmd), ...(args ?? [])], {
    cwd: repoRoot,
    stdio: 'inherit',
  });

  if (result.status === 0) {
    console.log(`  ✓ 通过`);
  } else {
    console.error(`  ✗ 失败（退出码 ${result.status ?? '未知'}）`);
    failures.push(name);
  }
}

console.log(`\n────────────────────────────────────────────────────────`);

if (failures.length) {
  console.error(`契约门禁未通过，${failures.length} 项检查失败：`);
  for (const label of failures) console.error(`  - ${label}`);
  console.error(
    '\n请按上述提示修复；若是 @axi 缺少组件，走缺口回流（docs/prd/02 §8），不要绕过契约。',
  );
  process.exit(1);
}

console.log('✓ 所有契约门禁通过。');
