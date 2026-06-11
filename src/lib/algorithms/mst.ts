import type { Graph } from '../graph';
import type { AlgorithmStep, NodeId, EdgeId } from '../types';
import { StepBuilder } from './step-builder';

class DSU {
  parent: Map<NodeId, NodeId> = new Map();
  rank: Map<NodeId, number> = new Map();
  groups: Map<NodeId, NodeId[]> = new Map();

  constructor(ids: NodeId[]) {
    ids.forEach(id => {
      this.parent.set(id, id);
      this.rank.set(id, 0);
      this.groups.set(id, [id]);
    });
  }

  find(x: NodeId): NodeId {
    let root = x;
    while (this.parent.get(root) !== root) {
      root = this.parent.get(root)!;
    }
    while (this.parent.get(x) !== x) {
      const next = this.parent.get(x)!;
      this.parent.set(x, root);
      x = next;
    }
    return root;
  }

  union(x: NodeId, y: NodeId): boolean {
    const rx = this.find(x);
    const ry = this.find(y);
    if (rx === ry) return false;
    const rxRank = this.rank.get(rx)!;
    const ryRank = this.rank.get(ry)!;
    if (rxRank < ryRank) {
      this.parent.set(rx, ry);
      const gx = this.groups.get(rx)!;
      const gy = this.groups.get(ry)!;
      this.groups.set(ry, [...gy, ...gx]);
      this.groups.delete(rx);
    } else {
      this.parent.set(ry, rx);
      const gx = this.groups.get(rx)!;
      const gy = this.groups.get(ry)!;
      this.groups.set(rx, [...gx, ...gy]);
      this.groups.delete(ry);
      if (rxRank === ryRank) {
        this.rank.set(rx, rxRank + 1);
      }
    }
    return true;
  }

  getGroups(): Record<string, NodeId[]> {
    const result: Record<string, NodeId[]> = {};
    this.groups.forEach((v, k) => {
      result[String(k)] = [...v].sort((a, b) => a - b);
    });
    return result;
  }
}

