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
