import { test, expect } from '@playwright/test';
import { setupFreshPage } from './helpers';

test.describe('story:node-editing', () => {
  test.beforeEach(async ({ page }) => {
    await setupFreshPage(page);
  });

  test('P0-open-popover: clicking node shows popover with title and description inputs', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Node editing
    Path: P0-open-popover
    Steps:
    - The timeline contains a node.
    - The user selects the node.
    - The UI shows an editor for node details.
    INTENT:END */

    // Insert container and nodes
    await page.evaluate(async () => {
      const db = (window as any).__db;
      db.run(`INSERT INTO containers (id, start_slot, end_slot, parent_id, title, created_at, updated_at)
              VALUES ('c1', 0, 4, NULL, 'Scene', datetime('now'), datetime('now'))`);
      db.run(`INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
              VALUES ('n1', 'c1', 't1', 'milieu', 'open', 1, 'Enter World', 'Description here', datetime('now'), datetime('now'))`);
      db.run(`INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
              VALUES ('n2', 'c1', 't1', 'milieu', 'close', 3, 'Leave World', '', datetime('now'), datetime('now'))`);
      await (window as any).__saveDb();
      (window as any).__reloadStore();
    });

    await page.waitForTimeout(200);

    // Click on the node
    const node = page.locator('[data-testid="node"]').first();
    await node.dispatchEvent('click');
    await page.waitForTimeout(200);

    // Verify popover appears
    const popover = page.locator('[data-testid="node-popover"]');
    await expect(popover).toBeVisible();

    // Verify title input has correct value
    const titleInput = page.locator('[data-testid="node-title-input"]');
    await expect(titleInput).toHaveValue('Enter World');
  });

  test('P1-edit-title-persists: editing node title updates the database', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Node editing
    Path: P1-edit-title-persists
    Steps:
    - The user edits a node title.
    - The change is persisted.
    INTENT:END */

    // Insert container and nodes
    await page.evaluate(async () => {
      const db = (window as any).__db;
      db.run(`INSERT INTO containers (id, start_slot, end_slot, parent_id, title, created_at, updated_at)
              VALUES ('c1', 0, 4, NULL, 'Scene', datetime('now'), datetime('now'))`);
      db.run(`INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
              VALUES ('n1', 'c1', 't1', 'milieu', 'open', 1, 'Original Title', '', datetime('now'), datetime('now'))`);
      db.run(`INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
              VALUES ('n2', 'c1', 't1', 'milieu', 'close', 3, '', '', datetime('now'), datetime('now'))`);
      await (window as any).__saveDb();
      (window as any).__reloadStore();
    });

    await page.waitForTimeout(200);

    // Click on the node to open popover
    const node = page.locator('[data-testid="node"]').first();
    await node.dispatchEvent('click');
    await page.waitForTimeout(200);

    // Edit the title
    const titleInput = page.locator('[data-testid="node-title-input"]');
    await titleInput.clear();
    await titleInput.fill('New Title');

    // Trigger the update (blur or input event)
    await titleInput.blur();
    await page.waitForTimeout(300);

    // Verify the database was updated
    const nodeTitle = await page.evaluate(() => {
      const db = (window as any).__db;
      const result = db.exec("SELECT title FROM nodes WHERE id = 'n1'");
      return result[0]?.values[0]?.[0];
    });

    expect(nodeTitle).toBe('New Title');
  });

  test('P2-edit-description-persists: editing node description updates the database', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Node editing
    Path: P2-edit-description-persists
    Steps:
    - The user edits a node description.
    - The change is persisted.
    INTENT:END */

    await page.evaluate(async () => {
      const db = (window as any).__db;
      db.run(`INSERT INTO containers (id, start_slot, end_slot, parent_id, title, created_at, updated_at)
              VALUES ('c1', 0, 4, NULL, 'Scene', datetime('now'), datetime('now'))`);
      db.run(`INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
              VALUES ('n1', 'c1', 't1', 'milieu', 'open', 1, '', 'Original description', datetime('now'), datetime('now'))`);
      db.run(`INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
              VALUES ('n2', 'c1', 't1', 'milieu', 'close', 3, '', '', datetime('now'), datetime('now'))`);
      await (window as any).__saveDb();
      (window as any).__reloadStore();
    });

    await page.waitForTimeout(200);

    // Click on the node to open popover
    const node = page.locator('[data-testid="node"]').first();
    await node.dispatchEvent('click');
    await page.waitForTimeout(200);

    // Edit the description
    const descInput = page.locator('[data-testid="node-description-input"]');
    await descInput.clear();
    await descInput.fill('Updated description');
    await descInput.blur();
    await page.waitForTimeout(300);

    // Verify the database was updated
    const nodeDesc = await page.evaluate(() => {
      const db = (window as any).__db;
      const result = db.exec("SELECT description FROM nodes WHERE id = 'n1'");
      return result[0]?.values[0]?.[0];
    });

    expect(nodeDesc).toBe('Updated description');
  });

  test('P3-escape-closes: pressing Escape closes popover', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Node editing
    Path: P3-escape-closes
    Steps:
    - The user is editing a node.
    - The user cancels/closes the editor.
    - The node editor is dismissed.
    INTENT:END */

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

    // Click on the node to open popover
    const node = page.locator('[data-testid="node"]').first();
    await node.dispatchEvent('click');
    await page.waitForTimeout(200);

    // Verify popover is visible
    const popover = page.locator('[data-testid="node-popover"]');
    await expect(popover).toBeVisible();

    // Press Escape to close
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);

    // Verify popover is hidden
    await expect(popover).not.toBeVisible();
  });

  /**
   * POPOVER VISIBILITY - Not Clipped by Container Overflow
   *
   * The timeline-container has `overflow: hidden` which clips any content that
   * extends past its boundaries. The popover should be rendered in a way that
   * allows it to extend past the container and still be visible (e.g., using
   * a portal to render outside the clipping context).
   *
   * This test uses elementFromPoint to verify that the popover's content is
   * actually visible and hittable at its rendered coordinates - not clipped
   * by an ancestor's overflow:hidden.
   */
  test('P4-popover-not-clipped: popover does not get clipped when node is near canvas edge', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Node editing
    Path: P4-popover-not-clipped
    Steps:
    - The user edits a node near the edge of the canvas.
    - The node editor remains visible and interactable.
    INTENT:END */

    // Set up: Create a node near the right edge of the timeline
    await page.evaluate(async () => {
      const db = (window as any).__db;
      db.run(`INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
              VALUES ('n1', NULL, 't1', 'milieu', 'open', 0, '', '', datetime('now'), datetime('now'))`);
      db.run(`INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
              VALUES ('n2', NULL, 't1', 'milieu', 'close', 1, 'Right Edge Node', '', datetime('now'), datetime('now'))`);
      await (window as any).__saveDb();
      (window as any).__reloadStore();
    });

    await page.waitForTimeout(200);

    // Click on the rightmost node (close node at slot 1)
    const closeNode = page.locator('[data-testid="node"]').last();
    await closeNode.dispatchEvent('click');
    await page.waitForTimeout(200);

    // Verify popover appears
    const popover = page.locator('[data-testid="node-popover"]');
    await expect(popover).toBeVisible();

    // Get the description textarea's bounding box (it's at the bottom of the popover)
    const descriptionInput = page.locator('[data-testid="node-description-input"]');
    const descBox = await descriptionInput.boundingBox();
    expect(descBox).not.toBeNull();

    if (descBox) {
      // Check if elementFromPoint at the center of the description textarea
      // actually returns the textarea (or an element inside the popover).
      // If it's clipped, elementFromPoint will return whatever is behind it.
      const centerX = descBox.x + descBox.width / 2;
      const centerY = descBox.y + descBox.height / 2;

      const elementAtPoint = await page.evaluate(
        ({ x, y }) => {
          const el = document.elementFromPoint(x, y);
          if (!el) return null;
          // Return the testid or tag name to identify what we hit
          return {
            testId: el.getAttribute('data-testid'),
            tagName: el.tagName.toLowerCase(),
            isInsidePopover: !!el.closest('[data-testid="node-popover"]'),
          };
        },
        { x: centerX, y: centerY }
      );

      // The element at the description textarea's center should be inside the popover
      // If clipped by overflow:hidden, we'd hit something else (like the page background)
      expect(elementAtPoint).not.toBeNull();
      expect(elementAtPoint?.isInsidePopover).toBe(true);
    }
  });
});

