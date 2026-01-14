<script lang="ts">
  import type { MiceType } from '../lib/types';
  import { MICE_COLORS, MICE_LABELS } from '../lib/types';

  export let x: number;
  export let y: number;
  export let visible: boolean;
  export let onSelect: (type: MiceType) => void;

  let hoveredType: MiceType | null = null;

  const types: MiceType[] = ['milieu', 'idea', 'character', 'event'];

  function handleMouseEnter(type: MiceType) {
    hoveredType = type;
  }

  function handleMouseLeave() {
    hoveredType = null;
  }

  function handleClick(type: MiceType) {
    onSelect(type);
  }
</script>

{#if visible}
  <div
    class="hover-grid"
    data-testid="hover-grid"
    style="left: {x - 40}px; top: {y - 40}px;"
  >
    {#each types as type, i}
      <button
        class="grid-cell"
        class:hovered={hoveredType === type}
        data-type={type}
        style="--color: {MICE_COLORS[type]};"
        on:mouseenter={() => handleMouseEnter(type)}
        on:mouseleave={handleMouseLeave}
        on:click={() => handleClick(type)}
      >
        {MICE_LABELS[type]}
      </button>
    {/each}
  </div>
{/if}

<style>
  .hover-grid {
    position: absolute;
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    gap: 4px;
    width: 80px;
    height: 80px;
    pointer-events: auto;
    z-index: 10;
  }

  .grid-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid var(--color);
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.8);
    color: var(--color);
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.15s ease;
    opacity: 0.6;
  }

  .grid-cell:hover,
  .grid-cell.hovered {
    opacity: 1;
    background: var(--color);
    color: white;
    transform: scale(1.1);
    z-index: 1;
  }
</style>
