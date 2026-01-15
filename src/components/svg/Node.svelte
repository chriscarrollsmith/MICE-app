<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { StoryNode, MiceType } from '../../lib/types';
  import TrashButton from './TrashButton.svelte';

  export let node: StoryNode;
  export let x: number;
  export let y: number;
  export let radius: number = 18;
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
  $: currentRadius = hovered || selected ? radius * 1.15 : radius;
  $: color = MICE_COLORS[node.type];
  $: label = MICE_LABELS[node.type];
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
  <circle
    r={currentRadius}
    fill={color}
    stroke={selected ? '#1f2937' : 'transparent'}
    stroke-width="2"
    style="transition: r 150ms ease"
  />
  <text
    class="node-label"
    text-anchor="middle"
    dominant-baseline="central"
    fill="white"
    font-weight="bold"
    font-size="12"
    style="pointer-events: none"
  >
    {label}
  </text>

  {#if hovered}
    <TrashButton
      x={currentRadius * 0.7}
      y={-currentRadius * 0.7}
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

  .node:focus circle {
    stroke: #3b82f6;
    stroke-width: 3;
  }
</style>
