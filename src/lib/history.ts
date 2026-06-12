import type { Graph } from './graph';

const MAX_HISTORY_SIZE = 30;

export class HistoryManager {
  private history: Graph[] = [];
  private currentIndex: number = -1;
  private maxSize: number;

  constructor(maxSize: number = MAX_HISTORY_SIZE) {
    this.maxSize = maxSize;
  }

  pushState(graph: Graph): void {
    const snapshot = graph.clone();

    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    this.history.push(snapshot);

    if (this.history.length > this.maxSize) {
      this.history.shift();
    }

    this.currentIndex = this.history.length - 1;
  }

  undo(): Graph | null {
    if (this.currentIndex <= 0) {
      return null;
    }
    this.currentIndex--;
    return this.history[this.currentIndex].clone();
  }

  redo(): Graph | null {
    if (this.currentIndex >= this.history.length - 1) {
      return null;
    }
    this.currentIndex++;
    return this.history[this.currentIndex].clone();
  }

  canUndo(): boolean {
    return this.currentIndex > 0;
  }

  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  reset(initialGraph: Graph): void {
    this.history = [initialGraph.clone()];
    this.currentIndex = 0;
  }

  clear(): void {
    this.history = [];
    this.currentIndex = -1;
  }

  getCurrentIndex(): number {
    return this.currentIndex;
  }

  getHistorySize(): number {
    return this.history.length;
  }
}
