# Auuki Application Modernization Plan

> **Last Updated**: February 16, 2026

## Implementation Progress

| Phase | Step | Status | Notes |
|-------|------|--------|-------|
| Phase 0 | Install React/TypeScript dependencies | ✅ Done | `react`, `react-dom`, `zustand`, `immer`, `zundo`, `@types/react`, `@types/react-dom`, `typescript` |
| Phase 0 | Configure TypeScript | ✅ Done | Created `tsconfig.json` with React JSX support |
| Phase 0 | Create React mount points | ✅ Done | Added `#react-workout-builder` mount point in workouts page |
| Phase 0 | Create xf ↔ React bridge | ✅ Done | `workout-builder-mount.tsx` bridges React with `xf` pub/sub |
| Phase 1 | Implement WorkoutBuilder component | ✅ Done | Full implementation in `src/workout-builder/` |
| Phase 1 | Integrate into existing app | ✅ Done | Accessible via "Builder (React)" nav link |
| Phase 1 | Add Zone Distribution visualization | ✅ Done | Visual bar showing time-in-zone breakdown |
| Phase 1 | Add Editable FTP | ✅ Done | Click-to-edit FTP in MetricsPanel |
| Phase 1 | Add Coaching Notes | ✅ Done | Text field per block, integrated with ZWO export |
| Phase 1 | Add Interval Presets | ✅ Done | 10 coach-designed interval templates |
| Phase 1 | Coaching Text Playback | ✅ Done | `<coaching-text>` web component, xf integration |
| Phase 1 | Property Panel Sidebar | ✅ Done | Right-side panel with all block properties |

### Files Created
- `tsconfig.json` - TypeScript configuration
- `src/workout-builder-mount.tsx` - React mount script with xf bridge
- `src/css/workout-builder.css` - Component styles
- `src/views/coaching-text.js` - Web component for coaching text display
- `src/workout-builder/` - Full React implementation:
  - `types.ts` - TypeScript type definitions (includes `text` field)
  - `constants.ts` - Power zones, snapping config, 10 interval presets
  - `utils.ts` - Metrics calculations, zone distribution
  - `store.ts` - Zustand store with undo/redo, `addIntervalSet` action
  - `WorkoutBuilder.tsx` - Main component with sidebar layout
  - `components/` - DraggableBlock, WorkoutTimeline, Toolbar, PropertyPanel, MetricsPanel
  - `hooks/useKeyboardShortcuts.ts` - Keyboard shortcuts

### Files Modified
- `src/index.html` - Added mount point, nav link, CSS import, script import, `<coaching-text>`
- `src/views/data-views.js` - Added builder tab navigation handling
- `src/views/views.js` - Added coaching-text.js import
- `src/db.js` - Added `coachingText` field to state
- `src/watch.js` - Added `dispatchCoachingText()` method and event registration

---

## Current Architecture Analysis

### Existing Stack
- **Build Tool**: Parcel 2.12
- **UI Framework**: Vanilla JavaScript with Web Components
- **State Management**: Custom pub/sub system (`xf`)
- **Styling**: CSS files with CSS variables
- **Data Flow**: Event-driven with `xf.dispatch()` and `xf.sub()`

### Current Strengths
1. Lightweight bundle size
2. No framework lock-in
3. Native browser APIs (Web Components)
4. Simple mental model for data flow

### Current Pain Points
1. No TypeScript = runtime errors, poor IDE support
2. Manual DOM manipulation = verbose, error-prone
3. No built-in undo/redo
4. State scattered across components
5. Complex components hard to maintain
6. Testing is difficult without proper mocking

---

## Proposed Modern Architecture

