/**
 * Visual Workout Builder - TypeScript Type Definitions
 */

// ============================================================================
// Core Block Types
// ============================================================================

export type BlockType = 'steady' | 'warmup' | 'cooldown' | 'ramp' | 'freeride';

export interface WorkoutBlock {
  id: string;
  type: BlockType;
  duration: number;        // seconds
  power: number;           // 0.0-2.0 (fraction of FTP)
  powerEnd?: number;       // For ramps (warmup/cooldown)
  cadence?: number;        // RPM target
  cadenceEnd?: number;     // For ramp cadence
  slope?: number;          // Gradient percentage
  text?: string;           // Coaching notes/instructions
}

export interface RepeatGroup {
  id: string;
  type: 'repeat';
  repeat: number;          // Number of repetitions
  blocks: WorkoutBlock[];  // Child blocks
}

export type WorkoutItem = WorkoutBlock | RepeatGroup;

// ============================================================================
// Workout Structure
// ============================================================================

export interface WorkoutMeta {
  name: string;
  author: string;
  category: string;
  description: string;
  duration: number;        // Computed total in seconds
  tss: number;             // Training Stress Score
  intensityFactor: number; // IF (0.0-2.0)
  normalizedPower: number; // NP in watts
  sportType: 'bike' | 'run';
}

export interface Workout {
  meta: WorkoutMeta;
  blocks: WorkoutItem[];
}

// ============================================================================
// UI State Types
// ============================================================================

export type DragHandle = 'right' | 'top' | 'top-left' | 'top-right' | 'move' | 'left' | null;

export interface DragState {
  blockId: string;
  handle: DragHandle;
  startX: number;
  startY: number;
  startValue: number;      // Original duration or power
  startValue2?: number;    // For bidirectional drags (e.g., ramps)
}

export interface SelectionState {
  selectedIds: Set<string>;
  lastSelectedId: string | null;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface SnapConfig {
  enabled: boolean;
  duration: {
    increment: number;       // seconds (e.g., 15)
    thresholds: number[];    // Common durations to snap to
  };
  power: {
    increment: number;       // FTP fraction (e.g., 0.05 = 5%)
    zones: number[];         // Zone boundaries to snap to
  };
}

export interface DisplayConfig {
  maxPower: number;          // Maximum power to display (e.g., 2.0 = 200%)
  minDuration: number;       // Minimum block duration in seconds
  minPower: number;          // Minimum power (e.g., 0.20 = 20%)
  padding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

export interface ZoneConfig {
  name: string;
  color: string;
  min: number;               // Min power fraction
  max: number;               // Max power fraction
}

// ============================================================================
// Metrics Types
// ============================================================================

export interface WorkoutMetrics {
  duration: number;          // Total duration in seconds
  tss: number;               // Training Stress Score
  intensityFactor: number;   // IF
  normalizedPower: number;   // NP in watts
  kilojoules: number;        // Total work
}

export interface BlockMetrics {
  tss: number;
  duration: number;
  averagePower: number;      // Watts
}

// ============================================================================
// Event Types
// ============================================================================

export interface BlockUpdateEvent {
  blockId: string;
  updates: Partial<WorkoutBlock>;
}

export interface BlockMoveEvent {
  blockId: string;
  fromIndex: number;
  toIndex: number;
}

export interface RepeatCreateEvent {
  blockIds: string[];
  repeatCount: number;
}

// ============================================================================
// Store Types
// ============================================================================

export interface WorkoutBuilderState {
  // Data
  workout: Workout;
  ftp: number;
  
  // UI State
  selectedIds: Set<string>;
  dragState: DragState | null;
  hoveredBlockId: string | null;
  
  // Config
  snapConfig: SnapConfig;
  displayConfig: DisplayConfig;
  
  // Computed
  metrics: WorkoutMetrics;
}

export interface WorkoutBuilderActions {
  // Block Operations
  addBlock: (type: BlockType, insertIndex?: number) => void;
  updateBlock: (id: string, updates: Partial<WorkoutBlock>) => void;
  deleteBlock: (id: string) => void;
  deleteSelected: () => void;
  duplicateBlock: (id: string) => void;
  moveBlock: (id: string, newIndex: number) => void;
  
  // Repeat Group Operations
  createRepeatGroup: (blockIds: string[], repeatCount: number) => void;
  ungroupRepeat: (groupId: string) => void;
  updateRepeatCount: (groupId: string, count: number) => void;
  
  // Selection
  selectBlock: (id: string, additive?: boolean) => void;
  selectRange: (startId: string, endId: string) => void;
  clearSelection: () => void;
  selectAll: () => void;
  
  // Drag Operations
  setDragState: (state: DragState | null) => void;
  setHoveredBlock: (id: string | null) => void;
  
  // Config
  setFTP: (ftp: number) => void;
  setSnapConfig: (config: Partial<SnapConfig>) => void;
  toggleSnap: () => void;
  
  // Workout Operations
  setWorkout: (workout: Workout) => void;
  clearWorkout: () => void;
  loadFromZWO: (xml: string) => void;
  exportToZWO: () => string;
  
  // History
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export type WorkoutBuilderStore = WorkoutBuilderState & WorkoutBuilderActions;

// ============================================================================
// Component Props Types
// ============================================================================

export interface DraggableBlockProps {
  block: WorkoutBlock;
  x: number;
  width: number;
  chartHeight: number;
  pixelsPerSecond: number;
  pixelsPerPower: number;
  isSelected: boolean;
  isHovered: boolean;
  isInRepeatGroup?: boolean;
}

export interface RepeatGroupProps {
  group: RepeatGroup;
  x: number;
  chartHeight: number;
  pixelsPerSecond: number;
  pixelsPerPower: number;
  selectedIds: Set<string>;
  hoveredBlockId: string | null;
}

export interface WorkoutTimelineProps {
  width?: number;
  height?: number;
}

export interface ToolbarProps {
  onAddBlock: (type: BlockType) => void;
  onAddInterval: () => void;
  onDelete: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
}

export interface MetricsPanelProps {
  metrics: WorkoutMetrics;
  ftp: number;
}

export interface PropertyPanelProps {
  block: WorkoutBlock | null;
  onUpdate: (updates: Partial<WorkoutBlock>) => void;
  onDelete: () => void;
}

// ============================================================================
// Utility Types
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
