import type { Container, StoryNode } from './types';

/**
 * Get all occupied slot indices, sorted in ascending order.
 * Includes container start/end slots and node slots.
 */
export function getOccupiedSlots(containers: Container[], nodes: StoryNode[]): number[] {
  const slots = new Set<number>();

  for (const container of containers) {
    slots.add(container.startSlot);
    slots.add(container.endSlot);
  }

  for (const node of nodes) {
    slots.add(node.slot);
  }

  return Array.from(slots).sort((a, b) => a - b);
}

/**
 * Get the total number of slots (max slot index + 1).
 * This is used for position calculations - slots are evenly distributed across the timeline.
 */
export function getTotalSlots(containers: Container[], nodes: StoryNode[]): number {
  if (containers.length === 0 && nodes.length === 0) {
    return 0;
  }

  let maxSlot = 0;

  for (const container of containers) {
    maxSlot = Math.max(maxSlot, container.startSlot, container.endSlot);
  }

  for (const node of nodes) {
    maxSlot = Math.max(maxSlot, node.slot);
  }

  // Return max slot + 1 (e.g., if max slot is 9, we have 10 slots: 0-9)
  return maxSlot + 1;
}

/**
 * Insert at a slot: increment all slots >= insertionPoint by 1.
 * Returns new arrays (does not mutate originals).
 */
export function insertAtSlot(
  slot: number,
  containers: Container[],
  nodes: StoryNode[]
): { containers: Container[]; nodes: StoryNode[] } {
  const newContainers = containers.map(container => ({
    ...container,
    startSlot: container.startSlot >= slot ? container.startSlot + 1 : container.startSlot,
    endSlot: container.endSlot >= slot ? container.endSlot + 1 : container.endSlot,
  }));

  const newNodes = nodes.map(node => ({
    ...node,
    slot: node.slot >= slot ? node.slot + 1 : node.slot,
  }));

  return { containers: newContainers, nodes: newNodes };
}

/**
 * Delete a slot: decrement all slots > deletedSlot by 1.
 * Returns new arrays (does not mutate originals).
 */
export function deleteSlot(
  slot: number,
  containers: Container[],
  nodes: StoryNode[]
): { containers: Container[]; nodes: StoryNode[] } {
  const newContainers = containers.map(container => ({
    ...container,
    startSlot: container.startSlot > slot ? container.startSlot - 1 : container.startSlot,
    endSlot: container.endSlot > slot ? container.endSlot - 1 : container.endSlot,
  }));

  const newNodes = nodes.map(node => ({
    ...node,
    slot: node.slot > slot ? node.slot - 1 : node.slot,
  }));

  return { containers: newContainers, nodes: newNodes };
}

/**
 * Renormalize slots to be contiguous starting from 0.
 * Preserves relative ordering.
 * Returns new arrays (does not mutate originals).
 */
export function renormalizeSlots(
  containers: Container[],
  nodes: StoryNode[]
): { containers: Container[]; nodes: StoryNode[] } {
  // Get all unique slots and create a mapping to new contiguous indices
  const occupiedSlots = getOccupiedSlots(containers, nodes);
  const slotMapping = new Map<number, number>();

  occupiedSlots.forEach((oldSlot, newIndex) => {
    slotMapping.set(oldSlot, newIndex);
  });

  // Apply mapping to containers
  const newContainers = containers.map(container => ({
    ...container,
    startSlot: slotMapping.get(container.startSlot) ?? container.startSlot,
    endSlot: slotMapping.get(container.endSlot) ?? container.endSlot,
  }));

  // Apply mapping to nodes
  const newNodes = nodes.map(node => ({
    ...node,
    slot: slotMapping.get(node.slot) ?? node.slot,
  }));

  return { containers: newContainers, nodes: newNodes };
}
