import { test, expect } from '@playwright/test';
import { setupFreshPage } from './helpers';

/**
 * NOTE: This file intentionally focuses on the "empty canvas" onboarding experience:
 * the very first interactions a user can perform in a fresh, empty timeline.
 */
test.describe('story:empty-canvas-onboarding', () => {
  test.beforeEach(async ({ page }) => {
    await setupFreshPage(page);
  });

  /**
   * The empty timeline should render with its basic structural elements:
   * an SVG container and at least one track line where nodes will be placed.
   */
  test('P0-structure: empty timeline renders with SVG and track line', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Empty canvas onboarding
    Path: P0-structure
    Steps:
    - The user opens the app on a fresh page with no story content.
    - The timeline renders its basic structure so the user can begin interacting.
    INTENT:END */

    // Verify: SVG timeline is rendered
    const svg = page.locator('[data-testid="timeline-svg"]');
    await expect(svg).toBeVisible();

    // Verify: Track line exists (it's styled with pointer-events:none)
    const trackLine = svg.locator('.track-line').first();
    await expect(trackLine).toBeAttached();
  });

  /**
   * When hovering in the node zone (middle area of the timeline),
   * the MICE type selector grid should appear, allowing the user
   * to start creating a node thread.
   */
  test('P1-hover-node-zone: hovering in node zone shows MICE grid on empty canvas', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Empty canvas onboarding
    Path: P1-hover-node-zone
    Steps:
    - The user hovers in the node interaction zone of an empty canvas.
    - The UI shows an affordance for creating a thread.
    INTENT:END */

    const svg = page.locator('[data-testid="timeline-svg"]');
    const box = await svg.boundingBox();
    expect(box).not.toBeNull();

    if (box) {
      // Action: Hover in the middle of the canvas (node zone)
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

      // Verify: MICE grid appears
      const miceGrid = page.locator('[data-testid="mice-grid"]');
      await expect(miceGrid).toBeVisible({ timeout: 2000 });
    }
  });

  /**
   * The MICE grid should be centered horizontally on an empty canvas,
   * providing a clear central starting point for the user.
   */
  test('P2-grid-centered: MICE grid is centered horizontally on empty canvas', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Empty canvas onboarding
    Path: P2-grid-centered
    Steps:
    - The user hovers in the node interaction zone of an empty canvas.
    - The UI presents the thread creation affordance at a clear, central starting location.
    INTENT:END */

    const svg = page.locator('[data-testid="timeline-svg"]');
    const svgBox = await svg.boundingBox();
    expect(svgBox).not.toBeNull();

    if (svgBox) {
      // Show the MICE grid by hovering in node zone
      await page.mouse.move(svgBox.x + svgBox.width / 2, svgBox.y + svgBox.height / 2);

      const miceGrid = page.locator('[data-testid="mice-grid"]');
      await expect(miceGrid).toBeVisible({ timeout: 2000 });

      const gridBox = await miceGrid.boundingBox();
      expect(gridBox).not.toBeNull();

      if (gridBox) {
        // Verify: Grid is roughly centered (within 50px)
        const gridCenterX = gridBox.x + gridBox.width / 2;
        const svgCenterX = svgBox.x + svgBox.width / 2;
        expect(Math.abs(gridCenterX - svgCenterX)).toBeLessThan(50);
      }
    }
  });

  /**
   * When hovering in the container zone (top area of the timeline),
   * a container handle should appear for creating new containers.
   */
  test('P3-hover-container-zone: hovering in container zone shows container handle on empty canvas', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Empty canvas onboarding
    Path: P3-hover-container-zone
    Steps:
    - The user hovers in the container interaction zone of an empty canvas.
    - The UI shows an affordance for creating a container.
    INTENT:END */

    const svg = page.locator('[data-testid="timeline-svg"]');
    const box = await svg.boundingBox();
    expect(box).not.toBeNull();

    if (box) {
      // Action: Hover near the top of the canvas (container zone - top 30px)
      await page.mouse.move(box.x + box.width / 2, box.y + 15);

      // Verify: Container handle appears
      const containerHandle = page.locator('[data-testid="container-handle"]');
      await expect(containerHandle).toBeVisible({ timeout: 2000 });
    }
  });

  test('P4-create-container: can create a container on an empty canvas', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Empty canvas onboarding
    Path: P4-create-container
    Steps:
    - The user starts creating a container on an empty canvas.
    - The user places the container start boundary at the only valid location.
    - The UI requires the user to place the container end boundary before any other action completes.
    - After the end boundary is placed, the container exists and is visible on the timeline.
    INTENT:END */

    const svg = page.locator('[data-testid="timeline-svg"]');
    const box = await svg.boundingBox();
    expect(box).not.toBeNull();

    // Verify: Canvas starts with no containers
    const initialContainers = await page.evaluate(() => {
      const db = (window as any).__db;
      const result = db.exec('SELECT COUNT(*) FROM containers');
      return result[0]?.values[0]?.[0] ?? 0;
    });
    expect(initialContainers).toBe(0);

    if (box) {
      // STEP 1: Hover in container zone at center to show the handle
      await page.mouse.move(box.x + box.width / 2, box.y + 15);
      await page.waitForTimeout(200);

      // Verify: Container handle appears at center (slot 0 position)
      const containerHandle = page.locator('[data-testid="container-handle"]');
      await expect(containerHandle).toBeVisible({ timeout: 2000 });

      // STEP 2: Click to start container creation at the only valid location on an empty canvas
      await containerHandle.dispatchEvent('click');
      await page.waitForTimeout(200);

      // Verify: Interaction state is 'placing-container-end'
      const interactionState = await page.evaluate(() => {
        const getState = (window as any).__timelineInteraction;
        return getState ? getState() : null;
      });
      expect(interactionState?.mode).toBe('placing-container-end');
      // impl: start boundary details are intentionally not asserted here; intent is that the mode is active

      // STEP 3: Move mouse to the right to show the end handle at boundary 0.5
      // The end handle should appear at a position to the RIGHT of the start
      await page.mouse.move(box.x + (box.width * 3) / 4, box.y + 15);
      await page.waitForTimeout(200);

      // Verify: End handle appears at a different position (boundary 0.5)
      const endHandle = page.locator('[data-testid="container-handle"]');
      await expect(endHandle).toBeVisible({ timeout: 2000 });

      // impl: we intentionally avoid strict pixel-position assertions here; the behavior is covered by the mode + DB assertions below

      // STEP 4: Click to place container's right edge at boundary 0.5
      await endHandle.dispatchEvent('click');
      await page.waitForTimeout(300);

      // Verify: Interaction state returns to idle
      const finalState = await page.evaluate(() => {
        const getState = (window as any).__timelineInteraction;
        return getState ? getState() : null;
      });
      expect(finalState?.mode).toBe('idle');

      // Verify: A container was created
      const containerCount = await page.evaluate(() => {
        const db = (window as any).__db;
        const result = db.exec('SELECT COUNT(*) FROM containers');
        return result[0]?.values[0]?.[0] ?? 0;
      });
      expect(containerCount).toBe(1);

      // Verify: Container spans slots 0-1 (two slots after insertion)
      const containerSlots = await page.evaluate(() => {
        const db = (window as any).__db;
        const result = db.exec('SELECT start_slot, end_slot FROM containers');
        return result[0]?.values[0] ?? [];
      });
      expect(containerSlots).toEqual([0, 1]);

      // Verify: Container is rendered on the timeline
      const containerSegment = page.locator('[data-testid="container-segment"]');
      await expect(containerSegment).toBeVisible();
    }
  });
});

