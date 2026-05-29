import type { FeatureRenderContext, FeatureSummary, ScaffoldConfig } from '@axi/scaffold-kit';

function renderFeatureCatalog(features: FeatureSummary[], emptyState = '- none'): string {
  if (features.length === 0) {
    return emptyState;
  }

  return features
    .map((feature) => {
      const dependencies = feature.dependencies?.length
        ? `; deps: ${feature.dependencies.join(', ')}`
        : '';

      return `- \`${feature.id}\` [${feature.layer}, v${feature.version}, default=${feature.enabledByDefault ? 'on' : 'off'}]: ${feature.title} - ${feature.description}; config: \`${feature.configKey}\`${dependencies}`;
    })
    .join('\n');
}

export function createArchitectureDoc(context: FeatureRenderContext): string {
  const installableModuleIds =
    context.installableFeatureIds.length > 0 ? context.installableFeatureIds.join(', ') : 'none';

  return `# Architecture

## Frontend

- \`app\` owns the shell, routing entrypoints, and global styles.
- \`features\` owns product slices. Each feature may contain components, hooks, schemas, and tests.
- \`shared/hooks\` owns hooks reused by more than one feature.

## Dashboard Host

- DevSvc Dashboard is the default workspace access shell for generated Axi tools.
- \`config/axi-dashboard-app.json\` is shaped for the Dashboard hosted app registry.
- \`apps/web/src/app/axi.app.ts\` is the in-app source for hosted routes, menu groups, and capabilities.
- Vite reads \`AXI_APP_BASE\` or \`VITE_AXI_APP_BASE\` so the app can run under \`/apps/${context.packageSlug}/*\`.
- Tauri is optional for desktop packaging and local OS access; Swift/AppKit stays reserved for deeply native macOS surfaces.

## API

- \`app.py\` assembles the Flask application.
- \`features/*\` owns blueprints and services by domain.
- Feature registration is dynamic, so new API feature packages can be added without rewriting the app factory.
- Feature tests live near the feature in \`apps/api/tests\` and must keep the 80% gate.

## Tokens

- Token source lives in \`packages/tokens/tokens\`.
- Built SCSS entrypoints live in \`packages/tokens/dist/scss\`.
- Foundation tokens define shared typography, spacing, borders, radius, shadows, layout, and interaction states.
- Foundation tokens also carry enterprise semantic color scales, semantic spacing aliases, breakpoints, and z-index layers.
- Theme mode tokens define the light and dark semantic overrides.
- Theme preset tokens define optional style families such as minimal, cyberpunk, and glassmorphism.
- Theme mode and theme preset compose orthogonally, so every mode should work with every preset.
- Generated CSS variables power runtime styles.
- Generated SCSS variables stay available for future design-system layers.

## Resources

- \`resources/public\` stores assets that are safe for broader delivery decisions.
- \`resources/public/web\` is the source for frontend static assets served by Vite.
- \`resources/private\` stores non-public assets that should stay local or use private OSS.
- \`config/resource-classification.config.json\` defines category and tag rules used by the local asset catalog.
- \`config/resource-storage.config.json\` maps asset lanes to shared Alibaba Cloud OSS buckets plus per-project namespace prefixes.
- Resource objects use hash-based keys in OSS under per-project prefixes, while the local resource catalog tracks category and source metadata.
- Remote index manifests live under the same project namespace so shared buckets can separate projects without per-project bucket sprawl.
- \`.axi/resource-index.sqlite\` stores the local resource index used for lookup, classification, and sync status.
- \`skills/resource-*\` provides project-local agent workflows for intake, review, and rehydration.
- Both generated OSS lanes stay private by default.
- Public and private assets must not be mixed in the same lane.

## Hooks Preset

- Git hooks run format, docs, lint, coverage, and smoke verification checks.
- Code hooks follow the ownership rule: shared hooks in \`shared/hooks\`, feature hooks inside their owning feature.
- Flask feature hooks stay local to their feature package unless two or more modules reuse the same behavior.

## Scaffold Modules

- \`.axi/modules.json\` stores the editable layered module configuration emitted by the scaffold CLI.
- \`.axi/scaffold.manifest.json\` stores the last applied module snapshot after generation or update.
- Foundation modules provide the baseline platform, routing shell, tokens, tooling, and starter API slices.
- Extension modules are independently pluggable and can be appended later with \`axi add <feature-id>\`.
- Experimental modules are isolated behind separate flags and should stay off by default until validated.
- Current installable modules: ${installableModuleIds}
`;
}