### Target Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                        Application Layer                         │
├─────────────────────────────────────────────────────────────────┤
│  React 18+        │  TypeScript 5.x    │  CSS Modules/Tailwind │
├─────────────────────────────────────────────────────────────────┤
│                       State Management                           │
├─────────────────────────────────────────────────────────────────┤
│  Zustand (UI)     │  React Query       │  Temporal (History)    │
│                   │  (Server State)    │                        │
├─────────────────────────────────────────────────────────────────┤
│                       Data/Services                              │
├─────────────────────────────────────────────────────────────────┤
│  IndexedDB (IDB)  │  Workout Engine    │  Device Connectors     │
│  Local Storage    │  (BLE/ANT+)        │                        │
├─────────────────────────────────────────────────────────────────┤
│                       Build/Test                                 │
├─────────────────────────────────────────────────────────────────┤
│  Vite             │  Vitest            │  Playwright            │
└─────────────────────────────────────────────────────────────────┘
```

### Why This Stack?

| Technology | Reasoning |
|------------|-----------|
| **React 18** | Concurrent features, ecosystem, hiring pool |
| **TypeScript** | Type safety, better refactoring, IDE support |
| **Zustand** | Simple, lightweight, no boilerplate, middleware support |
| **Vite** | Faster than Parcel, better HMR, native ESM |
| **Vitest** | Jest-compatible, Vite-native, faster |
| **CSS Modules** | Scoped styles, works well with React |

---

## Migration Strategy: Strangler Fig Pattern

The Strangler Fig pattern allows incremental migration without a complete rewrite.

### Phase 0: Setup (Week 1-2) ✅ COMPLETE

```
1. Add React + TypeScript dependencies     ✅
2. Configure Vite alongside Parcel         (Using Parcel - works with TSX)
3. Create React mount points in existing HTML  ✅
4. Set up shared adapter layer for xf ↔ Zustand  ✅
```

#### Dependencies to Add

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "zustand": "^4.5.0",
    "zundo": "^2.0.0",
    "immer": "^10.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

### Phase 1: Bridge Layer (Week 2-3)

Create an adapter that allows React components to communicate with the existing `xf` pub/sub system.

```typescript
// src/adapters/xf-bridge.ts
import { useEffect, useState } from 'react';
import { xf } from '../functions.js';

/**
 * React hook that subscribes to xf events
 */
export function useXfSubscription<T>(event: string, initialValue: T): T {
  const [value, setValue] = useState<T>(initialValue);

  useEffect(() => {
    const controller = new AbortController();
    xf.sub(event, (data: T) => setValue(data), { signal: controller.signal });
    return () => controller.abort();
  }, [event]);

  return value;
}

/**
 * Dispatch xf events from React
 */
export function dispatchXf(event: string, data?: unknown): void {
  xf.dispatch(event, data);
}

/**
 * Sync Zustand store with xf for gradual migration
 */
export function createXfSyncMiddleware<T>(store: any, mappings: Record<string, keyof T>) {
  Object.entries(mappings).forEach(([xfEvent, storeKey]) => {
    xf.sub(xfEvent, (value) => {
      store.setState({ [storeKey]: value });
    });
  });
}
```

### Phase 2: Component Migration Priority

Migrate components based on complexity and dependency:

#### Tier 1: Isolated, Self-Contained (Week 3-4)
These components have minimal dependencies and can be migrated first:

1. **MetricsPanel** → `<MetricsDisplay />`
2. **RemainingTime** → `<RemainingTime />`
3. **IntensityControl** → `<IntensitySlider />`

#### Tier 2: Data-Bound Components (Week 5-7)
These read from/write to the data layer:

4. **WorkoutGraph** → `<WorkoutTimeline />` (React SVG)
5. **WorkoutList** → `<WorkoutList />`
6. **Editor** → `<WorkoutBuilder />` ✅ (Already implemented)

#### Tier 3: Device/Hardware Components (Week 8-10)
These interact with BLE/ANT+ and require careful migration:

7. **ConnectionSwitch** → `<DeviceConnection />`
8. **ANTDeviceScan** → `<ANTScanner />`
9. **DataViews** → `<LiveDataDisplay />`

#### Tier 4: Core Application Shell (Week 11-12)
10. **Main App Layout**
11. **Navigation/Tabs**
12. **Settings/Profiles**

### Phase 3: State Migration

#### Current State (xf)
```javascript
// Scattered across components
xf.sub('db:ftp', ...);
xf.sub('db:workout', ...);
xf.dispatch('workout:start', ...);
```

#### Target State (Zustand)
```typescript
// Centralized stores
const useAppStore = create<AppState>((set, get) => ({
  ftp: 200,
  workout: null,
  elapsed: 0,
  // ...
}));

const useDeviceStore = create<DeviceState>((set) => ({
  connectedDevices: [],
  // ...
}));

