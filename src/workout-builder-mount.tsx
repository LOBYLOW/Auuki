/**
 * React Workout Builder Mount Script
 * 
 * This script mounts the React WorkoutBuilder component into the existing app.
 * It bridges the React component with the xf pub/sub system for data flow.
 */
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { WorkoutBuilder } from './workout-builder';
import { xf } from './functions.js';
import { uuid } from './storage/uuid.js';
import { intervalsToGraph } from './views/workout-graph.js';

let root: Root | null = null;
let currentFtp = 200;

// Subscribe to FTP changes from the existing app
xf.sub('db:ftp', (ftp: number) => {
  currentFtp = ftp;
  renderWorkoutBuilder();
});

function handleWorkoutChange(workout: any) {
  // Dispatch to existing app's pub/sub system
  xf.dispatch('workout:fromBuilder', workout);
}

function handleExport(workout: any) {
  // Convert to ZWO format and trigger download
  const zwoContent = workoutToZWO(workout);
  downloadFile(zwoContent, `${workout.meta.name || 'workout'}.zwo`, 'application/xml');
}

async function handleSave(workout: any) {
  try {
    // Validate workout has required structure
    if (!workout || !workout.meta || !workout.blocks) {
      alert('Cannot save: workout data is incomplete.');
      return;
    }
    
    if (!workout.blocks.length) {
      alert('Cannot save: workout has no blocks. Add at least one block first.');
      return;
    }
    
    // Prompt for workout name if not set or is default
    let workoutName = workout.meta.name;
    if (!workoutName || workoutName === 'New Workout') {
      const inputName = prompt('Enter a name for your workout:', 'My Custom Workout');
      if (!inputName) {
        // User cancelled
        return;
      }
      workoutName = inputName;
    }
    
    // Convert workout builder format to app workout format
    const intervals = convertBlocksToIntervals(workout.blocks);
    
    // Calculate total duration from intervals (in case meta.duration is stale)
    const calculatedDuration = intervals.reduce((sum, interval) => sum + (interval.duration || 0), 0);
    const totalDuration = calculatedDuration || workout.meta.duration || 0;
    
    // Generate SVG graph for the workout list
    // intervalsToGraph expects a workout object with { intervals, meta: { duration } }
    const workoutForGraph = {
      intervals,
      meta: { duration: totalDuration }
    };
    const graph = intervalsToGraph(workoutForGraph, currentFtp);
    
    const workoutToSave = {
      id: workout.id || uuid(),
      meta: {
        name: workoutName,
        author: workout.meta.author || 'Workout Builder',
        category: workout.meta.category || 'Custom',
        description: workout.meta.description || '',
        duration: totalDuration,
        tss: workout.meta.tss,
        intensityFactor: workout.meta.intensityFactor,
        normalizedPower: workout.meta.normalizedPower,
        sportType: workout.meta.sportType || 'bike',
      },
      intervals,
      graph,
      isSystem: false,
      created: Date.now(),
    };
    
    // Use existing app event to add and persist workout
    xf.dispatch('ui:workout:save', workoutToSave);
    
    // Show success feedback
    console.log('[WorkoutBuilder] Workout saved to library:', workoutToSave.meta.name);
    alert(`Workout "${workoutToSave.meta.name}" saved to library!`);
  } catch (error) {
    console.error('[WorkoutBuilder] Failed to save workout:', error);
    alert('Failed to save workout. See console for details.');
  }
}

function convertBlocksToIntervals(blocks: any[]): any[] {
  const intervals: any[] = [];
  
  if (!blocks || !Array.isArray(blocks)) {
    return intervals;
  }
  
  for (const block of blocks) {
    if (!block) continue;
    
    if (block.type === 'repeat') {
      // Handle repeat groups - flatten the blocks repeated
      for (let i = 0; i < (block.repeat || 1); i++) {
        for (const innerBlock of block.blocks) {
          intervals.push(convertSingleBlock(innerBlock));
        }
      }
    } else {
      intervals.push(convertSingleBlock(block));
    }
  }
  
  return intervals;
}

