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

test('nodes render as colored circles on timeline', async ({ page }) => {
  await page.goto('/');
  await waitForDb(page);

  // Insert a container and nodes
  await page.evaluate(async () => {
    const db = (window as any).__db;
    db.run(`INSERT INTO containers VALUES ('c1', NULL, 'Scene', '', 0.1, 0.9, datetime('now'), datetime('now'))`);
    db.run(`INSERT INTO nodes VALUES ('n1', 'c1', 't1', 'milieu', 'open', 0.3, 'Enter World', '', datetime('now'), datetime('now'))`);
    db.run(`INSERT INTO nodes VALUES ('n2', 'c1', 't1', 'milieu', 'close', 0.7, 'Leave World', '', datetime('now'), datetime('now'))`);
    await (window as any).__saveDb();
    (window as any).__reloadStore();
  });

  await page.waitForTimeout(200);

  // Verify blue pixels appear at node locations (milieu = blue #3b82f6)
  const nodeCheck = await page.evaluate(() => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { openNode: false, closeNode: false };

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const padding = 20;
    const usableWidth = rect.width - padding * 2;

    // Track line is at 60% height
    const trackY = rect.height * 0.6;

    // Open node at position 0.3, above track line
    const openX = (padding + usableWidth * 0.3) * dpr;
    const openY = (trackY - 12) * dpr; // 12px above track
    const openPixel = ctx.getImageData(openX, openY, 1, 1).data;

    // Close node at position 0.7, below track line
    const closeX = (padding + usableWidth * 0.7) * dpr;
    const closeY = (trackY + 12) * dpr; // 12px below track
    const closePixel = ctx.getImageData(closeX, closeY, 1, 1).data;

    // Blue channel should be dominant for milieu nodes (#3b82f6)
    const isBlue = (pixel: Uint8ClampedArray) => pixel[2] > 200 && pixel[2] > pixel[0] && pixel[2] > pixel[1];

    return {
      openNode: isBlue(openPixel),
      closeNode: isBlue(closePixel),
    };
  });

  expect(nodeCheck.openNode).toBe(true);
  expect(nodeCheck.closeNode).toBe(true);
});

