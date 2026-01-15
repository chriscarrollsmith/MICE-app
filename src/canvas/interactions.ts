import type { Container, StoryNode, MiceType } from '../lib/types';
import {
  isInContainerZone,
  isInNodeZone,
  getTimelinePosition,
  findContainerAtSlot,
  findParentContainer,
  canCreateContainer,
  findNodeAtPosition,
  getSlotFromX,
} from './hitDetection';
import { getTotalSlots } from '../lib/slots';

export type InteractionState =
  | { mode: 'idle' }
  | { mode: 'placing-container-end'; startSlot: number; parentId: string | null }
  | { mode: 'placing-node-close'; type: MiceType; startSlot: number; containerId: string | null; tempOpenNodeId?: string }
  | { mode: 'editing'; target: { type: 'container' | 'node'; id: string } };

export interface InteractionCallbacks {
  onContainerCreate: (startSlot: number, endSlot: number, parentId: string | null) => Promise<void>;
  onNodeCreate: (containerId: string | null, type: MiceType, openSlot: number, closeSlot: number) => Promise<void>;
  onThreadComplete: (openNodeId: string, closeSlot: number) => Promise<void>;
  onNodeCancel: (nodeId: string) => Promise<void>;
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

  private getTotalSlots(): number {
    return getTotalSlots(this.callbacks.getContainers(), this.callbacks.getNodes());
  }

  handleMouseMove(x: number, y: number): void {
    this.mousePosition = { x, y };
  }

  handleClick(x: number, y: number): void {
    const totalSlots = this.getTotalSlots();
    // Use at least 2 slots for position calculation so different click positions map to different slots
    const slot = getSlotFromX(x, this.canvasWidth, Math.max(2, totalSlots));
    const containers = this.callbacks.getContainers();

    switch (this.state.mode) {
      case 'idle':
        this.handleIdleClick(x, y, slot, containers);
        break;

      case 'placing-container-end':
        this.handleContainerCreationClick(slot, containers);
        break;

      case 'placing-node-close':
        this.handleNodeCreationClick(slot);
        break;

      case 'editing':
        // Click elsewhere to deselect, or click on something else to select it
        this.handleIdleClick(x, y, slot, containers);
        break;
    }
  }

  private handleIdleClick(x: number, y: number, slot: number, containers: Container[]): void {
    const nodes = this.callbacks.getNodes();
    const totalSlots = this.getTotalSlots();

    // Check if clicking on a node (highest priority)
    const clickedNode = findNodeAtPosition(x, y, nodes, this.canvasWidth, this.canvasHeight, totalSlots);
    if (clickedNode) {
      this.selectElement('node', clickedNode.id);
      return;
    }

    // Check if clicking in container zone
    if (isInContainerZone(y, this.canvasHeight)) {
      // Check if clicking on a container
      const container = findContainerAtSlot(slot, containers);
      if (container) {
        // For now, start container creation (could also select container)
        this.setState({
          mode: 'placing-container-end',
          startSlot: slot,
          parentId: container.id,
        });
      } else {
        // Start new top-level container creation
        this.setState({
          mode: 'placing-container-end',
          startSlot: slot,
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

  private async handleContainerCreationClick(slot: number, containers: Container[]): Promise<void> {
    if (this.state.mode !== 'placing-container-end') return;

    const startSlot = Math.min(this.state.startSlot, slot);
    const endSlot = Math.max(this.state.startSlot, slot);

    // Validate: must have some width
    if (endSlot <= startSlot) {
      // Too small, cancel
      this.setState({ mode: 'idle' });
      return;
    }

    // Validate: no partial overlaps
    if (!canCreateContainer(startSlot, endSlot, containers)) {
      // Invalid placement, cancel
      this.setState({ mode: 'idle' });
      return;
    }

    // Find the correct parent (smallest container that fully contains this range)
    const parent = findParentContainer(startSlot, endSlot, containers);

    // Create the container
    await this.callbacks.onContainerCreate(startSlot, endSlot, parent?.id || null);
    this.setState({ mode: 'idle' });
  }

  private async handleNodeCreationClick(slot: number): Promise<void> {
    if (this.state.mode !== 'placing-node-close') return;

    const { startSlot, tempOpenNodeId } = this.state;

    // Validate: close slot must be after open slot
    if (slot <= startSlot) {
      // Invalid, cancel and remove the temp open node
      if (tempOpenNodeId) {
        await this.callbacks.onNodeCancel(tempOpenNodeId);
      }
      this.setState({ mode: 'idle' });
      return;
    }

    // Complete the thread by adding the close node
    if (tempOpenNodeId) {
      await this.callbacks.onThreadComplete(tempOpenNodeId, slot);
    }
    this.setState({ mode: 'idle' });
  }

  async handleKeyDown(key: string): Promise<void> {
    if (key === 'Escape') {
      // Cancel any in-progress creation
      if (this.state.mode === 'placing-container-end') {
        this.setState({ mode: 'idle' });
      } else if (this.state.mode === 'placing-node-close') {
        // Cancel and remove the temp open node
        const { tempOpenNodeId } = this.state;
        if (tempOpenNodeId) {
          await this.callbacks.onNodeCancel(tempOpenNodeId);
        }
        this.setState({ mode: 'idle' });
      } else if (this.state.mode === 'editing') {
        this.callbacks.onDeselect();
        this.setState({ mode: 'idle' });
      }
    }
  }

  // Start node creation (called from MICE type selector)
  startNodeCreation(type: MiceType, slot: number, containerId: string | null, tempOpenNodeId?: string): void {
    this.setState({
      mode: 'placing-node-close',
      type,
      startSlot: slot,
      containerId,
      tempOpenNodeId,
    });
  }

  // Select an element for editing
  selectElement(type: 'container' | 'node', id: string): void {
    this.setState({ mode: 'editing', target: { type, id } });
    this.callbacks.onSelect(type, id);
  }
}
