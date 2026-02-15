# Technical Overview

## Architecture Pattern
The Application uses a **Hybrid Reactive Architecture** combining:
1. A custom **Reactive Event-Driven Architecture** (vanilla JS with Web Components)
2. A modern **React/TypeScript Architecture** (for new feature development)

It functions as a Single Page Application (SPA) that is progressively migrating to the React architecture.

---

## Legacy Architecture (Vanilla JS)

### Key Components

1.  **Event Bus (`xf`)**:
    *   Located in `src/functions.js`.
    *   The backbone of the application. It wraps the native browser `CustomEvent` and `window.dispatchEvent`.
    *   Components subscribe (`xf.sub`) to events and dispatch (`xf.dispatch`) changes.
    *   It supports a proxy-based state observation mechanism (`xf.create`), though mostly used for simple pub/sub in the codebase.

2.  **State Management (`db.js`)**:
    *   Centralized "Single Source of Truth".
    *   Modules import `db.js` which initializes the state.
    *   It subscribes to various hardware and logic events to update the state (Speed, Power, Heart Rate, etc.).
    *   It uses `models/models.js` to validate and structure the data.

3.  **Data Models (`src/models/`)**:
    *   Enforces type safety and business logic on state properties (e.g., `Power`, `HeartRate` boundaries).
    *   Uses a `Model` base class for common validation, parsing, and persistence logic.

4.  **Hardware Interface (`src/ble/`, `src/ant/`)**:
    *   **BLE**: Handles Bluetooth Low Energy interactions. Uses `web-bluetooth` API.
    *   **ANT+**: Handles ANT+ interactions. Uses `web-usb` or implementation specific drivers.
    *   Devices are abstracted (PowerMeter, Controllable, HeartRateMonitor).

5.  **Views (`src/views/`)**:
    *   Web Components (Custom Elements) or standard helper functions that render the UI.
    *   They subscribe to `xf` events to update reactively without a heavy Virtual DOM framework.

6.  **Workouts (`src/workouts/`)**:
    *   Stored generally in XML format (resembling ZWO).
    *   Parsed and executed by a timer/logic engine.

---

## Modern Architecture (React/TypeScript)

### Overview
New features are being developed using React 19, TypeScript, and Zustand for state management. This architecture coexists with the legacy system through an event bridge.

### Workout Builder (`src/workout-builder/`)

A fully-featured visual drag-and-drop workout editor built with React.

#### Structure
```
src/workout-builder/
├── WorkoutBuilder.tsx       # Main component
├── store.ts                 # Zustand store with undo/redo (zundo)
├── types.ts                 # TypeScript type definitions
├── constants.ts             # Interval presets, zone configs
├── utils.ts                 # Helper functions
├── index.ts                 # Public exports
├── components/
│   ├── WorkoutTimeline.tsx  # SVG-based workout graph canvas
│   ├── DraggableBlock.tsx   # Individual workout blocks
│   ├── RepeatGroup.tsx      # Interval set containers
│   ├── PropertyPanel.tsx    # Block property editor (sidebar)
│   ├── MetricsPanel.tsx     # TSS, IF, duration, zone distribution
│   └── Toolbar.tsx          # Add blocks, intervals, undo/redo
└── hooks/
    └── useKeyboardShortcuts.ts  # Keyboard navigation
```

#### Features
- **Visual Block Editing**: Drag-and-drop blocks, resize via edges
- **Ramp Creation**: Drag edges up/down to create warmup/cooldown ramps
- **Property Panel**: Edit type, duration, power, cadence, coaching notes
- **Zone Distribution**: Visual bar showing time in each training zone
- **Interval Presets**: 10 structured interval templates (30/30, Tabata, etc.)
- **Coaching Text**: Per-block coaching notes displayed during workout execution
- **Undo/Redo**: Full history with Ctrl+Z / Ctrl+Shift+Z
- **ZWO Export**: Export workouts in Zwift-compatible format

#### State Management
Uses Zustand with temporal middleware for undo/redo:
```typescript
interface WorkoutBuilderState {
  workout: Workout;
  selectedIds: string[];
  ftp: number;
  // Actions
  addBlock: (type: BlockType) => void;
  updateBlock: (id: string, updates: Partial<WorkoutBlock>) => void;
  deleteSelected: () => void;
  // ... more actions
}
```

#### Integration Bridge (`src/workout-builder-mount.tsx`)
Bridges React and vanilla JS via the `xf` event system:
- **React → Vanilla**: Dispatches `workout:created`, `workout:load` events
- **Vanilla → React**: Listens for `ui:openWorkoutBuilder` events
- **Data Conversion**: Converts between React types and legacy interval format

### Coaching Text System

Coaching text flows through the system as follows:

1. **Creation**: User enters notes in PropertyPanel textarea
2. **Storage**: Saved as `text` field on `WorkoutBlock`
3. **Conversion**: Mapped to interval `text` field via `convertSingleBlock()`
4. **Runtime**: `watch.js` dispatches `watch:coachingText` on interval change
5. **Display**: `<coaching-text>` web component shows overlay with 10s auto-hide
6. **Export**: Written as `<textevent>` elements in ZWO format

### Build System
*   **Bundler**: Parcel 2.x (handles both vanilla JS and React/TypeScript)
*   **Test Runner**: Jest
*   **Transpiler**: Babel (for JS), TypeScript (for .ts/.tsx)
*   **React**: React 19 with automatic JSX transform
*   **State Management**: Zustand with zundo (temporal undo/redo)

### Type Safety
The modern architecture uses TypeScript for compile-time type checking:
- `src/workout-builder/types.ts` - Workout, WorkoutBlock, RepeatGroup interfaces
- React components use typed props and state
- Zustand store is fully typed

## User Management & Persistence
The application supports multiple user profiles on a single device, useful for shared training setups.

### Components
1.  **UserManager (`src/models/user.js`)**:
    *   Singleton service responsible for CRUD operations on users.
    *   Persists the list of users to `localStorage` under `app:users`.
    *   Tracks the currently selected user and remembers the last active user (`app:last-user`).

2.  **Profile Selector (`src/views/profile-selector.js`)**:
    *   A full-screen Web Component overlay that forces the user to select or create a profile on startup.
    *   Hides itself once a valid user is selected and dispatches the `app:start` event.

3.  **User Badge (`src/views/user-badge.js`)**:
    *   A persistent UI element in the header displaying the current user.
    *   Allows switching users by clicking (which reloads the app to ensure clean state).

### Storage Strategy
*   **User Isolation**: Data stored in `localStorage` is prefixed with the user's unique ID (e.g., `u-12345:ftp`).
*   **Scoped Access**: The `src/storage/local-storage.js` helper uses a `globalContext` function (set by `UserManager`) to automatically prepend the correct user ID to all storage keys.
*   **Port Dependency**: Since `localStorage` is origin-bound, the development server must run on a fixed port (e.g., 3000) to ensure data persistence across restarts.

## Flow of Data
1.  **Hardware Input**: A BLE device sends a notification (e.g., Power measurement).
2.  **Driver Layer**: `src/ble/` decodes the data.
3.  **Event Dispatch**: The driver dispatches an event (e.g., `ble:power`).
4.  **State Update**: `db.js` listens to `ble:power` and updates `state.power`.
5.  **UI Update**: Views listening to `db:power` (or similar) verify the change and re-render the DOM.

## Storage
*   **IndexedDB**: Used for heavy data like activity logs (`src/storage/idb.js`).
*   **LocalStorage**: Used for user preferences (Profile, Settings).