test('different MICE types have different colors', async ({ page }) => {
  await page.goto('/');
  await waitForDb(page);

  // Insert container and nodes of different types
  await page.evaluate(async () => {
    const db = (window as any).__db;
    db.run(`INSERT INTO containers VALUES ('c1', NULL, 'Scene', '', 0.0, 1.0, datetime('now'), datetime('now'))`);
    // Milieu (blue)
    db.run(`INSERT INTO nodes VALUES ('n1', 'c1', 't1', 'milieu', 'open', 0.1, '', '', datetime('now'), datetime('now'))`);
    db.run(`INSERT INTO nodes VALUES ('n2', 'c1', 't1', 'milieu', 'close', 0.15, '', '', datetime('now'), datetime('now'))`);
    // Idea (green)
    db.run(`INSERT INTO nodes VALUES ('n3', 'c1', 't2', 'idea', 'open', 0.3, '', '', datetime('now'), datetime('now'))`);
    db.run(`INSERT INTO nodes VALUES ('n4', 'c1', 't2', 'idea', 'close', 0.35, '', '', datetime('now'), datetime('now'))`);
    // Character (orange)
    db.run(`INSERT INTO nodes VALUES ('n5', 'c1', 't3', 'character', 'open', 0.5, '', '', datetime('now'), datetime('now'))`);
    db.run(`INSERT INTO nodes VALUES ('n6', 'c1', 't3', 'character', 'close', 0.55, '', '', datetime('now'), datetime('now'))`);
    // Event (red)
    db.run(`INSERT INTO nodes VALUES ('n7', 'c1', 't4', 'event', 'open', 0.7, '', '', datetime('now'), datetime('now'))`);
    db.run(`INSERT INTO nodes VALUES ('n8', 'c1', 't4', 'event', 'close', 0.75, '', '', datetime('now'), datetime('now'))`);
    await (window as any).__saveDb();
    (window as any).__reloadStore();
  });

  await page.waitForTimeout(200);

  // Check colors at each node position
  const colorCheck = await page.evaluate(() => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const padding = 20;
    const usableWidth = rect.width - padding * 2;
    const trackY = rect.height * 0.6;
    const nodeY = (trackY - 12) * dpr; // Open nodes above track

    const getPixelAt = (position: number) => {
      const x = (padding + usableWidth * position) * dpr;
      return ctx.getImageData(x, nodeY, 1, 1).data;
    };

    const milieu = getPixelAt(0.1);
    const idea = getPixelAt(0.3);
    const character = getPixelAt(0.5);
    const event = getPixelAt(0.7);

    return {
      milieu: { r: milieu[0], g: milieu[1], b: milieu[2] },
      idea: { r: idea[0], g: idea[1], b: idea[2] },
      character: { r: character[0], g: character[1], b: character[2] },
      event: { r: event[0], g: event[1], b: event[2] },
    };
  });

  expect(colorCheck).not.toBeNull();

  // Milieu should be blue-dominant
  expect(colorCheck!.milieu.b).toBeGreaterThan(colorCheck!.milieu.r);
  expect(colorCheck!.milieu.b).toBeGreaterThan(150);

  // Idea should be green-dominant
  expect(colorCheck!.idea.g).toBeGreaterThan(colorCheck!.idea.b);
  expect(colorCheck!.idea.g).toBeGreaterThan(150);

  // Character should be orange (high red, medium green)
  expect(colorCheck!.character.r).toBeGreaterThan(200);
  expect(colorCheck!.character.g).toBeGreaterThan(50);
  expect(colorCheck!.character.g).toBeLessThan(150);

  // Event should be red-dominant
  expect(colorCheck!.event.r).toBeGreaterThan(200);
  expect(colorCheck!.event.r).toBeGreaterThan(colorCheck!.event.g);
  expect(colorCheck!.event.r).toBeGreaterThan(colorCheck!.event.b);
});

test('arc connects open and close nodes', async ({ page }) => {
  await page.goto('/');
  await waitForDb(page);

  // Insert container and a thread
  await page.evaluate(async () => {
    const db = (window as any).__db;
    db.run(`INSERT INTO containers VALUES ('c1', NULL, 'Scene', '', 0.1, 0.9, datetime('now'), datetime('now'))`);
    db.run(`INSERT INTO nodes VALUES ('n1', 'c1', 't1', 'milieu', 'open', 0.2, '', '', datetime('now'), datetime('now'))`);
    db.run(`INSERT INTO nodes VALUES ('n2', 'c1', 't1', 'milieu', 'close', 0.8, '', '', datetime('now'), datetime('now'))`);
    await (window as any).__saveDb();
    (window as any).__reloadStore();
  });

  await page.waitForTimeout(200);

  // Check for arc pixels between the nodes (above the track line)
  const arcCheck = await page.evaluate(() => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { hasArc: false };

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const padding = 20;
    const usableWidth = rect.width - padding * 2;

    // Track line is at 60% height, arc should be above it
    const trackY = rect.height * 0.6;
    // Check at midpoint between nodes (0.5 position) and above track
    const arcX = (padding + usableWidth * 0.5) * dpr;
    const arcY = (trackY - 30) * dpr; // Well above the track

    const pixel = ctx.getImageData(arcX, arcY, 1, 1).data;

    // Should be blue (milieu color) if arc is present
    const isBlue = pixel[2] > 150 && pixel[2] > pixel[0];

    return {
      hasArc: isBlue,
      pixel: { r: pixel[0], g: pixel[1], b: pixel[2] },
    };
  });

  expect(arcCheck.hasArc).toBe(true);
});

