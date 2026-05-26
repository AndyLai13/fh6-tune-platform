import { defineConfig } from '@playwright/test';

const baseURL = process.env.SMOKE_BASE_URL ?? 'https://touge.gg';

export default defineConfig({
  testDir: 'tests/smoke',
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
