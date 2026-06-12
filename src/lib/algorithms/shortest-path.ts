import type { Graph } from '../graph';
import type { AlgorithmStep, NodeId, EdgeId } from '../types';
import { StepBuilder } from './step-builder';

const INF = Infinity;

export function runDijkstra(graph: Graph, startId: NodeId): AlgorithmStep[] {
  const sb = new StepBuilder();
  const nodes = graph.getAllNodes();
  const nodeIds = nodes.map(n => n.id);

  sb.setState((vs, data) => {
    data.distances = {};
    data.previous = {};
    data.unvisited = [...nodeIds];
    data.current = null;
    data.relaxedEdge = null;
    data.iteration = 0;
    vs.nodeStates.clear();
    vs.edgeStates.clear();
  });
  sb.addStep(`初始化 Dijkstra 算法：设置起点 ${startId} 距离为 0，其余所有节点距离初始化为无穷大 ∞`);

  if (!graph.getNode(startId)) {
    return sb.getSteps();
  }

  const dist = new Map<NodeId, number>();
  const prev = new Map<NodeId, NodeId | null>();
  const unvisited = new Set<NodeId>(nodeIds);

  nodeIds.forEach(id => {
    dist.set(id, INF);
    prev.set(id, null);
  });
  dist.set(startId, 0);

  sb.setState((vs, data) => {
    data.distances = Object.fromEntries(dist);
    data.previous = Object.fromEntries(prev);
    data.unvisited = [...unvisited];
    data.current = null;
    data.iteration = 0;
    vs.nodeStates.set(startId, 'in-queue');
  });
  sb.addStep(`从节点 ${startId} 出发，起点距离初始化为 0，其他节点距离为 ∞，前驱节点均为空`);

  let iteration = 0;
  while (unvisited.size > 0) {
    iteration++;
    let u: NodeId | null = null;
    let minDist = INF;
    unvisited.forEach(id => {
      const d = dist.get(id)!;
      if (d < minDist) {
        minDist = d;
        u = id;
      }
    });

    if (u === null || minDist === INF) {
      sb.setState((vs, data) => {
        data.distances = Object.fromEntries(dist);
        data.previous = Object.fromEntries(prev);
        data.unvisited = [...unvisited];
        data.current = null;
        data.iteration = iteration;
      });
      const unreachable = [...unvisited].join(', ');
      sb.addStep(`剩余节点 [${unreachable}] 从起点不可达，算法提前终止`);
      break;
    }

    unvisited.delete(u);

    sb.setState((vs, data) => {
      data.distances = Object.fromEntries(dist);
      data.previous = Object.fromEntries(prev);
      data.unvisited = [...unvisited];
      data.current = u;
      data.iteration = iteration;
      vs.nodeStates.set(u as NodeId, 'current');
      vs.highlightedNode = u as NodeId;
    });
    sb.addStep(`第 ${iteration} 轮：从待处理节点中选择距离最小的节点 ${u}，当前距离 = ${minDist}`);

    const outgoing = graph.getOutgoingEdges(u as NodeId);
    const incident = graph.getIncidentEdges(u as NodeId);
    const allEdges = graph.settings.isDirected ? outgoing : incident;

    for (const edge of allEdges) {
      const v = edge.source === u ? edge.target : edge.source;
      if (!unvisited.has(v)) continue;

      const newDist = dist.get(u as NodeId)! + edge.weight;
      const oldDist = dist.get(v)!;

      sb.setState((vs, data) => {
        data.relaxedEdge = edge.id;
        vs.edgeStates.set(edge.id, 'active');
        vs.highlightedEdge = edge.id;
      });
      sb.addStep(`从节点 ${u} 出发，检查边 ${u}→${v}（权重 = ${edge.weight}），尝试松弛：新距离 = ${dist.get(u as NodeId)!} + ${edge.weight} = ${newDist}`);

      if (newDist < oldDist) {
        dist.set(v, newDist);
        prev.set(v, u as NodeId);

        sb.setState((vs, data) => {
          data.distances = Object.fromEntries(dist);
          data.previous = Object.fromEntries(prev);
          vs.edgeStates.set(edge.id, 'relaxed');
          vs.nodeStates.set(v, 'in-queue');
        });
        sb.addStep(`节点 ${v} 的距离通过节点 ${u} 松弛为 ${newDist}，小于原距离 ${oldDist === INF ? '∞' : oldDist}，更新前驱为节点 ${u}`);
      } else {
        sb.setState((vs, data) => {
          vs.edgeStates.set(edge.id, 'visited');
        });
        sb.addStep(`不更新：新距离 ${newDist} ≥ 当前节点 ${v} 的距离 ${oldDist === INF ? '∞' : oldDist}，保持不变`);
      }
    }

    sb.setState((vs, data) => {
      data.current = null;
      data.relaxedEdge = null;
      vs.nodeStates.set(u as NodeId, 'finished');
      vs.highlightedNode = null;
      vs.highlightedEdge = null;
    });
  }

  sb.setState((vs, data) => {
    data.distances = Object.fromEntries(dist);
    data.previous = Object.fromEntries(prev);
    data.result = { start: startId, distances: Object.fromEntries(dist), previous: Object.fromEntries(prev) };
    
    let cur = nodeIds[0] !== undefined ? nodeIds[0] : startId;
    nodeIds.forEach(id => {
      if (id !== startId) {
        const p = prev.get(id);
        if (p !== null && p !== undefined) {
          const e = graph.getEdgeByNodes(p, id);
          if (e) vs.edgeStates.set(e.id, 'in-tree');
        }
      }
    });
    nodeIds.forEach(id => {
      if (dist.get(id) !== INF) vs.nodeStates.set(id, 'in-tree');
    });
  });
  
  const distStr = nodeIds.map(id => `${id}:${dist.get(id) === INF ? '∞' : dist.get(id)}`).join(', ');
  sb.addStep(`Dijkstra 算法完成！从节点 ${startId} 出发到各节点的最短距离：{ ${distStr} }`);

  return sb.getSteps();
}

