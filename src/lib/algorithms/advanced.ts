import type { Graph } from '../graph';
import type { AlgorithmStep, NodeId, EdgeId } from '../types';
import { StepBuilder, COMPONENT_COLORS } from './step-builder';

export function runEdmondsKarp(graph: Graph, sourceId: NodeId, sinkId?: NodeId): AlgorithmStep[] {
  const sb = new StepBuilder();
  const nodes = graph.getAllNodes();
  const nodeIds = nodes.map(n => n.id);

  sb.setState((vs, data) => {
    data.source = sourceId;
    data.sink = sinkId;
    data.maxFlow = 0;
    data.augmentingPath = [];
    data.edgeFlows = {};
    data.edgeCapacities = {};
    data.minCutS = [];
    data.minCutT = [];
    data.minCutEdges = [];
    data.iteration = 0;
    vs.nodeStates.clear();
    vs.edgeStates.clear();
  });

  let actualSink: NodeId;
  if (sinkId !== undefined && graph.getNode(sinkId)) {
    actualSink = sinkId;
  } else {
    const candidates = nodeIds.filter(id => id !== sourceId);
    actualSink = candidates[candidates.length - 1] || sourceId;
  }

  sb.addStep(`初始化 Edmonds-Karp：源点 S = ${sourceId}，汇点 T = ${actualSink}`);

  if (!graph.getNode(sourceId) || !graph.getNode(actualSink)) {
    return sb.getSteps();
  }

  const edges = graph.getAllEdges();
  const flowMap = new Map<EdgeId, number>();
  const capacityMap = new Map<EdgeId, number>();
  const reverseEdges: Map<EdgeId, { from: NodeId; to: NodeId; origId: EdgeId }> = new Map();

  edges.forEach(e => {
    flowMap.set(e.id, 0);
    capacityMap.set(e.id, e.capacity ?? e.weight);
  });

  function getResidual(u: NodeId, v: NodeId): { id: EdgeId; capacity: number; isReverse: boolean } | null {
    const fwd = graph.getEdgeByNodes(u, v);
    if (fwd) {
      const cap = capacityMap.get(fwd.id)!;
      const flow = flowMap.get(fwd.id)!;
      if (cap - flow > 0) {
        return { id: fwd.id, capacity: cap - flow, isReverse: false };
      }
    }
    const rev = graph.getEdgeByNodes(v, u);
    if (rev) {
      const flow = flowMap.get(rev.id)!;
      if (flow > 0) {
        return { id: 'rev_' + rev.id, capacity: flow, isReverse: true };
      }
    }
    return null;
  }

  function bfsFindPath(s: NodeId, t: NodeId): NodeId[] | null {
    const parent = new Map<NodeId, NodeId>();
    const visited = new Set<NodeId>([s]);
    const queue: NodeId[] = [s];

    while (queue.length > 0) {
      const u = queue.shift()!;
      if (u === t) {
        const path: NodeId[] = [];
        let cur = t;
        while (cur !== s) {
          path.unshift(cur);
          cur = parent.get(cur)!;
        }
        path.unshift(s);
        return path;
      }

      for (const v of nodeIds) {
        if (visited.has(v)) continue;
        const res = getResidual(u, v);
        if (res) {
          visited.add(v);
          parent.set(v, u);
          queue.push(v);
        }
      }
    }
    return null;
  }

  sb.setState((vs, data) => {
    const flowData: Record<string, string> = {};
    capacityMap.forEach((cap, eid) => {
      const f = flowMap.get(eid) || 0;
      flowData[eid] = `${f}/${cap}`;
    });
    data.edgeFlows = flowData;
    data.edgeCapacities = Object.fromEntries(capacityMap);
  });
  sb.addStep(`初始状态：所有边流量 = 0，容量已就绪`);

  let maxFlow = 0;
  let iteration = 0;

  while (true) {
    iteration++;
    const path = bfsFindPath(sourceId, actualSink);

    if (!path) {
      sb.setState((vs, data) => {
        data.iteration = iteration;
        data.augmentingPath = [];
        data.maxFlow = maxFlow;
        const reachable = bfsReachable(sourceId, nodeIds, flowMap, capacityMap, graph);
        const notReachable = nodeIds.filter(id => !reachable.has(id));
        const cutEdges: EdgeId[] = [];
        
        reachable.forEach(u => {
          notReachable.forEach(v => {
            const e = graph.getEdgeByNodes(u, v);
            if (e) {
              cutEdges.push(e.id);
              vs.edgeStates.set(e.id, 'in-cut');
            }
          });
          vs.nodeStates.set(u, 'in-tree');
        });
        notReachable.forEach(v => {
          vs.nodeStates.set(v, 'in-cut');
        });
        
        data.minCutS = [...reachable];
        data.minCutT = notReachable;
        data.minCutEdges = cutEdges;
        data.result = { maxFlow, minCut: { S: [...reachable], T: notReachable, edges: cutEdges } };
      });
      sb.addStep(`━━━ 残余网络中不再存在增广路径，算法终止 ━━━`);
      sb.addStep(`✓ 最大流 = ${maxFlow}，最小割：S={${[...bfsReachable(sourceId, nodeIds, flowMap, capacityMap, graph)].join(',')}} / T={${nodeIds.filter(id => !bfsReachable(sourceId, nodeIds, flowMap, capacityMap, graph).has(id)).join(',')}}`);
      break;
    }

    sb.setState((vs, data) => {
      data.iteration = iteration;
      data.augmentingPath = [...path];
    });
    sb.addStep(`━━━ 第 ${iteration} 轮：找到增广路径 ${path.join(' → ')} ━━━`);

    let minCapacity = Infinity;
    const pathEdges: { u: NodeId; v: NodeId; res: { id: EdgeId; capacity: number; isReverse: boolean } }[] = [];

    for (let i = 0; i < path.length - 1; i++) {
      const u = path[i];
      const v = path[i + 1];
      const res = getResidual(u, v)!;
      pathEdges.push({ u, v, res });
      if (res.capacity < minCapacity) {
        minCapacity = res.capacity;
      }

      if (!res.isReverse) {
        // Marked in setState below
      }
    }

    sb.setState((vs, data) => {
      pathEdges.forEach(pe => {
        if (!pe.res.isReverse) {
          vs.edgeStates.set(pe.res.id, 'active');
        }
      });
      path.forEach(id => vs.nodeStates.set(id, 'current'));
    });
    sb.addStep(`路径上最小残余容量 = ${minCapacity}，将推送 ${minCapacity} 单位流量`);

    for (const pe of pathEdges) {
      if (!pe.res.isReverse) {
        const curFlow = flowMap.get(pe.res.id)!;
        flowMap.set(pe.res.id, curFlow + minCapacity);
      } else {
        const origId = pe.res.id.slice(4);
        const curFlow = flowMap.get(origId)!;
        flowMap.set(origId, curFlow - minCapacity);
      }
    }
    maxFlow += minCapacity;

    sb.setState((vs, data) => {
      data.maxFlow = maxFlow;
      const flowData: Record<string, string> = {};
      capacityMap.forEach((cap, eid) => {
        const f = flowMap.get(eid) || 0;
        flowData[eid] = `${f}/${cap}`;
      });
      data.edgeFlows = flowData;
      pathEdges.forEach(pe => {
        if (!pe.res.isReverse) {
          vs.edgeStates.set(pe.res.id, 'relaxed');
        }
      });
    });
    sb.addStep(`✓ 推送完成！路径上每条边流量 +${minCapacity}，当前总流量 = ${maxFlow}`);

    sb.setState((vs, data) => {
      path.forEach(id => vs.nodeStates.set(id, 'in-tree'));
      pathEdges.forEach(pe => {
        if (!pe.res.isReverse) {
          vs.edgeStates.set(pe.res.id, 'in-tree');
        }
      });
    });
  }

  return sb.getSteps();
}

