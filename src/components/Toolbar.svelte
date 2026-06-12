<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { ALGORITHM_INFO, PRESET_GRAPHS } from '../lib/algorithms/registry';
  import type { AlgorithmType, GraphMode, PresetGraph } from '../lib/types';
  import type { LayoutType } from '../lib/layout';

  export let selectedAlgorithm: AlgorithmType | null = null;
  export let graphMode: GraphMode = 'undirected';
  export let layoutType: LayoutType = 'force';
  export let startNodeId: number | null = null;
  export let sinkNodeId: number | null = null;
  export let isRunning: boolean = false;
  export let compareMode: boolean = false;
  export let selectedAlgorithm2: AlgorithmType | null = null;
  export let startNodeId2: number | null = null;
  export let sinkNodeId2: number | null = null;
  export let isRunning2: boolean = false;
  export let syncMode: boolean = true;
  export let canUndo: boolean = false;
  export let canRedo: boolean = false;

  $: _requiresStartNode = selectedAlgorithm ? ALGORITHM_INFO[selectedAlgorithm].requiresStartNode : false;
  $: _requiresSinkNode = selectedAlgorithm === 'edmonds-karp';

  const dispatch = createEventDispatcher<{
    algorithmSelect: AlgorithmType | null;
    graphModeChange: GraphMode;
    layoutChange: LayoutType;
    loadPreset: PresetGraph;
    exportJSON: void;
    importJSON: File;
    clearGraph: void;
    runAlgorithm: void;
    selectStartNode: void;
    selectSinkNode: void;
    fitView: void;
    toggleCompareMode: boolean;
    algorithmSelect2: AlgorithmType | null;
    selectStartNode2: void;
    selectSinkNode2: void;
    runBothAlgorithms: void;
    toggleSyncMode: boolean;
    undo: void;
    redo: void;
  }>();

  const algorithmOptions: { type: AlgorithmType; category: string }[] = [
    { type: 'bfs', category: '遍历' },
    { type: 'dfs', category: '遍历' },
    { type: 'dijkstra', category: '最短路径' },
    { type: 'bellman-ford', category: '最短路径' },
    { type: 'floyd-warshall', category: '最短路径' },
    { type: 'kruskal', category: '最小生成树' },
    { type: 'prim', category: '最小生成树' },
    { type: 'kahn', category: '拓扑排序' },
    { type: 'edmonds-karp', category: '网络流' },
    { type: 'tarjan', category: '强连通分量' }
  ];

  const categories = Array.from(new Set(algorithmOptions.map(a => a.category)));

  function onAlgorithmChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    const val = target.value as AlgorithmType | '';
    dispatch('algorithmSelect', val || null);
  }

  function onModeChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    graphMode = target.value as GraphMode;
    dispatch('graphModeChange', graphMode);
  }

  function onLayoutChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    layoutType = target.value as LayoutType;
    dispatch('layoutChange', layoutType);
  }

  function onPresetChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    const presetId = target.value;
    if (presetId) {
      const preset = PRESET_GRAPHS.find(p => p.id === presetId);
      if (preset) {
        dispatch('loadPreset', preset);
      }
    }
    target.value = '';
  }

  function onExportClick() {
    dispatch('exportJSON');
  }

  function onImportClick() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) dispatch('importJSON', file);
    };
    input.click();
  }

  function onAlgorithmChange2(e: Event) {
    const target = e.target as HTMLSelectElement;
    const val = target.value as AlgorithmType | '';
    dispatch('algorithmSelect2', val || null);
  }

  $: canRunVal = (() => {
    if (!selectedAlgorithm) return false;
    if (isRunning) return false;
    if (_requiresStartNode && startNodeId === null) return false;
    return true;
  })();

  $: canRunBothVal = (() => {
    if (!selectedAlgorithm || !selectedAlgorithm2) return false;
    if (isRunning || isRunning2) return false;
    if (ALGORITHM_INFO[selectedAlgorithm].requiresStartNode && startNodeId === null) return false;
    if (ALGORITHM_INFO[selectedAlgorithm2].requiresStartNode && startNodeId2 === null) return false;
    return true;
  })();
</script>

