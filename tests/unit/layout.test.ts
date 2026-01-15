import { describe, it, expect } from 'vitest';
import {
  calculateLayout,
  getInsertHandlePositions,
  calculateContainerSegments,
  calculateArcPath,
  type LayoutConfig,
  type LayoutResult,
} from '../../src/lib/layout';
import type { Container, StoryNode } from '../../src/lib/types';

const defaultConfig: LayoutConfig = {
  viewportWidth: 600,
  minItemWidth: 60,
  rowHeight: 120,
  containerZoneHeight: 30,
  padding: 8,
};

describe('calculateLayout', () => {
  it('returns empty layout for 0 slots', () => {
    const result = calculateLayout(0, defaultConfig);
    expect(result.totalSlots).toBe(0);
    expect(result.itemsPerRow).toBeGreaterThan(0);
    expect(result.totalRows).toBe(0);
    expect(result.positions.size).toBe(0);
  });

  it('calculates items per row based on viewport and min width', () => {
    const result = calculateLayout(10, defaultConfig);
    // 600px / 60px minWidth = 10 items max per row
    expect(result.itemsPerRow).toBeLessThanOrEqual(10);
    expect(result.itemsPerRow).toBeGreaterThan(0);
  });

  it('wraps to multiple rows when slots exceed items per row', () => {
    const config = { ...defaultConfig, viewportWidth: 300, minItemWidth: 60 };
    // 300px / 60px = 5 items per row
    const result = calculateLayout(12, config);
    expect(result.itemsPerRow).toBe(5);
    expect(result.totalRows).toBe(3); // 5 + 5 + 2
  });

  it('calculates correct slot width', () => {
    const config = { ...defaultConfig, viewportWidth: 600, minItemWidth: 60 };
    const result = calculateLayout(6, config);
    // With 6 slots and enough width, each slot should be viewportWidth / 6
    expect(result.slotWidth).toBe(100);
  });

  it('generates position for each slot', () => {
    const result = calculateLayout(4, defaultConfig);
    expect(result.positions.size).toBe(4);
    expect(result.positions.get(0)).toBeDefined();
    expect(result.positions.get(3)).toBeDefined();
  });

  it('positions slots at center X of their slot width', () => {
    const config = { ...defaultConfig, viewportWidth: 400 };
    const result = calculateLayout(4, config);
    // Each slot is 100px wide, so centers at 50, 150, 250, 350
    expect(result.positions.get(0)?.x).toBe(50);
    expect(result.positions.get(1)?.x).toBe(150);
    expect(result.positions.get(2)?.x).toBe(250);
    expect(result.positions.get(3)?.x).toBe(350);
  });

  it('assigns correct row and column indices', () => {
    const config = { ...defaultConfig, viewportWidth: 200, minItemWidth: 60 };
    // 200 / 60 = 3 items per row (rounded down)
    const result = calculateLayout(7, config);

    // Row 0: slots 0, 1, 2
    expect(result.positions.get(0)?.row).toBe(0);
    expect(result.positions.get(0)?.column).toBe(0);
    expect(result.positions.get(2)?.row).toBe(0);
    expect(result.positions.get(2)?.column).toBe(2);

    // Row 1: slots 3, 4, 5
    expect(result.positions.get(3)?.row).toBe(1);
    expect(result.positions.get(3)?.column).toBe(0);

    // Row 2: slot 6
    expect(result.positions.get(6)?.row).toBe(2);
    expect(result.positions.get(6)?.column).toBe(0);
  });

  it('calculates Y position based on row and row height', () => {
    const config = { ...defaultConfig, viewportWidth: 200, minItemWidth: 60, rowHeight: 100 };
    const result = calculateLayout(7, config);

    // Center Y of each row = row * rowHeight + rowHeight / 2
    expect(result.positions.get(0)?.y).toBe(50);  // Row 0
    expect(result.positions.get(3)?.y).toBe(150); // Row 1
    expect(result.positions.get(6)?.y).toBe(250); // Row 2
  });
});

describe('getInsertHandlePositions', () => {
  it('returns positions at slot midpoints for empty timeline', () => {
    const result = getInsertHandlePositions(0, defaultConfig);
    // For empty timeline, show one handle at position 0
    expect(result.length).toBe(1);
    expect(result[0].slot).toBe(0);
  });

  it('returns n+1 insert positions for n slots', () => {
    const result = getInsertHandlePositions(3, defaultConfig);
    // Before slot 0, between 0-1, between 1-2, after slot 2
    expect(result.length).toBe(4);
  });

  it('positions handles between slot centers', () => {
    const config = { ...defaultConfig, viewportWidth: 400 };
    const result = getInsertHandlePositions(4, config);
    // Slots at 50, 150, 250, 350
    // Handles at 0, 100, 200, 300, 400
    expect(result[0].x).toBe(0);
    expect(result[1].x).toBe(100);
    expect(result[2].x).toBe(200);
    expect(result[3].x).toBe(300);
    expect(result[4].x).toBe(400);
  });

  it('handles wrap correctly at row boundaries', () => {
    const config = { ...defaultConfig, viewportWidth: 200, minItemWidth: 60 };
    // 3 items per row
    const result = getInsertHandlePositions(5, config);

    // Row 0 handles: before 0, between 0-1, between 1-2, after 2
    // Row 1 handles: before 3, between 3-4, after 4
    expect(result.filter(p => p.row === 0).length).toBe(4);
    expect(result.filter(p => p.row === 1).length).toBe(3);
  });
});