export function runKruskal(graph: Graph): AlgorithmStep[] {
  const sb = new StepBuilder();
  const nodes = graph.getAllNodes();
  const edges = [...graph.getAllEdges()];
  const nodeIds = nodes.map(n => n.id);

  sb.setState((vs, data) => {
    data.sortedEdges = [];
    data.mstEdges = [];
    data.dsuGroups = {};
    data.totalWeight = 0;
    vs.nodeStates.clear();
    vs.edgeStates.clear();
  });
  sb.addStep(`初始化 Kruskal：创建并查集，准备最小生成树（共需要 ${nodeIds.length - 1} 条边）`);

  if (edges.length === 0) {
    sb.addStep('图中没有边，算法终止');
    return sb.getSteps();
  }

  const sortedEdges = [...edges].sort((a, b) => a.weight - b.weight);
  const edgeIds = sortedEdges.map(e => `${e.source}-${e.target}`);
  const dsu = new DSU(nodeIds);
  const mstEdges: EdgeId[] = [];
  let totalWeight = 0;

  sb.setState((vs, data) => {
    data.sortedEdges = sortedEdges.map(e => ({ from: e.source, to: e.target, weight: e.weight, id: e.id }));
    data.dsuGroups = dsu.getGroups();
    data.mstEdges = [...mstEdges];
    data.currentEdgeIndex = -1;
    data.totalWeight = 0;
  });
  sb.addStep(`将 ${edges.length} 条边按权重排序：${sortedEdges.map(e => `${e.source}-${e.target}(${e.weight})`).join(', ')}`);

  let idx = 0;
  for (const edge of sortedEdges) {
    idx++;
    const { source: u, target: v, weight: w } = edge;

    sb.setState((vs, data) => {
      data.currentEdgeIndex = idx - 1;
      vs.edgeStates.set(edge.id, 'active');
      vs.highlightedEdge = edge.id;
    });
    sb.addStep(`考察第 ${idx}/${sortedEdges.length} 条边：${u}-${v}，权重 = ${w}`);

    const ru = dsu.find(u);
    const rv = dsu.find(v);

    if (ru !== rv) {
      const merged = dsu.union(u, v);
      if (merged) {
        mstEdges.push(edge.id);
        totalWeight += w;

        sb.setState((vs, data) => {
          data.mstEdges = [...mstEdges];
          data.dsuGroups = dsu.getGroups();
          data.totalWeight = totalWeight;
          vs.edgeStates.set(edge.id, 'in-tree');
          vs.nodeStates.set(u, 'in-tree');
          vs.nodeStates.set(v, 'in-tree');
        });
        sb.addStep(`✓ 加入 MST！合并集合 {${ru}} ∪ {${rv}}，当前总权重 = ${totalWeight}`);

        if (mstEdges.length === nodeIds.length - 1) {
          sb.addStep(`MST 边数达到 ${nodeIds.length - 1}，提前完成！`);
          break;
        }
      }
    } else {
      sb.setState((vs, data) => {
        vs.edgeStates.set(edge.id, 'visited');
      });
      sb.addStep(`× 跳过！${u} 和 ${v} 已在同一集合中，会形成环`);
    }
  }

  sb.setState((vs, data) => {
    data.currentEdgeIndex = sortedEdges.length;
    data.result = { mstEdges: [...mstEdges], totalWeight, groups: dsu.getGroups() };
    vs.highlightedEdge = null;
  });

  if (mstEdges.length === nodeIds.length - 1) {
    sb.addStep(`Kruskal 完成！最小生成树总权重 = ${totalWeight}，共 ${mstEdges.length} 条边`);
  } else {
    sb.addStep(`Kruskal 完成！图非连通，生成了最小生成森林，总权重 = ${totalWeight}`);
  }

  return sb.getSteps();
}

