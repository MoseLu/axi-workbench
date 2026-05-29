import type { FeatureRenderContext, FeatureSummary, ScaffoldConfig } from '@axi/scaffold-kit';
import { serializeJson } from '@axi/scaffold-kit';

function renderFeatureList(features: FeatureSummary[]): string {
  if (features.length === 0) {
    return '- none yet';
  }

  return features
    .map((feature) => {
      const dependencies = feature.dependencies?.length
        ? `, deps: ${feature.dependencies.join(', ')}`
        : '';

      return `- \`${feature.id}\`: ${feature.title} [${feature.layer}, v${feature.version}] (${feature.description}${dependencies})`;
    })
    .join('\n');
}

export function createRootPackageJson(config: ScaffoldConfig): string {
  return serializeJson({
    config: {
      commitizen: {
        path: 'cz-git',
      },
    },
    engines: {
      node: '>=22.0.0',
      pnpm: '>=10.0.0',
      python: '>=3.10',
    },
    name: config.packageSlug,
    packageManager: 'pnpm@10.11.0',
    private: true,
    scripts: {
      'branch:check': 'node ./scripts/check-git-branch.mjs',
      'build:web': `pnpm tokens:build && pnpm --filter ${config.webPackageName} build`,
      commit: 'pnpm exec cz',
      'commit:check:last': 'pnpm exec commitlint --last --verbose',
      'commit:lint:range': 'node ./scripts/check-commit-range.mjs',
      'dev:api': 'node ./scripts/run-api-dev.mjs',
      'dev:web': `pnpm tokens:build && pnpm --filter ${config.webPackageName} dev`,
      'docs:check': 'node ./scripts/check-docs.mjs',
      format: 'prettier --write .',
      'format:check': 'prettier --check .',
      'git:bootstrap': 'node ./scripts/setup-git-governance.mjs',
      'governance:check': 'pnpm branch:check && pnpm docs:check',
      'hooks:install': 'node ./scripts/install-hooks.mjs',
      lint: `pnpm --filter ${config.webPackageName} lint`,
      'pr:title:check': 'node ./scripts/check-pr-title.mjs',
      'python:install': 'node ./scripts/setup-python.mjs',
      'quality:check': 'pnpm governance:check && pnpm format:check && pnpm lint && pnpm test:coverage',
      'resources:create:private': 'node ./scripts/resources-bucket.mjs private',
      'resources:create:public': 'node ./scripts/resources-bucket.mjs public',
      'resources:batch-intake': 'node ./scripts/resources-batch-intake.mjs',
      'resources:classify': 'node ./scripts/resources-classify.mjs',
      'resources:delete': 'node ./scripts/resources-delete.mjs',
      'resources:fetch': 'node ./scripts/resources-fetch.mjs',
      'resources:index:private': 'node ./scripts/resources-index.mjs private',
      'resources:index:public': 'node ./scripts/resources-index.mjs public',
      'resources:intake': 'node ./scripts/resources-intake.mjs',
      'resources:gc': 'node ./scripts/resources-gc.mjs',
      'resources:get': 'node ./scripts/resources-get.mjs',
      'resources:plan:private': 'node ./scripts/resources-sync.mjs private --dry-run',
      'resources:plan:public': 'node ./scripts/resources-sync.mjs public --dry-run',
      'resources:put': 'node ./scripts/resources-put.mjs',
      'resources:query': 'node ./scripts/resources-query.mjs',
      'resources:review': 'node ./scripts/resources-review.mjs',
      'resources:sync:private': 'node ./scripts/resources-sync.mjs private',
      'resources:sync:public': 'node ./scripts/resources-sync.mjs public',
      'test:api': 'node ./scripts/run-api-tests.mjs',
      'test:coverage': 'pnpm test:web:coverage && pnpm test:api',
      'test:web': `pnpm --filter ${config.webPackageName} test`,
      'test:web:coverage': `pnpm --filter ${config.webPackageName} coverage`,
      'tokens:build': `pnpm --filter ${config.tokensPackageName} build`,
      verify: 'pnpm build:web && node ./scripts/verify-api.mjs',
    },
    version: '0.1.0',
    devDependencies: {
      '@commitlint/cli': '^19.8.1',
      '@commitlint/config-conventional': '^19.8.1',
      'ali-oss': '^6.23.0',
      commitizen: '^4.3.1',
      'cz-git': '^1.11.0',
      'sql.js': '^1.14.1',
      prettier: '^3.8.1',
    },
  });
}

