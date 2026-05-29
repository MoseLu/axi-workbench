import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const requiredReadmeSections = [
  '## Role',
  '## Allowed Workspace Dependencies',
  '## Owns',
  '## Must Not Do',
];

async function collectWorkspaceEntries(parentDir) {
  const entries = await readdir(parentDir, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => path.join(parentDir, entry.name));
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

function classifyPackage(name) {
  if (name === 'axi-app-cli') {
    return 'app';
  }
  if (name === '@axi/scaffold-kit') {
    return 'kit';
  }
  if (name === '@axi/scaffold-registry') {
    return 'registry';
  }
  if (name === '@axi/scaffold-runtime') {
    return 'runtime';
  }
  if (name.startsWith('@axi/scaffold-foundation-')) {
    return 'foundation';
  }
  if (name.startsWith('@axi/scaffold-feature-')) {
    return 'feature';
  }
  return 'unknown';
}

function expectedWorkspaceDeps(kind) {
  switch (kind) {
    case 'app':
      return ['@axi/scaffold-runtime'];
    case 'kit':
      return [];
    case 'registry':
      return null;
    case 'runtime':
      return ['@axi/scaffold-kit', '@axi/scaffold-registry'];
    case 'foundation':
    case 'feature':
      return ['@axi/scaffold-kit'];
    default:
      return null;
  }
}

function getWorkspaceDeps(packageJson) {
  const fields = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
  const workspaceDeps = new Set();
  for (const field of fields) {
    for (const [name, version] of Object.entries(packageJson[field] ?? {})) {
      if (typeof version === 'string' && version.startsWith('workspace:')) {
        workspaceDeps.add(name);
      }
    }
  }
  return [...workspaceDeps].sort();
}

function assert(condition, message, errors) {
  if (!condition) {
    errors.push(message);
  }
}

const workspaceDirs = [
  ...(await collectWorkspaceEntries(path.join(repoRoot, 'apps'))),
  ...(await collectWorkspaceEntries(path.join(repoRoot, 'packages'))),
];

const errors = [];

for (const workspaceDir of workspaceDirs) {
  const packageJsonPath = path.join(workspaceDir, 'package.json');
  const readmePath = path.join(workspaceDir, 'README.md');
  const relativeDir = path.relative(repoRoot, workspaceDir);
  const packageJson = await readJson(packageJsonPath);
  const packageName = packageJson.name;
  const kind = classifyPackage(packageName);

  assert(kind !== 'unknown', `${relativeDir} has unknown package classification for ${packageName}`, errors);
  assert(typeof packageJson.description === 'string' && packageJson.description.trim().length > 0, `${relativeDir} is missing a non-empty description`, errors);
  assert(packageJson.type === 'module', `${relativeDir} must declare type=module`, errors);
  assert(Array.isArray(packageJson.files) && packageJson.files.includes('dist'), `${relativeDir} must expose dist in files`, errors);

  const scripts = packageJson.scripts ?? {};
  assert(typeof scripts.build === 'string' && scripts.build.length > 0, `${relativeDir} is missing a build script`, errors);
  assert(typeof scripts.typecheck === 'string' && scripts.typecheck.length > 0, `${relativeDir} is missing a typecheck script`, errors);

  if (kind === 'app') {
    assert(typeof scripts.dev === 'string' && scripts.dev.length > 0, `${relativeDir} is missing a dev script`, errors);
  }

  if (kind === 'runtime') {
    assert(typeof scripts.test === 'string' && scripts.test.length > 0, `${relativeDir} is missing a test script`, errors);
  }

  const readme = await readFile(readmePath, 'utf8');
  for (const section of requiredReadmeSections) {
    assert(readme.includes(section), `${relativeDir}/README.md is missing section "${section}"`, errors);
  }

  const expectedDeps = expectedWorkspaceDeps(kind);
  if (expectedDeps !== null) {
    const actualDeps = getWorkspaceDeps(packageJson);
    assert(
      JSON.stringify(actualDeps) === JSON.stringify([...expectedDeps].sort()),
      `${relativeDir} has unexpected workspace dependencies: expected [${expectedDeps.join(', ')}], received [${actualDeps.join(', ')}]`,
      errors,
    );
  }
}

if (errors.length > 0) {
  console.error('[axi] capability package check failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('[axi] capability package check passed.');
