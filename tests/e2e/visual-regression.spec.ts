import { test, expect } from '@playwright/test';
import { setupFreshPage } from './helpers';

/**
 * Visual regression tests that capture screenshots at key interaction steps.
 * These tests use Playwright's built-in screenshot comparison to detect UI changes.
 *
 * Baseline screenshots are stored in tests/e2e/visual-regression.spec.ts-snapshots/
 *
 * To update baselines after intentional changes:
 *   npx playwright test visual-regression --update-snapshots
 */

test.describe('story:visual-regression', () => {
  test.beforeEach(async ({ page }) => {
    await setupFreshPage(page);
    // Wait for any animations to settle
    await page.waitForTimeout(200);
  });

  test('P0-empty-canvas: fresh timeline with no content', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Visual regression
    Path: P0-empty-canvas
    Steps:
    - The user opens the app on a fresh page.
    - The empty timeline matches the expected baseline appearance.
    INTENT:END */

    const svg = page.locator('[data-testid="timeline-svg"]');
    await expect(svg).toBeVisible();

    // Capture the empty canvas state
    await expect(page).toHaveScreenshot('01-empty-canvas.png', {
      animations: 'disabled',
    });
  });

  test('P1-hover-node-zone: MICE grid appears on hover', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Visual regression
    Path: P1-hover-node-zone
    Steps:
    - The user hovers in the node zone.
    - The MICE grid appears and the UI matches the expected baseline appearance.
    INTENT:END */

    const svg = page.locator('[data-testid="timeline-svg"]');
    const box = await svg.boundingBox();
    expect(box).not.toBeNull();

    if (box) {
      // Hover in the middle of the canvas to show MICE grid
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

      // Wait for the grid to appear
      const miceGrid = page.locator('[data-testid="mice-grid"]');
      await expect(miceGrid).toBeVisible({ timeout: 2000 });

      // Capture with MICE grid visible
      await expect(page).toHaveScreenshot('02-hover-node-zone.png', {
        animations: 'disabled',
      });
    }
  });

  test('P2-hover-container-zone: container handle appears', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Visual regression
    Path: P2-hover-container-zone
    Steps:
    - The user hovers in the container zone.
    - The container handle appears and the UI matches the expected baseline appearance.
    INTENT:END */

    const svg = page.locator('[data-testid="timeline-svg"]');
    const box = await svg.boundingBox();
    expect(box).not.toBeNull();

    if (box) {
      // Hover in the container zone (top of canvas)
      await page.mouse.move(box.x + box.width / 2, box.y + 15);

      // Wait for container handle to appear
      const containerHandle = page.locator('[data-testid="container-handle"]');
      await expect(containerHandle).toBeVisible({ timeout: 2000 });

      // Capture with container handle visible
      await expect(page).toHaveScreenshot('03-hover-container-zone.png', {
        animations: 'disabled',
      });
    }
  });

  test('P3-with-thread: timeline after creating a thread (no container)', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Visual regression
    Path: P3-with-thread
    Steps:
    - The user creates a thread.
    - The timeline renders the thread and matches the expected baseline appearance.
    INTENT:END */

    const svg = page.locator('[data-testid="timeline-svg"]');
    const box = await svg.boundingBox();
    expect(box).not.toBeNull();

    if (box) {
      // Create a thread (implementation details may change; this test is for visual baseline)
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

      const characterCell = page.locator('[data-testid="mice-grid"] [data-type="character"]');
      await expect(characterCell).toBeVisible({ timeout: 2000 });
      await characterCell.dispatchEvent('click');

      // Complete two-step creation by placing the close node
      await page.mouse.move(box.x + (box.width * 3) / 4, box.y + box.height / 2);
      const closeHandle = page.locator('[data-testid="close-node-handle"]');
      await expect(closeHandle).toBeVisible({ timeout: 2000 });
      await closeHandle.dispatchEvent('click');
      await page.waitForTimeout(500);

      // Move mouse away to hide hover elements
      await page.mouse.move(0, 0);
      await page.waitForTimeout(200);

      // Verify nodes were created but no containers
      const counts = await page.evaluate(() => {
        const db = (window as any).__db;
        const nodes = db.exec('SELECT COUNT(*) FROM nodes')[0]?.values[0]?.[0] ?? 0;
        const containers = db.exec('SELECT COUNT(*) FROM containers')[0]?.values[0]?.[0] ?? 0;
        return { nodes, containers };
      });
      expect(counts.nodes).toBe(2);
      expect(counts.containers).toBe(0);

      // Capture the state with thread (nodes + arc, no container)
      await expect(page).toHaveScreenshot('04-with-container.png', {
        animations: 'disabled',
      });
    }
  });

  test('P4-with-nodes: timeline after creating open and close nodes', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Visual regression
    Path: P4-with-nodes
    Steps:
    - The timeline contains an opening node and a closing node.
    - The UI matches the expected baseline appearance.
    INTENT:END */

    const svg = page.locator('[data-testid="timeline-svg"]');
    const box = await svg.boundingBox();
    expect(box).not.toBeNull();

    if (box) {
      // Create a thread (implementation details may change; this test is for visual baseline)
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

      const characterCell = page.locator('[data-testid="mice-grid"] [data-type="character"]');
      await expect(characterCell).toBeVisible({ timeout: 2000 });
      await characterCell.dispatchEvent('click');

      // Complete two-step creation by placing the close node
      await page.mouse.move(box.x + (box.width * 3) / 4, box.y + box.height / 2);
      const closeHandle = page.locator('[data-testid="close-node-handle"]');
      await expect(closeHandle).toBeVisible({ timeout: 2000 });
      await closeHandle.dispatchEvent('click');
      await page.waitForTimeout(500);

      // Verify nodes were created
      const nodeCount = await page.evaluate(() => {
        const db = (window as any).__db;
        const result = db.exec('SELECT COUNT(*) FROM nodes');
        return result[0]?.values[0]?.[0] ?? 0;
      });
      expect(nodeCount).toBe(2);

      // Move mouse away to hide hover elements
      await page.mouse.move(0, 0);
      await page.waitForTimeout(200);

      // Capture the state with nodes and arc
      await expect(page).toHaveScreenshot('05-with-nodes.png', {
        animations: 'disabled',
      });
    }
  });

  test('P5-node-selected: node selection state', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Visual regression
    Path: P5-node-selected
    Steps:
    - The timeline contains a node.
    - The user selects the node.
    - The selection UI matches the expected baseline appearance.
    INTENT:END */

    const svg = page.locator('[data-testid="timeline-svg"]');
    const box = await svg.boundingBox();
    expect(box).not.toBeNull();

    if (box) {
      // Create thread first
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

      const characterCell = page.locator('[data-testid="mice-grid"] [data-type="character"]');
      await expect(characterCell).toBeVisible({ timeout: 2000 });
      await characterCell.dispatchEvent('click');

      // Complete two-step creation by placing the close node
      await page.mouse.move(box.x + (box.width * 3) / 4, box.y + box.height / 2);
      const closeHandle = page.locator('[data-testid="close-node-handle"]');
      await expect(closeHandle).toBeVisible({ timeout: 2000 });
      await closeHandle.dispatchEvent('click');
      await page.waitForTimeout(500);

      // Move mouse away
      await page.mouse.move(0, 0);
      await page.waitForTimeout(200);

      // Click on a node to select it
      const node = page.locator('[data-testid="node"]').first();
      await expect(node).toBeVisible({ timeout: 2000 });
      await node.dispatchEvent('click');
      await page.waitForTimeout(200);

      // Capture the selected node state (should show popover or highlight)
      await expect(page).toHaveScreenshot('06-node-selected.png', {
        animations: 'disabled',
      });
    }
  });

  test('P6-multiple-threads: timeline with multiple thread types', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Visual regression
    Path: P6-multiple-threads
    Steps:
    - The timeline contains multiple threads of different types.
    - The UI matches the expected baseline appearance.
    INTENT:END */

    // Create threads directly in the database for a reliable visual test
    await page.evaluate(() => {
      const db = (window as any).__db;

      // Create a container
      db.run(`
        INSERT INTO containers (id, start_slot, end_slot, parent_id, title, created_at, updated_at)
        VALUES ('c1', 0, 5, NULL, '', datetime('now'), datetime('now'))
      `);

      // Create first thread (character type) at slots 0-1
      db.run(`
        INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
        VALUES
          ('n1', 'c1', 't1', 'character', 'open', 0, 'Open Character', '', datetime('now'), datetime('now')),
          ('n2', 'c1', 't1', 'character', 'close', 1, 'Close Character', '', datetime('now'), datetime('now'))
      `);

      // Create second thread (idea type) at slots 2-3
      db.run(`
        INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
        VALUES
          ('n3', 'c1', 't2', 'idea', 'open', 2, 'Open Idea', '', datetime('now'), datetime('now')),
          ('n4', 'c1', 't2', 'idea', 'close', 3, 'Close Idea', '', datetime('now'), datetime('now'))
      `);

      // Create third thread (event type) at slots 4-5
      db.run(`
        INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
        VALUES
          ('n5', 'c1', 't3', 'event', 'open', 4, 'Open Event', '', datetime('now'), datetime('now')),
          ('n6', 'c1', 't3', 'event', 'close', 5, 'Close Event', '', datetime('now'), datetime('now'))
      `);

      // Save and reload
      (window as any).__saveDb();
      if ((window as any).__reloadStore) {
        (window as any).__reloadStore();
      }
    });

    // Wait for store to update
    await page.waitForTimeout(500);

    // Verify the nodes rendered
    const nodes = page.locator('[data-testid="node"]');
    await expect(nodes).toHaveCount(6, { timeout: 3000 });

    // Capture multiple threads with different types
    await expect(page).toHaveScreenshot('07-multiple-threads.png', {
      animations: 'disabled',
    });
  });
});

/**
 * Standalone screenshot capture for debugging/documentation
 * Run with: npx playwright test visual-regression --grep "capture debug screenshot"
 */
test.describe('debug screenshots', () => {
  test.skip('capture debug screenshot at current state', async ({ page }) => {
    await setupFreshPage(page);

    // Add any setup steps here for the specific state you want to capture

    await page.screenshot({
      path: 'tests/e2e/debug-screenshot.png',
      fullPage: true
    });
  });
});
