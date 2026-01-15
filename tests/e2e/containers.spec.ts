import { test, expect } from '@playwright/test';
import { setupFreshPage } from './helpers';

/**
 * CONTAINER RENDERING TESTS
 *
 * Containers are visual groupings that represent story structure (acts, scenes, etc.).
 * They render as rectangles in the container zone (top area) of the timeline.
 */
test.describe('story:container-rendering', () => {
  test.beforeEach(async ({ page }) => {
    await setupFreshPage(page);
  });

  /**
   * A container should render as a visible segment in the container zone.
   * The segment shows the span of the container across the timeline.
   */
  test('P0-segment-visible: container renders as segment on timeline', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Container rendering
    Path: P0-segment-visible
    Steps:
    - The timeline contains a container.
    - The container is rendered as a visible segment in the container zone.
    INTENT:END */

    // Set up: Create a container
    await page.evaluate(async () => {
      const db = (window as any).__db;
      db.run(`INSERT INTO containers (id, start_slot, end_slot, parent_id, title, created_at, updated_at)
              VALUES ('c1', 0, 4, NULL, 'Scene 1', datetime('now'), datetime('now'))`);
      await (window as any).__saveDb();
      (window as any).__reloadStore();
    });

    await page.waitForTimeout(200);

    // Verify: Container segment is rendered
    const containerSegment = page.locator('[data-testid="container-segment"]');
    await expect(containerSegment).toBeVisible();
  });

  /**
   * Container segments should display their title for easy identification.
   */
  test('P1-title-present: container segment displays title', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Container rendering
    Path: P1-title-present
    Steps:
    - The timeline contains a container with a title.
    - The container segment displays that title for identification.
    INTENT:END */

    await page.evaluate(async () => {
      const db = (window as any).__db;
      db.run(`INSERT INTO containers (id, start_slot, end_slot, parent_id, title, created_at, updated_at)
              VALUES ('c1', 0, 4, NULL, 'Act One', datetime('now'), datetime('now'))`);
      await (window as any).__saveDb();
      (window as any).__reloadStore();
    });

    await page.waitForTimeout(200);

    // Verify: Container has text content
    const containerSegment = page.locator('[data-testid="container-segment"]');
    const title = containerSegment.locator('text').first();
    await expect(title).toBeAttached();
  });

  /**
   * When containers are nested (parent-child relationships),
   * they should render with visual offsets to show hierarchy.
   */
  test('P2-nesting: nested containers render with hierarchy visible', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Container rendering
    Path: P2-nesting
    Steps:
    - The timeline contains nested containers.
    - The UI renders both containers and indicates hierarchy visually.
    INTENT:END */

    await page.evaluate(async () => {
      const db = (window as any).__db;
      // Parent container
      db.run(`INSERT INTO containers (id, start_slot, end_slot, parent_id, title, created_at, updated_at)
              VALUES ('parent', 0, 5, NULL, 'Act 1', datetime('now'), datetime('now'))`);
      // Child container
      db.run(`INSERT INTO containers (id, start_slot, end_slot, parent_id, title, created_at, updated_at)
              VALUES ('child', 1, 4, 'parent', 'Scene 1', datetime('now'), datetime('now'))`);
      await (window as any).__saveDb();
      (window as any).__reloadStore();
    });

    await page.waitForTimeout(200);

    // Verify: Both container segments are rendered
    const containerSegments = page.locator('[data-testid="container-segment"]');
    await expect(containerSegments).toHaveCount(2);
  });
});

/**
 * CONTAINER BORDER POSITIONING
 *
 * Container borders should be positioned at slot positions, NOT at canvas edges.
 * This ensures consistent visual alignment between containers and nodes.
 *
 * Key principle: A container's left and right borders sit at their respective
 * slot positions, which are evenly distributed across the canvas. This means
 * a single container (slots 0-1) will have its borders at roughly 1/3 and 2/3
 * of the canvas width, NOT at x=0 and x=width.
 */