const useWorkoutBuilderStore = create<WorkoutBuilderState>((set) => ({
  // Already implemented
}));
```

---

## Directory Structure Migration

### Current Structure
```
src/
├── views/           # Web Components (mixed concerns)
├── models/          # Data models
├── storage/         # IndexedDB/LocalStorage
├── ble/             # Bluetooth
├── ant/             # ANT+
├── css/             # Global styles
└── workouts/        # Workout data
```

### Target Structure
```
src/
├── app/                    # Application entry point
│   ├── App.tsx
│   ├── routes.tsx
│   └── providers.tsx
│
├── features/               # Feature-based organization
│   ├── workout-builder/    # ✅ Implemented
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── store.ts
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   ├── workout-player/     # Live workout execution
│   │   ├── components/
│   │   ├── hooks/
│   │   └── store.ts
│   │
│   ├── device-manager/     # BLE/ANT+ connections
│   │   ├── components/
│   │   ├── hooks/
│   │   └── services/
│   │
│   └── activity-history/   # Past activities
│
├── shared/                 # Shared utilities
│   ├── components/         # Reusable UI components
│   ├── hooks/              # Generic hooks
│   ├── lib/                # Utilities
│   └── types/              # Shared types
│
├── services/               # External services
│   ├── api/                # Backend API
│   ├── ble/                # Bluetooth (from existing)
│   ├── ant/                # ANT+ (from existing)
│   └── storage/            # IndexedDB/LocalStorage
│
├── styles/                 # Global styles
│   ├── variables.css
│   ├── reset.css
│   └── themes/
│
└── legacy/                 # Existing code during migration
    ├── views/              # Old Web Components
    └── adapters/           # Bridge code
```

---

## Code Migration Examples

### Example 1: Simple Component

**Before (Web Component)**
```javascript
// src/views/remaining-time.js
class RemainingTime extends HTMLElement {
    connectedCallback() {
        this.abortController = new AbortController();
        xf.sub('db:elapsed', this.onElapsed.bind(this), { signal: ... });
        xf.sub('db:workout', this.onWorkout.bind(this), { signal: ... });
    }
    
    render() {
        this.innerHTML = `<div>${display}</div>`;
    }
}
customElements.define('remaining-time', RemainingTime);
```

**After (React)**
```tsx
// src/features/workout-player/components/RemainingTime.tsx
import { useAppStore } from '@/stores/appStore';
import { formatTime } from '@/shared/lib/time';

export const RemainingTime: React.FC = () => {
  const elapsed = useAppStore((s) => s.elapsed);
  const duration = useAppStore((s) => s.workout?.meta.duration ?? 0);
  
  const remaining = Math.max(0, duration - elapsed);
  const display = duration > 0 ? formatTime(remaining, 'mm:ss') : '--:--';

  return (
    <div className="remaining-time">
      <span className="label">Remaining</span>
      <span className="value">{display}</span>
    </div>
  );
};
```

### Example 2: Complex Interactive Component

**Before (Web Component with SVG)**
```javascript
// src/views/workout-graph.js
// 478 lines of DOM manipulation, event handling, SVG generation
```

**After (React)**
```tsx
// src/features/workout-builder/components/WorkoutTimeline.tsx
// Clean separation: hooks for logic, component for rendering
// Type safety, easier testing, better maintainability
// See implemented version in src/workout-builder/components/
```

---

## Testing Strategy

### Unit Tests (Vitest)
```typescript
// src/features/workout-builder/__tests__/utils.test.ts
import { describe, it, expect } from 'vitest';
import { calculateWorkoutMetrics, snapDuration } from '../utils';

describe('calculateWorkoutMetrics', () => {
  it('calculates TSS correctly for steady blocks', () => {
    const blocks = [{ duration: 3600, power: 1.0, type: 'steady' }];
    const metrics = calculateWorkoutMetrics(blocks, 200);
    expect(metrics.tss).toBe(100);
  });
});

describe('snapDuration', () => {
  it('snaps to 15-second increments', () => {
    expect(snapDuration(67)).toBe(60);
    expect(snapDuration(68)).toBe(75);
  });
});
```

### Component Tests
```typescript
// src/features/workout-builder/__tests__/WorkoutBuilder.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkoutBuilder } from '../WorkoutBuilder';