test('hover grid appears when hovering in node zone within container', async ({ page }) => {
  await page.goto('/');
  await waitForDb(page);

  // Insert a container first (need container to create nodes in)
  await page.evaluate(async () => {
    const db = (window as any).__db;
    db.run(`INSERT INTO containers VALUES ('c1', NULL, 'Scene', '', 0.1, 0.9, datetime('now'), datetime('now'))`);
    await (window as any).__saveDb();
    (window as any).__reloadStore();
  });

  await page.waitForTimeout(200);

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not found');

  // Hover in the node zone within the container (below container zone, at ~50% height)
  const nodeZoneY = box.height * 0.5;
  await page.mouse.move(box.x + box.width * 0.5, box.y + nodeZoneY);

  await page.waitForTimeout(100);

  // Verify hover grid is visible
  const grid = page.locator('[data-testid="hover-grid"]');
  await expect(grid).toBeVisible();

  // Verify it has 4 cells (M, I, C, E)
  const cells = grid.locator('[data-type]');
  await expect(cells).toHaveCount(4);
});

test('hover grid disappears when moving outside container', async ({ page }) => {
  await page.goto('/');
  await waitForDb(page);

  // Insert a container
  await page.evaluate(async () => {
    const db = (window as any).__db;
    db.run(`INSERT INTO containers VALUES ('c1', NULL, 'Scene', '', 0.3, 0.7, datetime('now'), datetime('now'))`);
    await (window as any).__saveDb();
    (window as any).__reloadStore();
  });

  await page.waitForTimeout(200);

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not found');

  // First hover inside container
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.waitForTimeout(100);

  const grid = page.locator('[data-testid="hover-grid"]');
  await expect(grid).toBeVisible();

  // Move outside container (to position 0.1, which is outside 0.3-0.7)
  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.5);
  await page.waitForTimeout(100);

  // Grid should be hidden
  await expect(grid).not.toBeVisible();
});

test('grid cell shows hover effect when mouse enters', async ({ page }) => {
  await page.goto('/');
  await waitForDb(page);

  // Insert a container
  await page.evaluate(async () => {
    const db = (window as any).__db;
    db.run(`INSERT INTO containers VALUES ('c1', NULL, 'Scene', '', 0.1, 0.9, datetime('now'), datetime('now'))`);
    await (window as any).__saveDb();
    (window as any).__reloadStore();
  });

  await page.waitForTimeout(200);

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not found');

  // Hover in the node zone to show grid
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.waitForTimeout(100);

  const grid = page.locator('[data-testid="hover-grid"]');
  await expect(grid).toBeVisible();

  // Hover over the milieu cell
  const milieuCell = grid.locator('[data-type="milieu"]');
  await milieuCell.hover();

  // Verify the cell has the hover/scaled appearance (check transform)
  const transform = await milieuCell.evaluate((el) => {
    return window.getComputedStyle(el).transform;
  });

  // When scaled to 1.1, transform should not be 'none'
  expect(transform).not.toBe('none');
});

test('clicking grid cell starts node creation mode', async ({ page }) => {
  await page.goto('/');
  await waitForDb(page);

  // Insert a container
  await page.evaluate(async () => {
    const db = (window as any).__db;
    db.run(`INSERT INTO containers VALUES ('c1', NULL, 'Scene', '', 0.1, 0.9, datetime('now'), datetime('now'))`);
    await (window as any).__saveDb();
    (window as any).__reloadStore();
  });

  await page.waitForTimeout(200);

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not found');

  // Hover to show grid
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.waitForTimeout(100);

  const grid = page.locator('[data-testid="hover-grid"]');
  await expect(grid).toBeVisible();

  // Click on 'milieu' cell
  await grid.locator('[data-type="milieu"]').click();

  await page.waitForTimeout(100);

  // Verify interaction state changed to 'creating-node'
  const interactionState = await page.evaluate(() => {
    const manager = (window as any).__interactionManager;
    return manager ? manager.getState() : null;
  });

  expect(interactionState).not.toBeNull();
  expect(interactionState.mode).toBe('creating-node');
  expect(interactionState.type).toBe('milieu');

  // Grid should be hidden after selection
  await expect(grid).not.toBeVisible();
});

