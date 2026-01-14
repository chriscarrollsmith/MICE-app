<script lang="ts">
  import type { StoryNode, Container } from '../lib/types';
  import { MICE_COLORS, MICE_LABELS } from '../lib/types';

  export let node: StoryNode | null = null;
  export let container: Container | null = null;
  export let onUpdate: (updates: { title?: string; description?: string }) => void = () => {};
  export let onClose: () => void = () => {};

  let title = '';
  let description = '';

  $: {
    if (node) {
      title = node.title;
      description = node.description;
    } else if (container) {
      title = container.title;
      description = container.description;
    }
  }

  function handleTitleChange(event: Event) {
    const target = event.target as HTMLInputElement;
    title = target.value;
    onUpdate({ title });
  }

  function handleDescriptionChange(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    description = target.value;
    onUpdate({ description });
  }
</script>

{#if node || container}
  <div class="detail-panel" data-testid="detail-panel">
    <div class="panel-header">
      <span class="panel-title">
        {#if node}
          <span class="type-indicator" style="background-color: {MICE_COLORS[node.type]}"></span>
          {MICE_LABELS[node.type]} - {node.role === 'open' ? 'Open' : 'Close'}
        {:else if container}
          Container
        {/if}
      </span>
      <button class="close-btn" on:click={onClose} aria-label="Close panel">&times;</button>
    </div>

    <div class="panel-content">
      <div class="form-group">
        <label for="title">Title</label>
        <input
          id="title"
          name="title"
          type="text"
          value={title}
          on:input={handleTitleChange}
          placeholder="Enter title..."
        />
      </div>

      <div class="form-group">
        <label for="description">Description</label>
        <textarea
          id="description"
          name="description"
          value={description}
          on:input={handleDescriptionChange}
          placeholder="Enter description..."
          rows="4"
        ></textarea>
      </div>
    </div>
  </div>
{/if}

<style>
  .detail-panel {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 300px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 100;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid #eee;
    background: #f9f9f9;
    border-radius: 8px 8px 0 0;
  }

  .panel-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    font-size: 14px;
  }

  .type-indicator {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    color: #666;
    padding: 0;
    line-height: 1;
  }

  .close-btn:hover {
    color: #333;
  }

  .panel-content {
    padding: 16px;
  }

  .form-group {
    margin-bottom: 16px;
  }

  .form-group:last-child {
    margin-bottom: 0;
  }

  label {
    display: block;
    font-size: 12px;
    font-weight: 500;
    color: #666;
    margin-bottom: 4px;
  }

  input, textarea {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
    font-family: inherit;
    box-sizing: border-box;
  }

  input:focus, textarea:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  }

  textarea {
    resize: vertical;
    min-height: 80px;
  }
</style>