describe('WorkoutBuilder', () => {
  it('adds a block when clicking add button', () => {
    render(<WorkoutBuilder ftp={200} />);
    fireEvent.click(screen.getByText('+ Steady'));
    expect(screen.getByText('75%')).toBeInTheDocument();
  });
});
```

### E2E Tests (Playwright)
```typescript
// e2e/workout-builder.spec.ts
import { test, expect } from '@playwright/test';

test('can create and resize workout blocks', async ({ page }) => {
  await page.goto('/workout-builder');
  await page.click('text=+ Steady');
  
  // Drag right edge to resize
  const handle = page.locator('.handle-right');
  await handle.dragTo(handle, { targetPosition: { x: 100, y: 0 } });
  
  // Verify duration changed
  await expect(page.locator('.duration-label')).toContainText('6:40');
});
```

---

## Performance Considerations

### Bundle Size
- Use dynamic imports for heavy features
- Tree-shake unused code
- Consider React Server Components for dashboard

```typescript
// Lazy load workout builder
const WorkoutBuilder = React.lazy(() => import('./features/workout-builder'));
```

### Runtime Performance
- Use `useMemo` for expensive calculations
- Virtualize long lists (workout history)
- Debounce rapid state updates during drag

```typescript
// Throttle metrics recalculation during drag
const debouncedRecalculate = useMemo(
  () => debounce(recalculateMetrics, 16),
  [recalculateMetrics]
);
```

### Memory Management
- Clean up subscriptions properly
- Use WeakMap for caching
- Properly dispose BLE/ANT+ connections

---

## Timeline Summary

| Phase | Duration | Deliverable | Status |
|-------|----------|-------------|--------|
| **Setup** | Week 1-2 | Build system, TypeScript config, bridge layer | ✅ Complete |
| **Workout Builder** | Week 3-4 | Full-featured workout builder component | ✅ Complete |
| **Coach Features** | Week 5 | Zone distribution, coaching notes, presets | ✅ Complete |
| **Tier 1 Components** | Week 6-7 | Simple isolated components (RemainingTime, etc.) | 🔄 In Progress |
| **Tier 2 Components** | Week 8-10 | Data-bound components (WorkoutList, Activity views) | ⬜ Planned |
| **Tier 3 Components** | Week 11-13 | Device components (BLE/ANT+ connectors) | ⬜ Planned |
| **Tier 4 + Cleanup** | Week 14-15 | App shell, navigation, remove legacy code | ⬜ Planned |
| **Testing & Polish** | Week 16-17 | Full test coverage, documentation | ⬜ Planned |

**Total: ~17 weeks for full migration**

### Current Progress Summary
- **Phase 0-1 Complete**: React foundation, workout builder fully implemented
- **Coach Features Complete**: Zone distribution, editable FTP, coaching notes, interval presets
- **Integration Complete**: Coaching text flows from builder → database → playback → ZWO export
- **Next Steps**: Begin migrating Tier 1 components (RemainingTime, MetricsPanel, IntensityControl)

---

## Rollback Strategy

1. Keep existing code in `src/legacy/` until fully tested
2. Feature flags to toggle between old/new implementations
3. Parallel deployment: old and new can coexist
4. If issues arise, revert feature flag

```typescript
// Feature flag example
const FEATURES = {
  NEW_WORKOUT_BUILDER: process.env.FEATURE_NEW_WORKOUT_BUILDER === 'true',
};

function renderWorkoutEditor() {
  if (FEATURES.NEW_WORKOUT_BUILDER) {
    return <WorkoutBuilder />;
  }
  // Mount legacy Web Component
  return <div ref={mountLegacyEditor} />;
}
```

---

## Next Steps

1. **Immediate**: Migrate RemainingTime web component to React
2. **This Week**: Create shared React component library (buttons, inputs, panels)
3. **Next Week**: Migrate IntensityControl and MetricsPanel components
4. **Sprint 2**: Migrate WorkoutList and ActivityList (data-bound)
5. **Sprint 3**: Begin device connection components (BLE/ANT+)
6. **Ongoing**: Add Vitest unit tests for all migrated components

---

## References

- [Strangler Fig Pattern](https://martinfowler.com/bliki/StranglerFigApplication.html)
- [Zustand Documentation](https://zustand-demo.pmnd.rs/)
- [Vite Documentation](https://vitejs.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
