import { defineConfig, devices } from 'playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://127.0.0.1:4322', trace: 'retain-on-failure', ...devices['Desktop Chrome'] },
  webServer: {
    command: 'pnpm dev --host 127.0.0.1 --port 4322',
    url: 'http://127.0.0.1:4322',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
