/**
 * WorkoutTimeline Component
 * 
 * The main SVG canvas that renders the visual workout timeline.
 * Includes grid lines, FTP reference, and all workout blocks.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useWorkoutBuilderStore } from '../store';
import { DraggableBlock } from './DraggableBlock';
import { RepeatGroupComponent } from './RepeatGroup';
import { DEFAULT_DISPLAY_CONFIG, UI } from '../constants';
import { isRepeatGroup, getTotalDuration, formatDuration } from '../utils';

interface WorkoutTimelineProps {
  width?: number;
  height?: number;
}

export const WorkoutTimeline: React.FC<WorkoutTimelineProps> = ({
  width: propWidth,
  height: propHeight,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 300 });

  const {
    workout,
    ftp,
    selectedIds,
    hoveredBlockId,
    displayConfig,
    targetDuration,
    clearSelection,
  } = useWorkoutBuilderStore();

  const { padding, maxPower, minPower, minDuration } = displayConfig;

  // Handle resize
  useEffect(() => {
    if (propWidth && propHeight) {
      setDimensions({ width: propWidth, height: propHeight });
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [propWidth, propHeight]);

  // Calculate chart dimensions
  const chartWidth = dimensions.width - padding.left - padding.right;
  const chartHeight = dimensions.height - padding.top - padding.bottom;

  // Use targetDuration for X-axis (blocks must fit within this)
  const totalDuration = targetDuration;
  const usedDuration = getTotalDuration(workout.blocks);

  // Scale factors
  const pixelsPerSecond = chartWidth / totalDuration;
  const pixelsPerPower = chartHeight / maxPower;

  // Handle click on empty space
  const handleBackgroundClick = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as Element).classList.contains('timeline-background')) {
        clearSelection();
      }
    },
    [clearSelection]
  );

  // Generate Y-axis grid lines
  const yAxisLines = [];
  const powerLevels = [0.5, 0.75, 0.90, 1.0, 1.05, 1.20, 1.5];
  for (const power of powerLevels) {
    if (power <= maxPower) {
      const y = chartHeight - power * pixelsPerPower;
      yAxisLines.push(
        <g key={`y-${power}`}>
          <line
            x1={padding.left}
            y1={padding.top + y}
            x2={dimensions.width - padding.right}
            y2={padding.top + y}
            stroke={power === 1.0 ? 'rgba(255,255,255,0.3)' : UI.GRID_LINE_COLOR}
            strokeWidth={power === 1.0 ? 1.5 : 1}
            strokeDasharray={power === 1.0 ? '5,5' : '3,3'}
          />
          <text
            x={padding.left - 5}
            y={padding.top + y + 4}
            fill={UI.LABEL_COLOR}
            fontSize={10}
            textAnchor="end"
          >
            {Math.round(power * 100)}%
          </text>
          {power === 1.0 && (
            <text
              x={dimensions.width - padding.right + 5}
              y={padding.top + y + 4}
              fill="#888"
              fontSize={9}
            >
              FTP
            </text>
          )}
        </g>
      );
    }
  }

  // Generate X-axis time markers
  const xAxisMarkers = [];
  const numMarkers = Math.min(10, Math.floor(totalDuration / 60));
  const markerInterval = Math.max(60, Math.ceil(totalDuration / numMarkers / 60) * 60);
  for (let t = 0; t <= totalDuration; t += markerInterval) {
    const x = padding.left + (t / totalDuration) * chartWidth;
    xAxisMarkers.push(
      <text
        key={`x-${t}`}
        x={x}
        y={dimensions.height - 5}
        fill={UI.LABEL_COLOR}
        fontSize={10}
        textAnchor="middle"
      >
        {formatDuration(t)}
      </text>
    );
  }

  // Render workout blocks
  let currentX = padding.left;
  const renderedBlocks = workout.blocks.map((item) => {
    if (isRepeatGroup(item)) {
      // Total duration = single iteration * repeat count
      const singleIterationDuration = item.blocks.reduce((sum, b) => sum + b.duration, 0);
      const totalGroupDuration = singleIterationDuration * item.repeat;
      const element = (
        <RepeatGroupComponent
          key={item.id}
          group={item}
          x={currentX}
          chartHeight={chartHeight}
          pixelsPerSecond={pixelsPerSecond}
          pixelsPerPower={pixelsPerPower}
          maxPower={maxPower}
          minPower={minPower}
          minDuration={minDuration}
        />
      );
      currentX += totalGroupDuration * pixelsPerSecond;
      return element;
    } else {
      const blockWidth = item.duration * pixelsPerSecond;
      const element = (
        <DraggableBlock
          key={item.id}
          block={item}
          x={currentX}
          width={blockWidth}
          chartHeight={chartHeight}
          pixelsPerSecond={pixelsPerSecond}
          pixelsPerPower={pixelsPerPower}
          isSelected={selectedIds.includes(item.id)}
          isHovered={hoveredBlockId === item.id}
          maxPower={maxPower}
          minPower={minPower}
          minDuration={minDuration}
        />
      );
      currentX += blockWidth;
      return element;
    }
  });

  // Empty state
  const isEmpty = workout.blocks.length === 0;

  return (
    <div
      ref={containerRef}
      className="workout-timeline"
      style={{
        width: '100%',
        height: '100%',
        minHeight: 250,
        background: UI.BACKGROUND_COLOR,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <svg
        width={dimensions.width}
        height={dimensions.height}
        style={{ display: 'block' }}
      >
        {/* Background (for click handling) */}
        <rect
          x={0}
          y={0}
          width={dimensions.width}
          height={dimensions.height}
          fill="transparent"
          className="timeline-background"
          onClick={handleBackgroundClick}
        />

        {/* Grid lines */}
        <g className="grid-lines">{yAxisLines}</g>

        {/* X-axis */}
        <line
          x1={padding.left}
          y1={padding.top + chartHeight}
          x2={dimensions.width - padding.right}
          y2={padding.top + chartHeight}
          stroke="#555"
          strokeWidth={1}
        />
        <g className="x-axis-markers">{xAxisMarkers}</g>

        {/* Chart area clip path */}
        <defs>
          <clipPath id="chart-area">
            <rect
              x={padding.left}
              y={padding.top}
              width={chartWidth}
              height={chartHeight}
            />
          </clipPath>
        </defs>

        {/* Blocks container */}
        <g
          className="blocks-container"
          transform={`translate(0, ${padding.top})`}
          clipPath="url(#chart-area)"
        >
          {renderedBlocks}
          
          {/* Available duration indicator - only show if there's meaningful remaining time */}
          {usedDuration < totalDuration && (totalDuration - usedDuration) >= 60 && (
            <>
              <rect
                x={padding.left + usedDuration * pixelsPerSecond}
                y={0}
                width={(totalDuration - usedDuration) * pixelsPerSecond}
                height={chartHeight}
                fill="rgba(0, 191, 255, 0.05)"
                stroke="rgba(0, 191, 255, 0.2)"
                strokeWidth={1}
                strokeDasharray="4,4"
                style={{ pointerEvents: 'none' }}
              />
              {/* Remaining duration label */}
              <text
                x={padding.left + usedDuration * pixelsPerSecond + (totalDuration - usedDuration) * pixelsPerSecond / 2}
                y={chartHeight / 2}
                fill="rgba(0, 191, 255, 0.6)"
                fontSize={14}
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                style={{ pointerEvents: 'none' }}
              >
                {Math.round((totalDuration - usedDuration) / 60)} min
              </text>
            </>
          )}
        </g>

        {/* Empty state */}
        {isEmpty && (
          <g className="empty-state">
            <text
              x={dimensions.width / 2}
              y={dimensions.height / 2}
              fill="#666"
              fontSize={14}
              textAnchor="middle"
            >
              Click "Add Block" to start building your workout
            </text>
            <text
              x={dimensions.width / 2}
              y={dimensions.height / 2 + 20}
              fill="#555"
              fontSize={11}
              textAnchor="middle"
            >
              Drag edges to resize • Click to select • Ctrl+Click for multi-select
            </text>
          </g>
        )}
      </svg>
    </div>
  );
};

export default WorkoutTimeline;
