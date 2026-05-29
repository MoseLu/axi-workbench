import type { ScaffoldConfig } from '@axi/scaffold-kit';
import { serializeJson } from '@axi/scaffold-kit';

export function createPythonUtils(): string {
  return `import path from 'node:path';
import { spawnSync } from 'node:child_process';

function resolveExecutable(command) {
  if (process.platform === 'win32' && command === 'pnpm') {
    return 'pnpm.cmd';
  }

  return command;
}

export function resolveVenvPython(cwd = process.cwd()) {
  return process.platform === 'win32'
    ? path.join(cwd, '.venv', 'Scripts', 'python.exe')
    : path.join(cwd, '.venv', 'bin', 'python');
}

export function run(command, args, options = {}) {
  const result = spawnSync(resolveExecutable(command), args, {
    cwd: options.cwd ?? process.cwd(),
    env: {
      ...process.env,
      ...(options.env ?? {}),
    },
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(\`Command failed: \${command} \${args.join(' ')}\`);
  }
}

export function runInVenv(args, options = {}) {
  run(resolveVenvPython(options.cwd), args, options);
}
`;
}

export function createSetupPython(): string {
  return `import { existsSync } from 'node:fs';
import path from 'node:path';

import { resolveVenvPython, run } from './python-utils.mjs';

const rootDir = process.cwd();
const venvDirectory = path.join(rootDir, '.venv');

if (!existsSync(venvDirectory)) {
  run('python', ['-m', 'venv', '.venv'], { cwd: rootDir });
}

run(resolveVenvPython(rootDir), ['-m', 'pip', 'install', '--upgrade', 'pip'], { cwd: rootDir });
run(resolveVenvPython(rootDir), ['-m', 'pip', 'install', '-e', './apps/api[dev]'], {
  cwd: rootDir,
});

console.log('Python environment is ready.');
`;
}

export function createRunApiTests(): string {
  return `import { runInVenv } from './python-utils.mjs';

runInVenv(['-m', 'pytest', 'apps/api/tests'], { cwd: process.cwd() });
`;
}

export function createRunApiDev(config: ScaffoldConfig): string {
  return `import { runInVenv } from './python-utils.mjs';

runInVenv(
  ['-m', 'flask', '--app', '${config.pythonModuleName}.app:create_app', 'run', '--debug'],
  { cwd: process.cwd() },
);
`;
}

export function createVerifyApi(config: ScaffoldConfig): string {
  return `import { runInVenv } from './python-utils.mjs';

const smokeTest = [
  'from ${config.pythonModuleName}.app import create_app',
  '',
  'app = create_app()',
  'client = app.test_client()',
  'response = client.get("/health")',
  'assert response.status_code == 200',
  'assert response.get_json() == {"feature": "health", "status": "ok"}',
  'print("api smoke verification passed")',
].join('\\n');

runInVenv(['-c', smokeTest], { cwd: process.cwd() });
`;
}

export function createInstallHooks(): string {
  return `import { existsSync } from 'node:fs';
import { chmod } from 'node:fs/promises';
import path from 'node:path';

import { run } from './python-utils.mjs';

const rootDir = process.cwd();

if (!existsSync(path.join(rootDir, '.git'))) {
  run('git', ['init', '-b', 'dev'], { cwd: rootDir });
}

run('git', ['config', 'core.hooksPath', '.githooks'], { cwd: rootDir });
run('node', ['./scripts/setup-git-governance.mjs'], { cwd: rootDir });

for (const hookName of ['pre-commit', 'pre-push', 'commit-msg']) {
  const hookPath = path.join(rootDir, '.githooks', hookName);
  await chmod(hookPath, 0o755);
}

console.log('Git hooks installed.');
`;
}

