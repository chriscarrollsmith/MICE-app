import type { Container, StoryNode, MiceType } from '../lib/types';
import type { InteractionState } from './interactions';
import { getTotalSlots } from '../lib/slots';

export interface RenderContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

export interface RenderState {
  containers: Container[];
  nodes: StoryNode[];
  interaction?: {
    state: InteractionState;
    mousePosition: { x: number; y: number } | null;
  };
}

const COLORS = {
  background: '#ffffff',
  trackLine: '#333333',
  containerZone: '#f5f5f5',
  containerFill: '#e8e8e8',
  containerStroke: '#999999',
  mice: {
    milieu: '#3b82f6',    // Blue
    idea: '#22c55e',      // Green
    character: '#f97316', // Orange
    event: '#ef4444',     // Red
  },
};

const LAYOUT = {
  containerZoneHeight: 0.25, // Top 25% for containers
  trackLineY: 0.6, // Track line at 60% from top
  padding: 20,
  containerPadding: 8, // Padding for nested containers
  containerRadius: 6, // Border radius for containers
  nodeRadius: 8, // Radius of node circles
  nodeOffset: 12, // Distance from track line to node center
};

export function createRenderer(canvas: HTMLCanvasElement): RenderContext | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  return { canvas, ctx };
}

export function render(context: RenderContext, state: RenderState): void {
  const { canvas, ctx } = context;
  // Use CSS dimensions since context is scaled by DPR
  const rect = canvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

  // Calculate total slots for positioning
  const totalSlots = getTotalSlots(state.containers, state.nodes);

  // Clear canvas
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, width, height);

  // Draw container zone background
  const containerZoneHeight = height * LAYOUT.containerZoneHeight;
  ctx.fillStyle = COLORS.containerZone;
  ctx.fillRect(0, 0, width, containerZoneHeight);

  // Draw separator line between container zone and node zone
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, containerZoneHeight);
  ctx.lineTo(width, containerZoneHeight);
  ctx.stroke();

  // Draw timeline track line
  const trackY = height * LAYOUT.trackLineY;
  ctx.strokeStyle = COLORS.trackLine;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(LAYOUT.padding, trackY);
  ctx.lineTo(width - LAYOUT.padding, trackY);
  ctx.stroke();

  // Draw containers
  drawContainers(ctx, state.containers, width, height, totalSlots);

  // Draw nodes and arcs
  drawNodes(ctx, state.nodes, width, height, totalSlots);

  // Draw interaction previews
  if (state.interaction) {
    drawInteractionPreview(ctx, state.interaction, width, height, totalSlots);
  }
}

function drawInteractionPreview(
  ctx: CanvasRenderingContext2D,
  interaction: NonNullable<RenderState['interaction']>,
  canvasWidth: number,
  canvasHeight: number,
  totalSlots: number
): void {
  const { state, mousePosition } = interaction;

  if (state.mode === 'creating-container' && mousePosition) {
    drawContainerCreationPreview(ctx, state.startSlot, mousePosition, canvasWidth, canvasHeight, totalSlots);
  } else if (state.mode === 'creating-node' && mousePosition) {
    drawNodeCreationPreview(ctx, state.type, state.openSlot, mousePosition, canvasWidth, canvasHeight, totalSlots);
  }
}

function slotToX(slot: number, canvasWidth: number, totalSlots: number): number {
  if (totalSlots <= 1) return canvasWidth / 2;
  const usableWidth = canvasWidth - LAYOUT.padding * 2;
  const position = slot / (totalSlots - 1);
  return LAYOUT.padding + usableWidth * position;
}

