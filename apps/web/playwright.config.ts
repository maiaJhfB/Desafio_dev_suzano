import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: '**/integrated.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://localhost:3000', trace: 'retain-on-failure', locale: 'pt-BR' },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 1000 } },
    },
  ],
  expect: { toHaveScreenshot: { animations: 'disabled', maxDiffPixelRatio: 0.005 } },
  webServer: {
    command: 'pnpm dev --webpack --port 3000',
    url: 'http://localhost:3000/produtos',
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      NEXT_PUBLIC_API_MODE: 'mock',
      NEXT_PUBLIC_API_BASE_URL: 'http://localhost:3001/api/v1',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
});