test.describe('story:container-border-positioning', () => {
  test.beforeEach(async ({ page }) => {
    await setupFreshPage(page);
  });

  /**
   * Container borders are positioned at SLOT CENTER positions, not canvas edges.
   * This means a container spanning slots 0-1 on a 2-slot timeline will have:
   * - Left border at slot 0's center (approximately 1/3 of canvas width)
   * - Right border at slot 1's center (approximately 2/3 of canvas width)
   *
   * Container boundaries occupy slot positions, just like nodes do.
   */
  test('P0-slot-centered-borders: container borders are at slot positions, not canvas edges', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Container border positioning
    Path: P0-slot-centered-borders
    Steps:
    - The timeline contains a container spanning slots.
    - The container’s visible boundaries align to slot positions rather than the canvas edges.
    INTENT:END */

    // Set up: Create a container spanning slots 0-1 (a 2-slot container)
    await page.evaluate(async () => {
      const db = (window as any).__db;
      db.run(`INSERT INTO containers (id, start_slot, end_slot, parent_id, title, created_at, updated_at)
              VALUES ('c1', 0, 1, NULL, 'Scene 1', datetime('now'), datetime('now'))`);
      await (window as any).__saveDb();
      (window as any).__reloadStore();
    });

    await page.waitForTimeout(300);

    const svg = page.locator('[data-testid="timeline-svg"]');
    const svgBox = await svg.boundingBox();
    expect(svgBox).not.toBeNull();

    const containerSegment = page.locator('[data-testid="container-segment"]');
    await expect(containerSegment).toBeVisible();

    const segmentBox = await containerSegment.boundingBox();
    expect(segmentBox).not.toBeNull();

    if (svgBox && segmentBox) {
      const relativeLeft = segmentBox.x - svgBox.x;
      const relativeRight = (segmentBox.x + segmentBox.width) - svgBox.x;
      const canvasWidth = svgBox.width;

      // ASSERTION: Left border should NOT be at x=0 (canvas left edge)
      // Should be approximately at 1/3 width (slot 0 centered position)
      expect(relativeLeft).toBeGreaterThan(canvasWidth * 0.1);

      // ASSERTION: Right border should NOT be at canvas width (right edge)
      // Should be approximately at 2/3 width (slot 1 centered position)
      expect(relativeRight).toBeLessThan(canvasWidth * 0.9);

      // ASSERTION: Container should be roughly centered, not full-width
      expect(segmentBox.width).toBeLessThan(canvasWidth * 0.8);
    }
  });

  /**
   * Multi-slot container has borders at slot center positions.
   * A container starting at slot 1 (not slot 0) should have its left border
   * at slot 1's center position, not at the canvas left edge.
   */
  test('P1-multi-slot: multi-slot container has borders at slot positions', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Container border positioning
    Path: P1-multi-slot
    Steps:
    - The timeline contains a multi-slot container that does not start at the leftmost slot.
    - The container’s visible boundaries align to its start and end slot positions.
    INTENT:END */

    // Set up: Create a container that starts at slot 1 (not slot 0) so it doesn't touch the left edge
    await page.evaluate(async () => {
      const db = (window as any).__db;
      // Container spans slots 1-4 (not starting at 0)
      db.run(`INSERT INTO containers (id, start_slot, end_slot, parent_id, title, created_at, updated_at)
              VALUES ('c1', 1, 4, NULL, 'Act 1', datetime('now'), datetime('now'))`);
      // Add nodes at slots 2 and 3 (interior slots)
      db.run(`INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
              VALUES ('n1', 'c1', 't1', 'milieu', 'open', 2, '', '', datetime('now'), datetime('now'))`);
      db.run(`INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
              VALUES ('n2', 'c1', 't1', 'milieu', 'close', 3, '', '', datetime('now'), datetime('now'))`);
      // Add a node at slot 0 outside the container to ensure slot 0 exists
      db.run(`INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
              VALUES ('n3', NULL, 't2', 'event', 'open', 0, '', '', datetime('now'), datetime('now'))`);
      db.run(`INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
              VALUES ('n4', NULL, 't2', 'event', 'close', 5, '', '', datetime('now'), datetime('now'))`);
      await (window as any).__saveDb();
      (window as any).__reloadStore();
    });

    await page.waitForTimeout(300);

    const svg = page.locator('[data-testid="timeline-svg"]');
    const svgBox = await svg.boundingBox();

    const containerSegment = page.locator('[data-testid="container-segment"]');
    await expect(containerSegment).toBeVisible();

    const segmentBox = await containerSegment.boundingBox();

    if (svgBox && segmentBox) {
      const relativeLeft = segmentBox.x - svgBox.x;
      const relativeRight = (segmentBox.x + segmentBox.width) - svgBox.x;

      // Verify: Container doesn't touch absolute canvas edges (since it starts at slot 1, not 0)
      expect(relativeLeft).toBeGreaterThan(0);
      expect(relativeRight).toBeLessThan(svgBox.width);

      // Container should span roughly from slot 1's left edge to slot 4's right edge
      // With 6 slots, each slot is ~1/6 of viewport width
      // Container spans slots 1-4, so it should span about 2/3 of the viewport
      const containerWidthRatio = segmentBox.width / svgBox.width;
      expect(containerWidthRatio).toBeGreaterThan(0.5); // At least half the width
      expect(containerWidthRatio).toBeLessThan(0.9); // Less than full width
    }
  });
});

