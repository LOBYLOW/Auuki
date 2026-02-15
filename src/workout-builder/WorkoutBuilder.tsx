/**
 * WorkoutBuilder Component
 * 
 * The main workout builder application component that combines
 * the timeline, toolbar, property panel, and metrics.
 */

import React, { useCallback, useEffect } from 'react';
import { Toolbar } from './components/Toolbar';
import { WorkoutTimeline } from './components/WorkoutTimeline';
import { PropertyPanel } from './components/PropertyPanel';
import { MetricsPanel } from './components/MetricsPanel';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useWorkoutBuilderStore, useWorkout, useMetrics } from './store';
import type { Workout } from './types';

interface WorkoutBuilderProps {
  /** Initial workout to load */
  initialWorkout?: Workout;
  /** User's FTP in watts */
  ftp?: number;
  /** Callback when workout changes */
  onWorkoutChange?: (workout: Workout) => void;
  /** Callback for exporting workout */
  onExport?: (workout: Workout) => void;
  /** Callback for importing workout */
  onImport?: () => void;
  /** Callback for saving workout to library */
  onSave?: (workout: Workout) => void;
  /** Custom class name */
  className?: string;
  /** Custom styles */
  style?: React.CSSProperties;
}

export const WorkoutBuilder: React.FC<WorkoutBuilderProps> = ({
  initialWorkout,
  ftp: initialFtp,
  onWorkoutChange,
  onExport,
  onImport,
  onSave,
  className,
  style,
}) => {
  const { setWorkout, setFTP, workout } = useWorkoutBuilderStore();

  // Initialize with props
  useEffect(() => {
    if (initialWorkout) {
      setWorkout(initialWorkout);
    }
  }, [initialWorkout, setWorkout]);

  useEffect(() => {
    if (initialFtp) {
      setFTP(initialFtp);
    }
  }, [initialFtp, setFTP]);

  // Notify parent of changes
  useEffect(() => {
    if (onWorkoutChange) {
      onWorkoutChange(workout);
    }
  }, [workout, onWorkoutChange]);

  // Enable keyboard shortcuts
  useKeyboardShortcuts();

  // Export handler
  const handleExport = useCallback(() => {
    if (onExport) {
      onExport(workout);
    }
  }, [workout, onExport]);

  // Save handler
  const handleSave = useCallback(() => {
    if (onSave) {
      onSave(workout);
    }
  }, [workout, onSave]);

  return (
    <div
      className={`workout-builder-app ${className || ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 400,
        background: '#1a1a2e',
        borderRadius: 8,
        overflow: 'hidden',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        ...style,
      }}
    >
      {/* Toolbar */}
      <Toolbar 
        onExport={onExport ? handleExport : undefined} 
        onImport={onImport} 
        onSave={onSave ? handleSave : undefined}
      />

      {/* Main content area with Timeline and Property Panel */}
      <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
        {/* Timeline (main canvas) */}
        <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
          <WorkoutTimeline />
        </div>

        {/* Property Panel (right sidebar) */}
        <PropertyPanel />
      </div>

      {/* Metrics Panel */}
      <MetricsPanel />
    </div>
  );
};

// ============================================================================
// Standalone Wrapper Component
// ============================================================================

/**
 * Standalone version of WorkoutBuilder with its own store instance.
 * Use this when you want isolated state.
 */
export const WorkoutBuilderStandalone: React.FC<WorkoutBuilderProps> = (props) => {
  return <WorkoutBuilder {...props} />;
};

// ============================================================================
// Export Hooks for External Use
// ============================================================================

export {
  useWorkoutBuilderStore,
  useWorkout,
  useMetrics,
  useFTP,
  useSelectedIds,
  useSelectedBlock,
  useCanUndo,
  useCanRedo,
} from './store';

export type { Workout, WorkoutBlock, RepeatGroup, WorkoutMetrics, BlockType } from './types';

export default WorkoutBuilder;