test.describe('story:thread-deletion', () => {
  test.beforeEach(async ({ page }) => {
    await setupFreshPage(page);
  });

  test('P0-hover-shows-delete: hovering node shows delete button', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Thread deletion
    Path: P0-hover-shows-delete
    Steps:
    - The timeline contains a node.
    - The user hovers over the node.
    - A delete affordance is visible.
    INTENT:END */

    await page.evaluate(async () => {
      const db = (window as any).__db;
      db.run(`INSERT INTO containers (id, start_slot, end_slot, parent_id, title, created_at, updated_at)
              VALUES ('c1', 0, 4, NULL, 'Scene', datetime('now'), datetime('now'))`);
      db.run(`INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
              VALUES ('n1', 'c1', 't1', 'milieu', 'open', 1, 'Open', '', datetime('now'), datetime('now'))`);
      db.run(`INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
              VALUES ('n2', 'c1', 't1', 'milieu', 'close', 3, 'Close', '', datetime('now'), datetime('now'))`);
      await (window as any).__saveDb();
      (window as any).__reloadStore();
    });

    await page.waitForTimeout(200);

    // Hover over the node
    const node = page.locator('[data-testid="node"]').first();
    await node.hover();
    await page.waitForTimeout(100);

    // Verify trash button appears
    const trashButton = node.locator('.trash-button');
    await expect(trashButton).toBeVisible();
  });

  test('P1-delete-removes-thread: clicking delete button removes thread (both nodes)', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Thread deletion
    Path: P1-delete-removes-thread
    Steps:
    - The timeline contains a thread with an opening node and a closing node.
    - The user deletes the thread from the UI.
    - Both nodes in the thread are removed.
    INTENT:END */

    await page.evaluate(async () => {
      const db = (window as any).__db;
      db.run(`INSERT INTO containers (id, start_slot, end_slot, parent_id, title, created_at, updated_at)
              VALUES ('c1', 0, 4, NULL, 'Scene', datetime('now'), datetime('now'))`);
      db.run(`INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
              VALUES ('n1', 'c1', 't1', 'milieu', 'open', 1, 'Open', '', datetime('now'), datetime('now'))`);
      db.run(`INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
              VALUES ('n2', 'c1', 't1', 'milieu', 'close', 3, 'Close', '', datetime('now'), datetime('now'))`);
      await (window as any).__saveDb();
      (window as any).__reloadStore();
    });

    await page.waitForTimeout(200);

    // Verify initial node count
    let nodeCount = await page.evaluate(() => {
      const db = (window as any).__db;
      const result = db.exec('SELECT COUNT(*) FROM nodes');
      return result[0]?.values[0]?.[0];
    });
    expect(nodeCount).toBe(2);

    // Hover over the node and click delete
    const node = page.locator('[data-testid="node"]').first();
    await node.hover();
    await page.waitForTimeout(100);

    const trashButton = node.locator('.trash-button');
    await trashButton.dispatchEvent('click');
    await page.waitForTimeout(300);

    // Verify both nodes are removed from database
    nodeCount = await page.evaluate(() => {
      const db = (window as any).__db;
      const result = db.exec('SELECT COUNT(*) FROM nodes');
      return result[0]?.values[0]?.[0];
    });
    expect(nodeCount).toBe(0);
  });
});

