<script lang="ts">
  import { onMount } from 'svelte';
  import { createRenderer, render, resizeCanvas, type RenderContext, type RenderState } from '../canvas/renderer';
  import { containers, nodes, addContainer, addThread, updateNode, updateContainer, deleteThread, deleteContainer } from '../stores/story';
  import { get } from 'svelte/store';
  import { InteractionManager, type InteractionState, type InteractionCallbacks } from '../canvas/interactions';
  import { isInNodeZone, getTimelinePosition, findContainerAtPosition, findNodeAtPosition } from '../canvas/hitDetection';
  import type { MiceType, Container, StoryNode } from '../lib/types';
  import HoverGrid from './HoverGrid.svelte';
  import DetailPanel from './DetailPanel.svelte';
  import ContextMenu from './ContextMenu.svelte';

  let canvasElement: HTMLCanvasElement;
  let renderContext: RenderContext | null = null;
  let interactionManager: InteractionManager | null = null;
  let interactionState: InteractionState = { mode: 'idle' };
  let selectedElement: { type: 'container' | 'node'; id: string } | null = null;

  // Hover grid state
  let hoverGridVisible = false;
  let hoverGridX = 0;
  let hoverGridY = 0;
  let hoverGridContainer: Container | null = null;
  let hoverGridPosition = 0;

  // Context menu state
  let contextMenuVisible = false;
  let contextMenuX = 0;
  let contextMenuY = 0;
  let contextMenuNode: StoryNode | null = null;
  let contextMenuContainer: Container | null = null;

  // Get selected node or container for detail panel
  $: selectedNode = selectedElement?.type === 'node'
    ? $nodes.find((n) => n.id === selectedElement?.id) || null
    : null;

  $: selectedContainer = selectedElement?.type === 'container'
    ? $containers.find((c) => c.id === selectedElement?.id) || null
    : null;

  function handleDetailUpdate(updates: { title?: string; description?: string }) {
    if (selectedElement?.type === 'node' && selectedElement.id) {
      updateNode(selectedElement.id, updates);
    } else if (selectedElement?.type === 'container' && selectedElement.id) {
      updateContainer(selectedElement.id, updates);
    }
  }

  function handleDetailClose() {
    selectedElement = null;
    interactionManager?.handleKeyDown('Escape');
  }

  function draw() {
    if (!renderContext) return;
    const containerData = get(containers);
    const nodeData = get(nodes);
    const state: RenderState = {
      containers: containerData,
      nodes: nodeData,
      interaction: interactionManager ? {
        state: interactionState,
        mousePosition: interactionManager.getMousePosition(),
      } : undefined,
    };
    render(renderContext, state);
  }

  function handleResize() {
    if (!canvasElement) return;
    resizeCanvas(canvasElement);
    const rect = canvasElement.getBoundingClientRect();
    interactionManager?.updateCanvasSize(rect.width, rect.height);
    draw();
  }

  function handleMouseMove(event: MouseEvent) {
    if (!interactionManager) return;
    const rect = canvasElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    interactionManager.handleMouseMove(x, y);

    // Update hover grid visibility
    updateHoverGrid(x, y, rect.width, rect.height);

    draw();
  }

  function updateHoverGrid(x: number, y: number, canvasWidth: number, canvasHeight: number) {
    // Only show grid in idle mode and when in node zone
    if (interactionState.mode !== 'idle') {
      hoverGridVisible = false;
      return;
    }

    if (!isInNodeZone(y, canvasHeight)) {
      hoverGridVisible = false;
      return;
    }

    // Don't show grid if hovering over an existing node
    const nodeData = get(nodes);
    const existingNode = findNodeAtPosition(x, y, nodeData, canvasWidth, canvasHeight);
    if (existingNode) {
      hoverGridVisible = false;
      return;
    }

    const position = getTimelinePosition(x, canvasWidth);
    const containerData = get(containers);
    const container = findContainerAtPosition(position, containerData);

    // Show the grid even if no container exists (allows creating first node)
    // Center the grid on the timeline track (at 60% of canvas height), not on cursor
    const trackLineY = canvasHeight * 0.6;
    hoverGridVisible = true;
    hoverGridX = x;
    hoverGridY = trackLineY;
    hoverGridContainer = container; // May be null for empty timeline
    hoverGridPosition = position;
  }

  async function handleHoverGridSelect(type: MiceType) {
    if (!interactionManager) return;

    let containerId: string;

    if (hoverGridContainer) {
      // Use existing container
      containerId = hoverGridContainer.id;
    } else {
      // No container exists - create a root container spanning the full timeline
      const newContainer = await addContainer(0.05, 0.95, null);
      containerId = newContainer.id;
    }

    // Start node creation
    interactionManager.startNodeCreation(type, hoverGridPosition, containerId);
    hoverGridVisible = false;
  }

  function handleClick(event: MouseEvent) {
    if (!interactionManager) return;
    const rect = canvasElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    interactionManager.handleClick(x, y);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (!interactionManager) return;
    interactionManager.handleKeyDown(event.key);

    // Hide grid on Escape
    if (event.key === 'Escape') {
      hoverGridVisible = false;
      contextMenuVisible = false;
    }
  }

  function handleContextMenu(event: MouseEvent) {
    event.preventDefault();
    const rect = canvasElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Check if right-clicking on a node
    const nodeData = get(nodes);
    const clickedNode = findNodeAtPosition(x, y, nodeData, rect.width, rect.height);

    if (clickedNode) {
      contextMenuVisible = true;
      contextMenuX = event.clientX - rect.left;
      contextMenuY = event.clientY - rect.top;
      contextMenuNode = clickedNode;
      contextMenuContainer = null;
      return;
    }

    // Could add container context menu here in the future
    contextMenuVisible = false;
  }

  function handleDeleteThread(threadId: string) {
    deleteThread(threadId);
    contextMenuVisible = false;
    selectedElement = null;
  }

  function handleDeleteContainer(containerId: string) {
    deleteContainer(containerId);
    contextMenuVisible = false;
    selectedElement = null;
  }

  function handleContextMenuClose() {
    contextMenuVisible = false;
  }

  // Subscribe to store changes
  onMount(() => {
    renderContext = createRenderer(canvasElement);

    const callbacks: InteractionCallbacks = {
      onContainerCreate: async (startPos, endPos, parentId) => {
        await addContainer(startPos, endPos, parentId);
      },
      onNodeCreate: async (containerId, type, openPos, closePos) => {
        await addThread(containerId, type, openPos, closePos);
      },
      onSelect: (type, id) => {
        selectedElement = { type, id };
      },
      onDeselect: () => {
        selectedElement = null;
      },
      onStateChange: (state) => {
        interactionState = state;
        // Hide grid when state changes from idle
        if (state.mode !== 'idle') {
          hoverGridVisible = false;
        }
        draw();
      },
      getContainers: () => get(containers),
      getNodes: () => get(nodes),
    };

    interactionManager = new InteractionManager(callbacks);
    handleResize();

    // Subscribe to store changes for reactive updates
    const unsubContainers = containers.subscribe(() => {
      draw();
    });
    const unsubNodes = nodes.subscribe(() => {
      draw();
    });

    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeyDown);

    // Expose for testing
    if (typeof window !== 'undefined') {
      (window as any).__redrawCanvas = draw;
      (window as any).__interactionManager = interactionManager;
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      unsubContainers();
      unsubNodes();
    };
  });
</script>

<div class="timeline-container">
  <canvas
    bind:this={canvasElement}
    on:mousemove={handleMouseMove}
    on:click={handleClick}
    on:contextmenu={handleContextMenu}
    tabindex="0"
  ></canvas>

  <HoverGrid
    x={hoverGridX}
    y={hoverGridY}
    visible={hoverGridVisible}
    onSelect={handleHoverGridSelect}
  />

  <DetailPanel
    node={selectedNode}
    container={selectedContainer}
    onUpdate={handleDetailUpdate}
    onClose={handleDetailClose}
  />

  <ContextMenu
    x={contextMenuX}
    y={contextMenuY}
    visible={contextMenuVisible}
    node={contextMenuNode}
    container={contextMenuContainer}
    onDeleteThread={handleDeleteThread}
    onDeleteContainer={handleDeleteContainer}
    onClose={handleContextMenuClose}
  />
</div>

<style>
  .timeline-container {
    width: 100%;
    height: 400px;
    position: relative;
  }

  canvas {
    width: 100%;
    height: 100%;
    display: block;
    cursor: crosshair;
  }

  canvas:focus {
    outline: none;
  }
</style>
