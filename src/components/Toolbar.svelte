<script lang="ts">
  import { getDatabase } from '../lib/db';

  function handleExport() {
    const db = getDatabase();
    if (!db) {
      alert('Database not initialized');
      return;
    }

    const data = db.export();
    const blob = new Blob([data], { type: 'application/x-sqlite3' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'mice-story.db';
    a.click();

    URL.revokeObjectURL(url);
  }
</script>

<header class="toolbar">
  <h1 class="app-title">MICE Story Editor</h1>
  <div class="toolbar-actions">
    <button class="export-btn" on:click={handleExport}>
      Export Database
    </button>
  </div>
</header>

<style>
  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 20px;
    background: #1a1a2e;
    color: white;
    border-bottom: 1px solid #333;
  }

  .app-title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  .toolbar-actions {
    display: flex;
    gap: 8px;
  }

  .export-btn {
    padding: 8px 16px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 14px;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .export-btn:hover {
    background: #2563eb;
  }

  .export-btn:active {
    background: #1d4ed8;
  }
</style>
