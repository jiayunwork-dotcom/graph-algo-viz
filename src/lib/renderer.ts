import type { Graph } from './graph';
import type { GraphNode, GraphEdge, VisualState, NodeState, EdgeState, NodeId, EdgeId } from './types';
import { COMPONENT_COLORS } from './algorithms/step-builder';

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface RenderConfig {
  nodeRadius: number;
  showLabels: boolean;
  showWeights: boolean;
  showEdgeDirections: boolean;
  showFlow: boolean;
}

const COLORS = {
  background: '#fafafa',
  grid: '#e5e7eb',
  node: {
    default: '#e0e7ff',
    border: '#6366f1',
    visited: '#bbf7d0',
    current: '#fbbf24',
    inQueue: '#bfdbfe',
    inStack: '#fbcfe8',
    finished: '#86efac',
    inTree: '#6ee7b7',
    inCut: '#f87171',
    inComponent: '#a7f3d0'
  },
  edge: {
    default: '#9ca3af',
    active: '#f59e0b',
    visited: '#6b7280',
    inTree: '#22c55e',
    inCut: '#dc2626',
    relaxed: '#f97316',
    negative: '#ef4444',
    inComponent: '#10b981'
  },
  text: '#1f2937',
  highlight: '#3b82f6'
};

function getNodeColor(node: GraphNode, state: NodeState | undefined, customColor?: string): string {
  if (customColor) return customColor;
  switch (state) {
    case 'visited': return COLORS.node.visited;
    case 'current': return COLORS.node.current;
    case 'in-queue': return COLORS.node.inQueue;
    case 'in-stack': return COLORS.node.inStack;
    case 'finished': return COLORS.node.finished;
    case 'in-tree': return COLORS.node.inTree;
    case 'in-cut': return COLORS.node.inCut;
    case 'in-component': return COLORS.node.inComponent;
    default: return COLORS.node.default;
  }
}

function getEdgeColor(state: EdgeState | undefined): string {
  switch (state) {
    case 'active': return COLORS.edge.active;
    case 'visited': return COLORS.edge.visited;
    case 'in-tree': return COLORS.edge.inTree;
    case 'in-cut': return COLORS.edge.inCut;
    case 'relaxed': return COLORS.edge.relaxed;
    case 'negative': return COLORS.edge.negative;
    case 'in-component': return COLORS.edge.inComponent;
    default: return COLORS.edge.default;
  }
}

function getEdgeWidth(state: EdgeState | undefined): number {
  switch (state) {
    case 'active':
    case 'in-tree':
    case 'in-cut':
    case 'relaxed':
    case 'negative':
      return 4;
    default: return 2;
  }
}

