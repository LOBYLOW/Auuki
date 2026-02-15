# Development Guide

## Running Locally

To develop or test the application locally, you need Node.js installed.

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Development Server
The application uses Parcel as a bundler. To ensure that your user data (profiles, settings) persists between restarts, **you must run the application on a fixed port**.

We have configured `npm start` to use port **3000** by default.

```bash
npm start
```

*   Access the app at: `http://localhost:3000`
*   **Note**: If you access the app on a different port (e.g., 3001), it will be treated as a new origin, and your previous users/settings will not be visible.

### 3. User Management Testing
*   **Profile Selector**: On first load, you will be prompted to create a user.
*   **Switching Users**: Click the user badge in the top header to switch profiles.
*   **Persistence**: User data is stored in the browser's `localStorage` and `IndexedDB`. Clearing browser data will remove all users.

## Project Structure
```
src/
├── index.html              # Main entry point
├── index.js                # App initialization
├── db.js                   # Central state management
├── functions.js            # xf event bus
├── watch.js                # Workout timer & interval logic
│
├── views/                  # Web Components (legacy)
│   ├── workout-graph.js    # SVG workout visualization
│   ├── coaching-text.js    # Coaching notes overlay
│   ├── remaining-time.js   # Workout countdown timer
│   └── ...
│
├── workout-builder/        # React/TypeScript (modern)
│   ├── WorkoutBuilder.tsx  # Main component
│   ├── store.ts            # Zustand state
│   ├── types.ts            # TypeScript definitions
│   ├── components/         # React components
│   └── hooks/              # Custom hooks
│
├── workout-builder-mount.tsx  # React ↔ Vanilla bridge
│
├── models/                 # Business logic
├── storage/                # Persistence layers
├── ble/                    # Bluetooth drivers
├── ant/                    # ANT+ drivers
├── workouts/               # Built-in workouts
├── fit/                    # FIT file format
└── css/                    # Stylesheets

doc/                        # Documentation
test/                       # Unit tests
```

## Development Patterns

### Legacy Pattern (Vanilla JS + Web Components)
```javascript
// Subscribe to state changes
xf.sub('db:power', (power) => {
  this.render(power);
});

// Dispatch events
xf.dispatch('watch:start');
```

### Modern Pattern (React + Zustand)
```typescript
// Use store hooks
const { blocks, updateBlock } = useWorkoutBuilderStore();

// Direct state access with selectors
const selectedBlock = useSelectedBlock();
```

### Bridge Pattern (React ↔ Legacy)
```typescript
// React → Vanilla: Dispatch to xf
const handleSave = (workout: Workout) => {
  const intervals = convertWorkoutToIntervals(workout);
  xf.dispatch('workout:created', intervals);
};

// Vanilla → React: Listen to xf events
useEffect(() => {
  xf.sub('ui:openWorkoutBuilder', handleOpen);
  return () => xf.unsub('ui:openWorkoutBuilder', handleOpen);
}, []);
```

## Feature Development

### Adding a New React Component
1. Create component in `src/workout-builder/components/`
2. Use TypeScript for type safety
3. Connect to Zustand store for state
4. Export via `components/index.ts`

### Adding a New Web Component (Legacy)
1. Create component in `src/views/`
2. Subscribe to `db:*` events for data
3. Import in `src/views/views.js`
4. Add element to `src/index.html`

### Coaching Text Integration
Coaching text flows through the system:
1. **Editor**: PropertyPanel.tsx textarea
2. **Store**: `text` field on WorkoutBlock
3. **Bridge**: Converted in workout-builder-mount.tsx
4. **Runtime**: watch.js dispatches `watch:coachingText`
5. **Display**: coaching-text.js web component

## Testing
```bash
npm test           # Run all tests
npm test -- --watch  # Watch mode
```

## Contributing
*   Ensure code passes linting
*   Write tests for new logic
*   Use TypeScript for new features
*   Follow existing patterns for consistency