export function createContributingGuide(): string {
  return `# Contributing

This scaffold uses a PR-driven GitHub Flow profile with:

- \`dev\`: the default integration branch for day-to-day development
- \`main\`: the protected production release branch

## Branch Rules

- Create short-lived branches from \`dev\` for regular work:
  - \`feature/<slug>\`
  - \`fix/<slug>\`
  - \`docs/<slug>\`
  - \`refactor/<slug>\`
  - \`perf/<slug>\`
  - \`test/<slug>\`
  - \`ci/<slug>\`
  - \`build/<slug>\`
  - \`chore/<slug>\`
- Create \`hotfix/<slug>\` from \`main\` only for production incidents.
- Merge feature and fix work into \`dev\` via Pull Request.
- Promote releases by opening a PR from \`dev\` into \`main\`.
- After a hotfix lands in \`main\`, merge or cherry-pick it back into \`dev\`.

## Commit And PR Rules

- Commits must follow Conventional Commits.
- PR titles must follow the same Conventional Commits format.
- Run \`pnpm commit\` for guided commits.
- Run \`pnpm quality:check\` and \`pnpm verify\` before pushing a branch.

## Required Reading

- \`docs/GITHUB_FLOW.md\`
- \`docs/BRANCH_PROTECTION.md\`
- \`docs/COMMIT_CONVENTION.md\`
- \`docs/OPERATIONS.md\`
- \`docs/RELEASE_OPERATIONS.md\`
- \`docs/QUALITY_GATE.md\`
`;
}

export function createCommitlintConfig(): string {
  return `module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'header-max-length': [2, 'always', 72],
    'scope-case': [0],
    'subject-case': [0],
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'],
    ],
  },
};
`;
}

export function createCommitizenConfig(): string {
  return serializeJson({
    alias: {
      fd: 'docs',
      ft: 'feat',
      fx: 'fix',
      rf: 'refactor',
    },
    maxHeaderLength: 72,
    messages: {
      body: 'Provide more context (optional). Use bullet lines when useful.',
      breaking: 'List breaking changes (optional).',
      confirmCommit: 'Confirm commit message?',
      customScope: 'Input a custom scope:',
      footer: 'List issue references or close keywords (optional).',
      scope: 'Select the affected scope:',
      subject: 'Write a short imperative summary:',
      type: 'Select the commit type:',
    },
    scopes: [
      'repo',
      'web',
      'api',
      'tokens',
      'docs',
      'ci',
      'resources',
      'theme',
      'ui',
      'hooks',
      'auth',
    ],
    types: [
      { value: 'feat', name: 'feat: add a new feature' },
      { value: 'fix', name: 'fix: repair a bug' },
      { value: 'docs', name: 'docs: update documentation only' },
      { value: 'style', name: 'style: formatting only' },
      { value: 'refactor', name: 'refactor: restructure without behavior change' },
      { value: 'perf', name: 'perf: improve performance' },
      { value: 'test', name: 'test: add or update tests' },
      { value: 'build', name: 'build: change build tooling or dependencies' },
      { value: 'ci', name: 'ci: change CI or automation' },
      { value: 'chore', name: 'chore: repository maintenance' },
      { value: 'revert', name: 'revert: revert a previous change' },
    ],
  });
}

export function createResourcesReadme(): string {
  return `# Resources

Project assets are split into two lanes:

- \`resources/public\`: assets that are safe for broader product delivery decisions
- \`resources/private\`: assets that must not be published to public storage

## Rules

- Put brand marks, marketing-safe icons, and web-public files in \`resources/public\`.
- Put licensed, environment-specific, partner-restricted, or internal-only assets in \`resources/private\`.
- Treat \`resources/public/web\` as the source for Vite static assets.
- Treat both OSS lanes as private by default unless a later delivery review changes that policy.
- Treat \`resources/private\` as local or private-OSS material only.
- Do not move private assets into the public lane without an explicit review.
`;
}

export function createPublicResourcesReadme(): string {
  return `# Public Resources

Assets in this directory are considered safe for broader delivery, but not automatically public-read in OSS.

Typical targets:

- app static assets
- public brand marks
- future OSS-backed shared assets with explicit review

Current structure:

- \`web/\`: web-facing static assets served by the frontend
- \`web/brand/\`: public logo and brand marks
`;
}