export function createCheckDocs(): string {
  return `import { stat } from 'node:fs/promises';

const requiredFiles = [
  '.axi/modules.json',
  '.axi/scaffold.manifest.json',
  '.env.resources.example',
  'README.md',
  'AGENTS.md',
  'CONTRIBUTING.md',
  'TODO.md',
  'MILESTONE.md',
  'CHANGELOG.md',
  '.czrc',
  'commitlint.config.cjs',
  'config/resource-classification.config.json',
  'config/resource-storage.config.json',
  'docs/ARCHITECTURE.md',
  'docs/BRANCH_PROTECTION.md',
  'docs/COMMIT_CONVENTION.md',
  'docs/GITHUB_FLOW.md',
  'docs/MODULES.md',
  'docs/OPERATIONS.md',
  'docs/PRD_TEMPLATE.md',
  'docs/RELEASE_OPERATIONS.md',
  'docs/RESOURCE_AGENT_SKILLS.md',
  'docs/RESOURCE_MANAGEMENT.md',
  'docs/RESOURCE_INDEX.md',
  'docs/RESOURCE_STORAGE.md',
  'docs/TOKEN_SYSTEM.md',
  'docs/TDD_TEMPLATE.md',
  'docs/QUALITY_GATE.md',
  '.github/PULL_REQUEST_TEMPLATE.md',
  '.github/workflows/ci.yml',
];

const missingFiles = [];

for (const filePath of requiredFiles) {
  try {
    const fileStats = await stat(filePath);

    if (!fileStats.isFile()) {
      missingFiles.push(filePath);
    }
  } catch {
    missingFiles.push(filePath);
  }
}

if (missingFiles.length > 0) {
  throw new Error(\`Missing required docs: \${missingFiles.join(', ')}\`);
}

console.log('Docs gate passed.');
`;
}

export function createCheckGitBranch(): string {
  return `import { spawnSync } from 'node:child_process';

const ALLOWED_BRANCH_PATTERN =
  /^(dev|main|(feature|fix|hotfix|docs|refactor|perf|test|ci|build|chore)\\/[a-z0-9][a-z0-9._/-]*|(dependabot|renovate)\\/[a-z0-9][a-z0-9._/-]*)$/;

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
  process.env.AXI_BRANCH_NAME ??
  process.env.GITHUB_HEAD_REF ??
  process.env.GITHUB_REF_NAME ??
  readCurrentBranch();

if (!branchName) {
  throw new Error(
    'Unable to determine the current branch. Pass a branch name or run from an attached branch.',
  );
}

if (!ALLOWED_BRANCH_PATTERN.test(branchName)) {
  throw new Error(
    \`Invalid branch "\${branchName}". Use dev, main, or a short-lived branch such as feature/<slug>, fix/<slug>, or hotfix/<slug>.\`,
  );
}

console.log(\`[governance] branch accepted: \${branchName}\`);
`;
}

export function createCheckPrTitle(): string {
  return `const CONVENTIONAL_TITLE_PATTERN =
  /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\\([^)\\r\\n]+\\))?!?: .+/;

const title = process.argv.slice(2).join(' ').trim() || process.env.PR_TITLE?.trim() || '';

if (!title) {
  throw new Error(
    'Missing PR title. Pass it as arguments or set PR_TITLE in the environment.',
  );
}

if (title.length > 72) {
  throw new Error(
    \`PR title is too long (\${title.length} chars). Keep it within 72 characters.\`,
  );
}

if (!CONVENTIONAL_TITLE_PATTERN.test(title)) {
  throw new Error(
    'PR title must follow Conventional Commits, for example: feat(web): add theme switcher',
  );
}

console.log(\`[governance] PR title accepted: \${title}\`);
`;
}

