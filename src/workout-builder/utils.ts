/**
 * Visual Workout Builder - Utility Functions
 */

import type {
  WorkoutBlock,
  RepeatGroup,
  WorkoutItem,
  Workout,
  WorkoutMetrics,
  SnapConfig,
} from './types';
import { DEFAULT_SNAP_CONFIG, DEFAULT_BLOCK_VALUES } from './constants';

// ============================================================================
// ID Generation
// ============================================================================

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Block Factory
// ============================================================================

export function createBlock(
  type: WorkoutBlock['type'],
  overrides: Partial<WorkoutBlock> = {}
): WorkoutBlock {
  const defaults = DEFAULT_BLOCK_VALUES[type];
  return {
    id: generateId(),
    type,
    duration: defaults.duration,
    power: defaults.power,
    powerEnd: 'powerEnd' in defaults ? defaults.powerEnd : undefined,
    ...overrides,
  };
}

export function createRepeatGroup(
  blocks: WorkoutBlock[],
  repeat: number = 4
): RepeatGroup {
  return {
    id: generateId(),
    type: 'repeat',
    repeat,
    blocks: blocks.map((b) => ({ ...b, id: generateId() })),
  };
}

export function cloneBlock(block: WorkoutBlock): WorkoutBlock {
  return { ...block, id: generateId() };
}

export function cloneRepeatGroup(group: RepeatGroup): RepeatGroup {
  return {
    ...group,
    id: generateId(),
    blocks: group.blocks.map(cloneBlock),
  };
}

// ============================================================================
// Block Helpers
// ============================================================================

export function isRepeatGroup(item: WorkoutItem): item is RepeatGroup {
  return item.type === 'repeat';
}

export function isWorkoutBlock(item: WorkoutItem): item is WorkoutBlock {
  return item.type !== 'repeat';
}

export function getBlockDuration(item: WorkoutItem): number {
  if (isRepeatGroup(item)) {
    return item.blocks.reduce((sum, b) => sum + b.duration, 0) * item.repeat;
  }
  return item.duration;
}

export function getTotalDuration(blocks: WorkoutItem[]): number {
  return blocks.reduce((sum, item) => sum + getBlockDuration(item), 0);
}

export function flattenWorkoutBlocks(blocks: WorkoutItem[]): WorkoutBlock[] {
  const result: WorkoutBlock[] = [];
  for (const item of blocks) {
    if (isRepeatGroup(item)) {
      for (let i = 0; i < item.repeat; i++) {
        result.push(...item.blocks);
      }
    } else {
      result.push(item);
    }
  }
  return result;
}

export function findBlockById(
  blocks: WorkoutItem[],
  id: string
): WorkoutBlock | null {
  for (const item of blocks) {
    if (item.id === id && isWorkoutBlock(item)) {
      return item;
    }
    if (isRepeatGroup(item)) {
      const found = item.blocks.find((b) => b.id === id);
      if (found) return found;
    }
  }
  return null;
}

export function findItemById(
  blocks: WorkoutItem[],
  id: string
): WorkoutItem | null {
  for (const item of blocks) {
    if (item.id === id) return item;
    if (isRepeatGroup(item)) {
      const found = item.blocks.find((b) => b.id === id);
      if (found) return found;
    }
  }
  return null;
}

// ============================================================================
// Metrics Calculations
// ============================================================================

/**
 * Calculate TSS for a single block
 * TSS = (duration × power²) / 36
 * 
 * This is a simplified formula where power is expressed as fraction of FTP.
 * The standard formula is: TSS = (s × NP × IF) / (FTP × 3600) × 100
 * Which simplifies to: TSS = (duration_hours × IF²) × 100
 */
export function calculateBlockTSS(duration: number, power: number): number {
  return (duration * power * power) / 36;
}

/**
 * Calculate average power for a ramp block
 */
export function getAveragePower(block: WorkoutBlock): number {
  if (block.type === 'warmup' || block.type === 'cooldown' || block.type === 'ramp') {
    return (block.power + (block.powerEnd ?? block.power)) / 2;
  }
  if (block.type === 'freeride') {
    return 0.5; // Estimation for free ride
  }
  return block.power;
}

/**
 * Calculate full workout metrics
 */
export function calculateWorkoutMetrics(
  blocks: WorkoutItem[],
  ftp: number
): WorkoutMetrics {
  let totalDuration = 0;
  let weightedPowerSum = 0;
  let tssSum = 0;
  let kjSum = 0;

  const processBlock = (block: WorkoutBlock, multiplier: number = 1) => {
    const duration = block.duration * multiplier;
    const avgPower = getAveragePower(block);

    totalDuration += duration;
    weightedPowerSum += avgPower * avgPower * duration;
    tssSum += calculateBlockTSS(duration, avgPower);

    // Kilojoules = average power in watts × time in hours × 3.6
    const avgWatts = avgPower * ftp;
    kjSum += (avgWatts * duration) / 1000;
  };

  for (const item of blocks) {
    if (isRepeatGroup(item)) {
      for (const block of item.blocks) {
        processBlock(block, item.repeat);
      }
    } else {
      processBlock(item);
    }
  }

  // Normalized Power (weighted average power)
  const normalizedPower =
    totalDuration > 0
      ? Math.sqrt(weightedPowerSum / totalDuration) * ftp
      : 0;

  // Intensity Factor = NP / FTP
  const intensityFactor = ftp > 0 ? normalizedPower / ftp : 0;

  return {
    duration: totalDuration,
    tss: Math.round(tssSum),
    intensityFactor: Math.round(intensityFactor * 100) / 100,
    normalizedPower: Math.round(normalizedPower),
    kilojoules: Math.round(kjSum),
  };
}

