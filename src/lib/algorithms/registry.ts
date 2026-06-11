import type { AlgorithmInfo, AlgorithmType, PresetGraph } from '../types';

export const ALGORITHM_INFO: Record<AlgorithmType, AlgorithmInfo> = {
  'bfs': {
    type: 'bfs',
    name: 'BFS 广度优先搜索',
    description: '从起始节点出发，逐层遍历图中所有节点，先访问所有相邻节点再深入下一层。使用队列实现，适合找最短路径。',
    timeComplexity: 'O(V + E)',
    spaceComplexity: 'O(V)',
    useCases: ['最短路径（无权图）', '层序遍历', '连通性检测', '二分图检测'],
    requiresStartNode: true
  },
  'dfs': {
    type: 'dfs',
    name: 'DFS 深度优先搜索',
    description: '从起始节点出发，沿一条路径尽可能深入直到无法继续，然后回溯探索其他分支。使用栈或递归实现。',
    timeComplexity: 'O(V + E)',
    spaceComplexity: 'O(V)',
    useCases: ['拓扑排序', '强连通分量', '环检测', '路径查找', '迷宫求解'],
    requiresStartNode: true
  },
  'dijkstra': {
    type: 'dijkstra',
    name: 'Dijkstra 单源最短路径',
    description: '贪心算法，每次选择当前距离最小的节点进行松弛操作，计算从起点到所有节点的最短路径。不能处理负权边。',
    timeComplexity: 'O((V+E) log V)',
    spaceComplexity: 'O(V)',
    useCases: ['导航系统最短路径', '网络路由', '权重均为正的图'],
    requiresStartNode: true
  },
  'bellman-ford': {
    type: 'bellman-ford',
    name: 'Bellman-Ford 最短路径',
    description: '对所有边进行 V-1 轮松弛操作，可处理负权边并检测负权环。第 V 轮若仍能松弛说明存在负权环。',
    timeComplexity: 'O(V * E)',
    spaceComplexity: 'O(V)',
    useCases: ['含负权边的图', '检测负权环', '金融套利检测'],
    requiresStartNode: true
  },
  'floyd-warshall': {
    type: 'floyd-warshall',
    name: 'Floyd-Warshall 全源最短路径',
    description: '动态规划算法，通过中间节点 k 逐步更新任意两点之间的最短路径距离矩阵。',
    timeComplexity: 'O(V³)',
    spaceComplexity: 'O(V²)',
    useCases: ['小规模图的全源最短路径', '传递闭包', '网络直径计算'],
    requiresStartNode: false
  },
  'kruskal': {
    type: 'kruskal',
    name: 'Kruskal 最小生成树',
    description: '将所有边按权重从小到大排序，依次加入不形成环的边，使用并查集检测环。',
    timeComplexity: 'O(E log E)',
    spaceComplexity: 'O(V + E)',
    useCases: ['稀疏图最小生成树', '网络设计', '聚类分析'],
    requiresStartNode: false
  },
  'prim': {
    type: 'prim',
    name: 'Prim 最小生成树',
    description: '从任意起点开始，每次选择连接当前生成树与外部节点的最小权重边扩展。',
    timeComplexity: 'O((V+E) log V)',
    spaceComplexity: 'O(V + E)',
    useCases: ['稠密图最小生成树', '网络设计', '电缆布线'],
    requiresStartNode: true
  },
  'edmonds-karp': {
    type: 'edmonds-karp',
    name: 'Edmonds-Karp 最大流',
    description: '使用 BFS 寻找增广路径的 Ford-Fulkerson 方法实现，迭代地在残余图中推送流量。',
    timeComplexity: 'O(V * E²)',
    spaceComplexity: 'O(V + E)',
    useCases: ['网络流量优化', ' bipartite matching', '资源分配', '最小割问题'],
    requiresStartNode: true
  },
  'kahn': {
    type: 'kahn',
    name: 'Kahn 拓扑排序',
    description: '维护入度为 0 的节点队列，依次取出并减少其邻居入度，生成拓扑有序序列。若图有环则失败。',
    timeComplexity: 'O(V + E)',
    spaceComplexity: 'O(V)',
    useCases: ['任务调度', '编译依赖', '课程安排', 'DAG 排序'],
    requiresStartNode: false
  },
  'tarjan': {
    type: 'tarjan',
    name: 'Tarjan 强连通分量',
    description: '基于 DFS 的算法，通过维护 dfn（发现时间）和 low（可追溯最早祖先）值识别强连通分量。',
    timeComplexity: 'O(V + E)',
    spaceComplexity: 'O(V)',
    useCases: ['缩点', '2-SAT 问题', '依赖分析', '社交网络分析'],
    requiresStartNode: false
  }
};