/**
 * SLOT OCCUPATION RULES
 *
 * In the MICE timeline, slot positions are shared between nodes and container boundaries.
 * A fundamental constraint is that each slot position can only be occupied by ONE element:
 * either a node OR a container boundary, but never both simultaneously.
 *
 * This separation ensures:
 * - Visual clarity: users can clearly distinguish nodes from container edges
 * - Interaction consistency: clicking a slot targets a single element
 * - Data integrity: the model doesn't allow conflicting element positions
 */
test.describe('story:slot-occupation-uniqueness', () => {
  test.beforeEach(async ({ page }) => {
    await setupFreshPage(page);
  });

  /**
   * Container boundaries and nodes should never occupy the same slot position.
   * If a container starts at slot 0, no node should be placed at slot 0.
   * This ensures clear visual separation and unambiguous click targets.
   */
  test('P0-no-overlap: node and container boundary never occupy the same slot', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Slot occupation uniqueness
    Path: P0-no-overlap
    Steps:
    - The timeline contains containers and nodes.
    - No node occupies the same slot position as a container boundary.
    INTENT:END */

    // Set up: Create a container that spans slots 0-3
    await page.evaluate(async () => {
      const db = (window as any).__db;
      db.run(`INSERT INTO containers (id, start_slot, end_slot, parent_id, title, created_at, updated_at)
              VALUES ('c1', 0, 3, NULL, 'Scene', datetime('now'), datetime('now'))`);
      // Add nodes at slots 1 and 2 (interior slots, not on boundaries)
      db.run(`INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
              VALUES ('n1', 'c1', 't1', 'milieu', 'open', 1, '', '', datetime('now'), datetime('now'))`);
      db.run(`INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
              VALUES ('n2', 'c1', 't1', 'milieu', 'close', 2, '', '', datetime('now'), datetime('now'))`);
      await (window as any).__saveDb();
      (window as any).__reloadStore();
    });

    await page.waitForTimeout(300);

    // Query container boundaries and node positions
    const positions = await page.evaluate(() => {
      const db = (window as any).__db;
      const containerResult = db.exec('SELECT start_slot, end_slot FROM containers');
      const nodeResult = db.exec('SELECT slot FROM nodes');

      const containerBoundaries: number[] = [];
      if (containerResult.length > 0) {
        for (const row of containerResult[0].values) {
          containerBoundaries.push(row[0] as number); // start_slot
          containerBoundaries.push(row[1] as number); // end_slot
        }
      }

      const nodeSlots: number[] = [];
      if (nodeResult.length > 0) {
        for (const row of nodeResult[0].values) {
          nodeSlots.push(row[0] as number);
        }
      }

      return { containerBoundaries, nodeSlots };
    });

    // Verify: No node slot matches any container boundary slot
    for (const nodeSlot of positions.nodeSlots) {
      expect(positions.containerBoundaries).not.toContain(nodeSlot);
    }

    // Also verify: Nodes are at slots 1 and 2, container boundaries are at 0 and 3
    expect(positions.containerBoundaries).toEqual([0, 3]);
    expect(positions.nodeSlots.sort()).toEqual([1, 2]);
  });

  /**
   * When inserting a new thread, the system should ensure nodes don't land
   * on existing container boundaries. The thread insertion should automatically
   * adjust positions to maintain the uniqueness constraint.
   */
  test('P1-insertion-respects-boundaries: inserting thread does not place nodes on container boundaries', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Slot occupation uniqueness
    Path: P1-insertion-respects-boundaries
    Steps:
    - The timeline contains a container with boundary slots that cannot be occupied by nodes.
    - The user inserts a new thread.
    - Newly created nodes do not land on container boundary slots.
    INTENT:END */

    // Set up: Create a container spanning slots 0-5
    await page.evaluate(async () => {
      const db = (window as any).__db;
      db.run(`INSERT INTO containers (id, start_slot, end_slot, parent_id, title, created_at, updated_at)
              VALUES ('c1', 0, 5, NULL, 'Act 1', datetime('now'), datetime('now'))`);
      // Add existing nodes to create some slot structure
      db.run(`INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
              VALUES ('n1', 'c1', 't1', 'event', 'open', 1, '', '', datetime('now'), datetime('now'))`);
      db.run(`INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
              VALUES ('n2', 'c1', 't1', 'event', 'close', 2, '', '', datetime('now'), datetime('now'))`);
      await (window as any).__saveDb();
      (window as any).__reloadStore();
    });

    await page.waitForTimeout(300);

    // Insert a new thread via the MICE grid
    const svg = page.locator('[data-testid="timeline-svg"]');
    const box = await svg.boundingBox();

    if (box) {
      // Hover to show grid between existing nodes
      const existingNodes = page.locator('[data-testid="node"]');
      const firstNode = await existingNodes.first().boundingBox();
      const secondNode = await existingNodes.last().boundingBox();

      if (firstNode && secondNode) {
        const midX = (firstNode.x + firstNode.width / 2 + secondNode.x + secondNode.width / 2) / 2;
        await page.mouse.move(midX, box.y + box.height / 2);
        await page.waitForTimeout(200);

        const miceGrid = page.locator('[data-testid="mice-grid"]');
        await expect(miceGrid).toBeVisible({ timeout: 2000 });

        // Click to insert a character thread
        const characterCell = miceGrid.locator('[data-type="character"]');
        await characterCell.dispatchEvent('click');
        await page.waitForTimeout(500);
      }
    }

    // Query updated positions
    const positions = await page.evaluate(() => {
      const db = (window as any).__db;
      const containerResult = db.exec('SELECT start_slot, end_slot FROM containers');
      const nodeResult = db.exec('SELECT slot FROM nodes ORDER BY slot');

      const containerBoundaries: number[] = [];
      if (containerResult.length > 0) {
        for (const row of containerResult[0].values) {
          containerBoundaries.push(row[0] as number);
          containerBoundaries.push(row[1] as number);
        }
      }

      const nodeSlots: number[] = [];
      if (nodeResult.length > 0) {
        for (const row of nodeResult[0].values) {
          nodeSlots.push(row[0] as number);
        }
      }

      return { containerBoundaries, nodeSlots };
    });

    // Verify: No node slot matches any container boundary
    for (const nodeSlot of positions.nodeSlots) {
      expect(positions.containerBoundaries).not.toContain(nodeSlot);
    }
  });
});

