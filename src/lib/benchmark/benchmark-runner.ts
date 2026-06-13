import type { AlgorithmType } from '../types';
import type { GraphModelParams } from './graph-generator';
import { generateGraph, estimateEdgeCount } from './graph-generator';
import { runBFS } from '../algorithms/traversal';
import { runDFS } from '../algorithms/traversal';
import { runDijkstra, runBellmanFord, runFloydWarshall } from '../algorithms/shortest-path';
import { runKruskal, runPrim } from '../algorithms/mst';
import { runEdmondsKarp, runKahn, runTarjan } from '../algorithms/advanced';
import { ALGORITHM_INFO } from '../algorithms/registry';

export type VariationMode = 'node-count' | 'parameter';

export type ParameterName = 'p' | 'k' | 'beta' | 'm';

export interface BenchmarkResult {
  graphModel: string;
  nodeCount: number;
  edgeCount: number;
  algorithmName: string;
  executionTimeMs: number;
  repeatIndex: number;
  paramValue?: number;
  paramName?: ParameterName;
}

export interface BenchmarkConfig {
  graphModel: GraphModelParams;
  algorithms: AlgorithmType[];
  nodeSizes: number[];
  repeatCount: number;
  variationMode: VariationMode;
  fixedNodeCount?: number;
  paramName?: ParameterName;
  paramStart?: number;
  paramEnd?: number;
  paramStep?: number;
}

export interface SavedBenchmarkRecord {
  id: string;
  name: string;
  savedAt: number;
  config: BenchmarkConfig;
  results: BenchmarkResult[];
  aggregatedResults: BenchmarkResult[];
}

export interface TheoreticalCurvePoint {
  x: number;
  y: number;
  complexityValue: number;
}

export interface DeviationWarning {
  x: number;
  y: number;
  expectedY: number;
  deviationPercent: number;
  reason: string;
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
  currentNodeCount: number;
  currentParamValue?: number;
  currentParamName?: ParameterName;
  xAxisLabel: string;
  xAxisValue: number;
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
    const variationMode = config.variationMode || 'node-count';
    
    let scales: { nodeCount: number; paramValue?: number; paramName?: ParameterName }[] = [];
    
    if (variationMode === 'node-count') {
      scales = config.nodeSizes.map(n => ({ nodeCount: n }));
    } else {
      const paramValues: number[] = [];
      if (config.paramStart !== undefined && config.paramEnd !== undefined && config.paramStep !== undefined) {
        for (let v = config.paramStart; v <= config.paramEnd + 1e-9; v += config.paramStep) {
          paramValues.push(Math.round(v * 10000) / 10000);
        }
      }
      scales = paramValues.map(v => ({
        nodeCount: config.fixedNodeCount || 100,
        paramValue: v,
        paramName: config.paramName
      }));
    }
    
    const totalScales = scales.length;
    const totalAlgorithms = config.algorithms.length;
    const graphModelName = getGraphModelName(config.graphModel);

