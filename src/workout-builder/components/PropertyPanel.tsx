/**
 * PropertyPanel Component
 * 
 * Editable properties for the selected block.
 */

import React, { useCallback, useState, useEffect } from 'react';
import { useSelectedBlock, useWorkoutBuilderStore, useFTP } from '../store';
import { formatDuration, parseDuration } from '../utils';
import type { BlockType } from '../types';

const BLOCK_TYPES: { value: BlockType; label: string }[] = [
  { value: 'steady', label: 'Steady State' },
  { value: 'warmup', label: 'Warmup' },
  { value: 'cooldown', label: 'Cooldown' },
  { value: 'ramp', label: 'Ramp' },
  { value: 'freeride', label: 'Free Ride' },
];

export const PropertyPanel: React.FC = () => {
  const selectedBlock = useSelectedBlock();
  const ftp = useFTP();
  const { updateBlock, deleteSelected, duplicateBlock, selectedIds } = useWorkoutBuilderStore();

  const [durationInput, setDurationInput] = useState('');
  const [powerInput, setPowerInput] = useState('');
  const [powerEndInput, setPowerEndInput] = useState('');
  const [cadenceInput, setCadenceInput] = useState('');
  const [textInput, setTextInput] = useState('');

  // Sync inputs with selected block
  useEffect(() => {
    if (selectedBlock) {
      setDurationInput(formatDuration(selectedBlock.duration));
      setPowerInput(Math.round(selectedBlock.power * 100).toString());
      setPowerEndInput(
        selectedBlock.powerEnd !== undefined
          ? Math.round(selectedBlock.powerEnd * 100).toString()
          : ''
      );
      setCadenceInput(selectedBlock.cadence?.toString() ?? '');
      setTextInput(selectedBlock.text ?? '');
    }
  }, [selectedBlock]);

  const handleDurationChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setDurationInput(e.target.value);
    },
    []
  );

  const handleDurationBlur = useCallback(() => {
    if (!selectedBlock) return;
    const seconds = parseDuration(durationInput);
    if (seconds > 0) {
      updateBlock(selectedBlock.id, { duration: seconds });
    } else {
      setDurationInput(formatDuration(selectedBlock.duration));
    }
  }, [selectedBlock, durationInput, updateBlock]);

  const handlePowerChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPowerInput(e.target.value);
    },
    []
  );

  const handlePowerBlur = useCallback(() => {
    if (!selectedBlock) return;
    const power = parseInt(powerInput, 10);
    if (!isNaN(power) && power >= 20 && power <= 200) {
      updateBlock(selectedBlock.id, { power: power / 100 });
    } else {
      setPowerInput(Math.round(selectedBlock.power * 100).toString());
    }
  }, [selectedBlock, powerInput, updateBlock]);

  const handlePowerEndChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPowerEndInput(e.target.value);
    },
    []
  );

  const handlePowerEndBlur = useCallback(() => {
    if (!selectedBlock) return;
    const power = parseInt(powerEndInput, 10);
    if (!isNaN(power) && power >= 20 && power <= 200) {
      updateBlock(selectedBlock.id, { powerEnd: power / 100 });
    } else {
      setPowerEndInput(
        selectedBlock.powerEnd !== undefined
          ? Math.round(selectedBlock.powerEnd * 100).toString()
          : ''
      );
    }
  }, [selectedBlock, powerEndInput, updateBlock]);

  const handleCadenceChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setCadenceInput(e.target.value);
    },
    []
  );

  const handleCadenceBlur = useCallback(() => {
    if (!selectedBlock) return;
    const value = cadenceInput.trim();
    if (value === '') {
      updateBlock(selectedBlock.id, { cadence: undefined });
    } else {
      const cadence = parseInt(value, 10);
      if (!isNaN(cadence) && cadence >= 30 && cadence <= 150) {
        updateBlock(selectedBlock.id, { cadence });
      } else {
        setCadenceInput(selectedBlock.cadence?.toString() ?? '');
      }
    }
  }, [selectedBlock, cadenceInput, updateBlock]);

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setTextInput(e.target.value);
    },
    []
  );

  // Stop propagation for text input to prevent spacebar triggering workout controls
  const handleTextKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Enter' && !e.shiftKey) {
        (e.target as HTMLTextAreaElement).blur();
      }
    },
    []
  );

  const handleTextBlur = useCallback(() => {
    if (!selectedBlock) return;
    updateBlock(selectedBlock.id, { text: textInput || undefined });
  }, [selectedBlock, textInput, updateBlock]);

  const handleTypeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (!selectedBlock) return;
      const type = e.target.value as BlockType;
      const updates: Partial<typeof selectedBlock> = { type };

      // Add/remove powerEnd for ramp types
      if (type === 'warmup' || type === 'cooldown' || type === 'ramp') {
        if (selectedBlock.powerEnd === undefined) {
          updates.powerEnd = type === 'warmup' ? selectedBlock.power + 0.25 : selectedBlock.power - 0.25;
        }
      } else {
        updates.powerEnd = undefined;
      }

      updateBlock(selectedBlock.id, updates);
    },
    [selectedBlock, updateBlock]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation(); // Prevent triggering workout controls
      if (e.key === 'Enter') {
        (e.target as HTMLInputElement).blur();
      }
    },
    []
  );

  const handleDuplicate = useCallback(() => {
    if (selectedBlock) {
      duplicateBlock(selectedBlock.id);
    }
  }, [selectedBlock, duplicateBlock]);

  if (!selectedBlock) {
    return (
      <div className="property-panel property-panel-empty">
        <div className="panel-header">Properties</div>
        <span className="empty-message">
          {selectedIds.length > 1
            ? `${selectedIds.length} blocks selected`
            : 'Select a block to edit'}
        </span>

        <style>{propertyPanelStyles}</style>
      </div>
    );
  }

  const hasRamp =
    selectedBlock.type === 'warmup' ||
    selectedBlock.type === 'cooldown' ||
    selectedBlock.type === 'ramp';

  const absolutePower = Math.round(selectedBlock.power * ftp);
  const absolutePowerEnd = hasRamp && selectedBlock.powerEnd
    ? Math.round(selectedBlock.powerEnd * ftp)
    : null;

  return (
    <div className="property-panel">
      <div className="panel-header">Properties</div>
      
      <div className="property-group">
        <label className="property-label">
          <span className="label-text">Type</span>
          <select
            value={selectedBlock.type}
            onChange={handleTypeChange}
            className="property-select"
          >
            {BLOCK_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="property-group">
        <label className="property-label">
          <span className="label-text">Duration</span>
          <input
            type="text"
            value={durationInput}
            onChange={handleDurationChange}
            onBlur={handleDurationBlur}
            onKeyDown={handleKeyDown}
            className="property-input"
            placeholder="5:00"
          />
        </label>
      </div>

      <div className="property-group">
        <label className="property-label">
          <span className="label-text">
            {hasRamp ? 'Start Power' : 'Power'}
          </span>
          <div className="input-with-suffix">
            <input
              type="number"
              value={powerInput}
              onChange={handlePowerChange}
              onBlur={handlePowerBlur}
              onKeyDown={handleKeyDown}
              className="property-input"
              min={20}
              max={200}
              step={5}
            />
            <span className="input-suffix">% ({absolutePower}W)</span>
          </div>
        </label>
      </div>

      {hasRamp && (
        <div className="property-group">
          <label className="property-label">
            <span className="label-text">End Power</span>
            <div className="input-with-suffix">
              <input
                type="number"
                value={powerEndInput}
                onChange={handlePowerEndChange}
                onBlur={handlePowerEndBlur}
                onKeyDown={handleKeyDown}
                className="property-input"
                min={20}
                max={200}
                step={5}
              />
              <span className="input-suffix">
                % {absolutePowerEnd && `(${absolutePowerEnd}W)`}
              </span>
            </div>
          </label>
        </div>
      )}

      <div className="property-group">
        <label className="property-label">
          <span className="label-text">Cadence</span>
          <div className="input-with-suffix">
            <input
              type="number"
              value={cadenceInput}
              onChange={handleCadenceChange}
              onBlur={handleCadenceBlur}
              onKeyDown={handleKeyDown}
              className="property-input"
              min={30}
              max={150}
              placeholder="—"
            />
            <span className="input-suffix">rpm</span>
          </div>
        </label>
      </div>

      <div className="property-group property-group-text">
        <label className="property-label">
          <span className="label-text">Coaching Notes</span>
          <textarea
            value={textInput}
            onChange={handleTextChange}
            onBlur={handleTextBlur}
            onKeyDown={handleTextKeyDown}
            className="property-textarea"
            placeholder="e.g., High cadence, stay seated"
            maxLength={250}
            rows={3}
          />
        </label>
      </div>

      <div className="property-actions">
        <button className="action-btn" onClick={handleDuplicate} title="Duplicate block">
          Duplicate
        </button>
        <button
          className="action-btn action-btn-danger"
          onClick={deleteSelected}
          title="Delete block"
        >
          Delete
        </button>
      </div>

      <style>{propertyPanelStyles}</style>
    </div>
  );
};

