import { writable, derived } from 'svelte/store';
import type { Container, StoryNode, MiceType } from '../lib/types';
import type { Database, SqlValue } from 'sql.js';
import { getDatabase, saveDatabase, generateId, now } from '../lib/db';
import { getTotalSlots } from '../lib/slots';

// Writable stores
export const containers = writable<Container[]>([]);
export const nodes = writable<StoryNode[]>([]);

const INSERT_NODE_SQL = `INSERT INTO nodes (id, container_id, thread_id, type, role, slot, title, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

function snakeToCamel(col: string): string {
  return col.replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase());
}

function execResultToObjects<T>(result: { columns: string[]; values: SqlValue[][] }): T[] {
  const camelCols = result.columns.map(snakeToCamel);
  return result.values.map((row: SqlValue[]) => {
    const obj: Record<string, SqlValue> = {};
    camelCols.forEach((col: string, i: number) => {
      obj[col] = row[i];
    });
    return obj as unknown as T;
  });
}

function createStoryNode(args: {
  containerId: string | null;
  threadId: string;
  type: MiceType;
  role: 'open' | 'close';
  slot: number;
  title: string;
  timestamp?: string;
}): StoryNode {
  const timestamp = args.timestamp ?? now();
  return {
    id: generateId(),
    containerId: args.containerId,
    threadId: args.threadId,
    type: args.type,
    role: args.role,
    slot: args.slot,
    title: args.title,
    description: '',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function insertStoryNode(db: Database, node: StoryNode): void {
  db.run(INSERT_NODE_SQL, [
    node.id,
    node.containerId,
    node.threadId,
    node.type,
    node.role,
    node.slot,
    node.title,
    node.description,
    node.createdAt,
    node.updatedAt,
  ]);
}

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
    const loadedContainers = execResultToObjects<Container>(containerResults[0]);
    containers.set(loadedContainers);
  } else {
    containers.set([]);
  }

  // Load nodes
  const nodeResults = db.exec('SELECT * FROM nodes ORDER BY slot');
  if (nodeResults.length > 0) {
    const loadedNodes = execResultToObjects<StoryNode>(nodeResults[0]);
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
 * Create a container at insert positions (half-steps).
 * Both start and end boundaries are inserted as new slots, ensuring they never collide with existing nodes.
 * Insert position index N corresponds to insert position N.5, which creates a new slot at slot N.
 *
 * @param startInsertPositionIndex Insert position index for the start boundary
 * @param endInsertPositionIndex Insert position index for the end boundary
 * @param parentId Parent container ID, or null for top-level
 * @param title Container title
 */
export async function addContainerAtInsertPositions(
  startInsertPositionIndex: number,
  endInsertPositionIndex: number,
  parentId: string | null = null,
  title: string = ''
): Promise<Container> {
  const db = getDatabase();
  if (!db) throw new Error('Database not initialized');

  // Normalize direction
  const a = Math.min(startInsertPositionIndex, endInsertPositionIndex);
  const b = Math.max(startInsertPositionIndex, endInsertPositionIndex);

  // Get current total slots to check if canvas is empty
  const currentContainers = db.exec('SELECT * FROM containers');
  const currentNodes = db.exec('SELECT * FROM nodes');
  const totalSlots = getTotalSlots(
    currentContainers.length > 0 ? execResultToObjects<Container>(currentContainers[0]) : [],
    currentNodes.length > 0 ? execResultToObjects<StoryNode>(currentNodes[0]) : []
  );

  let startSlot: number;
  let endSlot: number;

  if (totalSlots === 0) {
    // Empty canvas: directly create container at slots 0-1
    startSlot = 0;
    endSlot = 1;
  } else {
    // Insert start boundary: shift slots >= a right by 1, then place boundary at slot a
    await shiftSlots(a, 1);
    startSlot = a;

    // Insert end boundary: shift slots >= (b + 1) right by 1 (accounting for first insertion)
    // Then place boundary at slot (b + 1)
    await shiftSlots(b + 1, 1);
    endSlot = b + 1;
  }

  // Create the container with the allocated boundary slots
  const container = await addContainer(startSlot, endSlot, parentId, title);
  // Rehydrate stores after slot shifts
  loadFromDb();
  return container;
}

/**
 * Create a container while enforcing the constraint that slots are exclusive.
 * Each container boundary occupies exactly one slot, and slots cannot be shared.
 * If a node currently occupies the start or end slot, shift slots right to make room.
 * @deprecated Use addContainerAtInsertPositions instead for proper insertion semantics
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
    return Number(res[0]?.values?.[0]?.[0] ?? 0) > 0;
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

  // Collect the full container subtree (children first) so deletion is safe even if
  // foreign key constraints are enforced on parent_id relationships.
  const containerIds: string[] = [];
  (function collectSubtree(containerId: string) {
    const children = db.exec('SELECT id FROM containers WHERE parent_id = ?', [containerId]);
    const childIds: string[] = children[0]?.values?.map((r: any[]) => r[0] as string) ?? [];
    for (const childId of childIds) {
      collectSubtree(childId);
    }
    containerIds.push(containerId);
  })(id);

  const placeholders = containerIds.map(() => '?').join(', ');

  // Record which occupied slots will be removed so we can compact the timeline after deletion.
  // Each container boundary occupies exactly one slot (startSlot and endSlot), just like nodes.
  const removedSlots: number[] = [];

  const boundaryRows = db.exec(
    `SELECT start_slot, end_slot FROM containers WHERE id IN (${placeholders})`,
    containerIds
  );
  for (const row of boundaryRows[0]?.values ?? []) {
    removedSlots.push(row[0] as number, row[1] as number);
  }

  const nodeSlotRows = db.exec(
    `SELECT slot FROM nodes WHERE container_id IN (${placeholders}) ORDER BY slot`,
    containerIds
  );
  for (const row of nodeSlotRows[0]?.values ?? []) {
    removedSlots.push(row[0] as number);
  }

  // Delete all nodes in these containers.
  db.run(`DELETE FROM nodes WHERE container_id IN (${placeholders})`, containerIds);

  // Delete containers (children first).
  for (const containerId of containerIds) {
    db.run('DELETE FROM containers WHERE id = ?', [containerId]);
  }

  // Compact the timeline by removing the deleted slots and shifting remaining slots left.
  // Each shift reduces subsequent slot indices by 1, so we adjust the fromSlot as we go.
  // After deletion, slots should be renormalized to be contiguous starting from 0.
  const uniqueRemovedSlots = Array.from(new Set(removedSlots)).sort((a, b) => a - b);
  let shiftsApplied = 0;
  for (const slot of uniqueRemovedSlots) {
    await shiftSlots(slot + 1 - shiftsApplied, -1);
    shiftsApplied += 1;
  }

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
  const openNode = createStoryNode({
    containerId,
    threadId,
    type,
    role: 'open',
    slot,
    title,
    timestamp,
  });

  insertStoryNode(db, openNode);

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

  const closeNode = createStoryNode({
    containerId,
    threadId,
    type,
    role: 'close',
    slot,
    title,
    timestamp,
  });

  insertStoryNode(db, closeNode);

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

  const openNode = createStoryNode({
    containerId,
    threadId,
    type,
    role: 'open',
    slot: openSlot,
    title: openTitle,
    timestamp,
  });

  const closeNode = createStoryNode({
    containerId,
    threadId,
    type,
    role: 'close',
    slot: closeSlot,
    title: closeTitle,
    timestamp,
  });

  insertStoryNode(db, openNode);
  insertStoryNode(db, closeNode);

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
 * Insert a new thread at insert position N.5.
 * Insert position N.5 is between slot N and slot N+1.
 * - Insert position index 0 (insert position 0.5) = before slot 0, or at center on empty canvas
 * - Insert position index N (insert position N.5) = between slot N-1 and slot N
 *
 * This will:
 * 1. Shift all slots >= N right by 2 (to make room for open and close nodes)
 * 2. Insert the open node at slot N
 * 3. Insert the close node at slot N+1
 *
 * @param insertPositionIndex Insert position index N (where insert position is N.5)
 */
export async function insertThreadAtBoundary(
  insertPositionIndex: number,
  type: MiceType,
  containerId: string | null = null,
  openTitle: string = '',
  closeTitle: string = ''
): Promise<{ openNode: StoryNode; closeNode: StoryNode }> {
  const db = getDatabase();
  if (!db) throw new Error('Database not initialized');

  // First, shift all slots >= N right by 2 to make room for the new thread
  await shiftSlots(insertPositionIndex, 2);

  // Now insert the new thread at insert position N.5
  const threadId = generateId();
  const timestamp = now();

  const openNode = createStoryNode({
    containerId,
    threadId,
    type,
    role: 'open',
    slot: insertPositionIndex,
    title: openTitle,
    timestamp,
  });

  const closeNode = createStoryNode({
    containerId,
    threadId,
    type,
    role: 'close',
    slot: insertPositionIndex + 1,
    title: closeTitle,
    timestamp,
  });

  insertStoryNode(db, openNode);
  insertStoryNode(db, closeNode);

  await saveDatabase();

  // Reload from DB to get the shifted state
  loadFromDb();

  return { openNode, closeNode };
}

/**
 * Insert ONLY an opening node at insert position N.5.
 *
 * This is the first step of canonical two-step thread creation:
 * 1) Insert open node at insert position N.5 (shifts all slots >= N right by 1, places node at slot N)
 * 2) Later, insert close node at a chosen insert position M.5 (shifts slots >= M right by 1, places node at slot M)
 *
 * @param insertPositionIndex Insert position index N (where insert position is N.5)
 */
export async function insertOpenNodeAtBoundary(
  insertPositionIndex: number,
  type: MiceType,
  containerId: string | null = null,
  openTitle: string = ''
): Promise<StoryNode> {
  const db = getDatabase();
  if (!db) throw new Error('Database not initialized');

  await shiftSlots(insertPositionIndex, 1);

  const threadId = generateId();
  const timestamp = now();

  const openNode = createStoryNode({
    containerId,
    threadId,
    type,
    role: 'open',
    slot: insertPositionIndex,
    title: openTitle,
    timestamp,
  });

  insertStoryNode(db, openNode);

  await saveDatabase();
  loadFromDb();

  return openNode;
}

/**
 * Insert the closing node for an existing thread at insert position N.5.
 *
 * This is the second step of canonical two-step thread creation.
 * Shifts all slots >= N right by 1 and places the close node at slot N.
 *
 * @param insertPositionIndex Insert position index N (where insert position is N.5)
 */
export async function insertCloseNodeAtBoundary(
  openNodeId: string,
  insertPositionIndex: number,
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

  if (insertPositionIndex <= openSlot) {
    throw new Error('Close insert position must be after open node');
  }

  await shiftSlots(insertPositionIndex, 1);

  const timestamp = now();

  const closeNode = createStoryNode({
    containerId,
    threadId,
    type,
    role: 'close',
    slot: insertPositionIndex,
    title: closeTitle,
    timestamp,
  });

  insertStoryNode(db, closeNode);

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
