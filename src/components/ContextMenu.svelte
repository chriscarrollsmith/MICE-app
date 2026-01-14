<script lang="ts">
  import type { StoryNode, Container } from '../lib/types';

  export let x: number;
  export let y: number;
  export let visible: boolean;
  export let node: StoryNode | null = null;
  export let container: Container | null = null;
  export let onDeleteThread: (threadId: string) => void = () => {};
  export let onDeleteContainer: (containerId: string) => void = () => {};
  export let onClose: () => void = () => {};

  function handleDeleteThread() {
    if (node) {
      onDeleteThread(node.threadId);
    }
    onClose();
  }

  function handleDeleteContainer() {
    if (container) {
      onDeleteContainer(container.id);
    }
    onClose();
  }
</script>

{#if visible && (node || container)}
  <div
    class="context-menu"
    data-testid="context-menu"
    style="left: {x}px; top: {y}px;"
  >
    {#if node}
      <button on:click={handleDeleteThread}>
        Delete Thread
      </button>
    {/if}
    {#if container}
      <button on:click={handleDeleteContainer}>
        Delete Container
      </button>
    {/if}
  </div>
{/if}

<svelte:window on:click={onClose} />

<style>
  .context-menu {
    position: absolute;
    background: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    z-index: 200;
    min-width: 120px;
    padding: 4px 0;
  }

  button {
    display: block;
    width: 100%;
    padding: 8px 16px;
    border: none;
    background: none;
    text-align: left;
    cursor: pointer;
    font-size: 14px;
    color: #333;
  }

  button:hover {
    background: #f5f5f5;
  }

  button:active {
    background: #eee;
  }
</style>
