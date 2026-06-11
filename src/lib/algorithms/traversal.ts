import type { Graph } from '../graph';
import type { AlgorithmStep, NodeId } from '../types';
import { StepBuilder } from './step-builder';

export function runBFS(graph: Graph, startId: NodeId): AlgorithmStep[] {
  const sb = new StepBuilder();
  const nodes = graph.getAllNodes();
  const nodeIds = nodes.map(n => n.id);

  sb.setState((vs, data) => {
    data.queue = [];
    data.visited = [];
    data.order = [];
    vs.nodeStates.clear();
    vs.edgeStates.clear();
  });
  sb.addStep(`初始化：创建空队列和已访问集合，准备从节点 ${startId} 开始遍历`);

  if (!graph.getNode(startId)) {
    return sb.getSteps();
  }

  const visited = new Set<NodeId>();
  const queue: NodeId[] = [startId];
  const order: NodeId[] = [];

  sb.setState((vs, data) => {
    data.queue = [...queue];
    data.visited = [...visited];
    data.order = [...order];
    vs.nodeStates.set(startId, 'in-queue');
  });
  sb.addStep(`将起始节点 ${startId} 加入队列`);

  while (queue.length > 0) {
    const current = queue.shift()!;
    
    sb.setState((vs, data) => {
      data.queue = [...queue];
      data.visited = [...visited];
      data.order = [...order];
      vs.nodeStates.set(current, 'current');
      vs.highlightedNode = current;
    });
    sb.addStep(`从队列取出节点 ${current}，作为当前处理节点`);

    if (!visited.has(current)) {
      visited.add(current);
      order.push(current);

      sb.setState((vs, data) => {
        data.queue = [...queue];
        data.visited = [...visited];
        data.order = [...order];
        vs.nodeStates.set(current, 'visited');
      });
      sb.addStep(`将节点 ${current} 标记为已访问`);

      const neighbors = graph.getNeighbors(current);
      for (const neighbor of neighbors) {
        const edge = graph.getEdgeByNodes(current, neighbor.id);
        if (!visited.has(neighbor.id) && !queue.includes(neighbor.id)) {
          queue.push(neighbor.id);
          
          sb.setState((vs, data) => {
            data.queue = [...queue];
            data.visited = [...visited];
            data.order = [...order];
            vs.nodeStates.set(neighbor.id, 'in-queue');
            if (edge) {
              vs.edgeStates.set(edge.id, 'active');
              vs.highlightedEdge = edge.id;
            }
          });
          sb.addStep(`访问节点 ${current} 的邻居 ${neighbor.id}，未访问过，加入队列`);
        } else if (edge) {
          sb.setState((vs, data) => {
            data.queue = [...queue];
            data.visited = [...visited];
            data.order = [...order];
            vs.edgeStates.set(edge.id, 'visited');
            vs.highlightedEdge = edge.id;
          });
          sb.addStep(`检查边 ${current}→${neighbor.id}，节点 ${neighbor.id} 已访问或已在队列中`);
        }
      }
    }

    sb.setState((vs, data) => {
      data.queue = [...queue];
      data.visited = [...visited];
      data.order = [...order];
      vs.nodeStates.set(current, 'finished');
      vs.highlightedNode = null;
      vs.highlightedEdge = null;
    });
  }

  sb.setState((vs, data) => {
    data.queue = [...queue];
    data.visited = [...visited];
    data.order = [...order];
    data.result = order.join(' → ');
  });
  sb.addStep(`BFS 完成！遍历顺序：${order.join(' → ')}`);

  return sb.getSteps();
}