export function createPrivateResourcesReadme(): string {
  return `# Private Resources

Assets in this directory are not intended for public upload.

Use this lane for:

- paid or licensed source assets
- partner-restricted files
- internal-only visuals
- files that must live in a private OSS bucket or remain local

This directory is intentionally ignored by git except for this guide.
`;
}

export function createGeneratedReadme(context: FeatureRenderContext): string {
  const extensionFeatures = context.selectedFeatureSummaries.filter(
    (feature) => feature.layer === 'extension',
  );
  const experimentalFeatures = context.selectedFeatureSummaries.filter(
    (feature) => feature.layer === 'experimental',
  );

  return `# ${context.projectName}

${context.projectName} is the default Axi scaffold. It starts as a feature-based full-stack monorepo with:

- \`apps/web\`: Vite + React + TypeScript + Zod
- \`apps/api\`: Flask + pytest + 80% coverage gate
- \`packages/tokens\`: modular token sources plus directly usable SCSS and CSS outputs
- \`config/axi-dashboard-app.json\`: DevSvc Dashboard registration for hosted tool access
- dual core theme modes: \`light\` and \`dark\`
- preset-ready visual styles such as \`minimal\`, \`cyberpunk\`, and \`glassmorphism\`
- cartesian composition between mode and preset dimensions
- \`docs\`: PRD/TDD templates, architecture notes, and quality-gate rules
- \`.githooks\`: pre-commit and pre-push checks
- \`.axi/modules.json\`: editable layered module configuration
- \`.axi/scaffold.manifest.json\`: layered module manifest for gradual updates

## Recommended Workflow

1. Write or update the PRD in \`docs/PRD_TEMPLATE.md\`.
2. Create a short-lived branch from \`dev\`.
3. Write the failing tests described in \`docs/TDD_TEMPLATE.md\`.
4. Implement inside the relevant feature slice.
5. Review installed and available modules in \`docs/MODULES.md\`.
6. Register hosted tool routes through \`docs/AXI_DASHBOARD_HOSTING.md\` when the app should appear in DevSvc Dashboard.
7. Run \`pnpm quality:check\` and \`pnpm verify\` before opening a PR into \`dev\`.
8. Use \`docs/RELEASE_OPERATIONS.md\` when promoting \`dev\` into \`main\` or handling a hotfix.

## Dashboard Hosting

New Axi tools should enter the workspace through DevSvc Dashboard by default. The generated web app already supports subpath hosting through \`AXI_APP_BASE\` and \`VITE_AXI_APP_BASE\`, and \`config/axi-dashboard-app.json\` is shaped for the Dashboard registry at:

\`\`\`text
/Volumes/code/workspace/projects/axi-workbench/apps/devsvc-dashboard/config/axi-apps.json
\`\`\`

The generated registry entry assumes the project lives at \`\${workspaceRoot}/projects/${context.packageSlug}\`. If this project is generated outside that workspace location, update only the \`cwd\` value before registering it.

Use Tauri as an optional desktop shell when a tool needs local OS capabilities or packaging. Use Swift, SwiftUI, or AppKit only for deeply native macOS surfaces such as menu-bar residents, global hotkeys, Accessibility, native panels, or system-level bridges.

## Commands

\`\`\`bash
pnpm install
pnpm git:bootstrap
pnpm python:install
pnpm tokens:build
pnpm commit
pnpm dev:web
pnpm dev:api
pnpm resources:create:public
pnpm resources:create:private
pnpm resources:batch-intake -- --file C:/path/to/logo.svg --file C:/path/to/icon.svg --path brand/logo.svg --path icons/icon.svg --dry-run
pnpm resources:classify -- --file C:/path/to/file.svg --path brand/logo.svg
pnpm resources:intake -- --file C:/path/to/file.svg --path brand/logo.svg
pnpm resources:put -- public --file C:/path/to/file.svg --category brand --tag upload
pnpm resources:get -- public --sha256 <hash> --output ./tmp/file.bin
pnpm resources:delete -- public --sha256 <hash>
pnpm resources:gc -- --lane public
pnpm resources:fetch -- public --sha256 <hash> --output ./tmp/asset.bin
pnpm resources:index:public
pnpm resources:query -- --lane public --tag logo --tag branding --tag-mode all
pnpm resources:review -- --lane private
pnpm resources:plan:public
pnpm resources:sync:public
pnpm quality:check
pnpm verify
axi add <feature-id> --cwd .
axi sync --cwd .
axi list --cwd .
axi doctor --cwd .
axi list --json --cwd .
axi doctor --json --cwd .
axi doctor --fix --cwd .
\`\`\`

## Token Consumption

\`\`\`scss
@use 'tokens' as tokens;
@use 'foundation/space' as space;
\`\`\`

To extend the scaffold later, run \`axi add <feature-id> --cwd .\` or edit \`.axi/modules.json\` and run \`axi sync --cwd .\`.
This scaffold uses a PR-centric GitHub Flow profile: \`dev\` is the integration branch, \`main\` is the production release branch, and short-lived branches merge back through Pull Requests.
Use \`pnpm git:bootstrap\` after cloning or after \`git init\` so the local repository moves onto \`dev\` when needed.
Use \`pnpm commit\` for guided Conventional Commits, and keep PR titles in the same format.
Use \`docs/OPERATIONS.md\` as the top-level operations index before touching release, hotfix, module sync, or resource workflows.
Use \`docs/BRANCH_PROTECTION.md\` to configure GitHub branch protections, required checks, and merge permissions for \`dev\` and \`main\`.
Use \`docs/RELEASE_OPERATIONS.md\` as the fixed runbook for release PRs from \`dev\` into \`main\` and for production hotfix backports.
Use \`axi list --cwd .\` to inspect layer status, \`axi list --json --cwd .\` for automation, and \`axi doctor --cwd .\` or \`axi doctor --fix --cwd .\` to validate and repair drift.
Use \`config/resource-storage.config.json\` plus \`.env.resources.local\` to configure Alibaba Cloud OSS-backed asset synchronization without hardcoding secrets. Both generated lanes stay private by default, and \`resources:sync:*\` ensures buckets exist before upload.
The first bucket creation can auto-generate a shared private bucket per lane from the account context, then persist the resolved bucket and region into \`config/resource-storage.config.json\` so later runs and later projects can reuse the same non-secret values.
Resource objects are stored under hashed OSS keys inside project namespaces such as \`projects/${context.packageSlug}/objects/<lane>/sha256/...\`, while remote index manifests live under \`projects/${context.packageSlug}/index/<lane>/catalog.latest.json\` and the local SQLite catalog at \`.axi/resource-index.sqlite\` tracks category, tags, file name, extension, MIME, size, hash, and sync status for later lookup.
You can also ingest arbitrary local files through \`resources:put\` without first moving them into \`resources/public/web\` or \`resources/private\`, then retrieve them later with \`resources:get\`.
For agent-driven intake, prefer \`resources:classify\` and \`resources:intake\` so lane, category, and tags come from the resource policy instead of ad hoc guesses.
Use \`resources:review\` to find assets that still require human confirmation, and \`resources:batch-intake\` when an agent needs to submit several files in one pass.

## Structure

- \`apps/web/src/app\`: application shell and entrypoints
- \`apps/web/src/features/*\`: feature-local components, hooks, schemas, and tests
- \`apps/web/src/shared/hooks\`: reusable cross-feature hooks
- \`apps/api/src/${context.pythonModuleName}/features/*\`: feature-based Flask blueprints and services
- \`config/axi-dashboard-app.json\`: DevSvc Dashboard hosted app registration object
- \`config/resource-classification.config.json\`: category and tag rules for local resource indexing
- \`config/resource-storage.config.json\`: provider, shared bucket, and project namespace mapping for Alibaba Cloud OSS-backed asset sync
- \`.axi/resource-index.sqlite\`: local asset catalog for category and hash-based lookup
- \`skills/resource-intake\`, \`skills/resource-review\`, \`skills/resource-rehydrate\`: project-local agent skills for resource workflows
- \`resources/public/web\`: project-level delivery-safe web assets, ready for local serving and private OSS sync
- \`resources/private\`: non-public assets that stay out of public distribution
- \`packages/tokens/tokens\`: token source files
- \`packages/tokens/dist/scss\`: generated SCSS token tree ready for \`@use\`
- \`apps/web/src/shared/theme\`: runtime theme mode and preset registry

## Enabled Extension Modules

${renderFeatureList(extensionFeatures)}

## Enabled Experimental Modules

${renderFeatureList(experimentalFeatures)}

Read \`AGENTS.md\` before extending the scaffold.
`;
}

