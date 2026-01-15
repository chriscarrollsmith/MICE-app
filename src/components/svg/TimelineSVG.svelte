<script lang="ts">
  import { onMount } from 'svelte';
  import {
    containers,
    nodes,
    addContainer,
    addContainerAvoidingNodeOverlap,
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
    | { mode: 'placing-container-end'; startSlot: number; parentId: string | null }
    | { mode: 'placing-node-close'; openNodeId: string; openSlot: number }
    | { mode: 'editing-node'; nodeId: string };

  let interaction: InteractionMode = { mode: 'idle' };
  let selectedElement: { type: 'container' | 'node'; id: string } | null = null;

  // Mouse position for hover effects
  let mouseX = 0;
  let mouseY = 0;
  let hoveredBoundary: number | null = null;
  let hoveredZone: 'container' | 'node' | null = null;

  // Calculate boundary positions for the current layout
  $: boundaryPositions = calculateBoundaryPositions(layout, viewportWidth);

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
      hoveredBoundary = getNearestBoundary(mouseX, row, layout, viewportWidth);
    } else {
      hoveredBoundary = null;
    }
  }

  function handleMouseLeave() {
    hoveredBoundary = null;
    hoveredZone = null;
  }

  function handleContainerHandleClick(e: CustomEvent<{ slot: number }>) {
    const { slot } = e.detail;

    if (interaction.mode === 'idle') {
      // Start container creation
      const parentId = findContainerAtSlot(slot, $containers)?.id ?? null;
      interaction = { mode: 'placing-container-end', startSlot: slot, parentId };
    } else if (interaction.mode === 'placing-container-end') {
      // Complete container creation
      let endSlot = slot;

      // On empty canvas (no slots exist), clicking creates a container spanning 0-1
      // regardless of which boundary was clicked
      if (totalSlots === 0) {
        const startSlot = 0;
        const defaultEndSlot = 1;
        addContainer(startSlot, defaultEndSlot, interaction.parentId);
      } else if (endSlot > interaction.startSlot) {
        addContainerAvoidingNodeOverlap(interaction.startSlot, endSlot, interaction.parentId);
      } else if (endSlot < interaction.startSlot) {
        // Allow right-to-left container creation by swapping
        addContainerAvoidingNodeOverlap(endSlot, interaction.startSlot, interaction.parentId);
      }

      interaction = { mode: 'idle' };
    }
  }

  function handleNodeHandleClick(e: CustomEvent<{ boundary: number; type: MiceType }>) {
    const { boundary, type } = e.detail;

    if (interaction.mode === 'idle') {
      // Start canonical two-step thread creation:
      // 1) Insert the opening node at this boundary
      // 2) Enter close-placement mode until the user chooses a close boundary
      const containerId = findContainerAtSlot(boundary, $containers)?.id ?? null;
      insertOpenNodeAtBoundary(boundary, type, containerId).then((openNode) => {
        interaction = { mode: 'placing-node-close', openNodeId: openNode.id, openSlot: openNode.slot };
      });
    }
  }

  function handleCloseNodeHandleClick(e: CustomEvent<{ boundary: number }>) {
    const { boundary } = e.detail;
    if (interaction.mode !== 'placing-node-close') return;
    if (boundary <= interaction.openSlot) return;

    insertCloseNodeAtBoundary(interaction.openNodeId, boundary).then(() => {
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

  function handleClosePreviewClick() {
    if (interaction.mode !== 'placing-node-close') return;
    if (hoveredBoundary === null) return;
    if (hoveredBoundary <= interaction.openSlot) return;

    insertCloseNodeAtBoundary(interaction.openNodeId, hoveredBoundary)
      .then(() => {
        interaction = { mode: 'idle' };
      })
      .catch(() => {
        interaction = { mode: 'idle' };
      });
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

  // Get the boundary position for the current hoveredBoundary
  $: currentBoundaryPosition = hoveredBoundary !== null
    ? boundaryPositions.find(b => b.boundary === hoveredBoundary)
    : null;

  // Two-step close placement preview (hover shows a semi-transparent close node + arc; click commits)
  $: openNodeForClosePreview =
    interaction.mode === 'placing-node-close'
      ? $nodes.find((n) => n.id === interaction.openNodeId) ?? null
      : null;

  $: closePreviewVisible =
    interaction.mode === 'placing-node-close' &&
    hoveredZone === 'node' &&
    hoveredBoundary !== null &&
    currentBoundaryPosition !== null &&
    hoveredBoundary > interaction.openSlot;

  $: closePreview = closePreviewVisible && openNodeForClosePreview && currentBoundaryPosition
    ? {
        x: currentBoundaryPosition.x,
        y: currentBoundaryPosition.row * config.rowHeight + config.rowHeight / 2,
        row: currentBoundaryPosition.row,
        boundary: hoveredBoundary!,
        color: MICE_COLORS[openNodeForClosePreview.type],
        arcPath: (() => {
          const openPos = layout.positions.get(interaction.openSlot);
          if (!openPos) return null;
          const baseY = currentBoundaryPosition.row * config.rowHeight + config.rowHeight / 2;
          const startX = openPos.x;
          const endX = currentBoundaryPosition.x;
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
            selected={selectedElement?.type === 'node' && selectedElement.id === node.id}
            on:click={handleNodeClick}
            on:delete={handleNodeDelete}
          />
        {/if}
      {/each}
    </g>

    <!-- Insert handle (shown on hover in idle mode, not over existing nodes or interactive container areas) -->
    <!-- The handle appears at BOUNDARIES between nodes, not at slots -->
    <!-- Hide when over nodes or container interactive areas (borders, title, trash button) -->
    {#if hoveredBoundary !== null && hoveredZone !== null && currentBoundaryPosition && interaction.mode !== 'editing-node' && !isMouseOverNode() && !isMouseOverContainerInteractiveArea()}
      {@const handleY = currentBoundaryPosition.row * config.rowHeight + (hoveredZone === 'container' ? config.containerZoneHeight / 2 : config.rowHeight / 2)}
      {@const nodeMode = 'start'}
      {@const nodeHandleValid = true}
      {@const containerHandleValid = interaction.mode === 'placing-container-end' ? (hoveredZone === 'container') : true}
      {@const shouldShowHandle =
        interaction.mode === 'placing-node-close'
          ? false
          : interaction.mode === 'placing-container-end'
            ? (hoveredZone === 'container')
            : true}

      {#if shouldShowHandle}
        <InsertHandle
          x={currentBoundaryPosition.x}
          y={handleY}
          zone={hoveredZone}
          boundary={hoveredBoundary}
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

    <!-- Preview during container creation -->
    <!-- Shows a preview rectangle spanning from start boundary to current hover position -->
    {#if interaction.mode === 'placing-container-end' && hoveredBoundary !== null && currentBoundaryPosition}
      {@const startPos = layout.positions.get(interaction.startSlot)}
      {@const previewWidth = hoveredBoundary > interaction.startSlot
        ? currentBoundaryPosition.x - (startPos?.x ?? 0)
        : 0}
      {#if startPos && previewWidth > 0}
        <rect
          x={startPos.x}
          y={startPos.row * config.rowHeight + 4}
          width={previewWidth}
          height={config.containerZoneHeight - 8}
          fill="#9ca3af"
          opacity="0.3"
          rx="4"
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
