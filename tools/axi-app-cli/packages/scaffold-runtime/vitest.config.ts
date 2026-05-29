import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@axi/scaffold-foundation-api': path.resolve(__dirname, '../foundation-api/src/index.ts'),
      '@axi/scaffold-foundation-design': path.resolve(
        __dirname,
        '../foundation-design/src/index.ts',
      ),
      '@axi/scaffold-foundation-ops': path.resolve(__dirname, '../foundation-ops/src/index.ts'),
      '@axi/scaffold-foundation-web': path.resolve(__dirname, '../foundation-web/src/index.ts'),
      '@axi/scaffold-feature-experimental': path.resolve(
        __dirname,
        '../feature-experimental/src/index.ts',
      ),
      '@axi/scaffold-feature-hooks': path.resolve(__dirname, '../feature-hooks/src/index.ts'),
      '@axi/scaffold-feature-theme': path.resolve(__dirname, '../feature-theme/src/index.ts'),
      '@axi/scaffold-feature-ui': path.resolve(__dirname, '../feature-ui/src/index.ts'),
      '@axi/scaffold-registry': path.resolve(__dirname, '../scaffold-registry/src/index.ts'),
      '@axi/scaffold-runtime': path.resolve(__dirname, './src/index.ts'),
      '@axi/scaffold-kit': path.resolve(__dirname, '../scaffold-kit/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
  },
});
