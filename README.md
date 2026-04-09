# Window Manager

A Windows desktop utility built with Electron that lets you pin any application window as always-on-top and resize it. Manage window z-order and dimensions from a compact, always-accessible interface.

## Features

- **Pin Windows** - Set any application window as always-on-top with one click
- **Resize Windows** - Resize any window using preset sizes or custom dimensions
- **Window List** - Browse all open application windows with real-time updates
- **Search/Filter** - Quickly find windows by title
- **System Tray** - Minimize to tray, unpin all windows, quick access menu
- **Dark Theme** - Clean, minimal frameless dark interface

## Prerequisites

- **Node.js** 18+ and npm
- **Windows** (uses Win32 APIs via koffi)

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd miniplayer-project
   ```

2. Install dependencies:
   ```bash
   cd electron-app
   npm install
   ```

3. Run the app:
   ```bash
   npm run dev
   ```

## Usage

1. Launch the app - it appears as a compact window in the bottom-right corner
2. The window list shows all open application windows
3. Click the pin icon next to any window to toggle always-on-top
4. Click the resize icon or select a window to open the resize panel
5. Choose a preset size or enter custom dimensions

**Window Controls:**
- Drag the title bar to move the window
- Use the refresh button (or F5) to manually refresh the window list
- Close button hides to system tray (right-click tray icon to quit)
- "Unpin All" in tray menu removes all pinned states

## Architecture

```
Main Process
  - WindowManager: Frameless always-on-top window
  - WindowService: Win32 API calls via koffi (EnumWindows, SetWindowPos, etc.)
  - TrayManager: System tray with context menu
  - IpcHandlers: Bridges main and renderer processes

Preload Script
  - Secure bridge exposing window.electronAPI

Renderer Process
  - TitleBar, WindowList, ResizePanel components
```

## Development

All commands run from `electron-app/`:

| Command | Description |
|---------|-------------|
| `npm run dev` | Compile TypeScript + copy assets + launch Electron |
| `npm run compile` | TypeScript compile + bundle + copy assets |
| `npm run watch` | TypeScript watch mode for development |
| `npm start` | Launch Electron from compiled dist |
| `npm test` | Run Jest unit tests |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run test:all` | Run all tests |

### Project Structure

```
miniplayer-project/
  electron-app/
    src/
      main/          # Main process (window, tray, Win32 service, IPC)
      preload/       # IPC bridge script
      renderer/      # UI components and styles
      shared/        # Shared types and constants
    resources/       # Icons
    dist/            # Compiled output
    release/         # Production builds
```

## Building for Production

```bash
cd electron-app
npm run build
```

The installer will be created in `electron-app/release/`.

## Security

- Context isolation between renderer and main processes
- Input validation on all IPC handlers
- Dimension bounds checking for resize operations
- Cannot modify elevated (admin) process windows unless running as admin

## License

MIT
