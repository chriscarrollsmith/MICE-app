import type { Container, StoryNode } from './types';

/**
 * Find the innermost container that contains the given occupied slot.
 * Returns null if the slot is not inside any container.
 * Each container boundary occupies exactly one slot (startSlot and endSlot).
 */
export function findContainerAtSlot(slot: number, containers: Container[]): Container | null {
  // Filter to containers that contain the slot
  const containingContainers = containers.filter(
    c => slot >= c.startSlot && slot <= c.endSlot
  );

  if (containingContainers.length === 0) {
    return null;
  }

  // Find the innermost (smallest span) container
  return containingContainers.reduce((innermost, current) => {
    const currentSpan = current.endSlot - current.startSlot;
    const innermostSpan = innermost.endSlot - innermost.startSlot;
    return currentSpan < innermostSpan ? current : innermost;
  });
}

/**
 * Check if a container can be created with the given parameters.
 * Validates:
 * - endSlot > startSlot
 * - Container fits within parent (if parentId specified)
 * - No partial overlaps with siblings
 */
export function canCreateContainer(
  startSlot: number,
  endSlot: number,
  parentId: string | null,
  containers: Container[]
): boolean {
  // Must have positive width
  if (endSlot <= startSlot) {
    return false;
  }

  // If parent specified, must fit within parent
  if (parentId !== null) {
    const parent = containers.find(c => c.id === parentId);
    if (!parent) {
      return false;
    }
    if (startSlot < parent.startSlot || endSlot > parent.endSlot) {
      return false;
    }
  }

  // Check for partial overlaps with siblings (containers with same parent)
  const siblings = containers.filter(c => c.parentId === parentId);
  for (const sibling of siblings) {
    // Check for partial overlap (one boundary inside, one outside)
    const startsInside = startSlot > sibling.startSlot && startSlot < sibling.endSlot;
    const endsInside = endSlot > sibling.startSlot && endSlot < sibling.endSlot;
    const siblingStartsInside = sibling.startSlot > startSlot && sibling.startSlot < endSlot;
    const siblingEndsInside = sibling.endSlot > startSlot && sibling.endSlot < endSlot;

    // Partial overlap: one end inside but not fully contained
    if (startsInside !== endsInside) {
      return false;
    }
    if (siblingStartsInside !== siblingEndsInside) {
      return false;
    }
  }

  return true;
}

/**
 * Get all valid slot positions for placing a container's end boundary.
 * The end boundary must occupy a slot that is after startSlot.
 * Slots are exclusive: each slot can only have one occupant (node or container boundary).
 */
export function getValidContainerEndSlots(
  startSlot: number,
  parentId: string | null,
  containers: Container[],
  maxSlot: number
): number[] {
  const validSlots: number[] = [];

  for (let slot = startSlot + 1; slot <= maxSlot; slot++) {
    if (canCreateContainer(startSlot, slot, parentId, containers)) {
      validSlots.push(slot);
    }
  }

  return validSlots;
}

/**
 * Check if a close node can be placed at the given slot.
 * Validates:
 * - closeSlot > openSlot
 * - Nesting is valid:
 *   - Can't close inside a container that opened after the thread (closes in child)
 *   - Can't close outside the container where the thread opened (escapes to parent)
 */
export function canPlaceCloseNode(
  openSlot: number,
  closeSlot: number,
  containers: Container[]
): boolean {
  // Close must be after open
  if (closeSlot <= openSlot) {
    return false;
  }

  // Find the innermost container at the open position
  const openContainer = findContainerAtSlot(openSlot, containers);

  // Find the innermost container at the close position
  const closeContainer = findContainerAtSlot(closeSlot, containers);

  // If open is not in any container
  if (openContainer === null) {
    // Close can't be inside a container that doesn't contain open
    if (closeContainer !== null) {
      // Check if closeContainer also contains openSlot
      if (openSlot < closeContainer.startSlot || openSlot > closeContainer.endSlot) {
        return false;
      }
    }
    return true;
  }

  // Open is inside a container - close MUST be in the same innermost container
  // (can't escape to parent, can't close in child)
  if (closeContainer === null) {
    // Close is outside all containers, but open is inside one - invalid
    return false;
  }

  // Must be the exact same innermost container
  return closeContainer.id === openContainer.id;
}

/**
 * Get all valid slot positions for placing a close node.
 * On empty canvas (0 occupied slots), we allow placing at openSlot + 1
 * since new slots will be created when inserting.
 * Slots are exclusive: each slot can only have one occupant.
 */
export function getValidCloseNodeSlots(
  openSlot: number,
  containers: Container[],
  _nodes: StoryNode[],
  maxSlot: number
): number[] {
  const validSlots: number[] = [];

  // Allow at least one slot after openSlot for closing
  const effectiveMaxSlot = Math.max(maxSlot, openSlot + 1);

  for (let slot = openSlot + 1; slot <= effectiveMaxSlot; slot++) {
    if (canPlaceCloseNode(openSlot, slot, containers)) {
      validSlots.push(slot);
    }
  }

  return validSlots;
}
