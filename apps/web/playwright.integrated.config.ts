import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/integrated.spec.ts',
  workers: 1,
  reporter: [['list']],
  // Protected requests contain bearer tokens; do not capture request bodies or auth headers.
  use: { baseURL: 'http://localhost:3000', trace: 'off', screenshot: 'off', video: 'off' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter @estoque/api start',
      url: 'http://localhost:3001/api/v1/health/ready',
      reuseExistingServer: !process.env.CI,
      env: { CORS_ORIGIN: 'http://localhost:3000' },
      timeout: 30000,
    },
    {
      command: 'pnpm dev --webpack --port 3000',
      url: 'http://localhost:3000/produtos',
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        NEXT_PUBLIC_API_MODE: 'real',
        NEXT_PUBLIC_API_BASE_URL: 'http://localhost:3001/api/v1',
        NEXT_TELEMETRY_DISABLED: '1',
      },
    },
  ],
});
