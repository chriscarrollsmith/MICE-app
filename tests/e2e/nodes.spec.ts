import { test, expect } from '@playwright/test';
import { setupFreshPage } from './helpers';

/**
 * NODE RENDERING TESTS
 *
 * These tests verify that nodes render correctly on the timeline.
 * Nodes are the core visual elements representing story beats in the MICE framework.
 * Each node is displayed as a colored circle with a letter label (M, I, C, or E).
 */
test.describe('story:node-rendering', () => {
  test.beforeEach(async ({ page }) => {
    await setupFreshPage(page);
  });

  /**
   * Nodes should render as colored circles on the timeline.
   * Each node displays as an SVG circle element with a fill color
   * corresponding to its MICE type.
   */
  test('P0-colored-circles: nodes render as colored circles on timeline', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Node rendering
    Path: P0-colored-circles
    Steps:
    - The timeline contains nodes.
    - Nodes render as visible circles on the timeline.
    INTENT:END */

    // Set up: Create a container with a pair of nodes (open and close)
    await page.evaluate(async () => {
      const db = (window as any).__db;
      db.run(`INSERT INTO containers (id, start_slot, end_slot, parent_id, title, created_at, updated_at)
              VALUES ('c1', 0, 4, NULL, 'Scene', datetime('now'), datetime('now'))`);
      db.run(`INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
              VALUES ('n1', 'c1', 't1', 'milieu', 'open', 1, 'Enter World', '', datetime('now'), datetime('now'))`);
      db.run(`INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
              VALUES ('n2', 'c1', 't1', 'milieu', 'close', 3, 'Leave World', '', datetime('now'), datetime('now'))`);
      await (window as any).__saveDb();
      (window as any).__reloadStore();
    });

    await page.waitForTimeout(200);

    // Verify: Both nodes should be rendered on the timeline
    const nodes = page.locator('[data-testid="node"]');
    await expect(nodes).toHaveCount(2);

    // Verify: Each node contains an SVG circle with a fill color
    const firstNode = nodes.first();
    const circle = firstNode.locator('circle');
    await expect(circle).toBeAttached();

    const fill = await circle.getAttribute('fill');
    expect(fill).toBeTruthy();
  });

  /**
   * Each MICE type should have a distinct color for easy visual identification:
   * - Milieu (M): Green (#22c55e)
   * - Idea (I): Blue (#3b82f6)
   * - Character (C): Amber (#f59e0b)
   * - Event (E): Red (#ef4444)
   */
  test('P1-type-colors: different MICE types have different colors', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Node rendering
    Path: P1-type-colors
    Steps:
    - The timeline contains nodes of multiple MICE types.
    - Each type is visually distinguishable by color.
    INTENT:END */

    // Set up: Create nodes of all four MICE types
    await page.evaluate(async () => {
      const db = (window as any).__db;
      db.run(`INSERT INTO containers (id, start_slot, end_slot, parent_id, title, created_at, updated_at)
              VALUES ('c1', 0, 8, NULL, 'Scene', datetime('now'), datetime('now'))`);
      // Milieu thread
      db.run(`INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
              VALUES ('n1', 'c1', 't1', 'milieu', 'open', 0, '', '', datetime('now'), datetime('now'))`);
      db.run(`INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
              VALUES ('n2', 'c1', 't1', 'milieu', 'close', 1, '', '', datetime('now'), datetime('now'))`);
      // Idea thread
      db.run(`INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
              VALUES ('n3', 'c1', 't2', 'idea', 'open', 2, '', '', datetime('now'), datetime('now'))`);
      db.run(`INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
              VALUES ('n4', 'c1', 't2', 'idea', 'close', 3, '', '', datetime('now'), datetime('now'))`);
      // Character thread
      db.run(`INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
              VALUES ('n5', 'c1', 't3', 'character', 'open', 4, '', '', datetime('now'), datetime('now'))`);
      db.run(`INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
              VALUES ('n6', 'c1', 't3', 'character', 'close', 5, '', '', datetime('now'), datetime('now'))`);
      // Event thread
      db.run(`INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
              VALUES ('n7', 'c1', 't4', 'event', 'open', 6, '', '', datetime('now'), datetime('now'))`);
      db.run(`INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
              VALUES ('n8', 'c1', 't4', 'event', 'close', 7, '', '', datetime('now'), datetime('now'))`);
      await (window as any).__saveDb();
      (window as any).__reloadStore();
    });

    await page.waitForTimeout(200);

    // Verify: All 8 nodes should be rendered
    const nodes = page.locator('[data-testid="node"]');
    await expect(nodes).toHaveCount(8);

    // Verify: Each MICE type has a unique color
    const colors = await page.evaluate(() => {
      const nodes = document.querySelectorAll('[data-testid="node"]');
      const colorMap: Record<string, string> = {};
      nodes.forEach((node) => {
        const circle = node.querySelector('circle');
        if (circle) {
          const fill = circle.getAttribute('fill') || '';
          const text = node.querySelector('text');
          const label = text?.textContent || '';
          if (label && !colorMap[label]) {
            colorMap[label] = fill;
          }
        }
      });
      return colorMap;
    });

    expect(colors['M']).toBeTruthy();
    expect(colors['I']).toBeTruthy();
    expect(colors['C']).toBeTruthy();
    expect(colors['E']).toBeTruthy();

    // Verify: All four colors are distinct
    const uniqueColors = new Set(Object.values(colors));
    expect(uniqueColors.size).toBe(4);
  });

  /**
   * Open and close nodes of the same thread should be connected by an arc.
   * The arc provides visual continuity showing the span of a story thread.
   */
  test('P2-arc: arc connects open and close nodes', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Node rendering
    Path: P2-arc
    Steps:
    - The timeline contains a thread with an opening node and a closing node.
    - The UI renders a visual connection between the two nodes.
    INTENT:END */

    // Set up: Create a thread with open and close nodes
    await page.evaluate(async () => {
      const db = (window as any).__db;
      db.run(`INSERT INTO containers (id, start_slot, end_slot, parent_id, title, created_at, updated_at)
              VALUES ('c1', 0, 4, NULL, 'Scene', datetime('now'), datetime('now'))`);
      db.run(`INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
              VALUES ('n1', 'c1', 't1', 'milieu', 'open', 1, '', '', datetime('now'), datetime('now'))`);
      db.run(`INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
              VALUES ('n2', 'c1', 't1', 'milieu', 'close', 3, '', '', datetime('now'), datetime('now'))`);
      await (window as any).__saveDb();
      (window as any).__reloadStore();
    });

    await page.waitForTimeout(200);

    // Verify: An arc path exists connecting the nodes
    const svg = page.locator('[data-testid="timeline-svg"]');
    const arcPath = svg.locator('.arcs path');
    await expect(arcPath.first()).toBeAttached();

    // Verify: Arc has a stroke color matching the thread type
    const stroke = await arcPath.first().getAttribute('stroke');
    expect(stroke).toBeTruthy();
  });
});

