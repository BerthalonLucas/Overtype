import { chromium, type FullConfig } from '@playwright/test';

// The dev server transforms every module on first request: a cold first page can take
// over ten seconds on Windows, longer than the tests' five-second expectations, so the
// first test of each worker used to fail on an empty page. Load each entry once here,
// after the web server is up and before any test runs. Nothing is asserted.
export default async function warmup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) return;
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  const browser = await chromium.launch(
    executablePath ? { executablePath, args: ['--no-sandbox', '--disable-dev-shm-usage'] } : undefined,
  );
  try {
    const page = await browser.newPage();
    await page.route('**/?window=settings&fixture=1', async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body: (await response.text()).replace('/src/main.tsx', '/e2e/native-fixture.ts'),
      });
    });
    for (const path of [
      '/?window=settings&fixture=1',
      '/?window=overlay&demo=1',
      '/',
      '/lab.html',
      '/lab-frame.html',
    ]) {
      await page.goto(new URL(path, baseURL).href, { waitUntil: 'load', timeout: 90_000 });
      await page
        .waitForFunction(() => (document.getElementById('root')?.childElementCount ?? 1) > 0, undefined, {
          timeout: 90_000,
        })
        .catch(() => undefined);
    }
  } finally {
    await browser.close();
  }
}
