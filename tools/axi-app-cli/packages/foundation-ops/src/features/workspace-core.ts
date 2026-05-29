import type {
  FeatureRenderContext,
  ProjectFile,
  ScaffoldModuleManifest,
} from '@axi/scaffold-kit';
import {
  createResourceIntakeSkill,
  createResourceRehydrateSkill,
  createResourceReviewSkill,
} from '../templates/generated-agent-skills.js';
import {
  createCommitizenConfig,
  createCommitlintConfig,
  createContributingGuide,
  createGeneratedAgents,
  createGeneratedChangelog,
  createGeneratedMilestone,
  createGeneratedReadme,
  createGeneratedTodo,
  createPrivateResourcesReadme,
  createPublicResourcesReadme,
  createResourcesReadme,
  createRootPackageJson,
} from '../templates/generated-root.js';
import { defineScaffoldFeature } from '@axi/scaffold-kit';

export const workspaceCoreManifest = {
  category: 'platform',
  configKey: 'modules.workspace-core.enabled',
  description: 'Root workspace files, lifecycle scripts, and repository governance docs.',
  enabledByDefault: true,
  id: 'workspace-core',
  layer: 'foundation',
  title: 'Workspace Core',
  version: '0.1.0',
} satisfies ScaffoldModuleManifest;

function applyWorkspaceCore(context: FeatureRenderContext): ProjectFile[] {
  return [
    { path: 'package.json', content: createRootPackageJson(context) },
    { path: 'pnpm-workspace.yaml', content: `packages:\n  - "apps/*"\n  - "packages/*"\n` },
    { path: '.npmrc', content: `@axi:registry=http://127.0.0.1:4873/\n` },
    {
      path: '.gitignore',
      content: `node_modules
.venv
coverage
dist
__pycache__
.pytest_cache
.DS_Store
.env.local
.env.resources.local
.axi/resource-index.sqlite
.axi/resource-index.sqlite-shm
.axi/resource-index.sqlite-wal
resources/private/*
!resources/private/README.md
`,
    },
    {
      path: '.prettierignore',
      content: `coverage
dist
.venv
`,
    },
    { path: 'README.md', content: createGeneratedReadme(context) },
    { path: 'AGENTS.md', content: createGeneratedAgents(context) },
    { path: 'CONTRIBUTING.md', content: createContributingGuide() },
    { path: 'TODO.md', content: createGeneratedTodo() },
    { path: 'MILESTONE.md', content: createGeneratedMilestone() },
    { path: 'CHANGELOG.md', content: createGeneratedChangelog() },
    { path: '.czrc', content: createCommitizenConfig() },
    { path: 'commitlint.config.cjs', content: createCommitlintConfig() },
    { path: 'skills/resource-intake/SKILL.md', content: createResourceIntakeSkill() },
    { path: 'skills/resource-review/SKILL.md', content: createResourceReviewSkill() },
    { path: 'skills/resource-rehydrate/SKILL.md', content: createResourceRehydrateSkill() },
    { path: 'resources/README.md', content: createResourcesReadme() },
    { path: 'resources/public/README.md', content: createPublicResourcesReadme() },
    { path: 'resources/private/README.md', content: createPrivateResourcesReadme() },
  ];
}

export const workspaceCoreFeature = defineScaffoldFeature(workspaceCoreManifest, applyWorkspaceCore);
