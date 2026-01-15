import { describe, it, expect } from 'vitest';
import {
  getOccupiedSlots,
  getTotalSlots,
  insertAtSlot,
  deleteSlot,
  renormalizeSlots,
} from '../../src/lib/slots';
import type { Container, StoryNode } from '../../src/lib/types';

// Helper to create test containers
function makeContainer(id: string, startSlot: number, endSlot: number, parentId: string | null = null): Container {
  return {
    id,
    parentId,
    title: `Container ${id}`,
    startSlot,
    endSlot,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Helper to create test nodes
function makeNode(id: string, slot: number, threadId: string, role: 'open' | 'close', containerId: string = 'c1'): StoryNode {
  return {
    id,
    containerId,
    threadId,
    type: 'milieu',
    role,
    slot,
    title: `Node ${id}`,
    description: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('getOccupiedSlots', () => {
  it('returns empty array when no containers or nodes', () => {
    const result = getOccupiedSlots([], []);
    expect(result).toEqual([]);
  });

  it('returns sorted slots from containers', () => {
    const containers = [
      makeContainer('c1', 0, 3),
      makeContainer('c2', 1, 2),
    ];
    const result = getOccupiedSlots(containers, []);
    expect(result).toEqual([0, 1, 2, 3]);
  });

  it('returns sorted slots from nodes', () => {
    const nodes = [
      makeNode('n1', 2, 't1', 'open'),
      makeNode('n2', 5, 't1', 'close'),
    ];
    const result = getOccupiedSlots([], nodes);
    expect(result).toEqual([2, 5]);
  });

  it('returns sorted unique slots from both containers and nodes', () => {
    const containers = [makeContainer('c1', 0, 5)];
    const nodes = [
      makeNode('n1', 2, 't1', 'open'),
      makeNode('n2', 4, 't1', 'close'),
    ];
    const result = getOccupiedSlots(containers, nodes);
    expect(result).toEqual([0, 2, 4, 5]);
  });

  it('removes duplicates when container and node share a slot', () => {
    const containers = [makeContainer('c1', 0, 2)];
    const nodes = [makeNode('n1', 2, 't1', 'open')];
    const result = getOccupiedSlots(containers, nodes);
    // Slot 2 appears in both container.endSlot and node.slot
    expect(result).toEqual([0, 2]);
  });
});

describe('getTotalSlots', () => {
  it('returns 0 for empty data', () => {
    expect(getTotalSlots([], [])).toBe(0);
  });

  it('returns max slot + 1', () => {
    const containers = [makeContainer('c1', 0, 3)];
    const nodes = [
      makeNode('n1', 1, 't1', 'open'),
      makeNode('n2', 2, 't1', 'close'),
    ];
    // Max slot is 3, so total = 4
    expect(getTotalSlots(containers, nodes)).toBe(4);
  });

  it('returns max slot + 1 even with gaps', () => {
    const containers = [makeContainer('c1', 2, 8)];
    const nodes: StoryNode[] = [];
    // Max slot is 8, so total = 9
    expect(getTotalSlots(containers, nodes)).toBe(9);
  });

  it('considers nodes for max slot', () => {
    const containers = [makeContainer('c1', 0, 5)];
    const nodes = [makeNode('n1', 10, 't1', 'open')];
    // Max slot is 10 (from node), so total = 11
    expect(getTotalSlots(containers, nodes)).toBe(11);
  });
});

describe('insertAtSlot', () => {
  it('increments slots >= insertion point for containers', () => {
    const containers = [
      makeContainer('c1', 0, 4),
      makeContainer('c2', 1, 3),
    ];
    const nodes: StoryNode[] = [];

    const result = insertAtSlot(2, containers, nodes);

    // Inserting at slot 2: slots 2, 3, 4 become 3, 4, 5
    expect(result.containers[0].startSlot).toBe(0); // unchanged
    expect(result.containers[0].endSlot).toBe(5);   // was 4, now 5
    expect(result.containers[1].startSlot).toBe(1); // unchanged
    expect(result.containers[1].endSlot).toBe(4);   // was 3, now 4
  });

  it('increments slots >= insertion point for nodes', () => {
    const containers: Container[] = [];
    const nodes = [
      makeNode('n1', 0, 't1', 'open'),
      makeNode('n2', 1, 't1', 'close'),
      makeNode('n3', 2, 't2', 'open'),
      makeNode('n4', 3, 't2', 'close'),
    ];

    const result = insertAtSlot(2, containers, nodes);

    expect(result.nodes[0].slot).toBe(0); // unchanged
    expect(result.nodes[1].slot).toBe(1); // unchanged
    expect(result.nodes[2].slot).toBe(3); // was 2, now 3
    expect(result.nodes[3].slot).toBe(4); // was 3, now 4
  });

  it('handles insertion at slot 0', () => {
    const containers = [makeContainer('c1', 0, 2)];
    const nodes = [makeNode('n1', 1, 't1', 'open')];

    const result = insertAtSlot(0, containers, nodes);

    expect(result.containers[0].startSlot).toBe(1); // was 0, now 1
    expect(result.containers[0].endSlot).toBe(3);   // was 2, now 3
    expect(result.nodes[0].slot).toBe(2);           // was 1, now 2
  });

  it('does not mutate original arrays', () => {
    const containers = [makeContainer('c1', 0, 2)];
    const nodes = [makeNode('n1', 1, 't1', 'open')];
    const originalContainerSlot = containers[0].startSlot;
    const originalNodeSlot = nodes[0].slot;

    insertAtSlot(0, containers, nodes);

    expect(containers[0].startSlot).toBe(originalContainerSlot);
    expect(nodes[0].slot).toBe(originalNodeSlot);
  });
});

describe('deleteSlot', () => {
  it('decrements slots > deleted slot for containers', () => {
    const containers = [
      makeContainer('c1', 0, 4),
      makeContainer('c2', 1, 3),
    ];
    const nodes: StoryNode[] = [];

    const result = deleteSlot(2, containers, nodes);

    // Deleting slot 2: slots 3, 4 become 2, 3
    expect(result.containers[0].startSlot).toBe(0); // unchanged
    expect(result.containers[0].endSlot).toBe(3);   // was 4, now 3
    expect(result.containers[1].startSlot).toBe(1); // unchanged
    expect(result.containers[1].endSlot).toBe(2);   // was 3, now 2
  });

  it('decrements slots > deleted slot for nodes', () => {
    const containers: Container[] = [];
    const nodes = [
      makeNode('n1', 0, 't1', 'open'),
      makeNode('n2', 1, 't1', 'close'),
      makeNode('n3', 3, 't2', 'open'),
      makeNode('n4', 4, 't2', 'close'),
    ];

    // Delete slot 2 (which is empty, but we're shifting things after it)
    const result = deleteSlot(2, containers, nodes);

    expect(result.nodes[0].slot).toBe(0); // unchanged
    expect(result.nodes[1].slot).toBe(1); // unchanged
    expect(result.nodes[2].slot).toBe(2); // was 3, now 2
    expect(result.nodes[3].slot).toBe(3); // was 4, now 3
  });

  it('does not mutate original arrays', () => {
    const containers = [makeContainer('c1', 0, 3)];
    const originalEndSlot = containers[0].endSlot;

    deleteSlot(1, containers, []);

    expect(containers[0].endSlot).toBe(originalEndSlot);
  });
});

describe('renormalizeSlots', () => {
  it('returns empty arrays for empty input', () => {
    const result = renormalizeSlots([], []);
    expect(result.containers).toEqual([]);
    expect(result.nodes).toEqual([]);
  });

  it('makes slots contiguous starting from 0', () => {
    const containers = [makeContainer('c1', 0, 6)];
    const nodes = [
      makeNode('n1', 2, 't1', 'open'),
      makeNode('n2', 4, 't1', 'close'),
    ];

    const result = renormalizeSlots(containers, nodes);

    // Original slots: 0, 2, 4, 6 -> should become 0, 1, 2, 3
    expect(result.containers[0].startSlot).toBe(0);
    expect(result.containers[0].endSlot).toBe(3);
    expect(result.nodes[0].slot).toBe(1);
    expect(result.nodes[1].slot).toBe(2);
  });

  it('handles already contiguous slots', () => {
    const containers = [makeContainer('c1', 0, 3)];
    const nodes = [
      makeNode('n1', 1, 't1', 'open'),
      makeNode('n2', 2, 't1', 'close'),
    ];

    const result = renormalizeSlots(containers, nodes);

    expect(result.containers[0].startSlot).toBe(0);
    expect(result.containers[0].endSlot).toBe(3);
    expect(result.nodes[0].slot).toBe(1);
    expect(result.nodes[1].slot).toBe(2);
  });

  it('preserves relative ordering', () => {
    const containers: Container[] = [];
    const nodes = [
      makeNode('n1', 10, 't1', 'open'),
      makeNode('n2', 20, 't1', 'close'),
      makeNode('n3', 15, 't2', 'open'),
      makeNode('n4', 25, 't2', 'close'),
    ];

    const result = renormalizeSlots(containers, nodes);

    // Order by slot: n1(10), n3(15), n2(20), n4(25) -> 0, 1, 2, 3
    const n1 = result.nodes.find(n => n.id === 'n1')!;
    const n2 = result.nodes.find(n => n.id === 'n2')!;
    const n3 = result.nodes.find(n => n.id === 'n3')!;
    const n4 = result.nodes.find(n => n.id === 'n4')!;

    expect(n1.slot).toBe(0);
    expect(n3.slot).toBe(1);
    expect(n2.slot).toBe(2);
    expect(n4.slot).toBe(3);
  });

  it('does not mutate original arrays', () => {
    const containers = [makeContainer('c1', 0, 10)];
    const originalEndSlot = containers[0].endSlot;

    renormalizeSlots(containers, []);

    expect(containers[0].endSlot).toBe(originalEndSlot);
  });
});
