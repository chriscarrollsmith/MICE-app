<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { Container } from '../../lib/types';

  export let container: Container;
  export let anchorX: number;
  export let anchorY: number;

  const dispatch = createEventDispatcher<{
    confirm: { action: 'delete-all' | 'keep-contents' };
    cancel: void;
  }>();

  let popoverElement: HTMLDivElement;

  function handleClickOutside(e: MouseEvent) {
    if (popoverElement && !popoverElement.contains(e.target as Node)) {
      dispatch('cancel');
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      dispatch('cancel');
    }
  }

  onMount(() => {
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeydown);
    };
  });
</script>

<div
  class="delete-confirm"
  style="left: {anchorX}px; top: {anchorY}px;"
  bind:this={popoverElement}
  data-testid="delete-confirm"
>
  <p class="message">This container has contents.</p>

  <div class="buttons">
    <button
      class="btn btn-danger"
      on:click={() => dispatch('confirm', { action: 'delete-all' })}
    >
      Delete all
    </button>
    <button
      class="btn btn-secondary"
      on:click={() => dispatch('confirm', { action: 'keep-contents' })}
    >
      Keep contents
    </button>
    <button
      class="btn btn-cancel"
      on:click={() => dispatch('cancel')}
    >
      Cancel
    </button>
  </div>
</div>

<style>
  .delete-confirm {
    position: absolute;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 12px;
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    z-index: 100;
    min-width: 180px;
  }

  .message {
    margin: 0 0 12px;
    font-size: 14px;
    color: #374151;
  }

  .buttons {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .btn {
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 13px;
    cursor: pointer;
    border: 1px solid transparent;
  }

  .btn-danger {
    background: #ef4444;
    color: white;
  }

  .btn-danger:hover {
    background: #dc2626;
  }

  .btn-secondary {
    background: #3b82f6;
    color: white;
  }

  .btn-secondary:hover {
    background: #2563eb;
  }

  .btn-cancel {
    background: #f3f4f6;
    color: #374151;
    border-color: #d1d5db;
  }

  .btn-cancel:hover {
    background: #e5e7eb;
  }
</style>
