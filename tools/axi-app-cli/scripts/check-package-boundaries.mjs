import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const packageRoots = [
  path.join(repoRoot, 'apps'),
  path.join(repoRoot, 'packages'),
];

const importPattern = /(?:from\s+['"]|import\s*\(\s*['"])(@axi\/[^'"]+|axi-app-cli)(?:['"]\s*\)?)/g;

async function listPackageJsonFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name, 'package.json'));
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function collectSourceFiles(rootDir) {
  const files = [];
  async function walk(currentDir) {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      if (/\.(ts|tsx|mts|cts)$/i.test(entry.name)) {
        files.push(fullPath);
      }
    }
  }

  await walk(rootDir);
  return files;
}

function classifyPackage(packageName) {
  if (packageName === 'axi-app-cli') {
    return 'app';
  }

  if (packageName === '@axi/scaffold-kit') {
    return 'kit';
  }

  if (packageName === '@axi/scaffold-registry') {
    return 'registry';
  }

  if (packageName === '@axi/scaffold-runtime') {
    return 'runtime';
  }

  if (packageName.startsWith('@axi/scaffold-foundation-')) {
    return 'foundation';
  }

  if (packageName.startsWith('@axi/scaffold-feature-')) {
    return 'feature';
  }

  return 'unknown';
}

function getAllowedWorkspaceDeps(packageName, allWorkspaceNames) {
  const kind = classifyPackage(packageName);
  const foundationAndFeatureNames = allWorkspaceNames.filter((name) => {
    const dependencyKind = classifyPackage(name);
    return dependencyKind === 'foundation' || dependencyKind === 'feature';
  });

  switch (kind) {
    case 'app':
      return new Set(['@axi/scaffold-runtime']);
    case 'kit':
      return new Set();
    case 'foundation':
    case 'feature':
      return new Set(['@axi/scaffold-kit']);
    case 'registry':
      return new Set(['@axi/scaffold-kit', ...foundationAndFeatureNames]);
    case 'runtime':
      return new Set(['@axi/scaffold-kit', '@axi/scaffold-registry']);
    default:
      return new Set();
  }
}

function getWorkspaceDeps(packageJson) {
  const dependencyFields = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ];
  const workspaceDeps = new Set();

  for (const field of dependencyFields) {
    const values = packageJson[field] ?? {};
    for (const [name, version] of Object.entries(values)) {
      if (typeof version === 'string' && version.startsWith('workspace:')) {
        workspaceDeps.add(name);
      }
    }
  }

  return [...workspaceDeps];
}

function getWorkspaceImports(sourceText) {
  const imports = new Set();
  for (const match of sourceText.matchAll(importPattern)) {
    imports.add(match[1]);
  }
  return [...imports];
}

const packageJsonFiles = (
  await Promise.all(packageRoots.map((root) => listPackageJsonFiles(root)))
).flat();

const packageEntries = await Promise.all(
  packageJsonFiles.map(async (packageJsonPath) => {
    const packageJson = await readJson(packageJsonPath);
    return {
      packageJson,
      packageJsonPath,
      rootDir: path.dirname(packageJsonPath),
    };
  }),
);

const workspaceNames = packageEntries.map((entry) => entry.packageJson.name);
const errors = [];

for (const entry of packageEntries) {
  const { packageJson, packageJsonPath, rootDir } = entry;
  const packageName = packageJson.name;
  const allowedDeps = getAllowedWorkspaceDeps(packageName, workspaceNames);
  const declaredWorkspaceDeps = getWorkspaceDeps(packageJson);

  for (const dependency of declaredWorkspaceDeps) {
    if (!allowedDeps.has(dependency)) {
      errors.push(
        `${packageName} declares forbidden workspace dependency ${dependency} in ${path.relative(repoRoot, packageJsonPath)}`,
      );
    }
  }

  const sourceDir = path.join(rootDir, 'src');
  try {
    const sourceFiles = await collectSourceFiles(sourceDir);
    for (const sourceFile of sourceFiles) {
      const sourceText = await readFile(sourceFile, 'utf8');
      const workspaceImports = getWorkspaceImports(sourceText);

      for (const dependency of workspaceImports) {
        if (!workspaceNames.includes(dependency)) {
          continue;
        }

        if (dependency === packageName) {
          continue;
        }

        if (!allowedDeps.has(dependency)) {
          errors.push(
            `${packageName} imports forbidden workspace package ${dependency} in ${path.relative(repoRoot, sourceFile)}`,
          );
        }
      }
    }
  } catch {
    // Ignore packages without src directories.
  }
}

if (errors.length > 0) {
  console.error('[axi] package boundary check failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('[axi] package boundary check passed.');
