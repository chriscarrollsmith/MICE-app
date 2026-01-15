import initSqlJs, { type Database } from 'sql.js';
import { get, set } from 'idb-keyval';
import { createTables, migrateIfNeeded } from './schema';

const DB_STORAGE_KEY = 'mice-app-database';

let db: Database | null = null;

export async function initDatabase(): Promise<Database> {
  const SQL = await initSqlJs({
    locateFile: (file) => `/${file}`,
  });

  // Try to load existing database from IndexedDB
  const savedData = await get<Uint8Array>(DB_STORAGE_KEY);

  if (savedData) {
    db = new SQL.Database(savedData);
    // Check for schema migration needs
    const migrated = migrateIfNeeded(db);
    if (migrated) {
      // Save the migrated database
      const data = db.export();
      await set(DB_STORAGE_KEY, data);
    }
  } else {
    db = new SQL.Database();
    createTables(db);
    // Create schema version table for new databases
    db.run('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER)');
    db.run('INSERT INTO schema_version (version) VALUES (?)', [2]);
  }

  // Expose for testing (development only)
  if (typeof window !== 'undefined') {
    (window as any).__db = db;
    (window as any).__saveDb = saveDatabase;
    // Note: __reloadStore is set by stores/story.ts
  }

  return db;
}

export async function saveDatabase(): Promise<void> {
  if (!db) return;
  const data = db.export();
  await set(DB_STORAGE_KEY, data);
}

export function getDatabase(): Database | null {
  return db;
}

export function runQuery(sql: string, params: any[] = []): void {
  if (!db) throw new Error('Database not initialized');
  db.run(sql, params);
}

export function execQuery(sql: string): any[] {
  if (!db) throw new Error('Database not initialized');
  return db.exec(sql);
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function now(): string {
  return new Date().toISOString();
}
