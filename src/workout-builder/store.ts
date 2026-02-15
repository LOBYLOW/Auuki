/**
 * Visual Workout Builder - Zustand Store
 * 
 * Central state management with undo/redo support using temporal middleware.
 */

import { create } from 'zustand';
import { temporal } from 'zundo';
import { immer } from 'zustand/middleware/immer';
import { useStore } from 'zustand';
import type {
  Workout,
  WorkoutItem,
  WorkoutBlock,
  RepeatGroup,
  WorkoutMetrics,
  DragState,
  SnapConfig,
  DisplayConfig,
  BlockType,
} from './types';
import {
  createBlock,
  createRepeatGroup,
  cloneBlock,
  cloneRepeatGroup,
  isRepeatGroup,
  isWorkoutBlock,
  findBlockById,
  findItemById,
  calculateWorkoutMetrics,
  deepClone,
  moveItem,
  generateId,
  getTotalDuration,
} from './utils';
import {
  DEFAULT_SNAP_CONFIG,
  DEFAULT_DISPLAY_CONFIG,
  HISTORY,
} from './constants';

// ============================================================================
// Default State
// ============================================================================

const defaultWorkout: Workout = {
  meta: {
    name: 'New Workout',
    author: '',
    category: '',
    description: '',
    duration: 0,
    tss: 0,
    intensityFactor: 0,
    normalizedPower: 0,
    sportType: 'bike',
  },
  blocks: [],
};

const defaultMetrics: WorkoutMetrics = {
  duration: 0,
  tss: 0,
  intensityFactor: 0,
  normalizedPower: 0,
  kilojoules: 0,
};

// ============================================================================
// Store Interface
// ============================================================================

interface WorkoutBuilderState {
  // Core Data
  workout: Workout;
  ftp: number;
  targetDuration: number; // Total ride duration in seconds (X-axis limit)
  durationMode: 'fixed' | 'auto'; // 'fixed': blocks respect limit, 'auto': duration auto-fits to content

  // UI State
  selectedIds: string[];
  dragState: DragState | null;
  hoveredBlockId: string | null;

  // Configuration
  snapConfig: SnapConfig;
  displayConfig: DisplayConfig;

  // Computed (updated via recalculate)
  metrics: WorkoutMetrics;
}

interface WorkoutBuilderActions {
  // Block Operations
  addBlock: (type: BlockType, insertIndex?: number) => void;
  addIntervalSet: (blocks: Array<{ duration: number; power: number }>, repeatCount: number) => void;
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

  // Configuration
  setFTP: (ftp: number) => void;
  setTargetDuration: (duration: number) => void;
  setDurationMode: (mode: 'fixed' | 'auto') => void;
  toggleDurationMode: () => void;
  setSnapConfig: (config: Partial<SnapConfig>) => void;
  toggleSnap: () => void;

  // Workout Operations
  setWorkout: (workout: Workout) => void;
  setWorkoutMeta: (meta: Partial<Workout['meta']>) => void;
  clearWorkout: () => void;

  // Internal
  recalculateMetrics: () => void;
  getAllBlockIds: () => string[];
}

export type WorkoutBuilderStore = WorkoutBuilderState & WorkoutBuilderActions;

// ============================================================================
// Store Implementation
// ============================================================================