test.describe('story:container-deletion', () => {
  test.beforeEach(async ({ page }) => {
    await setupFreshPage(page);
  });

  test('P0-delete-empty: can delete empty container via store function', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Container deletion
    Path: P0-delete-empty
    Steps:
    - The timeline contains an empty container.
    - The container is deleted.
    - The container no longer exists.
    INTENT:END */

    // Insert an empty container
    await page.evaluate(async () => {
      const db = (window as any).__db;
      db.run(`INSERT INTO containers (id, start_slot, end_slot, parent_id, title, created_at, updated_at)
              VALUES ('c1', 0, 4, NULL, 'Empty Container', datetime('now'), datetime('now'))`);
      await (window as any).__saveDb();
      (window as any).__reloadStore();
    });

    await page.waitForTimeout(200);

    // Verify container exists
    let containerCount = await page.evaluate(() => {
      const db = (window as any).__db;
      const result = db.exec('SELECT COUNT(*) FROM containers');
      return result[0]?.values[0]?.[0];
    });
    expect(containerCount).toBe(1);

    // Delete container via store function
    await page.evaluate(async () => {
      const store = await import('/src/stores/story');
      await store.deleteContainer('c1');
    });

    await page.waitForTimeout(100);

    // Verify container is removed
    containerCount = await page.evaluate(() => {
      const db = (window as any).__db;
      const result = db.exec('SELECT COUNT(*) FROM containers');
      return result[0]?.values[0]?.[0];
    });
    expect(containerCount).toBe(0);
  });

  test('P1-delete-cascades: deleting container cascades to nodes', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Container deletion
    Path: P1-delete-cascades
    Steps:
    - The timeline contains a container with nodes inside it.
    - The container is deleted.
    - Nodes contained by that container are removed.
    INTENT:END */

    // Insert container with nodes
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

    // Verify initial state
    let counts = await page.evaluate(() => {
      const db = (window as any).__db;
      const containers = db.exec('SELECT COUNT(*) FROM containers')[0]?.values[0]?.[0];
      const nodes = db.exec('SELECT COUNT(*) FROM nodes')[0]?.values[0]?.[0];
      return { containers, nodes };
    });
    expect(counts.containers).toBe(1);
    expect(counts.nodes).toBe(2);

    // Delete container via store function
    await page.evaluate(async () => {
      const store = await import('/src/stores/story');
      await store.deleteContainer('c1');
    });

    await page.waitForTimeout(100);

    // Verify cascade delete
    counts = await page.evaluate(() => {
      const db = (window as any).__db;
      const containers = db.exec('SELECT COUNT(*) FROM containers')[0]?.values[0]?.[0];
      const nodes = db.exec('SELECT COUNT(*) FROM nodes')[0]?.values[0]?.[0];
      return { containers, nodes };
    });
    expect(counts.containers).toBe(0);
    expect(counts.nodes).toBe(0);
  });

  test('P2-hover-shows-delete: hovering container shows delete button', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Container deletion
    Path: P2-hover-shows-delete
    Steps:
    - The timeline contains a container.
    - The user hovers over the container.
    - A delete affordance is visible.
    INTENT:END */

    await page.evaluate(async () => {
      const db = (window as any).__db;
      db.run(`INSERT INTO containers (id, start_slot, end_slot, parent_id, title, created_at, updated_at)
              VALUES ('c1', 0, 4, NULL, 'Scene 1', datetime('now'), datetime('now'))`);
      await (window as any).__saveDb();
      (window as any).__reloadStore();
    });

    await page.waitForTimeout(200);

    // Hover over the container segment
    const containerSegment = page.locator('[data-testid="container-segment"]');
    await containerSegment.hover();
    await page.waitForTimeout(100);

    // Verify trash button appears
    const trashButton = containerSegment.locator('.trash-button');
    await expect(trashButton).toBeVisible();
  });
});