function convertSingleBlock(block: any): any {
  const duration = block.duration || 300; // Default 5 min
  const power = block.power || 0.75; // Default 75%
  const isRamp = block.type === 'ramp' || block.type === 'warmup' || block.type === 'cooldown';
  const powerEnd = block.powerEnd ?? power;
  
  if (isRamp && power !== powerEnd) {
    // For ramps, create stepped intervals (similar to ZWO parsing)
    const timeDx = 10; // 10-second steps
    const stepsCount = Math.max(2, Math.floor(duration / timeDx));
    const actualTimeDx = duration / stepsCount;
    const powerDx = (powerEnd - power) / (stepsCount - 1);
    
    const steps: any[] = [];
    let stepPower = power;
    
    for (let i = 0; i < stepsCount; i++) {
      steps.push({
        duration: actualTimeDx,
        power: parseFloat(stepPower.toFixed(2)),
        cadence: block.cadence,
      });
      stepPower += powerDx;
    }
    
    return {
      duration,
      power,
      powerHigh: powerEnd,
      cadence: block.cadence,
      text: block.text,
      steps,
    };
  }
  
  // Steady state block
  return {
    duration,
    power,
    powerHigh: power,
    cadence: block.cadence,
    text: block.text,
    steps: [
      { duration, power, cadence: block.cadence },
    ],
  };
}

function workoutToZWO(workout: any): string {
  // Basic ZWO export - can be expanded
  let offset = 0;
  const intervals: string[] = [];
  const textEvents: string[] = [];
  
  for (const block of workout.blocks) {
    const powerStart = block.type === 'ramp' ? block.power : block.power;
    const powerEnd = block.type === 'ramp' ? (block.powerEnd ?? block.power) : block.power;
    
    // Add text event if block has coaching text
    if (block.text) {
      textEvents.push(`    <textevent timeoffset="${offset}" message="${escapeXml(block.text)}"/>`);
    }
    
    if (block.type === 'ramp') {
      intervals.push(`    <Ramp Duration="${block.duration}" PowerLow="${powerStart}" PowerHigh="${powerEnd}"/>`);
    } else {
      intervals.push(`    <SteadyState Duration="${block.duration}" Power="${powerStart}"${block.cadence ? ` Cadence="${block.cadence}"` : ''}/>`);
    }
    
    offset += block.duration;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
  <author>${escapeXml(workout.meta.author || 'Auuki')}</author>
  <name>${escapeXml(workout.meta.name || 'Workout')}</name>
  <description>${escapeXml(workout.meta.description || '')}</description>
  <sportType>bike</sportType>
  <workout>
${intervals.join('\n')}
${textEvents.join('\n')}
  </workout>
</workout_file>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function renderWorkoutBuilder() {
  const container = document.getElementById('react-workout-builder');
  if (!container) return;
  
  if (!root) {
    root = createRoot(container);
  }
  
  root.render(
    React.createElement(WorkoutBuilder, {
      ftp: currentFtp,
      onWorkoutChange: handleWorkoutChange,
      onExport: handleExport,
      onSave: handleSave,
    })
  );
}

// Initialize when the builder tab is shown
xf.sub('action:nav', (action: string) => {
  if (action === 'workouts:builder') {
    // Show the React builder, hide the old editor
    document.getElementById('view--workouts-builder')?.classList.add('active');
    document.getElementById('view--workouts-editor')?.classList.remove('active');
    
    // Render on first show
    setTimeout(renderWorkoutBuilder, 0);
  } else if (action.startsWith('workouts:')) {
    // Hide the React builder when switching to other workout tabs
    document.getElementById('view--workouts-builder')?.classList.remove('active');
  }
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  if (root) {
    root.unmount();
    root = null;
  }
});

console.log('[WorkoutBuilder] React mount script loaded');