export const PRESET_GRAPHS: PresetGraph[] = [
  {
    id: 'k5',
    name: '完全图 K5',
    description: '5 个节点的完全无向图，任意两节点之间都有边相连',
    settings: { mode: 'undirected', isWeighted: false, isDirected: false, isFlow: false },
    nodes: [
      { id: 1, label: '1', x: 400, y: 120, fixed: false },
      { id: 2, label: '2', x: 620, y: 260, fixed: false },
      { id: 3, label: '3', x: 540, y: 520, fixed: false },
      { id: 4, label: '4', x: 260, y: 520, fixed: false },
      { id: 5, label: '5', x: 180, y: 260, fixed: false }
    ],
    edges: [
      { id: '1-2', source: 1, target: 2, weight: 1, directed: false },
      { id: '1-3', source: 1, target: 3, weight: 1, directed: false },
      { id: '1-4', source: 1, target: 4, weight: 1, directed: false },
      { id: '1-5', source: 1, target: 5, weight: 1, directed: false },
      { id: '2-3', source: 2, target: 3, weight: 1, directed: false },
      { id: '2-4', source: 2, target: 4, weight: 1, directed: false },
      { id: '2-5', source: 2, target: 5, weight: 1, directed: false },
      { id: '3-4', source: 3, target: 4, weight: 1, directed: false },
      { id: '3-5', source: 3, target: 5, weight: 1, directed: false },
      { id: '4-5', source: 4, target: 5, weight: 1, directed: false }
    ]
  },
  {
    id: 'bipartite',
    name: '二部图示例',
    description: '一个二分图，节点分为两组，边只在组之间存在',
    settings: { mode: 'weighted', isWeighted: true, isDirected: false, isFlow: false },
    nodes: [
      { id: 1, label: 'A', x: 180, y: 150, fixed: false },
      { id: 2, label: 'B', x: 180, y: 320, fixed: false },
      { id: 3, label: 'C', x: 180, y: 490, fixed: false },
      { id: 4, label: 'X', x: 620, y: 150, fixed: false },
      { id: 5, label: 'Y', x: 620, y: 320, fixed: false },
      { id: 6, label: 'Z', x: 620, y: 490, fixed: false }
    ],
    edges: [
      { id: '1-4', source: 1, target: 4, weight: 7, directed: false },
      { id: '1-5', source: 1, target: 5, weight: 3, directed: false },
      { id: '2-4', source: 2, target: 4, weight: 5, directed: false },
      { id: '2-5', source: 2, target: 5, weight: 8, directed: false },
      { id: '2-6', source: 2, target: 6, weight: 4, directed: false },
      { id: '3-5', source: 3, target: 5, weight: 2, directed: false },
      { id: '3-6', source: 3, target: 6, weight: 6, directed: false }
    ]
  },
  {
    id: 'negative-weight',
    name: '带负权边的图',
    description: '适合测试 Bellman-Ford 算法的含负权边的图',
    settings: { mode: 'weighted-directed', isWeighted: true, isDirected: true, isFlow: false },
    nodes: [
      { id: 1, label: '1', x: 200, y: 320, fixed: false },
      { id: 2, label: '2', x: 400, y: 150, fixed: false },
      { id: 3, label: '3', x: 400, y: 490, fixed: false },
      { id: 4, label: '4', x: 600, y: 320, fixed: false },
      { id: 5, label: '5', x: 780, y: 320, fixed: false }
    ],
    edges: [
      { id: '1->2', source: 1, target: 2, weight: 6, directed: true },
      { id: '1->3', source: 1, target: 3, weight: 7, directed: true },
      { id: '2->3', source: 2, target: 3, weight: 8, directed: true },
      { id: '2->4', source: 2, target: 4, weight: -4, directed: true },
      { id: '3->4', source: 3, target: 4, weight: 9, directed: true },
      { id: '3->5', source: 3, target: 5, weight: -3, directed: true },
      { id: '4->5', source: 4, target: 5, weight: 7, directed: true },
      { id: '4->2', source: 4, target: 2, weight: 5, directed: true }
    ]
  },
  {
    id: 'dag',
    name: '有向无环图 DAG',
    description: '适合拓扑排序的 DAG 图',
    settings: { mode: 'directed', isWeighted: false, isDirected: true, isFlow: false },
    nodes: [
      { id: 1, label: '1', x: 180, y: 180, fixed: false },
      { id: 2, label: '2', x: 180, y: 460, fixed: false },
      { id: 3, label: '3', x: 400, y: 80, fixed: false },
      { id: 4, label: '4', x: 400, y: 320, fixed: false },
      { id: 5, label: '5', x: 400, y: 560, fixed: false },
      { id: 6, label: '6', x: 620, y: 200, fixed: false },
      { id: 7, label: '7', x: 620, y: 440, fixed: false },
      { id: 8, label: '8', x: 820, y: 320, fixed: false }
    ],
    edges: [
      { id: '1->3', source: 1, target: 3, weight: 1, directed: true },
      { id: '1->4', source: 1, target: 4, weight: 1, directed: true },
      { id: '2->4', source: 2, target: 4, weight: 1, directed: true },
      { id: '2->5', source: 2, target: 5, weight: 1, directed: true },
      { id: '3->6', source: 3, target: 6, weight: 1, directed: true },
      { id: '4->6', source: 4, target: 6, weight: 1, directed: true },
      { id: '4->7', source: 4, target: 7, weight: 1, directed: true },
      { id: '5->7', source: 5, target: 7, weight: 1, directed: true },
      { id: '6->8', source: 6, target: 8, weight: 1, directed: true },
      { id: '7->8', source: 7, target: 8, weight: 1, directed: true }
    ]
  },
  {
    id: 'disconnected',
    name: '非连通图',
    description: '包含两个独立连通分量的非连通图',
    settings: { mode: 'weighted', isWeighted: true, isDirected: false, isFlow: false },
    nodes: [
      { id: 1, label: '1', x: 150, y: 200, fixed: false },
      { id: 2, label: '2', x: 300, y: 100, fixed: false },
      { id: 3, label: '3', x: 300, y: 300, fixed: false },
      { id: 4, label: '4', x: 500, y: 200, fixed: false },
      { id: 5, label: '5', x: 700, y: 150, fixed: false },
      { id: 6, label: '6', x: 850, y: 280, fixed: false },
      { id: 7, label: '7', x: 700, y: 420, fixed: false }
    ],
    edges: [
      { id: '1-2', source: 1, target: 2, weight: 4, directed: false },
      { id: '1-3', source: 1, target: 3, weight: 2, directed: false },
      { id: '2-4', source: 2, target: 4, weight: 5, directed: false },
      { id: '3-4', source: 3, target: 4, weight: 8, directed: false },
      { id: '5-6', source: 5, target: 6, weight: 3, directed: false },
      { id: '5-7', source: 5, target: 7, weight: 6, directed: false },
      { id: '6-7', source: 6, target: 7, weight: 4, directed: false }
    ]
  },
  {
    id: 'flow-network',
    name: '流网络',
    description: '适合 Edmonds-Karp 最大流算法的流网络',
    settings: { mode: 'flow', isWeighted: true, isDirected: true, isFlow: true },
    nodes: [
      { id: 1, label: 'S', x: 120, y: 320, fixed: false },
      { id: 2, label: '2', x: 340, y: 150, fixed: false },
      { id: 3, label: '3', x: 340, y: 490, fixed: false },
      { id: 4, label: '4', x: 560, y: 200, fixed: false },
      { id: 5, label: '5', x: 560, y: 440, fixed: false },
      { id: 6, label: 'T', x: 780, y: 320, fixed: false }
    ],
    edges: [
      { id: '1->2', source: 1, target: 2, weight: 16, directed: true, capacity: 16, flow: 0 },
      { id: '1->3', source: 1, target: 3, weight: 13, directed: true, capacity: 13, flow: 0 },
      { id: '2->4', source: 2, target: 4, weight: 12, directed: true, capacity: 12, flow: 0 },
      { id: '3->2', source: 3, target: 2, weight: 4, directed: true, capacity: 4, flow: 0 },
      { id: '3->5', source: 3, target: 5, weight: 14, directed: true, capacity: 14, flow: 0 },
      { id: '4->3', source: 4, target: 3, weight: 9, directed: true, capacity: 9, flow: 0 },
      { id: '4->6', source: 4, target: 6, weight: 20, directed: true, capacity: 20, flow: 0 },
      { id: '5->4', source: 5, target: 4, weight: 7, directed: true, capacity: 7, flow: 0 },
      { id: '5->6', source: 5, target: 6, weight: 4, directed: true, capacity: 4, flow: 0 }
    ]
  },
  {
    id: 'scc-graph',
    name: '强连通分量图',
    description: '包含多个强连通分量的有向图，适合 Tarjan 算法',
    settings: { mode: 'directed', isWeighted: false, isDirected: true, isFlow: false },
    nodes: [
      { id: 1, label: '1', x: 180, y: 320, fixed: false },
      { id: 2, label: '2', x: 360, y: 150, fixed: false },
      { id: 3, label: '3', x: 360, y: 490, fixed: false },
      { id: 4, label: '4', x: 540, y: 320, fixed: false },
      { id: 5, label: '5', x: 720, y: 150, fixed: false },
      { id: 6, label: '6', x: 720, y: 490, fixed: false },
      { id: 7, label: '7', x: 880, y: 320, fixed: false }
    ],
    edges: [
      { id: '1->2', source: 1, target: 2, weight: 1, directed: true },
      { id: '2->3', source: 2, target: 3, weight: 1, directed: true },
      { id: '3->1', source: 3, target: 1, weight: 1, directed: true },
      { id: '3->4', source: 3, target: 4, weight: 1, directed: true },
      { id: '4->5', source: 4, target: 5, weight: 1, directed: true },
      { id: '5->6', source: 5, target: 6, weight: 1, directed: true },
      { id: '6->4', source: 6, target: 4, weight: 1, directed: true },
      { id: '5->7', source: 5, target: 7, weight: 1, directed: true },
      { id: '6->7', source: 6, target: 7, weight: 1, directed: true }
    ]
  },
  {
    id: 'negative-cycle',
    name: '带负权环的图',
    description: '包含负权环的有向图，Bellman-Ford 算法可检测到该环',
    settings: { mode: 'weighted-directed', isWeighted: true, isDirected: true, isFlow: false },
    nodes: [
      { id: 1, label: '1', x: 180, y: 320, fixed: false },
      { id: 2, label: '2', x: 380, y: 150, fixed: false },
      { id: 3, label: '3', x: 380, y: 490, fixed: false },
      { id: 4, label: '4', x: 580, y: 240, fixed: false },
      { id: 5, label: '5', x: 580, y: 400, fixed: false },
      { id: 6, label: '6', x: 780, y: 320, fixed: false }
    ],
    edges: [
      { id: '1->2', source: 1, target: 2, weight: 3, directed: true },
      { id: '1->3', source: 1, target: 3, weight: 5, directed: true },
      { id: '2->3', source: 2, target: 3, weight: 2, directed: true },
      { id: '2->4', source: 2, target: 4, weight: 6, directed: true },
      { id: '3->5', source: 3, target: 5, weight: 4, directed: true },
      { id: '4->5', source: 4, target: 5, weight: -5, directed: true },
      { id: '4->6', source: 4, target: 6, weight: 2, directed: true },
      { id: '5->4', source: 5, target: 4, weight: -3, directed: true },
      { id: '5->6', source: 5, target: 6, weight: 7, directed: true }
    ]
  }
];
