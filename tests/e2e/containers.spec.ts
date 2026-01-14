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

test('container renders as rectangle on timeline', async ({ page }) => {
  await page.goto('/');
  await waitForDb(page);

  // Insert a container directly
  await page.evaluate(async () => {
    const db = (window as any).__db;
    db.run(`INSERT INTO containers VALUES ('c1', NULL, 'Scene 1', 'A test scene', 0.2, 0.8, datetime('now'), datetime('now'))`);
    await (window as any).__saveDb();
    (window as any).__reloadStore();
  });

  // Give time for re-render
  await page.waitForTimeout(200);

  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();

  // Check if container region has non-background pixels
  const hasContainer = await page.evaluate(() => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    // Get the display dimensions (CSS pixels) and account for DPR
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Check pixel at container location (roughly 30% from left, in container zone)
    // Container zone is top 25% of canvas
    // Multiply by DPR to get actual canvas pixel coordinates
    const x = rect.width * 0.3 * dpr;
    const y = rect.height * 0.12 * dpr; // Middle of container zone

    const pixel = ctx.getImageData(x, y, 1, 1).data;

    // Should not be pure white (255,255,255) or the container zone gray (#f5f5f5 = 245,245,245)
    const isBackground =
      (pixel[0] === 255 && pixel[1] === 255 && pixel[2] === 255) ||
      (pixel[0] === 245 && pixel[1] === 245 && pixel[2] === 245);

    return !isBackground;
  });

  expect(hasContainer).toBe(true);
});

test('container spans correct width based on positions', async ({ page }) => {
  await page.goto('/');
  await waitForDb(page);

  // Insert a container from 0.25 to 0.75
  await page.evaluate(async () => {
    const db = (window as any).__db;
    db.run(`INSERT INTO containers VALUES ('c1', NULL, 'Scene 1', '', 0.25, 0.75, datetime('now'), datetime('now'))`);
    await (window as any).__saveDb();
    (window as any).__reloadStore();
  });

  await page.waitForTimeout(100);

  // Check pixels at start, middle, and end of container
  const containerPixels = await page.evaluate(() => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { before: false, start: false, middle: false, end: false, after: false };

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const y = rect.height * 0.12 * dpr;
    const padding = 20 * dpr;
    const usableWidth = (rect.width - 40) * dpr; // 40 = 20 * 2 padding in CSS pixels

    const checkPixel = (xPercent: number) => {
      const x = padding + usableWidth * xPercent;
      const pixel = ctx.getImageData(x, y, 1, 1).data;
      // Check if it's container color (not background)
      const isBackground =
        (pixel[0] === 255 && pixel[1] === 255 && pixel[2] === 255) ||
        (pixel[0] === 245 && pixel[1] === 245 && pixel[2] === 245);
      return !isBackground;
    };

    return {
      before: checkPixel(0.15),  // Before container start
      start: checkPixel(0.30),   // Just inside container
      middle: checkPixel(0.50),  // Middle of container
      end: checkPixel(0.70),     // Just inside container end
      after: checkPixel(0.85),   // After container end
    };
  });

  expect(containerPixels.before).toBe(false);
  expect(containerPixels.start).toBe(true);
  expect(containerPixels.middle).toBe(true);
  expect(containerPixels.end).toBe(true);
  expect(containerPixels.after).toBe(false);
});

