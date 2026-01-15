import { writable, derived } from 'svelte/store';
import type { Container, StoryNode, MiceType } from '../lib/types';
import type { SqlValue } from 'sql.js';
import { getDatabase, saveDatabase, generateId, now } from '../lib/db';

// Writable stores
export const containers = writable<Container[]>([]);
export const nodes = writable<StoryNode[]>([]);

// Derived store: group nodes by thread
export const threads = derived(nodes, ($nodes) => {
  const threadMap = new Map<string, StoryNode[]>();
  for (const node of $nodes) {
    const existing = threadMap.get(node.threadId) || [];
    existing.push(node);
    threadMap.set(node.threadId, existing);
  }
  return threadMap;
});

// Load data from database into stores
export function loadFromDb(): void {
  const db = getDatabase();
  if (!db) return;

  // Load containers
  const containerResults = db.exec('SELECT * FROM containers ORDER BY start_slot');
  if (containerResults.length > 0) {
    const cols = containerResults[0].columns;
    const rows = containerResults[0].values;
    const loadedContainers: Container[] = rows.map((row: SqlValue[]) => {
      const obj: Record<string, SqlValue> = {};
      cols.forEach((col: string, i: number) => {
        // Convert snake_case to camelCase
        const camelCol = col.replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase());
        obj[camelCol] = row[i];
      });
      return obj as unknown as Container;
    });
    containers.set(loadedContainers);
  } else {
    containers.set([]);
  }

  // Load nodes
  const nodeResults = db.exec('SELECT * FROM nodes ORDER BY slot');
  if (nodeResults.length > 0) {
    const cols = nodeResults[0].columns;
    const rows = nodeResults[0].values;
    const loadedNodes: StoryNode[] = rows.map((row: SqlValue[]) => {
      const obj: Record<string, SqlValue> = {};
      cols.forEach((col: string, i: number) => {
        const camelCol = col.replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase());
        obj[camelCol] = row[i];
      });
      return obj as unknown as StoryNode;
    });
    nodes.set(loadedNodes);
  } else {
    nodes.set([]);
  }
}

// Container operations
export async function addContainer(
  startSlot: number,
  endSlot: number,
  parentId: string | null = null,
  title: string = ''
): Promise<Container> {
  const db = getDatabase();
  if (!db) throw new Error('Database not initialized');

  const container: Container = {
    id: generateId(),
    parentId,
    title,
    startSlot,
    endSlot,
    createdAt: now(),
    updatedAt: now(),
  };

  db.run(
    `INSERT INTO containers (id, parent_id, title, start_slot, end_slot, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      container.id,
      container.parentId,
      container.title,
      container.startSlot,
      container.endSlot,
      container.createdAt,
      container.updatedAt,
    ]
  );

  await saveDatabase();
  containers.update((c) => [...c, container].sort((a, b) => a.startSlot - b.startSlot));

  return container;
}

/**
 * Create a container while enforcing the constraint that container boundary slots
 * are not occupied by nodes. If a node currently occupies the start or end slot,
 * shift timeline slots to make room and keep the intended span.
 */
export async function addContainerAvoidingNodeOverlap(
  startSlot: number,
  endSlot: number,
  parentId: string | null = null,
  title: string = ''
): Promise<Container> {
  const db = getDatabase();
  if (!db) throw new Error('Database not initialized');

  let s = Math.min(startSlot, endSlot);
  let e = Math.max(startSlot, endSlot);

  if (e <= s) {
    throw new Error('Container must have positive width');
  }

  const hasNodeAt = (slot: number): boolean => {
    const res = db.exec('SELECT COUNT(*) FROM nodes WHERE slot = ?', [slot]);
    return (res[0]?.values?.[0]?.[0] ?? 0) > 0;
  };

  // If start boundary collides with a node, shift everything at/after start right by 1.
  // This also shifts the intended end boundary right by 1.
  if (hasNodeAt(s)) {
    await shiftSlots(s, 1);
    e += 1;
  }

  // If end boundary collides with a node, shift everything at/after end right by 1.
  if (hasNodeAt(e)) {
    await shiftSlots(e, 1);
  }

  const container = await addContainer(s, e, parentId, title);
  // Ensure in-memory stores reflect any slot shifts performed above.
  loadFromDb();
  return container;
}

export async function updateContainer(
  id: string,
  updates: Partial<Pick<Container, 'title'>>
): Promise<void> {
  const db = getDatabase();
  if (!db) throw new Error('Database not initialized');

  const updatedAt = now();
  const sets: string[] = ['updated_at = ?'];
  const params: SqlValue[] = [updatedAt];

  if (updates.title !== undefined) {
    sets.push('title = ?');
    params.push(updates.title);
  }

  params.push(id);
  db.run(`UPDATE containers SET ${sets.join(', ')} WHERE id = ?`, params);

  await saveDatabase();
  containers.update((c) =>
    c.map((container) =>
      container.id === id ? { ...container, ...updates, updatedAt } : container
    )
  );
}

export async function deleteContainer(id: string): Promise<void> {
  const db = getDatabase();
  if (!db) throw new Error('Database not initialized');

  // Delete all nodes in this container
  db.run('DELETE FROM nodes WHERE container_id = ?', [id]);

  // Delete child containers recursively
  const children = db.exec('SELECT id FROM containers WHERE parent_id = ?', [id]);
  if (children.length > 0 && children[0].values.length > 0) {
    for (const [childId] of children[0].values) {
      await deleteContainer(childId as string);
    }
  }

  // Delete the container
  db.run('DELETE FROM containers WHERE id = ?', [id]);

  await saveDatabase();
  loadFromDb(); // Reload to get clean state
}

// Node operations

/**
 * Create only the open node of a thread.
 * Used for two-step node creation: first click creates open node,
 * second click creates close node.
 */
export async function addOpenNode(
  containerId: string | null,
  type: MiceType,
  slot: number,
  title: string = ''
): Promise<StoryNode> {
  const db = getDatabase();
  if (!db) throw new Error('Database not initialized');

  const threadId = generateId();
  const timestamp = now();

  const openNode: StoryNode = {
    id: generateId(),
    containerId,
    threadId,
    type,
    role: 'open',
    slot,
    title,
    description: '',
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  db.run(
    `INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      openNode.id,
      openNode.containerId,
      openNode.threadId,
      openNode.type,
      openNode.role,
      openNode.slot,
      openNode.title,
      openNode.description,
      openNode.createdAt,
      openNode.updatedAt,
    ]
  );

  await saveDatabase();
  nodes.update((n) => [...n, openNode].sort((a, b) => a.slot - b.slot));

  return openNode;
}

