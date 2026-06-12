import type { AlgorithmType } from '../types';
import type { GraphModelParams } from './graph-generator';
import { generateGraph, estimateEdgeCount } from './graph-generator';
import { runBFS } from '../algorithms/traversal';
import { runDFS } from '../algorithms/traversal';
import { runDijkstra, runBellmanFord, runFloydWarshall } from '../algorithms/shortest-path';
import { runKruskal, runPrim } from '../algorithms/mst';
import { runEdmondsKarp, runKahn, runTarjan } from '../algorithms/advanced';
import { ALGORITHM_INFO } from '../algorithms/registry';

export interface BenchmarkResult {
  graphModel: string;
  nodeCount: number;
  edgeCount: number;
  algorithmName: string;
  executionTimeMs: number;
  repeatIndex: number;
}

export interface BenchmarkConfig {
  graphModel: GraphModelParams;
  algorithms: AlgorithmType[];
  nodeSizes: number[];
  repeatCount: number;
}

export interface BenchmarkProgress {
  currentScaleIndex: number;
  totalScales: number;
  currentAlgorithmIndex: number;
  totalAlgorithms: number;
  currentRepeat: number;
  totalRepeats: number;
  elapsedTimeMs: number;
  estimatedRemainingMs: number;
}

export type BenchmarkCallback = (progress: BenchmarkProgress, partialResults: BenchmarkResult[]) => void;

function runAlgorithmCore(type: AlgorithmType, graph: ReturnType<typeof generateGraph>): number {
  const nodeIds = graph.getAllNodes().map(n => n.id).sort((a, b) => a - b);
  const startNode = nodeIds[0];
  const sinkNode = nodeIds[nodeIds.length - 1];

  const t0 = performance.now();

  switch (type) {
    case 'bfs':
      runBFS(graph, startNode);
      break;
    case 'dfs':
      runDFS(graph, startNode);
      break;
    case 'dijkstra':
      runDijkstra(graph, startNode);
      break;
    case 'bellman-ford':
      runBellmanFord(graph, startNode);
      break;
    case 'floyd-warshall':
      runFloydWarshall(graph);
      break;
    case 'kruskal':
      runKruskal(graph);
      break;
    case 'prim':
      runPrim(graph, startNode);
      break;
    case 'edmonds-karp':
      runEdmondsKarp(graph, startNode, sinkNode);
      break;
    case 'kahn':
      runKahn(graph);
      break;
    case 'tarjan':
      runTarjan(graph);
      break;
  }

  const t1 = performance.now();
  return t1 - t0;
}

export class BenchmarkRunner {
  private stopped = false;
  private startTime = 0;

  stop(): void {
    this.stopped = true;
  }

  isStopped(): boolean {
    return this.stopped;
  }

  async run(config: BenchmarkConfig, callback: BenchmarkCallback): Promise<BenchmarkResult[]> {
    this.stopped = false;
    this.startTime = performance.now();
    const results: BenchmarkResult[] = [];
    const totalScales = config.nodeSizes.length;
    const totalAlgorithms = config.algorithms.length;
    const graphModelName = getGraphModelName(config.graphModel);

    for (let si = 0; si < config.nodeSizes.length; si++) {
      if (this.stopped) break;

      const nodeSize = config.nodeSizes[si];
      const graphParams = createGraphParams(config.graphModel, nodeSize);

      for (let ai = 0; ai < config.algorithms.length; ai++) {
        if (this.stopped) break;

        const algoType = config.algorithms[ai];
        const algoName = ALGORITHM_INFO[algoType].name;

        for (let ri = 0; ri < config.repeatCount; ri++) {
          if (this.stopped) break;

          const elapsed = performance.now() - this.startTime;
          const avgTimePerOp = si > 0 || ai > 0 || ri > 0
            ? elapsed / results.length
            : 0;
          const remainingOps = (totalScales - si - 1) * totalAlgorithms * config.repeatCount
            + (totalAlgorithms - ai - 1) * config.repeatCount
            + (config.repeatCount - ri - 1);
          const estimatedRemaining = avgTimePerOp > 0 ? avgTimePerOp * remainingOps : 0;

          const progress: BenchmarkProgress = {
            currentScaleIndex: si,
            totalScales,
            currentAlgorithmIndex: ai,
            totalAlgorithms,
            currentRepeat: ri,
            totalRepeats: config.repeatCount,
            elapsedTimeMs: elapsed,
            estimatedRemainingMs: estimatedRemaining
          };

          callback(progress, [...results]);

          const testGraph = generateGraph(graphParams);
          const execTime = runAlgorithmCore(algoType, testGraph);

          results.push({
            graphModel: graphModelName,
            nodeCount: nodeSize,
            edgeCount: testGraph.getEdgeCount(),
            algorithmName: algoName,
            executionTimeMs: execTime,
            repeatIndex: ri
          });

          await new Promise<void>(resolve => setTimeout(resolve, 0));
        }
      }
    }

    return results;
  }
}

function getGraphModelName(params: GraphModelParams): string {
  switch (params.type) {
    case 'erdos-renyi': return 'Erdős-Rényi';
    case 'watts-strogatz': return 'Watts-Strogatz';
    case 'barabasi-albert': return 'Barabási-Albert';
  }
}

function createGraphParams(base: GraphModelParams, n: number): GraphModelParams {
  switch (base.type) {
    case 'erdos-renyi':
      return { type: 'erdos-renyi', n, p: base.p };
    case 'watts-strogatz':
      return { type: 'watts-strogatz', n, k: Math.min(base.k, n - 1), beta: base.beta };
    case 'barabasi-albert':
      return { type: 'barabasi-albert', n, m: Math.min(base.m, n - 1) };
  }
}

export { estimateEdgeCount, getGraphModelName, createGraphParams };

export function aggregateResults(results: BenchmarkResult[]): BenchmarkResult[] {
  const grouped = new Map<string, BenchmarkResult[]>();

  for (const r of results) {
    const key = `${r.graphModel}|${r.nodeCount}|${r.algorithmName}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(r);
  }

  const aggregated: BenchmarkResult[] = [];
  for (const [, group] of grouped) {
    if (group.length === 0) continue;
    const avgTime = group.reduce((sum, r) => sum + r.executionTimeMs, 0) / group.length;
    aggregated.push({
      graphModel: group[0].graphModel,
      nodeCount: group[0].nodeCount,
      edgeCount: group[0].edgeCount,
      algorithmName: group[0].algorithmName,
      executionTimeMs: Math.round(avgTime * 1000) / 1000,
      repeatIndex: -1
    });
  }

  return aggregated;
}