export function createCheckCommitRange(): string {
  return `import { spawnSync } from 'node:child_process';

function readFlagValue(flagName) {
  const flags = process.argv.slice(2);
  const index = flags.indexOf(flagName);

  if (index === -1) {
    return undefined;
  }

  const value = flags[index + 1];

  if (!value || value.startsWith('--')) {
    throw new Error(\`Expected a value after \${flagName}\`);
  }

  return value;
}

function git(args) {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });

  if (result.status !== 0) {
    throw new Error(\`Git command failed: git \${args.join(' ')}\`);
  }

  return result.stdout.trim();
}

function normalizeFromSha(value) {
  if (!value || /^0+$/.test(value)) {
    return git(['rev-list', '--max-parents=0', 'HEAD']).split(/\\r?\\n/)[0];
  }

  return value;
}

const from = normalizeFromSha(readFlagValue('--from') ?? process.env.AXI_COMMIT_FROM ?? '');
const to = readFlagValue('--to') ?? process.env.AXI_COMMIT_TO ?? process.env.GITHUB_SHA ?? 'HEAD';

const result = spawnSync(
  process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
  ['exec', 'commitlint', '--from', from, '--to', to, '--verbose'],
  { stdio: 'inherit' },
);

if (result.status !== 0) {
  throw new Error(\`Conventional commit check failed for range \${from}..\${to}\`);
}

console.log(\`[governance] commit range accepted: \${from}..\${to}\`);
`;
}

export function createSetupGitGovernance(): string {
  return `import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

function git(args, options = {}) {
  const result = spawnSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  });

  if (result.status !== 0) {
    throw new Error(\`Git command failed: git \${args.join(' ')}\`);
  }

  return options.capture ? result.stdout.trim() : '';
}

if (!existsSync('.git')) {
  git(['init', '-b', 'dev']);
}

git(['config', 'core.hooksPath', '.githooks']);

const currentBranch = git(['branch', '--show-current'], { capture: true });
const hasDevBranch = git(['branch', '--list', 'dev'], { capture: true }).trim().length > 0;

if (!hasDevBranch) {
  if (!currentBranch || currentBranch === 'main' || currentBranch === 'master') {
    git(['checkout', '-b', 'dev']);
  } else {
    git(['branch', 'dev']);
  }
} else if (currentBranch === 'main' || currentBranch === 'master') {
  git(['checkout', 'dev']);
}

console.log('[governance] git flow bootstrap complete.');
`;
}

export function createEnvResourcesExample(): string {
  return `# Copy this file to .env.resources.local and fill the values before syncing assets.
# Do not commit real credentials.

AXI_ALIYUN_OSS_ACCESS_KEY_ID=
AXI_ALIYUN_OSS_ACCESS_KEY_SECRET=
AXI_ALIYUN_OSS_STS_TOKEN=
AXI_ALIYUN_OSS_REGION=
AXI_ALIYUN_OSS_ENDPOINT=
AXI_ALIYUN_OSS_PUBLIC_BUCKET=
AXI_ALIYUN_OSS_PRIVATE_BUCKET=
`;
}

export function createResourceStorageConfig(): string {
  return serializeJson({
    lanes: {
      private: {
        acl: 'private',
        bucketEnv: 'AXI_ALIYUN_OSS_PRIVATE_BUCKET',
        excludeFileNames: ['README.md'],
        keyPrefix: '',
        provider: 'aliyunOss',
        sourceDir: 'resources/private',
      },
      public: {
        acl: 'private',
        bucketEnv: 'AXI_ALIYUN_OSS_PUBLIC_BUCKET',
        excludeFileNames: ['README.md'],
        keyPrefix: '',
        provider: 'aliyunOss',
        sourceDir: 'resources/public/web',
      },
    },
    providers: {
      aliyunOss: {
        accessKeyIdEnv: 'AXI_ALIYUN_OSS_ACCESS_KEY_ID',
        accessKeySecretEnv: 'AXI_ALIYUN_OSS_ACCESS_KEY_SECRET',
        authMode: 'aksk',
        authorizationV4: true,
        endpointEnv: 'AXI_ALIYUN_OSS_ENDPOINT',
        region: 'oss-cn-hangzhou',
        regionEnv: 'AXI_ALIYUN_OSS_REGION',
        sessionTokenEnv: 'AXI_ALIYUN_OSS_STS_TOKEN',
        type: 'aliyun-oss',
      },
    },
    version: 1,
  });
}