export function createDashboardHostingDoc(context: FeatureRenderContext): string {
  return `# Axi Dashboard Hosting

## Default Contract

This scaffold is generated as a Dashboard-hosted Axi tool first.

- Primary UI: \`apps/web\` with Vite, React, TypeScript, Zod, Axi tokens, and the shared Axi shell.
- Unified host: DevSvc Dashboard opens the app under \`/apps/${context.packageSlug}/*\`.
- Desktop shell: Tauri is optional when this tool needs a packaged macOS window, tray, filesystem, process, or local-network bridge.
- Native macOS code: Swift, SwiftUI, and AppKit are reserved for resident menu-bar apps, global hotkeys, Accessibility, native panels, or deep system integration.
- Rust: keep it behind Tauri commands, local services, or performance-sensitive core modules instead of using Rust as the default UI layer.

## Generated Files

- \`apps/web/src/app/axi.app.ts\`: in-app metadata for hosted mode, routes, menu groups, and capabilities.
- \`config/axi-dashboard-app.json\`: Dashboard registry entry shaped for \`devsvc-dashboard/config/axi-apps.json\`.
- \`apps/web/vite.config.ts\`: reads \`AXI_APP_BASE\` or \`VITE_AXI_APP_BASE\` so subpath hosting works.

## Dashboard Registration

Register this app by adding the generated \`config/axi-dashboard-app.json\` object to the Dashboard app registry:

\`\`\`text
/Volumes/code/workspace/projects/axi-workbench/apps/devsvc-dashboard/config/axi-apps.json
\`\`\`

The generated \`cwd\` assumes the project lives at:

\`\`\`text
\${workspaceRoot}/projects/${context.packageSlug}
\`\`\`

If the project is generated somewhere else, update only \`cwd\`; keep \`startCommand\` using \`\${port}\` so the Dashboard can allocate a free loopback port at runtime.

## Host Runtime

DevSvc Dashboard starts the app process, allocates the real port, and injects:

- \`AXI_APP_BASE\`
- \`AXI_APP_ID\`
- \`AXI_APP_PORT\`
- \`AXI_HOST_ROUTE\`
- \`AXI_HOSTED_APP\`
- \`VITE_AXI_APP_BASE\`
- \`VITE_AXI_HOSTED_APP\`

The app must not hardcode a public dev port for hosted mode. Local standalone development can still run:

\`\`\`bash
pnpm dev:web
\`\`\`

## Menu Model

Keep Dashboard navigation in \`menuGroups\`. Add new tool screens by updating both:

- \`apps/web/src/app/axi.app.ts\`
- \`config/axi-dashboard-app.json\`

The app's internal UI may keep a richer local sidebar, but Dashboard-visible routes should stay stable and small.
`;
}

export function createPrdTemplate(): string {
  return `# PRD Template

## Problem

What user or business issue is changing?

## Audience

Who is affected and who approves the outcome?

## Requirements

- Functional requirement
- Quality requirement
- Constraints and dependencies

## Non-Goals

What is explicitly out of scope for this change?

## Acceptance

- Observable acceptance criterion
- Testable acceptance criterion
- Rollout or migration note
`;
}

export function createTddTemplate(): string {
  return `# TDD Template

## Red

- Which failing test proves the missing behavior?
- Which command reproduces the failure?

## Green

- What is the minimal implementation that makes the test pass?
- Which feature slice owns the change?

## Refactor

- Which abstractions can now be simplified or shared?
- Which docs and follow-up tests need to be updated?

## Verification

- \`pnpm quality:check\`
- \`pnpm verify\`
`;
}

export function createGitHubFlowDoc(): string {
  return `# GitHub Flow

## Branch Model

This scaffold uses a Pull Request-centric GitHub Flow profile with two long-lived branches:

- \`dev\`: default integration branch for day-to-day delivery
- \`main\`: protected production release branch

## Allowed Short-Lived Branches

- \`feature/<slug>\`
- \`fix/<slug>\`
- \`hotfix/<slug>\`
- \`docs/<slug>\`
- \`refactor/<slug>\`
- \`perf/<slug>\`
- \`test/<slug>\`
- \`ci/<slug>\`
- \`build/<slug>\`
- \`chore/<slug>\`

## Standard Delivery Flow

1. Sync from \`dev\`.
2. Create a short-lived branch.
3. Update PRD and tests before implementation.
4. Run \`pnpm quality:check\` and \`pnpm verify\`.
5. Open a Pull Request into \`dev\`.
6. Merge after review and green CI.
7. Promote release-ready changes from \`dev\` into \`main\`.

## Production Hotfix Flow

1. Branch from \`main\` with \`hotfix/<slug>\`.
2. Keep the scope to the production issue only.
3. Open a fast-track Pull Request into \`main\`.
4. Merge or cherry-pick the same fix back into \`dev\`.

## Local Bootstrap

- Run \`pnpm git:bootstrap\` after cloning or after \`git init\`.
- The generated bootstrap keeps \`.githooks\` active and creates \`dev\` when needed.
- Do not develop directly on \`main\`.
`;
}

