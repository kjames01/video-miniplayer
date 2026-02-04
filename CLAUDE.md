# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A floating video miniplayer for Windows built with Electron. The app extracts playable video URLs from websites using yt-dlp and displays them in an always-on-top frameless window. A companion browser extension sends URLs to the desktop app.

## Commands

All commands run from `electron-app/`:

```bash
npm run dev        # Compile TypeScript + copy assets + launch Electron
npm run compile    # TypeScript compile + copy HTML/CSS to dist
npm run build      # Full production build with electron-builder
npm run watch      # TypeScript watch mode (assets not copied)
npm start          # Launch Electron from compiled dist (no compile)
npm test           # Run Jest tests
npm test -- urlCache.test.ts           # Run a single test file
npm test -- --coverage                 # Run with coverage report
```

## Architecture

### Three-Process Electron Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Main Process                             │
│  src/main/main.ts (entry point)                             │
│  ├── WindowManager - frameless always-on-top window         │
│  ├── TrayManager - system tray with context menu            │
│  ├── LocalServer - HTTP server on 127.0.0.1:9527            │
│  ├── YtdlpManager - spawns yt-dlp.exe subprocess            │
│  ├── UrlCache - 30-min cache for extracted URLs             │
│  └── IpcHandlers - bridges main ↔ renderer                  │
└─────────────────────────────────────────────────────────────┘
        │ IPC (contextBridge)
        ▼
┌─────────────────────────────────────────────────────────────┐
│                    Preload Script                            │
│  src/preload/preload.ts                                     │
│  Exposes window.electronAPI to renderer                     │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│                   Renderer Process                           │
│  src/renderer/renderer.ts                                   │
│  Components: VideoPlayer, Controls, TitleBar, UrlInput      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  Browser Extension                           │
│  browser-extension/                                         │
│  Sends URLs via HTTP POST to LocalServer                    │
└─────────────────────────────────────────────────────────────┘
```

### IPC Communication

All channel names defined in `src/shared/types.ts`:
- Renderer → Main: `ipcRenderer.invoke()` for async results, `ipcRenderer.send()` for fire-and-forget
- Main → Renderer: `webContents.send()` for pushing events (PLAY_URL, VIDEO_READY, EXTRACTION_ERROR)

### Extension ↔ App Protocol

HTTP server on `127.0.0.1:9527`:
- `GET /ping` - Check if app is running
- `POST /send-url` - Send `{ url, title }` JSON to play in miniplayer

### Key Design Patterns

- **Preload bridge**: Renderer never imports Electron directly. All IPC via `window.electronAPI`
- **Frameless window**: Uses `-webkit-app-region: drag` on title bar, `no-drag` on buttons
- **Single instance**: `app.requestSingleInstanceLock()` prevents multiple app instances
- **Hide to tray**: Close button hides window; quit only via tray menu

### Binary Dependency

yt-dlp.exe is bundled at `resources/bin/win/yt-dlp.exe` and copied to `bin/` in packaged app via electron-builder's `extraResources`.

## Testing

Tests use Jest with ts-jest and are located in `__tests__/` directories adjacent to the code they test. Electron is mocked via `src/__mocks__/electron.ts`.

Coverage thresholds are enforced for:
- `urlCache.ts`: 100% coverage required
- `localServer.ts`: 90% statements, 80% branches

## Styling

- Dark theme: `#1a1a1a` background
- Accent: `#1db954` (green)
- Auto-hiding video controls on hover