function bfsReachable(s: NodeId, ids: NodeId[], flowMap: Map<EdgeId, number>, capacityMap: Map<EdgeId, number>, graph: Graph): Set<NodeId> {
  const visited = new Set<NodeId>([s]);
  const queue: NodeId[] = [s];
  while (queue.length > 0) {
    const u = queue.shift()!;
    for (const v of ids) {
      if (visited.has(v)) continue;
      const fwd = graph.getEdgeByNodes(u, v);
      if (fwd) {
        const cap = capacityMap.get(fwd.id)!;
        const flow = flowMap.get(fwd.id)!;
        if (cap - flow > 0) {
          visited.add(v);
          queue.push(v);
          continue;
        }
      }
      const rev = graph.getEdgeByNodes(v, u);
      if (rev) {
        const flow = flowMap.get(rev.id)!;
        if (flow > 0) {
          visited.add(v);
          queue.push(v);
        }
      }
    }
  }
  return visited;
}

export function runKahn(graph: Graph): AlgorithmStep[] {
  const sb = new StepBuilder();
  const nodes = graph.getAllNodes();
  const nodeIds = nodes.map(n => n.id).sort((a, b) => a - b);

  if (!graph.settings.isDirected) {
    sb.addStep('Kahn 拓扑排序需要有向图（DAG）。当前图为无向图，可能无法得到有效结果。');
  }

  sb.setState((vs, data) => {
    data.inDegree = {};
    data.queue = [];
    data.result = [];
    data.remaining = nodeIds.length;
    data.hasCycle = false;
    data.cycleNodes = [];
    vs.nodeStates.clear();
    vs.edgeStates.clear();
  });
  sb.addStep(`初始化 Kahn 算法：计算所有节点的入度`);

  const inDegree = new Map<NodeId, number>();
  nodeIds.forEach(id => inDegree.set(id, 0));

  const allEdges = graph.getAllEdges();
  const processedEdges = new Set<EdgeId>();

  for (const edge of allEdges) {
    if (processedEdges.has(edge.id)) continue;
    if (graph.settings.isDirected) {
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    } else {
      inDegree.set(edge.source, (inDegree.get(edge.source) || 0) + 1);
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    }
    processedEdges.add(edge.id);
  }

  sb.setState((vs, data) => {
    data.inDegree = Object.fromEntries(inDegree);
    data.queue = [];
    data.result = [];
  });
  const degStr = nodeIds.map(id => `${id}:${inDegree.get(id)}`).join(', ');
  sb.addStep(`初始入度：{ ${degStr} }`);

  const queue: NodeId[] = [];
  nodeIds.forEach(id => {
    if (inDegree.get(id) === 0) {
      queue.push(id);
      sb.setState((vs, data) => {
        vs.nodeStates.set(id, 'in-queue');
      });
    }
  });

  sb.setState((vs, data) => {
    data.queue = [...queue];
  });
  sb.addStep(`入度为 0 的节点入队：[${queue.join(', ')}]`);

  const result: NodeId[] = [];
  while (queue.length > 0) {
    const u = queue.shift()!;
    result.push(u);

    sb.setState((vs, data) => {
      data.queue = [...queue];
      data.result = [...result];
      data.inDegree = Object.fromEntries(inDegree);
      vs.nodeStates.set(u, 'current');
      vs.highlightedNode = u;
    });
    sb.addStep(`从队列取出节点 ${u}，加入结果序列 → [${result.join(', ')}]`);

    const outgoing = graph.getOutgoingEdges(u);
    for (const edge of outgoing) {
      const v = edge.target;
      inDegree.set(v, (inDegree.get(v) || 0) - 1);

      sb.setState((vs, data) => {
        vs.edgeStates.set(edge.id, 'active');
        vs.highlightedEdge = edge.id;
      });
      sb.addStep(`  移除边 ${u}→${v}，节点 ${v} 入度 = ${(inDegree.get(v) || 0)}`);

      if (inDegree.get(v) === 0) {
        queue.push(v);
        sb.setState((vs, data) => {
          data.queue = [...queue];
          vs.nodeStates.set(v, 'in-queue');
        });
        sb.addStep(`  ✓ 节点 ${v} 入度变为 0，加入队列`);
      }
    }

    const allIncident = graph.getIncidentEdges(u);
    for (const edge of allIncident) {
      if (graph.settings.isDirected && edge.target === u) continue;
      if (edge.source === u && graph.settings.isDirected) continue;
      if (!graph.settings.isDirected) {
        const v = edge.source === u ? edge.target : edge.source;
        if (result.includes(v)) continue;
        sb.setState((vs, data) => {
          vs.edgeStates.set(edge.id, 'visited');
        });
      }
    }

    sb.setState((vs, data) => {
      vs.nodeStates.set(u, 'finished');
      vs.highlightedNode = null;
      vs.highlightedEdge = null;
    });
  }

  const remainingIds = nodeIds.filter(id => !result.includes(id));

  if (remainingIds.length > 0) {
    sb.setState((vs, data) => {
      data.hasCycle = true;
      data.cycleNodes = [...remainingIds];
      remainingIds.forEach(id => {
        vs.nodeStates.set(id, 'in-cut');
      });
      data.result = { success: false, cycle: [...remainingIds] };
    });
    sb.addStep(`✗ 拓扑排序失败！剩余节点 [${remainingIds.join(', ')}] 形成环，无法完成排序`);
  } else {
    sb.setState((vs, data) => {
      data.hasCycle = false;
      nodeIds.forEach(id => vs.nodeStates.set(id, 'in-tree'));
      data.result = { success: true, order: [...result] };
    });
    sb.addStep(`✓ Kahn 完成！拓扑序：${result.join(' → ')}`);
  }

  return sb.getSteps();
}

