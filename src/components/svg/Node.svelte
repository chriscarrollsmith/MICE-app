<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { StoryNode, MiceType } from '../../lib/types';
  import TrashButton from './TrashButton.svelte';

  export let node: StoryNode;
  export let x: number;
  export let y: number;
  export let rowHeight: number = 120;
  export let selected: boolean = false;

  const dispatch = createEventDispatcher<{
    click: { node: StoryNode };
    delete: { node: StoryNode };
  }>();

  const MICE_COLORS: Record<MiceType, string> = {
    milieu: '#22c55e',
    idea: '#3b82f6',
    character: '#f59e0b',
    event: '#ef4444',
  };

  const MICE_LABELS: Record<MiceType, string> = {
    milieu: 'M',
    idea: 'I',
    character: 'C',
    event: 'E',
  };

  let hovered = false;
  $: nodeSize = rowHeight * 0.65;
  $: currentSize = hovered || selected ? nodeSize * 1.05 : nodeSize;
  $: color = MICE_COLORS[node.type];
  $: typeLabel = MICE_LABELS[node.type];
  $: displayText = node.title ? `${typeLabel}: ${node.title}` : typeLabel;
  $: fontSize = Math.max(14, Math.floor(nodeSize / 12));
  
  // Truncate text to fit within node (with padding on each side)
  // Approximate: each character is about 0.6 * fontSize wide for monospace-like text
  // Leave 20px padding total (10px each side)
  $: availableWidth = nodeSize - 20;
  $: charWidth = fontSize * 0.6;
  $: maxChars = Math.floor(availableWidth / charWidth);
  $: truncatedText = displayText.length > maxChars 
    ? displayText.substring(0, maxChars - 3) + '...' 
    : displayText;
</script>

<g
  class="node"
  class:selected
  transform="translate({x}, {y})"
  on:mouseenter={() => (hovered = true)}
  on:mouseleave={() => (hovered = false)}
  on:click|stopPropagation={() => dispatch('click', { node })}
  on:keydown={(e) => e.key === 'Enter' && dispatch('click', { node })}
  role="button"
  tabindex="0"
  data-node-id={node.id}
  data-testid="node"
>
  <rect
    x={-currentSize / 2}
    y={-currentSize / 2}
    width={currentSize}
    height={currentSize}
    fill={color}
    stroke={selected ? '#1f2937' : 'transparent'}
    stroke-width="2"
    rx="4"
    style="transition: width 150ms ease, height 150ms ease, x 150ms ease, y 150ms ease"
  />
  <text
    class="node-label"
    text-anchor="middle"
    dominant-baseline="central"
    fill="white"
    font-weight="bold"
    font-size={fontSize}
    style="pointer-events: none"
  >
    {truncatedText}
  </text>

  {#if hovered}
    <TrashButton
      x={currentSize / 2 - 10}
      y={-currentSize / 2 + 10}
      size={14}
      on:click={() => dispatch('delete', { node })}
    />
  {/if}
</g>

<style>
  .node {
    cursor: pointer;
  }

  .node:focus {
    outline: none;
  }

  .node:focus rect {
    stroke: #3b82f6;
    stroke-width: 3;
  }
</style>
