import type { AlgorithmStep, AlgorithmType, AlgorithmSnapshot } from './types';
import type { Graph } from './graph';
import { runBFS, runDFS } from './algorithms/traversal';
import { runDijkstra, runBellmanFord, runFloydWarshall } from './algorithms/shortest-path';
import { runKruskal, runPrim } from './algorithms/mst';
import { runEdmondsKarp, runKahn, runTarjan } from './algorithms/advanced';
import { ALGORITHM_INFO } from './algorithms/registry';

export type PlaybackState = 'idle' | 'playing' | 'paused' | 'finished';

export class AlgorithmAnimator {
  private steps: AlgorithmStep[] = [];
  private currentStepIndex: number = -1;
  private playbackState: PlaybackState = 'idle';
  private speedMultiplier: number = 1;
  private baseInterval: number = 800;
  private timerId: number | null = null;
  private onStepChange?: (step: AlgorithmStep | null, index: number) => void;
  private onStateChange?: (state: PlaybackState) => void;
  private algorithmType: AlgorithmType | null = null;

  getSteps(): AlgorithmStep[] {
    return this.steps;
  }

  getCurrentStepIndex(): number {
    return this.currentStepIndex;
  }

  getCurrentStep(): AlgorithmStep | null {
    if (this.currentStepIndex >= 0 && this.currentStepIndex < this.steps.length) {
      return this.steps[this.currentStepIndex];
    }
    return null;
  }

  getTotalSteps(): number {
    return this.steps.length;
  }

  getPlaybackState(): PlaybackState {
    return this.playbackState;
  }

  getSpeed(): number {
    return this.speedMultiplier;
  }

  getAlgorithmType(): AlgorithmType | null {
    return this.algorithmType;
  }

  setSpeed(speed: number): void {
    this.speedMultiplier = Math.max(0.5, Math.min(4, speed));
  }

  setCallbacks(
    onStepChange: (step: AlgorithmStep | null, index: number) => void,
    onStateChange: (state: PlaybackState) => void
  ): void {
    this.onStepChange = onStepChange;
    this.onStateChange = onStateChange;
  }

  prepareAlgorithm(
    type: AlgorithmType,
    graph: Graph,
    startNodeId?: number,
    sinkNodeId?: number
  ): boolean {
    this.stop();
    this.algorithmType = type;
    const info = ALGORITHM_INFO[type];

    try {
      switch (type) {
        case 'bfs':
          if (startNodeId === undefined) return false;
          this.steps = runBFS(graph, startNodeId);
          break;
        case 'dfs':
          if (startNodeId === undefined) return false;
          this.steps = runDFS(graph, startNodeId);
          break;
        case 'dijkstra':
          if (startNodeId === undefined) return false;
          this.steps = runDijkstra(graph, startNodeId);
          break;
        case 'bellman-ford':
          if (startNodeId === undefined) return false;
          this.steps = runBellmanFord(graph, startNodeId);
          break;
        case 'floyd-warshall':
          this.steps = runFloydWarshall(graph);
          break;
        case 'kruskal':
          this.steps = runKruskal(graph);
          break;
        case 'prim':
          if (startNodeId === undefined) return false;
          this.steps = runPrim(graph, startNodeId);
          break;
        case 'edmonds-karp':
          if (startNodeId === undefined) return false;
          this.steps = runEdmondsKarp(graph, startNodeId, sinkNodeId);
          break;
        case 'kahn':
          this.steps = runKahn(graph);
          break;
        case 'tarjan':
          this.steps = runTarjan(graph);
          break;
      }

      this.currentStepIndex = -1;
      this.playbackState = 'paused';
      this.emitState();
      this.emitStep();
      return true;
    } catch (e) {
      console.error('Algorithm preparation failed:', e);
      this.steps = [];
      this.playbackState = 'idle';
      return false;
    }
  }

  play(): void {
    if (this.steps.length === 0) return;
    if (this.playbackState === 'playing') return;

    if (this.currentStepIndex >= this.steps.length - 1) {
      this.currentStepIndex = -1;
    }

    this.playbackState = 'playing';
    this.emitState();
    this.scheduleNext();
  }

  pause(): void {
    if (this.playbackState !== 'playing') return;
    this.clearTimer();
    this.playbackState = 'paused';
    this.emitState();
  }

  stop(): void {
    this.clearTimer();
    this.steps = [];
    this.currentStepIndex = -1;
    this.playbackState = 'idle';
    this.algorithmType = null;
    this.emitState();
    this.emitStep();
  }

  stepForward(): boolean {
    if (this.steps.length === 0) return false;
    if (this.currentStepIndex >= this.steps.length - 1) {
      this.playbackState = 'finished';
      this.emitState();
      return false;
    }
    this.clearTimer();
    this.currentStepIndex++;
    if (this.playbackState !== 'playing') {
      this.playbackState = 'paused';
    }
    if (this.currentStepIndex >= this.steps.length - 1) {
      this.playbackState = 'finished';
    }
    this.emitStep();
    this.emitState();
    return true;
  }

  stepBackward(): boolean {
    if (this.steps.length === 0) return false;
    if (this.currentStepIndex <= 0) {
      if (this.currentStepIndex === 0) {
        this.currentStepIndex = -1;
        this.emitStep();
      }
      return false;
    }
    this.clearTimer();
    this.currentStepIndex--;
    if (this.playbackState === 'finished') {
      this.playbackState = 'paused';
    }
    this.emitStep();
    this.emitState();
    return true;
  }

  jumpToStep(index: number): void {
    if (this.steps.length === 0) return;
    this.clearTimer();
    index = Math.max(-1, Math.min(this.steps.length - 1, index));
    this.currentStepIndex = index;
    if (index >= this.steps.length - 1) {
      this.playbackState = this.playbackState === 'playing' ? 'playing' : 'finished';
    } else if (index < 0) {
      this.playbackState = 'paused';
    } else if (this.playbackState === 'finished') {
      this.playbackState = 'paused';
    }
    this.emitStep();
    this.emitState();
  }

  replay(): void {
    if (this.steps.length === 0) return;
    this.clearTimer();
    this.currentStepIndex = -1;
    this.playbackState = 'paused';
    this.emitState();
    this.emitStep();
  }

  private scheduleNext(): void {
    this.clearTimer();
    const interval = this.baseInterval / this.speedMultiplier;
    this.timerId = window.setTimeout(() => {
      if (this.playbackState !== 'playing') return;

      if (this.currentStepIndex >= this.steps.length - 1) {
        this.playbackState = 'finished';
        this.emitState();
        return;
      }

      this.currentStepIndex++;
      this.emitStep();

      if (this.currentStepIndex >= this.steps.length - 1) {
        this.playbackState = 'finished';
        this.emitState();
      } else {
        this.scheduleNext();
      }
    }, interval);
  }

  private clearTimer(): void {
    if (this.timerId !== null) {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  private emitStep(): void {
    if (this.onStepChange) {
      this.onStepChange(this.getCurrentStep(), this.currentStepIndex);
    }
  }

  private emitState(): void {
    if (this.onStateChange) {
      this.onStateChange(this.playbackState);
    }
  }

  destroy(): void {
    this.clearTimer();
    this.onStepChange = undefined;
    this.onStateChange = undefined;
  }
}
