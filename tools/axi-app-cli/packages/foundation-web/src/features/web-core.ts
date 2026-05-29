import type {
  FeatureRenderContext,
  ProjectFile,
  ScaffoldModuleManifest,
} from '@axi/scaffold-kit';
import { defineScaffoldFeature } from '@axi/scaffold-kit';
import {
  createGlobalStyles,
  createHomePage,
  createHomePageTest,
  createHomeSchema,
  createThemeStylesStub,
  createTokensTypeDeclaration,
  createUseDisclosure,
  createUseDisclosureTest,
  createUseHomeCards,
  createAxiDashboardAppConfig,
  createAxiAppManifest,
  createWebApp,
  createWebEslintConfig,
  createWebIndexHtml,
  createWebMain,
  createWebPackageJson,
  createWebTestSetup,
  createWebTsConfig,
  createWebViteConfig,
} from '../templates/generated-web.js';
import {
  createAxiTridentLogoSvg,
} from '../templates/branding.js';

export const webCoreManifest = {
  category: 'frontend',
  configKey: 'modules.web-core.enabled',
  dependencies: ['workspace-core', 'tokens-core'],
  description: 'React web shell, feature-based sample UI, and test/lint configuration.',
  enabledByDefault: true,
  id: 'web-core',
  layer: 'foundation',
  title: 'Web Core',
  version: '0.1.0',
} satisfies ScaffoldModuleManifest;

function applyWebCore(context: FeatureRenderContext): ProjectFile[] {
  const includeThemeControls = context.selectedFeatureIds.includes('theme-preset');

  return [
    { path: 'apps/web/package.json', content: createWebPackageJson(context) },
    { path: 'apps/web/tsconfig.json', content: createWebTsConfig() },
    { path: 'apps/web/vite.config.ts', content: createWebViteConfig() },
    { path: 'apps/web/eslint.config.js', content: createWebEslintConfig() },
    { path: 'apps/web/index.html', content: createWebIndexHtml(context) },
    { path: 'resources/public/web/brand/axi-trident-icon.svg', content: createAxiTridentLogoSvg() },
    { path: 'apps/web/src/app/main.tsx', content: createWebMain(context) },
    { path: 'apps/web/src/app/App.tsx', content: createWebApp(context) },
    { path: 'apps/web/src/app/axi.app.ts', content: createAxiAppManifest(context) },
    { path: 'config/axi-dashboard-app.json', content: createAxiDashboardAppConfig(context) },
    { path: 'apps/web/src/app/styles/global.scss', content: createGlobalStyles(context) },
    { path: 'apps/web/src/shared/hooks/useDisclosure.ts', content: createUseDisclosure() },
    {
      path: 'apps/web/src/shared/hooks/__tests__/useDisclosure.test.ts',
      content: createUseDisclosureTest(),
    },
    { path: 'apps/web/src/features/home/schemas/home.schema.ts', content: createHomeSchema() },
    { path: 'apps/web/src/features/home/hooks/useHomeCards.ts', content: createUseHomeCards() },
    {
      path: 'apps/web/src/features/home/components/HomePage.tsx',
      content: createHomePage(context, { includeThemeControls }),
    },
    {
      path: 'apps/web/src/features/home/__tests__/HomePage.test.tsx',
      content: createHomePageTest({ includeThemeControls }),
    },
    { path: 'apps/web/src/shared/theme/theme.css', content: createThemeStylesStub() },
    { path: 'apps/web/src/test/setup.ts', content: createWebTestSetup() },
    { path: 'apps/web/src/types/tokens.d.ts', content: createTokensTypeDeclaration(context) },
    { path: 'apps/web/src/vite-env.d.ts', content: `/// <reference types="vite/client" />\n` },
  ];
}

export const webCoreFeature = defineScaffoldFeature(webCoreManifest, applyWebCore);
