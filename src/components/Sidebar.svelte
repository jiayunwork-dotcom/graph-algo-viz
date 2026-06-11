<script lang="ts">
  import { ALGORITHM_INFO } from '../lib/algorithms/registry';
  import type { AlgorithmType, AlgorithmData } from '../lib/types';

  export let algorithmType: AlgorithmType | null = null;
  export let algorithmData: AlgorithmData = {};
  export let hasAlgorithm: boolean = false;
  export let compareMode: boolean = false;
  export let algorithmType2: AlgorithmType | null = null;
  export let algorithmData2: AlgorithmData = {};
  export let hasAlgorithm2: boolean = false;

  function formatKey(key: string): string {
    const map: Record<string, string> = {
      queue: '🔹 队列 Queue',
      stack: '🔹 栈 Stack',
      visited: '✅ 已访问',
      order: '📋 遍历顺序',
      distances: '📏 距离表',
      previous: '🔗 前驱节点',
      unvisited: '⏳ 待访问',
      dfn: '🕒 dfn 发现时间',
      low: '🔻 low 值',
      inDegree: '⤵️ 入度表',
      result: '🏁 最终结果',
      components: '🔶 强连通分量',
      onStack: '📌 在栈中',
      current: '🎯 当前节点',
      time: '⏱️ 时间戳',
      iteration: '🔄 迭代轮数',
      totalWeight: '⚖️ 总权重',
      mstEdges: '🌳 MST 边',
      inMST: '✅ 在 MST 中',
      keyValues: '🔑 Key 值',
      candidateEdges: '💡 候选边',
      sortedEdges: '📋 排序后边',
      dsuGroups: '👥 并查集分组',
      distMatrix: '📊 距离矩阵',
      k: '🔵 中间节点 k',
      i: '行 i',
      j: '列 j',
      source: '🚰 源点 S',
      sink: '🚰 汇点 T',
      maxFlow: '🌊 最大流',
      augmentingPath: '🛣️ 增广路径',
      edgeFlows: '💧 边流量',
      edgeCapacities: '📦 边容量',
      minCutS: '✂️ 最小割 S',
      minCutT: '✂️ 最小割 T',
      minCutEdges: '✂️ 最小割边',
      hasCycle: '⚠️ 有环',
      cycleNodes: '🔴 环中节点',
      hasNegativeCycle: '⚠️ 负权环',
      negativeCycleEdges: '🔴 负权环边',
      currentEdge: '📌 当前边',
      currentEdgeIndex: '📌 当前边索引',
      relaxedEdge: '✨ 松弛边',
      discoveryTime: '🕒 发现时间',
      finishTime: '✅ 完成时间',
      groups: '👥 分组'
    };
    return map[key] ?? key;
  }

  function shouldHide(key: string): boolean {
    return key === '' || key === 'nodeIds' || key === 'currentCell' || key === 'updatedCell' || key === 'data';
  }

  function formatNumber(v: number): string {
    if (!isFinite(v)) return '∞';
    return String(v);
  }

  function isObjectArray(arr: any[]): boolean {
    return arr.length > 0 && typeof arr[0] === 'object' && arr[0] !== null && !Array.isArray(arr[0]);
  }

  function hasMatrix(obj: any): boolean {
    return !!(obj.distMatrix && Array.isArray(obj.distMatrix));
  }

  function renderSimpleArray(items: any[]): string {
    if (items.length === 0) return '[ ]';
    return '[' + items.map((v, i) => `#${i}:${String(v)}`).join(', ') + ']';
  }

  function renderObjectMap(obj: any): string {
    const entries = Object.entries(obj);
    if (entries.length === 0) return '{ }';
    return '{ ' + entries.map(([k, v]) => {
      const val = v === 'Infinity' ? '∞' : String(v);
      return `${k}→${val}`;
    }).join(', ') + ' }';
  }

  function renderObjArrayItems(items: any[]): string {
    if (items.length === 0) return '[]';
    return items.map((item, i) => {
      const fields = Object.entries(item).map(([k, v]) => `${k}:${String(v)}`).join(' ');
      return `[#${i + 1}] ${fields}`;
    }).join(' | ');
  }

  function renderMatrix(obj: any): string {
    const nodeIds = obj.nodeIds;
    const matrix = obj.distMatrix;
    if (!nodeIds || !matrix) return '';
    const header = '    ' + nodeIds.join('  ');
    const rows = matrix.map((row: any[], ri: number) => {
      const label = String(nodeIds[ri]).padStart(2, ' ') + ' |';
      const cells = row.map((cell: any) => String(cell === '∞' ? '∞' : cell).padStart(3, ' ')).join(' ');
      return label + cells;
    });
    return header + '\n' + rows.join('\n');
  }

  function renderValue(key: string, value: any): { type: string; content: any } {
    if (typeof value === 'string') {
      return { type: 'text', content: value };
    } else if (typeof value === 'number') {
      return { type: 'number', content: formatNumber(value) };
    } else if (typeof value === 'boolean') {
      return { type: 'boolean', content: value };
    } else if (Array.isArray(value)) {
      if (key === 'distMatrix') {
        return { type: 'skip', content: null };
      }
      if (isObjectArray(value)) {
        return { type: 'objarray', content: value };
      }
      return { type: 'array', content: value };
    } else if (typeof value === 'object' && value !== null) {
      return { type: 'object', content: value };
    }
    return { type: 'text', content: String(value ?? '—') };
  }

  function arrayToString(arr: any[]): string {
    return arr.map(v => String(v)).join(', ');
  }

  function objectEntriesLimit(obj: any, limit: number = 10): [string, any][] {
    return Object.entries(obj).slice(0, limit);
  }

  $: dataEntries = Object.entries(algorithmData).filter(([k]) => !shouldHide(k));
  $: hasMatrixData = hasMatrix(algorithmData);
