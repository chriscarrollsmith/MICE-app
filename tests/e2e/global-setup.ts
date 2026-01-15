import { chromium, type FullConfig } from '@playwright/test';

/**
 * Global setup that runs once before all tests
 * Clears the IndexedDB database to ensure a clean slate
 */
async function globalSetup(config: FullConfig) {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Navigate to the app
  const baseURL = config.projects[0].use?.baseURL || 'http://localhost:5173';
  await page.goto(baseURL);

  // Wait for database to initialize
  await page.evaluate(async () => {
    for (let i = 0; i < 50; i++) {
      if ((window as any).__db) return;
      await new Promise((r) => setTimeout(r, 100));
    }
  });

  // Clear all data
  await page.evaluate(async () => {
    const db = (window as any).__db;
    if (db) {
      db.run('DELETE FROM nodes');
      db.run('DELETE FROM containers');
      await (window as any).__saveDb?.();
    }
  });

  await browser.close();
}

export default globalSetup;
