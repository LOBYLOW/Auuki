# Visual Drag-and-Drop Workout Builder

## Architectural Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                       WorkoutBuilder Container                       │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     Toolbar/Controls                         │   │
│  │  [Add Block] [Add Repeat] [Undo] [Redo] [Export] [TSS: 85]  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                  Visual Timeline (SVG Canvas)                │   │
│  │  ┌─────┐┌─────────┐┌─────────────┐┌─────┐┌─────┐            │   │
│  │  │     ││    x4   ││             ││     ││     │            │   │
│  │  │ 50% ││  ┌──┬──┐││    80%      ││120% ││ 50% │← Drag Top  │   │
│  │  │     ││  │  │  │││             ││     ││     │  for FTP   │   │
│  │  └─────┘│  └──┴──┘│└─────────────┘└─────┘└─────┘            │   │
│  │    5min └─────────┘      10min     2min   2min              │   │
│  │         ↑ Repeat                     ↑                       │   │
│  │         Container                    └─ Drag Right Edge     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Block Properties Panel                    │   │
│  │  Duration: [05:00]  Power: [80%]  Type: [SteadyState ▼]     │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Structure (Enhanced)

```typescript
// Core Block Types
interface WorkoutBlock {
  id: string;
  type: 'steady' | 'warmup' | 'cooldown' | 'ramp' | 'freeride';
  duration: number;        // seconds
  power: number;           // 0.0-2.0 (fraction of FTP)
  powerEnd?: number;       // For ramps (warmup/cooldown)
  cadence?: number;
  slope?: number;
  text?: string;           // Coaching notes (displayed during workout)
}

// Repeat Container for Interval Sets
interface RepeatGroup {
  id: string;
  type: 'repeat';
  repeat: number;          // Number of repetitions
  blocks: WorkoutBlock[];  // Child blocks
}

// Top-level workout
interface Workout {
  meta: {
    name: string;
    author: string;
    category: string;
    description: string;
    duration: number;      // Computed total
    tss: number;           // Training Stress Score
    intensityFactor: number;  // IF
  };
  blocks: (WorkoutBlock | RepeatGroup)[];
}

// UI State for drag interactions
interface DragState {
  blockId: string | null;
  handle: 'right' | 'top' | 'move' | null;
  startX: number;
  startY: number;
  startValue: number;      // Original duration or power
}
```

---

## Component Implementation

### Recommended Library: **React + Zustand + SVG**

**Why this stack:**
- **React**: Declarative UI, excellent for complex state
- **Zustand**: Lightweight state management with undo/redo
- **Native SVG**: Full control over rendering, no library overhead
- **Framer Motion** (optional): Smooth animations for feedback

Alternative: **d3.js** if you need more complex visualizations or data binding.

---

## Core Components

### 1. WorkoutBuilderStore (Zustand)

