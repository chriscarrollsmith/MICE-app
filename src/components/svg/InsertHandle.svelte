<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { MiceType } from '../../lib/types';

  export let x: number;
  export let y: number;
  export let zone: 'container' | 'node';
  // insertPositionIndex is the insert position index N (where insert position is N.5)
  export let insertPositionIndex: number;
  export let valid: boolean = true;
  export let nodeMode: 'start' | 'close' = 'start';

  const dispatch = createEventDispatcher<{
    containerClick: { insertPositionIndex: number };
    nodeClick: { insertPositionIndex: number; type: MiceType };
    nodeCloseClick: { insertPositionIndex: number };
  }>();

  const MICE_TYPES: MiceType[] = ['milieu', 'idea', 'character', 'event'];

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

  let hoveredType: MiceType | null = null;
  let hovered = false;
  let closeHovered = false;

  const gridCellSize = 20;
  const gridGap = 2;

  function gridX(i: number): number {
    return (i % 2) * (gridCellSize + gridGap) - gridCellSize - gridGap / 2;
  }

  function gridY(i: number): number {
    return Math.floor(i / 2) * (gridCellSize + gridGap) - gridCellSize - gridGap / 2;
  }
</script>

{#if !valid}
  <!-- Don't render invalid handles -->
{:else if zone === 'container'}
  <g
    class="container-handle"
    transform="translate({x}, {y})"
    on:mouseenter={() => (hovered = true)}
    on:mouseleave={() => (hovered = false)}
    on:click|stopPropagation={() => dispatch('containerClick', { insertPositionIndex })}
    on:keydown={(e) => e.key === 'Enter' && dispatch('containerClick', { insertPositionIndex })}
    role="button"
    tabindex="0"
    data-testid="container-handle"
    data-insert-position-index={insertPositionIndex}
  >
    <rect
      x="-8"
      y="-12"
      width="16"
      height="24"
      rx="2"
      fill={hovered ? '#6b7280' : '#9ca3af'}
      opacity={hovered ? 0.8 : 0.5}
      style="transition: all 150ms ease"
    />
  </g>
{:else}
  {#if nodeMode === 'close'}
    <!-- Close-node placement handle (used during two-step thread creation) -->
    <g
      class="node-handle close-node-handle"
      transform="translate({x}, {y})"
      on:mouseenter={() => (closeHovered = true)}
      on:mouseleave={() => (closeHovered = false)}
      on:click|stopPropagation={() => dispatch('nodeCloseClick', { insertPositionIndex })}
      on:keydown={(e) => e.key === 'Enter' && dispatch('nodeCloseClick', { insertPositionIndex })}
      role="button"
      tabindex="0"
      data-testid="close-node-handle"
      data-insert-position-index={insertPositionIndex}
    >
      <circle r="9" fill={closeHovered ? '#111827' : '#374151'} opacity={closeHovered ? 0.9 : 0.6} />
      <text
        x="0"
        y="0"
        text-anchor="middle"
        dominant-baseline="central"
        fill="white"
        font-weight="bold"
        font-size="10"
        style="pointer-events: none"
      >
        +
      </text>
    </g>
  {:else}
    <g
      class="node-handle mice-grid"
      transform="translate({x}, {y})"
      data-testid="mice-grid"
      data-insert-position-index={insertPositionIndex}
    >
      {#each MICE_TYPES as type, i}
        <g
          on:mouseenter={() => (hoveredType = type)}
          on:mouseleave={() => (hoveredType = null)}
          on:click|stopPropagation={() => dispatch('nodeClick', { insertPositionIndex, type })}
          on:keydown={(e) => e.key === 'Enter' && dispatch('nodeClick', { insertPositionIndex, type })}
          role="button"
          tabindex="0"
          data-type={type}
        >
          <rect
            x={gridX(i)}
            y={gridY(i)}
            width={gridCellSize}
            height={gridCellSize}
            rx="2"
            fill={MICE_COLORS[type]}
            opacity={hoveredType === type ? 1 : 0.4}
            style="transition: opacity 150ms ease"
          />
          <text
            x={gridX(i) + gridCellSize / 2}
            y={gridY(i) + gridCellSize / 2}
            text-anchor="middle"
            dominant-baseline="central"
            fill="white"
            font-weight="bold"
            font-size="10"
            style="pointer-events: none"
          >
            {MICE_LABELS[type]}
          </text>
        </g>
      {/each}
    </g>
  {/if}
{/if}

<style>
  .container-handle {
    cursor: pointer;
  }

  .mice-grid [role="button"] {
    cursor: pointer;
  }

  .close-node-handle {
    cursor: pointer;
  }
</style>