</script>

<div class="sidebar">
  {#if compareMode}
    <div class="compare-sidebars">
      <div class="compare-sidebar left">
        {#if algorithmType && ALGORITHM_INFO[algorithmType]}
          <div class="section algo-info">
            <div class="algo-header left">
              <span class="algo-badge">A</span>
              <h2 class="algo-name">{ALGORITHM_INFO[algorithmType].name}</h2>
            </div>
            <div class="complexity-grid">
              <div class="complexity-item">
                <span class="label">时间</span>
                <span class="value time">{ALGORITHM_INFO[algorithmType].timeComplexity}</span>
              </div>
              <div class="complexity-item">
                <span class="label">空间</span>
                <span class="value space">{ALGORITHM_INFO[algorithmType].spaceComplexity}</span>
              </div>
            </div>
          </div>
        {/if}
        {#if hasAlgorithm && dataEntries.length > 0}
          <div class="section data-display">
            <h3 class="section-title">📊 数据状态 A</h3>
            <div class="data-view compact">
              {#each dataEntries as [key, value]}
                {#if renderValue(key, value).type !== 'skip' && !shouldHide(key)}
                  <div class="data-item compact">
                    <div class="data-key">{formatKey(key)}</div>
                    <div class="data-value">
                      {#if renderValue(key, value).type === 'text' || renderValue(key, value).type === 'number'}
                        <code class={renderValue(key, value).type === 'number' ? 'num-value' : 'text-value'}>
                          {renderValue(key, value).content}
                        </code>
                      {:else if renderValue(key, value).type === 'array'}
                        {#if renderValue(key, value).content.length === 0}
                          <span class="empty-array">[ ]</span>
                        {:else}
                          <span class="array-inline">
                            [{arrayToString(renderValue(key, value).content)}]
                          </span>
                        {/if}
                      {:else if renderValue(key, value).type === 'object'}
                        {#if Object.keys(renderValue(key, value).content).length === 0}
                          <span class="empty-array">{'{'} {'}'}</span>
                        {:else}
                          <div class="object-map compact">
                            {#each objectEntriesLimit(renderValue(key, value).content) as [mk, mv]}
                              <div class="map-entry compact">
                                <code class="map-key">{mk}</code>
                                <span class="map-arrow">→</span>
                                <code class={typeof mv === 'number' ? 'num-value' : 'text-value'}>
                                  {mv === 'Infinity' ? '∞' : String(mv)}
                                </code>
                              </div>
                            {/each}
                          </div>
                        {/if}
                      {/if}
                    </div>
                  </div>
                {/if}
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <div class="compare-sidebar-divider"></div>

      <div class="compare-sidebar right">
        {#if algorithmType2 && ALGORITHM_INFO[algorithmType2]}
          <div class="section algo-info">
            <div class="algo-header right">
              <span class="algo-badge">B</span>
              <h2 class="algo-name">{ALGORITHM_INFO[algorithmType2].name}</h2>
            </div>
            <div class="complexity-grid">
              <div class="complexity-item">
                <span class="label">时间</span>
                <span class="value time">{ALGORITHM_INFO[algorithmType2].timeComplexity}</span>
              </div>
              <div class="complexity-item">
                <span class="label">空间</span>
                <span class="value space">{ALGORITHM_INFO[algorithmType2].spaceComplexity}</span>
              </div>
            </div>
          </div>
        {/if}
        {#if hasAlgorithm2}
          <div class="section data-display">
            <h3 class="section-title">📊 数据状态 B</h3>
            <div class="data-view compact">
              {#each Object.entries(algorithmData2).filter(([k]) => !shouldHide(k)) as [key, value]}
                {#if renderValue(key, value).type !== 'skip'}
                  <div class="data-item compact">
                    <div class="data-key">{formatKey(key)}</div>
                    <div class="data-value">
                      {#if renderValue(key, value).type === 'text' || renderValue(key, value).type === 'number'}
                        <code class={renderValue(key, value).type === 'number' ? 'num-value' : 'text-value'}>
                          {renderValue(key, value).content}
                        </code>
                      {:else if renderValue(key, value).type === 'array'}
                        {#if renderValue(key, value).content.length === 0}
                          <span class="empty-array">[ ]</span>
                        {:else}
                          <span class="array-inline">
                            [{arrayToString(renderValue(key, value).content)}]
                          </span>
                        {/if}
                      {:else if renderValue(key, value).type === 'object'}
                        {#if Object.keys(renderValue(key, value).content).length === 0}
                          <span class="empty-array">{'{'} {'}'}</span>
                        {:else}
                          <div class="object-map compact">
                            {#each objectEntriesLimit(renderValue(key, value).content) as [mk, mv]}
                              <div class="map-entry compact">
                                <code class="map-key">{mk}</code>
                                <span class="map-arrow">→</span>
                                <code class={typeof mv === 'number' ? 'num-value' : 'text-value'}>
                                  {mv === 'Infinity' ? '∞' : String(mv)}
                                </code>
                              </div>
                            {/each}
                          </div>
                        {/if}
                      {/if}
                    </div>
                  </div>
                {/if}
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>
  {:else}
    {#if algorithmType && ALGORITHM_INFO[algorithmType]}
      <div class="section algo-info">
        <h3 class="section-title">📖 算法说明</h3>
        <h2 class="algo-name">{ALGORITHM_INFO[algorithmType].name}</h2>
        <p class="algo-desc">{ALGORITHM_INFO[algorithmType].description}</p>
        
        <div class="complexity-grid">
          <div class="complexity-item">
            <span class="label">时间</span>
            <span class="value time">{ALGORITHM_INFO[algorithmType].timeComplexity}</span>
          </div>
          <div class="complexity-item">
            <span class="label">空间</span>
            <span class="value space">{ALGORITHM_INFO[algorithmType].spaceComplexity}</span>
          </div>
        </div>

        <div class="use-cases">
          <h4>适用场景</h4>
          <ul>
            {#each ALGORITHM_INFO[algorithmType].useCases as uc}
              <li>{uc}</li>
            {/each}
          </ul>
        </div>
      </div>
    {/if}

    {#if hasAlgorithm && dataEntries.length > 0}
      <div class="section data-display">
        <h3 class="section-title">📊 数据结构状态</h3>
        <div class="data-view">
          {#each dataEntries as [key, value]}
            {#if renderValue(key, value).type !== 'skip'}
              <div class="data-item">
                <div class="data-key">{formatKey(key)}</div>
                <div class="data-value">
                  {#if renderValue(key, value).type === 'text'}
                    <code class="text-value">{renderValue(key, value).content}</code>
                  {:else if renderValue(key, value).type === 'number'}
                    <code class="num-value">{renderValue(key, value).content}</code>
                  {:else if renderValue(key, value).type === 'boolean'}
                    <span class={renderValue(key, value).content ? 'bool-true' : 'bool-false'}>
                      {renderValue(key, value).content ? '✓ 是' : '✗ 否'}
                    </span>
                  {:else if renderValue(key, value).type === 'array'}
                    {#if renderValue(key, value).content.length === 0}
                      <span class="empty-array">[ ]</span>
                    {:else}
                      <div class="array-list">
                        {#each renderValue(key, value).content as item, i}
                          <span class="array-item">
                            <span class="array-index">{i}</span>
                            <code class="array-val">{String(item)}</code>
                          </span>
                        {/each}
                      </div>
                    {/if}
                  {:else if renderValue(key, value).type === 'objarray'}
                    {#if renderValue(key, value).content.length === 0}
                      <span class="empty-array">[]</span>
                    {:else}
                      <div class="obj-array-list">
                        {#each renderValue(key, value).content as item, i}
                          <div class="obj-array-item">
                            <span class="item-badge">#{i + 1}</span>
                            <div class="item-fields">
                              {#each Object.entries(item) as [fk, fv]}
                                <span class="field">
                                  <span class="f-key">{fk}:</span>
                                  <span class="f-val">{String(fv)}</span>
                                </span>
                              {/each}
                            </div>
                          </div>
                        {/each}
                      </div>
                    {/if}
                  {:else if renderValue(key, value).type === 'object'}
                    {#if hasMatrixData && key !== 'distMatrix' && algorithmData.distMatrix}
                      <div class="matrix-section">
                        <div class="matrix-wrap">
                          <pre class="matrix-text">{renderMatrix(algorithmData)}</pre>
                        </div>
                      </div>
                    {/if}
                    {#if !hasMatrixData || key !== 'nodeIds'}
                      {#if Object.keys(renderValue(key, value).content).length === 0}
                        <span class="empty-array">{'{'} {'}'}</span>
                      {:else}
                        <div class="object-map">
                          {#each Object.entries(renderValue(key, value).content) as [mk, mv]}
                            <div class="map-entry">
                              <code class="map-key">{mk}</code>
                              <span class="map-arrow">→</span>
                              <code class={typeof mv === 'number' ? 'num-value' : 'text-value'}>
                                {mv === 'Infinity' ? '∞' : String(mv)}
                              </code>
                            </div>
                          {/each}
                        </div>
                      {/if}
                    {/if}
                  {/if}
                </div>
              </div>
            {/if}
          {/each}
        </div>
      </div>
    {/if}

    {#if !hasAlgorithm}
      <div class="empty-hint">
        <div class="hint-icon">🧠</div>
        <p>选择一个算法并配置参数后<br/>点击"运行算法"开始可视化</p>
      </div>
    {/if}
  {/if}
</div>

<style>
  .sidebar {
    width: 100%;
    height: 100%;
    overflow-y: auto;
    background: white;
    padding: 16px;
  }

  .sidebar::-webkit-scrollbar {
    width: 6px;
  }

  .sidebar::-webkit-scrollbar-track {
    background: #f1f5f9;
  }

  .sidebar::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
  }

  .section {
    margin-bottom: 24px;
  }

  .section-title {
    font-size: 13px;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 2px solid #f1f5f9;
  }

  .algo-info .algo-name {
    font-size: 18px;
    font-weight: 700;
    color: #1e293b;
    margin: 0 0 8px 0;
  }

  .algo-desc {
    font-size: 13px;
    line-height: 1.6;
    color: #475569;
    margin: 0 0 14px 0;
  }

  .complexity-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 14px;
  }

  .complexity-item {
    background: #f8fafc;
    padding: 8px 10px;
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .complexity-item .label {
    font-size: 11px;
    color: #64748b;
  }

  .complexity-item .value {
    font-family: 'SF Mono', Monaco, monospace;
    font-size: 13px;
    font-weight: 600;
  }

  .complexity-item .time { color: #f59e0b; }
  .complexity-item .space { color: #10b981; }

  .use-cases h4 {
    font-size: 12px;
    font-weight: 600;
    color: #475569;
    margin: 0 0 6px 0;
  }

  .use-cases ul {
    margin: 0;
    padding-left: 18px;
  }

  .use-cases li {
    font-size: 12px;
    color: #64748b;
    line-height: 1.6;
  }

  .data-view {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .data-item {
    background: #fafafa;
    border: 1px solid #f0f0f0;
    border-radius: 8px;
    padding: 10px;
  }

  .data-key {
    font-size: 12px;
    font-weight: 600;
    color: #475569;
    margin-bottom: 8px;
  }

  .data-value {
    font-size: 12px;
  }

  code {
    font-family: 'SF Mono', Monaco, Consolas, monospace;
    background: #fff;
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid #e5e7eb;
    font-size: 11px;
  }

  .text-value { color: #334155; }
  .num-value { color: #f59e0b; font-weight: 600; }

  .bool-true { color: #10b981; font-weight: 600; }
  .bool-false { color: #94a3b8; }

  .empty-array {
    color: #94a3b8;
    font-style: italic;
  }

  .array-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .array-item {
    display: flex;
    align-items: center;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 5px;
    overflow: hidden;
  }

  .array-index {
    background: #dbeafe;
    padding: 3px 7px;
    font-size: 10px;
    color: #1d4ed8;
    font-weight: 600;
  }

  .array-val {
    padding: 3px 7px;
    font-size: 11px;
    background: transparent;
    border: none;
  }

  .object-map {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .map-entry {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
  }

  .map-key {
    background: #fef3c7;
    border-color: #fde68a;
    color: #92400e;
    min-width: 30px;
    text-align: center;
  }

  .map-arrow {
    color: #94a3b8;
  }

  .obj-array-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .obj-array-item {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 6px 8px;
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }

  .item-badge {
    background: #8b5cf6;
    color: white;
    font-size: 10px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 10px;
    flex-shrink: 0;
  }

  .item-fields {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .field {
    font-size: 11px;
  }

  .f-key {
    color: #64748b;
    margin-right: 3px;
  }

  .f-val {
    font-family: monospace;
    color: #1e293b;
  }

  .matrix-section {
    margin-bottom: 10px;
  }

  .matrix-wrap {
    overflow-x: auto;
  }

  .matrix-text {
    font-family: 'SF Mono', Monaco, monospace;
    font-size: 11px;
    line-height: 1.6;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 10px;
    margin: 0;
    color: #374151;
  }

  .empty-hint {
    text-align: center;
    padding: 40px 20px;
    color: #94a3b8;
  }

  .hint-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  .empty-hint p {
    font-size: 13px;
    line-height: 1.6;
    margin: 0;
  }

  .compare-sidebars {
    display: flex;
    height: 100%;
    gap: 0;
  }

  .compare-sidebar {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    min-width: 0;
  }

  .compare-sidebar.left {
    border-right: 1px solid #e5e7eb;
  }

  .compare-sidebar-divider {
    width: 3px;
    background: linear-gradient(180deg, #6366f1, #8b5cf6);
    flex-shrink: 0;
  }

  .algo-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .algo-badge {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 12px;
    color: white;
    flex-shrink: 0;
  }

  .algo-badge.left,
  .algo-header.left .algo-badge {
    background: linear-gradient(135deg, #3b82f6, #2563eb);
  }

  .algo-badge.right,
  .algo-header.right .algo-badge {
    background: linear-gradient(135deg, #f97316, #ea580c);
  }

  .algo-header .algo-name {
    font-size: 13px;
    font-weight: 700;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .data-view.compact .data-item {
    padding: 6px 8px;
    margin-bottom: 6px;
  }

  .data-view.compact .data-key {
    font-size: 11px;
    margin-bottom: 4px;
  }

  .array-inline {
    font-family: 'SF Mono', Monaco, monospace;
    font-size: 11px;
    background: white;
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid #e5e7eb;
    display: inline-block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .object-map.compact .map-entry {
    font-size: 10px;
    padding: 2px 0;
  }

  .object-map.compact .map-key {
    padding: 1px 4px;
    font-size: 10px;
    min-width: 20px;
  }

  .compare-sidebar::-webkit-scrollbar {
    width: 4px;
  }

  .compare-sidebar::-webkit-scrollbar-track {
    background: #f1f5f9;
  }

  .compare-sidebar::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 2px;
  }
</style>