const propertyPanelStyles = `
  .property-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: #141428;
    border-left: 1px solid #333;
    width: 220px;
    min-width: 220px;
    overflow-y: auto;
  }

  .panel-header {
    font-size: 12px;
    font-weight: 600;
    color: #fff;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding-bottom: 8px;
    border-bottom: 1px solid #333;
    margin-bottom: 4px;
  }

  .property-panel-empty {
    justify-content: flex-start;
    align-items: stretch;
  }

  .property-panel-empty .empty-message {
    color: #666;
    font-size: 12px;
    text-align: center;
    margin-top: 20px;
  }

  .property-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .property-label {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .label-text {
    font-size: 10px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .property-input,
  .property-select {
    padding: 8px 10px;
    border: 1px solid #444;
    border-radius: 4px;
    background: #2a2a4a;
    color: #fff;
    font-size: 12px;
    width: 100%;
    box-sizing: border-box;
  }

  .property-input:focus,
  .property-select:focus {
    outline: none;
    border-color: #00bfff;
  }

  .property-select {
    cursor: pointer;
  }

  .property-group-text {
    flex: none;
  }

  .property-textarea {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid #444;
    border-radius: 4px;
    background: #2a2a4a;
    color: #fff;
    font-size: 12px;
    font-family: inherit;
    box-sizing: border-box;
    resize: none;
    min-height: 60px;
    max-height: 100px;
    overflow-y: auto;
    line-height: 1.4;
  }

  .property-textarea:focus {
    outline: none;
    border-color: #00bfff;
  }

  .property-textarea::placeholder {
    color: #666;
  }

  .input-with-suffix {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .input-with-suffix .property-input {
    flex: 1;
    min-width: 0;
  }

  .input-suffix {
    font-size: 10px;
    color: #666;
    white-space: nowrap;
  }

  .property-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: auto;
    padding-top: 12px;
    border-top: 1px solid #333;
  }

  .action-btn {
    padding: 8px 12px;
    border: 1px solid #444;
    border-radius: 4px;
    background: #2a2a4a;
    color: #fff;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s ease;
    width: 100%;
  }

  .action-btn:hover {
    background: #3a3a5a;
  }

  .action-btn-danger:hover {
    background: #5a2a2a;
    border-color: #744;
  }
`;

export default PropertyPanel;