test('clicking again completes node creation with open and close nodes', async ({ page }) => {
  await page.goto('/');
  await waitForDb(page);

  // Insert a container
  await page.evaluate(async () => {
    const db = (window as any).__db;
    db.run(`INSERT INTO containers VALUES ('c1', NULL, 'Scene', '', 0.1, 0.9, datetime('now'), datetime('now'))`);
    await (window as any).__saveDb();
    (window as any).__reloadStore();
  });

  await page.waitForTimeout(200);

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not found');

  // Hover at 30% position to show grid
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
  await page.waitForTimeout(100);

  // Click on 'idea' cell to start node creation
  const grid = page.locator('[data-testid="hover-grid"]');
  await grid.locator('[data-type="idea"]').click();

  await page.waitForTimeout(100);

  // Move to 70% position and click to place close node
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.5);
  await canvas.click({ position: { x: box.width * 0.7, y: box.height * 0.5 } });

  await page.waitForTimeout(200);

  // Verify nodes were created in database
  const nodes = await page.evaluate(() => {
    const db = (window as any).__db;
    return db.exec('SELECT * FROM nodes ORDER BY position');
  });

  expect(nodes.length).toBeGreaterThan(0);
  expect(nodes[0]?.values?.length).toBe(2); // open and close nodes

  // Verify node properties
  const openNode = nodes[0].values[0];
  const closeNode = nodes[0].values[1];

  // Check types are both 'idea'
  expect(openNode[3]).toBe('idea'); // type column
  expect(closeNode[3]).toBe('idea');

  // Check roles
  expect(openNode[4]).toBe('open'); // role column
  expect(closeNode[4]).toBe('close');

  // Check positions are roughly correct
  const openPos = openNode[5]; // position column
  const closePos = closeNode[5];
  expect(openPos).toBeGreaterThan(0.2);
  expect(openPos).toBeLessThan(0.4);
  expect(closePos).toBeGreaterThan(0.6);
  expect(closePos).toBeLessThan(0.8);

  // Verify state is back to idle
  const interactionState = await page.evaluate(() => {
    const manager = (window as any).__interactionManager;
    return manager ? manager.getState() : null;
  });
  expect(interactionState.mode).toBe('idle');
});

