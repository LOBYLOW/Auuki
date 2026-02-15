/**
 * Visual Workout Builder - React Edition
 * 
 * A comprehensive drag-and-drop workout editor with:
 * - Visual SVG timeline
 * - Resize handles for duration and power
 * - Repeat group containers
 * - Live TSS/IF calculations
 * - Undo/Redo support
 * - Keyboard shortcuts
 * 
 * @example
 * ```tsx
 * import { WorkoutBuilder } from './workout-builder';
 * 
 * function App() {
 *   return (
 *     <WorkoutBuilder
 *       ftp={250}
 *       onWorkoutChange={(workout) => console.log(workout)}
 *       onExport={(workout) => downloadAsZwo(workout)}
 *     />
 *   );
 * }
 * ```
 */

// Main Component
export { default as WorkoutBuilder, WorkoutBuilderStandalone } from './WorkoutBuilder';

// Store and Hooks
export {
  useWorkoutBuilderStore,
  useWorkout,
  useBlocks,
  useMetrics,
  useFTP,
  useSelectedIds,
  useSelectedBlock,
  useDragState,
  useSnapConfig,
  useCanUndo,
  useCanRedo,
  useUndo,
  useRedo,
} from './store';

// Individual Components (for custom layouts)
export {
  DraggableBlock,
  RepeatGroupComponent,
  WorkoutTimeline,
  Toolbar,
  PropertyPanel,
  MetricsPanel,
} from './components';

// Types
export type {
  Workout,
  WorkoutBlock,
  RepeatGroup,
  WorkoutItem,
  WorkoutMeta,
  WorkoutMetrics,
  BlockType,
  DragState,
  DragHandle,
  SnapConfig,
  DisplayConfig,
  ZoneConfig,
} from './types';

// Utilities
export {
  createBlock,
  createRepeatGroup,
  cloneBlock,
  cloneRepeatGroup,
  calculateWorkoutMetrics,
  calculateBlockTSS,
  formatDuration,
  parseDuration,
  formatPower,
  applySnap,
  snapDuration,
  snapPower,
  getTotalDuration,
  flattenWorkoutBlocks,
} from './utils';

// Constants
export {
  POWER_ZONES,
  ZONE_COLORS,
  DEFAULT_SNAP_CONFIG,
  DEFAULT_DISPLAY_CONFIG,
  DEFAULT_BLOCK_VALUES,
  INTERVAL_PRESETS,
  SHORTCUTS,
  getZoneColor,
  getZoneClass,
  getZoneName,
} from './constants';
