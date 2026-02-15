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
*   `src/`: Source code
    *   `views/`: Web Components for UI
    *   `models/`: Business logic and state management
    *   `storage/`: Persistence layers
    *   `ble/`, `ant/`: Hardware drivers
*   `doc/`: Documentation
*   `test/`: Unit tests

## Contributing
*   Ensure code passes linting.
*   Write tests for new logic in `src/functions.js` or `src/utils.js`.