function drawNodeCreationPreview(
  ctx: CanvasRenderingContext2D,
  type: MiceType,
  openSlot: number,
  mousePosition: { x: number; y: number },
  canvasWidth: number,
  canvasHeight: number,
  totalSlots: number
): void {
  const trackY = canvasHeight * LAYOUT.trackLineY;
  const usableWidth = canvasWidth - LAYOUT.padding * 2;
  const color = COLORS.mice[type];

  // Calculate positions
  const openX = slotToX(openSlot, canvasWidth, totalSlots);
  const openY = trackY - LAYOUT.nodeOffset;

  // Calculate close position from mouse X (approximate slot)
  const closeX = mousePosition.x;
  const closeY = trackY + LAYOUT.nodeOffset;

  // Draw preview arc (dashed)
  ctx.save();
  ctx.setLineDash([5, 5]);
  const midX = (openX + closeX) / 2;
  const arcHeight = Math.min(Math.abs(closeX - openX) * 0.3, 50);
  const controlY = trackY - LAYOUT.nodeOffset - arcHeight;

  ctx.beginPath();
  ctx.moveTo(openX, openY);
  ctx.quadraticCurveTo(midX, controlY, closeX, closeY);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // Draw open node (solid)
  ctx.beginPath();
  ctx.arc(openX, openY, LAYOUT.nodeRadius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw close node preview (semi-transparent)
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.arc(closeX, closeY, LAYOUT.nodeRadius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawContainerCreationPreview(
  ctx: CanvasRenderingContext2D,
  startSlot: number,
  mousePosition: { x: number; y: number },
  canvasWidth: number,
  canvasHeight: number,
  totalSlots: number
): void {
  const containerZoneHeight = canvasHeight * LAYOUT.containerZoneHeight;

  // Calculate positions
  const startX = slotToX(startSlot, canvasWidth, totalSlots);
  const endX = mousePosition.x;

  // Draw dashed preview rectangle
  ctx.save();
  ctx.strokeStyle = '#666666';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);

  const x1 = Math.min(startX, endX);
  const x2 = Math.max(startX, endX);
  const y1 = 4;
  const y2 = containerZoneHeight - 4;

  drawRoundedRect(ctx, x1, y1, x2 - x1, y2 - y1, LAYOUT.containerRadius);
  ctx.stroke();

  // Draw vertical line at start position
  ctx.setLineDash([]);
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(startX, 0);
  ctx.lineTo(startX, containerZoneHeight);
  ctx.stroke();

  ctx.restore();
}

function drawContainers(
  ctx: CanvasRenderingContext2D,
  containers: Container[],
  canvasWidth: number,
  canvasHeight: number,
  totalSlots: number
): void {
  if (containers.length === 0) return;

  const containerZoneHeight = canvasHeight * LAYOUT.containerZoneHeight;

  // Calculate depth for each container
  const depths = calculateContainerDepths(containers);
  const maxDepth = Math.max(...Array.from(depths.values()), 0);

  // Sort containers by depth (draw parents first, then children)
  const sortedContainers = [...containers].sort((a, b) => {
    return (depths.get(a.id) || 0) - (depths.get(b.id) || 0);
  });

  for (const container of sortedContainers) {
    const depth = depths.get(container.id) || 0;
    const padding = depth * LAYOUT.containerPadding;

    // Calculate x positions
    const x1 = slotToX(container.startSlot, canvasWidth, totalSlots) + padding;
    const x2 = slotToX(container.endSlot, canvasWidth, totalSlots) - padding;

    // Calculate y positions (vertical space divided by depth levels)
    const y1 = 4 + depth * LAYOUT.containerPadding;
    const y2 = containerZoneHeight - 4 - depth * LAYOUT.containerPadding;

    const rectWidth = x2 - x1;
    const rectHeight = y2 - y1;

    if (rectWidth > 0 && rectHeight > 0) {
      // Draw container rectangle
      ctx.fillStyle = COLORS.containerFill;
      ctx.strokeStyle = COLORS.containerStroke;
      ctx.lineWidth = 1;

      drawRoundedRect(ctx, x1, y1, rectWidth, rectHeight, LAYOUT.containerRadius);
      ctx.fill();
      ctx.stroke();
    }
  }
}

function calculateContainerDepths(containers: Container[]): Map<string, number> {
  const depths = new Map<string, number>();

  function getDepth(container: Container): number {
    if (depths.has(container.id)) {
      return depths.get(container.id)!;
    }

    if (!container.parentId) {
      depths.set(container.id, 0);
      return 0;
    }

    const parent = containers.find((c) => c.id === container.parentId);
    if (!parent) {
      depths.set(container.id, 0);
      return 0;
    }

    const parentDepth = getDepth(parent);
    const depth = parentDepth + 1;
    depths.set(container.id, depth);
    return depth;
  }

  for (const container of containers) {
    getDepth(container);
  }

  return depths;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawNodes(
  ctx: CanvasRenderingContext2D,
  nodes: StoryNode[],
  canvasWidth: number,
  canvasHeight: number,
  totalSlots: number
): void {
  if (nodes.length === 0) return;

  const trackY = canvasHeight * LAYOUT.trackLineY;

  // Group nodes by thread to draw arcs
  const threadMap = new Map<string, StoryNode[]>();
  for (const node of nodes) {
    const existing = threadMap.get(node.threadId) || [];
    existing.push(node);
    threadMap.set(node.threadId, existing);
  }

  // Draw arcs first (behind nodes)
  for (const [, threadNodes] of threadMap) {
    if (threadNodes.length === 2) {
      const openNode = threadNodes.find((n) => n.role === 'open');
      const closeNode = threadNodes.find((n) => n.role === 'close');
      if (openNode && closeNode) {
        drawArc(ctx, openNode, closeNode, canvasWidth, trackY, totalSlots);
      }
    }
  }

  // Draw nodes
  for (const node of nodes) {
    drawNode(ctx, node, canvasWidth, trackY, totalSlots);
  }
}

function drawNode(
  ctx: CanvasRenderingContext2D,
  node: StoryNode,
  canvasWidth: number,
  trackY: number,
  totalSlots: number
): void {
  const x = slotToX(node.slot, canvasWidth, totalSlots);
  // Open nodes above track, close nodes below
  const y = node.role === 'open' ? trackY - LAYOUT.nodeOffset : trackY + LAYOUT.nodeOffset;

  const color = COLORS.mice[node.type];

  // Draw filled circle
  ctx.beginPath();
  ctx.arc(x, y, LAYOUT.nodeRadius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  // Draw border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawArc(
  ctx: CanvasRenderingContext2D,
  openNode: StoryNode,
  closeNode: StoryNode,
  canvasWidth: number,
  trackY: number,
  totalSlots: number
): void {
  const x1 = slotToX(openNode.slot, canvasWidth, totalSlots);
  const x2 = slotToX(closeNode.slot, canvasWidth, totalSlots);
  const y1 = trackY - LAYOUT.nodeOffset;
  const y2 = trackY + LAYOUT.nodeOffset;

  // Calculate control point for quadratic curve (arc above the track)
  const midX = (x1 + x2) / 2;
  const arcHeight = Math.min((x2 - x1) * 0.3, 50); // Arc height proportional to width, max 50px
  const controlY = trackY - LAYOUT.nodeOffset - arcHeight;

  const color = COLORS.mice[openNode.type];

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(midX, controlY, x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
}

export function resizeCanvas(canvas: HTMLCanvasElement): void {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.scale(dpr, dpr);
  }
}