test.describe('story:insert-thread', () => {
  test.beforeEach(async ({ page }) => {
    await setupFreshPage(page);
  });

  test('P0-hover-shows-grid: MICE grid appears when hovering over an insert boundary', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Insert a thread
    Path: P0-hover-shows-grid
    Steps:
    - The user hovers over a valid insertion boundary in the node zone.
    - The UI shows a MICE type selector for starting thread creation.
    INTENT:END */

    const svg = page.locator('[data-testid="timeline-svg"]');
    const box = await svg.boundingBox();
    expect(box).not.toBeNull();

    if (box) {
      // Action: Hover in the middle of the canvas (node zone)
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

      // Verify: MICE grid should appear at the boundary
      const miceGrid = page.locator('[data-testid="mice-grid"]');
      await expect(miceGrid).toBeVisible({ timeout: 2000 });

      // Verify: Grid has all 4 MICE type cells
      const cells = miceGrid.locator('[data-type]');
      await expect(cells).toHaveCount(4);
    }
  });

  test('P1-grid-cell-hover: grid cell shows hover effect', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Insert a thread
    Path: P1-grid-cell-hover
    Steps:
    - The user hovers over a thread type choice.
    - The UI provides hover feedback so the user can confirm the targeted choice.
    INTENT:END */

    const svg = page.locator('[data-testid="timeline-svg"]');
    const box = await svg.boundingBox();
    expect(box).not.toBeNull();

    if (box) {
      // Show the grid
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

      const miceGrid = page.locator('[data-testid="mice-grid"]');
      await expect(miceGrid).toBeVisible({ timeout: 2000 });

      // Action: Hover over the milieu cell
      const milieuCell = miceGrid.locator('[data-type="milieu"]');
      await milieuCell.hover();
      await page.waitForTimeout(100);

      // Verify: Cell opacity increases on hover
      const opacity = await milieuCell.locator('rect').evaluate((el) => {
        return parseFloat(window.getComputedStyle(el).opacity);
      });
      expect(opacity).toBeGreaterThan(0.9);
    }
  });

  test('P2-two-step-start: first click places open node and enters close-placement mode', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Insert a thread
    Path: P2-two-step-start
    Steps:
    - The user starts creating a thread at a chosen boundary by selecting a MICE type.
    - The opening node is placed.
    - The UI transitions into a state that requires placing the closing node.
    INTENT:END */

    const svg = page.locator('[data-testid="timeline-svg"]');
    const box = await svg.boundingBox();
    expect(box).not.toBeNull();

    if (box) {
      // Show the grid at a boundary
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

      const miceGrid = page.locator('[data-testid="mice-grid"]');
      await expect(miceGrid).toBeVisible({ timeout: 2000 });

      // Action: Click on 'milieu' cell - should start two-step creation
      const milieuCell = miceGrid.locator('[data-type="milieu"]');
      await milieuCell.dispatchEvent('click');
      await page.waitForTimeout(200);

      // Verify: Interaction state requires placing the close node
      const interactionState = await page.evaluate(() => {
        const getState = (window as any).__timelineInteraction;
        return getState ? getState() : null;
      });
      expect(interactionState?.mode).toBe('placing-node-close');

      // Verify: Only the opening node exists so far
      const nodeCount = await page.evaluate(() => {
        const db = (window as any).__db;
        const result = db.exec('SELECT COUNT(*) FROM nodes');
        return result[0]?.values[0]?.[0] ?? 0;
      });
      expect(nodeCount).toBe(1);
    }
  });

  test('P3-two-step-complete: second click places close node and completes thread', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Insert a thread
    Path: P3-two-step-complete
    Steps:
    - The user has placed the opening node and is choosing where to place the closing node.
    - The user places the closing node at a valid location.
    - The thread is complete and the UI returns to the idle interaction state.
    INTENT:END */

    const svg = page.locator('[data-testid="timeline-svg"]');
    const box = await svg.boundingBox();
    expect(box).not.toBeNull();

    if (box) {
      // Start thread creation
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      const milieuCell = page.locator('[data-testid="mice-grid"] [data-type="milieu"]');
      await expect(milieuCell).toBeVisible({ timeout: 2000 });
      await milieuCell.dispatchEvent('click');
      await page.waitForTimeout(200);

      // Must now be placing the close node
      const state = await page.evaluate(() => {
        const getState = (window as any).__timelineInteraction;
        return getState ? getState() : null;
      });
      expect(state?.mode).toBe('placing-node-close');

      // Choose a close placement (implementation may use a dedicated handle or reuse the grid)
      await page.mouse.move(box.x + (box.width * 3) / 4, box.y + box.height / 2);
      await page.waitForTimeout(200);

      const closeHandle = page.locator('[data-testid="mice-grid"], [data-testid="close-node-handle"]');
      await expect(closeHandle.first()).toBeVisible({ timeout: 2000 });
      await closeHandle.first().dispatchEvent('click');
      await page.waitForTimeout(300);

      // Verify: two nodes exist now
      const nodeCount = await page.evaluate(() => {
        const db = (window as any).__db;
        const result = db.exec('SELECT COUNT(*) FROM nodes');
        return result[0]?.values[0]?.[0] ?? 0;
      });
      expect(nodeCount).toBe(2);

      const finalState = await page.evaluate(() => {
        const getState = (window as any).__timelineInteraction;
        return getState ? getState() : null;
      });
      expect(finalState?.mode).toBe('idle');
    }
  });

  test('P4-nice-to-have-single-click: single-click insertion when only one close location exists', async ({ page }) => {
    test.fixme(true, 'Nice-to-have: allow single-click insertion when only one valid close placement exists');

    /* INTENT:BEGIN
    Story: Insert a thread
    Path: P4-nice-to-have-single-click
    Steps:
    - The user starts creating a thread in a context where there is only one valid place to put the closing node.
    - The system completes the thread with a single click.
    INTENT:END */

    const svg = page.locator('[data-testid="timeline-svg"]');
    const box = await svg.boundingBox();
    expect(box).not.toBeNull();

    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      const milieuCell = page.locator('[data-testid="mice-grid"] [data-type="milieu"]');
      await expect(milieuCell).toBeVisible({ timeout: 2000 });
      await milieuCell.dispatchEvent('click');
      await page.waitForTimeout(300);

      const nodeCount = await page.evaluate(() => {
        const db = (window as any).__db;
        const result = db.exec('SELECT COUNT(*) FROM nodes');
        return result[0]?.values[0]?.[0] ?? 0;
      });
      expect(nodeCount).toBe(2);
    }
  });

  test('P5-shifts-existing-content: inserting a thread shifts existing nodes to make room', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Insert a thread
    Path: P5-shifts-existing-content
    Steps:
    - The timeline already contains nodes.
    - The user inserts a new thread at a boundary between existing nodes.
    - Content after the insertion point shifts so the timeline remains well-formed.
    INTENT:END */

    // Set up: Create an existing thread with nodes at slots 0 and 1
    await page.evaluate(async () => {
      const db = (window as any).__db;
      db.run(`INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
              VALUES ('n1', NULL, 't1', 'event', 'open', 0, '', '', datetime('now'), datetime('now'))`);
      db.run(`INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
              VALUES ('n2', NULL, 't1', 'event', 'close', 1, '', '', datetime('now'), datetime('now'))`);
      await (window as any).__saveDb();
      (window as any).__reloadStore();
    });

    await page.waitForTimeout(300);

    // Verify initial state: 2 nodes at slots 0 and 1
    let slots = await page.evaluate(() => {
      const db = (window as any).__db;
      const result = db.exec('SELECT slot FROM nodes ORDER BY slot');
      return result[0]?.values?.map((r: any[]) => r[0]) || [];
    });
    expect(slots).toEqual([0, 1]);

    // Now insert a new thread at boundary 1 (between the two existing nodes)
    const svg = page.locator('[data-testid="timeline-svg"]');
    const box = await svg.boundingBox();

    if (box) {
      // Get positions of existing nodes to find the boundary between them
      const openNode = page.locator('[data-testid="node"]').first();
      const closeNode = page.locator('[data-testid="node"]').last();
      const openBox = await openNode.boundingBox();
      const closeBox = await closeNode.boundingBox();

      if (openBox && closeBox) {
        // Hover at midpoint between nodes (boundary position)
        const midX = (openBox.x + openBox.width / 2 + closeBox.x + closeBox.width / 2) / 2;
        await page.mouse.move(midX, box.y + box.height / 2);
        await page.waitForTimeout(200);

        const miceGrid = page.locator('[data-testid="mice-grid"]');
        await expect(miceGrid).toBeVisible({ timeout: 2000 });

        // Click to start inserting a character thread (two-step creation)
        const characterCell = miceGrid.locator('[data-type="character"]');
        await characterCell.dispatchEvent('click');
        await page.waitForTimeout(200);

        // Place the close node to complete the thread
        await page.mouse.move(midX + 40, box.y + box.height / 2);
        await page.waitForTimeout(200);
        const closeHandle = page.locator('[data-testid="mice-grid"], [data-testid="close-node-handle"]');
        await expect(closeHandle.first()).toBeVisible({ timeout: 2000 });
        await closeHandle.first().dispatchEvent('click');
        await page.waitForTimeout(500);

        // Verify: Now have 4 nodes
        slots = await page.evaluate(() => {
          const db = (window as any).__db;
          const result = db.exec('SELECT slot FROM nodes ORDER BY slot');
          return result[0]?.values?.map((r: any[]) => r[0]) || [];
        });

        // The original nodes at 0,1 should have shifted:
        // - Original node at slot 0 stays at 0 (before insertion point)
        // - New open node inserted at slot 1
        // - New close node inserted at slot 2
        // - Original node at slot 1 shifts to slot 3
        expect(slots).toEqual([0, 1, 2, 3]);

        // Verify types to confirm the order
        const nodeData = await page.evaluate(() => {
          const db = (window as any).__db;
          return db.exec('SELECT type, role, slot FROM nodes ORDER BY slot');
        });

        const nodeTypes = nodeData[0].values;
        // Slot 0: original event open
        expect(nodeTypes[0]).toEqual(['event', 'open', 0]);
        // Slot 1: new character open
        expect(nodeTypes[1]).toEqual(['character', 'open', 1]);
        // Slot 2: new character close
        expect(nodeTypes[2]).toEqual(['character', 'close', 2]);
        // Slot 3: original event close (shifted from slot 1)
        expect(nodeTypes[3]).toEqual(['event', 'close', 3]);
      }
    }
  });
});

