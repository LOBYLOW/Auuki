/**
 * DraggableBlock Component
 * 
 * An SVG-based workout block that can be resized via drag handles:
 * - Right edge: Adjust duration
 * - Top edge: Adjust power percentage
 * - Body: Select/move block
 */

import React, { useCallback, useEffect, useRef } from 'react';
import type { WorkoutBlock, DragState, DragHandle } from '../types';
import { useWorkoutBuilderStore } from '../store';
import { getZoneColor, UI } from '../constants';
import { formatDuration, applySnap, clamp } from '../utils';

interface DraggableBlockProps {
  block: WorkoutBlock;
  x: number;
  width: number;
  chartHeight: number;
  pixelsPerSecond: number;
  pixelsPerPower: number;
  isSelected: boolean;
  isHovered: boolean;
  maxPower: number;
  minPower: number;
  minDuration: number;
}

export const DraggableBlock: React.FC<DraggableBlockProps> = ({
  block,
  x,
  width,
  chartHeight,
  pixelsPerSecond,
  pixelsPerPower,
  isSelected,
  isHovered,
  maxPower,
  minPower,
  minDuration,
}) => {
  const {
    updateBlock,
    selectBlock,
    setDragState,
    setHoveredBlock,
    dragState,
    snapConfig,
  } = useWorkoutBuilderStore();

  const blockRef = useRef<SVGGElement>(null);

  // Calculate block dimensions
  const height = block.power * pixelsPerPower;
  const y = chartHeight - height;
  const color = getZoneColor(block.power);

  // For ramp blocks, calculate the end height
  // A block is visually a ramp if start and end power are different
  const endPower = block.powerEnd ?? block.power;
  const hasRamp = Math.abs(block.power - endPower) > 0.001;
  const endHeight = endPower * pixelsPerPower;
  const endY = chartHeight - endHeight;

  // Handle pointer down on different areas
  const handlePointerDown = useCallback(
    (e: React.PointerEvent, handle: DragHandle) => {
      e.preventDefault();
      e.stopPropagation();

      // Select block on click
      const additive = e.ctrlKey || e.metaKey;
      selectBlock(block.id, additive);

      if (handle === 'move') {
        // Just selection, no drag resize
        return;
      }

      // Calculate start value based on handle type
      let startValue: number;
      let startValue2: number | undefined;

      if (handle === 'right' || handle === 'left') {
        startValue = block.duration;
      } else if (handle === 'top-left') {
        // Top-left corner: start power
        startValue = block.power;
        startValue2 = endPower;
      } else if (handle === 'top-right') {
        // Top-right corner: end power
        startValue = block.power;
        startValue2 = endPower;
      } else {
        // Top (middle): both powers
        startValue = block.power;
        startValue2 = endPower;
      }

      setDragState({
        blockId: block.id,
        handle,
        startX: e.clientX,
        startY: e.clientY,
        startValue,
        startValue2,
      });

      // Capture pointer for smooth dragging
      (e.target as Element).setPointerCapture(e.pointerId);
    },
    [block.id, block.duration, block.power, endPower, hasRamp, selectBlock, setDragState]
  );

  // Handle pointer move (global, attached when dragging)
  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!dragState || dragState.blockId !== block.id) return;

      const deltaX = e.clientX - dragState.startX;
      const deltaY = e.clientY - dragState.startY;

      if (dragState.handle === 'right') {
        // Adjust duration
        const deltaDuration = deltaX / pixelsPerSecond;
        let newDuration = dragState.startValue + deltaDuration;
        newDuration = clamp(newDuration, minDuration, 7200); // Max 2 hours
        newDuration = applySnap(newDuration, 'duration', snapConfig);
        updateBlock(block.id, { duration: Math.round(newDuration) });
      } else if (dragState.handle === 'top') {
        // Dragging middle top - adjust both start and end power uniformly
        const deltaPower = -deltaY / pixelsPerPower;
        let newPower = dragState.startValue + deltaPower;
        newPower = clamp(newPower, minPower, maxPower);
        newPower = applySnap(newPower, 'power', snapConfig);
        
        // Adjust end power by same delta to maintain ramp shape
        const currentEndPower = dragState.startValue2 ?? dragState.startValue;
        let newEndPower = currentEndPower + deltaPower;
        newEndPower = clamp(newEndPower, minPower, maxPower);
        newEndPower = applySnap(newEndPower, 'power', snapConfig);
        
        updateBlock(block.id, { power: newPower, powerEnd: newEndPower });
      } else if (dragState.handle === 'top-left') {
        // Dragging top-left corner - adjust start power only (creates/modifies ramp)
        const deltaPower = -deltaY / pixelsPerPower;
        let newPower = dragState.startValue + deltaPower;
        newPower = clamp(newPower, minPower, maxPower);
        newPower = applySnap(newPower, 'power', snapConfig);
        
        // Keep end power as-is (or set to current power if not a ramp yet)
        const currentEndPower = dragState.startValue2 ?? dragState.startValue;
        updateBlock(block.id, { power: newPower, powerEnd: currentEndPower });
      } else if (dragState.handle === 'top-right') {
        // Dragging top-right corner - adjust end power only (creates/modifies ramp)
        const deltaPower = -deltaY / pixelsPerPower;
        const currentEndPower = dragState.startValue2 ?? dragState.startValue;
        let newEndPower = currentEndPower + deltaPower;
        newEndPower = clamp(newEndPower, minPower, maxPower);
        newEndPower = applySnap(newEndPower, 'power', snapConfig);
        
        // Keep start power as-is
        updateBlock(block.id, { powerEnd: newEndPower });
      }
    },
    [
      dragState,
      block.id,
      pixelsPerSecond,
      pixelsPerPower,
      minDuration,
      minPower,
      maxPower,
      snapConfig,
      updateBlock,
    ]
  );

  // Handle pointer up (global)
  const handlePointerUp = useCallback(() => {
    if (dragState?.blockId === block.id) {
      setDragState(null);
    }
  }, [dragState, block.id, setDragState]);

  // Attach/detach global listeners when dragging this block
  useEffect(() => {
    if (dragState?.blockId === block.id) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      return () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };
    }
  }, [dragState, block.id, handlePointerMove, handlePointerUp]);

  // Handle hover
  const handlePointerEnter = useCallback(() => {
    setHoveredBlock(block.id);
  }, [block.id, setHoveredBlock]);

  const handlePointerLeave = useCallback(() => {
    setHoveredBlock(null);
  }, [setHoveredBlock]);

  // Render ramp block (trapezoid shape)
  const renderRampBlock = () => {
    const points = [
      `${x},${chartHeight}`,                    // Bottom left
      `${x},${y}`,                              // Top left (start power)
      `${x + width},${endY}`,                   // Top right (end power)
      `${x + width},${chartHeight}`,            // Bottom right
    ].join(' ');

    return (
      <polygon
        points={points}
        fill={color}
        stroke={isSelected ? '#00bfff' : 'none'}
        strokeWidth={isSelected ? UI.SELECTION_STROKE_WIDTH : 0}
        className="block-fill"
        style={{
          filter: isHovered ? 'brightness(1.15)' : undefined,
          cursor: 'pointer',
        }}
        onPointerDown={(e) => handlePointerDown(e, 'move')}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
      />
    );
  };

  // Render steady block (rectangle)
  const renderSteadyBlock = () => (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill={color}
      stroke={isSelected ? '#00bfff' : 'none'}
      strokeWidth={isSelected ? UI.SELECTION_STROKE_WIDTH : 0}
      className="block-fill"
      style={{
        filter: isHovered ? 'brightness(1.15)' : undefined,
        cursor: 'pointer',
      }}
      onPointerDown={(e) => handlePointerDown(e, 'move')}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    />
  );

  return (
    <g ref={blockRef} className="workout-block" data-block-id={block.id}>
      {/* Main block shape */}
      {hasRamp ? renderRampBlock() : renderSteadyBlock()}

      {/* Right handle (duration resize) */}
      <rect
        x={x + width - UI.HANDLE_SIZE / 2}
        y={hasRamp ? Math.min(y, endY) : y}
        width={UI.HANDLE_SIZE}
        height={(hasRamp ? Math.max(height, endHeight) : height) + 1}
        fill="transparent"
        className="handle-right"
        style={{ cursor: 'ew-resize' }}
        onPointerDown={(e) => handlePointerDown(e, 'right')}
      />

      {/* Top-left corner handle (start power) */}
      <rect
        x={x - UI.HANDLE_SIZE / 2}
        y={y - UI.HANDLE_SIZE / 2}
        width={UI.HANDLE_SIZE * 1.5}
        height={UI.HANDLE_SIZE}
        fill="transparent"
        className="handle-top-left"
        style={{ cursor: 'ns-resize' }}
        onPointerDown={(e) => handlePointerDown(e, 'top-left')}
      />

      {/* Top-right corner handle (end power) */}
      <rect
        x={x + width - UI.HANDLE_SIZE}
        y={endY - UI.HANDLE_SIZE / 2}
        width={UI.HANDLE_SIZE * 1.5}
        height={UI.HANDLE_SIZE}
        fill="transparent"
        className="handle-top-right"
        style={{ cursor: 'ns-resize' }}
        onPointerDown={(e) => handlePointerDown(e, 'top-right')}
      />

      {/* Top middle handle (both powers uniform) - polygon follows the diagonal for ramps */}
      <polygon
        points={`
          ${x + UI.HANDLE_SIZE},${y - UI.HANDLE_SIZE / 2}
          ${x + width - UI.HANDLE_SIZE},${endY - UI.HANDLE_SIZE / 2}
          ${x + width - UI.HANDLE_SIZE},${endY + UI.HANDLE_SIZE / 2}
          ${x + UI.HANDLE_SIZE},${y + UI.HANDLE_SIZE / 2}
        `}
        fill="transparent"
        className="handle-top"
        style={{ cursor: 'ns-resize' }}
        onPointerDown={(e) => handlePointerDown(e, 'top')}
      />

      {/* Hover indicator on handles */}
      {(isHovered || isSelected) && (
        <>
          {/* Right edge indicator */}
          <line
            x1={x + width}
            y1={hasRamp ? Math.min(y, endY) : y}
            x2={x + width}
            y2={chartHeight}
            stroke="rgba(255,255,255,0.5)"
            strokeWidth={2}
            pointerEvents="none"
          />
          {/* Top edge indicator */}
          <line
            x1={x}
            y1={y}
            x2={x + width}
            y2={hasRamp ? endY : y}
            stroke="rgba(255,255,255,0.5)"
            strokeWidth={2}
            pointerEvents="none"
          />
        </>
      )}

      {/* Power label */}
      <text
        x={x + width / 2}
        y={hasRamp ? (y + endY) / 2 + Math.max(height, endHeight) / 4 : y + height / 2 + 4}
        fill="white"
        fontSize={11}
        fontWeight="bold"
        textAnchor="middle"
        pointerEvents="none"
        style={{ textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}
      >
        {hasRamp
          ? `${Math.round(block.power * 100)}-${Math.round(endPower * 100)}%`
          : `${Math.round(block.power * 100)}%`}
      </text>

      {/* Duration label (below block) */}
      <text
        x={x + width / 2}
        y={chartHeight + 15}
        fill={UI.LABEL_COLOR}
        fontSize={9}
        textAnchor="middle"
        pointerEvents="none"
      >
        {formatDuration(block.duration)}
      </text>

      {/* Block type indicator for special blocks */}
      {block.type !== 'steady' && (
        <text
          x={x + 5}
          y={y + 12}
          fill="rgba(255,255,255,0.7)"
          fontSize={8}
          pointerEvents="none"
          style={{ textTransform: 'uppercase' }}
        >
          {block.type}
        </text>
      )}
    </g>
  );
};

export default DraggableBlock;