export function createCommitConventionDoc(): string {
  return `# Commit Convention

## Format

\`\`\`
<type>[optional scope]: <subject>
\`\`\`

## Allowed Types

- \`feat\`
- \`fix\`
- \`docs\`
- \`style\`
- \`refactor\`
- \`perf\`
- \`test\`
- \`build\`
- \`ci\`
- \`chore\`
- \`revert\`

## Rules

- Use imperative mood.
- Keep the header within 72 characters.
- Use scope when the affected area is clear, for example \`web\`, \`api\`, \`tokens\`, or \`resources\`.
- Use the same format for Pull Request titles.
- Keep commits atomic and reviewable.

## Examples

- \`feat(web): add resource review panel\`
- \`fix(api): handle empty tag filter\`
- \`docs(repo): document github flow policy\`

## Tooling

- \`commit-msg\` runs \`commitlint\`.
- \`pnpm commit\` starts the interactive \`cz-git\` flow.
- \`pnpm commit:check:last\` validates the most recent commit.
- \`pnpm commit:lint:range -- --from <sha> --to <sha>\` validates a commit range.
`;
}

export function createBranchProtectionDoc(): string {
  return `# Branch Protection

## Purpose

This scaffold expects GitHub branch protection to enforce the same governance rules already present in local hooks and CI.

## Protected Branches

### dev

- protect \`dev\`
- require pull requests before merging
- require at least 1 approval
- dismiss stale approvals when new commits are pushed
- require conversation resolution before merging
- require status checks:
  - \`governance\`
  - \`quality\`
- block force pushes
- block branch deletion
- restrict direct pushes to maintainers only, or disable direct pushes entirely

### main

- protect \`main\`
- require pull requests before merging
- require at least 1 approval, or 2 for higher-risk teams
- require conversation resolution before merging
- require status checks:
  - \`governance\`
  - \`quality\`
- require branch to be up to date before merging
- block force pushes
- block branch deletion
- restrict pushes to release owners only

## Merge Policy

- normal feature and fix PRs merge into \`dev\`
- release PRs merge from \`dev\` into \`main\`
- production hotfix PRs merge from \`hotfix/<slug>\` into \`main\`
- every hotfix merged into \`main\` must be merged or cherry-picked back into \`dev\`

## Recommended GitHub Settings

- enable auto-delete head branches after merge
- enable automatically deleting merged short-lived branches
- prefer squash merge or rebase merge for short-lived work
- keep merge strategy consistent across the repository
- require signed commits only if the team already uses them consistently

## Audit Checklist

- \`dev\` is the default branch in GitHub
- \`main\` is protected as production-only
- required checks match the workflow names in \`.github/workflows/ci.yml\`
- direct pushes to \`main\` are blocked
- release owners are documented and current
`;
}

export function createReleaseOperationsDoc(): string {
  return `# Release Operations

## Standard Release

Use this path when promoting tested integration work into production.

1. Ensure \`dev\` is green:
   - \`pnpm quality:check\`
   - \`pnpm verify\`
2. Confirm release scope:
   - PRD and TDD updates are complete
   - CHANGELOG and milestone notes are current
3. Open a Pull Request from \`dev\` into \`main\`.
4. Require review plus green \`governance\` and \`quality\` checks.
5. Merge into \`main\`.
6. Create the production tag, for example \`v1.2.0\`, if your release process uses tags.
7. Run production smoke verification after deployment.

## Release Checklist

- [ ] release PR source is \`dev\`
- [ ] release PR target is \`main\`
- [ ] CI is green
- [ ] CHANGELOG updated
- [ ] rollout and rollback notes confirmed
- [ ] production smoke verification completed

## Production Hotfix

Use this path only for urgent production issues.

1. Branch from \`main\` with \`hotfix/<slug>\`.
2. Keep the diff minimal and incident-focused.
3. Run:
   - \`pnpm quality:check\`
   - \`pnpm verify\`
4. Open a Pull Request into \`main\`.
5. Merge after review and deploy.
6. Merge or cherry-pick the same fix back into \`dev\`.
7. Confirm both branches contain the fix before closing the incident.

## Rollback Rule

- if the release fails post-merge, prefer a targeted revert PR or a documented rollback deployment
- do not push directly to \`main\`
- keep rollback notes in the release record or incident log

## Ownership

- release owners control promotion from \`dev\` into \`main\`
- hotfix owners must coordinate the backport into \`dev\`
- update this runbook if the release workflow changes
`;
}

