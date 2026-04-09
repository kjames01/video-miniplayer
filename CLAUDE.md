# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Windows desktop utility built with Electron that lets users pin any application window as always-on-top and resize it. Uses Win32 APIs (via koffi FFI library) to enumerate, pin, and resize external application windows.

## Commands

All commands run from `electron-app/`:

```bash
npm run dev        # Compile TS + bundle renderer + copy assets + launch Electron
npm run compile    # TypeScript compile + esbuild bundle renderer + copy HTML/CSS to dist
npm run build      # Full production build with electron-builder
npm run watch      # TypeScript watch mode (assets not copied)
npm start          # Launch Electron from compiled dist (no compile)
npm test           # Run Jest unit tests
npm run test:e2e   # Run Playwright E2E tests
npm run test:all   # Run all tests (unit + E2E)
```

## Architecture

### Electron Architecture

```
Main Process
  src/main/main.ts (entry point)
  ├── WindowManager - frameless always-on-top window (420x520)
  ├── WindowService - Win32 API calls via koffi (EnumWindows, SetWindowPos, etc.)
  ├── TrayManager - system tray with context menu
  └── IpcHandlers - bridges main ↔ renderer

Preload Script
  src/preload/preload.ts
  Exposes window.electronAPI to renderer via contextBridge

Renderer Process
  src/renderer/renderer.ts
  Components: TitleBar, WindowList, ResizePanel
```

### IPC Communication

All channel names defined in `src/shared/types.ts` as `IPC_CHANNELS` const object. Constants in `src/shared/constants.ts`.

- Renderer → Main (invoke): `GET_WINDOWS`, `SET_TOPMOST`, `RESIZE_WINDOW`, `FOCUS_WINDOW`, `GET_SETTINGS`, `SAVE_SETTINGS`
- Renderer → Main (send): `MINIMIZE_WINDOW`, `CLOSE_WINDOW`, `SET_ALWAYS_ON_TOP`

### Win32 API Integration

`WindowService` uses koffi to call user32.dll functions:
- `EnumWindows` + callback to list windows
- `SetWindowPos` with `HWND_TOPMOST`/`HWND_NOTOPMOST` for pinning
- `SetWindowPos` for resizing (preserves position)
- `GetWindowRect`, `GetWindowTextW`, `GetClassNameW` for window info
- `SetForegroundWindow` + `ShowWindow` for focusing

Window filtering excludes: invisible windows, tool windows, system classes (Progman, WorkerW, Shell_TrayWnd), and our own Electron window.

### Key Design Patterns

- **Preload bridge**: Renderer never imports Electron directly. All IPC via `window.electronAPI`
- **Frameless window**: Uses `-webkit-app-region: drag` on title bar, `no-drag` on buttons
- **Single instance**: `app.requestSingleInstanceLock()` prevents multiple app instances
- **Hide to tray**: Close button hides window; quit only via tray menu
- **koffi asar unpack**: Native module unpacked from asar via `asarUnpack` in build config

## Testing

Unit tests use Jest with ts-jest. Test files in `src/main/__tests__/`. Electron is mocked via `src/__mocks__/electron.ts`, koffi via `src/__mocks__/koffi.ts` (both mapped in jest.config.js `moduleNameMapper`).

E2E tests use Playwright in `tests/e2e/`. Tests run serially (single worker).

## Build Pipeline

- **Main/preload**: TypeScript compiled via `tsc` to `dist/` (CommonJS, ES2020 target)
- **Renderer**: Bundled with esbuild (`src/renderer/renderer.ts` → `dist/renderer/renderer.js`, browser target)
- **Assets**: `index.html` and `styles.css` copied from `src/renderer/` to `dist/renderer/`
- **Production**: electron-builder packages into NSIS installer

## TypeScript

Strict mode with `noUncheckedIndexedAccess` enabled. Also uses `noFallthroughCasesInSwitch`.

## Styling

- Dark theme: `#1a1a1a` background, `#1db954` green accent
- CSS variables for theming consistency
- Compact window list items (~38px height)

## Agent System

This project includes a multi-agent setup in `.claude/agents/` with specialist agents for each part of the architecture (electron, frontend, testing, build, code-review). The manager agent orchestrates complex tasks.
