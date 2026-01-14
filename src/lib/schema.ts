import type { Database } from 'sql.js';

export const SCHEMA_VERSION = 1;

export function createTables(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS containers (
      id TEXT PRIMARY KEY,
      parent_id TEXT REFERENCES containers(id),
      title TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      start_position REAL NOT NULL,
      end_position REAL NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      container_id TEXT NOT NULL REFERENCES containers(id),
      thread_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('milieu', 'idea', 'character', 'event')),
      role TEXT NOT NULL CHECK (role IN ('open', 'close')),
      position REAL NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_containers_parent ON containers(parent_id)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_nodes_container ON nodes(container_id)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_nodes_thread ON nodes(thread_id)
  `);
}
