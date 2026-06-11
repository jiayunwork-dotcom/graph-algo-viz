import type { NodeId, EdgeId, GraphNode, GraphEdge, GraphSettings, GraphMode } from './types';

export class Graph {
  private nodes: Map<NodeId, GraphNode> = new Map();
  private edges: Map<EdgeId, GraphEdge> = new Map();
  private adjacency: Map<NodeId, Set<EdgeId>> = new Map();
  private nextNodeId: NodeId = 1;
  public settings: GraphSettings = {
    mode: 'undirected',
    isWeighted: false,
    isDirected: false,
    isFlow: false
  };

  constructor() {}

  static edgeId(source: NodeId, target: NodeId, directed: boolean): EdgeId {
    if (directed) {
      return `${source}->${target}`;
    }
    return source < target ? `${source}-${target}` : `${target}-${source}`;
  }

  getNode(id: NodeId): GraphNode | undefined {
    return this.nodes.get(id);
  }

  getEdge(id: EdgeId): GraphEdge | undefined {
    return this.edges.get(id);
  }

  getEdgeByNodes(source: NodeId, target: NodeId): GraphEdge | undefined {
    const id = Graph.edgeId(source, target, this.settings.isDirected);
    return this.edges.get(id);
  }

  getAllNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }

  getAllEdges(): GraphEdge[] {
    return Array.from(this.edges.values());
  }

  getNodeCount(): number {
    return this.nodes.size;
  }

  getEdgeCount(): number {
    return this.edges.size;
  }

  getNeighbors(nodeId: NodeId): GraphNode[] {
    const edgeIds = this.adjacency.get(nodeId);
    if (!edgeIds) return [];
    const neighbors: GraphNode[] = [];
    edgeIds.forEach(eid => {
      const edge = this.edges.get(eid);
      if (!edge) return;
      if (edge.source === nodeId) {
        const n = this.nodes.get(edge.target);
        if (n) neighbors.push(n);
      } else if (!this.settings.isDirected) {
        const n = this.nodes.get(edge.source);
        if (n) neighbors.push(n);
      }
    });
    return neighbors;
  }

  getIncidentEdges(nodeId: NodeId): GraphEdge[] {
    const edgeIds = this.adjacency.get(nodeId);
    if (!edgeIds) return [];
    const result: GraphEdge[] = [];
    edgeIds.forEach(eid => {
      const edge = this.edges.get(eid);
      if (edge) result.push(edge);
    });
    return result;
  }

  getOutgoingEdges(nodeId: NodeId): GraphEdge[] {
    const edgeIds = this.adjacency.get(nodeId);
    if (!edgeIds) return [];
    const result: GraphEdge[] = [];
    edgeIds.forEach(eid => {
      const edge = this.edges.get(eid);
      if (edge && edge.source === nodeId) result.push(edge);
    });
    return result;
  }

  getIncomingEdges(nodeId: NodeId): GraphEdge[] {
    const edgeIds = this.adjacency.get(nodeId);
    if (!edgeIds) return [];
    const result: GraphEdge[] = [];
    edgeIds.forEach(eid => {
      const edge = this.edges.get(eid);
      if (edge && edge.target === nodeId) result.push(edge);
    });
    return result;
  }

  addNode(x: number, y: number, label?: string): GraphNode {
    const id = this.nextNodeId++;
    const node: GraphNode = {
      id,
      label: label ?? String(id),
      x,
      y,
      fixed: false
    };
    this.nodes.set(id, node);
    this.adjacency.set(id, new Set());
    return node;
  }

  addNodeWithId(id: NodeId, x: number, y: number, label?: string): GraphNode {
    if (this.nodes.has(id)) {
      throw new Error(`Node ${id} already exists`);
    }
    if (id >= this.nextNodeId) {
      this.nextNodeId = id + 1;
    }
    const node: GraphNode = {
      id,
      label: label ?? String(id),
      x,
      y,
      fixed: false
    };
    this.nodes.set(id, node);
    this.adjacency.set(id, new Set());
    return node;
  }

  addEdge(source: NodeId, target: NodeId, weight: number = 1): GraphEdge | null {
    if (!this.nodes.has(source) || !this.nodes.has(target)) return null;
    if (source === target) return null;
    const id = Graph.edgeId(source, target, this.settings.isDirected);
    if (this.edges.has(id)) return null;
    const edge: GraphEdge = {
      id,
      source,
      target,
      weight,
      directed: this.settings.isDirected,
      capacity: this.settings.isFlow ? weight : undefined,
      flow: this.settings.isFlow ? 0 : undefined
    };
    this.edges.set(id, edge);
    this.adjacency.get(source)!.add(id);
    this.adjacency.get(target)!.add(id);
    return edge;
  }

  removeNode(id: NodeId): boolean {
    if (!this.nodes.has(id)) return false;
    const incidentEdges = this.adjacency.get(id) || new Set();
    incidentEdges.forEach(eid => {
      const edge = this.edges.get(eid);
      if (edge) {
        this.adjacency.get(edge.source)?.delete(eid);
        this.adjacency.get(edge.target)?.delete(eid);
        this.edges.delete(eid);
      }
    });
    this.adjacency.delete(id);
    this.nodes.delete(id);
    return true;
  }

  removeEdge(id: EdgeId): boolean {
    const edge = this.edges.get(id);
    if (!edge) return false;
    this.adjacency.get(edge.source)?.delete(id);
    this.adjacency.get(edge.target)?.delete(id);
    this.edges.delete(id);
    return true;
  }

  updateNodePosition(id: NodeId, x: number, y: number): void {
    const node = this.nodes.get(id);
    if (node) {
      node.x = x;
      node.y = y;
    }
  }

  setNodeFixed(id: NodeId, fixed: boolean): void {
    const node = this.nodes.get(id);
    if (node) {
      node.fixed = fixed;
    }
  }

  setNodeLabel(id: NodeId, label: string): void {
    const node = this.nodes.get(id);
    if (node) {
      node.label = label;
    }
  }

  setEdgeWeight(id: EdgeId, weight: number): void {
    const edge = this.edges.get(id);
    if (edge) {
      edge.weight = weight;
      if (this.settings.isFlow) {
        edge.capacity = weight;
      }
    }
  }

  setMode(mode: GraphMode): void {
    this.settings.mode = mode;
    this.settings.isDirected = mode === 'directed' || mode === 'weighted-directed' || mode === 'flow';
    this.settings.isWeighted = mode === 'weighted' || mode === 'weighted-directed' || mode === 'flow';
    this.settings.isFlow = mode === 'flow';
    this.edges.forEach(edge => {
      edge.directed = this.settings.isDirected;
      if (this.settings.isFlow) {
        edge.capacity = edge.weight;
        if (edge.flow === undefined) edge.flow = 0;
      }
    });
  }

  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.adjacency.clear();
    this.nextNodeId = 1;
  }

  clone(): Graph {
    const g = new Graph();
    g.settings = { ...this.settings };
    g.nextNodeId = this.nextNodeId;
    this.nodes.forEach(node => {
      g.nodes.set(node.id, { ...node });
      g.adjacency.set(node.id, new Set());
    });
    this.edges.forEach(edge => {
      const newEdge = { ...edge };
      g.edges.set(edge.id, newEdge);
      g.adjacency.get(edge.source)!.add(edge.id);
      g.adjacency.get(edge.target)!.add(edge.id);
    });
    return g;
  }

  toJSON() {
    return {
      settings: this.settings,
      nextNodeId: this.nextNodeId,
      nodes: this.getAllNodes(),
      edges: this.getAllEdges()
    };
  }

  static fromJSON(data: any): Graph {
    const g = new Graph();
    g.settings = data.settings || g.settings;
    g.nextNodeId = data.nextNodeId || 1;
    (data.nodes || []).forEach((n: GraphNode) => {
      g.nodes.set(n.id, { ...n });
      g.adjacency.set(n.id, new Set());
    });
    (data.edges || []).forEach((e: GraphEdge) => {
      g.edges.set(e.id, { ...e });
      g.adjacency.get(e.source)!.add(e.id);
      g.adjacency.get(e.target)!.add(e.id);
    });
    return g;
  }
}
