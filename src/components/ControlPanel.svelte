<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { PlaybackState } from '../lib/animator';

  export let playbackState: PlaybackState = 'idle';
  export let currentStep: number = -1;
  export let totalSteps: number = 0;
  export let speed: number = 1;
  export let hasAlgorithm: boolean = false;
  export let currentDescription: string = '';
  export let compareMode: boolean = false;
  export let playbackState2: PlaybackState = 'idle';
  export let currentStep2: number = -1;
  export let totalSteps2: number = 0;
  export let currentDescription2: string = '';
  export let hasAlgorithm2: boolean = false;

  const dispatch = createEventDispatcher<{
    play: void;
    pause: void;
    stepForward: void;
    stepBackward: void;
    replay: void;
    stop: void;
    speedChange: number;
    jumpTo: number;
    play2: void;
    pause2: void;
    stepForward2: void;
    stepBackward2: void;
    replay2: void;
    stop2: void;
    jumpTo2: number;
  }>();

  function togglePlay() {
    if (playbackState === 'playing') {
      dispatch('pause');
    } else {
      dispatch('play');
    }
  }

  function togglePlay2() {
    if (playbackState2 === 'playing') {
      dispatch('pause2');
    } else {
      dispatch('play2');
    }
  }

  function onProgressInput(e: Event) {
    const target = e.target as HTMLInputElement;
    const val = parseInt(target.value, 10);
    dispatch('jumpTo', val);
  }

  function onProgressInput2(e: Event) {
    const target = e.target as HTMLInputElement;
    const val = parseInt(target.value, 10);
    dispatch('jumpTo2', val);
  }

  function onSpeedInput(e: Event) {
    const target = e.target as HTMLInputElement;
    const val = parseFloat(target.value);
    dispatch('speedChange', val);
  }

  $: progressPercent = totalSteps > 0 ? Math.max(0, (currentStep + 1) / totalSteps * 100) : 0;
  $: progressPercent2 = totalSteps2 > 0 ? Math.max(0, (currentStep2 + 1) / totalSteps2 * 100) : 0;
</script>