```typescript
// src/stores/workoutBuilderStore.ts
import { create } from 'zustand';
import { temporal } from 'zustand/middleware';

interface WorkoutBuilderState {
  workout: Workout;
  selectedBlockId: string | null;
  dragState: DragState | null;
  ftp: number;
  
  // Actions
  addBlock: (type: WorkoutBlock['type']) => void;
  updateBlock: (id: string, updates: Partial<WorkoutBlock>) => void;
  deleteBlock: (id: string) => void;
  moveBlock: (id: string, newIndex: number) => void;
  createRepeatGroup: (blockIds: string[], repeatCount: number) => void;
  ungroupRepeat: (groupId: string) => void;
  setDragState: (state: DragState | null) => void;
  selectBlock: (id: string | null) => void;
}

export const useWorkoutBuilder = create<WorkoutBuilderState>()(
  temporal(
    (set, get) => ({
      workout: {
        meta: { name: 'New Workout', author: 'User', category: '', description: '', duration: 0, tss: 0, intensityFactor: 0 },
        blocks: []
      },
      selectedBlockId: null,
      dragState: null,
      ftp: 200,

      addBlock: (type) => {
        const newBlock: WorkoutBlock = {
          id: crypto.randomUUID(),
          type,
          duration: 300, // 5 min default
          power: type === 'warmup' ? 0.5 : type === 'cooldown' ? 0.5 : 0.75,
          powerEnd: type === 'warmup' ? 0.75 : type === 'cooldown' ? 0.35 : undefined,
        };
        set((state) => ({
          workout: {
            ...state.workout,
            blocks: [...state.workout.blocks, newBlock]
          }
        }));
        get().recalculateMetrics();
      },

      updateBlock: (id, updates) => {
        set((state) => ({
          workout: {
            ...state.workout,
            blocks: state.workout.blocks.map(b => 
              b.id === id ? { ...b, ...updates } : b
            )
          }
        }));
        get().recalculateMetrics();
      },

      createRepeatGroup: (blockIds, repeatCount) => {
        set((state) => {
          const blocks = state.workout.blocks;
          const selectedBlocks = blocks.filter(b => blockIds.includes(b.id));
          const remainingBlocks = blocks.filter(b => !blockIds.includes(b.id));
          
          const repeatGroup: RepeatGroup = {
            id: crypto.randomUUID(),
            type: 'repeat',
            repeat: repeatCount,
            blocks: selectedBlocks as WorkoutBlock[]
          };

          // Insert repeat group at position of first selected block
          const insertIndex = blocks.findIndex(b => b.id === blockIds[0]);
          remainingBlocks.splice(insertIndex, 0, repeatGroup);

          return {
            workout: { ...state.workout, blocks: remainingBlocks }
          };
        });
        get().recalculateMetrics();
      },

      recalculateMetrics: () => {
        const { workout, ftp } = get();
        const { duration, tss, intensityFactor } = calculateWorkoutMetrics(workout, ftp);
        set((state) => ({
          workout: {
            ...state.workout,
            meta: { ...state.workout.meta, duration, tss, intensityFactor }
          }
        }));
      },

      // ... other actions
    }),
    { limit: 50 } // Undo/redo history limit
  )
);
```

### 2. DraggableBlock Component (SVG)

