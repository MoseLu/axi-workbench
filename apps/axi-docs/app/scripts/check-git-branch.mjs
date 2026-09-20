import { spawnSync } from 'node:child_process';

const ALLOWED_BRANCH_PATTERN =
  /^(dev|main|(feature|fix|hotfix|docs|refactor|perf|test|ci|build|chore)\/[a-z0-9][a-z0-9._/-]*|(dependabot|renovate)\/[a-z0-9][a-z0-9._/-]*)$/;

function readCurrentBranch() {
  const result = spawnSync('git', ['branch', '--show-current'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });

  if (result.status !== 0) {
    return '';
  }

  return result.stdout.trim();
}

const branchName =
  process.argv[2] ??
  process.env.AXI_DOCS_BRANCH_NAME ??
  process.env.GITHUB_HEAD_REF ??
  process.env.GITHUB_REF_NAME ??
  readCurrentBranch();

if (!branchName) {
  throw new Error('Unable to determine the current branch.');
}

if (!ALLOWED_BRANCH_PATTERN.test(branchName)) {
  throw new Error(
    `Invalid branch "${branchName}". Use dev, main, or a short-lived branch such as feature/<slug>, fix/<slug>, or hotfix/<slug>.`,
  );
}

console.log(`[governance] branch accepted: ${branchName}`);
