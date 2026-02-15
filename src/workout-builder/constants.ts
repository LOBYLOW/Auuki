/**
 * Visual Workout Builder - Constants and Configuration
 */

import type { SnapConfig, DisplayConfig, ZoneConfig } from './types';

// ============================================================================
// Power Zones Configuration
// ============================================================================

export const POWER_ZONES: ZoneConfig[] = [
  { name: 'recovery', color: '#808080', min: 0.00, max: 0.55 },
  { name: 'endurance', color: '#0088ff', min: 0.55, max: 0.75 },
  { name: 'tempo', color: '#00cc44', min: 0.75, max: 0.90 },
  { name: 'threshold', color: '#ffcc00', min: 0.90, max: 1.05 },
  { name: 'vo2max', color: '#ff6600', min: 1.05, max: 1.20 },
  { name: 'anaerobic', color: '#ff0000', min: 1.20, max: 2.00 },
];

export const ZONE_COLORS: Record<string, string> = {
  recovery: '#808080',
  endurance: '#0088ff',
  tempo: '#00cc44',
  threshold: '#ffcc00',
  vo2max: '#ff6600',
  anaerobic: '#ff0000',
  'zone-1': '#808080',
  'zone-2': '#0088ff',
  'zone-3': '#00cc44',
  'zone-4': '#ffcc00',
  'zone-5': '#ff6600',
  'zone-6': '#ff0000',
};

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_SNAP_CONFIG: SnapConfig = {
  enabled: true,
  duration: {
    increment: 15, // seconds
    thresholds: [30, 60, 90, 120, 180, 300, 600, 900, 1200, 1800, 3600],
  },
  power: {
    increment: 0.05, // 5% FTP
    zones: [0.55, 0.75, 0.90, 1.05, 1.20, 1.50], // Zone boundaries
  },
};

export const DEFAULT_DISPLAY_CONFIG: DisplayConfig = {
  maxPower: 2.0, // 200% FTP
  minDuration: 15, // seconds
  minPower: 0.20, // 20% FTP
  padding: {
    top: 30,
    right: 30,
    bottom: 60,
    left: 50,
  },
};

// ============================================================================
// UI Constants
// ============================================================================

export const UI = {
  HANDLE_SIZE: 10,
  HANDLE_HIT_AREA: 16,
  MIN_BLOCK_WIDTH: 20,
  SELECTION_STROKE_WIDTH: 2,
  GRID_LINE_COLOR: '#333',
  FTP_LINE_COLOR: '#fff',
  LABEL_COLOR: '#888',
  TEXT_COLOR: '#fff',
  BACKGROUND_COLOR: '#1a1a2e',
  TOOLBAR_HEIGHT: 52,
  PROPERTIES_HEIGHT: 60,
} as const;

// ============================================================================
// Default Block Values
// ============================================================================

export const DEFAULT_BLOCK_VALUES = {
  steady: {
    duration: 300, // 5 minutes
    power: 0.75,
  },
  warmup: {
    duration: 300,
    power: 0.45,
    powerEnd: 0.75,
  },
  cooldown: {
    duration: 300,
    power: 0.65,
    powerEnd: 0.40,
  },
  ramp: {
    duration: 60,
    power: 0.75,
    powerEnd: 1.05,
  },
  freeride: {
    duration: 300,
    power: 0.50,
  },
} as const;

// ============================================================================
// Interval Presets
// ============================================================================

export const INTERVAL_PRESETS = [
  {
    name: '30/30s',
    description: 'VO2max micro-intervals',
    blocks: [
      { duration: 30, power: 1.20 },
      { duration: 30, power: 0.50 },
    ],
    repeat: 8,
  },
  {
    name: '40/20s',
    description: 'High-intensity short intervals',
    blocks: [
      { duration: 40, power: 1.20 },
      { duration: 20, power: 0.50 },
    ],
    repeat: 8,
  },
  {
    name: '60/60s',
    description: 'Classic VO2max intervals',
    blocks: [
      { duration: 60, power: 1.15 },
      { duration: 60, power: 0.45 },
    ],
    repeat: 6,
  },
  {
    name: '3min ON/OFF',
    description: 'Threshold development',
    blocks: [
      { duration: 180, power: 1.05 },
      { duration: 180, power: 0.55 },
    ],
    repeat: 4,
  },
  {
    name: 'Tabata',
    description: '20s max effort / 10s rest',
    blocks: [
      { duration: 20, power: 1.50 },
      { duration: 10, power: 0.45 },
    ],
    repeat: 8,
  },
  {
    name: 'Over-Unders',
    description: 'Lactate clearance',
    blocks: [
      { duration: 120, power: 0.95 },
      { duration: 60, power: 1.10 },
    ],
    repeat: 4,
  },
  {
    name: 'Sweet Spot 10min',
    description: 'SST with short recovery',
    blocks: [
      { duration: 600, power: 0.90 },
      { duration: 120, power: 0.50 },
    ],
    repeat: 3,
  },
  {
    name: 'Pyramid',
    description: '1-2-3-2-1 min intervals',
    blocks: [
      { duration: 60, power: 1.10 },
      { duration: 60, power: 0.50 },
      { duration: 120, power: 1.10 },
      { duration: 60, power: 0.50 },
      { duration: 180, power: 1.10 },
      { duration: 60, power: 0.50 },
      { duration: 120, power: 1.10 },
      { duration: 60, power: 0.50 },
      { duration: 60, power: 1.10 },
      { duration: 60, power: 0.50 },
    ],
    repeat: 1,
  },
  {
    name: 'Billat 30/30',
    description: 'Classic VO2max protocol',
    blocks: [
      { duration: 30, power: 1.15 },
      { duration: 30, power: 0.55 },
    ],
    repeat: 12,
  },
  {
    name: 'Tempo Blocks',
    description: 'Steady tempo efforts',
    blocks: [
      { duration: 600, power: 0.85 },
      { duration: 120, power: 0.50 },
    ],
    repeat: 3,
  },
] as const;

// ============================================================================
// Keyboard Shortcuts
// ============================================================================

export const SHORTCUTS = {
  DELETE: ['Delete', 'Backspace'],
  UNDO: 'z',
  REDO: ['y', 'Z'], // Z with shift
  SELECT_ALL: 'a',
  DUPLICATE: 'd',
  ESCAPE: 'Escape',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
} as const;

// ============================================================================
// Animation Timing
// ============================================================================

export const ANIMATION = {
  DRAG_TRANSITION: 'transform 0.05s ease-out',
  SELECTION_TRANSITION: 'stroke 0.15s ease, stroke-width 0.15s ease',
  HOVER_TRANSITION: 'filter 0.1s ease',
  METRICS_UPDATE_DEBOUNCE: 16, // ms (~60fps)
} as const;

// ============================================================================
// History Configuration
// ============================================================================

export const HISTORY = {
  MAX_SIZE: 100,
  DEBOUNCE_MS: 300, // Group rapid changes
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

export function getZoneForPower(power: number): ZoneConfig {
  for (const zone of POWER_ZONES) {
    if (power >= zone.min && power < zone.max) {
      return zone;
    }
  }
  return POWER_ZONES[POWER_ZONES.length - 1];
}

export function getZoneColor(power: number): string {
  return getZoneForPower(power).color;
}

export function getZoneClass(power: number): string {
  const zone = getZoneForPower(power);
  const index = POWER_ZONES.indexOf(zone) + 1;
  return `zone-${index}`;
}

export function getZoneName(power: number): string {
  return getZoneForPower(power).name;
}