export function createOperationsDoc(): string {
  return `# Operations

## Purpose

This document is the entrypoint for repository operations. Use it as the index before touching release, hotfix, module, resource, or quality workflows.

## Core Runbooks

- \`docs/GITHUB_FLOW.md\`: branch model and day-to-day Pull Request workflow
- \`docs/BRANCH_PROTECTION.md\`: GitHub protection settings for \`dev\` and \`main\`
- \`docs/COMMIT_CONVENTION.md\`: Conventional Commits and PR title rules
- \`docs/RELEASE_OPERATIONS.md\`: release promotion and hotfix handling
- \`docs/QUALITY_GATE.md\`: local hooks, CI checks, and required status gates
- \`docs/RESOURCE_STORAGE.md\`: OSS-backed asset storage behavior
- \`docs/RESOURCE_INDEX.md\`: local and remote resource index model
- \`docs/MODULES.md\`: installed and available scaffold modules

## Standard Operator Flows

### Daily Delivery

1. Branch from \`dev\`.
2. Implement with PRD and TDD updates.
3. Run \`pnpm quality:check\` and \`pnpm verify\`.
4. Open a Pull Request into \`dev\`.

### Release Promotion

1. Confirm \`dev\` is green.
2. Review \`docs/RELEASE_OPERATIONS.md\`.
3. Open a Pull Request from \`dev\` into \`main\`.
4. Release only after protected checks pass.

### Production Hotfix

1. Branch from \`main\` with \`hotfix/<slug>\`.
2. Keep the diff minimal.
3. Merge to \`main\`, then backport to \`dev\`.

### Module Update

1. Review \`docs/MODULES.md\`.
2. Edit \`.axi/modules.json\` or run \`axi add <feature-id>\`.
3. Run \`axi sync --cwd .\`.
4. Validate with \`axi doctor --cwd .\`.

### Resource Operations

1. Review \`docs/RESOURCE_STORAGE.md\` and \`docs/RESOURCE_INDEX.md\`.
2. Use \`resources:classify\` and \`resources:intake\` for agent-driven imports.
3. Use \`resources:review\` before promoting ambiguous assets to the public lane.

## Minimum Command Set

\`\`\`bash
pnpm git:bootstrap
pnpm commit
pnpm quality:check
pnpm verify
axi list --cwd .
axi doctor --cwd .
axi sync --cwd .
\`\`\`
`;
}

export function createQualityGateDoc(): string {
  return `# Quality Gate

## Local Scripts

- \`pnpm branch:check\` validates the current branch name against the repository policy.
- \`pnpm pr:title:check -- "<title>"\` validates a PR title against Conventional Commits.
- \`pnpm commit:check:last\` validates the most recent commit message.
- \`pnpm commit:lint:range -- --from <sha> --to <sha>\` validates a commit range.
- \`pnpm format:check\` validates formatting.
- \`pnpm lint\` validates frontend code quality.
- \`pnpm test:coverage\` enforces the 80% coverage floor.
- \`pnpm docs:check\` confirms the mandatory project docs exist.
- \`docs/MODULES.md\` and \`.axi/scaffold.manifest.json\` are part of the required scaffold contract.
- \`.axi/modules.json\` is the layered module policy file reused by future scaffold updates.
- \`docs/TOKEN_SYSTEM.md\` defines the token vocabulary and theme layering contract.
- \`docs/RESOURCE_INDEX.md\` defines the local asset catalog schema and lookup model.
- \`resources/public\` and \`resources/private\` must respect the asset visibility boundary.

## Git Hooks

- \`commit-msg\` runs \`commitlint\` and rejects invalid commit headers.
- \`pre-commit\` runs branch, formatting, linting, and docs checks.
- \`pre-push\` runs governance, coverage, and smoke verification checks.
- \`main\` stays release-only and \`dev\` stays the default integration branch.

## CI

- The baseline workflow lives in \`.github/workflows/ci.yml\`.
- CI validates branch, PR title, and commit range policy before the quality job runs.
- CI runs the same quality and verification commands used locally on both \`dev\` and \`main\`.
- GitHub branch protection should require the \`governance\` and \`quality\` jobs on both protected branches.
- Update this document if the gate changes.
`;
}

export function createResourceManagementDoc(): string {
  return `# Resource Management

## Asset Lanes

The scaffold separates project assets into two lanes:

1. \`resources/public\`
   - safe for broader product delivery decisions
   - candidates for future OSS/CDN synchronization after explicit review
   - includes web-served files under \`resources/public/web\`
2. \`resources/private\`
   - not for public upload
   - may stay local or move to a private OSS bucket later

## Rules

- Keep logos, public brand marks, and browser-served assets in the public lane.
- Keep internal-only, licensed, or partner-restricted files in the private lane.
- Do not import private assets into public web bundles.
- Review asset visibility before moving files from private to public.

## Storage Integration

- Configure providers and lane mapping in \`config/resource-storage.config.json\`.
- Configure category and tag rules in \`config/resource-classification.config.json\`.
- Use \`docs/RESOURCE_AGENT_SKILLS.md\` plus \`skills/resource-*\` for agent-driven intake and retrieval flows.
- Review \`resources:review\` output before promoting ambiguous assets into the public lane.
- Keep actual secrets in \`.env.resources.local\` or CI secrets, never in tracked files.
- Both generated OSS lanes default to private bucket access.
- Shared bucket reuse is the default; project isolation happens in remote prefixes instead of dedicated buckets.
- Public assets are expected to use a reviewed delivery path such as CDN or explicitly approved OSS exposure.
- Private assets are expected to use a private Alibaba Cloud OSS bucket, private prefix, or remain local only.

## Current Branding

- Primary public web logo: \`resources/public/web/brand/axi-trident-icon.svg\`
- Runtime React wrapper: \`apps/web/src/shared/branding/AxiLogoMark.tsx\`
- Browser favicon: served from the same public web asset lane
`;
}

