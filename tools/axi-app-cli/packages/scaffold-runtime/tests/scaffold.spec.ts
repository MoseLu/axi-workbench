import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { runCli } from '@axi/scaffold-runtime';
import { createTempDir, disposeTempDir, listRelativeFiles, readText } from './helpers.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((tempDir) => disposeTempDir(tempDir)));
});

describe('runCli', () => {
  it('generates the default scaffold in the current directory', async () => {
    const tempDir = await createTempDir('axi-init-');
    tempDirs.push(tempDir);
    const workspaceDir = path.join(tempDir, 'project-root');

    await mkdir(workspaceDir);

    await runCli(['init', '--yes', '--no-install', '--no-verify', '--cwd', workspaceDir], {
      cwd: process.cwd(),
      invokedName: 'axi',
    });

    const files = (await listRelativeFiles(workspaceDir)).slice().sort();
    const requiredFiles = [
      '.axi/modules.json',
      '.axi/scaffold.manifest.json',
      '.czrc',
      '.npmrc',
      '.env.resources.example',
      '.github/PULL_REQUEST_TEMPLATE.md',
      '.github/workflows/ci.yml',
      '.githooks/commit-msg',
      'README.md',
      'AGENTS.md',
      'CONTRIBUTING.md',
      'commitlint.config.cjs',
      'config/axi-dashboard-app.json',
      'config/resource-classification.config.json',
      'config/resource-storage.config.json',
      'docs/AXI_DASHBOARD_HOSTING.md',
      'docs/BRANCH_PROTECTION.md',
      'docs/COMMIT_CONVENTION.md',
      'docs/GITHUB_FLOW.md',
      'docs/OPERATIONS.md',
      'docs/RELEASE_OPERATIONS.md',
      'resources/README.md',
      'resources/public/README.md',
      'resources/private/README.md',
      'resources/public/web/brand/axi-trident-icon.svg',
      'docs/TOKEN_SYSTEM.md',
      'docs/RESOURCE_AGENT_SKILLS.md',
      'docs/RESOURCE_MANAGEMENT.md',
      'docs/RESOURCE_INDEX.md',
      'docs/RESOURCE_STORAGE.md',
      'docs/modules/theme-preset.md',
      'docs/modules/theme-style-minimal.md',
      'docs/modules/theme-style-cyberpunk.md',
      'docs/modules/theme-style-glassmorphism.md',
      'packages/tokens/package.json',
      'packages/tokens/style-dictionary.config.mjs',
      'packages/tokens/scripts/build-scss-index.mjs',
      'packages/tokens/tokens/foundation/space.json',
      'packages/tokens/tokens/foundation/background.json',
      'packages/tokens/tokens/foundation/breakpoint.json',
      'packages/tokens/tokens/foundation/border.json',
      'packages/tokens/tokens/foundation/color-scale.json',
      'packages/tokens/tokens/foundation/semantic-color.json',
      'packages/tokens/tokens/foundation/shadow.json',
      'packages/tokens/tokens/foundation/spacing-semantic.json',
      'packages/tokens/tokens/foundation/z-index.json',
      'packages/tokens/tokens/theme/modes/light/background.json',
      'packages/tokens/tokens/theme/modes/dark/text.json',
      'packages/tokens/tokens/theme/presets/minimal/accent.json',
      'packages/tokens/tokens/theme/presets/cyberpunk/surface.json',
      'packages/tokens/tokens/theme/presets/glassmorphism/shadow.json',
      'packages/ui-foundation/src/themes.ts',
      'scripts/load-local-env.mjs',
      'scripts/check-commit-range.mjs',
      'scripts/check-docs.mjs',
      'scripts/check-git-branch.mjs',
      'scripts/check-pr-title.mjs',
      'scripts/resources-batch-intake.mjs',
      'scripts/resources-bucket.mjs',
      'scripts/resources-classify.mjs',
      'scripts/resources-delete.mjs',
      'scripts/resources-fetch.mjs',
      'scripts/resources-gc.mjs',
      'scripts/resources-get.mjs',
      'scripts/resources-index.mjs',
      'scripts/resources-intake.mjs',
      'scripts/resources-put.mjs',
      'scripts/resources-query.mjs',
      'scripts/resources-review.mjs',
      'scripts/resource-storage.mjs',
      'scripts/resources-sync.mjs',
      'scripts/setup-git-governance.mjs',
      'skills/resource-intake/SKILL.md',
      'skills/resource-review/SKILL.md',
      'skills/resource-rehydrate/SKILL.md',
      'apps/web/src/shared/theme/index.ts',
      'apps/web/src/shared/theme/ThemeSwitcher.tsx',
      'apps/web/src/shared/theme/__tests__/ThemeSwitcher.test.tsx',
      'apps/web/src/shared/theme/registry.ts',
      'apps/web/src/shared/theme/theme.css',
      'apps/web/src/shared/theme/useTheme.ts',
      'apps/web/src/features/home/components/HomePage.tsx',
    ];

    for (const requiredFile of requiredFiles) {
      expect(files).toContain(requiredFile);
    }

    const agentsContent = await readText(path.join(workspaceDir, 'AGENTS.md'));
    const modulesConfig = JSON.parse(await readText(path.join(workspaceDir, '.axi/modules.json')));
    const manifest = JSON.parse(await readText(path.join(workspaceDir, '.axi/scaffold.manifest.json')));
    const packageJson = JSON.parse(await readText(path.join(workspaceDir, 'package.json')));
    const webPackageJson = JSON.parse(await readText(path.join(workspaceDir, 'apps/web/package.json')));
    const npmrc = await readText(path.join(workspaceDir, '.npmrc'));
    const tokensPackageJson = JSON.parse(
      await readText(path.join(workspaceDir, 'packages/tokens/package.json')),
    );
    const globalStyles = await readText(path.join(workspaceDir, 'apps/web/src/app/styles/global.scss'));
    const viteConfig = await readText(path.join(workspaceDir, 'apps/web/vite.config.ts'));
    const featureHook = await readText(
      path.join(workspaceDir, 'apps/web/src/features/home/hooks/useHomeCards.ts'),
    );
    const gitignore = await readText(path.join(workspaceDir, '.gitignore'));
    const envResourcesExample = await readText(path.join(workspaceDir, '.env.resources.example'));
    const resourceClassificationConfig = JSON.parse(
      await readText(path.join(workspaceDir, 'config/resource-classification.config.json')),
    );
    const resourceStorageConfig = JSON.parse(
      await readText(path.join(workspaceDir, 'config/resource-storage.config.json')),
    );
    const webIndexHtml = await readText(path.join(workspaceDir, 'apps/web/index.html'));
    const brandAsset = await readText(
      path.join(workspaceDir, 'resources/public/web/brand/axi-trident-icon.svg'),
    );
    const webApp = await readText(path.join(workspaceDir, 'apps/web/src/app/App.tsx'));
    const axiAppManifest = await readText(path.join(workspaceDir, 'apps/web/src/app/axi.app.ts'));
    const dashboardAppConfig = JSON.parse(
      await readText(path.join(workspaceDir, 'config/axi-dashboard-app.json')),
    );
    const homePage = await readText(
      path.join(workspaceDir, 'apps/web/src/features/home/components/HomePage.tsx'),
    );
    const generatedReadme = await readText(path.join(workspaceDir, 'README.md'));
    const contributingGuide = await readText(path.join(workspaceDir, 'CONTRIBUTING.md'));
    const commitlintConfig = await readText(path.join(workspaceDir, 'commitlint.config.cjs'));
    const commitizenConfig = JSON.parse(await readText(path.join(workspaceDir, '.czrc')));
    const commitMsgHook = await readText(path.join(workspaceDir, '.githooks/commit-msg'));
    const checkBranchScript = await readText(
      path.join(workspaceDir, 'scripts/check-git-branch.mjs'),
    );
    const checkCommitRangeScript = await readText(
      path.join(workspaceDir, 'scripts/check-commit-range.mjs'),
    );
    const checkPrTitleScript = await readText(
      path.join(workspaceDir, 'scripts/check-pr-title.mjs'),
    );
    const setupGitGovernanceScript = await readText(
      path.join(workspaceDir, 'scripts/setup-git-governance.mjs'),
    );
    const githubFlowDoc = await readText(path.join(workspaceDir, 'docs/GITHUB_FLOW.md'));
    const architectureDoc = await readText(path.join(workspaceDir, 'docs/ARCHITECTURE.md'));
    const dashboardHostingDoc = await readText(
      path.join(workspaceDir, 'docs/AXI_DASHBOARD_HOSTING.md'),
    );
    const operationsDoc = await readText(path.join(workspaceDir, 'docs/OPERATIONS.md'));
    const branchProtectionDoc = await readText(
      path.join(workspaceDir, 'docs/BRANCH_PROTECTION.md'),
    );
    const commitConventionDoc = await readText(
      path.join(workspaceDir, 'docs/COMMIT_CONVENTION.md'),
    );
    const qualityGateDoc = await readText(path.join(workspaceDir, 'docs/QUALITY_GATE.md'));
    const releaseOperationsDoc = await readText(
      path.join(workspaceDir, 'docs/RELEASE_OPERATIONS.md'),
    );
    const ciWorkflow = await readText(path.join(workspaceDir, '.github/workflows/ci.yml'));
    const pullRequestTemplate = await readText(
      path.join(workspaceDir, '.github/PULL_REQUEST_TEMPLATE.md'),
    );
    const resourceManagementDoc = await readText(
      path.join(workspaceDir, 'docs/RESOURCE_MANAGEMENT.md'),
    );
    const resourceAgentSkillsDoc = await readText(
      path.join(workspaceDir, 'docs/RESOURCE_AGENT_SKILLS.md'),
    );
    const resourceIndexDoc = await readText(path.join(workspaceDir, 'docs/RESOURCE_INDEX.md'));
    const resourceStorageDoc = await readText(path.join(workspaceDir, 'docs/RESOURCE_STORAGE.md'));
    const resourceStorageScript = await readText(
      path.join(workspaceDir, 'scripts/resource-storage.mjs'),
    );
    const resourceBatchIntakeScript = await readText(
      path.join(workspaceDir, 'scripts/resources-batch-intake.mjs'),
    );
    const resourceBucketScript = await readText(
      path.join(workspaceDir, 'scripts/resources-bucket.mjs'),
    );
    const resourceClassifyScript = await readText(
      path.join(workspaceDir, 'scripts/resources-classify.mjs'),
    );
    const resourceDeleteScript = await readText(
      path.join(workspaceDir, 'scripts/resources-delete.mjs'),
    );
    const resourceFetchScript = await readText(
      path.join(workspaceDir, 'scripts/resources-fetch.mjs'),
    );
    const resourceGcScript = await readText(path.join(workspaceDir, 'scripts/resources-gc.mjs'));
    const resourceGetScript = await readText(
      path.join(workspaceDir, 'scripts/resources-get.mjs'),
    );
    const resourceIndexScript = await readText(
      path.join(workspaceDir, 'scripts/resources-index.mjs'),
    );
    const resourceIntakeScript = await readText(
      path.join(workspaceDir, 'scripts/resources-intake.mjs'),
    );
    const resourcePutScript = await readText(path.join(workspaceDir, 'scripts/resources-put.mjs'));
    const resourceQueryScript = await readText(
      path.join(workspaceDir, 'scripts/resources-query.mjs'),
    );
    const resourceReviewScript = await readText(
      path.join(workspaceDir, 'scripts/resources-review.mjs'),
    );
    const resourceSyncScript = await readText(
      path.join(workspaceDir, 'scripts/resources-sync.mjs'),
    );
    const resourceIntakeSkill = await readText(
      path.join(workspaceDir, 'skills/resource-intake/SKILL.md'),
    );
    const resourceReviewSkill = await readText(
      path.join(workspaceDir, 'skills/resource-review/SKILL.md'),
    );
    const resourceRehydrateSkill = await readText(
      path.join(workspaceDir, 'skills/resource-rehydrate/SKILL.md'),
    );
    const pyProject = await readText(path.join(workspaceDir, 'apps/api/pyproject.toml'));
    const themeCss = await readText(path.join(workspaceDir, 'apps/web/src/shared/theme/theme.css'));
    const themePreferences = await readText(
      path.join(workspaceDir, 'apps/web/src/shared/theme/useThemePreferences.ts'),
    );
    const foundationBreakpoint = JSON.parse(
      await readText(path.join(workspaceDir, 'packages/tokens/tokens/foundation/breakpoint.json')),
    );
    const foundationColorScale = JSON.parse(
      await readText(path.join(workspaceDir, 'packages/tokens/tokens/foundation/color-scale.json')),
    );
    const foundationSemanticColor = JSON.parse(
      await readText(
        path.join(workspaceDir, 'packages/tokens/tokens/foundation/semantic-color.json'),
      ),
    );
    const foundationSpacingSemantic = JSON.parse(
      await readText(
        path.join(workspaceDir, 'packages/tokens/tokens/foundation/spacing-semantic.json'),
      ),
    );
    const foundationZIndex = JSON.parse(
      await readText(path.join(workspaceDir, 'packages/tokens/tokens/foundation/z-index.json')),
    );
    const themeModes = JSON.parse(
      await readText(path.join(workspaceDir, 'packages/tokens/tokens/theme/modes/light/background.json')),
    );
    const minimalPreset = JSON.parse(
      await readText(path.join(workspaceDir, 'packages/tokens/tokens/theme/presets/minimal/surface.json')),
    );
    const themeRegistry = await readText(path.join(workspaceDir, 'apps/web/src/shared/theme/registry.ts'));
    const themeCompatibilityHook = await readText(
      path.join(workspaceDir, 'apps/web/src/shared/theme/useTheme.ts'),
    );
    const themeSwitcher = await readText(
      path.join(workspaceDir, 'apps/web/src/shared/theme/ThemeSwitcher.tsx'),
    );
    const tokenSystemDoc = await readText(path.join(workspaceDir, 'docs/TOKEN_SYSTEM.md'));
    const enabledModuleIds = manifest.modules
      .filter((module: { enabled: boolean; id: string }) => module.enabled)
      .map((module: { enabled: boolean; id: string }) => module.id);
    const disabledModuleIds = manifest.modules
      .filter((module: { enabled: boolean; id: string }) => !module.enabled)
      .map((module: { enabled: boolean; id: string }) => module.id);

    expect(agentsContent).toContain('pnpm quality:check');
    expect(agentsContent).toContain('Conventional Commits');
    expect(agentsContent).toContain('Treat `dev` as the integration branch');
    expect(agentsContent).toContain('skills/resource-*');
    expect(agentsContent).toContain('pnpm resources:classify');
    expect(agentsContent).toContain('pnpm resources:intake');
    expect(agentsContent).toContain('DevSvc Dashboard-hosted Axi tool');
    expect(agentsContent).toContain('config/axi-dashboard-app.json');
    expect(modulesConfig.version).toBe(1);
    expect(modulesConfig.modules['workspace-core'].enabled).toBe(true);
    expect(modulesConfig.modules['ui-components'].enabled).toBe(false);
    expect(modulesConfig.modules['experimental-slot-shell'].enabled).toBe(false);
    expect(manifest.version).toBe(2);
    expect(enabledModuleIds).toContain('workspace-core');
    expect(enabledModuleIds).toContain('theme-preset');
    expect(enabledModuleIds).toContain('theme-style-minimal');
    expect(enabledModuleIds).toContain('theme-style-cyberpunk');
    expect(enabledModuleIds).toContain('theme-style-glassmorphism');
    expect(enabledModuleIds).toContain('style-system');
    expect(disabledModuleIds).toContain('ui-components');
    expect(disabledModuleIds).toContain('hooks-pack');
    expect(disabledModuleIds).toContain('experimental-slot-shell');
    expect(packageJson.scripts['branch:check']).toBe('node ./scripts/check-git-branch.mjs');
    expect(packageJson.scripts['test:coverage']).toBe('pnpm test:web:coverage && pnpm test:api');
    expect(packageJson.scripts.commit).toBe('pnpm exec cz');
    expect(packageJson.scripts['commit:check:last']).toBe(
      'pnpm exec commitlint --last --verbose',
    );
    expect(packageJson.scripts['commit:lint:range']).toBe(
      'node ./scripts/check-commit-range.mjs',
    );
    expect(packageJson.scripts['git:bootstrap']).toBe(
      'node ./scripts/setup-git-governance.mjs',
    );
    expect(packageJson.scripts['governance:check']).toBe(
      'pnpm branch:check && pnpm docs:check',
    );
    expect(packageJson.scripts['pr:title:check']).toBe('node ./scripts/check-pr-title.mjs');
    expect(packageJson.scripts['resources:create:public']).toBe(
      'node ./scripts/resources-bucket.mjs public',
    );
    expect(packageJson.scripts['resources:create:private']).toBe(
      'node ./scripts/resources-bucket.mjs private',
    );
    expect(packageJson.scripts['resources:batch-intake']).toBe(
      'node ./scripts/resources-batch-intake.mjs',
    );
    expect(packageJson.scripts['resources:classify']).toBe(
      'node ./scripts/resources-classify.mjs',
    );
    expect(packageJson.scripts['resources:delete']).toBe('node ./scripts/resources-delete.mjs');
    expect(packageJson.scripts['resources:get']).toBe('node ./scripts/resources-get.mjs');
    expect(packageJson.scripts['resources:fetch']).toBe('node ./scripts/resources-fetch.mjs');
    expect(packageJson.scripts['resources:gc']).toBe('node ./scripts/resources-gc.mjs');
    expect(packageJson.scripts['resources:index:public']).toBe(
      'node ./scripts/resources-index.mjs public',
    );
    expect(packageJson.scripts['resources:index:private']).toBe(
      'node ./scripts/resources-index.mjs private',
    );
    expect(packageJson.scripts['resources:intake']).toBe(
      'node ./scripts/resources-intake.mjs',
    );
    expect(packageJson.scripts['resources:plan:public']).toBe(
      'node ./scripts/resources-sync.mjs public --dry-run',
    );
    expect(packageJson.scripts['resources:query']).toBe('node ./scripts/resources-query.mjs');
    expect(packageJson.scripts['resources:review']).toBe('node ./scripts/resources-review.mjs');
    expect(packageJson.scripts['resources:put']).toBe('node ./scripts/resources-put.mjs');
    expect(packageJson.scripts['resources:sync:private']).toBe(
      'node ./scripts/resources-sync.mjs private',
    );
    expect(packageJson.scripts['tokens:build']).toBe(`pnpm --filter @project-root/tokens build`);
    expect(packageJson.config.commitizen.path).toBe('cz-git');
    expect(packageJson.devDependencies['@commitlint/cli']).toBe('^19.8.1');
    expect(packageJson.devDependencies['@commitlint/config-conventional']).toBe('^19.8.1');
    expect(packageJson.devDependencies['ali-oss']).toBe('^6.23.0');
    expect(packageJson.devDependencies.commitizen).toBe('^4.3.1');
    expect(packageJson.devDependencies['cz-git']).toBe('^1.11.0');
    expect(packageJson.devDependencies['sql.js']).toBe('^1.14.1');
    expect(npmrc).toContain('@axi:registry=http://127.0.0.1:4873/');
    expect(webPackageJson.dependencies['@axi/core']).toBe('^0.2.1');
    expect(webPackageJson.dependencies['@axi/shell']).toBe('^0.1.0');
    expect(webPackageJson.dependencies['@axi/tokens']).toBe('^0.2.0');
    expect(tokensPackageJson.sass).toBe('./dist/scss/_tokens.scss');
    expect(globalStyles).toContain("@use 'tokens' as tokens;");
    expect(viteConfig).toContain('chunkSizeWarningLimit: 1024');
    expect(viteConfig).toContain("process.env.AXI_APP_BASE");
    expect(viteConfig).toContain("loadPaths: [path.resolve(rootDir, '../../packages/tokens/dist/scss')]");
    expect(viteConfig).toContain("publicDir: path.resolve(rootDir, '../../resources/public/web')");
    expect(gitignore).toContain('resources/private/*');
    expect(gitignore).toContain('!resources/private/README.md');
    expect(gitignore).toContain('.env.resources.local');
    expect(gitignore).toContain('.axi/resource-index.sqlite');
    expect(gitignore).toContain('.axi/resource-index.sqlite-wal');
    expect(envResourcesExample).toContain('AXI_ALIYUN_OSS_ACCESS_KEY_ID=');
    expect(envResourcesExample).toContain('AXI_ALIYUN_OSS_PUBLIC_BUCKET=');
    expect(resourceClassificationConfig.laneDefaults.public.tags).toEqual(['public', 'web']);
    expect(resourceClassificationConfig.intake.defaultLane).toBe('private');
    expect(resourceClassificationConfig.intake.laneRules[0].lane).toBe('public');
    expect(resourceClassificationConfig.intake.laneRules[0].matchPrefixes).toContain('brand');
    expect(resourceClassificationConfig.intake.laneRules[3].lane).toBe('private');
    expect(resourceClassificationConfig.intake.laneRules[3].reviewTags).toContain(
      'review:license',
    );
    expect(resourceClassificationConfig.rules[0].category).toBe('brand');
    expect(resourceClassificationConfig.rules[0].tags).toContain('logo');
    expect(resourceStorageConfig.providers.aliyunOss.type).toBe('aliyun-oss');
    expect(resourceStorageConfig.providers.aliyunOss.accessKeyIdEnv).toBe(
      'AXI_ALIYUN_OSS_ACCESS_KEY_ID',
    );
    expect(resourceStorageConfig.providers.aliyunOss.region).toBe('oss-cn-hangzhou');
    expect(resourceStorageConfig.catalog.databasePath).toBe('.axi/resource-index.sqlite');
    expect(resourceStorageConfig.catalog.hashPathSegments).toEqual([2, 2]);
    expect(resourceStorageConfig.catalog.objectKeyStrategy).toBe('sha256');
    expect(resourceStorageConfig.catalog.projectNamespace).toBe('project-root');
    expect(resourceStorageConfig.catalog.remoteRootPrefix).toBe('projects');
    expect(resourceStorageConfig.catalog.remoteObjectDir).toBe('objects');
    expect(resourceStorageConfig.catalog.remoteIndexDir).toBe('index');
    expect(resourceStorageConfig.lanes.public.sourceDir).toBe('resources/public/web');
    expect(resourceStorageConfig.lanes.public.acl).toBe('private');
    expect(resourceStorageConfig.lanes.private.bucketEnv).toBe('AXI_ALIYUN_OSS_PRIVATE_BUCKET');
    expect(resourceStorageConfig.lanes.private.acl).toBe('private');
    expect(JSON.stringify(resourceStorageConfig)).not.toContain('AKLTMmY0');
    expect(JSON.stringify(resourceStorageConfig)).not.toContain('TkdKaU5q');
    expect(webIndexHtml).toContain('/brand/axi-trident-icon.svg');
    expect(brandAsset).toContain('viewBox="-78 -78 156 180"');
    expect(brandAsset).toContain('fill="#111111"');
    expect(webApp).toContain("AxiThemeProvider");
    expect(webApp).toContain("AxiDashboardShell");
    expect(webApp).toContain("AxiHostedAppProvider");
    expect(webApp).toContain("createAxiHostedAppContext(import.meta.env)");
    expect(webApp).not.toContain("AxiAdminShell");
    expect(axiAppManifest).toContain("appId: 'project-root'");
    expect(axiAppManifest).toContain("menuGroups");
    expect(axiAppManifest).toContain("capabilities: ['web', 'tool', 'dashboard-hosted']");
    expect(axiAppManifest).toContain("hostedMode: true");
    expect(axiAppManifest).toContain("nativeFallback: false");
    expect(dashboardAppConfig.appId).toBe('project-root');
    expect(dashboardAppConfig.cwd).toBe('${workspaceRoot}/projects/project-root');
    expect(dashboardAppConfig.startCommand).toContain(
      '${workspaceRoot}/scripts/run-node22-command.sh pnpm --filter @project-root/tokens build',
    );
    expect(dashboardAppConfig.startCommand).toContain(
      'pnpm --filter @project-root/web dev -- --host 127.0.0.1 --port ${port} --strictPort',
    );
    expect(dashboardAppConfig.packageManager).toBe('pnpm');
    expect(dashboardAppConfig.defaultRoute).toBe('/overview');
    expect(dashboardAppConfig.routes).toEqual(['/overview', '/quality', '/settings']);
    expect(dashboardAppConfig.menuGroups[0].children[0].route).toBe('/overview');
    expect(dashboardAppConfig.capabilities).toContain('dashboard-hosted');
    expect(dashboardAppConfig.hostedMode).toBe(true);
    expect(dashboardAppConfig.nativeFallback).toBe(false);
    expect(homePage).toContain("<h1 className=\"home-title\">项目总览</h1>");
    expect(homePage).not.toContain("AxiLogoMark");
    expect(files).not.toContain('apps/web/src/shared/branding/AxiLogoMark.tsx');
    expect(generatedReadme).toContain('resources/public/web');
    expect(generatedReadme).toContain('resources/private');
    expect(generatedReadme).toContain('PR-centric GitHub Flow profile');
    expect(generatedReadme).toContain('`dev` is the integration branch');
    expect(generatedReadme).toContain('`main` is the production release branch');
    expect(generatedReadme).toContain('pnpm git:bootstrap');
    expect(generatedReadme).toContain('pnpm commit');
    expect(generatedReadme).toContain('docs/BRANCH_PROTECTION.md');
    expect(generatedReadme).toContain('docs/OPERATIONS.md');
    expect(generatedReadme).toContain('docs/AXI_DASHBOARD_HOSTING.md');
    expect(generatedReadme).toContain('docs/RELEASE_OPERATIONS.md');
    expect(generatedReadme).toContain('config/axi-dashboard-app.json');
    expect(generatedReadme).toContain('DevSvc Dashboard');
    expect(generatedReadme).toContain('${workspaceRoot}/projects/project-root');
    expect(generatedReadme).toContain('Use Tauri as an optional desktop shell');
    expect(generatedReadme).toContain('Swift, SwiftUI, or AppKit only');
    expect(generatedReadme).toContain('config/resource-storage.config.json');
    expect(generatedReadme).toContain('Alibaba Cloud OSS-backed');
    expect(generatedReadme).toContain('ensures buckets exist before upload');
    expect(generatedReadme).toContain('auto-generate a shared private bucket per lane');
    expect(generatedReadme).toContain('.axi/resource-index.sqlite');
    expect(generatedReadme).toContain('hashed OSS keys');
    expect(generatedReadme).toContain('projects/project-root/objects');
    expect(generatedReadme).toContain('projects/project-root/objects/<lane>/sha256');
    expect(generatedReadme).toContain('projects/project-root/index');
    expect(generatedReadme).toContain('config/resource-classification.config.json');
    expect(generatedReadme).toContain('resources:batch-intake');
    expect(generatedReadme).toContain('resources:classify');
    expect(generatedReadme).toContain('resources:intake');
    expect(generatedReadme).toContain('resources:review');
    expect(generatedReadme).toContain('skills/resource-intake');
    expect(generatedReadme).toContain('resources:put');
    expect(generatedReadme).toContain('resources:get');
    expect(contributingGuide).toContain('`dev`: the default integration branch');
    expect(contributingGuide).toContain('`main`: the protected production release branch');
    expect(contributingGuide).toContain('Conventional Commits');
    expect(contributingGuide).toContain('docs/BRANCH_PROTECTION.md');
    expect(contributingGuide).toContain('docs/OPERATIONS.md');
    expect(contributingGuide).toContain('docs/RELEASE_OPERATIONS.md');
    expect(commitlintConfig).toContain("@commitlint/config-conventional");
    expect(commitlintConfig).toContain("'type-enum'");
    expect(commitizenConfig.alias.ft).toBe('feat');
    expect(commitizenConfig.types.some((entry: { value: string }) => entry.value === 'feat')).toBe(
      true,
    );
    expect(commitMsgHook).toContain('pnpm exec commitlint --edit "$1"');
    expect(checkBranchScript).toContain('ALLOWED_BRANCH_PATTERN');
    expect(checkBranchScript).toContain('feature/<slug>');
    expect(checkCommitRangeScript).toContain('commitlint');
    expect(checkCommitRangeScript).toContain('--from');
    expect(checkPrTitleScript).toContain('Conventional Commits');
    expect(setupGitGovernanceScript).toContain("git(['init', '-b', 'dev'])");
    expect(setupGitGovernanceScript).toContain("git(['config', 'core.hooksPath', '.githooks'])");
    expect(githubFlowDoc).toContain('Pull Request-centric GitHub Flow profile');
    expect(githubFlowDoc).toContain('`dev`: default integration branch');
    expect(githubFlowDoc).toContain('`main`: protected production release branch');
    expect(githubFlowDoc).toContain('`hotfix/<slug>`');
    expect(architectureDoc).toContain('## Dashboard Host');
    expect(architectureDoc).toContain('config/axi-dashboard-app.json');
    expect(architectureDoc).toContain('/apps/project-root/*');
    expect(dashboardHostingDoc).toContain(
      'This scaffold is generated as a Dashboard-hosted Axi tool first',
    );
    expect(dashboardHostingDoc).toContain('config/axi-dashboard-app.json');
    expect(dashboardHostingDoc).toContain('${workspaceRoot}/projects/project-root');
    expect(dashboardHostingDoc).toContain('AXI_APP_BASE');
    expect(dashboardHostingDoc).toContain('Swift, SwiftUI, and AppKit');
    expect(operationsDoc).toContain('This document is the entrypoint for repository operations');
    expect(operationsDoc).toContain('docs/GITHUB_FLOW.md');
    expect(operationsDoc).toContain('docs/RELEASE_OPERATIONS.md');
    expect(operationsDoc).toContain('Module Update');
    expect(operationsDoc).toContain('Resource Operations');
    expect(branchProtectionDoc).toContain('protect `dev`');
    expect(branchProtectionDoc).toContain('protect `main`');
    expect(branchProtectionDoc).toContain('`governance`');
    expect(branchProtectionDoc).toContain('`quality`');
    expect(commitConventionDoc).toContain('<type>[optional scope]: <subject>');
    expect(commitConventionDoc).toContain('`pnpm commit`');
    expect(commitConventionDoc).toContain('`pnpm commit:lint:range -- --from <sha> --to <sha>`');
    expect(qualityGateDoc).toContain('pnpm branch:check');
    expect(qualityGateDoc).toContain('pnpm pr:title:check');
    expect(qualityGateDoc).toContain('commit-msg');
    expect(qualityGateDoc).toContain('default integration branch');
    expect(qualityGateDoc).toContain('require the `governance` and `quality` jobs');
    expect(releaseOperationsDoc).toContain('Open a Pull Request from `dev` into `main`');
    expect(releaseOperationsDoc).toContain('Branch from `main` with `hotfix/<slug>`');
    expect(releaseOperationsDoc).toContain('Merge or cherry-pick the same fix back into `dev`');
    expect(ciWorkflow).toContain('governance:');
    expect(ciWorkflow).toContain('- dev');
    expect(ciWorkflow).toContain('- main');
    expect(ciWorkflow).toContain('check-pr-title.mjs');
    expect(ciWorkflow).toContain('check-commit-range.mjs');
    expect(ciWorkflow).toContain('needs: governance');
    expect(pullRequestTemplate).toContain('## Governance');
    expect(pullRequestTemplate).toContain('PR title follows Conventional Commits');
    expect(resourceManagementDoc).toContain('Keep actual secrets in `.env.resources.local`');
    expect(resourceManagementDoc).toContain('Both generated OSS lanes default to private bucket access');
    expect(resourceManagementDoc).toContain('resource-classification.config.json');
    expect(resourceManagementDoc).toContain('docs/RESOURCE_AGENT_SKILLS.md');
    expect(resourceManagementDoc).toContain('Shared bucket reuse is the default');
    expect(resourceAgentSkillsDoc).toContain('skills/resource-intake/SKILL.md');
    expect(resourceAgentSkillsDoc).toContain('resources:batch-intake');
    expect(resourceAgentSkillsDoc).toContain('resources:classify');
    expect(resourceAgentSkillsDoc).toContain('resources:intake');
    expect(resourceAgentSkillsDoc).toContain('resources:review');
    expect(resourceIndexDoc).toContain('.axi/resource-index.sqlite');
    expect(resourceIndexDoc).toContain('category_path');
    expect(resourceIndexDoc).toContain('classification_reason');
    expect(resourceIndexDoc).toContain('needs_review');
    expect(resourceIndexDoc).toContain('tags');
    expect(resourceIndexDoc).toContain('resources:batch-intake');
    expect(resourceIndexDoc).toContain('resources:classify -- --file C:/path/to/file.svg --path brand/logo.svg');
    expect(resourceIndexDoc).toContain('resources:intake -- --file C:/path/to/file.svg --path brand/logo.svg');
    expect(resourceIndexDoc).toContain('resources:review -- --lane private');
    expect(resourceIndexDoc).toContain('resources:fetch -- public --sha256 <hash> --output ./tmp/logo.svg');
    expect(resourceIndexDoc).toContain('resources:query -- --category brand --all');
    expect(resourceIndexDoc).toContain('projects/<project>/objects/<lane>/sha256');
    expect(resourceIndexDoc).toContain('projects/<project>/index/<lane>/catalog.latest.json');
    expect(resourceStorageDoc).toContain('Alibaba Cloud OSS');
    expect(resourceStorageDoc).toContain('resources:batch-intake');
    expect(resourceStorageDoc).toContain('resources:classify');
    expect(resourceStorageDoc).toContain('resources:intake');
    expect(resourceStorageDoc).toContain('resources:review');
    expect(resourceStorageDoc).toContain('public bucket ACL: `private` by default');
    expect(resourceStorageDoc).toContain('ensures the target bucket exists before uploading files');
    expect(resourceStorageDoc).toContain('resources:fetch');
    expect(resourceStorageDoc).toContain('resources:put');
    expect(resourceStorageDoc).toContain('resources:get');
    expect(resourceStorageDoc).toContain('resources:delete');
    expect(resourceStorageDoc).toContain('resources:gc');
    expect(resourceStorageDoc).toContain('resource-classification.config.json');
    expect(resourceStorageDoc).toContain('resources:index:*');
    expect(resourceStorageDoc).toContain('Object keys are derived from file sha256');
    expect(resourceStorageDoc).toContain('Category lookup stays local in SQLite');
    expect(resourceStorageDoc).toContain('defaults to region `oss-cn-hangzhou`');
    expect(resourceStorageDoc).toContain('auto-generate a shared private bucket name per lane');
    expect(resourceStorageDoc).toContain('resolved bucket and region are written back into `config/resource-storage.config.json`');
    expect(resourceStorageDoc).toContain('projects/<project>/objects/<lane>/sha256');
    expect(resourceStorageDoc).toContain('projects/<project>/index/<lane>/catalog.latest.json');
    expect(resourceStorageDoc).toContain('Browser-side upload flows should use STS or pre-signed URL');
    expect(resourceStorageDoc).toContain('Persist review-needed decisions in the local catalog');
    expect(resourceStorageScript).toContain("import OSS from 'ali-oss';");
    expect(resourceStorageScript).toContain("import { createHash } from 'node:crypto';");
    expect(resourceStorageScript).toContain("import initSqlJs from 'sql.js';");
    expect(resourceStorageScript).toContain("import { createRequire } from 'node:module';");
    expect(resourceStorageScript).toContain("provider.type !== 'aliyun-oss'");
    expect(resourceStorageScript).toContain('buildAutoBucketName');
    expect(resourceStorageScript).toContain('buildHashedObjectKey');
    expect(resourceStorageScript).toContain('buildProjectNamespacePrefix');
    expect(resourceStorageScript).toContain('buildLaneObjectPrefix');
    expect(resourceStorageScript).toContain('buildLaneIndexPrefix');
    expect(resourceStorageScript).toContain('publishRemoteCatalogIndex');
    expect(resourceStorageScript).toContain('buildCategoryPath');
    expect(resourceStorageScript).toContain('buildClassificationPath');
    expect(resourceStorageScript).toContain('chooseIntakeLane');
    expect(resourceStorageScript).toContain('matchMimePrefixes');
    expect(resourceStorageScript).toContain('classification_reason');
    expect(resourceStorageScript).toContain('needs_review');
    expect(resourceStorageScript).toContain('readResourceClassificationConfig');
    expect(resourceStorageScript).toContain('asset_tags');
    expect(resourceStorageScript).toContain('persistCatalogDatabase');
    expect(resourceStorageScript).toContain('classifyResourceFile');
    expect(resourceStorageScript).toContain('reviewResourceCatalog');
    expect(resourceStorageScript).toContain('intakeResourceBatch');
    expect(resourceStorageScript).toContain('intakeResourceFile');
    expect(resourceStorageScript).toContain('putResourceFile');
    expect(resourceStorageScript).toContain('deleteResourceObject');
    expect(resourceStorageScript).toContain('garbageCollectResourceCatalog');
    expect(resourceStorageScript).toContain('queryResourceCatalog');
    expect(resourceStorageScript).toContain('readResourceObject');
    expect(resourceStorageScript).toContain('source_relative_path');
    expect(resourceStorageScript).toContain('size_bytes');
    expect(resourceStorageScript).toContain('category_path');
    expect(resourceStorageScript).toContain('client.put(');
    expect(resourceStorageScript).toContain('putBucket');
    expect(resourceStorageScript).toContain('ensureStringAllowEmpty');
    expect(resourceStorageScript).toContain('persistResolvedResourceConfig');
    expect(resourceStorageScript).toContain('rawLane.bucket = resolved.bucket');
    expect(resourceStorageScript).toContain('rawProvider.region = resolved.region');
    expect(resourceStorageScript).toContain('catalog.projectNamespace');
    expect(resourceStorageScript).toContain('catalog.remoteRootPrefix');
    expect(resourceStorageScript).toContain('catalog.remoteIndexDir');
    expect(resourceStorageScript).toContain('catalog.remoteObjectDir');
    expect(resourceStorageScript).toContain('region,');
    expect(resourceStorageScript).toContain('await createResourceBucketLane(laneName, {');
    expect(resourceStorageScript).toContain('persist: options.persist');
    expect(resourceBatchIntakeScript).toContain('intakeResourceBatch');
    expect(resourceBatchIntakeScript).toContain('--continue-on-error');
    expect(resourceBucketScript).toContain('--bucket <name>');
    expect(resourceBucketScript).toContain('--region <id>');
    expect(resourceBucketScript).toContain('createResourceBucketLane');
    expect(resourceClassifyScript).toContain('classifyResourceFile');
    expect(resourceClassifyScript).toContain('--path <classificationPath>');
    expect(resourceDeleteScript).toContain('deleteResourceObject');
    expect(resourceFetchScript).toContain('readResourceObject');
    expect(resourceFetchScript).toContain('--sha256 <hash>');
    expect(resourceGcScript).toContain('garbageCollectResourceCatalog');
    expect(resourceGetScript).toContain('readResourceObject');
    expect(resourceIndexScript).toContain('indexResourceLane');
    expect(resourceIntakeScript).toContain('intakeResourceFile');
    expect(resourceIntakeScript).toContain('--file <path>');
    expect(resourcePutScript).toContain('putResourceFile');
    expect(resourcePutScript).toContain('--file <path>');
    expect(resourcePutScript).toContain('--path <classificationPath>');
    expect(resourceQueryScript).toContain('queryResourceCatalog');
    expect(resourceQueryScript).toContain('--key');
    expect(resourceQueryScript).toContain('--tag');
    expect(resourceQueryScript).toContain('--tag-mode');
    expect(resourceQueryScript).toContain('--needs-review');
    expect(resourceReviewScript).toContain('reviewResourceCatalog');
    expect(resourceReviewScript).toContain('--all-status');
    expect(resourceSyncScript).toContain('--bucket <name>');
    expect(resourceSyncScript).toContain('--region <id>');
    expect(resourceSyncScript).toContain('syncResourceLane');
    expect(resourceIntakeSkill).toContain('name: resource-intake');
    expect(resourceIntakeSkill).toContain('pnpm resources:batch-intake');
    expect(resourceIntakeSkill).toContain('pnpm resources:classify');
    expect(resourceReviewSkill).toContain('name: resource-review');
    expect(resourceReviewSkill).toContain('pnpm resources:review');
    expect(resourceReviewSkill).toContain('delete-and-reintake');
    expect(resourceRehydrateSkill).toContain('name: resource-rehydrate');
    expect(resourceRehydrateSkill).toContain('--tag-mode all');
    expect(resourceRehydrateSkill).toContain('pnpm resources:get');
    expect(featureHook).toContain('startTransition');
    expect(pyProject).toContain('--cov-fail-under=80');
    expect(themeCss).toContain('color-mix(');
    expect(themeCss).toContain('--theme-bg-page: var(--color-bg-page);');
    expect(themeCss).toContain('--theme-button-primary-bg: var(--color-accent-primary);');
    expect(themeCss).toContain('--theme-shadow-sm: var(--theme-mode-light-shadow-sm);');
    expect(themeCss).toContain('--theme-name: dark;');
    expect(themeCss).not.toContain('--color-border-default: var(--theme-preset-');
    expect(themePreferences).toContain('document.documentElement.dataset.theme = mode;');
    expect(themeCompatibilityHook).toContain('export function useTheme()');
    expect(themeCompatibilityHook).toContain('export function useDarkMode()');
    expect(themeSwitcher).toContain('export function ThemeSwitcher()');
    expect(themeSwitcher).toContain('Combine the light or dark core mode with a visual preset');
    expect(foundationBreakpoint.breakpoint.xl.value).toBe('1280px');
    expect(foundationColorScale.color.primary.main.value).toBe('#0ea5e9');
    expect(foundationColorScale.color.success.main.value).toBe('#22c55e');
    expect(foundationSemanticColor.color.bg.page.value).toBe('#fafafa');
    expect(foundationSemanticColor.color.state.error.value).toBe('#ef4444');
    expect(foundationSpacingSemantic.page.paddingX.value).toBe('1.5rem');
    expect(foundationSpacingSemantic.topbar.height.value).toBe('4rem');
    expect(foundationZIndex.z.modal.value).toBe('1050');
    expect(themeModes.themeMode.light.color.surface.panelBase).toBeDefined();
    expect(themeModes.themeMode.light.color.bg.page).toBeDefined();
    expect(themeModes.themeMode.light.color.surface.panel).toBeUndefined();
    expect(minimalPreset.themePreset.minimal.color.surface.tint).toBeDefined();
    expect(themeRegistry).toContain("id: 'cyberpunk'");
    expect(tokenSystemDoc).toContain('theme mode and theme preset are two independent dimensions');
    expect(tokenSystemDoc).toContain("Use the root entrypoint with `@use 'tokens' as tokens;`");
    expect(tokenSystemDoc).toContain('Treat JSON as the source of truth');
  });

  it('generates a named project directory from create mode', async () => {
    const tempDir = await createTempDir('axi-create-');
    tempDirs.push(tempDir);

    await runCli(['demo-space', '--yes', '--no-install', '--no-verify'], {
      cwd: tempDir,
      invokedName: 'create-axi-app',
    });

    const generatedReadme = await readText(path.join(tempDir, 'demo-space', 'README.md'));

    expect(generatedReadme).toContain('# demo-space');
  });

  it('rejects non-empty directories', async () => {
    const tempDir = await createTempDir('axi-protect-');
    tempDirs.push(tempDir);

    await writeFile(path.join(tempDir, 'existing.txt'), 'do not overwrite', 'utf8');

    await expect(
      runCli(['init', '--yes', '--no-install', '--cwd', tempDir], {
        cwd: process.cwd(),
        invokedName: 'axi',
      }),
    ).rejects.toThrow(/Target directory must be empty/);
  });

  it('adds opt-in resource modules to an existing scaffold', async () => {
    const tempDir = await createTempDir('axi-add-');
    tempDirs.push(tempDir);

    await runCli(['init', '--yes', '--no-install', '--cwd', tempDir], {
      cwd: process.cwd(),
      invokedName: 'axi',
    });

    await runCli(
      ['add', 'ui-components', 'hooks-pack', 'experimental-slot-shell', '--no-install', '--cwd', tempDir],
      {
        cwd: process.cwd(),
        invokedName: 'axi',
      },
    );

    const manifest = JSON.parse(await readText(path.join(tempDir, '.axi/scaffold.manifest.json')));
    const modulesConfig = JSON.parse(await readText(path.join(tempDir, '.axi/modules.json')));
    const modulesDoc = await readText(path.join(tempDir, 'docs/MODULES.md'));
    const files = await listRelativeFiles(tempDir);
    const enabledModuleIds = manifest.modules
      .filter((module: { enabled: boolean; id: string }) => module.enabled)
      .map((module: { enabled: boolean; id: string }) => module.id);

    expect(enabledModuleIds).toContain('ui-components');
    expect(enabledModuleIds).toContain('hooks-pack');
    expect(enabledModuleIds).toContain('experimental-slot-shell');
    expect(modulesConfig.modules['ui-components'].enabled).toBe(true);
    expect(modulesConfig.modules['hooks-pack'].enabled).toBe(true);
    expect(modulesConfig.modules['experimental-slot-shell'].enabled).toBe(true);
    expect(modulesDoc).toContain('ui-components');
    expect(modulesDoc).toContain('hooks-pack');
    expect(modulesDoc).toContain('experimental-slot-shell');
    expect(modulesDoc).toContain('Installed Foundation Modules');
    expect(modulesDoc).toContain('Available Experimental Modules');
    expect(files).toContain('apps/web/src/shared/components/index.ts');
    expect(files).toContain('apps/web/src/shared/components/Accordion.tsx');
    expect(files).toContain('apps/web/src/shared/components/accordion.css');
    expect(files).toContain('apps/web/src/shared/components/Alert.tsx');
    expect(files).toContain('apps/web/src/shared/components/alert.css');
    expect(files).toContain('apps/web/src/shared/components/Avatar.tsx');
    expect(files).toContain('apps/web/src/shared/components/avatar.css');
    expect(files).toContain('apps/web/src/shared/components/Badge.tsx');
    expect(files).toContain('apps/web/src/shared/components/badge.css');
    expect(files).toContain('apps/web/src/shared/components/Breadcrumbs.tsx');
    expect(files).toContain('apps/web/src/shared/components/breadcrumbs.css');
    expect(files).toContain('apps/web/src/shared/components/Button.tsx');
    expect(files).toContain('apps/web/src/shared/components/button.css');
    expect(files).toContain('apps/web/src/shared/components/Card.tsx');
    expect(files).toContain('apps/web/src/shared/components/card.css');
    expect(files).toContain('apps/web/src/shared/components/ChipInput.tsx');
    expect(files).toContain('apps/web/src/shared/components/chip-input.css');
    expect(files).toContain('apps/web/src/shared/components/Combobox.tsx');
    expect(files).toContain('apps/web/src/shared/components/combobox.css');
    expect(files).toContain('apps/web/src/shared/components/CommandPalette.tsx');
    expect(files).toContain('apps/web/src/shared/components/command-palette.css');
    expect(files).toContain('apps/web/src/shared/components/ContextMenu.tsx');
    expect(files).toContain('apps/web/src/shared/components/context-menu.css');
    expect(files).toContain('apps/web/src/shared/components/DataTable.tsx');
    expect(files).toContain('apps/web/src/shared/components/data-table.css');
    expect(files).toContain('apps/web/src/shared/components/DatePicker.tsx');
    expect(files).toContain('apps/web/src/shared/components/date-picker.css');
    expect(files).toContain('apps/web/src/shared/components/DescriptionList.tsx');
    expect(files).toContain('apps/web/src/shared/components/description-list.css');
    expect(files).toContain('apps/web/src/shared/components/DropdownMenu.tsx');
    expect(files).toContain('apps/web/src/shared/components/dropdown-menu.css');
    expect(files).toContain('apps/web/src/shared/components/Drawer.tsx');
    expect(files).toContain('apps/web/src/shared/components/drawer.css');
    expect(files).toContain('apps/web/src/shared/components/EmptyState.tsx');
    expect(files).toContain('apps/web/src/shared/components/empty-state.css');
    expect(files).toContain('apps/web/src/shared/components/EmptySearchState.tsx');
    expect(files).toContain('apps/web/src/shared/components/empty-search-state.css');
    expect(files).toContain('apps/web/src/shared/components/FileTrigger.tsx');
    expect(files).toContain('apps/web/src/shared/components/file-trigger.css');
    expect(files).toContain('apps/web/src/shared/components/FormField.tsx');
    expect(files).toContain('apps/web/src/shared/components/form-field.css');
    expect(files).toContain('apps/web/src/shared/components/InputField.tsx');
    expect(files).toContain('apps/web/src/shared/components/input-field.css');
    expect(files).toContain('apps/web/src/shared/components/InlineActions.tsx');
    expect(files).toContain('apps/web/src/shared/components/inline-actions.css');
    expect(files).toContain('apps/web/src/shared/components/Modal.tsx');
    expect(files).toContain('apps/web/src/shared/components/modal.css');
    expect(files).toContain('apps/web/src/shared/components/NumberField.tsx');
    expect(files).toContain('apps/web/src/shared/components/number-field.css');
    expect(files).toContain('apps/web/src/shared/components/Pagination.tsx');
    expect(files).toContain('apps/web/src/shared/components/pagination.css');
    expect(files).toContain('apps/web/src/shared/components/PasswordField.tsx');
    expect(files).toContain('apps/web/src/shared/components/password-field.css');
    expect(files).toContain('apps/web/src/shared/components/Progress.tsx');
    expect(files).toContain('apps/web/src/shared/components/progress.css');
    expect(files).toContain('apps/web/src/shared/components/SearchField.tsx');
    expect(files).toContain('apps/web/src/shared/components/search-field.css');
    expect(files).toContain('apps/web/src/shared/components/SegmentedControl.tsx');
    expect(files).toContain('apps/web/src/shared/components/segmented-control.css');
    expect(files).toContain('apps/web/src/shared/components/Skeleton.tsx');
    expect(files).toContain('apps/web/src/shared/components/skeleton.css');
    expect(files).toContain('apps/web/src/shared/components/Spinner.tsx');
    expect(files).toContain('apps/web/src/shared/components/spinner.css');
    expect(files).toContain('apps/web/src/shared/components/StatCard.tsx');
    expect(files).toContain('apps/web/src/shared/components/stat-card.css');
    expect(files).toContain('apps/web/src/shared/components/Stepper.tsx');
    expect(files).toContain('apps/web/src/shared/components/stepper.css');
    expect(files).toContain('apps/web/src/shared/components/StatusDot.tsx');
    expect(files).toContain('apps/web/src/shared/components/status-dot.css');
    expect(files).toContain('apps/web/src/shared/components/Switch.tsx');
    expect(files).toContain('apps/web/src/shared/components/switch.css');
    expect(files).toContain('apps/web/src/shared/components/TagPicker.tsx');
    expect(files).toContain('apps/web/src/shared/components/tag-picker.css');
    expect(files).toContain('apps/web/src/shared/components/Tabs.tsx');
    expect(files).toContain('apps/web/src/shared/components/tabs.css');
    expect(files).toContain('apps/web/src/shared/components/TextareaField.tsx');
    expect(files).toContain('apps/web/src/shared/components/textarea-field.css');
    expect(files).toContain('apps/web/src/shared/components/Toast.tsx');
    expect(files).toContain('apps/web/src/shared/components/toast.css');
    expect(files).toContain('apps/web/src/shared/components/Topbar.tsx');
    expect(files).toContain('apps/web/src/shared/components/topbar.css');
    expect(files).toContain('apps/web/src/shared/components/Tooltip.tsx');
    expect(files).toContain('apps/web/src/shared/components/tooltip.css');
    expect(files).toContain('apps/web/src/shared/components/SectionCard.tsx');
    expect(files).toContain('apps/web/src/shared/components/ButtonLink.tsx');
    expect(files).toContain('apps/web/src/shared/components/__tests__/Accordion.test.tsx');
    expect(files).toContain('apps/web/src/shared/components/__tests__/Alert.test.tsx');
    expect(files).toContain('apps/web/src/shared/components/__tests__/Avatar.test.tsx');
    expect(files).toContain('apps/web/src/shared/components/__tests__/Badge.test.tsx');
    expect(files).toContain('apps/web/src/shared/components/__tests__/Breadcrumbs.test.tsx');
    expect(files).toContain('apps/web/src/shared/components/__tests__/Button.test.tsx');
    expect(files).toContain('apps/web/src/shared/components/__tests__/Card.test.tsx');
    expect(files).toContain('apps/web/src/shared/components/__tests__/ChipInput.test.tsx');
    expect(files).toContain('apps/web/src/shared/components/__tests__/Combobox.test.tsx');
    expect(files).toContain('apps/web/src/shared/components/__tests__/CommandPalette.test.tsx');
    expect(files).toContain('apps/web/src/shared/components/__tests__/ContextMenu.test.tsx');
    expect(files).toContain('apps/web/src/shared/components/__tests__/DataTable.test.tsx');
    expect(files).toContain('apps/web/src/shared/components/__tests__/DatePicker.test.tsx');
    expect(files).toContain('apps/web/src/shared/components/__tests__/DescriptionList.test.tsx');
    expect(files).toContain('apps/web/src/shared/components/__tests__/DropdownMenu.test.tsx');
    expect(files).toContain('apps/web/src/shared/components/__tests__/Drawer.test.tsx');
    expect(files).toContain('apps/web/src/shared/components/__tests__/EmptyState.test.tsx');
    expect(files).toContain('apps/web/src/shared/components/__tests__/EmptySearchState.test.tsx');
    expect(files).toContain('apps/web/src/shared/components/__tests__/FileTrigger.test.tsx');
    expect(files).toContain('apps/web/src/shared/components/__tests__/FormField.test.tsx');
    expect(files).toContain('apps/web/src/shared/components/__tests__/InputField.test.tsx');
    expect(files).toContain('apps/web/src/shared/components/__tests__/InlineActions.test.tsx');
    expect(files).toContain('apps/web/src/shared/components/__tests__/Modal.test.tsx');
    expect(files).toContain('apps/web/src/shared/components/__tests__/NumberField.test.tsx');
    expect(files).toContain('apps/web/src/shared/components/__tests__/Pagination.test.tsx');
    expect(files).toContain('apps/web/src/shared/components/__tests__/PasswordField.test.tsx');
    expect(files).toContain('apps/web/src/shared/components/__tests__/Progress.test.tsx');
    expect(files).toContain('apps/web/src/shared/components/__tests__/SearchField.test.tsx');
    expect(files).toContain('apps/web/src/shared/components/__tests__/SegmentedControl.test.tsx');
    expect(files).toContain('apps/web/src/shared/components/__tests__/Skeleton.test.tsx');
    expect(files).toContain('apps/web/src/shared/components/__tests__/Spinner.test.tsx');
    expect(files).toContain('apps/web/src/shared/components/__tests__/StatCard.test.tsx');
    expect(files).toContain('apps/web/src/shared/components/__tests__/Stepper.test.tsx');
    expect(files).toContain('apps/web/src/shared/components/__tests__/StatusDot.test.tsx');
    expect(files).toContain('apps/web/src/shared/components/__tests__/Switch.test.tsx');
    expect(files).toContain('apps/web/src/shared/components/__tests__/TagPicker.test.tsx');
    expect(files).toContain('apps/web/src/shared/components/__tests__/Tabs.test.tsx');
    expect(files).toContain('apps/web/src/shared/components/__tests__/TextareaField.test.tsx');
    expect(files).toContain('apps/web/src/shared/components/__tests__/Toast.test.tsx');
    expect(files).toContain('apps/web/src/shared/components/__tests__/Topbar.test.tsx');
    expect(files).toContain('apps/web/src/shared/components/__tests__/Tooltip.test.tsx');
    expect(files).toContain('apps/web/src/shared/hooks/index.ts');
    expect(files).toContain('apps/web/src/shared/hooks/useMounted.ts');
    expect(files).toContain('apps/web/src/shared/hooks/useLocalStorageState.ts');
    expect(files).toContain('apps/web/src/shared/hooks/useMediaQuery.ts');
    expect(files).toContain('apps/web/src/shared/hooks/useBreakpoints.ts');
    expect(files).toContain('apps/web/src/shared/hooks/__tests__/useMounted.test.ts');
    expect(files).toContain('apps/web/src/shared/hooks/__tests__/useLocalStorageState.test.ts');
    expect(files).toContain('apps/web/src/shared/hooks/__tests__/useMediaQuery.test.ts');
    expect(files).toContain('apps/web/src/shared/hooks/__tests__/useBreakpoints.test.ts');
    expect(files).toContain('labs/experimental-slot-shell/README.md');
  });

  it('syncs from .axi/modules.json and removes stale managed files for disabled modules', async () => {
    const tempDir = await createTempDir('axi-sync-');
    tempDirs.push(tempDir);

    await runCli(['init', '--yes', '--no-install', '--cwd', tempDir], {
      cwd: process.cwd(),
      invokedName: 'axi',
    });

    const modulesConfigPath = path.join(tempDir, '.axi/modules.json');
    const modulesConfig = JSON.parse(await readText(modulesConfigPath));

    modulesConfig.modules['ui-components'].enabled = true;
    modulesConfig.modules['experimental-slot-shell'].enabled = true;
    modulesConfig.modules['theme-style-cyberpunk'].enabled = false;
    modulesConfig.modules['theme-style-glassmorphism'].enabled = false;

    await writeFile(modulesConfigPath, `${JSON.stringify(modulesConfig, null, 2)}\n`, 'utf8');

    await runCli(['sync', '--no-install', '--cwd', tempDir], {
      cwd: process.cwd(),
      invokedName: 'axi',
    });

    const files = await listRelativeFiles(tempDir);
    const manifest = JSON.parse(await readText(path.join(tempDir, '.axi/scaffold.manifest.json')));
    const syncedModulesConfig = JSON.parse(await readText(modulesConfigPath));
    const themeRegistry = await readText(path.join(tempDir, 'apps/web/src/shared/theme/registry.ts'));
    const enabledModuleIds = manifest.modules
      .filter((module: { enabled: boolean; id: string }) => module.enabled)
      .map((module: { enabled: boolean; id: string }) => module.id);
    const disabledModuleIds = manifest.modules
      .filter((module: { enabled: boolean; id: string }) => !module.enabled)
      .map((module: { enabled: boolean; id: string }) => module.id);

    expect(enabledModuleIds).toContain('ui-components');
    expect(enabledModuleIds).toContain('experimental-slot-shell');
    expect(disabledModuleIds).toContain('theme-style-cyberpunk');
    expect(disabledModuleIds).toContain('theme-style-glassmorphism');
    expect(syncedModulesConfig.modules['ui-components'].enabled).toBe(true);
    expect(syncedModulesConfig.modules['experimental-slot-shell'].enabled).toBe(true);
    expect(syncedModulesConfig.modules['theme-style-cyberpunk'].enabled).toBe(false);
    expect(syncedModulesConfig.modules['theme-style-glassmorphism'].enabled).toBe(false);
    expect(files).toContain('apps/web/src/shared/components/SectionCard.tsx');
    expect(files).toContain('labs/experimental-slot-shell/README.md');
    expect(files).not.toContain('packages/tokens/tokens/theme/presets/cyberpunk/accent.json');
    expect(files).not.toContain('packages/tokens/tokens/theme/presets/glassmorphism/accent.json');
    expect(files).not.toContain('docs/modules/theme-style-cyberpunk.md');
    expect(files).not.toContain('docs/modules/theme-style-glassmorphism.md');
    expect(themeRegistry).toContain("id: 'minimal'");
    expect(themeRegistry).not.toContain("id: 'cyberpunk'");
    expect(themeRegistry).not.toContain("id: 'glassmorphism'");
  });

  it('lists scaffold module state for the current project', async () => {
    const tempDir = await createTempDir('axi-list-');
    tempDirs.push(tempDir);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
      await runCli(['init', '--yes', '--no-install', '--cwd', tempDir], {
        cwd: process.cwd(),
        invokedName: 'axi',
      });

      logSpy.mockClear();

      await runCli(['list', '--cwd', tempDir], {
        cwd: process.cwd(),
        invokedName: 'axi',
      });

      const output = logSpy.mock.calls.map((call) => call.join(' ')).join('\n');

      expect(output).toContain('[axi] project:');
      expect(output).toContain('Foundation Modules');
      expect(output).toContain('Extension Modules');
      expect(output).toContain('Experimental Modules');
      expect(output).toContain('workspace-core [enabled]');
      expect(output).toContain('ui-components [disabled]');
    } finally {
      logSpy.mockRestore();
    }
  });

  it('passes doctor on a healthy scaffold and fails on drift', async () => {
    const tempDir = await createTempDir('axi-doctor-');
    tempDirs.push(tempDir);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
      await runCli(['init', '--yes', '--no-install', '--cwd', tempDir], {
        cwd: process.cwd(),
        invokedName: 'axi',
      });

      logSpy.mockClear();

      await expect(
        runCli(['doctor', '--cwd', tempDir], {
          cwd: process.cwd(),
          invokedName: 'axi',
        }),
      ).resolves.toBeUndefined();

      const healthyOutput = logSpy.mock.calls.map((call) => call.join(' ')).join('\n');
      expect(healthyOutput).toContain('doctor passed');

      const modulesConfigPath = path.join(tempDir, '.axi/modules.json');
      const modulesConfig = JSON.parse(await readText(modulesConfigPath));
      modulesConfig.modules['ui-components'].enabled = true;
      await writeFile(modulesConfigPath, `${JSON.stringify(modulesConfig, null, 2)}\n`, 'utf8');

      await expect(
        runCli(['doctor', '--cwd', tempDir], {
          cwd: process.cwd(),
          invokedName: 'axi',
        }),
      ).rejects.toThrow(/Scaffold drift detected/);
    } finally {
      logSpy.mockRestore();
    }
  });

  it('prints structured json for list and doctor', async () => {
    const tempDir = await createTempDir('axi-json-');
    tempDirs.push(tempDir);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const originalExitCode = process.exitCode;

    try {
      await runCli(['init', '--yes', '--no-install', '--cwd', tempDir], {
        cwd: process.cwd(),
        invokedName: 'axi',
      });

      logSpy.mockClear();

      await runCli(['list', '--json', '--cwd', tempDir], {
        cwd: process.cwd(),
        invokedName: 'axi',
      });

      const listReport = JSON.parse(logSpy.mock.calls.at(-1)?.[0] ?? '{}');
      expect(listReport.projectName).toBe(path.basename(tempDir));
      expect(listReport.state).toBe('in_sync');
      expect(listReport.layers.foundation.some((entry: { id: string }) => entry.id === 'workspace-core')).toBe(true);

      const modulesConfigPath = path.join(tempDir, '.axi/modules.json');
      const modulesConfig = JSON.parse(await readText(modulesConfigPath));
      modulesConfig.modules['ui-components'].enabled = true;
      await writeFile(modulesConfigPath, `${JSON.stringify(modulesConfig, null, 2)}\n`, 'utf8');

      logSpy.mockClear();
      process.exitCode = undefined;

      await runCli(['doctor', '--json', '--cwd', tempDir], {
        cwd: process.cwd(),
        invokedName: 'axi',
      });

      const doctorReport = JSON.parse(logSpy.mock.calls.at(-1)?.[0] ?? '{}');
      expect(doctorReport.ok).toBe(false);
      expect(doctorReport.errors.some((entry: string) => entry.includes('Scaffold drift detected'))).toBe(true);
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = originalExitCode;
      logSpy.mockRestore();
    }
  });

  it('repairs drift with doctor --fix', async () => {
    const tempDir = await createTempDir('axi-doctor-fix-');
    tempDirs.push(tempDir);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
      await runCli(['init', '--yes', '--no-install', '--cwd', tempDir], {
        cwd: process.cwd(),
        invokedName: 'axi',
      });

      const modulesConfigPath = path.join(tempDir, '.axi/modules.json');
      const modulesConfig = JSON.parse(await readText(modulesConfigPath));
      modulesConfig.modules['ui-components'].enabled = true;
      modulesConfig.modules['theme-style-cyberpunk'].enabled = false;
      await writeFile(modulesConfigPath, `${JSON.stringify(modulesConfig, null, 2)}\n`, 'utf8');

      logSpy.mockClear();

      await runCli(['doctor', '--fix', '--cwd', tempDir], {
        cwd: process.cwd(),
        invokedName: 'axi',
      });

      const output = logSpy.mock.calls.map((call) => call.join(' ')).join('\n');
      const manifest = JSON.parse(await readText(path.join(tempDir, '.axi/scaffold.manifest.json')));
      const files = await listRelativeFiles(tempDir);
      const enabledModuleIds = manifest.modules
        .filter((module: { enabled: boolean; id: string }) => module.enabled)
        .map((module: { enabled: boolean; id: string }) => module.id);

      expect(output).toContain('doctor repaired scaffold state via sync.');
      expect(output).toContain('doctor passed');
      expect(enabledModuleIds).toContain('ui-components');
      expect(enabledModuleIds).not.toContain('theme-style-cyberpunk');
      expect(files).toContain('apps/web/src/shared/components/SectionCard.tsx');
      expect(files).not.toContain('packages/tokens/tokens/theme/presets/cyberpunk/accent.json');
    } finally {
      logSpy.mockRestore();
    }
  });
});
