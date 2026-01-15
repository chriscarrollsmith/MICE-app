import { test, expect } from '@playwright/test';
import { setupFreshPage } from './helpers';

/**
 * FULL WORKFLOW INTEGRATION TESTS
 *
 * These tests verify the complete user workflow for the MICE storytelling app.
 */
test.describe('story:full-workflow', () => {
  test.beforeEach(async ({ page }) => {
    await setupFreshPage(page);
  });

  test('P0-create-edit-delete: complete workflow: create thread, edit, delete', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Full workflow
    Path: P0-create-edit-delete
    Steps:
    - The user creates a new thread via the UI.
    - The user edits a node in that thread.
    - The user deletes the thread.
    INTENT:END */

    const svg = page.locator('[data-testid="timeline-svg"]');
    const box = await svg.boundingBox();
    expect(box).not.toBeNull();

    if (box) {
      // Step 1: Start creating a thread
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(200);

      const miceGrid = page.locator('[data-testid="mice-grid"]');
      await expect(miceGrid).toBeVisible({ timeout: 2000 });
      const milieuCell = miceGrid.locator('[data-type="milieu"]');
      await milieuCell.dispatchEvent('click');
      await page.waitForTimeout(200);

      // Step 2: Place the close node (two-step creation)
      const state = await page.evaluate(() => {
        const getState = (window as any).__timelineInteraction;
        return getState ? getState() : null;
      });
      expect(state?.mode).toBe('placing-node-close');

      await page.mouse.move(box.x + (box.width * 3) / 4, box.y + box.height / 2);
      await page.waitForTimeout(200);
      const closeHandle = page.locator('[data-testid="mice-grid"], [data-testid="close-node-handle"]');
      await expect(closeHandle.first()).toBeVisible({ timeout: 2000 });
      await closeHandle.first().dispatchEvent('click');
      await page.waitForTimeout(500);

      // Verify nodes were created and no containers were auto-created
      let counts = await page.evaluate(() => {
        const db = (window as any).__db;
        const containers = db.exec('SELECT COUNT(*) FROM containers')[0]?.values[0]?.[0] ?? 0;
        const nodes = db.exec('SELECT COUNT(*) FROM nodes')[0]?.values[0]?.[0] ?? 0;
        return { containers, nodes };
      });
      expect(counts.containers).toBe(0);
      expect(counts.nodes).toBe(2);

      // Step 2: Click on a node to edit it
      const node = page.locator('[data-testid="node"]').first();
      await node.dispatchEvent('click');
      await page.waitForTimeout(200);

      // Verify popover appears
      const popover = page.locator('[data-testid="node-popover"]');
      await expect(popover).toBeVisible();

      // Edit the title
      const titleInput = page.locator('[data-testid="node-title-input"]');
      await titleInput.fill('My Story Beginning');
      await titleInput.blur();
      await page.waitForTimeout(300);

      // Close popover
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);

      // Verify title was saved
      const nodeTitle = await page.evaluate(() => {
        const db = (window as any).__db;
        const result = db.exec("SELECT title FROM nodes WHERE role = 'open'");
        return result[0]?.values[0]?.[0];
      });
      expect(nodeTitle).toBe('My Story Beginning');

      // Step 3: Delete the thread via trash button
      await node.hover();
      await page.waitForTimeout(100);

      const trashButton = node.locator('.trash-button');
      await trashButton.dispatchEvent('click');
      await page.waitForTimeout(300);

      // Verify nodes are deleted
      const nodeCount = await page.evaluate(() => {
        const db = (window as any).__db;
        const result = db.exec('SELECT COUNT(*) FROM nodes');
        return result[0]?.values[0]?.[0];
      });
      expect(nodeCount).toBe(0);
    }
  });

  test('P1-reload-persists: data persists after page reload', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Full workflow
    Path: P1-reload-persists
    Steps:
    - The user has existing story data.
    - The user reloads the page.
    - The story data is still present after reload.
    INTENT:END */

    // Create some data
    await page.evaluate(async () => {
      const db = (window as any).__db;
      db.run(`INSERT INTO containers (id, start_slot, end_slot, parent_id, title, created_at, updated_at)
              VALUES ('c1', 0, 4, NULL, 'Persisted Scene', datetime('now'), datetime('now'))`);
      db.run(`INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
              VALUES ('n1', 'c1', 't1', 'milieu', 'open', 1, 'Persisted Node', '', datetime('now'), datetime('now'))`);
      db.run(`INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
              VALUES ('n2', 'c1', 't1', 'milieu', 'close', 3, '', '', datetime('now'), datetime('now'))`);
      await (window as any).__saveDb();
      (window as any).__reloadStore();
    });

    await page.waitForTimeout(200);

    // Verify data exists
    let counts = await page.evaluate(() => {
      const db = (window as any).__db;
      const containers = db.exec('SELECT COUNT(*) FROM containers')[0]?.values[0]?.[0] ?? 0;
      const nodes = db.exec('SELECT COUNT(*) FROM nodes')[0]?.values[0]?.[0] ?? 0;
      return { containers, nodes };
    });
    expect(counts.containers).toBe(1);
    expect(counts.nodes).toBe(2);

    // Reload the page
    await page.reload();
    await page.evaluate(async () => {
      for (let i = 0; i < 50; i++) {
        if ((window as any).__db) return;
        await new Promise((r) => setTimeout(r, 100));
      }
    });
    await page.waitForTimeout(200);

    // Verify data persists
    counts = await page.evaluate(() => {
      const db = (window as any).__db;
      const containers = db.exec('SELECT COUNT(*) FROM containers')[0]?.values[0]?.[0] ?? 0;
      const nodes = db.exec('SELECT COUNT(*) FROM nodes')[0]?.values[0]?.[0] ?? 0;
      return { containers, nodes };
    });
    expect(counts.containers).toBe(1);
    expect(counts.nodes).toBe(2);

    // Verify specific data
    const nodeTitle = await page.evaluate(() => {
      const db = (window as any).__db;
      const result = db.exec("SELECT title FROM nodes WHERE role = 'open'");
      return result[0]?.values[0]?.[0];
    });
    expect(nodeTitle).toBe('Persisted Node');
  });
});

test.describe('story:ui-shell', () => {
  test('P0-toolbar: app displays toolbar with title and export button', async ({ page }) => {
    /* INTENT:BEGIN
    Story: UI shell
    Path: P0-toolbar
    Steps:
    - The user opens the app.
    - The primary toolbar is visible and shows key actions.
    INTENT:END */

    await page.goto('/');

    // Verify toolbar is visible
    const toolbar = page.locator('header.toolbar');
    await expect(toolbar).toBeVisible();

    // Verify app title
    const title = toolbar.locator('h1');
    await expect(title).toHaveText('MICE Story Editor');

    // Verify export button
    const exportBtn = toolbar.locator('button:has-text("Export Database")');
    await expect(exportBtn).toBeVisible();
  });

  test('P1-timeline-structure: timeline container renders with correct structure', async ({ page }) => {
    /* INTENT:BEGIN
    Story: UI shell
    Path: P1-timeline-structure
    Steps:
    - The user opens the app.
    - The timeline container and its main SVG are present.
    INTENT:END */

    await page.goto('/');

    // Verify timeline container
    const container = page.locator('.timeline-container');
    await expect(container).toBeVisible();

    // Verify SVG is inside
    const svg = container.locator('[data-testid="timeline-svg"]');
    await expect(svg).toBeVisible();
  });
});