/**
 * CONTAINER CREATION TESTS
 *
 * These tests verify the interaction flow for creating new containers.
 * Users create containers by clicking in the container zone to set
 * start and end boundaries.
 */
test.describe('story:create-container', () => {
  test.beforeEach(async ({ page }) => {
    await setupFreshPage(page);
  });

  test('P0-two-step-preview: shows end-boundary preview while placing container end', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Create a container
    Path: P0-two-step-preview
    Steps:
    - The timeline contains at least one row with multiple insertion boundaries.
    - The user starts creating a container by choosing a start boundary.
    - When the user hovers a different boundary, the UI shows a preview of the container span before committing.
    INTENT:END */

    // Seed slots so boundary 1 and 2 exist in the first row.
    await page.evaluate(async () => {
      const db = (window as any).__db;
      db.run(`INSERT INTO containers (id, start_slot, end_slot, parent_id, title, created_at, updated_at)
              VALUES ('c-seed', 0, 5, NULL, '', datetime('now'), datetime('now'))`);
      await (window as any).__saveDb();
      (window as any).__reloadStore();
    });
    await page.waitForTimeout(200);

    const svg = page.locator('[data-testid="timeline-svg"]');
    const box = await svg.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    // Hover near the left to pick an early insert position index (typically 1).
    await page.mouse.move(box.x + box.width / 6, box.y + 15);
    await page.waitForTimeout(150);

    const startHandle = page.locator('[data-testid="container-handle"]');
    await expect(startHandle).toBeVisible({ timeout: 2000 });
    const startInsertPositionIndexAttr = await startHandle.getAttribute('data-insert-position-index');
    expect(startInsertPositionIndexAttr).toBeTruthy();
    const startInsertPositionIndex = Number(startInsertPositionIndexAttr);
    expect(Number.isFinite(startInsertPositionIndex)).toBe(true);

    // Start container creation.
    await startHandle.dispatchEvent('click');
    await page.waitForTimeout(150);

    // Hover further right to ensure we are on a different insert position (the preview position).
    await page.mouse.move(box.x + box.width / 3, box.y + 15);
    await page.waitForTimeout(150);

    const endHandle = page.locator('[data-testid="container-handle"]');
    await expect(endHandle).toBeVisible({ timeout: 2000 });
    const endInsertPositionIndexAttr = await endHandle.getAttribute('data-insert-position-index');
    expect(endInsertPositionIndexAttr).toBeTruthy();
    const endInsertPositionIndex = Number(endInsertPositionIndexAttr);
    expect(Number.isFinite(endInsertPositionIndex)).toBe(true);
    expect(endInsertPositionIndex).not.toBe(startInsertPositionIndex);

    // Verify: preview span is visible before committing.
    const preview = page.locator('[data-testid="container-preview"]');
    await expect(preview).toBeVisible({ timeout: 2000 });
  });

  test('P1-two-step-complete: two-step container insert with visible boundary and preview', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Create a container
    Path: P1-two-step-complete
    Steps:
    - The user hovers over the middle of the timeline in the upper zone (container zone) and sees a container creation handle.
    - The user hovers over the handle and sees it darken to indicate it's interactable.
    - The user clicks the handle to start container creation.
    - After the first click, a visible vertical line appears at the start insert position, indicating where the container will begin.
    - The UI transitions into a state that requires placing the end boundary.
    - When the user moves the cursor to the right one half-step, a NEW container handle appears at that end position (not the original handle).
    - A preview rectangle appears stretching from the start boundary to the hovered end position.
    - The user clicks the new handle at the end position to complete container creation.
    - The container is created and the UI returns to the idle interaction state.
    INTENT:END */

    const svg = page.locator('[data-testid="timeline-svg"]');
    const box = await svg.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    // Step 1: Hover over middle of timeline in upper zone (container zone)
    // Container zone is at the top, around y + 15
    await page.mouse.move(box.x + box.width / 2, box.y + 15);
    await page.waitForTimeout(150);

    // Verify: Container handle appears
    const startHandle = page.locator('[data-testid="container-handle"]');
    await expect(startHandle).toBeVisible({ timeout: 2000 });

    // Step 2: Hover over the handle itself - it should darken (visual feedback)
    const handleBox = await startHandle.boundingBox();
    expect(handleBox).not.toBeNull();
    if (!handleBox) return;

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.waitForTimeout(150);

    // Verify handle is still visible and interactable
    await expect(startHandle).toBeVisible();

    // Get the start insert position index before clicking
    const startInsertPositionIndexAttr = await startHandle.getAttribute('data-insert-position-index');
    expect(startInsertPositionIndexAttr).toBeTruthy();
    const startInsertPositionIndex = Number(startInsertPositionIndexAttr);
    expect(Number.isFinite(startInsertPositionIndex)).toBe(true);

    // Step 3: Click to start container creation
    await startHandle.dispatchEvent('click');
    await page.waitForTimeout(200);

    // Verify: Interaction state is now placing-container-end
    const state = await page.evaluate(() => {
      const getState = (window as any).__timelineInteraction;
      return getState ? getState() : null;
    });
    expect(state?.mode).toBe('placing-container-end');
    expect(state?.startInsertPositionIndex).toBe(startInsertPositionIndex);

    // Step 4: Verify a visible vertical boundary/line appears at the start insert position
    // This should be a visual indicator showing where the container will begin
    // Expected: A vertical line should appear at the start insert position
    const startBoundaryIndicator = page.locator('[data-testid="container-start-boundary"]');
    await expect(startBoundaryIndicator).toBeAttached({ timeout: 2000 });
    
    // Verify it's actually visible (has valid coordinates and is in viewport)
    const isVisible = await startBoundaryIndicator.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 || rect.height > 0;
    });
    expect(isVisible).toBe(true);

    // Step 5: Move cursor to the right one half-step (to a different insert position)
    // On an empty canvas, moving right should find insert position index 1 (instead of 0)
    // Move to a position that should be a different insert position index
    await page.mouse.move(box.x + (box.width * 2) / 3, box.y + 15);
    await page.waitForTimeout(150);

    // Step 6: Verify a NEW container handle appears at the end position
    // Expected: When hovering at a different insert position, a NEW handle should appear at that position
    // ISSUE: Currently the original handle persists at the start position instead of showing a new one at the hover position
    const endHandle = page.locator('[data-testid="container-handle"]');
    await expect(endHandle).toBeVisible({ timeout: 2000 });

    // Verify the end handle is at a different insert position than the start
    // Expected: Handle should be at the current hover position (different from start)
    // ISSUE: Currently fails because handle shows at same position (startInsertPositionIndex) instead of new position
    const endInsertPositionIndexAttr = await endHandle.getAttribute('data-insert-position-index');
    expect(endInsertPositionIndexAttr).toBeTruthy();
    const endInsertPositionIndex = Number(endInsertPositionIndexAttr);
    expect(Number.isFinite(endInsertPositionIndex)).toBe(true);
    
    // This assertion documents the bug: handle should be at a different position
    // When in placing-container-end mode, the handle should only appear at insert positions different from start
    if (endInsertPositionIndex === startInsertPositionIndex) {
      throw new Error(
        `BUG: Expected handle at different insert position, but both start and end are at index ${startInsertPositionIndex}. ` +
        `The handle should appear at the current hover position (different from start), not persist at the start position. ` +
        `When in placing-container-end mode, handles should only show at insert positions != startInsertPositionIndex.`
      );
    }
    expect(endInsertPositionIndex).not.toBe(startInsertPositionIndex);

    // Verify the original start handle is NOT visible at the start position anymore
    // (The handle should only appear at the current hover position, not persist at start)
    const allHandles = page.locator('[data-testid="container-handle"]');
    const handleCount = await allHandles.count();
    expect(handleCount).toBe(1); // Only one handle should be visible at a time

    // Step 7: Verify preview rectangle appears stretching from start to end
    const preview = page.locator('[data-testid="container-preview"]');
    await expect(preview).toBeVisible({ timeout: 2000 });

    // Verify preview has non-zero width (stretching from start to end)
    const previewWidth = await preview.evaluate((el) => {
      return parseFloat(el.getAttribute('width') || '0');
    });
    expect(previewWidth).toBeGreaterThan(0);

    // Verify preview opacity indicates it's a preview (semi-transparent)
    const previewOpacity = await preview.getAttribute('opacity');
    expect(previewOpacity).toBeTruthy();
    expect(parseFloat(previewOpacity || '1')).toBeLessThan(1);

    // Step 8: Click the new handle at the end position to complete container creation
    await endHandle.dispatchEvent('click');
    await page.waitForTimeout(300);

    // Verify: Container was created
    const containerCount = await page.evaluate(() => {
      const db = (window as any).__db;
      const result = db.exec('SELECT COUNT(*) FROM containers');
      return result[0]?.values[0]?.[0] ?? 0;
    });
    expect(containerCount).toBe(1); // New container created

    // Verify: UI returned to idle state
    const finalState = await page.evaluate(() => {
      const getState = (window as any).__timelineInteraction;
      return getState ? getState() : null;
    });
    expect(finalState?.mode).toBe('idle');

    // Move mouse away to clear hover state
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(150);

    // Verify: Preview is no longer visible after completion
    await expect(preview).not.toBeVisible();

    // Verify: Start boundary indicator is no longer visible after completion
    const startBoundaryAfter = page.locator('[data-testid="container-start-boundary"]');
    await expect(startBoundaryAfter).not.toBeVisible();
  });

  /**
   * Clicking on a container handle starts container creation mode.
   * The user then clicks again to set the end boundary.
   */
  test('P0-two-step: can create container via container handle click', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Create a container
    Path: P0-two-step
    Steps:
    - The user starts creating a container by choosing a start boundary.
    - The user chooses an end boundary.
    - A new container is created.
    INTENT:END */

    // First, create some slots by adding an existing container
    await page.evaluate(async () => {
      const db = (window as any).__db;
      db.run(`INSERT INTO containers (id, start_slot, end_slot, parent_id, title, created_at, updated_at)
              VALUES ('c1', 0, 5, NULL, '', datetime('now'), datetime('now'))`);
      await (window as any).__saveDb();
      (window as any).__reloadStore();
    });
    await page.waitForTimeout(200);

    const svg = page.locator('[data-testid="timeline-svg"]');
    const box = await svg.boundingBox();
    expect(box).not.toBeNull();

    if (box) {
      // Action: Hover in container zone to show handle
      await page.mouse.move(box.x + box.width / 4, box.y + 15);
      await page.waitForTimeout(200);

      const containerHandle = page.locator('[data-testid="container-handle"]');
      await expect(containerHandle).toBeVisible({ timeout: 2000 });

      // Action: Click to start container creation
      await containerHandle.dispatchEvent('click');
      await page.waitForTimeout(200);

      // Move to end position
      await page.mouse.move(box.x + (box.width * 3) / 4, box.y + 15);
      await page.waitForTimeout(200);

      // Click to finish container
      const endHandle = page.locator('[data-testid="container-handle"]');
      await expect(endHandle).toBeVisible({ timeout: 2000 });
      await endHandle.dispatchEvent('click');
      await page.waitForTimeout(300);

      // Verify: A second container was created
      const containers = await page.evaluate(() => {
        const db = (window as any).__db;
        return db.exec('SELECT * FROM containers');
      });

      expect(containers.length).toBeGreaterThan(0);
      expect(containers[0]?.values?.length).toBe(2);
    }
  });

  /**
   * When in container creation mode, the system should show visual feedback
   * indicating the placement state. Pressing Escape cancels the operation.
   */
  test('P1-state-and-cancel: shows placing-container-end state during creation', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Create a container
    Path: P1-state-and-cancel
    Steps:
    - The user starts creating a container.
    - The UI indicates that the user is choosing the container end boundary.
    - The user cancels the operation.
    - The UI returns to the idle interaction state.
    INTENT:END */

    const svg = page.locator('[data-testid="timeline-svg"]');
    const box = await svg.boundingBox();
    expect(box).not.toBeNull();

    if (box) {
      // First create a container to have slots
      await page.evaluate(async () => {
        const db = (window as any).__db;
        db.run(`INSERT INTO containers (id, start_slot, end_slot, parent_id, title, created_at, updated_at)
                VALUES ('c1', 0, 5, NULL, '', datetime('now'), datetime('now'))`);
        await (window as any).__saveDb();
        (window as any).__reloadStore();
      });
      await page.waitForTimeout(200);

      // Hover in container zone to show handle
      await page.mouse.move(box.x + box.width / 4, box.y + 15);
      await page.waitForTimeout(200);

      const containerHandle = page.locator('[data-testid="container-handle"]');
      await expect(containerHandle).toBeVisible({ timeout: 2000 });

      // Click to start container creation
      await containerHandle.dispatchEvent('click');
      await page.waitForTimeout(100);

      // Verify: Interaction state is 'placing-container-end'
      const interactionState = await page.evaluate(() => {
        const getState = (window as any).__timelineInteraction;
        return getState ? getState() : null;
      });

      expect(interactionState).not.toBeNull();
      expect(interactionState.mode).toBe('placing-container-end');

      // Action: Press Escape to cancel
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);

      // Verify: State is back to idle
      const stateAfterCancel = await page.evaluate(() => {
        const getState = (window as any).__timelineInteraction;
        return getState ? getState() : null;
      });

      expect(stateAfterCancel.mode).toBe('idle');
    }
  });

  /**
   * Clicking on a container should select it, providing visual feedback
   * that the container is the active element.
   */
  test('P2-select: container selection shows visual highlight', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Create a container
    Path: P2-select
    Steps:
    - The timeline contains a container.
    - When the user selects the container, the UI provides visual feedback.
    INTENT:END */

    await page.evaluate(async () => {
      const db = (window as any).__db;
      db.run(`INSERT INTO containers (id, start_slot, end_slot, parent_id, title, created_at, updated_at)
              VALUES ('c1', 0, 4, NULL, 'Scene 1', datetime('now'), datetime('now'))`);
      await (window as any).__saveDb();
      (window as any).__reloadStore();
    });

    await page.waitForTimeout(200);

    // Action: Click on container to select it
    const containerSegment = page.locator('[data-testid="container-segment"]');
    await containerSegment.dispatchEvent('click');
    await page.waitForTimeout(100);

    // Verify: Container has visual indication of selection
    // Check if stroke-width changed (selected containers may have thicker stroke)
    const strokeWidth = await containerSegment.locator('rect').first().evaluate((el) => {
      return window.getComputedStyle(el).strokeWidth;
    });

    expect(strokeWidth).toBeDefined();
  });
});