```tsx
// src/components/DraggableBlock.tsx
import React, { useRef } from 'react';
import { useWorkoutBuilder } from '../stores/workoutBuilderStore';

interface DraggableBlockProps {
  block: WorkoutBlock;
  x: number;
  width: number;
  maxHeight: number;
  pixelsPerSecond: number;
  pixelsPerPercent: number;
}

const HANDLE_SIZE = 8;
const SNAP_DURATION = 15;    // seconds
const SNAP_POWER = 0.05;     // 5% FTP

export function DraggableBlock({ 
  block, 
  x, 
  width, 
  maxHeight, 
  pixelsPerSecond,
  pixelsPerPercent 
}: DraggableBlockProps) {
  const { updateBlock, selectBlock, selectedBlockId, setDragState, dragState } = useWorkoutBuilder();
  const blockRef = useRef<SVGGElement>(null);

  const height = block.power * maxHeight;
  const y = maxHeight - height;
  const isSelected = selectedBlockId === block.id;
  const zoneClass = getZoneClass(block.power);

  // Snapping helper
  const snapValue = (value: number, snap: number) => Math.round(value / snap) * snap;

  // Handle pointer events for dragging
  const handlePointerDown = (e: React.PointerEvent, handle: 'right' | 'top' | 'move') => {
    e.preventDefault();
    e.stopPropagation();
    
    const startValue = handle === 'right' ? block.duration : block.power;
    
    setDragState({
      blockId: block.id,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startValue
    });

    selectBlock(block.id);
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!dragState || dragState.blockId !== block.id) return;

    const deltaX = e.clientX - dragState.startX;
    const deltaY = e.clientY - dragState.startY;

    if (dragState.handle === 'right') {
      // Drag right edge: modify duration
      const deltaDuration = deltaX / pixelsPerSecond;
      let newDuration = Math.max(15, dragState.startValue + deltaDuration);
      newDuration = snapValue(newDuration, SNAP_DURATION);
      updateBlock(block.id, { duration: newDuration });
    } 
    else if (dragState.handle === 'top') {
      // Drag top edge: modify power (inverted Y axis)
      const deltaPower = -deltaY / pixelsPerPercent / 100;
      let newPower = Math.max(0.2, Math.min(2.0, dragState.startValue + deltaPower));
      newPower = snapValue(newPower, SNAP_POWER);
      updateBlock(block.id, { power: newPower });
    }
  };

  const handlePointerUp = () => {
    setDragState(null);
    // Remove global listeners
  };

  // Register global listeners when dragging
  React.useEffect(() => {
    if (dragState?.blockId === block.id) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      return () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };
    }
  }, [dragState]);

  return (
    <g ref={blockRef} className="workout-block" data-block-id={block.id}>
      {/* Main block rectangle */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        className={`block-fill ${zoneClass} ${isSelected ? 'selected' : ''}`}
        onPointerDown={(e) => handlePointerDown(e, 'move')}
        style={{ cursor: 'grab' }}
      />

      {/* Right edge handle (duration) */}
      <rect
        x={x + width - HANDLE_SIZE / 2}
        y={y}
        width={HANDLE_SIZE}
        height={height}
        className="handle handle-right"
        onPointerDown={(e) => handlePointerDown(e, 'right')}
        style={{ cursor: 'ew-resize', fill: 'rgba(255,255,255,0.3)' }}
      />

      {/* Top edge handle (power) */}
      <rect
        x={x}
        y={y - HANDLE_SIZE / 2}
        width={width}
        height={HANDLE_SIZE}
        className="handle handle-top"
        onPointerDown={(e) => handlePointerDown(e, 'top')}
        style={{ cursor: 'ns-resize', fill: 'rgba(255,255,255,0.3)' }}
      />

      {/* Labels */}
      <text x={x + width / 2} y={y + height / 2} className="block-label">
        {Math.round(block.power * 100)}%
      </text>
      <text x={x + width / 2} y={maxHeight + 15} className="duration-label">
        {formatDuration(block.duration)}
      </text>

      {/* Selection outline */}
      {isSelected && (
        <rect
          x={x - 1}
          y={y - 1}
          width={width + 2}
          height={height + 2}
          fill="none"
          stroke="#00bfff"
          strokeWidth={2}
          pointerEvents="none"
        />
      )}
    </g>
  );
}

function getZoneClass(power: number): string {
  if (power < 0.55) return 'zone-1';
  if (power < 0.75) return 'zone-2';
  if (power < 0.90) return 'zone-3';
  if (power < 1.05) return 'zone-4';
  if (power < 1.20) return 'zone-5';
  return 'zone-6';
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
```

### 3. RepeatGroupComponent

