import type { NodeId, EdgeId, NodeState, EdgeState, VisualState, AlgorithmStep, AlgorithmSnapshot, AlgorithmData } from '../types';
import type { Graph } from '../graph';

export function createEmptyVisualState(): VisualState {
  return {
    nodeStates: new Map(),
    edgeStates: new Map(),
    nodeColors: new Map(),
    highlightedNode: null,
    highlightedEdge: null
  };
}

export function cloneVisualState(vs: VisualState): VisualState {
  return {
    nodeStates: new Map(vs.nodeStates),
    edgeStates: new Map(vs.edgeStates),
    nodeColors: new Map(vs.nodeColors),
    highlightedNode: vs.highlightedNode,
    highlightedEdge: vs.highlightedEdge
  };
}

export function setNodeState(vs: VisualState, nodeId: NodeId, state: NodeState): void {
  vs.nodeStates.set(nodeId, state);
}

export function setEdgeState(vs: VisualState, edgeId: EdgeId, state: EdgeState): void {
  vs.edgeStates.set(edgeId, state);
}

export class StepBuilder {
  private steps: AlgorithmStep[] = [];
  private currentVS: VisualState;
  private currentData: AlgorithmData;

  constructor() {
    this.currentVS = createEmptyVisualState();
    this.currentData = {};
  }

  setState(updater: (vs: VisualState, data: AlgorithmData) => void): void {
    updater(this.currentVS, this.currentData);
  }

  addStep(description: string): void {
    const snapshot: AlgorithmSnapshot = {
      visualState: cloneVisualState(this.currentVS),
      data: JSON.parse(JSON.stringify(this.currentData))
    };
    this.steps.push({ description, snapshot });
  }

  getSteps(): AlgorithmStep[] {
    return this.steps;
  }
}

export const COMPONENT_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
  '#F7DC6F', '#BB8FCE', '#85C1E9', '#F1948A', '#82E0AA',
  '#F0B27A', '#AED6F1', '#D2B4DE', '#A9DFBF', '#FADBD8'
];