export function runBellmanFord(graph: Graph, startId: NodeId): AlgorithmStep[] {
  const sb = new StepBuilder();
  const nodes = graph.getAllNodes();
  const edges = graph.getAllEdges();
  const nodeIds = nodes.map(n => n.id);
  const V = nodeIds.length;

  sb.setState((vs, data) => {
    data.distances = {};
    data.previous = {};
    data.iteration = 0;
    data.hasNegativeCycle = false;
    data.negativeCycleEdges = [];
    vs.nodeStates.clear();
    vs.edgeStates.clear();
  });
  sb.addStep(`初始化 Bellman-Ford 算法：从节点 ${startId} 出发，起点距离 = 0，其余节点距离 = ∞，共需 ${V - 1} 轮松弛操作`);

  if (!graph.getNode(startId)) {
    return sb.getSteps();
  }

  const dist = new Map<NodeId, number>();
  const prev = new Map<NodeId, NodeId | null>();

  nodeIds.forEach(id => {
    dist.set(id, INF);
    prev.set(id, null);
  });
  dist.set(startId, 0);

  sb.setState((vs, data) => {
    data.distances = Object.fromEntries(dist);
    data.previous = Object.fromEntries(prev);
    data.iteration = 0;
    vs.nodeStates.set(startId, 'in-queue');
  });
  sb.addStep(`初始距离表就绪：节点 ${startId} 距离为 0，其他节点为无穷大 ∞`);

  for (let i = 1; i <= V - 1; i++) {
    let updated = false;
    sb.setState((vs, data) => {
      data.iteration = i;
      data.currentEdge = null;
    });
    sb.addStep(`━━━ 第 ${i}/${V - 1} 轮松弛开始 ━━━`);

    for (const edge of edges) {
      const { source: u, target: v, weight: w } = edge;
      const du = dist.get(u)!;

      sb.setState((vs, data) => {
        data.currentEdge = edge.id;
        vs.edgeStates.set(edge.id, 'active');
        vs.highlightedEdge = edge.id;
      });

      if (du === INF) {
        sb.setState((vs, data) => {
          vs.edgeStates.set(edge.id, 'visited');
        });
        sb.addStep(`检查边 ${u}→${v}（权重 = ${w}）：节点 ${u} 距离为 ∞，无法通过该边松弛，跳过`);
        continue;
      }

      const newDist = du + w;
      const oldDist = dist.get(v)!;

      sb.addStep(`检查边 ${u}→${v}（权重 = ${w}）：尝试松弛，新距离 = ${du} + ${w} = ${newDist}，原距离 = ${oldDist === INF ? '∞' : oldDist}`);

      if (newDist < oldDist) {
        dist.set(v, newDist);
        prev.set(v, u);
        updated = true;

        sb.setState((vs, data) => {
          data.distances = Object.fromEntries(dist);
          data.previous = Object.fromEntries(prev);
          vs.edgeStates.set(edge.id, 'relaxed');
          vs.nodeStates.set(v, 'current');
        });
        sb.addStep(`节点 ${v} 的距离通过节点 ${u} 松弛为 ${newDist}，小于原距离 ${oldDist === INF ? '∞' : oldDist}，更新前驱为节点 ${u}`);
      } else {
        sb.setState((vs, data) => {
          vs.edgeStates.set(edge.id, 'visited');
        });
        sb.addStep(`不更新：新距离 ${newDist} ≥ 节点 ${v} 当前距离 ${oldDist === INF ? '∞' : oldDist}，保持不变`);
      }
    }

    sb.setState((vs, data) => {
      vs.highlightedEdge = null;
    });

    if (!updated) {
      sb.addStep(`第 ${i} 轮松弛后没有任何距离更新，说明已达到最优解，算法提前终止！`);
      break;
    }
  }

  sb.setState((vs, data) => {
    data.iteration = V;
  });
  sb.addStep(`━━━ 第 ${V} 轮：检测图中是否存在负权环 ━━━`);

  const negativeCycleEdges: EdgeId[] = [];
  for (const edge of edges) {
    const { source: u, target: v, weight: w } = edge;
    const du = dist.get(u)!;
    if (du !== INF && du + w < dist.get(v)!) {
      negativeCycleEdges.push(edge.id);
      sb.setState((vs, data) => {
        vs.edgeStates.set(edge.id, 'negative');
        vs.nodeStates.set(u, 'in-cut');
        vs.nodeStates.set(v, 'in-cut');
        data.negativeCycleEdges = [...negativeCycleEdges];
        data.hasNegativeCycle = true;
      });
      sb.addStep(`⚠ 检测到负权环！边 ${u}→${v}（权重 = ${w}）在第 ${V} 轮仍可松弛：${du} + ${w} < ${dist.get(v)}`);
    }
  }

  if (negativeCycleEdges.length === 0) {
    sb.setState((vs, data) => {
      data.hasNegativeCycle = false;
      data.distances = Object.fromEntries(dist);
      data.previous = Object.fromEntries(prev);
      const distStr = nodeIds.map(id => `${id}:${dist.get(id) === INF ? '∞' : dist.get(id)}`).join(', ');
      data.result = { start: startId, distances: Object.fromEntries(dist), previous: Object.fromEntries(prev), noNegativeCycle: true };
      nodeIds.forEach(id => {
        if (id !== startId) {
          const p = prev.get(id);
          if (p !== null && p !== undefined) {
            const e = graph.getEdgeByNodes(p, id);
            if (e) vs.edgeStates.set(e.id, 'in-tree');
          }
        }
      });
      nodeIds.forEach(id => {
        if (dist.get(id) !== INF) vs.nodeStates.set(id, 'in-tree');
      });
    });
    const distStr = nodeIds.map(id => `${id}:${dist.get(id) === INF ? '∞' : dist.get(id)}`).join(', ');
    sb.addStep(`✓ Bellman-Ford 算法完成！图中无负权环，从节点 ${startId} 出发的最短距离：{ ${distStr} }`);
  } else {
    sb.addStep(`✗ Bellman-Ford 算法完成！检测到图中存在负权环，最短路径无意义`);
  }

  return sb.getSteps();
}