```tsx
// src/components/RepeatGroup.tsx
import React from 'react';
import { DraggableBlock } from './DraggableBlock';
import { RepeatGroup as RepeatGroupType } from '../types';

interface RepeatGroupProps {
  group: RepeatGroupType;
  x: number;
  maxHeight: number;
  pixelsPerSecond: number;
  pixelsPerPercent: number;
}

export function RepeatGroupComponent({ 
  group, 
  x, 
  maxHeight,
  pixelsPerSecond,
  pixelsPerPercent 
}: RepeatGroupProps) {
  // Calculate dimensions of inner blocks
  let currentX = x;
  const innerWidth = group.blocks.reduce((sum, b) => {
    return sum + (b.duration * pixelsPerSecond);
  }, 0);

  return (
    <g className="repeat-group">
      {/* Bracket/container visual */}
      <rect
        x={x - 5}
        y={0}
        width={innerWidth + 10}
        height={maxHeight + 30}
        fill="none"
        stroke="#888"
        strokeWidth={2}
        strokeDasharray="5,5"
        rx={5}
      />
      
      {/* Repeat badge */}
      <g transform={`translate(${x + innerWidth / 2 - 20}, ${maxHeight + 5})`}>
        <rect width={40} height={20} rx={10} fill="#555" />
        <text x={20} y={14} textAnchor="middle" fill="white" fontSize={12}>
          ×{group.repeat}
        </text>
      </g>

      {/* Render child blocks */}
      {group.blocks.map((block, i) => {
        const blockWidth = block.duration * pixelsPerSecond;
        const el = (
          <DraggableBlock
            key={block.id}
            block={block}
            x={currentX}
            width={blockWidth}
            maxHeight={maxHeight}
            pixelsPerSecond={pixelsPerSecond}
            pixelsPerPercent={pixelsPerPercent}
          />
        );
        currentX += blockWidth;
        return el;
      })}
    </g>
  );
}
```

### 4. Visual Timeline Container

```tsx
// src/components/WorkoutTimeline.tsx
import React, { useRef, useEffect, useState } from 'react';
import { useWorkoutBuilder } from '../stores/workoutBuilderStore';
import { DraggableBlock } from './DraggableBlock';
import { RepeatGroupComponent } from './RepeatGroup';

const PADDING = { top: 40, right: 20, bottom: 60, left: 50 };
const MAX_POWER = 2.0; // 200% FTP as max display

export function WorkoutTimeline() {
  const { workout, ftp } = useWorkoutBuilder();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });

  // Responsive sizing
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Calculate total duration for scaling
  const totalDuration = calculateTotalDuration(workout.blocks);
  
  // Scale factors
  const chartWidth = dimensions.width - PADDING.left - PADDING.right;
  const chartHeight = dimensions.height - PADDING.top - PADDING.bottom;
  const pixelsPerSecond = chartWidth / Math.max(totalDuration, 300);
  const pixelsPerPercent = chartHeight / (MAX_POWER * 100);

  // Render blocks
  let currentX = PADDING.left;
  const renderBlocks = workout.blocks.map((item) => {
    if (item.type === 'repeat') {
      const group = item as RepeatGroup;
      const groupDuration = group.blocks.reduce((sum, b) => sum + b.duration, 0);
      const groupWidth = groupDuration * pixelsPerSecond;
      const el = (
        <RepeatGroupComponent
          key={group.id}
          group={group}
          x={currentX}
          maxHeight={chartHeight}
          pixelsPerSecond={pixelsPerSecond}
          pixelsPerPercent={pixelsPerPercent}
        />
      );
      currentX += groupWidth;
      return el;
    } else {
      const block = item as WorkoutBlock;
      const blockWidth = block.duration * pixelsPerSecond;
      const el = (
        <DraggableBlock
          key={block.id}
          block={block}
          x={currentX}
          width={blockWidth}
          maxHeight={chartHeight}
          pixelsPerSecond={pixelsPerSecond}
          pixelsPerPercent={pixelsPerPercent}
        />
      );
      currentX += blockWidth;
      return el;
    }
  });

  return (
    <div ref={containerRef} className="workout-timeline-container">
      <svg 
        width={dimensions.width} 
        height={dimensions.height}
        className="workout-timeline-svg"
      >
        {/* Y-axis grid lines */}
        {[0.5, 0.75, 1.0, 1.25, 1.5].map(power => {
          const y = PADDING.top + chartHeight - (power * chartHeight / MAX_POWER);
          return (
            <g key={power}>
              <line
                x1={PADDING.left}
                y1={y}
                x2={dimensions.width - PADDING.right}
                y2={y}
                stroke="#333"
                strokeDasharray="3,3"
              />
              <text x={PADDING.left - 5} y={y + 4} textAnchor="end" fill="#888" fontSize={10}>
                {Math.round(power * 100)}%
              </text>
            </g>
          );
        })}

        {/* FTP reference line */}
        <line
          x1={PADDING.left}
          y1={PADDING.top + chartHeight - (chartHeight / MAX_POWER)}
          x2={dimensions.width - PADDING.right}
          y2={PADDING.top + chartHeight - (chartHeight / MAX_POWER)}
          stroke="#fff"
          strokeWidth={1}
          strokeDasharray="5,5"
          opacity={0.5}
        />
        <text 
          x={dimensions.width - PADDING.right + 5} 
          y={PADDING.top + chartHeight - (chartHeight / MAX_POWER) + 4} 
          fill="#fff" 
          fontSize={10}
        >
          FTP
        </text>

        {/* Blocks container with offset */}
        <g transform={`translate(0, ${PADDING.top})`}>
          {renderBlocks}
        </g>

        {/* Time axis */}
        <g transform={`translate(0, ${PADDING.top + chartHeight})`}>
          <line
            x1={PADDING.left}
            y1={0}
            x2={dimensions.width - PADDING.right}
            y2={0}
            stroke="#555"
          />
          {/* Time markers would be rendered here */}
        </g>
      </svg>
    </div>
  );
}
```