/**
 * MICE GRID POSITIONING
 *
 * The MICE grid should only appear in valid empty locations between existing elements.
 * It should NEVER appear on top of an existing node, as nodes are clickable for editing.
 */
test.describe('story:mice-grid-positioning', () => {
  test.beforeEach(async ({ page }) => {
    await setupFreshPage(page);
  });

  /**
   * When hovering directly over an existing node, the MICE grid should NOT appear.
   * Instead, the node should show its hover state (e.g., trash button).
   * The grid should only appear in empty slots between existing elements.
   */
  test('P0-not-on-node: MICE grid does not appear when hovering over existing node', async ({ page }) => {
    /* INTENT:BEGIN
    Story: MICE grid positioning
    Path: P0-not-on-node
    Steps:
    - The timeline contains an existing node.
    - When the user hovers directly over that node, the node remains the primary interaction target.
    - The MICE grid does not appear on top of an existing node.
    INTENT:END */

    // Set up: Create nodes
    await page.evaluate(async () => {
      const db = (window as any).__db;
      db.run(`INSERT INTO containers (id, start_slot, end_slot, parent_id, title, created_at, updated_at)
              VALUES ('c1', 0, 3, NULL, 'Scene', datetime('now'), datetime('now'))`);
      db.run(`INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
              VALUES ('n1', 'c1', 't1', 'character', 'open', 1, 'Hero', '', datetime('now'), datetime('now'))`);
      db.run(`INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
              VALUES ('n2', 'c1', 't1', 'character', 'close', 2, 'Hero Exit', '', datetime('now'), datetime('now'))`);
      await (window as any).__saveDb();
      (window as any).__reloadStore();
    });

    await page.waitForTimeout(300);

    // Get node position
    const node = page.locator('[data-testid="node"]').first();
    await expect(node).toBeVisible();
    const nodeBox = await node.boundingBox();
    expect(nodeBox).not.toBeNull();

    if (nodeBox) {
      // Action: Hover directly over the existing node
      await page.mouse.move(
        nodeBox.x + nodeBox.width / 2,
        nodeBox.y + nodeBox.height / 2
      );
      await page.waitForTimeout(300);

      // Verify: MICE grid should NOT be visible
      const miceGrid = page.locator('[data-testid="mice-grid"]');
      await expect(miceGrid).not.toBeVisible();
    }
  });

  /**
   * After placing a pair of nodes, new insert positions should appear
   * in the gaps BETWEEN existing elements:
   * - Between left container edge and opening node
   * - Between opening node and closing node
   * - Between closing node and right container edge
   */
  test('P1-between-nodes: MICE grid appears between existing nodes, not on them', async ({ page }) => {
    /* INTENT:BEGIN
    Story: MICE grid positioning
    Path: P1-between-nodes
    Steps:
    - The timeline contains existing nodes.
    - When the user hovers at an empty boundary between nodes, the UI shows the MICE grid at that boundary.
    INTENT:END */

    // Set up: Create container with nodes
    await page.evaluate(async () => {
      const db = (window as any).__db;
      db.run(`INSERT INTO containers (id, start_slot, end_slot, parent_id, title, created_at, updated_at)
              VALUES ('c1', 0, 3, NULL, 'Scene', datetime('now'), datetime('now'))`);
      db.run(`INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
              VALUES ('n1', 'c1', 't1', 'event', 'open', 1, '', '', datetime('now'), datetime('now'))`);
      db.run(`INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
              VALUES ('n2', 'c1', 't1', 'event', 'close', 2, '', '', datetime('now'), datetime('now'))`);
      await (window as any).__saveDb();
      (window as any).__reloadStore();
    });

    await page.waitForTimeout(300);

    const svg = page.locator('[data-testid="timeline-svg"]');
    const svgBox = await svg.boundingBox();
    const openNode = page.locator('[data-testid="node"]').first();
    const closeNode = page.locator('[data-testid="node"]').last();
    const openNodeBox = await openNode.boundingBox();
    const closeNodeBox = await closeNode.boundingBox();

    if (svgBox && openNodeBox && closeNodeBox) {
      // Calculate midpoint between the two nodes
      const midpointX = (openNodeBox.x + openNodeBox.width / 2 + closeNodeBox.x + closeNodeBox.width / 2) / 2;

      // Action: Hover at the midpoint between nodes
      await page.mouse.move(midpointX, svgBox.y + svgBox.height / 2);
      await page.waitForTimeout(300);

      // Verify: MICE grid should appear at this empty position
      const miceGrid = page.locator('[data-testid="mice-grid"]');
      await expect(miceGrid).toBeVisible({ timeout: 2000 });
    }
  });
});