export function runTarjan(graph: Graph): AlgorithmStep[] {
  const sb = new StepBuilder();
  const nodes = graph.getAllNodes();
  const nodeIds = nodes.map(n => n.id).sort((a, b) => a - b);

  sb.setState((vs, data) => {
    data.dfn = {};
    data.low = {};
    data.stack = [];
    data.onStack = {};
    data.components = [];
    data.time = 0;
    data.current = null;
    vs.nodeStates.clear();
    vs.edgeStates.clear();
  });
  sb.addStep(`初始化 Tarjan 算法：准备 dfn, low 数组和栈`);

  const dfn = new Map<NodeId, number>();
  const low = new Map<NodeId, number>();
  const stack: NodeId[] = [];
  const onStack = new Set<NodeId>();
  const components: NodeId[][] = [];
  let time = 0;
  let colorIdx = 0;

  function strongConnect(v: NodeId): void {
    time++;
    dfn.set(v, time);
    low.set(v, time);
    stack.push(v);
    onStack.add(v);

    sb.setState((vs, data) => {
      data.dfn = Object.fromEntries(dfn);
      data.low = Object.fromEntries(low);
      data.stack = [...stack];
      data.onStack = Object.fromEntries([...onStack].map(x => [x, true]));
      data.time = time;
      data.current = v;
      vs.nodeStates.set(v, 'in-stack');
      vs.highlightedNode = v;
    });
    sb.addStep(`首次访问节点 ${v}：dfn=${time}，low=${time}，压入栈 [${stack.join(', ')}]`);

    const outgoing = graph.getOutgoingEdges(v);
    const neighbors = graph.settings.isDirected 
      ? outgoing.map(e => e.target)
      : graph.getNeighbors(v).map(n => n.id).filter(id => id !== v);

    for (const w of neighbors) {
      const edge = graph.getEdgeByNodes(v, w);
      if (edge) {
        sb.setState((vs, data) => {
          vs.edgeStates.set(edge.id, 'active');
          vs.highlightedEdge = edge.id;
        });
      }

      if (!dfn.has(w)) {
        sb.addStep(`  树边 ${v}→${w}：节点 ${w} 未访问，递归处理`);
        strongConnect(w);
        const newLow = Math.min(low.get(v)!, low.get(w)!);
        low.set(v, newLow);

        sb.setState((vs, data) => {
          data.low = Object.fromEntries(low);
        });
        sb.addStep(`  回溯：low[${v}] = min(low[${v}]=${dfn.get(v)}, low[${w}]=${low.get(w)}) = ${newLow}`);
      } else if (onStack.has(w)) {
        const newLow = Math.min(low.get(v)!, dfn.get(w)!);
        low.set(v, newLow);

        sb.setState((vs, data) => {
          data.low = Object.fromEntries(low);
        });
        sb.addStep(`  回边 ${v}→${w}：${w} 在栈中，low[${v}] = min(${low.get(v)}, dfn[${w}]=${dfn.get(w)}) = ${newLow}`);
      } else {
        if (edge) {
          sb.setState((vs, data) => {
            vs.edgeStates.set(edge.id, 'visited');
          });
        }
        sb.addStep(`  横叉边 ${v}→${w}：已访问且不在栈中，忽略`);
      }
    }

    if (low.get(v) === dfn.get(v)) {
      const component: NodeId[] = [];
      let w: NodeId;
      const color = COMPONENT_COLORS[colorIdx % COMPONENT_COLORS.length];
      colorIdx++;

      sb.setState((vs, data) => {
        data.components = components.map(c => [...c]);
      });
      sb.addStep(`━━ dfn[${v}] = low[${v}] = ${dfn.get(v)}，找到强连通分量！`);

      do {
        w = stack.pop()!;
        onStack.delete(w);
        component.push(w);

        sb.setState((vs, data) => {
          data.stack = [...stack];
          data.onStack = Object.fromEntries([...onStack].map(x => [x, true]));
          vs.nodeStates.set(w, 'in-component');
          vs.nodeColors.set(w, color);
        });
      } while (w !== v);

      components.push(component);

      sb.setState((vs, data) => {
        data.components = components.map(c => [...c]);
      });
      sb.addStep(`✓ 分量：{ ${component.join(', ')} }`);

      sb.setState((vs, data) => {
        for (let i = 0; i < component.length; i++) {
          for (let j = i + 1; j < component.length; j++) {
            const e1 = graph.getEdgeByNodes(component[i], component[j]);
            const e2 = graph.getEdgeByNodes(component[j], component[i]);
            if (e1) vs.edgeStates.set(e1.id, 'in-component');
            if (e2) vs.edgeStates.set(e2.id, 'in-component');
          }
        }
      });
    }
  }

  for (const v of nodeIds) {
    if (!dfn.has(v)) {
      sb.addStep(`开始处理未访问节点 ${v}`);
      strongConnect(v);
    }
  }

  sb.setState((vs, data) => {
    data.result = { components: components.map(c => [...c]) };
    components.forEach((comp, idx) => {
      const color = COMPONENT_COLORS[idx % COMPONENT_COLORS.length];
      comp.forEach(n => {
        vs.nodeColors.set(n, color);
        vs.nodeStates.set(n, 'in-component');
      });
    });
  });

  const compStr = components.map((c, i) => `C${i + 1}={${c.join(',')}}`).join(', ');
  sb.addStep(`Tarjan 完成！共找到 ${components.length} 个强连通分量：${compStr}`);

  return sb.getSteps();
}
