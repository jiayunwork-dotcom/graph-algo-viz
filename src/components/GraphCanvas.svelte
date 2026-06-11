<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import type { Graph } from '../lib/graph';
  import { GraphCanvasRenderer } from '../lib/renderer';
  import type { GraphNode, GraphEdge, VisualState, NodeId, EdgeId, AlgorithmStep, GraphMode } from '../lib/types';
  import type { ForceDirectedLayout, LayoutType } from '../lib/layout';

  export let graph: Graph;
  export let visualState: VisualState | null = null;
  export let algorithmStep: AlgorithmStep | null = null;
  export let selectedNode: NodeId | null = null;
  export let selectedEdge: EdgeId | null = null;
  export let hoveredNode: NodeId | null = null;
  export let hoveredEdge: EdgeId | null = null;
  export let interactionMode: 'edit' | 'select-start' | 'select-sink' | 'select-start2' | 'select-sink2' = 'edit';
  export let layout: LayoutType = 'force';
  export let forceLayout: ForceDirectedLayout | null = null;

  const dispatch = createEventDispatcher<{
    nodeCreated: { id: NodeId };
    nodeMoved: { id: NodeId };
    nodeSelected: { id: NodeId | null };
    nodeDoubleClicked: { id: NodeId };
    edgeCreated: { source: NodeId; target: NodeId };
    edgeSelected: { id: EdgeId | null };
    requestDeleteNode: { id: NodeId };
    requestDeleteEdge: { id: EdgeId };
    requestNodeLabelEdit: { id: NodeId };
    requestEdgeWeightEdit: { id: EdgeId };
    startNodeSelected: { id: NodeId };
    sinkNodeSelected: { id: NodeId };
    startNodeSelected2: { id: NodeId };
    sinkNodeSelected2: { id: NodeId };
  }>();

  let canvas: HTMLCanvasElement;
  let container: HTMLDivElement;
  let renderer: GraphCanvasRenderer;
  let rafId: number = 0;
  let forceRafId: number = 0;

  let isPanning: boolean = false;
  let panStartX: number = 0;
  let panStartY: number = 0;
  let camStartX: number = 0;
  let camStartY: number = 0;

  let isDraggingNode: boolean = false;
  let draggedNodeId: NodeId | null = null;
  let dragOffsetX: number = 0;
  let dragOffsetY: number = 0;

  let isCreatingEdge: boolean = false;
  let edgeFromNodeId: NodeId | null = null;
  let edgeToScreenX: number = 0;
  let edgeToScreenY: number = 0;

  let contextMenu: { show: boolean; x: number; y: number; type: 'node' | 'edge' | 'canvas'; id?: NodeId | EdgeId } = {
    show: false, x: 0, y: 0, type: 'canvas'
  };

  function renderLoop() {
    if (!renderer || !graph) return;
    const edgeCreating = isCreatingEdge && edgeFromNodeId !== null
      ? { from: edgeFromNodeId, toScreenX: edgeToScreenX, toScreenY: edgeToScreenY }
      : undefined;
    const vs = algorithmStep?.snapshot.visualState || visualState;
    renderer.render(
      graph,
      vs,
      { node: selectedNode || undefined, edge: selectedEdge || undefined },
      { node: hoveredNode || undefined, edge: hoveredEdge || undefined },
      edgeCreating
    );
    rafId = requestAnimationFrame(renderLoop);
  }

  function forceLayoutLoop() {
    if (layout !== 'force' || !forceLayout) return;
    const move = forceLayout.step();
    if (move < 0.1 && graph.getNodeCount() < 30) {
      return;
    }
    forceRafId = requestAnimationFrame(forceLayoutLoop);
  }

  function startForceLayout() {
    cancelAnimationFrame(forceRafId);
    if (layout === 'force' && forceLayout) {
      forceLayout.reset();
      forceLayoutLoop();
    }
  }

  $: if (layout === 'force') {
    startForceLayout();
  } else {
    cancelAnimationFrame(forceRafId);
  }

  function handleResize() {
    if (!renderer || !container) return;
    const rect = container.getBoundingClientRect();
    renderer.resize(rect.width, rect.height);
    if (forceLayout) {
      (forceLayout as any).areaWidth = rect.width;
      (forceLayout as any).areaHeight = rect.height;
    }
  }

  function getCanvasCoords(e: MouseEvent | PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: PointerEvent) {
    if (e.button === 2) return;
    const { x: sx, y: sy } = getCanvasCoords(e);
    canvas.setPointerCapture(e.pointerId);

    hideContextMenu();

    const hitNode = renderer.hitTestNode(sx, sy, graph);
    const hitEdge = !hitNode ? renderer.hitTestEdge(sx, sy, graph) : null;

    if (interactionMode !== 'edit') {
      if (hitNode) {
        if (interactionMode === 'select-start') {
          dispatch('startNodeSelected', { id: hitNode.id });
        } else if (interactionMode === 'select-sink') {
          dispatch('sinkNodeSelected', { id: hitNode.id });
        } else if (interactionMode === 'select-start2') {
          dispatch('startNodeSelected2', { id: hitNode.id });
        } else if (interactionMode === 'select-sink2') {
          dispatch('sinkNodeSelected2', { id: hitNode.id });
        }
      }
      return;
    }

    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      isPanning = true;
      panStartX = sx;
      panStartY = sy;
      camStartX = renderer.camera.x;
      camStartY = renderer.camera.y;
      return;
    }

    if (hitNode) {
      if (selectedNode !== null && selectedNode !== hitNode.id) {
        const existingEdge = graph.getEdgeByNodes(selectedNode, hitNode.id);
        if (existingEdge) {
          selectedNode = null;
          dispatch('nodeSelected', { id: null });
          return;
        }
        dispatch('edgeCreated', { source: selectedNode, target: hitNode.id });
        selectedNode = null;
        dispatch('nodeSelected', { id: null });
        return;
      }

      if (e.detail === 1) {
        isDraggingNode = true;
        draggedNodeId = hitNode.id;
        const world = renderer.screenToWorld(sx, sy);
        dragOffsetX = world.x - hitNode.x;
        dragOffsetY = world.y - hitNode.y;
        selectedNode = hitNode.id;
        selectedEdge = null;
        dispatch('nodeSelected', { id: hitNode.id });
        dispatch('edgeSelected', { id: null });
      }
      return;
    }

    if (hitEdge) {
      selectedEdge = hitEdge.id;
      selectedNode = null;
      dispatch('edgeSelected', { id: hitEdge.id });
      dispatch('nodeSelected', { id: null });
      return;
    }

    const world = renderer.screenToWorld(sx, sy);
    const newNode = graph.addNode(world.x, world.y);
    dispatch('nodeCreated', { id: newNode.id });
    selectedNode = newNode.id;
    dispatch('nodeSelected', { id: newNode.id });
  }

  function handlePointerMove(e: PointerEvent) {
    const { x: sx, y: sy } = getCanvasCoords(e);

    if (isPanning) {
      const dx = (sx - panStartX) / renderer.camera.zoom;
      const dy = (sy - panStartY) / renderer.camera.zoom;
      renderer.camera.x = camStartX - dx;
      renderer.camera.y = camStartY - dy;
      return;
    }

    if (isDraggingNode && draggedNodeId !== null) {
      const world = renderer.screenToWorld(sx, sy);
      const newX = world.x - dragOffsetX;
      const newY = world.y - dragOffsetY;
      graph.updateNodePosition(draggedNodeId, newX, newY);
      graph.setNodeFixed(draggedNodeId, true);
      dispatch('nodeMoved', { id: draggedNodeId });
      return;
    }

    if (isCreatingEdge && edgeFromNodeId !== null) {
      edgeToScreenX = sx;
      edgeToScreenY = sy;
      return;
    }

    const hitNode = renderer.hitTestNode(sx, sy, graph);
    const hitEdge = !hitNode ? renderer.hitTestEdge(sx, sy, graph) : null;
    hoveredNode = hitNode?.id || null;
    hoveredEdge = hitEdge?.id || null;
  }

  function handlePointerUp(e: PointerEvent) {
    canvas.releasePointerCapture(e.pointerId);

    if (isPanning) {
      isPanning = false;
      return;
    }

    if (isDraggingNode && draggedNodeId !== null) {
      isDraggingNode = false;
      draggedNodeId = null;
      return;
    }
  }

  function handleDoubleClick(e: MouseEvent) {
    const { x: sx, y: sy } = getCanvasCoords(e);
    const hitNode = renderer.hitTestNode(sx, sy, graph);
    if (hitNode) {
      graph.setNodeFixed(hitNode.id, false);
      dispatch('nodeDoubleClicked', { id: hitNode.id });
      startForceLayout();
    }
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const { x: sx, y: sy } = getCanvasCoords(e);
    const worldBefore = renderer.screenToWorld(sx, sy);
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    renderer.camera.zoom = Math.max(0.1, Math.min(5, renderer.camera.zoom * factor));
    const worldAfter = renderer.screenToWorld(sx, sy);
    renderer.camera.x += worldBefore.x - worldAfter.x;
    renderer.camera.y += worldBefore.y - worldAfter.y;
  }

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    const { x: sx, y: sy } = getCanvasCoords(e);

    const hitNode = renderer.hitTestNode(sx, sy, graph);
    const hitEdge = !hitNode ? renderer.hitTestEdge(sx, sy, graph) : null;

    if (hitNode) {
      contextMenu = { show: true, x: e.clientX, y: e.clientY, type: 'node', id: hitNode.id };
    } else if (hitEdge) {
      contextMenu = { show: true, x: e.clientX, y: e.clientY, type: 'edge', id: hitEdge.id };
    } else {
      contextMenu = { show: true, x: e.clientX, y: e.clientY, type: 'canvas' };
    }
  }

  function hideContextMenu() {
    contextMenu = { show: false, x: 0, y: 0, type: 'canvas' };
  }

  function ctxDeleteNode() {
    if (contextMenu.type === 'node' && contextMenu.id !== undefined) {
      dispatch('requestDeleteNode', { id: contextMenu.id as NodeId });
      if (selectedNode === contextMenu.id) {
        selectedNode = null;
        dispatch('nodeSelected', { id: null });
      }
    }
    hideContextMenu();
  }

  function ctxEditNodeLabel() {
    if (contextMenu.type === 'node' && contextMenu.id !== undefined) {
      dispatch('requestNodeLabelEdit', { id: contextMenu.id as NodeId });
    }
    hideContextMenu();
  }

  function ctxDeleteEdge() {
    if (contextMenu.type === 'edge' && contextMenu.id !== undefined) {
      dispatch('requestDeleteEdge', { id: contextMenu.id as EdgeId });
      if (selectedEdge === contextMenu.id) {
        selectedEdge = null;
        dispatch('edgeSelected', { id: null });
      }
    }
    hideContextMenu();
  }

  function ctxEditEdgeWeight() {
    if (contextMenu.type === 'edge' && contextMenu.id !== undefined) {
      dispatch('requestEdgeWeightEdit', { id: contextMenu.id as EdgeId });
    }
    hideContextMenu();
  }

  function ctxAddNodeHere() {
    if (contextMenu.type === 'canvas') {
      const rect = canvas.getBoundingClientRect();
      const sx = contextMenu.x - rect.left;
      const sy = contextMenu.y - rect.top;
      const world = renderer.screenToWorld(sx, sy);
      const newNode = graph.addNode(world.x, world.y);
      dispatch('nodeCreated', { id: newNode.id });
    }
    hideContextMenu();
  }

  function resetView() {
    if (renderer) {
      renderer.camera.x = 0;
      renderer.camera.y = 0;
      renderer.camera.zoom = 1;
    }
  }

  export function fitView() {
    if (!renderer || !graph) return;
    const nodes = graph.getAllNodes();
    if (nodes.length === 0) {
      resetView();
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(n => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x);
      maxY = Math.max(maxY, n.y);
    });

    const padding = 100;
    const w = maxX - minX + padding * 2;
    const h = maxY - minY + padding * 2;
    const cw = renderer.canvas.clientWidth;
    const ch = renderer.canvas.clientHeight;

    renderer.camera.zoom = Math.min(cw / w, ch / h, 2);
    renderer.camera.x = (minX + maxX) / 2;
    renderer.camera.y = (minY + maxY) / 2;
  }

  export function getRenderer(): GraphCanvasRenderer {
    return renderer;
  }

  onMount(() => {
    renderer = new GraphCanvasRenderer(canvas);
    handleResize();
    renderLoop();
    window.addEventListener('resize', handleResize);
    window.addEventListener('click', (e) => {
      if (contextMenu.show) hideContextMenu();
    });
  });

  onDestroy(() => {
    cancelAnimationFrame(rafId);
    cancelAnimationFrame(forceRafId);
    window.removeEventListener('resize', handleResize);
  });
