<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { ContainerSegment, LayoutConfig } from '../../lib/layout';
  import type { Container } from '../../lib/types';
  import TrashButton from './TrashButton.svelte';

  export let segment: ContainerSegment;
  export let container: Container;
  export let config: LayoutConfig;
  export let containerIndex: number = 0;
  export let selected: boolean = false;

  const dispatch = createEventDispatcher<{
    click: { container: Container };
    delete: { container: Container };
    titleChange: { container: Container; title: string };
  }>();

  let hovered = false;
  let editingTitle = false;
  let titleInput = container.title;

  $: rowY = segment.row * config.rowHeight;
  $: nestingOffset = segment.nestingDepth * config.padding;
  $: displayTitle = container.title || `Scene ${containerIndex + 1}`;

  // Container spans most of the row height (with padding)
  const topPadding = 4;
  const bottomPadding = 8;
  $: topY = nestingOffset + topPadding;
  $: bottomY = config.rowHeight - nestingOffset - bottomPadding;
  $: containerHeight = bottomY - topY;

  // Calculate segment path based on type - now spanning full row height
  $: segmentPath = calculatePath(segment, topY, bottomY, nestingOffset);

  function calculatePath(seg: ContainerSegment, top: number, bottom: number, offset: number): string {
    const cornerRadius = 6;

    switch (seg.segmentType) {
      case 'single':
        // Full rectangle with rounded corners
        return `
          M ${seg.startX + cornerRadius} ${top}
          L ${seg.endX - cornerRadius} ${top}
          Q ${seg.endX} ${top} ${seg.endX} ${top + cornerRadius}
          L ${seg.endX} ${bottom - cornerRadius}
          Q ${seg.endX} ${bottom} ${seg.endX - cornerRadius} ${bottom}
          L ${seg.startX + cornerRadius} ${bottom}
          Q ${seg.startX} ${bottom} ${seg.startX} ${bottom - cornerRadius}
          L ${seg.startX} ${top + cornerRadius}
          Q ${seg.startX} ${top} ${seg.startX + cornerRadius} ${top}
        `;
      case 'first':
        // Left rounded, open right
        return `
          M ${seg.endX} ${top}
          L ${seg.startX + cornerRadius} ${top}
          Q ${seg.startX} ${top} ${seg.startX} ${top + cornerRadius}
          L ${seg.startX} ${bottom - cornerRadius}
          Q ${seg.startX} ${bottom} ${seg.startX + cornerRadius} ${bottom}
          L ${seg.endX} ${bottom}
        `;
      case 'middle':
        // Open both sides (just top and bottom lines)
        return `
          M ${seg.startX} ${top} L ${seg.endX} ${top}
          M ${seg.startX} ${bottom} L ${seg.endX} ${bottom}
        `;
      case 'last':
        // Open left, right rounded
        return `
          M ${seg.startX} ${top}
          L ${seg.endX - cornerRadius} ${top}
          Q ${seg.endX} ${top} ${seg.endX} ${top + cornerRadius}
          L ${seg.endX} ${bottom - cornerRadius}
          Q ${seg.endX} ${bottom} ${seg.endX - cornerRadius} ${bottom}
          L ${seg.startX} ${bottom}
        `;
    }
  }

  function handleTitleClick(e: MouseEvent | KeyboardEvent) {
    e.stopPropagation();
    editingTitle = true;
    titleInput = container.title;
  }

  function commitTitle() {
    editingTitle = false;
    if (titleInput !== container.title) {
      dispatch('titleChange', { container, title: titleInput });
    }
  }

  function handleTitleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      commitTitle();
    } else if (e.key === 'Escape') {
      editingTitle = false;
      titleInput = container.title;
    }
  }
</script>

<g
  class="container-segment"
  class:selected
  class:hovered
  transform="translate(0, {rowY})"
  on:mouseenter={() => (hovered = true)}
  on:mouseleave={() => (hovered = false)}
  on:click|stopPropagation={() => dispatch('click', { container })}
  on:keydown={(e) => e.key === 'Enter' && dispatch('click', { container })}
  role="button"
  tabindex="0"
  data-container-id={container.id}
  data-testid="container-segment"
>
  <!-- Invisible hit area for better hover detection -->
  <rect
    x={segment.startX}
    y={topY}
    width={segment.endX - segment.startX}
    height={containerHeight}
    fill="transparent"
    class="hit-area"
  />

  <!-- Container frame -->
  <path
    d={segmentPath}
    fill="rgba(249, 250, 251, 0.5)"
    stroke={selected ? '#1f2937' : '#9ca3af'}
    stroke-width="2"
  />

  {#if segment.segmentType === 'single' || segment.segmentType === 'first'}
    <!-- Container title at top -->
    {#if editingTitle}
      <foreignObject
        x={segment.startX + 8}
        y={topY + 2}
        width="120"
        height="20"
      >
        <input
          type="text"
          bind:value={titleInput}
          on:blur={commitTitle}
          on:keydown={handleTitleKeydown}
          class="title-input"
          autofocus
        />
      </foreignObject>
    {:else}
      <text
        x={segment.startX + 12}
        y={topY + 14}
        class="title-label"
        on:click={handleTitleClick}
        on:keydown={(e) => e.key === 'Enter' && handleTitleClick(e)}
        role="button"
        tabindex="0"
      >
        {displayTitle}
      </text>
    {/if}
  {/if}

  {#if hovered}
    <!-- Trash button at bottom-right corner of container -->
    <TrashButton
      x={segment.endX - 20}
      y={bottomY - 20}
      size={16}
      on:click={() => dispatch('delete', { container })}
    />
  {/if}
</g>

<style>
  .container-segment {
    cursor: pointer;
  }

  .container-segment:focus {
    outline: none;
  }

  .hit-area {
    pointer-events: all;
  }

  .title-label {
    font-size: 11px;
    fill: #6b7280;
    cursor: text;
  }

  .title-label:hover {
    fill: #374151;
  }

  :global(.title-input) {
    width: 100%;
    height: 100%;
    font-size: 11px;
    border: 1px solid #3b82f6;
    border-radius: 2px;
    padding: 0 4px;
    outline: none;
  }
</style>