describe('calculateContainerSegments', () => {
  const makeContainer = (id: string, startSlot: number, endSlot: number, parentId: string | null = null): Container => ({
    id,
    parentId,
    title: '',
    startSlot,
    endSlot,
    createdAt: '',
    updatedAt: '',
  });

  it('returns single segment for container within one row', () => {
    const container = makeContainer('c1', 0, 2);
    const layout = calculateLayout(5, { ...defaultConfig, viewportWidth: 500 });
    const segments = calculateContainerSegments(container, layout, [container]);

    expect(segments.length).toBe(1);
    expect(segments[0].segmentType).toBe('single');
    expect(segments[0].row).toBe(0);
  });

  it('returns multiple segments for container spanning rows', () => {
    const config = { ...defaultConfig, viewportWidth: 180, minItemWidth: 60 };
    // 3 items per row
    const container = makeContainer('c1', 0, 5);
    const layout = calculateLayout(6, config);
    const segments = calculateContainerSegments(container, layout, [container]);

    // Slots 0-2 in row 0, slots 3-5 in row 1
    expect(segments.length).toBe(2);
    expect(segments[0].segmentType).toBe('first');
    expect(segments[0].row).toBe(0);
    expect(segments[1].segmentType).toBe('last');
    expect(segments[1].row).toBe(1);
  });

  it('returns first, middle, last segments for 3+ row container', () => {
    const config = { ...defaultConfig, viewportWidth: 180, minItemWidth: 60 };
    // 3 items per row
    const container = makeContainer('c1', 0, 8);
    const layout = calculateLayout(9, config);
    const segments = calculateContainerSegments(container, layout, [container]);

    expect(segments.length).toBe(3);
    expect(segments[0].segmentType).toBe('first');
    expect(segments[1].segmentType).toBe('middle');
    expect(segments[2].segmentType).toBe('last');
  });

  it('calculates nesting depth correctly', () => {
    const parent = makeContainer('p', 0, 9);
    const child = makeContainer('c', 2, 7, 'p');
    const layout = calculateLayout(10, defaultConfig);

    const parentSegments = calculateContainerSegments(parent, layout, [parent, child]);
    const childSegments = calculateContainerSegments(child, layout, [parent, child]);

    expect(parentSegments[0].nestingDepth).toBe(0);
    expect(childSegments[0].nestingDepth).toBe(1);
  });

  it('includes correct X coordinates for segment', () => {
    const config = { ...defaultConfig, viewportWidth: 400 };
    const container = makeContainer('c1', 1, 3);
    const layout = calculateLayout(4, config);
    const segments = calculateContainerSegments(container, layout, [container]);

    // Slot width = 100, slots at 50, 150, 250, 350
    // Container borders align to slot center positions
    expect(segments[0].startX).toBe(150);
    expect(segments[0].endX).toBe(350);
  });
});

describe('calculateArcPath', () => {
  const makeNode = (threadId: string, role: 'open' | 'close', slot: number, type: 'milieu' | 'idea' | 'character' | 'event' = 'character'): StoryNode => ({
    id: `${threadId}-${role}`,
    containerId: 'c1',
    threadId,
    type,
    role,
    slot,
    title: '',
    description: '',
    createdAt: '',
    updatedAt: '',
  });

  it('returns same-row segment for thread within one row', () => {
    const open = makeNode('t1', 'open', 1);
    const close = makeNode('t1', 'close', 3);
    const layout = calculateLayout(5, defaultConfig);

    const arc = calculateArcPath(open, close, layout);

    expect(arc.threadId).toBe('t1');
    expect(arc.segments.length).toBe(1);
    expect(arc.segments[0].type).toBe('same-row');
  });

  it('returns exit + entry segments for thread spanning two rows', () => {
    const config = { ...defaultConfig, viewportWidth: 180, minItemWidth: 60 };
    // 3 items per row
    const open = makeNode('t1', 'open', 1);
    const close = makeNode('t1', 'close', 4);
    const layout = calculateLayout(6, config);

    const arc = calculateArcPath(open, close, layout);

    expect(arc.segments.length).toBe(2);
    expect(arc.segments[0].type).toBe('exit');
    expect(arc.segments[1].type).toBe('entry');
  });

  it('returns exit + continuation + entry for thread spanning 3+ rows', () => {
    const config = { ...defaultConfig, viewportWidth: 180, minItemWidth: 60 };
    // 3 items per row
    const open = makeNode('t1', 'open', 1);
    const close = makeNode('t1', 'close', 7);
    const layout = calculateLayout(9, config);

    const arc = calculateArcPath(open, close, layout);

    // Row 0: exit, Row 1: continuation, Row 2: entry
    expect(arc.segments.length).toBe(3);
    expect(arc.segments[0].type).toBe('exit');
    expect(arc.segments[1].type).toBe('continuation');
    expect(arc.segments[2].type).toBe('entry');
  });

  it('includes correct color based on MICE type', () => {
    const open = makeNode('t1', 'open', 0, 'milieu');
    const close = makeNode('t1', 'close', 2, 'milieu');
    const layout = calculateLayout(3, defaultConfig);

    const arc = calculateArcPath(open, close, layout);

    // Milieu color should be a specific value (we'll verify it's not empty)
    expect(arc.color).toBeDefined();
    expect(arc.color.length).toBeGreaterThan(0);
  });

  it('calculates correct startX and endX for same-row segment', () => {
    const config = { ...defaultConfig, viewportWidth: 400 };
    const open = makeNode('t1', 'open', 1);
    const close = makeNode('t1', 'close', 3);
    const layout = calculateLayout(4, config);

    const arc = calculateArcPath(open, close, layout);
    const segment = arc.segments[0];

    if (segment.type === 'same-row') {
      // Slots at centers 50, 150, 250, 350
      expect(segment.startX).toBe(150);
      expect(segment.endX).toBe(350);
    }
  });
});