test('nested container renders inside parent with padding', async ({ page }) => {
  await page.goto('/');
  await waitForDb(page);

  // Insert parent and child containers
  await page.evaluate(async () => {
    const db = (window as any).__db;
    db.run(`INSERT INTO containers VALUES ('parent', NULL, 'Act 1', '', 0.1, 0.9, datetime('now'), datetime('now'))`);
    db.run(`INSERT INTO containers VALUES ('child', 'parent', 'Scene 1', '', 0.2, 0.6, datetime('now'), datetime('now'))`);
    await (window as any).__saveDb();
    (window as any).__reloadStore();
  });

  await page.waitForTimeout(200);

  // Check that child container is visually inset from parent
  const nestedCheck = await page.evaluate(() => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { error: 'No context' };

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Sample at two different Y positions in the container zone
    // Parent should be at the outer Y, child at inner Y
    const yOuter = rect.height * 0.05 * dpr;  // Near top of container zone
    const yInner = rect.height * 0.15 * dpr;  // Further into container zone

    const padding = 20 * dpr;
    const usableWidth = (rect.width - 40) * dpr;

    const checkPixel = (x: number, y: number) => {
      const pixel = ctx.getImageData(x, y, 1, 1).data;
      // Check if it's container color (not background)
      const isBackground =
        (pixel[0] === 255 && pixel[1] === 255 && pixel[2] === 255) ||
        (pixel[0] === 245 && pixel[1] === 245 && pixel[2] === 245);
      return !isBackground;
    };

    // At x=0.15 (inside parent but outside child)
    const xOutsideChild = padding + usableWidth * 0.15;
    // At x=0.4 (inside both parent and child)
    const xInsideChild = padding + usableWidth * 0.4;

    return {
      // Parent should be visible at outer Y
      parentAtOuter: checkPixel(xOutsideChild, yOuter),
      // Child area should be visible at inner Y
      childAtInner: checkPixel(xInsideChild, yInner),
    };
  });

  // Parent should be visible at outer edges
  expect(nestedCheck.parentAtOuter).toBe(true);
  // Child should be visible within its bounds
  expect(nestedCheck.childAtInner).toBe(true);
});

test('can create container by clicking top zone', async ({ page }) => {
  await page.goto('/');
  await waitForDb(page);

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not found');

  // Click near top edge to set left boundary (in container zone, ~10% height)
  const containerZoneY = box.height * 0.10;
  await canvas.click({ position: { x: box.width * 0.2, y: containerZoneY } });

  // Click further right to set right boundary
  await canvas.click({ position: { x: box.width * 0.7, y: containerZoneY } });

  // Wait for state to update
  await page.waitForTimeout(100);

  // Verify container was created in database
  const containers = await page.evaluate(() => {
    const db = (window as any).__db;
    return db.exec('SELECT * FROM containers');
  });

  expect(containers.length).toBeGreaterThan(0);
  expect(containers[0]?.values?.length).toBe(1);

  // Verify positions are roughly correct (0.2 to 0.7)
  const startPos = containers[0].values[0][4]; // start_position column
  const endPos = containers[0].values[0][5]; // end_position column
  expect(startPos).toBeGreaterThan(0.1);
  expect(startPos).toBeLessThan(0.3);
  expect(endPos).toBeGreaterThan(0.6);
  expect(endPos).toBeLessThan(0.8);
});

test('shows preview line when creating container', async ({ page }) => {
  await page.goto('/');
  await waitForDb(page);

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not found');

  // Click to start container creation
  const containerZoneY = box.height * 0.10;
  await canvas.click({ position: { x: box.width * 0.2, y: containerZoneY } });

  // Move mouse to new position (don't click yet)
  await page.mouse.move(box.x + box.width * 0.6, box.y + containerZoneY);

  // Wait a moment for render
  await page.waitForTimeout(100);

  // Check that interaction state is 'creating-container'
  const interactionState = await page.evaluate(() => {
    const manager = (window as any).__interactionManager;
    return manager ? manager.getState() : null;
  });

  expect(interactionState).not.toBeNull();
  expect(interactionState.mode).toBe('creating-container');

  // Verify there are preview pixels (dashed line) on the canvas
  // Check for blue vertical line at start position
  const hasPreview = await page.evaluate(() => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Check at the start position (20% from left) for blue pixels
    const x = rect.width * 0.2 * dpr;
    const y = rect.height * 0.05 * dpr;
    const pixel = ctx.getImageData(x, y, 1, 1).data;

    // Look for blue-ish color (the start line is blue #3b82f6)
    return pixel[2] > 200 && pixel[2] > pixel[0];
  });

  expect(hasPreview).toBe(true);

  // Press Escape to cancel
  await page.keyboard.press('Escape');

  // Verify state is back to idle
  const stateAfterCancel = await page.evaluate(() => {
    const manager = (window as any).__interactionManager;
    return manager ? manager.getState() : null;
  });

  expect(stateAfterCancel.mode).toBe('idle');
});
