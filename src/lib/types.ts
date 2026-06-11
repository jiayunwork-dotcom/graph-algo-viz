export type NodeId = number;
export type EdgeId = string;

export interface GraphNode {
  id: NodeId;
  label: string;
  x: number;
  y: number;
  fixed: boolean;
}

export interface GraphEdge {
  id: EdgeId;
  source: NodeId;
  target: NodeId;
  weight: number;
  directed: boolean;
  flow?: number;
  capacity?: number;
}

export type GraphMode = 'undirected' | 'directed' | 'weighted' | 'weighted-directed' | 'flow';

export interface GraphSettings {
  mode: GraphMode;
  isWeighted: boolean;
  isDirected: boolean;
  isFlow: boolean;
}

export type NodeState = 'default' | 'visited' | 'current' | 'in-queue' | 'in-stack' | 'finished' | 'in-tree' | 'in-cut' | 'in-component';
export type EdgeState = 'default' | 'active' | 'visited' | 'in-tree' | 'in-cut' | 'relaxed' | 'negative' | 'in-component';

export interface VisualState {
  nodeStates: Map<NodeId, NodeState>;
  edgeStates: Map<EdgeId, EdgeState>;
  nodeColors: Map<NodeId, string>;
  highlightedNode: NodeId | null;
  highlightedEdge: EdgeId | null;
}

export interface AlgorithmStep {
  description: string;
  snapshot: AlgorithmSnapshot;
}

export interface AlgorithmSnapshot {
  visualState: VisualState;
  data: AlgorithmData;
}

export interface AlgorithmData {
  [key: string]: any;
}

export type AlgorithmType = 
  | 'bfs' 
  | 'dfs' 
  | 'dijkstra' 
  | 'bellman-ford' 
  | 'floyd-warshall' 
  | 'kruskal' 
  | 'prim' 
  | 'edmonds-karp'
  | 'kahn'
  | 'tarjan';

export interface AlgorithmInfo {
  type: AlgorithmType;
  name: string;
  description: string;
  timeComplexity: string;
  spaceComplexity: string;
  useCases: string[];
  requiresStartNode: boolean;
}

export interface PresetGraph {
  id: string;
  name: string;
  description: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  settings: GraphSettings;
}
