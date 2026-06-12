<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Toolbar from './components/Toolbar.svelte';
  import GraphCanvas from './components/GraphCanvas.svelte';
  import ControlPanel from './components/ControlPanel.svelte';
  import Sidebar from './components/Sidebar.svelte';
  import { Graph } from './lib/graph';
  import type { AlgorithmType, GraphMode, GraphNode, GraphEdge, NodeId, EdgeId, AlgorithmStep, VisualState, PresetGraph } from './lib/types';
  import type { LayoutType } from './lib/layout';
  import { ForceDirectedLayout, applyCircularLayout, applyHierarchyLayout } from './lib/layout';
  import { AlgorithmAnimator, type PlaybackState } from './lib/animator';
  import { ALGORITHM_INFO } from './lib/algorithms/registry';
  import { createEmptyVisualState } from './lib/algorithms/step-builder';

  let graph = new Graph();
  let animator = new AlgorithmAnimator();
  let animator2 = new AlgorithmAnimator();
  let forceLayout: ForceDirectedLayout | null = null;
  let canvasComponent: GraphCanvas;
  let canvasComponent2: GraphCanvas;

  let selectedAlgorithm: AlgorithmType | null = null;
  let selectedAlgorithm2: AlgorithmType | null = null;
  let graphMode: GraphMode = 'undirected';
  let layoutType: LayoutType = 'force';
  let startNodeId: number | null = null;
  let startNodeId2: number | null = null;
  let sinkNodeId: number | null = null;
  let sinkNodeId2: number | null = null;
  let compareMode: boolean = false;
  let syncMode: boolean = true;

  let selectedNode: NodeId | null = null;
  let selectedEdge: EdgeId | null = null;
  let hoveredNode: NodeId | null = null;
  let hoveredEdge: EdgeId | null = null;
  let interactionMode: 'edit' | 'select-start' | 'select-sink' | 'select-start2' | 'select-sink2' = 'edit';

  let algorithmStep: AlgorithmStep | null = null;
  let algorithmStep2: AlgorithmStep | null = null;
  let visualState: VisualState = createEmptyVisualState();
  let visualState2: VisualState = createEmptyVisualState();
  let playbackState: PlaybackState = 'idle';
  let playbackState2: PlaybackState = 'idle';
  let currentStepIndex: number = -1;
  let currentStepIndex2: number = -1;
  let speed: number = 1;

  function handleAlgorithmSelect(type: AlgorithmType | null) {
    selectedAlgorithm = type;
    if (type) {
      const info = ALGORITHM_INFO[type];
      if (!info.requiresStartNode) {
        startNodeId = null;
      }
      if (type !== 'edmonds-karp') {
        sinkNodeId = null;
      }
    }
  }

  function handleAlgorithmSelect2(type: AlgorithmType | null) {
    selectedAlgorithm2 = type;
    if (type) {
      const info = ALGORITHM_INFO[type];
      if (!info.requiresStartNode) {
        startNodeId2 = null;
      }
      if (type !== 'edmonds-karp') {
        sinkNodeId2 = null;
      }
    }
  }

  function handleToggleCompareMode(enabled: boolean) {
    compareMode = enabled;
    if (!enabled) {
      animator2.stop();
      visualState2 = createEmptyVisualState();
    }
  }

  function handleToggleSyncMode(sync: boolean) {
    syncMode = sync;
  }

  function handleRunBothAlgorithms() {
    const success1 = animator.prepareAlgorithm(selectedAlgorithm!, graph, startNodeId ?? undefined, sinkNodeId ?? undefined);
    const success2 = animator2.prepareAlgorithm(selectedAlgorithm2!, graph, startNodeId2 ?? undefined, sinkNodeId2 ?? undefined);
    
    if (success1 && success2) {
      animator.setCallbacks(onStepChange, onStateChange);
      animator2.setCallbacks(onStepChange2, onStateChange2);
      
      if (syncMode) {
        const steps1 = animator.getSteps();
        const steps2 = animator2.getSteps();
        const maxSteps = Math.max(steps1.length, steps2.length);
        
        let currentIdx = -1;
        const syncPlay = () => {
          currentIdx++;
          if (currentIdx >= maxSteps) {
            animator.jumpToStep(steps1.length - 1);
            animator2.jumpToStep(steps2.length - 1);
            return;
          }
          if (currentIdx < steps1.length) animator.jumpToStep(currentIdx);
          if (currentIdx < steps2.length) animator2.jumpToStep(currentIdx);
          
          if (syncMode && currentIdx < maxSteps - 1) {
            setTimeout(syncPlay, 800 / speed);
          }
        };
        syncPlay();
      } else {
        animator.play();
        animator2.play();
      }
    } else {
      alert('算法准备失败，请检查参数');
    }
  }

  function handleGraphModeChange(mode: GraphMode) {
    graph.setMode(mode);
    graphMode = mode;
    rerender();
  }

  function handleLayoutChange(type: LayoutType) {
    layoutType = type;
    const container = document.querySelector('.canvas-container') as HTMLElement;
    const w = container?.clientWidth || 800;
    const h = container?.clientHeight || 600;

    if (type === 'circular') {
      applyCircularLayout(graph, w / 2, h / 2, Math.min(w, h) / 3);
    } else if (type === 'hierarchy') {
      applyHierarchyLayout(graph, w / 2, 80, 120, 100);
    } else if (type === 'force') {
      if (!forceLayout) {
        forceLayout = new ForceDirectedLayout(graph, w, h);
      } else {
        (forceLayout as any).areaWidth = w;
        (forceLayout as any).areaHeight = h;
        forceLayout.reset();
      }
    }
    rerender();
  }

  function handleLoadPreset(preset: PresetGraph) {
    const newGraph = new Graph();
    newGraph.settings = { ...preset.settings };
    preset.nodes.forEach(n => {
      newGraph.addNodeWithId(n.id, n.x, n.y, n.label);
    });
    preset.edges.forEach(e => {
      newGraph.addEdge(e.source, e.target, e.weight);
    });
    graph = newGraph;
    graphMode = preset.settings.mode;
    startNodeId = null;
    sinkNodeId = null;
    selectedNode = null;
    selectedEdge = null;
    animator.stop();
    animator2.stop();
    rerender();
    
    requestAnimationFrame(() => {
      canvasComponent?.fitView();
      if (compareMode && canvasComponent2) {
        canvasComponent2.fitView();
      }
    });
  }

  function handleExportJSON() {
    const data = graph.toJSON();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `graph-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportJSON(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        const newGraph = Graph.fromJSON(data);
        graph = newGraph;
        if (data.settings?.mode) {
          graphMode = data.settings.mode;
        }
        startNodeId = null;
        sinkNodeId = null;
        animator.stop();
        rerender();
      } catch (err) {
        alert('导入失败：无效的 JSON 文件');
      }
    };
    reader.readAsText(file);
  }

  function handleClearGraph() {
    if (graph.getNodeCount() > 0 && !confirm('确定要清空整个图吗？')) return;
    graph.clear();
    startNodeId = null;
    sinkNodeId = null;
    selectedNode = null;
    selectedEdge = null;
    animator.stop();
    rerender();
  }

  function handleRunAlgorithm() {
    if (!selectedAlgorithm) return;
    const success = animator.prepareAlgorithm(selectedAlgorithm, graph, startNodeId ?? undefined, sinkNodeId ?? undefined);
    if (success) {
      animator.setCallbacks(onStepChange, onStateChange);
      animator.play();
    } else {
      alert('算法准备失败，请检查参数');
    }
  }

  function handleSelectStartNode() {
    interactionMode = 'select-start';
  }

  function handleSelectSinkNode() {
    interactionMode = 'select-sink';
  }

  function handleSelectStartNode2() {
    interactionMode = 'select-start2';
  }

  function handleSelectSinkNode2() {
    interactionMode = 'select-sink2';
  }

  function handleStartNodeSelected(e: CustomEvent<{ id: NodeId }>) {
    startNodeId = e.detail.id;
    interactionMode = 'edit';
  }

  function handleSinkNodeSelected(e: CustomEvent<{ id: NodeId }>) {
    sinkNodeId = e.detail.id;
    interactionMode = 'edit';
  }

  function handleStartNodeSelected2(e: CustomEvent<{ id: NodeId }>) {
    startNodeId2 = e.detail.id;
    interactionMode = 'edit';
  }

  function handleSinkNodeSelected2(e: CustomEvent<{ id: NodeId }>) {
    sinkNodeId2 = e.detail.id;
    interactionMode = 'edit';
  }

  function onStepChange2(step: AlgorithmStep | null, index: number) {
    algorithmStep2 = step;
    currentStepIndex2 = index;
    if (step) {
      visualState2 = step.snapshot.visualState;
    } else {
      visualState2 = createEmptyVisualState();
    }
  }

  function onStateChange2(state: PlaybackState) {
    playbackState2 = state;
  }

  function onStepChange(step: AlgorithmStep | null, index: number) {
    algorithmStep = step;
    currentStepIndex = index;
    if (step) {
      visualState = step.snapshot.visualState;
    } else {
      visualState = createEmptyVisualState();
    }
  }

  function onStateChange(state: PlaybackState) {
    playbackState = state;
  }

  function handlePlay() { animator.play(); }
  function handlePause() { animator.pause(); }
  function handleStepForward() { animator.stepForward(); }
  function handleStepBackward() { animator.stepBackward(); }
  function handleReplay() { animator.replay(); }
  function handleStop() { animator.stop(); }
  function handleSpeedChange(s: number) { speed = s; animator.setSpeed(s); if (animator2) animator2.setSpeed(s); }
  function handleJumpTo(idx: number) { animator.jumpToStep(idx); }

  function handlePlay2() { animator2.play(); }
  function handlePause2() { animator2.pause(); }
  function handleStepForward2() { animator2.stepForward(); }
  function handleStepBackward2() { animator2.stepBackward(); }
  function handleReplay2() { animator2.replay(); }
  function handleStop2() { animator2.stop(); }
  function handleJumpTo2(idx: number) { animator2.jumpToStep(idx); }

  function handleNodeCreated() { rerender(); }
  function handleNodeMoved() { rerender(); }

  function handleNodeSelected(e: CustomEvent<{ id: NodeId | null }>) {
    selectedNode = e.detail.id;
  }

  function handleNodeDoubleClicked() { rerender(); }

  function handleEdgeCreated(e: CustomEvent<{ source: NodeId; target: NodeId }>) {
    const { source, target } = e.detail;
    if (graph.settings.isWeighted) {
      const allowNegative = graphMode === 'weighted-directed';
      const hint = allowNegative ? '（可正可负）' : '（正数）';
      const input = prompt(`请输入边权重${hint}：`, '1');
      if (input === null) return;
      const w = parseFloat(input);
      if (isNaN(w)) {
        alert('请输入有效的数值');
        return;
      }
      if (!allowNegative && w <= 0) {
        alert('请输入有效的正数值');
        return;
      }
      graph.addEdge(source, target, w);
    } else {
      graph.addEdge(source, target, 1);
    }
    rerender();
  }

  function handleEdgeSelected(e: CustomEvent<{ id: EdgeId | null }>) {
    selectedEdge = e.detail.id;
  }

  function handleDeleteNode(e: CustomEvent<{ id: NodeId }>) {
    graph.removeNode(e.detail.id);
    if (startNodeId === e.detail.id) startNodeId = null;
    if (sinkNodeId === e.detail.id) sinkNodeId = null;
    rerender();
  }

  function handleDeleteEdge(e: CustomEvent<{ id: EdgeId }>) {
    graph.removeEdge(e.detail.id);
    rerender();
  }

  function handleNodeLabelEdit(e: CustomEvent<{ id: NodeId }>) {
    const node = graph.getNode(e.detail.id);
    if (!node) return;
    const input = prompt('编辑节点标签：', node.label);
    if (input !== null && input.trim() !== '') {
      graph.setNodeLabel(e.detail.id, input.trim());
      rerender();
    }
  }

  function handleEdgeWeightEdit(e: CustomEvent<{ id: EdgeId }>) {
    const edge = graph.getEdge(e.detail.id);
    if (!edge) return;
    const allowNegative = graphMode === 'weighted-directed';
    const hint = allowNegative ? '（可正可负）' : '（正数）';
    const input = prompt(`编辑边权重${hint}：`, String(edge.weight));
    if (input === null) return;
    const w = parseFloat(input);
    if (isNaN(w)) {
      alert('请输入有效的数值');
      return;
    }
    if (!allowNegative && w <= 0) {
      alert('请输入有效的正数值');
      return;
    }
    graph.setEdgeWeight(e.detail.id, w);
    rerender();
  }

  function handleFitView() {
    canvasComponent?.fitView();
  }

  function rerender() {
    // Svelte reactivity should handle this, but force graph update
    graph = graph;
  }

  $: hasAlgorithm = playbackState !== 'idle' && animator.getAlgorithmType() !== null;
  $: hasAlgorithm2 = playbackState2 !== 'idle' && animator2.getAlgorithmType() !== null;
  $: isRunning = playbackState === 'playing';
  $: isRunning2 = playbackState2 === 'playing';
  $: totalSteps = animator.getTotalSteps();
  $: totalSteps2 = animator2.getTotalSteps();
  $: currentDescription = algorithmStep?.description || '';
  $: currentDescription2 = algorithmStep2?.description || '';
  $: algorithmData = algorithmStep?.snapshot.data || {};
  $: algorithmData2 = algorithmStep2?.snapshot.data || {};
  $: algorithmType = animator.getAlgorithmType();
  $: algorithmType2 = animator2.getAlgorithmType();

  $: if (layoutType === 'force' && forceLayout) {
    // Trigger re-layout when needed
  }

  onMount(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    forceLayout = new ForceDirectedLayout(graph, w - 360, h - 180);

    animator.setCallbacks(onStepChange, onStateChange);
  });

  onDestroy(() => {
    animator.destroy();
  });
</script>

<svelte:window on:keydown={(e) => {
  if (e.key === 'Escape') {
    interactionMode = 'edit';
    selectedNode = null;
    selectedEdge = null;
  }
  if (e.key === ' ' && hasAlgorithm) {
    e.preventDefault();
    playbackState === 'playing' ? handlePause() : handlePlay();
  }
  if (e.key === 'ArrowRight' && hasAlgorithm) handleStepForward();
  if (e.key === 'ArrowLeft' && hasAlgorithm) handleStepBackward();
}} />

<div class="app">
  <Toolbar
    selectedAlgorithm={selectedAlgorithm}
    graphMode={graphMode}
    layoutType={layoutType}
    startNodeId={startNodeId}
    sinkNodeId={sinkNodeId}
    isRunning={isRunning}
    compareMode={compareMode}
    selectedAlgorithm2={selectedAlgorithm2}
    startNodeId2={startNodeId2}
    sinkNodeId2={sinkNodeId2}
    isRunning2={playbackState2 === 'playing'}
    syncMode={syncMode}
    on:algorithmSelect={(e) => handleAlgorithmSelect(e.detail)}
    on:graphModeChange={(e) => handleGraphModeChange(e.detail)}
    on:layoutChange={(e) => handleLayoutChange(e.detail)}
    on:loadPreset={(e) => handleLoadPreset(e.detail)}
    on:exportJSON={handleExportJSON}
    on:importJSON={(e) => handleImportJSON(e.detail)}
    on:clearGraph={handleClearGraph}
    on:runAlgorithm={handleRunAlgorithm}
    on:selectStartNode={handleSelectStartNode}
    on:selectSinkNode={handleSelectSinkNode}
    on:fitView={handleFitView}
    on:toggleCompareMode={(e) => handleToggleCompareMode(e.detail)}
    on:algorithmSelect2={(e) => handleAlgorithmSelect2(e.detail)}
    on:selectStartNode2={handleSelectStartNode2}
    on:selectSinkNode2={handleSelectSinkNode2}
    on:runBothAlgorithms={handleRunBothAlgorithms}
    on:toggleSyncMode={(e) => handleToggleSyncMode(e.detail)}
  />

  <div class="main-content">
    <div class="canvas-area">
      {#if interactionMode !== 'edit'}
        <div class="interaction-banner">
          {#if interactionMode === 'select-start'}
            🚩 请在画布上点击选择<strong>算法 A 起始节点</strong>（按 ESC 取消）
          {:else if interactionMode === 'select-sink'}
            🏁 请在画布上点击选择<strong>算法 A 汇点节点</strong>（按 ESC 取消）
          {:else if interactionMode === 'select-start2'}
            🚩 请在画布上点击选择<strong>算法 B 起始节点</strong>（按 ESC 取消）
          {:else if interactionMode === 'select-sink2'}
            🏁 请在画布上点击选择<strong>算法 B 汇点节点</strong>（按 ESC 取消）
          {/if}
        </div>
      {/if}

      {#if selectedNode !== null && interactionMode === 'edit'}
        <div class="hint-banner">
          💡 已选中节点 {selectedNode}，再点击另一个节点可创建边，或按 ESC 取消
        </div>
      {/if}

      {#if !compareMode}
        <GraphCanvas
          bind:this={canvasComponent}
          graph={graph}
          visualState={visualState}
          algorithmStep={algorithmStep}
          bind:selectedNode
          bind:selectedEdge
          bind:hoveredNode
          bind:hoveredEdge
          interactionMode={interactionMode}
          layout={layoutType}
          forceLayout={forceLayout}
          on:nodeCreated={handleNodeCreated}
          on:nodeMoved={handleNodeMoved}
          on:nodeSelected={handleNodeSelected}
          on:nodeDoubleClicked={handleNodeDoubleClicked}
          on:edgeCreated={handleEdgeCreated}
          on:edgeSelected={handleEdgeSelected}
          on:requestDeleteNode={handleDeleteNode}
          on:requestDeleteEdge={handleDeleteEdge}
          on:requestNodeLabelEdit={handleNodeLabelEdit}
          on:requestEdgeWeightEdit={handleEdgeWeightEdit}
          on:startNodeSelected={handleStartNodeSelected}
          on:sinkNodeSelected={handleSinkNodeSelected}
          on:startNodeSelected2={handleStartNodeSelected2}
          on:sinkNodeSelected2={handleSinkNodeSelected2}
        />
      {:else}
        <div class="compare-canvases">
          <div class="compare-canvas-wrapper">
            <div class="canvas-header left">
              <span class="canvas-badge">A</span>
              <span class="canvas-title">{selectedAlgorithm ? ALGORITHM_INFO[selectedAlgorithm].name : '选择算法 A'}</span>
            </div>
            <GraphCanvas
              bind:this={canvasComponent}
              graph={graph}
              visualState={visualState}
              algorithmStep={algorithmStep}
              bind:selectedNode
              bind:selectedEdge
              bind:hoveredNode
              bind:hoveredEdge
              interactionMode={interactionMode}
              layout={layoutType}
              forceLayout={forceLayout}
              on:nodeCreated={handleNodeCreated}
              on:nodeMoved={handleNodeMoved}
              on:nodeSelected={handleNodeSelected}
              on:nodeDoubleClicked={handleNodeDoubleClicked}
              on:edgeCreated={handleEdgeCreated}
              on:edgeSelected={handleEdgeSelected}
              on:requestDeleteNode={handleDeleteNode}
              on:requestDeleteEdge={handleDeleteEdge}
              on:requestNodeLabelEdit={handleNodeLabelEdit}
              on:requestEdgeWeightEdit={handleEdgeWeightEdit}
              on:startNodeSelected={handleStartNodeSelected}
              on:sinkNodeSelected={handleSinkNodeSelected}
              on:startNodeSelected2={handleStartNodeSelected2}
              on:sinkNodeSelected2={handleSinkNodeSelected2}
            />
          </div>
          <div class="compare-divider"></div>
          <div class="compare-canvas-wrapper">
            <div class="canvas-header right">
              <span class="canvas-badge">B</span>
              <span class="canvas-title">{selectedAlgorithm2 ? ALGORITHM_INFO[selectedAlgorithm2].name : '选择算法 B'}</span>
            </div>
            <GraphCanvas
              bind:this={canvasComponent2}
              graph={graph}
              visualState={visualState2}
              algorithmStep={algorithmStep2}
              bind:selectedNode
              bind:selectedEdge
              bind:hoveredNode
              bind:hoveredEdge
              interactionMode={interactionMode}
              layout={layoutType}
              forceLayout={forceLayout}
              on:nodeCreated={handleNodeCreated}
              on:nodeMoved={handleNodeMoved}
              on:nodeSelected={handleNodeSelected}
              on:nodeDoubleClicked={handleNodeDoubleClicked}
              on:edgeCreated={handleEdgeCreated}
              on:edgeSelected={handleEdgeSelected}
              on:requestDeleteNode={handleDeleteNode}
              on:requestDeleteEdge={handleDeleteEdge}
              on:requestNodeLabelEdit={handleNodeLabelEdit}
              on:requestEdgeWeightEdit={handleEdgeWeightEdit}
              on:startNodeSelected={handleStartNodeSelected}
              on:sinkNodeSelected={handleSinkNodeSelected}
              on:startNodeSelected2={handleStartNodeSelected2}
              on:sinkNodeSelected2={handleSinkNodeSelected2}
            />
          </div>
        </div>
      {/if}

      <div class="status-bar">
        <div class="stats">
          <span class="stat">📊 节点：<strong>{graph.getNodeCount()}</strong></span>
          <span class="stat">🔗 边：<strong>{graph.getEdgeCount()}</strong></span>
        </div>
        <div class="stats">
          <span class="stat tip">💡 左键空白：添加节点 | 选中节点+点击节点：创建边 | Shift+拖拽：平移 | 滚轮：缩放 | 右键：菜单</span>
        </div>
      </div>
    </div>

    <div class="sidebar-area">
      <Sidebar
        algorithmType={algorithmType}
        algorithmData={algorithmData}
        hasAlgorithm={hasAlgorithm}
        compareMode={compareMode}
        algorithmType2={algorithmType2}
        algorithmData2={algorithmStep2?.snapshot.data || {}}
        hasAlgorithm2={playbackState2 !== 'idle' && animator2.getAlgorithmType() !== null}
      />
    </div>
  </div>

  <ControlPanel
    playbackState={playbackState}
    currentStep={currentStepIndex}
    totalSteps={totalSteps}
    speed={speed}
    hasAlgorithm={hasAlgorithm}
    currentDescription={currentDescription}
    compareMode={compareMode}
    playbackState2={playbackState2}
    currentStep2={currentStepIndex2}
    totalSteps2={totalSteps2}
    currentDescription2={currentDescription2}
    hasAlgorithm2={hasAlgorithm2}
    on:play={handlePlay}
    on:pause={handlePause}
    on:stepForward={handleStepForward}
    on:stepBackward={handleStepBackward}
    on:replay={handleReplay}
    on:stop={handleStop}
    on:speedChange={(e) => handleSpeedChange(e.detail)}
    on:jumpTo={(e) => handleJumpTo(e.detail)}
    on:play2={handlePlay2}
    on:pause2={handlePause2}
    on:stepForward2={handleStepForward2}
    on:stepBackward2={handleStepBackward2}
    on:replay2={handleReplay2}
    on:stop2={handleStop2}
    on:jumpTo2={(e) => handleJumpTo2(e.detail)}
  />
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    background: #f5f7fa;
  }

  .main-content {
    flex: 1;
    display: flex;
    overflow: hidden;
    position: relative;
  }

  .canvas-area {
    flex: 1;
    position: relative;
    display: flex;
    flex-direction: column;
    min-width: 0;
    background: #fafafa;
  }

  .interaction-banner {
    position: absolute;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 100;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    padding: 10px 24px;
    border-radius: 24px;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 16px rgba(99, 102, 241, 0.35);
    animation: pulse 2s ease-in-out infinite;
  }

  .interaction-banner strong {
    font-weight: 700;
    margin: 0 3px;
  }

  @keyframes pulse {
    0%, 100% { box-shadow: 0 4px 16px rgba(99, 102, 241, 0.35); }
    50% { box-shadow: 0 6px 24px rgba(99, 102, 241, 0.55); }
  }

  .hint-banner {
    position: absolute;
    top: 12px;
    left: 12px;
    z-index: 50;
    background: #fef3c7;
    color: #92400e;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 12px;
    border-left: 4px solid #f59e0b;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  .sidebar-area {
    width: 340px;
    flex-shrink: 0;
    border-left: 1px solid #e5e7eb;
    background: white;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .status-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 16px;
    background: white;
    border-top: 1px solid #e5e7eb;
    font-size: 12px;
    color: #64748b;
    flex-shrink: 0;
  }

  .stats {
    display: flex;
    gap: 18px;
  }

  .stat strong {
    color: #334155;
    font-weight: 600;
  }

  .stat.tip {
    color: #94a3b8;
  }

  @media (max-width: 1100px) {
    .sidebar-area {
      width: 300px;
    }
    .stat.tip {
      display: none;
    }
  }

  .compare-canvases {
    display: flex;
    flex: 1;
    min-height: 0;
    gap: 0;
  }

  .compare-canvas-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    position: relative;
    background: #fafafa;
  }

  .compare-divider {
    width: 4px;
    background: linear-gradient(180deg, #6366f1, #8b5cf6);
    flex-shrink: 0;
    z-index: 10;
    position: relative;
  }

  .compare-divider::before {
    content: 'VS';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    color: #6366f1;
    font-weight: 700;
    font-size: 11px;
    padding: 4px 6px;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .canvas-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 16px;
    background: white;
    border-bottom: 1px solid #e5e7eb;
    flex-shrink: 0;
    z-index: 5;
  }

  .canvas-header.left {
    background: linear-gradient(90deg, #eff6ff, white);
    border-right: 1px solid #dbeafe;
  }

  .canvas-header.right {
    background: linear-gradient(90deg, #fff7ed, white);
    border-left: 1px solid #fed7aa;
  }

  .canvas-badge {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 13px;
    color: white;
    flex-shrink: 0;
  }

  .canvas-header.left .canvas-badge {
    background: linear-gradient(135deg, #3b82f6, #2563eb);
    box-shadow: 0 2px 6px rgba(59, 130, 246, 0.3);
  }

  .canvas-header.right .canvas-badge {
    background: linear-gradient(135deg, #f97316, #ea580c);
    box-shadow: 0 2px 6px rgba(249, 115, 22, 0.3);
  }

  .canvas-title {
    font-size: 13px;
    font-weight: 600;
    color: #1e293b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .canvas-header.left .canvas-title {
    color: #1e40af;
  }

  .canvas-header.right .canvas-title {
    color: #9a3412;
  }

  @media (max-width: 1100px) {
    .sidebar-area {
      width: 300px;
    }
    .stat.tip {
      display: none;
    }
  }

  @media (max-width: 800px) {
    .main-content {
      flex-direction: column;
    }
    .sidebar-area {
      width: 100%;
      height: 40%;
      border-left: none;
      border-top: 1px solid #e5e7eb;
    }
    .compare-canvases {
      flex-direction: column;
    }
    .compare-divider {
      width: 100%;
      height: 4px;
      background: linear-gradient(90deg, #6366f1, #8b5cf6);
    }
    .compare-divider::before {
      top: 50%;
      left: 50%;
    }
  }
</style>
