export type MiceType = 'milieu' | 'idea' | 'character' | 'event';
export type NodeRole = 'open' | 'close';

export interface Container {
  id: string;
  parentId: string | null;
  title: string;
  description: string;
  startPosition: number;
  endPosition: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoryNode {
  id: string;
  containerId: string;
  threadId: string;
  type: MiceType;
  role: NodeRole;
  position: number;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface Thread {
  id: string;
  type: MiceType;
  openNode: StoryNode;
  closeNode: StoryNode;
}

export const MICE_COLORS: Record<MiceType, string> = {
  milieu: '#3b82f6',    // Blue
  idea: '#22c55e',      // Green
  character: '#f97316', // Orange
  event: '#ef4444',     // Red
};

export const MICE_LABELS: Record<MiceType, string> = {
  milieu: 'M',
  idea: 'I',
  character: 'C',
  event: 'E',
};
