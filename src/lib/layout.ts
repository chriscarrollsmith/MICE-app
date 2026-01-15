import type { Container, StoryNode, MiceType } from './types';

export interface LayoutConfig {
  viewportWidth: number;
  minItemWidth: number;
  rowHeight: number;
  containerZoneHeight: number;
  padding: number;
}

export interface SlotPosition {
  slot: number;
  row: number;
  column: number;
  x: number;
  y: number;
}

export interface LayoutResult {
  totalSlots: number;
  itemsPerRow: number;
  totalRows: number;
  slotWidth: number;
  positions: Map<number, SlotPosition>;
  config: LayoutConfig;
}

export type SegmentType = 'single' | 'first' | 'middle' | 'last';

export interface ContainerSegment {
  containerId: string;
  row: number;
  segmentType: SegmentType;
  startX: number;
  endX: number;
  nestingDepth: number;
}

export type ArcSegmentType = 'same-row' | 'exit' | 'continuation' | 'entry';

export type ArcSegment =
  | { type: 'same-row'; row: number; startX: number; endX: number; controlY: number }
  | { type: 'exit'; row: number; startX: number; endX: number }
  | { type: 'continuation'; row: number }
  | { type: 'entry'; row: number; startX: number; endX: number };

export interface ArcPath {
  threadId: string;
  color: string;
  segments: ArcSegment[];
}

const MICE_COLORS: Record<MiceType, string> = {
  milieu: '#22c55e',    // green
  idea: '#3b82f6',      // blue
  character: '#f59e0b', // amber
  event: '#ef4444',     // red
};

/**
 * Calculate layout positions for all slots
 */
export function calculateLayout(totalSlots: number, config: LayoutConfig): LayoutResult {
  const itemsPerRow = Math.max(1, Math.floor(config.viewportWidth / config.minItemWidth));

  if (totalSlots === 0) {
    return {
      totalSlots: 0,
      itemsPerRow,
      totalRows: 0,
      slotWidth: config.viewportWidth / itemsPerRow,
      positions: new Map(),
      config,
    };
  }

  const totalRows = Math.ceil(totalSlots / itemsPerRow);
  const slotWidth = config.viewportWidth / Math.min(totalSlots, itemsPerRow);

  const positions = new Map<number, SlotPosition>();

  for (let slot = 0; slot < totalSlots; slot++) {
    const row = Math.floor(slot / itemsPerRow);
    const column = slot % itemsPerRow;

    // For partial last rows, recalculate slot width to fill row
    const slotsInThisRow = row === totalRows - 1 ? totalSlots - row * itemsPerRow : itemsPerRow;
    const thisRowSlotWidth = config.viewportWidth / slotsInThisRow;

    const x = column * thisRowSlotWidth + thisRowSlotWidth / 2;
    const y = row * config.rowHeight + config.rowHeight / 2;

    positions.set(slot, { slot, row, column, x, y });
  }

  return {
    totalSlots,
    itemsPerRow,
    totalRows,
    slotWidth,
    positions,
    config,
  };
}

/**
 * Get positions for insert handles (at slot boundaries)
 */
export function getInsertHandlePositions(totalSlots: number, config: LayoutConfig): SlotPosition[] {
  const handles: SlotPosition[] = [];
  const itemsPerRow = Math.max(1, Math.floor(config.viewportWidth / config.minItemWidth));

  if (totalSlots === 0) {
    // Single handle for empty timeline
    handles.push({
      slot: 0,
      row: 0,
      column: 0,
      x: config.viewportWidth / 2,
      y: config.rowHeight / 2,
    });
    return handles;
  }

  const totalRows = Math.ceil(totalSlots / itemsPerRow);

  for (let row = 0; row < totalRows; row++) {
    const firstSlotInRow = row * itemsPerRow;
    const lastSlotInRow = Math.min((row + 1) * itemsPerRow - 1, totalSlots - 1);
    const slotsInThisRow = lastSlotInRow - firstSlotInRow + 1;
    const slotWidth = config.viewportWidth / slotsInThisRow;
    const y = row * config.rowHeight + config.rowHeight / 2;

    // Handle before first slot in row
    handles.push({
      slot: firstSlotInRow,
      row,
      column: 0,
      x: 0,
      y,
    });

    // Handles between slots in this row
    for (let i = 0; i < slotsInThisRow; i++) {
      handles.push({
        slot: firstSlotInRow + i + 1,
        row,
        column: i + 1,
        x: (i + 1) * slotWidth,
        y,
      });
    }
  }

  return handles;
}

/**
 * Calculate container segments for rendering (handles multi-row containers)
 *
 * Container borders are positioned at SLOT CENTER positions.
 * This means container boundaries occupy specific slots on the timeline,
 * just like nodes do.
 */
