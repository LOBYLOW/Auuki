/**
 * Toolbar Component
 * 
 * Controls for adding blocks, undo/redo, and workout actions.
 */

import React, { useCallback, useState, useEffect } from 'react';
import { useWorkoutBuilderStore, useCanUndo, useCanRedo, useUndo, useRedo } from '../store';
import { INTERVAL_PRESETS, DEFAULT_BLOCK_VALUES } from '../constants';
import { formatDuration } from '../utils';
import type { BlockType } from '../types';

interface ToolbarProps {
  onExport?: () => void;
  onImport?: () => void;
  onSave?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ onExport, onImport, onSave }) => {
  const {
    addBlock,
    addIntervalSet,
    createRepeatGroup,
    deleteSelected,
    selectedIds,
    toggleSnap,
    snapConfig,
    clearWorkout,
    targetDuration,
    setTargetDuration,
    durationMode,
    toggleDurationMode,
  } = useWorkoutBuilderStore();

  const canUndo = useCanUndo();
  const canRedo = useCanRedo();
  const undo = useUndo();
  const redo = useRedo();

  const [showIntervalMenu, setShowIntervalMenu] = useState(false);
  const [durationInput, setDurationInput] = useState(String(targetDuration / 60)); // in minutes

  // Sync input when targetDuration changes externally (e.g., auto-extended)
  useEffect(() => {
    setDurationInput(String(Math.round(targetDuration / 60)));
  }, [targetDuration]);

  const handleAddBlock = useCallback(
    (type: BlockType) => {
      addBlock(type);
    },
    [addBlock]
  );

  const handleAddInterval = useCallback(
    (presetIndex: number) => {
      const preset = INTERVAL_PRESETS[presetIndex];
      // Spread readonly array to mutable
      addIntervalSet([...preset.blocks], preset.repeat);
      setShowIntervalMenu(false);
    },
    [addIntervalSet]
  );

  const handleCreateRepeat = useCallback(() => {
    if (selectedIds.length >= 1) {
      createRepeatGroup(selectedIds, 4);
    }
  }, [selectedIds, createRepeatGroup]);

  const handleDurationChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDurationInput(e.target.value);
  }, []);

  const handleDurationBlur = useCallback(() => {
    const minutes = parseInt(durationInput, 10);
    if (!isNaN(minutes) && minutes >= 5 && minutes <= 480) {
      setTargetDuration(minutes * 60);
    } else {
      // Reset to current value if invalid
      setDurationInput(String(targetDuration / 60));
    }
  }, [durationInput, setTargetDuration, targetDuration]);

  const handleDurationKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleDurationBlur();
    }
  }, [handleDurationBlur]);

  const hasSelection = selectedIds.length > 0;

  return (
    <div className="workout-builder-toolbar">
      {/* Block Type Buttons */}
      <div className="toolbar-group">
        <button
          className="toolbar-btn"
          onClick={() => handleAddBlock('steady')}
          title="Add Steady State block (5 min @ 75%)"
        >
          <span className="btn-icon">+</span>
          <span className="btn-label">Steady</span>
        </button>

        <button
          className="toolbar-btn"
          onClick={() => handleAddBlock('warmup')}
          title="Add Warmup block (5 min, ramp up)"
        >
          <span className="btn-icon">↗</span>
          <span className="btn-label">Warmup</span>
        </button>

        <button
          className="toolbar-btn"
          onClick={() => handleAddBlock('cooldown')}
          title="Add Cooldown block (5 min, ramp down)"
        >
          <span className="btn-icon">↘</span>
          <span className="btn-label">Cooldown</span>
        </button>

        <div className="toolbar-dropdown">
          <button
            className="toolbar-btn"
            onClick={() => setShowIntervalMenu(!showIntervalMenu)}
            title="Add interval set"
          >
            <span className="btn-icon">⟳</span>
            <span className="btn-label">Intervals</span>
            <span className="btn-chevron">▼</span>
          </button>

          {showIntervalMenu && (
            <div className="dropdown-menu dropdown-menu-wide">
              {INTERVAL_PRESETS.map((preset, index) => (
                <button
                  key={preset.name}
                  className="dropdown-item dropdown-item-interval"
                  onClick={() => handleAddInterval(index)}
                  title={preset.description}
                >
                  <span className="interval-name">{preset.name}</span>
                  <span className="interval-repeat">×{preset.repeat}</span>
                  <span className="interval-desc">{preset.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Selection Actions */}
      <div className="toolbar-group">
        <button
          className="toolbar-btn"
          onClick={handleCreateRepeat}
          disabled={!hasSelection}
          title="Create repeat group from selected blocks"
        >
          <span className="btn-icon">×N</span>
          <span className="btn-label">Repeat</span>
        </button>

        <button
          className="toolbar-btn toolbar-btn-danger"
          onClick={deleteSelected}
          disabled={!hasSelection}
          title="Delete selected blocks (Delete key)"
        >
          <span className="btn-icon">🗑</span>
          <span className="btn-label">Delete</span>
        </button>
      </div>

      {/* History Actions */}
      <div className="toolbar-group">
        <button
          className="toolbar-btn"
          onClick={() => undo()}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          <span className="btn-icon">↩</span>
          <span className="btn-label">Undo</span>
        </button>

        <button
          className="toolbar-btn"
          onClick={() => redo()}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
        >
          <span className="btn-icon">↪</span>
          <span className="btn-label">Redo</span>
        </button>
      </div>

      {/* Options */}
      <div className="toolbar-group toolbar-options">
        <label className="toolbar-checkbox" title="Snap to grid">
          <input
            type="checkbox"
            checked={snapConfig.enabled}
            onChange={toggleSnap}
          />
          <span>Snap</span>
        </label>
      </div>

      {/* Target Duration */}
      <div className="toolbar-group toolbar-duration">
        <label className="toolbar-duration-label" title="Total ride duration (5-480 minutes)">
          <span className="duration-label-text">Duration:</span>
          <input
            type="number"
            className="duration-input"
            value={durationInput}
            onChange={handleDurationChange}
            onBlur={handleDurationBlur}
            onKeyDown={handleDurationKeyDown}
            min={5}
            max={480}
            step={5}
            disabled={durationMode === 'auto'}
          />
          <span className="duration-unit">min</span>
        </label>
        <button
          className={`toolbar-btn toolbar-btn-mode ${durationMode === 'auto' ? 'mode-auto' : 'mode-fixed'}`}
          onClick={toggleDurationMode}
          title={durationMode === 'auto' ? 'Auto mode: duration fits content. Click to lock duration.' : 'Fixed mode: blocks respect duration limit. Click for auto-fit.'}
        >
          <span className="btn-icon">{durationMode === 'auto' ? '🔓' : '🔒'}</span>
          <span className="btn-label">{durationMode === 'auto' ? 'Auto' : 'Fixed'}</span>
        </button>
      </div>

      {/* Spacer */}
      <div className="toolbar-spacer" />

      {/* Import/Export/Save */}
      <div className="toolbar-group">
        {onSave && (
          <button className="toolbar-btn toolbar-btn-primary" onClick={onSave} title="Save to workout library">
            <span className="btn-icon">📚</span>
            <span className="btn-label">Save</span>
          </button>
        )}
        {onImport && (
          <button className="toolbar-btn" onClick={onImport} title="Import ZWO file">
            <span className="btn-icon">📂</span>
            <span className="btn-label">Import</span>
          </button>
        )}
        {onExport && (
          <button className="toolbar-btn" onClick={onExport} title="Export as ZWO file">
            <span className="btn-icon">💾</span>
            <span className="btn-label">Export</span>
          </button>
        )}
        <button
          className="toolbar-btn toolbar-btn-danger"
          onClick={clearWorkout}
          title="Clear all blocks"
        >
          <span className="btn-icon">✕</span>
          <span className="btn-label">Clear</span>
        </button>
      </div>

      <style>{`
        .workout-builder-toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding: 10px 12px;
          background: #141428;
          border-bottom: 1px solid #333;
          align-items: center;
        }

        .toolbar-group {
          display: flex;
          gap: 4px;
          align-items: center;
        }

        .toolbar-group:not(:last-child)::after {
          content: '';
          width: 1px;
          height: 24px;
          background: #333;
          margin-left: 8px;
        }

        .toolbar-spacer {
          flex: 1;
        }

        .toolbar-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 10px;
          border: 1px solid #444;
          border-radius: 4px;
          background: #2a2a4a;
          color: #fff;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
        }

        .toolbar-btn:hover:not(:disabled) {
          background: #3a3a5a;
          border-color: #555;
        }

        .toolbar-btn:active:not(:disabled) {
          background: #4a4a6a;
        }

        .toolbar-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .toolbar-btn-danger:hover:not(:disabled) {
          background: #5a2a2a;
          border-color: #744;
        }

        .toolbar-btn-primary {
          background: #1a5a2a;
          border-color: #2a7a3a;
        }

        .toolbar-btn-primary:hover:not(:disabled) {
          background: #2a7a3a;
          border-color: #3a9a4a;
        }

        .btn-icon {
          font-size: 14px;
        }

        .btn-label {
          font-size: 11px;
        }

        .btn-chevron {
          font-size: 8px;
          margin-left: 2px;
        }

        .toolbar-dropdown {
          position: relative;
        }

        .dropdown-menu {
          position: absolute;
          top: 100%;
          left: 0;
          margin-top: 4px;
          background: #2a2a4a;
          border: 1px solid #444;
          border-radius: 4px;
          min-width: 150px;
          z-index: 100;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }

        .dropdown-item {
          display: block;
          width: 100%;
          padding: 8px 12px;
          border: none;
          background: none;
          color: #fff;
          font-size: 12px;
          text-align: left;
          cursor: pointer;
        }

        .dropdown-item:hover {
          background: #3a3a5a;
        }

        .dropdown-menu-wide {
          min-width: 220px;
          max-height: 350px;
          overflow-y: auto;
        }

        .dropdown-item-interval {
          display: grid;
          grid-template-columns: 1fr auto;
          grid-template-rows: auto auto;
          gap: 2px 8px;
          padding: 10px 12px;
          border-bottom: 1px solid #333;
        }

        .dropdown-item-interval:last-child {
          border-bottom: none;
        }

        .interval-name {
          font-weight: bold;
          color: #fff;
        }

        .interval-repeat {
          color: #00bfff;
          font-weight: bold;
          font-size: 11px;
        }

        .interval-desc {
          grid-column: 1 / -1;
          font-size: 10px;
          color: #888;
        }

        .toolbar-checkbox {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: #aaa;
          cursor: pointer;
        }

        .toolbar-checkbox input {
          accent-color: #00bfff;
        }

        .toolbar-options {
          margin-left: auto;
        }

        .toolbar-duration {
          display: flex;
          align-items: center;
        }

        .toolbar-duration-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #ccc;
        }

        .duration-label-text {
          color: #888;
        }

        .duration-input {
          width: 60px;
          padding: 4px 6px;
          border: 1px solid #444;
          border-radius: 4px;
          background: #2a2a4a;
          color: #fff;
          font-size: 12px;
          text-align: center;
        }

        .duration-input:focus {
          outline: none;
          border-color: #00bfff;
        }

        .duration-input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .duration-unit {
          color: #888;
          font-size: 11px;
        }

        .toolbar-btn-mode {
          margin-left: 4px;
          min-width: 70px;
        }

        .toolbar-btn-mode.mode-auto {
          border-color: #4CAF50;
          color: #4CAF50;
        }

        .toolbar-btn-mode.mode-fixed {
          border-color: #FF9800;
          color: #FF9800;
        }

        @media (max-width: 768px) {
          .btn-label {
            display: none;
          }
          .toolbar-btn {
            padding: 6px 8px;
          }
        }
      `}</style>
    </div>
  );
};

export default Toolbar;
