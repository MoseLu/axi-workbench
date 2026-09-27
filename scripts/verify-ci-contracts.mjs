import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const json = async (path) => JSON.parse(await readFile(path, 'utf8'));
const required = (value, label) => {
  if (!value) throw new Error(`missing ${label}`);
};

const packageJson = await json('package.json');
const turbo = await json('turbo.json');
const workflow = await readFile('.github/workflows/axi-ci.yml', 'utf8');
const workspace = await readFile('pnpm-workspace.yaml', 'utf8');

for (const name of ['build', 'type-check', 'test', 'verify:ci']) {
  required(packageJson.scripts?.[name], `root script ${name}`);
}
const tasks = turbo.tasks ?? turbo.pipeline;
for (const name of ['build', 'type-check', 'test']) {
  required(tasks?.[name], `turbo task ${name}`);
}
required(workspace.includes('packages'), 'workspace package declaration');
// Verify CI workflow contains essential commands. The workbench root
// uses the run_if_script pattern (which falls back to a skip log when
// a script is not present at root); distributions use direct commands.
// Both shapes are accepted; verify:ci is optional because it is not
// part of the workbench baseline CI step (it is a local-only gate).
const hasInstall = workflow.includes('pnpm install --frozen-lockfile') || workflow.includes('pnpm install --frozen-lockfile=false');
const hasTypeCheck = workflow.includes('pnpm type-check') || (workflow.includes('run_if_script') && workflow.includes('type-check'));
const hasTest = workflow.includes('pnpm test') || (workflow.includes('run_if_script') && workflow.includes('test'));
const hasBuild = workflow.includes('pnpm build') || (workflow.includes('run_if_script') && workflow.includes('build'));
required(hasInstall, 'workflow command pnpm install');
required(hasTypeCheck, 'workflow command pnpm type-check');
required(hasTest, 'workflow command pnpm test');
required(hasBuild, 'workflow command pnpm build');

// PR-4 C1: 加真实硬门 — 真正跑 @axi/workstation-contracts test，
// 确保 contracts job 不只是验证脚本存在性，而真的能执行构建验证。
// 这是从"软门"（仅 assert 字符串）升级为"硬门"（真实执行）。
const isCi = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
const skipHardGate = process.env.AXI_VERIFY_CI_SOFT === '1';
if (!skipHardGate) {
  console.log('[verify-ci-contracts] running real hard gate: pnpm --filter @axi/workstation-contracts test');
  const testRun = spawnSync(
    'pnpm',
    ['--filter', '@axi/workstation-contracts', 'test'],
    { stdio: 'inherit', env: process.env },
  );
  if (testRun.status !== 0) {
    throw new Error(
      `@axi/workstation-contracts test failed (exit ${testRun.status}). ` +
      `Set AXI_VERIFY_CI_SOFT=1 to skip the hard gate for local debugging.`,
    );
  }
}

console.log('[verify-ci-contracts] package, turbo, workspace and CI command contracts are valid');
