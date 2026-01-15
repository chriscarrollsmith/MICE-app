import type { Container, StoryNode } from '../lib/types';

const LAYOUT = {
  containerZoneHeight: 0.25,
  trackLineY: 0.6,
  padding: 20,
  nodeRadius: 8,
};

export interface HitTestResult {
  zone: 'container' | 'node' | 'none';
  slot: number; // Occupied slot index (integer position where content can be placed)
  container?: Container;
  node?: StoryNode;
}

/**
 * Check if a Y coordinate is in the container zone (top 25%)
 */
export function isInContainerZone(y: number, canvasHeight: number): boolean {
  return y < canvasHeight * LAYOUT.containerZoneHeight;
}

/**
 * Check if a Y coordinate is in the node zone (below container zone)
 */
export function isInNodeZone(y: number, canvasHeight: number): boolean {
  const containerZoneEnd = canvasHeight * LAYOUT.containerZoneHeight;
  return y > containerZoneEnd;
}

/**
 * Convert an X coordinate to an occupied slot index based on total occupied slots.
 * On empty canvas (0 occupied slots), returns 0 as a fallback.
 */
export function getSlotFromX(x: number, canvasWidth: number, totalSlots: number): number {
  if (totalSlots === 0) return 0;
  const usableWidth = canvasWidth - LAYOUT.padding * 2;
  const relativeX = x - LAYOUT.padding;
  const position = relativeX / usableWidth;
  const slot = Math.round(position * (totalSlots - 1));
  return Math.max(0, Math.min(totalSlots - 1, slot));
}

/**
 * Convert an X coordinate to a normalized timeline position (0-1)
 * @deprecated Use getSlotFromX with slot-based system
 */
export function getTimelinePosition(x: number, canvasWidth: number): number {
  const usableWidth = canvasWidth - LAYOUT.padding * 2;
  const relativeX = x - LAYOUT.padding;
  const position = relativeX / usableWidth;
  return Math.max(0, Math.min(1, position));
}

/**
 * Convert a slot index to an X coordinate
 */
export function slotToX(slot: number, canvasWidth: number, totalSlots: number): number {
  if (totalSlots <= 1) return canvasWidth / 2;
  const usableWidth = canvasWidth - LAYOUT.padding * 2;
  const position = slot / (totalSlots - 1);
  return LAYOUT.padding + usableWidth * position;
}

/**
 * Convert a normalized timeline position (0-1) to an X coordinate
 * @deprecated Use slotToX with slot-based system
 */
export function positionToX(position: number, canvasWidth: number): number {
  const usableWidth = canvasWidth - LAYOUT.padding * 2;
  return LAYOUT.padding + usableWidth * position;
}

/**
 * Find the deepest container that contains the given occupied slot.
 * Each container boundary occupies exactly one slot (startSlot and endSlot).
 */
export function findContainerAtSlot(
  slot: number,
  containers: Container[]
): Container | null {
  // Find all containers that contain this slot
  const matching = containers.filter(
    (c) => slot >= c.startSlot && slot <= c.endSlot
  );

  if (matching.length === 0) return null;

  // Return the deepest one (smallest range)
  matching.sort((a, b) => {
    const rangeA = a.endSlot - a.startSlot;
    const rangeB = b.endSlot - b.startSlot;
    return rangeA - rangeB;
  });

  return matching[0];
}

/**
 * Find the parent container for a given slot range
 * Returns the smallest container that fully contains the range
 */
export function findParentContainer(
  startSlot: number,
  endSlot: number,
  containers: Container[]
): Container | null {
  const matching = containers.filter(
    (c) => startSlot >= c.startSlot && endSlot <= c.endSlot
  );

  if (matching.length === 0) return null;

  // Return the smallest one
  matching.sort((a, b) => {
    const rangeA = a.endSlot - a.startSlot;
    const rangeB = b.endSlot - b.startSlot;
    return rangeA - rangeB;
  });

  return matching[0];
}

/**
 * Check if a container can be created at the given slots
 * (no partial overlaps with existing containers)
 */
export function canCreateContainer(
  startSlot: number,
  endSlot: number,
  containers: Container[]
): boolean {
  for (const container of containers) {
    // Check for partial overlap
    const startsInside = startSlot > container.startSlot && startSlot < container.endSlot;
    const endsInside = endSlot > container.startSlot && endSlot < container.endSlot;
    const spansContainer = startSlot <= container.startSlot && endSlot >= container.endSlot;

    // Invalid: starts inside but ends outside, or starts outside but ends inside
    if (startsInside && !endsInside && !spansContainer) return false;
    if (!startsInside && endsInside && !spansContainer) return false;
  }

  return true;
}

/**
 * Find a node at the given screen position
 */
export function findNodeAtPosition(
  x: number,
  y: number,
  nodes: StoryNode[],
  canvasWidth: number,
  canvasHeight: number,
  totalSlots: number
): StoryNode | null {
  const trackY = canvasHeight * LAYOUT.trackLineY;

  for (const node of nodes) {
    const nodeX = slotToX(node.slot, canvasWidth, totalSlots);
    const nodeY = node.role === 'open' ? trackY - 12 : trackY + 12;

    const dx = x - nodeX;
    const dy = y - nodeY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= LAYOUT.nodeRadius + 4) {
      return node;
    }
  }

  return null;
}

/**
 * Perform a full hit test at the given coordinates
 */
export function hitTest(
  x: number,
  y: number,
  containers: Container[],
  nodes: StoryNode[],
  canvasWidth: number,
  canvasHeight: number,
  totalSlots: number
): HitTestResult {
  const slot = getSlotFromX(x, canvasWidth, totalSlots);

  // Check for node hit first (highest priority)
  if (isInNodeZone(y, canvasHeight)) {
    const node = findNodeAtPosition(x, y, nodes, canvasWidth, canvasHeight, totalSlots);
    if (node) {
      return { zone: 'node', slot, node };
    }
  }

  // Check for container zone
  if (isInContainerZone(y, canvasHeight)) {
    const container = findContainerAtSlot(slot, containers);
    return { zone: 'container', slot, container: container || undefined };
  }

  // Node zone but no node hit
  if (isInNodeZone(y, canvasHeight)) {
    const container = findContainerAtSlot(slot, containers);
    return { zone: 'node', slot, container: container || undefined };
  }

  return { zone: 'none', slot };
}
