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
  const containerResults = db.exec('SELECT * FROM containers ORDER BY start_position');
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
  const nodeResults = db.exec('SELECT * FROM nodes ORDER BY position');
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
  startPosition: number,
  endPosition: number,
  parentId: string | null = null,
  title: string = '',
  description: string = ''
): Promise<Container> {
  const db = getDatabase();
  if (!db) throw new Error('Database not initialized');

  const container: Container = {
    id: generateId(),
    parentId,
    title,
    description,
    startPosition,
    endPosition,
    createdAt: now(),
    updatedAt: now(),
  };

  db.run(
    `INSERT INTO containers (id, parent_id, title, description, start_position, end_position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      container.id,
      container.parentId,
      container.title,
      container.description,
      container.startPosition,
      container.endPosition,
      container.createdAt,
      container.updatedAt,
    ]
  );

  await saveDatabase();
  containers.update((c) => [...c, container].sort((a, b) => a.startPosition - b.startPosition));

  return container;
}

export async function updateContainer(
  id: string,
  updates: Partial<Pick<Container, 'title' | 'description'>>
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
export async function addThread(
  containerId: string,
  type: MiceType,
  openPosition: number,
  closePosition: number,
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
    position: openPosition,
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
    position: closePosition,
    title: closeTitle,
    description: '',
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  db.run(
    `INSERT INTO nodes (id, container_id, thread_id, type, role, position, title, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      openNode.id,
      openNode.containerId,
      openNode.threadId,
      openNode.type,
      openNode.role,
      openNode.position,
      openNode.title,
      openNode.description,
      openNode.createdAt,
      openNode.updatedAt,
    ]
  );

  db.run(
    `INSERT INTO nodes (id, container_id, thread_id, type, role, position, title, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      closeNode.id,
      closeNode.containerId,
      closeNode.threadId,
      closeNode.type,
      closeNode.role,
      closeNode.position,
      closeNode.title,
      closeNode.description,
      closeNode.createdAt,
      closeNode.updatedAt,
    ]
  );

  await saveDatabase();
  nodes.update((n) => [...n, openNode, closeNode].sort((a, b) => a.position - b.position));

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

  db.run('DELETE FROM nodes WHERE thread_id = ?', [threadId]);

  await saveDatabase();
  nodes.update((n) => n.filter((node) => node.threadId !== threadId));
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