export function createLoadLocalEnv(): string {
  return `import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

export function loadLocalEnvFiles(
  cwd = process.cwd(),
  fileNames = ['.env.resources.local', '.env.local'],
) {
  const loadedFiles = [];

  for (const fileName of fileNames) {
    const filePath = path.join(cwd, fileName);

    if (!existsSync(filePath)) {
      continue;
    }

    const content = readFileSync(filePath, 'utf8');

    for (const rawLine of content.split(/\\r?\\n/)) {
      const line = rawLine.trim();

      if (!line || line.startsWith('#')) {
        continue;
      }

      const separatorIndex = line.indexOf('=');

      if (separatorIndex <= 0) {
        continue;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = stripQuotes(line.slice(separatorIndex + 1).trim());

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }

    loadedFiles.push(fileName);
  }

  return loadedFiles;
}

export function readRequiredEnv(envName) {
  const value = process.env[envName];

  if (!value) {
    throw new Error(\`Missing required environment variable: \${envName}\`);
  }

  return value;
}
`;
}

export function createResourceStorageUtils(): string {
  return `import { createHash } from 'node:crypto';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import OSS from 'ali-oss';

import { loadLocalEnvFiles, readRequiredEnv } from './load-local-env.mjs';

const CONFIG_RELATIVE_PATH = 'config/resource-storage.config.json';

function ensureObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(\`Invalid \${label}: expected an object.\`);
  }

  return value;
}

function ensureString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(\`Invalid \${label}: expected a non-empty string.\`);
  }

  return value;
}

function ensureStringArray(value, label) {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(\`Invalid \${label}: expected an array of strings.\`);
  }

  return value;
}

function ensureBoolean(value, label) {
  if (typeof value !== 'boolean') {
    throw new Error(\`Invalid \${label}: expected a boolean.\`);
  }

  return value;
}

function ensureOptionalString(value, label) {
  if (value === undefined) {
    return undefined;
  }

  return ensureString(value, label);
}

function ensureStringAllowEmpty(value, label) {
  if (typeof value !== 'string') {
    throw new Error(\`Invalid \${label}: expected a string.\`);
  }

  return value;
}

function normalizeBucketSegment(value) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'app';
}

function trimBucketSegment(value, maxLength) {
  if (value.length <= maxLength) {
    return value;
  }

  return value.slice(0, maxLength).replace(/-+$/g, '') || 'app';
}

async function readProjectBucketSeed(cwd) {
  try {
    const packageJson = JSON.parse(await readFile(path.join(cwd, 'package.json'), 'utf8'));

    if (typeof packageJson.name === 'string' && packageJson.name.trim().length > 0) {
      return packageJson.name;
    }
  } catch {}

  return path.basename(cwd);
}

async function buildAutoBucketName(cwd, laneName, accessKeyId, attempt = 0) {
  const seed = normalizeBucketSegment(await readProjectBucketSeed(cwd));
  const lane = normalizeBucketSegment(laneName);
  const digest = createHash('sha256').update(accessKeyId).digest('hex').slice(0, 10);
  const suffix = attempt === 0 ? digest : \`\${digest}-\${attempt}\`;
  const maxSeedLength = Math.max(3, 63 - ('axi'.length + lane.length + suffix.length + 3));
  const trimmedSeed = trimBucketSegment(seed, maxSeedLength);

  return \`axi-\${trimmedSeed}-\${lane}-\${suffix}\`;
}

function toPosixPath(value) {
  return value.split(path.sep).join('/');
}

function joinObjectKey(prefix, relativePath) {
  const normalizedRelativePath = toPosixPath(relativePath).replace(/^\\/+/, '');
  const normalizedPrefix = prefix ? prefix.replace(/^\\/+|\\/+$/g, '') : '';

  return normalizedPrefix ? \`\${normalizedPrefix}/\${normalizedRelativePath}\` : normalizedRelativePath;
}

function guessContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  switch (extension) {
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.ico':
      return 'image/x-icon';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.js':
    case '.mjs':
      return 'text/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.html':
      return 'text/html; charset=utf-8';
    case '.txt':
      return 'text/plain; charset=utf-8';
    case '.webmanifest':
      return 'application/manifest+json; charset=utf-8';
    case '.woff':
      return 'font/woff';
    case '.woff2':
      return 'font/woff2';
    default:
      return undefined;
  }
}

async function collectFiles(rootDir, currentDir = rootDir) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(rootDir, absolutePath)));
      continue;
    }

    if (entry.isFile()) {
      files.push(absolutePath);
    }
  }

  return files;
}

function parseProvider(rawProvider, providerName) {
  const provider = ensureObject(rawProvider, \`provider "\${providerName}"\`);

  return {
    accessKeyIdEnv: ensureString(provider.accessKeyIdEnv, \`provider "\${providerName}".accessKeyIdEnv\`),
    accessKeySecretEnv: ensureString(
      provider.accessKeySecretEnv,
      \`provider "\${providerName}".accessKeySecretEnv\`,
    ),
    authMode: ensureString(provider.authMode, \`provider "\${providerName}".authMode\`),
    authorizationV4:
      provider.authorizationV4 === undefined
        ? true
        : ensureBoolean(provider.authorizationV4, \`provider "\${providerName}".authorizationV4\`),
    endpointEnv:
      provider.endpointEnv === undefined
        ? undefined
        : ensureString(provider.endpointEnv, \`provider "\${providerName}".endpointEnv\`),
    endpoint: ensureOptionalString(provider.endpoint, \`provider "\${providerName}".endpoint\`),
    region: ensureOptionalString(provider.region, \`provider "\${providerName}".region\`),
    regionEnv: ensureString(provider.regionEnv, \`provider "\${providerName}".regionEnv\`),
    sessionTokenEnv:
      provider.sessionTokenEnv === undefined
        ? undefined
        : ensureString(provider.sessionTokenEnv, \`provider "\${providerName}".sessionTokenEnv\`),
    type: ensureString(provider.type, \`provider "\${providerName}".type\`),
  };
}

function parseLane(rawLane, laneName) {
  const lane = ensureObject(rawLane, \`lane "\${laneName}"\`);

  return {
    acl: lane.acl === undefined ? undefined : ensureString(lane.acl, \`lane "\${laneName}".acl\`),
    bucket: ensureOptionalString(lane.bucket, \`lane "\${laneName}".bucket\`),
    bucketEnv:
      lane.bucketEnv === undefined
        ? undefined
        : ensureString(lane.bucketEnv, \`lane "\${laneName}".bucketEnv\`),
    cacheControl:
      lane.cacheControl === undefined
        ? undefined
        : ensureString(lane.cacheControl, \`lane "\${laneName}".cacheControl\`),
    excludeFileNames: ensureStringArray(
      lane.excludeFileNames,
      \`lane "\${laneName}".excludeFileNames\`,
    ),
    keyPrefix:
      lane.keyPrefix === undefined
        ? ''
        : ensureStringAllowEmpty(lane.keyPrefix, \`lane "\${laneName}".keyPrefix\`),
    provider: ensureString(lane.provider, \`lane "\${laneName}".provider\`),
    sourceDir: ensureString(lane.sourceDir, \`lane "\${laneName}".sourceDir\`),
  };
}

export async function readResourceStorageConfig(cwd = process.cwd()) {
  const filePath = path.join(cwd, CONFIG_RELATIVE_PATH);
  const rawConfig = JSON.parse(await readFile(filePath, 'utf8'));
  const config = ensureObject(rawConfig, 'resource storage config');
  const providers = ensureObject(config.providers, 'resource storage config.providers');
  const lanes = ensureObject(config.lanes, 'resource storage config.lanes');

  return {
    lanes: Object.fromEntries(
      Object.entries(lanes).map(([laneName, laneConfig]) => [laneName, parseLane(laneConfig, laneName)]),
    ),
    providers: Object.fromEntries(
      Object.entries(providers).map(([providerName, providerConfig]) => [
        providerName,
        parseProvider(providerConfig, providerName),
      ]),
    ),
    version: config.version,
  };
}

function resolveEnvOrValue(value, envName, label) {
  if (value) {
    return value;
  }

  if (envName) {
    return readRequiredEnv(envName);
  }

  throw new Error(\`Missing required \${label}. Provide it in config or via the mapped environment variable.\`);
}

async function persistResolvedResourceConfig(laneName, resolved, cwd = process.cwd()) {
  const configPath = path.join(cwd, CONFIG_RELATIVE_PATH);
  const rawConfig = JSON.parse(await readFile(configPath, 'utf8'));
  const rawProvider = rawConfig.providers?.[resolved.lane.provider];
  const rawLane = rawConfig.lanes?.[laneName];

  if (!rawProvider || !rawLane) {
    return;
  }

  let changed = false;

  if (rawProvider.region !== resolved.region) {
    rawProvider.region = resolved.region;
    changed = true;
  }

  if (resolved.endpoint) {
    if (rawProvider.endpoint !== resolved.endpoint) {
      rawProvider.endpoint = resolved.endpoint;
      changed = true;
    }
  } else if (rawProvider.endpoint !== undefined) {
    delete rawProvider.endpoint;
    changed = true;
  }

  if (rawLane.bucket !== resolved.bucket) {
    rawLane.bucket = resolved.bucket;
    changed = true;
  }

  if (!changed) {
    return;
  }

  await writeFile(configPath, \`\${JSON.stringify(rawConfig, null, 2)}\\n\`, 'utf8');
  console.log(\`[resources] persisted lane "\${laneName}" bucket/region config for future runs.\`);
}

export async function resolveResourceLane(laneName, cwd = process.cwd(), overrides = {}) {
  loadLocalEnvFiles(cwd);

  const config = await readResourceStorageConfig(cwd);
  const lane = config.lanes[laneName];

  if (!lane) {
    throw new Error(\`Unknown resource lane: \${laneName}\`);
  }

  const provider = config.providers[lane.provider];

  if (!provider) {
    throw new Error(\`Unknown resource provider: \${lane.provider}\`);
  }

  if (provider.type !== 'aliyun-oss') {
    throw new Error(\`Unsupported resource provider type: \${provider.type}\`);
  }

  const accessKeyId = readRequiredEnv(provider.accessKeyIdEnv);
  const accessKeySecret = readRequiredEnv(provider.accessKeySecretEnv);
  const region = resolveEnvOrValue(
    overrides.region ?? provider.region,
    provider.regionEnv,
    \`region for provider "\${lane.provider}"\`,
  );
  const endpoint =
    overrides.endpoint ??
    provider.endpoint ??
    (provider.endpointEnv ? process.env[provider.endpointEnv] : undefined);
  let bucket = overrides.bucket ?? lane.bucket ?? (lane.bucketEnv ? process.env[lane.bucketEnv] : undefined);

  if (!bucket) {
    bucket = await buildAutoBucketName(
      cwd,
      laneName,
      accessKeyId,
      overrides.bucketAttempt ?? 0,
    );
  }

  const stsToken = provider.sessionTokenEnv ? process.env[provider.sessionTokenEnv] : undefined;

  if (provider.authMode === 'sts' && !stsToken) {
    throw new Error(
      \`Provider "\${lane.provider}" requires a session token via \${provider.sessionTokenEnv}.\`,
    );
  }

  const clientOptions = {
    accessKeyId,
    accessKeySecret,
    authorizationV4: provider.authorizationV4,
    bucket,
    region,
    secure: true,
    timeout: 60_000,
    ...(endpoint ? { endpoint } : {}),
    ...(stsToken ? { stsToken } : {}),
  };

  return {
    bucket,
    client: new OSS(clientOptions),
    config,
    endpoint,
    lane,
    provider,
    region,
    sourceDir: path.resolve(cwd, lane.sourceDir),
  };
}

export async function planResourceLane(laneName, cwd = process.cwd()) {
  const resolved = await resolveResourceLane(laneName, cwd);
  const sourceStats = await stat(resolved.sourceDir).catch(() => undefined);

  if (!sourceStats || !sourceStats.isDirectory()) {
    throw new Error(\`Resource source directory not found: \${resolved.lane.sourceDir}\`);
  }

  const absolutePaths = await collectFiles(resolved.sourceDir);
  const uploads = absolutePaths
    .map((absolutePath) => {
      const relativePath = path.relative(resolved.sourceDir, absolutePath);
      const fileName = path.basename(relativePath);

      return {
        absolutePath,
        contentType: guessContentType(absolutePath),
        fileName,
        key: joinObjectKey(resolved.lane.keyPrefix, relativePath),
        relativePath: toPosixPath(relativePath),
      };
    })
    .filter((entry) => !resolved.lane.excludeFileNames.includes(entry.fileName));

  return {
    ...resolved,
    uploads,
  };
}

export async function syncResourceLane(laneName, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const dryRun = options.dryRun ?? false;
  let createdBucket = false;

  if (!dryRun) {
    await createResourceBucketLane(laneName, {
      bucket: options.bucket,
      cwd,
      endpoint: options.endpoint,
      persist: options.persist,
      region: options.region,
    });
    createdBucket = true;
  }

  const plan = await resolveResourceLane(laneName, cwd, {
    bucket: options.bucket,
    endpoint: options.endpoint,
    region: options.region,
  }).then(async (resolved) => {
    const sourceStats = await stat(resolved.sourceDir).catch(() => undefined);

    if (!sourceStats || !sourceStats.isDirectory()) {
      throw new Error(\`Resource source directory not found: \${resolved.lane.sourceDir}\`);
    }

    const absolutePaths = await collectFiles(resolved.sourceDir);
    const uploads = absolutePaths
      .map((absolutePath) => {
        const relativePath = path.relative(resolved.sourceDir, absolutePath);
        const fileName = path.basename(relativePath);

        return {
          absolutePath,
          contentType: guessContentType(absolutePath),
          fileName,
          key: joinObjectKey(resolved.lane.keyPrefix, relativePath),
          relativePath: toPosixPath(relativePath),
        };
      })
      .filter((entry) => !resolved.lane.excludeFileNames.includes(entry.fileName));

    return {
      ...resolved,
      uploads,
    };
  });

  if (plan.uploads.length === 0) {
    console.log(\`[resources] lane "\${laneName}" has no uploadable files.\`);

    return {
      bucket: plan.bucket,
      createdBucket,
      dryRun,
      lane: laneName,
      uploadedCount: 0,
    };
  }

  for (const entry of plan.uploads) {
    if (dryRun) {
      console.log(
        \`[resources] plan \${entry.relativePath} -> oss://\${plan.bucket}/\${entry.key}\`,
      );
      continue;
    }

    const headers = {};

    if (plan.lane.cacheControl) {
      headers['Cache-Control'] = plan.lane.cacheControl;
    }

    if (entry.contentType) {
      headers['Content-Type'] = entry.contentType;
    }

    const putOptions = Object.keys(headers).length > 0 ? { headers } : {};

    await plan.client.put(entry.key, entry.absolutePath, putOptions);

    console.log(
      \`[resources] uploaded \${entry.relativePath} -> oss://\${plan.bucket}/\${entry.key}\`,
    );
  }

  return {
    bucket: plan.bucket,
    createdBucket,
    dryRun,
    lane: laneName,
    uploadedCount: plan.uploads.length,
  };
}

export async function createResourceBucketLane(laneName, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const maxAttempts = options.bucket ? 1 : 5;
  let lastError;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const resolved = await resolveResourceLane(laneName, cwd, {
      bucket: options.bucket,
      bucketAttempt: attempt,
      endpoint: options.endpoint,
      region: options.region,
    });
    const acl = resolved.lane.acl ?? 'private';

    try {
      await resolved.client.putBucket(resolved.bucket, { acl });
    } catch (error) {
      const errorCode = error && typeof error === 'object' ? error.code : undefined;

      if (errorCode === 'BucketAlreadyOwnedByYou') {
        if (options.persist !== false) {
          await persistResolvedResourceConfig(laneName, resolved, cwd);
        }

        console.log(
          \`[resources] ensured bucket "\${resolved.bucket}" for lane "\${laneName}" with ACL "\${acl}".\`,
        );

        return {
          acl,
          bucket: resolved.bucket,
          lane: laneName,
        };
      }

      if (!options.bucket && errorCode === 'BucketAlreadyExists') {
        lastError = error;
        continue;
      }

      throw error;
    }

    if (options.persist !== false) {
      await persistResolvedResourceConfig(laneName, resolved, cwd);
    }

    console.log(
      \`[resources] ensured bucket "\${resolved.bucket}" for lane "\${laneName}" with ACL "\${acl}".\`,
    );

    return {
      acl,
      bucket: resolved.bucket,
      lane: laneName,
    };
  }

  throw (
    lastError ??
    new Error(\`Unable to allocate a bucket name for lane "\${laneName}" after multiple attempts.\`)
  );
}
`;
}