export const useWorkoutBuilderStore = create<WorkoutBuilderStore>()(
  temporal(
    immer((set, get) => ({
      // Initial State
      workout: deepClone(defaultWorkout),
      ftp: 200,
      targetDuration: 3600, // 1 hour default
      durationMode: 'auto' as const, // 'fixed': blocks respect limit, 'auto': duration auto-fits
      selectedIds: [],
      dragState: null,
      hoveredBlockId: null,
      snapConfig: deepClone(DEFAULT_SNAP_CONFIG),
      displayConfig: deepClone(DEFAULT_DISPLAY_CONFIG),
      metrics: deepClone(defaultMetrics),

      // ====================================================================
      // Block Operations
      // ====================================================================

      addBlock: (type, insertIndex) => {
        const state = get();
        const currentDuration = getTotalDuration(state.workout.blocks);
        const remainingDuration = state.targetDuration - currentDuration;
        
        // In fixed mode, check if there's room; in auto mode, always allow
        if (state.durationMode === 'fixed' && remainingDuration <= 0) {
          // No room in fixed mode - don't add
          return;
        }
        
        set((s) => {
          const newBlock = createBlock(type);
          
          // In fixed mode, constrain block to remaining space
          if (s.durationMode === 'fixed') {
            const currentUsed = getTotalDuration(s.workout.blocks);
            const remaining = s.targetDuration - currentUsed;
            
            if (newBlock.duration > remaining && remaining > 0) {
              newBlock.duration = Math.max(60, remaining); // At least 1 minute
            }
          }
          
          if (insertIndex !== undefined && insertIndex >= 0) {
            s.workout.blocks.splice(insertIndex, 0, newBlock);
          } else {
            s.workout.blocks.push(newBlock);
          }
          s.selectedIds = [newBlock.id];
        });
        get().recalculateMetrics();
      },

      addIntervalSet: (blockDefs, repeatCount) => {
        set((s) => {
          // Create the interval blocks
          const intervalBlocks: WorkoutBlock[] = blockDefs.map((def) => ({
            id: generateId(),
            type: 'steady' as const,
            duration: def.duration,
            power: def.power,
          }));

          // Create repeat group with the blocks
          const repeatGroup: RepeatGroup = {
            id: generateId(),
            type: 'repeat',
            repeat: repeatCount,
            blocks: intervalBlocks,
          };

          s.workout.blocks.push(repeatGroup);
          s.selectedIds = [repeatGroup.id];
        });
        get().recalculateMetrics();
      },

      updateBlock: (id, updates) => {
        // If duration is being updated, handle based on duration mode
        if (updates.duration !== undefined) {
          const state = get();
          const currentBlock = findBlockById(state.workout.blocks, id);
          if (currentBlock) {
            const currentDuration = getTotalDuration(state.workout.blocks);
            const durationDelta = updates.duration - currentBlock.duration;
            const newTotalDuration = currentDuration + durationDelta;
            
            if (state.durationMode === 'fixed') {
              // In fixed mode, cap duration to available space
              if (newTotalDuration > state.targetDuration) {
                const maxDuration = currentBlock.duration + (state.targetDuration - currentDuration);
                updates = { ...updates, duration: Math.max(60, maxDuration) };
              }
            }
            // In auto mode, duration will auto-fit via recalculateMetrics
          }
        }
        
        set((state) => {
          const updateInBlocks = (blocks: WorkoutItem[]) => {
            for (let i = 0; i < blocks.length; i++) {
              const item = blocks[i];
              if (item.id === id && isWorkoutBlock(item)) {
                Object.assign(item, updates);
                return true;
              }
              if (isRepeatGroup(item)) {
                for (let j = 0; j < item.blocks.length; j++) {
                  if (item.blocks[j].id === id) {
                    Object.assign(item.blocks[j], updates);
                    return true;
                  }
                }
              }
            }
            return false;
          };
          updateInBlocks(state.workout.blocks);
        });
        get().recalculateMetrics();
      },

      deleteBlock: (id) => {
        set((state) => {
          const deleteFromBlocks = (blocks: WorkoutItem[]): WorkoutItem[] => {
            return blocks.filter((item) => {
              if (item.id === id) return false;
              if (isRepeatGroup(item)) {
                item.blocks = item.blocks.filter((b) => b.id !== id);
                // Remove empty repeat groups
                if (item.blocks.length === 0) return false;
              }
              return true;
            });
          };
          state.workout.blocks = deleteFromBlocks(state.workout.blocks);
          state.selectedIds = state.selectedIds.filter((sid) => sid !== id);
        });
        get().recalculateMetrics();
      },

      deleteSelected: () => {
        const { selectedIds } = get();
        selectedIds.forEach((id) => get().deleteBlock(id));
        set((state) => {
          state.selectedIds = [];
        });
      },

      duplicateBlock: (id) => {
        set((state) => {
          const { blocks } = state.workout;
          for (let i = 0; i < blocks.length; i++) {
            const item = blocks[i];
            if (item.id === id) {
              const clone = isRepeatGroup(item)
                ? cloneRepeatGroup(item)
                : cloneBlock(item as WorkoutBlock);
              blocks.splice(i + 1, 0, clone);
              state.selectedIds = [clone.id];
              break;
            }
            if (isRepeatGroup(item)) {
              const blockIndex = item.blocks.findIndex((b) => b.id === id);
              if (blockIndex !== -1) {
                const clone = cloneBlock(item.blocks[blockIndex]);
                item.blocks.splice(blockIndex + 1, 0, clone);
                state.selectedIds = [clone.id];
                break;
              }
            }
          }
        });
        get().recalculateMetrics();
      },

      moveBlock: (id, newIndex) => {
        set((state) => {
          const { blocks } = state.workout;
          const currentIndex = blocks.findIndex((b) => b.id === id);
          if (currentIndex !== -1 && currentIndex !== newIndex) {
            state.workout.blocks = moveItem(blocks, currentIndex, newIndex);
          }
        });
      },

      // ====================================================================
      // Repeat Group Operations
      // ====================================================================

      createRepeatGroup: (blockIds, repeatCount) => {
        set((state) => {
          const { blocks } = state.workout;
          const selectedBlocks: WorkoutBlock[] = [];
          const remainingBlocks: WorkoutItem[] = [];
          let insertIndex = -1;

          blocks.forEach((item, index) => {
            if (blockIds.includes(item.id) && isWorkoutBlock(item)) {
              if (insertIndex === -1) insertIndex = remainingBlocks.length;
              selectedBlocks.push(item);
            } else {
              remainingBlocks.push(item);
            }
          });

          if (selectedBlocks.length > 0 && insertIndex !== -1) {
            const group = createRepeatGroup(selectedBlocks, repeatCount);
            remainingBlocks.splice(insertIndex, 0, group);
            state.workout.blocks = remainingBlocks;
            state.selectedIds = [group.id];
          }
        });
        get().recalculateMetrics();
      },

      ungroupRepeat: (groupId) => {
        set((state) => {
          const { blocks } = state.workout;
          const groupIndex = blocks.findIndex((b) => b.id === groupId);
          if (groupIndex !== -1 && isRepeatGroup(blocks[groupIndex])) {
            const group = blocks[groupIndex] as RepeatGroup;
            // Insert blocks in place of group
            const ungroupedBlocks = group.blocks.map(cloneBlock);
            blocks.splice(groupIndex, 1, ...ungroupedBlocks);
            state.selectedIds = ungroupedBlocks.map((b) => b.id);
          }
        });
        get().recalculateMetrics();
      },

      updateRepeatCount: (groupId, count) => {
        const state = get();
        const group = state.workout.blocks.find(
          (b) => b.id === groupId && isRepeatGroup(b)
        ) as RepeatGroup | undefined;
        
        if (group) {
          const singleIterationDuration = group.blocks.reduce((sum, b) => sum + b.duration, 0);
          const currentGroupDuration = singleIterationDuration * group.repeat;
          const otherBlocksDuration = getTotalDuration(state.workout.blocks) - currentGroupDuration;
          const newGroupDuration = singleIterationDuration * count;
          const totalAfterChange = otherBlocksDuration + newGroupDuration;
          
          // If new total would exceed target, auto-extend target duration
          if (totalAfterChange > state.targetDuration) {
            set((s) => {
              s.targetDuration = totalAfterChange;
            });
          }
          
          set((s) => {
            const g = s.workout.blocks.find(
              (b) => b.id === groupId && isRepeatGroup(b)
            ) as RepeatGroup | undefined;
            if (g) {
              g.repeat = Math.max(1, Math.min(99, count));
            }
          });
        }
        get().recalculateMetrics();
      },

      // ====================================================================
      // Selection
      // ====================================================================

      selectBlock: (id, additive = false) => {
        set((state) => {
          if (additive) {
            const idx = state.selectedIds.indexOf(id);
            if (idx === -1) {
              state.selectedIds.push(id);
            } else {
              state.selectedIds.splice(idx, 1);
            }
          } else {
            state.selectedIds = [id];
          }
        });
      },

      selectRange: (startId, endId) => {
        const allIds = get().getAllBlockIds();
        const startIndex = allIds.indexOf(startId);
        const endIndex = allIds.indexOf(endId);
        if (startIndex !== -1 && endIndex !== -1) {
          const [from, to] =
            startIndex < endIndex
              ? [startIndex, endIndex]
              : [endIndex, startIndex];
          set((state) => {
            state.selectedIds = allIds.slice(from, to + 1);
          });
        }
      },

      clearSelection: () => {
        set((state) => {
          state.selectedIds = [];
        });
      },

      selectAll: () => {
        set((state) => {
          state.selectedIds = get().getAllBlockIds();
        });
      },

      // ====================================================================
      // Drag Operations
      // ====================================================================

      setDragState: (dragState) => {
        const wasDragging = get().dragState !== null;
        set((state) => {
          state.dragState = dragState;
        });
        // When drag ends, recalculate to trigger auto-fit
        if (wasDragging && dragState === null) {
          get().recalculateMetrics();
        }
      },

      setHoveredBlock: (id) => {
        set((state) => {
          state.hoveredBlockId = id;
        });
      },

      // ====================================================================
      // Configuration
      // ====================================================================

      setFTP: (ftp) => {
        set((state) => {
          state.ftp = Math.max(50, Math.min(500, ftp));
        });
        get().recalculateMetrics();
      },

      setTargetDuration: (duration) => {
        set((state) => {
          // Clamp between 5 minutes and 8 hours
          state.targetDuration = Math.max(300, Math.min(28800, duration));
          // Manually setting duration switches to fixed mode
          state.durationMode = 'fixed';
        });
      },

      setDurationMode: (mode) => {
        set((state) => {
          state.durationMode = mode;
        });
        // If switching to auto, recalculate to fit content
        if (mode === 'auto') {
          get().recalculateMetrics();
        }
      },

      toggleDurationMode: () => {
        const current = get().durationMode;
        get().setDurationMode(current === 'fixed' ? 'auto' : 'fixed');
      },

      setSnapConfig: (config) => {
        set((state) => {
          Object.assign(state.snapConfig, config);
        });
      },

      toggleSnap: () => {
        set((state) => {
          state.snapConfig.enabled = !state.snapConfig.enabled;
        });
      },

      // ====================================================================
      // Workout Operations
      // ====================================================================

      setWorkout: (workout) => {
        set((state) => {
          state.workout = deepClone(workout);
          state.selectedIds = [];
        });
        get().recalculateMetrics();
      },

      setWorkoutMeta: (meta) => {
        set((state) => {
          Object.assign(state.workout.meta, meta);
        });
      },

      clearWorkout: () => {
        set((state) => {
          state.workout = deepClone(defaultWorkout);
          state.selectedIds = [];
          state.metrics = deepClone(defaultMetrics);
        });
      },

      // ====================================================================
      // Internal
      // ====================================================================

      recalculateMetrics: () => {
        const { workout, ftp, targetDuration, dragState, durationMode } = get();
        const metrics = calculateWorkoutMetrics(workout.blocks, ftp);
        
        // Auto-fit target duration to content (rounded up to nearest 5 minutes)
        // Only auto-fit when: mode is 'auto' AND not actively dragging
        const usedDuration = getTotalDuration(workout.blocks);
        const roundedUsed = Math.ceil(usedDuration / 300) * 300; // Round up to 5 min
        const newTargetDuration = Math.max(300, roundedUsed); // At least 5 minutes
        const shouldAutoFit = durationMode === 'auto' && dragState === null && newTargetDuration !== targetDuration;
        
        set((state) => {
          state.metrics = metrics;
          state.workout.meta.duration = metrics.duration;
          state.workout.meta.tss = metrics.tss;
          state.workout.meta.intensityFactor = metrics.intensityFactor;
          state.workout.meta.normalizedPower = metrics.normalizedPower;
          
          // Auto-adjust target duration to fit content (only in auto mode, when not dragging)
          if (shouldAutoFit) {
            state.targetDuration = newTargetDuration;
          }
        });
      },

      getAllBlockIds: () => {
        const { workout } = get();
        const ids: string[] = [];
        for (const item of workout.blocks) {
          ids.push(item.id);
          if (isRepeatGroup(item)) {
            ids.push(...item.blocks.map((b) => b.id));
          }
        }
        return ids;
      },
    })),
    {
      limit: HISTORY.MAX_SIZE,
      // Only track certain state changes for undo/redo
      partialize: (state) => ({
        workout: state.workout,
      }),
      // Equality check to avoid duplicate history entries
      equality: (pastState, currentState) =>
        JSON.stringify(pastState) === JSON.stringify(currentState),
    }
  )
);

