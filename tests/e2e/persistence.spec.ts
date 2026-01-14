import { test, expect } from '@playwright/test';

test('database initializes on page load', async ({ page }) => {
  await page.goto('/');

  // Wait for database to initialize
  const dbReady = await page.evaluate(async () => {
    // Wait up to 5 seconds for db to be ready
    for (let i = 0; i < 50; i++) {
      if ((window as any).__db) return true;
      await new Promise((r) => setTimeout(r, 100));
    }
    return false;
  });

  expect(dbReady).toBe(true);
});

test('data persists across page reload', async ({ page }) => {
  await page.goto('/');

  // Wait for database to initialize
  await page.evaluate(async () => {
    for (let i = 0; i < 50; i++) {
      if ((window as any).__db) return;
      await new Promise((r) => setTimeout(r, 100));
    }
  });

  // Insert a container directly into the database
  await page.evaluate(async () => {
    const db = (window as any).__db;
    db.run(`INSERT INTO containers (id, parent_id, title, description, start_position, end_position, created_at, updated_at)
            VALUES ('test-1', NULL, 'Test Scene', 'A test description', 0.1, 0.9, datetime('now'), datetime('now'))`);
    await (window as any).__saveDb();
  });

  // Reload page
  await page.reload();

  // Wait for database to reinitialize
  await page.evaluate(async () => {
    for (let i = 0; i < 50; i++) {
      if ((window as any).__db) return;
      await new Promise((r) => setTimeout(r, 100));
    }
  });

  // Verify data still exists
  const result = await page.evaluate(() => {
    const db = (window as any).__db;
    const res = db.exec("SELECT * FROM containers WHERE id = 'test-1'");
    return res.length > 0 ? res[0].values : [];
  });

  expect(result.length).toBe(1);
  expect(result[0]).toContain('Test Scene');
});

test('tables are created with correct schema', async ({ page }) => {
  await page.goto('/');

  // Wait for database to initialize
  await page.evaluate(async () => {
    for (let i = 0; i < 50; i++) {
      if ((window as any).__db) return;
      await new Promise((r) => setTimeout(r, 100));
    }
  });

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
