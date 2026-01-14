import type { Container, StoryNode, MiceType } from '../lib/types';
import {
  isInContainerZone,
  isInNodeZone,
  getTimelinePosition,
  findContainerAtPosition,
  findParentContainer,
  canCreateContainer,
  findNodeAtPosition,
} from './hitDetection';

export type InteractionState =
  | { mode: 'idle' }
  | { mode: 'creating-container'; startPosition: number; parentId: string | null }
  | { mode: 'creating-node'; type: MiceType; openPosition: number; containerId: string; tempOpenNodeId?: string }
  | { mode: 'editing'; target: { type: 'container' | 'node'; id: string } };

export interface InteractionCallbacks {
  onContainerCreate: (startPos: number, endPos: number, parentId: string | null) => Promise<void>;
  onNodeCreate: (containerId: string, type: MiceType, openPos: number, closePos: number) => Promise<void>;
  onSelect: (type: 'container' | 'node', id: string) => void;
  onDeselect: () => void;
  onStateChange: (state: InteractionState) => void;
  getContainers: () => Container[];
  getNodes: () => StoryNode[];
}

export class InteractionManager {
  private state: InteractionState = { mode: 'idle' };
  private callbacks: InteractionCallbacks;
  private canvasWidth: number = 0;
  private canvasHeight: number = 0;
  private mousePosition: { x: number; y: number } | null = null;

  constructor(callbacks: InteractionCallbacks) {
    this.callbacks = callbacks;
  }

  updateCanvasSize(width: number, height: number): void {
    this.canvasWidth = width;
    this.canvasHeight = height;
  }

  getState(): InteractionState {
    return this.state;
  }

  getMousePosition(): { x: number; y: number } | null {
    return this.mousePosition;
  }

  private setState(newState: InteractionState): void {
    this.state = newState;
    this.callbacks.onStateChange(newState);
  }

  handleMouseMove(x: number, y: number): void {
    this.mousePosition = { x, y };
  }

  handleClick(x: number, y: number): void {
    const position = getTimelinePosition(x, this.canvasWidth);
    const containers = this.callbacks.getContainers();

    switch (this.state.mode) {
      case 'idle':
        this.handleIdleClick(x, y, position, containers);
        break;

      case 'creating-container':
        this.handleContainerCreationClick(position, containers);
        break;

      case 'creating-node':
        this.handleNodeCreationClick(position);
        break;

      case 'editing':
        // Click elsewhere to deselect, or click on something else to select it
        this.handleIdleClick(x, y, position, containers);
        break;
    }
  }

  private handleIdleClick(x: number, y: number, position: number, containers: Container[]): void {
    const nodes = this.callbacks.getNodes();

    // Check if clicking on a node (highest priority)
    const clickedNode = findNodeAtPosition(x, y, nodes, this.canvasWidth, this.canvasHeight);
    if (clickedNode) {
      this.selectElement('node', clickedNode.id);
      return;
    }

    // Check if clicking in container zone
    if (isInContainerZone(y, this.canvasHeight)) {
      // Check if clicking on a container
      const container = findContainerAtPosition(position, containers);
      if (container) {
        // For now, start container creation (could also select container)
        this.setState({
          mode: 'creating-container',
          startPosition: position,
          parentId: container.id,
        });
      } else {
        // Start new top-level container creation
        this.setState({
          mode: 'creating-container',
          startPosition: position,
          parentId: null,
        });
      }
      return;
    }

    // Check if clicking in node zone (but not on a node)
    if (isInNodeZone(y, this.canvasHeight)) {
      // Deselect any current selection
      this.callbacks.onDeselect();
      this.setState({ mode: 'idle' });
    }
  }

  private async handleContainerCreationClick(position: number, containers: Container[]): Promise<void> {
    if (this.state.mode !== 'creating-container') return;

    const startPos = Math.min(this.state.startPosition, position);
    const endPos = Math.max(this.state.startPosition, position);

    // Validate: must have some width
    if (endPos - startPos < 0.02) {
      // Too small, cancel
      this.setState({ mode: 'idle' });
      return;
    }

    // Validate: no partial overlaps
    if (!canCreateContainer(startPos, endPos, containers)) {
      // Invalid placement, cancel
      this.setState({ mode: 'idle' });
      return;
    }

    // Find the correct parent (smallest container that fully contains this range)
    const parent = findParentContainer(startPos, endPos, containers);

    // Create the container
    await this.callbacks.onContainerCreate(startPos, endPos, parent?.id || null);
    this.setState({ mode: 'idle' });
  }

  private async handleNodeCreationClick(position: number): Promise<void> {
    if (this.state.mode !== 'creating-node') return;

    const { type, openPosition, containerId } = this.state;

    // Validate: close position must be after open position
    if (position <= openPosition) {
      // Invalid, cancel
      this.setState({ mode: 'idle' });
      return;
    }

    // Create the thread
    await this.callbacks.onNodeCreate(containerId, type, openPosition, position);
    this.setState({ mode: 'idle' });
  }

  handleKeyDown(key: string): void {
    if (key === 'Escape') {
      // Cancel any in-progress creation
      if (this.state.mode === 'creating-container' || this.state.mode === 'creating-node') {
        this.setState({ mode: 'idle' });
      } else if (this.state.mode === 'editing') {
        this.callbacks.onDeselect();
        this.setState({ mode: 'idle' });
      }
    }
  }

  // Start node creation (called from MICE type selector)
  startNodeCreation(type: MiceType, position: number, containerId: string): void {
    this.setState({
      mode: 'creating-node',
      type,
      openPosition: position,
      containerId,
    });
  }

  // Select an element for editing
  selectElement(type: 'container' | 'node', id: string): void {
    this.setState({ mode: 'editing', target: { type, id } });
    this.callbacks.onSelect(type, id);
  }
}