export function createResourceStorageDoc(): string {
  return `# Resource Storage

## Purpose

This scaffold supports configuration-driven asset synchronization.

The default generated integration targets Alibaba Cloud OSS, but the project does not hardcode credentials.

## Files

- \`config/resource-storage.config.json\`: provider, shared bucket, and namespace configuration
- \`config/resource-classification.config.json\`: category and tag classification rules
- \`.env.resources.example\`: environment variable template
- \`scripts/resource-storage.mjs\`: config loading and provider client assembly
- \`scripts/resources-batch-intake.mjs\`: CLI wrapper for multi-file classify-then-store intake
- \`scripts/resources-bucket.mjs\`: CLI wrapper for bucket creation
- \`scripts/resources-classify.mjs\`: CLI wrapper for policy-driven classification preview
- \`scripts/resources-delete.mjs\`: CLI wrapper for remote deletion plus catalog tombstones
- \`scripts/resources-fetch.mjs\`: CLI wrapper for remote object reads
- \`scripts/resources-gc.mjs\`: CLI wrapper for catalog garbage collection
- \`scripts/resources-get.mjs\`: alias wrapper for resource retrieval
- \`scripts/resources-index.mjs\`: CLI wrapper for local asset indexing
- \`scripts/resources-intake.mjs\`: CLI wrapper for classify-then-store intake
- \`scripts/resources-put.mjs\`: CLI wrapper for arbitrary local file ingestion
- \`scripts/resources-query.mjs\`: CLI wrapper for local asset catalog lookup
- \`scripts/resources-review.mjs\`: CLI wrapper for review-focused catalog audit
- \`scripts/resources-sync.mjs\`: CLI wrapper for lane synchronization
- \`.axi/resource-index.sqlite\`: generated SQLite catalog for indexed assets

## Default Commands

\`\`\`bash
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
pnpm resources:index:private
pnpm resources:query -- --lane public --tag logo --tag branding --tag-mode all
pnpm resources:review -- --lane private
pnpm resources:plan:public
pnpm resources:sync:public
pnpm resources:plan:private
pnpm resources:sync:private
\`\`\`

## Default Behavior

- \`resources:sync:*\` ensures the target bucket exists before uploading files.
- \`resources:index:*\` updates the local SQLite catalog without requiring a remote write.
- \`resources:batch-intake\` performs multi-file classify-then-store workflows with one command invocation.
- \`resources:classify\` previews lane, category, tags, and hashed object key without uploading.
- \`resources:intake\` runs classify-then-store so agent and automation flows stay policy-driven.
- \`resources:put\` ingests an arbitrary local file into the chosen lane and persists it to OSS plus the local catalog.
- \`resources:get\` and \`resources:fetch\` retrieve a remote object by sha256 or object key.
- \`resources:delete\` removes a remote object and marks the catalog row as deleted.
- \`resources:gc\` removes deleted or missing rows from the local catalog.
- \`resources:review\` focuses on catalog rows that still require human review.
- \`resources:fetch\` reads a remote object by sha256 or object key through the resource layer, not through hardcoded bucket logic in CLI wrappers.
- Both generated lanes default to private bucket ACLs.
- The lane name \`public\` describes asset visibility intent inside the project, not automatic public-read exposure in OSS.
- The generated provider defaults to region \`oss-cn-hangzhou\` unless you override it.
- The first bucket creation can auto-generate a shared private bucket name per lane when none is configured yet.
- After the first successful bucket creation or sync, the resolved bucket and region are written back into \`config/resource-storage.config.json\`.
- Object keys are derived from file sha256 plus extension, then namespaced under \`projects/<project>/objects/<lane>/sha256/\`.
- Remote index manifests are written under \`projects/<project>/index/<lane>/catalog.latest.json\`.
- Category lookup stays local in SQLite so file organization and remote object layout stay decoupled.

## Configuration Model

The generated config maps:

1. providers
   - provider type
   - auth env names
   - region env name
   - optional endpoint env name
   - optional STS token env name
   - request signing strategy
2. lanes
   - source directory
   - bucket env name
   - bucket ACL
   - object key prefix
   - excluded file names
3. catalog
   - SQLite database path
   - default category
   - hash path segment lengths
   - object key strategy
   - shared bucket root prefix
   - project namespace
   - remote object directory
   - remote index directory
4. classification
   - intake lane defaults and lane rules
   - path prefix rules
   - lane default tags
   - explicit category overrides
   - reusable lookup tags

## Security Rules

- Never commit real AK/SK values.
- Use long-term AK/SK only in server-side or local trusted scripts.
- Browser-side upload flows should use STS or pre-signed URL instead of long-term secrets.
- Keep public and private lanes on separate buckets or separate prefixes with explicit review.
- Prefer STS for browser or shared environments, and reserve long-term keys for local trusted automation only.
- Keep bucket creation conservative by default; if you later need public access, update the lane config only after reviewing current OSS public-access controls.
- Use the SDK-driven bucket creation flow for automation; do not require console-side manual bucket creation as part of the default scaffold path.
- Keep credentials in env only, but persist non-secret bucket and region values into config after a successful create/sync so future runs can reuse them.
- Auto-generated bucket names are derived from the account context and lane name so multiple scaffolded projects can reuse the same shared buckets.
- Keep file discovery and classification in the local catalog so future asset tools can query metadata without coupling to CLI command code.
- Keep remote object reads behind the generated resource layer so future providers can change without rewriting every CLI command.
- Keep arbitrary file ingestion behind the generated resource layer so import, delete, and retrieval semantics stay consistent across lanes.
- Keep agent-driven intake behind \`resources:classify\` and \`resources:intake\` so lane decisions stay reproducible.
- Persist review-needed decisions in the local catalog so later audits do not depend on one-off terminal output.
- Keep per-project isolation in remote prefixes and remote index manifests instead of creating a new bucket for every scaffolded project.

## Default Alibaba Cloud OSS Mapping

- provider type: \`aliyun-oss\`
- default region: \`oss-cn-hangzhou\`
- public source lane: \`resources/public/web\`
- private source lane: \`resources/private\`
- public bucket ACL: \`private\` by default, then promote only after explicit review
- private bucket ACL: \`private\`
- env template: \`.env.resources.example\`
`;
}

