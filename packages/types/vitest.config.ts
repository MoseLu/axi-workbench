/**
 * Vitest configuration for @axi/types.
 *
 * - node environment: `@axi/types` only re-exports TypeScript types from
 *   `@axi/workstation-contracts`. The runtime shape is verified against
 *   the Zod schemas directly.
 * - include is pinned to `src/**/*.test.ts` so future dist/*.test.ts or
 *   build artefacts do not get picked up.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 10_000,
  },
});