/**
 * Complete a thread by adding the close node.
 * Used for two-step node creation after the open node is already placed.
 */
export async function completeThread(
  threadId: string,
  slot: number,
  title: string = ''
): Promise<StoryNode> {
  const db = getDatabase();
  if (!db) throw new Error('Database not initialized');

  // Get the open node to find its type and container
  const openNodeResult = db.exec(
    'SELECT container_id, type FROM nodes WHERE thread_id = ? AND role = ?',
    [threadId, 'open']
  );

  if (!openNodeResult.length || !openNodeResult[0].values.length) {
    throw new Error('Open node not found for thread');
  }

  const [containerId, type] = openNodeResult[0].values[0] as [string | null, MiceType];
  const timestamp = now();

  const closeNode: StoryNode = {
    id: generateId(),
    containerId,
    threadId,
    type,
    role: 'close',
    slot,
    title,
    description: '',
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  db.run(
    `INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      closeNode.id,
      closeNode.containerId,
      closeNode.threadId,
      closeNode.type,
      closeNode.role,
      closeNode.slot,
      closeNode.title,
      closeNode.description,
      closeNode.createdAt,
      closeNode.updatedAt,
    ]
  );

  await saveDatabase();
  nodes.update((n) => [...n, closeNode].sort((a, b) => a.slot - b.slot));

  return closeNode;
}

/**
 * Delete a single node by ID.
 * Used for canceling incomplete thread creation.
 */
export async function deleteNode(nodeId: string): Promise<void> {
  const db = getDatabase();
  if (!db) throw new Error('Database not initialized');

  const slotResult = db.exec('SELECT slot FROM nodes WHERE id = ?', [nodeId]);
  const slot = slotResult[0]?.values?.[0]?.[0] as number | undefined;

  db.run('DELETE FROM nodes WHERE id = ?', [nodeId]);

  // Compact the timeline so no empty slot is left behind.
  if (slot !== undefined) {
    await shiftSlots(slot + 1, -1);
  }

  await saveDatabase();
  loadFromDb();
}

export async function addThread(
  containerId: string | null,
  type: MiceType,
  openSlot: number,
  closeSlot: number,
  openTitle: string = '',
  closeTitle: string = ''
): Promise<{ openNode: StoryNode; closeNode: StoryNode }> {
  const db = getDatabase();
  if (!db) throw new Error('Database not initialized');

  const threadId = generateId();
  const timestamp = now();

  const openNode: StoryNode = {
    id: generateId(),
    containerId,
    threadId,
    type,
    role: 'open',
    slot: openSlot,
    title: openTitle,
    description: '',
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const closeNode: StoryNode = {
    id: generateId(),
    containerId,
    threadId,
    type,
    role: 'close',
    slot: closeSlot,
    title: closeTitle,
    description: '',
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  db.run(
    `INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      openNode.id,
      openNode.containerId,
      openNode.threadId,
      openNode.type,
      openNode.role,
      openNode.slot,
      openNode.title,
      openNode.description,
      openNode.createdAt,
      openNode.updatedAt,
    ]
  );

  db.run(
    `INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      closeNode.id,
      closeNode.containerId,
      closeNode.threadId,
      closeNode.type,
      closeNode.role,
      closeNode.slot,
      closeNode.title,
      closeNode.description,
      closeNode.createdAt,
      closeNode.updatedAt,
    ]
  );

  await saveDatabase();
  nodes.update((n) => [...n, openNode, closeNode].sort((a, b) => a.slot - b.slot));

  return { openNode, closeNode };
}

export async function updateNode(
  id: string,
  updates: Partial<Pick<StoryNode, 'title' | 'description'>>
): Promise<void> {
  const db = getDatabase();
  if (!db) throw new Error('Database not initialized');

  const updatedAt = now();
  const sets: string[] = ['updated_at = ?'];
  const params: SqlValue[] = [updatedAt];

  if (updates.title !== undefined) {
    sets.push('title = ?');
    params.push(updates.title);
  }
  if (updates.description !== undefined) {
    sets.push('description = ?');
    params.push(updates.description);
  }

  params.push(id);
  db.run(`UPDATE nodes SET ${sets.join(', ')} WHERE id = ?`, params);

  await saveDatabase();
  nodes.update((n) =>
    n.map((node) => (node.id === id ? { ...node, ...updates, updatedAt } : node))
  );
}

export async function deleteThread(threadId: string): Promise<void> {
  const db = getDatabase();
  if (!db) throw new Error('Database not initialized');

  const slotsResult = db.exec('SELECT slot FROM nodes WHERE thread_id = ? ORDER BY slot', [threadId]);
  const removedSlots: number[] = slotsResult[0]?.values?.map((r: any[]) => r[0] as number) ?? [];

  db.run('DELETE FROM nodes WHERE thread_id = ?', [threadId]);

  // Compact the timeline by removing the deleted slots.
  // Each shift reduces subsequent slot indices by 1, so we adjust the fromSlot as we go.
  let shiftsApplied = 0;
  for (const slot of removedSlots) {
    await shiftSlots(slot + 1 - shiftsApplied, -1);
    shiftsApplied += 1;
  }

  await saveDatabase();
  loadFromDb();
}

/**
 * Shift all slots at or after `fromSlot` by `delta` positions.
 * This is used when inserting new content to make room.
 */
async function shiftSlots(fromSlot: number, delta: number): Promise<void> {
  const db = getDatabase();
  if (!db) throw new Error('Database not initialized');

  // Shift node slots
  db.run(
    `UPDATE nodes SET slot = slot + ? WHERE slot >= ?`,
    [delta, fromSlot]
  );

  // Shift container boundaries
  // For start_slot: shift if >= fromSlot
  // For end_slot: shift if >= fromSlot
  db.run(
    `UPDATE containers SET
      start_slot = CASE WHEN start_slot >= ? THEN start_slot + ? ELSE start_slot END,
      end_slot = CASE WHEN end_slot >= ? THEN end_slot + ? ELSE end_slot END
    WHERE start_slot >= ? OR end_slot >= ?`,
    [fromSlot, delta, fromSlot, delta, fromSlot, fromSlot]
  );
}

/**
 * Insert a new thread at a boundary position.
 * The boundary represents the position BETWEEN existing slots.
 * - boundary 0 = before all existing content (or at start of empty timeline)
 * - boundary N = after slot N-1, before slot N
 *
 * This will:
 * 1. Shift all existing slots >= boundary by 2 (to make room for open and close nodes)
 * 2. Insert the open node at slot = boundary
 * 3. Insert the close node at slot = boundary + 1
 */
export async function insertThreadAtBoundary(
  boundary: number,
  type: MiceType,
  containerId: string | null = null,
  openTitle: string = '',
  closeTitle: string = ''
): Promise<{ openNode: StoryNode; closeNode: StoryNode }> {
  const db = getDatabase();
  if (!db) throw new Error('Database not initialized');

  // First, shift all existing slots to make room for the new thread
  await shiftSlots(boundary, 2);

  // Now insert the new thread at the boundary position
  const threadId = generateId();
  const timestamp = now();

  const openNode: StoryNode = {
    id: generateId(),
    containerId,
    threadId,
    type,
    role: 'open',
    slot: boundary,
    title: openTitle,
    description: '',
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const closeNode: StoryNode = {
    id: generateId(),
    containerId,
    threadId,
    type,
    role: 'close',
    slot: boundary + 1,
    title: closeTitle,
    description: '',
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  db.run(
    `INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      openNode.id,
      openNode.containerId,
      openNode.threadId,
      openNode.type,
      openNode.role,
      openNode.slot,
      openNode.title,
      openNode.description,
      openNode.createdAt,
      openNode.updatedAt,
    ]
  );

  db.run(
    `INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      closeNode.id,
      closeNode.containerId,
      closeNode.threadId,
      closeNode.type,
      closeNode.role,
      closeNode.slot,
      closeNode.title,
      closeNode.description,
      closeNode.createdAt,
      closeNode.updatedAt,
    ]
  );

  await saveDatabase();

  // Reload from DB to get the shifted state
  loadFromDb();

  return { openNode, closeNode };
}

/**
 * Insert ONLY an opening node at a boundary position.
 *
 * This is the first step of canonical two-step thread creation:
 * 1) Insert open node at boundary (shifting content by 1 to make room)
 * 2) Later, insert close node at a chosen boundary (shifting content by 1 again)
 */
export async function insertOpenNodeAtBoundary(
  boundary: number,
  type: MiceType,
  containerId: string | null = null,
  openTitle: string = ''
): Promise<StoryNode> {
  const db = getDatabase();
  if (!db) throw new Error('Database not initialized');

  await shiftSlots(boundary, 1);

  const threadId = generateId();
  const timestamp = now();

  const openNode: StoryNode = {
    id: generateId(),
    containerId,
    threadId,
    type,
    role: 'open',
    slot: boundary,
    title: openTitle,
    description: '',
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  db.run(
    `INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      openNode.id,
      openNode.containerId,
      openNode.threadId,
      openNode.type,
      openNode.role,
      openNode.slot,
      openNode.title,
      openNode.description,
      openNode.createdAt,
      openNode.updatedAt,
    ]
  );

  await saveDatabase();
  loadFromDb();

  return openNode;
}