export function createResourceAgentSkillsDoc(): string {
  return `# Resource Agent Skills

## Purpose

The scaffold ships with project-local resource skills so agents do not have to guess how assets should be classified or retrieved.

## Skills

- \`skills/resource-intake/SKILL.md\`
  - classify a local file
  - default ambiguous assets to the private lane
  - store the file through the resource layer
- \`skills/resource-review/SKILL.md\`
  - inspect lane, category, tag, and sync metadata
  - verify classification drift against current policy
- \`skills/resource-rehydrate/SKILL.md\`
  - locate stored assets by category, tag, sha256, or object key
  - fetch them back without hardcoded OSS paths

## Command Mapping

\`\`\`bash
pnpm resources:batch-intake -- --file C:/path/to/logo.svg --file C:/path/to/icon.svg --path brand/logo.svg --path icons/icon.svg --dry-run
pnpm resources:classify -- --file C:/path/to/file.svg --path brand/logo.svg
pnpm resources:intake -- --file C:/path/to/file.svg --path brand/logo.svg
pnpm resources:query -- --tag logo --tag branding --tag-mode all
pnpm resources:review -- --lane private
pnpm resources:get -- public --sha256 <hash> --output ./tmp/logo.svg
\`\`\`

## Rules

- Use \`resources:classify\` before a new agent-driven upload.
- Use \`resources:intake\` instead of direct \`resources:put\` when the lane is not already fixed by the task.
- Use \`resources:batch-intake\` when several files share one intake pass.
- Default to the private lane when no intake rule matches.
- Use \`resources:review\` to find rows that still require human confirmation.
- Change \`config/resource-classification.config.json\` when the policy should evolve; do not hide that logic in prompts alone.
- Keep retrieval inside the resource layer and local catalog, not raw bucket path assumptions.
`;
}