---

## Live TSS/IF Calculations

```typescript
// src/utils/workoutMetrics.ts

/**
 * Training Stress Score (TSS) Formula:
 * TSS = (s × NP × IF) / (FTP × 3600) × 100
 * 
 * Where:
 * - s = duration in seconds
 * - NP = Normalized Power (for steady blocks, this equals target power)
 * - IF = Intensity Factor = NP / FTP
 * - FTP = Functional Threshold Power in watts
 * 
 * Simplified for workout blocks:
 * TSS = Σ (duration_i × power_i² × FTP) / (FTP × 3600) × 100
 * TSS = Σ (duration_i × power_i²) / 3600 × 100
 * TSS = Σ (duration_i × power_i²) / 36
 */

interface WorkoutMetrics {
  duration: number;
  tss: number;
  intensityFactor: number;
  normalizedPower: number;
}

export function calculateWorkoutMetrics(
  workout: Workout, 
  ftp: number
): WorkoutMetrics {
  let totalDuration = 0;
  let weightedPowerSum = 0;  // For NP calculation
  let tssSum = 0;

  const processBlock = (block: WorkoutBlock, multiplier: number = 1) => {
    const duration = block.duration * multiplier;
    const power = block.power;
    
    if (block.type === 'warmup' || block.type === 'cooldown') {
      // For ramps, use average power
      const avgPower = (block.power + (block.powerEnd || block.power)) / 2;
      totalDuration += duration;
      weightedPowerSum += avgPower * avgPower * duration;
      tssSum += (duration * avgPower * avgPower) / 36;
    } else if (block.type === 'freeride') {
      // Assume 50% FTP for freeride estimation
      const estPower = 0.5;
      totalDuration += duration;
      weightedPowerSum += estPower * estPower * duration;
      tssSum += (duration * estPower * estPower) / 36;
    } else {
      // SteadyState
      totalDuration += duration;
      weightedPowerSum += power * power * duration;
      tssSum += (duration * power * power) / 36;
    }
  };

  for (const item of workout.blocks) {
    if (item.type === 'repeat') {
      const group = item as RepeatGroup;
      for (const block of group.blocks) {
        processBlock(block, group.repeat);
      }
    } else {
      processBlock(item as WorkoutBlock, 1);
    }
  }

  // Calculate Normalized Power (root mean square approach simplified)
  const normalizedPower = totalDuration > 0 
    ? Math.sqrt(weightedPowerSum / totalDuration) * ftp 
    : 0;

  // Intensity Factor = NP / FTP
  const intensityFactor = normalizedPower / ftp;

  // Final TSS rounded
  const tss = Math.round(tssSum);

  return {
    duration: totalDuration,
    tss,
    intensityFactor: Math.round(intensityFactor * 100) / 100,
    normalizedPower: Math.round(normalizedPower)
  };
}

/**
 * Calculate metrics in real-time during drag
 * This should be debounced or throttled for performance
 */
export function calculateBlockTSS(
  duration: number, 
  power: number
): number {
  return (duration * power * power) / 36;
}
```