/**
 * Insert the closing node for an existing thread at a boundary position.
 *
 * This is the second step of canonical two-step thread creation.
 */
export async function insertCloseNodeAtBoundary(
  openNodeId: string,
  boundary: number,
  closeTitle: string = ''
): Promise<StoryNode> {
  const db = getDatabase();
  if (!db) throw new Error('Database not initialized');

  const openNodeResult = db.exec(
    'SELECT container_id, thread_id, type, slot FROM nodes WHERE id = ? AND role = ?',
    [openNodeId, 'open']
  );

  if (!openNodeResult.length || !openNodeResult[0].values.length) {
    throw new Error('Open node not found');
  }

  const [containerId, threadId, type, openSlot] = openNodeResult[0].values[0] as [
    string | null,
    string,
    MiceType,
    number
  ];

  if (boundary <= openSlot) {
    throw new Error('Close boundary must be after open node');
  }

  await shiftSlots(boundary, 1);

  const timestamp = now();

  const closeNode: StoryNode = {
    id: generateId(),
    containerId,
    threadId,
    type,
    role: 'close',
    slot: boundary,
    title: closeTitle,
    description: '',
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  db.run(
    `INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      closeNode.id,
      closeNode.containerId,
      closeNode.threadId,
      closeNode.type,
      closeNode.role,
      closeNode.slot,
      closeNode.title,
      closeNode.description,
      closeNode.createdAt,
      closeNode.updatedAt,
    ]
  );

  await saveDatabase();
  loadFromDb();

  return closeNode;
}

// Expose functions and stores for testing
if (typeof window !== 'undefined') {
  (window as any).__reloadStore = loadFromDb;
  (window as any).__getContainers = () => {
    let result: Container[] = [];
    containers.subscribe((c) => (result = c))();
    return result;
  };
  (window as any).__getNodes = () => {
    let result: StoryNode[] = [];
    nodes.subscribe((n) => (result = n))();
    return result;
  };
}
