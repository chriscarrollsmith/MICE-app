import { test, expect } from '@playwright/test';

// Helper to wait for database initialization
async function waitForDb(page: any) {
  await page.evaluate(async () => {
    for (let i = 0; i < 50; i++) {
      if ((window as any).__db) return;
      await new Promise((r) => setTimeout(r, 100));
    }
  });
}

test('full workflow: create container, add threads, edit, delete, persist', async ({ page }) => {
  await page.goto('/');
  await waitForDb(page);

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not found');

  // Step 1: Create a container
  const containerZoneY = box.height * 0.10;
  await canvas.click({ position: { x: box.width * 0.2, y: containerZoneY } });
  await canvas.click({ position: { x: box.width * 0.8, y: containerZoneY } });
  await page.waitForTimeout(200);

  // Verify container was created
  let containerCount = await page.evaluate(() => {
    const db = (window as any).__db;
    const result = db.exec('SELECT COUNT(*) FROM containers');
    return result[0]?.values[0]?.[0];
  });
  expect(containerCount).toBe(1);

  // Step 2: Add a MICE thread (hover in node zone, select type, place close)
  const nodeZoneY = box.height * 0.5;
  const padding = 20;
  const usableWidth = box.width - padding * 2;
  const openNodeX = padding + usableWidth * 0.3;
  const closeNodeX = padding + usableWidth * 0.6;

  // Hover to show grid
  await page.mouse.move(box.x + openNodeX, box.y + nodeZoneY);
  await page.waitForTimeout(100);

  // Click milieu in the grid
  const grid = page.locator('[data-testid="hover-grid"]');
  await expect(grid).toBeVisible();
  await grid.locator('[data-type="milieu"]').click();
  await page.waitForTimeout(100);

  // Move and click to place close node
  await page.mouse.move(box.x + closeNodeX, box.y + nodeZoneY);
  await canvas.click({ position: { x: closeNodeX, y: nodeZoneY } });
  await page.waitForTimeout(200);

  // Verify nodes were created
  let nodeCount = await page.evaluate(() => {
    const db = (window as any).__db;
    const result = db.exec('SELECT COUNT(*) FROM nodes');
    return result[0]?.values[0]?.[0];
  });
  expect(nodeCount).toBe(2);

  // Step 3: Click on a node to edit it
  const trackY = box.height * 0.6;
  const nodeY = trackY - 12;
  await canvas.click({ position: { x: openNodeX, y: nodeY } });
  await page.waitForTimeout(100);

  // Verify detail panel appears
  const panel = page.locator('[data-testid="detail-panel"]');
  await expect(panel).toBeVisible();

  // Edit the title
  const titleInput = panel.locator('input[name="title"]');
  await titleInput.fill('My Story Beginning');
  await page.waitForTimeout(200);

  // Verify title was saved
  const nodeTitle = await page.evaluate(() => {
    const db = (window as any).__db;
    const result = db.exec("SELECT title FROM nodes WHERE role = 'open'");
    return result[0]?.values[0]?.[0];
  });
  expect(nodeTitle).toBe('My Story Beginning');

  // Step 4: Delete the thread via context menu
  await canvas.click({ position: { x: openNodeX, y: nodeY }, button: 'right' });
  await page.waitForTimeout(100);

  const contextMenu = page.locator('[data-testid="context-menu"]');
  await expect(contextMenu).toBeVisible();
  await contextMenu.locator('button:has-text("Delete Thread")').click();
  await page.waitForTimeout(200);

  // Verify nodes are deleted
  nodeCount = await page.evaluate(() => {
    const db = (window as any).__db;
    const result = db.exec('SELECT COUNT(*) FROM nodes');
    return result[0]?.values[0]?.[0];
  });
  expect(nodeCount).toBe(0);

  // Container should still exist
  containerCount = await page.evaluate(() => {
    const db = (window as any).__db;
    const result = db.exec('SELECT COUNT(*) FROM containers');
    return result[0]?.values[0]?.[0];
  });
  expect(containerCount).toBe(1);

  // Step 5: Verify data persists after reload
  await page.reload();
  await waitForDb(page);
  await page.waitForTimeout(200);

  containerCount = await page.evaluate(() => {
    const db = (window as any).__db;
    const result = db.exec('SELECT COUNT(*) FROM containers');
    return result[0]?.values[0]?.[0];
  });
  expect(containerCount).toBe(1);
});

test('app displays toolbar with title and export button', async ({ page }) => {
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