export function createResourceIndexDoc(): string {
  return `# Resource Index

## Purpose

The scaffold keeps a local SQLite resource catalog so asset lookup, classification, and sync state do not depend on hardcoded OSS paths.

## Database

- path: \`.axi/resource-index.sqlite\`
- storage: SQLite file persisted by the generated resource layer
- owner: generated resource layer in \`scripts/resource-storage.mjs\`
- remote companion: \`projects/<project>/index/<lane>/catalog.latest.json\`

## Indexed Fields

- \`lane\`: public or private lane
- \`category_path\`: derived from the source-relative directory path
- \`bucket\`: resolved target bucket when known
- \`object_key\`: hashed OSS object key
- \`sha256\`: file content hash
- \`file_name\`: original file name
- \`extension\`: normalized file suffix
- \`mime\`: inferred MIME type when known
- \`size_bytes\`: source file size
- \`source_relative_path\`: path relative to the lane source directory
- \`source_absolute_path\`: absolute local file path at index time
- \`etag\`: last uploaded ETag when synced
- \`classification_reason\`: why the current lane/category decision was chosen
- \`needs_review\`: whether the asset still requires human confirmation
- \`sync_status\`: \`indexed\` or \`synced\`
- \`source_present\`: whether the file still exists locally
- \`tags\`: derived tags used for later lookup and grouping
- imported files: arbitrary local files stored through \`resources:put\`

## Category Model

- Categories come from directory structure, not from object keys.
- Categories may be overridden by \`config/resource-classification.config.json\`.
- Files at the lane root use the default category \`uncategorized\`.
- Example: \`resources/public/web/brand/axi-trident-icon.svg\` becomes category \`brand\`.

## Tag Model

- Tags come from lane defaults, matching classification rules, and file metadata.
- Default tags include lane intent such as \`public\` or \`private\`.
- Classification rules can add lookup tags such as \`logo\` or \`icon\`.
- File metadata adds normalized tags such as \`ext:svg\` and \`mime:image/svg+xml\`.

## Object Key Model

- Object keys use file sha256 and extension.
- Shared buckets isolate projects by prefix instead of by bucket name.
- Default hash path segments are \`[2, 2]\`, so a file becomes:
  \`projects/<project>/objects/<lane>/sha256/<optional-prefix>/<aa>/<bb>/<full-sha256>.<ext>\`
- This keeps remote storage stable even if the local category structure changes later.
- A companion remote index manifest is written to:
  \`projects/<project>/index/<lane>/catalog.latest.json\`

## Commands

\`\`\`bash
pnpm resources:index:public
pnpm resources:index:private
pnpm resources:batch-intake -- --file C:/path/to/logo.svg --file C:/path/to/icon.svg --path brand/logo.svg --path icons/icon.svg --dry-run
pnpm resources:classify -- --file C:/path/to/file.svg --path brand/logo.svg
pnpm resources:intake -- --file C:/path/to/file.svg --path brand/logo.svg
pnpm resources:query -- --lane public
pnpm resources:query -- --category brand --all
pnpm resources:query -- --tag logo --tag branding --tag-mode all
pnpm resources:review -- --lane private
pnpm resources:query -- --sha256 <hash>
pnpm resources:put -- public --file C:/path/to/file.svg --category brand --tag upload
pnpm resources:get -- public --sha256 <hash> --output ./tmp/logo.svg
pnpm resources:delete -- public --sha256 <hash>
pnpm resources:gc -- --lane public
pnpm resources:fetch -- public --sha256 <hash> --output ./tmp/logo.svg
\`\`\`

## Rules

- Query the catalog for discovery and classification.
- Use OSS object keys only for remote storage operations.
- Do not treat the remote key layout as the source of truth for categories.
- Re-run indexing after major local asset moves before auditing or syncing.
- Prefer tag and category queries over manual bucket browsing when locating assets.
- Prefer \`resources:intake\` over direct \`resources:put\` for new agent-driven imports.
- Use \`resources:review\` to audit rows where \`needs_review\` is still true.
- Use \`resources:put\` for arbitrary files that should be stored remotely without being checked into the lane directories.
- Use \`resources:delete\` before \`resources:gc\` when you want remote deletion plus local catalog cleanup.
`;
}

export function createTokenSystemDoc(): string {
  return `# Token System

## Token Layers

1. Foundation tokens
   - global scales for typography, spacing, radius, shadows, borders, motion, layout, and interaction states
2. Theme modes
   - semantic light and dark overrides
3. Theme presets
   - visual styles such as minimal, cyberpunk, and glassmorphism
4. Runtime semantic variables
   - CSS variables consumed by the app and shared packages
5. Built SCSS tree
   - modular \`@use\` entrypoints generated in \`packages/tokens/dist/scss\`

## Composition Model

- theme mode and theme preset are two independent dimensions
- the model is cartesian, so each mode should compose with every preset
- mode owns luminance, semantic contrast, and base neutral surfaces
- preset owns accent, material tint, typography flavor, radius, and atmospheric treatment
- a semantic slot should have one owner only

## Rules

- Add or change visual primitives in \`packages/tokens/tokens/foundation\`.
- Add or change mode semantics in \`packages/tokens/tokens/theme/modes/*\`.
- Add or change style families in \`packages/tokens/tokens/theme/presets/*.json\`.
- Treat JSON as the source of truth and \`dist/scss\` as the generated consumer layer.
- Map new slots in \`apps/web/src/shared/theme/theme.css\` only when the semantic surface changes.
- Component code should consume semantic variables first, not raw palette values.
- Avoid preset branches that special-case a specific mode unless the composition contract itself changes.

## SCSS Usage

- The generated web workspace preconfigures Sass \`loadPaths\` to \`packages/tokens/dist/scss\`.
- Use the root entrypoint with \`@use 'tokens' as tokens;\`
- Use domain entrypoints with \`@use 'foundation/space' as space;\`
- Use theme preset entrypoints with \`@use 'theme/presets/minimal' as minimal;\`

## Supported Dimensions

- color scales: primary, success, warning, danger, info, neutral, dark
- semantic colors: text, background, border, state, and runtime theme aliases
- typography: font families, sizes, weights, line heights, letter spacing
- layout: containers, measures, grids, gutters, section spacing
- spacing semantics: page, card, form, button, table, modal, popup, sidebar, topbar
- surfaces: page, backdrop, panel, elevated, input, tag, spotlight
- borders: widths and semantic border colors
- effects: blur/backdrop and shadow families
- motion: durations and easing curves
- interaction: hover lift, card lift, active press, disabled opacity
- breakpoints: xs through 2xl
- z-index: dropdown, sticky, fixed, modal, popover, tooltip, notification
- modes: light and dark
- presets: minimal, cyberpunk, glassmorphism
`;
}

