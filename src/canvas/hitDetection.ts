import type { Container, StoryNode } from '../lib/types';

const LAYOUT = {
  containerZoneHeight: 0.25,
  trackLineY: 0.6,
  padding: 20,
  nodeRadius: 8,
};

export interface HitTestResult {
  zone: 'container' | 'node' | 'none';
  position: number; // Normalized 0-1 position on timeline
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
 * Convert an X coordinate to a normalized timeline position (0-1)
 */
export function getTimelinePosition(x: number, canvasWidth: number): number {
  const usableWidth = canvasWidth - LAYOUT.padding * 2;
  const relativeX = x - LAYOUT.padding;
  const position = relativeX / usableWidth;
  return Math.max(0, Math.min(1, position));
}

/**
 * Convert a normalized timeline position (0-1) to an X coordinate
 */
export function positionToX(position: number, canvasWidth: number): number {
  const usableWidth = canvasWidth - LAYOUT.padding * 2;
  return LAYOUT.padding + usableWidth * position;
}

/**
 * Find the deepest container at a given position
 */
export function findContainerAtPosition(
  position: number,
  containers: Container[]
): Container | null {
  // Find all containers that contain this position
  const matching = containers.filter(
    (c) => position >= c.startPosition && position <= c.endPosition
  );

  if (matching.length === 0) return null;

  // Return the deepest one (smallest range, or has a parent)
  // Sort by range size (smallest first)
  matching.sort((a, b) => {
    const rangeA = a.endPosition - a.startPosition;
    const rangeB = b.endPosition - b.startPosition;
    return rangeA - rangeB;
  });

  return matching[0];
}

/**
 * Find the parent container for a given position range
 * Returns the smallest container that fully contains the range
 */
export function findParentContainer(
  startPos: number,
  endPos: number,
  containers: Container[]
): Container | null {
  const matching = containers.filter(
    (c) => startPos >= c.startPosition && endPos <= c.endPosition
  );

  if (matching.length === 0) return null;

  // Return the smallest one
  matching.sort((a, b) => {
    const rangeA = a.endPosition - a.startPosition;
    const rangeB = b.endPosition - b.startPosition;
    return rangeA - rangeB;
  });

  return matching[0];
}

/**
 * Check if a container can be created at the given positions
 * (no partial overlaps with existing containers)
 */
export function canCreateContainer(
  startPos: number,
  endPos: number,
  containers: Container[]
): boolean {
  for (const container of containers) {
    // Check for partial overlap
    const startsInside = startPos > container.startPosition && startPos < container.endPosition;
    const endsInside = endPos > container.startPosition && endPos < container.endPosition;
    const spansContainer = startPos <= container.startPosition && endPos >= container.endPosition;

    // Valid cases:
    // 1. Completely inside existing container (both start and end inside)
    // 2. Completely outside existing container (neither inside)
    // 3. Completely spans existing container (will become parent)

    // Invalid: starts inside but ends outside, or starts outside but ends inside
    if (startsInside && !endsInside && !spansContainer) return false;
    if (!startsInside && endsInside && !spansContainer) return false;
  }

  return true;
}

/**
 * Find a node at the given position
 */
export function findNodeAtPosition(
  x: number,
  y: number,
  nodes: StoryNode[],
  canvasWidth: number,
  canvasHeight: number
): StoryNode | null {
  const trackY = canvasHeight * LAYOUT.trackLineY;

  for (const node of nodes) {
    const nodeX = positionToX(node.position, canvasWidth);
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
  canvasHeight: number
): HitTestResult {
  const position = getTimelinePosition(x, canvasWidth);

  // Check for node hit first (highest priority)
  if (isInNodeZone(y, canvasHeight)) {
    const node = findNodeAtPosition(x, y, nodes, canvasWidth, canvasHeight);
    if (node) {
      return { zone: 'node', position, node };
    }
  }

  // Check for container zone
  if (isInContainerZone(y, canvasHeight)) {
    const container = findContainerAtPosition(position, containers);
    return { zone: 'container', position, container: container || undefined };
  }

  // Node zone but no node hit
  if (isInNodeZone(y, canvasHeight)) {
    const container = findContainerAtPosition(position, containers);
    return { zone: 'node', position, container: container || undefined };
  }

  return { zone: 'none', position };
}