export function runDFS(graph: Graph, startId: NodeId): AlgorithmStep[] {
  const sb = new StepBuilder();
  const nodes = graph.getAllNodes();

  sb.setState((vs, data) => {
    data.stack = [];
    data.visited = [];
    data.order = [];
    data.discoveryTime = {};
    data.finishTime = {};
    vs.nodeStates.clear();
    vs.edgeStates.clear();
  });
  sb.addStep(`初始化：创建空栈和时间戳，准备从节点 ${startId} 开始 DFS`);

  if (!graph.getNode(startId)) {
    return sb.getSteps();
  }

  const visited = new Set<NodeId>();
  const stack: NodeId[] = [];
  const order: NodeId[] = [];
  const discoveryTime = new Map<NodeId, number>();
  const finishTime = new Map<NodeId, number>();
  let time = 0;

  function dfs(nodeId: NodeId, parentId: NodeId | null): void {
    stack.push(nodeId);
    time++;
    discoveryTime.set(nodeId, time);

    sb.setState((vs, data) => {
      data.stack = [...stack];
      data.visited = [...visited];
      data.order = [...order];
      data.discoveryTime = Object.fromEntries(discoveryTime);
      data.finishTime = Object.fromEntries(finishTime);
      vs.nodeStates.set(nodeId, 'in-stack');
      vs.highlightedNode = nodeId;
      if (parentId !== null) {
        const edge = graph.getEdgeByNodes(parentId, nodeId);
        if (edge) vs.edgeStates.set(edge.id, 'active');
      }
    });
    sb.addStep(`进入节点 ${nodeId}，发现时间戳 = ${time}，压入栈`);

    visited.add(nodeId);
    order.push(nodeId);

    sb.setState((vs, data) => {
      data.stack = [...stack];
      data.visited = [...visited];
      data.order = [...order];
      data.discoveryTime = Object.fromEntries(discoveryTime);
      data.finishTime = Object.fromEntries(finishTime);
      vs.nodeStates.set(nodeId, 'current');
    });
    sb.addStep(`将节点 ${nodeId} 标记为已访问，开始探索其邻居`);

    const neighbors = graph.getNeighbors(nodeId);
    for (const neighbor of neighbors) {
      const edge = graph.getEdgeByNodes(nodeId, neighbor.id);
      if (!visited.has(neighbor.id)) {
        sb.setState((vs, data) => {
          if (edge) {
            vs.edgeStates.set(edge.id, 'active');
            vs.highlightedEdge = edge.id;
          }
        });
        sb.addStep(`发现未访问的邻居节点 ${neighbor.id}，递归深入`);
        
        dfs(neighbor.id, nodeId);

        sb.setState((vs, data) => {
          data.stack = [...stack];
          data.visited = [...visited];
          data.order = [...order];
          data.discoveryTime = Object.fromEntries(discoveryTime);
          data.finishTime = Object.fromEntries(finishTime);
          vs.nodeStates.set(nodeId, 'current');
          vs.highlightedNode = nodeId;
        });
        sb.addStep(`回溯：从 ${neighbor.id} 返回到节点 ${nodeId}`);
      } else if (edge) {
        sb.setState((vs, data) => {
          vs.edgeStates.set(edge.id, 'visited');
          vs.highlightedEdge = edge.id;
        });
        sb.addStep(`检查边 ${nodeId}→${neighbor.id}，节点 ${neighbor.id} 已访问，跳过`);
      }
    }

    time++;
    finishTime.set(nodeId, time);
    stack.pop();

    sb.setState((vs, data) => {
      data.stack = [...stack];
      data.visited = [...visited];
      data.order = [...order];
      data.discoveryTime = Object.fromEntries(discoveryTime);
      data.finishTime = Object.fromEntries(finishTime);
      vs.nodeStates.set(nodeId, 'finished');
      vs.highlightedNode = null;
    });
    sb.addStep(`节点 ${nodeId} 所有邻居探索完毕，完成时间戳 = ${time}，弹出栈`);
  }

  dfs(startId, null);

  const remaining = nodes.filter(n => !visited.has(n.id));
  for (const node of remaining) {
    if (!visited.has(node.id)) {
      sb.setState((vs, data) => {
        data.stack = [...stack];
        data.visited = [...visited];
        data.order = [...order];
      });
      sb.addStep(`发现未访问的节点 ${node.id}（另一连通分量），继续 DFS`);
      dfs(node.id, null);
    }
  }

  sb.setState((vs, data) => {
    data.stack = [...stack];
    data.visited = [...visited];
    data.order = [...order];
    data.discoveryTime = Object.fromEntries(discoveryTime);
    data.finishTime = Object.fromEntries(finishTime);
    data.result = order.join(' → ');
  });
  sb.addStep(`DFS 完成！遍历顺序：${order.join(' → ')}`);

  return sb.getSteps();
}