export function calculateContainerSegments(
  container: Container,
  layout: LayoutResult,
  allContainers: Container[]
): ContainerSegment[] {
  const segments: ContainerSegment[] = [];
  const { positions, config, itemsPerRow } = layout;

  if (layout.totalSlots === 0) return segments;

  const startPos = positions.get(container.startSlot);
  const endPos = positions.get(container.endSlot);

  if (!startPos || !endPos) return segments;

  const startRow = startPos.row;
  const endRow = endPos.row;

  // Calculate nesting depth
  const nestingDepth = calculateNestingDepth(container, allContainers);

  if (startRow === endRow) {
    // Single row container - borders at slot CENTER positions
    segments.push({
      containerId: container.id,
      row: startRow,
      segmentType: 'single',
      startX: startPos.x,
      endX: endPos.x,
      nestingDepth,
    });
  } else {
    // Multi-row container
    for (let row = startRow; row <= endRow; row++) {
      const firstSlotInRow = row * itemsPerRow;
      const lastSlotInRow = Math.min((row + 1) * itemsPerRow - 1, layout.totalSlots - 1);
      const slotsInRow = lastSlotInRow - firstSlotInRow + 1;
      const slotWidth = config.viewportWidth / slotsInRow;

      let segmentType: SegmentType;
      let startX: number;
      let endX: number;

      if (row === startRow) {
        // First row: from start slot center to right edge
        segmentType = 'first';
        startX = startPos.x;
        endX = config.viewportWidth;
      } else if (row === endRow) {
        // Last row: from left edge to end slot center
        segmentType = 'last';
        startX = 0;
        endX = endPos.x;
      } else {
        // Middle rows: full width
        segmentType = 'middle';
        startX = 0;
        endX = config.viewportWidth;
      }

      segments.push({
        containerId: container.id,
        row,
        segmentType,
        startX,
        endX,
        nestingDepth,
      });
    }
  }

  return segments;
}

/**
 * Calculate nesting depth of a container
 */
function calculateNestingDepth(container: Container, allContainers: Container[]): number {
  let depth = 0;
  let current: Container | undefined = container;

  while (current?.parentId) {
    current = allContainers.find((c) => c.id === current!.parentId);
    if (current) depth++;
  }

  return depth;
}

/**
 * Calculate arc path for a thread (open -> close node connection)
 */
export function calculateArcPath(
  openNode: StoryNode,
  closeNode: StoryNode,
  layout: LayoutResult
): ArcPath {
  const segments: ArcSegment[] = [];
  const { positions, config, itemsPerRow } = layout;

  const openPos = positions.get(openNode.slot);
  const closePos = positions.get(closeNode.slot);

  if (!openPos || !closePos) {
    return {
      threadId: openNode.threadId,
      color: MICE_COLORS[openNode.type],
      segments: [],
    };
  }

  const startRow = openPos.row;
  const endRow = closePos.row;
  const color = MICE_COLORS[openNode.type];

  if (startRow === endRow) {
    // Same row - single arc
    segments.push({
      type: 'same-row',
      row: startRow,
      startX: openPos.x,
      endX: closePos.x,
      controlY: openPos.y - config.rowHeight * 0.3, // Arc curves up
    });
  } else {
    // Multi-row arc
    for (let row = startRow; row <= endRow; row++) {
      const firstSlotInRow = row * itemsPerRow;
      const lastSlotInRow = Math.min((row + 1) * itemsPerRow - 1, layout.totalSlots - 1);
      const slotsInRow = lastSlotInRow - firstSlotInRow + 1;
      const slotWidth = config.viewportWidth / slotsInRow;

      if (row === startRow) {
        // Exit segment - from open node to right edge
        segments.push({
          type: 'exit',
          row,
          startX: openPos.x,
          endX: config.viewportWidth,
        });
      } else if (row === endRow) {
        // Entry segment - from left edge to close node
        segments.push({
          type: 'entry',
          row,
          startX: 0,
          endX: closePos.x,
        });
      } else {
        // Continuation segment
        segments.push({
          type: 'continuation',
          row,
        });
      }
    }
  }

  return {
    threadId: openNode.threadId,
    color,
    segments,
  };
}

/**
 * Calculate boundary positions for insert handles.
 * Boundaries are the positions BETWEEN nodes where new content can be inserted.
 * - Boundary 0: before the first node
 * - Boundary N: after node at slot N-1, before node at slot N
 * - Boundary totalSlots: after the last node
 *
 * Returns an array of {boundary, x, y, row} positions.
 */