test('shows preview arc and node while creating thread', async ({ page }) => {
  await page.goto('/');
  await waitForDb(page);

  // Insert a container
  await page.evaluate(async () => {
    const db = (window as any).__db;
    db.run(`INSERT INTO containers VALUES ('c1', NULL, 'Scene', '', 0.1, 0.9, datetime('now'), datetime('now'))`);
    await (window as any).__saveDb();
    (window as any).__reloadStore();
  });

  await page.waitForTimeout(200);

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not found');

  // Hover at 30% position to show grid
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
  await page.waitForTimeout(100);

  // Click on 'milieu' cell to start node creation
  const grid = page.locator('[data-testid="hover-grid"]');
  await grid.locator('[data-type="milieu"]').click();

  await page.waitForTimeout(100);

  // Move to 70% position (don't click yet) - ensure we're over the canvas
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.5);
  await page.waitForTimeout(100);

  // Force a redraw to ensure preview is rendered
  await page.evaluate(() => {
    (window as any).__redrawCanvas?.();
  });
  await page.waitForTimeout(50);

  // Get the actual open position from the state
  const stateInfo = await page.evaluate(() => {
    const manager = (window as any).__interactionManager;
    return {
      state: manager ? manager.getState() : null,
      mousePos: manager ? manager.getMousePosition() : null,
    };
  });

  // Check for preview pixels on canvas using actual positions
  const previewCheck = await page.evaluate(() => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    const manager = (window as any).__interactionManager;
    const state = manager ? manager.getState() : null;

    if (!ctx || !state || state.mode !== 'creating-node') {
      return { hasOpenNode: false, hasPreviewArc: false, hasClosePreview: false, error: 'Invalid state' };
    }

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const padding = 20;
    const usableWidth = rect.width - padding * 2;
    const trackY = rect.height * 0.6;

    // Use actual open position from state
    const openPosition = state.openPosition;

    // Check for open node at actual position (above track line)
    const openX = (padding + usableWidth * openPosition) * dpr;
    const openY = (trackY - 12) * dpr;
    const openPixel = ctx.getImageData(openX, openY, 1, 1).data;
    const hasOpenNode = openPixel[2] > 150 && openPixel[2] > openPixel[0]; // Blue

    // Get mouse position to calculate actual close position
    const mousePos = (window as any).__interactionManager?.getMousePosition();
    const actualClosePosition = mousePos ? (mousePos.x - padding) / usableWidth : 0.7;
    const midPosition = (openPosition + actualClosePosition) / 2;

    // Sample a grid to find blue arc pixels
    let hasPreviewArc = false;
    let arcPixel = new Uint8ClampedArray([255, 255, 255, 255]);
    for (let xOffset = -20; xOffset <= 20 && !hasPreviewArc; xOffset += 10) {
      const arcX = (padding + usableWidth * midPosition + xOffset) * dpr;
      for (let yOffset = 20; yOffset <= 60; yOffset += 5) {
        const testY = (trackY - yOffset) * dpr;
        const testPixel = ctx.getImageData(arcX, testY, 1, 1).data;
        if (testPixel[2] > 150 && testPixel[2] > testPixel[0]) {
          hasPreviewArc = true;
          arcPixel = testPixel;
          break;
        }
      }
    }

    // Check for close node preview at 70% position (below track line)
    const closeX = (padding + usableWidth * 0.7) * dpr;
    const closeY = (trackY + 12) * dpr;
    const closePixel = ctx.getImageData(closeX, closeY, 1, 1).data;
    // Preview should be blue (milieu color) but potentially with reduced opacity
    const hasClosePreview = closePixel[2] > 100 && closePixel[2] > closePixel[0];

    return {
      hasOpenNode,
      hasPreviewArc,
      hasClosePreview,
      openPosition,
      openPixel: { r: openPixel[0], g: openPixel[1], b: openPixel[2] },
      arcPixel: { r: arcPixel[0], g: arcPixel[1], b: arcPixel[2] },
      closePixel: { r: closePixel[0], g: closePixel[1], b: closePixel[2] },
    };
  });

  // Open node should be visible
  expect(previewCheck.hasOpenNode).toBe(true);
  // Preview arc should be visible
  expect(previewCheck.hasPreviewArc).toBe(true);
  // Close node preview should be visible
  expect(previewCheck.hasClosePreview).toBe(true);
});

test('pressing Escape cancels node creation', async ({ page }) => {
  await page.goto('/');
  await waitForDb(page);

  // Insert a container
  await page.evaluate(async () => {
    const db = (window as any).__db;
    db.run(`INSERT INTO containers VALUES ('c1', NULL, 'Scene', '', 0.1, 0.9, datetime('now'), datetime('now'))`);
    await (window as any).__saveDb();
    (window as any).__reloadStore();
  });

  await page.waitForTimeout(200);

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not found');

  // Hover to show grid
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.waitForTimeout(100);

  // Click on 'event' cell to start node creation
  const grid = page.locator('[data-testid="hover-grid"]');
  await grid.locator('[data-type="event"]').click();

  await page.waitForTimeout(100);

  // Verify we're in creating-node mode
  let interactionState = await page.evaluate(() => {
    const manager = (window as any).__interactionManager;
    return manager ? manager.getState() : null;
  });
  expect(interactionState.mode).toBe('creating-node');

  // Press Escape to cancel
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);

  // Verify state is back to idle
  interactionState = await page.evaluate(() => {
    const manager = (window as any).__interactionManager;
    return manager ? manager.getState() : null;
  });
  expect(interactionState.mode).toBe('idle');

  // Verify no nodes were created
  const nodes = await page.evaluate(() => {
    const db = (window as any).__db;
    return db.exec('SELECT * FROM nodes');
  });
  expect(nodes.length).toBe(0);
});
