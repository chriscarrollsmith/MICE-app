import type { Database } from 'sql.js';

export const SCHEMA_VERSION = 3;

/**
 * Check and migrate database schema if needed.
 * Returns true if migration was performed (data was reset).
 */
export function migrateIfNeeded(db: Database): boolean {
  // Check if schema_version table exists
  const versionTableExists = db.exec(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'"
  );

  if (versionTableExists.length === 0 || versionTableExists[0].values.length === 0) {
    // No version table - this is either a fresh db or old schema
    // Check if we have the old schema by looking for 'position' column in nodes
    const nodesTableExists = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='nodes'"
    );

    if (nodesTableExists.length > 0 && nodesTableExists[0].values.length > 0) {
      // Nodes table exists - check its schema
      const nodeSchema = db.exec("PRAGMA table_info(nodes)");
      if (nodeSchema.length > 0) {
        const columns = nodeSchema[0].values.map((row) => row[1]); // column name is index 1
        if (columns.includes('position')) {
          // Old schema detected - drop everything and recreate
          console.log('Old schema detected, migrating to slot-based schema...');
          db.run('DROP TABLE IF EXISTS nodes');
          db.run('DROP TABLE IF EXISTS containers');
          createTables(db);
          return true;
        }
      }
    }

    // Create version table and set current version
    db.run('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER)');
    db.run('INSERT INTO schema_version (version) VALUES (?)', [SCHEMA_VERSION]);
    return false;
  }

  // Version table exists - check the version
  const versionResult = db.exec('SELECT version FROM schema_version');
  const currentVersion = versionResult.length > 0 && versionResult[0].values.length > 0
    ? (versionResult[0].values[0][0] as number)
    : 0;

  if (currentVersion < SCHEMA_VERSION) {
    // Migration from version 2 to 3: Allow NULL container_id
    if (currentVersion < 3) {
      // SQLite doesn't support ALTER COLUMN, so we need to recreate the table
      // First, check if the constraint exists by trying to insert a null
      try {
        db.run('DROP TABLE IF EXISTS nodes_backup');
        db.run(`CREATE TABLE nodes_backup AS SELECT * FROM nodes`);
        db.run('DROP TABLE nodes');
        db.run(`
          CREATE TABLE nodes (
            id TEXT PRIMARY KEY,
            container_id TEXT REFERENCES containers(id),
            thread_id TEXT NOT NULL,
            type TEXT NOT NULL CHECK (type IN ('milieu', 'idea', 'character', 'event')),
            role TEXT NOT NULL CHECK (role IN ('open', 'close')),
            slot INTEGER NOT NULL,
            title TEXT NOT NULL DEFAULT '',
            description TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          )
        `);
        db.run(`INSERT INTO nodes SELECT * FROM nodes_backup`);
        db.run('DROP TABLE nodes_backup');
        db.run('CREATE INDEX IF NOT EXISTS idx_nodes_container ON nodes(container_id)');
        db.run('CREATE INDEX IF NOT EXISTS idx_nodes_thread ON nodes(thread_id)');
        db.run('CREATE INDEX IF NOT EXISTS idx_nodes_slot ON nodes(slot)');
      } catch (e) {
        console.error('Migration error:', e);
      }
    }
    db.run('UPDATE schema_version SET version = ?', [SCHEMA_VERSION]);
  }

  return false;
}

export function createTables(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS containers (
      id TEXT PRIMARY KEY,
      parent_id TEXT REFERENCES containers(id),
      title TEXT NOT NULL DEFAULT '',
      start_slot INTEGER NOT NULL,
      end_slot INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      container_id TEXT REFERENCES containers(id),
      thread_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('milieu', 'idea', 'character', 'event')),
      role TEXT NOT NULL CHECK (role IN ('open', 'close')),
      slot INTEGER NOT NULL,
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

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_containers_slots ON containers(start_slot, end_slot)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_nodes_slot ON nodes(slot)
  `);
}
