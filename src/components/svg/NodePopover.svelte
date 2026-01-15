<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { StoryNode } from '../../lib/types';

  export let node: StoryNode;
  export let anchorX: number;
  export let anchorY: number;
  // Container element to calculate viewport-relative position
  export let containerElement: HTMLElement | null = null;

  const dispatch = createEventDispatcher<{
    close: void;
    update: { title: string; description: string };
  }>();

  let title = node.title;
  let description = node.description;
  let popoverElement: HTMLDivElement;

  // Calculate viewport-relative position
  $: viewportX = containerElement
    ? containerElement.getBoundingClientRect().left + anchorX
    : anchorX;
  $: viewportY = containerElement
    ? containerElement.getBoundingClientRect().top + anchorY + 30
    : anchorY + 30;

  // Debounce save
  let saveTimeout: ReturnType<typeof setTimeout>;
  function scheduleUpdate() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      if (title !== node.title || description !== node.description) {
        dispatch('update', { title, description });
      }
    }, 300);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      dispatch('close');
    }
  }

  function handleClickOutside(e: MouseEvent) {
    if (popoverElement && !popoverElement.contains(e.target as Node)) {
      dispatch('close');
    }
  }

  onMount(() => {
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeydown);
      clearTimeout(saveTimeout);
    };
  });

  // Reset local state when node changes
  $: {
    title = node.title;
    description = node.description;
  }
</script>

<div
  class="node-popover"
  style="left: {viewportX}px; top: {viewportY}px;"
  bind:this={popoverElement}
  data-testid="node-popover"
>
  <button class="close-btn" on:click={() => dispatch('close')} aria-label="Close">
    &times;
  </button>

  <input
    type="text"
    bind:value={title}
    on:input={scheduleUpdate}
    placeholder="Title"
    class="title-input"
    data-testid="node-title-input"
  />

  <textarea
    bind:value={description}
    on:input={scheduleUpdate}
    placeholder="Description"
    rows="3"
    class="description-input"
    data-testid="node-description-input"
  ></textarea>
</div>

<style>
  .node-popover {
    position: fixed;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 12px;
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    min-width: 200px;
    z-index: 100;
  }

  .close-btn {
    position: absolute;
    top: 4px;
    right: 8px;
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    color: #6b7280;
    padding: 0;
    line-height: 1;
  }

  .close-btn:hover {
    color: #1f2937;
  }

  .title-input {
    width: 100%;
    padding: 8px;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    font-size: 14px;
    margin-bottom: 8px;
  }

  .title-input:focus {
    outline: none;
    border-color: #3b82f6;
  }

  .description-input {
    width: 100%;
    padding: 8px;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    font-size: 14px;
    resize: vertical;
  }

  .description-input:focus {
    outline: none;
    border-color: #3b82f6;
  }
</style>