export function createModulesDoc(context: FeatureRenderContext): string {
  const selectedFeatureIdSet = new Set(context.selectedFeatureSummaries.map((feature) => feature.id));
  const selectedFoundation = context.selectedFeatureSummaries.filter(
    (feature) => feature.layer === 'foundation',
  );
  const selectedExtension = context.selectedFeatureSummaries.filter(
    (feature) => feature.layer === 'extension',
  );
  const selectedExperimental = context.selectedFeatureSummaries.filter(
    (feature) => feature.layer === 'experimental',
  );
  const availableExtension = context.availableInstallableFeatures.filter(
    (feature) => feature.layer === 'extension' && !selectedFeatureIdSet.has(feature.id),
  );
  const availableExperimental = context.availableInstallableFeatures.filter(
    (feature) => feature.layer === 'experimental' && !selectedFeatureIdSet.has(feature.id),
  );

  return `# Modules

## Installed Foundation Modules

${renderFeatureCatalog(selectedFoundation)}

## Installed Extension Modules

${renderFeatureCatalog(selectedExtension, '- none installed yet')}

## Installed Experimental Modules

${renderFeatureCatalog(selectedExperimental, '- none installed yet')}

## Available Extension Modules

${renderFeatureCatalog(availableExtension, '- none available yet')}

## Available Experimental Modules

${renderFeatureCatalog(availableExperimental, '- none available yet')}

## Update Workflow

1. Add a module with \`axi add <feature-id> --cwd .\`.
2. Review the editable module config in \`.axi/modules.json\`.
3. Review the applied snapshot in \`.axi/scaffold.manifest.json\`.
4. Run \`pnpm quality:check\` and \`pnpm verify\`.
5. Use \`axi list --cwd .\` or \`axi list --json --cwd .\` to inspect state.
6. Use \`axi doctor --cwd .\` before larger updates or \`axi doctor --fix --cwd .\` for controlled repair.
`;
}

export function createPullRequestTemplate(): string {
  return `## Summary

- change
- change

## Testing

- [ ] pnpm quality:check
- [ ] pnpm verify

## Governance

- [ ] branch name follows the repository policy
- [ ] PR title follows Conventional Commits
- [ ] docs updated when rules or workflow changed

## Linked Work

- Closes #
`;
}

export function createCiWorkflow(): string {
  return `name: Quality Gate

on:
  pull_request:
    branches:
      - dev
      - main
  push:
    branches:
      - dev
      - main

jobs:
  governance:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          cache: pnpm
          node-version: 22

      - name: Install workspace dependencies
        run: pnpm install --frozen-lockfile=false

      - name: Check branch policy
        run: node ./scripts/check-git-branch.mjs

      - name: Check PR title
        if: github.event_name == 'pull_request'
        env:
          PR_TITLE: \${{ github.event.pull_request.title }}
        run: node ./scripts/check-pr-title.mjs

      - name: Check commit range for PR
        if: github.event_name == 'pull_request'
        run: node ./scripts/check-commit-range.mjs --from \${{ github.event.pull_request.base.sha }} --to \${{ github.event.pull_request.head.sha }}

      - name: Check commit range for push
        if: github.event_name == 'push'
        run: node ./scripts/check-commit-range.mjs --from \${{ github.event.before }} --to \${{ github.sha }}

  quality:
    runs-on: ubuntu-latest
    needs: governance

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          cache: pnpm
          node-version: 22

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.10'

      - name: Install workspace dependencies
        run: pnpm install --frozen-lockfile=false

      - name: Prepare Python environment
        run: node ./scripts/setup-python.mjs

      - name: Run quality gate
        run: pnpm quality:check

      - name: Run smoke verification
        run: pnpm verify
`;
}