test.describe('story:insert-thread-empty-canvas', () => {
  test.beforeEach(async ({ page }) => {
    await setupFreshPage(page);
  });

  /**
   * TWO-STEP THREAD CREATION ON EMPTY CANVAS
   *
   * Thread creation requires two clicks:
   * 1. First click places OPEN node and enters 'placing-node-close' mode
   * 2. Second click places CLOSE node at a valid half-step boundary
   *
   * After the first click, only the OPEN node should exist.
   * After the second click, both OPEN and CLOSE nodes should exist.
   */
  test('P0-start: first click places open node and enters close-placement mode', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Insert a thread on an empty canvas
    Path: P0-start
    Steps:
    - The user starts creating a thread on an empty canvas.
    - The first click places the opening node at the only valid start location.
    - The UI transitions into a state that requires placing the closing node.
    INTENT:END */

    const svg = page.locator('[data-testid="timeline-svg"]');
    const box = await svg.boundingBox();
    expect(box).not.toBeNull();

    if (box) {
      // STEP 1: Hover in node zone to show MICE grid
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

      const characterCell = page.locator('[data-testid="mice-grid"] [data-type="character"]');
      await expect(characterCell).toBeVisible({ timeout: 2000 });

      // STEP 2: Click to place OPEN node
      await characterCell.dispatchEvent('click');
      await page.waitForTimeout(200);

      // Verify: Interaction state is 'placing-node-close'
      const interactionState = await page.evaluate(() => {
        const getState = (window as any).__timelineInteraction;
        return getState ? getState() : null;
      });
      expect(interactionState?.mode).toBe('placing-node-close');

      // Verify: Only ONE node exists (the open node)
      const nodeCount = await page.evaluate(() => {
        const db = (window as any).__db;
        const result = db.exec('SELECT COUNT(*) FROM nodes');
        return result[0]?.values[0]?.[0] ?? 0;
      });
      expect(nodeCount).toBe(1);

      // Verify: The node is an 'open' node
      const nodeRole = await page.evaluate(() => {
        const db = (window as any).__db;
        const result = db.exec('SELECT role FROM nodes');
        return result[0]?.values[0]?.[0] ?? null;
      });
      expect(nodeRole).toBe('open');
    }
  });

  /**
   * TWO-STEP THREAD COMPLETION
   *
   * After placing the open node, the second click places the close node
   * at a valid half-step boundary position to the right of the open node.
   */
  test('P1-complete: second click places close node and completes thread', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Insert a thread on an empty canvas
    Path: P1-complete
    Steps:
    - The user begins creating a thread and has placed the opening node.
    - When the user hovers near a valid closing-node insert location, the UI shows a semi-transparent preview of the closing node and the arc connecting it to the opening node, and does not show that preview at invalid closing-node locations.
    - The user clicks the preview closing node to place the closing node.
    - The thread is complete and the UI returns to the idle interaction state.
    INTENT:END */

    const svg = page.locator('[data-testid="timeline-svg"]');
    const box = await svg.boundingBox();
    expect(box).not.toBeNull();

    if (box) {
      // Place open node first
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

      const characterCell = page.locator('[data-testid="mice-grid"] [data-type="character"]');
      await expect(characterCell).toBeVisible({ timeout: 2000 });
      await characterCell.dispatchEvent('click');
      await page.waitForTimeout(200);

      // Verify we're in placing-node-close mode
      let interactionState = await page.evaluate(() => {
        const getState = (window as any).__timelineInteraction;
        return getState ? getState() : null;
      });
      expect(interactionState?.mode).toBe('placing-node-close');

      // STEP 3: Hover an invalid close location (at/before the open node) - no preview
      await page.mouse.move(box.x + 2, box.y + box.height / 2);
      await page.waitForTimeout(200);

      const closePreview = page.locator('[data-testid="close-node-preview"]');
      const previewArc = page.locator('[data-testid="thread-preview-arc"]');
      await expect(closePreview).not.toBeVisible();
      await expect(previewArc).not.toBeVisible();

      // STEP 4: Hover a valid close location - preview appears
      await page.mouse.move(box.x + (box.width * 3) / 4, box.y + box.height / 2);
      await page.waitForTimeout(200);

      await expect(closePreview).toBeVisible({ timeout: 2000 });
      await expect(previewArc).toBeVisible({ timeout: 2000 });

      const previewOpacity = await closePreview.getAttribute('opacity');
      expect(previewOpacity).toBeTruthy();
      expect(parseFloat(previewOpacity || '1')).toBeLessThan(1);

      // STEP 5: Click the preview closing node to place the close node
      await closePreview.dispatchEvent('click');
      await page.waitForTimeout(300);

      // Verify: Interaction state returns to idle
      interactionState = await page.evaluate(() => {
        const getState = (window as any).__timelineInteraction;
        return getState ? getState() : null;
      });
      expect(interactionState?.mode).toBe('idle');

      // Verify: Now TWO nodes exist (open and close)
      const nodeCount = await page.evaluate(() => {
        const db = (window as any).__db;
        const result = db.exec('SELECT COUNT(*) FROM nodes');
        return result[0]?.values[0]?.[0] ?? 0;
      });
      expect(nodeCount).toBe(2);

      // Verify: Both nodes have the same thread_id
      const threadIds = await page.evaluate(() => {
        const db = (window as any).__db;
        const result = db.exec('SELECT thread_id FROM nodes');
        return result[0]?.values?.map((r: any[]) => r[0]) ?? [];
      });
      expect(threadIds[0]).toBe(threadIds[1]);

      // Verify: Both nodes have NULL containerId (no auto-container)
      const containerIds = await page.evaluate(() => {
        const db = (window as any).__db;
        const result = db.exec('SELECT container_id FROM nodes');
        return result[0]?.values?.map((r: any[]) => r[0]) ?? [];
      });
      expect(containerIds).toEqual([null, null]);

      // Verify: No containers were auto-created
      const containerCount = await page.evaluate(() => {
        const db = (window as any).__db;
        const result = db.exec('SELECT COUNT(*) FROM containers');
        return result[0]?.values[0]?.[0] ?? 0;
      });
      expect(containerCount).toBe(0);
    }
  });

  /**
   * ESCAPE CANCELS NODE PLACEMENT
   *
   * If user is in 'placing-node-close' mode and presses Escape,
   * the operation should be cancelled and the open node should be removed.
   */
  test('P2-cancel: escape cancels node placement and removes the open node', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Insert a thread on an empty canvas
    Path: P2-cancel
    Steps:
    - The user begins creating a thread and has placed the opening node.
    - The user cancels the operation.
    - The partial thread is discarded and the UI returns to the idle interaction state.
    INTENT:END */

    const svg = page.locator('[data-testid="timeline-svg"]');
    const box = await svg.boundingBox();
    expect(box).not.toBeNull();

    if (box) {
      // Place open node
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

      const characterCell = page.locator('[data-testid="mice-grid"] [data-type="character"]');
      await expect(characterCell).toBeVisible({ timeout: 2000 });
      await characterCell.dispatchEvent('click');
      await page.waitForTimeout(200);

      // Verify we're in placing-node-close mode with 1 node
      let interactionState = await page.evaluate(() => {
        const getState = (window as any).__timelineInteraction;
        return getState ? getState() : null;
      });
      expect(interactionState?.mode).toBe('placing-node-close');

      let nodeCount = await page.evaluate(() => {
        const db = (window as any).__db;
        const result = db.exec('SELECT COUNT(*) FROM nodes');
        return result[0]?.values[0]?.[0] ?? 0;
      });
      expect(nodeCount).toBe(1);

      // Press Escape to cancel
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);

      // Verify: Interaction state returns to idle
      interactionState = await page.evaluate(() => {
        const getState = (window as any).__timelineInteraction;
        return getState ? getState() : null;
      });
      expect(interactionState?.mode).toBe('idle');

      // Verify: The open node was removed (cancelled operation)
      nodeCount = await page.evaluate(() => {
        const db = (window as any).__db;
        const result = db.exec('SELECT COUNT(*) FROM nodes');
        return result[0]?.values[0]?.[0] ?? 0;
      });
      expect(nodeCount).toBe(0);
    }
  });
});
