<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { AlgorithmType } from '../lib/types';
  import { ALGORITHM_INFO } from '../lib/algorithms/registry';
  import type { GraphModelType, GraphModelParams } from '../lib/benchmark/graph-generator';
  import { estimateEdgeCount } from '../lib/benchmark/graph-generator';
  import {
    BenchmarkRunner,
    aggregateResults,
    saveBenchmarkRecord,
    loadBenchmarkRecords,
    deleteBenchmarkRecord,
    calculateComplexityValue,
    fitTheoreticalCurve,
    detectDeviations,
    type BenchmarkResult,
    type BenchmarkProgress,
    type BenchmarkConfig,
    type SavedBenchmarkRecord,
    type VariationMode,
    type ParameterName,
    type DeviationWarning
  } from '../lib/benchmark/benchmark-runner';

  export let isRunning: boolean = false;

  const dispatch = createEventDispatcher<{
    close: void;
    runningChange: boolean;
  }>();

  const ALGORITHM_COLORS: Record<string, string> = {
    'BFS 广度优先搜索': '#6366f1',
    'DFS 深度优先搜索': '#8b5cf6',
    'Dijkstra 单源最短路径': '#3b82f6',
    'Bellman-Ford 最短路径': '#06b6d4',
    'Floyd-Warshall 全源最短路径': '#0ea5e9',
    'Kruskal 最小生成树': '#10b981',
    'Prim 最小生成树': '#f59e0b',
    'Edmonds-Karp 最大流': '#ef4444',
    'Kahn 拓扑排序': '#f97316',
    'Tarjan 强连通分量': '#ec4899'
  };

  let graphModel: GraphModelType = 'erdos-renyi';

  let erN: number = 100;
  let erP: number = 0.1;

  let wsN: number = 100;
  let wsK: number = 6;
  let wsBeta: number = 0.3;

  let baN: number = 100;
  let baM: number = 3;

  let selectedAlgorithms: Set<AlgorithmType> = new Set(['bfs', 'dfs', 'dijkstra', 'kruskal']);
  let sizeStart: number = 20;
  let sizeEnd: number = 200;
  let sizeStep: number = 20;
  let repeatCount: number = 3;

  let runner: BenchmarkRunner | null = null;
  let testing: boolean = false;
  let progress: BenchmarkProgress | null = null;
  let results: BenchmarkResult[] = [];
  let aggregatedResults: BenchmarkResult[] = [];

  let selectedBarNodeCount: number | null = null;
  let highlightedNodeCount: number | null = null;

  let lineChartCanvas: HTMLCanvasElement;
  let barChartCanvas: HTMLCanvasElement;

  let lineTooltipData: { x: number; y: number; text: string } | null = null;
  let barTooltipData: { x: number; y: number; text: string } | null = null;
  let warningTooltipData: { x: number; y: number; text: string } | null = null;

  let savedRecords: SavedBenchmarkRecord[] = loadBenchmarkRecords();
  let selectedRecordId: string | null = null;
  let comparisonMode: boolean = false;
  let comparisonRecordIds: Set<string> = new Set();
  let showSaveDialog: boolean = false;
  let saveName: string = '';
  let showHistoryDropdown: boolean = false;

  let showTheoreticalCurves: boolean = false;

  let variationMode: VariationMode = 'node-count';
  let fixedNodeCount: number = 100;
  let varyingParamName: ParameterName = 'p';
  let paramStart: number = 0.05;
  let paramEnd: number = 0.5;
  let paramStep: number = 0.05;

  const LINE_STYLES = [
    { dash: [], name: '实线' },
    { dash: [8, 4], name: '虚线' },
    { dash: [2, 2], name: '点线' }
  ];

  const FILL_PATTERNS = ['solid', 'diagonal', 'dots'] as const;

  const PARAM_LABELS: Record<ParameterName, string> = {
    'p': '边概率 p',
    'k': '邻居数 k',
    'beta': '重连概率 β',
    'm': '新增边数 m'
  };

  const PARAM_RANGES: Record<ParameterName, { min: number; max: number; step: number }> = {
    'p': { min: 0.01, max: 1, step: 0.01 },
    'k': { min: 2, max: 50, step: 1 },
    'beta': { min: 0, max: 1, step: 0.01 },
    'm': { min: 1, max: 20, step: 1 }
  };

  const ALGORITHM_TO_TYPE: Record<string, AlgorithmType> = {};
  for (const [type, info] of Object.entries(ALGORITHM_INFO)) {
    ALGORITHM_TO_TYPE[info.name] = type as AlgorithmType;
  }

  const allAlgorithms: AlgorithmType[] = [
    'bfs', 'dfs', 'dijkstra', 'bellman-ford', 'floyd-warshall',
    'kruskal', 'prim', 'edmonds-karp', 'kahn', 'tarjan'
  ];

  let currentParams: GraphModelParams;
  $: currentParams = (() => {
    const n = variationMode === 'parameter' ? fixedNodeCount : erN;
    switch (graphModel) {
      case 'erdos-renyi': return { type: 'erdos-renyi', n, p: erP };
      case 'watts-strogatz': return { type: 'watts-strogatz', n, k: wsK, beta: wsBeta };
      case 'barabasi-albert': return { type: 'barabasi-albert', n, m: baM };
    }
  })();

  $: estimatedEdges = estimateEdgeCount(currentParams);

  let availableParamsForModel: ParameterName[];
  $: availableParamsForModel = (() => {
    switch (graphModel) {
      case 'erdos-renyi': return ['p'];
      case 'watts-strogatz': return ['k', 'beta'];
      case 'barabasi-albert': return ['m'];
    }
  })();

  $: paramValues = (() => {
    if (variationMode !== 'parameter') return [];
    const values: number[] = [];
    for (let v = paramStart; v <= paramEnd + 1e-9; v += paramStep) {
      values.push(Math.round(v * 10000) / 10000);
    }
    return values;
  })();

  $: nodeSizes = (() => {
    const sizes: number[] = [];
    for (let s = sizeStart; s <= sizeEnd; s += sizeStep) {
      sizes.push(s);
    }
    return sizes;
  })();

  $: xAxisValues = (() => {
    if (variationMode === 'parameter') {
      return paramValues;
    }
    return nodeSizes;
  })();

  $: xAxisLabel = (() => {
    if (variationMode === 'parameter') {
      return PARAM_LABELS[varyingParamName] || '参数值';
    }
    return '节点数';
  })();

  $: comparisonDatasets = (() => {
    if (!comparisonMode || comparisonRecordIds.size === 0) {
      return [{
        name: '当前',
        results: aggregatedResults,
        config: null,
        lineStyle: LINE_STYLES[0]
      }];
    }
    
    const datasets: {
      name: string;
      results: BenchmarkResult[];
      config: BenchmarkConfig | null;
      lineStyle: typeof LINE_STYLES[0];
    }[] = [];
    
    const recordArray = Array.from(comparisonRecordIds);
    for (let i = 0; i < Math.min(recordArray.length, 3); i++) {
      const recordId = recordArray[i];
      const record = savedRecords.find(r => r.id === recordId);
      if (record) {
        datasets.push({
          name: record.name,
          results: record.aggregatedResults,
          config: record.config,
          lineStyle: LINE_STYLES[i % LINE_STYLES.length]
        });
      }
    }
    
    return datasets;
  })();

  $: progressPercent = progress
    ? ((progress.currentScaleIndex * progress.totalAlgorithms * progress.totalRepeats
        + progress.currentAlgorithmIndex * progress.totalRepeats
        + progress.currentRepeat)
      / (progress.totalScales * progress.totalAlgorithms * progress.totalRepeats)) * 100
    : 0;

  $: formatTime = (ms: number): string => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    const s = ms / 1000;
    if (s < 60) return `${s.toFixed(1)}s`;
    const min = Math.floor(s / 60);
    const sec = Math.round(s % 60);
    return `${min}m${sec}s`;
  };

  function toggleAlgorithm(type: AlgorithmType) {
    if (testing) return;
    const newSet = new Set(selectedAlgorithms);
    if (newSet.has(type)) {
      newSet.delete(type);
    } else {
      newSet.add(type);
    }
    selectedAlgorithms = newSet;
  }

  function selectAllAlgorithms() {
    if (testing) return;
    selectedAlgorithms = new Set(allAlgorithms);
  }

  function deselectAllAlgorithms() {
    if (testing) return;
    selectedAlgorithms = new Set();
  }

  async function startTest() {
    if (selectedAlgorithms.size === 0) return;
    if (variationMode === 'node-count' && nodeSizes.length === 0) return;
    if (variationMode === 'parameter' && paramValues.length === 0) return;

    testing = true;
    isRunning = true;
    dispatch('runningChange', true);
    results = [];
    aggregatedResults = [];
    progress = null;
    selectedBarNodeCount = null;
    highlightedNodeCount = null;
    comparisonMode = false;
    comparisonRecordIds = new Set();

    runner = new BenchmarkRunner();

    const config: BenchmarkConfig = {
      graphModel: currentParams,
      algorithms: Array.from(selectedAlgorithms),
      nodeSizes,
      repeatCount,
      variationMode,
      fixedNodeCount: variationMode === 'parameter' ? fixedNodeCount : undefined,
      paramName: variationMode === 'parameter' ? varyingParamName : undefined,
      paramStart: variationMode === 'parameter' ? paramStart : undefined,
      paramEnd: variationMode === 'parameter' ? paramEnd : undefined,
      paramStep: variationMode === 'parameter' ? paramStep : undefined
    };

    try {
      const testResults = await runner.run(config, (p, _partial) => {
        progress = p;
      });

      if (!runner.isStopped()) {
        results = testResults;
        aggregatedResults = aggregateResults(testResults);

        if (aggregatedResults.length > 0) {
          const nodeCounts = [...new Set(aggregatedResults.map(r => r.nodeCount))].sort((a, b) => a - b);
          if (nodeCounts.length > 0) {
            selectedBarNodeCount = nodeCounts[Math.floor(nodeCounts.length / 2)];
          }
        }

        requestAnimationFrame(() => {
          drawLineChart();
          drawBarChart();
        });
      }
    } catch (e) {
      console.error('Benchmark failed:', e);
    }

    testing = false;
    isRunning = false;
    dispatch('runningChange', false);
  }

  function stopTest() {
    if (runner) {
      runner.stop();
      if (results.length > 0) {
        aggregatedResults = aggregateResults(results);
        requestAnimationFrame(() => {
          drawLineChart();
          drawBarChart();
        });
      }
    }
  }

  function handleClose() {
    if (testing) {
      stopTest();
    }
    dispatch('close');
  }

  function drawLineChart() {
    if (!lineChartCanvas) return;
    const ctx = lineChartCanvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = lineChartCanvas.getBoundingClientRect();
    lineChartCanvas.width = rect.width * dpr;
    lineChartCanvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;
    const padL = 70;
    const padR = 30;
    const padT = 30;
    const padB = 50;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    const allData = comparisonDatasets.flatMap(ds => ds.results);
    if (allData.length === 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('暂无测试数据', W / 2, H / 2);
      return;
    }

    const xValues = [...new Set(allData.map(r => getXValue(r)))].sort((a, b) => a - b);
    const algoNames = [...new Set(allData.map(r => r.algorithmName))];

    let maxTime = 0;
    for (const r of allData) {
      if (r.executionTimeMs > maxTime) maxTime = r.executionTimeMs;
    }

    const allTheoreticalData: {
      algoName: string;
      datasetName: string;
      xValues: number[];
      theoreticalY: number[];
      coefficient: number;
    }[] = [];

    if (showTheoreticalCurves) {
      for (const ds of comparisonDatasets) {
        for (const algoName of algoNames) {
          const algoType = ALGORITHM_TO_TYPE[algoName];
          if (!algoType) continue;

          const algoResults = ds.results.filter(r => r.algorithmName === algoName);
          if (algoResults.length === 0) continue;

          const xs: number[] = [];
          const ys: number[] = [];
          const complexityVals: number[] = [];
          const nodeCounts: number[] = [];
          const edgeCounts: number[] = [];

          for (const r of algoResults) {
            xs.push(getXValue(r));
            ys.push(r.executionTimeMs);
            complexityVals.push(calculateComplexityValue(algoType, r.nodeCount, r.edgeCount));
            nodeCounts.push(r.nodeCount);
            edgeCounts.push(r.edgeCount);
          }

          const { coefficient, fittedY } = fitTheoreticalCurve(xs, ys, complexityVals);
          if (coefficient > 0) {
            allTheoreticalData.push({
              algoName,
              datasetName: ds.name,
              xValues: xs,
              theoreticalY: fittedY,
              coefficient
            });

            for (const y of fittedY) {
              if (y > maxTime) maxTime = y;
            }
          }
        }
      }
    }

    maxTime = maxTime * 1.15;
    if (maxTime === 0) maxTime = 1;

    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = padT + chartH - (i / gridLines) * chartH;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + chartW, y);
      ctx.stroke();

      const val = (i / gridLines) * maxTime;
      ctx.fillStyle = '#64748b';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(val.toFixed(1) + 'ms', padL - 8, y + 4);
    }

    for (let i = 0; i < xValues.length; i++) {
      const x = padL + (i / Math.max(xValues.length - 1, 1)) * chartW;
      ctx.strokeStyle = '#e5e7eb';
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, padT + chartH);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      const xLabel = variationMode === 'parameter' 
        ? (xValues[i] < 0.01 ? xValues[i].toExponential(2) : xValues[i].toFixed(2))
        : String(xValues[i]);
      ctx.fillText(xLabel, x, padT + chartH + 20);
    }

    ctx.fillStyle = '#374151';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(xAxisLabel, padL + chartW / 2, H - 5);

    ctx.save();
    ctx.translate(14, padT + chartH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('执行时间 (ms)', 0, 0);
    ctx.restore();

    const allChartPoints: {
      x: number;
      y: number;
      time: number;
      xValue: number;
      algoName: string;
      datasetName: string;
    }[] = [];

    for (let dsIdx = 0; dsIdx < comparisonDatasets.length; dsIdx++) {
      const ds = comparisonDatasets[dsIdx];
      const lineStyle = ds.lineStyle;

      for (const algoName of algoNames) {
        const color = ALGORITHM_COLORS[algoName] || '#6366f1';
        const points: { x: number; y: number; time: number; xValue: number }[] = [];

        for (const xv of xValues) {
          const r = ds.results.find(d => d.algorithmName === algoName && getXValue(d) === xv);
          if (r) {
            const x = padL + (xValues.indexOf(xv) / Math.max(xValues.length - 1, 1)) * chartW;
            const y = padT + chartH - (r.executionTimeMs / maxTime) * chartH;
            points.push({ x, y, time: r.executionTimeMs, xValue: xv });
            allChartPoints.push({ x, y, time: r.executionTimeMs, xValue: xv, algoName, datasetName: ds.name });
          }
        }

        if (points.length > 1) {
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.setLineDash(lineStyle.dash);
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
          }
          ctx.stroke();
          ctx.setLineDash([]);
        }

        for (const p of points) {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    if (showTheoreticalCurves) {
      for (const td of allTheoreticalData) {
        const color = ALGORITHM_COLORS[td.algoName] || '#6366f1';
        const ds = comparisonDatasets.find(d => d.name === td.datasetName);
        if (!ds) continue;

        const points: { x: number; y: number }[] = [];
        for (let i = 0; i < td.xValues.length; i++) {
          const xv = td.xValues[i];
          const xvIdx = xValues.indexOf(xv);
          if (xvIdx < 0) continue;
          const x = padL + (xvIdx / Math.max(xValues.length - 1, 1)) * chartW;
          const y = padT + chartH - (td.theoreticalY[i] / maxTime) * chartH;
          points.push({ x, y });
        }

        if (points.length > 1) {
          ctx.strokeStyle = color + '80';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
          }
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }

    const allWarnings: DeviationWarning[] = [];
    if (showTheoreticalCurves && comparisonDatasets.length > 0) {
      for (const ds of comparisonDatasets) {
        for (const algoName of algoNames) {
          const algoType = ALGORITHM_TO_TYPE[algoName];
          if (!algoType) continue;

          const algoResults = ds.results.filter(r => r.algorithmName === algoName);
          if (algoResults.length === 0) continue;

          const xs: number[] = [];
          const ys: number[] = [];
          const complexityVals: number[] = [];
          const nodeCounts: number[] = [];
          const edgeCounts: number[] = [];

          for (const r of algoResults) {
            xs.push(getXValue(r));
            ys.push(r.executionTimeMs);
            complexityVals.push(calculateComplexityValue(algoType, r.nodeCount, r.edgeCount));
            nodeCounts.push(r.nodeCount);
            edgeCounts.push(r.edgeCount);
          }

          const { fittedY } = fitTheoreticalCurve(xs, ys, complexityVals);
          const warnings = detectDeviations(xs, ys, fittedY, edgeCounts, nodeCounts);

          for (const w of warnings) {
            const xvIdx = xValues.indexOf(w.x);
            if (xvIdx < 0) continue;
            const x = padL + (xvIdx / Math.max(xValues.length - 1, 1)) * chartW;
            const y = padT + chartH - (w.y / maxTime) * chartH;
            
            allWarnings.push({
              ...w,
              x,
              y
            });
          }
        }
      }

      for (const w of allWarnings) {
        ctx.fillStyle = '#fbbf24';
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const size = 10;
        ctx.moveTo(w.x, w.y - size);
        ctx.lineTo(w.x - size * 0.866, w.y + size * 0.5);
        ctx.lineTo(w.x + size * 0.866, w.y + size * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#92400e';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('!', w.x, w.y + 4);
      }
    }

    if (highlightedNodeCount !== null && xValues.includes(highlightedNodeCount)) {
      const x = padL + (xValues.indexOf(highlightedNodeCount) / Math.max(xValues.length - 1, 1)) * chartW;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, padT + chartH);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const legendX = padL + 10;
    let legendY = padT + 12;
    const legendEntries: { label: string; color: string; dash: number[]; isTheoretical?: boolean }[] = [];

    if (comparisonMode) {
      for (let dsIdx = 0; dsIdx < comparisonDatasets.length; dsIdx++) {
        const ds = comparisonDatasets[dsIdx];
        for (const algoName of algoNames) {
          const hasData = ds.results.some(r => r.algorithmName === algoName);
          if (!hasData) continue;
          const color = ALGORITHM_COLORS[algoName] || '#6366f1';
          const shortName = algoName.split(' ')[0];
          legendEntries.push({
            label: `${shortName}(${ds.name})`,
            color,
            dash: ds.lineStyle.dash
          });
        }
      }
    } else {
      for (const algoName of algoNames) {
        const color = ALGORITHM_COLORS[algoName] || '#6366f1';
        legendEntries.push({
          label: algoName,
          color,
          dash: []
        });
      }
    }

    if (showTheoreticalCurves) {
      const addedTheoretical = new Set<string>();
      for (const td of allTheoreticalData) {
        const key = td.algoName;
        if (addedTheoretical.has(key)) continue;
        addedTheoretical.add(key);
        const color = ALGORITHM_COLORS[td.algoName] || '#6366f1';
        const shortName = td.algoName.split(' ')[0];
        const complexity = ALGORITHM_INFO[ALGORITHM_TO_TYPE[td.algoName]]?.timeComplexity || 'O(?)';
        legendEntries.push({
          label: `${shortName}理论${complexity}`,
          color: color + '80',
          dash: [4, 4],
          isTheoretical: true
        });
      }
    }

    for (const entry of legendEntries) {
      ctx.strokeStyle = entry.color;
      ctx.lineWidth = entry.isTheoretical ? 1.5 : 2;
      ctx.setLineDash(entry.dash);
      ctx.beginPath();
      ctx.moveTo(legendX, legendY - 4);
      ctx.lineTo(legendX + 14, legendY - 4);
      ctx.stroke();
      ctx.setLineDash([]);

      if (!entry.isTheoretical) {
        ctx.fillStyle = entry.color;
        ctx.beginPath();
        ctx.arc(legendX + 7, legendY - 4, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#374151';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(entry.label, legendX + 20, legendY);
      legendY += 18;
    }

    (lineChartCanvas as any)._chartData = {
      padL, padR, padT, padB, chartW, chartH,
      algoNames, xValues, maxTime, allData, allChartPoints, allWarnings, comparisonDatasets
    };
  }

  function drawBarChart() {
    if (!barChartCanvas) return;
    const ctx = barChartCanvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = barChartCanvas.getBoundingClientRect();
    barChartCanvas.width = rect.width * dpr;
    barChartCanvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;
    const padL = 70;
    const padR = 30;
    const padT = 50;
    const padB = 70;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    const selectedXVal = selectedBarNodeCountNum;
    const allData = comparisonDatasets.flatMap(ds => ds.results);
    
    if (allData.length === 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('暂无测试数据', W / 2, H / 2);
      return;
    }

    const xValues = [...new Set(allData.map(r => getXValue(r)))].sort((a, b) => a - b);
    
    if (selectedXVal === null || !xValues.includes(selectedXVal)) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('请选择一个规模点', W / 2, H / 2);
      return;
    }

    const algoNames = [...new Set(allData.map(r => r.algorithmName))];
    const numDatasets = comparisonDatasets.length;

    let maxTime = 0;
    for (const ds of comparisonDatasets) {
      for (const r of ds.results) {
        if (getXValue(r) === selectedXVal && r.executionTimeMs > maxTime) {
          maxTime = r.executionTimeMs;
        }
      }
    }
    maxTime = maxTime * 1.2;
    if (maxTime === 0) maxTime = 1;

    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = padT + chartH - (i / gridLines) * chartH;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + chartW, y);
      ctx.stroke();

      const val = (i / gridLines) * maxTime;
      ctx.fillStyle = '#64748b';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(val.toFixed(1) + 'ms', padL - 8, y + 4);
    }

    const barPositions: { x: number; y: number; w: number; h: number; algoName: string; time: number; datasetName: string }[] = [];

    if (comparisonMode && numDatasets > 1) {
      const groupWidth = chartW / algoNames.length;
      const barWidth = Math.min(25, (groupWidth * 0.7) / numDatasets);
      const barGap = 2;

      for (let algoIdx = 0; algoIdx < algoNames.length; algoIdx++) {
        const algoName = algoNames[algoIdx];
        const groupX = padL + algoIdx * groupWidth;

        for (let dsIdx = 0; dsIdx < numDatasets; dsIdx++) {
          const ds = comparisonDatasets[dsIdx];
          const r = ds.results.find(d => d.algorithmName === algoName && getXValue(d) === selectedXVal);
          
          if (r) {
            const barH = (r.executionTimeMs / maxTime) * chartH;
            const x = groupX + (groupWidth - barWidth * numDatasets - barGap * (numDatasets - 1)) / 2 + dsIdx * (barWidth + barGap);
            const y = padT + chartH - barH;
            const color = ALGORITHM_COLORS[algoName] || '#6366f1';
            const pattern = FILL_PATTERNS[dsIdx % FILL_PATTERNS.length];

            drawPattern(ctx, x, y, barWidth, barH, pattern, color);

            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, barWidth, barH);

            barPositions.push({ x, y, w: barWidth, h: barH, algoName, time: r.executionTimeMs, datasetName: ds.name });
          }
        }

        ctx.fillStyle = '#374151';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        const shortName = algoName.length > 8 ? algoName.slice(0, 7) + '…' : algoName;
        ctx.fillText(shortName, groupX + groupWidth / 2, padT + chartH + 15);
      }

      const legendX = padL + 10;
      let legendY = 20;
      for (let dsIdx = 0; dsIdx < numDatasets; dsIdx++) {
        const ds = comparisonDatasets[dsIdx];
        const pattern = FILL_PATTERNS[dsIdx % FILL_PATTERNS.length];
        
        ctx.fillStyle = '#374151';
        ctx.fillRect(legendX, legendY - 8, 16, 12);
        drawPattern(ctx, legendX, legendY - 8, 16, 12, pattern, '#6366f1');
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 1;
        ctx.strokeRect(legendX, legendY - 8, 16, 12);
        
        ctx.fillStyle = '#374151';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(ds.name, legendX + 22, legendY + 1);
        legendY += 18;
      }
    } else {
      const groupWidth = chartW / algoNames.length;
      const barWidth = Math.min(40, groupWidth * 0.6);

      for (let algoIdx = 0; algoIdx < algoNames.length; algoIdx++) {
        const algoName = algoNames[algoIdx];
        const r = comparisonDatasets[0].results.find(d => d.algorithmName === algoName && getXValue(d) === selectedXVal);
        
        if (r) {
          const barH = (r.executionTimeMs / maxTime) * chartH;
          const x = padL + algoIdx * groupWidth + (groupWidth - barWidth) / 2;
          const y = padT + chartH - barH;
          const color = ALGORITHM_COLORS[algoName] || '#6366f1';

          const gradient = ctx.createLinearGradient(x, y, x, padT + chartH);
          gradient.addColorStop(0, color);
          gradient.addColorStop(1, color + '66');
          ctx.fillStyle = gradient;

          const radius = 3;
          ctx.beginPath();
          ctx.moveTo(x + radius, y);
          ctx.lineTo(x + barWidth - radius, y);
          ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
          ctx.lineTo(x + barWidth, padT + chartH);
          ctx.lineTo(x, padT + chartH);
          ctx.lineTo(x, y + radius);
          ctx.quadraticCurveTo(x, y, x + radius, y);
          ctx.closePath();
          ctx.fill();

          barPositions.push({ x, y, w: barWidth, h: barH, algoName, time: r.executionTimeMs, datasetName: comparisonDatasets[0].name });
        }

        ctx.fillStyle = '#374151';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        const shortName = algoName.length > 8 ? algoName.slice(0, 7) + '…' : algoName;
        ctx.fillText(shortName, padL + algoIdx * groupWidth + groupWidth / 2, padT + chartH + 15);
      }
    }

    ctx.fillStyle = '#374151';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    const xLabel = variationMode === 'parameter'
      ? `${xAxisLabel}: ${selectedXVal < 0.01 ? selectedXVal.toExponential(2) : selectedXVal.toFixed(2)}`
      : `节点数: ${selectedXVal}`;
    ctx.fillText(xLabel, W / 2, 20);

    (barChartCanvas as any)._chartData = {
      padL, padR, padT, padB, chartW, chartH,
      algoNames, maxTime, barPositions, comparisonDatasets, selectedXVal
    };
  }

  function handleLineChartMouseMove(e: MouseEvent) {
    if (!lineChartCanvas) return;
    const cd = (lineChartCanvas as any)._chartData;
    if (!cd) return;

    const rect = lineChartCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const { allChartPoints, allWarnings } = cd;

    let closest: { x: number; y: number; text: string; dist: number } | null = null;

    for (const p of allChartPoints) {
      const dist = Math.sqrt((mx - p.x) ** 2 + (my - p.y) ** 2);
      if (dist < 15 && (!closest || dist < closest.dist)) {
        const xLabel = variationMode === 'parameter'
          ? `${xAxisLabel}: ${p.xValue < 0.01 ? p.xValue.toExponential(2) : p.xValue.toFixed(2)}`
          : `节点: ${p.xValue}`;
        const datasetLabel = comparisonMode ? `[${p.datasetName}] ` : '';
        closest = { 
          x: p.x, 
          y: p.y, 
          text: `${datasetLabel}${p.algoName}\n${xLabel}, 时间: ${p.time.toFixed(3)}ms`, 
          dist 
        };
      }
    }

    let closestWarning: { x: number; y: number; text: string; dist: number } | null = null;
    for (const w of allWarnings) {
      const dist = Math.sqrt((mx - w.x) ** 2 + (my - w.y) ** 2);
      if (dist < 15 && (!closestWarning || dist < closestWarning.dist)) {
        closestWarning = {
          x: w.x,
          y: w.y,
          text: `⚠️ 偏离理论值 ${(w.deviationPercent * 100).toFixed(0)}%\n预期: ${w.expectedY.toFixed(3)}ms\n实测: ${w.y.toFixed(3)}ms\n${w.reason}`,
          dist
        };
      }
    }

    lineTooltipData = closest;
    warningTooltipData = closestWarning;
  }

  function handleLineChartMouseLeave() {
    lineTooltipData = null;
    warningTooltipData = null;
  }

  function handleBarChartMouseMove(e: MouseEvent) {
    if (!barChartCanvas) return;
    const cd = (barChartCanvas as any)._chartData;
    if (!cd) return;

    const rect = barChartCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const { barPositions, comparisonMode } = cd;

    let found: { x: number; y: number; text: string } | null = null;
    for (const bp of barPositions) {
      if (mx >= bp.x && mx <= bp.x + bp.w && my >= bp.y && my <= bp.y + bp.h) {
        const prefix = comparisonMode && bp.datasetName !== '当前' ? `[${bp.datasetName}] ` : '';
        found = {
          x: bp.x + bp.w / 2,
          y: bp.y - 5,
          text: `${prefix}${bp.algoName}: ${bp.time.toFixed(3)}ms`
        };
        break;
      }
    }

    barTooltipData = found;
  }

  function handleBarChartMouseLeave() {
    barTooltipData = null;
  }

  function handleBarChartClick(e: MouseEvent) {
    if (!barChartCanvas) return;
    const cd = (barChartCanvas as any)._chartData;
    if (!cd) return;

    if (selectedBarNodeCountNum !== null) {
      highlightedNodeCount = selectedBarNodeCountNum;
      requestAnimationFrame(() => {
        drawLineChart();
      });
    }
  }

  function handleVaryingParamChange() {
    const range = PARAM_RANGES[varyingParamName];
    if (graphModel === 'erdos-renyi') {
      if (varyingParamName === 'p') {
        paramStart = Math.max(range.min, Math.min(range.max, erP * 0.5));
        paramEnd = Math.max(range.min, Math.min(range.max, erP * 1.5));
        paramStep = 0.05;
      }
    } else if (graphModel === 'watts-strogatz') {
      if (varyingParamName === 'k') {
        paramStart = Math.max(range.min, Math.min(range.max, Math.floor(wsK * 0.5)));
        paramEnd = Math.max(range.min, Math.min(range.max, Math.floor(wsK * 1.5)));
        paramStep = 1;
      } else if (varyingParamName === 'beta') {
        paramStart = Math.max(range.min, Math.min(range.max, wsBeta * 0.5));
        paramEnd = Math.max(range.min, Math.min(range.max, wsBeta * 1.5));
        paramStep = 0.05;
      }
    } else if (graphModel === 'barabasi-albert') {
      if (varyingParamName === 'm') {
        paramStart = Math.max(range.min, Math.min(range.max, Math.floor(baM * 0.5)));
        paramEnd = Math.max(range.min, Math.min(range.max, Math.floor(baM * 1.5)));
        paramStep = 1;
      }
    }
  }

  $: if (graphModel && availableParamsForModel.length > 0 && !availableParamsForModel.includes(varyingParamName)) {
    varyingParamName = availableParamsForModel[0];
    handleVaryingParamChange();
  }

  function exportCSV() {
    if (results.length === 0) return;
    const header = '图模型,节点数,边数,算法名,执行时间ms,重复次数';
    const rows = results.map(r =>
      `${r.graphModel},${r.nodeCount},${r.edgeCount},${r.algorithmName},${r.executionTimeMs.toFixed(3)},${r.repeatIndex + 1}`
    );
    const csvContent = '\uFEFF' + header + '\n' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `benchmark-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportChartPNG() {
    const sourceCanvas = lineChartCanvas;
    if (!sourceCanvas) return;

    const tempCanvas = document.createElement('canvas');
    const W = 1200;
    const H = 700;
    const dpr = 2;
    tempCanvas.width = W * dpr;
    tempCanvas.height = H * dpr;
    const ctx = tempCanvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('算法性能基准测试 - 折线图', W / 2, 30);

    ctx.drawImage(sourceCanvas, 30, 50, W - 60, H - 80);

    const url = tempCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `benchmark-chart-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
    a.click();
  }

  function openSaveDialog() {
    if (aggregatedResults.length === 0) return;
    saveName = generateDefaultRecordName();
    showSaveDialog = true;
  }

  function generateDefaultRecordName(): string {
    const modelPart = graphModel === 'erdos-renyi' ? 'ER' : graphModel === 'watts-strogatz' ? 'WS' : 'BA';
    if (variationMode === 'parameter') {
      return `${modelPart} ${PARAM_LABELS[varyingParamName]?.split(' ')[0]}=${paramStart}-${paramEnd}`;
    }
    const paramPart = graphModel === 'erdos-renyi' ? `p=${erP}` : graphModel === 'watts-strogatz' ? `k=${wsK},β=${wsBeta}` : `m=${baM}`;
    return `${modelPart} ${paramPart}`;
  }

  function handleSaveRecord() {
    if (!saveName.trim() || aggregatedResults.length === 0) return;

    const config: BenchmarkConfig = {
      graphModel: currentParams,
      algorithms: Array.from(selectedAlgorithms),
      nodeSizes,
      repeatCount,
      variationMode,
      fixedNodeCount: variationMode === 'parameter' ? fixedNodeCount : undefined,
      paramName: variationMode === 'parameter' ? varyingParamName : undefined,
      paramStart: variationMode === 'parameter' ? paramStart : undefined,
      paramEnd: variationMode === 'parameter' ? paramEnd : undefined,
      paramStep: variationMode === 'parameter' ? paramStep : undefined
    };

    saveBenchmarkRecord({
      name: saveName.trim(),
      config,
      results: [...results],
      aggregatedResults: [...aggregatedResults]
    });

    savedRecords = loadBenchmarkRecords();
    showSaveDialog = false;
  }

  function loadRecord(recordId: string) {
    const record = savedRecords.find(r => r.id === recordId);
    if (!record) return;

    comparisonMode = false;
    comparisonRecordIds = new Set();
    selectedRecordId = recordId;

    results = [...record.results];
    aggregatedResults = [...record.aggregatedResults];

    const config = record.config;
    graphModel = config.graphModel.type;
    variationMode = config.variationMode || 'node-count';

    if (config.graphModel.type === 'erdos-renyi') {
      erN = config.graphModel.n;
      erP = config.graphModel.p;
    } else if (config.graphModel.type === 'watts-strogatz') {
      wsN = config.graphModel.n;
      wsK = config.graphModel.k;
      wsBeta = config.graphModel.beta;
    } else if (config.graphModel.type === 'barabasi-albert') {
      baN = config.graphModel.n;
      baM = config.graphModel.m;
    }

    if (config.variationMode === 'parameter') {
      fixedNodeCount = config.fixedNodeCount || 100;
      varyingParamName = config.paramName || 'p';
      paramStart = config.paramStart || 0.05;
      paramEnd = config.paramEnd || 0.5;
      paramStep = config.paramStep || 0.05;
    }

    selectedAlgorithms = new Set(config.algorithms);
    sizeStart = config.nodeSizes[0] || 20;
    sizeEnd = config.nodeSizes[config.nodeSizes.length - 1] || 200;
    sizeStep = config.nodeSizes.length > 1 ? config.nodeSizes[1] - config.nodeSizes[0] : 20;
    repeatCount = config.repeatCount;

    if (aggregatedResults.length > 0) {
      const xValues = [...new Set(aggregatedResults.map(r => 
        variationMode === 'parameter' ? r.paramValue! : r.nodeCount
      ))].sort((a, b) => a - b);
      if (xValues.length > 0) {
        selectedBarNodeCount = variationMode === 'parameter' ? xValues[Math.floor(xValues.length / 2)] : xValues[Math.floor(xValues.length / 2)];
      }
    }

    showHistoryDropdown = false;
    requestAnimationFrame(() => {
      drawLineChart();
      drawBarChart();
    });
  }

  function toggleComparisonRecord(recordId: string) {
    const newSet = new Set(comparisonRecordIds);
    if (newSet.has(recordId)) {
      newSet.delete(recordId);
    } else if (newSet.size < 3) {
      newSet.add(recordId);
    }
    comparisonRecordIds = newSet;
    comparisonMode = newSet.size > 0;

    requestAnimationFrame(() => {
      drawLineChart();
      drawBarChart();
    });
  }

  function deleteRecord(recordId: string, e: Event) {
    e.stopPropagation();
    if (confirm('确定要删除这条记录吗？')) {
      deleteBenchmarkRecord(recordId);
      savedRecords = loadBenchmarkRecords();
      if (comparisonRecordIds.has(recordId)) {
        const newSet = new Set(comparisonRecordIds);
        newSet.delete(recordId);
        comparisonRecordIds = newSet;
        comparisonMode = newSet.size > 0;
      }
      if (selectedRecordId === recordId) {
        selectedRecordId = null;
      }
    }
  }

  function clearComparison() {
    comparisonMode = false;
    comparisonRecordIds = new Set();
    requestAnimationFrame(() => {
      drawLineChart();
      drawBarChart();
    });
  }

  function getXValue(result: BenchmarkResult): number {
    if (variationMode === 'parameter') {
      return result.paramValue ?? result.nodeCount;
    }
    return result.nodeCount;
  }

  function drawPattern(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, pattern: typeof FILL_PATTERNS[number], baseColor: string) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    const gradient = ctx.createLinearGradient(x, y, x, y + h);
    gradient.addColorStop(0, baseColor);
    gradient.addColorStop(1, baseColor + '66');
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, w, h);

    if (pattern === 'diagonal') {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      const spacing = 8;
      for (let i = -h; i < w + h; i += spacing) {
        ctx.beginPath();
        ctx.moveTo(x + i, y);
        ctx.lineTo(x + i + h, y + h);
        ctx.stroke();
      }
    } else if (pattern === 'dots') {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      const dotSize = 2;
      const spacing = 6;
      for (let dx = spacing / 2; dx < w; dx += spacing) {
        for (let dy = spacing / 2; dy < h; dy += spacing) {
          ctx.beginPath();
          ctx.arc(x + dx, y + dy, dotSize, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }

  $: if ((aggregatedResults.length > 0 || comparisonDatasets.some(ds => ds.results.length > 0)) && lineChartCanvas && barChartCanvas) {
    requestAnimationFrame(() => {
      drawLineChart();
      drawBarChart();
    });
  }

  $: if (showTheoreticalCurves && lineChartCanvas) {
    requestAnimationFrame(() => {
      drawLineChart();
    });
  }

  $: selectedBarNodeCountNum = selectedBarNodeCount !== null ? Number(selectedBarNodeCount) : null;

  $: if (selectedBarNodeCountNum !== null) {
    highlightedNodeCount = selectedBarNodeCountNum;
    if (barChartCanvas && lineChartCanvas) {
      requestAnimationFrame(() => {
        drawBarChart();
        drawLineChart();
      });
    }
  } else if (barChartCanvas) {
    requestAnimationFrame(() => {
      drawBarChart();
    });
  }

  $: if (variationMode === 'parameter' && aggregatedResults.length > 0) {
    const xValues = [...new Set(aggregatedResults.map(r => r.paramValue!))].sort((a, b) => a - b);
    if (xValues.length > 0 && (selectedBarNodeCount === null || !xValues.includes(Number(selectedBarNodeCount)))) {
      selectedBarNodeCount = xValues[Math.floor(xValues.length / 2)];
    }
  }
</script>

<div class="benchmark-panel">
  <div class="panel-header">
    <div class="header-left">
      <span class="header-icon">📈</span>
      <span class="header-title">算法性能基准测试</span>
    </div>
    <div class="header-right">
      <div class="history-dropdown" class:open={showHistoryDropdown}>
        <button 
          class="header-btn" 
          on:click={() => showHistoryDropdown = !showHistoryDropdown}
          disabled={testing}
        >
          📜 历史记录
        </button>
        {#if showHistoryDropdown}
          <div class="dropdown-menu" on:click|stopPropagation>
            <div class="dropdown-header">
              <span>{#if comparisonMode}对比模式 (选{comparisonRecordIds.size}/3){:else}选择记录{/if}</span>
              {#if comparisonMode}
                <button class="clear-compare-btn" on:click={clearComparison}>清除</button>
              {/if}
            </div>
            {#if savedRecords.length === 0}
              <div class="dropdown-empty">暂无保存的记录</div>
            {:else}
              <div class="dropdown-list">
                {#each savedRecords as record}
                  <div 
                    class="dropdown-item"
                    class:selected={selectedRecordId === record.id}
                    class:compared={comparisonRecordIds.has(record.id)}
                    on:click={() => comparisonMode ? toggleComparisonRecord(record.id) : loadRecord(record.id)}
                  >
                    <div class="record-info">
                      <span class="record-name">{record.name}</span>
                      <span class="record-date">{new Date(record.savedAt).toLocaleString()}</span>
                    </div>
                    <div class="record-actions">
                      {#if comparisonMode}
                        <input 
                          type="checkbox" 
                          checked={comparisonRecordIds.has(record.id)}
                          on:change|stopPropagation={() => toggleComparisonRecord(record.id)}
                          disabled={!comparisonRecordIds.has(record.id) && comparisonRecordIds.size >= 3}
                        />
                      {/if}
                      <button class="delete-record-btn" on:click|stopPropagation={(e) => deleteRecord(record.id, e)}>
                        🗑️
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
            <div class="dropdown-footer">
              <label class="compare-mode-toggle">
                <input type="checkbox" bind:checked={comparisonMode} />
                <span>对比模式 (最多选3条)</span>
              </label>
            </div>
          </div>
        {/if}
      </div>
      <button 
        class="header-btn save-btn" 
        on:click={openSaveDialog}
        disabled={aggregatedResults.length === 0 || testing}
      >
        💾 保存结果
      </button>
      <button class="close-btn" on:click={handleClose} disabled={testing}>✕</button>
    </div>
  </div>

  <div class="panel-body">
    <div class="left-panel">
      <div class="config-section">
        <div class="section-title">🎲 随机图模型</div>

        <div class="model-tabs">
          <button class="model-tab" class:active={graphModel === 'erdos-renyi'} on:click={() => graphModel = 'erdos-renyi'} disabled={testing}>
            Erdős-Rényi
          </button>
          <button class="model-tab" class:active={graphModel === 'watts-strogatz'} on:click={() => graphModel = 'watts-strogatz'} disabled={testing}>
            Watts-Strogatz
          </button>
          <button class="model-tab" class:active={graphModel === 'barabasi-albert'} on:click={() => graphModel = 'barabasi-albert'} disabled={testing}>
            Barabási-Albert
          </button>
        </div>

        {#if graphModel === 'erdos-renyi'}
          <div class="param-row">
            <span class="param-label">节点数 n</span>
            <div class="slider-group">
              <input type="range" min={10} max={500} step={1} bind:value={erN} disabled={testing} />
              <input type="number" min={10} max={500} bind:value={erN} disabled={testing} />
            </div>
          </div>
          <div class="param-row">
            <span class="param-label">边概率 p</span>
            <div class="slider-group">
              <input type="range" min={0.01} max={1} step={0.01} bind:value={erP} disabled={testing} />
              <input type="number" min={0.01} max={1} step={0.01} bind:value={erP} disabled={testing} />
            </div>
          </div>
        {:else if graphModel === 'watts-strogatz'}
          <div class="param-row">
            <span class="param-label">节点数 n</span>
            <div class="slider-group">
              <input type="range" min={10} max={500} step={1} bind:value={wsN} disabled={testing} />
              <input type="number" min={10} max={500} bind:value={wsN} disabled={testing} />
            </div>
          </div>
          <div class="param-row">
            <span class="param-label">邻居数 k</span>
            <div class="slider-group">
              <input type="range" min={2} max={50} step={1} bind:value={wsK} disabled={testing} />
              <input type="number" min={2} max={50} bind:value={wsK} disabled={testing} />
            </div>
          </div>
          <div class="param-row">
            <span class="param-label">重连概率 β</span>
            <div class="slider-group">
              <input type="range" min={0} max={1} step={0.01} bind:value={wsBeta} disabled={testing} />
              <input type="number" min={0} max={1} step={0.01} bind:value={wsBeta} disabled={testing} />
            </div>
          </div>
        {:else if graphModel === 'barabasi-albert'}
          <div class="param-row">
            <span class="param-label">节点数 n</span>
            <div class="slider-group">
              <input type="range" min={10} max={500} step={1} bind:value={baN} disabled={testing} />
              <input type="number" min={10} max={500} bind:value={baN} disabled={testing} />
            </div>
          </div>
          <div class="param-row">
            <span class="param-label">新增边数 m</span>
            <div class="slider-group">
              <input type="range" min={1} max={20} step={1} bind:value={baM} disabled={testing} />
              <input type="number" min={1} max={20} bind:value={baM} disabled={testing} />
            </div>
          </div>
        {/if}

        <div class="edge-estimate">
          预估边数：<strong>{estimatedEdges}</strong>
        </div>
      </div>

      <div class="config-section">
        <div class="section-title">🧪 批量测试配置</div>

        <div class="algo-select-header">
          <span>选择算法</span>
          <div class="algo-select-btns">
            <button on:click={selectAllAlgorithms} disabled={testing}>全选</button>
            <button on:click={deselectAllAlgorithms} disabled={testing}>全不选</button>
          </div>
        </div>

        <div class="algo-checkboxes">
          {#each allAlgorithms as type}
            <label class="algo-checkbox" class:disabled={testing}>
              <input type="checkbox" checked={selectedAlgorithms.has(type)} on:change={() => toggleAlgorithm(type)} disabled={testing} />
              <span class="algo-dot" style="background: {ALGORITHM_COLORS[ALGORITHM_INFO[type].name] || '#6366f1'}"></span>
              {ALGORITHM_INFO[type].name}
            </label>
          {/each}
        </div>

        <div class="variation-mode-section">
          <div class="section-subtitle">递变模式</div>
          <div class="radio-group">
            <label class="radio-label">
              <input type="radio" value="node-count" bind:group={variationMode} disabled={testing} />
              <span>节点数递变</span>
            </label>
            <label class="radio-label">
              <input type="radio" value="parameter" bind:group={variationMode} disabled={testing} />
              <span>参数递变</span>
            </label>
          </div>
        </div>

        {#if variationMode === 'node-count'}
          <div class="param-row">
            <span class="param-label">规模起点</span>
            <div class="slider-group compact">
              <input type="number" min={10} max={500} bind:value={sizeStart} disabled={testing} />
            </div>
          </div>
          <div class="param-row">
            <span class="param-label">规模终点</span>
            <div class="slider-group compact">
              <input type="number" min={10} max={500} bind:value={sizeEnd} disabled={testing} />
            </div>
          </div>
          <div class="param-row">
            <span class="param-label">规模步长</span>
            <div class="slider-group compact">
              <input type="number" min={10} max={100} bind:value={sizeStep} disabled={testing} />
            </div>
          </div>
          <div class="scale-preview">
            规模序列：{nodeSizes.join(', ')}（共 {nodeSizes.length} 个点）
          </div>
        {/if}

        {#if variationMode === 'parameter'}
          <div class="param-row">
            <span class="param-label">固定节点数</span>
            <div class="slider-group compact">
              <input type="number" min={10} max={500} bind:value={fixedNodeCount} disabled={testing} />
            </div>
          </div>
          <div class="param-row">
            <span class="param-label">递变参数</span>
            <div class="slider-group compact">
              <select bind:value={varyingParamName} disabled={testing} on:change={handleVaryingParamChange}>
                {#each availableParamsForModel as param}
                  <option value={param}>{PARAM_LABELS[param]}</option>
                {/each}
              </select>
            </div>
          </div>
          <div class="param-row">
            <span class="param-label">参数起点</span>
            <div class="slider-group compact">
              <input 
                type="number" 
                min={PARAM_RANGES[varyingParamName].min} 
                max={PARAM_RANGES[varyingParamName].max} 
                step={PARAM_RANGES[varyingParamName].step}
                bind:value={paramStart} 
                disabled={testing} 
              />
            </div>
          </div>
          <div class="param-row">
            <span class="param-label">参数终点</span>
            <div class="slider-group compact">
              <input 
                type="number" 
                min={PARAM_RANGES[varyingParamName].min} 
                max={PARAM_RANGES[varyingParamName].max} 
                step={PARAM_RANGES[varyingParamName].step}
                bind:value={paramEnd} 
                disabled={testing} 
              />
            </div>
          </div>
          <div class="param-row">
            <span class="param-label">参数步长</span>
            <div class="slider-group compact">
              <input 
                type="number" 
                min={PARAM_RANGES[varyingParamName].step} 
                max={1} 
                step={PARAM_RANGES[varyingParamName].step}
                bind:value={paramStep} 
                disabled={testing} 
              />
            </div>
          </div>
          <div class="scale-preview">
            参数序列：{paramValues.map(v => v < 0.01 ? v.toExponential(2) : v.toFixed(2)).join(', ')}（共 {paramValues.length} 个点）
          </div>
        {/if}

        <div class="param-row">
          <span class="param-label">重复次数</span>
          <div class="slider-group compact">
            <input type="range" min={1} max={10} step={1} bind:value={repeatCount} disabled={testing} />
            <input type="number" min={1} max={10} bind:value={repeatCount} disabled={testing} />
          </div>
        </div>
      </div>

      <div class="action-section">
        {#if testing}
          <button class="stop-btn" on:click={stopTest}>
            ⏹ 停止测试
          </button>
        {:else}
          <button class="start-btn" on:click={startTest} disabled={selectedAlgorithms.size === 0 || nodeSizes.length === 0}>
            ▶️ 开始测试
          </button>
        {/if}
      </div>

      {#if progress}
        <div class="progress-section">
          <div class="progress-info">
            <span>规模 {progress.currentScaleIndex + 1}/{progress.totalScales}</span>
            <span>{formatTime(progress.elapsedTimeMs)} / ~{formatTime(progress.estimatedRemainingMs)} 剩余</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: {progressPercent}%"></div>
          </div>
          <div class="progress-detail">
            当前: 节点数 {nodeSizes[progress.currentScaleIndex]}，{ALGORITHM_INFO[Array.from(selectedAlgorithms)[progress.currentAlgorithmIndex]]?.name || ''}，第 {progress.currentRepeat + 1}/{progress.totalRepeats} 次
          </div>
        </div>
      {/if}
    </div>

    <div class="right-panel">
      <div class="chart-section">
        <div class="chart-header">
          <span class="chart-title">📊 执行时间折线图</span>
          <div class="chart-controls">
            <label class="toggle-switch">
              <input type="checkbox" bind:checked={showTheoreticalCurves} />
              <span class="toggle-slider"></span>
              <span class="toggle-label">显示理论曲线</span>
            </label>
          </div>
        </div>
        <div class="chart-container" style="position: relative;">
          <canvas bind:this={lineChartCanvas} on:mousemove={handleLineChartMouseMove} on:mouseleave={handleLineChartMouseLeave}></canvas>
          {#if lineTooltipData}
            <div class="chart-tooltip" style="left: {lineTooltipData.x + 15}px; top: {lineTooltipData.y - 10}px;">
              {lineTooltipData.text}
            </div>
          {/if}
          {#if warningTooltipData}
            <div class="chart-tooltip warning-tooltip" style="left: {warningTooltipData.x + 15}px; top: {warningTooltipData.y - 10}px;">
              {@html warningTooltipData.text.replace(/\n/g, '<br>')}
            </div>
          {/if}
        </div>
      </div>

      <div class="chart-section">
        <div class="chart-header">
          <span class="chart-title">📊 算法耗时柱状图</span>
          {#if (aggregatedResults.length > 0 || comparisonDatasets.some(ds => ds.results.length > 0))}
            <div class="bar-selector">
              <span class="bar-selector-label">选择{xAxisLabel}：</span>
              <select bind:value={selectedBarNodeCount}>
                {#each xAxisValues as xv}
                  <option value={xv}>
                    {variationMode === 'parameter' 
                      ? (xv < 0.01 ? xv.toExponential(2) : xv.toFixed(2))
                      : `${xv} 个节点`}
                  </option>
                {/each}
              </select>
            </div>
          {/if}
        </div>
        <div class="chart-container" style="position: relative;">
          <canvas bind:this={barChartCanvas} on:mousemove={handleBarChartMouseMove} on:mouseleave={handleBarChartMouseLeave} on:click={handleBarChartClick}></canvas>
          {#if barTooltipData}
            <div class="chart-tooltip" style="left: {barTooltipData.x + 15}px; top: {barTooltipData.y - 30}px;">
              {barTooltipData.text}
            </div>
          {/if}
        </div>
      </div>

      {#if (aggregatedResults.length > 0 || comparisonDatasets.some(ds => ds.results.length > 0))}
        <div class="export-section">
          <button class="export-btn" on:click={exportCSV}>📄 导出CSV</button>
          <button class="export-btn" on:click={exportChartPNG}>🖼️ 导出图表</button>
        </div>
      {/if}
    </div>
  </div>

  {#if showSaveDialog}
    <div class="modal-overlay" on:click={() => showSaveDialog = false}>
      <div class="modal-dialog" on:click|stopPropagation>
        <div class="modal-header">
          <h3>保存测试结果</h3>
          <button class="modal-close" on:click={() => showSaveDialog = false}>✕</button>
        </div>
        <div class="modal-body">
          <label class="modal-label">记录名称</label>
          <input 
            type="text" 
            class="modal-input" 
            bind:value={saveName} 
            placeholder="例如: ER模型 p=0.1"
            autofocus
          />
          <div class="modal-hint">
            保存内容包括：完整测试配置、所有原始数据和聚合结果
          </div>
        </div>
        <div class="modal-footer">
          <button class="modal-btn secondary" on:click={() => showSaveDialog = false}>取消</button>
          <button class="modal-btn primary" on:click={handleSaveRecord} disabled={!saveName.trim()}>保存</button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .benchmark-panel {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: #f8fafc;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    font-size: 13px;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    background: white;
    border-bottom: 1px solid #e5e7eb;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .header-icon {
    font-size: 22px;
  }

  .header-title {
    font-size: 17px;
    font-weight: 700;
    color: #1e293b;
  }

  .close-btn {
    width: 32px;
    height: 32px;
    border: none;
    background: #f1f5f9;
    border-radius: 8px;
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #64748b;
    transition: all 0.15s;
  }

  .close-btn:hover:not(:disabled) {
    background: #fee2e2;
    color: #ef4444;
  }

  .close-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .panel-body {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .left-panel {
    width: 380px;
    flex-shrink: 0;
    border-right: 1px solid #e5e7eb;
    background: white;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .right-panel {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .config-section {
    background: #f8fafc;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 14px;
  }

  .section-title {
    font-size: 14px;
    font-weight: 700;
    color: #1e293b;
    margin-bottom: 12px;
  }

  .model-tabs {
    display: flex;
    gap: 6px;
    margin-bottom: 14px;
  }

  .model-tab {
    flex: 1;
    padding: 7px 4px;
    font-size: 11px;
    font-weight: 600;
    border: 1.5px solid #d1d5db;
    border-radius: 6px;
    background: white;
    color: #64748b;
    cursor: pointer;
    transition: all 0.15s;
    text-align: center;
  }

  .model-tab.active {
    border-color: #6366f1;
    background: #eef2ff;
    color: #4f46e5;
  }

  .model-tab:hover:not(:disabled):not(.active) {
    border-color: #a5b4fc;
    background: #f5f3ff;
  }

  .model-tab:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .param-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  }

  .param-label {
    width: 80px;
    font-size: 12px;
    font-weight: 500;
    color: #475569;
    flex-shrink: 0;
  }

  .slider-group {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .slider-group input[type="range"] {
    flex: 1;
    height: 4px;
    -webkit-appearance: none;
    appearance: none;
    background: #d1d5db;
    border-radius: 2px;
    outline: none;
  }

  .slider-group input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #6366f1;
    cursor: pointer;
  }

  .slider-group input[type="number"] {
    width: 60px;
    padding: 4px 6px;
    font-size: 12px;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    text-align: center;
  }

  .slider-group input[type="number"]:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
  }

  .slider-group.compact input[type="number"] {
    width: 70px;
  }

  .edge-estimate {
    margin-top: 8px;
    padding: 8px 12px;
    background: #ecfdf5;
    border-radius: 6px;
    font-size: 12px;
    color: #065f46;
    border: 1px solid #a7f3d0;
  }

  .edge-estimate strong {
    color: #047857;
    font-weight: 700;
  }

  .algo-select-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    font-size: 12px;
    font-weight: 600;
    color: #475569;
  }

  .algo-select-btns {
    display: flex;
    gap: 4px;
  }

  .algo-select-btns button {
    padding: 2px 8px;
    font-size: 11px;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    background: white;
    color: #64748b;
    cursor: pointer;
  }

  .algo-select-btns button:hover:not(:disabled) {
    background: #f1f5f9;
  }

  .algo-select-btns button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .algo-checkboxes {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 12px;
    max-height: 200px;
    overflow-y: auto;
  }

  .algo-checkbox {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #374151;
    cursor: pointer;
    padding: 3px 4px;
    border-radius: 4px;
    transition: background 0.1s;
  }

  .algo-checkbox:hover:not(.disabled) {
    background: #f1f5f9;
  }

  .algo-checkbox.disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .algo-checkbox input[type="checkbox"] {
    margin: 0;
    accent-color: #6366f1;
  }

  .algo-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .scale-preview {
    margin-top: 6px;
    padding: 6px 10px;
    background: #eff6ff;
    border-radius: 6px;
    font-size: 11px;
    color: #1e40af;
    border: 1px solid #bfdbfe;
  }

  .action-section {
    padding: 0;
  }

  .start-btn {
    width: 100%;
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 700;
    border: none;
    border-radius: 8px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
    transition: all 0.15s;
  }

  .start-btn:hover:not(:disabled) {
    box-shadow: 0 4px 16px rgba(99, 102, 241, 0.45);
    transform: translateY(-1px);
  }

  .start-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  .stop-btn {
    width: 100%;
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 700;
    border: none;
    border-radius: 8px;
    background: linear-gradient(135deg, #ef4444, #dc2626);
    color: white;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
    transition: all 0.15s;
  }

  .stop-btn:hover {
    box-shadow: 0 4px 16px rgba(239, 68, 68, 0.45);
    transform: translateY(-1px);
  }

  .progress-section {
    background: #f8fafc;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 12px;
  }

  .progress-info {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: #475569;
    margin-bottom: 6px;
  }

  .progress-bar {
    height: 8px;
    background: #e5e7eb;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 6px;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #6366f1, #8b5cf6);
    border-radius: 4px;
    transition: width 0.3s;
  }

  .progress-detail {
    font-size: 11px;
    color: #94a3b8;
  }

  .chart-section {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 14px;
  }

  .chart-title {
    font-size: 14px;
    font-weight: 700;
    color: #1e293b;
    margin-bottom: 10px;
  }

  .chart-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
    flex-wrap: wrap;
    gap: 8px;
  }

  .bar-selector {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #475569;
  }

  .bar-selector-label {
    font-size: 12px;
    color: #475569;
  }

  .bar-selector select {
    padding: 4px 8px;
    font-size: 12px;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    background: white;
  }

  .chart-container {
    width: 100%;
    height: 320px;
    position: relative;
  }

  .chart-container canvas {
    width: 100%;
    height: 100%;
  }

  .chart-tooltip {
    position: absolute;
    background: #1e293b;
    color: white;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 11px;
    white-space: pre-line;
    pointer-events: none;
    z-index: 10;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .export-section {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
  }

  .export-btn {
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 600;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    background: white;
    color: #374151;
    cursor: pointer;
    transition: all 0.15s;
  }

  .export-btn:hover {
    background: #f1f5f9;
    border-color: #9ca3af;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-btn {
    padding: 6px 14px;
    font-size: 12px;
    font-weight: 600;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    background: white;
    color: #374151;
    cursor: pointer;
    transition: all 0.15s;
  }

  .header-btn:hover:not(:disabled) {
    background: #f1f5f9;
    border-color: #9ca3af;
  }

  .header-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .header-btn.save-btn {
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    border-color: #059669;
  }

  .header-btn.save-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #059669, #047857);
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
  }

  .history-dropdown {
    position: relative;
  }

  .dropdown-menu {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    width: 320px;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1001;
    overflow: hidden;
  }

  .dropdown-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    background: #f8fafc;
    border-bottom: 1px solid #e5e7eb;
    font-size: 12px;
    font-weight: 600;
    color: #374151;
  }

  .clear-compare-btn {
    padding: 2px 8px;
    font-size: 11px;
    background: #fee2e2;
    color: #dc2626;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .clear-compare-btn:hover {
    background: #fecaca;
  }

  .dropdown-empty {
    padding: 20px;
    text-align: center;
    color: #94a3b8;
    font-size: 12px;
  }

  .dropdown-list {
    max-height: 250px;
    overflow-y: auto;
  }

  .dropdown-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    cursor: pointer;
    border-bottom: 1px solid #f1f5f9;
    transition: background 0.1s;
  }

  .dropdown-item:hover {
    background: #f8fafc;
  }

  .dropdown-item.selected {
    background: #eef2ff;
  }

  .dropdown-item.compared {
    background: #ecfdf5;
  }

  .record-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .record-name {
    font-size: 12px;
    font-weight: 600;
    color: #374151;
  }

  .record-date {
    font-size: 10px;
    color: #94a3b8;
  }

  .record-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .record-actions input[type="checkbox"] {
    accent-color: #10b981;
  }

  .delete-record-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 14px;
    opacity: 0.6;
    transition: opacity 0.15s;
  }

  .delete-record-btn:hover {
    opacity: 1;
  }

  .dropdown-footer {
    padding: 10px 14px;
    background: #f8fafc;
    border-top: 1px solid #e5e7eb;
  }

  .compare-mode-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #374151;
    cursor: pointer;
  }

  .compare-mode-toggle input {
    accent-color: #6366f1;
  }

  .chart-controls {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .toggle-switch {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    user-select: none;
  }

  .toggle-switch input {
    display: none;
  }

  .toggle-slider {
    width: 34px;
    height: 18px;
    background: #d1d5db;
    border-radius: 9px;
    position: relative;
    transition: background 0.15s;
  }

  .toggle-slider::before {
    content: '';
    position: absolute;
    width: 14px;
    height: 14px;
    background: white;
    border-radius: 50%;
    top: 2px;
    left: 2px;
    transition: transform 0.15s;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  .toggle-switch input:checked + .toggle-slider {
    background: #6366f1;
  }

  .toggle-switch input:checked + .toggle-slider::before {
    transform: translateX(16px);
  }

  .toggle-label {
    font-size: 12px;
    color: #64748b;
  }

  .variation-mode-section {
    margin-bottom: 12px;
    padding: 10px;
    background: #eff6ff;
    border-radius: 6px;
    border: 1px solid #bfdbfe;
  }

  .section-subtitle {
    font-size: 12px;
    font-weight: 600;
    color: #1e40af;
    margin-bottom: 8px;
  }

  .radio-group {
    display: flex;
    gap: 16px;
  }

  .radio-label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: #374151;
    cursor: pointer;
  }

  .radio-label input {
    accent-color: #6366f1;
  }

  .warning-tooltip {
    background: #92400e;
    border: 1px solid #fbbf24;
  }

  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
  }

  .modal-dialog {
    background: white;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    width: 400px;
    max-width: 90vw;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    background: #f8fafc;
    border-bottom: 1px solid #e5e7eb;
  }

  .modal-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    color: #1e293b;
  }

  .modal-close {
    background: none;
    border: none;
    font-size: 18px;
    color: #64748b;
    cursor: pointer;
    padding: 4px;
    line-height: 1;
  }

  .modal-close:hover {
    color: #374151;
  }

  .modal-body {
    padding: 20px;
  }

  .modal-label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: #374151;
    margin-bottom: 8px;
  }

  .modal-input {
    width: 100%;
    padding: 10px 12px;
    font-size: 14px;
    border: 2px solid #d1d5db;
    border-radius: 6px;
    box-sizing: border-box;
  }

  .modal-input:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
  }

  .modal-hint {
    margin-top: 8px;
    font-size: 11px;
    color: #94a3b8;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 16px 20px;
    background: #f8fafc;
    border-top: 1px solid #e5e7eb;
  }

  .modal-btn {
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 600;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .modal-btn.secondary {
    background: white;
    border: 1px solid #d1d5db;
    color: #374151;
  }

  .modal-btn.secondary:hover {
    background: #f1f5f9;
  }

  .modal-btn.primary {
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    border: none;
    color: white;
  }

  .modal-btn.primary:hover:not(:disabled) {
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
  }

  .modal-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .chart-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
    flex-wrap: wrap;
    gap: 8px;
  }
</style>
