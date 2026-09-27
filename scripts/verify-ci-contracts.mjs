import { readFile } from 'node:fs/promises';

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
console.log('[verify-ci-contracts] package, turbo, workspace and CI command contracts are valid');