/**
 * HOVER EFFECT EXCLUSIVITY
 *
 * The timeline has multiple interactive elements (nodes, containers, insert handles) that
 * can show hover effects. To maintain a clean, uncluttered UI, only the NEAREST interactive
 * element to the cursor should show its hover effect at any given time.
 *
 * This prevents confusing situations where multiple hover states are visible simultaneously,
 * which could make it unclear what action will be triggered by a click.
 */
test.describe('story:hover-effect-exclusivity', () => {
  test.beforeEach(async ({ page }) => {
    await setupFreshPage(page);
  });

  /**
   * When the cursor is over a container's delete button, the MICE grid
   * (node insert handle) should NOT be visible, even if there's a nearby
   * boundary position. The container's hover state takes precedence.
   */
  test('P0-container-trash-wins: MICE grid hidden when hovering over container delete button', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Hover effect exclusivity
    Path: P0-container-trash-wins
    Steps:
    - The user hovers over a container's delete affordance.
    - Only the container deletion affordance is active; the MICE grid does not compete for focus.
    INTENT:END */

    // Set up: Create a container
    await page.evaluate(async () => {
      const db = (window as any).__db;
      db.run(`INSERT INTO containers (id, start_slot, end_slot, parent_id, title, created_at, updated_at)
              VALUES ('c1', 0, 3, NULL, 'Scene 1', datetime('now'), datetime('now'))`);
      await (window as any).__saveDb();
      (window as any).__reloadStore();
    });

    await page.waitForTimeout(300);

    // First, hover over the container to make the delete button appear
    const containerSegment = page.locator('[data-testid="container-segment"]');
    await expect(containerSegment).toBeVisible();
    await containerSegment.hover();
    await page.waitForTimeout(200);

    // The trash button should be visible
    const trashButton = containerSegment.locator('.trash-button');
    await expect(trashButton).toBeVisible();

    // Get trash button position and hover directly over it
    const trashBox = await trashButton.boundingBox();
    expect(trashBox).not.toBeNull();

    if (trashBox) {
      // Hover directly over the trash button center
      await page.mouse.move(
        trashBox.x + trashBox.width / 2,
        trashBox.y + trashBox.height / 2
      );
      await page.waitForTimeout(200);

      // Verify: MICE grid should NOT be visible while hovering over delete button
      const miceGrid = page.locator('[data-testid="mice-grid"]');
      await expect(miceGrid).not.toBeVisible();
    }
  });

  /**
   * When the cursor is over a node (in its hovered state showing the delete button),
   * the MICE grid should NOT appear at nearby boundaries. Node hover takes precedence.
   */
  test('P1-node-trash-wins: MICE grid hidden when node is in hover state', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Hover effect exclusivity
    Path: P1-node-trash-wins
    Steps:
    - The user hovers over a node so its hover affordances appear.
    - The node remains the primary interaction target; the MICE grid does not compete for focus.
    INTENT:END */

    // Set up: Create nodes
    await page.evaluate(async () => {
      const db = (window as any).__db;
      db.run(`INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
              VALUES ('n1', NULL, 't1', 'milieu', 'open', 0, '', '', datetime('now'), datetime('now'))`);
      db.run(`INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
              VALUES ('n2', NULL, 't1', 'milieu', 'close', 1, '', '', datetime('now'), datetime('now'))`);
      await (window as any).__saveDb();
      (window as any).__reloadStore();
    });

    await page.waitForTimeout(300);

    // Get the node element
    const node = page.locator('[data-testid="node"]').first();
    await expect(node).toBeVisible();

    // Hover over the node - it should show its delete button
    await node.hover();
    await page.waitForTimeout(200);

    // Node's trash button should be visible (confirms we're in hover state)
    const nodeTrash = node.locator('.trash-button');
    await expect(nodeTrash).toBeVisible();

    // Verify: MICE grid should NOT be visible while node is hovered
    const miceGrid = page.locator('[data-testid="mice-grid"]');
    await expect(miceGrid).not.toBeVisible();
  });

  /**
   * When transitioning between hover zones (container zone vs node zone),
   * only the appropriate hover element should be visible - never both.
   * Moving from container zone to node zone should hide container handle
   * and show MICE grid (if not over an existing node).
   */
  test('P2-transition: only one hover effect visible when transitioning between zones', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Hover effect exclusivity
    Path: P2-transition
    Steps:
    - The user moves the cursor between the container zone and the node zone.
    - The UI shows only the appropriate hover affordance for the current zone.
    INTENT:END */

    // Set up: Create container with nodes
    await page.evaluate(async () => {
      const db = (window as any).__db;
      db.run(`INSERT INTO containers (id, start_slot, end_slot, parent_id, title, created_at, updated_at)
              VALUES ('c1', 0, 3, NULL, 'Scene', datetime('now'), datetime('now'))`);
      db.run(`INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
              VALUES ('n1', 'c1', 't1', 'event', 'open', 1, '', '', datetime('now'), datetime('now'))`);
      db.run(`INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
              VALUES ('n2', 'c1', 't1', 'event', 'close', 2, '', '', datetime('now'), datetime('now'))`);
      await (window as any).__saveDb();
      (window as any).__reloadStore();
    });

    await page.waitForTimeout(300);

    const svg = page.locator('[data-testid="timeline-svg"]');
    const svgBox = await svg.boundingBox();
    expect(svgBox).not.toBeNull();

    if (svgBox) {
      // First hover in the container zone (top area)
      await page.mouse.move(svgBox.x + svgBox.width / 2, svgBox.y + 15);
      await page.waitForTimeout(200);

      // Container handle should be visible, MICE grid should not
      const containerHandle = page.locator('[data-testid="container-handle"]');
      const miceGrid = page.locator('[data-testid="mice-grid"]');

      await expect(containerHandle).toBeVisible({ timeout: 2000 });
      await expect(miceGrid).not.toBeVisible();

      // Now move to node zone (middle area, between nodes)
      await page.mouse.move(svgBox.x + svgBox.width / 2, svgBox.y + svgBox.height / 2);
      await page.waitForTimeout(200);

      // Now MICE grid should be visible (if not over a node), container handle hidden
      await expect(miceGrid).toBeVisible({ timeout: 2000 });
      await expect(containerHandle).not.toBeVisible();
    }
  });
});
