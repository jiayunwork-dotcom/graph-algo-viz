<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { AlgorithmType } from '../lib/types';
  import { ALGORITHM_INFO } from '../lib/algorithms/registry';
  import type { GraphModelType, GraphModelParams } from '../lib/benchmark/graph-generator';
  import { estimateEdgeCount } from '../lib/benchmark/graph-generator';
  import {
    BenchmarkRunner,
    aggregateResults,
    type BenchmarkResult,
    type BenchmarkProgress,
    type BenchmarkConfig
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

  const allAlgorithms: AlgorithmType[] = [
    'bfs', 'dfs', 'dijkstra', 'bellman-ford', 'floyd-warshall',
    'kruskal', 'prim', 'edmonds-karp', 'kahn', 'tarjan'
  ];

  $: currentParams: GraphModelParams = (() => {
    switch (graphModel) {
      case 'erdos-renyi': return { type: 'erdos-renyi', n: erN, p: erP };
      case 'watts-strogatz': return { type: 'watts-strogatz', n: wsN, k: wsK, beta: wsBeta };
      case 'barabasi-albert': return { type: 'barabasi-albert', n: baN, m: baM };
    }
  })();

  $: estimatedEdges = estimateEdgeCount(currentParams);

  $: nodeSizes = (() => {
    const sizes: number[] = [];
    for (let s = sizeStart; s <= sizeEnd; s += sizeStep) {
      sizes.push(s);
    }
    return sizes;
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
    if (nodeSizes.length === 0) return;

    testing = true;
    isRunning = true;
    dispatch('runningChange', true);
    results = [];
    aggregatedResults = [];
    progress = null;
    selectedBarNodeCount = null;
    highlightedNodeCount = null;

    runner = new BenchmarkRunner();

    const config: BenchmarkConfig = {
      graphModel: currentParams,
      algorithms: Array.from(selectedAlgorithms),
      nodeSizes,
      repeatCount
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

    const data = aggregatedResults;
    if (data.length === 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('暂无测试数据', W / 2, H / 2);
      return;
    }

    const algoNames = [...new Set(data.map(r => r.algorithmName))];
    const nodeCounts = [...new Set(data.map(r => r.nodeCount))].sort((a, b) => a - b);

    let maxTime = 0;
    for (const r of data) {
      if (r.executionTimeMs > maxTime) maxTime = r.executionTimeMs;
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

    for (let i = 0; i < nodeCounts.length; i++) {
      const x = padL + (i / Math.max(nodeCounts.length - 1, 1)) * chartW;
      ctx.strokeStyle = '#e5e7eb';
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, padT + chartH);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(nodeCounts[i]), x, padT + chartH + 20);
    }

    ctx.fillStyle = '#374151';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('节点数', padL + chartW / 2, H - 5);

    ctx.save();
    ctx.translate(14, padT + chartH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('执行时间 (ms)', 0, 0);
    ctx.restore();

    for (const algoName of algoNames) {
      const color = ALGORITHM_COLORS[algoName] || '#6366f1';
      const points: { x: number; y: number; time: number; nodeCount: number }[] = [];

      for (const nc of nodeCounts) {
        const r = data.find(d => d.algorithmName === algoName && d.nodeCount === nc);
        if (r) {
          const x = padL + (nodeCounts.indexOf(nc) / Math.max(nodeCounts.length - 1, 1)) * chartW;
          const y = padT + chartH - (r.executionTimeMs / maxTime) * chartH;
          points.push({ x, y, time: r.executionTimeMs, nodeCount: nc });
        }
      }

      if (points.length > 1) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();
      }

      for (const p of points) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (highlightedNodeCount !== null && nodeCounts.includes(highlightedNodeCount)) {
      const x = padL + (nodeCounts.indexOf(highlightedNodeCount) / Math.max(nodeCounts.length - 1, 1)) * chartW;
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
    for (const algoName of algoNames) {
      const color = ALGORITHM_COLORS[algoName] || '#6366f1';
      ctx.fillStyle = color;
      ctx.fillRect(legendX, legendY - 5, 14, 3);
      ctx.beginPath();
      ctx.arc(legendX + 7, legendY - 3.5, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#374151';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(algoName, legendX + 20, legendY);
      legendY += 18;
    }

    (lineChartCanvas as any)._chartData = {
      padL, padR, padT, padB, chartW, chartH,
      algoNames, nodeCounts, maxTime, data
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
    const padB = 50;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    const data = aggregatedResults.filter(r => r.nodeCount === selectedBarNodeCount);
    if (data.length === 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(selectedBarNodeCount ? `节点数 ${selectedBarNodeCount} 暂无数据` : '请选择一个规模点', W / 2, H / 2);
      return;
    }

    const algoNames = data.map(r => r.algorithmName);
    let maxTime = 0;
    for (const r of data) {
      if (r.executionTimeMs > maxTime) maxTime = r.executionTimeMs;
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

    const barWidth = Math.min(40, (chartW / algoNames.length) * 0.6);
    const groupWidth = chartW / algoNames.length;
    const barPositions: { x: number; y: number; w: number; h: number; algoName: string; time: number }[] = [];

    for (let i = 0; i < data.length; i++) {
      const r = data[i];
      const barH = (r.executionTimeMs / maxTime) * chartH;
      const x = padL + i * groupWidth + (groupWidth - barWidth) / 2;
      const y = padT + chartH - barH;
      const color = ALGORITHM_COLORS[r.algorithmName] || '#6366f1';

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

      ctx.fillStyle = '#374151';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.save();
      ctx.translate(x + barWidth / 2, padT + chartH + 8);
      ctx.rotate(-Math.PI / 6);
      const shortName = r.algorithmName.length > 8 ? r.algorithmName.slice(0, 7) + '…' : r.algorithmName;
      ctx.fillText(shortName, 0, 0);
      ctx.restore();

      barPositions.push({ x, y, w: barWidth, h: barH, algoName: r.algorithmName, time: r.executionTimeMs });
    }

    ctx.fillStyle = '#374151';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`节点数: ${selectedBarNodeCount}`, W / 2, 20);

    (barChartCanvas as any)._chartData = {
      padL, padR, padT, padB, chartW, chartH,
      algoNames, maxTime, data, barPositions, groupWidth, barWidth
    };
  }

  function handleLineChartMouseMove(e: MouseEvent) {
    if (!lineChartCanvas) return;
    const cd = (lineChartCanvas as any)._chartData;
    if (!cd) return;

    const rect = lineChartCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const { padL, padT, chartW, chartH, nodeCounts, maxTime, data, algoNames } = cd;

    let closest: { x: number; y: number; text: string; dist: number } | null = null;

    for (const algoName of algoNames) {
      for (const nc of nodeCounts) {
        const r = data.find((d: BenchmarkResult) => d.algorithmName === algoName && d.nodeCount === nc);
        if (r) {
          const x = padL + (nodeCounts.indexOf(nc) / Math.max(nodeCounts.length - 1, 1)) * chartW;
          const y = padT + chartH - (r.executionTimeMs / maxTime) * chartH;
          const dist = Math.sqrt((mx - x) ** 2 + (my - y) ** 2);
          if (dist < 15 && (!closest || dist < closest.dist)) {
            closest = { x, y, text: `${algoName}\n节点: ${nc}, 时间: ${r.executionTimeMs.toFixed(3)}ms`, dist };
          }
        }
      }
    }

    lineTooltipData = closest;
  }

  function handleLineChartMouseLeave() {
    lineTooltipData = null;
  }

  function handleBarChartMouseMove(e: MouseEvent) {
    if (!barChartCanvas) return;
    const cd = (barChartCanvas as any)._chartData;
    if (!cd) return;

    const rect = barChartCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const { barPositions } = cd;

    let found: { x: number; y: number; text: string } | null = null;
    for (const bp of barPositions) {
      if (mx >= bp.x && mx <= bp.x + bp.w && my >= bp.y && my <= bp.y + bp.h) {
        found = {
          x: bp.x + bp.w / 2,
          y: bp.y - 5,
          text: `${bp.algoName}: ${bp.time.toFixed(3)}ms`
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

    const rect = barChartCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;

    const { data, groupWidth } = cd;
    const idx = Math.floor((mx - cd.padL) / groupWidth);
    if (idx >= 0 && idx < data.length) {
      highlightedNodeCount = data[idx].nodeCount;
      requestAnimationFrame(() => {
        drawLineChart();
      });
    }
  }

  function handleSelectBarNodeCount() {
    if (selectedBarNodeCount !== null) {
      highlightedNodeCount = selectedBarNodeCount;
      requestAnimationFrame(() => {
        drawLineChart();
        drawBarChart();
      });
    }
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

  $: if (aggregatedResults.length > 0 && lineChartCanvas && barChartCanvas) {
    requestAnimationFrame(() => {
      drawLineChart();
      drawBarChart();
    });
  }

  $: if (selectedBarNodeCount !== null && barChartCanvas) {
    requestAnimationFrame(() => {
      drawBarChart();
    });
  }
</script>

<div class="benchmark-panel">
  <div class="panel-header">
    <div class="header-left">
      <span class="header-icon">📈</span>
      <span class="header-title">算法性能基准测试</span>
    </div>
    <button class="close-btn" on:click={handleClose} disabled={testing}>✕</button>
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
        <div class="param-row">
          <span class="param-label">重复次数</span>
          <div class="slider-group compact">
            <input type="range" min={1} max={10} step={1} bind:value={repeatCount} disabled={testing} />
            <input type="number" min={1} max={10} bind:value={repeatCount} disabled={testing} />
          </div>
        </div>

        <div class="scale-preview">
          规模序列：{nodeSizes.join(', ')}（共 {nodeSizes.length} 个点）
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
        <div class="chart-title">📊 执行时间折线图</div>
        <div class="chart-container" style="position: relative;">
          <canvas bind:this={lineChartCanvas} on:mousemove={handleLineChartMouseMove} on:mouseleave={handleLineChartMouseLeave}></canvas>
          {#if lineTooltipData}
            <div class="chart-tooltip" style="left: {lineTooltipData.x + 15}px; top: {lineTooltipData.y - 10}px;">
              {lineTooltipData.text}
            </div>
          {/if}
        </div>
      </div>

      <div class="chart-section">
        <div class="chart-header">
          <span class="chart-title">📊 算法耗时柱状图</span>
          {#if aggregatedResults.length > 0}
            <div class="bar-selector">
              <span class="bar-selector-label">选择规模：</span>
              <select bind:value={selectedBarNodeCount} on:change={handleSelectBarNodeCount}>
                {#each [...new Set(aggregatedResults.map(r => r.nodeCount))].sort((a, b) => a - b) as nc}
                  <option value={nc}>{nc} 个节点</option>
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

      {#if aggregatedResults.length > 0}
        <div class="export-section">
          <button class="export-btn" on:click={exportCSV}>📄 导出CSV</button>
          <button class="export-btn" on:click={exportChartPNG}>🖼️ 导出图表</button>
        </div>
      {/if}
    </div>
  </div>
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
</style>