{#if compareMode}
  <div class="control-panel compare">
    <div class="compare-controls">
      <div class="control-half left">
        {#if hasAlgorithm}
          <div class="description-bar left">
            <span class="step-info">
              A: 步骤 <strong>{Math.max(0, currentStep + 1)}</strong> / {totalSteps}
            </span>
            <span class="description-text">{currentDescription || '—'}</span>
          </div>
        {/if}
        <div class="controls-row">
          <div class="buttons">
            <button class="ctrl-btn" title="重置" disabled={!hasAlgorithm} on:click={() => dispatch('replay')}>⏮</button>
            <button class="ctrl-btn" title="上一步" disabled={!hasAlgorithm || currentStep <= 0} on:click={() => dispatch('stepBackward')}>◀</button>
            <button class="ctrl-btn main left" title={playbackState === 'playing' ? '暂停' : '播放'} disabled={!hasAlgorithm} on:click={togglePlay}>
              {playbackState === 'playing' ? '⏸' : '▶'}
            </button>
            <button class="ctrl-btn" title="下一步" disabled={!hasAlgorithm || currentStep >= totalSteps - 1} on:click={() => dispatch('stepForward')}>▶</button>
            <button class="ctrl-btn" title="停止" disabled={!hasAlgorithm || playbackState === 'idle'} on:click={() => dispatch('stop')}>⏹</button>
          </div>
          <div class="progress-container">
            <div class="progress-track"><div class="progress-fill left" style="width: {progressPercent}%;"></div></div>
            <input type="range" min="-1" max={Math.max(0, totalSteps - 1)} value={currentStep} disabled={!hasAlgorithm || totalSteps === 0} on:input={onProgressInput} class="progress-slider" />
          </div>
        </div>
      </div>

      <div class="control-divider"></div>

      <div class="control-half right">
        {#if hasAlgorithm2}
          <div class="description-bar right">
            <span class="step-info">
              B: 步骤 <strong>{Math.max(0, currentStep2 + 1)}</strong> / {totalSteps2}
            </span>
            <span class="description-text">{currentDescription2 || '—'}</span>
          </div>
        {/if}
        <div class="controls-row">
          <div class="buttons">
            <button class="ctrl-btn" title="重置" disabled={!hasAlgorithm2} on:click={() => dispatch('replay2')}>⏮</button>
            <button class="ctrl-btn" title="上一步" disabled={!hasAlgorithm2 || currentStep2 <= 0} on:click={() => dispatch('stepBackward2')}>◀</button>
            <button class="ctrl-btn main right" title={playbackState2 === 'playing' ? '暂停' : '播放'} disabled={!hasAlgorithm2} on:click={togglePlay2}>
              {playbackState2 === 'playing' ? '⏸' : '▶'}
            </button>
            <button class="ctrl-btn" title="下一步" disabled={!hasAlgorithm2 || currentStep2 >= totalSteps2 - 1} on:click={() => dispatch('stepForward2')}>▶</button>
            <button class="ctrl-btn" title="停止" disabled={!hasAlgorithm2 || playbackState2 === 'idle'} on:click={() => dispatch('stop2')}>⏹</button>
          </div>
          <div class="progress-container">
            <div class="progress-track"><div class="progress-fill right" style="width: {progressPercent2}%;"></div></div>
            <input type="range" min="-1" max={Math.max(0, totalSteps2 - 1)} value={currentStep2} disabled={!hasAlgorithm2 || totalSteps2 === 0} on:input={onProgressInput2} class="progress-slider" />
          </div>
        </div>
      </div>
    </div>
    <div class="speed-row">
      <div class="speed-control">
        <span class="speed-label">速度</span>
        <input type="range" min="0.5" max="4" step="0.5" value={speed} on:input={onSpeedInput} class="speed-slider" />
        <span class="speed-value">{speed.toFixed(1)}x</span>
      </div>
    </div>
  </div>
{:else}
  <div class="control-panel">
    {#if hasAlgorithm}
      <div class="description-bar">
        <span class="step-info">
          步骤 <strong>{Math.max(0, currentStep + 1)}</strong> / {totalSteps}
        </span>
        <span class="description-text">{currentDescription || '—'}</span>
      </div>
    {/if}

    <div class="controls-row">
      <div class="buttons">
        <button class="ctrl-btn" title="重置" disabled={!hasAlgorithm} on:click={() => dispatch('replay')}>⏮</button>
        <button class="ctrl-btn" title="上一步" disabled={!hasAlgorithm || currentStep <= 0} on:click={() => dispatch('stepBackward')}>◀</button>
        <button class="ctrl-btn main" title={playbackState === 'playing' ? '暂停' : '播放'} disabled={!hasAlgorithm} on:click={togglePlay}>
          {playbackState === 'playing' ? '⏸' : '▶'}
        </button>
        <button class="ctrl-btn" title="下一步" disabled={!hasAlgorithm || currentStep >= totalSteps - 1} on:click={() => dispatch('stepForward')}>▶</button>
        <button class="ctrl-btn" title="停止" disabled={!hasAlgorithm || playbackState === 'idle'} on:click={() => dispatch('stop')}>⏹</button>
      </div>

      <div class="progress-container">
        <div class="progress-track"><div class="progress-fill" style="width: {progressPercent}%;"></div></div>
        <input type="range" min="-1" max={Math.max(0, totalSteps - 1)} value={currentStep} disabled={!hasAlgorithm || totalSteps === 0} on:input={onProgressInput} class="progress-slider" />
      </div>

      <div class="speed-control">
        <span class="speed-label">速度</span>
        <input type="range" min="0.5" max="4" step="0.5" value={speed} on:input={onSpeedInput} class="speed-slider" />
        <span class="speed-value">{speed.toFixed(1)}x</span>
      </div>
    </div>
  </div>
{/if}

<style>
  .control-panel {
    background: white;
    border-top: 1px solid #e5e7eb;
    padding: 12px 20px;
  }

  .control-panel.compare {
    padding: 8px 20px;
  }

  .compare-controls {
    display: flex;
    gap: 0;
    margin-bottom: 8px;
  }

  .control-half {
    flex: 1;
    min-width: 0;
  }

  .control-divider {
    width: 3px;
    background: linear-gradient(180deg, #6366f1, #8b5cf6);
    margin: 0 12px;
    flex-shrink: 0;
    border-radius: 2px;
  }

  .description-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
    padding: 6px 10px;
    background: #f8fafc;
    border-radius: 6px;
    border-left: 4px solid #6366f1;
    min-height: 30px;
  }

  .description-bar.left {
    border-left-color: #3b82f6;
  }

  .description-bar.right {
    border-left-color: #f97316;
  }

  .step-info {
    font-size: 12px;
    color: #6b7280;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .step-info strong {
    color: #6366f1;
    font-size: 14px;
    margin: 0 2px;
  }

  .description-bar.left .step-info strong {
    color: #3b82f6;
  }

  .description-bar.right .step-info strong {
    color: #f97316;
  }

  .description-text {
    font-size: 12px;
    color: #374151;
    line-height: 1.4;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .controls-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .speed-row {
    display: flex;
    justify-content: center;
    padding-top: 4px;
    border-top: 1px solid #f1f5f9;
  }

  .buttons {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  .ctrl-btn {
    width: 32px;
    height: 32px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    background: white;
    color: #374151;
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
  }

  .ctrl-btn:hover:not(:disabled) {
    background: #f3f4f6;
    border-color: #9ca3af;
  }

  .ctrl-btn:active:not(:disabled) {
    transform: scale(0.95);
  }

  .ctrl-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .ctrl-btn.main {
    width: 38px;
    height: 38px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    border: none;
    font-size: 14px;
    box-shadow: 0 2px 6px rgba(99, 102, 241, 0.3);
  }

  .ctrl-btn.main.left {
    background: linear-gradient(135deg, #3b82f6, #2563eb);
    box-shadow: 0 2px 6px rgba(59, 130, 246, 0.3);
  }

  .ctrl-btn.main.right {
    background: linear-gradient(135deg, #f97316, #ea580c);
    box-shadow: 0 2px 6px rgba(249, 115, 22, 0.3);
  }

  .ctrl-btn.main:hover:not(:disabled) {
    box-shadow: 0 3px 10px rgba(99, 102, 241, 0.4);
  }

  .progress-container {
    flex: 1;
    position: relative;
    height: 20px;
    display: flex;
    align-items: center;
  }

  .progress-track {
    position: absolute;
    left: 0;
    right: 0;
    height: 5px;
    background: #e5e7eb;
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #6366f1, #8b5cf6);
    border-radius: 3px;
    transition: width 0.2s ease;
  }

  .progress-fill.left {
    background: linear-gradient(90deg, #3b82f6, #2563eb);
  }

  .progress-fill.right {
    background: linear-gradient(90deg, #f97316, #ea580c);
  }

  .progress-slider {
    position: relative;
    width: 100%;
    height: 20px;
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    cursor: pointer;
    z-index: 2;
  }

  .progress-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: white;
    border: 3px solid #6366f1;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    cursor: pointer;
  }

  .control-half.left .progress-slider::-webkit-slider-thumb {
    border-color: #3b82f6;
  }

  .control-half.right .progress-slider::-webkit-slider-thumb {
    border-color: #f97316;
  }

  .progress-slider::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: white;
    border: 3px solid #6366f1;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    cursor: pointer;
  }

  .control-half.left .progress-slider::-moz-range-thumb {
    border-color: #3b82f6;
  }

  .control-half.right .progress-slider::-moz-range-thumb {
    border-color: #f97316;
  }

  .progress-slider:disabled {
    cursor: not-allowed;
  }

  .speed-control {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .speed-label {
    font-size: 11px;
    color: #6b7280;
  }

  .speed-slider {
    width: 80px;
    -webkit-appearance: none;
    appearance: none;
    height: 4px;
    background: #e5e7eb;
    border-radius: 2px;
    cursor: pointer;
  }

  .speed-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #6366f1;
    cursor: pointer;
    border: 2px solid white;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  .speed-slider::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #6366f1;
    cursor: pointer;
    border: 2px solid white;
  }

  .speed-value {
    font-size: 12px;
    font-weight: 600;
    color: #6366f1;
    min-width: 36px;
    text-align: right;
  }
</style>
