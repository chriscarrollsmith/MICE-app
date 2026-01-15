import { Page } from '@playwright/test';

/**
 * Wait for the database to initialize
 */
export async function waitForDb(page: Page): Promise<void> {
  await page.evaluate(async () => {
    for (let i = 0; i < 50; i++) {
      if ((window as any).__db) return;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error('Database did not initialize');
  });
}

/**
 * Clear all data from the database (containers and nodes)
 */
export async function clearDatabase(page: Page): Promise<void> {
  await waitForDb(page);
  await page.evaluate(async () => {
    const db = (window as any).__db;
    db.run('DELETE FROM nodes');
    db.run('DELETE FROM containers');
    await (window as any).__saveDb();

    // Reload store from fresh database
    if ((window as any).__reloadStore) {
      await (window as any).__reloadStore();
    }
  });
}

/**
 * Setup a test with a fresh database state
 */
export async function setupFreshPage(page: Page): Promise<void> {
  await page.goto('/');
  await clearDatabase(page);
}