---

## Snapping Mechanism

```typescript
// src/utils/snapping.ts

interface SnapConfig {
  duration: {
    enabled: boolean;
    increment: number;  // seconds (e.g., 15)
    thresholds: number[]; // Common durations to snap to
  };
  power: {
    enabled: boolean;
    increment: number;  // FTP fraction (e.g., 0.05 = 5%)
    zones: number[];    // Zone boundaries to snap to
  };
}

const DEFAULT_SNAP_CONFIG: SnapConfig = {
  duration: {
    enabled: true,
    increment: 15,
    thresholds: [30, 60, 90, 120, 180, 300, 600, 900, 1200, 1800]
  },
  power: {
    enabled: true,
    increment: 0.05,
    zones: [0.55, 0.75, 0.90, 1.05, 1.20, 1.50]  // Zone boundaries
  }
};

export function snapDuration(
  value: number, 
  config: SnapConfig = DEFAULT_SNAP_CONFIG
): number {
  if (!config.duration.enabled) return value;

  // First, try snapping to common thresholds (within 5 seconds)
  for (const threshold of config.duration.thresholds) {
    if (Math.abs(value - threshold) <= 5) {
      return threshold;
    }
  }

  // Otherwise, snap to increment
  return Math.round(value / config.duration.increment) * config.duration.increment;
}

export function snapPower(
  value: number, 
  config: SnapConfig = DEFAULT_SNAP_CONFIG
): number {
  if (!config.power.enabled) return value;

  // Try snapping to zone boundaries (within 2%)
  for (const zone of config.power.zones) {
    if (Math.abs(value - zone) <= 0.02) {
      return zone;
    }
  }

  // Otherwise, snap to increment
  return Math.round(value / config.power.increment) * config.power.increment;
}

/**
 * Calculate snapped value with visual feedback
 */
export function calculateSnap(
  value: number,
  type: 'duration' | 'power',
  config: SnapConfig = DEFAULT_SNAP_CONFIG
): { value: number; snapped: boolean; snapTarget: number | null } {
  const snapFn = type === 'duration' ? snapDuration : snapPower;
  const snappedValue = snapFn(value, config);
  const didSnap = snappedValue !== value;

  return {
    value: snappedValue,
    snapped: didSnap,
    snapTarget: didSnap ? snappedValue : null
  };
}
```

---

## CSS Styles

```css
/* src/css/workout-builder.css */

.workout-timeline-container {
  width: 100%;
  height: 400px;
  background: var(--bg-dark, #1a1a2e);
  border-radius: 8px;
  overflow: hidden;
}

.workout-timeline-svg {
  display: block;
}

/* Block fills by zone */
.block-fill {
  transition: fill 0.15s ease;
}

.block-fill.zone-1 { fill: #808080; }  /* Gray - Recovery */
.block-fill.zone-2 { fill: #0088ff; }  /* Blue - Endurance */
.block-fill.zone-3 { fill: #00cc44; }  /* Green - Tempo */
.block-fill.zone-4 { fill: #ffcc00; }  /* Yellow - Threshold */
.block-fill.zone-5 { fill: #ff6600; }  /* Orange - VO2max */
.block-fill.zone-6 { fill: #ff0000; }  /* Red - Anaerobic */

.block-fill.selected {
  filter: brightness(1.2);
}

/* Handles */
.handle {
  fill: transparent;
  transition: fill 0.1s ease;
}

.handle:hover {
  fill: rgba(255, 255, 255, 0.4);
}

.handle-right {
  cursor: ew-resize;
}

.handle-top {
  cursor: ns-resize;
}

/* Labels */
.block-label {
  font-size: 12px;
  fill: white;
  text-anchor: middle;
  dominant-baseline: middle;
  pointer-events: none;
  font-weight: bold;
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);
}

.duration-label {
  font-size: 10px;
  fill: #888;
  text-anchor: middle;
  pointer-events: none;
}

/* Repeat group */
.repeat-group rect {
  pointer-events: none;
}

/* Dragging state */
.workout-block.dragging .block-fill {
  opacity: 0.8;
}

/* Snap indicator */
.snap-line {
  stroke: #00bfff;
  stroke-width: 2;
  stroke-dasharray: 4,4;
  opacity: 0.7;
}
```