export function createGeneratedAgents(context: FeatureRenderContext): string {
  return `# Project Agent Rules

## Delivery Model

- Every change starts from a PRD update or a new PRD note.
- Every implementation starts with a failing test or a missing-test gap made explicit.
- Keep the scaffold feature-based across frontend and API modules.
- Shared hooks live in \`apps/web/src/shared/hooks\`.
- Feature-specific hooks stay inside the owning feature slice.
- Treat \`dev\` as the integration branch and \`main\` as the production release branch.
- Create short-lived working branches from \`dev\` unless a production hotfix must start from \`main\`.
- Use Conventional Commits for both commit messages and PR titles.

## Tool Platform Defaults

- Treat \`apps/web\` as a DevSvc Dashboard-hosted Axi tool unless the PRD says otherwise.
- Keep Dashboard-visible routes, menu groups, and capabilities aligned between \`apps/web/src/app/axi.app.ts\` and \`config/axi-dashboard-app.json\`.
- Use Tauri as the optional desktop shell when the tool needs packaging, local filesystem/process/network access, tray behavior, or a native window around the web UI.
- Use Swift, SwiftUI, or AppKit only for deeply native macOS surfaces such as menu-bar residents, global hotkeys, Accessibility, native panels, or system-level bridges.
- Keep Rust behind Tauri commands, local services, or performance-sensitive core modules rather than making Rust the default UI layer.

## Mandatory Gates

- Frontend and API coverage must each keep the shared 80% floor.
- \`pnpm quality:check\` must pass before a commit is considered ready.
- \`pnpm verify\` must pass before a push is considered ready.
- \`pnpm branch:check\` must pass before a branch is pushed or opened as a PR.
- Do not weaken Git hooks or coverage thresholds without updating \`docs/QUALITY_GATE.md\`.
- Treat \`.axi/modules.json\` as the editable module policy and \`.axi/scaffold.manifest.json\` as the applied snapshot.
- Treat \`docs/AXI_DASHBOARD_HOSTING.md\` as the route and host contract for workspace-visible tools.
- For OSS-backed asset work, prefer the project-local skills in \`skills/resource-*\` over ad hoc direct uploads.
- Run \`pnpm resources:classify -- --file <path>\` before storing an ambiguous asset.
- Default to the private lane when intake is ambiguous; promote to public only after review.
- Use \`pnpm resources:review\` to clear assets still flagged for review in the local catalog.

## Feature-Based Conventions

- Add new UI features under \`apps/web/src/features/<feature-name>\`.
- Add new API capabilities under \`apps/api/src/${context.pythonModuleName}/features/<feature-name>\`.
- Keep validation close to the feature with Zod on the frontend and explicit serializers on the backend.
- Move reusable concerns to \`shared\` only when at least two features need them.
- Add non-foundation scaffold modules through the CLI rather than editing scaffold metadata by hand.
- Use \`pnpm resources:intake\` for agent-driven arbitrary file imports so classification stays policy-driven and reproducible.
- Use \`pnpm resources:batch-intake\` for multi-file imports instead of ad hoc loops.
- Merge feature work into \`dev\` via Pull Request, then promote tested release candidates from \`dev\` into \`main\`.
`;
}

export function createGeneratedTodo(): string {
  return `# TODO

- [ ] Replace the sample home feature with the first product feature.
- [ ] Expand the health feature into real domain modules.
- [ ] Decide the first CI target beyond the baseline GitHub Actions workflow.
`;
}

export function createGeneratedMilestone(): string {
  return `# MILESTONE

## Foundation

- [x] scaffold monorepo workspace
- [x] add frontend and API starter tests
- [x] enforce coverage, hooks, and docs gates
- [ ] refine domain modules from the first PRD
`;
}

export function createGeneratedChangelog(): string {
  return `# CHANGELOG

## 0.1.0

- initialize the default Axi full-stack scaffold
- add feature-based React and Flask starter modules
- add Git hooks, PRD/TDD docs, and quality gates
`;
}
