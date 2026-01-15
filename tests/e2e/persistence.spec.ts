import { test, expect } from '@playwright/test';
import { waitForDb } from './helpers';

test.describe('story:persistence', () => {
  test('P0-db-initializes: database initializes on page load', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Persistence
    Path: P0-db-initializes
    Steps:
    - The user opens the app.
    - The database initializes and becomes available to the app.
    INTENT:END */

    await page.goto('/');
    await waitForDb(page);

    // impl: smoke-check that the db object is present
    const dbReady = await page.evaluate(() => Boolean((window as any).__db));
    expect(dbReady).toBe(true);
  });

  test('P1-reload-persists: data persists across page reload', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Persistence
    Path: P1-reload-persists
    Steps:
    - The user creates data that is saved to the database.
    - The user reloads the page.
    - The previously saved data is still present after reload.
    INTENT:END */

    await page.goto('/');
    await waitForDb(page);

    // Insert a container directly into the database
    await page.evaluate(async () => {
      const db = (window as any).__db;
      db.run(`INSERT INTO containers (id, parent_id, title, start_slot, end_slot, created_at, updated_at)
              VALUES ('test-1', NULL, 'Test Scene', 1, 9, datetime('now'), datetime('now'))`);
      await (window as any).__saveDb();
    });

    // Reload page
    await page.reload();
    await waitForDb(page);

    // Verify data still exists
    const result = await page.evaluate(() => {
      const db = (window as any).__db;
      const res = db.exec("SELECT * FROM containers WHERE id = 'test-1'");
      return res.length > 0 ? res[0].values : [];
    });

    expect(result.length).toBe(1);
    expect(result[0]).toContain('Test Scene');
  });

  test('P2-schema: tables are created with correct schema', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Persistence
    Path: P2-schema
    Steps:
    - The user opens the app.
    - Required database tables exist.
    INTENT:END */

    await page.goto('/');
    await waitForDb(page);

    // Check containers table exists
    const containersTable = await page.evaluate(() => {
      const db = (window as any).__db;
      const res = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='containers'");
      return res.length > 0;
    });
    expect(containersTable).toBe(true);

    // Check nodes table exists
    const nodesTable = await page.evaluate(() => {
      const db = (window as any).__db;
      const res = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='nodes'");
      return res.length > 0;
    });
    expect(nodesTable).toBe(true);
  });
});
