<script lang="ts">
  import { onMount } from 'svelte';
  import {
    containers,
    nodes,
    addContainer,
    addContainerAtInsertPositions,
    insertOpenNodeAtBoundary,
    insertCloseNodeAtBoundary,
    updateNode,
    updateContainer,
    deleteThread,
    deleteContainer,
    deleteNode,
  } from '../../stores/story';
  import {
    calculateLayout,
    calculateContainerSegments,
    calculateArcPath,
    calculateBoundaryPositions,
    getNearestBoundary,
    getRowAtY,
    getZoneAtY,
    type LayoutConfig,
    type LayoutResult,
    type ContainerSegment as ContainerSegmentType,
    type ArcPath,
  } from '../../lib/layout';
  import { getTotalSlots } from '../../lib/slots';
  import { findContainerAtSlot } from '../../lib/validation';
  import type { Container, StoryNode, MiceType } from '../../lib/types';
  import { MICE_COLORS } from '../../lib/types';

  import Node from './Node.svelte';
  import Arc from './Arc.svelte';
  import ContainerSegment from './ContainerSegment.svelte';
  import InsertHandle from './InsertHandle.svelte';
  import NodePopover from './NodePopover.svelte';
  import DeleteConfirm from './DeleteConfirm.svelte';

  // Layout config
  const config: LayoutConfig = {
    viewportWidth: 800,
    minItemWidth: 80,
    rowHeight: 120,
    containerZoneHeight: 30,
    padding: 8,
  };

  let svgElement: SVGSVGElement;
  let containerElement: HTMLDivElement;
  let viewportWidth = config.viewportWidth;

  // Interaction state
  type InteractionMode =
    | { mode: 'idle' }
    | { mode: 'placing-container-end'; startInsertPositionIndex: number; parentId: string | null }
    | { mode: 'placing-node-close'; openNodeId: string; openSlot: number }
    | { mode: 'editing-node'; nodeId: string };

  let interaction: InteractionMode = { mode: 'idle' };
  let selectedElement: { type: 'container' | 'node'; id: string } | null = null;

  // Mouse position for hover effects
  let mouseX = 0;
  let mouseY = 0;
  let hoveredInsertPositionIndex: number | null = null;
  let hoveredZone: 'container' | 'node' | null = null;

  // Calculate insert position positions for the current layout
  $: insertPositionPositions = calculateBoundaryPositions(layout, viewportWidth);
  
  // When placing container end on empty canvas, add insert position index 1 if needed
  $: enhancedInsertPositionPositions = (() => {
    const positions = [...insertPositionPositions];
    
    // If placing container end on empty canvas and index 1 doesn't exist, add it
    if (
      interaction.mode === 'placing-container-end' &&
      layout.totalSlots === 0 &&
      interaction.startInsertPositionIndex === 0
    ) {
      const hasIndex1 = positions.some((p) => p.insertPositionIndex === 1);
      if (!hasIndex1) {
        const index0Pos = positions.find((p) => p.insertPositionIndex === 0);
        if (index0Pos) {
          // Place index 1 to the right of index 0 (at 3/4 of viewport width)
          positions.push({
            insertPositionIndex: 1,
            x: viewportWidth * 0.75,
            y: index0Pos.y,
            row: index0Pos.row,
          });
        }
      }
    }
    
    return positions;
  })();

  // Popover states
  let deleteConfirmContainer: Container | null = null;
  let deleteConfirmAnchor = { x: 0, y: 0 };

  // Derived state
  $: totalSlots = getTotalSlots($containers, $nodes);
  $: layoutConfig = { ...config, viewportWidth };
  $: layout = calculateLayout(totalSlots, layoutConfig);
  $: svgHeight = Math.max(config.rowHeight, layout.totalRows * config.rowHeight);

  // Calculate container segments
  $: containerSegments = $containers.flatMap((container) =>
    calculateContainerSegments(container, layout, $containers).map((segment) => ({
      segment,
      container,
    }))
  );

  // Calculate arc paths
  $: arcPaths = calculateArcs($nodes, layout);

  function calculateArcs(nodeList: StoryNode[], layoutResult: LayoutResult): ArcPath[] {
    const arcs: ArcPath[] = [];
    const openNodes = nodeList.filter((n) => n.role === 'open');

    for (const open of openNodes) {
      const close = nodeList.find((n) => n.threadId === open.threadId && n.role === 'close');
      if (close) {
        arcs.push(calculateArcPath(open, close, layoutResult));
      }
    }

    return arcs;
  }

  // Get container index for title display
  function getContainerIndex(container: Container): number {
    return $containers.indexOf(container);
  }

  // Event handlers
  function handleResize() {
    if (containerElement) {
      viewportWidth = containerElement.clientWidth;
    }
  }

  function handleMouseMove(e: MouseEvent) {
    const rect = svgElement.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;

    hoveredZone = getZoneAtY(mouseY, layoutConfig);

    // Calculate the row based on mouse position (treat row 0 as valid for empty canvas)
    const row = getRowAtY(mouseY, layoutConfig);
    const maxRow = layout.totalRows > 0 ? layout.totalRows - 1 : 0;

    if (row >= 0 && row <= maxRow) {
      let nearestIndex = getNearestBoundary(mouseX, row, layout, viewportWidth);
      
      // Special handling for container creation on empty canvas:
      // When placing container end, if we're on empty canvas and mouse is to the right
      // of the start position, allow placing at insert position index 1
      if (
        interaction.mode === 'placing-container-end' &&
        layout.totalSlots === 0 &&
        interaction.startInsertPositionIndex === 0
      ) {
        const startInsertPos = insertPositionPositions.find((p) => p.insertPositionIndex === 0);
        if (startInsertPos && mouseX > startInsertPos.x) {
          // Mouse is to the right of start position, use insert position index 1
          nearestIndex = 1;
        }
      }
      
      hoveredInsertPositionIndex = nearestIndex;
    } else {
      hoveredInsertPositionIndex = null;
    }
  }

  function handleMouseLeave() {
    hoveredInsertPositionIndex = null;
    hoveredZone = null;
  }

  async function handleContainerHandleClick(e: CustomEvent<{ insertPositionIndex: number }>) {
    const { insertPositionIndex } = e.detail;

    if (interaction.mode === 'idle') {
      // Start container creation
      // Find parent container at the insert position (which will become slot N after insertion)
      const parentId = findContainerAtSlot(insertPositionIndex, $containers)?.id ?? null;
      interaction = { mode: 'placing-container-end', startInsertPositionIndex: insertPositionIndex, parentId };
    } else if (interaction.mode === 'placing-container-end') {
      // Complete container creation using insert position indices
      const endInsertPositionIndex = insertPositionIndex;
      await addContainerAtInsertPositions(
        interaction.startInsertPositionIndex,
        endInsertPositionIndex,
        interaction.parentId
      );

      interaction = { mode: 'idle' };
    }
  }

  function handleNodeHandleClick(e: CustomEvent<{ insertPositionIndex: number; type: MiceType }>) {
    const { insertPositionIndex, type } = e.detail;

    if (interaction.mode === 'idle') {
      // Start canonical two-step thread creation:
      // 1) Insert the opening node at insert position N.5
      // 2) Enter close-placement mode until the user chooses a close insert position
      const containerId = findContainerAtSlot(insertPositionIndex, $containers)?.id ?? null;
      insertOpenNodeAtBoundary(insertPositionIndex, type, containerId).then((openNode) => {
        interaction = { mode: 'placing-node-close', openNodeId: openNode.id, openSlot: openNode.slot };
      });
    }
  }

  function handleCloseNodeHandleClick(e: CustomEvent<{ insertPositionIndex: number }>) {
    const { insertPositionIndex } = e.detail;
    if (interaction.mode !== 'placing-node-close') return;
    if (insertPositionIndex <= interaction.openSlot) return;

    insertCloseNodeAtBoundary(interaction.openNodeId, insertPositionIndex).then(() => {
      interaction = { mode: 'idle' };
    }).catch(() => {
      interaction = { mode: 'idle' };
    });
  }

  function handleNodeClick(e: CustomEvent<{ node: StoryNode }>) {
    const { node } = e.detail;

    if (interaction.mode === 'idle') {
      selectedElement = { type: 'node', id: node.id };
      interaction = { mode: 'editing-node', nodeId: node.id };
    }
  }

  function handleNodeDelete(e: CustomEvent<{ node: StoryNode }>) {
    deleteThread(e.detail.node.threadId);
    if (selectedElement?.id === e.detail.node.id) {
      selectedElement = null;
    }
    interaction = { mode: 'idle' };
  }

  function handleContainerClick(e: CustomEvent<{ container: Container }>) {
    if (interaction.mode === 'idle') {
      selectedElement = { type: 'container', id: e.detail.container.id };
    }
  }

  function handleContainerDelete(e: CustomEvent<{ container: Container }>) {
    const container = e.detail.container;

    // Check if container has contents
    const hasContents =
      $nodes.some((n) => n.containerId === container.id) ||
      $containers.some((c) => c.parentId === container.id);

    if (hasContents) {
      // Show confirmation dialog
      deleteConfirmContainer = container;
      const segment = containerSegments.find((s) => s.container.id === container.id);
      if (segment) {
        deleteConfirmAnchor = {
          x: segment.segment.endX - 100,
          y: segment.segment.row * config.rowHeight + config.containerZoneHeight + 10,
        };
      }
    } else {
      // Delete immediately
      deleteContainer(container.id);
    }
  }

  function handleContainerTitleChange(e: CustomEvent<{ container: Container; title: string }>) {
    updateContainer(e.detail.container.id, { title: e.detail.title });
  }

  function handleDeleteConfirm(e: CustomEvent<{ action: 'delete-all' | 'keep-contents' }>) {
    if (deleteConfirmContainer) {
      if (e.detail.action === 'delete-all') {
        // Delete container and all contents (cascade handled by store)
        deleteContainer(deleteConfirmContainer.id);
      } else {
        // Move contents to parent and delete container
        // For now, just delete the container boundaries
        deleteContainer(deleteConfirmContainer.id);
      }
    }
    deleteConfirmContainer = null;
  }

  function handleDeleteCancel() {
    deleteConfirmContainer = null;
  }

  function handlePopoverUpdate(e: CustomEvent<{ title: string; description: string }>) {
    if (interaction.mode === 'editing-node') {
      updateNode(interaction.nodeId, e.detail);
    }
  }

  function handlePopoverClose() {
    interaction = { mode: 'idle' };
    selectedElement = null;
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (interaction.mode === 'placing-node-close') {
        deleteNode(interaction.openNodeId);
      }
      interaction = { mode: 'idle' };
      selectedElement = null;
      deleteConfirmContainer = null;
    }
  }

  // Check if mouse is directly over a node (within the node's visual bounds)
  // We don't show the insert handle when hovering directly on a node
  function isMouseOverNode(): boolean {
    const nodeRadius = 18; // Same as Node.svelte radius
    return $nodes.some((n) => {
      const pos = layout.positions.get(n.slot);
      if (!pos) return false;
      const dx = mouseX - pos.x;
      const dy = mouseY - pos.y;
      return Math.sqrt(dx * dx + dy * dy) < nodeRadius + 10; // Add some padding
    });
  }

  // Check if mouse is over a container's interactive elements (borders, title, or trash button area)
  // We hide the insert handle when over these areas, but allow it in the container's interior
  // to enable inserting threads inside containers
  function isMouseOverContainerInteractiveArea(): boolean {
    const row = getRowAtY(mouseY, layoutConfig);
    const rowY = row * config.rowHeight;
    const relativeY = mouseY - rowY;

    // Border detection threshold (must be larger than TrashButton offset from edge)
    // TrashButton is at segment.endX - 20, with size 16, so threshold needs to be 20 + 16 = 36
    const borderThreshold = 40;
    // Title area height from top of container
    const titleAreaHeight = 24;

    // When in container zone, we want to show container handles for creating nested containers
    // So we only block on borders, not title area
    const inContainerZone = hoveredZone === 'container';

    return containerSegments.some(({ segment }) => {
      if (segment.row !== row) return false;

      // Calculate the segment's vertical bounds (same as ContainerSegment.svelte)
      const nestingOffset = segment.nestingDepth * config.padding;
      const topPadding = 4;
      const bottomPadding = 8;
      const topY = nestingOffset + topPadding;
      const bottomY = config.rowHeight - nestingOffset - bottomPadding;

      // First check if within the container's overall bounds
      const withinBounds =
        mouseX >= segment.startX &&
        mouseX <= segment.endX &&
        relativeY >= topY &&
        relativeY <= bottomY;

      if (!withinBounds) return false;

      // Now check if near interactive areas:
      // 1. Left/right borders (where container frame is visible)
      const nearLeftBorder = mouseX < segment.startX + borderThreshold;
      const nearRightBorder = mouseX > segment.endX - borderThreshold;

      // 2. Title area (top of container on first/single segments)
      // Only check in node zone - in container zone we allow creating nested containers
      const nearTitleArea = !inContainerZone && relativeY < topY + titleAreaHeight &&
        (segment.segmentType === 'single' || segment.segmentType === 'first');

      // 3. Trash button area (bottom-right corner)
      const nearTrashButton = nearRightBorder && relativeY > bottomY - borderThreshold;

      return nearLeftBorder || nearRightBorder || nearTitleArea || nearTrashButton;
    });
  }

  // Get the insert position for the current hoveredInsertPositionIndex
  $: currentInsertPosition = hoveredInsertPositionIndex !== null
    ? enhancedInsertPositionPositions.find((p) => p.insertPositionIndex === hoveredInsertPositionIndex)
    : null;

  // Two-step close placement preview:
  // - Hovering shows a semi-transparent close node + preview arc
  // - Clicking commits the close node at the hovered insert position
  function handleClosePreviewClick() {
    if (interaction.mode !== 'placing-node-close') return;
    if (hoveredInsertPositionIndex === null) return;
    if (hoveredInsertPositionIndex <= interaction.openSlot) return;

    insertCloseNodeAtBoundary(interaction.openNodeId, hoveredInsertPositionIndex)
      .then(() => {
        interaction = { mode: 'idle' };
      })
      .catch(() => {
        interaction = { mode: 'idle' };
      });
  }

  $: placingNodeClose = interaction.mode === 'placing-node-close' ? interaction : null;

  $: openNodeForClosePreview =
    placingNodeClose ? $nodes.find((n) => n.id === placingNodeClose.openNodeId) ?? null : null;

  $: closePreviewVisible =
    placingNodeClose !== null &&
    hoveredZone === 'node' &&
    hoveredInsertPositionIndex !== null &&
    currentInsertPosition !== null &&
    hoveredInsertPositionIndex > placingNodeClose.openSlot;

  $: closePreview =
    closePreviewVisible && openNodeForClosePreview && currentInsertPosition
      ? {
          x: currentInsertPosition.x,
          y: currentInsertPosition.row * config.rowHeight + config.rowHeight / 2,
          row: currentInsertPosition.row,
          insertPositionIndex: hoveredInsertPositionIndex!,
          color: MICE_COLORS[openNodeForClosePreview.type],
          arcPath: (() => {
            const openPos = placingNodeClose ? layout.positions.get(placingNodeClose.openSlot) : null;
            if (!openPos) return null;
            const baseY = currentInsertPosition.row * config.rowHeight + config.rowHeight / 2;
            const startX = openPos.x;
            const endX = currentInsertPosition.x;
            const midX = (startX + endX) / 2;
            const controlY = baseY - config.rowHeight * 0.3;
            return `M ${startX} ${baseY} Q ${midX} ${controlY} ${endX} ${baseY}`;
          })(),
        }
      : null;

  // Get editing node for popover
  $: editingNodeId = interaction.mode === 'editing-node' ? interaction.nodeId : null;
  $: editingNode = editingNodeId ? $nodes.find((n) => n.id === editingNodeId) ?? null : null;

  $: editingNodePosition =
    editingNode && layout.positions.get(editingNode.slot)
      ? { x: layout.positions.get(editingNode.slot)!.x, y: layout.positions.get(editingNode.slot)!.y }
      : { x: 0, y: 0 };

  onMount(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeyDown);

    // Expose for testing
    if (typeof window !== 'undefined') {
      (window as any).__timelineInteraction = () => interaction;
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
    };
  });
