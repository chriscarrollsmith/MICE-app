import { describe, it, expect } from 'vitest';
import {
  canCreateContainer,
  canPlaceCloseNode,
  getValidContainerEndSlots,
  getValidCloseNodeSlots,
  findContainerAtSlot,
} from '../../src/lib/validation';
import type { Container, StoryNode } from '../../src/lib/types';

// Helper to create test containers
function makeContainer(
  id: string,
  startSlot: number,
  endSlot: number,
  parentId: string | null = null
): Container {
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
function makeNode(
  id: string,
  slot: number,
  threadId: string,
  role: 'open' | 'close',
  containerId: string = 'c1'
): StoryNode {
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

describe('findContainerAtSlot', () => {
  it('returns null when no containers exist', () => {
    expect(findContainerAtSlot(5, [])).toBeNull();
  });

  it('returns null when slot is outside all containers', () => {
    const containers = [makeContainer('c1', 2, 5)];
    expect(findContainerAtSlot(0, containers)).toBeNull();
    expect(findContainerAtSlot(6, containers)).toBeNull();
  });

  it('returns the container when slot is inside', () => {
    const containers = [makeContainer('c1', 2, 5)];
    expect(findContainerAtSlot(3, containers)?.id).toBe('c1');
  });

  it('returns the innermost container for nested containers', () => {
    const containers = [
      makeContainer('outer', 0, 10),
      makeContainer('inner', 3, 7, 'outer'),
    ];
    // Slot 5 is inside both, but inner is the innermost
    expect(findContainerAtSlot(5, containers)?.id).toBe('inner');
    // Slot 1 is only inside outer
    expect(findContainerAtSlot(1, containers)?.id).toBe('outer');
  });

  it('handles deeply nested containers', () => {
    const containers = [
      makeContainer('level1', 0, 20),
      makeContainer('level2', 2, 18, 'level1'),
      makeContainer('level3', 5, 15, 'level2'),
    ];
    expect(findContainerAtSlot(10, containers)?.id).toBe('level3');
    expect(findContainerAtSlot(3, containers)?.id).toBe('level2');
    expect(findContainerAtSlot(1, containers)?.id).toBe('level1');
  });

  it('returns container when slot is at boundary', () => {
    const containers = [makeContainer('c1', 2, 5)];
    // Boundaries are inclusive
    expect(findContainerAtSlot(2, containers)?.id).toBe('c1');
    expect(findContainerAtSlot(5, containers)?.id).toBe('c1');
  });
});

describe('canCreateContainer', () => {
  it('allows creating container in empty timeline', () => {
    expect(canCreateContainer(0, 5, null, [])).toBe(true);
  });

  it('allows creating container fully inside parent', () => {
    const containers = [makeContainer('parent', 0, 10)];
    expect(canCreateContainer(2, 8, 'parent', containers)).toBe(true);
  });

  it('rejects container that extends beyond parent start', () => {
    const containers = [makeContainer('parent', 2, 10)];
    expect(canCreateContainer(1, 8, 'parent', containers)).toBe(false);
  });

  it('rejects container that extends beyond parent end', () => {
    const containers = [makeContainer('parent', 0, 10)];
    expect(canCreateContainer(5, 12, 'parent', containers)).toBe(false);
  });

  it('rejects container with endSlot <= startSlot', () => {
    expect(canCreateContainer(5, 5, null, [])).toBe(false);
    expect(canCreateContainer(5, 3, null, [])).toBe(false);
  });

  it('rejects container that partially overlaps sibling', () => {
    const containers = [
      makeContainer('parent', 0, 20),
      makeContainer('sibling', 5, 10, 'parent'),
    ];
    // Overlaps start of sibling
    expect(canCreateContainer(3, 7, 'parent', containers)).toBe(false);
    // Overlaps end of sibling
    expect(canCreateContainer(8, 15, 'parent', containers)).toBe(false);
  });

  it('allows container that fully contains sibling', () => {
    const containers = [
      makeContainer('parent', 0, 20),
      makeContainer('sibling', 5, 10, 'parent'),
    ];
    // This would wrap around sibling - but sibling's parent is 'parent', not the new container
    // So this should be allowed as they'd be separate children of parent
    expect(canCreateContainer(3, 15, 'parent', containers)).toBe(true);
  });

  it('allows non-overlapping siblings', () => {
    const containers = [
      makeContainer('parent', 0, 20),
      makeContainer('sibling', 5, 8, 'parent'),
    ];
    expect(canCreateContainer(10, 15, 'parent', containers)).toBe(true);
    expect(canCreateContainer(1, 4, 'parent', containers)).toBe(true);
  });
});

describe('getValidContainerEndSlots', () => {
  it('returns all slots after start when no constraints', () => {
    // With empty containers and null parent, any slot > startSlot is valid
    // Assuming we're looking at slots 0-10
    const result = getValidContainerEndSlots(2, null, [], 10);
    expect(result).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('limits end slots to parent boundary', () => {
    const containers = [makeContainer('parent', 0, 8)];
    const result = getValidContainerEndSlots(2, 'parent', containers, 10);
    // Must be > 2 and <= 8 (parent's end)
    expect(result).toEqual([3, 4, 5, 6, 7, 8]);
  });

  it('excludes slots that would cause partial overlap with siblings', () => {
    const containers = [
      makeContainer('parent', 0, 20),
      makeContainer('sibling', 8, 12, 'parent'),
    ];
    const result = getValidContainerEndSlots(2, 'parent', containers, 20);
    // Valid ends: 3-7 (before sibling) or 13-20 (fully containing sibling or after)
    // Slots 8-12 would cause partial overlap
    expect(result).not.toContain(9);
    expect(result).not.toContain(10);
    expect(result).not.toContain(11);
    expect(result).toContain(3);
    expect(result).toContain(7);
    expect(result).toContain(13);
  });
});

describe('canPlaceCloseNode', () => {
  it('rejects close at or before open', () => {
    expect(canPlaceCloseNode(5, 5, [])).toBe(false);
    expect(canPlaceCloseNode(5, 3, [])).toBe(false);
  });

  it('allows close after open with no containers', () => {
    expect(canPlaceCloseNode(2, 5, [])).toBe(true);
  });

  it('allows close in same container as open', () => {
    const containers = [makeContainer('c1', 0, 10)];
    // Both open (2) and close (5) are inside c1
    expect(canPlaceCloseNode(2, 5, containers)).toBe(true);
  });

  it('rejects close that violates nesting (closes inside child container)', () => {
    const containers = [
      makeContainer('outer', 0, 20),
      makeContainer('inner', 5, 15, 'outer'),
    ];
    // Open at 3 (in outer but outside inner), close at 10 (inside inner)
    // This violates nesting: can't close inside a container that opened after thread opened
    expect(canPlaceCloseNode(3, 10, containers)).toBe(false);
  });

  it('allows close outside child container when open is outside', () => {
    const containers = [
      makeContainer('outer', 0, 20),
      makeContainer('inner', 5, 15, 'outer'),
    ];
    // Open at 3 (outside inner), close at 18 (outside inner)
    expect(canPlaceCloseNode(3, 18, containers)).toBe(true);
  });

  it('allows close when open is inside child container', () => {
    const containers = [
      makeContainer('outer', 0, 20),
      makeContainer('inner', 5, 15, 'outer'),
    ];
    // Open at 7 (inside inner), close at 12 (inside inner)
    expect(canPlaceCloseNode(7, 12, containers)).toBe(true);
  });

  it('rejects close outside container when open is inside', () => {
    const containers = [
      makeContainer('outer', 0, 20),
      makeContainer('inner', 5, 15, 'outer'),
    ];
    // Open at 7 (inside inner), close at 18 (outside inner but inside outer)
    // This violates nesting: started inside inner, must close inside inner
    expect(canPlaceCloseNode(7, 18, containers)).toBe(false);
  });
});

describe('getValidCloseNodeSlots', () => {
  it('returns all slots after open with no containers', () => {
    const result = getValidCloseNodeSlots(2, [], [], 10);
    expect(result).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('limits to container boundary when open is inside', () => {
    const containers = [makeContainer('c1', 0, 8)];
    const result = getValidCloseNodeSlots(2, containers, [], 10);
    // Open is at 2 (inside c1), must close inside c1 (slots 3-8)
    expect(result).toEqual([3, 4, 5, 6, 7, 8]);
  });

  it('excludes slots inside child containers', () => {
    const containers = [
      makeContainer('outer', 0, 20),
      makeContainer('inner', 8, 12, 'outer'),
    ];
    // Open at 3 (in outer but before inner)
    const result = getValidCloseNodeSlots(3, containers, [], 20);
    // Can close at 4-7 (before inner), or 13-20 (after inner)
    // Cannot close at 8-12 (inside inner)
    expect(result).not.toContain(8);
    expect(result).not.toContain(9);
    expect(result).not.toContain(10);
    expect(result).not.toContain(11);
    expect(result).not.toContain(12);
    expect(result).toContain(4);
    expect(result).toContain(7);
    expect(result).toContain(13);
  });

  it('allows all slots in same container when open is inside child', () => {
    const containers = [
      makeContainer('outer', 0, 20),
      makeContainer('inner', 5, 15, 'outer'),
    ];
    // Open at 7 (inside inner)
    const result = getValidCloseNodeSlots(7, containers, [], 20);
    // Must close inside inner: 8-15
    expect(result).toEqual([8, 9, 10, 11, 12, 13, 14, 15]);
  });
});