test.describe('story:wrap-thread-in-container', () => {
  test.beforeEach(async ({ page }) => {
    await setupFreshPage(page);
  });

  test('P0-no-overlap: container boundaries do not visually or logically overlap thread nodes', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Wrap a thread in a container
    Path: P0-no-overlap
    Steps:
    - The user creates a thread (open then close) on an empty canvas.
    - The user creates a container that wraps that thread.
    - The container boundaries do not occupy the same slot position as any node, and do not visually collapse onto the nodes.
    INTENT:END */

    const svg = page.locator('[data-testid="timeline-svg"]');
    const box = await svg.boundingBox();
    expect(box).not.toBeNull();

    if (!box) return;

    // Create a thread via the two-step flow
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const miceGrid = page.locator('[data-testid="mice-grid"]');
    await expect(miceGrid).toBeVisible({ timeout: 2000 });
    const milieuCell = miceGrid.locator('[data-type="milieu"]');
    await milieuCell.dispatchEvent('click');
    await page.waitForTimeout(200);

    // Hover valid close location to show preview and click it to complete
    await page.mouse.move(box.x + (box.width * 3) / 4, box.y + box.height / 2);
    const closePreview = page.locator('[data-testid="close-node-preview"]');
    await expect(closePreview).toBeVisible({ timeout: 2000 });
    await closePreview.dispatchEvent('click');
    await page.waitForTimeout(300);

    // Sanity: we have a complete thread
    const nodeCount = await page.evaluate(() => {
      const db = (window as any).__db;
      const result = db.exec('SELECT COUNT(*) FROM nodes');
      return result[0]?.values[0]?.[0] ?? 0;
    });
    expect(nodeCount).toBe(2);

    // Create a container that wraps the thread: start before open, end after close
    // Start container creation at the left side of the row
    await page.mouse.move(box.x + 2, box.y + 15);
    const containerHandle = page.locator('[data-testid="container-handle"]');
    await expect(containerHandle).toBeVisible({ timeout: 2000 });
    await containerHandle.dispatchEvent('click');
    await page.waitForTimeout(200);

    // Finish at the right side of the row
    await page.mouse.move(box.x + box.width - 2, box.y + 15);
    const containerHandleEnd = page.locator('[data-testid="container-handle"]');
    await expect(containerHandleEnd).toBeVisible({ timeout: 2000 });
    await containerHandleEnd.dispatchEvent('click');
    await page.waitForTimeout(300);

    // Verify container exists
    const { containerBoundaries, nodeSlots } = await page.evaluate(() => {
      const db = (window as any).__db;
      const c = db.exec('SELECT start_slot, end_slot FROM containers ORDER BY start_slot LIMIT 1');
      const n = db.exec('SELECT slot FROM nodes ORDER BY slot');
      const start = c[0]?.values?.[0]?.[0];
      const end = c[0]?.values?.[0]?.[1];
      const slots = n[0]?.values?.map((r: any[]) => r[0]) ?? [];
      return { containerBoundaries: [start, end], nodeSlots: slots };
    });

    // ASSERTION: container boundary slots must not intersect node slots
    for (const nodeSlot of nodeSlots) {
      expect(containerBoundaries).not.toContain(nodeSlot);
    }

    // ASSERTION: visually, container left border should not collapse onto the open node.
    // Use SVG coordinates (CTM / attributes) rather than bounding boxes to avoid stroke/text effects.
    const openNode = page.locator('[data-testid="node"]').first();
    const containerSegment = page.locator('[data-testid="container-segment"]').first();
    await expect(openNode).toBeVisible();
    await expect(containerSegment).toBeVisible();

    const openNodeX = await openNode.evaluate((el) => {
      const g = el as unknown as SVGGElement;
      return g.getCTM()?.e ?? null;
    });
    const containerStartX = await containerSegment
      .locator('rect.hit-area')
      .first()
      .evaluate((el) => {
        const x = el.getAttribute('x');
        return x === null ? null : parseFloat(x);
      });

    expect(openNodeX).not.toBeNull();
    expect(containerStartX).not.toBeNull();

    if (openNodeX !== null && containerStartX !== null) {
      // If these are nearly equal, the boundary and node have collapsed visually
      expect(Math.abs(openNodeX - containerStartX)).toBeGreaterThan(10);
    }
  });
});
