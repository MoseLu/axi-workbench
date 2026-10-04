/**
 * Vitest configuration for @axi/api-client.
 *
 * - node environment: the API client runs in browsers and Node SSR;
 *   default node keeps the tests portable and avoids DOM-mocking the
 *   Axios fetch adapter.
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