    for (let si = 0; si < scales.length; si++) {
      if (this.stopped) break;

      const scale = scales[si];
      const graphParams = createGraphParamsWithVariation(
        config.graphModel,
        scale.nodeCount,
        scale.paramName,
        scale.paramValue
      );

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

          const isParamMode = variationMode === 'parameter';
          const xLabel = isParamMode && scale.paramName 
            ? getParamDisplayName(scale.paramName) 
            : '节点数';
          const xVal = isParamMode && scale.paramValue !== undefined
            ? scale.paramValue
            : scale.nodeCount;

          const progress: BenchmarkProgress = {
            currentScaleIndex: si,
            totalScales,
            currentAlgorithmIndex: ai,
            totalAlgorithms,
            currentRepeat: ri,
            totalRepeats: config.repeatCount,
            elapsedTimeMs: elapsed,
            estimatedRemainingMs: estimatedRemaining,
            currentNodeCount: scale.nodeCount,
            currentParamValue: scale.paramValue,
            currentParamName: scale.paramName,
            xAxisLabel: xLabel,
            xAxisValue: xVal
          };

          callback(progress, [...results]);

          const testGraph = generateGraph(graphParams);
          const execTime = runAlgorithmCore(algoType, testGraph);

          results.push({
            graphModel: graphModelName,
            nodeCount: scale.nodeCount,
            edgeCount: testGraph.getEdgeCount(),
            algorithmName: algoName,
            executionTimeMs: execTime,
            repeatIndex: ri,
            paramValue: scale.paramValue,
            paramName: scale.paramName
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

function createGraphParamsWithVariation(
  base: GraphModelParams,
  n: number,
  paramName?: ParameterName,
  paramValue?: number
): GraphModelParams {
  switch (base.type) {
    case 'erdos-renyi':
      return {
        type: 'erdos-renyi',
        n,
        p: paramName === 'p' && paramValue !== undefined ? paramValue : base.p
      };
    case 'watts-strogatz':
      return {
        type: 'watts-strogatz',
        n,
        k: paramName === 'k' && paramValue !== undefined ? Math.min(Math.floor(paramValue), n - 1) : Math.min(base.k, n - 1),
        beta: paramName === 'beta' && paramValue !== undefined ? paramValue : base.beta
      };
    case 'barabasi-albert':
      return {
        type: 'barabasi-albert',
        n,
        m: paramName === 'm' && paramValue !== undefined ? Math.min(Math.floor(paramValue), n - 1) : Math.min(base.m, n - 1)
      };
  }
}

export function calculateComplexityValue(
  algoType: AlgorithmType,
  nodeCount: number,
  edgeCount: number
): number {
  const V = nodeCount;
  const E = edgeCount;
  
  switch (algoType) {
    case 'bfs':
    case 'dfs':
    case 'kahn':
    case 'tarjan':
      return V + E;
    case 'dijkstra':
    case 'prim':
      return (V + E) * Math.log2(Math.max(V, 2));
    case 'bellman-ford':
      return V * E;
    case 'floyd-warshall':
      return V * V * V;
    case 'kruskal':
      return E * Math.log2(Math.max(E, 2));
    case 'edmonds-karp':
      return V * E * E;
    default:
      return V + E;
  }
}

export function fitTheoreticalCurve(
  xValues: number[],
  measuredY: number[],
  complexityValues: number[]
): { coefficient: number; fittedY: number[] } {
  if (xValues.length === 0 || complexityValues.length === 0) {
    return { coefficient: 0, fittedY: [] };
  }

  let sumXY = 0;
  let sumX2 = 0;
  
  for (let i = 0; i < Math.min(measuredY.length, complexityValues.length); i++) {
    if (measuredY[i] > 0 && complexityValues[i] > 0) {
      sumXY += complexityValues[i] * measuredY[i];
      sumX2 += complexityValues[i] * complexityValues[i];
    }
  }

  const coefficient = sumX2 > 0 ? sumXY / sumX2 : 0;
  const fittedY = complexityValues.map(c => coefficient * c);

  return { coefficient, fittedY };
}

export function detectDeviations(
  xValues: number[],
  measuredY: number[],
  theoreticalY: number[],
  edgeCounts: number[],
  nodeCounts: number[]
): DeviationWarning[] {
  const warnings: DeviationWarning[] = [];
  const threshold = 0.5;

  for (let i = 0; i < Math.min(measuredY.length, theoreticalY.length); i++) {
    if (theoreticalY[i] <= 0) continue;
    
    const deviationPercent = Math.abs(measuredY[i] - theoreticalY[i]) / theoreticalY[i];
    
    if (deviationPercent > threshold) {
      let reason = '';
      const edgeDensity = edgeCounts[i] / (nodeCounts[i] * (nodeCounts[i] - 1) / 2);
      
      if (i === 0 || i === measuredY.length - 1) {
        reason = '可能受初始化/缓存效应影响';
      } else if (edgeDensity > 0.5) {
        reason = '图密度过高导致E远大于V';
      } else if (measuredY[i] > theoreticalY[i] * 2) {
        reason = '可能受GC影响或系统资源波动';
      } else if (measuredY[i] < theoreticalY[i] * 0.3) {
        reason = '实测远快于理论，可能数据规模过小或有优化效应';
      } else {
        reason = '实测值偏离理论预测';
      }

      warnings.push({
        x: xValues[i],
        y: measuredY[i],
        expectedY: theoreticalY[i],
        deviationPercent,
        reason
      });
    }
  }

  return warnings;
}

const STORAGE_KEY = 'graph-algo-benchmark-records';

export function saveBenchmarkRecord(record: Omit<SavedBenchmarkRecord, 'id' | 'savedAt'>): SavedBenchmarkRecord {
  const records = loadBenchmarkRecords();
  const newRecord: SavedBenchmarkRecord = {
    ...record,
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    savedAt: Date.now()
  };
  records.push(newRecord);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  return newRecord;
}

export function loadBenchmarkRecords(): SavedBenchmarkRecord[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function deleteBenchmarkRecord(id: string): void {
  const records = loadBenchmarkRecords().filter(r => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export { estimateEdgeCount, getGraphModelName, createGraphParams, createGraphParamsWithVariation };

export function getParamDisplayName(name: ParameterName): string {
  switch (name) {
    case 'p': return '边概率 p';
    case 'k': return '邻居数 k';
    case 'beta': return '重连概率 β';
    case 'm': return '新增边数 m';
  }
}

export function aggregateResults(results: BenchmarkResult[]): BenchmarkResult[] {
  const grouped = new Map<string, BenchmarkResult[]>();

  for (const r of results) {
    const paramPart = r.paramValue !== undefined ? `|${r.paramValue}|${r.paramName}` : '';
    const key = `${r.graphModel}|${r.nodeCount}|${r.algorithmName}${paramPart}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(r);
  }

  const aggregated: BenchmarkResult[] = [];
  for (const [, group] of grouped) {
    if (group.length === 0) continue;
    const avgTime = group.reduce((sum, r) => sum + r.executionTimeMs, 0) / group.length;
    const avgEdgeCount = group.reduce((sum, r) => sum + r.edgeCount, 0) / group.length;
    aggregated.push({
      graphModel: group[0].graphModel,
      nodeCount: group[0].nodeCount,
      edgeCount: Math.round(avgEdgeCount),
      algorithmName: group[0].algorithmName,
      executionTimeMs: Math.round(avgTime * 1000) / 1000,
      repeatIndex: -1,
      paramValue: group[0].paramValue,
      paramName: group[0].paramName
    });
  }

  return aggregated;
}
