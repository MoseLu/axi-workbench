import type {
  FeatureRenderContext,
  ProjectFile,
  ScaffoldModuleManifest,
} from '@axi/scaffold-kit';
import {
  createArchitectureDoc,
  createBranchProtectionDoc,
  createCiWorkflow,
  createCommitConventionDoc,
  createDashboardHostingDoc,
  createGitHubFlowDoc,
  createModulesDoc,
  createOperationsDoc,
  createPrdTemplate,
  createPullRequestTemplate,
  createQualityGateDoc,
  createReleaseOperationsDoc,
  createResourceAgentSkillsDoc,
  createResourceIndexDoc,
  createResourceManagementDoc,
  createResourceStorageDoc,
  createTddTemplate,
  createTokenSystemDoc,
} from '../templates/generated-docs.js';
import { defineScaffoldFeature } from '@axi/scaffold-kit';

export const docsCoreManifest = {
  category: 'docs',
  configKey: 'modules.docs-core.enabled',
  description: 'Architecture, PRD/TDD, module inventory, and CI policy documents.',
  enabledByDefault: true,
  id: 'docs-core',
  layer: 'foundation',
  title: 'Docs Core',
  version: '0.1.0',
} satisfies ScaffoldModuleManifest;

function applyDocsCore(context: FeatureRenderContext): ProjectFile[] {
  return [
    { path: 'docs/ARCHITECTURE.md', content: createArchitectureDoc(context) },
    { path: 'docs/BRANCH_PROTECTION.md', content: createBranchProtectionDoc() },
    { path: 'docs/COMMIT_CONVENTION.md', content: createCommitConventionDoc() },
    { path: 'docs/AXI_DASHBOARD_HOSTING.md', content: createDashboardHostingDoc(context) },
    { path: 'docs/GITHUB_FLOW.md', content: createGitHubFlowDoc() },
    { path: 'docs/MODULES.md', content: createModulesDoc(context) },
    { path: 'docs/OPERATIONS.md', content: createOperationsDoc() },
    { path: 'docs/PRD_TEMPLATE.md', content: createPrdTemplate() },
    { path: 'docs/TDD_TEMPLATE.md', content: createTddTemplate() },
    { path: 'docs/TOKEN_SYSTEM.md', content: createTokenSystemDoc() },
    { path: 'docs/RESOURCE_MANAGEMENT.md', content: createResourceManagementDoc() },
    { path: 'docs/RESOURCE_AGENT_SKILLS.md', content: createResourceAgentSkillsDoc() },
    { path: 'docs/RESOURCE_INDEX.md', content: createResourceIndexDoc() },
    { path: 'docs/RESOURCE_STORAGE.md', content: createResourceStorageDoc() },
    { path: 'docs/RELEASE_OPERATIONS.md', content: createReleaseOperationsDoc() },
    { path: 'docs/QUALITY_GATE.md', content: createQualityGateDoc() },
    { path: '.github/PULL_REQUEST_TEMPLATE.md', content: createPullRequestTemplate() },
    { path: '.github/workflows/ci.yml', content: createCiWorkflow() },
  ];
}

export const docsCoreFeature = defineScaffoldFeature(docsCoreManifest, applyDocsCore);
