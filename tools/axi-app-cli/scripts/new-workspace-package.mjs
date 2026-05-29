import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRepoRoot = path.resolve(__dirname, '..');

const supportedKinds = new Set(['app', 'contract', 'registry', 'runtime', 'foundation', 'feature']);

function parseArgs(argv) {
  const options = {
    force: false,
    kind: '',
    name: '',
    repoRoot: defaultRepoRoot,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    switch (current) {
      case '--kind':
        options.kind = argv[index + 1] ?? '';
        index += 1;
        break;
      case '--name':
        options.name = argv[index + 1] ?? '';
        index += 1;
        break;
      case '--repo-root':
        options.repoRoot = path.resolve(argv[index + 1] ?? defaultRepoRoot);
        index += 1;
        break;
      case '--force':
        options.force = true;
        break;
      default:
        throw new Error(`Unknown argument: ${current}`);
    }
  }

  if (!supportedKinds.has(options.kind)) {
    throw new Error(`--kind must be one of: ${[...supportedKinds].join(', ')}`);
  }

  if (!/^[a-z0-9-]+$/.test(options.name)) {
    throw new Error('--name must be a kebab-case slug');
  }

  return options;
}

function toTitleCase(value) {
  return value
    .split('-')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function resolvePackageMeta(kind, slug) {
  if (kind === 'app') {
    return {
      allowedDeps: ['@axi/scaffold-runtime'],
      description: `${toTitleCase(slug)} app entrypoint for the Axi workspace.`,
      directory: path.join('apps', slug),
      packageName: slug.startsWith('axi-') ? slug : `axi-${slug}`,
      readmeRole: 'Publishable app shell or local entrypoint for the scaffold workspace.',
      scripts: {
        build: 'tsup',
        dev: 'tsx src/cli.ts',
        typecheck: 'tsc --noEmit',
      },
      sourceFiles: {
        'src/cli.ts': `console.error('[axi] Replace ${slug} with a real app entrypoint.');\nprocess.exitCode = 1;\n`,
        'tsup.config.ts': `import { defineConfig } from 'tsup';\n\nexport default defineConfig({\n  clean: true,\n  dts: false,\n  entry: ['src/cli.ts'],\n  format: ['esm'],\n  sourcemap: true,\n  splitting: false,\n  target: 'node22',\n});\n`,
      },
      tsconfigInclude: ['src/**/*.ts', 'tsup.config.ts'],
    };
  }

  const prefix =
    kind === 'foundation'
      ? `foundation-${slug}`
      : kind === 'feature'
        ? `feature-${slug}`
        : `scaffold-${slug}`;

  const packageName = `@axi/${prefix}`;
  const isCapability = kind === 'foundation' || kind === 'feature';
  const allowedDeps =
    kind === 'contract'
      ? []
      : kind === 'registry'
        ? ['@axi/scaffold-kit']
        : kind === 'runtime'
          ? ['@axi/scaffold-kit', '@axi/scaffold-registry']
          : ['@axi/scaffold-kit'];

  const role =
    kind === 'contract'
      ? 'Shared contracts and helpers for other workspace packages.'
      : kind === 'registry'
        ? 'Assembly layer for capability packages and preset policy.'
        : kind === 'runtime'
          ? 'Execution layer for commands, orchestration, and file application.'
          : isCapability
            ? `${toTitleCase(slug)} ${kind} package for scaffold capability delivery.`
            : `${toTitleCase(slug)} workspace package.`;

  const owns =
    kind === 'contract'
      ? ['shared types', 'small helpers', 'cross-package contracts']
      : kind === 'registry'
        ? ['assembly logic', 'preset policy wiring', 'dependency expansion']
        : kind === 'runtime'
          ? ['command execution', 'render orchestration', 'sync or doctor flows']
          : ['package-local manifests', 'package-local templates', 'package-local exports'];

  const mustNotDo =
    kind === 'contract'
      ? ['depend on other workspace packages', 'own runtime execution', 'own feature policy']
      : kind === 'registry'
        ? ['prompt users directly', 'write files directly', 'become the CLI shell']
        : kind === 'runtime'
          ? ['import capability packages directly', 'own registry policy', 'become a feature package']
          : ['depend on sibling capability packages', 'own orchestration behavior', 'bypass shared contracts'];

  return {
    allowedDeps,
    description: `${toTitleCase(slug)} ${kind} package for the Axi scaffold workspace.`,
    directory: path.join('packages', prefix.replace('@axi/', '')),
    owns,
    packageName,
    readmeRole: role,
    scripts:
      kind === 'runtime'
        ? {
            build: 'tsup src/index.ts --format esm --target node22 --clean',
            test: 'vitest run',
            'test:watch': 'vitest',
            typecheck: 'tsc --noEmit',
          }
        : {
            build: 'tsup src/index.ts --format esm --target node22 --clean',
            typecheck: 'tsc --noEmit',
          },
    sourceFiles: {
      'src/index.ts': `export {};\n`,
    },
    tsconfigInclude: ['src/**/*.ts'],
    mustNotDo,
  };
}

function createPackageJson(meta) {
  const packageJson = {
    name: meta.packageName,
    version: '1.0.0',
    description: meta.description,
    private: true,
    type: 'module',
    files: ['dist'],
    exports: {
      '.': './dist/index.js',
    },
    ...(meta.allowedDeps.length > 0
      ? {
          dependencies: Object.fromEntries(meta.allowedDeps.map((dependency) => [dependency, 'workspace:*'])),
        }
      : {}),
    scripts: meta.scripts,
  };

  return `${JSON.stringify(packageJson, null, 2)}\n`;
}

function createTsconfig(meta) {
  return `${JSON.stringify(
    {
      extends: '../../tsconfig.base.json',
      include: meta.tsconfigInclude,
    },
    null,
    2,
  )}\n`;
}

function createReadme(meta) {
  const owns = Array.isArray(meta.owns) ? meta.owns : ['package-local exports'];
  const mustNotDo = Array.isArray(meta.mustNotDo)
    ? meta.mustNotDo
    : ['bypass workspace standards'];

  return `# ${meta.packageName}

## Role

${meta.readmeRole}

## Allowed Workspace Dependencies

${meta.allowedDeps.length > 0 ? meta.allowedDeps.map((dependency) => `- \`${dependency}\``).join('\n') : '- none'}

## Owns

${owns.map((entry) => `- ${entry}`).join('\n')}

## Must Not Do

${mustNotDo.map((entry) => `- ${entry}`).join('\n')}
`;
}

async function ensureWritableFile(filePath, content, force) {
  try {
    if (!force) {
      await readFile(filePath, 'utf8');
      throw new Error(`Refusing to overwrite existing file: ${filePath}`);
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      if (String(error.message).startsWith('Refusing to overwrite')) {
        throw error;
      }
    }
  }

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const meta = resolvePackageMeta(options.kind, options.name);
  const targetRoot = path.join(options.repoRoot, meta.directory);

  await ensureWritableFile(path.join(targetRoot, 'package.json'), createPackageJson(meta), options.force);
  await ensureWritableFile(path.join(targetRoot, 'README.md'), createReadme(meta), options.force);
  await ensureWritableFile(path.join(targetRoot, 'tsconfig.json'), createTsconfig(meta), options.force);

  for (const [relativePath, content] of Object.entries(meta.sourceFiles)) {
    await ensureWritableFile(path.join(targetRoot, relativePath), content, options.force);
  }

  console.log(`[axi] created ${options.kind} package scaffold at ${targetRoot}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`[axi] ${message}`);
  process.exit(1);
});
