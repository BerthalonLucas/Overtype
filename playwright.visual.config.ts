import { defineConfig } from '@playwright/test';
const port = process.env.FLOWTRANSLATE_TEST_PORT ?? '5174';
export default defineConfig({
  testDir: './visual-tests',
  testMatch: '*.spec.ts',
  outputDir: 'test-results/visual',
  snapshotPathTemplate: '{testDir}/references/{platform}/{projectName}/{arg}{ext}',
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 900, height: 600 },
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
  },
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/visual', open: 'never' }]],
});
