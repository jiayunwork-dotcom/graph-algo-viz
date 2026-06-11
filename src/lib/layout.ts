import type { Graph } from './graph';
import type { NodeId, GraphNode } from './types';

export type LayoutType = 'force' | 'hierarchy' | 'circular';

export function applyCircularLayout(graph: Graph, cx: number, cy: number, radius: number): void {
  const nodes = graph.getAllNodes().filter(n => !n.fixed);
  const n = nodes.length;
  if (n === 0) return;

  nodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    graph.updateNodePosition(node.id, x, y);
  });
}

export function applyHierarchyLayout(graph: Graph, startX: number, startY: number, levelGap: number, nodeGap: number): void {
  const nodes = graph.getAllNodes();
  const nodeIds = nodes.map(n => n.id);

  const inDegree = new Map<NodeId, number>();
  nodeIds.forEach(id => inDegree.set(id, 0));

  for (const node of nodes) {
    const outgoing = graph.settings.isDirected 
      ? graph.getOutgoingEdges(node.id).map(e => e.target)
      : graph.getNeighbors(node.id).map(n => n.id);
    outgoing.forEach(target => {
      inDegree.set(target, (inDegree.get(target) || 0) + 1);
    });
  }

  const levels: NodeId[][] = [];
  const visited = new Set<NodeId>();
  const remaining = new Map<NodeId, number>(inDegree);

  let curLevel: NodeId[] = [];
  remaining.forEach((deg, id) => {
    if (deg === 0 && !graph.getNode(id)?.fixed) {
      curLevel.push(id);
    }
  });

  if (curLevel.length === 0) {
    for (const [id] of remaining) {
      if (!graph.getNode(id)?.fixed) {
        curLevel.push(id);
        break;
      }
    }
  }

  while (curLevel.length > 0) {
    levels.push(curLevel);
    curLevel.forEach(id => visited.add(id));

    const nextDegrees = new Map<NodeId, number>();
    for (const u of curLevel) {
      const outgoing = graph.settings.isDirected
        ? graph.getOutgoingEdges(u).map(e => e.target)
        : graph.getNeighbors(u).map(n => n.id);
      for (const v of outgoing) {
        if (!visited.has(v) && !graph.getNode(v)?.fixed) {
          nextDegrees.set(v, (nextDegrees.get(v) || 0) + 1);
        }
      }
    }

    curLevel = [];
    const copy = new Map(remaining);
    copy.forEach((deg, id) => {
      if (visited.has(id)) {
        remaining.delete(id);
        return;
      }
      if (nextDegrees.has(id)) {
        const newDeg = deg - nextDegrees.get(id)!;
        remaining.set(id, Math.max(0, newDeg));
        if (newDeg <= 0 && !levels.flat().includes(id) && !curLevel.includes(id)) {
          curLevel.push(id);
        }
      }
    });

    if (curLevel.length === 0 && remaining.size > 0) {
      remaining.forEach((_, id) => {
        if (!graph.getNode(id)?.fixed) {
          curLevel.push(id);
          remaining.delete(id);
          return;
        }
      });
    }
  }

  if (remaining.size > 0) {
    const leftover: NodeId[] = [];
    remaining.forEach((_, id) => {
      if (!graph.getNode(id)?.fixed) leftover.push(id);
    });
    if (leftover.length > 0) levels.push(leftover);
  }

  levels.forEach((level, levelIdx) => {
    const totalWidth = (level.length - 1) * nodeGap;
    const firstX = startX - totalWidth / 2;
    level.forEach((nodeId, nodeIdx) => {
      const x = firstX + nodeIdx * nodeGap;
      const y = startY + levelIdx * levelGap;
      graph.updateNodePosition(nodeId, x, y);
    });
  });
}

export class ForceDirectedLayout {
  private graph: Graph;
  private areaWidth: number;
  private areaHeight: number;
  private repulsionStrength: number = 3000;
  private attractionStrength: number = 0.008;
  private damping: number = 0.85;
  private centerStrength: number = 0.01;
  private velocities: Map<NodeId, { vx: number; vy: number }> = new Map();
  private threshold: number = 0.5;
  private maxIterations: number = 300;

  constructor(graph: Graph, width: number, height: number) {
    this.graph = graph;
    this.areaWidth = width;
    this.areaHeight = height;
  }

  setParams(params: Partial<{
    repulsion: number;
    attraction: number;
    damping: number;
    center: number;
    threshold: number;
  }>): void {
    if (params.repulsion !== undefined) this.repulsionStrength = params.repulsion;
    if (params.attraction !== undefined) this.attractionStrength = params.attraction;
    if (params.damping !== undefined) this.damping = params.damping;
    if (params.center !== undefined) this.centerStrength = params.center;
    if (params.threshold !== undefined) this.threshold = params.threshold;
  }

  step(): number {
    const nodes = this.graph.getAllNodes();
    const cx = this.areaWidth / 2;
    const cy = this.areaHeight / 2;

    nodes.forEach(n => {
      if (!this.velocities.has(n.id)) {
        this.velocities.set(n.id, { vx: 0, vy: 0 });
      }
    });

    const forces = new Map<NodeId, { fx: number; fy: number }>();
    nodes.forEach(n => forces.set(n.id, { fx: 0, fy: 0 }));

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) dist = 1;

        const force = this.repulsionStrength / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        const fa = forces.get(a.id)!;
        const fb = forces.get(b.id)!;
        fa.fx -= fx;
        fa.fy -= fy;
        fb.fx += fx;
        fb.fy += fy;
      }
    }

    const edges = this.graph.getAllEdges();
    for (const edge of edges) {
      const a = this.graph.getNode(edge.source);
      const b = this.graph.getNode(edge.target);
      if (!a || !b) continue;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const idealLen = 100;
      const disp = dist - idealLen;

      const force = this.attractionStrength * disp;
      const fx = (dx / (dist || 1)) * force;
      const fy = (dy / (dist || 1)) * force;

      const fa = forces.get(a.id)!;
      const fb = forces.get(b.id)!;
      fa.fx += fx;
      fa.fy += fy;
      fb.fx -= fx;
      fb.fy -= fy;
    }

    for (const node of nodes) {
      const f = forces.get(node.id)!;
      f.fx += (cx - node.x) * this.centerStrength;
      f.fy += (cy - node.y) * this.centerStrength;
    }

    let totalMove = 0;

    for (const node of nodes) {
      if (node.fixed) continue;

      const v = this.velocities.get(node.id)!;
      const f = forces.get(node.id)!;

      v.vx = (v.vx + f.fx) * this.damping;
      v.vy = (v.vy + f.fy) * this.damping;

      const maxV = 20;
      const speed = Math.sqrt(v.vx * v.vx + v.vy * v.vy);
      if (speed > maxV) {
        v.vx = (v.vx / speed) * maxV;
        v.vy = (v.vy / speed) * maxV;
      }

      let newX = node.x + v.vx;
      let newY = node.y + v.vy;

      const padding = 60;
      newX = Math.max(padding, Math.min(this.areaWidth - padding, newX));
      newY = Math.max(padding, Math.min(this.areaHeight - padding, newY));

      const dx = newX - node.x;
      const dy = newY - node.y;
      totalMove += Math.sqrt(dx * dx + dy * dy);

      this.graph.updateNodePosition(node.id, newX, newY);
    }

    return totalMove;
  }

  run(): number {
    let iter = 0;
    let totalMove = Infinity;
    while (totalMove > this.threshold && iter < this.maxIterations) {
      totalMove = this.step();
      iter++;
    }
    return iter;
  }

  reset(): void {
    this.velocities.clear();
  }
}