---

## Integration with Existing Codebase

To integrate with your existing vanilla JS architecture:

### Option 1: Standalone React Island

```javascript
// src/views/workout-builder-mount.js
import { xf } from '../functions.js';

export function mountWorkoutBuilder(container) {
  // Dynamically load React components
  import('./workout-builder/index.jsx').then(({ WorkoutBuilder }) => {
    const root = ReactDOM.createRoot(container);
    
    // Bridge to existing pub/sub system
    const handleWorkoutChange = (workout) => {
      xf.dispatch('workout:update', workout);
    };

    root.render(
      <WorkoutBuilder 
        onWorkoutChange={handleWorkoutChange}
        initialWorkout={xf.get('workout')}
      />
    );
  });
}
```

### Option 2: Web Component Wrapper

```javascript
// src/views/workout-builder.js
import { xf } from '../functions.js';

class WorkoutBuilderElement extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    // Initialize with existing workout data
    const workout = xf.get('workout');
    this.render(workout);
    
    // Subscribe to workout changes
    xf.sub('db:workout', this.onWorkoutUpdate.bind(this));
  }

  // ... implementation
}

customElements.define('workout-builder', WorkoutBuilderElement);
```

---

## Keyboard Shortcuts

```typescript
// src/hooks/useWorkoutKeyboard.ts
import { useEffect } from 'react';
import { useWorkoutBuilder } from '../stores/workoutBuilderStore';

export function useWorkoutKeyboard() {
  const { 
    selectedBlockId, 
    updateBlock, 
    deleteBlock,
    undo,
    redo 
  } = useWorkoutBuilder();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo/Redo
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }

      if (!selectedBlockId) return;

      // Delete selected block
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteBlock(selectedBlockId);
      }

      // Arrow keys for fine adjustment
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const increment = e.shiftKey ? 60 : 15;
        updateBlock(selectedBlockId, (b) => ({ 
          duration: b.duration + increment 
        }));
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const increment = e.shiftKey ? 60 : 15;
        updateBlock(selectedBlockId, (b) => ({ 
          duration: Math.max(15, b.duration - increment) 
        }));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const increment = e.shiftKey ? 0.10 : 0.05;
        updateBlock(selectedBlockId, (b) => ({ 
          power: Math.min(2.0, b.power + increment) 
        }));
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const increment = e.shiftKey ? 0.10 : 0.05;
        updateBlock(selectedBlockId, (b) => ({ 
          power: Math.max(0.2, b.power - increment) 
        }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBlockId]);
}
```

---

## Summary & Recommendations

| Aspect | Recommendation |
|--------|----------------|
| **Framework** | React + TypeScript for complex state management |
| **Drag Library** | Native pointer events (no library needed for basic dragging) |
| **Animation** | Framer Motion for polish (optional) |
| **State** | Zustand with `temporal` middleware for undo/redo |
| **Rendering** | SVG for precise control and scalability |
| **Snapping** | 15-second duration, 5% FTP power increments |
| **Performance** | Debounce metric calculations during drag |

### Alternative Libraries