// ============================================================================
// Snapping Logic
// ============================================================================

/**
 * Snap a value to the nearest increment
 */
export function snapToIncrement(value: number, increment: number): number {
  return Math.round(value / increment) * increment;
}

/**
 * Snap duration with threshold awareness
 */
export function snapDuration(
  value: number,
  config: SnapConfig['duration'] = DEFAULT_SNAP_CONFIG.duration
): number {
  // Check if close to a common threshold (within 5 seconds)
  for (const threshold of config.thresholds) {
    if (Math.abs(value - threshold) <= 5) {
      return threshold;
    }
  }
  // Otherwise snap to increment
  return snapToIncrement(value, config.increment);
}

/**
 * Snap power with zone boundary awareness
 */
export function snapPower(
  value: number,
  config: SnapConfig['power'] = DEFAULT_SNAP_CONFIG.power
): number {
  // Check if close to a zone boundary (within 2%)
  for (const zone of config.zones) {
    if (Math.abs(value - zone) <= 0.02) {
      return zone;
    }
  }
  // Otherwise snap to increment
  return snapToIncrement(value, config.increment);
}

/**
 * Apply snapping based on config
 */
export function applySnap(
  value: number,
  type: 'duration' | 'power',
  config: SnapConfig = DEFAULT_SNAP_CONFIG
): number {
  if (!config.enabled) return value;
  return type === 'duration'
    ? snapDuration(value, config.duration)
    : snapPower(value, config.power);
}

// ============================================================================
// Time Formatting
// ============================================================================

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function parseDuration(str: string): number {
  const parts = str.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return parseInt(str) || 0;
}

// ============================================================================
// Power Formatting
// ============================================================================

export function formatPower(power: number, ftp?: number): string {
  if (ftp) {
    return `${Math.round(power * ftp)}W`;
  }
  return `${Math.round(power * 100)}%`;
}

export function formatPowerRange(
  powerStart: number,
  powerEnd: number,
  ftp?: number
): string {
  if (ftp) {
    return `${Math.round(powerStart * ftp)}-${Math.round(powerEnd * ftp)}W`;
  }
  return `${Math.round(powerStart * 100)}-${Math.round(powerEnd * 100)}%`;
}

// ============================================================================
// Math Utilities
// ============================================================================

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function inverseLerp(a: number, b: number, value: number): number {
  return (value - a) / (b - a);
}

// ============================================================================
// Deep Clone
// ============================================================================

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// ============================================================================
// Array Utilities
// ============================================================================

export function moveItem<T>(
  array: T[],
  fromIndex: number,
  toIndex: number
): T[] {
  const result = [...array];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
}

export function insertItem<T>(array: T[], index: number, item: T): T[] {
  const result = [...array];
  result.splice(index, 0, item);
  return result;
}

export function removeItem<T>(array: T[], index: number): T[] {
  const result = [...array];
  result.splice(index, 1);
  return result;
}

// ============================================================================
// Debounce/Throttle
// ============================================================================

export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// ============================================================================
// Zone Distribution
// ============================================================================

import { POWER_ZONES } from './constants';

/**
 * Get the zone index for a given power (0-5)
 */
export function getZoneForPower(power: number): number {
  for (let i = POWER_ZONES.length - 1; i >= 0; i--) {
    if (power >= POWER_ZONES[i].min) {
      return i;
    }
  }
  return 0;
}

/**
 * Get the zone name for a given power
 */
export function getZoneName(power: number): string {
  const zone = POWER_ZONES[getZoneForPower(power)];
  return zone?.name ?? 'recovery';
}

/**
 * Calculate time spent in each zone (returns array of seconds per zone)
 */
export function calculateZoneDistribution(blocks: WorkoutItem[]): number[] {
  const zoneTimes: number[] = new Array(POWER_ZONES.length).fill(0);
  const flatBlocks = flattenWorkoutBlocks(blocks);

  for (const block of flatBlocks) {
    if (block.type === 'freeride') continue;

    const hasRamp = block.powerEnd !== undefined && block.powerEnd !== block.power;

    if (hasRamp) {
      // For ramps, sample every second and assign to appropriate zone
      const startPower = block.power;
      const endPower = block.powerEnd!;
      const powerDelta = endPower - startPower;

      for (let t = 0; t < block.duration; t++) {
        const progress = t / block.duration;
        const currentPower = startPower + powerDelta * progress;
        const zoneIndex = getZoneForPower(currentPower);
        zoneTimes[zoneIndex]++;
      }
    } else {
      // Steady state - all time in one zone
      const zoneIndex = getZoneForPower(block.power);
      zoneTimes[zoneIndex] += block.duration;
    }
  }

  return zoneTimes;
}