<div class="toolbar">
  <div class="toolbar-section">
    <div class="brand">
      <span class="logo">🔗</span>
      <span class="brand-name">GraphViz</span>
      <span class="brand-sub">图论算法教学</span>
    </div>
  </div>

  <div class="toolbar-section grow">
    <div class="tool-group">
      <div class="tool-label">图模式</div>
      <select class="tool-select" value={graphMode} on:change={onModeChange}>
        <option value="undirected">无向图</option>
        <option value="directed">有向图</option>
        <option value="weighted">加权无向</option>
        <option value="weighted-directed">加权有向</option>
        <option value="flow">流网络</option>
      </select>
    </div>

    <div class="tool-group">
      <div class="tool-label">布局</div>
      <select class="tool-select" value={layoutType} on:change={onLayoutChange}>
        <option value="force">🎯 力导向</option>
        <option value="hierarchy">📊 层级布局</option>
        <option value="circular">⭕ 环形布局</option>
      </select>
    </div>

    <div class="tool-group">
      <div class="tool-label">预设图</div>
      <select class="tool-select" on:change={onPresetChange}>
        <option value="">📁 加载示例...</option>
        {#each PRESET_GRAPHS as preset}
          <option value={preset.id}>{preset.name}</option>
        {/each}
      </select>
    </div>

    <div class="divider"></div>

    <button class="tool-btn icon-btn" title="适应屏幕" on:click={() => dispatch('fitView')}>
      🔍 适配
    </button>

    <button class="tool-btn icon-btn" title="导入JSON" on:click={onImportClick}>
      📥 导入
    </button>

    <button class="tool-btn icon-btn" title="导出JSON" on:click={onExportClick}>
      📤 导出
    </button>

    <button class="tool-btn icon-btn danger" title="清空图" on:click={() => dispatch('clearGraph')} disabled={isRunning || isRunning2}>
      🗑️ 清空
    </button>

    <div class="divider"></div>

    <button 
      class="tool-btn icon-btn" 
      title="撤销 (Ctrl+Z)" 
      on:click={() => dispatch('undo')}
      disabled={!canUndo || isRunning || isRunning2}
    >
      ↩️ 撤销
    </button>

    <button 
      class="tool-btn icon-btn" 
      title="重做 (Ctrl+Shift+Z)" 
      on:click={() => dispatch('redo')}
      disabled={!canRedo || isRunning || isRunning2}
    >
      ↪️ 重做
    </button>
  </div>

  <div class="toolbar-section">
    <div class="tool-group">
      <div class="tool-label">算法</div>
      <select class="tool-select algo-select" value={selectedAlgorithm || ''} on:change={onAlgorithmChange}>
        <option value="">选择算法...</option>
        {#each categories as cat}
          <optgroup label={cat}>
            {#each algorithmOptions.filter(a => a.category === cat) as opt}
              <option value={opt.type}>{ALGORITHM_INFO[opt.type].name}</option>
            {/each}
          </optgroup>
        {/each}
      </select>
    </div>

    {#if _requiresStartNode}
      <button 
        class="tool-btn {startNodeId !== null ? 'has-value' : ''}"
        title="选择起始节点"
        disabled={isRunning}
        on:click={() => dispatch('selectStartNode')}
      >
        {startNodeId !== null ? `🚩 起点: ${startNodeId}` : '🚩 选起点'}
      </button>
    {/if}

    {#if _requiresSinkNode}
      <button 
        class="tool-btn {sinkNodeId !== null ? 'has-value' : ''}"
        title="选择汇点节点"
        disabled={isRunning}
        on:click={() => dispatch('selectSinkNode')}
      >
        {sinkNodeId !== null ? `🏁 汇点: ${sinkNodeId}` : '🏁 选汇点'}
      </button>
    {/if}

    <button 
      class="run-btn"
      disabled={!canRunVal}
      on:click={() => dispatch('runAlgorithm')}
    >
      {isRunning ? '⏳ 运行中...' : '▶️ 运行算法'}
    </button>

    <div class="divider"></div>

    <button 
      class="tool-btn compare-toggle {compareMode ? 'active' : ''}"
      title="算法对比模式"
      on:click={() => dispatch('toggleCompareMode', !compareMode)}
    >
      ⚖️ 对比
    </button>
  </div>
</div>

{#if compareMode}
  <div class="compare-toolbar">
    <div class="compare-section">
      <div class="compare-label">
        <span class="compare-badge left">A</span>
        <select class="tool-select algo-select" value={selectedAlgorithm || ''} on:change={onAlgorithmChange}>
          <option value="">选择算法 A...</option>
          {#each categories as cat}
            <optgroup label={cat}>
              {#each algorithmOptions.filter(a => a.category === cat) as opt}
                <option value={opt.type}>{ALGORITHM_INFO[opt.type].name}</option>
              {/each}
            </optgroup>
          {/each}
        </select>
      </div>
      {#if _requiresStartNode}
        <button 
          class="tool-btn {startNodeId !== null ? 'has-value' : ''}"
          disabled={isRunning}
          on:click={() => dispatch('selectStartNode')}
        >
          {startNodeId !== null ? `🚩 ${startNodeId}` : '🚩 起点'}
        </button>
      {/if}
      {#if _requiresSinkNode}
        <button 
          class="tool-btn {sinkNodeId !== null ? 'has-value' : ''}"
          disabled={isRunning}
          on:click={() => dispatch('selectSinkNode')}
        >
          {sinkNodeId !== null ? `🏁 ${sinkNodeId}` : '🏁 汇点'}
        </button>
      {/if}
    </div>

    <div class="compare-vs">VS</div>

    <div class="compare-section">
      <div class="compare-label">
        <span class="compare-badge right">B</span>
        <select class="tool-select algo-select" value={selectedAlgorithm2 || ''} on:change={onAlgorithmChange2}>
          <option value="">选择算法 B...</option>
          {#each categories as cat}
            <optgroup label={cat}>
              {#each algorithmOptions.filter(a => a.category === cat) as opt}
                <option value={opt.type}>{ALGORITHM_INFO[opt.type].name}</option>
              {/each}
            </optgroup>
          {/each}
        </select>
      </div>
      {#if selectedAlgorithm2 && ALGORITHM_INFO[selectedAlgorithm2].requiresStartNode}
        <button 
          class="tool-btn {startNodeId2 !== null ? 'has-value' : ''}"
          disabled={isRunning2}
          on:click={() => dispatch('selectStartNode2')}
        >
          {startNodeId2 !== null ? `🚩 ${startNodeId2}` : '🚩 起点'}
        </button>
      {/if}
      {#if selectedAlgorithm2 === 'edmonds-karp'}
        <button 
          class="tool-btn {sinkNodeId2 !== null ? 'has-value' : ''}"
          disabled={isRunning2}
          on:click={() => dispatch('selectSinkNode2')}
        >
          {sinkNodeId2 !== null ? `🏁 ${sinkNodeId2}` : '🏁 汇点'}
        </button>
      {/if}
    </div>

    <div class="divider"></div>

    <button 
      class="tool-btn {syncMode ? 'active' : ''}"
      title={syncMode ? '同步模式' : '独立模式'}
      on:click={() => dispatch('toggleSyncMode', !syncMode)}
    >
      {syncMode ? '🔗 同步' : '⚡ 独立'}
    </button>

    <button 
      class="run-btn"
      disabled={!canRunBothVal}
      on:click={() => dispatch('runBothAlgorithms')}
    >
      ▶️ 运行对比
    </button>
  </div>
{/if}

<style>
  .toolbar {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 10px 16px;
    background: white;
    border-bottom: 1px solid #e5e7eb;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    flex-wrap: wrap;
  }

  .toolbar-section {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .toolbar-section.grow {
    flex: 1;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .logo {
    font-size: 24px;
  }

  .brand-name {
    font-size: 17px;
    font-weight: 700;
    color: #6366f1;
    letter-spacing: -0.3px;
  }

  .brand-sub {
    font-size: 11px;
    color: #94a3b8;
    background: #f1f5f9;
    padding: 2px 8px;
    border-radius: 10px;
  }

  .tool-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .tool-label {
    font-size: 10px;
    color: #64748b;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding-left: 2px;
  }

  .tool-select {
    padding: 6px 28px 6px 10px;
    font-size: 13px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    background: white;
    color: #374151;
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
    background-repeat: no-repeat;
    background-position: right 6px center;
    background-size: 14px;
    transition: border-color 0.15s;
    min-width: 110px;
  }

  .tool-select.algo-select {
    min-width: 180px;
  }

  .tool-select:hover {
    border-color: #9ca3af;
  }

  .tool-select:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
  }

  .divider {
    width: 1px;
    height: 36px;
    background: #e5e7eb;
    margin: 0 6px;
  }

  .tool-btn {
    padding: 7px 12px;
    font-size: 13px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    background: white;
    color: #374151;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }

  .tool-btn:hover:not(:disabled) {
    background: #f9fafb;
    border-color: #9ca3af;
  }

  .tool-btn:active:not(:disabled) {
    transform: translateY(1px);
  }

  .tool-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .tool-btn.has-value {
    background: #ecfdf5;
    border-color: #6ee7b7;
    color: #047857;
  }

  .tool-btn.danger:hover:not(:disabled) {
    background: #fef2f2;
    border-color: #fca5a5;
    color: #dc2626;
  }

  .icon-btn {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .run-btn {
    padding: 9px 20px;
    font-size: 14px;
    font-weight: 600;
    border: none;
    border-radius: 8px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
    transition: all 0.15s;
    white-space: nowrap;
  }

  .run-btn:hover:not(.disabled) {
    box-shadow: 0 3px 12px rgba(99, 102, 241, 0.45);
    transform: translateY(-1px);
  }

  .run-btn:active:not([disabled]) {
    transform: translateY(0);
    box-shadow: none;
  }

  .run-btn[disabled] {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .compare-toggle.active {
    background: #eef2ff;
    border-color: #818cf8;
    color: #4f46e5;
  }

  .compare-toolbar {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 10px 16px;
    background: linear-gradient(135deg, #f0f9ff, #faf5ff);
    border-bottom: 1px solid #e5e7eb;
    flex-wrap: wrap;
  }

  .compare-section {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    min-width: 280px;
  }

  .compare-label {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .compare-badge {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 13px;
    color: white;
  }

  .compare-badge.left {
    background: linear-gradient(135deg, #3b82f6, #2563eb);
  }

  .compare-badge.right {
    background: linear-gradient(135deg, #f97316, #ea580c);
  }

  .compare-vs {
    font-weight: 700;
    color: #6366f1;
    font-size: 16px;
    background: white;
    padding: 6px 14px;
    border-radius: 20px;
    border: 2px solid #c7d2fe;
  }

  @media (max-width: 900px) {
    .toolbar {
      gap: 10px;
      padding: 8px 12px;
    }

    .brand-sub {
      display: none;
    }

    .tool-select {
      min-width: auto;
    }

    .compare-toolbar {
      gap: 10px;
      padding: 8px 12px;
    }

    .compare-section {
      min-width: 200px;
    }
  }
</style>