</script>

<div class="timeline-container" bind:this={containerElement}>
  <svg
    bind:this={svgElement}
    width="100%"
    height={svgHeight}
    role="application"
    aria-label="Timeline editor"
    on:mousemove={handleMouseMove}
    on:mouseleave={handleMouseLeave}
    data-testid="timeline-svg"
  >
    <!-- Row backgrounds and track lines -->
    {#each Array(layout.totalRows || 1) as _, row}
      <g class="row" transform="translate(0, {row * config.rowHeight})">
        <rect
          class="row-bg"
          width={viewportWidth}
          height={config.rowHeight}
          fill="transparent"
        />
        <!-- Track line (horizontal line where nodes sit) -->
        <line
          class="track-line"
          x1="0"
          y1={config.rowHeight / 2}
          x2={viewportWidth}
          y2={config.rowHeight / 2}
          stroke="#e5e7eb"
          stroke-width="2"
        />
      </g>
    {/each}

    <!-- Container segments -->
    <g class="containers">
      {#each containerSegments as { segment, container }}
        <ContainerSegment
          {segment}
          {container}
          {config}
          containerIndex={getContainerIndex(container)}
          selected={selectedElement?.type === 'container' && selectedElement.id === container.id}
          on:click={handleContainerClick}
          on:delete={handleContainerDelete}
          on:titleChange={handleContainerTitleChange}
        />
      {/each}
    </g>

    <!-- Arcs (thread connections) -->
    <g class="arcs">
      {#each arcPaths as arc}
        <Arc {arc} rowHeight={config.rowHeight} highlighted={selectedElement?.type === 'node'} />
      {/each}
    </g>

    <!-- Nodes -->
    <g class="nodes">
      {#each $nodes as node}
        {@const pos = layout.positions.get(node.slot)}
        {#if pos}
          <Node
            {node}
            x={pos.x}
            y={pos.y}
            rowHeight={config.rowHeight}
            selected={selectedElement?.type === 'node' && selectedElement.id === node.id}
            on:click={handleNodeClick}
            on:delete={handleNodeDelete}
          />
        {/if}
      {/each}
    </g>

    <!-- Insert handle (shown on hover in idle mode, not over existing nodes or interactive container areas) -->
    <!-- The handle appears at insert positions (half-steps between occupied slots), not at slots -->
    <!-- Hide when over nodes or container interactive areas (borders, title, trash button) -->
    {#if hoveredInsertPositionIndex !== null && hoveredZone !== null && currentInsertPosition && interaction.mode !== 'editing-node' && !isMouseOverNode() && !isMouseOverContainerInteractiveArea()}
      {@const handleY = currentInsertPosition.row * config.rowHeight + (hoveredZone === 'container' ? config.containerZoneHeight / 2 : config.rowHeight / 2)}
      {@const nodeMode = interaction.mode === 'placing-node-close' ? 'close' : 'start'}
      {@const nodeHandleValid = interaction.mode === 'placing-node-close' ? (hoveredZone === 'node' && hoveredInsertPositionIndex > interaction.openSlot) : true}
      {@const containerHandleValid = interaction.mode === 'placing-container-end' ? (hoveredZone === 'container') : true}
      {@const shouldShowHandle =
        interaction.mode === 'placing-node-close'
          ? (hoveredZone === 'node' && hoveredInsertPositionIndex > interaction.openSlot)
          : interaction.mode === 'placing-container-end'
            ? (hoveredZone === 'container' && hoveredInsertPositionIndex !== interaction.startInsertPositionIndex)
            : true}

      {#if shouldShowHandle}
        <InsertHandle
          x={currentInsertPosition.x}
          y={handleY}
          zone={hoveredZone}
          insertPositionIndex={hoveredInsertPositionIndex}
          valid={hoveredZone === 'container' ? containerHandleValid : nodeHandleValid}
          nodeMode={nodeMode}
          on:containerClick={handleContainerHandleClick}
          on:nodeClick={handleNodeHandleClick}
          on:nodeCloseClick={handleCloseNodeHandleClick}
        />
      {/if}
    {/if}

    {#if closePreview}
      {#if closePreview.arcPath}
        <path
          d={closePreview.arcPath}
          fill="none"
          stroke={closePreview.color}
          stroke-width="2"
          opacity="0.35"
          data-testid="thread-preview-arc"
          style="pointer-events: none"
        />
      {/if}

      <g
        transform="translate({closePreview.x}, {closePreview.y})"
        opacity="0.45"
        data-testid="close-node-preview"
        on:click|stopPropagation={handleClosePreviewClick}
        on:keydown={(e) => e.key === 'Enter' && handleClosePreviewClick()}
        role="button"
        tabindex="0"
      >
        <circle r="12" fill={closePreview.color} />
      </g>
    {/if}

    <!-- Start boundary indicator during container creation -->
    <!-- Shows a vertical line at the start insert position after first click -->
    {#if interaction.mode === 'placing-container-end'}
      {@const placingContainer = interaction as Extract<InteractionMode, { mode: 'placing-container-end' }>}
      {@const startInsertPos = enhancedInsertPositionPositions.find((p) => p.insertPositionIndex === placingContainer.startInsertPositionIndex)}
      {#if startInsertPos}
        <line
          x1={startInsertPos.x}
          y1={startInsertPos.row * config.rowHeight}
          x2={startInsertPos.x}
          y2={(startInsertPos.row + 1) * config.rowHeight}
          stroke="#6b7280"
          stroke-width="2"
          stroke-dasharray="4 4"
          opacity="0.6"
          data-testid="container-start-boundary"
        />
      {/if}
    {/if}

    <!-- Preview during container creation -->
    <!-- Shows a preview rectangle spanning from start insert position to current hovered insert position -->
    <!-- Only shows when hovering in the container zone -->
    {#if interaction.mode === 'placing-container-end' && hoveredZone === 'container' && hoveredInsertPositionIndex !== null && currentInsertPosition}
      {@const placingContainer = interaction as Extract<InteractionMode, { mode: 'placing-container-end' }>}
      {@const startInsertPos = enhancedInsertPositionPositions.find((p) => p.insertPositionIndex === placingContainer.startInsertPositionIndex)}
      {@const previewX = startInsertPos ? Math.min(startInsertPos.x, currentInsertPosition.x) : currentInsertPosition.x}
      {@const previewWidth = startInsertPos ? Math.abs(currentInsertPosition.x - startInsertPos.x) : 0}
      {#if startInsertPos && previewWidth > 0}
        <rect
          x={previewX}
          y={startInsertPos.row * config.rowHeight + 4}
          width={previewWidth}
          height={config.containerZoneHeight - 8}
          fill="#9ca3af"
          opacity="0.3"
          rx="4"
          data-testid="container-preview"
        />
      {/if}
    {/if}
  </svg>

  <!-- Node editing popover -->
  {#if editingNode}
    <NodePopover
      node={editingNode}
      anchorX={editingNodePosition.x}
      anchorY={editingNodePosition.y}
      containerElement={containerElement}
      on:close={handlePopoverClose}
      on:update={handlePopoverUpdate}
    />
  {/if}

  <!-- Delete confirmation dialog -->
  {#if deleteConfirmContainer}
    <DeleteConfirm
      container={deleteConfirmContainer}
      anchorX={deleteConfirmAnchor.x}
      anchorY={deleteConfirmAnchor.y}
      on:confirm={handleDeleteConfirm}
      on:cancel={handleDeleteCancel}
    />
  {/if}
</div>

<style>
  .timeline-container {
    width: 100%;
    min-height: 120px;
    position: relative;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    overflow: hidden;
  }

  svg {
    display: block;
  }

  .track-line {
    pointer-events: none;
  }
</style>