export function runFloydWarshall(graph: Graph): AlgorithmStep[] {
  const sb = new StepBuilder();
  const nodes = graph.getAllNodes();
  const nodeIds = nodes.map(n => n.id).sort((a, b) => a - b);
  const V = nodeIds.length;
  const idxMap = new Map<NodeId, number>();
  nodeIds.forEach((id, i) => idxMap.set(id, i));

  const dist: number[][] = [];
  const next: (NodeId | null)[][] = [];

  for (let i = 0; i < V; i++) {
    dist[i] = [];
    next[i] = [];
    for (let j = 0; j < V; j++) {
      if (i === j) {
        dist[i][j] = 0;
      } else {
        dist[i][j] = INF;
      }
      next[i][j] = null;
    }
  }

  const edges = graph.getAllEdges();
  if (graph.settings.isDirected) {
    for (const e of edges) {
      const i = idxMap.get(e.source)!;
      const j = idxMap.get(e.target)!;
      if (e.weight < dist[i][j]) {
        dist[i][j] = e.weight;
        next[i][j] = e.target;
      }
    }
  } else {
    for (const e of edges) {
      const i = idxMap.get(e.source)!;
      const j = idxMap.get(e.target)!;
      if (e.weight < dist[i][j]) {
        dist[i][j] = e.weight;
        next[i][j] = e.target;
      }
      if (e.weight < dist[j][i]) {
        dist[j][i] = e.weight;
        next[j][i] = e.source;
      }
    }
  }

  function formatMatrix(d: number[][]): string {
    return d.map(row => 
      row.map(v => v === INF ? '∞' : String(v)).join('\t')
    ).join('\n');
  }

  function snapshotMatrix(d: number[][]): string[][] {
    return d.map(row => row.map(v => v === INF ? '∞' : String(v)));
  }

  sb.setState((vs, data) => {
    data.k = -1;
    data.i = -1;
    data.j = -1;
    data.distMatrix = snapshotMatrix(dist);
    data.nodeIds = [...nodeIds];
    vs.nodeStates.clear();
    vs.edgeStates.clear();
  });
  sb.addStep(`初始化 Floyd-Warshall 算法：构建初始距离矩阵 D⁻¹，D[i][j] = 节点 ${'i'} 到 ${'j'} 的直接边权（无边则为无穷大 ∞）`);

  for (let k = 0; k < V; k++) {
    const kNode = nodeIds[k];

    sb.setState((vs, data) => {
      data.k = k;
      data.distMatrix = snapshotMatrix(dist);
      vs.nodeStates.set(kNode, 'current');
      vs.highlightedNode = kNode;
    });
    sb.addStep(`━━━ 以节点 ${kNode} 作为中间中转节点（第 ${k + 1}/${V} 轮）━━━`);

    for (let i = 0; i < V; i++) {
      for (let j = 0; j < V; j++) {
        if (i === j || i === k || j === k) continue;

        const iNode = nodeIds[i];
        const jNode = nodeIds[j];

        const dik = dist[i][k];
        const dkj = dist[k][j];
        const dij = dist[i][j];

        sb.setState((vs, data) => {
          data.i = i;
          data.j = j;
          data.currentCell = { i, j, k };
          vs.nodeStates.set(iNode, 'in-queue');
          vs.nodeStates.set(jNode, 'in-queue');
        });

        if (dik === INF || dkj === INF) {
          sb.setState((vs, data) => {
            vs.nodeStates.set(iNode, 'default');
            vs.nodeStates.set(jNode, 'default');
          });
          continue;
        }

        const candidate = dik + dkj;
        sb.addStep(`比较节点 ${iNode} 到 ${jNode} 的路径：原距离 = ${dij === INF ? '∞' : dij}，经节点 ${kNode} 中转的距离 = ${dik} + ${dkj} = ${candidate}`);

        if (candidate < dij) {
          dist[i][j] = candidate;
          next[i][j] = next[i][k];

          const edgeIK = graph.getEdgeByNodes(iNode, kNode);
          const edgeKJ = graph.getEdgeByNodes(kNode, jNode);

          sb.setState((vs, data) => {
            data.distMatrix = snapshotMatrix(dist);
            data.updatedCell = { i, j, newValue: candidate };
            if (edgeIK) vs.edgeStates.set(edgeIK.id, 'active');
            if (edgeKJ) vs.edgeStates.set(edgeKJ.id, 'active');
          });
          sb.addStep(`✓ 更新！从节点 ${iNode} 到 ${jNode} 经节点 ${kNode} 中转更短，距离更新为 ${candidate}，前驱指向节点 ${kNode}`);
        } else {
          sb.addStep(`× 不更新：经节点 ${kNode} 中转的距离 ${candidate} ≥ 原距离 ${dij === INF ? '∞' : dij}，保持原值不变`);
        }

        sb.setState((vs, data) => {
          data.i = -1;
          data.j = -1;
          data.currentCell = null;
          data.updatedCell = null;
          vs.nodeStates.set(iNode, 'default');
          vs.nodeStates.set(jNode, 'default');
          const edgeIK = graph.getEdgeByNodes(iNode, kNode);
          const edgeKJ = graph.getEdgeByNodes(kNode, jNode);
          if (edgeIK) vs.edgeStates.set(edgeIK.id, 'visited');
          if (edgeKJ) vs.edgeStates.set(edgeKJ.id, 'visited');
        });
      }
    }

    sb.setState((vs, data) => {
      vs.nodeStates.set(kNode, 'finished');
      vs.highlightedNode = null;
    });
  }

  sb.setState((vs, data) => {
    data.k = V;
    data.distMatrix = snapshotMatrix(dist);
    data.result = {
      nodeIds: [...nodeIds],
      distances: dist.map(row => row.map(v => v === INF ? '∞' : v)),
    };
    
    nodeIds.forEach(id => vs.nodeStates.set(id, 'in-tree'));
  });
  sb.addStep(`Floyd-Warshall 算法完成！任意两点之间的最短路径矩阵已全部计算完毕`);

  return sb.getSteps();
}
