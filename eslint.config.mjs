// Axi Workbench monorepo — shared ESLint flat config.
//
// 目的（契约治理防线 2：实时拦截）：
//   禁止业务代码直接 import `antd` / `@ant-design/icons`，强制使用 @axi/* 表面。
//   规则在编辑器实时飘红、`pnpm lint` / 构建时失败。
//   依据：docs/prd/02-CONTRACT-AND-CONSTRAINT-GOVERNANCE.md（Golden Rules R1）。
//
// 设计：本 config 只启用 no-restricted-imports（核心内置规则），不强制风格，
//   因此不会因为存量代码风格产生噪声；存量 antd 用法在下方"豁免"块显式关闭。
//
// @ts-check
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

const GUIDE = 'docs/prd/02-CONTRACT-AND-CONSTRAINT-GOVERNANCE.md';
const bannedMessage = [
  '禁止直接依赖 antd / @ant-design/icons：Axi 前端必须使用 @axi/* 组件（R1 单一 UI 表面）。',
  `复用映射见 ${GUIDE} §4；若 @axi 缺少所需组件，请扩展对应 @axi 包（缺口回流 §8），不要在业务页面直接引入 antd。`,
].join(' ');

// 空规则：用于占位"存量 eslint-disable 注释引用、但当前未真正启用 / 已被上游重命名"的规则。
const noopRule = { meta: { docs: { description: 'placeholder (not enforced)' } }, create: () => ({}) };

// typescript-eslint v8 已将 no-throw-literal 重命名为 only-throw-error；
// 补充 noop 占位，使存量 disable 注释不报 "Definition for rule ... was not found"。
const tsPlugin = {
  ...tseslint.plugin,
  rules: {
    ...tseslint.plugin.rules,
    'no-throw-literal': noopRule,
  },
};

export default tseslint.config(
  // ── 全局忽略 ─────────────────────────────────────────────
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/*.config.{js,cjs,mjs,ts}',
      '**/vite.config.*',
      '**/vitest.config.*',
      '**/playwright.config.*',
      '**/*.d.ts',
    ],
  },

  // ── 默认规则：全仓 TS/JS 禁止 antd ───────────────────────
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    plugins: {
      'react-hooks': reactHooks,
      '@typescript-eslint': tsPlugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    linterOptions: {
      // 本 config 只做 UI import 守门；关闭存量 eslint-disable 注释的未使用报告
      reportUnusedDisableDirectives: 'off',
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'antd', message: bannedMessage },
            { name: '@ant-design/icons', message: bannedMessage },
          ],
          patterns: [
            { group: ['antd/*', '@ant-design/icons/*'], message: bannedMessage },
          ],
        },
      ],
      // 存量 eslint-disable 注释引用了这些规则；显式注册并关闭，
      // 避免 "Definition for rule ... was not found"。如未来要启用质量规则，
      // 应改为 recommended 配置并单独清理，而不是在本守门 config 里开启。
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-throw-literal': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'react-hooks/exhaustive-deps': 'off',
    },
  },

  // ── 存量豁免（只减不增；迁移完成后从这里删除）────────────
  //   与 docs/prd/02 §5 豁免清单保持一致。
  {
    files: [
      // 存量控制台，整体仍直接使用 antd
      'apps/devsvc-dashboard/**',
      'apps/resource-orchestration/**',
      // 应用根：antd ConfigProvider 主题/locale 桥接（配置层）
      'apps/workbench/src/App.tsx',
      // 应用入口：antd reset.css 全局样式桥接（待迁移到 @axi/tokens）
      'apps/workbench/src/main.tsx',
      // 独立认证表面
      'apps/workbench/src/pages/Login.tsx',
      // 已被路由表隔离为 404 的旧页面（quarantinedPageFiles）。
      // Handoff.tsx 已迁移到 @axi/* 表面，单独从豁免清单中排除。
      'apps/workbench/src/pages/admin/**',
      '!apps/workbench/src/pages/admin/Handoff.tsx',
      'apps/workbench/src/pages/ProjectDetail.tsx',
      'apps/workbench/src/pages/Projects.tsx',
      'apps/workbench/src/pages/commit-ledger/**',
    ],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
);
