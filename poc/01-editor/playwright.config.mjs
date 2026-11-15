import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.mjs',
  timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:5173', headless: true, browserName: 'chromium', trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI,
    timeout: 120000 },
  reporter: [['list'], ['html', { open: 'never' }]],
});