export function createResourcesSync(): string {
  return `import { syncResourceLane } from './resource-storage.mjs';

function readFlagValue(flags, flagName) {
  const index = flags.indexOf(flagName);

  if (index === -1) {
    return undefined;
  }

  const value = flags[index + 1];

  if (!value || value.startsWith('--')) {
    throw new Error(\`Expected a value after \${flagName}\`);
  }

  return value;
}

const [laneName, ...flags] = process.argv.slice(2);

if (!laneName) {
  throw new Error(
    'Usage: node ./scripts/resources-sync.mjs <public|private> [--dry-run] [--bucket <name>] [--region <id>] [--endpoint <url>]',
  );
}

const dryRun = flags.includes('--dry-run');
const summary = await syncResourceLane(laneName, {
  bucket: readFlagValue(flags, '--bucket'),
  dryRun,
  endpoint: readFlagValue(flags, '--endpoint'),
  region: readFlagValue(flags, '--region'),
});

console.log(
  \`[resources] \${dryRun ? 'planned' : 'finished'} lane "\${summary.lane}" with \${summary.uploadedCount} file(s).\`,
);
`;
}

export function createResourcesBucket(): string {
  return `import { createResourceBucketLane } from './resource-storage.mjs';

function readFlagValue(flags, flagName) {
  const index = flags.indexOf(flagName);

  if (index === -1) {
    return undefined;
  }

  const value = flags[index + 1];

  if (!value || value.startsWith('--')) {
    throw new Error(\`Expected a value after \${flagName}\`);
  }

  return value;
}

const [laneName, ...flags] = process.argv.slice(2);

if (!laneName) {
  throw new Error(
    'Usage: node ./scripts/resources-bucket.mjs <public|private> [--bucket <name>] [--region <id>] [--endpoint <url>] [--no-persist]',
  );
}

const summary = await createResourceBucketLane(laneName, {
  bucket: readFlagValue(flags, '--bucket'),
  endpoint: readFlagValue(flags, '--endpoint'),
  persist: !flags.includes('--no-persist'),
  region: readFlagValue(flags, '--region'),
});

console.log(
  \`[resources] bucket ready for lane "\${summary.lane}": \${summary.bucket} (acl=\${summary.acl}).\`,
);
`;
}

export function createPreCommitHook(): string {
  return `#!/usr/bin/env sh
set -e

pnpm branch:check
pnpm format:check
pnpm lint
pnpm docs:check
`;
}

export function createPrePushHook(): string {
  return `#!/usr/bin/env sh
set -e

pnpm governance:check
pnpm test:coverage
pnpm verify
`;
}

export function createCommitMsgHook(): string {
  return `#!/usr/bin/env sh
set -e

pnpm exec commitlint --edit "$1"
`;
}