export class GraphCanvasRenderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  public camera: Camera = { x: 0, y: 0, zoom: 1 };
  public config: RenderConfig = {
    nodeRadius: 24,
    showLabels: true,
    showWeights: true,
    showEdgeDirections: true,
    showFlow: false
  };

  private nodeRadiusSquared: number = 24 * 24;
  private viewportMargin: number = 100;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;
  }

  resize(width: number, height: number): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return {
      x: (wx - this.camera.x) * this.camera.zoom + this.canvas.clientWidth / 2,
      y: (wy - this.camera.y) * this.camera.zoom + this.canvas.clientHeight / 2
    };
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - this.canvas.clientWidth / 2) / this.camera.zoom + this.camera.x,
      y: (sy - this.canvas.clientHeight / 2) / this.camera.zoom + this.camera.y
    };
  }

  private getViewportBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const margin = this.viewportMargin / this.camera.zoom;
    const topLeft = this.screenToWorld(-margin, -margin);
    const bottomRight = this.screenToWorld(w + margin, h + margin);
    return {
      minX: Math.min(topLeft.x, bottomRight.x),
      maxX: Math.max(topLeft.x, bottomRight.x),
      minY: Math.min(topLeft.y, bottomRight.y),
      maxY: Math.max(topLeft.y, bottomRight.y)
    };
  }

  private isNodeInViewport(node: GraphNode, bounds: { minX: number; maxX: number; minY: number; maxY: number }): boolean {
    const r = this.config.nodeRadius * 2;
    return node.x >= bounds.minX - r && node.x <= bounds.maxX + r &&
           node.y >= bounds.minY - r && node.y <= bounds.maxY + r;
  }

  clear(): void {
    const ctx = this.ctx;
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
    this.drawGrid();
  }

  private drawGrid(): void {
    const ctx = this.ctx;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const gridSize = 40 * this.camera.zoom;

    if (gridSize < 10) return;

    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 0.5;

    const offsetX = (w / 2 - this.camera.x * this.camera.zoom) % gridSize;
    const offsetY = (h / 2 - this.camera.y * this.camera.zoom) % gridSize;

    ctx.beginPath();
    for (let x = offsetX; x < w; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = offsetY; y < h; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();
  }

  render(graph: Graph, visualState?: VisualState, selected?: { node?: NodeId; edge?: EdgeId }, hovered?: { node?: NodeId; edge?: EdgeId }, edgeCreating?: { from: NodeId; toScreenX: number; toScreenY: number }): void {
    this.clear();

    const ctx = this.ctx;
    const edges = graph.getAllEdges();
    const nodes = graph.getAllNodes();
    const nodeCount = nodes.length;

    const useOptimizedRender = nodeCount > 50;
    const showLabels = this.config.showLabels && (!useOptimizedRender || this.camera.zoom > 0.7);
    const showWeights = this.config.showWeights && (!useOptimizedRender || this.camera.zoom > 0.8);
    const enableShadows = !useOptimizedRender || this.camera.zoom > 0.9;

    const viewport = useOptimizedRender ? this.getViewportBounds() : null;

    const visibleNodeIds = new Set<NodeId>();
    if (viewport) {
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (this.isNodeInViewport(node, viewport)) {
          visibleNodeIds.add(node.id);
        }
      }
    }

    ctx.lineCap = 'round';

    if (useOptimizedRender) {
      this.drawEdgesOptimized(ctx, edges, graph, visualState, selected, hovered, visibleNodeIds, showWeights, enableShadows);
    } else {
      this.drawEdgesNormal(ctx, edges, graph, visualState, selected, hovered, showWeights, enableShadows);
    }

    if (edgeCreating) {
      const fromNode = graph.getNode(edgeCreating.from);
      if (fromNode) {
        const from = this.worldToScreen(fromNode.x, fromNode.y);
        ctx.strokeStyle = COLORS.highlight;
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(edgeCreating.toScreenX, edgeCreating.toScreenY);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    if (useOptimizedRender) {
      this.drawNodesOptimized(ctx, nodes, visualState, selected, hovered, visibleNodeIds, showLabels, enableShadows);
    } else {
      this.drawNodesNormal(ctx, nodes, visualState, selected, hovered, showLabels, enableShadows);
    }
  }

  private drawEdgesNormal(
    ctx: CanvasRenderingContext2D,
    edges: GraphEdge[],
    graph: Graph,
    visualState: VisualState | undefined,
    selected: { node?: NodeId; edge?: EdgeId } | undefined,
    hovered: { node?: NodeId; edge?: EdgeId } | undefined,
    showWeights: boolean,
    enableShadows: boolean
  ): void {
    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      const source = graph.getNode(edge.source);
      const target = graph.getNode(edge.target);
      if (!source || !target) continue;

      const edgeState = visualState?.edgeStates.get(edge.id);
      const isSelected = selected?.edge === edge.id;
      const isHovered = hovered?.edge === edge.id;

      this.drawEdge(ctx, edge, source, target, edgeState, isSelected, isHovered, visualState, showWeights, enableShadows);
    }
  }

  private drawEdgesOptimized(
    ctx: CanvasRenderingContext2D,
    edges: GraphEdge[],
    graph: Graph,
    visualState: VisualState | undefined,
    selected: { node?: NodeId; edge?: EdgeId } | undefined,
    hovered: { node?: NodeId; edge?: EdgeId } | undefined,
    visibleNodeIds: Set<NodeId>,
    showWeights: boolean,
    enableShadows: boolean
  ): void {
    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      if (!visibleNodeIds.has(edge.source) && !visibleNodeIds.has(edge.target)) {
        const edgeState = visualState?.edgeStates.get(edge.id);
        if (!edgeState || edgeState === 'default') continue;
      }

      const source = graph.getNode(edge.source);
      const target = graph.getNode(edge.target);
      if (!source || !target) continue;

      const edgeState = visualState?.edgeStates.get(edge.id);
      const isSelected = selected?.edge === edge.id;
      const isHovered = hovered?.edge === edge.id;

      this.drawEdge(ctx, edge, source, target, edgeState, isSelected, isHovered, visualState, showWeights, enableShadows);
    }
  }

  private drawNodesNormal(
    ctx: CanvasRenderingContext2D,
    nodes: GraphNode[],
    visualState: VisualState | undefined,
    selected: { node?: NodeId; edge?: EdgeId } | undefined,
    hovered: { node?: NodeId; edge?: EdgeId } | undefined,
    showLabels: boolean,
    enableShadows: boolean
  ): void {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const nodeState = visualState?.nodeStates.get(node.id);
      const customColor = visualState?.nodeColors.get(node.id);
      const isSelected = selected?.node === node.id;
      const isHovered = hovered?.node === node.id;
      const isHighlighted = visualState?.highlightedNode === node.id;

      this.drawNode(ctx, node, nodeState, customColor, isSelected, isHovered, isHighlighted, node.fixed, showLabels, enableShadows);
    }
  }

  private drawNodesOptimized(
    ctx: CanvasRenderingContext2D,
    nodes: GraphNode[],
    visualState: VisualState | undefined,
    selected: { node?: NodeId; edge?: EdgeId } | undefined,
    hovered: { node?: NodeId; edge?: EdgeId } | undefined,
    visibleNodeIds: Set<NodeId>,
    showLabels: boolean,
    enableShadows: boolean
  ): void {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (!visibleNodeIds.has(node.id)) {
        const nodeState = visualState?.nodeStates.get(node.id);
        if (!nodeState || nodeState === 'default') continue;
      }

      const nodeState = visualState?.nodeStates.get(node.id);
      const customColor = visualState?.nodeColors.get(node.id);
      const isSelected = selected?.node === node.id;
      const isHovered = hovered?.node === node.id;
      const isHighlighted = visualState?.highlightedNode === node.id;

      this.drawNode(ctx, node, nodeState, customColor, isSelected, isHovered, isHighlighted, node.fixed, showLabels, enableShadows);
    }
  }

  private drawNode(
    ctx: CanvasRenderingContext2D,
    node: GraphNode,
    state: NodeState | undefined,
    customColor: string | undefined,
    isSelected: boolean,
    isHovered: boolean,
    isHighlighted: boolean,
    isFixed: boolean,
    showLabels: boolean,
    enableShadows: boolean
  ): void {
    const pos = this.worldToScreen(node.x, node.y);
    const r = this.config.nodeRadius * this.camera.zoom;
    const effectiveR = r + (isHovered ? 4 : 0);

    ctx.save();

    if (enableShadows && isHighlighted) {
      ctx.shadowColor = COLORS.highlight;
      ctx.shadowBlur = 15;
    }

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, effectiveR, 0, Math.PI * 2);
    ctx.fillStyle = getNodeColor(node, state, customColor);
    ctx.fill();

    ctx.lineWidth = isSelected ? 4 : 2;
    ctx.strokeStyle = isSelected ? COLORS.highlight : COLORS.node.border;
    ctx.stroke();

    if (isFixed) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r * 0.7, 0, Math.PI * 2);
      ctx.strokeStyle = '#6b7280';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.shadowBlur = 0;

    if (showLabels && r >= 8) {
      ctx.fillStyle = COLORS.text;
      const fontSize = Math.max(9, Math.min(14, 14 * this.camera.zoom));
      ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = node.label.length > 4 ? node.label.slice(0, 3) + '…' : node.label;
      ctx.fillText(label, pos.x, pos.y);
    }

    ctx.restore();
  }

  private drawEdge(
    ctx: CanvasRenderingContext2D,
    edge: GraphEdge,
    source: GraphNode,
    target: GraphNode,
    state: EdgeState | undefined,
    isSelected: boolean,
    isHovered: boolean,
    vs: VisualState | undefined,
    showWeights: boolean,
    enableShadows: boolean
  ): void {
    const s = this.worldToScreen(source.x, source.y);
    const t = this.worldToScreen(target.x, target.y);
    const r = this.config.nodeRadius * this.camera.zoom;

    const dx = t.x - s.x;
    const dy = t.y - s.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;

    const ux = dx / len;
    const uy = dy / len;

    const sx = s.x + ux * r;
    const sy = s.y + uy * r;
    const ex = t.x - ux * r;
    const ey = t.y - uy * r;

    const midX = (sx + ex) / 2;
    const midY = (sy + ey) / 2;

    const offset = isHovered || isSelected ? 2 : 0;
    const lineWidth = getEdgeWidth(state) + offset;
    const isHighlighted = vs?.highlightedEdge === edge.id;

    ctx.save();

    if (enableShadows && isHighlighted) {
      ctx.shadowColor = getEdgeColor(state);
      ctx.shadowBlur = 12;
    }

    ctx.strokeStyle = isSelected ? COLORS.highlight : getEdgeColor(state);
    ctx.lineWidth = lineWidth;

    if (!edge.directed || source.id === target.id) {
      if (source.id !== target.id) {
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      if (this.config.showEdgeDirections && r >= 8) {
        ctx.shadowBlur = 0;
        const arrowLen = Math.max(6, 12 * this.camera.zoom);
        const arrowAngle = Math.PI / 6;
        const angle = Math.atan2(ey - sy, ex - sx);

        ctx.fillStyle = isSelected ? COLORS.highlight : getEdgeColor(state);
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(
          ex - arrowLen * Math.cos(angle - arrowAngle),
          ey - arrowLen * Math.sin(angle - arrowAngle)
        );
        ctx.lineTo(
          ex - arrowLen * Math.cos(angle + arrowAngle),
          ey - arrowLen * Math.sin(angle + arrowAngle)
        );
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.shadowBlur = 0;

    if ((showWeights || this.config.showFlow) && r >= 10) {
      const offsetDist = 15;
      const perpX = -uy;
      const perpY = ux;
      const labelX = midX + perpX * offsetDist;
      const labelY = midY + perpY * offsetDist;

      let labelText = '';
      if (this.config.showFlow && edge.capacity !== undefined) {
        labelText = `${edge.flow || 0}/${edge.capacity}`;
      } else if (showWeights) {
        labelText = String(edge.weight);
      }

      if (labelText && source.id !== target.id) {
        const fontSize = Math.max(9, Math.min(12, 12 * this.camera.zoom));
        ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
        const metrics = ctx.measureText(labelText);
        const padding = 6;
        const boxW = metrics.width + padding * 2;
        const boxH = fontSize + padding;

        ctx.fillStyle = 'white';
        ctx.strokeStyle = getEdgeColor(state);
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        const radius = 4;
        ctx.moveTo(labelX - boxW / 2 + radius, labelY - boxH / 2);
        ctx.lineTo(labelX + boxW / 2 - radius, labelY - boxH / 2);
        ctx.quadraticCurveTo(labelX + boxW / 2, labelY - boxH / 2, labelX + boxW / 2, labelY - boxH / 2 + radius);
        ctx.lineTo(labelX + boxW / 2, labelY + boxH / 2 - radius);
        ctx.quadraticCurveTo(labelX + boxW / 2, labelY + boxH / 2, labelX + boxW / 2 - radius, labelY + boxH / 2);
        ctx.lineTo(labelX - boxW / 2 + radius, labelY + boxH / 2);
        ctx.quadraticCurveTo(labelX - boxW / 2, labelY + boxH / 2, labelX - boxW / 2, labelY + boxH / 2 - radius);
        ctx.lineTo(labelX - boxW / 2, labelY - boxH / 2 + radius);
        ctx.quadraticCurveTo(labelX - boxW / 2, labelY - boxH / 2, labelX - boxW / 2 + radius, labelY - boxH / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = COLORS.text;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, labelX, labelY + 1);
      }
    }

    ctx.restore();
  }

  hitTestNode(screenX: number, screenY: number, graph: Graph): GraphNode | null {
    const world = this.screenToWorld(screenX, screenY);
    const r = this.config.nodeRadius;
    const r2 = r * r;

    const nodes = graph.getAllNodes();
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const dx = world.x - node.x;
      const dy = world.y - node.y;
      if (dx * dx + dy * dy <= r2) {
        return node;
      }
    }
    return null;
  }

  hitTestEdge(screenX: number, screenY: number, graph: Graph): GraphEdge | null {
    const world = this.screenToWorld(screenX, screenY);
    const threshold = this.config.nodeRadius * 0.7;
    const t2 = threshold * threshold;

    const edges = graph.getAllEdges();
    for (let i = edges.length - 1; i >= 0; i--) {
      const edge = edges[i];
      const source = graph.getNode(edge.source);
      const target = graph.getNode(edge.target);
      if (!source || !target) continue;

      const ax = source.x;
      const ay = source.y;
      const bx = target.x;
      const by = target.y;
      const dx = bx - ax;
      const dy = by - ay;
      const len2 = dx * dx + dy * dy;
      if (len2 === 0) continue;

      let t = ((world.x - ax) * dx + (world.y - ay) * dy) / len2;
      t = Math.max(0, Math.min(1, t));

      const cx = ax + t * dx;
      const cy = ay + t * dy;
      const distX = world.x - cx;
      const distY = world.y - cy;

      if (distX * distX + distY * distY <= t2) {
        return edge;
      }
    }
    return null;
  }
}