export function runPrim(graph: Graph, startId: NodeId): AlgorithmStep[] {
  const sb = new StepBuilder();
  const nodes = graph.getAllNodes();
  const nodeIds = nodes.map(n => n.id);
  const V = nodeIds.length;

  sb.setState((vs, data) => {
    data.inMST = [];
    data.candidateEdges = [];
    data.mstEdges = [];
    data.totalWeight = 0;
    data.keyValues = {};
    vs.nodeStates.clear();
    vs.edgeStates.clear();
  });
  sb.addStep(`初始化 Prim：从节点 ${startId} 开始构建最小生成树`);

  if (!graph.getNode(startId)) {
    return sb.getSteps();
  }

  const key = new Map<NodeId, number>();
  const inMST = new Set<NodeId>();
  const mstEdges: EdgeId[] = [];
  const keyVal: Record<string, number> = {};
  let totalWeight = 0;

  nodeIds.forEach(id => key.set(id, Infinity));
  key.set(startId, 0);

  sb.setState((vs, data) => {
    data.inMST = [...inMST];
    data.keyValues = Object.fromEntries(key);
    data.mstEdges = [...mstEdges];
    data.totalWeight = 0;
    data.candidateEdges = [];
    vs.nodeStates.set(startId, 'in-tree');
  });
  sb.addStep(`初始：节点 ${startId} key = 0，其余节点 key = ∞`);

  for (let count = 0; count < V; count++) {
    let u: NodeId | null = null;
    let minKey = Infinity;

    nodeIds.forEach(id => {
      if (!inMST.has(id)) {
        const k = key.get(id)!;
        if (k < minKey) {
          minKey = k;
          u = id;
        }
      }
    });

    if (u === null) {
      sb.addStep('剩余节点不可达，停止扩展');
      break;
    }

    inMST.add(u as NodeId);
    if (minKey > 0) {
      totalWeight += minKey;
    }

    sb.setState((vs, data) => {
      data.inMST = [...inMST];
      data.currentNode = u;
      vs.nodeStates.set(u as NodeId, 'current');
      vs.highlightedNode = u as NodeId;
    });
    sb.addStep(`选择节点 ${u}，key = ${minKey === Infinity ? '∞' : minKey}，加入 MST`);

    const incident = graph.getIncidentEdges(u as NodeId);
    for (const edge of incident) {
      const v = edge.source === u ? edge.target : edge.source;
      if (inMST.has(v)) {
        if (!mstEdges.includes(edge.id)) {
          sb.setState((vs, data) => {
            vs.edgeStates.set(edge.id, 'visited');
          });
        }
        continue;
      }

      const w = edge.weight;
      const oldKey = key.get(v)!;

      sb.setState((vs, data) => {
        vs.edgeStates.set(edge.id, 'active');
        vs.highlightedEdge = edge.id;
      });

      if (w < oldKey) {
        key.set(v, w);

        sb.setState((vs, data) => {
          data.keyValues = Object.fromEntries(key);
          data.candidateEdges = [...getCandidateEdges(graph, inMST, key, nodeIds)];
        });
        sb.addStep(`  更新节点 ${v} 的 key：${oldKey === Infinity ? '∞' : oldKey} → ${w}`);
      } else {
        sb.addStep(`  边 ${u}-${v}：${w} ≥ ${oldKey === Infinity ? '∞' : oldKey}，不更新`);
      }
    }

    const prevEdges = mstEdges.length;
    sb.setState((vs, data) => {
      for (const eid of mstEdges) {
        const edge = graph.getEdge(eid);
        if (edge) vs.edgeStates.set(eid, 'in-tree');
      }
    });

    for (const eid of findEdgesToNode(graph, u as NodeId, inMST, mstEdges)) {
      mstEdges.push(eid);
      sb.setState((vs, data) => {
        data.mstEdges = [...mstEdges];
        data.totalWeight = totalWeight;
        vs.edgeStates.set(eid, 'in-tree');
      });
      break;
    }

    if (mstEdges.length > prevEdges) {
      const edge = graph.getEdge(mstEdges[mstEdges.length - 1]);
      if (edge) {
        sb.addStep(`  将边 ${edge.source}-${edge.target} 加入 MST`);
      }
    }

    sb.setState((vs, data) => {
      data.currentNode = null;
      data.totalWeight = totalWeight;
      data.candidateEdges = getCandidateEdges(graph, inMST, key, nodeIds);
      vs.highlightedNode = null;
      vs.highlightedEdge = null;
      vs.nodeStates.set(u as NodeId, 'in-tree');
    });
  }

  sb.setState((vs, data) => {
    data.result = { mstEdges: [...mstEdges], totalWeight, inMST: [...inMST] };
  });
  sb.addStep(`Prim 完成！最小生成树总权重 = ${totalWeight}`);

  return sb.getSteps();
}

function findEdgesToNode(graph: Graph, u: NodeId, inMST: Set<NodeId>, existing: EdgeId[]): EdgeId[] {
  const incident = graph.getIncidentEdges(u);
  const result: EdgeId[] = [];
  for (const edge of incident) {
    const other = edge.source === u ? edge.target : edge.source;
    if (inMST.has(other) && !existing.includes(edge.id)) {
      result.push(edge.id);
      break;
    }
  }
  return result;
}

function getCandidateEdges(graph: Graph, inMST: Set<NodeId>, key: Map<NodeId, number>, ids: NodeId[]): any[] {
  const result: any[] = [];
  for (const id of ids) {
    if (!inMST.has(id) && key.get(id) !== Infinity) {
      const incident = graph.getIncidentEdges(id);
      for (const e of incident) {
        const other = e.source === id ? e.target : e.source;
        if (inMST.has(other)) {
          result.push({ from: other, to: id, weight: e.weight, id: e.id });
          break;
        }
      }
    }
  }
  return result;
}