1. **react-dnd**: Great for drag-and-drop reordering, overkill for resize handles
2. **d3.js**: Powerful for data visualization, but heavier footprint  
3. **framer-motion**: Excellent for animations, works well with drag gestures
4. **@use-gesture/react**: Low-level gesture library, very powerful

For your use case, **native SVG + pointer events** provides the best control with minimal overhead. Add Framer Motion later if you need smooth animations.

---

## Implemented Features (February 2026)

The following features have been fully implemented in the React workout builder:

### Core Functionality
- **Visual Drag-and-Drop Editing**: Drag block tops to adjust power, right edges to adjust duration
- **Ramp Creation**: Drag from block edges to create warmup/cooldown ramps
- **Block Selection**: Click to select, multi-select with Ctrl/Shift
- **Undo/Redo**: Full history with Zustand `temporal` middleware (Ctrl+Z / Ctrl+Shift+Z)
- **Keyboard Shortcuts**: Arrow keys for fine adjustments, Delete to remove

### Property Panel (Right Sidebar)
The property panel displays as a 220px sidebar on the right with:
- **Type Selector**: Change block type (Steady, Warmup, Cooldown, Ramp, Free Ride)
- **Duration Input**: Editable with `mm:ss` format parsing
- **Power Input**: Percentage of FTP with absolute watts display
- **End Power**: For ramp blocks only
- **Cadence**: Optional RPM target
- **Coaching Notes**: Multi-line textarea (250 char limit) with text wrapping
  - Event propagation blocked to prevent spacebar triggering workout start/stop
  - Shift+Enter for newlines, Enter to save and blur

### Metrics Panel
Located at the bottom with real-time calculations:
- **Total Duration**: Sum of all blocks
- **TSS** (Training Stress Score): Based on IF² × hours × 100
- **IF** (Intensity Factor): Normalized power / FTP
- **Editable FTP**: Click to edit inline, affects all calculations

### Zone Distribution Visualization
Visual bar showing time spent in each power zone:
- **Zone 1** (Recovery): < 55% FTP - Gray
- **Zone 2** (Endurance): 55-75% FTP - Blue
- **Zone 3** (Tempo): 75-90% FTP - Green
- **Zone 4** (Threshold): 90-105% FTP - Yellow
- **Zone 5** (VO2max): 105-120% FTP - Orange
- **Zone 6** (Anaerobic): > 120% FTP - Red

### Interval Presets
10 coach-designed interval templates available via dropdown:
1. **30/30s**: Classic VO2max intervals (8×)
2. **40/20s**: High-intensity/short recovery (8×)
3. **Tabata**: 20s max / 10s rest (8×)
4. **Sweet Spot 2×8**: 88% FTP with rest (2×)
5. **Over-Unders**: Threshold variation (4×)
6. **Microbursts 15/15**: Short power bursts (12×)
7. **Sweet Spot 10min**: Single 10-minute block
8. **Pyramid**: Progressive intervals
9. **Billat 30/30**: Classic VO2max protocol
10. **Tempo Blocks**: Extended tempo efforts (3×)

### Coaching Text Integration
Coaching notes flow through the entire system:
1. **Builder**: Enter notes in PropertyPanel textarea
2. **Export**: Saved as `<textevent>` in ZWO files
3. **Database**: Stored in interval structure with `text` field
4. **Playback**: Dispatched via `watch:coachingText` event
5. **Display**: `<coaching-text>` web component shows overlay during workout
   - Position: Fixed bottom-center
   - Auto-hides after 10 seconds with fade animation
   - Styled with glowing blue border

### Integration with Existing App
- Mounted in existing HTML via `#react-workout-builder` div
- Bridge via `workout-builder-mount.tsx`:
  - Converts React workout structure to app interval format
  - Exports to ZWO with `<textevent>` elements
  - Publishes workout via `xf.dispatch('workout:set', ...)`
  - Saves to library via `xf.dispatch('ui:workout:save', ...)`
