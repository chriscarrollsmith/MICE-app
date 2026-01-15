<script lang="ts">
  import type { ArcPath, ArcSegment } from '../../lib/layout';

  export let arc: ArcPath;
  export let rowHeight: number = 120;
  export let highlighted: boolean = false;

  $: opacity = highlighted ? 1 : 0.6;

  function getSegmentPath(segment: ArcSegment): string {
    const baseY = segment.row * rowHeight + rowHeight / 2;

    switch (segment.type) {
      case 'same-row': {
        // Quadratic bezier arc curving upward
        const midX = (segment.startX + segment.endX) / 2;
        return `M ${segment.startX} ${baseY} Q ${midX} ${segment.controlY} ${segment.endX} ${baseY}`;
      }
      case 'exit': {
        // From node to right edge, curving up
        const midX = (segment.startX + segment.endX) / 2;
        const controlY = baseY - rowHeight * 0.3;
        return `M ${segment.startX} ${baseY} Q ${midX} ${controlY} ${segment.endX} ${controlY}`;
      }
      case 'entry': {
        // From left edge to node, curving down
        const midX = (segment.startX + segment.endX) / 2;
        const controlY = baseY - rowHeight * 0.3;
        return `M ${segment.startX} ${controlY} Q ${midX} ${controlY} ${segment.endX} ${baseY}`;
      }
      case 'continuation': {
        // Dashed line across the row
        return '';
      }
    }
  }
</script>

<g class="arc" style="opacity: {opacity}; transition: opacity 150ms" data-thread-id={arc.threadId}>
  {#each arc.segments as segment}
    {#if segment.type === 'same-row'}
      <path
        d={getSegmentPath(segment)}
        fill="none"
        stroke={arc.color}
        stroke-width="2"
      />
    {:else if segment.type === 'exit'}
      <path
        d={getSegmentPath(segment)}
        fill="none"
        stroke={arc.color}
        stroke-width="2"
      />
      <!-- Continuation dot at right edge -->
      <circle
        cx={segment.endX - 4}
        cy={segment.row * rowHeight + rowHeight / 2 - rowHeight * 0.3}
        r="4"
        fill={arc.color}
      />
    {:else if segment.type === 'entry'}
      <!-- Continuation dot at left edge -->
      <circle
        cx={segment.startX + 4}
        cy={segment.row * rowHeight + rowHeight / 2 - rowHeight * 0.3}
        r="4"
        fill={arc.color}
      />
      <path
        d={getSegmentPath(segment)}
        fill="none"
        stroke={arc.color}
        stroke-width="2"
      />
    {:else if segment.type === 'continuation'}
      <!-- Dashed continuation line -->
      <line
        x1="0"
        y1={segment.row * rowHeight + rowHeight / 2 - rowHeight * 0.3}
        x2="100%"
        y2={segment.row * rowHeight + rowHeight / 2 - rowHeight * 0.3}
        stroke={arc.color}
        stroke-width="2"
        stroke-dasharray="4 4"
      />
    {/if}
  {/each}
</g>