// ============================================================================
// History Hooks
// ============================================================================

export const useTemporalStore = () => useWorkoutBuilderStore.temporal;

export const useCanUndo = () =>
  useStore(useWorkoutBuilderStore.temporal, (state) => state.pastStates.length > 0);

export const useCanRedo = () =>
  useStore(useWorkoutBuilderStore.temporal, (state) => state.futureStates.length > 0);

export const useUndo = () =>
  useStore(useWorkoutBuilderStore.temporal, (state) => state.undo);

export const useRedo = () =>
  useStore(useWorkoutBuilderStore.temporal, (state) => state.redo);

// ============================================================================
// Selector Hooks
// ============================================================================

export const useWorkout = () =>
  useWorkoutBuilderStore((state) => state.workout);

export const useBlocks = () =>
  useWorkoutBuilderStore((state) => state.workout.blocks);

export const useMetrics = () =>
  useWorkoutBuilderStore((state) => state.metrics);

export const useFTP = () => useWorkoutBuilderStore((state) => state.ftp);

export const useTargetDuration = () =>
  useWorkoutBuilderStore((state) => state.targetDuration);

export const useSelectedIds = () =>
  useWorkoutBuilderStore((state) => state.selectedIds);

export const useSelectedBlock = () =>
  useWorkoutBuilderStore((state) => {
    const { selectedIds, workout } = state;
    if (selectedIds.length !== 1) return null;
    return findBlockById(workout.blocks, selectedIds[0]);
  });

export const useDragState = () =>
  useWorkoutBuilderStore((state) => state.dragState);

export const useSnapConfig = () =>
  useWorkoutBuilderStore((state) => state.snapConfig);