export function calculateBoundaryPositions(
  layout: LayoutResult,
  viewportWidth: number
): { boundary: number; x: number; y: number; row: number }[] {
  const boundaries: { boundary: number; x: number; y: number; row: number }[] = [];
  const { positions, config, totalSlots, itemsPerRow } = layout;

  if (totalSlots === 0) {
    // Empty timeline: single boundary at center
    // Container creation on empty canvas is handled specially in TimelineSVG
    boundaries.push({
      boundary: 0,
      x: viewportWidth / 2,
      y: config.rowHeight / 2,
      row: 0,
    });
    return boundaries;
  }

  // For each row, calculate boundary positions
  const totalRows = Math.ceil(totalSlots / itemsPerRow);

  for (let row = 0; row < totalRows; row++) {
    const firstSlotInRow = row * itemsPerRow;
    const lastSlotInRow = Math.min((row + 1) * itemsPerRow - 1, totalSlots - 1);
    const y = row * config.rowHeight + config.rowHeight / 2;

    // Boundary before first slot in this row
    const firstPos = positions.get(firstSlotInRow);
    if (firstPos) {
      // Position boundary at left edge or between rows
      boundaries.push({
        boundary: firstSlotInRow,
        x: row === 0 ? firstPos.x / 2 : 0, // At start of timeline or left edge for continuation
        y,
        row,
      });
    }

    // Boundaries between slots in this row
    for (let slot = firstSlotInRow; slot < lastSlotInRow; slot++) {
      const currentPos = positions.get(slot);
      const nextPos = positions.get(slot + 1);
      if (currentPos && nextPos) {
        boundaries.push({
          boundary: slot + 1,
          x: (currentPos.x + nextPos.x) / 2,
          y,
          row,
        });
      }
    }

    // Boundary after last slot in this row
    const lastPos = positions.get(lastSlotInRow);
    if (lastPos) {
      // If this is the last row, put boundary after last node
      // Otherwise, boundary at right edge continues to next row
      if (row === totalRows - 1) {
        boundaries.push({
          boundary: totalSlots,
          x: lastPos.x + (viewportWidth - lastPos.x) / 2,
          y,
          row,
        });
      }
    }
  }

  return boundaries;
}

/**
 * Find the nearest boundary to a given X position within a row.
 */
export function getNearestBoundary(
  x: number,
  row: number,
  layout: LayoutResult,
  viewportWidth: number
): number {
  const boundaries = calculateBoundaryPositions(layout, viewportWidth);
  const rowBoundaries = boundaries.filter((b) => b.row === row);

  if (rowBoundaries.length === 0) {
    return 0;
  }

  // Find the boundary with the closest x position
  let nearest = rowBoundaries[0];
  let minDist = Math.abs(x - nearest.x);

  for (const b of rowBoundaries) {
    const dist = Math.abs(x - b.x);
    if (dist < minDist) {
      minDist = dist;
      nearest = b;
    }
  }

  return nearest.boundary;
}

/**
 * Get the slot at a given X position within a row
 */
export function getSlotAtX(x: number, row: number, layout: LayoutResult): number {
  const { itemsPerRow, totalSlots, config } = layout;

  const firstSlotInRow = row * itemsPerRow;
  const lastSlotInRow = Math.min((row + 1) * itemsPerRow - 1, totalSlots - 1);
  const slotsInRow = lastSlotInRow - firstSlotInRow + 1;
  const slotWidth = config.viewportWidth / slotsInRow;

  const column = Math.floor(x / slotWidth);
  return Math.min(firstSlotInRow + column, lastSlotInRow);
}

/**
 * Get the insert slot at a given X position (snaps to boundaries)
 */
export function getInsertSlotAtX(x: number, row: number, layout: LayoutResult): number {
  const { itemsPerRow, totalSlots, config } = layout;

  if (totalSlots === 0) return 0;

  const firstSlotInRow = row * itemsPerRow;
  const lastSlotInRow = Math.min((row + 1) * itemsPerRow - 1, totalSlots - 1);
  const slotsInRow = lastSlotInRow - firstSlotInRow + 1;
  const slotWidth = config.viewportWidth / slotsInRow;

  // Round to nearest slot boundary
  const column = Math.round(x / slotWidth);
  return Math.min(firstSlotInRow + column, lastSlotInRow + 1);
}

/**
 * Get row number from Y position
 */
export function getRowAtY(y: number, config: LayoutConfig): number {
  return Math.floor(y / config.rowHeight);
}

/**
 * Determine which zone (container or node) a Y position is in
 */
export function getZoneAtY(y: number, config: LayoutConfig): 'container' | 'node' {
  const rowY = y % config.rowHeight;
  return rowY < config.containerZoneHeight ? 'container' : 'node';
}