</script>

<div bind:this={container} class="canvas-container">
  <canvas
    bind:this={canvas}
    on:pointerdown={handlePointerDown}
    on:pointermove={handlePointerMove}
    on:pointerup={handlePointerUp}
    on:dblclick={handleDoubleClick}
    on:wheel={handleWheel}
    on:contextmenu={handleContextMenu}
    style="touch-action: none; cursor: default;"
  ></canvas>

  {#if contextMenu.show}
    <div 
      class="context-menu" 
      style="left: {contextMenu.x}px; top: {contextMenu.y}px;"
      onclick={(e) => e.stopPropagation()}
    >
      {#if contextMenu.type === 'node'}
        <button class="ctx-item" on:click={ctxEditNodeLabel}>✏️ 编辑标签</button>
        <div class="ctx-divider"></div>
        <button class="ctx-item danger" on:click={ctxDeleteNode}>🗑️ 删除节点</button>
      {:else if contextMenu.type === 'edge'}
        {#if graph.settings.isWeighted}
          <button class="ctx-item" on:click={ctxEditEdgeWeight}>⚖️ 编辑权重</button>
          <div class="ctx-divider"></div>
        {/if}
        <button class="ctx-item danger" on:click={ctxDeleteEdge}>🗑️ 删除边</button>
      {:else}
        <button class="ctx-item" on:click={ctxAddNodeHere}>➕ 在此添加节点</button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .canvas-container {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #fafafa;
  }

  .context-menu {
    position: fixed;
    z-index: 10000;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 4px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
    min-width: 160px;
  }

  .ctx-item {
    display: block;
    width: 100%;
    padding: 8px 12px;
    text-align: left;
    background: none;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    color: #374151;
    transition: background 0.15s;
  }

  .ctx-item:hover {
    background: #f3f4f6;
  }

  .ctx-item.danger {
    color: #dc2626;
  }

  .ctx-item.danger:hover {
    background: #fee2e2;
  }

  .ctx-divider {
    height: 1px;
    background: #e5e7eb;
    margin: 4px 0;
  }
</style>
