/**
 * RepeatGroup Component
 * 
 * A container for repeated interval sets.
 * Renders child blocks with a visual bracket and repeat counter.
 */

import React, { useCallback, useState } from 'react';
import type { RepeatGroup as RepeatGroupType } from '../types';
import { useWorkoutBuilderStore } from '../store';
import { DraggableBlock } from './DraggableBlock';
import { UI } from '../constants';

interface RepeatGroupProps {
  group: RepeatGroupType;
  x: number;
  chartHeight: number;
  pixelsPerSecond: number;
  pixelsPerPower: number;
  maxPower: number;
  minPower: number;
  minDuration: number;
}

export const RepeatGroupComponent: React.FC<RepeatGroupProps> = ({
  group,
  x,
  chartHeight,
  pixelsPerSecond,
  pixelsPerPower,
  maxPower,
  minPower,
  minDuration,
}) => {
  const {
    selectedIds,
    hoveredBlockId,
    updateRepeatCount,
    ungroupRepeat,
    selectBlock,
  } = useWorkoutBuilderStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(group.repeat.toString());

  // Calculate total width of the group (one iteration)
  const singleIterationDuration = group.blocks.reduce((sum, b) => sum + b.duration, 0);
  const singleIterationWidth = singleIterationDuration * pixelsPerSecond;
  
  // Total width including all repeats
  const totalGroupWidth = singleIterationWidth * group.repeat;

  // Check if group is selected
  const isGroupSelected = selectedIds.includes(group.id);

  // Render editable child blocks (first iteration only)
  let currentX = x;
  const editableBlocks = group.blocks.map((block) => {
    const blockWidth = block.duration * pixelsPerSecond;
    const element = (
      <DraggableBlock
        key={block.id}
        block={block}
        x={currentX}
        width={blockWidth}
        chartHeight={chartHeight}
        pixelsPerSecond={pixelsPerSecond}
        pixelsPerPower={pixelsPerPower}
        isSelected={selectedIds.includes(block.id)}
        isHovered={hoveredBlockId === block.id}
        maxPower={maxPower}
        minPower={minPower}
        minDuration={minDuration}
      />
    );
    currentX += blockWidth;
    return element;
  });

  // Render ghost copies for subsequent iterations (non-editable)
  const ghostBlocks: React.ReactNode[] = [];
  for (let iteration = 1; iteration < group.repeat; iteration++) {
    const iterationStartX = x + singleIterationWidth * iteration;
    let blockX = iterationStartX;
    
    group.blocks.forEach((block, blockIndex) => {
      const blockWidth = block.duration * pixelsPerSecond;
      const powerHeight = (block.power / maxPower) * chartHeight;
      const powerEndHeight = block.powerEnd !== undefined 
        ? (block.powerEnd / maxPower) * chartHeight 
        : powerHeight;
      
      // Determine fill color based on power
      const power = block.power;
      let fillColor = '#808080';
      if (power >= 1.20) fillColor = '#ff0000';
      else if (power >= 1.05) fillColor = '#ff6600';
      else if (power >= 0.90) fillColor = '#ffcc00';
      else if (power >= 0.75) fillColor = '#00cc44';
      else if (power >= 0.55) fillColor = '#0088ff';
      
      if (block.type === 'ramp' || block.type === 'warmup' || block.type === 'cooldown') {
        // Render as trapezoid/ramp
        const points = [
          `${blockX},${chartHeight}`,
          `${blockX},${chartHeight - powerHeight}`,
          `${blockX + blockWidth},${chartHeight - powerEndHeight}`,
          `${blockX + blockWidth},${chartHeight}`,
        ].join(' ');
        
        ghostBlocks.push(
          <polygon
            key={`ghost-${iteration}-${blockIndex}`}
            points={points}
            fill={fillColor}
            fillOpacity={0.3}
            stroke={fillColor}
            strokeWidth={1}
            strokeOpacity={0.4}
            style={{ pointerEvents: 'none' }}
          />
        );
      } else {
        // Render as rectangle
        ghostBlocks.push(
          <rect
            key={`ghost-${iteration}-${blockIndex}`}
            x={blockX}
            y={chartHeight - powerHeight}
            width={blockWidth}
            height={powerHeight}
            fill={fillColor}
            fillOpacity={0.3}
            stroke={fillColor}
            strokeWidth={1}
            strokeOpacity={0.4}
            rx={2}
            style={{ pointerEvents: 'none' }}
          />
        );
      }
      
      blockX += blockWidth;
    });
  }

  // Handle repeat count change
  const handleRepeatChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEditValue(e.target.value);
    },
    []
  );

  const handleRepeatBlur = useCallback(() => {
    const newCount = parseInt(editValue, 10);
    if (!isNaN(newCount) && newCount >= 1 && newCount <= 99) {
      updateRepeatCount(group.id, newCount);
    } else {
      setEditValue(group.repeat.toString());
    }
    setIsEditing(false);
  }, [editValue, group.id, group.repeat, updateRepeatCount]);

  const handleRepeatKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleRepeatBlur();
      } else if (e.key === 'Escape') {
        setEditValue(group.repeat.toString());
        setIsEditing(false);
      }
    },
    [handleRepeatBlur, group.repeat]
  );

  const handleBadgeClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsEditing(true);
    },
    []
  );

  const handleGroupClick = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as Element).classList.contains('group-container')) {
        const additive = e.ctrlKey || e.metaKey;
        selectBlock(group.id, additive);
      }
    },
    [group.id, selectBlock]
  );

  // Handle double-click to ungroup
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      ungroupRepeat(group.id);
    },
    [group.id, ungroupRepeat]
  );

  const bracketPadding = 4;
  const bracketRadius = 6;
  const badgeWidth = 40;
  const badgeHeight = 20;

  return (
    <g className="repeat-group" data-group-id={group.id}>
      {/* Bracket/container outline - covers all iterations */}
      <rect
        x={x - bracketPadding}
        y={-bracketPadding}
        width={totalGroupWidth + bracketPadding * 2}
        height={chartHeight + bracketPadding + 25}
        fill="none"
        stroke={isGroupSelected ? '#00bfff' : '#666'}
        strokeWidth={isGroupSelected ? 2 : 1}
        strokeDasharray={isGroupSelected ? 'none' : '5,3'}
        rx={bracketRadius}
        className="group-container"
        style={{ cursor: 'pointer' }}
        onClick={handleGroupClick}
        onDoubleClick={handleDoubleClick}
      />

      {/* Repeat indicator badge */}
      <g
        transform={`translate(${x + totalGroupWidth / 2 - badgeWidth / 2}, ${chartHeight + 8})`}
        style={{ cursor: 'pointer' }}
        onClick={handleBadgeClick}
      >
        <rect
          width={badgeWidth}
          height={badgeHeight}
          rx={badgeHeight / 2}
          fill={isGroupSelected ? '#00bfff' : '#444'}
          stroke={isGroupSelected ? '#00bfff' : '#666'}
          strokeWidth={1}
        />
        
        {isEditing ? (
          <foreignObject x={2} y={2} width={badgeWidth - 4} height={badgeHeight - 4}>
            <input
              type="number"
              min={1}
              max={99}
              value={editValue}
              onChange={handleRepeatChange}
              onBlur={handleRepeatBlur}
              onKeyDown={handleRepeatKeyDown}
              autoFocus
              style={{
                width: '100%',
                height: '100%',
                background: 'transparent',
                border: 'none',
                color: 'white',
                textAlign: 'center',
                fontSize: '11px',
                fontWeight: 'bold',
                outline: 'none',
              }}
            />
          </foreignObject>
        ) : (
          <text
            x={badgeWidth / 2}
            y={badgeHeight / 2 + 4}
            fill="white"
            fontSize={11}
            fontWeight="bold"
            textAnchor="middle"
            pointerEvents="none"
          >
            ×{group.repeat}
          </text>
        )}
      </g>

      {/* Tooltip hint */}
      {isGroupSelected && (
        <text
          x={x + totalGroupWidth / 2}
          y={-10}
          fill="#888"
          fontSize={9}
          textAnchor="middle"
          pointerEvents="none"
        >
          Double-click to ungroup
        </text>
      )}

      {/* Editable blocks (first iteration) */}
      {editableBlocks}
      
      {/* Ghost blocks (subsequent iterations - non-editable) */}
      {ghostBlocks}
    </g>
  );
};

export default RepeatGroupComponent;
