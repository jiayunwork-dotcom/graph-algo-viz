import { Graph } from '../graph';

export type GraphModelType = 'erdos-renyi' | 'watts-strogatz' | 'barabasi-albert';

export interface ErdosRenyiParams {
  type: 'erdos-renyi';
  n: number;
  p: number;
}

export interface WattsStrogatzParams {
  type: 'watts-strogatz';
  n: number;
  k: number;
  beta: number;
}

export interface BarabasiAlbertParams {
  type: 'barabasi-albert';
  n: number;
  m: number;
}

export type GraphModelParams = ErdosRenyiParams | WattsStrogatzParams | BarabasiAlbertParams;

export function estimateEdgeCount(params: GraphModelParams): number {
  switch (params.type) {
    case 'erdos-renyi':
      return Math.round(params.n * (params.n - 1) / 2 * params.p);
    case 'watts-strogatz':
      return Math.round(params.n * params.k / 2);
    case 'barabasi-albert':
      return Math.round((params.n - params.m) * params.m);
  }
}

function ensureConnected(graph: Graph): void {
  const nodes = graph.getAllNodes();
  if (nodes.length === 0) return;

  const nodeIds = nodes.map(n => n.id);
  const visited = new Set<number>();
  const queue: number[] = [nodeIds[0]];
  visited.add(nodeIds[0]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = graph.getNeighbors(current);
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor.id)) {
        visited.add(neighbor.id);
        queue.push(neighbor.id);
      }
    }
  }

  if (visited.size === nodeIds.length) return;

  const unvisited = nodeIds.filter(id => !visited.has(id));
  for (const nodeId of unvisited) {
    let connected = false;
    for (const visitedId of visited) {
      const edge = graph.getEdgeByNodes(visitedId, nodeId);
      if (!edge) {
        graph.addEdge(visitedId, nodeId, 1);
        connected = true;
        visited.add(nodeId);
        const newNeighbors = graph.getNeighbors(nodeId);
        for (const nb of newNeighbors) {
          if (!visited.has(nb.id)) {
            visited.add(nb.id);
          }
        }
        break;
      }
    }
    if (!connected) {
      const firstVisited = visited.values().next().value;
      if (firstVisited !== undefined) {
        graph.addEdge(firstVisited, nodeId, 1);
        visited.add(nodeId);
      }
    }
  }
}

function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function generateErdosRenyi(n: number, p: number): Graph {
  const graph = new Graph();
  graph.settings = { mode: 'undirected', isWeighted: false, isDirected: false, isFlow: false };

  for (let i = 1; i <= n; i++) {
    graph.addNodeWithId(i, 0, 0, String(i));
  }

  for (let i = 1; i <= n; i++) {
    for (let j = i + 1; j <= n; j++) {
      if (Math.random() < p) {
        graph.addEdge(i, j, 1);
      }
    }
  }

  ensureConnected(graph);
  return graph;
}

export function generateWattsStrogatz(n: number, k: number, beta: number): Graph {
  const graph = new Graph();
  graph.settings = { mode: 'undirected', isWeighted: false, isDirected: false, isFlow: false };

  const halfK = Math.floor(k / 2);

  for (let i = 0; i < n; i++) {
    graph.addNodeWithId(i + 1, 0, 0, String(i + 1));
  }

  for (let i = 0; i < n; i++) {
    for (let j = 1; j <= halfK; j++) {
      const neighbor = (i + j) % n;
      const u = i + 1;
      const v = neighbor + 1;
      const existingEdge = graph.getEdgeByNodes(u, v);
      if (!existingEdge) {
        graph.addEdge(u, v, 1);
      }
    }
  }

  const allEdges = graph.getAllEdges();
  for (const edge of allEdges) {
    if (Math.random() < beta) {
      const source = edge.source;
      let newTarget: number;
      let attempts = 0;
      do {
        newTarget = Math.floor(Math.random() * n) + 1;
        attempts++;
      } while (
        (newTarget === source ||
          graph.getEdgeByNodes(source, newTarget) !== undefined) &&
        attempts < n * 2
      );

      if (newTarget !== source && graph.getEdgeByNodes(source, newTarget) === undefined) {
        graph.removeEdge(edge.id);
        graph.addEdge(source, newTarget, 1);
      }
    }
  }

  ensureConnected(graph);
  return graph;
}

export function generateBarabasiAlbert(n: number, m: number): Graph {
  const graph = new Graph();
  graph.settings = { mode: 'undirected', isWeighted: false, isDirected: false, isFlow: false };

  const m0 = Math.max(m, 2);

  for (let i = 1; i <= m0; i++) {
    graph.addNodeWithId(i, 0, 0, String(i));
  }

  for (let i = 1; i <= m0; i++) {
    for (let j = i + 1; j <= m0; j++) {
      graph.addEdge(i, j, 1);
    }
  }

  const degrees = new Map<number, number>();
  for (let i = 1; i <= m0; i++) {
    degrees.set(i, m0 - 1);
  }

  let totalDegree = m0 * (m0 - 1);

  for (let newNode = m0 + 1; newNode <= n; newNode++) {
    graph.addNodeWithId(newNode, 0, 0, String(newNode));

    const targets = new Set<number>();
    const maxAttempts = n * 10;
    let attempts = 0;

    while (targets.size < m && attempts < maxAttempts) {
      let r = Math.random() * totalDegree;
      let selected = -1;

      for (const [nodeId, deg] of degrees) {
        r -= deg;
        if (r <= 0) {
          selected = nodeId;
          break;
        }
      }

      if (selected === -1) {
        const existingNodes = Array.from(degrees.keys());
        selected = existingNodes[existingNodes.length - 1];
      }

      if (selected > 0 && !targets.has(selected)) {
        targets.add(selected);
      }
      attempts++;
    }

    if (targets.size < m) {
      const existingNodes = Array.from(degrees.keys());
      const shuffled = shuffleArray(existingNodes);
      for (const nodeId of shuffled) {
        if (targets.size >= m) break;
        if (!targets.has(nodeId)) {
          targets.add(nodeId);
        }
      }
    }

    for (const target of targets) {
      graph.addEdge(newNode, target, 1);
      degrees.set(newNode, (degrees.get(newNode) || 0) + 1);
      degrees.set(target, (degrees.get(target) || 0) + 1);
      totalDegree += 2;
    }
  }

  ensureConnected(graph);
  return graph;
}

export function generateGraph(params: GraphModelParams): Graph {
  switch (params.type) {
    case 'erdos-renyi':
      return generateErdosRenyi(params.n, params.p);
    case 'watts-strogatz':
      return generateWattsStrogatz(params.n, params.k, params.beta);
    case 'barabasi-albert':
      return generateBarabasiAlbert(params.n, params.m);
  }
}
